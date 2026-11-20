/*
 * generateur.js : génération d'un plateau complet (docs/02-atelier-cahier-des-charges.md, §9.4).
 * Aucun accès au DOM. Dépend de AT.alea, AT.hex, AT.catalogue, AT.plateau, AT.controles.
 *
 * AT.generateur.generer(graine, options) construit « comme des joueurs » :
 *   1. le noyau au centre, puis les montagnes et les monoblocs de terrain du catalogue, posés un à un contre le
 *      plateau (batir) ; les tuiles de remplissage ne servent qu'en dernier recours, si le réglage en autorise ;
 *   2. les villes (chercherVilles, §10) : 2 villes neutres et 2 villes de déploiement par camp, toutes posées
 *      par-dessus une Plaine, à 4 pas au moins les unes des autres, en retenant le placement le mieux équilibré ;
 *   3. le plateau doit passer AT.controles.tout sans erreur et être « complet » ; sinon on reconstruit.
 * Aucun plateau n'est écarté pour déséquilibre : le résultat donne le score, le camp avantagé et, au-delà du seuil
 * d'annonce (REGLAGES.equilibre.seuilAnnonce), une phrase d'annonce.
 * Même graine et mêmes options = même plateau (aucune horloge, aucun Math.random).
 *
 * Le générateur pose tout ce que le catalogue contient (rôles 'montagne' et 'terrain') : changer les formes ou le
 * nombre des monoblocs dans catalogue.js ne demande rien ici. Mesures : docs/07-mesures-catalogue-2.md.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.alea) require('./alea.js');
    if (!AT.controles) require('./controles.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles;

  // ------------------------------------------------------------------ construction libre (§9.4 : « comme des joueurs »)

  var LARGEUR = 96, DECALAGE = 48;                 // grille de travail : cases (q, r) entre -48 et 47
  var PAS_VOISINS = [LARGEUR, LARGEUR - 1, -1, -LARGEUR, -LARGEUR + 1, 1];   // même ordre que H.DIRS
  var POCHE_MAX = 14;                              // au-delà, une zone vide est tenue pour ouverte sur l'extérieur

  function numero(q, r) { return (q + DECALAGE) * LARGEUR + (r + DECALAGE); }
  function cleDe(n) { return H.cle(Math.floor(n / LARGEUR) - DECALAGE, (n % LARGEUR) - DECALAGE); }

  /**
   * Réglages effectifs du générateur : REGLAGES.generateur, REGLAGES.villes et les réglages généraux (seuils de
   * contact, écart entre villes, coûts), remplacés par les options fournies.
   */
  function reglages(options) {
    var R = C.REGLAGES, r = {}, o = options || {};
    Object.keys(R.generateur).forEach(function (k) { r[k] = R.generateur[k]; });
    Object.keys(R.villes).forEach(function (k) { r[k] = R.villes[k]; });
    r.seuilContact = R.seuilContact;
    r.mesureContact = R.mesureContact;
    r.seuilContactRemplissage = R.seuilContactRemplissage;
    r.ecartVilles = R.ecartVilles;
    r.couts = R.couts;
    Object.keys(r).forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; });
    return r;
  }

  /** Les 6 orientations d'une forme : [{rotation, pas: [décalages sur la grille], cases: [{q, r}]}]. */
  function orientations(cases) {
    var res = [];
    for (var rot = 0; rot < 6; rot++) {
      var tournees = cases.map(function (c) { return H.tourner(c.q, c.r, rot); });
      res.push({ rotation: rot, cases: tournees, pas: tournees.map(function (t) { return t.q * LARGEUR + t.r; }) });
    }
    return res;
  }

  /**
   * Taille de la poche fermée de cases vides qui contient la case `depart`, ou 0 si la zone est ouverte
   * (plus de POCHE_MAX cases). `occupe` : Int16Array (-1 = vide). `marque` reçoit les cases de la poche.
   */
  function poche(occupe, depart, marque) {
    var file = [depart], vues = new Set([depart]);
    for (var i = 0; i < file.length; i++) {
      for (var j = 0; j < 6; j++) {
        var v = file[i] + PAS_VOISINS[j];
        if (occupe[v] !== -1 || vues.has(v)) continue;
        vues.add(v);
        file.push(v);
        if (file.length > POCHE_MAX) return 0;
      }
    }
    if (marque) file.forEach(function (n) { marque.push(n); });
    return file.length;
  }

  /**
   * Construit le terrain « comme des joueurs » : à partir du noyau, les pièces sont posées une à une contre le
   * plateau. Chaque pose doit toucher au moins `seuilContact` pièces distinctes (moins tant que le plateau n'en a
   * pas autant) et ne pas enfermer de case vide. Parmi les poses permises, on préfère celles qui touchent beaucoup
   * et restent près du centre, avec une part de hasard.
   * Tuiles de remplissage (s'il y en a en stock), employées le moins possible :
   *   1. quand AUCUNE pose ne convient sans enfermer une case vide isolée, la case enfermée reçoit un remplissage ;
   *   2. à la fin, contre un monobloc qui ne touche pas assez de pièces.
   *
   * `noyau` : {id, cases} ; `pieces` : [{id, cases: [{q, r, terrain}]}], un élément par exemplaire à poser ;
   * `remplissage` : {id, cases} (une case) ou null ; R : reglages().
   * Déroulement : 1. pose des pièces dans un ordre tiré au sort ; 2. reprise des monoblocs qui ne touchent pas assez
   * de pièces (repris et reposés ailleurs) ; 3. rattrapage par une tuile de remplissage, s'il en reste.
   * Renvoie {ok, echec ('pose' | 'trou' | 'franchissable' | 'contact' | 'contactRemplissage'), pieces: [{modele, q, r, rotation}],
   *          cases: {cle: {terrain, piece, origine, modele, evenement}}, remplissages: nombre posé, sousContact: nombre de
   *          poses faites sous le seuil faute de mieux, deplacees: nombre de monoblocs repris}.
   */
  function batir(alea, noyau, pieces, remplissage, R) {
    var occupe = new Int16Array(LARGEUR * LARGEUR).fill(-1);
    var terrain = [], posees = [], cellules = [];
    var res = { ok: false, echec: null, pieces: [], cases: {}, remplissages: 0, sousContact: 0, deplacees: 0 };
    var stockR = remplissage ? R.remplissages : 0;
    var ESSAI = 32000;                             // marque d'une pose à l'essai dans la grille
    // Étirement tiré au sort : le plateau sera un peu plus large ou un peu plus haut.
    var e = 1 + R.etirement * (2 * alea.suivant() - 1), ex = e, ey = 1 / e;
    var plafond = Number.isInteger(R.demiHauteur) ? R.demiHauteur : null;

    /** Pose (ou repose) la pièce de rang n. */
    function mettre(n, modele, q, r, rotation) {
      var liste = [];
      modele.cases.forEach(function (c) {
        var t = H.tourner(c.q, c.r, rotation), k = numero(q + t.q, r + t.r);
        occupe[k] = n; terrain[k] = c.terrain; liste.push(k);
      });
      posees[n] = { modele: modele, q: q, r: r, rotation: rotation, montagne: modele.cases[0].terrain === 'montagne', taille: modele.cases.length };
      cellules[n] = liste;
    }
    function enlever(n) { cellules[n].forEach(function (k) { occupe[k] = -1; }); cellules[n] = []; }
    /** Cases vides qui touchent le plateau, en ordre fixe. */
    function bords() {
      var vues = new Set();
      cellules.forEach(function (liste) {
        liste.forEach(function (k) { for (var j = 0; j < 6; j++) if (occupe[k + PAS_VOISINS[j]] === -1) vues.add(k + PAS_VOISINS[j]); });
      });
      return Array.from(vues).sort(function (a, b) { return a - b; });
    }
    function eloignement(k) {
      var q = Math.floor(k / LARGEUR) - DECALAGE, r = (k % LARGEUR) - DECALAGE;
      var x = (q + r / 2) * ex, y = r * 0.8660254 * ey;
      return Math.sqrt(x * x + y * y);
    }
    /** Pièces distinctes touchées par un ensemble de cases (hors `moi`). */
    function touchees(liste, moi) {
      var vues = new Set();
      for (var i = 0; i < liste.length; i++) for (var j = 0; j < 6; j++) {
        var o = occupe[liste[i] + PAS_VOISINS[j]];
        if (o !== -1 && o !== moi) vues.add(o);
      }
      return vues;
    }
    /**
     * Meilleure pose du modèle contre le plateau, par rang : 0 = touche `besoin` pièces sans rien enfermer ;
     * 1 = idem en enfermant des cases isolées qu'un remplissage comblera ; 2 = contact insuffisant, rien d'enfermé.
     * Renvoie [pose de rang 0, de rang 1, de rang 2] (null si aucune), une pose = {q, r, rotation, enfermees}.
     */
    function chercherPose(modele, besoin) {
      var orients = orientations(modele.cases), estMontagne = modele.cases[0].terrain === 'montagne';
      var vus = new Set(), meilleurs = [null, null, null], notes = [-Infinity, -Infinity, -Infinity], front = bords();
      for (var fi = 0; fi < front.length; fi++) {
        for (var oi = 0; oi < 6; oi++) {
          var pas = orients[oi].pas;
          for (var ci = 0; ci < pas.length; ci++) {
            var ancre = front[fi] - pas[ci], signature = ancre * 8 + oi;
            if (vus.has(signature)) continue;
            vus.add(signature);
            var liste = [], libre = true, i, j;
            for (i = 0; i < pas.length; i++) {
              var k = ancre + pas[i];
              if (occupe[k] !== -1 || (plafond !== null && Math.abs((k % LARGEUR) - DECALAGE) > plafond)) { libre = false; break; }
              liste.push(k);
            }
            if (!libre) continue;
            // Contact : côtés communs et pièces distinctes ; montagnes à distance l'une de l'autre.
            var cotes = 0, voisinesP = new Set(), tropPres = false, loin = 0, accolees = 0;
            for (i = 0; i < liste.length; i++) {
              loin += eloignement(liste[i]);
              var special = modele.cases[i].terrain === 'foret' || modele.cases[i].terrain === 'marais' ? modele.cases[i].terrain : null;
              for (j = 0; j < 6; j++) {
                var o = occupe[liste[i] + PAS_VOISINS[j]];
                if (o === -1) continue;
                cotes += 1; voisinesP.add(o);
                if (special && terrain[liste[i] + PAS_VOISINS[j]] === special) accolees += 1;      // forêt contre forêt, marais contre marais
                if (estMontagne && posees[o].montagne && R.montagnesEcart > 1) tropPres = true;
              }
            }
            if (tropPres) continue;
            var assez = voisinesP.size >= besoin;
            // Cases vides enfermées par cette pose.
            for (i = 0; i < liste.length; i++) occupe[liste[i]] = ESSAI;
            var enfermees = [], refusee = false, dejaVues = new Set();
            for (i = 0; i < liste.length && !refusee; i++) for (j = 0; j < 6; j++) {
              var v = liste[i] + PAS_VOISINS[j];
              if (occupe[v] !== -1 || dejaVues.has(v)) continue;
              var marque = [], taille = poche(occupe, v, marque);
              marque.forEach(function (x) { dejaVues.add(x); });
              if (taille === 0) { dejaVues.add(v); continue; }
              if (taille > 1) { refusee = true; break; }
              enfermees.push(v);
            }
            for (i = 0; i < liste.length; i++) occupe[liste[i]] = -1;
            if (refusee || enfermees.length > stockR || (enfermees.length && !assez)) continue;
            var rang = assez ? (enfermees.length ? 1 : 0) : 2;
            var note = cotes + 1.5 * Math.min(voisinesP.size, 4) - R.compacite * loin / liste.length + R.fantaisie * alea.suivant() - 4 * enfermees.length
              + (R.accolerSpeciales || 0) * accolees;
            if (note > notes[rang]) {
              notes[rang] = note;
              meilleurs[rang] = { q: Math.floor(ancre / LARGEUR) - DECALAGE, r: (ancre % LARGEUR) - DECALAGE, rotation: oi, enfermees: enfermees };
            }
          }
        }
      }
      return meilleurs;
    }
    function combler(liste) {
      liste.forEach(function (k) {
        mettre(posees.length, remplissage, Math.floor(k / LARGEUR) - DECALAGE, (k % LARGEUR) - DECALAGE, 0);
        stockR -= 1; res.remplissages += 1;
      });
    }
    function manques() {
      var liste = [];
      for (var n = 0; n < posees.length; n++) if (posees[n].taille > 1 && touchees(cellules[n], n).size < R.seuilContact) liste.push(n);
      return liste;
    }

    mettre(0, noyau, 0, 0, 0);

    // 1. Pose des pièces une à une, dans un ordre tiré au sort.
    var ordre = alea.melanger(pieces);
    for (var pi = 0; pi < ordre.length; pi++) {
      var poses = chercherPose(ordre[pi], Math.min(R.seuilContact, posees.length));
      // Sans pose de rang 0 : on préfère une pose sous le seuil (les pièces suivantes la compléteront souvent) à un remplissage.
      var choix = poses[0] || (R.remplissageTot ? poses[1] || poses[2] : poses[2] || poses[1]);
      if (!choix) { res.echec = 'pose'; return res; }
      if (!poses[0] && choix === poses[2]) res.sousContact += 1;
      mettre(posees.length, ordre[pi], choix.q, choix.r, choix.rotation);
      combler(choix.enfermees);
    }

    // 2. Reprise : un monobloc qui ne touche pas assez de pièces est repris et reposé ailleurs, là où il en touche assez.
    var faibles = manques(), tours = 0;
    while (faibles.length && tours++ < R.reprises) {
      var n = faibles[alea.entier(faibles.length)], ancien = posees[n];
      if (ancien.modele === noyau) break;
      enlever(n);
      var ailleurs = chercherPose(ancien.modele, R.seuilContact);
      var mieux = ailleurs[0] || ailleurs[1];
      // Reprendre la pièce ne doit ni couper le plateau ni laisser un trou à sa place.
      if (mieux) {
        mettre(n, ancien.modele, mieux.q, mieux.r, mieux.rotation);
        var tenu = P.composantes(Object.keys(casesCourantes())).length === 1 && !P.trous(Object.keys(casesCourantes())).length;
        if (tenu) { combler(mieux.enfermees); res.deplacees += 1; }
        else { enlever(n); mieux = null; }
      }
      if (!mieux) mettre(n, ancien.modele, ancien.q, ancien.r, ancien.rotation);
      faibles = manques();
    }

    // 3. Rattrapage : un remplissage contre chaque monobloc qui ne touche toujours pas assez de pièces.
    var garde = 0;
    while (faibles.length && stockR > 0 && garde++ < 20) {
      var cible = faibles[0], place = null, notePlace = -Infinity;
      cellules[cible].forEach(function (k) {
        for (var j = 0; j < 6; j++) {
          var v = k + PAS_VOISINS[j];
          if (occupe[v] !== -1 || (plafond !== null && Math.abs((v % LARGEUR) - DECALAGE) > plafond)) continue;
          var autour = touchees([v], -2);
          if (autour.size < R.seuilContactRemplissage) continue;
          occupe[v] = ESSAI;
          var ferme = false;
          for (var x = 0; x < 6; x++) if (occupe[v + PAS_VOISINS[x]] === -1 && poche(occupe, v + PAS_VOISINS[x], null) > 0) ferme = true;
          occupe[v] = -1;
          if (ferme) continue;
          var note = autour.size * 2 - eloignement(v) * 0.1;
          if (note > notePlace) { notePlace = note; place = v; }
        }
      });
      if (place === null) break;
      combler([place]);
      faibles = manques();
    }

    function casesCourantes() {
      var toutes = {};
      cellules.forEach(function (liste, i) {
        liste.forEach(function (k) { toutes[cleDe(k)] = { terrain: terrain[k], piece: 'p' + (i + 1), origine: terrain[k], modele: posees[i].modele.id, evenement: null }; });
      });
      return toutes;
    }

    // Résultat, puis critères de réussite (les mêmes quel que soit le stock de remplissages).
    res.pieces = posees.map(function (p) { return { modele: p.modele.id, q: p.q, r: p.r, rotation: p.rotation }; });
    res.cases = casesCourantes();
    var cles = Object.keys(res.cases);
    if (P.trous(cles).length) { res.echec = 'trou'; return res; }
    if (P.composantes(cles).length !== 1) { res.echec = 'trou'; return res; }
    if (P.composantes(cles.filter(function (k) { return C.coutTerrain(res.cases[k].terrain, R.couts) !== Infinity; })).length !== 1) { res.echec = 'franchissable'; return res; }
    if (faibles.length) { res.echec = 'contact'; return res; }
    for (var x = 0; x < posees.length; x++) {
      if (posees[x].taille === 1 && touchees(cellules[x], x).size < R.seuilContactRemplissage) { res.echec = 'contactRemplissage'; return res; }
    }
    res.ok = true;
    return res;
  }

  /**
   * Cherche les 6 villes d'un terrain construit (§10) : 2 villes neutres et 2 villes de déploiement par camp, sur des
   * Plaines admissibles (AT.plateau.placesVilleSurCases), toutes à `ecartVilles` pas les unes des autres et de la
   * ville du centre, en MINIMISANT le déséquilibre entre Vert et Rouge : écart de coût en rations vers le centre,
   * vers chaque ville neutre et vers les villes de déploiement adverses (le score de AT.controles.ecartsCamps).
   * `toutes` : AT.plateau.casesPourVilles d'un plateau sans autre ville que celle du centre.
   * DÉTERMINISTE, sans aucun tirage : à score égal, le réglage `departage` choisit ('eloignement' : les villes de
   * déploiement des deux camps le plus loin possible les unes des autres ; sinon l'ordre des cases).
   * Les deux camps jouant le même rôle, chaque placement n'est examiné qu'une fois : Vert reçoit la paire qui vient
   * la première dans l'ordre des cases.
   * Renvoie {ok, raison, manque ('places' | 'ecart' | null), neutres: [clés], vert: [clés], rouge: [clés], score,
   *          places (nombre de Plaines admissibles), examines (placements des villes de déploiement examinés)}.
   * `combinaisons` (facultatif) : tableau qui reçoit les placements valides {score, eloignement, neutres, vert,
   * rouge} : un par placement des 4 villes de déploiement, avec ses deux meilleures villes neutres (voir propositionsVilles).
   */
  function chercherVilles(toutes, R, combinaisons) {
    var res = { ok: false, raison: null, manque: null, neutres: [], vert: [], rouge: [], score: null, places: 0, examines: 0 };
    var possede = Object.prototype.hasOwnProperty, ecart = R.ecartVilles;
    var CENTRE = '0,0';
    // Candidates : Plaines admissibles, reliées à la ville du centre (l'équilibre se mesure en rations depuis elles).
    var rations = {}, pas = {};
    var cand = P.placesVilleSurCases(toutes, { ecartVilles: ecart, couts: R.couts }).filter(function (k) {
      rations[k] = P.rationsSurCases(toutes, [k], { couts: R.couts });
      return possede.call(rations[k], CENTRE);
    });
    var n = cand.length, i, j, k;
    res.places = n;
    if (n < 6) {
      res.manque = 'places';
      res.raison = 'Pas assez de Plaines admissibles pour les 6 villes : ' + n + ' (une Plaine hors noyau, à ' + ecart + ' pas au moins de la ville du centre).';
      return res;
    }
    // Une candidate devenue ville coûte le prix d'une ville et non plus celui d'une Plaine, à l'arrivée.
    var surcout = C.coutTerrain('ville', R.couts) - C.coutTerrain('plaine', R.couts);
    var loin = [], rat = [], centre = [];
    for (i = 0; i < n; i++) {
      pas[cand[i]] = P.pasSurCases(toutes, [cand[i]], { couts: R.couts });
      loin.push(new Uint8Array(n)); rat.push(new Float64Array(n));
      centre.push(rations[cand[i]][CENTRE]);
    }
    for (i = 0; i < n; i++) for (j = 0; j < n; j++) {
      var p = pas[cand[i]];
      loin[i][j] = (i !== j && (!possede.call(p, cand[j]) || p[cand[j]] >= ecart)) ? 1 : 0;
      rat[i][j] = possede.call(rations[cand[i]], cand[j]) ? rations[cand[i]][cand[j]] + surcout : Infinity;
    }
    // Paires de villes d'un même camp ; pour chacune, coût du camp vers le centre et vers chaque candidate.
    var paires = [];
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      if (!loin[i][j]) continue;
      var vers = new Float64Array(n), libre = new Uint8Array(n);
      for (k = 0; k < n; k++) { vers[k] = Math.min(rat[i][k], rat[j][k]); libre[k] = (loin[i][k] && loin[j][k]) ? 1 : 0; }
      paires.push({ a: i, b: j, centre: Math.min(centre[i], centre[j]), vers: vers, libre: libre });
    }
    var parEloignement = R.departage === 'eloignement';
    var meilleur = null;
    var mieux = function (score, eloignement) {
      if (meilleur === null || score < meilleur.score) return true;
      return score === meilleur.score && parEloignement && eloignement > meilleur.eloignement;
    };
    var ecartsN = new Float64Array(n), ordreN = [];
    for (var x = 0; x < paires.length; x++) {
      var V = paires[x];
      for (var y = x + 1; y < paires.length; y++) {
        var Rg = paires[y];
        if (!V.libre[Rg.a] || !V.libre[Rg.b]) continue;
        res.examines += 1;
        // Centre, puis villes de déploiement adverses (rangées du plus proche au plus lointain, comparées rang par rang).
        var note = Math.abs(V.centre - Rg.centre);
        var v1 = V.vers[Rg.a], v2 = V.vers[Rg.b], r1 = Rg.vers[V.a], r2 = Rg.vers[V.b];
        var vProche = Math.min(v1, v2), rProche = Math.min(r1, r2);
        note += Math.abs(vProche - rProche) + Math.abs(Math.max(v1, v2) - Math.max(r1, r2));
        var eloignement = Math.min(vProche, rProche);
        // Élagage : les villes neutres ne peuvent qu'ajouter au score. (Sans élagage quand on collecte tout.)
        if (!combinaisons && meilleur !== null && (note > meilleur.score || (note === meilleur.score && !(parEloignement && eloignement > meilleur.eloignement)))) continue;
        // Les deux villes neutres : la paire de candidates libres, à l'écart l'une de l'autre, au plus petit écart total.
        ordreN.length = 0;
        for (k = 0; k < n; k++) {
          if (!V.libre[k] || !Rg.libre[k] || k === Rg.a || k === Rg.b) continue;
          ecartsN[k] = Math.abs(V.vers[k] - Rg.vers[k]);
          ordreN.push(k);
        }
        if (ordreN.length < 2) continue;
        ordreN.sort(function (a, b) { return ecartsN[a] - ecartsN[b] || a - b; });
        var n1 = -1, n2 = -1, somme = Infinity;
        for (i = 0; i < ordreN.length - 1; i++) {
          if (ecartsN[ordreN[i]] * 2 >= somme) break;
          for (j = i + 1; j < ordreN.length; j++) {
            var s = ecartsN[ordreN[i]] + ecartsN[ordreN[j]];
            if (s >= somme) break;
            if (loin[ordreN[i]][ordreN[j]]) { somme = s; n1 = ordreN[i]; n2 = ordreN[j]; break; }
          }
        }
        if (n1 === -1) continue;
        note += somme;
        if (combinaisons) combinaisons.push({ score: note, eloignement: eloignement, neutres: H.trier([cand[n1], cand[n2]]), vert: H.trier([cand[V.a], cand[V.b]]), rouge: H.trier([cand[Rg.a], cand[Rg.b]]) });
        if (mieux(note, eloignement)) meilleur = { score: note, eloignement: eloignement, V: V, Rg: Rg, n1: n1, n2: n2 };
      }
    }
    if (!meilleur) {
      res.manque = 'ecart';
      res.raison = 'Aucun placement des 6 villes ne respecte l’écart de ' + ecart + ' pas entre deux villes (' + n + ' Plaines admissibles, trop proches les unes des autres).';
      return res;
    }
    res.ok = true;
    res.neutres = H.trier([cand[meilleur.n1], cand[meilleur.n2]]);
    res.vert = H.trier([cand[meilleur.V.a], cand[meilleur.V.b]]);
    res.rouge = H.trier([cand[meilleur.Rg.a], cand[meilleur.Rg.b]]);
    res.score = meilleur.score;
    return res;
  }

  /** Signature d'un placement de villes (pour le reconnaître et le ranger) : les six cases, dans un ordre fixe. */
  function signatureVilles(x) { return [(x.neutres || []).join(' '), x.vert.join(' '), x.rouge.join(' ')].join(' | '); }

  /**
   * Les placements proposés par « Autre proposition » sur un terrain construit, du mieux équilibré au moins équilibré
   * (à score égal : selon le réglage `departage`, puis l'ordre fixe des cases), limités aux `propositionsMax` premiers.
   * Un placement = les 4 villes de déploiement, avec les deux villes neutres qui lui conviennent le mieux : ce n'est
   * donc PAS la liste de toutes les combinaisons de six villes. Aucun tirage : même terrain = même liste, et son
   * premier élément est le placement de chercherVilles.
   * Renvoie [{score, eloignement, neutres: [clés], vert: [clés], rouge: [clés]}] ([] s'il n'y en a aucun).
   */
  function propositionsVilles(toutes, R) {
    var liste = [];
    chercherVilles(toutes, R, liste);
    var parEloignement = R.departage === 'eloignement', rangs = liste.map(function (x, i) { return i; });
    rangs.sort(function (a, b) { return liste[a].score - liste[b].score || (parEloignement ? liste[b].eloignement - liste[a].eloignement : 0) || a - b; });
    var max = Number.isInteger(R.propositionsMax) && R.propositionsMax > 0 ? R.propositionsMax : 60;
    return rangs.slice(0, max).map(function (i) { return liste[i]; });
  }

  // ------------------------------------------------------------------ ce que le générateur pose

  /** Pièces du catalogue à poser : {noyau, pieces (un élément par exemplaire : montagnes et monoblocs), remplissage}. */
  function piecesDuCatalogue() {
    var res = { noyau: null, pieces: [], remplissage: null };
    C.ORDRE_MODELES.forEach(function (id) {
      var m = C.MODELES[id];
      if (m.noyau) { if (!res.noyau) res.noyau = m; return; }
      if (m.role === 'remplissage') { if (!res.remplissage && m.cases.length === 1) res.remplissage = m; return; }
      if (m.role === 'montagne' || m.role === 'terrain') for (var i = 0; i < m.nombre; i++) res.pieces.push(m);
    });
    return res;
  }

  /**
   * Le catalogue et les réglages correspondent-ils à ce que ce générateur sait faire ?
   * Renvoie null si oui, sinon une phrase qui nomme la cause.
   */
  function incompatibilite(R) {
    var suite = ' Le générateur doit être adapté (src/generateur.js) ; la création à la main reste possible.';
    var cat = piecesDuCatalogue();
    if (!cat.noyau || cat.noyau.id !== 'N1') return 'Catalogue : le noyau N1 est absent.' + suite;
    if (!cat.pieces.length) return 'Catalogue : aucune pièce de terrain à poser (rôles « terrain » et « montagne »).' + suite;
    if (P.quotaVilles('neutre') !== 2) return 'Réglage villes.neutres = ' + P.quotaVilles('neutre') + ', or le générateur pose 2 villes neutres.' + suite;
    if (C.REGLAGES.villesParCamp !== 2) return 'Réglage villesParCamp = ' + C.REGLAGES.villesParCamp + ', or le générateur pose 2 villes de déploiement par camp.' + suite;
    var stock = cat.remplissage ? cat.remplissage.nombre : 0;
    if (!Number.isInteger(R.remplissages) || R.remplissages < 0) return 'Nombre de tuiles de remplissage invalide.';
    if (R.remplissages > stock) return 'Le générateur ne peut pas poser ' + R.remplissages + ' tuiles de remplissage : le catalogue en compte ' + stock + '.';
    return null;
  }

  /** Construit le plateau (objet JSON) : terrain, puis les villes posées par-dessus (neutres d'abord), et les camps. */
  function construire(graine, construction, villes) {
    var plateau = P.vide(graine);
    plateau.pieces = construction.pieces.map(function (p, i) { return { id: 'p' + (i + 1), modele: p.modele, q: p.q, r: p.r, rotation: p.rotation }; });
    plateau.deploiements = villes.neutres.map(function (k) { return { cle: k, camp: 'neutre' }; })
      .concat(villes.vert.map(function (k) { return { cle: k, camp: 'vert' }; }), villes.rouge.map(function (k) { return { cle: k, camp: 'rouge' }; }));
    plateau.camps = { vert: villes.vert.slice(), rouge: villes.rouge.slice() };
    return plateau;
  }

  // ------------------------------------------------------------------ generer

  /**
   * Génère un plateau complet. `graine` : entier ou chaîne. options (facultatives) :
   *   seuilContact (2 ou 3), mesureContact ('cotes' | 'pieces'), tentatives (constructions essayées au plus),
   *   remplissages (tuiles de remplissage autorisées), demiHauteur, ecartVilles, couts, accolerSpeciales (regrouper
   *   forêts et marais), departage, et tout réglage de AT.catalogue.REGLAGES.generateur ;
   *   modeles : pièces personnelles du document courant (AT.plateau.modeles(plateau)). Le générateur ne connaît que
   *   le catalogue de base : elles sont REPORTÉES dans le plateau généré (champ `modeles`), non posées, et `note` le dit.
   * Renvoie {ok, plateau, score, avantage, avantageTexte, annonce, raison, note, essais, remplissages, echecs, controles} :
   *   ok = true : `plateau` porte toutes les pièces de construction et toutes les villes, et passe tous les contrôles
   *   de niveau erreur (étape « complet ») ; `score` est son score d'équilibre, `avantage` le camp avantagé ('vert',
   *   'rouge' ou null) et `avantageTexte` la phrase ; `annonce` est la phrase « Déséquilibre marqué… » quand le score
   *   dépasse REGLAGES.equilibre.seuilAnnonce, null sinon (AUCUN plateau n'est écarté pour déséquilibre) ;
   *   `remplissages` le nombre de tuiles de remplissage posées ;
   *   ok = false : plateau = null et `raison` explique l'échec ; `echecs` compte les essais ratés par étape
   *   (pose, trou, franchissable, contact, contactRemplissage, villes (terrain sans place pour les 6 villes), controles).
   */
  function generer(graine, options) {
    var R = reglages(options);
    var res = {
      ok: false, plateau: null, score: null, avantage: null, avantageTexte: null, annonce: null, raison: null, note: null, essais: 0, remplissages: 0,
      echecs: { pose: 0, trou: 0, franchissable: 0, contact: 0, contactRemplissage: 0, villes: 0, controles: 0 }, controles: null
    };
    if (C.REGLAGES.mesuresContact.indexOf(R.mesureContact) === -1) { res.raison = 'Mesure de contact inconnue.'; return res; }
    if (!Number.isInteger(R.seuilContact) || R.seuilContact < 0 || R.seuilContact > 6) { res.raison = 'Seuil de contact invalide.'; return res; }
    if (!Number.isInteger(R.tentatives) || R.tentatives < 1) { res.raison = 'Nombre de tentatives invalide.'; return res; }
    // Échec immédiat et nommé si le catalogue ou les réglages sortent de ce que le générateur sait faire.
    var cause = incompatibilite(R);
    if (cause) { res.raison = cause; res.incompatible = true; return res; }
    // Pièces personnelles du document : validées ici, reportées telles quelles dans le plateau généré.
    var persos = [];
    if (options && options.modeles !== undefined && options.modeles !== null) {
      var avis = P.validerModeles(options.modeles);
      if (!avis.ok) { res.raison = 'Pièces personnelles du document invalides : ' + avis.erreurs[0]; return res; }
      persos = avis.modeles;
    }
    var graineUtile = (typeof graine === 'number' || typeof graine === 'string') ? graine : 0;
    var alea = AT.alea.creer(graineUtile), cat = piecesDuCatalogue();
    var optionsControles = {
      seuilContact: R.seuilContact, mesureContact: R.mesureContact, seuilContactRemplissage: R.seuilContactRemplissage,
      ecartVilles: R.ecartVilles, couts: R.couts
    };
    var raisonVilles = null;

    for (var t = 0; t < R.tentatives && !res.ok; t++) {
      res.essais += 1;
      var construction = batir(alea, cat.noyau, cat.pieces, cat.remplissage, R);
      if (!construction.ok) { res.echecs[construction.echec] += 1; continue; }
      var villes = chercherVilles(construction.cases, R);
      if (!villes.ok) { res.echecs.villes += 1; raisonVilles = villes.raison; continue; }
      // Un plateau n'est rendu que s'il passe les contrôles et se trouve à l'étape « complet ».
      var plateau = construire(graineUtile, construction, villes);
      var bilan = K.tout(plateau, optionsControles);
      if (!bilan.ok || bilan.etape !== 'complet') { res.echecs.controles += 1; continue; }
      res.ok = true;
      res.plateau = plateau;
      res.controles = bilan;
      majEquilibre(res, bilan);
      res.remplissages = construction.remplissages;
    }

    if (!res.ok) {
      var e = res.echecs;
      res.raison = 'Aucun plateau valide en ' + res.essais + ' essais (échecs : pose ' + e.pose + ', trou ' + (e.trou + e.franchissable) + ', contact ' + (e.contact + e.contactRemplissage)
        + ', villes ' + e.villes + ', contrôles ' + e.controles + ').' + (raisonVilles ? ' Dernier refus des villes : ' + raisonVilles : '');
      return res;
    }
    if (persos.length) {
      res.plateau.modeles = persos;
      res.controles = K.tout(res.plateau, optionsControles);      // le bilan rendu décrit le plateau rendu
      res.note = 'Le générateur ne pose que le catalogue de base : ' + persos.length
        + (persos.length > 1 ? ' pièces personnelles sont conservées dans le plateau, non posées.' : ' pièce personnelle est conservée dans le plateau, non posée.');
    }
    return res;
  }

  /** Reporte dans le résultat de generer() le score, le camp avantagé et l'annonce éventuelle du bilan. */
  function majEquilibre(res, bilan) {
    var e = bilan.equilibre;
    res.score = e.score; res.avantage = e.avantage; res.avantageTexte = e.avantageTexte;
    res.annonce = K.texteAnnonce(e);
  }

  AT.generateur = {
    generer: generer, batir: batir, chercherVilles: chercherVilles, propositionsVilles: propositionsVilles, signatureVilles: signatureVilles, reglages: reglages,
    incompatibilite: incompatibilite, piecesDuCatalogue: piecesDuCatalogue
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.generateur;
})();
