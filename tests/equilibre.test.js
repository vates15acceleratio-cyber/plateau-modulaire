'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
require('../src/equilibre.js');
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
/** Plateau 4x4 complet tiré dans le catalogue (copie de tirerPlateau de tests/catalogue.test.js). */
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
    if (role === 'centrale') { const r = Math.floor(rng() * 4); if (r) doc = M.tournerTuile(doc, c.col, c.lig, r); }
  }
  return doc;
}

/** Jetons : 7 villes et 2 carrefours sur les 9 jonctions. */
function jetons9(carrefours) {
  const res = [];
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) {
    res.push({ i, j, type: carrefours.some((c) => c.i === i && c.j === j) ? 'carrefour' : 'capture' });
  }
  return res;
}
const MILIEU = [{ i: 1, j: 2 }, { i: 3, j: 2 }];

/* --- Oracle : utilitaires de tests/catalogue.test.js (construireGraphe, distances, equilibre) --- */
const G = globalThis.PM.geometrie;
function oracleGraphe(doc, carrefours) {
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
  for (const { e } of elems) {
    for (const p of e.ports) {
      const id = `J${p.i},${p.j}`;
      noeud(id);
      if (!jonctions.has(id)) jonctions.set(id, { id, type: carrefours.some((c) => c.i === p.i && c.j === p.j) ? 'carrefour' : 'capture' });
      lier(id, p.caseId);
    }
  }
  const apparitions = [];
  for (const { e } of elems) for (const c of e.cases) if (c.type === 'apparition') apparitions.push({ id: c.id, joueur: c.joueur });
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
  const villes = [...g.jonctions.values()].filter((j) => j.type === 'capture');
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
    jonctions.push({ id: ville, i: k + 1, j: 1, type: 'capture', ports: 2, cases: [] });
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
  assert.deepStrictEqual(e.alertes.map((x) => x.code), ['premiere_ville_inegale']); // 2 pas contre 3 pas
  assert.deepStrictEqual(e.inaccessibles, { 1: [], 2: [] });
  assert.strictEqual(e.villes.length, 7);
});

test('equilibre : écart > 2 aux rangs 1 à 4 déclenche l\'alerte principale, pas l\'écart du rang 5', () => {
  let e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [6, 6, 6, 6, 6, 6, 6]) });
  assert.strictEqual(e.ecartRang, 4);
  assert.ok(e.alertes.some((a) => a.code === 'ecart_rang'));
  // écart de 3 seulement au rang 5 : hors du critère
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 8, 8, 8]) });
  assert.strictEqual(e.ecartRang, 0);
  assert.strictEqual(e.parRang[4].ecart, 3);
  assert.ok(!e.alertes.some((a) => a.code === 'ecart_rang'));
});

test('equilibre : 5 villes contre 2 et apparition à plus de 7 pas de toute ville', () => {
  let e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 2, 2, 2, 2, 2, 2], [3, 3, 9, 9, 9, 9, 9]) });
  assert.deepStrictEqual(e.partage, { 1: 7, 2: 0, egalite: 0 });
  assert.ok(e.alertes.some((a) => a.code === 'cinq_contre_deux'));
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

test('equilibre : cohérence avec les utilitaires de tests/catalogue.test.js (mêmes plateaux, même écart D6)', () => {
  const rng = mulberry32(20261015);
  const paires = { milieu: MILIEU, unParCamp: [{ i: 2, j: 1 }, { i: 2, j: 3 }] };
  for (let n = 0; n < 60; n++) {
    const doc = tirerPlateau(rng);
    for (const cle of Object.keys(paires)) {
      const o = oracleEquilibre(oracleGraphe(doc, paires[cle]));
      const e = GR.equilibre(doc, { jetons: jetons9(paires[cle]), villesTraversables: true });
      assert.strictEqual(e.complet, true, 'plateau complet sans lacune');
      assert.strictEqual(e.ecartRang, o.ecart, `plateau ${n} ${cle}`);
      assert.strictEqual(e.partage[1], o.plus1);
      assert.strictEqual(e.partage[2], o.plus2);
      assert.deepStrictEqual([e.D[1], e.D[2]], o.tri);
      assert.strictEqual(e.alertes.some((a) => a.code === 'cinq_contre_deux'), Math.max(o.plus1, o.plus2) >= 5);
      assert.strictEqual(e.alertes.some((a) => a.code === 'ecart_rang'), o.ecart > 2);
    }
  }
});

