'use strict';
/*
 * Tests du catalogue 5×5 livré (src/catalogue.js, PM.catalogue.modelesParGrille['5x5']) : voie « porteuse latérale + relais » à
 * 2 cases par tuile (docs/53, coordonnées validées en docs/55, décisions de docs/18 « 5×5 très connecté »). Contenu, validité
 * (aucune erreur ni alerte, aucune poche), règles propres au 5×5 (porteuse latérale, paire basse du coin, R2 et R4 gardées), règles
 * des passages, tracés (8 mm entre chemins, rayon + 4 mm des autres cases, 24 mm des coins), raccourci et paire basse dans les
 * rotations imposées, exemplaires, catalogues précédents (3.04 et 4.00.0), nouveauDocument('5x5'), et un plateau 5×5 complet fixé ici.
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
const IDS5 = ['LC1', 'LC2', 'LC3', 'LC4', 'LB2', 'LK2'];

const { problemesTrace: tracesPb, reglesPassages, signature } = require('./aides-trace.js');
const problemesTrace = (m) => tracesPb(m, '5x5');

const porteuses = (m) => m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']);
const liens = (m) => m.chemins.filter((ch) => ch.b['case'] !== undefined);
const lateraux = (m) => m.chemins.filter((ch) => ch.b.raccord !== undefined);
const coinsDe = (m, id) => m.chemins.filter((ch) => ch.a['case'] === id && ch.b.coin !== undefined).map((ch) => ch.b.coin).sort();
const raccordsDe = (m, id) => m.chemins.filter((ch) => ch.a['case'] === id && ch.b.raccord).map((ch) => ch.b.raccord.cote + ':' + ch.b.raccord.pos).sort();
/** Bits d'un masque de raccords (12 bits) pour une liste de « côté:pos ». */
const bits = (...l) => l.reduce((s, x) => { const [c, p] = x.split(':').map(Number); return s | (1 << (3 * c + p)); }, 0);

/* ================================ contenu ================================ */

test('catalogue 5×5 : 6 modèles (LK2 ; LB2 ; LC1 à LC4), grille 5×5, cases Ø 20, ids et noms distincts, aucun id d’un catalogue précédent', () => {
  assert.deepEqual(parGabarit('coin').map((m) => m.id), ['LK2']);
  assert.deepEqual(parGabarit('bord').map((m) => m.id), ['LB2']);
  assert.deepEqual(parGabarit('centrale').map((m) => m.id), ['LC1', 'LC2', 'LC3', 'LC4']);
  assert.deepEqual(C5.map((m) => m.id), IDS5);
  assert.ok(C5.every((m) => m.grille === '5x5' && !('role' in m)));
  assert.ok(C5.every((m) => m.cases.every((c) => c.diametre === F5.DIAMETRE_CASE && c.diametre === 20)));
  assert.equal(new Set(C5.map((m) => m.nom)).size, 6);
  assert.deepEqual(C5.map((m) => m.nom), ['Pont et relais', 'Pont et relais décalé', 'Pont et fourche', 'Deux ponts', 'Bord à pont', 'Coin à porteuse']);
  for (const m of C5) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 22, m.id);
    for (const el of m.cases.concat(m.chemins, m.passages || [], m.pivots || [])) assert.equal(typeof el.id, 'string', m.id);
  }
  // aucun id commun avec les catalogues précédents (3.04 et 4.00.0, des deux grilles) ni avec les variantes écartées de docs/55
  const anciens = new Set([].concat(...Object.values(CAT.precedents).map((l) => [].concat(...l.map((x) => x.modeles.map((m) => m.id))))).concat(CAT.modelesParGrille['4x4'].map((m) => m.id)));
  for (const id of IDS5) assert.ok(!anciens.has(id), id);
  for (const id of ['LB1', 'LK1', 'U1', 'P3', 'B1', 'B7', 'K2']) assert.equal(modele(id), undefined, id);
});

test('catalogue 5×5 : 25 exemplaires (4 coins, 12 bords, 9 centrales : 3 LC1, 2 LC2, 3 LC3, 1 LC4), poids égaux au stock, coordonnées de docs/55', () => {
  const total = (g) => parGabarit(g).reduce((s, m) => s + m.exemplaires, 0);
  assert.deepEqual([total('coin'), total('bord'), total('centrale')], [4, 12, 9]);
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.exemplaires])), { LC1: 3, LC2: 2, LC3: 3, LC4: 1, LB2: 12, LK2: 4 });
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.poids])), { LC1: 3, LC2: 2, LC3: 3, LC4: 1, LB2: 12, LK2: 4 });
  const pos = (m) => Object.fromEntries(m.cases.map((c) => [c.id, [c.x, c.y]]));
  assert.deepEqual(pos(modele('LC1')), { p: [50, 25], r: [50, 58] });
  assert.deepEqual(pos(modele('LC2')), { p: [44, 27], r: [62, 62] });
  assert.deepEqual(pos(modele('LC3')), { p: [50, 25], r: [62, 60] });
  assert.deepEqual(modele('LC3').pivots, [{ id: 'v', x: 31, y: 76 }]);
  assert.deepEqual(pos(modele('LC4')), { p: [50, 25], q: [50, 75] });
  assert.deepEqual(pos(modele('LB2')), { a: [50, 48], c: [50, 81] });
  assert.deepEqual(pos(modele('LK2')), { a: [39, 42], c: [75, 75] });
});

test('catalogue 5×5 : 2 cases par tuile (59 cases par plateau, 9 jonctions-cases comprises) ; ports : LC1 à LC3 : 2, LC4 : 4, LB2 : 2, LK2 : 1 (48 par plateau)', () => {
  assert.ok(C5.every((m) => m.cases.length === 2), 'deux cases par tuile, apparition comprise');
  const ports = (m) => porteuses(m).length;
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, ports(m)])), { LC1: 2, LC2: 2, LC3: 2, LC4: 4, LB2: 2, LK2: 1 });
  // composition du stock : 4 LK2, 12 LB2, 3 LC1, 2 LC2, 3 LC3, 1 LC4 -> 50 cases de tuiles, 4 + 24 + 16 + 4 = 48 ports = 16 jonctions × 3
  const cases = C5.reduce((s, m) => s + m.exemplaires * m.cases.length, 0), p = C5.reduce((s, m) => s + m.exemplaires * ports(m), 0);
  assert.deepEqual([cases + 9, p], [59, 48]);
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

