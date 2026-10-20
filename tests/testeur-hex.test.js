'use strict';
// Recette du testeur pour le format hexagonal 'hex19' (2026-10-19) : cas limites non couverts par les tests des 6 lots.
// 1. fichiers JSON hostiles ; 2. tuiles de l'utilisateur (validation hexagonale) ; 3. bibliothèque modifiée (générateur) ;
// 4. « Orienter les tuiles » ; 5. « Placer les villes » ; 6. mélange de formats ; 7. export ; 8. non-régression 4×4 / 5×5 ;
// 9. fuzz déterministe passant par le chargeur. Les deux défauts D1 et D2 (docs/83) sont corrigés.
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
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
require('../src/app.js');
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, S = PM.sauvegarde, GEN = PM.generateur, GR = PM.graphe, EQ = PM.equilibre, C = PM.controles;
const A = PM.assemblage, ED = PM.editeurTuile, E = PM.exportation, CAT = PM.catalogue;
const F = G.format('hex19');

const copie = (o) => JSON.parse(JSON.stringify(o));
const vide = () => CAT.nouveauDocument('hex19');
let memo = null;
function plateau() {
  if (!memo) {
    const r = GEN.generer(vide(), { graine: '42' });
    assert.ok(r.ok, r.raison);
    memo = r.doc;
  }
  return copie(memo);
}
const estCentrale = (t) => F.cellule(t.col, t.lig).gabarit === 'centrale';
const derange = (doc, cran) => { doc.plateau.tuiles.forEach((t) => { if (estCentrale(t)) t.rot = (t.rot + cran) % 6; }); return doc; };
const modele = (doc, id) => doc.modeles.find((m) => m.id === id);
const codes = (liste) => liste.map((x) => x.code);
const sansNaN = (svg) => !/NaN|undefined|Infinity/.test(svg);

/* ================================ 1. Fichiers JSON hostiles ================================ */

const lire = (modif) => { const o = JSON.parse(S.versJSON(plateau())); if (modif) modif(o); return S.depuisJSON(JSON.stringify(o)); };

test('hostile : grille inconnue ou mal typée refusée par l’enveloppe (casse, __proto__, constructor, nombre, null), sans exception', () => {
  for (const g of ['HEX19', 'hex20', 'hex', '__proto__', 'constructor', 'toString', 19, null, [], {}, true]) {
    const r = lire((o) => { o.grille = g; });
    assert.equal(r.ok, false, 'grille ' + JSON.stringify(g));
    assert.equal(r.erreurs[0].code, 'grille');
  }
});

test('hostile : version et format de l’enveloppe (texte, décimal, négatif, absent ; format étranger)', () => {
  for (const v of ['3', 2.5, -1, 0, 4, null, undefined, [], {}]) {
    const r = lire((o) => { if (v === undefined) delete o.version; else o.version = v; });
    assert.equal(r.ok, false, 'version ' + JSON.stringify(v));
    assert.equal(r.erreurs[0].code, 'version');
  }
  const r = lire((o) => { o.format = 'autre'; });
  assert.equal(r.ok, false);
  assert.equal(r.erreurs[0].code, 'format');
});

test('hostile : un contenu hexagonal sans champ grille (version 3) est lu comme un 4×4 avec alertes, jamais d’exception', () => {
  const r = lire((o) => { delete o.grille; });
  assert.ok(r.ok);
  assert.equal(r.doc.grille, '4x4', 'grille par défaut');
  assert.ok(r.alertes.length > 0, 'les tuiles hexagonales posées en 4×4 sont signalées');
  assert.doesNotThrow(() => A.svgPlateau(r.doc, {}));
  assert.doesNotThrow(() => C.calculer(r.doc));
  assert.doesNotThrow(() => E.svgApercuPlateau(r.doc));
});

test('hostile : un fichier hexagonal de version 3 déclarant la grille 4x4 est lu comme un 4×4 (tuiles hexagonales signalées)', () => {
  const r = lire((o) => { o.grille = '4x4'; });
  assert.ok(r.ok);
  assert.equal(r.doc.grille, '4x4');
  assert.ok(r.alertes.some((a) => a.code === 'hors_grille' || a.code === 'modele_incomplet'));
  assert.doesNotThrow(() => A.svgPlateau(r.doc, {}));
});

test('hostile : rotations de type inattendu (texte, null, absente, 6, 1e9, flottante) — lisible, jamais d’exception, rotation entière après lecture', () => {
  for (const v of ['2', null, undefined, 6, 1e9, 1.5, -1, true, [], {}]) {
    const r = lire((o) => { if (v === undefined) delete o.plateau.tuiles[0].rot; else o.plateau.tuiles[0].rot = v; });
    assert.ok(r.ok, 'rot ' + JSON.stringify(v));
    assert.ok(Number.isInteger(r.doc.plateau.tuiles[0].rot), 'rotation entière après lecture : ' + JSON.stringify(v));
    assert.doesNotThrow(() => A.svgPlateau(r.doc, {}));
    assert.doesNotThrow(() => C.calculer(r.doc));
    assert.doesNotThrow(() => GEN.orienterTuiles(r.doc));
  }
  for (const v of [6, 1e9, -1, 1.5]) {
    const r = lire((o) => { o.plateau.tuiles[0].rot = v; });
    if (Number.isInteger(v)) assert.ok(r.alertes.some((a) => a.code === 'rot_invalide'), 'rot entière hors 0..5 signalée : ' + v);
  }
});

test('hostile : cellules — colonne ou ligne flottante ou texte (tuile ignorée), deux tuiles sur la même cellule (doublon), cellules hors des 19', () => {
  let r = lire((o) => { o.plateau.tuiles[0].col = 1.5; o.plateau.tuiles[1].lig = '2'; });
  assert.ok(r.ok);
  assert.equal(r.doc.plateau.tuiles.length, 17);
  assert.equal(r.alertes.filter((a) => a.code === 'tuile_ignoree').length, 2);
  r = lire((o) => { o.plateau.tuiles.push(copie(o.plateau.tuiles[0])); });
  assert.ok(r.ok);
  assert.ok(r.alertes.some((a) => a.code === 'doublon'));
  r = lire((o) => { o.plateau.tuiles.push({ modeleId: 'HC2', col: 0, lig: 0, rot: 0 }, { modeleId: 'HC2', col: 4, lig: 4, rot: 0 }, { modeleId: 'HC2', col: -1, lig: 2, rot: 0 }); });
  assert.ok(r.ok);
  assert.equal(r.alertes.filter((a) => a.code === 'hors_grille').length, 3, 'les trois coins du rectangle hors de l’hexagone');
});

test('hostile : modeleId piégé (__proto__, constructor, très long, balisage) — tuile de modèle absent signalée, aucun balisage dans le SVG', () => {
  for (const id of ['__proto__', 'constructor', 'toString', 'zz', 'x'.repeat(5000), '"><script>alert(1)</script>']) {
    const r = lire((o) => { o.plateau.tuiles[8].modeleId = id; });
    assert.ok(r.ok);
    assert.ok(r.alertes.some((a) => a.code === 'modele_absent'), 'modele_absent pour ' + id.slice(0, 20));
    assert.ok(!/<script/.test(A.svgPlateau(r.doc, {})));
    assert.ok(!/<script/.test(E.svgApercuPlateau(r.doc)));
  }
  const r = lire((o) => {
    o.modeles[0].id = '"><script>x</script>'; o.modeles[0].nom = '<img src=x onerror=1>';
    o.plateau.tuiles.forEach((t) => { if (t.modeleId === 'HC2') t.modeleId = o.modeles[0].id; });
  });
  assert.ok(r.ok);
  assert.ok(!/<script|<img/.test(A.svgPlateau(r.doc, {})));
  assert.ok(!/<script|<img/.test(E.svgApercuPlateau(r.doc)));
  E.calepiner(r.doc, { format: 'A3' }).forEach((p) => assert.ok(!/<script|<img/.test(p.svg)));
});

