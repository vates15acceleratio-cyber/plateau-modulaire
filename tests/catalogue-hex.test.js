'use strict';
/*
 * Tests du catalogue hexagonal 'hex19' livré (src/catalogue.js, PM.catalogue.modelesParGrille['hex19']) : HC2 « Deux ponts et traverse »
 * et HC3 « Carrefour » (intérieures, sans HC1), HB1 « Bord », HK1 « Coin » (docs/72, docs/75). Contenu, validité (0 erreur, 0 alerte),
 * tracé adapté à l'hexagonal (8 mm entre chemins, rayon + 4 mm, zones de coin), aucun mur ni miroir, stock imprimé (30 pièces),
 * nouveauDocument('hex19'), plateau complet avec le trèfle (rotations cherchées), non-régression des catalogues 4×4 et 5×5.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
require('../src/catalogue.js');
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, GR = PM.graphe, CAT = PM.catalogue;
const F = G.format('hex19');

const CH = CAT.modelesParGrille['hex19'];
const modele = (id) => CH.find((m) => m.id === id);
const copie = (o) => JSON.parse(JSON.stringify(o));
const IDS = ['HC2', 'HC3', 'HB1', 'HK1'];

/* ================================ contenu ================================ */

test('catalogue hex19 : 4 modèles HC2, HC3, HB1, HK1 (sans HC1), grille hex19, cases Ø 20, noms distincts, gelé', () => {
  assert.deepEqual(CH.map((m) => m.id), IDS);
  assert.deepEqual(CH.map((m) => m.gabarit), ['centrale', 'centrale', 'bord', 'coin']);
  assert.deepEqual(CH.map((m) => m.nom), ['Deux ponts et traverse', 'Carrefour', 'Bord', 'Coin']);
  assert.equal(new Set(CH.map((m) => m.nom)).size, 4);
  assert.equal(modele('HC1'), undefined);
  assert.ok(CH.every((m) => m.grille === 'hex19' && !('role' in m)));
  assert.ok(CH.every((m) => m.cases.every((c) => c.diametre === 20)));
  assert.ok(Object.isFrozen(CH) && CH.every(Object.isFrozen));
  assert.deepEqual(CH.map((m) => m.cases.length), [2, 2, 2, 2]);
  assert.deepEqual(CH.map((m) => m.cases.filter((c) => c.type === 'apparition').length), [0, 0, 1, 1]);
});

test('catalogue hex19 : coordonnées et chemins du catalogue candidat (docs/75)', () => {
  const ab = [{ id: 'a', x: 0, y: -20.7 }, { id: 'b', x: 0, y: 20.7 }];
  for (const id of ['HC2', 'HC3']) {
    assert.deepEqual(modele(id).cases.map((c) => ({ id: c.id, x: c.x, y: c.y })), ab);
    const ports = modele(id).chemins.filter((c) => c.b.coin !== undefined).map((c) => c.a['case'] + c.b.coin).sort();
    assert.deepEqual(ports, ['a0', 'a1', 'a5', 'b2', 'b3', 'b4']);
    const racs = modele(id).chemins.filter((c) => c.b.raccord).map((c) => c.a['case'] + c.b.raccord.cote).sort();
    assert.deepEqual(racs, ['a0', 'a5', 'b2', 'b3']);
    assert.ok(modele(id).chemins.every((c) => c.b['case'] === undefined), 'a et b ne sont pas reliées');
  }
  assert.deepEqual(modele('HB1').cases.map((c) => [c.id, c.x, c.y, c.type]), [['a', 0, -30, 'apparition'], ['p', 0, 20.7, 'deplacement']]);
  assert.deepEqual(modele('HK1').cases.map((c) => [c.id, c.x, c.y, c.type]), [['a', 10, 0, 'apparition'], ['p', -22, 0, 'deplacement']]);
  // HC2 : un passage sans case E–O ; HC3 : un T sans case à 4 branches (E, O, a, b), points de contrôle du candidat
  assert.equal(modele('HC2').passages.length, 1);
  assert.deepEqual(modele('HC2').passages[0].courbe, { x: 0, y: 4 });
  assert.equal(modele('HC3').pivots.length, 1);
  assert.deepEqual(modele('HC3').passages.map((p) => p.courbe), [{ x: 20, y: -4 }, { x: -20, y: 4 }, { x: 3, y: -10 }, { x: -3, y: 10 }]);
  assert.equal(modele('HC3').passages.filter((p) => p.b.pivot === 'v').length, 4);
  // bord : porteuse p à 3 ports (coins 2, 3, 4), apparition a sans port reliée à p, raccords E et O sur a ; coin : porteuse à 2 ports
  const portsDe = (m, c) => m.chemins.filter((x) => x.a['case'] === c && x.b.coin !== undefined).map((x) => x.b.coin).sort();
  assert.deepEqual(portsDe(modele('HB1'), 'p'), [2, 3, 4]);
  assert.deepEqual(portsDe(modele('HK1'), 'p'), [4, 5]);
  assert.deepEqual(portsDe(modele('HB1'), 'a').concat(portsDe(modele('HK1'), 'a')), []);
});

