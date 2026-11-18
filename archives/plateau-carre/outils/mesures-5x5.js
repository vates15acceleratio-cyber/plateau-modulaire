'use strict';
/*
 * mesures-5x5.js : mesures d'équilibre du catalogue 5×5 (docs/28 § 6, docs/34 « Arbitrages ») ; rapport docs/35-mesures-5x5.md.
 * HISTORIQUE : écrit pour les catalogues 5×5 de la 3.04 et de la 4.00.0 (nombre de B1, orientation sans ville) ; il ne vaut plus pour le
 * catalogue à 2 cases par tuile ni pour le générateur qui place les villes avant d'orienter : voir outils/mesures-5x5-connecte.js (docs/56).
 *
 * Deux temps, pour ne pas refaire les calculs quand on retouche le rapport :
 *   1. collecte (longue) : node outils/mesures-5x5.js collecte <famille> <debut> <fin> <fichier.json> [graine]
 *        familles : f1   plateaux du générateur (PM.generateur.generer, options par défaut : 200 candidats), graine « m5-<graine>-<n> » ;
 *                   f2   plateaux tirés et orientés par le générateur (tuilesOrientees5x5), TOUS les placements 2-3-2 admissibles ;
 *                   f2b  comme f2 mais sans forcer les B1 sur la rangée neutre (contrefactuel de l'arbitrage 2) ;
 *                   c1   le générateur à 1 candidat par graine (rejets par cause).
 *   2. rapport : node outils/mesures-5x5.js rapport <dossier des .json> [fichier du rapport]
 *        lit f1-*.json, f2.json, f2b.json, c1.json ; ajoute outils/constats-5x5.md en tête (tirage de référence seulement).
 *   Tout-en-un (1000 plateaux, graine 20261017, 8 processus en parallèle, environ 6 minutes) : node outils/mesures-5x5.js tout [dossier de cache] [fichier du rapport]
 *     -> régénère docs/35-mesures-5x5.md à l'octet près (graine fixe).
 *
 * Réutilisable (tests/mesures-5x5.test.js) : proprietesPlateau, configurer, traiterPlateauF2, tirerEntreesF2.
 *
 * Définitions
 *  - placement ADMISSIBLE : les 7 villes sur des jonctions à 3 ports au moins (même sens que candidat5x5 du générateur).
 *  - Les filtres rejouent la chaîne du générateur : ville inaccessible, puis « 5 contre 2 » ou écart > 3 (« D »), puis écart > 2 (« E »),
 *    puis première ville inégale (« P »), puis S >= 5 (« S ») ; « o » : passe tout. Le contrôle des villes à moins de 4 pas n'est pas
 *    rejoué placement par placement : l'écart minimal entre jonctions (toutes en cases) est mesuré par plateau, et des villes non traversables
 *    ne peuvent qu'être plus éloignées (le générateur ne le contrôle que sur ses 12 meilleurs placements).
 *  - S d'une configuration : somme des |D1(k) - D2(k)|, rangs 1 à 7, villes non traversables (comme PM.graphe.equilibre).
 */
const fs = require('fs');
const path = require('path');
const E = require('./mesures-equilibre.js');
const PM = globalThis.PM;
const M = PM.modele, GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue;

const GRAINE_REF = 20261017;   // tirage de référence (constats rédigés à la main dans outils/constats-5x5.md)
const NB_REF = 1000;
const NB_J = 16;               // jonctions intérieures du 5×5, indice (j - 1) * 4 + (i - 1)
const PORTS_VILLE = GR.PORTS_VILLE_MIN;   // une ville sur une jonction à ce nombre de ports au moins (constante du générateur)
const indexJonction = (i, j) => (j - 1) * 4 + (i - 1);
const num = (a, b) => a - b;
const LIBRES_ECH = 40;         // placements tirés au hasard par plateau dans la pose libre (2016 placements 2-3-2)

/* ---------------------------------------------------------------------- */
/* Mesure rapide d'un placement de villes                                  */
/* ---------------------------------------------------------------------- */

