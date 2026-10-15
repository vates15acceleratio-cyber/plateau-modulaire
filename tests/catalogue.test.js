'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/catalogue.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;
const CAT = globalThis.PM.catalogue;

/* ====================================================================== */
/* Outils de simulation                                                    */
/* ====================================================================== */

/** Générateur pseudo-aléatoire reproductible (mulberry32), valeurs dans [0, 1). */
function mulberry32(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function melanger(t, rng) {
  t = t.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

/**
 * Plateau 4x4 complet tiré au hasard dans le stock du catalogue : modèles tirés
 * sans remise selon les exemplaires de chaque rôle, rotation aléatoire des centrales.
 * Utilise poserTuile / tournerTuile (rotation déduite pour les autres rôles).
 */
function tirerPlateau(rng) {
  let doc = CAT.nouveauDocument();
  const stock = {};
  for (const m of doc.modeles) {
    stock[m.role] = stock[m.role] || [];
    for (let k = 0; k < m.exemplaires; k++) stock[m.role].push(m.id);
  }
  for (const r of Object.keys(stock)) stock[r] = melanger(stock[r], rng);
  for (const c of M.cellulesActives(doc.plateau.forme)) {
    const role = M.roleCellule(c.col, c.lig, doc.plateau.forme);
    doc = M.poserTuile(doc, stock[role].pop(), c.col, c.lig);
    if (role === 'centrale') {
      const r = Math.floor(rng() * 4);
      if (r) doc = M.tournerTuile(doc, c.col, c.lig, r);
    }
  }
  return doc;
}

/**
 * UTILITAIRE DE GRAPHE GLOBAL (provisoire, en attendant src/graphe.js du sous-agent 7).
 *
 * construireGraphe(doc, carrefours = [], filtreTuile = null) ->
 *   { voisins: Map<id, Set<id>>, cases: Map<id, case>, jonctions: Map<id, jonction>, apparitions: [{ id, joueur }] }
 *  - noeuds : les cases des tuiles posées (ids globaux « col,lig:idLocal » de tuileEnPlateau)
 *    et un noeud « J<i>,<j> » par jonction qui reçoit au moins un port ;
 *  - arêtes : chemins case-case internes ; une arête par raccord connecté face à face
 *    (raccord (cote, pos) contre raccordEnFace(cote, pos) du voisin) ; jonction - case porteuse du port ;
 *  - jonction : { id, i, j, ports, type: 'carrefour' si (i, j) figure dans `carrefours`, sinon 'capture' } ;
 *  - filtreTuile(tuile) -> booléen : ne garde que certaines tuiles (sous-graphes).
 * Hypothèse : villes et carrefours sont traversables par les plus courts chemins.
 */
function construireGraphe(doc, carrefours, filtreTuile) {
  carrefours = carrefours || [];
  const voisins = new Map(), cases = new Map(), jonctions = new Map(), parRaccord = new Map();
  const noeud = (id) => { if (!voisins.has(id)) voisins.set(id, new Set()); };
  const lier = (a, b) => { voisins.get(a).add(b); voisins.get(b).add(a); };
  const elems = doc.plateau.tuiles
    .filter((t) => !filtreTuile || filtreTuile(t))
    .map((t) => ({ t, e: M.tuileEnPlateau(doc, t) }));
  for (const { e } of elems) for (const c of e.cases) { cases.set(c.id, c); noeud(c.id); }
  for (const { e } of elems) for (const [a, b] of e.aretes) lier(a, b);
  for (const { t, e } of elems) for (const r of e.raccords) parRaccord.set(`${t.col},${t.lig},${r.cote},${r.pos}`, r.caseId);
  for (const { t, e } of elems) {
    for (const r of e.raccords) {
      const d = G.coteVoisin(r.cote), f = G.raccordEnFace(r.cote, r.pos);
      const autre = parRaccord.get(`${t.col + d.dc},${t.lig + d.dl},${f.cote},${f.pos}`);
      if (autre) lier(r.caseId, autre);
    }
  }
  for (const { e } of elems) {
    for (const p of e.ports) {
      const id = `J${p.i},${p.j}`;
      noeud(id);
      if (!jonctions.has(id)) {
        const carrefour = carrefours.some((c) => c.i === p.i && c.j === p.j);
        jonctions.set(id, { id, i: p.i, j: p.j, ports: 0, type: carrefour ? 'carrefour' : 'capture' });
      }
      jonctions.get(id).ports++;
      lier(id, p.caseId);
    }
  }
  const apparitions = [...cases.values()].filter((c) => c.type === 'apparition').map((c) => ({ id: c.id, joueur: c.joueur }));
  return { voisins, cases, jonctions, apparitions };
}

/** Distances en pas (parcours en largeur) depuis un ensemble de noeuds sources : Map<id, pas>. */
function distances(g, sources) {
  const d = new Map();
  let file = [];
  for (const s of sources) if (g.voisins.has(s)) { d.set(s, 0); file.push(s); }
  while (file.length) {
    const suivants = [];
    for (const x of file) for (const y of g.voisins.get(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); suivants.push(y); }
    file = suivants;
  }
  return d;
}

/**
 * Équilibre selon D6 (1b) : distance de chaque ville à l'apparition la plus proche de chaque
 * joueur, 7 distances triées ; écart = plus grand écart aux rangs 1 à 4.
 * plus1 / plus2 : villes strictement plus proches de J1 / J2 (alerte secondaire à 5 contre 2).
 */
function equilibre(g) {
  const villes = [...g.jonctions.values()].filter((j) => j.type === 'capture');
  const dist = [1, 2].map((p) => {
    const d = distances(g, g.apparitions.filter((a) => a.joueur === p).map((a) => a.id));
    return villes.map((v) => d.get(v.id));
  });
  const tri = dist.map((t) => t.slice().sort((a, b) => a - b));
  let ecart = 0;
  for (let r = 0; r < 4; r++) ecart = Math.max(ecart, Math.abs(tri[0][r] - tri[1][r]));
  let plus1 = 0, plus2 = 0;
  villes.forEach((v, k) => { if (dist[0][k] < dist[1][k]) plus1++; else if (dist[1][k] < dist[0][k]) plus2++; });
  return { ecart, plus1, plus2, nbVilles: villes.length };
}

/**
 * Autoroutes de flanc (D4 de 1b) : pour chaque joueur, distance de ses apparitions à la
 * jonction adverse la plus proche (ligne j = 3 pour J1, j = 1 pour J2), dans le sous-graphe
 * « flancs » (colonnes 0 et 3 + apparitions) et dans le sous-graphe « centre » (colonnes 1 et 2).
 */
function mesureFlancs(doc) {
  const forme = doc.plateau.forme;
  const flanc = (t) => t.col === 0 || t.col === 3 || M.roleCellule(t.col, t.lig, forme) === 'apparition';
  const centre = (t) => t.col === 1 || t.col === 2;
  return [1, 2].map((p) => {
    const cible = p === 1 ? 3 : 1;
    const mesure = (filtre) => {
      const g = construireGraphe(doc, [], filtre);
      const d = distances(g, g.apparitions.filter((a) => a.joueur === p).map((a) => a.id));
      let m = Infinity;
      for (const j of g.jonctions.values()) if (j.j === cible && d.has(j.id)) m = Math.min(m, d.get(j.id));
      return m;
    };
    return { flanc: mesure(flanc), centre: mesure(centre) };
  });
}

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

const NORMALE = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }]; // vers l'intérieur, par côté
const BISSECTRICE = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }]
  .map((v) => ({ x: v.x / Math.SQRT2, y: v.y / Math.SQRT2 }));      // vers l'intérieur, par coin
