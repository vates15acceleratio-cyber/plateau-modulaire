// planche-catalogue-hex.js : catalogue candidat du plateau HEXAGONAL a 19 tuiles (advisor geometrie et design, croquis seulement,
// aucun lien avec src/). Tuiles pointe en haut, cote s = 54 mm ; tuiles du pourtour a bord droit (le plateau est un vrai hexagone).
// Script autonome (Node, sans dependance) :
//   node planche-catalogue-hex.js controles          -> marges de trace des gabarits
//   node planche-catalogue-hex.js svg <dossier>       -> ecrit les SVG (catalogue, 2 plateaux, 3 planches A3) dans <dossier>
//   require('./planche-catalogue-hex.js')             -> geometrie, catalogue, graphe, generateur, mesures (pour les mesures en lot)
// Conventions : repere de tuile centre, x vers l'est, y vers le sud ; coin k a l'angle -90 + 60k (0 = N, 1 = NE, 2 = SE, 3 = S,
// 4 = SO, 5 = NO) ; cote k du coin k au coin k + 1 (0 = NE, 1 = E, 2 = SE, 3 = SO, 4 = O, 5 = NO) ; une rotation rot (pas de 60 deg,
// sens horaire) envoie le cote local k sur le cote global (k + rot) % 6 ; le cote k touche le cote (k + 3) % 6 du voisin.
// Traces (convention de src/rendu.js) : raccord = amorce perpendiculaire de 10 mm puis segment ; port = amorce de 28 mm sur la
// bissectrice puis segment ; lien = segment ; passage sans case = courbe de Bezier quadratique.
// Controles (convention de tests/aides-trace.js, adaptee a 6 coins) : chemin a >= r + 4 des cases qu'il ne relie pas ; chemin a
// >= 24 mm des coins-jonctions (hors amorce de son propre port) ; deux chemins a >= 8 mm d'axe a axe hors des disques (case commune
// elargie de 4 mm) ; case a >= 30 mm des coins-jonctions (zone du jeton) et a >= r + 4 du contour de la piece.
'use strict';
const S3 = Math.sqrt(3);
const s = 54, ri = s * S3 / 2, D = 20, r = D / 2, L = 8, ZONE = 20, AM_R = 10, AM_P = 28, JETON = 30;
const COUL = { vert: '#007A4D', rouge: '#D8321C', noir: '#111111', neutre: '#7A7F76', chemin: '#2F6B4F', passage: '#7FB59A',
  fondVert: '#E3F1E8', fondRouge: '#FBE6E1', fondNeutre: '#EEEEEA' };

/* ============================== Geometrie de la tuile ============================== */
const ang = k => (-90 + 60 * k) * Math.PI / 180, nang = k => (-60 + 60 * k) * Math.PI / 180;
const coin = k => ({ x: s * Math.cos(ang(k)), y: s * Math.sin(ang(k)) });
const bis = k => ({ x: -Math.cos(ang(k)), y: -Math.sin(ang(k)) });
const milieu = k => ({ x: ri * Math.cos(nang(k)), y: ri * Math.sin(nang(k)) });
const nin = k => ({ x: -Math.cos(nang(k)), y: -Math.sin(nang(k)) });
const rotp = (p, k) => { const a = k * Math.PI / 3, c = Math.cos(a), si = Math.sin(a); return { x: p.x * c - p.y * si, y: p.x * si + p.y * c }; };
const EXT = { interieure: [], bord: [5, 0], coin: [0, 1, 2] };
const coinsJonction = role => [0, 1, 2, 3, 4, 5].filter(k => !EXT[role].includes(k) && !EXT[role].includes((k + 5) % 6));

/**
 * Contour de la piece (sens horaire, repere canonique). Le creux entre deux tuiles du pourtour est un triangle de base s*V3 et de
 * profondeur s/2 ; il est partage par le prolongement du cote commun (perpendiculaire au bord du plateau) : chaque coupe est une
 * seule droite de 1,5 s = 81 mm. Au sommet du grand hexagone, le coin recoit un triangle 30-30-120 de base s.
 *  - bord (exterieurs 5 et 0) : pentagone, bord droit 93,5 mm, deux coupes de 81 mm, deux cotes de 54 mm ;
 *  - coin (exterieurs 0, 1, 2) : pentagone, deux bords droits de 77,9 mm a 120 deg, deux coupes de 81 mm, un cote de 54 mm.
 */
function forme(role) {
  if (role === 'bord') return [{ x: -ri, y: -s }, { x: ri, y: -s }, { x: ri, y: s / 2 }, { x: 0, y: s }, { x: -ri, y: s / 2 }];
  if (role === 'coin') {
    const no = [{ x: -s / S3, y: -s }, { x: ri, y: -s }, { x: ri, y: s / 2 }, { x: 0, y: s }, { x: -ri - s * S3 / 4, y: s / 4 }];
    return no.map(p => rotp(p, 2));
  }
  return [0, 1, 2, 3, 4, 5].map(coin);
}

/* ============================== Catalogue candidat ============================== */
const P = k => ({ port: k }), R = k => ({ rac: k });
const PORTS_A = [['a', P(5)], ['a', P(0)], ['a', P(1)], ['a', R(5)], ['a', R(0)]];
const PORTS_B = [['b', P(2)], ['b', P(3)], ['b', P(4)], ['b', R(2)], ['b', R(3)]];
const CASES_AB = [{ id: 'a', x: 0, y: -20.7 }, { id: 'b', x: 0, y: 20.7 }];
/**
 * Interieures (centre et couronne) : demi-tuiles 3 + 3 (H1, H2) : la case a porte les coins 5, 0, 1 et les raccords 5, 0 ; la case b
 * porte les coins 2, 3, 4 et les raccords 2, 3. Les cotes E (1) et O (4), entre les deux demi-tuiles, sont le point dur : un raccord
 * E sur a (ou sur b) touche le chemin du port voisin (marge -0,61 mm au mieux, HC0 ci-dessous).
 * Pourtour : orientation imposee par la position ; l'apparition tient les deux raccords de l'anneau (cotes vers les tuiles voisines
 * du pourtour), la porteuse tient tous les coins-jonctions (H2) et les cotes vers l'interieur.
 */