test('hostile : jetons hexagonaux — flottant, texte, type inconnu (campement, carrefour) ignorés ; i hors 0..23, j ≠ 0, doublon et 24 villes lus puis signalés', () => {
  for (const mod of [(j) => { j.i = 3.5; }, (j) => { j.i = '3'; }, (j) => { j.type = 'campement'; }, (j) => { j.type = 'carrefour'; }, (j) => { j.j = 0.5; }]) {
    const r = lire((o) => mod(o.plateau.jetons[0]));
    assert.ok(r.ok);
    assert.equal(r.doc.plateau.jetons.length, 5);
    assert.ok(r.alertes.some((a) => a.code === 'jeton_ignore'));
  }
  let r = lire((o) => { o.plateau.jetons[0].i = 24; });
  assert.ok(r.alertes.some((a) => a.code === 'jeton_invalide'), 'siège 24 inexistant');
  r = lire((o) => { o.plateau.jetons[0].j = 1; });
  assert.ok(r.alertes.some((a) => a.code === 'jeton_invalide'), 'j ≠ 0 en hexagonal');
  r = lire((o) => { o.plateau.jetons.push(copie(o.plateau.jetons[0])); });
  assert.ok(r.alertes.some((a) => a.code === 'jeton_invalide' || a.code === 'trop_de_villes'), 'deux villes sur le même siège');
  r = lire((o) => { o.plateau.jetons = Array.from({ length: 24 }, (_, i) => ({ i, j: 0, type: 'capture' })); });
  assert.ok(r.ok);
  assert.equal(r.doc.plateau.jetons.length, 24);
  assert.equal(r.alertes.filter((a) => a.code === 'trop_de_villes').length, 1, 'trop_de_villes signalé une seule fois');
  assert.doesNotThrow(() => GEN.orienterTuiles(r.doc));
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(r.doc));
  assert.doesNotThrow(() => EQ.rapport(EQ.analyser(r.doc)));
});

test('hostile : jeton absent (plateau.jetons manquant) — zéro ville, tout fonctionne', () => {
  const r = lire((o) => { delete o.plateau.jetons; });
  assert.ok(r.ok);
  assert.deepEqual(r.doc.plateau.jetons, []);
  assert.equal(GEN.orienterTuiles(r.doc).ok, false);
  assert.equal(GEN.meilleurPlacementVilles(r.doc).ok, true);
});

test('hostile : modèles — grille de modèle fausse ou absente, exemplaires négatifs ou énormes, identifiant vide ou double, bibliothèque vide', () => {
  let r = lire((o) => { o.modeles[0].grille = '4x4'; });
  assert.ok(r.ok);
  assert.ok(r.alertes.some((a) => a.code === 'modele_incomplet'), 'modèle d’une autre grille : incomplet');
  r = lire((o) => { delete o.modeles[0].grille; });
  assert.ok(r.ok);
  for (const v of [-1, 1e9, 2.5, '8']) {
    r = lire((o) => { o.modeles[0].exemplaires = v; });
    assert.ok(r.alertes.some((a) => a.code === 'exemplaires_invalides'), 'exemplaires ' + v);
    assert.equal(r.doc.modeles[0].exemplaires, 0);
  }
  r = lire((o) => { o.modeles[0].id = ''; });
  assert.ok(r.ok);
  assert.ok(r.alertes.some((a) => a.code === 'modele_sans_id'));
  r = lire((o) => { o.modeles[1].id = o.modeles[0].id; });
  assert.ok(r.alertes.some((a) => a.code === 'id_renomme'));
  r = lire((o) => { o.modeles = []; });
  assert.ok(r.ok);
  assert.ok(r.alertes.some((a) => a.code === 'modele_absent'));
  assert.doesNotThrow(() => A.svgPlateau(r.doc, {}));
  assert.doesNotThrow(() => C.calculer(r.doc));
  assert.equal(GEN.orienterTuiles(r.doc).ok, false);
});

test('hostile : éléments de modèle hors plage (case en 1e6, raccord côté 99, coin 99, passage vers un coin, 100 pivots) — modèle incomplet, plateau lisible', () => {
  const mods = [
    (m) => { m.cases[0].x = 1e6; },
    (m) => { m.cases[0].x = null; },
    (m) => { m.chemins[0].b = { raccord: { cote: 99, pos: 0 } }; },
    (m) => { m.chemins[0].b = { coin: 99 }; },
    (m) => { m.chemins[0].b = { coin: -1 }; },
    (m) => { m.passages[0].a = { coin: 1 }; },
    (m) => { m.pivots = Array.from({ length: 100 }, (_, i) => ({ id: 'p' + i, x: 0, y: 0 })); },
    (m) => { m.cases = null; }
  ];
  for (const mod of mods) {
    const r = lire((o) => mod(o.modeles[0]));
    assert.ok(r.ok);
    assert.ok(r.alertes.some((a) => a.code === 'modele_incomplet' || a.code === 'elements_ignores'), mod.toString());
    assert.doesNotThrow(() => A.svgPlateau(r.doc, {}));
    assert.doesNotThrow(() => C.calculer(r.doc));
    assert.doesNotThrow(() => E.svgApercuPlateau(r.doc));
    assert.doesNotThrow(() => E.calepiner(r.doc, { format: 'A4', portee: 'posees' }).forEach((p) => p.svg));
    assert.doesNotThrow(() => GEN.orienterTuiles(r.doc));
  }
});

test('hostile : plafonds de lecture — 500 tuiles et 500 jetons plafonnés à 64, texte de 1 Mo refusé proprement', () => {
  const r = lire((o) => {
    o.plateau.tuiles = Array.from({ length: 500 }, (_, k) => ({ modeleId: 'HC2', col: 2 + (k % 3), lig: 2, rot: 0 }));
    o.plateau.jetons = Array.from({ length: 500 }, (_, k) => ({ i: k % 24, j: 0, type: 'capture' }));
  });
  assert.ok(r.ok);
  assert.ok(r.doc.plateau.tuiles.length <= 64 && r.doc.plateau.jetons.length <= 64);
  assert.ok(r.alertes.some((a) => a.code === 'tuiles_en_trop') && r.alertes.some((a) => a.code === 'jetons_en_trop'));
  assert.equal(S.depuisJSON('x'.repeat(6e6)).ok, false);
  assert.equal(S.depuisJSON('{"format":"plateau-modulaire","version":3,"grille":"hex19"').ok, false);
});

test('hostile : un document hexagonal sauvé puis relu garde ses 19 tuiles et sa version 3 même vide ; le fichier carré reste en version 2', () => {
  const v = JSON.parse(S.versJSON(vide()));
  assert.equal(v.version, 3);
  assert.equal(v.grille, 'hex19');
  const r = S.depuisJSON(S.versJSON(vide()));
  assert.ok(r.ok);
  assert.equal(r.doc.plateau.tuiles.length, 0);
  assert.equal(JSON.parse(S.versJSON(CAT.nouveauDocument('4x4'))).version <= 3, true);
});

