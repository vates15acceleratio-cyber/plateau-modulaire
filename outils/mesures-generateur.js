'use strict';
// Adapté pour se charger sous les règles v2 (grille pleine, gabarits, villes seules) ; mesures, rapport et seuils
// à refaire avec le catalogue v2. Retirés par rapport à la version 1 : carrefours variés, formes réduites, ports de coin morts.
// Avec le catalogue de la version 1 converti, le générateur échoue (villes à moins de 3 cases) : le rapport le dit.
/*
 * mesures-generateur.js : mesure 8 de docs/9-validation-catalogue.md (sous-agent 8).
 *  - sortie du générateur (PM.generateur.generer, réglages par défaut puis « carrefours variés »)
 *    sur N graines, comparée au tirage uniforme de outils/mesures-equilibre.js (même placement par défaut) ;
 *  - ports de coin morts des 14 formes réduites valides, plateaux remplis au hasard.
 *
 * Lancement : node outils/mesures-generateur.js [nbGraines=300] [nbParForme=200]
 *   -> écrit docs/15-mesures-generateur.md.
 * Critère d'équilibre : docs/16-avis-mesures-equilibre.md (S, D6 étendu aux rangs 1 à 7, « 5 contre 2 » en non traversables).
 */
const fs = require('fs');
const path = require('path');
const ME = require('./mesures-equilibre.js');
require('../src/generateur.js');
const PM = globalThis.PM;
const M = PM.modele, GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue;

const NB = Number(process.argv[2]) || 300;
const GRAINE_UNIFORME = 20261015;

/* ---------------------------------------------------------------------- */
/* Outils                                                                  */
/* ---------------------------------------------------------------------- */

const moy = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : NaN);
const f2 = (x) => (Number.isFinite(x) ? x.toFixed(2) : 'n/a');
const pc = (n, tot) => (tot ? (100 * n / tot).toFixed(1) + ' %' : 'n/a');
function hist(t) { const h = {}; for (const v of t) h[v] = (h[v] || 0) + 1; return h; }
function texteHist(h) {
  const tot = Object.values(h).reduce((a, b) => a + b, 0);
  const lignes = Object.keys(h).sort((a, b) => Number(a) - Number(b)).map((k) => {
    const p = 100 * h[k] / tot;
    return `${String(k).padStart(6)} | ${String(h[k]).padStart(7)} | ${p.toFixed(1).padStart(5)} % | ${'#'.repeat(Math.round(p / 2))}`;
  });
  return '```\nvaleur |       n |      % |\n' + lignes.join('\n') + '\n```';
}

/** Mesures d'une configuration (doc + jetons) dans les deux modes, critère du doc 16. */
function mesurerConfig(doc, jetons) {
  const r = { ok: true };
  for (const mode of ['T', 'N']) {
    const g = GR.construire(doc, { jetons, villesTraversables: mode === 'T' });
    const e = GR.equilibre(doc, { graphe: g });
    const c = GEN.critere(e);
    r[mode] = {
      S: c.S, ecartMax: c.ecartMax, ecart14: e.ecartRang, premiereEgale: c.premiereEgale,
      cinq: e.alertes.some((a) => a.code === 'cinq_contre_deux'),
      profil: e.D[1].join(',') + '|' + e.D[2].join(',')
    };
  }
  const d = { ...doc, plateau: { ...doc.plateau, jetons } };
  r.raccords = M.raccordsMorts(d).filter((x) => x.raison !== 'absent').length;
  r.modeles = doc.plateau.tuiles.map((t) => t.modeleId);
  return r;
}

/** Agrégats d'une liste de mesures (mode N = défaut de l'outil, T pour comparaison). */
function agreger(liste) {
  const a = { n: liste.length };
  for (const mode of ['T', 'N']) {
    const m = liste.map((x) => x[mode]);
    a[mode] = {
      Smoy: moy(m.map((x) => x.S)), Smax: Math.max(...m.map((x) => x.S)), histS: hist(m.map((x) => x.S)),
      S4: m.filter((x) => x.S >= 4).length,
      ecart14: moy(m.map((x) => x.ecart14)), ecartMax: Math.max(...m.map((x) => x.ecartMax)),
      alerte17: m.filter((x) => x.ecartMax > 2).length, cinq: m.filter((x) => x.cinq).length,
      premiere: m.filter((x) => !x.premiereEgale).length,
      profils: new Set(m.map((x) => x.profil)).size,
      plusFrequent: Math.max(...Object.values(hist(m.map((x) => x.profil))))
    };
  }
  a.raccords = hist(liste.map((x) => x.raccords));
  a.raccordsMoy = moy(liste.map((x) => x.raccords));
  a.raccordsMax = Math.max(...liste.map((x) => x.raccords));
  a.presence = {};
  for (const x of liste) for (const id of new Set(x.modeles)) a.presence[id] = (a.presence[id] || 0) + 1;
  return a;
}

