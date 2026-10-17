/*
 * graphe.js : graphe global du plateau et analyse d'équilibre (critère de docs/archives/16-avis-mesures-equilibre.md,
 * seuils de blocage de docs/19-avis-design-v2.md et arbitrages de docs/20).
 * Aucun accès au DOM : toutes les fonctions sont pures et ne modifient pas le document.
 *
 * Nœuds du graphe :
 *  - une case par case de tuile posée (id global « col,lig:idLocal », voir PM.modele.tuileEnPlateau) ;
 *  - un nœud « J<i>,<j> » par jonction intérieure (9 en 4×4, 16 en 5×5), avec ou sans jeton : une ville si un
 *    jeton 'capture' y est posé, sinon une case chemin (docs/20 D1), qui compte comme une case.
 * Arêtes : chemins internes à une tuile, raccords connectés face à face entre deux tuiles,
 * jonction <-> cases porteuses d'un port de coin. Le graphe est symétrique (non orienté).
 *
 * Joueurs : 1 = vert (nord), 2 = rouge (sud) ; une case d'apparition appartient au camp de sa cellule
 * (PM.geometrie.format(id).campCellule), les cases d'apparition neutres (rangée centrale du 5×5) ne comptent pas.
 * Villes non traversables (règle du jeu, docs/18) : une ville n'est qu'une destination ; le graphe reste
 * symétrique et les parcours n'étendent jamais une ville (sauf si elle est la source). L'option interne
 * villesTraversables: true sert seulement aux mesures et aux tests.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var G = PM.geometrie;
  var M = PM.modele;

  /** Nombre de villes et seuils (constantes uniques, lues aussi par controles.js et generateur.js). */
  var NB_VILLES = 7;
  var RANGS_COMPARES = 4;       // ancien D6 : écart aux rangs 1 à 4 (champ ecartRang, information seulement)
  var SEUIL_ECART = 2;          // alerte si l'écart dépasse 2 à un rang de 1 à 7 (docs/archives/16 b)
  var SEUIL_CINQ_CONTRE_DEUX = 5;
  var SEUIL_APPARITION_LOINTAINE = 7;
  var SEUIL_S = 5;                 // constante unique pour les deux formats, lue par le générateur et l'interface (docs/36 : S >= 5 définitif)
  var SEUIL_S_INFORMATION = 4;     // S = 4 : simple information, sans alerte (docs/22)
  var PORTS_VILLE_MIN = 3;         // 5×5 : ports minimum d'une jonction qui porte une ville ; en dessous, information seulement (docs/36) ; lu par le générateur et les outils
  var PORTS_JONCTION_MIN = G.MIN_PORTS_JONCTION; // ports minimum de toute jonction intérieure (condition ferme du générateur 5×5)
  /** Villes du 5×5 en « 2-3-2 » (docs/18) : groupes de rangées de jonctions et nombre de villes dans chaque groupe. */
  var REPARTITION_VILLES_5X5 = Object.freeze([
    Object.freeze({ rangees: Object.freeze([1]), nb: 2 }),
    Object.freeze({ rangees: Object.freeze([2, 3]), nb: 3 }),
    Object.freeze({ rangees: Object.freeze([4]), nb: 2 })
  ]);
  var CONSEIL_5X5 = ' Les 3 villes du milieu sont sur une seule rangée : en mettre 2 sur l’une et 1 sur l’autre rétablit presque toujours l’équilibre.';
  /**
   * Plateau très déséquilibré (docs/19, arbitrage de docs/20) : écart de plus de SEUIL_BLOCAGE_ECART pas à un
   * rang de 1 à 7, ou « 5 contre 2 » si CINQ_CONTRE_DEUX_BLOQUANT. Seuils définitifs dans les deux formats
   * (docs/36) ; c'est une erreur sur un plateau complet (la pose reste permise).
   */
  var SEUIL_BLOCAGE_ECART = 3;
  var CINQ_CONTRE_DEUX_BLOQUANT = true;
  /** Joueurs : numéro interne et nom affiché. */
  var JOUEUR_DU_CAMP = { vert: 1, rouge: 2 };
  var NOM_JOUEUR = { 1: 'vert', 2: 'rouge' };

  /* ------------------------------------------------------------------ */
  /* Construction                                                        */
  /* ------------------------------------------------------------------ */

  function idJonction(i, j) { return 'J' + i + ',' + j; }

  /**
   * Construit le graphe d'un document.
   * options :
   *  - villesTraversables (défaut false : une ville n'est qu'une destination, règle du jeu) ;
   *  - jetons : tableau [{i, j, type}] qui remplace doc.plateau.jetons (mesures : essayer des
   *    placements de villes sans cloner le document) ;
   *  - filtreTuile(tuile) → booléen : ne garde que certaines tuiles (sous-graphes).
   * Renvoie { noeuds: [id], voisins: Map<id, Set<id>>, cases: Map<id, case>,
   *   jonctions: [{ id, i, j, type: 'ville'|'case', ports, cases: [idCase] }] (toutes les jonctions intérieures),
   *   villes: Set<id>, apparitions: {1: [idCase], 2: [idCase]} (1 = vert, 2 = rouge), villesTraversables }.
   * Ne lève pas d'exception sur un plateau incomplet : tuile sans modèle ignorée, jonction sans port isolée.
   */
  function construire(doc, options) {
    options = options || {};
    var plateau = (doc && doc.plateau) || {};
    var F = M.formatDuDocument(doc);
    var tuiles = Array.isArray(plateau.tuiles) ? plateau.tuiles : [];
    var jetons = Array.isArray(options.jetons) ? options.jetons : (Array.isArray(plateau.jetons) ? plateau.jetons : []);
    var voisins = new Map(), cases = new Map(), parRaccord = new Map(), portsParJonction = new Map();
    var g = {
      noeuds: [], voisins: voisins, cases: cases, jonctions: [], villes: new Set(),
      apparitions: { 1: [], 2: [] }, villesTraversables: options.villesTraversables === true
    };

    function noeud(id) { if (!voisins.has(id)) { voisins.set(id, new Set()); g.noeuds.push(id); } }
    function lier(a, b) { voisins.get(a).add(b); voisins.get(b).add(a); }

    var elems = [];
    tuiles.forEach(function (t) {
      if (!t || (options.filtreTuile && !options.filtreTuile(t))) return;
      var e = M.tuileEnPlateau(doc, t);
      if (e) elems.push({ t: t, e: e });
    });
    elems.forEach(function (x) {
      x.e.cases.forEach(function (c) {
        cases.set(c.id, c);
        noeud(c.id);
        var joueur = c.type === 'apparition' ? JOUEUR_DU_CAMP[c.camp] : undefined;
        if (joueur) g.apparitions[joueur].push(c.id);
      });
    });
    elems.forEach(function (x) { x.e.aretes.forEach(function (a) { if (voisins.has(a[0]) && voisins.has(a[1])) lier(a[0], a[1]); }); });
    elems.forEach(function (x) {
      x.e.raccords.forEach(function (r) { parRaccord.set(x.t.col + ',' + x.t.lig + ',' + r.cote + ',' + r.pos, r.caseId); });
    });
    elems.forEach(function (x) {
      x.e.raccords.forEach(function (r) {
        var d = G.coteVoisin(r.cote), f = G.raccordEnFace(r.cote, r.pos);
        var autre = parRaccord.get((x.t.col + d.dc) + ',' + (x.t.lig + d.dl) + ',' + f.cote + ',' + f.pos);
        // Un modèle invalide peut désigner une case absente : on ignore ce raccord (audit v2, M1).
        if (autre && voisins.has(r.caseId) && voisins.has(autre)) lier(r.caseId, autre);
      });
      x.e.ports.forEach(function (p) {
        var id = idJonction(p.i, p.j);
        if (!portsParJonction.has(id)) portsParJonction.set(id, []);
        portsParJonction.get(id).push(p.caseId);
      });
    });

    // Villes : jetons 'capture' (le premier jeton d'une jonction compte)
    var villes = new Set();
    jetons.forEach(function (jeton) { if (jeton && jeton.type === 'capture') villes.add(idJonction(jeton.i, jeton.j)); });
    // Toutes les jonctions intérieures : nœud relié aux cases porteuses des ports qui y aboutissent
    for (var j = 1; j < F.GRILLE.lignes; j++) {
      for (var i = 1; i < F.GRILLE.colonnes; i++) {
        var id = idJonction(i, j), portees = portsParJonction.get(id) || [], ville = villes.has(id);
        noeud(id);
        portees.forEach(function (c) { lier(id, c); });
        g.jonctions.push({ id: id, i: i, j: j, type: ville ? 'ville' : 'case', ports: portees.length, cases: portees.slice() });
        if (ville) g.villes.add(id);
      }
    }
    return g;
  }

  /**
   * Graphe connexe (tous les nœuds, jonctions comprises, dans une seule composante ; parcours sans tenir
   * compte des villes). Un graphe vide n'est pas connexe.
   */
  function connexe(g) {
    if (!g.noeuds.length) return false;
    var vus = new Set([g.noeuds[0]]), file = [g.noeuds[0]];
    for (var q = 0; q < file.length; q++) {
      g.voisins.get(file[q]).forEach(function (y) { if (!vus.has(y)) { vus.add(y); file.push(y); } });
    }
    return vus.size === g.noeuds.length;
  }

  /**
   * Paires de villes à moins de ECART_MIN_VILLES cases d'écart (moins de ECART_MIN_VILLES + 1 pas, villes non
   * traversables) : [{a: {i, j}, b: {i, j}, pas}], chaque paire une fois. Alerte seulement (docs/18).
   */
  function villesProches(g) {
    var mini = G.ECART_MIN_VILLES + 1, res = [], villes = [];
    g.jonctions.forEach(function (jn) { if (jn.type === 'ville') villes.push(jn); });
    var gN = g.villesTraversables ? Object.assign({}, g, { villesTraversables: false }) : g;
    villes.forEach(function (v, k) {
      var d = parcours(gN, [v.id], null);
      villes.slice(k + 1).forEach(function (w) {
        if (d.has(w.id) && d.get(w.id) < mini) res.push({ a: { i: v.i, j: v.j }, b: { i: w.i, j: w.j }, pas: d.get(w.id) });
      });
    });
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Parcours                                                            */
  /* ------------------------------------------------------------------ */

  function enTableau(x) { return Array.isArray(x) ? x : (x === undefined || x === null ? [] : [x]); }

  /** Parcours en largeur interne : `exclus` = ensemble de nœuds retirés. Renvoie Map<id, pas>. */
  function parcours(g, sources, exclus) {
    var d = new Map(), file = [];
    sources.forEach(function (s) {
      if (g.voisins.has(s) && !(exclus && exclus.has(s)) && !d.has(s)) { d.set(s, 0); file.push(s); }
    });
    var terminaux = !g.villesTraversables;
    while (file.length) {
      var suivants = [];
      for (var k = 0; k < file.length; k++) {
        var x = file[k], dx = d.get(x);
        if (terminaux && dx > 0 && g.villes.has(x)) continue; // une ville n'est qu'une destination
        g.voisins.get(x).forEach(function (y) {
          if (!d.has(y) && !(exclus && exclus.has(y))) { d.set(y, dx + 1); suivants.push(y); }
        });
      }
      file = suivants;
    }
    return d;
  }

  /** Distances en pas depuis un nœud ou un tableau de nœuds : Map<id, pas> (nœuds inaccessibles absents). */
  function distances(g, depart) { return parcours(g, enTableau(depart), null); }

  /** Distances depuis les cases d'apparition du joueur (1 = vert, 2 = rouge ; minimum sur ses apparitions). */
  function distancesJoueur(g, joueur) { return parcours(g, g.apparitions[joueur] || [], null); }

  /* ------------------------------------------------------------------ */
  /* Équilibre (critère de docs/archives/16)                            */
  /* ------------------------------------------------------------------ */

  function tri(t) { return t.slice().sort(function (a, b) { return a - b; }); }
  var estFini = function (x) { return x !== undefined && isFinite(x); };

  /**
   * Conseil 5×5 (docs/36) : vrai si les villes respectent le squelette 2-3-2 (2 en j = 1, 3 en j = 2 ou 3, 2 en j = 4)
   * et que les 3 villes du milieu sont toutes sur la même rangée (j = 2 ou j = 3).
   */
  function conseil5x5Applicable(villes) {
    if (villes.length !== NB_VILLES) return false;
    var par = {};
    villes.forEach(function (v) { par[v.j] = (par[v.j] || 0) + 1; });
    var total = 0;
    return REPARTITION_VILLES_5X5.every(function (g) {
      var n = 0, max = 0;
      g.rangees.forEach(function (j) { n += par[j] || 0; max = Math.max(max, par[j] || 0); });
      total += n;
      // le groupe a son effectif ; un groupe de plusieurs rangées (le milieu) doit tenir sur une seule
      return n === g.nb && (g.rangees.length === 1 || max === g.nb);
    }) && total === NB_VILLES;
  }

  /**
   * Analyse d'équilibre d'un document (critère de docs/archives/16, seuils de docs/19).
   * options : villesTraversables, jetons (voir construire), nbVilles (défaut 7), graphe (graphe déjà construit).
   * Joueurs : 1 = vert, 2 = rouge (distances depuis la case d'apparition la plus proche de chaque camp).
   * Renvoie :
   *  - villes : [{id, i, j}] ; D : {1: [distances triées], 2: [...]} (villes inaccessibles exclues) ;
   *  - parRang : [{rang, d1, d2, ecart, compte}] (compte = rang pris en compte dans S et l'écart, rangs 1 à 7) ;
   *  - ecartRang : plus grand |D1(k) - D2(k)| aux rangs 1 à 4 (ancien D6, information sans alerte), ou null ;
   *  - S, ecartMax7 : somme et maximum des écarts aux rangs 1 à 7 (docs/archives/16), null si un joueur a moins de
   *    nbVilles distances (ville inaccessible ou manquante) ;
   *  - cinqContreDeux : un joueur strictement plus proche de 5 villes ou plus (7 villes posées) ;
   *  - premiereEgale : première ville à la même distance pour les deux joueurs (invariant d) ;
   *  - partage : {1, 2, egalite} (villes strictement plus proches du vert, du rouge, à égalité) ;
   *  - tempo : {1: {3, 4, 5}, 2: {3, 4, 5}} (villes atteignables en au plus 3, 4, 5 pas) ;
   *  - premiereVille : {1, 2, ecart} (distance de la ville la plus proche, null si aucune) ;
   *  - inaccessibles : {1: [{i, j}], 2: [{i, j}]} ; apparitions : {1, 2} (nombre de cases d'apparition) ;
   *  - blocages : [{code, message}] (plateau très déséquilibré : « 5 contre 2 », écart > SEUIL_BLOCAGE_ECART) ;
   *    tresDesequilibre : blocages non vide ;
   *  - aSurveiller : S >= SEUIL_S (5) ; sInformation : S = 4, information sans alerte (docs/22) ;
   *  - informations : [{code, message}] (5×5 : ville sur une jonction à moins de 3 ports, jamais une alerte) ;
   *  - alertes : [{code, message}] ; lacunes : [texte] ; complet : booléen (7 villes, au moins une case
   *    d'apparition par camp, toutes les tuiles posées avec un modèle présent dans la bibliothèque) ; partiel : !complet.
   * Ne lève pas d'exception sur un plateau incomplet.
   */
  function equilibre(doc, options) {
    options = options || {};
    var nbVilles = options.nbVilles || NB_VILLES;
    var g = options.graphe || construire(doc, options);
    var villes = g.jonctions.filter(function (j) { return j.type === 'ville'; });
    var lacunes = [];

    // Ce qui manque
    var plateau = (doc && doc.plateau) || {}, grille = M.formatDuDocument(doc).GRILLE;
    var attendues = grille.colonnes * grille.lignes;
    var tuilesPosees = Array.isArray(plateau.tuiles) ? plateau.tuiles.filter(Boolean) : [];
    // une tuile dont le modèle est introuvable est ignorée par le graphe : elle ne compte pas comme posée
    var introuvables = tuilesPosees.filter(function (t) { return !M.modeleParId(doc, t.modeleId); }).length;
    if (tuilesPosees.length < attendues) lacunes.push('Il manque ' + (attendues - tuilesPosees.length) + ' tuile(s) sur ' + attendues + '.');
    if (introuvables) lacunes.push(introuvables + ' tuile(s) posée(s) dont le modèle est introuvable dans la bibliothèque : ignorée(s).');
    if (villes.length !== nbVilles) {
      lacunes.push(villes.length < nbVilles
        ? 'Il manque ' + (nbVilles - villes.length) + ' ville(s) : ' + villes.length + ' posée(s) sur ' + nbVilles + '.'
        : 'Il y a ' + villes.length + ' villes pour ' + nbVilles + ' prévues.');
    }
    [1, 2].forEach(function (p) {
      if (!g.apparitions[p].length) lacunes.push('Le joueur ' + NOM_JOUEUR[p] + ' n\'a aucune case d\'apparition.');
    });

    var dist = { 1: distancesJoueur(g, 1), 2: distancesJoueur(g, 2) };
    var parVille = villes.map(function (v) {
      var a = dist[1].has(v.id) ? dist[1].get(v.id) : Infinity, b = dist[2].has(v.id) ? dist[2].get(v.id) : Infinity;
      return { v: v, d1: a, d2: b };
    });
    var avecAppar = g.apparitions[1].length > 0 && g.apparitions[2].length > 0;
    var D = { 1: tri(parVille.map(function (x) { return x.d1; }).filter(estFini)), 2: tri(parVille.map(function (x) { return x.d2; }).filter(estFini)) };
    var inaccessibles = { 1: [], 2: [] };
    parVille.forEach(function (x) {
      if (!isFinite(x.d1) && g.apparitions[1].length) inaccessibles[1].push({ i: x.v.i, j: x.v.j });
      if (!isFinite(x.d2) && g.apparitions[2].length) inaccessibles[2].push({ i: x.v.i, j: x.v.j });
    });

    // Écart par rang
    var parRang = [], ecartRang = null, nbRangs = Math.max(D[1].length, D[2].length);
    for (var k = 0; k < nbRangs; k++) {
      var d1 = k < D[1].length ? D[1][k] : null, d2 = k < D[2].length ? D[2][k] : null;
      parRang.push({ rang: k + 1, d1: d1, d2: d2, ecart: d1 !== null && d2 !== null ? Math.abs(d1 - d2) : null, compte: k < nbVilles });
    }
    if (avecAppar) {
      for (var r = 0; r < RANGS_COMPARES; r++) {
        if (parRang[r] && parRang[r].ecart !== null) ecartRang = Math.max(ecartRang === null ? 0 : ecartRang, parRang[r].ecart);
      }
    }
    // Des villes inaccessibles ne sont pas une donnée manquante (tuiles, villes et apparitions sont là) :
    // pas de lacune, l'alerte ville_inaccessible les signale et S vaut null.

    // Écart étendu aux rangs 1 à 7 et score S = somme des écarts, seulement si chaque joueur
    // a ses nbVilles distances (sinon une ville est inaccessible ou manquante : pas de score trompeur)
    var S = null, ecartMax7 = null;
    if (avecAppar && Math.min(D[1].length, D[2].length) >= nbVilles) {
      parRang.forEach(function (x) {
        if (x.ecart === null) return;
        S = (S === null ? 0 : S) + x.ecart;
        ecartMax7 = Math.max(ecartMax7 === null ? 0 : ecartMax7, x.ecart);
      });
    }

    // Partage, tempo, première ville
    var partage = { 1: 0, 2: 0, egalite: 0 };
    parVille.forEach(function (x) {
      if (x.d1 < x.d2) partage[1]++; else if (x.d2 < x.d1) partage[2]++; else if (isFinite(x.d1)) partage.egalite++;
    });
    var tempo = { 1: {}, 2: {} };
    [1, 2].forEach(function (p) { [3, 4, 5].forEach(function (n) { tempo[p][n] = D[p].filter(function (x) { return x <= n; }).length; }); });
    var premiereVille = { 1: D[1].length ? D[1][0] : null, 2: D[2].length ? D[2][0] : null, ecart: null };
    if (premiereVille[1] !== null && premiereVille[2] !== null) premiereVille.ecart = Math.abs(premiereVille[1] - premiereVille[2]);
    var premiereEgale = premiereVille.ecart === 0;
    var cinqContreDeux = villes.length === nbVilles && Math.max(partage[1], partage[2]) >= SEUIL_CINQ_CONTRE_DEUX;

    var villesA4 = { 1: D[1].filter(function (x) { return x <= 4; }).length, 2: D[2].filter(function (x) { return x <= 4; }).length, ecart: null };
    villesA4.ecart = Math.abs(villesA4[1] - villesA4[2]);

    // Plateau très déséquilibré (blocages) puis alertes
    var blocages = [], alertes = [], informations = [];
    var est5x5 = M.formatDuDocument(doc).id === '5x5';
    var conseil5x5 = est5x5 && conseil5x5Applicable(villes) ? CONSEIL_5X5 : '';
    if (est5x5) {
      villes.forEach(function (v) {
        if (v.ports < PORTS_VILLE_MIN) {
          informations.push({ code: 'ville_peu_de_ports', message: 'La ville (' + v.i + ', ' + v.j + ') est sur une jonction à ' + v.ports + ' port(s), moins de ' + PORTS_VILLE_MIN + ' (information, sans alerte).' });
        }
      });
    }
    if (cinqContreDeux) {
      var fort = partage[1] >= partage[2] ? 1 : 2;
      var cinq = { code: 'cinq_contre_deux', message: 'Le joueur ' + NOM_JOUEUR[fort] + ' est plus proche de ' + partage[fort] + ' villes contre ' + partage[3 - fort] + ' pour le joueur ' + NOM_JOUEUR[3 - fort] + ' (« 5 contre 2 »).' +
        // conseil propre au 4×4 (docs/22) ; conseil conditionnel propre au 5×5 (docs/36)
        (M.formatDuDocument(doc).id === '4x4' ? ' Conseil : placer les deux jonctions-cases (sans ville) dans la rangée centrale, par exemple (1, 2) et (3, 2).' : conseil5x5) };
      (CINQ_CONTRE_DEUX_BLOQUANT ? blocages : alertes).push(cinq);
    }
    if (ecartMax7 !== null && ecartMax7 > SEUIL_BLOCAGE_ECART) {
      blocages.push({ code: 'ecart_bloquant', message: 'Un rang de villes (de 1 à 7) est à ' + ecartMax7 + ' pas d\'écart entre les deux joueurs (plus de ' + SEUIL_BLOCAGE_ECART + ').' });
    } else if (ecartMax7 !== null && ecartMax7 > SEUIL_ECART) {
      alertes.push({ code: 'ecart_rang_etendu', message: 'Un rang de villes (de 1 à 7) est à ' + ecartMax7 + ' pas d\'écart entre les deux joueurs (plus de ' + SEUIL_ECART + ').' });
    }
    if (S !== null && S >= SEUIL_S) {
      alertes.push({ code: 'score_s', message: 'Score S = ' + S + ' (somme des écarts sur les 7 rangs) : plateau à surveiller (à partir de ' + SEUIL_S + ').' + (cinqContreDeux ? '' : conseil5x5) });
    }
    if (premiereVille.ecart !== null && premiereVille.ecart !== 0) {
      alertes.push({ code: 'premiere_ville_inegale', message: 'La première ville est à ' + premiereVille[1] + ' pas du joueur vert et à ' + premiereVille[2] + ' pas du joueur rouge (elle devrait être à la même distance).' });
    }
    [1, 2].forEach(function (p) {
      g.apparitions[p].forEach(function (id) {
        var dd = distances(g, id), mini = Infinity;
        villes.forEach(function (v) { if (dd.has(v.id)) mini = Math.min(mini, dd.get(v.id)); });
        if (villes.length && mini > SEUIL_APPARITION_LOINTAINE) {
          alertes.push({ code: 'apparition_lointaine', message: isFinite(mini)
            ? 'Une case d\'apparition du joueur ' + NOM_JOUEUR[p] + ' est à ' + mini + ' pas de la ville la plus proche (plus de ' + SEUIL_APPARITION_LOINTAINE + ').'
            : 'Une case d\'apparition du joueur ' + NOM_JOUEUR[p] + ' n\'atteint aucune ville.' });
        }
      });
    });
    [1, 2].forEach(function (p) {
      if (inaccessibles[p].length) {
        alertes.push({ code: 'ville_inaccessible', message: inaccessibles[p].length + ' ville(s) hors d\'atteinte du joueur ' + NOM_JOUEUR[p] + '.' });
      }
    });

    return {
      villes: villes.map(function (v) { return { id: v.id, i: v.i, j: v.j }; }),
      D: D, parRang: parRang, ecartRang: ecartRang, S: S, ecartMax7: ecartMax7, aSurveiller: S !== null && S >= SEUIL_S, sInformation: S !== null && S >= SEUIL_S_INFORMATION && S < SEUIL_S, villesA4: villesA4, partage: partage, alertes: alertes, informations: informations, tempo: tempo,
      cinqContreDeux: cinqContreDeux, premiereEgale: premiereEgale, blocages: blocages, tresDesequilibre: blocages.length > 0,
      apparitions: { 1: g.apparitions[1].length, 2: g.apparitions[2].length },
      premiereVille: premiereVille, inaccessibles: inaccessibles, lacunes: lacunes,
      complet: lacunes.length === 0, partiel: lacunes.length > 0,
      villesTraversables: g.villesTraversables
    };
  }

  /** Signature des distances (D1 trié | D2 trié), pour mesurer la diversité des plateaux. */
  function profil(doc, options) {
    var e = equilibre(doc, options);
    return e.D[1].join(',') + '|' + e.D[2].join(',');
  }

  /* ------------------------------------------------------------------ */
  /* Goulets                                                             */
  /* ------------------------------------------------------------------ */

  /**
   * Nombre maximal de chemins entre un ensemble de sources et une cible, sans case commune
   * (hormis les cases d'apparition, points de départ, et la cible) :
   * flot maximal sur le graphe aux sommets dédoublés (capacité 1), arêtes à capacité 1.
   * Les villes autres que la cible ne servent d'intermédiaires que si elles sont traversables.
   */
  function cheminsDisjoints(g, sources, cible) {
    var index = new Map();
    g.noeuds.forEach(function (id, n) { index.set(id, n); });
    var N = g.noeuds.length, S = 2 * N, T = 2 * index.get(cible) + 1;
    var tete = [], suiv = [], vers = [], cap = [];
    for (var x = 0; x <= S; x++) tete.push(-1);
    function ajouter(a, b, c) {
      vers.push(b); cap.push(c); suiv.push(tete[a]); tete[a] = vers.length - 1;
      vers.push(a); cap.push(0); suiv.push(tete[b]); tete[b] = vers.length - 1;
    }
    var INF = N + 5;
    g.noeuds.forEach(function (id, n) {
      // sommet dédoublé ; la cible et les cases d'apparition (points de départ communs) ne sont pas limitées
      ajouter(2 * n, 2 * n + 1, (id === cible || sources.indexOf(id) >= 0) ? INF : 1);
      if (!g.villesTraversables && g.villes.has(id) && id !== cible) return; // ville : destination seulement
      g.voisins.get(id).forEach(function (w) { ajouter(2 * n + 1, 2 * index.get(w), 1); });
    });
    sources.forEach(function (s) { if (index.has(s)) ajouter(S, 2 * index.get(s), INF); });
    var flot = 0;
    for (;;) {
      var pere = new Array(S + 1).fill(-1), vu = new Array(S + 1).fill(false), file = [S];
      vu[S] = true;
      for (var q = 0; q < file.length && !vu[T]; q++) {
        for (var e = tete[file[q]]; e !== -1; e = suiv[e]) {
          if (cap[e] > 0 && !vu[vers[e]]) { vu[vers[e]] = true; pere[vers[e]] = e; file.push(vers[e]); }
        }
      }
      if (!vu[T]) break;
      for (var v = T; v !== S; v = vers[pere[v] ^ 1]) { cap[pere[v]]--; cap[pere[v] ^ 1]++; }
      flot++;
    }
    return flot;
  }

  /**
   * Goulets d'un joueur : chemins disjoints (sommets) de ses apparitions vers chaque ville, et
   * points d'articulation (nœuds dont le retrait coupe au moins une ville de toutes ses apparitions).
   * Renvoie { joueur, parVille: [{id, i, j, chemins}], minChemins,
   *   articulations: [{id, type: 'case'|'ville'|'jonction' (case de jonction), villesCoupees: [{i, j}]}] }.
   */
  function goulets(g, joueur) {
    var sources = g.apparitions[joueur] || [];
    var villes = g.jonctions.filter(function (j) { return j.type === 'ville'; });
    var parVille = villes.map(function (v) {
      return { id: v.id, i: v.i, j: v.j, chemins: sources.length ? cheminsDisjoints(g, sources, v.id) : 0 };
    });
    var atteintes = parcours(g, sources, null);
    var articulations = [];
    if (sources.length) {
      g.noeuds.forEach(function (id) {
        if (sources.indexOf(id) >= 0) return;
        var d = parcours(g, sources, new Set([id])), coupees = [];
        villes.forEach(function (v) {
          if (v.id !== id && atteintes.has(v.id) && !d.has(v.id)) coupees.push({ i: v.i, j: v.j });
        });
        if (coupees.length) {
          articulations.push({ id: id, type: g.cases.has(id) ? 'case' : (g.villes.has(id) ? 'ville' : 'jonction'), villesCoupees: coupees });
        }
      });
    }
    return {
      joueur: joueur, parVille: parVille, articulations: articulations,
      minChemins: parVille.length ? Math.min.apply(null, parVille.map(function (x) { return x.chemins; })) : null
    };
  }

  /* ------------------------------------------------------------------ */
  /* Flancs (D4 de 1b)                                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Autoroutes de flanc : pour chaque joueur, distance de ses apparitions à la ligne de jonctions adverse
   * (j = lignes - 1, soit 3 en 4×4, pour le vert ; j = 1 pour le rouge), dans le sous-graphe « flancs »
   * (première et dernière colonnes + tuiles à case d'apparition des rangées nord et sud) et dans le
   * sous-graphe « centre » (colonnes 1 à colonnes - 2). Toutes les jonctions portent une ville, traversable
   * avec l'option villesTraversables: true (mesure de tests/catalogue.test.js). Renvoie [{flanc, centre}] pour
   * le vert puis le rouge (Infinity si inatteignable).
   */
  function flancs(doc, options) {
    options = options || {};
    var F = M.formatDuDocument(doc), grille = F.GRILLE;
    var jetons = [];
    for (var j = 1; j < grille.lignes; j++) for (var i = 1; i < grille.colonnes; i++) jetons.push({ i: i, j: j, type: 'capture' });
    var flanc = function (t) {
      if (t.col === 0 || t.col === grille.colonnes - 1) return true;
      return (t.lig === 0 || t.lig === grille.lignes - 1) && M.aUneApparition(M.modeleParId(doc, t.modeleId));
    };
    var centre = function (t) { return t.col >= 1 && t.col <= grille.colonnes - 2; };
    return [1, 2].map(function (p) {
      var cible = p === 1 ? grille.lignes - 1 : 1;
      function mesure(filtre) {
        var g = construire(doc, { jetons: jetons, filtreTuile: filtre, villesTraversables: options.villesTraversables });
        var d = distancesJoueur(g, p), m = Infinity;
        g.jonctions.forEach(function (jn) { if (jn.j === cible && d.has(jn.id)) m = Math.min(m, d.get(jn.id)); });
        return m;
      }
      return { flanc: mesure(flanc), centre: mesure(centre) };
    });
  }

  PM.graphe = {
    NB_VILLES: NB_VILLES,
    PORTS_VILLE_MIN: PORTS_VILLE_MIN,
    PORTS_JONCTION_MIN: PORTS_JONCTION_MIN,
    REPARTITION_VILLES_5X5: REPARTITION_VILLES_5X5,
    RANGS_COMPARES: RANGS_COMPARES,
    SEUIL_ECART: SEUIL_ECART,
    SEUIL_CINQ_CONTRE_DEUX: SEUIL_CINQ_CONTRE_DEUX,
    SEUIL_S: SEUIL_S,
    SEUIL_S_INFORMATION: SEUIL_S_INFORMATION,
    SEUIL_BLOCAGE_ECART: SEUIL_BLOCAGE_ECART,
    CINQ_CONTRE_DEUX_BLOQUANT: CINQ_CONTRE_DEUX_BLOQUANT,
    NOM_JOUEUR: NOM_JOUEUR,
    construire: construire,
    connexe: connexe,
    villesProches: villesProches,
    distances: distances,
    distancesJoueur: distancesJoueur,
    equilibre: equilibre,
    goulets: goulets,
    profil: profil,
    flancs: flancs
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.graphe;
})();