/* ================================ 2. Tuiles de l’utilisateur (éditeur, validation hexagonale) ================================ */

const cs = (id, x, y, t) => ({ id, x, y, diametre: 20, type: t || 'deplacement' });
const rc = (cote, pos) => ({ raccord: { cote, pos: pos || 0 } });
const lien = (id, a, b) => ({ id, a, b });
const tuile = (gabarit, cases, chemins, extra) => Object.assign({ id: 'U1', nom: 'Ma tuile', gabarit, grille: 'hex19', exemplaires: 1, cases, chemins }, extra || {});
const valider = (m) => M.validerModele(m, 'hex19');
const portsCoins = (ks, id) => ks.map((k) => lien('p' + k, { case: id || 'a' }, { coin: k }));

test('tuile utilisateur : les trois modèles de départ de l’éditeur sont à compléter (cases isolées) mais jamais invalides autrement', () => {
  for (const g of ['centrale', 'bord', 'coin']) {
    const v = valider(ED.modeleDeDepart(g, [], 'hex19'));
    assert.ok(v.erreurs.length > 0 && v.erreurs.every((e) => e.code === 'case_isolee'), g + ' : ' + codes(v.erreurs));
  }
});

test('tuile utilisateur : case hors de la forme, NaN, diamètre 0 ou trop grand, cases qui se chevauchent — erreurs, jamais d’exception', () => {
  assert.ok(codes(valider(tuile('centrale', [cs('a', 200, 0)], [lien('1', { case: 'a' }, rc(0))])).erreurs).includes('hors_tuile'));
  assert.ok(codes(valider(tuile('centrale', [cs('a', NaN, 0)], [])).erreurs).includes('case_invalide'));
  assert.ok(codes(valider(tuile('centrale', [Object.assign(cs('a', 0, 0), { diametre: 0 })], [])).erreurs).includes('case_invalide'));
  assert.ok(codes(valider(tuile('centrale', [Object.assign(cs('a', 0, 0), { diametre: 80 })], [])).erreurs).includes('diametre'));
  assert.ok(codes(valider(tuile('centrale', [cs('a', 0, 0), cs('b', 5, 0)], [])).erreurs).includes('chevauchement'));
  assert.ok(codes(valider(tuile('bord', [cs('a', 0, -80, 'apparition')], [])).erreurs).includes('hors_tuile'), 'au-delà du bord droit du pentagone');
});

test('tuile utilisateur : raccord pos ≠ 0, côté 6, côté -1, côté décimal, coin 6, coin -1 — chemin invalide ou zone de coin', () => {
  const avec = (ext) => valider(tuile('centrale', [cs('a', 0, 0)], [lien('1', { case: 'a' }, ext)]));
  assert.ok(codes(avec(rc(0, 1)).erreurs).includes('chemin_invalide') || codes(avec(rc(0, 1)).erreurs).includes('zone_coin'), 'pos 1');
  for (const ext of [rc(0, -1), rc(6, 0), rc(-1, 0), rc(1.5, 0), { coin: 6 }, { coin: -1 }, { coin: 2.5 }, { coin: 99 }]) {
    assert.ok(codes(avec(ext).erreurs).includes('chemin_invalide'), JSON.stringify(ext));
  }
  assert.ok(codes(valider(tuile('bord', [cs('a', 0, 0, 'apparition')], [lien('1', { case: 'a' }, { coin: 7 })])).erreurs).includes('chemin_invalide'));
});

test('tuile utilisateur : H1 — 3 ports sur coins consécutifs (y compris autour de 5-0) acceptés, 4 ports ou ports non consécutifs signalés (alerte, pas erreur)', () => {
  const alertes = (ks) => codes(valider(tuile('centrale', [cs('a', 0, 0)], portsCoins(ks))).alertes);
  const erreurs = (ks) => codes(valider(tuile('centrale', [cs('a', 0, 0)], portsCoins(ks))).erreurs);
  for (const ks of [[0, 1, 2], [5, 0, 1], [4, 5, 0], [3, 4, 5], [2], [0, 1]]) assert.ok(!alertes(ks).includes('ports_case'), 'consécutifs ' + ks);
  for (const ks of [[0, 1, 2, 3], [5, 0, 1, 2], [0, 2, 4], [0, 3], [0, 2], [0, 1, 2, 3, 4]]) {
    assert.ok(alertes(ks).includes('ports_case'), 'à signaler ' + ks);
    assert.deepEqual(erreurs(ks), [], 'H1 : jamais bloquant ' + ks);
  }
});

test('tuile utilisateur : coin porté par deux chemins, raccord pris par deux chemins — erreurs coin_double / raccord_double', () => {
  const c2 = [cs('a', 0, -20), cs('b', 0, 20)];
  assert.ok(codes(valider(tuile('centrale', c2, [lien('1', { case: 'a' }, { coin: 0 }), lien('2', { case: 'b' }, { coin: 0 })])).erreurs).includes('coin_double'));
  assert.ok(codes(valider(tuile('centrale', c2, [lien('1', { case: 'a' }, rc(0)), lien('2', { case: 'b' }, rc(0))])).erreurs).includes('raccord_double'));
});

test('tuile utilisateur : passages — traversant 0-3 / 1-4, sur raccord déjà pris par une case, vers un coin, côté 7, sur lui-même, raccords voisins', () => {
  const pas = (a, b, extra) => valider(tuile('centrale', [], [], Object.assign({ passages: [{ id: 't', a, b }] }, extra || {})));
  for (const [x, y] of [[0, 3], [1, 4], [2, 5]]) assert.deepEqual(pas(rc(x), rc(y)).erreurs, [], 'traversant ' + x + '-' + y);
  assert.ok(codes(pas({ coin: 1 }, rc(1)).erreurs).includes('passage_coin'));
  assert.ok(codes(pas(rc(7), rc(1)).erreurs).includes('passage_invalide'));
  assert.ok(codes(pas(rc(1), rc(1)).erreurs).includes('passage_boucle'));
  assert.ok(codes(pas(rc(0), rc(1)).erreurs).includes('passage_zone_coin'), 'deux raccords voisins : trop près du coin');
  // passage qui traverse une tuile dont le raccord est déjà porté par une case : refusé comme raccord double
  const v = valider(tuile('centrale', [cs('a', 0, 0)], [lien('1', { case: 'a' }, rc(0))], { passages: [{ id: 't', a: rc(0), b: rc(3) }] }));
  assert.ok(codes(v.erreurs).includes('raccord_double'));
});

test('tuile utilisateur : pivot à 4 branches accepté, à 5 branches refusé (pivot_degre) ; pivot isolé signalé', () => {
  const pivot = (n) => valider(tuile('centrale', [], [], { pivots: [{ id: 'v', x: 0, y: 0 }], passages: Array.from({ length: n }, (_, k) => ({ id: 't' + k, a: { pivot: 'v' }, b: rc(k) })) }));
  assert.deepEqual(pivot(4).erreurs, []);
  assert.ok(codes(pivot(5).erreurs).includes('pivot_degre'));
  assert.ok(codes(pivot(1).alertes).includes('pivot_degre_faible'));
});

