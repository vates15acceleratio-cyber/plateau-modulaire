/*
 * controles.js : compteurs, erreurs et alertes du plateau (sous-agent 4).
 *
 * Partie calcul (calculer, revaliderPlateau) : fonctions pures, aucun accès au DOM,
 * testables sous Node. Partie interface (monter) : panneau de droite, construit avec
 * createElement et textContent (jamais innerHTML : les messages contiennent des noms saisis).
 *
 * Vocabulaire : une « ville » est un jeton de type 'capture' ; une jonction sans ville est un « campement » (docs/18, 2026-10-19), qui compte comme une case.
 * Joueurs : vert (nord) et rouge (sud). Dans un compteur, `cible` est la valeur visée (7 ou 8 villes, 6...). Dans une
 * erreur ou une alerte, `cible` est l'objet de surbrillance défini dans l'en-tête de etat.js (ou null).
 * Un plateau complet très déséquilibré (PM.graphe : « 5 contre 2 » en 4×4, « 6 contre 2 » en 5×5, ou écart de plus de 3 pas à un rang)
 * est une ERREUR (code 'desequilibre') ; la pose reste toujours permise. En 5×5, plus de 8 villes est aussi une ERREUR (alerte bloquante,
 * code 'trop_de_villes', docs/18 du 2026-10-19) ; en 4×4, plus de 7 villes reste une alerte.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele;

  /**
   * Composition visée : 7 villes en 4×4, 8 en 5×5 (docs/18, décisions du 2026-10-19 ; PM.graphe.nbVilles quand il est chargé) ; cases (cases
   * des tuiles + campements) ≈ 58 en 4×4 (docs/46), ≈ 57 en 5×5 (2 cases par tuile, 1 pour LC5 ; 8 campements ; catalogue « P », docs/66).
   * NB_VILLES garde la valeur du 4×4 (ancienne constante unique).
   */
  var NB_VILLES = 7;
  var NB_VILLES_PAR_FORMAT = { '4x4': 7, '5x5': 8, 'hex19': 6 };
  var CIBLE_CASES = { '4x4': 58, '5x5': 57, 'hex19': 56 }; // cases par plateau du catalogue livré : 4×4 mesuré à 58,4 ; 5×5 : 50 cases de tuiles (49 avec LC5) + 8 campements = 58 ou 57 (docs/66, 57,2 mesuré)
  /** Nombre de villes du format F (PM.graphe.nbVilles si chargé, sinon la table locale, identique). */
  function nbVillesDe(F) { return PM.graphe && typeof PM.graphe.nbVilles === 'function' ? PM.graphe.nbVilles(F.id) : (NB_VILLES_PAR_FORMAT[F.id] || NB_VILLES); }

  /** Dimensions du plateau (en cm) pour le format F. */
  function dimensions(F) {
    if (F.nbCotes === 6) return cmFr(F.PLATEAU.largeur) + ' × ' + cmFr(F.PLATEAU.hauteur) + ' cm'; // hexagonal : hexagone régulier de 498,8 × 432 mm
    return (F.GRILLE.colonnes * F.COTE / 10) + ' × ' + (F.GRILLE.lignes * F.COTE / 10) + ' cm';
  }
  function cmFr(mm) { return String(Math.round(mm) / 10).replace('.', ','); }

  /** Libellés des groupes d'erreurs et d'alertes (un code sans libellé affiche le premier message). */
  var LIBELLES = {
    desequilibre: 'Plateau très déséquilibré',
    raccord_mort: 'Raccords morts',
    raccord_mur: 'Raccords face à un mur voulu (information)',
    port_pourtour: 'Ports vers le bord du plateau',
    jonction_ports: 'Jonctions mal reliées',
    gabarit_place: 'Tuiles hors de leur place',
    pourtour_sans_apparition: 'Pourtour sans case d\'apparition',
    apparition_centre: 'Case d\'apparition au centre',
    trop_de_villes: 'Trop de villes',
    villes_proches: 'Villes trop proches',
    plateau_non_connexe: 'Plateau non connexe',
    cinq_contre_deux: '5 villes contre 2',
    cinq_contre_trois: '5 villes contre 3',
    partage_asymetrique: 'Partage non symétrique (information)',
    ecart_rang_etendu: 'Écart de distance entre joueurs',
    score_s: 'Score S à surveiller',
    premiere_ville_inegale: 'Première ville inégale',
    ville_inaccessible: 'Ville inaccessible',
    rotation_pourtour: 'Tuiles du pourtour mal tournées',
    coin_non_porte: 'Coins sans port'
  };
  /** Libellés propres à un format (la majorité bloquante du 5×5 est « 6 contre 2 », docs/18). */
  var LIBELLES_PAR_FORMAT = { '5x5': { cinq_contre_deux: '6 villes contre 2' }, 'hex19': { cinq_contre_deux: '4 villes contre 2', jonction_ports: 'Sièges mal reliés', trop_de_villes: 'Trop de villes (6 au plus)' } };
  /** Alertes d'équilibre reprises de PM.graphe (villes non traversables). La majorité bloquante n'y est que si elle n'est pas bloquante. */
  var CODES_EQUILIBRE = ['cinq_contre_deux', 'cinq_contre_trois', 'ecart_rang_etendu', 'score_s', 'premiere_ville_inegale', 'ville_inaccessible'];
  /** Informations d'équilibre reprises de PM.graphe (jamais des alertes) : partage non symétrique du 5×5 (docs/18, décision 2 du 2026-10-19). */
  var CODES_INFORMATION_EQUILIBRE = ['partage_asymetrique'];

  function estNb(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------------------------------------------ */
  /* Conversion des références vers la surbrillance (etat.js)            */
  /* ------------------------------------------------------------------ */

  /** Jonction (i, j) de jeton, ou null si mal formée. */
  function cibleJonction(j) {
    return j && estNb(j.i) && estNb(j.j) ? { type: 'jonction', i: j.i, j: j.j } : null;
  }

  /**
   * Convertit la référence `ref` d'une erreur de PM.modele en objet de surbrillance.
   * `modele` (pas de type de surbrillance) : on vise la première tuile posée de ce modèle.
   */
  function cibleDepuisRef(ref, doc) {
    if (!ref) return null;
    switch (ref.type) {
      case 'tuile':
        return estNb(ref.col) && estNb(ref.lig) ? { type: 'tuile', col: ref.col, lig: ref.lig } : null;
      case 'raccord':
        return { type: 'raccord', col: ref.col, lig: ref.lig, cote: ref.cote, pos: ref.pos };
      case 'coin':
        return { type: 'port', col: ref.col, lig: ref.lig, coin: ref.coin };
      case 'jeton':
        return cibleJonction(ref);
      case 'modele':
        for (var k = 0; k < doc.plateau.tuiles.length; k++) {
          var t = doc.plateau.tuiles[k];
          if (t && t.modeleId === ref.id) return { type: 'tuile', col: t.col, lig: t.lig };
        }
        return null;
      default:
        return null; // types inconnus
    }
  }

  function versEntree(x, niveau, doc) {
    return { code: x.code, message: x.message, niveau: niveau, cible: cibleDepuisRef(x.ref, doc) };
  }

  /* ------------------------------------------------------------------ */
  /* Alertes et erreur propres au module : villes, connexité, équilibre  */
  /* ------------------------------------------------------------------ */

  /** Toutes les cellules de la grille sont-elles occupées par une tuile dont le modèle existe ? */
  function plateauRempli(doc, F) {
    var n = 0;
    doc.plateau.tuiles.forEach(function (t) { if (t && M.modeleParId(doc, t.modeleId)) n++; });
    return n >= nbCellules(F);
  }

  /** Nombre de cellules du plateau : 16 ou 25 en carré, 19 en hexagonal (la grille hexagonale n’est pas un rectangle). */
  function nbCellules(F) { return F.nbCotes === 6 ? F.cellules.length : F.GRILLE.colonnes * F.GRILLE.lignes; }

  /**
   * Alertes sur les villes et le graphe : plus de villes que le format n'en prévoit (7 en 4×4 : alerte ; 8 en 5×5 : ERREUR, alerte bloquante
   * de docs/18 du 2026-10-19, rangée parmi les erreurs par calculer) ; deux villes à moins de 3 cases (PM.graphe chargé ; en 5×5, le message
   * renvoie à « Placer les villes ») ; plateau non connexe (seulement une fois toutes les tuiles posées : avant, des campements sont isolés).
   */
  function alertesGraphe(doc, g) {
    var res = [], villes = doc.plateau.jetons.filter(function (j) { return j && j.type === 'capture'; }), F = M.formatDuDocument(doc), nb = nbVillesDe(F);
    if (villes.length > nb && F.nbCotes !== 6) { // hexagonal : l’erreur « trop_de_villes » vient déjà de PM.modele.validerPlateau (affichée une seule fois)
      res.push({ code: 'trop_de_villes', niveau: F.id === '5x5' ? 'erreur' : 'alerte', cible: cibleJonction(villes[villes.length - 1]),
        message: 'Il y a ' + villes.length + ' villes, la composition en prévoit ' + nb + '.' + (F.id === '5x5' ? ' En 5×5, 8 villes au plus : retirez-en ' + (villes.length - nb) + ' (clic sur la ville).' : '') });
    }
    if (!g) return res;
    PM.graphe.villesProches(g).forEach(function (p) {
      res.push({ code: 'villes_proches', niveau: 'alerte', cible: cibleJonction(p.b),
        message: (F.nbCotes === 6 ? 'Villes des sièges ' + p.a.i + ' et ' + p.b.i : 'Villes (' + p.a.i + ', ' + p.a.j + ') et (' + p.b.i + ', ' + p.b.j + ')') + ' à ' + (p.pas - 1) + ' case(s) d\'écart : la règle en demande au moins ' + PM.geometrie.ECART_MIN_VILLES + '.' +
          (F.id === '5x5' ? PM.graphe.CONSEIL_5X5 : '') }); // renvoi à « Placer les villes » (docs/60 § 5)
    });
    if (plateauRempli(doc, F) && !PM.graphe.connexe(g)) {
      res.push({ code: 'plateau_non_connexe', niveau: 'alerte', cible: null,
        message: 'Le plateau n\'est pas d\'un seul tenant : certaines cases ne sont reliées à aucune autre partie.' });
    }
    return res;
  }

  /** Graphe du plateau (villes non traversables) si PM.graphe est chargé, sinon null ; null aussi si le calcul échoue. */
  function grapheDuPlateau(doc) {
    if (!PM.graphe || typeof PM.graphe.construire !== 'function') return null;
    try { return PM.graphe.construire(doc, { villesTraversables: false }); } catch (x) { return null; }
  }

  /**
   * Équilibre mesuré (villes non traversables), seulement si PM.graphe est chargé et que le plateau
   * est complet : les villes du format (7 en 4×4, 8 en 5×5), une case d'apparition par camp au moins, toutes les tuiles posées. Renvoie null sinon.
   */
  function mesureEquilibre(doc, g) {
    if (!g || typeof PM.graphe.equilibre !== 'function') return null;
    var e;
    try { e = PM.graphe.equilibre(doc, { graphe: g }); } catch (x) { return null; }
    return e && e.complet ? e : null;
  }

  /** Alertes d'équilibre affichées (codes de CODES_EQUILIBRE) d'une mesure, ou aucune si elle manque. */
  function alertesEquilibre(e) {
    if (!e) return [];
    return e.alertes.filter(function (a) { return CODES_EQUILIBRE.indexOf(a.code) >= 0; }).map(function (a) {
      return { code: a.code, message: a.message, niveau: 'alerte', cible: null };
    });
  }

  /** Informations d'équilibre affichées (codes de CODES_INFORMATION_EQUILIBRE), niveau 'information' : jamais comptées parmi les alertes. */
  function informationsEquilibre(e) {
    if (!e || !Array.isArray(e.informations)) return [];
    return e.informations.filter(function (a) { return CODES_INFORMATION_EQUILIBRE.indexOf(a.code) >= 0; }).map(function (a) {
      return { code: a.code, message: a.message, niveau: 'information', cible: null };
    });
  }

  /** Erreur « plateau très déséquilibré » d'une mesure complète (message qui nomme le critère), ou aucune. */
  function erreursEquilibre(e) {
    if (!e || !e.tresDesequilibre) return [];
    return [{ code: 'desequilibre', niveau: 'erreur', cible: null,
      message: 'Plateau très déséquilibré : ' + e.blocages.map(function (b) { return b.message.replace(/\.$/, ''); }).join(' ; ') +
        '. Changez des tuiles ou des villes (la pose reste permise).' }];
  }

  /* ------------------------------------------------------------------ */
  /* Compteurs                                                           */
  /* ------------------------------------------------------------------ */

  function compteur(cle, libelle, valeur, cible) {
    return { cle: cle, libelle: libelle, valeur: valeur, cible: cible, etat: valeur === cible ? 'ok' : 'ecart' };
  }

  /** Cellules du pourtour appartenant au camp (cases d'apparition attendues : 6 en 4×4, 7 en 5×5). */
  function apparitionsAttendues(F, camp) {
    var n = 0;
    if (F.nbCotes === 6) { // hexagonal : 5 par camp (la rangée du milieu est neutre)
      F.cellules.forEach(function (c) { if (c.gabarit !== 'centrale' && c.camp === camp) n++; });
      return n;
    }
    for (var lig = 0; lig < F.GRILLE.lignes; lig++) {
      for (var col = 0; col < F.GRILLE.colonnes; col++) {
        if (M.gabaritCellule(col, lig, F) !== 'centrale' && F.campCellule(col, lig) === camp) n++;
      }
    }
    return n;
  }

  function compteursDuPlateau(doc) {
    var plateau = doc.plateau, F = M.formatDuDocument(doc);
    var villes = 0, cases = 0, petitesTuiles = 0, apparitions = { vert: 0, rouge: 0 };
    var seuilPetite = F.id === '5x5' ? 1 : 2; // 5×5 : « Pont et carrefour » (LC5, docs/58) n'a qu'une case par choix de l'utilisateur ; seule une tuile sans case compte
    plateau.jetons.forEach(function (j) { if (j && j.type === 'capture') villes++; });
    plateau.tuiles.forEach(function (t) {
      var m = M.modeleParId(doc, t.modeleId);
      if (!m) return; // modèle absent : signalé par validerPlateau
      var cs = Array.isArray(m.cases) ? m.cases : [];
      if (cs.length < seuilPetite) petitesTuiles++;
      cs.forEach(function (c) {
        if (!c) return;
        cases++;
        var camp = c.type === 'apparition' ? F.campCellule(t.col, t.lig) : null;
        if (camp) apparitions[camp]++;
      });
    });
    // Cases de jonction : jonctions sans ville entourées de leurs 4 tuiles
    if (F.nbCotes === 6) { // hexagonal : les 24 sièges, entourés de 3 tuiles
      for (var sg = 0; sg < F.sieges.length; sg++) {
        var aVilleH = plateau.jetons.some(function (x) { return x && x.i === sg && x.j === 0 && x.type === 'capture'; });
        if (!aVilleH && M.portsJonction(doc, sg, 0).tuiles === 3) cases++;
      }
    } else {
      for (var j = 1; j < F.GRILLE.lignes; j++) {
        for (var i = 1; i < F.GRILLE.colonnes; i++) {
          var aVille = plateau.jetons.some(function (x) { return x && x.i === i && x.j === j && x.type === 'capture'; });
          if (!aVille && M.portsJonction(doc, i, j).tuiles === 4) cases++;
        }
      }
    }
    var cibleCases = CIBLE_CASES[F.id];
    return [
      compteur('villes', 'Villes', villes, nbVillesDe(F)),
      { cle: 'cases', libelle: 'Cases (tuiles et campements)', valeur: cases, cible: '≈ ' + cibleCases, etat: 'ok' },
      compteur('tuiles', 'Tuiles posées', plateau.tuiles.length, nbCellules(F)),
      compteur('apparitions_vert', 'Apparitions vert', apparitions.vert, apparitionsAttendues(F, 'vert')),
      compteur('apparitions_rouge', 'Apparitions rouge', apparitions.rouge, apparitionsAttendues(F, 'rouge')),
      { cle: 'dimensions', libelle: 'Dimensions', valeur: dimensions(F), cible: dimensions(F), etat: 'ok' },
      compteur('tuiles_petites', seuilPetite === 1 ? 'Tuiles sans case' : 'Tuiles à moins de 2 cases', petitesTuiles, 0)
    ];
  }

  /** Part en pour cent, une décimale, virgule française. */
  function pourCent(x) { return (Math.round(x * 1000) / 10).toString().replace('.', ',') + ' %'; }

  /**
   * 5×5 seulement (docs/18, docs/53 § 1) : information « cases à 2 connexions ou moins » (PM.graphe.connexions), mesurée quand toutes
   * les tuiles sont posées (avant, des raccords sont encore sans vis-à-vis) ; cible : moins de 5 % des cases. Jamais une alerte.
   */
  function compteursConnexions(doc, g) {
    var F = M.formatDuDocument(doc);
    if (F.id !== '5x5' || !PM.graphe || typeof PM.graphe.connexions !== 'function') return [];
    var cible = '< ' + pourCent(PM.graphe.PART_CONNEXIONS_MAX);
    if (!g || !plateauRempli(doc, F)) return [{ cle: 'connexions', libelle: 'Cases à 2 connexions ou moins', valeur: '—', cible: cible + ', plateau complet', etat: 'ok' }];
    var c;
    try { c = PM.graphe.connexions(doc, g); } catch (x) { return []; }
    return [{ cle: 'connexions', libelle: 'Cases à 2 connexions ou moins', valeur: c.faibles + ' (' + pourCent(c.part) + ')', cible: cible, etat: c.conforme ? 'ok' : 'ecart' }];
  }

  /* ------------------------------------------------------------------ */
  /* Regroupement des erreurs et alertes                                 */
  /* ------------------------------------------------------------------ */

  /** Rang d'affichage : erreurs, raccords morts, ports vers le bord, autres alertes, puis les informations. */
  function rangDe(entree) {
    if (entree.niveau === 'erreur') return 0;
    if (entree.niveau === 'information') return 4;
    if (entree.code === 'raccord_mort') return 1;
    if (entree.code === 'port_pourtour') return 2;
    return 3;
  }

  /** Groupes { code, niveau, libelle, nombre, rang, elements: [{message, cible}] } triés par rang (stable) ; libellés du format `formatId` s'il en a. */
  function regrouper(entrees, formatId) {
    var groupes = [], parCode = Object.create(null), propres = LIBELLES_PAR_FORMAT[formatId] || {};
    entrees.forEach(function (e) {
      var g = parCode[e.code];
      if (!g) {
        var libelle = Object.prototype.hasOwnProperty.call(propres, e.code) ? propres[e.code]
          : (Object.prototype.hasOwnProperty.call(LIBELLES, e.code) ? LIBELLES[e.code] : e.message);
        g = parCode[e.code] = { code: e.code, niveau: e.niveau, libelle: libelle, nombre: 0, rang: rangDe(e), elements: [] };
        groupes.push(g);
      }
      g.nombre++;
      g.elements.push({ message: e.message, cible: e.cible });
    });
    return groupes
      .map(function (g, k) { return { g: g, k: k }; })
      .sort(function (a, b) { return (a.g.rang - b.g.rang) || (a.k - b.k); })
      .map(function (x) { return x.g; });
  }

  /* ------------------------------------------------------------------ */
  /* API de calcul (pure)                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Calcule compteurs, erreurs, alertes et groupes d'un document. Ne modifie pas `doc`.
   * Renvoie { compteurs, erreurs, alertes, informations, regroupees } ; informations : les raccords face à un mur voulu et, en 5×5, le
   * partage non symétrique (niveau 'information', hors du compte des alertes) ; regroupees les contient en dernier.
   * erreurs / alertes / informations : [{ code, message, niveau: 'erreur'|'alerte'|'information', cible }].
   */
  function calculer(doc) {
    var p = doc && doc.plateau;
    // document mal formé : refus explicite (Error lisible), jamais un TypeError natif
    if (!p || typeof p !== 'object' || !Array.isArray(p.tuiles) || !Array.isArray(p.jetons)) {
      throw new Error('Document invalide : plateau absent ou mal formé.');
    }
    if (!Array.isArray(doc.modeles)) throw new Error('Document invalide : bibliothèque de modèles absente.');
    var v = M.validerPlateau(doc), g = grapheDuPlateau(doc), eq = mesureEquilibre(doc, g);
    var graphe = alertesGraphe(doc, g), estErreur = function (x) { return x.niveau === 'erreur'; };
    var erreurs = v.erreurs.map(function (x) { return versEntree(x, 'erreur', doc); }).concat(graphe.filter(estErreur), erreursEquilibre(eq));
    var alertes = v.alertes.map(function (x) { return versEntree(x, 'alerte', doc); })
      .concat(graphe.filter(function (x) { return !estErreur(x); })).concat(alertesEquilibre(eq));
    // informations (docs/18, murs voulus) : jamais comptées parmi les alertes
    var informations = (v.informations || []).map(function (x) { return versEntree(x, 'information', doc); }).concat(informationsEquilibre(eq));
    return {
      compteurs: compteursDuPlateau(doc).concat(compteursConnexions(doc, g)),
      erreurs: erreurs,
      alertes: alertes,
      informations: informations,
      regroupees: regrouper(erreurs.concat(alertes, informations), M.formatDuDocument(doc).id)
    };
  }

  /** Revalidation après modification d'un modèle posé : même résultat que calculer(doc).erreurs. */
  function revaliderPlateau(doc) {
    return calculer(doc).erreurs;
  }

  /* ------------------------------------------------------------------ */
  /* Interface (panneau de droite)                                       */
  /* ------------------------------------------------------------------ */

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  /** Aide du bouton « Orienter les tuiles » (hexagonal seulement). */
  var TITRE_ORIENTER = 'Cherche les rotations des tuiles intérieures posées qui tiennent l’écart de 4 pas entre les villes posées (3 ports par ville), au S le plus bas ; une seule étape annulable (Ctrl+Z), ou la raison du refus.';

  /** Aide du bouton « Placer les villes » pour le format F : « Pose les N villes… » (N = 7 en 4×4, 8 en 5×5, positions par défaut d'abord). */
  function titrePlacerVilles(F) {
    if (F.nbCotes === 6) return 'Pose les 6 villes (3 par camp) au meilleur placement permis sur le plateau complet : d’abord le trèfle (sièges 0, 4, 8 au nord ; 15, 19, 23 au sud), sinon une autre disposition symétrique, sinon 3 villes par camp ; 3 ports par ville, 3 cases d’écart, équilibre ; Ctrl+Z pour revenir.';
    return 'Pose les ' + nbVillesDe(F) + ' villes au meilleur placement permis sur le plateau complet (3 cases d’écart' +
      (F.id === '5x5' ? ', 3 ports par ville ; d’abord aux positions par défaut, sinon 2 villes par rangée de jonctions, partage symétrique préféré' : '') + ', équilibre) ; Ctrl+Z pour revenir.';
  }

  /** Ligne d'un compteur : libellé, valeur / cible, jauge (colorée seulement en cas d'écart). */
  function ligneCompteur(c) {
    var li = el('li', 'pm-controles-compteur pm-controles-compteur--' + c.etat);
    li.appendChild(el('span', 'pm-controles-libelle', c.libelle));
    var numerique = estNb(c.valeur) && estNb(c.cible);
    var texte = numerique ? c.valeur + ' / ' + c.cible : (estNb(c.valeur) ? c.valeur + ' (' + c.cible + ')'
      : String(c.valeur) + (typeof c.cible === 'string' && c.cible !== c.valeur ? ' (visé : ' + c.cible + ')' : ''));
    li.appendChild(el('span', 'pm-controles-valeur', texte));
    if (numerique) {
      var pct = c.cible > 0 ? Math.min(100, c.valeur / c.cible * 100) : (c.valeur > 0 ? 100 : 0);
      var jauge = el('span', 'pm-controles-jauge');
      jauge.setAttribute('aria-hidden', 'true');
      var rempli = el('span', 'pm-controles-jauge-remplissage');
      rempli.style.width = pct + '%';
      jauge.appendChild(rempli);
      li.appendChild(jauge);
    }
    return li;
  }

  /**
   * Monte le panneau dans `conteneur` et s'abonne à `etat`.
   * Clic sur une alerte : etat.majUi({surbrillance: cible, onglet: 'plateau'}).
   */
  function monter(conteneur, etat) {
    var ouverts = Object.create(null); // groupes dépliés, conservés d'un rendu à l'autre
    var dernier = null;                // empreinte du dernier rendu : pas de redessin si rien ne change

    var racine = el('div', 'pm-controles');

    // Compteurs
    var blocCompteurs = el('section', 'pm-controles-bloc');
    blocCompteurs.setAttribute('aria-labelledby', 'pm-controles-titre-compteurs');
    var titreCompteurs = el('h2', 'pm-controles-titre', 'Compteurs');
    titreCompteurs.id = 'pm-controles-titre-compteurs';
    blocCompteurs.appendChild(titreCompteurs);
    var listeCompteurs = el('ul', 'pm-controles-compteurs');
    blocCompteurs.appendChild(listeCompteurs);
    racine.appendChild(blocCompteurs);

    // Erreurs et alertes
    var blocAlertes = el('section', 'pm-controles-bloc');
    blocAlertes.setAttribute('aria-labelledby', 'pm-controles-titre-alertes');
    var titreAlertes = el('h2', 'pm-controles-titre', 'Erreurs et alertes');
    titreAlertes.id = 'pm-controles-titre-alertes';
    blocAlertes.appendChild(titreAlertes);
    var zoneAlertes = el('div', 'pm-controles-zone-alertes');
    blocAlertes.appendChild(zoneAlertes);
    racine.appendChild(blocAlertes);

    // Outils de priorité 2 : actifs dès que leur module est chargé (PM.equilibre, PM.generateur), qui exposent ouvrir(etat) et
    // affichent leur contenu dans la boîte de dialogue commune (PM.dialogue) ; « Placer les villes » (PM.generateur.placerVilles, docs/18)
    // agit directement sur le plateau (annulable par Ctrl+Z) ou explique son refus dans la barre d'état.
    var blocAVenir = el('section', 'pm-controles-bloc');
    blocAVenir.appendChild(el('h2', 'pm-controles-titre', 'Outils'));
    var listeAVenir = el('ul', 'pm-controles-avenir');
    var boutonPlacer = null, itemOrienter = null; // « Orienter les tuiles » : hexagonal seulement (visible selon le format du document, posé par rafraichir)
    [['Rapport d\'équilibre', 'equilibre', 'ouvrir'], ['Plateau aléatoire', 'generateur', 'ouvrir'], ['Placer les villes', 'generateur', 'placerVilles'], ['Orienter les tuiles', 'generateur', 'orienter']].forEach(function (outil) {
      var li = el('li', 'pm-controles-avenir-item');
      var bouton = el('button', 'pm-controles-avenir-bouton', outil[0]);
      bouton.type = 'button';
      var module = PM[outil[1]], action = outil[2];
      if (action === 'placerVilles') {
        bouton.classList.add('pm-controles-placer-villes');
        boutonPlacer = bouton; // aide (title) propre au format, posée par rafraichir (appelé à la fin du montage)
      }
      if (action === 'orienter') {
        bouton.classList.add('pm-controles-orienter');
        bouton.title = TITRE_ORIENTER;
        itemOrienter = li;
      }
      li.appendChild(bouton);
      if (module && typeof module[action] === 'function') {
        bouton.addEventListener('click', function () { module[action](etat); });
      } else {
        bouton.disabled = true;
        li.appendChild(el('span', 'pm-controles-badge', 'bientôt'));
      }
      listeAVenir.appendChild(li);
    });
    blocAVenir.appendChild(listeAVenir);
    racine.appendChild(blocAVenir);

    conteneur.appendChild(racine);

    /** Redessine la zone d'alertes en gardant le groupe déplié et le focus clavier. */
    function dessinerAlertes(groupes) {
      var repere = null, actif = document.activeElement;
      if (actif && zoneAlertes.contains(actif) && actif.getAttribute('data-repere')) repere = actif.getAttribute('data-repere');

      zoneAlertes.textContent = '';
      var nbAlertes = groupes.reduce(function (s, g) { return s + (g.niveau === 'information' ? 0 : g.nombre); }, 0);
      titreAlertes.textContent = nbAlertes ? 'Erreurs et alertes (' + nbAlertes + ')' : 'Erreurs et alertes';
      if (!nbAlertes) zoneAlertes.appendChild(el('p', 'pm-controles-vide', 'Aucune erreur ni alerte.'));
      if (!groupes.length) return;
      var liste = el('ul', 'pm-controles-groupes');
      groupes.forEach(function (g) {
        var li = el('li', 'pm-controles-groupe pm-controles-groupe--' + g.niveau);
        var details = el('details', 'pm-controles-details');
        details.open = !!ouverts[g.code];
        details.addEventListener('toggle', function () { ouverts[g.code] = details.open; });
        var sommaire = el('summary', 'pm-controles-sommaire');
        sommaire.setAttribute('data-repere', g.code + '#');
        sommaire.appendChild(el('span', 'pm-controles-sommaire-libelle', g.libelle));
        sommaire.appendChild(el('span', 'pm-controles-nombre', String(g.nombre)));
        details.appendChild(sommaire);

        var elements = el('ul', 'pm-controles-elements');
        g.elements.forEach(function (e, k) {
          var item = el('li', 'pm-controles-element');
          if (e.cible) {
            var bouton = el('button', 'pm-controles-alerte', e.message);
            bouton.type = 'button';
            bouton.setAttribute('data-repere', g.code + '#' + k);
            bouton.addEventListener('click', function () {
              etat.majUi({ surbrillance: Object.assign({}, e.cible), onglet: 'plateau' });
            });
            item.appendChild(bouton);
          } else {
            item.appendChild(el('p', 'pm-controles-sans-cible', e.message));
          }
          elements.appendChild(item);
        });
        details.appendChild(elements);
        li.appendChild(details);
        liste.appendChild(li);
      });
      zoneAlertes.appendChild(liste);

      if (repere) {
        var cible = zoneAlertes.querySelector('[data-repere="' + repere + '"]');
        if (cible) cible.focus();
      }
    }

    function rafraichir() {
      if (boutonPlacer) { try { boutonPlacer.title = titrePlacerVilles(M.formatDuDocument(etat.doc())); } catch (x) { /* document mal formé : titre inchangé */ } }
      if (itemOrienter) { try { itemOrienter.hidden = M.formatDuDocument(etat.doc()).nbCotes !== 6; } catch (x) { itemOrienter.hidden = true; } }
      var r = calculer(etat.doc());
      var empreinte = JSON.stringify([r.compteurs, r.regroupees]);
      if (empreinte === dernier) return;
      dernier = empreinte;

      listeCompteurs.textContent = '';
      r.compteurs.forEach(function (c) { listeCompteurs.appendChild(ligneCompteur(c)); });
      dessinerAlertes(r.regroupees);
    }

    etat.abonner(rafraichir);
    rafraichir();
  }

  PM.controles = {
    NB_VILLES: NB_VILLES,
    NB_VILLES_PAR_FORMAT: NB_VILLES_PAR_FORMAT,
    nbVilles: function (formatId) { return nbVillesDe({ id: formatId }); },
    titrePlacerVilles: titrePlacerVilles,
    TITRE_ORIENTER: TITRE_ORIENTER,
    LIBELLES: LIBELLES,
    LIBELLES_PAR_FORMAT: LIBELLES_PAR_FORMAT,
    CIBLE_CASES: CIBLE_CASES,
    calculer: calculer,
    monter: monter,
    revaliderPlateau: revaliderPlateau
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.controles;
})();
