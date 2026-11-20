/*
 * verifier-regles.js : vérifie les règles des §9.1 et §10 du cahier des charges sur des plateaux générés,
 * SANS passer par AT.controles (le générateur s'en sert déjà pour accepter un plateau : ce serait circulaire).
 * Seule la position des cases d'une pièce vient de AT.plateau.casesPiece ; voisinage, parcours et comptes sont
 * refaits ici, avec les valeurs des règles écrites en clair ci-dessous (et non lues dans les réglages).
 *
 * Règles vérifiées :
 *   B1  terrain en monoblocs de 3 ou 4 cases seulement, aucun tout en plaine ; noyau en (0,0) ; montagnes en blocs
 *       de 4 ou 5, jamais mêlées à un autre terrain. La règle vaut pour TOUTE pièce posée : du catalogue, retirée du
 *       catalogue ou personnelle (une pièce personnelle ou retirée qui la respecte n'est pas une faute) ;
 *   B2  tuiles de remplissage : jamais plus que le nombre permis (0 par défaut pour le générateur) ;
 *   B3  toutes les pièces de construction du catalogue, une fois chacune ; pas de chevauchement, pas de trou,
 *       plateau d'un seul tenant, cases franchissables reliées ;
 *   C1  villes hors noyau : 6 tuiles posées PAR-DESSUS une case (aucune ville en pièce d'une case), 2 neutres,
 *       2 pour Vert, 2 pour Rouge ; `camps` = les tuiles de Vert et de Rouge ;
 *   C2  chacune sur une Plaine du plateau, hors noyau, une seule par case (aucune règle de bord ni de flanc) ;
 *   C3  7 villes avec celle du centre, toutes reliées entre elles et à 4 pas au moins les unes des autres (par les
 *       cases franchissables) ;
 *   B7  contact : chaque monobloc touche au moins `seuil` autres tuiles ; une tuile de remplissage au moins 2 (ou
 *       `seuil` s'il est plus petit), avec la même mesure que les monoblocs ;
 *   A2  aucune ville imprimée dans un monobloc hors noyau.
 * Le déséquilibre n'est pas une règle (§10, C5) : le score est seulement rapporté.
 *
 * Combinaisons vérifiées : seuil 3 / 2 × mesure pièces / côtés (sans remplissage), puis seuil 3 « pièces » avec
 * 2 remplissages permis.
 *
 * Usage, depuis atelier/ :  node outils/verifier-regles.js [nombre de graines = 50] [première graine = 1]
 * Code de sortie 0 si aucun plateau n'enfreint une règle, 1 sinon. Les générations en échec sont comptées, pas ignorées.
 * tests/verifier-regles.test.js prouve que chaque règle est bien détectée quand on l'enfreint.
 */
'use strict';
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
const C = globalThis.AT.catalogue;

const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const cle = (q, r) => q + ',' + r;
const coord = (k) => k.split(',').map(Number);
const voisines = (k) => { const [q, r] = coord(k); return DIRS.map((d) => cle(q + d[0], r + d[1])); };
const INFRANCHISSABLES = ['montagne'];
const TERRAINS = ['plaine', 'foret', 'marais'];
const ECART = 4, VILLES = 7, PAR_CAMP = 2, NEUTRES = 2, CONTACT_REMPLISSAGE = 2;

/** Parcours en largeur depuis `depart` sur les clés de `permises` (Set) : Map clé → pas. */
function parcours(depart, permises) {
  const d = new Map([[depart, 0]]), file = [depart];
  for (let i = 0; i < file.length; i++) {
    for (const v of voisines(file[i])) if (permises.has(v) && !d.has(v)) { d.set(v, d.get(file[i]) + 1); file.push(v); }
  }
  return d;
}

/** Cases vides entièrement entourées par les cases de `occupees` (Set) : Set de clés. */
function casesEnfermees(occupees) {
  const qs = [...occupees].map((k) => coord(k)[0]), rs = [...occupees].map((k) => coord(k)[1]);
  const q0 = Math.min(...qs) - 1, q1 = Math.max(...qs) + 1, r0 = Math.min(...rs) - 1, r1 = Math.max(...rs) + 1;
  const vides = new Set();
  for (let q = q0; q <= q1; q++) for (let r = r0; r <= r1; r++) if (!occupees.has(cle(q, r))) vides.add(cle(q, r));
  const dehors = parcours(cle(q0, r0), vides);
  return new Set([...vides].filter((k) => !dehors.has(k)));
}

