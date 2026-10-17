'use strict';
/*
 * Garde-fou léger des mesures 5×5 (outils/mesures-5x5.js, docs/35) : 50 plateaux tirés et orientés par le générateur, sans les 200 candidats.
 * Invariants seulement (cases, ports, écart entre jonctions, ports par jonction, placements admissibles) ; aucun pourcentage figé.
 */
const test = require('node:test');
const assert = require('node:assert');

const MS = require('../outils/mesures-5x5.js');
const PM = globalThis.PM;
const GR = PM.graphe, CAT = PM.catalogue;

const NB = 50;
const jetonsDe = (v) => v.map((x) => ({ i: (x % 4) + 1, j: Math.floor(x / 4) + 1, type: 'capture' }));

/** 50 plateaux traités (une seule fois pour tous les tests). */
let CACHE = null;
function plateaux() {
  if (!CACHE) {
    const prep = MS.preparer(MS.GRAINE_REF, false);
    CACHE = [];
    for (let n = 0; n < NB; n++) {
      const e = MS.tirerEntreesF2(prep);
      assert.ok(!e.cause, 'plateau ' + n + ' : ' + e.cause);
      const b = MS.traiterPlateauF2(e.doc, prep.ctx, prep.rng);
      b.b1 = e.b1;
      CACHE.push({ doc: e.doc, b });
    }
  }
  return CACHE;
}

test('mesures 5×5 : cases = 72 + nB1 (dans 75 ± 3), ports = 34 + nB1, 5 ou 6 B1', () => {
  plateaux().forEach(({ b }, n) => {
    assert.ok(b.b1 === 5 || b.b1 === 6, 'plateau ' + n);
    assert.strictEqual(b.props.modeles.B1, b.b1, 'plateau ' + n);
    assert.strictEqual(b.props.cases, 72 + b.b1, 'plateau ' + n);
    assert.ok(b.props.cases >= 72 && b.props.cases <= 78, 'plateau ' + n);
    assert.strictEqual(b.props.ports, 34 + b.b1, 'plateau ' + n);
    assert.strictEqual(b.props.pj.reduce((a, c) => a + c, 0), b.props.ports);
  });
});

test('mesures 5×5 : chaque jonction a au moins 2 ports, au moins 7 jonctions en ont 3, écart minimal entre jonctions >= 4 pas', () => {
  plateaux().forEach(({ b }, n) => {
    assert.strictEqual(b.props.pj.length, 16);
    assert.ok(b.props.pj.every((p) => p >= 2), 'plateau ' + n + ' : ' + b.props.pj.join(','));
    assert.ok(b.props.pj.filter((p) => p >= 3).length >= 7, 'plateau ' + n);
    assert.ok(b.props.ecartMin >= 4, 'plateau ' + n + ' : ' + b.props.ecartMin);
  });
});

test('mesures 5×5 : placements admissibles = 7 villes en 2-3-2 sur des jonctions à 3 ports au moins', () => {
  plateaux().forEach(({ b }, n) => {
    // il peut n'y avoir aucun placement admissible (rejet « villes_ports » du générateur) : ce n'est pas une erreur de la mesure
    assert.strictEqual(b.configs.length, b.nbAdm, 'plateau ' + n);
    b.configs.forEach((c) => {
      assert.strictEqual(c.v.length, 7);
      assert.ok(c.v.every((x) => b.props.pj[x] >= 3), 'plateau ' + n);
      const rangees = [0, 0, 0, 0];
      c.v.forEach((x) => { rangees[Math.floor(x / 4)]++; });
      assert.deepStrictEqual([rangees[0], rangees[1] + rangees[2], rangees[3]], [2, 3, 2], 'plateau ' + n);
    });
  });
});

test('mesures 5×5 : la mesure rapide donne les mêmes S, écart max, partage et distances que PM.graphe.equilibre', () => {
  plateaux().forEach(({ doc, b }, n) => {
    b.configs.slice(0, 2).forEach((c) => {
      if (c.f === 'I') return;
      const d = { version: doc.version, grille: '5x5', modeles: doc.modeles, plateau: { tuiles: doc.plateau.tuiles, jetons: jetonsDe(c.v) } };
      const e = GR.equilibre(d, { graphe: GR.construire(d, {}) });
      const m = MS.deriver(c);
      assert.deepStrictEqual(c.t1, e.D[1], 'plateau ' + n);
      assert.deepStrictEqual(c.t2, e.D[2], 'plateau ' + n);
      assert.strictEqual(m.S, e.S);
      assert.strictEqual(m.em, e.ecartMax7);
      assert.deepStrictEqual(c.pa, [e.partage[1], e.partage[2], e.partage.egalite]);
      assert.strictEqual(m.cinq, e.cinqContreDeux);
    });
  });
});

test('mesures 5×5 : le placement retenu (avec rejet de S >= seuil) passe tous les filtres et vaut le meilleur S', () => {
  plateaux().forEach(({ b }, n) => {
    if (b.selAvec < 0) { assert.ok(b.configs.every((c) => c.f !== 'o'), 'plateau ' + n); return; }
    const c = b.configs[b.selAvec];
    assert.strictEqual(c.f, 'o', 'plateau ' + n);
    const S = MS.deriver(c).S;
    b.configs.filter((x) => x.f === 'o').forEach((x) => assert.ok(MS.deriver(x).S >= S, 'plateau ' + n));
    assert.ok(S < GR.SEUIL_S);
  });
});

test('mesures 5×5 : le contrefactuel « B1 libres » garde les mêmes invariants de cases et de ports', () => {
  const prep = MS.preparer(MS.GRAINE_REF, true);
  for (let n = 0; n < 10; n++) {
    const e = MS.tirerEntreesF2(prep);
    if (e.cause) continue;
    const doc = e.doc, nB1 = doc.plateau.tuiles.filter((t) => t.modeleId === 'B1').length;
    assert.ok(nB1 === 5 || nB1 === 6);
    const g0 = GR.construire(doc, { jetons: [] });
    assert.strictEqual(MS.proprietesPlateau(doc, g0).cases, 72 + nB1);
  }
  // la préparation du contrefactuel ne modifie pas le contexte du générateur : même catalogue, même format
  assert.strictEqual(CAT.nouveauDocument('5x5').grille, '5x5');
});
