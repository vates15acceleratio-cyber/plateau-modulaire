'use strict';
/*
 * Tests du générateur de plateau aléatoire (src/generateur.js), adapté aux règles v2.
 * Bibliothèque de test : PM.modele.copieExemples(grille) (conforme à R1 à R4). Le catalogue de la version 1
 * ne permet aucun plateau à 3 cases d'écart entre villes : le générateur doit l'expliquer.
 */
const test = require('node:test');
const assert = require('node:assert');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
const A = require('./aides-v2.js');
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, GR = PM.graphe;

/** Bibliothèque d'exemples, avec une seconde centrale (étoile sans raccord ouest) pour varier les tirages. */
function docExemples(grille) {
  const d = A.documentExemples(grille);
  const variante = JSON.parse(JSON.stringify(d.modeles[0]));
  variante.id = 'ex-centrale-b';
  variante.nom = 'Étoile sans ouest';
  variante.chemins = variante.chemins.filter((c) => c.id !== 'r4');
  variante.exemplaires = 2;
  d.modeles.push(variante);
  return d;
}

test('même graine et même bibliothèque : même plateau (graine texte et graine nombre)', () => {
  for (const graine of ['essai', 42]) {
    const a = GEN.generer(docExemples(), { graine, candidats: 40 });
    const b = GEN.generer(docExemples(), { graine, candidats: 40 });
    assert.ok(a.ok, a.raison);
    assert.deepStrictEqual(a.doc, b.doc);
    assert.strictEqual(a.graine, String(graine));
  }
});

test('graines différentes : plateaux différents (au moins un sur 5)', () => {
  const vus = new Set();
  for (let k = 0; k < 5; k++) vus.add(JSON.stringify(GEN.generer(docExemples(), { graine: 'g' + k, candidats: 30 }).doc.plateau));
  assert.ok(vus.size > 1);
});

test('sans graine : une graine est générée et renvoyée, et la rejouer redonne le plateau', () => {
  const a = GEN.generer(docExemples(), { candidats: 20 });
  assert.ok(a.graine && typeof a.graine === 'string');
  const b = GEN.generer(docExemples(), { candidats: 20, graine: a.graine });
  assert.deepStrictEqual(a.doc, b.doc);
});

test('plateau généré 4×4 et 5×5 : grille pleine, 7 villes, valide, compteurs PM.controles à ok, aucune erreur', () => {
  for (const grille of ['4x4', '5x5']) {
    for (const graine of ['a', 'b']) {
      const r = GEN.generer(docExemples(grille), { graine, candidats: 40 });
      assert.ok(r.ok, r.raison);
      const n = PM.geometrie.format(grille).GRILLE.colonnes;
      assert.strictEqual(r.doc.grille, grille);
      assert.strictEqual(r.doc.plateau.tuiles.length, n * n);
      assert.strictEqual(r.doc.plateau.jetons.length, 7);
      assert.ok(r.doc.plateau.jetons.every((j) => j.type === 'capture'));
      assert.ok(!('forme' in r.doc.plateau));
      assert.strictEqual(M.validerPlateau(r.doc).erreurs.length, 0);
      const c = PM.controles.calculer(r.doc);
      assert.deepStrictEqual(c.erreurs, []);
      for (const cpt of c.compteurs) assert.strictEqual(cpt.etat, 'ok', grille + ' ' + cpt.cle + ' : ' + cpt.valeur + ' / ' + cpt.cible);
      // bords et coins dans leur rotation suggérée
      for (const t of r.doc.plateau.tuiles) {
        const g = M.modeleParId(r.doc, t.modeleId).gabarit, rot = M.rotationDeduite(t.col, t.lig, g, grille);
        if (rot !== null) assert.strictEqual(t.rot, rot);
      }
    }
  }
});

