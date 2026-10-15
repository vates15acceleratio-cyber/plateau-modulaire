/*
 * app.js : colle les écrans entre eux (propriété de l'orchestrateur).
 * Crée l'état, monte les modules présents, gère la barre du haut, les onglets,
 * les raccourcis globaux et la barre d'état. Seul fichier qui touche à la coquille de index.html.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }

  /** Monte `PM[nom].monter(conteneur, etat)` si le module est chargé ; sinon affiche un message discret. */
  function monterModule(nom, idConteneur, etat) {
    var c = $(idConteneur);
    if (!c) return;
    if (PM[nom] && typeof PM[nom].monter === 'function') {
      try { PM[nom].monter(c, etat); } catch (e) {
        console.error(e);
        c.innerHTML = '<p class="pm-module-absent">Erreur au chargement du module « ' + nom + ' » : ' + (e && e.message) + '</p>';
      }
    } else {
      c.innerHTML = '<p class="pm-module-absent">Module « ' + nom + ' » pas encore disponible.</p>';
    }
  }

  function documentInitial() {
    var S = PM.sauvegarde;
    if (S && typeof S.restaurerAutosave === 'function') {
      var r = S.restaurerAutosave();
      if (r && r.ok && r.doc) return { doc: r.doc, repris: true };
    }
    return { doc: PM.catalogue ? PM.catalogue.nouveauDocument() : PM.modele.nouveauDocument(), repris: false };
  }

  function demarrer() {
    var init = documentInitial();
    var etat = PM.etat.creer(init.doc);
    PM.app = { etat: etat }; // accès pour le débogage dans la console

    // Onglets
    var boutonsOnglets = document.querySelectorAll('[data-onglet]');
    boutonsOnglets.forEach(function (b) {
      b.addEventListener('click', function () { etat.majUi({ onglet: b.getAttribute('data-onglet') }); });
    });

    // Barre du haut
    $('btn-annuler').addEventListener('click', function () { etat.annuler(); });
    $('btn-retablir').addEventListener('click', function () { etat.retablir(); });
    $('btn-enregistrer').addEventListener('click', enregistrer);
    $('btn-ouvrir').addEventListener('click', ouvrir);
    $('pastille-alertes').addEventListener('click', function () { etat.majUi({ onglet: 'plateau' }); });

    function enregistrer() {
      var S = PM.sauvegarde;
      if (!S) { etat.signaler('La sauvegarde n\'est pas encore disponible.', 'alerte'); return; }
      try { S.telecharger(etat.doc(), 'plateau-modulaire.json'); etat.signaler('Fichier enregistré.', 'info'); } catch (e) { etat.signaler(e.message, 'erreur'); }
    }

    function ouvrir() {
      var S = PM.sauvegarde;
      if (!S) { etat.signaler('L\'ouverture n\'est pas encore disponible.', 'alerte'); return; }
      S.ouvrirFichier().then(function (r) {
        if (!r) return; // annulé
        if (!r.ok) { etat.signaler(r.erreurs && r.erreurs.length ? r.erreurs[0].message : 'Fichier illisible.', 'erreur'); return; }
        etat.remplacer(r.doc);
        etat.signaler('Fichier ouvert' + (r.alertes && r.alertes.length ? ' (' + r.alertes.length + ' alerte(s))' : '') + '.', r.alertes && r.alertes.length ? 'alerte' : 'info');
      }, function (e) { etat.signaler(e && e.message ? e.message : 'Ouverture impossible.', 'erreur'); });
    }

    // Raccourcis globaux (les modules gèrent les leurs : R, Suppr, 1-5…)
    document.addEventListener('keydown', function (ev) {
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      var k = ev.key.toLowerCase();
      if ((ev.ctrlKey || ev.metaKey) && k === 'z' && !ev.shiftKey) { ev.preventDefault(); etat.annuler(); }
      else if ((ev.ctrlKey || ev.metaKey) && (k === 'y' || (k === 'z' && ev.shiftKey))) { ev.preventDefault(); etat.retablir(); }
      else if ((ev.ctrlKey || ev.metaKey) && k === 's') { ev.preventDefault(); enregistrer(); }
    });

    // Mise à jour de la coquille
    function rafraichir(evt) {
      var ui = etat.ui();
      boutonsOnglets.forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-onglet') === ui.onglet)); });
      document.querySelectorAll('[data-ecran]').forEach(function (s) { s.hidden = s.getAttribute('data-ecran') !== ui.onglet; });
      $('btn-annuler').disabled = !etat.peutAnnuler();
      $('btn-retablir').disabled = !etat.peutRetablir();
      var be = $('barre-etat');
      be.textContent = ui.message ? ui.message.texte : '';
      be.setAttribute('data-niveau', ui.message ? ui.message.niveau : 'info');
      var past = $('pastille-alertes');
      if (PM.controles && typeof PM.controles.calculer === 'function') {
        var r = PM.controles.calculer(etat.doc());
        var n = (r.erreurs ? r.erreurs.length : 0) + (r.alertes ? r.alertes.length : 0);
        past.hidden = false;
        past.textContent = n ? n + ' alerte' + (n > 1 ? 's' : '') : 'Plateau valide';
        past.classList.toggle('pm-ok', n === 0);
      }
      if (evt && evt.raison === 'doc' && PM.sauvegarde && typeof PM.sauvegarde.autosave === 'function') PM.sauvegarde.autosave(etat.doc());
    }
    etat.abonner(rafraichir);

    // Modules (chacun s'abonne à l'état lui-même)
    monterModule('bibliotheque', 'bibliotheque', etat);
    monterModule('assemblage', 'assemblage', etat);
    monterModule('controles', 'controles', etat);
    monterModule('editeurTuile', 'editeur', etat);

    rafraichir();
    etat.signaler(init.repris ? 'Travail précédent repris (sauvegarde automatique).' : 'Glissez une tuile de la bibliothèque vers une case du plateau.', 'info');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
