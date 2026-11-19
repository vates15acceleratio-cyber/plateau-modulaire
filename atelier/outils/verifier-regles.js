/*
 * verifier-regles.js : vérifie les règles du §9.1 du cahier des charges (catalogue 2) sur des plateaux générés,
 * SANS passer par AT.controles (le générateur s'en sert déjà pour accepter un plateau : ce serait circulaire).
 * Seule la position des cases d'une pièce vient de AT.plateau.casesPiece ; voisinage, parcours, bords, flancs et
 * comptes sont refaits ici, avec les valeurs des règles écrites en clair ci-dessous (et non lues dans les réglages).
 *
 * Règles vérifiées :
 *   B1  terrain en monoblocs de 3 ou 4 cases seulement ; noyau en (0,0) ; montagnes en blocs de 4 ou 5 ;
 *   B2  tuiles de remplissage : jamais plus que le nombre permis (0 par défaut pour le générateur) ;
 *   B3  toutes les pièces de construction du catalogue, une fois chacune ; pas de chevauchement, pas de trou,
 *       plateau d'un seul tenant, cases franchissables reliées ;
 *   B4  2 villes de déploiement par joueur, posées sur une Plaine du bord, hors noyau, dans les 2 rangées du haut
 *       (Vert) ou du bas (Rouge) ; `camps` = ces tuiles ;
 *   B5  2 villes neutres, tuiles ajoutées contre le bord, une par flanc, dans le tiers central des rangées,
 *       touchant au moins 2 cases ;
 *   B6  7 villes, toutes à 4 pas au moins les unes des autres (par les cases franchissables) ;
 *   B7  contact : chaque monobloc touche au moins `seuil` autres tuiles ; une tuile de remplissage au moins 2 ;
 *   A2  aucune ville imprimée dans un monobloc hors noyau.
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
const coord = (k) => k.split(',').map(Number);
const voisines = (k) => { const [q, r] = coord(k); return DIRS.map((d) => cle(q + d[0], r + d[1])); };
const INFRANCHISSABLES = ['montagne'];
const TERRAINS = ['plaine', 'foret', 'marais'];
const ECART = 4, VILLES = 7, PAR_CAMP = 2, NEUTRES = 2, PROFONDEUR = 2, CONTACT_NEUTRE = 2, CONTACT_REMPLISSAGE = 2;

/** Parcours en largeur depuis `depart` sur les clés de `permises` (Set) : Map clé → pas. */
function parcours(depart, permises) {
  const d = new Map([[depart, 0]]), file = [depart];
  for (let i = 0; i < file.length; i++) {
    for (const v of voisines(file[i])) if (permises.has(v) && !d.has(v)) { d.set(v, d.get(file[i]) + 1); file.push(v); }
  }
  return d;
}

/** Nombre de cases vides entièrement entourées par les cases de `occupees` (Set). */
function casesEnfermees(occupees) {
  const qs = [...occupees].map((k) => coord(k)[0]), rs = [...occupees].map((k) => coord(k)[1]);
  const q0 = Math.min(...qs) - 1, q1 = Math.max(...qs) + 1, r0 = Math.min(...rs) - 1, r1 = Math.max(...rs) + 1;
  const vides = new Set();
  for (let q = q0; q <= q1; q++) for (let r = r0; r <= r1; r++) if (!occupees.has(cle(q, r))) vides.add(cle(q, r));
  return vides.size - parcours(cle(q0, r0), vides).size;
}

