'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
require('../src/equilibre.js');
const A = require('./aides-v2.js');
const M = globalThis.PM.modele;
const GR = globalThis.PM.graphe;
const EQ = globalThis.PM.equilibre;
const CAT = globalThis.PM.catalogue;

/* ---------------------------------------------------------------------- */
/* Outils                                                                  */
/* ---------------------------------------------------------------------- */

/** Générateur pseudo-aléatoire reproductible (copie de tests/catalogue.test.js : même suite de tirages). */
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
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}
/**
 * Plateau 4×4 plein tiré dans le catalogue (version 2) : tuiles par
 * gabarit, rotation suggérée sur le pourtour, aléatoire au centre.
 */
function tirerPlateau(rng) {
  let doc = CAT.nouveauDocument();
  const stock = {}, F = M.formatDuDocument(doc);
  for (const m of doc.modeles) {
    stock[m.gabarit] = stock[m.gabarit] || [];
    for (let k = 0; k < m.exemplaires; k++) stock[m.gabarit].push(m.id);
  }
  for (const r of Object.keys(stock)) stock[r] = melanger(stock[r], rng);
  for (let lig = 0; lig < 4; lig++) {
    for (let col = 0; col < 4; col++) {
      const g = M.gabaritCellule(col, lig, F);
      doc = M.poserTuile(doc, stock[g].pop(), col, lig);
      if (g === 'centrale') { const r = Math.floor(rng() * 4); if (r) doc = M.tournerTuile(doc, col, lig, r); }
    }
  }
  return doc;
}

/** 7 villes : toutes les jonctions sauf `cases` (jonctions laissées en cases chemin). */
function villes7(cases) {
  const res = [];
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) {
    if (!cases.some((c) => c.i === i && c.j === j)) res.push({ i, j, type: 'capture' });
  }
  return res;
}
const MILIEU = [{ i: 1, j: 2 }, { i: 3, j: 2 }];

