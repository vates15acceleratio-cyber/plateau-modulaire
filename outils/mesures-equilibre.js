'use strict';
/*
 * mesures-equilibre.js : mesures d'équilibre du catalogue 4×4 de la version 2 (docs/19, docs/20, docs/21).
 *
 * Lancement : node outils/mesures-equilibre.js [nbPlateaux=1000] [graine=20261015] [fichierRapport]
 *   -> écrit docs/21-mesures-catalogue-v2.md (tableaux), précédé du texte de outils/constats-catalogue-v2.md s'il existe
 *      (constats et seuils rédigés à la main pour le tirage de référence : 1000 plateaux, graine 20261015).
 *
 * Vocabulaire de la version 2 : une jonction sans ville est une « jonction-case » (case chemin) ; 7 villes et
 * 2 jonctions-cases par plateau, donc C(9, 2) = 36 combinaisons par plateau. Villes non traversables (règle du jeu,
 * docs/18) : toutes les mesures d'équilibre sont faites dans ce mode.
 *
 * Réutilisable (tests/catalogue.test.js) :
 *   const { mesurer, rediger, tirerPlateaux } = require('./mesures-equilibre.js');
 *   const stats = mesurer(tirerPlateaux(200, 1), { paires: 'toutes' });
 *  - paires: 'toutes' (défaut) essaie les 36 combinaisons de jonctions-cases sur chaque plateau ;
 *    'fixe' ne mesure que le placement donné (entree.jetons, sinon doc.plateau.jetons).
 */
const fs = require('fs');
const path = require('path');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
require('../src/generateur.js');
const PM = globalThis.PM;
const M = PM.modele;
const GR = PM.graphe;
const CAT = PM.catalogue;

/* ---------------------------------------------------------------------- */
/* Tirage des plateaux (même suite de tirages que tests/catalogue.test.js) */
/* ---------------------------------------------------------------------- */

function mulberry32(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/**
 * Plateau 4×4 complet : tirage du générateur (PM.generateur.tirerTuiles) : modèles tirés avec remise, poids = exemplaires,
 * pénalité de répétition qui favorise la variété ; rotation suggérée (bords et coins tournés vers l'extérieur),
 * rotation aléatoire des centrales. Les 7 villes ne sont pas posées ici (voir PAIRES).
 */
function tirerPlateau(rng, options) {
  const doc = CAT.nouveauDocument();
  const F = M.formatDuDocument(doc);
  const GEN = PM.generateur;
  if (options && options.orientes) { // tirage du générateur : cases égales entre moitiés et centrales orientées selon les ports
    const ctx = GEN.contexteDocument4x4(doc);
    let r = GEN.tuilesOrientees4x4(ctx, rng);
    while (r.cause) r = GEN.tuilesOrientees4x4(ctx, rng);
    doc.plateau.tuiles = r.tuiles;
    return doc;
  }
  doc.plateau.tuiles = GEN.tirerTuiles(GEN.modelesParGabarit(doc, F), GEN.cellulesDuFormat(F), F, rng);
  return doc;
}
/** nb plateaux 4×4 ; options.orientes : composition du générateur (PM.generateur.tuilesOrientees4x4) au lieu de la pose libre. */
function tirerPlateaux(nb, graine, options) {
  const rng = mulberry32(graine);
  const res = [];
  for (let n = 0; n < nb; n++) res.push({ doc: tirerPlateau(rng, options) });
  return res;
}

/* ---------------------------------------------------------------------- */
/* Combinaisons : les 2 jonctions qui restent des jonctions-cases           */
/* ---------------------------------------------------------------------- */

const JONCTIONS = [];
for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) JONCTIONS.push({ i, j });
const cleJonction = (c) => `(${c.i},${c.j})`;

/** Les 9 jonctions portent une ville sauf celles données, qui restent des jonctions-cases (pas de jeton). */
function villes9sauf(casesChemin) {
  return JONCTIONS.filter((jn) => !casesChemin.some((c) => c.i === jn.i && c.j === jn.j)).map((jn) => ({ i: jn.i, j: jn.j, type: 'capture' }));
}
const PAIRES = [];
for (let a = 0; a < JONCTIONS.length; a++) {
  for (let b = a + 1; b < JONCTIONS.length; b++) {
    PAIRES.push({ cle: cleJonction(JONCTIONS[a]) + '+' + cleJonction(JONCTIONS[b]), cases: [JONCTIONS[a], JONCTIONS[b]], jetons: villes9sauf([JONCTIONS[a], JONCTIONS[b]]) });
  }
}

