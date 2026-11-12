const { isIP } = require('node:net');

function publicHttps(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      !isIP(host.replace(/^\[|\]$/g, '')) && host.includes('.') &&
      !/(^|\.)(localhost|example\.(com|org|net))$|\.(test|invalid|local|localhost)$/.test(host);
  } catch { return false; }
}

function billingProblems(env) {
  const problems = [];
  for (const name of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_TERMS_URL']) {
    if (!publicHttps(env[name])) problems.push(name + ' : fournir une URL publique HTTPS définitive.');
  }
  const platform = env.EAS_BUILD_PLATFORM;
  for (const [target, prefix] of [['ios', 'appl_'], ['android', 'goog_']]) {
    if (platform && platform !== target) continue;
    const name = 'EXPO_PUBLIC_REVENUECAT_' + target.toUpperCase() + '_KEY';
    const key = env[name]?.trim();
    if (!key || !key.startsWith(prefix) || key.length <= prefix.length) {
      problems.push(name + ' : fournir la clé SDK publique du store (aucune clé de test ou secrète).');
    }
  }
  return problems;
}

function storeProblems(env) {
  const problems = [];
  for (const name of ['EXPO_PUBLIC_PRIVACY_URL', 'EXPO_PUBLIC_TERMS_URL']) {
    if (!publicHttps(env[name])) problems.push(name + ' : URL HTTPS publique manquante ou provisoire.');
  }
  if (!env.EXPO_PUBLIC_LEGAL_ENTITY?.trim()) problems.push('EXPO_PUBLIC_LEGAL_ENTITY : identité publique de l’éditeur manquante.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '')) {
    problems.push('EXPO_PUBLIC_SUPPORT_EMAIL : adresse publique de support manquante ou invalide.');
  }
  return problems;
}

module.exports = { publicHttps, billingProblems, storeProblems };
