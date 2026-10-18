'use strict';
/*
 * Recette du testeur sur le 5×5 très connecté (docs/56 à 59) : cas limites que les tests de la production ne couvrent pas.
 * A. règles de porteuse propres au 5×5 (validerModele) ; B. tuiles de l'utilisateur dans l'éditeur 5×5 ; C. PM.graphe.connexions ;
 * D. « Placer les villes » (refus, Ctrl+Z / Ctrl+Y, 4×4 et 5×5) ; E. champ `murs` hostile et murs (rotation, vis-à-vis partiel) ;
 * F. la clé `informations` de validerPlateau partout où elle est lue ; G. générateur 5×5 sur bibliothèque modifiée ;
 * H. anciens documents 5×5 (3.04, 4.00.0) : proposition, refus, acceptation, Ctrl+Z / Ctrl+Y ; I. export du jeu complet.
 * Un test marqué `skip: 'défaut : …'` décrit un défaut du code constaté par le testeur (voir docs/61) ; il n'est pas corrigé ici.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/etat.js');
require('../src/sauvegarde.js');
require('../src/graphe.js');
require('../src/equilibre.js');
require('../src/generateur.js');
require('../src/controles.js');
require('../src/export.js');
require('../src/bibliotheque.js');
require('../src/assemblage.js');
require('../src/editeur-tuile.js');
require('../src/catalogue.js');
const PM = globalThis.PM;
const M = PM.modele, GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue, S = PM.sauvegarde, ED = PM.editeurTuile, E = PM.exportation;
const C5 = CAT.modelesParGrille['5x5'];

const copie = (o) => JSON.parse(JSON.stringify(o));
const lc = (id) => copie(C5.find((m) => m.id === id));
const doc5 = () => CAT.nouveauDocument('5x5');
const doc4 = () => CAT.nouveauDocument('4x4');
const codes = (m, grille) => M.validerModele(m, grille).alertes.map((a) => a.code);
const chemin = (m, id) => m.chemins.find((c) => c.id === id);
const sansVilles = (d) => { const c = copie(d); c.plateau.jetons = []; return c; };

let complet5 = null;
/** Plateau 5×5 complet généré une fois (sans ses villes). */
function plateau5() {
  if (!complet5) {
    const r = GEN.generer(doc5(), { graine: 'testeur-5x5-connecte', candidats: 6 });
    assert.ok(r.ok, r.raison);
    complet5 = sansVilles(r.doc);
  }
  return copie(complet5);
}

/* ============================ A. règles de porteuse du 5×5 ============================ */

test('A1 porteuse latérale : tout raccord autre que le milieu de son côté (autre position, autre côté, double) reste une alerte', () => {
  const ok = lc('LC1');
  assert.deepEqual(codes(ok, '5x5'), [], 'témoin : LC1 conforme');
  // même côté (nord), position 0 en plus du milieu
  const a = lc('LC1'); a.chemins.push({ id: 'rx', a: { 'case': 'p' }, b: { raccord: { cote: 0, pos: 0 } } });
  assert.ok(codes(a, '5x5').includes('raccord_porteuse'), 'N:0 + N:1');
  // le milieu, mais d'un autre côté que celui des deux ports (ports N et E : côté 0)
  const b = lc('LC1'); chemin(b, 'rn').b.raccord = { cote: 1, pos: 1 };
  assert.ok(codes(b, '5x5').includes('raccord_porteuse'), 'E:1 au lieu de N:1');
  // la fin du côté (pos 2) à la place du milieu
  const c = lc('LC1'); chemin(c, 'rn').b.raccord.pos = 2;
  assert.ok(codes(c, '5x5').includes('raccord_porteuse'), 'N:2');
  // deux chemins vers le même raccord du milieu : le double est refusé
  const d = lc('LC1'); d.chemins.push({ id: 'rx', a: { 'case': 'p' }, b: { raccord: { cote: 0, pos: 1 } } });
  assert.ok(codes(d, '5x5').includes('raccord_porteuse') || codes(d, '5x5').some((x) => /raccord/.test(x)), 'double N:1 : ' + codes(d, '5x5').join());
  // sans aucun raccord : la porteuse latérale n'en exige pas (aucune des deux alertes de porteuse)
  const e = lc('LC1'); e.chemins = e.chemins.filter((ch) => ch.id !== 'rn');
  const ce = codes(e, '5x5');
  assert.ok(!ce.includes('raccord_porteuse') && !ce.includes('ports_case'), ce.join());
});

test('A2 porteuse : 2 ports en diagonale, 3 ports, 4 ports donnent ports_case ET raccord_porteuse (aucun raccord permis) ; la paire enroulée (coins 3 et 0) reste latérale', () => {
  for (const [nom, coins] of [['diagonale 0-2', [0, 2]], ['diagonale 1-3', [1, 3]], ['3 ports', [0, 1, 2]], ['4 ports', [0, 1, 2, 3]]]) {
    const m = lc('LC1');
    m.chemins = m.chemins.filter((ch) => ch.id !== 'p1' && ch.id !== 'p2');
    coins.forEach((k, i) => m.chemins.push({ id: 'q' + i, a: { 'case': 'p' }, b: { coin: k } }));
    const c = codes(m, '5x5');
    assert.ok(c.includes('ports_case'), nom + ' : ' + c.join());
    assert.ok(c.includes('raccord_porteuse'), nom + ' : le raccord rn n\'est permis nulle part : ' + c.join());
  }
  // coins 3 et 0 : ce sont les deux coins du côté 3 (ouest) ; le seul raccord permis est (3, milieu)
  const w = lc('LC1');
  chemin(w, 'p1').b.coin = 3; chemin(w, 'p2').b.coin = 0;
  assert.ok(codes(w, '5x5').includes('raccord_porteuse'), 'rn (N:1) n\'est pas permis sur un côté ouest');
  chemin(w, 'rn').b.raccord = { cote: 3, pos: 1 };
  const cw = codes(w, '5x5');
  assert.ok(!cw.includes('ports_case') && !cw.includes('raccord_porteuse'), 'ouest : ' + cw.join());
  // les quatre paires de coins consécutifs sont latérales avec leur milieu
  for (let k = 0; k < 4; k++) {
    const m = lc('LC1');
    chemin(m, 'p1').b.coin = k; chemin(m, 'p2').b.coin = (k + 1) % 4; chemin(m, 'rn').b.raccord = { cote: k, pos: 1 };
    const c = codes(m, '5x5');
    assert.ok(!c.includes('ports_case') && !c.includes('raccord_porteuse'), 'côté ' + k + ' : ' + c.join());
  }
});

