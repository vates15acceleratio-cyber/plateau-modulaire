'use strict';
/*
 * Tests du calcul des contrôles (src/controles.js), règles v2 : compteurs, erreurs et alertes du plateau,
 * dont l'erreur « plateau très déséquilibré » (plateau complet seulement, la pose reste permise).
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/controles.js');
const A = require('./aides-v2.js');
const M = globalThis.PM.modele;
const C = globalThis.PM.controles;

const parCle = (r) => Object.fromEntries(r.compteurs.map((c) => [c.cle, c]));
const trouver = (liste, code) => liste.filter((x) => x.code === code);

/** Charge PM.graphe le temps d'un test (les contrôles l'utilisent s'il est présent). */
function avecGraphe(fn) {
  require('../src/graphe.js');
  return fn();
}

test('plateau vide : compteurs à zéro, aucune erreur ni alerte', () => {
  const r = C.calculer(A.documentExemples());
  const par = parCle(r);
  assert.deepEqual(r.compteurs.map((c) => c.cle), ['villes', 'cases', 'tuiles', 'apparitions_vert', 'apparitions_rouge', 'dimensions', 'tuiles_petites']);
  assert.deepEqual([par.villes.valeur, par.villes.cible, par.villes.etat], [0, 7, 'ecart']);
  assert.deepEqual([par.cases.valeur, par.cases.cible, par.cases.etat], [0, '≈ 60', 'ok']);
  assert.deepEqual([par.tuiles.valeur, par.tuiles.cible], [0, 16]);
  assert.deepEqual([par.apparitions_vert.valeur, par.apparitions_vert.cible], [0, 6]);
  assert.deepEqual([par.apparitions_rouge.valeur, par.apparitions_rouge.cible], [0, 6]);
  assert.equal(par.dimensions.valeur, '48 × 48 cm');
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes, []);
  assert.deepEqual(r.regroupees, []);
});

test('plateau complet équilibré (4×4) : tous les compteurs à ok, aucune erreur ni alerte', () => {
  avecGraphe(() => {
    const r = C.calculer(A.plateauComplet('4x4', true));
    for (const c of r.compteurs) assert.equal(c.etat, 'ok', c.cle + ' ' + c.valeur + ' / ' + c.cible);
    const par = parCle(r);
    // 52 cases de tuiles + 9 jonctions - 7 villes = 54 cases
    assert.equal(par.cases.valeur, 54);
    assert.deepEqual(r.erreurs, []);
    assert.deepEqual(r.alertes, []);
  });
});

test('5×5 : cibles (25 tuiles, 7 apparitions par camp, ≈ 75 cases, 50 × 50 cm)', () => {
  avecGraphe(() => {
    const r = C.calculer(A.plateauComplet('5x5', true));
    const par = parCle(r);
    assert.deepEqual([par.tuiles.valeur, par.tuiles.cible], [25, 25]);
    assert.deepEqual([par.apparitions_vert.valeur, par.apparitions_vert.cible, par.apparitions_rouge.cible], [7, 7, 7]);
    assert.equal(par.cases.cible, '≈ 75');
    assert.equal(par.dimensions.valeur, '50 × 50 cm');
    assert.deepEqual(r.erreurs, []);
  });
});

test('plateau complet très déséquilibré : ERREUR qui nomme le critère, sans cible ; pose toujours permise', () => {
  avecGraphe(() => {
    const d = A.plateauDesequilibre();
    const r = C.calculer(d);
    const e = trouver(r.erreurs, 'desequilibre');
    assert.equal(e.length, 1);
    assert.equal(e[0].niveau, 'erreur');
    assert.match(e[0].message, /^Plateau très déséquilibré : .*5 contre 2/);
    assert.equal(e[0].cible, null);
    assert.equal(r.regroupees[0].code, 'desequilibre');
    // « 5 contre 2 » bloquant : pas aussi en alerte
    assert.equal(trouver(r.alertes, 'cinq_contre_deux').length, 0);
    // la pose et le retrait restent permis
    assert.equal(M.retirerTuile(d, 0, 0).plateau.tuiles.length, 15);
    // plateau incomplet (une tuile retirée) : plus d'erreur d'équilibre
    assert.equal(trouver(C.calculer(M.retirerTuile(d, 1, 1)).erreurs, 'desequilibre').length, 0);
  });
});

test('équilibre : sans PM.graphe chargé ou si PM.graphe lève, aucune erreur ni alerte d\'équilibre', () => {
  require('../src/graphe.js');
  const GR = globalThis.PM.graphe;
  delete globalThis.PM.graphe;
  try {
    const r = C.calculer(A.plateauDesequilibre());
    assert.equal(trouver(r.erreurs, 'desequilibre').length, 0);
  } finally { globalThis.PM.graphe = GR; }
  const vrai = GR.construire;
  GR.construire = () => { throw new Error('panne'); };
  try {
    assert.doesNotThrow(() => C.calculer(A.plateauDesequilibre()));
    assert.equal(trouver(C.calculer(A.plateauDesequilibre()).erreurs, 'desequilibre').length, 0);
  } finally { GR.construire = vrai; }
});

