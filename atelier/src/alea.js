/*
 * alea.js : aléa à graine (une partie ou un plateau se rejoue à l'identique).
 * Aucun accès au DOM, aucune dépendance.
 *
 * AT.alea.creer(graine) → générateur :
 *   suivant()          nombre dans [0, 1[
 *   entier(n)          entier dans 0..n-1
 *   de()               entier dans 1..6
 *   melanger(tableau)  copie mélangée (le tableau reçu n'est pas modifié)
 *   choisir(tableau)   un élément du tableau (undefined si le tableau est vide)
 *   etat()             état interne : un entier (valeur JSON simple)
 *   restaurer(etat)    reprend la suite à partir d'un état rendu par etat()
 * La graine est un entier ou une chaîne. Algorithme : mulberry32 (état de 32 bits).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  /** Transforme une graine (entier ou chaîne) en entier de 32 bits non signé. */
  function grainer(graine) {
    if (typeof graine === 'number' && Number.isFinite(graine) && Math.floor(graine) === graine
        && graine >= 0 && graine <= 0xFFFFFFFF) {
      return graine >>> 0;
    }
    // Tout le reste (chaîne, entier négatif ou trop grand, autre) passe par un hachage FNV-1a de sa forme texte.
    var texte = String(graine);
    var h = 0x811C9DC5;
    for (var i = 0; i < texte.length; i++) {
      h ^= texte.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  function creer(graine) {
    var s = grainer(graine);

    function suivant() {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    function entier(n) {
      if (!Number.isInteger(n) || n < 1) throw new Error('entier(n) : n doit être un entier supérieur ou égal à 1');
      return Math.floor(suivant() * n);
    }

    return {
      suivant: suivant,
      entier: entier,
      de: function () { return entier(6) + 1; },
      melanger: function (tableau) {
        var copie = Array.prototype.slice.call(tableau);
        for (var i = copie.length - 1; i > 0; i--) {
          var j = entier(i + 1);
          var tmp = copie[i]; copie[i] = copie[j]; copie[j] = tmp;
        }
        return copie;
      },
      choisir: function (tableau) {
        if (!tableau || tableau.length === 0) return undefined;
        return tableau[entier(tableau.length)];
      },
      etat: function () { return s; },
      restaurer: function (etat) {
        if (!Number.isInteger(etat) || etat < 0 || etat > 0xFFFFFFFF) throw new Error('restaurer : état d’aléa invalide');
        s = etat >>> 0;
      }
    };
  }

  AT.alea = { creer: creer, grainer: grainer };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.alea;
})();