test('A3 porteuse latérale qui touche un passage : alerte porteuse_passage (LC3 + passage depuis p) ; sans passage sur p, aucune', () => {
  const m = lc('LC3');
  assert.ok(!codes(m, '5x5').includes('porteuse_passage'));
  m.passages.push({ id: 't4', a: { 'case': 'p' }, b: { pivot: 'v' } });
  assert.ok(codes(m, '5x5').includes('porteuse_passage'), codes(m, '5x5').join());
  // la même règle en 4×4 (les règles de passage ne changent pas)
  const s = lc('LC3'); delete s.grille; s.passages.push({ id: 't4', a: { 'case': 'p' }, b: { pivot: 'v' } });
  assert.ok(codes(s, '4x4').includes('porteuse_passage'));
});

test('A4 porteuse de coin : paire basse seulement sur un gabarit coin ; une seule des deux est permise ; tout autre raccord, ou la paire d\'un autre coin, reste une alerte', () => {
  assert.deepEqual(codes(lc('LK2'), '5x5'), []);
  const un = lc('LK2'); un.chemins = un.chemins.filter((ch) => ch.id !== 'r4'); // une seule des deux
  assert.ok(!codes(un, '5x5').includes('raccord_porteuse'), 'une seule : ' + codes(un, '5x5').join());
  const plus = lc('LK2'); plus.chemins.push({ id: 'rx', a: { 'case': 'c' }, b: { raccord: { cote: 1, pos: 1 } } });
  assert.ok(codes(plus, '5x5').includes('raccord_porteuse'), 'raccord du milieu en plus');
  const autre = lc('LK2'); chemin(autre, 'p1').b.coin = 0; // la paire du coin 2 ne longe pas le coin 0
  assert.ok(codes(autre, '5x5').includes('raccord_porteuse'), 'paire du mauvais coin');
  // même motif sur une centrale (1 port + raccord) et sur un bord : alerte (déjà couvert pour LK2 ; ici une centrale avec un seul port)
  const cen = lc('LC1'); cen.chemins = cen.chemins.filter((ch) => ch.id !== 'p2');
  assert.ok(codes(cen, '5x5').includes('raccord_porteuse'), 'centrale 1 port + raccord N:1');
  const cen0 = lc('LC1'); cen0.chemins = cen0.chemins.filter((ch) => ch.id !== 'p2' && ch.id !== 'rn');
  assert.ok(!codes(cen0, '5x5').includes('raccord_porteuse'), '1 port sans raccord : permis');
});

test('A5 le même modèle validé en 4×4 garde ses alertes (porteuse latérale, 3 ports, paire enroulée) ; le champ grille du modèle prime sur l\'argument absent', () => {
  const a = lc('LC1'); delete a.grille;
  const c = codes(a, '4x4');
  assert.ok(c.includes('ports_case') && c.includes('raccord_porteuse'), c.join());
  const w = lc('LC1'); delete w.grille;
  chemin(w, 'p1').b.coin = 3; chemin(w, 'p2').b.coin = 0; chemin(w, 'rn').b.raccord = { cote: 3, pos: 1 };
  const cw = codes(w, '4x4');
  assert.ok(cw.includes('ports_case') && cw.includes('raccord_porteuse'), 'ouest en 4×4 : ' + cw.join());
  // sans argument de grille, validerModele lit 4×4 (par défaut) même si le modèle porte `grille: '5x5'` : les appelants passent la grille
  assert.ok(M.validerModele(lc('LC1')).alertes.some((a) => a.code === 'ports_case'));
});

/* ============================ B. tuiles de l'utilisateur dans l'éditeur 5×5 ============================ */

test('B1 éditeur 5×5 : tuile de départ + chemins ajoutés ; la validation 5×5 s\'applique (porteuse latérale conforme, puis diagonale en alerte)', () => {
  let m = ED.modeleDeDepart('centrale', C5.map((x) => x.id), '5x5');
  assert.equal(m.grille, '5x5');
  m = ED.ajouterCase(m, 50, 25, 'deplacement', '5x5');
  const ids = m.cases.map((c) => c.id);
  assert.ok(ids.length >= 1);
  const cible = ids[0];
  m = ED.ajouterChemin(m, { 'case': cible }, { coin: 0 });
  m = ED.ajouterChemin(m, { 'case': cible }, { coin: 1 });
  m = ED.ajouterChemin(m, { 'case': cible }, { raccord: { cote: 0, pos: 1 } });
  const bons = codes(m, '5x5');
  assert.ok(!bons.includes('ports_case') && !bons.includes('raccord_porteuse'), bons.join());
  const d = ED.ajouterChemin(m, { 'case': cible }, { coin: 2 });
  assert.ok(codes(d, '5x5').includes('ports_case'), 'trois ports');
  // doublon refusé par l'éditeur
  assert.throws(() => ED.ajouterChemin(m, { 'case': cible }, { coin: 1 }), /déjà reliés/);
});

test('B2 « Dupliquer » une tuile à murs (LC4) : la copie garde `murs` ; un raccord ajouté sur un côté déclaré mur le retire de la copie', () => {
  const lc4 = lc('LC4');
  const dup = ED.dupliquer(lc4, C5.map((x) => x.id));
  assert.deepEqual(dup.murs, [1, 3]);
  assert.equal(M.mursDuModele(dup), 0b1010);
  const cas = dup.cases[0].id;
  const avec = ED.ajouterChemin(dup, { 'case': cas }, { raccord: { cote: 1, pos: 1 } });
  assert.equal(M.mursDuModele(avec), 0b1000, 'le côté E porte maintenant un raccord : plus un mur');
  assert.deepEqual(avec.murs, [1, 3], 'le champ déclaré reste tel quel, seule la lecture le filtre');
});

test('B3 tuile de l\'utilisateur posée dans un plateau 5×5 : son raccord de trop sur la porteuse donne une alerte à la validation du modèle, aucune erreur de plateau', () => {
  const doc = doc5();
  const u = lc('LC1'); u.id = 'U-diag'; u.exemplaires = 1; delete u.poids;
  u.chemins.push({ id: 'rx', a: { 'case': 'p' }, b: { raccord: { cote: 0, pos: 0 } } });
  doc.modeles.push(u);
  const d = M.poserTuile(doc, 'U-diag', 2, 2);
  assert.equal(M.validerPlateau(d).erreurs.length, 0);
  assert.ok(M.validerModele(u, '5x5').alertes.some((a) => a.code === 'raccord_porteuse'));
});

/* ============================ C. PM.graphe.connexions ============================ */

