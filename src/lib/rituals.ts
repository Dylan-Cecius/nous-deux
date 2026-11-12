export type RitualBudget = 'gratuit' | 'doux' | 'sortie';
export type RitualSetting = 'maison' | 'dehors';
export type Ritual = {
  id: string;
  title: string;
  subtitle: string;
  minutes: number;
  budget: RitualBudget;
  setting: RitualSetting;
  premium: boolean;
  steps: readonly string[];
};

/** Des idées originales, sans réservation ni service d’IA. Les budgets sont indicatifs. */
export const RITUALS: readonly Ritual[] = [
  { id: 'trois-mercis', title: 'Trois mercis, juste pour toi', subtitle: 'Remarquer ce qui fait du bien.', minutes: 15, budget: 'gratuit', setting: 'maison', premium: false, steps: ['Chacun note trois gestes de l’autre qui lui ont fait du bien cette semaine.', 'Lisez-les à voix haute, sans interrompre.', 'Choisissez un petit geste à refaire demain.'] },
  { id: 'balade-detour', title: 'Le chemin qu’on ne prend jamais', subtitle: 'Un peu d’inconnu au coin de la rue.', minutes: 30, budget: 'gratuit', setting: 'dehors', premium: false, steps: ['Partez à pied sans destination précise.', 'À chaque croisement, choisissez la direction à tour de rôle.', 'Trouvez un détail joli que vous n’aviez jamais remarqué.'] },
  { id: 'playlist-nous', title: 'La bande-son de nous', subtitle: 'Votre histoire en cinq chansons.', minutes: 30, budget: 'gratuit', setting: 'maison', premium: false, steps: ['Choisissez chacun deux chansons liées à un souvenir commun.', 'Écoutez-les en racontant ce souvenir.', 'Ajoutez une cinquième chanson pour le prochain chapitre.'] },
  { id: 'pique-nique-salon', title: 'Un pique-nique dans le salon', subtitle: 'Le quotidien, vu autrement.', minutes: 45, budget: 'doux', setting: 'maison', premium: false, steps: ['Installez un plaid au sol et préparez un repas simple.', 'Laissez les écrans de côté pendant le repas.', 'Racontez chacun un moment de votre journée qui n’a pas encore été raconté.'] },
  { id: 'coucher-soleil', title: 'Rendez-vous avec le ciel', subtitle: 'Un spectacle qui ne coûte rien.', minutes: 30, budget: 'gratuit', setting: 'dehors', premium: false, steps: ['Repérez un lieu accessible où voir le ciel en fin de journée.', 'Emportez de l’eau et de quoi vous asseoir.', 'Profitez du moment, puis dites chacun ce que vous aimeriez garder de cette journée.'] },
  { id: 'dessins-croises', title: 'Portraits très approximatifs', subtitle: 'Le résultat importe moins que les rires.', minutes: 20, budget: 'gratuit', setting: 'maison', premium: false, steps: ['Prenez deux feuilles et deux crayons.', 'Dessinez-vous pendant cinq minutes sans regarder votre feuille.', 'Offrez-vous vos œuvres avec un titre solennel.'] },
  { id: 'cafe-inconnu', title: 'Votre nouvelle petite adresse', subtitle: 'Un café, deux chaises, du temps.', minutes: 45, budget: 'doux', setting: 'dehors', premium: false, steps: ['Choisissez un café que vous ne connaissez pas encore.', 'Commandez chacun quelque chose qui vous fait envie.', 'Imaginez une journée idéale ensemble, du réveil au coucher.'] },
  { id: 'lettre-futur', title: 'Une lettre pour plus tard', subtitle: 'Un souvenir qui attend son heure.', minutes: 25, budget: 'gratuit', setting: 'maison', premium: false, steps: ['Écrivez chacun une lettre à votre couple dans un an.', 'Ajoutez une envie, une fierté et un souhait.', 'Fermez les lettres et ajoutez une date de réouverture dans votre agenda.'] },
  { id: 'marche-couleurs', title: 'Le marché des cinq couleurs', subtitle: 'Une petite expédition gourmande.', minutes: 60, budget: 'doux', setting: 'dehors', premium: false, steps: ['Promenez-vous sur un marché ou dans une épicerie.', 'Choisissez ensemble cinq ingrédients de couleurs différentes, selon votre budget.', 'Inventez ensuite une assiette avec vos trouvailles.'] },
  { id: 'cinema-surprise', title: 'Le cinéma de l’autre', subtitle: 'Découvrir ce qui l’a marqué.', minutes: 120, budget: 'gratuit', setting: 'maison', premium: false, steps: ['Choisissez un film déjà accessible chez vous qui a compté pour l’un de vous.', 'Présentez-le en deux phrases, sans dévoiler l’histoire.', 'Après le générique, racontez ce qui vous a touchés.'] },
  { id: 'touristes', title: 'Touristes dans votre ville', subtitle: 'Changer de regard, sans partir loin.', minutes: 90, budget: 'sortie', setting: 'dehors', premium: false, steps: ['Choisissez un quartier ou un lieu local encore inconnu.', 'Fixez ensemble un budget avant de partir.', 'Prenez une photo souvenir et notez une adresse à retrouver.'] },
  { id: 'petit-dej', title: 'Un petit-déjeuner qui s’étire', subtitle: 'Commencer doucement, ensemble.', minutes: 40, budget: 'doux', setting: 'maison', premium: false, steps: ['Préparez votre petit-déjeuner préféré à quatre mains.', 'Gardez les téléphones loin de la table.', 'Choisissez une petite envie à vivre ensemble dans les sept prochains jours.'] },
  { id: 'capsule-saison', title: 'Notre capsule de saison', subtitle: 'Garder une trace du présent.', minutes: 30, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Rassemblez un ticket, une photo et quelques mots sur votre vie actuelle.', 'Déposez-les dans une enveloppe avec la date.', 'Choisissez une prochaine saison pour la rouvrir ensemble.'] },
  { id: 'librairie', title: 'Deux livres, deux univers', subtitle: 'Un portrait entre les rayons.', minutes: 45, budget: 'gratuit', setting: 'dehors', premium: true, steps: ['Entrez dans une bibliothèque ouverte au public.', 'Choisissez chacun un livre dont le titre vous fait penser à l’autre.', 'Retrouvez-vous et expliquez votre choix, sans obligation d’emprunter.'] },
  { id: 'menu-souvenir', title: 'Le menu de notre première fois', subtitle: 'Un goût de votre début.', minutes: 90, budget: 'doux', setting: 'maison', premium: true, steps: ['Souvenez-vous d’un de vos premiers repas ensemble.', 'Recréez-en une version simple avec les ingrédients disponibles.', 'Racontez ce que vous pensiez de l’autre à ce moment-là.'] },
  { id: 'cartes-postales', title: 'Cartes postales du canapé', subtitle: 'Voyager avec un peu d’imagination.', minutes: 25, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Choisissez une destination qui vous fait rêver.', 'Dessinez chacun une carte postale envoyée depuis là-bas.', 'Rédigez au dos trois choses que vous y feriez ensemble.'] },
  { id: 'photo-marathon', title: 'Six photos, une promenade', subtitle: 'Votre regard fait le décor.', minutes: 45, budget: 'gratuit', setting: 'dehors', premium: true, steps: ['Choisissez trois thèmes : une couleur, une forme, une émotion.', 'Prenez chacun une photo par thème pendant votre promenade.', 'Comparez vos six images autour d’une pause.'] },
  { id: 'cours-echange', title: 'Aujourd’hui, tu m’apprends', subtitle: 'Partager un savoir tout simple.', minutes: 30, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Choisissez chacun quelque chose que vous savez faire et que l’autre connaît moins.', 'Prenez dix minutes chacun pour le montrer.', 'Terminez en essayant ensemble, avec patience et humour.'] },
  { id: 'degustation', title: 'Le jury des petits plaisirs', subtitle: 'Une dégustation très personnelle.', minutes: 30, budget: 'doux', setting: 'maison', premium: true, steps: ['Choisissez trois petites variantes d’un aliment que vous aimez et pouvez manger.', 'Goûtez-les sans regarder les emballages.', 'Donnez vos notes, puis dévoilez votre grand gagnant.'] },
  { id: 'brocante', title: 'La chasse au petit trésor', subtitle: 'Chercher une histoire à rapporter.', minutes: 90, budget: 'sortie', setting: 'dehors', premium: true, steps: ['Trouvez une brocante ou une boutique de seconde main.', 'Fixez un tout petit budget commun.', 'Cherchez ensemble un objet qui pourrait devenir un souvenir de vous deux.'] },
  { id: 'danse-salon', title: 'Une danse dans le salon', subtitle: 'Trois chansons, rien d’autre.', minutes: 15, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Libérez un peu d’espace et choisissez trois chansons.', 'Dansez comme vous voulez, sans chercher à bien faire.', 'Gardez la dernière chanson pour ralentir le rythme.'] },
  { id: 'jardin', title: 'Quelque chose à faire pousser', subtitle: 'Un petit projet qui prend son temps.', minutes: 40, budget: 'doux', setting: 'maison', premium: true, steps: ['Choisissez une herbe aromatique ou une plante adaptée à votre espace.', 'Rempotez-la ensemble et trouvez-lui un nom.', 'Décidez qui l’arrose et quand vous prendrez sa prochaine photo.'] },
  { id: 'audio-souvenir', title: 'Un message pour nos vieux jours', subtitle: 'Entendre vos voix d’aujourd’hui.', minutes: 20, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Ouvrez le dictaphone de votre téléphone si vous souhaitez garder un enregistrement.', 'Racontez ensemble votre rencontre, chacun avec sa version.', 'Gardez le fichier dans un endroit privé choisi à deux.'] },
  { id: 'nouvelle-recette', title: 'La recette qu’on n’ose jamais', subtitle: 'Pas besoin d’être des chefs.', minutes: 60, budget: 'doux', setting: 'maison', premium: true, steps: ['Choisissez une recette réalisable avec votre matériel et votre budget.', 'Répartissez les tâches et lancez votre musique préférée.', 'Baptisez le résultat, même s’il ne ressemble pas à la photo.'] },
  { id: 'expo', title: 'Chacun son œuvre préférée', subtitle: 'Voir le monde à travers ses yeux.', minutes: 90, budget: 'sortie', setting: 'dehors', premium: true, steps: ['Choisissez une exposition accessible et vérifiez les tarifs.', 'Visitez à votre rythme et retenez chacun une œuvre.', 'Retrouvez-vous pour expliquer ce qu’elle vous évoque.'] },
  { id: 'reves-cartes', title: 'La carte de nos envies', subtitle: 'Donner une forme à ce qui vient.', minutes: 35, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Dessinez trois cercles : bientôt, cette année, un jour.', 'Ajoutez chacun une envie dans chaque cercle.', 'Choisissez une envie simple du premier cercle et une première étape concrète.'] },
  { id: 'rando-douce', title: 'Un horizon un peu plus loin', subtitle: 'Marcher à votre rythme.', minutes: 120, budget: 'gratuit', setting: 'dehors', premium: true, steps: ['Choisissez un itinéraire facile et adapté à vous deux, puis vérifiez la météo.', 'Prévoyez eau, tenue adaptée et retour.', 'Faites une pause pour noter une chose que vous aimeriez vivre cette année.'] },
  { id: 'cuisine-transmission', title: 'Le plat de notre enfance', subtitle: 'Une histoire à partager à table.', minutes: 60, budget: 'doux', setting: 'maison', premium: true, steps: ['Choisissez un plat de l’enfance de l’un de vous.', 'Préparez-le en racontant qui le cuisinait et à quelle occasion.', 'La prochaine fois, inversez les rôles.'] },
  { id: 'petit-spectacle', title: 'La soirée des découvertes', subtitle: 'Un rendez-vous hors de vos habitudes.', minutes: 120, budget: 'sortie', setting: 'dehors', premium: true, steps: ['Consultez le programme d’un petit lieu culturel près de chez vous.', 'Choisissez ensemble une proposition et vérifiez prix et horaires.', 'Après la sortie, racontez le détail qui vous a le plus surpris.'] },
  { id: 'dimanche-bilan', title: 'Notre dimanche en dix minutes', subtitle: 'Une habitude pour se retrouver.', minutes: 10, budget: 'gratuit', setting: 'maison', premium: true, steps: ['Partagez chacun un bon moment et une difficulté de la semaine.', 'Demandez : « Qu’est-ce qui te ferait du bien cette semaine ? »', 'Convenez d’un petit moment à deux, sans obligation de tout résoudre.'] },
];

export type RitualFilters = { budget?: RitualBudget; setting?: RitualSetting; maxMinutes?: number };

/** L’accès est appliqué avant les filtres, y compris lors d’un changement d’abonnement. */
export function filterRituals(filters: RitualFilters = {}, plus = false): Ritual[] {
  return RITUALS.filter((idea) =>
    (!idea.premium || plus) &&
    (!filters.budget || idea.budget === filters.budget) &&
    (!filters.setting || idea.setting === filters.setting) &&
    (filters.maxMinutes === undefined || idea.minutes <= filters.maxMinutes));
}

/** Évite de proposer deux fois de suite la même idée quand le choix le permet. */
export function drawRitual(ideas: readonly Ritual[], previousId?: string, random = Math.random): Ritual | null {
  if (ideas.length === 0) return null;
  const alternatives = ideas.filter((idea) => idea.id !== previousId);
  const pool = alternatives.length > 0 ? alternatives : ideas;
  const sample = random();
  const index = Number.isFinite(sample) ? Math.min(pool.length - 1, Math.max(0, Math.floor(sample * pool.length))) : 0;
  return pool[index];
}

export const BUDGET_LABELS: Record<RitualBudget, string> = { gratuit: 'Gratuit', doux: 'Petit budget', sortie: 'Budget à prévoir' };