const CATALOGUE = [
  { id: 'HC1', nom: 'Pont', role: 'interieure', ex: 4, sym: [0, 1, 2], murs: [1, 4], note: 'a et b relies ; murs E et O',
    cases: CASES_AB, chemins: [...PORTS_A, ...PORTS_B, ['a', 'b']] },
  { id: 'HC2', nom: 'Deux ponts et traverse', role: 'interieure', ex: 6, sym: [0, 1, 2], note: 'a et b non relies ; passage sans case E-O',
    cases: CASES_AB, chemins: [...PORTS_A, ...PORTS_B], passages: [{ bouts: [R(1), R(4)], ctrl: { x: 0, y: 6 } }] },
  { id: 'HC3', nom: 'Carrefour', role: 'interieure', ex: 5, sym: [0, 1, 2], note: 'T sans case au centre : a, b, E et O',
    cases: CASES_AB, chemins: [...PORTS_A, ...PORTS_B],
    passages: [{ bouts: [R(1), R(4), { cas: 'a' }, { cas: 'b' }], pivot: { x: 0, y: 0 }, ctrl: [{ x: 20, y: -4 }, { x: -20, y: 4 }, { x: 3, y: -10 }, { x: -3, y: 10 }] }] },
  { id: 'HB1', nom: 'Bord', role: 'bord', ex: 6, reserve: 2, note: 'anneau E-O sur l’apparition',
    cases: [{ id: 'a', x: 0, y: -30, app: true }, { id: 'p', x: 0, y: 20.7 }],
    chemins: [['a', R(1)], ['a', R(4)], ['a', 'p'], ['p', P(2)], ['p', P(3)], ['p', P(4)], ['p', R(2)], ['p', R(3)]] },
  { id: 'HK1', nom: 'Coin', role: 'coin', ex: 6, reserve: 1, note: 'anneau NO-SO sur l’apparition',
    cases: [{ id: 'a', x: 10, y: 0, app: true }, { id: 'p', x: -22, y: 0 }],
    chemins: [['a', R(3)], ['a', R(5)], ['a', 'p'], ['p', P(4)], ['p', P(5)], ['p', R(4)]] }
];
/** Gabarit rejete, montre pour memoire : « Pont » sans mur (raccord E sur a, O sur b) ; positions optimisees, marge negative. */
const REJETE = { id: 'HC0', nom: 'Pont sans mur (rejete)', role: 'interieure', ex: 0, note: 'raccord E touche le port NE',
  cases: [{ id: 'a', x: 2.4, y: -4.1 }, { id: 'b', x: -10.2, y: 17.3 }], chemins: [...PORTS_A, ...PORTS_B, ['a', 'b'], ['a', R(1)], ['b', R(4)]] };
const PAR_ID = Object.fromEntries(CATALOGUE.concat([REJETE]).map(m => [m.id, m]));

/* ============================== Traces et controles ============================== */
function distPS(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function distSS(a, b, c, d) {
  if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return 0;
  return Math.min(distPS(a, c, d), distPS(b, c, d), distPS(c, a, b), distPS(d, a, b));
}
function distPL(p, Pl) { let m = Infinity; for (let i = 0; i + 1 < Pl.length; i++) m = Math.min(m, distPS(p, Pl[i], Pl[i + 1])); return m; }
function distLL(Pl, Q) { let m = Infinity; for (let i = 0; i + 1 < Pl.length; i++) for (let j = 0; j + 1 < Q.length; j++) m = Math.min(m, distSS(Pl[i], Pl[i + 1], Q[j], Q[j + 1])); return m; }
function bez(p0, c, p1, n = 16) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n; o.push({ x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x, y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y }); } return o; }

function traces(m) {
  const cs = Object.fromEntries(m.cases.map(c => [c.id, c])), T = [];
  m.chemins.forEach((ch, i) => {
    const A = cs[ch[0]], o = ch[1];
    if (typeof o === 'string') T.push({ id: 'l' + i, type: 'lien', cases: [A, cs[o]], pts: [A, cs[o]] });
    else if (o.rac !== undefined) { const Pm = milieu(o.rac), n = nin(o.rac); T.push({ id: 'r' + o.rac, type: 'raccord', k: o.rac, cases: [A], pts: [Pm, { x: Pm.x + AM_R * n.x, y: Pm.y + AM_R * n.y }, A] }); }
    else { const K = coin(o.port), b = bis(o.port); T.push({ id: 'p' + o.port, type: 'port', k: o.port, cases: [A], pts: [K, { x: K.x + AM_P * b.x, y: K.y + AM_P * b.y }, A] }); }
  });
  (m.passages || []).forEach((ps, i) => {
    const bout = b => { if (b.rac === undefined) return { P: cs[b.cas], Q: cs[b.cas], cas: cs[b.cas] }; const Pm = milieu(b.rac), n = nin(b.rac); return { P: Pm, Q: { x: Pm.x + AM_R * n.x, y: Pm.y + AM_R * n.y } }; };
    if (ps.pivot) ps.bouts.forEach((b, j) => {
      const e = bout(b), c = ps.ctrl && ps.ctrl[j] ? ps.ctrl[j] : { x: (e.Q.x + ps.pivot.x) / 2, y: (e.Q.y + ps.pivot.y) / 2 };
      T.push({ id: 'v' + i + '.' + j, type: 'passage', reseau: i, cases: e.cas ? [e.cas] : [], pts: (e.cas ? [] : [e.P]).concat(bez(e.Q, c, ps.pivot)) });
    });
    else { const a = bout(ps.bouts[0]), b = bout(ps.bouts[1]); T.push({ id: 'v' + i, type: 'passage', reseau: i, cases: [], pts: [a.P].concat(bez(a.Q, ps.ctrl, b.Q), [b.P]) }); }
  });
  return T;
}
function rogner(t, commun) {
  const coupe = (c, vers) => { const rr = r + (c === commun ? 4 : 0), d = Math.hypot(vers.x - c.x, vers.y - c.y), k = Math.min(1, rr / d); return { x: c.x + (vers.x - c.x) * k, y: c.y + (vers.y - c.y) * k }; };
  if (t.type === 'lien') return [coupe(t.cases[0], t.pts[1]), coupe(t.cases[1], t.pts[0])];
  const pts = t.pts.map(p => ({ x: p.x, y: p.y }));
  if (!t.cases.length) return pts;
  const c = t.cases[0], rr = r + (c === commun ? 4 : 0);
  // le trace finit sur la case (chemin) ou en part (passage vers une case : premier point) ; on retire la partie dans le disque
  const fin = Math.hypot(pts[pts.length - 1].x - c.x, pts[pts.length - 1].y - c.y) < 1e-6;
  const seq = fin ? pts : pts.slice().reverse();
  let i = seq.length - 1; while (i > 0 && Math.hypot(seq[i - 1].x - c.x, seq[i - 1].y - c.y) < rr) i--;
  const out = seq.slice(0, i); out.push(coupe(c, seq[i - 1] || seq[0])); return out;
}
function distBordPoly(p, poly) { let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, distPS(p, poly[i], poly[(i + 1) % poly.length])); return m; }