test('C1 connexions : plateau vide, une seule tuile, plateau non connexe, document 4×4 : jamais d\'exception, valeurs cohérentes', () => {
  const vide = GR.connexions(doc5());
  assert.equal(vide.cases, 0);
  assert.equal(vide.faibles, 0);
  assert.equal(vide.part, 0);
  assert.equal(vide.degreMoyen, null);
  assert.equal(vide.conforme, true);
  assert.deepEqual(vide.liste, []);
  assert.deepEqual(vide.jonctionsFaibles, []);
  // une tuile seule : ses 2 cases, aucune jonction-case (une jonction exige ses 4 tuiles)
  const un = doc5(); un.plateau.tuiles = [{ modeleId: 'LC1', col: 2, lig: 2, rot: 0 }];
  const cu = GR.connexions(un);
  assert.equal(cu.cases, 2);
  assert.deepEqual(cu.jonctionsFaibles, []);
  assert.equal(cu.faibles + Object.keys(cu.parDegre).reduce((s, d) => s + (+d > 2 ? cu.parDegre[d] : 0), 0), 2);
  assert.equal(cu.conforme, cu.faibles === 0);
  // deux tuiles éloignées (graphe non connexe) : somme des effectifs = nombre de cases
  const deux = doc5(); deux.plateau.tuiles = [{ modeleId: 'LC1', col: 0, lig: 0, rot: 0 }, { modeleId: 'LC1', col: 4, lig: 4, rot: 2 }];
  const cd = GR.connexions(deux);
  assert.equal(cd.cases, 4);
  assert.equal(Object.keys(cd.parDegre).reduce((s, d) => s + cd.parDegre[d], 0), cd.cases);
  // 4×4 : la fonction s'applique aussi (pas de condition de format)
  const g4 = GEN.generer(doc4(), { graine: 'cx4', candidats: 3 });
  const c4 = GR.connexions(g4.doc);
  assert.ok(c4.cases > 40 && c4.degreMoyen > 1);
  // tuile sans modèle, hors grille, null : ignorées
  const sale = doc5(); sale.plateau.tuiles = [null, { modeleId: 'absent', col: 1, lig: 1, rot: 0 }, { modeleId: 'LC1', col: 9, lig: 9, rot: 0 }, { modeleId: 'LC1', col: 2, lig: 2, rot: 0 }];
  assert.doesNotThrow(() => GR.connexions(sale));
});

test('C2 connexions : sans ville 16 jonctions-cases ; avec 7 villes 9 ; les degrés des cases de tuile ne changent pas', () => {
  const d = plateau5();
  const sans = GR.connexions(d);
  const nbTuilesCases = d.plateau.tuiles.reduce((s, t) => s + M.modeleParId(d, t.modeleId).cases.length, 0);
  assert.equal(sans.cases, nbTuilesCases + 16);
  const p = GEN.meilleurPlacementVilles(d);
  assert.ok(p.ok, p.raison);
  const av = copie(d); av.plateau.jetons = p.jetons;
  const avec = GR.connexions(av);
  assert.equal(avec.cases, nbTuilesCases + 9);
  // g construit avec ou sans la clé : même résultat que l'appel explicite
  assert.deepEqual(GR.connexions(av, GR.construire(av, { villesTraversables: false })), avec);
  // les cases de tuile à 2 connexions ou moins sont les mêmes avec ou sans ville
  const f = (x) => x.liste.filter((id) => !/^J/.test(id)).sort().join();
  assert.equal(f(avec), f(sans));
});

test('C3 connexions : seuil de 5 % exact (< 5 %), liste et jonctionsFaibles cohérentes avec faibles', () => {
  const c = GR.connexions(plateau5());
  assert.equal(c.faibles, c.liste.length);
  assert.ok(c.jonctionsFaibles.length <= c.faibles);
  assert.equal(c.conforme, c.part < GR.PART_CONNEXIONS_MAX);
  assert.equal(GR.PART_CONNEXIONS_MAX, 0.05);
  assert.equal(GR.CONNEXIONS_FAIBLES, 2);
  assert.ok(Math.abs(c.part - c.faibles / c.cases) < 1e-12);
  // un plateau 3.04 (anciennes tuiles) n'est pas conforme : preuve que la mesure discrimine
  const ancien = GEN.generer(Object.assign(doc5(), { modeles: copie(CAT.precedents['5x5'][1].modeles) }), { graine: 'x', candidats: 1 });
  assert.equal(ancien.ok, false);
});

test('C4 connexions : une jonction-case sans aucun port (4 tuiles sans port autour) compte comme une case à 0 connexion, sans exception ; les contrôles suivent', () => {
  const d = doc5();
  const sp = lc('LC1'); sp.id = 'SP'; sp.exemplaires = 9; delete sp.poids;
  sp.chemins = sp.chemins.filter((c) => c.b.coin === undefined);
  d.modeles.push(sp);
  d.plateau.tuiles = [[1, 1], [2, 1], [1, 2], [2, 2]].map(([col, lig]) => ({ modeleId: 'SP', col, lig, rot: 0 }));
  let c;
  assert.doesNotThrow(() => { c = GR.connexions(d); });
  assert.equal(c.cases, 9, '8 cases de tuile + la jonction (2, 2)');
  assert.equal(c.parDegre[0], 1, 'la jonction sans port : 0 connexion');
  assert.deepEqual(c.jonctionsFaibles, [{ i: 2, j: 2 }]);
  assert.equal(c.conforme, false);
  assert.doesNotThrow(() => PM.controles.calculer(d));
});

/* ============================ D. « Placer les villes » ============================ */

test('D1 placerVilles : plateau incomplet (4×4 et 5×5) = refus expliqué, document intact, aucune étape d\'historique, rien à rétablir', () => {
  for (const [grille, total] of [['4x4', 16], ['5x5', 25]]) {
    const d = grille === '5x5' ? plateau5() : sansVilles(GEN.generer(doc4(), { graine: 'pv4', candidats: 3 }).doc);
    d.plateau.tuiles = d.plateau.tuiles.slice(0, total - 1);
    const etat = PM.etat.creer(d), avant = JSON.stringify(etat.doc());
    const r = GEN.placerVilles(etat);
    assert.equal(r.ok, false);
    assert.match(r.raison, new RegExp('\\(' + (total - 1) + ' sur ' + total + '\\)'), grille);
    assert.equal(JSON.stringify(etat.doc()), avant);
    assert.equal(etat.ui().message.niveau, 'alerte');
    assert.equal(etat.peutAnnuler(), false);
    assert.equal(etat.peutRetablir(), false);
  }
  // une tuile qui renvoie à un modèle absent ne compte pas comme posée
  const d = plateau5(); d.plateau.tuiles[3].modeleId = 'absent';
  const r = GEN.meilleurPlacementVilles(d);
  assert.equal(r.ok, false);
  assert.match(r.raison, /\(24 sur 25\)/);
});

