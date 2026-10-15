/*
 * export.js : export pour impression (planches de tuiles, planche de jetons, aperçu du plateau).
 * Voir docs/6-avis-prepresse.md. Unité interne : le millimètre.
 *
 * Architecture : une seule source, le SVG.
 *  - calepiner() produit des planches en données pures (tuiles, repères de coupe, textes, barre de contrôle) ;
 *  - svgPlanche() / svgJetons() / svgApercuPlateau() en tirent un SVG en mm, avec le dessin des tuiles
 *    fourni par PM.rendu (rien n'est redessiné ici) ;
 *  - pdfDepuisPlanches() convertit ce SVG en PDF vectoriel (sous-ensemble SVG connu, erreur sur tout
 *    élément inconnu pour qu'une primitive oubliée ne disparaisse pas sans bruit) ;
 *  - le PNG est rastérisé dans un <canvas> (navigateur seulement), puis reçoit le chunk pHYs.
 * Les fonctions de calcul n'accèdent pas au DOM (testées sous Node) ; seules rasteriser(),
 * telecharger() et ouvrir() utilisent le navigateur.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});
if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node
if (!PM.rendu && typeof require === 'function') require('./rendu.js');

(function () {
  'use strict';

  var G = PM.geometrie, R = PM.rendu, M = PM.modele;

  /* ------------------------------------------------------------------ */
  /* Constantes                                                          */
  /* ------------------------------------------------------------------ */

  var FOND_PERDU = 3;                    // mm
  var COTE_PLANCHE = G.COTE + 2 * FOND_PERDU; // 126 mm : tuile avec fond perdu
  var GOUTTIERE = 6;                     // mm entre deux fonds perdus
  var PAS = COTE_PLANCHE + GOUTTIERE;    // 132 mm
  var MARGE_MIN = 15;                    // mm
  var MARGE_IMPRIMABLE = 5;              // mm : zone que les imprimantes de bureau ne couvrent pas
  var EPAISSEUR_REPERE = 0.25;           // mm
  var LONGUEUR_REPERE = 5;               // mm (hors gouttière)
  var DECALAGE_REPERE = 3;               // mm depuis le bord du fond perdu (hors gouttière)
  var JEU_GOUTTIERE = 1;                 // mm entre un repère partagé et chaque fond perdu
  var PT = 72 / 25.4;                    // 1 mm en points
  var TAILLE_ID = 7 * 25.4 / 72;         // 7 pt exprimés en mm
  var NOIR_REPERAGE = '#000000';
  var DPI = 300;
  var PX_PAR_METRE = 11811;              // 300 dpi

  /** Formats de feuille (portrait). L'A4 ne peut pas porter deux colonnes (2 x 126 + 6 = 258 mm > 210 mm). */
  var FORMATS = {
    A3: { largeur: 297, hauteur: 420, colonnes: 2, lignes: 3 },
    A4: { largeur: 210, hauteur: 297, colonnes: 1, lignes: 2 }
  };

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  function echapper(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function desechapper(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  }
  /** Nombre arrondi au millième, jamais en notation exponentielle (invalide en PDF). */
  function nb(x) {
    var s = (Math.round(x * 1000) / 1000).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return s === '-0' ? '0' : s;
  }
  function tab(x) { return Array.isArray(x) ? x : []; }
  function compareId(a, b) { return String(a).localeCompare(String(b), 'fr', { numeric: true }); }

  /** Largeurs des glyphes Helvetica (millièmes de corps) pour les caractères ASCII 32..126. */
  var LARGEURS_HELVETICA = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

  /** Largeur approximative d'un texte (mm) pour un corps `taille` (mm). */
  function largeurTexte(texte, taille) {
    var w = 0;
    String(texte).split('').forEach(function (c) {
      var k = c.charCodeAt(0);
      w += (k >= 32 && k <= 126) ? LARGEURS_HELVETICA[k - 32] : 556;
    });
    return w * taille / 1000;
  }

  /* ------------------------------------------------------------------ */
  /* Liste des tuiles à imprimer                                         */
  /* ------------------------------------------------------------------ */

  function modeleAApparition(m) {
    return tab(m && m.cases).some(function (c) { return c && c.type === 'apparition'; });
  }

  /**
   * Tuiles à imprimer. options : { portee = 'stock' | 'posees' }.
   * Renvoie { tuiles: [{ modeleId, exemplaire, joueur, posee }], exclus: [{ id, nom }] }.
   *  - 'stock' : chaque exemplaire de chaque modèle complet ; les tuiles posées d'abord ;
   *  - 'posees' : seulement les tuiles posées sur le plateau.
   * Les modèles incomplets sont exclus et listés dans `exclus`. Tri par identifiant (ordre naturel).
   * Les tuiles d'apparition reçoivent leur joueur : celui de leur cellule si elles sont posées, puis
   * 2 exemplaires par joueur ; à défaut, alternance (au sein de chaque modèle d'abord).
   */
  function listeTuiles(doc, options) {
    var portee = options && options.portee === 'posees' ? 'posees' : 'stock';
    var modeles = tab(doc && doc.modeles).filter(function (m) { return m && typeof m === 'object'; });
    var tuilesPosees = tab(doc && doc.plateau && doc.plateau.tuiles);
    var exclus = [], entrees = [];
    modeles.slice().sort(function (a, b) { return compareId(a.id, b.id); }).forEach(function (m) {
      if (!M.validerModele(m).complet) {
        exclus.push({ id: String(m.id), nom: String(m.nom || m.id) });
        return;
      }
      var posees = tuilesPosees.filter(function (t) { return t && t.modeleId === m.id; })
        .sort(function (a, b) { return (a.lig - b.lig) || (a.col - b.col); });
      var total = portee === 'posees' ? posees.length : (Number.isInteger(m.exemplaires) && m.exemplaires > 0 ? m.exemplaires : 0);
      for (var k = 0; k < total; k++) {
        var posee = k < posees.length;
        var joueur = null;
        if (posee && modeleAApparition(m)) joueur = M.joueurCellule(posees[k].col, posees[k].lig);
        entrees.push({ modeleId: m.id, exemplaire: k + 1, joueur: joueur, posee: posee, _app: modeleAApparition(m) });
      }
    });
    // Joueurs des apparitions non posées : 2 par joueur, alternance au sein de chaque modèle.
    var compte = { 1: 0, 2: 0 }, parModele = {};
    entrees.forEach(function (e) {
      if (!e.joueur) return;
      compte[e.joueur]++;
      parModele[e.modeleId] = parModele[e.modeleId] || { 1: 0, 2: 0 };
      parModele[e.modeleId][e.joueur]++;
    });
    entrees.forEach(function (e) {
      if (!e._app || e.joueur) return;
      var pm = parModele[e.modeleId] = parModele[e.modeleId] || { 1: 0, 2: 0 };
      var candidats = [1, 2].filter(function (j) { return compte[j] < 2; });
      if (!candidats.length) candidats = [1, 2];
      candidats.sort(function (a, b) { return (pm[a] - pm[b]) || (compte[a] - compte[b]) || (a - b); });
      e.joueur = candidats[0];
      compte[e.joueur]++;
      pm[e.joueur]++;
    });
    var tri = function (a, b) { return compareId(a.modeleId, b.modeleId) || (a.exemplaire - b.exemplaire); };
    var tuiles = entrees.filter(function (e) { return e.posee; }).sort(tri)
      .concat(entrees.filter(function (e) { return !e.posee; }).sort(tri))
      .map(function (e) { return { modeleId: e.modeleId, exemplaire: e.exemplaire, joueur: e.joueur, posee: e.posee }; });
    return { tuiles: tuiles, exclus: exclus };
  }

  /* ------------------------------------------------------------------ */
  /* Calepinage                                                          */
  /* ------------------------------------------------------------------ */

  /** Marges (mm) d'un format ; lève une Error si la grille ne tient pas avec des marges >= 15 mm. */
  function margesFormat(nomFormat) {
    var f = FORMATS[nomFormat];
    if (!f) throw new Error('Format inconnu : ' + nomFormat + '.');
    var utile = { x: f.colonnes * COTE_PLANCHE + (f.colonnes - 1) * GOUTTIERE, y: f.lignes * COTE_PLANCHE + (f.lignes - 1) * GOUTTIERE };
    var mx = (f.largeur - utile.x) / 2, my = (f.hauteur - utile.y) / 2;
    if (mx < MARGE_MIN - 1e-9 || my < MARGE_MIN - 1e-9) {
      throw new Error('La grille ne tient pas sur ' + nomFormat + ' avec des marges d\'au moins ' + MARGE_MIN + ' mm.');
    }
    return { x: mx, y: my };
  }

  /**
   * Repères de coupe d'une planche : segments { x1, y1, x2, y2, partage } de 0,25 mm.
   * Chaque coin de coupe reçoit un trait horizontal et un trait vertical, jamais dans le fond perdu.
   *  - côté libre (marge, ou case voisine vide) : trait de 5 mm décalé de 3 mm du fond perdu ;
   *  - côté voisin d'une autre tuile : un seul trait commun dans la gouttière (6 mm), à 1 mm de
   *    chaque fond perdu, qui sert aux deux tuiles car leurs lignes de coupe sont alignées.
   */
  function calculerReperes(planche) {
    var occupe = {}, vus = {}, res = [];
    planche.tuiles.forEach(function (t) { occupe[t.col + ',' + t.lig] = true; });
    function ajouter(x1, y1, x2, y2, partage) {
      var a = [x1, y1, x2, y2].map(function (v) { return Math.round(v * 1000) / 1000; });
      var cle = a.join(',');
      if (vus[cle]) return;
      vus[cle] = true;
      res.push({ x1: a[0], y1: a[1], x2: a[2], y2: a[3], partage: partage });
    }
    planche.tuiles.forEach(function (t) {
      [-1, 1].forEach(function (sx) {
        [-1, 1].forEach(function (sy) {
          var bordX = t.x + (sx > 0 ? COTE_PLANCHE : 0), bordY = t.y + (sy > 0 ? COTE_PLANCHE : 0); // bord du fond perdu
          var coupeX = bordX - sx * FOND_PERDU, coupeY = bordY - sy * FOND_PERDU;                    // coin de coupe
          var voisinX = occupe[(t.col + sx) + ',' + t.lig], voisinY = occupe[t.col + ',' + (t.lig + sy)];
          // trait horizontal, sur la ligne de coupe y = coupeY
          if (voisinX) {
            var a = bordX + sx * JEU_GOUTTIERE, b = bordX + sx * (GOUTTIERE - JEU_GOUTTIERE);
            ajouter(Math.min(a, b), coupeY, Math.max(a, b), coupeY, true);
          } else {
            var c = bordX + sx * DECALAGE_REPERE, d = c + sx * LONGUEUR_REPERE;
            ajouter(Math.min(c, d), coupeY, Math.max(c, d), coupeY, false);
          }
          // trait vertical, sur la ligne de coupe x = coupeX
          if (voisinY) {
            var e = bordY + sy * JEU_GOUTTIERE, f = bordY + sy * (GOUTTIERE - JEU_GOUTTIERE);
            ajouter(coupeX, Math.min(e, f), coupeX, Math.max(e, f), true);
          } else {
            var g = bordY + sy * DECALAGE_REPERE, h = g + sy * LONGUEUR_REPERE;
            ajouter(coupeX, Math.min(g, h), coupeX, Math.max(g, h), false);
          }
        });
      });
    });
    return res;
  }

  /** Textes d'une planche : [{ texte, x, y, taille (mm), ancre, gras }] (y = ligne de base). */
  function calculerTextes(planche) {
    var textes = [];
    planche.tuiles.forEach(function (t) {
      textes.push({ texte: t.etiquette, x: t.x + 10, y: t.y - 1.5, taille: TAILLE_ID, ancre: 'start', gras: false });
    });
    textes.push({ texte: planche.titre, x: planche.margeX + 6, y: 10, taille: 3.5, ancre: 'start', gras: true });
    var b = planche.barre;
    textes.push({ texte: '100 mm', x: b.x + b.longueur + 2, y: b.y + 0.9, taille: 2.5, ancre: 'start', gras: false });
    return textes;
  }

  /** Boîte englobante approximative d'un texte : { x0, y0, x1, y1 }. */
  function boiteTexte(t) {
    var w = largeurTexte(t.texte, t.taille), x0 = t.ancre === 'middle' ? t.x - w / 2 : t.ancre === 'end' ? t.x - w : t.x;
    return { x0: x0, y0: t.y - 0.75 * t.taille, x1: x0 + w, y1: t.y + 0.22 * t.taille };
  }

  /** Boîte de la barre de contrôle (graduations comprises). */
  function boiteBarre(b) { return { x0: b.x - 0.2, y0: b.y - 2.5, x1: b.x + b.longueur + 0.2, y1: b.y + 2.5 }; }

  function barreControle(f, margeX) {
    return { x: margeX + 6, y: f.hauteur - 8, longueur: 100, graduation: 10 };
  }

  /**
   * Répartit les tuiles en planches.
   * options : { format = 'A3' | 'A4', portee = 'stock' | 'posees' }.
   * Une planche : { format, nom, titre, numero, total, largeur, hauteur, colonnes, lignes, margeX, margeY, pas,
   *   tuiles: [{ modeleId, exemplaire, joueur, posee, col, lig, rot, x, y, etiquette }], reperes, textes, barre }.
   * (x, y) = coin nord-ouest du carré de 126 mm (fond perdu compris), pas de la tuile coupée (qui est à +3 mm).
   * rot vaut 0 : la tuile physique est imprimée en orientation canonique, on la tourne à la pose.
   * Lève une Error si la grille ne tient pas sur la feuille.
   */
  function calepiner(doc, options) {
    var nomFormat = options && options.format ? options.format : 'A3';
    var f = FORMATS[nomFormat], marges = margesFormat(nomFormat);
    var liste = listeTuiles(doc, options).tuiles;
    var parPlanche = f.colonnes * f.lignes, nbPlanches = Math.ceil(liste.length / parPlanche);
    var exemplairesDe = {};
    tab(doc && doc.modeles).forEach(function (m) { if (m) exemplairesDe[m.id] = m.exemplaires; });
    var planches = [];
    for (var p = 0; p < nbPlanches; p++) {
      var planche = {
        format: nomFormat, nom: 'plateau-tuiles-' + nomFormat + '-' + (p + 1),
        titre: 'Plateau modulaire - tuiles ' + nomFormat + ' - planche ' + (p + 1) + '/' + nbPlanches,
        numero: p + 1, total: nbPlanches, largeur: f.largeur, hauteur: f.hauteur,
        colonnes: f.colonnes, lignes: f.lignes, margeX: marges.x, margeY: marges.y, pas: PAS, tuiles: []
      };
      liste.slice(p * parPlanche, (p + 1) * parPlanche).forEach(function (t, k) {
        var col = k % f.colonnes, lig = Math.floor(k / f.colonnes);
        var etiquette = t.modeleId + (exemplairesDe[t.modeleId] > 1 ? '-' + t.exemplaire : '');
        planche.tuiles.push({
          modeleId: t.modeleId, exemplaire: t.exemplaire, joueur: t.joueur, posee: t.posee, col: col, lig: lig, rot: 0,
          x: marges.x + col * PAS, y: marges.y + lig * PAS, etiquette: etiquette
        });
      });
      planche.reperes = calculerReperes(planche);
      planche.barre = barreControle(f, marges.x);
      planche.textes = calculerTextes(planche);
      // SVG calculé à la demande (propriété non énumérable) : pdfDepuisPlanches(calepiner(doc)) fonctionne seul.
      Object.defineProperty(planche, 'svg', { enumerable: false, get: svgPlancheDe.bind(null, doc, planche) });
      planches.push(planche);
    }
    return planches;
  }

  /** Dimensions en pixels à 300 dpi, arrondies à l'entier : A3 3508 x 4961, A4 2480 x 3508. */
  function pngDims(planche) {
    return {
      largeurPx: Math.round(planche.largeur * DPI / 25.4),
      hauteurPx: Math.round(planche.hauteur * DPI / 25.4)
    };
  }

  /* ------------------------------------------------------------------ */
  /* SVG                                                                 */
  /* ------------------------------------------------------------------ */

  function enveloppeSvg(l, h, corps) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + l + 'mm" height="' + h + 'mm" viewBox="0 0 ' + l + ' ' + h + '">' +
      '<rect x="0" y="0" width="' + l + '" height="' + h + '" fill="' + R.COULEURS.blanc + '"/>' + corps + '</svg>';
  }
  function svgLigne(x1, y1, x2, y2, epaisseur, couleur) {
    return '<line x1="' + nb(x1) + '" y1="' + nb(y1) + '" x2="' + nb(x2) + '" y2="' + nb(y2) + '" stroke="' + couleur +
      '" stroke-width="' + epaisseur + '"/>';
  }
  function svgTexte(t, couleur) {
    return '<text x="' + nb(t.x) + '" y="' + nb(t.y) + '" font-family="Helvetica, Arial, sans-serif" font-size="' + nb(t.taille) + '"' +
      (t.gras ? ' font-weight="bold"' : '') + (t.ancre && t.ancre !== 'start' ? ' text-anchor="' + t.ancre + '"' : '') +
      ' fill="' + (couleur || R.COULEURS.noir) + '">' + echapper(t.texte) + '</text>';
  }
  function svgBarre(b) {
    var s = svgLigne(b.x, b.y, b.x + b.longueur, b.y, EPAISSEUR_REPERE, NOIR_REPERAGE);
    for (var d = 0; d <= b.longueur + 1e-9; d += b.graduation) {
      var grand = d % 50 === 0, h = grand ? 2.5 : 1.5;
      s += svgLigne(b.x + d, b.y - h, b.x + d, b.y + h, EPAISSEUR_REPERE, NOIR_REPERAGE);
    }
    return s;
  }

  function svgPlancheDe(doc, planche) { return svgPlanche(doc, planche); }

  /** SVG d'une planche de tuiles (voir calepiner). `doc` fournit les modèles. */
  function svgPlanche(doc, planche) {
    var corps = '', n = 0;
    planche.tuiles.forEach(function (t) {
      var modele = M.modeleParId(doc, t.modeleId);
      if (!modele) throw new Error('Modèle introuvable : ' + t.modeleId);
      n++;
      var id = 'pm-clip-' + n;
      corps += '<g transform="translate(' + nb(t.x + FOND_PERDU) + ' ' + nb(t.y + FOND_PERDU) + ')" clip-path="url(#' + id + ')">' +
        '<clipPath id="' + id + '"><rect x="' + (-FOND_PERDU) + '" y="' + (-FOND_PERDU) + '" width="' + COTE_PLANCHE + '" height="' + COTE_PLANCHE + '"/></clipPath>' +
        R.contenuTuile(modele, { rot: t.rot || 0, joueur: t.joueur, fondPerdu: FOND_PERDU, contour: false }) + '</g>';
    });
    planche.reperes.forEach(function (r) { corps += svgLigne(r.x1, r.y1, r.x2, r.y2, EPAISSEUR_REPERE, NOIR_REPERAGE); });
    corps += svgBarre(planche.barre);
    planche.textes.forEach(function (t) { corps += svgTexte(t); });
    return enveloppeSvg(planche.largeur, planche.hauteur, corps);
  }

  /** Jetons de la planche : 7 villes ('capture') puis 2 carrefours. */
  var JETONS = ['capture', 'capture', 'capture', 'capture', 'capture', 'capture', 'capture', 'carrefour', 'carrefour'];
  var PAS_JETON = 38, DIAMETRE_JETON_FP = 33, COLONNES_JETONS = 5;

  /** Géométrie de la planche de jetons (A4) : centres, rayon de coupe, textes. */
  function planchesJetons() {
    var f = FORMATS.A4, rCoupe = G.DIAMETRE_JETON / 2, rFp = DIAMETRE_JETON_FP / 2;
    var largeurGrille = (COLONNES_JETONS - 1) * PAS_JETON + DIAMETRE_JETON_FP, x0 = (f.largeur - largeurGrille) / 2 + rFp, y0 = 40;
    var jetons = JETONS.map(function (type, k) {
      return { type: type, cx: x0 + (k % COLONNES_JETONS) * PAS_JETON, cy: y0 + Math.floor(k / COLONNES_JETONS) * PAS_JETON };
    });
    var margeX = (f.largeur - 150) / 2;
    return {
      format: 'A4', nom: 'plateau-jetons-A4', titre: 'Plateau modulaire - jetons A4 (7 villes, 2 carrefours)', numero: 1, total: 1,
      largeur: f.largeur, hauteur: f.hauteur, rayonCoupe: rCoupe, rayonFondPerdu: rFp, jetons: jetons, margeX: margeX,
      barre: barreControle(f, margeX)
    };
  }

  /**
   * SVG de la planche de jetons : 9 jetons de 33 mm (30 mm + 1,5 mm de fond perdu), pas de 38 mm.
   * Repères : quatre petits traits radiaux hors fond perdu, qui pointent vers le cercle de coupe (Ø 30 mm).
   */
  function svgJetons() {
    var p = planchesJetons(), corps = '';
    p.jetons.forEach(function (j) {
      if (j.type === 'capture') {
        corps += '<circle cx="' + nb(j.cx) + '" cy="' + nb(j.cy) + '" r="' + p.rayonFondPerdu + '" fill="' + R.COULEURS.noir + '"/>';
      }
      corps += R.contenuJeton(j.type, j.cx, j.cy);
      // Cercle de coupe (Ø 30 mm), trait fin sans remplissage.
      corps += '<circle cx="' + nb(j.cx) + '" cy="' + nb(j.cy) + '" r="' + p.rayonCoupe + '" fill="none" stroke="' + NOIR_REPERAGE + '" stroke-width="' + EPAISSEUR_REPERE + '"/>';
      for (var a = 0; a < 4; a++) {
        var dx = Math.round(Math.cos(a * Math.PI / 2)), dy = Math.round(Math.sin(a * Math.PI / 2));
        var r1 = p.rayonFondPerdu + 1.5, r2 = r1 + 2.5;
        corps += svgLigne(j.cx + dx * r1, j.cy + dy * r1, j.cx + dx * r2, j.cy + dy * r2, EPAISSEUR_REPERE, NOIR_REPERAGE);
      }
    });
    corps += svgBarre(p.barre);
    corps += svgTexte({ texte: p.titre, x: p.margeX, y: 10, taille: 3.5, ancre: 'start', gras: true });
    corps += svgTexte({ texte: '100 mm', x: p.barre.x + p.barre.longueur + 2, y: p.barre.y + 0.9, taille: 2.5, ancre: 'start', gras: false });
    return enveloppeSvg(p.largeur, p.hauteur, corps);
  }

  /** Aperçu du plateau assemblé (48 x 48 cm) mis à l'échelle sur A3, sans repères : non imprimable. */
  function svgApercuPlateau(doc) {
    var f = FORMATS.A3, cote = G.COTE * G.GRILLE.colonnes, echelle = 270 / cote, x0 = (f.largeur - 270) / 2, y0 = 50;
    var corps = '<g transform="translate(' + nb(x0) + ' ' + nb(y0) + ') scale(' + nb(echelle) + ')">', n = 0;
    tab(doc && doc.plateau && doc.plateau.tuiles).forEach(function (t) {
      var modele = M.modeleParId(doc, t.modeleId);
      var tx = t.col * G.COTE, ty = t.lig * G.COTE;
      if (!modele || !M.validerModele(modele).complet) {
        corps += '<rect x="' + tx + '" y="' + ty + '" width="' + G.COTE + '" height="' + G.COTE + '" fill="none" stroke="' + R.COULEURS.noir +
          '" stroke-width="0.5" stroke-dasharray="3 3"/>';
        return;
      }
      n++;
      var id = 'pm-clip-' + n;
      corps += '<g transform="translate(' + tx + ' ' + ty + ')" clip-path="url(#' + id + ')">' +
        '<clipPath id="' + id + '"><rect x="0" y="0" width="' + G.COTE + '" height="' + G.COTE + '"/></clipPath>' +
        R.contenuTuile(modele, { rot: t.rot || 0, joueur: M.joueurCellule(t.col, t.lig), fondPerdu: 0, contour: true }) + '</g>';
    });
    tab(doc && doc.plateau && doc.plateau.jetons).forEach(function (j) {
      if (j && (j.type === 'capture' || j.type === 'carrefour')) corps += R.contenuJeton(j.type, j.i * G.COTE, j.j * G.COTE);
    });
    corps += '<rect x="0" y="0" width="' + cote + '" height="' + cote + '" fill="none" stroke="' + R.COULEURS.noir + '" stroke-width="0.8"/></g>';
    corps += svgTexte({ texte: 'Aperçu, non imprimable', x: f.largeur / 2, y: 28, taille: 9, ancre: 'middle', gras: true });
    corps += svgTexte({ texte: 'Plateau assemblé 48 x 48 cm, réduit à 56 % : aucun repère de coupe.', x: f.largeur / 2, y: 38, taille: 3.5, ancre: 'middle', gras: false });
    return enveloppeSvg(f.largeur, f.hauteur, corps);
  }

  /* ------------------------------------------------------------------ */
  /* SVG -> PDF (sous-ensemble produit par ce module et par PM.rendu)    */
  /* ------------------------------------------------------------------ */

  function lireAttributs(chaine) {
    var a = {}, re = /([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*"([^"]*)"/g, m;
    while ((m = re.exec(chaine))) a[m[1]] = desechapper(m[2]);
    return a;
  }
  function num(a, nom, defaut) {
    if (a[nom] === undefined) return defaut;
    var v = parseFloat(a[nom]);
    if (!isFinite(v)) throw new Error('Valeur numérique invalide pour ' + nom + ' : ' + a[nom]);
    return v;
  }

  /** Couleur SVG -> "r g b" (0..1) ou null pour « none ». */
  function couleurPdf(c) {
    if (c === undefined) c = '#000000';
    if (c === 'none') return null;
    var noms = { black: '#000000', white: '#FFFFFF' };
    if (noms[c]) c = noms[c];
    var m = /^#([0-9a-fA-F]{6})$/.exec(c);
    if (!m) throw new Error('Couleur SVG non prise en charge : ' + c);
    return [0, 2, 4].map(function (i) { return nb(parseInt(m[1].substr(i, 2), 16) / 255); }).join(' ');
  }

  /** Chaîne PDF (WinAnsi) : caractères hors ASCII en octal, '?' au-delà de 255. */
  function chainePdf(s) {
    var r = '';
    String(s).split('').forEach(function (c) {
      var k = c.charCodeAt(0);
      if (c === '(' || c === ')' || c === '\\') r += '\\' + c;
      else if (k >= 32 && k <= 126) r += c;
      else if (k > 255 || k < 32) r += '?';
      else r += '\\' + ('00' + k.toString(8)).slice(-3);
    });
    return '(' + r + ')';
  }

  /** Opérateur de peinture selon fill / stroke. */
  function operateur(fill, stroke) { return fill && stroke ? 'B' : fill ? 'f' : stroke ? 'S' : 'n'; }

  /** Réglages de trait et de remplissage en opérateurs PDF. */
  function reglages(a) {
    var fill = couleurPdf(a.fill === undefined ? '#000000' : a.fill), stroke = a.stroke === undefined ? null : couleurPdf(a.stroke), s = '';
    if (fill) s += fill + ' rg ';
    if (stroke) {
      s += stroke + ' RG ' + nb(num(a, 'stroke-width', 1)) + ' w ';
      s += ({ butt: 0, round: 1, square: 2 }[a['stroke-linecap'] || 'butt'] || 0) + ' J ';
      s += ({ miter: 0, round: 1, bevel: 2 }[a['stroke-linejoin'] || 'miter'] || 0) + ' j ';
      if (a['stroke-dasharray'] && a['stroke-dasharray'] !== 'none') {
        s += '[' + a['stroke-dasharray'].trim().split(/[\s,]+/).map(function (v) { return nb(parseFloat(v)); }).join(' ') + '] 0 d ';
      }
    }
    return { texte: s, op: operateur(fill, stroke) };
  }

  var K_BEZIER = 0.5522847498;
  function cheminRectangle(x, y, w, h, r) {
    if (!(r > 0)) return nb(x) + ' ' + nb(y) + ' ' + nb(w) + ' ' + nb(h) + ' re';
    r = Math.min(r, w / 2, h / 2);
    var k = r * (1 - K_BEZIER), x2 = x + w, y2 = y + h;
    return [nb(x + r) + ' ' + nb(y) + ' m', nb(x2 - r) + ' ' + nb(y) + ' l',
      nb(x2 - k) + ' ' + nb(y) + ' ' + nb(x2) + ' ' + nb(y + k) + ' ' + nb(x2) + ' ' + nb(y + r) + ' c',
      nb(x2) + ' ' + nb(y2 - r) + ' l',
      nb(x2) + ' ' + nb(y2 - k) + ' ' + nb(x2 - k) + ' ' + nb(y2) + ' ' + nb(x2 - r) + ' ' + nb(y2) + ' c',
      nb(x + r) + ' ' + nb(y2) + ' l',
      nb(x + k) + ' ' + nb(y2) + ' ' + nb(x) + ' ' + nb(y2 - k) + ' ' + nb(x) + ' ' + nb(y2 - r) + ' c',
      nb(x) + ' ' + nb(y + r) + ' l',
      nb(x) + ' ' + nb(y + k) + ' ' + nb(x + k) + ' ' + nb(y) + ' ' + nb(x + r) + ' ' + nb(y) + ' c', 'h'].join('\n');
  }
  function cheminCercle(cx, cy, r) {
    var k = r * K_BEZIER;
    return [nb(cx + r) + ' ' + nb(cy) + ' m',
      nb(cx + r) + ' ' + nb(cy + k) + ' ' + nb(cx + k) + ' ' + nb(cy + r) + ' ' + nb(cx) + ' ' + nb(cy + r) + ' c',
      nb(cx - k) + ' ' + nb(cy + r) + ' ' + nb(cx - r) + ' ' + nb(cy + k) + ' ' + nb(cx - r) + ' ' + nb(cy) + ' c',
      nb(cx - r) + ' ' + nb(cy - k) + ' ' + nb(cx - k) + ' ' + nb(cy - r) + ' ' + nb(cx) + ' ' + nb(cy - r) + ' c',
      nb(cx + k) + ' ' + nb(cy - r) + ' ' + nb(cx + r) + ' ' + nb(cy - k) + ' ' + nb(cx + r) + ' ' + nb(cy) + ' c', 'h'].join('\n');
  }

  /** Attribut `d` (M L H V Z absolus) -> opérateurs PDF. Toute autre commande lève une Error. */
  function cheminPath(d) {
    var re = /([A-Za-z])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g, jetons = [], m, ops = [];
    while ((m = re.exec(d))) jetons.push(m[1] !== undefined ? m[1] : parseFloat(m[2]));
    var i = 0, cmd = null, x = 0, y = 0, debut = null;
    function lire() {
      if (typeof jetons[i] !== 'number') throw new Error('Chemin SVG mal formé : ' + d);
      return jetons[i++];
    }
    while (i < jetons.length) {
      if (typeof jetons[i] === 'string') {
        cmd = jetons[i++];
        if ('MLHVZ'.indexOf(cmd) < 0) throw new Error('Commande de chemin SVG non prise en charge : ' + cmd);
        if (cmd === 'Z') { ops.push('h'); if (debut) { x = debut.x; y = debut.y; } continue; }
      } else if (cmd === 'M') cmd = 'L'; // paires suivantes d'un M = tracés de lignes
      else if (cmd === null || cmd === 'Z') throw new Error('Chemin SVG mal formé : ' + d);
      if (cmd === 'M' || cmd === 'L') {
        x = lire(); y = lire();
        ops.push(nb(x) + ' ' + nb(y) + (cmd === 'M' ? ' m' : ' l'));
        if (cmd === 'M') debut = { x: x, y: y };
      } else if (cmd === 'H') { x = lire(); ops.push(nb(x) + ' ' + nb(y) + ' l'); }
      else if (cmd === 'V') { y = lire(); ops.push(nb(x) + ' ' + nb(y) + ' l'); }
    }
    return ops.join('\n');
  }

  /** Transformation SVG (translate / scale en suite) -> matrices `cm`. */
  function matricesTransform(t) {
    var res = '', re = /(translate|scale)\(([^)]*)\)/g, m, reste = t;
    while ((m = re.exec(t))) {
      var v = m[2].trim().split(/[\s,]+/).map(parseFloat);
      if (v.some(function (n) { return !isFinite(n); })) throw new Error('Transformation SVG invalide : ' + t);
      if (m[1] === 'translate') res += '1 0 0 1 ' + nb(v[0]) + ' ' + nb(v[1] === undefined ? 0 : v[1]) + ' cm\n';
      else res += nb(v[0]) + ' 0 0 ' + nb(v[1] === undefined ? v[0] : v[1]) + ' 0 0 cm\n';
      reste = reste.replace(m[0], '');
    }
    if (reste.trim() !== '') throw new Error('Transformation SVG non prise en charge : ' + t);
    return res;
  }

  /**
   * Convertit un SVG en mm (width / height / viewBox 0 0 L H) en flux de contenu PDF.
   * Renvoie { largeur, hauteur, flux } ; le flux travaille en mm, origine en haut à gauche.
   * Éléments pris en charge : svg, g (transform translate / scale, clip-path), clipPath (un rect),
   * rect (rx), circle, line, path (M L H V Z), text (Helvetica, gras). Tout autre élément lève une Error.
   */
  function svgVersFlux(svg) {
    var re = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[^>]*?)?)(\/?)>|([^<]+)/g, m;
    var flux = [], pile = [], clips = {}, courantClip = null, texte = null, dims = null;
    while ((m = re.exec(svg))) {
      if (m[5] !== undefined) { // texte entre balises
        if (texte) texte.contenu += m[5];
        continue;
      }
      var fermante = m[1] === '/', nom = m[2], a = fermante ? {} : lireAttributs(m[3]), autoFermante = m[4] === '/';
      if (fermante) {
        var ouvert = pile.pop();
        if (!ouvert || ouvert.nom !== nom) throw new Error('SVG mal formé : balise </' + nom + '> inattendue.');
        if (nom === 'g') flux.push('Q');
        else if (nom === 'clipPath') courantClip = null;
        else if (nom === 'text') { flux.push(ecrireTexte(texte)); texte = null; }
        continue;
      }
      switch (nom) {
        case 'svg': {
          var vb = String(a.viewBox || '').split(/\s+/).map(parseFloat);
          if (vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0) throw new Error('viewBox SVG attendu : 0 0 largeur hauteur.');
          if (a.width !== vb[2] + 'mm' || a.height !== vb[3] + 'mm') throw new Error('width / height SVG doivent être en mm et égaux au viewBox.');
          dims = { largeur: vb[2], hauteur: vb[3] };
          break;
        }
        case 'g': {
          var s = 'q\n' + (a.transform ? matricesTransform(a.transform) : '');
          if (a['clip-path']) {
            var cm = /^url\(#([^)]+)\)$/.exec(a['clip-path']);
            if (!cm) throw new Error('clip-path non pris en charge : ' + a['clip-path']);
            // Le clipPath est déclaré à l'intérieur du <g> : on le résout à sa fermeture, d'où le marqueur.
            s += '%%CLIP:' + cm[1] + '%%\n';
          }
          flux.push(s.replace(/\n$/, ''));
          break;
        }
        case 'clipPath': courantClip = a.id; break;
        case 'rect': {
          if (courantClip !== null) {
            clips[courantClip] = cheminRectangle(num(a, 'x', 0), num(a, 'y', 0), num(a, 'width', 0), num(a, 'height', 0), 0) + ' W n';
          } else {
            var r = reglages(a);
            flux.push('q ' + r.texte + '\n' + cheminRectangle(num(a, 'x', 0), num(a, 'y', 0), num(a, 'width', 0), num(a, 'height', 0), num(a, 'rx', 0)) + '\n' + r.op + ' Q');
          }
          break;
        }
        case 'circle': {
          var rc = reglages(a);
          flux.push('q ' + rc.texte + '\n' + cheminCercle(num(a, 'cx', 0), num(a, 'cy', 0), num(a, 'r', 0)) + '\n' + rc.op + ' Q');
          break;
        }
        case 'line': {
          var rl = reglages(Object.assign({ fill: 'none' }, a));
          flux.push('q ' + rl.texte + '\n' + nb(num(a, 'x1', 0)) + ' ' + nb(num(a, 'y1', 0)) + ' m ' + nb(num(a, 'x2', 0)) + ' ' + nb(num(a, 'y2', 0)) + ' l S Q');
          break;
        }
        case 'path': {
          var rp = reglages(a);
          flux.push('q ' + rp.texte + '\n' + cheminPath(a.d || '') + '\n' + rp.op + ' Q');
          break;
        }
        case 'text':
          texte = { a: a, contenu: '' };
          break;
        default:
          throw new Error('Élément SVG non pris en charge : <' + nom + '>');
      }
      if (autoFermante) {
        if (nom === 'g') flux.push('Q');
        if (nom === 'text') { flux.push(ecrireTexte(texte)); texte = null; }
        if (nom === 'clipPath') courantClip = null;
      } else pile.push({ nom: nom });
    }
    if (pile.length) throw new Error('SVG mal formé : balise <' + pile[pile.length - 1].nom + '> non fermée.');
    if (!dims) throw new Error('SVG sans balise <svg>.');
    // Résolution des marqueurs de découpe (le clipPath suit l'ouverture du <g> dans le flux).
    var brut = flux.join('\n').replace(/%%CLIP:([^%]+)%%/g, function (_, id) {
      if (!clips[id]) throw new Error('clipPath introuvable : ' + id);
      return clips[id];
    });
    return { largeur: dims.largeur, hauteur: dims.hauteur, flux: brut };
  }

  /** Opérateurs PDF d'un texte SVG (police Helvetica ou Helvetica-Bold, ancrage start / middle / end). */
  function ecrireTexte(t) {
    var a = t.a, contenu = desechapper(t.contenu), taille = num(a, 'font-size', 16);
    var x = num(a, 'x', 0), y = num(a, 'y', 0), w = largeurTexte(contenu, taille);
    if (a['text-anchor'] === 'middle') x -= w / 2; else if (a['text-anchor'] === 'end') x -= w;
    var couleur = couleurPdf(a.fill);
    return 'q BT ' + (couleur || '0 0 0') + ' rg /' + (a['font-weight'] === 'bold' ? 'F2' : 'F1') + ' ' + nb(taille) + ' Tf 1 0 0 -1 ' +
      nb(x) + ' ' + nb(y) + ' Tm ' + chainePdf(contenu) + ' Tj ET Q';
  }

  /** Coordonnée PDF (pt, deux décimales) d'une dimension en mm. */
  function enPoints(mm) { return (Math.round(mm * PT * 100) / 100).toFixed(2); }

  /**
   * PDF 1.4 vectoriel, une page par planche, échelle exacte (1 mm = 72 / 25,4 pt).
   * `planches` : tableau d'éléments { svg } (ou chaînes SVG) ; un élément issu de calepiner() (sans svg)
   * est converti avec `doc` (second paramètre). Renvoie un Uint8Array.
   */
  function pdfDepuisPlanches(planches, doc) {
    if (!tab(planches).length) throw new Error('Aucune planche à exporter.');
    var pages = planches.map(function (p) {
      var svg = typeof p === 'string' ? p : p.svg || (doc && p.tuiles ? svgPlanche(doc, p) : null);
      if (!svg) throw new Error('Planche sans SVG : passez le document en second paramètre.');
      return svgVersFlux(svg);
    });
    var sortie = '%PDF-1.4\n%âãÏÓ\n', decalages = [];
    var nbObjets = 4 + 2 * pages.length;
    function objet(num, corps) {
      decalages[num] = sortie.length;
      sortie += num + ' 0 obj\n' + corps + '\nendobj\n';
    }
    var kids = pages.map(function (_, i) { return (5 + 2 * i) + ' 0 R'; }).join(' ');
    objet(1, '<< /Type /Catalog /Pages 2 0 R >>');
    objet(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + pages.length + ' >>');
    objet(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    objet(4, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    pages.forEach(function (p, i) {
      var w = enPoints(p.largeur), h = enPoints(p.hauteur);
      var contenu = 'q\n' + (PT).toFixed(7) + ' 0 0 -' + (PT).toFixed(7) + ' 0 ' + h + ' cm\n' + p.flux + '\nQ\n';
      objet(5 + 2 * i, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + w + ' ' + h + '] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ' + (6 + 2 * i) + ' 0 R >>');
      objet(6 + 2 * i, '<< /Length ' + contenu.length + ' >>\nstream\n' + contenu + 'endstream');
    });
    var debutXref = sortie.length;
    sortie += 'xref\n0 ' + (nbObjets + 1) + '\n0000000000 65535 f \n';
    for (var k = 1; k <= nbObjets; k++) sortie += ('0000000000' + decalages[k]).slice(-10) + ' 00000 n \n';
    sortie += 'trailer\n<< /Size ' + (nbObjets + 1) + ' /Root 1 0 R >>\nstartxref\n' + debutXref + '\n%%EOF\n';
    var octets = new Uint8Array(sortie.length);
    for (var j = 0; j < sortie.length; j++) {
      var c = sortie.charCodeAt(j);
      if (c > 255) throw new Error('Caractère non codable dans le PDF.');
      octets[j] = c;
    }
    return octets;
  }

  /* ------------------------------------------------------------------ */
  /* PNG : chunk pHYs                                                    */
  /* ------------------------------------------------------------------ */

  var TABLE_CRC = null;
  function crc32(octets, debut, fin) {
    if (!TABLE_CRC) {
      TABLE_CRC = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        TABLE_CRC[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = debut; i < fin; i++) crc = TABLE_CRC[(crc ^ octets[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  /**
   * Ajoute (ou remplace) le chunk pHYs d'un PNG : `pixelsParMetre` dans les deux directions
   * (11811 = 300 dpi). Le chunk est placé juste après IHDR. Lève une Error si ce n'est pas un PNG.
   */
  function ajouterPhys(png, pixelsParMetre) {
    var sig = [137, 80, 78, 71, 13, 10, 26, 10];
    if (png.length < 33 || sig.some(function (v, i) { return png[i] !== v; })) throw new Error('Ce fichier n\'est pas un PNG.');
    var ppm = pixelsParMetre || PX_PAR_METRE;
    // Chunks existants, sans l'éventuel pHYs d'origine.
    var morceaux = [], pos = 8;
    while (pos + 12 <= png.length) {
      var longueur = ((png[pos] << 24) | (png[pos + 1] << 16) | (png[pos + 2] << 8) | png[pos + 3]) >>> 0;
      var type = String.fromCharCode(png[pos + 4], png[pos + 5], png[pos + 6], png[pos + 7]);
      var fin = pos + 12 + longueur;
      if (fin > png.length) throw new Error('PNG tronqué.');
      if (type !== 'pHYs') morceaux.push({ type: type, donnees: png.subarray(pos, fin) });
      pos = fin;
    }
    var phys = new Uint8Array(21);
    var v = new DataView(phys.buffer);
    v.setUint32(0, 9);
    phys.set([0x70, 0x48, 0x59, 0x73], 4); // "pHYs"
    v.setUint32(8, ppm); v.setUint32(12, ppm); phys[16] = 1; // unité : mètre
    v.setUint32(17, crc32(phys, 4, 17));
    var total = 8 + phys.length;
    morceaux.forEach(function (c) { total += c.donnees.length; });
    var res = new Uint8Array(total), o = 0;
    res.set(sig, 0); o = 8;
    morceaux.forEach(function (c, i) {
      res.set(c.donnees, o); o += c.donnees.length;
      if (i === 0) { res.set(phys, o); o += phys.length; } // juste après IHDR
    });
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Sorties : ce qu'on exporte                                          */
  /* ------------------------------------------------------------------ */

  /**
   * Construit les feuilles demandées.
   * choix : { tuiles = true, portee = 'stock'|'posees', format = 'A3'|'A4', jetons = false, apercu = false }.
   * Renvoie { feuilles: [{ nom, type, largeur, hauteur, svg }], exclus, nbTuiles }.
   */
  function preparerSorties(doc, choix) {
    var c = choix || {}, feuilles = [], exclus = [], nbTuiles = 0;
    if (c.tuiles !== false) {
      var options = { format: c.format || 'A3', portee: c.portee || 'stock' };
      exclus = listeTuiles(doc, options).exclus;
      calepiner(doc, options).forEach(function (p) {
        nbTuiles += p.tuiles.length;
        feuilles.push({ nom: p.nom, type: 'tuiles', largeur: p.largeur, hauteur: p.hauteur, svg: svgPlanche(doc, p), planche: p });
      });
    }
    if (c.jetons) feuilles.push({ nom: 'plateau-jetons-A4', type: 'jetons', largeur: FORMATS.A4.largeur, hauteur: FORMATS.A4.hauteur, svg: svgJetons() });
    if (c.apercu) feuilles.push({ nom: 'plateau-apercu-A3', type: 'apercu', largeur: FORMATS.A3.largeur, hauteur: FORMATS.A3.hauteur, svg: svgApercuPlateau(doc) });
    return { feuilles: feuilles, exclus: exclus, nbTuiles: nbTuiles };
  }

  /* ------------------------------------------------------------------ */
  /* Navigateur : PNG, téléchargement, boîte de dialogue                 */
  /* ------------------------------------------------------------------ */

  /** Rastérise un SVG en PNG 300 dpi (taille exacte en pixels, fond blanc, pHYs). Renvoie une Promise<Blob>. */
  function rasteriser(feuille) {
    return new Promise(function (resolve, reject) {
      var dims = pngDims(feuille);
      var url = URL.createObjectURL(new Blob([feuille.svg], { type: 'image/svg+xml' }));
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          canvas.width = dims.largeurPx; canvas.height = dims.hauteurPx;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height); // le SVG est tracé directement à la taille cible
          URL.revokeObjectURL(url);
          canvas.toBlob(function (blob) {
            if (!blob) { reject(new Error('Le navigateur n\'a pas pu produire le PNG (image trop grande ?).')); return; }
            blob.arrayBuffer().then(function (buf) {
              resolve(new Blob([ajouterPhys(new Uint8Array(buf), PX_PAR_METRE)], { type: 'image/png' }));
            }, reject);
          }, 'image/png');
        } catch (e) { URL.revokeObjectURL(url); reject(e); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Le navigateur n\'a pas pu lire le SVG.')); };
      img.src = url;
    });
  }

  /** Télécharge un Blob sous le nom donné. */
  function telecharger(blob, nom) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = nom; a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }

  /** Nom du fichier PDF commun à plusieurs feuilles. */
  function nomPdfCommun(feuilles) {
    if (feuilles.length === 1) return feuilles[0].nom;
    if (feuilles.every(function (f) { return f.type === 'tuiles'; })) return 'plateau-tuiles-' + feuilles[0].planche.format;
    return 'plateau-impression';
  }

  /** Produit les fichiers { nom, blob } pour un format de fichier ('pdf' | 'svg' | 'png'). Promise. */
  function produireFichiers(feuilles, format, unParFeuille) {
    if (format === 'pdf') {
      if (!unParFeuille) {
        return Promise.resolve([{ nom: nomPdfCommun(feuilles) + '.pdf', blob: new Blob([pdfDepuisPlanches(feuilles)], { type: 'application/pdf' }) }]);
      }
      return Promise.resolve(feuilles.map(function (f) {
        return { nom: f.nom + '.pdf', blob: new Blob([pdfDepuisPlanches([f])], { type: 'application/pdf' }) };
      }));
    }
    if (format === 'svg') {
      return Promise.resolve(feuilles.map(function (f) { return { nom: f.nom + '.svg', blob: new Blob([f.svg], { type: 'image/svg+xml' }) }; }));
    }
    var fichiers = [];
    return feuilles.reduce(function (suite, f) {
      return suite.then(function () { return rasteriser(f); }).then(function (blob) { fichiers.push({ nom: f.nom + '.png', blob: blob }); });
    }, Promise.resolve()).then(function () { return fichiers; });
  }

  var compteurDialogue = 0;

  /** Ouvre la boîte « Exporter pour impression » (PM.dialogue). `etat` fournit doc() et signaler(). */
  function ouvrir(etat) {
    var racine = PM.dialogue.ouvrir('Exporter pour impression');
    var numero = ++compteurDialogue, urlApercu = null;
    var choix = { tuiles: true, portee: 'stock', format: 'A3', jetons: false, apercu: false, fichier: 'pdf', unParFeuille: false };

    function el(nom, classe, texte) {
      var e = document.createElement(nom);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    }
    function groupe(legende) {
      var f = el('fieldset', 'pm-export-groupe');
      f.appendChild(el('legend', '', legende));
      racine.appendChild(f);
      return f;
    }
    function ligne(parent, type, nom, valeur, libelle, coche) {
      var l = el('label', 'pm-export-option'), i = el('input');
      i.type = type; if (nom) i.name = 'pm-export-' + numero + '-' + nom; i.value = valeur; i.checked = !!coche;
      l.appendChild(i); l.appendChild(el('span', '', libelle)); parent.appendChild(l);
      return i;
    }

    // Le conteneur de PM.dialogue est partagé : on ne le modifie pas, on y place notre propre boîte.
    var boite = el('div', 'pm-export');
    racine.appendChild(boite);
    var formulaire = el('div', 'pm-export-formulaire'), colonneApercu = el('div', 'pm-export-colonne-apercu');
    boite.appendChild(formulaire);
    boite.appendChild(colonneApercu);
    var vraiRacine = racine;
    racine = formulaire; // les groupes sont créés dans la colonne du formulaire

    var gContenu = groupe('Contenu');
    var iTuiles = ligne(gContenu, 'checkbox', 'tuiles', 'tuiles', 'Planches de tuiles', true);
    var gPortee = el('div', 'pm-export-sousgroupe');
    var iStock = ligne(gPortee, 'radio', 'portee', 'stock', 'Toutes les tuiles du stock (selon leurs exemplaires)', true);
    var iPosees = ligne(gPortee, 'radio', 'portee', 'posees', 'Seulement les tuiles posées sur le plateau', false);
    gContenu.appendChild(gPortee);
    var iJetons = ligne(gContenu, 'checkbox', 'jetons', 'jetons', 'Planche des jetons (A4 : 7 villes, 2 carrefours)', false);
    var iApercu = ligne(gContenu, 'checkbox', 'apercu', 'apercu', 'Aperçu du plateau assemblé (A3, non imprimable)', false);

    var gFormat = groupe('Format de feuille pour les tuiles');
    var iA3 = ligne(gFormat, 'radio', 'format', 'A3', 'A3 portrait : 6 tuiles par planche', true);
    var iA4 = ligne(gFormat, 'radio', 'format', 'A4', 'A4 portrait : 2 tuiles par planche (imprimante de bureau)', false);

    var gFichier = groupe('Fichier');
    var iPdf = ligne(gFichier, 'radio', 'fichier', 'pdf', 'PDF vectoriel (échelle exacte)', true);
    var iSvg = ligne(gFichier, 'radio', 'fichier', 'svg', 'SVG (un fichier par planche)', false);
    var iPng = ligne(gFichier, 'radio', 'fichier', 'png', 'PNG 300 dpi (un fichier par planche)', false);
    var iSepare = ligne(gFichier, 'checkbox', 'separe', 'separe', 'PDF : un fichier par planche au lieu d\'un seul', false);

    var avertissement = el('p', 'pm-export-avertissement'); avertissement.setAttribute('role', 'status');
    var resume = el('p', 'pm-export-resume'); resume.setAttribute('role', 'status');
    racine = vraiRacine;
    formulaire.appendChild(avertissement);
    formulaire.appendChild(resume);
    var bouton = el('button', 'pm-export-telecharger', 'Télécharger'); bouton.type = 'button';
    formulaire.appendChild(bouton);
    var etatFichier = el('p', 'pm-export-resume'); etatFichier.setAttribute('role', 'status');
    formulaire.appendChild(etatFichier);

    var titreApercu = el('p', 'pm-export-titre-apercu', 'Aperçu de la première planche');
    var cadre = el('div', 'pm-export-cadre'), image = el('img', 'pm-export-apercu');
    image.alt = 'Aperçu de la première planche exportée';
    cadre.appendChild(image);
    colonneApercu.appendChild(titreApercu); colonneApercu.appendChild(cadre);

    var sortie = null;

    function relire() {
      choix.tuiles = iTuiles.checked; choix.portee = iPosees.checked ? 'posees' : 'stock';
      choix.format = iA4.checked ? 'A4' : 'A3'; choix.jetons = iJetons.checked; choix.apercu = iApercu.checked;
      choix.fichier = iSvg.checked ? 'svg' : iPng.checked ? 'png' : 'pdf'; choix.unParFeuille = iSepare.checked;
      iStock.disabled = iPosees.disabled = iA3.disabled = iA4.disabled = !choix.tuiles;
      iSepare.disabled = choix.fichier !== 'pdf';
    }

    function mettreAJour() {
      relire();
      etatFichier.textContent = '';
      try { sortie = preparerSorties(etat.doc(), choix); } catch (e) { sortie = null; avertissement.textContent = e.message; }
      if (!sortie) { bouton.disabled = true; return; }
      var noms = sortie.exclus.map(function (x) { return x.nom; });
      avertissement.textContent = noms.length
        ? 'Attention : ' + noms.length + ' modèle(s) incomplet(s) exclu(s) de l\'export : ' + noms.join(', ') + '.'
        : '';
      var n = sortie.feuilles.length;
      resume.textContent = n
        ? n + ' feuille(s) : ' + sortie.nbTuiles + ' tuile(s)' + (choix.jetons ? ', jetons' : '') + (choix.apercu ? ', aperçu' : '') + '.'
        : 'Rien à exporter : cochez un contenu' + (choix.tuiles ? ' ou posez des tuiles' : '') + '.';
      bouton.disabled = n === 0;
      if (urlApercu) { URL.revokeObjectURL(urlApercu); urlApercu = null; }
      if (n) {
        urlApercu = URL.createObjectURL(new Blob([sortie.feuilles[0].svg], { type: 'image/svg+xml' }));
        image.src = urlApercu; image.hidden = false;
      } else { image.removeAttribute('src'); image.hidden = true; }
    }

    [iTuiles, iStock, iPosees, iJetons, iApercu, iA3, iA4, iPdf, iSvg, iPng, iSepare].forEach(function (i) {
      i.addEventListener('change', mettreAJour);
    });

    bouton.addEventListener('click', function () {
      if (!sortie || !sortie.feuilles.length) return;
      bouton.disabled = true;
      etatFichier.textContent = 'Préparation…';
      produireFichiers(sortie.feuilles, choix.fichier, choix.unParFeuille).then(function (fichiers) {
        fichiers.forEach(function (f, k) { setTimeout(function () { telecharger(f.blob, f.nom); }, k * 300); });
        var msg = fichiers.length + ' fichier(s) téléchargé(s) : ' + fichiers.map(function (f) { return f.nom; }).join(', ') + '.';
        etatFichier.textContent = msg;
        if (etat.signaler) etat.signaler(msg, 'info');
        bouton.disabled = false;
      }, function (e) {
        etatFichier.textContent = 'Échec de l\'export : ' + e.message;
        if (etat.signaler) etat.signaler('Échec de l\'export : ' + e.message, 'erreur');
        bouton.disabled = false;
      });
    });

    mettreAJour();
    iTuiles.focus();
  }

  PM.exportation = {
    FORMATS: FORMATS,
    FOND_PERDU: FOND_PERDU,
    COTE_PLANCHE: COTE_PLANCHE,
    GOUTTIERE: GOUTTIERE,
    PAS: PAS,
    MARGE_MIN: MARGE_MIN,
    MARGE_IMPRIMABLE: MARGE_IMPRIMABLE,
    listeTuiles: listeTuiles,
    margesFormat: margesFormat,
    calepiner: calepiner,
    calculerReperes: calculerReperes,
    boiteTexte: boiteTexte,
    boiteBarre: boiteBarre,
    largeurTexte: largeurTexte,
    pngDims: pngDims,
    svgPlanche: svgPlanche,
    svgJetons: svgJetons,
    planchesJetons: planchesJetons,
    svgApercuPlateau: svgApercuPlateau,
    svgVersFlux: svgVersFlux,
    pdfDepuisPlanches: pdfDepuisPlanches,
    crc32: crc32,
    ajouterPhys: ajouterPhys,
    preparerSorties: preparerSorties,
    rasteriser: rasteriser,
    telecharger: telecharger,
    produireFichiers: produireFichiers,
    ouvrir: ouvrir
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.exportation;
})();
