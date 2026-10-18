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

  /** Seuil d'alerte de S du format (« 4x4 » ou « 5x5 ») ; le rejet du générateur (5×5 seulement) reste SEUIL_S. */
  function seuilS(formatId) { return SEUIL_S_PAR_FORMAT[formatId] || SEUIL_S; }
  /** Seuil à partir duquel S est une simple information (jusqu'au seuil d'alerte exclu). */
  function seuilSInformation(formatId) { return SEUIL_S_INFORMATION_PAR_FORMAT[formatId] || SEUIL_S_INFORMATION_PAR_FORMAT['4x4']; }

  /** Nombre de villes et seuils (constantes uniques, lues aussi par controles.js et generateur.js). */
  var NB_VILLES = 7;
  var RANGS_COMPARES = 4;       // ancien D6 : écart aux rangs 1 à 4 (champ ecartRang, information seulement)
  var SEUIL_ECART = 2;          // alerte si l'écart dépasse 2 à un rang de 1 à 7 (docs/archives/16 b)
  var SEUIL_CINQ_CONTRE_DEUX = 5;
  var SEUIL_APPARITION_LOINTAINE = 7;
  var SEUIL_S = 5;                 // seuil de REJET du générateur, appliqué en 5×5 seulement (REJET_S de generateur.js) ; en 4×4, S n'est qu'un classement (docs/18, 2026-10-18 ; un plateau 4×4 généré reste à S <= 1)
  /** Seuils d'alerte et d'information de S, propres à chaque format (docs/18, réponse de 2026-10-18 ; docs/48 § 4) : 4×4 alerte dès 5, information à 4 ;
   *  5×5 alerte dès 7, information à 5 ou 6 (le 95e centile de la pose libre y est à 7). */
  var SEUIL_S_PAR_FORMAT = Object.freeze({ '4x4': 5, '5x5': 7 });
  var SEUIL_S_INFORMATION_PAR_FORMAT = Object.freeze({ '4x4': 4, '5x5': 5 });
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
   * Passages sans case (docs/18, docs/39) : les cases qu'un réseau de passages relie, quelle que soit sa longueur ou sa
   * ramification, sont voisines à 1 pas (un seul déplacement, aucun nœud intermédiaire).
   * Union-find sur les emplacements de raccord des passages (« R col,lig,cote,pos ») et sur les pivots : deux raccords
   * face à face sont réunis. Les cases ne sont jamais fusionnées, elles sont seulement attachées à une composante
   * (sinon une case à deux sorties rapprocherait ses deux voisins) : celles d'un passage, et celles dont un chemin
   * aboutit à un raccord qui fait face à un passage. Les cases attachées à une même composante forment une clique.
   * Sans passage, ne fait rien : le graphe est strictement celui d'avant.
   */
  function relierPassages(elems, voisins, lier) {
    var parent = new Map(), attaches = [];
    function racine(x) {
      if (!parent.has(x)) parent.set(x, x);
      while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
      return x;
    }
    function emplacement(t, cote, pos) { return 'R ' + t.col + ',' + t.lig + ',' + cote + ',' + pos; }
    function enFace(t, cote, pos) {
      var d = G.coteVoisin(cote), f = G.raccordEnFace(cote, pos);
      return emplacement({ col: t.col + d.dc, lig: t.lig + d.dl }, f.cote, f.pos);
    }
    var emplacements = [];
    elems.forEach(function (x) {
      (x.e.passages || []).forEach(function (p) {
        function ref(e) {
          if (e.pivot !== undefined) return { cle: 'P ' + e.pivot };
          if (e.raccord) { var k = emplacement(x.t, e.raccord.cote, e.raccord.pos); emplacements.push({ cle: k, tuile: x.t, cote: e.raccord.cote, pos: e.raccord.pos }); return { cle: k }; }
          return { caseId: e['case'] };
        }
        var a = ref(p.a), b = ref(p.b);
        if (a.cle && b.cle) parent.set(racine(a.cle), racine(b.cle));
        else if (a.cle) attaches.push({ caseId: b.caseId, cle: a.cle });
        else if (b.cle) attaches.push({ caseId: a.caseId, cle: b.cle });
        else if (voisins.has(a.caseId) && voisins.has(b.caseId)) lier(a.caseId, b.caseId);
      });
    });
    if (!emplacements.length && !attaches.length) return;
    emplacements.forEach(function (s) { racine(s.cle); }); // tous les emplacements existent avant l'appariement
    emplacements.forEach(function (s) {
      var face = enFace(s.tuile, s.cote, s.pos);
      if (parent.has(face)) parent.set(racine(s.cle), racine(face));
    });
    // Un chemin qui aboutit à un raccord faisant face à un passage : sa case est attachée à ce réseau
    elems.forEach(function (x) {
      (x.e.raccords || []).forEach(function (r) {
        var face = enFace(x.t, r.cote, r.pos);
        if (parent.has(face)) attaches.push({ caseId: r.caseId, cle: face });
      });
    });
    var groupes = new Map();
    attaches.forEach(function (a) {
      if (!voisins.has(a.caseId)) return;
      var r = racine(a.cle);
      if (!groupes.has(r)) groupes.set(r, new Set());
      groupes.get(r).add(a.caseId);
    });
    groupes.forEach(function (ensemble) {
      var cs = Array.from(ensemble);
      for (var i = 0; i < cs.length; i++) for (var j = i + 1; j < cs.length; j++) lier(cs[i], cs[j]);
    });
  }

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

    relierPassages(elems, voisins, lier);

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
   *  - aSurveiller : S >= seuilS(format) (4×4 : 5 ; 5×5 : 7) ; sInformation : S de seuilSInformation(format) à l'alerte exclue (4×4 : 4 ; 5×5 : 5 ou 6), sans alerte ;
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
    var cinqContreDeux = villes.length === nbVilles && avecAppar && Math.max(partage[1], partage[2]) >= SEUIL_CINQ_CONTRE_DEUX;

    var villesA4 = { 1: D[1].filter(function (x) { return x <= 4; }).length, 2: D[2].filter(function (x) { return x <= 4; }).length, ecart: null };
    villesA4.ecart = Math.abs(villesA4[1] - villesA4[2]);

    // Plateau très déséquilibré (blocages) puis alertes
    var blocages = [], alertes = [], informations = [];
    var est5x5 = M.formatDuDocument(doc).id === '5x5';
    var conseil5x5 = est5x5 && conseil5x5Applicable(villes) ? CONSEIL_5X5 : '';
    var sAlerte = seuilS(M.formatDuDocument(doc).id), sInfo = seuilSInformation(M.formatDuDocument(doc).id);
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
        // conseil de pose à la main propre au 4×4 (docs/22 ; le générateur, lui, varie ses jonctions-cases) ; conseil conditionnel propre au 5×5 (docs/36)
        (M.formatDuDocument(doc).id === '4x4' ? ' Conseil : placer les deux jonctions-cases (sans ville) dans la rangée centrale, par exemple (1, 2) et (3, 2).' : conseil5x5) };
      (CINQ_CONTRE_DEUX_BLOQUANT ? blocages : alertes).push(cinq);
    }
    if (ecartMax7 !== null && ecartMax7 > SEUIL_BLOCAGE_ECART) {
      blocages.push({ code: 'ecart_bloquant', message: 'Un rang de villes (de 1 à 7) est à ' + ecartMax7 + ' pas d\'écart entre les deux joueurs (plus de ' + SEUIL_BLOCAGE_ECART + ').' });
    } else if (ecartMax7 !== null && ecartMax7 > SEUIL_ECART) {
      alertes.push({ code: 'ecart_rang_etendu', message: 'Un rang de villes (de 1 à 7) est à ' + ecartMax7 + ' pas d\'écart entre les deux joueurs (plus de ' + SEUIL_ECART + ').' });
    }
    if (S !== null && S >= sAlerte) {
      alertes.push({ code: 'score_s', message: 'Score S = ' + S + ' (somme des écarts sur les 7 rangs) : plateau à surveiller (à partir de ' + sAlerte + ').' + (cinqContreDeux ? '' : conseil5x5) });
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
      D: D, parRang: parRang, ecartRang: ecartRang, S: S, ecartMax7: ecartMax7, aSurveiller: S !== null && S >= sAlerte, sInformation: S !== null && S >= sInfo && S < sAlerte, villesA4: villesA4, partage: partage, alertes: alertes, informations: informations, tempo: tempo,
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

  /* ------------------------------------------------------------------ */
  /* Rythme, accès au centre, cases par moitié (docs/18, docs/44, docs/45) */
  /* ------------------------------------------------------------------ */

  /** Chaîne visée : plus longue suite de cases sans zone d'intérêt (docs/18 : « environ 3 cases entre deux zones d'intérêt »). */
  var CHAINE_CIBLE = 3;

  /**
   * Réseaux de passages du plateau (même règle que relierPassages) : pour chaque réseau, les cases qu'il relie ; et ceux qui
   * ÉCONOMISENT un pas (un passage sans case à ses deux bouts : raccord–raccord, raccord–pivot ou case–pivot ; un simple crochet
   * raccord -> case vaut un chemin ordinaire). Repris de outils/planche-organique.js (docs/45).
   * Renvoie { tailles: [nombre de cases, décroissant], apparitions: cases d'apparition rattachées, groupes: [Set], economes: [Set] }.
   */
  function reseauxPassages(doc) {
    var parent = new Map();
    function racine(x) {
      if (!parent.has(x)) parent.set(x, x);
      while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
      return x;
    }
    function emp(t, c, p) { return 'R ' + t.col + ',' + t.lig + ',' + c + ',' + p; }
    function enFace(t, c, p) { var d = G.coteVoisin(c), f = G.raccordEnFace(c, p); return emp({ col: t.col + d.dc, lig: t.lig + d.dl }, f.cote, f.pos); }
    var plateau = (doc && doc.plateau) || {}, elems = [];
    (Array.isArray(plateau.tuiles) ? plateau.tuiles : []).forEach(function (t) { if (!t) return; var e = M.tuileEnPlateau(doc, t); if (e) elems.push({ t: t, e: e }); });
    var attaches = [], emplacements = [], types = new Map(), econ = [];
    elems.forEach(function (x) { x.e.cases.forEach(function (c) { types.set(c.id, c.type); }); });
    elems.forEach(function (x) {
      (x.e.passages || []).forEach(function (p) {
        function ref(e) {
          if (e.pivot !== undefined) return { cle: 'P ' + e.pivot, pivot: true };
          if (e.raccord) { var k = emp(x.t, e.raccord.cote, e.raccord.pos); emplacements.push({ k: k, t: x.t, c: e.raccord.cote, p: e.raccord.pos }); return { cle: k }; }
          return { caseId: e['case'] };
        }
        var a = ref(p.a), b = ref(p.b);
        if (a.cle && b.cle) { parent.set(racine(a.cle), racine(b.cle)); econ.push(a.cle); }
        else if (a.cle) { attaches.push({ caseId: b.caseId, cle: a.cle }); if (a.pivot) econ.push(a.cle); }
        else if (b.cle) { attaches.push({ caseId: a.caseId, cle: b.cle }); if (b.pivot) econ.push(b.cle); }
      });
    });
    emplacements.forEach(function (s) { racine(s.k); });
    emplacements.forEach(function (s) { var f = enFace(s.t, s.c, s.p); if (parent.has(f)) parent.set(racine(s.k), racine(f)); });
    elems.forEach(function (x) { x.e.raccords.forEach(function (r) { var f = enFace(x.t, r.cote, r.pos); if (parent.has(f)) attaches.push({ caseId: r.caseId, cle: f }); }); });
    var groupes = new Map(), econome = new Set(econ.map(racine));
    attaches.forEach(function (a) { var r = racine(a.cle); if (!groupes.has(r)) groupes.set(r, new Set()); groupes.get(r).add(a.caseId); });
    var apparitions = 0, economes = [];
    groupes.forEach(function (s, r) {
      s.forEach(function (id) { if (types.get(id) === 'apparition') apparitions++; });
      if (econome.has(r)) economes.push(s);
    });
    return {
      tailles: Array.from(groupes.values()).map(function (s) { return s.size; }).sort(function (a, b) { return b - a; }),
      apparitions: apparitions, groupes: Array.from(groupes.values()), economes: economes
    };
  }

  /** Tuile d'une case du graphe (« col,lig:id ») ; null pour une jonction. */
  function tuileDuNoeud(id) { var m = /^(\d+),(\d+):/.exec(id); return m ? { col: +m[1], lig: +m[2] } : null; }

  /**
   * Cases reliées par un RACCOURCI : arête du graphe entre deux cases d'apparition de tuiles différentes (raccourci de coin et de
   * bord, docs/20 D5). Le raccourci compte comme une zone d'intérêt pour le rythme (docs/18, réponse 3 sur la révision « centrales ouvertes »).
   */
  function casesRaccourci(g) {
    var res = new Set();
    g.cases.forEach(function (c, id) {
      if (c.type !== 'apparition') return;
      var t = tuileDuNoeud(id);
      g.voisins.get(id).forEach(function (w) {
        var cw = g.cases.get(w), tw = tuileDuNoeud(w);
        if (cw && cw.type === 'apparition' && tw && (tw.col !== t.col || tw.lig !== t.lig)) { res.add(id); res.add(w); }
      });
    });
    return res;
  }

  /**
   * Rythme du plateau (docs/18 ; mesure STRICTE de docs/44, raccourci compté comme zone d'intérêt, docs/18 réponse 3).
   * Zones d'intérêt : les villes, les cases d'un réseau de passages qui relie au moins 2 cases ET économise un pas (reseauxPassages),
   * et les cases reliées par un raccourci (casesRaccourci).
   *  - distMax : plus grande distance d'une case sans zone à la zone la plus proche ;
   *  - chaine : plus court chemin entre deux zones A et B qui ne passe par aucune autre zone et qu'aucun autre itinéraire ne
   *    raccourcit ; sa longueur est le nombre de cases sans zone traversées ; chaineMax = la plus longue du plateau (cible CHAINE_CIBLE).
   * options : { large: true } tout réseau de passages de 2 cases ou plus (ancienne mesure, information) ;
   *           { sansRaccourci: true } le raccourci ne compte pas (mesure stricte de docs/45, pour comparaison) ;
   *           { reseaux } résultat de reseauxPassages déjà calculé.
   * Renvoie { zones, distMax, repartition, injoignables, chaineMax, chaine: [ids], casesPassage: [ids], casesRaccourci: [ids], plusLoin: [ids] }.
   */
  function rythme(doc, g, options) {
    options = options || {};
    var zones = new Set(g.villes), rs = options.reseaux || reseauxPassages(doc), raccourcis = options.sansRaccourci ? new Set() : casesRaccourci(g);
    var passages = new Set();
    (options.large ? rs.groupes : rs.economes).forEach(function (grp) {
      if (grp.size >= 2) grp.forEach(function (id) { if (g.voisins.has(id)) { zones.add(id); passages.add(id); } });
    });
    raccourcis.forEach(function (id) { zones.add(id); });
    var d = new Map(), file = [];
    zones.forEach(function (z) { d.set(z, 0); file.push(z); });
    for (var q = 0; q < file.length; q++) {
      var x = file[q];
      if (q >= zones.size && g.villes.has(x)) continue;
      g.voisins.get(x).forEach(function (y) { if (!d.has(y)) { d.set(y, d.get(x) + 1); file.push(y); } });
    }
    var repartition = {}, distMax = 0, injoignables = 0;
    g.noeuds.forEach(function (id) {
      if (zones.has(id)) return;
      if (!d.has(id)) { injoignables++; return; }
      var v = d.get(id);
      repartition[v] = (repartition[v] || 0) + 1;
      distMax = Math.max(distMax, v);
    });
    var chaine = { longueur: 0, chemin: [] };
    zones.forEach(function (s) {
      var dr = new Map([[s, 0]]), pere = new Map(), f = [s];
      for (var k = 0; k < f.length; k++) {
        var y = f[k];
        if (y !== s && zones.has(y)) continue;
        g.voisins.get(y).forEach(function (w) { if (!dr.has(w)) { dr.set(w, dr.get(y) + 1); pere.set(w, y); f.push(w); } });
      }
      var dg = distances(g, s);
      zones.forEach(function (t) {
        if (t === s || !dr.has(t) || dg.get(t) !== dr.get(t)) return;
        var n = dr.get(t) - 1;
        if (n > chaine.longueur) {
          var chemin = [t];
          while (chemin[0] !== s) chemin.unshift(pere.get(chemin[0]));
          chaine = { longueur: n, chemin: chemin };
        }
      });
    });
    return {
      zones: zones.size, distMax: distMax, repartition: repartition, injoignables: injoignables,
      chaineMax: chaine.longueur, chaine: chaine.chemin,
      casesPassage: Array.from(passages), casesRaccourci: Array.from(raccourcis),
      plusLoin: g.noeuds.filter(function (id) { return !zones.has(id) && d.get(id) === distMax; })
    };
  }

  /**
   * Zone d'un nœud pour l'équilibre des accès et les cases par moitié (docs/45) : 'vert', 'rouge' ou 'milieu'.
   *  - case d'une tuile : camp de sa cellule ; rangée neutre du 5×5 = 'milieu' ;
   *  - jonction (i, j) : 4×4 j = 1 vert, j = 2 milieu, j = 3 rouge ; 5×5 j = 1 vert, j = 2 et 3 milieu (elles bordent la rangée
   *    neutre), j = 4 rouge.
   */
  function zoneDuNoeud(id, F) {
    var N = F.GRILLE.lignes, demi = Math.floor(N / 2);
    var m = /^J(\d+),(\d+)$/.exec(id);
    if (m) { var j = +m[2]; return j < demi ? 'vert' : (j > N - demi ? 'rouge' : 'milieu'); }
    var t = tuileDuNoeud(id);
    return (t && F.campCellule(t.col, t.lig)) || 'milieu';
  }

  /** Flot maximal (sommets de capacité 1, sources illimitées) des `sources` vers l'ensemble `cible`, dans les nœuds `dans` ∪ cible. */
  function flotVersEnsemble(g, sources, dans, cible) {
    var ids = g.noeuds.filter(function (id) { return dans(id) || cible(id); }), index = new Map();
    ids.forEach(function (id, n) { index.set(id, n); });
    var N = ids.length, S = 2 * N, T = 2 * N + 1, tete = new Array(2 * N + 2).fill(-1), suiv = [], vers = [], cap = [];
    function aj(a, b, c) { vers.push(b); cap.push(c); suiv.push(tete[a]); tete[a] = vers.length - 1; vers.push(a); cap.push(0); suiv.push(tete[b]); tete[b] = vers.length - 1; }
    var INF = 1e6, src = new Set(sources);
    ids.forEach(function (id, n) {
      aj(2 * n, 2 * n + 1, src.has(id) ? INF : 1);
      if (cible(id)) { aj(2 * n + 1, T, 1); return; } // une entrée du milieu compte une fois ; on ne la traverse pas
      g.voisins.get(id).forEach(function (w) { if (index.has(w)) aj(2 * n + 1, 2 * index.get(w), 1); });
    });
    sources.forEach(function (s) { if (index.has(s)) aj(S, 2 * index.get(s), INF); });
    var flot = 0;
    for (;;) {
      var pere = new Array(2 * N + 2).fill(-1), vu = new Array(2 * N + 2).fill(false), file = [S];
      vu[S] = true;
      for (var q = 0; q < file.length && !vu[T]; q++) {
        for (var e = tete[file[q]]; e !== -1; e = suiv[e]) if (cap[e] > 0 && !vu[vers[e]]) { vu[vers[e]] = true; pere[vers[e]] = e; file.push(vers[e]); }
      }
      if (!vu[T]) break;
      for (var v = T; v !== S; v = vers[pere[v] ^ 1]) { cap[pere[v]]--; cap[pere[v] ^ 1]++; }
      flot++;
    }
    return flot;
  }

  /**
   * Équilibre des accès au centre entre les deux camps (définition de docs/45).
   *  - Milieu : 4×4 la rangée de jonctions j = 2 ; 5×5 la rangée neutre et les jonctions j = 2 et 3 (zoneDuNoeud).
   *  - Portes d'un camp : arêtes du graphe entre un nœud du camp et un nœud du milieu (port, raccord ou réseau de passages).
   *  - ecart = portes vertes − portes rouges (0 = équilibre) ; contacts : arêtes directes vert–rouge (servent les deux camps).
   *  - chemins (sauf options.sansFlot) : nombre maximal de chemins sans case commune des apparitions du camp vers le milieu, dans
   *    le camp (villes traversables) ; ecartChemins = vert − rouge.
   * Renvoie { portes: {vert, rouge}, ecart, contacts, chemins?: {vert, rouge}, ecartChemins? }.
   */
  function accesCentre(doc, g, options) {
    var F = M.formatDuDocument(doc), z = new Map();
    g.noeuds.forEach(function (id) { z.set(id, zoneDuNoeud(id, F)); });
    var portes = { vert: 0, rouge: 0 }, contacts = 0;
    g.noeuds.forEach(function (a) {
      g.voisins.get(a).forEach(function (b) {
        if (a >= b) return;
        var za = z.get(a), zb = z.get(b);
        if (za === zb) return;
        if (za === 'milieu' || zb === 'milieu') portes[za === 'milieu' ? zb : za]++;
        else contacts++;
      });
    });
    var res = { portes: portes, ecart: portes.vert - portes.rouge, contacts: contacts };
    if (options && options.sansFlot) return res;
    var milieu = function (id) { return z.get(id) === 'milieu'; };
    res.chemins = {
      vert: flotVersEnsemble(g, g.apparitions[1] || [], function (id) { return z.get(id) === 'vert'; }, milieu),
      rouge: flotVersEnsemble(g, g.apparitions[2] || [], function (id) { return z.get(id) === 'rouge'; }, milieu)
    };
    res.ecartChemins = res.chemins.vert - res.chemins.rouge;
    return res;
  }

  /**
   * Cases par moitié (docs/18, réponse 2 sur la révision « centrales ouvertes ») : cases des tuiles par camp de leur cellule
   * (rangée neutre du 5×5 à part) et jonctions-cases (jonctions sans ville) par zone (zoneDuNoeud).
   * Renvoie { tuiles: {vert, rouge, neutre}, jonctions: {vert, rouge, milieu}, vert, rouge, ecart } avec vert / rouge = cases de la
   * moitié (tuiles + jonctions-cases) et ecart = vert − rouge (0 = autant de cases de part et d'autre).
   */
  function casesParMoitie(doc, g) {
    var F = M.formatDuDocument(doc), tuiles = { vert: 0, rouge: 0, neutre: 0 }, jonctions = { vert: 0, rouge: 0, milieu: 0 };
    g.cases.forEach(function (c, id) { var t = tuileDuNoeud(id), camp = t && F.campCellule(t.col, t.lig); tuiles[camp || 'neutre']++; });
    // comme compteursDuPlateau (controles.js) : une jonction-case ne compte que si ses 4 tuiles sont posées (docs/49)
    var posees = doc && doc.plateau && Array.isArray(doc.plateau.tuiles) ? doc.plateau.tuiles : [];
    function tuilePosee(col, lig) { return posees.some(function (t) { return t && t.col === col && t.lig === lig; }); }
    g.jonctions.forEach(function (jn) {
      if (jn.type !== 'ville' && tuilePosee(jn.i - 1, jn.j - 1) && tuilePosee(jn.i, jn.j - 1) && tuilePosee(jn.i - 1, jn.j) && tuilePosee(jn.i, jn.j)) jonctions[zoneDuNoeud(jn.id, F)]++;
    });
    var vert = tuiles.vert + jonctions.vert, rouge = tuiles.rouge + jonctions.rouge;
    return { tuiles: tuiles, jonctions: jonctions, vert: vert, rouge: rouge, ecart: vert - rouge };
  }

  /** Part des cases à 2 connexions ou moins au-delà de laquelle un plateau 5×5 n'est pas conforme (docs/18, docs/53 § 1 : moins de 5 %). */
  var PART_CONNEXIONS_MAX = 0.05;
  var CONNEXIONS_FAIBLES = 2; // une case « peu connectée » a 2 connexions ou moins

  /**
   * Connexions par case (docs/53 § 1) : nombre de cases DIFFÉRENTES que l'on atteint en un déplacement, c'est-à-dire le degré du
   * nœud dans le graphe `g` (chemins internes, raccords appariés, ports, passages ; une même voisine compte une fois ; un raccord mort
   * ne compte pas ; une voisine ville compte). Cases comptées : les cases des tuiles (apparitions comprises) et les jonctions-cases
   * (jonctions sans ville dont les 4 tuiles sont posées, comme compteursDuPlateau) ; les villes sont à part (règle des « 3 accès »).
   * Renvoie { cases, parDegre: {degré: nombre}, faibles (cases à 2 connexions ou moins), part (faibles / cases, 0 si aucune case),
   * degreMoyen (null si aucune case), conforme (part < 5 %), liste: [id des cases faibles], jonctionsFaibles: [{i, j}] }.
   */
  function connexions(doc, g) {
    g = g || construire(doc, { villesTraversables: false });
    var posees = doc && doc.plateau && Array.isArray(doc.plateau.tuiles) ? doc.plateau.tuiles : [], pose = {};
    posees.forEach(function (t) { if (t) pose[t.col + ',' + t.lig] = true; });
    var ids = [], jonc = {};
    g.cases.forEach(function (c, id) { ids.push(id); });
    g.jonctions.forEach(function (jn) {
      if (jn.type !== 'ville' && pose[(jn.i - 1) + ',' + (jn.j - 1)] && pose[jn.i + ',' + (jn.j - 1)] && pose[(jn.i - 1) + ',' + jn.j] && pose[jn.i + ',' + jn.j]) {
        ids.push(jn.id); jonc[jn.id] = jn;
      }
    });
    var parDegre = {}, somme = 0, liste = [], jonctionsFaibles = [];
    ids.forEach(function (id) {
      var d = g.voisins.get(id).size;
      parDegre[d] = (parDegre[d] || 0) + 1;
      somme += d;
      if (d <= CONNEXIONS_FAIBLES) { liste.push(id); if (jonc[id]) jonctionsFaibles.push({ i: jonc[id].i, j: jonc[id].j }); }
    });
    var part = ids.length ? liste.length / ids.length : 0;
    return {
      cases: ids.length, parDegre: parDegre, faibles: liste.length, part: part, degreMoyen: ids.length ? somme / ids.length : null,
      conforme: part < PART_CONNEXIONS_MAX, liste: liste, jonctionsFaibles: jonctionsFaibles
    };
  }

  PM.graphe = {
    PART_CONNEXIONS_MAX: PART_CONNEXIONS_MAX,
    CONNEXIONS_FAIBLES: CONNEXIONS_FAIBLES,
    connexions: connexions,
    NB_VILLES: NB_VILLES,
    CHAINE_CIBLE: CHAINE_CIBLE,
    PORTS_VILLE_MIN: PORTS_VILLE_MIN,
    PORTS_JONCTION_MIN: PORTS_JONCTION_MIN,
    REPARTITION_VILLES_5X5: REPARTITION_VILLES_5X5,
    RANGS_COMPARES: RANGS_COMPARES,
    SEUIL_ECART: SEUIL_ECART,
    SEUIL_CINQ_CONTRE_DEUX: SEUIL_CINQ_CONTRE_DEUX,
    SEUIL_S: SEUIL_S,
    SEUIL_S_PAR_FORMAT: SEUIL_S_PAR_FORMAT,
    SEUIL_S_INFORMATION_PAR_FORMAT: SEUIL_S_INFORMATION_PAR_FORMAT,
    seuilS: seuilS,
    seuilSInformation: seuilSInformation,
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
    flancs: flancs,
    reseauxPassages: reseauxPassages,
    casesRaccourci: casesRaccourci,
    rythme: rythme,
    zoneDuNoeud: zoneDuNoeud,
    accesCentre: accesCentre,
    casesParMoitie: casesParMoitie
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.graphe;
})();
