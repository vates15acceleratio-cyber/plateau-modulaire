'use strict';
/*
 * Tests du générateur de plateau aléatoire (src/generateur.js).
 * N'utilise ni les identifiants ni les coordonnées du catalogue : le catalogue sert seulement
 * de bibliothèque réaliste ; les autres cas utilisent PM.modele.copieExemples().
 */
const test = require('node:test');
const assert = require('node:assert');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, GR = PM.graphe;

function docCatalogue() { return PM.catalogue.nouveauDocument(); }
function docExemples() { const d = M.nouveauDocument(); d.modeles = M.copieExemples(); return d; }
const memeCamp = (a, b) => (a.j === 1 && b.j === 1) || (a.j === 3 && b.j === 3);
const carrefours = (doc) => doc.plateau.jetons.filter((j) => j.type === 'carrefour');

test('même graine et même bibliothèque : même plateau (graine texte et graine nombre)', () => {
  for (const graine of ['essai', 42]) {
    const a = GEN.generer(docCatalogue(), { graine, candidats: 60 });
    const b = GEN.generer(docCatalogue(), { graine, candidats: 60 });
    assert.ok(a.ok, a.raison);
    assert.deepStrictEqual(a.doc, b.doc);
    assert.strictEqual(a.graine, String(graine));
  }
  // la même graine en mode « carrefours variés » est aussi reproductible
  const c = GEN.generer(docCatalogue(), { graine: 'v', candidats: 60, paireCarrefours: 'varies' });
  const d = GEN.generer(docCatalogue(), { graine: 'v', candidats: 60, paireCarrefours: 'varies' });
  assert.deepStrictEqual(c.doc, d.doc);
});

test('graines différentes : plateaux différents (au moins un sur 5)', () => {
  const vus = new Set();
  for (let k = 0; k < 5; k++) vus.add(JSON.stringify(GEN.generer(docCatalogue(), { graine: 'g' + k, candidats: 40 }).doc.plateau.tuiles));
  assert.ok(vus.size > 1);
});

test('sans graine : une graine est générée et renvoyée, et la rejouer redonne le plateau', () => {
  const a = GEN.generer(docCatalogue(), { candidats: 30 });
  assert.ok(a.graine && typeof a.graine === 'string');
  const b = GEN.generer(docCatalogue(), { candidats: 30, graine: a.graine });
  assert.deepStrictEqual(a.doc, b.doc);
});

test('plateau généré complet et valide (validerPlateau, compteurs PM.controles à ok)', () => {
  for (const graine of ['a', 'b', 'c', 'd']) {
    for (const lib of [docCatalogue(), docExemples()]) {
      const r = GEN.generer(lib, { graine, candidats: 50 });
      assert.ok(r.ok, r.raison);
      assert.strictEqual(M.validerPlateau(r.doc).erreurs.length, 0);
      assert.strictEqual(r.doc.plateau.tuiles.length, 16);
      const c = PM.controles.calculer(r.doc);
      assert.strictEqual(c.erreurs.length, 0);
      for (const cpt of c.compteurs) assert.strictEqual(cpt.etat, 'ok', cpt.cle + ' : ' + cpt.valeur + ' / ' + cpt.cible);
      assert.ok(!c.alertes.some((x) => x.code === 'carrefours_meme_cote'));
    }
  }
});

test('critère d\'équilibre du doc 16 respecté (non traversables) : pas de 5 contre 2, écart ≤ 2 aux 7 rangs, première ville égale', () => {
  for (let k = 0; k < 8; k++) {
    const r = GEN.generer(docCatalogue(), { graine: 'eq' + k, candidats: 40 });
    const e = GR.equilibre(r.doc, { villesTraversables: false });
    assert.ok(!e.alertes.some((a) => a.code === 'cinq_contre_deux'));
    const c = GEN.critere(e);
    assert.ok(c.ecartMax <= 2);
    assert.ok(c.premiereEgale);
    assert.strictEqual(c.S, r.score.S);
  }
});

test('paire par défaut (1,2)+(3,2) respectée par défaut', () => {
  for (let k = 0; k < 5; k++) {
    const r = GEN.generer(docCatalogue(), { graine: 'p' + k, candidats: 30 });
    const cs = carrefours(r.doc).map((j) => j.i + ',' + j.j).sort();
    assert.deepStrictEqual(cs, ['1,2', '3,2']);
    assert.strictEqual(r.paire, '(1,2)+(3,2)');
    assert.strictEqual(r.doc.plateau.jetons.filter((j) => j.type === 'capture').length, 7);
  }
});

