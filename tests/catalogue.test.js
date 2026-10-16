'use strict';
/*
 * Tests du catalogue 4×4 de la version 2 (src/catalogue.js) : contenu, validité (aucune erreur ni alerte, aucune poche),
 * tracés, raccourci de coin, garantie de l'écart de 3 cases entre villes, cases d'apparition, nombre de cases,
 * équilibre et « autoroute » du pourtour mesurés sur des plateaux tirés au hasard.
 *
 * Les plateaux sont tirés par outils/mesures-equilibre.js (tirage du générateur : avec remise, poids = exemplaires,
 * pénalité de répétition ; mêmes tirages que le rapport docs/21-mesures-catalogue-v2.md, graine 20261015). Les seuils des tests de simulation sont les valeurs MESURÉES sur 1000 plateaux (écrites à côté de
 * chaque assertion), avec une marge dite ; un seuil n'est jamais choisi pour que le test passe.
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
const R = globalThis.PM.rendu;

const GRAINE = 20261015;
const NB_PLATEAUX = 300;           // 1000 dans le rapport ; 300 suffisent aux tests (3 s)
const PLATEAUX = MS.tirerPlateaux(NB_PLATEAUX, GRAINE).map((x) => x.doc);

const modele = (id) => CAT.modeles.find((m) => m.id === id);
const parGabarit = (g) => CAT.modeles.filter((m) => m.gabarit === g);
const moy = (t) => t.reduce((a, b) => a + b, 0) / t.length;

const { problemesTrace } = require('./aides-trace.js');

/** Cases de départ des chemins vers un coin (porteuses) et vers un raccord, d'un modèle. */
function porteuses(m) { return m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']); }
function nbPorts(m) { return porteuses(m).length; }
function lateraux(m) { return m.chemins.filter((ch) => ch.b.raccord !== undefined); }
/** Nombre de réseaux (composantes connexes des liens case-case). */
function nbReseaux(m) {
  const parent = new Map(m.cases.map((c) => [c.id, c.id]));
  const racine = (x) => { while (parent.get(x) !== x) x = parent.get(x); return x; };
  for (const ch of m.chemins) if (ch.b['case'] !== undefined) parent.set(racine(ch.a['case']), racine(ch.b['case']));
  return new Set(m.cases.map((c) => racine(c.id))).size;
}

/* ====================================================================== */
/* Catalogue : contenu et validité                                         */
/* ====================================================================== */

const IDS_ATTENDUS = {
  centrale: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
  bord: ['B1', 'B3', 'B4', 'B5', 'B6'], // B2 (bord fermé) supprimé : docs/22
  coin: ['K2', 'K4']                   // K1 (direct) et K3 (poche) retirés : docs/18, retours après essai
};

test('catalogue : version 2, 13 modèles, ids attendus et uniques, gabarit et grille 4×4', () => {
  assert.strictEqual(CAT.version, 2);
  assert.strictEqual(CAT.modeles.length, 13);
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.id)).size, 13);
  for (const g of Object.keys(IDS_ATTENDUS)) {
    assert.deepStrictEqual(parGabarit(g).map((m) => m.id), IDS_ATTENDUS[g], g);
  }
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4' && !('role' in m)));
});

test('catalogue : 22 exemplaires à imprimer (7 centrales, 10 bords, 5 coins), poids du générateur', () => {
  // l'exemplaire n'est plus une limite de pose (poses illimitées) : il fixe l'impression et le poids du tirage
  const total = (g) => parGabarit(g).reduce((s, m) => s + m.exemplaires, 0);
  assert.deepStrictEqual([total('centrale'), total('bord'), total('coin')], [7, 10, 5]);
  assert.deepStrictEqual(Object.fromEntries(CAT.modeles.map((m) => [m.id, m.exemplaires])),
    { C1: 1, C2: 1, C3: 1, C4: 2, C5: 1, C6: 1, B1: 6, B3: 1, B4: 1, B5: 1, B6: 1, K2: 4, K4: 1 });
  assert.strictEqual(CAT.modeles.reduce((s, m) => s + m.exemplaires, 0), 22);
  // de quoi remplir une grille 4×4 sans répéter un modèle : 4 centrales, 8 bords, 4 coins
  assert.ok(total('centrale') >= 4 && total('bord') >= 8 && total('coin') >= 4);
});

