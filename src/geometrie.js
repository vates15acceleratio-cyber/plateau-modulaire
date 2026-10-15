/*
 * geometrie.js : constantes (mm), côtés / coins, masques, rotation, appariement.
 * Aucun accès au DOM. Voir docs/2-avis-geometrie.md (D3, D4).
 *
 * Conventions
 *  - Côtés : 0 = N, 1 = E, 2 = S, 3 = O.  Coins : 0 = NO, 1 = NE, 2 = SE, 3 = SO
 *    (le coin k est le début du côté k, lecture horaire).
 *  - Position de raccord p : 0 = début, 1 = milieu, 2 = fin (lecture horaire).
 *  - Repère local d'une tuile canonique : origine au coin NO, x vers l'est,
 *    y vers le sud, tuile de 0 à COTE.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  var COTE = 120;

  /** Constantes de conception (toutes en mm sauf mention contraire). */
  var CONSTANTES = {
    COTE: COTE,
    POSITIONS_RACCORD: [30, 60, 90], // distance depuis le coin de début du côté
    RAYON_ZONE_COIN: 20,
    DIAMETRE_CASE_MAX: 30,
    MARGE_COUPE_CASE: 4,             // bord du disque à >= 4 mm du bord de tuile
    LARGEUR_CHEMIN: 8,
    FOND_PERDU: 3,
    DIAMETRE_JETON: 30,
    GRILLE: { colonnes: 4, lignes: 4 },
    ECART_MIN_CAPTURES: 3,           // pas minimum entre deux villes
    MIN_PORTS_JONCTION: 2
  };

  var NORD = 0, EST = 1, SUD = 2, OUEST = 3;

  /** Numéro de bit d'un raccord (côté 0..3, position 0..2) dans le masque de 12 bits. */
  function bitRaccord(cote, pos) { return 3 * cote + pos; }

  /** Nombre de quarts de tour normalisé (entier 0..3) ; une valeur non entière compte pour 0. */
  function quarts(rot) { return (typeof rot === 'number' && isFinite(rot) && Math.floor(rot) === rot) ? ((rot % 4) + 4) % 4 : 0; }

  /** Rotation horaire de `rot` quarts de tour d'un masque de raccords (12 bits). */
  function tournerRaccords(m, rot) {
    var n = quarts(rot);
    for (var i = 0; i < n; i++) m = ((m << 3) | (m >> 9)) & 0xFFF;
    return m & 0xFFF;
  }

  /** Rotation horaire de `rot` quarts de tour d'un masque de ports de coin (4 bits). */
  function tournerPorts(c, rot) {
    var n = quarts(rot);
    for (var i = 0; i < n; i++) c = ((c << 1) | (c >> 3)) & 0xF;
    return c & 0xF;
  }

  /** Les 3 bits (positions 0..2) d'un côté. */
  function triplet(m, cote) { return (m >> (3 * cote)) & 7; }

  /** Échange les bits 0 et 2 d'un triplet (vue depuis le côté opposé). */
  function inverser3(b) { return ((b & 1) << 2) | (b & 2) | ((b >> 2) & 1); }

  /**
   * Appariement face à face : le côté coteA de A touche le côté (coteA+2)%4 de B,
   * la position p rencontre 2-p. Renvoie des triplets de 3 bits (vue de A pour
   * connectes et mortsA, vue de B pour mortsB).
   */
  function apparier(mA, coteA, mB) {
    var a = triplet(mA, coteA);
    var b = triplet(mB, (coteA + 2) % 4);
    return {
      connectes: a & inverser3(b),
      mortsA: a & ~inverser3(b) & 7,
      mortsB: b & ~inverser3(a) & 7
    };
  }

  /** Point d'un raccord en coordonnées locales (tuile canonique). */
  function pointRaccord(cote, pos) {
    var d = CONSTANTES.POSITIONS_RACCORD[pos];
    switch (cote) {
      case NORD: return { x: d, y: 0 };
      case EST: return { x: COTE, y: d };
      case SUD: return { x: COTE - d, y: COTE };
      default: return { x: 0, y: COTE - d };
    }
  }

  /** Coin k en coordonnées locales. */
  function pointCoin(k) {
    return [{ x: 0, y: 0 }, { x: COTE, y: 0 }, { x: COTE, y: COTE }, { x: 0, y: COTE }][k];
  }

  /** Rotation horaire de `rot` quarts de tour d'un point autour du centre de la tuile. */
  function tournerPoint(p, rot) {
    var n = quarts(rot);
    var x = p.x, y = p.y, t;
    for (var i = 0; i < n; i++) { t = x; x = COTE - y; y = t; }
    return { x: x, y: y };
  }

  /** Décalage de cellule du voisin situé de l'autre côté du côté `cote`. */
  function coteVoisin(cote) {
    return [{ dc: 0, dl: -1 }, { dc: 1, dl: 0 }, { dc: 0, dl: 1 }, { dc: -1, dl: 0 }][cote];
  }

  /** Raccord qui lui fait face de l'autre côté : le côté opposé, position 2 - p. */
  function raccordEnFace(cote, pos) { return { cote: (cote + 2) % 4, pos: 2 - pos }; }

  PM.geometrie = {
    COTE: COTE,
    POSITIONS_RACCORD: CONSTANTES.POSITIONS_RACCORD,
    RAYON_ZONE_COIN: CONSTANTES.RAYON_ZONE_COIN,
    DIAMETRE_CASE_MAX: CONSTANTES.DIAMETRE_CASE_MAX,
    MARGE_COUPE_CASE: CONSTANTES.MARGE_COUPE_CASE,
    LARGEUR_CHEMIN: CONSTANTES.LARGEUR_CHEMIN,
    FOND_PERDU: CONSTANTES.FOND_PERDU,
    DIAMETRE_JETON: CONSTANTES.DIAMETRE_JETON,
    GRILLE: CONSTANTES.GRILLE,
    ECART_MIN_CAPTURES: CONSTANTES.ECART_MIN_CAPTURES,
    MIN_PORTS_JONCTION: CONSTANTES.MIN_PORTS_JONCTION,
    NORD: NORD, EST: EST, SUD: SUD, OUEST: OUEST,
    bitRaccord: bitRaccord,
    tournerRaccords: tournerRaccords,
    tournerPorts: tournerPorts,
    triplet: triplet,
    inverser3: inverser3,
    apparier: apparier,
    pointRaccord: pointRaccord,
    pointCoin: pointCoin,
    tournerPoint: tournerPoint,
    coteVoisin: coteVoisin,
    raccordEnFace: raccordEnFace
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.geometrie;
})();
