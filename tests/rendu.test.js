'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/modele.js');
require('../src/rendu.js');
const M = globalThis.PM.modele;
const R = globalThis.PM.rendu;
const G = globalThis.PM.geometrie;

test('tracés : un par chemin valide, amorces de 10 mm (raccord) et 28 mm (port)', () => {
  for (const m of M.copieExemples()) {
    const ts = R.tracesModele(m);
    assert.equal(ts.length, m.chemins.length, m.id);
    for (const t of ts) {
      if (t.type === 'raccord') {
        const [p, q] = t.pts;
        assert.ok(Math.abs(Math.hypot(q.x - p.x, q.y - p.y) - R.AMORCE_RACCORD) < 1e-9);
        assert.deepEqual(p, G.pointRaccord(t.raccord.cote, t.raccord.pos));
      }
      if (t.type === 'port') assert.deepEqual(t.pts[0], G.pointCoin(t.coin));
    }
  }
});

test('tracés : entrées malformées ignorées sans exception', () => {
  assert.deepEqual(R.tracesModele(null), []);
  assert.deepEqual(R.tracesModele({ cases: [null], chemins: [null, { a: { case: 'x' }, b: { coin: 9 } }] }), []);
});

test('svgTuile : SVG à l\'échelle, une case dessinée par case du modèle, impression en noir et blanc', () => {
  const m = M.copieExemples().find((x) => x.gabarit === 'bord');
  const svg = R.svgTuile(m, { fondPerdu: 3, rot: 2 });
  assert.match(svg, /^<svg [^>]*width="126mm" height="126mm" viewBox="-3 -3 126 126"/);
  assert.equal((svg.match(/data-case=/g) || []).length, m.cases.length);
  // défaut D3 corrigé : aucune couleur de camp à l'impression (ni rouge ni liseré vert hors chemins), pas de chiffre
  assert.ok(!svg.includes(R.COULEURS.rouge));
  assert.ok(svg.includes('data-apparition="impression"'));
  assert.ok(!/<text/.test(svg));
});

test('case d\'apparition : carré inscrit dans le disque (côté ≤ D/√2), centré', () => {
  for (const grille of ['4x4', '5x5']) {
    const m = M.copieExemples(grille).find((x) => x.gabarit === 'coin'), c = m.cases.find((x) => x.type === 'apparition');
    const svg = R.contenuTuile(m, { format: grille });
    const r = /<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="none" stroke="[^"]+" stroke-width="[\d.]+" data-apparition/.exec(svg);
    assert.ok(r, grille);
    const cote = Number(r[3]);
    assert.ok(cote <= c.diametre / Math.SQRT2 + 1e-9, grille + ' côté ' + cote);
    assert.ok(Math.abs(Number(r[1]) + cote / 2 - c.x) < 1e-3 && Math.abs(Number(r[2]) + cote / 2 - c.y) < 1e-3);
    // les 4 coins du carré sont dans le disque
    assert.ok(Math.hypot(cote / 2, cote / 2) <= c.diametre / 2 + 1e-9);
    // jeu d’au moins 0,9 mm aux coins, traits déduits : le carré ne touche pas le contour du disque
    const trait = Number(/stroke-width="([\d.]+)" data-apparition/.exec(svg)[1]);
    assert.ok(trait >= 1, grille + ' trait ' + trait);
    assert.ok(c.diametre / 2 - Math.hypot(cote / 2, cote / 2) - trait / 2 - 0.3 >= 0.9, grille + ' jeu aux coins');
  }
});

