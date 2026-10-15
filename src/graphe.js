/*
 * graphe.js : graphe global du plateau et analyse d'équilibre (critère de docs/16-avis-mesures-equilibre.md,
 * qui prime sur D6 de docs/1b-avis-design-jeu-variante-jonctions.md).
 * Aucun accès au DOM : toutes les fonctions sont pures et ne modifient pas le document.
 *
 * Nœuds du graphe :
 *  - une case par case de tuile posée (id global « col,lig:idLocal », voir PM.modele.tuileEnPlateau) ;
 *  - un nœud « J<i>,<j> » par jeton posé sur une jonction (ville 'capture' ou 'carrefour').
 * Arêtes : chemins internes à une tuile, raccords connectés face à face entre deux tuiles,
 * jonction <-> cases porteuses d'un port de coin. Le graphe est symétrique (non orienté).
 *
 * Villes non traversables (option villesTraversables: false) : une ville n'est qu'une destination.
 * Le graphe reste symétrique ; les parcours n'étendent jamais une ville (sauf si elle est la source).
 * Un carrefour est une case de déplacement : il reste traversable.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var G = PM.geometrie;
  var M = PM.modele;

  /** Nombre de villes et seuils de l'avis docs/16 (constantes uniques, lues aussi par generateur.js). */
  var NB_VILLES = 7;
  var RANGS_COMPARES = 4;       // ancien D6 : écart aux rangs 1 à 4 (champ ecartRang, information seulement)
  var SEUIL_ECART = 2;          // alerte si l'écart dépasse 2 à un rang de 1 à 7 (docs/16 b)
  var SEUIL_CINQ_CONTRE_DEUX = 5;
  var SEUIL_APPARITION_LOINTAINE = 7;
  var SEUIL_S = 4;                 // score S à partir duquel le plateau est « à surveiller »

  /* ------------------------------------------------------------------ */
  /* Construction                                                        */
  /* ------------------------------------------------------------------ */

  function idJonction(i, j) { return 'J' + i + ',' + j; }

  /**
   * Construit le graphe d'un document.
   * options :
   *  - villesTraversables (défaut false : une ville n'est qu'une destination, cas le plus pessimiste, avis docs/16) ;
   *  - jetons : tableau [{i, j, type}] qui remplace doc.plateau.jetons (mesures : essayer des
   *    placements sans cloner le document) ;
   *  - filtreTuile(tuile) → booléen : ne garde que certaines tuiles (sous-graphes).
   * Renvoie { noeuds: [id], voisins: Map<id, Set<id>>, cases: Map<id, case>,
   *   jonctions: [{ id, i, j, type, ports, cases: [idCase] }], villes: Set<id>,
   *   apparitions: {1: [idCase], 2: [idCase]}, villesTraversables }.
   * Ne lève pas d'exception sur un plateau incomplet : tuile sans modèle ignorée, jeton sans tuile isolé.
   */
  function construire(doc, options) {
    options = options || {};
    var plateau = (doc && doc.plateau) || {};
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
        if (c.type === 'apparition' && (c.joueur === 1 || c.joueur === 2)) g.apparitions[c.joueur].push(c.id);
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
        if (autre) lier(r.caseId, autre);
      });
      x.e.ports.forEach(function (p) {
        var id = idJonction(p.i, p.j);
        if (!portsParJonction.has(id)) portsParJonction.set(id, []);
        portsParJonction.get(id).push(p.caseId);
      });
    });

    // Jetons : un nœud par jonction portant un jeton, relié aux cases porteuses des ports
    var vus = new Set();
    jetons.forEach(function (jeton) {
      if (!jeton || (jeton.type !== 'capture' && jeton.type !== 'carrefour')) return;
      var id = idJonction(jeton.i, jeton.j);
      if (vus.has(id)) return;
      vus.add(id);
      noeud(id);
      var portees = portsParJonction.get(id) || [];
      portees.forEach(function (c) { lier(id, c); });
      g.jonctions.push({ id: id, i: jeton.i, j: jeton.j, type: jeton.type, ports: portees.length, cases: portees.slice() });
      if (jeton.type === 'capture') g.villes.add(id);
    });
    return g;
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

  /** Distances depuis les apparitions du joueur (minimum sur ses apparitions). */
  function distancesJoueur(g, joueur) { return parcours(g, g.apparitions[joueur] || [], null); }

  /* ------------------------------------------------------------------ */
  /* Équilibre (critère de docs/16)                                       */
  /* ------------------------------------------------------------------ */

  function tri(t) { return t.slice().sort(function (a, b) { return a - b; }); }
  var estFini = function (x) { return x !== undefined && isFinite(x); };

  /**
   * Analyse d'équilibre d'un document (critère de docs/16).
   * options : villesTraversables, jetons (voir construire), nbVilles (défaut 7), graphe (graphe déjà construit).
   * Renvoie :
   *  - villes : [{id, i, j}] ; D : {1: [distances triées], 2: [...]} (villes inaccessibles exclues) ;
   *  - parRang : [{rang, d1, d2, ecart, compte}] (compte = rang pris en compte dans S et l'écart, rangs 1 à 7) ;
   *  - ecartRang : plus grand |D1(k) - D2(k)| aux rangs 1 à 4 (ancien D6, information sans alerte), ou null ;
   *  - S, ecartMax7 : somme et maximum des écarts aux rangs 1 à 7 (docs/16), null si un joueur a moins de
   *    nbVilles distances (ville inaccessible ou manquante) ;
   *  - cinqContreDeux : un joueur strictement plus proche de 5 villes ou plus (7 villes posées) ;
   *  - premiereEgale : première ville à la même distance pour les deux joueurs (invariant d) ;
   *  - partage : {1, 2, egalite} (villes strictement plus proches de J1, de J2, à égalité) ;
   *  - tempo : {1: {3, 4, 5}, 2: {3, 4, 5}} (villes atteignables en au plus 3, 4, 5 pas) ;
   *  - premiereVille : {1, 2, ecart} (distance de la ville la plus proche, null si aucune) ;
   *  - inaccessibles : {1: [{i, j}], 2: [{i, j}]} ;
   *  - alertes : [{code, message}] ; lacunes : [texte] ; complet : booléen (7 villes, 2 apparitions par joueur,
   *    toutes les tuiles posées avec un modèle présent dans la bibliothèque) ; partiel : !complet.
   * Ne lève pas d'exception sur un plateau incomplet.
   */
  function equilibre(doc, options) {
    options = options || {};
    var nbVilles = options.nbVilles || NB_VILLES;
    var g = options.graphe || construire(doc, options);
    var villes = g.jonctions.filter(function (j) { return j.type === 'capture'; });
    var lacunes = [];

    // Ce qui manque
    var plateau = (doc && doc.plateau) || {};
    var attendues = M.cellulesActives(plateau.forme || { retires: [] }, M.formatDuDocument(doc)).length;
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
      var n = g.apparitions[p].length;
      if (n !== 2) lacunes.push('Le joueur ' + p + ' a ' + n + ' case(s) d\'apparition (2 attendues).');
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

    // Avis docs/16 : écart étendu aux rangs 1 à 7 et score S = somme des écarts, seulement si chaque joueur
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

    // Alertes
    var alertes = [];
    if (ecartMax7 !== null && ecartMax7 > SEUIL_ECART) {
      alertes.push({ code: 'ecart_rang_etendu', message: 'Un rang de villes (de 1 à 7) est à ' + ecartMax7 + ' pas d\'écart entre les deux joueurs (plus de ' + SEUIL_ECART + ').' });
    }
    if (premiereVille.ecart !== null && premiereVille.ecart !== 0) {
      alertes.push({ code: 'premiere_ville_inegale', message: 'La première ville est à ' + premiereVille[1] + ' pas du joueur 1 et à ' + premiereVille[2] + ' pas du joueur 2 (elle devrait être à la même distance).' });
    }
    if (cinqContreDeux) {
      var fort = partage[1] >= partage[2] ? 1 : 2;
      alertes.push({ code: 'cinq_contre_deux', message: 'Le joueur ' + fort + ' est plus proche de ' + partage[fort] + ' villes contre ' + partage[3 - fort] + ' pour l\'autre.' });
    }
    [1, 2].forEach(function (p) {
      g.apparitions[p].forEach(function (id) {
        var dd = distances(g, id), mini = Infinity;
        villes.forEach(function (v) { if (dd.has(v.id)) mini = Math.min(mini, dd.get(v.id)); });
        if (villes.length && mini > SEUIL_APPARITION_LOINTAINE) {
          alertes.push({ code: 'apparition_lointaine', message: isFinite(mini)
            ? 'Une apparition du joueur ' + p + ' est à ' + mini + ' pas de la ville la plus proche (plus de ' + SEUIL_APPARITION_LOINTAINE + ').'
            : 'Une apparition du joueur ' + p + ' n\'atteint aucune ville.' });
        }
      });
    });
    [1, 2].forEach(function (p) {
      if (inaccessibles[p].length) {
        alertes.push({ code: 'ville_inaccessible', message: inaccessibles[p].length + ' ville(s) hors d\'atteinte du joueur ' + p + '.' });
      }
    });

    return {
      villes: villes.map(function (v) { return { id: v.id, i: v.i, j: v.j }; }),
      D: D, parRang: parRang, ecartRang: ecartRang, S: S, ecartMax7: ecartMax7, aSurveiller: S !== null && S >= SEUIL_S, villesA4: villesA4, partage: partage, alertes: alertes, tempo: tempo,
      cinqContreDeux: cinqContreDeux, premiereEgale: premiereEgale,
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
   * Renvoie { joueur, parVille: [{id, i, j, chemins}], minChemins, articulations: [{id, type, villesCoupees: [{i, j}]}] }.
   */
  function goulets(g, joueur) {
    var sources = g.apparitions[joueur] || [];
    var villes = g.jonctions.filter(function (j) { return j.type === 'capture'; });
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
          articulations.push({ id: id, type: g.cases.has(id) ? 'case' : (g.villes.has(id) ? 'ville' : 'carrefour'), villesCoupees: coupees });
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
   * (j = lignes - 1, soit 3 en 4×4, pour J1 ; j = 1 pour J2), dans le sous-graphe « flancs » (première et
   * dernière colonnes + apparitions) et dans le sous-graphe « centre » (colonnes 1 et colonnes - 2). Toutes les jonctions portent un jeton 'capture', traversable
   * avec l'option villesTraversables: true (mesure de tests/catalogue.test.js). Renvoie [{flanc, centre}] pour J1 puis J2 (Infinity si inatteignable).
   */
  function flancs(doc, options) {
    options = options || {};
    var forme = doc.plateau.forme, F = M.formatDuDocument(doc), grille = F.GRILLE;
    var jetons = [];
    for (var j = 1; j < grille.lignes; j++) for (var i = 1; i < grille.colonnes; i++) jetons.push({ i: i, j: j, type: 'capture' });
    var flanc = function (t) { return t.col === 0 || t.col === grille.colonnes - 1 || M.roleCellule(t.col, t.lig, forme, F) === 'apparition'; };
    var centre = function (t) { return t.col === 1 || t.col === grille.colonnes - 2; };
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
    RANGS_COMPARES: RANGS_COMPARES,
    SEUIL_ECART: SEUIL_ECART,
    SEUIL_CINQ_CONTRE_DEUX: SEUIL_CINQ_CONTRE_DEUX,
    SEUIL_S: SEUIL_S,
    construire: construire,
    distances: distances,
    distancesJoueur: distancesJoueur,
    equilibre: equilibre,
    goulets: goulets,
    profil: profil,
    flancs: flancs
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.graphe;
})();