/** Paires du générateur (docs/22, voir PM.generateur.pairesJonctionsCases) : par défaut la rangée centrale ; « variées » : toutes sauf deux jonctions-cases d'une même rangée extérieure. */
const PAIRES_DEFAUT = PAIRES.filter((p) => p.cases[0].j === 2 && p.cases[1].j === 2);
const PAIRES_VARIEES = PAIRES.filter((p) => !(p.cases[0].j === p.cases[1].j && p.cases[0].j !== 2));

/** Placement de référence pour comparer une sortie du générateur à un tirage uniforme (ancien outil de mesure du générateur, retiré) : jonctions-cases dans la rangée centrale. */
const CLE_DEFAUT = '(1,2)+(3,2)';

/* ---------------------------------------------------------------------- */
/* Outils de statistique                                                   */
/* ---------------------------------------------------------------------- */

const moy = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const pc = (n, tot) => (tot ? (100 * n / tot).toFixed(1) + ' %' : 'n/a');
function ajouterHist(h, v) { const k = String(v); h[k] = (h[k] || 0) + 1; }
function cles(h) { return Object.keys(h).sort((a, b) => (a === 'n/a') - (b === 'n/a') || Number(a) - Number(b)); }
const totalHist = (h) => Object.values(h).reduce((a, b) => a + b, 0);
const moyHist = (h) => { let s = 0, n = 0; for (const k of Object.keys(h)) if (k !== 'n/a') { s += Number(k) * h[k]; n += h[k]; } return n ? s / n : NaN; };
/** Part des mesures dont la valeur est >= seuil. */
const partHist = (h, seuil) => Object.keys(h).filter((k) => k !== 'n/a' && Number(k) >= seuil).reduce((s, k) => s + h[k], 0);
/** Histogramme en texte : une ligne par valeur. */
function texteHist(h, etiquette) {
  const tot = totalHist(h), lignes = [];
  for (const k of cles(h)) {
    const p = tot ? 100 * h[k] / tot : 0;
    lignes.push(`${String(etiquette ? etiquette(k) : k).padStart(6)} | ${String(h[k]).padStart(7)} | ${p.toFixed(1).padStart(5)} % | ${'#'.repeat(Math.round(p / 2))}`);
  }
  return '```\nvaleur |       n |      % |\n' + lignes.join('\n') + '\n```';
}

/* ---------------------------------------------------------------------- */
/* Accumulateurs                                                           */
/* ---------------------------------------------------------------------- */

function nouvelAcc() {
  return {
    n: 0, S: {}, ecartMax: {}, cinqDeux: 0, quatreTrois: 0, bloquees: 0, alerteEcart: 0, alerteS: 0, premiereInegale: 0,
    lointaine: 0, inaccessible: 0, uneAlerte: 0, partiel: 0,
    ecartVilles: {},                    // plus petit écart entre deux villes, en pas
    rang: [0, 1, 2, 3, 4, 5, 6].map(() => ({})),   // histogramme de l'écart |D1 - D2| à chaque rang
    ville1: { 1: {}, 2: {} }, ecartPremiere: {},
    tempo: { 1: { 3: [], 4: [], 5: [] }, 2: { 3: [], 4: [], 5: [] } },
    egalite: [], partage: {}
  };
}

function cumuler(acc, e, g) {
  acc.n++;
  ajouterHist(acc.S, e.S === null ? 'n/a' : e.S);
  ajouterHist(acc.ecartMax, e.ecartMax7 === null ? 'n/a' : e.ecartMax7);
  const codes = e.alertes.map((a) => a.code);
  if (e.cinqContreDeux) acc.cinqDeux++;
  if (Math.max(e.partage[1], e.partage[2]) === 4) acc.quatreTrois++;
  if (e.tresDesequilibre) acc.bloquees++;
  if (codes.includes('ecart_rang_etendu') || e.tresDesequilibre) acc.alerteEcart++;
  if (e.aSurveiller) acc.alerteS++;
  if (codes.includes('premiere_ville_inegale')) acc.premiereInegale++;
  if (codes.includes('apparition_lointaine')) acc.lointaine++;
  if (codes.includes('ville_inaccessible')) acc.inaccessible++;
  if (codes.length || e.tresDesequilibre) acc.uneAlerte++;
  if (e.partiel) acc.partiel++;
  // plus petit écart entre deux villes (villes non traversables)
  let mini = Infinity;
  for (const v of g.jonctions.filter((j) => j.type === 'ville')) {
    const d = GR.distances(g, v.id);
    for (const w of g.jonctions) if (w !== v && w.type === 'ville' && d.has(w.id)) mini = Math.min(mini, d.get(w.id));
  }
  ajouterHist(acc.ecartVilles, Number.isFinite(mini) ? mini : 'n/a');
  e.parRang.forEach((r, k) => { if (r.ecart !== null && acc.rang[k]) ajouterHist(acc.rang[k], r.ecart); });
  ajouterHist(acc.partage, Math.max(e.partage[1], e.partage[2]) + ' contre ' + (7 - e.partage.egalite - Math.max(e.partage[1], e.partage[2])) + (e.partage.egalite ? ' (+' + e.partage.egalite + ' égalité)' : ''));
  acc.egalite.push(e.partage.egalite);
  for (const p of [1, 2]) {
    for (const k of [3, 4, 5]) acc.tempo[p][k].push(e.tempo[p][k]);
    ajouterHist(acc.ville1[p], e.premiereVille[p] === null ? 'n/a' : e.premiereVille[p]);
  }
  ajouterHist(acc.ecartPremiere, e.premiereVille.ecart === null ? 'n/a' : e.premiereVille.ecart);
}

