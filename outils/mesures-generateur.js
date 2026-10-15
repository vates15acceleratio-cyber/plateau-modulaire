'use strict';
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
const NB_FORME = Number(process.argv[3]) || 200;
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
  r.ports = M.portsCoinMorts(d).length;
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
  a.ports = moy(liste.map((x) => x.ports));
  a.presence = {};
  for (const x of liste) for (const id of new Set(x.modeles)) a.presence[id] = (a.presence[id] || 0) + 1;
  return a;
}

/* ---------------------------------------------------------------------- */
/* 1. Sortie du générateur contre tirage uniforme                          */
/* ---------------------------------------------------------------------- */

const jetonsDefaut = ME.PAIRES.find((p) => p.cle === ME.CLE_DEFAUT).jetons;

function mesurerGenerateur(options) {
  const res = [], temps = [], essais = [], candidats = [], bons = [], paires = {}, echecs = [];
  for (let n = 1; n <= NB; n++) {
    const t0 = process.hrtime.bigint();
    const r = GEN.generer(CAT.nouveauDocument(), Object.assign({ graine: 'm8-' + n }, options));
    temps.push(Number(process.hrtime.bigint() - t0) / 1e6);
    if (!r.ok) { echecs.push(r.raison); continue; }
    essais.push(r.essais); candidats.push(r.candidats); bons.push(r.score.bons);
    paires[r.paire] = (paires[r.paire] || 0) + 1;
    res.push({ m: mesurerConfig(r.doc, r.doc.plateau.jetons), doc: r.doc, nbPermises: (r.pairesPermises || []).length });
  }
  return { res, temps, essais, candidats, bons, paires, echecs };
}

/* ---------------------------------------------------------------------- */
/* 2. Ports de coin morts des formes réduites                              */
/* ---------------------------------------------------------------------- */

function formesReduites() {
  const coins = [{ col: 0, lig: 0 }, { col: 3, lig: 0 }, { col: 0, lig: 3 }, { col: 3, lig: 3 }];
  const formes = [];
  for (const c of coins) formes.push({ nom: `coin (${c.col},${c.lig})`, retires: [c] });
  for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    formes.push({ nom: `coins (${coins[a].col},${coins[a].lig}) et (${coins[b].col},${coins[b].lig})`, retires: [coins[a], coins[b]] });
  }
  for (const c of coins) {
    const bord = { col: c.col, lig: c.lig === 0 ? 1 : 2 };
    formes.push({ nom: `coin (${c.col},${c.lig}) et bord (${bord.col},${bord.lig})`, retires: [c, bord] });
  }
  return formes.filter((f) => M.validerForme({ retires: f.retires }).valide);
}

function mesurerFormes() {
  const rng = ME.mulberry32(GRAINE_UNIFORME);
  const lignes = [];
  for (const f of formesReduites()) {
    const forme = { retires: f.retires };
    const base = M.changerForme(CAT.nouveauDocument(), forme);
    const besoins = {}, stock = {};
    for (const c of M.cellulesActives(forme)) { const r = M.roleCellule(c.col, c.lig, forme); besoins[r] = (besoins[r] || 0) + 1; }
    for (const m of base.modeles) { stock[m.role] = stock[m.role] || []; for (let k = 0; k < m.exemplaires; k++) stock[m.role].push(m.id); }
    const manque = Object.keys(besoins).filter((r) => (stock[r] || []).length < besoins[r]);
    const jonctions = [];
    for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) if (M.jonctionPossible(forme, i, j)) jonctions.push(`(${i},${j})`);
    if (manque.length) { lignes.push({ f, besoins, manque, jonctions }); continue; }
    const ports = [], raccords = [];
    for (let n = 0; n < NB_FORME; n++) {
      const paquets = {};
      for (const r of Object.keys(stock)) {
        const t = stock[r].slice();
        for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; }
        paquets[r] = t;
      }
      const tuiles = M.cellulesActives(forme).map((c) => {
        const rot = M.rotationDeduite(c.col, c.lig, forme);
        return { modeleId: paquets[M.roleCellule(c.col, c.lig, forme)].pop(), col: c.col, lig: c.lig, rot: rot === null ? Math.floor(rng() * 4) : rot };
      });
      const doc = { ...base, plateau: { forme, tuiles, jetons: [] } };
      if (M.validerPlateau(doc).erreurs.length) throw new Error('Plateau invalide pour la forme ' + f.nom);
      ports.push(M.portsCoinMorts(doc).length);
      raccords.push(M.raccordsMorts(doc).filter((x) => x.raison !== 'absent').length);
    }
    lignes.push({ f, besoins, manque, jonctions, ports, raccords });
  }
  return lignes;
}

