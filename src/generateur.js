/*
 * generateur.js : plateau aléatoire (sous-agent 8).
 *
 * Partie calcul (generer) : fonction pure, sans DOM, testée sous Node.
 * Partie interface (ouvrir) : remplit la boîte de dialogue commune PM.dialogue.
 *
 * Règles appliquées (docs/16-avis-mesures-equilibre.md, qui prime sur D6 de 1b et sur le doc 9 ;
 * garde-fous D7 de docs/1b-avis-design-jeu-variante-jonctions.md) :
 *  - 4×4 complet seulement ; une forme réduite est remplacée (et signalé dans le rapport) ;
 *  - tuiles tirées dans la bibliothèque du document (modèles complets, selon leurs exemplaires),
 *    selon le rôle des cellules ; rotation aléatoire des centrales, rotation déduite des autres ;
 *  - 7 villes et 2 carrefours, paire (1,2)+(3,2) par défaut ;
 *  - stock plafonné à PM.modele.PLAFOND_TUILES tuiles (somme des exemplaires des modèles complets) ;
 *  - élimination (D7 n° 1 et doc 16) : validerPlateau avec erreur, cases de déplacement hors de 45 à 55 (D7),
 *    graphe non connexe (villes et apparitions hors de la composante principale), deux villes à moins de
 *    ECART_MIN_CAPTURES pas (D7), ville inaccessible, « 5 contre 2 » mesuré en villes NON traversables,
 *    écart > 2 à un rang de 1 à 7, première ville à des distances différentes pour les deux joueurs ;
 *  - classement par S = Σ |D1(k) − D2(k)| sur les 7 rangs, puis pénalité secondaire (raccords morts
 *    au-delà de 2, ports morts, apparitions à moins de 2 sorties : D7 n° 2 et 3) ;
 *  - tirage au hasard parmi les bons (S ≤ Smin + tolérance, 1 par défaut ; pénalité minimale à S égal : D7 n° 4) ;
 *  - option « carrefours variés » : une autre paire n'est permise que sans alerte (5 contre 2,
 *    D6 étendu, première ville) en villes traversables ET non traversables, avec S ≤ S de la paire
 *    par défaut sur le même plateau ; la paire est tirée au hasard parmi celles qui passent.
 *
 * Graine : texte ou nombre ; même graine + même bibliothèque + mêmes options = même plateau.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.graphe && typeof require === 'function') require('./graphe.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele, GR = PM.graphe;

  // Constantes du critère d'équilibre : celles de PM.graphe (une seule définition, docs/16)
  var NB_VILLES = GR.NB_VILLES;
  var SEUIL_ECART = GR.SEUIL_ECART;  // écart toléré à chaque rang (doc 16, b)
  var NB_CARREFOURS = 2;
  var CASES_MIN = 45, CASES_MAX = 55; // garde-fou D7 : cases de déplacement (carrefours compris)
  var CANDIDATS_DEFAUT = 200;
  var FACTEUR_ESSAIS = 5;         // essais maximaux = candidats × 5 (D7 n° 6)
  var TOLERANCE_DEFAUT = 1;       // bons candidats : S ≤ Smin + tolérance (1 : garde de l'aléa, D7 n° 4 ; mesure 8)
  /* Raccords morts tolérés sans pénalité : seuil « max ≤ 2 » du doc 9 ; le « mur » voulu de C6
     produit un raccord mort, il ne doit pas être écarté par le classement. */
  var RACCORDS_TOLERES = 2;
  var PAIRE_DEFAUT = [{ i: 1, j: 2 }, { i: 3, j: 2 }];
  var LIBELLES_ROLE = { centrale: 'centrale(s)', coin: 'coin(s)', bord: 'bord(s)', apparition: 'apparition(s)' };

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
  /* Jonctions et paires de carrefours                                   */
  /* ------------------------------------------------------------------ */

  /** Jonctions intérieures d'un format, rangée par rangée (j puis i) : cet ordre fixe le tirage pour une graine. */
  function jonctionsInterieures(F) {
    var res = [];
    for (var j = 1; j < F.GRILLE.lignes; j++) for (var i = 1; i < F.GRILLE.colonnes; i++) res.push({ i: i, j: j });
    return res;
  }

  // Le générateur (règles D7, paires de carrefours) ne travaille que sur le 4×4 complet.
  var JONCTIONS = jonctionsInterieures(PM.geometrie.format('4x4'));

  /** Même camp = deux jonctions dans le même camp de joueur (règle unique PM.modele.campJonction). */
  function memeCamp(a, b) {
    var camp = M.campJonction(a.i, a.j);
    return camp !== null && camp === M.campJonction(b.i, b.j);
  }

  function memeJonction(a, b) { return a.i === b.i && a.j === b.j; }

  function clePaire(p) { return '(' + p[0].i + ',' + p[0].j + ')+(' + p[1].i + ',' + p[1].j + ')'; }

  /** Les 30 paires permises (jamais deux carrefours dans le même camp), la paire par défaut en premier. */
  var PAIRES = [PAIRE_DEFAUT];
  for (var a = 0; a < JONCTIONS.length; a++) {
    for (var b = a + 1; b < JONCTIONS.length; b++) {
      var p = [JONCTIONS[a], JONCTIONS[b]];
      if (memeCamp(p[0], p[1]) || clePaire(p) === clePaire(PAIRE_DEFAUT)) continue;
      PAIRES.push(p);
    }
  }

  /** 9 jetons : villes partout sauf la paire de carrefours. */
  function jetonsPour(paire) {
    return JONCTIONS.map(function (jn) {
      var carrefour = memeJonction(jn, paire[0]) || memeJonction(jn, paire[1]);
      return { i: jn.i, j: jn.j, type: carrefour ? 'carrefour' : 'capture' };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Évaluation d'une configuration                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Adaptateur du critère d'équilibre du doc 16 : lit les champs calculés par PM.graphe.equilibre
   * (aucun second calcul). Renvoie { S, ecartMax (rangs 1 à 7), premiereEgale, cinqContreDeux,
   * villeInaccessible, partage, D }. S et ecartMax valent null si une ville est inaccessible.
   */
  function critere(e) {
    return {
      S: e.S, ecartMax: e.ecartMax7,
      premiereEgale: e.premiereEgale === true,
      cinqContreDeux: e.cinqContreDeux === true,
      villeInaccessible: e.S === null,
      partage: { 1: e.partage[1], 2: e.partage[2], egalite: e.partage.egalite },
      D: { 1: e.D[1].slice(), 2: e.D[2].slice() }
    };
  }

  /** Critère sans alerte : S mesurable, écart ≤ 2 aux 7 rangs, première ville égale (null n'est jamais accepté). */
  function sansAlerte(c) {
    return c.S !== null && c.ecartMax !== null && c.ecartMax <= SEUIL_ECART && c.premiereEgale;
  }

  /** Cases de déplacement d'un candidat (tuiles + carrefours), comme le compteur de PM.controles. */
  function casesDeplacement(doc) {
    var n = NB_CARREFOURS;
    doc.plateau.tuiles.forEach(function (t) {
      var m = M.modeleParId(doc, t.modeleId);
      (m && Array.isArray(m.cases) ? m.cases : []).forEach(function (c) { if (c && c.type === 'deplacement') n++; });
    });
    return n;
  }

  /** Graphe connexe et villes + apparitions dans une même composante (parcours en villes traversables). */
  function connexe(g) {
    if (!g.noeuds.length) return false;
    var depart = g.apparitions[1][0] || g.noeuds[0];
    var vus = new Set([depart]), file = [depart];
    for (var q = 0; q < file.length; q++) {
      g.voisins.get(file[q]).forEach(function (y) { if (!vus.has(y)) { vus.add(y); file.push(y); } });
    }
    return vus.size === g.noeuds.length;
  }

  /** Toutes les paires de villes à au moins ECART_MIN_CAPTURES pas (plus court chemin, villes traversables). */
  function ecartVillesRespecte(g) {
    var mini = PM.geometrie.ECART_MIN_CAPTURES, ok = true;
    g.villes.forEach(function (v) {
      if (!ok) return;
      var d = GR.distances(g, v);
      g.villes.forEach(function (w) { if (w !== v && d.has(w) && d.get(w) < mini) ok = false; });
    });
    return ok;
  }

  /**
   * Évalue un plateau (tuiles déjà posées) avec une paire de carrefours.
   * Renvoie { ok, cause, crit (mode choisi), critT, critN, cinqN, cinqT, sortiesMin }.
   */
  function evaluer(docCandidat, paire, traversables, deuxModes) {
    var jetons = jetonsPour(paire);
    var gT = GR.construire(docCandidat, { jetons: jetons, villesTraversables: true });
    var gN = GR.construire(docCandidat, { jetons: jetons, villesTraversables: false });
    var res = { ok: false, cause: null };
    if (!connexe(gT) || gT.villes.size !== NB_VILLES || gT.apparitions[1].length !== 2 || gT.apparitions[2].length !== 2) {
      res.cause = 'connexite';
      return res;
    }
    if (!ecartVillesRespecte(gT)) { res.cause = 'ecart_villes'; return res; }
    var eN = GR.equilibre(docCandidat, { graphe: gN });
    var eT = (traversables || deuxModes) ? GR.equilibre(docCandidat, { graphe: gT }) : null;
    res.critN = critere(eN);
    res.critT = eT ? critere(eT) : null;
    res.cinqN = res.critN.cinqContreDeux;
    res.cinqT = eT ? res.critT.cinqContreDeux : false;
    res.crit = traversables ? res.critT : res.critN;
    // sorties de chaque case d'apparition (D7 n° 3)
    res.sortiesMin = Infinity;
    [1, 2].forEach(function (pj) {
      gT.apparitions[pj].forEach(function (id) { res.sortiesMin = Math.min(res.sortiesMin, gT.voisins.get(id).size); });
    });
    // ville inaccessible (S non mesurable) testée avant l'écart : null n'est jamais comparé à un seuil
    if (res.critN.villeInaccessible || res.crit.villeInaccessible) res.cause = 'ville_inaccessible';
    else if (res.cinqN || (traversables && res.cinqT)) res.cause = 'cinq_contre_deux';
    else if (res.crit.ecartMax > SEUIL_ECART) res.cause = 'ecart';
    else if (!res.crit.premiereEgale) res.cause = 'premiere_ville';
    else if (deuxModes && (res.cinqT || !sansAlerte(res.critT) || !sansAlerte(res.critN))) res.cause = 'deux_modes';
    else res.ok = true;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Bibliothèque et tirage des tuiles                                   */
  /* ------------------------------------------------------------------ */

  /** Stock par rôle (ids répétés selon les exemplaires), modèles complets seulement, ordre du document. */
  function stockParRole(doc) {
    var stock = { centrale: [], coin: [], bord: [], apparition: [] }, F = M.formatDuDocument(doc);
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) {
      if (!m || !stock[m.role] || !M.validerModele(m, F).complet) return;
      var n = M.exemplairesValides(m);
      for (var k = 0; k < n; k++) stock[m.role].push(m.id);
    });
    return stock;
  }

  /** Besoins par rôle pour une forme : { role: nombre }. */
  function besoinsForme(forme) {
    var b = { centrale: 0, coin: 0, bord: 0, apparition: 0 };
    M.cellulesActives(forme).forEach(function (c) {
      var r = M.roleCellule(c.col, c.lig, forme);
      if (r) b[r]++;
    });
    return b;
  }

  /** Tuiles d'un candidat : [{modeleId, col, lig, rot}] (tirage sans remise par rôle). */
  function tirerTuiles(stock, forme, rng) {
    var paquets = {};
    Object.keys(stock).forEach(function (r) { paquets[r] = melanger(stock[r], rng); });
    return M.cellulesActives(forme).map(function (c) {
      var role = M.roleCellule(c.col, c.lig, forme);
      var rot = M.rotationDeduite(c.col, c.lig, forme);
      return { modeleId: paquets[role].pop(), col: c.col, lig: c.lig, rot: rot === null ? entier(rng, 4) : rot };
    });
  }

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------------ */
  /* Génération                                                          */
  /* ------------------------------------------------------------------ */

  var LIBELLES_CAUSE = {
    plateau_invalide: 'plateau refusé par la validation',
    connexite: 'graphe non connexe',
    ecart_villes: 'villes trop proches',
    cinq_contre_deux: '« 5 contre 2 »',
    ecart: 'écart de plus de 2 pas à un rang',
    premiere_ville: 'première ville à des distances différentes',
    ville_inaccessible: 'ville inaccessible',
    cases_deplacement: 'cases de déplacement hors de ' + CASES_MIN + ' à ' + CASES_MAX
  };

  /**
   * Génère un plateau aléatoire. Ne modifie pas `doc`.
   * options :
   *  - graine (texte ou nombre ; générée si absente) ;
   *  - candidats (défaut 200) : candidats valides à départager ; essaisMax (défaut candidats × 5) ;
   *  - paireCarrefours : 'defaut' (défaut) ou 'varies' ('libre' accepté comme synonyme) ;
   *  - villesTraversables (défaut false, doc 16) : mode de calcul de S, de l'écart et de la première ville ;
   *  - tolerance (défaut 1) : bons candidats = S ≤ Smin + tolérance.
   * Renvoie { ok, doc, graine, essais, candidats, score, paire, rapport: [texte], raison, rejets }.
   */
  function generer(doc, options) {
    options = options || {};
    var graine = options.graine === undefined || options.graine === null || String(options.graine).trim() === ''
      ? nouvelleGraine() : String(options.graine).trim();
    var nbCandidats = Math.max(1, Math.floor(options.candidats || CANDIDATS_DEFAUT));
    var essaisMax = Math.max(nbCandidats, Math.floor(options.essaisMax || nbCandidats * FACTEUR_ESSAIS));
    var varies = options.paireCarrefours === 'varies' || options.paireCarrefours === 'libre';
    var traversables = options.villesTraversables === true;
    var tolerance = typeof options.tolerance === 'number' && options.tolerance >= 0 ? options.tolerance : TOLERANCE_DEFAUT;
    var rng = mulberry32(hacher(graine));
    var rapport = [];
    var rejets = { plateau_invalide: 0, cases_deplacement: 0, connexite: 0, ecart_villes: 0, ville_inaccessible: 0, cinq_contre_deux: 0, ecart: 0, premiere_ville: 0 };

    function echec(raison, essais) {
      return { ok: false, doc: null, graine: graine, essais: essais || 0, candidats: 0, score: null, paire: null, rapport: rapport, raison: raison, rejets: rejets };
    }

    if (!doc || typeof doc !== 'object') return echec('Aucun document à partir duquel générer.');

    // Forme : 4×4 complet seulement (D7)
    var forme = { retires: [] };
    var ancienne = doc.plateau && doc.plateau.forme && Array.isArray(doc.plateau.forme.retires) ? doc.plateau.forme.retires : [];
    if (ancienne.length) {
      rapport.push('La forme réduite du plateau est remplacée par le 4×4 complet (le générateur ne travaille que sur le 4×4 complet).');
    }

    // Stock plafonné (somme des exemplaires des modèles complets), puis bibliothèque suffisante ?
    var stock = stockParRole(doc), besoins = besoinsForme(forme), manques = [];
    var total = M.ROLES.reduce(function (s, r) { return s + stock[r].length; }, 0);
    if (total > M.PLAFOND_TUILES) {
      return echec('La bibliothèque compte ' + total + ' tuiles (modèles complets, selon leurs exemplaires) : le générateur en accepte ' +
        M.PLAFOND_TUILES + ' au plus. Réduisez le nombre d\'exemplaires.');
    }
    M.ROLES.forEach(function (r) {
      if (stock[r].length < besoins[r]) {
        manques.push((besoins[r] - stock[r].length) + ' ' + LIBELLES_ROLE[r] + ' (' + stock[r].length + ' disponible(s), ' + besoins[r] + ' nécessaire(s))');
      }
    });
    if (manques.length) {
      return echec('Bibliothèque insuffisante (modèles complets seulement) : il manque ' + manques.join(', ') + '.');
    }

    // Candidats
    var base = { forme: forme, tuiles: [], jetons: [] };
    var modeles = doc.modeles;
    var bons = [], essais = 0;
    while (bons.length < nbCandidats && essais < essaisMax) {
      essais++;
      var tuiles = tirerTuiles(stock, forme, rng);
      var cand = { modeles: modeles, plateau: { forme: base.forme, tuiles: tuiles, jetons: jetonsPour(PAIRE_DEFAUT) } };
      var v = M.validerPlateau(cand);
      if (v.erreurs.length) { rejets.plateau_invalide++; continue; }
      var nbCases = casesDeplacement(cand);
      if (nbCases < CASES_MIN || nbCases > CASES_MAX) { rejets.cases_deplacement++; continue; } // garde-fou D7
      var ev = evaluer(cand, PAIRE_DEFAUT, traversables, false);
      if (!ev.ok) { rejets[ev.cause]++; continue; }
      var raccords = M.raccordsMorts(cand).filter(function (r) { return r.raison !== 'absent'; }).length;
      var portsMorts = M.portsCoinMorts(cand).length;
      var sortiesFaibles = ev.sortiesMin < 2 ? 1 : 0;
      bons.push({
        tuiles: tuiles, ev: ev, raccords: raccords, portsMorts: portsMorts, sortiesMin: ev.sortiesMin,
        S: ev.crit.S, penalite: Math.max(0, raccords - RACCORDS_TOLERES) + portsMorts + 3 * sortiesFaibles
      });
    }

    if (!bons.length) {
      var detail = Object.keys(rejets).filter(function (k) { return rejets[k]; })
        .map(function (k) { return LIBELLES_CAUSE[k] + ' : ' + rejets[k]; }).join(', ');
      return echec('Aucun plateau acceptable en ' + essais + ' essais' + (detail ? ' (' + detail + ')' : '') +
        '. Modifiez la bibliothèque ou essayez une autre graine.', essais);
    }

    // Bons candidats : S ≤ Smin + tolérance ; à S égal, pénalité minimale (D7 n° 2, 3) ; tirage au hasard (D7 n° 4)
    var Smin = Math.min.apply(null, bons.map(function (x) { return x.S; }));
    var parmi = bons.filter(function (x) { return x.S <= Smin + tolerance; });
    var penMin = {};
    parmi.forEach(function (x) { penMin[x.S] = Math.min(penMin[x.S] === undefined ? Infinity : penMin[x.S], x.penalite); });
    parmi = parmi.filter(function (x) { return x.penalite === penMin[x.S]; });
    var choisi = parmi[entier(rng, parmi.length)];

    // Paire de carrefours
    var paire = PAIRE_DEFAUT, evPaire = choisi.ev, pairesPermises = [clePaire(PAIRE_DEFAUT)];
    if (varies) {
      var docChoisi = { modeles: modeles, plateau: { forme: forme, tuiles: choisi.tuiles, jetons: [] } };
      var refDefaut = evaluer(docChoisi, PAIRE_DEFAUT, traversables, true);
      var options2 = [];
      PAIRES.forEach(function (pp) {
        var e2 = memeJonction(pp[0], PAIRE_DEFAUT[0]) && memeJonction(pp[1], PAIRE_DEFAUT[1]) ? refDefaut : evaluer(docChoisi, pp, traversables, true);
        // la paire par défaut reste toujours permise (elle a déjà passé l'élimination du mode choisi)
        if (pp === PAIRE_DEFAUT || (e2.ok && refDefaut.crit && refDefaut.crit.S !== null && e2.crit.S !== null && e2.crit.S <= refDefaut.crit.S)) options2.push({ paire: pp, ev: pp === PAIRE_DEFAUT ? choisi.ev : e2 });
      });
      if (options2.length) {
        pairesPermises = options2.map(function (x) { return clePaire(x.paire); });
        var tir = options2[entier(rng, options2.length)];
        paire = tir.paire;
        evPaire = tir.ev;
      }
    }

    // Document final : modèles et autres champs inchangés, plateau remplacé
    var sortie = cloner(doc);
    sortie.plateau = { forme: { retires: [] }, tuiles: cloner(choisi.tuiles), jetons: jetonsPour(paire) };
    var validation = M.validerPlateau(sortie);

    var crit = evPaire.crit;
    var score = {
      S: crit.S, ecartMax: crit.ecartMax, partage: crit.partage, D: crit.D,
      raccordsMorts: M.raccordsMorts(sortie).filter(function (r) { return r.raison !== 'absent'; }).length,
      portsMorts: M.portsCoinMorts(sortie).length,
      sortiesMin: evPaire.sortiesMin,
      villesTraversables: traversables,
      bons: parmi.length, Smin: Smin
    };
    rapport.push('Graine « ' + graine + ' » : ' + bons.length + ' candidat(s) valide(s) en ' + essais + ' essai(s), tirage parmi ' +
      parmi.length + ' bon(s) candidat(s) (S = ' + Smin + (tolerance ? ' à ' + (Smin + tolerance) : '') + ').');
    rapport.push('Calcul en villes ' + (traversables ? 'traversables' : 'non traversables') + ' ; « 5 contre 2 » toujours vérifié en villes non traversables.');
    rapport.push('Carrefours ' + clePaire(paire) + (varies ? ' (carrefours variés : ' + pairesPermises.length + ' paire(s) permise(s) sur ce plateau)' : ' (paire par défaut)') + '.');
    rapport.push('Score S (somme des écarts sur les 7 rangs) : ' + crit.S + ' ; écart maximal : ' + crit.ecartMax + ' pas.');
    rapport.push('Villes plus proches du joueur 1 : ' + crit.partage[1] + ', du joueur 2 : ' + crit.partage[2] + ', à égalité : ' + crit.partage.egalite + '.');
    rapport.push('Raccords morts : ' + score.raccordsMorts + ' ; ports de coin morts : ' + score.portsMorts + ' ; sorties minimales d\'une apparition : ' + score.sortiesMin + '.');
    if (validation.erreurs.length) rapport.push('Attention : ' + validation.erreurs[0].message);

    return {
      ok: validation.erreurs.length === 0, doc: sortie, graine: graine, essais: essais, candidats: bons.length,
      score: score, paire: clePaire(paire), pairesPermises: pairesPermises, rapport: rapport,
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
        R.contenuTuile(m, { rot: t.rot, joueur: M.joueurCellule(t.col, t.lig, F), format: F }) + '</g>');
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

    racine.appendChild(el(d, 'p', 'pm-generateur-explication',
      'Tire un plateau 4×4 complet dans la bibliothèque : 7 villes et 2 carrefours, plateau équilibré tiré au hasard parmi les meilleurs candidats. ' +
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

    // Paire de carrefours
    var groupe = el(d, 'fieldset', 'pm-generateur-groupe');
    groupe.appendChild(el(d, 'legend', null, 'Carrefours'));
    function radio(valeur, texte, coche) {
      var lab = el(d, 'label', 'pm-generateur-choix');
      var r = el(d, 'input');
      r.type = 'radio';
      r.name = 'pm-generateur-paire-' + n;
      r.value = valeur;
      r.checked = coche;
      lab.appendChild(r);
      lab.appendChild(d.createTextNode(' ' + texte));
      groupe.appendChild(lab);
      return r;
    }
    radio('defaut', 'Paire par défaut (1,2)+(3,2), au milieu du plateau', true);
    var rVaries = radio('varies', 'Carrefours variés : autre paire si elle reste équilibrée', false);
    racine.appendChild(groupe);

    // Villes traversables (option conservée, doc 16)
    var ligneTrav = el(d, 'p', 'pm-generateur-ligne');
    var labTrav = el(d, 'label', 'pm-generateur-choix');
    var cbTrav = el(d, 'input');
    cbTrav.type = 'checkbox';
    cbTrav.checked = false;
    labTrav.appendChild(cbTrav);
    labTrav.appendChild(d.createTextNode(' Villes traversables (par défaut, une ville n\'est qu\'une destination)'));
    ligneTrav.appendChild(labTrav);
    racine.appendChild(ligneTrav);

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
      var options = { graine: champ.value, paireCarrefours: rVaries.checked ? 'varies' : 'defaut', villesTraversables: cbTrav.checked };
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
      etat.signaler('Plateau aléatoire appliqué (graine ' + r.graine + ', carrefours ' + r.paire + '). Ctrl+Z pour revenir.', 'info');
    });

    conteneur.appendChild(racine);
    racine.champGraine = champ;
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
    PAIRE_DEFAUT: clePaire(PAIRE_DEFAUT),
    PAIRES: PAIRES.map(clePaire),
    generer: generer,
    critere: critere,
    hacher: hacher,
    mulberry32: mulberry32,
    nouvelleGraine: nouvelleGraine,
    svgApercu: svgApercu,
    remplir: remplir,
    ouvrir: ouvrir
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.generateur;
})();