/** Graphe en tableaux d'entiers (voir generateur.js grapheRapide). */
function grapheRapide(g) {
  const idx = new Map();
  g.noeuds.forEach((id, k) => idx.set(id, k));
  const adj = g.noeuds.map((id) => Array.from(g.voisins.get(id), (v) => idx.get(v)));
  return { n: g.noeuds.length, idx, adj, sources: { 1: g.apparitions[1].map((id) => idx.get(id)), 2: g.apparitions[2].map((id) => idx.get(id)) } };
}
/** Distances des villes depuis les apparitions d'un joueur ; une ville n'est jamais traversée. */
function distVilles(P, joueur, estVille, noeudsVilles) {
  const dist = new Int16Array(P.n).fill(-1), file = new Int32Array(P.n);
  let t = 0, q = 0;
  P.sources[joueur].forEach((s) => { if (dist[s] < 0) { dist[s] = 0; file[t++] = s; } });
  while (q < t) {
    const x = file[q++];
    if (dist[x] > 0 && estVille[x]) continue;
    for (const y of P.adj[x]) if (dist[y] < 0) { dist[y] = dist[x] + 1; file[t++] = y; }
  }
  return noeudsVilles.map((v) => (dist[v] < 0 ? Infinity : dist[v]));
}

/** Grandeurs dérivées d'une configuration mesurée (r.t1 / r.t2 : distances triées des 7 villes pour chaque joueur). */
function deriver(r) {
  const rang = r.t1.map((a, k) => Math.abs(a - r.t2[k]));
  return { rang, S: rang.reduce((a, b) => a + b, 0), em: Math.max(...rang), cinq: Math.max(r.pa[0], r.pa[1]) >= GR.SEUIL_CINQ_CONTRE_DEUX, quatre: Math.max(r.pa[0], r.pa[1]) === 4, eg: r.pa[2] };
}
/** Lettre de chaque cause de rejet du générateur (PM.generateur.causeRejet) ; 'o' : passe tout. */
const LETTRE_CAUSE = { ville_inaccessible: 'I', desequilibre: 'D', cinq_contre_deux: 'D', ecart: 'E', premiere_ville: 'P', score_s: 'S' };
/** Chaîne de filtres du générateur (une seule définition : GEN.causeRejet) : 'I' inaccessible, 'D' très déséquilibré, 'E' écart > 2, 'P' première ville inégale, 'S' S >= seuil, 'o' tout passe. */
function codeFiltre(r) {
  if (r.f === 'I') return 'I';
  const d = deriver(r);
  const cause = GEN.causeRejet({ accessible: true, cinq: d.cinq, ecartMax: d.em, premiereEgale: r.t1[0] === r.t2[0], S: d.S }, '5x5');
  return cause ? LETTRE_CAUSE[cause] : 'o';
}
/** Mesure les villes (indices de jonctions) sur un graphe rapide : { v, f, t1?, t2?, pa? }. */
function configurer(P, noeudsJonction, indices) {
  const noeudsVilles = indices.map((x) => noeudsJonction[x]), estVille = new Uint8Array(P.n);
  noeudsVilles.forEach((v) => { estVille[v] = 1; });
  const d1 = distVilles(P, 1, estVille, noeudsVilles), d2 = distVilles(P, 2, estVille, noeudsVilles);
  const r = { v: indices.slice() };
  if (d1.concat(d2).some((x) => !isFinite(x))) { r.f = 'I'; return r; }
  r.pa = [0, 0, 0];
  r.eq = [];   // jonctions des villes équidistantes des deux joueurs (la « 7e ville » des 4 contre 3)
  d1.forEach((a, k) => { const b = d2[k]; if (a < b) r.pa[0]++; else if (b < a) r.pa[1]++; else { r.pa[2]++; r.eq.push(indices[k]); } });
  r.t1 = d1.slice().sort(num); r.t2 = d2.slice().sort(num);
  r.f = codeFiltre(r);
  return r;
}
/** Jonctions du graphe g dans l'ordre (j puis i) : indices de nœuds du graphe rapide. */
const noeudsJonctions = (g, P) => g.jonctions.map((jn) => P.idx.get(jn.id));

/* ---------------------------------------------------------------------- */
/* Propriétés d'un plateau (indépendantes des villes)                       */
/* ---------------------------------------------------------------------- */

const surPourtour = (t) => t.col === 0 || t.col === 4 || t.lig === 0 || t.lig === 4;
const surCentre = (t) => t.col >= 1 && t.col <= 3;

function distanceRangeeAdverse(doc, p, filtre) {
  const g = GR.construire(doc, { jetons: [], filtreTuile: filtre });
  const cible = p === 1 ? 4 : 1, d = GR.distancesJoueur(g, p);
  let m = Infinity;
  for (const jn of g.jonctions) if (jn.j === cible && d.has(jn.id)) m = Math.min(m, d.get(jn.id));
  return m;
}