const AMORCE_RACCORD = 10;  // D7 : segment perpendiculaire d'au moins 10 mm au raccord
const AMORCE_PORT = 28;     // port sur la bissectrice jusqu'au-delà de la zone de coin (20 mm) + demi-chemin

/**
 * Tracé simplifié de chaque chemin : lien case-case = segment ; raccord = amorce perpendiculaire
 * de 10 mm puis segment vers la case ; port = amorce sur la bissectrice puis segment vers la case.
 */
function traces(m) {
  const cs = new Map(m.cases.map((c) => [c.id, c]));
  return m.chemins.map((ch) => {
    const ext = [ch.a, ch.b];
    const cases = ext.filter((e) => e['case'] !== undefined).map((e) => cs.get(e['case']));
    if (cases.length === 2) return { id: ch.id, type: 'lien', cases, pts: [cases[0], cases[1]] };
    const o = ext.find((e) => e['case'] === undefined), c = cases[0];
    if (o.raccord) {
      const P = G.pointRaccord(o.raccord.cote, o.raccord.pos), n = NORMALE[o.raccord.cote];
      return { id: ch.id, type: 'raccord', cases, pts: [P, { x: P.x + AMORCE_RACCORD * n.x, y: P.y + AMORCE_RACCORD * n.y }, c] };
    }
    const K = G.pointCoin(o.coin), b = BISSECTRICE[o.coin];
    return { id: ch.id, type: 'port', coin: o.coin, cases, pts: [K, { x: K.x + AMORCE_PORT * b.x, y: K.y + AMORCE_PORT * b.y }, c] };
  });
}

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

