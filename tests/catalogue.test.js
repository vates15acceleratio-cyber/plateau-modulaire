'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/catalogue.js');
require('../src/rendu.js');
require('../src/graphe.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;
const CAT = globalThis.PM.catalogue;
const GR = globalThis.PM.graphe;
const R = globalThis.PM.rendu;

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
 * Graphe global : PM.graphe (src/graphe.js). Les jonctions reçoivent les 9 jetons d'une paire de carrefours.
 *  - structure (connexité, écart entre jonctions, sorties des apparitions) : villes traversables, comme le
 *    contrôle « villes trop proches » du générateur ;
 *  - équilibre : critère de docs/16 (villes non traversables, écart et S sur les rangs 1 à 7, « 5 contre 2 »).
 */
function jetons9(carrefours) {
  return JONCTIONS.map((jn) => ({ i: jn.i, j: jn.j, type: carrefours.some((c) => c.i === jn.i && c.j === jn.j) ? 'carrefour' : 'capture' }));
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
  // Seule variante voulue : le côté ouest vide de C6 (« mur », docs/9-validation-catalogue.md).
  // Tout autre écart au profil « pos 1 sur chaque côté intérieur » est une régression.
  const variantes = { C6: { 3: 0b000 } };
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
    sortiesMin: Infinity, autoroutes: 0, flancsInfinis: 0, flancMoins: [], ecarts: { milieu: [], unParCamp: [] },
    scores: { milieu: [], unParCamp: [] }, cinqDeux: { milieu: 0, unParCamp: 0 }, premiereInegale: { milieu: 0, unParCamp: 0 },
    distApparition: { A1: [], A2: [] }
  };
  for (let n = 0; n < NB_PLATEAUX; n++) {
    const doc = tirerPlateau(rng);
    s.morts.push(M.raccordsMorts(doc).length);
    for (const jn of JONCTIONS) if (M.portsJonction(doc, jn.i, jn.j).ports !== 4) s.jonctionsSans4Ports++;

    const g = GR.construire(doc, { jetons: jetons9(CARREFOURS.milieu), villesTraversables: true });
    if (GR.distances(g, g.noeuds[0]).size !== g.noeuds.length) s.nonConnexes++;
    // connexité par les seuls raccords et chemins internes (aucun jeton, donc aucune jonction) : juge les raccords latéraux
    const sansJonctions = GR.construire(doc, { jetons: [], villesTraversables: true });
    if (GR.distances(sansJonctions, sansJonctions.noeuds[0]).size !== sansJonctions.noeuds.length) s.nonConnexesSansPorts++;
    if (g.jonctions.length !== 9) s.jonctionsSans4Ports++;
    for (const j of g.jonctions) if (j.ports !== 4) s.jonctionsSans4Ports++;
    for (const a of g.jonctions) {
      const d = GR.distances(g, a.id);
      for (const b of g.jonctions) if (b !== a) s.distMinJonctions = Math.min(s.distMinJonctions, d.has(b.id) ? d.get(b.id) : Infinity);
    }
    const deplacement = [...g.cases.values()].filter((c) => c.type === 'deplacement').length;
    s.nbCases.add(deplacement + CARREFOURS.milieu.length);
    for (const p of [1, 2]) for (const id of g.apparitions[p]) s.sortiesMin = Math.min(s.sortiesMin, g.voisins.get(id).size);

    for (const cle of Object.keys(CARREFOURS)) {
      const e = GR.equilibre(doc, { jetons: jetons9(CARREFOURS[cle]) }); // villes non traversables (défaut)
      assert.strictEqual(e.villes.length, 7);
      assert.strictEqual(e.complet, true);
      s.ecarts[cle].push(e.ecartMax7 === null ? Infinity : e.ecartMax7);
      s.scores[cle].push(e.S === null ? Infinity : e.S);
      if (e.cinqContreDeux) s.cinqDeux[cle]++;
      if (!e.premiereEgale) s.premiereInegale[cle]++;
    }
    for (const f of GR.flancs(doc, { villesTraversables: true })) {
      if (!Number.isFinite(f.flanc) || !Number.isFinite(f.centre)) s.flancsInfinis++;
      if (f.flanc < f.centre) s.autoroutes++;
      s.flancMoins.push(f.flanc - f.centre);
    }
    // distances triées de chaque case d'apparition aux 9 jonctions, par modèle
    for (const t of doc.plateau.tuiles) {
      if (M.roleCellule(t.col, t.lig, doc.plateau.forme) !== 'apparition') continue;
      const sp = g.apparitions[1].concat(g.apparitions[2]).find((id) => id.startsWith(`${t.col},${t.lig}:`));
      const d = GR.distances(g, sp);
      s.distApparition[t.modeleId].push(g.jonctions.map((j) => d.get(j.id)).sort((a, b) => a - b));
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
    console.log(`  docs/16 (non traversables, rangs 1 à 7) carrefours ${JSON.stringify(CARREFOURS[cle])} : écart moyen ${f2(moyenne(e))}, pire ${Math.max(...e)}, ` +
      `alertes (> 2) ${e.filter((x) => x > 2).length}, répartition ${JSON.stringify(histogramme(e))}, 5 contre 2 : ${s.cinqDeux[cle]}, ` +
      `première ville inégale : ${s.premiereInegale[cle]}, S moyen ${f2(moyenne(s.scores[cle]))}, S >= 4 : ${s.scores[cle].filter((x) => x >= 4).length}`);
  }
  console.log(`  flancs plus courts que le centre : ${s.autoroutes} / ${2 * NB_PLATEAUX} ; flanc - centre moyen ${f2(moyenne(s.flancMoins))} pas ; mesures infinies : ${s.flancsInfinis}`);
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

test('simulation : peu de raccords morts (moyenne <= 1,5, max <= 2)', () => {
  assert.ok(moyenne(SIM.morts) <= 1.5, String(moyenne(SIM.morts)));
  assert.ok(Math.max(...SIM.morts) <= 2, String(Math.max(...SIM.morts)));
});

/*
 * Critère de docs/16 (villes non traversables, rangs 1 à 7) sur des plateaux tirés sans filtre : quelques écarts
 * de 3 subsistent (mesuré : 0,9 % au milieu, 1,6 % un par camp ; le générateur les élimine). Seuils : jamais
 * plus de 3, au plus 2 % (milieu) et 3 % (un par camp) au-delà de 2 ; « 5 contre 2 » nul au milieu, ≤ 6 % un par
 * camp (mesuré 4,5 %, comme docs/12) ; première ville toujours à égalité (invariant d).
 */
test('simulation : équilibre (docs/16), écarts rares et bornés, pas de « 5 contre 2 » au milieu, première ville égale', () => {
  const plafond = { milieu: 0.02, unParCamp: 0.03 };
  for (const cle of Object.keys(CARREFOURS)) {
    assert.ok(Math.max(...SIM.ecarts[cle]) <= 3, cle);
    assert.ok(SIM.ecarts[cle].filter((x) => x > 2).length <= plafond[cle] * NB_PLATEAUX, cle);
    assert.strictEqual(SIM.premiereInegale[cle], 0, cle);
  }
  assert.strictEqual(SIM.cinqDeux.milieu, 0);
  assert.ok(SIM.cinqDeux.unParCamp <= 0.06 * NB_PLATEAUX, String(SIM.cinqDeux.unParCamp));
});

test('simulation : pas d\'autoroute de flanc vers le camp adverse', () => {
  assert.strictEqual(SIM.autoroutes, 0);
  assert.strictEqual(SIM.flancsInfinis, 0); // mesure réelle (villes traversables), jamais Infinity < Infinity
});

test('simulation : les 2 modèles d\'apparition donnent des distances comparables (écart <= 0,5 par rang)', () => {
  for (let r = 0; r < 9; r++) {
    assert.ok(Math.abs(SIM.profilA1[r] - SIM.profilA2[r]) <= 0.5, `rang ${r + 1} : ${SIM.profilA1[r]} / ${SIM.profilA2[r]}`);
  }
});
