/*
 * bibliotheque.js : bibliothèque de plateaux et « travail en cours » (docs/02-atelier-cahier-des-charges.md, §8.1).
 * Aucun accès au DOM. Dépend de AT.catalogue et AT.plateau. Rien n'est lu ni écrit au chargement du script.
 *
 * Deux parties :
 *   1. logique PURE sur une liste d'entrées {id, nom, modifie, plateau}, jamais modifiée en place :
 *      ajouter, remplacer, renommer, dupliquer, supprimer, exporter tout, importer (fusion sans collision d'identifiants) ;
 *   2. stockage INJECTÉ : tout objet à getItem / setItem / removeItem (localStorage, ou stockageMemoire() pour les
 *      tests et en repli). Le stockage est une entrée NON FIABLE : tout ce qui en sort est validé (taille, JSON,
 *      structure, plateau par AT.plateau.valider). Stockage absent, plein ou illisible : jamais d'exception, un
 *      résultat {ok: false, raison} avec un drapeau (absent, plein, corrompu).
 *
 * Entrée : { id: 'b12', nom: texte de 1 à 60 caractères, modifie: date ISO 8601 UTC, plateau: plateau du lot A }.
 * Texte enregistré ou exporté : { format: 'atelier-bibliotheque', version: 1, plateaux: [entrées] }.
 * Travail en cours             : { format: 'atelier-travail', version: 1, modifie, plateau }.
 * Clés du stockage : REGLAGES.bibliotheque.prefixe + 'bibliotheque' et + 'travail'.
 *
 * Les fonctions qui datent une entrée reçoivent la date en dernier paramètre (texte ISO, par exemple
 * new Date().toISOString()) ; sans ce paramètre, l'heure courante est prise.
 * Toutes renvoient {ok: true, liste, ...} ou {ok: false, liste (inchangée), raison}.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }
  var C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;

  var FORMAT = 'atelier-bibliotheque', FORMAT_TRAVAIL = 'atelier-travail', VERSION = 1;
  var FORME_ID = /^b[1-9][0-9]{0,5}$/;
  var FORME_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
  var FORME_NOM_INTERDIT = /[\u0000-\u001f\u007f]/;
  var SUFFIXE_COPIE = ' (copie)';

  function bornes() { return C.REGLAGES.bibliotheque; }
  function cleListe() { return bornes().prefixe + 'bibliotheque'; }
  function cleTravail() { return bornes().prefixe + 'travail'; }

  function estObjetSimple(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o)
      && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
  }

  /** Vrai si l'objet a exactement les champs attendus (ni manquant, ni inconnu, « __proto__ » compris). */
  function champsExacts(o, attendus) {
    var cles = Object.keys(o);
    return cles.length === attendus.length && attendus.every(function (k) { return possede.call(o, k); });
  }

  function refus(liste, raison, drapeaux) {
    var r = { ok: false, liste: liste, raison: raison };
    if (drapeaux) Object.keys(drapeaux).forEach(function (k) { r[k] = drapeaux[k]; });
    return r;
  }

  function dateValide(d) { return typeof d === 'string' && FORME_DATE.test(d) && !isNaN(Date.parse(d)); }

  /** Date à inscrire : celle reçue si elle est valide, l'heure courante si elle est omise, null si elle est fausse. */
  function dateUtile(date) {
    if (date === undefined || date === null) return new Date().toISOString();
    return dateValide(date) ? date : null;
  }

  /** Nom nettoyé (espaces de bord retirés), ou null s'il est vide, trop long ou porte un caractère de contrôle. */
  function nomUtile(nom) {
    if (typeof nom !== 'string') return null;
    var n = nom.trim();
    return (n.length >= 1 && n.length <= bornes().longueurNom && !FORME_NOM_INTERDIT.test(n)) ? n : null;
  }

  function raisonNom() { return 'Nom invalide : 1 à ' + bornes().longueurNom + ' caractères.'; }

  function copieEntree(e) { return { id: e.id, nom: e.nom, modifie: e.modifie, plateau: JSON.parse(JSON.stringify(e.plateau)) }; }

  function copieListe(liste) { return (Array.isArray(liste) ? liste : []).map(copieEntree); }

  /** Plateau validé et reconstruit par AT.plateau.valider : {ok, plateau, raison}. */
  function plateauUtile(plateau) {
    var avis;
    try { avis = P.valider(plateau); } catch (x) { avis = null; }
    if (!avis || !avis.ok) return { ok: false, plateau: null, raison: 'Plateau invalide : ' + ((avis && avis.erreurs[0]) || 'structure illisible.') };
    return { ok: true, plateau: avis.plateau, raison: null };
  }

  // ------------------------------------------------------------------ 1. logique pure

  /** Bibliothèque vide. */
  function vide() { return []; }

  /** Entrée d'identifiant `id` (copie), ou null. */
  function trouver(liste, id) {
    var e = (Array.isArray(liste) ? liste : []).filter(function (x) { return x && x.id === id; })[0];
    return e ? copieEntree(e) : null;
  }

  /** Prochain identifiant libre : « b » + le plus petit numéro ni dans la liste, ni dans `reserves`. */
  function prochainId(liste, reserves) {
    var pris = Object.create(null);
    (Array.isArray(liste) ? liste : []).forEach(function (e) { if (e) pris[String(e.id)] = true; });
    (reserves || []).forEach(function (id) { pris[String(id)] = true; });
    var n = 1;
    while (pris['b' + n] === true) n += 1;
    return 'b' + n;
  }

  /**
   * Examine une entrée venue d'une source non fiable. Renvoie {ok, entree (copie propre), raison}.
   */
  function examinerEntree(e) {
    if (!estObjetSimple(e) || !champsExacts(e, ['id', 'nom', 'modifie', 'plateau'])) return { ok: false, entree: null, raison: 'champs inattendus ou manquants.' };
    if (typeof e.id !== 'string' || !FORME_ID.test(e.id)) return { ok: false, entree: null, raison: 'identifiant invalide.' };
    if (nomUtile(e.nom) === null || e.nom !== e.nom.trim()) return { ok: false, entree: null, raison: 'nom invalide.' };
    if (!dateValide(e.modifie)) return { ok: false, entree: null, raison: 'date invalide.' };
    var pl = plateauUtile(e.plateau);
    if (!pl.ok) return { ok: false, entree: null, raison: pl.raison };
    return { ok: true, entree: { id: e.id, nom: e.nom, modifie: e.modifie, plateau: pl.plateau }, raison: null };
  }

  /**
   * Valide strictement un objet {format, version, plateaux} (lu dans le stockage ou dans un fichier d'export).
   * L'enveloppe doit être exacte, sinon tout est refusé. Une entrée fautive (ou d'identifiant déjà vu) est ÉCARTÉE
   * sans faire perdre les autres : `ecartees` les compte et `avis` dit pourquoi.
   * Renvoie {ok, liste, ecartees, avis: [textes], raison}.
   */
  function valider(objet) {
    var B = bornes(), echec = function (raison) { return { ok: false, liste: [], ecartees: 0, avis: [], raison: raison }; };
    if (!estObjetSimple(objet) || !champsExacts(objet, ['format', 'version', 'plateaux'])) return echec('Ce contenu n’est pas une bibliothèque de plateaux.');
    if (objet.format !== FORMAT) return echec('Ce contenu n’est pas une bibliothèque de plateaux.');
    if (objet.version !== VERSION) return echec('Version de bibliothèque non reconnue.');
    if (!Array.isArray(objet.plateaux) || objet.plateaux.length > B.plateauxMax) return echec('Liste de plateaux invalide (' + B.plateauxMax + ' au plus).');
    var liste = [], avis = [], ids = Object.create(null);
    objet.plateaux.forEach(function (e, i) {
      var x = examinerEntree(e);
      if (x.ok && ids[x.entree.id] === true) x = { ok: false, raison: 'identifiant en double.' };
      if (!x.ok) { avis.push('Plateau n° ' + (i + 1) + ' écarté : ' + x.raison); return; }
      ids[x.entree.id] = true;
      liste.push(x.entree);
    });
    return { ok: true, liste: liste, ecartees: avis.length, avis: avis.slice(0, 20), raison: null };
  }

  /**
   * Ajoute le plateau sous le nom donné. Renvoie {ok, liste, id} ou {ok: false, liste, raison}
   * (bibliothèque pleine, nom ou plateau invalide).
   */
  function ajouter(liste, nom, plateau, date) {
    var B = bornes(), n = nomUtile(nom), d = dateUtile(date);
    if (!Array.isArray(liste)) return refus(liste, 'Bibliothèque invalide.');
    if (liste.length >= B.plateauxMax) return refus(liste, 'Bibliothèque pleine : ' + B.plateauxMax + ' plateaux au plus. Supprimez-en un, ou exportez tout puis faites de la place.');
    if (n === null) return refus(liste, raisonNom());
    if (d === null) return refus(liste, 'Date invalide.');
    var pl = plateauUtile(plateau);
    if (!pl.ok) return refus(liste, pl.raison);
    var id = prochainId(liste), nouvelle = copieListe(liste);
    nouvelle.push({ id: id, nom: n, modifie: d, plateau: pl.plateau });
    return { ok: true, liste: nouvelle, id: id };
  }

  /** Modifie l'entrée `id` par `changer(entree)` (copie) ; refus si elle est introuvable. */
  function modifierEntree(liste, id, changer) {
    if (!Array.isArray(liste) || !liste.some(function (e) { return e && e.id === id; })) return refus(liste, 'Plateau introuvable dans la bibliothèque.');
    return { ok: true, liste: copieListe(liste).map(function (e) { return e.id === id ? changer(e) : e; }), id: id };
  }

  /** Remplace le plateau de l'entrée `id` (« enregistrer » sur un plateau déjà en bibliothèque). Renvoie {ok, liste, id}. */
  function remplacer(liste, id, plateau, date) {
    var d = dateUtile(date), pl = plateauUtile(plateau);
    if (d === null) return refus(liste, 'Date invalide.');
    if (!pl.ok) return refus(liste, pl.raison);
    return modifierEntree(liste, id, function (e) { e.plateau = pl.plateau; e.modifie = d; return e; });
  }

  /** Renomme l'entrée `id`. Renvoie {ok, liste, id}. */
  function renommer(liste, id, nom, date) {
    var n = nomUtile(nom), d = dateUtile(date);
    if (n === null) return refus(liste, raisonNom());
    if (d === null) return refus(liste, 'Date invalide.');
    return modifierEntree(liste, id, function (e) { e.nom = n; e.modifie = d; return e; });
  }

  /**
   * Duplique l'entrée `id` : la copie est ajoutée en fin de liste, nommée « nom (copie) » (ou `nom` s'il est donné).
   * Renvoie {ok, liste, id (celui de la copie)}.
   */
  function dupliquer(liste, id, date, nom) {
    var source = trouver(liste, id);
    if (!source) return refus(liste, 'Plateau introuvable dans la bibliothèque.');
    var nomCopie = nom === undefined
      ? source.nom.slice(0, bornes().longueurNom - SUFFIXE_COPIE.length).trim() + SUFFIXE_COPIE
      : nom;
    return ajouter(liste, nomCopie, source.plateau, date);
  }

  /** Supprime l'entrée `id`. Renvoie {ok, liste, id}. */
  function supprimer(liste, id) {
    if (!Array.isArray(liste) || !liste.some(function (e) { return e && e.id === id; })) return refus(liste, 'Plateau introuvable dans la bibliothèque.');
    return { ok: true, liste: copieListe(liste).filter(function (e) { return e.id !== id; }), id: id };
  }

  /** Texte JSON de toute la bibliothèque (export, et forme enregistrée dans le stockage). */
  function exporter(liste) {
    return JSON.stringify({ format: FORMAT, version: VERSION, plateaux: copieListe(liste) });
  }

  /** Lit un texte de bibliothèque : taille bornée, JSON, puis valider(). Renvoie {ok, liste, ecartees, avis, raison}. */
  function lire(texte) {
    var echec = function (raison) { return { ok: false, liste: [], ecartees: 0, avis: [], raison: raison }; };
    if (typeof texte !== 'string') return echec('Contenu illisible.');
    if (texte.length > bornes().tailleMax) return echec('Contenu trop volumineux pour une bibliothèque de plateaux.');
    var objet;
    try { objet = JSON.parse(texte); } catch (x) { return echec('Ce contenu n’est pas du JSON valide.'); }
    return valider(objet);
  }

  /**
   * Importe le texte d'un export dans la liste : FUSION. Une entrée importée garde son identifiant s'il est libre,
   * sinon elle reçoit le prochain identifiant libre (jamais de collision, rien n'est écrasé). Tout ou rien si la
   * bibliothèque dépasserait sa borne. Les entrées fautives du fichier sont écartées (voir valider).
   * Renvoie {ok, liste, ajoutes: nombre, ecartees, avis, correspondance: {idFichier: idBibliotheque}}
   * ou {ok: false, liste (inchangée), raison}.
   */
  function importer(liste, texte) {
    var B = bornes();
    if (!Array.isArray(liste)) return refus(liste, 'Bibliothèque invalide.');
    var lu = lire(texte);
    if (!lu.ok) return refus(liste, 'Import refusé : ' + lu.raison);
    if (!lu.liste.length) return refus(liste, lu.ecartees ? 'Import refusé : aucun plateau valide dans ce fichier (' + lu.avis[0] + ').' : 'Ce fichier ne contient aucun plateau.');
    if (liste.length + lu.liste.length > B.plateauxMax) {
      return refus(liste, 'Import refusé : la bibliothèque aurait ' + (liste.length + lu.liste.length) + ' plateaux, pour ' + B.plateauxMax + ' au plus.');
    }
    var nouvelle = copieListe(liste), correspondance = {};
    // Un identifiant du fichier encore libre ici est gardé : il n'est donc pas donné à une entrée renumérotée.
    var reserves = lu.liste.map(function (e) { return e.id; });
    lu.liste.forEach(function (e) {
      var id = liste.some(function (x) { return x.id === e.id; }) ? prochainId(nouvelle, reserves) : e.id;
      correspondance[e.id] = id;
      nouvelle.push({ id: id, nom: e.nom, modifie: e.modifie, plateau: e.plateau });
    });
    return { ok: true, liste: nouvelle, ajoutes: lu.liste.length, ecartees: lu.ecartees, avis: lu.avis, correspondance: correspondance };
  }

  // ------------------------------------------------------------------ 2. stockage injecté

  var RAISON_ABSENT = 'Stockage du navigateur indisponible : rien ne peut être conservé sur ce poste. Utilisez « Exporter tout » et les fichiers.';

  function stockageUtilisable(s) {
    try {
      return !!s && typeof s.getItem === 'function' && typeof s.setItem === 'function' && typeof s.removeItem === 'function';
    } catch (x) { return false; }
  }

  /** localStorage du navigateur s'il existe et répond, sinon null (navigation privée, réglage, Node). Jamais d'exception. */
  function stockageNavigateur() {
    try {
      var g = typeof globalThis !== 'undefined' ? globalThis : window;
      var s = g.localStorage;
      if (!stockageUtilisable(s)) return null;
      s.getItem(cleListe());                      // un accès réel : certains navigateurs ne refusent qu'à ce moment
      return s;
    } catch (x) { return null; }
  }

  /** Stockage en mémoire, de même interface (tests, repli le temps de la session). options.quota : caractères au plus. */
  function stockageMemoire(options) {
    var donnees = Object.create(null), quota = options && options.quota;
    return {
      getItem: function (k) { return possede.call(donnees, k) ? donnees[k] : null; },
      setItem: function (k, v) {
        var total = String(v).length;
        Object.keys(donnees).forEach(function (x) { if (x !== String(k)) total += donnees[x].length; });
        if (typeof quota === 'number' && total > quota) { var e = new Error('quota dépassé'); e.name = 'QuotaExceededError'; throw e; }
        donnees[String(k)] = String(v);
      },
      removeItem: function (k) { delete donnees[String(k)]; }
    };
  }

  function estQuota(x) {
    return !!x && (x.name === 'QuotaExceededError' || x.name === 'NS_ERROR_DOM_QUOTA_REACHED' || x.code === 22 || x.code === 1014);
  }

  /** Lit une clé : {ok, texte (null si la clé n'existe pas), raison, absent}. */
  function lireCle(stockage, cle) {
    if (!stockageUtilisable(stockage)) return { ok: false, texte: null, raison: RAISON_ABSENT, absent: true };
    var v;
    try { v = stockage.getItem(cle); } catch (x) { return { ok: false, texte: null, raison: 'Le stockage du navigateur a refusé la lecture.', absent: true }; }
    if (v === null || v === undefined) return { ok: true, texte: null, raison: null };
    return { ok: true, texte: v, raison: null };
  }

  /** Écrit une clé : {ok, raison, plein, absent}. */
  function ecrireCle(stockage, cle, texte) {
    if (!stockageUtilisable(stockage)) return { ok: false, raison: RAISON_ABSENT, absent: true };
    try { stockage.setItem(cle, texte); } catch (x) {
      return estQuota(x)
        ? { ok: false, raison: 'Stockage du navigateur plein : rien n’a été enregistré. Supprimez des plateaux de la bibliothèque, ou exportez tout.', plein: true }
        : { ok: false, raison: 'Le stockage du navigateur a refusé l’écriture : rien n’a été enregistré.', absent: true };
    }
    return { ok: true, raison: null };
  }

  /**
   * Charge la bibliothèque du stockage. Clé absente : bibliothèque vide (ok). Contenu illisible : {ok: false,
   * corrompu: true} ; le contenu fautif est laissé en place (il ne sera remplacé qu'au prochain enregistrer).
   * Renvoie {ok, liste, ecartees, avis, raison, absent, corrompu}.
   */
  function charger(stockage) {
    var lu = lireCle(stockage, cleListe());
    if (!lu.ok) return { ok: false, liste: [], ecartees: 0, avis: [], raison: lu.raison, absent: true };
    if (lu.texte === null) return { ok: true, liste: [], ecartees: 0, avis: [], raison: null };
    var r = lire(lu.texte);
    if (!r.ok) return { ok: false, liste: [], ecartees: 0, avis: [], raison: 'Bibliothèque enregistrée illisible : ' + r.raison, corrompu: true };
    return r;
  }

  /**
   * Enregistre la liste dans le stockage, après l'avoir validée en entier (une liste fautive n'est jamais écrite).
   * Renvoie {ok, raison, plein, absent}. En cas d'échec, le contenu précédent du stockage est intact.
   */
  function enregistrer(stockage, liste) {
    var B = bornes(), avis = valider({ format: FORMAT, version: VERSION, plateaux: Array.isArray(liste) ? liste : null });
    if (!avis.ok) return { ok: false, raison: avis.raison };
    if (avis.ecartees) return { ok: false, raison: 'Bibliothèque non enregistrée : ' + avis.avis[0] };
    var texte = exporter(avis.liste);
    if (texte.length > B.tailleMax) return { ok: false, raison: 'Bibliothèque trop volumineuse pour être enregistrée : supprimez des plateaux.', plein: true };
    return ecrireCle(stockage, cleListe(), texte);
  }

  /**
   * Travail en cours (sauvegarde automatique). Renvoie {ok, plateau (null s'il n'y en a pas), modifie, raison, absent, corrompu}.
   */
  function chargerTravail(stockage) {
    var lu = lireCle(stockage, cleTravail());
    if (!lu.ok) return { ok: false, plateau: null, modifie: null, raison: lu.raison, absent: true };
    if (lu.texte === null) return { ok: true, plateau: null, modifie: null, raison: null };
    var illisible = function (raison) { return { ok: false, plateau: null, modifie: null, raison: 'Travail en cours illisible : ' + raison, corrompu: true }; };
    if (typeof lu.texte !== 'string' || lu.texte.length > C.REGLAGES.bornes.tailleFichier + 200) return illisible('contenu trop volumineux.');
    var objet;
    try { objet = JSON.parse(lu.texte); } catch (x) { return illisible('ce n’est pas du JSON valide.'); }
    if (!estObjetSimple(objet) || !champsExacts(objet, ['format', 'version', 'modifie', 'plateau']) || objet.format !== FORMAT_TRAVAIL || objet.version !== VERSION
      || !dateValide(objet.modifie)) return illisible('structure inattendue.');
    var pl = plateauUtile(objet.plateau);
    if (!pl.ok) return illisible(pl.raison);
    return { ok: true, plateau: pl.plateau, modifie: objet.modifie, raison: null };
  }

  /** Enregistre le plateau comme travail en cours. Renvoie {ok, raison, plein, absent}. */
  function enregistrerTravail(stockage, plateau, date) {
    var d = dateUtile(date), pl = plateauUtile(plateau);
    if (d === null) return { ok: false, raison: 'Date invalide.' };
    if (!pl.ok) return { ok: false, raison: pl.raison };
    return ecrireCle(stockage, cleTravail(), JSON.stringify({ format: FORMAT_TRAVAIL, version: VERSION, modifie: d, plateau: pl.plateau }));
  }

  /** Efface le travail en cours. Renvoie {ok, raison, absent}. */
  function effacerTravail(stockage) {
    if (!stockageUtilisable(stockage)) return { ok: false, raison: RAISON_ABSENT, absent: true };
    try { stockage.removeItem(cleTravail()); } catch (x) { return { ok: false, raison: 'Le stockage du navigateur a refusé l’effacement.', absent: true }; }
    return { ok: true, raison: null };
  }

  AT.bibliotheque = {
    FORMAT: FORMAT, FORMAT_TRAVAIL: FORMAT_TRAVAIL, VERSION: VERSION, cleListe: cleListe, cleTravail: cleTravail,
    // logique pure
    vide: vide, trouver: trouver, prochainId: prochainId,
    ajouter: ajouter, remplacer: remplacer, renommer: renommer, dupliquer: dupliquer, supprimer: supprimer,
    valider: valider, exporter: exporter, lire: lire, importer: importer,
    // stockage injecté
    stockageNavigateur: stockageNavigateur, stockageMemoire: stockageMemoire,
    charger: charger, enregistrer: enregistrer,
    chargerTravail: chargerTravail, enregistrerTravail: enregistrerTravail, effacerTravail: effacerTravail
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.bibliotheque;
})();
