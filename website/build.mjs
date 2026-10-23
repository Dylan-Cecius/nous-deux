import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deletionRows, faq, privacySections } from './content.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const draft = args.includes('--draft');
const outputIndex = args.indexOf('--output');
if (outputIndex >= 0 && (!args[outputIndex + 1] || args[outputIndex + 1].startsWith('--'))) throw new Error('--output attend un répertoire.');
const output = path.resolve(outputIndex >= 0 ? args[outputIndex + 1] : path.join(root, 'website/dist'));
const config = JSON.parse(await readFile(path.join(root, 'src/constants/public-info.json'), 'utf8'));
const required = ['operatorName', 'operatorLegalName', 'operatorAddress', 'supportEmail', 'securityRetention', 'supportRetention', 'backupRetention'];
const missing = required.filter(key => !config[key]?.trim());
if (config.publicationStatus !== 'published') missing.push('publicationStatus=published');
if (config.retentionVerified !== true) missing.push('retentionVerified=true');
if (!draft && missing.length) throw new Error(`Publication bloquée : ${missing.join(', ')}. Utiliser --draft uniquement pour un aperçu privé.`);
if (config.supportEmail && !/^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/.test(config.supportEmail)) throw new Error('Adresse de contact invalide.');
const site = new URL(config.siteUrl);
if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash) throw new Error('L’URL publique doit être HTTPS, sans identifiants ni paramètres.');
if (!/^\d{4}-\d{2}-\d{2}$/.test(config.updatedAt) || Number.isNaN(Date.parse(config.updatedAt))) throw new Error('Date invalide.');

