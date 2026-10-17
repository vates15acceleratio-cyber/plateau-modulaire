'use strict';
/*
 * Tests du catalogue 5×5 livré (src/catalogue.js, PM.catalogue.modelesParGrille['5x5'], révision « centrales ouvertes » de docs/45,
 * exemplaires revus en docs/46 pour 78 à 81 cases). Contenu, validité (aucune erreur ni alerte, aucune poche), règles des passages
 * (docs/18), tracés (8 mm entre chemins, rayon + 4 mm des autres cases, 24 mm des coins), règles R1 à R4, raccourci dans toutes
 * les rotations imposées, exemplaires, absence de paire miroir, nouveauDocument('5x5'), et un plateau 5×5 complet fixé ici.
 */
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
require('../src/catalogue.js');
require('../src/app.js'); // chargeable sous Node : documentPourGrille est dans PM.nouveau
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, GR = PM.graphe, R = PM.rendu, CAT = PM.catalogue;
const F5 = G.format('5x5');

const C5 = CAT.modelesParGrille['5x5'];
const modele = (id) => C5.find((m) => m.id === id);
const parGabarit = (g) => C5.filter((m) => m.gabarit === g);
const copie = (o) => JSON.parse(JSON.stringify(o));
const IDS5 = ['U1', 'P3', 'P5', 'P1', 'P2', 'B1', 'B7', 'K2'];

const { problemesTrace: tracesPb, reglesPassages, signature } = require('./aides-trace.js');
const problemesTrace = (m) => tracesPb(m, '5x5');

const porteuses = (m) => m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']);
const liens = (m) => m.chemins.filter((ch) => ch.b['case'] !== undefined);
const lateraux = (m) => m.chemins.filter((ch) => ch.b.raccord !== undefined);

/* ================================ contenu ================================ */

test('catalogue 5×5 : 8 modèles (K2 ; B1, B7 ; U1, P1, P2, P3, P5), grille 5×5, cases Ø 20, ids et noms distincts', () => {
  assert.deepEqual(parGabarit('coin').map((m) => m.id), ['K2']);
  assert.deepEqual(parGabarit('bord').map((m) => m.id), ['B1', 'B7']);
  assert.deepEqual(parGabarit('centrale').map((m) => m.id), ['U1', 'P3', 'P5', 'P1', 'P2']);
  assert.equal(C5.length, 8);
  assert.deepEqual(C5.map((m) => m.id), IDS5);
  assert.ok(C5.every((m) => m.grille === '5x5' && !('role' in m)));
  assert.ok(C5.every((m) => m.cases.every((c) => c.diametre === F5.DIAMETRE_CASE && c.diametre === 20)));
  assert.equal(new Set(C5.map((m) => m.nom)).size, 8);
  for (const m of C5) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 20, m.id);
    for (const el of m.cases.concat(m.chemins, m.passages || [], m.pivots || [])) assert.equal(typeof el.id, 'string', m.id);
  }
  // pas de mur (C5), pas de K4 (trop serré dans 100 mm), plus de miroir B7m ni des anciennes centrales C7 / C8 (catalogue précédent)
  for (const id of ['C5', 'K4', 'B7m', 'C7', 'C8', 'P6', 'B9', 'P0']) assert.equal(modele(id), undefined, id);
});

test('catalogue 5×5 : 37 exemplaires (5 coins, 14 bords, 18 centrales) pour 30 de poids de tirage (docs/47), B1 à 6 (78 à 81 cases), coordonnées de docs/45', () => {
  const total = (g) => parGabarit(g).reduce((s, m) => s + m.exemplaires, 0);
  assert.deepEqual([total('coin'), total('bord'), total('centrale')], [5, 14, 18]);
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.exemplaires])), { U1: 5, P3: 4, P5: 3, P1: 3, P2: 3, B1: 6, B7: 8, K2: 5 });
  assert.equal(C5.reduce((s, m) => s + m.exemplaires, 0), 37);
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.poids])), { U1: 5, P3: 2, P5: 2, P1: 1, P2: 1, B1: 6, B7: 8, K2: 5 });
  const pos = (m) => Object.fromEntries(m.cases.map((c) => [c.id, [c.x, c.y]]));
  assert.deepEqual(pos(modele('K2')), { a: [32, 32], r: [53, 53], c1: [74, 74] });
  assert.deepEqual(pos(modele('B1')), { a: [50, 40], c1: [82, 66], c2: [18, 66] });
  assert.deepEqual(pos(modele('B7')), { a: [56, 38], c1: [84, 64] });
  assert.deepEqual(pos(modele('U1')), { r: [58, 44], c1: [26, 26], c2: [74, 26], c3: [74, 74] });
  assert.deepEqual(pos(modele('P3')), { s: [50, 70], c4: [24, 76], c3: [76, 76] });
  assert.deepEqual(modele('P3').pivots, [{ id: 'v', x: 50, y: 34 }]);
  // identiques aux modèles de outils/catalogue-organique.js, aux exemplaires près (B1 3 -> 6, B7 12 -> 8 : docs/46)
  require('../outils/catalogue-organique.js');
  const o = PM.catalogueOrganique.modelesParGrille['5x5'];
  const sans = (m) => { const c = copie(m); delete c.exemplaires; delete c.poids; return c; };
  assert.deepEqual(C5.map(sans), o.map(sans));
});

test('catalogue 5×5 : nombre de cases par tuile (U1 : 4 ; K2, B1, P1, P2, P3, P5 : 3 ; B7 : 2) ; cases = 72 + nB1 + nU1 sur un plateau', () => {
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.cases.length])), { U1: 4, P3: 3, P5: 3, P1: 3, P2: 3, B1: 3, B7: 2, K2: 3 });
  // 4 K2 (12) + 9 centrales (27 + nU1) + 12 bords (24 + nB1) + 9 jonctions-cases ; ports = 4 + 18 + nU1 + 12 + nB1 = cases - 38
  const ports = (m) => porteuses(m).length;
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, ports(m)])), { U1: 3, P3: 2, P5: 2, P1: 2, P2: 2, B1: 2, B7: 1, K2: 1 });
  for (const m of C5) assert.equal(m.cases.length - ports(m), m.gabarit === 'coin' ? 2 : 1, m.id + ' : une case de plus que de ports (deux pour le coin)');
});

test('catalogue 5×5 : aucune erreur ni alerte de validerModele(m, 5x5) ; aucune poche, par la règle et par un calcul indépendant', () => {
  for (const m of C5) {
    const v = M.validerModele(m, '5x5');
    assert.deepEqual(v.erreurs, [], m.id);
    assert.deepEqual(v.alertes, [], m.id);
    for (const c of m.cases.filter((x) => x.type !== 'apparition')) {
      const touches = m.chemins.filter((ch) => ch.a['case'] === c.id || ch.b['case'] === c.id);
      const sorties = touches.filter((ch) => ch.b['case'] === undefined || ch.a['case'] === undefined).length +
        (m.passages || []).filter((p) => p.a['case'] === c.id || p.b['case'] === c.id).length;
      assert.ok(touches.length >= 2 || sorties >= 1, `${m.id} : ${c.id} est une impasse`);
    }
  }
});