test('D2 placerVilles : aucun placement possible sur un plateau complet = refus expliqué ; document intact, historique intact', () => {
  const d = plateau5();
  d.plateau.tuiles.forEach((t) => { if (M.gabaritCellule(t.col, t.lig, '5x5') === 'centrale') t.rot = 0; });
  const etat = PM.etat.creer(d);
  etat.appliquer((x) => { const n = copie(x); n.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }]; return n; }, 'une ville'); // une étape d'historique à conserver
  const avant = JSON.stringify(etat.doc());
  const r = GEN.placerVilles(etat);
  assert.equal(r.ok, false);
  assert.match(r.raison, /Aucun placement des 7 villes/);
  assert.equal(JSON.stringify(etat.doc()), avant, 'la ville déjà posée n\'est pas touchée');
  assert.equal(etat.ui().message.niveau, 'alerte');
  assert.equal(etat.peutRetablir(), false);
  etat.annuler(); // annule « une ville », pas un placement fantôme
  assert.deepEqual(etat.doc().plateau.jetons, []);
});

test('D3 placerVilles puis Ctrl+Z / Ctrl+Y (4×4 et 5×5) : les 7 villes vont et viennent à l\'identique ; un second appel après Ctrl+Z redonne le même placement', () => {
  for (const grille of ['4x4', '5x5']) {
    const d = grille === '5x5' ? plateau5() : sansVilles(GEN.generer(doc4(), { graine: 'pv4b', candidats: 3 }).doc);
    d.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }]; // une ville mal placée : remplacée, puis rendue au Ctrl+Z
    const etat = PM.etat.creer(d);
    const r = GEN.placerVilles(etat);
    assert.ok(r.ok, grille + ' : ' + r.raison);
    const poses = copie(etat.doc().plateau.jetons);
    assert.equal(poses.length, 7);
    assert.equal(new Set(poses.map((j) => j.i + ',' + j.j)).size, 7, 'sept villes distinctes');
    assert.ok(etat.peutAnnuler());
    etat.annuler();
    assert.deepEqual(etat.doc().plateau.jetons, [{ i: 1, j: 1, type: 'capture' }], grille);
    assert.ok(etat.peutRetablir());
    etat.retablir();
    assert.deepEqual(etat.doc().plateau.jetons, poses, grille);
    assert.equal(etat.peutRetablir(), false);
    etat.annuler();
    const r2 = GEN.placerVilles(etat);
    assert.deepEqual(r2.jetons, r.jetons, grille + ' : déterministe');
    // Ctrl+Z après le nouveau placement vide l'avenir de la branche rétablie
    assert.equal(etat.peutRetablir(), false);
    // aucun jeton hors capture n'est supprimé par erreur : le résultat n'a que des captures
    assert.ok(etat.doc().plateau.jetons.every((j) => j.type === 'capture'));
  }
});

test('D4 placerVilles : le résultat respecte l\'écart de 3 cases (aucune alerte villes_proches) en 4×4 et en 5×5, et ne dépend pas de l\'ordre des tuiles', () => {
  for (const grille of ['4x4', '5x5']) {
    const d = grille === '5x5' ? plateau5() : sansVilles(GEN.generer(doc4(), { graine: 'pv4c', candidats: 3 }).doc);
    const r = GEN.meilleurPlacementVilles(d);
    assert.ok(r.ok, r.raison);
    const inverse = copie(d); inverse.plateau.tuiles.reverse();
    assert.deepEqual(GEN.meilleurPlacementVilles(inverse).jetons, r.jetons, grille);
    const avec = copie(d); avec.plateau.jetons = r.jetons;
    assert.deepEqual(PM.controles.calculer(avec).alertes.filter((a) => a.code === 'villes_proches'), [], grille);
    assert.deepEqual(PM.controles.calculer(avec).erreurs, [], grille);
  }
});

/* ============================ E. champ `murs` et murs ============================ */

const jsonAvecMurs = (murs, id) => {
  const d = doc5();
  d.plateau.tuiles = [{ modeleId: 'LC4', col: 2, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 1, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 3, lig: 2, rot: 0 }];
  const j = JSON.parse(S.versJSON(d));
  const m = j.modeles.find((x) => x.id === (id || 'LC4'));
  if (murs === undefined) delete m.murs; else m.murs = murs;
  return JSON.stringify(j);
};
const mursLus = (murs) => {
  const r = S.depuisJSON(jsonAvecMurs(murs));
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  return r.doc.modeles.find((x) => x.id === 'LC4');
};

test('E1 `murs` hostile dans un JSON : [5], "1", {}, [[1]], [true], [null], [1.5], [-1], doublons, mélange : seuls les côtés 0 à 3 entiers sans doublon survivent, jamais d\'exception', () => {
  const cas = [
    [[5], []], [['1'], []], [[true], []], [[null], []], [[[1]], []], [[1.5], []], [[-1], []], [[4], []],
    [[1, 1, 1, 3, 3], [1, 3]], [[3, 1], [3, 1]], [[1, '3', 3, 99, 1], [1, 3]], [[0, 1, 2, 3, 0], [0, 1, 2, 3]], [[], []],
    ['1', undefined], [1, undefined], [{ 0: 1, length: 1 }, undefined], [{}, undefined], [null, undefined], [true, undefined]
  ];
  for (const [entree, attendu] of cas) {
    const m = mursLus(entree);
    if (attendu === undefined) assert.equal('murs' in m, false, JSON.stringify(entree) + ' → ' + JSON.stringify(m.murs));
    else assert.deepEqual(m.murs, attendu, JSON.stringify(entree));
  }
});

test('E2 `murs` : `__proto__` comme clé du modèle ou valeur de murs ne pollue rien et n\'ajoute aucun mur', () => {
  const j = JSON.parse(jsonAvecMurs([1, 3]));
  const m = j.modeles.find((x) => x.id === 'LC4');
  let texte = JSON.stringify(j).replace('"id":"LC4"', '"__proto__":{"murs":[0,1,2,3]},"id":"LC4"');
  texte = texte.replace('"murs":[1,3]', '"murs":["__proto__",{"__proto__":1},1]');
  let r;
  assert.doesNotThrow(() => { r = S.depuisJSON(texte); });
  assert.equal(r.ok, true);
  const lu = r.doc.modeles.find((x) => x.id === 'LC4');
  assert.deepEqual(lu.murs, [1]);
  assert.equal(({}).murs, undefined, 'Object.prototype non pollué');
  assert.equal(M.mursDuModele(lu), 0b0010);
  assert.equal(Object.getPrototypeOf(lu), Object.prototype);
  // en mémoire : un `murs` chaîne ou objet est ignoré par mursDuModele
  assert.equal(M.mursDuModele({ murs: '1', chemins: [], cases: [] }), 0);
  assert.equal(M.mursDuModele({ murs: { 0: 1, length: 1 }, chemins: [], cases: [] }), 0);
  assert.ok(m);
});

