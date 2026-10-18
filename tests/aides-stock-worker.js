'use strict';
/*
 * Fil de calcul de tests/stock-et-catalogue-precedent.test.js : génère les plateaux des graines [debut, fin) (« e0 », « e1 »…) d'un format
 * et renvoie combien se montent avec les exemplaires du catalogue livré (chaque modèle posé au plus autant de fois que ses exemplaires).
 * Même calcul que partMontable, réparti sur plusieurs fils pour que la suite ne soit pas bornée par un seul processeur (docs/49).
 */
const { parentPort, workerData } = require('node:worker_threads');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
require('../src/generateur.js');
const PM = globalThis.PM;

const { grille, debut, fin } = workerData;
const doc = PM.catalogue.nouveauDocument(grille);
const stock = Object.fromEntries(doc.modeles.map((m) => [m.id, m.exemplaires]));
let montables = 0, echecs = [];
for (let k = debut; k < fin; k++) {
  const r = PM.generateur.generer(doc, { graine: 'e' + k });
  if (!r.ok) { echecs.push('e' + k + ' : ' + r.raison); continue; }
  const u = {};
  r.doc.plateau.tuiles.forEach((t) => { u[t.modeleId] = (u[t.modeleId] || 0) + 1; });
  if (Object.keys(u).every((id) => u[id] <= stock[id])) montables++;
}
parentPort.postMessage({ montables, echecs });
