/*
 * rendu.js : tracé des chemins et dessin SVG d'une tuile ou d'un jeton.
 * Aucun accès au DOM : produit des chaînes SVG (réutilisables à l'écran et à l'export).
 * Unité : mm. Repère local canonique (origine coin NO, x vers l'est, y vers le sud).
 *
 * Convention de tracé (validée par les tests du catalogue) :
 *  - chemin case-case : segment entre les centres ;
 *  - chemin vers un raccord : amorce perpendiculaire de 10 mm depuis le bord, puis segment vers la case ;
 *  - chemin vers un port de coin : amorce de 28 mm sur la bissectrice depuis le coin, puis segment vers la case.
 * Sur la tuile imprimée, raccords et ports sont prolongés jusqu'au bord (et dans le fond perdu).
 * Passages sans case : courbes (M L Q C) en vert comme les chemins, même largeur (voir tracesPassages et cheminPassage) ; les chemins restent droits.
 * Siège du campement (docs/20 D1, docs/18 du 2026-10-19) : quart de disque de la taille d'un jeton (Ø 30) centré sur
 * chaque coin intérieur du gabarit, fond blanc, contour noir sur l'arc seulement, par-dessus l'amorce du port. Les
 * quatre quarts forment, plateau assemblé, le cercle où l'on pose un jeton campement ou un jeton ville.
 * Case d'apparition (docs/20 D3) : carré inscrit dans le disque, noir et blanc à l'impression ; à l'écran,
 * option `camp` : couleur du camp ET forme distincte (triangle vers le nord pour le vert, vers le sud pour le
 * rouge, carré en tirets pour une case neutre).
 * Format de grille : paramètre ou option `format` (objet de PM.geometrie.format ou identifiant), 4×4 par défaut.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});
if (!PM.geometrie && typeof require === 'function') require('./geometrie.js'); // chargement sous Node

(function () {
  'use strict';

  var G = PM.geometrie;

  var AMORCE_RACCORD = G.AMORCE_RACCORD; // valeurs du format 4×4, gardées pour l'API
  var AMORCE_PORT = G.AMORCE_PORT;
  /** Nombre de segments du polygone qui approche l'arc d'un quart de siège de campement. */
  var SEGMENTS_ARC = 16;

  /** Palette d'impression (docs/archives/6-avis-prepresse.md) ; `neutre` sert seulement à l'écran. */
  var COULEURS = { vert: '#007A4D', rouge: '#D8321C', noir: '#111111', blanc: '#FFFFFF', neutre: '#7A7F76' };

  /** Format de grille à partir d'un objet format, d'un identifiant ou de rien (4×4). */
  function leFormat(f) {
    if (f && typeof f === 'object') return f;
    return G.format(f === undefined || f === null ? G.FORMAT_DEFAUT : f);
  }

  /**
   * Tracés de tous les chemins d'un modèle, en coordonnées locales canoniques : voir PM.geometrie.tracesModele.
   * Renvoie [{id, type: 'lien'|'raccord'|'port', cases: [case...], pts: [{x,y}...], raccord?, coin?}].
   */
  function tracesModele(m, format) { return G.tracesModele(m, leFormat(format)); }

  /**
   * Tracés des passages sans case d'un modèle (courbes), en coordonnées locales canoniques : voir PM.geometrie.tracesPassages.
   * Renvoie [{id, type: 'passage', cmds, pts, cases, pivots, bouts, controle, parDefaut, rayonMin}].
   */
  function tracesPassages(m, format) { return G.tracesPassages(m, leFormat(format)); }

  /** Rotation d'un tracé de passage (points, commandes de courbe, bouts et normales, point de contrôle). */
  function tournerTracePassage(t, rot, format) {
    var F = leFormat(format), n = ((rot % 4) + 4) % 4;
    function pt(p) { return F.tournerPoint(p, rot); }
    function vec(v) { var x = v.x, y = v.y, k, tmp; for (k = 0; k < n; k++) { tmp = x; x = -y; y = tmp; } return { x: x, y: y }; }
    return Object.assign({}, t, {
      cmds: t.cmds.map(function (c) { return [c[0]].concat(c.slice(1).map(pt)); }),
      pts: t.pts.map(pt),
      bouts: t.bouts.map(function (b) { return { p: pt(b.p), n: vec(b.n), idx: b.idx }; }),
      controle: pt(t.controle)
    });
  }

  /** Attribut `d` d'un passage (commandes M L Q C absolues) ; les bouts sur un raccord sont prolongés de `fp` dans le fond perdu. */
  function cheminPassage(t, fp) {
    var cmds = t.cmds.map(function (c) { return [c[0]].concat(c.slice(1)); }), res = [];
    var debut = t.bouts.filter(function (b) { return b.idx === 0; })[0], fin = t.bouts.filter(function (b) { return b.idx === 1; })[0];
    function dehors(b) { return { x: b.p.x - b.n.x * fp, y: b.p.y - b.n.y * fp }; }
    if (debut && fp > 0) {
      cmds.splice(1, 0, ['L', cmds[0][1]]); // le départ d'origine devient le premier segment droit
      cmds[0] = ['M', dehors(debut)];
    }
    if (fin && fp > 0) cmds.push(['L', dehors(fin)]);
    cmds.forEach(function (c) { res.push(c[0] + c.slice(1).map(function (p) { return f(p.x) + ' ' + f(p.y); }).join(' ')); });
    return res.join(' ');
  }

  /** Applique une rotation (quarts de tour horaires) aux points d'un tracé, autour du centre de la tuile du format. */
  function tournerTrace(t, rot, format) {
    var F = leFormat(format);
    return Object.assign({}, t, { pts: t.pts.map(function (p) { return F.tournerPoint(p, rot); }) });
  }

  function f(n) { return Math.round(n * 1000) / 1000; }
  function chemin(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + f(p.x) + ' ' + f(p.y); }).join(' '); }
  function echapper(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /**
   * Quart de siège de campement du coin k (repère local, tuile tournée de `rot`) : polygone blanc (le quart de
   * disque Ø DIAMETRE_JETON, prolongé de `fp` dans le fond perdu) puis l'arc seul en noir.
   */
  function quartJonction(k, rot, fp, F) {
    var r = F.DIAMETRE_JETON / 2, e = Math.min(fp, r - 1), b = Math.sqrt(r * r - e * e);
    var a1 = Math.atan2(b, -e), a2 = Math.atan2(-e, b), arc = [];
    for (var n = 0; n <= SEGMENTS_ARC; n++) {
      var a = a1 + (a2 - a1) * n / SEGMENTS_ARC;
      arc.push(F.tournerPoint({ x: r * Math.cos(a), y: r * Math.sin(a) }, k + rot));
    }
    var fond = arc.concat([F.tournerPoint({ x: -e, y: -e }, k + rot)]);
    return '<path d="' + chemin(fond) + ' Z" fill="' + COULEURS.blanc + '"/>' +
      '<path d="' + chemin(arc) + '" fill="none" stroke="' + COULEURS.noir + '" stroke-width="0.6" data-quart-jonction="' + k + '"/>';
  }

  /**
   * Case d'apparition centrée en p, rayon r : disque blanc, carré inscrit noir (impression) ; à l'écran,
   * `camp` ('vert' | 'rouge' | 'neutre') ajoute la couleur et une forme propre au camp.
   */
  function caseApparition(c, p, r, camp) {
    var cote = r * Math.SQRT2 - 3, h = cote / 2, s = [];
    var couleur = camp === 'vert' ? COULEURS.vert : camp === 'rouge' ? COULEURS.rouge : camp === 'neutre' ? COULEURS.neutre : COULEURS.noir;
    s.push('<circle cx="' + f(p.x) + '" cy="' + f(p.y) + '" r="' + f(r) + '" fill="' + COULEURS.blanc +
      '" stroke="' + COULEURS.noir + '" stroke-width="0.6" data-case="' + echapper(c.id) + '"/>');
    s.push('<rect x="' + f(p.x - h) + '" y="' + f(p.y - h) + '" width="' + f(cote) + '" height="' + f(cote) + '" fill="none" stroke="' + couleur +
      '" stroke-width="' + (camp ? 1.2 : 1.0) + '"' + (camp === 'neutre' ? ' stroke-dasharray="1.5 1.5"' : '') + ' data-apparition="' + (camp || 'impression') + '"/>');
    if (camp === 'vert' || camp === 'rouge') {
      var t = h * 0.6, sens = camp === 'vert' ? -1 : 1; // pointe vers le camp : nord pour le vert, sud pour le rouge
      s.push('<path d="M' + f(p.x) + ' ' + f(p.y + sens * t) + ' L' + f(p.x + t) + ' ' + f(p.y - sens * t * 0.7) + ' L' + f(p.x - t) + ' ' +
        f(p.y - sens * t * 0.7) + ' Z" fill="' + couleur + '"/>');
    }
    return s.join('');
  }

  /**
   * Contenu SVG (sans balise <svg>) d'une tuile dans le repère local 0..COTE (120 mm en 4×4), tournée de `rot`.
   * options : { rot = 0, camp = null (écran seulement : 'vert' | 'rouge' | 'neutre' pour les cases d'apparition ;
   *   absent = rendu d'impression noir et blanc), fondPerdu = 0 (mm, prolonge le fond, les chemins et les quarts
   *   de siège de campement au-delà du bord), contour = true (trait de coupe fin), identifiant = null (texte),
   *   format = 4×4 (objet de PM.geometrie.format ou identifiant) }.
   */
  function contenuTuile(m, options) {
    var o = options || {}, F = leFormat(o.format), rot = o.rot || 0, fp = o.fondPerdu || 0, C = F.COTE, L = F.LARGEUR_CHEMIN;
    var camp = ['vert', 'rouge', 'neutre'].indexOf(o.camp) >= 0 ? o.camp : null;
    var s = [];
    s.push('<rect x="' + (-fp) + '" y="' + (-fp) + '" width="' + (C + 2 * fp) + '" height="' + (C + 2 * fp) + '" fill="' + COULEURS.blanc + '"/>');
    var ts = tracesModele(m, F).map(function (t) { return tournerTrace(t, rot, F); });
    // Les raccords et ports sont prolongés au-delà du bord de la valeur du fond perdu.
    ts.forEach(function (t) {
      var pts = t.pts.slice();
      if (t.type !== 'lien' && fp > 0) {
        var a = pts[0], b = pts[1], d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        var k = fp * (t.type === 'port' ? Math.SQRT2 : 1) / d;
        pts.unshift({ x: a.x - (b.x - a.x) * k, y: a.y - (b.y - a.y) * k });
      }
      s.push('<path d="' + chemin(pts) + '" fill="none" stroke="' + COULEURS.vert + '" stroke-width="' + L +
        '" stroke-linecap="butt" stroke-linejoin="round" data-chemin="' + echapper(t.id) + '"/>');
    });
    // Passages sans case : courbes vertes comme les chemins (même largeur), prolongées dans le fond perdu aux raccords ;
    // un disque de la largeur du trait rend propre la rencontre des branches d'un pivot
    var degrePivot = Object.create(null);
    tracesPassages(m, F).forEach(function (t) {
      t.pivots.forEach(function (id) { degrePivot[id] = (degrePivot[id] || 0) + 1; });
      var tt = tournerTracePassage(t, rot, F);
      s.push('<path d="' + cheminPassage(tt, fp) + '" fill="none" stroke="' + COULEURS.vert + '" stroke-width="' + L +
        '" stroke-linecap="butt" stroke-linejoin="round" data-passage="' + echapper(t.id) + '"/>');
    });
    (m && Array.isArray(m.pivots) ? m.pivots : []).forEach(function (pv) {
      if (!pv || typeof pv !== 'object' || typeof pv.x !== 'number' || typeof pv.y !== 'number' || !isFinite(pv.x) || !isFinite(pv.y)) return;
      if ((degrePivot[pv.id] || 0) < 2) return; // pivot sans branche ou en bout d'une seule : rien à imprimer (docs/41 C3)
      var p = F.tournerPoint({ x: pv.x, y: pv.y }, rot);
      s.push('<circle cx="' + f(p.x) + '" cy="' + f(p.y) + '" r="' + f(L / 2) + '" fill="' + COULEURS.vert + '" data-pivot="' + echapper(pv.id) + '"/>');
    });
    // Quarts de siège de campement sur les coins intérieurs du gabarit déclaré, même sans port
    var gabarit = m && Object.prototype.hasOwnProperty.call(G.GABARITS, m.gabarit) ? G.GABARITS[m.gabarit] : null;
    if (gabarit) gabarit.coinsInterieurs.forEach(function (k) { s.push(quartJonction(k, rot, fp, F)); });
    (m && Array.isArray(m.cases) ? m.cases : []).forEach(function (c) {
      if (!c || typeof c !== 'object' || typeof c.x !== 'number' || typeof c.y !== 'number') return;
      var p = F.tournerPoint({ x: c.x, y: c.y }, rot), r = (c.diametre || F.DIAMETRE_CASE) / 2;
      if (c.type === 'apparition') {
        s.push(caseApparition(c, p, r, camp));
      } else {
        s.push('<circle cx="' + f(p.x) + '" cy="' + f(p.y) + '" r="' + f(r) + '" fill="' + COULEURS.blanc +
          '" stroke="' + COULEURS.noir + '" stroke-width="0.6" data-case="' + echapper(c.id) + '"/>');
      }
    });
    if (o.identifiant) {
      s.push('<text x="5" y="10" font-family="Helvetica, Arial, sans-serif" font-size="2.5" fill="' + COULEURS.noir + '">' + echapper(o.identifiant) + '</text>');
    }
    if (o.contour !== false) {
      s.push('<rect x="0" y="0" width="' + C + '" height="' + C + '" fill="none" stroke="' + COULEURS.noir + '" stroke-width="0.25"/>');
    }
    return s.join('');
  }

  /** SVG autonome d'une tuile, à l'échelle réelle (attributs width / height en mm). Options : voir contenuTuile. */
  function svgTuile(m, options) {
    var o = options || {}, fp = o.fondPerdu || 0, C = leFormat(o.format).COTE, t = C + 2 * fp;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + t + 'mm" height="' + t + 'mm" viewBox="' +
      (-fp) + ' ' + (-fp) + ' ' + t + ' ' + t + '">' + contenuTuile(m, o) + '</svg>';
  }

  /**
   * Jeton campement centré en (cx, cy), même taille qu'une ville : disque blanc, anneau noir rentré de 1,6 mm (la coupe
   * à ± 0,3 mm ne le rend pas inégal), feu de bois noir (deux bûches croisées à bouts ronds, cernes blancs aux bouts
   * avant, flamme pleine à deux pointes cernée de blanc, cœur blanc). Noir et blanc seulement : lisible sans la couleur,
   * neutre (ni vert ni rouge, couleurs des camps) et symétrique de la ville (couronne blanche sur disque noir).
   * Primitives limitées au sous-ensemble du convertisseur PDF de export.js (circle, path M L C Z).
   */
  function contenuCampement(cx, cy, r) {
    var N = COULEURS.noir, B = COULEURS.blanc, k = r / 15, s = [];
    function P(dx, dy) { return f(cx + dx * k) + ' ' + f(cy + dy * k); }
    s.push('<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '" fill="' + B + '"/>');
    s.push('<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r - 1.6 * k) + '" fill="none" stroke="' + N + '" stroke-width="' + f(0.8 * k) + '"/>');
    // Bûches : deux traits de 3,2 mm inclinés de ± 20°, croisés sous la flamme
    var yb = 6.2, dx = 7.2 * Math.cos(Math.PI / 9), dy = 7.2 * Math.sin(Math.PI / 9);
    [1, -1].forEach(function (sg) {
      s.push('<path d="M' + P(-dx, yb - sg * dy) + ' L' + P(dx, yb + sg * dy) + '" fill="none" stroke="' + N + '" stroke-width="' + f(3.2 * k) +
        '" stroke-linecap="round" data-campement="buche"/>');
      s.push('<circle cx="' + f(cx + sg * dx * k) + '" cy="' + f(cy + (yb + dy) * k) + '" r="' + f(0.7 * k) + '" fill="' + B + '"/>');
    });
    // Flamme : goutte à deux pointes (la grande à droite), cernée de blanc pour se détacher des bûches
    s.push('<path d="M' + P(0, 5.2) + ' C' + P(-4.6, 5.2) + ' ' + P(-6, 1) + ' ' + P(-4.2, -2.6) + ' C' + P(-3.4, -4.3) + ' ' + P(-2.6, -5.4) + ' ' +
      P(-2.2, -7.4) + ' C' + P(-1, -5.6) + ' ' + P(-0.4, -4.6) + ' ' + P(0, -3.6) + ' C' + P(0.6, -6.4) + ' ' + P(1.6, -9) + ' ' + P(0.8, -11.2) +
      ' C' + P(4.4, -8.4) + ' ' + P(6.2, -3.4) + ' ' + P(5, 0.8) + ' C' + P(4.4, 3.6) + ' ' + P(2.6, 5.2) + ' ' + P(0, 5.2) + ' Z" fill="' + N +
      '" stroke="' + B + '" stroke-width="' + f(0.7 * k) + '" stroke-linejoin="round" data-campement="flamme"/>');
    // Cœur de la flamme, en blanc
    s.push('<path d="M' + P(0, 4) + ' C' + P(-2.4, 4) + ' ' + P(-2.8, 1.2) + ' ' + P(-1.6, -0.8) + ' C' + P(-1, -1.8) + ' ' + P(-0.2, -2.6) + ' ' +
      P(0.2, -4.4) + ' C' + P(1.8, -2.6) + ' ' + P(2.8, -0.4) + ' ' + P(2.4, 1.6) + ' C' + P(2.1, 3.2) + ' ' + P(1.2, 4) + ' ' + P(0, 4) + ' Z" fill="' + B + '"/>');
    return s.join('');
  }

  /**
   * Contenu SVG d'un jeton centré en (cx, cy) : ville ('capture') = disque noir + couronne crénelée blanche ;
   * campement ('campement') = disque blanc + feu de bois noir (voir contenuCampement). Tout autre type est dessiné
   * comme une ville. `format` : 4×4 par défaut (diamètre du jeton, Ø 30 dans les deux formats).
   */
  function contenuJeton(type, cx, cy, format) {
    var r = leFormat(format).DIAMETRE_JETON / 2, s = [];
    if (type === 'campement') return contenuCampement(cx, cy, r);
    s.push('<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + r + '" fill="' + COULEURS.noir + '"/>');
    var w = 14, h = 9, x0 = cx - w / 2, y0 = cy - h / 2 + 1, cr = 'M' + f(x0) + ' ' + f(y0 + h);
    cr += ' L' + f(x0) + ' ' + f(y0) + ' L' + f(x0 + 3.5) + ' ' + f(y0 + 3.5) + ' L' + f(cx) + ' ' + f(y0 - 1.5) +
      ' L' + f(x0 + w - 3.5) + ' ' + f(y0 + 3.5) + ' L' + f(x0 + w) + ' ' + f(y0) + ' L' + f(x0 + w) + ' ' + f(y0 + h) + ' Z';
    s.push('<path d="' + cr + '" fill="' + COULEURS.blanc + '"/>');
    return s.join('');
  }

  PM.rendu = {
    AMORCE_RACCORD: AMORCE_RACCORD,
    AMORCE_PORT: AMORCE_PORT,
    COULEURS: COULEURS,
    tracesModele: tracesModele,
    tracesPassages: tracesPassages,
    tournerTrace: tournerTrace,
    tournerTracePassage: tournerTracePassage,
    cheminPassage: cheminPassage,
    contenuTuile: contenuTuile,
    svgTuile: svgTuile,
    contenuJeton: contenuJeton
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.rendu;
})();
