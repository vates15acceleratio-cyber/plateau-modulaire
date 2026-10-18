'use strict';
/*
 * mesures-5x5-connecte.js : mesures de contrôle du 5×5 très connecté (catalogue à 2 cases par tuile au plus, docs/53, docs/55, jeu « B3 » de docs/58 : LC1 à LC7,
 * décisions de docs/18 « 5×5 très connecté ») avec le VRAI générateur (PM.generateur.generer, options par défaut) ; rapports docs/56 et docs/59.
 *
 *   node outils/mesures-5x5-connecte.js [nombre de plateaux, 200] [préfixe des graines, « c »] [fichier JSON de sortie]
 *
 * Calcul réparti sur 4 fils (graines « <préfixe>0 », « <préfixe>1 »…) ; résumé écrit sur la sortie standard, détail par plateau dans
 * le fichier JSON s'il est donné. Mesures par plateau : réussite et temps, cases, connexions par case (PM.graphe.connexions : part de
 * cases à 2 connexions ou moins, degré moyen), ports par jonction, placements admissibles (PM.generateur.placementsAdmissibles5x5),
 * S, « 5 contre 2 », chaîne et distance maximale (PM.graphe.rythme), points d'articulation (goulets), raccords morts, composition et
 * plateau montable avec la boîte imprimée (exemplaires du catalogue livré). Le stock le plus petit qui monte 90 % des plateaux est
 * cherché sur les centrales (coins et bords : 4 et 12 par plateau).
 * Réutilisable : mesurerPlateau(r) (tests/mesures-5x5.test.js), stockMinimal(compositions, part).
 */
const path = require('path');
const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('node:worker_threads');
const racine = path.join(__dirname, '..', 'src');
['geometrie.js', 'modele.js', 'catalogue.js', 'graphe.js', 'generateur.js'].forEach((f) => require(path.join(racine, f)));
const PM = globalThis.PM;
const M = PM.modele, GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue;
/** Ids des centrales du catalogue livré (LC1 à LC7). */
const IDS_CENTRALES = CAT.modelesParGrille['5x5'].filter((m) => m.gabarit === 'centrale').map((m) => m.id);

/** Mesures d'un résultat de PM.generateur.generer (plateau 5×5 réussi). */
function mesurerPlateau(r) {
  const d = r.doc, g = GR.construire(d, { villesTraversables: false });
  const cx = GR.connexions(d, g), e = GR.equilibre(d, { graphe: g }), ry = GR.rythme(d, g);
  const composition = {};
  d.plateau.tuiles.forEach((t) => { composition[t.modeleId] = (composition[t.modeleId] || 0) + 1; });
  const stock = Object.fromEntries(d.modeles.map((m) => [m.id, m.exemplaires]));
  const pj = GEN.portsParJonction(d);
  return {
    cases: r.score.cases.total, casesConnexions: cx.cases, faibles: cx.faibles, part: cx.part, degreMoyen: cx.degreMoyen, parDegre: cx.parDegre,
    ports: pj, portsTotal: pj.reduce((a, b) => a + b, 0), admissibles: GEN.placementsAdmissibles5x5(d),
    S: e.S, cinq: e.cinqContreDeux, chaine: ry.chaineMax, distMax: ry.distMax,
    articulations: GR.goulets(g, 1).articulations.length + GR.goulets(g, 2).articulations.length,
    raccordsMorts: M.raccordsMorts(d).filter((x) => x.raison !== 'absent').length, villesProches: GR.villesProches(g).length,
    acces: r.score.acces.ecart, moities: r.score.cases.ecart, composition,
    plateau: d.plateau.tuiles.map((t) => t.modeleId + '@' + t.col + t.lig + 'r' + (t.rot || 0)).sort().join(','),
    chaineSans: GR.rythme(d, g, { sansJonctions: true }).chaineMax,
    villes: d.plateau.jetons.map((j) => j.i + ',' + j.j).sort().join(' '),
    montable: Object.keys(composition).every((id) => composition[id] <= stock[id])
  };
}

/** Plus petit stock de centrales (somme minimale, puis ordre lexicographique) qui monte au moins `part` des compositions. */
function stockMinimal(compositions, part, ids) {
  ids = ids || IDS_CENTRALES;
  const besoin = Math.ceil(part * compositions.length), max = ids.map((id) => Math.max(0, ...compositions.map((c) => c[id] || 0)));
  let meilleur = null;
  const s = new Array(ids.length).fill(0);
  (function rec(k) {
    if (k === ids.length) {
      const total = s.reduce((a, b) => a + b, 0);
      if (meilleur && total > meilleur.total) return;
      const n = compositions.filter((c) => ids.every((id, q) => (c[id] || 0) <= s[q])).length;
      if (n >= besoin && (!meilleur || total < meilleur.total)) meilleur = { total, stock: Object.fromEntries(ids.map((id, q) => [id, s[q]])), part: n / compositions.length };
      return;
    }
    for (let v = 0; v <= max[k]; v++) { s[k] = v; rec(k + 1); }
  })(0);
  return meilleur;
}

function travailler(prefixe, debut, fin) {
  const doc = CAT.nouveauDocument('5x5'), res = [];
  for (let k = debut; k < fin; k++) {
    const t0 = Date.now(), r = GEN.generer(doc, { graine: prefixe + k }), ms = Date.now() - t0;
    res.push(r.ok ? Object.assign({ k, ok: true, ms, essais: r.essais }, mesurerPlateau(r)) : { k, ok: false, ms, raison: r.raison });
  }
  return res;
}

