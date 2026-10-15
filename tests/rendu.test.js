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

test('svgTuile : SVG à l\'échelle, une case dessinée par case du modèle, rotation appliquée', () => {
  const m = M.copieExemples().find((x) => x.role === 'apparition');
  const svg = R.svgTuile(m, { joueur: 2, fondPerdu: 3, rot: 2 });
  assert.match(svg, /^<svg [^>]*width="126mm" height="126mm" viewBox="-3 -3 126 126"/);
  assert.equal((svg.match(/data-case=/g) || []).length, m.cases.length);
  assert.ok(svg.includes(R.COULEURS.rouge));
  assert.ok(svg.includes('>2</text>'));
});

test('contenuJeton : ville et carrefour', () => {
  assert.ok(R.contenuJeton('capture', 0, 0).includes(R.COULEURS.noir));
  assert.ok(R.contenuJeton('carrefour', 0, 0).includes('stroke-linecap="round"'));
});