test('passages (docs/18) : ni vers un coin, ni traversant (P3 : T qui porte des cases, pas un traversant), jamais sur une porteuse ni depuis l\'apparition, un T au plus, aucun mur', () => {
  for (const m of C5) assert.deepEqual(reglesPassages(m, '5x5'), [], m.id);
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, (m.passages || []).length])), { U1: 1, P3: 3, P5: 2, P1: 1, P2: 1, B1: 0, B7: 0, K2: 0 });
  // P3 : un T (3 passages autour d'un pivot) relie O, N et E ; aucune de ses branches ne va d'un côté au côté opposé
  const p3 = modele('P3');
  assert.ok(p3.passages.every((p) => p.b.pivot === 'v' && p.a.raccord));
  // bords et coin : aucun passage (le coin ne peut pas en porter : ses deux raccords sont le raccourci)
  assert.ok(parGabarit('bord').concat(parGabarit('coin')).every((m) => !(m.passages || []).length));
});

/* ================================ tracés ================================ */

test('tracés 5×5 : 8 mm entre chemins, r + 4 mm des autres cases, 24 mm des coins (sauf le port)', () => {
  assert.deepEqual([].concat(...C5.map(problemesTrace)), []);
  assert.equal(F5.LARGEUR_CHEMIN, 8);
  assert.equal(F5.RAYON_ZONE_COIN, 20);
});

test('tracés 5×5 : le contrôle détecte un chemin qui traverse une case, ou qui entre dans une zone de coin (témoins)', () => {
  const m = copie(modele('P5'));
  m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c3' } }); // diagonale NO-SE : passe par le relais r (50, 50)
  assert.ok(problemesTrace(m).some((t) => t.includes('de r')), problemesTrace(m).join(' | '));
  const k = copie(modele('K2'));
  Object.assign(k.cases.find((c) => c.id === 'r'), { x: 60, y: 45 }); // r près du chemin de l'apparition vers le raccord E
  assert.ok(problemesTrace(k).length > 0, 'K2 déformé');
  assert.ok(M.validerModele(k, '5x5').erreurs.some((e) => e.code === 'chemin_case'));
  const b = copie(modele('B7'));
  Object.assign(b.cases.find((c) => c.id === 'c1'), { x: 90, y: 90 }); // case et port dans la zone du coin SE
  assert.ok(problemesTrace(b).some((t) => t.includes('zone du coin')), problemesTrace(b).join(' | '));
  assert.ok(M.validerModele(b, '5x5').erreurs.some((e) => e.code === 'zone_coin'));
});

/* ================================ règles R1 à R4 ================================ */

test('règles R1 à R4 : un port par case au plus, porteuses jamais reliées, aucun raccord sur une porteuse, aucun port sur l\'apparition', () => {
  for (const m of C5) {
    const ports = porteuses(m);
    assert.equal(new Set(ports).size, ports.length, m.id + ' R1 : deux ports sur une case');
    for (const ch of liens(m)) {
      assert.ok(!(ports.includes(ch.a['case']) && ports.includes(ch.b['case'])), `${m.id} R2 : ${ch.id} relie deux porteuses`);
    }
    for (const ch of lateraux(m)) assert.ok(!ports.includes(ch.a['case']), `${m.id} R3 : ${ch.id} part d'une porteuse`);
    for (const c of m.cases.filter((x) => x.type === 'apparition')) assert.ok(!ports.includes(c.id), `${m.id} R4`);
  }
});

test('catalogue 5×5 : raccords au milieu pour les centrales (chemins ou passages), raccourci et raccord S seuls sur les bords, raccourci seul sur le coin', () => {
  for (const m of C5) {
    const r = M.masquesDuModele(m).raccords;
    if (m.gabarit === 'centrale') {
      assert.equal(r, 0x492, m.id);
      for (let cote = 0; cote < 4; cote++) assert.equal(G.triplet(r, cote), 0b010, `${m.id} côté ${cote}`);
      // les raccords de chemins partent d'une case sans port (le relais) ; les autres côtés sont pris par des passages
      assert.ok(lateraux(m).every((ch) => !porteuses(m).includes(ch.a['case'])), m.id);
    } else if (m.gabarit === 'bord') {
      assert.equal(r, 0x808 | 0x080, `${m.id} : raccourci E0 + O2 et raccord S au milieu, rien d'autre`);
      assert.equal(G.triplet(r, 0), 0, `${m.id} : rien sur le côté extérieur`);
    } else {
      assert.equal(r, 0x108, `${m.id} : raccourci du coin et rien d'autre`);
    }
  }
});

test('catalogue 5×5 : ports (coins intérieurs seulement), apparition unique sur bords et coins, raccords tirés de l\'apparition', () => {
  assert.equal(M.masquesDuModele(modele('B1')).portsCoin, 0b1100);
  assert.equal(M.masquesDuModele(modele('B7')).portsCoin, 0b0100);   // SE
  assert.equal(M.masquesDuModele(modele('K2')).portsCoin, 0b0100);
  assert.equal(M.masquesDuModele(modele('U1')).portsCoin, 0b0111);   // NO + NE + SE
  assert.equal(M.masquesDuModele(modele('P1')).portsCoin, 0b0101);   // NO + SE
  assert.equal(M.masquesDuModele(modele('P5')).portsCoin, 0b0101);   // NO + SE
  assert.equal(M.masquesDuModele(modele('P2')).portsCoin, 0b0110);   // NE + SE
  assert.equal(M.masquesDuModele(modele('P3')).portsCoin, 0b1100);   // SE + SO
  for (const m of C5) {
    const a = m.cases.filter((c) => c.type === 'apparition');
    assert.equal(a.length, m.gabarit === 'centrale' ? 0 : 1, m.id);
    assert.equal(M.aUneApparition(m), m.gabarit !== 'centrale', m.id);
    if (m.gabarit !== 'centrale') assert.ok(lateraux(m).every((ch) => ch.a['case'] === a[0].id), m.id);
  }
});

test('aucune paire miroir (docs/18) : aucun modèle n\'est le reflet d\'un autre ; B7 sert seul, par rotation (plus de B7m)', () => {
  for (const a of C5) for (const b of C5) for (let rot = 0; rot < 4; rot++) {
    if (a !== b) assert.notStrictEqual(signature(a, rot, true), signature(b, 0), `${a.id} reflété = ${b.id}`);
  }
  // aucune centrale n'est la copie tournée d'une autre
  const centrales = parGabarit('centrale');
  for (let i = 0; i < centrales.length; i++) for (let j = i + 1; j < centrales.length; j++) for (let rot = 0; rot < 4; rot++) {
    assert.notStrictEqual(signature(centrales[i], rot), signature(centrales[j], 0), `${centrales[i].id} tourné = ${centrales[j].id}`);
  }
  // le générateur ne trouve aucun miroir à substituer dans ce catalogue
  for (const a of C5) for (const b of C5) if (a !== b) assert.equal(PM.generateur.sontMiroirs(a, b, F5), false, a.id + ' / ' + b.id);
  // témoin : l'ancien B7m (catalogue précédent) est bien le miroir de B7
  const b7m = CAT.precedent['5x5'].find((m) => m.id === 'B7m');
  assert.ok([0, 1, 2, 3].some((rot) => signature(b7m, rot, true) === signature(modele('B7'), 0)));
  assert.equal(PM.generateur.sontMiroirs(modele('B7'), b7m, F5), true);
});