const moy = (t) => t.length ? t.reduce((a, b) => a + b, 0) / t.length : null;
const pct = (x) => (Math.round(x * 1000) / 10).toString().replace('.', ',') + ' %';
const dec = (x, n) => x === null ? '—' : (Math.round(x * 10 ** n) / 10 ** n).toString().replace('.', ',');

/** Résumé texte d'une série de mesures. */
function resume(res) {
  const ok = res.filter((x) => x.ok), L = [];
  const rep = (f) => { const c = {}; ok.forEach((x) => { const v = f(x); c[v] = (c[v] || 0) + 1; }); return Object.keys(c).sort((a, b) => a - b).map((v) => v + ' : ' + c[v]).join(', '); };
  L.push('Plateaux : ' + res.length + ' ; réussis : ' + ok.length + ' (' + pct(ok.length / res.length) + ') ; temps moyen ' + Math.round(moy(res.map((x) => x.ms))) + ' ms (max ' + Math.max(...res.map((x) => x.ms)) + ' ms)');
  L.push('Cases par plateau : ' + rep((x) => x.cases));
  L.push('Cases à 2 connexions ou moins : moyenne ' + pct(moy(ok.map((x) => x.part))) + ' ; plateaux sous 5 % : ' + pct(ok.filter((x) => x.part < 0.05).length / ok.length) + ' ; par plateau : ' + rep((x) => x.faibles));
  const deg = {}; ok.forEach((x) => Object.keys(x.parDegre).forEach((d) => { deg[d] = (deg[d] || 0) + x.parDegre[d]; }));
  const totDeg = Object.values(deg).reduce((a, b) => a + b, 0);
  L.push('Connexions (toutes cases comptées) : ' + Object.keys(deg).sort((a, b) => a - b).map((d) => d + ' : ' + pct(deg[d] / totDeg)).join(', ') + ' ; degré moyen ' + dec(moy(ok.map((x) => x.degreMoyen)), 2));
  const pj = {}; ok.forEach((x) => x.ports.forEach((p) => { pj[p] = (pj[p] || 0) + 1; }));
  L.push('Ports par jonction (16 × plateaux) : ' + Object.keys(pj).sort((a, b) => a - b).map((p) => p + ' : ' + pj[p]).join(', ') + ' ; ports par plateau : ' + rep((x) => x.portsTotal));
  L.push('Placements admissibles par plateau : moyenne ' + dec(moy(ok.map((x) => x.admissibles)), 1) + ' (min ' + Math.min(...ok.map((x) => x.admissibles)) + ', max ' + Math.max(...ok.map((x) => x.admissibles)) + ')');
  const diff = new Set(ok.map((x) => x.villes)).size;
  L.push('S : moyenne ' + dec(moy(ok.map((x) => x.S)), 2) + ' (' + rep((x) => x.S) + ') ; « 5 contre 2 » : ' + ok.filter((x) => x.cinq).length + ' ; villes trop proches : ' + ok.filter((x) => x.villesProches).length);
  L.push('Chaîne : moyenne ' + dec(moy(ok.map((x) => x.chaine)), 2) + ' (' + rep((x) => x.chaine) + ') ; distMax : moyenne ' + dec(moy(ok.map((x) => x.distMax)), 2) + ' (' + rep((x) => x.distMax) + ')');
  L.push('Points d\'articulation : ' + rep((x) => x.articulations) + ' ; raccords morts : ' + rep((x) => x.raccordsMorts));
  L.push('Écart d\'accès : ' + rep((x) => Math.abs(x.acces)) + ' ; écart de cases entre moitiés : ' + rep((x) => x.moities));
  IDS_CENTRALES.forEach((id) => L.push('Composition ' + id + ' : ' + rep((x) => x.composition[id] || 0)));
  L.push('Montable avec la boîte : ' + pct(ok.filter((x) => x.montable).length / ok.length));
  const sm = stockMinimal(ok.map((x) => x.composition), 0.9);
  if (sm) L.push('Stock minimal des centrales pour 90 % : ' + JSON.stringify(sm.stock) + ' (' + sm.total + ' centrales, ' + pct(sm.part) + ')');
  if (diff) L.push('Placements de villes différents : ' + diff);
  const compo = (x) => IDS_CENTRALES.map((id) => id + 'x' + (x.composition[id] || 0)).join(' ');
  L.push('Compositions de centrales différentes : ' + new Set(ok.map(compo)).size + ' ; plateaux différents : ' + new Set(ok.map((x) => x.plateau)).size);
  L.push('Chaîne sans les jonctions (ancienne mesure) : moyenne ' + dec(moy(ok.map((x) => x.chaineSans)), 2));
  return L.join('\n');
}

if (!isMainThread) {
  parentPort.postMessage(travailler(workerData.prefixe, workerData.debut, workerData.fin));
} else if (require.main === module) {
  const nb = Number(process.argv[2]) || 200, prefixe = process.argv[3] || 'c', sortie = process.argv[4], FILS = 4, taille = Math.ceil(nb / FILS);
  const travaux = [];
  for (let d = 0; d < nb; d += taille) {
    travaux.push(new Promise((ok, ko) => {
      const w = new Worker(__filename, { workerData: { prefixe, debut: d, fin: Math.min(nb, d + taille) } });
      w.once('message', ok); w.once('error', ko);
    }));
  }
  Promise.all(travaux).then((parts) => {
    const res = [].concat(...parts);
    if (sortie) fs.writeFileSync(sortie, JSON.stringify(res));
    console.log(resume(res));
  });
}

module.exports = { IDS_CENTRALES, mesurerPlateau, stockMinimal, resume, travailler };