/** Renvoie la liste des manquements d'un plateau (vide = conforme) et quelques mesures. */
function verifier(plateau, seuil, mesure, remplissagesPermis) {
  const fautes = [];
  // Cases du TERRAIN (tout sauf les villes neutres) et villes neutres, chevauchements.
  const cases = new Map(), neutres = [];
  for (const piece of plateau.pieces) {
    const liste = P.casesPiece(piece);
    if (!liste.length) fautes.push('pièce hors catalogue : ' + piece.modele);
    if (piece.modele === 'VN') { neutres.push(liste[0].cle); continue; }
    for (const c of liste) {
      if (cases.has(c.cle)) fautes.push('chevauchement en ' + c.cle);
      cases.set(c.cle, { terrain: c.terrain, piece: piece.id, modele: piece.modele, taille: liste.length });
    }
  }
  for (const k of neutres) if (cases.has(k)) fautes.push('ville neutre posée sur une case du terrain : ' + k);
  // B1, A2 : forme des pièces de terrain.
  const parPiece = new Map();
  for (const [k, c] of cases) { if (!parPiece.has(c.piece)) parPiece.set(c.piece, { modele: c.modele, cles: [], terrains: [] }); parPiece.get(c.piece).cles.push(k); parPiece.get(c.piece).terrains.push(c.terrain); }
  let remplissages = 0;
  for (const [id, x] of parPiece) {
    const n = x.cles.length;
    if (x.modele === 'N1') continue;
    if (x.terrains.includes('ville')) fautes.push('A2 : ville dans la pièce ' + id + ' (' + x.modele + ')');
    if (x.terrains.every((t) => t === 'montagne')) { if (n !== 4 && n !== 5) fautes.push('B1 : montagne de ' + n + ' case(s)'); continue; }
    if (!x.terrains.every((t) => TERRAINS.includes(t))) { fautes.push('B1 : pièce ' + id + ' de terrains mêlés'); continue; }
    if (n === 1 && x.modele === 'R' && x.terrains[0] === 'plaine') { remplissages += 1; continue; }
    if (n !== 3 && n !== 4) fautes.push('B1 : pièce de terrain de ' + n + ' case(s) (' + x.modele + ')');
  }
  if (remplissages > remplissagesPermis) fautes.push('B2 : ' + remplissages + ' tuile(s) de remplissage pour ' + remplissagesPermis + ' permise(s)');
  // B3 : toutes les pièces de construction du catalogue, ni plus ni moins.
  const poses = {};
  for (const piece of plateau.pieces) poses[piece.modele] = (poses[piece.modele] || 0) + 1;
  let attenduCases = 0;
  for (const id of C.ORDRE_MODELES) {
    const m = C.MODELES[id];
    if (id === 'R' || id === 'VN') continue;
    attenduCases += m.nombre * m.cases.length;
    if ((poses[id] || 0) !== m.nombre) fautes.push('B3 : pièce ' + id + ' : ' + (poses[id] || 0) + ' posée(s) pour ' + m.nombre);
  }
  for (const id of Object.keys(poses)) if (!C.MODELES[id]) fautes.push('pièce hors catalogue imprimé : ' + id);
  if (cases.size !== attenduCases + remplissages) fautes.push(cases.size + ' cases de terrain pour ' + (attenduCases + remplissages));
  const noyau = plateau.pieces.filter((x) => x.modele === 'N1');
  if (noyau.length !== 1 || noyau[0].q !== 0 || noyau[0].r !== 0 || noyau[0].rotation !== 0) fautes.push('B1 : noyau absent, décentré ou tourné');
  // B3 : d'un seul tenant, sans trou ; cases franchissables reliées.
  const toutes = new Set(cases.keys());
  const franchissables = new Set([...cases.keys()].filter((k) => !INFRANCHISSABLES.includes(cases.get(k).terrain)));
  if (parcours('0,0', toutes).size !== toutes.size) fautes.push('B3 : plateau en plusieurs morceaux');
  if (parcours('0,0', franchissables).size !== franchissables.size) fautes.push('B3 : cases franchissables non reliées');
  const trous = casesEnfermees(toutes);
  if (trous) fautes.push('B3 : ' + trous + ' case(s) vide(s) enfermée(s)');
  // Étendue du terrain : rangées extrêmes, bords gauche et droit de chaque rangée.
  const rangees = new Map();
  for (const k of toutes) { const [q, r] = coord(k); const x = rangees.get(r) || { gauche: q, droite: q }; x.gauche = Math.min(x.gauche, q); x.droite = Math.max(x.droite, q); rangees.set(r, x); }
  const haut = Math.min(...rangees.keys()), bas = Math.max(...rangees.keys());
  // B4 : villes de déploiement.
  const deploiements = plateau.deploiements || [];
  if (deploiements.length !== 2 * PAR_CAMP) fautes.push('B4 : ' + deploiements.length + ' ville(s) de déploiement pour ' + (2 * PAR_CAMP));
  const parCamp = { vert: [], rouge: [] };
  for (const d of deploiements) {
    if (!parCamp[d.camp]) { fautes.push('B4 : camp inconnu'); continue; }
    parCamp[d.camp].push(d.cle);
    const c = cases.get(d.cle), r = coord(d.cle)[1];
    if (!c) { fautes.push('B4 : ville de déploiement hors du terrain en ' + d.cle); continue; }
    if (c.terrain !== 'plaine') fautes.push('B4 : ville de déploiement sur ' + c.terrain + ' en ' + d.cle);
    if (c.modele === 'N1') fautes.push('B4 : ville de déploiement sur le noyau en ' + d.cle);
    if (!voisines(d.cle).some((v) => !toutes.has(v))) fautes.push('B4 : ville de déploiement hors du bord en ' + d.cle);
    if (d.camp === 'vert' ? r > haut + PROFONDEUR - 1 : r < bas - PROFONDEUR + 1) fautes.push('B4 : ville de ' + d.camp + ' hors des ' + PROFONDEUR + ' rangées extrêmes en ' + d.cle);
  }
  for (const camp of ['vert', 'rouge']) {
    if (parCamp[camp].length !== PAR_CAMP) fautes.push('B4 : ' + parCamp[camp].length + ' ville(s) de déploiement pour ' + camp);
    const notees = ((plateau.camps && plateau.camps[camp]) || []).slice().sort();
    if (notees.join(' ') !== parCamp[camp].slice().sort().join(' ')) fautes.push('B4 : camp ' + camp + ' enregistré [' + notees + '] ≠ tuiles posées [' + parCamp[camp] + ']');
  }
  if (new Set(deploiements.map((d) => d.cle)).size !== deploiements.length) fautes.push('B4 : deux villes de déploiement sur la même case');
  // B5 : villes neutres.
  if (neutres.length !== NEUTRES) fautes.push('B5 : ' + neutres.length + ' ville(s) neutre(s) pour ' + NEUTRES);
  const tiers = Math.floor((bas - haut + 1) / 3), flancs = [];
  let contactNeutreMin = Infinity;
  for (const k of neutres) {
    const [q, r] = coord(k), rangee = rangees.get(r);
    const touchees = voisines(k).filter((v) => toutes.has(v));
    contactNeutreMin = Math.min(contactNeutreMin, touchees.length);
    if (touchees.length < CONTACT_NEUTRE) fautes.push('B5 : ville neutre en ' + k + ' touchant ' + touchees.length + ' case(s)');
    if (!touchees.some((v) => franchissables.has(v))) fautes.push('B5 : ville neutre en ' + k + ' hors d’atteinte');
    if (!rangee || !(q < rangee.gauche || q > rangee.droite)) { fautes.push('B5 : ville neutre en ' + k + ' hors des flancs'); continue; }
    flancs.push(q < rangee.gauche ? 'gauche' : 'droite');
    if (r < haut + tiers || r > bas - tiers) fautes.push('B5 : ville neutre en ' + k + ' hors du tiers central des rangées');
  }
  if (neutres.length === NEUTRES && flancs.slice().sort().join(' ') !== 'droite gauche') fautes.push('B5 : flancs des villes neutres : ' + flancs.join(', '));
  // B6 : 7 villes, écart de 4 pas. Les villes neutres sont franchissables ; une ville de déploiement reste une case du terrain.
  const villes = [...cases.keys()].filter((k) => cases.get(k).terrain === 'ville').concat(deploiements.map((d) => d.cle), neutres);
  if (villes.length !== VILLES || new Set(villes).size !== VILLES) fautes.push('B6 : ' + villes.length + ' villes pour ' + VILLES);
  const marchables = new Set([...franchissables, ...neutres]);
  let ecartMin = Infinity;
  villes.forEach((a, i) => {
    const d = parcours(a, marchables);
    villes.slice(i + 1).forEach((b) => {
      const pas = d.has(b) ? d.get(b) : Infinity;
      ecartMin = Math.min(ecartMin, pas);
      if (pas < ECART) fautes.push('B6 : villes ' + a + ' et ' + b + ' à ' + pas + ' pas');
    });
  });
  // B7 : contact de chaque pièce du terrain (cases voisines d'une autre pièce : côtés ; pièces voisines distinctes).
  let contactMin = Infinity;
  for (const [id, x] of parPiece) {
    const cotes = new Set(), pieces = new Set();
    for (const k of x.cles) for (const v of voisines(k)) if (cases.has(v) && cases.get(v).piece !== id) { cotes.add(v); pieces.add(cases.get(v).piece); }
    if (x.modele === 'R') { if (pieces.size < CONTACT_REMPLISSAGE) fautes.push('B7 : remplissage ' + id + ' touchant ' + pieces.size + ' pièce(s)'); continue; }
    const valeur = mesure === 'pieces' ? pieces.size : cotes.size;
    contactMin = Math.min(contactMin, valeur);
    if (valeur < seuil) fautes.push('B7 : pièce ' + id + ' (' + x.modele + ') : contact ' + valeur + ' < ' + seuil + ' (' + mesure + ')');
  }
  // Répartition des terrains (information) : terrain construit, puis plateau fini (4 Plaines sous les villes de déploiement).
  const n = { plaine: 0, foret: 0, marais: 0 };
  for (const c of cases.values()) if (c.terrain in n) n[c.terrain] += 1;
  return { fautes, ecartMin, contactMin, contactNeutreMin, terrains: n, cases: cases.size, remplissages, hauteur: bas - haut + 1 };
}