/** Propriétés d'un plateau 5×5 sans ville (g0 = GR.construire(doc, { jetons: [] })). Valeurs numériques ou petits tableaux (JSON). */
function proprietesPlateau(doc, g0) {
  const tuiles = doc.plateau.tuiles, p = {};
  p.hash = tuiles.map((t) => t.modeleId + t.rot).join(',');
  p.modeles = {};
  tuiles.forEach((t) => { p.modeles[t.modeleId] = (p.modeles[t.modeleId] || 0) + 1; });
  p.casesTuiles = g0.cases.size;
  p.cases = g0.cases.size + 9;                       // + 9 jonctions-cases (7 villes sur 16 jonctions)
  p.pj = g0.jonctions.map((jn) => jn.ports);        // ports par jonction, ordre de lecture
  p.ports = p.pj.reduce((a, b) => a + b, 0);
  p.nord = p.pj.slice(0, 8).reduce((a, b) => a + b, 0);   // j <= 2
  p.sud = p.ports - p.nord;
  // écart minimal entre deux jonctions, toutes en cases (minorant de l'écart entre deux villes quel que soit le placement)
  let mini = Infinity;
  for (const a of g0.jonctions) {
    const d = GR.distances(g0, a.id);
    for (const b of g0.jonctions) if (a !== b && d.has(b.id)) mini = Math.min(mini, d.get(b.id));
  }
  p.ecartMin = mini;
  p.morts = M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;
  p.mortsGen = M.raccordsMorts(doc).filter((r) => r.raison !== 'absent').length;   // le générateur compte tout sauf « absent »
  p.malReliees = M.jonctionsMalReliees(doc).length;
  // pourtour
  const d1 = GR.distancesJoueur(g0, 1);
  let m = Infinity;
  for (const id of g0.apparitions[2]) if (d1.has(id)) m = Math.min(m, d1.get(id));
  p.ecartApp = m;
  p.pourtour = [1, 2].map((q) => distanceRangeeAdverse(doc, q, surPourtour));
  p.centre = [1, 2].map((q) => distanceRangeeAdverse(doc, q, surCentre));
  // flancs : PM.graphe.flancs (toutes les jonctions portent une ville), villes non traversables puis traversables
  p.flancs = {};
  for (const mode of ['N', 'T']) {
    p.flancs[mode] = GR.flancs(doc, { villesTraversables: mode === 'T' }).map((f) => [f.flanc, f.centre]);
  }
  return p;
}

/** Goulets des deux joueurs sur un graphe avec villes : { min, ch (chemins disjoints par ville), nArt, art2 } par joueur. */
function gouletsDe(g) {
  return [1, 2].map((q) => {
    const r = GR.goulets(g, q);
    return { min: r.minChemins, ch: r.parVille.map((v) => v.chemins), nArt: r.articulations.length, art2: r.articulations.some((a) => a.villesCoupees.length >= 2) ? 1 : 0 };
  });
}

/* ---------------------------------------------------------------------- */
/* Collecte                                                                */
/* ---------------------------------------------------------------------- */

/** Tire les plateaux orientés (sans ville) comme tirerPlateaux5x5, avec option b1Libres (contrefactuel de l'arbitrage 2). Renvoie { ctx, rng, base }. */
function preparer(graine, b1Libres) {
  const base = CAT.nouveauDocument('5x5');
  let ctx = GEN.contexteDocument5x5(base);
  // contrefactuel : aucune cellule n'est « neutre » pour le générateur, donc les B1 vont au hasard sur tous les bords
  if (b1Libres) ctx = Object.assign({}, ctx, { F: Object.create(ctx.F, { campCellule: { value: () => 'x' } }) });
  return { ctx, rng: E.mulberry32(graine), base };
}
function docDepuis(base, tuiles, jetons) {
  return { version: base.version, grille: '5x5', modeles: base.modeles, plateau: { tuiles, jetons: jetons || [] } };
}
/** Plateau suivant d'une préparation : { doc, t } (t.cause si aucune orientation). */
function tirerEntreesF2(prep) {
  const t = GEN.tuilesOrientees5x5(prep.ctx, prep.rng);
  if (t.cause) return { cause: t.cause };
  return { doc: docDepuis(prep.base, t.tuiles, []), b1: t.b1, jonctions3: t.jonctions3 };
}

