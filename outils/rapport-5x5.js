'use strict';
/*
 * rapport-5x5.js : rédige docs/35-mesures-5x5.md à partir des fichiers de collecte de outils/mesures-5x5.js
 * (f1-*.json, f2.json, f2b.json, c1.json). Aucun calcul de graphe ici : on relit les mesures brutes.
 * Lancement : node outils/mesures-5x5.js rapport <dossier des .json> [fichier du rapport]
 * Écrit pour le catalogue 5×5 de la version 3.04 (C7, C8, B1, B7, B7m, K2 : PM.catalogue.precedent['5x5']) : ses textes figés
 * ne décrivent pas le catalogue livré depuis docs/46 (U1, P1, P2, P3, P5, B1, B7, K2).
 */
const fs = require('fs');
const path = require('path');
const E = require('./mesures-equilibre.js');
const MS = require('./mesures-5x5.js');
const GEN = globalThis.PM.generateur, GR = globalThis.PM.graphe;
const PORTS_VILLE = GR.PORTS_VILLE_MIN, PORTS_JONCTION = GR.PORTS_JONCTION_MIN;   // constantes du générateur (PM.graphe)
const { moy, f2, pc, ajouterHist, cles, totalHist, moyHist, partHist, texteHist } = E;

const num = (a, b) => a - b;
const hist = (arr) => { const h = {}; arr.forEach((x) => ajouterHist(h, x)); return h; };
/** Centile par le rang le plus proche (méthode « nearest rank » : rang = ceil(p × n) dans la liste triée). */
function centile(liste, p) {
  if (!liste.length) return NaN;
  const t = liste.slice().sort(num);
  return t[Math.max(0, Math.ceil(p * t.length) - 1)];
}
const pct1 = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) + ' %' : 'n/a');
function table(entetes, lignes) {
  return ['| ' + entetes.join(' | ') + ' |', '|' + entetes.map(() => '---').join('|') + '|'].concat(lignes.map((l) => '| ' + l.join(' | ') + ' |')).join('\n');
}

/* ---------------------------------------------------------------------- */
/* Agrégation d'une liste de configurations                                */
/* ---------------------------------------------------------------------- */

function agr(recs) {
  const a = {
    n: recs.length, nAcc: 0, S: [], em: [], rang: [0, 1, 2, 3, 4, 5, 6].map(() => []), cinq: 0, quatre: 0, eg: [], partage: {},
    pv: { 1: [], 2: [] }, pvEgal: 0, tempo: { 1: { 3: [], 4: [], 5: [], 6: [], 7: [] }, 2: { 3: [], 4: [], 5: [], 6: [], 7: [] } },
    f: {}, profils: new Set(), eqNb: {}, recs
  };
  recs.forEach((r) => {
    a.f[r.f] = (a.f[r.f] || 0) + 1;
    if (r.f === 'I') return;
    a.nAcc++;
    const d = MS.deriver(r);
    a.S.push(d.S); a.em.push(d.em); d.rang.forEach((e, k) => a.rang[k].push(e));
    if (d.cinq) a.cinq++;
    if (d.quatre) a.quatre++;
    a.eg.push(d.eg);
    ajouterHist(a.eqNb, d.eg > 2 ? '3 ou plus' : d.eg);
    const mx = Math.max(r.pa[0], r.pa[1]);
    ajouterHist(a.partage, mx + ' contre ' + (7 - r.pa[2] - mx) + (r.pa[2] ? ' (+' + r.pa[2] + ' égalité)' : ''));
    a.pv[1].push(r.t1[0]); a.pv[2].push(r.t2[0]);
    if (r.t1[0] === r.t2[0]) a.pvEgal++;
    [1, 2].forEach((p) => [3, 4, 5, 6, 7].forEach((k) => a.tempo[p][k].push((p === 1 ? r.t1 : r.t2).filter((x) => x <= k).length)));
    a.profils.add(r.t1.join(',') + '|' + r.t2.join(','));
  });
  return a;
}
const partS = (a, k) => pc(a.S.filter((x) => x >= k).length, a.nAcc);
const partEm = (a, k) => pc(a.em.filter((x) => x >= k).length, a.nAcc);

/** Tableau « une colonne par famille » : defs = [[libellé, (agr) => texte]]. */
function tabFamilles(fams, defs) {
  return table(['Mesure'].concat(fams.map((f) => f.nom)), defs.map(([lib, fn]) => [lib].concat(fams.map((f) => fn(f.a)))));
}

/* ---------------------------------------------------------------------- */
/* Rapport                                                                  */
/* ---------------------------------------------------------------------- */

function lire(dossier) {
  const lireJson = (nom) => JSON.parse(fs.readFileSync(path.join(dossier, nom), 'utf8'));
  const f1 = { boards: [] };
  fs.readdirSync(dossier).filter((n) => /^f1-\d+\.json$/.test(n)).sort((x, y) => parseInt(x.slice(3), 10) - parseInt(y.slice(3), 10)).forEach((n) => {
    const p = lireJson(n);
    f1.graine = p.graine;
    f1.boards = f1.boards.concat(p.boards);
  });
  return { f1, f2: lireJson('f2.json'), f2b: lireJson('f2b.json'), c1: lireJson('c1.json') };
}

