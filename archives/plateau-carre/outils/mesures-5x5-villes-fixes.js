'use strict';
/*
 * Mesures du VRAI générateur 5×5 (8 villes aux positions par défaut, catalogue « P » de docs/66 ; décisions de docs/18 du 2026-10-19).
 * Usage : node outils/mesures-5x5-villes-fixes.js [plateaux = 200] [préfixe de graine = « m »]
 * Pour chaque graine : PM.generateur.generer sur le catalogue 5×5 livré, temps processeur, puis mesures du plateau rendu (connexité,
 * paires de villes à moins de 3 cases, chaîne du rythme, cases à 2 connexions ou moins, S, majorités « 5 contre 3 » / « 6 contre 2 »,
 * partage symétrique, cases par plateau, raccords morts hors murs voulus, placements libres encore admissibles).
 * Contrôle des placements libres : sur chaque plateau rendu, « Placer les villes » (meilleurPlacementVilles) et le nombre de placements
 * 2-2-2-2 admissibles ; sur des plateaux tirés sans villes, les deux damiers sont-ils admissibles ?
 * Sortie : un résumé lisible, puis une ligne JSON (résumé complet).
 */
const path = require('path');
['geometrie', 'modele', 'catalogue', 'graphe', 'rendu', 'generateur'].forEach((f) => require(path.join(__dirname, '..', 'src', f + '.js')));
const PM = globalThis.PM, M = PM.modele, GR = PM.graphe, GEN = PM.generateur;

const NB = +(process.argv[2] || 200), PREFIXE = process.argv[3] || 'm';
const doc = PM.catalogue.nouveauDocument('5x5');
const moy = (t) => (t.length ? Math.round(t.reduce((s, x) => s + x, 0) / t.length * 100) / 100 : null);
const centile = (t, q) => { if (!t.length) return null; const u = t.slice().sort((a, b) => a - b); return u[Math.min(u.length - 1, Math.floor(q * u.length))]; };
const damier = (p) => { const r = []; for (let j = 1; j <= 4; j++) for (let i = 1; i <= 4; i++) if ((i + j) % 2 === p) r.push(`${i},${j}`); return r.sort().join(' '); };
const DAMIERS = [damier(0), damier(1)];

const res = [];
for (let k = 0; k < NB; k++) {
  const t0 = process.cpuUsage(), h0 = process.hrtime.bigint();
  const r = GEN.generer(doc, { graine: PREFIXE + k });
  const cpu = (process.cpuUsage(t0).user + process.cpuUsage(t0).system) / 1000, ms = Number(process.hrtime.bigint() - h0) / 1e6;
  if (!r.ok) { res.push({ k, ok: false, ms, cpu, raison: r.raison }); continue; }
  const d = r.doc, g = GR.construire(d, { villesTraversables: false }), e = GR.equilibre(d, { graphe: g }), cx = GR.connexions(d, g);
  const ad = GEN.placementsAdmissibles(d).placements.map((pl) => pl.map((v) => `${v.i},${v.j}`).sort().join(' '));
  const pv = GEN.meilleurPlacementVilles(d);
  const motif = GR.MOTIF_VILLES_5X5.map((v) => `${v.i},${v.j}`).sort().join(' ');
  res.push({
    k, ok: true, ms, cpu, essais: r.essais, candidats: r.candidats,
    villesMotif: d.plateau.jetons.map((v) => `${v.i},${v.j}`).sort().join(' ') === motif,
    connexe: GR.connexe(g), proches: GR.villesProches(g).length, chaine: r.score.chaine, faibles: cx.faibles, part: cx.part, degre: cx.degreMoyen,
    S: e.S, cinqTrois: !!e.cinqContreTrois, sixDeux: !!e.cinqContreDeux, symetrique: !!e.partageSymetrique, ecartMax: e.ecartMax7,
    blocages: e.blocages.length, alertes: e.alertes.map((a) => a.code), cases: r.score.cases.total,
    morts: M.raccordsMorts(d).filter((x) => x.raison !== 'absent' && !x.mur).length, articulations: r.score.articulations,
    admissibles: ad.length, damiersAdmissibles: DAMIERS.filter((x) => ad.includes(x)).length, placerOk: pv.ok, placerMotif: !!pv.motif,
    centrales: d.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, M.formatDuDocument(d)) === 'centrale').map((t) => t.modeleId).sort().join(',')
  });
}
const ok = res.filter((x) => x.ok);
const resume = {
  plateaux: NB, reussis: ok.length,
  tempsMs: { moyen: moy(res.map((x) => x.ms)), p95: centile(res.map((x) => x.ms), 0.95), max: Math.max(...res.map((x) => x.ms)) },
  cpuMs: { moyen: moy(res.map((x) => x.cpu)), max: Math.max(...res.map((x) => x.cpu)) },
  essaisMoyens: moy(ok.map((x) => x.essais)), candidatsMoyens: moy(ok.map((x) => x.candidats)),
  villesAuxPositionsParDefaut: ok.filter((x) => x.villesMotif).length,
  connexes: ok.filter((x) => x.connexe).length, plateauxAvecVillesProches: ok.filter((x) => x.proches).length,
  chaine: { moyenne: moy(ok.map((x) => x.chaine)), max: Math.max(...ok.map((x) => x.chaine)), auPlus3: ok.filter((x) => x.chaine <= 3).length },
  casesFaibles: { partMoyennePct: moy(ok.map((x) => x.part * 100)), partMaxPct: Math.round(Math.max(...ok.map((x) => x.part * 100)) * 10) / 10, au5pctOuPlus: ok.filter((x) => x.part >= 0.05).length },
  degreMoyen: moy(ok.map((x) => x.degre)),
  S: { moyen: moy(ok.map((x) => x.S)), max: Math.max(...ok.map((x) => x.S)), au4: ok.filter((x) => x.S === 4).length, au5ouPlus: ok.filter((x) => x.S >= 5).length },
  cinqContreTrois: ok.filter((x) => x.cinqTrois).length, sixContreDeux: ok.filter((x) => x.sixDeux).length, blocages: ok.filter((x) => x.blocages).length,
  partageSymetrique: ok.filter((x) => x.symetrique).length, ecartMaxRang: Math.max(...ok.map((x) => x.ecartMax)),
  plateauxAvecAlerteEquilibre: ok.filter((x) => x.alertes.length).length,
  cases: { moyenne: moy(ok.map((x) => x.cases)), min: Math.min(...ok.map((x) => x.cases)), max: Math.max(...ok.map((x) => x.cases)) },
  raccordsMortsMoyens: moy(ok.map((x) => x.morts)), articulationsMoyennes: moy(ok.map((x) => x.articulations)),
  placementsLibres: { admissiblesMoyens: moy(ok.map((x) => x.admissibles)), placerVillesOk: ok.filter((x) => x.placerOk).length, placerVillesAuMotif: ok.filter((x) => x.placerMotif).length, damierAdmissible: ok.filter((x) => x.damiersAdmissibles).length },
  compositionsDistinctes: new Set(ok.map((x) => x.centrales)).size,
  echecs: res.filter((x) => !x.ok).map((x) => ({ k: x.k, raison: x.raison }))
};
console.log(JSON.stringify(resume, null, 1));
