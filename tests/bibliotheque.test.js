// Tests de la suppression des tuiles utilisateur de la bibliothèque (fonctions pures + historique), sans DOM.
// Lancer : node --test tests/bibliotheque.test.js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');

require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/rendu.js');
require('../src/etat.js');
require('../src/bibliotheque.js');
var PM = globalThis.PM, M = PM.modele, B = PM.bibliotheque, C = PM.catalogue;

function copie(id, nouvelId) {
  var m = JSON.parse(JSON.stringify(C.modeles.filter(function (x) { return x.id === id; })[0]));
  m.id = nouvelId; m.nom = 'Copie de ' + id;
  return m;
}

/** Catalogue 4×4 + une tuile utilisateur « U1 » (copie de C1) posée sur les 4 cases centrales, avec une ville en (2,2). */
function docAvecTuileUtilisateur(avecVille) {
  var d = M.ajouterModele(C.nouveauDocument(), copie('C1', 'U1'));
  [[1, 1], [2, 1], [1, 2], [2, 2]].forEach(function (c) { d = M.poserTuile(d, 'U1', c[0], c[1]); });
  if (avecVille !== false) d = M.poserJeton(d, 2, 2, 'capture');
  return d;
}

test('estTuileUtilisateur : le catalogue livré n’est pas supprimable, une tuile ajoutée l’est', function () {
  var d = M.ajouterModele(C.nouveauDocument(), copie('B1', 'U2'));
  C.modeles.forEach(function (m) { assert.equal(B.estTuileUtilisateur(d, m.id), false, m.id); });
  assert.equal(B.estTuileUtilisateur(d, 'U2'), true);
  assert.equal(B.estTuileUtilisateur(d, 'inconnu'), false);
});

test('supprimerTuileUtilisateur : tuile du catalogue ou inconnue = Error, document inchangé', function () {
  var d = C.nouveauDocument(), avant = JSON.stringify(d);
  assert.throws(function () { B.supprimerTuileUtilisateur(d, 'C1'); }, /catalogue/);
  assert.throws(function () { B.supprimerTuileUtilisateur(d, 'zzz'); }, /introuvable/);
  assert.equal(JSON.stringify(d), avant);
});

test('supprimerTuileUtilisateur : sans tuile posée, retire seulement le modèle', function () {
  var d = M.ajouterModele(C.nouveauDocument(), copie('B1', 'U2'));
  var apres = B.supprimerTuileUtilisateur(d, 'U2');
  assert.equal(M.modeleParId(apres, 'U2'), null);
  assert.equal(apres.modeles.length, C.modeles.length);
  assert.ok(M.modeleParId(d, 'U2'), 'le document d’origine n’est pas modifié');
  assert.deepEqual(B.effetsSuppression(d, 'U2'), { tuilesRetirees: 0, villesRetirees: 0 });
});

test('effetsSuppression : compte les tuiles posées et les villes retirées', function () {
  var d = docAvecTuileUtilisateur(true);
  assert.deepEqual(B.effetsSuppression(d, 'U1'), { tuilesRetirees: 4, villesRetirees: 1 });
  assert.deepEqual(B.effetsSuppression(docAvecTuileUtilisateur(false), 'U1'), { tuilesRetirees: 4, villesRetirees: 0 });
  assert.throws(function () { B.effetsSuppression(d, 'zzz'); }, /introuvable/);
});

test('supprimerTuileUtilisateur : retire le modèle, ses tuiles posées et la ville devenue invalide', function () {
  var d = docAvecTuileUtilisateur(true), apres = B.supprimerTuileUtilisateur(d, 'U1');
  assert.equal(M.modeleParId(apres, 'U1'), null);
  assert.equal(apres.plateau.tuiles.length, 0);
  assert.equal(apres.plateau.jetons.length, 0);
  assert.equal(d.plateau.tuiles.length, 4, 'le document d’origine est intact');
  assert.equal(M.validerPlateau(apres).erreurs.filter(function (e) { return /introuvable|absent/i.test(e.message); }).length, 0);
});

test('supprimerTuileUtilisateur : les tuiles des autres modèles restent posées', function () {
  var d = docAvecTuileUtilisateur(false);
  d = M.retirerTuile(d, 2, 2);
  d = M.poserTuile(d, 'C2', 2, 2);
  var apres = B.supprimerTuileUtilisateur(d, 'U1');
  assert.equal(apres.plateau.tuiles.length, 1);
  assert.equal(M.tuileEn(apres, 2, 2).modeleId, 'C2');
});

test('suppression par etat.appliquer : une seule entrée d’historique, annulable puis rétablissable', function () {
  var etat = PM.etat.creer(docAvecTuileUtilisateur(true));
  var avant = JSON.stringify(etat.doc());
  var r = etat.appliquer(function (d) { return B.supprimerTuileUtilisateur(d, 'U1'); }, 'suppression de la tuile U1');
  assert.equal(r.ok, true);
  assert.equal(M.modeleParId(etat.doc(), 'U1'), null);
  assert.equal(etat.doc().plateau.tuiles.length, 0);
  assert.equal(etat.annuler(), true);
  assert.equal(JSON.stringify(etat.doc()), avant, 'un seul Ctrl+Z remet le modèle, les tuiles et la ville');
  assert.equal(etat.annuler(), false, 'pas d’autre entrée d’historique (le document de départ n’en avait aucune)');
  assert.equal(etat.retablir(), true);
  assert.equal(M.modeleParId(etat.doc(), 'U1'), null);
});

test('suppression d’une tuile du catalogue par etat.appliquer : refus signalé, document et historique intacts', function () {
  var etat = PM.etat.creer(C.nouveauDocument());
  var r = etat.appliquer(function (d) { return B.supprimerTuileUtilisateur(d, 'K2'); }, 'suppression');
  assert.equal(r.ok, false);
  assert.equal(etat.peutAnnuler(), false);
  assert.equal(etat.ui().message.niveau, 'erreur');
  assert.ok(M.modeleParId(etat.doc(), 'K2'));
});

test('vignettesBibliotheque : le champ utilisateur distingue les tuiles hors catalogue', function () {
  var d = M.ajouterModele(C.nouveauDocument(), copie('K2', 'U3'));
  var tous = [];
  B.vignettesBibliotheque(d, 'tous').forEach(function (g) { tous = tous.concat(g.modeles); });
  assert.equal(tous.length, C.modeles.length + 1);
  assert.deepEqual(tous.filter(function (v) { return v.utilisateur; }).map(function (v) { return v.id; }), ['U3']);
});

test('sans catalogue chargé, tout modèle est une tuile utilisateur (comportement documenté)', function () {
  var sauve = PM.catalogue;
  try {
    PM.catalogue = undefined;
    assert.equal(B.estTuileUtilisateur(C.nouveauDocument(), 'C1'), true);
  } finally { PM.catalogue = sauve; }
});

test('catalogue par grille : modelesParGrille prime sur modeles', function () {
  var sauve = PM.catalogue;
  try {
    PM.catalogue = { modeles: sauve.modeles, modelesParGrille: { '4x4': [{ id: 'C1' }] } };
    var d = C.nouveauDocument();
    assert.equal(B.estTuileUtilisateur(d, 'C1'), false);
    assert.equal(B.estTuileUtilisateur(d, 'C2'), true);
  } finally { PM.catalogue = sauve; }
});