const e = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const contact = config.supportEmail ? `<a href="mailto:${e(config.supportEmail)}">${e(config.supportEmail)}</a>` : '<span>adresse d’assistance à confirmer</span>';
const table = (headers, rows) => `<div class="table-scroll" tabindex="0" role="region" aria-label="Tableau : défilement horizontal possible"><table><thead><tr>${headers.map(h => `<th scope="col">${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${e(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const nav = [['/', 'Assistance'], ['/confidentialite/', 'Confidentialité'], ['/suppression/', 'Supprimer mon compte']];
const page = (title, route, description, body, hasForm = false) => `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · Nous Deux</title><meta name="description" content="${e(description)}">${draft ? '<meta name="robots" content="noindex,nofollow">' : `<link rel="canonical" href="${e(new URL(route, site).href)}">`}<link rel="icon" href="/assets/logo-heart.png" type="image/png"><link rel="stylesheet" href="/site.css">${hasForm ? '<script src="/forms.js" defer></script>' : ''}</head>
<body><a class="skip" href="#contenu">Aller au contenu</a><header class="wrap topbar"><a class="brand" href="/" aria-label="Nous Deux, accueil de l’assistance"><img src="/assets/logo-heart.png" alt="" width="45" height="45">nous <em>deux</em></a><nav aria-label="Navigation principale">${nav.map(([url,label]) => `<a href="${url}"${url === route ? ' aria-current="page"' : ''}>${label}</a>`).join('')}</nav></header>
${draft ? '<div class="draft"><div class="wrap"><strong>Aperçu privé · version de travail</strong>Mentions légales et durées de conservation à finaliser avant publication.</div></div>' : ''}
<main id="contenu" class="wrap">${body}</main><footer><div class="wrap"><div>Nous Deux · ${e(config.operatorName || 'Éditeur à confirmer')}<br>Un espace à vous, des réponses claires.</div><div>${nav.map(([url,label]) => `<a href="${url}">${label}</a>`).join('')}<br>${contact}</div></div></footer></body></html>`;
const hero = (label, title, description, extra = '') => `<div class="hero"><span class="eyebrow">${label}</span><h1>${title}</h1><p class="lead">${description}</p>${extra}</div>`;
const requestForm = deletion => `<form class="form-card" data-request-form="${deletion ? 'deletion' : 'support'}" data-support-email="${e(config.supportEmail)}">
<h3>${deletion ? 'Préparer ma demande' : 'Écrire à l’assistance'}</h3><p class="muted">Ce formulaire prépare un e-mail. Tu pourras le relire avant de l’envoyer depuis ta messagerie.</p>
<div class="field"><label for="email">Ton e-mail pour recevoir une réponse</label><input type="email" id="email" name="email" autocomplete="email" maxlength="254" required></div>
<div class="field"><label for="accountEmail">E-mail associé à ton compte <span class="muted">(facultatif)</span></label><input type="email" id="accountEmail" name="accountEmail" maxlength="254" aria-describedby="account-hint"><p id="account-hint" class="hint">Laisse vide si ton compte n’a pas d’adresse e-mail ou si tu ne la connais plus.</p></div>
<div class="field"><label for="mode">Comment utilises-tu Nous Deux ?</label><select id="mode" name="mode"><option>Je ne sais pas</option><option>Avec un compte synchronisé</option><option>Sans compte, sur cet appareil</option></select></div>
${deletion ? '' : '<div class="field"><label for="reason">Le sujet de ta demande</label><select id="reason" name="reason"><option>Aide avec mon compte</option><option>Problème de synchronisation</option><option>Signaler un dysfonctionnement</option><option>Exercer un droit sur mes données</option><option>Autre question</option></select></div>'}
<div class="field"><label for="message">${deletion ? 'Une précision utile (facultatif)' : 'Que se passe-t-il ?'}</label><textarea id="message" name="message" maxlength="1500" rows="5"${deletion ? '' : ' required'} aria-describedby="message-hint"></textarea><p class="hint" id="message-hint">${deletion ? 'Tu peux préciser si tu n’as plus accès à l’app.' : 'Indique l’écran, le modèle du téléphone et les étapes pour reproduire le problème.'} Ne partage ni mot de passe, ni code de connexion ou d’invitation, ni contenu intime.</p></div>
${deletion ? '<div class="field"><label class="check"><input type="checkbox" name="ownAccount" required><span>Je demande la suppression de mon propre compte. J’ai lu ce qui sera supprimé et ce qui restera dans l’espace de mon partenaire.</span></label></div>' : ''}
<button type="submit">Préparer mon e-mail</button><p class="hint">${config.supportEmail ? `Destinataire : ${contact}.` : 'Aperçu privé : le destinataire reste à confirmer. Aucune demande ne sera envoyée.'} <a href="/confidentialite/">Utilisation de tes données</a>.</p>
<p class="status" data-status role="status" aria-live="polite"></p><div class="result" data-result hidden><label for="prepared-message">Ton message à relire</label><textarea id="prepared-message" data-message readonly rows="10"></textarea><div class="actions"><a class="button" data-email-link hidden>Ouvrir mon application e-mail</a><button type="button" class="secondary" data-copy>Copier le texte</button></div></div><noscript><p class="notice">La préparation du message nécessite JavaScript. Tu peux écrire directement au contact indiqué : ${contact}.</p></noscript></form>`;

const support = page('Assistance', '/', 'Besoin d’aide avec Nous Deux ? Retrouver son compte, comprendre ses données et contacter l’assistance.', `${hero('À vos côtés', 'Un peu d’aide<br>pour vous deux.', 'Retrouver votre espace, comprendre vos données ou résoudre un souci. Tout commence ici.')}
<div class="cards"><section class="card feature"><span class="number">01 / Un coup de main</span><h2>On t’écoute.</h2><p>Compte, invitation ou petit imprévu : prépare ton message en quelques étapes.</p><a href="#contact">Contacter l’assistance →</a></section><section class="card"><span class="number">02 / En toute clarté</span><h2>Vos données,<br>vos choix.</h2><p>Ce que l’app utilise, ce que vous partagez et comment garder la main.</p><a href="/confidentialite/">Lire la politique →</a></section><section class="card"><span class="number">03 / À ton rythme</span><h2>Envie de<br>partir ?</h2><p>Comprends les étapes et demande la suppression de ton compte.</p><a href="/suppression/">Gérer la suppression →</a></section></div>
<section class="section"><div class="section-head"><span class="eyebrow">Les questions du quotidien</span><h2>Tu trouveras peut-être<br>ta réponse ici.</h2></div>${faq.map(([q,a]) => `<details><summary>${e(q)}</summary><p>${e(a)}</p></details>`).join('')}</section>
<section class="section two-col" id="contact"><div><span class="eyebrow">Besoin d’en parler ?</span><h2>Décris-nous<br>ce qui coince.</h2><p>Un message précis aide à comprendre le problème. Évite d’envoyer des photos ou des conversations personnelles.</p><div class="notice"><p><strong>Une demande concernant tes données ?</strong><br>Tu peux aussi utiliser ce contact pour demander l’accès, la rectification ou l’effacement de tes données.</p></div><p class="muted">${contact}</p></div>${requestForm(false)}</section>`, true);

const sections = privacySections(config, e, contact, table);
const privacy = page('Confidentialité', '/confidentialite/', 'Les données utilisées par Nous Deux, leur partage, leur conservation et les droits des utilisateurs.', `${hero('Vos données, simplement', 'Votre intimité<br>mérite de la clarté.', 'Voici comment Nous Deux utilise les informations que tu lui confies, et les choix qui restent entre tes mains.', `<span class="pill">Mise à jour : ${e(config.updatedAt.split('-').reverse().join('/'))}</span>`)}<div class="article-layout"><aside class="toc" aria-label="Sommaire"><strong>Dans cette page</strong>${sections.map(s => `<a href="#${s.id}">${e(s.title)}</a>`).join('')}</aside><article>${sections.map(s => `<section id="${s.id}"><h2>${e(s.title)}</h2>${s.html}</section>`).join('')}</article></div>`);

const deletion = page('Supprimer mon compte', '/suppression/', 'Supprimer son compte Nous Deux dans l’application ou préparer une demande sans avoir accès à l’app.', `${hero('Garder le choix', 'Supprimer ton compte,<br>en toute clarté.', 'Tu peux quitter Nous Deux depuis l’app ou demander de l’aide ici, même si tu n’as plus accès à ton téléphone.')}
<section class="section two-col"><div class="card"><h2>Depuis l’application</h2><ol class="steps"><li><span>Ouvre l’onglet <strong>Nous</strong>, puis <strong>Ton compte</strong>.</span></li><li><span>Choisis <strong>Supprimer mon compte</strong> et lis les conséquences.</span></li><li><span>Confirme la suppression. Une reconnexion peut être demandée pour protéger ton compte.</span></li></ol></div><div class="card"><h2>Sans accès à l’app</h2><p>Pour un compte synchronisé, prépare une demande ci-dessous puis envoie-la par e-mail. Une vérification de ton lien avec le compte sera nécessaire avant toute suppression.</p><p>Un compte synchronisé sans adresse e-mail peut être plus difficile à retrouver. Ne crée pas un nouveau compte pour tenter de récupérer l’ancien.</p><a href="#demande">Préparer ma demande →</a><div class="notice"><p>Désinstaller l’app ne supprime pas le compte synchronisé sur le serveur.</p></div></div></section>
<section class="section"><h2>Ce qui disparaît.<br>Ce qui reste pour ta moitié.</h2>${table(['Situation', 'Conséquence'], deletionRows)}<p class="muted">En mode synchronisé, les liens d’auteur sont retirés des contenus communs conservés, mais leur texte peut encore contenir des noms. Une demande portant sur ces contenus sera examinée en tenant compte des droits des deux membres.</p><p>Pour les traces techniques et sauvegardes, consulte <a href="/confidentialite/#conservation">les délais de conservation</a>.</p></section>
<section class="section two-col" id="demande"><div><span class="eyebrow">Sans passer par l’app</span><h2>Ta demande<br>commence ici.</h2><p>Préparer le message ne déclenche pas la suppression. Il faut l’envoyer depuis ta messagerie, puis terminer la vérification du compte avec l’assistance.</p><p>Une réponse à une demande d’exercice de droits doit être apportée dans un délai d’un mois. Si la demande nécessite une prolongation, tu en seras informé dans ce délai.</p><p>Après vérification, l’assistance confirme le traitement de la demande. Tu n’as pas à donner ton mot de passe.</p></div>${requestForm(true)}</section>`, true);

await mkdir(path.join(output, 'assets'), { recursive: true });
for (const [route, html] of [['', support], ['confidentialite', privacy], ['suppression', deletion]]) {
  const dir = path.join(output, route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
}
for (const file of ['site.css', 'forms.js']) await cp(path.join(root, 'website', file), path.join(output, file));
const assets = [
  ['assets/images/logo-heart.png', 'logo-heart.png'],
  ['node_modules/@expo-google-fonts/fraunces/500Medium/Fraunces_500Medium.ttf', 'fraunces.ttf'],
  ['node_modules/@expo-google-fonts/dm-sans/400Regular/DMSans_400Regular.ttf', 'dm-sans.ttf'],
  ['node_modules/@expo-google-fonts/dm-sans/700Bold/DMSans_700Bold.ttf', 'dm-sans-bold.ttf'],
  ['node_modules/@expo-google-fonts/fraunces/LICENSE_FONT', 'fraunces-OFL.txt'],
  ['node_modules/@expo-google-fonts/dm-sans/LICENSE_FONT', 'dm-sans-OFL.txt'],
];
for (const [source, target] of assets) await cp(path.join(root, source), path.join(output, 'assets', target));
await writeFile(path.join(output, 'robots.txt'), `User-agent: *\nDisallow: ${draft ? '/' : ''}\n`);
await writeFile(path.join(output, '_headers'), `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'\n${draft ? '  X-Robots-Tag: noindex, nofollow\n' : ''}`);
console.log(`${draft ? 'Aperçu privé' : 'Version publique'} : 3 pages générées dans ${output}`);
