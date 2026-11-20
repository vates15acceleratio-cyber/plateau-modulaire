/*
 * partie.js : état d'une partie fictive en « table libre » (lot B). Une AIDE, pas un arbitre.
 * Aucun accès au DOM. Dépend de AT.cartes et AT.paquets (lot B) ; l'aléa, la géométrie et les fonctions
 * du plateau (lot A) sont REÇUS dans `env`, jamais créés ici :
 *
 *   env = { alea: AT.alea.creer(graine), hex: AT.hex, plateau: AT.plateau }
 *
 * Toutes les opérations ont la même forme : operation(etat, params, env) et renvoient
 *   { ok, etat, raison, avertissements, ...resultats }
 * L'état reçu n'est jamais modifié. En cas de refus (ok: false), `etat` est l'état reçu, inchangé.
 *
 * Avertissements : [{ code, message, bloquant }]. Un avertissement bloquant (case non voisine,
 * infranchissable, occupée, hors déploiement...) refuse l'opération SAUF si `params.forcer` est vrai :
 * en table libre, on peut toujours forcer. Les avertissements non bloquants (hors de son tour,
 * plus d'actions que prévu) n'empêchent rien.
 *
 * Aléa rejouable : l'état garde `graine` et `alea` (valeur de env.alea.etat(), opaque). Chaque opération
 * aléatoire commence par env.alea.restaurer(etat.alea) : annuler puis rétablir, ou rouvrir un fichier,
 * redonne exactement les mêmes tirages.
 *
 * Ce que la table ne fait PAS (les règles restent appliquées à la main) : attribuer la Gloire, résoudre
 * un combat, appliquer les effets des cartes, vérifier « une fois par tour », capturer une ville toute seule.
 *
 * Forme de l'état (JSON simple, toujours sérialisable) :
 * {
 *   format: 'atelier-partie', version: 1,
 *   graine, alea,                       // graine de la partie ; état courant de l'aléa (opaque)
 *   reglages: { ... },                  // copie des REGLAGES de la partie
 *   tour: 1, actif: 'vert', actions: 0, // numéro de tour (un tour = le tour d'un joueur), joueur actif, actions faites
 *   gloire: { vert: 0, rouge: 0 },
 *   troupes: { T1: { nom, moral, puissance, des, provisoire } },   // définitions modifiables
 *   exemplaires: { 'vert-1': { modele: 'T1', joueur: 'vert' } },   // une entrée par carte physique
 *   paquets: { vert: {pioche, main, defausse}, rouge: {...}, campement: {...}, evenements: {...} },
 *       // paquets.evenements.main = cartes Événement piochées dont la tuile n'est pas encore posée
 *   bataillons: { vert: [{ numero, case: null | 'q,r', troupes: [{ carte, degats }], campement: false }], rouge: [...] },
 *   villes: { 'q,r': 'vert' | 'rouge' },   // villes capturées seulement
 *   plateau: { ... },                   // plateau du lot A (recouvrements compris)
 *   journal: [{ n, tour, joueur, type, texte }]
 * }
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  // Sous Node, charge les deux autres modules du lot B s'ils ne le sont pas déjà.
  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.cartes) require('./cartes.js');
    if (!AT.paquets) require('./paquets.js');
  }

  var FORMAT = 'atelier-partie';
  var VERSION = 1;
  var JOUEURS = ['vert', 'rouge'];
  var NOMS = { vert: 'Vert', rouge: 'Rouge' };

  /** Limites techniques (taille des fichiers relus, longueur des textes), sans rapport avec les règles. */
  var LIMITES = {
    fichier: 5000000,   // caractères d'un fichier de partie
    journal: 5000,      // entrées gardées dans le journal (les plus anciennes sont retirées)
    texte: 500,         // longueur d'une entrée de journal
    note: 300,          // longueur d'une note ou d'un motif saisi
    nom: 40,            // longueur d'un nom de Troupe
    pieces: 500,        // pièces d'un plateau
    modeles: 200,       // définitions de Troupes
    actions: 99,        // compteur d'actions
    tour: 100000,
    grainePlateau: 64,  // longueur d'une graine de plateau en texte : la même que AT.catalogue.REGLAGES.bornes.longueurGraine
    // Pièces personnelles portées par le plateau : valeurs de REPLI seulement. Les bornes en vigueur sont lues dans
    // AT.catalogue.REGLAGES.perso au moment de valider (voir bornesPerso), pour suivre un réglage changé là-bas.
    persoModeles: 24, persoCases: 6, persoCasesMin: 2, persoQuantite: 9, persoNom: 40, persoChiffres: 4
  };
  var TERRAINS_PERSO = ['plaine', 'foret', 'marais', 'montagne'];   // repli ; jamais de ville dans un monobloc (règle A2)

  /**
   * Bornes des pièces personnelles, lues dans AT.catalogue.REGLAGES.perso AU MOMENT de valider (repli : LIMITES).
   * La ville n'est jamais un terrain permis, quel que soit le réglage (règle A2).
   */
  function bornesPerso() {
    var r = (AT.catalogue && AT.catalogue.REGLAGES && AT.catalogue.REGLAGES.perso) || {};
    var entier = function (v, repli) { return (typeof v === 'number' && isFinite(v) && Math.floor(v) === v && v >= 1) ? v : repli; };
    var chiffres = entier(r.chiffresId, LIMITES.persoChiffres);
    var terrains = (Array.isArray(r.terrains) ? r.terrains : TERRAINS_PERSO).filter(function (t) { return typeof t === 'string' && t !== 'ville'; });
    return {
      modeles: entier(r.modelesMax, LIMITES.persoModeles), casesMin: entier(r.casesMin, LIMITES.persoCasesMin), casesMax: entier(r.casesMax, LIMITES.persoCases),
      quantite: entier(r.quantiteMax, LIMITES.persoQuantite), nom: entier(r.longueurNom, LIMITES.persoNom),
      motif: new RegExp('^X[1-9][0-9]{0,' + (chiffres - 1) + '}$'), terrains: terrains
    };
  }

  /** Bornes acceptées pour chaque réglage (création et relecture d'un fichier). */
  var BORNES_REGLAGES = {
    tailleMain: [1, 20], gloireVictoire: [1, 99], bataillonsParJoueur: [1, 8], troupesParBataillon: [1, 6],
    actionsParTour: [1, 10], mainDeDepart: [0, 20], piocheDebutTour: [0, 5], tailleDeck: [1, 100],
    desMax: [1, 100], tailleHistorique: [1, 1000]
  };
  var BORNES_TROUPE = { moral: [1, 20], puissance: [0, 20], des: [0, 10] };

  var MOTIF_CLE = /^-?\d{1,3},-?\d{1,3}$/;
  var MOTIF_IDENT = /^[A-Za-z0-9_.:-]{1,40}$/;
  var MOTIF_TROUPE = /^T\d{1,3}$/;
  var MOTIF_EXEMPLAIRE = /^(vert|rouge)-\d{1,3}$/;
  var MOTIF_TYPE = /^[a-z-]{1,30}$/;
  var MOTIF_CHAMP = /^[A-Za-z0-9_]{1,32}$/;
  var CLES_INTERDITES = ['__proto__', 'constructor', 'prototype'];

  function cartes() { return AT.cartes; }
  function paquets() { return AT.paquets; }
  function cloner(o) { return JSON.parse(JSON.stringify(o)); }
  function autre(joueur) { return joueur === 'vert' ? 'rouge' : 'vert'; }
  function estJoueur(j) { return j === 'vert' || j === 'rouge'; }
  function estEntier(n, min, max) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= min && n <= max;
  }
  function possede(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function estObjet(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }

  /** Nettoie un texte saisi (note, motif) : sans caractère de contrôle, longueur bornée. */
  function texteSaisi(t, max) {
    return String(t === undefined || t === null ? '' : t).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max).trim();
  }

  // ---------------------------------------------------------------------------------------------
  // Résultats, avertissements, journal
  // ---------------------------------------------------------------------------------------------

  function reussite(etat, extras, avertissements) {
    var r = { ok: true, etat: etat, raison: null, avertissements: avertissements || [] };
    if (extras) Object.keys(extras).forEach(function (k) { r[k] = extras[k]; });
    return r;
  }

  function refus(etat, raison, avertissements, extras) {
    var r = { ok: false, etat: etat, raison: raison, avertissements: avertissements || [] };
    if (extras) Object.keys(extras).forEach(function (k) { r[k] = extras[k]; });
    return r;
  }

  function avert(code, message, bloquant) {
    return { code: code, message: message, bloquant: bloquant !== false };
  }

  function aBloquant(avertissements) {
    return avertissements.some(function (a) { return a.bloquant; });
  }

  var RAISON_A_FORCER = 'Avertissement : l’opération n’est faite que si on la force.';

  /** Ajoute une entrée au journal de `e` (état déjà cloné). */
  function journaliser(e, joueur, type, texte) {
    var dernier = e.journal.length ? e.journal[e.journal.length - 1].n : 0;
    e.journal.push({ n: dernier + 1, tour: e.tour, joueur: joueur || null, type: type, texte: String(texte).slice(0, LIMITES.texte) });
    if (e.journal.length > LIMITES.journal) e.journal.splice(0, e.journal.length - LIMITES.journal);
  }

  // ---------------------------------------------------------------------------------------------
  // Environnement (lot A, injecté)
  // ---------------------------------------------------------------------------------------------

  function aleaPresent(env) {
    var a = env && env.alea;
    return !!a && ['entier', 'de', 'melanger', 'etat', 'restaurer'].every(function (f) { return typeof a[f] === 'function'; });
  }
  function plateauPresent(env) {
    var p = env && env.plateau;
    return !!p && ['cases', 'cout', 'villes', 'poserEvenement'].every(function (f) { return typeof p[f] === 'function'; });
  }
  function hexPresent(env) {
    return !!env && !!env.hex && typeof env.hex.voisines === 'function';
  }

  /** Remet l'aléa injecté dans l'état enregistré dans la partie. */
  function reprendreAlea(etat, env) { env.alea.restaurer(cloner(etat.alea)); }
  /** Enregistre dans `e` l'état courant de l'aléa injecté. */
  function memoriserAlea(e, env) { e.alea = cloner(env.alea.etat()); }

  // ---------------------------------------------------------------------------------------------
  // Lecture de l'état (fonctions d'aide, sans effet)
  // ---------------------------------------------------------------------------------------------

  /** Bataillon `numero` (1 à N) du joueur, ou null. */
  function bataillon(etat, joueur, numero) {
    if (!estJoueur(joueur) || !estEntier(numero, 1, etat.bataillons[joueur].length)) return null;
    return etat.bataillons[joueur][numero - 1];
  }

  /** Bataillons posés sur une case : [{ joueur, numero }] (normalement 0 ou 1 ; plusieurs si on a forcé). */
  function occupants(etat, cle) {
    var liste = [];
    JOUEURS.forEach(function (j) {
      etat.bataillons[j].forEach(function (b) { if (b.case === cle) liste.push({ joueur: j, numero: b.numero }); });
    });
    return liste;
  }

  /** Définition de la Troupe d'un exemplaire (ou null). */
  function troupeDe(etat, carte) {
    var ex = possede(etat.exemplaires, carte) ? etat.exemplaires[carte] : null;
    return ex && possede(etat.troupes, ex.modele) ? etat.troupes[ex.modele] : null;
  }

  function nomCarte(etat, carte) {
    var t = troupeDe(etat, carte);
    return t ? t.nom : String(carte);
  }

  /** Moral restant d'un bataillon (somme des morals moins les dégâts). */
  function moralRestant(etat, joueur, numero) {
    var b = bataillon(etat, joueur, numero);
    if (!b) return 0;
    return b.troupes.reduce(function (s, t) { return s + troupeDe(etat, t.carte).moral - t.degats; }, 0);
  }

  /** Joueurs ayant atteint la Gloire de victoire (tableau, vide tant que personne n'y est). */
  function gagnants(etat) {
    return JOUEURS.filter(function (j) { return etat.gloire[j] >= etat.reglages.gloireVictoire; });
  }

  // ---------------------------------------------------------------------------------------------
  // Validation (création et relecture d'un fichier) : on ne fait jamais confiance aux données reçues,
  // et on reconstruit un objet propre champ par champ.
  // ---------------------------------------------------------------------------------------------

  function ErreurValidation(message) { this.message = message; }

  function exiger(condition, message) { if (!condition) throw new ErreurValidation(message); }

  /** Vérifie qu'un objet a exactement les clés attendues (ni manquante, ni inconnue). */
  function clesExactes(o, attendues, ou) {
    exiger(estObjet(o), ou + ' : objet attendu.');
    var cles = Object.keys(o);
    cles.forEach(function (k) { exiger(attendues.indexOf(k) >= 0, ou + ' : champ inconnu « ' + String(k).slice(0, 40) + ' ».'); });
    attendues.forEach(function (k) { exiger(possede(o, k), ou + ' : champ « ' + k + ' » manquant.'); });
  }

  function validerGraine(g) {
    exiger((typeof g === 'number' && isFinite(g) && Math.floor(g) === g && Math.abs(g) <= 9007199254740991) ||
      (typeof g === 'string' && g.length >= 1 && g.length <= 100), 'Graine invalide (entier ou chaîne de 1 à 100 caractères).');
    return g;
  }

  /** Copie une valeur JSON simple et bornée (état opaque de l'aléa). */
  function jsonSimple(v, profondeur, ou) {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') { exiger(isFinite(v), ou + ' : nombre invalide.'); return v; }
    if (typeof v === 'string') { exiger(v.length <= 200, ou + ' : chaîne trop longue.'); return v; }
    exiger(typeof v === 'object' && profondeur < 4, ou + ' : valeur trop profonde ou invalide.');
    if (Array.isArray(v)) {
      exiger(v.length <= 64, ou + ' : tableau trop long.');
      return v.map(function (x) { return jsonSimple(x, profondeur + 1, ou); });
    }
    var cles = Object.keys(v), propre = {};
    exiger(cles.length <= 16, ou + ' : trop de champs.');
    cles.forEach(function (k) {
      exiger(MOTIF_CHAMP.test(k) && CLES_INTERDITES.indexOf(k) < 0, ou + ' : champ refusé.');
      propre[k] = jsonSimple(v[k], profondeur + 1, ou);
    });
    return propre;
  }

  function validerReglages(r) {
    var attendues = Object.keys(BORNES_REGLAGES).concat(['premierJoueur']);
    clesExactes(r, attendues, 'Réglages');
    var propre = {};
    Object.keys(BORNES_REGLAGES).forEach(function (k) {
      var b = BORNES_REGLAGES[k];
      exiger(estEntier(r[k], b[0], b[1]), 'Réglage « ' + k + ' » hors bornes (' + b[0] + ' à ' + b[1] + ').');
      propre[k] = r[k];
    });
    exiger(estJoueur(r.premierJoueur), 'Réglage « premierJoueur » invalide.');
    propre.premierJoueur = r.premierJoueur;
    return propre;
  }

  function validerTroupe(t, ou) {
    clesExactes(t, ['nom', 'moral', 'puissance', 'des', 'provisoire'], ou);
    exiger(typeof t.nom === 'string' && t.nom.length >= 1 && t.nom.length <= LIMITES.nom && !/[\u0000-\u001f\u007f]/.test(t.nom),
      ou + ' : nom invalide (1 à ' + LIMITES.nom + ' caractères).');
    var propre = { nom: t.nom };
    Object.keys(BORNES_TROUPE).forEach(function (k) {
      var b = BORNES_TROUPE[k];
      exiger(estEntier(t[k], b[0], b[1]), ou + ' : « ' + k + ' » hors bornes (' + b[0] + ' à ' + b[1] + ').');
      propre[k] = t[k];
    });
    exiger(typeof t.provisoire === 'boolean', ou + ' : « provisoire » doit être un booléen.');
    propre.provisoire = t.provisoire;
    return propre;
  }

  function validerCle(cle, cases, ou) {
    exiger(typeof cle === 'string' && MOTIF_CLE.test(cle), ou + ' : clé de case invalide.');
    exiger(possede(cases, cle), ou + ' : la case ' + cle + ' n’existe pas sur le plateau.');
    return cle;
  }

  function idsEvenements() { return cartes().paquetEvenements(); }
  function idsCampements() { return cartes().paquetCampement(); }

  /**
   * Valide la STRUCTURE d'un plateau selon le contrat A / B et en renvoie une copie propre, avec ses cases.
   * Le contenu (catalogue, chevauchements...) relève des contrôles du lot A.
   */
  /**
   * Pièces personnelles du plateau (champ facultatif `modeles`) : structure stricte et copie propre.
   * Le lot A (env.plateau.valider) ajoute ses propres règles (un seul tenant, case (0,0), identifiants de base).
   */
  function validerModelesPlateau(liste) {
    var L = bornesPerso();
    exiger(Array.isArray(liste) && liste.length <= L.modeles, 'Plateau : liste de pièces personnelles invalide (' + L.modeles + ' au plus).');
    var ids = Object.create(null);
    return liste.map(function (m, i) {
      var ou = 'Plateau, pièce personnelle ' + (i + 1);
      clesExactes(m, ['id', 'nom', 'cases', 'quantite'], ou);
      exiger(typeof m.id === 'string' && L.motif.test(m.id), ou + ' : identifiant invalide (« X » suivi de chiffres).');
      exiger(ids[m.id] !== true, ou + ' : identifiant en double.');
      ids[m.id] = true;
      exiger(typeof m.nom === 'string' && m.nom.trim().length >= 1 && m.nom.length <= L.nom && !/[\u0000-\u001f\u007f]/.test(m.nom),
        ou + ' : nom invalide (1 à ' + L.nom + ' caractères).');
      exiger(estEntier(m.quantite, 1, L.quantite), ou + ' : quantité invalide (1 à ' + L.quantite + ').');
      exiger(Array.isArray(m.cases) && m.cases.length >= L.casesMin && m.cases.length <= L.casesMax, ou + ' : ' + L.casesMin + ' à ' + L.casesMax + ' cases attendues.');
      var vues = Object.create(null);
      var cases = m.cases.map(function (c) {
        clesExactes(c, ['q', 'r', 'terrain'], ou);
        exiger(estEntier(c.q, -L.casesMax, L.casesMax) && estEntier(c.r, -L.casesMax, L.casesMax), ou + ' : case invalide.');
        exiger(L.terrains.indexOf(c.terrain) >= 0, ou + ' : terrain invalide (jamais de ville dans un monobloc).');
        exiger(vues[c.q + ',' + c.r] !== true, ou + ' : case en double.');
        vues[c.q + ',' + c.r] = true;
        return { q: c.q, r: c.r, terrain: c.terrain };
      });
      return { id: m.id, nom: m.nom, cases: cases, quantite: m.quantite };
    });
  }

  function validerPlateau(pl, env) {
    var champs = ['version', 'graine', 'pieces', 'recouvrements', 'camps'];
    exiger(estObjet(pl), 'Plateau : objet attendu.');
    var avecModeles = possede(pl, 'modeles');                       // champ facultatif
    var avecDeploiements = possede(pl, 'deploiements');             // champ facultatif (villes posées par-dessus une Plaine : neutres et déploiement)
    var avecProfondeur = possede(pl, 'profondeurExtremite');         // champ des règles précédentes : validé, puis abandonné (sans effet)
    clesExactes(pl, champs.concat(avecModeles ? ['modeles'] : [], avecDeploiements ? ['deploiements'] : [], avecProfondeur ? ['profondeurExtremite'] : []), 'Plateau');
    exiger(estEntier(pl.version, 0, 1000), 'Plateau : version invalide.');
    // La graine du plateau est moins contrainte que celle de la partie (chaîne vide ou null admis),
    // pour ne pas refuser un plateau que le lot A accepte.
    var graineLibre = pl.graine === null || pl.graine === '';
    if (!graineLibre) {
      validerGraine(pl.graine);
      exiger(typeof pl.graine !== 'string' || pl.graine.length <= LIMITES.grainePlateau,
        'Plateau : graine invalide (entier ou texte de ' + LIMITES.grainePlateau + ' caractères au plus).');
    }
    var propre = { version: pl.version, graine: pl.graine, pieces: [], recouvrements: [], camps: {} };
    if (avecModeles) {
      var persos = validerModelesPlateau(pl.modeles);
      if (persos.length) propre.modeles = persos;                    // forme canonique : champ absent s'il n'y en a pas
    }
    exiger(Array.isArray(pl.pieces) && pl.pieces.length <= LIMITES.pieces, 'Plateau : liste de pièces invalide.');
    exiger(pl.pieces.length >= 1, 'Plateau vide : il faut au moins une pièce pour jouer.');
    function ident(v, ou) {
      exiger((typeof v === 'string' && MOTIF_IDENT.test(v)) || estEntier(v, 0, 100000), ou + ' : identifiant invalide.');
      return v;
    }
    pl.pieces.forEach(function (p, i) {
      var ou = 'Plateau, pièce ' + (i + 1);
      clesExactes(p, ['id', 'modele', 'q', 'r', 'rotation'], ou);
      exiger(estEntier(p.q, -999, 999) && estEntier(p.r, -999, 999), ou + ' : coordonnées invalides.');
      exiger(estEntier(p.rotation, 0, 5), ou + ' : rotation invalide (0 à 5).');
      propre.pieces.push({ id: ident(p.id, ou), modele: ident(p.modele, ou), q: p.q, r: p.r, rotation: p.rotation });
    });
    exiger(Array.isArray(pl.recouvrements) && pl.recouvrements.length <= idsEvenements().length, 'Plateau : recouvrements invalides.');
    var connus = idsEvenements();
    pl.recouvrements.forEach(function (rc, i) {
      var ou = 'Plateau, recouvrement ' + (i + 1);
      clesExactes(rc, ['evenement', 'cle'], ou);
      exiger(connus.indexOf(rc.evenement) >= 0, ou + ' : événement inconnu.');
      exiger(typeof rc.cle === 'string' && MOTIF_CLE.test(rc.cle), ou + ' : clé de case invalide.');
      propre.recouvrements.push({ evenement: rc.evenement, cle: rc.cle });
    });
    if (avecDeploiements) {
      exiger(Array.isArray(pl.deploiements) && pl.deploiements.length <= 8, 'Plateau : villes posées invalides.');
      var villesPosees = [];
      pl.deploiements.forEach(function (d, i) {
        var ou = 'Plateau, ville posée ' + (i + 1);
        clesExactes(d, ['cle', 'camp'], ou);
        exiger(typeof d.camp === 'string' && (d.camp === 'neutre' || JOUEURS.indexOf(d.camp) >= 0), ou + ' : propriétaire invalide (neutre, vert ou rouge).');
        exiger(typeof d.cle === 'string' && MOTIF_CLE.test(d.cle), ou + ' : clé de case invalide.');
        villesPosees.push({ cle: d.cle, camp: d.camp });
      });
      if (villesPosees.length) propre.deploiements = villesPosees;   // forme canonique : champ absent s'il n'y en a pas
    }
    if (avecProfondeur) {
      exiger(estEntier(pl.profondeurExtremite, 1, 3), 'Plateau : profondeur des extrémités invalide (1 à 3).');
    }
    clesExactes(pl.camps, JOUEURS, 'Plateau, camps');
    JOUEURS.forEach(function (j) {
      exiger(Array.isArray(pl.camps[j]) && pl.camps[j].length <= 6, 'Plateau, camps : liste invalide.');
      pl.camps[j].forEach(function (c) { exiger(typeof c === 'string' && MOTIF_CLE.test(c), 'Plateau, camps : clé de case invalide.'); });
      propre.camps[j] = pl.camps[j].slice();
    });
    // Si le lot A fournit son propre contrôle de fichier (modèles connus du catalogue, doublons), il s'ajoute.
    if (typeof env.plateau.valider === 'function') {
      var avis;
      try { avis = env.plateau.valider(cloner(propre)); } catch (x) { avis = null; }
      exiger(!!avis && avis.ok === true, 'Plateau : ' + ((avis && Array.isArray(avis.erreurs) && typeof avis.erreurs[0] === 'string')
        ? avis.erreurs[0].slice(0, 200) : 'refusé par le contrôle du plateau.'));
    }
    // Les cases sont calculées par le lot A sur la copie propre.
    var cases;
    try { cases = env.plateau.cases(propre); } catch (x) { cases = null; }
    exiger(estObjet(cases), 'Plateau : le calcul des cases a échoué.');
    propre.recouvrements.forEach(function (rc) { exiger(possede(cases, rc.cle), 'Plateau : recouvrement hors du plateau.'); });
    JOUEURS.forEach(function (j) {
      propre.camps[j].forEach(function (c) { exiger(possede(cases, c), 'Plateau, camps : case hors du plateau.'); });
    });
    return { plateau: propre, cases: cases };
  }

  function validerListe(liste, max, ou) {
    exiger(Array.isArray(liste) && liste.length <= max, ou + ' : liste invalide.');
    liste.forEach(function (c) { exiger(typeof c === 'string' && c.length <= 40, ou + ' : carte invalide.'); });
    return liste.slice();
  }

  function validerPaquet(p, max, ou) {
    clesExactes(p, ['pioche', 'main', 'defausse'], ou);
    return {
      pioche: validerListe(p.pioche, max, ou + ', pioche'),
      main: validerListe(p.main, max, ou + ', main'),
      defausse: validerListe(p.defausse, max, ou + ', défausse')
    };
  }

  /**
   * Valide strictement un objet relu (types, bornes, identifiants connus, cohérence des cartes).
   * `env.plateau` est nécessaire (cases et villes du plateau), ainsi que `env.alea` : l'état d'aléa du
   * fichier est essayé sur l'aléa injecté (n'importe quelle graine convient, il est restauré à chaque opération).
   * Renvoie { ok, etat, raison } ; `etat` est un objet NEUF reconstruit champ par champ (jamais l'objet reçu).
   */
  function valider(objet, env) {
    if (!plateauPresent(env) || !aleaPresent(env)) return refus(null, 'Aléa ou fonctions du plateau manquants : validation impossible.');
    try {
      return reussite(validerEtat(objet, env));
    } catch (x) {
      if (x instanceof ErreurValidation) return refus(null, x.message);
      return refus(null, 'Fichier de partie invalide.');
    }
  }

  function validerEtat(o, env) {
    clesExactes(o, ORDRE_CHAMPS, 'Partie');
    exiger(o.format === FORMAT, 'Ce fichier n’est pas une partie de l’atelier.');
    exiger(o.version === VERSION, 'Version de fichier inconnue.');
    var e = { format: FORMAT, version: VERSION };
    e.graine = validerGraine(o.graine);
    e.alea = jsonSimple(o.alea, 0, 'Aléa');
    var aleaAccepte = true;
    try { env.alea.restaurer(cloner(e.alea)); } catch (x) { aleaAccepte = false; }
    exiger(aleaAccepte, 'Aléa : état refusé par le générateur.');
    e.reglages = validerReglages(o.reglages);
    exiger(estEntier(o.tour, 1, LIMITES.tour), 'Numéro de tour invalide.');
    exiger(estJoueur(o.actif), 'Joueur actif invalide.');
    exiger(estEntier(o.actions, 0, LIMITES.actions), 'Compteur d’actions invalide.');
    e.tour = o.tour; e.actif = o.actif; e.actions = o.actions;

    clesExactes(o.gloire, JOUEURS, 'Gloire');
    e.gloire = {};
    JOUEURS.forEach(function (j) {
      exiger(estEntier(o.gloire[j], 0, e.reglages.gloireVictoire), 'Gloire hors bornes (0 à ' + e.reglages.gloireVictoire + ').');
      e.gloire[j] = o.gloire[j];
    });

    // Définitions de Troupes
    exiger(estObjet(o.troupes), 'Troupes : objet attendu.');
    var idsTroupes = Object.keys(o.troupes);
    exiger(idsTroupes.length >= 1 && idsTroupes.length <= LIMITES.modeles, 'Troupes : nombre invalide.');
    e.troupes = {};
    idsTroupes.forEach(function (id) {
      exiger(MOTIF_TROUPE.test(id), 'Troupes : identifiant invalide.');
      e.troupes[id] = validerTroupe(o.troupes[id], 'Troupe ' + id);
    });

    // Exemplaires (cartes physiques)
    exiger(estObjet(o.exemplaires), 'Exemplaires : objet attendu.');
    var idsEx = Object.keys(o.exemplaires);
    exiger(idsEx.length <= 2 * BORNES_REGLAGES.tailleDeck[1], 'Exemplaires : trop de cartes.');
    e.exemplaires = {};
    idsEx.forEach(function (id) {
      exiger(MOTIF_EXEMPLAIRE.test(id), 'Exemplaires : identifiant invalide.');
      var ex = o.exemplaires[id];
      clesExactes(ex, ['modele', 'joueur'], 'Exemplaire ' + id);
      exiger(estJoueur(ex.joueur) && id.indexOf(ex.joueur + '-') === 0, 'Exemplaire ' + id + ' : joueur invalide.');
      exiger(typeof ex.modele === 'string' && possede(e.troupes, ex.modele), 'Exemplaire ' + id + ' : Troupe inconnue.');
      e.exemplaires[id] = { modele: ex.modele, joueur: ex.joueur };
    });

    // Plateau
    var vp = validerPlateau(o.plateau, env);
    e.plateau = vp.plateau;
    var cases = vp.cases;
    var villesPlateau;
    try { villesPlateau = env.plateau.villes(e.plateau); } catch (x) { villesPlateau = null; }
    exiger(Array.isArray(villesPlateau), 'Plateau : le calcul des villes a échoué.');

    // Villes capturées
    exiger(estObjet(o.villes), 'Villes : objet attendu.');
    e.villes = {};
    Object.keys(o.villes).forEach(function (cle) {
      exiger(MOTIF_CLE.test(cle) && villesPlateau.indexOf(cle) >= 0, 'Villes : ' + String(cle).slice(0, 20) + ' n’est pas une ville du plateau.');
      exiger(estJoueur(o.villes[cle]), 'Villes : propriétaire invalide.');
      e.villes[cle] = o.villes[cle];
    });

    // Paquets
    clesExactes(o.paquets, ['vert', 'rouge', 'campement', 'evenements'], 'Paquets');
    e.paquets = {};
    ['vert', 'rouge', 'campement', 'evenements'].forEach(function (nom) {
      e.paquets[nom] = validerPaquet(o.paquets[nom], 2 * BORNES_REGLAGES.tailleDeck[1], 'Paquet ' + nom);
    });

    // Bataillons
    clesExactes(o.bataillons, JOUEURS, 'Bataillons');
    e.bataillons = {};
    var vues = {};   // chaque exemplaire doit apparaître une seule fois
    function voir(carte, joueur, ou) {
      exiger(possede(e.exemplaires, carte) && e.exemplaires[carte].joueur === joueur, ou + ' : carte inconnue ou d’un autre joueur.');
      exiger(!possede(vues, carte), ou + ' : la carte ' + carte + ' apparaît deux fois.');
      vues[carte] = true;
    }
    JOUEURS.forEach(function (j) {
      var liste = o.bataillons[j];
      exiger(Array.isArray(liste) && liste.length === e.reglages.bataillonsParJoueur, 'Bataillons de ' + NOMS[j] + ' : nombre invalide.');
      e.bataillons[j] = liste.map(function (b, i) {
        var ou = 'Bataillon ' + (i + 1) + ' de ' + NOMS[j];
        clesExactes(b, ['numero', 'case', 'troupes', 'campement'], ou);
        exiger(b.numero === i + 1, ou + ' : numéro invalide.');
        exiger(typeof b.campement === 'boolean', ou + ' : « campement » doit être un booléen.');
        exiger(Array.isArray(b.troupes) && b.troupes.length <= e.reglages.troupesParBataillon, ou + ' : trop de Troupes.');
        var propre = { numero: b.numero, case: null, troupes: [], campement: b.campement };
        if (b.case === null) {
          exiger(b.troupes.length === 0 && !b.campement, ou + ' : un bataillon en réserve n’a ni Troupe ni marque Campement.');
        } else {
          propre.case = validerCle(b.case, cases, ou);
          exiger(b.troupes.length >= 1, ou + ' : un bataillon posé a au moins 1 Troupe.');
        }
        b.troupes.forEach(function (t) {
          clesExactes(t, ['carte', 'degats'], ou);
          exiger(typeof t.carte === 'string', ou + ' : carte invalide.');
          voir(t.carte, j, ou);
          var moral = e.troupes[e.exemplaires[t.carte].modele].moral;
          exiger(estEntier(t.degats, 0, moral - 1), ou + ' : dégâts hors bornes (0 à ' + (moral - 1) + ').');
          propre.troupes.push({ carte: t.carte, degats: t.degats });
        });
        return propre;
      });
      ['pioche', 'main', 'defausse'].forEach(function (zone) {
        e.paquets[j][zone].forEach(function (c) { voir(c, j, 'Paquet ' + j); });
      });
    });
    exiger(Object.keys(vues).length === idsEx.length, 'Cartes : un exemplaire n’est ni dans un paquet ni dans un bataillon.');

    // Paquets communs : chaque carte connue, une seule fois
    function paquetCommun(nom, connus, mainPermise) {
      var p = e.paquets[nom], toutes = p.pioche.concat(p.main, p.defausse), dejaVues = {};
      exiger(mainPermise || p.main.length === 0, 'Paquet ' + nom + ' : pas de main.');
      toutes.forEach(function (c) {
        exiger(connus.indexOf(c) >= 0, 'Paquet ' + nom + ' : carte inconnue.');
        exiger(!possede(dejaVues, c), 'Paquet ' + nom + ' : carte en double.');
        dejaVues[c] = true;
      });
      exiger(toutes.length === connus.length, 'Paquet ' + nom + ' : il manque des cartes.');
    }
    paquetCommun('campement', idsCampements(), false);
    paquetCommun('evenements', idsEvenements(), true);
    // Tuile unique : la carte d'une tuile déjà posée sur le plateau est dans la défausse, jamais à piocher ni en attente.
    e.plateau.recouvrements.forEach(function (rc) {
      exiger(e.paquets.evenements.defausse.indexOf(rc.evenement) >= 0,
        'Paquet evenements : la tuile ' + rc.evenement + ' est déjà sur le plateau, sa carte doit être dans la défausse.');
    });

    // Journal
    exiger(Array.isArray(o.journal) && o.journal.length <= LIMITES.journal, 'Journal : liste invalide.');
    var precedent = 0;
    e.journal = o.journal.map(function (l) {
      clesExactes(l, ['n', 'tour', 'joueur', 'type', 'texte'], 'Journal');
      exiger(estEntier(l.n, precedent + 1, 9007199254740991), 'Journal : numéro d’entrée invalide.');
      precedent = l.n;
      exiger(estEntier(l.tour, 1, LIMITES.tour), 'Journal : tour invalide.');
      exiger(l.joueur === null || estJoueur(l.joueur), 'Journal : joueur invalide.');
      exiger(typeof l.type === 'string' && MOTIF_TYPE.test(l.type), 'Journal : type invalide.');
      exiger(typeof l.texte === 'string' && l.texte.length <= LIMITES.texte, 'Journal : texte invalide.');
      return { n: l.n, tour: l.tour, joueur: l.joueur, type: l.type, texte: l.texte };
    });
    return ordonner(e);
  }

  var ORDRE_CHAMPS = ['format', 'version', 'graine', 'alea', 'reglages', 'tour', 'actif', 'actions', 'gloire',
    'troupes', 'exemplaires', 'paquets', 'bataillons', 'villes', 'plateau', 'journal'];

  /** Remet les champs de l'état dans l'ordre de référence (un fichier relu puis réenregistré reste identique). */
  function ordonner(e) {
    var propre = {};
    ORDRE_CHAMPS.forEach(function (k) { propre[k] = e[k]; });
    return propre;
  }

  /** Texte JSON de la partie (état présent seulement : l'historique annuler / rétablir n'est pas enregistré). */
  function serialiser(etat) {
    return JSON.stringify(etat);
  }

  /** Relit un texte JSON et le valide strictement. Renvoie { ok, etat, raison }. */
  function charger(texte, env) {
    if (typeof texte !== 'string') return refus(null, 'Fichier illisible.');
    if (texte.length > LIMITES.fichier) return refus(null, 'Fichier trop volumineux.');
    var objet;
    try { objet = JSON.parse(texte); } catch (x) { return refus(null, 'Ce fichier n’est pas du JSON valide.'); }
    return valider(objet, env);
  }

  // ---------------------------------------------------------------------------------------------
  // Création d'une partie
  // ---------------------------------------------------------------------------------------------

  /**
   * Crée une partie. options : { graine, plateau, reglages (partiel, complète AT.cartes.REGLAGES),
   * troupes ([{id, nom, moral, puissance, des, provisoire}], par défaut les Troupes provisoires) }.
   * `env.alea` doit venir d'être créé avec la même graine (il est utilisé tel quel).
   * Mise en place (règles V2.3) : decks et pioche Campement mélangés, main de départ, Gloire à 0,
   * bataillons en réserve, puis le premier joueur pioche pour son premier tour.
   */
  function creer(options, env) {
    options = options || {};
    if (!aleaPresent(env) || !plateauPresent(env)) return refus(null, 'Environnement incomplet : aléa et fonctions du plateau attendus.');
    var C = cartes(), P = paquets();
    var e = { format: FORMAT, version: VERSION };
    var listeTroupes;
    try {
      e.graine = validerGraine(options.graine);
      e.alea = null;
      var brut = {};
      Object.keys(C.REGLAGES).forEach(function (k) { brut[k] = C.REGLAGES[k]; });
      if (options.reglages !== undefined) {
        exiger(estObjet(options.reglages), 'Réglages : objet attendu.');
        Object.keys(options.reglages).forEach(function (k) { brut[k] = options.reglages[k]; });
      }
      e.reglages = validerReglages(brut);
      e.tour = 1; e.actif = e.reglages.premierJoueur; e.actions = 0;
      e.gloire = { vert: 0, rouge: 0 };
      listeTroupes = options.troupes === undefined ? C.troupes() : options.troupes;
      exiger(Array.isArray(listeTroupes) && listeTroupes.length >= 1 && listeTroupes.length <= LIMITES.modeles, 'Troupes : liste invalide.');
      e.troupes = {};
      listeTroupes.forEach(function (t) {
        exiger(estObjet(t) && typeof t.id === 'string' && MOTIF_TROUPE.test(t.id), 'Troupes : identifiant invalide (T suivi de 1 à 3 chiffres).');
        exiger(!possede(e.troupes, t.id), 'Troupes : identifiant en double.');
        e.troupes[t.id] = validerTroupe({ nom: t.nom, moral: t.moral, puissance: t.puissance, des: t.des, provisoire: t.provisoire !== false }, 'Troupe ' + t.id);
      });
      e.plateau = validerPlateau(options.plateau, env).plateau;
    } catch (x) {
      if (x instanceof ErreurValidation) return refus(null, x.message);
      throw x;
    }
    e.exemplaires = {};
    e.paquets = {};
    e.bataillons = {};
    e.villes = {};
    e.journal = [];
    journaliser(e, null, 'partie', 'Nouvelle partie (graine ' + e.graine + '). ' + NOMS[e.actif] + ' commence.');
    JOUEURS.forEach(function (j) {
      var deck = C.deckDeDepart(j, e.reglages.tailleDeck, listeTroupes);
      deck.forEach(function (ex) { e.exemplaires[ex.id] = { modele: ex.modele, joueur: j }; });
      e.paquets[j] = P.melangerPioche(P.creer(deck.map(function (ex) { return ex.id; })), env.alea).paquet;
      e.bataillons[j] = [];
      for (var n = 1; n <= e.reglages.bataillonsParJoueur; n++) {
        e.bataillons[j].push({ numero: n, case: null, troupes: [], campement: false });
      }
    });
    e.paquets.campement = P.melangerPioche(P.creer(C.paquetCampement()), env.alea).paquet;
    e.paquets.evenements = P.melangerPioche(P.creer(C.paquetEvenements()), env.alea).paquet;
    // Tuiles d'événement déjà posées sur le plateau reçu : tuiles uniques, leurs cartes ne sont plus à piocher.
    // Le mélange porte d'abord sur toutes les cartes (l'aléa avance de la même façon avec ou sans tuile posée),
    // puis les cartes des tuiles posées vont dans la défausse Événement, comme après une pose en cours de partie.
    var dejaPosees = [];
    e.plateau.recouvrements.forEach(function (rc) {
      if (dejaPosees.indexOf(rc.evenement) < 0 && e.paquets.evenements.pioche.indexOf(rc.evenement) >= 0) dejaPosees.push(rc.evenement);
    });
    if (dejaPosees.length) {
      e.paquets.evenements.pioche = e.paquets.evenements.pioche.filter(function (c) { return dejaPosees.indexOf(c) < 0; });
      e.paquets.evenements.defausse = e.paquets.evenements.defausse.concat(dejaPosees);
      journaliser(e, null, 'evenement', 'Tuile(s) d’événement déjà sur le plateau : ' + dejaPosees.join(', ') + ' ; leurs cartes ne sont pas dans la pioche.');
    }
    JOUEURS.forEach(function (j) {
      var r = P.piocher(e.paquets[j], e.reglages.mainDeDepart, env.alea, { limiteMain: e.reglages.tailleMain });
      e.paquets[j] = r.paquet;
      journaliser(e, j, 'pioche', NOMS[j] + ' pioche sa main de départ (' + r.piochees.length + ' carte(s)).');
    });
    var debut = P.piocher(e.paquets[e.actif], e.reglages.piocheDebutTour, env.alea, { limiteMain: e.reglages.tailleMain });
    e.paquets[e.actif] = debut.paquet;
    journaliser(e, e.actif, 'tour', 'Tour 1 : ' + NOMS[e.actif] + ' pioche ' + debut.piochees.length + ' carte(s).');
    memoriserAlea(e, env);
    return reussite(ordonner(e));
  }

  // ---------------------------------------------------------------------------------------------
  // Gloire, dés, actions, tour, notes
  // ---------------------------------------------------------------------------------------------

  /**
   * Ajoute `delta` (positif ou négatif) à la Gloire d'un joueur, bornée entre 0 et la Gloire de victoire.
   * params : { joueur, delta }. Renvoie aussi { gloire, victoire }. La victoire est signalée, rien n'est bloqué.
   */
  function modifierGloire(etat, params) {
    params = params || {};
    if (!estJoueur(params.joueur)) return refus(etat, 'Joueur inconnu.');
    if (!estEntier(params.delta, -99, 99) || params.delta === 0) return refus(etat, 'Variation de Gloire invalide.');
    var e = cloner(etat), j = params.joueur, max = e.reglages.gloireVictoire;
    var avant = e.gloire[j];
    var apres = Math.max(0, Math.min(max, avant + params.delta));
    var av = [];
    if (apres !== avant + params.delta) av.push(avert('gloire-bornee', 'La Gloire reste entre 0 et ' + max + '.', false));
    e.gloire[j] = apres;
    journaliser(e, j, 'gloire', 'Gloire de ' + NOMS[j] + ' : ' + avant + ' → ' + apres + ' (' + (params.delta > 0 ? '+' : '') + params.delta + ').');
    var victoire = apres >= max && avant < max;
    if (victoire) journaliser(e, j, 'victoire', NOMS[j] + ' atteint ' + max + ' points de Gloire : victoire.');
    return reussite(e, { gloire: apres, victoire: victoire }, av);
  }

  /**
   * Lance n dés à 6 faces. params : { n, joueur (facultatif), motif (facultatif) }.
   * Renvoie aussi { des: [...], total }.
   */
  function lancerDes(etat, params, env) {
    params = params || {};
    if (!aleaPresent(env)) return refus(etat, 'Aléa manquant.');
    if (!estEntier(params.n, 1, etat.reglages.desMax)) return refus(etat, 'Nombre de dés invalide (1 à ' + etat.reglages.desMax + ').');
    var joueur = estJoueur(params.joueur) ? params.joueur : null;
    var e = cloner(etat), des = [], total = 0;
    reprendreAlea(etat, env);
    for (var i = 0; i < params.n; i++) { var d = env.alea.de(); des.push(d); total += d; }
    memoriserAlea(e, env);
    var motif = texteSaisi(params.motif, LIMITES.note);
    journaliser(e, joueur, 'des', (joueur ? NOMS[joueur] + ' lance ' : 'Lancer de ') + params.n + ' dé(s) : ' + des.join(', ') +
      ' (total ' + total + ')' + (motif ? ' ; ' + motif : '') + '.');
    return reussite(e, { des: des, total: total });
  }

  /** Compte une action pour `joueur` dans `e` et ajoute les avertissements (non bloquants) à `av`. */
  function compterAction(e, joueur, av, compter) {
    if (compter === false) return;
    if (joueur !== e.actif) { av.push(avert('hors-tour', 'Ce n’est pas le tour de ' + NOMS[joueur] + ' : action non comptée.', false)); return; }
    e.actions = Math.min(LIMITES.actions, e.actions + 1);
    if (e.actions > e.reglages.actionsParTour) {
      av.push(avert('actions-depassees', 'Plus de ' + e.reglages.actionsParTour + ' actions ce tour-ci (' + e.actions + ').', false));
    }
  }

  /**
   * Corrige à la main le compteur d'actions du joueur actif (attaque, renouvellement de main...).
   * params : { delta, motif (facultatif) }.
   */
  function ajusterActions(etat, params) {
    params = params || {};
    if (!estEntier(params.delta, -LIMITES.actions, LIMITES.actions) || params.delta === 0) return refus(etat, 'Variation invalide.');
    var e = cloner(etat), av = [];
    e.actions = Math.max(0, Math.min(LIMITES.actions, e.actions + params.delta));
    if (e.actions > e.reglages.actionsParTour) {
      av.push(avert('actions-depassees', 'Plus de ' + e.reglages.actionsParTour + ' actions ce tour-ci (' + e.actions + ').', false));
    }
    var motif = texteSaisi(params.motif, LIMITES.note);
    journaliser(e, e.actif, 'action', 'Actions de ' + NOMS[e.actif] + ' : ' + etat.actions + ' → ' + e.actions + (motif ? ' ; ' + motif : '') + '.');
    return reussite(e, { actions: e.actions }, av);
  }

  /**
   * Fin du tour : le joueur suivant devient actif, le compteur d'actions revient à 0, le numéro de tour
   * augmente et le joueur suivant pioche (REGLAGES.piocheDebutTour, main limitée). Renvoie aussi { piochees }.
   */
  function finDeTour(etat, params, env) {
    if (!aleaPresent(env)) return refus(etat, 'Aléa manquant.');
    if (etat.tour >= LIMITES.tour) return refus(etat, 'Nombre maximal de tours atteint.');
    var e = cloner(etat), P = paquets();
    journaliser(e, e.actif, 'tour', 'Fin du tour ' + e.tour + ' (' + NOMS[e.actif] + ', ' + e.actions + ' action(s) comptée(s)).');
    e.tour += 1;
    e.actif = autre(e.actif);
    e.actions = 0;
    reprendreAlea(etat, env);
    var r = P.piocher(e.paquets[e.actif], e.reglages.piocheDebutTour, env.alea, { limiteMain: e.reglages.tailleMain });
    e.paquets[e.actif] = r.paquet;
    memoriserAlea(e, env);
    journaliser(e, e.actif, 'tour', 'Tour ' + e.tour + ' : ' + NOMS[e.actif] + ' pioche ' + r.piochees.length + ' carte(s)' +
      (r.mainPleine ? ' (main pleine)' : '') + (r.remelanges ? ' (défausse remélangée)' : '') + '.');
    return reussite(e, { piochees: r.piochees, mainPleine: r.mainPleine });
  }

  /** Ajoute une note libre au journal. params : { texte, joueur (facultatif) }. */
  function noter(etat, params) {
    params = params || {};
    var texte = texteSaisi(params.texte, LIMITES.note);
    if (!texte) return refus(etat, 'Note vide.');
    var e = cloner(etat);
    journaliser(e, estJoueur(params.joueur) ? params.joueur : null, 'note', texte);
    return reussite(e);
  }

  // ---------------------------------------------------------------------------------------------
  // Paquets des joueurs : toutes les manipulations nécessaires aux effets Campement
  // ---------------------------------------------------------------------------------------------

  /** Opérations de AT.paquets permises sur le deck d'un joueur, avec leur libellé de journal. */
  var OPERATIONS_PAQUET = {
    piocher: 'pioche',
    defausser: 'défausse une carte de sa main',
    defausserMain: 'défausse toute sa main',
    defausserAuHasard: 'défausse une carte de sa main prise au hasard',
    defausserDessusPioche: 'défausse la première carte de sa pioche',
    melangerPioche: 'mélange sa pioche',
    melangerDefausseDansPioche: 'mélange sa défausse dans sa pioche',
    regarder: 'regarde le dessus de sa pioche',
    prendreDansPioche: 'prend en main une carte de sa pioche',
    reordonnerDessus: 'remet des cartes sur sa pioche dans l’ordre choisi',
    remettreDessus: 'met une carte de sa main sur sa pioche',
    remettreDessous: 'met une carte de sa main sous sa pioche',
    reprendreDefausse: 'reprend en main une carte de sa défausse',
    remettreMainDansPioche: 'remet toute sa main dans sa pioche et mélange'
  };

  /**
   * Applique une opération de AT.paquets au deck d'un joueur et la journalise.
   * params : { joueur, operation, n, carte, cartes } selon l'opération (voir OPERATIONS_PAQUET) :
   *   piocher {n} ; defausser {carte} ; defausserMain ; defausserAuHasard ; defausserDessusPioche ;
   *   melangerPioche ; melangerDefausseDansPioche ; regarder {n} ; prendreDansPioche {carte} ;
   *   reordonnerDessus {cartes} ; remettreDessus {carte} ; remettreDessous {carte} ;
   *   reprendreDefausse {carte facultative} ; remettreMainDansPioche.
   * Renvoie aussi les résultats de l'opération (piochees, carte, cartes, mainPleine, remelanges...).
   */
  function paquet(etat, params, env) {
    params = params || {};
    var P = paquets(), j = params.joueur, op = params.operation;
    if (!estJoueur(j)) return refus(etat, 'Joueur inconnu.');
    if (typeof op !== 'string' || !possede(OPERATIONS_PAQUET, op)) return refus(etat, 'Opération de paquet inconnue.');
    if (!aleaPresent(env)) return refus(etat, 'Aléa manquant.');
    var carte = params.carte;
    if (carte !== undefined && carte !== null && !(typeof carte === 'string' && possede(etat.exemplaires, carte))) return refus(etat, 'Carte inconnue.');
    var p = etat.paquets[j], limite = { limiteMain: etat.reglages.tailleMain }, r;
    reprendreAlea(etat, env);
    switch (op) {
      case 'piocher': r = P.piocher(p, params.n, env.alea, limite); break;
      case 'defausser': r = P.defausser(p, carte); break;
      case 'defausserMain': r = P.defausserMain(p); break;
      case 'defausserAuHasard': r = P.defausserAuHasard(p, env.alea); break;
      case 'defausserDessusPioche': r = P.defausserDessusPioche(p, env.alea); break;
      case 'melangerPioche': r = P.melangerPioche(p, env.alea); break;
      case 'melangerDefausseDansPioche': r = P.melangerDefausseDansPioche(p, env.alea); break;
      case 'regarder': r = P.regarder(p, params.n); break;
      case 'prendreDansPioche': r = P.prendreDansPioche(p, carte); break;
      case 'reordonnerDessus': r = P.reordonnerDessus(p, params.cartes); break;
      case 'remettreDessus': r = P.remettreDessus(p, carte); break;
      case 'remettreDessous': r = P.remettreDessous(p, carte); break;
      case 'reprendreDefausse': r = P.reprendreDefausse(p, carte); break;
      default: r = P.remettreMainDansPioche(p, env.alea);
    }
    if (!r.ok) { reprendreAlea(etat, env); return refus(etat, r.raison); }
    var e = cloner(etat);
    e.paquets[j] = r.paquet;
    memoriserAlea(e, env);
    var detail = '';
    if (op === 'piocher') {
      detail = ' ' + r.piochees.length + ' carte(s) sur ' + params.n + (r.mainPleine ? ' (main pleine)' : '') + (r.manquantes ? ' (plus de carte)' : '');
    } else if (op === 'regarder') {
      detail = ' (' + r.cartes.length + ' carte(s))';
    } else if (r.carte) {
      detail = ' : ' + nomCarte(etat, r.carte);
    } else if (r.carte === null) {
      detail = ' (aucune carte)';
    } else if (r.cartes) {
      detail = ' (' + r.cartes.length + ' carte(s))';
    }
    if (r.remelanges) detail += ' (défausse remélangée)';
    journaliser(e, j, 'paquet', NOMS[j] + ' ' + OPERATIONS_PAQUET[op] + detail + '.');
    var extras = {};
    Object.keys(r).forEach(function (k) { if (['ok', 'paquet', 'raison'].indexOf(k) < 0) extras[k] = r[k]; });
    return reussite(e, extras);
  }

  // ---------------------------------------------------------------------------------------------
  // Bataillons
  // ---------------------------------------------------------------------------------------------

  function casesDuPlateau(etat, env) { return env.plateau.cases(etat.plateau); }

  /**
   * Forme un bataillon : joue une Troupe de la main et pose un pion de la réserve.
   * params : { joueur, numero, carte, cle, forcer, compter }.
   * Attendu (cahier des charges A3) : une ville de déploiement LIBRE de son camp (plateau.camps[joueur]) ;
   * sinon avertissement bloquant (« hors-deploiement », « occupee »), que `forcer` permet de passer.
   */
  /**
   * Villes de déploiement d'un joueur. Quand le plateau porte des tuiles de ville de déploiement (`deploiements`,
   * catalogue 2), ce sont ELLES qui font foi, et non la liste `camps` (qui doit en être la copie) : une case citée
   * dans `camps` sans tuile posée n'est pas une ville de déploiement. Ancien plateau sans tuile : `camps`.
   */
  function villesDeDeploiement(plateau, joueur) {
    var tuiles = Array.isArray(plateau.deploiements) ? plateau.deploiements : [];
    if (tuiles.length) return tuiles.filter(function (d) { return d.camp === joueur; }).map(function (d) { return d.cle; });
    return ((plateau.camps && plateau.camps[joueur]) || []).slice();
  }

  /**
   * Ce que la table de jeu doit dire d'un plateau avant de jouer dessus, sans rien bloquer : liste de phrases
   * (vide = rien à dire). Deux cas : `camps` ne correspond pas aux tuiles de ville de déploiement posées (fichier
   * retouché à la main) ; le plateau n'a aucune ville de déploiement pour un joueur.
   */
  function avisPlateau(plateau) {
    var avis = [], tuiles = Array.isArray(plateau && plateau.deploiements) ? plateau.deploiements : [];
    var memes = function (a, b) { return a.slice().sort().join(' ') === b.slice().sort().join(' '); };
    if (tuiles.length) {
      var faux = JOUEURS.filter(function (j) { return !memes((plateau.camps && plateau.camps[j]) || [], villesDeDeploiement(plateau, j)); });
      if (faux.length) {
        avis.push('Les villes de déploiement enregistrées pour ' + faux.map(function (j) { return NOMS[j]; }).join(' et ')
          + ' (champ « camps ») ne sont pas celles des tuiles posées : la table de jeu s’en tient aux tuiles posées.');
      }
    }
    var sans = JOUEURS.filter(function (j) { return !villesDeDeploiement(plateau || {}, j).length; });
    if (sans.length === JOUEURS.length) avis.push('Ce plateau n’a aucune ville de déploiement : former un bataillon demandera « Faire quand même ». Posez d’abord les villes (onglet Plateau, étape « Villes »).');
    else if (sans.length) avis.push(NOMS[sans[0]] + ' n’a aucune ville de déploiement sur ce plateau : former un bataillon lui demandera « Faire quand même ».');
    return avis;
  }

  function former(etat, params, env) {
    params = params || {};
    if (!plateauPresent(env)) return refus(etat, 'Fonctions du plateau manquantes.');
    var j = params.joueur, b = bataillon(etat, j, params.numero);
    if (!b) return refus(etat, 'Bataillon inconnu.');
    if (b.case !== null) return refus(etat, 'Ce bataillon est déjà sur le plateau.');
    if (etat.paquets[j].main.indexOf(params.carte) < 0) return refus(etat, 'Cette carte n’est pas dans la main de ' + NOMS[j] + '.');
    var cases = casesDuPlateau(etat, env);
    if (typeof params.cle !== 'string' || !possede(cases, params.cle)) return refus(etat, 'Cette case n’existe pas sur le plateau.');
    var av = [];
    if (villesDeDeploiement(etat.plateau, j).indexOf(params.cle) < 0) {
      av.push(avert('hors-deploiement', 'Cette case n’est pas une ville de déploiement de ' + NOMS[j] + '.'));
    }
    if (occupants(etat, params.cle).length) av.push(avert('occupee', 'Cette case est déjà occupée par un bataillon.'));
    if (aBloquant(av) && !params.forcer) return refus(etat, RAISON_A_FORCER, av);
    var e = cloner(etat);
    e.paquets[j] = paquets().retirerDeMain(e.paquets[j], params.carte).paquet;
    var nb = e.bataillons[j][params.numero - 1];
    nb.case = params.cle;
    nb.troupes = [{ carte: params.carte, degats: 0 }];
    nb.campement = false;
    compterAction(e, j, av, params.compter);
    journaliser(e, j, 'former', NOMS[j] + ' forme le bataillon ' + nb.numero + ' en ' + params.cle + ' avec ' + nomCarte(e, params.carte) +
      (params.forcer && aBloquant(av) ? ' (forcé)' : '') + '.');
    return reussite(e, {}, av);
  }

  /**
   * Renforce un bataillon posé avec une Troupe de la main. params : { joueur, numero, carte, forcer, compter }.
   * Le maximum de Troupes par bataillon est une limite ferme. Avertissement bloquant « hors-renfort » si le
   * bataillon n'est ni sur une ville de déploiement de son camp ni sur une ville qu'il contrôle.
   */
  function renforcer(etat, params, env) {
    params = params || {};
    var j = params.joueur, b = bataillon(etat, j, params.numero);
    if (!b) return refus(etat, 'Bataillon inconnu.');
    if (b.case === null) return refus(etat, 'Ce bataillon est en réserve : il faut d’abord le former.');
    if (b.troupes.length >= etat.reglages.troupesParBataillon) return refus(etat, 'Ce bataillon a déjà ' + etat.reglages.troupesParBataillon + ' Troupes.');
    if (etat.paquets[j].main.indexOf(params.carte) < 0) return refus(etat, 'Cette carte n’est pas dans la main de ' + NOMS[j] + '.');
    var av = [];
    var surDeploiement = villesDeDeploiement(etat.plateau, j).indexOf(b.case) >= 0;
    var surVilleControlee = possede(etat.villes, b.case) && etat.villes[b.case] === j;
    if (!surDeploiement && !surVilleControlee) {
      av.push(avert('hors-renfort', 'Ce bataillon n’est ni sur une ville de déploiement ni sur une ville contrôlée par ' + NOMS[j] + '.'));
    }
    if (aBloquant(av) && !params.forcer) return refus(etat, RAISON_A_FORCER, av);
    var e = cloner(etat);
    e.paquets[j] = paquets().retirerDeMain(e.paquets[j], params.carte).paquet;
    e.bataillons[j][params.numero - 1].troupes.push({ carte: params.carte, degats: 0 });
    compterAction(e, j, av, params.compter);
    journaliser(e, j, 'renforcer', NOMS[j] + ' renforce le bataillon ' + b.numero + ' avec ' + nomCarte(e, params.carte) +
      (params.forcer && aBloquant(av) ? ' (forcé)' : '') + '.');
    return reussite(e, {}, av);
  }

  /**
   * Déplace un bataillon posé vers une case. params : { joueur, numero, cle, forcer, compter }.
   * Renvoie toujours { cout, terrain } : coût en rations de la case d'arrivée (null si infranchissable).
   * Avertissements bloquants : « non-voisine », « infranchissable », « occupee » ; avec `forcer`,
   * le déplacement se fait quand même (deux pions peuvent alors partager une case).
   */
  function deplacer(etat, params, env) {
    params = params || {};
    if (!plateauPresent(env) || !hexPresent(env)) return refus(etat, 'Fonctions du plateau ou de géométrie manquantes.');
    var j = params.joueur, b = bataillon(etat, j, params.numero);
    if (!b) return refus(etat, 'Bataillon inconnu.');
    if (b.case === null) return refus(etat, 'Ce bataillon est en réserve : il faut d’abord le former.');
    var cases = casesDuPlateau(etat, env);
    if (typeof params.cle !== 'string' || !possede(cases, params.cle)) return refus(etat, 'Cette case n’existe pas sur le plateau.');
    if (params.cle === b.case) return refus(etat, 'Le bataillon est déjà sur cette case.');
    var brut = env.plateau.cout(etat.plateau, params.cle);
    var cout = (typeof brut === 'number' && isFinite(brut)) ? brut : null;   // jamais Infinity dans un résultat sérialisable
    var terrain = cases[params.cle] && typeof cases[params.cle].terrain === 'string' ? cases[params.cle].terrain : null;
    var infos = { cout: cout, terrain: terrain, depuis: b.case };
    var av = [];
    if (env.hex.voisines(b.case).indexOf(params.cle) < 0) av.push(avert('non-voisine', 'La case ' + params.cle + ' n’est pas voisine de ' + b.case + '.'));
    if (cout === null) av.push(avert('infranchissable', 'La case ' + params.cle + ' est infranchissable.'));
    if (occupants(etat, params.cle).length) av.push(avert('occupee', 'La case ' + params.cle + ' est déjà occupée par un bataillon.'));
    if (aBloquant(av) && !params.forcer) return refus(etat, RAISON_A_FORCER, av, infos);
    var e = cloner(etat);
    e.bataillons[j][params.numero - 1].case = params.cle;
    compterAction(e, j, av, params.compter);
    journaliser(e, j, 'deplacer', NOMS[j] + ' déplace le bataillon ' + b.numero + ' de ' + b.case + ' vers ' + params.cle +
      (cout === null ? ' (infranchissable)' : ' (' + cout + ' ration(s))') + (params.forcer && aBloquant(av) ? ' (forcé)' : '') + '.');
    return reussite(e, infos, av);
  }

  /** Vide un bataillon de `e` : Troupes dans la défausse de leur joueur, pion en réserve, marque Campement effacée. */
  function viderBataillon(e, j, b) {
    b.troupes.forEach(function (t) { e.paquets[j].defausse.push(t.carte); });
    b.troupes = [];
    b.case = null;
    b.campement = false;
  }

  /**
   * Pose ou retire des marqueurs de dégâts sur une Troupe. params : { joueur, numero, troupe (indice 0..), delta }.
   * Quand les dégâts atteignent le moral, la Troupe est éliminée (défausse de son joueur) ; un bataillon
   * sans Troupe retourne en réserve. La Gloire n'est PAS attribuée automatiquement.
   * Renvoie aussi { degats, eliminee, bataillonElimine }.
   */
  function marquerDegats(etat, params) {
    params = params || {};
    var j = params.joueur, b = bataillon(etat, j, params.numero);
    if (!b) return refus(etat, 'Bataillon inconnu.');
    if (!estEntier(params.troupe, 0, b.troupes.length - 1)) return refus(etat, 'Troupe inconnue dans ce bataillon.');
    if (!estEntier(params.delta, -99, 99) || params.delta === 0) return refus(etat, 'Nombre de dégâts invalide.');
    var e = cloner(etat);
    var nb = e.bataillons[j][params.numero - 1], t = nb.troupes[params.troupe];
    var def = troupeDe(e, t.carte), nom = def.nom;
    var degats = Math.max(0, t.degats + params.delta);
    var eliminee = degats >= def.moral, bataillonElimine = false;
    if (eliminee) {
      degats = def.moral;
      nb.troupes.splice(params.troupe, 1);
      e.paquets[j].defausse.push(t.carte);
      journaliser(e, j, 'degats', nom + ' (bataillon ' + nb.numero + ' de ' + NOMS[j] + ') : dégâts ' + degats + ' / ' + def.moral + ', Troupe éliminée.');
      if (!nb.troupes.length) {
        bataillonElimine = true;
        viderBataillon(e, j, nb);
        journaliser(e, j, 'elimination', 'Le bataillon ' + nb.numero + ' de ' + NOMS[j] + ' n’a plus de Troupe : il retourne en réserve.');
      }
    } else {
      t.degats = degats;
      journaliser(e, j, 'degats', nom + ' (bataillon ' + nb.numero + ' de ' + NOMS[j] + ') : dégâts ' + degats + ' / ' + def.moral + '.');
    }
    return reussite(e, { degats: degats, eliminee: eliminee, bataillonElimine: bataillonElimine });
  }

  /**
   * Élimine un bataillon entier (toutes ses Troupes vont dans la défausse, le pion retourne en réserve).
   * params : { joueur, numero }. La Gloire n'est PAS attribuée automatiquement.
   */
  function eliminerBataillon(etat, params) {
    params = params || {};
    var j = params.joueur, b = bataillon(etat, j, params.numero);
    if (!b) return refus(etat, 'Bataillon inconnu.');
    if (b.case === null) return refus(etat, 'Ce bataillon est déjà en réserve.');
    var e = cloner(etat);
    viderBataillon(e, j, e.bataillons[j][params.numero - 1]);
    journaliser(e, j, 'elimination', 'Le bataillon ' + b.numero + ' de ' + NOMS[j] + ' est éliminé (' + b.troupes.length + ' Troupe(s) défaussée(s)).');
    return reussite(e);
  }

  // ---------------------------------------------------------------------------------------------
  // Villes, Campement, Événements
  // ---------------------------------------------------------------------------------------------

  /**
   * Marque le propriétaire d'une ville. params : { cle, proprietaire: 'vert' | 'rouge' | null }.
   * La Gloire n'est PAS attribuée automatiquement.
   */
  function capturerVille(etat, params, env) {
    params = params || {};
    if (!plateauPresent(env)) return refus(etat, 'Fonctions du plateau manquantes.');
    var villes = env.plateau.villes(etat.plateau);
    if (typeof params.cle !== 'string' || villes.indexOf(params.cle) < 0) return refus(etat, 'Cette case n’est pas une ville.');
    var p = params.proprietaire === undefined ? null : params.proprietaire;
    if (p !== null && !estJoueur(p)) return refus(etat, 'Propriétaire inconnu.');
    var avant = possede(etat.villes, params.cle) ? etat.villes[params.cle] : null;
    if (avant === p) return refus(etat, 'Cette ville a déjà ce propriétaire.');
    var e = cloner(etat);
    if (p === null) delete e.villes[params.cle]; else e.villes[params.cle] = p;
    journaliser(e, p, 'ville', 'Ville ' + params.cle + ' : ' + (avant ? NOMS[avant] : 'neutre') + ' → ' + (p ? NOMS[p] : 'neutre') + '.');
    return reussite(e, { avant: avant });
  }

  /**
   * Pioche une carte Campement, jouée aussitôt (elle va dans la défausse Campement ; la défausse est
   * remélangée quand la pioche est vide). params : { joueur, numero (facultatif), forcer }.
   * Avec `numero`, le bataillon est marqué « a déjà pioché » ; avertissement bloquant « deja-campement »
   * s'il l'était déjà. L'effet de la carte se résout à la main (voir `paquet`). Renvoie aussi { carte }.
   */
  function piocherCampement(etat, params, env) {
    params = params || {};
    if (!aleaPresent(env)) return refus(etat, 'Aléa manquant.');
    var j = params.joueur;
    if (!estJoueur(j)) return refus(etat, 'Joueur inconnu.');
    var avecBataillon = params.numero !== undefined && params.numero !== null;
    var b = avecBataillon ? bataillon(etat, j, params.numero) : null;
    if (avecBataillon && !b) return refus(etat, 'Bataillon inconnu.');
    if (b && b.case === null) return refus(etat, 'Ce bataillon est en réserve.');
    var av = [];
    if (b && b.campement) av.push(avert('deja-campement', 'Ce bataillon a déjà pioché une carte Campement.'));
    if (aBloquant(av) && !params.forcer) return refus(etat, RAISON_A_FORCER, av);
    var P = paquets();
    reprendreAlea(etat, env);
    var r = P.tirer(etat.paquets.campement, 1, env.alea);
    if (!r.cartes.length) { reprendreAlea(etat, env); return refus(etat, 'Il n’y a plus de carte Campement.', av); }
    var e = cloner(etat), id = r.cartes[0];
    e.paquets.campement = P.mettreEnDefausse(r.paquet, id).paquet;
    memoriserAlea(e, env);
    if (b) e.bataillons[j][params.numero - 1].campement = true;
    var carte = cartes().trouver(id);
    journaliser(e, j, 'campement', NOMS[j] + (b ? ' (bataillon ' + b.numero + ')' : '') + ' pioche la carte Campement ' + carte.numero +
      ' (' + carte.signe + ') : ' + carte.texte + (r.remelanges ? ' (défausse Campement remélangée)' : ''));
    return reussite(e, { carte: carte }, av);
  }

  /**
   * Pioche une carte Événement : elle attend dans paquets.evenements.main que sa tuile soit posée.
   * Les tuiles sont uniques : la défausse n'est pas remélangée. params : { joueur }. Renvoie aussi { carte }.
   */
  function piocherEvenement(etat, params, env) {
    params = params || {};
    var j = estJoueur(params.joueur) ? params.joueur : null;
    var P = paquets();
    var r = P.tirer(etat.paquets.evenements, 1, null, { remelanger: false });
    if (!r.cartes.length) return refus(etat, 'Il n’y a plus de carte Événement.');
    var e = cloner(etat), id = r.cartes[0];
    e.paquets.evenements = P.ajouterEnMain(r.paquet, id).paquet;
    var carte = cartes().trouver(id);
    journaliser(e, j, 'evenement', (j ? NOMS[j] + ' pioche' : 'Pioche de') + ' l’événement ' + id + ' « ' + carte.nom + ' » (provisoire) : ' + carte.texte);
    return reussite(e, { carte: carte });
  }

  /**
   * Pose une tuile d'événement par-dessus une case, par la fonction du plateau injectée
   * (env.plateau.poserEvenement, qui reste seule juge de la condition de pose).
   * params : { evenement, cle, joueur (facultatif), forcer }.
   * Avertissements bloquants : « pas-piochee » (la carte n'est pas en attente de pose),
   * « occupee » (un bataillon est sur la case). Un refus du plateau ne se force pas.
   * Les alertes du plateau (coupure, ville isolée) reviennent en avertissements non bloquants (code « plateau »).
   */
  function poserEvenement(etat, params, env) {
    params = params || {};
    if (!plateauPresent(env)) return refus(etat, 'Fonctions du plateau manquantes.');
    var id = params.evenement;
    if (typeof id !== 'string' || idsEvenements().indexOf(id) < 0) return refus(etat, 'Événement inconnu.');
    if (typeof params.cle !== 'string' || !MOTIF_CLE.test(params.cle)) return refus(etat, 'Clé de case invalide.');
    var av = [];
    if (etat.paquets.evenements.main.indexOf(id) < 0) av.push(avert('pas-piochee', 'La carte de l’événement ' + id + ' n’a pas été piochée (ou sa tuile est déjà posée).'));
    if (occupants(etat, params.cle).length) av.push(avert('occupee', 'Un bataillon occupe la case ' + params.cle + '.'));
    if (aBloquant(av) && !params.forcer) return refus(etat, RAISON_A_FORCER, av);
    // Les cases occupées sont aussi transmises au plateau (option admise par le lot A), sauf si on force.
    var occupees = [];
    if (!params.forcer) {
      JOUEURS.forEach(function (jo) { etat.bataillons[jo].forEach(function (b) { if (b.case !== null) occupees.push(b.case); }); });
    }
    var r = env.plateau.poserEvenement(cloner(etat.plateau), id, params.cle, { occupees: occupees });
    if (!r || !r.ok || !estObjet(r.plateau)) return refus(etat, (r && typeof r.raison === 'string' && r.raison) || 'Le plateau refuse cette pose.', av);
    var e = cloner(etat);
    e.plateau = cloner(r.plateau);
    // La carte quitte la pioche ou l'attente et va dans la défausse Événement.
    var pe = e.paquets.evenements;
    ['pioche', 'main', 'defausse'].forEach(function (zone) {
      pe[zone] = pe[zone].filter(function (c) { return c !== id; });
    });
    pe.defausse.push(id);
    // Alertes du plateau (coupure, ville isolée) : transmises, jamais bloquantes.
    var alertes = Array.isArray(r.alertes) ? r.alertes : (Array.isArray(r.avertissements) ? r.avertissements : null);
    if (alertes) {
      alertes.slice(0, 10).forEach(function (a) {
        av.push(avert('plateau', texteSaisi(a && a.message !== undefined ? a.message : a, LIMITES.note), false));
      });
    }
    var j = estJoueur(params.joueur) ? params.joueur : null;
    journaliser(e, j, 'evenement', 'Tuile d’événement ' + id + ' « ' + cartes().trouver(id).nom + ' » posée en ' + params.cle +
      (params.forcer && aBloquant(av) ? ' (forcé)' : '') + '.');
    return reussite(e, {}, av);
  }

  /**
   * Défausse sans la poser une carte Événement en attente (aucune case ne convient, ou les joueurs y renoncent) :
   * la carte quitte paquets.evenements.main pour la défausse Événement ; la tuile reste en réserve.
   * params : { evenement, joueur (facultatif) }.
   */
  function defausserEvenement(etat, params) {
    params = params || {};
    var id = params.evenement;
    if (typeof id !== 'string' || idsEvenements().indexOf(id) < 0) return refus(etat, 'Événement inconnu.');
    if (etat.paquets.evenements.main.indexOf(id) < 0) return refus(etat, 'La carte de l’événement ' + id + ' n’est pas en attente de pose.');
    var e = cloner(etat), pe = e.paquets.evenements;
    pe.main = pe.main.filter(function (c) { return c !== id; });
    pe.defausse.push(id);
    var j = estJoueur(params.joueur) ? params.joueur : null;
    journaliser(e, j, 'evenement', 'Carte Événement ' + id + ' « ' + cartes().trouver(id).nom + ' » défaussée sans être posée : la tuile reste en réserve.');
    return reussite(e);
  }

  // ---------------------------------------------------------------------------------------------
  // Troupes provisoires modifiables
  // ---------------------------------------------------------------------------------------------

  /**
   * Modifie la définition d'une Troupe de la partie. params : { id, nom, moral, puissance, des } (champs facultatifs).
   * Refusé si le nouveau moral ne dépasse plus les dégâts déjà posés sur un exemplaire en jeu.
   */
  function modifierTroupe(etat, params) {
    params = params || {};
    if (typeof params.id !== 'string' || !possede(etat.troupes, params.id)) return refus(etat, 'Troupe inconnue.');
    var def = cloner(etat.troupes[params.id]);
    ['nom', 'moral', 'puissance', 'des'].forEach(function (k) { if (params[k] !== undefined) def[k] = params[k]; });
    try { def = validerTroupe(def, 'Troupe ' + params.id); } catch (x) {
      if (x instanceof ErreurValidation) return refus(etat, x.message);
      throw x;
    }
    var bloque = JOUEURS.some(function (j) {
      return etat.bataillons[j].some(function (b) {
        return b.troupes.some(function (t) { return etat.exemplaires[t.carte].modele === params.id && t.degats >= def.moral; });
      });
    });
    if (bloque) return refus(etat, 'Un exemplaire en jeu a déjà autant de dégâts que ce moral : retirez d’abord des marqueurs.');
    var e = cloner(etat);
    e.troupes[params.id] = def;
    journaliser(e, null, 'troupe', 'Troupe ' + params.id + ' modifiée : ' + def.nom + ', moral ' + def.moral + ', Puissance ' + def.puissance + ', ' + def.des + ' dé(s).');
    return reussite(e);
  }

  // ---------------------------------------------------------------------------------------------
  // Annuler / rétablir : historique pur (jamais enregistré dans le fichier)
  // ---------------------------------------------------------------------------------------------

  var historique = {
    /** Historique neuf autour d'un état. */
    creer: function (etat) { return { passe: [], present: etat, futur: [] }; },
    /** Enregistre un nouvel état (résultat d'une opération réussie) ; vide la liste des états à rétablir. */
    pousser: function (h, etat) {
      var max = (h.present && h.present.reglages && h.present.reglages.tailleHistorique) || cartes().REGLAGES.tailleHistorique;
      var passe = h.passe.concat([h.present]);
      if (passe.length > max) passe = passe.slice(passe.length - max);
      return { passe: passe, present: etat, futur: [] };
    },
    peutAnnuler: function (h) { return h.passe.length > 0; },
    peutRetablir: function (h) { return h.futur.length > 0; },
    /** Revient à l'état précédent (renvoie l'historique inchangé s'il n'y en a pas). */
    annuler: function (h) {
      if (!h.passe.length) return h;
      return { passe: h.passe.slice(0, -1), present: h.passe[h.passe.length - 1], futur: [h.present].concat(h.futur) };
    },
    /** Rétablit l'état annulé (renvoie l'historique inchangé s'il n'y en a pas). */
    retablir: function (h) {
      if (!h.futur.length) return h;
      return { passe: h.passe.concat([h.present]), present: h.futur[0], futur: h.futur.slice(1) };
    }
  };

  AT.partie = {
    FORMAT: FORMAT,
    VERSION: VERSION,
    JOUEURS: JOUEURS.slice(),
    LIMITES: LIMITES,
    BORNES_REGLAGES: BORNES_REGLAGES,
    OPERATIONS_PAQUET: Object.keys(OPERATIONS_PAQUET),
    get REGLAGES() { return cartes().REGLAGES; },
    // création, fichier
    creer: creer,
    serialiser: serialiser,
    charger: charger,
    valider: valider,
    // lecture
    bataillon: bataillon,
    occupants: occupants,
    troupeDe: troupeDe,
    moralRestant: moralRestant,
    gagnants: gagnants,
    // opérations
    modifierGloire: modifierGloire,
    lancerDes: lancerDes,
    ajusterActions: ajusterActions,
    finDeTour: finDeTour,
    noter: noter,
    paquet: paquet,
    former: former, avisPlateau: avisPlateau, villesDeDeploiement: villesDeDeploiement,
    renforcer: renforcer,
    deplacer: deplacer,
    marquerDegats: marquerDegats,
    eliminerBataillon: eliminerBataillon,
    capturerVille: capturerVille,
    piocherCampement: piocherCampement,
    piocherEvenement: piocherEvenement,
    poserEvenement: poserEvenement,
    defausserEvenement: defausserEvenement,
    modifierTroupe: modifierTroupe,
    // annuler / rétablir
    historique: historique
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.partie;
})();