test('catalogue hex19 : 0 erreur et 0 alerte pour chaque modèle (validerModele hex19)', () => {
  for (const m of CH) {
    const r = M.validerModele(m, 'hex19');
    assert.deepEqual([m.id, r.erreurs, r.alertes], [m.id, [], []]);
  }
});

test('catalogue hex19 : aucun mur, aucun raccord sans tracé, aucune miroir (chaque modèle sert par rotation)', () => {
  for (const m of CH) {
    assert.equal(m.murs, undefined, m.id);
    assert.equal(M.mursDuModele(m, 'hex19'), 0, m.id + ' : mursDuModele');
  }
  // intérieures : les 6 côtés ont un raccord (chemin ou passage), un raccord par côté seulement
  for (const id of ['HC2', 'HC3']) assert.equal(M.masquesDuModele(modele(id), 'hex19').raccords, 0b111111, id);
  // aucune paire miroir : miroir gauche-droite (x -> -x) : coin k -> (6 - k) % 6, côté k -> (5 - k + 6) % 6 ; un modèle miroir d'un autre
  // serait un doublon par rotation ; chaque gabarit du pourtour n'a d'ailleurs qu'un modèle
  const miroirCote = (k) => (5 - k + 6) % 6, miroirCoin = (k) => (6 - k) % 6;
  const signature = (m, rot, miroir) => {
    const co = (k) => { const c = miroir ? miroirCoin(k) : k; return (c + rot) % 6; };
    const ce = (k) => { const c = miroir ? miroirCote(k) : k; return (c + rot) % 6; };
    const cs = Object.fromEntries(m.cases.map((c) => [c.id, c.type + ':' + m.chemins.filter((x) => x.a['case'] === c.id && x.b.coin !== undefined).map((x) => co(x.b.coin)).sort().join('') + ':' +
      m.chemins.filter((x) => x.a['case'] === c.id && x.b.raccord).map((x) => ce(x.b.raccord.cote)).sort().join('')]));
    return Object.values(cs).sort().join('|') + '#' + (m.pivots || []).length + '#' + (m.passages || []).map((p) => [p.a, p.b].map((e) => e.raccord ? 'r' + ce(e.raccord.cote) : e['case'] ? cs[e['case']] : 'v').sort().join('-')).sort().join(',');
  };
  for (let i = 0; i < CH.length; i++) for (let j = 0; j < CH.length; j++) {
    if (i === j || CH[i].gabarit !== CH[j].gabarit) continue;
    for (let rot = 0; rot < 6; rot++) assert.notEqual(signature(CH[i], 0, false), signature(CH[j], rot, true), `${CH[i].id} / ${CH[j].id} miroir`);
  }
  assert.equal(CH.filter((m) => m.gabarit === 'bord').length, 1);
  assert.equal(CH.filter((m) => m.gabarit === 'coin').length, 1);
});

/* ============================ contrôle de tracé (hex) ============================ */