function lancer(nombre, premiere) {
  let total = 0, fautifs = 0, echecsTotal = 0;
  const lignes = [];
  const combinaisons = [];
  for (const seuil of [3, 2]) for (const mesure of ['pieces', 'cotes']) combinaisons.push({ seuil, mesure, remplissages: 0 });
  combinaisons.push({ seuil: 3, mesure: 'pieces', remplissages: 2 });
  for (const { seuil, mesure, remplissages } of combinaisons) {
    let reussis = 0, echecs = 0, mauvais = 0, ecartMin = Infinity, contactMin = Infinity, contactNeutreMin = Infinity, identiques = 0, scoreMax = 0, scoreTotal = 0, poses = 0, tempsMax = 0;
    const repartitions = new Set(), formes = new Set();
    const options = { seuilContact: seuil, mesureContact: mesure, remplissages };
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
      contactNeutreMin = Math.min(contactNeutreMin, v.contactNeutreMin);
      scoreMax = Math.max(scoreMax, r.score);
      scoreTotal += r.score;
      poses += v.remplissages;
      repartitions.add(v.terrains.plaine + '/' + v.terrains.foret + '/' + v.terrains.marais);
      formes.add(r.plateau.pieces.map((x) => x.modele + ':' + x.q + ',' + x.r + ',' + x.rotation).join(' '));
      if (JSON.stringify(P.avecCamps(r.plateau).camps) !== JSON.stringify(r.plateau.camps)) v.fautes.push('camps du générateur ≠ campsAuto');
      const relu = P.lire(P.serialiser(r.plateau));
      if (!relu.ok || JSON.stringify(relu.plateau) !== JSON.stringify(r.plateau)) v.fautes.push('fichier non relisible à l’identique');
      if (v.fautes.length) { mauvais += 1; console.log('  NON CONFORME graine ' + g + ' seuil ' + seuil + ' ' + mesure + ' : ' + v.fautes.slice(0, 5).join(' ; ')); }
      if (g < premiere + 5 && JSON.stringify(G.generer(g, options).plateau) === JSON.stringify(r.plateau)) identiques += 1;
    }
    total += reussis; fautifs += mauvais; echecsTotal += echecs;
    lignes.push('seuil ' + seuil + ', mesure ' + mesure + ', remplissages permis ' + remplissages + ' : ' + reussis + ' générés, ' + echecs + ' échec(s) de génération, ' + mauvais + ' non conforme(s) ; écart minimal entre villes '
      + ecartMin + ' pas ; contact minimal ' + contactMin + ' (villes neutres : ' + contactNeutreMin + ' cases) ; remplissages posés ' + poses + ' ; score d’équilibre moyen ' + (reussis ? (scoreTotal / reussis).toFixed(2) : '–') + ', maximal ' + scoreMax
      + ' ; plaines/forêts/marais du terrain ' + [...repartitions].join(' ') + ' ; plateaux distincts ' + formes.size + ' ; même graine = même plateau ' + identiques + '/' + Math.min(5, nombre)
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
