'use strict';
/*
 * Tests des murs voulus (docs/18, réponses du 2026-10-18 sur docs/56) : un raccord sans vis-à-vis qui fait face à un côté sans raccord
 * volontairement fermé d'une centrale (un « mur », comme « Deux ponts ») est une INFORMATION ; les autres raccords morts restent des
 * alertes. Les murs sont DÉCLARÉS seulement (docs/57, arbitrage) : champ `murs` du modèle (côtés 0 N, 1 E, 2 S, 3 O, ceux qui n'ont
 * aucun raccord), sans détection par défaut ; « Deux ponts » déclare `murs: [1, 3]`, un ancien document (« Étoile fermée » de la 3.04)
 * garde ses alertes. Aussi : « Placer les villes » à l'état en 4×4 et en 5×5 (docs/18, réponse 4).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/etat.js');
require('../src/sauvegarde.js');
require('../src/graphe.js');
require('../src/generateur.js');
require('../src/controles.js');
require('../src/assemblage.js');
require('../src/catalogue.js');
const PM = globalThis.PM;
const M = PM.modele, CAT = PM.catalogue;
const C5 = CAT.modelesParGrille['5x5'], C4 = CAT.modelesParGrille['4x4'];
const copie = (o) => JSON.parse(JSON.stringify(o));
const lc = (id) => C5.find((m) => m.id === id);

/** Plateau 5×5 partiel : X au centre (2, 2) de rotation `rot`, LC1 sur les quatre cases voisines (ou celles données). */
function plateauX(x, rot, voisins) {
  const doc = CAT.nouveauDocument('5x5');
  doc.modeles.push(x);
  doc.plateau.tuiles = [{ modeleId: x.id, col: 2, lig: 2, rot: rot || 0 }].concat((voisins || [[1, 2], [3, 2], [2, 1], [2, 3]]).map(([col, lig]) => ({ modeleId: 'LC1', col, lig, rot: 0 })));
  return doc;
}
/** Copie de « Deux ponts » SANS le champ `murs` (sauf si `champs` le donne). */
const variante = (id, champs) => { const m = copie(lc('LC4')); delete m.murs; return Object.assign(m, { id, exemplaires: 1 }, champs || {}); };
const morts = (doc) => M.raccordsMorts(doc).filter((r) => r.raison !== 'absent');
const resume = (doc) => morts(doc).map((r) => [r.col, r.lig, r.cote, r.mur]);

test('mursDuModele : « Deux ponts » déclare `murs: [1, 3]` (côtés E et O fermés) ; aucune autre tuile du catalogue 5×5 ni du 4×4 n\'a de mur', () => {
  assert.deepEqual(lc('LC4').murs, [1, 3]);
  assert.equal(M.mursDuModele(lc('LC4')), 0b1010);
  for (const m of C5.concat(C4)) if (m.id !== 'LC4') assert.equal(M.mursDuModele(m), 0, m.id);
  assert.equal(M.mursDuModele(null), 0);
  assert.equal(M.mursDuModele({}), 0);
});

test('mursDuModele : le champ `murs` prime ; un côté qui porte un raccord n\'est jamais un mur ; `murs: []` = aucun mur ; bord : seulement si le champ le désigne', () => {
  assert.equal(M.mursDuModele(variante('a', { murs: [] })), 0);
  assert.equal(M.mursDuModele(variante('b', { murs: [1] })), 0b0010);
  assert.equal(M.mursDuModele(variante('c', { murs: [0, 1, 3, 7, 'x', 1.5] })), 0b1010, 'N porte un raccord : ignoré ; valeurs invalides ignorées');
  const bord = copie(lc('LB2'));
  assert.equal(M.mursDuModele(bord), 0, 'le côté nord d\'un bord est le pourtour, pas un mur');
  bord.murs = [0];
  assert.equal(M.mursDuModele(bord), 0b0001);
  // sans le champ : plus aucune détection par défaut, même pour une centrale qui porte des raccords (« Deux ponts » sans `murs`)
  assert.equal(M.mursDuModele(variante('d')), 0);
  const sans = variante('e'); sans.chemins = sans.chemins.filter((c) => c.b.raccord === undefined);
  assert.equal(M.mursDuModele(sans), 0);
  assert.equal(M.mursDuModele(Object.assign(copie(lc('LC1')), { murs: [0, 1, 2, 3] })), 0, 'un côté qui porte un raccord n\'est jamais un mur');
});

