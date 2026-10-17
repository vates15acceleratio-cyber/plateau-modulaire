'use strict';
/*
 * Tests du catalogue 4×4 livré (src/catalogue.js, révision « centrales ouvertes » de docs/45, branchée en docs/46) : contenu, validité
 * (aucune erreur ni alerte, aucune poche), règles des passages (docs/18), tracés, raccourci de coin, garantie de l'écart de 3 cases
 * entre villes, cases d'apparition, nombre de cases, équilibre et « autoroute » du pourtour mesurés sur des plateaux tirés au hasard.
 *
 * Plateaux : outils/mesures-equilibre.js, graine 20261015.
 *  - PLATEAUX : composition du générateur (PM.generateur.tuilesOrientees4x4 : tirage avec remise, poids = exemplaires, pénalité de
 *    répétition, cases égales entre moitiés, centrales orientées selon les ports) : les plateaux que le générateur peut rendre ;
 *  - LIBRES : pose libre (rotation des centrales au hasard) : les garanties R1 à R4 doivent tenir quelle que soit la pose.
 * Les seuils des tests de simulation sont les valeurs MESURÉES sur 1000 plateaux (écrites à côté de chaque assertion, mesures du
 * 2026-10-17 sur ce catalogue), avec une marge dite ; un seuil n'est jamais choisi pour que le test passe.
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/catalogue.js');
require('../src/rendu.js');
require('../src/graphe.js');
const MS = require('../outils/mesures-equilibre.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;
const GR = globalThis.PM.graphe;
const CAT = globalThis.PM.catalogue;

const GRAINE = 20261015;
const NB_PLATEAUX = 300;           // 1000 dans les mesures ; 300 suffisent aux tests
const PLATEAUX = MS.tirerPlateaux(NB_PLATEAUX, GRAINE, { orientes: true }).map((x) => x.doc);
const LIBRES = MS.tirerPlateaux(NB_PLATEAUX, GRAINE).map((x) => x.doc);

const modele = (id) => CAT.modeles.find((m) => m.id === id);
const parGabarit = (g) => CAT.modeles.filter((m) => m.gabarit === g);
const moy = (t) => t.reduce((a, b) => a + b, 0) / t.length;

const { problemesTrace, reglesPassages, signature, porteuses } = require('./aides-trace.js');

function nbPorts(m) { return porteuses(m).length; }
function lateraux(m) { return m.chemins.filter((ch) => ch.b.raccord !== undefined); }

/* ====================================================================== */
/* Catalogue : contenu et validité                                         */
/* ====================================================================== */

const IDS_ATTENDUS = {
  centrale: ['Q1', 'Q2'],   // docs/45 ; Q2 gardé (docs/18, réponse 4)
  bord: ['B1', 'B8'],
  coin: ['K2', 'K4']        // K2 inchangé (docs/18, réponse 6)
};

test('catalogue : version 3, 6 modèles, ids attendus et uniques, gabarit et grille 4×4', () => {
  assert.strictEqual(CAT.version, 3);
  assert.strictEqual(CAT.modeles.length, 6);
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.id)).size, 6);
  for (const g of Object.keys(IDS_ATTENDUS)) {
    assert.deepStrictEqual(parGabarit(g).map((m) => m.id), IDS_ATTENDUS[g], g);
  }
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4' && !('role' in m)));
});

test('catalogue : 24 exemplaires à imprimer (7 centrales, 11 bords, 6 coins) ; poids du générateur distincts (21 : docs/47)', () => {
  // l'exemplaire n'est pas une limite de pose (poses illimitées) : il fixe l'impression ; le poids du tirage est le champ `poids`
  const total = (g) => parGabarit(g).reduce((s, m) => s + m.exemplaires, 0);
  assert.deepStrictEqual([total('centrale'), total('bord'), total('coin')], [7, 11, 6]);
  assert.deepStrictEqual(Object.fromEntries(CAT.modeles.map((m) => [m.id, m.exemplaires])), { Q1: 4, Q2: 3, B1: 8, B8: 3, K2: 4, K4: 2 });
  assert.strictEqual(CAT.modeles.reduce((s, m) => s + m.exemplaires, 0), 24);
  assert.deepStrictEqual(Object.fromEntries(CAT.modeles.map((m) => [m.id, m.poids])), { Q1: 4, Q2: 3, B1: 8, B8: 1, K2: 4, K4: 1 });
  assert.deepStrictEqual(Object.fromEntries(CAT.modeles.map((m) => [m.id, M.poidsTirage(m)])), { Q1: 4, Q2: 3, B1: 8, B8: 1, K2: 4, K4: 1 });
  // de quoi remplir une grille 4×4 : 4 centrales, 8 bords, 4 coins
  assert.ok(total('centrale') >= 4 && total('bord') >= 8 && total('coin') >= 4);
});

test('catalogue précédent (version 3.04) : gardé, gelé et intact (13 modèles 4×4), ids communs identiques', () => {
  const p = CAT.precedent['4x4'];
  assert.deepStrictEqual(p.map((m) => m.id), ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'B1', 'B3', 'B4', 'B5', 'B6', 'K2', 'K4']);
  assert.ok(Object.isFrozen(p) && Object.isFrozen(p[0].cases[0]));
  assert.ok(p.every((m) => !('passages' in m) && !('pivots' in m)));
  // B1, K2 et K4 désignent les mêmes tuiles dans les deux révisions (seuls les exemplaires de B1 changent : 6 -> 8)
  for (const id of ['B1', 'K2', 'K4']) {
    const a = JSON.parse(JSON.stringify(modele(id))), b = JSON.parse(JSON.stringify(p.find((m) => m.id === id)));
    delete a.exemplaires; delete b.exemplaires; delete a.poids; delete b.poids;
    assert.deepStrictEqual(a, b, id);
  }
});