/* --- Oracle indépendant : copie de l'ancien utilitaire provisoire de tests/catalogue.test.js (construireGraphe, distances, equilibre) --- */
const G = globalThis.PM.geometrie;
function oracleGraphe(doc, casesJonction) {
  const voisins = new Map(), jonctions = new Map(), parRaccord = new Map();
  const noeud = (id) => { if (!voisins.has(id)) voisins.set(id, new Set()); };
  const lier = (a, b) => { voisins.get(a).add(b); voisins.get(b).add(a); };
  const elems = doc.plateau.tuiles.map((t) => ({ t, e: M.tuileEnPlateau(doc, t) }));
  for (const { e } of elems) for (const c of e.cases) noeud(c.id);
  for (const { e } of elems) for (const [a, b] of e.aretes) lier(a, b);
  for (const { t, e } of elems) for (const r of e.raccords) parRaccord.set(`${t.col},${t.lig},${r.cote},${r.pos}`, r.caseId);
  for (const { t, e } of elems) {
    for (const r of e.raccords) {
      const d = G.coteVoisin(r.cote), f = G.raccordEnFace(r.cote, r.pos);
      const autre = parRaccord.get(`${t.col + d.dc},${t.lig + d.dl},${f.cote},${f.pos}`);
      if (autre) lier(r.caseId, autre);
    }
  }
  // passages sans case (docs/18, docs/39), écrit sans PM.graphe : les passages relient des points (pivots, emplacements de raccord ;
  // deux emplacements face à face sont un même point) en réseaux ; une case s'y RATTACHE (bout de passage, ou chemin qui aboutit face à
  // un passage) sans jamais fondre deux réseaux ; les cases rattachées à un même réseau sont voisines deux à deux (1 pas)
  const reseau = new Map(), rattache = [];
  const groupe = (x) => { if (!reseau.has(x)) reseau.set(x, new Set([x])); return reseau.get(x); };
  const fondre = (a, b) => { const ra = groupe(a), rb = groupe(b); if (ra === rb) return; for (const x of rb) { ra.add(x); reseau.set(x, ra); } };
  const slot = (t, cote, pos) => `S${t.col},${t.lig},${cote},${pos}`;
  const slots = [];
  for (const { t, e } of elems) for (const p of e.passages || []) {
    const point = (x) => x.pivot !== undefined ? 'P' + x.pivot : (x.raccord ? (slots.push({ t, cote: x.raccord.cote, pos: x.raccord.pos }), slot(t, x.raccord.cote, x.raccord.pos)) : null);
    const pa = point(p.a), pb = point(p.b);
    if (pa && pb) fondre(pa, pb);
    else if (pa) { groupe(pa); rattache.push([p.b['case'], pa]); }
    else if (pb) { groupe(pb); rattache.push([p.a['case'], pb]); }
  }
  for (const s0 of slots) {
    const d = G.coteVoisin(s0.cote), f = G.raccordEnFace(s0.cote, s0.pos), face = slot({ col: s0.t.col + d.dc, lig: s0.t.lig + d.dl }, f.cote, f.pos);
    if (reseau.has(face)) fondre(slot(s0.t, s0.cote, s0.pos), face);
  }
  for (const { t, e } of elems) for (const r of e.raccords) {
    const d = G.coteVoisin(r.cote), f = G.raccordEnFace(r.cote, r.pos), face = slot({ col: t.col + d.dc, lig: t.lig + d.dl }, f.cote, f.pos);
    if (reseau.has(face)) rattache.push([r.caseId, face]);
  }
  const membres = new Map();
  for (const [c, x] of rattache) { const r = reseau.get(x); if (!membres.has(r)) membres.set(r, new Set()); membres.get(r).add(c); }
  for (const cs0 of membres.values()) {
    const cs = [...cs0].filter((id) => voisins.has(id));
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) lier(cs[a], cs[b]);
  }
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) {
    const id = `J${i},${j}`;
    noeud(id);
    jonctions.set(id, { id, type: casesJonction.some((c) => c.i === i && c.j === j) ? 'case' : 'ville' });
  }
  for (const { e } of elems) for (const p of e.ports) if (p.i >= 1 && p.i <= 3 && p.j >= 1 && p.j <= 3) lier(`J${p.i},${p.j}`, p.caseId);
  const apparitions = [];
  for (const { e } of elems) for (const c of e.cases) if (c.type === 'apparition' && c.camp) apparitions.push({ id: c.id, joueur: c.camp === 'vert' ? 1 : 2 });
  return { voisins, jonctions, apparitions };
}
function oracleDistances(g, sources) {
  const d = new Map(); let file = [];
  for (const s of sources) { d.set(s, 0); file.push(s); }
  while (file.length) {
    const suivants = [];
    for (const x of file) for (const y of g.voisins.get(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); suivants.push(y); }
    file = suivants;
  }
  return d;
}
function oracleEquilibre(g) {
  const villes = [...g.jonctions.values()].filter((j) => j.type === 'ville');
  const dist = [1, 2].map((p) => {
    const d = oracleDistances(g, g.apparitions.filter((a) => a.joueur === p).map((a) => a.id));
    return villes.map((v) => d.get(v.id));
  });
  const tri = dist.map((t) => t.slice().sort((a, b) => a - b));
  let ecart = 0;
  for (let r = 0; r < 4; r++) ecart = Math.max(ecart, Math.abs(tri[0][r] - tri[1][r]));
  let plus1 = 0, plus2 = 0;
  villes.forEach((v, k) => { if (dist[0][k] < dist[1][k]) plus1++; else if (dist[1][k] < dist[0][k]) plus2++; });
  return { ecart, plus1, plus2, tri };
}

/* --- Graphe fait main : villes à des distances connues de deux joueurs --- */
/**
 * Pour chaque ville k, un chemin de d1[k] pas depuis l'apparition du joueur 1 et un de d2[k] pas depuis celle du joueur 2.
 * Les villes sont alors à utiliser non traversables (villesTraversables: false) pour que les distances restent exactes.
 */
function grapheDistances(d1, d2) {
  const voisins = new Map(), cases = new Map(), jonctions = [], villes = new Set();
  const noeud = (x) => { if (!voisins.has(x)) { voisins.set(x, new Set()); if (!x.startsWith('J')) cases.set(x, { id: x }); } };
  const lier = (a, b) => { noeud(a); noeud(b); voisins.get(a).add(b); voisins.get(b).add(a); };
  const app = { 1: ['s1a', 's1b'], 2: ['s2a', 's2b'] };
  lier('s1a', 's1b'); lier('s2a', 's2b');
  d1.forEach((n, k) => {
    const ville = `J${k + 1},1`;
    [[n, 's1a', 'p'], [d2[k], 's2a', 'q']].forEach(([longueur, depart, nom]) => {
      let prec = depart;
      for (let s = 1; s < longueur; s++) { const id = `${nom}${k}_${s}`; lier(prec, id); prec = id; }
      lier(prec, ville);
    });
    jonctions.push({ id: ville, i: k + 1, j: 1, type: 'ville', ports: 2, cases: [] });
    villes.add(ville);
  });
  return { noeuds: [...voisins.keys()], voisins, cases, jonctions, villes, apparitions: app, villesTraversables: false };
}
const DOC_VIDE = M.nouveauDocument();

