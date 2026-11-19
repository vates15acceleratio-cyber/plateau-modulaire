/*
 * vue-bibliotheque.js : mode « Bibliothèque » de l'onglet Plateau (lot E, cahier des charges §8.2).
 * Enregistrer le plateau courant sous un nom, ouvrir, dupliquer, renommer, supprimer, exporter tout / importer,
 * et la SAUVEGARDE AUTOMATIQUE du travail en cours avec reprise à l'ouverture de la page.
 * Dépend de AT.catalogue, AT.plateau, AT.controles, AT.bibliotheque ; AT.rendu pour le panneau.
 *
 * Le stockage est injecté (options.stockage) : localStorage du navigateur par défaut, stockage en mémoire dans la
 * recette automatique. S'il est absent, plein ou illisible, l'outil reste utilisable : la bibliothèque vit alors
 * en mémoire le temps de la session, et un avis permanent le dit. Aucune écriture au chargement du script.
 *
 * Clés du stockage (préfixe « atelier-plateau: ») : « bibliotheque » et « travail » (AT.bibliotheque), plus
 * « ouvert » : identifiant de l'entrée de la bibliothèque dont le plateau courant est issu (pour « Mettre à jour »
 * après un rechargement de la page).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
    if (!AT.controles) require('./controles.js');
    if (!AT.bibliotheque) require('./bibliotheque.js');
  }
  var C = AT.catalogue, P = AT.plateau, K = AT.controles, B = AT.bibliotheque;

  var DELAI_SAUVEGARDE = 400;        // millisecondes d'attente après le dernier changement
  var FORME_ID = /^b[1-9][0-9]{0,5}$/;

  // ================================================================== logique pure

  /** Résumé d'un plateau pour sa fiche : {cases, pieces, villes, erreurs, alertes}. */
  function resume(plateau, reglages) {
    var bilan = K.tout(plateau, reglages);
    return {
      cases: Object.keys(P.cases(plateau, { sansRecouvrements: true })).length,
      pieces: (plateau.pieces || []).length,
      villes: P.villes(plateau).length,
      erreurs: bilan.erreurs, alertes: bilan.alertes
    };
  }

  /** « 91 cases, 64 pièces, 7 villes ; aucune erreur, 2 alertes ». */
  function texteResume(r) {
    var n = function (x, un, plusieurs, aucun) { return x === 0 ? aucun : x + ' ' + (x > 1 ? plusieurs : un); };
    return n(r.cases, 'case', 'cases', 'aucune case') + ', ' + n(r.pieces, 'pièce', 'pièces', 'aucune pièce') + ', ' + n(r.villes, 'ville', 'villes', 'aucune ville')
      + ' ; ' + n(r.erreurs, 'erreur', 'erreurs', 'aucune erreur') + ', ' + n(r.alertes, 'alerte', 'alertes', 'aucune alerte');
  }

  /** Date ISO → « 19/11/2026 à 14:05 » (heure du poste) ; texte vide si la date est illisible. */
  function dateLisible(iso) {
    var d = new Date(iso);
    if (typeof iso !== 'string' || isNaN(d.getTime())) return '';
    var deux = function (x) { return (x < 10 ? '0' : '') + x; };
    return deux(d.getDate()) + '/' + deux(d.getMonth() + 1) + '/' + d.getFullYear() + ' à ' + deux(d.getHours()) + ':' + deux(d.getMinutes());
  }

  /** Nom libre proposé pour un nouveau plateau : « Plateau 1 », « Plateau 2 »… (le premier qui n'est pas pris). */
  function nomLibre(liste) {
    var pris = Object.create(null);
    (Array.isArray(liste) ? liste : []).forEach(function (e) { if (e && typeof e.nom === 'string') pris[e.nom.toLowerCase()] = true; });
    var n = 1;
    while (pris['plateau ' + n] === true) n += 1;
    return 'Plateau ' + n;
  }

  /** Vrai si deux plateaux s'enregistreraient à l'identique. */
  function memePlateau(a, b) {
    try { return P.serialiser(a) === P.serialiser(b); } catch (x) { return false; }
  }

  AT.vueBibliotheque = { DELAI_SAUVEGARDE: DELAI_SAUVEGARDE, resume: resume, texteResume: texteResume, dateLisible: dateLisible, nomLibre: nomLibre, memePlateau: memePlateau };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueBibliotheque;
  if (typeof document === 'undefined') return;

  // ================================================================== panneau

  /**
   * `acces` : plateau(), reglages(), ouvrirDocument(plateau), message(texte, niveau), confirmer(texte, libelle, rappel),
   *           telecharger(nom, contenu, type), ouvrirFichier(rappel), indiquer({nom, modifie, sauvegarde, niveau}).
   * `options.stockage` : stockage injecté (undefined = celui du navigateur ; null = aucun).
   * Renvoie {element, rafraichir(), liste(), ouvert(), detacher(), planifier(), sauverTravail(), reprendre(), …}.
   */
  function creer(acces, options) {
    var R = AT.rendu, el = R.el;
    var stockage = options && options.stockage !== undefined ? options.stockage : B.stockageNavigateur();
    var avisStockage = null;           // avis permanent (stockage absent, corrompu, plein)
    var liste = [], ouvert = null;
    var minuterie = null, actif = false, dernierTravail = null, etatSauvegarde = { texte: '', niveau: 'info' };
    var renomme = null, resumes = Object.create(null), visible = false;

    var champNom = el('input', { type: 'text', id: 'bi-nom', maxlength: C.REGLAGES.bibliotheque.longueurNom, autocomplete: 'off', spellcheck: 'false' });
    var zoneAvis = el('p', { classe: 'at-avis', id: 'bi-avis', hidden: true });
    var zoneCourant = el('div', { id: 'bi-courant' });
    var zoneListe = el('div', { classe: 'at-bib-liste', id: 'bi-liste' });
    var titreListe = el('legend', { id: 'bi-titre-liste' });

    function cleOuvert() { return C.REGLAGES.bibliotheque.prefixe + 'ouvert'; }

    // ---------------------------------------------------------------- stockage
    if (!stockage) {
      stockage = B.stockageMemoire();
      avisStockage = 'Stockage du navigateur indisponible : la bibliothèque et le travail en cours ne seront pas conservés à la fermeture de la page. Utilisez « Exporter toute la bibliothèque » et « Enregistrer » (fichier).';
    }
    (function charger() {
      var lu = B.charger(stockage);
      liste = lu.liste;
      if (!lu.ok) {
        avisStockage = lu.raison + (lu.corrompu ? ' Elle est ignorée ; elle sera remplacée au prochain enregistrement dans la bibliothèque.' : '');
      } else if (lu.ecartees) {
        avisStockage = lu.ecartees + (lu.ecartees > 1 ? ' plateaux illisibles ont été écartés' : ' plateau illisible a été écarté') + ' de la bibliothèque enregistrée (' + lu.avis[0] + ').';
      }
      try {
        var id = stockage.getItem(cleOuvert());
        if (typeof id === 'string' && FORME_ID.test(id) && B.trouver(liste, id)) ouvert = id;
      } catch (x) { ouvert = null; }
    })();

    function noterOuvert(id) {
      ouvert = id;
      try { if (id) stockage.setItem(cleOuvert(), id); else stockage.removeItem(cleOuvert()); } catch (x) { /* sans conséquence : seul « Mettre à jour » après rechargement en dépend */ }
    }

    /** Écrit la nouvelle liste ; en cas d'échec, la liste en cours est gardée et la raison est affichée. */
    function persister(nouvelle) {
      var r = B.enregistrer(stockage, nouvelle);
      if (!r.ok) {
        if (r.plein || r.absent) avisStockage = r.raison;
        acces.message(r.raison, 'erreur');
        rafraichir();
        return false;
      }
      liste = nouvelle;
      return true;
    }

    // ---------------------------------------------------------------- sauvegarde automatique du travail en cours
    function indiquer() {
      var entree = ouvert ? B.trouver(liste, ouvert) : null;
      acces.indiquer({
        nom: entree ? entree.nom : null,
        modifie: entree ? !memePlateau(entree.plateau, acces.plateau()) : false,
        sauvegarde: etatSauvegarde.texte, niveau: etatSauvegarde.niveau
      });
    }

    /** Écrit tout de suite le travail en cours (sans rien écrire s'il n'a pas changé). Renvoie {ok, raison}. */
    function sauverTravail() {
      if (minuterie !== null) { clearTimeout(minuterie); minuterie = null; }
      var texte = P.serialiser(acces.plateau());
      if (texte === dernierTravail) return { ok: true, raison: null };
      var r = B.enregistrerTravail(stockage, acces.plateau());
      if (r.ok) {
        dernierTravail = texte;
        etatSauvegarde = { texte: 'Travail sauvegardé automatiquement à ' + dateLisible(new Date().toISOString()).slice(-5), niveau: 'info' };
      } else {
        etatSauvegarde = { texte: 'Sauvegarde automatique impossible', niveau: 'erreur' };
        if (r.plein || r.absent) avisStockage = r.raison;
        if (visible) rafraichir();
      }
      indiquer();
      return r;
    }

    /** À appeler après chaque changement du plateau : une seule écriture, un peu après le dernier changement. */
    function planifier() {
      if (!actif) return;
      if (minuterie !== null) clearTimeout(minuterie);
      minuterie = setTimeout(function () { minuterie = null; sauverTravail(); }, DELAI_SAUVEGARDE);
    }

    /**
     * Travail en cours retrouvé dans le stockage : {ok, plateau (null s'il n'y en a pas), modifie, raison}.
     * Ne change rien à l'écran : l'appelant décide de l'ouvrir.
     */
    function reprendre() {
      var r = B.chargerTravail(stockage);
      if (r.ok && r.plateau) dernierTravail = P.serialiser(r.plateau);
      if (!r.ok && r.corrompu) avisStockage = r.raison + ' Il est ignoré.';
      return r;
    }

    // ---------------------------------------------------------------- actions
    function enregistrerSous(nom) {
      var voulu = nom === undefined ? champNom.value : nom;
      var r = B.ajouter(liste, voulu, acces.plateau());
      if (!r.ok) { acces.message('Enregistrement refusé : ' + r.raison, 'erreur'); return false; }
      if (!persister(r.liste)) return false;
      noterOuvert(r.id);
      champNom.value = '';
      rafraichir();
      acces.message('Plateau enregistré dans la bibliothèque sous le nom « ' + B.trouver(liste, r.id).nom + ' ».', 'info');
      return true;
    }

    function mettreAJour() {
      var entree = ouvert ? B.trouver(liste, ouvert) : null;
      if (!entree) { acces.message('Aucun plateau de la bibliothèque n’est ouvert : donnez un nom puis « Enregistrer sous ce nom ».', 'alerte'); return false; }
      var r = B.remplacer(liste, ouvert, acces.plateau());
      if (!r.ok) { acces.message('Mise à jour refusée : ' + r.raison, 'erreur'); return false; }
      if (!persister(r.liste)) return false;
      rafraichir();
      acces.message('« ' + entree.nom + ' » mis à jour dans la bibliothèque.', 'info');
      return true;
    }

    function ouvrir(id) {
      var entree = B.trouver(liste, id);
      if (!entree) { acces.message('Plateau introuvable dans la bibliothèque.', 'erreur'); return false; }
      acces.ouvrirDocument(entree.plateau);
      noterOuvert(id);
      rafraichir();
      acces.message('« ' + entree.nom + ' » ouvert (Annuler revient au plateau précédent).', 'info');
      return true;
    }

    function dupliquer(id) {
      var r = B.dupliquer(liste, id);
      if (!r.ok) { acces.message('Copie refusée : ' + r.raison, 'erreur'); return false; }
      if (!persister(r.liste)) return false;
      rafraichir();
      acces.message('Copie créée : « ' + B.trouver(liste, r.id).nom + ' ».', 'info');
      return true;
    }

    function renommer(id, nom) {
      var r = B.renommer(liste, id, nom);
      if (!r.ok) { acces.message('Nouveau nom refusé : ' + r.raison, 'erreur'); return false; }
      if (!persister(r.liste)) return false;
      renomme = null;
      rafraichir();
      acces.message('Plateau renommé « ' + B.trouver(liste, id).nom + ' ».', 'info');
      return true;
    }

    function supprimer(id) {
      var entree = B.trouver(liste, id);
      if (!entree) return;
      acces.confirmer('Supprimer « ' + entree.nom + ' » de la bibliothèque ? Cette suppression ne s’annule pas.', 'Supprimer', function () {
        var r = B.supprimer(liste, id);
        if (!r.ok) { acces.message(r.raison, 'erreur'); return; }
        if (!persister(r.liste)) return;
        if (ouvert === id) noterOuvert(null);
        rafraichir();
        acces.message('« ' + entree.nom + ' » supprimé de la bibliothèque. Le plateau affiché n’a pas changé.', 'info');
      });
    }

    function exporter() {
      if (!liste.length) { acces.message('La bibliothèque est vide : rien à exporter.', 'alerte'); return false; }
      acces.telecharger('bibliotheque-plateaux.json', B.exporter(liste), 'application/json');
      return true;
    }

    /** Importe le texte d'un fichier d'export (fusion : rien n'est écrasé). Renvoie vrai si des plateaux sont ajoutés. */
    function importerTexte(texte) {
      var r = B.importer(liste, texte);
      if (!r.ok) { acces.message(r.raison, 'erreur'); return false; }
      if (!persister(r.liste)) return false;
      rafraichir();
      acces.message(r.ajoutes + (r.ajoutes > 1 ? ' plateaux importés' : ' plateau importé') + ' dans la bibliothèque'
        + (r.ecartees ? ' ; ' + r.ecartees + (r.ecartees > 1 ? ' entrées illisibles écartées' : ' entrée illisible écartée') : '') + '.', r.ecartees ? 'alerte' : 'info');
      return true;
    }

    // ---------------------------------------------------------------- dessin
    function resumeDe(entree) {
      var cle = entree.id + '/' + entree.modifie;
      if (!resumes[cle]) {
        try { resumes[cle] = texteResume(resume(entree.plateau, acces.reglages())); } catch (x) { resumes[cle] = 'résumé indisponible'; }
      }
      return resumes[cle];
    }

    function fiche(entree) {
      var carte = el('div', { classe: 'at-bib-fiche' + (entree.id === ouvert ? ' at-bib-ouverte' : ''), 'data-entree': entree.id });
      carte.appendChild(R.vignette(entree.plateau, { largeur: 92, hauteur: 80, titre: 'Vignette du plateau' }));
      var texte = el('div', { classe: 'at-bib-texte' });
      if (renomme === entree.id) {
        var champ = el('input', { type: 'text', classe: 'at-bib-champ', 'data-nouveau-nom': entree.id, maxlength: C.REGLAGES.bibliotheque.longueurNom, 'aria-label': 'Nouveau nom', autocomplete: 'off' });
        champ.value = entree.nom;
        champ.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { renommer(entree.id, champ.value); ev.preventDefault(); }
          if (ev.key === 'Escape') { renomme = null; rafraichir(); ev.preventDefault(); ev.stopPropagation(); }
        });
        texte.appendChild(el('div', { classe: 'at-ligne' }, [
          champ,
          el('button', { type: 'button', texte: 'OK', 'data-valider-nom': entree.id, sur: { click: function () { renommer(entree.id, champ.value); } } }),
          el('button', { type: 'button', texte: 'Renoncer', sur: { click: function () { renomme = null; rafraichir(); } } })
        ]));
      } else {
        var nom = el('strong', { classe: 'at-bib-nom' });
        nom.textContent = entree.nom;                  // nom saisi ou importé : textContent seulement
        texte.appendChild(nom);
        if (entree.id === ouvert) texte.appendChild(el('span', { classe: 'at-bib-marque', texte: ' (ouvert)' }));
      }
      texte.appendChild(el('div', { classe: 'at-aide at-bib-resume', texte: resumeDe(entree) }));
      texte.appendChild(el('div', { classe: 'at-aide', texte: 'Modifié le ' + dateLisible(entree.modifie) }));
      texte.appendChild(el('div', { classe: 'at-ligne' }, [
        el('button', { type: 'button', texte: 'Ouvrir', 'data-ouvrir': entree.id, sur: { click: function () { ouvrir(entree.id); } } }),
        el('button', { type: 'button', texte: 'Dupliquer', 'data-dupliquer': entree.id, sur: { click: function () { dupliquer(entree.id); } } }),
        el('button', { type: 'button', texte: 'Renommer', 'data-renommer': entree.id, sur: { click: function () { renomme = entree.id; rafraichir(); } } }),
        el('button', { type: 'button', texte: 'Supprimer', 'data-supprimer-entree': entree.id, sur: { click: function () { supprimer(entree.id); } } })
      ]));
      carte.appendChild(texte);
      return carte;
    }

    function rafraichir() {
      indiquer();
      if (!visible) return;
      zoneAvis.hidden = !avisStockage;
      zoneAvis.textContent = avisStockage || '';
      var entree = ouvert ? B.trouver(liste, ouvert) : null, courant = [];
      if (entree) {
        var modifie = !memePlateau(entree.plateau, acces.plateau());
        var ligne = el('p', { id: 'bi-etat' });
        ligne.textContent = 'Plateau ouvert : « ' + entree.nom + ' »' + (modifie ? ' — modifié depuis son enregistrement.' : ' — à jour dans la bibliothèque.');
        courant.push(ligne);
        var maj = el('button', { type: 'button', id: 'bi-mettre-a-jour', classe: 'at-principal-bouton', disabled: !modifie, sur: { click: mettreAJour } });
        maj.textContent = 'Mettre à jour « ' + entree.nom + ' »';
        courant.push(el('div', { classe: 'at-ligne' }, maj));
      } else {
        courant.push(el('p', { id: 'bi-etat', texte: 'Le plateau affiché n’est pas dans la bibliothèque.' }));
      }
      R.remplacer(zoneCourant, courant);
      if (!champNom.value && document.activeElement !== champNom) champNom.placeholder = nomLibre(liste);
      titreListe.textContent = 'Plateaux enregistrés (' + liste.length + ' / ' + C.REGLAGES.bibliotheque.plateauxMax + ')';
      R.remplacer(zoneListe, liste.length ? liste.map(fiche) : el('p', { classe: 'at-aide', texte: 'La bibliothèque est vide. Donnez un nom au plateau affiché puis « Enregistrer sous ce nom ».' }));
      if (renomme) {
        var champ = zoneListe.querySelector('[data-nouveau-nom]');
        if (champ && document.activeElement !== champ) { champ.focus(); champ.select(); }
      }
    }

    champNom.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { enregistrerSous(champNom.value || champNom.placeholder); ev.preventDefault(); } });

    var element = el('div', { classe: 'at-mode-panneau', id: 'bi-panneau' }, [
      zoneAvis,
      el('fieldset', null, [
        el('legend', { texte: 'Plateau affiché' }),
        zoneCourant,
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'bi-nom', texte: 'Nom' }), champNom]),
        el('div', { classe: 'at-ligne' }, [
          el('button', { type: 'button', id: 'bi-enregistrer', texte: 'Enregistrer sous ce nom', sur: { click: function () { enregistrerSous(champNom.value || champNom.placeholder); } } })
        ]),
        el('p', { classe: 'at-aide', texte: 'La bibliothèque est gardée dans ce navigateur, sur ce poste. Le travail en cours est aussi sauvegardé tout seul et repris à la prochaine ouverture.' })
      ]),
      el('fieldset', null, [
        titreListe,
        zoneListe
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Sauvegarde dans un fichier' }),
        el('div', { classe: 'at-ligne' }, [
          el('button', { type: 'button', id: 'bi-exporter', texte: 'Exporter toute la bibliothèque', sur: { click: exporter } }),
          el('button', { type: 'button', id: 'bi-importer', texte: 'Importer…', title: 'Ajouter les plateaux d’un fichier exporté (rien n’est écrasé)', sur: { click: function () { acces.ouvrirFichier(importerTexte); } } })
        ])
      ])
    ]);

    return {
      element: element, rafraichir: rafraichir,
      montrer: function (oui) { visible = !!oui; if (visible) rafraichir(); },
      liste: function () { return liste; }, ouvert: function () { return ouvert; }, avis: function () { return avisStockage; },
      detacher: function () { if (ouvert) { noterOuvert(null); } },
      activer: function () { actif = true; }, planifier: planifier, sauverTravail: sauverTravail, reprendre: reprendre,
      enregistrerSous: enregistrerSous, mettreAJour: mettreAJour, ouvrir: ouvrir, dupliquer: dupliquer, renommer: renommer,
      supprimer: supprimer, exporter: exporter, importerTexte: importerTexte,
      stockage: function () { return stockage; }
    };
  }

  AT.vueBibliotheque.creer = creer;
})();