test('catalogue : identique aux modèles de outils/catalogue-organique.js (révision « centrales ouvertes », docs/45)', () => {
  require('../outils/catalogue-organique.js');
  const o = globalThis.PM.catalogueOrganique.modelesParGrille['4x4'];
  // mêmes tracés ; le POIDS du catalogue livré est l'exemplaire de l'outil (docs/46), le stock imprimé est plus grand (docs/47)
  const sans = (m) => { const c = JSON.parse(JSON.stringify(m)); delete c.exemplaires; delete c.poids; return c; };
  assert.deepStrictEqual(CAT.modeles.map(sans), o.map(sans));
  assert.deepStrictEqual(CAT.modeles.map((m) => m.poids), o.map((m) => m.exemplaires));
  assert.ok(CAT.modeles.every((m, k) => m.exemplaires >= o[k].exemplaires));
});

test('catalogue : aucune poche (case en impasse sans raccord, port ni passage) dans aucun modèle, par la règle et par un calcul indépendant', () => {
  for (const m of CAT.modeles) {
    assert.ok(!M.validerModele(m, '4x4').alertes.some((a) => a.code === 'poche'), m.id);
    // calcul indépendant : toute case hors apparition touchée par un seul chemin porte un raccord, un port ou un passage
    for (const c of m.cases.filter((x) => x.type !== 'apparition')) {
      const touches = m.chemins.filter((ch) => ch.a['case'] === c.id || ch.b['case'] === c.id);
      const sorties = touches.filter((ch) => ch.b['case'] === undefined || ch.a['case'] === undefined).length +
        (m.passages || []).filter((p) => p.a['case'] === c.id || p.b['case'] === c.id).length;
      assert.ok(touches.length >= 2 || sorties >= 1, `${m.id} : ${c.id} est une impasse`);
    }
  }
});

test('catalogue : aucune erreur ni alerte de validerModele (R1 à R4, place, apparition, réseaux, passages)', () => {
  for (const m of CAT.modeles) {
    const v = M.validerModele(m, '4x4');
    assert.deepStrictEqual(v.erreurs, [], m.id);
    assert.deepStrictEqual(v.alertes, [], m.id);
  }
});

test('passages (docs/18) : ni vers un coin, ni traversant, jamais sur une porteuse ni depuis l\'apparition ; un passage au plus par tuile ; aucun mur', () => {
  for (const m of CAT.modeles) assert.deepStrictEqual(reglesPassages(m, '4x4'), [], m.id);
  // un passage sur chaque centrale (le plateau « organique ») et sur B8 ; aucun sur B1, K2, K4
  assert.deepStrictEqual(Object.fromEntries(CAT.modeles.map((m) => [m.id, (m.passages || []).length])), { Q1: 1, Q2: 1, B1: 0, B8: 1, K2: 0, K4: 0 });
  // témoins : un traversant, un passage sur une porteuse, un second passage sur une centrale sont signalés
  const q1 = JSON.parse(JSON.stringify(modele('Q1')));
  q1.passages = [{ id: 't', a: { raccord: { cote: 3, pos: 1 } }, b: { raccord: { cote: 1, pos: 1 } } }];
  assert.ok(reglesPassages(q1, '4x4').some((t) => /traversant/.test(t)));
  const q1b = JSON.parse(JSON.stringify(modele('Q1')));
  q1b.passages.push({ id: 'q2', a: { 'case': 'c1' }, b: { raccord: { cote: 0, pos: 1 } } });
  const pb = reglesPassages(q1b, '4x4');
  assert.ok(pb.some((t) => /porteuse c1/.test(t)) && pb.some((t) => /plus d'un passage/.test(t)), pb.join(' ; '));
});

test('catalogue : noms courts et distincts, ids de cases, de chemins et de passages en chaînes', () => {
  for (const m of CAT.modeles) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 20, m.id);
    for (const el of m.cases.concat(m.chemins, m.passages || [], m.pivots || [])) assert.strictEqual(typeof el.id, 'string', m.id);
  }
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.nom)).size, 6);
});

test('catalogue : nombre de cases par gabarit (centrales 4 ou 5, bords 3 ou 4, coins 3 ou 4)', () => {
  const attendu = { Q1: 4, Q2: 5, B1: 3, B8: 4, K2: 3, K4: 4 };
  for (const m of CAT.modeles) assert.strictEqual(m.cases.length, attendu[m.id], m.id);
});

test('centrales ouvertes (docs/18, docs/45) : un seul relais dessert 3 coins (Q1) ou 4 coins (Q2), chaque port à 1 pas du relais', () => {
  for (const m of parGabarit('centrale')) {
    const liens = m.chemins.filter((ch) => ch.b['case'] !== undefined);
    const ports = porteuses(m);
    const relais = m.cases.filter((c) => !ports.includes(c.id));
    assert.strictEqual(relais.length, 1, m.id + ' : un seul relais');
    for (const p of ports) assert.ok(liens.some((ch) => [ch.a['case'], ch.b['case']].sort().join() === [p, relais[0].id].sort().join()), `${m.id} : ${p} relié au relais`);
    assert.strictEqual(liens.length, ports.length, m.id + ' : aucun autre lien');
  }
  assert.deepStrictEqual(parGabarit('centrale').map(nbPorts), [3, 4]);
});