function nouveauxGoulets() { return { minParJoueur: {}, chemins: {}, articulation: 0, articulationDouble: 0, nbArticulations: [], n: 0 }; }
/** Goulets des deux joueurs sur un graphe (chemins disjoints des apparitions vers chaque ville, points d'articulation), cumulés dans `cible`. */
function cumulerGoulets(cible, g) {
  for (const joueur of [1, 2]) {
    const r = GR.goulets(g, joueur);
    cible.n++;
    ajouterHist(cible.minParJoueur, r.minChemins === null ? 'n/a' : r.minChemins);
    for (const v of r.parVille) ajouterHist(cible.chemins, v.chemins);
    cible.nbArticulations.push(r.articulations.length);
    if (r.articulations.length) cible.articulation++;
    if (r.articulations.some((a) => a.villesCoupees.length >= 2)) cible.articulationDouble++;
  }
}

/* ---------------------------------------------------------------------- */
/* Mesures                                                                 */
/* ---------------------------------------------------------------------- */

/** Distance minimale entre une case d'apparition du camp 1 et une du camp 2 (graphe complet, villes absentes). */
function ecartApparitions(g) {
  const d = GR.distancesJoueur(g, 1);
  let m = Infinity;
  for (const id of g.apparitions[2]) if (d.has(id)) m = Math.min(m, d.get(id));
  return m;
}

/** Distance du camp `p` à la rangée de jonctions adverse, par le pourtour seulement (tuiles du pourtour) ou par le centre. */
function distanceRangeeAdverse(doc, p, filtre) {
  const g = GR.construire(doc, { jetons: [], filtreTuile: filtre });
  const cible = p === 1 ? 3 : 1;
  const d = GR.distancesJoueur(g, p);
  let m = Infinity;
  for (const jn of g.jonctions) if (jn.j === cible && d.has(jn.id)) m = Math.min(m, d.get(jn.id));
  return m;
}
const surPourtour = (t) => t.col === 0 || t.col === 3 || t.lig === 0 || t.lig === 3;
const surCentre = (t) => t.col === 1 || t.col === 2;

/**
 * Mesure une liste d'entrées { doc, jetons? }. Renvoie un objet de statistiques (voir rediger).
 * options.paires : 'toutes' (défaut) ou 'fixe'.
 */
