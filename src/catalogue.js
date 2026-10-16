/*
 * catalogue.js : catalogues des tuiles des formats 4×4 et 5×5, version 2 (orientation canonique, mm).
 * Le catalogue 5×5 (répartition B′, docs/18 « Décisions de l'utilisateur pour le catalogue 5×5 », docs/24 § 8, coordonnées
 * validées dans docs/29) est décrit plus bas ; PM.catalogue.modeles reste le catalogue 4×4 décrit ici.
 * Aucun accès au DOM. Règles : docs/18-decisions-v2.md, docs/19-avis-design-v2.md (R1 à R4, § 5),
 * docs/20-avis-geometrie-v2.md (cotes, D5 raccourci de coin) ; mesures : docs/21-mesures-catalogue-v2.md.
 *
 * 13 modèles, 22 exemplaires à imprimer (les poses sont illimitées : l'exemplaire ne sert qu'à l'impression et de poids
 * au générateur, docs/18, retours après essai) :
 *  - 6 centrales C1..C6 (1 exemplaire, 2 pour C4), 4 à 6 cases ;
 *  - 5 modèles de bord B1, B3..B6 (10 exemplaires dont 6 de B1), 3 ou 4 cases, une case d'apparition ;
 *  - 2 modèles de coin K2 (4 exemplaires) et K4 (1 exemplaire), 3 ou 4 cases, une case d'apparition ; K1 (direct, une seule
 *    case avant la jonction) et K3 (poche) sont retirés, K4 est la seule autre forme de coin qui respecte tout (voir K4).
 *  Aucun modèle n'a de poche (case en impasse, alerte `poche` de validerModele).
 *  Environ 60 à 63 cases par plateau (cases des 16 tuiles + 2 jonctions-cases), voir tests/catalogue.test.js.
 *
 * Règles que tous les modèles respectent (aucune erreur ni alerte de PM.modele.validerModele) :
 *  - R1 une case porte au plus un port de coin ; R2 deux cases porteuses ne sont jamais reliées directement ;
 *  - R3 aucun raccord latéral sur une case porteuse ; R4 la case d'apparition ne porte jamais de port.
 *  Conséquence : sur tout trajet ville - ville, case porteuse, case sans port, case porteuse :
 *  au moins 3 cases entre deux villes (4 pas), quelles que soient la pose et les villes.
 *
 * Rappels de géométrie (docs/archives/2-avis-geometrie.md, docs/20) :
 *  - côtés 0 = N, 1 = E, 2 = S, 3 = O ; coins 0 = NO, 1 = NE, 2 = SE, 3 = SO ;
 *  - position de raccord 0 = début, 1 = milieu, 2 = fin, en lecture horaire
 *    (N d'ouest en est, E du nord au sud, S d'est en ouest, O du sud au nord) ;
 *  - un raccord (côté k, pos p) rencontre le raccord (k + 2, 2 - p) du voisin.
 *
 * Positions de raccord :
 *  - côté qui regarde une centrale (S d'un bord, côtés d'une centrale) : milieu (pos 1) seulement,
 *    car une centrale tourne librement et ses raccords partent du centre de l'étoile ; seule C5 (étoile fermée)
 *    a un côté sans raccord, le seul « mur » du catalogue (docs/22 : B2, bord fermé, supprimé) ;
 *  - raccourci de coin (D5), côtés latéraux des bords et des coins, tous à 30 mm du bord extérieur :
 *    bord canonique (extérieur N) E pos 0 + O pos 2 (masque 0x808), coin canonique (extérieurs N et O)
 *    E pos 0 + S pos 2 (masque 0x108) ; ils se rencontrent dans toutes les rotations.
 *
 * Gabarits canoniques : une centrale a ses 4 coins en jonction ; un bord a son côté extérieur au nord et
 * ses ports aux coins SE (2) et SO (3) ; un coin a ses côtés extérieurs au nord et à l'ouest et son
 * port au coin SE (2). Chaque bord et chaque coin porte une case d'apparition (sans port), à l'écran
 * verte ou rouge selon le camp de sa cellule.
 *
 * Tracés : segments droits, amorce perpendiculaire de 10 mm à chaque raccord, amorce de 28 mm sur la
 * bissectrice à chaque port ; à 14 mm au moins des autres cases, 24 mm des coins (sauf le port), sans
 * contact entre chemins (contrôlé par tests/catalogue.test.js).
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

  function construire() {
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
   * Catalogue 5×5 (tuiles de 100 mm, positions de raccord 30 / 50 / 70, cases Ø 20), répartition B′ : 30 tuiles, 78 cases
   * environ par plateau avec 9 jonctions-cases, 40 ports. Coordonnées de docs/29 (marge de tracé >= 2,7 mm).
   *  - 1 coin K2 (5 exemplaires) ; K4 est écarté (trop serré dans 100 mm) ;
   *  - 3 bords B1 « en V » (6), B7 « simple » (4, port SE) et son miroir B7m (4, port SO) : le carton ne se retourne pas ;
   *  - 2 centrales à 3 cases C7 « Pont » (6) et C8 « Équerre » (5) : le relais central tient les 4 raccords au milieu.
   * Mêmes règles qu'en 4×4 (R1 à R4, aucune poche) ; pas de mur (C5) ; aucun raccord latéral hors du raccourci
   * (bord : E pos 0 + O pos 2 ; coin : E pos 0 + S pos 2) et du raccord S au milieu des bords, tous tirés de la case d'apparition.
   * Les ids (K2, B1, C7…) peuvent recouper ceux du 4×4 : le champ `grille` et le document les distinguent.
   */
  function construire5() {
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

  var MODELES = geler(construire());
  var MODELES_5X5 = geler(construire5());
  var PAR_GRILLE = geler({ '4x4': MODELES, '5x5': MODELES_5X5 });

  /**
   * Document neuf de la grille demandée ('4x4' par défaut) contenant une copie modifiable de ses modèles
   * (13 en 4×4, 6 en 5×5). Lève une Error pour une grille inconnue.
   */
  function nouveauDocument(grille) {
    var g = grille === undefined || grille === null ? '4x4' : grille;
    if (typeof g !== 'string' || !Object.prototype.hasOwnProperty.call(PAR_GRILLE, g)) throw new Error('Grille inconnue : ' + String(grille) + '.');
    var doc = PM.modele.nouveauDocument(g);
    doc.modeles = JSON.parse(JSON.stringify(PAR_GRILLE[g]));
    return doc;
  }

  PM.catalogue = {
    version: 2,
    modeles: MODELES,                 // tableau gelé (lecture seule) : catalogue 4×4, gardé pour la compatibilité
    modelesParGrille: PAR_GRILLE,     // { '4x4': [...], '5x5': [...] } gelé
    nouveauDocument: nouveauDocument
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.catalogue;
})();