function controler(m) {
  const T = traces(m), poly = forme(m.role), CJ = coinsJonction(m.role), mg = {};
  const mini = (k, v, quoi) => { if (mg[k] === undefined || v < mg[k].v) mg[k] = { v, quoi }; };
  m.cases.forEach(c => {
    CJ.forEach(k => mini('case-zone', Math.hypot(c.x - coin(k).x, c.y - coin(k).y) - (ZONE + r), c.id + '/coin ' + k));
    mini('case-bord', distBordPoly(c, poly) - (r + 4), c.id);
  });
  for (let i = 0; i < m.cases.length; i++) for (let j = i + 1; j < m.cases.length; j++) mini('case-case', Math.hypot(m.cases[i].x - m.cases[j].x, m.cases[i].y - m.cases[j].y) - D, m.cases[i].id + m.cases[j].id);
  T.forEach(t => {
    m.cases.forEach(c => { if (!t.cases.includes(c)) mini('chemin-case', distPL(c, t.pts) - (r + 4), t.id + '/' + c.id); });
    CJ.forEach(k => { const pts = t.type === 'port' && t.k === k ? t.pts.slice(1) : t.pts; mini('chemin-zone', distPL(coin(k), pts) - (ZONE + 4), t.id + '/coin ' + k); });
  });
  for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) {
    const a = T[i], b = T[j];
    if (a.type === 'passage' && b.type === 'passage' && a.reseau === b.reseau) continue;
    const com = a.cases.find(c => b.cases.includes(c));
    mini('chemin-chemin', distLL(rogner(a, com), rogner(b, com)) - L, a.id + '/' + b.id);
  }
  const trace = Math.min(mg['chemin-case'].v, mg['chemin-zone'].v, mg['chemin-chemin'].v);
  // connexions internes, ports, raccords
  const deg = {}; m.cases.forEach(c => { deg[c.id] = T.filter(t => t.type !== 'passage' && t.cases.includes(c)).length; });
  (m.passages || []).forEach(ps => { const n = ps.bouts.length - 1; ps.bouts.forEach(b => { if (b.cas) deg[b.cas] += n; }); });
  const ports = {}; m.chemins.forEach(([a, o]) => { if (o.port !== undefined) ports[a] = (ports[a] || 0) + 1; });
  return { mg, trace, T, deg, ports };
}

/* ============================== Plateau de 19 tuiles ============================== */
function grille() {
  const cellules = [];
  for (let q = -2; q <= 2; q++) for (let rr = -2; rr <= 2; rr++) { const t = -q - rr; if (Math.abs(t) > 2) continue; cellules.push({ q, r: rr, d: Math.max(Math.abs(q), Math.abs(rr), Math.abs(t)) }); }
  const n1 = nang(1), n2 = nang(2);
  cellules.forEach((c, i) => { c.id = i; c.x = S3 * s * (c.q * Math.cos(n1) + c.r * Math.cos(n2)); c.y = S3 * s * (c.q * Math.sin(n1) + c.r * Math.sin(n2)); });
  const cle = (x, y) => Math.round(x * 100) + ',' + Math.round(y * 100), sommets = new Map();
  cellules.forEach(c => { c.coins = [0, 1, 2, 3, 4, 5].map(k => { const p = coin(k), K = cle(c.x + p.x, c.y + p.y); if (!sommets.has(K)) sommets.set(K, { x: c.x + p.x, y: c.y + p.y, tuiles: [] }); sommets.get(K).tuiles.push(c.id); return K; }); });
  const parCentre = new Map(cellules.map(c => [cle(c.x, c.y), c.id]));
  cellules.forEach(c => {
    c.voisins = [0, 1, 2, 3, 4, 5].map(k => { const v = parCentre.get(cle(c.x + S3 * s * Math.cos(nang(k)), c.y + S3 * s * Math.sin(nang(k)))); return v === undefined ? null : v; });
    const ext = c.voisins.map((v, k) => v === null ? k : -1).filter(k => k >= 0);
    c.role = c.d < 2 ? 'interieure' : (ext.length === 3 ? 'coin' : 'bord');
    c.nomRole = c.d === 0 ? 'centre' : c.d === 1 ? 'couronne' : c.role;
    c.camp = c.y < -1 ? 'vert' : c.y > 1 ? 'rouge' : 'neutre'; // variante A : rangee du milieu neutre
    c.rotFixe = null;
    if (c.role !== 'interieure') for (let rot = 0; rot < 6; rot++) if (EXT[c.role].every(k => ext.includes((k + rot) % 6))) c.rotFixe = rot;
  });
  // jonctions (sommets a 3 tuiles) numerotees comme camps.png : de haut en bas, puis de gauche a droite
  const J = [...sommets.entries()].filter(([, v]) => v.tuiles.length === 3).sort((a, b) => (Math.round(a[1].y) - Math.round(b[1].y)) || (a[1].x - b[1].x));
  const numJ = new Map(J.map(([K], i) => [K, i]));
  const jonctions = J.map(([, v], i) => ({ id: i, x: v.x, y: v.y, camp: v.y < 0 ? 'vert' : 'rouge' }));
  cellules.forEach(c => { c.jonc = c.coins.map(K => numJ.has(K) ? numJ.get(K) : null); });
  return { cellules, jonctions };
}
const GR = grille();
const TREFLE = [0, 4, 8, 15, 19, 23];

/** Pose : [{id, rot}] par cellule. Anneau : 'complet' | 'coupe-neutres' (coins E et O sans raccords d'anneau) | 'sans'. */
function modeleDePose(cell, pose, anneau) {
  const m = PAR_ID[pose.id];
  if (cell.role === 'interieure' || anneau === 'complet' || !anneau) return m;
  if (anneau === 'coupe-neutres' && cell.camp !== 'neutre') return m;
  // retirer les raccords d'anneau de l'apparition
  return Object.assign({}, m, { chemins: m.chemins.filter(([a, o]) => !(a === 'a' && o.rac !== undefined)) });
}

/** Graphe reel : noeuds 'c<cellule>:<case>' et 'J<n>' ; les passages sans case relient directement leurs bouts. */
function construire(poses, anneau) {
  const adjV = new Map(), add = n => { if (!adjV.has(n)) adjV.set(n, new Set()); }, lier = (a, b) => { add(a); add(b); adjV.get(a).add(b); adjV.get(b).add(a); };
  const attache = []; let morts = 0, versPourtour = 0;
  const mods = GR.cellules.map(c => modeleDePose(c, poses[c.id], anneau));
  GR.cellules.forEach(c => {
    const m = mods[c.id], rot = poses[c.id].rot, at = new Array(6).fill(null);
    m.cases.forEach(cs => add('c' + c.id + ':' + cs.id));
    m.chemins.forEach(([a, o]) => {
      const A = 'c' + c.id + ':' + a;
      if (typeof o === 'string') lier(A, 'c' + c.id + ':' + o);
      else if (o.rac !== undefined) at[(o.rac + rot) % 6] = A;
      else { const j = c.jonc[(o.port + rot) % 6]; if (j === null) versPourtour++; else lier(A, 'J' + j); }
    });
    (m.passages || []).forEach((ps, i) => {
      const V = 'v' + c.id + ':' + i; add(V);
      ps.bouts.forEach(b => { if (b.cas) lier(V, 'c' + c.id + ':' + b.cas); else at[(b.rac + rot) % 6] = V; });
    });
    attache[c.id] = at;
  });
  GR.cellules.forEach(c => c.voisins.forEach((v, k) => {
    const a = attache[c.id][k]; if (!a) return;
    if (v === null) { morts++; return; }
    const b = attache[v][(k + 3) % 6];
    if (!b) { morts++; return; }
    if (c.id < v) lier(a, b);
  }));
  // contraction des noeuds virtuels (passages) : voisins = noeuds reels atteints par des noeuds virtuels seulement
  const adj = new Map();
  for (const [n, vs] of adjV) {
    if (n[0] === 'v') continue;
    const out = new Set(), vu = new Set([n]), pile = [...vs];
    while (pile.length) { const x = pile.pop(); if (vu.has(x)) continue; vu.add(x); if (x[0] === 'v') adjV.get(x).forEach(y => pile.push(y)); else out.add(x); }
    out.delete(n); adj.set(n, out);
  }
  return { adj, morts, versPourtour };
}
function bfs(adj, sources, bloques) {
  const d = new Map(sources.map(x => [x, 0])), f = sources.slice();
  for (let i = 0; i < f.length; i++) { const x = f[i]; if (bloques && bloques.has(x) && d.get(x) > 0) continue; for (const y of adj.get(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); f.push(y); } }
  return d;
}
function apparitions(poses, camp) { return GR.cellules.filter(c => c.role !== 'interieure' && c.camp === camp).map(c => 'c' + c.id + ':a'); }