/* ---------------------------------------------------------------------- */
/* Équilibre sur graphes à distances connues                               */
/* ---------------------------------------------------------------------- */

test('equilibre : distances triées, écart par rang, partage, tempo, première ville', () => {
  const d1 = [2, 3, 3, 4, 5, 6, 6], d2 = [4, 3, 5, 4, 3, 6, 8];
  const g = grapheDistances(d1, d2);
  assert.strictEqual(GR.distancesJoueur(g, 1).get('J1,1'), 2); // le graphe fait main respecte les distances voulues
  const e = GR.equilibre(DOC_VIDE, { graphe: g });
  assert.deepStrictEqual(e.D[1], [2, 3, 3, 4, 5, 6, 6]);
  assert.deepStrictEqual(e.D[2], [3, 3, 4, 4, 5, 6, 8]);
  assert.strictEqual(e.ecartRang, 1);
  assert.deepStrictEqual(e.parRang.slice(0, 4).map((r) => r.ecart), [1, 0, 1, 0]);
  assert.deepStrictEqual(e.partage, { 1: 3, 2: 1, egalite: 3 });
  assert.deepStrictEqual(e.tempo, { 1: { 3: 3, 4: 4, 5: 5 }, 2: { 3: 2, 4: 4, 5: 5 } });
  assert.deepStrictEqual(e.premiereVille, { 1: 2, 2: 3, ecart: 1 });
  // S = 1 + 0 + 1 + 0 + 0 + 0 + 2 = 4 (information, sans alerte depuis docs/22) ; première ville à 2 pas contre 3
  assert.strictEqual(e.S, 4);
  assert.strictEqual(e.sInformation, true);
  assert.deepStrictEqual(e.alertes.map((x) => x.code), ['premiere_ville_inegale']);
  assert.deepStrictEqual(e.inaccessibles, { 1: [], 2: [] });
  assert.strictEqual(e.villes.length, 7);
});

test('equilibre : écart de 3 à un rang = alerte ; plus de 3 (SEUIL_BLOCAGE_ECART) = plateau très déséquilibré ; ecartRang information', () => {
  let e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [6, 6, 6, 6, 6, 6, 6]) });
  assert.strictEqual(e.ecartRang, 4);
  assert.deepStrictEqual(e.alertes.filter((a) => /^ecart_rang/.test(a.code)).map((a) => a.code), []);
  // le vert est aussi plus proche de toutes les villes : les deux critères sont nommés
  assert.deepStrictEqual(e.blocages.map((b) => b.code), ['cinq_contre_deux', 'ecart_bloquant']);
  assert.match(e.blocages[1].message, /4 pas d'écart .*plus de 3/);
  assert.strictEqual(e.tresDesequilibre, true);
  // écart de 3 seulement au rang 5 : compte aussi (docs/archives/16 b)
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 8, 8, 8]) });
  assert.strictEqual(e.ecartRang, 0);
  assert.strictEqual(e.parRang[4].ecart, 3);
  assert.ok(e.parRang.every((r) => r.compte));
  assert.deepStrictEqual(e.alertes.filter((a) => /^ecart_rang/.test(a.code)).map((a) => a.code), ['ecart_rang_etendu']);
  assert.deepStrictEqual(e.blocages, []);
});

test('equilibre : 5 villes contre 2 (blocage) et apparition à plus de 7 pas de toute ville', () => {
  let e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 2, 2, 2, 2, 2, 2], [3, 3, 9, 9, 9, 9, 9]) });
  assert.deepStrictEqual(e.partage, { 1: 7, 2: 0, egalite: 0 });
  // « 5 contre 2 » est bloquant (CINQ_CONTRE_DEUX_BLOQUANT) : dans blocages, pas dans les alertes ; message vert / rouge
  assert.ok(e.blocages.some((a) => a.code === 'cinq_contre_deux' && /joueur vert .*joueur rouge/.test(a.message)));
  assert.ok(!e.alertes.some((a) => a.code === 'cinq_contre_deux'));
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([8, 8, 8, 8, 8, 8, 8], [2, 2, 2, 2, 2, 2, 2]) });
  const lointaines = e.alertes.filter((a) => a.code === 'apparition_lointaine');
  assert.strictEqual(lointaines.length, 2); // les deux apparitions du joueur 1
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([3, 3, 3, 4, 4, 4, 5], [3, 3, 3, 4, 4, 4, 5]) });
  assert.deepStrictEqual(e.alertes, []);
  assert.deepStrictEqual(e.partage, { 1: 0, 2: 0, egalite: 7 });
});