function mesurer(entrees, options) {
  options = options || {};
  const fixe = options.paires === 'fixe';
  const stats = {
    nbPlateaux: entrees.length, fixe, nbPaires: fixe ? 1 : PAIRES.length,
    acc: nouvelAcc(),
    parPaire: {},                       // cle -> acc
    plateaux: [],                       // un enregistrement par plateau
    flancs: { T: { plusCourt: 0, autoroutes: 0, diff: [], n: 0 }, N: { plusCourt: 0, autoroutes: 0, diff: [], n: 0 } },
    goulets: { T: nouveauxGoulets(), N: nouveauxGoulets() },   // placement de référence (CLE_DEFAUT, ou le placement fourni)
    ecartApparitions: {}, pourtourAdverse: { 1: {}, 2: {} }, centreAdverse: { 1: {}, 2: {} },
    casesPlateau: {}, mortsPlateau: {}, malReliees: {}, ecartVillesGarantie: {},
    profils: new Map()
  };
  for (const p of PAIRES) stats.parPaire[p.cle] = nouvelAcc();

  for (const entree of entrees) {
    const doc = entree.doc;
    const configs = fixe ? [{ cle: 'fixe', jetons: entree.jetons || doc.plateau.jetons }] : PAIRES;
    const rec = { modeles: new Set(doc.plateau.tuiles.map((t) => t.modeleId)), somme: 0, nbBloquees: 0, meilleurS: Infinity, n: 0, sommeS: 0, cinq: 0, ecart3: 0 };

    // propriétés du plateau, indépendantes des villes
    const g0 = GR.construire(doc, { jetons: [] });
    const nbCasesTuiles = g0.cases.size;
    ajouterHist(stats.casesPlateau, nbCasesTuiles + 2);
    rec.cases = nbCasesTuiles + 2;
    const morts = M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;
    ajouterHist(stats.mortsPlateau, morts);
    rec.morts = morts;
    ajouterHist(stats.malReliees, M.jonctionsMalReliees(doc).length);
    // écart minimal entre deux jonctions (garantie du catalogue : >= 4 pas, quelles que soient les villes)
    let mini = Infinity;
    for (const a of g0.jonctions) {
      const d = GR.distances(g0, a.id);
      for (const b of g0.jonctions) if (a !== b && d.has(b.id)) mini = Math.min(mini, d.get(b.id));
    }
    ajouterHist(stats.ecartVillesGarantie, Number.isFinite(mini) ? mini : 'n/a');
    ajouterHist(stats.ecartApparitions, ecartApparitions(g0));
    for (const p of [1, 2]) {
      ajouterHist(stats.pourtourAdverse[p], distanceRangeeAdverse(doc, p, surPourtour));
      ajouterHist(stats.centreAdverse[p], distanceRangeeAdverse(doc, p, surCentre));
    }

    for (const cfg of configs) {
      const g = GR.construire(doc, { jetons: cfg.jetons });
      const e = GR.equilibre(doc, { graphe: g });
      cumuler(stats.acc, e, g);
      if (!fixe) cumuler(stats.parPaire[cfg.cle], e, g);
      if (fixe || cfg.cle === CLE_DEFAUT) {
        cumulerGoulets(stats.goulets.N, g);
        cumulerGoulets(stats.goulets.T, GR.construire(doc, { jetons: cfg.jetons, villesTraversables: true }));
      }
      rec.n++;
      if (e.tresDesequilibre) rec.nbBloquees++;
      if (e.S !== null) { rec.meilleurS = Math.min(rec.meilleurS, e.S); rec.sommeS += e.S; }
      if (e.cinqContreDeux) rec.cinq++;
      if (e.ecartMax7 !== null && e.ecartMax7 > 2) rec.ecart3++;
      const cle = e.D[1].join(',') + '|' + e.D[2].join(',');
      stats.profils.set(cle, (stats.profils.get(cle) || 0) + 1);
    }
    // autoroute (flancs) : villes non traversables (règle) et traversables (comparaison)
    for (const mode of ['T', 'N']) {
      for (const f of GR.flancs(doc, { villesTraversables: mode === 'T' })) {
        const s = stats.flancs[mode];
        s.n++;
        if (f.flanc < f.centre) { s.plusCourt++; s.autoroutes++; }
        s.diff.push(f.flanc - f.centre);
      }
    }
    stats.plateaux.push(rec);
  }
  return stats;
}

/* ---------------------------------------------------------------------- */
/* Rapport                                                                 */
/* ---------------------------------------------------------------------- */

function moyenneParModele(plateaux, id, extrait) {
  const avec = plateaux.filter((p) => p.modeles.has(id)), sans = plateaux.filter((p) => !p.modeles.has(id));
  return { avec: avec.length, sans: sans.length, mAvec: moy(avec.map(extrait)), mSans: moy(sans.map(extrait)) };
}
const moyFinis = (t) => moy(t.filter(Number.isFinite));

