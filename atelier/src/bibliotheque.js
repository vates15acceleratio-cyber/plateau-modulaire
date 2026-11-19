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
 * Texte enregistré ou exporté : { format: 'atelier-bibliotheque', version: 1, plateaux: [entrées] } (inchangé : une copie
 *   plus ancienne de l'atelier, dans le même navigateur, relit toujours la bibliothèque).
 * Compteur des fiches (clé « compteur ») : plus petit numéro de fiche encore jamais attribué. Un identifiant n'est
 *   JAMAIS réutilisé, même après une suppression : un plateau gardé dans l'historique d'une fenêtre ne peut pas se
 *   rattacher à une autre fiche.
 * Travail en cours             : { format: 'atelier-travail', version: 1, modifie, plateau, ouvert (facultatif) }.
 *   `ouvert` : identifiant de la fiche dont le plateau est issu, écrit DANS LA MÊME ÉCRITURE que le plateau.
 * Clés du stockage : REGLAGES.bibliotheque.prefixe + 'bibliotheque', + 'compteur', + 'travail', + 'secours' (liste des copies de
 * secours) et + 'secours:<origine>:<date>' (texte brut d'un contenu illisible, gardé avant d'être remplacé).
 * Les anciens stockages (sans compteur, sans `ouvert`, avec une clé « ouvert » à part) se relisent sans erreur.
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
  var NUMERO_MAX = 999999;            // plus grand numéro de fiche (forme de l'identifiant)
  var SECOURS_MAX = 5;                // copies de secours gardées (les plus anciennes sont retirées)
  var FORME_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
  var FORME_NOM_INTERDIT = /[\u0000-\u001f\u007f]/;
  var SUFFIXE_COPIE = ' (copie)';

  function bornes() { return C.REGLAGES.bibliotheque; }
  function cleListe() { return bornes().prefixe + 'bibliotheque'; }
  function cleTravail() { return bornes().prefixe + 'travail'; }
  function cleCompteur() { return bornes().prefixe + 'compteur'; }

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

  /** Numéro d'un identifiant de fiche (« b12 » → 12), ou 0 s'il n'a pas la forme attendue. */
  function numero(id) { return (typeof id === 'string' && FORME_ID.test(id)) ? parseInt(id.slice(1), 10) : 0; }

  /** Plus petit numéro jamais attribué d'après la liste seule : le plus grand numéro présent + 1. */
  function suivantDe(liste) {
    var max = 0;
    (Array.isArray(liste) ? liste : []).forEach(function (e) { if (e) max = Math.max(max, numero(e.id)); });
    return max + 1;
  }

  /**
   * Prochain identifiant : « b » + un numéro PLUS GRAND que tous ceux de la liste (jamais le numéro d'une fiche
   * supprimée entre deux fiches vivantes), au moins égal à `minimum` (compteur conservé dans le stockage : jamais
   * le numéro d'une fiche supprimée, même la dernière) et absent de `reserves`. Renvoie null si les numéros sont épuisés.
   */
  function prochainId(liste, reserves, minimum) {
    var pris = Object.create(null);
    (reserves || []).forEach(function (id) { pris[String(id)] = true; });
    var n = Math.max(suivantDe(liste), (Number.isInteger(minimum) && minimum > 0) ? minimum : 1);
    while (pris['b' + n] === true) n += 1;
    return n > NUMERO_MAX ? null : 'b' + n;
  }

  /**
   * Nom rendu unique dans la liste (sans tenir compte de la casse) : « Nom », puis « Nom (2) », « Nom (3) »…
   * `saufId` : fiche que l'on renomme (son propre nom ne compte pas). Renvoie {nom, change} ; nom = null s'il est invalide.
   */
  function nomUnique(liste, nom, saufId) {
    var n = nomUtile(nom);
    if (n === null) return { nom: null, change: false };
    var pris = Object.create(null);
    (Array.isArray(liste) ? liste : []).forEach(function (e) { if (e && e.id !== saufId && typeof e.nom === 'string') pris[e.nom.toLowerCase()] = true; });
    if (pris[n.toLowerCase()] !== true) return { nom: n, change: false };
    for (var i = 2; i < 10000; i++) {
      var suffixe = ' (' + i + ')', essai = n.slice(0, bornes().longueurNom - suffixe.length).trim() + suffixe;
      if (pris[essai.toLowerCase()] !== true) return { nom: essai, change: true };
    }
    return { nom: null, change: false };
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
    if (objet.version !== VERSION) return echec('Version de bibliothèque non reconnue (ce contenu vient peut-être d’une version plus récente de l’atelier).');
    if (!Array.isArray(objet.plateaux) || objet.plateaux.length > B.plateauxMax) return echec('Liste de plateaux invalide (' + B.plateauxMax + ' au plus).');
    var liste = [], avis = [], ids = Object.create(null);
    objet.plateaux.forEach(function (e, i) {
      var x = examinerEntree(e);
      if (x.ok && ids[x.entree.id] === true) x = { ok: false, raison: 'identifiant en double.' };
      if (!x.ok) { avis.push('Plateau n° ' + (i + 1) + ' écarté : ' + x.raison); return; }
      ids[x.entree.id] = true;
      liste.push(x.entree);
    });
    // Le compteur couvre aussi les entrées écartées : leur numéro ne sera pas redonné à une autre fiche.
    var suivant = suivantDe(liste);
    objet.plateaux.forEach(function (e) { if (estObjetSimple(e)) suivant = Math.max(suivant, numero(e.id) + 1); });
    return { ok: true, liste: liste, ecartees: avis.length, avis: avis.slice(0, 20), raison: null, suivant: suivant };
  }

  /**
   * Ajoute le plateau sous le nom donné. Renvoie {ok, liste, id, nom, renomme} ou {ok: false, liste, raison}
   * (bibliothèque pleine, nom ou plateau invalide).
   * options.minimum : numéro minimal de la nouvelle fiche (compteur du stockage : jamais d'identifiant réutilisé) ;
   * options.unique  : un nom déjà pris est numéroté (« Nom (2) ») ; `renomme` le signale.
   */
  function ajouter(liste, nom, plateau, date, options) {
    var B = bornes(), n = nomUtile(nom), d = dateUtile(date), o = options || {}, renomme = false;
    if (!Array.isArray(liste)) return refus(liste, 'Bibliothèque invalide.');
    if (liste.length >= B.plateauxMax) return refus(liste, 'Bibliothèque pleine : ' + B.plateauxMax + ' plateaux au plus. Supprimez-en un, ou exportez tout puis faites de la place.');
    if (n === null) return refus(liste, raisonNom());
    if (d === null) return refus(liste, 'Date invalide.');
    if (o.unique) {
      var u = nomUnique(liste, n);
      if (u.nom === null) return refus(liste, raisonNom());
      n = u.nom; renomme = u.change;
    }
    var pl = plateauUtile(plateau);
    if (!pl.ok) return refus(liste, pl.raison);
    var id = prochainId(liste, null, o.minimum), nouvelle = copieListe(liste);
    if (id === null) return refus(liste, 'Plus de numéro de fiche disponible : exportez la bibliothèque puis repartez d’une bibliothèque neuve.');
    nouvelle.push({ id: id, nom: n, modifie: d, plateau: pl.plateau });
    return { ok: true, liste: nouvelle, id: id, nom: n, renomme: renomme };
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

  /** Renomme l'entrée `id`. options.unique : un nom déjà pris par une AUTRE fiche est numéroté. Renvoie {ok, liste, id, nom, renomme}. */
  function renommer(liste, id, nom, date, options) {
    var n = nomUtile(nom), d = dateUtile(date), renomme = false;
    if (n === null) return refus(liste, raisonNom());
    if (d === null) return refus(liste, 'Date invalide.');
    if (options && options.unique) {
      var u = nomUnique(liste, n, id);
      if (u.nom === null) return refus(liste, raisonNom());
      n = u.nom; renomme = u.change;
    }
    var r = modifierEntree(liste, id, function (e) { e.nom = n; e.modifie = d; return e; });
    if (r.ok) { r.nom = n; r.renomme = renomme; }
    return r;
  }

  /**
   * Duplique l'entrée `id` : la copie est ajoutée en fin de liste, nommée « nom (copie) » (ou `nom` s'il est donné).
   * Renvoie {ok, liste, id (celui de la copie)}.
   */
  function dupliquer(liste, id, date, nom, options) {
    var source = trouver(liste, id);
    if (!source) return refus(liste, 'Plateau introuvable dans la bibliothèque.');
    var nomCopie = (nom === undefined || nom === null)
      ? source.nom.slice(0, bornes().longueurNom - SUFFIXE_COPIE.length).trim() + SUFFIXE_COPIE
      : nom;
    return ajouter(liste, nomCopie, source.plateau, date, options);
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

  /**
   * Fusion de deux listes de fiches, sans rien perdre : toutes les fiches de `locale`, puis celles de `distante`
   * qu'elle n'a pas. Même identifiant des deux côtés avec un contenu différent : la plus RÉCENTE gagne (date
   * `modifie` ; à égalité, la locale) et le conflit est rapporté.
   * Renvoie {liste, ajoutees: nombre, conflits: [{id, nom, garde: 'locale' | 'distante'}]}.
   */
  function fusionner(locale, distante) {
    var res = copieListe(locale), rangs = Object.create(null), ajoutees = 0, conflits = [];
    res.forEach(function (e, i) { rangs[e.id] = i; });
    copieListe(distante).forEach(function (e) {
      if (rangs[e.id] === undefined) { rangs[e.id] = res.length; res.push(e); ajoutees += 1; return; }
      var ici = res[rangs[e.id]];
      if (JSON.stringify(ici) === JSON.stringify(e)) return;
      var distanteGagne = Date.parse(e.modifie) > Date.parse(ici.modifie);
      conflits.push({ id: e.id, nom: distanteGagne ? e.nom : ici.nom, garde: distanteGagne ? 'distante' : 'locale' });
      if (distanteGagne) res[rangs[e.id]] = e;
    });
    return { liste: res, ajoutees: ajoutees, conflits: conflits };
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
  function importer(liste, texte, options) {
    var B = bornes(), o = options || {};
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
    // options.minimum : compteur du stockage (un identifiant du fichier déjà attribué ici autrefois est renuméroté) ;
    // options.unique : un nom déjà pris est numéroté.
    var renommes = 0, epuise = false;
    lu.liste.forEach(function (e) {
      var pris = liste.some(function (x) { return x.id === e.id; }) || (Number.isInteger(o.minimum) && numero(e.id) < o.minimum);
      var id = pris ? prochainId(nouvelle, reserves, o.minimum) : e.id, nom = e.nom;
      if (id === null) { epuise = true; return; }
      if (o.unique) { var u = nomUnique(nouvelle, nom); if (u.nom !== null && u.change) { nom = u.nom; renommes += 1; } }
      correspondance[e.id] = id;
      nouvelle.push({ id: id, nom: nom, modifie: e.modifie, plateau: e.plateau });
    });
    if (epuise) return refus(liste, 'Import refusé : plus de numéro de fiche disponible.');
    return { ok: true, liste: nouvelle, ajoutes: lu.liste.length, ecartees: lu.ecartees, avis: lu.avis, correspondance: correspondance, renommes: renommes };
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
    if (!lu.ok) return { ok: false, liste: [], ecartees: 0, avis: [], raison: lu.raison, absent: true, brut: null, suivant: 1 };
    var compteur = lireCompteur(stockage);
    if (lu.texte === null) return { ok: true, liste: [], ecartees: 0, avis: [], raison: null, brut: null, suivant: compteur };
    var r = lire(lu.texte);
    // `brut` : le texte tel qu'il est dans le stockage (pour détecter un changement fait par une autre fenêtre, et
    // pour en garder une copie de secours avant de le remplacer s'il est illisible ou porte des fiches écartées).
    // `suivant` : compteur des fiches (clé « compteur »), jamais plus petit que le plus grand numéro présent + 1.
    if (!r.ok) return { ok: false, liste: [], ecartees: 0, avis: [], raison: 'Bibliothèque enregistrée illisible : ' + r.raison, corrompu: true, brut: lu.texte, suivant: compteur };
    r.brut = lu.texte;
    r.suivant = Math.max(r.suivant, compteur);
    return r;
  }

  /** Compteur des fiches lu dans sa clé : entier de 1 à 1 000 000 ; 1 si la clé est absente ou illisible. */
  function lireCompteur(stockage) {
    var lu = lireCle(stockage, cleCompteur());
    if (!lu.ok || typeof lu.texte !== 'string' || !/^[1-9][0-9]{0,6}$/.test(lu.texte)) return 1;
    return Math.min(NUMERO_MAX + 1, parseInt(lu.texte, 10));
  }

  /**
   * Enregistre la liste dans le stockage, après l'avoir validée en entier (une liste fautive n'est jamais écrite).
   * `suivant` (facultatif) : compteur des fiches. Il est écrit dans SA clé, AVANT la liste (si la liste n'est pas
   * écrite ensuite, un compteur en avance est sans conséquence) ; il ne recule jamais.
   * Renvoie {ok, raison, plein, absent, texte (le texte écrit)}. En cas d'échec, la liste précédente du stockage est intacte.
   */
  function enregistrer(stockage, liste, suivant) {
    var B = bornes(), avis = valider({ format: FORMAT, version: VERSION, plateaux: Array.isArray(liste) ? liste : null });
    if (!avis.ok) return { ok: false, raison: avis.raison };
    if (avis.ecartees) return { ok: false, raison: 'Bibliothèque non enregistrée : ' + avis.avis[0] };
    var texte = exporter(avis.liste);
    if (texte.length > B.tailleMax) return { ok: false, raison: 'Bibliothèque trop volumineuse pour être enregistrée : supprimez des plateaux.', plein: true };
    if (Number.isInteger(suivant) && suivant >= 1) {
      var compteur = Math.min(NUMERO_MAX + 1, Math.max(suivant, suivantDe(avis.liste), lireCompteur(stockage)));
      var c = ecrireCle(stockage, cleCompteur(), String(compteur));
      if (!c.ok) return c;
    }
    var r = ecrireCle(stockage, cleListe(), texte);
    if (r.ok) r.texte = texte;
    return r;
  }

  // ------------------------------------------------------------------ copies de secours

  function cleSecours() { return bornes().prefixe + 'secours'; }

  /** Clés des copies de secours connues (liste tenue dans la clé « secours »), de la plus ancienne à la plus récente. */
  function clesSecours(stockage) {
    var lu = lireCle(stockage, cleSecours()), liste;
    if (!lu.ok || lu.texte === null) return [];
    try { liste = JSON.parse(lu.texte); } catch (x) { return []; }
    var prefixe = cleSecours() + ':';
    return Array.isArray(liste) ? liste.filter(function (k) { return typeof k === 'string' && k.length < 120 && k.indexOf(prefixe) === 0; }).slice(-SECOURS_MAX * 2) : [];
  }

  /**
   * Garde une copie de secours d'un texte du stockage AVANT qu'il soit remplacé (contenu illisible, version inconnue,
   * fiches écartées). `origine` : 'bibliotheque' ou 'travail'. La clé porte la date. Le même texte n'est pas copié
   * deux fois de suite ; les copies les plus anciennes sont retirées au-delà de 5.
   * Renvoie {ok, cle, deja, raison, plein, absent}.
   */
  function sauverSecours(stockage, origine, texte, date) {
    var d = dateUtile(date);
    if (d === null || (origine !== 'bibliotheque' && origine !== 'travail') || typeof texte !== 'string') return { ok: false, raison: 'Copie de secours invalide.' };
    var cles = clesSecours(stockage), prefixe = cleSecours() + ':' + origine + ':';
    for (var i = cles.length - 1; i >= 0; i--) {
      if (cles[i].indexOf(prefixe) !== 0) continue;
      var ancien = lireCle(stockage, cles[i]);
      if (ancien.ok && ancien.texte === texte) return { ok: true, cle: cles[i], deja: true, raison: null };
      break;
    }
    var cle = prefixe + d, n = 1;
    while (cles.indexOf(cle) !== -1) { n += 1; cle = prefixe + d + '-' + n; }
    var ecrit = ecrireCle(stockage, cle, texte);
    if (!ecrit.ok) return ecrit;
    cles.push(cle);
    while (cles.length > SECOURS_MAX) {
      var retiree = cles.shift();
      try { stockage.removeItem(retiree); } catch (x) { /* copie ancienne : sans conséquence */ }
    }
    var index = ecrireCle(stockage, cleSecours(), JSON.stringify(cles));
    if (!index.ok) { try { stockage.removeItem(cle); } catch (x) { /* rien */ } return index; }
    return { ok: true, cle: cle, deja: false, raison: null };
  }

  /** Copies de secours présentes : [{cle, origine, date, texte}], de la plus ancienne à la plus récente. */
  function listerSecours(stockage) {
    var res = [], prefixe = cleSecours() + ':';
    clesSecours(stockage).forEach(function (k) {
      var lu = lireCle(stockage, k);
      if (!lu.ok || lu.texte === null) return;
      var reste = k.slice(prefixe.length), i = reste.indexOf(':');
      res.push({ cle: k, origine: i > 0 ? reste.slice(0, i) : '', date: i > 0 ? reste.slice(i + 1) : '', texte: lu.texte });
    });
    return res;
  }

  /** Texte JSON de toutes les copies de secours (pour les sortir du navigateur dans un fichier). */
  function exporterSecours(stockage) {
    return JSON.stringify({ format: 'atelier-secours', version: VERSION, copies: listerSecours(stockage) }, null, 1);
  }

  /**
   * Travail en cours (sauvegarde automatique). Renvoie {ok, plateau (null s'il n'y en a pas), modifie,
   * ouvert (identifiant de la fiche dont le plateau est issu, ou null), raison, absent, corrompu, brut}.
   * Un ancien travail sans champ `ouvert` se relit (ouvert = null).
   */
  function chargerTravail(stockage) {
    var lu = lireCle(stockage, cleTravail());
    if (!lu.ok) return { ok: false, plateau: null, modifie: null, ouvert: null, raison: lu.raison, absent: true, brut: null };
    if (lu.texte === null) return { ok: true, plateau: null, modifie: null, ouvert: null, raison: null, brut: null };
    var illisible = function (raison) { return { ok: false, plateau: null, modifie: null, ouvert: null, raison: 'Travail en cours illisible : ' + raison, corrompu: true, brut: lu.texte }; };
    if (typeof lu.texte !== 'string' || lu.texte.length > C.REGLAGES.bornes.tailleFichier + 200) return illisible('contenu trop volumineux.');
    var objet;
    try { objet = JSON.parse(lu.texte); } catch (x) { return illisible('ce n’est pas du JSON valide.'); }
    var champs = ['format', 'version', 'modifie', 'plateau'];
    if (estObjetSimple(objet) && possede.call(objet, 'ouvert')) champs.push('ouvert');            // champ facultatif
    if (!estObjetSimple(objet) || !champsExacts(objet, champs) || objet.format !== FORMAT_TRAVAIL || objet.version !== VERSION
      || !dateValide(objet.modifie)) return illisible('structure inattendue.');
    if (possede.call(objet, 'ouvert') && !(typeof objet.ouvert === 'string' && FORME_ID.test(objet.ouvert))) return illisible('fiche ouverte invalide.');
    var pl = plateauUtile(objet.plateau);
    if (!pl.ok) return illisible(pl.raison);
    return { ok: true, plateau: pl.plateau, modifie: objet.modifie, ouvert: possede.call(objet, 'ouvert') ? objet.ouvert : null, raison: null, brut: lu.texte };
  }

  /**
   * Enregistre le plateau comme travail en cours, avec l'identifiant de la fiche dont il est issu (`ouvert`, ou
   * null) : une seule écriture, donc jamais un plateau repris avec l'attache d'un autre.
   * Renvoie {ok, raison, plein, absent}.
   */
  function enregistrerTravail(stockage, plateau, date, ouvert) {
    var d = dateUtile(date), pl = plateauUtile(plateau);
    if (d === null) return { ok: false, raison: 'Date invalide.' };
    if (!pl.ok) return { ok: false, raison: pl.raison };
    var objet = { format: FORMAT_TRAVAIL, version: VERSION, modifie: d, plateau: pl.plateau };
    if (typeof ouvert === 'string' && FORME_ID.test(ouvert)) objet.ouvert = ouvert;
    return ecrireCle(stockage, cleTravail(), JSON.stringify(objet));
  }

  /** Efface le travail en cours. Renvoie {ok, raison, absent}. */
  function effacerTravail(stockage) {
    if (!stockageUtilisable(stockage)) return { ok: false, raison: RAISON_ABSENT, absent: true };
    try { stockage.removeItem(cleTravail()); } catch (x) { return { ok: false, raison: 'Le stockage du navigateur a refusé l’effacement.', absent: true }; }
    return { ok: true, raison: null };
  }

  AT.bibliotheque = {
    FORMAT: FORMAT, FORMAT_TRAVAIL: FORMAT_TRAVAIL, VERSION: VERSION, cleListe: cleListe, cleTravail: cleTravail, cleCompteur: cleCompteur,
    // logique pure
    vide: vide, trouver: trouver, prochainId: prochainId, numero: numero, suivantDe: suivantDe, nomUnique: nomUnique,
    ajouter: ajouter, remplacer: remplacer, renommer: renommer, dupliquer: dupliquer, supprimer: supprimer,
    valider: valider, exporter: exporter, lire: lire, importer: importer, fusionner: fusionner,
    // stockage injecté
    stockageNavigateur: stockageNavigateur, stockageMemoire: stockageMemoire,
    charger: charger, enregistrer: enregistrer,
    chargerTravail: chargerTravail, enregistrerTravail: enregistrerTravail, effacerTravail: effacerTravail,
    lireBrut: lireCle, sauverSecours: sauverSecours, listerSecours: listerSecours, exporterSecours: exporterSecours, cleSecours: cleSecours
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.bibliotheque;
})();