test('catalogue : raccords au milieu pour tout côté qui regarde une centrale, raccourci E0 + O2 (bords) et E0 + S2 (coins)', () => {
  for (const m of CAT.modeles) {
    const r = M.masquesDuModele(m).raccords; // raccords des chemins et des passages
    if (m.gabarit === 'centrale') {
      // côtés d'une centrale : milieu seulement, sur les 4 côtés (aucun mur dans ce catalogue)
      for (let cote = 0; cote < 4; cote++) assert.strictEqual(G.triplet(r, cote), 0b010, `${m.id} côté ${cote}`);
    } else if (m.gabarit === 'bord') {
      assert.ok((r & 0x808) === 0x808, `${m.id} : raccourci du bord (0x808)`);
      assert.strictEqual(G.triplet(r, 0), 0, `${m.id} : rien sur le côté extérieur`);
      assert.strictEqual(G.triplet(r, 2), 0b010, `${m.id} : côté intérieur au milieu (chemin ou passage)`);
      assert.strictEqual(r & ~0x808 & ~(0b010 << 6), 0, `${m.id} : aucun autre raccord latéral`);
    } else {
      assert.strictEqual(r, 0x108, `${m.id} : raccourci du coin (0x108) et rien d'autre`);
    }
  }
});

test('catalogue : ports (coins intérieurs seulement) : bord 0b1100, coin 0b0100, centrales 3 ou 4 ports', () => {
  for (const m of parGabarit('bord')) assert.strictEqual(M.masquesDuModele(m).portsCoin, 0b1100, m.id);
  for (const m of parGabarit('coin')) assert.strictEqual(M.masquesDuModele(m).portsCoin, 0b0100, m.id);
  for (const m of parGabarit('centrale')) assert.ok([3, 4].includes(nbPorts(m)), m.id);
});

test('catalogue : une case d\'apparition par bord et par coin, aucune sur les centrales, jamais de port (R4)', () => {
  for (const m of CAT.modeles) {
    const appar = m.cases.filter((c) => c.type === 'apparition');
    assert.strictEqual(appar.length, m.gabarit === 'centrale' ? 0 : 1, m.id);
    assert.strictEqual(M.aUneApparition(m), m.gabarit !== 'centrale', m.id);
    if (appar.length) assert.ok(!porteuses(m).includes(appar[0].id), m.id + ' : l\'apparition ne porte pas de port');
  }
});

test('catalogue : le raccourci part de la case d\'apparition (doc 19, doc 20 D5), jamais d\'une case à port ; coin : apparition sur la diagonale extérieure', () => {
  for (const m of CAT.modeles.filter((x) => x.gabarit !== 'centrale')) {
    const ports = porteuses(m);
    const appar = m.cases.find((c) => c.type === 'apparition');
    for (const ch of lateraux(m)) assert.ok(!ports.includes(ch.a['case']), `${m.id} : ${ch.id} part d'une case à port`);
    const raccourci = lateraux(m).filter((ch) => ch.b.raccord.pos !== 1 || (m.gabarit === 'coin' && ch.b.raccord.cote === 2));
    assert.strictEqual(raccourci.length, 2, m.id + ' : deux raccords de raccourci');
    for (const ch of raccourci) assert.strictEqual(ch.a['case'], appar.id, `${m.id} : ${ch.id} ne part pas de l'apparition`);
    if (m.gabarit === 'coin') assert.strictEqual(appar.x, appar.y, m.id + ' : apparition sur la diagonale NO-SE');
    if (m.gabarit === 'bord') assert.ok(appar.x >= 50 && appar.x <= 70 && appar.y <= 50, m.id + ' : apparition près du milieu du côté extérieur');
  }
});

test('variété : aucune centrale n\'est la copie tournée d\'une autre, aucun doublon par gabarit, aucune paire miroir (docs/18)', () => {
  const centrales = parGabarit('centrale');
  for (let i = 0; i < centrales.length; i++) {
    for (let j = i + 1; j < centrales.length; j++) {
      for (let rot = 0; rot < 4; rot++) {
        assert.notStrictEqual(signature(centrales[i], rot), signature(centrales[j], 0), `${centrales[i].id} tourné = ${centrales[j].id}`);
      }
    }
  }
  for (const g of ['coin', 'bord']) {
    const sigs = parGabarit(g).map((m) => signature(m, 0));
    assert.strictEqual(new Set(sigs).size, sigs.length, g);
  }
  // pas de paires miroir : aucun modèle n'est le reflet (dans une rotation quelconque) d'un AUTRE modèle (un carton par modèle)
  for (const a of CAT.modeles) for (const b of CAT.modeles) for (let rot = 0; rot < 4; rot++) {
    if (a !== b) assert.notStrictEqual(signature(a, rot, true), signature(b, 0), `${a.id} reflété = ${b.id}`);
  }
  // témoin : le reflet de Q1 serait détecté
  assert.ok([0, 1, 2, 3].some((r) => signature(modele('Q1'), r, true) === signature(modele('Q1'), 0)), 'Q1 est symétrique : son reflet est lui-même tourné');
});

test('tracés : pas de chemin sur une case, dans une zone de coin, ou contre un autre chemin', () => {
  const pb = [].concat(...CAT.modeles.map((m) => problemesTrace(m, '4x4')));
  assert.deepStrictEqual(pb, []);
});

test('tracés : le contrôle détecte un chemin qui traverse une case (témoin)', () => {
  const m = JSON.parse(JSON.stringify(modele('Q2')));
  m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c3' } }); // diagonale NO-SE : passe par le relais r (68, 68)
  m.chemins.push({ id: 'y', a: { 'case': 'c2' }, b: { 'case': 'c4' } }); // diagonale NE-SO : croise x
  assert.ok(problemesTrace(m).some((t) => t.includes('x et y se touchent')));
  assert.ok(problemesTrace(m).some((t) => t.includes('de r')));
  // les mêmes défauts sont des erreurs bloquantes de validerModele (règles physiques v2)
  const codes = M.validerModele(m).erreurs.map((e) => e.code);
  assert.ok(codes.includes('chemins_croises') && codes.includes('chemin_case'), codes.join(' '));
});