/** Renvoie la liste des manquements d'un plateau (vide = conforme) et quelques mesures. */
function verifier(plateau, seuil, mesure, remplissagesPermis) {
  const fautes = [];
  // Format : un plateau généré est en version 2, sans tuile d'événement, sans champ des règles précédentes.
  if (plateau.version !== 2) fautes.push('format : version ' + plateau.version);
  if ((plateau.recouvrements || []).length) fautes.push('format : tuile d’événement sur un plateau généré');
  if ('profondeurExtremite' in plateau) fautes.push('format : champ profondeurExtremite (règles précédentes) écrit dans le plateau');
  // Cases du terrain, chevauchements. Une ville en pièce d'une case (VN, V) est une faute : les villes se posent par-dessus.
  const cases = new Map();
  for (const piece of plateau.pieces) {
    const liste = P.casesPiece(piece, plateau);          // le document porte ses pièces personnelles
    if (!liste.length) { fautes.push('pièce hors catalogue : ' + piece.modele); continue; }
    if (liste.length === 1 && liste[0].terrain === 'ville') { fautes.push('C1 : ville en pièce d’une case (' + piece.modele + ') en ' + liste[0].cle); continue; }
    for (const c of liste) {
      if (cases.has(c.cle)) fautes.push('chevauchement en ' + c.cle);
      cases.set(c.cle, { terrain: c.terrain, piece: piece.id, modele: piece.modele, taille: liste.length });
    }
  }
  // B1, A2 : forme des pièces de terrain.
  const parPiece = new Map();
  for (const [k, c] of cases) { if (!parPiece.has(c.piece)) parPiece.set(c.piece, { modele: c.modele, cles: [], terrains: [] }); parPiece.get(c.piece).cles.push(k); parPiece.get(c.piece).terrains.push(c.terrain); }
  let remplissages = 0, casesEnPlus = 0;                 // casesEnPlus : cases des pièces qui ne sont pas au catalogue imprimé
  for (const [id, x] of parPiece) {
    if (!C.MODELES[x.modele]) casesEnPlus += x.cles.length;
    const n = x.cles.length;
    if (x.modele === 'N1') continue;
    if (x.terrains.includes('ville')) fautes.push('A2 : ville dans la pièce ' + id + ' (' + x.modele + ')');
    if (x.terrains.every((t) => t === 'montagne')) { if (n !== 4 && n !== 5) fautes.push('B1 : montagne de ' + n + ' case(s)'); continue; }
    if (!x.terrains.every((t) => TERRAINS.includes(t))) { fautes.push('B1 : pièce ' + id + ' de terrains mêlés'); continue; }
    if (n === 1 && x.modele === 'R' && x.terrains[0] === 'plaine') { remplissages += 1; continue; }
    if (n !== 3 && n !== 4) fautes.push('B1 : pièce de terrain de ' + n + ' case(s) (' + x.modele + ')');
    // Décision du 2026-11-19 : aucun monobloc tout en plaine (chacun porte au moins une forêt ou un marais).
    if (n > 1 && x.terrains.every((t) => t === 'plaine')) fautes.push('B1 : monobloc tout en plaine (' + x.modele + ')');
  }
  if (remplissages > remplissagesPermis) fautes.push('B2 : ' + remplissages + ' tuile(s) de remplissage pour ' + remplissagesPermis + ' permise(s)');
  // B3 : toutes les pièces de construction du catalogue, ni plus ni moins.
  const poses = {};
  for (const piece of plateau.pieces) poses[piece.modele] = (poses[piece.modele] || 0) + 1;
  let attenduCases = 0;
  for (const id of C.ORDRE_MODELES) {
    const m = C.MODELES[id];
    if (id === 'R') continue;
    attenduCases += m.nombre * m.cases.length;
    if ((poses[id] || 0) !== m.nombre) fautes.push('B3 : pièce ' + id + ' : ' + (poses[id] || 0) + ' posée(s) pour ' + m.nombre);
  }
  // Une pièce personnelle ou retirée du catalogue n'est pas une faute en soi : c'est B1, ci-dessus, qui la juge.
  if (cases.size !== attenduCases + remplissages + casesEnPlus) fautes.push(cases.size + ' cases de terrain pour ' + (attenduCases + remplissages + casesEnPlus));
  const noyau = plateau.pieces.filter((x) => x.modele === 'N1');
  if (noyau.length !== 1 || noyau[0].q !== 0 || noyau[0].r !== 0 || noyau[0].rotation !== 0) fautes.push('B1 : noyau absent, décentré ou tourné');
  // B3 : d'un seul tenant, sans trou ; cases franchissables reliées.
  const toutes = new Set(cases.keys());
  const franchissables = new Set([...cases.keys()].filter((k) => !INFRANCHISSABLES.includes(cases.get(k).terrain)));
  if (parcours('0,0', toutes).size !== toutes.size) fautes.push('B3 : plateau en plusieurs morceaux');
  if (parcours('0,0', franchissables).size !== franchissables.size) fautes.push('B3 : cases franchissables non reliées');
  const enfermees = casesEnfermees(toutes), trous = enfermees.size;
  if (trous) fautes.push('B3 : ' + trous + ' case(s) vide(s) enfermée(s)');
  // C1, C2 : les 6 villes posées par-dessus une Plaine.
  const posees = plateau.deploiements || [];
  if (posees.length !== 2 * PAR_CAMP + NEUTRES) fautes.push('C1 : ' + posees.length + ' ville(s) posée(s) pour ' + (2 * PAR_CAMP + NEUTRES));
  const parProprietaire = { neutre: [], vert: [], rouge: [] };
  for (const d of posees) {
    if (!Object.prototype.hasOwnProperty.call(parProprietaire, d.camp)) { fautes.push('C1 : propriétaire inconnu'); continue; }
    parProprietaire[d.camp].push(d.cle);
    const c = cases.get(d.cle);
    if (!c) { fautes.push('C2 : ville hors du terrain en ' + d.cle); continue; }
    if (c.terrain !== 'plaine') fautes.push('C2 : ville sur ' + c.terrain + ' en ' + d.cle);
    if (c.modele === 'N1') fautes.push('C2 : ville sur le noyau en ' + d.cle);
  }
  if (parProprietaire.neutre.length !== NEUTRES) fautes.push('C1 : ' + parProprietaire.neutre.length + ' ville(s) neutre(s) pour ' + NEUTRES);
  for (const camp of ['vert', 'rouge']) {
    if (parProprietaire[camp].length !== PAR_CAMP) fautes.push('C1 : ' + parProprietaire[camp].length + ' ville(s) de déploiement pour ' + camp);
    const notees = ((plateau.camps && plateau.camps[camp]) || []).slice().sort();
    if (notees.join(' ') !== parProprietaire[camp].slice().sort().join(' ')) fautes.push('C1 : camp ' + camp + ' enregistré [' + notees + '] ≠ tuiles posées [' + parProprietaire[camp] + ']');
  }
  if (new Set(posees.map((d) => d.cle)).size !== posees.length) fautes.push('C2 : deux villes sur la même case');
  // C3 : 7 villes, écart de 4 pas. Une ville posée par-dessus reste une case franchissable du terrain.
  const villes = [...cases.keys()].filter((k) => cases.get(k).terrain === 'ville').concat(posees.map((d) => d.cle));
  if (villes.length !== VILLES || new Set(villes).size !== VILLES) fautes.push('C3 : ' + villes.length + ' villes pour ' + VILLES);
  let ecartMin = Infinity;
  villes.forEach((a, i) => {
    const d = parcours(a, franchissables);
    villes.slice(i + 1).forEach((b) => {
      const pas = d.has(b) ? d.get(b) : Infinity;
      if (pas === Infinity) fautes.push('C3 : villes ' + a + ' et ' + b + ' non reliées par les cases franchissables');
      ecartMin = Math.min(ecartMin, pas);
      if (pas < ECART) fautes.push('C3 : villes ' + a + ' et ' + b + ' à ' + pas + ' pas');
    });
  });
  // B7 : contact de chaque pièce du terrain (cases voisines d'une autre pièce : côtés ; pièces voisines distinctes).
  let contactMin = Infinity;
  for (const [id, x] of parPiece) {
    const cotes = new Set(), pieces = new Set();
    for (const k of x.cles) for (const v of voisines(k)) if (cases.has(v) && cases.get(v).piece !== id) { cotes.add(v); pieces.add(cases.get(v).piece); }
    const valeur = mesure === 'pieces' ? pieces.size : cotes.size;
    // Tuile de remplissage : même mesure que les monoblocs, seuil propre (jamais plus exigeant que le leur).
    if (x.modele === 'R') { const s = Math.min(seuil, CONTACT_REMPLISSAGE); if (valeur < s) fautes.push('B7 : remplissage ' + id + ' : contact ' + valeur + ' < ' + s + ' (' + mesure + ')'); continue; }
    contactMin = Math.min(contactMin, valeur);
    if (valeur < seuil) fautes.push('B7 : pièce ' + id + ' (' + x.modele + ') : contact ' + valeur + ' < ' + seuil + ' (' + mesure + ')');
  }
  // Répartition des terrains (information) : terrain construit (6 Plaines portent ensuite une ville).
  const n = { plaine: 0, foret: 0, marais: 0 };
  for (const c of cases.values()) if (c.terrain in n) n[c.terrain] += 1;
  return { fautes, ecartMin, contactMin, terrains: n, cases: cases.size, remplissages };
}