test('règles propres au 5×5 : les mêmes modèles, validés en 4×4, gardent les alertes R1 / R3 (le 4×4 ne change pas)', () => {
  for (const m of C5) {
    const sans = copie(m); delete sans.grille;
    const codes = M.validerModele(sans, '4x4').alertes.map((a) => a.code);
    if (m.id === 'LK2') assert.deepEqual(codes, ['raccord_porteuse'], m.id); // 1 port : seule R3 (paire basse)
    else assert.ok(codes.includes('ports_case') && codes.includes('raccord_porteuse'), m.id + ' : ' + codes.join());
  }
});

test('passages (docs/18) : seule la fourche (LC3) en porte, un T, ni vers un coin ni traversant, jamais sur une porteuse ; murs seulement sur « Deux ponts »', () => {
  for (const m of C5) assert.deepEqual(reglesPassages(m, '5x5'), [], m.id);
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, (m.passages || []).length])), { LC1: 0, LC2: 0, LC3: 3, LC4: 0, LB2: 0, LK2: 0 });
  const lc3 = modele('LC3');
  assert.ok(lc3.passages.every((p) => p.b.pivot === 'v'));
  assert.deepEqual(lc3.passages.map((p) => p.a.raccord ? p.a.raccord.cote + ':' + p.a.raccord.pos : p.a['case']).sort(), ['2:1', '3:1', 'r']);
  // le contrôle des murs refuse un mur ailleurs (témoin : LC1 sans son raccord O)
  const mur = copie(modele('LC1')); mur.chemins = mur.chemins.filter((ch) => ch.id !== 'ro');
  assert.ok(reglesPassages(mur, '5x5').some((t) => t.includes('mur')));
});

/* ================================ tracés ================================ */

test('tracés 5×5 : 8 mm entre chemins, r + 4 mm des autres cases, 24 mm des coins (sauf le port)', () => {
  assert.deepEqual([].concat(...C5.map(problemesTrace)), []);
  assert.equal(F5.LARGEUR_CHEMIN, 8);
  assert.equal(F5.RAYON_ZONE_COIN, 20);
});

test('tracés 5×5 : le contrôle détecte un chemin qui traverse une case, ou qui entre dans une zone de coin (témoins)', () => {
  const m = copie(modele('LC4'));
  m.chemins.push({ id: 'x', a: { 'case': 'p' }, b: { raccord: { cote: 2, pos: 1 } } }); // de p (50, 25) vers S : passe par q (50, 75)
  assert.ok(problemesTrace(m).some((t) => t.includes('de q')), problemesTrace(m).join(' | '));
  const k = copie(modele('LK2'));
  Object.assign(k.cases.find((c) => c.id === 'c'), { x: 88, y: 88 }); // porteuse dans la zone du coin SE
  assert.ok(problemesTrace(k).length > 0, 'LK2 déformé');
  assert.ok(M.validerModele(k, '5x5').erreurs.some((e) => e.code === 'zone_coin'));
});

/* ================================ règles du 5×5 ================================ */

test('règles 5×5 : porteuse latérale (2 ports d’un même côté, seul raccord au milieu de ce côté), porteuse du coin (1 port, paire basse), R2 et R4', () => {
  for (const m of C5) {
    const ports = porteuses(m);
    for (const id of new Set(ports)) {
      const coins = coinsDe(m, id), rac = raccordsDe(m, id);
      if (coins.length === 2) {
        const k = (coins[0] + 1) % 4 === coins[1] ? coins[0] : coins[1];
        assert.equal((k + 1) % 4, coins[0] === k ? coins[1] : coins[0], `${m.id} ${id} : deux coins d’un même côté`);
        assert.deepEqual(rac, [k + ':1'], `${m.id} ${id} : seul raccord au milieu du côté ${k}`);
      } else {
        assert.equal(coins.length, 1, `${m.id} ${id}`);
        assert.deepEqual(rac, [((coins[0] + 3) % 4) + ':2', coins[0] + ':0'].sort(), `${m.id} ${id} : paire basse du coin`);
      }
      assert.ok(!(m.passages || []).some((p) => p.a['case'] === id || p.b['case'] === id), `${m.id} ${id} touche un passage`);
    }
    for (const ch of liens(m)) assert.ok(!(ports.includes(ch.a['case']) && ports.includes(ch.b['case'])), `${m.id} R2 : ${ch.id} relie deux porteuses`);
    for (const c of m.cases.filter((x) => x.type === 'apparition')) assert.ok(!ports.includes(c.id), `${m.id} R4`);
  }
  // témoins : une porteuse qui dessert deux coins en diagonale, ou qui porte un autre raccord, reste en alerte en 5×5
  const diag = copie(modele('LC1')); diag.chemins.find((ch) => ch.id === 'p2').b.coin = 2;
  assert.ok(M.validerModele(diag, '5x5').alertes.some((a) => a.code === 'ports_case'));
  const plus = copie(modele('LC1')); plus.chemins.push({ id: 'rx', a: { 'case': 'p' }, b: { raccord: { cote: 1, pos: 1 } } });
  assert.ok(M.validerModele(plus, '5x5').alertes.some((a) => a.code === 'raccord_porteuse'));
  const relie = copie(modele('LC4')); relie.chemins.push({ id: 'hx', a: { 'case': 'p' }, b: { 'case': 'q' } });
  assert.ok(M.validerModele(relie, '5x5').alertes.some((a) => a.code === 'porteuses_reliees'));
  const appar = copie(modele('LB2')); appar.chemins.push({ id: 'px', a: { 'case': 'a' }, b: { coin: 2 } });
  assert.ok(M.validerModele(appar, '5x5').alertes.some((a) => a.code === 'port_apparition'));
  // la paire basse n'est permise qu'à la porteuse d'un COIN : le même motif (1 port SE, raccords E2 et S0) sur un bord ou une centrale reste en alerte
  for (const gabarit of ['bord', 'centrale']) {
    const k = copie(modele('LK2')); k.gabarit = gabarit;
    if (gabarit === 'centrale') { k.cases[0].type = 'deplacement'; k.chemins = k.chemins.filter((ch) => !ch.b.raccord || ch.a['case'] === 'c'); }
    assert.ok(M.validerModele(k, '5x5').alertes.some((a) => a.code === 'raccord_porteuse'), gabarit);
    assert.ok(reglesPassages(k, '5x5').some((t) => t.includes('raccord sur une porteuse')), gabarit);
  }
});

