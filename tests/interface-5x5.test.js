'use strict';
// Interface en 5×5 : création d'un plateau en choisissant la grille, pose, refus de mélange, camps (rangée centrale
// neutre), compteurs, export, générateur, sauvegarde. Aucune dépendance au catalogue : modèles d'essai de
// PM.modele.copieExemples (conformes aux règles v2) et doublures de PM.catalogue.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/etat.js');
require('../src/sauvegarde.js');
require('../src/graphe.js');
require('../src/equilibre.js');
require('../src/generateur.js');
require('../src/export.js');
require('../src/controles.js');
require('../src/bibliotheque.js');
require('../src/assemblage.js');
require('../src/editeur-tuile.js');
require('../src/app.js'); // chargeable sous Node : la coquille ne démarre que dans un navigateur
const AV2 = require('./aides-v2.js');
const PM = globalThis.PM;
const M = PM.modele, A = PM.assemblage, B = PM.bibliotheque, C = PM.controles, E = PM.exportation, GEN = PM.generateur, S = PM.sauvegarde;
const N = PM.nouveau;
const F5 = PM.geometrie.format('5x5');

const copie = (o) => JSON.parse(JSON.stringify(o));
const doc5 = () => AV2.documentExemples('5x5');
const plein5 = (villes) => AV2.plateauComplet('5x5', villes === undefined ? true : villes);

/** Doublure du catalogue : `grilles` = grilles qu'il sait fabriquer ; sinon il ignore l'argument (comme avant le 5×5). */
function catalogueDouble(grilles) {
  return {
    nouveauDocument(grille) {
      const g = grille || '4x4';
      return AV2.documentExemples(grilles.includes(g) ? g : '4x4');
    }
  };
}
function avecCatalogue(cat, fn) {
  const avant = PM.catalogue;
  PM.catalogue = cat;
  try { return fn(); } finally { PM.catalogue = avant; }
}

/* ------------------------------------------------------------------ */
/* Création : choix de la grille                                       */
/* ------------------------------------------------------------------ */

test('descriptions de grille : dimensions et tuiles lues dans les cotes du format', () => {
  assert.deepEqual(N.descriptionGrille('4x4'), { id: '4x4', nom: '4×4', dimensions: '48 × 48 cm', tuile: '12 cm' });
  assert.deepEqual(N.descriptionGrille('5x5'), { id: '5x5', nom: '5×5', dimensions: '50 × 50 cm', tuile: '10 cm' });
  assert.equal(N.libelleIndicateur(doc5()), 'Grille 5×5 · 50 × 50 cm');
  assert.equal(N.libelleIndicateur(M.nouveauDocument()), 'Grille 4×4 · 48 × 48 cm');
  assert.equal(N.libelleIndicateur({ modeles: [], plateau: { tuiles: [], jetons: [] } }), 'Grille 4×4 · 48 × 48 cm', 'grille absente = 4×4');
});

test('nouveau 5×5 : document de la bonne grille quand le catalogue sait la fabriquer', () => {
  avecCatalogue(catalogueDouble(['4x4', '5x5']), () => {
    const r = N.documentPourGrille('5x5');
    assert.equal(r.ok, true);
    assert.equal(r.doc.grille, '5x5');
    assert.ok(r.doc.modeles.length > 0 && r.doc.modeles.every((m) => m.grille === '5x5'));
    assert.deepEqual(r.doc.plateau, { tuiles: [], jetons: [] });
    assert.equal(N.documentPourGrille('4x4').doc.grille, '4x4');
  });
});