test('equilibre : ville inaccessible exclue de D et signalée, sans NaN', () => {
  const g = grapheDistances([2, 3, 3, 4, 5, 6, 6], [4, 3, 5, 4, 3, 6, 8]);
  // la ville 7 n'est plus reliée au joueur 2
  const v = 'J7,1';
  for (const id of [...g.voisins.get(v)]) if (id.startsWith('q')) { g.voisins.get(v).delete(id); g.voisins.get(id).delete(v); }
  const e = GR.equilibre(DOC_VIDE, { graphe: g });
  assert.strictEqual(e.D[2].length, 6);
  assert.deepStrictEqual(e.inaccessibles[2], [{ i: 7, j: 1 }]);
  assert.ok(e.alertes.some((a) => a.code === 'ville_inaccessible'));
  assert.ok(!JSON.stringify(e).includes('null,null'));
  assert.ok(e.parRang.every((r) => r.ecart === null || Number.isFinite(r.ecart)));
});

/* ---------------------------------------------------------------------- */
/* Documents                                                               */
/* ---------------------------------------------------------------------- */

test('equilibre : cohérence avec un oracle indépendant (jonctions-cases, camps des cases d\'apparition)', () => {
  const rng = mulberry32(20261015);
  const placements = { milieu: MILIEU, unParCamp: [{ i: 2, j: 1 }, { i: 2, j: 3 }] };
  for (let n = 0; n < 40; n++) {
    const doc = tirerPlateau(rng), g = GR.construire(doc);
    if (!g.apparitions[1].length || !g.apparitions[2].length) continue; // un camp sans case d'apparition : rien à comparer
    for (const cle of Object.keys(placements)) {
      const o = oracleEquilibre(oracleGraphe(doc, placements[cle]));
      const e = GR.equilibre(doc, { jetons: villes7(placements[cle]), villesTraversables: true });
      assert.strictEqual(e.ecartRang, o.ecart, `plateau ${n} ${cle}`);
      assert.strictEqual(e.partage[1], o.plus1);
      assert.strictEqual(e.partage[2], o.plus2);
      assert.deepStrictEqual([e.D[1], e.D[2]], o.tri);
    }
  }
});

test('equilibre : catalogue v2, 6 cases d\'apparition par camp : plateau complet', () => {
  const doc = tirerPlateau(mulberry32(7));
  const e = GR.equilibre(doc, { jetons: villes7(MILIEU) });
  const g = GR.construire(doc);
  // chaque tuile du pourtour porte une case d'apparition : rangées 0 et 1 au vert, 2 et 3 au rouge
  assert.strictEqual(g.apparitions[1].length, 6);
  assert.strictEqual(g.apparitions[2].length, 6);
  assert.strictEqual(e.complet, true);
  assert.deepStrictEqual(e.apparitions, { 1: 6, 2: 6 });
});

test('equilibre : les villes du document sont lues, et option jetons les remplace', () => {
  let doc = A.plateauComplet('4x4');
  for (const jn of villes7(MILIEU)) doc = M.poserJeton(doc, jn.i, jn.j);
  const a = GR.equilibre(doc), b = GR.equilibre(doc, { jetons: villes7(MILIEU) });
  assert.strictEqual(a.villesTraversables, false); // règle du jeu
  assert.deepStrictEqual(a.D, b.D);
  assert.strictEqual(a.complet, true);
  assert.strictEqual(GR.profil(doc), a.D[1].join(',') + '|' + a.D[2].join(','));
});

