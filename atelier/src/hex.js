/*
 * hex.js : géométrie des cases hexagonales, pointe en haut, coordonnées axiales (q, r).
 * Aucun accès au DOM, aucune dépendance.
 *
 * Une case est désignée par sa clé 'q,r' (chaîne). Les fonctions qui reçoivent une case acceptent
 * aussi bien une clé qu'un objet {q, r}.
 * Rangées : r est le numéro de rangée (r minimal = haut du plateau, r maximal = bas).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  /** Les 6 directions, dans l'ordre : est, nord-est, nord-ouest, ouest, sud-ouest, sud-est. */
  var DIRS = Object.freeze([
    Object.freeze({ q: 1, r: 0 }), Object.freeze({ q: 1, r: -1 }), Object.freeze({ q: 0, r: -1 }),
    Object.freeze({ q: -1, r: 0 }), Object.freeze({ q: -1, r: 1 }), Object.freeze({ q: 0, r: 1 })
  ]);

  var FORME_CLE = /^(0|-?[1-9][0-9]{0,2}),(0|-?[1-9][0-9]{0,2})$/;

  function cle(q, r) { return q + ',' + r; }

  /** Clé → {q, r}. Lève une Error si la clé n'a pas la forme canonique 'q,r'. */
  function decle(c) {
    var m = typeof c === 'string' ? FORME_CLE.exec(c) : null;
    if (!m) throw new Error('clé de case invalide : ' + String(c).slice(0, 20));
    return { q: parseInt(m[1], 10), r: parseInt(m[2], 10) };
  }

  /** Vrai si `c` est une clé de case canonique ('q,r', entiers de 3 chiffres au plus, sans zéro inutile). */
  function estCle(c) { return typeof c === 'string' && FORME_CLE.test(c); }

  /** Accepte une clé ou un objet {q, r} ; renvoie {q, r}. */
  function point(a) { return typeof a === 'string' ? decle(a) : a; }

  /** Les 6 clés voisines (dans l'ordre de DIRS), que les cases existent ou non sur le plateau. */
  function voisines(c) {
    var p = point(c), res = [];
    for (var i = 0; i < 6; i++) res.push(cle(p.q + DIRS[i].q, p.r + DIRS[i].r));
    return res;
  }

  /** Distance en cases entre deux cases (à vol d'oiseau, sans tenir compte du terrain). */
  function distance(a, b) {
    var pa = point(a), pb = point(b);
    var dq = pa.q - pb.q, dr = pa.r - pb.r;
    return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
  }

  /** Numéro d'anneau d'une case autour de (0,0) : 0 pour le centre. */
  function anneau(c) { return distance(c, { q: 0, r: 0 }); }

  /**
   * Tourne le vecteur (q, r) de `sixiemes` sixièmes de tour autour de (0,0). Renvoie {q, r}.
   * Un sixième de tour : (q, r) → (-r, q + r). Trois sixièmes : le demi-tour (-q, -r).
   */
  function tourner(q, r, sixiemes) {
    var k = (((sixiemes | 0) % 6) + 6) % 6;
    for (var i = 0; i < k; i++) {
      var nq = 0 - r;           // « 0 - r » et non « -r » : évite le zéro négatif
      r = q + r;
      q = nq;
    }
    return { q: q, r: r };
  }

  /** Clé de la case symétrique par demi-tour autour de (0,0). */
  function symetrique(c) {
    var p = point(c);
    return cle(0 - p.q, 0 - p.r);
  }

  /** Clés de toutes les cases à `rayon` cases au plus de (0,0) : 1, 7, 19, 37, 61, 91… cases. */
  function disque(rayon) {
    var res = [];
    for (var r = -rayon; r <= rayon; r++) {
      for (var q = -rayon; q <= rayon; q++) {
        if (Math.abs(q + r) <= rayon) res.push(cle(q, r));
      }
    }
    return res;
  }

  /** Tri des clés par rangée puis par colonne (ordre de lecture) ; renvoie une copie triée. */
  function trier(cles) {
    return cles.slice().sort(function (a, b) {
      var pa = decle(a), pb = decle(b);
      return pa.r - pb.r || pa.q - pb.q;
    });
  }

  /** Centre de la case en unités de dessin ; `plat` = distance plat à plat (largeur de la case). */
  function centre(q, r, plat) {
    return { x: plat * (q + r / 2), y: plat * Math.sqrt(3) / 2 * r };
  }

  /** Les 6 sommets de l'hexagone pointe en haut centré en (x, y), en partant du sommet du haut. */
  function sommets(x, y, plat) {
    var rayon = plat / Math.sqrt(3), res = [];
    for (var i = 0; i < 6; i++) {
      var angle = Math.PI / 180 * (60 * i - 90);
      res.push({ x: x + rayon * Math.cos(angle), y: y + rayon * Math.sin(angle) });
    }
    return res;
  }

  AT.hex = {
    DIRS: DIRS, cle: cle, decle: decle, estCle: estCle, voisines: voisines, distance: distance,
    anneau: anneau, tourner: tourner, symetrique: symetrique, disque: disque, trier: trier,
    centre: centre, sommets: sommets
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.hex;
})();