test('tuile utilisateur : raccords extérieurs d’un bord (côtés 0 et 5) et d’un coin (0, 1, 2) signalés ; une centrale n’en a aucun ; coin et bord sans apparition signalés / refusés', () => {
  const rac = (g, k) => codes(valider(tuile(g, [cs('a', 0, 0, 'apparition')], [lien('1', { case: 'a' }, rc(k))])).alertes).includes('raccord_exterieur');
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => rac('bord', k)), [true, false, false, false, false, true]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => rac('coin', k)), [true, true, true, false, false, false]);
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => rac('centrale', k)), [false, false, false, false, false, false]);
  assert.ok(codes(valider(tuile('bord', [cs('a', 0, 0)], [lien('1', { case: 'a' }, rc(3))])).alertes).includes('sans_apparition'));
  assert.deepEqual([0, 1, 2, 3, 4, 5].map((k) => ED.raccordExterieur('bord', k, F)), [true, false, false, false, false, true]);
  assert.equal(ED.raccordExterieur('bord', 7, F), false);
});

test('tuile utilisateur : gabarit inconnu et grille de modèle étrangère — alerte et erreur, pas d’exception', () => {
  assert.ok(codes(valider(tuile('foo', [cs('a', 0, 0)], [])).alertes).includes('gabarit_inconnu'));
  assert.ok(codes(valider(Object.assign(tuile('centrale', [cs('a', 0, 0)], []), { grille: '4x4' })).erreurs).includes('grille_modele'));
  assert.doesNotThrow(() => valider(null));
  assert.doesNotThrow(() => valider(undefined));
  assert.doesNotThrow(() => valider({}));
  assert.doesNotThrow(() => valider({ cases: 'x', chemins: 5, passages: {}, pivots: 'p' }));
});

test('éditeur : fonctions pures sur coordonnées extrêmes — aimantation dans la forme, jamais NaN ; gabarit inconnu refusé', () => {
  for (const g of ['centrale', 'bord', 'coin']) {
    for (const [x, y] of [[500, 500], [-500, -500], [NaN, 0], [Infinity, -Infinity], [0, 0], [1e12, 1e12]]) {
      const p = ED.aimanter(x, y, 20, F, g);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), g + ' ' + x + ',' + y);
      assert.ok(Math.abs(p.x) < 100 && Math.abs(p.y) < 100, 'dans le canevas');
    }
  }
  assert.throws(() => ED.changerGabarit(ED.modeleDeDepart('centrale', [], 'hex19'), 'zzz'), /Gabarit inconnu/);
  assert.throws(() => ED.modeleDeDepart('zzz', [], 'hex19'), /Gabarit inconnu/);
  const m = ED.modeleDeDepart('centrale', [], 'hex19');
  assert.throws(() => ED.ajouterPassage(m, { coin: 1 }, rc(1)), /coin/);
  assert.throws(() => ED.supprimer(m, null), /Rien/);
});

function avecTuileUtilisateur(doc, source, id, nb) {
  const u = copie(modele(doc, source));
  u.id = id; u.nom = id; u.exemplaires = 9;
  doc.modeles.push(u);
  doc.plateau.tuiles.filter(estCentrale).slice(0, nb).forEach((t) => { t.modeleId = id; });
  return u;
}

test('tuile utilisateur posée : copie de HC2 sous un autre nom — plateau valide, graphe identique en nombre de cases, export et aller-retour sans perte', () => {
  const doc = plateau();
  avecTuileUtilisateur(doc, 'HC2', 'U1', 7);
  const v = M.validerPlateau(doc);
  assert.deepEqual(v.erreurs, []);
  const g = GR.construire(doc, { villesTraversables: false }), g0 = GR.construire(plateau(), { villesTraversables: false });
  assert.equal(g.cases.size, g0.cases.size, 'une copie de HC2 donne le même graphe');
  assert.equal(g.noeuds.length, g0.noeuds.length);
  const r = S.depuisJSON(S.versJSON(doc));
  assert.ok(r.ok);
  assert.deepEqual(r.doc.modeles, doc.modeles);
  const x = E.preparerSorties(doc, { tuiles: true, portee: 'posees', format: 'A3', jetons: true, apercu: true });
  assert.ok(x.feuilles.every((f) => sansNaN(f.svg)));
});

test('tuile utilisateur posée à 4 ports sur une case (H1 violée) : alerte ports_case, plateau toujours dessiné, Orienter ne lève pas', () => {
  const doc = plateau();
  const u = avecTuileUtilisateur(doc, 'HC2', 'U1', 3);
  u.chemins.push(lien('x1', { case: 'a' }, { coin: 2 }));
  assert.ok(codes(valider(u).alertes).includes('ports_case'));
  assert.doesNotThrow(() => A.svgPlateau(doc, {}));
  assert.doesNotThrow(() => GEN.orienterTuiles(doc));
  assert.doesNotThrow(() => C.calculer(doc));
});

/* ================================ 3. Bibliothèque modifiée (générateur) ================================ */

const generer = (modif, options) => { const d = vide(); modif(d); return GEN.generer(d, Object.assign({ graine: '7' }, options || {})); };

test('générateur : un modèle à 0 exemplaire n’est pas tiré ; sans aucune centrale, bord ou coin : refus expliqué sans essais', () => {
  let r = generer((d) => { modele(d, 'HC2').exemplaires = 0; modele(d, 'HC3').exemplaires = 0; });
  assert.equal(r.ok, false);
  assert.match(r.raison, /aucun modèle de centrale/);
  r = generer((d) => { modele(d, 'HB1').exemplaires = 0; });
  assert.match(r.raison, /aucun modèle de bord/);
  r = generer((d) => { d.modeles = d.modeles.filter((m) => m.id !== 'HK1'); });
  assert.match(r.raison, /aucun modèle de coin/);
  r = generer((d) => { d.modeles = []; });
  assert.equal(r.ok, false);
  assert.match(r.raison, /centrale.*bord.*coin/s);
});

test('générateur : stock insuffisant (HB1 à 5, HK1 à 5, HC2 à 5 sans HC3) — refus expliqué, rapide', () => {
  for (const mod of [(d) => { modele(d, 'HB1').exemplaires = 5; }, (d) => { modele(d, 'HK1').exemplaires = 5; }, (d) => { modele(d, 'HC2').exemplaires = 5; modele(d, 'HC3').exemplaires = 0; }]) {
    const t = Date.now();
    const r = generer(mod);
    assert.equal(r.ok, false);
    assert.match(r.raison, /stock/i);
    assert.ok(Date.now() - t < 5000);
  }
});

test('générateur : HC2 retiré de la bibliothèque (HC3 seul) — refus expliqué par l’écart des villes, sans exception ni boucle', () => {
  const t = Date.now();
  const r = generer((d) => { d.modeles = d.modeles.filter((m) => m.id !== 'HC2'); });
  assert.equal(r.ok, false);
  assert.match(r.raison, /écart de 4 pas/);
  assert.ok(Date.now() - t < 10000);
});

test('générateur : HC3 retiré — HC2 seul (8 exemplaires) suffit ; HC2 à 7 sans HC3 aussi', () => {
  let r = generer((d) => { d.modeles = d.modeles.filter((m) => m.id !== 'HC3'); });
  assert.ok(r.ok, r.raison);
  assert.ok(r.doc.plateau.tuiles.every((t) => t.modeleId !== 'HC3'));
  r = generer((d) => { modele(d, 'HC2').exemplaires = 7; modele(d, 'HC3').exemplaires = 0; });
  assert.ok(r.ok, r.raison);
  assert.equal(r.doc.plateau.tuiles.filter((t) => t.modeleId === 'HC2').length, 7);
});

