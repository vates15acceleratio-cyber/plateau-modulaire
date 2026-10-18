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
 *  - 5×5 (catalogue « très connecté » de docs/55 ; docs/53 § 3) : composition PAR QUOTAS selon les poids (4 coins, 12 bords, 9 centrales :
 *    3 LC1, 2 LC2, 3 LC3, 1 LC4 avec le catalogue livré), puis PLACEMENT DES VILLES AVANT L'ORIENTATION : un placement 2-3-2 compatible
 *    (aucune case porteuse ne dessert deux villes, chaque ville peut recevoir 3 ports et chaque jonction 2) est tiré, et les centrales
 *    sont orientées pour lui (orienterPourVilles : le moins possible de jonctions-cases à 2 ports) ; jusqu'à ESSAIS_PLACEMENT
 *    placements par candidat ;
 *  - 4×4 : 7 villes ; par défaut (« jonctions variées », docs/18 réponse 3 de 2026-10-18) les 2 jonctions-cases forment l'une des 12 paires
 *    équilibrées (une en j = 1 et une en j = 3, ou les deux en j = 2 : cases égales entre moitiés) ; option décochée : rangée centrale
 *    seulement (3 paires, aucun « 5 contre 2 », docs/22) ;
 *  - villes non traversables (règle du jeu) ;
 *  - REJETS : validerPlateau avec erreur, graphe non connexe, camp sans case d'apparition, deux villes à moins de 3 cases (jamais
 *    produit, docs/18), ville inaccessible, plateau très déséquilibré (« 5 contre 2 », écart > SEUIL_BLOCAGE_ECART), écart > 2 à un
 *    rang de 1 à 7, première ville à des distances différentes, cases inégales entre moitiés ; 5×5 en plus : jonction à moins de
 *    2 ports, ville à moins de 3 ports (ou aucun placement 2-3-2 compatible), plus de 5 % de cases à 2 connexions ou moins
 *    (PM.graphe.connexions), S >= 5 (docs/36, docs/53) ;
 *  - classement par S = Σ |D1(k) − D2(k)| sur les 7 rangs, puis pénalité secondaire (raccords morts au-delà de 2, jonctions à moins
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
  var NB_VILLES = GR.NB_VILLES;
  var SEUIL_ECART = GR.SEUIL_ECART;  // écart toléré à chaque rang (doc 16, b)
  var CANDIDATS_DEFAUT = 200;
  var CANDIDATS_MAX = 1000;       // borne des candidats demandés (au-delà : le calcul synchrone gèlerait l'interface)
  var ESSAIS_MAX_BORNE = 50000;   // borne des essais demandés
  var ECHECS_STRUCTURELS_MAX = 25; // 5×5 : abandon après tant d'essais consécutifs rejetés pour manque de ports (bibliothèque impossible)
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
    for (var j = 1; j < F.GRILLE.lignes; j++) for (var i = 1; i < F.GRILLE.colonnes; i++) res.push({ i: i, j: j });
    return res;
  }

  /** Villes du 5×5 en « 2-3-2 » (docs/18) : définition unique dans PM.graphe (groupes de rangées et nombre de villes par groupe). */
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
   * Les placements de 7 villes en « 2-3-2 » du 5×5 : 2016 tableaux de 7 jonctions {i, j} (ordre de lecture), calculés une fois
   * et gelés (le même objet est rendu à chaque appel : ni copie ni modification possible).
   * 2 villes parmi les 4 jonctions de la rangée j = 1, 3 parmi les 8 des rangées j = 2 et 3, 2 parmi les 4 de la rangée j = 4.
   */
  function placementsVilles5x5() {
    if (CACHE_PLACEMENTS) return CACHE_PLACEMENTS;
    var F = PM.geometrie.format('5x5'), toutes = jonctionsInterieures(F);
    var groupes = REPARTITION_VILLES_5X5.map(function (g) {
      var liste = toutes.filter(function (jn) { return g.rangees.indexOf(jn.j) >= 0; });
      return combinaisons(liste, g.nb);
    });
    var res = [];
    groupes[0].forEach(function (a) { groupes[1].forEach(function (b) { groupes[2].forEach(function (c) { res.push(a.concat(b, c)); }); }); });
    CACHE_PLACEMENTS = geler(res);
    return CACHE_PLACEMENTS;
  }

  /**
   * Jonctions-cases (les jonctions sans ville) que le générateur peut tirer, propres à chaque format.
   *  - sans « jonctions variées » (option décochée, 4×4) : les 3 paires de la rangée centrale (j = 2), qui ne donnent jamais « 5 contre 2 » ;
   *  - jonctions variées (4×4, par défaut) : les paires qui gardent autant de jonctions-cases du côté vert (j = 1) que du côté rouge (j = 3),
   *    pour des cases égales entre moitiés (docs/18) : une en j = 1 et une en j = 3 (9 paires), ou les deux en j = 2 (3 paires) ;
   *    aucune paire d'une même rangée extérieure (règle d'avant, toujours vraie) ;
   *  - 5×5 (docs/18, « 2-3-2 ») : les 2016 ensembles de 9 jonctions-cases, complémentaires des placements de 7 villes ;
   *    l'option « variées » n'a pas de sens en 5×5 (le placement est déjà choisi parmi tous les 2-3-2 admissibles) : même liste.
   * Chaque élément est une liste de {i, j} dans l'ordre de lecture (2 jonctions en 4×4, 9 en 5×5).
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
   * 7 villes (ordre de lecture du plateau) : si `paires` est donné, une paire est tirée comme jonctions-cases et
   * les 7 autres jonctions portent une ville ; sinon 7 jonctions tirées au hasard. Renvoie { villes, casesChemin }.
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
   * Renvoie { S, ecartMax (rangs 1 à 7), premiereEgale, cinqContreDeux, tresDesequilibre, villeInaccessible,
   * partage, D }. S et ecartMax valent null si une ville est inaccessible.
   */
  function critere(e) {
    return {
      S: e.S, ecartMax: e.ecartMax7,
      premiereEgale: e.premiereEgale === true,
      cinqContreDeux: e.cinqContreDeux === true,
      tresDesequilibre: e.tresDesequilibre === true,
      villeInaccessible: e.S === null,
      partage: { 1: e.partage[1], 2: e.partage[2], egalite: e.partage.egalite },
      D: { 1: e.D[1].slice(), 2: e.D[2].slice() }
    };
  }

  /** Rejet par S propre à chaque format (docs/28 § 6) : en 5×5, S >= PM.graphe.SEUIL_S (5, seuil de rejet, distinct du seuil d'alerte par format de PM.graphe.seuilS) rejette le candidat ; en 4×4, S n'est qu'un classement. */
  var REJET_S = { '4x4': false, '5x5': true };

  /**
   * Cause de rejet d'une mesure d'équilibre (une seule chaîne de filtres, pour evaluer, le chemin 5×5 et les outils de mesure) :
   * m = { accessible, cinq (« 5 contre 2 »), ecartMax (rangs 1 à 7), premiereEgale, S } ; renvoie une clé de `rejets` ou null (accepté).
   * Ordre : ville inaccessible (S non mesurable : jamais comparé à un seuil), plateau très déséquilibré (écart > SEUIL_BLOCAGE_ECART,
   * ou « 5 contre 2 » s'il est bloquant), « 5 contre 2 » seul, écart > SEUIL_ECART, première ville inégale, puis S >= SEUIL_S si le format le rejette.
   */
  function causeRejet(m, formatId) {
    if (!m.accessible) return 'ville_inaccessible';
    if ((GR.CINQ_CONTRE_DEUX_BLOQUANT && m.cinq) || m.ecartMax > GR.SEUIL_BLOCAGE_ECART) return 'desequilibre';
    if (m.cinq) return 'cinq_contre_deux';
    if (m.ecartMax > SEUIL_ECART) return 'ecart';
    if (!m.premiereEgale) return 'premiere_ville';
    if (REJET_S[formatId] && m.S >= GR.SEUIL_S) return 'score_s';
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
    if (M.formatDuDocument(docCandidat).id === '5x5') { // 5×5 (docs/53 § 3) : ports des jonctions et des villes, puis cases à 2 connexions
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
      accessible: !res.crit.villeInaccessible, cinq: res.crit.cinqContreDeux, ecartMax: res.crit.ecartMax,
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
   * 0 exemplaire n'est jamais tiré. Le stock à imprimer (exemplaires) peut ainsi dépasser le poids sans changer les plateaux tirés.
   */
  function modelesParGabarit(doc, F) {
    var res = { centrale: [], bord: [], coin: [] };
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) {
      if (!m || !Object.prototype.hasOwnProperty.call(res, m.gabarit) || !M.validerModele(m, F).complet) return;
      if (M.exemplairesValides(m) > 0) res[m.gabarit].push({ id: m.id, poids: M.poidsTirage(m), stock: M.exemplairesValides(m) });
    });
    return res;
  }

  /** Cellules de la grille avec leur gabarit attendu : [{col, lig, gabarit}]. */
  function cellulesDuFormat(F) {
    var res = [];
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

  /** Pénalité secondaire d'un candidat (raccords morts au-delà de 2, jonctions mal reliées, apparition à moins de 2 sorties, 5×5 sans ville équidistante). */
  function penaliteDe(cand, ev, est5x5) {
    var raccords = M.raccordsMorts(cand).filter(function (r) { return r.raison !== 'absent'; }).length;
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
    var est5x5 = F.id === '5x5', p0 = portsParJonction(d);
    // les ports d'abord (docs/18) : l'affinage ne baisse ni le plus petit nombre de ports d'une jonction ni le nombre de jonctions à 3 ports
    var ref = { min: Math.min.apply(null, p0), n3: p0.filter(function (p) { return p >= MIN_PORTS_VILLE_5X5; }).length };
    function portsOk() {
      var p = portsParJonction(d);
      if (Math.min.apply(null, p) < ref.min) return false;
      if (p.filter(function (v) { return v >= MIN_PORTS_VILLE_5X5; }).length < ref.n3) return false;
      return !est5x5 || bon.jetons.every(function (j) { return p[indexJonction(j.i, j.j, F)] >= MIN_PORTS_VILLE_5X5; });
    }
    var note = noteRythme(d), ev = bon.ev, pen = bon.pen;
    // 5×5 (docs/53 § 3) : la chaîne d'abord, puis la distance maximale, puis l'écart des accès ; 4×4 : la note de noteRythme
    var cleDe = est5x5 ? function (x) { return [x.chaine, x.distMax, Math.abs(x.acces.ecart)]; } : function (x) { return x.cle; };
    var centrales = [];
    d.plateau.tuiles.forEach(function (t, k) { if (M.gabaritCellule(t.col, t.lig, F) === 'centrale') centrales.push(k); });
    for (var tour = 0; tour < AFFINAGE_TOURS; tour++) {
      var progres = false;
      melanger(centrales, rng).forEach(function (k) {
        var t = d.plateau.tuiles[k], r0 = t.rot;
        for (var dr = 1; dr < 4; dr++) {
          t.rot = (r0 + dr) % 4;
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
  var BUDGET_NOEUDS = 400000;       // garde-fou de chaque recherche d'orientation (nombre de nœuds, donc déterministe)
  var ESSAIS_PLACEMENT = 12;        // placements de villes essayés par candidat (tirés au hasard parmi les compatibles) avant de le rejeter
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
  function indexJonction(i, j, F) { return (j - 1) * (F.GRILLE.colonnes - 1) + (i - 1); }

  /** Ports par jonction d'un plateau, dans l'ordre de lecture des jonctions (j puis i), d'après les tuiles posées. */
  function portsParJonction(doc) {
    var F = M.formatDuDocument(doc), res = [];
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
   * Options permises de chaque cellule pour un placement de villes (aucune porteuse ne dessert deux villes, docs/53 § 3), et potentiel
   * de ports de chaque jonction (ports qu'elle reçoit si chaque cellule choisit au mieux pour elle). Renvoie null si une cellule n'a
   * plus d'option, ou si une jonction ne peut plus atteindre 2 ports, ou une ville 3 ports (placement incompatible).
   */
  function optionsPermises(options, villes, nJ) {
    var permises = [], potentiel = new Array(nJ).fill(0);
    for (var d = 0; d < options.length; d++) {
      var l = options[d].filter(function (o) { return !desserDeuxVilles(o, villes); });
      if (!l.length) return null;
      var vu = {};
      l.forEach(function (o) { o.jn.forEach(function (y) { vu[y] = 1; }); });
      Object.keys(vu).forEach(function (y) { potentiel[y]++; });
      permises.push(l);
    }
    for (var x = 0; x < nJ; x++) {
      if (potentiel[x] < MIN_PORTS_JONCTION_5X5 || (villes[x] && potentiel[x] < MIN_PORTS_VILLE_5X5)) return null;
    }
    return permises;
  }

  /**
   * Orientation du 5×5 pour un placement de villes donné (docs/53 § 3 : les villes d'abord). Parmi les options permises de chaque cellule
   * (optionsPermises : rotation des centrales, miroir exact d'un bord), cherche par exploration complète avec élagage l'ensemble qui :
   *   1. relie chaque jonction par 2 ports au moins et chaque ville par 3 ports au moins (conditions fermes, sinon choix = null) ;
   *   2. minimise le nombre de jonctions-cases à moins de 3 ports (une jonction-case à 2 ports est une case à 2 connexions).
   * Égalités départagées au hasard (rng à graine fixe). Renvoie { choix: [option par cellule] | null, faibles, noeuds, tronque } ;
   * tronque = vrai si `budget` nœuds ont été dépassés (la meilleure orientation trouvée jusque-là est rendue).
   */
  function orienterPourVilles(permises, villes, F, rng, budget) {
    var nJ = (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1), n = permises.length, x, d;
    var compte = new Array(nJ).fill(0), choix = [];
    var reste = [];
    for (d = 0; d < n; d++) reste.push(new Array(nJ).fill(0));
    for (d = n - 2; d >= 0; d--) {
      var suiv = new Array(nJ).fill(0);
      permises[d + 1].forEach(function (o) { o.jn.forEach(function (y) { suiv[y] = 1; }); });
      for (x = 0; x < nJ; x++) reste[d][x] = reste[d + 1][x] + suiv[x];
    }
    var meilleur = null, cle = Infinity, egaux = 0, noeuds = 0, tronque = false;

    /** Après la cellule `prof` : -1 si une condition ferme ne peut plus être tenue, sinon le nombre de jonctions-cases déjà condamnées à moins de 3 ports. */
    function borne(prof) {
      var lb = 0;
      for (var y = 0; y < nJ; y++) {
        var pot = compte[y] + reste[prof][y];
        if (pot < MIN_PORTS_JONCTION_5X5) return -1;
        if (pot < MIN_PORTS_VILLE_5X5) { if (villes[y]) return -1; lb++; }
      }
      return lb;
    }

    function visiter(prof) {
      if (prof === n) {
        var f = 0;
        for (var y = 0; y < nJ; y++) if (!villes[y] && compte[y] < MIN_PORTS_VILLE_5X5) f++;
        if (f < cle) { cle = f; egaux = 1; meilleur = choix.slice(); } else if (f === cle) { egaux++; if (rng() * egaux < 1) meilleur = choix.slice(); }
        return;
      }
      var opts = permises[prof];
      for (var o = 0; o < opts.length; o++) {
        if (++noeuds > budget) { tronque = true; return; }
        var op = opts[o], k;
        for (k = 0; k < op.jn.length; k++) compte[op.jn[k]]++;
        choix[prof] = op;
        var b = borne(prof);
        if (b >= 0 && b <= cle) visiter(prof + 1);
        for (k = 0; k < op.jn.length; k++) compte[op.jn[k]]--;
        if (tronque) return;
      }
    }
    visiter(0);
    return { choix: meilleur, faibles: meilleur ? cle : null, noeuds: noeuds, tronque: tronque };
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
   * première ville). Renvoie { accessible, S, ecartMax, cinq, partage: {1, 2, egalite}, premiereEgale } (cinq : « 5 contre 2 »).
   */
  function mesurePlacement(P, noeudsVilles) {
    var estVille = new Uint8Array(P.n);
    noeudsVilles.forEach(function (v) { estVille[v] = 1; });
    var d1 = distancesRapides(P, 1, estVille, noeudsVilles), d2 = distancesRapides(P, 2, estVille, noeudsVilles);
    var res = { accessible: true, S: null, ecartMax: null, cinq: false, partage: { 1: 0, 2: 0, egalite: 0 }, premiereEgale: false };
    if (d1.concat(d2).some(function (x) { return !isFinite(x); })) { res.accessible = false; return res; }
    d1.forEach(function (a, k) { var b = d2[k]; if (a < b) res.partage[1]++; else if (b < a) res.partage[2]++; else res.partage.egalite++; });
    var t1 = d1.slice().sort(function (a, b) { return a - b; }), t2 = d2.slice().sort(function (a, b) { return a - b; });
    var S = 0, em = 0;
    t1.forEach(function (a, k) { var e = Math.abs(a - t2[k]); S += e; if (e > em) em = e; });
    res.S = S; res.ecartMax = em; res.premiereEgale = t1[0] === t2[0];
    res.cinq = Math.max(res.partage[1], res.partage[2]) >= GR.SEUIL_CINQ_CONTRE_DEUX;
    return res;
  }

  /** Les deux modèles (objets du document) sont-ils miroirs l'un de l'autre dans le format F (voir estMiroir) ? */
  function sontMiroirs(a, b, F) { return estMiroir(profilModele(a), profilModele(b), F.COTE); }

  /** Contexte 5×5 d'un document (bibliothèque, cellules, placements) : pour tuilesOrientees5x5 hors de generer (outils de mesure). */
  function contexteDocument5x5(doc) {
    var F = M.formatDuDocument(doc);
    return contexte5x5(doc, F, modelesParGabarit(doc, F), cellulesDuFormat(F));
  }

  /** Mesure rapide (celle des placements de candidat5x5) des villes posées sur `doc` : { accessible, S, ecartMax, partage, premiereEgale }. */
  function mesureRapide(doc) {
    var g = GR.construire(doc, { villesTraversables: false, jetons: [] }), P = grapheRapide(g);
    return mesurePlacement(P, doc.plateau.jetons.map(function (j) { return P.idx.get('J' + j.i + ',' + j.j); }));
  }

  /** Contexte de génération 5×5 : profils des modèles, placements de villes en 2-3-2 (avec leur masque de jonctions). */
  function contexte5x5(doc, F, modelesDispo, cellules) {
    var profils = {};
    doc.modeles.forEach(function (m) { if (m && typeof m.id === 'string' && Array.isArray(m.cases)) profils[m.id] = profilModele(m); });
    return {
      doc: doc, F: F, cellules: cellules, modelesDispo: modelesDispo, profils: profils, nbCases: casesParModele(doc), poids: poidsTirables(modelesDispo),
      placements: placementsVilles5x5().map(function (villes) {
        var indices = villes.map(function (jn) { return indexJonction(jn.i, jn.j, F); });
        return { villes: villes, indices: indices, masque: masqueDe(indices) };
      })
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

  function masqueDe(indices) { var m = 0; for (var k = 0; k < indices.length; k++) m |= 1 << indices[k]; return m; }

  /**
   * Placements 2-3-2 compatibles avec une composition, dans l'ordre de ctx.placements : ceux pour lesquels optionsPermises n'est pas
   * nulle (même test, calculé sur des masques de bits pour aller vite). Renvoie [{ pl, villes: [0/1 par jonction], options }] ; les
   * options permises sont calculées à l'essai (essaiDe).
   */
  function placementsCompatibles(ctx, options) {
    var nJ = (ctx.F.GRILLE.colonnes - 1) * (ctx.F.GRILLE.lignes - 1), res = [], cnt = new Int8Array(nJ);
    var bits = options.map(function (l) { return l.map(function (o) { return { jm: masqueDe(o.jn), gm: o.groupes.map(masqueDe) }; }); });
    ctx.placements.forEach(function (pl) {
      var V = pl.masque, d, y;
      cnt.fill(0);
      for (d = 0; d < bits.length; d++) {
        var u = 0, permis = false, l = bits[d];
        for (var q = 0; q < l.length; q++) {
          var ok = true;
          for (var r = 0; r < l[q].gm.length && ok; r++) { var x = l[q].gm[r] & V; if (x & (x - 1)) ok = false; }
          if (ok) { permis = true; u |= l[q].jm; }
        }
        if (!permis) return;
        while (u) { var b = u & -u; cnt[31 - Math.clz32(b)]++; u ^= b; }
      }
      for (y = 0; y < nJ; y++) if (cnt[y] < MIN_PORTS_JONCTION_5X5 || (((V >> y) & 1) && cnt[y] < MIN_PORTS_VILLE_5X5)) return;
      var villes = new Array(nJ).fill(0);
      pl.indices.forEach(function (x) { villes[x] = 1; });
      res.push({ pl: pl, villes: villes, options: options });
    });
    return res;
  }

  /** Essai d'un placement compatible : { pl, villes, permises } (optionsPermises). */
  function essaiDe(c, nJ) { return { pl: c.pl, villes: c.villes, permises: optionsPermises(c.options, c.villes, nJ) }; }

  /**
   * Tuiles d'un candidat 5×5 (appelable seule : outils de mesure, tests) : composition (composer5x5), un placement de villes en 2-3-2
   * tiré parmi ceux que la composition permet (aucune porteuse ne dessert deux villes, assez de ports possibles), puis orientation
   * pour ce placement (orienterPourVilles). Renvoie { cause: 'cases_moities' | 'villes_ports', tronque } en cas d'échec, sinon
   * { tuiles, jetons, faibles, compatibles, noeuds, tronque } ; `ctx.budgetNoeuds` remplace BUDGET_NOEUDS (tests).
   */
  function tuilesOrientees5x5(ctx, rng) {
    var comp = composer5x5(ctx, rng);
    if (comp.cause) return { cause: comp.cause, tronque: false };
    var compat = placementsCompatibles(ctx, comp.options);
    if (!compat.length) return { cause: 'villes_ports', tronque: false };
    var nJ = (ctx.F.GRILLE.colonnes - 1) * (ctx.F.GRILLE.lignes - 1);
    return orienterEssai(ctx, essaiDe(compat[entier(rng, compat.length)], nJ), compat.length, rng);
  }

  /** Oriente les cellules pour un essai de placement { pl, permises, villes } : { tuiles, jetons, faibles, compatibles, noeuds, tronque } ou { cause, tronque }. */
  function orienterEssai(ctx, essai, nbCompatibles, rng) {
    if (!essai.permises) return { cause: 'villes_ports', tronque: false };
    var sol = orienterPourVilles(essai.permises, essai.villes, ctx.F, rng, ctx.budgetNoeuds || BUDGET_NOEUDS);
    if (!sol.choix) return { cause: 'villes_ports', tronque: sol.tronque };
    var tuiles = ctx.cellules.map(function (c, k) {
      var o = sol.choix[k];
      return { modeleId: o.modeleId, col: c.col, lig: c.lig, rot: o.rots[entier(rng, o.rots.length)] };
    });
    var jetons = essai.pl.villes.map(function (jn) { return { i: jn.i, j: jn.j, type: 'capture' }; });
    return { tuiles: tuiles, jetons: jetons, faibles: sol.faibles, compatibles: nbCompatibles, noeuds: sol.noeuds, tronque: sol.tronque };
  }

  /**
   * Tirage d'un candidat 5×5 (docs/53 § 3) : composition, puis jusqu'à ESSAIS_PLACEMENT placements de villes compatibles (au hasard),
   * chacun suivi de l'orientation des centrales pour ce placement et du contrôle complet (evaluer : connexité, écart entre villes,
   * ports, cases à 2 connexions, équilibre). Renvoie { cause, tronque } si rejeté (cause = clé de `rejets`, la plus fréquente des
   * essais), sinon { tuiles, jetons, ev, compatibles, tronque }.
   */
  function candidat5x5(ctx, rng) {
    var comp = composer5x5(ctx, rng);
    if (comp.cause) return { cause: comp.cause, tronque: false };
    var compat = placementsCompatibles(ctx, comp.options);
    if (!compat.length) return { cause: 'villes_ports', tronque: false };
    compat = melanger(compat, rng);
    var raisons = {}, tronque = false, nJ = (ctx.F.GRILLE.colonnes - 1) * (ctx.F.GRILLE.lignes - 1);
    for (var t = 0; t < Math.min(ESSAIS_PLACEMENT, compat.length); t++) {
      var o = orienterEssai(ctx, essaiDe(compat[t], nJ), compat.length, rng);
      if (o.tronque) tronque = true;
      if (o.cause) { raisons[o.cause] = (raisons[o.cause] || 0) + 1; continue; }
      var cand = { version: ctx.doc.version, grille: ctx.F.id, modeles: ctx.doc.modeles, plateau: { tuiles: o.tuiles, jetons: o.jetons } };
      var ev = evaluer(cand);
      if (ev.ok) return { tuiles: o.tuiles, jetons: o.jetons, ev: ev, compatibles: compat.length, tronque: tronque };
      raisons[ev.cause] = (raisons[ev.cause] || 0) + 1;
    }
    return { cause: Object.keys(raisons).sort(function (a, b) { return raisons[b] - raisons[a] || (a < b ? -1 : 1); })[0], tronque: tronque };
  }

  /* ------------------------------------------------------------------ */
  /* Placements de villes admissibles et aide « placer les villes »        */
  /* ------------------------------------------------------------------ */

  /**
   * Placements de 7 villes possibles d'un format, en jonctions {i, j} : 5×5 : les 2016 placements 2-3-2 ; 4×4 : les complémentaires
   * des 12 paires de jonctions-cases équilibrées (pairesJonctionsCases, « jonctions variées »).
   */
  function placementsDuFormat(F) {
    if (F.id === '5x5') return placementsVilles5x5();
    var toutes = jonctionsInterieures(F);
    return (pairesJonctionsCases(F, true) || []).map(function (paire) {
      return toutes.filter(function (jn) { return !paire.some(function (c) { return c.i === jn.i && c.j === jn.j; }); });
    });
  }

  /**
   * Placements ADMISSIBLES d'un plateau posé (les villes posées sont ignorées) : 7 villes (2-3-2 en 5×5) dont deux sont toujours à
   * ECART_PAS_VILLES pas au moins (3 cases d'écart, comme PM.graphe.villesProches : un trajet plus court passerait par une ville plus
   * proche encore) et, en 5×5, toutes sur des jonctions à 3 ports au moins. Renvoie { graphe (sans ville), placements: [[{i, j}]] }.
   */
  function placementsAdmissibles(doc) {
    var F = M.formatDuDocument(doc), g = GR.construire(doc, { villesTraversables: false, jetons: [] });
    var NC = F.GRILLE.colonnes, nJ = (NC - 1) * (F.GRILLE.lignes - 1), conflits = new Array(nJ).fill(0), ports = new Array(nJ).fill(0);
    g.jonctions.forEach(function (jn) {
      var x = indexJonction(jn.i, jn.j, F), d = GR.distances(g, jn.id);
      ports[x] = jn.ports;
      g.jonctions.forEach(function (autre) {
        if (autre.id !== jn.id && d.has(autre.id) && d.get(autre.id) < ECART_PAS_VILLES) conflits[x] |= 1 << indexJonction(autre.i, autre.j, F);
      });
    });
    var minPorts = F.id === '5x5' ? MIN_PORTS_VILLE_5X5 : 0;
    var res = placementsDuFormat(F).filter(function (pl) {
      var masque = 0;
      pl.forEach(function (jn) { masque |= 1 << indexJonction(jn.i, jn.j, F); });
      return pl.every(function (jn) { var x = indexJonction(jn.i, jn.j, F); return ports[x] >= minPorts && !(conflits[x] & masque); });
    });
    return { graphe: g, placements: res };
  }

  /** Nombre de placements admissibles d'un plateau 5×5 posé (placementsAdmissibles : 2-3-2, 3 ports, 3 cases d'écart). */
  function placementsAdmissibles5x5(doc) { return placementsAdmissibles(doc).placements.length; }

  /**
   * Meilleur placement des 7 villes sur le plateau posé de `doc` (aide « placer les villes », docs/18 : l'écart de 3 cases est garanti
   * par le placement) : parmi les placements admissibles (placementsAdmissibles), ceux que le générateur accepterait (causeRejet :
   * ville accessible, ni « 5 contre 2 » ni écart de plus de 2 pas à un rang, première ville égale, S sous le seuil de rejet en 5×5),
   * au plus petit S, puis avec une ville équidistante, puis dans l'ordre des placements (déterministe). Pure, ne modifie pas `doc`.
   * Renvoie { ok, jetons, S, admissibles, acceptes, raison } (raison : phrase de refus si ok est faux).
   */
  function meilleurPlacementVilles(doc) {
    var F;
    try { F = M.formatDuDocument(doc); } catch (e) { return { ok: false, jetons: null, raison: e.message, admissibles: 0, acceptes: 0 }; }
    var tuiles = doc && doc.plateau && Array.isArray(doc.plateau.tuiles) ? doc.plateau.tuiles : [];
    var posees = tuiles.filter(function (t) { return t && M.modeleParId(doc, t.modeleId); }).length;
    if (posees < F.GRILLE.colonnes * F.GRILLE.lignes) {
      return { ok: false, jetons: null, admissibles: 0, acceptes: 0, raison: 'Posez d’abord toutes les tuiles du plateau (' + posees + ' sur ' + (F.GRILLE.colonnes * F.GRILLE.lignes) + ') : les villes se placent sur un plateau complet.' };
    }
    var ad = placementsAdmissibles({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: tuiles, jetons: [] } });
    var regle = F.id === '5x5' ? 'en 2-3-2, sur des jonctions à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins, ' : '';
    if (!ad.placements.length) {
      return { ok: false, jetons: null, admissibles: 0, acceptes: 0, raison: 'Aucun placement des 7 villes (' + regle + 'à ' + PM.geometrie.ECART_MIN_VILLES + ' cases d’écart au moins) n’est possible sur ce plateau : tournez des centrales ou changez des tuiles (une case qui porte deux ports ne doit pas desservir deux villes).' };
    }
    var P = grapheRapide(ad.graphe), raisons = {}, meilleur = null;
    ad.placements.forEach(function (pl, k) {
      var m = mesurePlacement(P, pl.map(function (jn) { return P.idx.get('J' + jn.i + ',' + jn.j); })), raison = causeRejet(m, F.id);
      if (raison) { raisons[raison] = (raisons[raison] || 0) + 1; return; }
      var c = { pl: pl, S: m.S, egal: m.partage.egalite > 0 ? 0 : 1, k: k };
      if (!meilleur || c.S < meilleur.S || (c.S === meilleur.S && c.egal < meilleur.egal)) meilleur = c;
    });
    var acceptes = ad.placements.length - Object.keys(raisons).reduce(function (s, r) { return s + raisons[r]; }, 0);
    if (!meilleur) {
      var cause = Object.keys(raisons).sort(function (a, b) { return raisons[b] - raisons[a] || (a < b ? -1 : 1); })[0];
      return { ok: false, jetons: null, admissibles: ad.placements.length, acceptes: 0, raison: ad.placements.length + ' placement(s) des villes respectent les règles de placement, mais aucun n’est équilibré (le plus souvent : ' + LIBELLES_CAUSE_TOUTES[cause] + ') : changez des tuiles ou leur orientation.' };
    }
    return {
      ok: true, S: meilleur.S, admissibles: ad.placements.length, acceptes: acceptes, raison: '',
      jetons: meilleur.pl.map(function (jn) { return { i: jn.i, j: jn.j, type: 'capture' }; })
    };
  }

  /**
   * Aide « placer les villes » de l'interface : pose les 7 villes au meilleur placement (meilleurPlacementVilles) à la place des villes
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
    etat.signaler('7 villes placées au meilleur placement (S = ' + r.S + ', parmi ' + r.acceptes + ' placement(s) équilibré(s) sur ' + r.admissibles + ' admissible(s)). Ctrl+Z pour revenir.', 'info');
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
    villes_ports: 'aucun placement des villes en 2-3-2 compatible (3 ports par ville, aucune case qui dessert deux villes)',
    connexions: 'plus de 5 % de cases à 2 connexions ou moins',
    score_s: 'score S au-dessus du seuil'
  };
  var LIBELLES_CAUSE_TOUTES = Object.assign({}, LIBELLES_CAUSE, LIBELLES_CAUSE_5X5);

  /** Entier (partie entière) d'un nombre fini d'au moins 1 ; toute autre valeur (texte, NaN, Infinity, négatif, 0) donne `defaut`. */
  function entierValide(x, defaut) {
    return typeof x === 'number' && isFinite(x) && x >= 1 ? Math.floor(x) : defaut;
  }

  /**
   * Explication claire d'un abandon (5×5) : échecs structurels consécutifs, c'est-à-dire une bibliothèque qui ne peut pas donner de
   * plateau conforme. `cause` : 'cases_moities', 'villes_ports', 'jonction_ports' ou 'connexions'.
   */
  function expliquerManquePorts(cause) {
    return expliquerCause(cause) + (cause === 'cases_moities' ? '' : ' Le catalogue 5×5 livré (Nouveau plateau 5×5, ou « Charger le nouveau catalogue ») donne des plateaux conformes.');
  }
  function expliquerCause(cause) {
    if (cause === 'cases_moities') return 'aucune composition de la bibliothèque ne donne autant de cases dans la moitié verte que dans la moitié rouge (ajoutez des modèles de mêmes gabarits avec d’autres nombres de cases).';
    if (cause === 'connexions') return 'les tuiles de la bibliothèque laissent plus de 5 % de cases à 2 connexions ou moins : le 5×5 demande des tuiles très connectées (au moins 3 connexions par case).';
    if (cause === 'jonction_ports') return 'aucune orientation des tuiles ne relie chaque jonction par ' + MIN_PORTS_JONCTION_5X5 + ' ports au moins : les tuiles de la bibliothèque n’apportent pas assez de ports.';
    return 'aucun placement des 7 villes en 2-3-2 n’est possible sur des jonctions à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins sans qu’une case desserve deux villes : les tuiles de la bibliothèque n’apportent pas assez de ports.';
  }

  /**
   * Génère un plateau aléatoire du format du document. Ne modifie pas `doc`.
   * options :
   *  - graine (texte ou nombre ; générée si absente) ;
   *  - candidats (défaut 200, borné à 1000) : candidats valides à départager ; essaisMax (défaut candidats × 5, borné) ;
   *    une valeur qui n'est pas un nombre fini d'au moins 1 (texte, NaN, Infinity, négatif, 0) donne la valeur par défaut ;
   *  - tolerance (défaut 1) : bons candidats = S ≤ Smin + tolérance ;
    *  - jonctionsVariees (défaut true ; seul `false` choisit la rangée centrale) : 4×4, voir pairesJonctionsCases (12 paires équilibrées ; false : les 3 paires de la rangée centrale) ;
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
    var est5x5 = F.id === '5x5', ctx5 = null, paires = null, variees = false;
    if (est5x5) {
      Object.keys(LIBELLES_CAUSE_5X5).forEach(function (k) { rejets[k] = 0; });
      libelles = Object.assign({}, LIBELLES_CAUSE, LIBELLES_CAUSE_5X5);
      ctx5 = contexte5x5(doc, F, modelesDispo, cellules);
    } else {
      variees = options.jonctionsVariees !== false;
      paires = pairesJonctionsCases(F, variees);
    }
    var bons = [], essais = 0, tronques = 0, echecsStructurels = 0, dernierStructurel = null, abandon = null;
    var ctx4 = est5x5 ? null : contexte4x4(doc, F, modelesDispo, cellules);
    while (bons.length < nbCandidats && essais < essaisMax) {
      if (echecsStructurels >= ECHECS_STRUCTURELS_MAX) { abandon = dernierStructurel; break; } // la bibliothèque ne pourra pas donner de plateau
      essais++;
      var tuiles, jetons, ev, cand;
      if (est5x5) { // orientation des centrales, B1 imposés, villes en 2-3-2 : tout est décidé par candidat5x5
        var c5 = candidat5x5(ctx5, rng);
        if (c5.tronque) tronques++;
        if (c5.cause === 'jonction_ports' || c5.cause === 'villes_ports' || c5.cause === 'cases_moities' || c5.cause === 'connexions') { dernierStructurel = c5.cause; echecsStructurels++; } else echecsStructurels = 0;
        if (c5.cause) { rejets[c5.cause]++; continue; }
        tuiles = c5.tuiles; jetons = c5.jetons; ev = c5.ev;
        cand = { version: doc.version, grille: F.id, modeles: modeles, plateau: { tuiles: tuiles, jetons: jetons } };
        if (M.validerPlateau(cand).erreurs.length) { rejets.plateau_invalide++; continue; }
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
      var conseil = abandon ? ' Abandon après ' + echecsStructurels + ' échecs consécutifs : ' + expliquerManquePorts(abandon)
        : est5x5 && ((rejets.connexions || 0) + (rejets.villes_ports || 0)) * 2 >= essais
        ? ' Les tuiles de cette bibliothèque ne donnent presque jamais de plateau très connecté : ' + expliquerManquePorts((rejets.connexions || 0) >= (rejets.villes_ports || 0) ? 'connexions' : 'villes_ports')
        : rejets.villes_proches * 2 >= essais
        ? ' Les tuiles de cette bibliothèque rapprochent presque toujours deux villes à moins de 3 cases (règles R1 à R4 non respectées) : utilisez des tuiles conformes, comme celles du catalogue.'
        : ' Modifiez la bibliothèque ou essayez une autre graine.';
      var echecFinal = echec('Aucun plateau acceptable en ' + essais + ' essais' + (detail ? ' (' + detail + ')' : '') + '.' + conseil +
        (tronques ? ' ' + tronques + ' recherche(s) d’orientation interrompue(s) (budget de calcul dépassé).' : ''), essais);
      if (est5x5) echecFinal.orientationsTronquees = tronques;
      return echecFinal;
    }

    // Bons candidats. 4×4 : S ≤ Smin + tolérance ; à S égal, pénalité minimale ; puis (préférence) AFFINAGE_MAX d'entre eux, tirés au
    // hasard, sont affinés pour le rythme et l'équilibre des accès (affiner) ; on garde le meilleur : chaîne au-delà de 3, puis écart
    // des portes d'accès au-delà de 1, puis chaîne ; égalités au hasard.
    // 5×5 (docs/53 § 3) : S n'est que la dernière préférence (S >= 5 est déjà rejeté) ; AFFINAGE_MAX candidats tirés au hasard parmi
    // ceux dont la chaîne dépasse d'au plus `tolerance` la plus courte sont affinés, et le plateau rendu est le meilleur selon
    // [chaîne, raccords morts, points d'articulation, S] ; égalités au hasard.
    var Smin = Math.min.apply(null, bons.map(function (x) { return x.S; }));
    var affinage = options.affinage !== false, parmi, finalistes;
    if (est5x5) {
      parmi = bons;
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
          cle: [a.note.chaine, a.penalite.raccords, arts, a.ev.crit.S] };
      });
    } else {
      parmi = bons.filter(function (x) { return x.S <= Smin + tolerance; });
      var penMin = {};
      parmi.forEach(function (x) { penMin[x.S] = Math.min(penMin[x.S] === undefined ? Infinity : penMin[x.S], x.penalite); });
      parmi = parmi.filter(function (x) { return x.penalite === penMin[x.S]; });
      finalistes = (affinage ? melanger(parmi, rng).slice(0, AFFINAGE_MAX) : [parmi[entier(rng, parmi.length)]]).map(function (x) {
        var a = affinage ? affiner(x, doc, F, Smin + tolerance, rng)
          : { tuiles: x.tuiles, ev: x.ev, penalite: x.pen, note: noteRythme({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: x.tuiles, jetons: x.jetons } }) };
        return { tuiles: a.tuiles, jetons: x.jetons, ev: a.ev, raccords: a.penalite.raccords, malReliees: a.penalite.malReliees, S: a.ev.crit.S, note: a.note, articulations: 0,
          cle: [a.note.cle[0], Math.max(0, a.note.cle[1] - 1), a.note.cle[2]] };
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
    if (est5x5) { // compteurs propres au 5×5 (le 4×4 garde exactement son rapport et son score)
      var portsJn = portsParJonction(sortie), cxS = GR.connexions(sortie, gS);
      score.portsParJonction = portsJn;
      score.connexions = { cases: cxS.cases, faibles: cxS.faibles, part: cxS.part, degreMoyen: cxS.degreMoyen, parDegre: cxS.parDegre };
      score.articulations = choisi.articulations;
      score.jonctions3 = portsJn.filter(function (p) { return p >= MIN_PORTS_VILLE_5X5; }).length;
      score.jonctionsAMoins2 = portsJn.filter(function (p) { return p < MIN_PORTS_JONCTION_5X5; }).length;
      score.orientationsTronquees = tronques;
      score.placementsAdmissibles = placementsAdmissibles5x5(sortie);
    }
    var nomsVilles = choisi.jetons.map(function (j) { return '(' + j.i + ',' + j.j + ')'; }).join(' ');
    rapport.push('Graine « ' + graine + ' » : ' + bons.length + ' candidat(s) valide(s) en ' + essais + ' essai(s), tirage parmi ' +
      parmi.length + ' bon(s) candidat(s) (S = ' + Smin + (tolerance ? ' à ' + (Smin + tolerance) : '') + ')' + (affinage ? ', dont ' + finalistes.length + ' affiné(s) pour le rythme.' : ', sans affinage du rythme.'));
    if (est5x5) {
      rapport.push('Villes ' + nomsVilles + ' placées en 2-3-2 avant l’orientation des centrales, sur des jonctions à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins, sans case qui desserve deux villes ; les 9 autres jonctions sont des cases chemin.');
      rapport.push('Centrales orientées pour ce placement : ' + score.jonctions3 + ' jonction(s) sur 16 à ' + MIN_PORTS_VILLE_5X5 +
        ' ports au moins, aucune à moins de ' + MIN_PORTS_JONCTION_5X5 + '.');
      rapport.push('Connexions par case : ' + score.connexions.faibles + ' case(s) à 2 connexions ou moins sur ' + score.connexions.cases + ' (visé : moins de 5 %), ' +
        (Math.round(score.connexions.degreMoyen * 100) / 100).toString().replace('.', ',') + ' connexions par case en moyenne ; points d’articulation : ' + score.articulations + '.');
    } else {
      rapport.push('Villes ' + nomsVilles + ' ; les autres jonctions sont des cases chemin' +
        (paires ? (variees ? ' (jonctions variées).' : ' (rangée centrale).') : '.'));
    }
    rapport.push('Score S (somme des écarts sur les 7 rangs) : ' + crit.S + ' ; écart maximal : ' + crit.ecartMax + ' pas.');
    rapport.push('Villes plus proches du joueur vert : ' + crit.partage[1] + ', du joueur rouge : ' + crit.partage[2] + ', à égalité : ' + crit.partage.egalite + '.');
    rapport.push('Cases : ' + score.cases.total + ' (moitié verte ' + score.cases.vert + ', moitié rouge ' + score.cases.rouge + (est5x5 ? ', le reste sur la rangée neutre et les jonctions du milieu' : ', le reste sur les jonctions du milieu') + ')' +
      (est5x5 ? ' ; ' + score.placementsAdmissibles + ' placement(s) de villes en 2-3-2 admissible(s) sur ce plateau.' : '.'));
    rapport.push('Rythme : au plus ' + score.chaine + ' case(s) d’affilée sans ville, passage ni raccourci (cible ' + GR.CHAINE_CIBLE + ') ; accès au centre : ' +
      score.acces.vert + ' porte(s) côté vert, ' + score.acces.rouge + ' côté rouge (écart ' + score.acces.ecart + ').');
    rapport.push('Raccords morts : ' + score.raccordsMorts + (est5x5 ? '' : ' ; jonctions mal reliées : ' + score.jonctionsMalReliees) + ' ; sorties minimales d\'une case d\'apparition : ' + score.sortiesMin + '.');
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
    racine.appendChild(el(d, 'p', 'pm-generateur-explication',
      'Tire un plateau ' + F.GRILLE.colonnes + '×' + F.GRILLE.lignes + ' complet dans la bibliothèque (un modèle peut servir plusieurs fois, la variété est favorisée ; le poids du modèle, à défaut ses exemplaires, pèse dans le tirage) : 7 villes à 3 cases d\'écart au moins, ' +
      'les autres jonctions restent des cases chemin' + (F.id === '4x4' ? ' (les deux jonctions-cases sont placées au mieux parmi 12 paires équilibrées, ou dans la rangée centrale si l’option « jonctions variées » est décochée)' : ' (villes placées d’abord, en 2-3-2 sur des jonctions à 3 ports au moins, sans case qui desserve deux villes ; 59 cases, dont moins de 5 % à 2 connexions ; centrales orientées pour ce placement)') + ' ; ' +
      'autant de cases dans la moitié verte que dans la moitié rouge ; centrales orientées selon les ports puis pour le rythme (au plus 3 cases d’affilée sans ville, passage ni raccourci, visé) et l’équilibre des accès au centre ; ' +
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

    // Option « jonctions variées » (4×4 seulement : le 5×5 place ses villes en 2-3-2) : cochée par défaut (12 paires de jonctions-cases) ; décochée, elles restent dans la rangée centrale
    var caseVariees = null;
    if (F.id === '4x4') {
      var ligneVariees = el(d, 'p', 'pm-generateur-ligne');
      caseVariees = el(d, 'input', 'pm-generateur-variees');
      caseVariees.type = 'checkbox';
      caseVariees.checked = true;
      caseVariees.id = 'pm-generateur-variees-' + n;
      var labVariees = el(d, 'label', 'pm-generateur-libelle', 'Jonctions variées (les deux jonctions-cases peuvent sortir de la rangée centrale : une côté vert, une côté rouge, pour garder autant de cases de chaque côté ; décochée, elles restent dans la rangée centrale)');
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
      var options = { graine: champ.value, jonctionsVariees: !!(caseVariees && caseVariees.checked) };
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
    placementsCompatibles: placementsCompatibles,
    optionsCellule: optionsCellule,
    orienterPourVilles: orienterPourVilles,
    evaluer: evaluer,
    ESSAIS_PLACEMENT: ESSAIS_PLACEMENT,
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