/** Famille 2 : tous les placements 2-3-2 admissibles d'un plateau orienté, filtres, sélection comme le générateur (avec / sans rejet S). */
function traiterPlateauF2(doc, ctx, rng, ech) {
  const g0 = GR.construire(doc, { jetons: [] }), P = grapheRapide(g0), noeuds = noeudsJonctions(g0, P);
  const admissible = g0.jonctions.map((jn) => jn.ports >= PORTS_VILLE);
  const configs = [];
  ctx.placements.forEach((pl) => {
    if (!pl.indices.every((x) => admissible[x])) return;
    configs.push(configurer(P, noeuds, pl.indices));
  });
  const choisir = (ok) => {
    const l = [];
    configs.forEach((c, k) => { if (ok(c.f)) { const d = deriver(c); l.push({ k, S: d.S, eg: d.eg > 0 ? 0 : 1, a: rng() }); } });
    l.sort((a, b) => (a.S - b.S) || (a.eg - b.eg) || (a.a - b.a));
    return l.length ? l[0].k : -1;
  };
  const b = { props: proprietesPlateau(doc, g0), nbAdm: configs.length, configs, selAvec: choisir((f) => f === 'o'), selSans: choisir((f) => f === 'o' || f === 'S') };
  b.nbValides = configs.filter((c) => c.f === 'o').length;
  if (ech) { // pose manuelle libre : les 2016 placements 2-3-2, sans l'exigence de 3 ports (compte par filtre + échantillon de LIBRES_ECH placements)
    const codes = {}, tous = [];
    let meilleur = Infinity;
    ctx.placements.forEach((pl) => {
      const c = configurer(P, noeuds, pl.indices);
      codes[c.f] = (codes[c.f] || 0) + 1;
      if (c.f === 'o') meilleur = Math.min(meilleur, deriver(c).S);
      tous.push(c);
    });
    const ids = tous.map((_, k) => k);
    for (let k = 0; k < LIBRES_ECH; k++) { const q = k + Math.floor(ech() * (ids.length - k)); const t = ids[k]; ids[k] = ids[q]; ids[q] = t; }
    b.libre = { n: tous.length, codes, meilleurS: Number.isFinite(meilleur) ? meilleur : null, ech: ids.slice(0, LIBRES_ECH).map((k) => tous[k]) };
  }
  if (configs.length) { // goulets sur un placement admissible tiré au hasard (pose manuelle)
    const c = configs[Math.floor(rng() * configs.length)];
    b.goulets = gouletsDe(GR.construire(docDepuis({ version: doc.version, modeles: doc.modeles }, doc.plateau.tuiles, c.v.map((x) => ({ i: x % 4 + 1, j: Math.floor(x / 4) + 1, type: 'capture' }))), {}));
  }
  return b;
}

function collecteF2(graine, debut, fin, b1Libres) {
  // le flux de hasard est partagé entre tous les plateaux : une collecte partielle donnerait une autre suite de tirages
  if (debut !== 0) throw new Error('f2 / f2b : la collecte part toujours de 0 (flux de hasard unique)');
  const prep = preparer(graine, b1Libres), boards = [], ech = b1Libres ? null : E.mulberry32((graine ^ 0x5bd1e995) >>> 0);
  let sansOrientation = 0;
  for (let n = 0; n < fin; n++) {
    const e = tirerEntreesF2(prep);       // le flux de hasard avance pour tous les n
    if (n < debut) continue;
    if (e.cause) { sansOrientation++; boards.push(null); continue; }
    const b = traiterPlateauF2(e.doc, prep.ctx, prep.rng, ech);
    b.b1 = e.b1; b.jonctions3 = e.jonctions3;
    boards.push(b);
  }
  return { famille: b1Libres ? 'f2b' : 'f2', graine, sansOrientation, boards };
}