/** Une carte 4×4 des jonctions (j en lignes, i en colonnes) : valeurs en %. */
function carte(compte, total) {
  const lignes = [];
  for (let j = 1; j <= 4; j++) {
    const l = ['j = ' + j];
    for (let i = 1; i <= 4; i++) l.push(total ? (100 * compte[MS.indexJonction(i, j)] / total).toFixed(1) + ' %' : 'n/a');
    lignes.push(l);
  }
  return table(['', 'i = 1', 'i = 2', 'i = 3', 'i = 4'], lignes);
}
/** Carte 4×4 de valeurs déjà calculées (tableau de 16 nombres), formatées par fmt. */
function carteValeurs(vals, fmt) {
  const lignes = [];
  for (let j = 1; j <= 4; j++) {
    const l = ['j = ' + j];
    for (let i = 1; i <= 4; i++) l.push(fmt(vals[MS.indexJonction(i, j)]));
    lignes.push(l);
  }
  return table(['', 'i = 1', 'i = 2', 'i = 3', 'i = 4'], lignes);
}
/** Part des villes sur les 4 jonctions centrales (i = 2 ou 3, j = 2 ou 3). */
const centrePart = (compte, total) => {
  const c = [5, 6, 9, 10].reduce((a, x) => a + compte[x], 0), s = compte.reduce((a, b) => a + b, 0);
  return total ? pc(c, s) : 'n/a';
};
const flancsPart = (compte, total) => {   // part des villes sur les colonnes i = 1 et i = 4 (flancs)
  let f = 0, s = 0;
  compte.forEach((c, x) => { s += c; if (x % 4 === 0 || x % 4 === 3) f += c; });
  return total ? pc(f, s) : 'n/a';
};