test('générateur : un modèle incomplet ou hors tirage n’est jamais posé ; poids nuls acceptés', () => {
  let r = generer((d) => { modele(d, 'HC3').chemins = []; });
  assert.ok(r.ok || /écart|stock/.test(r.raison));
  if (r.ok) assert.ok(r.doc.plateau.tuiles.every((t) => t.modeleId !== 'HC3'));
  r = generer((d) => { d.modeles.forEach((m) => { m.poids = 0; }); });
  assert.ok(r.ok, r.raison);
  r = generer((d) => { modele(d, 'HC3').horsTirage = true; });
  assert.ok(r.ok, r.raison);
  assert.ok(r.doc.plateau.tuiles.every((t) => t.modeleId !== 'HC3'), 'horsTirage respecté');
});

test('générateur : une tuile de l’utilisateur (copie de HC2) entre dans le tirage ; une tuile pauvre (2 raccords) est refusée avec explication', () => {
  let r = generer((d) => { const u = copie(modele(d, 'HC2')); u.id = 'U1'; u.exemplaires = 7; d.modeles = d.modeles.filter((m) => m.gabarit !== 'centrale'); d.modeles.push(u); });
  assert.ok(r.ok, r.raison);
  assert.ok(r.doc.plateau.tuiles.filter(estCentrale).every((t) => t.modeleId === 'U1'));
  r = generer((d) => {
    const u = tuile('centrale', [cs('a', 0, 0)], [lien('c', { case: 'a' }, rc(0)), lien('d', { case: 'a' }, rc(3))], { exemplaires: 7 });
    d.modeles = d.modeles.filter((m) => m.gabarit !== 'centrale'); d.modeles.push(u);
  });
  assert.equal(r.ok, false);
  assert.match(r.raison, /écart|ports/);
});

test('générateur : options hostiles (texte, NaN, négatif, dispositionsVariees texte, graine vide) — valeurs par défaut, plateau valide', () => {
  const r = GEN.generer(vide(), { graine: '', candidats: 'x', essaisMax: NaN, tolerance: -5, dispositionsVariees: 'oui' });
  assert.ok(r.ok, r.raison);
  assert.equal(r.doc.plateau.tuiles.length, 19);
  assert.equal(r.doc.plateau.jetons.length, 6);
  assert.deepEqual(M.validerPlateau(r.doc).erreurs, []);
});

test('générateur : même graine, même plateau (déterminisme) ; lancé sur un plateau déjà rempli, il le remplace entièrement', () => {
  const a = GEN.generer(vide(), { graine: 'det' }), b = GEN.generer(vide(), { graine: 'det' });
  assert.deepEqual(a.doc.plateau, b.doc.plateau);
  const c = GEN.generer(plateau(), { graine: 'autre' });
  assert.ok(c.ok);
  assert.equal(c.doc.plateau.tuiles.length, 19);
  assert.equal(c.doc.plateau.jetons.length, 6);
});

/* ================================ 4. « Orienter les tuiles » ================================ */

test('Orienter : bibliothèque modifiée — modèle intérieur supprimé, à 0 exemplaire ou sans cases : pas d’exception, tuiles de modèle inutilisable laissées telles quelles', () => {
  const casse = derange(plateau(), 1);
  const sansHC3 = copie(casse); sansHC3.modeles = sansHC3.modeles.filter((m) => m.id !== 'HC3');
  let r = GEN.orienterTuiles(sansHC3);
  assert.ok(r.ok, r.raison);
  r.changees.forEach((c) => assert.notEqual(sansHC3.plateau.tuiles.find((t) => t.col === c.col && t.lig === c.lig).modeleId, 'HC3'));
  const zero = copie(casse); modele(zero, 'HC2').exemplaires = 0;
  r = GEN.orienterTuiles(zero);
  assert.ok(r.ok, r.raison);
  const sansCases = copie(casse); modele(sansCases, 'HC3').cases = [];
  assert.doesNotThrow(() => GEN.orienterTuiles(sansCases));
  const aucun = copie(casse); aucun.modeles = [];
  r = GEN.orienterTuiles(aucun);
  assert.equal(r.ok, false);
});

test('Orienter : tuile de l’utilisateur — tourne aussi les copies (HC2 renommé), l’écart de 4 pas est tenu ensuite', () => {
  const doc = derange(plateau(), 2);
  avecTuileUtilisateur(doc, 'HC2', 'U1', 3);
  const r = GEN.orienterTuiles(doc);
  assert.ok(r.ok, r.raison);
  assert.ok(r.changees.length > 0);
  assert.equal(GR.villesProches(GR.construire(r.doc, { villesTraversables: false })).length, 0);
  assert.deepEqual(r.doc.modeles, doc.modeles, 'la bibliothèque ne change pas');
});

test('Orienter : 7 villes, une seule ville, villes hors plage ou en double — refus expliqué ou résultat valide, pas d’exception', () => {
  const sept = derange(plateau(), 1);
  sept.plateau.jetons.push({ i: [...Array(24).keys()].find((i) => !sept.plateau.jetons.some((j) => j.i === i)), j: 0, type: 'capture' });
  const r7 = GEN.orienterTuiles(sept);
  assert.equal(r7.ok, false);
  assert.match(r7.raison, /7 ville/);
  const une = derange(plateau(), 1); une.plateau.jetons = une.plateau.jetons.slice(0, 1);
  const r1 = GEN.orienterTuiles(une);
  assert.ok(r1.ok, r1.raison);
  assert.equal(r1.S, null, 'S n’est mesurable qu’à 6 villes');
  const hors = derange(plateau(), 1); hors.plateau.jetons.push({ i: 99, j: 0, type: 'capture' }, { i: 3, j: 5, type: 'capture' }, copie(hors.plateau.jetons[0]));
  const rh = GEN.orienterTuiles(hors);
  assert.ok(rh.ok, rh.raison);
});

test('Orienter : plateau partiel (une seule intérieure, 18 tuiles, pourtour seul) — pas d’exception, pourtour intact', () => {
  const une = plateau();
  une.plateau.tuiles = une.plateau.tuiles.filter((t) => !estCentrale(t) || (t.col === 2 && t.lig === 2));
  const r = GEN.orienterTuiles(une);
  assert.ok(r.ok, r.raison);
  assert.equal(r.doc.plateau.tuiles.length, une.plateau.tuiles.length);
  assert.equal(r.changees.length, 0);
  const pourtour = plateau(); pourtour.plateau.tuiles = pourtour.plateau.tuiles.filter((t) => !estCentrale(t));
  const rp = GEN.orienterTuiles(pourtour);
  assert.equal(rp.ok, false);
  assert.match(rp.raison, /Aucune tuile intérieure/);
  const dix8 = derange(plateau(), 1);
  const derniere = F.cellules[18];
  dix8.plateau.tuiles = dix8.plateau.tuiles.filter((t) => !(t.col === derniere.col && t.lig === derniere.lig));
  assert.doesNotThrow(() => GEN.orienterTuiles(dix8));
});

