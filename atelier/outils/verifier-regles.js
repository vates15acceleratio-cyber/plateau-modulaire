/*
 * verifier-regles.js : vérifie les règles du §1 du cahier des charges sur des plateaux générés,
 * SANS passer par AT.controles (le générateur s'en sert déjà pour accepter un plateau : ce serait circulaire).
 * Seule la position des cases d'une pièce vient de AT.plateau.casesPiece ; voisinage, parcours et comptes sont refaits ici.
 *
 * Usage, depuis atelier/ :  node outils/verifier-regles.js [nombre de graines = 50] [première graine = 1]
 * Code de sortie 0 si aucun plateau n'enfreint une règle, 1 sinon. Les générations en échec sont comptées, pas ignorées.
 */
'use strict';
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
const C = globalThis.AT.catalogue;

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const cle = (q, r) => q + ',' + r;
const voisines = (k) => { const [q, r] = k.split(',').map(Number); return DIRS.map((d) => cle(q + d[0], r + d[1])); };
const INFRANCHISSABLES = ['montagne'];
const ECART = 4, VILLES = 7, PAR_CAMP = 2;

/** Parcours en largeur depuis `depart` sur les clés de `permises` (Set) : Map clé → pas. */
function parcours(depart, permises) {
  const d = new Map([[depart, 0]]), file = [depart];
  for (let i = 0; i < file.length; i++) {
    for (const v of voisines(file[i])) if (permises.has(v) && !d.has(v)) { d.set(v, d.get(file[i]) + 1); file.push(v); }
  }
  return d;
}

/** Renvoie la liste des manquements d'un plateau (vide = conforme) et quelques mesures. */
function verifier(plateau, seuil, mesure) {
  const fautes = [];
  // Cases : terrain et pièce, chevauchements.
  const cases = new Map();
  for (const piece of plateau.pieces) {
    for (const c of P.casesPiece(piece)) {
      if (cases.has(c.cle)) fautes.push('chevauchement en ' + c.cle);
      cases.set(c.cle, { terrain: c.terrain, piece: piece.id, modele: piece.modele });
    }
  }
  // Toutes les pièces du catalogue, ni plus ni moins.
  const poses = {};
  for (const piece of plateau.pieces) poses[piece.modele] = (poses[piece.modele] || 0) + 1;
  let attenduPieces = 0, attenduCases = 0;
  for (const id of C.ORDRE_MODELES) {
    const m = C.MODELES[id];
    attenduPieces += m.nombre;
    attenduCases += m.nombre * m.cases.length;
    if ((poses[id] || 0) !== m.nombre) fautes.push('pièce ' + id + ' : ' + (poses[id] || 0) + ' posée(s) pour ' + m.nombre);
  }
  for (const id of Object.keys(poses)) if (!C.MODELES[id]) fautes.push('pièce hors catalogue : ' + id);
  if (plateau.pieces.length !== attenduPieces) fautes.push(plateau.pieces.length + ' pièces pour ' + attenduPieces);
  if (cases.size !== attenduCases) fautes.push(cases.size + ' cases pour ' + attenduCases);
  // D'un seul tenant ; cases franchissables reliées.
  const toutes = new Set(cases.keys());
  const franchissables = new Set([...cases.keys()].filter((k) => !INFRANCHISSABLES.includes(cases.get(k).terrain)));
  if (parcours('0,0', toutes).size !== toutes.size) fautes.push('plateau en plusieurs morceaux');
  if (parcours('0,0', franchissables).size !== franchissables.size) fautes.push('cases franchissables non reliées');
  // Noyau en (0,0).
  const noyau = plateau.pieces.filter((x) => C.MODELES[x.modele] && C.MODELES[x.modele].noyau);
  if (noyau.length !== 1 || noyau[0].q !== 0 || noyau[0].r !== 0) fautes.push('noyau absent ou décentré');
  // Villes : nombre, jamais dans un monobloc hors noyau, écart.
  const villes = [...cases.keys()].filter((k) => cases.get(k).terrain === 'ville');
  if (villes.length !== VILLES) fautes.push(villes.length + ' villes pour ' + VILLES);
  for (const v of villes) {
    const m = C.MODELES[cases.get(v).modele];
    if (m.cases.length > 1 && !m.noyau) fautes.push('ville ' + v + ' dans le monobloc ' + m.id);
  }
  let ecartMin = Infinity;
  villes.forEach((a, i) => {
    const d = parcours(a, franchissables);
    villes.slice(i + 1).forEach((b) => {
      const pas = d.has(b) ? d.get(b) : Infinity;
      ecartMin = Math.min(ecartMin, pas);
      if (pas < ECART) fautes.push('villes ' + a + ' et ' + b + ' à ' + pas + ' pas');
    });
  });
  // Villes de déploiement : exactement 2 sur chaque rangée extrême, et ce sont celles enregistrées.
  const rs = [...cases.keys()].map((k) => Number(k.split(',')[1]));
  const haut = Math.min(...rs), bas = Math.max(...rs);
  const sur = (rangee) => villes.filter((k) => Number(k.split(',')[1]) === rangee).sort();
  [['vert', haut, 'haut'], ['rouge', bas, 'bas']].forEach(([camp, rangee, nom]) => {
    const trouvees = sur(rangee);
    if (trouvees.length !== PAR_CAMP) fautes.push(trouvees.length + ' ville(s) sur la rangée du ' + nom);
    const notees = ((plateau.camps && plateau.camps[camp]) || []).slice().sort();
    if (notees.join(' ') !== trouvees.join(' ')) fautes.push('camp ' + camp + ' enregistré [' + notees + '] ≠ rangée du ' + nom + ' [' + trouvees + ']');
  });
  // Contact : chaque pièce, cases voisines occupées par une autre pièce (côtés) et pièces voisines distinctes.
  const parPiece = new Map();
  for (const [k, c] of cases) { if (!parPiece.has(c.piece)) parPiece.set(c.piece, []); parPiece.get(c.piece).push(k); }
  let contactMin = Infinity;
  for (const [id, cles] of parPiece) {
    const cotes = new Set(), pieces = new Set();
    for (const k of cles) for (const v of voisines(k)) if (cases.has(v) && cases.get(v).piece !== id) { cotes.add(v); pieces.add(cases.get(v).piece); }
    const valeur = mesure === 'pieces' ? pieces.size : cotes.size;
    contactMin = Math.min(contactMin, valeur);
    if (valeur < seuil) fautes.push('pièce ' + id + ' : contact ' + valeur + ' < ' + seuil + ' (' + mesure + ')');
  }
  // Répartition des terrains (information).
  const n = { plaine: 0, foret: 0, marais: 0 };
  for (const c of cases.values()) if (c.terrain in n) n[c.terrain] += 1;
  return { fautes, ecartMin, contactMin, terrains: n, cases: cases.size };
}