test('catalogue précédent 5×5 (version 3.04) : gardé, gelé et intact ; B1, B7 et K2 identiques aux exemplaires près', () => {
  const p = CAT.precedent['5x5'];
  assert.deepEqual(p.map((m) => m.id), ['C7', 'C8', 'B1', 'B7', 'B7m', 'K2']);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p[0].chemins[0].b));
  for (const id of ['B1', 'B7', 'K2']) {
    const a = copie(modele(id)), b = copie(p.find((m) => m.id === id));
    delete a.exemplaires; delete b.exemplaires; delete a.poids; delete b.poids;
    assert.deepEqual(a, b, id);
  }
});

/* ================================ raccourci dans les rotations imposées ================================ */

/** Document 5×5 avec les tuiles données [{id, col, lig, rot}], sans contrôle d'exemplaires. */
function docAvec(tuiles) {
  const doc = CAT.nouveauDocument('5x5');
  doc.modeles.forEach((m) => { m.exemplaires = 10; });
  doc.plateau.tuiles = tuiles.map((t) => ({ modeleId: t.id, col: t.col, lig: t.lig, rot: t.rot }));
  return doc;
}
/** Le raccourci relie-t-il deux tuiles voisines ? Lien direct entre cases (hors porteuses) et apparitions à 1 pas. */
function raccourciRelie(doc, a, b) {
  const g = GR.construire(doc, { jetons: [] });
  const cle = (t) => `${t.col},${t.lig}:`;
  const dans = (t) => [...g.cases.values()].filter((c) => c.id.startsWith(cle(t)));
  const appar = (t) => dans(t).filter((c) => c.type === 'apparition')[0].id;
  const porteuse = (id) => [...g.voisins.get(id)].some((v) => !g.cases.has(v));
  const ls = [];
  for (const c of dans(a)) for (const v of g.voisins.get(c.id)) if (g.cases.has(v) && v.startsWith(cle(b))) ls.push([c.id, v]);
  if (!ls.length || ls.some(([x, y]) => porteuse(x) || porteuse(y))) return false;
  return GR.distances(g, appar(a)).get(appar(b)) === 1;
}
const tuile = (id, col, lig) => ({ id, col, lig, rot: M.rotationDeduite(col, lig, modele(id).gabarit, '5x5') });
const nbMorts = (doc) => M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;

test('raccourci 5×5 : coin–bord aux 4 coins du plateau, de chaque côté, pour K2 et chaque bord (rotations imposées)', () => {
  const dispositions = [
    { coin: [0, 0], bords: [[1, 0], [0, 1]] }, { coin: [4, 0], bords: [[3, 0], [4, 1]] },
    { coin: [4, 4], bords: [[3, 4], [4, 3]] }, { coin: [0, 4], bords: [[1, 4], [0, 3]] }
  ];
  let essais = 0;
  for (const b of parGabarit('bord')) for (const d of dispositions) for (const [bc, bl] of d.bords) {
    const tk = tuile('K2', d.coin[0], d.coin[1]), tb = tuile(b.id, bc, bl);
    const doc = docAvec([tk, tb]);
    assert.ok(raccourciRelie(doc, tk, tb), `K2 en (${tk.col},${tk.lig}) rot ${tk.rot} et ${b.id} en (${bc},${bl}) rot ${tb.rot}`);
    assert.equal(nbMorts(doc), 0);
    essais++;
  }
  assert.equal(essais, 2 * 8);
});

test('raccourci 5×5 : bord–bord voisins sur les 4 côtés (2 paires par côté), pour toutes les paires de bords', () => {
  const cotes = [
    [[1, 0], [2, 0], [3, 0]], [[4, 1], [4, 2], [4, 3]], [[3, 4], [2, 4], [1, 4]], [[0, 3], [0, 2], [0, 1]]
  ];
  let essais = 0;
  for (const a of parGabarit('bord')) for (const b of parGabarit('bord')) for (const c of cotes) for (let k = 0; k < 2; k++) {
    const ta = tuile(a.id, c[k][0], c[k][1]), tb = tuile(b.id, c[k + 1][0], c[k + 1][1]);
    const doc = docAvec([ta, tb]);
    assert.ok(raccourciRelie(doc, ta, tb), `${a.id} (${c[k]}) et ${b.id} (${c[k + 1]})`);
    assert.equal(nbMorts(doc), 0);
    essais++;
  }
  assert.equal(essais, 4 * 4 * 2);
});

test('raccords du milieu 5×5 : bord face à centrale et centrale face à centrale se rejoignent (toutes rotations), sans raccord mort', () => {
  for (const b of parGabarit('bord')) for (const c of parGabarit('centrale')) for (let rot = 0; rot < 4; rot++) {
    const doc = docAvec([tuile(b.id, 2, 0), { id: c.id, col: 2, lig: 1, rot }]);
    assert.equal(nbMorts(doc), 0, `${b.id} / ${c.id} rot ${rot}`);
    // le raccord S du bord relie son apparition à la centrale : par un chemin (relais) ou par un passage (cases du réseau)
    const g = GR.construire(doc, { jetons: [] });
    assert.ok([...g.voisins.get('2,0:a')].some((v) => v.startsWith('2,1:')) || c.passages.some((p) => p.a.raccord || p.b.raccord), `${b.id} / ${c.id} rot ${rot}`);
  }
  for (const c1 of parGabarit('centrale')) for (const c2 of parGabarit('centrale')) for (let r = 0; r < 4; r++) {
    const doc = docAvec([{ id: c1.id, col: 1, lig: 1, rot: 0 }, { id: c2.id, col: 2, lig: 1, rot: r }]);
    assert.equal(nbMorts(doc), 0, `${c1.id} / ${c2.id} rot ${r}`);
  }
});

/* ================================ nouveauDocument et API ================================ */

test('API : modeles reste le 4×4 ; modelesParGrille gelé { 4x4, 5x5 } ; precedent gelé', () => {
  assert.equal(CAT.modeles.length, 6);
  assert.equal(CAT.modelesParGrille['4x4'], CAT.modeles);
  assert.deepEqual(Object.keys(CAT.modelesParGrille), ['4x4', '5x5']);
  assert.ok(Object.isFrozen(CAT.modelesParGrille) && Object.isFrozen(C5));
  assert.ok(Object.isFrozen(modele('U1').cases[0]) && Object.isFrozen(modele('U1').chemins[0].b) && Object.isFrozen(modele('P3').pivots[0]));
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4'));
  assert.deepEqual(Object.keys(CAT.precedent), ['4x4', '5x5']);
  assert.ok(Object.isFrozen(CAT.precedent));
});

test('nouveauDocument(\'5x5\') : document 5×5 vide avec une copie modifiable des 8 modèles ; défaut 4×4 ; grille inconnue refusée', () => {
  const doc = CAT.nouveauDocument('5x5');
  assert.equal(doc.version, 2);
  assert.equal(doc.grille, '5x5');
  assert.deepEqual(doc.plateau, M.nouveauDocument('5x5').plateau);
  assert.deepEqual(doc.modeles, copie(C5));
  doc.modeles.forEach((m) => assert.deepEqual(M.validerModele(m, '5x5').erreurs, []));
  M.modeleParId(doc, 'U1').cases[0].x = 1;
  M.modeleParId(doc, 'P3').pivots[0].x = 1;
  doc.modeles.pop();
  assert.equal(modele('U1').cases[0].x, 58);
  assert.equal(modele('P3').pivots[0].x, 50);
  assert.equal(C5.length, 8);
  assert.notEqual(CAT.nouveauDocument('5x5').modeles, CAT.nouveauDocument('5x5').modeles);
  assert.equal(CAT.nouveauDocument().grille, '4x4');
  assert.equal(CAT.nouveauDocument('4x4').modeles.length, 6);
  for (const g of ['6x6', 'hex', '', 5, {}, 'constructor', '__proto__']) assert.throws(() => CAT.nouveauDocument(g), /Grille inconnue/, String(g));
});