test('anciens documents sans champ `murs` (« Étoile fermée », C5 de la 3.04) : aucun mur, donc les raccords morts restent des alertes', () => {
  const c5 = copie(CAT.precedent['4x4'].find((m) => m.id === 'C5'));
  assert.equal('murs' in c5, false);
  assert.equal(M.mursDuModele(c5), 0);
  const doc = CAT.nouveauDocument('4x4');
  doc.modeles.push(c5);
  // C5 en (1, 1), un bord voisin dont le raccord fait face à un côté sans raccord de C5 : raccord mort, pas un mur voulu
  const faits = [];
  for (const [col, lig] of [[0, 1], [2, 1], [1, 0], [1, 2]]) {
    for (let rot = 0; rot < 4; rot++) {
      const d = copie(doc);
      d.plateau.tuiles = [{ modeleId: 'C5', col: 1, lig: 1, rot: 0 }, { modeleId: 'B1', col, lig, rot }];
      faits.push(...M.raccordsMorts(d).filter((r) => r.raison === 'mort'));
      const v = M.validerPlateau(d);
      assert.deepEqual(v.informations, [], 'aucune information de mur');
      assert.ok(v.alertes.every((a) => a.code !== 'raccord_mur'));
    }
  }
  assert.ok(faits.length > 0 && faits.every((r) => r.mur === false), JSON.stringify(faits));
});

test('masquesTuilePosee : les murs suivent la rotation de la tuile', () => {
  const doc = plateauX(lc('LC4'), 1);
  assert.equal(M.masquesTuilePosee(doc, doc.plateau.tuiles[0]).murs, 0b0101, 'après un quart de tour horaire : murs N et S');
  assert.equal(M.masquesTuilePosee(doc, { modeleId: 'LC4', col: 0, lig: 0, rot: 0 }).murs, 0b1010);
  assert.equal(M.masquesTuilePosee(doc, { modeleId: 'absent', col: 0, lig: 0, rot: 0 }).murs, 0);
});

test('raccords face à un mur voulu : information `raccord_mur`, pas une alerte ; les autres raccords morts restent des alertes', () => {
  // « Deux ponts » : les voisines E et O ont un raccord mort face au mur
  const doc = plateauX(lc('LC4'), 0);
  assert.deepEqual(resume(doc), [[1, 2, 1, true], [3, 2, 3, true]]);
  let v = M.validerPlateau(doc);
  assert.deepEqual(v.alertes, [], 'les raccords des voisines N et S ont leur vis-à-vis');
  assert.deepEqual(v.informations.map((a) => [a.code, a.ref.col, a.ref.lig, a.ref.cote, a.ref.pos]), [['raccord_mur', 1, 2, 1, 1], ['raccord_mur', 3, 2, 3, 1]]);
  // champ `murs: []` : la même géométrie sans mur voulu : deux alertes
  v = M.validerPlateau(plateauX(variante('X', { murs: [] }), 0));
  assert.deepEqual(v.alertes.map((a) => a.code), ['raccord_mort', 'raccord_mort']);
  assert.deepEqual(v.informations, []);
  assert.deepEqual(resume(plateauX(variante('X', { murs: [] }), 0)), [[1, 2, 1, false], [3, 2, 3, false]]);
  // un seul mur déclaré (E) : la voisine de la tuile (3, 2) lui fait face (information), celle de (1, 2) donne une alerte
  v = M.validerPlateau(plateauX(variante('X', { murs: [1] }), 0));
  assert.deepEqual(v.alertes.map((a) => [a.code, a.ref.col]), [['raccord_mort', 1]]);
  assert.deepEqual(v.informations.map((a) => [a.code, a.ref.col]), [['raccord_mur', 3]]);
  // rotation : après un quart de tour, les murs sont au nord et au sud
  const r1 = plateauX(lc('LC4'), 1);
  assert.deepEqual(resume(r1), [[2, 1, 2, true], [2, 3, 0, true]]);
  assert.deepEqual(M.validerPlateau(r1).alertes, []);
  // la voisine absente (cellule non posée) : rien à signaler
  assert.deepEqual(resume(plateauX(lc('LC4'), 0, [[2, 1]])), []);
});