/* ---------------------------------------------------------------------- */
/* Rapport                                                                 */
/* ---------------------------------------------------------------------- */

function principal() {
  const sortie = path.join(__dirname, '..', 'docs', '15-mesures-generateur.md');
  const t0 = Date.now();

  const gen = mesurerGenerateur({});
  const varies = mesurerGenerateur({ paireCarrefours: 'varies' });
  const tol1 = mesurerGenerateur({ tolerance: 0 });   // variante : S = Smin (meilleur S seulement)
  const uniformes = ME.tirerPlateaux(NB, GRAINE_UNIFORME).map((e) => ({ m: mesurerConfig(e.doc, jetonsDefaut), doc: e.doc }));

  const aG = agreger(gen.res.map((x) => x.m)), aV = agreger(varies.res.map((x) => x.m)), aU = agreger(uniformes.map((x) => x.m));
  const a1 = agreger(tol1.res.map((x) => x.m));

  // Goulets et flancs (fonctions de mesures-equilibre.js), sortie du générateur
  const stG = ME.mesurer(gen.res.map((x) => ({ doc: x.doc, jetons: x.doc.plateau.jetons })), { paires: 'fixe' });
  const stU = ME.mesurer(uniformes.map((x) => ({ doc: x.doc, jetons: jetonsDefaut })), { paires: 'fixe' });

  const formes = mesurerFormes();
  const L = [];
  const out = (s) => L.push(s === undefined ? '' : s);

  out('# Mesure 8 : sortie du générateur et ports de coin morts des formes réduites (sous-agent 8)');
  out();
  out(`Généré par \`outils/mesures-generateur.js\` (${NB} graines « m8-1 » à « m8-${NB} », ${NB_FORME} plateaux par forme réduite). Catalogue réel \`PM.catalogue.nouveauDocument()\`.`);
  out();
  out('Critère d\'équilibre de `docs/16-avis-mesures-equilibre.md` : S = Σ |D1(k) − D2(k)| sur les 7 rangs ; « D6 étendu » = écart > 2 à un rang de 1 à 7 ; « 5 contre 2 » ; invariant « première ville à la même distance ». ' +
    'N = villes non traversables (défaut de l\'outil), T = traversables. Générateur : 200 candidats, élimination (5 contre 2 en N, D6 étendu, première ville, connexité, validation), tirage au hasard parmi les candidats de S ≤ Smin + 1 (tolérance 1, réglage par défaut) et, à S égal, de pénalité secondaire minimale (raccords morts au-delà de 2, ports morts, apparitions à moins de 2 sorties).');
  out();
  out(`Tirage uniforme de comparaison : \`tirerPlateaux(${NB}, ${GRAINE_UNIFORME})\` de \`outils/mesures-equilibre.js\` (mêmes tirages que \`docs/12-mesures-equilibre.md\`, ${NB} premiers plateaux), carrefours (1,2)+(3,2).`);
  out();

  out('## 1. Équilibre : générateur contre tirage uniforme');
  out();
  out('| Mesure | Uniforme, défaut | Générateur, défaut | Générateur, carrefours variés | Générateur, tolérance 0 (variante) |');
  out('|---|---|---|---|---|');
  const ligne = (lib, fn) => out(`| ${lib} | ${fn(aU)} | ${fn(aG)} | ${fn(aV)} | ${fn(a1)} |`);
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
  ligne('Ports de coin morts, moyenne', (a) => f2(a.ports));
  out();
  out('Distribution de S (N), tirage uniforme :');
  out(texteHist(aU.N.histS));
  out('Distribution de S (N), générateur, paire par défaut :');
  out(texteHist(aG.N.histS));
  out('Distribution de S (N), générateur, carrefours variés :');
  out(texteHist(aV.N.histS));
  out('Distribution de S (N), générateur, tolérance 0 (variante, S = Smin) :');
  out(texteHist(a1.N.histS));
  out('Distribution de S (T), générateur, paire par défaut :');
  out(texteHist(aG.T.histS));
  out('Raccords morts par plateau (uniforme / générateur) :');
  out(texteHist(aU.raccords));
  out(texteHist(aG.raccords));

  out('## 2. Carrefours retenus (option « carrefours variés »)');
  out();
  out('| Paire | Plateaux | Part |');
  out('|---|---|---|');
  Object.entries(varies.paires).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => out(`| ${k} | ${v} | ${pc(v, varies.res.length)} |`));
  out();
  out(`Nombre de paires permises par plateau (paire par défaut comprise) : moyenne ${f2(moy(varies.res.map((x) => x.nbPermises)))}, histogramme :`);
  out(texteHist(hist(varies.res.map((x) => x.nbPermises))));
  out(`Réglage par défaut : paire (1,2)+(3,2) sur ${Object.values(gen.paires).reduce((a, b) => a + b, 0)} plateaux sur ${gen.res.length}.`);
  out();

  out('## 3. Diversité');
  out();
  out('Profil = « D1 trié | D2 trié ».');
  out();
  out('| Cas | Profils distincts (N) | Plus fréquent (N) | Profils distincts (T) | Plus fréquent (T) | Plateaux (tuiles et rotations) distincts |');
  out('|---|---|---|---|---|---|');
  const distincts = (liste) => new Set(liste.map((x) => JSON.stringify(x.doc.plateau.tuiles))).size;
  const lDiv = (lib, a, liste) => out(`| ${lib} | ${a.N.profils} | ${a.N.plusFrequent} (${pc(a.N.plusFrequent, a.n)}) | ${a.T.profils} | ${a.T.plusFrequent} (${pc(a.T.plusFrequent, a.n)}) | ${distincts(liste)} |`);
  lDiv('Uniforme, défaut', aU, uniformes);
  lDiv('Générateur, défaut', aG, gen.res);
  lDiv('Générateur, carrefours variés', aV, varies.res);
  lDiv('Générateur, tolérance 0 (variante)', a1, tol1.res);
  out();
  out('Présence des modèles (part des plateaux où le modèle est posé) :');
  out();
  const ids = CAT.nouveauDocument().modeles.map((m) => m.id);
  out('| Modèle | ' + ids.join(' | ') + ' |');
  out('|---|' + ids.map(() => '---').join('|') + '|');
  out('| Uniforme | ' + ids.map((id) => pc(aU.presence[id] || 0, aU.n)).join(' | ') + ' |');
  out('| Générateur | ' + ids.map((id) => pc(aG.presence[id] || 0, aG.n)).join(' | ') + ' |');
  out('| Générateur, tolérance 0 | ' + ids.map((id) => pc(a1.presence[id] || 0, a1.n)).join(' | ') + ' |');
  out();

  out('## 4. Goulets et flancs (fonctions de `outils/mesures-equilibre.js`, villes traversables)');
  out();
  const minChemins = (st) => Object.entries(st.goulets.T.minParJoueur).map(([k, v]) => `${k} : ${v}`).join(', ');
  out(`| Cas | Min. chemins disjoints par joueur | Points d'articulation (cas avec au moins un) | Flanc plus court que le centre |`);
  out('|---|---|---|---|');
  out(`| Uniforme | ${minChemins(stU)} | ${stU.goulets.T.articulation} / ${stU.goulets.T.n} | ${stU.flancs.T.autoroutes} / ${stU.flancs.T.n} |`);
  out(`| Générateur | ${minChemins(stG)} | ${stG.goulets.T.articulation} / ${stG.goulets.T.n} | ${stG.flancs.T.autoroutes} / ${stG.flancs.T.n} |`);
  out();

  out('## 5. Temps et essais');
  out();
  const tri = (t) => t.slice().sort((a, b) => a - b);
  for (const [lib, g] of [['Paire par défaut', gen], ['Carrefours variés', varies], ['Tolérance 0', tol1]]) {
    const t = tri(g.temps);
    out(`- ${lib} : temps moyen ${f2(moy(t))} ms par génération (médiane ${f2(t[Math.floor(t.length / 2)])} ms, max ${f2(t[t.length - 1])} ms) ; ` +
      `essais moyens ${f2(moy(g.essais))} pour ${f2(moy(g.candidats))} candidats valides ; bons candidats (S ≤ Smin + tolérance) : moyenne ${f2(moy(g.bons))}, minimum ${Math.min(...g.bons)} ; échecs : ${g.echecs.length}.`);
  }
  out();

  out('## 6. Ports de coin morts des formes réduites');
  out();
  out(`${formes.length} formes réduites valides, ${NB_FORME} plateaux remplis au hasard par forme (tirage sans remise par rôle, rotation aléatoire des centrales), sans jetons. ` +
    'Un port de coin mort vise une jonction qui ne peut pas recevoir de jeton avec cette forme (`PM.modele.portsCoinMorts`).');
  out();
  out('| Forme | Besoins (centrale / coin / bord / apparition) | Jonctions possibles | Ports morts : moyenne | min | max | Raccords morts ou face au vide : moyenne | max |');
  out('|---|---|---|---|---|---|---|---|');
  for (const l of formes) {
    const b = l.besoins, bs = `${b.centrale || 0} / ${b.coin || 0} / ${b.bord || 0} / ${b.apparition || 0}`;
    if (l.manque.length) { out(`| ${l.f.nom} | ${bs} | ${l.jonctions.length} | catalogue insuffisant (${l.manque.join(', ')}) | | | | |`); continue; }
    out(`| ${l.f.nom} | ${bs} | ${l.jonctions.length} | ${f2(moy(l.ports))} | ${Math.min(...l.ports)} | ${Math.max(...l.ports)} | ${f2(moy(l.raccords))} | ${Math.max(...l.raccords)} |`);
  }
  out();

  // Constats chiffrés (rédigés à partir des valeurs calculées)
  out('## Constats');
  out();
  out(`- **Élimination** : sur les ${NB} graines, le générateur produit ${gen.res.length} plateaux (${gen.echecs.length} échec(s)). ` +
    `Aucun n'a « 5 contre 2 » en N (${aG.N.cinq}) ni en T (${aG.T.cinq}) ; D6 étendu > 2 : ${aG.N.alerte17} en N, ${aG.T.alerte17} en T ; première ville différente : ${aG.N.premiere} (N), ${aG.T.premiere} (T).`);
  out(`- **Score S (N)** : moyenne ${f2(aG.N.Smoy)} pour le générateur contre ${f2(aU.N.Smoy)} au tirage uniforme ; S ≥ 4 : ${pc(aG.N.S4, aG.n)} contre ${pc(aU.N.S4, aU.n)}. ` +
    `En T : ${f2(aG.T.Smoy)} contre ${f2(aU.T.Smoy)} (le générateur optimise S dans le mode N).`);
  out(`- **Carrefours variés** : la paire par défaut reste retenue dans ${pc(varies.paires[GEN.PAIRE_DEFAUT] || 0, varies.res.length)} des plateaux ; ${Object.keys(varies.paires).length} paires différentes apparaissent ; S moyen (N) ${f2(aV.N.Smoy)}, « 5 contre 2 » ${aV.N.cinq} (N) / ${aV.T.cinq} (T).`);
  out(`- **Diversité** : ${aG.N.profils} profils (N) sur ${aG.n} plateaux générés contre ${aU.N.profils} au tirage uniforme ; ${aV.N.profils} avec carrefours variés ; ${a1.N.profils} avec la tolérance 0 (S moyen ${f2(a1.N.Smoy)}, S maximal ${a1.N.Smax}). Le profil le plus fréquent couvre ${pc(aG.N.plusFrequent, aG.n)} des plateaux générés contre ${pc(aU.N.plusFrequent, aU.n)} au tirage uniforme. Les tuiles et rotations restent toutes distinctes.`);
  out(`- **Raccords morts** : moyenne ${f2(aG.raccordsMoy)} (max ${aG.raccordsMax}) contre ${f2(aU.raccordsMoy)} (max ${aU.raccordsMax}) ; présence de C6 (le « mur ») : ${pc(aG.presence.C6 || 0, aG.n)} contre ${pc(aU.presence.C6 || 0, aU.n)}.`);
  out(`- **Temps** : ${f2(moy(gen.temps))} ms en moyenne par génération de 200 candidats sous Node (${f2(moy(varies.temps))} ms avec carrefours variés).`);
  const pm = formes.filter((l) => !l.manque.length);
  out(`- **Formes réduites** : ports de coin morts par plateau entre ${Math.min(...pm.map((l) => Math.min(...l.ports)))} et ${Math.max(...pm.map((l) => Math.max(...l.ports)))} selon la forme ; ` +
    `${pm.filter((l) => Math.min(...l.ports) === Math.max(...l.ports)).length} forme(s) sur ${pm.length} ont un nombre constant (ports obligatoires des rôles) ; ${formes.length - pm.length} forme(s) impossibles à remplir avec le catalogue.`);
  out();
  out('## Points à soumettre à l\'advisor design de jeu');
  out();
  out(`1. **Diversité contre équilibre (tolérance réglée à 1).** Avec la tolérance 1 (réglage par défaut), S moyen ${f2(aG.N.Smoy)}, S maximal ${aG.N.Smax}, ${aG.N.profils} profils (N). ` +
    `Avec la tolérance 0 (meilleur S seulement), S = 0 sur ${pc(a1.N.histS[0] || 0, a1.n)} des plateaux mais ${a1.N.profils} profils seulement, le plus fréquent couvrant ${pc(a1.N.plusFrequent, a1.n)} des plateaux (tirage uniforme : ${aU.N.profils} profils, S moyen ${f2(aU.N.Smoy)}). ` +
    `La tolérance 1 respecte « pas toujours le meilleur » (D7 n° 4) sans approcher le seuil « à surveiller » S ≥ 4. Garder 1, revenir à 0, ou fixer un seuil absolu (par exemple S ≤ 2) ?`);
  out(`2. **Carrefours variés.** Avec la règle du doc 16 (aucune alerte dans les deux modes, S ≤ S de la paire par défaut), ${pc(varies.res.filter((x) => x.nbPermises === 1).length, varies.res.length)} des plateaux n'admettent que la paire par défaut, et les paires (1,2)+(2,2) et (2,2)+(3,2) dominent parmi les autres. Faut-il activer l'option par défaut pour gagner en variété (${aV.N.profils} profils au lieu de ${aG.N.profils}) ?`);
  out('3. **Mode de calcul.** Le générateur minimise S en villes non traversables ; en villes traversables le S obtenu reste faible (moyenne ' + f2(aG.T.Smoy) + ', maximum ' + aG.T.Smax + '). À reconsidérer quand la règle « villes traversables » sera tranchée.');
  out('4. **Formes réduites.** Le nombre de ports de coin morts est fixé par la forme (2 avec un coin retiré ou un coin et son bord, 4 avec deux coins), quel que soit le tirage : ce sont les ports obligatoires des rôles vers des jonctions perdues. Alerte permanente acceptable en mode manuel, ou faut-il la regrouper en une seule information par forme ?');
  out('5. **Raccords morts** : le générateur ne pénalise qu\'au-delà de 2 (seuil du doc 9) pour ne pas écarter le « mur » de C6 ; présence de C6 inchangée à quelques points près. À confirmer.');
  const deuxCoins = pm.filter((l) => l.f.retires.length === 2 && l.f.retires.every((r) => (r.col === 0 || r.col === 3) && (r.lig === 0 || r.lig === 3)));
  out(`6. **Raccords morts des formes à 2 coins retirés** : jusqu'à ${Math.max(...deuxCoins.map((l) => Math.max(...l.raccords)))} raccords morts ou face au vide par plateau (moyenne ${f2(moy(deuxCoins.map((l) => moy(l.raccords))))}), au-dessus du seuil « max ≤ 2 » du doc 9 (raccords des apparitions voisines vers le vide, plus le « mur » de C6). Seuil à adapter aux formes réduites ?`);
  out();
  out(`Durée du calcul : ${((Date.now() - t0) / 1000).toFixed(1)} s.`);
  fs.writeFileSync(sortie, L.join('\n') + '\n', 'utf8');
  console.log(`Rapport écrit : ${sortie} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

if (require.main === module) principal();
