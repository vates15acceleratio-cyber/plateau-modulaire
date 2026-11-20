/*
 * mesures-catalogue-2.js : mesure de faisabilité du catalogue 2 (docs/02-atelier-cahier-des-charges.md, §9.3).
 * Terrain en monoblocs de 3 ou 4 cases, plateau « construit comme des joueurs », villes posées après coup.
 *
 * Usage (depuis n'importe quel dossier) :  node atelier/outils/mesures-catalogue-2.js [graines = 300]
 * Écrit des tableaux markdown sur la sortie standard, repris dans docs/07-mesures-catalogue-2.md.
 * Les temps dépendent de la machine ; tout le reste est déterministe (graines 1 à N).
 */
'use strict';
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const G = require(path.join(__dirname, '..', 'src', 'generateur.js'));
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles;

const N = parseInt(process.argv[2], 10) || 300;
const STOCKS = [0, 2, 4, 6, 9];

// ------------------------------------------------------------------ catalogue mesuré

/** Pièces du catalogue 2, telles que le générateur les pose : {noyau, pieces (un élément par exemplaire), remplissage}. */
const CAT = G.piecesDuCatalogue();
// Le script fait varier le stock de remplissages au-delà du catalogue : la borne du catalogue est levée le temps de la mesure.
const STOCK_CATALOGUE = CAT.remplissage.nombre;
CAT.remplissage.nombre = 9;

// ------------------------------------------------------------------ outils

const fr = (x, d) => (Number.isFinite(x) ? x.toFixed(d === undefined ? 1 : d).replace('.', ',') : '–');
const pct = (n, total) => (total ? fr(100 * n / total) + ' %' : '–');
const somme = (t) => t.reduce((a, b) => a + b, 0);
const moyenne = (t) => (t.length ? somme(t) / t.length : NaN);
const mediane = (t) => { const s = t.slice().sort((a, b) => a - b); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
const ecartType = (t) => { const m = moyenne(t); return t.length ? Math.sqrt(moyenne(t.map((x) => (x - m) * (x - m)))) : NaN; };
const ligne = (cellules) => '| ' + cellules.join(' | ') + ' |';
function tableau(entetes, lignes) {
  console.log(ligne(entetes));
  console.log(ligne(entetes.map(() => '---')));
  lignes.forEach((l) => console.log(ligne(l)));
  console.log('');
}
const repartition = (t, valeurs) => valeurs.map((v) => (typeof v === 'string' ? t.filter((x) => x >= parseInt(v, 10)).length : t.filter((x) => x === v).length));

/** Une construction brute : un seul essai, sans regarder si les villes y trouveront place. */
function brute(graine, options) {
  const R = G.reglages(Object.assign({ tentatives: 1 }, options));
  return { R, res: G.batir(AT.alea.creer(graine), CAT.noyau, CAT.pieces, CAT.remplissage, R) };
}

/** Le générateur complet (AT.generateur.generer) : construction, villes, contrôles, avec ses essais. */
function complet(graine, options) {
  const debut = performance.now();
  const res = G.generer(graine, options);
  return { res, temps: performance.now() - debut };
}

/** Mesures de forme d'un terrain construit. */
function forme(cases) {
  const cles = Object.keys(cases), e = P.etendueSurCases(cases);
  const largeurs = Object.keys(e.rangees).map((r) => e.rangees[r].droite - e.rangees[r].gauche + 1);
  const compte = (r) => cles.filter((k) => H.decle(k).r === r).length;
  let xmin = Infinity, xmax = -Infinity;
  cles.forEach((k) => { const p = H.decle(k), x = p.q + p.r / 2; xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); });
  return {
    hauteur: e.bas - e.haut + 1, largeur: xmax - xmin + 1, largeurMax: Math.max(...largeurs),
    bord: cles.filter((k) => H.voisines(k).some((v) => !cases[v])).length,
    haut: compte(e.haut), bas: compte(e.bas),
    symetrique: cles.every((k) => cases[H.symetrique(k)]),
    signature: H.trier(cles).join(' ')
  };
}

/** Pièces distinctes et cases touchées par chaque pièce : {idPiece: {modele, taille, pieces, cotes}}. */
function contacts(cases) {
  const res = {};
  Object.keys(cases).forEach((k) => {
    const c = cases[k];
    if (!res[c.piece]) res[c.piece] = { modele: c.modele, taille: 0, vp: new Set(), vc: new Set() };
    res[c.piece].taille += 1;
    H.voisines(k).forEach((v) => { if (cases[v] && cases[v].piece !== c.piece) { res[c.piece].vp.add(cases[v].piece); res[c.piece].vc.add(v); } });
  });
  Object.keys(res).forEach((id) => { res[id].pieces = res[id].vp.size; res[id].cotes = res[id].vc.size; });
  return res;
}

