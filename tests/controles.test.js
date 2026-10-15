'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/controles.js');
const M = globalThis.PM.modele;
const C = globalThis.PM.controles;

/** Document avec les 4 modèles d'exemple (4 exemplaires chacun). */
function docAvecExemples() {
  let d = M.nouveauDocument();
  for (const m of M.copieExemples()) d = M.ajouterModele(d, m);
  return d;
}

/** Plateau 4x4 complet : une tuile par cellule, du modèle du bon rôle. */
function plateauComplet() {
  const exemples = M.copieExemples();
  let d = docAvecExemples();
  for (let lig = 0; lig < 4; lig++) {
    for (let col = 0; col < 4; col++) {
      const role = M.roleCellule(col, lig, d.plateau.forme);
      const m = exemples.find((x) => x.role === role);
      d = M.poserTuile(d, m.id, col, lig);
    }
  }
  return d;
}

/** Pose un jeton ('capture' ou 'carrefour') sur chaque jonction indiquée. */
function avecJetons(d, liste) {
  for (const [i, j, type] of liste) d = M.poserJeton(d, i, j, type);
  return d;
}

const TOUTES_JONCTIONS = [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3]];

function trouver(liste, code) {
  return liste.filter((x) => x.code === code);
}

test('plateau vide : compteurs à zéro, aucune erreur ni alerte', () => {
  const r = C.calculer(docAvecExemples());
  const par = Object.fromEntries(r.compteurs.map((c) => [c.cle, c]));
  assert.deepEqual(r.compteurs.map((c) => c.cle), [
    'villes', 'carrefours', 'cases_deplacement', 'tuiles', 'apparitions_j1', 'apparitions_j2',
    'jetons', 'dimensions', 'tuiles_petites'
  ]);
  assert.deepEqual([par.villes.valeur, par.villes.cible, par.villes.etat], [0, 7, 'ecart']);
  assert.deepEqual([par.carrefours.valeur, par.carrefours.cible], [0, 2]);
  assert.deepEqual([par.cases_deplacement.valeur, par.cases_deplacement.cible], [0, 50]);
  assert.deepEqual([par.tuiles.valeur, par.tuiles.cible], [0, 16]);
  assert.deepEqual([par.apparitions_j1.valeur, par.apparitions_j1.cible], [0, 2]);
  assert.deepEqual([par.apparitions_j2.valeur, par.apparitions_j2.cible], [0, 2]);
  assert.deepEqual([par.jetons.valeur, par.jetons.cible], [0, 9]);
  assert.equal(par.dimensions.valeur, '48 × 48 cm');
  assert.equal(par.dimensions.etat, 'ok');
  assert.deepEqual([par.tuiles_petites.valeur, par.tuiles_petites.cible, par.tuiles_petites.etat], [0, 0, 'ok']);
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes, []);
  assert.deepEqual(r.regroupees, []);
});

test('plateau complet sans jetons : tuiles 16/16, apparitions 2/2, aucune erreur', () => {
  const d = plateauComplet();
  const r = C.calculer(d);
  const par = Object.fromEntries(r.compteurs.map((c) => [c.cle, c]));
  assert.deepEqual([par.tuiles.valeur, par.tuiles.cible, par.tuiles.etat], [16, 16, 'ok']);
  assert.equal(par.apparitions_j1.etat, 'ok');
  assert.equal(par.apparitions_j2.etat, 'ok');
  assert.equal(par.jetons.etat, 'ecart');
  // cases de déplacement attendues : somme des cases de type deplacement des modèles posés (pas de carrefours)
  const attendu = M.copieExemples().reduce((s, m) => {
    const n = m.cases.filter((c) => c.type === 'deplacement').length;
    return s + n * 4;
  }, 0);
  assert.equal(par.cases_deplacement.valeur, attendu);
  assert.deepEqual(r.erreurs, []);
  // les seules alertes possibles ici sont les raccords morts des exemples : pas de jeton
  assert.ok(r.alertes.every((a) => a.code === 'raccord_mort' && a.niveau === 'alerte'));
});

test('7 villes et 2 carrefours bien placés : aucune alerte de jeton', () => {
  let d = plateauComplet();
  d = avecJetons(d, [
    [1, 2, 'carrefour'], [3, 2, 'carrefour'],
    [1, 1, 'capture'], [2, 1, 'capture'], [3, 1, 'capture'], [2, 2, 'capture'],
    [1, 3, 'capture'], [2, 3, 'capture'], [3, 3, 'capture']
  ]);
  const r = C.calculer(d);
  const par = Object.fromEntries(r.compteurs.map((c) => [c.cle, c]));
  assert.deepEqual([par.villes.valeur, par.villes.etat], [7, 'ok']);
  assert.deepEqual([par.carrefours.valeur, par.carrefours.etat], [2, 'ok']);
  assert.deepEqual([par.jetons.valeur, par.jetons.etat], [9, 'ok']);
  assert.equal(trouver(r.alertes, 'carrefours_meme_cote').length, 0);
  assert.equal(trouver(r.alertes, 'trop_de_villes').length, 0);
  assert.equal(trouver(r.alertes, 'trop_de_carrefours').length, 0);
});

