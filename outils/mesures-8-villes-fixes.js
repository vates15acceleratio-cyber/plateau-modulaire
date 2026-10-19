'use strict';
/*
 * mesures-8-villes-fixes.js : faisabilité du motif fixe de 8 villes du 5×5 (docs/18, consigne du 2026-10-19) avec le catalogue B3.
 * Motif : jonctions (1,1) (4,1) (2,2) (3,2) (2,3) (3,3) (1,4) (4,4).
 *
 *   node outils/mesures-8-villes-fixes.js [plateaux, 300] [compositions des variantes, 300]
 *
 * 1. Preuve : pour chaque centrale du catalogue et chaque orientation à la cellule du milieu (col 2, lig 2), une même case porte-t-elle
 *    deux ports vers deux villes du carré central (elles sont alors à 2 pas, 1 case d'écart) ?
 * 2. Boucle du générateur (graines « f0 », « f1 »…, tirage par quotas composer5x5, abandon après 25 échecs structurels consécutifs
 *    comme generer) : (a) 3 cases d'écart entre toutes les villes, 3 ports par ville ; (b) 2 cases tolérées entre villes voisines du
 *    carré central, 3 cases ailleurs, 3 ports par ville. Une case qui dessert deux villes les met à 2 pas : exclue dans (a) et (b).
 * 3. Variantes HORS des règles décidées (pour la décision de l'utilisateur) : une case peut desservir deux villes du carré central
 *    (1 case d'écart) ; recherche exacte du plus petit nombre de telles paires, puis critères complets (3 ports, autres paires du carré
 *    central à 2 cases au moins, 3 cases ailleurs, connexions < 5 %, équilibre à 8 villes : S < 5, ni « 6 contre 2 », écart par rang
 *    ≤ 2, première ville égale) sur des orientations optimales tirées au hasard.
 */
const path = require('path');
const racine = path.join(__dirname, '..', 'src');
['geometrie.js', 'modele.js', 'catalogue.js', 'graphe.js', 'generateur.js'].forEach((f) => require(path.join(racine, f)));
const PM = globalThis.PM, M = PM.modele, GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue;

const MOTIF = [[1, 1], [4, 1], [2, 2], [3, 2], [2, 3], [3, 3], [1, 4], [4, 4]];
const CENTRE = new Set(['2,2', '3,2', '2,3', '3,3']);
const doc = CAT.nouveauDocument('5x5');
const ctx = GEN.contexteDocument5x5(doc), F = ctx.F, nJ = 16;
const idx = (i, j) => (j - 1) * 4 + (i - 1);
const villes = new Array(nJ).fill(0), centre = new Array(nJ).fill(0);
MOTIF.forEach(([i, j]) => { villes[idx(i, j)] = 1; if (CENTRE.has(i + ',' + j)) centre[idx(i, j)] = 1; });
const jetons = MOTIF.map(([i, j]) => ({ i, j, type: 'capture' }));
const minPorts = (y) => (villes[y] ? 3 : 2);
const NB_PLATEAUX = +process.argv[2] || 300, NB_COMPO = +process.argv[3] || 300;

/* 1. Preuve sur la cellule du milieu */
const profils = {};
doc.modeles.forEach((m) => { profils[m.id] = null; });
const centrales = doc.modeles.filter((m) => m.gabarit === 'centrale');
const cMilieu = ctx.cellules.find((c) => c.col === 2 && c.lig === 2);
const kMilieu = ctx.cellules.indexOf(cMilieu);
const preuve = centrales.map((m) => {
  // optionsCellule a besoin des profils : on passe par composer5x5 sur une copie dont la seule centrale est m
  const d2 = JSON.parse(JSON.stringify(doc));
  d2.modeles.forEach((x) => { if (x.gabarit === 'centrale' && x.id !== m.id) x.exemplaires = 0; });
  const c2 = GEN.contexteDocument5x5(d2), comp = GEN.composer5x5(c2, GEN.mulberry32(1));
  const opts = comp.options[kMilieu];
  const partagees = opts.filter((o) => o.groupes.some((g) => g.filter((x) => centre[x]).length >= 2)).length;
  return { modele: m.id, orientations: opts.length, avecPaireCentraleA1Case: partagees };
});