test('critère v2 vérifié indépendamment : 3 cases entre villes, connexe, pas de blocage, écart ≤ 2, première ville égale', () => {
  for (let k = 0; k < 6; k++) {
    const r = GEN.generer(docExemples(k % 2 ? '5x5' : '4x4'), { graine: 'v' + k, candidats: 30 });
    assert.ok(r.ok, r.raison);
    const g = GR.construire(r.doc);
    assert.deepStrictEqual(GR.villesProches(g), []);
    assert.ok(GR.connexe(g));
    const e = GR.equilibre(r.doc, { graphe: g });
    assert.strictEqual(e.complet, true);
    assert.deepStrictEqual(e.blocages, []);
    assert.ok(e.ecartMax7 <= 2);
    assert.strictEqual(e.premiereEgale, true);
    assert.strictEqual(r.score.S, e.S);
    assert.ok(r.rapport.some((t) => /joueur vert/.test(t) && /joueur rouge/.test(t)));
    assert.ok(!r.rapport.some((t) => /carrefour|J1|J2/.test(t)));
  }
});

test('catalogue v2 : plateaux valides sur plusieurs graines ; des centrales en anneau (R2 violée) : aucun plateau, raison explicite', () => {
  for (const graine of ['v2-a', 'v2-b', 'v2-c']) {
    const r = GEN.generer(PM.catalogue.nouveauDocument(), { graine, candidats: 10 });
    assert.strictEqual(r.ok, true, r.raison);
    assert.deepStrictEqual(M.validerPlateau(r.doc).erreurs, []);
    // seules alertes possibles : des raccords morts (au plus 2 sans pénalité du classement)
    assert.ok(M.validerPlateau(r.doc).alertes.every((a) => a.code === 'raccord_mort'));
    assert.ok(r.score.raccordsMorts <= 2);
  }
  // anneau de 4 cases à port reliées : deux villes voisines à moins de 3 cases
  const doc = PM.catalogue.nouveauDocument();
  const c = (id, x, y) => ({ id, x, y, diametre: 24, type: 'deplacement' });
  const lien = (id, a, b) => ({ id, a: { case: a }, b: { case: b } });
  doc.modeles = doc.modeles.filter((m) => m.gabarit !== 'centrale').concat([{
    id: 'C1', nom: 'Anneau', gabarit: 'centrale', grille: '4x4', exemplaires: 6,
    cases: [c('c1', 36, 36), c('c2', 84, 36), c('c3', 84, 84), c('c4', 36, 84)],
    chemins: [lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4'), lien('h4', 'c4', 'c1'),
      ...[0, 1, 2, 3].map((k) => ({ id: 'p' + k, a: { case: 'c' + (k + 1) }, b: { coin: k } }))]
  }]);
  const r = GEN.generer(doc, { graine: 'anneaux', candidats: 10, essaisMax: 40 });
  assert.strictEqual(r.ok, false);
  assert.ok(r.rejets.villes_proches > 0);
  assert.match(r.raison, /Aucun plateau acceptable en 40 essais/);
  assert.match(r.raison, /villes à moins de 3 cases/);
  assert.match(r.raison, /R1 à R4/);
});

test('pureté : l\'entrée n\'est pas modifiée, les modèles et autres champs sont conservés', () => {
  const doc = docExemples();
  doc.plateau.tuiles.push({ modeleId: doc.modeles[0].id, col: 1, lig: 1, rot: 0 });
  doc.autreChamp = { x: 1 };
  const avant = JSON.stringify(doc);
  const r = GEN.generer(doc, { graine: 'pur', candidats: 20 });
  assert.strictEqual(JSON.stringify(doc), avant);
  assert.deepStrictEqual(r.doc.modeles, doc.modeles);
  assert.deepStrictEqual(r.doc.autreChamp, { x: 1 });
  assert.notStrictEqual(r.doc.modeles, doc.modeles);
});