test('interface : documentPourGrille(\'5x5\') accepte le document du catalogue ; 4×4 reste accepté ; grille inconnue refusée', () => {
  const r = PM.nouveau.documentPourGrille('5x5');
  assert.equal(r.ok, true, r.raison);
  assert.equal(r.doc.grille, '5x5');
  assert.deepEqual(r.doc.modeles.map((m) => m.id), C5.map((m) => m.id));
  assert.ok(r.doc.modeles.every((m) => m.grille === '5x5'));
  assert.equal(r.doc.plateau.tuiles.length, 0);
  const r4 = PM.nouveau.documentPourGrille('4x4');
  assert.equal(r4.ok, true);
  assert.equal(r4.doc.modeles.length, 6);
  assert.equal(PM.nouveau.documentPourGrille('7x7').ok, false);
  // la bibliothèque reconnaît les modèles livrés de chaque grille
  assert.equal(PM.bibliotheque.estTuileUtilisateur(r.doc, 'K2'), false);
  const ajoute = M.ajouterModele(r.doc, Object.assign(copie(modele('U1')), { id: 'Z9' }));
  assert.equal(PM.bibliotheque.estTuileUtilisateur(ajoute, 'Z9'), true);
});

/* ================================ plateau 5×5 complet ================================ */

/**
 * Plateau plein fixé ici (tiré par le générateur, graine « plateau-14 », 30 candidats, puis figé) : coins K2 aux 4 coins, 4 B1 + 8 B7
 * sur les 12 cases de bord (rotation imposée par la place), 9 centrales (4 U1, P1, 2 P3, 2 P5) dont la rotation (quatrième valeur) donne
 * à chaque jonction intérieure au moins 2 ports. Il tient dans le jeu imprimé (exemplaires), a 80 cases (moitiés de 29 cases chacune),
 * 42 ports, 10 jonctions à 3 ports et 20 placements « 2-3-2 » des 7 villes admissibles (au moins 3 ports à chaque ville).
 */
const PLATEAU = [
  ['K2', 0, 0], ['B7', 1, 0], ['B7', 2, 0], ['B7', 3, 0], ['K2', 4, 0],
  ['B7', 0, 1], ['U1', 1, 1, 1], ['P1', 2, 1, 2], ['U1', 3, 1, 3], ['B7', 4, 1],
  ['B1', 0, 2], ['U1', 1, 2, 3], ['U1', 2, 2, 2], ['P3', 3, 2, 3], ['B1', 4, 2],
  ['B7', 0, 3], ['P5', 1, 3, 1], ['P3', 2, 3, 2], ['P5', 3, 3, 3], ['B7', 4, 3],
  ['K2', 0, 4], ['B1', 1, 4], ['B1', 2, 4], ['B7', 3, 4], ['K2', 4, 4]
];
const VILLES = [[2, 1], [4, 1], [1, 2], [2, 2], [2, 3], [1, 4], [3, 4]]; // 2-3-2, chacune à 3 ports
function plateauComplet() {
  const doc = CAT.nouveauDocument('5x5');
  doc.plateau.tuiles = PLATEAU.map(([id, col, lig, rot]) => ({
    modeleId: id, col, lig, rot: rot !== undefined ? rot : M.rotationDeduite(col, lig, modele(id).gabarit, '5x5')
  }));
  return doc;
}

test('plateau 5×5 complet : 25 tuiles dans les exemplaires, aucune erreur ni alerte, aucun raccord mort, aucune jonction mal reliée', () => {
  const doc = plateauComplet();
  assert.equal(doc.plateau.tuiles.length, 25);
  const utilises = {};
  doc.plateau.tuiles.forEach((t) => { utilises[t.modeleId] = (utilises[t.modeleId] || 0) + 1; });
  assert.deepEqual(utilises, { K2: 4, B7: 8, U1: 4, P1: 1, B1: 4, P3: 2, P5: 2 });
  for (const m of C5) assert.ok((utilises[m.id] || 0) <= m.exemplaires, `${m.id} : ${utilises[m.id]} posés pour ${m.exemplaires} exemplaires`);
  const v = M.validerPlateau(doc);
  assert.deepEqual(v.erreurs, []);
  assert.deepEqual(v.alertes, []);
  assert.deepEqual(M.raccordsMorts(doc), []);
  assert.deepEqual(M.jonctionsMalReliees(doc), []);
  for (const t of doc.plateau.tuiles) assert.equal(M.gabaritCellule(t.col, t.lig, '5x5'), M.modeleParId(doc, t.modeleId).gabarit);
});

test('plateau 5×5 complet : 80 cases (71 des tuiles + 9 jonctions-cases), 42 ports, au moins 2 ports à chaque jonction, 10 jonctions à 3, moitiés égales', () => {
  const doc = plateauComplet();
  const g = GR.construire(doc, { jetons: VILLES.map(([i, j]) => ({ i, j, type: 'capture' })) });
  assert.equal(g.jonctions.length, 16);
  assert.equal(g.villes.size, 7);
  assert.equal(g.cases.size, 4 * 3 + 4 * 3 + 8 * 2 + 4 * 4 + 5 * 3);
  const jonctionsCases = g.jonctions.filter((j) => j.type === 'case').length;
  assert.equal(jonctionsCases, 9);
  assert.equal(g.cases.size + jonctionsCases, 80);
  assert.equal(g.cases.size + jonctionsCases, 72 + 4 + 4, 'cases = 72 + nB1 + nU1');
  const ports = g.jonctions.map((j) => j.ports);
  assert.equal(ports.reduce((a, b) => a + b, 0), 42);
  assert.ok(Math.min(...ports) >= 2, 'ports par jonction : ' + ports.join());
  assert.equal(ports.filter((p) => p >= 3).length, 10);
  for (const j of g.jonctions.filter((x) => x.type === 'ville')) assert.ok(j.ports >= 3, `ville (${j.i},${j.j})`);
  for (const j of g.jonctions) assert.equal(M.portsJonction(doc, j.i, j.j).ports, j.ports, `(${j.i},${j.j})`);
  assert.ok(GR.connexe(g));
  // décision 2 (docs/18) : autant de cases de part et d'autre (rangée neutre et jonctions du milieu à part)
  const mo = GR.casesParMoitie(doc, g);
  assert.deepEqual([mo.vert, mo.rouge, mo.ecart], [29, 29, 0]);
  assert.equal(mo.tuiles.vert + mo.tuiles.rouge + mo.tuiles.neutre + mo.jonctions.vert + mo.jonctions.rouge + mo.jonctions.milieu, 80);
  // plusieurs placements de villes admissibles (docs/18, réponse 1)
  assert.equal(PM.generateur.placementsAdmissibles5x5(doc), 20);
});

