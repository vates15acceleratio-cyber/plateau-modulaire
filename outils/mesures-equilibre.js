'use strict';
/*
 * mesures-equilibre.js : mesures d'équilibre sur des plateaux 4x4 (docs/9-validation-catalogue.md, mesures 1 à 7 et 9).
 *
 * Lancement : node outils/mesures-equilibre.js [nbPlateaux=1000] [graine=20261015] [fichierRapport]
 *   -> écrit docs/12-mesures-equilibre.md.
 *
 * Réutilisable (mesure 8, sortie du générateur) :
 *   const { mesurer, rediger, tirerPlateaux } = require('./mesures-equilibre.js');
 *   const stats = mesurer(entrees, { paires: 'fixe' });   // entrees = [{ doc, jetons? }], jetons = placement du plateau
 *   const texte = rediger(stats, { titre: '...', graine: 1 });
 *  - paires: 'toutes' (défaut) essaie les 30 paires de carrefours permises sur chaque plateau ;
 *    'fixe' ne mesure que le placement donné (entree.jetons, sinon doc.plateau.jetons).
 */
const fs = require('fs');
const path = require('path');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
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
function melanger(t, rng) {
  t = t.slice();
  for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
  return t;
}
/** Plateau 4x4 complet : modèles tirés sans remise selon exemplaires et rôles, rotation aléatoire des centrales. */
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
function tirerPlateaux(nb, graine) {
  const rng = mulberry32(graine);
  const res = [];
  for (let n = 0; n < nb; n++) res.push({ doc: tirerPlateau(rng) });
  return res;
}

/* ---------------------------------------------------------------------- */
/* Paires de carrefours permises                                           */
/* ---------------------------------------------------------------------- */

const JONCTIONS = [];
for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) JONCTIONS.push({ i, j });
/** Règle de src/controles.js : pas les deux sur la rangée nord (j = 1), ni les deux sur la rangée sud (j = 3). */
const memeCamp = (a, b) => (a.j === 1 && b.j === 1) || (a.j === 3 && b.j === 3);
const cleJonction = (c) => `(${c.i},${c.j})`;

function jetons9(carrefours) {
  return JONCTIONS.map((jn) => ({ i: jn.i, j: jn.j, type: carrefours.some((c) => c.i === jn.i && c.j === jn.j) ? 'carrefour' : 'capture' }));
}
const PAIRES = [];
for (let a = 0; a < JONCTIONS.length; a++) {
  for (let b = a + 1; b < JONCTIONS.length; b++) {
    if (memeCamp(JONCTIONS[a], JONCTIONS[b])) continue;
    PAIRES.push({ cle: cleJonction(JONCTIONS[a]) + '+' + cleJonction(JONCTIONS[b]), jetons: jetons9([JONCTIONS[a], JONCTIONS[b]]) });
  }
}
const CLE_DEFAUT = '(1,2)+(3,2)';     // placement par défaut du générateur (répartition 3 / 1 / 3)
const CLE_PAR_CAMP = '(2,1)+(2,3)';   // un carrefour près de chaque joueur