test('equilibre : villes non traversables, aucune distance triée ne diminue', () => {
  const rng = mulberry32(20261015);
  for (let n = 0; n < 30; n++) {
    const doc = tirerPlateau(rng), jetons = villes7(MILIEU);
    const t = GR.equilibre(doc, { jetons, villesTraversables: true }), nt = GR.equilibre(doc, { jetons });
    for (const p of [1, 2]) {
      assert.strictEqual(nt.D[p].length, t.D[p].length - nt.inaccessibles[p].length);
      nt.D[p].forEach((x, k) => assert.ok(x >= t.D[p][k], `rang ${k}`));
    }
  }
});

test('equilibre : plateau d\'exemples, 4×4 et 5×5 : sans ville partiel, avec 7 villes complet et sans blocage', () => {
  for (const grille of ['4x4', '5x5']) {
    let e = GR.equilibre(A.plateauComplet(grille));
    assert.strictEqual(e.complet, false);
    assert.deepStrictEqual(e.D, { 1: [], 2: [] });
    assert.ok(e.lacunes.some((t) => t.includes('Il manque 7 ville')));
    e = GR.equilibre(A.plateauComplet(grille, true));
    assert.strictEqual(e.complet, true, grille + ' ' + e.lacunes.join(' / '));
    assert.deepStrictEqual(e.blocages, []);
    assert.strictEqual(e.villes.length, 7);
    assert.deepStrictEqual(e.apparitions, grille === '4x4' ? { 1: 6, 2: 6 } : { 1: 7, 2: 7 });
  }
});

test('equilibre : plateau complet très déséquilibré (« 5 contre 2 ») et plateau à surveiller (S ≥ 5)', () => {
  let e = GR.equilibre(A.plateauDesequilibre());
  assert.strictEqual(e.complet, true);
  assert.strictEqual(e.tresDesequilibre, true);
  assert.deepStrictEqual(e.blocages.map((b) => b.code), ['cinq_contre_deux']);
  e = GR.equilibre(A.plateauASurveiller());
  assert.strictEqual(e.tresDesequilibre, false);
  assert.strictEqual(e.aSurveiller, true);
  assert.ok(e.alertes.some((a) => a.code === 'score_s'));
});

test('equilibre : plateaux incomplets, aucune exception ; lacune par camp sans case d\'apparition', () => {
  assert.doesNotThrow(() => GR.equilibre(M.nouveauDocument()));
  assert.doesNotThrow(() => GR.equilibre(undefined));
  assert.doesNotThrow(() => GR.profil(M.nouveauDocument()));
  const vide = GR.equilibre(M.nouveauDocument());
  assert.strictEqual(vide.complet, false);
  assert.strictEqual(vide.ecartRang, null);
  assert.deepStrictEqual(vide.partage, { 1: 0, 2: 0, egalite: 0 });
  assert.ok(vide.lacunes.some((t) => t === 'Le joueur vert n\'a aucune case d\'apparition.'));
  assert.ok(vide.lacunes.some((t) => t === 'Le joueur rouge n\'a aucune case d\'apparition.'));
  // seulement les rangées nord : le rouge n'a aucune apparition
  const doc = A.plateauComplet('4x4', true);
  doc.plateau.tuiles = doc.plateau.tuiles.filter((t) => t.lig <= 1);
  const e = GR.equilibre(doc);
  assert.strictEqual(e.complet, false);
  assert.ok(e.lacunes.some((t) => t.includes('Il manque 8 tuile')));
  assert.strictEqual(e.ecartRang, null);
  assert.deepStrictEqual(e.D[2], []);
  assert.deepStrictEqual(e.blocages, []);
  assert.doesNotThrow(() => GR.goulets(GR.construire(doc), 2));
  const sansModele = A.plateauComplet('4x4', true);
  sansModele.modeles = [];
  assert.doesNotThrow(() => GR.equilibre(sansModele));
  assert.ok(GR.equilibre(sansModele).lacunes.some((t) => t.includes('introuvable')));
});

test('equilibre : ne modifie pas le document', () => {
  const doc = tirerPlateau(mulberry32(9));
  const avant = JSON.stringify(doc);
  GR.equilibre(doc, { jetons: villes7(MILIEU) });
  GR.goulets(GR.construire(doc, { jetons: villes7(MILIEU) }), 1);
  assert.strictEqual(JSON.stringify(doc), avant);
});