test('equilibre : les jetons du document sont lus, et option jetons les remplace', () => {
  let doc = tirerPlateau(mulberry32(7));
  for (const jn of jetons9(MILIEU)) doc = M.poserJeton(doc, jn.i, jn.j, jn.type);
  const a = GR.equilibre(doc), b = GR.equilibre(doc, { jetons: jetons9(MILIEU) });
  assert.strictEqual(a.villesTraversables, false); // défaut : villes non traversables
  assert.deepStrictEqual(a.D, b.D);
  assert.strictEqual(a.complet, true);
  assert.strictEqual(GR.profil(doc), a.D[1].join(',') + '|' + a.D[2].join(','));
});

test('equilibre : villes non traversables, une distance change sur un plateau du catalogue', () => {
  const rng = mulberry32(20261015);
  for (let n = 0; n < 40; n++) {
    const doc = tirerPlateau(rng), jetons = jetons9(MILIEU);
    const t = GR.equilibre(doc, { jetons, villesTraversables: true }), nt = GR.equilibre(doc, { jetons, villesTraversables: false });
    assert.strictEqual(nt.villesTraversables, false);
    for (const p of [1, 2]) {
      assert.strictEqual(nt.D[p].length, t.D[p].length - nt.inaccessibles[p].length);
      // les distances triées ne peuvent pas diminuer rang par rang
      nt.D[p].forEach((x, k) => assert.ok(x >= t.D[p][k], `rang ${k}`));
    }
  }
});

test('equilibre : plateau d\'exemples complet (copieExemples) sans jeton : résultat partiel explicite', () => {
  let doc = M.nouveauDocument();
  doc.modeles = M.copieExemples();
  for (const c of M.cellulesActives(doc.plateau.forme)) {
    doc = M.poserTuile(doc, doc.modeles.find((m) => m.role === M.roleCellule(c.col, c.lig, doc.plateau.forme)).id, c.col, c.lig);
  }
  let e = GR.equilibre(doc);
  assert.strictEqual(e.complet, false);
  assert.strictEqual(e.partiel, true);
  assert.strictEqual(e.ecartRang, null);
  assert.deepStrictEqual(e.D, { 1: [], 2: [] });
  assert.ok(e.lacunes.some((t) => t.includes('Il manque 7 ville')));
  // avec 7 villes et 2 carrefours sur les jonctions possibles : plus de lacune de villes
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) {
    try { doc = M.poserJeton(doc, i, j, (i === 1 && j === 2) || (i === 3 && j === 2) ? 'carrefour' : 'capture'); } catch (x) { /* jonction refusée */ }
  }
  e = GR.equilibre(doc);
  assert.strictEqual(e.villes.length, doc.plateau.jetons.filter((x) => x.type === 'capture').length);
  assert.ok(e.D[1].length > 0);
  assert.ok(e.ecartRang === null || Number.isFinite(e.ecartRang));
});