/** Rédige le rapport Markdown à partir des statistiques de mesurer(). */
function rediger(stats, meta) {
  meta = meta || {};
  const A = stats.acc, L = [];
  const out = (s) => L.push(s === undefined ? '' : s);
  const NB = stats.nbPlateaux;
  out(`# ${meta.titre || 'Mesures du catalogue 4×4 de la version 2'}`);
  out();
  out(`Généré par \`outils/mesures-equilibre.js\`${meta.graine !== undefined ? ` (graine ${meta.graine})` : ''} : ${NB} plateau(x) 4×4 tiré(s) du catalogue réel \`PM.catalogue.nouveauDocument()\`` +
    (stats.fixe ? ', placement des villes tel que fourni.' : `, ${stats.nbPaires} combinaisons de 2 jonctions-cases par plateau (7 villes sur les 7 autres jonctions), soit ${NB * stats.nbPaires} configurations.`));
  out();
  out('Plateaux tirés comme dans `tests/catalogue.test.js` : tirage du générateur (`PM.generateur.tirerTuiles`) : modèles tirés avec remise, poids = exemplaires, pénalité de répétition (poids divisé par (1 + 0,5 × usages)) qui favorise la variété, bords et coins tournés vers l\'extérieur, centrales en rotation aléatoire. ' +
    'Villes non traversables (règle du jeu). D(k) : distance du rang k de villes, depuis la case d\'apparition la plus proche de chaque joueur. ' +
    'S = somme des |D1(k) − D2(k)| sur les rangs 1 à 7 ; « écart max » = plus grand |D1(k) − D2(k)| sur les rangs 1 à 7 ; « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus.');
  out();
  out('Seuils actuellement codés dans `src/graphe.js` (figés par docs/22) : blocage si « 5 contre 2 » ou écart max > 3 ; alerte si écart max > 2 ou S ≥ 5 (S = 4 : information seulement).');
  out();

  /* 1 */
  out('## 1. Cases par plateau');
  out();
  out('Cases des 16 tuiles + 2 jonctions-cases (cible ≈ 60, docs/20) :');
  out(texteHist(stats.casesPlateau));
  out(`Moyenne : ${f2(moyHist(stats.casesPlateau))} cases.`);
  out();

  /* 2 */
  out('## 2. Écart entre villes');
  out();
  out('Plus petit écart (en pas) entre deux jonctions quelconques, toutes les jonctions étant des cases (aucune ville) : c\'est un minorant de l\'écart entre deux villes, quel que soit le choix des 7 villes. Exigence : 4 pas (3 cases entre deux villes).');
  out(texteHist(stats.ecartVillesGarantie));
  if (!stats.fixe) { out('Même mesure sur les configurations réelles (villes non traversables) :'); out(texteHist(A.ecartVilles)); }

  /* 3 */
  out('## 3. Score S');
  out();
  out(`${A.n} configurations. Moyenne ${f2(moyHist(A.S))}.`);
  out(texteHist(A.S));
  out('Part des configurations selon S :');
  out();
  out('| S ≥ | 2 | 3 | 4 | 5 | 6 | 7 |\n|---|---|---|---|---|---|---|');
  out('| Configurations | ' + [2, 3, 4, 5, 6, 7].map((k) => pc(partHist(A.S, k), A.n)).join(' | ') + ' |');
  out();

  /* 4 */
  out('## 4. Écart par rang (1 à 7)');
  out();
  out('Écart |D1(k) − D2(k)| au rang k, sur toutes les configurations :');
  out();
  out('| Rang | Écart moyen | = 0 | = 1 | = 2 | = 3 | ≥ 4 |\n|---|---|---|---|---|---|---|');
  A.rang.forEach((h, k) => {
    const t = totalHist(h);
    out(`| ${k + 1} | ${f2(moyHist(h))} | ${pc(h['0'] || 0, t)} | ${pc(h['1'] || 0, t)} | ${pc(h['2'] || 0, t)} | ${pc(h['3'] || 0, t)} | ${pc(partHist(h, 4), t)} |`);
  });
  out();

  /* 5 */
  out('## 5. Écart max (rangs 1 à 7)');
  out(texteHist(A.ecartMax));
  out('| Écart max ≥ | 1 | 2 | 3 | 4 |\n|---|---|---|---|---|');
  out('| Configurations | ' + [1, 2, 3, 4].map((k) => pc(partHist(A.ecartMax, k), A.n)).join(' | ') + ' |');
  out();

  /* 6 */
  out('## 6. Partage des villes (« 5 contre 2 », « 4 contre 3 »)');
  out();
  out(`« 5 contre 2 » (ou pire) : ${A.cinqDeux} configurations sur ${A.n} (${pc(A.cinqDeux, A.n)}). « 4 contre 3 » : ${A.quatreTrois} (${pc(A.quatreTrois, A.n)}). Villes à égalité de distance : ${f2(moy(A.egalite))} en moyenne sur 7.`);
  out();
  out('Partage (plus proches du joueur le mieux placé contre l\'autre) :');
  out(texteHist(A.partage));

  /* 7 */
  out('## 7. Première ville et tempo');
  out();
  out('Distance de la première ville (la plus proche), joueur vert :'); out(texteHist(A.ville1[1]));
  out('Joueur rouge :'); out(texteHist(A.ville1[2]));
  out('Écart sur la première ville (|D1(1) − D2(1)|) :'); out(texteHist(A.ecartPremiere));
  out('Nombre moyen de villes atteignables en au plus n pas :');
  out();
  out('| Pas | Vert | Rouge |\n|---|---|---|');
  for (const k of [3, 4, 5]) out(`| ≤ ${k} | ${f2(moy(A.tempo[1][k]))} | ${f2(moy(A.tempo[2][k]))} |`);
  out();

  /* 8 */
  out('## 8. Autoroute du pourtour');
  out();
  out('Les raccourcis de coin et de bord (docs/20 D5) relient entre elles les 12 cases d\'apparition du pourtour. Deux mesures :');
  out();
  out('**a.** Distance minimale (en pas) entre une case d\'apparition verte et une rouge (graphe complet) :');
  out(texteHist(stats.ecartApparitions));
  out('**b.** Distance d\'une case d\'apparition d\'un joueur à la rangée de jonctions du camp adverse (j = 3 pour le vert, j = 1 pour le rouge), sans ville, en n\'empruntant que les tuiles du pourtour (« pourtour ») ou que les colonnes 1 et 2 (« centre ») :');
  out();
  out('| Joueur | Voie | Moyenne | Minimum | Maximum |\n|---|---|---|---|---|');
  for (const p of [1, 2]) {
    for (const [nom, h] of [['pourtour', stats.pourtourAdverse[p]], ['centre', stats.centreAdverse[p]]]) {
      const ks = cles(h).filter((k) => k !== 'Infinity').map(Number);
      out(`| ${p === 1 ? 'vert' : 'rouge'} | ${nom} | ${f2(moyHist(h))} | ${ks.length ? Math.min(...ks) : 'n/a'} | ${ks.length ? Math.max(...ks) : 'n/a'} |`);
    }
  }
  out();
  out('**c.** `PM.graphe.flancs` (toutes les jonctions portent une ville ; sous-graphe « flancs » = tuiles du pourtour, « centre » = colonnes 1 et 2) :');
  out();
  out('| Cas | Mesures | Pourtour plus court que le centre | Pourtour − centre moyen |\n|---|---|---|---|');
  for (const m of ['N', 'T']) {
    const s = stats.flancs[m];
    out(`| ${m === 'N' ? 'Villes non traversables (règle)' : 'Villes traversables (comparaison)'} | ${s.n} | ${s.plusCourt} (${pc(s.plusCourt, s.n)}) | ${f2(moyFinis(s.diff))} |`);
  }
  out();

  /* 9 */
  out('## 9. Raccords morts et jonctions mal reliées');
  out();
  out('Raccords morts par plateau (voisin posé sans raccord en face) :');
  out(texteHist(stats.mortsPlateau));
  out(`Moyenne ${f2(moyHist(stats.mortsPlateau))}. Jonctions reliées par moins de 2 ports :`);
  out(texteHist(stats.malReliees));

  /* 10 */
  if (!stats.fixe) {
    out('## 10. Sensibilité par modèle');
    out();
    out(`Pour chaque modèle : plateaux où il est posé / non posé, S moyen (moyenne sur les ${stats.nbPaires} combinaisons), part de configurations « 5 contre 2 » et d'écart max > 2.`);
    out();
    out('| Modèle | Plateaux avec | S moyen avec | S moyen sans | 5 contre 2 avec | 5 contre 2 sans | Écart max > 2 avec | Écart max > 2 sans |\n|---|---|---|---|---|---|---|---|');
    for (const m of CAT.modeles) {
      const s = moyenneParModele(stats.plateaux, m.id, (p) => p.sommeS / p.n);
      const c = moyenneParModele(stats.plateaux, m.id, (p) => p.cinq / p.n);
      const e = moyenneParModele(stats.plateaux, m.id, (p) => p.ecart3 / p.n);
      const pct = (x) => (Number.isFinite(x) ? pc(x * 1000, 1000) : 'n/a');   // modèle posé sur tous les plateaux : pas de « sans »
      out(`| ${m.id} ${m.nom} | ${s.avec} | ${f2(s.mAvec)} | ${f2(s.mSans)} | ${pct(c.mAvec)} | ${pct(c.mSans)} | ${pct(e.mAvec)} | ${pct(e.mSans)} |`);
    }
    out();
  }

  /* 11 */
  if (!stats.fixe) {
    out('## 11. Les 36 combinaisons de jonctions-cases');
    out();
    out('| Jonctions-cases | S moyen | S ≥ 4 | S ≥ 5 | Écart max > 2 | Écart max > 3 | 5 contre 2 |\n|---|---|---|---|---|---|---|');
    for (const p of PAIRES) {
      const a = stats.parPaire[p.cle];
      out(`| ${p.cle} | ${f2(moyHist(a.S))} | ${pc(partHist(a.S, 4), a.n)} | ${pc(partHist(a.S, 5), a.n)} | ${pc(partHist(a.ecartMax, 3), a.n)} | ${pc(partHist(a.ecartMax, 4), a.n)} | ${pc(a.cinqDeux, a.n)} |`);
    }
    out();
    const triees = PAIRES.map((p) => ({ cle: p.cle, a: stats.parPaire[p.cle] })).sort((x, y) => moyHist(x.a.S) - moyHist(y.a.S));
    // modes du générateur : moyenne sur les paires autorisées (chaque paire équiprobable)
    const mode = (liste) => {
      const accs = liste.map((p) => stats.parPaire[p.cle]), n = accs.reduce((t, a) => t + a.n, 0);
      const sMoy = accs.reduce((t, a) => t + moyHist(a.S) * a.n, 0) / n;
      return `${liste.length} | ${f2(sMoy)} | ${pc(accs.reduce((t, a) => t + partHist(a.S, 4), 0), n)} | ${pc(accs.reduce((t, a) => t + partHist(a.S, 5), 0), n)} | ${pc(accs.reduce((t, a) => t + a.cinqDeux, 0), n)}`;
    };
    out('Modes du générateur (une paire autorisée tirée au hasard, avant le filtre du critère) :');
    out();
    out('| Mode | Paires | S moyen | S ≥ 4 | S ≥ 5 | 5 contre 2 |\n|---|---|---|---|---|---|');
    out(`| Par défaut (rangée centrale) | ${mode(PAIRES_DEFAUT)} |`);
    out(`| Jonctions variées | ${mode(PAIRES_VARIEES)} |`);
    out();
    out(`Meilleure combinaison : ${triees[0].cle} (S moyen ${f2(moyHist(triees[0].a.S))}) ; la moins bonne : ${triees[triees.length - 1].cle} (S moyen ${f2(moyHist(triees[triees.length - 1].a.S))}).`);
    out();
  }

  /* goulets */
  {
    const g = stats.goulets.N;
    out('## 11b. Goulets');
    out();
    out(`Placement de référence ${stats.fixe ? 'fourni' : CLE_DEFAUT} (jonctions-cases dans la rangée centrale), villes non traversables : ${g.n} cas (un par joueur et par plateau). Chemins sans case commune (hors les cases d'apparition) entre les apparitions d'un joueur et chaque ville ; points d'articulation : case dont le retrait coupe au moins une ville de toutes les apparitions du joueur.`);
    out();
    out('Minimum, sur les 7 villes, du nombre de chemins disjoints :'); out(texteHist(g.minParJoueur));
    out('Nombre de chemins disjoints, toutes villes :'); out(texteHist(g.chemins));
    out(`Points d'articulation : au moins un dans ${pc(g.articulation, g.n)} des cas ; un point qui coupe au moins 2 villes dans ${pc(g.articulationDouble, g.n)} ; nombre moyen par cas ${f2(moy(g.nbArticulations))}.`);
    out();
  }

  /* 12 */
  out('## 12. Seuils : ce que chaque seuil attraperait');
  out();
  out('Part des configurations (une configuration = un plateau et un choix de 2 jonctions-cases) touchées par chaque critère candidat :');
  out();
  out('| Critère | Configurations touchées |\n|---|---|');
  out(`| « 5 contre 2 » | ${pc(A.cinqDeux, A.n)} |`);
  for (const k of [2, 3, 4]) out(`| Écart max ≥ ${k} | ${pc(partHist(A.ecartMax, k), A.n)} |`);
  for (const k of [4, 5, 6, 7]) out(`| S ≥ ${k}${k === 4 ? ' (information)' : (k === 5 ? ' (alerte)' : '')} | ${pc(partHist(A.S, k), A.n)} |`);
  out(`| Blocage actuel (« 5 contre 2 » ou écart max > 3) | ${pc(A.bloquees, A.n)} |`);
  out();
  if (!stats.fixe) {
    const sansBlocage = stats.plateaux.filter((p) => p.nbBloquees === 0).length;
    const unBon = stats.plateaux.filter((p) => p.nbBloquees < p.n).length;
    const histBloques = {};
    stats.plateaux.forEach((p) => ajouterHist(histBloques, p.nbBloquees));
    out(`Par plateau : ${unBon} plateau(x) sur ${NB} (${pc(unBon, NB)}) ont au moins une combinaison de jonctions-cases non bloquée ; ${sansBlocage} (${pc(sansBlocage, NB)}) n'en ont aucune bloquée. Nombre de combinaisons bloquées sur ${stats.nbPaires} :`);
    out(texteHist(histBloques));
    const meilleurs = {};
    stats.plateaux.forEach((p) => ajouterHist(meilleurs, p.meilleurS));
    out('Meilleur S atteignable par plateau (minimum sur les combinaisons) :');
    out(texteHist(meilleurs));
  }

  /* 13 */
  out('## 13. Diversité');
  out();
  out(`${stats.profils.size} profils de distances distincts (« D1 trié | D2 trié ») sur ${A.n} configurations.`);
  out();
  return L.join('\n') + '\n';
}