test('goulets sur le plateau d\'exemples : 1 à 4 chemins disjoints par ville ; articulation de type jonction', () => {
  const g = GR.construire(A.plateauComplet('4x4', true));
  for (const p of [1, 2]) {
    const r = GR.goulets(g, p);
    assert.strictEqual(r.parVille.length, 7);
    for (const v of r.parVille) assert.ok(v.chemins >= 1 && v.chemins <= 4, `${v.id} : ${v.chemins}`);
  }
  // une case de jonction qui coupe une ville : type 'jonction'
  const gm = { noeuds: ['s', 'Jc', 'Jv'], voisins: new Map([['s', new Set(['Jc'])], ['Jc', new Set(['s', 'Jv'])], ['Jv', new Set(['Jc'])]]),
    cases: new Map([['s', {}]]), jonctions: [{ id: 'Jc', i: 1, j: 1, type: 'case' }, { id: 'Jv', i: 2, j: 1, type: 'ville' }],
    villes: new Set(['Jv']), apparitions: { 1: ['s'], 2: [] }, villesTraversables: false };
  assert.deepStrictEqual(GR.goulets(gm, 1).articulations.map((a) => a.type), ['jonction']);
});

test('flancs : nombres finis sur le plateau d\'exemples (rangées nord et sud à case d\'apparition)', () => {
  const f = GR.flancs(A.plateauComplet('4x4'));
  assert.strictEqual(f.length, 2);
  for (const x of f) assert.ok(Number.isFinite(x.flanc) && Number.isFinite(x.centre) && x.flanc >= 2, JSON.stringify(x));
});

/* ---------------------------------------------------------------------- */
/* Présentation                                                            */
/* ---------------------------------------------------------------------- */

