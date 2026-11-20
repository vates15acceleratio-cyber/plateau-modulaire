/*
 * plateau.js : modèle du plateau (pièces posées, recouvrements, terrain effectif, coûts, chemins, fichier).
 * Aucun accès au DOM. Dépend de AT.hex et AT.catalogue (chargés avant ; sous Node, chargés ici au besoin).
 *
 * Un plateau est un objet JSON simple, jamais modifié en place (toute fonction renvoie un nouveau plateau) :
 *   { version, graine,
 *     pieces: [{id, modele, q, r, rotation}],       // ancre (q, r), rotation en sixièmes de tour (0 à 5)
 *     recouvrements: [{evenement, cle}],            // tuiles d'événement posées par-dessus une case
 *     deploiements: [{cle, camp}],                  // FACULTATIF : villes posées par-dessus une Plaine (§10) ; camp = 'neutre' | 'vert' | 'rouge'
 *     camps: {vert: [cle, cle], rouge: [cle, cle]},  // villes de déploiement de chaque joueur, DÉDUITES de `deploiements`
 *     modeles: [{id, nom, cases: [{q, r, terrain}], quantite}] }   // FACULTATIF : pièces personnelles du document (§8.1)
 *
 * Version 2 du format (catalogue 2). Un fichier de version 1 s'ouvre toujours : ses tuiles d'une case P / F / S / V
 * sont des pièces « hors catalogue », et ses villes de déploiement restent celles des rangées extrêmes (voir campsAuto).
 * Toutes les villes hors noyau (2 neutres, 2 par camp) sont le champ `deploiements`, absent quand il n'y en a pas :
 * des tuiles posées par-dessus une Plaine. Les fonctions qui posent ou retirent une ville tiennent `camps` à jour.
 * RÈGLES PRÉCÉDENTES (avant le 2026-11-20) : un fichier peut porter des villes neutres en pièces (modèle VN, ajoutées
 * contre le plateau) et un champ `profondeurExtremite` (1 à 3). Ils se lisent toujours : les pièces VN restent
 * telles quelles, le champ est lu sans effet et n'est plus écrit.
 *
 * Pièces personnelles : elles voyagent dans le document (aucun registre global). Le champ `modeles` est absent
 * quand il n'y en a pas. Toute recherche de modèle passe par modele(plateau, id) : catalogue de base, puis document.
 *
 * Les fonctions de modification renvoient {ok: true, plateau, ...} ou {ok: false, plateau (inchangé), raison}.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  // Sous Node, « require('../src/plateau.js') » seul doit suffire.
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.hex) require('./hex.js');
    if (!AT.catalogue) require('./catalogue.js');
  }
  var H = AT.hex, C = AT.catalogue;

  var VERSION = 2;
  var VERSIONS_LUES = [1, 2];
  var CAMPS = ['vert', 'rouge'];
  var NOMS_CAMPS = { vert: 'Vert', rouge: 'Rouge' };
  var NOYAU = 'N1';
  var FORME_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
  var possede = Object.prototype.hasOwnProperty;

  // ------------------------------------------------------------------ construction

  /** Plateau vide. */
  function vide(graine) {
    return { version: VERSION, graine: graine === undefined ? 0 : graine, pieces: [], recouvrements: [], camps: { vert: [], rouge: [] } };
  }

  /** Plateau vierge pour la création à la main : le seul noyau, posé en (0,0). */
  function vierge(graine) { return poser(vide(graine), NOYAU, 0, 0, 0).plateau; }

  function copier(plateau, remplacements) {
    var p = {
      version: plateau.version,
      graine: plateau.graine,
      pieces: (plateau.pieces || []).map(function (x) { return { id: x.id, modele: x.modele, q: x.q, r: x.r, rotation: x.rotation }; }),
      recouvrements: (plateau.recouvrements || []).map(function (x) { return { evenement: x.evenement, cle: x.cle }; }),
      camps: {
        vert: ((plateau.camps && plateau.camps.vert) || []).slice(),
        rouge: ((plateau.camps && plateau.camps.rouge) || []).slice()
      }
    };
    if (listeDeploiements(plateau).length) p.deploiements = listeDeploiements(plateau).map(function (x) { return { cle: x.cle, camp: x.camp }; });
    if (listeModeles(plateau).length) p.modeles = listeModeles(plateau).map(copieModele);
    if (remplacements) Object.keys(remplacements).forEach(function (k) { p[k] = remplacements[k]; });
    if (possede.call(p, 'modeles') && !(Array.isArray(p.modeles) && p.modeles.length)) delete p.modeles;   // forme canonique : champ absent
    if (possede.call(p, 'deploiements') && !(Array.isArray(p.deploiements) && p.deploiements.length)) delete p.deploiements;
    delete p.profondeurExtremite;                          // règles précédentes : lu sans effet, jamais écrit
    // Champs toujours dans le même ordre, quel que soit celui des remplacements (comparaisons de textes, fichiers).
    var range = {};
    ORDRE_CHAMPS.forEach(function (k) { if (possede.call(p, k)) range[k] = p[k]; });
    Object.keys(p).forEach(function (k) { if (!possede.call(range, k)) range[k] = p[k]; });
    return range;
  }

  // ------------------------------------------------------------------ de quel catalogue est ce plateau ?

  /**
   * Catalogue dont relève un plateau. C'est LA définition, partagée par les contrôles et par toutes les vues :
   *   'premier'   : il porte au moins une tuile de ville d'une case (modèle V), marque du premier catalogue (tuiles
   *                 d'une case, villes posées pendant la construction) ;
   *   'precedent' : aucune tuile V, au moins un monobloc retiré du catalogue imprimé, et aucun monobloc de terrain
   *                 apparu depuis (tous ses monoblocs de base sont dans C.CATALOGUE_PRECEDENT) : un plateau fait avec
   *                 le catalogue 2 du 2026-11-19, première version ;
   *   'courant'   : tout le reste, y compris un plateau du catalogue courant sur lequel on a peint une forêt d'une
   *                 case ou ajouté un monobloc retiré (ce sont alors des poses hors règles, voir AT.controles).
   * Renvoie {nom, premier, precedent, courant (booléens), monoblocsRetires (nombre posé), tuilesVille (pièces V)}.
   */
  function catalogueDuPlateau(plateau) {
    var pieces = (plateau && typeof plateau === 'object' && Array.isArray(plateau.pieces)) ? plateau.pieces : [];
    var retires = 0, nouveaux = 0, tuilesVille = [];
    pieces.forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      if (p.modele === VILLE_ANCIENNE) { tuilesVille.push(p); return; }
      var m = C.modele(p.modele);
      if (!m || m.cases.length < 2) return;
      if (m.ancien === true) retires += 1;
      else if (m.role === 'terrain' && C.CATALOGUE_PRECEDENT.indexOf(m.id) === -1) nouveaux += 1;
    });
    var nom = tuilesVille.length ? 'premier' : (retires && !nouveaux ? 'precedent' : 'courant');
    return { nom: nom, premier: nom === 'premier', precedent: nom === 'precedent', courant: nom === 'courant', monoblocsRetires: retires, tuilesVille: tuilesVille };
  }

  var ORDRE_CHAMPS = ['version', 'graine', 'pieces', 'recouvrements', 'camps', 'deploiements', 'modeles'];
  // Propriétaires d'une ville posée par-dessus une Plaine (§10) : 'neutre', ou le camp d'une ville de déploiement.
  var PROPRIETAIRES = ['neutre', 'vert', 'rouge'];

  /** Liste interne (non copiée) des villes posées par-dessus une Plaine ; [] si le champ est absent ou mal formé. */
  function listeDeploiements(plateau) {
    return (plateau && typeof plateau === 'object' && Array.isArray(plateau.deploiements)) ? plateau.deploiements.filter(function (x) {
      return x !== null && typeof x === 'object' && typeof x.cle === 'string' && PROPRIETAIRES.indexOf(x.camp) !== -1;
    }) : [];
  }

  /** Villes posées par-dessus une Plaine : copie de la liste [{cle, camp}], camp = 'neutre' | 'vert' | 'rouge' ([] s'il n'y en a pas). */
  function deploiements(plateau) { return listeDeploiements(plateau).map(function (x) { return { cle: x.cle, camp: x.camp }; }); }

  // ------------------------------------------------------------------ modèles (catalogue de base + pièces du document)

  function copieModele(m) {
    return {
      id: m.id, nom: m.nom,
      cases: (Array.isArray(m.cases) ? m.cases : []).map(function (c) { return { q: c.q, r: c.r, terrain: c.terrain }; }),
      quantite: m.quantite
    };
  }

  /** Liste interne (non copiée) des pièces personnelles du document ; [] si le champ est absent ou mal formé. */
  function listeModeles(plateau) {
    return (plateau && typeof plateau === 'object' && Array.isArray(plateau.modeles)) ? plateau.modeles.filter(function (m) {
      return m !== null && typeof m === 'object' && typeof m.id === 'string' && Array.isArray(m.cases);
    }) : [];
  }

  /** Pièces personnelles du document : copie de la liste [{id, nom, cases, quantite}] ([] s'il n'y en a pas). */
  function modeles(plateau) { return listeModeles(plateau).map(copieModele); }

  /**
   * Modèle par identifiant, cherché dans le catalogue de base (hors catalogue imprimé compris : M1) puis dans les
   * pièces personnelles du document. Renvoie {id, nom, nombre, cases, ...} ou null ; une pièce personnelle porte
   * `perso: true` et `nombre` = sa quantité. `plateau` peut être omis (catalogue de base seul).
   */
  function modele(plateau, id) {
    var base = C.modele(id);
    if (base || typeof id !== 'string') return base;
    var liste = listeModeles(plateau);
    for (var i = 0; i < liste.length; i++) {
      if (liste[i].id === id) return { id: id, nom: String(liste[i].nom), nombre: liste[i].quantite, perso: true, cases: liste[i].cases };
    }
    return null;
  }

  /** Identifiants de tous les modèles du document : catalogue imprimé, hors catalogue (M1), puis pièces personnelles. */
  function idsModeles(plateau) {
    return C.ORDRE_MODELES.concat(C.ORDRE_HORS_CATALOGUE, listeModeles(plateau).map(function (m) { return m.id; }));
  }

  /**
   * Cases d'un modèle posé : ancre (q, r), rotation en sixièmes de tour autour de l'ancre.
   * Renvoie [{cle, q, r, terrain}] dans l'ordre des cases du modèle ; [] si le modèle est inconnu.
   * `plateau` (facultatif) : document où chercher une pièce personnelle.
   */
  function casesModele(idModele, q, r, rotation, plateau) {
    var m = modele(plateau, idModele);
    if (!m) return [];
    return m.cases.map(function (c) {
      var t = H.tourner(c.q, c.r, rotation || 0);
      return { cle: H.cle(q + t.q, r + t.r), q: q + t.q, r: r + t.r, terrain: c.terrain };
    });
  }

  /** Cases d'une pièce posée {modele, q, r, rotation}. `plateau` (facultatif) : document de ses pièces personnelles. */
  function casesPiece(piece, plateau) { return casesModele(piece.modele, piece.q, piece.r, piece.rotation, plateau); }

  /**
   * Toutes les cases du plateau : {cle: {terrain, piece, origine, modele, evenement}}.
   *   terrain   : terrain effectif (recouvrement compris) ;
   *   piece     : identifiant de la pièce qui porte la case ;
   *   origine   : terrain d'origine (celui de la tuile du dessous) ;
   *   modele    : identifiant du modèle de la pièce ;
   *   evenement : identifiant de l'événement posé dessus, ou null.
   * Une case qui porte une ville posée par-dessus a en plus `ville` ('VD' : ville de déploiement ; 'VNP' : ville
   * neutre) et `camp` ('vert' | 'rouge' | 'neutre') ; son terrain effectif est 'ville', son origine reste 'plaine'.
   * options.sansRecouvrements = true : ignore les tuiles d'événement.
   * options.sansVilles = true : le terrain CONSTRUIT seul, sans les villes posées par-dessus ni les anciennes tuiles de ville neutre (VN).
   * En cas de chevauchement (plateau fautif), la première pièce de la liste garde la case.
   */
  function cases(plateau, options) {
    var res = {}, sansVilles = !!(options && options.sansVilles);
    (plateau.pieces || []).forEach(function (piece) {
      if (sansVilles && piece.modele === VILLE_NEUTRE) return;
      casesPiece(piece, plateau).forEach(function (c) {
        if (possede.call(res, c.cle)) return;
        res[c.cle] = { terrain: c.terrain, piece: piece.id, origine: c.terrain, modele: piece.modele, evenement: null };
      });
    });
    if (!sansVilles) {
      listeDeploiements(plateau).forEach(function (d) {
        if (!possede.call(res, d.cle) || res[d.cle].ville) return;
        res[d.cle].terrain = 'ville';
        res[d.cle].ville = d.camp === 'neutre' ? C.VILLE_NEUTRE.id : C.VILLE_DEPLOIEMENT.id;
        res[d.cle].camp = d.camp;
      });
    }
    if (!(options && options.sansRecouvrements)) {
      (plateau.recouvrements || []).forEach(function (rec) {
        var ev = C.evenement(rec.evenement);
        if (!ev || !possede.call(res, rec.cle) || res[rec.cle].evenement || res[rec.cle].ville) return;
        res[rec.cle].terrain = ev.terrain;
        res[rec.cle].evenement = ev.id;
      });
    }
    return res;
  }

  /** Clés des cases couvertes par plus d'une pièce (liste triée ; vide = pas de chevauchement). */
  function chevauchements(plateau) {
    var vues = {}, doubles = {};
    (plateau.pieces || []).forEach(function (piece) {
      casesPiece(piece, plateau).forEach(function (c) {
        if (possede.call(vues, c.cle)) doubles[c.cle] = true;
        vues[c.cle] = true;
      });
    });
    return H.trier(Object.keys(doubles));
  }

  /** Coût en rations pour entrer dans la case ; Infinity si infranchissable ou hors plateau. options.couts : autre table. */
  function cout(plateau, cle, options) {
    var toutes = cases(plateau);
    if (!possede.call(toutes, cle)) return Infinity;
    return C.coutTerrain(toutes[cle].terrain, options && options.couts);
  }

  /** Clés des villes, triées par rangée puis par colonne. */
  function villes(plateau) {
    var toutes = cases(plateau);
    return H.trier(Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }));
  }

  /**
   * Stock par modèle : {idModele: {total, poses, restant}} (restant négatif = stock dépassé), dans l'ordre de
   * idsModeles : catalogue imprimé, hors catalogue (M1, total 0), puis pièces personnelles du document.
   */
  function stock(plateau) {
    var res = Object.create(null), propre = {};
    idsModeles(plateau).forEach(function (id) {
      if (res[id]) return;
      var n = modele(plateau, id).nombre;
      n = Number.isInteger(n) ? n : 0;
      res[id] = { total: n, poses: 0, restant: n };
    });
    (plateau.pieces || []).forEach(function (piece) {
      if (typeof piece.modele !== 'string' || !res[piece.modele]) return;
      res[piece.modele].poses += 1;
      res[piece.modele].restant -= 1;
    });
    Object.keys(res).forEach(function (id) { propre[id] = res[id]; });
    return propre;
  }

  // ------------------------------------------------------------------ poser, retirer, tourner

  function entierBorne(v) { return Number.isInteger(v) && Math.abs(v) <= C.REGLAGES.bornes.coordonnee; }

  function refus(plateau, raison) { return { ok: false, plateau: plateau, raison: raison }; }

  /**
   * Identifiant LIBRE pour une nouvelle pièce : « p » suivi du numéro qui suit le plus grand numéro courant,
   * avancé tant que l'identifiant est déjà pris. Jamais de doublon, quel que soit le fichier d'origine.
   */
  function nouvelId(plateau) {
    var max = 0, pris = Object.create(null);
    (plateau.pieces || []).forEach(function (p) {
      pris[String(p.id)] = true;
      // Au-delà de 9 chiffres, l'identifiant (venu d'un fichier) ne compte pas pour le maximum : le numéro suivant
      // dépasserait la longueur permise (bornes.longueurId) et le plateau enregistré ne se relirait plus.
      var m = /^p([0-9]{1,9})$/.exec(String(p.id));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    });
    var n = max + 1;
    while (pris['p' + n] === true) n += 1;
    return 'p' + n;
  }

  /**
   * Pose une pièce du modèle `idModele`, ancre en (q, r), tournée de `rotation` sixièmes de tour.
   * Refus expliqué : modèle inconnu, coordonnées hors bornes, stock épuisé, chevauchement.
   * options.horsStock = true (pinceau) : la pose est acceptée même si le stock est épuisé ; le contrôle 1 le signale.
   * Renvoie {ok, plateau, id, horsStock} (horsStock : vrai si la pièce posée dépasse le stock) ou {ok: false, plateau, raison}.
   */
  function poser(plateau, idModele, q, r, rotation, options) {
    var m = modele(plateau, idModele);
    var rot = rotation === undefined ? 0 : rotation, horsStock = false;
    if (!m) return refus(plateau, 'Pièce inconnue du catalogue et des pièces personnelles du plateau.');
    if (!entierBorne(q) || !entierBorne(r)) return refus(plateau, 'Position hors des limites du plateau.');
    if (!Number.isInteger(rot) || rot < 0 || rot > 5) return refus(plateau, 'Rotation invalide (0 à 5 sixièmes de tour).');
    if ((plateau.pieces || []).length >= C.REGLAGES.bornes.pieces) return refus(plateau, 'Trop de pièces sur le plateau.');
    if (stock(plateau)[m.id].restant <= 0) {
      if (!(options && options.horsStock === true)) {
        return refus(plateau, m.horsCatalogue
          ? '« ' + m.nom + ' » est hors catalogue : elle ne se pose que hors stock (pinceau).'
          : 'Stock épuisé : plus de pièce « ' + m.nom + ' » (' + m.nombre + (m.perso ? ' prévue(s) pour cette pièce personnelle).' : ' au catalogue).'));
      }
      horsStock = true;
    }
    var nouvelles = casesModele(m.id, q, r, rot, plateau);
    if (!nouvelles.every(function (c) { return entierBorne(c.q) && entierBorne(c.r); })) return refus(plateau, 'Position hors des limites du plateau.');
    var occupees = cases(plateau, { sansRecouvrements: true });
    var genantes = nouvelles.filter(function (c) { return possede.call(occupees, c.cle); });
    if (genantes.length) {
      return refus(plateau, 'Chevauchement : case ' + genantes.map(function (c) { return '(' + c.cle + ')'; }).join(' ') + ' déjà occupée.');
    }
    var id = nouvelId(plateau);
    var pieces = copier(plateau).pieces;
    pieces.push({ id: id, modele: m.id, q: q, r: r, rotation: rot });
    return { ok: true, plateau: copier(plateau, { pieces: pieces }), id: id, horsStock: horsStock };
  }

  /**
   * Retire la pièce `idPiece`. Les tuiles d'événement et les villes de déploiement posées sur ses cases repartent
   * en réserve, et ses cases sortent de la liste des camps. Renvoie {ok, plateau, evenementsRetires, villesRetirees}.
   */
  function retirer(plateau, idPiece) {
    var piece = (plateau.pieces || []).filter(function (p) { return p.id === idPiece; })[0];
    if (!piece) return refus(plateau, 'Pièce introuvable sur le plateau.');
    var perdues = {};
    casesPiece(piece, plateau).forEach(function (c) { perdues[c.cle] = true; });
    var base = copier(plateau);
    var retires = base.recouvrements.filter(function (x) { return possede.call(perdues, x.cle); }).map(function (x) { return x.evenement; });
    var garde = function (k) { return !possede.call(perdues, k); };
    var villesLa = deploiements(plateau);
    return {
      ok: true,
      plateau: campsDeduits(copier(plateau, {
        pieces: base.pieces.filter(function (p) { return p.id !== idPiece; }),
        recouvrements: base.recouvrements.filter(function (x) { return garde(x.cle); }),
        deploiements: villesLa.filter(function (x) { return garde(x.cle); }),
        camps: { vert: base.camps.vert.filter(garde), rouge: base.camps.rouge.filter(garde) }
      }), plateau),
      evenementsRetires: retires,
      villesRetirees: villesLa.filter(function (x) { return !garde(x.cle); }).map(function (x) { return x.cle; })
    };
  }

  /**
   * Tourne la pièce `idPiece` de `sixiemes` sixièmes de tour (1 par défaut, négatif accepté) autour de son ancre.
   * Refus en cas de chevauchement, et pour le noyau, qui est fixe. Les tuiles d'événement et les camps posés sur une case que la pièce
   * ne couvre plus (ou dont le terrain a changé) sont retirés. Renvoie {ok, plateau, evenementsRetires}.
   */
  function tourner(plateau, idPiece, sixiemes) {
    var pas = sixiemes === undefined ? 1 : sixiemes;
    var piece = (plateau.pieces || []).filter(function (p) { return p.id === idPiece; })[0];
    if (!piece) return refus(plateau, 'Pièce introuvable sur le plateau.');
    if (!Number.isInteger(pas)) return refus(plateau, 'Rotation invalide.');
    // Le noyau est fixe (règle de l'utilisateur) : il ne se tourne pas plus qu'il ne se gomme.
    var modelePiece = modele(plateau, piece.modele);
    if (modelePiece && modelePiece.noyau) { var rn = refus(plateau, RAISON_NOYAU_FIXE); rn.noyau = true; return rn; }
    var rotation = (((piece.rotation + pas) % 6) + 6) % 6;
    var autres = cases({ pieces: plateau.pieces.filter(function (p) { return p.id !== idPiece; }), modeles: plateau.modeles }, { sansRecouvrements: true });
    var nouvelles = casesModele(piece.modele, piece.q, piece.r, rotation, plateau);
    if (!nouvelles.every(function (c) { return entierBorne(c.q) && entierBorne(c.r); })) return refus(plateau, 'Position hors des limites du plateau.');
    var genantes = nouvelles.filter(function (c) { return possede.call(autres, c.cle); });
    if (genantes.length) {
      return refus(plateau, 'Chevauchement : case ' + genantes.map(function (c) { return '(' + c.cle + ')'; }).join(' ') + ' déjà occupée.');
    }
    var avant = {}, apres = {};
    casesPiece(piece, plateau).forEach(function (c) { avant[c.cle] = c.terrain; });
    nouvelles.forEach(function (c) { apres[c.cle] = c.terrain; });
    var garde = function (k) { return !possede.call(avant, k) || apres[k] === avant[k]; };
    var base = copier(plateau), villesLa = deploiements(plateau);
    return {
      ok: true,
      plateau: campsDeduits(copier(plateau, {
        pieces: base.pieces.map(function (p) { if (p.id === idPiece) p.rotation = rotation; return p; }),
        recouvrements: base.recouvrements.filter(function (x) { return garde(x.cle); }),
        deploiements: villesLa.filter(function (x) { return garde(x.cle); }),
        camps: { vert: base.camps.vert.filter(garde), rouge: base.camps.rouge.filter(garde) }
      }), plateau),
      evenementsRetires: base.recouvrements.filter(function (x) { return !garde(x.cle); }).map(function (x) { return x.evenement; }),
      villesRetirees: villesLa.filter(function (x) { return !garde(x.cle); }).map(function (x) { return x.cle; })
    };
  }

  // ------------------------------------------------------------------ pinceau et gomme (§8.2, logique seule)

  /**
   * Pinceau : met une tuile d'UNE case du terrain voulu ('plaine', 'foret', 'marais', 'montagne' : modèles de
   * REGLAGES.pinceau) sur la case `cle`. Ces tuiles sont hors catalogue : elles sont posées hors stock (résultat :
   * horsStock = true et `note` le dit), sauf une Plaine tant qu'il reste une tuile de remplissage en stock.
   * Les villes ne se peignent pas : voir poserVille. Une ancienne tuile de ville neutre (pièce VN) n'est ni
   * repeinte ni gommée (refus, villeNeutre = true) : elle se retouche à l'étape « Villes ».
   * Une tuile d'une case déjà là est remplacée (ses tuiles d'événement et sa ville posée par-dessus repartent en
   * réserve) ; si elle a déjà ce terrain, rien ne change (inchange = true).
   * Refus avec raison sur une case de monobloc (monobloc = true) ou du noyau (noyau = true) : `piece` la désigne.
   * Les camps ne sont pas recalculés (voir avecCamps).
   * Renvoie {ok, plateau, id, modele, terrain, horsStock, remplace (identifiant de la tuile remplacée ou null),
   *          inchange, evenementsRetires, note} ou {ok: false, plateau, raison, monobloc, noyau, piece}.
   */
  function peindre(plateau, cle, terrain) {
    var table = C.REGLAGES.pinceau;
    if (!cleValide(cle)) return refus(plateau, 'Case hors des limites du plateau.');
    if (terrain === 'ville') return refus(plateau, 'Le pinceau ne pose pas de ville : les villes se posent à l’étape « Villes », une fois le terrain construit.');
    if (typeof terrain !== 'string' || !possede.call(table, terrain) || !C.modele(table[terrain])) return refus(plateau, 'Terrain inconnu du pinceau.');
    var m = C.modele(table[terrain]), p = H.decle(cle), base = plateau, remplace = null, retires = [];
    // Une Plaine vient d'abord des tuiles de remplissage du catalogue, tant qu'il en reste.
    var remplissage = C.modele(C.REGLAGES.pinceauRemplissage);
    if (remplissage && remplissage.cases.length === 1 && remplissage.cases[0].terrain === terrain && stock(plateau)[remplissage.id].restant > 0) m = remplissage;
    var occupees = cases(plateau, { sansRecouvrements: true });
    if (possede.call(occupees, cle)) {
      var ici = occupees[cle], modeleIci = modele(plateau, ici.modele);
      if (ici.modele === VILLE_NEUTRE) {
        var rv = refus(plateau, RAISON_VILLE_NEUTRE);
        rv.villeNeutre = true; rv.piece = ici.piece;
        return rv;
      }
      if (modeleIci && (modeleIci.noyau || modeleIci.cases.length > 1)) {
        var r = refus(plateau, modeleIci.noyau
          ? 'Le pinceau ne modifie pas le noyau.'
          : 'Cette case appartient au monobloc « ' + modeleIci.nom + ' » : le pinceau ne le modifie pas. Retirez d’abord le monobloc.');
        r.monobloc = true; r.noyau = !!modeleIci.noyau; r.piece = ici.piece;
        return r;
      }
      if (modeleIci && modeleIci.cases[0].terrain === terrain) {
        return { ok: true, plateau: plateau, id: ici.piece, modele: ici.modele, terrain: terrain, horsStock: false, remplace: null, inchange: true, evenementsRetires: [], note: null };
      }
      var retrait = retirer(plateau, ici.piece);
      if (!retrait.ok) return refus(plateau, retrait.raison);
      base = retrait.plateau; remplace = ici.piece; retires = retrait.evenementsRetires;
    }
    var pose = poser(base, m.id, p.q, p.r, 0, { horsStock: true });
    if (!pose.ok) return refus(plateau, pose.raison);
    return {
      ok: true, plateau: pose.plateau, id: pose.id, modele: m.id, terrain: terrain, horsStock: pose.horsStock,
      remplace: remplace, inchange: false, evenementsRetires: retires,
      note: pose.horsStock ? 'Tuile « ' + m.nom + ' » posée hors stock : elle est à prévoir en plus du catalogue, et hors règles (le terrain se construit en monoblocs) : les contrôles la signalent.' : null
    };
  }

  /**
   * Gomme : retire la tuile d'UNE case qui occupe `cle` (ses tuiles d'événement repartent en réserve).
   * Sur une case de monobloc ou du noyau, rien n'est retiré : le résultat le signale (monobloc = true, noyau,
   * `piece`, `modele`, `cases` du monobloc). Pour un monobloc, l'interface demande confirmation puis appelle
   * retirer(plateau, piece). Le NOYAU est fixe (règle de l'utilisateur) : la gomme ne le retire jamais ; seuls
   * « Vider le plateau » et un nouveau plateau le font.
   * Sur une case qui porte une ville posée par-dessus, la gomme retire D'ABORD cette ville (résultat : ville = 'VD'
   * ou 'VNP', camp) et laisse la tuile du dessous.
   * Renvoie {ok, plateau, id, modele, evenementsRetires} ou {ok: false, plateau, raison, vide | monobloc, ...}.
   */
  function gommer(plateau, cle) {
    var occupees = cases(plateau, { sansRecouvrements: true }), r;
    if (typeof cle === 'string' && possede.call(occupees, cle) && occupees[cle].ville) {
      var sansVille = retirerVille(plateau, cle);
      return { ok: true, plateau: sansVille.plateau, id: occupees[cle].piece, modele: occupees[cle].modele, evenementsRetires: [], ville: occupees[cle].ville, camp: occupees[cle].camp };
    }
    if (typeof cle !== 'string' || !possede.call(occupees, cle)) {
      r = refus(plateau, 'Case vide : rien à gommer.');
      r.vide = true;
      return r;
    }
    var ici = occupees[cle], m = modele(plateau, ici.modele);
    if (ici.modele === VILLE_NEUTRE) {
      r = refus(plateau, RAISON_VILLE_NEUTRE);
      r.villeNeutre = true; r.piece = ici.piece;
      return r;
    }
    if (m && (m.noyau || m.cases.length > 1)) {
      var piece = (plateau.pieces || []).filter(function (x) { return x.id === ici.piece; })[0];
      r = refus(plateau, m.noyau
        ? 'Cette case appartient au noyau (' + m.cases.length + ' cases), qui est fixe : la gomme ne le retire jamais.'
        : 'Cette case appartient au monobloc « ' + m.nom + ' » (' + m.cases.length + ' cases) : la gomme ne le retire qu’après confirmation.');
      r.monobloc = true; r.noyau = !!m.noyau; r.piece = ici.piece; r.modele = ici.modele;
      r.cases = piece ? casesPiece(piece, plateau).map(function (c) { return c.cle; }) : [cle];
      return r;
    }
    var retrait = retirer(plateau, ici.piece);
    if (!retrait.ok) return refus(plateau, retrait.raison);
    return { ok: true, plateau: retrait.plateau, id: ici.piece, modele: ici.modele, evenementsRetires: retrait.evenementsRetires };
  }

  // ------------------------------------------------------------------ camps

  /**
   * ANCIEN CATALOGUE : villes d'une case (modèle V) des rangées extrêmes, sans limite de nombre : celles de la rangée
   * du haut (r minimal) pour Vert, celles de la rangée du bas (r maximal) pour Rouge. Renvoie {vert: [clés], rouge: [clés]}.
   * Sert au contrôle des villes d'un ancien plateau ; les villes de déploiement sont données par campsAuto.
   */
  function villesRangeesExtremes(plateau) {
    var toutes = cases(plateau, { sansRecouvrements: true, sansVilles: true });
    var cles = Object.keys(toutes);
    if (!cles.length) return { vert: [], rouge: [] };
    var rs = cles.map(function (k) { return H.decle(k).r; });
    var haut = Math.min.apply(null, rs), bas = Math.max.apply(null, rs);
    var liste = function (rangee) {
      return H.trier(cles.filter(function (k) { return toutes[k].terrain === 'ville' && toutes[k].modele === VILLE_ANCIENNE && H.decle(k).r === rangee; }));
    };
    return { vert: liste(haut), rouge: haut === bas ? [] : liste(bas) };
  }

  /**
   * Villes de déploiement déduites du plateau. Catalogue 2 : les tuiles de ville de déploiement posées (champ
   * `deploiements`), par propriétaire. Ancien plateau sans aucune de ces tuiles : les villes d'une case (modèle V)
   * de la rangée du haut pour Vert, de la rangée du bas pour Rouge.
   * Jamais plus de REGLAGES.villesParCamp cases par camp : si un camp en a davantage, ou si une rangée extrême porte
   * davantage de villes, le cas est ambigu et AUCUNE n'est désignée pour ce camp (liste vide) ; le contrôle 4
   * signale l'égalité. Le résultat est donc toujours accepté par valider(). Renvoie {vert: [clés], rouge: [clés]}.
   */
  function campsAuto(plateau) {
    var max = C.REGLAGES.villesParCamp, posees = listeDeploiements(plateau);
    if (posees.length) {
      var toutes = cases(plateau, { sansRecouvrements: true }), res = { vert: [], rouge: [] };
      posees.forEach(function (x) { if (CAMPS.indexOf(x.camp) !== -1 && possede.call(toutes, x.cle) && toutes[x.cle].camp === x.camp && res[x.camp].indexOf(x.cle) === -1) res[x.camp].push(x.cle); });
      return { vert: res.vert.length > max ? [] : H.trier(res.vert), rouge: res.rouge.length > max ? [] : H.trier(res.rouge) };
    }
    var rangees = villesRangeesExtremes(plateau);
    return {
      vert: rangees.vert.length > max ? [] : rangees.vert,
      rouge: rangees.rouge.length > max ? [] : rangees.rouge
    };
  }

  /** Nouveau plateau dont les camps sont ceux de campsAuto. */
  function avecCamps(plateau) { return copier(plateau, { camps: campsAuto(plateau) }); }

  /** Après une modification : si le plateau d'avant portait des villes de déploiement, `camps` est redéduit. */
  function campsDeduits(nouveau, avant) { return listeDeploiements(avant).length ? avecCamps(nouveau) : nouveau; }

  // ------------------------------------------------------------------ chemins

  /** Vrai si la case existe et se franchit. */
  function franchissable(toutes, cle, couts) {
    return possede.call(toutes, cle) && C.coutTerrain(toutes[cle].terrain, couts) !== Infinity;
  }

  /**
   * Nombre de pas minimal depuis les cases `sources` vers chaque case franchissable atteignable.
   * `toutes` : résultat de cases(). Renvoie {cle: pas}. Les sources infranchissables sont ignorées.
   */
  function pasSurCases(toutes, sources, options) {
    var couts = options && options.couts, d = {}, file = [];
    sources.forEach(function (s) {
      if (franchissable(toutes, s, couts) && !possede.call(d, s)) { d[s] = 0; file.push(s); }
    });
    for (var i = 0; i < file.length; i++) {
      var v = H.voisines(file[i]);
      for (var j = 0; j < 6; j++) {
        if (!possede.call(d, v[j]) && franchissable(toutes, v[j], couts)) { d[v[j]] = d[file[i]] + 1; file.push(v[j]); }
      }
    }
    return d;
  }

  /**
   * Rations minimales depuis les cases `sources` (coût 0 sur place ; entrer dans une case coûte son terrain).
   * Renvoie {cle: {cout, precedent}} : interne, voir rationsSurCases et chemin.
   */
  function dijkstra(toutes, sources, couts) {
    var d = {}, fait = {}, ouvertes = [];
    sources.forEach(function (s) {
      if (franchissable(toutes, s, couts) && !possede.call(d, s)) { d[s] = { cout: 0, precedent: null }; ouvertes.push(s); }
    });
    while (ouvertes.length) {
      // Plateau d'une centaine de cases : une recherche linéaire du minimum suffit (ordre stable, donc déterministe).
      var im = 0;
      for (var i = 1; i < ouvertes.length; i++) if (d[ouvertes[i]].cout < d[ouvertes[im]].cout) im = i;
      var courante = ouvertes.splice(im, 1)[0];
      if (fait[courante]) continue;
      fait[courante] = true;
      var v = H.voisines(courante);
      for (var j = 0; j < 6; j++) {
        if (fait[v[j]] || !franchissable(toutes, v[j], couts)) continue;
        var nv = d[courante].cout + C.coutTerrain(toutes[v[j]].terrain, couts);
        if (!possede.call(d, v[j]) || nv < d[v[j]].cout) { d[v[j]] = { cout: nv, precedent: courante }; ouvertes.push(v[j]); }
      }
    }
    return d;
  }

  /** Rations minimales depuis `sources` vers chaque case atteignable, sur un résultat de cases(). Renvoie {cle: cout}. */
  function rationsSurCases(toutes, sources, options) {
    var d = dijkstra(toutes, sources, options && options.couts), res = {};
    Object.keys(d).forEach(function (k) { res[k] = d[k].cout; });
    return res;
  }

  /** Pas minimaux depuis `sources` (clé ou liste de clés) : {cle: pas}. options.sansRecouvrements, options.couts. */
  function distancesPas(plateau, sources, options) {
    return pasSurCases(cases(plateau, options), [].concat(sources), options);
  }

  /** Rations minimales depuis `sources` (clé ou liste de clés) : {cle: cout}. options.sansRecouvrements, options.couts. */
  function distancesRations(plateau, sources, options) {
    return rationsSurCases(cases(plateau, options), [].concat(sources), options);
  }

  /**
   * Chemin le moins coûteux en rations de `depart` à `arrivee` (options.mode = 'pas' : le plus court en pas).
   * Renvoie {ok: true, cases: [clés, départ et arrivée compris], pas, cout} ou {ok: false, raison}.
   */
  function chemin(plateau, depart, arrivee, options) {
    var toutes = cases(plateau, options), couts = options && options.couts;
    if (!possede.call(toutes, depart) || !possede.call(toutes, arrivee)) return { ok: false, raison: 'Case hors du plateau.' };
    if (!franchissable(toutes, depart, couts) || !franchissable(toutes, arrivee, couts)) return { ok: false, raison: 'Case infranchissable.' };
    var enPas = !!(options && options.mode === 'pas');
    var tablePas = null;
    if (enPas) {            // même parcours, tous les coûts ramenés à 1
      tablePas = {};
      Object.keys(toutes).forEach(function (k) { tablePas[toutes[k].terrain] = franchissable(toutes, k, couts) ? 1 : null; });
    }
    var d = dijkstra(toutes, [depart], enPas ? tablePas : couts);
    if (!possede.call(d, arrivee)) return { ok: false, raison: 'Aucun chemin : les deux cases ne sont pas reliées.' };
    var liste = [], k = arrivee;
    while (k !== null) { liste.unshift(k); k = d[k].precedent; }
    var total = 0;
    for (var i = 1; i < liste.length; i++) total += C.coutTerrain(toutes[liste[i]].terrain, couts);
    return { ok: true, cases: liste, pas: liste.length - 1, cout: total };
  }

  /** Groupes de cases d'un seul tenant parmi une liste de clés : [[clés triées]], du plus grand au plus petit. */
  function composantes(cles) {
    var dans = {}, vues = {}, groupes = [];
    cles.forEach(function (k) { dans[k] = true; });
    H.trier(cles).forEach(function (k) {
      if (vues[k]) return;
      var groupe = [k];
      vues[k] = true;
      for (var i = 0; i < groupe.length; i++) {
        var v = H.voisines(groupe[i]);
        for (var j = 0; j < 6; j++) if (dans[v[j]] === true && !vues[v[j]]) { vues[v[j]] = true; groupe.push(v[j]); }
      }
      groupes.push(H.trier(groupe));
    });
    // Tri stable : à taille égale, l'ordre de lecture de la première case départage.
    return groupes.sort(function (a, b) { return b.length - a.length; });
  }

  /**
   * Coupures du plateau : groupes de cases franchissables qui ne communiquent pas.
   * Renvoie {groupes: nombre, isolees: [clés hors du plus grand groupe], villesIsolees: [clés]}.
   * options.sansRecouvrements : sur le terrain d'origine.
   */
  function coupures(plateau, options) {
    var toutes = cases(plateau, options), couts = options && options.couts;
    var groupes = composantes(Object.keys(toutes).filter(function (k) { return franchissable(toutes, k, couts); }));
    var isolees = [];
    groupes.slice(1).forEach(function (g) { isolees = isolees.concat(g); });
    isolees = H.trier(isolees);
    return {
      groupes: groupes.length,
      isolees: isolees,
      villesIsolees: isolees.filter(function (k) { return toutes[k].terrain === 'ville'; })
    };
  }

  /**
   * Trous du plateau : groupes de cases VIDES entièrement entourées par le plateau (aucun passage vers l'extérieur).
   * `cles` : clés des cases occupées. Renvoie [[clés triées]] (un groupe par trou, du plus grand au plus petit).
   */
  function trous(cles) {
    if (!cles.length) return [];
    var occupe = Object.create(null), qs = [], rs = [];
    cles.forEach(function (k) { var p = H.decle(k); occupe[k] = true; qs.push(p.q); rs.push(p.r); });
    // Cadre élargi d'une case : son pourtour est vide et d'un seul tenant, c'est « l'extérieur ».
    var q0 = Math.min.apply(null, qs) - 1, q1 = Math.max.apply(null, qs) + 1;
    var r0 = Math.min.apply(null, rs) - 1, r1 = Math.max.apply(null, rs) + 1;
    var dehors = Object.create(null), depart = H.cle(q0, r0), file = [depart];
    dehors[depart] = true;
    for (var i = 0; i < file.length; i++) {
      var v = H.voisines(file[i]);
      for (var j = 0; j < 6; j++) {
        var p = H.decle(v[j]);
        if (p.q < q0 || p.q > q1 || p.r < r0 || p.r > r1 || occupe[v[j]] === true || dehors[v[j]] === true) continue;
        dehors[v[j]] = true;
        file.push(v[j]);
      }
    }
    var vides = [];
    for (var q = q0; q <= q1; q++) {
      for (var r = r0; r <= r1; r++) {
        var k = H.cle(q, r);
        if (occupe[k] !== true && dehors[k] !== true) vides.push(k);
      }
    }
    return composantes(vides);
  }

  // ------------------------------------------------------------------ villes libres sur une Plaine (§10)

  var VILLE_NEUTRE = 'VN', VILLE_ANCIENNE = 'V';
  var NOMS_PROPRIETAIRES = { vert: 'Vert', rouge: 'Rouge', neutre: 'neutre' };
  // Le noyau est fixe : même message pour « Tourner », « Déplacer », « Retirer » et le glisser.
  var RAISON_NOYAU_FIXE = 'Le noyau est fixe : il ne se tourne pas, ne se déplace pas et ne se retire pas. Seuls « Vider le plateau » et « Nouveau plateau vierge » l’enlèvent.';
  // Tuile de ville neutre des règles précédentes (pièce VN) : elle ne se retouche que par l'étape « Villes ».
  var RAISON_VILLE_NEUTRE = 'Cette ville neutre est une tuile des règles précédentes (ajoutée contre le plateau) : elle ne se déplace, ne se tourne et ne se retire qu’à l’étape « Villes » (mode « Villes » : cliquez-la pour la retirer, puis posez une ville neutre sur une Plaine).';

  /** Nombre de tuiles de ville permises pour un propriétaire ('vert' | 'rouge' : villesParCamp ; 'neutre' : villes.neutres). */
  function quotaVilles(proprietaire) {
    if (proprietaire === 'neutre') return (C.REGLAGES.villes && Number.isInteger(C.REGLAGES.villes.neutres)) ? C.REGLAGES.villes.neutres : 2;
    return C.REGLAGES.villesParCamp;
  }

  function ecartVoulu(options) {
    return (options && options.ecartVilles !== undefined) ? options.ecartVilles : C.REGLAGES.ecartVilles;
  }

  /**
   * Cases sur lesquelles se jugent les villes, PARTOUT de la même façon (clic, surbrillance, pose automatique,
   * générateur, contrôles) : le terrain et les villes posées, SANS l'effet des tuiles d'événement (les distances ne
   * dépendent pas d'un événement posé à l'essai) ; une case qui porte une tuile d'événement garde seulement la
   * marque `evenement`, qui lui interdit de recevoir une ville.
   */
  function casesPourVilles(plateau) {
    var toutes = cases(plateau, { sansRecouvrements: true });
    (plateau.recouvrements || []).forEach(function (x) {
      if (x && typeof x.cle === 'string' && possede.call(toutes, x.cle) && C.evenement(x.evenement)) toutes[x.cle].evenement = x.evenement;
    });
    return toutes;
  }

  /** Clés des villes d'un résultat de cases(), triées (rangée puis colonne) : la ville n° i est la i-ème de cette liste. */
  function villesSurCases(toutes) {
    return H.trier(Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }));
  }

  /**
   * Pourquoi la case `cle` ne peut-elle pas recevoir une ville (neutre ou de déploiement : la règle est la même) ?
   * Renvoie null si elle convient, sinon {cause, raison} avec cause :
   *   'hors' (pas une case du plateau), 'ville' (elle en porte déjà une), 'noyau', 'evenement' (tuile d'événement
   *   posée dessus), 'plaine' (la tuile d'origine n'est pas une Plaine), 'ecart' (moins de `ecartVilles` pas, par les
   *   cases franchissables, d'une autre ville : le refus porte aussi `ville` (clé), `numero` et `pas`).
   * `toutes` : casesPourVilles(plateau). options : ecartVilles, couts, sansEcart (true : ne pas vérifier l'écart),
   * villes (clés des villes dont il faut s'écarter ; par défaut toutes celles de `toutes`).
   */
  function refusVilleSurCases(toutes, cle, options) {
    if (typeof cle !== 'string' || !possede.call(toutes, cle)) return { cause: 'hors', raison: 'Cette case n’est pas sur le plateau : une ville se pose par-dessus une Plaine du plateau.' };
    var c = toutes[cle], m = C.modele(c.modele);
    if (c.terrain === 'ville') return { cause: 'ville', raison: 'Cette case porte déjà une ville.' };
    if (m && m.noyau) return { cause: 'noyau', raison: 'Une ville ne se pose pas sur le noyau.' };
    if (c.evenement) return { cause: 'evenement', raison: 'Cette case porte une tuile d’événement.' };
    if (c.origine !== 'plaine') return { cause: 'plaine', raison: 'Ce n’est pas une Plaine (ici : ' + c.origine + ') : une ville se pose par-dessus une case de Plaine.' };
    if (options && options.sansEcart) return null;
    var ecart = ecartVoulu(options), toutesVilles = villesSurCases(toutes);
    var autres = (options && options.villes) || toutesVilles;
    var d = pasSurCases(toutes, [cle], { couts: options && options.couts }), proche = null;
    autres.forEach(function (v) {
      if (v !== cle && possede.call(d, v) && d[v] < ecart && (proche === null || d[v] < d[proche])) proche = v;
    });
    if (proche === null) return null;
    var numero = toutesVilles.indexOf(proche) + 1;
    return {
      cause: 'ecart', ville: proche, numero: numero, pas: d[proche],
      raison: 'Trop près de la ville ' + (numero ? 'n° ' + numero + ' ' : '') + '(' + proche + ') : ' + d[proche] + ' pas, il en faut ' + ecart + ' (soit ' + (ecart - 1) + ' cases entre elles).'
    };
  }

  /**
   * Plaines qui peuvent recevoir une ville : clés triées. Mêmes conditions que refusVilleSurCases, en un seul parcours.
   * `toutes` : casesPourVilles(plateau). options : ecartVilles, couts, sansEcart, villes.
   */
  function placesVilleSurCases(toutes, options) {
    var autres = (options && options.villes) || villesSurCases(toutes), ecart = ecartVoulu(options);
    var d = (options && options.sansEcart) ? null : pasSurCases(toutes, autres, { couts: options && options.couts });
    var sansEcart = { sansEcart: true };
    return H.trier(Object.keys(toutes).filter(function (k) {
      if (refusVilleSurCases(toutes, k, sansEcart) !== null) return false;
      return !d || !possede.call(d, k) || d[k] >= ecart;
    }));
  }

  /**
   * Où en sont les villes : {vert: [clés], rouge: [clés], neutres: [{cle, piece, ancienne}],
   *                          manquantes: {vert, rouge, neutres} (nombres), completes, reglesPrecedentes}.
   * Une ville neutre est une tuile posée par-dessus une Plaine (piece = null, ancienne = false) ou, sur un plateau
   * des règles précédentes, une pièce VN ajoutée contre le plateau (piece = son identifiant, ancienne = true) : les
   * deux comptent dans le quota des villes neutres.
   * reglesPrecedentes : voir villesReglesPrecedentes (le seul indicateur, repris par les contrôles et les vues).
   */
  function etatVilles(plateau) {
    var res = { vert: [], rouge: [], neutres: [] }, vues = Object.create(null);
    var terrain = cases(plateau, { sansRecouvrements: true, sansVilles: true });
    listeDeploiements(plateau).forEach(function (x) {
      if (!possede.call(terrain, x.cle) || vues[x.cle] === true) return;
      vues[x.cle] = true;
      if (x.camp === 'neutre') res.neutres.push({ cle: x.cle, piece: null, ancienne: false });
      else res[x.camp].push(x.cle);
    });
    res.vert = H.trier(res.vert); res.rouge = H.trier(res.rouge);
    (plateau.pieces || []).forEach(function (p) {
      if (p.modele === VILLE_NEUTRE) res.neutres.push({ cle: H.cle(p.q, p.r), piece: p.id, ancienne: true });
    });
    var ordre = H.trier(res.neutres.map(function (n) { return n.cle; }));
    res.neutres.sort(function (a, b) { return ordre.indexOf(a.cle) - ordre.indexOf(b.cle); });
    res.manquantes = {
      vert: Math.max(0, quotaVilles('vert') - res.vert.length), rouge: Math.max(0, quotaVilles('rouge') - res.rouge.length),
      neutres: Math.max(0, quotaVilles('neutre') - res.neutres.length)
    };
    res.completes = !res.manquantes.vert && !res.manquantes.rouge && !res.manquantes.neutres;
    res.reglesPrecedentes = villesReglesPrecedentes(plateau).precedentes;
    return res;
  }

  /**
   * Ce plateau porte-t-il des villes posées selon des règles d'AVANT le 2026-11-20 ? C'est LA définition, reprise par
   * les contrôles et les vues : il porte au moins une ville en tuile d'une case, soit une ville neutre ajoutée contre
   * le plateau (pièce VN), soit une ville du premier catalogue (pièce V). Un tel plateau reste lisible et jouable ;
   * ses anciennes villes ne sont jamais une erreur, seulement une alerte « règles précédentes pour les villes ».
   * (Une ville de déploiement posée autrefois au bord est une tuile par-dessus une Plaine : elle respecte les règles
   * d'aujourd'hui et ne se distingue pas.) Renvoie {precedentes, neutresTuiles: [clés], villesTuiles: [clés]}.
   */
  function villesReglesPrecedentes(plateau) {
    var neutres = [], anciennes = [];
    ((plateau && Array.isArray(plateau.pieces)) ? plateau.pieces : []).forEach(function (p) {
      if (!p || typeof p !== 'object') return;
      if (p.modele === VILLE_NEUTRE) neutres.push(H.cle(p.q, p.r));
      else if (p.modele === VILLE_ANCIENNE) anciennes.push(H.cle(p.q, p.r));
    });
    return { precedentes: neutres.length + anciennes.length > 0, neutresTuiles: H.trier(neutres), villesTuiles: H.trier(anciennes) };
  }

  /**
   * Peut-on poser une ville de ce propriétaire ('neutre', 'vert' ou 'rouge') sur la case `cle` ?
   * Renvoie {ok: true} ou {ok: false, raison, cause, ...}. Conditions (§10, C1 à C3) : il reste une tuile à ce
   * propriétaire (cause 'quota'), puis celles de refusVilleSurCases : une Plaine d'origine du plateau, hors noyau,
   * sans tuile d'événement ni autre ville, à `ecartVilles` pas au moins de toute autre ville.
   * options : ecartVilles, couts.
   */
  function peutPoserVille(plateau, proprietaire, cle, options) {
    if (PROPRIETAIRES.indexOf(proprietaire) === -1) return { ok: false, cause: 'proprietaire', raison: 'Propriétaire inconnu (neutre, vert ou rouge).' };
    var etat = etatVilles(plateau), quota = quotaVilles(proprietaire);
    var posees = proprietaire === 'neutre' ? etat.neutres.length : etat[proprietaire].length;
    if (posees >= quota) {
      return { ok: false, cause: 'quota', raison: proprietaire === 'neutre'
        ? 'Quota atteint : les ' + quota + ' villes neutres sont déjà posées. Retirez-en une avant d’en poser une autre.'
        : 'Quota atteint : ' + NOMS_PROPRIETAIRES[proprietaire] + ' a déjà ses ' + quota + ' villes de déploiement. Retirez-en une avant d’en poser une autre.' };
    }
    if (listeDeploiements(plateau).length >= C.REGLAGES.bornes.deploiements) return { ok: false, cause: 'quota', raison: 'Trop de villes posées sur le plateau.' };
    var refusLa = refusVilleSurCases(casesPourVilles(plateau), cle, options);
    if (refusLa) { refusLa.ok = false; return refusLa; }
    return { ok: true };
  }

  /** Plaines où ce propriétaire peut poser une ville : clés triées ([] s'il a déjà toutes les siennes). Voir peutPoserVille. */
  function placesVille(plateau, proprietaire, options) {
    if (PROPRIETAIRES.indexOf(proprietaire) === -1) return [];
    var etat = etatVilles(plateau);
    if ((proprietaire === 'neutre' ? etat.neutres.length : etat[proprietaire].length) >= quotaVilles(proprietaire)) return [];
    return placesVilleSurCases(casesPourVilles(plateau), options);
  }

  /**
   * Pose une ville du propriétaire ('neutre', 'vert' ou 'rouge') par-dessus la Plaine `cle` (la tuile du dessous reste
   * en place). `camps` est tenu à jour. Renvoie {ok, plateau, proprietaire, cle} ou {ok: false, plateau, raison, cause, …}
   * (le refus reprend les champs de peutPoserVille).
   */
  function poserVille(plateau, proprietaire, cle, options) {
    var avis = peutPoserVille(plateau, proprietaire, cle, options);
    if (!avis.ok) {
      var r = refus(plateau, avis.raison);
      Object.keys(avis).forEach(function (k) { if (k !== 'ok' && k !== 'raison') r[k] = avis[k]; });      // cause ; pour un écart : ville, numero, pas
      return r;
    }
    var liste = deploiements(plateau);
    liste.push({ cle: cle, camp: proprietaire });
    return { ok: true, plateau: avecCamps(copier(plateau, { deploiements: liste })), proprietaire: proprietaire, cle: cle };
  }

  /**
   * Retire la ville posée sur la case `cle` : une tuile posée par-dessus une Plaine (la Plaine redevient libre) ou,
   * sur un plateau des règles précédentes, la tuile de ville neutre d'une case (pièce VN). `camps` est tenu à jour.
   * Renvoie {ok, plateau, proprietaire, cle, ancienne} ou {ok: false, plateau, raison}.
   */
  function retirerVille(plateau, cle) {
    var liste = deploiements(plateau), trouvee = liste.filter(function (x) { return x.cle === cle; })[0];
    if (trouvee) {
      var nouveau = avecCamps(copier(plateau, { deploiements: liste.filter(function (x) { return x.cle !== cle; }) }));
      return { ok: true, plateau: nouveau, proprietaire: trouvee.camp, cle: cle, ancienne: false };
    }
    var piece = (plateau.pieces || []).filter(function (p) { return p.modele === VILLE_NEUTRE && H.cle(p.q, p.r) === cle; })[0];
    if (!piece) return refus(plateau, 'Aucune ville à retirer sur cette case (la ville du noyau ne se retire pas).');
    var retrait = retirer(plateau, piece.id);
    return retrait.ok ? { ok: true, plateau: retrait.plateau, proprietaire: 'neutre', cle: cle, ancienne: true } : refus(plateau, retrait.raison);
  }

  // ------------------------------------------------------------------ événements

  /**
   * Condition de pose d'un événement sur une case, d'après le terrain d'ORIGINE (cahier des charges §2).
   * `base` : cases(plateau, {sansRecouvrements: true}). Renvoie null si la pose est permise, sinon la raison du refus.
   */
  function refusTerrainEvenement(base, idEvenement, cle) {
    var ev = C.evenement(idEvenement), R = C.REGLAGES;
    if (!ev) return 'Événement inconnu de la réserve.';
    if (typeof cle !== 'string' || !possede.call(base, cle)) return 'Case hors du plateau.';
    var c = base[cle], m = C.modele(c.modele);            // une pièce personnelle n'est jamais le noyau
    if (c.ville) return 'Un événement ne se pose jamais sur une ville.';
    if (R.evenementsInterditsSur.indexOf(c.origine) !== -1) return 'Un événement ne se pose jamais sur une case de ce type (' + c.origine + ').';
    if (R.evenementsInterditsSurNoyau && m && m.noyau) return 'Un événement ne se pose jamais sur le noyau.';
    if (ev.sur.terrains && ev.sur.terrains.indexOf(c.origine) === -1) {
      return '« ' + ev.nom + ' » se pose sur : ' + ev.sur.terrains.join(' ou ') + ' (ici : ' + c.origine + ').';
    }
    if (ev.sur.franchissable && C.coutTerrain(c.origine) === Infinity) return '« ' + ev.nom + ' » se pose sur une case franchissable.';
    if (ev.sur.voisineDe) {
      var touche = H.voisines(cle).some(function (v) { return possede.call(base, v) && base[v].origine === ev.sur.voisineDe; });
      if (!touche) return '« ' + ev.nom + ' » se pose sur une case voisine d’une case « ' + ev.sur.voisineDe + ' ».';
    }
    return null;
  }

  /**
   * La tuile d'événement peut-elle être posée sur la case ? Renvoie {ok: true} ou {ok: false, raison}.
   * options.occupees : clés des cases occupées par un bataillon (pose refusée dessus).
   */
  function peutPoserEvenement(plateau, idEvenement, cle, options) {
    var ev = C.evenement(idEvenement);
    if (!ev) return { ok: false, raison: 'Événement inconnu de la réserve.' };
    var recs = plateau.recouvrements || [];
    if (recs.some(function (x) { return x.evenement === ev.id; })) return { ok: false, raison: '« ' + ev.nom + ' » est déjà sur le plateau (tuile unique).' };
    if (recs.some(function (x) { return x.cle === cle; })) return { ok: false, raison: 'Cette case porte déjà une tuile d’événement.' };
    if (recs.length >= C.REGLAGES.bornes.recouvrements) return { ok: false, raison: 'Trop de tuiles d’événement sur le plateau.' };
    var raison = refusTerrainEvenement(cases(plateau, { sansRecouvrements: true }), ev.id, cle);
    if (raison) return { ok: false, raison: raison };
    if (options && options.occupees && Array.prototype.indexOf.call(options.occupees, cle) !== -1) {
      return { ok: false, raison: 'Case occupée par un bataillon.' };
    }
    return { ok: true };
  }

  /**
   * Pose la tuile d'événement `idEvenement` par-dessus la case `cle` (la tuile d'origine reste dessous).
   * Renvoie {ok, plateau, raison, alertes} : `alertes` (liste de textes) signale une coupure du plateau
   * ou une ville isolée créée par la pose ; la pose n'est pas refusée pour autant.
   * options.occupees : clés des cases occupées par un bataillon.
   */
  function poserEvenement(plateau, idEvenement, cle, options) {
    var avis = peutPoserEvenement(plateau, idEvenement, cle, options);
    if (!avis.ok) return { ok: false, plateau: plateau, raison: avis.raison, alertes: [] };
    var recouvrements = copier(plateau).recouvrements;
    recouvrements.push({ evenement: idEvenement, cle: cle });
    var nouveau = copier(plateau, { recouvrements: recouvrements });
    var avant = coupures(plateau), apres = coupures(nouveau), alertes = [];
    if (apres.groupes > avant.groupes) {
      alertes.push('Cette pose coupe le plateau : ' + apres.isolees.length + ' case(s) ne sont plus reliées au reste.');
    }
    var nouvelles = apres.villesIsolees.filter(function (k) { return avant.villesIsolees.indexOf(k) === -1; });
    if (nouvelles.length) alertes.push('Cette pose isole une ville : ' + nouvelles.map(function (k) { return '(' + k + ')'; }).join(' ') + '.');
    return { ok: true, plateau: nouveau, raison: null, alertes: alertes };
  }

  /**
   * Retire une tuile d'événement, désignée par la clé de sa case ou par l'identifiant de l'événement.
   * Renvoie {ok, plateau, raison, evenement, cle}.
   */
  function retirerEvenement(plateau, cleOuId) {
    var recs = copier(plateau).recouvrements;
    var trouve = recs.filter(function (x) { return x.cle === cleOuId || x.evenement === cleOuId; })[0];
    if (!trouve) return { ok: false, plateau: plateau, raison: 'Aucune tuile d’événement à cet endroit.' };
    return {
      ok: true,
      plateau: copier(plateau, { recouvrements: recs.filter(function (x) { return x !== trouve; }) }),
      raison: null, evenement: trouve.evenement, cle: trouve.cle
    };
  }

  // ------------------------------------------------------------------ fichier

  function estObjetSimple(o) {
    return o !== null && typeof o === 'object' && !Array.isArray(o)
      && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null);
  }

  /** Vérifie que l'objet n'a que les champs attendus, tous présents. Ajoute les anomalies à `erreurs`. */
  function champsExacts(o, attendus, ou, erreurs) {
    var ok = true;
    Object.keys(o).forEach(function (k) {
      if (attendus.indexOf(k) === -1) { erreurs.push(ou + ' : champ inconnu « ' + String(k).slice(0, 20) + ' ».'); ok = false; }
    });
    attendus.forEach(function (k) {
      if (!possede.call(o, k)) { erreurs.push(ou + ' : champ « ' + k + ' » manquant.'); ok = false; }
    });
    return ok;
  }

  // ------------------------------------------------------------------ pièces personnelles (§8.1)

  var FORME_NOM_INTERDIT = /[\u0000-\u001f\u007f]/;

  function formeIdPerso() { return new RegExp('^X[1-9][0-9]{0,' + (C.REGLAGES.perso.chiffresId - 1) + '}$'); }

  /**
   * Examine une pièce personnelle venue d'une source non fiable. Ajoute les anomalies à `erreurs` et renvoie une
   * copie propre {id, nom, cases, quantite}, ou null. Règles : voir validerModele.
   */
  function examinerModele(m, ou, erreurs) {
    var R = C.REGLAGES.perso, bon = true;
    var faute = function (texte) { erreurs.push(ou + ' : ' + texte); bon = false; };
    if (!estObjetSimple(m)) { erreurs.push(ou + ' : ce n’est pas un objet.'); return null; }
    if (!champsExacts(m, ['id', 'nom', 'cases', 'quantite'], ou, erreurs)) return null;
    if (typeof m.id !== 'string' || !formeIdPerso().test(m.id)) {
      faute('identifiant invalide (« X » suivi de 1 à ' + R.chiffresId + ' chiffres, par exemple X1).');
    } else if (C.modele(m.id)) {
      faute('l’identifiant ' + m.id + ' est déjà celui d’une pièce du catalogue.');
    }
    if (typeof m.nom !== 'string' || m.nom.trim().length < 1 || m.nom.length > R.longueurNom || FORME_NOM_INTERDIT.test(m.nom)) {
      faute('nom invalide (1 à ' + R.longueurNom + ' caractères).');
    }
    if (!Number.isInteger(m.quantite) || m.quantite < 1 || m.quantite > R.quantiteMax) {
      faute('quantité invalide (1 à ' + R.quantiteMax + ').');
    }
    var cases = [];
    if (!Array.isArray(m.cases) || m.cases.length < R.casesMin || m.cases.length > R.casesMax) {
      faute('une pièce personnelle compte ' + R.casesMin + ' à ' + R.casesMax + ' cases.');
    } else {
      var vues = Object.create(null), casesBonnes = true;
      m.cases.forEach(function (c, i) {
        var ouCase = ou + ', case n° ' + (i + 1);
        if (!estObjetSimple(c)) { erreurs.push(ouCase + ' : ce n’est pas un objet.'); casesBonnes = false; return; }
        if (!champsExacts(c, ['q', 'r', 'terrain'], ouCase, erreurs)) { casesBonnes = false; return; }
        if (!Number.isInteger(c.q) || !Number.isInteger(c.r) || Math.abs(c.q) >= R.casesMax || Math.abs(c.r) >= R.casesMax) {
          erreurs.push(ouCase + ' : position invalide.'); casesBonnes = false; return;
        }
        if (typeof c.terrain !== 'string' || R.terrains.indexOf(c.terrain) === -1) {
          erreurs.push(ouCase + (c.terrain === 'ville'
            ? ' : jamais de ville dans un monobloc (règle A2).'
            : ' : terrain invalide (plaine, forêt, marais ou montagne).'));
          casesBonnes = false; return;
        }
        var k = H.cle(c.q, c.r);
        if (vues[k] === true) { erreurs.push(ouCase + ' : case en double.'); casesBonnes = false; return; }
        vues[k] = true;
        cases.push({ q: c.q, r: c.r, terrain: c.terrain });
      });
      if (!casesBonnes) bon = false;
      else {
        if (vues['0,0'] !== true) faute('la case (0,0) doit faire partie de la pièce.');
        if (composantes(Object.keys(vues)).length !== 1) faute('les cases doivent être d’un seul tenant.');
      }
    }
    return bon ? { id: m.id, nom: m.nom, cases: cases, quantite: m.quantite } : null;
  }

  /** Examine la liste des pièces personnelles d'un document (nombre, doublons d'identifiant). Renvoie les copies propres. */
  function examinerModeles(liste, erreurs) {
    var R = C.REGLAGES.perso, res = [], ids = Object.create(null);
    if (!Array.isArray(liste) || liste.length > R.modelesMax) {
      erreurs.push('Liste des pièces personnelles invalide (' + R.modelesMax + ' au plus).');
      return [];
    }
    liste.forEach(function (m, i) {
      var propre = examinerModele(m, 'Pièce personnelle n° ' + (i + 1), erreurs);
      if (!propre) return;
      if (ids[propre.id] === true) { erreurs.push('Pièce personnelle n° ' + (i + 1) + ' : identifiant ' + propre.id + ' en double.'); return; }
      ids[propre.id] = true;
      res.push(propre);
    });
    return res;
  }

  /**
   * Valide strictement UNE pièce personnelle {id, nom, cases: [{q, r, terrain}], quantite} :
   * 2 à 6 cases d'un seul tenant, case (0,0) présente, terrains plaine / forêt / marais / montagne (jamais de ville),
   * quantité 1 à 9, identifiant « X » + chiffres qui n'est pas celui d'une pièce de base, nom borné
   * (bornes dans REGLAGES.perso). Renvoie {ok, modele (copie propre ou null), erreurs}.
   */
  function validerModele(objet) {
    var erreurs = [], propre = examinerModele(objet, 'Pièce personnelle', erreurs);
    return erreurs.length || !propre ? { ok: false, modele: null, erreurs: erreurs.slice(0, 20) } : { ok: true, modele: propre, erreurs: [] };
  }

  /** Valide strictement une LISTE de pièces personnelles (nombre borné, pas de doublon). Renvoie {ok, modeles, erreurs}. */
  function validerModeles(liste) {
    var erreurs = [], propres = examinerModeles(liste, erreurs);
    return erreurs.length ? { ok: false, modeles: null, erreurs: erreurs.slice(0, 20) } : { ok: true, modeles: propres, erreurs: [] };
  }

  /**
   * Prochain identifiant libre pour une pièce personnelle du document : « X » + le plus petit numéro qui n'est pris
   * ni par une pièce personnelle, ni par une pièce de base, ni par `reserves` (liste facultative d'identifiants).
   * Renvoie null si tous les numéros permis sont pris.
   */
  function prochainIdModele(plateau, reserves) {
    var pris = Object.create(null), max = Math.pow(10, C.REGLAGES.perso.chiffresId) - 1;
    listeModeles(plateau).forEach(function (m) { pris[m.id] = true; });
    (reserves || []).forEach(function (id) { pris[String(id)] = true; });
    for (var n = 1; n <= max; n++) {
      if (pris['X' + n] !== true && !C.modele('X' + n)) return 'X' + n;
    }
    return null;
  }

  /** Exemplaires posés d'un modèle : [identifiants de pièces]. */
  function exemplairesPoses(plateau, idModele) {
    return (plateau.pieces || []).filter(function (p) { return p.modele === idModele; }).map(function (p) { return p.id; });
  }

  function refusPose(plateau, verbe, m, poses) {
    var r = refus(plateau, verbe + ' refusée : ' + poses.length + (poses.length > 1 ? ' exemplaires' : ' exemplaire') + ' de « ' + m.nom + ' » '
      + (poses.length > 1 ? 'sont posés' : 'est posé') + ' sur le plateau. Retirez-' + (poses.length > 1 ? 'les' : 'le') + ' d’abord.');
    r.pieces = poses;
    return r;
  }

  function refusValidation(plateau, erreurs) {
    var r = refus(plateau, erreurs[0] || 'Pièce personnelle invalide.');
    r.erreurs = erreurs.slice(0, 20);
    return r;
  }

  /**
   * Ajoute une pièce personnelle au document. `definition` : {nom, cases: [{q, r, terrain}], quantite} ; l'identifiant
   * est attribué ici (prochain libre). Renvoie {ok, plateau, id, modele} ou {ok: false, plateau, raison, erreurs}.
   */
  function ajouterModele(plateau, definition) {
    var R = C.REGLAGES.perso, d = definition || {};
    if (listeModeles(plateau).length >= R.modelesMax) return refus(plateau, 'Trop de pièces personnelles : ' + R.modelesMax + ' au plus dans un plateau.');
    var id = prochainIdModele(plateau);
    if (!id) return refus(plateau, 'Plus d’identifiant libre pour une pièce personnelle.');
    var avis = validerModele({ id: id, nom: d.nom, cases: d.cases, quantite: d.quantite });
    if (!avis.ok) return refusValidation(plateau, avis.erreurs);
    return { ok: true, plateau: copier(plateau, { modeles: modeles(plateau).concat([avis.modele]) }), id: id, modele: copieModele(avis.modele) };
  }

  /**
   * Modifie une pièce personnelle : `changements` peut porter nom, cases, quantite (le reste est gardé).
   * Tant que des exemplaires sont posés, seuls le NOM et la QUANTITÉ se changent, et une quantité CHANGÉE ne descend
   * pas sous le nombre d'exemplaires posés ; changer la forme ou un terrain est refusé avec explication
   * (champ `pieces` : identifiants des exemplaires posés).
   * Renvoie {ok, plateau, id, modele} ou {ok: false, plateau, raison, pieces | erreurs}.
   */
  function modifierModele(plateau, id, changements) {
    var actuel = listeModeles(plateau).filter(function (m) { return m.id === id; })[0], c = changements || {};
    if (!actuel) return refus(plateau, 'Pièce personnelle introuvable dans ce plateau.');
    var poses = exemplairesPoses(plateau, id);
    if (poses.length) {
      var memesCases = c.cases === undefined || (Array.isArray(c.cases) && c.cases.length === actuel.cases.length && c.cases.every(function (x, i) {
        var a = actuel.cases[i];
        return x !== null && typeof x === 'object' && x.q === a.q && x.r === a.r && x.terrain === a.terrain;
      }));
      if (!memesCases) return refusPose(plateau, 'Modification de la forme', actuel, poses);
      // Une quantité INCHANGÉE est toujours acceptée, même si un fichier porte plus d'exemplaires posés que prévu :
      // on peut alors encore renommer la pièce (le contrôle 1 signale le dépassement).
      if (c.quantite !== undefined && Number.isInteger(c.quantite) && c.quantite < poses.length && c.quantite !== actuel.quantite) {
        var r = refus(plateau, 'Quantité refusée : ' + poses.length + (poses.length > 1 ? ' exemplaires' : ' exemplaire') + ' de « ' + actuel.nom + ' » '
          + (poses.length > 1 ? 'sont posés' : 'est posé') + ' sur le plateau ; la quantité ne peut pas descendre en dessous.');
        r.pieces = poses;
        return r;
      }
    }
    var avis = validerModele({
      id: id,
      nom: c.nom === undefined ? actuel.nom : c.nom,
      cases: c.cases === undefined ? actuel.cases : c.cases,
      quantite: c.quantite === undefined ? actuel.quantite : c.quantite
    });
    if (!avis.ok) return refusValidation(plateau, avis.erreurs);
    var liste = modeles(plateau).map(function (m) { return m.id === id ? avis.modele : m; });
    return { ok: true, plateau: copier(plateau, { modeles: liste }), id: id, modele: copieModele(avis.modele) };
  }

  /**
   * Supprime une pièce personnelle du document. Refusé avec explication si des exemplaires sont posés.
   * Renvoie {ok, plateau, id} ou {ok: false, plateau, raison, pieces}.
   */
  function supprimerModele(plateau, id) {
    var actuel = listeModeles(plateau).filter(function (m) { return m.id === id; })[0];
    if (!actuel) return refus(plateau, 'Pièce personnelle introuvable dans ce plateau.');
    var poses = exemplairesPoses(plateau, id);
    if (poses.length) return refusPose(plateau, 'Suppression', actuel, poses);
    return { ok: true, plateau: copier(plateau, { modeles: modeles(plateau).filter(function (m) { return m.id !== id; }) }), id: id };
  }

  /**
   * Copie des pièces personnelles du plateau `source` vers le plateau `cible` (`ids` : lesquelles ; toutes par défaut).
   * Une pièce garde son identifiant s'il est libre dans la cible, sinon elle reçoit le prochain identifiant libre :
   * jamais de collision. Tout ou rien. Renvoie {ok, plateau (la cible enrichie), copies: nombre,
   * correspondance: {idSource: idCible}} ou {ok: false, plateau (la cible inchangée), raison}.
   */
  function copierModeles(source, cible, ids) {
    var R = C.REGLAGES.perso, erreurs = [];
    var toutes = examinerModeles(source && source.modeles !== undefined ? source.modeles : [], erreurs);
    if (erreurs.length) return refusValidation(cible, erreurs);
    var choisies = toutes;
    if (ids !== undefined) {
      if (!Array.isArray(ids)) return refus(cible, 'Liste de pièces à copier invalide.');
      var inconnues = ids.filter(function (id) { return !toutes.some(function (m) { return m.id === id; }); });
      if (inconnues.length) return refus(cible, 'Pièce personnelle introuvable dans le plateau d’origine : ' + inconnues.map(String).join(', ').slice(0, 60) + '.');
      choisies = toutes.filter(function (m) { return ids.indexOf(m.id) !== -1; });
    }
    if (!choisies.length) return refus(cible, 'Aucune pièce personnelle à copier.');
    var liste = modeles(cible);
    if (liste.length + choisies.length > R.modelesMax) {
      return refus(cible, 'Copie refusée : le plateau aurait ' + (liste.length + choisies.length) + ' pièces personnelles, pour ' + R.modelesMax + ' au plus.');
    }
    // Un identifiant de la source encore libre dans la cible est gardé : il n'est pas donné à une pièce renumérotée.
    var dejaLa = liste.map(function (m) { return m.id; }), pris = dejaLa.concat(choisies.map(function (m) { return m.id; })), correspondance = {};
    for (var i = 0; i < choisies.length; i++) {
      var m = choisies[i], id = dejaLa.indexOf(m.id) === -1 ? m.id : prochainIdModele(cible, pris);
      if (!id) return refus(cible, 'Plus d’identifiant libre pour une pièce personnelle.');
      pris.push(id);
      correspondance[m.id] = id;
      liste.push({ id: id, nom: m.nom, cases: m.cases, quantite: m.quantite });
    }
    return { ok: true, plateau: copier(cible, { modeles: liste }), copies: choisies.length, correspondance: correspondance };
  }

  function cleValide(k) {
    if (!H.estCle(k)) return false;
    var p = H.decle(k);
    return entierBorne(p.q) && entierBorne(p.r);
  }

  /**
   * Valide strictement un objet lu dans un fichier (types, bornes, identifiants connus, doublons).
   * Versions lues : 1 (premier catalogue) et 2 ; le plateau rendu est toujours en version 2.
   * Ne vérifie pas les règles du jeu (chevauchements, stock, place des villes… : voir AT.controles).
   * Renvoie {ok, plateau, erreurs} : `plateau` est un objet reconstruit champ par champ (null si invalide).
   */
  function valider(objet) {
    var B = C.REGLAGES.bornes, erreurs = [];
    var echec = function () { return { ok: false, plateau: null, erreurs: erreurs.slice(0, 20) }; };
    if (!estObjetSimple(objet)) { erreurs.push('Le fichier ne contient pas un plateau.'); return echec(); }
    var attendus = ['version', 'graine', 'pieces', 'recouvrements', 'camps'];
    if (possede.call(objet, 'modeles')) attendus.push('modeles');          // champ facultatif (pièces personnelles)
    if (possede.call(objet, 'deploiements')) attendus.push('deploiements'); // champ facultatif (villes de déploiement)
    // Règles précédentes : champ facultatif `profondeurExtremite` (1 à 3). Il est validé, puis ABANDONNÉ (sans effet).
    if (possede.call(objet, 'profondeurExtremite')) attendus.push('profondeurExtremite');
    if (!champsExacts(objet, attendus, 'Plateau', erreurs)) return echec();
    if (possede.call(objet, 'profondeurExtremite') && !(Number.isInteger(objet.profondeurExtremite) && objet.profondeurExtremite >= 1 && objet.profondeurExtremite <= 3)) {
      erreurs.push('Profondeur des extrémités invalide (un entier de 1 à 3 ; champ des règles précédentes).');
    }
    if (VERSIONS_LUES.indexOf(objet.version) === -1) erreurs.push('Version de plateau non reconnue.');
    var graineOk = (typeof objet.graine === 'number' && Number.isSafeInteger(objet.graine))
      || (typeof objet.graine === 'string' && objet.graine.length <= B.longueurGraine);
    if (!graineOk) erreurs.push('Graine invalide (entier ou texte de ' + B.longueurGraine + ' caractères au plus).');

    // Pièces personnelles du document (validées avant les pièces posées, qui peuvent s'y référer).
    var persos = [], idsPersos = Object.create(null);
    if (possede.call(objet, 'modeles')) {
      persos = examinerModeles(objet.modeles, erreurs);
      persos.forEach(function (m) { idsPersos[m.id] = true; });
    }

    // Pièces.
    var pieces = [], ids = Object.create(null);
    if (!Array.isArray(objet.pieces) || objet.pieces.length > B.pieces) {
      erreurs.push('Liste des pièces invalide (' + B.pieces + ' pièces au plus).');
    } else {
      objet.pieces.forEach(function (p, i) {
        var ou = 'Pièce n° ' + (i + 1);
        if (!estObjetSimple(p)) { erreurs.push(ou + ' : ce n’est pas un objet.'); return; }
        if (!champsExacts(p, ['id', 'modele', 'q', 'r', 'rotation'], ou, erreurs)) return;
        var bon = true;
        if (typeof p.id !== 'string' || p.id.length > B.longueurId || !FORME_ID.test(p.id)) { erreurs.push(ou + ' : identifiant invalide.'); bon = false; }
        else if (ids[p.id] === true) { erreurs.push(ou + ' : identifiant en double.'); bon = false; }
        if (!C.modele(p.modele) && !(typeof p.modele === 'string' && idsPersos[p.modele] === true)) { erreurs.push(ou + ' : modèle inconnu du catalogue.'); bon = false; }
        if (!entierBorne(p.q) || !entierBorne(p.r)) { erreurs.push(ou + ' : position invalide (entiers entre -' + B.coordonnee + ' et ' + B.coordonnee + ').'); bon = false; }
        if (!Number.isInteger(p.rotation) || p.rotation < 0 || p.rotation > 5) { erreurs.push(ou + ' : rotation invalide (0 à 5).'); bon = false; }
        if (bon) {
          // Toutes les cases de la pièce restent dans les bornes, pas seulement son ancre : sinon un événement ou un
          // camp posé sur une case lointaine donnerait un fichier refusé à la relecture (clés bornées elles aussi).
          var m = C.modele(p.modele) || persos.filter(function (x) { return x.id === p.modele; })[0];
          var dehors = m.cases.some(function (c) {
            var t = H.tourner(c.q, c.r, p.rotation);
            return !entierBorne(p.q + t.q) || !entierBorne(p.r + t.r);
          });
          if (dehors) { erreurs.push(ou + ' : une de ses cases sort des limites du plateau (entre -' + B.coordonnee + ' et ' + B.coordonnee + ').'); bon = false; }
        }
        if (!bon) return;
        ids[p.id] = true;
        pieces.push({ id: p.id, modele: p.modele, q: p.q, r: p.r, rotation: p.rotation });
      });
    }

    // Recouvrements.
    var recouvrements = [], evVus = Object.create(null), clesVues = Object.create(null);
    if (!Array.isArray(objet.recouvrements) || objet.recouvrements.length > B.recouvrements) {
      erreurs.push('Liste des événements posés invalide (' + B.recouvrements + ' au plus).');
    } else {
      objet.recouvrements.forEach(function (x, i) {
        var ou = 'Événement posé n° ' + (i + 1);
        if (!estObjetSimple(x)) { erreurs.push(ou + ' : ce n’est pas un objet.'); return; }
        if (!champsExacts(x, ['evenement', 'cle'], ou, erreurs)) return;
        var bon = true;
        if (!C.evenement(x.evenement)) { erreurs.push(ou + ' : événement inconnu de la réserve.'); bon = false; }
        else if (evVus[x.evenement] === true) { erreurs.push(ou + ' : événement posé deux fois (tuile unique).'); bon = false; }
        if (!cleValide(x.cle)) { erreurs.push(ou + ' : case invalide.'); bon = false; }
        else if (clesVues[x.cle] === true) { erreurs.push(ou + ' : deux événements sur la même case.'); bon = false; }
        if (!bon) return;
        evVus[x.evenement] = true;
        clesVues[x.cle] = true;
        recouvrements.push({ evenement: x.evenement, cle: x.cle });
      });
    }

    // Villes posées par-dessus une Plaine (§10) : neutres et villes de déploiement, quota par propriétaire.
    var poseesLa = [], clesVilles = Object.create(null), parCamp = { neutre: 0, vert: 0, rouge: 0 };
    if (possede.call(objet, 'deploiements')) {
      if (!Array.isArray(objet.deploiements) || objet.deploiements.length > B.deploiements) {
        erreurs.push('Liste des villes posées invalide (' + B.deploiements + ' au plus).');
      } else {
        objet.deploiements.forEach(function (x, i) {
          var ou = 'Ville posée n° ' + (i + 1);
          if (!estObjetSimple(x)) { erreurs.push(ou + ' : ce n’est pas un objet.'); return; }
          if (!champsExacts(x, ['cle', 'camp'], ou, erreurs)) return;
          if (typeof x.camp !== 'string' || PROPRIETAIRES.indexOf(x.camp) === -1) { erreurs.push(ou + ' : propriétaire invalide (neutre, vert ou rouge).'); return; }
          if (!cleValide(x.cle)) { erreurs.push(ou + ' : case invalide.'); return; }
          if (clesVilles[x.cle] === true) { erreurs.push(ou + ' : deux villes sur la même case.'); return; }
          if (clesVues[x.cle] === true) { erreurs.push(ou + ' : cette case porte déjà une tuile d’événement.'); return; }
          clesVilles[x.cle] = true;
          parCamp[x.camp] += 1;
          if (parCamp[x.camp] > quotaVilles(x.camp)) {
            erreurs.push(ou + (x.camp === 'neutre' ? ' : plus de ' + quotaVilles('neutre') + ' villes neutres.' : ' : plus de ' + quotaVilles(x.camp) + ' villes de déploiement pour ' + NOMS_CAMPS[x.camp] + '.'));
            return;
          }
          poseesLa.push({ cle: x.cle, camp: x.camp });
        });
      }
    }

    // Camps.
    var camps = { vert: [], rouge: [] };
    if (!estObjetSimple(objet.camps) || !champsExacts(objet.camps, ['vert', 'rouge'], 'Camps', erreurs)) {
      if (!estObjetSimple(objet.camps)) erreurs.push('Camps invalides.');
    } else {
      var dejaCamp = Object.create(null);
      ['vert', 'rouge'].forEach(function (nom) {
        var liste = objet.camps[nom];
        if (!Array.isArray(liste) || liste.length > C.REGLAGES.villesParCamp) {
          erreurs.push('Camp ' + nom + ' : liste invalide (' + C.REGLAGES.villesParCamp + ' cases au plus).');
          return;
        }
        liste.forEach(function (k) {
          if (!cleValide(k)) { erreurs.push('Camp ' + nom + ' : case invalide.'); return; }
          if (dejaCamp[k] === true) { erreurs.push('Camp ' + nom + ' : case citée deux fois.'); return; }
          dejaCamp[k] = true;
          camps[nom].push(k);
        });
      });
    }

    if (erreurs.length) return echec();
    var propre = { version: VERSION, graine: objet.graine, pieces: pieces, recouvrements: recouvrements, camps: camps };
    if (poseesLa.length) propre.deploiements = poseesLa;
    if (persos.length) propre.modeles = persos;
    // Une ville est une tuile posée PAR-DESSUS une Plaine du plateau (§10) : une entrée qui vise une case absente, ou
    // une case dont la tuile du dessous n'est pas une Plaine, est refusée. L'outil n'en produit jamais (la pose
    // exige une Plaine du plateau ; toute retouche du terrain retire la ville avec sa Plaine) : un plateau enregistré par l'outil se relit donc toujours. En cas de chevauchement, la case
    // est celle de la première pièce de la liste, comme dans cases().
    if (poseesLa.length) {
      var dessous = cases(propre, { sansRecouvrements: true, sansVilles: true });
      poseesLa.forEach(function (x, i) {
        var ou = 'Ville posée n° ' + (i + 1);
        if (!possede.call(dessous, x.cle)) erreurs.push(ou + ' : aucune case du plateau en (' + x.cle + ').');
        else if (dessous[x.cle].origine !== 'plaine') erreurs.push(ou + ' : la case (' + x.cle + ') n’est pas une Plaine (' + dessous[x.cle].origine + ').');
      });
      if (erreurs.length) return echec();
    }
    return { ok: true, plateau: propre, erreurs: [] };
  }

  /** Texte JSON du plateau (seuls les champs du format sont écrits). */
  function serialiser(plateau) { return JSON.stringify(copier(plateau), null, 1); }

  /** Lit le texte d'un fichier : taille bornée, JSON, puis valider(). Renvoie {ok, plateau, erreurs}. */
  function lire(texte) {
    if (typeof texte !== 'string') return { ok: false, plateau: null, erreurs: ['Fichier illisible.'] };
    if (texte.length > C.REGLAGES.bornes.tailleFichier) return { ok: false, plateau: null, erreurs: ['Fichier trop volumineux pour un plateau.'] };
    var objet;
    try { objet = JSON.parse(texte); } catch (e) { return { ok: false, plateau: null, erreurs: ['Ce fichier n’est pas du JSON valide.'] }; }
    return valider(objet);
  }

  AT.plateau = {
    VERSION: VERSION, VERSIONS_LUES: VERSIONS_LUES.slice(),
    deploiements: deploiements, etatVilles: etatVilles, catalogueDuPlateau: catalogueDuPlateau, RAISON_NOYAU_FIXE: RAISON_NOYAU_FIXE,
    PROPRIETAIRES: PROPRIETAIRES.slice(), quotaVilles: quotaVilles, villesReglesPrecedentes: villesReglesPrecedentes,
    placesVille: placesVille, peutPoserVille: peutPoserVille, poserVille: poserVille, retirerVille: retirerVille,
    casesPourVilles: casesPourVilles, villesSurCases: villesSurCases, refusVilleSurCases: refusVilleSurCases, placesVilleSurCases: placesVilleSurCases,
    vide: vide, vierge: vierge, casesModele: casesModele, casesPiece: casesPiece, cases: cases, chevauchements: chevauchements,
    cout: cout, villes: villes, stock: stock,
    modele: modele, modeles: modeles, idsModeles: idsModeles,
    validerModele: validerModele, validerModeles: validerModeles, prochainIdModele: prochainIdModele,
    ajouterModele: ajouterModele, modifierModele: modifierModele, supprimerModele: supprimerModele, copierModeles: copierModeles,
    poser: poser, retirer: retirer, tourner: tourner, peindre: peindre, gommer: gommer, RAISON_VILLE_NEUTRE: RAISON_VILLE_NEUTRE,
    villesRangeesExtremes: villesRangeesExtremes, campsAuto: campsAuto, avecCamps: avecCamps,
    pasSurCases: pasSurCases, rationsSurCases: rationsSurCases, distancesPas: distancesPas, distancesRations: distancesRations,
    chemin: chemin, composantes: composantes, coupures: coupures, trous: trous,
    refusTerrainEvenement: refusTerrainEvenement, peutPoserEvenement: peutPoserEvenement,
    poserEvenement: poserEvenement, retirerEvenement: retirerEvenement,
    valider: valider, serialiser: serialiser, lire: lire
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.plateau;
})();