/* ====================================================================== */
/* Raccourci de coin (docs/20 D5), dans toutes les rotations               */
/* ====================================================================== */

/** Document de la grille 4×4 avec les tuiles données [{id, col, lig, rot}], sans contrôle d'exemplaires. */
function docAvec(tuiles) {
  const doc = CAT.nouveauDocument();
  doc.modeles.forEach((m) => { m.exemplaires = 10; });
  doc.plateau.tuiles = tuiles.map((t) => ({ modeleId: t.id, col: t.col, lig: t.lig, rot: t.rot }));
  return doc;
}
/**
 * Le raccourci relie-t-il deux tuiles voisines ? Au moins un lien direct entre une case de chaque tuile, aucune case à port
 * à ses deux bouts, et les deux cases d'apparition voisines l'une de l'autre (1 pas : docs/19, le raccourci part de l'apparition).
 */
function raccourciRelie(doc, a, b) {
  const g = GR.construire(doc, { jetons: [] });
  const cle = (t) => `${t.col},${t.lig}:`;
  const dans = (t) => [...g.cases.values()].filter((c) => c.id.startsWith(cle(t)));
  const appar = (t) => dans(t).filter((c) => c.type === 'apparition')[0].id;
  const porteuse = (id) => [...g.voisins.get(id)].some((v) => !g.cases.has(v));
  const liens = [];
  for (const c of dans(a)) for (const v of g.voisins.get(c.id)) if (g.cases.has(v) && v.startsWith(cle(b))) liens.push([c.id, v]);
  if (!liens.length || liens.some(([x, y]) => porteuse(x) || porteuse(y))) return false;
  const d = GR.distances(g, appar(a));
  return d.get(appar(b)) === 1;
}

test('raccourci de coin : coin et bord voisins reliés par leurs apparitions aux 4 coins du plateau (rotations suggérées)', () => {
  const coins = parGabarit('coin'), bords = parGabarit('bord');
  const dispositions = [
    { coin: [0, 0], bords: [[1, 0], [0, 1]] }, { coin: [3, 0], bords: [[2, 0], [3, 1]] },
    { coin: [3, 3], bords: [[2, 3], [3, 2]] }, { coin: [0, 3], bords: [[1, 3], [0, 2]] }
  ];
  const F = G.format('4x4');
  let essais = 0;
  for (const k of coins) for (const b of bords) for (const d of dispositions) {
    for (const [bc, bl] of d.bords) {
      const tk = { id: k.id, col: d.coin[0], lig: d.coin[1], rot: M.rotationDeduite(d.coin[0], d.coin[1], 'coin', F) };
      const tb = { id: b.id, col: bc, lig: bl, rot: M.rotationDeduite(bc, bl, 'bord', F) };
      const doc = docAvec([tk, tb]);
      assert.ok(raccourciRelie(doc, tk, tb), `${k.id} en (${tk.col},${tk.lig}) rot ${tk.rot} et ${b.id} en (${bc},${bl}) rot ${tb.rot}`);
      assert.ok(M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length === 0);
      essais++;
    }
  }
  assert.strictEqual(essais, 2 * 2 * 8);
});

test('raccourci de bord : deux bords voisins du pourtour reliés sur les 4 côtés, dans toutes les rotations', () => {
  const F = G.format('4x4');
  const paires = [[[1, 0], [2, 0]], [[3, 1], [3, 2]], [[2, 3], [1, 3]], [[0, 2], [0, 1]]];
  for (const a of parGabarit('bord')) for (const b of parGabarit('bord')) for (const [pa, pb] of paires) {
    const ta = { id: a.id, col: pa[0], lig: pa[1], rot: M.rotationDeduite(pa[0], pa[1], 'bord', F) };
    const tb = { id: b.id, col: pb[0], lig: pb[1], rot: M.rotationDeduite(pb[0], pb[1], 'bord', F) };
    const doc = docAvec([ta, tb]);
    assert.ok(raccourciRelie(doc, ta, tb), `${a.id} (${pa}) et ${b.id} (${pb})`);
    assert.strictEqual(M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length, 0);
  }
  assert.strictEqual(G.tournerRaccords(0x808, 2), 0x220);
  assert.strictEqual(G.apparier(0x220, 1, 0x220).connectes, 4);
  assert.strictEqual(G.apparier(0x108, 1, 0x808).connectes, 1);
  assert.strictEqual(G.tournerRaccords(0x808, 1), 0x044);
  assert.strictEqual(G.tournerRaccords(0x108, 2), 0x204);
  assert.strictEqual(G.apparier(0x044, 2, 0x204).connectes, 1);
});

test('raccords du milieu : bord face à centrale et centrale face à centrale se rejoignent dans toutes les rotations, sans raccord mort', () => {
  const F = G.format('4x4');
  for (const c of parGabarit('centrale')) for (const b of parGabarit('bord')) for (let rot = 0; rot < 4; rot++) {
    const doc = docAvec([{ id: b.id, col: 1, lig: 0, rot: M.rotationDeduite(1, 0, 'bord', F) }, { id: c.id, col: 1, lig: 1, rot }]);
    assert.strictEqual(M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length, 0, `${b.id} / ${c.id} rot ${rot}`);
  }
  for (const a of parGabarit('centrale')) for (const b of parGabarit('centrale')) for (let ra = 0; ra < 4; ra++) for (let rb = 0; rb < 4; rb++) {
    const doc = docAvec([{ id: a.id, col: 1, lig: 1, rot: ra }, { id: b.id, col: 2, lig: 1, rot: rb }]);
    assert.strictEqual(M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length, 0, `${a.id} r${ra} / ${b.id} r${rb}`);
  }
});

