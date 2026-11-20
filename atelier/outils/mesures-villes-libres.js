/*
 * mesures-villes-libres.js : mesure courte des villes libres sur une Plaine (cahier des charges §10).
 * Pour chaque graine : nombre de Plaines admissibles du terrain construit (hors noyau, à 4 pas au moins de la ville
 * du centre), terrains sans solution pour les 6 villes, score d'équilibre du plateau rendu, temps de génération.
 * Usage, depuis atelier/ :  node outils/mesures-villes-libres.js [nombre de graines = 100] [première graine = 1]
 * Résultats consignés en tête de docs/07-mesures-catalogue-2.md.
 */
'use strict';
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
const C = globalThis.AT.catalogue;

const nombre = parseInt(process.argv[2], 10) || 100, premiere = parseInt(process.argv[3], 10) || 1;
const seuil = C.REGLAGES.equilibre.seuilAnnonce;
const places = [], scores = [], temps = [];
let echecs = 0, terrainsSansVilles = 0, essais = 0, annonces = 0;
for (let g = premiere; g < premiere + nombre; g++) {
  const debut = process.hrtime.bigint();
  const r = G.generer(g);
  temps.push(Number(process.hrtime.bigint() - debut) / 1e6);
  essais += r.essais;
  terrainsSansVilles += r.echecs.villes;
  if (!r.ok) { echecs += 1; continue; }
  // Plaines admissibles : le terrain rendu, sans ses villes.
  const terrain = P.casesPourVilles(Object.assign({}, r.plateau, { deploiements: [] }));
  places.push(P.placesVilleSurCases(terrain).length);
  scores.push(r.score);
  if (r.annonce) annonces += 1;
}
const tri = (t) => t.slice().sort((a, b) => a - b);
const moyenne = (t) => t.reduce((n, x) => n + x, 0) / (t.length || 1);
const mediane = (t) => { const s = tri(t); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };
const repartition = {};
scores.forEach((s) => { repartition[s] = (repartition[s] || 0) + 1; });
console.log('Graines ' + premiere + ' à ' + (premiere + nombre - 1) + ' : ' + scores.length + ' plateaux générés, ' + echecs + ' échec(s) de génération, ' + essais + ' terrains construits ou tentés.');
console.log('Plaines admissibles par plateau : minimum ' + tri(places)[0] + ', moyenne ' + moyenne(places).toFixed(1) + ', médiane ' + mediane(places) + ', maximum ' + tri(places)[places.length - 1] + '.');
console.log('Terrains sans solution pour les 6 villes : ' + terrainsSansVilles + ' ; plateaux sans solution : ' + echecs + '.');
console.log('Score d’équilibre : moyen ' + moyenne(scores).toFixed(2) + ', médian ' + mediane(scores) + ', maximal ' + tri(scores)[scores.length - 1] + ' ; répartition ' + JSON.stringify(repartition)
  + ' ; au-dessus du seuil d’annonce (' + seuil + ') : ' + annonces + ' (' + (100 * annonces / (scores.length || 1)).toFixed(1) + ' %).');
console.log('Temps de génération par plateau : moyen ' + moyenne(temps).toFixed(0) + ' ms, médian ' + mediane(temps).toFixed(0) + ' ms, maximal ' + tri(temps)[temps.length - 1].toFixed(0) + ' ms.');