console.log('<!-- Sortie de atelier/outils/mesures-catalogue-2.js ' + N + ' -->');
console.log('');
const t = C.totaux ? C.totaux() : null;
console.log('Catalogue mesuré : noyau, ' + CAT.pieces.length + ' pièces à poser (' + somme(CAT.pieces.map((p) => p.cases.length)) + ' cases), remplissage « ' + CAT.remplissage.id + ' » en stock variable (' + STOCK_CATALOGUE
  + ' au catalogue). Graines 1 à ' + N + '. Réglages du générateur : ' + JSON.stringify(C.REGLAGES.generateur) + ' ; villes : ' + JSON.stringify(C.REGLAGES.villes) + '.');
console.log('');

// ------------------------------------------------------------------ (a) remplissages

console.log('### (a) Tuiles de remplissage : réussite, nombre posé, temps');
console.log('');
const FORMES = [['11 rangées', 5], ['libre', null]];
const lignesA = [];
FORMES.forEach(([nom, demiHauteur]) => {
  STOCKS.forEach((stock) => {
    const poses = [], echecs = {};
    let reussies = 0;
    for (let g = 1; g <= N; g++) {
      const b = brute(g, { remplissages: stock, demiHauteur }).res;
      if (b.ok) { reussies += 1; poses.push(b.remplissages); } else echecs[b.echec] = (echecs[b.echec] || 0) + 1;
    }
    const temps = [], essais = [], posesG = [], ech = {};
    let reussiesG = 0;
    for (let g = 1; g <= N; g++) {
      const c = complet(g, { remplissages: stock, demiHauteur });
      temps.push(c.temps); essais.push(c.res.essais);
      Object.keys(c.res.echecs).forEach((k) => { ech[k] = (ech[k] || 0) + c.res.echecs[k]; });
      if (c.res.ok) { reussiesG += 1; posesG.push(c.res.remplissages); }
    }
    lignesA.push([nom, stock, reussies + ' / ' + N + ' (' + pct(reussies, N) + ')', Object.keys(echecs).map((k) => k + ' ' + echecs[k]).join(', ') || '–',
      fr(moyenne(poses), 2), poses.length ? Math.max(...poses) : '–', pct(poses.filter((x) => x === 0).length, poses.length),
      reussiesG + ' / ' + N + ' (' + pct(reussiesG, N) + ')', fr(moyenne(essais), 2), Math.max(...essais), fr(moyenne(temps), 0), fr(Math.max(...temps), 0),
      fr(moyenne(posesG), 2), 'contact ' + ech.contact + ', villes ' + ech.villes + ', contrôles ' + ech.controles + (ech.pose + ech.trou + ech.franchissable + ech.contactRemplissage ? ', autres ' + (ech.pose + ech.trou + ech.franchissable + ech.contactRemplissage) : '')]);
  });
});
tableau(['Forme', 'Remplissages en stock', 'Construction brute réussie (1 essai)', 'Échecs de la construction brute', 'Remplissages posés (moyenne)', '(maximum)', 'Constructions sans aucun remplissage',
  'Générateur complet réussi', 'Essais (moyenne)', '(maximum)', 'Temps moyen (ms)', 'Temps maximal (ms)', 'Remplissages posés par le générateur (moyenne)', 'Essais ratés du générateur, par étape'], lignesA);

// ------------------------------------------------------------------ (b) contact

console.log('### (b) Contact : monoblocs aux seuils 2 et 3, remplissages, villes neutres');
console.log('');
const lignesB = [];
[2, 3].forEach((seuil) => {
  [0, 2].forEach((stock) => {
    let reussies = 0;
    const minimums = [], poses = [];
    for (let g = 1; g <= N; g++) {
      const b = brute(g, { remplissages: stock, demiHauteur: 5, seuilContact: seuil }).res;
      if (!b.ok) continue;
      reussies += 1; poses.push(b.remplissages);
      const c = contacts(b.cases);
      minimums.push(Math.min(...Object.keys(c).filter((id) => c[id].taille > 1).map((id) => c[id].pieces)));
    }
    lignesB.push([seuil, stock, reussies + ' / ' + N + ' (' + pct(reussies, N) + ')', fr(moyenne(poses), 2), Math.min(...minimums), pct(minimums.filter((x) => x >= 3).length, minimums.length)]);
  });
});
tableau(['Seuil de contact des monoblocs (pièces distinctes)', 'Remplissages en stock', 'Construction brute réussie', 'Remplissages posés (moyenne)', 'Contact minimal observé', 'Plateaux où tout monobloc touche 3 pièces ou plus'], lignesB);

