/*
 * assemblage.js : écran du plateau (grille du format du document, pose des tuiles, jetons, alertes visuelles).
 * Le calcul est fait par des fonctions pures exportées (testées sous Node) ; le DOM n'est
 * manipulé que dans `monter`. Unité : mm (viewBox du SVG en mm, cellule de COTE mm : 120 en 4×4).
 *
 * Repères : cellule (col, lig), origine en haut à gauche (nord-ouest), lignes croissantes vers le sud ;
 * jonction (i, j) = (colonne, ligne) des coins de cellules, intérieure si 1 ≤ i ≤ colonnes - 1 et
 * 1 ≤ j ≤ lignes - 1 (1..3 en 4×4), en (i·COTE, j·COTE) mm.
 * Les fonctions sans document prennent un dernier paramètre `format` facultatif (4×4 par défaut).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var RAYON_JONCTION = 15;        // aimantation d'un jeton (D10)

  function M() { return PM.modele; }
  function G() { return PM.geometrie; }
  /** Format de grille à partir d'un objet format, d'un identifiant ou de rien (4×4). */
  function leFormat(f) {
    if (f && typeof f === 'object') return f;
    return G().format(f === undefined || f === null ? G().FORMAT_DEFAUT : f);
  }
  /** Format du document (champ `format`, absent = 4×4). */
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
  var LIBELLE_ROLE = { centrale: 'une centrale', coin: 'un coin', bord: 'un bord', apparition: 'une apparition' };

  function cle(a, b) { return a + ',' + b; }
  function arrondi(n) { return Math.round(n * 1000) / 1000; }
  function echapper(s) {
    return String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pluriel(n, mot, mots) { return n + ' ' + (n > 1 ? (mots || mot + 's') : mot); }

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

  function estCentrale(doc, modeleId) {
    var m = M().modeleParId(doc, modeleId);
    return !!m && m.role === 'centrale';
  }

  /**
   * Pose un modèle puis, pour une centrale, la tourne de `quarts` quarts de tour (pure, une seule étape
   * d'historique). La rotation est ignorée pour les autres rôles (rotation déduite). Lève une Error si refus.
   */
  function poserTuileTournee(doc, modeleId, col, lig, quarts) {
    var n = M().poserTuile(doc, modeleId, col, lig);
    var q = ((quarts || 0) % 4 + 4) % 4;
    if (q && estCentrale(doc, modeleId)) n = M().tournerTuile(n, col, lig, q);
    return n;
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
   * Déplace une tuile (pure) : retrait puis pose, la rotation d'une centrale est conservée.
   * Les jetons devenus invalides sont retirés (par retirerTuile). Lève une Error si la pose est refusée.
   */
  /** Objet cellule {col, lig} (les valeurs elles-mêmes sont jugées par PM.modele). */
  function estCellule(c) { return !!c && typeof c === 'object'; }

  /** Lève une Error explicite (et non un TypeError natif) si le document n'a pas la forme attendue. */
  function verifierDocument(doc) {
    var p = doc && doc.plateau;
    if (!p || typeof p !== 'object' || !Array.isArray(p.tuiles) || !Array.isArray(p.jetons) || !p.forme || typeof p.forme !== 'object') {
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

  function libelleJeton(type) { return type === 'carrefour' ? 'carrefour' : 'ville'; }

  /** Raison courte pour laquelle la jonction (i, j) ne porte plus de jeton dans `doc`. */
  function raisonCourteJonction(doc, i, j) {
    var p = M().portsJonction(doc, i, j);
    if (p.tuiles < 4) return 'la jonction (' + i + ',' + j + ') n\'a plus 4 tuiles';
    if (p.ports < formatDoc(doc).MIN_PORTS_JONCTION) return 'la jonction (' + i + ',' + j + ') n\'a plus que ' + pluriel(p.ports, 'port');
    var r = M().peutPoserJeton(doc, i, j).raison;
    return 'la jonction (' + i + ',' + j + ') : ' + (r || 'jeton invalide').replace(/\.$/, '').toLowerCase();
  }

  /**
   * Effets de bord d'une action (pure) : compare le document avant et après.
   * Renvoie { jetonsRetires: [{i, j, type, raison}], tuilesRetirees: [{col, lig, modeleId}],
   *           tuilesARevoir: [{col, lig, modeleId, attendu}] } (tuiles restées en place dont le rôle ne
   * correspond plus à la cellule, par exemple après un changement de forme).
   */
  function effetsDeAction(avant, apres) {
    var res = { jetonsRetires: [], tuilesRetirees: [], tuilesARevoir: [] };
    avant.plateau.jetons.forEach(function (jt) {
      if (!jt) return;
      var reste = apres.plateau.jetons.some(function (x) { return x && x.i === jt.i && x.j === jt.j && x.type === jt.type; });
      if (!reste) res.jetonsRetires.push({ i: jt.i, j: jt.j, type: jt.type, raison: raisonCourteJonction(apres, jt.i, jt.j) });
    });
    avant.plateau.tuiles.forEach(function (t) {
      if (!t) return;
      // effet de bord seulement : tuile disparue parce que sa cellule est retirée par la nouvelle forme
      var reste = apres.plateau.tuiles.some(function (x) { return x && x.col === t.col && x.lig === t.lig && x.modeleId === t.modeleId; });
      var celluleRetiree = (apres.plateau.forme && Array.isArray(apres.plateau.forme.retires) ? apres.plateau.forme.retires : [])
        .some(function (r) { return r && r.col === t.col && r.lig === t.lig; });
      if (!reste && celluleRetiree) res.tuilesRetirees.push({ col: t.col, lig: t.lig, modeleId: t.modeleId });
    });
    function maloriente(doc, t) {
      return M().verifierTuilePosee(doc, t).some(function (e) { return e.code === 'role_incorrect' || e.code === 'role_impossible'; });
    }
    apres.plateau.tuiles.forEach(function (t) {
      if (!t || !maloriente(apres, t)) return;
      var tAvant = M().tuileEn(avant, t.col, t.lig);
      if (tAvant && tAvant.modeleId === t.modeleId && maloriente(avant, tAvant)) return; // déjà signalée avant
      res.tuilesARevoir.push({ col: t.col, lig: t.lig, modeleId: t.modeleId, attendu: M().roleCellule(t.col, t.lig, apres.plateau.forme, formatDoc(apres)) });
    });
    return res;
  }

  /** Phrase pour la barre d'état décrivant les effets (null s'il n'y en a pas). Se termine par « Ctrl+Z pour annuler. ». */
  function messageEffets(effets) {
    var phrases = [];
    var tr = effets.tuilesRetirees || [], jr = effets.jetonsRetires || [], ar = effets.tuilesARevoir || [];
    if (tr.length) {
      phrases.push((tr.length > 1 ? tr.length + ' tuiles retirées : ' : '1 tuile retirée : ') +
        tr.map(function (t) { return '(' + t.col + ',' + t.lig + ')'; }).join(', ') + '.');
    }
    if (jr.length === 1) {
      var j = jr[0];
      phrases.push('1 ' + libelleJeton(j.type) + ' retiré' + (j.type === 'carrefour' ? '' : 'e') + ' : ' + j.raison + '.');
    } else if (jr.length > 1) {
      var nv = jr.filter(function (x) { return x.type !== 'carrefour'; }).length, nc = jr.length - nv;
      var detail = [nv ? pluriel(nv, 'ville') : '', nc ? pluriel(nc, 'carrefour') : ''].filter(Boolean).join(', ');
      phrases.push(jr.length + ' jetons retirés (' + detail + ') : ' + jr.map(function (x) { return x.raison; }).join(' ; ') + '.');
    }
    if (ar.length) {
      phrases.push(ar.map(function (t) {
        return 'La tuile (' + t.col + ',' + t.lig + ') ne convient plus à sa cellule' +
          (t.attendu ? ' (' + LIBELLE_ROLE[t.attendu] + ' attendu' + (t.attendu === 'centrale' || t.attendu === 'apparition' ? 'e' : '') + ')' : '') + '.';
      }).join(' '));
    }
    if (!phrases.length) return null;
    return phrases.join(' ') + ' Ctrl+Z pour annuler.';
  }

  /* ------------------------------------------------------------------ */
  /* Jetons                                                              */
  /* ------------------------------------------------------------------ */

  /** Nombre de jetons posés. */
  function compterJetons(doc) { return doc.plateau.jetons.filter(Boolean).length; }

  /**
   * Côté d'une jonction : 'nord' (camp J1), 'sud' (camp J2) ou null (rangée du milieu, neutre),
   * selon la règle unique PM.modele.campJonction. Interprétation de la règle « jamais les 2 carrefours du même côté ».
   */
  function coteJonction(j, format) {
    var camp = M().campJonction(null, j, format);
    return camp === 1 ? 'nord' : camp === 2 ? 'sud' : null;
  }

  /** Côté où se trouvent au moins 2 carrefours ('nord' | 'sud'), ou null (règle manuelle, sans blocage). */
  function carrefoursMemeCote(doc) {
    var n = { nord: 0, sud: 0 }, F = formatDoc(doc);
    doc.plateau.jetons.forEach(function (jt) {
      if (jt && jt.type === 'carrefour') { var c = coteJonction(jt.j, F); if (c) n[c]++; }
    });
    return n.nord >= 2 ? 'nord' : n.sud >= 2 ? 'sud' : null;
  }

  /** Phrase d'alerte si les carrefours sont du même côté, sinon null. */
  function alerteCarrefours(doc) {
    var c = carrefoursMemeCote(doc);
    if (!c) return null;
    return 'Les 2 carrefours sont du même côté (' + (c === 'nord' ? 'camp J1, nord' : 'camp J2, sud') +
      ') : la règle demande de ne pas les regrouper.';
  }

  /** Phrase après un cycle de jeton sur (i, j) (pure). */
  function messageJeton(apres, i, j) {
    var jt = apres.plateau.jetons.filter(function (x) { return x && x.i === i && x.j === j; })[0];
    var base = jt ? (jt.type === 'carrefour' ? 'Carrefour' : 'Ville') + ' sur la jonction (' + i + ',' + j + ').'
      : 'Jeton retiré de la jonction (' + i + ',' + j + ').';
    var a = alerteCarrefours(apres);
    return { texte: a ? base + ' ' + a : base, niveau: a ? 'alerte' : 'info' };
  }

  /* ------------------------------------------------------------------ */
  /* Formes du plateau                                                   */
  /* ------------------------------------------------------------------ */

  /** Les 15 formes proposées : [{cle, groupe, libelle, forme: {retires}}]. */
  function formesProposees(format) {
    var F = leFormat(format), dc = F.GRILLE.colonnes - 1, dl = F.GRILLE.lignes - 1;
    var COINS = [{ col: 0, lig: 0 }, { col: dc, lig: 0 }, { col: dc, lig: dl }, { col: 0, lig: dl }];
    var NOMS_COIN = {};
    ['NO', 'NE', 'SE', 'SO'].forEach(function (nom, k) { NOMS_COIN[cle(COINS[k].col, COINS[k].lig)] = nom; });
    var complet = F.GRILLE.colonnes + '×' + F.GRILLE.lignes + ' complet';
    var res = [{ cle: 'complet', groupe: complet, libelle: complet, forme: { retires: [] } }];
    COINS.forEach(function (c) {
      res.push({ cle: 'c' + c.col + c.lig, groupe: '1 coin retiré', libelle: 'Sans le coin ' + NOMS_COIN[cle(c.col, c.lig)],
        forme: { retires: [{ col: c.col, lig: c.lig }] } });
    });
    for (var a = 0; a < 4; a++) {
      for (var b = a + 1; b < 4; b++) {
        var ca = COINS[a], cb = COINS[b];
        res.push({ cle: 'c' + ca.col + ca.lig + 'c' + cb.col + cb.lig, groupe: '2 coins retirés',
          libelle: 'Sans les coins ' + NOMS_COIN[cle(ca.col, ca.lig)] + ' et ' + NOMS_COIN[cle(cb.col, cb.lig)],
          forme: { retires: [{ col: ca.col, lig: ca.lig }, { col: cb.col, lig: cb.lig }] } });
      }
    }
    COINS.forEach(function (c) {
      var bord = { col: c.col, lig: c.lig === 0 ? 1 : dl - 1 };
      res.push({ cle: 'c' + c.col + c.lig + 'b' + bord.col + bord.lig, groupe: 'Coin et bord voisin',
        libelle: 'Sans le coin ' + NOMS_COIN[cle(c.col, c.lig)] + ' et le bord (' + bord.col + ',' + bord.lig + ')',
        forme: { retires: [{ col: c.col, lig: c.lig }, bord] } });
    });
    return res;
  }

  /** Clé de la forme proposée identique à `forme` (ordre des cellules indifférent), ou null. */
  function cleForme(forme, format) {
    var r = (forme && Array.isArray(forme.retires) ? forme.retires : []).map(function (x) { return x && cle(x.col, x.lig); }).sort().join('|');
    var f = formesProposees(format).filter(function (p) {
      return p.forme.retires.map(function (x) { return cle(x.col, x.lig); }).sort().join('|') === r;
    })[0];
    return f ? f.cle : null;
  }

  /** Étiquette d'une cellule libre : 'Coin', 'Bord', 'Apparition J1', 'Apparition J2', 'Centrale', ou null. */
  function etiquetteCellule(col, lig, forme, format) {
    var r = M().roleCellule(col, lig, forme, format);
    if (r === 'apparition') return 'Apparition J' + M().joueurCellule(col, lig, format);
    return r ? r.charAt(0).toUpperCase() + r.slice(1) : null;
  }

  /* ------------------------------------------------------------------ */
  /* Alertes visuelles et surbrillance                                   */
  /* ------------------------------------------------------------------ */

  /**
   * Alertes à dessiner (pure), en mm dans le repère du plateau :
   *  - raccords morts de raison 'vide' ou 'mort' (pas 'absent') : {type:'raccord', col, lig, cote, pos, raison, x, y, nx, ny} ;
   *  - ports de coin morts : {type:'port', col, lig, coin, i, j, x, y, nx, ny}.
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
    M().portsCoinMorts(doc).forEach(function (p) {
      var k = F.pointCoin(p.coin), b = BISSECTRICE[p.coin];
      res.push({ type: 'port', col: p.col, lig: p.lig, coin: p.coin, i: p.i, j: p.j,
        x: p.col * C + k.x, y: p.lig * C + k.y, nx: b.x, ny: b.y });
    });
    return res;
  }

  /**
   * Formes à faire clignoter pour `surbrillance` (etat.ui().surbrillance), en mm :
   * [{forme:'rect', x, y, w, h} | {forme:'cercle', x, y, r}]. Accepte aussi les références brutes de
   * validerPlateau ('coin' pour un port, 'jeton' pour une jonction, 'modele', 'forme').
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
      case 'forme': return [{ forme: 'rect', x: 0, y: 0, w: F.GRILLE.colonnes * COTE, h: F.GRILLE.lignes * COTE }];
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
    var forme = doc.plateau.forme, s = [];
    var F = formatDoc(doc), COTE = F.COTE, NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes, V = vuePour(F);
    var larg = NC * COTE, haut = NL * COTE, milieu = larg / 2, demi = COTE / 2;
    var dimensions = (larg / 10) + ' × ' + (haut / 10) + ' cm';
    s.push('<svg class="pm-assemblage-svg" xmlns="http://www.w3.org/2000/svg" viewBox="' + V.x + ' ' + V.y + ' ' + V.w + ' ' + V.h +
      '" role="group" aria-label="Plateau ' + NC + ' × ' + NL + ', ' + dimensions + '">');
    // Camps et dimensions
    s.push('<text class="pm-assemblage-camp pm-assemblage-camp-j1" x="' + milieu + '" y="-26" text-anchor="middle">Camp J1 (nord)</text>');
    s.push('<text class="pm-assemblage-camp pm-assemblage-camp-j2" x="' + milieu + '" y="' + (haut + 32) + '" text-anchor="middle">Camp J2 (sud)</text>');
    s.push('<text class="pm-assemblage-dimensions" x="' + milieu + '" y="' + (haut + 56) + '" text-anchor="middle">' + dimensions + '</text>');
    s.push('<rect class="pm-assemblage-cadre" x="0" y="0" width="' + larg + '" height="' + haut + '"/>');

    // Cellules
    for (var lig = 0; lig < NL; lig++) {
      for (var col = 0; col < NC; col++) {
        var k = cle(col, lig), x = col * COTE, y = lig * COTE;
        var t = M().tuileEn(doc, col, lig), role = M().roleCellule(col, lig, forme, F);
        var classes = ['pm-assemblage-cellule'];
        var etiquette = etiquetteCellule(col, lig, forme, F);
        var nom;
        if (t) classes.push('pm-assemblage-occupee');
        else if (role === null) classes.push('pm-assemblage-retiree');
        else classes.push('pm-assemblage-libre');
        if (vue.compatibles) classes.push(vue.compatibles[k] ? 'pm-assemblage-compatible' : 'pm-assemblage-estompee');
        if (vue.cible && vue.cible.col === col && vue.cible.lig === lig) classes.push('pm-assemblage-cible');
        if (vue.clignote && vue.clignote.cellule === k) classes.push('pm-assemblage-clignote');
        if (vue.selection && vue.selection.col === col && vue.selection.lig === lig) classes.push('pm-assemblage-selection');
        var m = t ? M().modeleParId(doc, t.modeleId) : null;
        if (t) nom = 'Tuile ' + t.modeleId + ' en (' + col + ',' + lig + ')' + (m && m.role === 'centrale' ? ', centrale (R pour pivoter)' : '');
        else if (role === null) nom = 'Cellule (' + col + ',' + lig + ') retirée du plateau';
        else nom = 'Cellule libre (' + col + ',' + lig + ') : ' + etiquette;
        s.push('<g class="' + classes.join(' ') + '" data-cellule="' + k + '" data-cle="c:' + k + '" transform="translate(' + x + ' ' + y + ')"' +
          ' tabindex="0" role="button" aria-label="' + echapper(nom) + '">');
        if (t) {
          if (m) {
            s.push(PM.rendu.contenuTuile(m, { rot: t.rot, joueur: M().joueurCellule(col, lig, F), format: F }));
            s.push(repereNord(t.rot, F));
          } else {
            s.push('<rect class="pm-assemblage-absent" x="0" y="0" width="' + COTE + '" height="' + COTE + '"/>' +
              '<text class="pm-assemblage-etiquette" x="' + demi + '" y="' + (demi + 4) + '" text-anchor="middle">Modèle absent</text>');
          }
        } else if (role === null) {
          s.push('<rect class="pm-assemblage-fond-retire" x="4" y="4" width="' + (COTE - 8) + '" height="' + (COTE - 8) + '"/>' +
            '<text class="pm-assemblage-etiquette" x="' + demi + '" y="' + (demi + 4) + '" text-anchor="middle">Retirée</text>');
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
      var titre = a.type === 'port' ? 'Port de coin vers une jonction qui ne peut pas recevoir de jeton'
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
        var possible = M().jonctionPossible(forme, i, j, F);
        var test = jeton ? { ok: true } : M().peutPoserJeton(doc, i, j);
        var cl = ['pm-assemblage-jonction'], info;
        if (jeton) {
          cl.push('pm-assemblage-jeton');
          info = (jeton.type === 'carrefour' ? 'Carrefour' : 'Ville') + ' en (' + i + ',' + j + ') : clic pour ' +
            (jeton.type === 'carrefour' ? 'retirer le jeton' : 'passer en carrefour');
        } else if (!possible) {
          cl.push('pm-assemblage-impossible');
          info = 'Jonction (' + i + ',' + j + ') impossible avec cette forme : il lui manque une tuile voisine ou des ports.';
        } else if (!test.ok) {
          cl.push('pm-assemblage-refusee');
          info = 'Jonction (' + i + ',' + j + ') : ' + test.raison;
        } else {
          cl.push('pm-assemblage-disponible');
          info = 'Jonction (' + i + ',' + j + ') libre : clic pour poser une ville';
        }
        if (vue.clignote && vue.clignote.jonction === kj) cl.push('pm-assemblage-clignote');
        s.push('<g class="' + cl.join(' ') + '" data-jonction="' + kj + '" data-cle="j:' + kj + '" tabindex="0" role="button" aria-label="' + echapper(info) + '">');
        if (jeton) s.push(PM.rendu.contenuJeton(jeton.type, cx, cy, F));
        else s.push('<circle class="pm-assemblage-point" cx="' + cx + '" cy="' + cy + '" r="' + (possible ? 9 : 6) + '"/>');
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
    var formes = formesProposees();
    var groupes = [];
    formes.forEach(function (f) { if (groupes.indexOf(f.groupe) < 0) groupes.push(f.groupe); });

    conteneur.classList.add('pm-assemblage');
    conteneur.innerHTML =
      '<div class="pm-assemblage-outils">' +
        '<label class="pm-assemblage-forme">Forme ' +
          '<select data-role="forme">' + groupes.map(function (g) {
            return '<optgroup label="' + echapper(g) + '">' + formes.filter(function (f) { return f.groupe === g; }).map(function (f) {
              return '<option value="' + f.cle + '">' + echapper(f.libelle) + '</option>';
            }).join('') + '</optgroup>';
          }).join('') + '</select>' +
        '</label>' +
        '<span class="pm-assemblage-compteur" data-role="jetons" aria-live="polite"></span>' +
        '<span class="pm-assemblage-consigne" data-role="consigne"></span>' +
      '</div>' +
      '<div class="pm-assemblage-scene" data-role="scene"></div>' +
      '<div class="pm-assemblage-fantome" data-role="fantome" hidden></div>';
    var scene = conteneur.querySelector('[data-role="scene"]');
    var selForme = conteneur.querySelector('[data-role="forme"]');
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
      var F = formatDoc(doc), k = cleForme(doc.plateau.forme, F);
      selForme.value = k || '';
      compteur.textContent = 'Jetons posés ' + compterJetons(doc) + '/' + ((F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1));
      var t = selection && M().tuileEn(doc, selection.col, selection.lig);
      if (ui.aPoser) consigne.textContent = 'Pose de « ' + ui.aPoser + ' » : cliquez une cellule éclairée (Échap pour annuler).';
      else if (t) consigne.textContent = 'Tuile (' + t.col + ',' + t.lig + ') sélectionnée : ' +
        (estCentrale(doc, t.modeleId) ? 'R ou clic pour pivoter, ' : 'sens posé automatiquement, ') + 'Suppr pour retirer, glisser pour déplacer.';
      else consigne.textContent = 'Clic sur une jonction : ville, carrefour, vide.';
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
      if (!test.ok) { faireClignoter({ cellule: cle(col, lig) }); etat.signaler(test.raison, 'erreur'); return false; }
      var r = etat.appliquer(function (d) { return poserTuileTournee(d, modeleId, col, lig, quarts); }, 'pose de ' + modeleId);
      if (r.ok) {
        selection = { col: col, lig: lig };
        etat.signaler('Tuile « ' + modeleId + ' » posée en (' + col + ',' + lig + ')' +
          (estCentrale(etat.doc(), modeleId) ? ' : R pour la pivoter.' : ', dans le bon sens automatiquement.'), 'info');
      }
      return r.ok;
    }

    function deplacerIci(de, vers) {
      var test = testerDeplacement(etat.doc(), de, vers);
      if (test.identique) { dessiner(); return; }
      if (!test.ok) { faireClignoter({ cellule: cle(vers.col, vers.lig) }); etat.signaler(test.raison, 'erreur'); return; }
      if (appliquerAvecEffets(function (d) { return deplacerTuile(d, de, vers); }, 'déplacement de tuile',
        'Tuile déplacée de (' + de.col + ',' + de.lig + ') en (' + vers.col + ',' + vers.lig + ').')) {
        selection = { col: vers.col, lig: vers.lig };
        dessiner();
      }
    }

    function pivoterSelection() {
      var doc = etat.doc(), t = selection && M().tuileEn(doc, selection.col, selection.lig);
      if (!t) return;
      if (!estCentrale(doc, t.modeleId)) {
        etat.signaler('Les coins, bords et apparitions sont tournés automatiquement selon leur cellule.', 'info');
        return;
      }
      appliquerAvecEffets(function (d) { return M().tournerTuile(d, t.col, t.lig, 1); }, 'rotation',
        'Centrale (' + t.col + ',' + t.lig + ') pivotée d\'un quart de tour.');
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
          var raison = M().jonctionPossible(doc.plateau.forme, i, j, formatDoc(doc)) ? test.raison
            : 'Cette jonction ne peut pas recevoir de jeton avec cette forme de plateau.';
          faireClignoter({ jonction: cle(i, j) });
          etat.signaler(raison, 'erreur');
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
        if (poserIci(ui.aPoser, col, lig, 0)) etat.majUi({ aPoser: null });
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
      var et = etiquetteCellule(col, lig, doc.plateau.forme, formatDoc(doc));
      etat.signaler(et ? 'Cellule (' + col + ',' + lig + ') : ' + et.toLowerCase() + ' attendu' +
        (/^(Centrale|Apparition)/.test(et) ? 'e' : '') + '. Glissez une tuile de ce rôle depuis la bibliothèque.'
        : 'Cette cellule est retirée du plateau.', 'info');
    }

    /* --- Glissement ------------------------------------------------- */

    function dessinerFantome() {
      if (!glissement) { fantome.hidden = true; fantome.innerHTML = ''; return; }
      var m = M().modeleParId(etat.doc(), glissement.modeleId), F = formatCourant();
      var taille = F.COTE * cadrage(rectSvg(), vuePour(F)).echelle;
      fantome.style.width = taille + 'px';
      fantome.style.height = taille + 'px';
      fantome.innerHTML = '<svg viewBox="0 0 ' + F.COTE + ' ' + F.COTE + '" width="100%" height="100%" aria-hidden="true">' +
        PM.rendu.contenuTuile(m, { rot: glissement.rot, joueur: null, format: F }) + '</svg>';
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
      glissement = { modeleId: g.modeleId, de: g.de, rot: t ? t.rot : 0, pointerId: ev.pointerId, cible: null };
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
          if (estCentrale(etat.doc(), glissement.modeleId)) { glissement.rot = (glissement.rot + 1) % 4; dessinerFantome(); }
          else etat.signaler('Seules les centrales pivotent : les autres tuiles sont tournées automatiquement.', 'info');
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

    selForme.addEventListener('change', function () {
      var f = formes.filter(function (x) { return x.cle === selForme.value; })[0];
      if (!f) return;
      appliquerAvecEffets(function (d) { return M().changerForme(d, f.forme); }, 'forme du plateau', 'Forme : ' + f.libelle.charAt(0).toLowerCase() + f.libelle.slice(1) + '.');
      dessiner();
    });

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
    compterJetons: compterJetons,
    coteJonction: coteJonction,
    carrefoursMemeCote: carrefoursMemeCote,
    alerteCarrefours: alerteCarrefours,
    messageJeton: messageJeton,
    formesProposees: formesProposees,
    cleForme: cleForme,
    etiquetteCellule: etiquetteCellule,
    alertesPlateau: alertesPlateau,
    cibleSurbrillance: cibleSurbrillance,
    svgPlateau: svgPlateau,
    demarrerGlissement: demarrerGlissement,
    monter: monter
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.assemblage;
})();