function collecteF1(graine, debut, fin) {
  const boards = [];
  for (let n = debut; n < fin; n++) {
    const r = GEN.generer(CAT.nouveauDocument('5x5'), { graine: 'm5-' + graine + '-' + n });
    const b = { n, ok: r.ok, essais: r.essais, candidats: r.candidats, rejets: r.rejets };
    if (r.ok) {
      const doc = r.doc, g0 = GR.construire(doc, { jetons: [] }), P = grapheRapide(g0);
      b.props = proprietesPlateau(doc, g0);
      b.cfg = configurer(P, noeudsJonctions(g0, P), doc.plateau.jetons.map((j) => indexJonction(j.i, j.j)));
      b.goulets = gouletsDe(GR.construire(doc, {}));
      b.score = { S: r.score.S, bons: r.score.bons, Smin: r.score.Smin };
    }
    boards.push(b);
  }
  return { famille: 'f1', graine, boards };
}

function collecteC1(graine, nb) {
  const res = { famille: 'c1', graine, nb, acceptes: 0, essais: 0, rejets: {} };
  for (let n = 0; n < nb; n++) {
    const r = GEN.generer(CAT.nouveauDocument('5x5'), { graine: 'm5c1-' + graine + '-' + n, candidats: 1, essaisMax: 1 });
    res.essais += r.essais;
    if (r.ok) res.acceptes++;
    for (const c of Object.keys(r.rejets)) res.rejets[c] = (res.rejets[c] || 0) + r.rejets[c];
  }
  return res;
}

/* ---------------------------------------------------------------------- */
/* Lancement                                                               */
/* ---------------------------------------------------------------------- */

function ecrire(fichier, o) { fs.writeFileSync(fichier, JSON.stringify(o), 'utf8'); }

/** Lance « collecte » dans un processus fils ; promesse résolue à la fin (erreur si le code de sortie n'est pas 0). */
function lancer(args) {
  return new Promise((resolve, reject) => {
    const fils = require('child_process').spawn(process.execPath, [__filename, 'collecte'].concat(args), { stdio: 'inherit' });
    fils.on('exit', (code) => (code === 0 ? resolve() : reject(new Error('collecte ' + args.join(' ') + ' : code ' + code))));
  });
}
/** Tout-en-un : 8 tranches du générateur en parallèle, puis f2, f2b et c1, puis le rapport (docs/35). */
async function toutEnUn(dossier, sortie) {
  fs.mkdirSync(dossier, { recursive: true });
  const nb = NB_REF, tranches = 8, taille = nb / tranches, g = String(GRAINE_REF), t0 = Date.now();
  const travaux = [];
  for (let k = 0; k < tranches; k++) travaux.push(lancer(['f1', String(k * taille), String((k + 1) * taille), path.join(dossier, 'f1-' + k + '.json'), g]));
  travaux.push(lancer(['f2', '0', String(nb), path.join(dossier, 'f2.json'), g]));
  travaux.push(lancer(['f2b', '0', String(nb), path.join(dossier, 'f2b.json'), g]));
  travaux.push(lancer(['c1', '0', String(nb), path.join(dossier, 'c1.json'), g]));
  await Promise.all(travaux);
  require('./rapport-5x5.js').rapport(dossier, sortie);
  console.log('Tout-en-un : ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s');
}

function principal() {
  const [, , cmd, a1, a2, a3, a4, a5] = process.argv;
  if (cmd === 'tout') {
    toutEnUn(a1 || path.join(require('os').tmpdir(), 'mesures-5x5'), a2).catch((e) => { console.error(e.message); process.exit(1); });
  } else if (cmd === 'collecte') {
    const graine = Number(a5) || GRAINE_REF, debut = Number(a2), fin = Number(a3), t0 = Date.now();
    let res;
    if (a1 === 'f1') res = collecteF1(graine, debut, fin);
    else if (a1 === 'f2') res = collecteF2(graine, debut, fin, false);
    else if (a1 === 'f2b') res = collecteF2(graine, debut, fin, true);
    else if (a1 === 'c1') res = collecteC1(graine, fin);
    else throw new Error('famille inconnue : ' + a1);
    ecrire(a4, res);
    console.log(`${a1} ${debut}-${fin} : ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${a4}`);
  } else if (cmd === 'rapport') {
    const { rapport } = require('./rapport-5x5.js');
    rapport(a1, a2);
  } else {
    console.log('Usage : voir l\'en-tête de outils/mesures-5x5.js');
  }
}

module.exports = {
  GRAINE_REF, NB_REF, grapheRapide, noeudsJonctions, configurer, deriver, codeFiltre, proprietesPlateau, gouletsDe,
  preparer, tirerEntreesF2, traiterPlateauF2, collecteF1, collecteF2, collecteC1, docDepuis, indexJonction
};

if (require.main === module) principal();