test('plateau 5×5 complet : R1 à R3 lues dans le graphe, écart d\'au moins 4 pas entre deux jonctions, apparitions des deux camps', () => {
  const doc = plateauComplet();
  const g = GR.construire(doc, { jetons: [] });
  const jonction = (id) => !g.cases.has(id);
  for (const [id] of g.cases) {
    const js = [...g.voisins.get(id)].filter(jonction);
    assert.ok(js.length <= 1, id + ' : R1');
    if (js.length) for (const v of g.voisins.get(id)) {
      if (jonction(v)) continue;
      assert.equal([...g.voisins.get(v)].filter(jonction).length, 0, `${id} et ${v} : R2 / R3`);
    }
  }
  let mini = Infinity;
  for (const a of g.jonctions) {
    const d = GR.distances(g, a.id);
    for (const b of g.jonctions) if (a !== b && d.has(b.id)) mini = Math.min(mini, d.get(b.id));
  }
  assert.ok(mini >= 4, 'écart minimal ' + mini);
  assert.equal(g.apparitions[1].length, 5 + 2);
  assert.equal(g.apparitions[2].length, 5 + 2);
});

test('pose libre 5×5 : l\'écart d\'au moins 4 pas entre jonctions tient dans toutes les rotations des centrales (200 tirages au hasard)', () => {
  const GEN = PM.generateur, rng = GEN.mulberry32(5), doc0 = CAT.nouveauDocument('5x5');
  const dispo = GEN.modelesParGabarit(doc0, F5), cellules = GEN.cellulesDuFormat(F5);
  for (let k = 0; k < 200; k++) {
    const doc = copie(doc0);
    doc.plateau.tuiles = GEN.tirerTuiles(dispo, cellules, F5, rng);
    const g = GR.construire(doc, { jetons: [] });
    let mini = Infinity;
    for (const a of g.jonctions) {
      const d = GR.distances(g, a.id);
      for (const b of g.jonctions) if (a !== b && d.has(b.id)) mini = Math.min(mini, d.get(b.id));
    }
    assert.ok(mini >= 4, 'tirage ' + k + ' : écart ' + mini);
    assert.deepEqual(M.validerPlateau(doc).erreurs, []);
  }
});

/* ================================ recette du testeur : cas limites (chaîne complète) ================================ */

const VILLES_JETONS = VILLES.map(([i, j]) => ({ i, j, type: 'capture' }));
function plateauAvecVilles() {
  const doc = plateauComplet();
  doc.plateau.jetons = copie(VILLES_JETONS);
  return doc;
}
/** Modèle 4×4 du catalogue livré, sous un autre identifiant (pour l'ajouter à un document 5×5). */
const modele4 = (id, nouvelId) => Object.assign(copie(CAT.modelesParGrille['4x4'].find((m) => m.id === id)), { id: nouvelId || id });

test('chaîne : enregistrement / réouverture JSON d\'un plateau 5×5 complet, sans perte ni alerte, grille conservée', () => {
  const doc = plateauAvecVilles();
  const texte = PM.sauvegarde.versJSON(doc);
  assert.equal(JSON.parse(texte).grille, '5x5');
  const r = PM.sauvegarde.depuisJSON(texte);
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes, []);
  assert.equal(r.migre, false);
  assert.equal(r.doc.grille, '5x5');
  assert.deepEqual(r.doc.modeles, doc.modeles);
  assert.deepEqual(r.doc.plateau, doc.plateau);
  // la réouverture est stable (deuxième aller-retour identique) et valide encore
  const r2 = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(r.doc));
  assert.deepEqual(r2.doc, r.doc);
  const v = M.validerPlateau(r.doc);
  assert.deepEqual([v.erreurs, v.alertes], [[], []]);
  // document 5×5 vide (juste après « Nouveau ») : aller-retour sans perte ni changement de grille
  const vide = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(CAT.nouveauDocument('5x5')));
  assert.equal(vide.ok, true);
  assert.equal(vide.doc.grille, '5x5');
  assert.equal(vide.doc.modeles.length, 8);
});

test('chaîne : un fichier 5×5 dont l\'en-tête `grille` manque n\'est pas lu sans aucun signalement', () => {
  const o = JSON.parse(PM.sauvegarde.versJSON(plateauComplet()));
  delete o.grille;
  const r = PM.sauvegarde.depuisJSON(JSON.stringify(o));
  // soit le fichier est refusé, soit il est lu en 4×4 avec des alertes / erreurs sur les modèles ou le plateau : jamais « tout va bien »
  const signale = !r.ok || r.alertes.length > 0 || (r.doc && (M.validerPlateau(r.doc).erreurs.length > 0 ||
    r.doc.modeles.some((m) => M.validerModele(m, M.formatDuDocument(r.doc)).erreurs.length > 0)));
  assert.ok(signale, 'un fichier 5×5 sans grille a été lu sans aucun signalement');
});

test('chaîne : annuler / rétablir sur un document 5×5 (pose, remplacement), grille et catalogue inchangés', () => {
  const etat = PM.etat.creer(CAT.nouveauDocument('5x5'));
  assert.equal(etat.doc().grille, '5x5');
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'K2', 0, 0)), { ok: true });
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'B7', 1, 0)), { ok: true });
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'U1', 2, 2, 1)), { ok: true });
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.deepEqual(etat.doc().plateau.tuiles[0], { modeleId: 'K2', col: 0, lig: 0, rot: 0 });
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 2);
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 1);
  assert.ok(etat.peutRetablir());
  etat.retablir(); etat.retablir();
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.deepEqual(etat.doc().plateau.tuiles[2], { modeleId: 'U1', col: 2, lig: 2, rot: 1 });
  assert.ok(!etat.peutRetablir());
  // pose refusée : le document ne change pas
  const avant = JSON.stringify(etat.doc());
  const refus = etat.appliquer((d) => M.poserTuile(d, 'U1', 0, 0));
  assert.equal(refus.ok, false);
  assert.equal(JSON.stringify(etat.doc()), avant);
  // remplacement complet par un document 4×4 puis annulation : retour au 5×5
  etat.remplacer(CAT.nouveauDocument('4x4'), 'Nouveau 4×4');
  assert.equal(etat.doc().grille, '4x4');
  etat.annuler();
  assert.equal(etat.doc().grille, '5x5');
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.equal(modele('K2').cases[0].x, 32);
});

test('chaîne : PM.controles.calculer sur le plateau 5×5 complet (7 villes) : aucune erreur ni alerte, compteurs 5×5 à leur cible', () => {
  const c = PM.controles.calculer(plateauAvecVilles());
  assert.deepEqual(c.erreurs, []);
  assert.deepEqual(c.alertes, []);
  const v = (cle) => c.compteurs.find((x) => x.cle === cle);
  assert.equal(v('villes').valeur, 7);
  assert.equal(v('cases').valeur, 80);
  assert.equal(v('tuiles').valeur, 25);
  assert.equal(v('tuiles').cible, 25);
  assert.deepEqual([v('apparitions_vert').valeur, v('apparitions_rouge').valeur], [7, 7]);
  assert.equal(v('dimensions').valeur, '50 × 50 cm');
  assert.equal(v('tuiles_petites').valeur, 0);
  assert.ok(c.compteurs.every((x) => x.etat === 'ok'), JSON.stringify(c.compteurs.filter((x) => x.etat !== 'ok')));
});