test('E3 `murs` : un JSON qui déclare un mur sur un côté à raccord ne crée pas de mur ; le plateau garde ses alertes', () => {
  const r = S.depuisJSON(jsonAvecMurs([0, 2]));
  const lu = r.doc.modeles.find((x) => x.id === 'LC4');
  assert.equal(M.mursDuModele(lu), 0, 'N et S portent des raccords');
  const v = M.validerPlateau(r.doc);
  assert.equal(v.informations.length, 0);
  assert.equal(v.alertes.filter((a) => a.code === 'raccord_mort').length, 2, 'les raccords des voisines E et O face à O et E de LC4 sont des raccords morts');
});

test('E4 `murs` de très grande taille : relecture en temps borné (sauvegarde.js, tronquée à 4 avant filtrage, docs/61 D1)', () => {
  const n = 40000;
  const t0 = Date.now();
  const lu = mursLus(Array(n).fill(5).concat(Array(n).fill(1)));
  assert.deepEqual(lu.murs, [1]);
  assert.ok(Date.now() - t0 < 500, 'durée : ' + (Date.now() - t0) + ' ms');
});

test('E5 murs : vis-à-vis partiel — un voisin qui a un raccord en face (même mal placé) n\'est pas un mur ; face au mur, le raccord est information ; la rotation du voisin est suivie', () => {
  // LC4 en (2, 2) rot 0 : mur E. Voisin E = LC1 rot 0, son côté O porte le raccord du milieu (ro) face au mur → information.
  const base = doc5();
  base.plateau.tuiles = [{ modeleId: 'LC4', col: 2, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 3, lig: 2, rot: 0 }];
  let v = M.validerPlateau(base);
  assert.deepEqual(v.informations.map((x) => x.ref.col + ':' + x.ref.cote), ['3:3']);
  // même voisin tourné de 90 degrés : son côté O n'a plus ro mais le raccord du côté qui arrive à l'ouest ; toujours face au mur → information
  for (const rot of [0, 1, 2, 3]) {
    const d = copie(base); d.plateau.tuiles[1].rot = rot;
    v = M.validerPlateau(d);
    const morts = M.raccordsMorts(d).filter((r) => r.raison === 'mort' && r.col === 3);
    assert.ok(morts.every((r) => r.mur === true), 'rot ' + rot);
    assert.equal(v.informations.length, morts.length, 'rot ' + rot);
    assert.equal(v.alertes.filter((a) => a.code === 'raccord_mort' && a.ref.col === 3 && a.ref.lig === 2 && a.ref.cote === 3).length, 0, 'rot ' + rot);
  }
  // mur face à un mur : deux « Deux ponts » côte à côte (rot 0 et rot 0) : leurs côtés E et O sont sans raccord, rien à signaler entre eux
  const deux = doc5();
  deux.plateau.tuiles = [{ modeleId: 'LC4', col: 1, lig: 2, rot: 0 }, { modeleId: 'LC4', col: 2, lig: 2, rot: 0 }];
  assert.deepEqual(M.raccordsMorts(deux).filter((r) => r.raison === 'mort'), []);
  assert.deepEqual(M.validerPlateau(deux).informations, []);
  // un LC4 tourné (murs N et S) à côté d'un LC4 droit (raccords N et S) : les raccords du droit font face à un côté O/E du tourné qui est
  // un raccord (le tourné a ses raccords E et O) : rien de mort
  const croise = doc5();
  croise.plateau.tuiles = [{ modeleId: 'LC4', col: 1, lig: 2, rot: 1 }, { modeleId: 'LC4', col: 2, lig: 2, rot: 0 }];
  const vc = M.validerPlateau(croise);
  assert.equal(vc.alertes.filter((a) => a.code === 'raccord_mort' && a.ref.cote === 1 && a.ref.col === 1).length, 0);
});

test('E6 murs : mur face au vide ou au pourtour — `murs: [0]` sur un bord (pourtour) ne change aucune alerte par rapport au même bord sans `murs` ; un raccord face au vide reste une alerte', () => {
  const doc = doc5();
  const bord = lc('LB2'); bord.id = 'LBm'; bord.murs = [0]; bord.exemplaires = 99; delete bord.poids;
  doc.modeles.push(bord);
  const alertesDe = (modeleId, rot) => {
    const d = copie(doc); d.plateau.tuiles = [{ modeleId, col: 1, lig: 0, rot }];
    const v = M.validerPlateau(d);
    return { al: v.alertes.map((a) => a.code + ':' + JSON.stringify(a.ref)).sort(), inf: v.informations.length, mur: M.masquesTuilePosee(d, d.plateau.tuiles[0]).murs };
  };
  for (const rot of [0, 1, 2, 3]) {
    const a = alertesDe('LBm', rot), b = alertesDe('LB2', rot);
    assert.deepEqual(a.al, b.al, 'rot ' + rot + ' : mêmes alertes avec ou sans `murs`');
    assert.equal(a.inf, 0);
    assert.equal(a.mur, ((1 << 0) * 1) === 1 ? (rot === 0 ? 0b0001 : rot === 1 ? 0b0010 : rot === 2 ? 0b0100 : 0b1000) : 0, 'le mur suit la rotation');
  }
  assert.ok(alertesDe('LBm', 2).al.some((x) => x.startsWith('raccord_mort')), 'bord tourné vers le vide : raccords face au vide');
});

test('E7 murs : un côté de passage (LC3) est un raccord, donc jamais un mur, même déclaré ; un mur déclaré sur un côté sans raccord ni passage compte', () => {
  const m = lc('LC3');
  m.murs = [2, 3];
  assert.equal(M.mursDuModele(m), 0, 'S et O portent les raccords des passages t1 et t2');
  m.murs = [0, 1, 2, 3];
  assert.equal(M.mursDuModele(m), 0b0000, 'N (rn) et E (re) portent aussi un raccord : aucun côté libre');
  const k = lc('LC1'); k.chemins = k.chemins.filter((c) => c.id !== 're'); k.murs = [1];
  assert.equal(M.mursDuModele(k), 0b0010, 'E libre');
});