/* ---------------------------------------------------------------------- */
/* 1. Sortie du générateur contre tirage uniforme                          */
/* ---------------------------------------------------------------------- */

const jetonsDefaut = ME.PAIRES.find((p) => p.cle === ME.CLE_DEFAUT).jetons;

function mesurerGenerateur(options) {
  const res = [], temps = [], essais = [], candidats = [], bons = [], echecs = [];
  for (let n = 1; n <= NB; n++) {
    const t0 = process.hrtime.bigint();
    const r = GEN.generer(CAT.nouveauDocument(), Object.assign({ graine: 'm8-' + n }, options));
    temps.push(Number(process.hrtime.bigint() - t0) / 1e6);
    if (!r.ok) { echecs.push(r.raison); continue; }
    essais.push(r.essais); candidats.push(r.candidats); bons.push(r.score.bons);
    res.push({ m: mesurerConfig(r.doc, r.doc.plateau.jetons), doc: r.doc });
  }
  return { res, temps, essais, candidats, bons, echecs };
}

/* ---------------------------------------------------------------------- */
/* Rapport                                                                 */
/* ---------------------------------------------------------------------- */

function principal() {
  const sortie = path.join(__dirname, '..', 'docs', '15-mesures-generateur.md');
  const t0 = Date.now();

  const gen = mesurerGenerateur({});
  const tol0 = mesurerGenerateur({ tolerance: 0 });   // variante : S = Smin (meilleur S seulement)
  const uniformes = ME.tirerPlateaux(NB, GRAINE_UNIFORME).map((e) => ({ m: mesurerConfig(e.doc, jetonsDefaut), doc: e.doc }));
  if (!gen.res.length) {
    console.log('Aucun plateau généré (' + gen.echecs[0] + ') : rien à mesurer. Catalogue v2 nécessaire.');
    return;
  }
  const aG = agreger(gen.res.map((x) => x.m)), aU = agreger(uniformes.map((x) => x.m));
  const a0 = tol0.res.length ? agreger(tol0.res.map((x) => x.m)) : null;

  // Goulets et flancs (fonctions de mesures-equilibre.js), sortie du générateur
  const stG = ME.mesurer(gen.res.map((x) => ({ doc: x.doc, jetons: x.doc.plateau.jetons })), { paires: 'fixe' });
  const stU = ME.mesurer(uniformes.map((x) => ({ doc: x.doc, jetons: jetonsDefaut })), { paires: 'fixe' });

  const L = [];
  const out = (s) => L.push(s === undefined ? '' : s);

  out('# Mesure : sortie du générateur (règles v2)');
  out();
  out(`Généré par \`outils/mesures-generateur.js\` (${NB} graines « m8-1 » à « m8-${NB} »). Catalogue réel \`PM.catalogue.nouveauDocument()\`. **Mesures à refaire avec le catalogue v2** (seuils provisoires).`);
  out();
  out('Critère : S = Σ |D1(k) − D2(k)| sur les 7 rangs ; « D6 étendu » = écart > 2 à un rang de 1 à 7 ; « 5 contre 2 » ; première ville à la même distance. N = villes non traversables (règle du jeu), T = traversables (comparaison).');
  out();
  out(`Tirage uniforme de comparaison : \`tirerPlateaux(${NB}, ${GRAINE_UNIFORME})\` de \`outils/mesures-equilibre.js\`, villes en 7 jonctions (cases chemin en (1,2) et (3,2)).`);
  out();
  out('## 1. Équilibre : générateur contre tirage uniforme');
  out();
  out('| Mesure | Uniforme | Générateur | Générateur, tolérance 0 |');
  out('|---|---|---|---|');
  const ligne = (lib, fn) => out(`| ${lib} | ${fn(aU)} | ${fn(aG)} | ${a0 ? fn(a0) : 'n/a'} |`);
  ligne('Plateaux', (a) => a.n);
  for (const mode of ['N', 'T']) {
    ligne(`S moyen (${mode})`, (a) => f2(a[mode].Smoy));
    ligne(`S maximal (${mode})`, (a) => a[mode].Smax);
    ligne(`S ≥ 4 (${mode})`, (a) => `${a[mode].S4} (${pc(a[mode].S4, a.n)})`);
    ligne(`Écart D6 moyen, rangs 1 à 4 (${mode})`, (a) => f2(a[mode].ecart14));
    ligne(`Écart maximal, rangs 1 à 7 (${mode})`, (a) => a[mode].ecartMax);
    ligne(`D6 étendu, écart > 2 (${mode})`, (a) => `${a[mode].alerte17} (${pc(a[mode].alerte17, a.n)})`);
    ligne(`5 contre 2 (${mode})`, (a) => `${a[mode].cinq} (${pc(a[mode].cinq, a.n)})`);
    ligne(`Première ville différente (${mode})`, (a) => a[mode].premiere);
  }
  ligne('Raccords morts, moyenne', (a) => f2(a.raccordsMoy));
  ligne('Raccords morts, maximum', (a) => a.raccordsMax);
  out();
  out('Distribution de S (N), tirage uniforme :');
  out(texteHist(aU.N.histS));
  out('Distribution de S (N), générateur :');
  out(texteHist(aG.N.histS));
  out();

  out('## 2. Diversité');
  out();
  out('Profil = « D1 trié | D2 trié ».');
  out();
  out('| Cas | Profils distincts (N) | Plus fréquent (N) | Profils distincts (T) | Plus fréquent (T) | Plateaux (tuiles et rotations) distincts |');
  out('|---|---|---|---|---|---|');
  const distincts = (liste) => new Set(liste.map((x) => JSON.stringify(x.doc.plateau.tuiles))).size;
  const lDiv = (lib, a, liste) => out(`| ${lib} | ${a.N.profils} | ${a.N.plusFrequent} (${pc(a.N.plusFrequent, a.n)}) | ${a.T.profils} | ${a.T.plusFrequent} (${pc(a.T.plusFrequent, a.n)}) | ${distincts(liste)} |`);
  lDiv('Uniforme', aU, uniformes);
  lDiv('Générateur', aG, gen.res);
  if (a0) lDiv('Générateur, tolérance 0', a0, tol0.res);
  out();

  out('## 3. Goulets et flancs (fonctions de `outils/mesures-equilibre.js`, villes traversables)');
  out();
  const minChemins = (st) => Object.entries(st.goulets.T.minParJoueur).map(([k, v]) => `${k} : ${v}`).join(', ');
  out(`| Cas | Min. chemins disjoints par joueur | Points d'articulation (cas avec au moins un) | Flanc plus court que le centre |`);
  out('|---|---|---|---|');
  out(`| Uniforme | ${minChemins(stU)} | ${stU.goulets.T.articulation} / ${stU.goulets.T.n} | ${stU.flancs.T.autoroutes} / ${stU.flancs.T.n} |`);
  out(`| Générateur | ${minChemins(stG)} | ${stG.goulets.T.articulation} / ${stG.goulets.T.n} | ${stG.flancs.T.autoroutes} / ${stG.flancs.T.n} |`);
  out();

  out('## 4. Temps et essais');
  out();
  const tri = (t) => t.slice().sort((a, b) => a - b);
  for (const [lib, g] of [['Réglages par défaut', gen], ['Tolérance 0', tol0]]) {
    if (!g.temps.length) continue;
    const t = tri(g.temps);
    out(`- ${lib} : temps moyen ${f2(moy(t))} ms par génération (médiane ${f2(t[Math.floor(t.length / 2)])} ms, max ${f2(t[t.length - 1])} ms) ; ` +
      `essais moyens ${f2(moy(g.essais))} pour ${f2(moy(g.candidats))} candidats valides ; échecs : ${g.echecs.length}.`);
  }
  out();
  out(`Sur les ${NB} graines, le générateur produit ${gen.res.length} plateaux (${gen.echecs.length} échec(s)). Durée du calcul : ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
  fs.writeFileSync(sortie, L.join('\n') + '\n', 'utf8');
  console.log(`Rapport écrit : ${sortie} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

if (require.main === module) principal();