/** Mesures d'un plateau pose (definitions de src/graphe.js : S = somme des ecarts rang a rang, villes non traversables). */
function mesurer(poses, villes, anneau) {
  const G = construire(poses, anneau), V = villes.map(j => 'J' + j), bloq = new Set(V);
  const dv = bfs(G.adj, apparitions(poses, 'vert'), bloq), dr = bfs(G.adj, apparitions(poses, 'rouge'), bloq);
  const Dv = V.map(x => dv.get(x) ?? 99), Dr = V.map(x => dr.get(x) ?? 99);
  const sv = Dv.slice().sort((a, b) => a - b), sr = Dr.slice().sort((a, b) => a - b);
  const S = sv.reduce((t, x, i) => t + Math.abs(x - sr[i]), 0), ecartRang = Math.max(...sv.map((x, i) => Math.abs(x - sr[i])));
  const pv = V.filter((x, i) => Dv[i] < Dr[i]).length, pr = V.filter((x, i) => Dr[i] < Dv[i]).length;
  let ecartVilles = 99; V.forEach(a => { const d = bfs(G.adj, [a]); V.forEach(b => { if (a !== b) ecartVilles = Math.min(ecartVilles, d.get(b) ?? 99); }); });
  // connexions : cases des tuiles + campements (jonctions sans ville) ; une voisine ville compte
  const ids = [...G.adj.keys()].filter(n => n[0] === 'c' || (n[0] === 'J' && !bloq.has(n)));
  const degs = ids.map(n => G.adj.get(n).size), faibles = degs.filter(x => x <= 2).length;
  const ports = Object.fromEntries(GR.jonctions.map(j => [j.id, G.adj.get('J' + j.id) ? G.adj.get('J' + j.id).size : 0]));
  // distMax : distance maximale d'une case de tuile a la zone d'interet (jonction) la plus proche
  const dJ = bfs(G.adj, GR.jonctions.map(j => 'J' + j.id));
  const distMax = Math.max(...[...G.adj.keys()].filter(n => n[0] === 'c').map(n => dJ.get(n)));
  // apparition verte -> apparition rouge (plus court) et diametre
  const dav = bfs(G.adj, apparitions(poses, 'vert'));
  const dAppVR = Math.min(...apparitions(poses, 'rouge').map(x => dav.get(x) ?? 99));
  return { S, ecartRang, Dv: sv, Dr: sr, partage: [pv, pr, V.length - pv - pr], premiere: [sv[0], sr[0]], tempo: [Dv.filter(x => x <= 3).length, Dr.filter(x => x <= 3).length],
    ecartVilles, cases: ids.length, faibles, part: faibles / ids.length, degMoy: degs.reduce((a, b) => a + b, 0) / ids.length,
    portsVilles: villes.map(j => ports[j]), portsCampements: GR.jonctions.filter(j => !villes.includes(j.id)).map(j => ports[j.id]),
    distMax, morts: G.morts, versPourtour: G.versPourtour, dAppVR };
}

/* ============================== Generateur (villes posees d'abord) ============================== */
function alea(graine) { let x = graine >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }
/** Villes servies par chaque case d'une tuile posee (rotation rot) : {case: Set(villes)} ; attaches par cote global. */
function servies(cell, m, rot, villes) {
  const sv = {}; m.cases.forEach(c => { sv[c.id] = new Set(); });
  m.chemins.forEach(([a, o]) => { if (o.port !== undefined) { const j = cell.jonc[(o.port + rot) % 6]; if (j !== null && villes.includes(j)) sv[a].add(j); } });
  return sv;
}
/**
 * Cherche les rotations des 7 interieures (cellules et modeles donnes) : ecart entre villes >= 4 pas (3 cases), verifie a la fin par
 * BFS ; elagage local (une case qui sert 2 villes, deux cases voisines qui servent 2 villes differentes, par lien, raccord ou passage).
 * Renvoie toutes les solutions (au plus `max`).
 */
function solutions(choix, villes, anneau, max = 20000) {
  const inter = GR.cellules.filter(c => c.role === 'interieure'), poses = [];
  GR.cellules.forEach(c => { if (c.role !== 'interieure') poses[c.id] = { id: c.role === 'bord' ? 'HB1' : 'HK1', rot: c.rotFixe }; });
  const out = [];
  // villes servies par attache (cote global) de chaque cellule posee
  const servAt = [];
  function poser(c) {
    const pz = poses[c.id], m = modeleDePose(c, pz, anneau), sv = servies(c, m, pz.rot, villes), at = new Array(6).fill(null);
    m.chemins.forEach(([a, o]) => { if (o.rac !== undefined) at[(o.rac + pz.rot) % 6] = sv[a]; });
    let ok = Object.values(sv).every(x => x.size <= 1);
    m.chemins.forEach(([a, o]) => { if (typeof o === 'string' && sv[a].size && sv[o].size && [...sv[a]].some(x => !sv[o].has(x))) ok = false; });
    (m.passages || []).forEach(ps => {
      const u = new Set(); ps.bouts.forEach(b => { if (b.cas) sv[b.cas].forEach(x => u.add(x)); });
      if (u.size > 1) ok = false;
      ps.bouts.forEach(b => { if (b.rac !== undefined) at[(b.rac + pz.rot) % 6] = u; }); // un passage transmet les villes de ses cases
    });
    servAt[c.id] = at; return ok;
  }
  GR.cellules.forEach(c => { if (c.role !== 'interieure') poser(c); });
  function voisinsOk(c) {
    for (let k = 0; k < 6; k++) {
      const v = c.voisins[k]; if (v === null || !servAt[v]) continue;
      const a = servAt[c.id][k], b = servAt[v][(k + 3) % 6]; if (!a || !b) continue;
      if (a.size && b.size && [...a].some(x => !b.has(x))) return false;
    }
    return true;
  }
  (function rec(i) {
    if (out.length >= max) return;
    if (i === inter.length) {
      const G = construire(poses, anneau), V = villes.map(j => 'J' + j);
      for (const a of V) { const d = bfs(G.adj, [a]); for (const b of V) if (a !== b && (d.get(b) ?? 99) < 4) return; }
      out.push(poses.map(p => Object.assign({}, p))); return;
    }
    const c = inter[i], id = choix[i], rots = PAR_ID[id].sym || [0, 1, 2, 3, 4, 5];
    for (const rot of rots) {
      poses[c.id] = { id, rot };
      if (poser(c) && voisinsOk(c)) rec(i + 1);
      servAt[c.id] = null;
    }
    poses[c.id] = undefined;
  })(0);
  return out;
}
/** Tirage de 7 interieures selon les exemplaires (sans remise), puis rotations ; choix au hasard parmi les solutions acceptables. */
function generer(graine, opts = {}) {
  const rnd = alea(graine), villes = opts.villes || TREFLE, anneau = opts.anneau || 'complet';
  const stock = []; CATALOGUE.filter(m => m.role === 'interieure').forEach(m => { for (let i = 0; i < (opts.stock ? opts.stock[m.id] || 0 : m.ex); i++) stock.push(m.id); });
  for (let essai = 0; essai < (opts.essais || 10); essai++) {
    const tas = stock.slice(), choix = [];
    for (let i = 0; i < 7; i++) choix.push(tas.splice(Math.floor(rnd() * tas.length), 1)[0]);
    const sols = solutions(choix, villes, anneau, opts.max || 4000);
    if (!sols.length) continue;
    const ms = sols.map(p => ({ p, m: mesurer(p, villes, anneau) }));
    const acc = ms.filter(x => Math.max(x.m.partage[0], x.m.partage[1]) < 4 && x.m.S < 5 && x.m.premiere[0] === x.m.premiere[1]);
    const pool = acc.length ? acc : ms;
    const pick = pool[Math.floor(rnd() * pool.length)];
    return { essai: essai + 1, choix, poses: pick.p, mesures: pick.m, nbSolutions: sols.length, nbAcceptables: acc.length, toutes: ms.map(x => x.m) };
  }
  return null;
}