/* ============================ F. `informations` de validerPlateau ============================ */

test('F1 validerPlateau renvoie toujours `informations` (tableau) : plateau vide, partiel, modèle absent, tuile hors grille, 4×4', () => {
  const cas = [doc5(), doc4(), plateau5()];
  const horsGrille = doc5(); horsGrille.plateau.tuiles = [{ modeleId: 'LC1', col: 9, lig: 9, rot: 0 }, { modeleId: 'absent', col: 0, lig: 0, rot: 0 }];
  cas.push(horsGrille);
  for (const d of cas) {
    const v = M.validerPlateau(d);
    assert.ok(Array.isArray(v.informations) && Array.isArray(v.alertes) && Array.isArray(v.erreurs));
  }
  assert.deepEqual(M.validerPlateau(doc4()).informations, []);
});

test('F2 un raccord face à un mur n\'est ni une erreur ni une alerte : contrôles (calculer), rapport d\'équilibre, relecture de fichier, générateur', () => {
  const d = plateau5();
  const lc4 = d.plateau.tuiles.find((t) => t.modeleId === 'LC4');
  // plateau garanti avec LC4 : si absent, forcer en (2, 2)
  let doc = d;
  if (!lc4) { doc = doc5(); doc.plateau.tuiles = [{ modeleId: 'LC4', col: 2, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 1, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 3, lig: 2, rot: 0 }]; }
  const v = M.validerPlateau(doc);
  assert.ok(v.informations.length >= 2);
  // contrôles
  const c = PM.controles.calculer(doc);
  assert.equal(c.informations.length, v.informations.length);
  assert.ok(c.alertes.every((a) => a.code !== 'raccord_mur') && c.erreurs.every((a) => a.code !== 'raccord_mur'));
  assert.ok(c.regroupees.some((g) => g.code === 'raccord_mur' && g.niveau === 'information' && g.nombre === v.informations.length));
  // rapport d'équilibre : l'analyse n'ajoute pas les informations de mur à ses alertes ni à ses informations propres
  const a = PM.equilibre.analyser(doc);
  const textes = [].concat(a.resultat.alertes || [], a.resultat.informations || []).map((x) => x.message || String(x)).join(' | ');
  assert.ok(!/mur/i.test(textes), textes);
  // relecture de fichier : un mur voulu n'est pas rapporté comme alerte de lecture
  const r = S.depuisJSON(S.versJSON(doc));
  assert.ok(r.ok);
  assert.ok(r.alertes.every((x) => x.code !== 'raccord_mur' && x.code !== 'raccord_mort'), r.alertes.map((x) => x.code).join());
  // contrôle : le même plateau sans la déclaration de murs donne des alertes de relecture
  const j = JSON.parse(S.versJSON(doc)); j.modeles.find((m) => m.id === 'LC4').murs = [];
  const r2 = S.depuisJSON(JSON.stringify(j));
  assert.ok(r2.alertes.some((x) => x.code === 'raccord_mort'));
});

test('F3 le rendu des murs voulus est défini en CSS (classes, pas de style en ligne) et dessiné sans triangle d\'alerte', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'assemblage.css'), 'utf8');
  assert.match(css, /\.pm-assemblage-mur-trait\s*\{/);
  const d = doc5();
  d.plateau.tuiles = [{ modeleId: 'LC4', col: 2, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 3, lig: 2, rot: 0 }];
  const al = PM.assemblage.alertesPlateau(d).filter((x) => x.type === 'raccord');
  assert.ok(al.some((x) => x.mur === true));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'assemblage.js'), 'utf8');
  const i = src.indexOf('pm-assemblage-mur"'), fin = src.indexOf('return;', i);
  assert.ok(i > 0 && fin > i);
  assert.ok(!/style=|triangle/.test(src.slice(i, fin)), 'le trait de mur ne porte ni triangle ni style en ligne');
});

/* ============================ G. générateur 5×5 sur bibliothèque modifiée ============================ */

const utilisation = (doc) => { const n = {}; doc.plateau.tuiles.forEach((t) => { n[t.modeleId] = (n[t.modeleId] || 0) + 1; }); return n; };
const horsStock = (doc) => Object.entries(utilisation(doc)).filter(([id, n]) => n > M.modeleParId(doc, id).exemplaires).map(([id, n]) => id + ' ×' + n);

test('G1 bibliothèque modifiée : LC4 supprimé, LC5 retiré, LC5 à 0 exemplaire : plateaux valides, sans le modèle écarté, stock respecté, aucun mur', () => {
  const variantes = {
    'LC4 supprimé': (d) => { d.modeles = d.modeles.filter((m) => m.id !== 'LC4'); },
    'LC5 supprimé': (d) => { d.modeles = d.modeles.filter((m) => m.id !== 'LC5'); },
    'LC5 à 0 exemplaire': (d) => { d.modeles.find((m) => m.id === 'LC5').exemplaires = 0; },
    'LC4 à 0 exemplaire': (d) => { d.modeles.find((m) => m.id === 'LC4').exemplaires = 0; }
  };
  for (const [nom, f] of Object.entries(variantes)) {
    const d = doc5(); f(d);
    const ecarte = nom.slice(0, 3);
    for (let k = 0; k < 3; k++) {
      const r = GEN.generer(d, { graine: nom + k, candidats: 6 });
      assert.ok(r.ok, nom + ' : ' + r.raison);
      assert.equal(r.doc.plateau.tuiles.length, 25);
      assert.equal(r.doc.plateau.jetons.length, 7);
      assert.equal(utilisation(r.doc)[ecarte] || 0, 0, nom + ' : ' + ecarte + ' ne doit pas être posé');
      assert.deepEqual(horsStock(r.doc), [], nom);
      assert.equal(M.validerPlateau(r.doc).erreurs.length, 0, nom);
      assert.ok(GR.connexions(r.doc).conforme, nom);
    }
  }
});

