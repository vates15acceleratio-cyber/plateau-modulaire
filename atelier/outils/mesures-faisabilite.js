/*
 * mesures-faisabilite.js : mesure de faisabilité du générateur (docs/02-atelier-cahier-des-charges.md, §4).
 * Répond à « chaque tuile doit toucher 3 autres tuiles au moins ; voir si 2 peuvent convenir ».
 *
 * Usage (depuis n'importe quel dossier) :
 *   node atelier/outils/mesures-faisabilite.js [graines=500] [formes=2000] [tiragesAveugles=30000]
 * Écrit sur la sortie standard des tableaux au format markdown, repris dans docs/03-mesures-faisabilite.md.
 * Les temps dépendent de la machine ; tout le reste est déterministe (graines 1 à N).
 */
'use strict';
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const G = require(path.join(__dirname, '..', 'src', 'generateur.js'));
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, K = AT.controles;

const NB_GRAINES = parseInt(process.argv[2], 10) || 500;
const NB_FORMES = parseInt(process.argv[3], 10) || 2000;
const NB_AVEUGLES = parseInt(process.argv[4], 10) || 30000;
const NB_PAR_RETOUCHES = Math.min(NB_FORMES, 300);        // tableau « effet du nombre de retouches » : tirages longs au seuil 3
const SEUILS = C.REGLAGES.seuilsContact, MESURES = C.REGLAGES.mesuresContact;
const NOMS = { cotes: 'côtés', pieces: 'pièces' };
const HEXAGONE = new Set(H.disque(C.REGLAGES.generateur.rayon));

const fr = (x, decimales) => x.toFixed(decimales === undefined ? 1 : decimales).replace('.', ',');
// Pourcentage : une décimale, deux quand il est inférieur à 1 % (pour ne pas afficher « 0,0 % »).
const pct = (n, total) => (total ? fr(100 * n / total, (n > 0 && 100 * n / total < 1) ? 2 : 1) + ' %' : '–');
const moyenne = (t) => (t.length ? t.reduce((a, b) => a + b, 0) / t.length : 0);
const ligne = (cellules) => '| ' + cellules.join(' | ') + ' |';

function tableau(entetes, lignes) {
  console.log(ligne(entetes));
  console.log(ligne(entetes.map(() => '---')));
  lignes.forEach((l) => console.log(ligne(l)));
  console.log('');
}

// ------------------------------------------------------------------ 1. le générateur, par combinaison

function mesurerCombinaison(seuil, mesure) {
  const options = { seuilContact: seuil, mesureContact: mesure };
  const m = {
    seuil, mesure, reussites: 0, temps: [], scores: [], essais: [], tirages: [], formes: new Set(), ajouts: new Set(),
    echecs: {}, raisons: new Map(), minCotes: Infinity, minPieces: Infinity, tuilesA2Cotes: [], tuilesA2Pieces: [],
    passeAutreMesure: 0, villeEnPointe: 0, rangeeAjoutee: 0
  };
  for (let graine = 1; graine <= NB_GRAINES; graine++) {
    const debut = performance.now();
    const res = G.generer(graine, options);
    m.temps.push(performance.now() - debut);
    m.essais.push(res.essais);
    m.tirages.push(res.tiragesForme);
    Object.keys(res.echecs).forEach((k) => { m.echecs[k] = (m.echecs[k] || 0) + res.echecs[k]; });
    if (!res.ok) { m.raisons.set(res.raison, (m.raisons.get(res.raison) || 0) + 1); continue; }
    m.reussites += 1;
    m.scores.push(res.score);
    m.formes.add(res.forme);
    m.ajouts.add(res.forme.split(' ').filter((k) => !HEXAGONE.has(k)).join(' '));
    // Contact réellement obtenu, selon les deux mesures.
    const contacts = K.contacts(res.plateau);
    let a2c = 0, a2p = 0, autreOk = true;
    const autre = mesure === 'cotes' ? 'pieces' : 'cotes';
    contacts.forEach((x) => {
      m.minCotes = Math.min(m.minCotes, x.cotes);
      m.minPieces = Math.min(m.minPieces, x.pieces);
      if (x.cotes <= 2) a2c += 1;
      if (x.pieces <= 2) a2p += 1;
      if (x[autre] < seuil) autreOk = false;
    });
    m.tuilesA2Cotes.push(a2c);
    m.tuilesA2Pieces.push(a2p);
    if (autreOk) m.passeAutreMesure += 1;
    // Villes de déploiement : tenues par 2 côtés seulement ? rangée du haut faite de cases ajoutées à l'hexagone ?
    const cases = AT.plateau.cases(res.plateau);
    const deploiement = res.plateau.camps.vert.concat(res.plateau.camps.rouge);
    if (deploiement.some((k) => H.voisines(k).filter((v) => cases[v]).length <= 2)) m.villeEnPointe += 1;
    if (H.decle(res.plateau.camps.vert[0]).r !== 0 - C.REGLAGES.generateur.rayon) m.rangeeAjoutee += 1;
  }
  return m;
}