test('les autres raccords morts restent des alertes : face au vide, face au côté sans raccord d\'un bord (le pourtour n\'est pas un mur)', () => {
  const doc = CAT.nouveauDocument('5x5');
  doc.plateau.tuiles = [{ modeleId: 'LB2', col: 1, lig: 0, rot: 2 }];
  const v = M.validerPlateau(doc);
  assert.ok(v.alertes.some((a) => a.code === 'raccord_mort'));
  assert.ok(morts(doc).every((r) => r.raison === 'vide' && r.mur === false));
  assert.deepEqual(v.informations, []);
  // bord posé à l'envers au-dessus d'une centrale : son côté sans raccord est celui du pourtour, le raccord de la centrale qui lui fait face est une alerte
  const d2 = CAT.nouveauDocument('5x5');
  d2.plateau.tuiles = [{ modeleId: 'LB2', col: 2, lig: 1, rot: 2 }, { modeleId: 'LC1', col: 2, lig: 2, rot: 0 }];
  const m = morts(d2).filter((r) => r.col === 2 && r.lig === 2 && r.cote === 0);
  assert.ok(m.length >= 1 && m.every((r) => r.mur === false && r.raison === 'mort'), JSON.stringify(morts(d2)));
  assert.ok(M.validerPlateau(d2).alertes.some((a) => a.code === 'raccord_mort'));
  assert.deepEqual(M.validerPlateau(d2).informations, []);
});

test('4×4 aussi : sans le champ `murs`, un côté sans raccord est une alerte ; déclaré dans `murs`, c\'est un mur voulu (information)', () => {
  const doc = CAT.nouveauDocument('4x4');
  const q = copie(C4.find((m) => m.id === 'Q1'));
  q.id = 'Qm'; q.exemplaires = 1;
  q.chemins = q.chemins.filter((c) => !(c.b.raccord && c.b.raccord.cote === 3));
  if (q.passages) q.passages = q.passages.filter((p) => !((p.a.raccord && p.a.raccord.cote === 3) || (p.b.raccord && p.b.raccord.cote === 3)));
  doc.modeles.push(q);
  doc.plateau.tuiles = [{ modeleId: 'Qm', col: 1, lig: 1, rot: 0 }, { modeleId: 'B1', col: 0, lig: 1, rot: 3 }];
  assert.equal(M.mursDuModele(q), 0, 'rien n\'est déclaré : aucun mur');
  let faits = morts(doc).filter((r) => r.col === 0 && r.lig === 1 && r.cote === 1);
  assert.ok(faits.length >= 1 && faits.every((r) => r.mur === false && r.raison === 'mort'), JSON.stringify(morts(doc)));
  assert.ok(M.validerPlateau(doc).alertes.some((a) => a.code === 'raccord_mort'));
  assert.deepEqual(M.validerPlateau(doc).informations, []);
  // le côté O est déclaré mur voulu : le raccord de la voisine devient une information
  q.murs = [3];
  assert.equal(M.mursDuModele(q), 0b1000);
  faits = morts(doc).filter((r) => r.col === 0 && r.lig === 1 && r.cote === 1);
  assert.ok(faits.length >= 1 && faits.every((r) => r.mur === true && r.raison === 'mort'), JSON.stringify(morts(doc)));
  assert.ok(M.validerPlateau(doc).informations.some((i) => i.code === 'raccord_mur'));
});

test('PM.controles.calculer : informations hors des alertes, groupe de niveau `information` rangé en dernier, libellé explicite', () => {
  const doc = plateauX(lc('LC4'), 0);
  doc.plateau.tuiles.push({ modeleId: 'LB2', col: 0, lig: 0, rot: 0 }); // une vraie alerte en plus (bord dans un coin : hors de sa place)
  const r = PM.controles.calculer(doc);
  assert.deepEqual(r.informations.map((x) => [x.code, x.niveau]), [['raccord_mur', 'information'], ['raccord_mur', 'information']]);
  assert.ok(r.informations.every((x) => x.cible && x.cible.type === 'raccord'));
  assert.ok(r.alertes.length > 0 && r.alertes.every((x) => x.code !== 'raccord_mur'));
  const g = r.regroupees;
  assert.equal(g[g.length - 1].code, 'raccord_mur');
  assert.equal(g[g.length - 1].niveau, 'information');
  assert.equal(g[g.length - 1].nombre, 2);
  assert.match(g[g.length - 1].libelle, /mur voulu/);
  assert.ok(g.slice(0, -1).every((x) => x.niveau !== 'information'));
  // plateau sans autre alerte de raccord : seul le groupe d'information
  const seul = PM.controles.calculer(plateauX(lc('LC4'), 0));
  assert.deepEqual(seul.alertes.map((a) => a.code).filter((c) => c === 'raccord_mort'), []);
  assert.deepEqual(seul.regroupees.filter((x) => x.niveau === 'information').map((x) => x.code), ['raccord_mur']);
});