test('rapport : lignes de rang, mise en évidence au-delà de 2, goulets, alertes en phrases', () => {
  const doc = tirerPlateau(mulberry32(2));
  const a = EQ.analyser(doc, {});                         // sans ville : rapport partiel
  const r0 = EQ.rapport(a);
  assert.strictEqual(r0.complet, false);
  assert.ok(r0.lacunes.length > 0);

  const g = grapheDistances([2, 3, 3, 4, 5, 6, 6], [6, 6, 6, 6, 6, 6, 6]);
  const analyse = { graphe: g, resultat: GR.equilibre(DOC_VIDE, { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  const r = EQ.rapport(analyse);
  assert.strictEqual(r.rangs.length, 7);
  assert.deepStrictEqual(r.rangs.map((x) => x.fort), [true, true, true, false, false, false, false]); // écarts 4, 3, 3, 2
  assert.strictEqual(r.rangs[0].d1, '2');
  assert.strictEqual(r.rangs[0].d2, '6');
  assert.strictEqual(r.rangs[0].ecart, '4');
  assert.strictEqual(r.goulets.length, 7);
  assert.ok(r.blocages.some((t) => /écart/.test(t)));
  assert.match(r.explication, /2 pas/);
  assert.match(r.explication, /vert, rouge/);
  assert.match(r.explication, /on ne la traverse pas/);
  assert.deepStrictEqual(r.tempo.map((x) => x.pas), [3, 4, 5]);
});

/** Faux DOM minimal : assez pour dessiner le rapport et activer la case à cocher. */
class FauxElement {
  constructor(nom, doc) { this.nom = nom; this.ownerDocument = doc; this.enfants = []; this.attributs = {}; this.ecouteurs = {}; this._texte = ''; this.className = ''; }
  get firstChild() { return this.enfants[0] || null; }
  appendChild(e) { this.enfants.push(e); return e; }
  removeChild(e) { this.enfants.splice(this.enfants.indexOf(e), 1); return e; }
  insertBefore(e, ref) { const k = this.enfants.indexOf(ref); this.enfants.splice(k < 0 ? this.enfants.length : k, 0, e); return e; }
  setAttribute(k, v) { this.attributs[k] = v; }
  addEventListener(t, f) { this.ecouteurs[t] = f; }
  focus() { FauxElement.focus = this; }
  set textContent(t) { this._texte = String(t); }
  get textContent() { return this._texte + this.enfants.map((e) => e.textContent).join(''); }
  trouver(nom, acc = []) { if (this.nom === nom) acc.push(this); this.enfants.forEach((e) => e.trouver(nom, acc)); return acc; }
}
const fauxDoc = { createElement(nom) { return new FauxElement(nom, fauxDoc); } };

test('remplir : le rapport complet contient les tableaux (en-têtes Vert / Rouge), sans option « villes traversables »', () => {
  const doc = A.plateauComplet('4x4', true);
  const avant = JSON.stringify(doc);
  const conteneur = new FauxElement('div', fauxDoc);
  EQ.remplir(conteneur, doc);
  assert.strictEqual(JSON.stringify(doc), avant);
  const tableaux = conteneur.trouver('table');
  assert.strictEqual(tableaux.length, 3); // distances, tempo, goulets
  assert.strictEqual(tableaux[0].trouver('tr').length, 1 + 7);   // en-tête + 7 rangs
  assert.deepStrictEqual(tableaux[0].trouver('th').slice(0, 4).map((t) => t.textContent), ['Rang', 'Vert', 'Rouge', 'Écart']);
  assert.ok(!conteneur.textContent.includes('traversables'));
  assert.strictEqual(conteneur.trouver('input').length, 0);
  assert.ok(!conteneur.textContent.includes('Plateau incomplet'));
  assert.ok(conteneur.textContent.includes('Score S'));
  assert.ok(!/[Jj]oueur [12]/.test(conteneur.textContent));
});

test('remplir : plateau très déséquilibré, une section le dit avec le critère', () => {
  const conteneur = new FauxElement('div', fauxDoc);
  EQ.remplir(conteneur, A.plateauDesequilibre());
  assert.ok(conteneur.textContent.includes('Plateau très déséquilibré'));
  assert.ok(conteneur.textContent.includes('« 5 contre 2 »'));
});

test('remplir : plateau vide, le rapport dit ce qui manque', () => {
  const conteneur = new FauxElement('div', fauxDoc);
  EQ.remplir(conteneur, M.nouveauDocument());
  assert.ok(conteneur.textContent.includes('Plateau incomplet'));
  assert.ok(conteneur.textContent.includes('Il manque 7 ville'));
});

test('ouvrir : remplit PM.dialogue sans modifier l\'état', () => {
  const doc = A.plateauComplet('4x4', true);
  const contenu = new FauxElement('div', fauxDoc);
  let titre = null;
  globalThis.PM.dialogue = { ouvrir(t) { titre = t; return contenu; }, fermer() {} };
  const appels = [];
  const etat = { doc: () => doc, appliquer: () => appels.push('appliquer'), majUi: () => appels.push('majUi'), remplacer: () => appels.push('remplacer') };
  EQ.ouvrir(etat);
  assert.strictEqual(titre, 'Rapport d\'équilibre');
  assert.ok(contenu.trouver('table').length >= 1);
  assert.deepStrictEqual(appels, []);
  delete globalThis.PM.dialogue;
});

test('equilibre : score S, écart aux rangs 1 à 7, D6 étendu, première ville, villes à <= 4 pas', () => {
  let e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 5, 6, 6]) });
  assert.strictEqual(e.S, 0);
  assert.strictEqual(e.aSurveiller, false);
  assert.deepStrictEqual(e.alertes, []);
  assert.deepStrictEqual(e.villesA4, { 1: 4, 2: 4, ecart: 0 });
  // D2 = 2 3 3 4 5 6 9 : écart 3 au rang 7 seulement : S = 3, alerte (pas de blocage : 3 n'est pas plus de 3)
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 5, 6, 9]) });
  assert.strictEqual(e.S, 3);
  assert.strictEqual(e.ecartMax7, 3);
  assert.strictEqual(e.ecartRang, 0);
  assert.deepStrictEqual(e.alertes.map((a) => a.code), ['ecart_rang_etendu']);
  // S = 4 : information seulement (docs/22), aucune alerte score_s
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 4, 4, 5, 6, 6, 6]) });
  assert.strictEqual(e.S, 4);
  assert.strictEqual(e.aSurveiller, false);
  assert.strictEqual(e.sInformation, true);
  assert.ok(!e.alertes.some((a) => a.code === 'score_s'));
  // S = 5 : à surveiller, alerte score_s
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 4, 4, 5, 6, 6, 7]) });
  assert.strictEqual(e.S, 5);
  assert.strictEqual(e.aSurveiller, true);
  assert.strictEqual(e.sInformation, false);
  assert.ok(e.alertes.some((a) => a.code === 'score_s'));
  // première ville inégale
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [3, 3, 3, 4, 5, 6, 6]) });
  assert.ok(e.alertes.some((a) => a.code === 'premiere_ville_inegale'));
  // plateau vide : S nul absent
  assert.strictEqual(GR.equilibre(M.nouveauDocument()).S, null);
});