/* Utilitaires */
function groupesVilles(o) { return o.groupes.map((g) => g.filter((x) => villes[x])); }
/** Une option est-elle interdite ? (case qui dessert deux villes ; `partageCentre` : permis si les deux sont du carré central) */
function interdite(o, partageCentre) {
  return groupesVilles(o).some((v) => v.length >= 2 && !(partageCentre && v.every((x) => centre[x])));
}
/** Paires de villes desservies par une même case de l'option (clé « x-y »). */
function pairesPartagees(o) { const res = []; groupesVilles(o).forEach((v) => { for (let a = 0; a < v.length; a++) for (let b = a + 1; b < v.length; b++) res.push(v[a] + '-' + v[b]); }); return res; }
const voisinsCentre = (p) => CENTRE.has(p.a.i + ',' + p.a.j) && CENTRE.has(p.b.i + ',' + p.b.j) && Math.abs(p.a.i - p.b.i) + Math.abs(p.a.j - p.b.j) === 1;
function docDe(choix, rng) {
  const tuiles = ctx.cellules.map((c, q) => ({ modeleId: choix[q].modeleId, col: c.col, lig: c.lig, rot: choix[q].rots[Math.floor(rng() * choix[q].rots.length)] }));
  return { version: doc.version, grille: '5x5', modeles: doc.modeles, plateau: { tuiles, jetons } };
}
/** Critères complets. `regle` : 'a', 'b' ou 'v' (variante : paires à 1 case permises entre voisines du carré central). */
function juger(d, regle, maxPaires) {
  const g = GR.construire(d, { villesTraversables: false });
  if (!GR.connexe(g)) return 'connexite';
  const pr = GR.villesProches(g);
  if (regle === 'a' && pr.length) return 'villes_proches';
  if (regle === 'b' && !pr.every((p) => voisinsCentre(p) && p.pas >= 3)) return 'villes_proches';
  if (regle === 'v' && !pr.every((p) => voisinsCentre(p) && p.pas >= 2)) return 'villes_proches';
  if (regle === 'v' && maxPaires !== undefined && pr.filter((p) => p.pas === 2).length > maxPaires) return 'villes_proches';
  if (g.jonctions.some((jn) => jn.ports < minPorts(idx(jn.i, jn.j)))) return 'ports';
  if (!GR.connexions(d, g).conforme) return 'connexions';
  const e = GR.equilibre(d, { graphe: g, nbVilles: 8 });
  if (e.S === null) return 'ville_inaccessible';
  if (Math.max(e.partage[1], e.partage[2]) >= 6 || e.ecartMax7 > 2 || !e.premiereEgale || e.S >= 5) return 'equilibre';
  return null;
}

/**
 * Recherche exacte (budget de nœuds) : orientations qui tiennent les ports (2 par jonction, 3 par ville), options filtrées par
 * `interdite`, au plus petit nombre de PAIRES DISTINCTES de villes desservies par une même case (à 1 case d'écart) ; jusqu'à `k` orientations optimales tirées au hasard
 * (ordre des options mélangé, échantillon de réservoir). Renvoie { min, feuilles, tronque }.
 */
function rechercher(options, partageCentre, k, rng, budget) {
  const permises = options.map((l) => l.filter((o) => !interdite(o, partageCentre)).map((o) => ({ o, p: pairesPartagees(o), r: rng() })).sort((a, b) => a.r - b.r));
  if (permises.some((l) => !l.length)) return { min: null, feuilles: [], tronque: false };
  const n = permises.length, compte = new Array(nJ).fill(0), choix = [], paires = {};
  const reste = []; for (let d = 0; d < n; d++) reste.push(new Array(nJ).fill(0));
  for (let d = n - 2; d >= 0; d--) { const s = new Array(nJ).fill(0); permises[d + 1].forEach((x) => x.o.jn.forEach((y) => { s[y] = 1; })); for (let y = 0; y < nJ; y++) reste[d][y] = reste[d + 1][y] + s[y]; }
  let best = Infinity, vus = 0, feuilles = [], noeuds = 0, tronque = false;
  (function vis(p, cout) {
    if (p === n) {
      if (cout < best) { best = cout; vus = 0; feuilles = []; }
      vus++;
      if (feuilles.length < k) feuilles.push(choix.slice()); else { const r = Math.floor(rng() * vus); if (r < k) feuilles[r] = choix.slice(); }
      return;
    }
    for (const x of permises[p]) {
      if (++noeuds > budget) { tronque = true; return; }
      const plus = x.p.filter((q) => !paires[q]).length;
      if (cout + plus > best) continue;
      x.o.jn.forEach((y) => compte[y]++); x.p.forEach((q) => { paires[q] = (paires[q] || 0) + 1; }); choix[p] = x.o;
      let ok = true; for (let y = 0; y < nJ && ok; y++) if (compte[y] + reste[p][y] < minPorts(y)) ok = false;
      if (ok) vis(p + 1, cout + plus);
      x.o.jn.forEach((y) => compte[y]--); x.p.forEach((q) => { paires[q]--; });
      if (tronque) return;
    }
  })(0, 0);
  return { min: isFinite(best) ? best : null, feuilles, tronque };
}