test('catalogue : K1 (coin direct) et K3 (coin à poche) sont retirés ; B4 n\'est plus un bord à relais pendant', () => {
  assert.strictEqual(modele('K1'), undefined);
  assert.strictEqual(modele('K3'), undefined);
  // B4 : le relais touche les deux cases à port et l'apparition aussi (losange), il n'est donc jamais une impasse
  const b4 = modele('B4'), liens = b4.chemins.filter((ch) => ch.b['case'] !== undefined);
  const degre = (id) => liens.filter((ch) => ch.a['case'] === id || ch.b['case'] === id).length;
  assert.deepStrictEqual(b4.cases.map((c) => degre(c.id)), [2, 2, 2, 2]);
});

test('catalogue : aucune poche (case en impasse sans raccord ni port) dans aucun modèle, par la règle et par un calcul indépendant', () => {
  for (const m of CAT.modeles) {
    assert.ok(!M.validerModele(m, '4x4').alertes.some((a) => a.code === 'poche'), m.id);
    // calcul indépendant : toute case hors apparition touchée par un seul chemin porte un raccord ou un port
    for (const c of m.cases.filter((x) => x.type !== 'apparition')) {
      const touches = m.chemins.filter((ch) => ch.a['case'] === c.id || ch.b['case'] === c.id);
      const sorties = touches.filter((ch) => ch.b['case'] === undefined || ch.a['case'] === undefined);
      assert.ok(touches.length >= 2 || sorties.length >= 1, `${m.id} : ${c.id} est une impasse`);
    }
  }
});

test('catalogue : aucune erreur ni alerte de validerModele (R1 à R4, place, apparition, réseaux)', () => {
  for (const m of CAT.modeles) {
    const v = M.validerModele(m, '4x4');
    assert.deepStrictEqual(v.erreurs, [], m.id);
    assert.deepStrictEqual(v.alertes, [], m.id);
  }
});

test('catalogue : noms courts et distincts, ids de cases et de chemins en chaînes', () => {
  for (const m of CAT.modeles) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 20, m.id);
    for (const el of m.cases.concat(m.chemins)) assert.strictEqual(typeof el.id, 'string', m.id);
  }
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.nom)).size, 13);
});

test('catalogue : nombre de cases par gabarit (centrales 4 à 6, bords 3 à 4, coins 3 à 4)', () => {
  const bornes = { centrale: [4, 6], bord: [3, 4], coin: [3, 4] };
  for (const m of CAT.modeles) {
    assert.ok(m.cases.length >= bornes[m.gabarit][0] && m.cases.length <= bornes[m.gabarit][1], `${m.id} : ${m.cases.length} cases`);
  }
});

test('catalogue : au moins 2 étoiles à 5 cases (4 ports, un relais relié aux 4 cases à port), une centrale à 3 ports, une centrale à deux réseaux séparés', () => {
  const centrales = parGabarit('centrale');
  const liens = (m) => m.chemins.filter((ch) => ch.b['case'] !== undefined);
  // étoile : un relais (case sans port) relié à toutes les autres cases, qui portent chacune un port
  const etoile = (m) => {
    const hub = m.cases.find((c) => liens(m).filter((ch) => ch.a['case'] === c.id || ch.b['case'] === c.id).length === m.cases.length - 1);
    return !!hub && !porteuses(m).includes(hub.id) && porteuses(m).length === m.cases.length - 1;
  };
  const etoiles5 = centrales.filter((m) => m.cases.length === 5 && nbPorts(m) === 4 && etoile(m));
  assert.ok(etoiles5.length >= 2, 'étoiles à 5 cases et 4 ports : ' + etoiles5.map((m) => m.id));
  assert.deepStrictEqual(etoiles5.map((m) => m.id), ['C1', 'C5']);
  assert.ok(centrales.filter((m) => nbPorts(m) === 3).length >= 1, 'une centrale à 3 ports');
  assert.ok(centrales.some((m) => nbReseaux(m) === 2), 'une centrale à deux réseaux séparés');
  assert.strictEqual(centrales.filter((m) => nbReseaux(m) === 2).map((m) => m.id).join(), 'C3');
  // la seconde étoile ne diffère de la première que par son côté fermé (les raccords d'une étoile ne sont qu'au milieu)
  assert.strictEqual(M.masquesDuModele(modele('C1')).raccords, 0x492);
  assert.strictEqual(M.masquesDuModele(modele('C5')).raccords, 0x092);
});