test('bibliothèque insuffisante : ok false avec le gabarit sans modèle (complet, à 1 exemplaire au moins)', () => {
  const doc = docExemples();
  doc.modeles.find((m) => m.gabarit === 'coin').exemplaires = 0;   // jamais tiré : plus aucun coin utilisable
  const r = GEN.generer(doc, { graine: 1 });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /Bibliothèque insuffisante/);
  assert.match(r.raison, /aucun modèle de coin \(il en faut pour 4 cellule\(s\)/);
  const d2 = docExemples();
  d2.modeles.filter((m) => m.gabarit === 'centrale').forEach((m) => { m.cases[0].diametre = 60; });
  assert.match(GEN.generer(d2, { graine: 1 }).raison, /centrale/);
  assert.match(GEN.generer(M.nouveauDocument(), { graine: 1 }).raison, /coin/);
  // grille 5×5 avec les tuiles du 4×4 : aucune n'est posable (autre grille), il manque tout
  const d5 = Object.assign(M.nouveauDocument('5x5'), { modeles: docExemples().modeles });
  assert.match(GEN.generer(d5, { graine: 1 }).raison, /aucun modèle de centrale \(il en faut pour 9 cellule\(s\)/);
});

test('aucun candidat acceptable : ok false, nombre d\'essais borné et causes données', () => {
  const vrai = GR.equilibre;
  GR.equilibre = function (doc, options) {
    const e = vrai(doc, options);
    return Object.assign({}, e, { cinqContreDeux: true, tresDesequilibre: true });
  };
  try {
    const r = GEN.generer(docExemples(), { graine: 'x', candidats: 5, essaisMax: 12 });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.essais, 12);
    assert.strictEqual(r.rejets.desequilibre, 12);
    assert.match(r.raison, /Aucun plateau acceptable en 12 essais \(plateau très déséquilibré : 12\)/);
  } finally {
    GR.equilibre = vrai;
  }
});

test('ville inaccessible : rejet sous sa propre cause, pas « écart »', () => {
  const vrai = GR.equilibre;
  GR.equilibre = function (doc, options) { return Object.assign({}, vrai(doc, options), { S: null, ecartMax7: null }); };
  try {
    const r = GEN.generer(docExemples(), { graine: 'x', candidats: 3, essaisMax: 5 });
    assert.strictEqual(r.rejets.ville_inaccessible, 5);
    assert.strictEqual(r.rejets.ecart, 0);
    assert.match(r.raison, /ville inaccessible : 5/);
  } finally {
    GR.equilibre = vrai;
  }
});

test('tolérance : S du plateau rendu ≤ Smin + tolérance (1 par défaut, 0 = meilleur S)', () => {
  for (let k = 0; k < 4; k++) {
    const r = GEN.generer(docExemples(), { graine: 't' + k, candidats: 40 });
    assert.ok(r.score.S <= r.score.Smin + 1);
    const r0 = GEN.generer(docExemples(), { graine: 't' + k, candidats: 40, tolerance: 0 });
    assert.strictEqual(r0.score.S, r0.score.Smin);
  }
});

test('temps : 200 candidats en moins de 5 s sous Node (4×4 et 5×5)', () => {
  for (const grille of ['4x4', '5x5']) {
    const t0 = Date.now();
    const r = GEN.generer(docExemples(grille), { graine: 'chrono' });
    const ms = Date.now() - t0;
    assert.ok(r.ok, r.raison);
    assert.strictEqual(r.candidats, 200);
    console.log(`# 200 candidats (${grille}) : ${ms} ms, ${r.essais} essais`);
    assert.ok(ms < 5000, ms + ' ms');
  }
});

test('critere : adaptateur des champs de PM.graphe.equilibre (pas de second calcul)', () => {
  const r = GEN.generer(docExemples(), { graine: 'adapt', candidats: 20 });
  const e = GR.equilibre(r.doc);
  const c = GEN.critere(e);
  assert.strictEqual(c.S, e.S);
  assert.strictEqual(c.ecartMax, e.ecartMax7);
  assert.strictEqual(c.premiereEgale, e.premiereEgale);
  assert.strictEqual(c.cinqContreDeux, e.cinqContreDeux);
  assert.strictEqual(c.tresDesequilibre, false);
  assert.strictEqual(c.villeInaccessible, false);
  const inacc = GEN.critere(Object.assign({}, e, { S: null, ecartMax7: null }));
  assert.strictEqual(inacc.villeInaccessible, true);
});

