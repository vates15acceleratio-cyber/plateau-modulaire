/*
 * modele.js : modèles de tuile, chemins, forme et plateau, validation.
 * Aucun accès au DOM. Toutes les fonctions de modification du document sont
 * pures : elles renvoient un nouveau document sans altérer l'entrée.
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

  var ROLES = ['centrale', 'coin', 'bord', 'apparition'];
  var LIBELLE_ROLE = {
    centrale: 'une centrale', coin: 'un coin', bord: 'un bord', apparition: 'une apparition'
  };
  var TYPES_CASE = ['deplacement', 'apparition'];
  var TYPES_JETON = ['capture', 'carrefour'];

  /** Nombre de cases exigé par rôle. */
  var NB_CASES_PAR_ROLE = { centrale: 4, coin: 3, bord: 3, apparition: 3 };
  /** Côtés extérieurs (orientation canonique). */
  var COTES_EXTERIEURS = { centrale: [], coin: [0, 3], bord: [0], apparition: [0] };
  /** Masque des ports de coin obligatoires (coins intérieurs, orientation canonique). */
  var PORTS_OBLIGATOIRES = { centrale: 0xF, coin: 0x4, bord: 0xC, apparition: 0xC };
  /** Nombre minimal de côtés à raccord non vide. */
  var MIN_COTES_RACCORD = { centrale: 3, coin: 2, bord: 2, apparition: 2 };

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
  /** Lit une table indexée par rôle, seulement si le rôle est connu (sinon undefined). */
  function tableRole(table, role) { return ROLES.indexOf(role) >= 0 ? table[role] : undefined; }

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

  /** Masques calculés à partir des chemins : { raccords (12 bits), portsCoin (4 bits) }. */
  function masquesDuModele(modele) {
    var raccords = 0, portsCoin = 0;
    pourChaqueExtremite(modele, function (e, t) {
      if (t === 'raccord') raccords |= 1 << G.bitRaccord(e.raccord.cote, e.raccord.pos);
      else if (t === 'coin') portsCoin |= 1 << e.coin;
    });
    return { raccords: raccords, portsCoin: portsCoin };
  }

  function nbCotesNonVides(m) {
    var n = 0;
    for (var c = 0; c < 4; c++) if (G.triplet(m, c) !== 0) n++;
    return n;
  }

  /* ------------------------------------------------------------------ */
  /* Validation d'un modèle                                              */
  /* ------------------------------------------------------------------ */

  /**
   * Erreur de validation : { code, message, ref }.
   * ref = { type: 'modele'|'case'|'chemin'|'coin'|'raccord', id, ... } désigne l'élément fautif
   * (pour le halo de l'interface). Le chevauchement ajoute ids: [a, b].
   */
  function err(code, message, ref) { return { code: code, message: message, ref: ref }; }
  function refModele(m) { return { type: 'modele', id: m && m.id }; }
  function refCase(id) { return { type: 'case', id: id }; }
  function refChemin(ch) { return { type: 'chemin', id: ch && ch.id }; }
  function refCoin(k) { return { type: 'coin', id: k }; }
  function refRaccord(r, ch) { return { type: 'raccord', id: r.cote + ':' + r.pos, cote: r.cote, pos: r.pos, chemin: ch && ch.id }; }

  /**
   * Règles de validation. Chaque règle reçoit le modèle et renvoie un tableau
   * d'erreurs. Pour ajouter une règle (ex. chevauchement chemin / case),
   * pousser une fonction dans PM.modele.regles.
   */
  var regles = [];

  // Identité, rôle, exemplaires, ids uniques et bien formés
  regles.push(function (m) {
    var e = [];
    if (!estId(m.id)) e.push(err('id_modele', 'Le modèle doit avoir un identifiant (texte non vide).', refModele(m)));
    if (m.nom !== undefined && typeof m.nom !== 'string') e.push(err('nom_invalide', 'Le nom du modèle doit être un texte.', refModele(m)));
    if (ROLES.indexOf(m.role) < 0) e.push(err('role_inconnu', 'Le rôle de la tuile est inconnu.', refModele(m)));
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
    return e;
  });

  // Nombre et type des cases
  regles.push(function (m) {
    var e = [], cases = tab(m.cases), attendu = tableRole(NB_CASES_PAR_ROLE, m.role);
    if (attendu === undefined) return e;
    if (cases.length !== attendu) {
      e.push(err('nombre_cases', 'Une tuile « ' + m.role + ' » a ' + attendu + ' cases (il y en a ' + cases.length + ').', refModele(m)));
    }
    var nbAppar = 0;
    cases.forEach(function (c) {
      if (!estObjet(c)) return; // signalé par la règle de géométrie
      if (TYPES_CASE.indexOf(c.type) < 0) e.push(err('type_case', 'Type de case inconnu.', refCase(c.id)));
      else if (c.type === 'apparition') nbAppar++;
    });
    var voulu = m.role === 'apparition' ? 1 : 0;
    if (nbAppar !== voulu) {
      e.push(err('cases_apparition', voulu
        ? 'Une tuile d\'apparition a exactement 1 case d\'apparition.'
        : 'Seule une tuile d\'apparition peut avoir une case d\'apparition.', refModele(m)));
    }
    return e;
  });

  // Géométrie des cases : diamètre, marge de coupe, chevauchement, zones de coin
  regles.push(function (m) {
    var e = [], cases = [];
    tab(m.cases).forEach(function (c) {
      if (estObjet(c) && estNombre(c.x) && estNombre(c.y) && estNombre(c.diametre) && c.diametre > 0) cases.push(c);
      else e.push(err('case_invalide', 'Position ou diamètre de case invalide.', refCase(estObjet(c) ? c.id : undefined)));
    });
    var marge = G.MARGE_COUPE_CASE;
    cases.forEach(function (c) {
      var r = c.diametre / 2;
      if (c.diametre > G.DIAMETRE_CASE_MAX + EPS) {
        e.push(err('diametre', 'Case trop grande (' + G.DIAMETRE_CASE_MAX + ' mm au plus).', refCase(c.id)));
      }
      if (c.x - r < marge - EPS || c.y - r < marge - EPS ||
          c.x + r > G.COTE - marge + EPS || c.y + r > G.COTE - marge + EPS) {
        e.push(err('hors_tuile', 'Case trop près du bord de la tuile (' + marge + ' mm de marge).', refCase(c.id)));
      }
      for (var k = 0; k < 4; k++) {
        var p = G.pointCoin(k);
        if (Math.hypot(c.x - p.x, c.y - p.y) < G.RAYON_ZONE_COIN + r - EPS) {
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

  // Chemins : extrémités, références, boucles, doublons, raccords utilisés une fois
  regles.push(function (m) {
    var e = [], ids = dict(), vus = dict(), raccordsUtilises = dict();
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
        if (typeExtremite(x) !== 'raccord') return;
        var k = cleExtremite(x);
        if (raccordsUtilises[k]) e.push(err('raccord_double', 'Un raccord est utilisé par deux chemins.', refRaccord(x.raccord, ch)));
        raccordsUtilises[k] = true;
      });
    });
    return e;
  });

  // Ports de coin : exactement les coins intérieurs ; un seul chemin par coin ; une case porte au plus un port
  regles.push(function (m) {
    var e = [], attendu = tableRole(PORTS_OBLIGATOIRES, m.role);
    if (attendu === undefined) return e;
    var present = masquesDuModele(m).portsCoin;
    for (var k = 0; k < 4; k++) {
      var a = (attendu >> k) & 1, p = (present >> k) & 1;
      if (a && !p) e.push(err('port_manquant', 'Il manque le port du coin ' + nomCoin(k) + '.', refCoin(k)));
      if (p && !a) e.push(err('port_interdit', 'Port sur un coin extérieur (' + nomCoin(k) + ').', refCoin(k)));
    }
    var parCoin = dict(), parCase = dict();
    tab(m.chemins).forEach(function (ch) {
      if (!estObjet(ch) || !extremiteValide(ch.a) || !extremiteValide(ch.b)) return;
      var ta = typeExtremite(ch.a), tb = typeExtremite(ch.b);
      if (ta === 'coin') parCoin[ch.a.coin] = (parCoin[ch.a.coin] || 0) + 1;
      if (tb === 'coin') parCoin[ch.b.coin] = (parCoin[ch.b.coin] || 0) + 1;
      if (ta === 'case' && tb === 'coin') parCase[ch.a['case']] = (parCase[ch.a['case']] || 0) + 1;
      if (tb === 'case' && ta === 'coin') parCase[ch.b['case']] = (parCase[ch.b['case']] || 0) + 1;
    });
    Object.keys(parCoin).forEach(function (k) {
      if (parCoin[k] > 1) e.push(err('coin_double', 'Un coin ne peut recevoir qu\'un seul chemin (coin ' + nomCoin(+k) + ').', refCoin(+k)));
    });
    Object.keys(parCase).forEach(function (id) {
      if (parCase[id] > 1) e.push(err('ports_case', 'Une case porte au plus un port de coin.', refCase(id)));
    });
    return e;
  });

  // Raccords : pas sur un côté extérieur ; assez de côtés non vides
  regles.push(function (m) {
    var e = [], ext = tableRole(COTES_EXTERIEURS, m.role);
    if (ext === undefined) return e;
    pourChaqueExtremite(m, function (x, t, ch) {
      if (t === 'raccord' && ext.indexOf(x.raccord.cote) >= 0) {
        e.push(err('raccord_exterieur', 'Raccord sur un côté extérieur (' + nomCote(x.raccord.cote) + ').', refRaccord(x.raccord, ch)));
      }
    });
    var n = nbCotesNonVides(masquesDuModele(m).raccords), mini = tableRole(MIN_COTES_RACCORD, m.role);
    if (n < mini) {
      e.push(err('cotes_raccord', 'Il faut des raccords sur au moins ' + mini + ' côtés (il y en a ' + n + ').', refModele(m)));
    }
    return e;
  });

  // Graphe interne connexe (arêtes = chemins case-case)
  regles.push(function (m) {
    var e = [], cases = [], parent = dict();
    tab(m.cases).forEach(function (c) { if (estObjet(c) && estId(c.id)) { cases.push(c); parent[c.id] = c.id; } });
    if (cases.length === 0) return e;
    function racine(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    tab(m.chemins).forEach(function (ch) {
      if (!estObjet(ch) || typeExtremite(ch.a) !== 'case' || typeExtremite(ch.b) !== 'case') return;
      if (parent[ch.a['case']] === undefined || parent[ch.b['case']] === undefined) return;
      parent[racine(ch.a['case'])] = racine(ch.b['case']);
    });
    var r0 = racine(cases[0].id);
    cases.forEach(function (c) {
      if (racine(c.id) !== r0) e.push(err('non_connexe', 'Cette case n\'est reliée aux autres par aucun chemin.', refCase(c.id)));
    });
    return e;
  });

  /**
   * Valide un modèle de tuile (orientation canonique). Ne lève jamais d'exception.
   * Renvoie { complet, erreurs: [{code, message, ref}] }.
   */
  function validerModele(modele) {
    var erreurs = [];
    if (!estObjet(modele)) {
      return { complet: false, erreurs: [err('modele_absent', 'Modèle absent.', { type: 'modele', id: undefined })] };
    }
    regles.forEach(function (r) {
      try { erreurs = erreurs.concat(r(modele)); } catch (ex) {
        erreurs.push(err('regle_en_erreur', 'Le modèle n\'a pas pu être vérifié (données inattendues).', refModele(modele)));
      }
    });
    return { complet: erreurs.length === 0, erreurs: erreurs };
  }

  /** Premier identifiant libre parmi les cases et chemins du modèle : prefixe + 1, 2, 3... */
  function nouvelId(modele, prefixe) {
    var pris = dict();
    tab(modele && modele.cases).concat(tab(modele && modele.chemins)).forEach(function (el) {
      if (estObjet(el) && typeof el.id === 'string') pris[el.id] = true;
    });
    prefixe = typeof prefixe === 'string' && prefixe ? prefixe : 'x';
    var k = 1;
    while (pris[prefixe + k]) k++;
    return prefixe + k;
  }


  /* ------------------------------------------------------------------ */
  /* Modèles d'exemple (orientation canonique, mm)                       */
  /* ------------------------------------------------------------------ */

  function construireExemples() {
    return [
      { // 4 cases aux quatre quarts, un port de coin par case
        id: 'ex-centrale', nom: 'Centrale en Z', role: 'centrale', exemplaires: 4,
        cases: [
          { id: 'c1', x: 36, y: 36, diametre: 24, type: 'deplacement' },
          { id: 'c2', x: 84, y: 36, diametre: 24, type: 'deplacement' },
          { id: 'c3', x: 84, y: 84, diametre: 24, type: 'deplacement' },
          { id: 'c4', x: 36, y: 84, diametre: 24, type: 'deplacement' }
        ],
        chemins: [
          { id: 'h1', a: { 'case': 'c1' }, b: { 'case': 'c2' } },
          { id: 'h2', a: { 'case': 'c2' }, b: { 'case': 'c3' } },
          { id: 'h3', a: { 'case': 'c3' }, b: { 'case': 'c4' } },
          { id: 'p1', a: { 'case': 'c1' }, b: { coin: 0 } },
          { id: 'p2', a: { 'case': 'c2' }, b: { coin: 1 } },
          { id: 'p3', a: { 'case': 'c3' }, b: { coin: 2 } },
          { id: 'p4', a: { 'case': 'c4' }, b: { coin: 3 } },
          { id: 'r1', a: { 'case': 'c1' }, b: { raccord: { cote: 0, pos: 0 } } },
          { id: 'r2', a: { 'case': 'c2' }, b: { raccord: { cote: 1, pos: 1 } } },
          { id: 'r3', a: { 'case': 'c3' }, b: { raccord: { cote: 2, pos: 1 } } },
          { id: 'r4', a: { 'case': 'c4' }, b: { raccord: { cote: 3, pos: 1 } } }
        ]
      },
      { // côtés extérieurs N et O ; port au coin SE
        id: 'ex-coin', nom: 'Coin simple', role: 'coin', exemplaires: 4,
        cases: [
          { id: 'c1', x: 85, y: 85, diametre: 24, type: 'deplacement' },
          { id: 'c2', x: 85, y: 40, diametre: 24, type: 'deplacement' },
          { id: 'c3', x: 40, y: 85, diametre: 24, type: 'deplacement' }
        ],
        chemins: [
          { id: 'h1', a: { 'case': 'c1' }, b: { 'case': 'c2' } },
          { id: 'h2', a: { 'case': 'c1' }, b: { 'case': 'c3' } },
          { id: 'p1', a: { 'case': 'c1' }, b: { coin: 2 } },
          { id: 'r1', a: { 'case': 'c2' }, b: { raccord: { cote: 1, pos: 1 } } },
          { id: 'r2', a: { 'case': 'c3' }, b: { raccord: { cote: 2, pos: 1 } } }
        ]
      },
      { // côté extérieur au N ; ports aux coins SE et SO
        id: 'ex-bord', nom: 'Bord en V', role: 'bord', exemplaires: 4,
        cases: [
          { id: 'c1', x: 90, y: 90, diametre: 24, type: 'deplacement' },
          { id: 'c2', x: 30, y: 90, diametre: 24, type: 'deplacement' },
          { id: 'c3', x: 60, y: 40, diametre: 24, type: 'deplacement' }
        ],
        chemins: [
          { id: 'h1', a: { 'case': 'c1' }, b: { 'case': 'c3' } },
          { id: 'h2', a: { 'case': 'c2' }, b: { 'case': 'c3' } },
          { id: 'p1', a: { 'case': 'c1' }, b: { coin: 2 } },
          { id: 'p2', a: { 'case': 'c2' }, b: { coin: 3 } },
          { id: 'r1', a: { 'case': 'c1' }, b: { raccord: { cote: 1, pos: 1 } } },
          { id: 'r2', a: { 'case': 'c2' }, b: { raccord: { cote: 3, pos: 1 } } },
          { id: 'r3', a: { 'case': 'c3' }, b: { raccord: { cote: 2, pos: 1 } } }
        ]
      },
      { // comme le bord, avec la case d'apparition au centre haut
        id: 'ex-apparition', nom: 'Apparition', role: 'apparition', exemplaires: 4,
        cases: [
          { id: 'c1', x: 90, y: 90, diametre: 24, type: 'deplacement' },
          { id: 'c2', x: 30, y: 90, diametre: 24, type: 'deplacement' },
          { id: 'c3', x: 60, y: 40, diametre: 24, type: 'apparition' }
        ],
        chemins: [
          { id: 'h1', a: { 'case': 'c1' }, b: { 'case': 'c3' } },
          { id: 'h2', a: { 'case': 'c2' }, b: { 'case': 'c3' } },
          { id: 'p1', a: { 'case': 'c1' }, b: { coin: 2 } },
          { id: 'p2', a: { 'case': 'c2' }, b: { coin: 3 } },
          { id: 'r1', a: { 'case': 'c1' }, b: { raccord: { cote: 1, pos: 1 } } },
          { id: 'r2', a: { 'case': 'c2' }, b: { raccord: { cote: 3, pos: 1 } } }
        ]
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
  /* Forme du plateau, rôles et rotations                                */
  /* Convention : une cellule est (col, lig) ; une jonction est (i, j)   */
  /* avec i = colonne et j = ligne des coins de cellules (1..3).         */
  /* ------------------------------------------------------------------ */

  var NC = G.GRILLE.colonnes, NL = G.GRILLE.lignes;

  function dansGrille(col, lig) {
    return estEntier(col) && estEntier(lig) && col >= 0 && col < NC && lig >= 0 && lig < NL;
  }
  function estCoinGrille(col, lig) {
    return (col === 0 || col === NC - 1) && (lig === 0 || lig === NL - 1);
  }
  function estRetiree(col, lig, forme) {
    return tab(forme && forme.retires).some(function (r) { return !!r && r.col === col && r.lig === lig; });
  }
  /** Cellule d'apparition : colonnes intérieures de la rangée nord (J1) ou sud (J2). */
  function estApparition(col, lig) {
    return (lig === 0 || lig === NL - 1) && col >= 1 && col <= NC - 2;
  }

  /**
   * Valide la forme : vide, 1 ou 2 coins retirés, ou 1 coin et le bord est / ouest
   * voisin dans la même colonne. Ne lève jamais d'exception.
   * Renvoie { valide, erreurs: [{code, message}] }.
   */
  function validerForme(forme) {
    var erreurs = [];
    function ajouter(code, message) { erreurs.push({ code: code, message: message }); }
    if (forme !== null && forme !== undefined &&
        (!estObjet(forme) || (forme.retires !== undefined && !Array.isArray(forme.retires)))) {
      ajouter('forme_invalide', 'La forme du plateau est mal formée.');
      return { valide: false, erreurs: erreurs };
    }
    var retires = tab(forme && forme.retires);
    var i, j;
    for (i = 0; i < retires.length; i++) {
      if (!estObjet(retires[i]) || !estNombre(retires[i].col) || !estNombre(retires[i].lig)) {
        ajouter('retrait_invalide', 'Une cellule retirée est mal décrite.');
      } else if (!dansGrille(retires[i].col, retires[i].lig)) {
        ajouter('hors_grille', 'Une cellule retirée est hors de la grille.');
      }
    }
    if (erreurs.length) return { valide: false, erreurs: erreurs };
    for (i = 0; i < retires.length; i++) {
      for (j = i + 1; j < retires.length; j++) {
        if (retires[i].col === retires[j].col && retires[i].lig === retires[j].lig) ajouter('doublon', 'Une cellule est retirée deux fois.');
      }
    }
    if (erreurs.length) return { valide: false, erreurs: erreurs };
    if (retires.length > 2) {
      ajouter('trop_de_retraits', 'On retire au plus 2 cellules.');
      return { valide: false, erreurs: erreurs };
    }
    retires.forEach(function (r) {
      if (estCoinGrille(r.col, r.lig)) return;
      if (estApparition(r.col, r.lig)) {
        ajouter('apparition_retiree', 'Une cellule d\'apparition ne peut pas être retirée.');
      } else if (r.col >= 1 && r.col <= NC - 2) {
        ajouter('cellule_interieure', 'Une cellule centrale ne peut pas être retirée.');
      } else {
        // bord est / ouest : seul le bord voisin d'un coin retiré est admis
        var ligCoin = r.lig <= 1 ? 0 : NL - 1;
        if (!estRetiree(r.col, ligCoin, forme)) {
          ajouter('bord_seul', 'Un bord ne peut être retiré qu\'avec le coin voisin.');
        }
      }
    });
    if (!erreurs.length) {
      cellulesActives(forme).forEach(function (c) {
        if (roleCellule(c.col, c.lig, forme) === null) {
          ajouter('role_impossible', 'La cellule (' + c.col + ', ' + c.lig + ') n\'a pas de rôle possible.');
        }
      });
    }
    return { valide: erreurs.length === 0, erreurs: erreurs };
  }

  /** Cellules présentes dans la forme, ordre lignes puis colonnes. */
  function cellulesActives(forme) {
    var res = [];
    for (var lig = 0; lig < NL; lig++) {
      for (var col = 0; col < NC; col++) {
        if (!estRetiree(col, lig, forme)) res.push({ col: col, lig: lig });
      }
    }
    return res;
  }

  /** Côtés d'une cellule dont le voisin est hors grille ou retiré. */
  function cotesExposes(col, lig, forme) {
    var res = [];
    for (var c = 0; c < 4; c++) {
      var d = G.coteVoisin(c), vc = col + d.dc, vl = lig + d.dl;
      if (!dansGrille(vc, vl) || estRetiree(vc, vl, forme)) res.push(c);
    }
    return res;
  }

  /**
   * Rôle attendu d'une cellule, ou null (hors grille, retirée, ou aucun modèle possible).
   * Apparitions : fixes. Sinon selon les côtés exposés : 0 centrale, 1 bord, 2 adjacents coin.
   */
  function roleCellule(col, lig, forme) {
    if (!dansGrille(col, lig) || estRetiree(col, lig, forme)) return null;
    if (estApparition(col, lig)) return 'apparition';
    var ex = cotesExposes(col, lig, forme);
    if (ex.length === 0) return 'centrale';
    if (ex.length === 1) return 'bord';
    if (ex.length === 2 && (ex[1] - ex[0] === 1 || (ex[0] === 0 && ex[1] === 3))) return 'coin';
    return null;
  }

  /** Joueur d'une cellule d'apparition (1 au nord, 2 au sud), null sinon. Le camp se déduit de la cellule. */
  function joueurCellule(col, lig) {
    if (!estApparition(col, lig)) return null;
    return lig === 0 ? 1 : 2;
  }

  /** Rotation imposée (entier 0..3) d'une cellule coin / bord / apparition ; null pour une centrale ou une cellule sans rôle. */
  function rotationDeduite(col, lig, forme) {
    var role = roleCellule(col, lig, forme);
    if (role === null || role === 'centrale') return null;
    if (role === 'apparition') return joueurCellule(col, lig) === 1 ? 0 : 2;
    var ex = cotesExposes(col, lig, forme);
    if (role === 'bord') return ex[0];
    // coin : côtés exposés {rot + 3, rot} (canonique N et O pour rot 0)
    return (ex[0] === 0 && ex[1] === 3) ? 0 : ex[1];
  }

  /** Jonction (i, j) = (colonne, ligne) touchée par le coin k de la cellule (col, lig). */
  function jonctionDuCoin(col, lig, k) {
    return [{ i: col, j: lig }, { i: col + 1, j: lig }, { i: col + 1, j: lig + 1 }, { i: col, j: lig + 1 }][k];
  }

  var AUTOUR_JONCTION = [
    { dc: -1, dl: -1, coin: 2 }, { dc: 0, dl: -1, coin: 3 },
    { dc: -1, dl: 0, coin: 1 }, { dc: 0, dl: 0, coin: 0 }
  ];

  /**
   * Camp d'une jonction (règle unique, docs/11-revue-interface.md I3) : 1 pour la rangée de jonctions nord
   * (j = 1, camp J1), 2 pour la rangée sud (j = NL - 1, camp J2), null pour la rangée du milieu ou une valeur
   * invalide. `i` n'intervient pas (les colonnes ouest / est ne sont pas des camps) ; jamais d'exception.
   */
  function campJonction(i, j) {
    if (j === 1) return 1;
    if (j === NL - 1) return 2;
    return null;
  }

  /** Plafond du stock exporté ou tiré par le générateur : somme des exemplaires des modèles complets. */
  var PLAFOND_TUILES = 200;

  /** Nombre d'exemplaires d'un modèle, lu d'une seule façon : entier ≥ 0, sinon 0. */
  function exemplairesValides(modele) {
    var n = modele && typeof modele === 'object' ? modele.exemplaires : undefined;
    return estEntier(n) && n >= 0 ? n : 0;
  }

  function jonctionInterieure(i, j) {
    return estEntier(i) && estEntier(j) && i >= 1 && i <= NC - 1 && j >= 1 && j <= NL - 1;
  }

  /**
   * Une jonction peut-elle un jour recevoir un jeton avec cette forme ? Il faut ses
   * 4 cellules actives et au moins MIN_PORTS_JONCTION ports possibles (ports obligatoires
   * des rôles déduits, après rotation).
   */
  function jonctionPossible(forme, i, j) {
    if (!jonctionInterieure(i, j)) return false;
    var ports = 0;
    for (var n = 0; n < AUTOUR_JONCTION.length; n++) {
      var a = AUTOUR_JONCTION[n], col = i + a.dc, lig = j + a.dl;
      var role = roleCellule(col, lig, forme);
      if (role === null) return false;
      var rot = rotationDeduite(col, lig, forme);
      var masque = G.tournerPorts(tableRole(PORTS_OBLIGATOIRES, role), rot === null ? 0 : rot);
      if ((masque >> a.coin) & 1) ports++;
    }
    return ports >= G.MIN_PORTS_JONCTION;
  }

  /* ------------------------------------------------------------------ */
  /* Document et plateau (fonctions pures)                               */
  /* ------------------------------------------------------------------ */

  function nouveauDocument() {
    return { version: 1, modeles: [], plateau: { forme: { retires: [] }, tuiles: [], jetons: [] } };
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
  function exemplairesRestants(doc, modeleId) {
    var m = modeleParId(doc, modeleId);
    if (!m) return 0;
    return m.exemplaires - nbPosees(doc, modeleId);
  }

  /** Masques d'une tuile posée, après rotation : { raccords, portsCoin }. */
  function masquesTuilePosee(doc, tuile) {
    var m = modeleParId(doc, tuile.modeleId);
    if (!m) return { raccords: 0, portsCoin: 0 };
    var mm = masquesDuModele(m);
    return { raccords: G.tournerRaccords(mm.raccords, tuile.rot), portsCoin: G.tournerPorts(mm.portsCoin, tuile.rot) };
  }

  /** Teste la pose d'une tuile. Renvoie { ok, raison, rot }. Refuse tant que la forme est invalide. */
  function peutPoserTuile(doc, modeleId, col, lig) {
    var forme = doc.plateau.forme;
    function non(raison) { return { ok: false, raison: raison, rot: 0 }; }
    var modele = modeleParId(doc, modeleId);
    if (!modele) return non('Modèle de tuile introuvable.');
    if (!validerForme(forme).valide) return non('La forme du plateau est invalide.');
    if (!dansGrille(col, lig)) return non('Cette cellule est hors de la grille.');
    if (estRetiree(col, lig, forme)) return non('Cette cellule est retirée du plateau.');
    if (tuileEn(doc, col, lig)) return non('Cette cellule est déjà occupée.');
    var attendu = roleCellule(col, lig, forme);
    if (attendu === null) return non('Aucune tuile ne convient à cette cellule.');
    if (modele.role !== attendu) {
      return non('Cette tuile est ' + LIBELLE_ROLE[modele.role] + ', la cellule attend ' + LIBELLE_ROLE[attendu] + '.');
    }
    if (!validerModele(modele).complet) return non('Ce modèle est incomplet.');
    if (exemplairesRestants(doc, modeleId) <= 0) return non('Il ne reste plus d\'exemplaire de cette tuile.');
    var rot = rotationDeduite(col, lig, forme);
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

  /** Pose une tuile (pure). Lève une Error avec la raison si la pose est refusée. */
  function poserTuile(doc, modeleId, col, lig) {
    var test = peutPoserTuile(doc, modeleId, col, lig);
    if (!test.ok) throw new Error(test.raison);
    var nouveau = clone(doc);
    nouveau.plateau.tuiles.push({ modeleId: modeleId, col: col, lig: lig, rot: test.rot });
    return nouveau;
  }

  /** Retire la tuile de la cellule (pure) ; retire aussi les jetons devenus invalides. */
  function retirerTuile(doc, col, lig) {
    var nouveau = clone(doc);
    nouveau.plateau.tuiles = nouveau.plateau.tuiles.filter(function (t) { return !(t.col === col && t.lig === lig); });
    return nettoyerJetons(nouveau);
  }

  /**
   * Tourne une tuile centrale de `quarts` quarts de tour horaires (pure), entier (1 par défaut).
   * Lève une Error si `quarts` n'est pas un entier, ou si la tuile est absente ou non centrale.
   */
  function tournerTuile(doc, col, lig, quarts) {
    if (quarts === undefined) quarts = 1;
    if (!estEntier(quarts)) throw new Error('Le nombre de quarts de tour doit être un entier.');
    var t = tuileEn(doc, col, lig);
    if (!t) throw new Error('Aucune tuile dans cette cellule.');
    var m = modeleParId(doc, t.modeleId);
    if (!m || m.role !== 'centrale') throw new Error('Seules les tuiles centrales peuvent tourner.');
    var nouveau = clone(doc);
    var nt = tuileEn(nouveau, col, lig);
    nt.rot = (((nt.rot + quarts) % 4) + 4) % 4;
    return nettoyerJetons(nouveau);
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

  /** Raison pour laquelle la jonction ne peut pas accueillir de jeton (hors occupation), ou null. */
  function raisonJonction(doc, i, j) {
    if (!jonctionInterieure(i, j)) return 'Ce n\'est pas une jonction intérieure.';
    var p = portsJonction(doc, i, j);
    if (p.tuiles < 4) return 'Il faut 4 tuiles autour de la jonction (' + p.tuiles + ' posées).';
    if (p.ports < G.MIN_PORTS_JONCTION) {
      return 'Il faut au moins ' + G.MIN_PORTS_JONCTION + ' ports à la jonction (' + p.ports + ').';
    }
    return null;
  }

  /** Teste la pose d'un jeton sur la jonction (i, j) = (colonne, ligne). Renvoie { ok, raison }. */
  function peutPoserJeton(doc, i, j) {
    if (!jonctionInterieure(i, j)) return { ok: false, raison: 'Ce n\'est pas une jonction intérieure.' };
    if (jetonEn(doc, i, j)) return { ok: false, raison: 'Cette jonction a déjà un jeton.' };
    var raison = raisonJonction(doc, i, j);
    return raison ? { ok: false, raison: raison } : { ok: true, raison: '' };
  }

  /** Pose un jeton (pure), type 'capture' par défaut. Lève une Error si refusé. */
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

  /** Vide -> capture -> carrefour -> vide (pure). Lève une Error si la pose initiale est refusée. */
  function cyclerJeton(doc, i, j) {
    var jeton = jetonEn(doc, i, j);
    if (!jeton) return poserJeton(doc, i, j, 'capture');
    if (jeton.type === 'capture') {
      var nouveau = clone(doc);
      jetonEn(nouveau, i, j).type = 'carrefour';
      return nouveau;
    }
    return retirerJeton(doc, i, j);
  }

  /**
   * Jetons qui ne respectent plus les conditions de pose : [{ i, j, type, raison }].
   * (retirerTuile, tournerTuile et changerForme les retirent automatiquement.)
   */
  function jetonsInvalides(doc) {
    var res = [], vus = dict();
    tab(doc.plateau.jetons).forEach(function (j) {
      if (!estObjet(j)) { res.push({ i: undefined, j: undefined, type: undefined, raison: 'Jeton mal formé.' }); return; }
      var raison = null, cle = j.i + ',' + j.j;
      if (TYPES_JETON.indexOf(j.type) < 0) raison = 'Type de jeton inconnu.';
      else if (vus[cle]) raison = 'Deux jetons sur la même jonction.';
      else raison = raisonJonction(doc, j.i, j.j);
      vus[cle] = true;
      if (raison) res.push({ i: j.i, j: j.j, type: j.type, raison: raison });
    });
    return res;
  }

  /**
   * Raccords sans vis-à-vis : [{ col, lig, cote, pos, raison }] (côté dans le repère du plateau).
   * raison : 'absent' = cellule active pas encore posée ; 'vide' = cellule retirée ou hors grille ;
   * 'mort' = voisin posé sans raccord en face.
   */
  function raccordsMorts(doc) {
    var res = [], forme = doc.plateau.forme;
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
          raison = (!dansGrille(vc, vl) || estRetiree(vc, vl, forme)) ? 'vide' : 'absent';
        }
        for (var pos = 0; pos < 3; pos++) {
          if ((morts >> pos) & 1) res.push({ col: t.col, lig: t.lig, cote: cote, pos: pos, raison: raison });
        }
      }
    });
    return res;
  }

  /**
   * Ports de coin qui ne mèneront jamais à un jeton (jonction hors plateau ou impossible avec la forme) :
   * [{ col, lig, coin, i, j }] (coin dans le repère du plateau, après rotation).
   */
  function portsCoinMorts(doc) {
    var res = [], forme = doc.plateau.forme;
    doc.plateau.tuiles.forEach(function (t) {
      var ports = masquesTuilePosee(doc, t).portsCoin;
      for (var k = 0; k < 4; k++) {
        if (!((ports >> k) & 1)) continue;
        var jn = jonctionDuCoin(t.col, t.lig, k);
        if (!jonctionPossible(forme, jn.i, jn.j)) res.push({ col: t.col, lig: t.lig, coin: k, i: jn.i, j: jn.j });
      }
    });
    return res;
  }

  /**
   * Éléments d'une tuile posée en repère plateau (mm), pour le graphe global :
   * { cases: [{ id, x, y, diametre, type, joueur }], aretes: [[idA, idB]],
   *   raccords: [{ cote, pos, caseId }], ports: [{ coin, caseId, i, j }] }.
   * Les ids de case sont globaux (« col,lig:idLocal »). Renvoie null si le modèle est absent.
   * Le raccord (cote, pos) d'une tuile fait face au raccord PM.geometrie.raccordEnFace(cote, pos) du voisin.
   */
  function tuileEnPlateau(doc, tuile) {
    var m = modeleParId(doc, tuile.modeleId);
    if (!m) return null;
    var rot = ((tuile.rot % 4) + 4) % 4;
    function gid(id) { return tuile.col + ',' + tuile.lig + ':' + id; }
    var res = { cases: [], aretes: [], raccords: [], ports: [] };
    tab(m.cases).forEach(function (c) {
      if (!estObjet(c)) return;
      var p = G.tournerPoint({ x: c.x, y: c.y }, rot);
      res.cases.push({
        id: gid(c.id), x: p.x + tuile.col * G.COTE, y: p.y + tuile.lig * G.COTE, diametre: c.diametre, type: c.type,
        joueur: c.type === 'apparition' ? joueurCellule(tuile.col, tuile.lig) : null
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
    return res;
  }

  /** Erreurs d'une tuile posée : [{ code, message, ref: {type:'tuile', col, lig} }] ([] si elle est correcte). */
  function verifierTuilePosee(doc, tuile) {
    var e = [], ref = { type: 'tuile', col: tuile.col, lig: tuile.lig }, forme = doc.plateau.forme;
    var m = modeleParId(doc, tuile.modeleId);
    if (!m) e.push(err('modele_absent', 'Le modèle de cette tuile n\'existe plus.', ref));
    else if (!validerModele(m).complet) e.push(err('modele_incomplet', 'Le modèle de cette tuile est incomplet.', ref));
    if (!dansGrille(tuile.col, tuile.lig)) {
      e.push(err('hors_grille', 'Cette tuile est hors de la grille.', ref));
    } else if (estRetiree(tuile.col, tuile.lig, forme)) {
      e.push(err('cellule_retiree', 'Cette tuile est sur une cellule retirée.', ref));
    } else {
      var attendu = roleCellule(tuile.col, tuile.lig, forme);
      if (attendu === null) e.push(err('role_impossible', 'Aucune tuile ne convient à cette cellule.', ref));
      else if (m && m.role !== attendu) {
        e.push(err('role_incorrect', 'Cette tuile est ' + LIBELLE_ROLE[m.role] + ', la cellule attend ' + LIBELLE_ROLE[attendu] + '.', ref));
      }
      if (!estEntier(tuile.rot) || tuile.rot < 0 || tuile.rot > 3) {
        e.push(err('rot_invalide', 'La rotation doit être un entier de 0 à 3.', ref));
      } else {
        var rotAttendue = rotationDeduite(tuile.col, tuile.lig, forme);
        if (rotAttendue !== null && tuile.rot !== rotAttendue) {
          e.push(err('rot_incorrecte', 'La rotation de cette tuile ne correspond pas à sa cellule.', ref));
        }
      }
    }
    var memeCellule = doc.plateau.tuiles.filter(function (t) { return t && t.col === tuile.col && t.lig === tuile.lig; });
    if (memeCellule.length > 1) e.push(err('doublon', 'Plusieurs tuiles occupent cette cellule.', ref));
    return e;
  }

  /**
   * Revalide tout le plateau : { erreurs, alertes }, éléments { code, message, ref }.
   * erreurs : forme, tuiles (verifierTuilePosee), exemplaires dépassés, jetons invalides.
   * alertes : raccords morts ou face au vide, ports de coin morts (n'empêchent rien).
   */
  function validerPlateau(doc) {
    var erreurs = [], alertes = [];
    validerForme(doc.plateau.forme).erreurs.forEach(function (x) {
      erreurs.push(err(x.code, x.message, { type: 'forme' }));
    });
    doc.plateau.tuiles.forEach(function (t) { erreurs = erreurs.concat(verifierTuilePosee(doc, t)); });
    tab(doc.modeles).forEach(function (m) {
      if (!m) return;
      var n = nbPosees(doc, m.id);
      if (n > m.exemplaires) {
        erreurs.push(err('exemplaires_depasses', 'Le modèle « ' + (m.nom || m.id) + ' » est posé ' + n + ' fois pour ' + m.exemplaires + ' exemplaire(s).', refModele(m)));
      }
    });
    jetonsInvalides(doc).forEach(function (j) {
      erreurs.push(err('jeton_invalide', j.raison, { type: 'jeton', i: j.i, j: j.j }));
    });
    raccordsMorts(doc).forEach(function (r) {
      if (r.raison === 'absent') return;
      alertes.push(err('raccord_mort', r.raison === 'vide' ? 'Raccord face au vide.' : 'Raccord sans vis-à-vis.',
        { type: 'raccord', col: r.col, lig: r.lig, cote: r.cote, pos: r.pos }));
    });
    portsCoinMorts(doc).forEach(function (p) {
      alertes.push(err('port_mort', 'Port de coin vers une jonction qui ne peut pas recevoir de jeton.',
        { type: 'coin', col: p.col, lig: p.lig, coin: p.coin, i: p.i, j: p.j }));
    });
    return { erreurs: erreurs, alertes: alertes };
  }

  /**
   * Change la forme (pure). Retire les tuiles des cellules retirées, recalcule la rotation
   * des tuiles non centrales et retire les jetons invalides. Lève une Error si la forme est invalide.
   * Les tuiles dont le rôle ne correspond plus restent en place : validerPlateau les signale.
   */
  function changerForme(doc, forme) {
    var v = validerForme(forme);
    if (!v.valide) throw new Error(v.erreurs[0].message);
    var nouveau = clone(doc);
    nouveau.plateau.forme = { retires: clone(tab(forme && forme.retires)) };
    nouveau.plateau.tuiles = nouveau.plateau.tuiles.filter(function (t) {
      return !estRetiree(t.col, t.lig, nouveau.plateau.forme);
    });
    nouveau.plateau.tuiles.forEach(function (t) {
      var rot = rotationDeduite(t.col, t.lig, nouveau.plateau.forme);
      if (rot !== null) t.rot = rot;
    });
    return nettoyerJetons(nouveau);
  }

  /** Ajoute un modèle (pure, copie). Lève une Error si l'id est invalide ou déjà pris. */
  function ajouterModele(doc, modele) {
    if (!estObjet(modele) || !estId(modele.id)) throw new Error('Le modèle doit avoir un identifiant (texte non vide).');
    if (modeleParId(doc, modele.id)) throw new Error('Un modèle porte déjà l\'identifiant « ' + modele.id + ' ».');
    var nouveau = clone(doc);
    nouveau.modeles.push(clone(modele));
    return nouveau;
  }

  /**
   * Remplace le modèle `id` (pure). Même id obligatoire. Refus si le modèle est posé et que son rôle change.
   * Les jetons devenus invalides sont retirés.
   */
  function remplacerModele(doc, id, modele) {
    var ancien = modeleParId(doc, id);
    if (!ancien) throw new Error('Modèle de tuile introuvable.');
    if (!estObjet(modele) || modele.id !== id) throw new Error('Le modèle de remplacement doit garder le même identifiant.');
    if (nbPosees(doc, id) > 0 && modele.role !== ancien.role) {
      throw new Error('Ce modèle est posé sur le plateau : son rôle ne peut pas changer.');
    }
    var nouveau = clone(doc);
    nouveau.modeles = nouveau.modeles.map(function (m) { return m && m.id === id ? clone(modele) : m; });
    return nettoyerJetons(nouveau);
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

  /** Change le nombre d'exemplaires (pure). Lève une Error si n n'est pas un entier ≥ nombre de tuiles posées. */
  function changerExemplaires(doc, id, n) {
    if (!modeleParId(doc, id)) throw new Error('Modèle de tuile introuvable.');
    if (!estEntier(n) || n < 0) throw new Error('Le nombre d\'exemplaires doit être un entier positif ou nul.');
    var posees = nbPosees(doc, id);
    if (n < posees) throw new Error('Il y a déjà ' + posees + ' tuile(s) posée(s) de ce modèle : retirez-en d\'abord.');
    var nouveau = clone(doc);
    modeleParId(nouveau, id).exemplaires = n;
    return nouveau;
  }

  var EXEMPLES = geler(construireExemples());

  PM.modele = {
    ROLES: ROLES,
    NB_CASES_PAR_ROLE: NB_CASES_PAR_ROLE,
    COTES_EXTERIEURS: COTES_EXTERIEURS,
    PORTS_OBLIGATOIRES: PORTS_OBLIGATOIRES,
    regles: regles,
    masquesDuModele: masquesDuModele,
    validerModele: validerModele,
    nouvelId: nouvelId,
    exemples: EXEMPLES,                                      // tableau gelé (lecture seule)
    copieExemples: function () { return clone(EXEMPLES); },  // copie modifiable
    validerForme: validerForme,
    cellulesActives: cellulesActives,
    roleCellule: roleCellule,
    joueurCellule: joueurCellule,
    rotationDeduite: rotationDeduite,
    jonctionDuCoin: jonctionDuCoin,
    jonctionPossible: jonctionPossible,
    campJonction: campJonction,
    PLAFOND_TUILES: PLAFOND_TUILES,
    exemplairesValides: exemplairesValides,
    nouveauDocument: nouveauDocument,
    clonerDocument: clonerDocument,
    modeleParId: modeleParId,
    tuileEn: tuileEn,
    exemplairesRestants: exemplairesRestants,
    masquesTuilePosee: masquesTuilePosee,
    peutPoserTuile: peutPoserTuile,
    poserTuile: poserTuile,
    retirerTuile: retirerTuile,
    tournerTuile: tournerTuile,
    verifierTuilePosee: verifierTuilePosee,
    validerPlateau: validerPlateau,
    changerForme: changerForme,
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
    portsCoinMorts: portsCoinMorts,
    tuileEnPlateau: tuileEnPlateau
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.modele;
})();
