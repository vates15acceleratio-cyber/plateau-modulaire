/*
 * catalogue.js : catalogues des tuiles livrés pour les formats 4×4 et 5×5 (orientation canonique, mm). Aucun accès au DOM.
 *
 * Catalogues « organiques », révision « centrales ouvertes » (docs/45, réponses de l'utilisateur en fin de docs/18), branchés le
 * 2026-10-17 (docs/46) : centrales à virages sans case (passages, docs/39 et docs/40), servis par PM.catalogue.modelesParGrille :
 *  - 4×4 (tuiles de 120 mm, tests/catalogue.test.js) : 6 modèles, 24 exemplaires à imprimer (21 de poids de tirage, docs/47) :
 *      centrales Q1 « Trident à virage » (4 cases, 3 coins, 1 virage sans case ; ×4) et Q2 « Étoile à crochet » (5 cases, 4 coins,
 *      1 crochet ; ×3) ; bords B1 « Bord en V » (×8) et B8 « Bord à virage » (1 passage ; ×1) ; coins K2 (×4) et K4 (×1) ;
 *  - 5×5 (tuiles de 100 mm, tests/catalogue-5x5.test.js) : 8 modèles, 37 exemplaires (5 coins, 14 bords, 18 centrales ; 30 de poids de tirage, docs/47) :
 *      centrales U1 « Trident à virage » (4 cases, 3 coins ; ×5), P1 « Virage double » (×1), P2 « Équerre à virage » (×1),
 *      P3 « T sans case » (×2), P5 « Double virage » (2 passages ; ×2), toutes à 3 cases et 2 coins sauf U1 ; bords B1 (×6) et
 *      B7 « Bord simple » (×8, sans miroir : sert par rotation) ; coin K2 (×5).
 *      Avec 4 K2, 9 centrales et 12 bords : cases = 72 + nB1 + nU1 et ports = 34 + nB1 + nU1 (cases = ports + 38). Le générateur
 *      vise 78 à 81 cases (docs/18, réponse 1), donc 40 à 43 ports : 1 à 4 ports de plus que le minimum (39 = 16 × 2 + 7) pour
 *      7 villes à 3 accès, d'où plusieurs placements de villes admissibles. Il faut nB1 + nU1 = 6 à 9 ; B1 passe à 6 exemplaires
 *      (3 dans docs/45, qui visait 77 cases et n'avait qu'un placement admissible), B7 à 8.
 * Les nombres de modèle écrits ci-dessous (« ×4 », « ×5 »…) sont les POIDS de tirage (champ `poids`) ; le stock à imprimer (`exemplaires`)
 * vient de STOCK (B8 ×3 et K4 ×2 en 4×4 ; P3 ×4, P5 ×3, P1 ×3 et P2 ×3 en 5×5), pour que 90 % des plateaux générés se montent (docs/47).
 * Les catalogues précédents (version 3.04 : 4×4 C1 à C6, B1, B3 à B6, K2, K4 ; 5×5 C7, C8, B1, B7, B7m, K2) restent lisibles dans
 * PM.catalogue.precedent (gelé) : un document enregistré porte ses propres copies de modèles et s'ouvre sans changement ; ce champ
 * sert aux tests de compatibilité et de référence. Les ids communs aux deux révisions (B1, K2, K4 en 4×4 ; B1, B7, K2 en 5×5)
 * désignent des modèles identiques.
 *
 * Règles que tous les modèles livrés respectent (aucune erreur ni alerte de PM.modele.validerModele, aucun problème de tracé) :
 *  - R1 une case porte au plus un port de coin ; R2 deux cases porteuses ne sont jamais reliées directement ;
 *  - R3 aucun raccord latéral sur une case porteuse ; R4 la case d'apparition ne porte jamais de port ;
 *  - passages (docs/18) : une case porteuse ne touche jamais un passage ; pas de passage vers un coin, ni depuis une case
 *    d'apparition ; un passage au plus par bord ou coin ; pas de passage traversant (d'un côté au côté opposé) ; en 4×4, un
 *    passage au plus par centrale ; aucune paire miroir (chaque modèle sert par rotation) ;
 *  - aucune poche (case en impasse), aucun mur (les 4 côtés d'une centrale ont un raccord ou un passage au milieu).
 *  Conséquence : sur tout trajet ville - ville, case porteuse, case sans port, case porteuse : au moins 3 cases entre deux villes
 *  (4 pas), quelles que soient la pose et les villes ; les cases reliées par un passage ne comptent pas pour « porteuses reliées »
 *  (docs/39 § 3), garantie vérifiée par le contrôle global (PM.graphe.villesProches) dans les tests.
 *
 * Rappels de géométrie (docs/archives/2-avis-geometrie.md, docs/20) :
 *  - côtés 0 = N, 1 = E, 2 = S, 3 = O ; coins 0 = NO, 1 = NE, 2 = SE, 3 = SO ;
 *  - position de raccord 0 = début, 1 = milieu, 2 = fin, en lecture horaire
 *    (N d'ouest en est, E du nord au sud, S d'est en ouest, O du sud au nord) ;
 *  - un raccord (côté k, pos p) rencontre le raccord (k + 2, 2 - p) du voisin.
 * Positions de raccord : côté qui regarde une centrale (S d'un bord, côtés d'une centrale) : milieu (pos 1) seulement ; raccourci de
 * coin (D5) : bord canonique (extérieur N) E pos 0 + O pos 2, coin canonique (extérieurs N et O) E pos 0 + S pos 2, tirés de la case
 * d'apparition ; ils se rencontrent dans toutes les rotations.
 * Gabarits canoniques : une centrale a ses 4 coins en jonction ; un bord a son côté extérieur au nord et ses ports aux coins SE (2)
 * et SO (3) ; un coin a ses côtés extérieurs au nord et à l'ouest et son port au coin SE (2). Chaque bord et chaque coin porte une
 * case d'apparition (sans port), verte ou rouge selon le camp de sa cellule.
 * Tracés : chemins droits (amorce perpendiculaire de 10 mm aux raccords, de 28 mm sur la bissectrice aux ports), passages en courbe
 * (PM.geometrie.tracesPassages) ; contrôlés par tests/aides-trace.js.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var DIAMETRE = PM.geometrie.DIAMETRE_CASE; // Ø des cases du catalogue (docs/18, décision du 2026-10-16)

  /* Petits constructeurs pour garder les modèles lisibles. */
  function kase(id, x, y, type) { return { id: id, x: x, y: y, diametre: DIAMETRE, type: type || 'deplacement' }; }
  function lien(id, a, b) { return { id: id, a: { 'case': a }, b: { 'case': b } }; }
  function port(id, c, coin) { return { id: id, a: { 'case': c }, b: { coin: coin } }; }
  function raccord(id, c, cote, pos) { return { id: id, a: { 'case': c }, b: { raccord: { cote: cote, pos: pos } } }; }
  function appar(id, x, y) { return kase(id, x, y, 'apparition'); }
  function modeleGrille(grille, id, nom, gabarit, exemplaires, cases, chemins) {
    return { id: id, nom: nom, gabarit: gabarit, grille: grille, exemplaires: exemplaires, cases: cases, chemins: chemins };
  }
  function modele(id, nom, gabarit, exemplaires, cases, chemins) {
    return modeleGrille('4x4', id, nom, gabarit, exemplaires, cases, chemins);
  }
  /** Raccourci d'un bord (E pos 0 et O pos 2) tiré de la case d'apparition `c`. */
  function raccourciBord(c) { return [raccord('r1', c, 1, 0), raccord('r2', c, 3, 2)]; }
  /** Raccourci d'un coin (E pos 0 et S pos 2) tiré de la case d'apparition `c`. */
  function raccourciCoin(cE, cS) { return [raccord('r1', cE, 1, 0), raccord('r2', cS, 2, 2)]; }

  /* Passages sans case (docs/39) : extrémités case (C), raccord (R), pivot (V). */
  function C(id) { return { 'case': id }; }
  function R(cote, pos) { return { raccord: { cote: cote, pos: pos } }; }
  function V(id) { return { pivot: id }; }
  function passage(id, a, b, courbe) { var p = { id: id, a: a, b: b }; if (courbe) p.courbe = courbe; return p; }
  function pivot(id, x, y) { return { id: id, x: x, y: y }; }
  /** Modèle à passages : mêmes clés que modeleGrille, plus `pivots` et `passages` s'il y en a (un modèle sans passage n'a pas ces clés). */
  function modeleOrganique(grille, id, nom, gabarit, exemplaires, cases, chemins, pivots, passages) {
    var m = modeleGrille(grille, id, nom, gabarit, exemplaires, cases, chemins);
    if (pivots && pivots.length) m.pivots = pivots;
    if (passages && passages.length) { m.pivots = m.pivots || []; m.passages = passages; }
    return m;
  }

  /*
   * Catalogue 4×4 livré (révision « centrales ouvertes », docs/45) : coordonnées de outils/catalogue-organique.js.
   * Centrales à un seul relais qui dessert 3 ou 4 coins (chaque port à 1 pas du relais), un passage au plus.
   */
  function construire4() {
    function m4(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modeleOrganique('4x4', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    return [
      /* Centrales */
      // Trident à virage : quart de tour sans case au sud-ouest ; le relais tient N et E et les ports NO, NE et SE
      m4('Q1', 'Trident à virage', 'centrale', 4,
        [kase('r', 68, 54), kase('c1', 30, 30), kase('c2', 92, 28), kase('c3', 92, 92)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h1', 'r', 'c1'), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // Étoile à crochet : le relais tient les 4 ports, N, E et S ; le raccord O le rejoint par une courbe sans case
      m4('Q2', 'Étoile à crochet', 'centrale', 3,
        [kase('r', 68, 68), kase('c1', 28, 28), kase('c2', 92, 28), kase('c3', 92, 92), kase('c4', 28, 92)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), raccord('rs', 'r', 2, 1),
          lien('h1', 'r', 'c1'), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'), lien('h4', 'r', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3)
        ], [], [passage('q1', R(3, 1), C('r'), { x: 40, y: 62 })]),
      /* Bords (extérieur N, ports SE / SO, raccourci E pos 0 + O pos 2) */
      m4('B1', 'Bord en V', 'bord', 8,
        [appar('a', 60, 50), kase('c1', 94, 94), kase('c2', 26, 94)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // Bord à virage : un relais prend le raccord S par un virage sans case ; l'apparition tient le raccourci et le port SE
      m4('B8', 'Bord à virage', 'bord', 1,
        [appar('a', 60, 36), kase('r', 34, 66), kase('c1', 94, 92), kase('c2', 24, 98)], [
          lien('h1', 'a', 'r'), lien('h2', 'a', 'c1'), lien('h3', 'r', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a')), [], [passage('q1', C('r'), R(2, 1))]),
      /* Coins (extérieurs N et O, port SE, raccourci E pos 0 + S pos 2) */
      m4('K2', 'Coin à relais', 'coin', 4,
        [appar('a', 38, 38), kase('r', 63, 63), kase('c1', 88, 88)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a', 'a'))),
      m4('K4', 'Coin en losange', 'coin', 1,
        [appar('a', 40, 40), kase('s1', 82, 61), kase('s2', 61, 82), kase('c1', 92, 92)], [
          lien('h1', 'a', 's1'), lien('h2', 'a', 's2'), lien('h3', 's1', 'c1'), lien('h4', 's2', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a', 'a')))
    ];
  }

  /*
   * Catalogue 5×5 livré (révision « centrales ouvertes », docs/45 ; exemplaires revus pour 78 à 81 cases, docs/46) :
   * coordonnées de outils/catalogue-organique.js. Centrales à 3 cases (relais et deux porteuses) sauf U1 (4 cases, 3 coins).
   */
  function construire5() {
    function m5(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modeleOrganique('5x5', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    return [
      /* Centrales */
      // Trident à virage : quart de tour sans case au sud-ouest ; le relais tient N et E et les ports NO, NE et SE
      m5('U1', 'Trident à virage', 'centrale', 5,
        [kase('r', 58, 44), kase('c1', 26, 26), kase('c2', 74, 26), kase('c3', 74, 74)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h1', 'r', 'c1'), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // T sans case : les raccords O, N et E se rejoignent en T (pivot sans case) ; fourche au sud (pas un traversant, docs/18)
      m5('P3', 'T sans case', 'centrale', 2,
        [kase('s', 50, 70), kase('c4', 24, 76), kase('c3', 76, 76)], [
          raccord('rs', 's', 2, 1), lien('h4', 's', 'c4'), lien('h3', 's', 'c3'),
          port('p4', 'c4', 3), port('p3', 'c3', 2)
        ], [pivot('v', 50, 34)], [passage('t1', R(3, 1), V('v')), passage('t2', R(0, 1), V('v')), passage('t3', R(1, 1), V('v'))]),
      // Double virage : deux quarts de tour sans case (N-E et S-O), couloir diagonal de 3 cases entre les jonctions NO et SE
      m5('P5', 'Double virage', 'centrale', 2,
        [kase('c1', 26, 26), kase('r', 50, 50), kase('c3', 74, 74)], [
          lien('h1', 'c1', 'r'), lien('h3', 'r', 'c3'), port('p1', 'c1', 0), port('p3', 'c3', 2)
        ], [], [passage('q1', R(0, 1), R(1, 1), { x: 52, y: 48 }), passage('q2', R(2, 1), R(3, 1), { x: 48, y: 52 })]),
      // Virage double : quart de tour sans case au sud-ouest ; le relais prend N et E, ports NO et SE
      m5('P1', 'Virage double', 'centrale', 1,
        [kase('r', 60, 40), kase('c1', 26, 26), kase('c3', 74, 74)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h1', 'r', 'c1'), lien('h3', 'r', 'c3'),
          port('p1', 'c1', 0), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // Équerre à virage : même quart de tour ; le relais prend N et E, ports NE et SE (deux coins voisins)
      m5('P2', 'Équerre à virage', 'centrale', 1,
        [kase('r', 50, 40), kase('c2', 76, 24), kase('c3', 74, 74)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'),
          port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      /* Bords (extérieur N, raccourci E pos 0 + O pos 2, raccord S au milieu depuis l'apparition) */
      m5('B1', 'Bord en V', 'bord', 6,
        [appar('a', 50, 40), kase('c1', 82, 66), kase('c2', 18, 66)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // Bord simple : un seul port (SE), sans miroir : posé par rotation, il nourrit la jonction suivante dans le sens horaire
      m5('B7', 'Bord simple', 'bord', 8,
        [appar('a', 56, 38), kase('c1', 84, 64)], [
          lien('h1', 'a', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      /* Coin (extérieurs N et O, port SE, raccourci E pos 0 + S pos 2) */
      m5('K2', 'Coin à relais', 'coin', 5,
        [appar('a', 32, 32), kase('r', 53, 53), kase('c1', 74, 74)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a', 'a')))
    ];
  }

  /* ===================== Catalogues précédents (version 3.04), gardés en lecture seule : PM.catalogue.precedent ===================== */

  function construirePrecedent4() {
    return [
      /* ---------------- Centrales (4 raccords au milieu des côtés, 4 ports sauf C4 et C6) ---------------- */
      // étoile à 5 cases : relais au centre, 4 cases à port sur les bissectrices
      modele('C1', 'Étoile', 'centrale', 1,
        [kase('c0', 60, 60), kase('c1', 32, 32), kase('c2', 88, 32), kase('c3', 88, 88), kase('c4', 32, 88)], [
          lien('h1', 'c0', 'c1'), lien('h2', 'c0', 'c2'), lien('h3', 'c0', 'c3'), lien('h4', 'c0', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3),
          raccord('r1', 'c0', 0, 1), raccord('r2', 'c0', 1, 1), raccord('r3', 'c0', 2, 1), raccord('r4', 'c0', 3, 1)
        ]),
      // zigzag : deux relais reliés, chacun tient deux ports et deux raccords (3 pas d'un coin au coin opposé)
      modele('C2', 'Zigzag', 'centrale', 1,
        [kase('c1', 24, 24), kase('c2', 96, 24), kase('c3', 96, 96), kase('c4', 24, 96), kase('n', 70, 46), kase('s', 50, 74)], [
          lien('h1', 'n', 'c1'), lien('h2', 'n', 'c2'), lien('h3', 's', 'c3'), lien('h4', 's', 'c4'), lien('h5', 'n', 's'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3),
          raccord('r1', 'n', 0, 1), raccord('r2', 'n', 1, 1), raccord('r3', 's', 2, 1), raccord('r4', 's', 3, 1)
        ]),
      // deux réseaux séparés sur la même tuile (liberté de l'éditeur) : relais nord (ports N, raccords N et E)
      // et relais sud (ports S, raccords S et O), sans lien entre eux
      modele('C3', 'Deux ponts', 'centrale', 1,
        [kase('c1', 28, 28), kase('c2', 92, 28), kase('c3', 92, 92), kase('c4', 28, 92), kase('n', 60, 36), kase('s', 60, 84)], [
          lien('h1', 'n', 'c1'), lien('h2', 'n', 'c2'), lien('h3', 's', 'c3'), lien('h4', 's', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3),
          raccord('r1', 'n', 0, 1), raccord('r2', 'n', 1, 1), raccord('r3', 's', 2, 1), raccord('r4', 's', 3, 1)
        ]),
      // trois ports seulement (pas de port au coin SE) : étoile à 4 cases
      modele('C4', 'Trident', 'centrale', 2,
        [kase('c0', 60, 60), kase('c1', 32, 32), kase('c2', 88, 32), kase('c4', 32, 88)], [
          lien('h1', 'c0', 'c1'), lien('h2', 'c0', 'c2'), lien('h4', 'c0', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p4', 'c4', 3),
          raccord('r1', 'c0', 0, 1), raccord('r2', 'c0', 1, 1), raccord('r3', 'c0', 2, 1), raccord('r4', 'c0', 3, 1)
        ]),
      // étoile fermée : même étoile à 5 cases, côté ouest sans raccord (un « mur » voulu : goulet, raccord mort chez la voisine)
      modele('C5', 'Étoile fermée', 'centrale', 1,
        [kase('c0', 60, 60), kase('c1', 32, 32), kase('c2', 88, 32), kase('c3', 88, 88), kase('c4', 32, 88)], [
          lien('h1', 'c0', 'c1'), lien('h2', 'c0', 'c2'), lien('h3', 'c0', 'c3'), lien('h4', 'c0', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3),
          raccord('r1', 'c0', 0, 1), raccord('r2', 'c0', 1, 1), raccord('r3', 'c0', 2, 1)
        ]),
      // chaîne à trois ports (pas de port au coin SE) : relais nord (N, E), relais sud (S, O) et port SO au bout
      modele('C6', 'Chaîne', 'centrale', 1,
        [kase('c1', 28, 28), kase('c2', 94, 26), kase('c4', 26, 96), kase('n', 62, 42), kase('s', 54, 76)], [
          lien('h1', 'n', 'c1'), lien('h2', 'n', 'c2'), lien('h3', 'n', 's'), lien('h4', 's', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p4', 'c4', 3),
          raccord('r1', 'n', 0, 1), raccord('r2', 'n', 1, 1), raccord('r3', 's', 2, 1), raccord('r4', 's', 3, 1)
        ]),

      /* ---------------- Bords (extérieur N, ports SE et SO, raccourci E pos 0 + O pos 2) ---------------- */
      // V : l'apparition tient les deux ports et tous les raccords
      modele('B1', 'Bord en V', 'bord', 6,
        [appar('a', 60, 50), kase('c1', 94, 94), kase('c2', 26, 94)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // Y : un relais entre l'apparition et les deux ports, le raccord central part du relais
      modele('B3', 'Bord en Y', 'bord', 1,
        [appar('a', 60, 34), kase('r', 60, 72), kase('c1', 90, 92), kase('c2', 30, 92)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), lien('h3', 'r', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'r', 2, 1)])),
      // losange : l'apparition et un relais touchent chacun les deux cases à port (deux routes de même longueur),
      // le raccord central part du relais, qui a donc deux chemins (ni impasse ni poche)
      modele('B4', 'Bord en losange', 'bord', 1,
        [appar('a', 60, 36), kase('r', 60, 80), kase('c1', 98, 94), kase('c2', 22, 94)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), lien('h3', 'r', 'c1'), lien('h4', 'r', 'c2'),
          port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'r', 2, 1)])),
      // décalé : port est à 1 pas de l'apparition, port ouest à 2 pas (par un relais)
      modele('B5', 'Bord décalé', 'bord', 1,
        [appar('a', 66, 38), kase('r', 38, 62), kase('c1', 96, 90), kase('c2', 28, 96)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'r'), lien('h3', 'r', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // triangle : l'apparition, le relais et le port est forment une boucle ; le port ouest passe par le relais
      modele('B6', 'Bord en triangle', 'bord', 1,
        [appar('a', 60, 36), kase('r', 56, 78), kase('c1', 94, 90), kase('c2', 26, 98)], [
          lien('h1', 'a', 'r'), lien('h2', 'a', 'c1'), lien('h3', 'r', 'c1'), lien('h4', 'r', 'c2'),
          port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'r', 2, 1)])),

      /* ---------------- Coins (extérieurs N et O, port SE, raccourci E pos 0 + S pos 2) ---------------- */
      // relais : un relais entre l'apparition et la case à port (2 cases avant la jonction, 3 pas)
      modele('K2', 'Coin à relais', 'coin', 4,
        [appar('a', 38, 38), kase('r', 63, 63), kase('c1', 88, 88)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a', 'a'))),
      // losange : deux relais symétriques entre l'apparition et la case à port, deux routes de même longueur
      // (toujours 2 cases avant la jonction, 3 pas)
      modele('K4', 'Coin en losange', 'coin', 1,
        [appar('a', 40, 40), kase('s1', 82, 61), kase('s2', 61, 82), kase('c1', 92, 92)], [
          lien('h1', 'a', 's1'), lien('h2', 'a', 's2'), lien('h3', 's1', 'c1'), lien('h4', 's2', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a', 'a')))
    ];
  }

  /*
   * Catalogue 5×5 PRÉCÉDENT (version 3.04 ; tuiles de 100 mm, positions de raccord 30 / 50 / 70, cases Ø 20), répartition B′ : 30 tuiles. « 78 cases, 40 ports »
   * est la pose de référence avec 6 B1 et 9 jonctions-cases. Le nombre de B1 posés (nB1) change le décompte : avec 4 K2 et 9 centrales
   * à 3 cases, cases = 72 + nB1 et ports = 34 + nB1 ; la garantie de 39 ports au moins impose nB1 >= 5 et les 6 B1 imprimés nB1 <= 6 :
   * le générateur 5×5 devra imposer 5 ou 6 B1. Coordonnées de docs/29 (marge de tracé >= 2,7 mm).
   *  - 1 coin K2 (5 exemplaires) ; K4 est écarté (trop serré dans 100 mm) ;
   *  - 3 bords B1 « en V » (6), B7 « simple » (4, port SE) et son miroir B7m (4, port SO) : le carton ne se retourne pas ;
   *  - 2 centrales à 3 cases C7 « Pont » (6) et C8 « Équerre » (5) : le relais central tient les 4 raccords au milieu.
   * Mêmes règles qu'en 4×4 (R1 à R4, aucune poche) ; pas de mur (C5) ; sur les bords et les coins, aucun raccord hors du raccourci
   * (bord : E pos 0 + O pos 2 ; coin : E pos 0 + S pos 2) et, pour un bord, du raccord S au milieu tiré de la case d'apparition.
   * Les ids communs avec le 4×4 sont K2 et B1 seulement (C7, C8, B7 et B7m n'existent qu'en 5×5) : le champ `grille` et le document les distinguent.
   */
  function construirePrecedent5() {
    function m5(id, nom, gabarit, exemplaires, cases, chemins) { return modeleGrille('5x5', id, nom, gabarit, exemplaires, cases, chemins); }
    var racCentre = [raccord('r1', 'c0', 0, 1), raccord('r2', 'c0', 1, 1), raccord('r3', 'c0', 2, 1), raccord('r4', 'c0', 3, 1)];
    return [
      /* Centrales : relais au centre (50, 50), 4 raccords au milieu des côtés, 2 ports sur les bissectrices */
      // pont : ports NO et SE
      m5('C7', 'Pont', 'centrale', 6,
        [kase('c0', 50, 50), kase('c1', 28, 28), kase('c3', 72, 72)], [
          lien('h1', 'c0', 'c1'), lien('h3', 'c0', 'c3'), port('p1', 'c1', 0), port('p3', 'c3', 2)
        ].concat(racCentre)),
      // équerre : ports NO et NE
      m5('C8', 'Équerre', 'centrale', 5,
        [kase('c0', 50, 50), kase('c1', 28, 28), kase('c2', 72, 28)], [
          lien('h1', 'c0', 'c1'), lien('h2', 'c0', 'c2'), port('p1', 'c1', 0), port('p2', 'c2', 1)
        ].concat(racCentre)),

      /* Bords (extérieur N, ports SE et / ou SO, raccourci E pos 0 + O pos 2, raccord S au milieu depuis l'apparition) */
      // V : l'apparition tient les deux ports, un port par jonction voisine
      m5('B1', 'Bord en V', 'bord', 6,
        [appar('a', 50, 40), kase('c1', 82, 66), kase('c2', 18, 66)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // simple : un seul port, SE
      m5('B7', 'Bord simple', 'bord', 4,
        [appar('a', 56, 38), kase('c1', 84, 64)], [
          lien('h1', 'a', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // miroir de B7 (x -> 100 - x) : port SO
      m5('B7m', 'Bord simple miroir', 'bord', 4,
        [appar('a', 44, 38), kase('c1', 16, 64)], [
          lien('h1', 'a', 'c1'), port('p1', 'c1', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),

      /* Coin (extérieurs N et O, port SE, raccourci E pos 0 + S pos 2) */
      m5('K2', 'Coin à relais', 'coin', 5,
        [appar('a', 32, 32), kase('r', 53, 53), kase('c1', 74, 74)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a', 'a')))
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

  /*
   * Stock à imprimer (exemplaires) distinct du poids de tirage du générateur (champ `poids`, PM.modele.poidsTirage) : les nombres écrits
   * dans construire4() et construire5() sont les POIDS (ceux de docs/46, qui règlent la fréquence des modèles et la composition des
   * plateaux : mesures d'équilibre inchangées) ; les exemplaires sont ceux de ce tableau, relevés pour qu'au moins 90 % des plateaux
   * générés se montent avec la boîte imprimée (docs/47). Le stock ne limite jamais la pose.
   */
  var STOCK = { '4x4': { Q1: 4, Q2: 3, B1: 8, B8: 3, K2: 4, K4: 2 }, '5x5': { U1: 5, P3: 4, P5: 3, P1: 3, P2: 3, B1: 6, B7: 8, K2: 5 } };
  function avecStock(liste, stock) {
    liste.forEach(function (m) {
      m.poids = m.exemplaires;
      if (Object.prototype.hasOwnProperty.call(stock, m.id)) m.exemplaires = stock[m.id];
    });
    return liste;
  }

  var MODELES = geler(avecStock(construire4(), STOCK['4x4']));
  var MODELES_5X5 = geler(avecStock(construire5(), STOCK['5x5']));
  var PAR_GRILLE = geler({ '4x4': MODELES, '5x5': MODELES_5X5 });
  var PRECEDENT = geler({ '4x4': construirePrecedent4(), '5x5': construirePrecedent5() });

  /**
   * Document neuf de la grille demandée ('4x4' par défaut) contenant une copie modifiable de ses modèles
   * (6 en 4×4, 8 en 5×5). Lève une Error pour une grille inconnue.
   */
  function nouveauDocument(grille) {
    var g = grille === undefined || grille === null ? '4x4' : grille;
    if (typeof g !== 'string' || !Object.prototype.hasOwnProperty.call(PAR_GRILLE, g)) throw new Error('Grille inconnue : ' + String(grille) + '.');
    var doc = PM.modele.nouveauDocument(g);
    doc.modeles = JSON.parse(JSON.stringify(PAR_GRILLE[g]));
    return doc;
  }

  PM.catalogue = {
    version: 3,                       // 3 : catalogues « organiques » (docs/45, docs/46) ; 2 : catalogues de la version 3.04 (precedent)
    modeles: MODELES,                 // tableau gelé (lecture seule) : catalogue 4×4, gardé pour la compatibilité
    modelesParGrille: PAR_GRILLE,     // { '4x4': [...], '5x5': [...] } gelé
    precedent: PRECEDENT,             // { '4x4': [...], '5x5': [...] } gelé : catalogues de la version 3.04 (compatibilité, tests)
    nouveauDocument: nouveauDocument
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.catalogue;
})();