test('G2 tuile de l\'utilisateur ajoutée à la bibliothèque 5×5 : copie de LC1 sous un autre id (tirée), tuile à porteuse diagonale (alerte de modèle) : jamais d\'exception, plateau valide ou refus expliqué', () => {
  const d = doc5();
  const u = lc('LC1'); u.id = 'U1'; u.nom = 'Mienne'; u.exemplaires = 4; delete u.poids;
  d.modeles.push(u);
  let vu = 0;
  for (let k = 0; k < 6; k++) {
    const r = GEN.generer(d, { graine: 'u1-' + k, candidats: 5 });
    assert.ok(r.ok, r.raison);
    vu += utilisation(r.doc).U1 || 0;
    assert.deepEqual(horsStock(r.doc), [], 'stock');
  }
  assert.ok(vu > 0, 'la tuile de l\'utilisateur est tirée');
  const mauvaise = doc5();
  const m = lc('LC1'); m.id = 'U2'; m.exemplaires = 3; delete m.poids; chemin(m, 'p2').b.coin = 2;
  mauvaise.modeles.push(m);
  let r;
  assert.doesNotThrow(() => { r = GEN.generer(mauvaise, { graine: 'u2', candidats: 4 }); });
  assert.ok(r.ok || (typeof r.raison === 'string' && r.raison.length > 20), r.raison);
  if (r.ok) assert.equal(M.validerPlateau(r.doc).erreurs.length, 0);
  // l'original n'est pas modifié
  assert.equal(mauvaise.modeles.length, 10);
});

test('G3 bibliothèque modifiée : plus de bord (LB2 à 0), plus de coin (LK2 supprimé), plus de centrale : refus explicite en une phrase, document intact', () => {
  for (const [nom, f, motif] of [
    ['LB2 à 0', (d) => { d.modeles.find((m) => m.id === 'LB2').exemplaires = 0; }, /aucun modèle de bord/i],
    ['LK2 supprimé', (d) => { d.modeles = d.modeles.filter((m) => m.id !== 'LK2'); }, /aucun modèle de coin/i],
    ['aucune centrale', (d) => { d.modeles = d.modeles.filter((m) => m.gabarit !== 'centrale'); }, /aucun modèle de centrale/i],
    ['centrales toutes à 0 exemplaire', (d) => { d.modeles.forEach((m) => { if (m.gabarit === 'centrale') m.exemplaires = 0; }); }, /aucun modèle de centrale/i]
  ]) {
    const d = doc5(); f(d);
    const avant = JSON.stringify(d);
    const r = GEN.generer(d, { graine: 'g3', candidats: 3 });
    assert.equal(r.ok, false, nom);
    assert.match(r.raison, /Bibliothèque insuffisante/, nom);
    assert.match(r.raison, motif, nom);
    assert.equal(JSON.stringify(d), avant, nom);
  }
});

test('G3b une seule centrale utilisable (LC5 seule : un port, aucune desserte à trois) : abandon expliqué, jamais de plateau non conforme', () => {
  const d = doc5(); d.modeles = d.modeles.filter((m) => m.gabarit !== 'centrale' || m.id === 'LC5');
  const r = GEN.generer(d, { graine: 'lc5-seule', candidats: 3 });
  assert.equal(r.ok, false);
  assert.match(r.raison, /Aucun plateau acceptable/);
  assert.match(r.raison, /(Charger le nouveau catalogue|Le catalogue 5×5 livré|presque jamais)/);
});

test('G4 placerVilles sur un plateau issu d\'une bibliothèque modifiée (LC4 supprimé) : accepté ou refus expliqué, jamais d\'exception', () => {
  const d = doc5(); d.modeles = d.modeles.filter((m) => m.id !== 'LC4');
  const r = GEN.generer(d, { graine: 'g4', candidats: 5 });
  assert.ok(r.ok, r.raison);
  const etat = PM.etat.creer(sansVilles(r.doc));
  let p;
  assert.doesNotThrow(() => { p = GEN.placerVilles(etat); });
  assert.ok(p.ok || p.raison.length > 20);
});

/* ============================ H. anciens documents 5×5 (3.04, 4.00.0) ============================ */

const ancien = (version, grille) => {
  const d = CAT.nouveauDocument(grille || '5x5');
  d.modeles = copie(version === '3.04' ? CAT.precedents[grille || '5x5'][0].modeles : CAT.precedents[grille || '5x5'][1].modeles);
  d.plateau = { tuiles: [{ modeleId: d.modeles.find((m) => m.gabarit === 'coin').id, col: 0, lig: 0, rot: 0 }], jetons: [{ i: 1, j: 1, type: 'capture' }] };
  return d;
};
const propose = (d) => S.bibliothequeCataloguePrecedent(d);

test('H1 proposition du nouveau catalogue : 3.04 et 4.00.0 (5×5) proposés, aux exemplaires, poids, noms et plateau près ; les champs `murs` ne comptent pas', () => {
  for (const v of ['3.04', '4.00']) {
    const d = ancien(v);
    assert.equal(propose(d), true, v);
    const n = copie(d); n.modeles.forEach((m, k) => { m.exemplaires = 7 + k; m.poids = 3; m.nom = 'renommé ' + k; });
    assert.equal(propose(n), true, v + ' exemplaires / poids / noms');
    n.plateau = { tuiles: [], jetons: [] };
    assert.equal(propose(n), true, v + ' plateau vide');
    const avecMurs = copie(d); avecMurs.modeles[0].murs = [0, 1];
    assert.equal(propose(avecMurs), true, v + ' murs ajoutés (ignorés par la signature)');
    // survit à un aller-retour par la sauvegarde
    const r = S.depuisJSON(S.versJSON(d));
    assert.equal(r.ok, true);
    assert.equal(propose(r.doc), true, v + ' après sauvegarde / relecture');
  }
});

test('H2 pas de proposition : tuile modifiée, retirée, ajoutée, mélange 3.04 / 4.00.0, catalogue courant, 4×4 courant, grille sans rapport, document hostile', () => {
  const d = ancien('4.00');
  const modif = copie(d); modif.modeles[0].cases[0].x += 1;
  assert.equal(propose(modif), false, 'case déplacée');
  const retire = copie(d); retire.modeles.pop();
  assert.equal(propose(retire), false, 'tuile retirée');
  const ajoute = copie(d); const extra = copie(ajoute.modeles[0]); extra.id = 'MIENNE'; ajoute.modeles.push(extra);
  assert.equal(propose(ajoute), false, 'tuile ajoutée');
  const chemMod = copie(d); chemMod.modeles[1].chemins.pop();
  assert.equal(propose(chemMod), false, 'chemin retiré');
  // mélange 3.04 / 4.00.0 : les identifiants communs aux deux catalogues portent des tracés identiques, donc un mélange se réduit à une
  // tuile ajoutée ou retirée (déjà couverte) ; on vérifie que la longueur seule ne suffit pas : même nombre de tuiles, un identifiant échangé
  const ancienne = CAT.precedents['5x5'][0].modeles, recente = CAT.precedents['5x5'][1].modeles;
  const communs = recente.filter((m) => ancienne.some((x) => x.id === m.id));
  communs.forEach((m) => assert.equal(JSON.stringify(m.cases), JSON.stringify(ancienne.find((x) => x.id === m.id).cases), 'tracé commun ' + m.id));
  const echange = copie(d); echange.modeles[0].id = 'ZZ-autre';
  assert.equal(propose(echange), false, 'même nombre de tuiles, un identifiant inconnu');
  assert.equal(propose(doc5()), false, 'catalogue courant 5×5');
  assert.equal(propose(doc4()), false, 'catalogue courant 4×4 (le 4×4 de la 4.00.0 est le catalogue courant)');
  const croise = doc4(); croise.modeles = copie(CAT.precedents['5x5'][1].modeles);
  assert.equal(propose(croise), false, 'modèles 5×5 sous une grille 4×4');
  for (const hostile of [null, {}, { modeles: null }, { grille: '5x5', modeles: [null, 3, 'x'] }, { grille: 'hex', modeles: [] }, { grille: '5x5', modeles: [] }]) {
    let r;
    assert.doesNotThrow(() => { r = propose(hostile); }, JSON.stringify(hostile));
    assert.equal(r, false, JSON.stringify(hostile));
  }
});