test('nouveau 5×5 : catalogue qui ignore la grille, absent ou en panne = refus en une phrase, rien ne change', () => {
  const cas = {
    'ignore l\'argument (renvoie du 4×4)': catalogueDouble(['4x4']),
    'sans fonction': {},
    'qui lève': { nouveauDocument() { throw new Error('pas prêt'); } },
    'document sans modèles': { nouveauDocument() { return { grille: '5x5' }; } },
    'modèles d\'une autre grille': { nouveauDocument() { const d = doc5(); d.modeles[0].grille = '4x4'; return d; } }
  };
  for (const [nom, cat] of Object.entries(cas)) {
    avecCatalogue(cat, () => {
      const r = N.documentPourGrille('5x5');
      assert.equal(r.ok, false, nom);
      assert.match(r.raison, /5×5.*pas encore disponible/, nom);
      assert.ok(!/[.!?]\s+\S/.test(r.raison.trim()), 'une seule phrase : ' + r.raison);
    });
  }
  avecCatalogue(undefined, () => assert.equal(N.documentPourGrille('5x5').ok, false));
  assert.equal(N.documentPourGrille('6x6').ok, false);
  assert.match(N.documentPourGrille('6x6').raison, /inconnue/);
});

test('nouveau plateau : remplacement annulable, le document précédent revient avec Ctrl+Z', () => {
  const etat = PM.etat.creer(AV2.documentExemples('4x4'));
  etat.majUi({ aPoser: 'ex-bord' });
  const r = avecCatalogue(catalogueDouble(['4x4', '5x5']), () => N.documentPourGrille('5x5'));
  etat.remplacer(r.doc, 'nouveau plateau 5×5');
  etat.majUi({ aPoser: null, onglet: 'plateau' });
  assert.equal(etat.doc().grille, '5x5');
  assert.equal(etat.ui().aPoser, null);
  assert.equal(etat.peutAnnuler(), true);
  etat.annuler();
  assert.equal(etat.doc().grille, '4x4');
});

/* ------------------------------------------------------------------ */
/* Plateau 5×5 : cellules, jonctions, camps, rangée neutre             */
/* ------------------------------------------------------------------ */