function dPS(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
function dSS(a, b, c, d) {
  if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return 0;
  return Math.min(dPS(a, c, d), dPS(b, c, d), dPS(c, a, b), dPS(d, a, b));
}
const dPL = (p, P) => { let m = Infinity; for (let i = 0; i + 1 < P.length; i++) m = Math.min(m, dPS(p, P[i], P[i + 1])); return m; };
const dLL = (P, Q) => { let m = Infinity; for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Q.length; j++) m = Math.min(m, dSS(P[i], P[i + 1], Q[j], Q[j + 1])); return m; };

/** Tracé d'un modèle hex : chemins (tracesModele) et passages (tracesPassages) ; un passage vers une case est rogné comme un chemin. */
function tracesHex(m) {
  const T = G.tracesModele(m, F).map((t) => ({ id: t.id, type: t.type, coin: t.coin, cases: t.cases, pts: t.pts, passage: false }));
  G.tracesPassages(m, F).forEach((t) => T.push({ id: t.id, type: 'passage', cases: t.cases, pts: t.pts, passage: true, reseau: t.pivots.length ? 'pivot' : t.id }));
  return T;
}
/** Retire la partie couverte par les cases d'extrémité (rayon, plus 4 mm pour la case commune aux deux tracés comparés). */
function rogner(t, commun) {
  const coupe = (c, vers) => { const r = c.diametre / 2 + (c === commun ? 4 : 0), d = Math.hypot(vers.x - c.x, vers.y - c.y), k = Math.min(1, r / d); return { x: c.x + (vers.x - c.x) * k, y: c.y + (vers.y - c.y) * k }; };
  let pts = t.pts.map((p) => ({ x: p.x, y: p.y }));
  if (t.type === 'lien') return [coupe(t.cases[0], t.pts[1]), coupe(t.cases[1], t.pts[0])];
  if (!t.cases.length) return pts;
  // le tracé finit sur la case (chemin) ou en part (passage depuis une case : premier point) : on retire ce qui est dans le disque
  const c = t.cases[0], r = c.diametre / 2 + (c === commun ? 4 : 0);
  const fin = Math.hypot(pts[pts.length - 1].x - c.x, pts[pts.length - 1].y - c.y) < 1e-6;
  const seq = fin ? pts : pts.slice().reverse();
  let i = seq.length - 1;
  while (i > 0 && Math.hypot(seq[i - 1].x - c.x, seq[i - 1].y - c.y) < r) i--;
  const out = seq.slice(0, i); out.push(coupe(c, seq[i - 1] || seq[0]));
  return fin ? out : out.reverse();
}
/** Manquements de tracé d'un modèle hexagonal (liste vide si tout est respecté). */
function problemesTraceHex(m) {
  const pb = [], T = tracesHex(m), zones = F.GABARITS[m.gabarit].coinsInterieurs, poly = F.forme(m.gabarit);
  const dPoly = (p) => { let mn = Infinity; for (let i = 0; i < poly.length; i++) mn = Math.min(mn, dPS(p, poly[i], poly[(i + 1) % poly.length])); return mn; };
  for (const c of m.cases) {
    const marge = dPoly(c) - (c.diametre / 2 + 4);
    if (marge < -1e-9) pb.push(`${m.id} case ${c.id} à ${dPoly(c).toFixed(1)} mm du contour`);
    for (const k of zones) {
      const p = F.pointCoin(k), d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < F.RAYON_ZONE_COIN + 10 - 1e-9 && !m.chemins.some((x) => x.a['case'] === c.id && x.b.coin === k)) pb.push(`${m.id} case ${c.id} dans la zone du coin ${k} (${d.toFixed(1)} mm)`);
    }
  }
  for (const t of T) {
    for (const c of m.cases) {
      if (t.cases.includes(c)) continue;
      const d = dLL([{ x: c.x, y: c.y }, { x: c.x, y: c.y }], t.pts);
      if (d < c.diametre / 2 + 4 - 1e-9) pb.push(`${m.id} ${t.id} passe à ${d.toFixed(1)} mm de ${c.id}`);
    }
    for (const k of zones) {
      if (t.type === 'port' && t.coin === k) continue;
      const d = dPL(F.pointCoin(k), t.pts);
      if (d < F.RAYON_ZONE_COIN + 4 - 1e-9) pb.push(`${m.id} ${t.id} entre dans la zone du coin ${k} (${d.toFixed(1)} mm)`);
    }
  }
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    if (T[i].passage && T[j].passage && T[i].reseau === T[j].reseau && T[i].reseau === 'pivot') continue; // branches d'un même T
    const commun = T[i].cases.find((c) => T[j].cases.includes(c));
    const d = dLL(rogner(T[i], commun), rogner(T[j], commun));
    if (d < F.LARGEUR_CHEMIN - 1e-9) pb.push(`${m.id} ${T[i].id} et ${T[j].id} se touchent (${d.toFixed(1)} mm)`);
  }
  return pb;
}