test('chaîne : PM.controles.calculer sur un document 5×5 vide et sur des plateaux partiels ne lève pas d\'erreur', () => {
  const vide = PM.controles.calculer(CAT.nouveauDocument('5x5'));
  assert.deepEqual(vide.erreurs, []);
  assert.equal(vide.compteurs.find((x) => x.cle === 'tuiles').valeur, 0);
  const partiel = docAvec([tuile('K2', 0, 0)]);
  assert.doesNotThrow(() => PM.controles.calculer(partiel));
  partiel.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }];
  assert.doesNotThrow(() => PM.controles.calculer(partiel));
  // plateau complet moins un bord : calculable, et le trou est signalé (pas de silence)
  const trou = plateauAvecVilles();
  trou.plateau.tuiles = trou.plateau.tuiles.filter((t) => !(t.col === 2 && t.lig === 0));
  const c = PM.controles.calculer(trou);
  assert.ok(c.erreurs.length + c.alertes.length > 0, 'un plateau 5×5 troué ne déclenche ni erreur ni alerte');
});

test('chaîne : rapport d\'équilibre du plateau 5×5 complet (grille 5x5, 7 villes, complet, pas de blocage)', () => {
  const doc = plateauAvecVilles();
  const a = PM.equilibre.analyser(doc);
  assert.equal(a.grille, '5x5');
  const r = PM.equilibre.rapport(a);
  assert.equal(r.complet, true);
  assert.deepEqual(r.blocages, []);
  assert.deepEqual(r.lacunes, []);
  assert.equal(r.rangs.length, 7);
  assert.ok(r.rangs.every((x) => !x.fort), JSON.stringify(r.rangs));
  assert.equal(r.aSurveiller, false);
  assert.equal(a.resultat.tresDesequilibre, false);
  assert.equal(r.rangs[0].d1, r.rangs[0].d2);
  // sans ville : analyse sans exception, rapport incomplet
  const sans = PM.equilibre.rapport(PM.equilibre.analyser(plateauComplet()));
  assert.equal(sans.complet, false);
});

test('chaîne : export du jeu complet 5×5 : 37 tuiles, planches A3 (2×3) et A4 (1×2), pas de 112 mm, tuile de 106 mm', () => {
  const E = PM.exportation;
  const doc = CAT.nouveauDocument('5x5');
  const liste = E.listeTuiles(doc, { portee: 'stock' });
  assert.equal(liste.tuiles.length, 37);
  assert.deepEqual(liste.exclus, []);
  const a3 = E.calepiner(doc, { format: 'A3' });
  assert.equal(a3.length, 7);                    // 37 / 6 : 6 planches pleines et une d'une tuile (30 tuiles : 5 planches avant docs/47)
  assert.ok(a3.every((p) => p.pas === 112) && a3.slice(0, 6).every((p) => p.tuiles.length === 6) && a3[6].tuiles.length === 1);
  assert.equal(a3[0].tuiles[1].x - a3[0].tuiles[0].x, 112);
  assert.equal(a3[0].tuiles[2].y - a3[0].tuiles[0].y, 112);
  const a4 = E.calepiner(doc, { format: 'A4' });
  assert.equal(a4.length, 19);                   // 37 / 2 : 18 planches de 2 et une d'une tuile
  assert.ok(a4.every((p) => p.colonnes === 1) && a4.slice(0, 18).every((p) => p.tuiles.length === 2) && a4[18].tuiles.length === 1);
  for (const p of a3.concat(a4)) {
    assert.ok(p.margeX >= E.MARGE_MIN - 1e-9 && p.margeY >= E.MARGE_MIN - 1e-9, `${p.nom} marges ${p.margeX} / ${p.margeY}`);
    const droite = p.margeX + (p.colonnes - 1) * p.pas + 106, bas = p.margeY + (p.lignes - 1) * p.pas + 106;
    assert.ok(p.largeur - droite >= E.MARGE_MIN - 1e-9 && p.hauteur - bas >= E.MARGE_MIN - 1e-9, p.nom);
  }
  for (const p of a3) {
    const svg = p.svg;
    assert.ok(svg.includes('width="106" height="106"'), p.nom);
    assert.ok(!svg.includes('width="126"'), p.nom + ' : cote 4×4 dans une planche 5×5');
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), p.nom);
  }
  const pdf = Buffer.from(E.pdfDepuisPlanches(a3, doc)).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  assert.ok(pdf.includes('/Count 7'));
  assert.ok(pdf.includes('/MediaBox [0 0 841.89 1190.55]'));
  assert.ok(Buffer.from(E.pdfDepuisPlanches(a4.slice(0, 1), doc)).toString('latin1').includes('/MediaBox [0 0 595.28 841.89]'));
});

test('chaîne : export des seules tuiles posées du plateau 5×5 complet (25 tuiles) et PDF', () => {
  const E = PM.exportation, doc = plateauAvecVilles();
  const liste = E.listeTuiles(doc, { portee: 'posees' });
  assert.equal(liste.tuiles.length, 25);
  assert.deepEqual(liste.exclus, []);
  assert.equal(E.calepiner(doc, { format: 'A3', portee: 'posees' }).length, 5); // ceil(25 / 6)
  const planches = E.calepiner(doc, { format: 'A4', portee: 'posees' });
  assert.equal(planches.length, 13);              // ceil(25 / 2)
  assert.ok(E.pdfDepuisPlanches(planches, doc).length > 1000);
});

test('chaîne : aperçu du plateau 5×5 (SVG) : 50 × 50 cm, tuiles tous les 100 mm, PDF', () => {
  const E = PM.exportation, doc = plateauAvecVilles();
  const svg = E.svgApercuPlateau(doc);
  assert.ok(svg.includes('Plateau assemblé 50 x 50 cm, réduit à 54 %'), svg.match(/Plateau assembl[^<]*/)[0]);
  const decalages = (svg.match(/<g transform="translate\((\d+) (\d+)\)" clip-path/g) || []).map((s) => s.match(/\((\d+) (\d+)\)/).slice(1).map(Number));
  assert.equal(decalages.length, 25);
  assert.ok(decalages.every(([x, y]) => x % 100 === 0 && y % 100 === 0 && x <= 400 && y <= 400));
  assert.equal(new Set(decalages.map((d) => d.join())).size, 25);
  assert.ok(svg.includes('width="100" height="100"'));
  assert.ok(!svg.includes('width="120"') && !svg.includes('width="126"'));
  assert.ok(svg.includes('<rect x="0" y="0" width="500" height="500"'), 'cadre 500 × 500 mm');
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined'));
  assert.ok(E.pdfDepuisPlanches([{ svg }], doc).length > 1000);
});

test('chaîne : exemplaires modifiés d\'un document 5×5 : export du stock et réouverture', () => {
  const doc = CAT.nouveauDocument('5x5');
  doc.modeles.find((m) => m.id === 'K2').exemplaires = 0;
  doc.modeles.find((m) => m.id === 'U1').exemplaires = 2;
  assert.equal(PM.exportation.listeTuiles(doc, { portee: 'stock' }).tuiles.length, 37 - 5 - 3);
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  assert.equal(r.doc.modeles.find((m) => m.id === 'K2').exemplaires, 0);
  assert.equal(r.doc.modeles.find((m) => m.id === 'U1').exemplaires, 2);
});

/* ---------------------------- copies indépendantes ---------------------------- */