test('jamais 2 carrefours dans le même camp, et carrefours variés : S ≤ S de la paire par défaut', () => {
  assert.strictEqual(GEN.PAIRES.length, 30);
  let autres = 0;
  for (let k = 0; k < 25; k++) {
    const r = GEN.generer(docCatalogue(), { graine: 'v' + k, candidats: 30, paireCarrefours: 'varies' });
    assert.ok(r.ok, r.raison);
    const cs = carrefours(r.doc);
    assert.strictEqual(cs.length, 2);
    assert.ok(!memeCamp(cs[0], cs[1]));
    if (r.paire !== GEN.PAIRE_DEFAUT) {
      autres++;
      const ref = JSON.parse(JSON.stringify(r.doc));
      ref.plateau.jetons = ref.plateau.jetons.map((j) => ({ i: j.i, j: j.j, type: (j.j === 2 && j.i !== 2) ? 'carrefour' : 'capture' }));
      for (const trav of [true, false]) {
        const e = GR.equilibre(r.doc, { villesTraversables: trav });
        assert.ok(!e.alertes.some((a) => a.code === 'cinq_contre_deux'));
        const c = GEN.critere(e);
        assert.ok(c.ecartMax <= 2 && c.premiereEgale);
      }
      assert.ok(GEN.critere(GR.equilibre(r.doc, { villesTraversables: false })).S <= GEN.critere(GR.equilibre(ref, { villesTraversables: false })).S);
    }
  }
  // 'libre' est accepté comme synonyme de 'varies'
  const l = GEN.generer(docCatalogue(), { graine: 'v3', candidats: 30, paireCarrefours: 'libre' });
  const v = GEN.generer(docCatalogue(), { graine: 'v3', candidats: 30, paireCarrefours: 'varies' });
  assert.deepStrictEqual(l.doc, v.doc);
  assert.ok(autres > 0, 'aucune autre paire retenue sur 25 graines');
});

test('pureté : l\'entrée n\'est pas modifiée, les modèles sont conservés', () => {
  const doc = docCatalogue();
  doc.plateau.tuiles.push({ modeleId: doc.modeles[0].id, col: 1, lig: 1, rot: 0 });
  doc.autreChamp = { x: 1 };
  const avant = JSON.stringify(doc);
  const r = GEN.generer(doc, { graine: 'pur', candidats: 30 });
  assert.strictEqual(JSON.stringify(doc), avant);
  assert.deepStrictEqual(r.doc.modeles, doc.modeles);
  assert.deepStrictEqual(r.doc.autreChamp, { x: 1 });
  assert.notStrictEqual(r.doc.modeles, doc.modeles);
});

test('forme réduite : remplacée par le 4×4 complet, et signalé dans le rapport', () => {
  const doc = M.changerForme(docCatalogue(), { retires: [{ col: 0, lig: 0 }] });
  const r = GEN.generer(doc, { graine: 'forme', candidats: 20 });
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(r.doc.plateau.forme, { retires: [] });
  assert.ok(r.rapport.some((t) => /4×4 complet/.test(t)));
  assert.deepStrictEqual(doc.plateau.forme, { retires: [{ col: 0, lig: 0 }] });
});

test('bibliothèque insuffisante : ok false avec le rôle manquant', () => {
  const doc = docExemples();
  doc.modeles.find((m) => m.role === 'coin').exemplaires = 2;
  const r = GEN.generer(doc, { graine: 1 });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /Bibliothèque insuffisante/);
  assert.match(r.raison, /2 coin\(s\) \(2 disponible\(s\), 4 nécessaire\(s\)\)/);

  // modèle incomplet : non compté
  const d2 = docExemples();
  d2.modeles.find((m) => m.role === 'centrale').cases = [];
  const r2 = GEN.generer(d2, { graine: 1 });
  assert.strictEqual(r2.ok, false);
  assert.match(r2.raison, /centrale/);

  // bibliothèque vide
  const r3 = GEN.generer(M.nouveauDocument(), { graine: 1 });
  assert.strictEqual(r3.ok, false);
  assert.match(r3.raison, /apparition/);
});