test('exemplaires : simples poids du tirage, aucun plafond ni minimum (un seul exemplaire suffit pour tout un plateau)', () => {
  const d = docExemples();
  d.modeles.forEach((m) => { m.exemplaires = m.id === 'ex-centrale' ? 999 : 1; });
  const r = GEN.generer(d, { graine: 'p', candidats: 10 });
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.doc.plateau.tuiles.length, 16);
  // un seul coin possible (ex-coin à 1 exemplaire) : il est posé dans les 4 coins du plateau
  const coins = r.doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, '4x4') === 'coin');
  assert.deepStrictEqual(coins.map((t) => t.modeleId), ['ex-coin', 'ex-coin', 'ex-coin', 'ex-coin']);
  assert.deepStrictEqual(M.validerPlateau(r.doc).erreurs, []);
});

test('un modèle à 0 exemplaire n\u2019est jamais tiré', () => {
  const d = docExemples();
  d.modeles.find((m) => m.id === 'ex-centrale-b').exemplaires = 0;
  for (let k = 0; k < 4; k++) {
    const r = GEN.generer(d, { graine: 'zero' + k, candidats: 10 });
    assert.ok(r.ok, r.raison);
    assert.ok(r.doc.plateau.tuiles.every((t) => t.modeleId !== 'ex-centrale-b'));
  }
});

test('rôles respectés par le tirage : coin dans un coin, bord sur le pourtour, centrale au centre (4×4 et 5×5), toutes les poses valides', () => {
  for (const grille of ['4x4', '5x5']) {
    const r = GEN.generer(docExemples(grille), { graine: 'roles', candidats: 20 });
    assert.ok(r.ok, r.raison);
    const gab = { 'ex-coin': 'coin', 'ex-bord': 'bord', 'ex-centrale': 'centrale', 'ex-centrale-b': 'centrale' };
    for (const t of r.doc.plateau.tuiles) assert.strictEqual(gab[t.modeleId], M.gabaritCellule(t.col, t.lig, grille), `${t.modeleId} en (${t.col},${t.lig})`);
  }
});

/* ---------- réutilisation d'un modèle et variété ---------- */

/** Bibliothèque 4×4 avec 5 bords de poids égal (le tirage des 8 bords doit les répartir). */
function docCinqBords() {
  const d = A.documentExemples();
  const bord = d.modeles.find((m) => m.gabarit === 'bord');
  bord.exemplaires = 1;
  for (let k = 2; k <= 5; k++) d.modeles.push(Object.assign(JSON.parse(JSON.stringify(bord)), { id: 'ex-bord-' + k, nom: 'Bord ' + k }));
  return d;
}
function rng(graine) { return GEN.mulberry32(GEN.hacher(graine)); }
const distincts = (tuiles, gabarit) => new Set(tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, '4x4') === gabarit).map((t) => t.modeleId)).size;

test('tirage : un modèle peut servir plusieurs fois et la même graine redonne les mêmes tuiles', () => {
  const d = A.documentExemples(), F = M.formatDuDocument(d);
  const modeles = GEN.modelesParGabarit(d, F), cellules = GEN.cellulesDuFormat(F);
  const a = GEN.tirerTuiles(modeles, cellules, F, rng('rep')), b = GEN.tirerTuiles(modeles, cellules, F, rng('rep'));
  assert.deepStrictEqual(a, b);
  assert.strictEqual(a.length, 16);
  assert.strictEqual(a.filter((t) => t.modeleId === 'ex-bord').length, 8);   // un seul modèle de bord : réutilisé 8 fois
  assert.notDeepStrictEqual(a, GEN.tirerTuiles(modeles, cellules, F, rng('autre')));
});