test('écart entre villes en 5×5 : deux villes desservies par une même porteuse latérale (2 pas) sont signalées au panneau (alerte « villes trop proches »)', () => {
  const doc = plateauComplet();
  // la porteuse du bord LB2 en (1, 0) dessert les jonctions (1, 1) et (2, 1)
  doc.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }, { i: 2, j: 1, type: 'capture' }];
  const g = GR.construire(doc, { villesTraversables: false });
  assert.deepEqual(GR.villesProches(g), [{ a: { i: 1, j: 1 }, b: { i: 2, j: 1 }, pas: 2 }]);
  const al = PM.controles.calculer(doc).alertes.filter((a) => a.code === 'villes_proches');
  assert.equal(al.length, 1);
  assert.match(al[0].message, /Villes \(1, 1\) et \(2, 1\) à 1 case\(s\) d'écart : la règle en demande au moins 3\./);
  // l'aide « placer les villes » ne les met jamais ainsi
  const p = PM.generateur.meilleurPlacementVilles(doc);
  assert.ok(p.ok);
  const d = copie(doc); d.plateau.jetons = p.jetons;
  assert.deepEqual(PM.controles.calculer(d).alertes.filter((a) => a.code === 'villes_proches'), []);
});

test('catalogue 5×5 : raccords (centrales au milieu, « Deux ponts » N et S seulement ; bord : raccourci, paire basse et S ; coin : raccourci et paire basse)', () => {
  const r = (id) => M.masquesDuModele(modele(id)).raccords;
  for (const id of ['LC1', 'LC2', 'LC3']) assert.equal(r(id), 0x492, id);
  assert.equal(r('LC4'), bits('0:1', '2:1'));
  assert.equal(r('LB2'), bits('1:0', '3:2', '1:2', '3:0', '2:1'));
  assert.equal(r('LK2'), bits('1:0', '2:2', '1:2', '2:0'));
  // bord : raccourci et paire basse tirés de l'apparition, raccord S de la porteuse ; coin : raccourci de l'apparition, paire basse de la porteuse
  assert.deepEqual(raccordsDe(modele('LB2'), 'a'), ['1:0', '1:2', '3:0', '3:2']);
  assert.deepEqual(raccordsDe(modele('LB2'), 'c'), ['2:1']);
  assert.deepEqual(raccordsDe(modele('LK2'), 'a'), ['1:0', '2:2']);
  assert.deepEqual(raccordsDe(modele('LK2'), 'c'), ['1:2', '2:0']);
});

test('catalogue 5×5 : ports (coins intérieurs seulement), apparition unique sur bords et coins, aucune sur les centrales', () => {
  const p = (id) => M.masquesDuModele(modele(id)).portsCoin;
  for (const id of ['LC1', 'LC2', 'LC3']) assert.equal(p(id), 0b0011, id); // NO + NE
  assert.equal(p('LC4'), 0b1111);
  assert.equal(p('LB2'), 0b1100);   // SE + SO
  assert.equal(p('LK2'), 0b0100);   // SE
  for (const m of C5) {
    assert.equal(m.cases.filter((c) => c.type === 'apparition').length, m.gabarit === 'centrale' ? 0 : 1, m.id);
    assert.equal(M.aUneApparition(m), m.gabarit !== 'centrale', m.id);
  }
});

test('miroirs (docs/18) : aucun modèle n’est le reflet d’un autre ; LC1 et LC2 ont la même topologie (variété du dessin seulement)', () => {
  assert.equal(signature(modele('LC1'), 0), signature(modele('LC2'), 0));
  for (const a of C5) for (const b of C5) for (let rot = 0; rot < 4; rot++) {
    if (a === b || [a.id, b.id].sort().join() === 'LC1,LC2') continue;
    assert.notStrictEqual(signature(a, rot, true), signature(b, 0), `${a.id} reflété = ${b.id}`);
  }
  // le générateur ne substitue un miroir qu'à un bord : LB2 n'en a pas
  assert.equal(PM.generateur.sontMiroirs(modele('LB2'), modele('LK2'), F5), false);
});

test('catalogues précédents 5×5 : 3.04 (precedent) et 4.00.0 (precedents) gardés, gelés et intacts, avec leurs exemplaires', () => {
  const p = CAT.precedent['5x5'];
  assert.deepEqual(p.map((m) => m.id), ['C7', 'C8', 'B1', 'B7', 'B7m', 'K2']);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p[0].chemins[0].b));
  assert.deepEqual(CAT.precedents['5x5'].map((x) => x.version), ['3.04', '4.00']);
  assert.equal(CAT.precedents['5x5'][0].modeles, p);
  assert.deepEqual(CAT.precedents['4x4'].map((x) => x.version), ['3.04']);
  const o = CAT.precedents['5x5'][1].modeles;
  assert.deepEqual(o.map((m) => m.id), ['U1', 'P3', 'P5', 'P1', 'P2', 'B1', 'B7', 'K2']);
  assert.deepEqual(Object.fromEntries(o.map((m) => [m.id, m.exemplaires])), { U1: 5, P3: 4, P5: 3, P1: 3, P2: 3, B1: 6, B7: 8, K2: 5 });
  assert.deepEqual(Object.fromEntries(o.map((m) => [m.id, m.poids])), { U1: 5, P3: 2, P5: 2, P1: 1, P2: 1, B1: 6, B7: 8, K2: 5 });
  assert.ok(Object.isFrozen(o) && Object.isFrozen(o[0].cases[0]) && Object.isFrozen(o[1].pivots[0]));
  // identiques aux modèles de outils/catalogue-organique.js (catalogue de la 4.00.0), aux exemplaires près
  require('../outils/catalogue-organique.js');
  const sans = (m) => { const c = copie(m); delete c.exemplaires; delete c.poids; return c; };
  assert.deepEqual(o.map(sans), PM.catalogueOrganique.modelesParGrille['5x5'].map(sans));
  // B1, B7 et K2 sont les mêmes modèles en 3.04 et en 4.00.0
  for (const id of ['B1', 'B7', 'K2']) assert.deepEqual(sans(o.find((m) => m.id === id)), sans(p.find((m) => m.id === id)), id);
});

/* ================================ raccourci et paire basse dans les rotations imposées ================================ */

