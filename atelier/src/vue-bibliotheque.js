/*
 * vue-bibliotheque.js : mode « Bibliothèque » de l'onglet Plateau (lot E, cahier des charges §8.2).
 * Enregistrer le plateau courant sous un nom, ouvrir, dupliquer, renommer, supprimer, exporter tout / importer,
 * et la SAUVEGARDE AUTOMATIQUE du travail en cours avec reprise à l'ouverture de la page.
 * Dépend de AT.catalogue, AT.plateau, AT.controles, AT.bibliotheque ; AT.rendu pour le panneau.
 *
 * Le stockage est injecté (options.stockage) : localStorage du navigateur par défaut, stockage en mémoire dans la
 * recette automatique. S'il est absent, plein ou refusé, l'outil reste utilisable : la bibliothèque vit alors en
 * mémoire le temps de la session, et un avis permanent invite à exporter. Aucune écriture au chargement du script.
 *
 * Règles de sûreté (revue docs/06-revue-creation.md) :
 *  - plusieurs fenêtres : le stockage est RELU avant chaque écriture (jamais d'écriture par-dessus une fiche ajoutée
 *    ou modifiée ailleurs) et l'événement « storage » met la liste à jour ;
 *  - l'attache « plateau ouvert » est écrite AVEC le travail en cours, dans la même écriture ;
 *  - un identifiant de fiche n'est jamais réutilisé (compteur conservé dans le stockage) ;
 *  - un contenu illisible ou d'une version inconnue n'est jamais remplacé sans copie de secours datée ;
 *  - les avis permanents se cumulent (un par sujet) ;
 *  - rien n'est écrit dans le travail en cours tant que l'utilisateur n'a rien modifié.
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

  // ================================================================== logique pure

  /**
   * Résumé d'un plateau pour sa fiche : {cases, pieces, villes, erreurs, alertes}.
   * La fiche est jugée avec SA profondeur des extrémités (celle qu'elle a enregistrée, sinon le réglage par défaut),
   * jamais avec celle du plateau affiché : `reglages.profondeurExtremite` n'est pas transmis aux contrôles.
   */
  function resume(plateau, reglages) {
    var options = {};
    Object.keys(reglages || {}).forEach(function (k) { if (k !== 'profondeurExtremite') options[k] = reglages[k]; });
    var bilan = K.tout(plateau, options);
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
   *           telecharger(nom, contenu, type), ouvrirFichier(rappel), indiquer({nom, modifie, sauvegarde, niveau}),
   *           lier(id) (facultatif : attache toute la lignée du plateau courant dans l'historique à une fiche).
   * `options.stockage` : stockage injecté (undefined = celui du navigateur ; null = aucun) ;
   * `options.ecouter` = false : ne pas écouter l'événement « storage ».
   * Renvoie {element, rafraichir(), liste(), ouvert(), attacher(id), planifier(), sauverTravail(), reprendre(), …}.
   */
  function creer(acces, options) {
    var R = AT.rendu, el = R.el;
    var stockage = options && options.stockage !== undefined ? options.stockage : B.stockageNavigateur();
    var avis = Object.create(null);    // avis permanents, par sujet : ils se cumulent, aucun ne remplace l'autre
    var ORDRE_AVIS = ['absent', 'plein', 'travailPlein', 'bibliotheque', 'ecartees', 'travail', 'secours', 'secoursTravail', 'ailleurs'];
    var liste = [], ouvert = null;
    var compteur = 1;                  // plus petit numéro de fiche jamais attribué (un identifiant n'est jamais réutilisé)
    var dernierBrut = null;            // texte de la bibliothèque tel que cette fenêtre l'a lu ou écrit en dernier
    var enMemoire = false;             // la dernière écriture a échoué : la liste en mémoire fait foi pour la session
    var aSecourir = null;              // texte illisible (ou portant des fiches écartées) à copier avant toute écriture
    var travailASecourir = null, travailVu = false;
    var connues = Object.create(null); // date « modifie » de la fiche ouverte, enregistrée ou mise à jour PAR cette fenêtre
    var minuterie = null, actif = false, sale = false, dernierTravail = null, etatSauvegarde = { texte: '', niveau: 'info' };
    var renomme = null, resumes = Object.create(null), visible = false;

    var champNom = el('input', { type: 'text', id: 'bi-nom', maxlength: C.REGLAGES.bibliotheque.longueurNom, autocomplete: 'off', spellcheck: 'false' });
    var zoneAvis = el('div', { classe: 'at-avis', id: 'bi-avis', hidden: true });
    var zoneCourant = el('div', { id: 'bi-courant' });
    var zoneListe = el('div', { classe: 'at-bib-liste', id: 'bi-liste' });
    var titreListe = el('legend', { id: 'bi-titre-liste' });

    function dire(sujet, texte) { avis[sujet] = texte; }
    function taire(sujet) { delete avis[sujet]; }
    function textesAvis() { return ORDRE_AVIS.filter(function (s) { return typeof avis[s] === 'string'; }).map(function (s) { return avis[s]; }); }

    // ---------------------------------------------------------------- stockage
    if (!stockage) {
      stockage = B.stockageMemoire();
      dire('absent', 'Stockage du navigateur indisponible : la bibliothèque et le travail en cours ne seront pas conservés à la fermeture de la page. Utilisez « Exporter toute la bibliothèque » et « Enregistrer » (fichier).');
    }

    /**
     * Note la date de la fiche `id` telle que cette fenêtre vient de l'ouvrir ou de l'écrire. Seulement pour elle :
     * une écriture sur une AUTRE fiche ne doit pas faire oublier qu'une autre fenêtre a modifié celle-ci entre-temps.
     */
    function retenir(id) { var e = id ? B.trouver(liste, id) : null; if (e) connues[id] = e.modifie; }

    /**
     * Relit la bibliothèque du stockage si son texte a changé depuis la dernière lecture ou écriture de CETTE fenêtre
     * (une autre fenêtre de l'atelier a pu enregistrer entre-temps). Appelée avant toute écriture : on ne réécrit
     * jamais par-dessus une fiche ajoutée ou modifiée ailleurs. Renvoie vrai si la liste en mémoire a changé.
     */
    function relire() {
      var lu = B.charger(stockage);
      if (lu.absent) return false;
      compteur = Math.max(compteur, lu.suivant);          // même si la liste n'a pas changé : une fiche a pu être créée puis supprimée ailleurs
      if (lu.brut === dernierBrut) return false;
      dernierBrut = lu.brut;
      if (!lu.ok) {
        // Illisible ou d'une version inconnue : on ne l'efface pas. La liste en mémoire est gardée.
        aSecourir = lu.brut;
        dire('bibliotheque', lu.raison + ' Elle n’est pas effacée : une copie de secours en est gardée avant tout enregistrement dans la bibliothèque.');
        return false;
      }
      taire('bibliotheque');
      if (lu.ecartees) {
        aSecourir = lu.brut;
        dire('ecartees', lu.ecartees + (lu.ecartees > 1 ? ' plateaux illisibles ont été écartés' : ' plateau illisible a été écarté') + ' de la bibliothèque enregistrée (' + lu.avis[0]
          + '). Rien n’est effacé : une copie de secours du contenu d’origine est gardée avant tout enregistrement.');
      }
      if (enMemoire) {
        // Des fiches n'existent qu'en mémoire (stockage plein) : fusion, la plus récente gagne.
        var f = B.fusionner(liste, lu.liste);
        liste = f.liste;
      } else {
        liste = lu.liste;
      }
      resumes = Object.create(null);
      if (ouvert && !B.trouver(liste, ouvert)) lier(null);      // la fiche ouverte a été supprimée ailleurs
      return true;
    }

    /**
     * Écrit la nouvelle liste. Avant, garde une copie de secours d'un contenu illisible qu'elle remplacerait.
     * Stockage plein ou refusé : la liste est gardée EN MÉMOIRE pour la session et un avis invite à exporter.
     * Renvoie vrai si la liste en cours est bien `nouvelle` (dans le stockage ou en mémoire), faux si elle est refusée.
     */
    function ecrire(nouvelle) {
      var r = null;
      if (aSecourir !== null) {
        var s = B.sauverSecours(stockage, 'bibliotheque', aSecourir);
        if (s.ok) {
          aSecourir = null;
          dire('secours', 'Une copie de secours de la bibliothèque illisible a été gardée dans ce navigateur (« ' + s.cle + ' ») : « Exporter les copies de secours » la sort dans un fichier.');
        } else {
          r = s;                       // pas de copie possible : on n'écrase rien, on continue en mémoire
        }
      }
      if (r === null) r = B.enregistrer(stockage, nouvelle, compteur);
      resumes = Object.create(null);   // deux enregistrements peuvent porter la même date à la milliseconde : pas de résumé périmé
      if (r.ok) {
        liste = nouvelle;
        dernierBrut = r.texte;
        enMemoire = false;
        taire('plein');
        taire('ailleurs');             // l'avis « modifiée dans une autre fenêtre » a été vu : il s'efface à l'action suivante
        return true;
      }
      if (r.plein || r.absent) {
        liste = nouvelle;
        enMemoire = true;
        dire('plein', 'Stockage du navigateur plein ou refusé : la bibliothèque continue en mémoire pour cette session, mais ses derniers changements ne seront pas conservés à la fermeture de la page. '
          + 'Cliquez « Exporter toute la bibliothèque » pour ne rien perdre, ou supprimez des plateaux pour faire de la place.');
        return true;
      }
      acces.message(r.raison, 'erreur');
      rafraichir();
      return false;
    }

    /** Message de fin d'action : en alerte, avec la consigne d'export, quand la liste n'a pu être gardée qu'en mémoire. */
    function annoncer(texte, niveau) {
      if (enMemoire) acces.message(texte + ' Attention : gardé en mémoire seulement (stockage plein ou refusé) : « Exporter toute la bibliothèque » pour ne rien perdre.', 'alerte');
      else acces.message(texte, niveau || 'info');
    }

    /** Attache le plateau courant (et toute sa lignée dans l'historique) à une fiche, ou le détache (null). */
    function lier(id) {
      ouvert = id;
      if (acces.lier) acces.lier(id);
      planifier();
    }

    /** Une autre fenêtre de l'atelier a écrit dans le stockage : la liste affichée se met à jour. */
    function surStockage(ev) {
      var prefixe = C.REGLAGES.bibliotheque.prefixe;
      if (ev && typeof ev.key === 'string' && ev.key.indexOf(prefixe) !== 0) return;
      if (!relire()) return;
      dire('ailleurs', 'La bibliothèque a été modifiée dans une autre fenêtre de l’atelier : la liste ci-dessous est à jour.');
      rafraichir();
    }
    if (!(options && options.ecouter === false) && typeof window !== 'undefined' && window.addEventListener) window.addEventListener('storage', surStockage);

    relire();

    // ---------------------------------------------------------------- sauvegarde automatique du travail en cours
    function indiquer() {
      var entree = ouvert ? B.trouver(liste, ouvert) : null;
      acces.indiquer({
        nom: entree ? entree.nom : null,
        modifie: entree ? !memePlateau(entree.plateau, acces.plateau()) : false,
        sauvegarde: etatSauvegarde.texte, niveau: etatSauvegarde.niveau
      });
    }

    /** Ce qui est écrit dans le travail en cours : le plateau ET la fiche à laquelle il est attaché. */
    function signature() { return P.serialiser(acces.plateau()) + '\n' + (ouvert || ''); }

    /**
     * Écrit tout de suite le travail en cours : plateau et attache, en UNE écriture. Rien n'est écrit tant que
     * l'utilisateur n'a rien modifié depuis l'ouverture de la page (un plateau généré par l'adresse « #graine= »
     * ne remplace donc pas le travail sauvegardé), ni si rien n'a changé depuis la dernière écriture.
     * Renvoie {ok, raison}.
     */
    function sauverTravail() {
      if (minuterie !== null) { clearTimeout(minuterie); minuterie = null; }
      if (!sale) return { ok: true, raison: null };
      var texte = signature(), r;
      if (texte === dernierTravail) { sale = false; return { ok: true, raison: null }; }
      if (!travailVu) {
        // Le travail en place n'a pas été relu à l'ouverture (adresse « #graine= ») : on ne remplace pas un contenu illisible sans copie.
        var enPlace = B.chargerTravail(stockage);
        if (!enPlace.ok && enPlace.corrompu) travailASecourir = enPlace.brut;
        travailVu = true;
      }
      if (travailASecourir !== null) {
        var s = B.sauverSecours(stockage, 'travail', travailASecourir);
        if (s.ok) {
          travailASecourir = null;
          dire('secoursTravail', 'Une copie de secours du travail en cours illisible a été gardée dans ce navigateur (« ' + s.cle + ' ») : « Exporter les copies de secours » la sort dans un fichier.');
        }
        r = s.ok ? null : s;
      }
      if (!r) r = B.enregistrerTravail(stockage, acces.plateau(), undefined, ouvert);
      if (r.ok) {
        dernierTravail = texte;
        sale = false;
        etatSauvegarde = { texte: 'Travail sauvegardé automatiquement à ' + dateLisible(new Date().toISOString()).slice(-5), niveau: 'info' };
        taire('travailPlein');
        try { stockage.removeItem(C.REGLAGES.bibliotheque.prefixe + 'ouvert'); } catch (x) { /* ancienne clé à part, désormais inutile */ }
      } else {
        etatSauvegarde = { texte: 'Sauvegarde automatique impossible', niveau: 'erreur' };
        if (r.plein || r.absent) dire('travailPlein', 'Stockage du navigateur plein ou refusé : le travail en cours n’est plus sauvegardé automatiquement. Utilisez « Enregistrer » (fichier) et « Exporter toute la bibliothèque ».');
      }
      if (visible) rafraichir(); else indiquer();
      return r;
    }

    /** À appeler après chaque changement du plateau ou de son attache : une seule écriture, un peu après le dernier changement. */
    function planifier() {
      if (!actif) return;
      sale = true;
      if (minuterie !== null) clearTimeout(minuterie);
      minuterie = setTimeout(function () { minuterie = null; sauverTravail(); }, DELAI_SAUVEGARDE);
    }

    /**
     * Travail en cours retrouvé dans le stockage : {ok, plateau (null s'il n'y en a pas), modifie, ouvert, raison}.
     * L'attache est celle écrite avec le plateau (si la fiche existe encore). Ne change rien à l'écran.
     */
    function reprendre() {
      var r = B.chargerTravail(stockage);
      travailVu = true;
      if (r.ok && r.plateau) {
        ouvert = (r.ouvert && B.trouver(liste, r.ouvert)) ? r.ouvert : null;
        retenir(ouvert);
        dernierTravail = P.serialiser(r.plateau) + '\n' + (ouvert || '');
      }
      if (!r.ok && r.corrompu) {
        travailASecourir = r.brut;
        dire('travail', r.raison + ' Il est ignoré, pas effacé : une copie de secours en est gardée avant qu’un nouveau travail le remplace.');
      }
      return r;
    }

    // ---------------------------------------------------------------- actions
    function enregistrerSous(nom) {
      relire();
      var voulu = nom === undefined ? champNom.value : nom;
      var r = B.ajouter(liste, voulu, acces.plateau(), undefined, { minimum: compteur, unique: true });
      if (!r.ok) { acces.message('Enregistrement refusé : ' + r.raison, 'erreur'); return false; }
      compteur = Math.max(compteur, B.numero(r.id) + 1);
      if (!ecrire(r.liste)) return false;
      lier(r.id);
      retenir(r.id);
      champNom.value = '';
      rafraichir();
      annoncer(r.renomme
        ? 'Le nom « ' + String(voulu).trim() + ' » est déjà pris : plateau enregistré dans la bibliothèque sous le nom « ' + r.nom + ' ».'
        : 'Plateau enregistré dans la bibliothèque sous le nom « ' + r.nom + ' ».', r.renomme ? 'alerte' : 'info');
      return true;
    }

    function mettreAJour() {
      relire();
      var entree = ouvert ? B.trouver(liste, ouvert) : null;
      if (!entree) {
        rafraichir();
        acces.message('Mise à jour impossible : la fiche ouverte n’existe plus dans la bibliothèque (supprimée, peut-être dans une autre fenêtre). Donnez un nom puis « Enregistrer sous ce nom ».', 'alerte');
        return false;
      }
      // La fiche a-t-elle changé ailleurs depuis que cette fenêtre l'a vue ? Notre version, plus récente, gagne : on le dit.
      var conflit = connues[ouvert] !== undefined && connues[ouvert] !== entree.modifie;
      var r = B.remplacer(liste, ouvert, acces.plateau());
      if (!r.ok) { acces.message('Mise à jour refusée : ' + r.raison, 'erreur'); return false; }
      if (!ecrire(r.liste)) return false;
      retenir(ouvert);
      rafraichir();
      annoncer('« ' + entree.nom + ' » mis à jour dans la bibliothèque.'
        + (conflit ? ' Cette fiche avait aussi été modifiée dans une autre fenêtre : votre version, la plus récente, la remplace.' : ''), conflit ? 'alerte' : 'info');
      return true;
    }

    function ouvrir(id) {
      relire();
      var entree = B.trouver(liste, id);
      if (!entree) { rafraichir(); acces.message('Plateau introuvable dans la bibliothèque (supprimé, peut-être dans une autre fenêtre).', 'erreur'); return false; }
      acces.ouvrirDocument(entree.plateau);
      lier(id);
      retenir(id);
      rafraichir();
      acces.message('« ' + entree.nom + ' » ouvert (Annuler revient au plateau précédent).', 'info');
      return true;
    }

    function dupliquer(id) {
      relire();
      var r = B.dupliquer(liste, id, undefined, undefined, { minimum: compteur, unique: true });
      if (!r.ok) { rafraichir(); acces.message('Copie refusée : ' + r.raison, 'erreur'); return false; }
      compteur = Math.max(compteur, B.numero(r.id) + 1);
      if (!ecrire(r.liste)) return false;
      rafraichir();
      annoncer('Copie créée : « ' + r.nom + ' ».');
      return true;
    }

    function renommer(id, nom) {
      relire();
      var avantRenommage = B.trouver(liste, id);
      var r = B.renommer(liste, id, nom, undefined, { unique: true });
      if (!r.ok) { acces.message('Nouveau nom refusé : ' + r.raison, 'erreur'); return false; }
      if (!ecrire(r.liste)) return false;
      // Renommer ne touche pas au plateau de la fiche : si c'est la fiche ouverte et qu'aucune autre fenêtre ne l'a
      // modifiée depuis, sa nouvelle date est la nôtre (sinon le conflit reste à annoncer à la prochaine mise à jour).
      if (id === ouvert && avantRenommage && connues[id] === avantRenommage.modifie) retenir(id);
      renomme = null;
      rafraichir();
      annoncer(r.renomme ? 'Le nom « ' + String(nom).trim() + ' » est déjà pris : plateau renommé « ' + r.nom + ' ».' : 'Plateau renommé « ' + r.nom + ' ».', r.renomme ? 'alerte' : 'info');
      return true;
    }

    function supprimer(id) {
      var entree = B.trouver(liste, id);
      if (!entree) return;
      acces.confirmer('Supprimer « ' + entree.nom + ' » de la bibliothèque ? Cette suppression ne s’annule pas.', 'Supprimer', function () {
        relire();
        var r = B.supprimer(liste, id);
        if (!r.ok) { rafraichir(); acces.message(r.raison, 'erreur'); return; }
        if (!ecrire(r.liste)) return;
        if (ouvert === id) lier(null);
        rafraichir();
        annoncer('« ' + entree.nom + ' » supprimé de la bibliothèque. Le plateau affiché n’a pas changé.');
      });
    }

    function exporter() {
      relire();
      if (!liste.length) { acces.message('La bibliothèque est vide : rien à exporter.', 'alerte'); return false; }
      acces.telecharger('bibliotheque-plateaux.json', B.exporter(liste), 'application/json');
      return true;
    }

    /** Sort dans un fichier les copies de secours gardées dans le navigateur (contenus illisibles remplacés). */
    function exporterSecours() {
      if (!B.listerSecours(stockage).length) { acces.message('Aucune copie de secours dans ce navigateur.', 'info'); return false; }
      acces.telecharger('copies-de-secours-atelier.json', B.exporterSecours(stockage), 'application/json');
      return true;
    }

    /** Importe le texte d'un fichier d'export (fusion : rien n'est écrasé). Renvoie vrai si des plateaux sont ajoutés. */
    function importerTexte(texte) {
      relire();
      var r = B.importer(liste, texte, { minimum: compteur, unique: true });
      if (!r.ok) { acces.message(r.raison, 'erreur'); return false; }
      compteur = Math.max(compteur, B.suivantDe(r.liste));
      if (!ecrire(r.liste)) return false;
      rafraichir();
      annoncer(r.ajoutes + (r.ajoutes > 1 ? ' plateaux importés' : ' plateau importé') + ' dans la bibliothèque'
        + (r.renommes ? ' ; ' + r.renommes + (r.renommes > 1 ? ' noms déjà pris ont été numérotés' : ' nom déjà pris a été numéroté') : '')
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
      var textes = textesAvis();
      zoneAvis.hidden = !textes.length;
      R.remplacer(zoneAvis, textes.map(function (x) { return el('p', { texte: x }); }));
      boutonSecours.hidden = !B.listerSecours(stockage).length;
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

    var boutonSecours = el('button', { type: 'button', id: 'bi-exporter-secours', texte: 'Exporter les copies de secours', hidden: true,
      title: 'Sortir dans un fichier les contenus illisibles gardés avant d’être remplacés', sur: { click: exporterSecours } });

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
          el('button', { type: 'button', id: 'bi-importer', texte: 'Importer…', title: 'Ajouter les plateaux d’un fichier exporté (rien n’est écrasé)', sur: { click: function () { acces.ouvrirFichier(importerTexte); } } }),
          boutonSecours
        ])
      ])
    ]);

    return {
      element: element, rafraichir: rafraichir,
      montrer: function (oui) { visible = !!oui; if (visible) rafraichir(); },
      liste: function () { return liste; }, ouvert: function () { return ouvert; },
      /** Avis permanents en cours, réunis en un texte (null s'il n'y en a pas). */
      avis: function () { var x = textesAvis(); return x.length ? x.join(' ') : null; },
      enMemoire: function () { return enMemoire; },
      /**
       * Attache du pas d'historique que l'on rejoint (nouveau pas, annuler, rétablir) : la fiche `id` si elle existe
       * encore, sinon aucune. Le travail en cours est réécrit avec cette attache.
       */
      attacher: function (id) { var cible = id && B.trouver(liste, id) ? id : null; if (cible !== ouvert) { ouvert = cible; planifier(); } },
      activer: function () { actif = true; }, planifier: planifier, sauverTravail: sauverTravail, reprendre: reprendre,
      enregistrerSous: enregistrerSous, mettreAJour: mettreAJour, ouvrir: ouvrir, dupliquer: dupliquer, renommer: renommer,
      supprimer: supprimer, exporter: exporter, exporterSecours: exporterSecours, importerTexte: importerTexte,
      relire: function () { var change = relire(); if (change) rafraichir(); return change; }, surStockage: surStockage,
      stockage: function () { return stockage; }
    };
  }

  AT.vueBibliotheque.creer = creer;
})();
