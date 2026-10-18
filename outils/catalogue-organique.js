/*
 * catalogue-organique.js : catalogues CANDIDATS 4×4 et 5×5 pour un plateau « organique » (quarts de tour, T, passages sans case).
 * Proposition montrée à l'utilisateur en images (outils/planche-organique.js). La révision « centrales ouvertes »
 * (modelesParGrille) est BRANCHÉE depuis docs/46 : src/catalogue.js en porte une copie (mêmes modèles ; exemplaires du 5×5 revus :
 * B1 3 -> 6, B7 12 -> 8, pour 78 à 81 cases) ; ce fichier reste la référence des candidats et de la révision 44.
 * Même structure que src/catalogue.js (orientation canonique, mm), chargeable sous Node
 * après les fichiers de src/ :
 *   require('../src/catalogue.js'); require('./catalogue-organique.js'); -> PM.catalogueOrganique
 *
 * Règles appliquées (docs/18 fin, qui prime sur docs/38) :
 *  - aucune paire miroir : chaque modèle sert par simple rotation (un carton par modèle) ;
 *  - un passage ne va jamais vers un coin ; une case porteuse (port de coin) ne touche jamais un passage ;
 *  - bords et coins : un passage au plus, jamais depuis la case d'apparition ; le raccourci part de l'apparition (chemin normal) ;
 *  - R1 à R4, raccords standard (4×4 : 30 / 60 / 90 ; 5×5 : 30 / 50 / 70), côtés qui regardent une centrale : milieu seulement ;
 *  - aucune poche, aucune case isolée, aucun mur (4 raccords au milieu sur chaque centrale) ;
 *  - centrales : au moins 2 motifs, 1 à 2 passages (un T = 3 passages autour d'un pivot), un T au plus, pas de croisement,
 *    les 4 raccords ne vont pas tous au même nœud, au moins 2 ports vers des coins différents.
 * Repères pour les deux questions ouvertes de l'utilisateur (champ `repere` de PM.catalogueOrganique.infos) :
 *  (a) « traversant » : passage entre deux côtés opposés (droit ou courbe) ;
 *  (b) « 2 passages » / « T » : centrale 4×4 à plus d'un passage (le plafond d'un passage par centrale est en question).
 * Le coin ne peut pas porter de passage : ses deux seuls raccords (E pos 0, S pos 2) sont le raccourci, tiré de l'apparition,
 * et tout autre raccord serait mort contre un bord (docs/29 § 2). K2 reste donc sans variante.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('../src/modele.js'); // chargement sous Node

(function () {
  'use strict';

  var DIAMETRE = PM.geometrie.DIAMETRE_CASE;

  /* Petits constructeurs (mêmes conventions que src/catalogue.js). */
  function kase(id, x, y, type) { return { id: id, x: x, y: y, diametre: DIAMETRE, type: type || 'deplacement' }; }
  function appar(id, x, y) { return kase(id, x, y, 'apparition'); }
  function lien(id, a, b) { return { id: id, a: { 'case': a }, b: { 'case': b } }; }
  function port(id, c, coin) { return { id: id, a: { 'case': c }, b: { coin: coin } }; }
  function raccord(id, c, cote, pos) { return { id: id, a: { 'case': c }, b: { raccord: { cote: cote, pos: pos } } }; }
  /* Extrémités de passage : case, raccord, pivot. */
  function C(id) { return { 'case': id }; }
  function R(cote, pos) { return { raccord: { cote: cote, pos: pos } }; }
  function V(id) { return { pivot: id }; }
  function passage(id, a, b, courbe) { var p = { id: id, a: a, b: b }; if (courbe) p.courbe = courbe; return p; }
  function pivot(id, x, y) { return { id: id, x: x, y: y }; }

  function modele(grille, id, nom, gabarit, exemplaires, cases, chemins, pivots, passages) {
    var m = { id: id, nom: nom, gabarit: gabarit, grille: grille, exemplaires: exemplaires, cases: cases, chemins: chemins };
    if (pivots && pivots.length) m.pivots = pivots;
    if (passages && passages.length) { m.pivots = m.pivots || []; m.passages = passages; }
    return m;
  }
  function raccourciBord(c) { return [raccord('r1', c, 1, 0), raccord('r2', c, 3, 2)]; }
  function raccourciCoin(c) { return [raccord('r1', c, 1, 0), raccord('r2', c, 2, 2)]; }

  /* ================================ 4×4 (tuiles de 120 mm) ================================ */
  function construire4R44() {
    function m4(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modele('4x4', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    return [
      /* ---------- Centrales ---------- */
      // Virage et pont : quart de tour sans case au sud-ouest ; un seul relais prend N et E et tient les ports NO et SE (allégé)
      m4('O9', 'Virage et pont', 'centrale', 2,
        [kase('r', 74, 46), kase('c1', 30, 30), kase('c3', 92, 92)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h1', 'r', 'c1'), lien('h3', 'r', 'c3'),
          port('p1', 'c1', 0), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // Équerre à virage : même quart de tour ; le relais prend N et E et tient les ports NE et SE (deux coins voisins)
      m4('O10', 'Équerre à virage', 'centrale', 1,
        [kase('r', 62, 46), kase('c2', 94, 26), kase('c3', 92, 92)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'),
          port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // Demi-tour : le raccord S monte et revient en crochet sans case vers le relais ouest ; deux fourches sans lien entre elles
      m4('O6', 'Demi-tour', 'centrale', 1,
        [kase('r', 40, 48), kase('c1', 26, 28), kase('c4', 26, 94), kase('e', 94, 60), kase('c2', 94, 28), kase('c3', 94, 94)], [
          raccord('rn', 'r', 0, 1), raccord('rw', 'r', 3, 1), lien('h1', 'r', 'c1'), lien('h2', 'r', 'c4'),
          raccord('re', 'e', 1, 1), lien('h3', 'e', 'c2'), lien('h4', 'e', 'c3'),
          port('p1', 'c1', 0), port('p4', 'c4', 3), port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), C('r'), { x: 76, y: 56 })]),
      // Virage et deux ponts : quart de tour sans case au sud-ouest ; deux relais sans lien entre eux (N avec NO, E avec NE et SE)
      m4('O11', 'Virage et deux ponts', 'centrale', 2,
        [kase('n', 50, 40), kase('c1', 24, 28), kase('e', 88, 62), kase('c2', 94, 28), kase('c3', 94, 94)], [
          raccord('rn', 'n', 0, 1), lien('h1', 'n', 'c1'), raccord('re', 'e', 1, 1), lien('h2', 'e', 'c2'), lien('h3', 'e', 'c3'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // Pour comparaison seulement (0 exemplaire) : double virage à 2 passages, écarté par l'utilisateur (un passage par centrale en 4×4)
      m4('O2', 'Double virage (écarté)', 'centrale', 0,
        [kase('c1', 30, 30), kase('r1', 50, 50), kase('r2', 70, 70), kase('c3', 90, 90)], [
          lien('h1', 'c1', 'r1'), lien('h2', 'r1', 'r2'), lien('h3', 'r2', 'c3'),
          port('p1', 'c1', 0), port('p3', 'c3', 2)
        ], [], [passage('q1', R(0, 1), R(1, 1)), passage('q2', R(2, 1), R(3, 1))]),
      // Boucle et équerre : boucle de 4 cases (deux relais, deux porteuses) ; le relais SE prend le raccord S par un virage sans case
      m4('O7', 'Boucle', 'centrale', 1,
        [kase('a', 44, 44), kase('b', 78, 78), kase('c2', 92, 30), kase('c4', 30, 92)], [
          raccord('rn', 'a', 0, 1), raccord('rw', 'a', 3, 1), raccord('re', 'b', 1, 1),
          lien('h1', 'a', 'c2'), lien('h2', 'c2', 'b'), lien('h3', 'b', 'c4'), lien('h4', 'c4', 'a'),
          port('p2', 'c2', 1), port('p4', 'c4', 3)
        ], [], [passage('q1', R(2, 1), C('b'))]),

      /* ---------- Bords (extérieur N, ports SE / SO, raccourci E pos 0 + O pos 2) ---------- */
      m4('B1', 'Bord en V', 'bord', 8,
        [appar('a', 60, 50), kase('c1', 94, 94), kase('c2', 26, 94)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // Bord à virage : un relais prend le raccord S par un virage sans case ; l'apparition tient le raccourci et le port SE
      m4('B8', 'Bord à virage', 'bord', 1,
        [appar('a', 60, 36), kase('r', 34, 66), kase('c1', 94, 92), kase('c2', 24, 98)], [
          lien('h1', 'a', 'r'), lien('h2', 'a', 'c1'), lien('h3', 'r', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a')), [], [passage('q1', C('r'), R(2, 1))]),
      /* ---------- Coins (extérieurs N et O, port SE, raccourci E pos 0 + S pos 2) ---------- */
      m4('K2', 'Coin à relais', 'coin', 4,
        [appar('a', 38, 38), kase('r', 63, 63), kase('c1', 88, 88)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a'))),
      m4('K4', 'Coin en losange', 'coin', 1,
        [appar('a', 40, 40), kase('s1', 82, 61), kase('s2', 61, 82), kase('c1', 92, 92)], [
          lien('h1', 'a', 's1'), lien('h2', 'a', 's2'), lien('h3', 's1', 'c1'), lien('h4', 's2', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a')))
    ];
  }

  /* ================================ 5×5 (tuiles de 100 mm) ================================ */
  function construire5R44() {
    function m5(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modele('5x5', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    return [
      /* ---------- Centrales (3 cases : un relais et deux porteuses, sauf mention) ---------- */
      // Virage double : quart de tour sans case au sud-ouest ; le relais prend N et E (virage par case), ports NO et SE
      m5('P1', 'Virage double', 'centrale', 3,
        [kase('r', 60, 40), kase('c1', 26, 26), kase('c3', 74, 74)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h1', 'r', 'c1'), lien('h3', 'r', 'c3'),
          port('p1', 'c1', 0), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // Équerre à virage : même quart de tour ; le relais prend N et E, ports NE et SE (deux coins voisins)
      m5('P2', 'Équerre à virage', 'centrale', 3,
        [kase('r', 50, 40), kase('c2', 76, 24), kase('c3', 74, 74)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'),
          port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // T sans case : les raccords O, N et E se rejoignent en T (pivot sans case) ; fourche au sud
      m5('P3', 'T sans case', 'centrale', 2,
        [kase('s', 50, 70), kase('c4', 24, 76), kase('c3', 76, 76)], [
          raccord('rs', 's', 2, 1), lien('h4', 's', 'c4'), lien('h3', 's', 'c3'),
          port('p4', 'c4', 3), port('p3', 'c3', 2)
        ], [pivot('v', 50, 34)], [passage('t1', R(3, 1), V('v')), passage('t2', R(0, 1), V('v')), passage('t3', R(1, 1), V('v'))]),
      // Double virage : deux quarts de tour sans case (N-E et S-O), couloir diagonal de 3 cases entre les jonctions NO et SE
      m5('P5', 'Double virage', 'centrale', 1,
        [kase('c1', 26, 26), kase('r', 50, 50), kase('c3', 74, 74)], [
          lien('h1', 'c1', 'r'), lien('h3', 'r', 'c3'), port('p1', 'c1', 0), port('p3', 'c3', 2)
        ], [], [passage('q1', R(0, 1), R(1, 1), { x: 52, y: 48 }), passage('q2', R(2, 1), R(3, 1), { x: 48, y: 52 })]),
      // Boucle (4 cases) : deux relais et deux porteuses en boucle ; le relais SE prend le raccord S par un virage sans case
      m5('P6', 'Boucle', 'centrale', 2,
        [kase('a', 36, 36), kase('b', 64, 64), kase('c2', 74, 26), kase('c4', 26, 74)], [
          raccord('rn', 'a', 0, 1), raccord('rw', 'a', 3, 1), raccord('re', 'b', 1, 1),
          lien('h1', 'a', 'c2'), lien('h2', 'c2', 'b'), lien('h3', 'b', 'c4'), lien('h4', 'c4', 'a'),
          port('p2', 'c2', 1), port('p4', 'c4', 3)
        ], [], [passage('q1', R(2, 1), C('b'))]),
      // T pur, sans aucune case : pour information seulement (0 exemplaire) ; son côté sud est un mur, contraire à « aucun mur »
      m5('P0', 'T pur (mur)', 'centrale', 0,
        [], [], [pivot('v', 50, 40)], [passage('t1', R(3, 1), V('v')), passage('t2', R(0, 1), V('v')), passage('t3', R(1, 1), V('v'))]),

      /* ---------- Bords ---------- */
      m5('B1', 'Bord en V', 'bord', 6,
        [appar('a', 50, 40), kase('c1', 82, 66), kase('c2', 18, 66)], [
          lien('h1', 'a', 'c1'), lien('h2', 'a', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // Bord simple : un seul port (SE), sans miroir : posé par rotation, il nourrit toujours la jonction suivante dans le sens horaire
      m5('B7', 'Bord simple', 'bord', 6,
        [appar('a', 56, 38), kase('c1', 84, 64)], [
          lien('h1', 'a', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciBord('a'), [raccord('r3', 'a', 2, 1)])),
      // Bord à virage : un relais prend le raccord S par un virage sans case ; port SO tiré de l'apparition
      m5('B9', 'Bord à virage', 'bord', 2,
        [appar('a', 44, 34), kase('r', 72, 62), kase('c2', 18, 66)], [
          lien('h1', 'a', 'r'), lien('h2', 'a', 'c2'), port('p2', 'c2', 3)
        ].concat(raccourciBord('a')), [], [passage('q1', C('r'), R(2, 1))]),

      /* ---------- Coin ---------- */
      m5('K2', 'Coin à relais', 'coin', 5,
        [appar('a', 32, 32), kase('r', 53, 53), kase('c1', 74, 74)], [
          lien('h1', 'a', 'r'), lien('h2', 'r', 'c1'), port('p1', 'c1', 2)
        ].concat(raccourciCoin('a')))
    ];
  }

  /* ===================== Révision « centrales ouvertes » (docs/18, réponses sur la révision « rythme ») =====================
   * Centrales à 3 ou 4 coins desservis par un seul relais (chaque port à 1 pas du relais) ; 4×4 : un passage au plus par
   * centrale ; aucun traversant, aucune paire miroir. Un virage sans case entre deux côtés voisins enferme le coin qu'il
   * contourne : une centrale à virage dessert donc 3 coins au plus ; une centrale à 4 coins n'a qu'un passage « crochet »
   * (raccord -> relais), qui n'économise aucun pas. */
  function construire4() {
    function m4(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modele('4x4', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    var r44 = construire4R44(), garder = function (id, ex) { var m = r44.filter(function (x) { return x.id === id; })[0]; m.exemplaires = ex; return m; };
    return [
      /* ---------- Centrales ---------- */
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

      /* ---------- Bords et coins : ceux de la révision « rythme » ---------- */
      garder('B1', 8), garder('B8', 1), garder('K2', 4), garder('K4', 1)
    ];
  }

  function construire5() {
    function m5(id, nom, gabarit, ex, cases, chemins, pivots, passages) { return modele('5x5', id, nom, gabarit, ex, cases, chemins, pivots, passages); }
    var r44 = construire5R44(), garder = function (id, ex) { var m = r44.filter(function (x) { return x.id === id; })[0]; m.exemplaires = ex; return m; };
    return [
      /* ---------- Centrales ---------- */
      // Trident à virage : quart de tour sans case au sud-ouest ; le relais tient N et E et les ports NO, NE et SE
      m5('U1', 'Trident à virage', 'centrale', 5,
        [kase('r', 58, 44), kase('c1', 26, 26), kase('c2', 74, 26), kase('c3', 74, 74)], [
          raccord('rn', 'r', 0, 1), raccord('re', 'r', 1, 1), lien('h1', 'r', 'c1'), lien('h2', 'r', 'c2'), lien('h3', 'r', 'c3'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2)
        ], [], [passage('q1', R(2, 1), R(3, 1))]),
      // P3 (T sans case), P5 (double virage, symétrique par demi-tour : seule centrale possible au centre en pose symétrique)
      garder('P3', 2), garder('P5', 2), garder('P1', 1), garder('P2', 1),
      /* ---------- Bords et coin ---------- */
      garder('B1', 3), garder('B7', 12), garder('K2', 5)
    ];
  }

  /** Famille (docs/38) et repère pour les questions ouvertes, par grille et par id. */
  var INFOS = {
    '4x4': {
      Q1: { famille: 'trident + virage (3 coins)', repere: '' },
      Q2: { famille: 'étoile + crochet (4 coins)', repere: '' },
      O9: { famille: 'virage + pont (allégée)', repere: '' },
      O10: { famille: 'virage + équerre libre (allégée)', repere: '' },
      O6: { famille: 'demi-tour + deux fourches', repere: '' },
      O11: { famille: 'virage + deux ponts', repere: '' },
      O2: { famille: 'double virage, pour comparaison', repere: 'écarté : 2 passages' },
      O7: { famille: 'boucle + virage', repere: '' },
      B1: { famille: 'bord en V (actuel)', repere: '' },
      B8: { famille: 'bord à virage', repere: '' },
      K2: { famille: 'coin à relais (actuel)', repere: '' },
      K4: { famille: 'coin en losange (actuel)', repere: '' }
    },
    '5x5': {
      U1: { famille: 'trident + virage (3 coins)', repere: '' },
      P1: { famille: 'virage + pont', repere: '' },
      P2: { famille: 'équerre libre + virage', repere: '' },
      P3: { famille: 'T sans case + fourche', repere: 'T' },
      P5: { famille: 'virage double + couloir (symétrique)', repere: '2 passages' },
      P6: { famille: 'boucle + virage', repere: '' },
      P0: { famille: 'T pur (sans case)', repere: 'hors règles : mur' },
      B1: { famille: 'bord en V (actuel)', repere: '' },
      B7: { famille: 'bord simple, sans miroir', repere: '' },
      B9: { famille: 'bord à virage', repere: '' },
      K2: { famille: 'coin à relais (actuel)', repere: '' }
    }
  };

  PM.catalogueOrganique = {
    modelesParGrille: { '4x4': construire4(), '5x5': construire5() },   // révision « centrales ouvertes »
    revision44: { '4x4': construire4R44(), '5x5': construire5R44() },   // révision « rythme » (docs/44), pour comparaison
    infos: INFOS
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.catalogueOrganique;
})();