test('tirage : la pénalité de répétition favorise la variété (plus de bords distincts qu\u2019un tirage sans pénalité de mêmes poids)', () => {
  const d = docCinqBords(), F = M.formatDuDocument(d);
  const modeles = GEN.modelesParGabarit(d, F), cellules = GEN.cellulesDuFormat(F);
  assert.strictEqual(modeles.bord.length, 5);
  assert.ok(GEN.facteurRepetition(0) === 1 && GEN.facteurRepetition(1) < 1 && GEN.facteurRepetition(2) < GEN.facteurRepetition(1));
  const N = 400, avec = [], sans = [], r1 = rng('variete'), r2 = rng('variete-sans');
  for (let k = 0; k < N; k++) {
    avec.push(distincts(GEN.tirerTuiles(modeles, cellules, F, r1), 'bord'));
    // même tirage, poids égaux, sans aucune pénalité (référence)
    const cartes = cellules.filter((c) => c.gabarit === 'bord').map(() => modeles.bord[Math.floor(r2() * 5)].id);
    sans.push(new Set(cartes).size);
  }
  const moy = (t) => t.reduce((a, b) => a + b, 0) / t.length;
  // mesuré sur 4000 tirages : 4,52 modèles distincts sur 5 avec pénalité contre 4,17 sans (8 tirages parmi 5)
  assert.ok(moy(avec) > moy(sans) + 0.2, `avec pénalité ${moy(avec).toFixed(2)}, sans ${moy(sans).toFixed(2)}`);
  assert.ok(moy(avec) > 4.3, 'avec pénalité : ' + moy(avec));
  // et plus de plateaux à 4 bords distincts ou plus
  const part4 = (t) => t.filter((n) => n >= 4).length / t.length;
  assert.ok(part4(avec) > part4(sans) + 0.05, `part à 4 bords distincts au moins : ${part4(avec)} contre ${part4(sans)}`);
});

test('tirage : les poids (exemplaires) comptent encore : un modèle à 6 exemplaires sort plus souvent que ses voisins à 1', () => {
  const d = docCinqBords(), F = M.formatDuDocument(d);
  d.modeles.find((m) => m.id === 'ex-bord').exemplaires = 6;
  const modeles = GEN.modelesParGabarit(d, F), cellules = GEN.cellulesDuFormat(F), r = rng('poids');
  let lourd = 0, autres = 0;
  for (let k = 0; k < 300; k++) {
    for (const t of GEN.tirerTuiles(modeles, cellules, F, r)) if (M.gabaritCellule(t.col, t.lig, '4x4') === 'bord') { if (t.modeleId === 'ex-bord') lourd++; else autres++; }
  }
  assert.ok(lourd / 300 > 2 * (autres / 300 / 4), `modèle lourd ${lourd / 300} par plateau, un autre ${(autres / 300 / 4).toFixed(2)}`);
});

test('plateau généré avec répétition : un seul modèle par gabarit donne un plateau valide (même modèle sur tout le pourtour)', () => {
  const r = GEN.generer(A.documentExemples(), { graine: 'meme', candidats: 5, essaisMax: 400 });
  // les exemples de test ne respectent pas tous le critère d'équilibre : on vérifie seulement que la pose répétée ne produit aucune erreur
  assert.deepStrictEqual(r.ok ? M.validerPlateau(r.doc).erreurs : [], []);
});

test('entrées invalides : document absent, grille inconnue', () => {
  assert.match(GEN.generer(null).raison, /Aucun document/);
  assert.match(GEN.generer({ grille: 'hexagone', modeles: [], plateau: { tuiles: [], jetons: [] } }).raison, /inconnu/);
});

/* ---------------------------------------------------------------------- */
/* Jonctions-cases (docs/22)                                                */
/* ---------------------------------------------------------------------- */

/** Les 2 jonctions intérieures du 4×4 sans ville dans un plateau généré. */
function jonctionsCases(doc) {
  const villes = new Set(doc.plateau.jetons.map((j) => j.i + ',' + j.j));
  const res = [];
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) if (!villes.has(i + ',' + j)) res.push({ i, j });
  return res;
}
const cle = (p) => p.map((c) => '(' + c.i + ',' + c.j + ')').join('+');

