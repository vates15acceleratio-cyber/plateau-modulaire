/*
 * bibliotheque.js : colonne gauche, bibliothèque des modèles de tuile (commune aux deux onglets).
 * Vignettes SVG, filtre par gabarit (centrale, bord, coin), exemplaires restants, +/− sur le nombre d'exemplaires,
 * badge « incomplet » ; un modèle dessiné pour l'autre grille est grisé, badgé et non posable. Clic = ouvrir dans l'éditeur ; glisser = poser sur le plateau
 * (le glissement est confié à PM.assemblage.demarrerGlissement) ; bouton « Poser » = pose en deux clics.
 * Les fonctions de calcul (vignettesBibliotheque, ...) n'accèdent pas au DOM : testables sous Node.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  var GABARITS = ['centrale', 'bord', 'coin'];
  var TITRES_GABARIT = { centrale: 'Centrales', bord: 'Bords', coin: 'Coins' };
  /** Distance (px) au-delà de laquelle un appui devient un glissement. */
  var SEUIL_GLISSEMENT = 5;

  function echapper(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** « 4×4 » à partir de l'identifiant de grille « 4x4 ». */
  function nomGrille(id) { return String(id).replace('x', '×'); }

  /**
   * Le modèle est-il dessiné pour une autre grille que celle du document ? (un document = une grille : pas de mélange)
   * Renvoie la phrase de refus (une phrase), ou '' si le modèle va sur ce plateau. Un modèle sans grille va partout.
   */
  function phraseAutreGrille(modele, doc) {
    if (!modele || typeof modele !== 'object' || modele.grille === undefined) return '';
    var F = PM.modele.formatDuDocument(doc);
    if (modele.grille === F.id) return '';
    return 'Cette tuile est dessinée pour la grille ' + nomGrille(modele.grille) + ' : elle ne se pose pas sur un plateau ' + nomGrille(F.id) + '.';
  }

  function nbPosees(doc, id) {
    return doc.plateau.tuiles.filter(function (t) { return t && t.modeleId === id; }).length;
  }

  /**
   * Données d'affichage de la bibliothèque (pure) : groupes par gabarit, filtrés.
   * filtre : 'tous' | un gabarit. Renvoie [{gabarit, titre, modeles: [{id, nom, gabarit, exemplaires,
   * posees, restants, complet, posable, alertes}]}] (groupes vides omis). Les gabarits inconnus vont dans « Autres ».
   */
  function vignettesBibliotheque(doc, filtre) {
    var M = PM.modele, groupes = {}, ordre = GABARITS.concat(['autre']);
    var p = doc && doc.plateau;
    // document mal formé : refus explicite (Error lisible), jamais un TypeError natif
    if (!p || typeof p !== 'object' || !Array.isArray(p.tuiles)) throw new Error('Document invalide : plateau absent ou mal formé.');
    ordre.forEach(function (r) { groupes[r] = []; });
    var F = M.formatDuDocument(doc);
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) {
      if (!m || typeof m !== 'object') return;
      var gabarit = GABARITS.indexOf(m.gabarit) >= 0 ? m.gabarit : 'autre';
      var v = M.validerModele(m, F);
      var restants = M.exemplairesRestants(doc, m.id);
      groupes[gabarit].push({
        id: m.id, nom: m.nom || '', gabarit: gabarit, exemplaires: m.exemplaires, posees: nbPosees(doc, m.id),
        restants: restants, complet: v.complet, posable: v.complet && restants > 0, alertes: v.alertes.length,
        autreGrille: phraseAutreGrille(m, doc) !== ''
      });
    });
    return ordre.filter(function (r) {
      return groupes[r].length && (!filtre || filtre === 'tous' || filtre === r);
    }).map(function (r) {
      return { gabarit: r, titre: TITRES_GABARIT[r] || 'Autres', modeles: groupes[r] };
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
            GABARITS.map(function (r) { return '<option value="' + r + '">' + TITRES_GABARIT[r] + '</option>'; }).join('') +
          '</select>' +
        '</label>' +
        '<p class="pm-biblio-aide">Clic : ouvrir dans l\'éditeur. Glisser ou « Poser » : placer sur le plateau.</p>' +
      '</div>' +
      '<div class="pm-biblio-liste" data-role="liste"></div>';
    var liste = conteneur.querySelector('[data-role="liste"]');
    var selFiltre = conteneur.querySelector('[data-role="filtre"]');

    selFiltre.addEventListener('change', function () { filtre = selFiltre.value; dessiner(); });

    function vignetteHtml(v, ui) {
      var m = PM.modele.modeleParId(etat.doc(), v.id), F = PM.modele.formatDuDocument(etat.doc());
      // vignette à l'échelle de la grille du modèle (100 mm en 5×5, 120 mm en 4×4), pour ne pas rogner un modèle d'une autre grille
      if (v.autreGrille && PM.geometrie.FORMATS.indexOf(m.grille) >= 0) F = PM.geometrie.format(m.grille);
      var t = F.COTE + 6;
      var svg = '<svg class="pm-biblio-svg" viewBox="-3 -3 ' + t + ' ' + t + '" aria-hidden="true">' +
        PM.rendu.contenuTuile(m, { rot: 0, format: F }) + '</svg>';
      var classes = ['pm-biblio-vignette'];
      if (!v.complet) classes.push('pm-biblio-incomplet');
      if (v.autreGrille) classes.push('pm-biblio-autre-grille');
      if (v.restants <= 0) classes.push('pm-biblio-epuise');
      if (ui.modeleSelectionne === v.id) classes.push('pm-biblio-selection');
      if (ui.aPoser === v.id) classes.push('pm-biblio-arme');
      var id = echapper(v.id);
      return '<li class="' + classes.join(' ') + '" data-vignette="' + id + '">' +
        '<button type="button" class="pm-biblio-ouvrir" data-action="ouvrir" data-id="' + id + '"' +
          ' title="' + (v.autreGrille ? echapper(phraseAutreGrille(m, etat.doc())) : v.complet ? 'Ouvrir dans l\'éditeur ; glisser pour poser sur le plateau' : 'Modèle incomplet : ouvrir dans l\'éditeur (non posable)') + '"' +
          (ui.modeleSelectionne === v.id ? ' aria-current="true"' : '') + '>' +
          '<span class="pm-biblio-image' + (v.complet ? ' pm-biblio-glissable' : '') + '" data-glisser="' + id + '">' + svg + '</span>' +
          '<span class="pm-biblio-texte">' +
            '<span class="pm-biblio-id">' + id + '</span>' +
            '<span class="pm-biblio-nom">' + echapper(v.nom) + '</span>' +
            (v.autreGrille ? '<span class="pm-biblio-badge">grille ' + echapper(nomGrille(m.grille)) + '</span>' : v.complet ? '' : '<span class="pm-biblio-badge">incomplet</span>') +
            (v.complet && v.alertes ? '<span class="pm-biblio-badge" title="Alertes de l’éditeur (par exemple règles R1 à R4)">' + v.alertes + ' alerte' + (v.alertes > 1 ? 's' : '') + '</span>' : '') +
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
      var autre = phraseAutreGrille(m, etat.doc());
      if (autre) { etat.signaler(autre, 'erreur'); return; } // modèle d'une autre grille : non glissable
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
    phraseAutreGrille: phraseAutreGrille,
    SEUIL_GLISSEMENT: SEUIL_GLISSEMENT,
    monter: monter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.bibliotheque;
})();
