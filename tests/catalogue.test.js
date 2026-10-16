'use strict';
/*
 * Tests du catalogue 4×4 de la version 2 (src/catalogue.js) : contenu, validité (aucune erreur ni alerte),
 * tracés, raccourci de coin, garantie de l'écart de 3 cases entre villes, cases d'apparition, nombre de cases,
 * équilibre et « autoroute » du pourtour mesurés sur des plateaux tirés au hasard.
 *
 * Les plateaux sont tirés par outils/mesures-equilibre.js (mêmes tirages que le rapport docs/21-mesures-catalogue-v2.md,
 * graine 20261015). Les seuils des tests de simulation sont les valeurs MESURÉES sur 1000 plateaux (écrites à côté de
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

/* ====================================================================== */
/* Outils de géométrie des tracés (segments droits)                        */
/* ====================================================================== */

function distPointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function distSegments(a, b, c, d) {
  if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return 0;
  return Math.min(distPointSegment(a, c, d), distPointSegment(b, c, d), distPointSegment(c, a, b), distPointSegment(d, a, b));
}
function distPolylignes(P, Q) {
  let m = Infinity;
  for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Q.length; j++) m = Math.min(m, distSegments(P[i], P[i + 1], Q[j], Q[j + 1]));
  return m;
}
function distPointPolyligne(p, P) {
  let m = Infinity;
  for (let i = 0; i + 1 < P.length; i++) m = Math.min(m, distPointSegment(p, P[i], P[i + 1]));
  return m;
}

/**
 * Tracé de chaque chemin : convention commune à l'écran et à l'export, définie dans src/rendu.js
 * (lien = segment ; raccord = amorce perpendiculaire de 10 mm puis segment ; port = amorce de 28 mm
 * sur la bissectrice puis segment).
 */
function traces(m) { return R.tracesModele(m); }

/** Retire d'un tracé la partie couverte par ses cases d'extrémité (rayon + 4 mm pour la case commune). */
function rogner(t, commun) {
  const coupe = (c, vers) => {
    const r = c.diametre / 2 + (c === commun ? 4 : 0), d = Math.hypot(vers.x - c.x, vers.y - c.y), k = Math.min(1, r / d);
    return { x: c.x + (vers.x - c.x) * k, y: c.y + (vers.y - c.y) * k };
  };
  const pts = t.pts.map((p) => ({ x: p.x, y: p.y }));
  if (t.type === 'lien') return [coupe(t.cases[0], t.pts[1]), coupe(t.cases[1], t.pts[0])];
  pts[pts.length - 1] = coupe(t.cases[0], t.pts[t.pts.length - 2]);
  return pts;
}

/**
 * Contrôles de tracé anticipant la règle « chevauchement chemin / case » :
 *  - un chemin reste à r + 4 mm au moins des cases qui ne sont pas ses extrémités ;
 *  - un chemin (hors son propre port) reste à 24 mm au moins de chaque coin (zone du jeton + 4 mm) ;
 *  - deux chemins ne se touchent pas (axes à 8 mm au moins), hors des disques de leurs cases
 *    (la case commune à deux chemins est élargie de 4 mm : les chemins peuvent s'y rejoindre).
 */
function problemesTrace(m) {
  const pb = [], ts = traces(m);
  for (const t of ts) {
    for (const c of m.cases) {
      if (t.cases.includes(c)) continue;
      const d = distPointPolyligne(c, t.pts);
      if (d < c.diametre / 2 + 4 - 1e-9) pb.push(`${m.id} ${t.id} passe à ${d.toFixed(1)} mm de ${c.id}`);
    }
    for (let k = 0; k < 4; k++) {
      if (t.type === 'port' && t.coin === k) continue;
      const d = distPointPolyligne(G.pointCoin(k), t.pts);
      if (d < G.RAYON_ZONE_COIN + 4 - 1e-9) pb.push(`${m.id} ${t.id} entre dans la zone du coin ${k} (${d.toFixed(1)} mm)`);
    }
  }
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const commun = ts[i].cases.find((c) => ts[j].cases.includes(c));
      const d = distPolylignes(rogner(ts[i], commun), rogner(ts[j], commun));
      if (d < G.LARGEUR_CHEMIN - 1e-9) pb.push(`${m.id} ${ts[i].id} et ${ts[j].id} se touchent (${d.toFixed(1)} mm)`);
    }
  }
  return pb;
}

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
  bord: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'],
  coin: ['K1', 'K2', 'K3']
};

