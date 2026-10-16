/*
 * editeur-tuile.js : écran d'édition d'un modèle de tuile (onglet « Tuiles »).
 *
 * Deux parties :
 *  1. des fonctions PURES (géométrie d'écran, édition d'un modèle, aide à l'affichage),
 *     sans accès au DOM, testées sous Node (tests/editeur-tuile.test.js) ;
 *  2. `monter(conteneur, etat)` : le DOM, les événements Pointer et le clavier.
 *
 * Toute modification du document passe par etat.appliquer(...) avec PM.modele.remplacerModele
 * (ou ajouterModele / changerExemplaires) : l'historique et la sauvegarde sont gérés par l'état.
 * Le modèle est édité en orientation canonique (repère local 0..COTE mm, 120 en 4×4, origine au coin NO),
 * avec le format de grille du document (PM.modele.formatDuDocument).
 *
 * Règles v2 (docs/20 D2) : seules les erreurs physiques rendent la tuile non posable ; les alertes (R1 à R4,
 * côtés et coins extérieurs du gabarit, apparitions) s'affichent sans bloquer. Le gabarit (centrale, bord, coin)
 * est déclaré, jamais bloquant ; raccords et coins extérieurs restent utilisables (avec une alerte).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});
if (!PM.geometrie && typeof require === 'function') require('./geometrie.js'); // chargement sous Node
if (!PM.modele && typeof require === 'function') require('./modele.js');
if (!PM.rendu && typeof require === 'function') require('./rendu.js');

(function () {
  'use strict';

  var G = PM.geometrie;
  var M = PM.modele;
  var R = PM.rendu;

  /* ------------------------------------------------------------------ */
  /* Constantes                                                          */
  /* ------------------------------------------------------------------ */

  /** Diamètre d'une case neuve (mm), identique à celui du catalogue. */
  var DIAMETRE_DEFAUT = 24;
  /** Format de grille à partir d'un objet format, d'un identifiant ou de rien (4×4). */
  function leFormat(f) {
    if (f && typeof f === 'object') return f;
    return G.format(f === undefined || f === null ? G.FORMAT_DEFAUT : f);
  }
  /** Zone visible du canevas (mm) pour un format : la tuile plus une marge pour les demi-disques et les coins. */
  function vuePour(format) {
    var C = leFormat(format).COTE;
    return { x: -16, y: -16, l: C + 32, h: C + 32 };
  }
  /** Pas de la grille d'aimantation des cases : 1 cm (valeur du format 4×4, gardée pour l'API). */
  var PAS_GRILLE = G.PAS_EDITEUR;
  /** Zone visible du canevas en 4×4 (valeur gardée pour l'API). */
  var VUE = vuePour();
  /** Rayon des cibles cliquables (mm, indépendants du format). */
  var RAYON_RACCORD = 6;
  var RAYON_COIN = 9;
  var TOLERANCE_CHEMIN = 4;
  /** Déplacement minimal (pixels écran) pour qu'un appui devienne un glissement. */
  var SEUIL_GLISSEMENT_PX = 4;

  var NOMS_COTES = ['nord', 'est', 'sud', 'ouest'];
  var NOMS_COINS = ['NO', 'NE', 'SE', 'SO'];
  var LIBELLES_GABARITS = { centrale: 'Centrale', bord: 'Bord', coin: 'Coin' };
  var PREFIXE_CASE = 'c';
  var PREFIXE_CHEMIN = 'h';

  /**
   * Cases de départ par gabarit, en fraction du côté de tuile (aimantées sur la grille du format) ; la première
   * case d'un bord ou d'un coin est sa case d'apparition (docs/18 : toutes les tuiles du pourtour en portent une).
   */
  var CASES_DE_DEPART = {
    centrale: [[0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.3, 0.7]],
    bord: [[0.5, 0.33], [0.25, 0.75], [0.75, 0.75]],
    coin: [[0.35, 0.35], [0.75, 0.75]]
  };

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function tab(x) { return Array.isArray(x) ? x : []; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function arrondi(n) { return Math.round(n * 1000) / 1000; }
  function cm(mm) { return String(arrondi(mm / 10)).replace('.', ','); }
  function echapper(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /** Gabarit connu (description de PM.geometrie.GABARITS) ou null. */
  function gabaritDe(nom) { return Object.prototype.hasOwnProperty.call(G.GABARITS, nom) ? G.GABARITS[nom] : null; }
  /** Le côté est-il extérieur pour ce gabarit ? (un raccord y serait face au vide : alerte, pas de refus) */
  function raccordExterieur(gabarit, cote) {
    var g = gabaritDe(gabarit);
    return !!g && g.cotesExterieurs.indexOf(cote) >= 0;
  }
  /** Le coin est-il extérieur pour ce gabarit ? (un port n'y aboutirait à aucune jonction : alerte, pas de refus) */
  function coinExterieur(gabarit, k) {
    var g = gabaritDe(gabarit);
    return !!g && g.coinsInterieurs.indexOf(k) < 0;
  }

  /** Type d'une extrémité de chemin : 'case' | 'raccord' | 'coin' | null. */
  function typeExt(e) {
    if (!e || typeof e !== 'object') return null;
    if (e['case'] !== undefined) return 'case';
    if (e.raccord !== undefined) return 'raccord';
    if (e.coin !== undefined) return 'coin';
    return null;
  }
  function cleExt(e) {
    var t = typeExt(e);
    if (t === 'case') return 'case:' + e['case'];
    if (t === 'raccord') return 'raccord:' + e.raccord.cote + ':' + e.raccord.pos;
    return 'coin:' + e.coin;
  }
  function caseParId(m, id) {
    var cs = tab(m && m.cases);
    for (var i = 0; i < cs.length; i++) if (cs[i] && cs[i].id === id) return cs[i];
    return null;
  }

  /* ------------------------------------------------------------------ */
  /* Conversion écran <-> mm                                             */
  /* ------------------------------------------------------------------ */

  /** Échelle (px par mm) et décalage d'une zone SVG dont le viewBox est `vue`, avec preserveAspectRatio « meet ». */
  function echelleVue(rect, vue) {
    vue = vue || VUE;
    var e = Math.min(rect.width / vue.l, rect.height / vue.h);
    return {
      e: e,
      ox: rect.left + (rect.width - vue.l * e) / 2,
      oy: rect.top + (rect.height - vue.h * e) / 2
    };
  }
  /** Pixels écran (clientX, clientY) -> mm. `rect` : { left, top, width, height } de l'élément SVG. */
  function ecranVersMm(px, py, rect, vue) {
    vue = vue || VUE;
    var s = echelleVue(rect, vue);
    return { x: vue.x + (px - s.ox) / s.e, y: vue.y + (py - s.oy) / s.e };
  }
  /** mm -> pixels écran (réciproque de ecranVersMm). */
  function mmVersEcran(x, y, rect, vue) {
    vue = vue || VUE;
    var s = echelleVue(rect, vue);
    return { x: s.ox + (x - vue.x) * s.e, y: s.oy + (y - vue.y) * s.e };
  }

  /* ------------------------------------------------------------------ */
  /* Aimantation                                                         */
  /* ------------------------------------------------------------------ */

  /**
   * Point de la grille de 1 cm le plus proche de (x, y) où une case de ce diamètre respecte la marge
   * de coupe et les zones de coin. Renvoie { x, y } (mm). `format` : 4×4 par défaut.
   */
  function aimanter(x, y, diametre, format) {
    var F = leFormat(format), pas = F.PAS_EDITEUR, r = (diametre || DIAMETRE_DEFAUT) / 2;
    var mini = F.MARGE_COUPE_CASE + r, maxi = F.COTE - F.MARGE_COUPE_CASE - r;
    var zone = F.RAYON_ZONE_COIN + r;
    var meilleur = null, dMeilleur = Infinity;
    var debut = Math.ceil(mini / pas), fin = Math.floor(maxi / pas);
    for (var i = debut; i <= fin; i++) {
      for (var j = debut; j <= fin; j++) {
        var gx = i * pas, gy = j * pas, ok = true;
        for (var k = 0; k < 4; k++) {
          var c = F.pointCoin(k);
          if (dist(gx, gy, c.x, c.y) < zone) { ok = false; break; }
        }
        if (!ok) continue;
        var d = dist(gx, gy, x, y);
        if (d < dMeilleur - 1e-9) { dMeilleur = d; meilleur = { x: gx, y: gy }; }
      }
    }
    return meilleur || { x: F.COTE / 2, y: F.COTE / 2 };
  }

  /* ------------------------------------------------------------------ */
  /* Édition d'un modèle (fonctions pures : renvoient un nouveau modèle) */
  /* Elles lèvent une Error (phrase affichable) si l'action est refusée. */
  /* ------------------------------------------------------------------ */

  /**
   * Modèle de départ d'un gabarit pour le format `format` (4×4 par défaut) : quelques cases à des positions
   * valides, aucun chemin (les cases isolées sont des erreurs jusqu'à ce qu'on les relie).
   */
  function modeleDeDepart(gabarit, idsExistants, format) {
    if (M.GABARITS.indexOf(gabarit) < 0) throw new Error('Gabarit inconnu : ' + gabarit + '.');
    var F = leFormat(format);
    // nouvelId ne lit que cases / chemins : on lui présente les ids des modèles comme des cases.
    var id = M.nouvelId({ cases: tab(idsExistants).map(function (i) { return { id: i }; }) }, 'modele-');
    var m = { id: id, nom: 'Nouvelle tuile ' + LIBELLES_GABARITS[gabarit].toLowerCase(), gabarit: gabarit, grille: F.id, exemplaires: 1, cases: [], chemins: [] };
    CASES_DE_DEPART[gabarit].forEach(function (f, i) {
      var p = aimanter(f[0] * F.COTE, f[1] * F.COTE, DIAMETRE_DEFAUT, F);
      m.cases.push({
        id: PREFIXE_CASE + (i + 1), x: p.x, y: p.y, diametre: DIAMETRE_DEFAUT,
        type: gabarit !== 'centrale' && i === 0 ? 'apparition' : 'deplacement'
      });
    });
    return m;
  }

  /** Copie d'un modèle sous un nouvel identifiant (1 exemplaire, nom « … (copie) »). */
  function dupliquer(modele, idsExistants) {
    var c = clone(modele);
    c.id = M.nouvelId({ cases: tab(idsExistants).map(function (i) { return { id: i }; }) }, 'modele-');
    c.nom = (modele.nom || modele.id) + ' (copie)';
    c.exemplaires = 1;
    return c;
  }

  /** Ajoute une case au point de grille le plus proche de (x, y). `format` : 4×4 par défaut. */
  function ajouterCase(modele, x, y, type, format) {
    var m = clone(modele);
    if (!Array.isArray(m.cases)) m.cases = [];
    var p = aimanter(x, y, DIAMETRE_DEFAUT, format);
    m.cases.push({ id: M.nouvelId(m, PREFIXE_CASE), x: p.x, y: p.y, diametre: DIAMETRE_DEFAUT, type: type || 'deplacement' });
    return m;
  }

  /** Déplace une case (position aimantée sur la grille de 1 cm). `format` : 4×4 par défaut. */
  function deplacerCase(modele, id, x, y, format) {
    var m = clone(modele), c = caseParId(m, id);
    if (!c) throw new Error('Case introuvable.');
    var p = aimanter(x, y, c.diametre, format);
    c.x = p.x; c.y = p.y;
    return m;
  }

  /** Bascule une case entre « deplacement » et « apparition ». */
  function basculerType(modele, id) {
    var m = clone(modele), c = caseParId(m, id);
    if (!c) throw new Error('Case introuvable.');
    c.type = c.type === 'apparition' ? 'deplacement' : 'apparition';
    return m;
  }

  /**
   * Ajoute un chemin entre deux extrémités : { 'case': id } | { raccord: {cote, pos} } | { coin: k }.
   * Refus : pas de case aux extrémités, boucle, doublon, case inconnue.
   * Le reste (raccord déjà pris, côté extérieur, deux ports sur une case…) est accepté : la validation le signale.
   */
  function ajouterChemin(modele, a, b) {
    var ta = typeExt(a), tb = typeExt(b);
    if (!ta || !tb) throw new Error('Extrémité de chemin invalide.');
    if (ta !== 'case' && tb !== 'case') throw new Error('Un chemin part toujours d\'une case : choisissez une case comme extrémité.');
    if (cleExt(a) === cleExt(b)) throw new Error('Un chemin ne peut pas relier un point à lui-même.');
    var m = clone(modele);
    [a, b].forEach(function (e) {
      if (typeExt(e) === 'case' && !caseParId(m, e['case'])) throw new Error('Cette case n\'existe pas.');
    });
    var cle = [cleExt(a), cleExt(b)].sort().join('|');
    if (tab(m.chemins).some(function (ch) { return ch && [cleExt(ch.a), cleExt(ch.b)].sort().join('|') === cle; })) {
      throw new Error('Ces deux points sont déjà reliés par un chemin.');
    }
    if (!Array.isArray(m.chemins)) m.chemins = [];
    // convention : la case en premier quand il y en a une seule
    var debut = ta === 'case' ? a : b, fin = ta === 'case' ? b : a;
    m.chemins.push({ id: M.nouvelId(m, PREFIXE_CHEMIN), a: clone(debut), b: clone(fin) });
    return m;
  }

  /**
   * Supprime un élément désigné par une référence :
   * { type: 'case', id } (retire aussi ses chemins), { type: 'chemin', id },
   * { type: 'coin', id: k } ou { type: 'raccord', cote, pos } (retirent les chemins qui y aboutissent).
   */
  function supprimer(modele, ref) {
    var m = clone(modele), avant = tab(m.chemins).length, nbCases = tab(m.cases).length;
    if (!ref || typeof ref !== 'object') throw new Error('Rien à supprimer.');
    function touche(ch, fn) { return fn(ch.a) || fn(ch.b); }
    if (ref.type === 'case') {
      m.cases = tab(m.cases).filter(function (c) { return c.id !== ref.id; });
      if (m.cases.length === nbCases) throw new Error('Case introuvable.');
      m.chemins = tab(m.chemins).filter(function (ch) { return !touche(ch, function (e) { return typeExt(e) === 'case' && e['case'] === ref.id; }); });
    } else if (ref.type === 'chemin') {
      m.chemins = tab(m.chemins).filter(function (ch) { return ch.id !== ref.id; });
      if (m.chemins.length === avant) throw new Error('Chemin introuvable.');
    } else if (ref.type === 'coin') {
      m.chemins = tab(m.chemins).filter(function (ch) { return !touche(ch, function (e) { return typeExt(e) === 'coin' && e.coin === ref.id; }); });
      if (m.chemins.length === avant) throw new Error('Aucun chemin n\'aboutit à ce coin.');
    } else if (ref.type === 'raccord') {
      m.chemins = tab(m.chemins).filter(function (ch) {
        return !touche(ch, function (e) { return typeExt(e) === 'raccord' && e.raccord.cote === ref.cote && e.raccord.pos === ref.pos; });
      });
      if (m.chemins.length === avant) throw new Error('Aucun chemin n\'aboutit à ce raccord.');
    } else {
      throw new Error('Élément non supprimable.');
    }
    return m;
  }

  /** Change le gabarit déclaré (jamais bloquant, même pour un modèle posé). */
  function changerGabarit(modele, gabarit) {
    if (M.GABARITS.indexOf(gabarit) < 0) throw new Error('Gabarit inconnu : ' + gabarit + '.');
    var m = clone(modele);
    m.gabarit = gabarit;
    return m;
  }

  function renommer(modele, nom) {
    var m = clone(modele);
    m.nom = String(nom).trim();
    return m;
  }

  /** Nombre de tuiles posées sur le plateau qui utilisent ce modèle. */
  function nbUtilisations(doc, id) {
    return tab(doc && doc.plateau && doc.plateau.tuiles).filter(function (t) { return t && t.modeleId === id; }).length;
  }

  /* ------------------------------------------------------------------ */
  /* Cibles, halos, marquages (pur)                                      */
  /* ------------------------------------------------------------------ */

  function distanceSegment(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
    return dist(px, py, a.x + t * dx, a.y + t * dy);
  }

  /**
   * Élément sous le point (x, y) en mm : raccord, coin, case, chemin, sinon null.
   * Renvoie { type: 'raccord', cote, pos, exterieur } | { type: 'coin', coin, exterieur } | { type: 'case', id }
   * | { type: 'chemin', id } ; `exterieur` : côté ou coin extérieur pour le gabarit. `format` : 4×4 par défaut.
   */
  function cibleEn(modele, x, y, format) {
    var F = leFormat(format), gabarit = modele && modele.gabarit, cote, pos, k;
    for (cote = 0; cote < 4; cote++) {
      for (pos = 0; pos < 3; pos++) {
        var p = F.pointRaccord(cote, pos);
        if (dist(x, y, p.x, p.y) <= RAYON_RACCORD) return { type: 'raccord', cote: cote, pos: pos, exterieur: raccordExterieur(gabarit, cote) };
      }
    }
    for (k = 0; k < 4; k++) {
      var q = F.pointCoin(k);
      if (dist(x, y, q.x, q.y) <= RAYON_COIN) return { type: 'coin', coin: k, exterieur: coinExterieur(gabarit, k) };
    }
    var cs = tab(modele && modele.cases);
    for (var i = cs.length - 1; i >= 0; i--) {
      var c = cs[i];
      if (c && dist(x, y, c.x, c.y) <= (c.diametre || DIAMETRE_DEFAUT) / 2) return { type: 'case', id: c.id };
    }
    var ts = R.tracesModele(modele, F);
    for (var t = 0; t < ts.length; t++) {
      for (var s = 0; s + 1 < ts[t].pts.length; s++) {
        if (distanceSegment(x, y, ts[t].pts[s], ts[t].pts[s + 1]) <= TOLERANCE_CHEMIN) return { type: 'chemin', id: ts[t].id };
      }
    }
    return null;
  }

  /** Extrémité de chemin correspondant à une cible (ou null si la cible ne peut pas être une extrémité). */
  function extremiteDeCible(c) {
    if (!c) return null;
    if (c.type === 'case') return { 'case': c.id };
    if (c.type === 'raccord') return { raccord: { cote: c.cote, pos: c.pos } };
    if (c.type === 'coin') return { coin: c.coin };
    return null;
  }

  /** Référence (au sens de validerModele) d'une cible : sert de sélection. */
  function refDeCible(c) {
    if (!c) return null;
    if (c.type === 'case' || c.type === 'chemin') return { type: c.type, id: c.id };
    if (c.type === 'coin') return { type: 'coin', id: c.coin };
    if (c.type === 'raccord') return { type: 'raccord', id: c.cote + ':' + c.pos, cote: c.cote, pos: c.pos };
    return null;
  }

  /** Texte d'aide (survol) pour une cible. `format` : 4×4 par défaut. */
  function libelleCible(modele, c, format) {
    if (!c) return '';
    if (c.type === 'raccord') {
      return 'Raccord côté ' + NOMS_COTES[c.cote] + ', à ' + cm(leFormat(format).POSITIONS_RACCORD[c.pos]) + ' cm du coin ' + NOMS_COINS[c.cote] + '.' +
        (c.exterieur ? ' Côté extérieur pour ce gabarit : un raccord y sera face au vide.' : '');
    }
    if (c.type === 'coin') {
      return 'Coin ' + NOMS_COINS[c.coin] + (c.exterieur ? ' : coin extérieur pour ce gabarit, un port n\'y mènerait à aucune jonction.'
        : ' : un port relie une case à la case de jonction (ou à la ville) de ce coin.');
    }
    if (c.type === 'case') {
      var k = caseParId(modele, c.id);
      return k ? 'Case ' + k.id + ' (' + (k.type === 'apparition' ? 'apparition' : 'déplacement') + '), centre à ' + cm(k.x) + ' ; ' + cm(k.y) + ' cm, diamètre ' + cm(k.diametre) + ' cm.' : '';
    }
    if (c.type === 'chemin') return 'Chemin ' + c.id + '.';
    return '';
  }

  /** Cote courte dessinée sur le canevas au survol d'un raccord ou d'une case : { x, y, texte } ou null. */
  function coteCourte(modele, c, format) {
    if (!c) return null;
    if (c.type === 'raccord') {
      var F = leFormat(format), p = F.pointRaccord(c.cote, c.pos);
      return { x: p.x, y: p.y, texte: cm(F.POSITIONS_RACCORD[c.pos]) + ' cm' };
    }
    if (c.type === 'case') {
      var k = caseParId(modele, c.id);
      return k ? { x: k.x, y: k.y - k.diametre / 2 - 3, texte: cm(k.x) + ' ; ' + cm(k.y) + ' cm' } : null;
    }
    return null;
  }

  /**
   * Éléments à entourer pour une référence d'erreur (ref de validerModele ou sélection) :
   * { cercles: [{x, y, r}], lignes: [[{x, y}...]], tuile: bool }. `format` : 4×4 par défaut.
   */
  function haloDe(modele, ref, format) {
    var F = leFormat(format), res = { cercles: [], lignes: [], tuile: false };
    if (!ref) return res;
    if (ref.type === 'case') {
      (ref.ids || [ref.id]).forEach(function (id) {
        var c = caseParId(modele, id);
        if (c) res.cercles.push({ x: c.x, y: c.y, r: (c.diametre || DIAMETRE_DEFAUT) / 2 + 3 });
      });
    } else if (ref.type === 'chemin') {
      R.tracesModele(modele, F).forEach(function (t) { if (t.id === ref.id) res.lignes.push(t.pts); });
    } else if (ref.type === 'coin') {
      var k = F.pointCoin(ref.id);
      if (k) res.cercles.push({ x: k.x, y: k.y, r: 12 });
    } else if (ref.type === 'raccord') {
      var p = F.pointRaccord(ref.cote, ref.pos);
      if (p) res.cercles.push({ x: p.x, y: p.y, r: 9 });
    } else if (ref.type === 'modele') {
      res.tuile = true;
    }
    return res;
  }

  /** Éléments à marquer en rouge sur le canevas d'après les erreurs de validation. */
  function marquages(erreurs) {
    var res = { cases: [], coinsErreur: [], raccords: [], chemins: [] };
    function ajouter(liste, v) { if (liste.indexOf(v) < 0) liste.push(v); }
    tab(erreurs).forEach(function (e) {
      var r = e && e.ref;
      if (!r) return;
      if (r.type === 'case') (r.ids || [r.id]).forEach(function (id) { if (id !== undefined) ajouter(res.cases, id); });
      else if (r.type === 'chemin' && r.id !== undefined) ajouter(res.chemins, r.id);
      else if (r.type === 'coin') ajouter(res.coinsErreur, r.id);
      else if (r.type === 'raccord') ajouter(res.raccords, r.cote + ':' + r.pos);
    });
    return res;
  }

  /** Raccords et coins déjà reliés : { raccords: ['cote:pos'], coins: [k] }. */
  function extremitesUtilisees(modele) {
    var res = { raccords: [], coins: [] };
    tab(modele && modele.chemins).forEach(function (ch) {
      [ch && ch.a, ch && ch.b].forEach(function (e) {
        if (typeExt(e) === 'raccord') res.raccords.push(e.raccord.cote + ':' + e.raccord.pos);
        else if (typeExt(e) === 'coin') res.coins.push(e.coin);
      });
    });
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Fragments SVG (chaînes, sans DOM)                                   */
  /* ------------------------------------------------------------------ */

  function pointsSvg(pts) { return pts.map(function (p) { return arrondi(p.x) + ',' + arrondi(p.y); }).join(' '); }

  /** Grille de 1 cm (lignes fines). `format` : 4×4 par défaut (de même pour les fragments suivants). */
  function svgGrille(format) {
    var F = leFormat(format), C = F.COTE, s = '';
    for (var v = F.PAS_EDITEUR; v < C; v += F.PAS_EDITEUR) {
      s += '<line x1="' + v + '" y1="0" x2="' + v + '" y2="' + C + '"/><line x1="0" y1="' + v + '" x2="' + C + '" y2="' + v + '"/>';
    }
    return s;
  }

  /** Quarts de disque R 20 mm des quatre coins (zones réservées au jeton). */
  function svgZonesCoin(format) {
    var F = leFormat(format), r = F.RAYON_ZONE_COIN, C = F.COTE;
    // chaque quart est tracé dans le sens horaire (sweep = 1)
    var chemins = [
      'M0 0 L' + r + ' 0 A' + r + ' ' + r + ' 0 0 1 0 ' + r + ' Z',
      'M' + C + ' 0 L' + C + ' ' + r + ' A' + r + ' ' + r + ' 0 0 1 ' + (C - r) + ' 0 Z',
      'M' + C + ' ' + C + ' L' + (C - r) + ' ' + C + ' A' + r + ' ' + r + ' 0 0 1 ' + C + ' ' + (C - r) + ' Z',
      'M0 ' + C + ' L0 ' + (C - r) + ' A' + r + ' ' + r + ' 0 0 1 ' + r + ' ' + C + ' Z'
    ];
    return chemins.map(function (d, k) { return '<path d="' + d + '" data-coin="' + k + '"/>'; }).join('');
  }

  /** Demi-disques des 12 raccords, sur le bord, côté intérieur. */
  function svgRaccords(modele, marques, format) {
    var F = leFormat(format), util = extremitesUtilisees(modele).raccords, s = '', RR = 5;
    for (var cote = 0; cote < 4; cote++) {
      for (var pos = 0; pos < 3; pos++) {
        var p = F.pointRaccord(0, pos), cle = cote + ':' + pos;
        var cls = 'pm-editeur-raccord pm-editeur-actif' + (raccordExterieur(modele.gabarit, cote) ? ' pm-editeur-exterieur' : '');
        if (util.indexOf(cle) >= 0) cls += ' pm-editeur-utilise';
        if (marques && marques.raccords.indexOf(cle) >= 0) cls += ' pm-editeur-en-erreur';
        // tracé sur le côté nord puis tourné autour du centre : même convention que les masques
        s += '<path class="' + cls + '" data-raccord="' + cle + '" transform="rotate(' + (90 * cote) + ' ' + (F.COTE / 2) + ' ' + (F.COTE / 2) + ')" d="M' +
          arrondi(p.x - RR) + ' 0 A' + RR + ' ' + RR + ' 0 0 0 ' + arrondi(p.x + RR) + ' 0 Z"/>';
      }
    }
    return s;
  }

  /** Quatre coins : gros points, en tirets s'ils sont extérieurs pour le gabarit. */
  function svgCoins(modele, marques, format) {
    var F = leFormat(format), util = extremitesUtilisees(modele).coins, s = '';
    for (var k = 0; k < 4; k++) {
      var p = F.pointCoin(k);
      var cls = 'pm-editeur-coin pm-editeur-actif' + (coinExterieur(modele.gabarit, k) ? ' pm-editeur-exterieur' : '');
      if (util.indexOf(k) >= 0) cls += ' pm-editeur-utilise';
      if (marques && marques.coinsErreur.indexOf(k) >= 0) cls += ' pm-editeur-en-erreur';
      s += '<circle class="' + cls + '" data-coin="' + k + '" cx="' + arrondi(p.x) + '" cy="' + arrondi(p.y) + '" r="6"/>';
    }
    return s;
  }

  /** Cases et chemins en erreur (contours rouges), par-dessus le dessin de la tuile. */
  function svgMarquesErreur(modele, marques, format) {
    var s = '';
    R.tracesModele(modele, format).forEach(function (t) {
      if (marques.chemins.indexOf(t.id) >= 0) s += '<polyline class="pm-editeur-chemin-erreur" points="' + pointsSvg(t.pts) + '"/>';
    });
    tab(modele.cases).forEach(function (c) {
      if (c && marques.cases.indexOf(c.id) >= 0) {
        s += '<circle class="pm-editeur-case-erreur" cx="' + arrondi(c.x) + '" cy="' + arrondi(c.y) + '" r="' + arrondi((c.diametre || DIAMETRE_DEFAUT) / 2 + 1.5) + '"/>';
      }
    });
    return s;
  }

  /** Halo (clic sur une erreur, ou alerte d'un autre module). */
  function svgHalo(halo, classe, format) {
    var s = '', C = leFormat(format).COTE;
    classe = classe || 'pm-editeur-halo';
    if (halo.tuile) s += '<rect class="' + classe + '" x="1" y="1" width="' + (C - 2) + '" height="' + (C - 2) + '" rx="3"/>';
    halo.cercles.forEach(function (c) { s += '<circle class="' + classe + '" cx="' + arrondi(c.x) + '" cy="' + arrondi(c.y) + '" r="' + arrondi(c.r) + '"/>'; });
    halo.lignes.forEach(function (l) { s += '<polyline class="' + classe + ' pm-editeur-halo-ligne" points="' + pointsSvg(l) + '"/>'; });
    return s;
  }

  /**
   * Vignette d'une rotation (piège n° 2) : tuile tournée de `rot` quarts de tour, repère N sur le côté
   * où se retrouve le nord canonique (rot 0 : haut, 1 : droite, 2 : bas, 3 : gauche).
   */
  function svgVignette(modele, rot, format) {
    var F = leFormat(format), C = F.COTE, h = C / 2;
    var pos = [{ x: h, y: -6 }, { x: C + 6, y: h }, { x: h, y: C + 6 }, { x: -6, y: h }][rot % 4];
    var trait = [
      { x1: 0, y1: 0, x2: C, y2: 0 }, { x1: C, y1: 0, x2: C, y2: C },
      { x1: 0, y1: C, x2: C, y2: C }, { x1: 0, y1: 0, x2: 0, y2: C }
    ][rot % 4];
    return '<svg class="pm-editeur-vignette-svg" viewBox="-14 -14 ' + (C + 28) + ' ' + (C + 28) + '" role="img" aria-label="Rotation ' + (90 * rot) + ' degrés, repère N ' +
      ['en haut', 'à droite', 'en bas', 'à gauche'][rot % 4] + '">' +
      R.contenuTuile(modele, { rot: rot, format: F }) +
      '<line class="pm-editeur-repere-trait" x1="' + trait.x1 + '" y1="' + trait.y1 + '" x2="' + trait.x2 + '" y2="' + trait.y2 + '"/>' +
      '<text class="pm-editeur-repere-n" x="' + pos.x + '" y="' + pos.y + '" text-anchor="middle" dominant-baseline="central">N</text></svg>';
  }

  /* ------------------------------------------------------------------ */
  /* Montage (DOM)                                                       */
  /* ------------------------------------------------------------------ */

  function monter(conteneur, etat) {
    var NS = 'http://www.w3.org/2000/svg';
    var doc0 = conteneur.ownerDocument;

    /* ----- construction du DOM ----- */
    function el(tag, classe, texte) {
      var e = doc0.createElement(tag);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    }
    function svgEl(tag, attrs) {
      var e = doc0.createElementNS(NS, tag);
      Object.keys(attrs || {}).forEach(function (k) { e.setAttribute(k, attrs[k]); });
      return e;
    }
    function bouton(texte, titre, fn) {
      var b = el('button', 'pm-editeur-bouton', texte);
      b.type = 'button';
      if (titre) b.title = titre;
      b.addEventListener('click', fn);
      return b;
    }
    function champ(libelle, input) {
      var l = el('label', 'pm-editeur-champ');
      var t = el('span', 'pm-editeur-champ-texte', libelle);
      l.appendChild(t);
      l.appendChild(input);
      return l;
    }
    function boutonsGabarits(classe) {
      var g = el('div', classe);
      M.GABARITS.forEach(function (gabarit) {
        g.appendChild(bouton(LIBELLES_GABARITS[gabarit], 'Créer une nouvelle tuile « ' + LIBELLES_GABARITS[gabarit].toLowerCase() + ' »', function () { creerModele(gabarit); }));
      });
      return g;
    }

    conteneur.innerHTML = '';
    var racine = el('div', 'pm-editeur');
    conteneur.appendChild(racine);

    // Invite (aucun modèle sélectionné)
    var invite = el('div', 'pm-editeur-invite');
    invite.appendChild(el('p', 'pm-editeur-invite-texte', 'Aucune tuile sélectionnée. Choisissez un modèle dans la bibliothèque, ou créez-en un :'));
    invite.appendChild(boutonsGabarits('pm-editeur-invite-boutons'));
    racine.appendChild(invite);

    // Corps
    var corps = el('div', 'pm-editeur-corps');
    racine.appendChild(corps);

    var barre = el('div', 'pm-editeur-barre');
    var groupeNouveau = el('div', 'pm-editeur-groupe');
    groupeNouveau.appendChild(el('span', 'pm-editeur-groupe-titre', 'Nouveau :'));
    groupeNouveau.appendChild(boutonsGabarits('pm-editeur-boutons-roles'));
    barre.appendChild(groupeNouveau);
    var btnDupliquer = bouton('Dupliquer', 'Copier ce modèle (Ctrl+D)', function () { dupliquerCourant(); });
    barre.appendChild(btnDupliquer);
    var inNom = el('input', 'pm-editeur-saisie'); inNom.type = 'text'; inNom.maxLength = 60;
    barre.appendChild(champ('Nom', inNom));
    var selGabarit = el('select', 'pm-editeur-saisie');
    M.GABARITS.forEach(function (r) { var o = el('option', '', LIBELLES_GABARITS[r]); o.value = r; selGabarit.appendChild(o); });
    barre.appendChild(champ('Gabarit', selGabarit));
    var inExemplaires = el('input', 'pm-editeur-saisie pm-editeur-saisie-court'); inExemplaires.type = 'number'; inExemplaires.min = '0'; inExemplaires.step = '1';
    barre.appendChild(champ('Exemplaires', inExemplaires));
    corps.appendChild(barre);

    var avertissement = el('div', 'pm-editeur-avertissement');
    avertissement.setAttribute('role', 'status');
    corps.appendChild(avertissement);

    var zone = el('div', 'pm-editeur-zone');
    corps.appendChild(zone);

    var colCanevas = el('div', 'pm-editeur-colonne-canevas');
    zone.appendChild(colCanevas);
    /** Format du document courant (le canevas se redessine s'il change). */
    function fmt() { return M.formatDuDocument(etat.doc()); }
    var formatAffiche = fmt(), vueAffichee = vuePour(formatAffiche);
    var svg = svgEl('svg', {
      'class': 'pm-editeur-canevas', viewBox: vueAffichee.x + ' ' + vueAffichee.y + ' ' + vueAffichee.l + ' ' + vueAffichee.h,
      tabindex: '0', role: 'application',
      'aria-label': 'Canevas de la tuile : cliquer pour ajouter une case, glisser pour déplacer ou tracer un chemin'
    });
    var gFond = svgEl('g', { 'class': 'pm-editeur-g-fond' });
    var gGrille = svgEl('g', { 'class': 'pm-editeur-grille' });
    var gZones = svgEl('g', { 'class': 'pm-editeur-zones-coin' });
    var gMarques = svgEl('g', { 'class': 'pm-editeur-g-marques' });
    var gSelection = svgEl('g', { 'class': 'pm-editeur-g-selection' });
    var gRaccords = svgEl('g', { 'class': 'pm-editeur-g-raccords' });
    var gCoins = svgEl('g', { 'class': 'pm-editeur-g-coins' });
    var gApercu = svgEl('g', { 'class': 'pm-editeur-g-apercu' });
    var gCote = svgEl('g', { 'class': 'pm-editeur-g-cote' });
    [gFond, gGrille, gZones, gMarques, gSelection, gRaccords, gCoins, gApercu, gCote].forEach(function (g) { svg.appendChild(g); });
    gGrille.innerHTML = svgGrille(formatAffiche);
    gZones.innerHTML = svgZonesCoin(formatAffiche);
    colCanevas.appendChild(svg);
    var aide = el('p', 'pm-editeur-aide');
    aide.setAttribute('aria-live', 'polite');
    colCanevas.appendChild(aide);
    var info = el('p', 'pm-editeur-info');
    colCanevas.appendChild(info);

    var colCote = el('div', 'pm-editeur-colonne-cote');
    zone.appendChild(colCote);
    var statut = el('div', 'pm-editeur-statut');
    statut.setAttribute('role', 'status');
    colCote.appendChild(statut);
    colCote.appendChild(el('h3', 'pm-editeur-titre', 'Validation'));
    var listeErreurs = el('ul', 'pm-editeur-erreurs');
    colCote.appendChild(listeErreurs);
    colCote.appendChild(el('h3', 'pm-editeur-titre', 'Aperçu des 4 rotations'));
    var vignettes = el('div', 'pm-editeur-vignettes');
    colCote.appendChild(vignettes);
    colCote.appendChild(el('p', 'pm-editeur-note',
      'Raccourcis : clic sur le fond = case ; glisser = déplacer ; glisser vers une case, un raccord ou un coin = chemin ; ' +
      'A ou clic droit = type de case ; Suppr = supprimer ; Échap = annuler ; flèches = déplacer la case sélectionnée.'));

    /* ----- état local de l'éditeur ----- */
    var selection = null;     // ref { type, id... } de l'élément sélectionné
    var arme = null;          // extrémité de départ du mode « deux clics »
    var haloLocal = null;     // ref entourée après un clic sur une erreur de la liste
    var geste = null;         // glissement en cours
    var survol = null;        // dernière cible survolée
    var modeleAffiche = null; // id du modèle affiché
    var derniereCle = null;
    var rafraichissementDiffere = false;

    function modeleCourant() {
      var id = etat.ui().modeleSelectionne;
      return id ? M.modeleParId(etat.doc(), id) : null;
    }

    /* ----- actions sur le document ----- */

    /** Applique fn(modele) -> nouveau modèle ; un refus de fn est signalé dans la barre d'état. */
    function modifier(fn, libelle) {
      var m = modeleCourant();
      if (!m) return { ok: false };
      var nouveau;
      try { nouveau = fn(m); } catch (e) {
        etat.signaler(e && e.message ? e.message : String(e), 'erreur');
        return { ok: false };
      }
      if (JSON.stringify(nouveau) === JSON.stringify(m)) return { ok: true, inchange: true };
      return etat.appliquer(function (d) { return M.remplacerModele(d, m.id, nouveau); }, libelle);
    }

    function creerModele(gabarit) {
      var ids = etat.doc().modeles.map(function (x) { return x.id; });
      var nouveau = modeleDeDepart(gabarit, ids, fmt());
      var r = etat.appliquer(function (d) { return M.ajouterModele(d, nouveau); }, 'Nouvelle tuile ' + gabarit);
      if (r.ok) {
        etat.majUi({ modeleSelectionne: nouveau.id, onglet: 'tuiles' });
        etat.signaler('Tuile « ' + nouveau.nom + ' » créée : placez les cases puis reliez-les par des chemins.', 'info');
      }
    }

    function dupliquerCourant() {
      var m = modeleCourant();
      if (!m) return;
      var copie = dupliquer(m, etat.doc().modeles.map(function (x) { return x.id; }));
      var r = etat.appliquer(function (d) { return M.ajouterModele(d, copie); }, 'Dupliquer la tuile');
      if (r.ok) {
        etat.majUi({ modeleSelectionne: copie.id });
        etat.signaler('Copie créée : « ' + copie.nom + ' ». Elle n\'est pas posée sur le plateau.', 'info');
      }
    }

    function supprimerSelection() {
      var m = modeleCourant();
      if (!m || !selection) return;
      var sel = selection;
      var r = modifier(function (x) { return supprimer(x, sel); }, 'Supprimer un élément');
      if (r.ok) { selection = null; arme = null; rafraichir(true); }
    }

    function basculerSelection() {
      var m = modeleCourant();
      if (!m || !selection || selection.type !== 'case') {
        etat.signaler('Sélectionnez d\'abord une case (clic) pour changer son type.', 'alerte');
        return;
      }
      var id = selection.id;
      modifier(function (x) { return basculerType(x, id); }, 'Changer le type d\'une case');
    }

    function tracer(a, b) {
      var r = modifier(function (x) { return ajouterChemin(x, a, b); }, 'Ajouter un chemin');
      if (r.ok) {
        var m = modeleCourant();
        var dernier = m && tab(m.chemins)[m.chemins.length - 1];
        selection = dernier ? { type: 'chemin', id: dernier.id } : null;
      }
      arme = null;
      return r;
    }

    /* ----- gestes ----- */

    function pointMm(ev) {
      var rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      return ecranVersMm(ev.clientX, ev.clientY, rect, vueAffichee);
    }

    function effacerApercu() { gApercu.innerHTML = ''; }

    function dessinerApercu(m, p) {
      var F = fmt(), s = '', cible2 = cibleEn(m, p.x, p.y, F), d = geste.depart;
      var depart = null;
      if (d && d.type === 'case') {
        var c = caseParId(m, d.id);
        if (c) depart = { x: c.x, y: c.y };
      } else if (d && (d.type === 'raccord' || d.type === 'coin')) {
        depart = d.type === 'raccord' ? F.pointRaccord(d.cote, d.pos) : F.pointCoin(d.coin);
      }
      var versChemin = depart && cible2 && extremiteDeCible(cible2) && !(cible2.type === 'case' && d.type === 'case' && cible2.id === d.id);
      if (versChemin) {
        var fin = cible2.type === 'case' ? caseParId(m, cible2.id) : (cible2.type === 'raccord' ? F.pointRaccord(cible2.cote, cible2.pos) : F.pointCoin(cible2.coin));
        s += '<line class="pm-editeur-apercu-chemin" x1="' + depart.x + '" y1="' + depart.y + '" x2="' + fin.x + '" y2="' + fin.y + '"/>';
        s += '<circle class="pm-editeur-apercu-cible" cx="' + fin.x + '" cy="' + fin.y + '" r="9"/>';
      } else if (d && d.type === 'case') {
        var cc = caseParId(m, d.id), dec = geste.decalage || { dx: 0, dy: 0 };
        var q = aimanter(p.x + dec.dx, p.y + dec.dy, cc ? cc.diametre : DIAMETRE_DEFAUT, F);
        s += '<circle class="pm-editeur-apercu-case" cx="' + arrondi(q.x) + '" cy="' + arrondi(q.y) + '" r="' + arrondi((cc ? cc.diametre : DIAMETRE_DEFAUT) / 2) + '"/>';
      } else if (depart) {
        s += '<line class="pm-editeur-apercu-chemin pm-editeur-apercu-libre" x1="' + arrondi(depart.x) + '" y1="' + arrondi(depart.y) + '" x2="' + arrondi(p.x) + '" y2="' + arrondi(p.y) + '"/>';
      }
      gApercu.innerHTML = s;
    }

    function annulerGeste() {
      if (!geste) return;
      var id = geste.pointerId;
      geste = null;
      try { svg.releasePointerCapture(id); } catch (e) { /* capture déjà perdue */ }
      effacerApercu();
      majAide();
      if (rafraichissementDiffere) { rafraichissementDiffere = false; rafraichir(true); }
    }

    /** Clic simple (sans glissement). */
    function clic(m, cible, p) {
      if (arme) {
        var ext = extremiteDeCible(cible);
        var meme = ext && cleExt(ext) === cleExt(arme);
        if (ext && !meme) { tracer(arme, ext); return; }
        arme = null;
        if (!meme) etat.signaler('Chemin annulé : cliquez d\'abord sur une case, un raccord ou un coin, puis sur l\'autre extrémité.', 'info');
        rafraichir(true);
        return;
      }
      haloLocal = null;
      if (!cible) {
        var avant = M.nouvelId(m, PREFIXE_CASE);
        var r = modifier(function (x) { return ajouterCase(x, p.x, p.y, undefined, fmt()); }, 'Ajouter une case');
        selection = r.ok ? { type: 'case', id: avant } : null;
        rafraichir(true);
        return;
      }
      selection = refDeCible(cible);
      if (cible.type !== 'chemin') arme = extremiteDeCible(cible);
      rafraichir(true);
    }

    function finGeste(ev) {
      if (!geste) return;
      var g = geste, m = modeleCourant();
      var p = pointMm(ev) || g.courantMm || g.p0;
      geste = null;
      try { svg.releasePointerCapture(g.pointerId); } catch (e) { /* ignoré */ }
      effacerApercu();
      if (!m) { rafraichir(true); return; }
      rafraichissementDiffere = false;
      if (!g.deplace) { clic(m, g.depart, g.p0); return; }
      var d = g.depart, cible2 = cibleEn(m, p.x, p.y, fmt());
      if (d && d.type === 'case') {
        var ext = extremiteDeCible(cible2);
        if (ext && !(cible2.type === 'case' && cible2.id === d.id)) {
          tracer({ 'case': d.id }, ext);
        } else {
          var dec = g.decalage || { dx: 0, dy: 0 }, id = d.id;
          modifier(function (x) { return deplacerCase(x, id, p.x + dec.dx, p.y + dec.dy, fmt()); }, 'Déplacer une case');
          selection = { type: 'case', id: id };
          arme = null;
        }
      } else if (d && (d.type === 'raccord' || d.type === 'coin')) {
        if (cible2 && cible2.type === 'case') tracer({ 'case': cible2.id }, extremiteDeCible(d));
        else etat.signaler('Relâchez sur une case pour tracer le chemin.', 'info');
      }
      rafraichir(true);
    }

    svg.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0 || geste) return;
      var m = modeleCourant();
      if (!m) return;
      var p = pointMm(ev);
      if (!p) return;
      if (ev.preventDefault) ev.preventDefault();
      if (svg.focus) { try { svg.focus({ preventScroll: true }); } catch (e) { /* ignoré */ } }
      var cible = cibleEn(m, p.x, p.y, fmt());
      geste = { px0: ev.clientX, py0: ev.clientY, p0: p, courantMm: p, depart: cible, deplace: false, pointerId: ev.pointerId, decalage: null };
      if (cible && cible.type === 'case') {
        var c = caseParId(m, cible.id);
        geste.decalage = { dx: c.x - p.x, dy: c.y - p.y };
      }
      try { svg.setPointerCapture(ev.pointerId); } catch (e) { /* pointeur synthétique ou déjà relâché */ }
    });

    svg.addEventListener('pointermove', function (ev) {
      var m = modeleCourant();
      if (!m) return;
      var p = pointMm(ev);
      if (!p) return;
      if (geste) {
        geste.courantMm = p;
        if (!geste.deplace && Math.hypot(ev.clientX - geste.px0, ev.clientY - geste.py0) >= SEUIL_GLISSEMENT_PX) {
          var d = geste.depart;
          var glissable = d && (d.type === 'case' || d.type === 'raccord' || d.type === 'coin');
          if (glissable) { geste.deplace = true; arme = null; haloLocal = null; }
        }
        if (geste.deplace) dessinerApercu(m, p);
        return;
      }
      var cible = cibleEn(m, p.x, p.y, fmt());
      var cle = cible ? JSON.stringify(cible) : '';
      if (cle === (survol ? JSON.stringify(survol) : '')) return;
      survol = cible;
      majSurvol(m);
    });

    svg.addEventListener('pointerup', finGeste);
    svg.addEventListener('pointercancel', function () { annulerGeste(); });
    svg.addEventListener('pointerleave', function () { if (!geste) { survol = null; majSurvol(modeleCourant()); } });

    // Clic droit : bascule déplacement / apparition de la case visée
    svg.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      var m = modeleCourant();
      if (!m || geste) return;
      var p = pointMm(ev);
      var cible = p ? cibleEn(m, p.x, p.y, fmt()) : null;
      if (cible && cible.type === 'case') {
        selection = { type: 'case', id: cible.id };
        basculerSelection();
        rafraichir(true);
      } else {
        etat.signaler('Clic droit sur une case pour changer son type (déplacement / apparition).', 'info');
      }
    });

    /* ----- clavier : actif seulement quand l'onglet « tuiles » est visible ----- */
    doc0.addEventListener('keydown', function (ev) {
      if (etat.ui().onglet !== 'tuiles' || !modeleCourant()) return;
      var t = ev.target;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      var k = ev.key;
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (k === 'd' || k === 'D')) { ev.preventDefault(); dupliquerCourant(); return; }
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (k === 'Delete') { ev.preventDefault(); supprimerSelection(); }
      else if (k === 'a' || k === 'A') { ev.preventDefault(); basculerSelection(); }
      else if (k === 'Escape') {
        if (geste) annulerGeste();
        else if (arme) { arme = null; etat.signaler('Chemin annulé.', 'info'); }
        else { selection = null; haloLocal = null; }
        rafraichir(true);
      } else if (k.indexOf('Arrow') === 0 && selection && selection.type === 'case' && !(t && t.tagName === 'BUTTON')) {
        var m = modeleCourant(), c = caseParId(m, selection.id);
        if (!c) return;
        ev.preventDefault();
        var pas = fmt().PAS_EDITEUR;
        var dx = k === 'ArrowLeft' ? -pas : k === 'ArrowRight' ? pas : 0;
        var dy = k === 'ArrowUp' ? -pas : k === 'ArrowDown' ? pas : 0;
        var id = c.id;
        modifier(function (x) { return deplacerCase(x, id, c.x + dx, c.y + dy, fmt()); }, 'Déplacer une case');
      }
    });

    /* ----- barre d'outils ----- */
    inNom.addEventListener('change', function () {
      var nom = inNom.value;
      modifier(function (x) { return renommer(x, nom); }, 'Renommer la tuile');
    });
    selGabarit.addEventListener('change', function () {
      var gabarit = selGabarit.value;
      var r = modifier(function (x) { return changerGabarit(x, gabarit); }, 'Changer le gabarit');
      if (!r.ok) { var m = modeleCourant(); if (m) selGabarit.value = m.gabarit; }
    });
    inExemplaires.addEventListener('change', function () {
      var m = modeleCourant();
      if (!m) return;
      var n = inExemplaires.value.trim() === '' ? NaN : Number(inExemplaires.value);
      var r = etat.appliquer(function (d) { return M.changerExemplaires(d, m.id, n); }, 'Changer le nombre d\'exemplaires');
      if (!r.ok) inExemplaires.value = String(m.exemplaires);
    });

    /* ----- dessin ----- */

    function majAide() {
      if (geste && geste.deplace) aide.textContent = 'Relâchez sur une case, un raccord ou un coin pour tracer un chemin, ailleurs pour déplacer. Échap annule.';
      else if (arme) aide.textContent = 'Chemin : cliquez sur l\'autre extrémité (case, raccord ou coin). Échap annule.';
      else if (selection) aide.textContent = 'Sélection : ' + selection.type + (selection.id !== undefined ? ' ' + selection.id : '') + '. Suppr supprime' +
        (selection.type === 'case' ? ', A change le type, les flèches déplacent.' : '.');
      else aide.textContent = 'Cliquez sur le fond pour ajouter une case ; glissez une case pour la déplacer ou la relier.';
    }

    function majSurvol(m) {
      if (!m) { gCote.innerHTML = ''; info.textContent = ''; return; }
      info.textContent = libelleCible(m, survol, fmt());
      var c = coteCourte(m, survol, fmt());
      gCote.innerHTML = c
        ? '<text class="pm-editeur-cote" x="' + arrondi(c.x) + '" y="' + arrondi(Math.min(c.y + 12, fmt().COTE - 8)) + '" text-anchor="middle">' + echapper(c.texte) + '</text>'
        : '';
      svg.classList.toggle('pm-editeur-sur-cible', !!survol);
    }

    function haloExterne(m) {
      var s = etat.ui().surbrillance;
      if (s && (s.type === 'case' || s.type === 'chemin') && s.modeleId === m.id) return { type: s.type, id: s.id };
      return null;
    }

    /** Liste des erreurs (bloquantes) puis des alertes (la tuile reste posable), chacune cliquable pour entourer l'élément. */
    function dessinerListeErreurs(m, valid) {
      listeErreurs.innerHTML = '';
      if (!valid.erreurs.length) {
        var ok = el('li', 'pm-editeur-erreur-ok', 'Aucune erreur : la tuile est posable.' + (valid.alertes.length ? ' Alertes à lire ci-dessous.' : ''));
        listeErreurs.appendChild(ok);
      }
      valid.erreurs.map(function (e) { return { e: e, alerte: false }; })
        .concat(valid.alertes.map(function (e) { return { e: e, alerte: true }; })).forEach(function (x) {
        var e = x.e;
        var li = el('li', x.alerte ? 'pm-editeur-erreur pm-editeur-alerte' : 'pm-editeur-erreur');
        var b = el('button', 'pm-editeur-erreur-bouton' + (x.alerte ? ' pm-editeur-alerte-bouton' : ''), (x.alerte ? 'Alerte : ' : '') + e.message);
        b.type = 'button';
        b.title = 'Entourer l\'élément concerné';
        b.addEventListener('click', function () {
          haloLocal = e.ref || null;
          selection = null;
          arme = null;
          rafraichir(true);
        });
        li.appendChild(b);
        listeErreurs.appendChild(li);
      });
    }

    function rafraichir(force) {
      if (geste) { rafraichissementDiffere = true; return; }
      var ui = etat.ui(), doc = etat.doc();
      var m = ui.modeleSelectionne ? M.modeleParId(doc, ui.modeleSelectionne) : null;
      if (!m) {
        invite.hidden = false;
        corps.hidden = true;
        modeleAffiche = null;
        derniereCle = null;
        return;
      }
      invite.hidden = true;
      corps.hidden = false;
      if (modeleAffiche !== m.id) { selection = null; arme = null; haloLocal = null; survol = null; modeleAffiche = m.id; }
      // une sélection dont l'élément a disparu (annulation, suppression) est abandonnée
      if (selection && !elementExiste(m, selection)) selection = null;
      if (arme && !extremiteExiste(m, arme)) arme = null;
      var util = nbUtilisations(doc, m.id);
      var ext = haloExterne(m);
      var F = M.formatDuDocument(doc);
      if (F !== formatAffiche) { // nouveau format de grille : canevas, grille et zones de coin à refaire
        formatAffiche = F;
        vueAffichee = vuePour(F);
        svg.setAttribute('viewBox', vueAffichee.x + ' ' + vueAffichee.y + ' ' + vueAffichee.l + ' ' + vueAffichee.h);
        gGrille.innerHTML = svgGrille(F);
        gZones.innerHTML = svgZonesCoin(F);
      }
      var cle = JSON.stringify([m, util, selection, arme, haloLocal, ext, F.id]);
      if (!force && cle === derniereCle) return;
      derniereCle = cle;

      var valid = M.validerModele(m, F);
      var marques = marquages(valid.erreurs);

      // champs de la barre (on ne touche pas au champ qui a le focus)
      if (doc0.activeElement !== inNom) inNom.value = m.nom || '';
      if (doc0.activeElement !== selGabarit) selGabarit.value = M.GABARITS.indexOf(m.gabarit) >= 0 ? m.gabarit : '';
      if (doc0.activeElement !== inExemplaires) inExemplaires.value = String(m.exemplaires);
      inNom.placeholder = m.id;

      if (util > 0) {
        avertissement.hidden = false;
        avertissement.textContent = 'Utilisé ' + util + ' fois : la modification s\'applique aux tuiles posées.';
      } else {
        avertissement.hidden = true;
        avertissement.textContent = '';
      }

      gFond.innerHTML = R.contenuTuile(m, { contour: true, format: F });
      gMarques.innerHTML = svgMarquesErreur(m, marques, F);
      var haloRef = haloLocal || ext;
      var s = '';
      if (haloRef) s += svgHalo(haloDe(m, haloRef, F), undefined, F);
      if (selection) s += svgHalo(haloDe(m, selection, F), 'pm-editeur-selection', F);
      if (arme) {
        var pt = typeExt(arme) === 'case' ? caseParId(m, arme['case']) : typeExt(arme) === 'raccord' ? F.pointRaccord(arme.raccord.cote, arme.raccord.pos) : F.pointCoin(arme.coin);
        if (pt) s += '<circle class="pm-editeur-arme" cx="' + arrondi(pt.x) + '" cy="' + arrondi(pt.y) + '" r="' + arrondi(typeExt(arme) === 'case' ? ((caseParId(m, arme['case']).diametre || DIAMETRE_DEFAUT) / 2 + 5) : 10) + '"/>';
      }
      gSelection.innerHTML = s;
      gRaccords.innerHTML = svgRaccords(m, marques, F);
      gCoins.innerHTML = svgCoins(m, marques, F);

      // statut
      var nbCases = tab(m.cases).length, nbAlertes = valid.alertes.length;
      statut.className = 'pm-editeur-statut ' + (valid.complet ? 'pm-editeur-complet' : 'pm-editeur-incomplet');
      statut.textContent = (valid.complet ? 'Complet : posable sur le plateau' : 'Incomplet (non posable) : ' + valid.erreurs.length + ' erreur' + (valid.erreurs.length > 1 ? 's' : '')) +
        (nbAlertes ? ', ' + nbAlertes + ' alerte' + (nbAlertes > 1 ? 's' : '') : '') + ' — ' + nbCases + ' case' + (nbCases > 1 ? 's' : '');
      dessinerListeErreurs(m, valid);

      // aperçu des 4 rotations
      var h = '';
      for (var rot = 0; rot < 4; rot++) {
        h += '<figure class="pm-editeur-vignette">' + svgVignette(m, rot, F) + '<figcaption>' + (90 * rot) + '°</figcaption></figure>';
      }
      vignettes.innerHTML = h;

      btnDupliquer.disabled = false;
      majAide();
      majSurvol(m);
    }

    function elementExiste(m, ref) {
      if (ref.type === 'case') return !!caseParId(m, ref.id);
      if (ref.type === 'chemin') return tab(m.chemins).some(function (ch) { return ch.id === ref.id; });
      return true;
    }
    function extremiteExiste(m, e) { return typeExt(e) !== 'case' || !!caseParId(m, e['case']); }

    etat.abonner(function () { rafraichir(false); });
    rafraichir(true);

    return { rafraichir: function () { rafraichir(true); } };
  }

  PM.editeurTuile = {
    DIAMETRE_DEFAUT: DIAMETRE_DEFAUT,
    PAS_GRILLE: PAS_GRILLE,
    VUE: VUE,
    vuePour: vuePour,
    monter: monter,
    // conversion écran <-> mm
    ecranVersMm: ecranVersMm,
    mmVersEcran: mmVersEcran,
    // aimantation
    aimanter: aimanter,
    // édition (pures)
    modeleDeDepart: modeleDeDepart,
    dupliquer: dupliquer,
    ajouterCase: ajouterCase,
    deplacerCase: deplacerCase,
    basculerType: basculerType,
    ajouterChemin: ajouterChemin,
    supprimer: supprimer,
    changerGabarit: changerGabarit,
    renommer: renommer,
    nbUtilisations: nbUtilisations,
    // cibles et aides (pures)
    raccordExterieur: raccordExterieur,
    coinExterieur: coinExterieur,
    cibleEn: cibleEn,
    extremiteDeCible: extremiteDeCible,
    refDeCible: refDeCible,
    libelleCible: libelleCible,
    coteCourte: coteCourte,
    haloDe: haloDe,
    marquages: marquages,
    extremitesUtilisees: extremitesUtilisees,
    // fragments SVG
    svgGrille: svgGrille,
    svgZonesCoin: svgZonesCoin,
    svgRaccords: svgRaccords,
    svgCoins: svgCoins,
    svgHalo: svgHalo,
    svgVignette: svgVignette
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.editeurTuile;
})();