test('paires de carrefours : même côté (alerte) et côtés opposés (aucune alerte)', () => {
  const base = plateauComplet();
  const villesRestantes = (exclus) => TOUTES_JONCTIONS
    .filter(([i, j]) => !exclus.some(([a, b]) => a === i && b === j))
    .map(([i, j]) => [i, j, 'capture']);

  // deux carrefours sur la rangée nord
  let d = avecJetons(base, [[1, 1, 'carrefour'], [3, 1, 'carrefour'], ...villesRestantes([[1, 1], [3, 1]])]);
  let al = trouver(C.calculer(d).alertes, 'carrefours_meme_cote');
  assert.equal(al.length, 1);
  assert.deepEqual(al[0].cible, { type: 'jonction', i: 3, j: 1 });
  assert.equal(al[0].niveau, 'alerte');

  // deux carrefours sur la colonne ouest : pas un camp de joueur, pas d'alerte (arbitrage I3)
  d = avecJetons(base, [[1, 1, 'carrefour'], [1, 3, 'carrefour'], ...villesRestantes([[1, 1], [1, 3]])]);
  assert.equal(trouver(C.calculer(d).alertes, 'carrefours_meme_cote').length, 0);

  // côtés opposés : (1,2)+(3,2) et (2,1)+(2,3)
  d = avecJetons(base, [[1, 2, 'carrefour'], [3, 2, 'carrefour'], ...villesRestantes([[1, 2], [3, 2]])]);
  assert.equal(trouver(C.calculer(d).alertes, 'carrefours_meme_cote').length, 0);
  d = avecJetons(base, [[2, 1, 'carrefour'], [2, 3, 'carrefour'], ...villesRestantes([[2, 1], [2, 3]])]);
  assert.equal(trouver(C.calculer(d).alertes, 'carrefours_meme_cote').length, 0);
});

test('trop de villes ou de carrefours : alertes de la composition', () => {
  const base = plateauComplet();
  const huit = TOUTES_JONCTIONS.slice(0, 8).map(([i, j]) => [i, j, 'capture']);
  let r = C.calculer(avecJetons(base, huit));
  assert.equal(trouver(r.alertes, 'trop_de_villes').length, 1);
  assert.equal(r.compteurs.find((c) => c.cle === 'villes').valeur, 8);

  const trois = [[1, 2, 'carrefour'], [3, 2, 'carrefour'], [2, 2, 'carrefour']];
  r = C.calculer(avecJetons(base, trois));
  assert.equal(trouver(r.alertes, 'trop_de_carrefours').length, 1);
});

test('raccord mort : cible de surbrillance égale au raccord réel', () => {
  const d = plateauComplet();
  const morts = M.raccordsMorts(d).filter((x) => x.raison !== 'absent');
  assert.ok(morts.length > 0, 'le plateau d\'exemples doit avoir des raccords morts');
  const alertes = trouver(C.calculer(d).alertes, 'raccord_mort');
  assert.equal(alertes.length, morts.length);
  alertes.forEach((a, k) => {
    assert.equal(a.niveau, 'alerte');
    assert.deepEqual(a.cible, { type: 'raccord', col: morts[k].col, lig: morts[k].lig, cote: morts[k].cote, pos: morts[k].pos });
  });
});

test('port de coin mort (forme réduite) : cible de type port', () => {
  // retirer le coin (0,0) : le port de coin de l'apparition (1,0) et de la centrale (1,1) visent des jonctions impossibles
  const d = M.changerForme(plateauComplet(), { retires: [{ col: 0, lig: 0 }] });
  const r = C.calculer(d);
  const ports = trouver(r.alertes, 'port_mort');
  assert.ok(ports.length > 0);
  ports.forEach((p) => {
    assert.equal(p.cible.type, 'port');
    assert.equal(typeof p.cible.col, 'number');
    assert.equal(typeof p.cible.lig, 'number');
    assert.equal(typeof p.cible.coin, 'number');
  });
});