test('catalogue : version 2, 15 modèles, ids attendus et uniques, gabarit et grille 4×4', () => {
  assert.strictEqual(CAT.version, 2);
  assert.strictEqual(CAT.modeles.length, 15);
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.id)).size, 15);
  for (const g of Object.keys(IDS_ATTENDUS)) {
    assert.deepStrictEqual(parGabarit(g).map((m) => m.id), IDS_ATTENDUS[g], g);
  }
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4' && !('role' in m)));
});

test('catalogue : 22 tuiles physiques (6 centrales, 10 bords, 6 coins)', () => {
  const total = (g) => parGabarit(g).reduce((s, m) => s + m.exemplaires, 0);
  assert.deepStrictEqual([total('centrale'), total('bord'), total('coin')], [6, 10, 6]);
  assert.ok(parGabarit('centrale').every((m) => m.exemplaires === 1));
  assert.ok(parGabarit('coin').every((m) => m.exemplaires === 2));
  assert.strictEqual(CAT.modeles.reduce((s, m) => s + m.exemplaires, 0), 22);
  // de quoi remplir une grille 4×4 : 4 centrales, 8 bords, 4 coins
  assert.ok(total('centrale') >= 4 && total('bord') >= 8 && total('coin') >= 4);
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
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.nom)).size, 15);
});

