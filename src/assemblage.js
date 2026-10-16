/*
 * assemblage.js : écran du plateau (grille du format du document, pose des tuiles, jetons, alertes visuelles).
 * Le calcul est fait par des fonctions pures exportées (testées sous Node) ; le DOM n'est
 * manipulé que dans `monter`. Unité : mm (viewBox du SVG en mm, cellule de COTE mm : 120 en 4×4).
 *
 * Repères : cellule (col, lig), origine en haut à gauche (nord-ouest), lignes croissantes vers le sud ;
 * jonction (i, j) = (colonne, ligne) des coins de cellules, intérieure si 1 ≤ i ≤ colonnes - 1 et
 * 1 ≤ j ≤ lignes - 1 (1..3 en 4×4), en (i·COTE, j·COTE) mm.
 * Les fonctions sans document prennent un dernier paramètre `format` facultatif (4×4 par défaut).
 *
 * Règles v2 : grille pleine, poses illimitées (un modèle se pose autant de fois qu'on veut) mais rôle respecté (coin dans
 * un coin, bord sur le pourtour hors coins, centrale au centre : les autres cellules sont grisées pendant l'armement et le
 * glissement), rotation libre de toutes les tuiles (R), rotation suggérée pour un bord ou un coin sur le pourtour ;
 * clic droit sur une tuile posée = la retirer (annulable) ; jonction = case chemin ou ville.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var RAYON_JONCTION = 15;        // aimantation d'un jeton (D10)
  var NB_VILLES = 7;              // villes de la composition (docs/18)

  function M() { return PM.modele; }
  function G() { return PM.geometrie; }
  /** Format de grille à partir d'un objet format, d'un identifiant ou de rien (4×4). */
  function leFormat(f) {
    if (f && typeof f === 'object') return f;
    return G().format(f === undefined || f === null ? G().FORMAT_DEFAUT : f);
  }
  /** Format du document (champ `grille`, absent = 4×4). */
  function formatDoc(doc) { return M().formatDuDocument(doc); }

  /** Zone visible du SVG (mm) : plateau de 0 à colonnes × COTE, marges pour les camps et les dimensions. */
  function vuePour(format) {
    var F = leFormat(format), w = F.GRILLE.colonnes * F.COTE, h = F.GRILLE.lignes * F.COTE;
    return { x: -40, y: -52, w: w + 80, h: h + 120 };
  }

  // Valeurs du format 4×4, gardées pour l'API (les calculs passent par le format du document).
  var COTE = PM.geometrie.COTE;     // côté d'une cellule (mm)
  var RAYON_CELLULE = COTE / 2;     // aimantation d'une tuile (D10) : distance max au centre (norme max, carré de COTE mm)
  /** Zone visible du SVG (mm) en 4×4 : plateau de 0 à 480. */
  var VUE = vuePour();
  var NORMALE = [{ x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 }]; // vers l'intérieur, par côté
  var BISSECTRICE = [{ x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }]
    .map(function (v) { return { x: v.x / Math.SQRT2, y: v.y / Math.SQRT2 }; }); // vers l'intérieur, par coin
  var NOMS_GABARIT = { centrale: 'Centrale', bord: 'Bord', coin: 'Coin' };

  function cle(a, b) { return a + ',' + b; }
  function arrondi(n) { return Math.round(n * 1000) / 1000; }
  function echapper(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------------------ */
  /* Conversions écran ↔ mm et cibles                                    */
  /* ------------------------------------------------------------------ */

  /**
   * Échelle et décalage d'un SVG affiché dans `rect` ({left, top, width, height}, px) avec la viewBox `vue`
   * et preserveAspectRatio « xMidYMid meet » (valeur par défaut). Renvoie {echelle (px/mm), dx, dy}.
   */
  function cadrage(rect, vue) {
    var e = Math.min(rect.width / vue.w, rect.height / vue.h);
    if (!(e > 0)) e = 1;
    return { echelle: e, dx: rect.left + (rect.width - vue.w * e) / 2, dy: rect.top + (rect.height - vue.h * e) / 2 };
  }

  /** Point écran (px, clientX / clientY) → point en mm dans le repère du plateau. */
  function ecranVersMm(x, y, rect, vue) {
    var c = cadrage(rect, vue || VUE), v = vue || VUE;
    return { x: (x - c.dx) / c.echelle + v.x, y: (y - c.dy) / c.echelle + v.y };
  }

  /** Point en mm → point écran (px). */
  function mmVersEcran(x, y, rect, vue) {
    var c = cadrage(rect, vue || VUE), v = vue || VUE;
    return { x: (x - v.x) * c.echelle + c.dx, y: (y - v.y) * c.echelle + c.dy };
  }

  /**
   * Cellule sous un point (mm) : celle dont le centre est à moins de COTE / 2 en norme max
   * (c'est-à-dire la cellule de COTE mm qui contient le point), ou null hors de la grille.
   */
  function celluleSous(x, y, format) {
    if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return null;
    var F = leFormat(format), C = F.COTE;
    var col = Math.floor(x / C), lig = Math.floor(y / C);
    if (col < 0 || col >= F.GRILLE.colonnes || lig < 0 || lig >= F.GRILLE.lignes) return null;
    var cx = col * C + C / 2, cy = lig * C + C / 2;
    if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) > C / 2) return null;
    return { col: col, lig: lig };
  }

  /** Jonction intérieure la plus proche d'un point (mm), si elle est à 15 mm au plus ; sinon null. */
  function jonctionSous(x, y, format) {
    if (typeof x !== 'number' || typeof y !== 'number' || !isFinite(x) || !isFinite(y)) return null;
    var F = leFormat(format), C = F.COTE;
    var i = Math.round(x / C), j = Math.round(y / C);
    if (i < 1 || i > F.GRILLE.colonnes - 1 || j < 1 || j > F.GRILLE.lignes - 1) return null;
    if (Math.hypot(x - i * C, y - j * C) > RAYON_JONCTION) return null;
    return { i: i, j: j };
  }

  /* ------------------------------------------------------------------ */
  /* Pose, déplacement, effets (fonctions pures)                         */
  /* ------------------------------------------------------------------ */

  /** Cellules où le modèle peut être posé maintenant : [{col, lig, rot}]. */
  function cellulesCompatibles(doc, modeleId) {
    var res = [], F = formatDoc(doc);
    for (var lig = 0; lig < F.GRILLE.lignes; lig++) {
      for (var col = 0; col < F.GRILLE.colonnes; col++) {
        var t = M().peutPoserTuile(doc, modeleId, col, lig);
        if (t.ok) res.push({ col: col, lig: lig, rot: t.rot });
      }
    }
    return res;
  }

  /** Cellules où la tuile posée en `de` peut être déplacée (la cellule d'origine comprise). */
  function cellulesCompatiblesDeplacement(doc, de) {
    var t = M().tuileEn(doc, de.col, de.lig);
    if (!t) return [];
    var res = cellulesCompatibles(M().retirerTuile(doc, de.col, de.lig), t.modeleId);
    return res;
  }

  /**
   * Pose un modèle dans la rotation `quarts` (entier) ; `quarts` null ou absent = rotation suggérée
   * (bord ou coin sur le pourtour, 0 sinon). Pure, une seule étape d'historique. Lève une Error si refus.
   */
  function poserTuileTournee(doc, modeleId, col, lig, quarts) {
    var q = quarts === null || quarts === undefined ? undefined : ((quarts % 4) + 4) % 4;
    return M().poserTuile(doc, modeleId, col, lig, q);
  }

  /** Teste le déplacement d'une tuile posée : {ok, raison, identique}. */
  function testerDeplacement(doc, de, vers) {
    if (!estCellule(de) || !estCellule(vers)) return { ok: false, raison: 'Cellule de départ ou d’arrivée invalide.', identique: false };
    var t = M().tuileEn(doc, de.col, de.lig);
    if (!t) return { ok: false, raison: 'Aucune tuile dans cette cellule.', identique: false };
    if (de.col === vers.col && de.lig === vers.lig) return { ok: true, raison: '', identique: true };
    var r = M().peutPoserTuile(M().retirerTuile(doc, de.col, de.lig), t.modeleId, vers.col, vers.lig);
    return { ok: r.ok, raison: r.raison, identique: false };
  }

  /**
   * Déplace une tuile (pure) : retrait puis pose, la rotation de la tuile est conservée.
   * Les jetons devenus invalides sont retirés (par retirerTuile). Lève une Error si la pose est refusée.
   */
  /** Objet cellule {col, lig} (les valeurs elles-mêmes sont jugées par PM.modele). */
  function estCellule(c) { return !!c && typeof c === 'object'; }

  /** Lève une Error explicite (et non un TypeError natif) si le document n'a pas la forme attendue. */
  function verifierDocument(doc) {
    var p = doc && doc.plateau;
    if (!p || typeof p !== 'object' || !Array.isArray(p.tuiles) || !Array.isArray(p.jetons)) {
      throw new Error('Document invalide : plateau absent ou mal formé.');
    }
    if (!Array.isArray(doc.modeles)) throw new Error('Document invalide : bibliothèque de modèles absente.');
  }

  function deplacerTuile(doc, de, vers) {
    if (!estCellule(de) || !estCellule(vers)) throw new Error('Cellule de départ ou d’arrivée invalide.');
    var t = M().tuileEn(doc, de.col, de.lig);
    if (!t) throw new Error('Aucune tuile dans cette cellule.');
    if (de.col === vers.col && de.lig === vers.lig) return M().clonerDocument(doc);
    var sans = M().retirerTuile(doc, de.col, de.lig);
    return poserTuileTournee(sans, t.modeleId, vers.col, vers.lig, t.rot);
  }

  /** Raison courte pour laquelle la jonction (i, j) ne porte plus de ville dans `doc`. */
  function raisonCourteJonction(doc, i, j) {
    var p = M().portsJonction(doc, i, j);
    if (p.tuiles < 4) return 'la jonction (' + i + ',' + j + ') n\'a plus 4 tuiles';
    var r = M().peutPoserJeton(doc, i, j).raison;
    return 'la jonction (' + i + ',' + j + ') : ' + (r || 'jeton invalide').replace(/\.$/, '').toLowerCase();
  }

  /**
   * Effets de bord d'une action (pure) : compare le document avant et après.
   * Renvoie { jetonsRetires: [{i, j, type, raison}] } (villes retirées faute de tuiles autour).
   */
  function effetsDeAction(avant, apres) {
    var res = { jetonsRetires: [] };
    avant.plateau.jetons.forEach(function (jt) {
      if (!jt) return;
      var reste = apres.plateau.jetons.some(function (x) { return x && x.i === jt.i && x.j === jt.j && x.type === jt.type; });
      if (!reste) res.jetonsRetires.push({ i: jt.i, j: jt.j, type: jt.type, raison: raisonCourteJonction(apres, jt.i, jt.j) });
    });
    return res;
  }

  /**
   * Raison d'un refus de pose pour la barre d'état : si le modèle est dessiné pour l'autre grille, la phrase qui le dit
   * (une phrase), sinon la raison donnée par PM.modele. Pure.
   */
  function raisonRefus(doc, modeleId, raison) {
    var m = M().modeleParId(doc, modeleId), B = PM.bibliotheque;
    var autre = m && B && typeof B.phraseAutreGrille === 'function' ? B.phraseAutreGrille(m, doc) : '';
    return autre || raison;
  }

  /**
   * Retrait d'une tuile par clic droit (pure). Renvoie { ok, doc, tuile, phrase, niveau } ; ok = false (sans autre champ utile)
   * si la cellule est vide ou hors grille. Les villes devenues invalides sont retirées avec la tuile et annoncées
   * dans `phrase` (qui se termine alors par « Ctrl+Z pour annuler. »), comme pour la touche Suppr.
   */
  function retirerParClicDroit(doc, col, lig) {
    var t = M().tuileEn(doc, col, lig);
    if (!t) return { ok: false, doc: doc, tuile: null, phrase: '', niveau: 'info' };
    var apres = M().retirerTuile(doc, col, lig);
    var msg = messageEffets(effetsDeAction(doc, apres));
    return {
      ok: true, doc: apres, tuile: { modeleId: t.modeleId, col: t.col, lig: t.lig, rot: t.rot },
      phrase: ('Tuile « ' + t.modeleId + ' » retirée de (' + col + ',' + lig + '). ' + (msg || '')).trim(),
      niveau: msg ? 'alerte' : 'info'
    };
  }

  /** Phrase pour la barre d'état décrivant les effets (null s'il n'y en a pas). Se termine par « Ctrl+Z pour annuler. ». */
  function messageEffets(effets) {
    var jr = effets.jetonsRetires || [];
    if (!jr.length) return null;
    var phrase = jr.length === 1 ? '1 ville retirée : ' + jr[0].raison + '.'
      : jr.length + ' villes retirées : ' + jr.map(function (x) { return x.raison; }).join(' ; ') + '.';
    return phrase + ' Ctrl+Z pour annuler.';
  }

  /* ------------------------------------------------------------------ */
  /* Jetons                                                              */
  /* ------------------------------------------------------------------ */

  /** Nombre de jetons posés. */
  function compterJetons(doc) { return doc.plateau.jetons.filter(Boolean).length; }

  /** Phrase après un clic sur la jonction (i, j) (pure) : ville posée ou retirée. */
  function messageJeton(apres, i, j) {
    var jt = apres.plateau.jetons.filter(function (x) { return x && x.i === i && x.j === j; })[0];
    return { texte: jt ? 'Ville sur la jonction (' + i + ',' + j + ').' : 'Ville retirée : la jonction (' + i + ',' + j + ') redevient une case chemin.', niveau: 'info' };
  }

  /* ------------------------------------------------------------------ */
  /* Cellules                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Étiquette d'une cellule libre : gabarit attendu et camp, par exemple « Bord, camp vert », « Centrale »,
   * « Bord, neutre » (rangée centrale du 5×5) ; null hors grille.
   */
  function etiquetteCellule(col, lig, format) {
    var F = leFormat(format), g = M().gabaritCellule(col, lig, F);
    if (!g) return null;
    if (g === 'centrale') return NOMS_GABARIT[g];
    var camp = F.campCellule(col, lig);
    return NOMS_GABARIT[g] + ', ' + (camp ? 'camp ' + camp : 'neutre');
  }

  /* ------------------------------------------------------------------ */
  /* Alertes visuelles et surbrillance                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Alertes à dessiner (pure), en mm dans le repère du plateau :
   *  - raccords morts de raison 'vide' ou 'mort' (pas 'absent') : {type:'raccord', col, lig, cote, pos, raison, x, y, nx, ny} ;
   *  - ports de coin vers le bord du plateau : {type:'port', col, lig, coin, i, j, x, y, nx, ny}.
   * (x, y) = point sur la frontière ou au coin ; (nx, ny) = direction vers l'intérieur de la tuile.
   */
  function alertesPlateau(doc) {
    var res = [], F = formatDoc(doc), C = F.COTE;
    M().raccordsMorts(doc).forEach(function (r) {
      if (r.raison === 'absent') return;
      var p = F.pointRaccord(r.cote, r.pos), n = NORMALE[r.cote];
      res.push({ type: 'raccord', col: r.col, lig: r.lig, cote: r.cote, pos: r.pos, raison: r.raison,
        x: r.col * C + p.x, y: r.lig * C + p.y, nx: n.x, ny: n.y });
    });
    M().portsVersPourtour(doc).forEach(function (p) {
      var k = F.pointCoin(p.coin), b = BISSECTRICE[p.coin];
      res.push({ type: 'port', col: p.col, lig: p.lig, coin: p.coin, i: p.i, j: p.j,
        x: p.col * C + k.x, y: p.lig * C + k.y, nx: b.x, ny: b.y });
    });
    return res;
  }

  /**
   * Formes à faire clignoter pour `surbrillance` (etat.ui().surbrillance), en mm :
   * [{forme:'rect', x, y, w, h} | {forme:'cercle', x, y, r}]. Accepte aussi les références brutes de
   * validerPlateau ('coin' pour un port, 'jeton' pour une jonction, 'modele').
   */
  function cibleSurbrillance(s, doc) {
    if (!s || typeof s !== 'object') return [];
    var F = formatDoc(doc), COTE = F.COTE;
    function cellule(col, lig) { return { forme: 'rect', x: col * COTE, y: lig * COTE, w: COTE, h: COTE }; }
    function tuilesDuModele(id) {
      return doc.plateau.tuiles.filter(function (t) { return t && t.modeleId === id; }).map(function (t) { return cellule(t.col, t.lig); });
    }
    switch (s.type) {
      case 'tuile': return typeof s.col === 'number' ? [cellule(s.col, s.lig)] : [];
      case 'raccord': {
        if (typeof s.cote !== 'number') return [cellule(s.col, s.lig)];
        var p = F.pointRaccord(s.cote, s.pos || 0);
        return [{ forme: 'cercle', x: s.col * COTE + p.x, y: s.lig * COTE + p.y, r: 12 }];
      }
      case 'port': case 'coin': {
        if (typeof s.col !== 'number') return [];
        var k = F.pointCoin(typeof s.coin === 'number' ? s.coin : s.id);
        if (!k) return [cellule(s.col, s.lig)];
        return [{ forme: 'cercle', x: s.col * COTE + k.x, y: s.lig * COTE + k.y, r: 14 }];
      }
      case 'jonction': case 'jeton':
        return typeof s.i === 'number' ? [{ forme: 'cercle', x: s.i * COTE, y: s.j * COTE, r: 22 }] : [];
      case 'case': case 'chemin': return tuilesDuModele(s.modeleId);
      case 'modele': return tuilesDuModele(s.id);
      default: return [];
    }
  }

  /* ------------------------------------------------------------------ */
  /* Dessin SVG (chaînes, sans DOM)                                      */
  /* ------------------------------------------------------------------ */

  /** Repère N d'une tuile (nord canonique du modèle, tourné de `rot`), coordonnées locales 0..COTE. */
  function repereNord(rot, F) {
    var p = F.tournerPoint({ x: F.COTE / 2, y: 9 }, rot);
    return '<g class="pm-assemblage-nord"><circle cx="' + arrondi(p.x) + '" cy="' + arrondi(p.y) + '" r="4.2"/>' +
      '<text x="' + arrondi(p.x) + '" y="' + arrondi(p.y + 2.2) + '" text-anchor="middle">N</text></g>';
  }

  /**
   * SVG complet du plateau (pure). `vue` : état d'affichage
   * { selection: {col,lig}|null, compatibles: {cle: true}|null, cible: {col,lig}|null,
   *   clignote: {cellule?: 'col,lig', jonction?: 'i,j'}|null, surbrillance }.
   */
  function svgPlateau(doc, vue) {
    verifierDocument(doc);
    vue = vue || {};
    var s = [];
    var F = formatDoc(doc), COTE = F.COTE, NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes, V = vuePour(F);
    var larg = NC * COTE, haut = NL * COTE, milieu = larg / 2, demi = COTE / 2;
    var dimensions = (larg / 10) + ' × ' + (haut / 10) + ' cm';
    s.push('<svg class="pm-assemblage-svg" xmlns="http://www.w3.org/2000/svg" viewBox="' + V.x + ' ' + V.y + ' ' + V.w + ' ' + V.h +
      '" role="group" aria-label="Plateau ' + NC + ' × ' + NL + ', ' + dimensions + '">');
    // Camps et dimensions
    s.push('<text class="pm-assemblage-camp pm-assemblage-camp-j1" x="' + milieu + '" y="-26" text-anchor="middle">Camp vert (nord)</text>');
    s.push('<text class="pm-assemblage-camp pm-assemblage-camp-j2" x="' + milieu + '" y="' + (haut + 32) + '" text-anchor="middle">Camp rouge (sud)</text>');
    s.push('<text class="pm-assemblage-dimensions" x="' + milieu + '" y="' + (haut + 56) + '" text-anchor="middle">' + dimensions + '</text>');
    s.push('<rect class="pm-assemblage-cadre" x="0" y="0" width="' + larg + '" height="' + haut + '"/>');
    // Rangées neutres (5×5 : la rangée centrale, dont les cases d'apparition ne servent à personne) : bande et repère permanents
    for (var rn = 0; rn < NL; rn++) {
      if (F.campCellule(0, rn)) continue;
      s.push('<g class="pm-assemblage-neutre" data-rangee-neutre="' + rn + '"><rect class="pm-assemblage-bande-neutre" x="0" y="' + (rn * COTE) + '" width="' + larg + '" height="' + COTE + '"/>' +
        '<text class="pm-assemblage-etiquette-neutre" x="' + (larg + 4) + '" y="' + (rn * COTE + demi + 4) + '">Neutre</text></g>');
    }

    // Cellules
    for (var lig = 0; lig < NL; lig++) {
      for (var col = 0; col < NC; col++) {
        var k = cle(col, lig), x = col * COTE, y = lig * COTE;
        var t = M().tuileEn(doc, col, lig);
        var classes = ['pm-assemblage-cellule'];
        var etiquette = etiquetteCellule(col, lig, F), camp = F.campCellule(col, lig) || 'neutre';
        var nom;
        classes.push(t ? 'pm-assemblage-occupee' : 'pm-assemblage-libre');
        if (vue.compatibles) classes.push(vue.compatibles[k] ? 'pm-assemblage-compatible' : 'pm-assemblage-estompee');
        if (vue.cible && vue.cible.col === col && vue.cible.lig === lig) classes.push('pm-assemblage-cible');
        if (vue.clignote && vue.clignote.cellule === k) classes.push('pm-assemblage-clignote');
        if (vue.selection && vue.selection.col === col && vue.selection.lig === lig) classes.push('pm-assemblage-selection');
        var m = t ? M().modeleParId(doc, t.modeleId) : null;
        if (t) nom = 'Tuile ' + t.modeleId + ' en (' + col + ',' + lig + '), R pour pivoter';
        else nom = 'Cellule libre (' + col + ',' + lig + ') : ' + etiquette;
        s.push('<g class="' + classes.join(' ') + '" data-cellule="' + k + '" data-cle="c:' + k + '" transform="translate(' + x + ' ' + y + ')"' +
          ' tabindex="0" role="button" aria-label="' + echapper(nom) + '">');
        if (t) {
          if (m) {
            s.push(PM.rendu.contenuTuile(m, { rot: t.rot, camp: camp, format: F }));
            s.push(repereNord(t.rot, F));
          } else {
            s.push('<rect class="pm-assemblage-absent" x="0" y="0" width="' + COTE + '" height="' + COTE + '"/>' +
              '<text class="pm-assemblage-etiquette" x="' + demi + '" y="' + (demi + 4) + '" text-anchor="middle">Modèle absent</text>');
          }
        } else {
          s.push('<rect class="pm-assemblage-silhouette" x="5" y="5" width="' + (COTE - 10) + '" height="' + (COTE - 10) + '" rx="4"/>' +
            '<text class="pm-assemblage-etiquette" x="' + demi + '" y="' + (demi + 4) + '" text-anchor="middle">' + echapper(etiquette) + '</text>');
        }
        s.push('<rect class="pm-assemblage-zone" x="0" y="0" width="' + COTE + '" height="' + COTE + '"><title>' + echapper(nom) + '</title></rect>');
        s.push('</g>');
      }
    }

    // Alertes (raccords et ports morts)
    alertesPlateau(doc).forEach(function (a) {
      var lg = a.type === 'raccord' ? F.LARGEUR_CHEMIN + 2 : 24;
      var titre = a.type === 'port' ? 'Port de coin vers le bord du plateau (aucune case de jonction)'
        : a.raison === 'vide' ? 'Raccord face au vide' : 'Raccord sans vis-à-vis';
      var ax = a.x + a.nx * 5, ay = a.y + a.ny * 5; // triangle légèrement à l'intérieur
      s.push('<g class="pm-assemblage-alerte" data-alerte="' + a.type + '">' +
        '<path class="pm-assemblage-alerte-trait" d="M' + arrondi(a.x) + ' ' + arrondi(a.y) + ' L' + arrondi(a.x + a.nx * lg) + ' ' + arrondi(a.y + a.ny * lg) + '"/>' +
        '<path class="pm-assemblage-alerte-triangle" d="M' + arrondi(ax) + ' ' + arrondi(ay - 9) + ' L' + arrondi(ax + 8) + ' ' + arrondi(ay + 5.5) +
          ' L' + arrondi(ax - 8) + ' ' + arrondi(ay + 5.5) + ' Z"/>' +
        '<text class="pm-assemblage-alerte-signe" x="' + arrondi(ax) + '" y="' + arrondi(ay + 4.2) + '" text-anchor="middle">!</text>' +
        '<title>' + echapper(titre) + '</title></g>');
    });

    // Jonctions et jetons
    for (var j = 1; j < NL; j++) {
      for (var i = 1; i < NC; i++) {
        var kj = cle(i, j), cx = i * COTE, cy = j * COTE;
        var jeton = doc.plateau.jetons.filter(function (x) { return x && x.i === i && x.j === j; })[0];
        var test = jeton ? { ok: true } : M().peutPoserJeton(doc, i, j);
        var cl = ['pm-assemblage-jonction'], info;
        if (jeton) {
          cl.push('pm-assemblage-jeton');
          info = 'Ville en (' + i + ',' + j + ') : clic pour la retirer (la jonction redevient une case chemin)';
        } else if (!test.ok) {
          cl.push('pm-assemblage-refusee');
          info = 'Case de jonction (' + i + ',' + j + ') : ' + test.raison;
        } else {
          cl.push('pm-assemblage-disponible');
          info = 'Case de jonction (' + i + ',' + j + ') : clic pour y poser une ville';
        }
        if (vue.clignote && vue.clignote.jonction === kj) cl.push('pm-assemblage-clignote');
        s.push('<g class="' + cl.join(' ') + '" data-jonction="' + kj + '" data-cle="j:' + kj + '" tabindex="0" role="button" aria-label="' + echapper(info) + '">');
        if (jeton) s.push(PM.rendu.contenuJeton(jeton.type, cx, cy, F));
        else s.push('<circle class="pm-assemblage-point" cx="' + cx + '" cy="' + cy + '" r="' + (test.ok ? 9 : 6) + '"/>');
        s.push('<circle class="pm-assemblage-zone-jonction" cx="' + cx + '" cy="' + cy + '" r="' + RAYON_JONCTION + '"><title>' + echapper(info) + '</title></circle>');
        s.push('</g>');
      }
    }

    // Surbrillance demandée par le panneau de contrôles
    cibleSurbrillance(vue.surbrillance, doc).forEach(function (f) {
      s.push(f.forme === 'rect'
        ? '<rect class="pm-assemblage-surbrillance" x="' + f.x + '" y="' + f.y + '" width="' + f.w + '" height="' + f.h + '"/>'
        : '<circle class="pm-assemblage-surbrillance" cx="' + arrondi(f.x) + '" cy="' + arrondi(f.y) + '" r="' + f.r + '"/>');
    });
    s.push('</svg>');
    return s.join('');
  }

  /* ------------------------------------------------------------------ */
  /* Montage (DOM)                                                       */
  /* ------------------------------------------------------------------ */

  var instance = null; // instance montée (pour le glissement lancé par la bibliothèque)

  /** Lance le glissement d'un modèle depuis la bibliothèque. Renvoie true si le plateau est monté. */
  function demarrerGlissement(modeleId, ev) {
    return !!(instance && instance.demarrer({ modeleId: modeleId, de: null }, ev));
  }

  function monter(conteneur, etat) {
    conteneur.classList.add('pm-assemblage');
    conteneur.innerHTML =
      '<div class="pm-assemblage-outils">' +
        '<span class="pm-assemblage-compteur" data-role="jetons" aria-live="polite"></span>' +
        '<span class="pm-assemblage-consigne" data-role="consigne"></span>' +
      '</div>' +
      '<div class="pm-assemblage-scene" data-role="scene"></div>' +
      '<div class="pm-assemblage-fantome" data-role="fantome" hidden></div>';
    var scene = conteneur.querySelector('[data-role="scene"]');
    var compteur = conteneur.querySelector('[data-role="jetons"]');
    var consigne = conteneur.querySelector('[data-role="consigne"]');
    var fantome = conteneur.querySelector('[data-role="fantome"]');

    var selection = null;      // tuile sélectionnée {col, lig}
    var glissement = null;     // {modeleId, de, rot, pointerId, compatibles, cible}
    var appui = null;          // appui sur le plateau en attente (clic ou début de glissement)
    var clignote = null, minuterie = null;

    function svg() { return scene.querySelector('svg'); }
    function rectSvg() { var e = svg(); return e ? e.getBoundingClientRect() : { left: 0, top: 0, width: 1, height: 1 }; }
    function formatCourant() { return formatDoc(etat.doc()); }
    function pointMm(ev) { return ecranVersMm(ev.clientX, ev.clientY, rectSvg(), vuePour(formatCourant())); }

    function compatiblesCourants() {
      var doc = etat.doc(), liste = null;
      if (glissement) {
        liste = glissement.de ? cellulesCompatiblesDeplacement(doc, glissement.de) : cellulesCompatibles(doc, glissement.modeleId);
      } else if (etat.ui().aPoser) {
        liste = cellulesCompatibles(doc, etat.ui().aPoser);
      }
      if (!liste) return null;
      var o = {};
      liste.forEach(function (c) { o[cle(c.col, c.lig)] = true; });
      return o;
    }

    function dessiner() {
      var doc = etat.doc(), ui = etat.ui();
      if (selection && !M().tuileEn(doc, selection.col, selection.lig)) selection = null;
      if (ui.aPoser && !M().modeleParId(doc, ui.aPoser)) { etat.majUi({ aPoser: null }); return; }
      var actif = document.activeElement, cleFocus = actif && scene.contains(actif) ? actif.getAttribute('data-cle') : null;
      scene.innerHTML = svgPlateau(doc, {
        selection: selection, compatibles: compatiblesCourants(), cible: glissement && glissement.cible,
        clignote: clignote, surbrillance: ui.surbrillance
      });
      if (cleFocus) { var el = scene.querySelector('[data-cle="' + cleFocus + '"]'); if (el) el.focus(); }
      compteur.textContent = 'Villes posées ' + compterJetons(doc) + '/' + NB_VILLES;
      var t = selection && M().tuileEn(doc, selection.col, selection.lig);
      if (ui.aPoser) consigne.textContent = 'Pose de « ' + ui.aPoser + ' » : cliquez une cellule éclairée (Échap pour annuler).';
      else if (t) consigne.textContent = 'Tuile (' + t.col + ',' + t.lig + ') sélectionnée : ' +
        'R ou clic pour pivoter, Suppr ou clic droit pour retirer, glisser pour déplacer.';
      else consigne.textContent = 'Clic sur une jonction : case chemin ou ville. Clic droit sur une tuile : la retirer.';
    }

    function faireClignoter(c) {
      clignote = c;
      clearTimeout(minuterie);
      dessiner();
      minuterie = setTimeout(function () { clignote = null; dessiner(); }, 900);
    }

    /** Applique une action qui peut retirer des jetons ou des tuiles, et le dit dans la barre d'état. */
    function appliquerAvecEffets(fn, libelle, phraseOk) {
      var avant = etat.doc(), apres;
      try { apres = fn(avant); } catch (e) { etat.signaler(e.message, 'erreur'); return false; }
      var effets = effetsDeAction(avant, apres);
      var r = etat.appliquer(function () { return apres; }, libelle);
      if (!r.ok) return false;
      var msg = messageEffets(effets);
      etat.signaler(((phraseOk || '') + ' ' + (msg || '')).trim(), msg ? 'alerte' : 'info');
      return true;
    }

    function poserIci(modeleId, col, lig, quarts) {
      var doc = etat.doc(), test = M().peutPoserTuile(doc, modeleId, col, lig);
      if (!test.ok) { faireClignoter({ cellule: cle(col, lig) }); etat.signaler(raisonRefus(doc, modeleId, test.raison), 'erreur'); return false; }
      var r = etat.appliquer(function (d) { return poserTuileTournee(d, modeleId, col, lig, quarts); }, 'pose de ' + modeleId);
      if (r.ok) {
        selection = { col: col, lig: lig };
        etat.signaler('Tuile « ' + modeleId + ' » posée en (' + col + ',' + lig + ')' +
          ' : R pour la pivoter.', 'info');
      }
      return r.ok;
    }

    function deplacerIci(de, vers) {
      var test = testerDeplacement(etat.doc(), de, vers);
      if (test.identique) { dessiner(); return; }
      if (!test.ok) {
        var tp = M().tuileEn(etat.doc(), de.col, de.lig);
        faireClignoter({ cellule: cle(vers.col, vers.lig) });
        etat.signaler(tp ? raisonRefus(etat.doc(), tp.modeleId, test.raison) : test.raison, 'erreur');
        return;
      }
      if (appliquerAvecEffets(function (d) { return deplacerTuile(d, de, vers); }, 'déplacement de tuile',
        'Tuile déplacée de (' + de.col + ',' + de.lig + ') en (' + vers.col + ',' + vers.lig + ').')) {
        selection = { col: vers.col, lig: vers.lig };
        dessiner();
      }
    }

    function pivoterSelection() {
      var doc = etat.doc(), t = selection && M().tuileEn(doc, selection.col, selection.lig);
      if (!t) return;
      appliquerAvecEffets(function (d) { return M().tournerTuile(d, t.col, t.lig, 1); }, 'rotation',
        'Tuile (' + t.col + ',' + t.lig + ') pivotée d\'un quart de tour.');
    }

    function retirerSelection() {
      var t = selection && M().tuileEn(etat.doc(), selection.col, selection.lig);
      if (!t) return;
      var de = { col: t.col, lig: t.lig };
      selection = null;
      appliquerAvecEffets(function (d) { return M().retirerTuile(d, de.col, de.lig); }, 'retrait de tuile',
        'Tuile « ' + t.modeleId + ' » retirée de (' + de.col + ',' + de.lig + ').');
    }

    function cyclerIci(i, j) {
      var doc = etat.doc();
      var aJeton = doc.plateau.jetons.some(function (x) { return x && x.i === i && x.j === j; });
      if (!aJeton) {
        var test = M().peutPoserJeton(doc, i, j);
        if (!test.ok) {
          faireClignoter({ jonction: cle(i, j) });
          etat.signaler(test.raison, 'erreur');
          return;
        }
      }
      var r = etat.appliquer(function (d) { return M().cyclerJeton(d, i, j); }, 'jeton (' + i + ',' + j + ')');
      if (r.ok) { var msg = messageJeton(etat.doc(), i, j); etat.signaler(msg.texte, msg.niveau); }
    }

    /** Action d'un clic (ou Entrée) sur un élément du plateau. */
    function activer(el) {
      var doc = etat.doc(), ui = etat.ui();
      var jn = el && el.closest('[data-jonction]');
      if (jn) { var pj = jn.getAttribute('data-jonction').split(',').map(Number); cyclerIci(pj[0], pj[1]); return; }
      var ce = el && el.closest('[data-cellule]');
      if (!ce) { if (selection) { selection = null; dessiner(); } return; }
      var p = ce.getAttribute('data-cellule').split(',').map(Number), col = p[0], lig = p[1];
      var t = M().tuileEn(doc, col, lig);
      if (ui.aPoser && !t) {
        if (poserIci(ui.aPoser, col, lig, null)) etat.majUi({ aPoser: null });
        return;
      }
      if (t) {
        if (selection && selection.col === col && selection.lig === lig) { pivoterSelection(); return; }
        selection = { col: col, lig: lig };
        dessiner();
        return;
      }
      selection = null;
      dessiner();
      var et = etiquetteCellule(col, lig, formatDoc(doc));
      etat.signaler('Cellule (' + col + ',' + lig + ') : ' + (et || '').toLowerCase() +
        '. Choisissez dans la bibliothèque une tuile de ce rôle (clic puis clic ici, ou glisser).', 'info');
    }

    /* --- Glissement ------------------------------------------------- */

    function dessinerFantome() {
      if (!glissement) { fantome.hidden = true; fantome.innerHTML = ''; return; }
      var m = M().modeleParId(etat.doc(), glissement.modeleId), F = formatCourant();
      var taille = F.COTE * cadrage(rectSvg(), vuePour(F)).echelle;
      fantome.style.width = taille + 'px';
      fantome.style.height = taille + 'px';
      fantome.innerHTML = '<svg viewBox="0 0 ' + F.COTE + ' ' + F.COTE + '" width="100%" height="100%" aria-hidden="true">' +
        PM.rendu.contenuTuile(m, { rot: glissement.rot || 0, format: F }) + '</svg>';
      fantome.hidden = false;
    }

    function placerFantome(ev) {
      var F = formatCourant(), taille = F.COTE * cadrage(rectSvg(), vuePour(F)).echelle;
      fantome.style.transform = 'translate(' + (ev.clientX - taille / 2) + 'px,' + (ev.clientY - taille / 2) + 'px)';
    }

    function demarrer(g, ev) {
      if (etat.ui().onglet !== 'plateau') return false;
      var doc = etat.doc(), m = M().modeleParId(doc, g.modeleId);
      if (!m) return false;
      var t = g.de ? M().tuileEn(doc, g.de.col, g.de.lig) : null;
      // rot null : rotation suggérée à la pose (tuile neuve) ; R pendant le glissement fixe la rotation
      glissement = { modeleId: g.modeleId, de: g.de, rot: t ? t.rot : null, pointerId: ev.pointerId, cible: null };
      if (etat.ui().aPoser) etat.majUi({ aPoser: null });
      conteneur.classList.add('pm-assemblage-glisse');
      dessiner();
      dessinerFantome();
      placerFantome(ev);
      bouger(ev);
      return true;
    }

    function bouger(ev) {
      if (!glissement) return;
      placerFantome(ev);
      var p = pointMm(ev), c = celluleSous(p.x, p.y, formatCourant());
      var avant = glissement.cible;
      if ((avant && c && avant.col === c.col && avant.lig === c.lig) || (!avant && !c)) return;
      glissement.cible = c;
      dessiner();
    }

    function lacher(ev) {
      if (!glissement) return;
      var g = glissement, p = pointMm(ev), c = celluleSous(p.x, p.y, formatCourant());
      terminerGlissement();
      if (!c) {
        etat.signaler(g.de ? 'Déplacement annulé : lâchez la tuile sur une cellule du plateau.' : 'Pose annulée : lâchez la tuile sur une cellule du plateau.', 'info');
        return;
      }
      if (g.de) deplacerIci(g.de, c);
      else poserIci(g.modeleId, c.col, c.lig, g.rot);
    }

    function terminerGlissement() {
      glissement = null;
      conteneur.classList.remove('pm-assemblage-glisse');
      dessinerFantome();
      dessiner();
    }

    instance = { demarrer: demarrer };

    scene.addEventListener('pointerdown', function (ev) {
      if (ev.button !== 0) return;
      var ce = ev.target.closest('[data-cellule]'), jn = ev.target.closest('[data-jonction]');
      var de = null;
      if (ce && !jn) {
        var p = ce.getAttribute('data-cellule').split(',').map(Number);
        if (M().tuileEn(etat.doc(), p[0], p[1])) de = { col: p[0], lig: p[1] };
      }
      appui = { x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId, cible: ev.target, de: de };
      if (de) ev.preventDefault(); // évite la sélection de texte pendant le glissement
    });

    document.addEventListener('pointermove', function (ev) {
      if (glissement) { if (ev.pointerId === glissement.pointerId) bouger(ev); return; }
      if (!appui || ev.pointerId !== appui.pointerId || !appui.de) return;
      if (Math.hypot(ev.clientX - appui.x, ev.clientY - appui.y) < PM_SEUIL()) return;
      var t = M().tuileEn(etat.doc(), appui.de.col, appui.de.lig), de = appui.de;
      appui = null;
      if (t) { selection = de; demarrer({ modeleId: t.modeleId, de: de }, ev); }
    });

    document.addEventListener('pointerup', function (ev) {
      if (glissement) { if (ev.pointerId === glissement.pointerId) lacher(ev); return; }
      if (!appui || ev.pointerId !== appui.pointerId) return;
      var cible = appui.cible;
      appui = null;
      if (scene.contains(cible)) activer(cible);
      else { // l'élément a été redessiné entre-temps : retrouver la cible par la position
        var F = formatCourant(), p = pointMm(ev), jn = jonctionSous(p.x, p.y, F), c = celluleSous(p.x, p.y, F);
        var el = jn ? scene.querySelector('[data-jonction="' + cle(jn.i, jn.j) + '"]')
          : c ? scene.querySelector('[data-cellule="' + cle(c.col, c.lig) + '"]') : null;
        activer(el);
      }
    });

    document.addEventListener('pointercancel', function () { appui = null; if (glissement) terminerGlissement(); });

    // Clic droit : pas de menu du navigateur sur le plateau ; sur une tuile posée, elle est retirée (annulable)
    scene.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (glissement) return;
      var ce = ev.target.closest('[data-cellule]'), jn = ev.target.closest('[data-jonction]');
      if (!ce || jn) return;
      var p = ce.getAttribute('data-cellule').split(',').map(Number);
      var r = retirerParClicDroit(etat.doc(), p[0], p[1]);
      if (!r.ok) return;
      appui = null;
      if (selection && selection.col === p[0] && selection.lig === p[1]) selection = null;
      if (etat.appliquer(function () { return r.doc; }, 'retrait de tuile').ok) etat.signaler(r.phrase, r.niveau);
    });

    // Clavier sur un élément du plateau qui a le focus : Entrée / Espace = clic
    scene.addEventListener('keydown', function (ev) {
      if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.closest('[data-cle]')) {
        ev.preventDefault();
        activer(ev.target);
      }
    });

    // Raccourcis de l'onglet plateau : R, Suppr, Échap
    document.addEventListener('keydown', function (ev) {
      if (etat.ui().onglet !== 'plateau') return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.target && /^(INPUT|TEXTAREA|SELECT)$/.test(ev.target.tagName)) return;
      var k = ev.key;
      if (k === 'r' || k === 'R') {
        if (glissement) {
          glissement.rot = ((glissement.rot || 0) + 1) % 4;
          dessinerFantome();
          ev.preventDefault();
        } else if (selection) { pivoterSelection(); ev.preventDefault(); }
      } else if (k === 'Delete') {
        if (selection) { retirerSelection(); ev.preventDefault(); }
      } else if (k === 'Escape') {
        if (glissement) { terminerGlissement(); etat.signaler('Glissement annulé.', 'info'); }
        else if (etat.ui().aPoser) etat.majUi({ aPoser: null });
        else if (selection) { selection = null; dessiner(); }
      }
    });

    // La surbrillance s'efface au clic suivant (n'importe où).
    document.addEventListener('pointerdown', function () {
      if (etat.ui().surbrillance && etat.ui().onglet === 'plateau') etat.majUi({ surbrillance: null });
    }, true);

    // Le fantôme suit la taille du plateau si la fenêtre change pendant un glissement.
    window.addEventListener('resize', function () { if (glissement) dessinerFantome(); });

    etat.abonner(function () { dessiner(); });
    dessiner();
  }

  function PM_SEUIL() { return (PM.bibliotheque && PM.bibliotheque.SEUIL_GLISSEMENT) || 5; }

  PM.assemblage = {
    VUE: VUE,
    vuePour: vuePour,
    COTE: COTE,
    RAYON_CELLULE: RAYON_CELLULE,
    RAYON_JONCTION: RAYON_JONCTION,
    cadrage: cadrage,
    ecranVersMm: ecranVersMm,
    mmVersEcran: mmVersEcran,
    celluleSous: celluleSous,
    jonctionSous: jonctionSous,
    cellulesCompatibles: cellulesCompatibles,
    cellulesCompatiblesDeplacement: cellulesCompatiblesDeplacement,
    poserTuileTournee: poserTuileTournee,
    testerDeplacement: testerDeplacement,
    deplacerTuile: deplacerTuile,
    effetsDeAction: effetsDeAction,
    messageEffets: messageEffets,
    retirerParClicDroit: retirerParClicDroit,
    raisonRefus: raisonRefus,
    compterJetons: compterJetons,
    messageJeton: messageJeton,
    etiquetteCellule: etiquetteCellule,
    alertesPlateau: alertesPlateau,
    cibleSurbrillance: cibleSurbrillance,
    svgPlateau: svgPlateau,
    demarrerGlissement: demarrerGlissement,
    monter: monter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.assemblage;
})();