/** Document 5×5 avec les tuiles données [{id, col, lig, rot}], sans contrôle d'exemplaires. */
function docAvec(tuiles) {
  const doc = CAT.nouveauDocument('5x5');
  doc.modeles.forEach((m) => { m.exemplaires = 10; });
  doc.plateau.tuiles = tuiles.map((t) => ({ modeleId: t.id, col: t.col, lig: t.lig, rot: t.rot }));
  return doc;
}
const tuile = (id, col, lig) => ({ id, col, lig, rot: M.rotationDeduite(col, lig, modele(id).gabarit, '5x5') });
const nbMorts = (doc) => M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;
const appar = (col, lig) => col + ',' + lig + ':a';
const porteuse = (col, lig) => col + ',' + lig + ':c';

test('raccourci et paire basse 5×5 : aux 4 coins, l’apparition du bord voisin est reliée à l’apparition et à la porteuse du coin', () => {
  const dispositions = [
    { coin: [0, 0], bords: [[1, 0], [0, 1]] }, { coin: [4, 0], bords: [[3, 0], [4, 1]] },
    { coin: [4, 4], bords: [[3, 4], [4, 3]] }, { coin: [0, 4], bords: [[1, 4], [0, 3]] }
  ];
  let essais = 0;
  for (const d of dispositions) for (const [bc, bl] of d.bords) {
    const doc = docAvec([tuile('LK2', d.coin[0], d.coin[1]), tuile('LB2', bc, bl)]);
    const g = GR.construire(doc, { jetons: [] }), v = g.voisins.get(appar(bc, bl));
    assert.ok(v.has(appar(d.coin[0], d.coin[1])), `coin (${d.coin}) / bord (${bc},${bl}) : raccourci`);
    assert.ok(v.has(porteuse(d.coin[0], d.coin[1])), `coin (${d.coin}) / bord (${bc},${bl}) : paire basse`);
    assert.equal(nbMorts(doc), 0);
    essais++;
  }
  assert.equal(essais, 8);
});

test('raccourci et paire basse 5×5 : deux bords voisins sur les 4 côtés relient leurs apparitions (deux rails), sans raccord mort', () => {
  const cotes = [
    [[1, 0], [2, 0], [3, 0]], [[4, 1], [4, 2], [4, 3]], [[3, 4], [2, 4], [1, 4]], [[0, 3], [0, 2], [0, 1]]
  ];
  let essais = 0;
  for (const c of cotes) for (let k = 0; k < 2; k++) {
    const doc = docAvec([tuile('LB2', c[k][0], c[k][1]), tuile('LB2', c[k + 1][0], c[k + 1][1])]);
    const g = GR.construire(doc, { jetons: [] });
    assert.ok(g.voisins.get(appar(...c[k])).has(appar(...c[k + 1])), `(${c[k]}) et (${c[k + 1]})`);
    assert.equal(g.voisins.get(appar(...c[k])).has(porteuse(...c[k + 1])), false, 'une porteuse de bord ne touche pas le bord voisin');
    assert.equal(nbMorts(doc), 0);
    essais++;
  }
  assert.equal(essais, 8);
});

test('raccords du milieu 5×5 : bord face à centrale et centrale face à centrale se rejoignent ; seuls les murs de « Deux ponts » laissent des raccords morts', () => {
  const murs = (id, rot) => id === 'LC4' ? [(1 + rot) % 4, (3 + rot) % 4] : [];
  for (const c of parGabarit('centrale')) for (let rot = 0; rot < 4; rot++) {
    const doc = docAvec([tuile('LB2', 2, 0), { id: c.id, col: 2, lig: 1, rot }]);
    // le raccord S du bord (porteuse) fait face au côté N de la centrale : mort seulement face à un mur
    assert.equal(nbMorts(doc), murs(c.id, rot).includes(0) ? 1 : 0, `LB2 / ${c.id} rot ${rot}`);
  }
  for (const c1 of parGabarit('centrale')) for (const c2 of parGabarit('centrale')) for (let r = 0; r < 4; r++) {
    const doc = docAvec([{ id: c1.id, col: 1, lig: 1, rot: 0 }, { id: c2.id, col: 2, lig: 1, rot: r }]);
    const attendu = (murs(c1.id, 0).includes(1) ? 1 : 0) + (murs(c2.id, r).includes(3) ? 1 : 0);
    assert.equal(nbMorts(doc), murs(c1.id, 0).includes(1) && murs(c2.id, r).includes(3) ? 0 : attendu, `${c1.id} / ${c2.id} rot ${r}`);
  }
});

/* ================================ nouveauDocument et API ================================ */

test('API : modeles reste le 4×4 ; modelesParGrille gelé { 4x4, 5x5 } ; precedent et precedents gelés ; version 4', () => {
  assert.equal(CAT.version, 4);
  assert.equal(CAT.modeles.length, 6);
  assert.equal(CAT.modelesParGrille['4x4'], CAT.modeles);
  assert.deepEqual(Object.keys(CAT.modelesParGrille), ['4x4', '5x5']);
  assert.ok(Object.isFrozen(CAT.modelesParGrille) && Object.isFrozen(C5));
  assert.ok(Object.isFrozen(modele('LC1').cases[0]) && Object.isFrozen(modele('LC1').chemins[0].b) && Object.isFrozen(modele('LC3').pivots[0]));
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4'));
  assert.deepEqual(Object.keys(CAT.precedent), ['4x4', '5x5']);
  assert.deepEqual(Object.keys(CAT.precedents), ['4x4', '5x5']);
  assert.ok(Object.isFrozen(CAT.precedent) && Object.isFrozen(CAT.precedents) && Object.isFrozen(CAT.precedents['5x5'][1]));
});

test('nouveauDocument(\'5x5\') : document 5×5 vide avec une copie modifiable des 6 modèles ; défaut 4×4 ; grille inconnue refusée', () => {
  const doc = CAT.nouveauDocument('5x5');
  assert.equal(doc.version, 2);
  assert.equal(doc.grille, '5x5');
  assert.deepEqual(doc.plateau, M.nouveauDocument('5x5').plateau);
  assert.deepEqual(doc.modeles, copie(C5));
  doc.modeles.forEach((m) => assert.deepEqual(M.validerModele(m, '5x5').erreurs, []));
  M.modeleParId(doc, 'LC1').cases[0].x = 1;
  M.modeleParId(doc, 'LC3').pivots[0].x = 1;
  doc.modeles.pop();
  assert.equal(modele('LC1').cases[0].x, 50);
  assert.equal(modele('LC3').pivots[0].x, 31);
  assert.equal(C5.length, 6);
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
  assert.equal(PM.bibliotheque.estTuileUtilisateur(r.doc, 'LK2'), false);
  const ajoute = M.ajouterModele(r.doc, Object.assign(copie(modele('LC1')), { id: 'Z9' }));
  assert.equal(PM.bibliotheque.estTuileUtilisateur(ajoute, 'Z9'), true);
});