/* ====================================================================== */
/* Plateaux tirés au hasard                                                */
/* ====================================================================== */

test('plateaux du générateur : tirage reproductible, 16 tuiles, aucune erreur ni alerte de plateau', () => {
  for (const doc of PLATEAUX) {
    assert.strictEqual(doc.plateau.tuiles.length, 16);
    const v = M.validerPlateau(doc);
    assert.deepStrictEqual(v.erreurs, []);
    // mesuré sur 1000 plateaux : aucune alerte (ni raccord mort : aucun mur ; ni jonction à moins de 2 ports : orientation)
    assert.deepStrictEqual(v.alertes, []);
  }
  assert.deepStrictEqual(MS.tirerPlateaux(3, GRAINE, { orientes: true }).map((x) => JSON.stringify(x.doc.plateau)), PLATEAUX.slice(0, 3).map((d) => JSON.stringify(d.plateau)));
});

test('pose libre (constat) : sans orientation, une jonction peut manquer de ports ; l\'orientation du générateur en donne au moins 3 partout', () => {
  // mesuré sur 1000 plateaux en pose libre : 13 plateaux (1,3 %) ont une jonction à moins de 2 ports (minimum 0 : Q1 n'a que 3 ports) ;
  // sur ces 300 : 4. Composition du générateur : au moins 3 ports à chaque jonction sur les 1000 plateaux.
  const malLibres = LIBRES.filter((d) => M.jonctionsMalReliees(d).length).length;
  assert.ok(malLibres >= 1 && malLibres / LIBRES.length < 0.03, 'pose libre : ' + malLibres);
  for (const doc of LIBRES) assert.deepStrictEqual(M.validerPlateau(doc).erreurs, []);
  for (const doc of PLATEAUX) assert.ok(GR.construire(doc, { jetons: [] }).jonctions.every((jn) => jn.ports >= 3));
});

test('simulation : graphe connexe (9 jonctions-cases comprises), 9 nœuds de jonction, en pose libre comme au générateur', () => {
  for (const doc of PLATEAUX.concat(LIBRES)) {
    const g = GR.construire(doc, { jetons: [] });
    assert.strictEqual(g.jonctions.length, 9);
    assert.ok(GR.connexe(g));
  }
});

test('simulation : les raccords et passages seuls (sans les jonctions) relient presque toujours toutes les cases du plateau', () => {
  // mesuré : 997 plateaux sur 1000 (300 sur 300 ici) ; en cas d'exception, un groupe de 3 ou 4 Q1 dont les relais ne se rejoignent que
  // par leurs ports (les passages des Q1 relient les tuiles voisines sans case) : le graphe reste connexe par les jonctions
  let connexes = 0;
  for (const doc of PLATEAUX) {
    const g = GR.construire(doc, { jetons: [] });
    const ids = [...g.cases.keys()], vus = new Set([ids[0]]), file = [ids[0]];
    for (let q = 0; q < file.length; q++) g.voisins.get(file[q]).forEach((y) => { if (g.cases.has(y) && !vus.has(y)) { vus.add(y); file.push(y); } });
    if (vus.size === ids.length) connexes++;
    else assert.ok(doc.plateau.tuiles.filter((t) => t.modeleId === 'Q1').length >= 3, 'cases isolées sans groupe de Q1');
  }
  assert.ok(connexes / PLATEAUX.length >= 0.98, 'plateaux reliés par les raccords seuls : ' + connexes + ' sur ' + PLATEAUX.length);
});

/** Plus petit nombre de pas entre deux jonctions quelconques, toutes les jonctions étant des cases. */
function ecartMinJonctions(doc) {
  const g = GR.construire(doc, { jetons: [] });
  let m = Infinity;
  for (const a of g.jonctions) {
    const d = GR.distances(g, a.id);
    for (const b of g.jonctions) if (a !== b && d.has(b.id)) m = Math.min(m, d.get(b.id));
  }
  return m;
}

test('garantie de l\'écart : au moins 4 pas (3 cases) entre deux jonctions, donc entre deux villes, quelles que soient la pose et les 7 villes', () => {
  // toutes les jonctions sont des cases : le plus petit écart entre deux jonctions minore celui de deux villes choisies parmi elles ;
  // les passages rendent voisines les cases qu'ils relient : l'écart tient parce qu'une porteuse ne touche jamais un passage
  for (const doc of PLATEAUX.concat(LIBRES)) assert.ok(ecartMinJonctions(doc) >= 4);
  // mesuré : exactement 4 sur tous les plateaux
  assert.strictEqual(Math.min(...PLATEAUX.map(ecartMinJonctions)), 4);
});

test('garantie de l\'écart, preuve locale lue dans le graphe : une jonction ne touche que des cases à port, une case à port touche une seule jonction et aucune autre case à port', () => {
  for (const doc of PLATEAUX.concat(LIBRES)) {
    const g = GR.construire(doc, { jetons: [] });
    const jonction = (id) => !g.cases.has(id);
    for (const jn of g.jonctions) {
      for (const c of g.voisins.get(jn.id)) assert.ok(g.cases.has(c));
      assert.strictEqual(jn.cases.length, g.voisins.get(jn.id).size);
    }
    for (const [id] of g.cases) {
      const js = [...g.voisins.get(id)].filter(jonction);
      assert.ok(js.length <= 1, id + ' : R1, un seul port');
      if (js.length) {
        for (const v of g.voisins.get(id)) {
          if (jonction(v)) continue;
          assert.strictEqual([...g.voisins.get(v)].filter(jonction).length, 0, `${id} et ${v} : R2 / R3, deux cases à port reliées`);
        }
      }
    }
  }
});

