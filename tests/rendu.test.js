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

test('quarts de case de jonction (Ø 20) sur les coins intérieurs du gabarit, même sans port', () => {
  const ex = M.copieExemples();
  const nb = (m, o) => (R.contenuTuile(m, o).match(/data-quart-jonction=/g) || []).length;
  assert.deepEqual(ex.map((m) => nb(m)), [4, 2, 1]);
  const sansPort = Object.assign({}, ex[1], { chemins: ex[1].chemins.filter((c) => !c.b.coin && c.b.coin !== 0) });
  assert.equal(nb(sansPort), 2);
  assert.equal(nb(Object.assign({}, ex[1], { gabarit: undefined })), 0);
  // coin canonique : quart centré sur le coin SE (120, 120), rayon 10 ; tourné d'un quart : coin SO (0, 120)
  const arc = (svg) => /<path d="([^"]+)" fill="none" stroke="#111111" stroke-width="0.6" data-quart-jonction/.exec(svg)[1]
    .split(/[ML]/).filter(Boolean).map((p) => p.trim().split(' ').map(Number));
  for (const [rot, cx, cy] of [[0, 120, 120], [1, 0, 120]]) {
    arc(R.contenuTuile(ex[2], { rot })).forEach(([x, y]) => assert.ok(Math.abs(Math.hypot(x - cx, y - cy) - 10) < 1e-2, rot + ' ' + x + ',' + y));
  }
  // fond perdu : le quart se prolonge au-delà du bord
  assert.match(R.contenuTuile(ex[2], { fondPerdu: 3 }), /123 123 Z" fill="#FFFFFF"/);
});

test('contenuJeton : ville (seul type de jeton)', () => {
  const v = R.contenuJeton('capture', 0, 0);
  assert.ok(v.includes(R.COULEURS.noir));
  assert.ok(v.includes(R.COULEURS.blanc));
});