test('equilibre : plateaux incomplets, aucune exception', () => {
  assert.doesNotThrow(() => GR.equilibre(M.nouveauDocument()));
  assert.doesNotThrow(() => GR.equilibre(undefined));
  assert.doesNotThrow(() => GR.profil(M.nouveauDocument()));
  const vide = GR.equilibre(M.nouveauDocument());
  assert.strictEqual(vide.complet, false);
  assert.strictEqual(vide.ecartRang, null);
  assert.deepStrictEqual(vide.partage, { 1: 0, 2: 0, egalite: 0 });
  assert.ok(vide.lacunes.length >= 3);
  // plateau de 6 tuiles seulement, dont une apparition de chaque camp, 3 villes
  let doc = tirerPlateau(mulberry32(3));
  doc.plateau.tuiles = doc.plateau.tuiles.filter((t) => t.lig <= 1);
  doc.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }, { i: 2, j: 1, type: 'capture' }, { i: 3, j: 1, type: 'carrefour' }];
  const e = GR.equilibre(doc);
  assert.strictEqual(e.complet, false);
  assert.ok(e.lacunes.some((t) => t.includes('apparition')));
  assert.strictEqual(e.ecartRang, null); // le joueur 2 n'a aucune apparition
  assert.deepStrictEqual(e.D[2], []);
  assert.strictEqual(e.D[1].length, 2);
  assert.doesNotThrow(() => GR.goulets(GR.construire(doc), 2));
  // modèle supprimé du document : tuile ignorée
  const sansModele = tirerPlateau(mulberry32(4));
  sansModele.modeles = [];
  assert.doesNotThrow(() => GR.equilibre(sansModele));
});

test('equilibre : ne modifie pas le document', () => {
  const doc = tirerPlateau(mulberry32(9));
  const avant = JSON.stringify(doc);
  GR.equilibre(doc, { jetons: jetons9(MILIEU) });
  GR.goulets(GR.construire(doc, { jetons: jetons9(MILIEU) }), 1);
  assert.strictEqual(JSON.stringify(doc), avant);
});

test('goulets sur un plateau complet du catalogue : 1 à 4 chemins disjoints par ville', () => {
  const doc = tirerPlateau(mulberry32(11));
  const g = GR.construire(doc, { jetons: jetons9(MILIEU) });
  for (const p of [1, 2]) {
    const r = GR.goulets(g, p);
    assert.strictEqual(r.parVille.length, 7);
    for (const v of r.parVille) assert.ok(v.chemins >= 1 && v.chemins <= 4, `${v.id} : ${v.chemins}`);
  }
});

test('flancs : même résultat que l\'utilitaire mesureFlancs (flanc et centre en nombre fini ou infini)', () => {
  const doc = tirerPlateau(mulberry32(5));
  const f = GR.flancs(doc);
  assert.strictEqual(f.length, 2);
  for (const x of f) assert.ok(x.flanc >= 3 && x.centre >= 3);
});

/* ---------------------------------------------------------------------- */
/* Présentation                                                            */
/* ---------------------------------------------------------------------- */