test('garantie de l\'écart : témoin négatif, des centrales en anneau (R2 violée) rapprochent deux jonctions à moins de 4 pas', () => {
  const anneau = (id, ex) => ({
    id, nom: 'Anneau ' + id, gabarit: 'centrale', grille: '4x4', exemplaires: ex,
    cases: [[36, 36], [84, 36], [84, 84], [36, 84]].map(([x, y], k) => ({ id: 'c' + (k + 1), x, y, diametre: 24, type: 'deplacement' })),
    chemins: [['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'c1']].map(([a, b], k) => ({ id: 'h' + k, a: { 'case': a }, b: { 'case': b } }))
      .concat([0, 1, 2, 3].map((k) => ({ id: 'p' + k, a: { 'case': 'c' + (k + 1) }, b: { coin: k } })))
  });
  const m = anneau('X', 10);
  assert.ok(M.validerModele(m).alertes.some((a) => a.code === 'porteuses_reliees'));
  const doc = JSON.parse(JSON.stringify(PLATEAUX[0]));
  doc.modeles.push(m);
  doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, '4x4') === 'centrale').forEach((t) => { t.modeleId = 'X'; });
  assert.ok(ecartMinJonctions(doc) < 4, 'écart mesuré ' + ecartMinJonctions(doc));
});

test('garantie de l\'écart : témoin négatif, des passages posés sur des porteuses rapprochent deux jonctions', () => {
  // Qx : variante de Q1 dont les porteuses SE (c3) et NO (c1) partent en passage vers les côtés E et O (R3 et la règle des passages
  // violées) : deux Qx côte à côte rendent voisines la porteuse SE de l'une et la porteuse NO de l'autre, d'une jonction à l'autre en 3 pas
  const m = JSON.parse(JSON.stringify(modele('Q1')));
  m.id = 'Qx';
  m.chemins = m.chemins.filter((ch) => ch.id !== 're');
  m.passages = [{ id: 'q1', a: { 'case': 'c3' }, b: { raccord: { cote: 1, pos: 1 } } }, { id: 'q2', a: { 'case': 'c1' }, b: { raccord: { cote: 3, pos: 1 } } }];
  assert.ok(M.validerModele(m, '4x4').alertes.some((a) => a.code === 'porteuse_passage'));
  assert.ok(reglesPassages(m, '4x4').some((t) => /porteuse/.test(t)));
  const doc = JSON.parse(JSON.stringify(PLATEAUX[0]));
  doc.modeles.push(m);
  doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, '4x4') === 'centrale').forEach((t) => { t.modeleId = 'Qx'; t.rot = 0; });
  assert.ok(ecartMinJonctions(doc) < 4, 'écart mesuré ' + ecartMinJonctions(doc));
});

test('simulation : nombre de cases par plateau, mesuré à 58,4 (moitiés égales)', () => {
  const nb = PLATEAUX.map((doc) => GR.construire(doc, { jetons: [] }).cases.size + 2);
  // mesuré sur 1000 plateaux du générateur : moyenne 58,37 ; minimum 54 ; maximum 62 (docs/45 : 57,4 en pose libre orientée)
  assert.ok(Math.abs(moy(nb) - 58.4) < 0.6, 'moyenne ' + moy(nb));
  assert.ok(Math.min(...nb) >= 53 && Math.max(...nb) <= 63, `de ${Math.min(...nb)} à ${Math.max(...nb)}`);
  for (const doc of PLATEAUX.slice(0, 20)) {
    const somme = doc.plateau.tuiles.reduce((s, t) => s + modele(t.modeleId).cases.length, 0);
    assert.strictEqual(GR.construire(doc, { jetons: [] }).cases.size, somme);
  }
  // décision 2 (docs/18) : autant de cases dans la moitié verte que dans la moitié rouge, sur chaque plateau du générateur
  for (const doc of PLATEAUX) {
    const mo = GR.casesParMoitie(doc, GR.construire(doc, { jetons: MS.PAIRES.find((p) => p.cle === '(1,2)+(3,2)').jetons }));
    assert.strictEqual(mo.ecart, 0, JSON.stringify(mo));
  }
});

test('simulation : chaque apparition a au moins 3 sorties ; aucun raccord mort (aucun mur dans ce catalogue)', () => {
  for (const doc of PLATEAUX.concat(LIBRES)) {
    const g = GR.construire(doc, { jetons: [] });
    for (const p of [1, 2]) for (const id of g.apparitions[p]) assert.ok(g.voisins.get(id).size >= 3, id);
    assert.strictEqual(M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length, 0);
  }
});

test('simulation : distance de chaque case d\'apparition à sa jonction, par modèle (2 ou 3 pas)', () => {
  const pas = (m) => {
    const adj = new Map(m.cases.map((c) => [c.id, []]));
    m.chemins.filter((ch) => ch.b['case'] !== undefined).forEach((ch) => { adj.get(ch.a['case']).push(ch.b['case']); adj.get(ch.b['case']).push(ch.a['case']); });
    const dep = m.cases.find((c) => c.type === 'apparition').id, d = new Map([[dep, 0]]), file = [dep];
    for (let q = 0; q < file.length; q++) adj.get(file[q]).forEach((y) => { if (!d.has(y)) { d.set(y, d.get(file[q]) + 1); file.push(y); } });
    return porteuses(m).map((p) => d.get(p) + 1).sort();
  };
  const attendu = { B1: [2, 2], B8: [2, 3], K2: [3], K4: [3] };
  for (const id of Object.keys(attendu)) assert.deepStrictEqual(pas(modele(id)), attendu[id], id);
});