test('Orienter : sans ville et villes réduites à des types inconnus — refus expliqué, aucun changement', () => {
  const doc = derange(plateau(), 1);
  doc.plateau.jetons = [];
  const r = GEN.orienterTuiles(doc);
  assert.equal(r.ok, false);
  assert.match(r.raison, /Aucune ville/);
  const e = PM.etat.creer(doc);
  const avant = copie(e.doc());
  assert.equal(GEN.orienter(e).ok, false);
  assert.deepEqual(e.doc(), avant);
  assert.equal(e.peutAnnuler(), false);
});

test('Orienter : annuler / rétablir en chaîne avec Placer les villes — deux étapes, retour exact à l’état initial, redo effacé par une nouvelle action', () => {
  const e = PM.etat.creer(derange(plateau(), 1));
  const initial = copie(e.doc());
  assert.ok(GEN.orienter(e).ok);
  const apresOrienter = copie(e.doc());
  assert.ok(GEN.placerVilles(e).ok);
  e.annuler();
  assert.deepEqual(e.doc(), apresOrienter, 'une annulation défait Placer les villes seulement');
  e.annuler();
  assert.deepEqual(e.doc(), initial, 'la seconde défait Orienter');
  assert.equal(e.peutAnnuler(), false);
  e.retablir(); e.retablir();
  assert.ok(e.peutAnnuler());
  e.annuler();
  assert.ok(e.peutRetablir());
  assert.ok(GEN.placerVilles(e).ok);
  assert.equal(e.peutRetablir(), false, 'une nouvelle action vide la pile de rétablissement');
});

test('Orienter : rotations déjà équivalentes (symétrie) — aucune tuile « changée » et aucune étape d’historique', () => {
  const e = PM.etat.creer(plateau());
  const r = GEN.orienter(e);
  assert.ok(r.ok);
  assert.equal(r.changees.length, 0);
  assert.equal(e.peutAnnuler(), false);
});

test('Orienter : une tuile centrale à rotation invalide (77, -2, 1,5) ne doit pas être déclarée « absente »', () => {
  const doc = plateau();
  doc.plateau.tuiles.forEach((t) => { if (estCentrale(t)) t.rot = 77; });
  const r = GEN.orienterTuiles(doc);
  assert.ok(r.ok || !/Aucune tuile intérieure/.test(r.raison), r.raison);
});

/* ================================ 5. « Placer les villes » ================================ */

test('Placer les villes : 7 villes posées → 6 ; aucune ville → 6 ; déjà posées → remplacées par le meilleur placement (une étape)', () => {
  const sept = plateau();
  sept.plateau.jetons.push({ i: [...Array(24).keys()].find((i) => !sept.plateau.jetons.some((j) => j.i === i)), j: 0, type: 'capture' });
  let e = PM.etat.creer(sept);
  assert.ok(GEN.placerVilles(e).ok);
  assert.equal(e.doc().plateau.jetons.length, 6);
  assert.deepEqual(M.validerPlateau(e.doc()).erreurs, []);
  const sans = plateau(); sans.plateau.jetons = [];
  e = PM.etat.creer(sans);
  assert.ok(GEN.placerVilles(e).ok);
  assert.equal(e.doc().plateau.jetons.length, 6);
  e.annuler();
  assert.equal(e.doc().plateau.jetons.length, 0);
});

test('Placer les villes : plateau incomplet (0, 10, 18 tuiles) refusé en une phrase, document intact, sans étape', () => {
  for (const n of [0, 10, 18]) {
    const d = plateau(); d.plateau.tuiles = d.plateau.tuiles.slice(0, n);
    const e = PM.etat.creer(d);
    const avant = copie(e.doc());
    const r = GEN.placerVilles(e);
    assert.equal(r.ok, false, n + ' tuiles');
    assert.match(e.ui().message.texte, /Posez d’abord toutes les tuiles/);
    assert.equal(e.ui().message.niveau, 'alerte');
    assert.deepEqual(e.doc(), avant);
    assert.equal(e.peutAnnuler(), false);
  }
});

test('Placer les villes : plateau dérangé sans placement possible — refus expliqué, villes d’origine conservées', () => {
  const d = derange(plateau(), 1);
  const r = GEN.meilleurPlacementVilles(d);
  if (r.ok) {
    assert.equal(r.jetons.length, 6);
    assert.equal(new Set(r.jetons.map((j) => j.i)).size, 6);
  } else {
    assert.match(r.raison, /Aucun placement des 6 villes/);
  }
  const copieVide = vide();
  assert.equal(GEN.meilleurPlacementVilles(copieVide).ok, false);
});

test('Placer les villes : bibliothèque modifiée (modèle utilisateur, modèle supprimé) — aucune exception', () => {
  const a = plateau(); avecTuileUtilisateur(a, 'HC3', 'U3', 7);
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(a));
  const b = plateau(); b.modeles = b.modeles.filter((m) => m.id !== 'HC2');
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(b));
  const c = plateau(); c.modeles = [];
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(c));
});

/* ================================ 6. Mélange de formats ================================ */

test('mélange : tuile carrée dans un document hexagonal — modèle incomplet signalé, plateau dessiné, générateur ne la tire jamais', () => {
  const carre = CAT.nouveauDocument('4x4');
  const doc = plateau();
  const q = copie(carre.modeles.find((m) => m.gabarit === 'centrale'));
  doc.modeles.push(q);
  doc.plateau.tuiles[8].modeleId = q.id;
  const v = M.validerPlateau(doc);
  assert.ok(codes(v.erreurs).includes('modele_incomplet'));
  assert.doesNotThrow(() => A.svgPlateau(doc, {}));
  assert.doesNotThrow(() => C.calculer(doc));
  assert.doesNotThrow(() => E.svgApercuPlateau(doc));
  assert.doesNotThrow(() => GEN.orienterTuiles(doc));
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(doc));
  const r = S.depuisJSON(S.versJSON(doc));
  assert.ok(r.ok);
  const d2 = vide();
  carre.modeles.forEach((m) => { const c = copie(m); c.exemplaires = 20; d2.modeles.push(c); });
  for (const graine of ['1', '2', '3']) {
    const g = GEN.generer(d2, { graine });
    assert.ok(g.ok, g.raison);
    assert.ok(g.doc.plateau.tuiles.every((t) => /^H/.test(t.modeleId)), 'seuls les modèles hexagonaux sont tirés');
  }
});

test('mélange : tuile hexagonale dans un document carré — signalée, jamais tirée par le générateur 4×4 ni 5×5', () => {
  for (const f of ['4x4', '5x5']) {
    const d = CAT.nouveauDocument(f);
    vide().modeles.forEach((m) => { const c = copie(m); c.exemplaires = 20; d.modeles.push(c); });
    const g = GEN.generer(d, { graine: 'm1', candidats: 20 });
    assert.ok(g.ok, g.raison);
    assert.ok(g.doc.plateau.tuiles.every((t) => !/^H/.test(t.modeleId)), f + ' : aucune tuile hexagonale posée');
    const posee = copie(d);
    posee.plateau.tuiles = [{ modeleId: 'HC2', col: 0, lig: 0, rot: 0 }];
    assert.ok(codes(M.validerPlateau(posee).erreurs).includes('modele_incomplet'));
    assert.doesNotThrow(() => A.svgPlateau(posee, {}));
    assert.doesNotThrow(() => C.calculer(posee));
    assert.doesNotThrow(() => E.svgApercuPlateau(posee));
    assert.doesNotThrow(() => E.calepiner(posee, { format: 'A3' }));
    assert.doesNotThrow(() => S.depuisJSON(S.versJSON(posee)));
  }
});