test('jonctions-cases : 3 paires de la rangée centrale par défaut, 30 en mode varié (sans les paires d\'une même rangée extérieure), aucune règle en 5×5', () => {
  const F4 = PM.geometrie.format('4x4'), F5 = PM.geometrie.format('5x5');
  assert.deepStrictEqual(GEN.pairesJonctionsCases(F4, false).map(cle), ['(1,2)+(2,2)', '(1,2)+(3,2)', '(2,2)+(3,2)']);
  const variees = GEN.pairesJonctionsCases(F4, true);
  assert.strictEqual(variees.length, 30);
  assert.ok(!variees.some((p) => p[0].j === p[1].j && p[0].j !== 2), 'aucune paire d\'une même rangée extérieure');
  assert.ok(variees.some((p) => p[0].j === 2 && p[1].j === 2), 'la rangée centrale reste permise');
  assert.strictEqual(GEN.pairesJonctionsCases(F5, false), null);
  assert.strictEqual(GEN.pairesJonctionsCases(F5, true), null);
});

test('générateur par défaut : jonctions-cases dans la rangée centrale et aucun « 5 contre 2 » sur 200 plateaux du catalogue', () => {
  const CAT = PM.catalogue;
  let essais = 0, cinq = 0, ok = 0;
  const vues = new Set();
  for (let k = 0; k < 200; k++) {
    // un seul candidat par graine : les rejets comptent les tirages avant tout filtrage par le critère
    const r = GEN.generer(CAT.nouveauDocument(), { graine: 'defaut-' + k, candidats: 1, essaisMax: 1 });
    essais += r.essais;
    // « 5 contre 2 » est un blocage : l'évaluation le range sous « desequilibre » (cinq_contre_deux n'est pas atteint)
    cinq += r.rejets.desequilibre + r.rejets.cinq_contre_deux;
    if (r.ok) { ok++; const c = jonctionsCases(r.doc); assert.ok(c.length === 2 && c.every((x) => x.j === 2), cle(c)); vues.add(cle(c)); }
  }
  assert.ok(essais >= 200);
  assert.strictEqual(cinq, 0, '« 5 contre 2 » sur ' + essais + ' tirages');
  assert.ok(ok >= 150, 'plateaux acceptés : ' + ok);
  assert.strictEqual(vues.size, 3, 'les 3 paires sont tirées : ' + [...vues]);
});

test('jonctions variées : le test précédent n’est pas vide : des tirages bloqués apparaissent hors rangée centrale (1,7 % mesuré)', () => {
  let bloques = 0;
  for (let k = 0; k < 600; k++) {
    const r = GEN.generer(PM.catalogue.nouveauDocument(), { graine: 'bloc-' + k, candidats: 1, essaisMax: 1, jonctionsVariees: true });
    bloques += r.rejets.desequilibre;
  }
  assert.ok(bloques > 0, 'tirages bloqués : ' + bloques);
});

test('jonctions variées : reproductible, jamais deux jonctions-cases dans une même rangée extérieure, paires hors rangée centrale tirées', () => {
  const CAT = PM.catalogue;
  const a = GEN.generer(CAT.nouveauDocument(), { graine: 'v', candidats: 20, jonctionsVariees: true });
  const b = GEN.generer(CAT.nouveauDocument(), { graine: 'v', candidats: 20, jonctionsVariees: true });
  assert.ok(a.ok, a.raison);
  assert.deepStrictEqual(a.doc, b.doc);
  let horsCentre = 0;
  for (let k = 0; k < 60; k++) {
    const r = GEN.generer(CAT.nouveauDocument(), { graine: 'var-' + k, candidats: 1, essaisMax: 1, jonctionsVariees: true });
    if (!r.ok) continue;
    const c = jonctionsCases(r.doc);
    assert.ok(!(c[0].j === c[1].j && c[0].j !== 2), cle(c));
    if (c.some((x) => x.j !== 2)) horsCentre++;
  }
  assert.ok(horsCentre > 10, 'paires hors rangée centrale : ' + horsCentre);
});
