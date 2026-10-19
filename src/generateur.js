/*
 * generateur.js : plateau aléatoire (sous-agent 8, adapté aux règles de la version 2).
 *
 * Partie calcul (generer) : fonction pure, sans DOM, testée sous Node.
 * Partie interface (ouvrir) : remplit la boîte de dialogue commune PM.dialogue.
 *
 * Règles appliquées (docs/18 à docs/20, docs/36 ; catalogues « centrales ouvertes » branchés en docs/46) :
 *  - grille pleine du format du document (4×4 ou 5×5) ;
 *  - tuiles tirées dans la bibliothèque du document (modèles complets), selon le gabarit attendu à chaque position ; un modèle peut
 *    servir plusieurs fois (poses illimitées) mais le tirage favorise la variété : poids du modèle = son champ `poids`, à défaut son nombre
 *    d'exemplaires (0 exemplaire = jamais tiré ; le stock imprimé peut dépasser le poids, docs/47), divisé par (1 + 0,5 × usages) à chaque réutilisation sur le plateau en cours ; rotation de la place pour les
 *    bords et les coins ;
 *  - CASES ÉGALES ENTRE MOITIÉS (docs/18, réponse 2) : autant de cases dans la moitié verte que dans la moitié rouge (rangée neutre du
 *    5×5 à part), par échanges de tuiles du même gabarit, sinon par remplacement au poids (equilibrerMoities) ; chemins et tuiles
 *    restent libres de part et d'autre (aucune pose symétrique) ; impossible = rejet `cases_moities` ;
 *  - ORIENTATION DES CENTRALES SELON LES PORTS (4×4, orienter4x4) : plus petit nombre de ports d'une jonction maximal, puis jonctions
 *    à 3 ports ;
 *  - 5×5 (catalogue « P » de docs/66 ; docs/53 § 3) : composition PAR QUOTAS selon les poids (4 coins, 12 bords, 9 centrales parmi les
 *    14 du stock : 1 LC1, 4 LC3, 1 LC4, 1 LC5, 1 LC6, 1 LC7, 2 LC11, 3 LC12), puis 8 VILLES AUX POSITIONS PAR DÉFAUT (docs/18, consigne du
 *    2026-10-19 : PM.graphe.MOTIF_VILLES_5X5) : le générateur CHOISIT LA PLACE des centrales tirées puis leur orientation
 *    (rechercherPose5x5 : aucune case porteuse ne dessert deux villes, chaque ville reçoit 3 ports et chaque jonction 2, cases égales entre
 *    moitiés) ; jusqu'à FEUILLES_PAR_ESSAI poses par composition, toutes jugées ; écart de 3 cases entre villes partout (evaluer) ;
 *  - 4×4 : 7 villes ; par défaut (« jonctions variées », docs/18 réponse 3 de 2026-10-18) les 2 campements forment l'une des 12 paires
 *    équilibrées (une en j = 1 et une en j = 3, ou les deux en j = 2 : cases égales entre moitiés) ; option décochée : rangée centrale
 *    seulement (3 paires, aucun « 5 contre 2 », docs/22) ;
 *  - villes non traversables (règle du jeu) ;
 *  - REJETS : validerPlateau avec erreur, graphe non connexe, camp sans case d'apparition, deux villes à moins de 3 cases (rejet ; jamais
 *    produit en 4×4, docs/18), ville inaccessible, plateau très déséquilibré (majorité « 5 contre 2 » en 4×4, « 6 contre 2 » en 5×5, écart >
 *    SEUIL_BLOCAGE_ECART), écart > 2 à un rang de 1 à N (N = 7 villes en 4×4, 8 en 5×5), première ville à des distances différentes, cases
 *    inégales entre moitiés ; 5×5 en plus : jonction à moins de 2 ports, ville à moins de 3 ports (ou aucune pose pour les villes par défaut),
 *    plus de 5 % de cases à 2 connexions ou moins (PM.graphe.connexions), « 5 contre 3 » (alerte de l'éditeur), S >= 5 (docs/36, docs/53) ;
 *  - 5×5 : PARTAGE SYMÉTRIQUE préféré (docs/18, décision 2 du 2026-10-19 : préférence, jamais un rejet) ; un partage non symétrique n'est
 *    rendu que si aucun candidat valide n'est symétrique ;
 *  - classement par S = Σ |D1(k) − D2(k)| sur les N rangs, puis pénalité secondaire (raccords morts au-delà de 2, jonctions à moins
 *    de 2 ports, cases d'apparition à moins de 2 sorties, 5×5 sans ville équidistante) ; bons candidats : S ≤ Smin + tolérance ;
 *  - PRÉFÉRENCES (jamais des rejets) : AFFINAGE_MAX bons candidats tirés au hasard sont affinés (affiner : rotations des centrales,
 *    villes fixes, sans perdre de port utile ni sortir des seuils) pour le RYTHME (plus longue suite de cases sans zone d'intérêt,
 *    cible 3, PM.graphe.rythme) puis l'ÉQUILIBRE DES ACCÈS au centre (PM.graphe.accesCentre) ; le plateau rendu est le meilleur
 *    d'entre eux (chaîne au-delà de 3, écart d'accès au-delà de 1, chaîne), égalités au hasard ; 5×5 (docs/53 § 3) : finalistes tirés
 *    parmi les candidats de chaîne proche de la plus courte, puis préférences dans l'ordre chaîne, raccords morts, points
 *    d'articulation, S ;
 *  - AIDE « PLACER LES VILLES » (meilleurPlacementVilles, placerVilles) : le meilleur placement admissible d'un plateau posé.
 *
 * Graine : texte ou nombre ; même graine + même bibliothèque + mêmes options = même plateau.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.graphe && typeof require === 'function') require('./graphe.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele, GR = PM.graphe;

  // Constantes du critère d'équilibre : celles de PM.graphe (une seule définition)
  var NB_VILLES = GR.nbVilles('4x4'); // tirage des villes du 4×4 (tirerVilles) ; le 5×5 pose ses 8 villes aux positions par défaut
  var SEUIL_ECART = GR.SEUIL_ECART;  // écart toléré à chaque rang (doc 16, b)
  var CANDIDATS_DEFAUT = 200;
  var CANDIDATS_MAX = 1000;       // borne des candidats demandés (au-delà : le calcul synchrone gèlerait l'interface)
  var ESSAIS_MAX_BORNE = 50000;   // borne des essais demandés
  var ECHECS_STRUCTURELS_MAX = 25; // abandon après tant d'essais consécutifs rejetés pour une cause structurelle (manque de ports, cases inégales entre moitiés)
  var ESSAIS_MIN_5X5 = 40;          // 5×5 : essais au moins quand l'appelant ne fixe pas essaisMax (même avec 1 candidat demandé)
  var CANDIDATS_DEFAUT_5X5 = 60;  // 5×5 : candidats par défaut (chaque essai coûte une recherche de pose et jusqu’à 20 évaluations ; 60 : chaîne ≤ 3 presque toujours, < 1 s par plateau)
  var FACTEUR_ESSAIS = 5;         // essais maximaux = candidats × 5
  var TOLERANCE_DEFAUT = 1;       // bons candidats : S ≤ Smin + tolérance (1 : garde de l'aléa)
  var RACCORDS_TOLERES = 2;       // raccords morts tolérés sans pénalité
  var LIBELLES_GABARIT = { centrale: 'centrale', bord: 'bord', coin: 'coin' };

  /* ------------------------------------------------------------------ */
  /* Hasard reproductible                                                */
  /* ------------------------------------------------------------------ */

  /** Hachage FNV-1a 32 bits d'un texte (graine texte → entier). */
  function hacher(texte) {
    var h = 0x811c9dc5;
    for (var k = 0; k < texte.length; k++) {
      h ^= texte.charCodeAt(k);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** Générateur pseudo-aléatoire mulberry32 (même suite pour le même entier). */
  function mulberry32(graine) {
    var a = graine >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Nouvelle graine (seul usage de Math.random) : 6 chiffres. */
  function nouvelleGraine() {
    return String(100000 + Math.floor(Math.random() * 900000));
  }

  function entier(rng, n) { return Math.floor(rng() * n); }

  function melanger(t, rng) {
    t = t.slice();
    for (var i = t.length - 1; i > 0; i--) {
      var j = entier(rng, i + 1), x = t[i];
      t[i] = t[j]; t[j] = x;
    }
    return t;
  }

  /* ------------------------------------------------------------------ */
  /* Jonctions et villes                                                 */
  /* ------------------------------------------------------------------ */

  /** Jonctions intérieures d'un format, rangée par rangée (j puis i) : cet ordre fixe le tirage pour une graine. */
  function jonctionsInterieures(F) {
    var res = [];
    if (F.nbCotes === 6) return F.sieges.map(function (sg) { return { i: sg.id, j: 0 }; }); // hexagonal : les 24 sièges
    for (var j = 1; j < F.GRILLE.lignes; j++) for (var i = 1; i < F.GRILLE.colonnes; i++) res.push({ i: i, j: j });
    return res;
  }

  /** Villes du 5×5 en « 2-2-2-2 » (docs/18, docs/62) : définition unique dans PM.graphe (groupes de rangées et nombre de villes par groupe). */
  var REPARTITION_VILLES_5X5 = GR.REPARTITION_VILLES_5X5;

  function combinaisons(liste, k) {
    var res = [];
    (function rec(debut, choix) {
      if (choix.length === k) { res.push(choix.slice()); return; }
      for (var x = debut; x < liste.length; x++) { choix.push(liste[x]); rec(x + 1, choix); choix.pop(); }
    })(0, []);
    return res;
  }

  var CACHE_PLACEMENTS = null;
  /** Gèle récursivement un objet (le cache partagé ne doit pas être modifié par un appelant). */
  function geler(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { geler(o[k]); });
    }
    return o;
  }
  /**
   * Les placements de 8 villes en « 2-2-2-2 » du 5×5 : 1 296 tableaux de 8 jonctions {i, j} (ordre de lecture), calculés une fois
   * et gelés (le même objet est rendu à chaque appel : ni copie ni modification possible).
   * 2 villes parmi les 4 jonctions de chaque rangée j = 1 à 4. Produit GÉNÉRIQUE des groupes de REPARTITION_VILLES_5X5 (quel que soit
   * leur nombre : docs/62 § 4, l'ancien produit ne combinait que 3 groupes).
   */
  function placementsVilles5x5() {
    if (CACHE_PLACEMENTS) return CACHE_PLACEMENTS;
    var F = PM.geometrie.format('5x5'), toutes = jonctionsInterieures(F);
    var groupes = REPARTITION_VILLES_5X5.map(function (g) {
      var liste = toutes.filter(function (jn) { return g.rangees.indexOf(jn.j) >= 0; });
      return combinaisons(liste, g.nb);
    });
    var res = groupes.reduce(function (acc, liste) {
      var suite = [];
      acc.forEach(function (a) { liste.forEach(function (b) { suite.push(a.concat(b)); }); });
      return suite;
    }, [[]]);
    CACHE_PLACEMENTS = geler(res);
    return CACHE_PLACEMENTS;
  }

  /**
   * Jonctions-cases (les jonctions sans ville) que le générateur peut tirer, propres à chaque format.
   *  - sans « jonctions variées » (option décochée, 4×4) : les 3 paires de la rangée centrale (j = 2), qui ne donnent jamais « 5 contre 2 » ;
   *  - jonctions variées (4×4, par défaut) : les paires qui gardent autant de jonctions-cases du côté vert (j = 1) que du côté rouge (j = 3),
   *    pour des cases égales entre moitiés (docs/18) : une en j = 1 et une en j = 3 (9 paires), ou les deux en j = 2 (3 paires) ;
   *    aucune paire d'une même rangée extérieure (règle d'avant, toujours vraie) ;
   *  - 5×5 (docs/18, « 2-2-2-2 ») : les 1 296 ensembles de 8 jonctions-cases, complémentaires des placements de 8 villes ;
   *    l'option « variées » n'a pas de sens en 5×5 (le placement est déjà choisi parmi tous les 2-2-2-2 admissibles) : même liste.
   * Chaque élément est une liste de {i, j} dans l'ordre de lecture (2 jonctions en 4×4, 8 en 5×5).
   */
  function pairesJonctionsCases(F, variees) {
    if (F.id === '5x5') {
      var toutes = jonctionsInterieures(F);
      return placementsVilles5x5().map(function (villes) {
        return toutes.filter(function (jn) { return !villes.some(function (v) { return v.i === jn.i && v.j === jn.j; }); });
      });
    }
    if (F.id !== '4x4') return null;
    var jonctions = jonctionsInterieures(F), paires = [];
    for (var a = 0; a < jonctions.length; a++) {
      for (var b = a + 1; b < jonctions.length; b++) {
        var p = jonctions[a], q = jonctions[b];
        var memeRangee = p.j === q.j;
        var cote = function (x) { return x.j === 1 ? 1 : (x.j === F.GRILLE.lignes - 1 ? -1 : 0); };
        var equilibree = cote(p) + cote(q) === 0;
        if (variees ? (equilibree && !(memeRangee && (p.j === 1 || p.j === F.GRILLE.lignes - 1))) : (memeRangee && p.j === 2)) paires.push([p, q]);
      }
    }
    return paires;
  }

  /**
   * 4×4 : 7 villes (ordre de lecture du plateau) : si `paires` est donné, une paire est tirée comme jonctions-cases et
   * les 7 autres jonctions portent une ville ; sinon 7 jonctions tirées au hasard. Renvoie la liste des jetons.
   */
  function tirerVilles(jonctions, rng, paires) {
    var choisies;
    if (paires && paires.length) {
      var paire = paires[entier(rng, paires.length)];
      choisies = jonctions.filter(function (jn) { return !paire.some(function (c) { return c.i === jn.i && c.j === jn.j; }); });
    } else {
      choisies = melanger(jonctions, rng).slice(0, NB_VILLES);
    }
    return choisies.sort(function (a, b) { return (a.j - b.j) || (a.i - b.i); })
      .map(function (jn) { return { i: jn.i, j: jn.j, type: 'capture' }; });
  }

  /* ------------------------------------------------------------------ */
  /* Évaluation d'une configuration                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Adaptateur du critère d'équilibre : lit les champs calculés par PM.graphe.equilibre (aucun second calcul).
   * Renvoie { S, ecartMax (rangs 1 à N), premiereEgale, cinqContreDeux (majorité bloquante du format), cinqContreTrois (5×5),
   * partageSymetrique, tresDesequilibre, villeInaccessible, partage, D }. S et ecartMax valent null si une ville est inaccessible.
   */
  function critere(e) {
    return {
      S: e.S, ecartMax: e.ecartMax7,
      premiereEgale: e.premiereEgale === true,
      cinqContreDeux: e.cinqContreDeux === true,
      cinqContreTrois: e.cinqContreTrois === true,
      partageSymetrique: e.partageSymetrique === true,
      tresDesequilibre: e.tresDesequilibre === true,
      villeInaccessible: e.S === null,
      partage: { 1: e.partage[1], 2: e.partage[2], egalite: e.partage.egalite },
      D: { 1: e.D[1].slice(), 2: e.D[2].slice() }
    };
  }

  /** Rejet par S propre à chaque format (docs/28 § 6) : en 5×5, S >= PM.graphe.SEUIL_S (5, seuil de rejet, distinct du seuil d'alerte par format de PM.graphe.seuilS) rejette le candidat ; en 4×4, S n'est qu'un classement. */
  var REJET_S = { '4x4': false, '5x5': true, 'hex19': true };
  /** Seuil de rejet par S en hexagonal (docs/72, arbitrage de l’orchestrateur : 3, comme le recommande docs/80 ; sans effet pratique, S valant 0 ou 1). */
  var SEUIL_REJET_S_HEX = 3;

  /**
   * Cause de rejet d'une mesure d'équilibre (une seule chaîne de filtres, pour evaluer, le chemin 5×5 et les outils de mesure) :
   * m = { accessible, cinq (majorité bloquante du format : « 5 contre 2 » en 4×4, « 6 contre 2 » en 5×5), trois (5×5 : « 5 contre 3 »),
   * ecartMax (rangs 1 à N), premiereEgale, S } ; renvoie une clé de `rejets` ou null (accepté).
   * Ordre : ville inaccessible (S non mesurable : jamais comparé à un seuil), plateau très déséquilibré (écart > SEUIL_BLOCAGE_ECART,
   * ou la majorité bloquante si elle l'est), majorité seule, écart > SEUIL_ECART, « 5 contre 3 » (5×5 : alerte de l'éditeur, que le
   * générateur ne produit pas), première ville inégale, puis S >= SEUIL_S si le format le rejette. Le partage non symétrique n'est
   * jamais un rejet (préférence, docs/18).
   */
  function causeRejet(m, formatId) {
    if (!m.accessible) return 'ville_inaccessible';
    if ((GR.CINQ_CONTRE_DEUX_BLOQUANT && m.cinq) || m.ecartMax > GR.SEUIL_BLOCAGE_ECART) return 'desequilibre';
    if (m.cinq) return 'cinq_contre_deux';
    if (m.ecartMax > SEUIL_ECART) return 'ecart';
    if (m.trois) return 'cinq_contre_trois';
    if (!m.premiereEgale) return 'premiere_ville';
    if (REJET_S[formatId] && m.S >= (formatId === 'hex19' ? SEUIL_REJET_S_HEX : GR.SEUIL_S)) return 'score_s'; // hexagonal : S >= 3
    return null;
  }

  /**
   * Évalue un plateau complet (tuiles et villes posées). Renvoie { ok, cause, crit, sortiesMin, graphe, connexions (5×5) }.
   * 5×5 en plus (docs/53 § 3) : jonction à moins de 2 ports, ville à moins de 3 ports, plus de 5 % de cases à 2 connexions ou moins
   * (PM.graphe.connexions) sont des rejets.
   */
  function evaluer(docCandidat) {
    var g = GR.construire(docCandidat, { villesTraversables: false });
    var res = { ok: false, cause: null, graphe: g };
    if (!GR.connexe(g) || !g.apparitions[1].length || !g.apparitions[2].length) { res.cause = 'connexite'; return res; }
    if (GR.villesProches(g).length) { res.cause = 'villes_proches'; return res; }
    if (M.formatDuDocument(docCandidat).id !== '4x4') { // 5×5 (docs/53 § 3) et hexagonal (docs/77) : ports des jonctions et des villes, puis cases à 2 connexions
      if (g.jonctions.some(function (jn) { return jn.ports < GR.PORTS_JONCTION_MIN; })) { res.cause = 'jonction_ports'; return res; }
      if (g.jonctions.some(function (jn) { return jn.type === 'ville' && jn.ports < GR.PORTS_VILLE_MIN; })) { res.cause = 'villes_ports'; return res; }
      res.connexions = GR.connexions(docCandidat, g);
      if (!res.connexions.conforme) { res.cause = 'connexions'; return res; }
    }
    res.crit = critere(GR.equilibre(docCandidat, { graphe: g }));
    // sorties de chaque case d'apparition
    res.sortiesMin = Infinity;
    [1, 2].forEach(function (pj) {
      g.apparitions[pj].forEach(function (id) { res.sortiesMin = Math.min(res.sortiesMin, g.voisins.get(id).size); });
    });
    res.cause = causeRejet({
      accessible: !res.crit.villeInaccessible, cinq: res.crit.cinqContreDeux, trois: res.crit.cinqContreTrois, ecartMax: res.crit.ecartMax,
      premiereEgale: res.crit.premiereEgale, S: res.crit.S
    }, M.formatDuDocument(docCandidat).id);
    res.ok = res.cause === null;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Bibliothèque et tirage des tuiles                                   */
  /* ------------------------------------------------------------------ */

  /** Force de la pénalité de répétition (voir facteurRepetition). */
  var PENALITE_REPETITION = 0.5;

  /** Pénalité de répétition : le poids d'un modèle déjà posé u fois sur le plateau en cours est divisé par (1 + 0,5·u). */
  function facteurRepetition(usages) { return 1 / (1 + PENALITE_REPETITION * usages); }

  /**
   * Modèles tirables par gabarit : [{id, poids, stock}], modèles complets seulement, ordre du document (stock : exemplaires, plafond
   * de B1 et des autres bords dans la composition 5×5).
   * Le poids est le champ `poids` du modèle s'il existe, sinon son nombre d'exemplaires (PM.modele.poidsTirage) ; un modèle à
   * 0 exemplaire n'est jamais tiré, ni un modèle marqué `horsTirage: true`. Le stock à imprimer (exemplaires) peut ainsi dépasser le poids sans changer les plateaux tirés.
   */
  function modelesParGabarit(doc, F) {
    var res = { centrale: [], bord: [], coin: [] };
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) {
      if (!m || !Object.prototype.hasOwnProperty.call(res, m.gabarit) || !M.validerModele(m, F).complet) return;
      if (m.horsTirage === true) return; // pose à la main seulement (LE1 « Étoile » du 5×5) : jamais tirée
      if (M.exemplairesValides(m) > 0) res[m.gabarit].push({ id: m.id, poids: M.poidsTirage(m), stock: M.exemplairesValides(m) });
    });
    return res;
  }

  /** Cellules de la grille avec leur gabarit attendu : [{col, lig, gabarit}]. */
  function cellulesDuFormat(F) {
    var res = [];
    if (F.nbCotes === 6) { // hexagonal : les 19 cellules (col, lig) du format, pas un rectangle
      F.cellules.forEach(function (c) { res.push({ col: c.col, lig: c.lig, gabarit: M.gabaritCellule(c.col, c.lig, F) }); });
      return res;
    }
    for (var lig = 0; lig < F.GRILLE.lignes; lig++) {
      for (var col = 0; col < F.GRILLE.colonnes; col++) res.push({ col: col, lig: lig, gabarit: M.gabaritCellule(col, lig, F) });
    }
    return res;
  }

  /** Un modèle tiré parmi `modeles` selon poids × facteurRepetition(usages du modèle). */
  function tirerModele(modeles, usages, rng) {
    var poids = modeles.map(function (m) { return m.poids * facteurRepetition(usages[m.id] || 0); });
    var total = poids.reduce(function (a, b) { return a + b; }, 0), x = rng() * total;
    for (var k = 0; k < modeles.length; k++) {
      x -= poids[k];
      if (x < 0) return modeles[k].id;
    }
    return modeles[modeles.length - 1].id; // arrondi flottant : dernier modèle
  }

  /** Tuiles d'un candidat : [{modeleId, col, lig, rot}] (tirage avec remise, cellule par cellule, variété favorisée). */
  function tirerTuiles(modeles, cellules, F, rng) {
    var usages = {};
    return cellules.map(function (c) {
      var id = tirerModele(modeles[c.gabarit], usages, rng);
      usages[id] = (usages[id] || 0) + 1;
      var rot = M.rotationDeduite(c.col, c.lig, c.gabarit, F);
      return { modeleId: id, col: c.col, lig: c.lig, rot: rot === null ? entier(rng, 4) : rot };
    });
  }

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------------ */
  /* Cases par moitié (docs/18, réponse 2 sur la révision « centrales ouvertes ») */
  /* ------------------------------------------------------------------ */

  /** Poids d'une cellule dans l'écart des moitiés : +1 camp vert, −1 camp rouge, 0 rangée neutre (5×5). */
  function poidsMoitie(F, col, lig) { var c = F.campCellule(col, lig); return c === 'vert' ? 1 : (c === 'rouge' ? -1 : 0); }

  /** Écart de cases des tuiles entre la moitié verte et la moitié rouge (rangée neutre à part) : Σ vert − Σ rouge. */
  function ecartMoities(tuiles, F, nbCases) {
    return tuiles.reduce(function (s, t) { return s + poidsMoitie(F, t.col, t.lig) * nbCases[t.modeleId]; }, 0);
  }

  /** Poids de tirage (exemplaires) des modèles tirables : { id: poids }. */
  function poidsTirables(modelesDispo) {
    var res = {};
    Object.keys(modelesDispo).forEach(function (g) { modelesDispo[g].forEach(function (m) { res[m.id] = m.poids; }); });
    return res;
  }

  /** Nombre de cases de chaque modèle du document : { id: n }. */
  function casesParModele(doc) {
    var res = {};
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) { if (m && typeof m.id === 'string') res[m.id] = Array.isArray(m.cases) ? m.cases.length : 0; });
    return res;
  }

  /**
   * Égalise les cases des tuiles entre la moitié verte et la moitié rouge (décision 2 : mêmes nombres de cases, chemins et tuiles
   * libres de part et d'autre, aucune pose symétrique imposée). Modifie `tuiles` (même ordre que `cellules`) :
   *  1. échanges de modèles entre deux cellules du même gabarit de moitiés différentes (rangée neutre comprise), qui gardent la
   *     composition du plateau ; on prend un échange qui réduit le plus l'écart (au hasard parmi les meilleurs) ;
   *  2. à défaut, remplacement du modèle d'une cellule par un autre du même gabarit, parmi `remplacants(tuile, k)` (ids) ; parmi
   *     les remplacements qui réduisent le plus l'écart, tirage au poids poids(id) × facteurRepetition(usages sur le plateau)
   *     (`poids` : { id: exemplaires } ; 1 si absent).
   * Renvoie vrai si l'écart est nul. La rotation reste celle de la cellule (bords et coins : rotation de la place).
   */
  function equilibrerMoities(tuiles, cellules, F, nbCases, rng, remplacants, poids) {
    var ecart = ecartMoities(tuiles, F, nbCases), w = tuiles.map(function (t) { return poidsMoitie(F, t.col, t.lig); });
    for (var tour = 0; tour < 12 && ecart !== 0; tour++) {
      var meilleurs = [], mieux = Math.abs(ecart), a, b;
      for (a = 0; a < tuiles.length; a++) {
        for (b = a + 1; b < tuiles.length; b++) {
          if (cellules[a].gabarit !== cellules[b].gabarit || w[a] === w[b]) continue;
          var ca = nbCases[tuiles[a].modeleId], cb = nbCases[tuiles[b].modeleId];
          if (ca === cb) continue;
          var e = Math.abs(ecart + (w[a] - w[b]) * (cb - ca));
          if (e < mieux) { mieux = e; meilleurs = [[a, b]]; } else if (e === mieux && e < Math.abs(ecart)) meilleurs.push([a, b]);
        }
      }
      if (meilleurs.length) {
        var p = meilleurs[entier(rng, meilleurs.length)], x = tuiles[p[0]].modeleId;
        tuiles[p[0]].modeleId = tuiles[p[1]].modeleId; tuiles[p[1]].modeleId = x;
        ecart = ecartMoities(tuiles, F, nbCases);
        continue;
      }
      if (!remplacants) break;
      var options = [], mini = Math.abs(ecart);
      tuiles.forEach(function (t, k) {
        if (!w[k]) return;
        remplacants(t, k).forEach(function (id) {
          var e2 = Math.abs(ecart + w[k] * (nbCases[id] - nbCases[t.modeleId]));
          if (e2 < mini) { mini = e2; options = [{ k: k, id: id }]; } else if (e2 === mini && e2 < Math.abs(ecart)) options.push({ k: k, id: id });
        });
      });
      if (!options.length) break;
      var usages = {};
      tuiles.forEach(function (t) { usages[t.modeleId] = (usages[t.modeleId] || 0) + 1; });
      var o = options[tirerModele(options.map(function (op, n) {
        return { id: n, poids: ((poids && poids[op.id]) || 1) * facteurRepetition(usages[op.id] || 0) };
      }), {}, rng)];
      tuiles[o.k].modeleId = o.id;
      ecart = ecartMoities(tuiles, F, nbCases);
    }
    return ecart === 0;
  }

  /* ------------------------------------------------------------------ */
  /* 4×4 : orientation des centrales selon les ports                     */
  /* ------------------------------------------------------------------ */

  /** Profils (profilModele) des modèles du document, par id. */
  function profilsDuDocument(doc) {
    var profils = {};
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) { if (m && typeof m.id === 'string' && Array.isArray(m.cases)) profils[m.id] = profilModele(m); });
    return profils;
  }

  /**
   * Orientation des centrales du 4×4 (docs/18, docs/45) : parmi les 4^4 combinaisons de rotations (une par empreinte de ports
   * distincte), celle qui maximise le plus petit nombre de ports d'une jonction, puis le nombre de jonctions à 3 ports au moins ;
   * égalités départagées au hasard, puis une rotation tirée parmi celles de même empreinte. Modifie la rotation des centrales de `tuiles`.
   */
  function orienter4x4(tuiles, cellules, F, profils, rng) {
    var nJ = (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1), base = [], centrales = [], x;
    for (x = 0; x < nJ; x++) base.push(0);
    cellules.forEach(function (c, k) {
      if (c.gabarit === 'centrale') { centrales.push({ k: k, opts: optionsCellule(c, [tuiles[k].modeleId], profils, F) }); return; }
      // bord ou coin : ports fixés par la rotation de la tuile (celle de sa place)
      var ports = F.tournerPorts(profils[tuiles[k].modeleId].ports, tuiles[k].rot);
      for (var q = 0; q < 4; q++) {
        if (!((ports >> q) & 1)) continue;
        var jn = M.jonctionDuCoin(c.col, c.lig, q);
        if (jn.i >= 1 && jn.i <= F.GRILLE.colonnes - 1 && jn.j >= 1 && jn.j <= F.GRILLE.lignes - 1) base[indexJonction(jn.i, jn.j, F)]++;
      }
    });
    var total = centrales.reduce(function (p, c) { return p * c.opts.length; }, 1), cle = null, choix = null, egaux = 0;
    for (var code = 0; code < total; code++) {
      var compte = base.slice(), r = code, sel = [];
      centrales.forEach(function (c) { var o = c.opts[r % c.opts.length]; r = Math.floor(r / c.opts.length); sel.push(o); o.jn.forEach(function (y) { compte[y]++; }); });
      var k2 = [Math.min.apply(null, compte), compte.filter(function (v) { return v >= MIN_PORTS_VILLE_5X5; }).length];
      var cmp = cle ? (k2[0] - cle[0]) || (k2[1] - cle[1]) : 1;
      if (cmp > 0) { cle = k2; choix = sel; egaux = 1; } else if (cmp === 0) { egaux++; if (rng() * egaux < 1) choix = sel; }
    }
    if (choix) centrales.forEach(function (c, n) { tuiles[c.k].rot = choix[n].rots[entier(rng, choix[n].rots.length)]; });
    return { minPorts: cle ? cle[0] : null, jonctions3: cle ? cle[1] : null };
  }

  /** Contexte 4×4 d'un document (bibliothèque tirable, cellules, profils, cases et poids des modèles). */
  function contexte4x4(doc, F, modelesDispo, cellules) {
    return { doc: doc, F: F, cellules: cellules, modelesDispo: modelesDispo, profils: profilsDuDocument(doc), nbCases: casesParModele(doc), poids: poidsTirables(modelesDispo) };
  }

  /** Contexte 4×4 d'un document pour tuilesOrientees4x4 hors de generer (outils de mesure, tests). */
  function contexteDocument4x4(doc) {
    var F = M.formatDuDocument(doc);
    return contexte4x4(doc, F, modelesParGabarit(doc, F), cellulesDuFormat(F));
  }

  /**
   * Tuiles d'un candidat 4×4 (appelable seule : outils de mesure, tests) : tirage avec remise (tirerTuiles), cases égales entre
   * moitiés (equilibrerMoities : échanges, sinon remplacement au poids par un autre modèle tirable du même gabarit), orientation
   * des centrales selon les ports (orienter4x4). Renvoie { tuiles, minPorts, jonctions3 } ou { cause: 'cases_moities' }.
   */
  function tuilesOrientees4x4(ctx, rng) {
    var tuiles = tirerTuiles(ctx.modelesDispo, ctx.cellules, ctx.F, rng);
    var remplacants = function (t, k) {
      return ctx.modelesDispo[ctx.cellules[k].gabarit].map(function (m) { return m.id; }).filter(function (id) { return id !== t.modeleId; });
    };
    if (!equilibrerMoities(tuiles, ctx.cellules, ctx.F, ctx.nbCases, rng, remplacants, ctx.poids)) return { cause: 'cases_moities' };
    var o = orienter4x4(tuiles, ctx.cellules, ctx.F, ctx.profils, rng);
    return { tuiles: tuiles, minPorts: o.minPorts, jonctions3: o.jonctions3 };
  }

  /* ------------------------------------------------------------------ */
  /* Rythme et accès au centre : affinage des meilleurs candidats         */
  /* ------------------------------------------------------------------ */

  var AFFINAGE_MAX = 6;    // bons candidats affinés (rotations des centrales) pour le rythme puis l'équilibre des accès
  var AFFINAGE_TOURS = 3;  // passes de montée au plus par candidat

  /**
   * Note de rythme d'un plateau posé (villes comprises), à minimiser terme à terme : [chaîne au-delà de CHAINE_CIBLE,
   * |écart des portes d'accès au centre|, chaîne, distance maximale à une zone d'intérêt] (PM.graphe.rythme, PM.graphe.accesCentre).
   */
  function noteRythme(doc) {
    var g = GR.construire(doc, { villesTraversables: false });
    var r = GR.rythme(doc, g), a = GR.accesCentre(doc, g, { sansFlot: true });
    return { cle: [Math.max(0, r.chaineMax - GR.CHAINE_CIBLE), Math.abs(a.ecart), r.chaineMax, r.distMax], chaine: r.chaineMax, distMax: r.distMax, acces: a, graphe: g };
  }

  function clePlusPetite(a, b) {
    for (var k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] < b[k];
    return false;
  }

  /** Nombre de points d'articulation (case, ville ou jonction dont le retrait coupe une ville) pour les deux joueurs, sur le graphe où les villes ne se traversent pas. */
  function pointsArticulation(g) {
    return GR.goulets(g, 1).articulations.length + GR.goulets(g, 2).articulations.length;
  }

  /** Pénalité secondaire d'un candidat (raccords morts hors murs voulus au-delà de 2, jonctions mal reliées, apparition à moins de 2 sorties, 5×5 sans ville équidistante). */
  function penaliteDe(cand, ev, est5x5) {
    var raccords = M.raccordsMorts(cand).filter(function (r) { return r.raison !== 'absent' && !r.mur; }).length; // les murs voulus (mursDuModele) ne sont pas des raccords morts
    var malReliees = M.jonctionsMalReliees(cand).length;
    return {
      raccords: raccords, malReliees: malReliees,
      valeur: Math.max(0, raccords - RACCORDS_TOLERES) + malReliees + (ev.sortiesMin < 2 ? 3 : 0) + (est5x5 && ev.crit.partage.egalite === 0 ? 1 : 0)
    };
  }

  /**
   * Affinage d'un bon candidat (préférence, jamais un rejet) : montée sur les rotations des centrales, villes fixes, qui garde les
   * conditions de ports (ni le plus petit nombre de ports d'une jonction ni le nombre de jonctions à 3 ports ne baissent ; 5×5 : villes
   * sur des jonctions à 3 ports au moins), le plateau acceptable (evaluer, donc en 5×5 aussi l'écart entre villes et les cases à
   * 2 connexions), S ≤ sMax et la pénalité secondaire, et améliore la note de rythme (4×4 : noteRythme, chaîne ≤ 3 visée, puis
   * équilibre des accès au centre ; 5×5 : chaîne, distance maximale, puis écart des accès). Ne modifie pas `bon`.
   * Renvoie { tuiles, ev, note, penalite }.
   */
  function affiner(bon, docBase, F, sMax, rng) {
    var d = { version: docBase.version, grille: F.id, modeles: docBase.modeles, plateau: { tuiles: cloner(bon.tuiles), jetons: bon.jetons } };
    var est5x5 = F.id === '5x5', avecPose = F.id !== '4x4', nbc = F.nbCotes === 6 ? 6 : 4, p0 = portsParJonction(d);
    // les ports d'abord (docs/18) : l'affinage ne baisse ni le plus petit nombre de ports d'une jonction ni le nombre de jonctions à 3 ports
    var ref = { min: Math.min.apply(null, p0), n3: p0.filter(function (p) { return p >= MIN_PORTS_VILLE_5X5; }).length };
    function portsOk() {
      var p = portsParJonction(d);
      if (Math.min.apply(null, p) < ref.min) return false;
      if (p.filter(function (v) { return v >= MIN_PORTS_VILLE_5X5; }).length < ref.n3) return false;
      return !avecPose || bon.jetons.every(function (j) { return p[indexJonction(j.i, j.j, F)] >= MIN_PORTS_VILLE_5X5; });
    }
    var note = noteRythme(d), ev = bon.ev, pen = bon.pen;
    // 5×5 (docs/53 § 3) : la chaîne d'abord, puis la distance maximale, puis l'écart des accès ; 4×4 : la note de noteRythme
    var cleDe = avecPose ? function (x) { return [x.chaine, x.distMax, Math.abs(x.acces.ecart)]; } : function (x) { return x.cle; };
    var centrales = [];
    d.plateau.tuiles.forEach(function (t, k) { if (M.gabaritCellule(t.col, t.lig, F) === 'centrale') centrales.push(k); });
    for (var tour = 0; tour < AFFINAGE_TOURS; tour++) {
      var progres = false;
      melanger(centrales, rng).forEach(function (k) {
        var t = d.plateau.tuiles[k], r0 = t.rot;
        for (var dr = 1; dr < nbc; dr++) {
          t.rot = (r0 + dr) % nbc;
          if (portsOk()) {
            var n = noteRythme(d);
            if (clePlusPetite(cleDe(n), cleDe(note))) {
              var e = evaluer(d);
              if (e.ok && e.crit.S <= sMax) {
                var pn = penaliteDe(d, e, est5x5);
                if (pn.valeur <= pen.valeur) { note = n; ev = e; pen = pn; progres = true; return; }
              }
            }
          }
          t.rot = r0;
        }
      });
      if (!progres) break;
    }
    return { tuiles: d.plateau.tuiles, ev: ev, note: note, penalite: pen };
  }

  /* ------------------------------------------------------------------ */
  /* 5×5 : composition, placement des villes, orientation (docs/53 § 3, docs/55 ; docs/18 « 5×5 très connecté ») */
  /* ------------------------------------------------------------------ */

  var MIN_PORTS_JONCTION_5X5 = GR.PORTS_JONCTION_MIN; // condition de rejet : toute jonction intérieure reliée par 2 ports au moins
  var MIN_PORTS_VILLE_5X5 = GR.PORTS_VILLE_MIN;       // condition de rejet : une ville sur une jonction à 3 ports au moins
  var BUDGET_NOEUDS = 300000;       // garde-fou de chaque recherche de pose (nombre de nœuds, donc déterministe ; docs/66 § 3)
  var FEUILLES_VUES_MAX = 400;      // poses complètes vues au plus par recherche (les feuilles rendues sont tirées parmi elles)
  var FEUILLES_PAR_ESSAI = 20;      // poses tirées par composition et soumises à evaluer
  var ECART_PAS_VILLES = PM.geometrie.ECART_MIN_VILLES + 1; // 4 pas au moins entre deux villes (3 cases d'écart)
  function bitsPorts(masque) { var n = 0; for (var k = 0; k < 4; k++) n += (masque >> k) & 1; return n; }

  /** Coins desservis par chaque case porteuse d'un modèle : [[coins]] (un groupe par case qui porte au moins un port). */
  function groupesPorts(m) {
    var par = {}, ordre = [];
    (Array.isArray(m.chemins) ? m.chemins : []).forEach(function (ch) {
      if (!ch || !ch.a || !ch.b) return;
      var c = null, k = null;
      if (typeof ch.a['case'] === 'string' && typeof ch.b.coin === 'number') { c = ch.a['case']; k = ch.b.coin; }
      else if (typeof ch.b['case'] === 'string' && typeof ch.a.coin === 'number') { c = ch.b['case']; k = ch.a.coin; }
      if (c === null) return;
      if (!par[c]) { par[c] = []; ordre.push(c); }
      if (par[c].indexOf(k) < 0) par[c].push(k);
    });
    return ordre.map(function (c) { return par[c]; });
  }

  /**
   * Profil d'un modèle : masques de ports et de raccords, nombre de cases et de ports (lu sur ses chemins), coins desservis par
   * chaque case porteuse (`groupes`), cases d'apparition [{x, y}] (repère de la tuile).
   */
  function profilModele(m) {
    var mm = M.masquesDuModele(m);
    return {
      id: m.id, ports: mm.portsCoin, raccords: mm.raccords, cases: m.cases.length, nbPorts: bitsPorts(mm.portsCoin), groupes: groupesPorts(m),
      apparitions: m.cases.filter(function (c) { return c.type === 'apparition'; }).map(function (c) { return { x: c.x, y: c.y }; })
    };
  }

  /** Reflet gauche-droite (x -> côté − x) d'un masque de ports de coin : NO <-> NE (bits 0, 1), SE <-> SO (bits 2, 3). */
  function refletPorts(c) { return ((c & 5) << 1) | ((c & 10) >> 1); }

  /** Reflet gauche-droite d'un masque de raccords (12 bits) : N et S pos p -> 2 - p ; E pos p <-> O pos 2 - p. */
  function refletRaccords(r) {
    var res = 0;
    for (var cote = 0; cote < 4; cote++) {
      for (var pos = 0; pos < 3; pos++) {
        if (!((r >> (3 * cote + pos)) & 1)) continue;
        var cote2 = cote === 1 ? 3 : (cote === 3 ? 1 : cote);
        res |= 1 << (3 * cote2 + (2 - pos));
      }
    }
    return res;
  }

  /**
   * Vrai miroir : `b` est le reflet gauche-droite de `a` (même nombre de cases, mêmes ports et mêmes raccords après réflexion,
   * mêmes cases d'apparition à 0,5 mm près). Un bord de même taille mais de forme différente n'est pas un miroir (B7 <-> B7m seulement).
   */
  function estMiroir(a, b, cote) {
    if (a.cases !== b.cases || a.apparitions.length !== b.apparitions.length) return false;
    if (refletPorts(a.ports) !== b.ports || refletRaccords(a.raccords) !== b.raccords) return false;
    var vus = a.apparitions.map(function (p) { return { x: cote - p.x, y: p.y }; });
    return b.apparitions.every(function (q) {
      var k = vus.findIndex(function (p) { return Math.abs(p.x - q.x) <= 0.5 && Math.abs(p.y - q.y) <= 0.5; });
      if (k < 0) return false;
      vus.splice(k, 1);
      return true;
    });
  }

  /** Indice d'une jonction intérieure (i, j) dans l'ordre de lecture (j puis i). */
  function indexJonction(i, j, F) { return F.nbCotes === 6 ? i : (j - 1) * (F.GRILLE.colonnes - 1) + (i - 1); } // hexagonal : le numéro du siège

  /** Ports par jonction d'un plateau, dans l'ordre de lecture des jonctions (j puis i), d'après les tuiles posées. */
  function portsParJonction(doc) {
    var F = M.formatDuDocument(doc), res = [];
    if (F.nbCotes === 6) { for (var s = 0; s < F.sieges.length; s++) res.push(M.portsJonction(doc, s, 0).ports); return res; } // hexagonal : par siège
    for (var j = 1; j < F.GRILLE.lignes; j++) for (var i = 1; i < F.GRILLE.colonnes; i++) res.push(M.portsJonction(doc, i, j).ports);
    return res;
  }

  /**
   * Options d'orientation d'une cellule : pour chaque modèle possible, chaque empreinte distincte (jonctions nourries ET groupes de
   * jonctions desservis par une même case porteuse) est UNE option ; les rotations de même empreinte sont équivalentes pour la
   * couverture et pour la règle « une porteuse ne dessert jamais deux villes » (on en tire une au hasard ensuite).
   * Centrale : 4 rotations ; bord et coin : rotation imposée par la place.
   * Renvoie [{modeleId, jn: [indices des jonctions nourries], groupes: [[indices]] (cases qui nourrissent 2 jonctions ou plus),
   * rots: [rotations équivalentes]}].
   */
  function optionsCellule(c, ids, profils, F) {
    var res = [], vus = {}, NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes;
    var rotations = c.gabarit === 'centrale' ? [0, 1, 2, 3] : [M.rotationDeduite(c.col, c.lig, c.gabarit, F)];
    function jonction(k) {
      var q = M.jonctionDuCoin(c.col, c.lig, k);
      return q.i >= 1 && q.i <= NC - 1 && q.j >= 1 && q.j <= NL - 1 ? indexJonction(q.i, q.j, F) : -1;
    }
    ids.forEach(function (id) {
      rotations.forEach(function (rot) {
        var ports = F.tournerPorts(profils[id].ports, rot), jn = [];
        for (var k = 0; k < 4; k++) if ((ports >> k) & 1) { var x = jonction(k); if (x >= 0) jn.push(x); }
        var groupes = [];
        (profils[id].groupes || []).forEach(function (gr) {
          var g = gr.map(function (k) { return jonction((k + rot) % 4); }).filter(function (x) { return x >= 0; }).sort(function (a, b) { return a - b; });
          if (g.length >= 2) groupes.push(g);
        });
        groupes.sort(function (a, b) { return a[0] - b[0]; });
        var cle = id + '|' + jn.join(',') + '|' + groupes.map(function (g) { return g.join('-'); }).join('/');
        if (vus[cle]) { vus[cle].rots.push(rot); return; }
        vus[cle] = { modeleId: id, jn: jn, groupes: groupes, rots: [rot] };
        res.push(vus[cle]);
      });
    });
    return res;
  }

  /** Une option dessert-elle deux villes par une même case porteuse ? (`villes` : tableau 0/1 par jonction) */
  function desserDeuxVilles(o, villes) {
    return o.groupes.some(function (g) { var n = 0; for (var k = 0; k < g.length; k++) n += villes[g[k]]; return n >= 2; });
  }

  /**
   * Villes du motif par défaut du 5×5 (PM.graphe.MOTIF_VILLES_5X5, docs/18 du 2026-10-19) : { villes: [0/1 par jonction, ordre de lecture],
   * jetons: [{i, j, type: 'capture'}] (8 villes, ordre de lecture) }.
   */
  function motif5x5(F) {
    var nJ = (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1), villes = new Array(nJ).fill(0);
    GR.MOTIF_VILLES_5X5.forEach(function (v) { villes[indexJonction(v.i, v.j, F)] = 1; });
    return { villes: villes, jetons: GR.MOTIF_VILLES_5X5.map(function (v) { return { i: v.i, j: v.j, type: 'capture' }; }) };
  }

  /**
   * Ordre d'exploration des cellules (docs/66 § 3, script de mesure de l'advisor) : bords et coins (rotation imposée) d'abord, puis la
   * centrale du milieu, les centrales des milieux de bord du carré central, enfin celles des coins du carré central. Les cellules les plus
   * contraintes par les villes du motif sont ainsi tranchées tôt.
   */
  function ordreCellules5x5(cellules, F) {
    var milieu = (F.GRILLE.colonnes - 1) / 2;
    function role(c) {
      if (c.gabarit !== 'centrale') return 0;
      if (c.col === milieu && c.lig === milieu) return 1;
      return c.col === milieu || c.lig === milieu ? 2 : 3;
    }
    return cellules.map(function (c, k) { return k; }).sort(function (a, b) { return role(cellules[a]) - role(cellules[b]) || a - b; });
  }

  /**
   * Recherche d'une pose 5×5 pour les villes du motif (docs/66 § 3) : le générateur CHOISIT LA PLACE des centrales tirées (affectation, dans
   * la limite du nombre d'exemplaires tirés de chaque modèle) puis leur orientation ; bords et coins gardent leur place (miroir exact permis,
   * composer5x5). Conditions tenues pendant l'exploration (élagage) : aucune case porteuse ne dessert deux villes (desserDeuxVilles), chaque
   * jonction peut encore recevoir 2 ports et chaque ville 3 ; à la feuille, autant de cases dans la moitié verte que dans la moitié rouge
   * (une centrale à 1 case, LC5, ne peut pas aller n'importe où). L'écart de 3 cases entre villes et le reste sont jugés ensuite (evaluer).
   * Renvoie { feuilles: [[option par cellule]] (jusqu'à K, tirées au hasard parmi les FEUILLES_VUES_MAX premières trouvées), noeuds, tronque }.
   */
  function rechercherPose5x5(ctx, comp, villes, rng, K) {
    var F = ctx.F, cellules = ctx.cellules, nJ = villes.length, n = cellules.length;
    var budget = ctx.budgetNoeuds || BUDGET_NOEUDS;
    var stock = {}, ids = [];
    cellules.forEach(function (c, k) {
      if (c.gabarit !== 'centrale') return;
      if (!stock[comp.ids[k]]) { stock[comp.ids[k]] = 0; ids.push(comp.ids[k]); }
      stock[comp.ids[k]]++;
    });
    var w = cellules.map(function (c) { return poidsMoitie(F, c.col, c.lig); });
    // options de chaque cellule (filtrées par les villes) : centrale = toutes les orientations de tous les modèles centraux tirés
    var opts = cellules.map(function (c, k) {
      var liste = c.gabarit === 'centrale' ? optionsCellule(c, ids, ctx.profils, F) : comp.options[k];
      return liste.filter(function (o) { return !desserDeuxVilles(o, villes); });
    });
    var ordre = ordreCellules5x5(cellules, F), reste = [], d, y;
    for (d = 0; d < n; d++) reste.push(new Array(nJ).fill(0));
    for (d = n - 2; d >= 0; d--) {
      var s = new Array(nJ).fill(0);
      opts[ordre[d + 1]].forEach(function (o) { o.jn.forEach(function (x) { s[x] = 1; }); });
      for (y = 0; y < nJ; y++) reste[d][y] = reste[d + 1][y] + s[y];
    }
    var compte = new Array(nJ).fill(0), choix = new Array(n), feuilles = [], vus = 0, noeuds = 0, tronque = false, ecart = 0;
    function minPorts(x) { return villes[x] ? MIN_PORTS_VILLE_5X5 : MIN_PORTS_JONCTION_5X5; }
    (function visiter(p) {
      if (p === n) {
        if (ecart !== 0) return; // cases inégales entre moitiés : pas une pose
        vus++;
        if (feuilles.length < K) feuilles.push(choix.slice());
        else { var r = entier(rng, vus); if (r < K) feuilles[r] = choix.slice(); }
        return;
      }
      var k = ordre[p], centrale = cellules[k].gabarit === 'centrale', liste = melanger(opts[k], rng);
      for (var q = 0; q < liste.length; q++) {
        if (vus >= FEUILLES_VUES_MAX) return;
        if (++noeuds > budget) { tronque = true; return; }
        var o = liste[q];
        if (centrale && !stock[o.modeleId]) continue;
        var dc = w[k] * (ctx.nbCases[o.modeleId] || 0), j;
        for (j = 0; j < o.jn.length; j++) compte[o.jn[j]]++;
        if (centrale) stock[o.modeleId]--;
        choix[k] = o; ecart += dc;
        var ok = true;
        for (y = 0; y < nJ && ok; y++) if (compte[y] + reste[p][y] < minPorts(y)) ok = false;
        if (ok) visiter(p + 1);
        ecart -= dc;
        if (centrale) stock[o.modeleId]++;
        for (j = 0; j < o.jn.length; j++) compte[o.jn[j]]--;
        if (tronque) return;
      }
    })(0);
    return { feuilles: feuilles, noeuds: noeuds, tronque: tronque };
  }

  /** Tuiles d'une feuille de rechercherPose5x5 : [{modeleId, col, lig, rot}] (une rotation tirée parmi les équivalentes). */
  function tuilesDeFeuille(ctx, feuille, rng) {
    return ctx.cellules.map(function (c, k) {
      var o = feuille[k];
      return { modeleId: o.modeleId, col: c.col, lig: c.lig, rot: o.rots[entier(rng, o.rots.length)] };
    });
  }

  /** Graphe en tableaux d'entiers (parcours rapide des placements de villes) : { n, idx, adj, sources: {1, 2} }. */
  function grapheRapide(g) {
    var idx = new Map();
    g.noeuds.forEach(function (id, k) { idx.set(id, k); });
    var adj = g.noeuds.map(function (id) { return Array.from(g.voisins.get(id), function (v) { return idx.get(v); }); });
    return {
      n: g.noeuds.length, idx: idx, adj: adj,
      sources: { 1: g.apparitions[1].map(function (id) { return idx.get(id); }), 2: g.apparitions[2].map(function (id) { return idx.get(id); }) }
    };
  }

  /** Distance des `noeudsVilles` depuis les apparitions du joueur ; une ville n'est jamais traversée (comme PM.graphe.distancesJoueur). */
  function distancesRapides(P, joueur, estVille, noeudsVilles) {
    var dist = new Int16Array(P.n).fill(-1), file = new Int32Array(P.n), t = 0, q = 0;
    P.sources[joueur].forEach(function (s) { if (dist[s] < 0) { dist[s] = 0; file[t++] = s; } });
    while (q < t) {
      var x = file[q++];
      if (dist[x] > 0 && estVille[x]) continue;
      var a = P.adj[x];
      for (var k = 0; k < a.length; k++) { var y = a[k]; if (dist[y] < 0) { dist[y] = dist[x] + 1; file[t++] = y; } }
    }
    return noeudsVilles.map(function (v) { return dist[v] < 0 ? Infinity : dist[v]; });
  }

  /**
   * Mesures rapides d'un placement (mêmes définitions que PM.graphe.equilibre : rangs triés, S, écart maximal, partage,
   * première ville). Renvoie { accessible, S, ecartMax, cinq, trois, symetrique, partage: {1, 2, egalite}, premiereEgale } (cinq :
   * majorité bloquante du format `formatId`, « 5 contre 2 » en 4×4 et « 6 contre 2 » en 5×5 ; trois : « 5 contre 3 » du 5×5 ;
   * symetrique : autant de villes plus proches de chaque joueur).
   */
  function mesurePlacement(P, noeudsVilles, formatId) {
    var estVille = new Uint8Array(P.n);
    noeudsVilles.forEach(function (v) { estVille[v] = 1; });
    var d1 = distancesRapides(P, 1, estVille, noeudsVilles), d2 = distancesRapides(P, 2, estVille, noeudsVilles);
    var res = { accessible: true, S: null, ecartMax: null, cinq: false, trois: false, symetrique: false, partage: { 1: 0, 2: 0, egalite: 0 }, premiereEgale: false };
    if (d1.concat(d2).some(function (x) { return !isFinite(x); })) { res.accessible = false; return res; }
    d1.forEach(function (a, k) { var b = d2[k]; if (a < b) res.partage[1]++; else if (b < a) res.partage[2]++; else res.partage.egalite++; });
    var t1 = d1.slice().sort(function (a, b) { return a - b; }), t2 = d2.slice().sort(function (a, b) { return a - b; });
    var S = 0, em = 0;
    t1.forEach(function (a, k) { var e = Math.abs(a - t2[k]); S += e; if (e > em) em = e; });
    res.S = S; res.ecartMax = em; res.premiereEgale = t1[0] === t2[0];
    var maj = Math.max(res.partage[1], res.partage[2]), alerte = GR.seuilMajoriteAlerte(formatId);
    res.cinq = maj >= GR.seuilMajorite(formatId);
    res.trois = !res.cinq && alerte !== null && maj >= alerte;
    res.symetrique = res.partage[1] === res.partage[2];
    return res;
  }

  /** Les deux modèles (objets du document) sont-ils miroirs l'un de l'autre dans le format F (voir estMiroir) ? */
  function sontMiroirs(a, b, F) { return estMiroir(profilModele(a), profilModele(b), F.COTE); }

  /** Contexte 5×5 d'un document (bibliothèque, cellules, placements) : pour tuilesOrientees5x5 hors de generer (outils de mesure). */
  function contexteDocument5x5(doc) {
    var F = M.formatDuDocument(doc);
    return contexte5x5(doc, F, modelesParGabarit(doc, F), cellulesDuFormat(F));
  }

  /** Mesure rapide (celle des placements de candidat5x5) des villes posées sur `doc` : { accessible, S, ecartMax, cinq, trois, symetrique, partage, premiereEgale }. */
  function mesureRapide(doc) {
    var g = GR.construire(doc, { villesTraversables: false, jetons: [] }), P = grapheRapide(g);
    return mesurePlacement(P, doc.plateau.jetons.map(function (j) { return P.idx.get('J' + j.i + ',' + j.j); }), M.formatDuDocument(doc).id);
  }

  /** Contexte de génération 5×5 : profils des modèles, cases par modèle, poids, villes du motif par défaut (motif5x5). */
  function contexte5x5(doc, F, modelesDispo, cellules) {
    var profils = {};
    doc.modeles.forEach(function (m) { if (m && typeof m.id === 'string' && Array.isArray(m.cases)) profils[m.id] = profilModele(m); });
    return {
      doc: doc, F: F, cellules: cellules, modelesDispo: modelesDispo, profils: profils, nbCases: casesParModele(doc), poids: poidsTirables(modelesDispo),
      motif: motif5x5(F)
    };
  }

  /**
   * Tirage PAR QUOTAS de `n` modèles parmi `modeles` ([{id, poids}]) : chaque modèle reçoit la partie entière de n × poids / Σ poids,
   * le reste est tiré au hasard au prorata des parties fractionnaires (sans remise). Renvoie les ids, mélangés.
   * Avec les poids du catalogue 5×5 livré (somme 9 pour 9 centrales), la composition est exactement celle des poids.
   */
  function tirageQuotas(modeles, n, rng) {
    var total = modeles.reduce(function (s, m) { return s + m.poids; }, 0), ids = [], fr = [];
    modeles.forEach(function (m) {
      var q = n * m.poids / total, b = Math.floor(q + 1e-9);
      for (var k = 0; k < b; k++) ids.push(m.id);
      fr.push({ id: m.id, poids: q - b });
    });
    while (ids.length < n) {
      var dispo = fr.filter(function (f) { return f.poids > 1e-9; });
      if (!dispo.length) dispo = fr.map(function (f) { return { id: f.id, poids: 1 }; });
      var id = tirerModele(dispo, {}, rng);
      ids.push(id);
      fr.forEach(function (f) { if (f.id === id) f.poids = 0; });
    }
    return melanger(ids, rng);
  }

  /**
   * Composition d'un candidat 5×5 (docs/53 § 3) : 4 coins, 12 bords et 9 centrales tirés PAR QUOTAS selon les poids (tirageQuotas : le
   * catalogue livré donne toujours 3 « Pont et fourche », 1 « Deux ponts » et 5 « Pont et relais » dont 2 décalés), placés au hasard
   * sur les cellules de leur gabarit ; cases égales entre moitiés (equilibrerMoities ; automatique avec des tuiles toutes à 2 cases),
   * puis options d'orientation de chaque cellule (rotation des centrales, miroir exact d'un bord). Renvoie { options, ids } ou
   * { cause: 'cases_moities' }.
   */
  function composer5x5(ctx, rng) {
    var F = ctx.F, cellules = ctx.cellules, modeles = ctx.modelesDispo, profils = ctx.profils, parGabarit = {};
    Object.keys(modeles).forEach(function (gab) {
      var n = cellules.filter(function (c) { return c.gabarit === gab; }).length;
      parGabarit[gab] = n && modeles[gab].length ? tirageQuotas(modeles[gab], n, rng) : [];
    });
    var tuiles0 = cellules.map(function (c) {
      return { modeleId: parGabarit[c.gabarit].pop(), col: c.col, lig: c.lig };
    });
    var remplacants = function (t, k) {
      return modeles[cellules[k].gabarit].map(function (m) { return m.id; }).filter(function (id) { return id !== t.modeleId; });
    };
    if (!equilibrerMoities(tuiles0, cellules, F, ctx.nbCases, rng, remplacants, ctx.poids)) return { cause: 'cases_moities' };
    var ids = tuiles0.map(function (t) { return t.modeleId; });
    var options = cellules.map(function (c, k) {
      var liste = [ids[k]];
      if (c.gabarit === 'bord') { // un bord peut être remplacé par son vrai miroir (reflet exact), s'il y en a un dans la bibliothèque
        liste = modeles.bord.map(function (m) { return m.id; }).filter(function (id) { return id === ids[k] || estMiroir(profils[ids[k]], profils[id], F.COTE); });
      }
      return optionsCellule(c, liste, profils, F);
    });
    return { options: options, ids: ids };
  }

  /**
   * Tuiles d'un candidat 5×5 (appelable seule : outils de mesure, tests) : composition (composer5x5), puis une pose pour les villes du motif
   * par défaut (rechercherPose5x5 : place et orientation des centrales). Renvoie { cause: 'cases_moities' | 'villes_ports', tronque } en
   * cas d'échec, sinon { tuiles, jetons, faibles (campements à moins de 3 ports), noeuds, tronque } ; `ctx.budgetNoeuds` remplace
   * BUDGET_NOEUDS (tests).
   */
  function tuilesOrientees5x5(ctx, rng) {
    var comp = composer5x5(ctx, rng);
    if (comp.cause) return { cause: comp.cause, tronque: false };
    var r = rechercherPose5x5(ctx, comp, ctx.motif.villes, rng, 1);
    if (!r.feuilles.length) return { cause: 'villes_ports', tronque: r.tronque, noeuds: r.noeuds };
    var tuiles = tuilesDeFeuille(ctx, r.feuilles[0], rng);
    var ports = portsParJonction({ version: ctx.doc.version, grille: ctx.F.id, modeles: ctx.doc.modeles, plateau: { tuiles: tuiles, jetons: [] } });
    var faibles = ports.filter(function (p, x) { return !ctx.motif.villes[x] && p < MIN_PORTS_VILLE_5X5; }).length;
    return { tuiles: tuiles, jetons: cloner(ctx.motif.jetons), faibles: faibles, noeuds: r.noeuds, tronque: r.tronque };
  }

  /**
   * Tirage d'un candidat 5×5 (docs/53 § 3, docs/66 § 3) : composition, puis jusqu'à FEUILLES_PAR_ESSAI poses pour les villes du motif par
   * défaut (rechercherPose5x5), chacune soumise au contrôle complet (evaluer : connexité, écart de 3 cases entre villes, ports, cases à
   * 2 connexions, équilibre). Toutes les poses acceptées sont rendues. Renvoie { cause, tronque } si aucune n'est acceptée (cause = clé
   * de `rejets`, la plus fréquente), sinon { acceptes: [{ tuiles, jetons, ev }], tronque }.
   */
  function candidat5x5(ctx, rng) {
    var comp = composer5x5(ctx, rng);
    if (comp.cause) return { cause: comp.cause, tronque: false };
    var r = rechercherPose5x5(ctx, comp, ctx.motif.villes, rng, FEUILLES_PAR_ESSAI);
    if (!r.feuilles.length) return { cause: 'villes_ports', tronque: r.tronque };
    var raisons = {}, acceptes = [];
    r.feuilles.forEach(function (f) {
      var tuiles = tuilesDeFeuille(ctx, f, rng), jetons = cloner(ctx.motif.jetons);
      var cand = { version: ctx.doc.version, grille: ctx.F.id, modeles: ctx.doc.modeles, plateau: { tuiles: tuiles, jetons: jetons } };
      var ev = evaluer(cand);
      if (ev.ok) acceptes.push({ tuiles: tuiles, jetons: jetons, ev: ev });
      else raisons[ev.cause] = (raisons[ev.cause] || 0) + 1;
    });
    if (acceptes.length) return { acceptes: acceptes, tronque: r.tronque };
    return { cause: Object.keys(raisons).sort(function (a, b) { return raisons[b] - raisons[a] || (a < b ? -1 : 1); })[0], tronque: r.tronque };
  }

  /* ------------------------------------------------------------------ */
  /* Hexagonal 'hex19' : composition, villes, recherche de pose (docs/72, docs/77, docs/79) */
  /* ------------------------------------------------------------------ */

  var BUDGET_NOEUDS_HEX = 8000;     // garde-fou de chaque recherche de pose hexagonale (un nœud = un graphe partiel construit, 0,3 ms ; déterministe)
  var CANDIDATS_DEFAUT_HEX = 24;    // hexagonal : candidats par défaut (une composition en donne plusieurs : toutes les poses de S minimal)
  var ESSAIS_MIN_HEX = 10;          // hexagonal : essais au moins quand l'appelant ne fixe pas essaisMax
  var POSES_MAX_HEX = 5000;         // poses jugées au plus par composition (2187 combinaisons de rotations au plus)
  var CACHE_DISPOSITIONS_HEX = null;

  function cleDisposition(sieges) { return sieges.slice().sort(function (a, b) { return a - b; }).join(','); }

  /** Siège symétrique par demi-tour (x, y) -> (−x, −y) : pour le trèfle, 0 <-> 23, 4 <-> 19, 8 <-> 15. */
  function siegeSymetrique(F, s) {
    var p = F.sieges[s], x = F.sieges.filter(function (q) { return Math.abs(q.x + p.x) < 0.01 && Math.abs(q.y + p.y) < 0.01; });
    return x.length ? x[0].id : -1;
  }

  /**
   * Dispositions SYMÉTRIQUES des 6 villes (docs/72) : 3 sièges parmi les 12 du camp vert plus leurs symétriques par demi-tour (3 par camp),
   * soit 220 dispositions, le trèfle (PM.geometrie.format('hex19').TREFLE : 0, 4, 8 / 15, 19, 23) en premier. Tableaux de 6 numéros de
   * sièges triés ; calculé une fois et gelé.
   */
  function dispositionsSymetriquesHex(F) {
    if (CACHE_DISPOSITIONS_HEX) return CACHE_DISPOSITIONS_HEX;
    var nord = F.sieges.filter(function (s) { return s.camp === 'vert'; }).map(function (s) { return s.id; });
    var res = combinaisons(nord, 3).map(function (c) { return c.concat(c.map(function (s) { return siegeSymetrique(F, s); })).sort(function (a, b) { return a - b; }); });
    var cleTrefle = cleDisposition(F.TREFLE);
    res.sort(function (a, b) { return (cleDisposition(b) === cleTrefle ? 1 : 0) - (cleDisposition(a) === cleTrefle ? 1 : 0); }); // tri stable : le trèfle d'abord
    CACHE_DISPOSITIONS_HEX = geler(res);
    return CACHE_DISPOSITIONS_HEX;
  }

  /**
   * Dispositions de l'option « dispositions variées » (docs/80 § 2, réglage à confirmer par l'utilisateur) : le trèfle, son miroir
   * est-ouest (1, 2, 11, 12, 21, 22) et les 8 autres placements faisables sur 12 à 29 % des plateaux. Une liste à modifier ici seulement.
   */
  var DISPOSITIONS_VARIEES_HEX = geler([
    [0, 4, 8, 15, 19, 23], [1, 2, 11, 12, 21, 22],
    [0, 4, 5, 18, 19, 23], [2, 3, 11, 12, 20, 21], [0, 7, 8, 15, 16, 23], [1, 5, 11, 12, 18, 22], [3, 4, 8, 15, 19, 20], [1, 2, 7, 16, 21, 22],
    [1, 2, 7, 18, 19, 23], [0, 4, 5, 16, 21, 22]
  ]);
  function dispositionsAdmissiblesHex() { return DISPOSITIONS_VARIEES_HEX; }

  /**
   * Signature d'une tuile hexagonale posée (PM.modele.tuileEnPlateau) : tout ce que le graphe en lit, indépendamment du nom des cases (ports
   * par siège, raccords par côté, liens, passages, pivots). Deux rotations de même signature sont équivalentes (HC2 et HC3 tournées de 180°).
   */
  function signatureTuileHex(e) {
    var sig = {};
    e.cases.forEach(function (c) { sig[c.id] = { p: [], r: [], t: c.type }; });
    e.ports.forEach(function (p) { if (sig[p.caseId]) sig[p.caseId].p.push(p.i === null || p.i === undefined ? 'x' + p.coin : String(p.i)); });
    e.raccords.forEach(function (r) { if (sig[r.caseId]) sig[r.caseId].r.push(r.cote); });
    var nom = {};
    Object.keys(sig).forEach(function (id) { nom[id] = sig[id].t + ':' + sig[id].p.sort().join(',') + '/' + sig[id].r.sort().join(','); });
    var bout = function (b) { return b.raccord ? 'r' + b.raccord.cote : (b['case'] !== undefined ? nom[b['case']] : 'v'); };
    return Object.keys(nom).map(function (id) { return nom[id]; }).sort().join('|') + '#' +
      (e.aretes || []).map(function (a) { return [nom[a[0]], nom[a[1]]].sort().join('~'); }).sort().join(';') + '#' +
      (e.passages || []).map(function (p) { return [bout(p.a), bout(p.b)].sort().join('~'); }).sort().join(';');
  }

  /**
   * Options d'orientation d'un modèle sur une cellule hexagonale : une option par signature distincte (signatureTuileHex), avec les
   * rotations équivalentes (`rots`) et les sièges nourris (`jn`). Centrale : 6 rotations ; bord et coin : la rotation imposée par la forme.
   * Mis en cache dans `ctx.cacheOptions`.
   */
  function optionsCelluleHex(ctx, c, id) {
    var cle = c.col + ',' + c.lig + '|' + id;
    if (ctx.cacheOptions[cle]) return ctx.cacheOptions[cle];
    var rotations = c.gabarit === 'centrale' ? [0, 1, 2, 3, 4, 5] : [M.rotationDeduite(c.col, c.lig, c.gabarit, ctx.F)], res = [], vus = {};
    rotations.forEach(function (rot) {
      var e = M.tuileEnPlateau(ctx.doc, { modeleId: id, col: c.col, lig: c.lig, rot: rot });
      if (!e) return;
      var k = signatureTuileHex(e);
      if (vus[k]) { vus[k].rots.push(rot); return; }
      vus[k] = { modeleId: id, jn: e.ports.filter(function (p) { return p.i !== null && p.i !== undefined; }).map(function (p) { return p.i; }), rots: [rot] };
      res.push(vus[k]);
    });
    ctx.cacheOptions[cle] = res;
    return res;
  }

  /** Contexte de génération hexagonale. `symetriques` (option « dispositions variées ») : tirer la disposition des villes parmi DISPOSITIONS_VARIEES_HEX (sinon le trèfle). */
  function contexteHex(doc, F, modelesDispo, cellules, symetriques) {
    return {
      doc: doc, F: F, cellules: cellules, modelesDispo: modelesDispo, nbCases: casesParModele(doc), poids: poidsTirables(modelesDispo), cacheOptions: {},
      symetriques: !!symetriques, dispositions: symetriques ? dispositionsAdmissiblesHex() : [F.TREFLE.slice()]
    };
  }

  /** Contexte hexagonal d'un document, pour tuilesOrienteesHex hors de generer (outils de mesure, tests). */
  function contexteDocumentHex(doc, symetriques) {
    var F = M.formatDuDocument(doc);
    return contexteHex(doc, F, modelesParGabarit(doc, F), cellulesDuFormat(F), symetriques);
  }

  /** Comme tirageQuotas, dans le stock de chaque modèle (`stock`) : l'excédent est remplacé au poids par un modèle qui en a encore ; null si le stock total manque. */
  function tirageQuotasStock(modeles, n, rng) {
    var ids = tirageQuotas(modeles, n, rng), compte = {}, stock = {};
    modeles.forEach(function (m) { stock[m.id] = m.stock; });
    ids.forEach(function (id) { compte[id] = (compte[id] || 0) + 1; });
    for (var k = 0; k < ids.length; k++) {
      if (compte[ids[k]] <= stock[ids[k]]) continue;
      var autres = modeles.filter(function (m) { return (compte[m.id] || 0) < m.stock; });
      if (!autres.length) return null;
      var id = tirerModele(autres, {}, rng);
      compte[ids[k]]--; compte[id] = (compte[id] || 0) + 1; ids[k] = id;
    }
    return ids;
  }

  /**
   * Composition d'un candidat hexagonal : 7 intérieures, 6 bords et 6 coins tirés PAR QUOTAS selon les poids et dans le stock
   * (tirageQuotasStock), placés au hasard sur les cellules de leur gabarit, cases égales entre moitiés (equilibrerMoities, échanges et
   * remplacements dans le stock). Renvoie { ids } (un modèle par cellule) ou { cause: 'cases_moities' | 'stock_insuffisant' }.
   */
  function composerHex(ctx, rng) {
    var F = ctx.F, cellules = ctx.cellules, modeles = ctx.modelesDispo, parGabarit = {}, manque = false;
    Object.keys(modeles).forEach(function (gab) {
      var n = cellules.filter(function (c) { return c.gabarit === gab; }).length;
      var l = n && modeles[gab].length ? tirageQuotasStock(modeles[gab], n, rng) : [];
      if (!l) manque = true;
      parGabarit[gab] = l || [];
    });
    if (manque) return { cause: 'stock_insuffisant' };
    var tuiles0 = cellules.map(function (c) { return { modeleId: parGabarit[c.gabarit].pop(), col: c.col, lig: c.lig }; });
    var remplacants = function (t, k) {
      var u = {};
      tuiles0.forEach(function (x) { u[x.modeleId] = (u[x.modeleId] || 0) + 1; });
      return modeles[cellules[k].gabarit].filter(function (m) { return m.id !== t.modeleId && (u[m.id] || 0) < m.stock; }).map(function (m) { return m.id; });
    };
    if (!equilibrerMoities(tuiles0, cellules, F, ctx.nbCases, rng, remplacants, ctx.poids)) return { cause: 'cases_moities' };
    return { ids: tuiles0.map(function (t) { return t.modeleId; }) };
  }

  /**
   * Recherche des orientations (et de la place) des 7 intérieures pour des villes données (`villes` : numéros de sièges). Exploration EXHAUSTIVE (docs/80 : les 2187 combinaisons de rotations 0 à 2, HC2 et HC3 étant symétriques par demi-tour) en
   * profondeur, intérieures les plus proches des villes d'abord ; à chaque pose le graphe PARTIEL est construit et la branche coupée si deux
   * villes sont déjà à moins de ECART_PAS_VILLES pas (ajouter une tuile ne fait que raccourcir les distances) ; coupes de ports (chaque siège
   * peut encore recevoir 2 ports, chaque ville 3). À la feuille : autant de cases dans la moitié verte que dans la moitié rouge. Le stock est
   * celui de la composition (modèles tirés). Le reste (équilibre, connexions) est jugé ensuite (evaluer).
   * Renvoie { feuilles: [[option par cellule]] (toutes, exploration exhaustive ; au plus K, tirées au hasard, si K est fini), noeuds, tronque }.
   */
  function rechercherPoseHex(ctx, comp, villes, rng, K) {
    var F = ctx.F, cellules = ctx.cellules, n = cellules.length, nS = F.sieges.length, budget = ctx.budgetNoeuds || BUDGET_NOEUDS_HEX;
    var w = cellules.map(function (c) { return poidsMoitie(F, c.col, c.lig); });
    var jetons = villes.map(function (s) { return { i: s, j: 0, type: 'capture' }; }), estVille = new Array(nS).fill(0);
    villes.forEach(function (s) { estVille[s] = 1; });
    var stock = {}, ids = [], choix = new Array(n), posees = [], compte = new Array(nS).fill(0), ecart = 0, centrales = [], k, y;
    var docP = { version: ctx.doc.version, grille: F.id, modeles: ctx.doc.modeles, plateau: { tuiles: posees, jetons: jetons } };
    cellules.forEach(function (c, q) {
      if (c.gabarit === 'centrale') {
        centrales.push(q);
        if (!stock[comp.ids[q]]) { stock[comp.ids[q]] = 0; ids.push(comp.ids[q]); }
        stock[comp.ids[q]]++;
        return;
      }
      var o = ctx.rotationsPosees ? optionPoseeHex(ctx, c, comp.ids[q], ctx.rotationsPosees[c.col + ',' + c.lig]) : optionsCelluleHex(ctx, c, comp.ids[q])[0]; // pourtour : une seule orientation (rotation imposée, ou celle de la tuile posée pour « Orienter les tuiles »)
      choix[q] = o; posees.push({ modeleId: o.modeleId, col: c.col, lig: c.lig, rot: o.rots[0] });
      o.jn.forEach(function (x) { compte[x]++; });
      ecart += w[q] * (ctx.nbCases[o.modeleId] || 0);
    });
    var opts = {};
    centrales.forEach(function (q) { opts[q] = optionsCelluleHex(ctx, cellules[q], comp.ids[q]); }); // la composition fixe la place : seules les rotations sont cherchées
    // centrales d'abord celles dont un coin est un siège de ville, puis le reste (ordre de lecture)
    var voisines = {};
    centrales.forEach(function (q) { voisines[q] = F.cellule(cellules[q].col, cellules[q].lig).coins.filter(function (sg) { return sg !== null && estVille[sg]; }).length; });
    var ordre = centrales.slice().sort(function (a, b) { return voisines[b] - voisines[a] || a - b; });
    var reste = [], d;
    for (d = 0; d < ordre.length; d++) reste.push(new Array(nS).fill(0));
    for (d = ordre.length - 2; d >= 0; d--) {
      var sx = new Array(nS).fill(0);
      opts[ordre[d + 1]].forEach(function (o) { o.jn.forEach(function (x) { sx[x] = 1; }); });
      for (y = 0; y < nS; y++) reste[d][y] = reste[d + 1][y] + sx[y];
    }
    var feuilles = [], vus = 0, noeuds = 0, tronque = false;
    var presentes = {}, complet = new Array(nS).fill(true);
    if (ctx.sansPortsIncomplets) { // plateau partiel : un siège sans ses 3 tuiles n’est pas tenu d’avoir ses ports
      cellules.forEach(function (c) { presentes[c.col + ',' + c.lig] = true; });
      F.sieges.forEach(function (sg) { complet[sg.id] = sg.tuiles.every(function (t) { return presentes[t.col + ',' + t.lig]; }); });
    }
    function minPorts(x) { return !complet[x] ? 0 : (estVille[x] ? MIN_PORTS_VILLE_5X5 : MIN_PORTS_JONCTION_5X5); }
    function villesEcartees() { return !GR.villesProches(GR.construire(docP, { villesTraversables: false })).length; }
    if (!villesEcartees()) return { feuilles: [], noeuds: 0, tronque: false }; // le pourtour seul rapproche déjà deux villes
    (function visiter(p) {
      if (p === ordre.length) {
        if (ecart !== 0 && !ctx.sansMoities) return; // cases inégales entre moitiés : pas une pose (sauf « Orienter les tuiles » : la composition est celle de l’utilisateur)
        vus++;
        if (feuilles.length < K) feuilles.push(choix.slice());
        else { var r = entier(rng, vus); if (r < K) feuilles[r] = choix.slice(); }
        return;
      }
      var q = ordre[p], liste = melanger(opts[q], rng);
      for (var m = 0; m < liste.length; m++) {
        var o = liste[m];
        if (++noeuds > budget) { tronque = true; return; }
        var dc = w[q] * (ctx.nbCases[o.modeleId] || 0), j;
        for (j = 0; j < o.jn.length; j++) compte[o.jn[j]]++;
        stock[o.modeleId]--; choix[q] = o; ecart += dc;
        posees.push({ modeleId: o.modeleId, col: cellules[q].col, lig: cellules[q].lig, rot: o.rots[0] });
        var ok = true;
        for (y = 0; y < nS && ok; y++) if (compte[y] + (reste[p] ? reste[p][y] : 0) < minPorts(y)) ok = false;
        if (ok && villesEcartees()) visiter(p + 1);
        posees.pop();
        ecart -= dc; stock[o.modeleId]++;
        for (j = 0; j < o.jn.length; j++) compte[o.jn[j]]--;
        if (tronque) return;
      }
    })(0);
    return { feuilles: feuilles, noeuds: noeuds, tronque: tronque };
  }

  /**
   * Disposition des villes et poses d'un candidat hexagonal : le trèfle, ou (option « dispositions symétriques ») des dispositions
   * admissibles tirées au hasard, essayées l'une après l'autre jusqu'à une composition qui en admet une. Chaque pose trouvée est jugée
   * (evaluer). Renvoie { acceptes: [{ tuiles, jetons, ev }], tronque } ou { cause, tronque } (cause = clé de `rejets`).
   */
  function candidatHex(ctx, rng) {
    var comp = composerHex(ctx, rng);
    if (comp.cause) return { cause: comp.cause, tronque: false };
    var dispositions = ctx.symetriques ? melanger(ctx.dispositions, rng) : ctx.dispositions;
    var raisons = {}, tronque = false;
    for (var n = 0; n < dispositions.length; n++) {
      var r = rechercherPoseHex(ctx, comp, dispositions[n], rng, POSES_MAX_HEX);
      if (r.tronque) tronque = true;
      if (!r.feuilles.length) { raisons.villes_ports = (raisons.villes_ports || 0) + 1; continue; }
      var acceptes = [];
      r.feuilles.forEach(function (f) {
        var tuiles = tuilesDeFeuille(ctx, f, rng), jetons = dispositions[n].map(function (s) { return { i: s, j: 0, type: 'capture' }; });
        var ev = evaluer({ version: ctx.doc.version, grille: ctx.F.id, modeles: ctx.doc.modeles, plateau: { tuiles: tuiles, jetons: jetons } });
        if (ev.ok) acceptes.push({ tuiles: tuiles, jetons: jetons, ev: ev, disposition: dispositions[n] });
        else raisons[ev.cause] = (raisons[ev.cause] || 0) + 1;
      });
      if (acceptes.length) { // docs/80 : parmi les poses qui tiennent l'écart, celles de S minimal
        var smin = Math.min.apply(null, acceptes.map(function (a) { return a.ev.crit.S; }));
        return { acceptes: acceptes.filter(function (a) { return a.ev.crit.S === smin; }), tronque: tronque, nbPoses: r.feuilles.length };
      }
    }
    return { cause: Object.keys(raisons).sort(function (a, b) { return raisons[b] - raisons[a] || (a < b ? -1 : 1); })[0] || 'villes_ports', tronque: tronque };
  }

  /**
   * Tuiles d'un candidat hexagonal (appelable seule : outils de mesure, tests) : composition (composerHex), puis une pose pour la
   * première disposition de villes de `ctx` (rechercherPoseHex). Renvoie { cause, tronque } en cas d'échec, sinon { tuiles, jetons, noeuds, tronque }.
   */
  function tuilesOrienteesHex(ctx, rng) {
    var comp = composerHex(ctx, rng);
    if (comp.cause) return { cause: comp.cause, tronque: false };
    var villes = ctx.dispositions[0], r = rechercherPoseHex(ctx, comp, villes, rng, 1);
    if (!r.feuilles.length) return { cause: 'villes_ports', tronque: r.tronque, noeuds: r.noeuds };
    return { tuiles: tuilesDeFeuille(ctx, r.feuilles[0], rng), jetons: villes.map(function (s) { return { i: s, j: 0, type: 'capture' }; }), noeuds: r.noeuds, tronque: r.tronque };
  }

  /** Option d'orientation d'une tuile hexagonale posée, de rotation FIXE `rot` (pourtour posé par l'utilisateur) : même forme que optionsCelluleHex. */
  function optionPoseeHex(ctx, c, id, rot) {
    var e = M.tuileEnPlateau(ctx.doc, { modeleId: id, col: c.col, lig: c.lig, rot: rot });
    return { modeleId: id, jn: e ? e.ports.filter(function (p) { return p.i !== null && p.i !== undefined; }).map(function (p) { return p.i; }) : [], rots: [rot] };
  }

  /** Refus d'« Orienter les tuiles » : { ok: false, raison }. */
  function refusOrienter(raison) { return { ok: false, doc: null, raison: raison, changees: [], S: null, tronque: false }; }

  /**
   * « Orienter les tuiles » (hexagonal, décision de l'utilisateur, docs/72) : cherche les rotations des intérieures POSÉES qui tiennent l'écart de
   * 4 pas entre les villes posées (3 ports par ville, 2 par siège), par la recherche exhaustive du générateur (rechercherPoseHex, 3⁷ = 2187
   * combinaisons au plus), le pourtour restant tel qu'il est posé. Parmi les poses trouvées, retient le S minimal (plateau complet ; sinon la
   * première) puis le moins de tuiles tournées. Pure : ne modifie pas `doc`. Renvoie
   * { ok, doc (document tourné), changees: [{ col, lig, de, vers }], S, tronque, raison } ; raison : phrase de refus si ok est faux.
   */
  function orienterTuiles(doc) {
    var F;
    try { F = M.formatDuDocument(doc); } catch (e) { return refusOrienter(e.message); }
    if (F.nbCotes !== 6) return refusOrienter('« Orienter les tuiles » ne sert qu’au plateau hexagonal.');
    var tuiles = doc && doc.plateau && Array.isArray(doc.plateau.tuiles) ? doc.plateau.tuiles : [];
    var cellules = [], ids = [], rotations = {}, centrales = 0, posees = 0;
    F.cellules.forEach(function (c) {
      var t = tuiles.filter(function (x) { return x && x.col === c.col && x.lig === c.lig; })[0], m = t ? M.modeleParId(doc, t.modeleId) : null;
      if (!t || !m || !M.validerModele(m, F).complet || !Number.isInteger(t.rot) || t.rot < 0 || t.rot > 5) return;
      posees++;
      cellules.push({ col: c.col, lig: c.lig, gabarit: c.gabarit });
      ids.push(t.modeleId);
      rotations[c.col + ',' + c.lig] = t.rot;
      if (c.gabarit === 'centrale') centrales++;
    });
    if (!centrales) return refusOrienter('Aucune tuile intérieure (centre et couronne) n’est posée : il n’y a rien à orienter, posez d’abord des centrales.');
    var villes = [];
    (doc.plateau.jetons || []).forEach(function (j) { if (j && j.type === 'capture' && j.j === 0 && Number.isInteger(j.i) && j.i >= 0 && j.i < F.sieges.length && villes.indexOf(j.i) < 0) villes.push(j.i); });
    if (!villes.length) return refusOrienter('Aucune ville n’est posée : posez d’abord les villes (clic sur un siège, ou Outils > Placer les villes), puis orientez les tuiles pour tenir leur écart.');
    var ctx = contexteHex(doc, F, {}, cellules, false);
    ctx.rotationsPosees = rotations; ctx.sansMoities = true; ctx.sansPortsIncomplets = true;
    var rng = mulberry32(hacher('orienter')), r = rechercherPoseHex(ctx, { ids: ids }, villes, rng, POSES_MAX_HEX);
    if (!r.feuilles.length) {
      return refusOrienter('Aucune orientation des ' + centrales + ' tuile(s) intérieure(s) posée(s) ne tient l’écart de ' + ECART_PAS_VILLES + ' pas entre les ' + villes.length + ' ville(s) posée(s), avec 3 ports par ville et 2 par siège' +
        (r.tronque ? ' (recherche interrompue : trop de combinaisons)' : '') + ' : déplacez une ville (clic sur son siège), changez une tuile du pourtour ou une intérieure.');
    }
    // une pose par feuille : pour chaque centrale, la rotation équivalente la plus proche de la rotation actuelle
    function poseDe(f) {
      var res = [], n = 0;
      cellules.forEach(function (c, k) {
        var o = f[k], cur = rotations[c.col + ',' + c.lig], rot = o.rots[0];
        if (c.gabarit === 'centrale') {
          rot = o.rots.reduce(function (b, x) { var d = Math.min((x - cur + 6) % 6, (cur - x + 6) % 6), db = Math.min((b - cur + 6) % 6, (cur - b + 6) % 6); return d < db ? x : b; }, o.rots[0]);
          if (o.rots.indexOf(cur) >= 0) rot = cur;
          if (rot !== cur) n++;
        } else rot = cur;
        res.push({ col: c.col, lig: c.lig, modeleId: o.modeleId, rot: rot });
      });
      return { tuiles: res, changees: n };
    }
    // S n’est mesurable que sur un plateau complet à 6 villes : toutes les poses trouvées sont alors jugées (pas d’échantillon, le S minimal est garanti) ; sinon la pose la moins différente
    var plateauComplet = posees === F.cellules.length && villes.length === GR.nbVilles(F.id), evalues = r.feuilles;
    var meilleur = null;
    evalues.forEach(function (f) {
      var p = poseDe(f), S = null;
      if (plateauComplet) {
        try {
          var dc = { version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: p.tuiles, jetons: villes.map(function (s) { return { i: s, j: 0, type: 'capture' }; }) } };
          S = GR.equilibre(dc, { graphe: GR.construire(dc, { villesTraversables: false }) }).S;
        } catch (e) { S = null; }
      }
      var cle = [S === null || S === undefined ? 1e9 : S, p.changees];
      if (!meilleur || cle[0] < meilleur.cle[0] || (cle[0] === meilleur.cle[0] && cle[1] < meilleur.cle[1])) meilleur = { cle: cle, pose: p, S: S };
    });
    var nouveau = JSON.parse(JSON.stringify(doc)), changees = [];
    meilleur.pose.tuiles.forEach(function (p) {
      var t = nouveau.plateau.tuiles.filter(function (x) { return x && x.col === p.col && x.lig === p.lig; })[0];
      if (t && t.rot !== p.rot) { changees.push({ col: p.col, lig: p.lig, de: t.rot, vers: p.rot }); t.rot = p.rot; }
    });
    return { ok: true, doc: nouveau, changees: changees, S: meilleur.S === undefined ? null : meilleur.S, tronque: r.tronque, raison: '', combinaisons: r.feuilles.length };
  }

  /**
   * « Orienter les tuiles » de l'interface (hexagonal) : applique orienterTuiles en UNE étape d'historique (Ctrl+Z pour revenir), ou explique
   * le refus dans la barre d'état. Renvoie le résultat de orienterTuiles.
   */
  function orienter(etat) {
    var doc = etat.doc(), r = orienterTuiles(doc);
    if (!r.ok) { etat.signaler(r.raison, 'alerte'); return r; }
    if (!r.changees.length) { etat.signaler('Les tuiles intérieures sont déjà orientées de façon à tenir l’écart entre les villes posées : rien à tourner.' + (r.S !== null ? ' (S = ' + r.S + ')' : ''), 'info'); return r; }
    var fait = etat.appliquer(function () { return r.doc; }, 'orienter les tuiles');
    if (fait && fait.ok === false) return r;
    etat.signaler(r.changees.length + ' tuile(s) tournée(s) pour tenir l’écart entre les villes' + (r.S !== null ? ' (S = ' + r.S + ', le plus bas parmi ' + r.combinaisons + ' orientation(s) possible(s))' : ' (' + r.combinaisons + ' orientation(s) possible(s), la moins différente est retenue)') +
      (r.tronque ? ' ; recherche interrompue avant la fin' : '') + '. Ctrl+Z pour revenir.', 'info');
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Placements de villes admissibles et aide « placer les villes »        */
  /* ------------------------------------------------------------------ */

  /**
   * Placements de villes possibles d'un format, en jonctions {i, j} : 5×5 : les 1 296 placements de 8 villes en 2-2-2-2 ; 4×4 : 7 villes,
   * complémentaires des 12 paires de jonctions-cases équilibrées (pairesJonctionsCases, « jonctions variées »).
   */
  function placementsDuFormat(F) {
    if (F.id === '5x5') return placementsVilles5x5();
    if (F.nbCotes === 6) return dispositionsSymetriquesHex(F).map(function (d) { return d.map(function (x) { return { i: x, j: 0 }; }); }); // hexagonal : 220 dispositions symétriques, trèfle d'abord
    var toutes = jonctionsInterieures(F);
    return (pairesJonctionsCases(F, true) || []).map(function (paire) {
      return toutes.filter(function (jn) { return !paire.some(function (c) { return c.i === jn.i && c.j === jn.j; }); });
    });
  }

  /**
   * Placements ADMISSIBLES d'un plateau posé (les villes posées sont ignorées) : 7 villes en 4×4, 8 en 5×5 (2-2-2-2) dont deux sont toujours à
   * ECART_PAS_VILLES pas au moins (3 cases d'écart, comme PM.graphe.villesProches : un trajet plus court passerait par une ville plus
   * proche encore) et, en 5×5, toutes sur des jonctions à 3 ports au moins. Renvoie { graphe (sans ville), placements: [[{i, j}]] }.
   */
  function placementsAdmissibles(doc) {
    var F = M.formatDuDocument(doc), g = GR.construire(doc, { villesTraversables: false, jetons: [] });
    var NC = F.GRILLE.colonnes, nJ = F.nbCotes === 6 ? F.sieges.length : (NC - 1) * (F.GRILLE.lignes - 1), conflits = new Array(nJ).fill(0), ports = new Array(nJ).fill(0);
    g.jonctions.forEach(function (jn) {
      var x = indexJonction(jn.i, jn.j, F), d = GR.distances(g, jn.id);
      ports[x] = jn.ports;
      g.jonctions.forEach(function (autre) {
        if (autre.id !== jn.id && d.has(autre.id) && d.get(autre.id) < ECART_PAS_VILLES) conflits[x] |= 1 << indexJonction(autre.i, autre.j, F);
      });
    });
    var minPorts = F.id !== '4x4' ? MIN_PORTS_VILLE_5X5 : 0;
    var res = placementsDuFormat(F).filter(function (pl) {
      var masque = 0;
      pl.forEach(function (jn) { masque |= 1 << indexJonction(jn.i, jn.j, F); });
      return pl.every(function (jn) { var x = indexJonction(jn.i, jn.j, F); return ports[x] >= minPorts && !(conflits[x] & masque); });
    });
    return { graphe: g, placements: res, conflits: conflits, ports: ports };
  }

  /**
   * Hexagonal : placements 3 + 3 NON symétriques admissibles (3 sièges par camp, ports et écart respectés), en dernier recours de l'aide
   * « placer les villes » quand aucune disposition symétrique ne convient. `ad` : résultat de placementsAdmissibles.
   */
  function placementsLibresHex(ad, F) {
    var nord = F.sieges.filter(function (sg) { return sg.camp === 'vert'; }).map(function (sg) { return sg.id; });
    var sud = F.sieges.filter(function (sg) { return sg.camp !== 'vert'; }).map(function (sg) { return sg.id; });
    function triplets(liste) {
      return combinaisons(liste, 3).filter(function (t) {
        var masque = 0;
        t.forEach(function (x) { masque |= 1 << x; });
        return t.every(function (x) { return ad.ports[x] >= MIN_PORTS_VILLE_5X5 && !(ad.conflits[x] & masque); });
      });
    }
    var res = [], tn = triplets(nord), ts = triplets(sud);
    tn.forEach(function (a) {
      ts.forEach(function (b) {
        var masque = 0;
        b.forEach(function (x) { masque |= 1 << x; });
        if (a.every(function (x) { return !(ad.conflits[x] & masque); })) res.push(a.concat(b).map(function (x) { return { i: x, j: 0 }; }));
      });
    });
    return res;
  }

  /** Nombre de placements admissibles d'un plateau 5×5 posé (placementsAdmissibles : 2-2-2-2, 3 ports, 3 cases d'écart). */
  function placementsAdmissibles5x5(doc) { return placementsAdmissibles(doc).placements.length; }

  /**
   * Meilleur placement des N villes (7 en 4×4, 8 en 5×5) sur le plateau posé de `doc` (aide « placer les villes », docs/18 : l'écart de
   * 3 cases est garanti par le placement) : parmi les placements admissibles (placementsAdmissibles), ceux que le générateur accepterait
   * (causeRejet : ville accessible, ni majorité ni écart de plus de 2 pas à un rang, première ville égale, S sous le seuil de rejet en
   * 5×5) ; en 5×5, d'abord les POSITIONS PAR DÉFAUT (PM.graphe.MOTIF_VILLES_5X5, docs/18 du 2026-10-19) si elles sont admissibles et
   * acceptées, puis un partage symétrique (docs/18, décision 2 du 2026-10-19 : préférence ; un partage non symétrique n'est posé
   * que s'il n'y a pas d'autre choix, avec une information) ; puis au plus petit S, puis avec une ville équidistante, puis dans l'ordre
   * des placements (déterministe). Pure, ne modifie pas `doc`.
   * Renvoie { ok, jetons, S, admissibles, acceptes, partageSymetrique, partage, motif (5×5 : positions par défaut), raison } (raison :
   * phrase de refus si ok est faux).
   */
  function meilleurPlacementVilles(doc) {
    var F;
    try { F = M.formatDuDocument(doc); } catch (e) { return { ok: false, jetons: null, raison: e.message, admissibles: 0, acceptes: 0 }; }
    var tuiles = doc && doc.plateau && Array.isArray(doc.plateau.tuiles) ? doc.plateau.tuiles : [];
    var posees = tuiles.filter(function (t) { return t && M.modeleParId(doc, t.modeleId); }).length;
    var attendues = F.nbCotes === 6 ? F.cellules.length : F.GRILLE.colonnes * F.GRILLE.lignes;
    if (posees < attendues) {
      return { ok: false, jetons: null, admissibles: 0, acceptes: 0, raison: 'Posez d’abord toutes les tuiles du plateau (' + posees + ' sur ' + attendues + ') : les villes se placent sur un plateau complet.' };
    }
    var ad = placementsAdmissibles({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: tuiles, jetons: [] } });
    var nb = GR.nbVilles(F.id), est5x5 = F.id === '5x5', estHex = F.nbCotes === 6, avecSym = est5x5 || estHex;
    var regle = est5x5 ? 'en 2-2-2-2, sur des jonctions à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins, ' : (estHex ? '3 par camp, sur des sièges à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins, ' : '');
    var libres = false;
    if (estHex && !ad.placements.length) { ad.placements = placementsLibresHex(ad, F); libres = true; } // aucune disposition symétrique admissible : 3 + 3 libres
    if (!ad.placements.length) {
      return { ok: false, jetons: null, admissibles: 0, acceptes: 0, raison: 'Aucun placement des ' + nb + ' villes (' + regle + 'à ' + PM.geometrie.ECART_MIN_VILLES + ' cases d’écart au moins) n’est possible sur ce plateau : tournez des centrales ou changez des tuiles (une case qui porte deux ports ne doit pas desservir deux villes).' +
        (est5x5 ? ' Avec le catalogue livré, tournez ou déplacez les centrales : les positions par défaut des 8 villes demandent les « ponts » (Coins opposés, Deux ponts ouverts).' : '') };
    }
    var P = grapheRapide(ad.graphe), raisons = {}, meilleur = null;
    var cleMotif = avecSym ? (estHex ? GR.MOTIF_VILLES_HEX : GR.MOTIF_VILLES_5X5).map(function (v) { return v.i + ',' + v.j; }).sort().join(' ') : null;
    function examiner(liste, decalage) { liste.forEach(function (pl, k0) {
      var k = k0 + decalage;
      var m = mesurePlacement(P, pl.map(function (jn) { return P.idx.get('J' + jn.i + ',' + jn.j); }), F.id), raison = causeRejet(m, F.id);
      if (raison) { raisons[raison] = (raisons[raison] || 0) + 1; return; }
      var motif = cleMotif !== null && pl.map(function (jn) { return jn.i + ',' + jn.j; }).sort().join(' ') === cleMotif;
      var c = { pl: pl, S: m.S, egal: m.partage.egalite > 0 ? 0 : 1, asym: avecSym && !m.symetrique ? 1 : 0, autre: motif ? 0 : 1, motif: motif, partage: m.partage, k: k };
      if (!meilleur || c.autre < meilleur.autre || (c.autre === meilleur.autre && (c.asym < meilleur.asym || (c.asym === meilleur.asym && (c.S < meilleur.S || (c.S === meilleur.S && c.egal < meilleur.egal)))))) meilleur = c;
    }); }
    examiner(ad.placements, 0);
    if (estHex && !meilleur && !libres) { var plus = placementsLibresHex(ad, F); examiner(plus, ad.placements.length); ad.placements = ad.placements.concat(plus); } // dernier recours : 3 + 3 non symétriques
    var acceptes = ad.placements.length - Object.keys(raisons).reduce(function (s, r) { return s + raisons[r]; }, 0);
    if (!meilleur) {
      var cause = Object.keys(raisons).sort(function (a, b) { return raisons[b] - raisons[a] || (a < b ? -1 : 1); })[0];
      return { ok: false, jetons: null, admissibles: ad.placements.length, acceptes: 0, raison: ad.placements.length + ' placement(s) des villes respectent les règles de placement, mais aucun n’est équilibré (le plus souvent : ' + (cause === 'cinq_contre_deux' ? '« ' + GR.libelleMajorite(F.id) + ' »' : LIBELLES_CAUSE_TOUTES[cause]) + ') : changez des tuiles ou leur orientation.' };
    }
    return {
      ok: true, S: meilleur.S, admissibles: ad.placements.length, acceptes: acceptes, raison: '',
      partageSymetrique: meilleur.partage[1] === meilleur.partage[2], partage: { 1: meilleur.partage[1], 2: meilleur.partage[2], egalite: meilleur.partage.egalite }, motif: meilleur.motif,
      jetons: meilleur.pl.map(function (jn) { return { i: jn.i, j: jn.j, type: 'capture' }; })
    };
  }

  /**
   * Aide « placer les villes » de l'interface : pose les N villes du format (7 en 4×4, 8 en 5×5) au meilleur placement (meilleurPlacementVilles) à la place des villes
   * du plateau, en une étape d'historique (Ctrl+Z pour revenir) ; sinon, explique le refus dans la barre d'état. Renvoie le résultat.
   */
  function placerVilles(etat) {
    var doc = etat.doc(), r = meilleurPlacementVilles(doc);
    if (!r.ok) { etat.signaler(r.raison, 'alerte'); return r; }
    var fait = etat.appliquer(function (d) {
      var n = JSON.parse(JSON.stringify(d));
      n.plateau.jetons = (n.plateau.jetons || []).filter(function (j) { return j && j.type !== 'capture'; }).concat(r.jetons);
      return n;
    }, 'placer les villes');
    if (fait && fait.ok === false) return r;
    var est5 = M.formatDuDocument(doc).id === '5x5', estH = M.formatDuDocument(doc).nbCotes === 6, asym = (est5 || estH) && !r.partageSymetrique;
    etat.signaler(r.jetons.length + ' villes placées ' + (r.motif ? (estH ? 'en trèfle (disposition par défaut)' : 'aux positions par défaut') : 'au meilleur placement') + ' (S = ' + r.S + ', parmi ' + r.acceptes + ' placement(s) équilibré(s) sur ' + r.admissibles + ' admissible(s)).' +
      (est5 && !r.motif ? ' Les positions par défaut ne conviennent pas à ces tuiles.' : '') +
      (estH && !r.motif ? ' Le trèfle ne convient pas à ces tuiles.' : '') +
      (asym ? ' Partage non symétrique (' + r.partage[1] + ' villes plus proches du vert, ' + r.partage[2] + ' du rouge, ' + r.partage.egalite + ' à égalité) : aucun placement équilibré ne partage les villes de façon symétrique (information).' : '') +
      ' Ctrl+Z pour revenir.', asym ? 'alerte' : 'info');
    return r;
  }

  /* ------------------------------------------------------------------ */
  /* Génération                                                          */
  /* ------------------------------------------------------------------ */

  var LIBELLES_CAUSE = {
    plateau_invalide: 'plateau refusé par la validation',
    connexite: 'graphe non connexe ou camp sans case d\'apparition',
    villes_proches: 'villes à moins de 3 cases',
    ville_inaccessible: 'ville inaccessible',
    desequilibre: 'plateau très déséquilibré',
    cinq_contre_deux: '« 5 contre 2 »',
    ecart: 'écart de plus de 2 pas à un rang',
    premiere_ville: 'première ville à des distances différentes',
    cases_moities: 'cases inégales entre la moitié verte et la moitié rouge'
  };
  /** Causes de rejet propres au 5×5 (ajoutées à `rejets` seulement dans ce format : le 4×4 est inchangé). */
  var LIBELLES_CAUSE_5X5 = {
    jonction_ports: 'jonction à moins de 2 ports',
    villes_ports: 'aucune pose des tuiles pour les 8 villes aux positions par défaut (3 ports par ville, aucune case qui dessert deux villes)',
    connexions: 'plus de 5 % de cases à 2 connexions ou moins',
    cinq_contre_trois: '« 5 contre 3 »',
    score_s: 'score S au-dessus du seuil'
  };
  /** Causes de rejet propres à l'hexagonal (mêmes clés que le 5×5, textes à 6 villes ; ajoutées à `rejets` seulement dans ce format). */
  var LIBELLES_CAUSE_HEX = {
    jonction_ports: 'siège à moins de 2 ports',
    villes_ports: 'aucune combinaison de rotations des intérieures ne tient l’écart de 4 pas entre les 6 villes',
    connexions: 'plus de 5 % de cases à 2 connexions ou moins',
    cinq_contre_trois: '« 5 contre 3 »',
    score_s: 'score S au-dessus du seuil (3 et plus)',
    stock_insuffisant: 'stock insuffisant pour la composition (7 intérieures, 6 bords, 6 coins)'
  };
  var LIBELLES_CAUSE_TOUTES = Object.assign({}, LIBELLES_CAUSE, LIBELLES_CAUSE_5X5, { stock_insuffisant: LIBELLES_CAUSE_HEX.stock_insuffisant });

  /** Entier (partie entière) d'un nombre fini d'au moins 1 ; toute autre valeur (texte, NaN, Infinity, négatif, 0) donne `defaut`. */
  function entierValide(x, defaut) {
    return typeof x === 'number' && isFinite(x) && x >= 1 ? Math.floor(x) : defaut;
  }

  /**
   * Explication claire d'un abandon (5×5) : échecs structurels consécutifs, c'est-à-dire une bibliothèque qui ne peut pas donner de
   * plateau conforme. `cause` : 'cases_moities', 'villes_ports', 'jonction_ports' ou 'connexions'.
   */
  function expliquerManquePorts(cause, F) {
    if (F && F.nbCotes === 6) return expliquerCauseHex(cause) + ' Le catalogue hexagonal livré donne des plateaux conformes.';
    return expliquerCause(cause) + (cause === 'cases_moities' ? '' : ' Le catalogue 5×5 livré (Nouveau plateau 5×5, ou « Charger le nouveau catalogue ») donne des plateaux conformes.');
  }
  function expliquerCauseHex(cause) {
    if (cause === 'cases_moities') return 'aucune composition de la bibliothèque ne donne autant de cases dans la moitié verte que dans la moitié rouge.';
    if (cause === 'stock_insuffisant') return 'le stock de la bibliothèque ne couvre pas les 7 intérieures, 6 bords et 6 coins du plateau.';
    if (cause === 'connexions') return 'les tuiles de la bibliothèque laissent plus de 5 % de cases à 2 connexions ou moins.';
    if (cause === 'jonction_ports') return 'aucune orientation des tuiles ne relie chaque siège par 2 ports au moins.';
    return 'aucune combinaison de rotations des 7 intérieures ne tient l’écart de 4 pas entre les 6 villes (3 ports par ville, aucune case qui dessert deux villes) : les tuiles de la bibliothèque ne le permettent pas.';
  }
  function expliquerCause(cause) {
    if (cause === 'cases_moities') return 'aucune composition de la bibliothèque ne donne autant de cases dans la moitié verte que dans la moitié rouge (ajoutez des modèles de mêmes gabarits avec d’autres nombres de cases).';
    if (cause === 'connexions') return 'les tuiles de la bibliothèque laissent plus de 5 % de cases à 2 connexions ou moins : le 5×5 demande des tuiles très connectées (au moins 3 connexions par case).';
    if (cause === 'jonction_ports') return 'aucune orientation des tuiles ne relie chaque jonction par ' + MIN_PORTS_JONCTION_5X5 + ' ports au moins : les tuiles de la bibliothèque n’apportent pas assez de ports.';
    return 'aucune pose des tuiles ne donne ' + MIN_PORTS_VILLE_5X5 + ' ports au moins à chacune des 8 villes aux positions par défaut sans qu’une case desserve deux villes : les tuiles de la bibliothèque ne le permettent pas (il faut des centrales « ponts », comme Coins opposés et Deux ponts ouverts du catalogue livré).';
  }

  /**
   * Génère un plateau aléatoire du format du document. Ne modifie pas `doc`.
   * options :
   *  - graine (texte ou nombre ; générée si absente) ;
   *  - candidats (défaut 200, borné à 1000) : candidats valides à départager ; essaisMax (défaut candidats × 5, borné) ;
   *    une valeur qui n'est pas un nombre fini d'au moins 1 (texte, NaN, Infinity, négatif, 0) donne la valeur par défaut ;
   *  - tolerance (défaut 1) : bons candidats = S ≤ Smin + tolérance ;
    *  - jonctionsVariees (défaut true ; seul `false` choisit la rangée centrale) : 4×4, voir pairesJonctionsCases (12 paires équilibrées ; false : les 3 paires de la rangée centrale) ;
   *  - dispositionsVariees (défaut false ; hexagonal) : false = les 6 villes en trèfle ; true = disposition tirée parmi DISPOSITIONS_VARIEES_HEX (trèfle, miroir, 8 autres : docs/80 § 2) ;
   *  - affinage (défaut true) : false = un bon candidat tiré au hasard, sans affinage du rythme ni des accès (mesures de l'effet).
   * Renvoie { ok, doc, graine, essais, candidats, score, rapport: [texte], raison, rejets }.
   */
  function generer(doc, options) {
    options = options || {};
    var graine = options.graine === undefined || options.graine === null || String(options.graine).trim() === ''
      ? nouvelleGraine() : String(options.graine).trim();
    var nbCandidats = Math.min(CANDIDATS_MAX, entierValide(options.candidats, CANDIDATS_DEFAUT));
    var essaisMax = Math.max(nbCandidats, Math.min(ESSAIS_MAX_BORNE, entierValide(options.essaisMax, nbCandidats * FACTEUR_ESSAIS)));
    var tolerance = typeof options.tolerance === 'number' && options.tolerance >= 0 ? options.tolerance : TOLERANCE_DEFAUT;
    var rng = mulberry32(hacher(graine));
    var rapport = [];
    var rejets = {};
    Object.keys(LIBELLES_CAUSE).forEach(function (k) { rejets[k] = 0; });
    var libelles = LIBELLES_CAUSE;

    function echec(raison, essais) {
      return { ok: false, doc: null, graine: graine, essais: essais || 0, candidats: 0, score: null, rapport: rapport, raison: raison, rejets: rejets };
    }

    if (!doc || typeof doc !== 'object') return echec('Aucun document à partir duquel générer.');
    var F;
    try { F = M.formatDuDocument(doc); } catch (e) { return echec(e.message); }

    // Bibliothèque suffisante ? Il faut au moins un modèle complet (à 1 exemplaire ou plus) pour chaque gabarit utilisé.
    var modelesDispo = modelesParGabarit(doc, F), cellules = cellulesDuFormat(F), besoins = { centrale: 0, bord: 0, coin: 0 }, manques = [];
    cellules.forEach(function (c) { besoins[c.gabarit]++; });
    M.GABARITS.forEach(function (r) {
      if (besoins[r] > 0 && !modelesDispo[r].length) {
        manques.push('aucun modèle de ' + LIBELLES_GABARIT[r] + ' (il en faut pour ' + besoins[r] + ' cellule(s) ; seuls les modèles complets à 1 exemplaire au moins sont tirés)');
      }
    });
    if (manques.length) {
      return echec('Bibliothèque insuffisante : ' + manques.join(', ') + '.');
    }

    // Candidats
    var jonctions = jonctionsInterieures(F), modeles = doc.modeles;
    var est5x5 = F.id === '5x5', estHex = F.nbCotes === 6, avecPose = est5x5 || estHex, ctx5 = null, ctxH = null, paires = null, variees = false;
    if (estHex) {
      // hexagonal (docs/72, docs/79, docs/80) : composition, 6 villes (trèfle, ou « dispositions variées »), recherche exhaustive des rotations des intérieures
      if (entierValide(options.candidats, 0) === 0) nbCandidats = CANDIDATS_DEFAUT_HEX;
      essaisMax = Math.max(nbCandidats, Math.min(ESSAIS_MAX_BORNE, entierValide(options.essaisMax, Math.max(ESSAIS_MIN_HEX, nbCandidats * FACTEUR_ESSAIS))));
      Object.keys(LIBELLES_CAUSE_HEX).forEach(function (k) { rejets[k] = 0; });
      libelles = Object.assign({}, LIBELLES_CAUSE, LIBELLES_CAUSE_HEX, { cinq_contre_deux: '« 4 contre 2 »' });
      ctxH = contexteHex(doc, F, modelesDispo, cellules, options.dispositionsVariees === true);
    } else if (est5x5) {
      if (entierValide(options.candidats, 0) === 0) nbCandidats = CANDIDATS_DEFAUT_5X5; // défaut propre au 5×5 (option absente ou invalide)
      // un essai 5×5 est une composition, acceptée environ 4 fois sur 10 : au moins ESSAIS_MIN_5X5 essais si l'appelant n'en fixe pas
      essaisMax = Math.max(nbCandidats, Math.min(ESSAIS_MAX_BORNE, entierValide(options.essaisMax, Math.max(ESSAIS_MIN_5X5, nbCandidats * FACTEUR_ESSAIS))));
      Object.keys(LIBELLES_CAUSE_5X5).forEach(function (k) { rejets[k] = 0; });
      libelles = Object.assign({}, LIBELLES_CAUSE, LIBELLES_CAUSE_5X5, { cinq_contre_deux: '« 6 contre 2 »' });
      ctx5 = contexte5x5(doc, F, modelesDispo, cellules);
    } else {
      variees = options.jonctionsVariees !== false;
      paires = pairesJonctionsCases(F, variees);
    }
    var bons = [], essais = 0, tronques = 0, echecsStructurels = 0, dernierStructurel = null, abandon = null;
    var ctx4 = avecPose ? null : contexte4x4(doc, F, modelesDispo, cellules);
    while (bons.length < nbCandidats && essais < essaisMax) {
      if (echecsStructurels >= ECHECS_STRUCTURELS_MAX) { abandon = dernierStructurel; break; } // la bibliothèque ne pourra pas donner de plateau
      essais++;
      var tuiles, jetons, ev, cand;
      if (avecPose) { // 5×5 : 8 villes du motif par défaut, place et orientation des centrales ; hexagonal : 6 villes, rotations des intérieures
        var c5 = est5x5 ? candidat5x5(ctx5, rng) : candidatHex(ctxH, rng);
        if (c5.tronque) tronques++;
        if (c5.cause === 'jonction_ports' || c5.cause === 'villes_ports' || c5.cause === 'cases_moities' || c5.cause === 'connexions' || c5.cause === 'stock_insuffisant') { dernierStructurel = c5.cause; echecsStructurels++; } else echecsStructurels = 0;
        if (c5.cause) { rejets[c5.cause]++; continue; }
        c5.acceptes.forEach(function (a) { // toutes les poses acceptées de la composition sont des candidats
          var c = { version: doc.version, grille: F.id, modeles: modeles, plateau: { tuiles: a.tuiles, jetons: a.jetons } };
          if (M.validerPlateau(c).erreurs.length) { rejets.plateau_invalide++; return; }
          var pn = penaliteDe(c, a.ev, est5x5);
          bons.push({ disposition: a.disposition, tuiles: a.tuiles, jetons: a.jetons, ev: a.ev, pen: pn, raccords: pn.raccords, malReliees: pn.malReliees, S: a.ev.crit.S, penalite: pn.valeur });
        });
        continue;
      } else { // 4×4 : tirage, cases égales entre moitiés, orientation des centrales selon les ports (tuilesOrientees4x4), villes
        var c4 = tuilesOrientees4x4(ctx4, rng);
        if (c4.cause) { rejets[c4.cause]++; dernierStructurel = c4.cause; echecsStructurels++; continue; }
        echecsStructurels = 0;
        tuiles = c4.tuiles;
        jetons = tirerVilles(jonctions, rng, paires);
        cand = { version: doc.version, grille: F.id, modeles: modeles, plateau: { tuiles: tuiles, jetons: jetons } };
        if (M.validerPlateau(cand).erreurs.length) { rejets.plateau_invalide++; continue; }
        ev = evaluer(cand);
        if (!ev.ok) { rejets[ev.cause]++; continue; }
      }
      var pen = penaliteDe(cand, ev, est5x5);
      bons.push({ tuiles: tuiles, jetons: jetons, ev: ev, pen: pen, raccords: pen.raccords, malReliees: pen.malReliees, S: ev.crit.S, penalite: pen.valeur });
    }

    if (!bons.length) {
      var detail = Object.keys(rejets).filter(function (k) { return rejets[k]; })
        .map(function (k) { return libelles[k] + ' : ' + rejets[k]; }).join(', ');
      var conseil = abandon ? ' Abandon après ' + echecsStructurels + ' échecs consécutifs : ' + expliquerManquePorts(abandon, F)
        : avecPose && ((rejets.connexions || 0) + (rejets.villes_ports || 0)) * 2 >= essais
        ? ' Les tuiles de cette bibliothèque ne donnent presque jamais de plateau très connecté : ' + expliquerManquePorts((rejets.connexions || 0) >= (rejets.villes_ports || 0) ? 'connexions' : 'villes_ports', F)
        : rejets.villes_proches * 2 >= essais
        ? ' Les tuiles de cette bibliothèque rapprochent presque toujours deux villes à moins de 3 cases (règles R1 à R4 non respectées) : utilisez des tuiles conformes, comme celles du catalogue.'
        : ' Modifiez la bibliothèque ou essayez une autre graine.';
      var echecFinal = echec('Aucun plateau acceptable en ' + essais + ' essais' + (detail ? ' (' + detail + ')' : '') + '.' + conseil +
        (tronques ? ' ' + tronques + ' recherche(s) d’orientation interrompue(s) (budget de calcul dépassé).' : ''), essais);
      if (avecPose) echecFinal.orientationsTronquees = tronques;
      return echecFinal;
    }

    // Bons candidats. 4×4 : S ≤ Smin + tolérance ; à S égal, pénalité minimale ; puis (préférence) AFFINAGE_MAX d'entre eux, tirés au
    // hasard, sont affinés pour le rythme et l'équilibre des accès (affiner) ; on garde le meilleur : chaîne au-delà de 3, puis écart
    // des portes d'accès au-delà de 1, puis chaîne ; égalités au hasard.
    // 5×5 (docs/53 § 3) : S n'est que la dernière préférence (S >= 5 est déjà rejeté) ; partage symétrique d'abord (docs/18, décision 2
    // du 2026-10-19 : si un candidat valide est symétrique, seuls les symétriques restent ; sinon tous) ; AFFINAGE_MAX candidats tirés au
    // hasard parmi ceux dont la chaîne dépasse d'au plus `tolerance` la plus courte sont affinés, et le plateau rendu est le meilleur selon
    // [partage non symétrique, chaîne, raccords morts, points d'articulation, S] ; égalités au hasard.
    var Smin = Math.min.apply(null, bons.map(function (x) { return x.S; }));
    var affinage = options.affinage !== false, parmi, finalistes;
    if (estHex) {
      // hexagonal (docs/80) : S minimal d'abord (chaque composition ne rend déjà que ses poses de S minimal ; tolérance 0 par défaut), puis
      // partage symétrique préféré, affinage des rotations sans sortir de S, chaîne, raccords morts, points d'articulation ; égalités au hasard
      var tolH = typeof options.tolerance === 'number' && options.tolerance >= 0 ? options.tolerance : 0;
      parmi = bons.filter(function (x) { return x.S <= Smin + tolH; });
      var symH = parmi.filter(function (x) { return x.ev.crit.partageSymetrique; });
      if (symH.length) parmi = symH; // préférence, jamais un rejet
      var classesH = melanger(parmi.slice(), rng);
      finalistes = (affinage ? classesH.slice(0, AFFINAGE_MAX) : [classesH[0]]).map(function (x) {
        var a = affinage ? affiner(x, doc, F, Smin + tolH, rng)
          : { tuiles: x.tuiles, ev: x.ev, penalite: x.pen, note: noteRythme({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: x.tuiles, jetons: x.jetons } }) };
        var artsH = pointsArticulation(a.note.graphe);
        return { tuiles: a.tuiles, jetons: x.jetons, disposition: x.disposition, ev: a.ev, raccords: a.penalite.raccords, malReliees: a.penalite.malReliees, S: a.ev.crit.S, note: a.note, articulations: artsH,
          cle: [a.ev.crit.partageSymetrique ? 0 : 1, a.ev.crit.S, a.note.chaine, a.penalite.raccords, artsH] };
      });
    } else if (est5x5) {
      parmi = bons.filter(function (x) { return x.ev.crit.partageSymetrique; });
      if (!parmi.length) parmi = bons; // préférence, jamais un rejet : un partage non symétrique reste possible
      parmi.forEach(function (x) {
        var d = { version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: x.tuiles, jetons: x.jetons } };
        x.chaine = GR.rythme(d, x.ev.graphe).chaineMax;
        x.alea = rng();
      });
      // variété des placements : les finalistes sont tirés au hasard parmi les candidats dont la chaîne dépasse d'au plus `tolerance`
      // la plus courte (comme S en 4×4), puis départagés par les préférences
      var chMin = Math.min.apply(null, parmi.map(function (x) { return x.chaine; }));
      parmi = parmi.filter(function (x) { return x.chaine <= chMin + tolerance; });
      var classes = melanger(parmi.slice(), rng);
      finalistes = (affinage ? classes.slice(0, AFFINAGE_MAX) : [classes[0]]).map(function (x) {
        var a = affinage ? affiner(x, doc, F, GR.SEUIL_S - 1, rng)
          : { tuiles: x.tuiles, ev: x.ev, penalite: x.pen, note: noteRythme({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: x.tuiles, jetons: x.jetons } }) };
        var arts = pointsArticulation(a.note.graphe);
        return { tuiles: a.tuiles, jetons: x.jetons, ev: a.ev, raccords: a.penalite.raccords, malReliees: a.penalite.malReliees, S: a.ev.crit.S, note: a.note, articulations: arts,
          cle: [a.ev.crit.partageSymetrique ? 0 : 1, a.note.chaine, a.penalite.raccords, arts, a.ev.crit.S] };
      });
    } else {
      parmi = bons.filter(function (x) { return x.S <= Smin + tolerance; });
      var penMin = {};
      parmi.forEach(function (x) { penMin[x.S] = Math.min(penMin[x.S] === undefined ? Infinity : penMin[x.S], x.penalite); });
      parmi = parmi.filter(function (x) { return x.penalite === penMin[x.S]; });
      finalistes = (affinage ? melanger(parmi, rng).slice(0, AFFINAGE_MAX) : [parmi[entier(rng, parmi.length)]]).map(function (x) {
        var a = affinage ? affiner(x, doc, F, Smin + tolerance, rng)
          : { tuiles: x.tuiles, ev: x.ev, penalite: x.pen, note: noteRythme({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: x.tuiles, jetons: x.jetons } }) };
        var arts4 = pointsArticulation(a.note.graphe); // docs/18 (décision 4, 2026-10-18) : la préférence anti-goulets s'étend au 4×4
        return { tuiles: a.tuiles, jetons: x.jetons, ev: a.ev, raccords: a.penalite.raccords, malReliees: a.penalite.malReliees, S: a.ev.crit.S, note: a.note, articulations: arts4,
          cle: [a.note.cle[0], Math.max(0, a.note.cle[1] - 1), a.note.cle[2], arts4] };
      });
    }
    var choisi = null, nbEgaux = 0;
    finalistes.forEach(function (x) {
      if (!choisi || clePlusPetite(x.cle, choisi.cle)) { choisi = x; nbEgaux = 1; }
      else if (!clePlusPetite(choisi.cle, x.cle)) { nbEgaux++; if (rng() * nbEgaux < 1) choisi = x; }
    });

    // Document final : modèles et autres champs inchangés, plateau remplacé
    var sortie = cloner(doc);
    sortie.grille = F.id;
    sortie.plateau = { tuiles: cloner(choisi.tuiles), jetons: cloner(choisi.jetons) };
    var validation = M.validerPlateau(sortie);

    var crit = choisi.ev.crit;
    var score = {
      S: crit.S, ecartMax: crit.ecartMax, partage: crit.partage, D: crit.D,
      raccordsMorts: choisi.raccords, jonctionsMalReliees: choisi.malReliees, sortiesMin: choisi.ev.sortiesMin,
      bons: parmi.length, Smin: Smin
    };
    // rythme, accès au centre, cases par moitié (docs/18, docs/45) : mesures du plateau rendu, en information
    var gS = GR.construire(sortie, { villesTraversables: false }), ryS = GR.rythme(sortie, gS), acS = GR.accesCentre(sortie, gS, { sansFlot: true }), moS = GR.casesParMoitie(sortie, gS);
    score.chaine = ryS.chaineMax;
    score.distMax = ryS.distMax;
    score.acces = { vert: acS.portes.vert, rouge: acS.portes.rouge, ecart: acS.ecart };
    score.cases = { total: gS.cases.size + moS.jonctions.vert + moS.jonctions.rouge + moS.jonctions.milieu, vert: moS.vert, rouge: moS.rouge, ecart: moS.ecart };
    if (avecPose) { // compteurs propres au 5×5 et à l'hexagonal (le 4×4 garde exactement son rapport et son score)
      var portsJn = portsParJonction(sortie), cxS = GR.connexions(sortie, gS);
      score.portsParJonction = portsJn;
      score.connexions = { cases: cxS.cases, faibles: cxS.faibles, part: cxS.part, degreMoyen: cxS.degreMoyen, parDegre: cxS.parDegre };
      score.articulations = choisi.articulations;
      score.jonctions3 = portsJn.filter(function (p) { return p >= MIN_PORTS_VILLE_5X5; }).length;
      score.jonctionsAMoins2 = portsJn.filter(function (p) { return p < MIN_PORTS_JONCTION_5X5; }).length;
      score.orientationsTronquees = tronques;
      score.placementsAdmissibles = placementsAdmissibles5x5(sortie);
      score.partageSymetrique = crit.partageSymetrique;
      score.positionsParDefaut = true; // 5×5 : 8 villes du motif PM.graphe.MOTIF_VILLES_5X5 ; hexagonal : voir ci-dessous
      if (estHex) {
        var dispoS = cleDisposition(choisi.jetons.map(function (j) { return j.i; }));
        score.positionsParDefaut = dispoS === cleDisposition(F.TREFLE); // le trèfle
        score.disposition = choisi.jetons.map(function (j) { return j.i; });
        score.dispositionsVariees = options.dispositionsVariees === true;
      }
    }
    var nomsVilles = choisi.jetons.map(function (j) { return '(' + j.i + ',' + j.j + ')'; }).join(' ');
    rapport.push('Graine « ' + graine + ' » : ' + bons.length + ' candidat(s) valide(s) en ' + essais + ' essai(s), tirage parmi ' +
      parmi.length + ' bon(s) candidat(s) (S = ' + Smin + (tolerance && !estHex ? ' à ' + (Smin + tolerance) : '') + ')' + (affinage ? ', dont ' + finalistes.length + ' affiné(s) pour le rythme.' : ', sans affinage du rythme.'));
    if (estHex) {
      rapport.push('6 villes ' + (score.positionsParDefaut ? 'en trèfle (disposition par défaut)' : 'en disposition variée') + ' aux sièges ' + choisi.jetons.map(function (j) { return j.i; }).join(', ') +
        ' (3 par camp), sur des sièges à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins, à 4 pas au moins l’une de l’autre ; les 18 autres sièges sont des campements.');
      rapport.push('Rotations des intérieures cherchées parmi toutes les combinaisons (exhaustif), S minimal retenu ; ' + score.jonctions3 + ' siège(s) sur 24 à ' + MIN_PORTS_VILLE_5X5 +
        ' ports au moins, aucun à moins de ' + MIN_PORTS_JONCTION_5X5 + '.');
      rapport.push('Connexions par case : ' + score.connexions.faibles + ' case(s) à 2 connexions ou moins sur ' + score.connexions.cases + ' (visé : moins de 5 %), ' +
        (Math.round(score.connexions.degreMoyen * 100) / 100).toString().replace('.', ',') + ' connexions par case en moyenne ; points d’articulation : ' + score.articulations + '.');
    } else if (est5x5) {
      rapport.push('8 villes aux positions par défaut ' + nomsVilles + ' (4 par camp), sur des jonctions à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins, sans case qui desserve deux villes ; les 8 autres jonctions sont des campements.');
      rapport.push('Centrales placées et orientées pour ces villes : ' + score.jonctions3 + ' jonction(s) sur 16 à ' + MIN_PORTS_VILLE_5X5 +
        ' ports au moins, aucune à moins de ' + MIN_PORTS_JONCTION_5X5 + '.');
      rapport.push('Connexions par case : ' + score.connexions.faibles + ' case(s) à 2 connexions ou moins sur ' + score.connexions.cases + ' (visé : moins de 5 %), ' +
        (Math.round(score.connexions.degreMoyen * 100) / 100).toString().replace('.', ',') + ' connexions par case en moyenne ; points d’articulation : ' + score.articulations + '.');
    } else {
      rapport.push('Villes ' + nomsVilles + ' ; les autres jonctions sont des campements' +
        (paires ? (variees ? ' (jonctions variées).' : ' (rangée centrale).') : '.'));
    }
    rapport.push('Score S (somme des écarts sur les ' + GR.nbVilles(F.id) + ' rangs) : ' + crit.S + ' ; écart maximal : ' + crit.ecartMax + ' pas.');
    rapport.push('Villes plus proches du joueur vert : ' + crit.partage[1] + ', du joueur rouge : ' + crit.partage[2] + ', à égalité : ' + crit.partage.egalite +
      (avecPose ? (crit.partageSymetrique ? ' (partage symétrique).' : ' (partage non symétrique : aucun candidat valide n’était symétrique ; information).') : '.'));
    rapport.push('Cases : ' + score.cases.total + ' (moitié verte ' + score.cases.vert + ', moitié rouge ' + score.cases.rouge + (avecPose ? ', le reste sur la rangée neutre et les jonctions du milieu' : ', le reste sur les jonctions du milieu') + ')' +
      (est5x5 ? ' ; ' + score.placementsAdmissibles + ' placement(s) des 8 villes en 2-2-2-2 admissible(s) sur ce plateau.' : (estHex ? ' ; ' + score.placementsAdmissibles + ' disposition(s) symétrique(s) des 6 villes admissible(s) sur ce plateau.' : '.')));
    rapport.push('Rythme : au plus ' + score.chaine + ' case(s) d’affilée sans jonction, passage ni raccourci (cible ' + GR.CHAINE_CIBLE + ') ; accès au centre : ' +
      score.acces.vert + ' porte(s) côté vert, ' + score.acces.rouge + ' côté rouge (écart ' + score.acces.ecart + ').');
    rapport.push('Raccords morts (murs voulus exclus) : ' + score.raccordsMorts + (avecPose ? '' : ' ; jonctions mal reliées : ' + score.jonctionsMalReliees) + ' ; sorties minimales d\'une case d\'apparition : ' + score.sortiesMin + '.');
    if (tronques) rapport.push('Attention : ' + tronques + ' recherche(s) d’orientation interrompue(s) (budget de calcul dépassé) : l’orientation retenue n’est peut-être pas la meilleure.');
    if (validation.erreurs.length) rapport.push('Attention : ' + validation.erreurs[0].message);

    return {
      ok: validation.erreurs.length === 0, doc: sortie, graine: graine, essais: essais, candidats: bons.length,
      score: score, rapport: rapport,
      raison: validation.erreurs.length ? validation.erreurs[0].message : '', rejets: rejets
    };
  }

  /* ------------------------------------------------------------------ */
  /* Interface : boîte de dialogue « Plateau aléatoire »                 */
  /* ------------------------------------------------------------------ */

  var cptId = 0;

  function el(d, nom, classe, texte) {
    var e = d.createElement(nom);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  /** Miniature SVG (texte) d'un plateau généré, avec PM.rendu (résolu à l'appel : ordre de chargement). */
  function svgApercu(doc) {
    var R = PM.rendu, F = M.formatDuDocument(doc), C = F.COTE, s = [];
    if (F.nbCotes === 6) { // hexagonal : repère centré (origine au centre du plateau), villes en disques aux sièges
      var W = F.PLATEAU.largeur, H = F.PLATEAU.hauteur;
      s.push('<svg xmlns="http://www.w3.org/2000/svg" class="pm-generateur-svg" viewBox="' + (-W / 2 - 4) + ' ' + (-H / 2 - 4) + ' ' + (W + 8) + ' ' + (H + 8) +
        '" role="img" aria-label="Aperçu du plateau généré">');
      doc.plateau.tuiles.forEach(function (t) {
        var m = M.modeleParId(doc, t.modeleId), o = F.positionCellule(t.col, t.lig);
        if (!m || !o) return;
        s.push('<g transform="translate(' + o.x + ' ' + o.y + ')">' + R.contenuTuile(m, { rot: t.rot, camp: F.campCellule(t.col, t.lig) || 'neutre', format: F }) + '</g>');
      });
      doc.plateau.jetons.forEach(function (j) {
        var sg = F.sieges[j.i];
        if (sg) s.push('<circle cx="' + sg.x + '" cy="' + sg.y + '" r="' + (F.DIAMETRE_JETON / 2) + '" fill="none" stroke="currentColor" stroke-width="2"/>');
      });
      s.push('</svg>');
      return s.join('');
    }
    var cote = F.GRILLE.colonnes * C, haut = F.GRILLE.lignes * C;
    s.push('<svg xmlns="http://www.w3.org/2000/svg" class="pm-generateur-svg" viewBox="-4 -4 ' + (cote + 8) + ' ' + (haut + 8) +
      '" role="img" aria-label="Aperçu du plateau généré">');
    doc.plateau.tuiles.forEach(function (t) {
      var m = M.modeleParId(doc, t.modeleId);
      if (!m) return;
      s.push('<g transform="translate(' + (t.col * C) + ' ' + (t.lig * C) + ')">' +
        R.contenuTuile(m, { rot: t.rot, camp: F.campCellule(t.col, t.lig) || 'neutre', format: F }) + '</g>');
    });
    doc.plateau.jetons.forEach(function (j) { s.push(R.contenuJeton(j.type, j.i * C, j.j * C, F)); });
    s.push('</svg>');
    return s.join('');
  }

  /** Remplit `conteneur` avec le formulaire du générateur. `etat` : état partagé. */
  function remplir(conteneur, etat) {
    var d = conteneur.ownerDocument || document, n = ++cptId;
    while (conteneur.firstChild) conteneur.removeChild(conteneur.firstChild);
    var racine = el(d, 'div', 'pm-generateur');
    var resultat = null;

    var F = M.formatDuDocument(etat.doc());
    if (F.nbCotes === 6) {
      racine.appendChild(el(d, 'p', 'pm-generateur-explication',
        'Tire un plateau hexagonal de 19 tuiles (7 intérieures, 6 bords, 6 coins) dans la bibliothèque, dans la limite du stock : 6 villes, 3 par camp, à 4 pas d’écart au moins ' +
        '(en trèfle par défaut ; l’option « dispositions variées » tire parmi le trèfle, son miroir et 8 autres dispositions), les 18 autres sièges sont des campements. ' +
        'Les rotations des intérieures sont cherchées parmi toutes les combinaisons et la meilleure est gardée (S minimal) ; autant de cases dans la moitié verte que dans la moitié rouge. ' +
        'La même graine redonne le même plateau.'));
    } else racine.appendChild(el(d, 'p', 'pm-generateur-explication',
      'Tire un plateau ' + F.GRILLE.colonnes + '×' + F.GRILLE.lignes + ' complet dans la bibliothèque (un modèle peut servir plusieurs fois, la variété est favorisée ; le poids du modèle, à défaut ses exemplaires, pèse dans le tirage) : ' + GR.nbVilles(F.id) + ' villes à 3 cases d\'écart au moins, ' +
      'les autres jonctions sont des campements' + (F.id === '4x4' ? ' (les deux campements sont placés au mieux parmi 12 paires équilibrées, ou dans la rangée centrale si l’option « jonctions variées » est décochée)' : ' (villes aux positions par défaut (1,1) (4,1) (2,2) (3,2) (2,3) (3,3) (1,4) (4,4), 4 par camp, sur des jonctions à 3 ports au moins, sans case qui desserve deux villes ; le générateur choisit la place et l’orientation des centrales ; partage symétrique préféré ; environ 57 cases, dont moins de 5 % à 2 connexions)') + ' ; ' +
      'autant de cases dans la moitié verte que dans la moitié rouge ; centrales orientées selon les ports puis pour le rythme (au plus 3 cases d’affilée sans jonction, passage ni raccourci, visé) et l’équilibre des accès au centre ; ' +
      'plateau équilibré tiré au hasard parmi les meilleurs candidats. ' +
      'La même graine redonne le même plateau.'));

    // Graine
    var ligneGraine = el(d, 'p', 'pm-generateur-ligne');
    var labGraine = el(d, 'label', 'pm-generateur-libelle', 'Graine');
    var champ = el(d, 'input', 'pm-generateur-graine');
    champ.type = 'text';
    champ.id = 'pm-generateur-graine-' + n;
    champ.value = nouvelleGraine();
    champ.maxLength = 40;
    champ.autocomplete = 'off';
    labGraine.setAttribute('for', champ.id);
    var btnGraine = el(d, 'button', 'pm-generateur-bouton', 'Nouvelle graine');
    btnGraine.type = 'button';
    btnGraine.addEventListener('click', function () { champ.value = nouvelleGraine(); champ.focus(); });
    ligneGraine.appendChild(labGraine);
    ligneGraine.appendChild(champ);
    ligneGraine.appendChild(btnGraine);
    racine.appendChild(ligneGraine);

    // Option « jonctions variées » (4×4 seulement : le 5×5 pose ses villes aux positions par défaut) : cochée par défaut (12 paires de campements) ; décochée, ils restent dans la rangée centrale
    var caseVariees = null, caseDispo = null;
    if (F.nbCotes === 6) { // hexagonal : trèfle par défaut, ou dispositions variées (docs/80)
      var ligneDispo = el(d, 'p', 'pm-generateur-ligne');
      caseDispo = el(d, 'input', 'pm-generateur-variees');
      caseDispo.type = 'checkbox';
      caseDispo.checked = false;
      caseDispo.id = 'pm-generateur-dispositions-' + n;
      var labDispo = el(d, 'label', 'pm-generateur-libelle', 'Dispositions variées (les 6 villes se placent en trèfle ou dans l’une des 9 autres dispositions symétriques ; décochée, toujours en trèfle)');
      labDispo.setAttribute('for', caseDispo.id);
      ligneDispo.appendChild(caseDispo);
      ligneDispo.appendChild(labDispo);
      racine.appendChild(ligneDispo);
    }
    if (F.id === '4x4') {
      var ligneVariees = el(d, 'p', 'pm-generateur-ligne');
      caseVariees = el(d, 'input', 'pm-generateur-variees');
      caseVariees.type = 'checkbox';
      caseVariees.checked = true;
      caseVariees.id = 'pm-generateur-variees-' + n;
      var labVariees = el(d, 'label', 'pm-generateur-libelle', 'Jonctions variées (les deux campements peuvent sortir de la rangée centrale : un côté vert, un côté rouge, pour garder autant de cases de chaque côté ; décochée, ils restent dans la rangée centrale)');
      labVariees.setAttribute('for', caseVariees.id);
      ligneVariees.appendChild(caseVariees);
      ligneVariees.appendChild(labVariees);
      racine.appendChild(ligneVariees);
    }

    // Avertissement si le plateau courant n'est pas vide
    var courant = etat.doc().plateau;
    if (courant.tuiles.length || courant.jetons.length) {
      var av = el(d, 'p', 'pm-generateur-avertissement',
        'Le plateau actuel sera remplacé (Ctrl+Z pour revenir).');
      av.setAttribute('role', 'note');
      racine.appendChild(av);
    }

    // Actions
    var actions = el(d, 'p', 'pm-generateur-actions');
    var btnGenerer = el(d, 'button', 'pm-generateur-bouton pm-generateur-principal', 'Générer');
    btnGenerer.type = 'button';
    var btnAppliquer = el(d, 'button', 'pm-generateur-bouton', 'Appliquer au plateau');
    btnAppliquer.type = 'button';
    btnAppliquer.disabled = true;
    actions.appendChild(btnGenerer);
    actions.appendChild(btnAppliquer);
    racine.appendChild(actions);

    // Résultat
    var zone = el(d, 'div', 'pm-generateur-resultat');
    zone.setAttribute('aria-live', 'polite');
    racine.appendChild(zone);

    btnGenerer.addEventListener('click', function () {
      if (btnGenerer.disabled) return;
      if (!champ.value.trim()) champ.value = nouvelleGraine();
      var options = { graine: champ.value, jonctionsVariees: !!(caseVariees && caseVariees.checked), dispositionsVariees: !!(caseDispo && caseDispo.checked) };
      // Calcul synchrone : le bouton est désactivé et annonce la génération, puis le calcul part au tour suivant
      // pour que le navigateur affiche cet état avant d'être occupé.
      btnGenerer.disabled = true;
      btnAppliquer.disabled = true;
      btnGenerer.textContent = 'Génération…';
      setTimeout(function () {
        try { afficher(generer(etat.doc(), options)); } finally {
          btnGenerer.disabled = false;
          btnGenerer.textContent = 'Générer';
        }
      }, 0);
    });

    /** Affiche le résultat d'une génération dans la zone de résultat. */
    function afficher(r) {
      resultat = r;
      champ.value = resultat.graine;
      while (zone.firstChild) zone.removeChild(zone.firstChild);
      if (!resultat.ok) {
        zone.appendChild(el(d, 'p', 'pm-generateur-erreur', resultat.raison));
        btnAppliquer.disabled = true;
        return;
      }
      var apercu = el(d, 'div', 'pm-generateur-apercu');
      apercu.innerHTML = svgApercu(resultat.doc); // SVG construit par PM.rendu (identifiants échappés par rendu.js)
      zone.appendChild(apercu);
      var liste = el(d, 'ul', 'pm-generateur-resume');
      resultat.rapport.forEach(function (t) { liste.appendChild(el(d, 'li', null, t)); });
      zone.appendChild(liste);
      btnAppliquer.disabled = false;
    }

    btnAppliquer.addEventListener('click', function () {
      if (!resultat || !resultat.ok) return;
      var r = resultat, libelle = 'plateau aléatoire (graine ' + r.graine + ')';
      var fait = etat.appliquer(function () { return r.doc; }, libelle);
      if (!fait.ok) return;
      if (PM.dialogue) PM.dialogue.fermer();
      etat.signaler('Plateau aléatoire appliqué (graine ' + r.graine + '). Ctrl+Z pour revenir.', 'info');
    });

    conteneur.appendChild(racine);
    racine.champGraine = champ;
    racine.caseVariees = caseVariees;
    racine.caseDispositions = caseDispo;
    racine.boutonGenerer = btnGenerer;
    racine.boutonAppliquer = btnAppliquer;
    return racine;
  }

  /** Ouvre le générateur dans la boîte de dialogue commune. */
  function ouvrir(etat) {
    var contenu = PM.dialogue.ouvrir('Plateau aléatoire');
    var racine = remplir(contenu, etat);
    racine.champGraine.focus();
    return racine;
  }

  PM.generateur = {
    generer: generer,
    critere: critere,
    pairesJonctionsCases: pairesJonctionsCases,
    placementsVilles5x5: placementsVilles5x5,
    portsParJonction: portsParJonction,
    contexteDocument5x5: contexteDocument5x5,
    tuilesOrientees5x5: tuilesOrientees5x5,
    contexteDocument4x4: contexteDocument4x4,
    tuilesOrientees4x4: tuilesOrientees4x4,
    equilibrerMoities: equilibrerMoities,
    ecartMoities: ecartMoities,
    noteRythme: noteRythme,
    placementsAdmissibles5x5: placementsAdmissibles5x5,
    placementsAdmissibles: placementsAdmissibles,
    meilleurPlacementVilles: meilleurPlacementVilles,
    placerVilles: placerVilles,
    composer5x5: composer5x5,
    contexteDocumentHex: contexteDocumentHex,
    tuilesOrienteesHex: tuilesOrienteesHex,
    orienterTuiles: orienterTuiles,
    orienter: orienter,
    SEUIL_REJET_S_HEX: SEUIL_REJET_S_HEX,
    composerHex: composerHex,
    rechercherPoseHex: rechercherPoseHex,
    candidatHex: candidatHex,
    optionsCelluleHex: optionsCelluleHex,
    dispositionsSymetriquesHex: dispositionsSymetriquesHex,
    DISPOSITIONS_VARIEES_HEX: DISPOSITIONS_VARIEES_HEX,
    CANDIDATS_DEFAUT_HEX: CANDIDATS_DEFAUT_HEX,
    placementsLibresHex: placementsLibresHex,
    rechercherPose5x5: rechercherPose5x5,
    candidat5x5: candidat5x5,
    optionsCellule: optionsCellule,
    evaluer: evaluer,
    FEUILLES_PAR_ESSAI: FEUILLES_PAR_ESSAI,
    CANDIDATS_DEFAUT_5X5: CANDIDATS_DEFAUT_5X5,
    AFFINAGE_MAX: AFFINAGE_MAX,
    mesureRapide: mesureRapide,
    REPARTITION_VILLES_5X5: REPARTITION_VILLES_5X5,
    tirerTuiles: tirerTuiles,
    modelesParGabarit: modelesParGabarit,
    cellulesDuFormat: cellulesDuFormat,
    facteurRepetition: facteurRepetition,
    PENALITE_REPETITION: PENALITE_REPETITION,
    hacher: hacher,
    causeRejet: causeRejet,
    sontMiroirs: sontMiroirs,
    mulberry32: mulberry32,
    nouvelleGraine: nouvelleGraine,
    svgApercu: svgApercu,
    remplir: remplir,
    ouvrir: ouvrir
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.generateur;
})();