test('tracé hex19 : chemins à r + 4 des autres cases, 24 mm des coins-jonctions, 8 mm entre chemins, cases à r + 4 du contour', () => {
  for (const m of CH) assert.deepEqual(problemesTraceHex(m), [], m.id);
});

test('tracé hex19 : le contrôle détecte un chemin collé à une autre case et deux chemins trop proches', () => {
  const m = copie(modele('HC2'));
  m.cases[0].y = -8; // a descend sur le passage E–O
  assert.ok(problemesTraceHex(m).length > 0);
  const k = copie(modele('HB1'));
  k.cases[1].y = 0;
  assert.ok(problemesTraceHex(k).length > 0);
});

test('passages hex19 : courbes imposées, extrémités sur les raccords E et O, pivot à 4 branches, rayon de courbure raisonnable', () => {
  const t2 = G.tracesPassages(modele('HC2'), F);
  assert.equal(t2.length, 1);
  assert.equal(t2[0].parDefaut, false);
  const e = F.pointRaccord(1, 0), o = F.pointRaccord(4, 0);
  assert.ok(Math.hypot(t2[0].pts[0].x - e.x, t2[0].pts[0].y - e.y) < 1e-6);
  assert.ok(Math.hypot(t2[0].pts[t2[0].pts.length - 1].x - o.x, t2[0].pts[t2[0].pts.length - 1].y - o.y) < 1e-6);
  const t3 = G.tracesPassages(modele('HC3'), F);
  assert.equal(t3.length, 4);
  assert.ok(t3.every((t) => t.pivots[0] === 'v' && !t.parDefaut));
  assert.ok(t3.every((t) => t.rayonMin >= 6), 'rayons : ' + t3.map((t) => t.rayonMin.toFixed(1)).join(', '));
});

/* ================================ stock et poids ================================ */

test('stock hex19 : 30 pièces imprimées (19 + 11 de réserve), HC2 ×8, HC3 ×7, HB1 ×8, HK1 ×7', () => {
  assert.deepEqual(Object.fromEntries(CH.map((m) => [m.id, m.exemplaires])), { HC2: 8, HC3: 7, HB1: 8, HK1: 7 });
  const somme = (g) => CH.filter((m) => m.gabarit === g).reduce((s, m) => s + m.exemplaires, 0);
  assert.equal(somme('centrale'), 15); // 7 places + 8 de réserve
  assert.equal(somme('bord'), 8);      // 6 places + 2
  assert.equal(somme('coin'), 7);      // 6 places + 1
  assert.equal(somme('centrale') + somme('bord') + somme('coin'), 30);
  assert.equal(F.cellules.length, 19);
  assert.equal(F.cellules.filter((c) => c.gabarit === 'centrale').length, 7);
  assert.equal(F.cellules.filter((c) => c.gabarit === 'bord').length, 6);
  assert.equal(F.cellules.filter((c) => c.gabarit === 'coin').length, 6);
  // le stock ne dépasse jamais le besoin de réserve : au moins une pièce de chaque gabarit pour chaque place
  for (const m of CH) assert.ok(M.exemplairesValides(m) >= 1, m.id);
});

test('poids de tirage hex19 : distincts du stock (poids = exemplaires du candidat), tous positifs', () => {
  assert.deepEqual(Object.fromEntries(CH.map((m) => [m.id, m.poids])), { HC2: 6, HC3: 5, HB1: 6, HK1: 6 });
  assert.deepEqual(Object.fromEntries(CH.map((m) => [m.id, M.poidsTirage(m)])), { HC2: 6, HC3: 5, HB1: 6, HK1: 6 });
});

