/*
 * etat.js : état partagé de l'application (document + historique + état d'interface).
 * Aucun accès au DOM. Toutes les modifications du document passent par `appliquer`,
 * avec une fonction pure de PM.modele (document → nouveau document).
 *
 * État d'interface (`ui`), hors historique :
 *  - onglet : 'plateau' | 'tuiles'
 *  - modeleSelectionne : id du modèle ouvert dans l'éditeur (ou null)
 *  - surbrillance : élément à mettre en évidence (clic sur une alerte), ou null :
 *      {type:'tuile', col, lig} | {type:'raccord', col, lig, cote, pos} | {type:'port', col, lig, coin}
 *      | {type:'jonction', i, j} | {type:'case', modeleId, id} | {type:'chemin', modeleId, id}
 *  - message : {texte, niveau: 'info'|'alerte'|'erreur'} pour la barre d'état, ou null
 *  - aPoser : id du modèle armé pour une pose en deux clics (clic sur sa vignette dans la bibliothèque), ou absent
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  var MAX_HISTORIQUE = 100;

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  /**
   * Crée un état. `doc` : document initial (cloné).
   * Renvoie un objet : doc(), ui(), appliquer(fn, libelle), annuler(), retablir(),
   * peutAnnuler(), peutRetablir(), remplacer(doc), majUi(patch), signaler(texte, niveau), abonner(cb).
   */
  function creer(doc) {
    var courant = cloner(doc);
    var passe = [], futur = [];
    var ui = { onglet: 'plateau', modeleSelectionne: null, surbrillance: null, message: null };
    var abonnes = [];

    function notifier(raison) {
      abonnes.slice().forEach(function (cb) {
        try { cb({ raison: raison, doc: courant, ui: ui }); } catch (e) { if (typeof console !== 'undefined') console.error(e); }
      });
    }

    var etat = {
      /** Document courant (ne pas le modifier directement). */
      doc: function () { return courant; },
      /** État d'interface courant (ne pas le modifier directement, utiliser majUi). */
      ui: function () { return ui; },

      /**
       * Applique `fn(doc) → nouveau document` (fonction pure de PM.modele).
       * Si `fn` lève une Error, le document ne change pas, la raison est signalée dans la barre d'état.
       * Renvoie {ok: true} ou {ok: false, raison}.
       */
      appliquer: function (fn, libelle) {
        var suivant;
        try { suivant = fn(courant); } catch (e) {
          var raison = e && e.message ? e.message : String(e);
          etat.signaler(raison, 'erreur');
          return { ok: false, raison: raison };
        }
        if (!suivant || typeof suivant !== 'object') {
          etat.signaler('Action impossible : résultat invalide.', 'erreur');
          return { ok: false, raison: 'Résultat invalide.' };
        }
        passe.push({ doc: courant, libelle: libelle || '' });
        if (passe.length > MAX_HISTORIQUE) passe.shift();
        futur = [];
        courant = suivant;
        notifier('doc');
        return { ok: true };
      },

      annuler: function () {
        if (!passe.length) return false;
        var p = passe.pop();
        futur.push({ doc: courant, libelle: p.libelle });
        courant = p.doc;
        etat.signaler('Annulé' + (p.libelle ? ' : ' + p.libelle : '') + '.', 'info');
        notifier('doc');
        return true;
      },

      retablir: function () {
        if (!futur.length) return false;
        var s = futur.pop();
        passe.push({ doc: courant, libelle: s.libelle });
        courant = s.doc;
        etat.signaler('Rétabli' + (s.libelle ? ' : ' + s.libelle : '') + '.', 'info');
        notifier('doc');
        return true;
      },

      peutAnnuler: function () { return passe.length > 0; },
      peutRetablir: function () { return futur.length > 0; },

      /**
       * Remplace tout le document (ouverture d'un fichier). Annulable : le document précédent est gardé
       * dans l'historique (docs/archives/11-revue-interface.md, I1 : un fichier ouvert par erreur ne fait rien perdre).
       */
      remplacer: function (doc, libelle) {
        passe.push({ doc: courant, libelle: libelle || 'ouverture d’un fichier' });
        if (passe.length > MAX_HISTORIQUE) passe.shift();
        futur = [];
        courant = cloner(doc);
        ui = Object.assign({}, ui, { modeleSelectionne: null, surbrillance: null });
        notifier('doc');
      },

      /** Met à jour l'état d'interface (hors historique). */
      majUi: function (patch) {
        ui = Object.assign({}, ui, patch);
        notifier('ui');
      },

      /** Affiche un message dans la barre d'état. */
      signaler: function (texte, niveau) {
        ui = Object.assign({}, ui, { message: texte ? { texte: String(texte), niveau: niveau || 'info' } : null });
        notifier('ui');
      },

      /** Abonne `cb({raison: 'doc'|'ui', doc, ui})` ; renvoie une fonction de désabonnement. */
      abonner: function (cb) {
        abonnes.push(cb);
        return function () { abonnes = abonnes.filter(function (x) { return x !== cb; }); };
      }
    };
    return etat;
  }

  PM.etat = { creer: creer, MAX_HISTORIQUE: MAX_HISTORIQUE };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.etat;
})();