/* 2. Boucle du générateur, règles (a) et (b) */
function plateau(graine, regle, maxPaires) {
  const rng = GEN.mulberry32(GEN.hacher(graine)), t0 = process.hrtime.bigint();
  let essais = 0, echecs = 0, candidats = 0, abandon = false;
  while (essais < 1000 && candidats < 200) {
    if (echecs >= 25) { abandon = true; break; }
    essais++;
    const comp = GEN.composer5x5(ctx, rng);
    if (comp.cause) { echecs++; continue; }
    const v = regle === 'v', r = rechercher(comp.options, v, v ? 20 : 1, rng, 400000);
    if (r.min === null) { echecs++; continue; }
    echecs = 0;
    if (r.feuilles.some((ch) => !juger(docDe(ch, rng), regle, maxPaires))) candidats++;
  }
  return { ok: candidats > 0, essais, candidats, abandon, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}
const generateur = {};
['a', 'b'].forEach((regle) => {
  const res = [];
  for (let n = 0; n < NB_PLATEAUX; n++) res.push(plateau('f' + n, regle));
  const ms = res.map((r) => r.ms).sort((x, y) => x - y);
  generateur[regle] = {
    plateaux: res.length, reussis: res.filter((r) => r.ok).length, abandons: res.filter((r) => r.abandon).length,
    essaisMoyens: res.reduce((s, r) => s + r.essais, 0) / res.length,
    msMoyen: Math.round(ms.reduce((s, x) => s + x, 0) / ms.length * 10) / 10, msMax: Math.round(ms[ms.length - 1] * 10) / 10
  };
});

// variantes hors règles au niveau du plateau (même boucle) : au plus 1 paire, ou toutes les paires voisines du carré central, à 1 case
[['v1', 1], ['v4', undefined]].forEach(([nom, maxP]) => {
  const res = [];
  for (let n = 0; n < Math.ceil(NB_PLATEAUX / 3); n++) res.push(plateau('f' + n, 'v', maxP));
  const ms = res.map((r) => r.ms).sort((x, y) => x - y);
  generateur[nom] = {
    plateaux: res.length, reussis: res.filter((r) => r.ok).length, candidatsMoyens: res.reduce((s, r) => s + r.candidats, 0) / res.length,
    essaisMoyens: res.reduce((s, r) => s + r.essais, 0) / res.length,
    msMoyen: Math.round(ms.reduce((s, x) => s + x, 0) / ms.length), msMax: Math.round(ms[ms.length - 1])
  };
});

/* 3. Variantes hors règles : paires à 1 case permises entre voisines du carré central */
const rngV = GEN.mulberry32(20261019), variantes = { compositions: 0, lc4Milieu: 0, min: {}, tronquees: 0, parCas: {}, okQuelconque: 0, causes: {} };
const t0v = Date.now();
for (let n = 0; n < NB_COMPO; n++) {
  const comp = GEN.composer5x5(ctx, rngV);
  if (comp.cause) continue;
  variantes.compositions++;
  const lc4 = comp.ids[kMilieu] === 'LC4';
  if (lc4) variantes.lc4Milieu++;
  const r = rechercher(comp.options, true, 20, rngV, 400000);
  if (r.tronque) variantes.tronquees++;
  variantes.min[r.min] = (variantes.min[r.min] || 0) + 1;
  let ok = false;
  r.feuilles.forEach((ch) => { if (ok) return; const c = juger(docDe(ch, rngV), 'v'); if (!c) ok = true; else variantes.causes[c] = (variantes.causes[c] || 0) + 1; });
  const cle = (lc4 ? 'LC4 au milieu' : 'autre centrale au milieu') + ', min ' + r.min + ' paire(s)';
  variantes.parCas[cle] = variantes.parCas[cle] || { compositions: 0, critèresComplets: 0 };
  variantes.parCas[cle].compositions++;
  if (ok) { variantes.parCas[cle].critèresComplets++; variantes.okQuelconque++; }
}
variantes.ms = Date.now() - t0v;

console.log(JSON.stringify({ preuve, generateur, variantes }, null, 1));
