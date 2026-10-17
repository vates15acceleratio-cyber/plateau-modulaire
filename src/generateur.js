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
 *  - ORIENTATION DES CENTRALES SELON LES PORTS : 4×4 (orienter4x4) : plus petit nombre de ports d'une jonction maximal, puis jonctions
 *    à 3 ports ; 5×5 (orienter5x5) : toute jonction à 2 ports au moins (condition ferme), villes 2-3-2 possibles sur des jonctions à
 *    3 ports, jonctions à 3 ports maximales ;
 *  - 5×5 : 78 à 81 cases (CASES_CIBLE_5X5, docs/18 réponse 1) : le nombre de B1 est choisi pour tenir la cible, sans dépasser ses
 *    exemplaires, de préférence de façon que les autres bords tiennent dans les leurs ; B1 d'abord sur les bords de la rangée neutre ;
 *    villes en 2-3-2 (2 en j = 1, 3 en j = 2 ou 3, 2 en j = 4) sur des jonctions à 3 ports au moins ;
 *  - 4×4 : 7 villes, les 2 jonctions-cases dans la rangée centrale (aucun « 5 contre 2 », docs/22) ou, avec « jonctions variées »,
 *    une en j = 1 et une en j = 3 (cases égales entre moitiés) ;
 *  - villes non traversables (règle du jeu) ;
 *  - REJETS : validerPlateau avec erreur, graphe non connexe, camp sans case d'apparition, deux villes à moins de 3 cases (jamais
 *    produit, docs/18), ville inaccessible, plateau très déséquilibré (« 5 contre 2 », écart > SEUIL_BLOCAGE_ECART), écart > 2 à un
 *    rang de 1 à 7, première ville à des distances différentes, cases inégales entre moitiés ; 5×5 en plus : jonction à moins de
 *    2 ports, aucun placement 2-3-2 à 3 ports, S >= 5 (docs/36) ;
 *  - classement par S = Σ |D1(k) − D2(k)| sur les 7 rangs, puis pénalité secondaire (raccords morts au-delà de 2, jonctions à moins
 *    de 2 ports, cases d'apparition à moins de 2 sorties, 5×5 sans ville équidistante) ; bons candidats : S ≤ Smin + tolérance ;
 *  - PRÉFÉRENCES (jamais des rejets) : AFFINAGE_MAX bons candidats tirés au hasard sont affinés (affiner : rotations des centrales,
 *    villes fixes, sans perdre de port utile ni sortir des seuils) pour le RYTHME (plus longue suite de cases sans zone d'intérêt,
 *    cible 3, PM.graphe.rythme) puis l'ÉQUILIBRE DES ACCÈS au centre (PM.graphe.accesCentre) ; le plateau rendu est le meilleur
 *    d'entre eux (chaîne au-delà de 3, écart d'accès au-delà de 1, chaîne), égalités au hasard.
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
   *  - par défaut (4×4) : les 3 paires de la rangée centrale (j = 2), qui ne donnent jamais « 5 contre 2 » ;
   *  - jonctions variées (4×4) : les paires qui gardent autant de jonctions-cases du côté vert (j = 1) que du côté rouge (j = 3),
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

  /** Seuils propres à chaque format (docs/28 § 6) : en 5×5, S >= PM.graphe.SEUIL_S rejette le candidat ; en 4×4, S n'est qu'un classement. */
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
   * Évalue un plateau complet (tuiles et villes posées). Renvoie { ok, cause, crit, sortiesMin }.
   */
  function evaluer(docCandidat) {
    var g = GR.construire(docCandidat, { villesTraversables: false });
    var res = { ok: false, cause: null };
    if (!GR.connexe(g) || !g.apparitions[1].length || !g.apparitions[2].length) { res.cause = 'connexite'; return res; }
    if (GR.villesProches(g).length) { res.cause = 'villes_proches'; return res; }
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
   * sur des jonctions à 3 ports au moins), le plateau acceptable (evaluer), S ≤ sMax et la pénalité secondaire, et améliore la note
   * de rythme (noteRythme : chaîne ≤ 3 visée, puis équilibre des accès au centre). Ne modifie pas `bon`.
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
            if (clePlusPetite(n.cle, note.cle)) {
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

  /** Placements 2-3-2 du 5×5 dont les 7 villes sont sur des jonctions à 3 ports au moins (mesure « placements admissibles »). */
  function placementsAdmissibles5x5(doc) {
    var F = M.formatDuDocument(doc), p = portsParJonction(doc);
    return placementsVilles5x5().filter(function (pl) { return pl.every(function (jn) { return p[indexJonction(jn.i, jn.j, F)] >= MIN_PORTS_VILLE_5X5; }); }).length;
  }

  /* ------------------------------------------------------------------ */
  /* 5×5 : orientation, B1, villes en 2-3-2 (docs/18, docs/24 § 8, docs/28) */
  /* ------------------------------------------------------------------ */

  var ID_B1 = 'B1';                 // le bord dont le nombre est choisi pour tenir la cible de cases (catalogue livré : cases = 72 + nB1 + nU1)
  var CASES_CIBLE_5X5 = [78, 81];   // cases par plateau visées (docs/18, réponse 1 : plus de cases pour plusieurs placements de villes)
  var PORTS_MIN_5X5 = 16 * GR.PORTS_JONCTION_MIN + NB_VILLES * (GR.PORTS_VILLE_MIN - GR.PORTS_JONCTION_MIN); // 39 : 16 jonctions à 2 ports, 7 villes à 3
  var MIN_PORTS_JONCTION_5X5 = GR.PORTS_JONCTION_MIN; // condition de rejet : toute jonction intérieure reliée par 2 ports au moins
  var MIN_PORTS_VILLE_5X5 = GR.PORTS_VILLE_MIN;       // condition de rejet : une ville sur une jonction à 3 ports au moins
  var BUDGET_NOEUDS = 3000000;      // garde-fou de la recherche d'orientation (nombre de nœuds, donc déterministe)
  var ESSAIS_PLACEMENT = 12;        // placements de villes essayés (du meilleur S au moins bon) avant de rejeter le candidat
  function bitsPorts(masque) { var n = 0; for (var k = 0; k < 4; k++) n += (masque >> k) & 1; return n; }

  /**
   * Profil d'un modèle : masques de ports et de raccords, nombre de cases et de ports (lu sur ses chemins), cases d'apparition
   * [{x, y}] (repère de la tuile).
   */
  function profilModele(m) {
    var mm = M.masquesDuModele(m);
    return {
      id: m.id, ports: mm.portsCoin, raccords: mm.raccords, cases: m.cases.length, nbPorts: bitsPorts(mm.portsCoin),
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
   * Options d'orientation d'une cellule : pour chaque modèle possible, chaque empreinte distincte de ports est UNE option
   * (les rotations de même empreinte sont équivalentes pour la couverture ; on en tire une au hasard ensuite).
   * Centrale : 4 rotations ; bord et coin : rotation imposée par la place.
   * Renvoie [{modeleId, jn: [indices des jonctions nourries], rots: [rotations équivalentes]}].
   */
  function optionsCellule(c, ids, profils, F) {
    var res = [], vus = {}, NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes;
    var rotations = c.gabarit === 'centrale' ? [0, 1, 2, 3] : [M.rotationDeduite(c.col, c.lig, c.gabarit, F)];
    ids.forEach(function (id) {
      rotations.forEach(function (rot) {
        var ports = F.tournerPorts(profils[id].ports, rot), jn = [];
        for (var k = 0; k < 4; k++) {
          if (!((ports >> k) & 1)) continue;
          var q = M.jonctionDuCoin(c.col, c.lig, k);
          if (q.i >= 1 && q.i <= NC - 1 && q.j >= 1 && q.j <= NL - 1) jn.push(indexJonction(q.i, q.j, F));
        }
        var cle = id + '|' + jn.join(',');
        if (vus[cle]) { vus[cle].rots.push(rot); return; }
        vus[cle] = { modeleId: id, jn: jn, rots: [rot] };
        res.push(vus[cle]);
      });
    });
    return res;
  }

  /**
   * Orientation du 5×5. Parmi les options de chaque cellule (rotation des centrales, miroir des bords simples B7 / B7m), cherche par
   * exploration complète (avec élagage) l'ensemble qui, par ordre de priorité :
   *   1. relie chaque jonction par 2 ports au moins (condition ferme : sinon aucune solution, renvoie choix = null) ;
   *   2. permet de placer 7 villes en 2-3-2 sur des jonctions à 3 ports au moins ;
   *   3. maximise le nombre de jonctions à 3 ports au moins ;
   *   4. équilibre la somme des ports entre la moitié nord (j <= 2) et la moitié sud (j >= 3).
   * Les égalités sont départagées au hasard (rng à graine fixe). `options[d]` : options de la d-ième cellule en ordre de lecture.
   * Renvoie { choix: [option par cellule] (null si aucune solution), n3, noeuds, tronque } ; tronque = vrai si BUDGET_NOEUDS a été dépassé
   * (la recherche s'est arrêtée : la meilleure orientation trouvée jusque-là est rendue, peut-être pas la meilleure).
   */
  function orienter5x5(options, cellules, F, rng, budget) {
    var NC = F.GRILLE.colonnes, nJ = (NC - 1) * (F.GRILLE.lignes - 1), n = cellules.length;
    var compte = [], choix = [], x, d;
    for (x = 0; x < nJ; x++) compte.push(0);
    // reste[d][x] : ports que les cellules d+1.. peuvent encore apporter, au mieux, à la jonction x
    var reste = [];
    for (d = 0; d < n; d++) reste.push(new Array(nJ).fill(0));
    for (d = n - 2; d >= 0; d--) {
      var suiv = new Array(nJ).fill(0);
      options[d + 1].forEach(function (o) { o.jn.forEach(function (y) { suiv[y] = 1; }); });
      for (x = 0; x < nJ; x++) reste[d][x] = reste[d + 1][x] + suiv[x];
    }
    var groupes = REPARTITION_VILLES_5X5.map(function (g) {
      var membres = [];
      for (var j = 1; j < F.GRILLE.lignes; j++) for (var i = 1; i < NC; i++) if (g.rangees.indexOf(j) >= 0) membres.push(indexJonction(i, j, F));
      return { membres: membres, nb: g.nb };
    });
    var moitie = Math.floor((F.GRILLE.lignes - 1) / 2); // j <= moitie : moitié nord
    var meilleur = null, egaux = 0, noeuds = 0, cle = null, tronque = false;

    /** Après la cellule `prof` : null si une jonction n'atteindra plus 2 ports ; sinon { faisable, ub } (bornes optimistes). */
    function borne(prof) {
      var ub = 0, y;
      for (y = 0; y < nJ; y++) {
        var pot = compte[y] + reste[prof][y];
        if (pot < MIN_PORTS_JONCTION_5X5) return null;
        if (pot >= MIN_PORTS_VILLE_5X5) ub++;
      }
      var faisable = groupes.every(function (g) {
        return g.membres.filter(function (m) { return compte[m] + reste[prof][m] >= MIN_PORTS_VILLE_5X5; }).length >= g.nb;
      });
      return { faisable: faisable, ub: ub };
    }

    function feuille() {
      var n3 = 0, nord = 0, sud = 0, y;
      for (y = 0; y < nJ; y++) {
        if (compte[y] >= MIN_PORTS_VILLE_5X5) n3++;
        if (Math.floor(y / (NC - 1)) + 1 <= moitie) nord += compte[y]; else sud += compte[y];
      }
      var faisable = groupes.every(function (g) {
        return g.membres.filter(function (m) { return compte[m] >= MIN_PORTS_VILLE_5X5; }).length >= g.nb;
      }) ? 1 : 0;
      var k = [faisable, n3, -Math.abs(nord - sud)], cmp = 1;
      if (cle) { cmp = 0; for (var q = 0; q < 3 && cmp === 0; q++) cmp = k[q] > cle[q] ? 1 : (k[q] < cle[q] ? -1 : 0); }
      if (cmp < 0) return;
      if (cmp > 0) { egaux = 1; cle = k; meilleur = choix.slice(); return; }
      egaux++;
      if (rng() * egaux < 1) meilleur = choix.slice();
    }

    function visiter(prof) { // prof : indice de la cellule à fixer
      if (prof === n) { feuille(); return; }
      var opts = options[prof];
      for (var o = 0; o < opts.length; o++) {
        if (++noeuds > budget) { tronque = true; return; }
        var op = opts[o], k;
        for (k = 0; k < op.jn.length; k++) compte[op.jn[k]]++;
        choix[prof] = op;
        var b = borne(prof);
        // élagage : une jonction ne peut plus atteindre 2 ports ou, une solution faisable étant connue, la branche ne peut plus la battre
        if (b && !(cle && cle[0] === 1 && (!b.faisable || b.ub < cle[1]))) visiter(prof + 1);
        for (k = 0; k < op.jn.length; k++) compte[op.jn[k]]--;
      }
    }
    visiter(0);
    if (!meilleur) return { choix: null, n3: 0, noeuds: noeuds, tronque: tronque };
    var final = [];
    for (x = 0; x < nJ; x++) final.push(0);
    meilleur.forEach(function (o) { o.jn.forEach(function (y) { final[y]++; }); });
    return {
      choix: meilleur, noeuds: noeuds, tronque: tronque,
      n3: final.filter(function (v) { return v >= MIN_PORTS_VILLE_5X5; }).length
    };
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

  /**
   * Clé de couverture d'un plateau 5×5 posé (celle que optimise orienter5x5, à comparer terme à terme, le plus grand est le meilleur) :
   * { toutes2 : chaque jonction a 2 ports au moins (condition ferme), cle : [villes 2-3-2 possibles (0|1), jonctions à 3 ports au moins,
   * -|ports nord - ports sud|] }.
   */
  function cleCouverture(doc) {
    var F = M.formatDuDocument(doc), ports = portsParJonction(doc), NC = F.GRILLE.colonnes, moitie = Math.floor((F.GRILLE.lignes - 1) / 2);
    var nord = 0, sud = 0, n3 = 0;
    ports.forEach(function (p, y) {
      if (p >= MIN_PORTS_VILLE_5X5) n3++;
      if (Math.floor(y / (NC - 1)) + 1 <= moitie) nord += p; else sud += p;
    });
    var faisable = REPARTITION_VILLES_5X5.every(function (g) {
      var nb = 0;
      ports.forEach(function (p, y) { if (p >= MIN_PORTS_VILLE_5X5 && g.rangees.indexOf(Math.floor(y / (NC - 1)) + 1) >= 0) nb++; });
      return nb >= g.nb;
    });
    return { toutes2: ports.every(function (p) { return p >= MIN_PORTS_JONCTION_5X5; }), cle: [faisable ? 1 : 0, n3, -Math.abs(nord - sud)] };
  }

  /** Mesure rapide (celle des placements de candidat5x5) des villes posées sur `doc` : { accessible, S, ecartMax, partage, premiereEgale }. */
  function mesureRapide(doc) {
    var g = GR.construire(doc, { villesTraversables: false, jetons: [] }), P = grapheRapide(g);
    return mesurePlacement(P, doc.plateau.jetons.map(function (j) { return P.idx.get('J' + j.i + ',' + j.j); }));
  }

  /**
   * Contexte de génération 5×5 : profils des modèles, placements de villes, règle des B1 (appliquée seulement si la bibliothèque
   * contient B1 et au moins un autre bord tirable).
   */
  function contexte5x5(doc, F, modelesDispo, cellules) {
    var profils = {};
    doc.modeles.forEach(function (m) { if (m && typeof m.id === 'string' && Array.isArray(m.cases)) profils[m.id] = profilModele(m); });
    var bordsSansB1 = modelesDispo.bord.filter(function (m) { return m.id !== ID_B1; });
    var avecB1 = bordsSansB1.length > 0 && bordsSansB1.length < modelesDispo.bord.length;
    return {
      doc: doc, F: F, cellules: cellules, modelesDispo: modelesDispo, profils: profils, avecB1: avecB1, bordsSansB1: bordsSansB1, nbCases: casesParModele(doc), poids: poidsTirables(modelesDispo),
      placements: placementsVilles5x5().map(function (villes) {
        return { villes: villes, indices: villes.map(function (jn) { return indexJonction(jn.i, jn.j, F); }) };
      })
    };
  }

  /**
   * Première moitié d'un candidat 5×5 (appelable seule : outils de mesure) : modèles, égalité des cases entre moitiés, puis orientation.
   *  1. coins et centrales au poids ; bords au poids parmi les bords autres que B1, puis nB1 bords B1 (d'abord sur les bords de la
   *     rangée neutre, puis au hasard) : nB1 est tiré parmi les valeurs qui donnent CASES_CIBLE_5X5 cases (tuiles + 9 jonctions-cases)
   *     et PORTS_MIN_5X5 ports au moins, sans dépasser les exemplaires de B1 ; à défaut, la valeur la plus proche de la cible ;
   *  2. cases égales entre la moitié verte et la moitié rouge (equilibrerMoities : échanges, sinon remplacement d'une tuile autre que
   *     B1 qui garde la cible de cases) ; sinon rejet `cases_moities` ;
   *  3. orientation (orienter5x5).
   * Renvoie { cause: 'jonction_ports' | 'cases_moities', tronque } en cas d'échec, sinon { tuiles, b1, jonctions3, noeuds, tronque }
   * (tronque : budget de nœuds de la recherche dépassé, voir orienter5x5 ; `ctx.budgetNoeuds` remplace BUDGET_NOEUDS, pour les tests).
   */
  function tuilesOrientees5x5(ctx, rng) {
    var F = ctx.F, cellules = ctx.cellules, modeles = ctx.modelesDispo, profils = ctx.profils, nbCases = ctx.nbCases;
    // 1. modèles
    var usages = {}, ids = [], b1 = {}, nB1 = 0;
    cellules.forEach(function (c, k) {
      var id = tirerModele(c.gabarit === 'bord' && ctx.avecB1 ? ctx.bordsSansB1 : modeles[c.gabarit], usages, rng);
      usages[id] = (usages[id] || 0) + 1;
      ids.push(id);
    });
    if (ctx.avecB1) {
      var bords = [];
      cellules.forEach(function (c, k) { if (c.gabarit === 'bord') bords.push(k); });
      var neutres = bords.filter(function (k) { return F.campCellule(cellules[k].col, cellules[k].lig) === null; });
      var ordre = neutres.concat(melanger(bords.filter(function (k) { return neutres.indexOf(k) < 0; }), rng));
      var stockB1 = modeles.bord.filter(function (m) { return m.id === ID_B1; })[0].stock, nJc = (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1) - NB_VILLES;
      var bilan = function (n) { // cases et ports du plateau avec n B1 posés dans `ordre`
        var cases = nJc, ports = 0;
        ids.forEach(function (id, k) { var idk = ordre.indexOf(k) >= 0 && ordre.indexOf(k) < n ? ID_B1 : id; cases += nbCases[idk]; ports += profils[idk].nbPorts; });
        return { cases: cases, ports: ports };
      };
      // de préférence, assez de B1 pour que les autres bords tiennent dans leurs exemplaires (le jeu imprimé suffit au plateau)
      var stockAutres = ctx.bordsSansB1.reduce(function (s, m) { return s + m.stock; }, 0), nMax = Math.min(bords.length, stockB1);
      var bornes = function (nMin) { // valeurs de nB1 qui tiennent la cible, et la plus proche (ports suffisants dans les deux cas)
        var exactes = [], proche = null;
        for (var n = nMin; n <= nMax; n++) {
          var b = bilan(n), dist = b.cases < CASES_CIBLE_5X5[0] ? CASES_CIBLE_5X5[0] - b.cases : Math.max(0, b.cases - CASES_CIBLE_5X5[1]);
          if (b.ports < PORTS_MIN_5X5) continue;
          if (!dist) exactes.push(n);
          if (!proche || dist < proche.dist) proche = { n: n, dist: dist };
        }
        return { exactes: exactes, proche: proche };
      };
      var pref = bornes(Math.min(nMax, Math.max(0, bords.length - stockAutres))), large = bornes(0);
      if (pref.exactes.length) nB1 = pref.exactes[entier(rng, pref.exactes.length)];
      else if (large.exactes.length) nB1 = large.exactes[entier(rng, large.exactes.length)];
      else nB1 = pref.proche ? pref.proche.n : (large.proche ? large.proche.n : nMax);
      ordre.slice(0, nB1).forEach(function (k) { ids[k] = ID_B1; b1[k] = true; });
    }
    // 2. moitiés : autant de cases de part et d'autre (B1 jamais remplacé ; un remplacement garde la cible de cases)
    var tuiles0 = cellules.map(function (c, k) { return { modeleId: ids[k], col: c.col, lig: c.lig }; });
    var casesTotal = function () { return tuiles0.reduce(function (s, t) { return s + nbCases[t.modeleId]; }, 0) + (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1) - NB_VILLES; };
    var remplacants = function (t, k) {
      if (t.modeleId === ID_B1 && ctx.avecB1) return [];
      var c0 = casesTotal(), liste = (cellules[k].gabarit === 'bord' && ctx.avecB1 ? ctx.bordsSansB1 : modeles[cellules[k].gabarit]);
      return liste.map(function (m) { return m.id; }).filter(function (id) {
        if (id === t.modeleId) return false;
        var c1 = c0 + nbCases[id] - nbCases[t.modeleId];
        return !ctx.avecB1 || (c1 >= CASES_CIBLE_5X5[0] && c1 <= CASES_CIBLE_5X5[1]) || c1 === c0;
      });
    };
    if (!equilibrerMoities(tuiles0, cellules, F, nbCases, rng, remplacants, ctx.poids)) return { cause: 'cases_moities', tronque: false };
    b1 = {};
    tuiles0.forEach(function (t, k) { ids[k] = t.modeleId; if (ctx.avecB1 && t.modeleId === ID_B1) b1[k] = true; });
    // 2. orientation : centrales tournées, bord simple remplacé au besoin par son vrai miroir (B7 / B7m : reflet exact, pas seulement même taille)
    var options = cellules.map(function (c, k) {
      var liste = [ids[k]];
      if (c.gabarit === 'bord' && !b1[k]) {
        liste = modeles.bord.map(function (m) { return m.id; }).filter(function (id) {
          return id !== ID_B1 && (id === ids[k] || estMiroir(profils[ids[k]], profils[id], F.COTE));
        });
      }
      return optionsCellule(c, liste, profils, F);
    });
    var sol = orienter5x5(options, cellules, F, rng, ctx.budgetNoeuds || BUDGET_NOEUDS);
    if (!sol.choix) return { cause: 'jonction_ports', tronque: sol.tronque };
    var tuiles = cellules.map(function (c, k) {
      var o = sol.choix[k];
      return { modeleId: o.modeleId, col: c.col, lig: c.lig, rot: o.rots[entier(rng, o.rots.length)] };
    });
    return { tuiles: tuiles, b1: nB1, jonctions3: sol.n3, noeuds: sol.noeuds, tronque: sol.tronque };
  }

  /**
   * Tirage d'un candidat 5×5 : modèles (B1 imposés), orientation, puis meilleur placement de villes en 2-3-2.
   * Renvoie { cause, tronque } si rejeté (cause = clé de `rejets`), sinon { tuiles, jetons, ev, tronque }
   * (tronque : la recherche d'orientation a dépassé son budget de nœuds).
   */
  function candidat5x5(ctx, rng) {
    var F = ctx.F, orientes = tuilesOrientees5x5(ctx, rng), tronque = orientes.tronque === true;
    if (orientes.cause) return orientes;
    var tuiles = orientes.tuiles;
    // 3. graphe sans ville ; seules les jonctions à 3 ports au moins reçoivent une ville
    var cand0 = { version: ctx.doc.version, grille: F.id, modeles: ctx.doc.modeles, plateau: { tuiles: tuiles, jetons: [] } };
    var g = GR.construire(cand0, { villesTraversables: false });
    if (!GR.connexe(g) || !g.apparitions[1].length || !g.apparitions[2].length) return { cause: 'connexite', tronque: tronque };
    var admissible = g.jonctions.map(function (jn) { return jn.ports >= MIN_PORTS_VILLE_5X5; });
    var P = grapheRapide(g), noeuds = g.jonctions.map(function (jn) { return P.idx.get(jn.id); });
    var valides = [], raisons = {}, nbAdmissibles = 0;
    ctx.placements.forEach(function (pl) {
      if (!pl.indices.every(function (x) { return admissible[x]; })) return;
      nbAdmissibles++;
      var m = mesurePlacement(P, pl.indices.map(function (x) { return noeuds[x]; })), raison = causeRejet(m, F.id);
      if (raison) { raisons[raison] = (raisons[raison] || 0) + 1; return; }
      valides.push({ pl: pl, S: m.S, egal: m.partage.egalite > 0 ? 0 : 1, alea: rng() });
    });
    if (!nbAdmissibles) return { cause: 'villes_ports', tronque: tronque };
    if (!valides.length) { // cause la plus fréquente parmi les placements admissibles
      return { cause: Object.keys(raisons).sort(function (a, b) { return raisons[b] - raisons[a] || (a < b ? -1 : 1); })[0], tronque: tronque };
    }
    // meilleur S d'abord ; à S égal, un placement où une ville est équidistante (docs/18 : « 4 contre 3 » compensé, la 7e ville à égalité), puis le hasard
    valides.sort(function (a, b) { return (a.S - b.S) || (a.egal - b.egal) || (a.alea - b.alea); });
    // 4. contrôle complet (villes à 4 pas au moins, etc.) du meilleur placement, puis des suivants
    var derniere = 'villes_proches';
    for (var t = 0; t < Math.min(ESSAIS_PLACEMENT, valides.length); t++) {
      var jetons = valides[t].pl.villes.map(function (jn) { return { i: jn.i, j: jn.j, type: 'capture' }; });
      var cand = { version: ctx.doc.version, grille: F.id, modeles: ctx.doc.modeles, plateau: { tuiles: tuiles, jetons: jetons } };
      var ev = evaluer(cand);
      if (ev.ok) return { tuiles: tuiles, jetons: jetons, ev: ev, tronque: tronque };
      derniere = ev.cause;
    }
    return { cause: derniere, tronque: tronque };
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
    jonction_ports: 'aucune orientation ne relie chaque jonction par 2 ports au moins',
    villes_ports: 'aucun placement des villes en 2-3-2 sur des jonctions à 3 ports au moins',
    score_s: 'score S au-dessus du seuil'
  };

  /** Entier (partie entière) d'un nombre fini d'au moins 1 ; toute autre valeur (texte, NaN, Infinity, négatif, 0) donne `defaut`. */
  function entierValide(x, defaut) {
    return typeof x === 'number' && isFinite(x) && x >= 1 ? Math.floor(x) : defaut;
  }

  /**
   * Explication claire d'un abandon pour manque de ports (5×5) : quelle tuile manque ou comment y remédier.
   * `cause` : 'jonction_ports' ou 'villes_ports' ; ctx : contexte 5×5.
   */
  function expliquerManquePorts(cause, ctx) {
    if (cause === 'cases_moities') return 'aucune composition de la bibliothèque ne donne autant de cases dans la moitié verte que dans la moitié rouge (ajoutez des modèles de mêmes gabarits avec d’autres nombres de cases).';
    var aB1 = ctx.modelesDispo.bord.some(function (m) { return m.id === ID_B1; }); // B1 tirable (complet, exemplaires > 0), pas seulement présent
    var besoin = cause === 'jonction_ports'
      ? 'aucune orientation des tuiles ne relie chaque jonction par ' + MIN_PORTS_JONCTION_5X5 + ' ports au moins'
      : 'aucune jonction n’atteint ' + MIN_PORTS_VILLE_5X5 + ' ports en nombre suffisant pour les villes en 2-3-2';
    return besoin + (aB1
      ? ' : les tuiles de la bibliothèque n’apportent pas assez de ports (ajoutez des bords ou des centrales à plus de ports).'
      : ' : il manque le bord « ' + ID_B1 + ' » (bord en V, deux ports), qui apporte les ports manquants.');
  }

  /**
   * Génère un plateau aléatoire du format du document. Ne modifie pas `doc`.
   * options :
   *  - graine (texte ou nombre ; générée si absente) ;
   *  - candidats (défaut 200, borné à 1000) : candidats valides à départager ; essaisMax (défaut candidats × 5, borné) ;
   *    une valeur qui n'est pas un nombre fini d'au moins 1 (texte, NaN, Infinity, négatif, 0) donne la valeur par défaut ;
   *  - tolerance (défaut 1) : bons candidats = S ≤ Smin + tolérance ;
   *  - jonctionsVariees (défaut false) : 4×4, voir pairesJonctionsCases (par défaut, rangée centrale) ;
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
    var est5x5 = F.id === '5x5', ctx5 = null, paires = null;
    if (est5x5) {
      Object.keys(LIBELLES_CAUSE_5X5).forEach(function (k) { rejets[k] = 0; });
      libelles = Object.assign({}, LIBELLES_CAUSE, LIBELLES_CAUSE_5X5);
      ctx5 = contexte5x5(doc, F, modelesDispo, cellules);
    } else {
      paires = pairesJonctionsCases(F, options.jonctionsVariees === true);
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
        if (c5.cause === 'jonction_ports' || c5.cause === 'villes_ports' || c5.cause === 'cases_moities') { dernierStructurel = c5.cause; echecsStructurels++; } else echecsStructurels = 0;
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
      var conseil = abandon ? ' Abandon après ' + echecsStructurels + ' échecs consécutifs : ' + expliquerManquePorts(abandon, ctx5)
        : rejets.villes_proches * 2 >= essais
        ? ' Les tuiles de cette bibliothèque rapprochent presque toujours deux villes à moins de 3 cases (règles R1 à R4 non respectées) : utilisez des tuiles conformes, comme celles du catalogue.'
        : ' Modifiez la bibliothèque ou essayez une autre graine.';
      var echecFinal = echec('Aucun plateau acceptable en ' + essais + ' essais' + (detail ? ' (' + detail + ')' : '') + '.' + conseil +
        (tronques ? ' ' + tronques + ' recherche(s) d’orientation interrompue(s) (budget de calcul dépassé).' : ''), essais);
      if (est5x5) echecFinal.orientationsTronquees = tronques;
      return echecFinal;
    }

    // Bons candidats : S ≤ Smin + tolérance ; à S égal, pénalité minimale. Puis (préférence) AFFINAGE_MAX d'entre eux, tirés au
    // hasard, sont affinés pour le rythme et l'équilibre des accès (affiner) ; on garde le meilleur : chaîne au-delà de 3, puis
    // écart des portes d'accès au-delà de 1, puis chaîne ; égalités au hasard.
    var Smin = Math.min.apply(null, bons.map(function (x) { return x.S; }));
    var parmi = bons.filter(function (x) { return x.S <= Smin + tolerance; });
    var penMin = {};
    parmi.forEach(function (x) { penMin[x.S] = Math.min(penMin[x.S] === undefined ? Infinity : penMin[x.S], x.penalite); });
    parmi = parmi.filter(function (x) { return x.penalite === penMin[x.S]; });
    var affinage = options.affinage !== false;
    var finalistes = (affinage ? melanger(parmi, rng).slice(0, AFFINAGE_MAX) : [parmi[entier(rng, parmi.length)]]).map(function (x) {
      var a = affinage ? affiner(x, doc, F, Smin + tolerance, rng)
        : { tuiles: x.tuiles, ev: x.ev, penalite: x.pen, note: noteRythme({ version: doc.version, grille: F.id, modeles: doc.modeles, plateau: { tuiles: x.tuiles, jetons: x.jetons } }) };
      return { tuiles: a.tuiles, jetons: x.jetons, ev: a.ev, raccords: a.penalite.raccords, malReliees: a.penalite.malReliees, S: a.ev.crit.S, note: a.note,
        cle: [a.note.cle[0], Math.max(0, a.note.cle[1] - 1), a.note.cle[2]] };
    });
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
      var portsJn = portsParJonction(sortie);
      score.b1 = sortie.plateau.tuiles.filter(function (t) { return t.modeleId === ID_B1; }).length;
      score.portsParJonction = portsJn;
      score.jonctions3 = portsJn.filter(function (p) { return p >= MIN_PORTS_VILLE_5X5; }).length;
      score.jonctionsAMoins2 = portsJn.filter(function (p) { return p < MIN_PORTS_JONCTION_5X5; }).length;
      score.orientationsTronquees = tronques;
      score.placementsAdmissibles = placementsAdmissibles5x5(sortie);
    }
    var nomsVilles = choisi.jetons.map(function (j) { return '(' + j.i + ',' + j.j + ')'; }).join(' ');
    rapport.push('Graine « ' + graine + ' » : ' + bons.length + ' candidat(s) valide(s) en ' + essais + ' essai(s), tirage parmi ' +
      parmi.length + ' bon(s) candidat(s) (S = ' + Smin + (tolerance ? ' à ' + (Smin + tolerance) : '') + ')' + (affinage ? ', dont ' + finalistes.length + ' affiné(s) pour le rythme.' : ', sans affinage du rythme.'));
    if (est5x5) {
      rapport.push('Villes ' + nomsVilles + ' en 2-3-2, sur des jonctions à ' + MIN_PORTS_VILLE_5X5 + ' ports au moins ; les 9 autres jonctions sont des cases chemin.');
      rapport.push('Centrales et bords orientés pour couvrir les jonctions : ' + score.jonctions3 + ' jonction(s) sur 16 à ' + MIN_PORTS_VILLE_5X5 +
        ' ports au moins, aucune à moins de ' + MIN_PORTS_JONCTION_5X5 + ' ; ' + score.b1 + ' bord(s) B1.');
    } else {
      rapport.push('Villes ' + nomsVilles + ' ; les autres jonctions sont des cases chemin' +
        (paires ? (options.jonctionsVariees === true ? ' (jonctions variées).' : ' (rangée centrale).') : '.'));
    }
    rapport.push('Score S (somme des écarts sur les 7 rangs) : ' + crit.S + ' ; écart maximal : ' + crit.ecartMax + ' pas.');
    rapport.push('Villes plus proches du joueur vert : ' + crit.partage[1] + ', du joueur rouge : ' + crit.partage[2] + ', à égalité : ' + crit.partage.egalite + '.');
    rapport.push('Cases : ' + score.cases.total + ' (moitié verte ' + score.cases.vert + ', moitié rouge ' + score.cases.rouge + (est5x5 ? ', le reste sur la rangée neutre et les jonctions du milieu' : ', le reste sur les jonctions du milieu') + ')' +
      (est5x5 ? ' ; ' + score.placementsAdmissibles + ' placement(s) de villes en 2-3-2 admissible(s).' : '.'));
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
      'les autres jonctions restent des cases chemin' + (F.id === '4x4' ? ' (les deux jonctions-cases sont placées dans la rangée centrale, sauf option « jonctions variées »)' : ' (villes en 2-3-2 sur des jonctions à 3 ports au moins, 78 à 81 cases, centrales orientées pour couvrir les jonctions)') + ' ; ' +
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

    // Option « jonctions variées » (4×4 seulement : le 5×5 place ses villes en 2-3-2) : décochée, les jonctions-cases restent dans la rangée centrale
    var caseVariees = null;
    if (F.id === '4x4') {
      var ligneVariees = el(d, 'p', 'pm-generateur-ligne');
      caseVariees = el(d, 'input', 'pm-generateur-variees');
      caseVariees.type = 'checkbox';
      caseVariees.id = 'pm-generateur-variees-' + n;
      var labVariees = el(d, 'label', 'pm-generateur-libelle', 'Jonctions variées (les deux jonctions-cases peuvent sortir de la rangée centrale : une côté vert, une côté rouge, pour garder autant de cases de chaque côté)');
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
    cleCouverture: cleCouverture,
    contexteDocument5x5: contexteDocument5x5,
    tuilesOrientees5x5: tuilesOrientees5x5,
    contexteDocument4x4: contexteDocument4x4,
    tuilesOrientees4x4: tuilesOrientees4x4,
    equilibrerMoities: equilibrerMoities,
    ecartMoities: ecartMoities,
    noteRythme: noteRythme,
    placementsAdmissibles5x5: placementsAdmissibles5x5,
    CASES_CIBLE_5X5: CASES_CIBLE_5X5,
    PORTS_MIN_5X5: PORTS_MIN_5X5,
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