function lancer(nombre, premiere) {
  let total = 0, fautifs = 0;
  const lignes = [];
  for (const seuil of [3, 2]) {
    for (const mesure of ['cotes', 'pieces']) {
      let reussis = 0, echecs = 0, mauvais = 0, ecartMin = Infinity, contactMin = Infinity, identiques = 0, scoreMax = 0;
      const repartitions = new Set();
      const debut = Date.now();
      for (let g = premiere; g < premiere + nombre; g++) {
        const r = G.generer(g, { seuilContact: seuil, mesureContact: mesure });
        if (!r.ok) { echecs += 1; continue; }
        reussis += 1;
        const plateau = P.avecCamps(r.plateau);
        const v = verifier(plateau, seuil, mesure);
        ecartMin = Math.min(ecartMin, v.ecartMin);
        contactMin = Math.min(contactMin, v.contactMin);
        scoreMax = Math.max(scoreMax, r.score);
        repartitions.add(v.terrains.plaine + '/' + v.terrains.foret + '/' + v.terrains.marais);
        if (JSON.stringify(r.plateau.camps) !== JSON.stringify(plateau.camps)) v.fautes.push('camps du générateur ≠ campsAuto');
        if (!P.lire(P.serialiser(plateau)).ok) v.fautes.push('fichier non relisible');
        if (v.fautes.length) { mauvais += 1; console.log('  NON CONFORME graine ' + g + ' seuil ' + seuil + ' ' + mesure + ' : ' + v.fautes.slice(0, 5).join(' ; ')); }
        if (g < premiere + 5 && JSON.stringify(G.generer(g, { seuilContact: seuil, mesureContact: mesure }).plateau) === JSON.stringify(r.plateau)) identiques += 1;
      }
      total += reussis; fautifs += mauvais;
      lignes.push('seuil ' + seuil + ', mesure ' + mesure + ' : ' + reussis + ' générés, ' + echecs + ' échec(s) de génération, ' + mauvais + ' non conforme(s) ; écart minimal entre villes '
        + ecartMin + ' pas ; contact minimal ' + contactMin + ' ; score d’équilibre maximal ' + scoreMax + ' ; plaines/forêts/marais ' + [...repartitions].join(' ') + ' ; même graine = même plateau ' + identiques + '/'
        + Math.min(5, nombre) + ' ; ' + (Date.now() - debut) + ' ms');
    }
  }
  lignes.forEach((l) => console.log(l));
  console.log('TOTAL : ' + total + ' plateaux vérifiés, ' + fautifs + ' non conforme(s)');
  return fautifs;
}

if (require.main === module) {
  const nombre = parseInt(process.argv[2], 10) || 50, premiere = parseInt(process.argv[3], 10) || 1;
  process.exit(lancer(nombre, premiere) ? 1 : 0);
}
module.exports = { verifier };
