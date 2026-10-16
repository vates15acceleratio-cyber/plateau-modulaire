/*
 * bibliotheque.js : colonne gauche, bibliothèque des modèles de tuile (commune aux deux onglets).
 * Vignettes SVG sur plusieurs colonnes, filtre par gabarit (centrale, bord, coin), badge « incomplet » ;
 * un modèle dessiné pour l'autre grille est grisé, badgé et non posable. Les poses sont illimitées : aucun compteur.
 * Clic sur une vignette = armer la pose (puis clic sur une cellule du plateau, Échap annule) ; double-clic (ou touche E
 * sur la vignette qui a le focus) = ouvrir dans l'éditeur ; glisser = poser sur le plateau
 * (le glissement est confié à PM.assemblage.demarrerGlissement).
 * Tuiles utilisateur (modèles absents du catalogue livré) : bouton ✕ sur la vignette, ou bouton de l'éditeur, puis confirmation
 * dans la boîte de dialogue commune ; la suppression retire le modèle et ses tuiles posées en une seule entrée d'historique.
 * Les fonctions de calcul (vignettesBibliotheque, estTuileUtilisateur, ...) n'accèdent pas au DOM : testables sous Node.
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
   * posees, complet, posable, alertes, autreGrille, utilisateur}]}] (groupes vides omis). Les gabarits inconnus vont dans « Autres ».
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
      groupes[gabarit].push({
        id: m.id, nom: m.nom || '', gabarit: gabarit, exemplaires: m.exemplaires, posees: nbPosees(doc, m.id),
        complet: v.complet, posable: v.complet, alertes: v.alertes.length,
        autreGrille: phraseAutreGrille(m, doc) !== '',
        utilisateur: idsCatalogue(doc).indexOf(m.id) < 0
      });
    });
    return ordre.filter(function (r) {
      return groupes[r].length && (!filtre || filtre === 'tous' || filtre === r);
    }).map(function (r) {
      return { gabarit: r, titre: TITRES_GABARIT[r] || 'Autres', modeles: groupes[r] };
    });
  }

  /**
   * Peut-on armer la pose de ce modèle ? (pure) Renvoie '' si oui, sinon la phrase de refus (modèle d'une autre grille,
   * modèle incomplet, modèle introuvable).
   */
  function refusArmement(doc, id) {
    var m = PM.modele.modeleParId(doc, id);
    if (!m) return 'Modèle de tuile introuvable.';
    var autre = phraseAutreGrille(m, doc);
    if (autre) return autre;
    if (!PM.modele.validerModele(m, PM.modele.formatDuDocument(doc)).complet) {
      return 'Ce modèle est incomplet : complétez-le dans l’éditeur avant de le poser.';
    }
    return '';
  }

  /* ------------------------------------------------------------------ */
  /* Tuiles utilisateur : suppression                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Identifiants des modèles du catalogue livré pour la grille du document : PM.catalogue.modelesParGrille[grille] si le
   * catalogue la fournit, sinon PM.catalogue.modeles pour la grille 4×4 (repli quand le catalogue ne fournit pas modelesParGrille), sinon rien.
   * Sans catalogue chargé (tests Node qui ne le chargent pas), aucun modèle n'est du catalogue : tous sont supprimables.
   */
  function idsCatalogue(doc) {
    var C = PM.catalogue;
    if (!C) return [];
    var grille = PM.modele.formatDuDocument(doc).id, liste;
    if (C.modelesParGrille && Array.isArray(C.modelesParGrille[grille])) liste = C.modelesParGrille[grille];
    else liste = grille === '4x4' && Array.isArray(C.modeles) ? C.modeles : [];
    return liste.map(function (m) { return m && m.id; });
  }

  /** Le modèle `id` existe-t-il dans la bibliothèque sans faire partie du catalogue livré ? (pure) */
  function estTuileUtilisateur(doc, id) {
    return !!PM.modele.modeleParId(doc, id) && idsCatalogue(doc).indexOf(id) < 0;
  }

  /** Document sans les tuiles posées du modèle `id` (villes devenues invalides retirées par PM.modele.retirerTuile). */
  function sansTuilesPosees(doc, id) {
    var apres = doc;
    doc.plateau.tuiles.filter(function (t) { return t && t.modeleId === id; }).forEach(function (t) {
      apres = PM.modele.retirerTuile(apres, t.col, t.lig);
    });
    return apres;
  }

  /**
   * Effets de la suppression de la tuile `id` (pure) : { tuilesRetirees: tuiles posées retirées, villesRetirees: villes
   * retirées faute de tuiles autour }. Lève une Error si le modèle est inconnu.
   */
  function effetsSuppression(doc, id) {
    if (!PM.modele.modeleParId(doc, id)) throw new Error('Modèle de tuile introuvable.');
    var apres = sansTuilesPosees(doc, id);
    return {
      tuilesRetirees: doc.plateau.tuiles.length - apres.plateau.tuiles.length,
      villesRetirees: doc.plateau.jetons.length - apres.plateau.jetons.length
    };
  }

  /**
   * Supprime une tuile utilisateur (pure) : retire ses tuiles posées (et les villes devenues invalides) puis le modèle.
   * Lève une Error pour une tuile du catalogue livré ou inconnue. À appliquer par un seul etat.appliquer (une entrée d'historique).
   */
  function supprimerTuileUtilisateur(doc, id) {
    if (!PM.modele.modeleParId(doc, id)) throw new Error('Modèle de tuile introuvable.');
    if (!estTuileUtilisateur(doc, id)) throw new Error('La tuile « ' + id + ' » fait partie du catalogue livré : elle ne peut pas être supprimée.');
    return PM.modele.supprimerModele(sansTuilesPosees(doc, id), id);
  }

  /** Effets en toutes lettres : « 2 tuiles posées et 1 ville » (pure). */
  function phraseEffets(effets) {
    var morceaux = [];
    if (effets.tuilesRetirees) morceaux.push(effets.tuilesRetirees + ' tuile' + (effets.tuilesRetirees > 1 ? 's posées' : ' posée'));
    if (effets.villesRetirees) morceaux.push(effets.villesRetirees + ' ville' + (effets.villesRetirees > 1 ? 's' : ''));
    return morceaux.join(' et ');
  }

  /**
   * Confirmation de suppression (DOM, boîte commune PM.dialogue). Le focus part sur « Annuler » (action destructive).
   * « Supprimer » : une seule entrée d'historique, annulable par Ctrl+Z ; si la tuile était ouverte dans l'éditeur ou armée
   * pour la pose, l'éditeur revient à l'invite et l'armement est levé.
   */
  function demanderSuppression(etat, id) {
    var doc = etat.doc();
    if (!estTuileUtilisateur(doc, id)) {
      etat.signaler(PM.modele.modeleParId(doc, id) ? 'La tuile « ' + id + ' » fait partie du catalogue livré : elle ne peut pas être supprimée.' : 'Modèle de tuile introuvable.', 'erreur');
      return;
    }
    if (!PM.dialogue) { etat.signaler('Boîte de dialogue indisponible : suppression impossible.', 'erreur'); return; }
    var m = PM.modele.modeleParId(doc, id), effets = effetsSuppression(doc, id);
    var c = PM.dialogue.ouvrir('Supprimer la tuile ?');
    function el(tag, classe, texte) {
      var e = document.createElement(tag);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    }
    var racine = el('div', 'pm-biblio-confirmation');
    var p = el('p', 'pm-biblio-confirmation-texte');
    p.appendChild(document.createTextNode('Supprimer la tuile '));
    p.appendChild(el('strong', '', '« ' + (m.nom || id) + ' »'));
    p.appendChild(document.createTextNode(' (identifiant ' + id + ') de la bibliothèque ?'));
    racine.appendChild(p);
    if (effets.tuilesRetirees || effets.villesRetirees) {
      var av = el('p', 'pm-biblio-confirmation-effets', 'Seront aussi retirées du plateau : ' + phraseEffets(effets) + '.');
      av.setAttribute('role', 'note');
      racine.appendChild(av);
    }
    racine.appendChild(el('p', 'pm-biblio-confirmation-note', 'Vous pourrez annuler avec Ctrl+Z.'));
    var actions = el('p', 'pm-biblio-confirmation-actions');
    var ok = el('button', 'pm-biblio-confirmer', 'Supprimer'); ok.type = 'button';
    var non = el('button', 'pm-biblio-annuler', 'Annuler'); non.type = 'button';
    actions.appendChild(ok); actions.appendChild(document.createTextNode(' ')); actions.appendChild(non);
    racine.appendChild(actions);
    c.appendChild(racine);
    non.addEventListener('click', function () { PM.dialogue.fermer(); });
    ok.addEventListener('click', function () {
      PM.dialogue.fermer();
      var finaux;
      try { finaux = effetsSuppression(etat.doc(), id); } catch (e) { etat.signaler(e.message, 'erreur'); return; }
      var r = etat.appliquer(function (d) { return supprimerTuileUtilisateur(d, id); }, 'suppression de la tuile ' + id);
      if (!r.ok) return;
      var patch = {};
      if (etat.ui().modeleSelectionne === id) patch.modeleSelectionne = null;
      if (etat.ui().aPoser === id) patch.aPoser = null;
      if (Object.keys(patch).length) etat.majUi(patch);
      var detail = phraseEffets(finaux);
      etat.signaler('Tuile « ' + id + ' » supprimée' + (detail ? ' (' + detail + ' retirée' + (finaux.tuilesRetirees + finaux.villesRetirees > 1 ? 's' : '') + ' du plateau)' : '') + '. Ctrl+Z pour annuler.', detail ? 'alerte' : 'info');
    });
    non.focus();
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
        '<p class="pm-biblio-aide">Clic : choisir la tuile, puis cliquer une cellule du plateau (Échap annule). Glisser : poser directement. Double-clic (ou touche E) : ouvrir dans l\'éditeur. Les poses sont illimitées.</p>' +
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
      if (ui.modeleSelectionne === v.id) classes.push('pm-biblio-selection');
      if (ui.aPoser === v.id) classes.push('pm-biblio-arme');
      var id = echapper(v.id);
      var titre = v.autreGrille ? phraseAutreGrille(m, etat.doc())
        : v.complet ? 'Clic : choisir pour poser (puis cliquer une cellule). Double-clic : ouvrir dans l\'éditeur. Glisser : poser sur le plateau.'
        : 'Modèle incomplet (non posable). Double-clic : ouvrir dans l\'éditeur pour le corriger.';
      return '<li class="' + classes.join(' ') + '" data-vignette="' + id + '">' +
        '<button type="button" class="pm-biblio-ouvrir" data-action="armer" data-id="' + id + '"' +
          ' title="' + echapper(titre) + '" aria-pressed="' + (ui.aPoser === v.id) + '"' +
          (ui.modeleSelectionne === v.id ? ' aria-current="true"' : '') + '>' +
          '<span class="pm-biblio-image' + (v.complet ? ' pm-biblio-glissable' : '') + '" data-glisser="' + id + '">' + svg + '</span>' +
          '<span class="pm-biblio-texte">' +
            '<span class="pm-biblio-id">' + id + '</span>' +
            '<span class="pm-biblio-nom">' + echapper(v.nom) + '</span>' +
            (v.autreGrille ? '<span class="pm-biblio-badge">grille ' + echapper(nomGrille(m.grille)) + '</span>' : v.complet ? '' : '<span class="pm-biblio-badge">incomplet</span>') +
            (v.complet && v.alertes ? '<span class="pm-biblio-badge" title="Alertes de l’éditeur (par exemple règles R1 à R4)">' + v.alertes + ' alerte' + (v.alertes > 1 ? 's' : '') + '</span>' : '') +
          '</span>' +
        '</button>' +
        (v.utilisateur ? '<button type="button" class="pm-biblio-supprimer" data-action="supprimer" data-id="' + id + '"' +
          ' aria-label="' + echapper('Supprimer la tuile ' + v.id + (v.nom ? ' (' + v.nom + ')' : '')) + '"' +
          ' title="Supprimer cette tuile de la bibliothèque (avec confirmation)">✕</button>' : '') +
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
      var refus = refusArmement(etat.doc(), id); // autre grille ou incomplet : non glissable, et on dit pourquoi (recette B2)
      if (refus) { etat.signaler(refus, 'erreur'); return; }
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
      var sup = ev.target.closest('[data-action="supprimer"]');
      if (sup) { demanderSuppression(etat, sup.getAttribute('data-id')); return; } // le ✕ n'arme jamais la pose
      var b = ev.target.closest('[data-action="armer"]');
      if (!b || b.disabled) return;
      // clic souris émis juste après le lâcher d'un glissement : ignoré (le clavier, detail = 0, ne l'est jamais)
      if (ev.detail > 0 && Date.now() - finGlissement < 400) return;
      // deuxième clic d'un double-clic : ignoré, le double-clic ouvre l'éditeur
      if (ev.detail > 1) return;
      var id = b.getAttribute('data-id');
      if (etat.ui().aPoser === id) { etat.majUi({ aPoser: null }); return; } // second clic sur la tuile armée : annule
      var refus = refusArmement(etat.doc(), id);
      if (refus) { etat.signaler(refus, 'erreur'); return; }
      etat.majUi({ aPoser: id, onglet: 'plateau' });
      etat.signaler('Cliquez une cellule éclairée du plateau pour poser « ' + id + ' » (Échap pour annuler).', 'info');
    });

    // Double-clic : ouvrir dans l'éditeur (tout modèle, même incomplet ou d'une autre grille : c'est le moyen de le corriger)
    liste.addEventListener('dblclick', function (ev) {
      var b = ev.target.closest('[data-action="armer"]');
      if (!b) return;
      ouvrirDansEditeur(b.getAttribute('data-id'));
    });

    // Clavier : Entrée / Espace arment la pose (clic), E ouvre l'éditeur
    liste.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.altKey || (ev.key !== 'e' && ev.key !== 'E')) return;
      var b = ev.target.closest('[data-action="armer"]');
      if (!b) return;
      ev.preventDefault();
      ouvrirDansEditeur(b.getAttribute('data-id'));
    });

    function ouvrirDansEditeur(id) {
      etat.majUi({ modeleSelectionne: id, onglet: 'tuiles', aPoser: null });
    }

    etat.abonner(dessiner);
    dessiner();
  }

  PM.bibliotheque = {
    vignettesBibliotheque: vignettesBibliotheque,
    refusArmement: refusArmement,
    estTuileUtilisateur: estTuileUtilisateur,
    effetsSuppression: effetsSuppression,
    supprimerTuileUtilisateur: supprimerTuileUtilisateur,
    demanderSuppression: demanderSuppression,
    phraseAutreGrille: phraseAutreGrille,
    SEUIL_GLISSEMENT: SEUIL_GLISSEMENT,
    monter: monter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.bibliotheque;
})();
