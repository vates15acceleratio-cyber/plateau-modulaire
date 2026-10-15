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
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});
if (!PM.geometrie && typeof require === 'function') require('./geometrie.js'); // chargement sous Node

(function () {
  'use strict';

  var G = PM.geometrie;

  var AMORCE_RACCORD = 10;
  var AMORCE_PORT = 28;
  var NORMALE = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }]; // vers l'intérieur, par côté
  var BISSECTRICE = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }]
    .map(function (v) { return { x: v.x / Math.SQRT2, y: v.y / Math.SQRT2 }; }); // vers l'intérieur, par coin

  /** Palette d'impression (docs/6-avis-prepresse.md). */
  var COULEURS = { vert: '#007A4D', rouge: '#D8321C', noir: '#111111', blanc: '#FFFFFF' };

  function estCase(e) { return e && typeof e === 'object' && e['case'] !== undefined; }

  /**
   * Tracés de tous les chemins d'un modèle, en coordonnées locales canoniques.
   * Renvoie [{id, type: 'lien'|'raccord'|'port', cases: [case...], pts: [{x,y}...], raccord?, coin?}].
   * Les chemins mal formés (case inconnue, extrémité invalide) sont ignorés.
   */
  function tracesModele(m) {
    var cs = Object.create(null);
    (m && Array.isArray(m.cases) ? m.cases : []).forEach(function (c) {
      if (c && typeof c === 'object' && typeof c.id === 'string') cs[c.id] = c;
    });
    var res = [];
    (m && Array.isArray(m.chemins) ? m.chemins : []).forEach(function (ch) {
      if (!ch || typeof ch !== 'object') return;
      var ext = [ch.a, ch.b];
      var cases = ext.filter(estCase).map(function (e) { return cs[e['case']]; });
      if (cases.some(function (c) { return !c; }) || cases.length === 0) return;
      if (cases.length === 2) {
        res.push({ id: ch.id, type: 'lien', cases: cases, pts: [pt(cases[0]), pt(cases[1])] });
        return;
      }
      var o = ext.filter(function (e) { return !estCase(e); })[0], c = cases[0];
      if (o && o.raccord && o.raccord.cote >= 0 && o.raccord.cote <= 3 && o.raccord.pos >= 0 && o.raccord.pos <= 2) {
        var P = G.pointRaccord(o.raccord.cote, o.raccord.pos), n = NORMALE[o.raccord.cote];
        res.push({ id: ch.id, type: 'raccord', raccord: { cote: o.raccord.cote, pos: o.raccord.pos }, cases: cases,
          pts: [P, { x: P.x + AMORCE_RACCORD * n.x, y: P.y + AMORCE_RACCORD * n.y }, pt(c)] });
      } else if (o && o.coin >= 0 && o.coin <= 3) {
        var K = G.pointCoin(o.coin), b = BISSECTRICE[o.coin];
        res.push({ id: ch.id, type: 'port', coin: o.coin, cases: cases,
          pts: [K, { x: K.x + AMORCE_PORT * b.x, y: K.y + AMORCE_PORT * b.y }, pt(c)] });
      }
    });
    return res;
  }

  function pt(c) { return { x: c.x, y: c.y }; }

  /** Applique une rotation (quarts de tour horaires) aux points d'un tracé. */
  function tournerTrace(t, rot) {
    return Object.assign({}, t, { pts: t.pts.map(function (p) { return G.tournerPoint(p, rot); }) });
  }

  function f(n) { return Math.round(n * 1000) / 1000; }
  function chemin(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + f(p.x) + ' ' + f(p.y); }).join(' '); }
  function echapper(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /**
   * Contenu SVG (sans balise <svg>) d'une tuile dans le repère local 0..120, tournée de `rot`.
   * options : { rot = 0, joueur = null (1 | 2, pour les cases d'apparition), fondPerdu = 0 (mm, prolonge
   *   le fond et les chemins au-delà du bord), contour = true (trait de coupe fin), identifiant = null (texte) }.
   */
  function contenuTuile(m, options) {
    var o = options || {}, rot = o.rot || 0, fp = o.fondPerdu || 0, C = G.COTE, L = G.LARGEUR_CHEMIN;
    var s = [];
    s.push('<rect x="' + (-fp) + '" y="' + (-fp) + '" width="' + (C + 2 * fp) + '" height="' + (C + 2 * fp) + '" fill="' + COULEURS.blanc + '"/>');
    var ts = tracesModele(m).map(function (t) { return tournerTrace(t, rot); });
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
    (m && Array.isArray(m.cases) ? m.cases : []).forEach(function (c) {
      if (!c || typeof c !== 'object' || typeof c.x !== 'number' || typeof c.y !== 'number') return;
      var p = G.tournerPoint({ x: c.x, y: c.y }, rot), r = (c.diametre || G.DIAMETRE_CASE_MAX) / 2;
      if (c.type === 'apparition') {
        var cote = r * 1.8, rouge = o.joueur === 2;
        s.push('<rect x="' + f(p.x - cote / 2) + '" y="' + f(p.y - cote / 2) + '" width="' + f(cote) + '" height="' + f(cote) +
          '" rx="3" fill="' + COULEURS.blanc + '" stroke="' + COULEURS.noir + '" stroke-width="0.6" data-case="' + echapper(c.id) + '"/>');
        s.push('<rect x="' + f(p.x - cote / 2 + 1.5) + '" y="' + f(p.y - cote / 2 + 1.5) + '" width="' + f(cote - 3) + '" height="' + f(cote - 3) +
          '" rx="2" fill="none" stroke="' + (rouge ? COULEURS.rouge : COULEURS.vert) + '" stroke-width="1.2"' +
          (rouge ? ' stroke-dasharray="1.5 1.5"' : '') + '/>');
        if (o.joueur) {
          s.push('<text x="' + f(p.x) + '" y="' + f(p.y + 2.9) + '" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="8" text-anchor="middle" fill="' +
            COULEURS.noir + '">' + o.joueur + '</text>');
        }
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

  /** SVG autonome d'une tuile, à l'échelle réelle (attributs width / height en mm). */
  function svgTuile(m, options) {
    var o = options || {}, fp = o.fondPerdu || 0, C = G.COTE, t = C + 2 * fp;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + t + 'mm" height="' + t + 'mm" viewBox="' +
      (-fp) + ' ' + (-fp) + ' ' + t + ' ' + t + '">' + contenuTuile(m, o) + '</svg>';
  }

  /**
   * Contenu SVG d'un jeton centré en (cx, cy) : ville = disque noir + couronne crénelée blanche ;
   * carrefour = disque blanc + croix noire.
   */
  function contenuJeton(type, cx, cy) {
    var r = G.DIAMETRE_JETON / 2, s = [];
    if (type === 'capture') {
      s.push('<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + r + '" fill="' + COULEURS.noir + '"/>');
      var w = 14, h = 9, x0 = cx - w / 2, y0 = cy - h / 2 + 1, cr = 'M' + f(x0) + ' ' + f(y0 + h);
      cr += ' L' + f(x0) + ' ' + f(y0) + ' L' + f(x0 + 3.5) + ' ' + f(y0 + 3.5) + ' L' + f(cx) + ' ' + f(y0 - 1.5) +
        ' L' + f(x0 + w - 3.5) + ' ' + f(y0 + 3.5) + ' L' + f(x0 + w) + ' ' + f(y0) + ' L' + f(x0 + w) + ' ' + f(y0 + h) + ' Z';
      s.push('<path d="' + cr + '" fill="' + COULEURS.blanc + '"/>');
    } else {
      s.push('<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + r + '" fill="' + COULEURS.blanc + '" stroke="' + COULEURS.noir + '" stroke-width="0.6"/>');
      s.push('<path d="M' + f(cx - 7) + ' ' + f(cy) + ' H' + f(cx + 7) + ' M' + f(cx) + ' ' + f(cy - 7) + ' V' + f(cy + 7) +
        '" stroke="' + COULEURS.noir + '" stroke-width="2.4" stroke-linecap="round"/>');
    }
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