test('PM.assemblage.alertesPlateau : le raccord face à un mur voulu est marqué `mur`, les autres non', () => {
  const doc = plateauX(variante('X', { murs: [1] }), 0);
  const al = PM.assemblage.alertesPlateau(doc).filter((a) => a.type === 'raccord');
  assert.deepEqual(al.map((a) => [a.col, a.mur]), [[1, false], [3, true]]);
});

test('sauvegarde : `murs` est relu (côtés 0 à 3 sans doublon) ; sans champ, aucun mur (alertes)', () => {
  const S = PM.sauvegarde;
  const doc = plateauX(variante('X', { murs: [1, 1, 9, 3] }), 0);
  const r = S.depuisJSON(S.versJSON(doc));
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  assert.deepEqual(r.doc.modeles.find((m) => m.id === 'X').murs, [1, 3]);
  assert.equal(M.mursDuModele(r.doc.modeles.find((m) => m.id === 'X')), 0b1010);
  // « Deux ponts » du catalogue garde son champ à la relecture : 2 informations, aucune alerte
  const r2 = S.depuisJSON(S.versJSON(plateauX(lc('LC4'), 0)));
  assert.deepEqual(r2.doc.modeles.find((m) => m.id === 'LC4').murs, [1, 3]);
  assert.deepEqual(M.validerPlateau(r2.doc).alertes, []);
  assert.equal(M.validerPlateau(r2.doc).informations.length, 2);
  // le même modèle sans champ (document enregistré sans `murs`) : plus de mur, deux alertes
  const r3 = S.depuisJSON(S.versJSON(plateauX(variante('X'), 0)));
  assert.equal('murs' in r3.doc.modeles.find((m) => m.id === 'X'), false);
  assert.deepEqual(M.validerPlateau(r3.doc).alertes.map((a) => a.code), ['raccord_mort', 'raccord_mort']);
  assert.deepEqual(M.validerPlateau(r3.doc).informations, []);
});

test('« Placer les villes » à l\'état, en 4×4 comme en 5×5 : pose les 7 villes en une étape d\'historique (Ctrl+Z)', () => {
  const GEN = PM.generateur;
  for (const grille of ['4x4', '5x5']) {
    const r = GEN.generer(CAT.nouveauDocument(grille), { graine: 'murs-' + grille, candidats: 6 });
    assert.ok(r.ok, r.raison);
    const d = copie(r.doc); d.plateau.jetons = [];
    const etat = PM.etat.creer(d);
    const p = GEN.placerVilles(etat);
    assert.ok(p.ok, grille + ' : ' + p.raison);
    assert.equal(etat.doc().plateau.jetons.length, 7, grille);
    assert.deepEqual(etat.doc().plateau.jetons, p.jetons);
    assert.match(etat.ui().message.texte, /7 villes placées au meilleur placement/);
    etat.annuler();
    assert.equal(etat.doc().plateau.jetons.length, 0, grille);
  }
});

test('« Placer les villes » : le bouton du panneau est offert sans condition de format (aucune référence à la grille dans la construction des outils)', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'controles.js'), 'utf8');
  const debut = src.indexOf('var listeAVenir'), fin = src.indexOf('blocAVenir.appendChild(listeAVenir)');
  assert.ok(debut > 0 && fin > debut);
  const bloc = src.slice(debut, fin);
  assert.ok(bloc.includes("'Placer les villes'"), 'bouton déclaré dans la liste des outils');
  assert.ok(!/grille|5x5|4x4|formatDuDocument/.test(bloc), 'aucune condition de format dans la construction des boutons d\'outils');
});