test('catalogue : nombre de cases par gabarit (centrales 4 à 6, bords 3 à 4, coins 2 à 3)', () => {
  const bornes = { centrale: [4, 6], bord: [3, 4], coin: [2, 3] };
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
  // deux « murs » voulus dans tout le catalogue : le bord fermé B2 et l'étoile fermée C5 ; tout autre côté a son raccord
  assert.deepStrictEqual(parGabarit('bord').filter((m) => G.triplet(M.masquesDuModele(m).raccords, 2) === 0).map((m) => m.id), ['B2']);
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
  const pb = [].concat(...CAT.modeles.map(problemesTrace));
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
  assert.strictEqual(essais, 3 * 6 * 8);
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

test('plateaux : tirage reproductible, 16 tuiles, aucune erreur, seules alertes possibles : raccords morts', () => {
  const codes = {};
  for (const doc of PLATEAUX) {
    assert.strictEqual(doc.plateau.tuiles.length, 16);
    const v = M.validerPlateau(doc);
    assert.deepStrictEqual(v.erreurs, []);
    v.alertes.forEach((a) => { codes[a.code] = (codes[a.code] || 0) + 1; });
  }
  assert.deepStrictEqual(Object.keys(codes), ['raccord_mort']);   // mesuré : 0,79 par plateau (docs/21)
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
  // mesuré : 996 plateaux sur 1000 (4 exceptions, docs/21) : un des deux réseaux de C3 (« Deux ponts ») dont les deux raccords
  // font face à un mur (B2 ou C5) n'est plus relié que par ses ports ; c'est la liberté voulue, pas un défaut
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

test('simulation : nombre de cases par plateau voisin de 60 (cases des tuiles + 2 jonctions-cases)', () => {
  const nb = PLATEAUX.map((doc) => GR.construire(doc, { jetons: [] }).cases.size + 2);
  // mesuré sur 1000 plateaux : moyenne 60,5 ; minimum 57 ; maximum 64 (docs/21)
  assert.ok(Math.abs(moy(nb) - 60.5) < 0.5, 'moyenne ' + moy(nb));
  assert.ok(Math.min(...nb) >= 56 && Math.max(...nb) <= 65, `de ${Math.min(...nb)} à ${Math.max(...nb)}`);
  // espérance exacte du tirage sans remise (4 centrales sur 6, 8 bords sur 10, 4 coins sur 6, 2 jonctions-cases)
  const esp = (g, n) => n * moy([].concat(...parGabarit(g).map((m) => Array(m.exemplaires).fill(m.cases.length))));
  const attendu = esp('centrale', 4) + esp('bord', 8) + esp('coin', 4) + 2;
  assert.ok(Math.abs(attendu - 60.53) < 0.01, 'espérance ' + attendu);
  assert.ok(attendu >= 59 && attendu <= 61.5, 'cible ≈ 60 : ' + attendu);
});

test('simulation : jonctions bien reliées (au moins 2 ports, au moins 3 le plus souvent) et chaque apparition a au moins 3 sorties', () => {
  let nbJ = 0, deux = 0, mini = 9, sortiesMin = 99;
  for (const doc of PLATEAUX) {
    const g = GR.construire(doc, { jetons: [] });
    for (const jn of g.jonctions) { nbJ++; mini = Math.min(mini, jn.ports); if (jn.ports === 2) deux++; }
    for (const p of [1, 2]) for (const id of g.apparitions[p]) sortiesMin = Math.min(sortiesMin, g.voisins.get(id).size);
    assert.deepStrictEqual(M.jonctionsMalReliees(doc), []);
  }
  // mesuré sur 1000 plateaux : minimum 2 ports (33 jonctions sur 9000 n'en ont que 2, soit 0,4 %) ; sorties d'une apparition : minimum 3
  assert.ok(mini >= 2);
  assert.ok(deux / nbJ < 0.01, 'jonctions à 2 ports : ' + (100 * deux / nbJ).toFixed(2) + ' %');
  assert.ok(sortiesMin >= 3, 'sorties minimales d\'une apparition : ' + sortiesMin);
});

test('simulation : peu de raccords morts (moyenne <= 1,6, au plus 2 par plateau), seulement chez les deux « murs » B2 et C5', () => {
  const morts = (doc) => M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;
  const nb = PLATEAUX.map(morts);
  // mesuré sur 1000 plateaux : moyenne 1,41, maximum 2 (8,8 % des plateaux n'en ont aucun) ; chaque mur (côté fermé de B2 ou de C5) en crée au plus un
  assert.ok(moy(nb) <= 1.6, 'moyenne ' + moy(nb));
  assert.ok(Math.max(...nb) <= 2, 'maximum ' + Math.max(...nb));
  for (const doc of PLATEAUX) {
    const murs = doc.plateau.tuiles.filter((t) => t.modeleId === 'B2' || t.modeleId === 'C5').length;
    assert.ok(morts(doc) <= murs, `${morts(doc)} raccords morts pour ${murs} mur(s)`);
  }
  assert.ok(PLATEAUX.some((doc) => !doc.plateau.tuiles.some((t) => t.modeleId === 'B2' || t.modeleId === 'C5')), 'au moins un plateau sans mur dans l\'échantillon');
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
  const attendu = { B1: [2, 2], B2: [2, 2], B3: [3, 3], B4: [2, 2], B5: [2, 3], B6: [2, 3], K1: [2], K2: [3], K3: [2] };
  for (const id of Object.keys(attendu)) assert.deepStrictEqual(pas(modele(id)), attendu[id], id);
});

/* ====================================================================== */
/* Équilibre (critère de docs/16 et docs/19)                               */
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

test('équilibre : la première ville est à 2 pas des deux joueurs, toujours à égalité', () => {
  // mesuré : 36000 configurations sur 36000 (docs/21). Constat de conception : tempo très rapide, voir docs/21 § 7.
  assert.deepStrictEqual(Object.keys(A.ecartPremiere), ['0']);
  assert.deepStrictEqual(Object.keys(A.ville1[1]), ['2']);
  assert.deepStrictEqual(Object.keys(A.ville1[2]), ['2']);
  assert.strictEqual(A.premiereInegale, 0);
});

test('équilibre : écart par rang et S mesurés (seuils = mesure + marge)', () => {
  // mesuré sur 1000 plateaux (36000 configurations) : écart max >= 2 : 5,7 % ; >= 3 : 0,003 % (1 cas) ; jamais >= 4
  assert.ok(part(A.ecartMax, 2) < 0.08, 'écart max >= 2 : ' + part(A.ecartMax, 2));
  assert.ok(part(A.ecartMax, 3) < 0.002, 'écart max >= 3 : ' + part(A.ecartMax, 3));
  assert.strictEqual(part(A.ecartMax, 4), 0);
  // mesuré : S moyen 2,16 ; S >= 4 : 12,9 % ; S >= 5 : 3,2 % ; S >= 7 : 0,03 % ; S maximum 8 (1 cas)
  const sMoy = Object.keys(A.S).reduce((s, k) => s + Number(k) * A.S[k], 0) / A.n;
  assert.ok(sMoy > 1.8 && sMoy < 2.6, 'S moyen ' + sMoy);
  assert.ok(part(A.S, 4) < 0.18, 'S >= 4 : ' + part(A.S, 4));
  assert.ok(part(A.S, 5) < 0.06, 'S >= 5 : ' + part(A.S, 5));
  assert.ok(part(A.S, 8) < 0.002, 'S >= 8 : ' + part(A.S, 8));
  // aux rangs 1 et 2 l'écart est nul ou presque (mesuré : 100 % et 99,5 % à 0)
  for (const k of [0, 1]) assert.ok((A.rang[k]['0'] || 0) / A.n > 0.98, 'rang ' + (k + 1));
});

test('équilibre : « 5 contre 2 » rare et dépendant surtout du choix des jonctions-cases', () => {
  // mesuré : 3,5 % des configurations ; 0 % pour (1,2)+(2,2), (1,2)+(3,2), (2,2)+(3,2) ; 9,5 % au plus pour deux jonctions-cases de la rangée nord
  assert.ok(A.cinqDeux / A.n < 0.05, '5 contre 2 : ' + A.cinqDeux / A.n);
  const sans = MS.PAIRES.filter((p) => STATS.parPaire[p.cle].cinqDeux === 0).map((p) => p.cle);
  assert.deepStrictEqual(sans, ['(1,2)+(2,2)', '(1,2)+(3,2)', '(2,2)+(3,2)']);
  // chaque plateau a au moins une combinaison sans blocage (mesuré : 1000 plateaux sur 1000)
  assert.ok(STATS.plateaux.every((p) => p.nbBloquees < p.n));
  // « 4 contre 3 » est fréquent et sans conséquence (mesuré : 30 %) : le partage 7 = 4 + 3 est le cas normal
  assert.ok(A.quatreTrois / A.n > 0.22 && A.quatreTrois / A.n < 0.38);
});

test('équilibre : tempo, villes atteignables en au plus 3, 4 et 5 pas', () => {
  // mesuré : 5,73 / 6,80 / 7,00 villes sur 7 (vert) et 5,72 / 6,80 / 7,00 (rouge) : le tempo est très rapide (docs/21 § 7)
  for (const p of [1, 2]) {
    assert.ok(moy(A.tempo[p][3]) > 5.3 && moy(A.tempo[p][3]) < 6.2, 'tempo 3 pas joueur ' + p);
    assert.ok(moy(A.tempo[p][4]) > 6.4 && moy(A.tempo[p][4]) < 7.0, 'tempo 4 pas joueur ' + p);
    assert.ok(moy(A.tempo[p][5]) > 6.98, 'tempo 5 pas joueur ' + p);   // mesuré : 7,00 sur 1000 plateaux
  }
  assert.ok(Math.abs(moy(A.tempo[1][3]) - moy(A.tempo[2][3])) < 0.15, 'équité entre les camps');
});

test('autoroute du pourtour (constat, voir docs/21 § 8) : les apparitions de deux camps sont voisines, le pourtour est plus court que le centre', () => {
  // mesuré : une apparition verte et une rouge sont toujours à 1 pas (raccourci entre (0,1) et (0,2) et entre (3,1) et (3,2)) ;
  // jusqu'à la rangée de jonctions adverse : 3,0 pas par le pourtour (minimum 3, maximum 4) contre 5,1 par les colonnes 1 et 2 (4 à 9)
  assert.deepStrictEqual(Object.keys(STATS.ecartApparitions), ['1']);
  for (const p of [1, 2]) {
    const m = (h) => Object.keys(h).reduce((s, k) => s + Number(k) * h[k], 0) / NB_PLATEAUX;
    assert.ok(m(STATS.pourtourAdverse[p]) > 2.9 && m(STATS.pourtourAdverse[p]) < 3.2, 'pourtour ' + m(STATS.pourtourAdverse[p]));
    assert.ok(m(STATS.centreAdverse[p]) > 4.6 && m(STATS.centreAdverse[p]) < 5.5, 'centre ' + m(STATS.centreAdverse[p]));
    assert.ok(Math.min(...Object.keys(STATS.pourtourAdverse[p]).map(Number)) === 3);
  }
  // mesuré (PM.graphe.flancs) : le pourtour est plus court que le centre dans 99,1 % des mesures, 1,9 pas de moins en moyenne
  const f = STATS.flancs.N;
  assert.ok(f.plusCourt / f.n > 0.95, 'part ' + f.plusCourt / f.n);
  const finis = f.diff.filter(Number.isFinite);
  assert.ok(moy(finis) < -1.5 && moy(finis) > -2.4, 'différence moyenne ' + moy(finis));
});

test('équilibre : aucune tuile du catalogue ne fait basculer l\'équilibre à elle seule (S moyen avec / sans, écart < 0,45)', () => {
  // mesuré sur 1000 plateaux : plus grand écart de S moyen avec / sans un modèle : 0,26 (B3, bord en Y : 2,21 contre 1,95)
  for (const m of CAT.modeles) {
    const avec = STATS.plateaux.filter((p) => p.modeles.has(m.id)), sans = STATS.plateaux.filter((p) => !p.modeles.has(m.id));
    if (!sans.length || !avec.length) continue;
    const d = Math.abs(moy(avec.map((p) => p.sommeS / p.n)) - moy(sans.map((p) => p.sommeS / p.n)));
    assert.ok(d < 0.45, `${m.id} : écart de S moyen ${d.toFixed(2)}`);   // marge : 300 plateaux seulement
  }
});

/* ====================================================================== */
/* Document                                                                */
/* ====================================================================== */

test('nouveauDocument : document vide (version 2, grille 4×4) avec une copie modifiable des 15 modèles', () => {
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
  assert.strictEqual(CAT.modeles.length, 15);
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
