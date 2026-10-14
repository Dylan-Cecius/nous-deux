// Génère le logo « Nous Deux » : un cœur en deux moitiés dégradées (une pour chacun),
// séparées par une courbe en S, sur fond prune.
// Usage : node scripts/generate-logo.js   (écrit dans assets/images)
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const outDir = path.join(__dirname, '..', 'assets', 'images');
const fontDir = path.join(__dirname, '..', 'node_modules', '@expo-google-fonts', 'fraunces');
const fontFiles = [
  path.join(fontDir, '600SemiBold', 'Fraunces_600SemiBold.ttf'),
  path.join(fontDir, '400Regular_Italic', 'Fraunces_400Regular_Italic.ttf'),
];

const CREAM = '#FBF6F1';
const PINK = '#FF8FB8';

// Cœur dans une boîte 24×24 (forme Material) et courbe qui le partage en deux.
const HEART =
  'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z';
const CURVE = 'C 9.4 8.2, 14.6 12.6, 12 22';

/**
 * Cœur de largeur `size`, centré en (cx, cy).
 * `mono` : une seule couleur (icône monochrome Android) ; `glow` : halo lumineux derrière.
 */
function heart(p, cx, cy, size, { mono, glow = true, gap = 0.8 } = {}) {
  const s = size / 20; // le cœur occupe 20 unités de large (x = 2 → 22)
  return `
  <defs>
    <linearGradient id="${p}L" x1="0.1" y1="0" x2="0.6" y2="1">
      <stop offset="0" stop-color="#FFC07A"/><stop offset="0.55" stop-color="#FF6A6A"/><stop offset="1" stop-color="#FF3D7F"/>
    </linearGradient>
    <linearGradient id="${p}R" x1="0.9" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#FF8FB8"/><stop offset="0.55" stop-color="#F24C9A"/><stop offset="1" stop-color="#A63BD8"/>
    </linearGradient>
    <clipPath id="${p}cl"><path d="M0 0 L12 0 L12 3.6 ${CURVE} L12 24 L0 24 Z"/></clipPath>
    <clipPath id="${p}cr"><path d="M24 0 L12 0 L12 3.6 ${CURVE} L12 24 L24 24 Z"/></clipPath>
    <mask id="${p}m">
      <rect x="-12" y="-12" width="48" height="48" fill="#fff"/>
      <path d="M12 3.6 ${CURVE}" stroke="#000" stroke-width="${gap}" fill="none" stroke-linecap="round"/>
    </mask>
    <filter id="${p}glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="2.4"/></filter>
  </defs>
  <g transform="translate(${cx - 12 * s} ${cy - 12.175 * s}) scale(${s})">
    ${glow && !mono ? `<path d="${HEART}" fill="#FF4F86" opacity="0.45" filter="url(#${p}glow)"/>` : ''}
    <g mask="url(#${p}m)">
      <path d="${HEART}" fill="${mono ?? `url(#${p}L)`}" clip-path="url(#${p}cl)"/>
      <path d="${HEART}" fill="${mono ?? `url(#${p}R)`}" clip-path="url(#${p}cr)"/>
    </g>
  </g>`;
}

/** Fond prune avec une lumière douce au centre. */
const background = (id, w, h, rx = 0) => `
  <defs><radialGradient id="${id}" cx="50%" cy="38%" r="78%">
    <stop offset="0" stop-color="#5E2A47"/><stop offset="1" stop-color="#1F0E18"/>
  </radialGradient></defs>
  <rect width="${w}" height="${h}" rx="${rx}" fill="url(#${id})"/>`;

function render(name, width, height, body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Fraunces' },
  })
    .render()
    .asPng();
  fs.writeFileSync(path.join(outDir, name), png);
  console.log(name, `${width}x${height}`, `${Math.round(png.length / 1024)} Ko`);
}

// Icône iOS / générale : fond plein (Apple refuse la transparence), cœur bien visible.
render('icon.png', 1024, 1024, `${background('bg', 1024, 1024)}${heart('i', 512, 520, 650)}`);

// Android : fond et premier plan séparés (le système découpe l'icône en rond, carré…).
// Le premier plan reste dans la zone sûre centrale (≈ 66 %).
render('android-icon-background.png', 512, 512, background('bg', 512, 512));
render('android-icon-foreground.png', 512, 512, heart('f', 256, 260, 260));
render('android-icon-monochrome.png', 432, 432, heart('m', 216, 220, 220, { mono: '#FFFFFF', gap: 1 }));

// Écran de lancement : cœur + nom, sur fond transparent (le fond prune vient de app.json).
render(
  'splash-icon.png',
  1200,
  1200,
  `${heart('s', 600, 430, 540)}
  <text x="600" y="940" text-anchor="middle" font-family="Fraunces" font-size="190" fill="${CREAM}">
    <tspan font-weight="600">Nous </tspan><tspan font-style="italic" fill="${PINK}">Deux</tspan>
  </text>`,
);

// Cœur seul sur fond transparent (écran de bienvenue de l'app).
render('logo-heart.png', 600, 600, heart('h', 300, 300, 400));

// Favicon (onglet du navigateur).
render('favicon.png', 48, 48, `${background('bg', 48, 48, 11)}${heart('v', 24, 25, 34, { glow: false, gap: 1.1 })}`);