test('catalogue : raccords au milieu pour tout côté qui regarde une centrale, raccourci E0 + O2 (bords) et E0 + S2 (coins)', () => {
  for (const m of CAT.modeles) {
    const r = M.masquesDuModele(m).raccords;
    if (m.gabarit === 'centrale') {
      // côtés d'une centrale : milieu seulement (les raccords partent du centre ; la tuile tourne librement) ;
      // seul C5 (étoile fermée) a un côté sans raccord, l'ouest
      for (let cote = 0; cote < 4; cote++) assert.strictEqual(G.triplet(r, cote), m.id === 'C5' && cote === 3 ? 0b000 : 0b010, `${m.id} côté ${cote}`);
    } else if (m.gabarit === 'bord') {
      assert.ok((r & 0x808) === 0x808, `${m.id} : raccourci du bord (0x808)`);
      assert.strictEqual(G.triplet(r, 0), 0, `${m.id} : rien sur le côté extérieur`);
      assert.ok([0b000, 0b010].includes(G.triplet(r, 2)), `${m.id} : côté intérieur vide ou milieu`);
      assert.strictEqual(r & ~0x808 & ~(0b010 << 6), 0, `${m.id} : aucun autre raccord latéral`);
    } else {
      assert.strictEqual(r, 0x108, `${m.id} : raccourci du coin (0x108) et rien d'autre`);
    }
  }
  // un seul « mur » voulu dans tout le catalogue : l'étoile fermée C5 (B2 supprimé, docs/22) ; tout autre côté a son raccord
  assert.deepStrictEqual(parGabarit('bord').filter((m) => G.triplet(M.masquesDuModele(m).raccords, 2) === 0).map((m) => m.id), []);
  assert.deepStrictEqual(parGabarit('centrale').filter((m) => M.masquesDuModele(m).raccords !== 0x492).map((m) => m.id), ['C5']);
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

/**
 * Signature d'un modèle tourné de `rot` quarts de tour : cases étiquetées par leur port et
 * leurs raccords (tournés), arêtes internes entre étiquettes. Deux modèles de même signature
 * ont le même routage.
 */
function signature(m, rot) {
  const etiquette = new Map(m.cases.map((c) => [c.id, []]));
  for (const ch of m.chemins) {
    const o = ch.b['case'] === undefined ? ch.b : null;
    if (!o) continue;
    const e = etiquette.get(ch.a['case']);
    if (o.coin !== undefined) e.push('p' + ((o.coin + rot) % 4));
    else e.push('r' + ((o.raccord.cote + rot) % 4) + o.raccord.pos);
  }
  const lab = (id) => etiquette.get(id).sort().join('') + (m.cases.find((c) => c.id === id).type === 'apparition' ? '*' : '');
  const aretes = m.chemins.filter((ch) => ch.b['case'] !== undefined).map((ch) => [lab(ch.a['case']), lab(ch.b['case'])].sort().join('-')).sort();
  return m.cases.map((c) => lab(c.id)).sort().join(',') + '|' + aretes.join(',');
}

test('variété : aucune centrale n\'est la copie tournée d\'une autre, aucun doublon par gabarit', () => {
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
});

test('tracés : pas de chemin sur une case, dans une zone de coin, ou contre un autre chemin', () => {
  const pb = [].concat(...CAT.modeles.map((m) => problemesTrace(m, '4x4')));
  assert.deepStrictEqual(pb, []);
});

test('tracés : le contrôle détecte un chemin qui traverse une case (témoin)', () => {
  const m = JSON.parse(JSON.stringify(modele('C1')));
  m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c3' } }); // diagonale NO-SE : passe par le centre c0
  m.chemins.push({ id: 'y', a: { 'case': 'c2' }, b: { 'case': 'c4' } }); // diagonale NE-SO : croise x
  assert.ok(problemesTrace(m).some((t) => t.includes('x et y se touchent')));
  assert.ok(problemesTrace(m).some((t) => t.includes('de c0')));
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
  // [coin, bord voisin sur le même côté, bord voisin sur l'autre côté] pour les 4 coins du plateau
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
  assert.strictEqual(essais, 2 * 5 * 8);
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
  // T2 de docs/20 : bord 0x808 tourné de 2 quarts de tour = 0x220, compatible avec lui-même (un seul raccord relié)
  assert.strictEqual(G.tournerRaccords(0x808, 2), 0x220);
  assert.strictEqual(G.apparier(0x220, 1, 0x220).connectes, 4);
  // T1 de docs/20
  assert.strictEqual(G.apparier(0x108, 1, 0x808).connectes, 1);
  assert.strictEqual(G.tournerRaccords(0x808, 1), 0x044);
  assert.strictEqual(G.tournerRaccords(0x108, 2), 0x204);
  assert.strictEqual(G.apparier(0x044, 2, 0x204).connectes, 1);
});

/* ====================================================================== */
/* Plateaux tirés au hasard                                                */
/* ====================================================================== */

test('plateaux : tirage reproductible, 16 tuiles, aucune erreur, seules alertes possibles : raccords morts et (rarement) jonction à un seul port', () => {
  const codes = {};
  for (const doc of PLATEAUX) {
    assert.strictEqual(doc.plateau.tuiles.length, 16);
    const v = M.validerPlateau(doc);
    assert.deepStrictEqual(v.erreurs, []);
    v.alertes.forEach((a) => { codes[a.code] = (codes[a.code] || 0) + 1; });
  }
  // mesuré sur 1000 plateaux (docs/21) : 0,60 raccord mort par plateau ; une jonction à un seul port sur 4 plateaux (trois centrales
  // à 3 ports autour de la jonction centrale : C4 et C6 répétés, ce que le tirage avec remise permet)
  assert.deepStrictEqual(Object.keys(codes).sort(), ['jonction_ports', 'raccord_mort']);
  assert.ok(codes.jonction_ports <= NB_PLATEAUX * 0.02, 'jonctions mal reliées : ' + codes.jonction_ports);
  assert.deepStrictEqual(MS.tirerPlateaux(3, GRAINE).map((x) => JSON.stringify(x.doc.plateau)), PLATEAUX.slice(0, 3).map((d) => JSON.stringify(d.plateau)));
});

test('simulation : graphe connexe (9 jonctions-cases comprises), 9 nœuds de jonction', () => {
  for (const doc of PLATEAUX) {
    const g = GR.construire(doc, { jetons: [] });
    assert.strictEqual(g.jonctions.length, 9);
    assert.ok(GR.connexe(g));
  }
});

test('simulation : les raccords seuls (sans passer par les jonctions) relient presque toujours toutes les cases du plateau', () => {
  // mesuré : 1000 plateaux sur 1000 depuis la suppression de B2 (996 avant, docs/21) ; en cas d'exception, un des deux réseaux de C3 (« Deux ponts ») dont les deux raccords
  // font face à un mur (C5) n'est plus relié que par ses ports ; c'est la liberté voulue, pas un défaut
  let connexes = 0;
  for (const doc of PLATEAUX) {
    const g = GR.construire(doc, { jetons: [] });
    const ids = [...g.cases.keys()], vus = new Set([ids[0]]), file = [ids[0]];
    for (let q = 0; q < file.length; q++) g.voisins.get(file[q]).forEach((y) => { if (g.cases.has(y) && !vus.has(y)) { vus.add(y); file.push(y); } });
    if (vus.size === ids.length) connexes++;
    else assert.ok(doc.plateau.tuiles.some((t) => t.modeleId === 'C3'), 'cases isolées sans « Deux ponts »');
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

test('garantie de l\'écart : au moins 4 pas (3 cases) entre deux jonctions, donc entre deux villes quelles que soient les 7 villes', () => {
  // toutes les jonctions sont des cases : le plus petit écart entre deux jonctions minore celui de deux villes choisies parmi elles
  for (const doc of PLATEAUX) assert.ok(ecartMinJonctions(doc) >= 4);
  // mesuré : exactement 4 sur 1000 plateaux, sans exception (docs/21)
  assert.strictEqual(Math.min(...PLATEAUX.map(ecartMinJonctions)), 4);
});

test('garantie de l\'écart, preuve locale lue dans le graphe : une jonction ne touche que des cases à port, une case à port touche une seule jonction et aucune autre case à port', () => {
  for (const doc of PLATEAUX) {
    const g = GR.construire(doc, { jetons: [] });
    const jonction = (id) => !g.cases.has(id);
    for (const jn of g.jonctions) {
      for (const c of g.voisins.get(jn.id)) assert.ok(g.cases.has(c));       // une jonction ne touche que des cases
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

test('simulation : nombre de cases par plateau, mesuré à 63,1 (cible ≈ 60 non tenue avec le tirage avec répétition, voir docs/21)', () => {
  const nb = PLATEAUX.map((doc) => GR.construire(doc, { jetons: [] }).cases.size + 2);
  // mesuré sur 1000 plateaux : moyenne 63,1 ; minimum 57 ; maximum 69 (docs/21). Le tirage avec remise qui favorise la variété
  // sort plus souvent les modèles à 4 ou 6 cases que l'ancien tirage sans remise (60,5) : écart à la cible ≈ 60 signalé dans docs/21.
  assert.ok(Math.abs(moy(nb) - 63.1) < 0.6, 'moyenne ' + moy(nb));
  assert.ok(Math.min(...nb) >= 55 && Math.max(...nb) <= 70, `de ${Math.min(...nb)} à ${Math.max(...nb)}`);
  // cases d'un plateau = cases des 16 tuiles + 2 jonctions-cases, sans compter plus que ce que les modèles contiennent
  for (const doc of PLATEAUX.slice(0, 20)) {
    const somme = doc.plateau.tuiles.reduce((s, t) => s + modele(t.modeleId).cases.length, 0);
    assert.strictEqual(GR.construire(doc, { jetons: [] }).cases.size, somme);
  }
});

test('simulation : jonctions bien reliées (au moins 2 ports, sauf cas rare) et chaque apparition a au moins 3 sorties', () => {
  let nbJ = 0, une = 0, deux = 0, mini = 9, sortiesMin = 99, plateauxMal = 0;
  for (const doc of PLATEAUX) {
    const g = GR.construire(doc, { jetons: [] });
    for (const jn of g.jonctions) { nbJ++; mini = Math.min(mini, jn.ports); if (jn.ports === 1) une++; if (jn.ports === 2) deux++; }
    for (const p of [1, 2]) for (const id of g.apparitions[p]) sortiesMin = Math.min(sortiesMin, g.voisins.get(id).size);
    if (M.jonctionsMalReliees(doc).length) plateauxMal++;
  }
  // mesuré sur 1000 plateaux : 4 plateaux (0,4 %) ont une jonction centrale à un seul port (C4 ou C6 répétés), sorties d'une apparition : minimum 3
  assert.ok(mini >= 1);
  assert.ok(plateauxMal / PLATEAUX.length < 0.02, 'plateaux avec une jonction mal reliée : ' + plateauxMal);
  assert.ok(une / nbJ < 0.003 && deux / nbJ < 0.03, `jonctions à 1 port : ${une}, à 2 ports : ${deux} sur ${nbJ}`);
  assert.ok(sortiesMin >= 3, 'sorties minimales d\'une apparition : ' + sortiesMin);
});

test('simulation : peu de raccords morts (moyenne <= 0,8), seulement chez le « mur » C5 (au plus un par exemplaire de C5 posé)', () => {
  const morts = (doc) => M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;
  const nb = PLATEAUX.map(morts);
  // mesuré sur 1000 plateaux (docs/21) : moyenne ≈ 0,60 ; maximum 3 (C5 peut être posé plusieurs fois) ; le côté fermé de C5 crée au plus un raccord mort
  assert.ok(moy(nb) <= 0.8, 'moyenne ' + moy(nb));
  assert.ok(Math.max(...nb) <= 3, 'maximum ' + Math.max(...nb));
  for (const doc of PLATEAUX) {
    const murs = doc.plateau.tuiles.filter((t) => t.modeleId === 'C5').length;
    assert.ok(morts(doc) <= murs, `${morts(doc)} raccords morts pour ${murs} mur(s)`);
  }
  assert.ok(PLATEAUX.some((doc) => !doc.plateau.tuiles.some((t) => t.modeleId === 'C5')), 'au moins un plateau sans mur dans l\'échantillon');
});

test('simulation : distance de chaque case d\'apparition à sa jonction, par modèle (2 ou 3 pas)', () => {
  const pas = (m) => {
    const adj = new Map(m.cases.map((c) => [c.id, []]));
    m.chemins.filter((ch) => ch.b['case'] !== undefined).forEach((ch) => { adj.get(ch.a['case']).push(ch.b['case']); adj.get(ch.b['case']).push(ch.a['case']); });
    const dep = m.cases.find((c) => c.type === 'apparition').id, d = new Map([[dep, 0]]), file = [dep];
    for (let q = 0; q < file.length; q++) adj.get(file[q]).forEach((y) => { if (!d.has(y)) { d.set(y, d.get(file[q]) + 1); file.push(y); } });
    return porteuses(m).map((p) => d.get(p) + 1).sort();
  };
  // mesuré (docs/21) : la 1re valeur est la jonction la plus proche
  const attendu = { B1: [2, 2], B3: [3, 3], B4: [2, 2], B5: [2, 3], B6: [2, 3], K2: [3], K4: [3] };
  for (const id of Object.keys(attendu)) assert.deepStrictEqual(pas(modele(id)), attendu[id], id);
});

/* ====================================================================== */
/* Équilibre (critère de docs/archives/16 et docs/19)                     */
/* ====================================================================== */

const STATS = MS.mesurer(MS.tirerPlateaux(NB_PLATEAUX, GRAINE), { paires: 'toutes' });
const A = STATS.acc;
const part = (h, seuil) => Object.keys(h).filter((k) => k !== 'n/a' && Number(k) >= seuil).reduce((s, k) => s + h[k], 0) / A.n;

test('équilibre : 36 combinaisons de jonctions-cases par plateau, 7 villes, aucune ville inaccessible ni apparition lointaine', () => {
  assert.strictEqual(A.n, NB_PLATEAUX * 36);
  assert.strictEqual(A.inaccessible, 0);
  assert.strictEqual(A.lointaine, 0);
  assert.strictEqual(A.partiel, 0);
  // plus petit écart entre deux villes (villes non traversables) : 4 pas dans toutes les configurations
  assert.deepStrictEqual(Object.keys(A.ecartVilles), ['4']);
});

test('équilibre : la première ville est à 2 pas des deux joueurs, à égalité (sauf 0,2 % des tirages avec répétition)', () => {
  // mesuré sur 1000 plateaux (36000 configurations, docs/21) : 2 pas dans 99,98 % (vert) et 99,8 % (rouge), égalité dans 99,8 % ;
  // le tirage sans remise de la version précédente donnait 100 % ; le générateur écarte les cas inégaux (cause « première ville »)
  assert.ok(Object.keys(A.ecartPremiere).every((k) => ['0', '1'].includes(k)));
  assert.ok((A.ecartPremiere['0'] || 0) / A.n > 0.99, 'égalité sur la première ville : ' + (A.ecartPremiere['0'] || 0) / A.n);
  for (const p of [1, 2]) {
    assert.ok(Object.keys(A.ville1[p]).every((k) => ['2', '3'].includes(k)));
    assert.ok((A.ville1[p]['2'] || 0) / A.n > 0.995);
  }
  assert.ok(A.premiereInegale / A.n < 0.006, 'première ville inégale : ' + A.premiereInegale / A.n);
});

test('équilibre : écart par rang et S mesurés (seuils = mesure + marge)', () => {
  // mesuré sur 1000 plateaux (36000 configurations, docs/21) : écart max >= 2 : 5,1 % ; >= 3 : 0,02 % (7 configurations) ; jamais >= 4
  assert.ok(part(A.ecartMax, 2) < 0.08, 'écart max >= 2 : ' + part(A.ecartMax, 2));
  assert.ok(part(A.ecartMax, 3) < 0.002, 'écart max >= 3 : ' + part(A.ecartMax, 3));
  assert.strictEqual(part(A.ecartMax, 4), 0);
  // mesuré : S moyen 2,19 ; S >= 4 : 14,8 % ; S >= 5 : 4,3 % ; S >= 7 : 0,1 % ; S maximum 8
  const sMoy = Object.keys(A.S).reduce((s, k) => s + Number(k) * A.S[k], 0) / A.n;
  assert.ok(sMoy > 1.8 && sMoy < 2.7, 'S moyen ' + sMoy);
  assert.ok(part(A.S, 4) < 0.2, 'S >= 4 : ' + part(A.S, 4));
  assert.ok(part(A.S, 5) < 0.07, 'S >= 5 : ' + part(A.S, 5));
  assert.ok(part(A.S, 9) === 0, 'S >= 9 : ' + part(A.S, 9));
  // aux rangs 1 et 2 l'écart est nul ou presque (mesuré : 99,8 % et 97,0 % à 0)
  assert.ok((A.rang[0]['0'] || 0) / A.n > 0.99, 'rang 1');
  assert.ok((A.rang[1]['0'] || 0) / A.n > 0.95, 'rang 2');
});

test('équilibre : « 5 contre 2 » rare et dépendant surtout du choix des jonctions-cases', () => {
  // mesuré (tirage avec répétition) : 4,1 % des configurations ; 0 % pour (1,2)+(2,2), (1,2)+(3,2), (2,2)+(3,2) ; 12,9 % au plus pour deux jonctions-cases d'une même rangée extérieure
  assert.ok(A.cinqDeux / A.n < 0.06, '5 contre 2 : ' + A.cinqDeux / A.n);
  const sans = MS.PAIRES.filter((p) => STATS.parPaire[p.cle].cinqDeux === 0).map((p) => p.cle);
  assert.deepStrictEqual(sans, ['(1,2)+(2,2)', '(1,2)+(3,2)', '(2,2)+(3,2)']);
  // chaque plateau a au moins une combinaison sans blocage (mesuré : 1000 plateaux sur 1000)
  assert.ok(STATS.plateaux.every((p) => p.nbBloquees < p.n));
  // « 4 contre 3 » est fréquent et sans conséquence (mesuré : 33 %) : le partage 7 = 4 + 3 est le cas normal
  assert.ok(A.quatreTrois / A.n > 0.22 && A.quatreTrois / A.n < 0.38);
});

test('équilibre : tempo, villes atteignables en au plus 3, 4 et 5 pas', () => {
  // mesuré : 5,67 / 6,83 / 7,00 villes sur 7 (vert) et 5,65 / 6,80 / 7,00 (rouge) : le tempo est très rapide (docs/21 § 7)
  for (const p of [1, 2]) {
    assert.ok(moy(A.tempo[p][3]) > 5.3 && moy(A.tempo[p][3]) < 6.2, 'tempo 3 pas joueur ' + p);
    assert.ok(moy(A.tempo[p][4]) > 6.4 && moy(A.tempo[p][4]) < 7.0, 'tempo 4 pas joueur ' + p);
    assert.ok(moy(A.tempo[p][5]) > 6.98, 'tempo 5 pas joueur ' + p);   // mesuré : 7,00 sur 1000 plateaux
  }
  assert.ok(Math.abs(moy(A.tempo[1][3]) - moy(A.tempo[2][3])) < 0.15, 'équité entre les camps');
});

test('autoroute du pourtour (constat, voir docs/21 § 8) : les apparitions de deux camps sont voisines, le pourtour est plus court que le centre', () => {
  // mesuré : une apparition verte et une rouge sont toujours à 1 pas (raccourci entre (0,1) et (0,2) et entre (3,1) et (3,2)) ;
  // jusqu'à la rangée de jonctions adverse : 3,0 pas par le pourtour (minimum 3, maximum 4) contre 4,8 à 5,0 par les colonnes 1 et 2 (4 à 10)
  assert.deepStrictEqual(Object.keys(STATS.ecartApparitions), ['1']);
  for (const p of [1, 2]) {
    const m = (h) => Object.keys(h).reduce((s, k) => s + Number(k) * h[k], 0) / NB_PLATEAUX;
    assert.ok(m(STATS.pourtourAdverse[p]) > 2.9 && m(STATS.pourtourAdverse[p]) < 3.2, 'pourtour ' + m(STATS.pourtourAdverse[p]));
    assert.ok(m(STATS.centreAdverse[p]) > 4.6 && m(STATS.centreAdverse[p]) < 5.5, 'centre ' + m(STATS.centreAdverse[p]));
    assert.ok(Math.min(...Object.keys(STATS.pourtourAdverse[p]).map(Number)) === 3);
  }
  // mesuré (PM.graphe.flancs) : le pourtour est plus court que le centre dans 98,0 % des mesures, 1,8 pas de moins en moyenne
  const f = STATS.flancs.N;
  assert.ok(f.plusCourt / f.n > 0.95, 'part ' + f.plusCourt / f.n);
  const finis = f.diff.filter(Number.isFinite);
  assert.ok(moy(finis) < -1.5 && moy(finis) > -2.4, 'différence moyenne ' + moy(finis));
});

test('équilibre : aucune tuile du catalogue ne fait basculer l\'équilibre à elle seule (S moyen avec / sans, écart < 0,55)', () => {
  // mesuré sur 1000 plateaux : plus grand écart de S moyen avec / sans un modèle : 0,34 (B3, bord en Y : 2,28 contre 1,94)
  for (const m of CAT.modeles) {
    const avec = STATS.plateaux.filter((p) => p.modeles.has(m.id)), sans = STATS.plateaux.filter((p) => !p.modeles.has(m.id));
    if (!sans.length || !avec.length) continue;
    const d = Math.abs(moy(avec.map((p) => p.sommeS / p.n)) - moy(sans.map((p) => p.sommeS / p.n)));
    assert.ok(d < 0.55, `${m.id} : écart de S moyen ${d.toFixed(2)}`);   // marge : 300 plateaux seulement
  }
});

/* ====================================================================== */
/* Document                                                                */
/* ====================================================================== */

test('nouveauDocument : document vide (version 2, grille 4×4) avec une copie modifiable des 13 modèles', () => {
  const doc = CAT.nouveauDocument();
  const vide = M.nouveauDocument();
  assert.strictEqual(doc.version, 2);
  assert.strictEqual(doc.grille, '4x4');
  assert.deepStrictEqual(doc.plateau, vide.plateau);
  assert.strictEqual(doc.version, vide.version);
  assert.deepStrictEqual(doc.modeles, JSON.parse(JSON.stringify(CAT.modeles)));
  assert.ok(Object.isFrozen(CAT.modeles) && Object.isFrozen(CAT.modeles[0].cases[0]));
  doc.modeles[0].cases[0].x = 1;
  doc.modeles.pop();
  assert.strictEqual(CAT.modeles[0].cases[0].x, 60);
  assert.strictEqual(CAT.modeles.length, 13);
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