test('villes à moins de 3 cases : alerte (jamais bloquante), cible = la seconde ville', () => {
  avecGraphe(() => {
    // centrales sans relais : porteuses reliées directement (alerte R2 dans l'éditeur)
    const z = M.copieExemples()[0];
    z.id = 'z';
    z.chemins = z.chemins.filter((c) => c.id !== 'r1').concat([{ id: 'h9', a: { case: 'c1' }, b: { case: 'c2' } }]);
    let d = A.plateauComplet('4x4', null, (col, lig) => (col === 1 && lig === 1 ? 'z' : null), [z]);
    d = M.poserJeton(M.poserJeton(d, 1, 1), 2, 1);
    const r = C.calculer(d);
    const a = trouver(r.alertes, 'villes_proches');
    assert.equal(a.length, 1);
    assert.match(a[0].message, /Villes \(1, 1\) et \(2, 1\) à 2 case\(s\) d'écart : la règle en demande au moins 3\./);
    assert.deepEqual(a[0].cible, { type: 'jonction', i: 2, j: 1 });
    assert.deepEqual(r.erreurs, []);
  });
});

test('plus de 7 villes : alerte ; plateau non connexe : alerte une fois la grille remplie', () => {
  avecGraphe(() => {
    let d = A.plateauComplet('4x4', true);
    d = M.poserJeton(M.poserJeton(d, 1, 2), 3, 2);
    assert.match(trouver(C.calculer(d).alertes, 'trop_de_villes')[0].message, /9 villes/);
    // coin sans aucun raccord ni port vers le reste : îlot
    const ilot = M.copieExemples()[2];
    ilot.id = 'ilot';
    ilot.chemins = [{ id: 'h1', a: { case: 'c2' }, b: { case: 'c1' } }];
    const d2 = A.plateauComplet('4x4', null, (col, lig) => (col === 0 && lig === 0 ? 'ilot' : null), [ilot]);
    assert.equal(trouver(C.calculer(d2).alertes, 'plateau_non_connexe').length, 1);
    assert.equal(trouver(C.calculer(M.retirerTuile(d2, 3, 3)).alertes, 'plateau_non_connexe').length, 0);
  });
});

test('alertes de place reprises de validerPlateau, avec leur cible de surbrillance', () => {
  let d = A.documentExemples();
  d.plateau.tuiles.push({ modeleId: 'ex-centrale', col: 1, lig: 0, rot: 0 }); // hors rôle : possible dans un document ancien ou chargé
  const r = C.calculer(d);
  const a = trouver(r.alertes, 'gabarit_place')[0];
  assert.deepEqual(a.cible, { type: 'tuile', col: 1, lig: 0 });
  assert.equal(trouver(r.alertes, 'pourtour_sans_apparition').length, 1);
  assert.ok(r.regroupees.some((g) => g.code === 'gabarit_place' && g.libelle === 'Tuiles hors de leur place'));
});

test('raccord mort et port vers le bord : cibles de surbrillance ; ordre des groupes', () => {
  let d = A.documentExemples();
  d = M.poserTuile(d, 'ex-bord', 1, 0, 2); // retourné : raccord au nord face au vide, ports vers le bord
  d.modeles[1].exemplaires = 9;
  d = M.poserTuile(d, 'ex-bord', 2, 0);
  d.plateau.tuiles.push({ modeleId: 'absent', col: 3, lig: 3, rot: 0 });
  const r = C.calculer(d);
  const mort = trouver(r.alertes, 'raccord_mort').find((x) => x.cible.col === 1 && x.cible.cote === 0);
  assert.deepEqual(mort.cible, { type: 'raccord', col: 1, lig: 0, cote: 0, pos: 1 });
  assert.deepEqual(trouver(r.alertes, 'port_pourtour')[0].cible, { type: 'port', col: 1, lig: 0, coin: 0 });
  assert.deepEqual(r.regroupees.map((g) => g.code).slice(0, 3), ['modele_absent', 'raccord_mort', 'port_pourtour']);
});

test('modèle incomplet posé : erreur ; exemplaires dépassés : plus d’erreur (poses illimitées)', () => {
  let d = A.plateauComplet('4x4');
  d.modeles[0].cases[0].diametre = 50;
  d.modeles[2].exemplaires = 1;
  const r = C.calculer(d);
  assert.ok(trouver(r.erreurs, 'modele_incomplet').length >= 1);
  assert.equal(trouver(r.erreurs, 'exemplaires_depasses').length, 0);
});

test('revaliderPlateau = calculer(doc).erreurs ; calculer ne modifie pas le document ; document invalide refusé', () => {
  avecGraphe(() => {
    const d = A.plateauDesequilibre(), avant = JSON.stringify(d);
    assert.deepEqual(C.revaliderPlateau(d), C.calculer(d).erreurs);
    assert.equal(JSON.stringify(d), avant);
  });
  assert.throws(() => C.calculer({}), /Document invalide/);
  assert.throws(() => C.calculer({ plateau: { tuiles: [], jetons: [] } }), /bibliothèque/);
  // un document v2 n'a pas de forme : accepté
  assert.doesNotThrow(() => C.calculer(M.nouveauDocument()));
});

test('équilibre modéré : alerte « à surveiller » (S ≥ 5) seulement sur plateau complet, sans erreur', () => {
  avecGraphe(() => {
    let d = A.plateauASurveiller();
    const r = C.calculer(d);
    assert.deepEqual(r.erreurs, []);
    assert.match(trouver(r.alertes, 'score_s')[0].message, /Score S = 5/);
    d = M.retirerJeton(d, 1, 3);
    assert.equal(trouver(C.calculer(d).alertes, 'score_s').length, 0);
  });
});