test('rapport : lignes de rang, mise en évidence au-delà de 2, goulets, alertes en phrases', () => {
  const doc = tirerPlateau(mulberry32(2));
  const a = EQ.analyser(doc, {});                         // sans jeton : rapport partiel
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
  assert.ok(r.alertes.some((t) => /écart/.test(t)));
  assert.match(r.explication, /2 pas/);
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

test('remplir : le rapport complet contient les tableaux, sans modifier le document', () => {
  const doc = tirerPlateau(mulberry32(21));
  doc.plateau.jetons = jetons9(MILIEU);
  const avant = JSON.stringify(doc);
  const conteneur = new FauxElement('div', fauxDoc);
  EQ.remplir(conteneur, doc);
  assert.strictEqual(JSON.stringify(doc), avant);
  const tableaux = conteneur.trouver('table');
  assert.ok(tableaux.length === 3 || tableaux.length === 4); // distances, [comparaison des modes], tempo, goulets
  assert.strictEqual(tableaux[0].trouver('tr').length, 1 + 7);   // en-tête + 7 rangs
  assert.ok(conteneur.textContent.includes('Les villes sont traversables'));
  assert.ok(!conteneur.textContent.includes('Plateau incomplet'));
  // la case à cocher recalcule : villes non traversables
  const cb = conteneur.trouver('input')[0];
  assert.strictEqual(cb.checked, false); // défaut : villes non traversables
  cb.checked = true;
  cb.ecouteurs.change();
  assert.strictEqual(conteneur.trouver('input')[0].checked, true);
  assert.strictEqual(FauxElement.focus, conteneur.trouver('input')[0]); // la nouvelle case reprend le focus
  assert.ok(conteneur.trouver('table').length >= 3);
  assert.ok(conteneur.textContent.includes('Score S'));
});

test('remplir : plateau vide, le rapport dit ce qui manque', () => {
  const conteneur = new FauxElement('div', fauxDoc);
  EQ.remplir(conteneur, M.nouveauDocument());
  assert.ok(conteneur.textContent.includes('Plateau incomplet'));
  assert.ok(conteneur.textContent.includes('Il manque 7 ville'));
});

test('ouvrir : remplit PM.dialogue sans modifier l\'état', () => {
  const doc = tirerPlateau(mulberry32(21));
  doc.plateau.jetons = jetons9(MILIEU);
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

test('script de mesures : mode « fixe » (mesure 8), sans exception ni valeur invalide dans le rapport', () => {
  const MES = require('../outils/mesures-equilibre.js');
  const entrees = MES.tirerPlateaux(5, 1);
  // jetons posés dans le document (sans entree.jetons) : repli sur doc.plateau.jetons
  entrees.forEach((e) => { for (const jn of jetons9(MILIEU)) e.doc = M.poserJeton(e.doc, jn.i, jn.j, jn.type); });
  const stats = MES.mesurer(entrees, { paires: 'fixe' });
  const texte = MES.rediger(stats, { titre: 'Essai' });
  assert.doesNotMatch(texte, /NaN|undefined|Infinity/);
  for (const n of ['## 1.', '## 5.', '## 6.', '## 7.', '## 9.']) assert.ok(texte.includes(n), n);
  for (const n of ['## 2.', '## 3.', '## 4.']) assert.ok(!texte.includes(n), n);
  assert.strictEqual(stats.acc.T.defaut.n, 5);
  // jetons fournis à part : même résultat
  const sans = entrees.map((e) => ({ doc: Object.assign({}, e.doc, { plateau: Object.assign({}, e.doc.plateau, { jetons: [] }) }), jetons: jetons9(MILIEU) }));
  assert.deepStrictEqual(MES.mesurer(sans, { paires: 'fixe' }).acc.T.defaut.ecart, stats.acc.T.defaut.ecart);
  assert.strictEqual(MES.PAIRES.length, 30);
});

test('equilibre : score S, écart aux rangs 1 à 7, D6 étendu, première ville, villes à <= 4 pas', () => {
  let e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 5, 6, 6]) });
  assert.strictEqual(e.S, 0);
  assert.strictEqual(e.aSurveiller, false);
  assert.deepStrictEqual(e.alertes, []);
  assert.deepStrictEqual(e.villesA4, { 1: 4, 2: 4, ecart: 0 });
  // D2 = 2 3 3 4 5 6 9 : écart 3 au rang 7 seulement : S = 3, D6 étendu mais pas D6 (rangs 1 à 4)
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 3, 3, 4, 5, 6, 9]) });
  assert.strictEqual(e.S, 3);
  assert.strictEqual(e.ecartMax7, 3);
  assert.strictEqual(e.ecartRang, 0);
  assert.deepStrictEqual(e.alertes.map((a) => a.code), ['ecart_rang_etendu']);
  // S = 4 : à surveiller
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [2, 4, 4, 5, 6, 6, 6]) });
  assert.strictEqual(e.S, 4);
  assert.strictEqual(e.aSurveiller, true);
  // première ville inégale
  e = GR.equilibre(DOC_VIDE, { graphe: grapheDistances([2, 3, 3, 4, 5, 6, 6], [3, 3, 3, 4, 5, 6, 6]) });
  assert.ok(e.alertes.some((a) => a.code === 'premiere_ville_inegale'));
  // plateau vide : S nul absent
  assert.strictEqual(GR.equilibre(M.nouveauDocument()).S, null);
});