test('modèle incomplet posé : erreur sur la tuile', () => {
  let d = plateauComplet();
  const m = d.modeles.find((x) => x.role === 'coin');
  const casse = JSON.parse(JSON.stringify(m));
  casse.cases = casse.cases.slice(0, 1); // une seule case : modèle incomplet
  d = M.remplacerModele(d, m.id, casse);
  assert.equal(M.validerModele(casse).complet, false);
  const r = C.calculer(d);
  const e = r.erreurs.filter((x) => x.code === 'modele_incomplet');
  assert.ok(e.length > 0);
  assert.equal(e[0].niveau, 'erreur');
  const tuile = d.plateau.tuiles.find((t) => t.modeleId === m.id);
  assert.deepEqual(e[0].cible, { type: 'tuile', col: tuile.col, lig: tuile.lig });
});

test('exemplaires dépassés : erreur, cible = une tuile du modèle', () => {
  let d = plateauComplet();
  // le modèle a été réduit à 1 exemplaire alors que 4 tuiles sont posées
  d = JSON.parse(JSON.stringify(d));
  const m = d.modeles.find((x) => x.role === 'coin');
  m.exemplaires = 1;
  const r = C.calculer(d);
  const e = r.erreurs.filter((x) => x.code === 'exemplaires_depasses');
  assert.equal(e.length, 1);
  assert.equal(e[0].niveau, 'erreur');
  const premiere = d.plateau.tuiles.find((t) => t.modeleId === m.id);
  assert.deepEqual(e[0].cible, { type: 'tuile', col: premiere.col, lig: premiere.lig });
});

test('revaliderPlateau renvoie exactement calculer(doc).erreurs', () => {
  let d = plateauComplet();
  d = JSON.parse(JSON.stringify(d));
  d.modeles.find((x) => x.role === 'bord').exemplaires = 0;
  assert.deepEqual(C.revaliderPlateau(d), C.calculer(d).erreurs);
  assert.ok(C.revaliderPlateau(d).length > 0);
});

test('calculer ne modifie pas le document', () => {
  const d = avecJetons(plateauComplet(), [[1, 1, 'capture'], [3, 1, 'carrefour'], [1, 3, 'carrefour']]);
  const avant = JSON.stringify(d);
  C.calculer(d);
  assert.equal(JSON.stringify(d), avant);
});

test('regroupées : erreurs d\'abord, puis raccords morts, puis ports morts', () => {
  // retirer (0,0) : rôle incorrect (erreur), raccords face au vide et ports morts (alertes)
  const d = M.changerForme(plateauComplet(), { retires: [{ col: 0, lig: 0 }] });
  const r = C.calculer(d);
  const codes = r.regroupees.map((g) => g.code);
  const rangs = r.regroupees.map((g) => g.rang);
  assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b));
  assert.ok(codes.indexOf('raccord_mort') < codes.indexOf('port_mort'));
  assert.equal(r.regroupees[0].niveau, 'erreur');
  const total = r.regroupees.reduce((s, g) => s + g.nombre, 0);
  assert.equal(total, r.erreurs.length + r.alertes.length);
  const raccords = r.regroupees.find((g) => g.code === 'raccord_mort');
  assert.equal(raccords.nombre, trouver(r.alertes, 'raccord_mort').length);
  assert.equal(raccords.elements.length, raccords.nombre);
});

test('cibles selon la forme (intégration) : 4×4 complet = 2 carrefours / 50 cases ; formes réduites', () => {
  const C = globalThis.PM.controles;
  assert.deepEqual(C.ciblesSelonForme({ retires: [] }), { carrefours: 2, casesDeplacement: 50 });
  // Sans le coin NO : la jonction (1,1) devient impossible (8 jonctions) → 1 carrefour ; 3 cases en moins.
  assert.deepEqual(C.ciblesSelonForme({ retires: [{ col: 0, lig: 0 }] }), { carrefours: 1, casesDeplacement: 46 });
  // Sans deux coins : 7 jonctions → 0 carrefour.
  assert.deepEqual(C.ciblesSelonForme({ retires: [{ col: 0, lig: 0 }, { col: 3, lig: 3 }] }).carrefours, 0);
});

test('règle des carrefours identique dans les contrôles et l’assemblage (36 paires)', () => {
  require('../src/assemblage.js');
  const A = globalThis.PM.assemblage;
  const base = plateauComplet();
  for (let x = 0; x < TOUTES_JONCTIONS.length; x++) {
    for (let y = x + 1; y < TOUTES_JONCTIONS.length; y++) {
      const [a, b] = [TOUTES_JONCTIONS[x], TOUTES_JONCTIONS[y]];
      const d = avecJetons(base, [[a[0], a[1], 'carrefour'], [b[0], b[1], 'carrefour']]);
      const controle = trouver(C.calculer(d).alertes, 'carrefours_meme_cote').length > 0;
      assert.equal(controle, A.carrefoursMemeCote(d) !== null, JSON.stringify([a, b]));
    }
  }
});