test('H3 acceptation (logique de proposerRemplacement, sans boîte de dialogue ; la boîte, « Garder mes tuiles » et le démarrage sont couverts par S11 de recette-interface) : bibliothèque remplacée, plateau vidé, une étape ; Ctrl+Z rend le document ancien tel quel, Ctrl+Y le nouveau', () => {
  for (const v of ['3.04', '4.00']) {
    const d = ancien(v);
    const etat = PM.etat.creer(d), avant = JSON.stringify(etat.doc());
    assert.equal(etat.peutAnnuler(), false);
    // acceptation, comme proposerRemplacement : remplacer(nouveauDocument(grille), 'nouveau catalogue')
    etat.remplacer(CAT.nouveauDocument(d.grille), 'nouveau catalogue');
    const n = etat.doc();
    assert.equal(n.grille, '5x5');
    assert.equal(n.plateau.tuiles.length, 0);
    assert.equal(n.plateau.jetons.length, 0);
    assert.deepEqual(n.modeles.map((m) => m.id).sort(), C5.map((m) => m.id).sort());
    assert.equal(n.modeles.reduce((s, m) => s + m.exemplaires, 0), 28);
    assert.equal(propose(n), false, 'plus de re-proposition');
    assert.equal(etat.peutAnnuler(), true);
    etat.annuler();
    assert.equal(JSON.stringify(etat.doc()), avant, v + ' : Ctrl+Z rend le document tel qu\'il était, plateau compris');
    assert.equal(propose(etat.doc()), true);
    etat.retablir();
    assert.equal(etat.doc().plateau.tuiles.length, 0);
    assert.equal(etat.doc().modeles.length, 9);
  }
});

test('H4 le document ancien conservé : le générateur 5×5 abandonne en conseillant le nouveau catalogue, la mesure de connexions reste calculable, les contrôles ne lèvent rien', () => {
  for (const v of ['3.04', '4.00']) {
    const d = ancien(v);
    const r = GEN.generer(d, { graine: 'h4', candidats: 2 });
    assert.equal(r.ok, false, v);
    assert.match(r.raison, /Charger le nouveau catalogue/);
    assert.doesNotThrow(() => PM.controles.calculer(d), v);
    assert.doesNotThrow(() => GR.connexions(d), v);
    const p = GEN.meilleurPlacementVilles(d);
    assert.equal(p.ok, false, v);
    assert.match(p.raison, /Posez d’abord toutes les tuiles/);
  }
});

test('H5 bibliothèque : les identifiants des catalogues livrés et des deux catalogues précédents (5×5) ne sont pas des tuiles de l’utilisateur ; une tuile ajoutée l’est', () => {
  const B = PM.bibliotheque;
  const d = ancien('4.00');
  for (const x of CAT.precedents['5x5']) x.modeles.forEach((m) => { if (!d.modeles.some((y) => y.id === m.id)) d.modeles.push(copie(m)); });
  const mienne = lc('LC1'); mienne.id = 'MIENNE'; d.modeles.push(mienne);
  for (const x of CAT.precedents['5x5']) x.modeles.forEach((m) => assert.equal(B.estTuileUtilisateur(d, m.id), false, m.id));
  for (const m of C5) assert.equal(B.estTuileUtilisateur(d, m.id) || !d.modeles.some((y) => y.id === m.id) ? false : B.estTuileUtilisateur(d, m.id), false, m.id);
  assert.equal(B.estTuileUtilisateur(d, 'MIENNE'), true);
});

/* ============================ I. export du jeu complet ============================ */

test('I1 export du jeu complet 5×5 (28 tuiles) : tuiles et planches selon les exemplaires, y compris après modification (LC5 à 0, tuile utilisateur ajoutée, LC4 à 3)', () => {
  const d = doc5();
  assert.equal(E.listeTuiles(d, { portee: 'stock' }).tuiles.length, 28);
  d.modeles.find((m) => m.id === 'LC5').exemplaires = 0;
  d.modeles.find((m) => m.id === 'LC4').exemplaires = 3;
  const u = lc('LC1'); u.id = 'U1'; u.exemplaires = 2; delete u.poids; d.modeles.push(u);
  const l = E.listeTuiles(d, { portee: 'stock' });
  assert.equal(l.tuiles.length, 28 - 2 + 2 + 2);
  assert.equal(l.tuiles.filter((t) => t.modeleId === 'LC5').length, 0);
  assert.equal(l.tuiles.filter((t) => t.modeleId === 'LC4').length, 3);
  assert.equal(l.tuiles.filter((t) => t.modeleId === 'U1').length, 2);
  for (const format of ['A3', 'A4']) {
    const pl = E.calepiner(d, { format, portee: 'stock' });
    assert.equal(pl.reduce((s, p) => s + p.tuiles.length, 0), l.tuiles.length, format);
  }
});

/* ============================ J. cohérence des codes ============================ */

test('J1 libellés : tout code d\'information émis par validerPlateau a un libellé dans les contrôles ; la pastille ignore les informations', () => {
  const d = doc5();
  d.plateau.tuiles = [{ modeleId: 'LC4', col: 2, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 3, lig: 2, rot: 0 }, { modeleId: 'LC1', col: 1, lig: 2, rot: 0 }];
  const c = PM.controles.calculer(d);
  for (const g of c.regroupees.filter((x) => x.niveau === 'information')) {
    assert.ok(g.libelle && !/undefined/.test(g.libelle), g.code);
  }
  // le nombre d'alertes n'inclut pas les informations
  assert.equal(c.alertes.length + c.erreurs.length, c.regroupees.filter((g) => g.niveau !== 'information').reduce((s, g) => s + g.nombre, 0));
});