/* ====================================================================== */
/* Équilibre (critère de docs/archives/16 et docs/19), plateaux du générateur */
/* ====================================================================== */

const STATS = MS.mesurer(MS.tirerPlateaux(NB_PLATEAUX, GRAINE, { orientes: true }), { paires: 'toutes' });
const A = STATS.acc;
const part = (h, seuil) => Object.keys(h).filter((k) => k !== 'n/a' && Number(k) >= seuil).reduce((s, k) => s + h[k], 0) / A.n;

test('équilibre : 36 combinaisons de jonctions-cases par plateau, 7 villes, ville inaccessible rare, aucune apparition lointaine', () => {
  assert.strictEqual(A.n, NB_PLATEAUX * 36);
  // mesuré sur 1000 plateaux : 18 configurations sur 36000 (0,05 %) ont une ville coupée par d'autres villes (villes non
  // traversables, groupe de Q1 relié par ses seuls ports) ; 0 sur ces 300 ; le générateur les rejette (cause « ville inaccessible »)
  assert.ok(A.inaccessible / A.n < 0.002, 'villes inaccessibles : ' + A.inaccessible);
  assert.strictEqual(A.lointaine, 0);
  assert.strictEqual(A.partiel, 0);
  assert.deepStrictEqual(Object.keys(A.ecartVilles), ['4']);
});

test('équilibre : la première ville est à 2 pas des deux joueurs, à égalité', () => {
  // mesuré sur 1000 plateaux (36000 configurations) : 2 pas et égalité dans 100 % des cas
  assert.deepStrictEqual(Object.keys(A.ecartPremiere), ['0']);
  for (const p of [1, 2]) assert.deepStrictEqual(Object.keys(A.ville1[p]), ['2']);
  assert.strictEqual(A.premiereInegale, 0);
});

test('équilibre : écart par rang et S mesurés (seuils = mesure + marge)', () => {
  // mesuré sur 1000 plateaux (36000 configurations) : écart max >= 2 : 7,0 % ; jamais >= 3
  assert.ok(part(A.ecartMax, 2) < 0.1, 'écart max >= 2 : ' + part(A.ecartMax, 2));
  assert.ok(part(A.ecartMax, 3) < 0.002, 'écart max >= 3 : ' + part(A.ecartMax, 3));
  assert.strictEqual(part(A.ecartMax, 4), 0);
  // mesuré : S moyen 1,71 (300 plateaux) ; S >= 4 : 6,3 % ; S >= 5 : 1,1 % ; S maximum 6
  const n = A.n - (A.S['n/a'] || 0);
  const sMoy = Object.keys(A.S).filter((k) => k !== 'n/a').reduce((s, k) => s + Number(k) * A.S[k], 0) / n;
  assert.ok(sMoy > 1.4 && sMoy < 2.0, 'S moyen ' + sMoy);
  assert.ok(part(A.S, 4) < 0.09, 'S >= 4 : ' + part(A.S, 4));
  assert.ok(part(A.S, 5) < 0.025, 'S >= 5 : ' + part(A.S, 5));
  assert.ok(part(A.S, 8) === 0, 'S >= 8 : ' + part(A.S, 8));
  // aux rangs 1 et 2 l'écart est nul (mesuré : 100 %)
  assert.ok((A.rang[0]['0'] || 0) / A.n > 0.99, 'rang 1');
  assert.ok((A.rang[1]['0'] || 0) / A.n > 0.99, 'rang 2');
});

test('équilibre : « 5 contre 2 » rare et dépendant du choix des jonctions-cases', () => {
  // mesuré sur 1000 plateaux : 0,67 % des configurations (4,1 % avec le catalogue précédent) ; jamais pour les 3 paires de la rangée
  // centrale (défaut du générateur) ni pour les 9 paires « une en j = 1, une en j = 3 » (jonctions variées, moitiés égales)
  assert.ok(A.cinqDeux / A.n < 0.015, '5 contre 2 : ' + A.cinqDeux / A.n);
  const sans = new Set(MS.PAIRES.filter((p) => STATS.parPaire[p.cle].cinqDeux === 0).map((p) => p.cle));
  const centre = ['(1,2)+(2,2)', '(1,2)+(3,2)', '(2,2)+(3,2)'];
  const equilibrees = [];
  for (const a of [1, 2, 3]) for (const b of [1, 2, 3]) equilibrees.push('(' + a + ',1)+(' + b + ',3)');
  for (const c of centre.concat(equilibrees)) assert.ok(sans.has(c), c);
  assert.ok(STATS.plateaux.every((p) => p.nbBloquees < p.n));
  // « 4 contre 3 » (mesuré : 14,7 %) : le partage 7 = 4 + 3 reste le cas normal, sans conséquence
  assert.ok(A.quatreTrois / A.n > 0.08 && A.quatreTrois / A.n < 0.22);
});

