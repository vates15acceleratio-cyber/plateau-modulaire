/*
 * generateur.js : génération d'un plateau complet (docs/02-atelier-cahier-des-charges.md, §9.4).
 * Aucun accès au DOM. Dépend de AT.alea, AT.hex, AT.catalogue, AT.plateau, AT.controles.
 *
 * AT.generateur.generer(graine, options) construit « comme des joueurs » :
 *   1. le noyau au centre, puis les montagnes et les monoblocs de terrain du catalogue, posés un à un contre le
 *      plateau (batir) ; les tuiles de remplissage ne servent qu'en dernier recours, si le réglage en autorise ;
 *   2. les villes (chercherVilles) : 2 villes de déploiement par camp sur des Plaines des bords haut et bas, une
 *      ville neutre contre chaque flanc, en retenant la combinaison la mieux équilibrée ;
 *   3. le plateau doit passer AT.controles.tout sans erreur et être « complet » ; sinon on reconstruit.
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
   * Cherche les villes d'un terrain construit (résultat de AT.plateau.cases, sans ville autre que le centre) :
   * 2 villes de déploiement par camp et une ville neutre par flanc, toutes à `ecartVilles` pas les unes des autres,
   * en retenant la combinaison au meilleur score d'équilibre (AT.controles.ecartsCamps) ; à score égal, le hasard choisit.
   * Renvoie {ok, raison, manque ('vert' | 'rouge' | 'gauche' | 'droite' | 'ecart' | null), vert: [clés], rouge: [clés],
   *          neutres: {gauche, droite}, score, places: {vert, rouge, gauche, droite} (nombres de places admissibles)}.
   * `combinaisons` (facultatif) : tableau qui reçoit TOUTES les combinaisons valides {score, vert, rouge, neutres},
   * dans l'ordre du parcours (voir propositionsVilles) ; le résultat et les tirages de l'aléa n'en dépendent pas.
   */
  function chercherVilles(toutes, alea, R, combinaisons) {
    var res = { ok: false, raison: null, manque: null, vert: [], rouge: [], neutres: { gauche: null, droite: null }, score: null, places: { vert: 0, rouge: 0, gauche: 0, droite: 0 } };
    var o = { profondeurExtremite: R.profondeurExtremite, ecartVilles: R.ecartVilles, contactVilleNeutre: R.contactVilleNeutre, neutresTiersCentral: R.neutresTiersCentral, couts: R.couts };
    var candidats = { vert: P.placesDeploiementSurCases(toutes, 'vert', o), rouge: P.placesDeploiementSurCases(toutes, 'rouge', o) };
    var neutres = P.placesNeutresSurCases(toutes, o);
    var parFlanc = { gauche: neutres.filter(function (x) { return x.flanc === 'gauche'; }), droite: neutres.filter(function (x) { return x.flanc === 'droite'; }) };
    res.places = { vert: candidats.vert.length, rouge: candidats.rouge.length, gauche: parFlanc.gauche.length, droite: parFlanc.droite.length };
    var noms = { vert: 'le déploiement de Vert (bord haut)', rouge: 'le déploiement de Rouge (bord bas)', gauche: 'la ville neutre du flanc gauche', droite: 'la ville neutre du flanc droit' };
    var manquant = candidats.vert.length < 2 ? 'vert' : candidats.rouge.length < 2 ? 'rouge' : !parFlanc.gauche.length ? 'gauche' : !parFlanc.droite.length ? 'droite' : null;
    if (manquant) { res.manque = manquant; res.raison = 'Pas assez de places pour ' + noms[manquant] + '.'; return res; }

    // Pas et rations depuis chaque candidat ; une ville neutre (case ajoutée) se mesure par ses voisines.
    var pas = {}, rations = {}, coutVille = C.coutTerrain('ville', R.couts);
    candidats.vert.concat(candidats.rouge).forEach(function (k) {
      pas[k] = P.pasSurCases(toutes, [k], { couts: R.couts });
      rations[k] = P.rationsSurCases(toutes, [k], { couts: R.couts });
    });
    var vers = function (table, cle) {                      // valeur vers une case du plateau ou vers une case vide
      if (Object.prototype.hasOwnProperty.call(table, cle)) return table[cle];
      var mieux = Infinity;
      H.voisines(cle).forEach(function (v) { if (Object.prototype.hasOwnProperty.call(table, v)) mieux = Math.min(mieux, table[v]); });
      return mieux;
    };
    var paires = function (liste) {
      var r = [];
      for (var i = 0; i < liste.length; i++) for (var j = i + 1; j < liste.length; j++) if (vers(pas[liste[i]], liste[j]) >= R.ecartVilles) r.push([liste[i], liste[j]]);
      return r;
    };
    var pv = paires(candidats.vert), pr = paires(candidats.rouge);
    if (!pv.length || !pr.length) {
      res.manque = !pv.length ? 'vert' : 'rouge';
      res.raison = 'Aucune paire de places à ' + R.ecartVilles + ' pas l’une de l’autre pour ' + noms[res.manque] + '.';
      return res;
    }
    // Pour une ville neutre : pas et rations depuis un candidat (une case de plus que sa meilleure voisine).
    var pasNeutre = function (k, n) { return vers(pas[k], n.cle) + 1; };
    var rationsNeutre = function (k, n) { return vers(rations[k], n.cle) + coutVille; };
    var croissant = function (a, b) { return a - b; };
    var meilleur = null, egaux = 0;
    for (var a = 0; a < pv.length; a++) {
      for (var b = 0; b < pr.length; b++) {
        var V = pv[a], Rg = pr[b], quatre = V.concat(Rg);
        if (vers(pas[V[0]], Rg[0]) < R.ecartVilles || vers(pas[V[0]], Rg[1]) < R.ecartVilles || vers(pas[V[1]], Rg[0]) < R.ecartVilles || vers(pas[V[1]], Rg[1]) < R.ecartVilles) continue;
        var cv = Math.min(rations[V[0]]['0,0'], rations[V[1]]['0,0']), cr = Math.min(rations[Rg[0]]['0,0'], rations[Rg[1]]['0,0']);
        var note = Math.abs(cv - cr);
        var lv = Rg.map(function (k) { return Math.min(rations[V[0]][k], rations[V[1]][k]); }).sort(croissant);
        var lr = V.map(function (k) { return Math.min(rations[Rg[0]][k], rations[Rg[1]][k]); }).sort(croissant);
        note += Math.abs(lv[0] - lr[0]) + Math.abs(lv[1] - lr[1]);
        var choisis = {}, possible = true;
        ['gauche', 'droite'].forEach(function (flanc) {
          var mieux = null, noteMieux = Infinity;
          parFlanc[flanc].forEach(function (n) {
            if (quatre.some(function (k) { return pasNeutre(k, n) < R.ecartVilles; })) return;
            var ecart = Math.abs(Math.min(rationsNeutre(V[0], n), rationsNeutre(V[1], n)) - Math.min(rationsNeutre(Rg[0], n), rationsNeutre(Rg[1], n)));
            // À écart égal, la case qui touche le plus de tuiles.
            var valeur = ecart - n.cotes / 100;
            if (valeur < noteMieux) { noteMieux = valeur; mieux = { cle: n.cle, ecart: ecart }; }
          });
          if (!mieux) possible = false; else { choisis[flanc] = mieux.cle; note += mieux.ecart; }
        });
        if (!possible) continue;
        if (combinaisons) combinaisons.push({ score: note, vert: H.trier(V), rouge: H.trier(Rg), neutres: { gauche: choisis.gauche, droite: choisis.droite } });
        if (meilleur === null || note < meilleur.score) { meilleur = { score: note, vert: V, rouge: Rg, neutres: choisis }; egaux = 1; }
        else if (note === meilleur.score) { egaux += 1; if (alea.entier(egaux) === 0) meilleur = { score: note, vert: V, rouge: Rg, neutres: choisis }; }
      }
    }
    if (!meilleur) { res.manque = 'ecart'; res.raison = 'Aucune combinaison de villes ne respecte l’écart de ' + R.ecartVilles + ' pas.'; return res; }
    res.ok = true;
    res.vert = H.trier(meilleur.vert); res.rouge = H.trier(meilleur.rouge);
    res.neutres = meilleur.neutres; res.score = meilleur.score;
    return res;
  }

  /** Signature d'une combinaison de villes (pour la reconnaître et la ranger) : les six cases, dans un ordre fixe. */
  function signatureVilles(x) { return [x.vert.join(' '), x.rouge.join(' '), x.neutres.gauche, x.neutres.droite].join(' | '); }

  /**
   * Toutes les façons valides de poser les villes sur un terrain construit, de la mieux équilibrée à la moins
   * équilibrée (à score égal : ordre fixe des cases). Aucun tirage : même terrain et mêmes réglages = même liste.
   * Renvoie [{score, vert: [clés], rouge: [clés], neutres: {gauche, droite}}] ([] s'il n'y en a aucune).
   */
  function propositionsVilles(toutes, R) {
    var liste = [];
    chercherVilles(toutes, AT.alea.creer(0), R, liste);
    var signatures = liste.map(signatureVilles), rangs = liste.map(function (x, i) { return i; });
    rangs.sort(function (a, b) { return liste[a].score - liste[b].score || (signatures[a] < signatures[b] ? -1 : signatures[a] > signatures[b] ? 1 : 0); });
    return rangs.map(function (i) { return liste[i]; });
  }

  // ------------------------------------------------------------------ ce que le générateur pose

  /** Pièces du catalogue à poser : {noyau, pieces (un élément par exemplaire : montagnes et monoblocs), remplissage, villeNeutre}. */
  function piecesDuCatalogue() {
    var res = { noyau: null, pieces: [], remplissage: null, villeNeutre: null };
    C.ORDRE_MODELES.forEach(function (id) {
      var m = C.MODELES[id];
      if (m.noyau) { if (!res.noyau) res.noyau = m; return; }
      if (m.role === 'remplissage') { if (!res.remplissage && m.cases.length === 1) res.remplissage = m; return; }
      if (m.role === 'ville') { if (!res.villeNeutre && m.cases.length === 1) res.villeNeutre = m; return; }
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
    if (!cat.villeNeutre || cat.villeNeutre.nombre !== 2) return 'Catalogue : le générateur pose 2 villes neutres d’une case (une par flanc).' + suite;
    if (C.REGLAGES.villesParCamp !== 2) return 'Réglage villesParCamp = ' + C.REGLAGES.villesParCamp + ', or le générateur pose 2 villes de déploiement par camp.' + suite;
    var stock = cat.remplissage ? cat.remplissage.nombre : 0;
    if (!Number.isInteger(R.remplissages) || R.remplissages < 0) return 'Nombre de tuiles de remplissage invalide.';
    if (R.remplissages > stock) return 'Le générateur ne peut pas poser ' + R.remplissages + ' tuiles de remplissage : le catalogue en compte ' + stock + '.';
    return null;
  }

  /** Profondeurs des extrémités permises au-delà de `p`, de la plus petite à la plus grande. */
  function profondeursPlusGrandes(p) {
    return P.profondeursPermises().filter(function (x) { return x > p; }).sort(function (a, b) { return a - b; });
  }

  /** Construit le plateau (objet JSON) : terrain, villes neutres, villes de déploiement, camps, profondeur des extrémités. */
  function construire(graine, construction, villes, profondeur) {
    var plateau = P.vide(graine);
    plateau.pieces = construction.pieces.map(function (p, i) { return { id: 'p' + (i + 1), modele: p.modele, q: p.q, r: p.r, rotation: p.rotation }; });
    ['gauche', 'droite'].forEach(function (flanc) {
      var p = H.decle(villes.neutres[flanc]);
      plateau.pieces.push({ id: 'p' + (plateau.pieces.length + 1), modele: 'VN', q: p.q, r: p.r, rotation: 0 });
    });
    plateau.deploiements = villes.vert.map(function (k) { return { cle: k, camp: 'vert' }; }).concat(villes.rouge.map(function (k) { return { cle: k, camp: 'rouge' }; }));
    plateau.camps = { vert: villes.vert.slice(), rouge: villes.rouge.slice() };
    // La profondeur des extrémités retenue pour ces villes est enregistrée dans le document (absente = réglage par défaut).
    if (profondeur !== undefined && profondeur !== C.REGLAGES.villes.profondeurExtremite) plateau.profondeurExtremite = profondeur;
    return plateau;
  }

  // ------------------------------------------------------------------ generer

  /**
   * Génère un plateau complet. `graine` : entier ou chaîne. options (facultatives) :
   *   seuilContact (2 ou 3), mesureContact ('cotes' | 'pieces'), tentatives (constructions essayées au plus),
   *   remplissages (tuiles de remplissage autorisées), demiHauteur, profondeurExtremite, contactVilleNeutre, ecartVilles,
   *   couts, et tout réglage de AT.catalogue.REGLAGES.generateur ;
   *   modeles : pièces personnelles du document courant (AT.plateau.modeles(plateau)). Le générateur ne connaît que
   *   le catalogue de base : elles sont REPORTÉES dans le plateau généré (champ `modeles`), non posées, et `note` le dit.
   * Renvoie {ok, plateau, score, raison, note, essais, remplissages, echecs, controles} :
   *   ok = true : `plateau` porte toutes les pièces de construction et toutes les villes, et passe tous les contrôles
   *   de niveau erreur (étape « complet ») ; `score` est son score d'équilibre ; `remplissages` le nombre de tuiles
   *   de remplissage posées ;
   *   ok = false : plateau = null et `raison` explique l'échec ; `echecs` compte les essais ratés par étape
   *   (pose, trou, franchissable, contact, contactRemplissage, villes, controles) ; `echecs.profondeur` compte, parmi
   *   les échecs « villes », les terrains qui auraient eu leurs villes avec des extrémités plus profondes : la raison
   *   le dit alors, et `profondeur` vaut {essais, conseillee (la plus petite profondeur qui aurait suffi)}.
   */
  function generer(graine, options) {
    var R = reglages(options);
    var res = {
      ok: false, plateau: null, score: null, raison: null, note: null, essais: 0, remplissages: 0,
      echecs: { pose: 0, trou: 0, franchissable: 0, contact: 0, contactRemplissage: 0, villes: 0, profondeur: 0, controles: 0 }, controles: null
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
      ecartVilles: R.ecartVilles, couts: R.couts, profondeurExtremite: R.profondeurExtremite,
      contactVilleNeutre: R.contactVilleNeutre, neutresTiersCentral: R.neutresTiersCentral
    };
    var raisonVilles = null, profondeurUtile = null;

    for (var t = 0; t < R.tentatives && !res.ok; t++) {
      res.essais += 1;
      var construction = batir(alea, cat.noyau, cat.pieces, cat.remplissage, R);
      if (!construction.ok) { res.echecs[construction.echec] += 1; continue; }
      var villes = chercherVilles(construction.cases, alea, R);
      if (!villes.ok) {
        res.echecs.villes += 1; raisonVilles = villes.raison;
        // Ce terrain aurait-il ses villes avec des extrémités plus profondes ? Essai à part, sur un autre aléa : la
        // suite des tirages de la génération n'en dépend pas.
        var plusProfond = profondeursPlusGrandes(R.profondeurExtremite).filter(function (p) {
          var Rp = {};
          Object.keys(R).forEach(function (k) { Rp[k] = R[k]; });
          Rp.profondeurExtremite = p;
          return chercherVilles(construction.cases, AT.alea.creer(0), Rp).ok;
        })[0];
        if (plusProfond !== undefined) { res.echecs.profondeur += 1; if (profondeurUtile === null || plusProfond < profondeurUtile) profondeurUtile = plusProfond; }
        continue;
      }
      // Un plateau n'est rendu que s'il passe les contrôles et se trouve à l'étape « complet ».
      var plateau = construire(graineUtile, construction, villes, R.profondeurExtremite);
      var bilan = K.tout(plateau, optionsControles);
      if (!bilan.ok || bilan.etape !== 'complet') { res.echecs.controles += 1; continue; }
      res.ok = true;
      res.plateau = plateau;
      res.controles = bilan;
      res.score = bilan.equilibre.score;
      res.remplissages = construction.remplissages;
    }

    if (!res.ok) {
      var e = res.echecs;
      res.raison = 'Aucun plateau valide en ' + res.essais + ' essais (échecs : pose ' + e.pose + ', trou ' + (e.trou + e.franchissable) + ', contact ' + (e.contact + e.contactRemplissage)
        + ', villes ' + e.villes + ', contrôles ' + e.controles + ').' + (raisonVilles ? ' Dernier refus des villes : ' + raisonVilles : '');
      // La profondeur des extrémités est en cause : des terrains construits n'ont manqué de places que pour cela.
      if (e.profondeur) {
        var prof = R.profondeurExtremite;
        res.profondeur = { essais: e.profondeur, conseillee: profondeurUtile };
        res.raison += ' La profondeur des extrémités (' + prof + (prof > 1 ? ' rangées' : ' rangée') + ' en haut et en bas) est en cause : ' + e.profondeur
          + (e.profondeur > 1 ? ' terrains construits auraient eu leurs villes' : ' terrain construit aurait eu ses villes') + ' avec ' + profondeurUtile
          + ' rangées. Changez le réglage « Profondeur des extrémités » (étape « Villes »), ou essayez la graine suivante.';
      }
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

  AT.generateur = {
    generer: generer, batir: batir, chercherVilles: chercherVilles, propositionsVilles: propositionsVilles, signatureVilles: signatureVilles, reglages: reglages,
    incompatibilite: incompatibilite, piecesDuCatalogue: piecesDuCatalogue
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.generateur;
})();
