/*
 * rendu.js : dessin du plateau en SVG et petites aides de construction du DOM (lot C, interface).
 * Dépend de AT.hex, AT.catalogue, AT.plateau.
 *
 * Deux parties :
 *   1. géométrie PURE (testée sous Node) : arêtes de contour d'une pièce, case sous un point, cadre ;
 *   2. construction DOM / SVG (navigateur seulement) : motifs de terrain, scène du plateau, vue avec zoom,
 *      déplacement et curseur au clavier, SVG autonome pour l'export, conversion en PNG.
 *
 * Règle de sécurité (CSP stricte) : aucun innerHTML, aucun attribut style. Les couleurs, traits et motifs
 * du plateau sont des ATTRIBUTS SVG (le fichier exporté est donc autonome) ; les classes CSS ne servent
 * qu'aux états d'interface (surbrillance, sélection, fantôme, curseur).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;

  /** Largeur d'une case (plat à plat) en unités de dessin. */
  var PLAT = 60;
  var NS_SVG = 'http://www.w3.org/2000/svg';
  var POLICE = 'Segoe UI, Arial, Helvetica, sans-serif';
  var COULEURS_CAMPS = { vert: '#007A4D', rouge: '#D8321C' };
  var NOMS_CAMPS = { vert: 'Vert', rouge: 'Rouge' };
  var INITIALES_CAMPS = { vert: 'V', rouge: 'R' };
  var COULEUR_NEUTRE = '#8A6400';        // liseré et pastille des villes neutres

  /**
   * L'arête n° i d'une case va du sommet i au sommet i + 1 (AT.hex.sommets, à partir du sommet du haut).
   * ARETE_DIR[i] est l'indice, dans AT.hex.DIRS, de la voisine qui partage cette arête.
   */
  var ARETE_DIR = [1, 0, 5, 4, 3, 2];

  /** Terrains : nom affiché, couleur de fond, motif (formes dessinées dans un carreau répété de côté `pas`). */
  var TERRAINS = {
    plaine: { nom: 'Plaine', fond: '#EFE4A8', pas: 20, formes: [['path', { d: 'M4 14 l2 -5 M14 7 l2 -5', stroke: '#A8964A', 'stroke-width': 1.3, fill: 'none', 'stroke-linecap': 'round' }]] },
    foret: { nom: 'Forêt', fond: '#A8CC8C', pas: 18, formes: [['path', { d: 'M4 14 l5 -10 l5 10 z', fill: '#3F7A38' }]] },
    marais: { nom: 'Marais', fond: '#A7D3DB', pas: 18, formes: [['path', { d: 'M0 5 q2.5 -3 5 0 t5 0 M8 13 q2.5 -3 5 0 t5 0', stroke: '#2F6F84', 'stroke-width': 1.4, fill: 'none' }]] },
    montagne: { nom: 'Montagne', fond: '#A39E99', pas: 18, formes: [['path', { d: 'M3 15 l6 -11 l6 11', stroke: '#3E3A36', 'stroke-width': 2.2, fill: 'none', 'stroke-linejoin': 'round' }]] },
    ville: { nom: 'Ville', fond: '#F6F2EA', pas: 12, formes: [['path', { d: 'M0 0.5 h12 M0.5 0 v12', stroke: '#D2C9B8', 'stroke-width': 1, fill: 'none' }]] },
    boue: { nom: 'Boue', fond: '#B08D62', pas: 14, formes: [['circle', { cx: 4, cy: 4, r: 1.8, fill: '#5E4426' }], ['circle', { cx: 11, cy: 10, r: 1.8, fill: '#5E4426' }]] },
    crevasse: { nom: 'Crevasse', fond: '#4A4744', pas: 16, formes: [['path', { d: 'M0 8 l4 -5 l4 8 l4 -8 l4 5', stroke: '#EDE9E4', 'stroke-width': 1.6, fill: 'none' }]] },
    tunnel: { nom: 'Tunnel', fond: '#C9C3BC', pas: 18, formes: [['path', { d: 'M4 15 v-6 a5 5 0 0 1 10 0 v6', stroke: '#35322F', 'stroke-width': 2, fill: 'none' }]] },
    terre_brulee: { nom: 'Terre brûlée', fond: '#9A7C6A', pas: 14, formes: [['path', { d: 'M4 4 l5 5 M9 4 l-5 5', stroke: '#2B1D16', 'stroke-width': 1.5, fill: 'none' }]] },
    eboulement: { nom: 'Éboulement', fond: '#7C7772', pas: 14, formes: [['circle', { cx: 5, cy: 5, r: 3.2, fill: '#B5AFA8', stroke: '#2B2826', 'stroke-width': 1 }], ['circle', { cx: 11, cy: 11, r: 2, fill: '#B5AFA8', stroke: '#2B2826', 'stroke-width': 1 }]] },
    chaussee: { nom: 'Chaussée', fond: '#DCC79A', pas: 16, formes: [['path', { d: 'M0 4 h16 M0 12 h16 M5 4 v8 M13 12 v8 M13 0 v4', stroke: '#806A36', 'stroke-width': 1.3, fill: 'none' }]] },
    campement: { nom: 'Campement', fond: '#F3D9A0', pas: 20, formes: [['path', { d: 'M4 15 l6 -10 l6 10 z', stroke: '#6E421A', 'stroke-width': 1.5, fill: '#FFF6DD' }], ['path', { d: 'M10 15 v-5', stroke: '#6E421A', 'stroke-width': 1.5 }]] }
  };
  var ORDRE_TERRAINS = ['plaine', 'foret', 'marais', 'montagne', 'ville'];

  // ================================================================== 1. géométrie pure

  function arrondi(x) { return Math.round(x * 100) / 100; }

  /** Sommets de la case `cle`, en unités de dessin. */
  function sommetsCase(cle, plat) {
    var p = H.decle(cle), c = H.centre(p.q, p.r, plat || PLAT);
    return H.sommets(c.x, c.y, plat || PLAT);
  }

  /**
   * Arêtes de contour d'un groupe de cases : celles dont la voisine n'est pas dans le groupe.
   * Renvoie [{x1, y1, x2, y2, cle, dir}] (dir : indice dans AT.hex.DIRS de la voisine extérieure).
   */
  function aretesContour(cles, plat) {
    var dans = {}, res = [];
    cles.forEach(function (k) { dans[k] = true; });
    cles.forEach(function (k) {
      var s = sommetsCase(k, plat), v = H.voisines(k);
      for (var i = 0; i < 6; i++) {
        if (dans[v[ARETE_DIR[i]]] === true) continue;
        var a = s[i], b = s[(i + 1) % 6];
        res.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, cle: k, dir: ARETE_DIR[i] });
      }
    });
    return res;
  }

  /** Clé de la case qui contient le point (x, y) en unités de dessin (que la case existe ou non). */
  function pointVersCase(x, y, plat) {
    var t = plat || PLAT;
    var zf = y / (t * Math.sqrt(3) / 2), xf = x / t - zf / 2, yf = -xf - zf;
    var rx = Math.round(xf), ry = Math.round(yf), rz = Math.round(zf);
    var dx = Math.abs(rx - xf), dy = Math.abs(ry - yf), dz = Math.abs(rz - zf);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy <= dz) rz = -rx - ry;
    return H.cle(rx + 0, rz + 0);
  }

  /** Rectangle englobant un groupe de cases : {x, y, l, h}, avec une marge. Groupe vide : cadre autour de (0,0). */
  function cadre(cles, plat, marge) {
    var t = plat || PLAT, m = marge === undefined ? 0 : marge;
    var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    (cles.length ? cles : ['0,0']).forEach(function (k) {
      sommetsCase(k, t).forEach(function (s) {
        x1 = Math.min(x1, s.x); y1 = Math.min(y1, s.y); x2 = Math.max(x2, s.x); y2 = Math.max(y2, s.y);
      });
    });
    return { x: x1 - m, y: y1 - m, l: x2 - x1 + 2 * m, h: y2 - y1 + 2 * m };
  }

  /** Case atteinte depuis `cle` par une flèche du clavier ('gauche', 'droite', 'haut', 'bas'), en restant à peu près d'aplomb. */
  function caseVoisineFleche(cle, sens) {
    var p = H.decle(cle), impair = (p.r & 1) === 1;
    if (sens === 'gauche') return H.cle(p.q - 1, p.r);
    if (sens === 'droite') return H.cle(p.q + 1, p.r);
    if (sens === 'haut') return H.cle(p.q + (impair ? 0 : 1), p.r - 1);
    if (sens === 'bas') return H.cle(p.q - (impair ? 1 : 0), p.r + 1);
    return cle;
  }

  /** Numéro de chaque ville (1, 2, 3… dans l'ordre de lecture) : {cle: numero}. */
  function numerosVilles(plateau) {
    var res = {};
    P.villes(plateau).forEach(function (k, i) { res[k] = i + 1; });
    return res;
  }

  // ================================================================== 2. DOM et SVG

  function appliquer(e, attrs) {
    if (!attrs) return;
    Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) return;
      if (k === 'texte') e.textContent = String(v);
      else if (k === 'classe') e.setAttribute('class', v);
      else if (k === 'sur') Object.keys(v).forEach(function (t) { e.addEventListener(t, v[t]); });
      else if (k === 'style') throw new Error('attribut style interdit (CSP)');
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    });
  }

  function ajouter(e, enfants) {
    if (enfants === undefined || enfants === null || enfants === false) return;
    if (Array.isArray(enfants)) { enfants.forEach(function (x) { ajouter(e, x); }); return; }
    e.appendChild(typeof enfants === 'object' ? enfants : document.createTextNode(String(enfants)));
  }

  /** Élément HTML : el('button', {classe, texte, type, sur: {click: f}, ...attributs}, enfants). */
  function el(nom, attrs, enfants) {
    var e = document.createElement(nom);
    appliquer(e, attrs);
    ajouter(e, enfants);
    return e;
  }

  /** Élément SVG. */
  function svg(nom, attrs, enfants) {
    var e = document.createElementNS(NS_SVG, nom);
    appliquer(e, attrs);
    ajouter(e, enfants);
    return e;
  }

  /** Vide un élément. */
  function vider(e) { while (e.firstChild) e.removeChild(e.firstChild); }

  /**
   * Remplace le contenu d'un conteneur en gardant le focus du clavier au même rang parmi ses commandes
   * (sinon chaque redessin d'un panneau ferait perdre sa place à l'utilisateur au clavier).
   */
  function remplacer(conteneur, enfants) {
    var SELECTEUR = 'button, input, select, textarea, summary';
    var actif = document.activeElement, rang = -1;
    if (actif && conteneur.contains(actif)) rang = Array.prototype.indexOf.call(conteneur.querySelectorAll(SELECTEUR), actif);
    vider(conteneur);
    ajouter(conteneur, enfants);
    if (rang >= 0) {
      var liste = conteneur.querySelectorAll(SELECTEUR);
      var cible = liste[Math.min(rang, liste.length - 1)];
      if (cible && !cible.disabled) cible.focus();
    }
  }

  var compteurPrefixe = 0;
  function nouveauPrefixe() { compteurPrefixe += 1; return 'at' + compteurPrefixe + '-'; }

  /** <defs> avec un motif par terrain ; les identifiants portent un préfixe propre à chaque dessin. */
  function definitions(prefixe, terrains) {
    var defs = svg('defs');
    (terrains || Object.keys(TERRAINS)).forEach(function (t) {
      var d = TERRAINS[t];
      if (!d) return;
      var motif = svg('pattern', { id: prefixe + t, width: d.pas, height: d.pas, patternUnits: 'userSpaceOnUse' });
      motif.appendChild(svg('rect', { x: 0, y: 0, width: d.pas, height: d.pas, fill: d.fond }));
      d.formes.forEach(function (f) { motif.appendChild(svg(f[0], f[1])); });
      defs.appendChild(motif);
    });
    return defs;
  }

  function remplissage(prefixe, terrain) {
    return possede.call(TERRAINS, terrain) ? 'url(#' + prefixe + terrain + ')' : '#FFFFFF';
  }

  function pointsPolygone(sommets) {
    return sommets.map(function (s) { return arrondi(s.x) + ',' + arrondi(s.y); }).join(' ');
  }

  /** Polygone de la case `cle` ; `retrait` (0 à 1) le réduit vers son centre. */
  function polygoneCase(cle, attrs, retrait) {
    var s = sommetsCase(cle, PLAT);
    if (retrait) {
      var p = H.decle(cle), c = H.centre(p.q, p.r, PLAT);
      s = s.map(function (x) { return { x: c.x + (x.x - c.x) * (1 - retrait), y: c.y + (x.y - c.y) * (1 - retrait) }; });
    }
    var poly = svg('polygon', { points: pointsPolygone(s) });
    appliquer(poly, attrs);
    return poly;
  }

  function texteSvg(x, y, contenu, attrs) {
    var t = svg('text', { x: arrondi(x), y: arrondi(y), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': POLICE, texte: contenu });
    appliquer(t, attrs);
    return t;
  }

  function cheminContour(cles) {
    return aretesContour(cles, PLAT).map(function (a) {
      return 'M' + arrondi(a.x1) + ' ' + arrondi(a.y1) + 'L' + arrondi(a.x2) + ' ' + arrondi(a.y2);
    }).join('');
  }

  /**
   * Dessine une scène dans le groupe `racine` (vidé d'abord). scene :
   *   plateau       : le plateau à dessiner (obligatoire) ;
   *   etiquettes    : {cle: texte} écrit en bas de la case (contacts, rations…) ;
   *   pions         : [{cle, joueur, numero}] pions Bataillon ;
   *   proprietaires : {cle: 'vert' | 'rouge'} villes capturées.
   */
  function dessinerScene(racine, scene, prefixe) {
    vider(racine);
    var plateau = scene.plateau, toutes = P.cases(plateau), cles = H.trier(Object.keys(toutes));
    var gCases = svg('g'), gContours = svg('g'), gDessus = svg('g');

    // Cases : couleur et motif du terrain effectif. Sous une ville de déploiement, la Plaine d'origine reste
    // dessinée : la ville est une tuile posée PAR-DESSUS (voir decorTuile).
    cles.forEach(function (k) {
      gCases.appendChild(polygoneCase(k, { fill: remplissage(prefixe, toutes[k].ville ? toutes[k].origine : toutes[k].terrain), stroke: '#6E6A58', 'stroke-width': 1 }));
    });

    // Contour épais autour de chaque monobloc ; plus épais encore pour le noyau.
    var parPiece = Object.create(null);      // indexé par un identifiant venu d'un fichier (« constructor », « toString »…)
    cles.forEach(function (k) { (parPiece[toutes[k].piece] = parPiece[toutes[k].piece] || []).push(k); });
    Object.keys(parPiece).forEach(function (id) {
      var groupe = parPiece[id];
      if (groupe.length < 2) return;
      var m = P.modele(plateau, toutes[groupe[0]].modele), noyau = !!(m && m.noyau);
      gContours.appendChild(svg('path', {
        d: cheminContour(groupe), fill: 'none', stroke: noyau ? '#5B2A86' : '#1F1F1F',
        'stroke-width': noyau ? 6 : 4, 'stroke-linecap': 'round'
      }));
    });

    // Tuiles d'événement : hexagone intérieur en tirets et identifiant.
    cles.forEach(function (k) {
      if (!toutes[k].evenement) return;
      var p = H.decle(k), c = H.centre(p.q, p.r, PLAT);
      gDessus.appendChild(polygoneCase(k, { fill: 'none', stroke: '#111111', 'stroke-width': 2.5, 'stroke-dasharray': '6 4' }, 0.16));
      gDessus.appendChild(svg('rect', { x: arrondi(c.x - 11), y: arrondi(c.y - 9), width: 22, height: 18, rx: 4, fill: '#FFFFFF', stroke: '#111111', 'stroke-width': 1.2 }));
      gDessus.appendChild(texteSvg(c.x, c.y, toutes[k].evenement, { 'font-size': 12, 'font-weight': 'bold', fill: '#111111' }));
    });

    // Tuiles particulières du catalogue 2 : ville de déploiement posée par-dessus, ville neutre, remplissage.
    cles.forEach(function (k) {
      var type = typeTuile(toutes[k]);
      if (type) decorTuile(gDessus, k, type, prefixe);
    });

    // Pions par case (pour décaler la pastille d'une ville occupée).
    var pionsParCase = {};
    (scene.pions || []).forEach(function (pion) { (pionsParCase[pion.cle] = pionsParCase[pion.cle] || []).push(pion); });

    // Villes : pastille numérotée ; ville de déploiement à la couleur de son camp, avec son initiale.
    var numeros = numerosVilles(plateau), camps = plateau.camps || { vert: [], rouge: [] };
    Object.keys(numeros).forEach(function (k) {
      if (!possede.call(toutes, k)) return;
      var p = H.decle(k), c = H.centre(p.q, p.r, PLAT), occupee = !!pionsParCase[k];
      var camp = camps.vert.indexOf(k) !== -1 ? 'vert' : (camps.rouge.indexOf(k) !== -1 ? 'rouge' : null);
      var y = occupee ? c.y - 15 : c.y, r = occupee ? 11 : 15;
      if (camp) {
        gDessus.appendChild(svg('circle', { cx: arrondi(c.x), cy: arrondi(y), r: r + 3, fill: COULEURS_CAMPS[camp], stroke: '#FFFFFF', 'stroke-width': 2 }));
        gDessus.appendChild(texteSvg(c.x, y - (occupee ? 0 : 3), String(numeros[k]), { 'font-size': occupee ? 12 : 14, 'font-weight': 'bold', fill: '#FFFFFF' }));
        if (!occupee) gDessus.appendChild(texteSvg(c.x, y + 10, INITIALES_CAMPS[camp], { 'font-size': 9, 'font-weight': 'bold', fill: '#FFFFFF' }));
      } else {
        var neutre = toutes[k].modele === 'VN' || toutes[k].camp === 'neutre';
        gDessus.appendChild(svg('circle', { cx: arrondi(c.x), cy: arrondi(y), r: r, fill: '#FFFFFF', stroke: neutre ? COULEUR_NEUTRE : '#1F1F1F', 'stroke-width': neutre ? 3 : 2 }));
        gDessus.appendChild(texteSvg(c.x, y - (neutre && !occupee ? 3 : 0), String(numeros[k]), { 'font-size': occupee ? 12 : (neutre ? 13 : 15), 'font-weight': 'bold', fill: '#111111' }));
        if (neutre && !occupee) gDessus.appendChild(texteSvg(c.x, y + 9, 'N', { 'font-size': 8, 'font-weight': 'bold', fill: COULEUR_NEUTRE }));
      }
      var proprio = scene.proprietaires && possede.call(scene.proprietaires, k) ? scene.proprietaires[k] : null;
      if (proprio && COULEURS_CAMPS[proprio]) {      // fanion du propriétaire, en haut à droite de la case
        gDessus.appendChild(svg('rect', { x: arrondi(c.x + 9), y: arrondi(c.y - 29), width: 15, height: 13, fill: COULEURS_CAMPS[proprio], stroke: '#FFFFFF', 'stroke-width': 1.5 }));
        gDessus.appendChild(texteSvg(c.x + 16.5, c.y - 22.5, INITIALES_CAMPS[proprio], { 'font-size': 9, 'font-weight': 'bold', fill: '#FFFFFF' }));
      }
    });

    // Étiquettes facultatives (contacts, rations, coordonnées).
    if (scene.etiquettes) {
      Object.keys(scene.etiquettes).forEach(function (k) {
        if (!H.estCle(k)) return;
        var p = H.decle(k), c = H.centre(p.q, p.r, PLAT);
        gDessus.appendChild(texteSvg(c.x, c.y + 23, String(scene.etiquettes[k]), {
          'font-size': 11, 'font-weight': 'bold', fill: '#111111', stroke: '#FFFFFF', 'stroke-width': 3, 'paint-order': 'stroke'
        }));
      });
    }

    // Pions Bataillon : carré arrondi à la couleur du camp, « V2 » ou « R3 ».
    Object.keys(pionsParCase).forEach(function (k) {
      if (!H.estCle(k)) return;
      var p = H.decle(k), c = H.centre(p.q, p.r, PLAT), liste = pionsParCase[k];
      var surVille = possede.call(numeros, k);
      liste.forEach(function (pion, i) {
        var x = c.x + (i - (liste.length - 1) / 2) * 20, y = surVille ? c.y + 13 : c.y, t = surVille ? 22 : 26;
        gDessus.appendChild(svg('rect', { x: arrondi(x - t / 2), y: arrondi(y - t / 2), width: t, height: t, rx: 5, fill: COULEURS_CAMPS[pion.joueur] || '#444444', stroke: '#FFFFFF', 'stroke-width': 2 }));
        gDessus.appendChild(svg('rect', { x: arrondi(x - t / 2 - 1), y: arrondi(y - t / 2 - 1), width: t + 2, height: t + 2, rx: 6, fill: 'none', stroke: '#111111', 'stroke-width': 1 }));
        gDessus.appendChild(texteSvg(x, y, (INITIALES_CAMPS[pion.joueur] || '?') + pion.numero, { 'font-size': surVille ? 11 : 13, 'font-weight': 'bold', fill: '#FFFFFF' }));
      });
    });

    racine.appendChild(gCases);
    racine.appendChild(gContours);
    racine.appendChild(gDessus);
  }

  /** Type de tuile particulière d'une case de AT.plateau.cases() : 'vd-vert', 'vd-rouge', 'vn-plaine', 'vn', 'remplissage', ou null. */
  function typeTuile(c) {
    if (!c) return null;
    if (c.ville && (c.camp === 'vert' || c.camp === 'rouge')) return 'vd-' + c.camp;
    if (c.ville && c.camp === 'neutre') return 'vn-plaine';
    if (c.modele === 'VN') return 'vn';
    if (c.modele === 'R') return 'remplissage';
    return null;
  }

  /**
   * Dessin d'une tuile particulière sur la case `cle`, tout en attributs SVG (l'export reste autonome) :
   *   'vd-vert' / 'vd-rouge' : ville de déploiement, tuile plus petite posée PAR-DESSUS la Plaine (qui reste visible
   *                            autour), bordée d'un liseré à la couleur du camp ;
   *   'vn-plaine'            : ville neutre, tuile plus petite posée PAR-DESSUS la Plaine, à double liseré doré (elle
   *                            se distingue d'une ville de déploiement par sa couleur et son double trait) ;
   *   'vn'                   : ville neutre des règles précédentes (pièce VN), tuile entière à double liseré doré ;
   *   'remplissage'          : tuile de remplissage, Plaine d'une case à liseré pointillé et point central.
   */
  function decorTuile(g, cle, type, prefixe) {
    var p = H.decle(cle), c = H.centre(p.q, p.r, PLAT);
    if (type === 'vd-vert' || type === 'vd-rouge') {
      var couleur = COULEURS_CAMPS[type === 'vd-vert' ? 'vert' : 'rouge'];
      g.appendChild(polygoneCase(cle, { fill: '#000000', 'fill-opacity': 0.28, stroke: 'none' }, 0.15));                     // ombre : la tuile est posée dessus
      g.appendChild(polygoneCase(cle, { fill: remplissage(prefixe, 'ville'), stroke: couleur, 'stroke-width': 4, 'stroke-linejoin': 'round' }, 0.22));
    } else if (type === 'vn-plaine') {
      g.appendChild(polygoneCase(cle, { fill: '#000000', 'fill-opacity': 0.28, stroke: 'none' }, 0.15));
      g.appendChild(polygoneCase(cle, { fill: remplissage(prefixe, 'ville'), stroke: COULEUR_NEUTRE, 'stroke-width': 4, 'stroke-linejoin': 'round' }, 0.22));
      g.appendChild(polygoneCase(cle, { fill: 'none', stroke: '#FFFFFF', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }, 0.22));
    } else if (type === 'vn') {
      g.appendChild(polygoneCase(cle, { fill: 'none', stroke: COULEUR_NEUTRE, 'stroke-width': 4, 'stroke-linejoin': 'round' }, 0.07));
      g.appendChild(polygoneCase(cle, { fill: 'none', stroke: COULEUR_NEUTRE, 'stroke-width': 1.5 }, 0.2));
    } else if (type === 'remplissage') {
      g.appendChild(polygoneCase(cle, { fill: 'none', stroke: '#5E4A12', 'stroke-width': 2.5, 'stroke-dasharray': '3 5', 'stroke-linecap': 'round' }, 0.14));
      g.appendChild(svg('circle', { cx: arrondi(c.x), cy: arrondi(c.y), r: 4, fill: '#5E4A12' }));
    }
  }

  /** Cadre d'affichage d'un plateau : ses cases, l'hexagone de départ (rayon 5) et la grille vide affichée, avec une marge. */
  function cadrePlateau(plateau, marge, grille) {
    var cles = Object.keys(P.cases(plateau)).concat(H.disque(C.REGLAGES.generateur.rayon), grille || []);
    return cadre(cles, PLAT, marge === undefined ? 24 : marge);
  }

  /**
   * Cases VIDES de la grille de création : celles du disque de rayon `rayon` autour de (0,0) que le plateau
   * n'occupe pas (liste de clés). Fonction pure.
   */
  function casesGrille(plateau, rayon) {
    var occupees = P.cases(plateau, { sansRecouvrements: true });
    return H.disque(rayon).filter(function (k) { return !possede.call(occupees, k); });
  }

  /** Dessine la grille vide (cases fantômes discrètes) dans le groupe `racine`, tout en attributs SVG. */
  function dessinerGrille(racine, cles) {
    vider(racine);
    (cles || []).forEach(function (k) {
      if (H.estCle(k)) racine.appendChild(polygoneCase(k, { fill: '#FBFAF6', stroke: '#B9B4A3', 'stroke-width': 1, 'stroke-dasharray': '3 5' }, 0.05));
    });
  }

  /**
   * Vue interactive d'un plateau. options :
   *   etiquette        : texte lu par les lecteurs d'écran ;
   *   surClic(cle)     : clic ou touche Entrée sur une case (existante ou non) ;
   *   surSurvol(cle)   : case sous la souris ou sous le curseur du clavier (null quand la souris sort) ;
   *   surAppui(cle, ev): FACULTATIF. Appelé quand le bouton gauche s'enfonce sur une case (sans la touche Maj).
   *                      S'il renvoie un geste {bouger(cle), finir(cle, aBouge), annuler()}, le glissement lui est
   *                      confié (pinceau, déplacement d'une pièce) au lieu de déplacer la vue, et le clic qui suit
   *                      n'appelle pas surClic. S'il renvoie null, rien ne change : glisser déplace la vue.
   *                      Maj + glisser déplace toujours la vue.
   * La scène peut porter `grille` : clés de cases vides à dessiner en cases fantômes (jamais exportées).
   * Renvoie {element, barre, svg, afficher(scene), marquer(nom, cles, classe, attrs), cadrer(), zoomer(facteur),
   *          pointEcran(cle), caseSousEcran(x, y), curseur()}.
   */
  function creerVue(options) {
    var prefixe = nouveauPrefixe();
    var gScene = svg('g'), gGrille = svg('g', { classe: 'at-grille-vide' }), gInterface = svg('g', { classe: 'at-interface' });   // la grille vide ne s'imprime pas (styles/base.css)
    var racine = svg('svg', {
      classe: 'at-plateau-svg', tabindex: 0, role: 'application', focusable: 'true',
      'aria-label': (options.etiquette || 'Plateau') + ' Flèches : déplacer le curseur ; Entrée : agir sur la case ; + et − : zoom ; 0 : tout voir.'
    }, [definitions(prefixe), gScene, gGrille, gInterface]);
    var vb = { x: -400, y: -400, l: 800, h: 800 }, cadreScene = vb, scene = null;
    var couches = {}, curseur = '0,0', curseurVisible = false, survol = null;
    var appui = null, glisse = false;
    var geste = null, gesteCle = null, gesteBouge = false, avalerClic = false;

    function appliquerVue() { racine.setAttribute('viewBox', [vb.x, vb.y, vb.l, vb.h].map(arrondi).join(' ')); }

    function cadrer() {
      vb = { x: cadreScene.x, y: cadreScene.y, l: cadreScene.l, h: cadreScene.h };
      appliquerVue();
    }

    /** Zoom d'un facteur (> 1 : on s'approche) autour d'un point du dessin (centre de la vue par défaut). */
    function zoomer(facteur, centre) {
      var c = centre || { x: vb.x + vb.l / 2, y: vb.y + vb.h / 2 };
      var l = Math.max(cadreScene.l / 8, Math.min(cadreScene.l * 2, vb.l / facteur)), f = l / vb.l;
      vb = { x: c.x - (c.x - vb.x) * f, y: c.y - (c.y - vb.y) * f, l: l, h: vb.h * f };
      appliquerVue();
    }

    function pointDessin(clientX, clientY) {
      var m = racine.getScreenCTM();
      if (!m) return null;
      var p = racine.createSVGPoint();
      p.x = clientX; p.y = clientY;
      return p.matrixTransform(m.inverse());
    }

    function cleSousPoint(clientX, clientY) {
      var p = pointDessin(clientX, clientY);
      return p ? pointVersCase(p.x, p.y, PLAT) : null;
    }

    /** Position à l'écran du centre d'une case (pour la recette automatique). */
    function pointEcran(cle) {
      var q = H.decle(cle), c = H.centre(q.q, q.r, PLAT), m = racine.getScreenCTM(), p = racine.createSVGPoint();
      p.x = c.x; p.y = c.y;
      return m ? p.matrixTransform(m) : null;
    }

    /** Case sous un point de l'écran, ou null si le point est hors du dessin (glisser-déposer depuis la palette). */
    function caseSousEcran(clientX, clientY) {
      var b = racine.getBoundingClientRect();
      if (clientX < b.left || clientX > b.right || clientY < b.top || clientY > b.bottom) return null;
      return cleSousPoint(clientX, clientY);
    }

    /**
     * Remplace les cases d'une couche d'interface (surbrillance, sélection, fantôme…).
     * `attrs` (facultatif) : attributs SVG posés sur chaque case (couleurs de l'aperçu fantôme).
     */
    function marquer(nom, cles, classe, attrs) {
      if (!couches[nom]) { couches[nom] = svg('g'); gInterface.appendChild(couches[nom]); }
      vider(couches[nom]);
      (cles || []).forEach(function (k) {
        if (!H.estCle(k)) return;
        var poly = polygoneCase(k, { classe: classe }, 0.06);
        appliquer(poly, attrs);
        couches[nom].appendChild(poly);
      });
    }

    function dessinerCurseur() { marquer('curseur', curseurVisible ? [curseur] : [], 'at-curseur'); }

    function afficher(nouvelleScene, garderVue) {
      var premiere = scene === null;
      scene = nouvelleScene;
      dessinerScene(gScene, scene, prefixe);
      dessinerGrille(gGrille, scene.grille);
      cadreScene = cadrePlateau(scene.plateau, undefined, scene.grille || []);
      if (premiere || !garderVue) cadrer();
    }

    function signalerSurvol(cle) {
      if (cle === survol) return;
      survol = cle;
      if (options.surSurvol) options.surSurvol(cle);
    }

    racine.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      var p = pointDessin(ev.clientX, ev.clientY);
      zoomer(ev.deltaY < 0 ? 1.2 : 1 / 1.2, p ? { x: p.x, y: p.y } : null);
    }, { passive: false });

    racine.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      avalerClic = false;
      if (options.surAppui && !ev.shiftKey) {
        var cle = cleSousPoint(ev.clientX, ev.clientY);
        geste = cle ? (options.surAppui(cle, ev) || null) : null;
        if (geste) {
          gesteCle = cle; gesteBouge = false;
          try { racine.setPointerCapture(ev.pointerId); } catch (e) { /* sans capture, le geste s'arrête au bord */ }
          return;
        }
      }
      appui = { x: ev.clientX, y: ev.clientY, vx: vb.x, vy: vb.y };
      glisse = false;
    });
    racine.addEventListener('pointermove', function (ev) {
      if (geste) {
        var k = cleSousPoint(ev.clientX, ev.clientY);
        if (k && k !== gesteCle) { gesteCle = k; gesteBouge = true; if (geste.bouger) geste.bouger(k); }
        return;
      }
      if (appui) {
        var dx = ev.clientX - appui.x, dy = ev.clientY - appui.y;
        if (!glisse && Math.abs(dx) + Math.abs(dy) < 6) return;
        if (!glisse) { glisse = true; try { racine.setPointerCapture(ev.pointerId); } catch (e) { /* sans capture, le glissement s'arrête au bord */ } }
        var m = racine.getScreenCTM(), echelle = m ? m.a : 1;
        vb.x = appui.vx - dx / echelle;
        vb.y = appui.vy - dy / echelle;
        appliquerVue();
        return;
      }
      signalerSurvol(cleSousPoint(ev.clientX, ev.clientY));
    });
    racine.addEventListener('pointerup', function () {
      appui = null;
      if (!geste) return;
      var g = geste;
      geste = null;
      // Le navigateur envoie un clic juste après : il appartient au geste, pas à surClic.
      avalerClic = true;
      setTimeout(function () { avalerClic = false; }, 0);
      if (g.finir) g.finir(gesteCle, gesteBouge);
    });
    racine.addEventListener('pointercancel', function () {
      appui = null;
      if (!geste) return;
      var g = geste;
      geste = null;
      if (g.annuler) g.annuler();
    });
    racine.addEventListener('pointerleave', function () { if (!appui && !geste) signalerSurvol(null); });
    racine.addEventListener('click', function (ev) {
      if (avalerClic) { avalerClic = false; return; }  // fin d'un geste (trait de pinceau, pièce déplacée)
      if (glisse) { glisse = false; return; }          // fin d'un déplacement de la vue : pas un clic sur une case
      var cle = cleSousPoint(ev.clientX, ev.clientY);
      if (cle && options.surClic) options.surClic(cle);
    });

    var FLECHES = { ArrowLeft: 'gauche', ArrowRight: 'droite', ArrowUp: 'haut', ArrowDown: 'bas' };
    racine.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
      if (possede.call(FLECHES, ev.key)) {
        var suivante = caseVoisineFleche(curseur, FLECHES[ev.key]);
        if (H.distance(suivante, '0,0') <= C.REGLAGES.generateur.rayon + 4) curseur = suivante;
        curseurVisible = true;
        dessinerCurseur();
        signalerSurvol(curseur);
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        if (options.surClic) options.surClic(curseur);
      } else if (ev.key === '+' || ev.key === '=') { zoomer(1.2);
      } else if (ev.key === '-') { zoomer(1 / 1.2);
      } else if (ev.key === '0') { cadrer();
      } else { return; }
      ev.preventDefault();
    });
    racine.addEventListener('focus', function () { curseurVisible = true; dessinerCurseur(); });
    racine.addEventListener('blur', function () { curseurVisible = false; dessinerCurseur(); });

    var bouton = function (texte, titre, action) {
      return el('button', { type: 'button', classe: 'at-petit', title: titre, 'aria-label': titre, texte: texte, sur: { click: action } });
    };
    var barre = el('div', { classe: 'at-vue-barre' }, [
      bouton('+', 'Zoom avant', function () { zoomer(1.25); }),
      bouton('−', 'Zoom arrière', function () { zoomer(1 / 1.25); }),
      bouton('Tout voir', 'Recadrer le plateau entier', cadrer)
    ]);
    appliquerVue();

    return {
      element: el('div', { classe: 'at-vue' }, [barre, racine]), barre: barre, svg: racine,
      afficher: afficher, marquer: marquer, cadrer: cadrer, zoomer: zoomer, pointEcran: pointEcran,
      caseSousEcran: caseSousEcran,
      /** Vrai tant qu'un geste confié par surAppui est en cours (bouton enfoncé). */
      gesteEnCours: function () { return geste !== null; },
      curseur: function () { return curseur; }
    };
  }

  /**
   * Vignette d'un plateau (bibliothèque) : petit dessin SVG sans interaction, cadré sur ses cases.
   * options : largeur, hauteur (en pixels), titre (texte lu par les lecteurs d'écran).
   */
  function vignette(plateau, options) {
    var o = options || {}, prefixe = nouveauPrefixe();
    var c = cadre(Object.keys(P.cases(plateau)), PLAT, 8);
    var racine = svg('svg', {
      classe: 'at-vignette', width: o.largeur || 96, height: o.hauteur || 84,
      viewBox: [c.x, c.y, c.l, c.h].map(arrondi).join(' '), role: 'img', 'aria-label': o.titre || 'Vignette du plateau'
    });
    var g = svg('g');
    racine.appendChild(definitions(prefixe));
    racine.appendChild(g);
    dessinerScene(g, { plateau: plateau }, prefixe);
    return racine;
  }

  /**
   * SVG autonome d'une scène (export) : aucun élément d'interface, tout en attributs.
   * options.titre : ligne de texte sous le plateau. Renvoie {texte, largeur, hauteur}.
   */
  function svgAutonome(scene, options) {
    var prefixe = 'pl-', c = cadrePlateau(scene.plateau, 20), titre = options && options.titre;
    var hauteur = c.h + (titre ? 30 : 0);
    var racine = svg('svg', { xmlns: NS_SVG, width: Math.round(c.l), height: Math.round(hauteur), viewBox: [c.x, c.y, c.l, hauteur].map(arrondi).join(' ') });
    racine.appendChild(definitions(prefixe));
    racine.appendChild(svg('rect', { x: arrondi(c.x), y: arrondi(c.y), width: arrondi(c.l), height: arrondi(hauteur), fill: '#FFFFFF' }));
    var g = svg('g');
    racine.appendChild(g);
    dessinerScene(g, scene, prefixe);
    if (titre) racine.appendChild(texteSvg(c.x + c.l / 2, c.y + c.h + 10, titre, { 'font-size': 16, fill: '#111111' }));
    return { texte: new XMLSerializer().serializeToString(racine), largeur: Math.round(c.l), hauteur: Math.round(hauteur) };
  }

  /**
   * Convertit un SVG autonome en image PNG (dessin dans un canevas, sans rien charger d'extérieur).
   * rappel(blob) ; blob vaut null si le navigateur refuse.
   */
  function versPng(image, echelle, rappel) {
    var url = URL.createObjectURL(new Blob([image.texte], { type: 'image/svg+xml' }));
    var img = new Image(), fini = false;
    var finir = function (blob) { if (fini) return; fini = true; URL.revokeObjectURL(url); rappel(blob); };
    img.onload = function () {
      try {
        var canevas = document.createElement('canvas');
        canevas.width = Math.round(image.largeur * echelle);
        canevas.height = Math.round(image.hauteur * echelle);
        canevas.getContext('2d').drawImage(img, 0, 0, canevas.width, canevas.height);
        canevas.toBlob(function (blob) { finir(blob); }, 'image/png');
      } catch (e) { finir(null); }
    };
    img.onerror = function () { finir(null); };
    img.src = url;
  }

  /**
   * Petit dessin d'un modèle de pièce (inventaire, stock). options : rotation, echelle (0,4 par défaut), titre,
   * plateau (document où chercher une pièce personnelle ; inutile pour le catalogue de base, M1 compris).
   */
  function dessinModele(idModele, options) {
    var o = options || {}, prefixe = nouveauPrefixe(), echelle = o.echelle || 0.4;
    var cases = P.casesModele(idModele, 0, 0, o.rotation || 0, o.plateau);
    var cles = cases.map(function (c) { return c.cle; }), c = cadre(cles, PLAT, 5);
    var racine = svg('svg', {
      classe: 'at-dessin-piece', width: Math.round(c.l * echelle), height: Math.round(c.h * echelle),
      viewBox: [c.x, c.y, c.l, c.h].map(arrondi).join(' '), role: 'img', 'aria-label': o.titre || idModele
    });
    racine.appendChild(definitions(prefixe, cases.map(function (x) { return x.terrain; })));
    cases.forEach(function (x) {
      racine.appendChild(polygoneCase(x.cle, { fill: remplissage(prefixe, x.terrain), stroke: '#6E6A58', 'stroke-width': 1.5 }));
    });
    // Tuiles d'une case : mêmes repères que sur le plateau (remplissage, ville neutre des règles précédentes).
    if (idModele === 'R') decorTuile(racine, '0,0', 'remplissage', prefixe);
    if (idModele === 'VN') decorTuile(racine, '0,0', 'vn', prefixe);
    if (cles.length > 1) {
      var m = P.modele(o.plateau, idModele);
      racine.appendChild(svg('path', { d: cheminContour(cles), fill: 'none', stroke: m && m.noyau ? '#5B2A86' : '#1F1F1F', 'stroke-width': 5, 'stroke-linecap': 'round' }));
    }
    return racine;
  }

  /** Pastille de légende : une case du terrain donné ; `evenement` ajoute le cadre en tirets d'une tuile d'événement. */
  function pastilleTerrain(terrain, evenement) {
    var prefixe = nouveauPrefixe(), c = cadre(['0,0'], PLAT, 3), echelle = 0.34;
    var racine = svg('svg', {
      classe: 'at-pastille', width: Math.round(c.l * echelle), height: Math.round(c.h * echelle),
      viewBox: [c.x, c.y, c.l, c.h].map(arrondi).join(' '), 'aria-hidden': 'true'
    });
    racine.appendChild(definitions(prefixe, [terrain]));
    racine.appendChild(polygoneCase('0,0', { fill: remplissage(prefixe, terrain), stroke: '#6E6A58', 'stroke-width': 2 }));
    if (evenement) racine.appendChild(polygoneCase('0,0', { fill: 'none', stroke: '#111111', 'stroke-width': 4, 'stroke-dasharray': '8 5' }, 0.2));
    return racine;
  }

  /**
   * Pastille de légende d'une tuile particulière ('vd-vert', 'vd-rouge', 'vn', 'remplissage') : la même case que sur
   * le plateau, en petit. Pour une ville de déploiement, la Plaine du dessous est visible autour.
   */
  function pastilleTuile(type, echelle) {
    var prefixe = nouveauPrefixe(), c = cadre(['0,0'], PLAT, 3), e = echelle || 0.34;
    var racine = svg('svg', {
      classe: 'at-pastille', width: Math.round(c.l * e), height: Math.round(c.h * e),
      viewBox: [c.x, c.y, c.l, c.h].map(arrondi).join(' '), 'aria-hidden': 'true'
    });
    var fond = type === 'vn' ? 'ville' : 'plaine';
    racine.appendChild(definitions(prefixe, ['plaine', 'ville']));
    racine.appendChild(polygoneCase('0,0', { fill: remplissage(prefixe, fond), stroke: '#6E6A58', 'stroke-width': 2 }));
    decorTuile(racine, '0,0', type, prefixe);
    return racine;
  }

  /** Nom affiché d'un terrain. */
  function nomTerrain(terrain) { return possede.call(TERRAINS, terrain) ? TERRAINS[terrain].nom : String(terrain); }

  AT.rendu = {
    PLAT: PLAT, ARETE_DIR: ARETE_DIR, TERRAINS: TERRAINS, ORDRE_TERRAINS: ORDRE_TERRAINS,
    COULEURS_CAMPS: COULEURS_CAMPS, NOMS_CAMPS: NOMS_CAMPS,
    // géométrie pure
    aretesContour: aretesContour, pointVersCase: pointVersCase, cadre: cadre, caseVoisineFleche: caseVoisineFleche,
    numerosVilles: numerosVilles, nomTerrain: nomTerrain, casesGrille: casesGrille,
    // DOM et SVG
    el: el, svg: svg, vider: vider, remplacer: remplacer, polygoneCase: polygoneCase, definitions: definitions, remplissage: remplissage,
    nouveauPrefixe: nouveauPrefixe, cheminContour: cheminContour,
    creerVue: creerVue, svgAutonome: svgAutonome, versPng: versPng, dessinModele: dessinModele, pastilleTerrain: pastilleTerrain, pastilleTuile: pastilleTuile, typeTuile: typeTuile,
    vignette: vignette
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.rendu;
})();