/* ================================ plateau 5×5 complet ================================ */

/**
 * Plateau plein fixé ici (tiré par le générateur, graine « plateau-2 », 30 candidats, puis figé) : LK2 aux 4 coins, LB2 sur les
 * 12 cases de bord (rotation imposée par la place), 9 centrales (3 LC1, 2 LC2, 3 LC3, 1 LC4 : le stock exact) dont la rotation
 * (quatrième valeur) a été choisie pour les 7 villes en 2-3-2 ci-dessous. 59 cases (moitiés de 22 cases), 48 ports, une seule
 * jonction-case à 2 ports, 8 placements admissibles des villes, S = 0 ; les 2 murs de LC4 laissent 2 raccords morts (alertes).
 */
const PLATEAU = [
  ['LK2', 0, 0], ['LB2', 1, 0], ['LB2', 2, 0], ['LB2', 3, 0], ['LK2', 4, 0],
  ['LB2', 0, 1], ['LC1', 1, 1, 1], ['LC3', 2, 1, 2], ['LC2', 3, 1, 3], ['LB2', 4, 1],
  ['LB2', 0, 2], ['LC3', 1, 2, 0], ['LC1', 2, 2, 2], ['LC2', 3, 2, 3], ['LB2', 4, 2],
  ['LB2', 0, 3], ['LC1', 1, 3, 0], ['LC4', 2, 3, 0], ['LC3', 3, 3, 1], ['LB2', 4, 3],
  ['LK2', 0, 4], ['LB2', 1, 4], ['LB2', 2, 4], ['LB2', 3, 4], ['LK2', 4, 4]
];
const VILLES = [[2, 1], [4, 1], [1, 2], [3, 3], [4, 3], [1, 4], [3, 4]]; // 2-3-2, chacune à 3 ports
function plateauComplet() {
  const doc = CAT.nouveauDocument('5x5');
  doc.plateau.tuiles = PLATEAU.map(([id, col, lig, rot]) => ({
    modeleId: id, col, lig, rot: rot !== undefined ? rot : M.rotationDeduite(col, lig, modele(id).gabarit, '5x5')
  }));
  return doc;
}

test('plateau 5×5 complet : 25 tuiles du stock exact, aucune erreur, 2 raccords morts (murs de LC4) seulement, aucune jonction mal reliée', () => {
  const doc = plateauComplet();
  assert.equal(doc.plateau.tuiles.length, 25);
  const utilises = {};
  doc.plateau.tuiles.forEach((t) => { utilises[t.modeleId] = (utilises[t.modeleId] || 0) + 1; });
  assert.deepEqual(utilises, { LK2: 4, LB2: 12, LC1: 3, LC3: 3, LC2: 2, LC4: 1 });
  for (const m of C5) assert.equal(utilises[m.id], m.exemplaires, m.id);
  const v = M.validerPlateau(doc);
  assert.deepEqual(v.erreurs, []);
  assert.deepEqual(v.alertes.map((a) => a.code), ['raccord_mort', 'raccord_mort']);
  assert.deepEqual(M.raccordsMorts(doc).map((r) => [r.col, r.lig, r.cote]), [[1, 3, 1], [3, 3, 3]]); // les voisins des murs E et O de LC4 (2, 3)
  assert.deepEqual(M.jonctionsMalReliees(doc), []);
  for (const t of doc.plateau.tuiles) assert.equal(M.gabaritCellule(t.col, t.lig, '5x5'), M.modeleParId(doc, t.modeleId).gabarit);
});

test('plateau 5×5 complet : 59 cases (50 des tuiles + 9 jonctions-cases), 48 ports, une jonction à 2 ports, villes à 3, moitiés égales, connexions', () => {
  const doc = plateauComplet();
  const g = GR.construire(doc, { jetons: VILLES.map(([i, j]) => ({ i, j, type: 'capture' })) });
  assert.equal(g.jonctions.length, 16);
  assert.equal(g.villes.size, 7);
  assert.equal(g.cases.size, 50);
  assert.equal(g.jonctions.filter((j) => j.type === 'case').length, 9);
  const ports = g.jonctions.map((j) => j.ports);
  assert.equal(ports.reduce((a, b) => a + b, 0), 48);
  assert.deepEqual(ports.join(''), '3333333233333334');
  for (const j of g.jonctions.filter((x) => x.type === 'ville')) assert.ok(j.ports >= 3, `ville (${j.i},${j.j})`);
  for (const j of g.jonctions) assert.equal(M.portsJonction(doc, j.i, j.j).ports, j.ports, `(${j.i},${j.j})`);
  assert.ok(GR.connexe(g));
  const mo = GR.casesParMoitie(doc, g);
  assert.deepEqual([mo.vert, mo.rouge, mo.ecart], [22, 22, 0]);
  // connexions par case (docs/53 § 1) : une seule case à 2 connexions (la jonction-case (4, 2) à 2 ports), 1,7 % < 5 %
  const docV = Object.assign(copie(doc), { plateau: { tuiles: doc.plateau.tuiles, jetons: VILLES.map(([i, j]) => ({ i, j, type: 'capture' })) } });
  const cx = GR.connexions(docV, g);
  assert.deepEqual([cx.cases, cx.faibles, cx.conforme], [59, 1, true]);
  assert.deepEqual(cx.jonctionsFaibles, [{ i: 4, j: 2 }]);
  assert.ok(cx.degreMoyen > 3.6 && cx.degreMoyen < 3.8, String(cx.degreMoyen));
  assert.equal(PM.generateur.placementsAdmissibles5x5(doc), 8);
});

