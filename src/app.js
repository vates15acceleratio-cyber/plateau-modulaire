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
        c.innerHTML = ''; var p = document.createElement('p'); p.className = 'pm-module-absent'; p.textContent = 'Erreur au chargement du module « ' + nom + ' » : ' + (e && e.message); c.appendChild(p);
      }
    } else {
      c.innerHTML = '<p class="pm-module-absent">Module « ' + nom + ' » pas encore disponible.</p>';
    }
  }

  /** Le stockage local est-il utilisable ? (indisponible dans certains navigateurs en file://, ou désactivé) */
  function stockageDisponible() {
    try {
      var cle = 'plateau-modulaire:test';
      window.localStorage.setItem(cle, '1');
      window.localStorage.removeItem(cle);
      return true;
    } catch (e) { return false; }
  }

  /**
   * Document de départ : la sauvegarde automatique si elle est lisible, sinon le catalogue.
   * Une sauvegarde présente mais illisible est mise de côté (clé « …:autosave-illisible ») et signalée,
   * au lieu d'être écrasée en silence (docs/11-revue-interface.md, I2).
   */
  function documentInitial() {
    var S = PM.sauvegarde, neuf = PM.catalogue ? PM.catalogue.nouveauDocument() : PM.modele.nouveauDocument();
    if (!stockageDisponible()) return { doc: neuf, message: 'Sauvegarde automatique indisponible dans ce navigateur : pensez à Enregistrer votre travail.', niveau: 'alerte' };
    if (S && typeof S.restaurerAutosave === 'function') {
      var r = S.restaurerAutosave();
      if (r && r.ok && r.doc) return { doc: r.doc, message: 'Travail précédent repris (sauvegarde automatique).', niveau: 'info' };
      var brut = null;
      try { brut = window.localStorage.getItem(S.CLE_AUTOSAVE); } catch (e) { brut = null; }
      if (brut) {
        try { window.localStorage.setItem(S.CLE_AUTOSAVE + '-illisible', brut); } catch (e) { /* rien de plus à faire */ }
        return { doc: neuf, message: 'La sauvegarde automatique précédente est illisible : elle a été mise de côté (« ' + S.CLE_AUTOSAVE + '-illisible ») et un plateau neuf est ouvert.', niveau: 'alerte' };
      }
    }
    return { doc: neuf, message: 'Glissez une tuile de la bibliothèque vers une case du plateau.', niveau: 'info' };
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
        etat.remplacer(r.doc, 'ouverture du fichier');
        etat.signaler('Fichier ouvert (Ctrl+Z pour revenir au plateau précédent)' + (r.alertes && r.alertes.length ? ' (' + r.alertes.length + ' alerte(s))' : '') + '.', r.alertes && r.alertes.length ? 'alerte' : 'info');
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
        var incomplet = (r.compteurs || []).some(function (c) { return c.etat !== 'ok'; });
        past.hidden = false;
        past.textContent = n ? n + ' alerte' + (n > 1 ? 's' : '') : (incomplet ? 'Plateau incomplet' : 'Plateau complet');
        past.classList.toggle('pm-ok', n === 0 && !incomplet);
        past.classList.toggle('pm-neutre', n === 0 && incomplet);
      }
      if (evt && evt.raison === 'doc' && PM.sauvegarde && typeof PM.sauvegarde.autosave === 'function') PM.sauvegarde.autosave(etat.doc());
    }
    etat.abonner(rafraichir);

    // Modules (chacun s'abonne à l'état lui-même)
    monterModule('bibliotheque', 'bibliotheque', etat);
    monterModule('assemblage', 'assemblage', etat);
    monterModule('controles', 'controles', etat);
    monterModule('editeurTuile', 'editeur', etat);

    // À la fermeture de la page, la sauvegarde automatique différée est écrite tout de suite.
    window.addEventListener('pagehide', function () {
      if (PM.sauvegarde && typeof PM.sauvegarde.ecrireMaintenant === 'function') PM.sauvegarde.ecrireMaintenant(etat.doc());
    });

    rafraichir();
    etat.signaler(init.message, init.niveau);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