function rapport(dossier, sortie) {
  const D = lire(dossier);
  const nbF1 = D.f1.boards.length, graine = D.f1.graine;
  const L = [];
  const out = (s) => L.push(s === undefined ? '' : s);
  const b1ok = D.f1.boards.filter((b) => b.ok);
  const bF2 = D.f2.boards.filter(Boolean), bF2b = D.f2b.boards.filter(Boolean);
  const NBF2 = D.f2.boards.length;

  /* familles de configurations */
  const cfgF1 = b1ok.map((b) => b.cfg);
  const cfgF2 = [].concat(...bF2.map((b) => b.configs));
  const cfgF2sel = bF2.filter((b) => b.selAvec >= 0).map((b) => b.configs[b.selAvec]);
  const cfgF2selSans = bF2.filter((b) => b.selSans >= 0).map((b) => b.configs[b.selSans]);
  const cfgLib = [].concat(...bF2.map((b) => b.libre.ech));
  const bloque = (r) => r.f !== 'I' && r.f !== 'D';
  const FAM = {
    f1: { nom: 'Générateur (200 candidats)', a: agr(cfgF1) },
    adm: { nom: 'Admissibles, tous', a: agr(cfgF2) },
    admOk: { nom: 'Admissibles, hors blocages', a: agr(cfgF2.filter(bloque)) },
    sel: { nom: 'Admissibles, retenu (1 par plateau)', a: agr(cfgF2sel) },
    lib: { nom: 'Pose libre, échantillon', a: agr(cfgLib) },
    libOk: { nom: 'Pose libre, hors blocages', a: agr(cfgLib.filter(bloque)) }
  };

  out('# Mesures du catalogue 5×5 : 1000 plateaux (docs/28 § 6, docs/34)');
  out();
  out(`Généré par \`outils/mesures-5x5.js\` + \`outils/rapport-5x5.js\` (graine ${graine}). Catalogue réel \`PM.catalogue.nouveauDocument('5x5')\` : C7 ×6, C8 ×5, B1 ×6, B7 ×4, B7m ×4, K2 ×5 (6 modèles ; le catalogue P5 modélisé dans docs/28 est plus riche). **Aucun seuil du code n'est modifié.**`);
  out();
  out('**Familles mesurées.**');
  out();
  out(`- **Générateur** : ${nbF1} appels à \`PM.generateur.generer\` (graines « m5-${graine}-<n> »), **options par défaut** (200 candidats, tolérance 1 sur S), un plateau par graine : c'est ce que reçoit l'utilisateur. Le S de cette famille est **tronqué par le rejet S ≥ 5** et choisi au meilleur S parmi 200 candidats : il ne sert pas à fixer un seuil.`);
  out(`- **Plateaux tirés et orientés** : ${NBF2} plateaux (graine ${D.f2.graine}) issus de \`tuilesOrientees5x5\` (modèles tirés, 5 ou 6 B1, orientation optimisée), sans ville ni filtre d'équilibre. Orientation impossible : ${D.f2.sansOrientation} plateau(x). Sur chacun :`);
  out('  - **placements admissibles** = les 7 villes en 2-3-2 sur des jonctions à **3 ports au moins** (même sens que `candidat5x5`) : tous sont mesurés ;');
  out(`  - **pose libre** = les 2016 placements 2-3-2 **sans** exigence de ports, dont un échantillon de 40 tirés au hasard par plateau est conservé (pour la pose manuelle : on ne choisit pas toujours une jonction à 3 ports) ; les comptes par filtre portent sur les 2016.`);
  out('- **Chaîne de filtres** rejouée comme dans le générateur : ville inaccessible (« I »), puis « 5 contre 2 » ou écart > 3 (« D », blocage), écart > 2 (« E »), première ville inégale (« P »), S ≥ 5 (« S »), « o » = passe tout. Le contrôle \`villesProches\` n\'est pas rejoué placement par placement : l\'écart minimal entre deux jonctions (toutes en cases) est mesuré par plateau (§ 1) et vaut au moins 4 pas, donc des villes non traversables ne peuvent être plus proches ; le générateur, lui, ne le vérifie que sur ses 12 meilleurs placements.');
  out('- **Contrefactuel** (arbitrage 2) : mêmes tirages sans forcer les B1 sur la rangée neutre.');
  out();
  out('Définitions : D(k) distance du rang k de villes depuis la case d\'apparition la plus proche de chaque joueur, villes non traversables ; S = somme des |D1(k) − D2(k)| sur les rangs 1 à 7 ; « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus ; centile par le rang le plus proche (rang = ⌈p × n⌉ dans la liste triée). Cases d\'un plateau = cases des 25 tuiles + 9 jonctions-cases. Pas de rendu navigateur ici : tout est calculé sur le graphe.');
  out();

  /* 1 */
  out('## 1. Plateaux : cases, ports, jonctions, écart entre villes');
  out();
  const props1 = b1ok.map((b) => b.props), props2 = bF2.map((b) => b.props), props2b = bF2b.map((b) => b.props);
  const dans = (p) => pc(p.filter((x) => x.cases >= 72 && x.cases <= 78).length, p.length);
  out(`Cases par plateau (cible 75 ± 3, soit 72 à 78) : générateur ${f2(moy(props1.map((x) => x.cases)))} en moyenne, ${dans(props1)} dans la cible ; plateaux tirés ${f2(moy(props2.map((x) => x.cases)))}, ${dans(props2)} dans la cible. (cases = 72 + nB1 : seules les valeurs 77 et 78 sortent, voir tests/generateur-5x5.test.js.)`);
  out();
  out('Cases, plateaux du générateur :'); out(texteHist(hist(props1.map((x) => x.cases))));
  out('Cases, plateaux tirés et orientés :'); out(texteHist(hist(props2.map((x) => x.cases))));
  out('Ports par plateau (34 + nB1), plateaux tirés :'); out(texteHist(hist(props2.map((x) => x.ports))));
  out('Ports par jonction (16 jonctions × plateaux tirés) :'); out(texteHist(hist([].concat(...props2.map((x) => x.pj)))));
  out('Jonctions à 3 ports ou plus par plateau, générateur :'); out(texteHist(hist(props1.map((x) => x.pj.filter((p) => p >= PORTS_VILLE).length))));
  out('Jonctions à 3 ports ou plus par plateau, plateaux tirés :'); out(texteHist(hist(props2.map((x) => x.pj.filter((p) => p >= PORTS_VILLE).length))));
  out(`Jonctions à moins de 2 ports : ${props2.reduce((s, x) => s + x.pj.filter((p) => p < PORTS_JONCTION).length, 0)} sur ${props2.length * 16} (plateaux tirés), ${props1.reduce((s, x) => s + x.pj.filter((p) => p < PORTS_JONCTION).length, 0)} sur ${props1.length * 16} (générateur).`);
  const villes3 = b1ok.reduce((s, b) => s + b.cfg.v.filter((x) => b.props.pj[x] >= PORTS_VILLE).length, 0);
  out(`Villes du générateur sur une jonction à 3 ports ou plus : ${villes3} sur ${b1ok.length * 7} (${pc(villes3, b1ok.length * 7)}).`);
  let nbV3 = 0, nbV = 0;
  bF2.forEach((b) => b.libre.ech.forEach((c) => { c.v.forEach((x) => { nbV++; if (b.props.pj[x] >= PORTS_VILLE) nbV3++; }); }));
  out(`Pose libre (échantillon) : ${pc(nbV3, nbV)} des villes sont sur une jonction à 3 ports ou plus (hasard) ; ${pc(bF2.reduce((s, b) => s + b.nbAdm, 0), bF2.reduce((s, b) => s + b.libre.n, 0))} des 2016 placements sont admissibles.`);
  out();
  out('B1 par plateau (générateur) :'); out(texteHist(hist(props1.map((x) => x.modeles.B1))));
  out('Écart minimal entre deux jonctions, toutes en cases (minorant de l\'écart entre villes, exigence 4 pas) :');
  out('Générateur :'); out(texteHist(hist(props1.map((x) => x.ecartMin))));
  out('Plateaux tirés :'); out(texteHist(hist(props2.map((x) => x.ecartMin))));

  /* 2 */
  out('## 2. Placements 2-3-2 admissibles par plateau');
  out();
  out(`Plateaux tirés : ${NBF2}. Sans placement admissible (« villes_ports ») : ${bF2.filter((b) => b.nbAdm === 0).length} (${pc(bF2.filter((b) => b.nbAdm === 0).length, NBF2)}). Nombre moyen : ${f2(moy(bF2.map((b) => b.nbAdm)))}.`);
  out(texteHist(hist(bF2.map((b) => b.nbAdm))));
  out('Placements admissibles qui passent tous les filtres, par plateau :'); out(texteHist(hist(bF2.map((b) => b.nbValides))));
  const sansValide = bF2.filter((b) => b.selAvec < 0).length;
  out(`Plateaux sans placement valide (filtres complets, S ≥ 5 compris) : ${sansValide} (${pc(sansValide, NBF2)}) ; sans S comme rejet : ${bF2.filter((b) => b.selSans < 0).length}.`);
  out();
  out(`Pose libre : sur les ${bF2.length} × 2016 placements, résultat de la chaîne de filtres :`);
  const codesLib = {};
  bF2.forEach((b) => Object.keys(b.libre.codes).forEach((c) => { codesLib[c] = (codesLib[c] || 0) + b.libre.codes[c]; }));
  const totLib = Object.values(codesLib).reduce((a, b) => a + b, 0);
  out(table(['Code', 'Sens', 'Placements', 'Part'], [['I', 'ville inaccessible'], ['D', '5 contre 2 ou écart > 3 (blocage)'], ['E', 'écart > 2'], ['P', 'première ville inégale'], ['S', 'S ≥ 5 seul'], ['o', 'passe tout']].map(([c, s]) => [c, s, String(codesLib[c] || 0), pc(codesLib[c] || 0, totLib)])));
  out();
  out('Meilleur S atteignable par plateau en pose libre (parmi les 2016, filtres complets) :');
  out(texteHist(hist(bF2.map((b) => (b.libre.meilleurS === null ? 'n/a' : b.libre.meilleurS)))));

  /* 3 */
  out('## 3. Score S');
  out();
  const famS = [FAM.f1, FAM.adm, FAM.admOk, FAM.sel, FAM.lib, FAM.libOk];
  out(tabFamilles(famS, [
    ['Configurations mesurées', (a) => String(a.nAcc)],
    ['S moyen', (a) => f2(moy(a.S))],
    ['S médian', (a) => String(centile(a.S, 0.5))],
    ['S 90e centile', (a) => String(centile(a.S, 0.9))],
    ['**S 95e centile**', (a) => String(centile(a.S, 0.95))],
    ['S 99e centile', (a) => String(centile(a.S, 0.99))],
    ['S maximal', (a) => String(a.S.length ? Math.max(...a.S) : 'n/a')],
    ['S ≥ 4', (a) => partS(a, 4)], ['S ≥ 5', (a) => partS(a, 5)], ['S ≥ 6', (a) => partS(a, 6)], ['S ≥ 7', (a) => partS(a, 7)]
  ]));
  out();
  out('S, générateur (200 candidats, tronqué à S < 5) :'); out(texteHist(hist(FAM.f1.a.S)));
  out('S, placements admissibles (tous) :'); out(texteHist(hist(FAM.adm.a.S)));
  out('S, placement retenu parmi les admissibles (1 par plateau, rejet de S ≥ 5 actif) :'); out(texteHist(hist(FAM.sel.a.S)));
  out('S, pose libre (échantillon de 40 placements par plateau) :'); out(texteHist(hist(FAM.lib.a.S)));
  out('S, pose libre hors blocages :'); out(texteHist(hist(FAM.libOk.a.S)));

  /* 4 */
  out('## 4. Écart par rang (1 à 7)');
  out();
  [FAM.f1, FAM.adm, FAM.lib].forEach((f) => {
    out(`**${f.nom}** : écart |D1(k) − D2(k)| au rang k.`);
    out();
    out(table(['Rang', 'Écart moyen', '= 0', '= 1', '= 2', '= 3', '≥ 4'], f.a.rang.map((v, k) => {
      const h = hist(v), t = v.length;
      return [String(k + 1), f2(moy(v)), pc(h['0'] || 0, t), pc(h['1'] || 0, t), pc(h['2'] || 0, t), pc(h['3'] || 0, t), pc(partHist(h, 4), t)];
    })));
    out();
  });

  /* 5 */
  out('## 5. Écart maximal (rangs 1 à 7)');
  out();
  out(tabFamilles(famS, [['Écart max ≥ 1', (a) => partEm(a, 1)], ['Écart max ≥ 2', (a) => partEm(a, 2)], ['Écart max ≥ 3 (alerte > 2)', (a) => partEm(a, 3)], ['Écart max ≥ 4 (blocage > 3)', (a) => partEm(a, 4)]]));
  out();

  /* 6 */
  out('## 6. Partage des villes (« 5 contre 2 », « 4 contre 3 »)');
  out();
  out(tabFamilles(famS, [
    ['« 5 contre 2 » ou pire', (a) => pc(a.cinq, a.nAcc)], ['« 4 contre 3 »', (a) => pc(a.quatre, a.nAcc)],
    ['Villes équidistantes (moyenne sur 7)', (a) => f2(moy(a.eg))],
    ['Aucune ville équidistante', (a) => pc(a.eqNb['0'] || 0, a.nAcc)], ['Une ville équidistante', (a) => pc(a.eqNb['1'] || 0, a.nAcc)], ['Deux ou plus', (a) => pc((a.eqNb['2'] || 0) + (a.eqNb['3 ou plus'] || 0), a.nAcc)]
  ]));
  out();
  out('Partage, générateur :'); out(texteHist(FAM.f1.a.partage));
  out('Partage, pose libre (échantillon) :'); out(texteHist(FAM.lib.a.partage));

  /* 7 */
  out('## 7. Première ville et tempo');
  out();
  out(tabFamilles(famS, [
    ['Première ville à la même distance', (a) => pc(a.pvEgal, a.nAcc)],
    ['Première ville, vert : distance moyenne', (a) => f2(moy(a.pv[1]))], ['Première ville, rouge : distance moyenne', (a) => f2(moy(a.pv[2]))]
  ]));
  out();
  out('Nombre moyen de villes atteignables en au plus n pas (moyenne des deux joueurs ; en 4×4 : 5,7 sur 7 à 3 pas, 6,8 à 4 pas) :');
  out();
  out(tabFamilles([FAM.f1, FAM.adm, FAM.lib], [3, 4, 5, 6, 7].map((k) => [`≤ ${k} pas`, (a) => f2((moy(a.tempo[1][k]) + moy(a.tempo[2][k])) / 2)])));
  out();
  out('Première ville, distance du joueur vert (générateur) :'); out(texteHist(hist(FAM.f1.a.pv[1])));

  /* 8 */
  out('## 8. Autoroute du pourtour');
  out();
  out('Distance d\'une apparition d\'un joueur à la rangée de jonctions du camp adverse (j = 4 pour le vert, j = 1 pour le rouge), sans ville, par le **pourtour** (tuiles des colonnes et rangées 0 et 4) ou par le **centre** (colonnes 1 à 3). Les raccourcis de coin et de bord relient les apparitions en anneau, mais la rangée 2 est neutre : une apparition verte et une rouge ne sont plus voisines.');
  out();
  out('Distance minimale entre une apparition verte et une rouge (graphe complet) :');
  out('Plateaux tirés :'); out(texteHist(hist(props2.map((x) => x.ecartApp))));
  const lignesP = [];
  [['plateaux tirés', props2], ['générateur', props1]].forEach(([nom, ps]) => {
    [0, 1].forEach((q) => {
      ['pourtour', 'centre'].forEach((voie) => {
        const v = ps.map((x) => x[voie][q]).filter(Number.isFinite);
        lignesP.push([nom, q === 0 ? 'vert' : 'rouge', voie, f2(moy(v)), String(Math.min(...v)), String(Math.max(...v))]);
      });
    });
  });
  out(table(['Famille', 'Joueur', 'Voie', 'Moyenne', 'Minimum', 'Maximum'], lignesP));
  out();
  out('Toutes les jonctions portent une ville (sous-graphes « flanc » : colonnes 0 et 4 + tuiles d\'apparition des rangées 0 et 4 ; « centre » : colonnes 1 à 3 ; calculés par `PM.graphe.flancs`) :');
  out();
  const lf = [];
  [['plateaux tirés', props2], ['générateur', props1]].forEach(([nom, ps]) => {
    ['N', 'T'].forEach((mode) => {
      const m = [].concat(...ps.map((x) => x.flancs[mode]));
      const plusCourt = m.filter((z) => z[0] < z[1]).length, egal = m.filter((z) => z[0] === z[1]).length;
      lf.push([nom, mode === 'N' ? 'non traversables (règle)' : 'traversables (comparaison)', String(m.length), pc(plusCourt, m.length), pc(egal, m.length), f2(moy(m.map((z) => z[0] - z[1])))]);
    });
  });
  out(table(['Famille', 'Villes', 'Mesures', 'Flanc plus court que le centre', 'Égal', 'Flanc − centre moyen'], lf));
  out();

  /* 9 */
  out('## 9. Goulets et points d\'articulation');
  out();
  out('Chemins sans case commune (hors apparitions) entre les apparitions d\'un joueur et chaque ville ; articulation = case dont le retrait coupe au moins une ville de toutes les apparitions du joueur. Générateur : placement retenu ; plateaux tirés : un placement admissible tiré au hasard par plateau.');
  out();
  const gouletsDe = (boards) => [].concat(...boards.filter((b) => b.goulets).map((b) => b.goulets));
  const G1 = gouletsDe(b1ok), G2 = gouletsDe(bF2);
  out(table(['Mesure', 'Générateur', 'Plateaux tirés'], [
    ['Cas (joueurs × plateaux)', String(G1.length), String(G2.length)],
    ['Minimum de chemins disjoints = 1', pc(G1.filter((g) => g.min === 1).length, G1.length), pc(G2.filter((g) => g.min === 1).length, G2.length)],
    ['Minimum de chemins disjoints = 2', pc(G1.filter((g) => g.min === 2).length, G1.length), pc(G2.filter((g) => g.min === 2).length, G2.length)],
    ['Minimum de chemins disjoints ≥ 3', pc(G1.filter((g) => g.min >= 3).length, G1.length), pc(G2.filter((g) => g.min >= 3).length, G2.length)],
    ['Au moins un point d\'articulation', pc(G1.filter((g) => g.nArt > 0).length, G1.length), pc(G2.filter((g) => g.nArt > 0).length, G2.length)],
    ['Une articulation qui coupe 2 villes ou plus', pc(G1.filter((g) => g.art2).length, G1.length), pc(G2.filter((g) => g.art2).length, G2.length)],
    ['Articulations par cas (moyenne)', f2(moy(G1.map((g) => g.nArt))), f2(moy(G2.map((g) => g.nArt)))]
  ]));
  out();
  out('Chemins disjoints, toutes villes (générateur) :'); out(texteHist(hist([].concat(...G1.map((g) => g.ch)))));

  /* 10 */
  out('## 10. Raccords morts et jonctions mal reliées');
  out();
  out(`Raccords morts (\`raison = 'mort'\`, comme en 4×4) : générateur ${f2(moy(props1.map((x) => x.morts)))} par plateau, plateaux tirés ${f2(moy(props2.map((x) => x.morts)))}. Compte du générateur (tout sauf « absent ») : ${f2(moy(props1.map((x) => x.mortsGen)))}. Jonctions reliées par moins de 2 ports : ${props2.filter((x) => x.malReliees > 0).length} plateau(x) tiré(s), ${props1.filter((x) => x.malReliees > 0).length} du générateur.`);
  out(texteHist(hist(props2.map((x) => x.morts))));

  /* 11 */
  out('## 11. Diversité');
  out();
  const hashs1 = new Set(props1.map((x) => x.hash)), hashs2 = new Set(props2.map((x) => x.hash));
  const sig = (ps) => new Set(ps.map((x) => Object.keys(x.modeles).sort().map((k) => k + x.modeles[k]).join(' ')));
  out(table(['Mesure', 'Générateur', 'Plateaux tirés', 'Tirés, B1 libres'], [
    ['Plateaux', String(props1.length), String(props2.length), String(props2b.length)],
    ['Plateaux distincts (tuiles et rotations)', String(hashs1.size), String(hashs2.size), String(new Set(props2b.map((x) => x.hash)).size)],
    ['Compositions distinctes (nombre de chaque modèle)', String(sig(props1).size), String(sig(props2).size), String(sig(props2b).size)],
    ['Modèles distincts par plateau (moyenne)', f2(moy(props1.map((x) => Object.keys(x.modeles).length))), f2(moy(props2.map((x) => Object.keys(x.modeles).length))), f2(moy(props2b.map((x) => Object.keys(x.modeles).length)))],
    ['Profils de distances distincts (retenu / générateur)', `${FAM.f1.a.profils.size} sur ${FAM.f1.a.nAcc}`, `${FAM.sel.a.profils.size} sur ${FAM.sel.a.nAcc}`, 'n/a'],
    ['Placements de villes distincts (retenu / générateur)', String(new Set(b1ok.map((b) => b.cfg.v.join(','))).size), String(new Set(cfgF2sel.map((c) => c.v.join(','))).size), 'n/a']
  ]));
  out();

  /* 12 */
  out('## 12. Rejets du générateur par cause');
  out();
  const rej200 = {}, essais200 = b1ok.concat(D.f1.boards.filter((b) => !b.ok)).reduce((s, b) => s + b.essais, 0);
  D.f1.boards.forEach((b) => Object.keys(b.rejets).forEach((c) => { rej200[c] = (rej200[c] || 0) + b.rejets[c]; }));
  const lignesR = Object.keys(D.c1.rejets).map((c) => [c, String(rej200[c] || 0), pc(rej200[c] || 0, essais200), String(D.c1.rejets[c] || 0), pc(D.c1.rejets[c] || 0, D.c1.essais)]);
  out(`Options par défaut (200 candidats) : ${nbF1} graines, ${essais200} essais, ${b1ok.length} plateaux rendus${b1ok.length < nbF1 ? ' (échecs : ' + (nbF1 - b1ok.length) + ')' : ''} ; 1 candidat, 1 essai par graine : ${D.c1.nb} graines, ${D.c1.acceptes} acceptées (${pc(D.c1.acceptes, D.c1.nb)}).`);
  out();
  out(table(['Cause', 'Rejets (200 candidats)', 'Part des essais', 'Rejets (1 candidat)', 'Part des essais'], lignesR));
  out();

  /* 13 : arbitrage 1 */
  out('## 13. Arbitrage 1 : effet du rejet S ≥ 5');
  out();
  const selAvec = FAM.sel.a, selSans = agr(cfgF2selSans);
  const diffSel = bF2.filter((b) => b.selAvec < 0 && b.selSans >= 0).length;
  out(table(['Mesure', 'Rejet S ≥ 5 actif', 'S seulement comme classement'], [
    ['Plateaux avec un placement valide', `${bF2.filter((b) => b.selAvec >= 0).length} (${pc(bF2.filter((b) => b.selAvec >= 0).length, NBF2)})`, `${bF2.filter((b) => b.selSans >= 0).length} (${pc(bF2.filter((b) => b.selSans >= 0).length, NBF2)})`],
    ['S du placement retenu (moyenne)', f2(moy(selAvec.S)), f2(moy(selSans.S))],
    ['S du placement retenu ≥ 5', partS(selAvec, 5), partS(selSans, 5)],
    ['S du placement retenu ≥ 4', partS(selAvec, 4), partS(selSans, 4)]
  ]));
  out();
  out(`Le rejet n'a d'effet que sur les plateaux dont aucun placement admissible ne descend sous S = 5 (le meilleur S est toujours choisi, donc un placement à S < 5 passe avant tout placement à S ≥ 5) : ${diffSel} plateau(x) sur ${NBF2}, qui seraient rendus avec S ≥ 5 au lieu d'être rejetés au tirage. Cause « score_s » : ${pc(rej200.score_s || 0, essais200)} des essais à 200 candidats, ${pc(D.c1.rejets.score_s || 0, D.c1.essais)} à 1 candidat. Parmi les placements admissibles hors blocage, S ≥ 5 touche ${partS(FAM.admOk.a, 5)} ; en pose libre hors blocage, ${partS(FAM.libOk.a, 5)}.`);
  out();

  /* 14 : arbitrage 2 */
  out('## 14. Arbitrage 2 : B1 forcés sur la rangée neutre ou libres');
  out();
  out('« Forcés » : situation actuelle (B1 d\'abord sur (0,2) et (4,2)). « Libres » : les 5 ou 6 B1 sont répartis au hasard sur les 12 bords (contrefactuel : le générateur n\'est pas modifié).');
  out();
  const aF2b = agr([].concat(...bF2b.map((b) => b.configs)));
  const selB = bF2b.filter((b) => b.selAvec >= 0).map((b) => b.configs[b.selAvec]);
  const m2 = (bs, fn) => f2(moy(bs.map(fn)));
  const neutreB1 = (bs) => pc(bs.filter((b) => { const t = b.props.hash.split(','); return t[10].startsWith('B1') && t[14].startsWith('B1'); }).length, bs.length);
  out(table(['Mesure', 'B1 forcés (neutre)', 'B1 libres'], [
    ['Plateaux tirés / sans orientation', `${NBF2} / ${D.f2.sansOrientation}`, `${D.f2b.boards.length} / ${D.f2b.sansOrientation}`],
    ['B1 sur les deux bords neutres', neutreB1(bF2), neutreB1(bF2b)],
    ['Placements admissibles par plateau', m2(bF2, (b) => b.nbAdm), m2(bF2b, (b) => b.nbAdm)],
    ['Plateaux sans placement admissible', pc(bF2.filter((b) => b.nbAdm === 0).length, bF2.length), pc(bF2b.filter((b) => b.nbAdm === 0).length, bF2b.length)],
    ['Plateaux sans placement valide (filtres complets)', pc(bF2.filter((b) => b.selAvec < 0).length, bF2.length), pc(bF2b.filter((b) => b.selAvec < 0).length, bF2b.length)],
    ['Jonctions à 3 ports ou plus (moyenne)', m2(bF2, (b) => b.props.pj.filter((p) => p >= PORTS_VILLE).length), m2(bF2b, (b) => b.props.pj.filter((p) => p >= PORTS_VILLE).length)],
    ['|ports nord − ports sud| (moyenne)', m2(bF2, (b) => Math.abs(b.props.nord - b.props.sud)), m2(bF2b, (b) => Math.abs(b.props.nord - b.props.sud))],
    ['Ports nord = ports sud', pc(bF2.filter((b) => b.props.nord === b.props.sud).length, bF2.length), pc(bF2b.filter((b) => b.props.nord === b.props.sud).length, bF2b.length)],
    ['S moyen, placements admissibles', f2(moy(FAM.adm.a.S)), f2(moy(aF2b.S))],
    ['S ≥ 5, placements admissibles', partS(FAM.adm.a, 5), partS(aF2b, 5)],
    ['« 5 contre 2 », placements admissibles', pc(FAM.adm.a.cinq, FAM.adm.a.nAcc), pc(aF2b.cinq, aF2b.nAcc)],
    ['S moyen du placement retenu', f2(moy(FAM.sel.a.S)), f2(moy(selB.map((c) => MS.deriver(c).S)))],
    ['Plateaux distincts', String(hashs2.size), String(new Set(props2b.map((x) => x.hash)).size)],
    ['Modèles distincts par plateau (moyenne)', m2(bF2, (b) => Object.keys(b.props.modeles).length), m2(bF2b, (b) => Object.keys(b.props.modeles).length)]
  ]));
  out();

  /* 15 : arbitrage 3 */
  out('## 15. Arbitrage 3 : la 7e ville et la tendance des villes vers les flancs');
  out();
  out('La « 7e ville » est la ville équidistante des deux joueurs dans le placement retenu (le générateur la favorise : tri à S égal, pénalité sans égalité, docs/18). Fréquence de chaque jonction comme ville (j = rangée, i = colonne ; les flancs sont les colonnes i = 1 et i = 4) :');
  out();
  const unif = new Array(16).fill(0);
  GEN.placementsVilles5x5().forEach((pl) => pl.forEach((jn) => { unif[MS.indexJonction(jn.i, jn.j)]++; }));
  const compteVilles = (cfgs) => { const c = new Array(16).fill(0); cfgs.forEach((r) => r.v.forEach((x) => { c[x]++; })); return c; };
  const cUnif = unif, cAdm = compteVilles(cfgF2), cSel = compteVilles(cfgF2sel), cF1 = compteVilles(cfgF1), cLib = compteVilles(cfgLib);
  const refs = [['Référence : 2016 placements 2-3-2 tirés uniformément', cUnif, GEN.placementsVilles5x5().length], ['Pose libre (échantillon)', cLib, cfgLib.length], ['Placements admissibles (tous)', cAdm, cfgF2.length], ['Placement retenu parmi les admissibles', cSel, cfgF2sel.length], ['Générateur (200 candidats)', cF1, cfgF1.length]];
  refs.forEach(([nom, c, tot]) => {
    out(`**${nom}** : part des configurations qui ont une ville sur la jonction. Villes sur les flancs : ${flancsPart(c, tot)} ; sur les 4 jonctions centrales (2,2) (3,2) (2,3) (3,3) : ${centrePart(c, tot)}.`);
    out();
    out(carte(c, tot));
    out();
  });
  // qualité de chaque position : configurations qui ont une ville sur la jonction (point 5 de docs/28)
  const qualite = (cfgs) => {
    const cellules = [];
    for (let x = 0; x < 16; x++) {
      const a = agr(cfgs.filter((r) => r.v.indexOf(x) >= 0));
      cellules.push(a.nAcc ? `${f2(moy(a.S))} / ${pc(a.S.filter((v) => v >= 5).length, a.nAcc)} / ${pc(a.cinq, a.nAcc)}` : 'n/a');
    }
    return cellules;
  };
  const moyFam = (a) => `S ${f2(moy(a.S))}, S ≥ 5 : ${partS(a, 5)}, 5 contre 2 : ${pc(a.cinq, a.nAcc)}`;
  out(`**Qualité de chaque position** : pour les configurations qui ont une ville sur la jonction, « S moyen / part de S ≥ 5 / part de 5 contre 2 ». Une position sans effet sur l’équilibre aurait les valeurs de la moyenne de la famille (pose libre : ${moyFam(FAM.lib.a)} ; admissibles : ${moyFam(FAM.adm.a)}).`);
  out();
  out('Pose libre (échantillon) :');
  out();
  out(carteValeurs(qualite(cfgLib), (v) => v));
  out();
  out('Placements admissibles (tous) :');
  out();
  out(carteValeurs(qualite(cfgF2), (v) => v));
  out();
  const reparti = (cfgs) => {
    const g = {};
    cfgs.forEach((r) => { const k = r.v.filter((x) => x >= 4 && x < 8).length; (g[k] = g[k] || []).push(r); });
    return Object.keys(g).sort(num).map((k) => { const a = agr(g[k]); return [`${k} sur la rangée j = 2, ${3 - k} sur j = 3`, String(a.n), f2(moy(a.S)), pc(a.cinq, a.nAcc), pc(a.S.filter((v) => v >= 5).length, a.nAcc)]; });
  };
  out('Répartition des 3 villes du milieu entre les rangées j = 2 et j = 3 (pose libre, échantillon) :');
  out();
  out(table(['Répartition', 'Configurations', 'S moyen', '5 contre 2', 'S ≥ 5'], reparti(cfgLib)));
  out();
  const nbP = props2.length, portsMoy = new Array(16).fill(0), parts3 = new Array(16).fill(0);
  props2.forEach((x) => x.pj.forEach((p, k) => { portsMoy[k] += p / nbP; if (p >= PORTS_VILLE) parts3[k] += 1 / nbP; }));
  out('**Origine de la tendance : jonctions à 3 ports ou plus** (plateaux tirés et orientés, part des plateaux où la jonction a 3 ports ou plus) :');
  out();
  out(carteValeurs(parts3, (v) => (100 * v).toFixed(1) + ' %'));
  out();
  out('Ports moyens par jonction :');
  out();
  out(carteValeurs(portsMoy, (v) => v.toFixed(2)));
  out();
  // 7e ville
  const septieme = (cfgs) => { const c = new Array(16).fill(0); let un = 0; cfgs.forEach((r) => { if (r.eq.length === 1) { un++; c[r.eq[0]]++; } }); return { c, un }; };
  [['Générateur (200 candidats)', cfgF1], ['Placement retenu parmi les admissibles', cfgF2sel]].forEach(([nom, cfgs]) => {
    const s = septieme(cfgs);
    out(`**7e ville, ${nom}** : une seule ville équidistante dans ${pc(s.un, cfgs.length)} des plateaux (aucune : ${pc(cfgs.filter((r) => r.eq.length === 0).length, cfgs.length)} ; deux ou plus : ${pc(cfgs.filter((r) => r.eq.length >= 2).length, cfgs.length)}). Position de cette ville (en % des plateaux à une seule ville équidistante) :`);
    out();
    out(carte(s.c, s.un));
    out();
    const milieu = [4, 5, 6, 7, 8, 9, 10, 11].map((x) => s.c[x]);
    out(`Sur les 8 jonctions du milieu (j = 2 et 3) : ${pc(milieu.reduce((a, b) => a + b, 0), s.un)} ; sur les flancs (i = 1 ou 4) : ${flancsPart(s.c, s.un)}.`);
    out();
  });

  /* 16 : sensibilité */
  out('## 16. Sensibilité par modèle (plateaux tirés)');
  out();
  out('Par nombre d\'exemplaires posés d\'un modèle : plateaux concernés, placements admissibles par plateau, part de plateaux avec un placement valide, S moyen et part de « 5 contre 2 » sur les placements admissibles.');
  out();
  out('(C8 n’est pas tabulé : les 9 centrales sont des C7 ou des C8, donc C8 × k est le miroir exact de C7 × (9 − k).)');
  out();
  for (const id of ['C7', 'B7', 'B7m', 'B1']) {
    const groupes = {};
    bF2.forEach((b) => { const k = b.props.modeles[id] || 0; (groupes[k] = groupes[k] || []).push(b); });
    const lignes = Object.keys(groupes).sort(num).map((k) => {
      const bs = groupes[k], cs = [].concat(...bs.map((b) => b.configs)), a = agr(cs);
      return [`${id} × ${k}`, String(bs.length), f2(moy(bs.map((b) => b.nbAdm))), pc(bs.filter((b) => b.selAvec >= 0).length, bs.length), f2(moy(a.S)), pc(a.cinq, a.nAcc)];
    });
    out(table(['Modèle', 'Plateaux', 'Admissibles / plateau', 'Plateaux avec placement valide', 'S moyen', '5 contre 2'], lignes));
    out();
  }

  /* 17 : seuils */
  out('## 17. Seuils : ce que chaque critère attraperait');
  out();
  out(tabFamilles([FAM.f1, FAM.adm, FAM.lib], [
    ['« 5 contre 2 » (blocage)', (a) => pc(a.cinq, a.nAcc)],
    ['Écart max ≥ 4 (blocage > 3)', (a) => partEm(a, 4)],
    ['Écart max ≥ 3 (alerte > 2)', (a) => partEm(a, 3)],
    ['Écart max ≥ 2', (a) => partEm(a, 2)],
    ['Première ville inégale', (a) => pc(a.nAcc - a.pvEgal, a.nAcc)],
    ['S ≥ 4 (information)', (a) => partS(a, 4)], ['S ≥ 5', (a) => partS(a, 5)], ['S ≥ 6', (a) => partS(a, 6)], ['S ≥ 7', (a) => partS(a, 7)],
    ['Bloquée (code D ou I)', (a) => pc((a.f.D || 0) + (a.f.I || 0), a.n)],
    ['Alerte seule (E, P ou S)', (a) => pc((a.f.E || 0) + (a.f.P || 0) + (a.f.S || 0), a.n)]
  ]));
  out();

  let texte = L.join('\n') + '\n';
  const constats = path.join(__dirname, 'constats-5x5.md');
  if (fs.existsSync(constats) && nbF1 === MS.NB_REF && graine === MS.GRAINE_REF) {
    texte = fs.readFileSync(constats, 'utf8').replace(/\s*$/, '\n') + '\n---\n\n## Tableaux de mesure\n\n' + texte.replace(/^# .*\n/, '').replace(/^## /gm, '### ');
  }
  const cible = sortie || path.join(__dirname, '..', 'docs', '35-mesures-5x5.md');
  fs.writeFileSync(cible, texte, 'utf8');
  console.log('Rapport écrit : ' + cible);
}

module.exports = { rapport, agr, centile };
