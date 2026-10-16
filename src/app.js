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
      c.innerHTML = '';
      var vide = document.createElement('p');
      vide.className = 'pm-module-absent';
      vide.textContent = 'Module « ' + nom + ' » pas encore disponible.';
      c.appendChild(vide);
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
   * au lieu d'être écrasée en silence (docs/archives/11-revue-interface.md, I2).
   */
  function documentInitial() {
    var S = PM.sauvegarde, neuf = PM.catalogue ? PM.catalogue.nouveauDocument() : PM.modele.nouveauDocument();
    if (!stockageDisponible()) return { doc: neuf, message: 'Sauvegarde automatique indisponible dans ce navigateur : pensez à Enregistrer votre travail.', niveau: 'alerte' };
    if (S && typeof S.restaurerAutosave === 'function') {
      var r = S.restaurerAutosave();
      if (r && r.ok && r.doc) {
        // Document de la version 1 : la phrase de migration (première alerte de depuisJSON) est dite au démarrage
        var migration = (r.alertes || []).filter(function (a) { return a.code === 'migration_v1'; })[0];
        return migration ? { doc: r.doc, message: 'Travail précédent repris. ' + migration.message, niveau: 'alerte' }
          : { doc: r.doc, message: 'Travail précédent repris (sauvegarde automatique).', niveau: 'info' };
      }
      var brut = null;
      try { brut = window.localStorage.getItem(S.CLE_AUTOSAVE); } catch (e) { brut = null; }
      if (brut) {
        try { window.localStorage.setItem(S.CLE_AUTOSAVE + '-illisible', brut); } catch (e) { /* rien de plus à faire */ }
        return { doc: neuf, message: 'La sauvegarde automatique précédente est illisible : elle a été mise de côté (« ' + S.CLE_AUTOSAVE + '-illisible ») et un plateau neuf est ouvert.', niveau: 'alerte' };
      }
    }
    return { doc: neuf, message: 'Cliquez une tuile de la bibliothèque puis une case du plateau, ou glissez-la.', niveau: 'info' };
  }

  /**
   * Boîte de dialogue commune (export, rapport d'équilibre, plateau aléatoire).
   * PM.dialogue.ouvrir(titre) → élément de contenu vide à remplir ; PM.dialogue.fermer().
   * Un seul contenu à la fois ; Échap ou ✕ ferme.
   */
  PM.dialogue = {
    ouvrir: function (titre) {
      var d = $('dialogue'), c = $('dialogue-contenu');
      if (!d || !c) throw new Error('Boîte de dialogue absente de la page.');
      $('dialogue-titre').textContent = titre || '';
      c.innerHTML = '';
      if (typeof d.showModal === 'function') { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
      return c;
    },
    fermer: function () {
      var d = $('dialogue');
      if (!d) return;
      if (typeof d.close === 'function') { if (d.open) d.close(); } else d.removeAttribute('open');
    }
  };

  /** Bibliothèque de la version 1 (modèles A1 / A2) : message de démarrage. */
  function avisBibliotheque(doc) {
    if (!PM.sauvegarde || typeof PM.sauvegarde.bibliothequeVersion1 !== 'function' || !PM.sauvegarde.bibliothequeVersion1(doc)) return '';
    return ' Bibliothèque de la version 1 (modèles A1 / A2) conservée et convertie : le catalogue de la version 2 vous est proposé.';
  }

  /**
   * Propose de remplacer une bibliothèque de la version 1 par le catalogue de la version 2.
   * Le remplacement vide le plateau ; il est annulable (Ctrl+Z).
   */
  function proposerCatalogueV2(etat) {
    if (!PM.catalogue || !PM.dialogue || !$('dialogue')) return;
    var c = PM.dialogue.ouvrir('Catalogue de la version 2');
    var p = document.createElement('p');
    p.textContent = 'Ce document utilise encore les tuiles de la version 1, converties. Le catalogue de la version 2 (cases d’apparition sur tout le pourtour, raccourcis de coin, 3 cases entre villes) est disponible. Le charger remplace la bibliothèque et vide le plateau ; Ctrl+Z permet de revenir en arrière.';
    var oui = document.createElement('button');
    oui.type = 'button';
    oui.textContent = 'Charger le catalogue v2';
    oui.addEventListener('click', function () {
      etat.remplacer(PM.catalogue.nouveauDocument(), 'catalogue de la version 2');
      PM.dialogue.fermer();
      etat.signaler('Catalogue de la version 2 chargé (Ctrl+Z pour revenir à l’ancien document).', 'info');
    });
    var non = document.createElement('button');
    non.type = 'button';
    non.textContent = 'Garder mes tuiles';
    non.addEventListener('click', function () { PM.dialogue.fermer(); });
    var actions = document.createElement('p');
    actions.appendChild(oui);
    actions.appendChild(document.createTextNode(' '));
    actions.appendChild(non);
    c.appendChild(p);
    c.appendChild(actions);
  }

  /* ------------------------------------------------------------------ */
  /* Nouveau plateau : choix de la grille (un document = un format)       */
  /* ------------------------------------------------------------------ */

  /** Libellés d'une grille tirés de ses cotes : { id, nom: '5×5', dimensions: '50 × 50 cm', tuile: '10 cm' }. */
  function descriptionGrille(id) {
    var F = PM.geometrie.format(id), nc = F.GRILLE.colonnes, nl = F.GRILLE.lignes;
    return { id: id, nom: nc + '×' + nl, dimensions: (nc * F.COTE / 10) + ' × ' + (nl * F.COTE / 10) + ' cm', tuile: (F.COTE / 10) + ' cm' };
  }

  /** Texte court de l'indicateur de la barre : « Grille 5×5 · 50 × 50 cm ». */
  function libelleIndicateur(doc) {
    var d = descriptionGrille(PM.modele.formatDuDocument(doc).id);
    return 'Grille ' + d.nom + ' · ' + d.dimensions;
  }

  /**
   * Document neuf de la grille demandée, fourni par le catalogue. Renvoie { ok, doc } ou { ok: false, raison }.
   * Le catalogue peut ne pas encore connaître cette grille (il renverrait alors un document 4×4, ou lèverait
   * une erreur) : on vérifie que le document et tous ses modèles sont bien de la grille demandée.
   */
  function documentPourGrille(grille) {
    if (!PM.geometrie || PM.geometrie.FORMATS.indexOf(grille) < 0) return { ok: false, raison: 'Grille inconnue : ' + String(grille) + '.' };
    var nom = descriptionGrille(grille).nom;
    var indispo = { ok: false, raison: 'Le catalogue de tuiles ' + nom + ' n’est pas encore disponible : le plateau actuel est conservé.' };
    if (!PM.catalogue || typeof PM.catalogue.nouveauDocument !== 'function') return indispo;
    var doc;
    try { doc = PM.catalogue.nouveauDocument(grille); } catch (e) { return indispo; }
    if (!doc || typeof doc !== 'object' || !Array.isArray(doc.modeles) || !doc.plateau) return indispo;
    if ((doc.grille || PM.geometrie.FORMAT_DEFAUT) !== grille) return indispo;
    if (doc.modeles.some(function (m) { return m && m.grille !== undefined && m.grille !== grille; })) return indispo;
    return { ok: true, doc: doc };
  }

  /** Boîte de dialogue « Nouveau » : choix 4×4 / 5×5, avertissement, bouton Créer. */
  function ouvrirDialogueNouveau(etat) {
    var c = PM.dialogue.ouvrir('Nouveau plateau');
    function el(tag, classe, texte) {
      var e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    }
    var racine = el('div', 'pm-nouveau');
    var jeu = el('fieldset', 'pm-nouveau-choix');
    jeu.appendChild(el('legend', 'pm-nouveau-legende', 'Grille du nouveau plateau (un document garde sa grille)'));
    var radios = [];
    PM.geometrie.FORMATS.forEach(function (id, k) {
      var d = descriptionGrille(id), ligne = el('label', 'pm-nouveau-option');
      var r = el('input'); r.type = 'radio'; r.name = 'pm-nouveau-grille'; r.value = id; r.checked = k === 0;
      ligne.appendChild(r);
      ligne.appendChild(el('span', 'pm-nouveau-nom', d.nom));
      ligne.appendChild(el('span', 'pm-nouveau-detail', d.dimensions + ', tuiles de ' + d.tuile + (id === '5x5' ? ', rangée centrale neutre' : '')));
      jeu.appendChild(ligne);
      radios.push(r);
    });
    racine.appendChild(jeu);
    var avertissement = el('p', 'pm-nouveau-avertissement', 'Le plateau et la bibliothèque actuels seront remplacés par ceux du nouveau plateau (Ctrl+Z pour revenir).');
    avertissement.setAttribute('role', 'note');
    racine.appendChild(avertissement);
    var erreur = el('p', 'pm-nouveau-erreur'); erreur.setAttribute('role', 'alert'); erreur.hidden = true;
    racine.appendChild(erreur);
    var actions = el('p', 'pm-nouveau-actions');
    var creer = el('button', 'pm-nouveau-creer', 'Créer'); creer.type = 'button';
    var annuler = el('button', 'pm-nouveau-annuler', 'Annuler'); annuler.type = 'button';
    actions.appendChild(creer); actions.appendChild(document.createTextNode(' ')); actions.appendChild(annuler);
    racine.appendChild(actions);
    c.appendChild(racine);

    annuler.addEventListener('click', function () { PM.dialogue.fermer(); });
    creer.addEventListener('click', function () {
      var choix = radios.filter(function (r) { return r.checked; })[0];
      var r = documentPourGrille(choix ? choix.value : PM.geometrie.FORMAT_DEFAUT);
      if (!r.ok) { erreur.textContent = r.raison; erreur.hidden = false; etat.signaler(r.raison, 'erreur'); return; }
      etat.remplacer(r.doc, 'nouveau plateau ' + descriptionGrille(r.doc.grille || PM.geometrie.FORMAT_DEFAUT).nom);
      etat.majUi({ aPoser: null, onglet: 'plateau' }); // un même identifiant de modèle peut exister dans l'autre grille
      PM.dialogue.fermer();
      etat.signaler('Nouveau plateau ' + descriptionGrille(r.doc.grille || PM.geometrie.FORMAT_DEFAUT).nom + ' créé (Ctrl+Z pour revenir au plateau précédent).', 'info');
    });
    radios[0].focus();
    return racine;
  }

  function demarrer() {
    var init = documentInitial();
    var avis = avisBibliotheque(init.doc);
    if (avis) { init.message += avis; if (init.niveau === 'info') init.niveau = 'alerte'; }
    var etat = PM.etat.creer(init.doc);
    PM.app = { etat: etat }; // accès pour le débogage dans la console

    // Onglets
    var boutonsOnglets = document.querySelectorAll('[data-onglet]');
    boutonsOnglets.forEach(function (b) {
      b.addEventListener('click', function () { etat.majUi({ onglet: b.getAttribute('data-onglet') }); });
    });

    // Barre du haut
    if ($('btn-nouveau')) $('btn-nouveau').addEventListener('click', function () { ouvrirDialogueNouveau(etat); });
    $('btn-annuler').addEventListener('click', function () { etat.annuler(); });
    $('btn-retablir').addEventListener('click', function () { etat.retablir(); });
    $('btn-enregistrer').addEventListener('click', enregistrer);
    $('btn-ouvrir').addEventListener('click', ouvrir);
    $('pastille-alertes').addEventListener('click', function () { etat.majUi({ onglet: 'plateau' }); });
    if ($('dialogue-fermer')) $('dialogue-fermer').addEventListener('click', function () { PM.dialogue.fermer(); });
    if (PM.exportation && typeof PM.exportation.ouvrir === 'function') {
      $('btn-exporter').disabled = false;
      $('btn-exporter').addEventListener('click', function () { PM.exportation.ouvrir(etat); });
    }

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
        var migration = r.migre && r.alertes && r.alertes.length ? ' ' + r.alertes[0].message : '';
        etat.signaler('Fichier ouvert (Ctrl+Z pour revenir au plateau précédent)' + (r.alertes && r.alertes.length ? ' (' + r.alertes.length + ' alerte(s))' : '') + '.' + migration, r.alertes && r.alertes.length ? 'alerte' : 'info');
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
      document.body.setAttribute('data-vue', ui.onglet); // sert à la mise en page de la carte « Commandes »
      boutonsOnglets.forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-onglet') === ui.onglet)); });
      document.querySelectorAll('[data-ecran]').forEach(function (s) { s.hidden = s.getAttribute('data-ecran') !== ui.onglet; });
      if ($('indicateur-grille')) {
        try { $('indicateur-grille').textContent = libelleIndicateur(etat.doc()); } catch (e) { $('indicateur-grille').textContent = ''; }
      }
      $('btn-annuler').disabled = !etat.peutAnnuler();
      $('btn-retablir').disabled = !etat.peutRetablir();
      var be = $('barre-etat');
      be.textContent = ui.message ? ui.message.texte : '';
      be.setAttribute('data-niveau', ui.message ? ui.message.niveau : 'info');
      var past = $('pastille-alertes');
      if (PM.controles && typeof PM.controles.calculer === 'function') {
        var r = PM.controles.calculer(etat.doc());
        var nErr = r.erreurs ? r.erreurs.length : 0, n = nErr + (r.alertes ? r.alertes.length : 0);
        var incomplet = (r.compteurs || []).some(function (c) { return c.etat !== 'ok'; });
        past.hidden = false;
        past.textContent = n ? n + ' alerte' + (n > 1 ? 's' : '') + (nErr ? ' dont ' + nErr + ' erreur' + (nErr > 1 ? 's' : '') : '') : (incomplet ? 'Plateau incomplet' : 'Plateau complet');
        past.classList.toggle('pm-erreur', nErr > 0);
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
    monterModule('aide', 'aide', etat);

    // À la fermeture de la page, la sauvegarde automatique différée est écrite tout de suite.
    window.addEventListener('pagehide', function () {
      if (PM.sauvegarde && typeof PM.sauvegarde.ecrireMaintenant === 'function') PM.sauvegarde.ecrireMaintenant(etat.doc());
    });

    rafraichir();
    etat.signaler(init.message, init.niveau);
    if (avis) proposerCatalogueV2(etat);
  }

  PM.nouveau = { descriptionGrille: descriptionGrille, libelleIndicateur: libelleIndicateur, documentPourGrille: documentPourGrille, ouvrirDialogue: ouvrirDialogueNouveau };

  if (typeof document === 'undefined') return; // chargement sous Node (tests) : pas de coquille à démarrer
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();

if (typeof module !== 'undefined' && module.exports) module.exports = PM.nouveau;