// Remplissages et villes neutres : ce qu'ils touchent, sur les constructions brutes réussies (stock 2, seuil 3, 11 rangées).
const touchesR = { pieces: [], cotes: [] }, placesN = { c2: [], c3: [], p2: [], p3: [] }, sansN = { c2: 0, c3: 0, p2: 0, p3: 0 };
let brutes = 0;
for (let g = 1; g <= N; g++) {
  const b = brute(g, { remplissages: 2, demiHauteur: 5 }).res;
  if (!b.ok) continue;
  brutes += 1;
  const c = contacts(b.cases);
  Object.keys(c).forEach((id) => { if (c[id].modele === CAT.remplissage.id) { touchesR.pieces.push(c[id].pieces); touchesR.cotes.push(c[id].cotes); } });
  const places = P.placesNeutresSurCases(b.cases, { contactVilleNeutre: 1, neutresTiersCentral: true, ecartVilles: 4 });
  const compter = (cle, filtre) => {
    const parFlanc = ['gauche', 'droite'].map((f) => places.filter((x) => x.flanc === f && filtre(x)).length);
    placesN[cle].push(moyenne(parFlanc));
    if (parFlanc.some((x) => x === 0)) sansN[cle] += 1;
  };
  compter('c2', (x) => x.cotes >= 2); compter('c3', (x) => x.cotes >= 3); compter('p2', (x) => x.pieces >= 2); compter('p3', (x) => x.pieces >= 3);
}
tableau(['Tuiles de remplissage posées', 'touchent 2 pièces', '3 pièces', '4 pièces ou plus', 'touchent 2 cases', '3 cases', '4 cases ou plus'],
  [[touchesR.pieces.length].concat(repartition(touchesR.pieces, [2, 3, '4']), repartition(touchesR.cotes, [2, 3, '4']))]);
tableau(['Exigence pour une ville neutre', 'Places par flanc (moyenne)', 'Plateaux sans place sur un flanc'],
  [['touche 2 cases au moins', 'c2'], ['touche 3 cases au moins', 'c3'], ['touche 2 pièces au moins', 'p2'], ['touche 3 pièces au moins', 'p3']]
    .map(([nom, cle]) => [nom, fr(moyenne(placesN[cle]), 2), sansN[cle] + ' / ' + brutes + ' (' + pct(sansN[cle], brutes) + ')']));

// ------------------------------------------------------------------ (c) places des villes

console.log('### (c) Places pour les villes, sur des constructions brutes (non orientées vers les villes, sans nouvel essai)');
console.log('');
const lignesC = [];
FORMES.forEach(([nom, demiHauteur]) => {
  const constructions = [];
  for (let g = 1; g <= N; g++) { const b = brute(g, { remplissages: 2, demiHauteur }); if (b.res.ok) constructions.push({ g, cases: b.res.cases }); }
  [1, 2, 3].forEach((profondeur) => {
    const places = [], neutres = [];
    let peu = 0, sansPaire = 0, sansNeutre = 0, sansSolution = 0;
    constructions.forEach((x) => {
      const R = G.reglages({ profondeurExtremite: profondeur });
      const v = G.chercherVilles(x.cases, AT.alea.creer(x.g), R);
      places.push((v.places.vert + v.places.rouge) / 2);
      neutres.push((v.places.gauche + v.places.droite) / 2);
      if (v.places.vert < 2 || v.places.rouge < 2) peu += 1;
      else if (!v.ok && (v.manque === 'vert' || v.manque === 'rouge')) sansPaire += 1;
      if (!v.places.gauche || !v.places.droite) sansNeutre += 1;
      if (!v.ok) sansSolution += 1;
    });
    const n = constructions.length;
    lignesC.push([nom, profondeur, n, fr(moyenne(places), 2), peu + ' (' + pct(peu, n) + ')', sansPaire + ' (' + pct(sansPaire, n) + ')', fr(moyenne(neutres), 2),
      sansNeutre + ' (' + pct(sansNeutre, n) + ')', sansSolution + ' (' + pct(sansSolution, n) + ')']);
  });
});
tableau(['Forme', 'Profondeur de l’extrémité (rangées)', 'Constructions', 'Plaines admissibles par camp (moyenne)', 'Plateaux avec moins de 2 Plaines pour un camp',
  'Plateaux avec 2 Plaines mais aucune paire à 4 pas', 'Places de ville neutre par flanc (moyenne)', 'Plateaux sans place neutre sur un flanc', 'Plateaux sans solution complète'], lignesC);

// ------------------------------------------------------------------ (d) symétrie et équilibre, (e) variété