function lancer(nombre, premiere) {
  let total = 0, fautifs = 0, echecsTotal = 0;
  const lignes = [];
  const combinaisons = [];
  for (const seuil of [3, 2]) for (const mesure of ['pieces', 'cotes']) combinaisons.push({ seuil, mesure, remplissages: 0 });
  combinaisons.push({ seuil: 3, mesure: 'pieces', remplissages: 2 });
  for (const { seuil, mesure, remplissages } of combinaisons) {
    let reussis = 0, echecs = 0, mauvais = 0, ecartMin = Infinity, contactMin = Infinity, identiques = 0, scoreMax = 0, scoreTotal = 0, annonces = 0, poses = 0, tempsMax = 0;
    const repartitions = new Set(), formes = new Set();
    const options = { seuilContact: seuil, mesureContact: mesure, remplissages };
    let comparables = 0;      // comparables : plateaux générés parmi les 5 premières graines
    const debut = Date.now();
    for (let g = premiere; g < premiere + nombre; g++) {
      const t = Date.now();
      const r = G.generer(g, options);
      tempsMax = Math.max(tempsMax, Date.now() - t);
      if (!r.ok) { echecs += 1; console.log('  ÉCHEC DE GÉNÉRATION graine ' + g + ' seuil ' + seuil + ' ' + mesure + ' : ' + r.raison); continue; }
      reussis += 1;
      const v = verifier(r.plateau, seuil, mesure, remplissages);
      ecartMin = Math.min(ecartMin, v.ecartMin);
      contactMin = Math.min(contactMin, v.contactMin);
      scoreMax = Math.max(scoreMax, r.score);
      scoreTotal += r.score;
      if (r.annonce) annonces += 1;
      poses += v.remplissages;
      repartitions.add(v.terrains.plaine + '/' + v.terrains.foret + '/' + v.terrains.marais);
      formes.add(r.plateau.pieces.map((x) => x.modele + ':' + x.q + ',' + x.r + ',' + x.rotation).join(' '));
      if (JSON.stringify(P.avecCamps(r.plateau).camps) !== JSON.stringify(r.plateau.camps)) v.fautes.push('camps du générateur ≠ campsAuto');
      const relu = P.lire(P.serialiser(r.plateau));
      if (!relu.ok || JSON.stringify(relu.plateau) !== JSON.stringify(r.plateau)) v.fautes.push('fichier non relisible à l’identique');
      if (v.fautes.length) { mauvais += 1; console.log('  NON CONFORME graine ' + g + ' seuil ' + seuil + ' ' + mesure + ' : ' + v.fautes.slice(0, 5).join(' ; ')); }
      if (g < premiere + 5) { comparables += 1; if (JSON.stringify(G.generer(g, options).plateau) === JSON.stringify(r.plateau)) identiques += 1; }
    }
    total += reussis; fautifs += mauvais; echecsTotal += echecs;
    lignes.push('seuil ' + seuil + ', mesure ' + mesure + ', remplissages permis ' + remplissages + ' : ' + reussis + ' générés, ' + echecs + ' échec(s) de génération, ' + mauvais + ' non conforme(s) ; écart minimal entre villes '
      + ecartMin + ' pas ; contact minimal ' + contactMin + ' ; remplissages posés ' + poses + ' ; score d’équilibre moyen ' + (reussis ? (scoreTotal / reussis).toFixed(2) : '–') + ', maximal ' + scoreMax + ', ' + annonces + ' déséquilibre(s) annoncé(s)'
      + ' ; plaines/forêts/marais du terrain ' + [...repartitions].join(' ') + ' ; plateaux distincts ' + formes.size + ' ; même graine = même plateau ' + identiques + '/' + comparables
      + ' ; ' + (Date.now() - debut) + ' ms (au plus ' + tempsMax + ' ms par plateau)');
  }
  lignes.forEach((l) => console.log(l));
  console.log('TOTAL : ' + total + ' plateaux vérifiés, ' + fautifs + ' non conforme(s), ' + echecsTotal + ' échec(s) de génération');
  return fautifs;
}

if (require.main === module) {
  const nombre = parseInt(process.argv[2], 10) || 50, premiere = parseInt(process.argv[3], 10) || 1;
  process.exit(lancer(nombre, premiere) ? 1 : 0);
}
module.exports = { verifier };
