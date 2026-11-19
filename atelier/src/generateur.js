/*
 * generateur.js : génération d'un plateau complet (docs/02-atelier-cahier-des-charges.md, §4).
 * Aucun accès au DOM. Dépend de AT.alea, AT.hex, AT.catalogue, AT.plateau, AT.controles.
 *
 * AT.generateur.generer(graine, options) :
 *   1. forme libre : hexagone de rayon 5 dont on retire puis ajoute des paires de cases de bord,
 *      symétrique par demi-tour autour de (0,0) ;
 *   2. noyau au centre, montagnes, villes (centre, 2 en haut pour Vert, 2 en bas pour Rouge, 2 neutres),
 *      monoblocs (chaque bois / lisière / bosquet face à son jumeau marécage / mare / roselière), tuiles simples ;
 *   3. échanges de tuiles simples pour réduire le score d'équilibre ;
 *   4. le meilleur essai est gardé ; il doit passer AT.controles.tout sans erreur et épuiser le stock.
 * Même graine et mêmes options = même plateau (aucune horloge, aucun Math.random).
 *
 * Deux simplifications, plus strictes que les contrôles (voir docs/03-mesures-faisabilite.md) :
 *   - la forme exige que CHAQUE case ait au moins `seuilContact` cases voisines, même une case de monobloc ;
 *   - le plateau produit est toujours symétrique par demi-tour pour la forme et pour les villes.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.alea) require('./alea.js');
    if (!AT.controles) require('./controles.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles;

  var INFINI = 1e9;
  /** Paires de monoblocs jumeaux (même forme, forêt d'un côté, marais de l'autre : même coût en rations). */
  var JUMEAUX = [['F3', 'S3'], ['F31', 'S31'], ['F21', 'S21']];
  var MONTAGNES = ['M4', 'M5'];

  /** Réglages effectifs : REGLAGES.generateur et réglages généraux, remplacés par les options fournies. */
  function reglages(options) {
    var R = C.REGLAGES, r = {}, o = options || {};
    Object.keys(R.generateur).forEach(function (k) { r[k] = R.generateur[k]; });
    r.seuilContact = R.seuilContact;
    r.mesureContact = R.mesureContact;
    r.ecartVilles = R.ecartVilles;
    r.couts = R.couts;
    Object.keys(r).forEach(function (k) { if (o[k] !== undefined) r[k] = o[k]; });
    return r;
  }

  /** Moitié « canonique » du plateau : une case et une seule de chaque paire {case, symétrique}. */
  function moitie(p) { return p.r > 0 || (p.r === 0 && p.q > 0); }

  // ------------------------------------------------------------------ forme libre

  /**
   * Manque de voisines d'une forme : somme, sur les cases qui ont moins de `seuil` cases voisines,
   * du nombre de voisines qui leur manquent. 0 = chaque case a assez de voisines.
   * `seulement` (facultatif) : ne compter que ces cases-là (celles qui sont dans la forme).
   */
  function manque(S, seuil, seulement) {
    var total = 0;
    (seulement || S).forEach(function (c) {
      if (!S.has(c)) return;
      var p = H.decle(c), n = 0;
      for (var i = 0; i < 6; i++) if (S.has(H.cle(p.q + H.DIRS[i].q, p.r + H.DIRS[i].r))) n += 1;
      if (n < seuil) total += seuil - n;
    });
    return total;
  }

  /**
   * Une retouche aléatoire de l'hexagone de départ : `retouches` paires retirées du bord, puis autant ajoutées.
   * Le tirage est guidé : à chaque pas, on écarte les cases qui laisseraient un manque de voisines que les
   * ajouts restants ne peuvent plus combler (une paire ajoutée comble au plus 4 manques, estimation large) ;
   * après le dernier ajout, le manque doit être nul.
   * Renvoie l'ensemble (Set) des clés, à valider par formeValide, ou null si le tirage est dans une impasse.
   */
  function retoucher(alea, R) {
    var S = new Set(H.disque(R.rayon)), retirees = new Set(), k, candidates;
    // Garde les cases dont la bascule (retrait ou ajout de la paire) laisse un manque rattrapable.
    function filtrer(liste, ajout, ajoutsRestants) {
      var actuel = manque(S, R.seuilContact);
      return liste.filter(function (c) {
        // Seules la case, sa symétrique et leurs voisines changent : on ne recompte que celles-là.
        var s = H.symetrique(c), autour = new Set([c, s].concat(H.voisines(c), H.voisines(s)));
        var avant = manque(S, R.seuilContact, autour);
        if (ajout) { S.add(c); S.add(s); } else { S.delete(c); S.delete(s); }
        var apres = manque(S, R.seuilContact, autour);
        if (ajout) { S.delete(c); S.delete(s); } else { S.add(c); S.add(s); }
        return actuel - avant + apres <= 4 * ajoutsRestants;
      });
    }
    for (k = 0; k < R.retouches; k++) {
      candidates = [];
      S.forEach(function (c) {
        var p = H.decle(c);
        if (!moitie(p) || H.anneau(p) < 2) return;                      // jamais le noyau
        if (H.voisines(c).some(function (v) { return !S.has(v); })) candidates.push(c);
      });
      candidates = filtrer(H.trier(candidates), false, R.retouches);
      if (!candidates.length) return null;
      var retiree = alea.choisir(candidates);
      S.delete(retiree); S.delete(H.symetrique(retiree));
      retirees.add(retiree); retirees.add(H.symetrique(retiree));
    }
    for (k = 0; k < R.retouches; k++) {
      var vues = new Set();
      candidates = [];
      S.forEach(function (c) {
        H.voisines(c).forEach(function (v) {
          if (S.has(v) || vues.has(v) || retirees.has(v)) return;      // on ne rebouche pas une case retirée
          vues.add(v);
          if (moitie(H.decle(v))) candidates.push(v);
        });
      });
      candidates = filtrer(H.trier(candidates), true, R.retouches - 1 - k);
      if (!candidates.length) return null;
      var ajoutee = alea.choisir(candidates);
      S.add(ajoutee); S.add(H.symetrique(ajoutee));
    }
    return S;
  }

  /**
   * La forme convient-elle ? Chaque case a au moins `seuil` voisines ; la rangée du haut peut recevoir
   * deux villes à `ecart` pas ; forme d'un seul tenant et sans trou. Renvoie true / false.
   */
  function formeValide(S, R) {
    if (manque(S, R.seuilContact) !== 0) return false;
    var haut = Infinity, qmin = Infinity, qmax = -Infinity;
    S.forEach(function (c) {
      var p = H.decle(c);
      if (p.r < haut) { haut = p.r; qmin = p.q; qmax = p.q; }
      else if (p.r === haut) { qmin = Math.min(qmin, p.q); qmax = Math.max(qmax, p.q); }
    });
    if (qmax - qmin < R.ecartVilles) return false;
    if (P.composantes(Array.from(S)).length !== 1) return false;
    // Pas de trou : tout ce qui n'est pas le plateau, dans un disque plus large, est d'un seul tenant.
    var dehors = H.disque(R.rayon + R.retouches + 2).filter(function (c) { return !S.has(c); });
    return P.composantes(dehors).length === 1;
  }

  /**
   * Tire une forme valide. Renvoie {ok, cases: [clés triées], tirages} ; ok = false si aucun des
   * `essaisForme` tirages ne convient (aucun repli sur l'hexagone non retouché).
   */
  function tirerForme(alea, R) {
    for (var t = 1; t <= R.essaisForme; t++) {
      var S = retoucher(alea, R);
      if (S && formeValide(S, R)) return { ok: true, cases: H.trier(Array.from(S)), tirages: t };
    }
    return { ok: false, cases: null, tirages: R.essaisForme };
  }

  /** Graphe indexé d'une forme : cases numérotées dans l'ordre de lecture. */
  function indexer(cles) {
    var G = { n: cles.length, cles: cles, index: new Map(), q: [], r: [], voisins: [], sym: [], anneau: [] };
    cles.forEach(function (c, i) { G.index.set(c, i); });
    cles.forEach(function (c, i) {
      var p = H.decle(c);
      G.q.push(p.q); G.r.push(p.r); G.anneau.push(H.anneau(p));
      G.sym.push(G.index.get(H.symetrique(c)));
      G.voisins.push(H.voisines(c).filter(function (v) { return G.index.has(v); }).map(function (v) { return G.index.get(v); }));
    });
    G.haut = Math.min.apply(null, G.r);
    G.bas = Math.max.apply(null, G.r);
    return G;
  }

  // ------------------------------------------------------------------ outils sur le graphe indexé

  /** Pas minimaux depuis la case `depart` par les cases non bloquées. Renvoie un tableau (INFINI = hors d'atteinte). */
  function pasDepuis(G, bloque, depart) {
    var d = new Array(G.n).fill(INFINI), file = [depart];
    d[depart] = 0;
    for (var i = 0; i < file.length; i++) {
      var vs = G.voisins[file[i]];
      for (var j = 0; j < vs.length; j++) {
        if (d[vs[j]] === INFINI && !bloque[vs[j]]) { d[vs[j]] = d[file[i]] + 1; file.push(vs[j]); }
      }
    }
    return d;
  }

  /** Rations minimales depuis `sources` ; cout[i] < 0 = infranchissable. Remplit et renvoie le tableau d. */
  function rationsDepuis(G, cout, sources, d, fait) {
    var n = G.n, i;
    for (i = 0; i < n; i++) { d[i] = INFINI; fait[i] = 0; }
    for (i = 0; i < sources.length; i++) d[sources[i]] = 0;
    for (;;) {
      var m = -1, dm = INFINI;
      for (i = 0; i < n; i++) if (!fait[i] && d[i] < dm) { dm = d[i]; m = i; }
      if (m < 0) break;
      fait[m] = 1;
      var vs = G.voisins[m];
      for (var j = 0; j < vs.length; j++) {
        var v = vs[j];
        if (cout[v] >= 0 && !fait[v] && dm + cout[v] < d[v]) d[v] = dm + cout[v];
      }
    }
    return d;
  }

  /**
   * Règle de contact sur un remplissage partiel : proprietaire[i] = numéro du monobloc qui porte la case,
   * ou -1 (tuile d'une case, posée ou à venir : chacune compte pour une pièce). Vrai si toutes les pièces
   * atteignent le seuil pour la mesure retenue.
   */
  function contactRespecte(G, proprietaire, R) {
    var groupes = new Map();
    for (var i = 0; i < G.n; i++) {
      var moi = proprietaire[i] >= 0 ? proprietaire[i] : -1 - i;
      var g = groupes.get(moi);
      if (!g) { g = { cotes: new Set(), pieces: new Set() }; groupes.set(moi, g); }
      var vs = G.voisins[i];
      for (var j = 0; j < vs.length; j++) {
        var autre = proprietaire[vs[j]] >= 0 ? proprietaire[vs[j]] : -1 - vs[j];
        if (autre !== moi) { g.cotes.add(vs[j]); g.pieces.add(autre); }
      }
    }
    var ok = true;
    groupes.forEach(function (g) { if (g[R.mesureContact].size < R.seuilContact) ok = false; });
    return ok;
  }

  /** Indices des cases d'un modèle posé, ou null si une case sort de la forme. */
  function indicesPose(G, idModele, q, r, rotation) {
    var res = [], cs = P.casesModele(idModele, q, r, rotation);
    for (var i = 0; i < cs.length; i++) {
      var k = G.index.get(cs[i].cle);
      if (k === undefined) return null;
      res.push(k);
    }
    return res;
  }

  // ------------------------------------------------------------------ un essai de remplissage

  /**
   * Remplit la forme. Renvoie {echec: 'montagnes' | 'villes' | 'monoblocs' | 'contact' | 'inventaire'}
   * ou {score, pieces: [{modele, q, r, rotation}], camps}.
   */
  function essai(G, alea, R) {
    var n = G.n, i;
    var terrain = new Array(n).fill(null);         // terrain de chaque case, null = pas encore remplie
    var proprietaire = new Array(n).fill(-1);      // numéro du monobloc, -1 = tuile d'une case
    var pieces = [], numero = 0;

    function placer(idModele, q, r, rotation, indices) {
      var m = C.modele(idModele);
      indices.forEach(function (k, j) { terrain[k] = m.cases[j].terrain; proprietaire[k] = numero; });
      pieces.push({ modele: idModele, q: q, r: r, rotation: rotation });
      numero += 1;
    }
    function libres(indices) { return indices.every(function (k) { return terrain[k] === null; }); }

    // Noyau.
    placer('N1', 0, 0, 0, indicesPose(G, 'N1', 0, 0, 0));

    // Montagnes : dans l'hexagone de rayon `montagnesRayonMax`, hors rangées extrêmes, à distance l'une de l'autre.
    var ordre = alea.melanger(MONTAGNES), roche = [];
    for (var mi = 0; mi < ordre.length; mi++) {
      var poses = [];
      for (i = 0; i < n; i++) {
        for (var rot = 0; rot < 6; rot++) {
          var ind = indicesPose(G, ordre[mi], G.q[i], G.r[i], rot);
          if (!ind || !libres(ind)) continue;
          var bon = ind.every(function (k) {
            if (G.anneau[k] > R.montagnesRayonMax || G.r[k] === G.haut || G.r[k] === G.bas) return false;
            return roche.every(function (x) { return H.distance({ q: G.q[k], r: G.r[k] }, { q: G.q[x], r: G.r[x] }) >= R.montagnesEcart; });
          });
          if (bon) poses.push({ q: G.q[i], r: G.r[i], rotation: rot, indices: ind });
        }
      }
      if (!poses.length) return { echec: 'montagnes' };
      var pose = alea.choisir(poses);
      placer(ordre[mi], pose.q, pose.r, pose.rotation, pose.indices);
      roche = roche.concat(pose.indices);
    }
    var bloque = terrain.map(function (t) { return t === 'montagne'; });
    var depuisCentre = pasDepuis(G, bloque, G.index.get('0,0'));
    for (i = 0; i < n; i++) if (!bloque[i] && depuisCentre[i] === INFINI) return { echec: 'montagnes' };   // case enfermée

    // Villes de déploiement : deux cases de la rangée du haut à `ecartVilles` pas au moins ; Rouge en face.
    var rangee = [];
    for (i = 0; i < n; i++) if (G.r[i] === G.haut && terrain[i] === null && terrain[G.sym[i]] === null) rangee.push(i);
    var paires = [];
    rangee.forEach(function (a) {
      rangee.forEach(function (b) { if (G.q[b] - G.q[a] >= R.ecartVilles) paires.push([a, b]); });
    });
    if (!paires.length) return { echec: 'villes' };
    var vert = alea.choisir(paires), rouge = [G.sym[vert[1]], G.sym[vert[0]]];
    var centre = G.index.get('0,0');
    var fixes = [centre, vert[0], vert[1], rouge[0], rouge[1]];
    var cartes = fixes.map(function (v) { return pasDepuis(G, bloque, v); });
    for (i = 0; i < fixes.length; i++) {
      for (var j2 = i + 1; j2 < fixes.length; j2++) if (cartes[i][fixes[j2]] < R.ecartVilles) return { echec: 'villes' };
    }
    // Villes neutres : une paire symétrique, hors rangées extrêmes, à `ecartVilles` pas de toutes les autres.
    var neutres = [];
    for (i = 0; i < n; i++) {
      var s = G.sym[i];
      if (!moitie({ q: G.q[i], r: G.r[i] }) || terrain[i] !== null || terrain[s] !== null) continue;
      if (G.r[i] === G.haut || G.r[i] === G.bas || fixes.indexOf(i) !== -1 || fixes.indexOf(s) !== -1) continue;
      var loin = cartes.every(function (d) { return d[i] >= R.ecartVilles && d[s] >= R.ecartVilles; });
      if (loin && pasDepuis(G, bloque, i)[s] >= R.ecartVilles) neutres.push(i);
    }
    if (!neutres.length) return { echec: 'villes' };
    var neutre = alea.choisir(neutres);
    var villes = fixes.slice(1).concat([neutre, G.sym[neutre]]).sort(function (a, b) { return a - b; });
    villes.forEach(function (k) { terrain[k] = 'ville'; });
    if (!contactRespecte(G, proprietaire, R)) return { echec: 'contact' };

    // Monoblocs : chaque pièce de forêt en face de sa jumelle de marais (même coût : symétrie des rations).
    var jumeaux = alea.melanger(JUMEAUX);
    for (var ji = 0; ji < jumeaux.length; ji++) {
      var candidats = [];
      for (i = 0; i < n; i++) {
        for (var rot2 = 0; rot2 < 6; rot2++) {
          var ici = indicesPose(G, jumeaux[ji][0], G.q[i], G.r[i], rot2);
          if (!ici || !libres(ici)) continue;
          var enFace = ici.map(function (k) { return G.sym[k]; });
          if (!libres(enFace) || enFace.some(function (k) { return ici.indexOf(k) !== -1; })) continue;
          candidats.push({ q: G.q[i], r: G.r[i], rotation: rot2, ici: ici, enFace: enFace });
        }
      }
      candidats = alea.melanger(candidats);
      var pris = false;
      for (var ci = 0; ci < candidats.length && !pris; ci++) {
        var c = candidats[ci];
        // Essai de pose, annulé si la règle de contact n'est plus respectée.
        c.ici.forEach(function (k) { proprietaire[k] = numero; });
        c.enFace.forEach(function (k) { proprietaire[k] = numero + 1; });
        if (contactRespecte(G, proprietaire, R)) {
          var cote = alea.entier(2);                  // quel jumeau de quel côté
          placer(jumeaux[ji][cote], c.q, c.r, c.rotation, c.ici);
          placer(jumeaux[ji][1 - cote], 0 - c.q, 0 - c.r, (c.rotation + 3) % 6, c.enFace);
          pris = true;
        } else {
          c.ici.concat(c.enFace).forEach(function (k) { proprietaire[k] = -1; });
        }
      }
      if (!pris) return { echec: 'monoblocs' };
    }

    // Tuiles simples : forêts et marais par paires symétriques, plaines ailleurs.
    var reste = [];
    for (i = 0; i < n; i++) if (terrain[i] === null) reste.push(i);
    var nP = C.MODELES.P.nombre, nF = C.MODELES.F.nombre, nS = C.MODELES.S.nombre;
    if (reste.length !== nP + nF + nS) return { echec: 'inventaire' };
    var doubles = alea.melanger(reste.filter(function (k) { return terrain[G.sym[k]] === null && moitie({ q: G.q[k], r: G.r[k] }); }));
    var aPoser = { foret: nF, marais: nS };
    for (i = 0; i < doubles.length && aPoser.foret > 0 && aPoser.marais > 0; i++) {
      var sens = alea.entier(2);
      terrain[doubles[i]] = sens ? 'foret' : 'marais';
      terrain[G.sym[doubles[i]]] = sens ? 'marais' : 'foret';
      aPoser.foret -= 1; aPoser.marais -= 1;
    }
    alea.melanger(reste.filter(function (k) { return terrain[k] === null; })).forEach(function (k) {
      if (aPoser.foret > 0) { terrain[k] = 'foret'; aPoser.foret -= 1; }
      else if (aPoser.marais > 0) { terrain[k] = 'marais'; aPoser.marais -= 1; }
      else terrain[k] = 'plaine';
    });

    // Équilibre : échanges de deux tuiles simples tant que le score ne se dégrade pas.
    var cout = new Array(n), d1 = new Array(n), d2 = new Array(n), fait = new Array(n);
    var majCout = function (k) { var v = C.coutTerrain(terrain[k], R.couts); cout[k] = v === Infinity ? -1 : v; };
    for (i = 0; i < n; i++) majCout(i);
    var toutesVilles = [centre].concat(villes);
    var mesurer = function () {
      rationsDepuis(G, cout, vert, d1, fait);
      rationsDepuis(G, cout, rouge, d2, fait);
      var total = 0;
      for (var v = 0; v < toutesVilles.length; v++) total += Math.abs(d1[toutesVilles[v]] - d2[G.sym[toutesVilles[v]]]);
      return total;
    };
    var score = mesurer();
    for (var e = 0; e < R.echanges && score > 0; e++) {
      var a = reste[alea.entier(reste.length)], b = reste[alea.entier(reste.length)];
      if (terrain[a] === terrain[b]) continue;
      var tmp = terrain[a]; terrain[a] = terrain[b]; terrain[b] = tmp;
      majCout(a); majCout(b);
      var nouveau = mesurer();
      if (nouveau <= score) { score = nouveau; }
      else { tmp = terrain[a]; terrain[a] = terrain[b]; terrain[b] = tmp; majCout(a); majCout(b); }
    }

    // Liste des pièces : monoblocs déjà notés, puis villes, puis tuiles simples (ordre de lecture).
    var modeleSimple = { plaine: 'P', foret: 'F', marais: 'S' };
    villes.forEach(function (k) { pieces.push({ modele: 'V', q: G.q[k], r: G.r[k], rotation: 0 }); });
    reste.forEach(function (k) { pieces.push({ modele: modeleSimple[terrain[k]], q: G.q[k], r: G.r[k], rotation: 0 }); });
    var cleDe = function (k) { return G.cles[k]; };
    return { score: score, pieces: pieces, camps: { vert: H.trier(vert.map(cleDe)), rouge: H.trier(rouge.map(cleDe)) } };
  }

  /** Construit le plateau (objet JSON du contrat) à partir du résultat d'un essai. */
  function construire(graine, resultat) {
    var plateau = P.vide(graine);
    plateau.pieces = resultat.pieces.map(function (p, i) { return { id: 'p' + (i + 1), modele: p.modele, q: p.q, r: p.r, rotation: p.rotation }; });
    plateau.camps = { vert: resultat.camps.vert.slice(), rouge: resultat.camps.rouge.slice() };
    return plateau;
  }

  // ------------------------------------------------------------------ ce que le générateur sait poser

  var SIMPLES = { V: 'ville', P: 'plaine', F: 'foret', S: 'marais' };   // modèles d'une case connus, et leur terrain
  var VILLES_POSEES = 6;                                                // 2 en haut, 2 en bas, 2 neutres (plus celle du noyau)

  /**
   * Le catalogue et les réglages correspondent-ils à ce que ce générateur sait poser ?
   * Renvoie null si oui, sinon une phrase qui nomme la cause (le générateur n'est pas général : voir l'en-tête de catalogue.js).
   */
  function incompatibilite(R) {
    var suite = ' Le générateur doit être adapté (src/generateur.js) ; la retouche à la main reste possible.';
    if (!Number.isInteger(R.rayon) || R.rayon < 2 || R.rayon > 12) return 'Rayon de l’hexagone de départ invalide (' + R.rayon + ').';
    var connus = ['N1'].concat(MONTAGNES);
    JUMEAUX.forEach(function (paire) { connus = connus.concat(paire); });
    var manquants = connus.concat(Object.keys(SIMPLES)).filter(function (id) { return !C.modele(id); });
    if (manquants.length) return 'Catalogue : modèle(s) attendu(s) par le générateur et absent(s) : ' + manquants.join(', ') + '.' + suite;
    var inconnus = [], nombres = [];
    C.ORDRE_MODELES.forEach(function (id) {
      var m = C.MODELES[id];
      if (m.cases.length > 1) {
        if (connus.indexOf(id) === -1) inconnus.push(id + ' (monobloc)');
        else if (m.nombre !== 1) nombres.push(id + ' × ' + m.nombre);
      } else if (!Object.prototype.hasOwnProperty.call(SIMPLES, id) || m.cases[0].terrain !== SIMPLES[id]) {
        inconnus.push(id + ' (une case)');
      }
    });
    if (inconnus.length) return 'Catalogue : pièce(s) que le générateur ne sait pas poser : ' + inconnus.join(', ') + '.' + suite;
    if (nombres.length) return 'Catalogue : le générateur pose un seul exemplaire de chaque monobloc, or le catalogue en compte : ' + nombres.join(', ') + '.' + suite;
    if (!C.MODELES.N1.noyau) return 'Catalogue : le modèle N1 n’est plus le noyau.' + suite;
    for (var j = 0; j < JUMEAUX.length; j++) {
      if (C.MODELES[JUMEAUX[j][0]].cases.length !== C.MODELES[JUMEAUX[j][1]].cases.length) {
        return 'Catalogue : les monoblocs jumeaux ' + JUMEAUX[j].join(' et ') + ' n’ont plus le même nombre de cases.' + suite;
      }
    }
    if (C.MODELES.V.nombre !== VILLES_POSEES) {
      return 'Catalogue : ' + C.MODELES.V.nombre + ' villes d’une case, or le générateur en pose ' + VILLES_POSEES + ' (2 en haut, 2 en bas, 2 neutres).' + suite;
    }
    if (C.REGLAGES.villesParCamp !== 2) return 'Réglage villesParCamp = ' + C.REGLAGES.villesParCamp + ', or le générateur pose 2 villes de déploiement par camp.' + suite;
    var casesForme = 3 * R.rayon * (R.rayon + 1) + 1, casesCatalogue = C.totaux().cases;
    if (casesForme !== casesCatalogue) {
      return 'Le catalogue compte ' + casesCatalogue + ' cases, or l’hexagone de départ de rayon ' + R.rayon + ' en compte ' + casesForme
        + ' : le plateau ne peut pas utiliser toutes les pièces.' + suite;
    }
    return null;
  }

  // ------------------------------------------------------------------ generer

  /**
   * Génère un plateau. `graine` : entier ou chaîne. options (facultatives) :
   *   seuilContact (2 ou 3), mesureContact ('cotes' | 'pieces'), tentatives (essais de remplissage par forme),
   *   et tout réglage de AT.catalogue.REGLAGES.generateur (retouches, formes, echanges, essaisForme…), ecartVilles, couts.
   * Renvoie {ok, plateau, score, raison, forme, essais, formesEssayees, tiragesForme, echecs, controles} :
   *   ok = true : `plateau` utilise toutes les pièces et passe tous les contrôles de niveau erreur ;
   *   ok = false : plateau = null et `raison` explique l'échec ; `echecs` compte les essais ratés par étape
   *   (forme, montagnes, villes, monoblocs, contact, inventaire, controles).
   */
  function generer(graine, options) {
    var R = reglages(options);
    var res = {
      ok: false, plateau: null, score: null, raison: null, forme: null, essais: 0, formesEssayees: 0, tiragesForme: 0,
      echecs: { forme: 0, montagnes: 0, villes: 0, monoblocs: 0, contact: 0, inventaire: 0, controles: 0 }, controles: null
    };
    if (C.REGLAGES.mesuresContact.indexOf(R.mesureContact) === -1) { res.raison = 'Mesure de contact inconnue.'; return res; }
    if (!Number.isInteger(R.seuilContact) || R.seuilContact < 0 || R.seuilContact > 6) { res.raison = 'Seuil de contact invalide.'; return res; }
    if (!Number.isInteger(R.tentatives) || R.tentatives < 1) { res.raison = 'Nombre de tentatives invalide.'; return res; }
    // Échec immédiat et nommé si le catalogue ou le rayon sort de ce que le générateur sait poser.
    var cause = incompatibilite(R);
    if (cause) { res.raison = cause; res.incompatible = true; return res; }
    var graineUtile = (typeof graine === 'number' || typeof graine === 'string') ? graine : 0;
    var alea = AT.alea.creer(graineUtile);
    var optionsControles = { seuilContact: R.seuilContact, mesureContact: R.mesureContact, ecartVilles: R.ecartVilles, couts: R.couts };
    var meilleur = null;

    for (var f = 0; f < R.formes && !meilleur; f++) {
      var forme = tirerForme(alea, R);
      res.tiragesForme += forme.tirages;
      if (!forme.ok) { res.echecs.forme += 1; break; }
      res.formesEssayees += 1;
      var G = indexer(forme.cases);
      for (var t = 0; t < R.tentatives; t++) {
        res.essais += 1;
        var r = essai(G, alea, R);
        if (r.echec) { res.echecs[r.echec] += 1; continue; }
        if (meilleur && r.score >= meilleur.score) continue;
        // Un candidat ne devient le meilleur que s'il passe les contrôles et épuise le stock.
        var plateau = construire(graineUtile, r);
        var bilan = K.tout(plateau, optionsControles);
        var stock = P.stock(plateau);
        var complet = C.ORDRE_MODELES.every(function (id) { return stock[id].restant === 0; });
        if (!bilan.ok || !complet || bilan.equilibre.score !== r.score) { res.echecs.controles += 1; continue; }
        meilleur = { score: r.score, plateau: plateau, controles: bilan, forme: forme.cases.join(' ') };
        if (meilleur.score === 0) break;
      }
    }

    if (!meilleur) {
      var e = res.echecs;
      res.raison = e.forme && !res.essais
        ? 'Aucune forme de bord valide en ' + res.tiragesForme + ' tirages (seuil de contact ' + R.seuilContact + ').'
        : 'Aucun plateau valide en ' + res.essais + ' essais (échecs : montagnes ' + e.montagnes + ', villes ' + e.villes + ', monoblocs ' + e.monoblocs
          + ', contact ' + e.contact + ', inventaire ' + e.inventaire + ', contrôles ' + e.controles + (e.forme ? ', forme ' + e.forme : '') + ').';
      return res;
    }
    res.ok = true;
    res.plateau = meilleur.plateau;
    res.score = meilleur.score;
    res.forme = meilleur.forme;
    res.controles = meilleur.controles;
    return res;
  }

  AT.generateur = { generer: generer, tirerForme: tirerForme, formeValide: formeValide, reglages: reglages, incompatibilite: incompatibilite };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.generateur;
})();