test('nouveauDocument : copies indépendantes entre elles, du catalogue gelé et de l\'autre grille', () => {
  const a = CAT.nouveauDocument('5x5'), b = CAT.nouveauDocument('5x5'), c4 = CAT.nouveauDocument('4x4');
  const instantane = JSON.stringify(C5);
  const instantane4 = JSON.stringify(CAT.modelesParGrille['4x4']);
  for (const m of a.modeles) {
    const mb = M.modeleParId(b, m.id), mc = modele(m.id);
    assert.notEqual(m, mb); assert.notEqual(m, mc);
    assert.notEqual(m.cases, mb.cases); assert.notEqual(m.cases[0], mc.cases[0]);
    assert.notEqual(m.chemins, mc.chemins); assert.notEqual(m.chemins[0].b, mc.chemins[0].b);
    assert.ok(!Object.isFrozen(m) && !Object.isFrozen(m.cases) && !Object.isFrozen(m.cases[0]), m.id + ' : copie gelée');
  }
  assert.notEqual(a.plateau, b.plateau);
  assert.notEqual(a.plateau.tuiles, b.plateau.tuiles);
  const a7 = M.modeleParId(a, 'U1'); a7.cases[0].x = 1; a7.nom = 'X'; a7.chemins.length = 0; a7.passages.length = 0; M.modeleParId(a, 'P3').exemplaires = 99;
  a.plateau.tuiles.push({ modeleId: 'K2', col: 0, lig: 0, rot: 0 }); a.plateau.jetons.push({ i: 1, j: 1, type: 'capture' });
  assert.equal(M.modeleParId(b, 'U1').cases[0].x, 58);
  assert.equal(M.modeleParId(b, 'U1').nom, 'Trident à virage');
  assert.equal(M.modeleParId(b, 'U1').passages.length, 1);
  assert.equal(M.modeleParId(b, 'P3').exemplaires, 4);
  assert.equal(M.modeleParId(b, 'P3').poids, 2);
  assert.deepEqual(b.plateau, { tuiles: [], jetons: [] });
  assert.deepEqual(CAT.nouveauDocument('5x5').plateau, { tuiles: [], jetons: [] });
  assert.equal(JSON.stringify(C5), instantane);
  assert.equal(JSON.stringify(CAT.modelesParGrille['4x4']), instantane4);
  assert.equal(JSON.stringify(CAT.nouveauDocument('5x5').modeles), instantane);
  assert.equal(c4.modeles.length, 6);
  assert.ok(c4.modeles.every((m) => m.grille === '4x4') && b.modeles.every((m) => m.grille === '5x5'));
  const ids = new Set(b.modeles.map((m) => m.id));
  for (const x of ['Q1', 'Q2', 'B8', 'K4', 'C1', 'C5', 'C7', 'C8', 'B7m']) assert.ok(!ids.has(x), x);
});

test('nouveauDocument : un document réouvert via JSON reste indépendant du catalogue ; les changements purs ne touchent pas l\'original', () => {
  const doc = CAT.nouveauDocument('5x5');
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  M.modeleParId(r.doc, 'B1').cases[0].x = 3;
  assert.equal(modele('B1').cases[0].x, 50);
  const apres = M.changerExemplaires(doc, 'K2', 9);
  assert.equal(M.modeleParId(apres, 'K2').exemplaires, 9);
  assert.equal(M.modeleParId(doc, 'K2').exemplaires, 5);
  assert.equal(modele('K2').exemplaires, 5);
});

/* ---------------------------- 4×4 / 5×5 : refus croisés ---------------------------- */

test('grilles : un modèle 4×4 est refusé dans un document 5×5 (validation, pose, armement)', () => {
  const doc = M.ajouterModele(CAT.nouveauDocument('5x5'), modele4('K2', 'K2-44'));
  const v = M.validerModele(M.modeleParId(doc, 'K2-44'), '5x5');
  assert.ok(v.erreurs.some((e) => e.code === 'grille_modele'), JSON.stringify(v.erreurs));
  assert.equal(v.complet, false);
  const p = M.peutPoserTuile(doc, 'K2-44', 0, 0);
  assert.equal(p.ok, false, 'un modèle 4×4 a été posé sur un coin 5×5');
  assert.throws(() => M.poserTuile(doc, 'K2-44', 0, 0));
  assert.match(PM.bibliotheque.refusArmement(doc, 'K2-44'), /grille/);
  assert.notEqual(PM.bibliotheque.phraseAutreGrille(M.modeleParId(doc, 'K2-44'), doc), '');
  assert.equal(M.peutPoserTuile(doc, 'K2', 0, 0).ok, true);
  assert.equal(PM.bibliotheque.refusArmement(doc, 'K2'), '');
  for (const m of CAT.modelesParGrille['4x4']) {
    assert.ok(M.validerModele(m, '5x5').erreurs.some((e) => e.code === 'grille_modele'), m.id);
  }
});

test('grilles : un modèle 5×5 est refusé dans un document 4×4 (validation, pose, armement)', () => {
  let doc = CAT.nouveauDocument('4x4');
  for (const m of C5) doc = M.ajouterModele(doc, Object.assign(copie(m), { id: m.id + '-55' }));
  for (const m of C5) {
    const id = m.id + '-55';
    assert.ok(M.validerModele(M.modeleParId(doc, id), '4x4').erreurs.some((e) => e.code === 'grille_modele'), id);
    const col = m.gabarit === 'coin' ? 0 : 1, lig = m.gabarit === 'centrale' ? 1 : 0;
    assert.equal(M.peutPoserTuile(doc, id, col, lig).ok, false, id + ' posé en 4×4');
    assert.match(PM.bibliotheque.refusArmement(doc, id), /grille/, id);
  }
});

test('grilles : un modèle sans champ `grille` reste accepté partout (compatibilité des fichiers anciens)', () => {
  const m = copie(modele('K2')); delete m.grille; m.id = 'ancien';
  const doc = M.ajouterModele(CAT.nouveauDocument('5x5'), m);
  assert.equal(PM.bibliotheque.phraseAutreGrille(M.modeleParId(doc, 'ancien'), doc), '');
  assert.ok(!M.validerModele(M.modeleParId(doc, 'ancien'), '5x5').erreurs.some((e) => e.code === 'grille_modele'));
});

test('grilles : une tuile 4×4 posée à la main sur un plateau 5×5 est signalée (validation, contrôles, réouverture JSON)', () => {
  const doc = M.ajouterModele(CAT.nouveauDocument('5x5'), modele4('K2', 'K2-44'));
  doc.plateau.tuiles.push({ modeleId: 'K2-44', col: 0, lig: 0, rot: 0 });
  const v = M.validerPlateau(doc);
  assert.ok(v.erreurs.length + v.alertes.length > 0, 'tuile 4×4 sur un plateau 5×5 acceptée sans signalement');
  const c = PM.controles.calculer(doc);
  assert.ok(c.erreurs.length + c.alertes.length > 0);
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  assert.ok(!r.ok || r.alertes.length > 0 || M.validerPlateau(r.doc).erreurs.length > 0, 'réouverture muette');
});

/* ---------------------------- ids identiques entre grilles ---------------------------- */

