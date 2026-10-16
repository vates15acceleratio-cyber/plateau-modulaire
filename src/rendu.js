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
 * Quart de case de jonction (docs/20 D1) : quart de disque Ø 20 centré sur chaque coin intérieur du gabarit,
 * fond blanc, contour noir sur l'arc seulement, par-dessus l'amorce du port.
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
  /** Nombre de segments du polygone qui approche l'arc d'un quart de case de jonction (le PDF ne lit que M L H V Z). */
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

  /** Applique une rotation (quarts de tour horaires) aux points d'un tracé, autour du centre de la tuile du format. */
  function tournerTrace(t, rot, format) {
    var F = leFormat(format);
    return Object.assign({}, t, { pts: t.pts.map(function (p) { return F.tournerPoint(p, rot); }) });
  }

  function f(n) { return Math.round(n * 1000) / 1000; }
  function chemin(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + f(p.x) + ' ' + f(p.y); }).join(' '); }
  function echapper(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /**
   * Quart de case de jonction du coin k (repère local, tuile tournée de `rot`) : polygone blanc (le quart de
   * disque, prolongé de `fp` dans le fond perdu) puis l'arc seul en noir.
   */
  function quartJonction(k, rot, fp, F) {
    var r = F.DIAMETRE_CASE_JONCTION / 2, e = Math.min(fp, r - 1), b = Math.sqrt(r * r - e * e);
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
   *   de case de jonction au-delà du bord), contour = true (trait de coupe fin), identifiant = null (texte),
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
    // Quarts de case de jonction sur les coins intérieurs du gabarit déclaré, même sans port
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
   * Contenu SVG d'une ville (jeton 'capture', seul type de jeton) centrée en (cx, cy) : disque noir + couronne
   * crénelée blanche. `format` : 4×4 par défaut (diamètre du jeton).
   */
  function contenuJeton(type, cx, cy, format) {
    var r = leFormat(format).DIAMETRE_JETON / 2, s = [];
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
    tournerTrace: tournerTrace,
    contenuTuile: contenuTuile,
    svgTuile: svgTuile,
    contenuJeton: contenuJeton
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.rendu;
})();