console.log('### (d) Symétrie et équilibre sans symétrie, (e) variété des formes : plateaux du générateur complet');
console.log('');
const lignesD = [], lignesE = [];
FORMES.forEach(([nom, demiHauteur]) => {
  const scores = [], centre = [], neutre = [], adverse = [], formes = [];
  let symetriques = 0, reussis = 0;
  for (let g = 1; g <= N; g++) {
    const c = complet(g, { demiHauteur });
    if (!c.res.ok) continue;
    reussis += 1;
    const f = forme(P.cases(c.res.plateau, { sansVilles: true }));
    formes.push(f);
    if (f.symetrique) symetriques += 1;
    const e = K.equilibre(c.res.plateau);
    scores.push(e.score);
    centre.push(e.villes.filter((x) => x.type === 'centre')[0].ecart);
    neutre.push(somme(e.villes.filter((x) => x.type === 'neutre').map((x) => x.ecart)));
    adverse.push(e.adverses.ecart);
  }
  lignesD.push([nom, reussis, symetriques + ' (' + pct(symetriques, reussis) + ')', fr(moyenne(scores), 2), fr(mediane(scores), 1), Math.max(...scores),
    pct(scores.filter((x) => x === 0).length, reussis), pct(scores.filter((x) => x <= 2).length, reussis),
    fr(moyenne(centre), 2), fr(moyenne(neutre), 2), fr(moyenne(adverse), 2)]);
  const col = (cle) => { const t2 = formes.map((x) => x[cle]); return fr(moyenne(t2), 1) + ' (' + fr(Math.min(...t2), 0) + ' à ' + fr(Math.max(...t2), 0) + ' ; écart-type ' + fr(ecartType(t2), 1) + ')'; };
  lignesE.push([nom, reussis, new Set(formes.map((x) => x.signature)).size, col('hauteur'), col('largeurMax'), col('bord'), col('haut'), col('bas')]);
});
tableau(['Forme', 'Plateaux', 'Symétriques par demi-tour', 'Score d’équilibre moyen', 'médian', 'maximal', 'Score 0', 'Score 2 ou moins',
  'Écart moyen vers le centre', 'vers les 2 villes neutres', 'vers les villes de déploiement adverses'], lignesD);
tableau(['Forme', 'Plateaux', 'Formes distinctes', 'Hauteur en rangées : moyenne (étendue ; écart-type)', 'Rangée la plus large (cases)', 'Cases de bord', 'Cases de la rangée du haut', 'Cases de la rangée du bas'], lignesE);

// ------------------------------------------------------------------ (f) bois et marécages : zones d'un seul tenant

console.log('### (f) Zones de forêt et de marais d’un seul tenant, sur les plateaux du générateur complet (11 rangées, sans remplissage)');
console.log('');
/** Zones d'un seul tenant d'un terrain : tailles, de la plus grande à la plus petite. */
function zones(cases, terrain) {
  return P.composantes(Object.keys(cases).filter((k) => cases[k].terrain === terrain)).map((g) => g.length);
}
const lignesF = [];
[0, 1, 2, 4].forEach((accoler) => {
  const temps = [], scores = [], essais = [], nbZones = [], plusGrande = [], isolees = [], moyennes = [], grandes = [];
  let reussis = 0;
  for (let g = 1; g <= N; g++) {
    const c = complet(g, { accolerSpeciales: accoler });
    temps.push(c.temps); essais.push(c.res.essais);
    if (!c.res.ok) continue;
    reussis += 1;
    scores.push(c.res.score);
    const terrain = P.cases(c.res.plateau, { sansVilles: true });
    ['foret', 'marais'].forEach((t) => {
      const z = zones(terrain, t);
      nbZones.push(z.length); plusGrande.push(z[0]); isolees.push(z.filter((x) => x === 1).length); moyennes.push(moyenne(z)); grandes.push(z.filter((x) => x >= 3).length);
    });
  }
  lignesF.push([accoler === 0 ? '0 (réglage livré)' : accoler, reussis + ' / ' + N, fr(moyenne(essais), 2), fr(moyenne(temps), 0), fr(Math.max(...temps), 0), fr(moyenne(scores), 2),
    fr(moyenne(nbZones), 2), fr(moyenne(moyennes), 2), fr(moyenne(plusGrande), 2), Math.max(...plusGrande), fr(moyenne(grandes), 2), fr(moyenne(isolees), 2), pct(Math.round(moyenne(isolees) * 100), 1300)]);
});
tableau(['Réglage accolerSpeciales', 'Générateur réussi', 'Essais (moyenne)', 'Temps moyen (ms)', 'Temps maximal (ms)', 'Score d’équilibre moyen',
  'Zones par terrain (moyenne)', 'Taille moyenne d’une zone', 'Plus grande zone (moyenne)', 'Plus grande zone (maximum)', 'Zones de 3 cases ou plus par terrain', 'Cases isolées par terrain (moyenne)', 'Part des 13 cases du terrain qui restent isolées'], lignesF);