test('bibliothèque : K2 / B1 / U1 sont du catalogue dans leur grille ; un id propre à l\'autre grille est une tuile utilisateur', () => {
  const B = PM.bibliotheque, d5 = CAT.nouveauDocument('5x5'), d4 = CAT.nouveauDocument('4x4');
  for (const id of IDS5) assert.equal(B.estTuileUtilisateur(d5, id), false, '5×5 ' + id);
  for (const m of CAT.modelesParGrille['4x4']) assert.equal(B.estTuileUtilisateur(d4, m.id), false, '4×4 ' + m.id);
  assert.equal(B.estTuileUtilisateur(d5, 'inconnu'), false);
  assert.equal(B.estTuileUtilisateur(d4, 'U1'), false);
  // Q1 (catalogue 4×4) ajouté par l'utilisateur dans un document 5×5 : pas une tuile livrée du 5×5
  const d5q1 = M.ajouterModele(d5, Object.assign(copie(modele('U1')), { id: 'Q1' }));
  assert.equal(B.estTuileUtilisateur(d5q1, 'Q1'), true);
  assert.equal(B.supprimerTuileUtilisateur(d5q1, 'Q1').modeles.length, 8);
  // U1 (catalogue 5×5) ajouté par l'utilisateur dans un document 4×4 : tuile utilisateur du 4×4
  const d4u1 = M.ajouterModele(d4, Object.assign(copie(CAT.modelesParGrille['4x4'][0]), { id: 'U1' }));
  assert.equal(B.estTuileUtilisateur(d4u1, 'U1'), true);
  assert.equal(B.supprimerTuileUtilisateur(d4u1, 'U1').modeles.length, 6);
});

test('bibliothèque : suppression interdite des 8 modèles livrés 5×5 (K2 et B1 aussi en 4×4), même posés ou modifiés', () => {
  const B = PM.bibliotheque, doc = plateauAvecVilles();
  for (const id of IDS5) {
    assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('5x5'), id), /catalogue livré/, id);
    assert.throws(() => B.supprimerTuileUtilisateur(doc, id), /catalogue livré/, id + ' posé');
  }
  assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('5x5'), 'zzz'), /introuvable/);
  for (const id of ['K2', 'B1']) assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('4x4'), id), /catalogue livré/, '4×4 ' + id);
  const modif = M.remplacerModele(CAT.nouveauDocument('5x5'), 'K2', Object.assign(copie(modele('K2')), { nom: 'Mon coin' }));
  assert.equal(B.estTuileUtilisateur(modif, 'K2'), false);
  const groupes = B.vignettesBibliotheque(CAT.nouveauDocument('5x5'), 'tous');
  const tous = [].concat(...groupes.map((g) => g.modeles));
  assert.equal(tous.length, 8);
  assert.ok(tous.every((m) => m.utilisateur === false && m.complet && m.posable && m.autreGrille === false), JSON.stringify(tous));
});

test('bibliothèque : suppression d\'une tuile utilisateur 5×5 posée (tuile retirée, annulable en une entrée)', () => {
  const B = PM.bibliotheque;
  let doc = plateauAvecVilles();
  doc = M.ajouterModele(doc, Object.assign(copie(modele('P1')), { id: 'Z1' }));
  doc = M.retirerTuile(doc, 2, 1);
  doc = M.poserTuile(doc, 'Z1', 2, 1, 2);
  assert.equal(B.estTuileUtilisateur(doc, 'Z1'), true);
  assert.equal(B.effetsSuppression(doc, 'Z1').tuilesRetirees, 1);
  const apres = B.supprimerTuileUtilisateur(doc, 'Z1');
  assert.equal(apres.plateau.tuiles.length, 24);
  assert.equal(apres.grille, '5x5');
  assert.equal(M.modeleParId(apres, 'Z1'), null);
  assert.equal(apres.modeles.length, 8);
  const etat = PM.etat.creer(doc);
  etat.appliquer((d) => B.supprimerTuileUtilisateur(d, 'Z1'));
  assert.equal(etat.doc().plateau.tuiles.length, 24);
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 25);
  assert.ok(M.modeleParId(etat.doc(), 'Z1'));
});

/* ---------------------------- poses : chaque modèle n'accepte que sa place ---------------------------- */

test('poses 5×5 : chaque modèle ne se pose que dans les cellules de son gabarit (4 coins, 12 bords, 9 centrales), rotation imposée', () => {
  const doc = CAT.nouveauDocument('5x5');
  const attendus = { coin: 4, bord: 12, centrale: 9 };
  for (const m of C5) {
    let ok = 0;
    for (let lig = 0; lig < 5; lig++) for (let col = 0; col < 5; col++) {
      const role = M.gabaritCellule(col, lig, '5x5');
      const p = M.peutPoserTuile(doc, m.id, col, lig);
      assert.equal(p.ok, role === m.gabarit, `${m.id} en (${col},${lig}) [${role}] : ${p.raison}`);
      if (p.ok) {
        ok++;
        const dedu = M.rotationDeduite(col, lig, m.gabarit, '5x5');
        assert.equal(p.rot, dedu === null ? 0 : dedu, `${m.id} (${col},${lig})`);
        assert.equal(M.poserTuile(doc, m.id, col, lig).plateau.tuiles[0].rot, p.rot);
      } else {
        assert.ok(p.raison.length > 0);
        assert.throws(() => M.poserTuile(doc, m.id, col, lig));
      }
    }
    assert.equal(ok, attendus[m.gabarit], m.id);
  }
});

test('poses 5×5 : cellules hors grille et cellule occupée refusées ; le centre (2,2) est une centrale neutre', () => {
  const doc = CAT.nouveauDocument('5x5');
  for (const [c, l] of [[5, 0], [0, 5], [-1, 0], [0, -1], [5, 5], [7, 2]]) {
    for (const id of ['K2', 'B1', 'U1']) assert.equal(M.peutPoserTuile(doc, id, c, l).ok, false, `${id} (${c},${l})`);
  }
  const un = M.poserTuile(doc, 'U1', 2, 2);
  assert.equal(M.peutPoserTuile(un, 'P3', 2, 2).ok, false);
  assert.equal(M.peutPoserTuile(un, 'U1', 2, 2).ok, false);
  assert.equal(M.gabaritCellule(2, 2, '5x5'), 'centrale');
  assert.equal(F5.campCellule(2, 2), null);
});

test('poses 5×5 : les 4 B7 posés sur les 4 côtés prennent 4 rotations distinctes et leurs ports tombent sur des jonctions intérieures', () => {
  const doc = CAT.nouveauDocument('5x5');
  const cases = [[1, 0], [4, 1], [3, 4], [0, 3]];
  const rots = cases.map(([col, lig]) => M.peutPoserTuile(doc, 'B7', col, lig).rot);
  assert.deepEqual(rots.slice().sort(), [0, 1, 2, 3]);
  const d = docAvec(cases.map(([c, l]) => tuile('B7', c, l)));
  const g = GR.construire(d, { jetons: [] });
  const portes = [...g.cases.keys()].filter((id) => [...g.voisins.get(id)].some((v) => !g.cases.has(v)));
  assert.equal(portes.length, 4);
  for (const id of portes) {
    const j = [...g.voisins.get(id)].filter((v) => !g.cases.has(v));
    assert.equal(j.length, 1, id);
    const [i, jj] = j[0].match(/\d+/g).map(Number);
    assert.ok(i >= 1 && i <= 4 && jj >= 1 && jj <= 4, `${id} -> jonction ${j[0]}`);
  }
});

test('rendu 5×5 : chaque modèle se dessine à la cote 100 mm + fond perdu 3 mm dans les 4 rotations, sans valeur invalide', () => {
  for (const m of C5) for (let rot = 0; rot < 4; rot++) {
    const s = R.contenuTuile(m, { rot, fondPerdu: 3, contour: false, format: F5 });
    assert.equal(typeof s, 'string');
    assert.ok(s.length > 100 && !s.includes('NaN') && !s.includes('undefined') && !s.includes('Infinity'), `${m.id} rot ${rot}`);
  }
});