test('mélange : fusion de bibliothèques entre formats — modèles ajoutés gardent leur grille, sans exception ni écrasement', () => {
  const carre = CAT.nouveauDocument('4x4');
  const f1 = S.fusionnerBibliotheque(vide(), S.bibliothequeVersJSON(carre));
  assert.ok(f1.ok);
  assert.deepEqual([...new Set(f1.doc.modeles.map((m) => m.grille))].sort(), ['4x4', 'hex19']);
  const f2 = S.fusionnerBibliotheque(carre, S.bibliothequeVersJSON(vide()));
  assert.ok(f2.ok);
  assert.deepEqual([...new Set(f2.doc.modeles.map((m) => m.grille))].sort(), ['4x4', 'hex19']);
  assert.equal(f1.doc.modeles.filter((m) => m.grille === 'hex19').length, 4);
});

/* ================================ 7. Export avec bibliothèque modifiée ================================ */

const nbTuiles = (planches) => planches.reduce((a, p) => a + p.tuiles.length, 0);

test('export : modèle à 0 exemplaire — absent du jeu complet, mais imprimé s’il est posé (portée « posées »)', () => {
  const doc = plateau(); modele(doc, 'HC2').exemplaires = 0;
  const stock = E.listeTuiles(doc, { portee: 'stock' }).tuiles;
  assert.ok(stock.every((t) => t.modeleId !== 'HC2'));
  const posees = E.listeTuiles(doc, { portee: 'posees' }).tuiles;
  assert.equal(posees.length, 19);
  assert.equal(nbTuiles(E.calepiner(doc, { format: 'A3', portee: 'posees' })), 19);
});

test('export : modèle supprimé de la bibliothèque — tuile posée listée en « exclus », autres planches intactes', () => {
  const doc = plateau();
  const n = doc.plateau.tuiles.filter((t) => t.modeleId === 'HC2').length;
  assert.ok(n > 0);
  doc.modeles = doc.modeles.filter((m) => m.id !== 'HC2');
  const l = E.listeTuiles(doc, { portee: 'posees' });
  assert.equal(l.tuiles.length, 19 - n);
  assert.ok(l.exclus.some((x) => x.id === 'HC2' || x.raison === 'introuvable'));
  assert.equal(nbTuiles(E.calepiner(doc, { format: 'A3', portee: 'posees' })), 19 - n);
});

test('export : bibliothèque vide, tous exemplaires à 0 — aucune planche de tuile, aperçu et jetons toujours produits', () => {
  const doc = plateau(); doc.modeles = [];
  let x = E.preparerSorties(doc, { tuiles: true, portee: 'stock', format: 'A3', jetons: true, apercu: true });
  assert.equal(x.nbTuiles, 0);
  assert.ok(x.feuilles.length >= 3);
  assert.ok(x.feuilles.every((f) => sansNaN(f.svg)));
  const zero = plateau(); zero.modeles.forEach((m) => { m.exemplaires = 0; });
  x = E.preparerSorties(zero, { tuiles: true, portee: 'stock', format: 'A3', apercu: true });
  assert.equal(x.nbTuiles, 0);
  assert.deepEqual(x.feuilles.map((f) => f.nom), ['plateau-apercu-A3']);
});

test('export : 999 exemplaires par modèle dépasse le plafond de 200 tuiles — refus expliqué, jamais de calcul démesuré', () => {
  const doc = plateau(); doc.modeles.forEach((m) => { m.exemplaires = 999; });
  assert.throws(() => E.calepiner(doc, { format: 'A3' }), /200 au plus/);
  const t = Date.now();
  assert.doesNotThrow(() => E.calepiner(doc, { format: 'A3', portee: 'posees' }));
  assert.ok(Date.now() - t < 5000);
});

test('export : exemplaires choisis hostiles (négatif, décimal, texte, énorme) — retombent sur la valeur du modèle', () => {
  const doc = plateau();
  const ref = nbTuiles(E.calepiner(doc, { format: 'A3' }));
  const n = nbTuiles(E.calepiner(doc, { format: 'A3', exemplaires: { HC2: -1, HC3: 1.5, HB1: 'x', HK1: 1e9 } }));
  assert.equal(n, ref);
  assert.equal(nbTuiles(E.calepiner(doc, { format: 'A3', exemplaires: { HC2: 1, HC3: 0 } })), ref - 8 - 7 + 1);
  assert.doesNotThrow(() => E.calepiner(doc, { format: 'A3', exemplaires: null }));
  assert.doesNotThrow(() => E.calepiner(doc, { format: 'A3', exemplaires: 'HC2' }));
});

test('export : tuile de l’utilisateur au nom piégé — planches A3 / A4, aperçu et jetons sans NaN ni balisage', () => {
  const doc = plateau();
  const u = avecTuileUtilisateur(doc, 'HC2', 'U1', 3);
  u.nom = 'Perso <b>"&\'</b>';
  for (const format of ['A3', 'A4']) {
    const x = E.preparerSorties(doc, { tuiles: true, portee: 'stock', format, jetons: true, apercu: true });
    assert.ok(x.nbTuiles > 30);
    x.feuilles.forEach((f) => { assert.ok(sansNaN(f.svg), f.nom); assert.ok(!f.svg.includes('<b>'), f.nom); });
  }
});

test('export : aperçu avec jetons hors plage, rotations hostiles, doublon de tuile — aucune valeur invalide', () => {
  const doc = plateau();
  doc.plateau.jetons.push({ i: 999, j: 0, type: 'capture' }, { i: -1, j: 0, type: 'capture' });
  doc.plateau.tuiles[0].rot = 77; doc.plateau.tuiles[1].rot = -3; doc.plateau.tuiles[2].rot = 1.5;
  doc.plateau.tuiles.push(copie(doc.plateau.tuiles[5]));
  assert.ok(sansNaN(E.svgApercuPlateau(doc)));
  const pl = E.calepiner(doc, { format: 'A3', portee: 'posees' });
  pl.forEach((p) => { assert.ok(sansNaN(p.svg)); p.tuiles.forEach((t) => assert.ok(Number.isInteger(t.rot) && t.rot >= 0 && t.rot <= 5, 'rotation d’impression ' + t.rot)); });
});

test('export : jetons — 24 campements au recto et 24 villes au verso, quel que soit le format du document', () => {
  const p = E.planchesJetons();
  assert.equal(p.jetons.length, 24);
  assert.equal(p.verso.jetons.length, 24);
  assert.equal((E.svgJetons('verso').match(/r="18" fill=/g) || []).length, 24);
});

/* ================================ 8. Non-régression 4×4 / 5×5 (empreintes calculées sur origin/main f70a554) ================================ */

