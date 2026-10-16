/*
 * generateur.js : plateau aléatoire (sous-agent 8, adapté aux règles de la version 2).
 *
 * Partie calcul (generer) : fonction pure, sans DOM, testée sous Node.
 * Partie interface (ouvrir) : remplit la boîte de dialogue commune PM.dialogue.
 *
 * Règles appliquées (règles v2, docs/18 à docs/20 ; vérifié sur le catalogue v2, docs/21) :
 *  - grille pleine du format du document (4×4 ou 5×5) ;
 *  - tuiles tirées dans la bibliothèque du document (modèles complets, selon leurs exemplaires), selon le
 *    gabarit attendu à chaque position ; rotation suggérée des bords et coins, rotation aléatoire des centrales ;
 *  - 7 villes sur les jonctions intérieures, les autres jonctions sont des cases chemin (jonctions-cases) : en 4×4,
 *    par défaut les 2 jonctions-cases sont dans la rangée centrale (aucun « 5 contre 2 », docs/22), avec l'option
 *    « jonctions variées » elles sont libres sauf deux dans une même rangée extérieure ; 5×5 : villes tirées librement ;
 *  - stock plafonné à PM.modele.PLAFOND_TUILES tuiles (somme des exemplaires des modèles complets) ;
 *  - villes non traversables (règle du jeu) ;
 *  - élimination : validerPlateau avec erreur, graphe non connexe, camp sans case d'apparition, deux villes
 *    à moins de 3 cases (jamais produit, docs/18), ville inaccessible, plateau très déséquilibré (« 5 contre 2 »,
 *    écart > SEUIL_BLOCAGE_ECART), écart > 2 à un rang de 1 à 7, première ville à des distances différentes ;
 *  - classement par S = Σ |D1(k) − D2(k)| sur les 7 rangs, puis pénalité secondaire (raccords morts au-delà
 *    de 2, jonctions à moins de 2 ports, cases d'apparition à moins de 2 sorties) ;
 *  - tirage au hasard parmi les bons (S ≤ Smin + tolérance, 1 par défaut ; pénalité minimale à S égal).
 *
 * Graine : texte ou nombre ; même graine + même bibliothèque + mêmes options = même plateau.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.graphe && typeof require === 'function') require('./graphe.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele, GR = PM.graphe;

  // Constantes du critère d'équilibre : celles de PM.graphe (une seule définition)
  var NB_VILLES = GR.NB_VILLES;
  var SEUIL_ECART = GR.SEUIL_ECART;  // écart toléré à chaque rang (doc 16, b)
  var CANDIDATS_DEFAUT = 200;
  var FACTEUR_ESSAIS = 5;         // essais maximaux = candidats × 5
  var TOLERANCE_DEFAUT = 1;       // bons candidats : S ≤ Smin + tolérance (1 : garde de l'aléa)
  var RACCORDS_TOLERES = 2;       // raccords morts tolérés sans pénalité
  var LIBELLES_GABARIT = { centrale: 'centrale(s)', bord: 'bord(s)', coin: 'coin(s)' };

  /* ------------------------------------------------------------------ */
  /* Hasard reproductible                                                */
  /* ------------------------------------------------------------------ */

  /** Hachage FNV-1a 32 bits d'un texte (graine texte → entier). */
  function hacher(texte) {
    var h = 0x811c9dc5;
    for (var k = 0; k < texte.length; k++) {
      h ^= texte.charCodeAt(k);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** Générateur pseudo-aléatoire mulberry32 (même suite pour le même entier). */
  function mulberry32(graine) {
    var a = graine >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Nouvelle graine (seul usage de Math.random) : 6 chiffres. */
  function nouvelleGraine() {
    return String(100000 + Math.floor(Math.random() * 900000));
  }

  function entier(rng, n) { return Math.floor(rng() * n); }

  function melanger(t, rng) {
    t = t.slice();
    for (var i = t.length - 1; i > 0; i--) {
      var j = entier(rng, i + 1), x = t[i];
      t[i] = t[j]; t[j] = x;
    }
    return t;
  }

  /* ------------------------------------------------------------------ */
  /* Jonctions et villes                                                 */
  /* ------------------------------------------------------------------ */

  /** Jonctions intérieures d'un format, rangée par rangée (j puis i) : cet ordre fixe le tirage pour une graine. */
  function jonctionsInterieures(F) {
    var res = [];
    for (var j = 1; j < F.GRILLE.lignes; j++) for (var i = 1; i < F.GRILLE.colonnes; i++) res.push({ i: i, j: j });
    return res;
  }

  /**
   * Paires de jonctions-cases (les 2 jonctions sans ville) que le générateur peut tirer, propres à chaque format
   * (docs/22). Renvoie null quand le format n'a pas de règle (5×5 : 7 villes tirées librement parmi les jonctions).
   *  - par défaut (4×4) : les 3 paires de la rangée centrale (j = 2), qui ne donnent jamais « 5 contre 2 » ;
   *  - jonctions variées (4×4) : toutes les paires sauf celles d'une même rangée extérieure (j = 1 ou j = 3).
   * Chaque paire est [{i, j}, {i, j}] dans l'ordre de lecture.
   */
  function pairesJonctionsCases(F, variees) {
    if (F.id !== '4x4') return null;
    var jonctions = jonctionsInterieures(F), paires = [];
    for (var a = 0; a < jonctions.length; a++) {
      for (var b = a + 1; b < jonctions.length; b++) {
        var p = jonctions[a], q = jonctions[b];
        var memeRangee = p.j === q.j;
        if (variees ? !(memeRangee && (p.j === 1 || p.j === F.GRILLE.lignes - 1)) : (memeRangee && p.j === 2)) paires.push([p, q]);
      }
    }
    return paires;
  }

  /**
   * 7 villes (ordre de lecture du plateau) : si `paires` est donné, une paire est tirée comme jonctions-cases et
   * les 7 autres jonctions portent une ville ; sinon 7 jonctions tirées au hasard. Renvoie { villes, casesChemin }.
   */
  function tirerVilles(jonctions, rng, paires) {
    var choisies;
    if (paires && paires.length) {
      var paire = paires[entier(rng, paires.length)];
      choisies = jonctions.filter(function (jn) { return !paire.some(function (c) { return c.i === jn.i && c.j === jn.j; }); });
    } else {
      choisies = melanger(jonctions, rng).slice(0, NB_VILLES);
    }
    return choisies.sort(function (a, b) { return (a.j - b.j) || (a.i - b.i); })
      .map(function (jn) { return { i: jn.i, j: jn.j, type: 'capture' }; });
  }

  /* ------------------------------------------------------------------ */
  /* Évaluation d'une configuration                                      */
  /* ------------------------------------------------------------------ */

  /**
   * Adaptateur du critère d'équilibre : lit les champs calculés par PM.graphe.equilibre (aucun second calcul).
   * Renvoie { S, ecartMax (rangs 1 à 7), premiereEgale, cinqContreDeux, tresDesequilibre, villeInaccessible,
   * partage, D }. S et ecartMax valent null si une ville est inaccessible.
   */
  function critere(e) {
    return {
      S: e.S, ecartMax: e.ecartMax7,
      premiereEgale: e.premiereEgale === true,
      cinqContreDeux: e.cinqContreDeux === true,
      tresDesequilibre: e.tresDesequilibre === true,
      villeInaccessible: e.S === null,
      partage: { 1: e.partage[1], 2: e.partage[2], egalite: e.partage.egalite },
      D: { 1: e.D[1].slice(), 2: e.D[2].slice() }
    };
  }

  /**
   * Évalue un plateau complet (tuiles et villes posées). Renvoie { ok, cause, crit, sortiesMin }.
   */
  function evaluer(docCandidat) {
    var g = GR.construire(docCandidat, { villesTraversables: false });
    var res = { ok: false, cause: null };
    if (!GR.connexe(g) || !g.apparitions[1].length || !g.apparitions[2].length) { res.cause = 'connexite'; return res; }
    if (GR.villesProches(g).length) { res.cause = 'villes_proches'; return res; }
    res.crit = critere(GR.equilibre(docCandidat, { graphe: g }));
    // sorties de chaque case d'apparition
    res.sortiesMin = Infinity;
    [1, 2].forEach(function (pj) {
      g.apparitions[pj].forEach(function (id) { res.sortiesMin = Math.min(res.sortiesMin, g.voisins.get(id).size); });
    });
    // ville inaccessible (S non mesurable) testée avant l'écart : null n'est jamais comparé à un seuil
    if (res.crit.villeInaccessible) res.cause = 'ville_inaccessible';
    else if (res.crit.tresDesequilibre) res.cause = 'desequilibre';
    else if (res.crit.cinqContreDeux) res.cause = 'cinq_contre_deux';
    else if (res.crit.ecartMax > SEUIL_ECART) res.cause = 'ecart';
    else if (!res.crit.premiereEgale) res.cause = 'premiere_ville';
    else res.ok = true;
    return res;
  }

  /* ------------------------------------------------------------------ */
  /* Bibliothèque et tirage des tuiles                                   */
  /* ------------------------------------------------------------------ */

  /** Stock par gabarit (ids répétés selon les exemplaires), modèles complets seulement, ordre du document. */
  function stockParGabarit(doc, F) {
    var stock = { centrale: [], bord: [], coin: [] };
    (Array.isArray(doc.modeles) ? doc.modeles : []).forEach(function (m) {
      if (!m || !Object.prototype.hasOwnProperty.call(stock, m.gabarit) || !M.validerModele(m, F).complet) return;
      var n = M.exemplairesValides(m);
      for (var k = 0; k < n; k++) stock[m.gabarit].push(m.id);
    });
    return stock;
  }

  /** Cellules de la grille avec leur gabarit attendu : [{col, lig, gabarit}]. */
  function cellulesDuFormat(F) {
    var res = [];
    for (var lig = 0; lig < F.GRILLE.lignes; lig++) {
      for (var col = 0; col < F.GRILLE.colonnes; col++) res.push({ col: col, lig: lig, gabarit: M.gabaritCellule(col, lig, F) });
    }
    return res;
  }

  /** Tuiles d'un candidat : [{modeleId, col, lig, rot}] (tirage sans remise par gabarit). */
  function tirerTuiles(stock, cellules, F, rng) {
    var paquets = {};
    Object.keys(stock).forEach(function (r) { paquets[r] = melanger(stock[r], rng); });
    return cellules.map(function (c) {
      var rot = M.rotationDeduite(c.col, c.lig, c.gabarit, F);
      return { modeleId: paquets[c.gabarit].pop(), col: c.col, lig: c.lig, rot: rot === null ? entier(rng, 4) : rot };
    });
  }

  function cloner(o) { return JSON.parse(JSON.stringify(o)); }

  /* ------------------------------------------------------------------ */
  /* Génération                                                          */
  /* ------------------------------------------------------------------ */

  var LIBELLES_CAUSE = {
    plateau_invalide: 'plateau refusé par la validation',
    connexite: 'graphe non connexe ou camp sans case d\'apparition',
    villes_proches: 'villes à moins de 3 cases',
    ville_inaccessible: 'ville inaccessible',
    desequilibre: 'plateau très déséquilibré',
    cinq_contre_deux: '« 5 contre 2 »',
    ecart: 'écart de plus de 2 pas à un rang',
    premiere_ville: 'première ville à des distances différentes'
  };

  /**
   * Génère un plateau aléatoire du format du document. Ne modifie pas `doc`.
   * options :
   *  - graine (texte ou nombre ; générée si absente) ;
   *  - candidats (défaut 200) : candidats valides à départager ; essaisMax (défaut candidats × 5) ;
   *  - tolerance (défaut 1) : bons candidats = S ≤ Smin + tolérance ;
   *  - jonctionsVariees (défaut false) : 4×4, voir pairesJonctionsCases (par défaut, rangée centrale).
   * Renvoie { ok, doc, graine, essais, candidats, score, rapport: [texte], raison, rejets }.
   */
  function generer(doc, options) {
    options = options || {};
    var graine = options.graine === undefined || options.graine === null || String(options.graine).trim() === ''
      ? nouvelleGraine() : String(options.graine).trim();
    var nbCandidats = Math.max(1, Math.floor(options.candidats || CANDIDATS_DEFAUT));
    var essaisMax = Math.max(nbCandidats, Math.floor(options.essaisMax || nbCandidats * FACTEUR_ESSAIS));
    var tolerance = typeof options.tolerance === 'number' && options.tolerance >= 0 ? options.tolerance : TOLERANCE_DEFAUT;
    var rng = mulberry32(hacher(graine));
    var rapport = [];
    var rejets = {};
    Object.keys(LIBELLES_CAUSE).forEach(function (k) { rejets[k] = 0; });

    function echec(raison, essais) {
      return { ok: false, doc: null, graine: graine, essais: essais || 0, candidats: 0, score: null, rapport: rapport, raison: raison, rejets: rejets };
    }

    if (!doc || typeof doc !== 'object') return echec('Aucun document à partir duquel générer.');
    var F;
    try { F = M.formatDuDocument(doc); } catch (e) { return echec(e.message); }

    // Stock plafonné (somme des exemplaires des modèles complets), puis bibliothèque suffisante ?
    var stock = stockParGabarit(doc, F), cellules = cellulesDuFormat(F), besoins = { centrale: 0, bord: 0, coin: 0 }, manques = [];
    cellules.forEach(function (c) { besoins[c.gabarit]++; });
    var total = M.GABARITS.reduce(function (s, r) { return s + stock[r].length; }, 0);
    if (total > M.PLAFOND_TUILES) {
      return echec('La bibliothèque compte ' + total + ' tuiles (modèles complets, selon leurs exemplaires) : le générateur en accepte ' +
        M.PLAFOND_TUILES + ' au plus. Réduisez le nombre d\'exemplaires.');
    }
    M.GABARITS.forEach(function (r) {
      if (stock[r].length < besoins[r]) {
        manques.push((besoins[r] - stock[r].length) + ' ' + LIBELLES_GABARIT[r] + ' (' + stock[r].length + ' disponible(s), ' + besoins[r] + ' nécessaire(s))');
      }
    });
    if (manques.length) {
      return echec('Bibliothèque insuffisante (modèles complets seulement) : il manque ' + manques.join(', ') + '.');
    }

    // Candidats
    var jonctions = jonctionsInterieures(F), modeles = doc.modeles;
    var paires = pairesJonctionsCases(F, options.jonctionsVariees === true);
    var bons = [], essais = 0;
    while (bons.length < nbCandidats && essais < essaisMax) {
      essais++;
      var tuiles = tirerTuiles(stock, cellules, F, rng), jetons = tirerVilles(jonctions, rng, paires);
      var cand = { version: doc.version, grille: F.id, modeles: modeles, plateau: { tuiles: tuiles, jetons: jetons } };
      if (M.validerPlateau(cand).erreurs.length) { rejets.plateau_invalide++; continue; }
      var ev = evaluer(cand);
      if (!ev.ok) { rejets[ev.cause]++; continue; }
      var raccords = M.raccordsMorts(cand).filter(function (r) { return r.raison !== 'absent'; }).length;
      var malReliees = M.jonctionsMalReliees(cand).length;
      bons.push({
        tuiles: tuiles, jetons: jetons, ev: ev, raccords: raccords, malReliees: malReliees,
        S: ev.crit.S, penalite: Math.max(0, raccords - RACCORDS_TOLERES) + malReliees + (ev.sortiesMin < 2 ? 3 : 0)
      });
    }

    if (!bons.length) {
      var detail = Object.keys(rejets).filter(function (k) { return rejets[k]; })
        .map(function (k) { return LIBELLES_CAUSE[k] + ' : ' + rejets[k]; }).join(', ');
      var conseil = rejets.villes_proches * 2 >= essais
        ? ' Les tuiles de cette bibliothèque rapprochent presque toujours deux villes à moins de 3 cases (règles R1 à R4 non respectées) : utilisez des tuiles conformes, comme celles du catalogue.'
        : ' Modifiez la bibliothèque ou essayez une autre graine.';
      return echec('Aucun plateau acceptable en ' + essais + ' essais' + (detail ? ' (' + detail + ')' : '') + '.' + conseil, essais);
    }

    // Bons candidats : S ≤ Smin + tolérance ; à S égal, pénalité minimale ; tirage au hasard
    var Smin = Math.min.apply(null, bons.map(function (x) { return x.S; }));
    var parmi = bons.filter(function (x) { return x.S <= Smin + tolerance; });
    var penMin = {};
    parmi.forEach(function (x) { penMin[x.S] = Math.min(penMin[x.S] === undefined ? Infinity : penMin[x.S], x.penalite); });
    parmi = parmi.filter(function (x) { return x.penalite === penMin[x.S]; });
    var choisi = parmi[entier(rng, parmi.length)];

    // Document final : modèles et autres champs inchangés, plateau remplacé
    var sortie = cloner(doc);
    sortie.grille = F.id;
    sortie.plateau = { tuiles: cloner(choisi.tuiles), jetons: cloner(choisi.jetons) };
    var validation = M.validerPlateau(sortie);

    var crit = choisi.ev.crit;
    var score = {
      S: crit.S, ecartMax: crit.ecartMax, partage: crit.partage, D: crit.D,
      raccordsMorts: choisi.raccords, jonctionsMalReliees: choisi.malReliees, sortiesMin: choisi.ev.sortiesMin,
      bons: parmi.length, Smin: Smin
    };
    var nomsVilles = choisi.jetons.map(function (j) { return '(' + j.i + ',' + j.j + ')'; }).join(' ');
    rapport.push('Graine « ' + graine + ' » : ' + bons.length + ' candidat(s) valide(s) en ' + essais + ' essai(s), tirage parmi ' +
      parmi.length + ' bon(s) candidat(s) (S = ' + Smin + (tolerance ? ' à ' + (Smin + tolerance) : '') + ').');
    rapport.push('Villes ' + nomsVilles + ' ; les autres jonctions sont des cases chemin' +
      (paires ? (options.jonctionsVariees === true ? ' (jonctions variées).' : ' (rangée centrale).') : '.'));
    rapport.push('Score S (somme des écarts sur les 7 rangs) : ' + crit.S + ' ; écart maximal : ' + crit.ecartMax + ' pas.');
    rapport.push('Villes plus proches du joueur vert : ' + crit.partage[1] + ', du joueur rouge : ' + crit.partage[2] + ', à égalité : ' + crit.partage.egalite + '.');
    rapport.push('Raccords morts : ' + score.raccordsMorts + ' ; jonctions mal reliées : ' + score.jonctionsMalReliees + ' ; sorties minimales d\'une case d\'apparition : ' + score.sortiesMin + '.');
    if (validation.erreurs.length) rapport.push('Attention : ' + validation.erreurs[0].message);

    return {
      ok: validation.erreurs.length === 0, doc: sortie, graine: graine, essais: essais, candidats: bons.length,
      score: score, rapport: rapport,
      raison: validation.erreurs.length ? validation.erreurs[0].message : '', rejets: rejets
    };
  }

  /* ------------------------------------------------------------------ */
  /* Interface : boîte de dialogue « Plateau aléatoire »                 */
  /* ------------------------------------------------------------------ */

  var cptId = 0;

  function el(d, nom, classe, texte) {
    var e = d.createElement(nom);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  /** Miniature SVG (texte) d'un plateau généré, avec PM.rendu (résolu à l'appel : ordre de chargement). */
  function svgApercu(doc) {
    var R = PM.rendu, F = M.formatDuDocument(doc), C = F.COTE, s = [];
    var cote = F.GRILLE.colonnes * C, haut = F.GRILLE.lignes * C;
    s.push('<svg xmlns="http://www.w3.org/2000/svg" class="pm-generateur-svg" viewBox="-4 -4 ' + (cote + 8) + ' ' + (haut + 8) +
      '" role="img" aria-label="Aperçu du plateau généré">');
    doc.plateau.tuiles.forEach(function (t) {
      var m = M.modeleParId(doc, t.modeleId);
      if (!m) return;
      s.push('<g transform="translate(' + (t.col * C) + ' ' + (t.lig * C) + ')">' +
        R.contenuTuile(m, { rot: t.rot, camp: F.campCellule(t.col, t.lig) || 'neutre', format: F }) + '</g>');
    });
    doc.plateau.jetons.forEach(function (j) { s.push(R.contenuJeton(j.type, j.i * C, j.j * C, F)); });
    s.push('</svg>');
    return s.join('');
  }

  /** Remplit `conteneur` avec le formulaire du générateur. `etat` : état partagé. */
  function remplir(conteneur, etat) {
    var d = conteneur.ownerDocument || document, n = ++cptId;
    while (conteneur.firstChild) conteneur.removeChild(conteneur.firstChild);
    var racine = el(d, 'div', 'pm-generateur');
    var resultat = null;

    var F = M.formatDuDocument(etat.doc());
    racine.appendChild(el(d, 'p', 'pm-generateur-explication',
      'Tire un plateau ' + F.GRILLE.colonnes + '×' + F.GRILLE.lignes + ' complet dans la bibliothèque : 7 villes à 3 cases d\'écart au moins, ' +
      'les autres jonctions restent des cases chemin' + (pairesJonctionsCases(F, false) ? ' (les deux jonctions-cases sont placées dans la rangée centrale, sauf option « jonctions variées »)' : ' (tirées librement, classées par équilibre)') + ' ; ' +
      'plateau équilibré tiré au hasard parmi les meilleurs candidats. ' +
      'La même graine redonne le même plateau.'));

    // Graine
    var ligneGraine = el(d, 'p', 'pm-generateur-ligne');
    var labGraine = el(d, 'label', 'pm-generateur-libelle', 'Graine');
    var champ = el(d, 'input', 'pm-generateur-graine');
    champ.type = 'text';
    champ.id = 'pm-generateur-graine-' + n;
    champ.value = nouvelleGraine();
    champ.maxLength = 40;
    champ.autocomplete = 'off';
    labGraine.setAttribute('for', champ.id);
    var btnGraine = el(d, 'button', 'pm-generateur-bouton', 'Nouvelle graine');
    btnGraine.type = 'button';
    btnGraine.addEventListener('click', function () { champ.value = nouvelleGraine(); champ.focus(); });
    ligneGraine.appendChild(labGraine);
    ligneGraine.appendChild(champ);
    ligneGraine.appendChild(btnGraine);
    racine.appendChild(ligneGraine);

    // Option « jonctions variées » (4×4 seulement) : décochée, les jonctions-cases restent dans la rangée centrale
    var caseVariees = null;
    if (pairesJonctionsCases(F, false)) {
      var ligneVariees = el(d, 'p', 'pm-generateur-ligne');
      caseVariees = el(d, 'input', 'pm-generateur-variees');
      caseVariees.type = 'checkbox';
      caseVariees.id = 'pm-generateur-variees-' + n;
      var labVariees = el(d, 'label', 'pm-generateur-libelle', 'Jonctions variées (les deux jonctions-cases peuvent sortir de la rangée centrale, sauf deux dans une même rangée extérieure ; plateau un peu moins équilibré en moyenne)');
      labVariees.setAttribute('for', caseVariees.id);
      ligneVariees.appendChild(caseVariees);
      ligneVariees.appendChild(labVariees);
      racine.appendChild(ligneVariees);
    }

    // Avertissement si le plateau courant n'est pas vide
    var courant = etat.doc().plateau;
    if (courant.tuiles.length || courant.jetons.length) {
      var av = el(d, 'p', 'pm-generateur-avertissement',
        'Le plateau actuel sera remplacé (Ctrl+Z pour revenir).');
      av.setAttribute('role', 'note');
      racine.appendChild(av);
    }

    // Actions
    var actions = el(d, 'p', 'pm-generateur-actions');
    var btnGenerer = el(d, 'button', 'pm-generateur-bouton pm-generateur-principal', 'Générer');
    btnGenerer.type = 'button';
    var btnAppliquer = el(d, 'button', 'pm-generateur-bouton', 'Appliquer au plateau');
    btnAppliquer.type = 'button';
    btnAppliquer.disabled = true;
    actions.appendChild(btnGenerer);
    actions.appendChild(btnAppliquer);
    racine.appendChild(actions);

    // Résultat
    var zone = el(d, 'div', 'pm-generateur-resultat');
    zone.setAttribute('aria-live', 'polite');
    racine.appendChild(zone);

    btnGenerer.addEventListener('click', function () {
      if (btnGenerer.disabled) return;
      if (!champ.value.trim()) champ.value = nouvelleGraine();
      var options = { graine: champ.value, jonctionsVariees: !!(caseVariees && caseVariees.checked) };
      // Calcul synchrone : le bouton est désactivé et annonce la génération, puis le calcul part au tour suivant
      // pour que le navigateur affiche cet état avant d'être occupé.
      btnGenerer.disabled = true;
      btnAppliquer.disabled = true;
      btnGenerer.textContent = 'Génération…';
      setTimeout(function () {
        try { afficher(generer(etat.doc(), options)); } finally {
          btnGenerer.disabled = false;
          btnGenerer.textContent = 'Générer';
        }
      }, 0);
    });

    /** Affiche le résultat d'une génération dans la zone de résultat. */
    function afficher(r) {
      resultat = r;
      champ.value = resultat.graine;
      while (zone.firstChild) zone.removeChild(zone.firstChild);
      if (!resultat.ok) {
        zone.appendChild(el(d, 'p', 'pm-generateur-erreur', resultat.raison));
        btnAppliquer.disabled = true;
        return;
      }
      var apercu = el(d, 'div', 'pm-generateur-apercu');
      apercu.innerHTML = svgApercu(resultat.doc); // SVG construit par PM.rendu (identifiants échappés par rendu.js)
      zone.appendChild(apercu);
      var liste = el(d, 'ul', 'pm-generateur-resume');
      resultat.rapport.forEach(function (t) { liste.appendChild(el(d, 'li', null, t)); });
      zone.appendChild(liste);
      btnAppliquer.disabled = false;
    }

    btnAppliquer.addEventListener('click', function () {
      if (!resultat || !resultat.ok) return;
      var r = resultat, libelle = 'plateau aléatoire (graine ' + r.graine + ')';
      var fait = etat.appliquer(function () { return r.doc; }, libelle);
      if (!fait.ok) return;
      if (PM.dialogue) PM.dialogue.fermer();
      etat.signaler('Plateau aléatoire appliqué (graine ' + r.graine + '). Ctrl+Z pour revenir.', 'info');
    });

    conteneur.appendChild(racine);
    racine.champGraine = champ;
    racine.caseVariees = caseVariees;
    racine.boutonGenerer = btnGenerer;
    racine.boutonAppliquer = btnAppliquer;
    return racine;
  }

  /** Ouvre le générateur dans la boîte de dialogue commune. */
  function ouvrir(etat) {
    var contenu = PM.dialogue.ouvrir('Plateau aléatoire');
    var racine = remplir(contenu, etat);
    racine.champGraine.focus();
    return racine;
  }

  PM.generateur = {
    generer: generer,
    critere: critere,
    pairesJonctionsCases: pairesJonctionsCases,
    hacher: hacher,
    mulberry32: mulberry32,
    nouvelleGraine: nouvelleGraine,
    svgApercu: svgApercu,
    remplir: remplir,
    ouvrir: ouvrir
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.generateur;
})();