/* ---------------------------------------------------------------------- */
/* Plateaux 5×5 du générateur (préparation des mesures 5×5, docs/28 § 6)    */
/* ---------------------------------------------------------------------- */

/**
 * Tire `nb` tirages 5×5 du générateur, SANS filtre sur l'équilibre ni choix des villes : pour mesurer les placements de villes (les
 * 2016 placements 2-3-2 de PM.generateur.placementsVilles5x5(), à essayer sur chaque plateau comme PAIRES en 4×4), le « 5 contre 2 »,
 * le meilleur S atteignable, les plateaux sans placement valide (docs/28 § 6, points 4 et 12).
 * Renvoie { entrees: [{ doc, b1, jonctions3 }], sansOrientation, ms, generateur } :
 *  - entrees : plateaux dont les tuiles sont tirées (B1 imposés) puis orientées, sans ville (doc.plateau.jetons = []) ;
 *  - sansOrientation : tirages où aucune orientation ne relie chaque jonction par 2 ports (rejet « jonction_ports ») ;
 *  - generateur : { essais, acceptes, rejets (par cause) } du générateur complet, UN candidat par graine (villes comprises,
 *    donc ici les rejets d'équilibre et de placement sont comptés, et les plateaux acceptés dans `acceptes`).
 * mesurer() reste propre au 4×4 : l'étape « mesures sur 1000 plateaux » devra l'adapter (rangées, 36 paires).
 */