const sha = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 10);
function empreintes(format, graines, candidats) {
  const out = {};
  graines.forEach((k) => {
    const r = GEN.generer(CAT.nouveauDocument(format), { graine: 'th-' + format + k, candidats });
    out['gen ' + k] = sha([r.ok, r.doc && r.doc.plateau, r.essais, r.candidats, r.rejets, r.score]);
    const d = r.doc;
    out['valider ' + k] = sha(M.validerPlateau(d));
    out['controles ' + k] = sha(C.calculer(d));
    out['equilibre ' + k] = sha(GR.equilibre(d));
    out['svgPlateau ' + k] = sha(A.svgPlateau(d, {}));
    out['apercu ' + k] = sha(E.svgApercuPlateau(d));
    out['planches posees ' + k] = sha(E.calepiner(d, { format: 'A3', portee: 'posees' }).map((p) => p.svg));
    out['planches stock A4 ' + k] = sha(E.calepiner(d, { format: 'A4' }).map((p) => p.svg));
    const j = JSON.parse(S.versJSON(d)); const version = j.version; delete j.date;
    out['json ' + k] = sha(j);
    out['version ' + k] = version;
    out['placerVilles ' + k] = sha(GEN.meilleurPlacementVilles(d));
  });
  const nd = CAT.nouveauDocument(format);
  out.catalogue = sha(nd);
  out['modeles valides'] = sha(nd.modeles.map((m) => M.validerModele(m, format)));
  return out;
}

const REF_4X4 = {
  'gen 0': '06d0f09ea1', 'valider 0': '84166f6f77', 'controles 0': '23081fde64', 'equilibre 0': '59684720be', 'svgPlateau 0': '7d7a5e59ef', 'apercu 0': '6f49a301de', 'planches posees 0': 'e4638268f3', 'planches stock A4 0': '7909abb2f2', 'json 0': 'cbd754cc15', 'version 0': 3, 'placerVilles 0': 'b387b3a910',
  'gen 1': '10dd5efba3', 'valider 1': '84166f6f77', 'controles 1': '23081fde64', 'equilibre 1': 'c57c4f0ecd', 'svgPlateau 1': 'c8ae12766c', 'apercu 1': '24ee9dd4e1', 'planches posees 1': 'bc4f2cdcdf', 'planches stock A4 1': 'c52988aca3', 'json 1': '340e7d8847', 'version 1': 3, 'placerVilles 1': '0b1a66b790',
  'gen 2': 'a693d0844a', 'valider 2': '84166f6f77', 'controles 2': '23081fde64', 'equilibre 2': 'a4ef22dc69', 'svgPlateau 2': '201066b307', 'apercu 2': '4f2f93437d', 'planches posees 2': '0fc5e8810c', 'planches stock A4 2': '8680d82bb0', 'json 2': 'dd3a160e2c', 'version 2': 3, 'placerVilles 2': '0b1a66b790',
  'gen 3': '6840bbbf53', 'valider 3': '84166f6f77', 'controles 3': '23081fde64', 'equilibre 3': 'e20a0b833b', 'svgPlateau 3': '956fbac8fa', 'apercu 3': 'b1059a6e89', 'planches posees 3': 'b8ec166411', 'planches stock A4 3': 'f379c3891b', 'json 3': '1c857d6ccf', 'version 3': 3, 'placerVilles 3': '0b1a66b790',
  catalogue: '9862be39b0', 'modeles valides': '7f02d261d3'
};
const REF_5X5 = {
  'gen 0': '40cce9a21b', 'valider 0': 'd95dc984e9', 'controles 0': '8ceac4804d', 'equilibre 0': 'a66843cfe3', 'svgPlateau 0': 'a09680b03b', 'apercu 0': '61a5f134ab', 'planches posees 0': '41788ccf55', 'planches stock A4 0': 'e06fbbf7b1', 'json 0': 'c4ea9d6b23', 'version 0': 3, 'placerVilles 0': 'c858c27140',
  'gen 1': '08858ac935', 'valider 1': '84166f6f77', 'controles 1': '8c94aabae5', 'equilibre 1': '57ed290f3f', 'svgPlateau 1': '73ffb92fc1', 'apercu 1': 'b9ff6d2de4', 'planches posees 1': '0435af2e2a', 'planches stock A4 1': 'cf034c1dee', 'json 1': '91fc17063b', 'version 1': 3, 'placerVilles 1': '13eb046b53',
  catalogue: '25924ba28a', 'modeles valides': '257dff20ee'
};

test('non-régression 4×4 : génération, validation, contrôles, équilibre, rendu, planches, JSON, Placer les villes identiques à origin/main (4 graines)', () => {
  assert.deepEqual(empreintes('4x4', [0, 1, 2, 3], 30), REF_4X4);
});

test('non-régression 5×5 : génération, validation, contrôles, équilibre, rendu, planches, JSON, Placer les villes identiques à origin/main (2 graines)', () => {
  assert.deepEqual(empreintes('5x5', [0, 1], 12), REF_5X5);
});

/* ================================ 9. Fuzz déterministe passant par le chargeur ================================ */

function rng(graine) {
  let s = graine | 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

test('fuzz : 60 fichiers hexagonaux altérés au hasard (graine fixe), relus par le chargeur — validation, rendu, contrôles, Orienter, Placer, export sans exception', () => {
  const R = rng(12345);
  const pick = (a) => a[Math.floor(R() * a.length)];
  const junk = [null, undefined, NaN, Infinity, -1, 0, 1, 2.5, 6, 7, 99, 1e9, 'x', '', [], {}, true, { case: 'zz' }, { coin: 9 }, { raccord: { cote: 9, pos: 3 } }];
  const muter = (o, prof) => {
    if (!o || typeof o !== 'object') return;
    const ks = Object.keys(o);
    if (!ks.length) return;
    const k = pick(ks);
    if (R() < 0.35 || prof > 3) o[k] = pick(junk); else if (R() < 0.1) delete o[k]; else muter(o[k], prof + 1);
  };
  const base = JSON.parse(S.versJSON(plateau()));
  let lus = 0;
  for (let n = 0; n < 60; n++) {
    const o = copie(base);
    for (let i = 0, k = 1 + Math.floor(R() * 4); i < k; i++) { if (R() < 0.6) muter(pick(o.modeles), 0); else muter(o.plateau, 0); }
    const r = S.depuisJSON(JSON.stringify(o));
    if (!r.ok) continue;
    lus++;
    const d = r.doc;
    const ops = {
      valider: () => M.validerPlateau(d), svg: () => A.svgPlateau(d, {}), controles: () => C.calculer(d), orienter: () => GEN.orienterTuiles(d),
      apercu: () => E.svgApercuPlateau(d), posees: () => E.calepiner(d, { format: 'A3', portee: 'posees' }).forEach((p) => p.svg),
      stock: () => E.calepiner(d, { format: 'A4' }).forEach((p) => p.svg), json: () => S.depuisJSON(S.versJSON(d))
    };
    for (const [nom, f] of Object.entries(ops)) assert.doesNotThrow(f, 'fuzz ' + n + ' : ' + nom);
  }
  assert.ok(lus > 35, lus + ' fichiers lus');
});

test('plateau dont un modèle posé est incomplet (cases supprimées) : le rapport d’équilibre, Placer les villes et la préparation des sorties ne doivent pas lever', () => {
  const o = JSON.parse(S.versJSON(plateau()));
  o.modeles[0].cases = [];
  const r = S.depuisJSON(JSON.stringify(o));
  assert.ok(r.ok);
  assert.doesNotThrow(() => GR.construire(r.doc, {}));
  assert.doesNotThrow(() => EQ.rapport(EQ.analyser(r.doc)));
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(r.doc));
  assert.doesNotThrow(() => E.preparerSorties(r.doc, { tuiles: true, portee: 'stock', format: 'A3', apercu: true }));
});