// ------------------------------------------------------------------ 2. l'espace des formes, par seuil

/** Retouche à l'aveugle (sans guidage) : 3 paires de bord retirées, 3 paires ajoutées, symétrie par demi-tour. */
function retoucheAveugle(alea, retouches) {
  const S = new Set(HEXAGONE), retirees = new Set();
  const moitie = (k) => { const p = H.decle(k); return p.r > 0 || (p.r === 0 && p.q > 0); };
  for (let i = 0; i < retouches; i++) {
    const bord = H.trier([...S].filter((k) => moitie(k) && H.anneau(k) >= 2 && H.voisines(k).some((v) => !S.has(v))));
    const c = alea.choisir(bord);
    S.delete(c); S.delete(H.symetrique(c)); retirees.add(c); retirees.add(H.symetrique(c));
  }
  for (let i = 0; i < retouches; i++) {
    const dehors = new Set();
    S.forEach((k) => H.voisines(k).forEach((v) => { if (!S.has(v) && !retirees.has(v) && moitie(v)) dehors.add(v); }));
    const c = alea.choisir(H.trier([...dehors]));
    S.add(c); S.add(H.symetrique(c));
  }
  return S;
}

/** Tirage guidé du générateur : formes, motifs d'ajout et de retrait distincts sur `nombre` formes demandées. */
function tirageGuide(seuil, retouches, nombre) {
  const R = G.reglages({ seuilContact: seuil, retouches: retouches });
  const alea = AT.alea.creer('formes');
  const formes = new Set(), ajouts = new Set(), retraits = new Set();
  let tirages = 0, echecs = 0;
  for (let i = 0; i < nombre; i++) {
    const f = G.tirerForme(alea, R);
    tirages += f.tirages;
    if (!f.ok) { echecs += 1; continue; }
    const dans = new Set(f.cases);
    formes.add(f.cases.join(' '));
    ajouts.add(f.cases.filter((k) => !HEXAGONE.has(k)).join(' '));
    retraits.add(H.trier([...HEXAGONE].filter((k) => !dans.has(k))).join(' '));
  }
  return { seuil, retouches, formes: formes.size, ajouts: ajouts.size, retraits: retraits.size, tirages, echecs };
}

function mesurerFormes(seuil) {
  const R = G.reglages({ seuilContact: seuil });
  // a) Tirage à l'aveugle : quelle part des retouches respecte la règle ?
  const alea = AT.alea.creer('aveugle');
  let valides = 0;
  const distinctesAveugle = new Set();
  for (let i = 0; i < NB_AVEUGLES; i++) {
    const S = retoucheAveugle(alea, R.retouches);
    if (G.formeValide(S, R)) { valides += 1; distinctesAveugle.add(H.trier([...S]).join(' ')); }
  }
  // b) Tirage guidé du générateur : combien de formes différentes sur NB_FORMES formes demandées ?
  const g = tirageGuide(seuil, R.retouches, NB_FORMES);
  return { seuil, valides, distinctesAveugle: distinctesAveugle.size, formes: g.formes, ajouts: g.ajouts, retraits: g.retraits, tirages: g.tirages, echecs: g.echecs };
}

// ------------------------------------------------------------------ sortie