test('equilibre 5×5 : alerte S dès 7, information S = 5 ou 6 (docs/18, 2026-10-18) ; le 4×4 garde 5 et 4', () => {
  const DOC5 = M.nouveauDocument('5x5');
  const d1 = [2, 3, 3, 4, 5, 6, 6];
  const attendus = [[[2, 4, 4, 5, 6, 6, 6], 4, false, false], [[2, 4, 4, 5, 6, 6, 7], 5, false, true], [[2, 4, 4, 5, 6, 7, 7], 6, false, true], [[2, 4, 4, 5, 7, 7, 7], 7, true, false]];
  for (const [d2, S, alerte, info] of attendus) {
    const e = GR.equilibre(DOC5, { graphe: grapheDistances(d1, d2) });
    assert.strictEqual(e.S, S);
    assert.strictEqual(e.aSurveiller, alerte, '5×5 S = ' + S);
    assert.strictEqual(e.sInformation, info, '5×5 S = ' + S);
    assert.strictEqual(e.alertes.some((a) => a.code === 'score_s'), alerte, '5×5 S = ' + S);
    // le même graphe sur un document 4×4 : alerte dès 5, information à 4
    const e4 = GR.equilibre(DOC_VIDE, { graphe: grapheDistances(d1, d2) });
    assert.strictEqual(e4.aSurveiller, S >= 5, '4×4 S = ' + S);
    assert.strictEqual(e4.sInformation, S === 4, '4×4 S = ' + S);
  }
  const al = GR.equilibre(DOC5, { graphe: grapheDistances(d1, [2, 4, 4, 5, 7, 7, 7]) }).alertes.find((x) => x.code === 'score_s');
  assert.ok(al.message.includes('à partir de 7'), al.message);
});

test('cinq contre deux : sans case d’apparition pour un camp (plateau incomplet), pas de blocage', () => {
  const g = grapheDistances([2, 2, 2, 2, 2, 2, 2], [3, 3, 9, 9, 9, 9, 9]);
  g.apparitions[2] = [];
  const e = GR.equilibre(DOC_VIDE, { graphe: g });
  assert.strictEqual(e.cinqContreDeux, false);
  assert.deepStrictEqual(e.blocages, []);
});

test('equilibre : ville inaccessible → S et ecartMax7 null ; champs cinqContreDeux et premiereEgale exposés', () => {
  const g = grapheDistances([2, 3, 3, 4, 5, 6, 6], [4, 3, 5, 4, 3, 6, 8]);
  let e = GR.equilibre(DOC_VIDE, { graphe: g });
  assert.strictEqual(e.cinqContreDeux, false);
  assert.strictEqual(e.premiereEgale, false); // 2 pas contre 3 pas
  assert.ok(Number.isFinite(e.S));
  const v = 'J7,1';
  for (const id of [...g.voisins.get(v)]) if (id.startsWith('q')) { g.voisins.get(v).delete(id); g.voisins.get(id).delete(v); }
  e = GR.equilibre(DOC_VIDE, { graphe: g });
  assert.strictEqual(e.S, null);
  assert.strictEqual(e.ecartMax7, null);
  assert.strictEqual(e.aSurveiller, false);
  assert.ok(e.alertes.some((a) => a.code === 'ville_inaccessible'));
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 2, 2, 2, 2, 2, 2], [3, 3, 9, 9, 9, 9, 9]) });
  assert.strictEqual(e.cinqContreDeux, true);
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 5, 6, 6]) });
  assert.strictEqual(e.premiereEgale, true);
});

test('equilibre : 4 villes coupées du joueur 2, plateau toujours « complet » au sens des données, alerte ville_inaccessible', () => {
  const g = grapheDistances([2, 3, 3, 4, 5, 6, 6], [4, 3, 5, 4, 3, 6, 8]);
  for (const v of ['J4,1', 'J5,1', 'J6,1', 'J7,1']) {
    for (const id of [...g.voisins.get(v)]) if (id.startsWith('q')) { g.voisins.get(v).delete(id); g.voisins.get(id).delete(v); }
  }
  const e = GR.equilibre(DOC_VIDE, { graphe: g });
  assert.strictEqual(e.D[2].length, 3);
  assert.ok(!e.lacunes.some((t) => /accessibles/.test(t)), e.lacunes.join(' / '));
  assert.ok(e.alertes.some((a) => a.code === 'ville_inaccessible'));
  assert.strictEqual(e.S, null);
});