test('plateau 5×5 complet : une porteuse dessert au plus deux jonctions voisines ; villes à 4 pas au moins ; apparitions des deux camps', () => {
  const doc = plateauComplet();
  const g = GR.construire(doc, { jetons: [] });
  const jonction = (id) => !g.cases.has(id);
  const coord = (id) => id.slice(1).split(',').map(Number);
  let paires = 0;
  for (const [id] of g.cases) {
    const js = [...g.voisins.get(id)].filter(jonction);
    assert.ok(js.length <= 2, id);
    if (js.length === 2) {
      const [a, b] = js.map(coord);
      assert.equal(Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), 1, `${id} : jonctions voisines`);
      paires++;
    }
  }
  assert.equal(paires, 12 + 8 + 2, 'porteuses latérales : 12 bords, 8 centrales, 2 dans « Deux ponts »');
  const gv = GR.construire(doc, { jetons: VILLES.map(([i, j]) => ({ i, j, type: 'capture' })), villesTraversables: false });
  assert.deepEqual(GR.villesProches(gv), []);
  assert.equal(g.apparitions[1].length, 5 + 2);
  assert.equal(g.apparitions[2].length, 5 + 2);
});

test('pose libre 5×5 : l’écart entre jonctions n’est plus garanti par les tuiles (2 pas par une porteuse latérale) ; aucune erreur de validation (200 tirages)', () => {
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
    assert.equal(mini, 2, 'tirage ' + k);
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

test('chaîne : enregistrement / réouverture JSON d\'un plateau 5×5 complet, sans perte, grille conservée', () => {
  const doc = plateauAvecVilles();
  const texte = PM.sauvegarde.versJSON(doc);
  assert.equal(JSON.parse(texte).grille, '5x5');
  const r = PM.sauvegarde.depuisJSON(texte);
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes.map((a) => a.code), ['raccord_mort', 'raccord_mort']); // les murs de « Deux ponts » (alertes de plateau)
  assert.equal(r.migre, false);
  assert.equal(r.doc.grille, '5x5');
  assert.deepEqual(r.doc.modeles, doc.modeles);
  assert.deepEqual(r.doc.plateau, doc.plateau);
  const r2 = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(r.doc));
  assert.deepEqual(r2.doc, r.doc);
  const v = M.validerPlateau(r.doc);
  assert.deepEqual([v.erreurs, v.alertes.map((a) => a.code)], [[], ['raccord_mort', 'raccord_mort']]);
  const vide = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(CAT.nouveauDocument('5x5')));
  assert.equal(vide.ok, true);
  assert.equal(vide.doc.grille, '5x5');
  assert.equal(vide.doc.modeles.length, 6);
  // le catalogue livré n'est jamais pris pour un catalogue précédent
  assert.equal(PM.sauvegarde.bibliothequeCataloguePrecedent(r.doc), false);
});

test('chaîne : un fichier 5×5 dont l\'en-tête `grille` manque n\'est pas lu sans aucun signalement', () => {
  const o = JSON.parse(PM.sauvegarde.versJSON(plateauComplet()));
  delete o.grille;
  const r = PM.sauvegarde.depuisJSON(JSON.stringify(o));
  const signale = !r.ok || r.alertes.length > 0 || (r.doc && (M.validerPlateau(r.doc).erreurs.length > 0 ||
    r.doc.modeles.some((m) => M.validerModele(m, M.formatDuDocument(r.doc)).erreurs.length > 0)));
  assert.ok(signale, 'un fichier 5×5 sans grille a été lu sans aucun signalement');
});

test('chaîne : annuler / rétablir sur un document 5×5 (pose, remplacement), grille et catalogue inchangés', () => {
  const etat = PM.etat.creer(CAT.nouveauDocument('5x5'));
  assert.equal(etat.doc().grille, '5x5');
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'LK2', 0, 0)), { ok: true });
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'LB2', 1, 0)), { ok: true });
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'LC1', 2, 2, 1)), { ok: true });
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.deepEqual(etat.doc().plateau.tuiles[0], { modeleId: 'LK2', col: 0, lig: 0, rot: 0 });
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 2);
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 1);
  assert.ok(etat.peutRetablir());
  etat.retablir(); etat.retablir();
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.deepEqual(etat.doc().plateau.tuiles[2], { modeleId: 'LC1', col: 2, lig: 2, rot: 1 });
  assert.ok(!etat.peutRetablir());
  const avant = JSON.stringify(etat.doc());
  const refus = etat.appliquer((d) => M.poserTuile(d, 'LC1', 0, 0));
  assert.equal(refus.ok, false);
  assert.equal(JSON.stringify(etat.doc()), avant);
  etat.remplacer(CAT.nouveauDocument('4x4'), 'Nouveau 4×4');
  assert.equal(etat.doc().grille, '4x4');
  etat.annuler();
  assert.equal(etat.doc().grille, '5x5');
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.equal(modele('LK2').cases[0].x, 39);
});

test('chaîne : PM.controles.calculer sur le plateau 5×5 complet (7 villes) : aucune erreur, les seules alertes sont les 2 raccords morts, compteurs à leur cible', () => {
  const c = PM.controles.calculer(plateauAvecVilles());
  assert.deepEqual(c.erreurs, []);
  assert.deepEqual(c.alertes.map((a) => a.code), ['raccord_mort', 'raccord_mort']);
  const v = (cle) => c.compteurs.find((x) => x.cle === cle);
  assert.equal(v('villes').valeur, 7);
  assert.equal(v('cases').valeur, 59);
  assert.equal(v('cases').cible, '≈ 59');
  assert.equal(v('tuiles').valeur, 25);
  assert.equal(v('tuiles').cible, 25);
  assert.deepEqual([v('apparitions_vert').valeur, v('apparitions_rouge').valeur], [7, 7]);
  assert.equal(v('dimensions').valeur, '50 × 50 cm');
  assert.equal(v('tuiles_petites').valeur, 0);
  assert.deepEqual([v('connexions').valeur, v('connexions').cible, v('connexions').etat], ['1 (1,7 %)', '< 5 %', 'ok']);
  assert.ok(c.compteurs.every((x) => x.etat === 'ok'), JSON.stringify(c.compteurs.filter((x) => x.etat !== 'ok')));
});

test('chaîne : PM.controles.calculer sur un document 5×5 vide et sur des plateaux partiels ne lève pas d\'erreur ; connexions mesurées sur plateau complet', () => {
  const vide = PM.controles.calculer(CAT.nouveauDocument('5x5'));
  assert.deepEqual(vide.erreurs, []);
  assert.equal(vide.compteurs.find((x) => x.cle === 'tuiles').valeur, 0);
  assert.equal(vide.compteurs.find((x) => x.cle === 'connexions').valeur, '—');
  const partiel = docAvec([tuile('LK2', 0, 0)]);
  assert.doesNotThrow(() => PM.controles.calculer(partiel));
  partiel.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }];
  assert.doesNotThrow(() => PM.controles.calculer(partiel));
  const trou = plateauAvecVilles();
  trou.plateau.tuiles = trou.plateau.tuiles.filter((t) => !(t.col === 2 && t.lig === 0));
  const c = PM.controles.calculer(trou);
  assert.ok(c.erreurs.length + c.alertes.length > 0, 'un plateau 5×5 troué ne déclenche ni erreur ni alerte');
  // le 4×4 n'a pas ce compteur
  assert.equal(PM.controles.calculer(CAT.nouveauDocument('4x4')).compteurs.find((x) => x.cle === 'connexions'), undefined);
});

