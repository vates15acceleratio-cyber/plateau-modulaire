/*
 * sauvegarde.js : export et import JSON du document, sauvegarde automatique (localStorage).
 * Fonctions pures (sans DOM) : versJSON, depuisJSON, bibliothequeVersJSON, fusionnerBibliotheque.
 * Fonctions navigateur : telecharger, ouvrirFichier, autosave, restaurerAutosave, effacerAutosave.
 * Une entrée de fichier invalide ne lève jamais d'exception : elle donne ok:false avec des erreurs.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele;
  var FORMAT = 'plateau-modulaire';
  var VERSION = 1;
  var CLE_AUTOSAVE = 'plateau-modulaire:autosave';
  /**
   * Plafonds à l'ouverture d'un fichier (audit de sécurité : un fichier hostile ne doit pas bloquer le
   * navigateur). Très au-dessus de tout usage normal : 4×4 tuiles, 9 jetons, une vingtaine de modèles.
   */
  var LIMITES = { octets: 5e6, modeles: 500, cases: 64, chemins: 256, tuiles: 64, jetons: 64, retires: 16, texte: 200, coordonnee: 1000, exemplaires: 999 };
  /** Intervalle minimal entre deux écritures dans localStorage (ms). */
  var DELAI_AUTOSAVE = 1000;
  /** Délai de repli après retour du focus, pour détecter une annulation sans événement `cancel` (ms). */
  var DELAI_REPLI_ANNULATION = 1500;
  var TYPES_JETON = ['capture', 'carrefour'];

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }
  function tab(x) { return Array.isArray(x) ? x : []; }
  function estObjet(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function estEntier(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function estId(x) { return typeof x === 'string' && x.length > 0; }
  function erreur(code, message) { return { code: code, message: message }; }
  function texteErreur(e) { return (e && e.message) || String(e); }
  function echecLecture(code, message) { return { ok: false, doc: null, erreurs: [erreur(code, message)], alertes: [] }; }

  /** Premier identifiant « base-2 », « base-3 »… absent de `pris` (dictionnaire d'identifiants). */
  function idLibre(base, pris) {
    var n = 2;
    while (pris[base + '-' + n]) n++;
    return base + '-' + n;
  }

  /* ------------------------------------------------------------------ */
  /* Normalisation : ne garde que les champs connus, clone en profondeur  */
  /* ------------------------------------------------------------------ */

  /** Modèle nettoyé (champs connus). Un modèle invalide est conservé comme brouillon et signalé. */
  function normaliserModele(brut, alertes) {
    var nom = typeof brut.nom === 'string' ? brut.nom : '';
    var libelle = nom || brut.id;
    var exemplaires = brut.exemplaires;
    if (!(estEntier(exemplaires) && exemplaires >= 0 && exemplaires <= LIMITES.exemplaires)) {
      exemplaires = 0;
      alertes.push(erreur('exemplaires_invalides', 'Le modèle « ' + libelle + ' » : nombre d\'exemplaires invalide, ramené à 0.'));
    }
    var ignores = 0;
    // Sécurité (docs/11-revue-interface.md, B1) : seuls les champs connus sont gardés, avec leur type
    // attendu (nombres finis pour les coordonnées, textes pour les ids) ; un fichier piégé ne doit pas
    // pouvoir glisser du balisage dans le SVG de l'interface.
    function texteOuNul(v) {
      var t = typeof v === 'string' ? v : (typeof v === 'number' && isFinite(v) ? String(v) : null);
      return t !== null && t.length > LIMITES.texte ? t.slice(0, LIMITES.texte) : t;
    }
    function nombre(v) { return typeof v === 'number' && isFinite(v) && Math.abs(v) <= LIMITES.coordonnee; }
    function normaliserCase(c) {
      if (!estObjet(c) || !nombre(c.x) || !nombre(c.y) || (c.diametre !== undefined && !nombre(c.diametre))) return null;
      var n = { id: texteOuNul(c.id), x: c.x, y: c.y };
      if (c.diametre !== undefined) n.diametre = c.diametre;
      if (typeof c.type === 'string') n.type = c.type;
      return n;
    }
    function normaliserExtremite(e) {
      if (!estObjet(e)) return null;
      if (e['case'] !== undefined) { var id = texteOuNul(e['case']); return id === null ? null : { 'case': id }; }
      if (estObjet(e.raccord) && estEntier(e.raccord.cote) && estEntier(e.raccord.pos)) return { raccord: { cote: e.raccord.cote, pos: e.raccord.pos } };
      if (estEntier(e.coin)) return { coin: e.coin };
      return null;
    }
    function normaliserChemin(c) {
      if (!estObjet(c)) return null;
      var a = normaliserExtremite(c.a), b = normaliserExtremite(c.b);
      return a && b ? { id: texteOuNul(c.id), a: a, b: b } : null;
    }
    function garder(liste, normaliser) {
      return tab(liste).map(function (x) {
        var n = normaliser(x);
        if (!n) ignores++;
        return n;
      }).filter(function (x) { return x; });
    }
    var cases = garder(tab(brut.cases).slice(0, LIMITES.cases), normaliserCase);
    var chemins = garder(tab(brut.chemins).slice(0, LIMITES.chemins), normaliserChemin);
    var tronques = Math.max(0, tab(brut.cases).length - LIMITES.cases) + Math.max(0, tab(brut.chemins).length - LIMITES.chemins);
    if (tronques) ignores += tronques;
    if (ignores) alertes.push(erreur('elements_ignores', 'Le modèle « ' + libelle + ' » : ' + ignores + ' case(s) ou chemin(s) mal formé(s) ignoré(s).'));
    var m = { id: brut.id, nom: nom.slice(0, LIMITES.texte), role: typeof brut.role === 'string' ? brut.role.slice(0, LIMITES.texte) : '', exemplaires: exemplaires, cases: cases, chemins: chemins };
    if (!M.validerModele(m).complet) {
      alertes.push(erreur('modele_incomplet', 'Le modèle « ' + libelle + ' » est incomplet : conservé comme brouillon, non posable.'));
    }
    return m;
  }

  /**
   * Liste de modèles nettoyée. Un identifiant déjà présent dans `pris` (dictionnaire mutable) est
   * renommé « id-2 », « id-3 »… ; renommages renvoyés dans `renommes`.
   */
  function normaliserModeles(liste, alertes, pris) {
    var modeles = [], renommes = [];
    if (tab(liste).length > LIMITES.modeles) {
      alertes.push(erreur('modeles_en_trop', 'Trop de modèles : seuls les ' + LIMITES.modeles + ' premiers sont lus.'));
      liste = tab(liste).slice(0, LIMITES.modeles);
    }
    tab(liste).forEach(function (brut) {
      if (!estObjet(brut)) {
        alertes.push(erreur('modele_ignore', 'Un élément de la liste des modèles n\'est pas un modèle : ignoré.'));
        return;
      }
      if (!estId(brut.id)) {
        alertes.push(erreur('modele_sans_id', 'Un modèle sans identifiant a été ignoré.'));
        return;
      }
      var m = normaliserModele(brut, alertes);
      if (pris[m.id]) {
        var nouvel = idLibre(m.id, pris);
        renommes.push({ de: m.id, a: nouvel });
        alertes.push(erreur('id_renomme', 'Identifiant en double « ' + m.id + ' » : modèle renommé « ' + nouvel + ' ».'));
        m.id = nouvel;
      }
      pris[m.id] = true;
      modeles.push(m);
    });
    return { modeles: modeles, renommes: renommes };
  }

  /** Forme : une forme mal formée (structure) est remplacée par un plateau complet et signalée. */
  function normaliserForme(forme, alertes) {
    if (forme === undefined || forme === null) return { retires: [] };
    if (!estObjet(forme) || (forme.retires !== undefined && !Array.isArray(forme.retires))) {
      alertes.push(erreur('forme_invalide', 'La forme du plateau était mal formée : remplacée par un plateau complet.'));
      return { retires: [] };
    }
    // Seuls {col, lig} entiers sont gardés, et au plus LIMITES.retires entrées (audit, points 1 et 3).
    var retires = tab(forme.retires).slice(0, LIMITES.retires).filter(function (r) {
      return estObjet(r) && estEntier(r.col) && estEntier(r.lig);
    }).map(function (r) { return { col: r.col, lig: r.lig }; });
    if (retires.length !== tab(forme.retires).length) {
      alertes.push(erreur('forme_invalide', 'La forme du plateau contenait des retraits mal formés ou en trop : ignorés.'));
    }
    return { retires: retires };
  }

  function normaliserTuile(brut, alertes) {
    if (!estObjet(brut) || !estId(brut.modeleId) || !estEntier(brut.col) || !estEntier(brut.lig)) {
      alertes.push(erreur('tuile_ignoree', 'Une tuile posée mal formée a été ignorée.'));
      return null;
    }
    return { modeleId: brut.modeleId, col: brut.col, lig: brut.lig, rot: estEntier(brut.rot) ? brut.rot : 0 };
  }

  function normaliserJeton(brut, alertes) {
    if (!estObjet(brut) || !estEntier(brut.i) || !estEntier(brut.j) || TYPES_JETON.indexOf(brut.type) < 0) {
      alertes.push(erreur('jeton_ignore', 'Un jeton mal formé a été ignoré.'));
      return null;
    }
    return { i: brut.i, j: brut.j, type: brut.type };
  }

  function normaliserPlateau(brut, alertes) {
    var plateau = { forme: normaliserForme(brut.forme, alertes), tuiles: [], jetons: [] };
    if (tab(brut.tuiles).length > LIMITES.tuiles) alertes.push(erreur('tuiles_en_trop', 'Trop de tuiles posées : seules les ' + LIMITES.tuiles + ' premières sont lues.'));
    tab(brut.tuiles).slice(0, LIMITES.tuiles).forEach(function (t) {
      var n = normaliserTuile(t, alertes);
      if (n) plateau.tuiles.push(n);
    });
    if (tab(brut.jetons).length > LIMITES.jetons) alertes.push(erreur('jetons_en_trop', 'Trop de jetons : seuls les ' + LIMITES.jetons + ' premiers sont lus.'));
    tab(brut.jetons).slice(0, LIMITES.jetons).forEach(function (j) {
      var n = normaliserJeton(j, alertes);
      if (n) plateau.jetons.push(n);
    });
    return plateau;
  }

  /* ------------------------------------------------------------------ */
  /* Lecture et écriture du JSON (fonctions pures)                        */
  /* ------------------------------------------------------------------ */

  /** Contrôle d'enveloppe : texte, JSON, objet, format et version. Renvoie {ok, objet, erreurs}. */
  function analyser(texte) {
    if (typeof texte !== 'string' || texte.trim() === '') {
      return { ok: false, erreurs: [erreur('vide', 'Le fichier est vide.')] };
    }
    if (texte.length > LIMITES.octets) {
      return { ok: false, erreurs: [erreur('trop_gros', 'Le fichier est trop volumineux (plus de ' + Math.round(LIMITES.octets / 1e6) + ' Mo) pour être un plateau.')] };
    }
    var objet;
    try { objet = JSON.parse(texte); } catch (e) {
      return { ok: false, erreurs: [erreur('json', 'Le fichier n\'est pas du JSON lisible (' + texteErreur(e) + ').')] };
    }
    if (!estObjet(objet)) {
      return { ok: false, erreurs: [erreur('structure', 'Le fichier ne contient pas un document (objet JSON attendu).')] };
    }
    if (objet.format !== undefined && objet.format !== FORMAT) {
      return { ok: false, erreurs: [erreur('format', 'Ce fichier n\'est pas un fichier Plateau modulaire (format inconnu).')] };
    }
    if (objet.version !== VERSION) {
      return { ok: false, erreurs: [erreur('version', 'Version de fichier absente ou inconnue : ' + String(objet.version) + '.')] };
    }
    return { ok: true, objet: objet, erreurs: [] };
  }

  /** Texte JSON indenté du document : en-tête format/version/date, puis modèles et plateau. */
  function versJSON(doc) {
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      date: new Date().toISOString(),
      modeles: doc.modeles,
      plateau: doc.plateau
    }, null, 2);
  }

  /**
   * Lit un texte JSON produit par versJSON (ou un document nu {version, modeles, plateau}).
   * Ne lève jamais d'exception. Renvoie { ok, doc, erreurs, alertes }.
   * Les problèmes du plateau deviennent des alertes : le plateau reste ouvrable.
   */
  function depuisJSON(texte) {
    try {
      var a = analyser(texte);
      if (!a.ok) return { ok: false, doc: null, erreurs: a.erreurs, alertes: [] };
      var o = a.objet;
      if (!Array.isArray(o.modeles)) return echecLecture('modeles', 'La liste des modèles est absente ou n\'est pas une liste.');
      if (!estObjet(o.plateau)) return echecLecture('plateau', 'Le plateau est absent ou mal formé.');
      if (!Array.isArray(o.plateau.tuiles)) return echecLecture('tuiles', 'La liste des tuiles posées est absente ou mal formée.');
      if (o.plateau.jetons !== undefined && !Array.isArray(o.plateau.jetons)) {
        return echecLecture('jetons', 'La liste des jetons est mal formée.');
      }

      var alertes = [];
      var modeles = normaliserModeles(o.modeles, alertes, Object.create(null)).modeles;
      var plateau = normaliserPlateau(o.plateau, alertes);
      var doc = { version: VERSION, modeles: modeles, plateau: plateau };

      try {
        var v = M.validerPlateau(doc);
        v.erreurs.concat(v.alertes).forEach(function (x) { alertes.push(erreur(x.code, x.message)); });
      } catch (e) {
        alertes.push(erreur('plateau_non_verifiable', 'Le plateau n\'a pas pu être vérifié : ' + texteErreur(e) + '.'));
      }
      return { ok: true, doc: doc, erreurs: [], alertes: alertes };
    } catch (e) {
      return echecLecture('interne', 'Fichier non exploitable (' + texteErreur(e) + ').');
    }
  }

  /** Texte JSON de la bibliothèque seule (modèles, sans plateau). */
  function bibliothequeVersJSON(doc) {
    return JSON.stringify({
      format: FORMAT,
      version: VERSION,
      contenu: 'bibliotheque',
      date: new Date().toISOString(),
      modeles: tab(doc.modeles)
    }, null, 2);
  }

  /**
   * Ajoute au document les modèles d'un texte de bibliothèque (le plateau n'est pas modifié).
   * Conflit d'identifiant : renommage « id-2 », … signalé dans `renommes`.
   * Renvoie { ok, doc, ajoutes, renommes, erreurs, alertes }. `ajoutes` : identifiants ajoutés.
   */
  function fusionnerBibliotheque(doc, texte) {
    function echec(erreurs) {
      return { ok: false, doc: doc, ajoutes: [], renommes: [], erreurs: erreurs, alertes: [] };
    }
    try {
      var a = analyser(texte);
      if (!a.ok) return echec(a.erreurs);
      if (!Array.isArray(a.objet.modeles)) {
        return echec([erreur('modeles', 'La liste des modèles est absente ou n\'est pas une liste.')]);
      }
      var pris = Object.create(null);
      tab(doc.modeles).forEach(function (m) { if (estObjet(m) && estId(m.id)) pris[m.id] = true; });
      var alertes = [];
      var r = normaliserModeles(a.objet.modeles, alertes, pris);
      var nouveau = cloner(doc);
      var ajoutes = [];
      r.modeles.forEach(function (m) {
        nouveau = M.ajouterModele(nouveau, m);
        ajoutes.push(m.id);
      });
      return { ok: true, doc: nouveau, ajoutes: ajoutes, renommes: r.renommes, erreurs: [], alertes: alertes };
    } catch (e) {
      return echec([erreur('interne', 'Import impossible (' + texteErreur(e) + ').')]);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Fichiers (navigateur)                                                */
  /* ------------------------------------------------------------------ */

  /** Télécharge le document en fichier JSON. Lève une Error si le navigateur ne le permet pas. */
  function telecharger(doc, nomFichier) {
    if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
      throw new Error('Le téléchargement de fichier n\'est pas disponible dans ce navigateur.');
    }
    var blob = new Blob([versJSON(doc)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var lien = document.createElement('a');
    lien.href = url;
    lien.download = nomFichier || 'plateau-modulaire.json';
    document.body.appendChild(lien);
    lien.click();
    document.body.removeChild(lien);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /**
   * Ouvre le sélecteur de fichier. Résout null si l'utilisateur annule, sinon le résultat de depuisJSON.
   * Annulation détectée par l'événement `cancel` ou, à défaut, par le retour du focus sans fichier choisi.
   */
  function ouvrirFichier() {
    return new Promise(function (resoudre) {
      if (typeof document === 'undefined' || !document.body) { resoudre(null); return; }

      var saisie = document.createElement('input');
      saisie.type = 'file';
      saisie.accept = '.json,application/json';
      saisie.hidden = true;
      var termine = false;   // résolution déjà faite
      var lecture = false;   // l'événement change a été reçu
      var repli = null;

      function finir(valeur) {
        if (termine) return;
        termine = true;
        clearTimeout(repli);
        window.removeEventListener('focus', surFocus);
        if (saisie.parentNode) saisie.parentNode.removeChild(saisie);
        resoudre(valeur);
      }

      function surFocus() {
        clearTimeout(repli);
        repli = setTimeout(function () {
          if (!lecture && saisie.files && saisie.files.length === 0) finir(null);
        }, DELAI_REPLI_ANNULATION);
      }

      function lireFichier(fichier) {
        var lecteur = new FileReader();
        lecteur.onload = function () { finir(depuisJSON(String(lecteur.result))); };
        lecteur.onerror = function () { finir(echecLecture('lecture', 'Lecture du fichier impossible.')); };
        lecteur.readAsText(fichier);
      }

      saisie.addEventListener('change', function () {
        lecture = true;
        var fichier = saisie.files && saisie.files[0];
        if (!fichier) { finir(null); return; }
        lireFichier(fichier);
      });
      saisie.addEventListener('cancel', function () { finir(null); });

      document.body.appendChild(saisie);
      window.addEventListener('focus', surFocus);
      saisie.click();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sauvegarde automatique (localStorage)                                */
  /* ------------------------------------------------------------------ */

  /** Stockage par défaut : `localStorage` ou null (l'accès lui-même peut lever une exception). */
  function stockageDefaut() {
    try { return globalThis.localStorage || null; } catch (e) { return null; }
  }
  /** `stockage` non fourni (undefined) : stockage du navigateur. Fourni (même null) : celui-ci. */
  function stockageVoulu(stockage) { return stockage === undefined ? stockageDefaut() : stockage; }

  var minuteur = null;          // écriture différée en attente
  var enAttente = null;         // {doc, stockage} : dernier document à écrire
  var derniereEcriture = null;  // horodatage (ms) de la dernière écriture, null si aucune ou effacée

  /** Écrit le document tout de suite. Renvoie false si le stockage est absent ou refuse. */
  function ecrireAutosave(doc, stockage) {
    derniereEcriture = Date.now();
    if (!stockage) return false;
    try {
      stockage.setItem(CLE_AUTOSAVE, versJSON(doc));
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Sauvegarde automatique : au plus une écriture par seconde ; la dernière demande gagne
   * (une écriture différée est faite à la fin du délai). Ne lève jamais d'exception.
   * Renvoie true si l'écriture a eu lieu immédiatement, false sinon (différée ou échec).
   */
  function autosave(doc, stockage) {
    try {
      var s = stockageVoulu(stockage);
      var maintenant = Date.now();
      if (minuteur === null && (derniereEcriture === null || maintenant - derniereEcriture >= DELAI_AUTOSAVE)) {
        return ecrireAutosave(doc, s);
      }
      enAttente = { doc: doc, stockage: s };
      if (minuteur === null) {
        minuteur = setTimeout(function () {
          minuteur = null;
          var a = enAttente;
          enAttente = null;
          if (a) ecrireAutosave(a.doc, a.stockage);
        }, Math.max(0, DELAI_AUTOSAVE - (maintenant - derniereEcriture)));
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Écrit immédiatement la sauvegarde automatique (annule l'écriture différée en attente).
   * Appelée à la fermeture de la page (pagehide). Ne lève jamais d'exception ; renvoie true si écrit.
   */
  function ecrireMaintenant(doc, stockage) {
    try {
      if (minuteur !== null) { clearTimeout(minuteur); minuteur = null; }
      enAttente = null;
      return ecrireAutosave(doc, stockageVoulu(stockage));
    } catch (e) {
      return false;
    }
  }

  /**
   * Relit la sauvegarde automatique. Renvoie {ok:true, doc, date, alertes} ou null
   * si rien n'est enregistré, si le stockage est indisponible ou si le contenu est illisible.
   */
  function restaurerAutosave(stockage) {
    try {
      var s = stockageVoulu(stockage);
      if (!s) return null;
      var texte = s.getItem(CLE_AUTOSAVE);
      if (typeof texte !== 'string') return null;
      var r = depuisJSON(texte);
      if (!r.ok) return null;
      var date = null;
      try { date = JSON.parse(texte).date || null; } catch (e) { date = null; }
      return { ok: true, doc: r.doc, date: date, alertes: r.alertes };
    } catch (e) {
      return null;
    }
  }

  /** Supprime la sauvegarde automatique et annule l'écriture différée en attente. */
  function effacerAutosave(stockage) {
    try {
      if (minuteur !== null) { clearTimeout(minuteur); minuteur = null; }
      enAttente = null;
      derniereEcriture = null;
      var s = stockageVoulu(stockage);
      if (s) s.removeItem(CLE_AUTOSAVE);
    } catch (e) {
      // stockage indisponible : rien à effacer
    }
  }

  PM.sauvegarde = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    CLE_AUTOSAVE: CLE_AUTOSAVE,
    LIMITES: LIMITES,
    versJSON: versJSON,
    depuisJSON: depuisJSON,
    bibliothequeVersJSON: bibliothequeVersJSON,
    fusionnerBibliotheque: fusionnerBibliotheque,
    telecharger: telecharger,
    ouvrirFichier: ouvrirFichier,
    autosave: autosave,
    ecrireMaintenant: ecrireMaintenant,
    restaurerAutosave: restaurerAutosave,
    effacerAutosave: effacerAutosave
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.sauvegarde;
})();