/* ============================== Dessin (SVG, mm) ============================== */
const f = n => Math.round(n * 100) / 100;
const pts = (L2) => L2.map(p => f(p.x) + ',' + f(p.y)).join(' ');
const tr = (p, rot, cx, cy) => { const q = rotp(p, rot); return { x: cx + q.x, y: cy + q.y }; };
const txt = (x, y, t, o = {}) => `<text x="${f(x)}" y="${f(y)}" font-family="Helvetica, Arial, sans-serif" font-size="${o.fs || 3.5}" text-anchor="${o.a || 'middle'}" fill="${o.c || COUL.noir}"${o.b ? ' font-weight="bold"' : ''}>${t}</text>`;
function icone(x, y, type, camp) {
  if (type === 'ville') { // tour crenelee
    const c = COUL.noir; return `<path d="M${f(x - 6)} ${f(y + 6)} L${f(x - 6)} ${f(y - 4)} L${f(x - 4)} ${f(y - 4)} L${f(x - 4)} ${f(y - 6)} L${f(x - 1.5)} ${f(y - 6)} L${f(x - 1.5)} ${f(y - 4)} L${f(x + 1.5)} ${f(y - 4)} L${f(x + 1.5)} ${f(y - 6)} L${f(x + 4)} ${f(y - 6)} L${f(x + 4)} ${f(y - 4)} L${f(x + 6)} ${f(y - 4)} L${f(x + 6)} ${f(y + 6)} Z" fill="${c}"/><rect x="${f(x - 1.6)}" y="${f(y + 1)}" width="3.2" height="5" fill="#fff"/>`;
  }
  // feu de bois : deux buches croisees et une flamme
  return `<line x1="${f(x - 6)}" y1="${f(y + 6)}" x2="${f(x + 6)}" y2="${f(y + 3)}" stroke="#6B4A2B" stroke-width="2" stroke-linecap="round"/><line x1="${f(x + 6)}" y1="${f(y + 6)}" x2="${f(x - 6)}" y2="${f(y + 3)}" stroke="#6B4A2B" stroke-width="2" stroke-linecap="round"/>` +
    `<path d="M${f(x)} ${f(y - 7)} C${f(x + 5)} ${f(y - 2)} ${f(x + 4)} ${f(y + 3)} ${f(x)} ${f(y + 3)} C${f(x - 4)} ${f(y + 3)} ${f(x - 5)} ${f(y - 1)} ${f(x - 1)} ${f(y - 3)} C${f(x - 1)} ${f(y - 1)} ${f(x + 1)} ${f(y)} ${f(x)} ${f(y - 7)} Z" fill="#E07A1F"/>`;
}
/** Dessine une tuile (modele m, rotation rot) centree en (cx, cy). opts : camp (couleur de l'apparition et du fond), contour, zones. */
function svgTuile(m, rot, cx, cy, opts = {}) {
  const o = [], T = traces(m), poly = forme(m.role).map(p => tr(p, rot, cx, cy));
  const fond = opts.fond || '#FFFFFF', cp = 'cp' + (++svgTuile.n);
  o.push(`<clipPath id="${cp}"><polygon points="${pts(poly)}"/></clipPath><g clip-path="url(#${cp})">`);
  o.push(`<polygon points="${pts(poly)}" fill="${fond}" stroke="none"/>`);
  const zones = []; if (opts.zones) coinsJonction(m.role).forEach(k => { const K = tr(coin(k), rot, cx, cy); zones.push(`<circle cx="${f(K.x)}" cy="${f(K.y)}" r="${ZONE}" fill="none" stroke="#C9A0B0" stroke-width="0.3" stroke-dasharray="1.2 1"/>`); });
  if (opts.hex) o.push(`<polygon points="${pts([0, 1, 2, 3, 4, 5].map(k => tr(coin(k), rot, cx, cy)))}" fill="none" stroke="#9AA" stroke-width="0.25" stroke-dasharray="2 1.2"/>`);
  T.filter(t => t.type === 'passage').forEach(t => o.push(`<polyline points="${pts(t.pts.map(p => tr(p, rot, cx, cy)))}" fill="none" stroke="${COUL.passage}" stroke-width="${L}" stroke-linejoin="round" stroke-linecap="round"/>`));
  T.filter(t => t.type !== 'passage').forEach(t => o.push(`<polyline points="${pts(t.pts.map(p => tr(p, rot, cx, cy)))}" fill="none" stroke="${COUL.chemin}" stroke-width="${L}" stroke-linejoin="round"/>`));
  (m.murs || []).forEach(k => { const a = tr(coin(k), rot, cx, cy), b = tr(coin((k + 1) % 6), rot, cx, cy), mm = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, d = { x: (b.x - a.x) / s, y: (b.y - a.y) / s };
    o.push(`<line x1="${f(mm.x - 7 * d.x)}" y1="${f(mm.y - 7 * d.y)}" x2="${f(mm.x + 7 * d.x)}" y2="${f(mm.y + 7 * d.y)}" stroke="#555" stroke-width="1.6"/>`); });
  // sieges des jetons : secteur de 120 deg (R 15) a chaque coin-jonction
  coinsJonction(m.role).forEach(k => {
    const K = coin(k), a0 = ang(k) + Math.PI, a1 = a0 - Math.PI / 3, a2 = a0 + Math.PI / 3, R1 = JETON / 2;
    const A = tr({ x: K.x + R1 * Math.cos(a1), y: K.y + R1 * Math.sin(a1) }, rot, cx, cy), B = tr({ x: K.x + R1 * Math.cos(a2), y: K.y + R1 * Math.sin(a2) }, rot, cx, cy), C = tr(K, rot, cx, cy);
    o.push(`<path d="M${f(C.x)} ${f(C.y)} L${f(A.x)} ${f(A.y)} A${R1} ${R1} 0 0 1 ${f(B.x)} ${f(B.y)} Z" fill="#fff" stroke="${COUL.noir}" stroke-width="0.5"/>`);
  });
  m.cases.forEach(c => {
    const p = tr(c, rot, cx, cy), camp = opts.camp || 'neutre';
    const fill = c.app ? ({ vert: COUL.vert, rouge: COUL.rouge, neutre: COUL.neutre })[camp] : '#fff';
    o.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="${r}" fill="${fill}" stroke="${COUL.noir}" stroke-width="0.6"/>`);
    if (c.app) { const h = 4.6; o.push(`<rect x="${f(p.x - h)}" y="${f(p.y - h)}" width="${2 * h}" height="${2 * h}" fill="none" stroke="#fff" stroke-width="1.2"/>`); }
    if (opts.etiquettes) o.push(txt(p.x, p.y + 1.3, c.id, { fs: 3.6, c: c.app ? '#fff' : COUL.noir }));
  });
  o.push('</g>');
  o.push(...zones);
  o.push(`<polygon points="${pts(poly)}" fill="none" stroke="${opts.contour || COUL.noir}" stroke-width="${opts.trait || 0.35}"/>`);
  return o.join('\n');
}

svgTuile.n = 0;
function svgDoc(W, H, corps) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(W)}mm" height="${f(H)}mm" viewBox="0 0 ${f(W)} ${f(H)}"><rect width="${f(W)}" height="${f(H)}" fill="#fff"/>\n${corps}\n</svg>`; }

/** Planche du catalogue a l'echelle 1:1 (A3 paysage). */
function planheCatalogue() {
  const W = 420, H = 297, o = [];
  o.push(txt(14, 13, 'Catalogue candidat du plateau hexagonal (19 tuiles, cote 54 mm, pointe en haut) : echelle 1:1, cotes en mm', { a: 'start', fs: 5.2, b: true }));
  o.push(txt(14, 20, 'Interieures (centre et couronne) : demi-tuiles 3 + 3 (H1, H2), tous les coins portes. Pourtour : bord droit (pentagones), orientation imposee, apparition (carre) reliee le long du bord.', { a: 'start', fs: 3.4 }));
  const place = [['HC1', 58, 86, 0], ['HC2', 160, 86, 0], ['HC3', 262, 86, 0], ['HC0', 364, 86, 0], ['HB1', 66, 222, 0], ['HK1', 196, 222, 4]];
  place.forEach(([id, cx, cy, rot]) => {
    const m = PAR_ID[id], c = controler(m);
    o.push(svgTuile(m, rot, cx, cy, { zones: true, hex: m.role !== 'interieure', camp: 'vert', etiquettes: true, contour: id === 'HC0' ? '#B00' : COUL.noir, trait: 0.5 }));
    const bas = cy + 60;
    o.push(txt(cx, bas, `${id} « ${m.nom} »${m.ex ? ' ×' + m.ex : ''}${m.reserve ? ' (+' + m.reserve + ' en reserve)' : ''}`, { fs: 4, b: true, c: id === 'HC0' ? '#B00' : COUL.noir }));
    o.push(txt(cx, bas + 4.6, m.note + (rot ? ' (montre en position nord-ouest)' : ''), { fs: 3 }));
    o.push(txt(cx, bas + 9, `connexions ${Object.entries(c.deg).map(([k, v]) => k + ' ' + v).join(', ')} ; marge de trace ${c.trace.toFixed(2).replace('.', ',')} mm`, { fs: 3, c: c.trace < 2.7 ? '#B00' : COUL.noir }));
  });
  // legende et cotes
  const lx = 282, ly = 168; o.push(txt(lx, ly, 'Legende et cotes', { a: 'start', fs: 3.8, b: true }));
  const leg = ['Pointilles roses : zone du jeton (R 20) aux coins-jonctions ;', 'secteur blanc : siege du jeton (O 30, 120 deg).', 'Vert fonce : chemin (8 mm) ; vert clair : passage sans case.', 'Carre : case d’apparition (couleur du camp a l’impression).', 'Trait gris court : mur (cote sans raccord).', 'Pointilles gris : hexagone d’origine (part de triangle ajoutee).',
    'Bord : bord droit 93,5 ; 2 coupes de 81 (prolongement du cote', 'commun) ; 2 cotes interieurs de 54 ; boite 93,5 × 108.', 'Coin : 2 bords droits de 77,9 a 120 deg ; 2 coupes de 81 ;', '1 cote de 54 ; boite 116,9 × 108 (position NO).',
    'Marges : convention de tests/aides-trace.js (case commune', 'elargie de 4 mm ; zone de coin + 4 mm). Le plafond de 3,00 mm', 'est fixe : amorce d’un raccord a 27 mm d’un coin-jonction.'];
  leg.forEach((l, i) => o.push(txt(lx, ly + 6 + i * 4.4, l, { a: 'start', fs: 2.9 })));
  o.push(`<line x1="${lx}" y1="${ly + 70}" x2="${lx + 100}" y2="${ly + 70}" stroke="#111" stroke-width="0.5"/>` + txt(lx + 50, ly + 68, '100 mm (controle d’echelle)', { fs: 3 }));
  return svgDoc(W, H, o.join('\n'));
}

/** Grand hexagone (6 sommets) : apotheme 4 s. */
function grandHexagone() { const R0 = 8 * s / S3; return [0, 1, 2, 3, 4, 5].map(k => ({ x: R0 * Math.cos(k * Math.PI / 3), y: R0 * Math.sin(k * Math.PI / 3) })); }

function svgPlateau(gen, titre, sous) {
  const M = 22, Wb = 16 * s / S3, Hb = 8 * s, W = Wb + 2 * M, H = Hb + 2 * M + 34, cx = W / 2, cy = M + 22 + Hb / 2, o = [];
  o.push(txt(W / 2, 12, titre, { fs: 7, b: true }));
  o.push(txt(W / 2, 20, sous, { fs: 4.2 }));
  const villes = gen.villes || TREFLE;
  GR.cellules.forEach(c => {
    const pz = gen.poses[c.id], m = PAR_ID[pz.id];
    const fond = { vert: COUL.fondVert, rouge: COUL.fondRouge, neutre: COUL.fondNeutre }[c.camp];
    o.push(svgTuile(m, pz.rot, cx + c.x, cy + c.y, { camp: c.camp, fond, trait: 0.5 }));
    o.push(txt(cx + c.x + (m.role === 'interieure' ? 0 : 0), cy + c.y + 2, pz.id, { fs: 4, c: '#666' }));
  });
  // bord du plateau : 6 cotes droits colores par camp (le cote nord-est va du sommet E au sommet NE, etc.)
  const Hx = grandHexagone();
  for (let k = 0; k < 6; k++) {
    const a = Hx[k], b = Hx[(k + 1) % 6], my = (a.y + b.y) / 2;
    o.push(`<line x1="${f(cx + a.x)}" y1="${f(cy + a.y)}" x2="${f(cx + b.x)}" y2="${f(cy + b.y)}" stroke="${my < 0 ? COUL.vert : COUL.rouge}" stroke-width="3.2" stroke-linecap="round"/>`);
  }
  // jetons : villes et campements
  GR.jonctions.forEach(j => {
    const x = cx + j.x, y = cy + j.y, ville = villes.includes(j.id);
    o.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${JETON / 2}" fill="${ville ? '#F4D35E' : '#FFF4E0'}" stroke="${COUL.noir}" stroke-width="0.8"/>`);
    o.push(icone(x, y, ville ? 'ville' : 'campement'));
    o.push(txt(x + 10.5, y - 9, String(j.id), { fs: 3.2, c: '#333' }));
  });
  const m = gen.mesures;
  o.push(txt(W / 2, H - 14, `Distances vert ${m.Dv.join(' ')} | rouge ${m.Dr.join(' ')} | S = ${m.S} | partage ${m.partage.join(' / ')} | premiere ville ${m.premiere.join(' / ')} | tempo (≤ 3 pas) ${m.tempo.join(' / ')} | ecart entre villes ${m.ecartVilles} pas`, { fs: 4 }));
  o.push(txt(W / 2, H - 7, `${m.cases} cases (tuiles + 18 campements), ${(100 * m.part).toFixed(1).replace('.', ',')} % a ≤ 2 connexions, degre moyen ${m.degMoy.toFixed(2).replace('.', ',')} | raccords morts ${m.morts} | apparition verte -> rouge ${m.dAppVR} pas | plateau ${f(Wb)} × ${f(Hb)} mm`, { fs: 4 }));
  return svgDoc(W, H, o.join('\n'));
}

/* ============================== Calepinage (3 planches A3, coupes partagees) ============================== */
/**
 * Chaque planche reprend un morceau de nid d'abeille : rangee haute de 3 pieces a bord droit en haut, rangee du milieu de 4
 * interieures, rangee basse de 3 pieces (bord droit en bas) ou de 3 interieures. Les pieces voisines partagent leurs coupes
 * (aucune gouttiere, pas de fond perdu entre pieces : les raccords se font face au milieu des cotes communs).
 * Positions (centres) dans le repere de la planche : rangee haute y = -1,5 s*... voir PLANCHES.
 */
const PLANCHES = (() => {
  // reperes : rangee haute centres (0, ±2ri) a y = -1,5 s ; rangee du milieu (±ri, ±3ri) a y = 0 ; rangee basse (0, ±2ri) a y = 1,5 s
  const haut = (x, role, rotRole, camp, id) => ({ x, y: -1.5 * s, role, rot: rotRole, camp, id });
  const mil = (x, id) => ({ x, y: 0, role: 'interieure', rot: 0, id });
  const bas = (x, role, rot, camp, id) => ({ x, y: 1.5 * s, role, rot, camp, id });
  // rotations : bord canonique a bord droit au nord (rot 0) ; au sud rot 3. Coin canonique (sommet a l'est) : coin NO = rot 4,
  // coin NE = rot 5, coin SE = rot 1, coin SO = rot 2 (coins E = 0, O = 3).
  return [
    { nom: 'Planche A3 n° 1 : 4 coins (2 verts, 2 rouges), 2 bords, 4 interieures', pieces: [
      haut(-2 * ri, 'coin', 4, 'vert', 'HK1'), haut(0, 'bord', 0, 'vert', 'HB1'), haut(2 * ri, 'coin', 5, 'vert', 'HK1'),
      mil(-3 * ri, 'HC2'), mil(-ri, 'HC2'), mil(ri, 'HC3'), mil(3 * ri, 'HC3'),
      bas(-2 * ri, 'coin', 2, 'rouge', 'HK1'), bas(0, 'bord', 3, 'rouge', 'HB1'), bas(2 * ri, 'coin', 1, 'rouge', 'HK1')] },
    { nom: 'Planche A3 n° 2 : 2 coins neutres, 4 bords (2 verts, 2 rouges), 4 interieures', pieces: [
      haut(-2 * ri, 'coin', 4, 'neutre', 'HK1'), haut(0, 'bord', 0, 'vert', 'HB1'), haut(2 * ri, 'coin', 5, 'neutre', 'HK1'),
      mil(-3 * ri, 'HC1'), mil(-ri, 'HC1'), mil(ri, 'HC2'), mil(3 * ri, 'HC3'),
      bas(-2 * ri, 'bord', 3, 'vert', 'HB1'), bas(0, 'bord', 3, 'rouge', 'HB1'), bas(2 * ri, 'bord', 3, 'rouge', 'HB1')] },
    { nom: 'Planche A3 n° 3 : reserve (1 coin, 2 bords) et 7 interieures', pieces: [
      haut(-2 * ri, 'coin', 4, 'neutre', 'HK1'), haut(0, 'bord', 0, 'neutre', 'HB1'), haut(2 * ri, 'bord', 0, 'neutre', 'HB1'),
      mil(-3 * ri, 'HC1'), mil(-ri, 'HC1'), mil(ri, 'HC2'), mil(3 * ri, 'HC2'),
      { x: -2 * ri, y: 1.5 * s, role: 'interieure', rot: 0, id: 'HC2' }, { x: 0, y: 1.5 * s, role: 'interieure', rot: 0, id: 'HC3' }, { x: 2 * ri, y: 1.5 * s, role: 'interieure', rot: 0, id: 'HC3' }] }
  ];
})();
function polyPiece(p) { return forme(p.role).map(q => { const t = rotp(q, p.rot); return { x: p.x + t.x, y: p.y + t.y }; }); }
function aire(poly) { let a = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.y - q.x * p.y; } return a / 2; }
/** Chevauchement de deux polygones convexes (axes separateurs), avec tolerance : renvoie la penetration (0 si disjoints). */
function penetration(A, B) {
  let min = Infinity;
  for (const Pg of [A, B]) for (let i = 0; i < Pg.length; i++) {
    const p = Pg[i], q = Pg[(i + 1) % Pg.length], n = { x: q.y - p.y, y: p.x - q.x }, l = Math.hypot(n.x, n.y); n.x /= l; n.y /= l;
    const pa = A.map(v => v.x * n.x + v.y * n.y), pb = B.map(v => v.x * n.x + v.y * n.y);
    const o = Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb));
    if (o <= 1e-6) return 0; min = Math.min(min, o);
  }
  return min;
}
function verifierPlanche(pl) {
  const polys = pl.pieces.map(polyPiece); let pen = 0;
  for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) pen = Math.max(pen, penetration(polys[i], polys[j]));
  const xs = polys.flat().map(p => p.x), ys = polys.flat().map(p => p.y);
  // segments de coupe uniques (les cotes communs ne comptent qu'une fois)
  const seg = new Map(); let total = 0;
  polys.forEach(Pg => Pg.forEach((p, i) => { const q = Pg[(i + 1) % Pg.length]; const k = [p, q].map(v => Math.round(v.x * 10) + ',' + Math.round(v.y * 10)).sort().join('|'); total += Math.hypot(q.x - p.x, q.y - p.y); seg.set(k, { p, q, n: (seg.get(k) ? seg.get(k).n : 0) + 1 }); }));
  // aretes colineaires partagees partiellement : on compte la longueur de coupe par union de segments sur chaque droite
  const droites = new Map();
  polys.forEach(Pg => Pg.forEach((p, i) => {
    const q = Pg[(i + 1) % Pg.length]; let a = Math.atan2(q.y - p.y, q.x - p.x); if (a < 0) a += Math.PI; if (a >= Math.PI - 1e-6) a -= Math.PI;
    const n = { x: -Math.sin(a), y: Math.cos(a) }, c = p.x * n.x + p.y * n.y, k = Math.round(a * 1000) + ':' + Math.round(c * 10);
    const t = v => v.x * Math.cos(a) + v.y * Math.sin(a), u = [t(p), t(q)].sort((x, y) => x - y);
    if (!droites.has(k)) droites.set(k, { a, c, iv: [] }); droites.get(k).iv.push(u);
  }));
  let coupe = 0, droitesLongues = 0; const traits = [];
  for (const d of droites.values()) {
    d.iv.sort((x, y) => x[0] - y[0]); const un = [];
    d.iv.forEach(iv => { if (un.length && iv[0] <= un[un.length - 1][1] + 1e-6) un[un.length - 1][1] = Math.max(un[un.length - 1][1], iv[1]); else un.push(iv.slice()); });
    un.forEach(iv => { coupe += iv[1] - iv[0]; if (iv[1] - iv[0] > 1.5 * s + 1) droitesLongues++; traits.push({ a: d.a, c: d.c, t0: iv[0], t1: iv[1] }); });
  }
  return { pen, larg: Math.max(...xs) - Math.min(...xs), haut: Math.max(...ys) - Math.min(...ys), x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys), total, coupe, traits, droitesLongues, nb: polys.length, aire: polys.reduce((t, Pg) => t + Math.abs(aire(Pg)), 0) };
}
function svgPlanche(pl, i) {
  const W = 420, H = 297, v = verifierPlanche(pl), ox = W / 2 - (v.x0 + v.x1) / 2, oy = H / 2 - (v.y0 + v.y1) / 2, o = [];
  // zone imprimable (marges de 10 mm)
  o.push(`<rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="#ccc" stroke-width="0.3" stroke-dasharray="3 2"/>`);
  pl.pieces.forEach(p => {
    const m = PAR_ID[p.id], fond = '#FFFFFF'; // fond blanc : une coupe un peu decalee ne laisse pas de liseré colore
    // les interieures sont tournees de 0 ; pourtour : rotation de la piece
    o.push(svgTuile(m, p.rot, ox + p.x, oy + p.y, { camp: p.camp || 'neutre', fond: m.role === 'interieure' ? '#fff' : fond, contour: 'none', trait: 0 }));
    o.push(txt(ox + p.x, oy + p.y + 2.5, p.id + (m.role === 'interieure' ? '' : ' ' + (p.camp || '')), { fs: 3.2, c: '#555' }));
  });
  // traits de coupe : une ligne par droite (coupes partagees), prolongee de 6 mm dans les marges pour les droites du bord
  v.traits.forEach(t => {
    const ca = Math.cos(t.a), sa = Math.sin(t.a), n = { x: -sa, y: ca };
    const P0 = { x: ox + t.t0 * ca + t.c * n.x, y: oy + t.t0 * sa + t.c * n.y }, P1 = { x: ox + t.t1 * ca + t.c * n.x, y: oy + t.t1 * sa + t.c * n.y };
    o.push(`<line x1="${f(P0.x)}" y1="${f(P0.y)}" x2="${f(P1.x)}" y2="${f(P1.y)}" stroke="#000" stroke-width="0.4"/>`);
  });
  o.push(txt(14, 7.5, pl.nom + ` : ${v.nb} pieces, encombrement ${f(v.larg)} × ${f(v.haut)} mm ; coupes ${Math.round(v.coupe)} mm (contours cumules ${Math.round(v.total)} mm)`, { a: 'start', fs: 3.4 }));
  o.push(txt(W - 14, H - 3.5, 'A3 paysage 420 × 297, echelle 1:1 ; traits fins = coupes au cutter et a la regle ; pointilles = zone imprimable (marges 10 mm)', { a: 'end', fs: 2.8, c: '#666' }));
  return svgDoc(W, H, o.join('\n'));
}