test('case d\'apparition à l\'écran : couleur du camp ET forme distincte (vert ▲, rouge ▼, neutre en tirets)', () => {
  const m = M.copieExemples().find((x) => x.gabarit === 'bord');
  const vert = R.contenuTuile(m, { camp: 'vert' }), rouge = R.contenuTuile(m, { camp: 'rouge' }), neutre = R.contenuTuile(m, { camp: 'neutre' });
  assert.ok(vert.includes('data-apparition="vert"') && vert.includes('fill="' + R.COULEURS.vert + '"/>'));
  assert.ok(rouge.includes('data-apparition="rouge"') && rouge.includes('fill="' + R.COULEURS.rouge + '"/>'));
  assert.ok(neutre.includes('data-apparition="neutre"') && neutre.includes('stroke-dasharray'));
  // la pointe du triangle : vers le nord (y plus petit) pour le vert, vers le sud pour le rouge
  const pointe = (svg) => Number(/<path d="M[\d.]+ ([\d.]+) L/.exec(svg.slice(svg.indexOf('data-apparition')))[1]);
  const c = m.cases.find((x) => x.type === 'apparition');
  assert.ok(pointe(vert) < c.y && pointe(rouge) > c.y);
  // un camp inconnu = rendu d'impression
  assert.ok(R.contenuTuile(m, { camp: 'bleu' }).includes('data-apparition="impression"'));
});

test('quarts de siège de campement (Ø 30, taille d’un jeton) sur les coins intérieurs du gabarit, même sans port', () => {
  const ex = M.copieExemples();
  const nb = (m, o) => (R.contenuTuile(m, o).match(/data-quart-jonction=/g) || []).length;
  assert.deepEqual(ex.map((m) => nb(m)), [4, 2, 1]);
  const sansPort = Object.assign({}, ex[1], { chemins: ex[1].chemins.filter((c) => !c.b.coin && c.b.coin !== 0) });
  assert.equal(nb(sansPort), 2);
  assert.equal(nb(Object.assign({}, ex[1], { gabarit: undefined })), 0);
  // coin canonique : quart centré sur le coin SE (120, 120), rayon 15 ; tourné d'un quart : coin SO (0, 120)
  const arc = (svg) => /<path d="([^"]+)" fill="none" stroke="#111111" stroke-width="0.6" data-quart-jonction/.exec(svg)[1]
    .split(/[ML]/).filter(Boolean).map((p) => p.trim().split(' ').map(Number));
  for (const [rot, cx, cy] of [[0, 120, 120], [1, 0, 120]]) {
    arc(R.contenuTuile(ex[2], { rot })).forEach(([x, y]) => assert.ok(Math.abs(Math.hypot(x - cx, y - cy) - 15) < 1e-2, rot + ' ' + x + ',' + y));
  }
  // fond perdu : le quart se prolonge au-delà du bord
  assert.match(R.contenuTuile(ex[2], { fondPerdu: 3 }), /123 123 Z" fill="#FFFFFF"/);
});

test('contenuJeton : ville (seul type de jeton du document)', () => {
  const v = R.contenuJeton('capture', 0, 0);
  assert.ok(v.includes(R.COULEURS.noir));
  assert.ok(v.includes(R.COULEURS.blanc));
});

test('contenuJeton : campement de la taille d’une ville (Ø 30, deux formats), feu de bois noir et blanc, primitives du PDF', () => {
  for (const g of ['4x4', '5x5']) {
    const c = R.contenuJeton('campement', 50, 60, g);
    // disque blanc de Ø 30 centré, anneau rentré de 1,6 mm (pas sur la ligne de coupe)
    assert.match(c, /^<circle cx="50" cy="60" r="15" fill="#FFFFFF"\/>/);
    assert.ok(c.includes('<circle cx="50" cy="60" r="13.4" fill="none" stroke="#111111" stroke-width="0.8"/>'));
    assert.equal((c.match(/data-campement="buche"/g) || []).length, 2, 'deux bûches croisées');
    assert.equal((c.match(/data-campement="flamme"/g) || []).length, 1, 'une flamme');
    // palette : noir et blanc seulement (ni vert ni rouge, couleurs des camps)
    const couleurs = new Set(c.match(/#[0-9A-Fa-f]{6}/g));
    assert.deepEqual([...couleurs].sort(), [R.COULEURS.noir, R.COULEURS.blanc].sort());
    assert.ok(!c.includes(R.COULEURS.rouge) && !c.includes(R.COULEURS.vert));
    // tout le dessin tient dans le jeton (points des chemins à moins de 15 mm du centre, bûches épaisseur comprise)
    const pts = [...c.matchAll(/[MLC]([^"MLCZ]+)/g)].flatMap((m) => m[1].trim().split(/\s+/).map(Number))
      .reduce((a, v, i, t) => (i % 2 ? a : a.concat([[v, t[i + 1]]])), []);
    assert.ok(pts.length > 20);
    pts.forEach(([x, y]) => assert.ok(Math.hypot(x - 50, y - 60) + 1.6 <= 13.4, x + ',' + y));
    // pas de primitive refusée par le convertisseur PDF (export.js)
    assert.ok(!/<(polygon|ellipse|polyline)|transform=|opacity|fill-rule| A ?\d/.test(c));
  }
  // la ville n'est pas modifiée par l'ajout du campement
  assert.ok(R.contenuJeton('capture', 0, 0).startsWith('<circle cx="0" cy="0" r="15" fill="#111111"/>'));
});
