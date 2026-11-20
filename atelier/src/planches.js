/*
 * planches.js : planches d'impression des pièces du catalogue, à l'échelle réelle (page planches.html).
 * Dépend de AT.hex, AT.catalogue, AT.rendu (motifs de terrain, aides SVG). Rien n'est recopié du catalogue :
 * pièces, noms, quantités, villes et événements viennent de AT.catalogue.
 *
 * Deux parties :
 *   1. logique PURE (testée sous Node) : réglages lus dans l'adresse, liste des pièces à imprimer, contour
 *      extérieur d'un monobloc, rangement des pièces sur les planches, cartouche ;
 *   2. construction DOM / SVG (navigateur seulement) : une planche = un <svg> en millimètres.
 *
 * Unités : tout est en MILLIMÈTRES (le viewBox d'une planche est la feuille). Règles d'impression en vigueur
 * (tuiles/README.md) : tuile de 45 mm plat à plat, pointe en haut ; fond perdu 3 mm ; zone de sécurité 4 mm ;
 * texte ≥ 6 pt ; traits ≥ 0,25 mm ; barre de contrôle de 100 mm.
 *
 * Fond perdu : chaque case est redessinée en hexagone agrandi de 3 mm sous les vraies cases (même centre, même
 * motif). La forme avec fond perdu d'une pièce est donc la réunion d'hexagones de (plat + 6) mm.
 * Rangement : deux pièces sont assez écartées quand leurs hexagones agrandis de (fond perdu + 2 mm) ne se
 * touchent pas ; comme ils sont tous orientés pareil, le test est exact et se réduit à trois projections.
 *
 * Règle de sécurité (CSP stricte) : aucun innerHTML, aucun attribut style ; couleurs et traits en attributs SVG.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.rendu) require('./rendu.js');
  }
  var H = AT.hex, C = AT.catalogue, R = AT.rendu;

  // ================================================================== 1. logique pure

  /** Feuilles en portrait, en millimètres. */
  var FORMATS = { A3: { l: 297, h: 420 }, A4: { l: 210, h: 297 } };
  var PLAT_TUILE = 45;        // largeur d'une case, plat à plat
  var FOND_PERDU = 3;         // débord de la couleur au-delà du trait de coupe
  var SECURITE = 4;           // rien d'important à moins de 4 mm du trait de coupe
  var MARGE = 8;              // bord de la feuille laissé vide
  var ECART = 4;              // au moins 4 mm entre les fonds perdus de deux pièces
  var BARRE = 100;            // longueur de la barre de contrôle
  var CORPS = 2.3;            // taille des étiquettes (2,3 mm = 6,5 pt ; le minimum est 6 pt = 2,117 mm)
  var PAS = 1;                // pas de recherche du rangement, en millimètres
  var RACINE3 = Math.sqrt(3);
  var EPSILON = 1e-7;

  /** Réglages par défaut ; `ville` est la taille des tuiles de ville (45 ou 40 mm). */
  var DEFAUT = { format: 'A3', orientation: 'paysage', fond: true, etiquettes: true, ville: 45, terrain: true, villes: true, evenements: true };
  /** Valeurs admises dans l'adresse (#format=A3&orientation=paysage&fond=oui&etiquettes=oui&ville=45&terrain=oui&villes=oui&evenements=oui). */
  var ADMIS = {
    format: { A3: 'A3', A4: 'A4' }, orientation: { paysage: 'paysage', portrait: 'portrait' },
    fond: { oui: true, non: false }, etiquettes: { oui: true, non: false }, ville: { '45': 45, '40': 40 },
    terrain: { oui: true, non: false }, villes: { oui: true, non: false }, evenements: { oui: true, non: false }
  };
  var CLES = ['format', 'orientation', 'fond', 'etiquettes', 'ville', 'terrain', 'villes', 'evenements'];
  var possede = Object.prototype.hasOwnProperty;

  /** Réglages lus dans le fragment d'adresse ; tout ce qui n'est pas dans la liste admise est ignoré. */
  function lireReglages(texte) {
    var res = {};
    CLES.forEach(function (k) { res[k] = DEFAUT[k]; });
    String(texte || '').replace(/^#/, '').split('&').forEach(function (morceau) {
      var i = morceau.indexOf('=');
      if (i < 1) return;
      var k = morceau.slice(0, i), v = morceau.slice(i + 1);
      if (possede.call(ADMIS, k) && possede.call(ADMIS[k], v)) res[k] = ADMIS[k][v];
    });
    return res;
  }

  /** Fragment d'adresse (sans le #) qui redonne ces réglages. */
  function ecrireReglages(reglages) {
    return CLES.map(function (k) {
      var v = reglages[k];
      return k + '=' + (v === true ? 'oui' : (v === false ? 'non' : v));
    }).join('&');
  }

  /** Feuille {l, h} en millimètres pour ces réglages. */
  function feuille(reglages) {
    var f = FORMATS[reglages.format] || FORMATS.A3;
    return reglages.orientation === 'portrait' ? { l: f.l, h: f.h } : { l: f.h, h: f.l };
  }

  /** Hauteur de la bande du cartouche, au-dessus de la marge du bas (deux lignes sur une feuille étroite). */
  function hauteurBande(reglages) { return feuille(reglages).l >= 297 ? 7 : 11; }

  /** Zone où les pièces (fond perdu compris) peuvent se trouver : {x0, y0, x1, y1}. */
  function zoneUtile(reglages) {
    var f = feuille(reglages);
    return { x0: MARGE, y0: MARGE, x1: f.l - MARGE, y1: f.h - MARGE - hauteurBande(reglages) };
  }

  function debord(reglages) { return reglages.fond ? FOND_PERDU : 0; }

  /**
   * Pièces à imprimer, une entrée par EXEMPLAIRE : [{ref, id, nom, genre, famille, plat, cases: [{q, r, terrain}],
   * camp (villes)}]. genre : 'modele' (pièce du catalogue), 'ville', 'evenement'.
   * famille : 'terrain' (noyau, montagnes, monoblocs, remplissage), 'villes', 'evenements'.
   */
  function listePieces(reglages) {
    var res = [];
    var copie = function (cases) { return cases.map(function (c) { return { q: c.q, r: c.r, terrain: c.terrain }; }); };
    if (reglages.terrain) {
      C.ORDRE_MODELES.forEach(function (id) {
        var m = C.MODELES[id];
        for (var n = 1; n <= m.nombre; n++) {
          res.push({ ref: id + '#' + n, id: id, nom: m.nom, genre: 'modele', famille: 'terrain', role: m.role, plat: PLAT_TUILE, cases: copie(m.cases) });
        }
      });
    }
    if (reglages.villes) {
      var ville = function (v, camp, n) {
        res.push({ ref: v.id + '-' + camp + '#' + n, id: v.id, nom: v.nom, genre: 'ville', famille: 'villes', camp: camp, plat: reglages.ville === 40 ? 40 : PLAT_TUILE, cases: [{ q: 0, r: 0, terrain: 'ville' }] });
      };
      var VN = C.VILLE_NEUTRE, VD = C.VILLE_DEPLOIEMENT, i;
      for (i = 1; i <= VN.nombre; i++) ville(VN, VN.proprietaire, i);
      VD.camps.forEach(function (camp) { for (var j = 1; j <= VD.parCamp; j++) ville(VD, camp, j); });
    }
    if (reglages.evenements) {
      C.ORDRE_EVENEMENTS.forEach(function (id) {
        var ev = C.EVENEMENTS[id];
        res.push({ ref: id + '#1', id: id, nom: ev.nom, genre: 'evenement', famille: 'evenements', plat: PLAT_TUILE, cases: [{ q: 0, r: 0, terrain: ev.terrain }] });
      });
    }
    return res;
  }

  /** Nom du camp d'une tuile de ville, tel qu'il est imprimé. */
  function nomCamp(camp) { return camp === 'neutre' ? 'Neutre' : (R.NOMS_CAMPS[camp] || String(camp)); }

  /** Étiquette d'une pièce : identifiant puis nom (« F31 Lisière ») ; pour une ville, « VD · Vert ». */
  function etiquette(piece) {
    return piece.genre === 'ville' ? piece.id + ' · ' + nomCamp(piece.camp) : piece.id + ' ' + piece.nom;
  }

  /**
   * Contour extérieur d'un groupe de cases [{q, r}] : liste de polygones FERMÉS [[{x, y}, …]] en millimètres,
   * relatifs à l'ancre (0,0). Une pièce sans trou donne un seul polygone ; ses sommets sont au nombre de
   * 6 × cases − 2 × (côtés communs à deux cases).
   */
  function contour(cases, plat) {
    var cles = cases.map(function (c) { return H.cle(c.q, c.r); });
    var aretes = R.aretesContour(cles, plat || PLAT_TUILE), depart = {}, boucles = [];
    var nom = function (x, y) { return Math.round(x * 1000) + ':' + Math.round(y * 1000); };
    aretes.forEach(function (a) { depart[nom(a.x1, a.y1)] = a; });
    aretes.forEach(function (premiere) {
      if (premiere.vue) return;
      var boucle = [], a = premiere;
      while (a && !a.vue) {
        a.vue = true;
        boucle.push({ x: a.x1, y: a.y1 });
        a = depart[nom(a.x2, a.y2)];
      }
      boucles.push(boucle);
    });
    return boucles;
  }

  /** Nombre de côtés communs à deux cases d'un groupe [{q, r}]. */
  function adjacences(cases) {
    var dans = {}, n = 0;
    cases.forEach(function (c) { dans[H.cle(c.q, c.r)] = true; });
    cases.forEach(function (c) {
      for (var i = 0; i < 3; i++) if (dans[H.cle(c.q + H.DIRS[i].q, c.r + H.DIRS[i].r)] === true) n += 1;
    });
    return n;
  }

  /**
   * Aire d'une pièce (sans trou) agrandie de `d` millimètres par un hexagone : cases + bande le long du contour
   * + six coins. Exact tant que la bande ne se recoupe pas (d petit devant la case).
   */
  function aireAgrandie(piece, d) {
    var n = piece.cases.length, cote = piece.plat / RACINE3, aretes = 6 * n - 2 * adjacences(piece.cases);
    return n * piece.plat * piece.plat * RACINE3 / 2 + d * aretes * cote + 6 * d * d / RACINE3;
  }

  /**
   * Nombre de planches en dessous duquel aucun rangement ne peut descendre : chaque pièce occupe au moins sa forme
   * agrandie du fond perdu et de la moitié de l'écart, dans la zone utile elle-même agrandie de cette moitié.
   */
  function borneInferieure(pieces, reglages) {
    var z = zoneUtile(reglages), d = debord(reglages) + ECART / 2, aire = 0;
    pieces.forEach(function (p) { aire += aireAgrandie(p, d); });
    var page = (z.x1 - z.x0 + ECART) * (z.y1 - z.y0 + ECART);
    return pieces.length ? Math.max(1, Math.ceil(aire / page)) : 0;
  }

  /**
   * Orientations DISTINCTES d'une pièce (rotations par sixièmes de tour, jamais de miroir : le carton n'a qu'un recto).
   * Chaque orientation : {rotation, a (demi-largeur d'une case avec fond perdu), cases: [{q, r, terrain, x, y}],
   * minX, maxX, minY, maxY (étendue avec fond perdu, relative à l'ancre)}.
   */
  function orientations(piece, reglages) {
    var a = piece.plat / 2 + debord(reglages), vues = {}, res = [];
    for (var k = 0; k < 6; k++) {
      var cases = piece.cases.map(function (c) {
        var t = H.tourner(c.q, c.r, k), p = H.centre(t.q, t.r, piece.plat);
        return { q: t.q, r: t.r, terrain: c.terrain, x: p.x, y: p.y };
      });
      var o = { rotation: k, a: a, cases: cases, minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
      cases.forEach(function (c) {
        o.minX = Math.min(o.minX, c.x - a); o.maxX = Math.max(o.maxX, c.x + a);
        o.minY = Math.min(o.minY, c.y - a * 2 / RACINE3); o.maxY = Math.max(o.maxY, c.y + a * 2 / RACINE3);
      });
      var signature = cases.map(function (c) { return Math.round((c.x - o.minX) * 100) + ':' + Math.round((c.y - o.minY) * 100); }).sort().join(' ');
      if (vues[signature]) continue;
      vues[signature] = true;
      res.push(o);
    }
    return res;
  }

  /**
   * Écart entre deux hexagones de même orientation (pointe en haut), de demi-largeurs a1 et a2, centrés en
   * (x1, y1) et (x2, y2) : négatif s'ils se recouvrent. Mesuré le long des trois axes des côtés ; la distance
   * réelle entre les deux hexagones est au moins cet écart.
   */
  function ecartHexagones(x1, y1, a1, x2, y2, a2) {
    var dx = x2 - x1, v = (y2 - y1) * RACINE3 / 2;
    return Math.max(Math.abs(dx), Math.abs(dx / 2 + v), Math.abs(dx / 2 - v)) - a1 - a2;
  }

  /** Plus petit écart entre les formes avec fond perdu de deux pièces posées (voir ranger). */
  function ecartPoses(p1, p2) {
    var mini = Infinity;
    p1.cases.forEach(function (c1) {
      p2.cases.forEach(function (c2) { mini = Math.min(mini, ecartHexagones(c1.x, c1.y, p1.a, c2.x, c2.y, p2.a)); });
    });
    return mini;
  }

  /** Premier point libre à partir de `mini`, hors des intervalles ouverts interdits ; null au-delà de `maxi`. */
  function premierLibre(interdits, mini, maxi) {
    interdits.sort(function (u, w) { return u[0] - w[0]; });
    var x = mini;
    for (var j = 0; j < interdits.length; j++) {
      if (interdits[j][0] < x - EPSILON && interdits[j][1] > x) x = interdits[j][1];
    }
    return x <= maxi + EPSILON ? x : null;
  }

  /**
   * Plus petite abscisse d'ancre, entre xMin et xMax, où l'orientation `o` posée à l'ordonnée `y` reste à ECART
   * au moins de toutes les cases déjà posées [{x, y, a}] ; null s'il n'y en a pas.
   * Deux hexagones se recouvrent si |dx| < s, |dx / 2 + v| < s et |dx / 2 − v| < s (dx : écart horizontal des
   * centres ; v : écart vertical × √3 / 2 ; s : somme des demi-largeurs et de l'écart voulu).
   */
  function premiereAbscisse(o, y, xMin, xMax, occupees) {
    var interdits = [];
    o.cases.forEach(function (c) {
      for (var i = 0; i < occupees.length; i++) {
        var p = occupees[i], s = o.a + p.a + ECART, v = (y + c.y - p.y) * RACINE3 / 2;
        if (Math.abs(v) >= s) continue;
        var bas = Math.max(-s, -2 * s - 2 * v, 2 * v - 2 * s), haut = Math.min(s, 2 * s - 2 * v, 2 * v + 2 * s);
        if (bas < haut) interdits.push([p.x - c.x + bas, p.x - c.x + haut]);
      }
    });
    return premierLibre(interdits, xMin, xMax);
  }

  /** Plus petite ordonnée d'ancre, entre yMin et yMax, pour l'orientation `o` posée à l'abscisse `x` ; null s'il n'y en a pas. */
  function premiereOrdonnee(o, x, yMin, yMax, occupees) {
    var interdits = [];
    o.cases.forEach(function (c) {
      for (var i = 0; i < occupees.length; i++) {
        var p = occupees[i], s = o.a + p.a + ECART, dx = x + c.x - p.x;
        if (Math.abs(dx) >= s) continue;
        var bas = Math.max(-s - dx / 2, dx / 2 - s), haut = Math.min(s - dx / 2, dx / 2 + s);
        if (bas < haut) interdits.push([p.y - c.y + bas * 2 / RACINE3, p.y - c.y + haut * 2 / RACINE3]);
      }
    });
    return premierLibre(interdits, yMin, yMax);
  }

  /**
   * Nombre de contacts d'une pose : cases déjà posées à l'écart minimal exactement, et bords de la zone touchés.
   * Une pose qui en a beaucoup s'emboîte bien dans ce qui est déjà rangé.
   */
  function contacts(o, x, y, occupees, z) {
    var n = 0, jeu = 0.02;
    o.cases.forEach(function (c) {
      var cx = x + c.x, cy = y + c.y, pointe = o.a * 2 / RACINE3;
      if (cx - o.a - z.x0 < jeu) n += 1;
      if (z.x1 - cx - o.a < jeu) n += 1;
      if (cy - pointe - z.y0 < jeu) n += 0.5;
      if (z.y1 - cy - pointe < jeu) n += 0.5;
      for (var i = 0; i < occupees.length; i++) {
        var p = occupees[i];
        if (ecartHexagones(cx, cy, o.a, p.x, p.y, p.a) - ECART < jeu) n += 1;
      }
    });
    return n;
  }

  /**
   * Façons de choisir, parmi les poses possibles d'une pièce, la meilleure (note la plus basse).
   * `o` : orientation ; (x, y) : ancre ; n : nombre de contacts de la pose.
   */
  var STRATEGIES = [
    { nom: 'contacts-haut', note: function (o, x, y, n) { return -n * 1e6 + (y + o.minY) * 1000 + (x + o.minX); } },
    { nom: 'haut', note: function (o, x, y) { return (y + o.minY) * 1000 + (x + o.minX); } },
    { nom: 'coin', note: function (o, x, y) { return (x + o.maxX) + (y + o.maxY); } }
  ];

  /**
   * Meilleure pose d'une pièce (par ses orientations) sur une planche, ou null si elle n'y tient pas.
   * Poses examinées : pour chaque ordonnée (tous les PAS mm) la pose la plus à gauche, pour chaque abscisse la pose
   * la plus haute, chacune resserrée ensuite contre ses voisines (plus haut, puis plus à gauche).
   */
  function chercherPose(orients, occupees, z, strategie) {
    var meilleure = null;
    orients.forEach(function (o) {
      var xMin = z.x0 - o.minX, xMax = z.x1 - o.maxX, yMin = z.y0 - o.minY, yMax = z.y1 - o.maxY;
      if (xMax < xMin - EPSILON || yMax < yMin - EPSILON) return;
      var candidate = function (x, y) {
        if (x === null || y === null) return;
        var note = strategie.note(o, x, y, contacts(o, x, y, occupees, z));
        if (!meilleure || note < meilleure.note - EPSILON) meilleure = { o: o, x: x, y: y, note: note };
      };
      var resserrer = function (x, y) {
        candidate(x, y);
        var y2 = premiereOrdonnee(o, x, yMin, yMax, occupees);
        if (y2 === null) return;
        var x2 = premiereAbscisse(o, y2, xMin, xMax, occupees);
        candidate(x2, y2);
      };
      var fin, x, y;
      for (y = yMin, fin = false; !fin; y += PAS) {
        if (y >= yMax) { y = yMax; fin = true; }
        x = premiereAbscisse(o, y, xMin, xMax, occupees);
        if (x !== null) resserrer(x, y);
      }
      for (x = xMin, fin = false; !fin; x += PAS) {
        if (x >= xMax) { x = xMax; fin = true; }
        y = premiereOrdonnee(o, x, yMin, yMax, occupees);
        if (y !== null) resserrer(x, y);
      }
    });
    return meilleure;
  }

  function rangerAvec(pieces, reglages, strategie) {
    var z = zoneUtile(reglages), pages = [], horsFormat = [];
    // Les grandes pièces d'abord ; les tuiles d'une case finissent dans les creux. Tri stable.
    var ordre = pieces.map(function (p, i) { return { p: p, i: i }; }).sort(function (u, w) {
      return w.p.cases.length - u.p.cases.length || w.p.plat - u.p.plat || u.i - w.i;
    });
    ordre.forEach(function (e) {
      var piece = e.p, orients = orientations(piece, reglages), pose = null, page = null;
      for (var i = 0; i < pages.length && !pose; i++) {
        pose = chercherPose(orients, pages[i].occupees, z, strategie);
        if (pose) page = pages[i];
      }
      if (!pose) {
        page = { occupees: [], poses: [] };
        pose = chercherPose(orients, page.occupees, z, strategie);
        if (!pose) { horsFormat.push(piece); return; }
        pages.push(page);
      }
      var o = pose.o, cases = o.cases.map(function (c) { return { q: c.q, r: c.r, terrain: c.terrain, x: pose.x + c.x, y: pose.y + c.y }; });
      cases.forEach(function (c) { page.occupees.push({ x: c.x, y: c.y, a: o.a }); });
      page.poses.push({
        piece: piece, rotation: o.rotation, x: pose.x, y: pose.y, a: o.a, cases: cases,
        boite: { x1: pose.x + o.minX, y1: pose.y + o.minY, x2: pose.x + o.maxX, y2: pose.y + o.maxY }
      });
    });
    return { planches: pages.map(function (p) { return p.poses; }), horsFormat: horsFormat, strategie: strategie.nom };
  }

  /**
   * Range les pièces sur le moins de planches possible. Renvoie {
   *   planches: [[{piece, rotation, x, y (ancre, mm), a, cases: [{q, r, terrain, x, y}], boite: {x1, y1, x2, y2}}]],
   *   horsFormat: [pièces trop grandes pour la feuille], strategie, borne (nombre de planches impossible à battre),
   *   zone, feuille }.
   * Déterministe : aucune part de hasard. Plusieurs façons de ranger sont essayées ; la première qui atteint la
   * borne est gardée, sinon celle qui donne le moins de planches.
   */
  function ranger(pieces, reglages) {
    var borne = borneInferieure(pieces, reglages), meilleur = null;
    STRATEGIES.some(function (s) {
      var r = rangerAvec(pieces, reglages, s);
      if (!meilleur || r.planches.length < meilleur.planches.length) meilleur = r;
      return meilleur.planches.length <= borne;
    });
    meilleur.borne = borne;
    meilleur.zone = zoneUtile(reglages);
    meilleur.feuille = feuille(reglages);
    return meilleur;
  }

  /** Date du jour « AAAA-MM-JJ » (heure locale). */
  function dateDuJour(d) {
    var deux = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + deux(d.getMonth() + 1) + '-' + deux(d.getDate());
  }

  /** Textes du cartouche d'une planche : {titre: « Planche n / N », detail, rappel}. */
  function cartouche(n, total, reglages, date) {
    return {
      titre: 'Planche ' + n + ' / ' + total,
      detail: reglages.format + ' ' + reglages.orientation + ' · ' + date,
      rappel: 'Imprimer à 100 %, sans ajustement à la page'
    };
  }

  // ================================================================== 2. DOM et SVG

  var POLICE = 'Segoe UI, Arial, Helvetica, sans-serif';
  var ENCRE = '#111111';
  var COUPE = '#000000';        // trait de coupe : noir pur, 0,3 mm (seuls traits de cette couleur et de cette épaisseur)
  var COULEUR_NEUTRE = '#8A6400';

  function arrondi(x) { return Math.round(x * 1000) / 1000; }

  function texte(x, y, contenu, attrs) {
    var t = R.svg('text', { x: arrondi(x), y: arrondi(y), 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-family': POLICE, 'font-size': CORPS, fill: ENCRE, texte: contenu });
    if (attrs) Object.keys(attrs).forEach(function (k) { t.setAttribute(k, String(attrs[k])); });
    return t;
  }

  /** Texte sur un cartouche blanc (lisible sur n'importe quel motif) ; la largeur est estimée d'après le nombre de signes. */
  function etiquetteSvg(x, y, contenu, corps) {
    var c = corps || CORPS, l = contenu.length * c * 0.54 + 1.6, h = c + 1.1;
    return [
      R.svg('rect', { x: arrondi(x - l / 2), y: arrondi(y - h / 2), width: arrondi(l), height: arrondi(h), rx: 0.6, fill: '#FFFFFF' }),
      texte(x, y, contenu, { 'font-size': c })
    ];
  }

  /** Chemin SVG fermé du contour d'une pose (trait de coupe), en millimètres de la feuille. */
  function cheminCoupe(pose) {
    return contour(pose.cases, pose.piece.plat).map(function (boucle) {
      return boucle.map(function (s, i) { return (i ? 'L' : 'M') + arrondi(pose.x + s.x) + ' ' + arrondi(pose.y + s.y); }).join('') + 'Z';
    }).join('');
  }

  /**
   * Une case dans le groupe `groupe` (unités de dessin de rendu.js) : fond uni, puis motif du terrain répété comme à
   * l'écran et coupé au bord de l'hexagone. Le motif est fait de tracés et non d'un <pattern> SVG : à l'impression, un
   * <pattern> sort en image à basse définition. `retrait` négatif agrandit la case (fond perdu).
   */
  function dessinerCase(defs, groupe, cle, terrain, retrait, idDecoupe) {
    var t = possede.call(R.TERRAINS, terrain) ? R.TERRAINS[terrain] : null;
    groupe.appendChild(R.polygoneCase(cle, { fill: t ? t.fond : '#FFFFFF' }, retrait));
    if (!t) return;
    var p = H.decle(cle), c = H.centre(p.q, p.r, R.PLAT), dl = R.PLAT / 2 * (1 - retrait), dh = dl * 2 / RACINE3;
    defs.appendChild(R.svg('clipPath', { id: idDecoupe }, R.polygoneCase(cle, null, retrait)));
    var motif = R.svg('g', { 'clip-path': 'url(#' + idDecoupe + ')' });
    for (var j = Math.floor((c.y - dh) / t.pas); j * t.pas < c.y + dh; j++) {
      for (var i = Math.floor((c.x - dl) / t.pas); i * t.pas < c.x + dl; i++) {
        for (var k = 0; k < t.formes.length; k++) {
          var forme = R.svg(t.formes[k][0], t.formes[k][1]);
          forme.setAttribute('transform', 'translate(' + (i * t.pas) + ' ' + (j * t.pas) + ')');
          motif.appendChild(forme);
        }
      }
    }
    groupe.appendChild(motif);
  }

  /** Dessin d'une pièce posée : fond perdu, cases, décor, trait de coupe, étiquette. */
  function dessinerPose(pose, reglages, prefixe, defs) {
    var piece = pose.piece, plat = piece.plat, e = plat / R.PLAT, d = debord(reglages);
    var g = R.svg('g', { classe: 'pl-piece', 'data-piece': piece.id, 'data-ref': piece.ref });
    // Les cases sont dessinées avec les fonctions de l'écran (unités de dessin de rendu.js), mises à l'échelle :
    // les motifs sortent comme à l'écran, à 45 / 60 de leur taille.
    var ge = R.svg('g', { transform: 'translate(' + arrondi(pose.x) + ' ' + arrondi(pose.y) + ') scale(' + arrondi(e) + ')' });
    var mm = function (v) { return arrondi(v / e); };          // millimètres → unités du groupe mis à l'échelle
    var cles = pose.cases.map(function (c) { return H.cle(c.q, c.r); });
    var base = prefixe + piece.ref.replace(/[^A-Za-z0-9]/g, '-') + '-';
    // Fond perdu : chaque case agrandie de 3 mm, sous les vraies cases (inutile pour une case entourée de six autres).
    if (d) {
      pose.cases.forEach(function (c, i) {
        var entouree = H.voisines(cles[i]).every(function (v) { return cles.indexOf(v) !== -1; });
        if (!entouree) dessinerCase(defs, ge, cles[i], c.terrain, -2 * d / plat, base + 'f' + i);
      });
    }
    pose.cases.forEach(function (c, i) { dessinerCase(defs, ge, cles[i], c.terrain, 0, base + 'c' + i); });
    // Limites entre cases : trait léger.
    pose.cases.forEach(function (c, i) { ge.appendChild(R.polygoneCase(cles[i], { fill: 'none', stroke: '#6E6A58', 'stroke-width': mm(0.25) })); });
    g.appendChild(ge);

    var centre = pose.cases[0], k = plat / PLAT_TUILE;
    if (piece.id === 'R') {
      // Tuile de remplissage : liseré pointillé et point central, comme à l'écran.
      ge.appendChild(R.polygoneCase('0,0', { fill: 'none', stroke: '#5E4A12', 'stroke-width': mm(0.6), 'stroke-dasharray': mm(1.2) + ' ' + mm(2), 'stroke-linecap': 'round' }, 2 * (SECURITE + 1) / plat));
      g.appendChild(R.svg('circle', { cx: arrondi(centre.x), cy: arrondi(centre.y), r: 1.6, fill: '#5E4A12' }));
    } else if (piece.genre === 'ville') {
      // Tuile de ville : liseré à la couleur du camp, pastille à l'initiale du camp, nom. En niveaux de gris, le camp
      // se lit à l'initiale et au style du liseré (Vert : un trait ; Rouge : deux traits ; neutre : tirets blancs).
      var couleur = piece.camp === 'neutre' ? COULEUR_NEUTRE : R.COULEURS_CAMPS[piece.camp];
      var retrait = 2 * (SECURITE + 1.5) / plat;
      ge.appendChild(R.polygoneCase('0,0', { fill: 'none', stroke: couleur, 'stroke-width': mm(1.2), 'stroke-linejoin': 'round' }, retrait));
      if (piece.camp === 'neutre') ge.appendChild(R.polygoneCase('0,0', { fill: 'none', stroke: '#FFFFFF', 'stroke-width': mm(0.45), 'stroke-dasharray': mm(1.6) + ' ' + mm(1.2) }, retrait));
      if (piece.camp === 'rouge') ge.appendChild(R.polygoneCase('0,0', { fill: 'none', stroke: couleur, 'stroke-width': mm(0.35) }, retrait + 2 * 1.5 / plat));
      if (piece.camp === 'neutre') {
        g.appendChild(R.svg('circle', { cx: arrondi(centre.x), cy: arrondi(centre.y), r: arrondi(4.4 * k), fill: '#FFFFFF', stroke: couleur, 'stroke-width': 0.9 }));
        g.appendChild(texte(centre.x, centre.y, 'N', { 'font-size': 5, 'font-weight': 'bold', fill: couleur }));
      } else {
        g.appendChild(R.svg('circle', { cx: arrondi(centre.x), cy: arrondi(centre.y), r: arrondi(4.8 * k), fill: couleur, stroke: '#FFFFFF', 'stroke-width': 0.6 }));
        g.appendChild(texte(centre.x, centre.y, nomCamp(piece.camp).charAt(0), { 'font-size': 5, 'font-weight': 'bold', fill: '#FFFFFF' }));
      }
      g.appendChild(texte(centre.x, centre.y - 8.3 * k, piece.nom, { 'font-size': 2.2 }));
      g.appendChild(texte(centre.x, centre.y + 8.6 * k, etiquette(piece), { 'font-size': 2.6, 'font-weight': 'bold' }));
    } else if (piece.genre === 'evenement') {
      // Tuile d'événement : hexagone intérieur en tirets et identifiant, comme à l'écran ; nom en dessous.
      ge.appendChild(R.polygoneCase('0,0', { fill: 'none', stroke: '#111111', 'stroke-width': mm(0.7), 'stroke-dasharray': mm(2.2) + ' ' + mm(1.5) }, 2 * (SECURITE + 0.6) / plat));
      g.appendChild(R.svg('rect', { x: arrondi(centre.x - 4.5), y: arrondi(centre.y - 3.2), width: 9, height: 6.4, rx: 1.2, fill: '#FFFFFF', stroke: '#111111', 'stroke-width': 0.4 }));
      g.appendChild(texte(centre.x, centre.y, piece.id, { 'font-size': 4, 'font-weight': 'bold' }));
      etiquetteSvg(centre.x, centre.y + 10.5, piece.nom, 2.4).forEach(function (x) { g.appendChild(x); });
    }

    // Trait de coupe, sur le contour extérieur seulement : liseré blanc dessous pour rester lisible sur les fonds sombres.
    var chemin = cheminCoupe(pose);
    g.appendChild(R.svg('path', { d: chemin, fill: 'none', stroke: '#FFFFFF', 'stroke-width': 0.8, 'stroke-linejoin': 'round' }));
    g.appendChild(R.svg('path', { classe: 'pl-coupe', d: chemin, fill: 'none', stroke: COUPE, 'stroke-width': 0.3, 'stroke-linejoin': 'round' }));

    // Étiquette (identifiant et nom) d'une pièce du catalogue : en bas de la case la plus basse, dans la zone de sécurité.
    if (reglages.etiquettes && piece.genre === 'modele') {
      var basse = pose.cases.reduce(function (m, c) { return (c.y > m.y + 0.01 || (Math.abs(c.y - m.y) <= 0.01 && c.x < m.x)) ? c : m; });
      etiquetteSvg(basse.x, basse.y + 11.5, etiquette(piece)).forEach(function (x) { g.appendChild(x); });
    }
    return g;
  }

  /** Cartouche d'une planche : barre de contrôle de 100 mm graduée, « Planche n / N », date, rappel. */
  function dessinerCartouche(n, total, reglages, date) {
    var f = feuille(reglages), g = R.svg('g', { classe: 'pl-cartouche' }), c = cartouche(n, total, reglages, date);
    var x0 = MARGE + 0.5, y = f.h - MARGE - 0.5, etroit = hauteurBande(reglages) > 7;
    g.appendChild(R.svg('line', { classe: 'pl-barre', x1: x0, y1: y, x2: x0 + BARRE, y2: y, stroke: ENCRE, 'stroke-width': 0.5 }));
    var graduations = '';
    for (var i = 0; i <= BARRE; i += 5) {
      var h = (i === 0 || i === BARRE) ? 3.2 : (i % 10 === 0 ? 2.2 : 1.2);
      graduations += 'M' + arrondi(x0 + i) + ' ' + arrondi(y) + 'v' + (-h);
    }
    g.appendChild(R.svg('path', { d: graduations, fill: 'none', stroke: ENCRE, 'stroke-width': 0.25 }));
    g.appendChild(texte(x0 + BARRE + 1.5, y - 1.6, '100 mm', { 'text-anchor': 'start', 'font-size': 2.8 }));
    var ligne = c.titre + ' · ' + c.detail + ' · ' + c.rappel;
    if (etroit) g.appendChild(texte(x0, y - 6.5, ligne, { 'text-anchor': 'start', 'font-size': 2.8, 'font-weight': 'bold' }));
    else g.appendChild(texte(f.l - MARGE, y - 1.6, ligne, { 'text-anchor': 'end', 'font-size': 2.8, 'font-weight': 'bold' }));
    return g;
  }

  /** Une planche : <svg> aux dimensions de la feuille, en millimètres. */
  function dessinerPlanche(poses, n, total, reglages, date) {
    var f = feuille(reglages), prefixe = R.nouveauPrefixe();
    var racine = R.svg('svg', {
      classe: 'pl-feuille', width: f.l + 'mm', height: f.h + 'mm', viewBox: '0 0 ' + f.l + ' ' + f.h,
      role: 'img', 'aria-label': 'Planche ' + n + ' sur ' + total + ' : ' + poses.map(function (p) { return p.piece.id; }).join(', ')
    });
    var defs = R.svg('defs');
    racine.appendChild(defs);
    racine.appendChild(R.svg('rect', { x: 0, y: 0, width: f.l, height: f.h, fill: '#FFFFFF' }));
    poses.forEach(function (p) { racine.appendChild(dessinerPose(p, reglages, prefixe, defs)); });
    racine.appendChild(dessinerCartouche(n, total, reglages, date));
    return racine;
  }

  /** Taille de la page imprimée : feuille de style construite par script (la CSP interdit les styles en ligne, pas le CSSOM). */
  function reglerPage(reglages) {
    var f = feuille(reglages);
    try {
      var style = new CSSStyleSheet();
      style.replaceSync('@page { size: ' + f.l + 'mm ' + f.h + 'mm; margin: 0; }');
      document.adoptedStyleSheets = [style];
    } catch (e) { /* navigateur ancien : la feuille de style garde l'A3 paysage */ }
  }

  /** Met la page en route : formulaire des réglages, adresse, dessin des planches. */
  function demarrer() {
    var zone = document.getElementById('planches'), bilan = document.getElementById('pl-bilan'), formulaire = document.getElementById('pl-reglages');
    if (!zone || !formulaire) return;
    var champ = function (nom) { return formulaire.querySelector('[name="' + nom + '"]'); };

    function versFormulaire(reglages) {
      CLES.forEach(function (k) {
        var c = champ(k);
        if (!c) return;
        if (c.type === 'checkbox') c.checked = reglages[k] === true;
        else c.value = String(reglages[k]);
      });
    }

    function depuisFormulaire() {
      return lireReglages(CLES.map(function (k) {
        var c = champ(k);
        if (!c) return '';
        return k + '=' + (c.type === 'checkbox' ? (c.checked ? 'oui' : 'non') : c.value);
      }).join('&'));
    }

    function dessiner(reglages) {
      var pieces = listePieces(reglages), resultat = ranger(pieces, reglages), date = dateDuJour(new Date());
      var total = resultat.planches.length;
      reglerPage(reglages);
      R.vider(zone);
      resultat.planches.forEach(function (poses, i) {
        zone.appendChild(R.el('div', { classe: 'pl-planche' }, dessinerPlanche(poses, i + 1, total, reglages, date)));
      });
      var message = pieces.length
        ? total + (total > 1 ? ' planches ' : ' planche ') + reglages.format + ' ' + reglages.orientation + ' pour ' + pieces.length + ' pièces.'
        : 'Aucune famille de pièces n’est cochée.';
      if (resultat.horsFormat.length) {
        message += ' Trop grandes pour cette feuille, non imprimées : ' + resultat.horsFormat.map(function (p) { return p.id; }).join(', ') + '.';
      }
      bilan.textContent = message;
      zone.setAttribute('data-planches', String(total));
      zone.setAttribute('data-pieces', String(pieces.length - resultat.horsFormat.length));
    }

    var reglages = lireReglages(window.location.hash);
    versFormulaire(reglages);
    dessiner(reglages);

    formulaire.addEventListener('change', function () {
      var r = depuisFormulaire();
      try { window.history.replaceState(null, '', '#' + ecrireReglages(r)); } catch (e) { /* l'adresse reste telle quelle */ }
      dessiner(r);
    });
    window.addEventListener('hashchange', function () {
      var r = lireReglages(window.location.hash);
      versFormulaire(r);
      dessiner(r);
    });
    var bouton = document.getElementById('pl-imprimer');
    if (bouton) bouton.addEventListener('click', function () { window.print(); });
  }

  AT.planches = {
    FORMATS: FORMATS, PLAT_TUILE: PLAT_TUILE, FOND_PERDU: FOND_PERDU, SECURITE: SECURITE, MARGE: MARGE, ECART: ECART, BARRE: BARRE, CORPS: CORPS,
    DEFAUT: DEFAUT, STRATEGIES: STRATEGIES,
    // logique pure
    lireReglages: lireReglages, ecrireReglages: ecrireReglages, feuille: feuille, zoneUtile: zoneUtile, listePieces: listePieces,
    etiquette: etiquette, contour: contour, adjacences: adjacences, aireAgrandie: aireAgrandie, borneInferieure: borneInferieure,
    orientations: orientations, ecartHexagones: ecartHexagones, ecartPoses: ecartPoses, ranger: ranger, rangerAvec: rangerAvec,
    cartouche: cartouche, dateDuJour: dateDuJour,
    // DOM et SVG
    dessinerPlanche: dessinerPlanche, demarrer: demarrer
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.planches;
  else if (typeof document !== 'undefined') demarrer();
})();