test('chaîne : rapport d\'équilibre du plateau 5×5 complet (grille 5x5, 7 villes, complet, pas de blocage, connexions en information)', () => {
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
  const ligne = r.organique.find((t) => t.startsWith('Connexions par case'));
  assert.ok(ligne && ligne.includes('1 case(s) à 2 connexions ou moins sur 59') && ligne.includes('1,7 %') && ligne.includes('tenu'), ligne);
  const sans = PM.equilibre.rapport(PM.equilibre.analyser(plateauComplet()));
  assert.equal(sans.complet, false);
});

test('chaîne : export du jeu complet 5×5 : 25 tuiles, planches A3 (2×3) et A4 (1×2), pas de 112 mm, tuile de 106 mm', () => {
  const E = PM.exportation;
  const doc = CAT.nouveauDocument('5x5');
  const liste = E.listeTuiles(doc, { portee: 'stock' });
  assert.equal(liste.tuiles.length, 25);
  assert.deepEqual(liste.exclus, []);
  const a3 = E.calepiner(doc, { format: 'A3' });
  assert.equal(a3.length, 5);                    // 25 / 6 : 4 planches pleines et une d'une tuile
  assert.ok(a3.every((p) => p.pas === 112) && a3.slice(0, 4).every((p) => p.tuiles.length === 6) && a3[4].tuiles.length === 1);
  assert.equal(a3[0].tuiles[1].x - a3[0].tuiles[0].x, 112);
  assert.equal(a3[0].tuiles[2].y - a3[0].tuiles[0].y, 112);
  const a4 = E.calepiner(doc, { format: 'A4' });
  assert.equal(a4.length, 13);                   // 25 / 2 : 12 planches de 2 et une d'une tuile
  assert.ok(a4.every((p) => p.colonnes === 1) && a4.slice(0, 12).every((p) => p.tuiles.length === 2) && a4[12].tuiles.length === 1);
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
  assert.ok(pdf.includes('/Count 5'));
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
  doc.modeles.find((m) => m.id === 'LK2').exemplaires = 0;
  doc.modeles.find((m) => m.id === 'LC1').exemplaires = 2;
  assert.equal(PM.exportation.listeTuiles(doc, { portee: 'stock' }).tuiles.length, 25 - 4 - 1);
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  assert.equal(r.doc.modeles.find((m) => m.id === 'LK2').exemplaires, 0);
  assert.equal(r.doc.modeles.find((m) => m.id === 'LC1').exemplaires, 2);
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
  const a3 = M.modeleParId(a, 'LC3'); a3.cases[0].x = 1; a3.nom = 'X'; a3.chemins.length = 0; a3.passages.length = 0; M.modeleParId(a, 'LC4').exemplaires = 99;
  a.plateau.tuiles.push({ modeleId: 'LK2', col: 0, lig: 0, rot: 0 }); a.plateau.jetons.push({ i: 1, j: 1, type: 'capture' });
  assert.equal(M.modeleParId(b, 'LC3').cases[0].x, 50);
  assert.equal(M.modeleParId(b, 'LC3').nom, 'Pont et fourche');
  assert.equal(M.modeleParId(b, 'LC3').passages.length, 3);
  assert.equal(M.modeleParId(b, 'LC4').exemplaires, 1);
  assert.equal(M.modeleParId(b, 'LC4').poids, 1);
  assert.deepEqual(b.plateau, { tuiles: [], jetons: [] });
  assert.deepEqual(CAT.nouveauDocument('5x5').plateau, { tuiles: [], jetons: [] });
  assert.equal(JSON.stringify(C5), instantane);
  assert.equal(JSON.stringify(CAT.modelesParGrille['4x4']), instantane4);
  assert.equal(JSON.stringify(CAT.nouveauDocument('5x5').modeles), instantane);
  assert.equal(c4.modeles.length, 6);
  assert.ok(c4.modeles.every((m) => m.grille === '4x4') && b.modeles.every((m) => m.grille === '5x5'));
  const ids = new Set(b.modeles.map((m) => m.id));
  for (const x of ['Q1', 'Q2', 'B8', 'K4', 'C1', 'C5', 'C7', 'C8', 'B7m', 'U1', 'P3', 'B1', 'K2']) assert.ok(!ids.has(x), x);
});