/* ====================================================================== */
/* Catalogue : contenu et validité                                         */
/* ====================================================================== */

const IDS_ATTENDUS = {
  centrale: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
  coin: ['K1', 'K2', 'K3', 'K4', 'K5'],
  bord: ['B1', 'B2', 'B3', 'B4', 'B5'],
  apparition: ['A1', 'A2']
};

test('catalogue : version 1, 18 modèles, ids attendus et uniques', () => {
  assert.strictEqual(CAT.version, 1);
  assert.strictEqual(CAT.modeles.length, 18);
  const ids = CAT.modeles.map((m) => m.id);
  assert.strictEqual(new Set(ids).size, 18);
  for (const role of Object.keys(IDS_ATTENDUS)) {
    assert.deepStrictEqual(CAT.modeles.filter((m) => m.role === role).map((m) => m.id), IDS_ATTENDUS[role], role);
  }
});

test('catalogue : les 18 modèles passent validerModele sans erreur', () => {
  for (const m of CAT.modeles) assert.deepStrictEqual(M.validerModele(m).erreurs, [], m.id);
});

test('catalogue : rôles, exemplaires et 20 tuiles physiques', () => {
  const parRole = {};
  for (const m of CAT.modeles) {
    parRole[m.role] = (parRole[m.role] || 0) + m.exemplaires;
    assert.strictEqual(m.exemplaires, m.role === 'apparition' ? 2 : 1, m.id);
  }
  assert.deepStrictEqual(parRole, { centrale: 6, coin: 5, bord: 5, apparition: 4 });
  assert.strictEqual(CAT.modeles.reduce((s, m) => s + m.exemplaires, 0), 20);
});

test('catalogue : noms courts, ids de cases et de chemins en chaînes', () => {
  for (const m of CAT.modeles) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 20, m.id);
    for (const el of m.cases.concat(m.chemins)) assert.strictEqual(typeof el.id, 'string', m.id);
  }
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.nom)).size, 18); // bibliothèque commune : noms tous distincts
});

test('catalogue : profils de raccords (pos 1 partout, variantes recensées)', () => {
  // Variantes voulues : tout autre écart au profil « pos 1 sur chaque côté intérieur » est une régression.
  const variantes = { C2: { 3: 0b011 }, C6: { 3: 0b000 }, K4: { 1: 0b110 }, B5: { 3: 0b011 } };
  for (const m of CAT.modeles) {
    const r = M.masquesDuModele(m).raccords;
    for (let cote = 0; cote < 4; cote++) {
      const exterieur = M.COTES_EXTERIEURS[m.role].includes(cote);
      const attendu = exterieur ? 0 : (variantes[m.id] && variantes[m.id][cote] !== undefined ? variantes[m.id][cote] : 0b010);
      assert.strictEqual(G.triplet(r, cote), attendu, `${m.id} côté ${cote}`);
    }
  }
});

