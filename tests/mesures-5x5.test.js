'use strict';
/*
 * Garde-fou léger des mesures de contrôle du 5×5 très connecté (outils/mesures-5x5-connecte.js, rapport docs/56 ; catalogue de
 * docs/55) : 12 plateaux du vrai générateur, mesurés par l'outil et recalculés ici indépendamment. Invariants seulement ; aucun
 * pourcentage figé (les mesures sur 200 plateaux sont dans docs/56). L'ancien outil outils/mesures-5x5.js (docs/35) mesurait le
 * catalogue de la 4.00.0 et n'est plus testé.
 */
const test = require('node:test');
const assert = require('node:assert');

const MS = require('../outils/mesures-5x5-connecte.js');
const PM = globalThis.PM;
const M = PM.modele, GR = PM.graphe, GEN = PM.generateur;

let CACHE = null;
function series() {
  if (!CACHE) CACHE = MS.travailler('mt', 0, 12);
  return CACHE;
}

test('mesures 5×5 : chaque plateau est réussi, 59 cases, 48 ports, moins de 5 % de cases à 2 connexions, montable avec la boîte', () => {
  series().forEach((x) => {
    assert.ok(x.ok, 'mt' + x.k + ' : ' + x.raison);
    assert.strictEqual(x.cases, 59);
    assert.strictEqual(x.casesConnexions, 59);
    assert.strictEqual(x.portsTotal, 48);
    assert.strictEqual(x.ports.length, 16);
    assert.ok(x.ports.every((p) => p >= 2));
    assert.ok(x.part < 0.05 && x.faibles <= 2, 'mt' + x.k);
    assert.strictEqual(x.montable, true);
    assert.strictEqual(x.raccordsMorts, 2);
    assert.strictEqual(x.villesProches, 0);
    assert.strictEqual(x.cinq, false);
    assert.ok(x.S < GR.SEUIL_S && x.admissibles >= 1);
  });
});

test('mesures 5×5 : les mesures de l\'outil sont celles de PM.graphe et du générateur (recalcul indépendant)', () => {
  const doc = PM.catalogue.nouveauDocument('5x5');
  series().slice(0, 4).forEach((x) => {
    const r = GEN.generer(doc, { graine: 'mt' + x.k });
    const m = MS.mesurerPlateau(r);
    const g = GR.construire(r.doc, { villesTraversables: false });
    let faibles = 0, somme = 0, n = 0;
    g.cases.forEach((c, id) => { const d = g.voisins.get(id).size; n++; somme += d; if (d <= 2) faibles++; });
    g.jonctions.forEach((jn) => { if (jn.type === 'case') { n++; somme += jn.ports; if (jn.ports <= 2) faibles++; } });
    assert.deepStrictEqual([m.faibles, m.casesConnexions], [faibles, n]);
    assert.ok(Math.abs(m.degreMoyen - somme / n) < 1e-9);
    assert.strictEqual(m.S, GR.equilibre(r.doc).S);
    assert.strictEqual(m.chaine, GR.rythme(r.doc, g).chaineMax);
    assert.strictEqual(m.raccordsMorts, M.raccordsMorts(r.doc).length);
    assert.strictEqual(m.admissibles, GEN.placementsAdmissibles5x5(r.doc));
    for (const k of Object.keys(m)) assert.deepStrictEqual(x[k], m[k], k); // la série (fils de calcul) donne les mêmes mesures
  });
});

test('mesures 5×5 : stock minimal pour une part donnée (recherche exhaustive), résumé lisible', () => {
  const comps = [{ LC1: 3, LC3: 3 }, { LC1: 4, LC3: 2 }, { LC1: 2, LC3: 4 }, { LC1: 3, LC3: 3 }];
  assert.deepStrictEqual(MS.stockMinimal(comps, 0.5, ['LC1', 'LC3']), { total: 6, stock: { LC1: 3, LC3: 3 }, part: 0.5 });
  assert.deepStrictEqual(MS.stockMinimal(comps, 1, ['LC1', 'LC3']).total, 8);
  const texte = MS.resume(series());
  assert.match(texte, /^Plateaux : 12 ; réussis : 12 \(100 %\)/);
  assert.match(texte, /Montable avec la boîte : 100 %/);
  assert.match(texte, /Cases à 2 connexions ou moins : moyenne/);
});