test('plateau 5×5 vide : 25 cellules, 16 jonctions, 50 × 50 cm, camps vert et rouge, une rangée neutre', () => {
  const svg = A.svgPlateau(doc5(), {});
  assert.equal((svg.match(/data-cellule="/g) || []).length, 25);
  assert.equal((svg.match(/data-jonction="/g) || []).length, 16);
  assert.match(svg, /Plateau 5 × 5, 50 × 50 cm/);
  assert.match(svg, /Camp vert \(nord\)/);
  assert.match(svg, /Camp rouge \(sud\)/);
  assert.equal((svg.match(/data-rangee-neutre="/g) || []).length, 1);
  assert.match(svg, /data-rangee-neutre="2"/);
  assert.match(svg, /Neutre/);
  const svg4 = A.svgPlateau(M.nouveauDocument(), {});
  assert.equal((svg4.match(/data-rangee-neutre="/g) || []).length, 0, 'aucune rangée neutre en 4×4');
  assert.match(svg4, /48 × 48 cm/);
});

test('plateau 5×5 : étiquettes des cellules libres, rangée centrale neutre', () => {
  assert.equal(A.etiquetteCellule(0, 0, '5x5'), 'Coin, camp vert');
  assert.equal(A.etiquetteCellule(2, 1, '5x5'), 'Centrale');
  assert.equal(A.etiquetteCellule(2, 0, '5x5'), 'Bord, camp vert');
  assert.equal(A.etiquetteCellule(0, 2, '5x5'), 'Bord, neutre');
  assert.equal(A.etiquetteCellule(4, 2, '5x5'), 'Bord, neutre');
  assert.equal(A.etiquetteCellule(2, 2, '5x5'), 'Centrale');
  assert.equal(A.etiquetteCellule(4, 4, '5x5'), 'Coin, camp rouge');
  assert.equal(A.etiquetteCellule(0, 3, '5x5'), 'Bord, camp rouge');
  assert.equal(A.etiquetteCellule(5, 0, '5x5'), null);
});

test('camps du 5×5 : rangées 0 et 1 vert, 3 et 4 rouge, rangée 2 neutre ; hors grille = aucun camp', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map((l) => M.campCellule('5x5', 3, l)), ['vert', 'vert', null, 'rouge', 'rouge']);
  assert.deepEqual([0, 1, 2, 3].map((l) => M.campCellule('4x4', 1, l)), ['vert', 'vert', 'rouge', 'rouge']);
  assert.equal(M.campCellule('5x5', 5, 0), null);
  assert.equal(M.campCellule('5x5', 0, 5), null);
});

test('l\'écran dessine l\'apparition de la rangée neutre en neutre, ni verte ni rouge', () => {
  const doc = plein5(false);
  const svg = A.svgPlateau(doc, {});
  const camps = (svg.match(/data-apparition="[a-z]+"/g) || []).reduce((o, s) => { o[s] = (o[s] || 0) + 1; return o; }, {});
  assert.equal(camps['data-apparition="vert"'], 7);
  assert.equal(camps['data-apparition="rouge"'], 7);
  assert.equal(camps['data-apparition="neutre"'], 2);
});

test('pose sur un plateau 5×5 : rôle respecté (4 coins, 12 bords, 9 centrales), bord et coin tournés vers l’extérieur', () => {
  let doc = doc5();
  doc.modeles.forEach((m) => { m.exemplaires = 1; }); // poses illimitées : 1 exemplaire n'empêche rien
  assert.equal(A.cellulesCompatibles(doc, 'ex-bord').length, 12);
  assert.equal(A.cellulesCompatibles(doc, 'ex-coin').length, 4);
  assert.equal(A.cellulesCompatibles(doc, 'ex-centrale').length, 9);
  assert.match(M.peutPoserTuile(doc, 'ex-coin', 2, 0).raison, /^Cette tuile est un coin/);
  doc = A.poserTuileTournee(doc, 'ex-coin', 4, 4, null);
  assert.equal(doc.plateau.tuiles[0].rot, 2);
  doc = A.poserTuileTournee(doc, 'ex-bord', 0, 2, null);
  assert.equal(doc.plateau.tuiles[1].rot, 3);
  assert.equal(M.peutPoserTuile(doc, 'ex-bord', 5, 0).ok, false, 'hors grille 5×5');
  assert.equal(M.peutPoserTuile(doc, 'ex-bord', 4, 3).ok, true, 'la colonne 4 existe en 5×5');
  const complet = plein5();
  assert.equal(complet.plateau.tuiles.length, 25);
  assert.equal(complet.plateau.jetons.length, 7);
});

/* ------------------------------------------------------------------ */
/* Refus du mélange de grilles                                         */
/* ------------------------------------------------------------------ */

test('un modèle 4×4 ne se pose pas sur un plateau 5×5 (et inversement) : refus expliqué en une phrase', () => {
  const doc = doc5();
  const m4 = copie(M.copieExemples('4x4')[1]);
  m4.id = 'ex4-bord'; m4.exemplaires = 5;
  doc.modeles.push(m4);
  const test5 = M.peutPoserTuile(doc, 'ex4-bord', 1, 0);
  assert.equal(test5.ok, false);
  assert.throws(() => M.poserTuile(doc, 'ex4-bord', 1, 0));
  assert.equal(A.cellulesCompatibles(doc, 'ex4-bord').length, 0);
  const phrase = A.raisonRefus(doc, 'ex4-bord', test5.raison);
  assert.match(phrase, /grille 4×4/);
  assert.match(phrase, /plateau 5×5/);
  assert.ok(!/[.!?]\s+\S/.test(phrase.trim()), phrase);
  assert.equal(A.raisonRefus(doc, 'ex-bord', 'autre raison'), 'autre raison', 'un modèle de la bonne grille garde sa raison');
  // sens inverse
  const doc4 = M.nouveauDocument('4x4');
  const m5 = copie(M.copieExemples('5x5')[1]);
  m5.exemplaires = 5;
  doc4.modeles = [m5];
  assert.equal(M.peutPoserTuile(doc4, m5.id, 1, 0).ok, false);
  assert.match(A.raisonRefus(doc4, m5.id, ''), /grille 5×5.*plateau 4×4/);
});

test('déplacement d\'une tuile d\'une autre grille déjà posée : refusé aussi', () => {
  const doc = plein5(false);
  doc.modeles.push(Object.assign(copie(doc.modeles.find((m) => m.id === 'ex-centrale')), { id: 'ex4-c', grille: '4x4', exemplaires: 1 }));
  assert.equal(M.peutPoserTuile(doc, 'ex4-c', 0, 0).ok, false);
});

test('bibliothèque : le modèle de l\'autre grille est signalé (autreGrille), non posable ; sans grille = accepté', () => {
  const doc = doc5();
  const m4 = copie(M.copieExemples('4x4')[0]);
  m4.id = 'ex4-centrale'; m4.exemplaires = 2;
  const sansGrille = copie(M.copieExemples('5x5')[0]);
  sansGrille.id = 'ex-sans-grille'; delete sansGrille.grille;
  doc.modeles.push(m4, sansGrille);
  const tous = B.vignettesBibliotheque(doc, 'tous').reduce((acc, g) => acc.concat(g.modeles), []);
  const v = (id) => tous.find((x) => x.id === id);
  assert.equal(v('ex-centrale').autreGrille, false);
  assert.equal(v('ex4-centrale').autreGrille, true);
  assert.equal(v('ex4-centrale').posable, false);
  assert.equal(v('ex-sans-grille').autreGrille, false);
  assert.equal(v('ex-sans-grille').posable, true);
  assert.match(B.phraseAutreGrille(m4, doc), /grille 4×4.*plateau 5×5/);
  assert.equal(B.phraseAutreGrille(doc.modeles[0], doc), '');
  assert.equal(B.phraseAutreGrille(null, doc), '');
});

/* ------------------------------------------------------------------ */
/* Compteurs, contrôles, équilibre                                     */
/* ------------------------------------------------------------------ */

test('compteurs du 5×5 : 7 villes, 25 tuiles, ≈ 59 cases, 7 apparitions par camp, 50 × 50 cm', () => {
  const r = C.calculer(plein5());
  const c = (cle) => r.compteurs.find((x) => x.cle === cle);
  assert.equal(c('villes').valeur, 7);
  assert.equal(c('villes').cible, 7);
  assert.equal(c('tuiles').valeur, 25);
  assert.equal(c('tuiles').cible, 25);
  assert.equal(c('cases').cible, '≈ 59');
  assert.equal(c('apparitions_vert').valeur, 7);
  assert.equal(c('apparitions_vert').cible, 7);
  assert.equal(c('apparitions_rouge').valeur, 7);
  assert.equal(c('apparitions_rouge').cible, 7);
  assert.equal(c('dimensions').valeur, '50 × 50 cm');
  assert.equal(c('apparitions_vert').etat, 'ok');
  assert.deepEqual(r.erreurs.map((e) => e.code), []);
  assert.equal(C.calculer(M.nouveauDocument()).compteurs.find((x) => x.cle === 'dimensions').valeur, '48 × 48 cm');
});

test('les apparitions de la rangée neutre ne comptent pour aucun camp (compteurs et graphe)', () => {
  const doc = plein5();
  const r = C.calculer(doc);
  const total = (k) => r.compteurs.find((x) => x.cle === k).valeur;
  const surRangeeNeutre = doc.plateau.tuiles.filter((t) => t.lig === 2).length;
  assert.equal(surRangeeNeutre, 5);
  assert.equal(total('apparitions_vert') + total('apparitions_rouge'), 14, '16 tuiles de pourtour, dont 2 dans la rangée neutre');
  const g = PM.graphe.construire(doc);
  assert.equal(g.apparitions[1].length, 7);
  assert.equal(g.apparitions[2].length, 7);
  assert.equal(g.jonctions.length, 16);
});

test('plateau 5×5 incomplet : les compteurs le disent, pas d\'erreur', () => {
  const r = C.calculer(doc5());
  assert.equal(r.compteurs.find((x) => x.cle === 'tuiles').valeur, 0);
  assert.equal(r.compteurs.find((x) => x.cle === 'tuiles').cible, 25);
  assert.ok(r.compteurs.some((x) => x.etat !== 'ok'));
  assert.deepEqual(r.erreurs, []);
});

test('rapport d\'équilibre 5×5 : pas de conseil propre au 4×4', () => {
  const eq = PM.equilibre;
  const r5 = eq.rapport(eq.analyser(plein5()));
  const r4 = eq.rapport(eq.analyser(AV2.plateauComplet('4x4', true)));
  assert.ok(!/rangée centrale/.test(r5.explication), r5.explication);
  assert.match(r4.explication, /rangée centrale/);
  assert.match(r5.explication, /on ne la traverse pas/);
});

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

test('export 5×5 : tuile de 106 mm avec fond perdu, pas de 112 mm (132 mm en 4×4)', () => {
  assert.equal(E.COTE_PLANCHE, 126, 'valeur historique du 4×4');
  const doc = plein5();
  const planches = E.calepiner(doc, { format: 'A3' });
  assert.ok(planches.every((p) => p.pas === 112), 'pas de 112 mm : ' + planches.map((p) => p.pas));
  assert.deepEqual(planches.map((p) => p.tuiles.length), [6, 6, 6, 6, 1]);
  const [t0, t1] = planches[0].tuiles;
  assert.equal(Math.round((t1.x - t0.x) * 1000) / 1000, 112);
  const svg = planches[0].svg;
  assert.match(svg, /width="106"/);
  assert.ok(!/width="126"/.test(svg), 'aucune tuile de 126 mm');
  assert.equal(E.calepiner(AV2.plateauComplet('4x4', true), { format: 'A3' })[0].pas, 132);
  assert.deepEqual(E.calepiner(doc, { format: 'A4' }).map((p) => p.tuiles.length), [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
});

test('export 5×5 : dimensions PNG à 300 dpi des feuilles, aperçu du plateau 50 × 50 cm', () => {
  const doc = plein5();
  const sortie = E.preparerSorties(doc, { tuiles: true, portee: 'stock', format: 'A3', apercu: true, jetons: true });
  const [a3] = sortie.feuilles;
  assert.deepEqual(E.pngDims(a3), { largeurPx: 3508, hauteurPx: 4961 });
  const apercu = sortie.feuilles.find((f) => f.type === 'apercu');
  assert.match(apercu.svg, /Plateau assemblé 50 x 50 cm/);
  assert.equal(sortie.nbTuiles, 25);
  const a4 = E.preparerSorties(doc, { tuiles: true, portee: 'stock', format: 'A4' }).feuilles[0];
  assert.deepEqual(E.pngDims(a4), { largeurPx: 2480, hauteurPx: 3508 });
  const s4 = E.svgApercuPlateau(AV2.plateauComplet('4x4', true));
  assert.match(s4, /48 x 48 cm/);
});

/* ------------------------------------------------------------------ */
/* Générateur                                                          */
/* ------------------------------------------------------------------ */

test('générateur 5×5 : plateau complet valide, villes en 2-3-2, jonctions-cases par défaut, reproductible', () => {
  const F5 = PM.geometrie.format('5x5');
  // 5×5 : 2016 placements 2-3-2 (9 jonctions-cases chacun), la même liste avec ou sans l'option « variées » (masquée en 5×5)
  assert.equal(GEN.pairesJonctionsCases(F5, false).length, 2016);
  assert.ok(GEN.pairesJonctionsCases(F5, false).every((p) => p.length === 9));
  assert.deepEqual(GEN.pairesJonctionsCases(F5, true), GEN.pairesJonctionsCases(F5, false));
  assert.ok(GEN.pairesJonctionsCases(PM.geometrie.format('4x4'), false).length > 0);
  // le catalogue livré : le 5×5 demande des tuiles très connectées (les exemples n'en donnent pas, docs/18)
  const avant = PM.catalogue; // ce fichier teste aussi l'interface sans catalogue : on le charge le temps de copier sa bibliothèque
  require('../src/catalogue.js');
  const doc = PM.catalogue.nouveauDocument('5x5');
  PM.catalogue = avant;
  const r = GEN.generer(doc, { graine: 'essai-5x5', candidats: 30 });
  assert.equal(r.ok, true, r.raison);
  assert.equal(r.doc.grille, '5x5');
  assert.equal(r.doc.plateau.tuiles.length, 25);
  assert.equal(r.doc.plateau.jetons.length, 7);
  assert.ok(r.doc.plateau.jetons.every((j) => j.i >= 1 && j.i <= 4 && j.j >= 1 && j.j <= 4 && j.type === 'capture'));
  const parRangee = [1, 2, 3, 4].map((rang) => r.doc.plateau.jetons.filter((j) => j.j === rang).length);
  assert.deepEqual([parRangee[0], parRangee[1] + parRangee[2], parRangee[3]], [2, 3, 2], 'villes en 2-3-2');
  assert.deepEqual(M.validerPlateau(r.doc).erreurs, []);
  const c = C.calculer(r.doc);
  assert.deepEqual(c.erreurs.map((e) => e.code), []);
  assert.ok(!c.alertes.some((a) => a.code === 'villes_proches'));
  assert.deepEqual(GEN.generer(doc, { graine: 'essai-5x5', candidats: 30 }).doc, r.doc);
  assert.ok(r.doc.plateau.tuiles.every((t) => t.col < 5 && t.lig < 5));
});

/* ------------------------------------------------------------------ */
/* Éditeur de tuile                                                    */
/* ------------------------------------------------------------------ */

test('éditeur 5×5 : vue de 100 mm, grille d\'aimantation de 10 mm, cases de Ø 24 au plus, gabarits', () => {
  const Ed = PM.editeurTuile;
  assert.equal(Ed.vuePour(F5).l, 132);
  assert.deepEqual(Ed.aimanter(51, 49, 24, F5), { x: 50, y: 50 });
  for (const gabarit of ['centrale', 'bord', 'coin']) {
    const m = Ed.modeleDeDepart(gabarit, [], F5);
    assert.equal(m.grille, '5x5');
    assert.ok(m.cases.every((c) => c.diametre <= F5.DIAMETRE_CASE_MAX && c.x % 10 === 0 && c.y % 10 === 0), gabarit);
    assert.ok(m.cases.every((c) => c.x >= 16 && c.x <= 84 && c.y >= 16 && c.y <= 84), gabarit + ' dans la tuile de 100 mm');
  }
  const grosse = copie(M.copieExemples('5x5')[0]);
  grosse.cases[0].diametre = 30;
  assert.ok(M.validerModele(grosse, F5).erreurs.some((e) => e.code === 'diametre'), 'Ø 30 refusé en 5×5');
  assert.equal(M.validerModele(M.copieExemples('5x5')[0], F5).complet, true);
});

/* ------------------------------------------------------------------ */
/* Sauvegarde                                                          */
/* ------------------------------------------------------------------ */

test('sauvegarde : aller-retour d\'un document 5×5 complet (grille, modèles, tuiles, villes)', () => {
  const doc = plein5();
  const r = S.depuisJSON(S.versJSON(doc));
  assert.equal(r.ok, true);
  assert.equal(r.doc.grille, '5x5');
  assert.deepEqual(r.doc.plateau, doc.plateau);
  assert.deepEqual(r.doc.modeles.map((m) => [m.id, m.grille, m.exemplaires]), doc.modeles.map((m) => [m.id, m.grille, m.exemplaires]));
  assert.ok(r.doc.modeles.every((m) => M.validerModele(m, '5x5').complet));
  assert.equal(JSON.parse(S.versJSON(doc)).grille, '5x5');
});

test('sauvegarde automatique : un document 5×5 est relu en 5×5', () => {
  const m = new Map();
  const stockage = { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
  const avant = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { value: stockage, configurable: true, writable: true });
  try {
    const doc = plein5();
    S.ecrireMaintenant(doc);
    const r = S.restaurerAutosave();
    assert.ok(r && r.ok, 'sauvegarde relue');
    assert.equal(r.doc.grille, '5x5');
    assert.equal(r.doc.plateau.tuiles.length, 25);
  } finally {
    if (avant === undefined) delete globalThis.localStorage; else Object.defineProperty(globalThis, 'localStorage', { value: avant, configurable: true, writable: true });
  }
});
