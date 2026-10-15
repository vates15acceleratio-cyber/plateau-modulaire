/*
 * bibliotheque.js : colonne gauche, bibliothèque des modèles de tuile (commune aux deux onglets).
 * Vignettes SVG, filtre par rôle, exemplaires restants, +/− sur le nombre d'exemplaires,
 * badge « incomplet ». Clic = ouvrir dans l'éditeur ; glisser = poser sur le plateau
 * (le glissement est confié à PM.assemblage.demarrerGlissement) ; bouton « Poser » = pose en deux clics.
 * Les fonctions de calcul (vignettesBibliotheque, ...) n'accèdent pas au DOM : testables sous Node.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  var ROLES = ['centrale', 'coin', 'bord', 'apparition'];
  var TITRES_ROLE = { centrale: 'Centrales', coin: 'Coins', bord: 'Bords', apparition: 'Apparitions' };
  /** Distance (px) au-delà de laquelle un appui devient un glissement. */
  var SEUIL_GLISSEMENT = 5;

  function echapper(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function nbPosees(doc, id) {
    return doc.plateau.tuiles.filter(function (t) { return t && t.modeleId === id; }).length;
  }

  /**
   * Données d'affichage de la bibliothèque (pure) : groupes par rôle, filtrés.
   * filtre : 'tous' | un rôle. Renvoie [{role, titre, modeles: [{id, nom, role, exemplaires,
   * posees, restants, complet, posable}]}] (groupes vides omis). Les rôles inconnus vont dans « Autres ».
   */
  function vignettesBibliotheque(doc, filtre) {
    var M = PM.modele, groupes = {}, ordre = ROLES.concat(['autre']);
    var p = doc && doc.plateau;
    // document mal formé : refus explicite (Error lisible), jamais un TypeError natif
    if (!p || typeof p !== 'object' || !Array.isArray(p.tuiles)) throw new Error('Document invalide : plateau absent ou mal formé.');
    ordre.forEach(function (r) { groupes[r] = []; });
    var F = M.formatDuDocument(doc);
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      var role = ROLES.indexOf(m.role) >= 0 ? m.role : 'autre';
      var complet = M.validerModele(m, F).complet;
      var restants = M.exemplairesRestants(doc, m.id);
      groupes[role].push({
        id: m.id, nom: m.nom || '', role: role, exemplaires: m.exemplaires, posees: nbPosees(doc, m.id),
        restants: restants, complet: complet, posable: complet && restants > 0
      });
    });
    return ordre.filter(function (r) {
      return groupes[r].length && (!filtre || filtre === 'tous' || filtre === r);
    }).map(function (r) {
      return { role: r, titre: TITRES_ROLE[r] || 'Autres', modeles: groupes[r] };
    });
  }

  /** Libellé du stock (pure) : « ×2 restants », « ×1 restant », « ×0 restant ». */
  function libelleRestants(n) {
    return '×' + n + ' restant' + (Math.abs(n) > 1 ? 's' : '');
  }

  /* ------------------------------------------------------------------ */
  /* Montage (DOM)                                                       */
  /* ------------------------------------------------------------------ */

  function monter(conteneur, etat) {
    var filtre = 'tous';
    conteneur.classList.add('pm-biblio');
    conteneur.innerHTML =
      '<div class="pm-biblio-entete">' +
        '<h2 class="pm-biblio-titre">Bibliothèque</h2>' +
        '<label class="pm-biblio-filtre">Filtre ' +
          '<select data-role="filtre">' +
            '<option value="tous">Tous</option>' +
            ROLES.map(function (r) { return '<option value="' + r + '">' + TITRES_ROLE[r] + '</option>'; }).join('') +
          '</select>' +
        '</label>' +
        '<p class="pm-biblio-aide">Clic : ouvrir dans l\'éditeur. Glisser ou « Poser » : placer sur le plateau.</p>' +
      '</div>' +
      '<div class="pm-biblio-liste" data-role="liste"></div>';
    var liste = conteneur.querySelector('[data-role="liste"]');
    var selFiltre = conteneur.querySelector('[data-role="filtre"]');

    selFiltre.addEventListener('change', function () { filtre = selFiltre.value; dessiner(); });

    function vignetteHtml(v, ui) {
      var m = PM.modele.modeleParId(etat.doc(), v.id), F = PM.modele.formatDuDocument(etat.doc()), t = F.COTE + 6;
      var svg = '<svg class="pm-biblio-svg" viewBox="-3 -3 ' + t + ' ' + t + '" aria-hidden="true">' +
        PM.rendu.contenuTuile(m, { rot: 0, joueur: v.role === 'apparition' ? 1 : null, format: F }) + '</svg>';
      var classes = ['pm-biblio-vignette'];
      if (!v.complet) classes.push('pm-biblio-incomplet');
      if (v.restants <= 0) classes.push('pm-biblio-epuise');
      if (ui.modeleSelectionne === v.id) classes.push('pm-biblio-selection');
      if (ui.aPoser === v.id) classes.push('pm-biblio-arme');
      var id = echapper(v.id);
      return '<li class="' + classes.join(' ') + '" data-vignette="' + id + '">' +
        '<button type="button" class="pm-biblio-ouvrir" data-action="ouvrir" data-id="' + id + '"' +
          ' title="' + (v.complet ? 'Ouvrir dans l\'éditeur ; glisser pour poser sur le plateau' : 'Modèle incomplet : ouvrir dans l\'éditeur (non posable)') + '"' +
          (ui.modeleSelectionne === v.id ? ' aria-current="true"' : '') + '>' +
          '<span class="pm-biblio-image' + (v.complet ? ' pm-biblio-glissable' : '') + '" data-glisser="' + id + '">' + svg + '</span>' +
          '<span class="pm-biblio-texte">' +
            '<span class="pm-biblio-id">' + id + '</span>' +
            '<span class="pm-biblio-nom">' + echapper(v.nom) + '</span>' +
            (v.complet ? '' : '<span class="pm-biblio-badge">incomplet</span>') +
          '</span>' +
        '</button>' +
        '<div class="pm-biblio-stock">' +
          '<button type="button" class="pm-biblio-moins" data-action="moins" data-id="' + id + '"' +
            (v.exemplaires <= 0 ? ' disabled' : '') + ' aria-label="Un exemplaire de moins (' + id + ')">−</button>' +
          '<span class="pm-biblio-restants" title="' + v.exemplaires + ' exemplaire(s), ' + v.posees + ' posé(s)">' +
            libelleRestants(v.restants) + '</span>' +
          '<button type="button" class="pm-biblio-plus" data-action="plus" data-id="' + id + '"' +
            ' aria-label="Un exemplaire de plus (' + id + ')">+</button>' +
          '<button type="button" class="pm-biblio-poser" data-action="poser" data-id="' + id + '"' +
            (v.posable ? '' : ' disabled') + ' aria-pressed="' + (ui.aPoser === v.id) + '"' +
            ' title="Poser en deux clics : choisir ce modèle puis cliquer une cellule du plateau">Poser</button>' +
        '</div>' +
      '</li>';
    }

    function dessiner() {
      // Conserve le focus clavier à travers le redessin
      var actif = document.activeElement, cleFocus = null;
      if (actif && liste.contains(actif)) cleFocus = actif.getAttribute('data-action') + '|' + actif.getAttribute('data-id');
      var ui = etat.ui(), groupes = vignettesBibliotheque(etat.doc(), filtre);
      liste.innerHTML = groupes.length ? groupes.map(function (g) {
        return '<section class="pm-biblio-groupe"><h3 class="pm-biblio-groupe-titre">' + echapper(g.titre) +
          ' <span class="pm-biblio-nombre">(' + g.modeles.length + ')</span></h3><ul class="pm-biblio-vignettes">' +
          g.modeles.map(function (v) { return vignetteHtml(v, ui); }).join('') + '</ul></section>';
      }).join('') : '<p class="pm-biblio-vide">Aucun modèle.</p>';
      if (cleFocus) {
        var p = cleFocus.split('|');
        var el = Array.prototype.find.call(liste.querySelectorAll('[data-action]'), function (b) {
          return b.getAttribute('data-action') === p[0] && b.getAttribute('data-id') === p[1];
        });
        if (el && !el.disabled) el.focus();
      }
    }

    // Glissement depuis une vignette : seuil de quelques pixels pour le distinguer d'un clic.
    var appui = null, glisse = false, finGlissement = 0;
    liste.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var zone = ev.target.closest('[data-glisser]');
      if (!zone) return;
      var id = zone.getAttribute('data-glisser');
      var m = PM.modele.modeleParId(etat.doc(), id);
      if (!m) return;
      if (!PM.modele.validerModele(m, PM.modele.formatDuDocument(etat.doc())).complet) { // incomplet : non glissable, et on dit pourquoi (recette B2)
        etat.signaler('Ce modèle est incomplet : complétez-le dans l’éditeur avant de le poser.', 'erreur');
        return;
      }
      appui = { id: id, x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId };
    });
    document.addEventListener('pointermove', function (ev) {
      if (!appui || ev.pointerId !== appui.pointerId) return;
      if (Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) < SEUIL_GLISSEMENT) return;
      var id = appui.id;
      appui = null;
      if (PM.assemblage && typeof PM.assemblage.demarrerGlissement === 'function' && PM.assemblage.demarrerGlissement(id, ev)) {
        glisse = true; // le clic qui suit le lâcher ne doit pas ouvrir l'éditeur
      }
    });
    document.addEventListener('pointerup', function () {
      appui = null;
      if (glisse) { glisse = false; finGlissement = Date.now(); }
    });
    document.addEventListener('pointercancel', function () { appui = null; });

    liste.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-action]');
      if (!b || b.disabled) return;
      // clic souris émis juste après le lâcher d'un glissement : ignoré (le clavier, detail = 0, ne l'est jamais)
      if (ev.detail > 0 && Date.now() - finGlissement < 400 && b.getAttribute('data-action') === 'ouvrir') return;
      var id = b.getAttribute('data-id'), action = b.getAttribute('data-action');
      var M = PM.modele;
      if (action === 'ouvrir') {
        etat.majUi({ modeleSelectionne: id, onglet: 'tuiles', aPoser: null });
      } else if (action === 'plus' || action === 'moins') {
        var m = M.modeleParId(etat.doc(), id);
        if (!m) return;
        var n = m.exemplaires + (action === 'plus' ? 1 : -1);
        var r = etat.appliquer(function (d) { return M.changerExemplaires(d, id, n); },
          'exemplaires de ' + id);
        if (r.ok) etat.signaler('« ' + id + ' » : ' + n + ' exemplaire' + (n > 1 ? 's' : '') + '.', 'info');
      } else if (action === 'poser') {
        var arme = etat.ui().aPoser === id ? null : id;
        etat.majUi({ aPoser: arme, onglet: 'plateau' });
        if (arme) etat.signaler('Cliquez une cellule libre du plateau pour poser « ' + id + ' » (Échap pour annuler).', 'info');
      }
    });

    etat.abonner(dessiner);
    dessiner();
  }

  PM.bibliotheque = {
    vignettesBibliotheque: vignettesBibliotheque,
    libelleRestants: libelleRestants,
    SEUIL_GLISSEMENT: SEUIL_GLISSEMENT,
    monter: monter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.bibliotheque;
})();