/* ================================ nouveauDocument ================================ */

test('nouveauDocument(hex19) : grille hex19, copie modifiable des 4 modèles, plateau vide, hex19 dans FORMATS', () => {
  const d = CAT.nouveauDocument('hex19');
  assert.equal(d.grille, 'hex19');
  assert.deepEqual(d.plateau, { tuiles: [], jetons: [] });
  assert.deepEqual(d.modeles.map((m) => m.id), IDS);
  assert.deepEqual(d.modeles, copie(CH));
  assert.ok(!Object.isFrozen(d.modeles) && !Object.isFrozen(d.modeles[0]) && !Object.isFrozen(d.modeles[0].cases));
  d.modeles[0].cases[0].x = 1; // modifiable sans toucher au catalogue partagé
  assert.equal(modele('HC2').cases[0].x, 0);
  assert.deepEqual(d, Object.assign(copie(d), {}));
  assert.deepEqual(Object.keys(M.nouveauDocument('hex19')).sort(), Object.keys(d).sort());
  assert.deepEqual([...G.FORMATS], ['4x4', '5x5', 'hex19']);
  assert.ok(G.FORMATS_TOUS.includes('hex19'));
  assert.throws(() => CAT.nouveauDocument('hex20'), /Grille inconnue/);
});

test('API : modelesParGrille gelé { 4x4, 5x5, hex19 } ; modeles reste le 4×4 ; hex19 n’a pas de catalogue précédent', () => {
  assert.deepEqual(Object.keys(CAT.modelesParGrille), ['4x4', '5x5', 'hex19']);
  assert.ok(Object.isFrozen(CAT.modelesParGrille));
  assert.equal(CAT.modelesParGrille['4x4'], CAT.modeles);
  assert.equal(CAT.precedents['hex19'], undefined);
  assert.equal(CAT.precedent['hex19'], undefined);
});

/* ================================ plateau complet ================================ */

function alea(graine) {
  let x = graine >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}
/** Plateau complet du catalogue livré : choixCentrale(cellule, index) donne { id, rot } des 7 intérieures ; villes au trèfle. */
function plateau(choixCentrale) {
  let doc = CAT.nouveauDocument('hex19');
  let k = 0;
  F.cellules.forEach((c) => {
    if (c.gabarit === 'centrale') { const ch = choixCentrale(c, k++); doc = M.poserTuile(doc, ch.id, c.col, c.lig, ch.rot); }
    else doc = M.poserTuile(doc, c.gabarit === 'bord' ? 'HB1' : 'HK1', c.col, c.lig);
  });
  F.TREFLE.forEach((s) => { doc = M.poserJeton(doc, s, 0, 'capture'); });
  return doc;
}
/** Recherche déterministe de `nb` plateaux dont les 6 villes sont à 4 pas au moins (7 intérieures tirées sans remise dans le stock, rotations 0 à 2). */
function plateauxBons(nb, graine) {
  const rnd = alea(graine), res = [];
  let tirages = 0;
  while (res.length < nb && tirages < 20000) {
    tirages++;
    const stock = []; CH.filter((m) => m.gabarit === 'centrale').forEach((m) => { for (let i = 0; i < m.exemplaires; i++) stock.push(m.id); });
    const doc = plateau(() => ({ id: stock.splice(Math.floor(rnd() * stock.length), 1)[0], rot: Math.floor(rnd() * 3) }));
    const g = GR.construire(doc);
    if (!GR.villesProches(g).length) res.push({ doc, g });
  }
  return { res, tirages };
}
const { res: plateaux, tirages } = plateauxBons(4, 2026);

test('plateau complet hex19 : la recherche de rotations aboutit (4 plateaux), plateaux sans erreur', () => {
  assert.equal(plateaux.length, 4, 'tirages : ' + tirages);
  for (const { doc } of plateaux) {
    assert.equal(doc.plateau.tuiles.length, 19);
    assert.equal(doc.plateau.jetons.length, 6);
    for (const m of doc.modeles) assert.deepEqual(M.validerModele(m, 'hex19').erreurs, [], m.id);
  }
});