console.log('<!-- Sortie de atelier/outils/mesures-faisabilite.js ' + NB_GRAINES + ' ' + NB_FORMES + ' ' + NB_AVEUGLES + ' -->');
console.log('');
console.log('### Générateur : ' + NB_GRAINES + ' graines (1 à ' + NB_GRAINES + ') par combinaison');
console.log('');
const mesures = [];
SEUILS.forEach((seuil) => MESURES.forEach((mesure) => mesures.push(mesurerCombinaison(seuil, mesure))));
tableau(
  ['Seuil', 'Mesure', 'Réussite', 'Temps moyen (ms)', 'Temps maximal (ms)', 'Score moyen', 'Score maximal', 'Formes de bord distinctes', 'Motifs d’ajout distincts'],
  mesures.map((m) => [m.seuil, NOMS[m.mesure], m.reussites + ' / ' + NB_GRAINES + ' (' + pct(m.reussites, NB_GRAINES) + ')',
    fr(moyenne(m.temps)), fr(Math.max(...m.temps)), m.scores.length ? fr(moyenne(m.scores), 2) : '–', m.scores.length ? Math.max(...m.scores) : '–',
    m.formes.size, m.ajouts.size]));

console.log('### Détail de la recherche');
console.log('');
tableau(
  ['Seuil', 'Mesure', 'Essais de remplissage (moyenne)', 'Tirages de forme (moyenne)', 'Échecs : forme', 'montagnes', 'villes', 'monoblocs', 'contact', 'contrôles'],
  mesures.map((m) => [m.seuil, NOMS[m.mesure], fr(moyenne(m.essais), 2), fr(moyenne(m.tirages)), m.echecs.forme, m.echecs.montagnes, m.echecs.villes,
    m.echecs.monoblocs, m.echecs.contact, m.echecs.controles + m.echecs.inventaire]));
mesures.forEach((m) => m.raisons.forEach((n, raison) => console.log('- Seuil ' + m.seuil + ', ' + NOMS[m.mesure] + ' : ' + n + ' échec(s) : ' + raison)));
console.log('');

console.log('### Contact réellement obtenu sur les plateaux réussis');
console.log('');
tableau(
  ['Seuil', 'Mesure', 'Minimum de côtés', 'Minimum de pièces', 'Tuiles à 2 côtés ou moins (moyenne par plateau)', 'Tuiles à 2 pièces voisines ou moins (moyenne par plateau)', 'Plateaux qui respectent aussi l’autre mesure',
    'Plateaux avec une ville de déploiement à 2 côtés ou moins', 'Plateaux dont la rangée du haut est faite de cases ajoutées'],
  mesures.map((m) => [m.seuil, NOMS[m.mesure], m.minCotes, m.minPieces, fr(moyenne(m.tuilesA2Cotes), 2), fr(moyenne(m.tuilesA2Pieces), 2), m.passeAutreMesure + ' / ' + m.reussites + ' (' + pct(m.passeAutreMesure, m.reussites) + ')',
    m.villeEnPointe + ' (' + pct(m.villeEnPointe, m.reussites) + ')', m.rangeeAjoutee + ' (' + pct(m.rangeeAjoutee, m.reussites) + ')']));

console.log('### Espace des formes de bord, par seuil');
console.log('');
const formes = SEUILS.map(mesurerFormes);
tableau(
  ['Seuil', 'Retouches à l’aveugle valides (sur ' + NB_AVEUGLES + ')', 'Formes distinctes parmi elles', 'Tirage guidé : formes distinctes (sur ' + NB_FORMES + ' formes demandées)',
    'Motifs d’ajout distincts', 'Motifs de retrait distincts', 'Tirages par forme (moyenne)', 'Échecs du tirage guidé'],
  formes.map((f) => [f.seuil, f.valides + ' (' + pct(f.valides, NB_AVEUGLES) + ')', f.distinctesAveugle, f.formes, f.ajouts, f.retraits, fr(f.tirages / NB_FORMES), f.echecs]));

console.log('### Effet du nombre de retouches (paires de cases retirées puis ajoutées), tirage guidé, ' + NB_PAR_RETOUCHES + ' formes demandées');
console.log('');
const parRetouches = [];
[1, 2, 3, 4, 5].forEach((retouches) => SEUILS.forEach((seuil) => parRetouches.push(tirageGuide(seuil, retouches, NB_PAR_RETOUCHES))));
tableau(
  ['Retouches', 'Seuil', 'Formes distinctes', 'Motifs d’ajout distincts', 'Motifs de retrait distincts', 'Tirages par forme (moyenne)', 'Échecs du tirage'],
  parRetouches.map((f) => [f.retouches, f.seuil, f.formes, f.ajouts, f.retraits, fr(f.tirages / NB_PAR_RETOUCHES), f.echecs]));