test('catalogue : chaque case d\'apparition touche les deux cases à port', () => {
  for (const m of CAT.modeles.filter((x) => x.role === 'apparition')) {
    const sp = m.cases.find((c) => c.type === 'apparition').id;
    const voisins = m.chemins.filter((ch) => ch.a['case'] === sp || ch.b['case'] === sp)
      .map((ch) => (ch.a['case'] === sp ? ch.b['case'] : ch.a['case'])).filter(Boolean);
    const aPort = m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']);
    assert.deepStrictEqual(aPort.filter((c) => voisins.includes(c)).sort(), aPort.slice().sort(), m.id);
    assert.ok(!aPort.includes(sp), m.id + ' : la case d\'apparition ne porte pas de port');
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

test('variété : aucune centrale n\'est la copie tournée d\'une autre, aucun doublon par rôle', () => {
  const centrales = CAT.modeles.filter((m) => m.role === 'centrale');
  for (let i = 0; i < centrales.length; i++) {
    for (let j = i + 1; j < centrales.length; j++) {
      for (let rot = 0; rot < 4; rot++) {
        assert.notStrictEqual(signature(centrales[i], rot), signature(centrales[j], 0), `${centrales[i].id} tourné = ${centrales[j].id}`);
      }
    }
  }
  // les 6 centrales ont 6 routages internes différents (anneau, U, Z, étoile, patte, losange) :
  // nombre de liens, degrés des cases, nombre de diagonales (liens entre coins opposés)
  const formes = centrales.map((m) => {
    const deg = new Map(m.cases.map((c) => [c.id, 0]));
    const coin = new Map(m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => [ch.a['case'], ch.b.coin]));
    const liens = m.chemins.filter((ch) => ch.b['case'] !== undefined);
    for (const ch of liens) { deg.set(ch.a['case'], deg.get(ch.a['case']) + 1); deg.set(ch.b['case'], deg.get(ch.b['case']) + 1); }
    const diagonales = liens.filter((ch) => Math.abs(coin.get(ch.a['case']) - coin.get(ch.b['case'])) === 2).length;
    return liens.length + ':' + [...deg.values()].sort().join('') + ':' + diagonales;
  });
  assert.strictEqual(new Set(formes).size, 6, formes.join(' '));
  for (const role of ['coin', 'bord', 'apparition']) {
    const sigs = CAT.modeles.filter((m) => m.role === role).map((m) => signature(m, 0));
    assert.strictEqual(new Set(sigs).size, sigs.length, role);
  }
});

test('tracés : pas de chemin sur une case, dans une zone de coin, ou contre un autre chemin', () => {
  const pb = [].concat(...CAT.modeles.map(problemesTrace));
  assert.deepStrictEqual(pb, []);
});

test('tracés : le contrôle détecte un chemin qui traverse une case (témoin)', () => {
  const m = JSON.parse(JSON.stringify(CAT.modeles.find((x) => x.id === 'C1')));
  m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c3' } }); // diagonale NO-SE : croise rien
  m.chemins.push({ id: 'y', a: { 'case': 'c2' }, b: { 'case': 'c4' } }); // diagonale NE-SO : croise x
  assert.ok(problemesTrace(m).some((t) => t.includes('x et y se touchent')));
  m.cases.push({ id: 'c5', x: 60, y: 60, diametre: 24, type: 'deplacement' });
  assert.ok(problemesTrace(m).some((t) => t.includes('de c5')));
});

/* ====================================================================== */
/* Document                                                                */
/* ====================================================================== */

test('nouveauDocument : document vide avec une copie modifiable des 18 modèles', () => {
  const doc = CAT.nouveauDocument();
  const vide = M.nouveauDocument();
  assert.deepStrictEqual(doc.plateau, vide.plateau);
  assert.strictEqual(doc.version, vide.version);
  assert.deepStrictEqual(doc.modeles, JSON.parse(JSON.stringify(CAT.modeles)));
  assert.ok(Object.isFrozen(CAT.modeles) && Object.isFrozen(CAT.modeles[0].cases[0]));
  doc.modeles[0].cases[0].x = 1;
  doc.modeles.pop();
  assert.strictEqual(CAT.modeles[0].cases[0].x, 36);
  assert.strictEqual(CAT.modeles.length, 18);
  assert.notStrictEqual(CAT.nouveauDocument().modeles, CAT.nouveauDocument().modeles);
});

test('nouveauDocument : un plateau complet se pose et se valide sans erreur', () => {
  const doc = tirerPlateau(mulberry32(1));
  assert.strictEqual(doc.plateau.tuiles.length, 16);
  const v = M.validerPlateau(doc);
  assert.deepStrictEqual(v.erreurs, []);
  assert.ok(v.alertes.every((a) => a.code === 'raccord_mort'));
});

/* ====================================================================== */
/* Simulation de plateaux aléatoires                                       */
/* ====================================================================== */

const NB_PLATEAUX = 1000;
const GRAINE = 20261015;
const CARREFOURS = {
  milieu: [{ i: 1, j: 2 }, { i: 3, j: 2 }],          // placement principal : ligne du milieu
  unParCamp: [{ i: 2, j: 1 }, { i: 2, j: 3 }]       // variante : un carrefour près de chaque joueur
};
const JONCTIONS = [];
for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) JONCTIONS.push({ i, j });

function moyenne(t) { return t.reduce((a, b) => a + b, 0) / t.length; }
function histogramme(t) { return t.reduce((h, x) => { h[x] = (h[x] || 0) + 1; return h; }, {}); }

/** Simulation unique, partagée par les tests ci-dessous. */
const SIM = (function simuler() {
  const rng = mulberry32(GRAINE);
  const s = {
    morts: [], nonConnexes: 0, nonConnexesSansPorts: 0, jonctionsSans4Ports: 0, distMinJonctions: Infinity, nbCases: new Set(),
    sortiesMin: Infinity, autoroutes: 0, flancMoins: [], ecarts: { milieu: [], unParCamp: [] },
    cinqDeux: { milieu: 0, unParCamp: 0 }, distApparition: { A1: [], A2: [] }
  };
  for (let n = 0; n < NB_PLATEAUX; n++) {
    const doc = tirerPlateau(rng);
    s.morts.push(M.raccordsMorts(doc).length);
    for (const jn of JONCTIONS) if (M.portsJonction(doc, jn.i, jn.j).ports !== 4) s.jonctionsSans4Ports++;

    const g = construireGraphe(doc, CARREFOURS.milieu);
    if (distances(g, [g.voisins.keys().next().value]).size !== g.voisins.size) s.nonConnexes++;
    // connexité par les seuls raccords et chemins internes (jonctions retirées) : juge les raccords latéraux
    const sansJonctions = { voisins: new Map([...g.voisins].filter(([id]) => !id.startsWith('J'))
      .map(([id, v]) => [id, new Set([...v].filter((x) => !x.startsWith('J')))])) };
    if (distances(sansJonctions, [g.cases.keys().next().value]).size !== g.cases.size) s.nonConnexesSansPorts++;
    if (g.jonctions.size !== 9) s.jonctionsSans4Ports++;
    for (const j of g.jonctions.values()) if (j.ports !== 4) s.jonctionsSans4Ports++;
    const js = [...g.jonctions.values()];
    for (const a of js) {
      const d = distances(g, [a.id]);
      for (const b of js) if (b !== a) s.distMinJonctions = Math.min(s.distMinJonctions, d.get(b.id));
    }
    const deplacement = [...g.cases.values()].filter((c) => c.type === 'deplacement').length;
    s.nbCases.add(deplacement + CARREFOURS.milieu.length);
    for (const a of g.apparitions) s.sortiesMin = Math.min(s.sortiesMin, g.voisins.get(a.id).size);

    for (const cle of Object.keys(CARREFOURS)) {
      const e = equilibre(cle === 'milieu' ? g : construireGraphe(doc, CARREFOURS[cle]));
      assert.strictEqual(e.nbVilles, 7);
      s.ecarts[cle].push(e.ecart);
      if (Math.max(e.plus1, e.plus2) >= 5) s.cinqDeux[cle]++;
    }
    for (const f of mesureFlancs(doc)) {
      if (f.flanc < f.centre) s.autoroutes++;
      s.flancMoins.push(f.flanc - f.centre);
    }
    // distances triées de chaque case d'apparition aux 9 jonctions, par modèle
    for (const t of doc.plateau.tuiles) {
      if (M.roleCellule(t.col, t.lig, doc.plateau.forme) !== 'apparition') continue;
      const sp = g.apparitions.find((a) => a.id.startsWith(`${t.col},${t.lig}:`));
      const d = distances(g, [sp.id]);
      s.distApparition[t.modeleId].push(js.map((j) => d.get(j.id)).sort((a, b) => a - b));
    }
  }
  const profil = (k) => s.distApparition[k][0].map((_, r) => moyenne(s.distApparition[k].map((t) => t[r])));
  s.profilA1 = profil('A1');
  s.profilA2 = profil('A2');

  const f2 = (x) => x.toFixed(2);
  console.log(`\n[catalogue] simulation de ${NB_PLATEAUX} plateaux 4x4 (graine ${GRAINE})`);
  console.log(`  raccords morts : moyenne ${f2(moyenne(s.morts))}, max ${Math.max(...s.morts)}, répartition ${JSON.stringify(histogramme(s.morts))}`);
  console.log(`  non connexes : ${s.nonConnexes} ; jonctions sans 4 ports : ${s.jonctionsSans4Ports} ; écart min entre jonctions : ${s.distMinJonctions} pas ; cases de déplacement : ${[...s.nbCases]}`);
  console.log(`  non connexes par les seuls raccords (jonctions retirées) : ${s.nonConnexesSansPorts}`);
  console.log(`  sorties min d'une case d'apparition : ${s.sortiesMin}`);
  for (const cle of Object.keys(CARREFOURS)) {
    const e = s.ecarts[cle];
    console.log(`  D6 carrefours ${JSON.stringify(CARREFOURS[cle])} : écart moyen ${f2(moyenne(e))}, pire ${Math.max(...e)}, ` +
      `alertes (> 2) ${e.filter((x) => x > 2).length}, répartition ${JSON.stringify(histogramme(e))}, alertes 5 contre 2 : ${s.cinqDeux[cle]}`);
  }
  console.log(`  flancs plus courts que le centre : ${s.autoroutes} / ${2 * NB_PLATEAUX} ; flanc - centre moyen ${f2(moyenne(s.flancMoins))} pas`);
  console.log(`  distances triées moyennes apparition -> 9 jonctions : A1 ${s.profilA1.map(f2).join(' ')} | A2 ${s.profilA2.map(f2).join(' ')}`);
  return s;
})();

test('simulation : graphe connexe, 9 jonctions à 4 ports, 50 cases de déplacement', () => {
  assert.strictEqual(SIM.nonConnexes, 0);
  assert.strictEqual(SIM.jonctionsSans4Ports, 0);
  assert.deepStrictEqual([...SIM.nbCases], [50]);
});

test('simulation : les raccords latéraux relient à eux seuls toutes les cases (sans les jonctions)', () => {
  assert.strictEqual(SIM.nonConnexesSansPorts, 0);
});

test('simulation : au moins 3 pas entre deux jonctions quelconques', () => {
  assert.ok(SIM.distMinJonctions >= G.ECART_MIN_CAPTURES, String(SIM.distMinJonctions));
});

test('simulation : chaque case d\'apparition a au moins 2 sorties', () => {
  assert.ok(SIM.sortiesMin >= 2, String(SIM.sortiesMin));
});

test('simulation : peu de raccords morts (moyenne <= 3, max <= 4 ; mesuré 2,8 et 4)', () => {
  assert.ok(moyenne(SIM.morts) <= 3, String(moyenne(SIM.morts)));
  assert.ok(Math.max(...SIM.morts) <= 4, String(Math.max(...SIM.morts)));
});

test('simulation : équilibre D6, aucun écart supérieur à 2 aux rangs 1 à 4', () => {
  for (const cle of Object.keys(CARREFOURS)) {
    assert.ok(Math.max(...SIM.ecarts[cle]) <= 2, cle);
  }
  assert.strictEqual(SIM.cinqDeux.milieu, 0);
});

test('simulation : pas d\'autoroute de flanc vers le camp adverse', () => {
  assert.strictEqual(SIM.autoroutes, 0);
});

test('simulation : les 2 modèles d\'apparition donnent des distances comparables (écart <= 0,5 par rang)', () => {
  for (let r = 0; r < 9; r++) {
    assert.ok(Math.abs(SIM.profilA1[r] - SIM.profilA2[r]) <= 0.5, `rang ${r + 1} : ${SIM.profilA1[r]} / ${SIM.profilA2[r]}`);
  }
});
