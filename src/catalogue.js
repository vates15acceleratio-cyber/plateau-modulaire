/*
 * catalogue.js : catalogues des tuiles livrés pour les formats 4×4 et 5×5 (orientation canonique, mm). Aucun accès au DOM.
 *
 * Catalogues « organiques », révision « centrales ouvertes » (docs/45, réponses de l'utilisateur en fin de docs/18), branchés le
 * 2026-10-17 (docs/46) : centrales à virages sans case (passages, docs/39 et docs/40), servis par PM.catalogue.modelesParGrille :
 *  - 4×4 (tuiles de 120 mm, tests/catalogue.test.js) : 6 modèles, 24 exemplaires à imprimer (21 de poids de tirage, docs/47) :
 *      centrales Q1 « Trident à virage » (4 cases, 3 coins, 1 virage sans case ; ×4) et Q2 « Étoile à crochet » (5 cases, 4 coins,
 *      1 crochet ; ×3) ; bords B1 « Bord en V » (×8) et B8 « Bord à virage » (1 passage ; ×1) ; coins K2 (×4) et K4 (×1) ;
 *  - 5×5 (tuiles de 100 mm, tests/catalogue-5x5.test.js) : catalogue « très connecté » de docs/55 (décisions de docs/18, « 5×5 très
 *      connecté ») complété par les centrales de docs/58 et les « ponts » de docs/66 (catalogue « P », décisions de docs/18 du
 *      2026-10-19 : 8 villes à positions fixes) : 2 cases par tuile au plus, ≈ 57 cases par plateau : 11 modèles, 31 exemplaires dont
 *      14 centrales tirables pour 9 places (poids = exemplaires), plus LE1 hors tirage : centrales LC1 « Pont et relais » (×1), LC3 « Pont et fourche » (T sans case ;
 *      ×4), LC4 « Deux ponts » (deux porteuses latérales opposées, murs E et O déclarés par `murs: [1, 3]` : 2 raccords morts par pose,
 *      en information ; ×1), LC5 « Pont et carrefour » (une case, T sans case ; ×1), LC6 « Pont et fourche libres » (×1), LC7 « Pont et
 *      relais libres » (×1), LC11 « Coins opposés » (deux porteuses à 1 port en diagonale ; ×2), LC12 « Deux ponts ouverts » (deux
 *      porteuses latérales opposées, 4 raccords ; ×3) ; LE1 « Étoile » (relais central, 4 raccords, 4 cases de diagonale à 1 port chacune :
 *      5 cases, EXCEPTION NOMMÉE à « 2 cases par tuile » ; 1 exemplaire, `horsTirage: true` : pose à la main, jamais tirée) ; bord LB2 « Bord à pont » (×12) ; coin LK2 « Coin à porteuse » (×4). LC2 « Pont
 *      et relais décalé » du jeu « B3 » est retiré.
 * Les nombres de modèle écrits ci-dessous (« ×4 », « ×5 »…) sont les POIDS de tirage (champ `poids`) ; le stock à imprimer (`exemplaires`)
 * vient de STOCK (B8 ×3 et K4 ×2 en 4×4 ; en 5×5 il vaut les poids, le générateur tirant 9 des 14 centrales par quotas), pour que 90 % au
 * moins des plateaux générés se montent (docs/47 ; 100 % en 5×5).

 * Hexagonal 'hex19' (docs/72, docs/75, tests/catalogue-hex.test.js) : 4 modèles, 30 pièces imprimées (19 + 11 de réserve) : intérieures HC2 « Deux ponts et
 * traverse » (×8, poids 6) et HC3 « Carrefour » (×7, poids 5), bord HB1 (×8), coin HK1 (×7), sans mur ni raccord mort.
 *
 * Les catalogues précédents restent lisibles, gelés : PM.catalogue.precedent (version 3.04 : 4×4 C1 à C6, B1, B3 à B6, K2, K4 ; 5×5 C7,
 * C8, B1, B7, B7m, K2) et PM.catalogue.precedents (toutes les versions par grille ; en 5×5 aussi le catalogue organique de la 4.00.0 :
 * U1, P1, P2, P3, P5, B1, B7, K2). Un document enregistré porte ses propres copies de modèles et s'ouvre sans changement ; ces champs
 * servent à proposer le nouveau catalogue (PM.sauvegarde.bibliothequeCataloguePrecedent) et aux tests. Les ids communs à plusieurs
 * révisions (B1, K2, K4 en 4×4 ; B1, B7, K2 entre 3.04 et 4.00.0 en 5×5) désignent des modèles identiques ; les ids du 5×5 courant
 * (préfixe L, « latérale », ceux de docs/55) n'existent dans aucun catalogue précédent.
 *
 * Règles que tous les modèles livrés respectent (aucune erreur ni alerte de PM.modele.validerModele, aucun problème de tracé) :
 *  - R1 une case porte au plus un port de coin ; R2 deux cases porteuses ne sont jamais reliées directement ;
 *  - R3 aucun raccord latéral sur une case porteuse ; R4 la case d'apparition ne porte jamais de port ;
 *  - 5×5 seulement (règles propres au format, PM.modele) : R1 et R3 levées pour la PORTEUSE LATÉRALE (2 ports sur les coins k et
 *    k + 1, raccord au milieu du côté k ; sur une centrale, plus le milieu d'un côté voisin) et pour la porteuse d'un coin (1 port,
 *    paire basse le long de ce coin) ; R3 assouplie sur les centrales (une porteuse à 1 port sur le coin k porte les milieux des deux
 *    côtés qui encadrent ce coin, docs/66 § 2) ; R2 et R4
 *    gardées ; murs permis sur « Deux ponts » ; l'écart de 3 cases entre villes n'est plus garanti par les tuiles mais par le placement
 *    des villes (générateur, aide « placer les villes », alerte villes_proches) ; ce qui suit vaut pour le 4×4 ;
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
   * Catalogue 5×5 livré (version 5 du catalogue, docs/53 et docs/55, décisions de docs/18 « 5×5 très connecté ») : voie « porteuse
   * latérale + relais », 2 cases par tuile au plus, ≈ 57 cases par plateau (50 cases de tuiles, 49 quand LC5 est posé, + 8 campements ; 8 villes) ; LC5 à LC7 de docs/58,
   * LC11 et LC12 de docs/66 (marges de tracé 11,8 et 4,97 mm). Coordonnées validées par l'advisor géométrie (docs/55, marges de 3,79 à 10,04 mm). Ids de docs/55 (préfixe L, « latérale ») : aucun n'existe dans les
   * catalogues précédents. Une PORTEUSE LATÉRALE (règle propre au 5×5, PM.modele) dessert les deux coins d'un même côté et porte le
   * raccord du milieu de ce côté ; la porteuse du coin (1 port) porte la paire basse (E2 / S0).
   */
  function construire5() {
    function m5(id, nom, gabarit, ex, cases, chemins, pivots, passages, murs, horsTirage) {
      var m = modeleOrganique('5x5', id, nom, gabarit, ex, cases, chemins, pivots, passages);
      if (murs) m.murs = murs; // murs voulus déclarés (PM.modele.mursDuModele)
      if (horsTirage) m.horsTirage = true; // pose à la main seulement : jamais tirée par le générateur (PM.generateur.modelesParGabarit)
      return m;
    }
    /** Porteuse latérale nord `c` : ports NO et NE, raccord N au milieu. */
    function pont(c) { return [port('p1', c, 0), port('p2', c, 1), raccord('rn', c, 0, 1)]; }
    return [
      /* Centrales (porteuse latérale nord + relais, ou deux porteuses) */
      // Pont et relais : le relais tient E, S et O au milieu, un lien vers la porteuse
      m5('LC1', 'Pont et relais', 'centrale', 1,
        [kase('p', 50, 25), kase('r', 50, 58)],
        pont('p').concat([lien('h1', 'p', 'r'), raccord('re', 'r', 1, 1), raccord('rs', 'r', 2, 1), raccord('ro', 'r', 3, 1)])),
      // Pont et fourche : le relais tient E ; un T sans case (pivot hors du relais) le relie à S et à O (motif organique)
      m5('LC3', 'Pont et fourche', 'centrale', 4,
        [kase('p', 50, 25), kase('r', 62, 60)],
        pont('p').concat([lien('h1', 'p', 'r'), raccord('re', 'r', 1, 1)]),
        [pivot('v', 31, 76)], [passage('t1', R(2, 1), V('v')), passage('t2', R(3, 1), V('v')), passage('t3', C('r'), V('v'))]),
      // Deux ponts : porteuses latérales nord (NO, NE, N) et sud (SE, SO, S), non reliées ; côtés E et O sans raccord (murs voulus)
      m5('LC4', 'Deux ponts', 'centrale', 1,
        [kase('p', 50, 25), kase('q', 50, 75)],
        pont('p').concat([port('p3', 'q', 2), port('p4', 'q', 3), raccord('rs', 'q', 2, 1)]), [], [], [1, 3]),
      // Pont et carrefour (docs/58) : UNE case (la porteuse nord) ; E, S et O se rejoignent par un T sans case (les trois voisines se touchent)
      m5('LC5', 'Pont et carrefour', 'centrale', 1,
        [kase('p', 50, 25)], pont('p'),
        [pivot('v', 50, 66)], [passage('t1', R(1, 1), V('v')), passage('t2', R(2, 1), V('v')), passage('t3', R(3, 1), V('v'))]),
      // Pont et fourche libres : comme « Pont et fourche », mais la porteuse et le relais ne sont pas reliés
      m5('LC6', 'Pont et fourche libres', 'centrale', 1,
        [kase('p', 50, 25), kase('r', 66, 62)], pont('p').concat([raccord('re', 'r', 1, 1)]),
        [pivot('v', 31, 76)], [passage('t1', R(2, 1), V('v')), passage('t2', R(3, 1), V('v')), passage('t3', C('r'), V('v'))]),
      // Pont et relais libres : comme « Pont et relais », sans le lien entre la porteuse et le relais
      m5('LC7', 'Pont et relais libres', 'centrale', 1,
        [kase('p', 50, 25), kase('r', 50, 64)], pont('p').concat([raccord('re', 'r', 1, 1), raccord('rs', 'r', 2, 1), raccord('ro', 'r', 3, 1)])),
      // Coins opposés (docs/66) : deux porteuses à 1 port (NO et SE), non reliées ; chacune porte les milieux des deux côtés qui encadrent
      // son coin (R3 assouplie des centrales 5×5) : a tient N et O, b tient E et S
      m5('LC11', 'Coins opposés', 'centrale', 2,
        [kase('a', 30, 30), kase('b', 70, 70)],
        [port('p1', 'a', 0), raccord('rn', 'a', 0, 1), raccord('ro', 'a', 3, 1), port('p2', 'b', 2), raccord('re', 'b', 1, 1), raccord('rs', 'b', 2, 1)]),
      // Deux ponts ouverts (docs/66) : porteuse latérale ouest p (NO, SO) avec O et N ; porteuse latérale est q (NE, SE) avec E et S ; non reliées
      m5('LC12', 'Deux ponts ouverts', 'centrale', 3,
        [kase('p', 33, 44), kase('q', 67, 56)],
        [port('p1', 'p', 0), port('p2', 'p', 3), raccord('ro', 'p', 3, 1), raccord('rn', 'p', 0, 1),
          port('p3', 'q', 1), port('p4', 'q', 2), raccord('re', 'q', 1, 1), raccord('rs', 'q', 2, 1)]),
      // Étoile (croquis de l'utilisateur, docs/18 fin ; EXCEPTION NOMMÉE à « 2 cases par tuile au plus » : 5 cases) : un relais au centre
      // tient les 4 raccords au milieu des côtés et les 4 cases des diagonales, chacune avec le port de SON coin (1 port par case).
      // Un exemplaire, pose à la main seulement (horsTirage : le générateur ne la tire jamais).
      m5('LE1', 'Étoile', 'centrale', 1,
        [kase('r', 50, 50), kase('c1', 30, 30), kase('c2', 70, 30), kase('c3', 70, 70), kase('c4', 30, 70)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), raccord('rs', 'r', 2, 1), raccord('ro', 'r', 3, 1),
          lien('h1', 'r', 'c1'), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'), lien('h4', 'r', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3)
        ], [], [], null, true),
      /* Bord (extérieur N) : apparition à raccourci E0 / O2 et paire basse E2 / O0 ; porteuse latérale sud (SE, SO, S au milieu) */
      m5('LB2', 'Bord à pont', 'bord', 12,
        [appar('a', 50, 48), kase('c', 50, 81)], [
          raccord('r1', 'a', 1, 0), raccord('r2', 'a', 3, 2), raccord('r3', 'a', 1, 2), raccord('r4', 'a', 3, 0), lien('h1', 'a', 'c'),
          port('p1', 'c', 2), port('p2', 'c', 3), raccord('r5', 'c', 2, 1)
        ]),
      /* Coin (extérieurs N et O) : apparition à raccourci E0 / S2 ; porteuse du coin SE avec la paire basse E2 / S0 */
      m5('LK2', 'Coin à porteuse', 'coin', 4,
        [appar('a', 39, 42), kase('c', 75, 75)], [
          raccord('r1', 'a', 1, 0), raccord('r2', 'a', 2, 2), lien('h1', 'a', 'c'),
          port('p1', 'c', 2), raccord('r3', 'c', 1, 2), raccord('r4', 'c', 2, 0)
        ])
    ];
  }


  /*
   * Catalogue hexagonal 'hex19' (docs/72 : intérieures HC2 et HC3 sans HC1 ; docs/75 : coordonnées du catalogue candidat, repère local centré,
   * x vers l'est, y vers le sud, tuile pointe en haut de côté 54 mm). Côtés 0 = NE, 1 = E, 2 = SE, 3 = SO, 4 = O, 5 = NO ; coins 0 = N, 1 = NE,
   * 2 = SE, 3 = S, 4 = SO, 5 = NO ; un seul raccord par côté (pos 0, au milieu). Orientation canonique : bord à côtés extérieurs [5, 0],
   * coin à côtés extérieurs [0, 1, 2]. Règles propres à l'hexagonal (PM.modele) : jusqu'à 3 ports par case sur des coins consécutifs (H1),
   * tous les coins intérieurs portés (H2), passages traversants et touchant une porteuse permis, pivot à 4 branches. Aucun mur, aucun
   * raccord mort, aucune paire miroir. Les passages à courbe imposée reprennent les points de contrôle du script du candidat.
   */
  function construireHex() {
    function rh(cote) { return R(cote, 0); }
    function mh(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modeleOrganique('hex19', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    function portsA() { return [port('p5', 'a', 5), port('p0', 'a', 0), port('p1', 'a', 1), raccord('r5', 'a', 5, 0), raccord('r0', 'a', 0, 0)]; }
    function portsB() { return [port('p2', 'b', 2), port('p3', 'b', 3), port('p4', 'b', 4), raccord('r2', 'b', 2, 0), raccord('r3', 'b', 3, 0)]; }
    function casesAB() { return [kase('a', 0, -20.7), kase('b', 0, 20.7)]; }
    return [
      /* Intérieures (centre et couronne) : deux demi-tuiles 3 + 3 non reliées (a : coins 5, 0, 1 ; b : coins 2, 3, 4) */
      // Deux ponts et traverse : un passage sans case relie les côtés E et O entre les deux demi-tuiles (contrôle (0, 4) au lieu de (0, 6) du candidat : à (0, 6) le trait frôlait la case b à 17,7 mm au lieu de 18 mm, r + 4 + demi-largeur)
      mh('HC2', 'Deux ponts et traverse', 'centrale', 6, casesAB(), portsA().concat(portsB()), [],
        [passage('t1', rh(1), rh(4), { x: 0, y: 4 })]),
      // Carrefour : un T sans case au centre relie E, O, a et b (pivot à 4 branches)
      mh('HC3', 'Carrefour', 'centrale', 5, casesAB(), portsA().concat(portsB()), [pivot('v', 0, 0)],
        [passage('t1', rh(1), V('v'), { x: 20, y: -4 }), passage('t2', rh(4), V('v'), { x: -20, y: 4 }),
          passage('t3', C('a'), V('v'), { x: 3, y: -10 }), passage('t4', C('b'), V('v'), { x: -3, y: 10 })]),
      /* Bord (extérieurs 5 et 0) : apparition à l'anneau E–O, porteuse à 3 ports (coins 2, 3, 4) */
      mh('HB1', 'Bord', 'bord', 6, [appar('a', 0, -30), kase('p', 0, 20.7)], [
        raccord('r1', 'a', 1, 0), raccord('r4', 'a', 4, 0), lien('h1', 'a', 'p'),
        port('p2', 'p', 2), port('p3', 'p', 3), port('p4', 'p', 4), raccord('r2', 'p', 2, 0), raccord('r3', 'p', 3, 0)
      ]),
      /* Coin (extérieurs 0, 1, 2) : apparition à l'anneau NO–SO, porteuse à 2 ports (coins 4 et 5) */
      mh('HK1', 'Coin', 'coin', 6, [appar('a', 10, 0), kase('p', -22, 0)], [
        raccord('r3', 'a', 3, 0), raccord('r5', 'a', 5, 0), lien('h1', 'a', 'p'),
        port('p4', 'p', 4), port('p5', 'p', 5), raccord('r4', 'p', 4, 0)
      ])
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

  /*
   * Catalogue 5×5 PRÉCÉDENT de la version 4.00.0 (révision « centrales ouvertes », docs/45 ; exemplaires revus pour 78 à 81 cases,
   * docs/46 ; stock de docs/47) : coordonnées de outils/catalogue-organique.js. Centrales à 3 cases (relais et deux porteuses) sauf
   * U1 (4 cases, 3 coins). Gardé en lecture seule (PM.catalogue.precedents['5x5']) : reconnaissance des documents 4.00.0, tests.
   */
  function construirePrecedent5Organique() {
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
  var STOCK = { '4x4': { Q1: 4, Q2: 3, B1: 8, B8: 3, K2: 4, K4: 2 }, '5x5': { LC1: 1, LC3: 4, LC4: 1, LC5: 1, LC6: 1, LC7: 1, LC11: 2, LC12: 3, LE1: 1, LB2: 12, LK2: 4 },
    // hex19 (docs/72, docs/75) : 30 pièces imprimées (19 + 11 de réserve) : 7 places intérieures pour 15 pièces (HC2 ×8, HC3 ×7), 6 bords pour 8, 6 coins pour 7
    'hex19': { HC2: 8, HC3: 7, HB1: 8, HK1: 7 } };
  /** Stock du catalogue 5×5 de la version 4.00.0 (docs/47), gardé avec lui dans PM.catalogue.precedents['5x5']. */
  var STOCK_5X5_400 = { U1: 5, P3: 4, P5: 3, P1: 3, P2: 3, B1: 6, B7: 8, K2: 5 };
  function avecStock(liste, stock) {
    liste.forEach(function (m) {
      if (!m.horsTirage) m.poids = m.exemplaires; // un modèle hors tirage (LE1) n'a pas de poids : le générateur l'ignore
      if (Object.prototype.hasOwnProperty.call(stock, m.id)) m.exemplaires = stock[m.id];
    });
    return liste;
  }

  var MODELES = geler(avecStock(construire4(), STOCK['4x4']));
  var MODELES_5X5 = geler(avecStock(construire5(), STOCK['5x5']));
  var MODELES_HEX = geler(avecStock(construireHex(), STOCK['hex19']));
  var PAR_GRILLE = geler({ '4x4': MODELES, '5x5': MODELES_5X5, 'hex19': MODELES_HEX });
  var PRECEDENT = geler({ '4x4': construirePrecedent4(), '5x5': construirePrecedent5() });
  /*
   * Tous les catalogues précédents, du plus ancien au plus récent, par grille : 4×4 : 3.04 ; 5×5 : 3.04 puis 4.00.0 (organique à
   * 3 ou 4 cases par centrale, remplacé par le catalogue à 2 cases par tuile). Un document dont la bibliothèque est exactement l'un
   * d'eux se voit proposer le catalogue courant (PM.sauvegarde.bibliothequeCataloguePrecedent) ; ses modèles restent protégés.
   */
  var PRECEDENTS = geler({
    '4x4': [{ version: '3.04', modeles: PRECEDENT['4x4'] }],
    '5x5': [{ version: '3.04', modeles: PRECEDENT['5x5'] }, { version: '4.00', modeles: avecStock(construirePrecedent5Organique(), STOCK_5X5_400) }]
  });

  /**
   * Document neuf de la grille demandée ('4x4' par défaut) contenant une copie modifiable de ses modèles
   * (6 en 4×4, 11 en 5×5, 4 en hexagonal). Lève une Error pour une grille inconnue.
   */
  function nouveauDocument(grille) {
    var g = grille === undefined || grille === null ? '4x4' : grille;
    if (typeof g !== 'string' || !Object.prototype.hasOwnProperty.call(PAR_GRILLE, g)) throw new Error('Grille inconnue : ' + String(grille) + '.');
    var doc = PM.modele.nouveauDocument(g);
    doc.modeles = JSON.parse(JSON.stringify(PAR_GRILLE[g]));
    return doc;
  }

  PM.catalogue = {
    version: 4,                       // 4 : 5×5 à 2 cases par tuile (docs/55) ; 3 : catalogues « organiques » (docs/46) ; 2 : version 3.04
    modeles: MODELES,                 // tableau gelé (lecture seule) : catalogue 4×4, gardé pour la compatibilité
    modelesParGrille: PAR_GRILLE,     // { '4x4': [...], '5x5': [...], 'hex19': [...] } gelé
    precedent: PRECEDENT,             // { '4x4': [...], '5x5': [...] } gelé : catalogues de la version 3.04 (compatibilité, tests)
    precedents: PRECEDENTS,           // { grille: [{ version, modeles }] } gelé : tous les catalogues précédents (3.04 ; 5×5 : aussi 4.00.0)
    nouveauDocument: nouveauDocument
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.catalogue;
})();