test('aucun candidat acceptable : ok false, nombre d’essais borné (D7 n° 6) et causes données', () => {
  // On simule un catalogue toujours déséquilibré : PM.graphe.equilibre renvoie « 5 villes contre 2 ».
  const vrai = GR.equilibre;
  GR.equilibre = function (doc, options) {
    const e = vrai(doc, options);
    return Object.assign({}, e, { partage: { 1: 5, 2: 2, egalite: 0 }, cinqContreDeux: true });
  };
  try {
    const r = GEN.generer(docExemples(), { graine: 'x', candidats: 5, essaisMax: 12 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.essais, 12);
    assert.strictEqual(r.rejets.cinq_contre_deux, 12);
    assert.match(r.raison, /Aucun plateau acceptable en 12 essais/);
    assert.match(r.raison, /5 contre 2/);
  } finally {
    GR.equilibre = vrai;
  }
});

test('écart minimal entre villes (D7) : rejet « villes trop proches » si l\'écart n\'est pas tenu', () => {
  const G = PM.geometrie, vrai = G.ECART_MIN_CAPTURES;
  G.ECART_MIN_CAPTURES = 50; // impossible à tenir : tous les candidats sont rejetés pour cette cause
  try {
    const r = GEN.generer(docExemples(), { graine: 'e', candidats: 3, essaisMax: 6 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.rejets.ecart_villes, 6);
    assert.match(r.raison, /villes trop proches : 6/);
  } finally {
    G.ECART_MIN_CAPTURES = vrai;
  }
  // écart tenu sur un plateau généré (plus court chemin, villes traversables)
  const ok = GEN.generer(docCatalogue(), { graine: 'e', candidats: 20 });
  const g = GR.construire(ok.doc, { villesTraversables: true });
  for (const v of g.villes) {
    const d = GR.distances(g, v);
    for (const w of g.villes) if (w !== v) assert.ok(d.get(w) >= vrai);
  }
});

test('tolérance : S du plateau rendu ≤ Smin + tolérance (1 par défaut, 0 = meilleur S)', () => {
  for (let k = 0; k < 6; k++) {
    const r = GEN.generer(docCatalogue(), { graine: 't' + k, candidats: 60 });
    assert.ok(r.score.S <= r.score.Smin + 1);
    const r0 = GEN.generer(docCatalogue(), { graine: 't' + k, candidats: 60, tolerance: 0 });
    assert.strictEqual(r0.score.S, r0.score.Smin);
  }
});

test('temps : 200 candidats en moins de 5 s sous Node', () => {
  const t0 = Date.now();
  const r = GEN.generer(docCatalogue(), { graine: 'chrono' });
  const ms = Date.now() - t0;
  assert.ok(r.ok);
  assert.strictEqual(r.candidats, 200);
  console.log(`# 200 candidats (catalogue) : ${ms} ms, ${r.essais} essais`);
  assert.ok(ms < 5000, ms + ' ms');
});

test('critere : adaptateur des champs de PM.graphe.equilibre (pas de second calcul)', () => {
  const r = GEN.generer(docCatalogue(), { graine: 'adapt', candidats: 20 });
  const e = GR.equilibre(r.doc, { villesTraversables: false });
  const c = GEN.critere(e);
  assert.strictEqual(c.S, e.S);
  assert.strictEqual(c.ecartMax, e.ecartMax7);
  assert.strictEqual(c.premiereEgale, e.premiereEgale);
  assert.strictEqual(c.cinqContreDeux, e.cinqContreDeux);
  assert.strictEqual(c.villeInaccessible, false);
  const inacc = GEN.critere(Object.assign({}, e, { S: null, ecartMax7: null }));
  assert.strictEqual(inacc.villeInaccessible, true);
  assert.strictEqual(inacc.S, null);
});

test('ville inaccessible : rejet sous sa propre cause, pas « écart »', () => {
  const vrai = GR.equilibre;
  GR.equilibre = function (doc, options) {
    return Object.assign({}, vrai(doc, options), { S: null, ecartMax7: null });
  };
  try {
    const r = GEN.generer(docExemples(), { graine: 'x', candidats: 3, essaisMax: 5 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.rejets.ville_inaccessible, 5);
    assert.strictEqual(r.rejets.ecart, 0);
    assert.match(r.raison, /ville inaccessible : 5/);
  } finally {
    GR.equilibre = vrai;
  }
});

test('garde-fou D7 : cases de déplacement hors de 45 à 55, rejet sous une cause dédiée', () => {
  const vrai = M.modeleParId;
  // vue modifiée des modèles : plus aucune case de déplacement (2 carrefours seulement)
  M.modeleParId = function (doc, id) {
    const m = vrai(doc, id);
    return m ? Object.assign({}, m, { cases: m.cases.filter((c) => c.type !== 'deplacement') }) : m;
  };
  try {
    const r = GEN.generer(docExemples(), { graine: 'c', candidats: 2, essaisMax: 4 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.rejets.cases_deplacement, 4);
    assert.match(r.raison, /cases de déplacement hors de 45 à 55 : 4/);
  } finally {
    M.modeleParId = vrai;
  }
  // bibliothèque réelle : 50 cases, aucun rejet de ce type
  assert.strictEqual(GEN.generer(docCatalogue(), { graine: 'c', candidats: 20 }).rejets.cases_deplacement, 0);
});

test('plafond : plus de 200 tuiles au total dans la bibliothèque, refus clair', () => {
  const d = docCatalogue();
  d.modeles[0].exemplaires = 200; // 219 tuiles au total
  const r = GEN.generer(d, { graine: 'p' });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /219 tuiles/);
  assert.match(r.raison, /200 au plus/);
  const d2 = docCatalogue();
  d2.modeles[0].exemplaires = 181; // exactement 200
  assert.ok(GEN.generer(d2, { graine: 'p', candidats: 10 }).ok);
});
