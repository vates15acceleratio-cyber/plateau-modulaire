/*
 * geometrie.js : constantes (mm), côtés / coins, masques, rotation, appariement.
 * Aucun accès au DOM. Voir docs/archives/2-avis-geometrie.md (D3, D4) ; formats 4×4 et 5×5 :
 * docs/20-avis-geometrie-v2.md (D4). PM.geometrie.format(id) décrit un format ; PM.geometrie.* = format 4×4.
 *
 * Conventions
 *  - Côtés : 0 = N, 1 = E, 2 = S, 3 = O.  Coins : 0 = NO, 1 = NE, 2 = SE, 3 = SO
 *    (le coin k est le début du côté k, lecture horaire).
 *  - Position de raccord p : 0 = début, 1 = milieu, 2 = fin (lecture horaire).
 *  - Repère local d'une tuile canonique : origine au coin NO, x vers l'est,
 *    y vers le sud, tuile de 0 à COTE.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

(function () {
  'use strict';

  /**
   * Formats de grille carrée (docs/20-avis-geometrie-v2.md, D4). Toutes les cotes en mm.
   * Seules les valeurs propres à chaque format figurent ici ; les autres sont dans COMMUNES.
   */
  var DEFINITIONS = {
    '4x4': { COTE: 120, POSITIONS_RACCORD: [30, 60, 90], DIAMETRE_CASE_MAX: 30, GRILLE: { colonnes: 4, lignes: 4 } },
    '5x5': { COTE: 100, POSITIONS_RACCORD: [30, 50, 70], DIAMETRE_CASE_MAX: 24, GRILLE: { colonnes: 5, lignes: 5 } }
  };
  var IDS_FORMATS = ['4x4', '5x5'];
  var FORMAT_DEFAUT = '4x4';

  /** Cotes et règles identiques sur tous les formats. */
  var COMMUNES = {
    RAYON_ZONE_COIN: 20,
    DIAMETRE_CASE: 20,               // Ø d'une case (catalogue, cases neuves de l'éditeur, exemples) ; docs/18, « Taille des cases »
    DIAMETRE_CASE_JONCTION: 30,      // Ø du siège imprimé aux coins des tuiles : un campement a la taille d'une ville (jeton Ø 30 ; docs/18, docs/65)
    DIAMETRE_JETON: 30,
    MARGE_COUPE_CASE: 4,             // bord du disque à >= 4 mm du bord de tuile
    LARGEUR_CHEMIN: 8,
    AMORCE_RACCORD: 10,              // amorce perpendiculaire d'un chemin vers un raccord
    AMORCE_PORT: 28,                 // amorce sur la bissectrice d'un chemin vers un port de coin
    FOND_PERDU: 3,
    PAS_EDITEUR: 10,                 // pas de la grille d'aimantation de l'éditeur de tuile
    ECART_MIN_VILLES: 3,             // cases au moins entre deux villes (4 pas), alerte seulement (docs/18)
    MIN_PORTS_JONCTION: 2            // en dessous : alerte « jonction mal reliée »
  };

  var NORD = 0, EST = 1, SUD = 2, OUEST = 3;

  /** Numéro de bit d'un raccord (côté 0..3, position 0..2) dans le masque de 12 bits. */
  function bitRaccord(cote, pos) { return 3 * cote + pos; }

  /** Nombre de quarts de tour normalisé (entier 0..3) ; une valeur non entière compte pour 0. */
  function quarts(rot) { return (typeof rot === 'number' && isFinite(rot) && Math.floor(rot) === rot) ? ((rot % 4) + 4) % 4 : 0; }

  /** Rotation horaire de `rot` quarts de tour d'un masque de raccords (12 bits). */
  function tournerRaccords(m, rot) {
    var n = quarts(rot);
    for (var i = 0; i < n; i++) m = ((m << 3) | (m >> 9)) & 0xFFF;
    return m & 0xFFF;
  }

  /** Rotation horaire de `rot` quarts de tour d'un masque de ports de coin (4 bits). */
  function tournerPorts(c, rot) {
    var n = quarts(rot);
    for (var i = 0; i < n; i++) c = ((c << 1) | (c >> 3)) & 0xF;
    return c & 0xF;
  }

  /** Les 3 bits (positions 0..2) d'un côté. */
  function triplet(m, cote) { return (m >> (3 * cote)) & 7; }

  /** Échange les bits 0 et 2 d'un triplet (vue depuis le côté opposé). */
  function inverser3(b) { return ((b & 1) << 2) | (b & 2) | ((b >> 2) & 1); }

  /**
   * Appariement face à face : le côté coteA de A touche le côté (coteA+2)%4 de B,
   * la position p rencontre 2-p. Renvoie des triplets de 3 bits (vue de A pour
   * connectes et mortsA, vue de B pour mortsB).
   */
  function apparier(mA, coteA, mB) {
    var a = triplet(mA, coteA);
    var b = triplet(mB, (coteA + 2) % 4);
    return {
      connectes: a & inverser3(b),
      mortsA: a & ~inverser3(b) & 7,
      mortsB: b & ~inverser3(a) & 7
    };
  }

  /** Décalage de cellule du voisin situé de l'autre côté du côté `cote`. */
  function coteVoisin(cote) {
    return [{ dc: 0, dl: -1 }, { dc: 1, dl: 0 }, { dc: 0, dl: 1 }, { dc: -1, dl: 0 }][cote];
  }

  /** Raccord qui lui fait face de l'autre côté : le côté opposé, position 2 - p. */
  function raccordEnFace(cote, pos) { return { cote: (cote + 2) % 4, pos: 2 - pos }; }

  /** Fonctions du repère local qui dépendent du côté de tuile `COTE`. */
  function fonctionsDuCote(COTE, POSITIONS_RACCORD) {
    /** Point d'un raccord en coordonnées locales (tuile canonique). */
    function pointRaccord(cote, pos) {
      var d = POSITIONS_RACCORD[pos];
      switch (cote) {
        case NORD: return { x: d, y: 0 };
        case EST: return { x: COTE, y: d };
        case SUD: return { x: COTE - d, y: COTE };
        default: return { x: 0, y: COTE - d };
      }
    }

    /** Coin k en coordonnées locales. */
    function pointCoin(k) {
      return [{ x: 0, y: 0 }, { x: COTE, y: 0 }, { x: COTE, y: COTE }, { x: 0, y: COTE }][k];
    }

    /** Rotation horaire de `rot` quarts de tour d'un point autour du centre de la tuile. */
    function tournerPoint(p, rot) {
      var n = quarts(rot);
      var x = p.x, y = p.y, t;
      for (var i = 0; i < n; i++) { t = x; x = COTE - y; y = t; }
      return { x: x, y: y };
    }

    return { pointRaccord: pointRaccord, pointCoin: pointCoin, tournerPoint: tournerPoint };
  }

  /**
   * Camp d'une cellule selon sa rangée (docs/18, docs/20 D3) : les 2 rangées du nord au vert, les 2 du sud
   * au rouge, la rangée centrale d'une grille impaire neutre (null). Valeur invalide ou hors grille : null.
   */
  function fonctionCamp(GRILLE) {
    return function campCellule(col, lig) {
      var n = GRILLE.lignes, demi = Math.floor(n / 2);
      if (typeof lig !== 'number' || Math.floor(lig) !== lig || lig < 0 || lig >= n) return null;
      if (typeof col !== 'number' || Math.floor(col) !== col || col < 0 || col >= GRILLE.colonnes) return null;
      if (lig < demi) return 'vert';
      if (lig >= n - demi) return 'rouge';
      return null;
    };
  }

  /** Construit l'objet (gelé en profondeur) d'un format à partir de sa définition. */
  function creerFormat(id) {
    var def = DEFINITIONS[id];
    var positions = Object.freeze(def.POSITIONS_RACCORD.slice());
    var f = {
      id: id,
      COTE: def.COTE,
      POSITIONS_RACCORD: positions,
      RAYON_ZONE_COIN: COMMUNES.RAYON_ZONE_COIN,
      DIAMETRE_CASE_MAX: def.DIAMETRE_CASE_MAX,
      DIAMETRE_CASE: COMMUNES.DIAMETRE_CASE,
      DIAMETRE_CASE_JONCTION: COMMUNES.DIAMETRE_CASE_JONCTION,
      MARGE_COUPE_CASE: COMMUNES.MARGE_COUPE_CASE,
      LARGEUR_CHEMIN: COMMUNES.LARGEUR_CHEMIN,
      AMORCE_RACCORD: COMMUNES.AMORCE_RACCORD,
      AMORCE_PORT: COMMUNES.AMORCE_PORT,
      FOND_PERDU: COMMUNES.FOND_PERDU,
      DIAMETRE_JETON: COMMUNES.DIAMETRE_JETON,
      GRILLE: Object.freeze({ colonnes: def.GRILLE.colonnes, lignes: def.GRILLE.lignes }),
      PAS_EDITEUR: COMMUNES.PAS_EDITEUR,
      ECART_MIN_VILLES: COMMUNES.ECART_MIN_VILLES,
      MIN_PORTS_JONCTION: COMMUNES.MIN_PORTS_JONCTION,
      NORD: NORD, EST: EST, SUD: SUD, OUEST: OUEST,
      bitRaccord: bitRaccord,
      tournerRaccords: tournerRaccords,
      tournerPorts: tournerPorts,
      triplet: triplet,
      inverser3: inverser3,
      apparier: apparier,
      coteVoisin: coteVoisin,
      raccordEnFace: raccordEnFace
    };
    var fn = fonctionsDuCote(def.COTE, positions);
    f.pointRaccord = fn.pointRaccord;
    f.pointCoin = fn.pointCoin;
    f.tournerPoint = fn.tournerPoint;
    f.campCellule = fonctionCamp(f.GRILLE);
    return Object.freeze(f);
  }

  /**
   * Gabarits de tuile déclarés (docs/20 D2), orientation canonique : côtés extérieurs (au bord du plateau
   * quand la tuile est à sa place) et coins intérieurs (qui touchent une jonction du plateau, où l'on imprime
   * un quart du siège de campement). Indépendant du format.
   */
  var GABARITS = Object.freeze({
    centrale: Object.freeze({ cotesExterieurs: Object.freeze([]), coinsInterieurs: Object.freeze([0, 1, 2, 3]) }),
    bord: Object.freeze({ cotesExterieurs: Object.freeze([NORD]), coinsInterieurs: Object.freeze([2, 3]) }),
    coin: Object.freeze({ cotesExterieurs: Object.freeze([NORD, OUEST]), coinsInterieurs: Object.freeze([2]) })
  });

  var NORMALE = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }]; // vers l'intérieur, par côté
  var BISSECTRICE = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }]
    .map(function (v) { return { x: v.x / Math.SQRT2, y: v.y / Math.SQRT2 }; }); // vers l'intérieur, par coin

  function estCase(e) { return !!e && typeof e === 'object' && e['case'] !== undefined; }

  /**
   * Tracés de tous les chemins d'un modèle, en coordonnées locales canoniques (convention de docs/archives/2-avis-geometrie.md et de
   * rendu.js) : chemin case-case = segment entre les centres ; vers un raccord = amorce perpendiculaire
   * (AMORCE_RACCORD) puis segment vers la case ; vers un port = amorce sur la bissectrice (AMORCE_PORT) puis
   * segment vers la case. Renvoie [{id, type: 'lien'|'raccord'|'port', cases: [case...], pts: [{x,y}...],
   * raccord?, coin?}]. Les chemins mal formés (case inconnue, extrémité invalide) sont ignorés.
   * `format` : objet de format, identifiant ou rien (4×4).
   */
  function tracesModele(m, fmt) {
    var F = fmt && typeof fmt === 'object' ? fmt : format(fmt === undefined || fmt === null ? FORMAT_DEFAUT : fmt);
    var cs = Object.create(null);
    (m && Array.isArray(m.cases) ? m.cases : []).forEach(function (c) {
      if (c && typeof c === 'object' && typeof c.id === 'string' && typeof c.x === 'number' && typeof c.y === 'number') cs[c.id] = c;
    });
    var res = [];
    (m && Array.isArray(m.chemins) ? m.chemins : []).forEach(function (ch) {
      if (!ch || typeof ch !== 'object') return;
      var ext = [ch.a, ch.b];
      var cases = ext.filter(estCase).map(function (e) { return cs[e['case']]; });
      if (cases.length === 0 || cases.some(function (c) { return !c; })) return;
      if (cases.length === 2) {
        res.push({ id: ch.id, type: 'lien', cases: cases, pts: [{ x: cases[0].x, y: cases[0].y }, { x: cases[1].x, y: cases[1].y }] });
        return;
      }
      var o = ext.filter(function (e) { return !estCase(e); })[0], c = cases[0];
      if (o && o.raccord && [0, 1, 2, 3].indexOf(o.raccord.cote) >= 0 && [0, 1, 2].indexOf(o.raccord.pos) >= 0) {
        var P = F.pointRaccord(o.raccord.cote, o.raccord.pos), n = NORMALE[o.raccord.cote];
        res.push({ id: ch.id, type: 'raccord', raccord: { cote: o.raccord.cote, pos: o.raccord.pos }, cases: cases,
          pts: [P, { x: P.x + F.AMORCE_RACCORD * n.x, y: P.y + F.AMORCE_RACCORD * n.y }, { x: c.x, y: c.y }] });
      } else if (o && [0, 1, 2, 3].indexOf(o.coin) >= 0) {
        var K = F.pointCoin(o.coin), b = BISSECTRICE[o.coin];
        res.push({ id: ch.id, type: 'port', coin: o.coin, cases: cases,
          pts: [K, { x: K.x + F.AMORCE_PORT * b.x, y: K.y + F.AMORCE_PORT * b.y }, { x: c.x, y: c.y }] });
      }
    });
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Passages sans case (docs/18 fin, docs/39)                           */
  /* ------------------------------------------------------------------ */

  var K_ARC = 0.5522847498;        // constante du quart de cercle en Bézier cubique
  var SEGMENTS_PASSAGE = 24;       // pas d'aplatissement d'une courbe (contrôles de distance)

  /** Type d'une extrémité de passage : 'case' | 'raccord' | 'pivot' | 'coin' | null (hors des fonctions des chemins). */
  function typeExtremitePassage(e) {
    if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
    if (e['case'] !== undefined) return 'case';
    if (e.raccord !== undefined) return 'raccord';
    if (e.pivot !== undefined) return 'pivot';
    if (e.coin !== undefined) return 'coin';
    return null;
  }

  /** Clé texte d'une extrémité de passage bien formée (boucles, doublons, raccords partagés). */
  function cleExtremitePassage(e) {
    var t = typeExtremitePassage(e);
    if (t === 'case') return 'case:' + e['case'];
    if (t === 'pivot') return 'pivot:' + e.pivot;
    if (t === 'raccord') return 'raccord:' + e.raccord.cote + ':' + e.raccord.pos;
    return 'coin:' + e.coin;
  }

  function raccordBienForme(r) {
    return !!r && typeof r === 'object' && Number.isInteger(r.cote) && r.cote >= 0 && r.cote <= 3 && Number.isInteger(r.pos) && r.pos >= 0 && r.pos <= 2;
  }
  function pointFini(p) { return !!p && typeof p === 'object' && typeof p.x === 'number' && isFinite(p.x) && typeof p.y === 'number' && isFinite(p.y); }

  /** Point d'abscisse t (0..1) d'un segment ['L'|'Q'|'C', ...points] qui part de p0. */
  function pointSegment(p0, seg, t) {
    var u = 1 - t, c = seg[0];
    if (c === 'L') return { x: p0.x + (seg[1].x - p0.x) * t, y: p0.y + (seg[1].y - p0.y) * t };
    if (c === 'Q') {
      return { x: u * u * p0.x + 2 * u * t * seg[1].x + t * t * seg[2].x, y: u * u * p0.y + 2 * u * t * seg[1].y + t * t * seg[2].y };
    }
    return {
      x: u * u * u * p0.x + 3 * u * u * t * seg[1].x + 3 * u * t * t * seg[2].x + t * t * t * seg[3].x,
      y: u * u * u * p0.y + 3 * u * u * t * seg[1].y + 3 * u * t * t * seg[2].y + t * t * t * seg[3].y
    };
  }

  /** Dernier point d'une commande ['M'|'L'|'Q'|'C', ...points]. */
  function finCommande(c) { return c[c.length - 1]; }

  /** Polyligne aplatie d'une suite de commandes [['M', p], ['L', p], ['Q', c, p], ['C', c1, c2, p]]. */
  function aplatirCommandes(cmds) {
    var pts = [], cur = null;
    cmds.forEach(function (c) {
      if (c[0] === 'M') { cur = c[1]; pts.push({ x: cur.x, y: cur.y }); return; }
      var n = c[0] === 'L' ? 1 : SEGMENTS_PASSAGE;
      for (var k = 1; k <= n; k++) pts.push(pointSegment(cur, c, k / n));
      cur = finCommande(c);
    });
    return pts;
  }

  /** Rayon de courbure minimal (mm) d'une suite de commandes ; Infinity pour un tracé droit. */
  function rayonMinimal(cmds) {
    var mini = Infinity, cur = null;
    cmds.forEach(function (c) {
      if (c[0] === 'M') { cur = c[1]; return; }
      if (c[0] !== 'L') {
        for (var k = 0; k <= 40; k++) {
          var t = k / 40, u = 1 - t, d1, d2;
          if (c[0] === 'Q') {
            d1 = { x: 2 * u * (c[1].x - cur.x) + 2 * t * (c[2].x - c[1].x), y: 2 * u * (c[1].y - cur.y) + 2 * t * (c[2].y - c[1].y) };
            d2 = { x: 2 * (c[2].x - 2 * c[1].x + cur.x), y: 2 * (c[2].y - 2 * c[1].y + cur.y) };
          } else {
            d1 = {
              x: 3 * u * u * (c[1].x - cur.x) + 6 * u * t * (c[2].x - c[1].x) + 3 * t * t * (c[3].x - c[2].x),
              y: 3 * u * u * (c[1].y - cur.y) + 6 * u * t * (c[2].y - c[1].y) + 3 * t * t * (c[3].y - c[2].y)
            };
            d2 = {
              x: 6 * u * (c[2].x - 2 * c[1].x + cur.x) + 6 * t * (c[3].x - 2 * c[2].x + c[1].x),
              y: 6 * u * (c[2].y - 2 * c[1].y + cur.y) + 6 * t * (c[3].y - 2 * c[2].y + c[1].y)
            };
          }
          var v = Math.hypot(d1.x, d1.y), croix = Math.abs(d1.x * d2.y - d1.y * d2.x);
          if (v > 1e-9 && croix > 1e-9) mini = Math.min(mini, v * v * v / croix);
        }
      }
      cur = finCommande(c);
    });
    return mini;
  }

  /**
   * Tracés de tous les passages d'un modèle, en coordonnées locales canoniques :
   * [{ id, type: 'passage', cmds, pts (polyligne aplatie), cases: [case...], pivots: [id...], bouts: [{ p, n, idx }],
   *    controle: {x, y} (point de la poignée), parDefaut: booleen, rayonMin }].
   * `cmds` : commandes [['M', p], ...] de l'extrémité a vers l'extrémité b ; `bouts` : les extrémités sur un raccord
   * (point du bord et normale vers l'intérieur) ; une extrémité sur une case va jusqu'au centre de la case (le disque
   * blanc la recouvre), une extrémité sur un pivot jusqu'au pivot.
   * Formes par défaut (arrivée perpendiculaire au côté à chaque raccord) : côtés adjacents, quadratique dont le point de
   * contrôle est l'intersection des deux normales ; côtés opposés, segment droit ; même côté, demi-cercle en deux
   * cubiques ; raccord vers case ou pivot, quadratique qui part perpendiculairement au côté (quart de tour franc quand le but est
   * aussi décalé que profond, de plus en plus droit quand il est dans l'axe) ; sinon segment droit.
   * `courbe` {x, y} remplace la forme par une quadratique de ce point de contrôle. Les passages mal formés (extrémité
   * invalide, coin, case ou pivot inconnu, boucle) sont ignorés. Indépendant de tracesModele (les chemins ne changent pas).
   */
  function tracesPassages(m, fmt) {
    var F = fmt && typeof fmt === 'object' ? fmt : format(fmt === undefined || fmt === null ? FORMAT_DEFAUT : fmt);
    var cs = Object.create(null), pv = Object.create(null);
    (m && Array.isArray(m.cases) ? m.cases : []).forEach(function (c) {
      if (c && typeof c === 'object' && typeof c.id === 'string' && pointFini(c)) cs[c.id] = c;
    });
    (m && Array.isArray(m.pivots) ? m.pivots : []).forEach(function (p) {
      if (p && typeof p === 'object' && typeof p.id === 'string' && pointFini(p)) pv[p.id] = p;
    });
    function bout(e) {
      var t = typeExtremitePassage(e);
      if (t === 'case') return cs[e['case']] ? { p: { x: cs[e['case']].x, y: cs[e['case']].y }, n: null, caseObj: cs[e['case']] } : null;
      if (t === 'pivot') return pv[e.pivot] ? { p: { x: pv[e.pivot].x, y: pv[e.pivot].y }, n: null, pivot: e.pivot } : null;
      if (t === 'raccord' && raccordBienForme(e.raccord)) {
        var n = NORMALE[e.raccord.cote];
        return { p: F.pointRaccord(e.raccord.cote, e.raccord.pos), n: { x: n.x, y: n.y }, cote: e.raccord.cote };
      }
      return null;
    }
    function milieu(A, B) { return { x: (A.p.x + B.p.x) / 2, y: (A.p.y + B.p.y) / 2 }; }
    function ctrlDepuis(A, B) { // contrôle d'une quadratique qui part de A (normale n) perpendiculairement au côté
      // profondeur du but, décalage latéral : le virage est franc (quart de tour) quand le décalage est au moins égal à la
      // profondeur, et s'adoucit jusqu'au tracé droit quand le but est dans l'axe
      var d = (B.p.x - A.p.x) * A.n.x + (B.p.y - A.p.y) * A.n.y;
      var lat = Math.abs((B.p.x - A.p.x) * A.n.y - (B.p.y - A.p.y) * A.n.x);
      var l = Math.max(Math.min(d, lat), 8);
      return { x: A.p.x + A.n.x * l, y: A.p.y + A.n.y * l };
    }
    function demiCercle(A, B) {
      var mil = milieu(A, B), r = Math.hypot(B.p.x - A.p.x, B.p.y - A.p.y) / 2;
      var n = A.n, u = { x: (B.p.x - A.p.x) / (2 * r), y: (B.p.y - A.p.y) / (2 * r) }, k = K_ARC * r;
      var T = { x: mil.x + n.x * r, y: mil.y + n.y * r };
      return {
        cmds: [['C', { x: A.p.x + n.x * k, y: A.p.y + n.y * k }, { x: T.x - u.x * k, y: T.y - u.y * k }, T],
          ['C', { x: T.x + u.x * k, y: T.y + u.y * k }, { x: B.p.x + n.x * k, y: B.p.y + n.y * k }, { x: B.p.x, y: B.p.y }]],
        // poignée : point de contrôle de la quadratique qui monte au même sommet (profondeur 2 r), sans saut de forme au premier glissement
        controle: { x: mil.x + n.x * 2 * r, y: mil.y + n.y * 2 * r }
      };
    }
    function forme(A, B) { // { cmds (sans le M initial), controle }
      if (A.n && B.n) {
        var pS = A.n.x * B.n.x + A.n.y * B.n.y;
        if (pS > 0.5) return demiCercle(A, B);                                   // même côté
        if (pS < -0.5) return { cmds: [['L', B.p]], controle: milieu(A, B) };    // côtés opposés
        var dd = (B.p.x - A.p.x) * A.n.x + (B.p.y - A.p.y) * A.n.y;              // adjacents : intersection des deux normales
        var c = { x: A.p.x + A.n.x * dd, y: A.p.y + A.n.y * dd };
        return { cmds: [['Q', c, B.p]], controle: c };
      }
      if (A.n) { var cA = ctrlDepuis(A, B); return { cmds: [['Q', cA, B.p]], controle: cA }; }
      if (B.n) { var cB = ctrlDepuis(B, A); return { cmds: [['Q', cB, B.p]], controle: cB }; }
      return { cmds: [['L', B.p]], controle: milieu(A, B) };
    }
    var res = [];
    (m && Array.isArray(m.passages) ? m.passages : []).forEach(function (ps) {
      if (!ps || typeof ps !== 'object') return;
      var A = bout(ps.a), B = bout(ps.b);
      if (!A || !B || Math.hypot(A.p.x - B.p.x, A.p.y - B.p.y) < 1e-9) return;
      var parDefaut = !pointFini(ps.courbe), f;
      if (parDefaut) f = forme(A, B);
      else f = { cmds: [['Q', { x: ps.courbe.x, y: ps.courbe.y }, B.p]], controle: { x: ps.courbe.x, y: ps.courbe.y } };
      var cmds = [['M', { x: A.p.x, y: A.p.y }]].concat(f.cmds);
      var bouts = [];
      if (A.n) bouts.push({ p: A.p, n: A.n, idx: 0 });
      if (B.n) bouts.push({ p: B.p, n: B.n, idx: 1 });
      res.push({
        id: ps.id, type: 'passage', cmds: cmds, pts: aplatirCommandes(cmds),
        cases: [A.caseObj, B.caseObj].filter(Boolean), pivots: [A.pivot, B.pivot].filter(function (x) { return x !== undefined; }),
        bouts: bouts, controle: f.controle, parDefaut: parDefaut, rayonMin: rayonMinimal(cmds)
      });
    });
    return res;
  }

  var CACHE = {};

  /**
   * Objet gelé décrivant le format de grille `id` ('4x4' ou '5x5') : cotes, grille et fonctions du repère
   * local. Toujours le même objet pour un même id. Lève une Error si le format est inconnu.
   */
  function format(id) {
    if (IDS_FORMATS.indexOf(id) < 0) throw new Error('Format de grille inconnu : ' + String(id) + '.');
    if (!CACHE[id]) CACHE[id] = creerFormat(id);
    return CACHE[id];
  }

  // API historique : PM.geometrie.* est un alias du format 4×4 (non gelé : les tests peuvent ajuster une règle).
  PM.geometrie = {};
  var defaut = format(FORMAT_DEFAUT);
  Object.keys(defaut).forEach(function (k) { if (k !== 'id') PM.geometrie[k] = defaut[k]; });
  PM.geometrie.GABARITS = GABARITS;
  PM.geometrie.NORMALE = NORMALE;
  PM.geometrie.BISSECTRICE = BISSECTRICE;
  PM.geometrie.tracesModele = tracesModele;
  PM.geometrie.tracesPassages = tracesPassages;
  PM.geometrie.typeExtremitePassage = typeExtremitePassage;
  PM.geometrie.cleExtremitePassage = cleExtremitePassage;
  PM.geometrie.aplatirCommandes = aplatirCommandes;
  PM.geometrie.rayonMinimal = rayonMinimal;
  PM.geometrie.FORMATS = Object.freeze(IDS_FORMATS.slice());
  PM.geometrie.FORMAT_DEFAUT = FORMAT_DEFAUT;
  PM.geometrie.format = format;

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.geometrie;
})();
