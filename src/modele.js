/*
 * modele.js : modèles de tuile, chemins et plateau, validation (règles de la version 2).
 * Aucun accès au DOM. Toutes les fonctions de modification du document sont
 * pures : elles renvoient un nouveau document sans altérer l'entrée.
 *
 * Règles v2 (docs/18-decisions-v2.md, docs/20-avis-geometrie-v2.md D1 à D3 et arbitrages) :
 *  - grille toujours pleine, format du document dans `doc.grille` ('4x4' | '5x5', absent = '4x4') ;
 *  - un modèle déclare un gabarit (centrale | bord | coin), jamais bloquant ;
 *  - seules les règles physiques bloquent un modèle ; R1 à R4 et les règles de place sont des alertes ;
 *  - pose : chaque modèle se pose autant de fois qu'on veut (les exemplaires ne servent qu'à l'impression et au
 *    générateur), mais le rôle est respecté (coin dans un coin, bord sur le pourtour, centrale au centre) ;
 *    rotation libre, rotation suggérée pour un bord ou un coin sur le pourtour ;
 *  - jetons : villes seulement ('capture') ; une jonction sans ville est une case chemin (voir graphe.js).
 *
 * Passages sans case (docs/18 fin, docs/39) : tableaux facultatifs `pivots` [{id, x, y}] et `passages` [{id, a, b, courbe?}]
 * (extrémités case, raccord ou pivot) ; absents = vides, les anciens modèles sont inchangés. Leurs raccords entrent dans le masque.
 *
 * Un modèle ne stocke PAS de masque : les masques `raccords` (12 bits) et
 * `portsCoin` (4 bits) sont calculés à partir des chemins (masquesDuModele).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.geometrie && typeof require === 'function') require('./geometrie.js'); // chargement sous Node

(function () {
  'use strict';

  var G = PM.geometrie;
  var EPS = 1e-9;

  var GABARITS = Object.keys(G.GABARITS);         // ['centrale', 'bord', 'coin']
  var LIBELLE_GABARIT = { centrale: 'une centrale', bord: 'un bord', coin: 'un coin' };
  var TYPES_CASE = ['deplacement', 'apparition'];
  var TYPES_JETON = ['capture'];
  var VERSION_DOCUMENT = 2;

  /* ------------------------------------------------------------------ */
  /* Outils                                                              */
  /* ------------------------------------------------------------------ */

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function tab(x) { return Array.isArray(x) ? x : []; }
  function estEntier(n) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n; }
  function estNombre(n) { return typeof n === 'number' && isFinite(n); }
  function estObjet(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  /** Identifiant valide : chaîne non vide. */
  function estId(x) { return typeof x === 'string' && x.length > 0; }
  /** Dictionnaire sans prototype (les ids « constructor », « __proto__ »... restent des clés ordinaires). */
  function dict() { return Object.create(null); }
  /** Gabarit connu, ou null (une valeur héritée d'Object.prototype n'est pas un gabarit). */
  function gabaritConnu(g) { return GABARITS.indexOf(g) >= 0 ? g : null; }

  /**
   * Format de grille (objet de PM.geometrie.format) à partir d'un objet format, d'un identifiant
   * ('4x4' | '5x5') ou de rien (format 4×4 par défaut).
   */
  function resoudreFormat(f) {
    if (f && typeof f === 'object') return f;
    return G.format(f === undefined || f === null ? G.FORMAT_DEFAUT : f);
  }
  /** Format du document : champ `grille`, absent = '4x4'. Lève une Error si le format est inconnu. */
  function formatDuDocument(doc) { return G.format((doc && doc.grille) || G.FORMAT_DEFAUT); }

  function nomCote(c) { return ['nord', 'est', 'sud', 'ouest'][c]; }
  function nomCoin(k) { return ['NO', 'NE', 'SE', 'SO'][k]; }

  function typeExtremite(e) {
    if (!estObjet(e)) return null;
    if (e['case'] !== undefined) return 'case';
    if (e.raccord !== undefined) return 'raccord';
    if (e.coin !== undefined) return 'coin';
    return null;
  }

  function raccordValide(r) {
    return estObjet(r) && estEntier(r.cote) && r.cote >= 0 && r.cote <= 3 && estEntier(r.pos) && r.pos >= 0 && r.pos <= 2;
  }

  function extremiteValide(e) {
    var t = typeExtremite(e);
    if (t === 'case') return estId(e['case']);
    if (t === 'raccord') return raccordValide(e.raccord);
    if (t === 'coin') return estEntier(e.coin) && e.coin >= 0 && e.coin <= 3;
    return false;
  }

  /** Clé texte d'une extrémité (pour détecter boucles et doublons). */
  function cleExtremite(e) {
    var t = typeExtremite(e);
    if (t === 'case') return 'case:' + e['case'];
    if (t === 'raccord') return 'raccord:' + e.raccord.cote + ':' + e.raccord.pos;
    return 'coin:' + e.coin;
  }

  /**
   * Itérateur sur les extrémités bien formées de tous les chemins :
   * fn(extremite, type, chemin). Les extrémités mal formées sont ignorées
   * (la validation les signale).
   */
  function pourChaqueExtremite(modele, fn) {
    tab(modele && modele.chemins).forEach(function (ch) {
      if (!estObjet(ch)) return;
      ['a', 'b'].forEach(function (s) {
        if (extremiteValide(ch[s])) fn(ch[s], typeExtremite(ch[s]), ch);
      });
    });
  }

  /** Chemins bien formés reliant une case à un coin ou à un raccord : [{caseId, autre, type, chemin}]. */
  function sortiesDesCases(modele) {
    var res = [];
    tab(modele && modele.chemins).forEach(function (ch) {
      if (!estObjet(ch) || !extremiteValide(ch.a) || !extremiteValide(ch.b)) return;
      var ta = typeExtremite(ch.a), tb = typeExtremite(ch.b);
      if (ta === 'case' && tb !== 'case') res.push({ caseId: ch.a['case'], autre: ch.b, type: tb, chemin: ch });
      else if (tb === 'case' && ta !== 'case') res.push({ caseId: ch.b['case'], autre: ch.a, type: ta, chemin: ch });
    });
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Passages sans case (docs/18 fin, docs/39) : fonctions à part, les    */
  /* fonctions des chemins ci-dessus ne les voient pas.                   */
  /* ------------------------------------------------------------------ */

  /** Extrémité de passage bien formée (case, raccord, pivot ou coin : le coin est reconnu pour être refusé par la validation). */
  function extremitePassageValide(e) {
    var t = G.typeExtremitePassage(e);
    if (t === 'case') return estId(e['case']);
    if (t === 'pivot') return estId(e.pivot);
    if (t === 'raccord') return raccordValide(e.raccord);
    if (t === 'coin') return estEntier(e.coin) && e.coin >= 0 && e.coin <= 3;
    return false;
  }

  /** Passages dont les deux extrémités sont bien formées. */
  function passagesBienFormes(modele) {
    return tab(modele && modele.passages).filter(function (p) { return estObjet(p) && extremitePassageValide(p.a) && extremitePassageValide(p.b); });
  }

  /** Itérateur sur les extrémités des passages bien formés : fn(extremite, type, passage). */
  function pourChaqueExtremitePassage(modele, fn) {
    passagesBienFormes(modele).forEach(function (p) {
      [p.a, p.b].forEach(function (e) { fn(e, G.typeExtremitePassage(e), p); });
    });
  }

  /**
   * Réseaux de passages, construits comme relierPassages de graphe.js : seuls les pivots et les raccords sont fusionnés,
   * les cases sont seulement rattachées (une case à deux passages appartient à deux réseaux, comme dans le graphe où
   * elle ne rapproche pas ses deux voisins). Renvoie { reseaux: [{ cases: [id], pivots: [id], raccords: n, passages: [passage] }] }.
   * Pour case_isolee et reseau_sans_sortie, la fusion à travers les cases se fait en réunissant les cases de chaque réseau.
   */
  function reseauxDePassages(modele) {
    var parent = dict(), reseaux = [];
    function racine(x) {
      if (parent[x] === undefined) parent[x] = x;
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    }
    function cle(e) {
      var t = G.typeExtremitePassage(e);
      return t === 'pivot' ? 'pivot:' + e.pivot : t === 'raccord' ? 'raccord:' + e.raccord.cote + ':' + e.raccord.pos : null;
    }
    var passages = passagesBienFormes(modele).filter(function (p) { return G.typeExtremitePassage(p.a) !== 'coin' && G.typeExtremitePassage(p.b) !== 'coin'; });
    var cles = passages.map(function (p, i) {
      var ka = cle(p.a), kb = cle(p.b);
      if (ka && kb) parent[racine(ka)] = racine(kb);
      return ka || kb || 'seul:' + i; // case - case (refusé par ailleurs) : réseau à lui seul
    });
    var parRacine = dict();
    passages.forEach(function (p, i) {
      var r = racine(cles[i]);
      var reseau = parRacine[r];
      if (!reseau) { reseau = parRacine[r] = { cases: [], pivots: [], raccords: 0, passages: [] }; reseaux.push(reseau); }
      reseau.passages.push(p);
      [p.a, p.b].forEach(function (e) {
        var t = G.typeExtremitePassage(e);
        if (t === 'case' && reseau.cases.indexOf(e['case']) < 0) reseau.cases.push(e['case']);
        else if (t === 'pivot' && reseau.pivots.indexOf(e.pivot) < 0) reseau.pivots.push(e.pivot);
        else if (t === 'raccord') reseau.raccords++;
      });
    });
    return { reseaux: reseaux };
  }

  /** Masques calculés à partir des chemins et des passages : { raccords (12 bits), portsCoin (4 bits) }. */
  function masquesDuModele(modele) {
    var raccords = 0, portsCoin = 0;
    pourChaqueExtremite(modele, function (e, t) {
      if (t === 'raccord') raccords |= 1 << G.bitRaccord(e.raccord.cote, e.raccord.pos);
      else if (t === 'coin') portsCoin |= 1 << e.coin;
    });
    pourChaqueExtremitePassage(modele, function (e, t) {
      if (t === 'raccord') raccords |= 1 << G.bitRaccord(e.raccord.cote, e.raccord.pos);
    });
    return { raccords: raccords, portsCoin: portsCoin };
  }

  /* ------------------------------------------------------------------ */
  /* Géométrie plane (règles physiques des tracés)                       */
  /* ------------------------------------------------------------------ */

  function distancePointSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    var t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /**
   * Point commun de deux segments [a, b] et [c, d] (contact compris), ou null.
   * Segments colinéaires qui se recouvrent : milieu de la partie commune.
   */
  function intersectionSegments(a, b, c, d) {
    var r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
    var den = r.x * s.y - r.y * s.x, qp = { x: c.x - a.x, y: c.y - a.y };
    if (Math.abs(den) < EPS) {
      if (Math.abs(qp.x * r.y - qp.y * r.x) > EPS) return null; // parallèles distincts
      var l2 = r.x * r.x + r.y * r.y;
      if (l2 < EPS) return null;
      var t0 = (qp.x * r.x + qp.y * r.y) / l2, t1 = t0 + (s.x * r.x + s.y * r.y) / l2;
      var lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(1, Math.max(t0, t1));
      if (lo > hi + EPS) return null;
      var tm = (lo + hi) / 2;
      return { x: a.x + tm * r.x, y: a.y + tm * r.y };
    }
    var t = (qp.x * s.y - qp.y * s.x) / den, u = (qp.x * r.y - qp.y * r.x) / den;
    if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
    return { x: a.x + t * r.x, y: a.y + t * r.y };
  }

  /* ------------------------------------------------------------------ */
  /* Validation d'un modèle                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Entrée de validation : { code, message, ref }.
   * ref = { type: 'modele'|'case'|'chemin'|'coin'|'raccord', id, ... } désigne l'élément fautif
   * (pour le halo de l'interface). Le chevauchement et les réseaux ajoutent ids: [...].
   * Une règle marque une alerte par `alerte: true` (retiré du résultat de validerModele).
   */
  function err(code, message, ref) { return { code: code, message: message, ref: ref }; }
  function alerte(code, message, ref) { return { code: code, message: message, ref: ref, alerte: true }; }
  function refModele(m) { return { type: 'modele', id: m && m.id }; }
  function refCase(id) { return { type: 'case', id: id }; }
  function refChemin(ch) { return { type: 'chemin', id: ch && ch.id }; }
  function refCoin(k) { return { type: 'coin', id: k }; }
  function refRaccord(r, ch) { return { type: 'raccord', id: r.cote + ':' + r.pos, cote: r.cote, pos: r.pos, chemin: ch && ch.id }; }

  /** Phrase commune aux alertes R1 à R4 (arbitrage de l'orchestrateur, docs/20). */
  var RISQUE_ECART = 'cette tuile peut rapprocher deux villes à moins de 3 cases';

  /**
   * Règles de validation. Chaque règle reçoit le modèle et le format de grille, et renvoie un tableau
   * d'entrées (erreurs bloquantes, ou alertes marquées `alerte: true`). Pour ajouter une règle,
   * pousser une fonction dans PM.modele.regles.
   */
  var regles = [];

  // Identité, gabarit, grille, exemplaires, ids uniques et bien formés
  regles.push(function (m, F) {
    var e = [];
    if (!estId(m.id)) e.push(err('id_modele', 'Le modèle doit avoir un identifiant (texte non vide).', refModele(m)));
    if (m.nom !== undefined && typeof m.nom !== 'string') e.push(err('nom_invalide', 'Le nom du modèle doit être un texte.', refModele(m)));
    if (!gabaritConnu(m.gabarit)) {
      e.push(alerte('gabarit_inconnu', 'Gabarit non déclaré (centrale, bord ou coin) : pas de rotation suggérée ni de quart de case de jonction imprimé.', refModele(m)));
    }
    if (m.grille !== undefined && m.grille !== F.id) {
      e.push(err('grille_modele', 'Cette tuile est dessinée pour la grille ' + String(m.grille) + ' : elle ne va pas sur une grille ' + F.id + '.', refModele(m)));
    }
    if (!estEntier(m.exemplaires) || m.exemplaires < 0) {
      e.push(err('exemplaires_invalides', 'Le nombre d\'exemplaires doit être un entier positif ou nul.', refModele(m)));
    }
    var vus = dict();
    function verifier(el, type) {
      if (!estObjet(el)) return;
      var id = el.id;
      if (id === undefined || id === null || id === '') {
        e.push(err('id_manquant', 'Un élément n\'a pas d\'identifiant.', { type: type, id: undefined }));
      } else if (typeof id !== 'string') {
        e.push(err('id_invalide', 'L\'identifiant d\'un élément doit être un texte.', { type: type, id: id }));
      } else if (vus[id]) {
        e.push(err('id_double', 'Identifiant utilisé deux fois : ' + id + '.', { type: type, id: id }));
      } else {
        vus[id] = true;
      }
    }
    tab(m.cases).forEach(function (c) { verifier(c, 'case'); });
    tab(m.chemins).forEach(function (c) { verifier(c, 'chemin'); });
    tab(m.pivots).forEach(function (c) { verifier(c, 'pivot'); });
    tab(m.passages).forEach(function (c) { verifier(c, 'passage'); });
    return e;
  });

  // Type des cases ; cases d'apparition (alertes)
  regles.push(function (m) {
    var e = [], nbAppar = 0;
    tab(m.cases).forEach(function (c) {
      if (!estObjet(c)) return; // signalé par la règle de géométrie
      if (TYPES_CASE.indexOf(c.type) < 0) e.push(err('type_case', 'Type de case inconnu.', refCase(c.id)));
      else if (c.type === 'apparition') nbAppar++;
    });
    if (nbAppar > 1) {
      e.push(alerte('plusieurs_apparitions', 'Cette tuile a ' + nbAppar + ' cases d\'apparition : une seule est prévue par tuile.', refModele(m)));
    }
    if (nbAppar === 0 && (m.gabarit === 'bord' || m.gabarit === 'coin')) {
      e.push(alerte('sans_apparition', 'Une tuile de ' + (m.gabarit === 'bord' ? 'bord' : 'coin') + ' porte une case d\'apparition : il n\'y en a pas.', refModele(m)));
    }
    return e;
  });

  // Géométrie des cases : diamètre, marge de coupe, chevauchement, zones de coin
  regles.push(function (m, F) {
    var e = [], cases = [];
    tab(m.cases).forEach(function (c) {
      if (estObjet(c) && estNombre(c.x) && estNombre(c.y) && estNombre(c.diametre) && c.diametre > 0) cases.push(c);
      else e.push(err('case_invalide', 'Position ou diamètre de case invalide.', refCase(estObjet(c) ? c.id : undefined)));
    });
    var marge = F.MARGE_COUPE_CASE;
    cases.forEach(function (c) {
      var r = c.diametre / 2;
      if (c.diametre > F.DIAMETRE_CASE_MAX + EPS) {
        e.push(err('diametre', 'Case trop grande (' + F.DIAMETRE_CASE_MAX + ' mm au plus).', refCase(c.id)));
      }
      if (c.x - r < marge - EPS || c.y - r < marge - EPS ||
          c.x + r > F.COTE - marge + EPS || c.y + r > F.COTE - marge + EPS) {
        e.push(err('hors_tuile', 'Case trop près du bord de la tuile (' + marge + ' mm de marge).', refCase(c.id)));
      }
      for (var k = 0; k < 4; k++) {
        var p = F.pointCoin(k);
        if (Math.hypot(c.x - p.x, c.y - p.y) < F.RAYON_ZONE_COIN + r - EPS) {
          e.push(err('zone_coin', 'Case dans une zone de coin (réservée au jeton).', refCase(c.id)));
          break;
        }
      }
    });
    for (var i = 0; i < cases.length; i++) {
      for (var j = i + 1; j < cases.length; j++) {
        var d = Math.hypot(cases[i].x - cases[j].x, cases[i].y - cases[j].y);
        if (d < (cases[i].diametre + cases[j].diametre) / 2 - EPS) {
          e.push(err('chevauchement', 'Deux cases se chevauchent.',
            { type: 'case', id: cases[i].id, ids: [cases[i].id, cases[j].id] }));
        }
      }
    }
    return e;
  });

  // Chemins : extrémités, références, boucles, doublons, raccords et coins utilisés une fois
  regles.push(function (m) {
    var e = [], ids = dict(), vus = dict(), raccordsUtilises = dict(), parCoin = dict();
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id)) ids[c.id] = true; });
    tab(m.chemins).forEach(function (ch) {
      if (!estObjet(ch) || !extremiteValide(ch.a) || !extremiteValide(ch.b)) {
        e.push(err('chemin_invalide', 'Une extrémité de chemin est mal formée.', refChemin(estObjet(ch) ? ch : null)));
        return;
      }
      var ta = typeExtremite(ch.a), tb = typeExtremite(ch.b);
      [ch.a, ch.b].forEach(function (x) {
        if (typeExtremite(x) === 'case' && !ids[x['case']]) {
          e.push(err('case_inconnue', 'Un chemin vise une case qui n\'existe pas.', refChemin(ch)));
        }
      });
      var ka = cleExtremite(ch.a), kb = cleExtremite(ch.b);
      if (ka === kb) e.push(err('boucle', 'Un chemin ne peut pas relier un point à lui-même.', refChemin(ch)));
      var cle = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (vus[cle]) e.push(err('chemin_double', 'Deux chemins relient les mêmes points.', refChemin(ch)));
      vus[cle] = true;
      if (ta !== 'case' && tb !== 'case') {
        e.push(err('chemin_sans_case', 'Un chemin doit avoir au moins une extrémité sur une case.', refChemin(ch)));
      }
      [ch.a, ch.b].forEach(function (x) {
        var t = typeExtremite(x);
        if (t === 'raccord') {
          var k = cleExtremite(x);
          if (raccordsUtilises[k]) e.push(err('raccord_double', 'Un raccord est utilisé par deux chemins.', refRaccord(x.raccord, ch)));
          raccordsUtilises[k] = true;
        } else if (t === 'coin') {
          parCoin[x.coin] = (parCoin[x.coin] || 0) + 1;
        }
      });
    });
    Object.keys(parCoin).forEach(function (k) {
      if (parCoin[k] > 1) e.push(err('coin_double', 'Un coin ne peut recevoir qu\'un seul chemin (coin ' + nomCoin(+k) + ').', refCoin(+k)));
    });
    return e;
  });

  // Tracés (docs/20 D2) : chemin contre une case, chemins croisés, chemin dans une zone de coin, case isolée
  regles.push(function (m, F) {
    var e = [], demiLargeur = F.LARGEUR_CHEMIN / 2;
    var cases = tab(m.cases).filter(function (c) { return estObjet(c) && estId(c.id) && estNombre(c.x) && estNombre(c.y) && estNombre(c.diametre); });
    var traces = G.tracesModele(m, F);
    // Un segment passe à moins de r + L/2 d'une case qu'il ne relie pas
    traces.forEach(function (t) {
      cases.forEach(function (c) {
        if (t.cases.indexOf(c) >= 0) return;
        for (var s = 0; s + 1 < t.pts.length; s++) {
          if (distancePointSegment(c, t.pts[s], t.pts[s + 1]) < c.diametre / 2 + demiLargeur - EPS) {
            e.push(err('chemin_case', 'Ce chemin passe sur la case ' + c.id + ' qu\'il ne relie pas.', { type: 'chemin', id: t.id, ids: [c.id] }));
            return;
          }
        }
      });
    });
    // Deux chemins se croisent ou se touchent ailleurs que dans une case qu'ils partagent
    for (var a = 0; a < traces.length; a++) {
      for (var b = a + 1; b < traces.length; b++) {
        var ta = traces[a], tb = traces[b], communes = ta.cases.filter(function (c) { return tb.cases.indexOf(c) >= 0; });
        var croise = false;
        for (var i = 0; i + 1 < ta.pts.length && !croise; i++) {
          for (var j = 0; j + 1 < tb.pts.length && !croise; j++) {
            var p = intersectionSegments(ta.pts[i], ta.pts[i + 1], tb.pts[j], tb.pts[j + 1]);
            if (p && !communes.some(function (c) { return Math.hypot(p.x - c.x, p.y - c.y) <= c.diametre / 2 + EPS; })) croise = true;
          }
        }
        if (croise) e.push(err('chemins_croises', 'Deux chemins se croisent.', { type: 'chemin', id: ta.id, ids: [ta.id, tb.id] }));
      }
    }
    // Le trait d'un chemin entre dans une zone de coin (R + L/2), hors amorce du port de ce coin
    traces.forEach(function (t) {
      for (var k = 0; k < 4; k++) {
        var K = F.pointCoin(k);
        for (var s = 0; s + 1 < t.pts.length; s++) {
          if (t.type === 'port' && t.coin === k && s === 0) continue;
          if (distancePointSegment(K, t.pts[s], t.pts[s + 1]) < F.RAYON_ZONE_COIN + demiLargeur - EPS) {
            e.push(err('amorce_zone', 'Ce chemin entre dans la zone du coin ' + nomCoin(k) + ' (réservée au jeton et à la case de jonction).', refChemin(t)));
            return;
          }
        }
      }
    });
    // Case reliée à rien
    var touchees = dict();
    pourChaqueExtremite(m, function (x, t) { if (t === 'case') touchees[x['case']] = true; });
    pourChaqueExtremitePassage(m, function (x, t) { if (t === 'case') touchees[x['case']] = true; });
    cases.forEach(function (c) {
      if (!touchees[c.id]) e.push(err('case_isolee', 'La case ' + c.id + ' n\'est reliée à rien : ajoutez-lui un chemin.', refCase(c.id)));
    });
    return e;
  });

  // Ports et raccords : alertes R1 à R4 (docs/19) et extrémités sur un bord extérieur du gabarit
  regles.push(function (m) {
    var e = [], sorties = sortiesDesCases(m), gabarit = gabaritConnu(m.gabarit);
    var portsParCase = dict(), raccordsParCase = dict(), typeCase = dict();
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id)) typeCase[c.id] = c.type; });
    sorties.forEach(function (s) {
      var table = s.type === 'coin' ? portsParCase : raccordsParCase;
      table[s.caseId] = (table[s.caseId] || 0) + 1;
    });
    function porteuse(id) { return !!portsParCase[id]; }
    Object.keys(portsParCase).forEach(function (id) {
      if (portsParCase[id] > 1) e.push(alerte('ports_case', 'La case ' + id + ' porte plusieurs ports de coin : ' + RISQUE_ECART + '.', refCase(id)));
      if (raccordsParCase[id]) e.push(alerte('raccord_porteuse', 'La case ' + id + ' porte un port et un raccord : ' + RISQUE_ECART + '.', refCase(id)));
      if (typeCase[id] === 'apparition') e.push(alerte('port_apparition', 'La case d\'apparition ' + id + ' porte un port de coin : ' + RISQUE_ECART + '.', refCase(id)));
    });
    tab(m.chemins).forEach(function (ch) {
      if (!estObjet(ch) || typeExtremite(ch.a) !== 'case' || typeExtremite(ch.b) !== 'case') return;
      if (porteuse(ch.a['case']) && porteuse(ch.b['case']) && ch.a['case'] !== ch.b['case']) {
        e.push(alerte('porteuses_reliees', 'Deux cases porteuses de port sont reliées directement : ' + RISQUE_ECART + '.', refChemin(ch)));
      }
    });
    if (gabarit) {
      var g = G.GABARITS[gabarit];
      sorties.forEach(function (s) {
        if (s.type === 'raccord' && g.cotesExterieurs.indexOf(s.autre.raccord.cote) >= 0) {
          e.push(alerte('raccord_exterieur', 'Raccord sur le côté ' + nomCote(s.autre.raccord.cote) + ', extérieur pour ' + LIBELLE_GABARIT[gabarit] + ' : il sera face au vide.', refRaccord(s.autre.raccord, s.chemin)));
        } else if (s.type === 'coin' && g.coinsInterieurs.indexOf(s.autre.coin) < 0) {
          e.push(alerte('port_exterieur', 'Port sur le coin ' + nomCoin(s.autre.coin) + ', extérieur pour ' + LIBELLE_GABARIT[gabarit] + ' : il n\'aboutira à aucune jonction.', refCoin(s.autre.coin)));
        }
      });
    }
    return e;
  });

  // Réseau sans sortie : groupe de cases reliées entre elles sans aucun raccord ni port
  regles.push(function (m) {
    var e = [], parent = dict(), ids = [];
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id) && parent[c.id] === undefined) { parent[c.id] = c.id; ids.push(c.id); } });
    function racine(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    tab(m.chemins).forEach(function (ch) {
      if (!estObjet(ch) || typeExtremite(ch.a) !== 'case' || typeExtremite(ch.b) !== 'case') return;
      if (parent[ch.a['case']] === undefined || parent[ch.b['case']] === undefined) return;
      parent[racine(ch.a['case'])] = racine(ch.b['case']);
    });
    // Les cases d'un même réseau de passages sont reliées entre elles ; un passage vers un raccord est une sortie
    var passages = reseauxDePassages(m);
    passages.reseaux.forEach(function (rs) {
      var premiere = null;
      rs.cases.forEach(function (id) {
        if (parent[id] === undefined) return;
        if (premiere === null) premiere = id; else parent[racine(id)] = racine(premiere);
      });
    });
    var sortie = dict(), membres = dict(), relie = dict();
    sortiesDesCases(m).forEach(function (s) { if (parent[s.caseId] !== undefined) sortie[racine(s.caseId)] = true; });
    passages.reseaux.forEach(function (rs) {
      if (rs.raccords > 0) rs.cases.forEach(function (id) { if (parent[id] !== undefined) sortie[racine(id)] = true; });
    });
    pourChaqueExtremite(m, function (x, t) { if (t === 'case') relie[x['case']] = true; });
    pourChaqueExtremitePassage(m, function (x, t) { if (t === 'case') relie[x['case']] = true; });
    ids.forEach(function (id) { var r = racine(id); (membres[r] = membres[r] || []).push(id); });
    Object.keys(membres).forEach(function (r) {
      var groupe = membres[r];
      if (sortie[r] || (groupe.length === 1 && !relie[groupe[0]])) return; // case isolée : erreur dédiée
      e.push(alerte('reseau_sans_sortie', 'Les cases ' + groupe.join(', ') + ' n\'ont ni raccord ni port : elles ne mènent nulle part.', { type: 'case', id: groupe[0], ids: groupe }));
    });
    // Poche : case en impasse (un seul chemin, vers une autre case) qui ne porte ni raccord ni port et n'est pas
    // la case d'apparition. Un réseau entier sans sortie est déjà signalé ci-dessus, on ne le répète pas.
    var degre = dict(), typeDe = dict();
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id)) typeDe[c.id] = c.type; });
    pourChaqueExtremite(m, function (x, t) { if (t === 'case') degre[x['case']] = (degre[x['case']] || 0) + 1; });
    pourChaqueExtremitePassage(m, function (x, t) { if (t === 'case') degre[x['case']] = (degre[x['case']] || 0) + 1; });
    var avecSortie = dict();
    sortiesDesCases(m).forEach(function (s) { avecSortie[s.caseId] = true; });
    passages.reseaux.forEach(function (rs) { if (rs.raccords > 0) rs.cases.forEach(function (id) { avecSortie[id] = true; }); });
    ids.forEach(function (id) {
      if (degre[id] !== 1 || avecSortie[id] || typeDe[id] === 'apparition' || !sortie[racine(id)]) return;
      e.push(alerte('poche', 'La case ' + id + ' est une poche : un seul chemin y mène et elle n\'a ni raccord ni port, c\'est une impasse qui ne mène nulle part.', refCase(id)));
    });
    return e;
  });

  /* ------------------------------------------------------------------ */
  /* Règles des passages sans case (docs/39 ; décisions de docs/18)      */
  /* Blocages : structure, coin, case-case, raccord partagé, boucle,      */
  /* doublon, pivot de degré > 3, croisement, case trop proche, zone de   */
  /* coin, passage hors tuile. Alertes : voir regles « alertes ».         */
  /* ------------------------------------------------------------------ */

  function refPassage(p) { return { type: 'passage', id: p && p.id }; }
  function refPivot(id) { return { type: 'pivot', id: id }; }

  /** Seuil de rayon de courbure (mm) en dessous duquel un passage est signalé (docs/39). */
  var RAYON_PASSAGE_MIN = 10;
  var TOLERANCE_RAYON = 0.5;
  /** Écart (mm) entre le trait d'un passage et celui d'un chemin ou d'un autre passage, en dessous duquel on alerte (largeur du trait). */
  var ECART_PASSAGE = 8;
  /** Plafond des cases touchées par un même réseau de passages avant alerte. */
  var MAX_CASES_RESEAU = 4;
  /** Degré maximal d'un pivot (un T). */
  var DEGRE_MAX_PIVOT = 3;

  /** Distance entre deux segments [a, b] et [c, d] et un point où elle est atteinte : { d, w }. */
  function distanceSegments(a, b, c, d) {
    var x = intersectionSegments(a, b, c, d);
    if (x) return { d: 0, w: x };
    var meilleur = { d: Infinity, w: null };
    [[a, c, d], [b, c, d], [c, a, b], [d, a, b]].forEach(function (q) {
      var v = distancePointSegment(q[0], q[1], q[2]);
      if (v < meilleur.d) meilleur = { d: v, w: q[0] };
    });
    return meilleur;
  }

  // Structure : pivots, extrémités, coin, case-case, inconnus, boucle, doublon, raccords partagés, degré des pivots, courbe
  function structurePassages(m, F) {
    var e = [], ids = dict(), pivots = dict(), vus = dict(), degre = dict(), raccordsPris = dict(), marge = F.MARGE_COUPE_CASE, demi = F.LARGEUR_CHEMIN / 2;
    var casesPlacees = tab(m.cases).filter(function (c) { return estObjet(c) && estId(c.id) && estNombre(c.x) && estNombre(c.y) && estNombre(c.diametre); });
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id)) ids[c.id] = true; });
    pourChaqueExtremite(m, function (x, t) { if (t === 'raccord') raccordsPris[cleExtremite(x)] = 'chemin'; });
    tab(m.pivots).forEach(function (pv) {
      if (!estObjet(pv) || !estId(pv.id) || !estNombre(pv.x) || !estNombre(pv.y)) {
        e.push(err('pivot_invalide', 'Position ou identifiant de pivot invalide.', refPivot(estObjet(pv) ? pv.id : undefined)));
        return;
      }
      pivots[pv.id] = true;
      if (pv.x < marge - EPS || pv.y < marge - EPS || pv.x > F.COTE - marge + EPS || pv.y > F.COTE - marge + EPS) {
        e.push(err('pivot_hors_tuile', 'Pivot trop près du bord de la tuile (' + marge + ' mm de marge).', refPivot(pv.id)));
      }
      // le disque du pivot (largeur du trait) reste hors de la zone de coin et à 4 mm au moins du bord des cases
      for (var k = 0; k < 4; k++) {
        var K = F.pointCoin(k);
        if (Math.hypot(pv.x - K.x, pv.y - K.y) < F.RAYON_ZONE_COIN + demi - EPS) {
          e.push(err('pivot_zone_coin', 'Le pivot ' + pv.id + ' est dans la zone du coin ' + nomCoin(k) + ' (réservée au jeton et à la case de jonction).', refPivot(pv.id)));
          break;
        }
      }
      casesPlacees.forEach(function (c) {
        if (Math.hypot(pv.x - c.x, pv.y - c.y) < c.diametre / 2 + 4 + demi - EPS) {
          e.push(err('pivot_case', 'Le pivot ' + pv.id + ' est trop près de la case ' + c.id + ' (4 mm au moins entre le bord de la case et le trait).', { type: 'pivot', id: pv.id, cases: [c.id] }));
        }
      });
    });
    tab(m.passages).forEach(function (p) {
      if (!estObjet(p) || !extremitePassageValide(p.a) || !extremitePassageValide(p.b)) {
        e.push(err('passage_invalide', 'Une extrémité de passage est mal formée.', refPassage(estObjet(p) ? p : null)));
        return;
      }
      var ta = G.typeExtremitePassage(p.a), tb = G.typeExtremitePassage(p.b), ka = G.cleExtremitePassage(p.a), kb = G.cleExtremitePassage(p.b);
      if (ta === 'coin' || tb === 'coin') {
        e.push(err('passage_coin', 'Un passage ne peut pas aller vers un coin : il relie des cases, des raccords et des pivots seulement.', refPassage(p)));
        return;
      }
      if (ta === 'case' && tb === 'case') {
        e.push(err('passage_case_case', 'Un passage ne relie pas deux cases directement : c\'est un chemin droit.', refPassage(p)));
      }
      [p.a, p.b].forEach(function (x, i) {
        var t = i === 0 ? ta : tb;
        if (t === 'case' && !ids[x['case']]) e.push(err('passage_inconnu', 'Un passage vise une case qui n\'existe pas.', refPassage(p)));
        if (t === 'pivot' && !pivots[x.pivot]) e.push(err('passage_inconnu', 'Un passage vise un pivot qui n\'existe pas.', refPassage(p)));
        if (t === 'pivot') degre[x.pivot] = (degre[x.pivot] || 0) + 1;
        if (t === 'raccord') {
          var k = G.cleExtremitePassage(x);
          if (raccordsPris[k]) {
            e.push(err('raccord_double', raccordsPris[k] === 'chemin'
              ? 'Un raccord est utilisé par un chemin et par un passage.' : 'Un raccord est utilisé par deux passages.', refRaccord(x.raccord, p)));
          }
          raccordsPris[k] = 'passage';
        }
      });
      if (ka === kb) e.push(err('passage_boucle', 'Un passage ne peut pas relier un point à lui-même.', refPassage(p)));
      var cle = ka < kb ? ka + '|' + kb : kb + '|' + ka;
      if (vus[cle]) e.push(err('passage_double', 'Deux passages relient les mêmes points.', refPassage(p)));
      vus[cle] = true;
      if (p.courbe !== undefined && !(estObjet(p.courbe) && estNombre(p.courbe.x) && estNombre(p.courbe.y))) {
        e.push(err('passage_courbe', 'Le point de contrôle de la courbe est invalide.', refPassage(p)));
      }
    });
    Object.keys(degre).forEach(function (id) {
      if (degre[id] > DEGRE_MAX_PIVOT) {
        e.push(err('pivot_degre', 'Un pivot porte au plus ' + DEGRE_MAX_PIVOT + ' branches (un T) : ' + degre[id] + ' passages y aboutissent.', refPivot(id)));
      }
    });
    return e;
  }
  regles.push(structurePassages);

  // Tracés des passages : hors tuile, zone de coin, case trop proche, croisements (erreurs) ; rayon et écart (alertes)
  // Coût borné (fichier hostile, docs/41 B1) : sautée si la structure des passages a déjà des erreurs ; paires de traits
  // éloignées écartées par leurs boîtes englobantes ; sortie au premier croisement d'une paire.
  regles.push(function (m, F) {
    var e = [], L = F.LARGEUR_CHEMIN, demi = L / 2;
    var tp = G.tracesPassages(m, F);
    if (!tp.length || structurePassages(m, F).length) return e;
    var cases = tab(m.cases).filter(function (c) { return estObjet(c) && estId(c.id) && estNombre(c.x) && estNombre(c.y) && estNombre(c.diametre); });
    var pivots = dict();
    tab(m.pivots).forEach(function (pv) { if (estObjet(pv) && estId(pv.id) && estNombre(pv.x) && estNombre(pv.y)) pivots[pv.id] = pv; });
    var chemins = G.tracesModele(m, F);
    function segments(t, fn) { for (var s = 0; s + 1 < t.pts.length; s++) { if (fn(t.pts[s], t.pts[s + 1], s) === false) return; } }
    tp.forEach(function (t) {
      var hors = t.pts.some(function (p) { return p.x < -EPS || p.y < -EPS || p.x > F.COTE + EPS || p.y > F.COTE + EPS; });
      if (hors) e.push(err('passage_hors_tuile', 'Ce passage sort de la tuile : rapprochez son point de contrôle.', refPassage(t)));
      var zone = false;
      for (var k = 0; k < 4 && !zone; k++) {
        var K = F.pointCoin(k);
        segments(t, function (a, b) {
          if (distancePointSegment(K, a, b) < F.RAYON_ZONE_COIN + demi - EPS) { zone = true; return false; }
        });
        if (zone) e.push(err('passage_zone_coin', 'Ce passage entre dans la zone du coin ' + nomCoin(k) + ' (réservée au jeton et à la case de jonction).', refPassage(t)));
      }
      cases.forEach(function (c) {
        if (t.cases.indexOf(c) >= 0) return;
        var proche = false;
        segments(t, function (a, b) {
          if (distancePointSegment(c, a, b) < c.diametre / 2 + 4 + demi - EPS) { proche = true; return false; }
        });
        if (proche) e.push(err('passage_case', 'Ce passage passe trop près de la case ' + c.id + ' qu\'il ne relie pas.', { type: 'passage', id: t.id, cases: [c.id] }));
      });
      if (t.rayonMin < RAYON_PASSAGE_MIN - TOLERANCE_RAYON) { // le demi-cercle par défaut en 5×5 (rayon 10) sort à 9,92 mm après approximation cubique
        e.push(alerte('passage_rayon', 'Ce passage tourne trop court (rayon de ' + (Math.round(t.rayonMin * 10) / 10) + ' mm, ' + RAYON_PASSAGE_MIN + ' mm au moins) : il sera difficile à lire.', refPassage(t)));
      }
    });
    // Croisements et écarts entre deux traits (un passage et un passage ou un chemin)
    function zonesCommunes(t, u) {
      var disques = t.cases.filter(function (c) { return u.cases.indexOf(c) >= 0; }).map(function (c) { return { x: c.x, y: c.y, r: c.diametre / 2 }; });
      var pts = (t.pivots || []).filter(function (id) { return (u.pivots || []).indexOf(id) >= 0 && pivots[id]; }).map(function (id) { return pivots[id]; });
      return { disques: disques, pivots: pts };
    }
    function dansZone(z, p, margeDisque, rayonPivot) {
      return z.disques.some(function (c) { return Math.hypot(p.x - c.x, p.y - c.y) <= c.r + margeDisque + EPS; }) ||
        z.pivots.some(function (v) { return Math.hypot(p.x - v.x, p.y - v.y) <= rayonPivot; });
    }
    /** Morceaux du segment [a, b] hors des disques de la zone commune (rayon r + margeDisque autour des cases, rayonPivot autour des pivots). */
    function horsZones(a, b, z, margeDisque, rayonPivot) {
      var disques = z.disques.map(function (c) { return { x: c.x, y: c.y, r: c.r + margeDisque }; })
        .concat(z.pivots.map(function (v) { return { x: v.x, y: v.y, r: rayonPivot }; }));
      var morceaux = [[0, 1]], dx = b.x - a.x, dy = b.y - a.y, A = dx * dx + dy * dy;
      if (A < 1e-12) return [];
      disques.forEach(function (c) {
        var fx = a.x - c.x, fy = a.y - c.y, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - c.r * c.r, D = B * B - 4 * A * C;
        if (D <= 0) return;
        var t0 = (-B - Math.sqrt(D)) / (2 * A), t1 = (-B + Math.sqrt(D)) / (2 * A), suite = [];
        morceaux.forEach(function (q) {
          if (t1 <= q[0] || t0 >= q[1]) { suite.push(q); return; }
          if (t0 > q[0]) suite.push([q[0], t0]);
          if (t1 < q[1]) suite.push([t1, q[1]]);
        });
        morceaux = suite;
      });
      return morceaux.filter(function (q) { return q[1] - q[0] > 1e-9; }).map(function (q) {
        return [{ x: a.x + dx * q[0], y: a.y + dy * q[0] }, { x: a.x + dx * q[1], y: a.y + dy * q[1] }];
      });
    }
    function boite(t) {
      var bx = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      t.pts.forEach(function (p) { bx.x0 = Math.min(bx.x0, p.x); bx.y0 = Math.min(bx.y0, p.y); bx.x1 = Math.max(bx.x1, p.x); bx.y1 = Math.max(bx.y1, p.y); });
      return bx;
    }
    function comparer(t, u) {
      var bt = t.boite || (t.boite = boite(t)), bu = u.boite || (u.boite = boite(u));
      if (bt.x0 > bu.x1 + ECART_PASSAGE || bu.x0 > bt.x1 + ECART_PASSAGE || bt.y0 > bu.y1 + ECART_PASSAGE || bu.y0 > bt.y1 + ECART_PASSAGE) return { croise: false, ecart: false };
      var z = zonesCommunes(t, u), i, j;
      for (i = 0; i + 1 < t.pts.length; i++) {
        for (j = 0; j + 1 < u.pts.length; j++) {
          var p = intersectionSegments(t.pts[i], t.pts[i + 1], u.pts[j], u.pts[j + 1]);
          if (p && !dansZone(z, p, 0, 1)) return { croise: true, ecart: false };
        }
      }
      // Écart mesuré sur les seules parties hors des zones communes : deux traits qui partent d'une même case (ou d'un
      // même pivot, zone de 2 L) se rejoignent normalement dans la zone, mais pas au-delà (docs/41 C2)
      var mu = [];
      for (j = 0; j + 1 < u.pts.length; j++) mu = mu.concat(horsZones(u.pts[j], u.pts[j + 1], z, demi, 2 * L));
      for (i = 0; i + 1 < t.pts.length; i++) {
        var mt = horsZones(t.pts[i], t.pts[i + 1], z, demi, 2 * L);
        for (var k = 0; k < mt.length; k++) {
          for (var n = 0; n < mu.length; n++) {
            if (distanceSegments(mt[k][0], mt[k][1], mu[n][0], mu[n][1]).d < ECART_PASSAGE - EPS) return { croise: false, ecart: true };
          }
        }
      }
      return { croise: false, ecart: false };
    }
    for (var a = 0; a < tp.length; a++) {
      for (var b = a + 1; b < tp.length; b++) {
        var r = comparer(tp[a], tp[b]);
        if (r.croise) e.push(err('passages_croises', 'Deux passages se croisent : ils ne se rejoignent que par un pivot.', { type: 'passage', id: tp[a].id, ids: [tp[a].id, tp[b].id] }));
        else if (r.ecart) e.push(alerte('passages_proches', 'Deux passages passent à moins de ' + ECART_PASSAGE + ' mm l\'un de l\'autre.', { type: 'passage', id: tp[a].id, ids: [tp[a].id, tp[b].id] }));
      }
      chemins.forEach(function (ch) {
        var r2 = comparer(tp[a], ch);
        if (r2.croise) e.push(err('passage_chemin_croise', 'Un passage croise le chemin ' + ch.id + '.', { type: 'passage', id: tp[a].id, ids: [tp[a].id] }));
        else if (r2.ecart) e.push(alerte('passage_chemin_proche', 'Un passage passe à moins de ' + ECART_PASSAGE + ' mm du chemin ' + ch.id + '.', { type: 'passage', id: tp[a].id, ids: [tp[a].id] }));
      });
    }
    return e;
  });

  // Alertes des passages : porteuse, apparition, plusieurs passages sur un bord ou un coin, pivots, grands réseaux, raccords extérieurs
  regles.push(function (m) {
    var e = [], gabarit = gabaritConnu(m.gabarit);
    if (!tab(m.passages).length && !tab(m.pivots).length) return e;
    var typeCase = dict(), porteuses = dict(), vus = dict();
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id)) typeCase[c.id] = c.type; });
    sortiesDesCases(m).forEach(function (s) { if (s.type === 'coin') porteuses[s.caseId] = true; });
    pourChaqueExtremitePassage(m, function (x, t, p) {
      if (t === 'case' && porteuses[x['case']] && !vus['p' + x['case']]) {
        vus['p' + x['case']] = true;
        e.push(alerte('porteuse_passage', 'La case ' + x['case'] + ' porte un port de coin et touche un passage : ' + RISQUE_ECART + '.', refCase(x['case'])));
      }
      if (t === 'case' && typeCase[x['case']] === 'apparition' && !vus['a' + x['case']]) {
        vus['a' + x['case']] = true;
        e.push(alerte('passage_apparition', 'La case d\'apparition ' + x['case'] + ' touche un passage : ' + RISQUE_ECART + '.', refCase(x['case'])));
      }
      if (t === 'raccord' && gabarit && G.GABARITS[gabarit].cotesExterieurs.indexOf(x.raccord.cote) >= 0) {
        e.push(alerte('raccord_exterieur', 'Raccord de passage sur le côté ' + nomCote(x.raccord.cote) + ', extérieur pour ' + LIBELLE_GABARIT[gabarit] + ' : il sera face au vide.', refRaccord(x.raccord, p)));
      }
    });
    var rp = reseauxDePassages(m);
    if ((gabarit === 'bord' || gabarit === 'coin') && rp.reseaux.length > 1) {
      e.push(alerte('passages_bord', 'Cette tuile de ' + (gabarit === 'bord' ? 'bord' : 'coin') + ' porte ' + rp.reseaux.length + ' réseaux de passages : un seul est prévu.', refModele(m)));
    }
    rp.reseaux.forEach(function (rs) {
      if (rs.cases.length > MAX_CASES_RESEAU) {
        e.push(alerte('reseau_passages_grand', 'Un réseau de passages touche ' + rs.cases.length + ' cases (plus de ' + MAX_CASES_RESEAU + ') : ces cases sont toutes voisines.',
          { type: 'case', id: rs.cases[0], ids: rs.cases.slice() }));
      }
    });
    var degre = dict();
    pourChaqueExtremitePassage(m, function (x, t) { if (t === 'pivot') degre[x.pivot] = (degre[x.pivot] || 0) + 1; });
    tab(m.pivots).forEach(function (pv) {
      if (!estObjet(pv) || !estId(pv.id)) return;
      var d = degre[pv.id] || 0;
      if (d < DEGRE_MAX_PIVOT) e.push(alerte('pivot_degre_faible', 'Le pivot ' + pv.id + ' n\'a que ' + d + ' branche(s) : un pivot sert à ramifier en T (3 branches).', refPivot(pv.id)));
    });
    return e;
  });

  /**
   * Valide un modèle de tuile (orientation canonique) pour le format `format` (objet ou identifiant,
   * 4×4 par défaut). Ne lève jamais d'exception sur le modèle.
   * Renvoie { complet, erreurs, alertes } (entrées {code, message, ref}) ; complet = aucune erreur bloquante.
   */
  function validerModele(modele, format) {
    var erreurs = [], alertes = [], F = resoudreFormat(format);
    if (!estObjet(modele)) {
      return { complet: false, erreurs: [err('modele_absent', 'Modèle absent.', { type: 'modele', id: undefined })], alertes: [] };
    }
    regles.forEach(function (r) {
      var entrees;
      try { entrees = r(modele, F); } catch (ex) {
        entrees = [err('regle_en_erreur', 'Le modèle n\'a pas pu être vérifié (données inattendues).', refModele(modele))];
      }
      tab(entrees).forEach(function (x) {
        if (!x) return;
        if (x.alerte) alertes.push(err(x.code, x.message, x.ref));
        else erreurs.push(x);
      });
    });
    return { complet: erreurs.length === 0, erreurs: erreurs, alertes: alertes };
  }

  /** Premier identifiant libre parmi les cases, chemins, pivots et passages du modèle : prefixe + 1, 2, 3... */
  function nouvelId(modele, prefixe) {
    var pris = dict();
    tab(modele && modele.cases).concat(tab(modele && modele.chemins), tab(modele && modele.pivots), tab(modele && modele.passages)).forEach(function (el) {
      if (estObjet(el) && typeof el.id === 'string') pris[el.id] = true;
    });
    prefixe = typeof prefixe === 'string' && prefixe ? prefixe : 'x';
    var k = 1;
    while (pris[prefixe + k]) k++;
    return prefixe + k;
  }

  /* ------------------------------------------------------------------ */
  /* Modèles d'exemple (orientation canonique, mm)                       */
  /* Conformes aux règles v2 sans alerte (R1 à R4 respectées, raccourci   */
  /* de coin de docs/20 D5) ; de quoi remplir une grille pleine.          */
  /* ------------------------------------------------------------------ */

  /** Exemples d'un format : cotes de docs/20 (D4, vérifications de l'étoile, du bord et du coin). */
  function construireExemples(grille) {
    var F = resoudreFormat(grille), C = F.COTE, cinq = F.id === '5x5';
    var D = F.DIAMETRE_CASE;            // Ø des cases (≤ Ø max des deux formats)
    function kase(id, x, y, type) { return { id: id, x: x, y: y, diametre: D, type: type || 'deplacement' }; }
    function lien(id, a, b) { return { id: id, a: { 'case': a }, b: { 'case': b } }; }
    function port(id, c, coin) { return { id: id, a: { 'case': c }, b: { coin: coin } }; }
    function raccord(id, c, cote, pos) { return { id: id, a: { 'case': c }, b: { raccord: { cote: cote, pos: pos } } }; }
    var p = cinq ? 28 : 32;            // distance des cases porteuses de l'étoile à leur coin, sur chaque axe
    var bord = cinq ? { x: 25, y: 72, ay: 34 } : { x: 32, y: 88, ay: 40 };
    var coin = cinq ? { a: 36, c: 70 } : { a: 44, c: 88 };
    var n = F.GRILLE.colonnes, l = F.GRILLE.lignes;
    return [
      { // étoile à 5 cases : relais au centre, 4 porteuses, raccords au milieu des côtés depuis le centre
        id: 'ex-centrale', nom: 'Étoile', gabarit: 'centrale', grille: F.id, exemplaires: (n - 2) * (l - 2),
        cases: [kase('c0', C / 2, C / 2), kase('c1', p, p), kase('c2', C - p, p), kase('c3', C - p, C - p), kase('c4', p, C - p)],
        chemins: [
          lien('h1', 'c0', 'c1'), lien('h2', 'c0', 'c2'), lien('h3', 'c0', 'c3'), lien('h4', 'c0', 'c4'),
          port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3),
          raccord('r1', 'c0', 0, 1), raccord('r2', 'c0', 1, 1), raccord('r3', 'c0', 2, 1), raccord('r4', 'c0', 3, 1)
        ]
      },
      { // côté extérieur au N ; apparition relais entre les deux porteuses ; raccourcis E p0 et O p2
        id: 'ex-bord', nom: 'Bord en V', gabarit: 'bord', grille: F.id, exemplaires: 2 * (n - 2) + 2 * (l - 2),
        cases: [kase('c1', C - bord.x, bord.y), kase('c2', bord.x, bord.y), kase('c3', C / 2, bord.ay, 'apparition')],
        chemins: [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 0), raccord('r2', 'c3', 3, 2), raccord('r3', 'c3', 2, 1)
        ]
      },
      { // côtés extérieurs N et O ; apparition sur la diagonale, porteuse au coin SE ; raccourci E p0 et S p2
        id: 'ex-coin', nom: 'Coin raccourci', gabarit: 'coin', grille: F.id, exemplaires: 4,
        cases: [kase('c1', coin.c, coin.c), kase('c2', coin.a, coin.a, 'apparition')],
        chemins: [lien('h1', 'c2', 'c1'), port('p1', 'c1', 2), raccord('r1', 'c2', 1, 0), raccord('r2', 'c2', 2, 2)]
      }
    ];
  }

  /** Gèle récursivement un objet (les exemples partagés ne doivent pas être modifiés). */
  function geler(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { geler(o[k]); });
    }
    return o;
  }

  /* ------------------------------------------------------------------ */
  /* Cellules, gabarits de position, camps et rotations                  */
  /* Convention : une cellule est (col, lig) ; une jonction est (i, j)   */
  /* avec i = colonne et j = ligne des coins de cellules (1..3 en 4×4). */
  /* Le dernier paramètre `format` (objet ou identifiant) est facultatif */
  /* et vaut le format 4×4 par défaut.                                   */
  /* ------------------------------------------------------------------ */

  function dansGrille(col, lig, F) {
    var NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes;
    return estEntier(col) && estEntier(lig) && col >= 0 && col < NC && lig >= 0 && lig < NL;
  }

  /** Côtés d'une cellule de la grille qui donnent sur l'extérieur du plateau (ordre croissant). */
  function cotesExterieursCellule(col, lig, F) {
    var res = [];
    for (var c = 0; c < 4; c++) {
      var d = G.coteVoisin(c);
      if (!dansGrille(col + d.dc, lig + d.dl, F)) res.push(c);
    }
    return res;
  }

  /**
   * Gabarit attendu à la position d'une cellule : 'coin' (2 côtés extérieurs), 'bord' (1), 'centrale' (0),
   * null hors grille. Sert au contrôle du rôle à la pose (peutPoserTuile).
   */
  function gabaritCellule(col, lig, format) {
    var F = resoudreFormat(format);
    if (!dansGrille(col, lig, F)) return null;
    return ['centrale', 'bord', 'coin'][cotesExterieursCellule(col, lig, F).length] || null;
  }

  /** Camp d'une cellule : 'vert' | 'rouge' | null (rangée centrale d'une grille impaire, valeur invalide). */
  function campCellule(format, col, lig) { return resoudreFormat(format).campCellule(col, lig); }

  /**
   * Rotation suggérée (entier 0..3) pour une tuile de ce gabarit posée en (col, lig) : un bord sur une
   * cellule de bord tourne son côté extérieur vers le dehors, un coin sur une cellule de coin aussi.
   * null sinon (centrale, gabarit inconnu, gabarit différent de la cellule) : la rotation reste libre.
   */
  function rotationDeduite(col, lig, gabarit, format) {
    var F = resoudreFormat(format), place = gabaritCellule(col, lig, F);
    if (!place || place === 'centrale' || gabarit !== place) return null;
    var ex = cotesExterieursCellule(col, lig, F);
    if (place === 'bord') return ex[0];
    // coin : côtés extérieurs {rot + 3, rot} (canonique N et O pour rot 0)
    return (ex[0] === 0 && ex[1] === 3) ? 0 : ex[1];
  }

  /** Jonction (i, j) = (colonne, ligne) touchée par le coin k de la cellule (col, lig) (indépendant du format). */
  function jonctionDuCoin(col, lig, k) {
    return [{ i: col, j: lig }, { i: col + 1, j: lig }, { i: col + 1, j: lig + 1 }, { i: col, j: lig + 1 }][k];
  }

  var AUTOUR_JONCTION = [
    { dc: -1, dl: -1, coin: 2 }, { dc: 0, dl: -1, coin: 3 },
    { dc: -1, dl: 0, coin: 1 }, { dc: 0, dl: 0, coin: 0 }
  ];

  /** Plafond du stock exporté ou tiré par le générateur : somme des exemplaires des modèles complets. */
  var PLAFOND_TUILES = 200;

  /** Nombre d'exemplaires d'un modèle, lu d'une seule façon : entier ≥ 0, sinon 0. */
  function exemplairesValides(modele) {
    var n = modele && typeof modele === 'object' ? modele.exemplaires : undefined;
    return estEntier(n) && n >= 0 ? n : 0;
  }

  function jonctionInterieure(i, j, F) {
    var NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes;
    return estEntier(i) && estEntier(j) && i >= 1 && i <= NC - 1 && j >= 1 && j <= NL - 1;
  }

  /* ------------------------------------------------------------------ */
  /* Document et plateau (fonctions pures)                               */
  /* ------------------------------------------------------------------ */

  /** Document vide du format `grille` ('4x4' par défaut). */
  function nouveauDocument(grille) {
    var F = resoudreFormat(grille);
    return { version: VERSION_DOCUMENT, grille: F.id, modeles: [], plateau: { tuiles: [], jetons: [] } };
  }
  /** Copie profonde (JSON). clonerDocument(undefined) renvoie undefined. */
  function clonerDocument(doc) { return doc === undefined ? undefined : clone(doc); }

  function modeleParId(doc, id) {
    var ms = tab(doc && doc.modeles);
    for (var i = 0; i < ms.length; i++) if (ms[i] && ms[i].id === id) return ms[i];
    return null;
  }
  function tuileEn(doc, col, lig) {
    var ts = doc.plateau.tuiles;
    for (var i = 0; i < ts.length; i++) if (ts[i] && ts[i].col === col && ts[i].lig === lig) return ts[i];
    return null;
  }
  function nbPosees(doc, modeleId) {
    return doc.plateau.tuiles.filter(function (t) { return t && t.modeleId === modeleId; }).length;
  }

  /** Le modèle porte-t-il au moins une case d'apparition ? */
  function aUneApparition(m) { return tab(m && m.cases).some(function (c) { return estObjet(c) && c.type === 'apparition'; }); }

  /** Masques d'une tuile posée, après rotation : { raccords, portsCoin }. */
  function masquesTuilePosee(doc, tuile) {
    var m = modeleParId(doc, tuile.modeleId);
    if (!m) return { raccords: 0, portsCoin: 0 };
    var mm = masquesDuModele(m);
    return { raccords: G.tournerRaccords(mm.raccords, tuile.rot), portsCoin: G.tournerPorts(mm.portsCoin, tuile.rot) };
  }

  /** Phrase de refus quand le rôle (gabarit) du modèle ne correspond pas à la cellule. */
  var PHRASE_ROLE = {
    coin: 'Cette tuile est un coin : elle se pose dans un coin du plateau.',
    bord: 'Cette tuile est un bord : elle se pose sur le pourtour du plateau, hors des coins.',
    centrale: 'Cette tuile est une centrale : elle se pose au centre du plateau.'
  };

  /**
   * Teste la pose d'une tuile. Renvoie { ok, raison, rot } ; rot = rotation suggérée
   * (rotationDeduite) ou 0. Les poses sont illimitées (les exemplaires ne servent qu'à l'impression et au générateur).
   * Refus : modèle introuvable, hors grille, cellule occupée, modèle incomplet (erreur bloquante), rôle
   * qui ne correspond pas à la cellule (coin dans un coin, bord sur le pourtour hors coins, centrale au centre).
   * Un modèle sans gabarit connu n'a pas de rôle : il va partout.
   */
  function peutPoserTuile(doc, modeleId, col, lig) {
    var F = formatDuDocument(doc);
    function non(raison) { return { ok: false, raison: raison, rot: 0 }; }
    var modele = modeleParId(doc, modeleId);
    if (!modele) return non('Modèle de tuile introuvable.');
    if (!dansGrille(col, lig, F)) return non('Cette cellule est hors de la grille.');
    if (tuileEn(doc, col, lig)) return non('Cette cellule est déjà occupée.');
    if (!validerModele(modele, F).complet) return non('Ce modèle est incomplet : corrigez ses erreurs dans l\'éditeur.');
    var role = gabaritConnu(modele.gabarit);
    if (role && role !== gabaritCellule(col, lig, F)) return non(PHRASE_ROLE[role]);
    var rot = rotationDeduite(col, lig, modele.gabarit, F);
    return { ok: true, raison: '', rot: rot === null ? 0 : rot };
  }

  /** Retire les jetons invalides (document déjà copié, modifié sur place). */
  function nettoyerJetons(doc) {
    var invalides = jetonsInvalides(doc);
    doc.plateau.jetons = doc.plateau.jetons.filter(function (j) {
      return !invalides.some(function (x) { return x.i === (j && j.i) && x.j === (j && j.j) && x.type === (j && j.type); });
    });
    // un doublon est signalé avec les mêmes coordonnées : on conserve alors le premier exemplaire
    var vus = dict();
    doc.plateau.jetons = doc.plateau.jetons.filter(function (j) {
      var cle = j.i + ',' + j.j;
      if (vus[cle]) return false;
      vus[cle] = true;
      return true;
    });
    return doc;
  }

  /**
   * Pose une tuile (pure), dans la rotation `rot` (entier, facultatif : rotation suggérée par défaut).
   * Lève une Error avec la raison si la pose est refusée.
   */
  function poserTuile(doc, modeleId, col, lig, rot) {
    var test = peutPoserTuile(doc, modeleId, col, lig);
    if (!test.ok) throw new Error(test.raison);
    if (rot !== undefined && rot !== null && !estEntier(rot)) throw new Error('La rotation doit être un nombre entier de quarts de tour.');
    var nouveau = clone(doc);
    var r = rot === undefined || rot === null ? test.rot : ((rot % 4) + 4) % 4;
    nouveau.plateau.tuiles.push({ modeleId: modeleId, col: col, lig: lig, rot: r });
    return nouveau;
  }

  /** Retire la tuile de la cellule (pure) ; retire aussi les jetons devenus invalides. */
  function retirerTuile(doc, col, lig) {
    var nouveau = clone(doc);
    nouveau.plateau.tuiles = nouveau.plateau.tuiles.filter(function (t) { return !(t.col === col && t.lig === lig); });
    return nettoyerJetons(nouveau);
  }

  /**
   * Tourne une tuile posée de `quarts` quarts de tour horaires (pure), entier (1 par défaut).
   * Toutes les tuiles tournent (rotation libre). Lève une Error si `quarts` n'est pas un entier
   * ou si la cellule est vide.
   */
  function tournerTuile(doc, col, lig, quarts) {
    if (quarts === undefined) quarts = 1;
    if (!estEntier(quarts)) throw new Error('Le nombre de quarts de tour doit être un entier.');
    if (!tuileEn(doc, col, lig)) throw new Error('Aucune tuile dans cette cellule.');
    var nouveau = clone(doc);
    var nt = tuileEn(nouveau, col, lig);
    nt.rot = (((nt.rot + quarts) % 4) + 4) % 4;
    return nouveau;
  }

  /** Ports qui aboutissent à la jonction (i, j) (colonne, ligne) et nombre de tuiles autour : { ports, tuiles }. */
  function portsJonction(doc, i, j) {
    var ports = 0, tuiles = 0;
    AUTOUR_JONCTION.forEach(function (a) {
      var t = tuileEn(doc, i + a.dc, j + a.dl);
      if (!t) return;
      tuiles++;
      if ((masquesTuilePosee(doc, t).portsCoin >> a.coin) & 1) ports++;
    });
    return { ports: ports, tuiles: tuiles };
  }

  function jetonEn(doc, i, j) {
    var js = doc.plateau.jetons;
    for (var k = 0; k < js.length; k++) if (js[k] && js[k].i === i && js[k].j === j) return js[k];
    return null;
  }

  /**
   * Raison pour laquelle la jonction ne peut pas porter de ville (hors occupation), ou null :
   * jonction intérieure et 4 tuiles posées autour (le jeton repose sur les 4 tuiles).
   * Moins de 2 ports n'empêche rien : c'est une alerte de validerPlateau.
   */
  function raisonJonction(doc, i, j) {
    var F = formatDuDocument(doc);
    if (!jonctionInterieure(i, j, F)) return 'Ce n\'est pas une jonction intérieure.';
    var p = portsJonction(doc, i, j);
    if (p.tuiles < 4) return 'Il faut 4 tuiles autour de la jonction (' + p.tuiles + ' posées).';
    return null;
  }

  /** Teste la pose d'une ville sur la jonction (i, j) = (colonne, ligne). Renvoie { ok, raison }. */
  function peutPoserJeton(doc, i, j) {
    if (!jonctionInterieure(i, j, formatDuDocument(doc))) return { ok: false, raison: 'Ce n\'est pas une jonction intérieure.' };
    if (jetonEn(doc, i, j)) return { ok: false, raison: 'Cette jonction a déjà une ville.' };
    var raison = raisonJonction(doc, i, j);
    return raison ? { ok: false, raison: raison } : { ok: true, raison: '' };
  }

  /** Pose une ville (pure) ; seul le type 'capture' existe (par défaut). Lève une Error si refusé. */
  function poserJeton(doc, i, j, type) {
    type = type || 'capture';
    if (TYPES_JETON.indexOf(type) < 0) throw new Error('Type de jeton inconnu.');
    var test = peutPoserJeton(doc, i, j);
    if (!test.ok) throw new Error(test.raison);
    var nouveau = clone(doc);
    nouveau.plateau.jetons.push({ i: i, j: j, type: type });
    return nouveau;
  }

  function retirerJeton(doc, i, j) {
    var nouveau = clone(doc);
    nouveau.plateau.jetons = nouveau.plateau.jetons.filter(function (t) { return !(t.i === i && t.j === j); });
    return nouveau;
  }

  /** Case chemin -> ville -> case chemin (pure). Lève une Error si la pose de la ville est refusée. */
  function cyclerJeton(doc, i, j) {
    return jetonEn(doc, i, j) ? retirerJeton(doc, i, j) : poserJeton(doc, i, j, 'capture');
  }

  /**
   * Jetons qui ne respectent plus les conditions de pose : [{ i, j, type, raison }].
   * (retirerTuile les retire automatiquement.)
   */
  function jetonsInvalides(doc) {
    var res = [], vus = dict();
    tab(doc.plateau.jetons).forEach(function (j) {
      if (!estObjet(j)) { res.push({ i: undefined, j: undefined, type: undefined, raison: 'Jeton mal formé.' }); return; }
      var raison = null, cle = j.i + ',' + j.j;
      if (TYPES_JETON.indexOf(j.type) < 0) raison = 'Type de jeton inconnu.';
      else if (vus[cle]) raison = 'Deux villes sur la même jonction.';
      else raison = raisonJonction(doc, j.i, j.j);
      vus[cle] = true;
      if (raison) res.push({ i: j.i, j: j.j, type: j.type, raison: raison });
    });
    return res;
  }

  /**
   * Raccords sans vis-à-vis : [{ col, lig, cote, pos, raison }] (côté dans le repère du plateau).
   * raison : 'absent' = cellule voisine pas encore posée ; 'vide' = bord du plateau ;
   * 'mort' = voisin posé sans raccord en face.
   */
  function raccordsMorts(doc) {
    var res = [], F = formatDuDocument(doc);
    doc.plateau.tuiles.forEach(function (t) {
      var mA = masquesTuilePosee(doc, t).raccords;
      for (var cote = 0; cote < 4; cote++) {
        if (G.triplet(mA, cote) === 0) continue;
        var d = G.coteVoisin(cote), vc = t.col + d.dc, vl = t.lig + d.dl;
        var v = tuileEn(doc, vc, vl), morts, raison;
        if (v) {
          morts = G.apparier(mA, cote, masquesTuilePosee(doc, v).raccords).mortsA;
          raison = 'mort';
        } else {
          morts = G.triplet(mA, cote);
          raison = dansGrille(vc, vl, F) ? 'absent' : 'vide';
        }
        for (var pos = 0; pos < 3; pos++) {
          if ((morts >> pos) & 1) res.push({ col: t.col, lig: t.lig, cote: cote, pos: pos, raison: raison });
        }
      }
    });
    return res;
  }

  /**
   * Ports de coin qui aboutissent au pourtour du plateau (aucune jonction intérieure, donc aucune case) :
   * [{ col, lig, coin, i, j }] (coin dans le repère du plateau, après rotation).
   */
  function portsVersPourtour(doc) {
    var res = [], F = formatDuDocument(doc);
    doc.plateau.tuiles.forEach(function (t) {
      var ports = masquesTuilePosee(doc, t).portsCoin;
      for (var k = 0; k < 4; k++) {
        if (!((ports >> k) & 1)) continue;
        var jn = jonctionDuCoin(t.col, t.lig, k);
        if (!jonctionInterieure(jn.i, jn.j, F)) res.push({ col: t.col, lig: t.lig, coin: k, i: jn.i, j: jn.j });
      }
    });
    return res;
  }

  /** Jonctions intérieures entourées de 4 tuiles et reliées par moins de MIN_PORTS_JONCTION ports : [{i, j, ports}]. */
  function jonctionsMalReliees(doc) {
    var res = [], F = formatDuDocument(doc);
    for (var j = 1; j < F.GRILLE.lignes; j++) {
      for (var i = 1; i < F.GRILLE.colonnes; i++) {
        var p = portsJonction(doc, i, j);
        if (p.tuiles === 4 && p.ports < F.MIN_PORTS_JONCTION) res.push({ i: i, j: j, ports: p.ports });
      }
    }
    return res;
  }

  /**
   * Éléments d'une tuile posée en repère plateau (mm), pour le graphe global :
   * { cases: [{ id, x, y, diametre, type, camp }], aretes: [[idA, idB]],
   *   raccords: [{ cote, pos, caseId }], ports: [{ coin, caseId, i, j }] }, plus, seulement si le modèle a des passages :
   *   pivots: [{ id, x, y }] et passages: [{ id, a, b, pts }] (extrémités { case } | { pivot } | { raccord: { cote, pos } } avec le côté tourné ;
   *   pts = polyligne en mm plateau). Les raccords des passages ne sont PAS dans `raccords` (un raccord de chemin désigne une seule case).
   * camp ('vert' | 'rouge' | null) : camp de la cellule pour une case d'apparition, null sinon.
   * Les ids de case sont globaux (« col,lig:idLocal »). Renvoie null si le modèle est absent.
   * Le raccord (cote, pos) d'une tuile fait face au raccord PM.geometrie.raccordEnFace(cote, pos) du voisin.
   */
  function tuileEnPlateau(doc, tuile) {
    var m = modeleParId(doc, tuile.modeleId);
    if (!m) return null;
    var F = formatDuDocument(doc), rot = ((tuile.rot % 4) + 4) % 4;
    function gid(id) { return tuile.col + ',' + tuile.lig + ':' + id; }
    var res = { cases: [], aretes: [], raccords: [], ports: [] };
    tab(m.cases).forEach(function (c) {
      if (!estObjet(c)) return;
      var p = F.tournerPoint({ x: c.x, y: c.y }, rot);
      res.cases.push({
        id: gid(c.id), x: p.x + tuile.col * F.COTE, y: p.y + tuile.lig * F.COTE, diametre: c.diametre, type: c.type,
        camp: c.type === 'apparition' ? F.campCellule(tuile.col, tuile.lig) : null
      });
    });
    tab(m.chemins).forEach(function (ch) {
      if (!estObjet(ch) || !extremiteValide(ch.a) || !extremiteValide(ch.b)) return;
      var ta = typeExtremite(ch.a), tb = typeExtremite(ch.b);
      if (ta === 'case' && tb === 'case') { res.aretes.push([gid(ch.a['case']), gid(ch.b['case'])]); return; }
      var autre = ta === 'case' ? ch.b : tb === 'case' ? ch.a : null, caseId = ta === 'case' ? ch.a['case'] : tb === 'case' ? ch.b['case'] : null;
      if (!autre) return;
      if (typeExtremite(autre) === 'raccord') {
        res.raccords.push({ cote: (autre.raccord.cote + rot) % 4, pos: autre.raccord.pos, caseId: gid(caseId) });
      } else {
        var k = (autre.coin + rot) % 4, jn = jonctionDuCoin(tuile.col, tuile.lig, k);
        res.ports.push({ coin: k, caseId: gid(caseId), i: jn.i, j: jn.j });
      }
    });
    // Passages sans case (champs présents seulement s'il y en a : les anciens modèles gardent exactement leur résultat)
    var pivotsOk = tab(m.pivots).filter(function (pv) { return estObjet(pv) && estId(pv.id) && estNombre(pv.x) && estNombre(pv.y); });
    var traces = G.tracesPassages(m, F), ids = dict();
    traces.forEach(function (t) { ids[t.id] = t; });
    var passages = passagesBienFormes(m).filter(function (ps) {
      return ids[ps.id] && G.typeExtremitePassage(ps.a) !== 'coin' && G.typeExtremitePassage(ps.b) !== 'coin';
    });
    if (pivotsOk.length || passages.length) {
      function enPlateau(p) { var q = F.tournerPoint(p, rot); return { x: q.x + tuile.col * F.COTE, y: q.y + tuile.lig * F.COTE }; }
      function extPlateau(x) {
        var t = G.typeExtremitePassage(x);
        if (t === 'case') return { 'case': gid(x['case']) };
        if (t === 'pivot') return { pivot: gid(x.pivot) };
        return { raccord: { cote: (x.raccord.cote + rot) % 4, pos: x.raccord.pos } };
      }
      res.pivots = pivotsOk.map(function (pv) { var q = enPlateau(pv); return { id: gid(pv.id), x: q.x, y: q.y }; });
      res.passages = passages.map(function (ps) {
        return { id: gid(ps.id), a: extPlateau(ps.a), b: extPlateau(ps.b), pts: ids[ps.id].pts.map(enPlateau) };
      });
    }
    return res;
  }

  /** Erreurs d'une tuile posée : [{ code, message, ref: {type:'tuile', col, lig} }] ([] si elle est correcte). */
  function verifierTuilePosee(doc, tuile) {
    var e = [], ref = { type: 'tuile', col: tuile.col, lig: tuile.lig }, F = formatDuDocument(doc);
    var m = modeleParId(doc, tuile.modeleId);
    if (!m) e.push(err('modele_absent', 'Le modèle de cette tuile n\'existe plus.', ref));
    else if (!validerModele(m, F).complet) e.push(err('modele_incomplet', 'Le modèle de cette tuile est incomplet.', ref));
    if (!dansGrille(tuile.col, tuile.lig, F)) {
      e.push(err('hors_grille', 'Cette tuile est hors de la grille.', ref));
    } else if (!estEntier(tuile.rot) || tuile.rot < 0 || tuile.rot > 3) {
      e.push(err('rot_invalide', 'La rotation doit être un entier de 0 à 3.', ref));
    }
    var memeCellule = doc.plateau.tuiles.filter(function (t) { return t && t.col === tuile.col && t.lig === tuile.lig; });
    if (memeCellule.length > 1) e.push(err('doublon', 'Plusieurs tuiles occupent cette cellule.', ref));
    return e;
  }

  /** Alertes de place d'une tuile posée (gabarit, apparition) : [{ code, message, ref }]. */
  function alertesTuilePosee(doc, tuile) {
    var e = [], ref = { type: 'tuile', col: tuile.col, lig: tuile.lig }, F = formatDuDocument(doc);
    var m = modeleParId(doc, tuile.modeleId), place = gabaritCellule(tuile.col, tuile.lig, F);
    if (!m || !place) return e;
    var g = gabaritConnu(m.gabarit);
    if (g && g !== place) {
      e.push(err('gabarit_place', 'La tuile « ' + (m.nom || m.id) + ' » est ' + LIBELLE_GABARIT[g] + ', posée à la place d\'' + LIBELLE_GABARIT[place] + '.', ref));
    }
    if (place !== 'centrale' && !aUneApparition(m)) {
      e.push(err('pourtour_sans_apparition', 'Tuile du pourtour sans case d\'apparition : aucun groupe ne peut y apparaître.', ref));
    }
    if (place === 'centrale' && aUneApparition(m)) {
      e.push(err('apparition_centre', 'Case d\'apparition sur une tuile du centre : elle ne sert à aucun joueur.', ref));
    }
    return e;
  }

  /**
   * Revalide tout le plateau : { erreurs, alertes }, éléments { code, message, ref }.
   * erreurs : tuiles (verifierTuilePosee), exemplaires dépassés, jetons invalides.
   * alertes : place des tuiles, raccords morts ou face au vide, ports vers le pourtour, jonctions mal reliées
   * (n'empêchent rien).
   */
  function validerPlateau(doc) {
    var erreurs = [], alertes = [];
    doc.plateau.tuiles.forEach(function (t) {
      erreurs = erreurs.concat(verifierTuilePosee(doc, t));
      alertes = alertes.concat(alertesTuilePosee(doc, t));
    });
    jetonsInvalides(doc).forEach(function (j) {
      erreurs.push(err('jeton_invalide', j.raison, { type: 'jeton', i: j.i, j: j.j }));
    });
    raccordsMorts(doc).forEach(function (r) {
      if (r.raison === 'absent') return;
      alertes.push(err('raccord_mort', r.raison === 'vide' ? 'Raccord face au vide.' : 'Raccord sans vis-à-vis.',
        { type: 'raccord', col: r.col, lig: r.lig, cote: r.cote, pos: r.pos }));
    });
    portsVersPourtour(doc).forEach(function (p) {
      alertes.push(err('port_pourtour', 'Port de coin vers le bord du plateau : il n\'aboutit à aucune case de jonction.',
        { type: 'coin', col: p.col, lig: p.lig, coin: p.coin, i: p.i, j: p.j }));
    });
    jonctionsMalReliees(doc).forEach(function (x) {
      alertes.push(err('jonction_ports', 'La jonction (' + x.i + ', ' + x.j + ') n\'est reliée que par ' + x.ports + ' port(s) : sa case est mal reliée au reste du plateau.',
        { type: 'jeton', i: x.i, j: x.j }));
    });
    return { erreurs: erreurs, alertes: alertes };
  }

  /** Ajoute un modèle (pure, copie). Lève une Error si l'id est invalide ou déjà pris. */
  function ajouterModele(doc, modele) {
    if (!estObjet(modele) || !estId(modele.id)) throw new Error('Le modèle doit avoir un identifiant (texte non vide).');
    if (modeleParId(doc, modele.id)) throw new Error('Un modèle porte déjà l\'identifiant « ' + modele.id + ' ».');
    var nouveau = clone(doc);
    nouveau.modeles.push(clone(modele));
    return nouveau;
  }

  /** Remplace le modèle `id` (pure). Même id obligatoire ; le gabarit peut changer (il n'est jamais bloquant). */
  function remplacerModele(doc, id, modele) {
    if (!modeleParId(doc, id)) throw new Error('Modèle de tuile introuvable.');
    if (!estObjet(modele) || modele.id !== id) throw new Error('Le modèle de remplacement doit garder le même identifiant.');
    var nouveau = clone(doc);
    nouveau.modeles = nouveau.modeles.map(function (m) { return m && m.id === id ? clone(modele) : m; });
    return nouveau;
  }

  /** Supprime un modèle (pure). Lève une Error s'il est posé sur le plateau. */
  function supprimerModele(doc, id) {
    if (!modeleParId(doc, id)) throw new Error('Modèle de tuile introuvable.');
    var n = nbPosees(doc, id);
    if (n > 0) throw new Error('Ce modèle est posé ' + n + ' fois sur le plateau : retirez ces tuiles d\'abord.');
    var nouveau = clone(doc);
    nouveau.modeles = nouveau.modeles.filter(function (m) { return !(m && m.id === id); });
    return nouveau;
  }

  /** Change le nombre d'exemplaires à imprimer (pure). Lève une Error si n n'est pas un entier ≥ 0 (il ne limite pas la pose). */
  function changerExemplaires(doc, id, n) {
    if (!modeleParId(doc, id)) throw new Error('Modèle de tuile introuvable.');
    if (!estEntier(n) || n < 0) throw new Error('Le nombre d\'exemplaires doit être un entier positif ou nul.');
    var nouveau = clone(doc);
    modeleParId(nouveau, id).exemplaires = n;
    return nouveau;
  }

  var EXEMPLES = geler(construireExemples('4x4'));

  PM.modele = {
    GABARITS: GABARITS,
    TYPES_JETON: TYPES_JETON,
    VERSION_DOCUMENT: VERSION_DOCUMENT,
    regles: regles,
    masquesDuModele: masquesDuModele,
    validerModele: validerModele,
    formatDuDocument: formatDuDocument,
    nouvelId: nouvelId,
    exemples: EXEMPLES,                                      // tableau gelé du format 4×4 (lecture seule)
    /** Copie modifiable des exemples du format `grille` ('4x4' par défaut, ou '5x5'). */
    copieExemples: function (grille) { return grille && resoudreFormat(grille).id !== '4x4' ? construireExemples(grille) : clone(EXEMPLES); },
    gabaritCellule: gabaritCellule,
    campCellule: campCellule,
    rotationDeduite: rotationDeduite,
    jonctionDuCoin: jonctionDuCoin,
    PLAFOND_TUILES: PLAFOND_TUILES,
    exemplairesValides: exemplairesValides,
    aUneApparition: aUneApparition,
    nouveauDocument: nouveauDocument,
    clonerDocument: clonerDocument,
    modeleParId: modeleParId,
    tuileEn: tuileEn,
    masquesTuilePosee: masquesTuilePosee,
    peutPoserTuile: peutPoserTuile,
    poserTuile: poserTuile,
    retirerTuile: retirerTuile,
    tournerTuile: tournerTuile,
    verifierTuilePosee: verifierTuilePosee,
    validerPlateau: validerPlateau,
    ajouterModele: ajouterModele,
    remplacerModele: remplacerModele,
    supprimerModele: supprimerModele,
    changerExemplaires: changerExemplaires,
    portsJonction: portsJonction,
    peutPoserJeton: peutPoserJeton,
    poserJeton: poserJeton,
    retirerJeton: retirerJeton,
    cyclerJeton: cyclerJeton,
    jetonsInvalides: jetonsInvalides,
    raccordsMorts: raccordsMorts,
    portsVersPourtour: portsVersPourtour,
    jonctionsMalReliees: jonctionsMalReliees,
    tuileEnPlateau: tuileEnPlateau
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.modele;
})();