/* ============================== Programme ============================== */
if (require.main === module) {
  const cmd = process.argv[2] || 'controles';
  if (cmd === 'controles') {
    CATALOGUE.concat([REJETE]).forEach(m => {
      const c = controler(m);
      console.log(`${m.id} ${m.nom} (${m.role}, ×${m.ex}) : marge de trace ${c.trace.toFixed(2)} mm | ` + Object.entries(c.mg).map(([k, o]) => `${k} ${o.v.toFixed(2)} (${o.quoi})`).join(' ; '));
      console.log(`   connexions internes ${JSON.stringify(c.deg)} ; ports ${JSON.stringify(c.ports)} ; coins-jonctions ${JSON.stringify(coinsJonction(m.role))}`);
    });
    PLANCHES.forEach(pl => { const v = verifierPlanche(pl); console.log(pl.nom, '| penetration max', v.pen.toFixed(3), '| encombrement', v.larg.toFixed(1), 'x', v.haut.toFixed(1), '| coupes', v.coupe.toFixed(0), 'mm, contours', v.total.toFixed(0), 'mm | droites > 81 mm', v.droitesLongues); });
    const Hx = grandHexagone(); console.log('plateau', (2 * Hx[0].x).toFixed(1), 'x', (8 * s).toFixed(1), 'mm ; cote du grand hexagone', Math.hypot(Hx[1].x - Hx[0].x, Hx[1].y - Hx[0].y).toFixed(1));
    const aires = GR.cellules.reduce((t, c) => t + Math.abs(aire(forme(c.role))), 0), aHex = 3 * S3 / 2 * Math.pow(8 * s / S3, 2);
    console.log('aire des 19 pieces', aires.toFixed(0), 'mm2 ; aire du grand hexagone', aHex.toFixed(0));
  } else if (cmd === 'svg') {
    const fs = require('fs'), path = require('path'), dir = process.argv[3] || '.';
    fs.writeFileSync(path.join(dir, 'catalogue-hex.svg'), planheCatalogue());
    const g1 = generer(+process.argv[4] || 7), g2 = generer(+process.argv[5] || 1234);
    fs.writeFileSync(path.join(dir, 'plateau-hex-1.svg'), svgPlateau(g1, 'Plateau assemble n° 1 : villes « trefle » (0, 4, 8 / 15, 19, 23), 18 campements', 'Tirage ' + g1.choix.join(' ') + ' ; generateur : villes posees d’abord, puis rotations des 7 interieures'));
    fs.writeFileSync(path.join(dir, 'plateau-hex-2.svg'), svgPlateau(g2, 'Plateau assemble n° 2 : villes « trefle », autre tirage', 'Tirage ' + g2.choix.join(' ') + ' ; camps : nord vert, sud rouge, rangee du milieu neutre (coins E et O)'));
    PLANCHES.forEach((pl, i) => fs.writeFileSync(path.join(dir, 'calepinage-A3-' + (i + 1) + '.svg'), svgPlanche(pl, i)));
    console.log('SVG ecrits dans', dir, '| plateau 1', JSON.stringify(g1.mesures), '| plateau 2', JSON.stringify(g2.mesures));
  }
}
module.exports = { S3, s, ri, CATALOGUE, REJETE, PAR_ID, forme, coinsJonction, controler, traces, GR, TREFLE, construire, mesurer, solutions, generer, PLANCHES, verifierPlanche, alea };