test('plateau complet hex19 : 56 cases (tuiles et campements), 0 case faible, 0 raccord mort, villes et campements à 3 ports, écart de 4 pas', () => {
  for (const { doc, g } of plateaux) {
    const cx = GR.connexions(doc, g);
    assert.equal(cx.cases, 56);
    assert.equal(cx.faibles, 0);
    assert.deepEqual(M.raccordsMorts(doc).filter((r) => r.raison !== 'absent'), []);
    assert.equal(g.villes.size, 6);
    const ports = (j) => g.voisins.get(j).size;
    F.sieges.forEach((s) => {
      const n = ports('J' + s.id + ',0');
      assert.equal(n, 3, 'siège ' + s.id);
    });
    assert.equal(GR.villesProches(g).length, 0);
    g.villes.forEach((v) => { const d = GR.distances(g, v); g.villes.forEach((w) => { if (w !== v) assert.ok(d.get(w) >= 4); }); });
  }
});

test('plateau complet hex19 : stock respecté (7 intérieures sans remise), équilibre 3 / 3, anneau du pourtour', () => {
  for (const { doc, g } of plateaux) {
    const posees = (id) => doc.plateau.tuiles.filter((t) => t.modeleId === id).length;
    assert.ok(posees('HC2') <= 8 && posees('HC3') <= 7 && posees('HC2') + posees('HC3') === 7);
    assert.equal(posees('HB1'), 6);
    assert.equal(posees('HK1'), 6);
    const e = GR.equilibre(doc);
    assert.ok(e.complet, e.lacunes.join(' '));
    assert.deepEqual([e.partage[1], e.partage[2], e.partage.egalite], [3, 3, 0]);
    assert.deepEqual([e.alertes, e.blocages], [[], []]);
    assert.equal(g.apparitions[1].length, 5);
    assert.equal(g.apparitions[2].length, 5);
  }
});

test('plateau hex19 : rotation imposée du pourtour respectée, validerPlateau sans erreur ni alerte de pose, coins tous portés', () => {
  const { doc } = plateaux[0];
  const v = M.validerPlateau(doc);
  const codes = [].concat(v.erreurs || [], v.alertes || []).map((x) => x.code);
  assert.ok(!codes.some((c) => /rotation_pourtour|coin_non_porte|gabarit_place|pourtour_sans_apparition|apparition_centre|trop_de_villes/.test(c)), codes.join(', '));
  F.cellules.filter((c) => c.gabarit !== 'centrale').forEach((c) => {
    const t = doc.plateau.tuiles.find((x) => x.col === c.col && x.lig === c.lig);
    assert.equal(t.rot, c.rotation, c.cle);
  });
});

/* ============================ non-régression 4×4 et 5×5 ============================ */

test('non-régression : catalogues 4×4 et 5×5 inchangés (ids, exemplaires, poids), nouveauDocument carré inchangé', () => {
  assert.deepEqual(CAT.modelesParGrille['4x4'].map((m) => [m.id, m.exemplaires, m.poids]), [['Q1', 4, 4], ['Q2', 3, 3], ['B1', 8, 8], ['B8', 3, 1], ['K2', 4, 4], ['K4', 2, 1]]);
  assert.deepEqual(CAT.modelesParGrille['5x5'].map((m) => m.id), ['LC1', 'LC3', 'LC4', 'LC5', 'LC6', 'LC7', 'LC11', 'LC12', 'LE1', 'LB2', 'LK2']);
  for (const g of ['4x4', '5x5']) {
    const d = CAT.nouveauDocument(g);
    assert.equal(d.grille, g);
    assert.equal(d.modeles.length, CAT.modelesParGrille[g].length);
    for (const m of CAT.modelesParGrille[g]) {
      const r = M.validerModele(m, g);
      assert.deepEqual([g, m.id, r.erreurs, r.alertes], [g, m.id, [], []]);
    }
  }
  assert.equal(CAT.nouveauDocument().grille, '4x4');
});
