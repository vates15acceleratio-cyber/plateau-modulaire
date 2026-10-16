/*
 * catalogue.js : catalogue des tuiles du format 4×4 (orientation canonique, mm).
 * Aucun accès au DOM. Voir docs/3-synthese.md (catalogue, décompte des cases).
 *
 * Catalogue de la version 1, converti aux données de la version 2 en attendant le catalogue v2 (docs/18) :
 * chaque modèle déclare un gabarit (centrale | bord | coin ; les anciennes apparitions A1 et A2 sont des bords)
 * et sa grille ('4x4'). Il ne respecte pas les règles R1 à R4 (docs/19) : ses centrales et plusieurs bords portent
 * des alertes, deux villes voisines y sont à moins de 3 cases, et seules A1 et A2 ont une case d'apparition.
 * Le générateur ne trouve donc aucun plateau avec ce catalogue (aucune disposition de 7 villes à 3 cases d'écart).
 *
 * 18 modèles, 20 tuiles physiques :
 *  - 6 centrales C1..C6 (1 exemplaire), 4 cases, 4 ports ;
 *  - 5 coins K1..K5 (1 exemplaire), 3 cases, port SE, raccords E et S ;
 *  - 5 bords neutres B1..B5 (1 exemplaire), 3 cases, ports SE et SO ;
 *  - 2 bords à case d'apparition A1, A2 (2 exemplaires).
 *
 * Rappels de géométrie (docs/2-avis-geometrie.md) :
 *  - côtés 0 = N, 1 = E, 2 = S, 3 = O ; coins 0 = NO, 1 = NE, 2 = SE, 3 = SO ;
 *  - position de raccord 0 = début, 1 = milieu, 2 = fin, en lecture horaire
 *    (N d'ouest en est, E du nord au sud, S d'est en ouest, O du sud au nord) ;
 *  - un raccord (côté k, pos p) rencontre le raccord (k + 2, 2 - p) du voisin.
 *
 * Principes de conception (détaillés dans tests/catalogue.test.js) :
 *  - chaque côté intérieur porte la position milieu (pos 1), sauf le côté ouest
 *    de la centrale C6 (vide) : deux côtés face à face se raccordent presque toujours ;
 *  - aucune position début / fin : la seule variante de profil est le côté ouest
 *    vide de C6, un « mur » voulu qui crée un goulet (un raccord mort n'est admis
 *    que s'il a un sens de jeu, docs/9-validation-catalogue.md) ;
 *  - les cases à port sont sur la bissectrice de leur coin ; chaque case d'une
 *    centrale porte exactement un port (4 cases, 4 ports) ;
 *  - dans une apparition, les deux cases à port touchent la case d'apparition
 *    (2 pas jusqu'aux deux jonctions voisines, pour A1 comme pour A2) ;
 *  - tracés (segments droits, amorce perpendiculaire de 10 mm à chaque raccord) :
 *    à 16 mm au moins des autres cases, 24 mm des coins (sauf le port), sans
 *    contact entre chemins (contrôlé par tests/catalogue.test.js).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var DIAMETRE = 24;

  /* Petits constructeurs pour garder les modèles lisibles. */
  function kase(id, x, y, type) { return { id: id, x: x, y: y, diametre: DIAMETRE, type: type || 'deplacement' }; }
  function lien(id, a, b) { return { id: id, a: { 'case': a }, b: { 'case': b } }; }
  function port(id, c, coin) { return { id: id, a: { 'case': c }, b: { coin: coin } }; }
  function raccord(id, c, cote, pos) { return { id: id, a: { 'case': c }, b: { raccord: { cote: cote, pos: pos } } }; }
  function modele(id, nom, gabarit, exemplaires, cases, chemins) {
    return { id: id, nom: nom, gabarit: gabarit, grille: '4x4', exemplaires: exemplaires, cases: cases, chemins: chemins };
  }

  /*
   * Centrales : 4 cases sur les bissectrices, une par quart (c1 NO, c2 NE, c3 SE, c4 SO).
   * d = [dNO, dNE, dSE, dSO] : distance (mm) de chaque case à son coin, mesurée sur chaque axe
   * (32 à 44 mm), pour varier les silhouettes sans changer le routage.
   */
  function casesCentrale(d) {
    var C = PM.geometrie.format('4x4').COTE; // catalogue du format 4×4
    return [kase('c1', d[0], d[0]), kase('c2', C - d[1], d[1]), kase('c3', C - d[2], C - d[2]), kase('c4', d[3], C - d[3])];
  }
  function portsCentrale() {
    return [port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3)];
  }

  function construire() {
    return [
      /* ---------------- Centrales ---------------- */
      // anneau des 4 cases ; raccords en moulinet (chaque milieu sur la case de début du côté)
      modele('C1', 'Anneau', 'centrale', 1, casesCentrale([36, 36, 36, 36]), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4'), lien('h4', 'c4', 'c1')
      ].concat(portsCentrale(), [
        raccord('r1', 'c1', 0, 1), raccord('r2', 'c2', 1, 1), raccord('r3', 'c3', 2, 1), raccord('r4', 'c4', 3, 1)
      ])),
      // U ouvert à l'ouest ; le raccord ouest est sur la case NO, la case SO est un bout de bras
      modele('C2', 'Fer à cheval', 'centrale', 1, casesCentrale([32, 40, 40, 32]), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4')
      ].concat(portsCentrale(), [
        raccord('r1', 'c2', 0, 1), raccord('r2', 'c3', 1, 1), raccord('r3', 'c4', 2, 1),
        raccord('r4', 'c1', 3, 1)
      ])),
      // Z : bord nord, diagonale NE-SO, bord sud ; NO et SE à 3 pas
      modele('C3', 'Zigzag', 'centrale', 1, casesCentrale([36, 44, 36, 44]), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c4'), lien('h3', 'c4', 'c3')
      ].concat(portsCentrale(), [
        raccord('r1', 'c1', 0, 1), raccord('r2', 'c2', 1, 1), raccord('r3', 'c3', 2, 1), raccord('r4', 'c4', 3, 1)
      ])),
      // étoile autour de la case NO (diagonale vers SE) ; deux raccords sur la case SE
      modele('C4', 'Étoile', 'centrale', 1, casesCentrale([44, 34, 34, 34]), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c4'), lien('h3', 'c1', 'c3')
      ].concat(portsCentrale(), [
        raccord('r1', 'c2', 0, 1), raccord('r2', 'c3', 1, 1), raccord('r3', 'c3', 2, 1), raccord('r4', 'c4', 3, 1)
      ])),
      // patte : triangle NO-NE-SE et queue vers SO
      modele('C5', 'Patte', 'centrale', 1, casesCentrale([38, 38, 44, 32]), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c1', 'c3'), lien('h4', 'c3', 'c4')
      ].concat(portsCentrale(), [
        raccord('r1', 'c2', 0, 1), raccord('r2', 'c3', 1, 1), raccord('r3', 'c4', 2, 1),
        raccord('r4', 'c1', 3, 1)
      ])),
      // losange (anneau + diagonale NE-SO), très relié : côté ouest sans raccord
      modele('C6', 'Losange', 'centrale', 1, casesCentrale([32, 44, 32, 44]), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4'), lien('h4', 'c4', 'c1'), lien('h5', 'c2', 'c4')
      ].concat(portsCentrale(), [
        raccord('r1', 'c1', 0, 1), raccord('r2', 'c2', 1, 1), raccord('r3', 'c3', 2, 1)
      ])),

      /* ---------------- Coins (extérieurs N et O, port SE) ---------------- */
      // V autour de la case à port ; E-S en 2 pas par la case à port
      modele('K1', 'Coude', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 36, 88)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c3'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),
      // triangle : E-S en 1 pas sans passer par la case à port
      modele('K2', 'Raccourci', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 36, 88)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c3'), lien('h3', 'c2', 'c3'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),
      // crochet par l'angle extérieur ; le sud entre directement sur la case à port
      modele('K3', 'Détour', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 40, 40)], [
          lien('h1', 'c2', 'c3'), lien('h2', 'c3', 'c1'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c1', 2, 1)
        ]),
      // chemin E - S - port par la diagonale ; est -> sud en 1 pas, port en bout de chemin
      modele('K4', 'Diagonale', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 36, 88)], [
          lien('h1', 'c2', 'c3'), lien('h2', 'c3', 'c1'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),
      // symétrique de K3 : l'est entre directement sur la case à port
      modele('K5', 'Équerre', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 40, 40), kase('c3', 36, 88)], [
          lien('h1', 'c3', 'c2'), lien('h2', 'c2', 'c1'), port('p1', 'c1', 2),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),

      /* ---------------- Bords neutres (extérieur N, ports SE et SO) ---------------- */
      // V : la case haute descend vers la centrale ; est-ouest en 2 pas
      modele('B1', 'Bord en V', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 58)], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c3', 2, 1)
        ]),
      // barre basse entre les ports, case haute au NE vers l'est ; est-ouest en 1 pas
      modele('B2', 'Barre', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 88, 40)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c1', 2, 1)
        ]),
      // triangle ; la centrale entre par la case SO
      modele('B3', 'Triangle', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42)], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), lien('h3', 'c1', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c2', 2, 1)
        ]),
      // crochet : case haute vers l'est accrochée à la case SE ; est-ouest en 2 pas
      modele('B4', 'Crochet', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c3'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c2', 2, 1)
        ]),
      // barre basse + case haute au NO vers l'ouest (silhouette symétrique de B2)
      modele('B5', 'Pont', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 32, 40)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c3', 3, 1), raccord('r4', 'c1', 2, 1)
        ]),

      /* ---------------- Bords à case d'apparition (extérieur N, ports SE et SO) ---------------- */
      // fourche : l'apparition descend vers la centrale, sorties latérales par les cases à port
      modele('A1', 'Fourche', 'bord', 2,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 58, 'apparition')], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c3', 2, 1)
        ]),
      // arc : l'apparition porte les trois raccords (est, ouest, sud), cases à port en retrait
      modele('A2', 'Arc', 'bord', 2,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42, 'apparition')], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 1), raccord('r2', 'c3', 3, 1), raccord('r3', 'c3', 2, 1)
        ])
    ];
  }

  /** Gèle récursivement un objet (le catalogue partagé ne doit pas être modifié). */
  function geler(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { geler(o[k]); });
    }
    return o;
  }

  var MODELES = geler(construire());

  /** Document neuf du format 4×4 (PM.modele.nouveauDocument) contenant une copie modifiable des 18 modèles. */
  function nouveauDocument() {
    var doc = PM.modele.nouveauDocument('4x4');
    doc.modeles = JSON.parse(JSON.stringify(MODELES));
    return doc;
  }

  PM.catalogue = {
    version: 1,
    modeles: MODELES,                 // tableau gelé (lecture seule)
    nouveauDocument: nouveauDocument
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.catalogue;
})();