test('équilibre : tempo, villes atteignables en au plus 3, 4 et 5 pas', () => {
  // mesuré sur 1000 plateaux : 6,17 / 6,94 / 7,00 villes sur 7 (vert) et 6,18 / 6,94 / 7,00 (rouge)
  for (const p of [1, 2]) {
    assert.ok(moy(A.tempo[p][3]) > 5.9 && moy(A.tempo[p][3]) < 6.5, 'tempo 3 pas joueur ' + p);
    assert.ok(moy(A.tempo[p][4]) > 6.7 && moy(A.tempo[p][4]) <= 7.0, 'tempo 4 pas joueur ' + p);
    assert.ok(moy(A.tempo[p][5]) > 6.98, 'tempo 5 pas joueur ' + p);
  }
  assert.ok(Math.abs(moy(A.tempo[1][3]) - moy(A.tempo[2][3])) < 0.15, 'équité entre les camps');
});

test('autoroute du pourtour (constat, voir docs/21 § 8) : les apparitions de deux camps sont voisines, le pourtour est plus court que le centre', () => {
  // mesuré sur 1000 plateaux : une apparition verte et une rouge sont toujours à 1 pas ; jusqu'à la rangée de jonctions adverse :
  // 3,0 pas par le pourtour (minimum 3) contre 4,68 à 4,74 par les colonnes 1 et 2
  assert.deepStrictEqual(Object.keys(STATS.ecartApparitions), ['1']);
  for (const p of [1, 2]) {
    const m = (h) => Object.keys(h).reduce((s, k) => s + Number(k) * h[k], 0) / NB_PLATEAUX;
    assert.ok(m(STATS.pourtourAdverse[p]) > 2.9 && m(STATS.pourtourAdverse[p]) < 3.2, 'pourtour ' + m(STATS.pourtourAdverse[p]));
    assert.ok(m(STATS.centreAdverse[p]) > 4.3 && m(STATS.centreAdverse[p]) < 5.2, 'centre ' + m(STATS.centreAdverse[p]));
    assert.ok(Math.min(...Object.keys(STATS.pourtourAdverse[p]).map(Number)) === 3);
  }
  // mesuré (PM.graphe.flancs) : le pourtour est plus court que le centre dans 97,9 % des mesures, 1,18 pas de moins en moyenne
  const f = STATS.flancs.N;
  assert.ok(f.plusCourt / f.n > 0.95, 'part ' + f.plusCourt / f.n);
  const finis = f.diff.filter(Number.isFinite);
  assert.ok(moy(finis) < -0.8 && moy(finis) > -1.6, 'différence moyenne ' + moy(finis));
});

test('équilibre : aucune tuile du catalogue ne fait basculer l\'équilibre à elle seule (S moyen avec / sans, écart < 0,8)', () => {
  // mesuré sur 1000 plateaux : plus grand écart de S moyen avec / sans un modèle : 0,52 (Q2, 0,43 sur ces 300) ; B8 0,26 ; Q1 0,12 ;
  // K4 0,02 ; marge de 0,25 pour 300 plateaux (catalogue précédent : 0,34 au plus, seuil 0,55)
  for (const m of CAT.modeles) {
    const avec = STATS.plateaux.filter((p) => p.modeles.has(m.id)), sans = STATS.plateaux.filter((p) => !p.modeles.has(m.id));
    if (!sans.length || !avec.length) continue;
    const d = Math.abs(moy(avec.map((p) => p.sommeS / p.n)) - moy(sans.map((p) => p.sommeS / p.n)));
    assert.ok(d < 0.8, `${m.id} : écart de S moyen ${d.toFixed(2)}`);
  }
});

/* ====================================================================== */
/* Document                                                                */
/* ====================================================================== */

test('nouveauDocument : document vide (version 2, grille 4×4) avec une copie modifiable des 6 modèles', () => {
  const doc = CAT.nouveauDocument();
  const vide = M.nouveauDocument();
  assert.strictEqual(doc.version, 2);
  assert.strictEqual(doc.grille, '4x4');
  assert.deepStrictEqual(doc.plateau, vide.plateau);
  assert.strictEqual(doc.version, vide.version);
  assert.deepStrictEqual(doc.modeles, JSON.parse(JSON.stringify(CAT.modeles)));
  assert.ok(Object.isFrozen(CAT.modeles) && Object.isFrozen(CAT.modeles[0].cases[0]) && Object.isFrozen(CAT.modeles[0].passages[0]));
  doc.modeles[0].cases[0].x = 1;
  doc.modeles[0].passages.pop();
  doc.modeles.pop();
  assert.strictEqual(CAT.modeles[0].cases[0].x, 68);
  assert.strictEqual(CAT.modeles[0].passages.length, 1);
  assert.strictEqual(CAT.modeles.length, 6);
  assert.notStrictEqual(CAT.nouveauDocument().modeles, CAT.nouveauDocument().modeles);
});

test('nouveauDocument : le catalogue se pose à plein sans erreur, apparitions complètes pour les deux camps', () => {
  const doc = PLATEAUX[0];
  assert.strictEqual(doc.plateau.tuiles.length, 16);
  assert.deepStrictEqual(M.validerPlateau(doc).erreurs, []);
  const e = GR.equilibre(doc, { jetons: MS.PAIRES[0].jetons });
  assert.strictEqual(e.complet, true);
  assert.deepStrictEqual(e.apparitions, { 1: 6, 2: 6 });
});

test('nouveauDocument : la grille 4×4 est celle par défaut, modeles est le catalogue 4×4 de modelesParGrille, grille inconnue refusée', () => {
  assert.strictEqual(CAT.modelesParGrille['4x4'], CAT.modeles);
  assert.deepStrictEqual(CAT.nouveauDocument('4x4').modeles, JSON.parse(JSON.stringify(CAT.modeles)));
  assert.strictEqual(CAT.nouveauDocument('5x5').grille, '5x5');   // catalogue 5×5 : tests/catalogue-5x5.test.js
  assert.throws(() => CAT.nouveauDocument('3x3'), /Grille inconnue/);
});