test('nouveauDocument : un document réouvert via JSON reste indépendant du catalogue ; les changements purs ne touchent pas l\'original', () => {
  const doc = CAT.nouveauDocument('5x5');
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  M.modeleParId(r.doc, 'LB2').cases[0].x = 3;
  assert.equal(modele('LB2').cases[0].x, 50);
  const apres = M.changerExemplaires(doc, 'LK2', 9);
  assert.equal(M.modeleParId(apres, 'LK2').exemplaires, 9);
  assert.equal(M.modeleParId(doc, 'LK2').exemplaires, 4);
  assert.equal(modele('LK2').exemplaires, 4);
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
  assert.equal(M.peutPoserTuile(doc, 'LK2', 0, 0).ok, true);
  assert.equal(PM.bibliotheque.refusArmement(doc, 'LK2'), '');
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
  const m = copie(modele('LK2')); delete m.grille; m.id = 'ancien';
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

/* ---------------------------- bibliothèque ---------------------------- */

test('bibliothèque : les 6 modèles livrés sont du catalogue en 5×5 ; ceux des catalogues précédents (3.04, 4.00.0) restent protégés ; un id de l\'autre grille est une tuile utilisateur', () => {
  const B = PM.bibliotheque, d5 = CAT.nouveauDocument('5x5'), d4 = CAT.nouveauDocument('4x4');
  for (const id of IDS5) assert.equal(B.estTuileUtilisateur(d5, id), false, '5×5 ' + id);
  for (const m of CAT.modelesParGrille['4x4']) assert.equal(B.estTuileUtilisateur(d4, m.id), false, '4×4 ' + m.id);
  assert.equal(B.estTuileUtilisateur(d5, 'inconnu'), false);
  // un document 4.00.0 garde ses tuiles livrées protégées (U1 à P5, B1, B7, K2), comme un document 3.04 (C7, C8, B7m)
  const d400 = copie(d5); d400.modeles = copie(CAT.precedents['5x5'][1].modeles);
  for (const id of ['U1', 'P3', 'P5', 'P1', 'P2', 'B1', 'B7', 'K2']) assert.equal(B.estTuileUtilisateur(d400, id), false, '4.00.0 ' + id);
  const d304 = copie(d5); d304.modeles = copie(CAT.precedent['5x5']);
  for (const id of ['C7', 'C8', 'B7m']) assert.equal(B.estTuileUtilisateur(d304, id), false, '3.04 ' + id);
  // Q1 (catalogue 4×4) ajouté par l'utilisateur dans un document 5×5 : pas une tuile livrée du 5×5
  const d5q1 = M.ajouterModele(d5, Object.assign(copie(modele('LC1')), { id: 'Q1' }));
  assert.equal(B.estTuileUtilisateur(d5q1, 'Q1'), true);
  assert.equal(B.supprimerTuileUtilisateur(d5q1, 'Q1').modeles.length, 6);
  // LC1 (catalogue 5×5) ajouté par l'utilisateur dans un document 4×4 : tuile utilisateur du 4×4
  const d4l = M.ajouterModele(d4, Object.assign(copie(CAT.modelesParGrille['4x4'][0]), { id: 'LC1' }));
  assert.equal(B.estTuileUtilisateur(d4l, 'LC1'), true);
  assert.equal(B.supprimerTuileUtilisateur(d4l, 'LC1').modeles.length, 6);
});

test('bibliothèque : suppression interdite des 6 modèles livrés 5×5, même posés ou modifiés', () => {
  const B = PM.bibliotheque, doc = plateauAvecVilles();
  for (const id of IDS5) {
    assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('5x5'), id), /catalogue livré/, id);
    assert.throws(() => B.supprimerTuileUtilisateur(doc, id), /catalogue livré/, id + ' posé');
  }
  assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('5x5'), 'zzz'), /introuvable/);
  for (const id of ['K2', 'B1']) assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('4x4'), id), /catalogue livré/, '4×4 ' + id);
  const modif = M.remplacerModele(CAT.nouveauDocument('5x5'), 'LK2', Object.assign(copie(modele('LK2')), { nom: 'Mon coin' }));
  assert.equal(B.estTuileUtilisateur(modif, 'LK2'), false);
  const groupes = B.vignettesBibliotheque(CAT.nouveauDocument('5x5'), 'tous');
  const tous = [].concat(...groupes.map((g) => g.modeles));
  assert.equal(tous.length, 6);
  assert.ok(tous.every((m) => m.utilisateur === false && m.complet && m.posable && m.autreGrille === false), JSON.stringify(tous));
});

test('bibliothèque : suppression d\'une tuile utilisateur 5×5 posée (tuile retirée, annulable en une entrée)', () => {
  const B = PM.bibliotheque;
  let doc = plateauAvecVilles();
  doc = M.ajouterModele(doc, Object.assign(copie(modele('LC2')), { id: 'Z1' }));
  doc = M.retirerTuile(doc, 3, 1);
  doc = M.poserTuile(doc, 'Z1', 3, 1, 3);
  assert.equal(B.estTuileUtilisateur(doc, 'Z1'), true);
  assert.equal(B.effetsSuppression(doc, 'Z1').tuilesRetirees, 1);
  const apres = B.supprimerTuileUtilisateur(doc, 'Z1');
  assert.equal(apres.plateau.tuiles.length, 24);
  assert.equal(apres.grille, '5x5');
  assert.equal(M.modeleParId(apres, 'Z1'), null);
  assert.equal(apres.modeles.length, 6);
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
    for (const id of ['LK2', 'LB2', 'LC1']) assert.equal(M.peutPoserTuile(doc, id, c, l).ok, false, `${id} (${c},${l})`);
  }
  const un = M.poserTuile(doc, 'LC1', 2, 2);
  assert.equal(M.peutPoserTuile(un, 'LC3', 2, 2).ok, false);
  assert.equal(M.peutPoserTuile(un, 'LC1', 2, 2).ok, false);
  assert.equal(M.gabaritCellule(2, 2, '5x5'), 'centrale');
  assert.equal(F5.campCellule(2, 2), null);
});

test('poses 5×5 : 4 LB2 posés sur les 4 côtés prennent 4 rotations distinctes ; leur porteuse dessert deux jonctions intérieures voisines', () => {
  const doc = CAT.nouveauDocument('5x5');
  const cases = [[1, 0], [4, 1], [3, 4], [0, 3]];
  const rots = cases.map(([col, lig]) => M.peutPoserTuile(doc, 'LB2', col, lig).rot);
  assert.deepEqual(rots.slice().sort(), [0, 1, 2, 3]);
  const d = docAvec(cases.map(([c, l]) => tuile('LB2', c, l)));
  const g = GR.construire(d, { jetons: [] });
  const portes = [...g.cases.keys()].filter((id) => [...g.voisins.get(id)].some((v) => !g.cases.has(v)));
  assert.equal(portes.length, 4);
  for (const id of portes) {
    const j = [...g.voisins.get(id)].filter((v) => !g.cases.has(v)).map((v) => v.match(/\d+/g).map(Number));
    assert.equal(j.length, 2, id);
    for (const [i, jj] of j) assert.ok(i >= 1 && i <= 4 && jj >= 1 && jj <= 4, `${id} -> jonction (${i},${jj})`);
    assert.equal(Math.abs(j[0][0] - j[1][0]) + Math.abs(j[0][1] - j[1][1]), 1, id);
  }
});

test('rendu 5×5 : chaque modèle se dessine à la cote 100 mm + fond perdu 3 mm dans les 4 rotations, sans valeur invalide', () => {
  for (const m of C5) for (let rot = 0; rot < 4; rot++) {
    const s = R.contenuTuile(m, { rot, fondPerdu: 3, contour: false, format: F5 });
    assert.equal(typeof s, 'string');
    assert.ok(s.length > 100 && !s.includes('NaN') && !s.includes('undefined') && !s.includes('Infinity'), `${m.id} rot ${rot}`);
  }
});
