/*
 * aides-v2.js : plateaux de test des règles v2, communs aux tests Node et aux pages de recette (Edge).
 * Aucune dépendance au catalogue (seulement PM.modele.copieExemples(grille), conformes à R1 à R4), sauf documentPrecedent.
 * Sous Node : require('./aides-v2.js') ; dans une page : <script src="../tests/aides-v2.js"></script>
 * après src/modele.js. Expose PM.aidesV2 (ce fichier n'est pas un fichier de test : il n'est pas lancé seul).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});
if (!PM.modele && typeof require === 'function') require('../src/modele.js');

(function () {
  'use strict';
  var M = PM.modele;
  var ID = { centrale: 'ex-centrale', bord: 'ex-bord', coin: 'ex-coin' };

  /** Villes équilibrées pour le plateau des exemples : 7 en 4×4 (S = 0) ; 8 en 5×5, aux positions par défaut (docs/18, 2026-10-19 ; S = 0). */
  var VILLES = {
    '4x4': [[1, 1], [2, 1], [3, 1], [2, 2], [1, 3], [2, 3], [3, 3]],
    '5x5': [[1, 1], [4, 1], [2, 2], [3, 2], [2, 3], [3, 3], [1, 4], [4, 4]]
  };

  /** Document vide du format avec les exemples (exemplaires de quoi remplir la grille). */
  function documentExemples(grille) {
    var doc = M.nouveauDocument(grille);
    doc.modeles = M.copieExemples(grille);
    return doc;
  }

  /**
   * Plateau plein des exemples, chaque tuile à sa place dans la rotation suggérée ; `villes` : liste de [i, j],
   * true pour les 7 villes équilibrées, absent pour aucune ville. `choix(col, lig, gabarit)` peut renvoyer un
   * autre identifiant de modèle (présent dans doc.modeles).
   */
  function plateauComplet(grille, villes, choix, modelesEnPlus) {
    var doc = documentExemples(grille), F = M.formatDuDocument(doc);
    if (modelesEnPlus) doc.modeles = doc.modeles.concat(modelesEnPlus);
    doc.modeles.forEach(function (m) { m.exemplaires = 99; });
    for (var lig = 0; lig < F.GRILLE.lignes; lig++) {
      for (var col = 0; col < F.GRILLE.colonnes; col++) {
        var g = M.gabaritCellule(col, lig, F), id = (choix && choix(col, lig, g)) || ID[g];
        doc = M.poserTuile(doc, id, col, lig);
      }
    }
    doc.modeles.forEach(function (m) { m.exemplaires = doc.plateau.tuiles.filter(function (t) { return t.modeleId === m.id; }).length; });
    (villes === true ? VILLES[F.id] : (villes || [])).forEach(function (v) { doc = M.poserJeton(doc, v[0], v[1]); });
    return doc;
  }

  /**
   * Plateau 4×4 complet, 7 villes équilibrées, dont les tuiles des cellules `cellules` ([col, lig]) n'ont pas
   * de case d'apparition (modèles « ex-bord-sans » et « ex-coin-sans »).
   */
  function plateauSansApparitions(cellules) {
    var ex = M.copieExemples();
    var bordSans = JSON.parse(JSON.stringify(ex[1])), coinSans = JSON.parse(JSON.stringify(ex[2]));
    bordSans.id = 'ex-bord-sans'; bordSans.nom = 'Bord sans apparition'; bordSans.cases[2].type = 'deplacement';
    coinSans.id = 'ex-coin-sans'; coinSans.nom = 'Coin sans apparition'; coinSans.cases[1].type = 'deplacement';
    return plateauComplet('4x4', true, function (col, lig, g) {
      var vise = cellules.some(function (c) { return c[0] === col && c[1] === lig; });
      return vise ? (g === 'coin' ? 'ex-coin-sans' : 'ex-bord-sans') : null;
    }, [bordSans, coinSans]);
  }

  /** Très déséquilibré (« 5 contre 2 », erreur) : le rouge ne part que de son coin SE. */
  function plateauDesequilibre() { return plateauSansApparitions([[0, 2], [3, 2], [1, 3], [2, 3], [0, 3]]); }

  /** Déséquilibre modéré (S = 5, alerte « à surveiller », pas d'erreur). */
  function plateauASurveiller() { return plateauSansApparitions([[0, 2], [3, 2], [1, 3], [2, 3]]); }

  /**
   * Document vide de la grille avec une copie du catalogue PRÉCÉDENT (version 3.04, PM.catalogue.precedent : 4×4 C1 à C6, B1, B3 à B6,
   * K2, K4 ; 5×5 C7, C8, B1, B7, B7m, K2) : un « ancien document », pour les tests d'interface écrits avec ces identifiants et ceux de
   * compatibilité. Demande PM.catalogue (chargé par l'appelant).
   */
  function documentPrecedent(grille) {
    var g = grille || '4x4', doc = M.nouveauDocument(g);
    doc.modeles = JSON.parse(JSON.stringify(PM.catalogue.precedent[g]));
    return doc;
  }

  PM.aidesV2 = {
    ID: ID, VILLES: VILLES, documentExemples: documentExemples, plateauComplet: plateauComplet, documentPrecedent: documentPrecedent,
    plateauSansApparitions: plateauSansApparitions, plateauDesequilibre: plateauDesequilibre, plateauASurveiller: plateauASurveiller
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = PM.aidesV2;
})();