function tirerPlateaux5x5(nb, graine) {
  const GEN = PM.generateur, t0 = Date.now(), rng = mulberry32(graine);
  const res = { entrees: [], sansOrientation: 0, ms: 0, generateur: { essais: 0, acceptes: 0, rejets: {} } };
  for (let n = 0; n < nb; n++) {
    const doc = CAT.nouveauDocument('5x5');
    const t = GEN.tuilesOrientees5x5(GEN.contexteDocument5x5(doc), rng);
    if (t.cause) res.sansOrientation++;
    else { doc.plateau.tuiles = t.tuiles; res.entrees.push({ doc, b1: t.b1, jonctions3: t.jonctions3 }); }
    const r = GEN.generer(CAT.nouveauDocument('5x5'), { graine: 'mesure-' + graine + '-' + n, candidats: 1, essaisMax: 1 });
    res.generateur.essais += r.essais;
    if (r.ok) res.generateur.acceptes++;
    for (const c of Object.keys(r.rejets)) res.generateur.rejets[c] = (res.generateur.rejets[c] || 0) + r.rejets[c];
  }
  res.ms = Date.now() - t0;
  return res;
}

/* ---------------------------------------------------------------------- */
/* Lancement                                                               */
/* ---------------------------------------------------------------------- */

function principal() {
  const nb = Number(process.argv[2]) || 1000;
  const graine = Number(process.argv[3]) || 20261015;
  const sortie = process.argv[4] || path.join(__dirname, '..', 'docs', '21-mesures-catalogue-v2.md');
  const constats = path.join(__dirname, 'constats-catalogue-v2.md');
  const t0 = Date.now();
  const stats = mesurer(tirerPlateaux(nb, graine), { paires: 'toutes' });
  let texte = rediger(stats, { titre: 'Mesures du catalogue 4×4 de la version 2', graine });
  if (fs.existsSync(constats) && nb === 1000 && graine === 20261015) {
    texte = fs.readFileSync(constats, 'utf8').replace(/\s*$/, '\n') + '\n---\n\n## Tableaux de mesure\n\n' + texte.replace(/^# .*\n/, '').replace(/^## /gm, '### ');
  }
  fs.writeFileSync(sortie, texte, 'utf8');
  console.log(`Rapport écrit : ${sortie} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

module.exports = {
  mulberry32, tirerPlateau, tirerPlateaux, PAIRES, PAIRES_DEFAUT, PAIRES_VARIEES, CLE_DEFAUT, villes9sauf, mesurer, rediger, tirerPlateaux5x5,
  // outils de statistique, réutilisés par outils/mesures-5x5.js
  moy, f2, pc, ajouterHist, cles, totalHist, moyHist, partHist, texteHist
};

if (require.main === module) principal();