/** Contrôle croisé des paires avec PM.controles (alerte carrefours_meme_cote) ; null si le module n'est pas chargeable. */
function verifierPairesAvecControles() {
  try {
    require('../src/controles.js');
    let permises = 0;
    for (let a = 0; a < 9; a++) {
      for (let b = a + 1; b < 9; b++) {
        const doc = CAT.nouveauDocument();
        doc.plateau.jetons = [{ ...JONCTIONS[a], type: 'carrefour' }, { ...JONCTIONS[b], type: 'carrefour' }];
        const r = PM.controles.calculer(doc);
        const tout = [].concat(r.erreurs || [], r.alertes || []);
        if (!tout.some((x) => x.code === 'carrefours_meme_cote')) permises++;
      }
    }
    return permises;
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------------- */
/* Outils de statistique                                                   */
/* ---------------------------------------------------------------------- */

const moy = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const pc = (n, tot) => (tot ? (100 * n / tot).toFixed(1) + ' %' : 'n/a');
function ajouterHist(h, v) { const k = String(v); h[k] = (h[k] || 0) + 1; }
function cles(h) { return Object.keys(h).sort((a, b) => (a === 'n/a') - (b === 'n/a') || Number(a) - Number(b)); }
function totalHist(h) { return Object.values(h).reduce((a, b) => a + b, 0); }
/** Histogramme en texte : une ligne par valeur. */
function texteHist(h, etiquette) {
  const tot = totalHist(h), lignes = [];
  for (const k of cles(h)) {
    const p = tot ? 100 * h[k] / tot : 0;
    lignes.push(`${String(etiquette ? etiquette(k) : k).padStart(6)} | ${String(h[k]).padStart(7)} | ${p.toFixed(1).padStart(5)} % | ${'#'.repeat(Math.round(p / 2))}`);
  }
  return '```\nvaleur |       n |      % |\n' + lignes.join('\n') + '\n```';
}
const moyHist = (h) => { let s = 0, n = 0; for (const k of Object.keys(h)) if (k !== 'n/a') { s += Number(k) * h[k]; n += h[k]; } return n ? s / n : NaN; };
function valeurEcart(e) { return e.ecartRang === null ? 'n/a' : e.ecartRang; }

function nouvelAcc() {
  return {
    n: 0, ecart: {}, alerteEcart: 0, cinqDeux: 0, lointaine: 0, inaccessible: 0, partiel: 0, uneAlerte: 0,
    ecartMinVilles: {}, sommeEcarts: {}, rang: [[], [], [], [], [], [], []], egalite: [], ville1: { 1: {}, 2: {} }, ecartPremiere: {},
    tempo: { 1: { 3: [], 4: [], 5: [] }, 2: { 3: [], 4: [], 5: [] } }
  };
}
function cumuler(acc, e, g) {
  acc.n++;
  ajouterHist(acc.ecart, valeurEcart(e));
  const codes = e.alertes.map((a) => a.code);
  if (codes.includes('ecart_rang')) acc.alerteEcart++;
  if (codes.includes('cinq_contre_deux')) acc.cinqDeux++;
  if (codes.includes('apparition_lointaine')) acc.lointaine++;
  if (codes.includes('ville_inaccessible')) acc.inaccessible++;
  if (codes.length) acc.uneAlerte++;
  if (e.partiel) acc.partiel++;
  // écart minimal entre deux villes (règle des 3 pas)
  let mini = Infinity;
  for (const v of g.jonctions.filter((j) => j.type === 'capture')) {
    const d = GR.distances(g, v.id);
    for (const w of g.jonctions) if (w !== v && w.type === 'capture' && d.has(w.id)) mini = Math.min(mini, d.get(w.id));
  }
  ajouterHist(acc.ecartMinVilles, Number.isFinite(mini) ? mini : 'n/a');
  ajouterHist(acc.sommeEcarts, e.parRang.reduce((s, r) => s + (r.ecart === null ? 0 : r.ecart), 0));
  e.parRang.forEach((r, k) => { if (r.ecart !== null && acc.rang[k]) acc.rang[k].push(r.ecart); });
  acc.egalite.push(e.partage.egalite);
  for (const p of [1, 2]) {
    for (const k of [3, 4, 5]) acc.tempo[p][k].push(e.tempo[p][k]);
    ajouterHist(acc.ville1[p], e.premiereVille[p] === null ? 'n/a' : e.premiereVille[p]);
  }
  ajouterHist(acc.ecartPremiere, e.premiereVille.ecart === null ? 'n/a' : e.premiereVille.ecart);
}

function nouveauxGoulets() { return { minParJoueur: {}, chemins: {}, articulation: 0, articulationDouble: 0, nbArticulations: [], n: 0 }; }
/** Mesure 6 : goulets des deux joueurs sur un graphe, cumulés dans `cible`. */
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

const CELLULES_J1 = [[1, 0], [2, 0]], CELLULES_J2 = [[1, 3], [2, 3]];
const modeleEn = (doc, c, l) => { const t = M.tuileEn(doc, c, l); return t ? t.modeleId : null; };

/** Classe du tirage d'apparitions : A1A1 contre A2A2, ou A1A2 contre A1A2 (symétrie centrale ou miroir). */
function classeApparitions(doc) {
  const a = modeleEn(doc, 1, 0), b = modeleEn(doc, 2, 0), c = modeleEn(doc, 1, 3), d = modeleEn(doc, 2, 3);
  if (!a || !b || !c || !d) return 'indéterminé';
  if (a === b) return 'A1A1 contre A2A2';
  // J1 mixte, donc J2 mixte : symétrie centrale si (1,0) = (2,3), miroir si (1,0) = (1,3)
  return a === d ? 'A1A2 contre A1A2, symétrie centrale' : 'A1A2 contre A1A2, miroir';
}

/**
 * Mesure une liste d'entrées { doc, jetons? }. Renvoie un objet de statistiques (voir rediger).
 * options.paires : 'toutes' (défaut) ou 'fixe'.
 */
function mesurer(entrees, options) {
  options = options || {};
  const fixe = options.paires === 'fixe';
  const stats = {
    nbPlateaux: entrees.length, fixe,
    nbPaires: fixe ? 1 : PAIRES.length,
    acc: { T: { defaut: nouvelAcc(), toutes: nouvelAcc(), parCamp: nouvelAcc() }, N: { defaut: nouvelAcc(), toutes: nouvelAcc(), parCamp: nouvelAcc() } },
    parPaire: {},                       // cle -> { T: acc, N: acc }
    flancs: { T: { autoroutes: 0, diff: [], n: 0 }, N: { autoroutes: 0, diff: [], n: 0 } },
    plateaux: [],                       // enregistrements par plateau (mesures 3 et 4)
    goulets: { T: nouveauxGoulets(), N: nouveauxGoulets() },
    profils: { defaut: new Map(), toutes: new Map(), unJoueur: new Map(), nonOrdonne: new Map() }
  };
  for (const p of PAIRES) stats.parPaire[p.cle] = { T: nouvelAcc(), N: nouvelAcc() };
  stats.apparitionsInaccessibles = 0;

  for (const entree of entrees) {
    const doc = entree.doc;
    const configs = fixe ? [{ cle: 'fixe', jetons: entree.jetons || doc.plateau.jetons }] : PAIRES;
    const rec = {
      classe: classeApparitions(doc), modeles: new Set(doc.plateau.tuiles.map((t) => t.modeleId)),
      ecartDefaut: null, ecartToutes: [], alerteDefaut: false, alerteToutes: 0, cinqDefaut: false, cinqToutes: 0, somme: []
    };
    for (const cfg of configs) {
      const estDefaut = fixe || cfg.cle === CLE_DEFAUT, estParCamp = !fixe && cfg.cle === CLE_PAR_CAMP;
      for (const mode of ['T', 'N']) {
        const g = GR.construire(doc, { jetons: cfg.jetons, villesTraversables: mode === 'T' });
        const e = GR.equilibre(doc, { graphe: g });
        cumuler(stats.acc[mode].toutes, e, g);
        if (!fixe) cumuler(stats.parPaire[cfg.cle][mode], e, g);
        if (estDefaut) cumuler(stats.acc[mode].defaut, e, g);
        if (estParCamp) cumuler(stats.acc[mode].parCamp, e, g);
        if (estDefaut) cumulerGoulets(stats.goulets[mode], g); // mesure 6 (placement par défaut)
        if (mode === 'T') {
          const codes = e.alertes.map((a) => a.code);
          rec.ecartToutes.push(e.ecartRang === null ? NaN : e.ecartRang);
          rec.somme.push(e.parRang.reduce((s, r) => s + (r.ecart === null ? 0 : r.ecart), 0));
          if (codes.includes('ecart_rang') || codes.includes('cinq_contre_deux') || codes.includes('apparition_lointaine')) rec.alerteToutes++;
          if (codes.includes('cinq_contre_deux')) rec.cinqToutes++;
          if (estDefaut) {
            rec.ecartDefaut = e.ecartRang;
            rec.alerteDefaut = codes.length > 0;
            rec.cinqDefaut = codes.includes('cinq_contre_deux');
            // mesure 7 : profils
            const cle = e.D[1].join(',') + '|' + e.D[2].join(',');
            stats.profils.defaut.set(cle, (stats.profils.defaut.get(cle) || 0) + 1);
            const non = [e.D[1].join(','), e.D[2].join(',')].sort().join('|');
            stats.profils.nonOrdonne.set(non, (stats.profils.nonOrdonne.get(non) || 0) + 1);
            for (const s of [e.D[1].join(','), e.D[2].join(',')]) stats.profils.unJoueur.set(s, (stats.profils.unJoueur.get(s) || 0) + 1);
          }
          const cleToutes = e.D[1].join(',') + '|' + e.D[2].join(',');
          stats.profils.toutes.set(cleToutes, (stats.profils.toutes.get(cleToutes) || 0) + 1);
        }
      }
    }
    // flancs (ne dépendent pas de la paire de carrefours)
    for (const mode of ['T', 'N']) {
      for (const f of GR.flancs(doc, { villesTraversables: mode === 'T' })) {
        const s = stats.flancs[mode];
        s.n++;
        if (f.flanc < f.centre) s.autoroutes++;
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

function ligneAcc(acc) {
  return `${acc.n} | ${f2(moyHist(acc.ecart))} | ${Math.max(...cles(acc.ecart).filter((k) => k !== 'n/a').map(Number), 0)} | ` +
    `${acc.alerteEcart} (${pc(acc.alerteEcart, acc.n)}) | ${acc.cinqDeux} (${pc(acc.cinqDeux, acc.n)}) | ` +
    `${acc.lointaine} | ${acc.inaccessible} | ${acc.uneAlerte} (${pc(acc.uneAlerte, acc.n)})`;
}
const ENTETE_ACC = '| Cas | Mesures | Écart D6 moyen | Écart max | Alerte D6 (> 2) | 5 contre 2 | Apparition > 7 pas | Ville inaccessible | Au moins une alerte |\n|---|---|---|---|---|---|---|---|---|';

function moyenneParModele(plateaux, id, extrait) {
  const avec = plateaux.filter((p) => p.modeles.has(id)), sans = plateaux.filter((p) => !p.modeles.has(id));
  return { avec: avec.length, sans: sans.length, mAvec: moy(avec.map(extrait)), mSans: moy(sans.map(extrait)) };
}
const moyFinis = (t) => moy(t.filter(Number.isFinite));

/** Rédige le rapport Markdown à partir des statistiques de mesurer(). */
function rediger(stats, meta) {
  meta = meta || {};
  const T = stats.acc.T, N = stats.acc.N, L = [];
  const out = (s) => L.push(s === undefined ? '' : s);
  out(`# ${meta.titre || 'Mesures d\'équilibre'}`);
  out();
  out(`Généré par \`outils/mesures-equilibre.js\`${meta.graine !== undefined ? ` (graine ${meta.graine})` : ''}. ${stats.nbPlateaux} plateau(x) 4x4` +
    (stats.fixe ? ', placement des jetons tel que fourni.' : `, ${stats.nbPaires} paires de carrefours permises par plateau (soit ${stats.nbPlateaux * stats.nbPaires} configurations).`));
  out();
  if (meta.notes) { for (const n of meta.notes) out(n); out(); }
  out('Définitions : « écart D6 » = plus grand |D1(k) − D2(k)| aux rangs 1 à 4 (distances de chaque ville à l\'apparition la plus proche de chaque joueur, triées). ' +
    '« Alerte D6 » = écart > 2. « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus. « Apparition > 7 pas » = une case d\'apparition à plus de 7 pas de toute ville. ' +
    'Villes traversables (T) : on peut passer par une ville ; non traversables (N) : une ville n\'est qu\'une destination. Les carrefours sont toujours traversables.');
  out();

  /* 1 : villes non traversables */
  out('## 1. Villes non traversables contre traversables');
  out();
  out(ENTETE_ACC);
  const cas = [['T, placement par défaut ' + CLE_DEFAUT, T.defaut], ['N, placement par défaut ' + CLE_DEFAUT, N.defaut]];
  if (!stats.fixe) cas.push(['T, ' + CLE_PAR_CAMP, T.parCamp], ['N, ' + CLE_PAR_CAMP, N.parCamp], ['T, toutes les paires', T.toutes], ['N, toutes les paires', N.toutes]);
  for (const [nom, a] of cas) out(`| ${nom} | ${ligneAcc(a)} |`);
  out();
  out('Écart minimal entre deux villes (en pas, règle des 3 pas), placement par défaut :');
  out();
  out('Traversables :'); out(texteHist(T.defaut.ecartMinVilles));
  out('Non traversables :'); out(texteHist(N.defaut.ecartMinVilles));
  out('Flancs (distance de l\'apparition à la ligne de jonctions adverse, flancs moins centre ; négatif = autoroute de flanc) :');
  out();
  out('| Cas | Mesures | Flanc plus court que le centre | Flanc − centre moyen |\n|---|---|---|---|');
  for (const m of ['T', 'N']) {
    const s = stats.flancs[m];
    out(`| ${m === 'T' ? 'Villes traversables' : 'Villes non traversables'} | ${s.n} | ${s.autoroutes} (${pc(s.autoroutes, s.n)}) | ${f2(moyFinis(s.diff))} |`);
  }
  out();
  out('Histogramme de l\'écart D6, placement par défaut. Traversables :'); out(texteHist(T.defaut.ecart));
  out('Non traversables :'); out(texteHist(N.defaut.ecart));

  /* 2 : paires */
  if (!stats.fixe) {
    out('## 2. Toutes les paires de carrefours permises');
    out();
    out(`${stats.nbPaires} paires (toutes sauf « même camp » : pas les deux sur j = 1, ni les deux sur j = 3).` +
      (meta.pairesControles !== undefined && meta.pairesControles !== null ? ` Contrôle croisé avec \`PM.controles\` : ${meta.pairesControles} paires sans alerte « carrefours_meme_cote ».` : ''));
    out();
    out('| Paire de carrefours | Écart D6 moyen (T) | Alerte D6 (T) | 5 contre 2 (T) | Écart D6 moyen (N) | Alerte D6 (N) | 5 contre 2 (N) |\n|---|---|---|---|---|---|---|');
    for (const p of PAIRES) {
      const t = stats.parPaire[p.cle].T, n = stats.parPaire[p.cle].N;
      out(`| ${p.cle} | ${f2(moyHist(t.ecart))} | ${pc(t.alerteEcart, t.n)} | ${pc(t.cinqDeux, t.n)} | ${f2(moyHist(n.ecart))} | ${pc(n.alerteEcart, n.n)} | ${pc(n.cinqDeux, n.n)} |`);
    }
    out();
    out('Histogramme de l\'écart D6, toutes paires, villes traversables :'); out(texteHist(T.toutes.ecart));
    out('Toutes paires, villes non traversables :'); out(texteHist(N.toutes.ecart));
  }

  /* 3 : apparitions */
  if (!stats.fixe) {
    out('## 3. Écart D6 selon le tirage des apparitions');
    out();
    out('J1 occupe (1,0) et (2,0), J2 occupe (1,3) et (2,3). Avec 2 exemplaires de A1 et 2 de A2, les cas sont : A1A1 contre A2A2 (ou l\'inverse), ou A1A2 contre A1A2 en symétrie centrale ((1,0) et (2,3) identiques) ou en miroir ((1,0) et (1,3) identiques).');
    out();
    out('| Tirage | Plateaux | Écart D6 moyen, défaut (T) | Alerte D6, défaut | 5 contre 2, défaut | Écart D6 moyen, toutes paires | Alerte D6, toutes paires | 5 contre 2, toutes paires |\n|---|---|---|---|---|---|---|---|');
    const classes = [...new Set(stats.plateaux.map((p) => p.classe))].sort();
    for (const c of classes) {
      const ps = stats.plateaux.filter((p) => p.classe === c);
      const tot = ps.length * stats.nbPaires;
      const al = ps.reduce((s, p) => s + p.ecartToutes.filter((x) => x > 2).length, 0);
      const cq = ps.reduce((s, p) => s + p.cinqToutes, 0);
      out(`| ${c} | ${ps.length} | ${f2(moy(ps.map((p) => p.ecartDefaut)))} | ${pc(ps.filter((p) => p.ecartDefaut > 2).length, ps.length)} | ${pc(ps.filter((p) => p.cinqDefaut).length, ps.length)} | ` +
        `${f2(moy(ps.map((p) => moyFinis(p.ecartToutes))))} | ${pc(al, tot)} | ${pc(cq, tot)} |`);
    }
    out();
  }

  /* 4 : modèles */
  if (!stats.fixe) {
    out('## 4. Sensibilité par modèle');
    out();
    out('Pour chaque modèle : plateaux où il est posé / non posé, écart D6 moyen (moyenne sur les 30 paires, villes traversables) et part de configurations avec 5 contre 2 ou avec au moins une alerte (D6, 5 contre 2, apparition lointaine). ' +
      'A1 et A2 sont posés sur tous les plateaux (2 exemplaires chacun) : pas de comparaison possible, voir la mesure 3.');
    out();
    out('| Modèle | Plateaux avec | Écart moyen avec | Écart moyen sans | Différence | 5 contre 2 avec | 5 contre 2 sans | Au moins une alerte avec | Au moins une alerte sans |\n|---|---|---|---|---|---|---|---|---|');
    const ids = CAT.modeles.map((m) => m.id);
    for (const id of ids) {
      const e = moyenneParModele(stats.plateaux, id, (p) => moyFinis(p.ecartToutes));
      const c = moyenneParModele(stats.plateaux, id, (p) => p.cinqToutes / stats.nbPaires);
      const al = moyenneParModele(stats.plateaux, id, (p) => p.alerteToutes / stats.nbPaires);
      if (!e.sans) { out(`| ${id} | ${e.avec} | ${f2(e.mAvec)} | (toujours posé) | | ${pc(c.mAvec * 1000, 1000)} | | ${pc(al.mAvec * 1000, 1000)} | |`); continue; }
      out(`| ${id} | ${e.avec} | ${f2(e.mAvec)} | ${f2(e.mSans)} | ${(e.mAvec - e.mSans >= 0 ? '+' : '') + f2(e.mAvec - e.mSans)} | ${pc(c.mAvec * 1000, 1000)} | ${pc(c.mSans * 1000, 1000)} | ${pc(al.mAvec * 1000, 1000)} | ${pc(al.mSans * 1000, 1000)} |`);
    }
    out();
  }

  /* 5 : tempo */
  out('## 5. Tempo (villes traversables)');
  out();
  const tempoT = stats.fixe ? T.defaut : T.toutes;
  out(`Mesuré sur ${stats.fixe ? 'le placement fourni' : 'toutes les configurations'} (${tempoT.n} mesures). Nombre moyen de villes atteignables en au plus n pas :`);
  out();
  out('| Pas | Joueur 1 | Joueur 2 |\n|---|---|---|');
  for (const k of [3, 4, 5]) out(`| ≤ ${k} | ${f2(moy(tempoT.tempo[1][k]))} | ${f2(moy(tempoT.tempo[2][k]))} |`);
  out();
  out(`Villes à égalité de distance : ${f2(moy(tempoT.egalite))} en moyenne sur 7.`);
  out();
  out('Distance de la première ville, joueur 1 :'); out(texteHist(tempoT.ville1[1]));
  out('Distance de la première ville, joueur 2 :'); out(texteHist(tempoT.ville1[2]));
  out('Écart sur la première ville :'); out(texteHist(tempoT.ecartPremiere));

  /* 6 : goulets */
  out('## 6. Goulets (placement par défaut)');
  out();
  out(`Mesuré par joueur et par plateau (${stats.goulets.T.n} cas par mode). Chemins sans case commune (hors les cases d'apparition, points de départ) entre les apparitions d'un joueur et chaque ville ; ` +
    'une ville a au plus 4 ports. Points d\'articulation : case ou jeton dont le retrait coupe au moins une ville de toutes les apparitions du joueur.');
  out();
  for (const [m, nom] of [['T', 'Villes traversables'], ['N', 'Villes non traversables']]) {
    const g = stats.goulets[m];
    out(`**${nom}.** Minimum, sur les 7 villes, du nombre de chemins disjoints :`); out(texteHist(g.minParJoueur));
    out('Nombre de chemins disjoints, toutes villes :'); out(texteHist(g.chemins));
    out(`Points d'articulation : au moins un dans ${pc(g.articulation, g.n)} des cas ; un point qui coupe au moins 2 villes dans ${pc(g.articulationDouble, g.n)} ; nombre moyen par cas ${f2(moy(g.nbArticulations))}.`);
    out();
  }

  /* 7 : diversité */
  out('## 7. Diversité des profils de distances');
  out();
  out('Profil = « D1 trié | D2 trié » (7 distances par joueur).');
  out();
  const top = (m) => Math.max(0, ...m.values());
  out('| Mesure | Profils distincts | Plus fréquent |\n|---|---|---|');
  out(`| ${stats.fixe ? 'Placement fourni' : 'Placement par défaut ' + CLE_DEFAUT}, sur ${stats.nbPlateaux} plateaux | ${stats.profils.defaut.size} | ${top(stats.profils.defaut)} (${pc(top(stats.profils.defaut), stats.nbPlateaux)}) |`);
  out(`| Même mesure, joueurs non ordonnés | ${stats.profils.nonOrdonne.size} | ${top(stats.profils.nonOrdonne)} |`);
  out(`| Distances d'un seul joueur (D triées) | ${stats.profils.unJoueur.size} | ${top(stats.profils.unJoueur)} (${pc(top(stats.profils.unJoueur), 2 * stats.nbPlateaux)}) |`);
  if (!stats.fixe) out(`| Toutes les configurations (${stats.nbPlateaux * stats.nbPaires}) | ${stats.profils.toutes.size} | ${top(stats.profils.toutes)} (${pc(top(stats.profils.toutes), stats.nbPlateaux * stats.nbPaires)}) |`);
  out();

  /* 8 */
  out('## 8. Sortie du générateur');
  out();
  out('Non mesurée ici : voir `mesurer(entrees, { paires: \'fixe\' })` et `rediger(stats)` exportés par ce script.');
  out();

  /* 9 : discrimination */
  out('## 9. Le seuil « écart > 2 » discrimine-t-il ?');
  out();
  const defaut = T.defaut, toutes = T.toutes;
  const part = (h, seuil) => pc(Object.keys(h).filter((k) => k !== 'n/a' && Number(k) >= seuil).reduce((s, k) => s + h[k], 0), totalHist(h));
  out('| Part des configurations avec écart ≥ | 1 | 2 | 3 | 4 |\n|---|---|---|---|---|');
  out(`| Placement par défaut | ${[1, 2, 3, 4].map((s) => part(defaut.ecart, s)).join(' | ')} |`);
  out(`| ${stats.fixe ? 'Idem' : 'Toutes les paires'} | ${[1, 2, 3, 4].map((s) => part(toutes.ecart, s)).join(' | ')} |`);
  out();
  out('Écart moyen par rang (placement par défaut / ' + (stats.fixe ? 'idem' : 'toutes les paires') + ') :');
  out();
  out('| Rang | ' + [1, 2, 3, 4, 5, 6, 7].join(' | ') + ' |\n|---|' + '---|'.repeat(7));
  out('| Défaut | ' + defaut.rang.map((t) => f2(moy(t))).join(' | ') + ' |');
  out('| ' + (stats.fixe ? 'Idem' : 'Toutes paires') + ' | ' + toutes.rang.map((t) => f2(moy(t))).join(' | ') + ' |');
  out();
  out('Autre indicateur à titre de comparaison : somme des écarts sur les 7 rangs (placement par défaut) :');
  out(texteHist(defaut.sommeEcarts));
  return L.join('\n') + '\n';
}

/* ---------------------------------------------------------------------- */
/* Lancement                                                               */
/* ---------------------------------------------------------------------- */

/** Constats rédigés à la main après lecture des chiffres (ajoutés au rapport du lancement direct seulement). */
const COMMENTAIRE = "## Constats (1000 plateaux, graine 20261015)\n\nFaits relevés dans les tableaux ci-dessus.\n\n- **Reproduction** : avec le placement (1,2)+(3,2), écart D6 moyen 0,42, pire écart 2 (1 plateau), 0 alerte « 5 contre 2 » ; avec (2,1)+(2,3), 44 « 5 contre 2 » sur 1000 et 12 plateaux à l'écart 2. Mêmes valeurs que `tests/catalogue.test.js`, qui valide l'implémentation de `PM.graphe`.\n- **Villes non traversables** : aucun changement sur le placement par défaut (mêmes histogrammes, écart maximal 2). Sur les 30 paires, la part d'écart > 2 passe de 0,2 % (48 configurations sur 30000) à 0,9 % (281), avec un écart maximal de 4 (15 configurations) ; « 5 contre 2 » reste à 5,7 %. Les flancs ne sont jamais plus courts que le centre (flanc moins centre : +1,55 pas, villes traversables ; +2,59 pas, non traversables). L'écart minimal entre deux villes reste 3 pas dans les deux modes.\n- **Paires de carrefours** : seules (1,2)+(2,2), (1,2)+(3,2) et (2,2)+(3,2) ont 0 % de « 5 contre 2 » ; toutes les autres paires en ont entre 4,4 % et 9,6 % (le maximum à 9,6 % pour (1,1)+(1,2), (2,1)+(1,2) et (3,1)+(1,2)). Les alertes D6 (> 2) ne dépassent 1 % sur aucune paire en villes traversables.\n- **Seuil « écart > 2 »** : il ne se déclenche presque jamais (0,1 % sur le placement par défaut, 0,2 % sur toutes les paires). Part des écarts ≥ 1 : 42,2 % (défaut) et 82,2 % (toutes paires) ; ≥ 2 : 0,1 % et 15,7 %. L'alerte « 5 contre 2 » (5,7 % sur toutes les paires) est l'alerte qui se déclenche réellement.\n- **Écart par rang** : aux rangs 1 à 3 l'écart moyen est 0,00 pour le placement par défaut (rangs 1 et 2 : 0,00 aussi sur toutes les paires). Pour le placement par défaut, l'écart sur les rangs 1 à 4 est donc porté par le rang 4. Chaque joueur a toujours sa première ville à 2 pas (30000 configurations sur 30000), l'écart sur la première ville est toujours 0.\n- **Tirage des apparitions** : écart moyen au placement par défaut 0,44 (A1A1 / A2A2), 0,41 (A1A2 miroir), 0,43 (A1A2 symétrie centrale) ; sur toutes les paires 1,00 / 0,98 / 0,96. « 5 contre 2 » sur toutes les paires : 6,5 % / 4,7 % / 5,9 %. Alertes D6 : 0,1 % à 0,2 % dans les trois cas.\n- **Modèles** : l'écart moyen avec ou sans un modèle diffère de 0,05 au plus (C1 : −0,05). Le seul écart marqué porte sur « 5 contre 2 » : 4,6 % avec C1 contre 8,0 % sans ; pour les autres modèles la différence va de −1,3 à +1,6 point. A1 et A2 sont posés sur tous les plateaux.\n- **Tempo** : villes atteignables en au plus 3 / 4 / 5 pas : 3,61 / 4,47 / 4,86 pour J1 et 3,61 / 4,48 / 4,84 pour J2 ; 1,10 ville à égalité en moyenne.\n- **Goulets** : au moins 3 chemins disjoints entre les apparitions d'un joueur et chaque ville (40,7 % des couples à 3, 59,3 % à 4) ; aucun point d'articulation sur 2000 cas, villes traversables ou non.\n- **Diversité** : 114 profils distincts sur 1000 plateaux au placement par défaut (le plus fréquent : 8,6 %) ; 72 si l'on ignore quel joueur est lequel ; 19 suites de distances distinctes pour un joueur, la plus fréquente représentant 24,6 % des cas. 1916 profils sur les 30000 configurations.\n- Aucune ville inaccessible, aucune apparition à plus de 7 pas de toute ville dans l'échantillon.\n\n## Points à soumettre à l'advisor design de jeu\n\n1. **Pouvoir discriminant du critère D6.** L'alerte « écart > 2 » est quasi muette ; au placement par défaut l'écart est nul aux rangs 1 à 3 sur les 1000 plateaux, seul le rang 4 varie. Faut-il garder le seuil, comparer d'autres rangs (5 à 7), ou considérer que le catalogue est équilibré par construction ?\n2. **Villes traversables ou non.** Le choix de règle change le taux d'écart > 2 sur les autres paires (0,2 % contre 0,9 %, écart jusqu'à 4). Quelle règle de jeu est retenue ?\n3. **Paires de carrefours.** Trois paires sur 30 évitent tout « 5 contre 2 ». La règle du générateur (paire par défaut, autre paire si aucune alerte) est cohérente avec ces chiffres ; l'ouverture du mode manuel à toutes les paires expose à 4,4 % à 9,6 % de « 5 contre 2 ».\n4. **Variété de jeu.** Un joueur voit presque toujours l'une des 19 suites de distances, dont une dans un quart des cas ; la variété vient surtout des chemins, pas des distances. Est-ce suffisant ?\n5. **Règle sur les apparitions.** Les écarts selon le tirage (0,96 à 1,00 sur toutes les paires) ne justifient pas à eux seuls une règle de symétrie centrale ; la différence de « 5 contre 2 » (4,7 % à 6,5 %) reste à interpréter.\n6. **C1.** Moins de « 5 contre 2 » quand C1 est posée (4,6 % contre 8,0 %) : effet à confirmer sur un autre tirage avant d'en tirer une conséquence.\n7. **Première ville** toujours à 2 pas : aucun tempo différentiel dans l'ouverture, à confirmer comme voulu.\n8. **Goulets** : aucun point d'articulation et au moins 3 chemins disjoints ; le « mur » de C6 n'a pas d'effet mesurable sur ces indicateurs.\n";

/** Les constats ci-dessus ne valent que pour le tirage de référence ; deux valeurs repères détectent un catalogue modifié. */
function constatsValables(nb, graine, stats) {
  return nb === 1000 && graine === 20261015 &&
    stats.acc.T.parCamp.cinqDeux === 44 && stats.profils.defaut.size === 114;
}

function principal() {
  const nb = Number(process.argv[2]) || 1000;
  const graine = Number(process.argv[3]) || 20261015;
  const sortie = process.argv[4] || path.join(__dirname, '..', 'docs', '12-mesures-equilibre.md');
  const t0 = Date.now();
  const entrees = tirerPlateaux(nb, graine);
  const stats = mesurer(entrees, { paires: 'toutes' });
  const texte = rediger(stats, {
    titre: 'Mesures d\'équilibre du catalogue (sous-agent 7)', graine, pairesControles: verifierPairesAvecControles(),
    notes: ['Plateaux tirés comme dans `tests/catalogue.test.js` (mêmes tirages pour la même graine), catalogue réel `PM.catalogue.nouveauDocument()`.']
  }) + '\n' + (constatsValables(nb, graine, stats) ? COMMENTAIRE
    : '## Constats\n\nConstats rédigés à la main pour 1000 plateaux et la graine 20261015 : à réécrire pour cette mesure.\n');
  fs.writeFileSync(sortie, texte, 'utf8');
  console.log(`Rapport écrit : ${sortie} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

module.exports = { mulberry32, tirerPlateau, tirerPlateaux, PAIRES, CLE_DEFAUT, jetons9, mesurer, rediger, verifierPairesAvecControles };

if (require.main === module) principal();
