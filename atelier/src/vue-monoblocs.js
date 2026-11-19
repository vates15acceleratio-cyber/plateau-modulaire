/*
 * vue-monoblocs.js : mode « Mes monoblocs » de l'onglet Plateau (lot E, cahier des charges §8.2).
 * Éditeur d'une pièce personnelle sur une petite grille hexagonale, liste des pièces personnelles du document
 * (modifier, supprimer), copie depuis un plateau de la bibliothèque.
 * Dépend de AT.hex, AT.catalogue, AT.plateau ; AT.rendu pour le panneau.
 *
 * Les pièces personnelles vivent DANS le document du plateau (champ `modeles`) : toute modification passe par
 * AT.plateau (ajouterModele, modifierModele, supprimerModele, copierModeles) et par l'historique de l'onglet,
 * elle s'annule donc comme une retouche. Les noms saisis ne sont jamais écrits autrement que par textContent.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;

  /** Rayon de la petite grille de l'éditeur : 37 cases, assez pour une ligne de 6. */
  var RAYON_EDITEUR = 3;
  var NOMS_TERRAINS = { plaine: 'plaine', foret: 'forêt', marais: 'marais', montagne: 'montagne' };

  // ================================================================== logique pure

  function ordreLecture(a, b) { return a.r - b.r || a.q - b.q; }

  /**
   * Recentre une forme pour qu'elle contienne la case (0,0), ancre de la pièce.
   * Si la forme contient déjà (0,0), elle est rendue telle quelle (copie). Sinon elle est translatée pour que sa
   * première case dans l'ordre de lecture (rangée la plus haute, puis colonne la plus à gauche) vienne en (0,0),
   * et ses cases sont rangées dans l'ordre de lecture. Liste vide : liste vide. Renvoie [{q, r, terrain}].
   */
  function recentrer(cases) {
    var liste = (Array.isArray(cases) ? cases : []).map(function (c) { return { q: c.q, r: c.r, terrain: c.terrain }; });
    if (!liste.length || liste.some(function (c) { return c.q === 0 && c.r === 0; })) return liste;
    liste.sort(ordreLecture);
    var dq = liste[0].q, dr = liste[0].r;
    return liste.map(function (c) { return { q: c.q - dq, r: c.r - dr, terrain: c.terrain }; });
  }

  /**
   * Clic sur une case de la grille de l'éditeur avec le terrain choisi : case vide → ajoutée avec ce terrain ;
   * case d'un autre terrain → elle prend ce terrain ; case déjà de ce terrain → retirée.
   * Renvoie une nouvelle liste [{q, r, terrain}] (l'ancienne n'est pas modifiée).
   */
  function basculer(cases, q, r, terrain) {
    var liste = (Array.isArray(cases) ? cases : []).map(function (c) { return { q: c.q, r: c.r, terrain: c.terrain }; });
    var rang = -1;
    liste.forEach(function (c, i) { if (c.q === q && c.r === r) rang = i; });
    if (rang === -1) liste.push({ q: q, r: r, terrain: terrain });
    else if (liste[rang].terrain !== terrain) liste[rang].terrain = terrain;
    else liste.splice(rang, 1);
    return liste;
  }

  /**
   * Translate une forme pour qu'elle tienne dans la grille de l'éditeur (disque de rayon `rayon` autour de (0,0)),
   * au plus près du centre. Sert à recharger une pièce existante dont l'ancre est au bout de la forme.
   * Renvoie [{q, r, terrain}] ; la forme est rendue telle quelle si aucune translation ne convient.
   */
  function centrerDansGrille(cases, rayon) {
    var liste = (Array.isArray(cases) ? cases : []).map(function (c) { return { q: c.q, r: c.r, terrain: c.terrain }; });
    if (!liste.length) return liste;
    var meilleur = null;
    liste.forEach(function (centre) {
      H.voisines(H.cle(centre.q, centre.r)).concat([H.cle(centre.q, centre.r)]).forEach(function (k) {
        var p = H.decle(k), pire = 0;
        liste.forEach(function (c) { pire = Math.max(pire, H.distance({ q: c.q - p.q, r: c.r - p.r }, { q: 0, r: 0 })); });
        if (!meilleur || pire < meilleur.pire) meilleur = { q: p.q, r: p.r, pire: pire };
      });
    });
    if (meilleur.pire > rayon) return liste;
    return liste.map(function (c) { return { q: c.q - meilleur.q, r: c.r - meilleur.r, terrain: c.terrain }; });
  }

  /**
   * Définition prête pour AT.plateau.ajouterModele : nom nettoyé, quantité entière, forme recentrée.
   * Une quantité saisie n'est acceptée que si elle est écrite en chiffres seulement : « 2.5 », « 3abc » ou « 1e1 »
   * ne sont pas tronqués en silence, ils donnent NaN (refusé par avis()).
   */
  function definition(nom, quantite, cases) {
    var texte = String(quantite === undefined || quantite === null ? '' : quantite).trim();
    var n = typeof quantite === 'number' ? quantite : (/^[0-9]{1,4}$/.test(texte) ? parseInt(texte, 10) : NaN);
    return { nom: String(nom === undefined || nom === null ? '' : nom).trim(), quantite: Number.isInteger(n) ? n : NaN, cases: recentrer(cases) };
  }

  /**
   * Messages de validation en clair pour une définition {nom, quantite, cases} (liste vide = pièce valide).
   * La règle est celle de AT.plateau.validerModele ; les cas les plus courants ont une phrase plus directe.
   */
  function avis(def) {
    var R = C.REGLAGES.perso, d = def || {}, cases = Array.isArray(d.cases) ? d.cases : [], res = [];
    if (!cases.length) res.push('Dessinez la pièce : cliquez ' + R.casesMin + ' à ' + R.casesMax + ' cases voisines sur la grille.');
    else if (cases.length < R.casesMin) res.push('Ajoutez au moins une case voisine : une pièce compte ' + R.casesMin + ' à ' + R.casesMax + ' cases.');
    else if (cases.length > R.casesMax) res.push('Trop de cases : ' + cases.length + ' pour ' + R.casesMax + ' au plus. Retirez-en ' + (cases.length - R.casesMax) + '.');
    if (typeof d.nom !== 'string' || !d.nom.trim()) res.push('Donnez un nom à la pièce.');
    if (!Number.isInteger(d.quantite) || d.quantite < 1 || d.quantite > R.quantiteMax) res.push('Quantité : un nombre entier de 1 à ' + R.quantiteMax + '.');
    // Cases qui ne se touchent pas : dit en clair, avant la règle générale (deux cases très éloignées y sont
    // refusées comme « position invalide », ce qui ne dit pas quoi faire).
    if (cases.length >= R.casesMin && cases.length <= R.casesMax && cases.every(function (c) { return Number.isInteger(c.q) && Number.isInteger(c.r); })
      && P.composantes(cases.map(function (c) { return H.cle(c.q, c.r); })).length > 1) {
      res.push('Les cases doivent se toucher : la pièce est en plusieurs morceaux.');
    }
    if (res.length) return res;
    var v = P.validerModele({ id: 'X1', nom: d.nom, cases: cases, quantite: d.quantite });
    return v.ok ? [] : v.erreurs.map(function (e) {
      var t = String(e).replace(/^Pièce personnelle(, case n° \d+)? : /, '');
      if (/d’un seul tenant/.test(t)) return 'Les cases doivent se toucher : la pièce est en plusieurs morceaux.';
      return t.charAt(0).toUpperCase() + t.slice(1);
    });
  }

  /** Résumé d'une forme : « 3 cases : 2 × forêt, 1 × plaine ». */
  function contenu(cases) {
    var n = {}, ordre = [];
    (cases || []).forEach(function (c) { if (!n[c.terrain]) { n[c.terrain] = 0; ordre.push(c.terrain); } n[c.terrain] += 1; });
    return (cases || []).length + ((cases || []).length > 1 ? ' cases : ' : ' case : ') + ordre.map(function (t) { return n[t] + ' × ' + (NOMS_TERRAINS[t] || t); }).join(', ');
  }

  AT.vueMonoblocs = { RAYON_EDITEUR: RAYON_EDITEUR, recentrer: recentrer, centrerDansGrille: centrerDansGrille, basculer: basculer, definition: definition, avis: avis, contenu: contenu };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueMonoblocs;
  if (typeof document === 'undefined') return;

  // ================================================================== panneau

  /**
   * `acces` : plateau(), changer(plateau), message(texte, niveau), bibliotheque() → [{id, nom, plateau}].
   * Renvoie {element, rafraichir(), etat()}.
   */
  function creer(acces) {
    var R = AT.rendu, el = R.el, svg = R.svg;
    var cases = [];                 // forme en cours, en coordonnées de la grille de l'éditeur
    var terrain = 'foret';
    var edite = null;               // identifiant de la pièce en cours de modification, ou null (nouvelle pièce)
    var verrou = false;             // pièce posée : la forme ne se change pas
    var curseur = '0,0';
    var prefixe = R.nouveauPrefixe();
    var CLES = H.disque(RAYON_EDITEUR), polygones = {};

    var champNom = el('input', { type: 'text', id: 'mo-nom', maxlength: C.REGLAGES.perso.longueurNom, autocomplete: 'off', spellcheck: 'false' });
    var champQuantite = el('input', { type: 'number', id: 'mo-quantite', classe: 'at-champ-nombre', min: 1, max: C.REGLAGES.perso.quantiteMax, step: 1, value: 1 });
    var zoneTerrains = el('div', { classe: 'at-pinceau-outils', id: 'mo-terrains', role: 'group', 'aria-label': 'Terrain des cases ajoutées' });
    var zoneAvis = el('ul', { classe: 'at-mono-avis', id: 'mo-avis', 'aria-live': 'polite' });
    var zoneApercu = el('div', { classe: 'at-mono-apercu', id: 'mo-apercu' });
    var zoneListe = el('div', { id: 'mo-liste' });
    var zoneCopie = el('div', { id: 'mo-copie' });
    var titreEditeur = el('legend', { id: 'mo-titre' });
    var btnValider = el('button', { type: 'button', id: 'mo-valider', classe: 'at-principal-bouton', sur: { click: valider } });
    var btnEffacer = el('button', { type: 'button', id: 'mo-effacer', sur: { click: function () { reinitialiser(); acces.message('Éditeur remis à zéro.', 'info'); } } });

    // Petite grille : un polygone par case, mis à jour sur place (le focus du clavier reste sur la grille).
    var cadre = R.cadre(CLES, R.PLAT, 6);
    var gCases = svg('g'), contour = svg('path', { fill: 'none', stroke: '#1F1F1F', 'stroke-width': 5, 'stroke-linecap': 'round', 'pointer-events': 'none' });
    var marqueCurseur = svg('g', { 'pointer-events': 'none' });
    var grille = svg('svg', {
      classe: 'at-mono-grille', id: 'mo-grille', viewBox: [cadre.x, cadre.y, cadre.l, cadre.h].join(' '), tabindex: 0, role: 'application', focusable: 'true',
      'aria-label': 'Grille de la pièce. Flèches : déplacer le curseur ; Entrée ou Espace : ajouter, changer ou retirer la case.'
    }, [R.definitions(prefixe, C.REGLAGES.perso.terrains), gCases, contour, marqueCurseur]);
    CLES.forEach(function (k) {
      polygones[k] = R.polygoneCase(k, { 'data-case': k, classe: 'at-mono-case' }, 0.04);
      gCases.appendChild(polygones[k]);
    });

    function terrainDe(k) {
      var p = H.decle(k), c = cases.filter(function (x) { return x.q === p.q && x.r === p.r; })[0];
      return c ? c.terrain : null;
    }

    function def() { return definition(champNom.value, champQuantite.value, cases); }

    function dessinerGrille() {
      CLES.forEach(function (k) {
        var t = terrainDe(k);
        polygones[k].setAttribute('fill', t ? R.remplissage(prefixe, t) : '#FBFAF6');
        polygones[k].setAttribute('stroke', t ? '#6E6A58' : '#B9B4A3');
        polygones[k].setAttribute('stroke-width', t ? 1.5 : 1);
        if (t) polygones[k].removeAttribute('stroke-dasharray'); else polygones[k].setAttribute('stroke-dasharray', '3 5');
      });
      var cles = cases.map(function (c) { return H.cle(c.q, c.r); });
      contour.setAttribute('d', cles.length ? R.cheminContour(cles) : '');
      R.vider(marqueCurseur);
      if (document.activeElement === grille) marqueCurseur.appendChild(R.polygoneCase(curseur, { classe: 'at-curseur' }, 0.08));
    }

    function rafraichirEditeur() {
      var d = def(), messages = avis(d), pl = acces.plateau();
      dessinerGrille();
      R.remplacer(zoneTerrains, C.REGLAGES.perso.terrains.map(function (t) {
        return el('button', {
          type: 'button', classe: 'at-pinceau-outil', id: 'mo-terrain-' + t, 'aria-pressed': terrain === t ? 'true' : 'false', disabled: verrou,
          sur: { click: function () { terrain = t; rafraichirEditeur(); } }
        }, [R.pastilleTerrain(t), el('span', { texte: R.nomTerrain(t) })]);
      }));
      var modeleEdite = edite ? P.modeles(pl).filter(function (m) { return m.id === edite; })[0] : null;
      if (edite && !modeleEdite) { edite = null; verrou = false; }           // la pièce a disparu (annulation) : retour à « nouvelle pièce »
      titreEditeur.textContent = edite ? 'Modifier la pièce ' + edite : 'Nouvelle pièce';
      btnValider.textContent = edite ? 'Enregistrer les changements' : 'Ajouter à mes monoblocs';
      btnEffacer.textContent = edite ? 'Renoncer' : 'Tout effacer';
      var lignes = messages.map(function (m) { return el('li', { classe: 'at-niveau-erreur', texte: m }); });
      if (verrou) lignes.unshift(el('li', { classe: 'at-niveau-alerte', texte: 'Cette pièce est posée sur le plateau : seuls son nom et sa quantité se changent. Pour changer sa forme, retirez d’abord ses exemplaires.' }));
      if (!messages.length) lignes.push(el('li', { classe: 'at-niveau-info', texte: 'Pièce valide : ' + contenu(d.cases) + '.' }));
      R.remplacer(zoneAvis, lignes);
      btnValider.disabled = messages.length > 0;
      // Aperçu : la pièce recentrée, telle qu'elle sera posée (rotation 0).
      var apercu = [];
      if (d.cases.length) {
        apercu.push(R.dessinModele('X1', { echelle: 0.34, titre: 'Aperçu de la pièce', plateau: { modeles: [{ id: 'X1', nom: 'aperçu', cases: d.cases, quantite: 1 }] } }));
        apercu.push(el('span', { classe: 'at-aide', texte: contenu(d.cases) }));
      } else apercu.push(el('span', { classe: 'at-aide', texte: 'Aperçu : rien à montrer pour l’instant.' }));
      R.remplacer(zoneApercu, apercu);
    }

    function agir(k) {
      if (verrou) { acces.message('Forme verrouillée : cette pièce est posée sur le plateau. Retirez d’abord ses exemplaires.', 'alerte'); return; }
      var p = H.decle(k);
      cases = basculer(cases, p.q, p.r, terrain);
      rafraichirEditeur();
    }

    function reinitialiser() {
      cases = []; edite = null; verrou = false;
      champNom.value = ''; champQuantite.value = '1';
      rafraichirEditeur();
    }

    function valider() {
      var d = def(), r;
      if (avis(d).length) return;
      if (edite) {
        var changements = { nom: d.nom, quantite: d.quantite };
        if (!verrou) changements.cases = d.cases;
        r = P.modifierModele(acces.plateau(), edite, changements);
      } else {
        r = P.ajouterModele(acces.plateau(), d);
      }
      if (!r.ok) { acces.message('Pièce refusée : ' + r.raison, 'erreur'); return; }
      var etait = edite;
      reinitialiser();
      acces.changer(r.plateau);
      acces.message(etait ? 'Pièce ' + r.id + ' modifiée.' : 'Pièce ajoutée à vos monoblocs (' + r.id + ') : elle est dans la palette du mode « Créer à la main ».', 'info');
    }

    function modifier(id) {
      var pl = acces.plateau(), m = P.modeles(pl).filter(function (x) { return x.id === id; })[0];
      if (!m) return;
      edite = id;
      verrou = pl.pieces.some(function (p) { return p.modele === id; });
      cases = centrerDansGrille(m.cases, RAYON_EDITEUR);
      champNom.value = m.nom;
      champQuantite.value = String(m.quantite);
      rafraichirEditeur();
      acces.message(verrou ? 'Pièce ' + id + ' posée sur le plateau : seuls le nom et la quantité se changent.' : 'Pièce ' + id + ' chargée dans l’éditeur.', verrou ? 'alerte' : 'info');
    }

    function supprimer(id) {
      var r = P.supprimerModele(acces.plateau(), id);
      if (!r.ok) { acces.message(r.raison, 'erreur'); return; }
      if (edite === id) reinitialiser();
      acces.changer(r.plateau);
      acces.message('Pièce ' + id + ' supprimée de vos monoblocs (Annuler pour la retrouver).', 'info');
    }

    function copier(idEntree) {
      var entree = acces.bibliotheque().filter(function (e) { return e.id === idEntree; })[0];
      if (!entree) { acces.message('Choisissez d’abord un plateau de la bibliothèque.', 'alerte'); return; }
      var r = P.copierModeles(entree.plateau, acces.plateau());
      if (!r.ok) { acces.message('Copie refusée : ' + r.raison, 'erreur'); return; }
      acces.changer(r.plateau);
      acces.message(r.copies + (r.copies > 1 ? ' pièces copiées' : ' pièce copiée') + ' depuis le plateau de la bibliothèque.', 'info');
    }

    function rafraichirListe() {
      var pl = acces.plateau(), liste = P.modeles(pl), stock = P.stock(pl);
      var cartes = liste.map(function (m) {
        var s = stock[m.id] || { poses: 0 };
        var carte = el('div', { classe: 'at-mono-carte', 'data-modele': m.id }, [
          R.dessinModele(m.id, { echelle: 0.26, titre: m.nom, plateau: pl })
        ]);
        var texte = el('div', { classe: 'at-mono-texte' });
        var nom = el('strong');
        nom.textContent = m.nom;                       // nom saisi ou venu d'un fichier : jamais autrement que par textContent
        texte.appendChild(nom);
        texte.appendChild(el('span', { classe: 'at-identifiant', texte: ' ' + m.id }));
        texte.appendChild(el('div', { classe: 'at-aide', texte: contenu(m.cases) + ' ; ' + m.quantite + (m.quantite > 1 ? ' exemplaires' : ' exemplaire') + ', ' + s.poses + (s.poses > 1 ? ' posés' : ' posé') }));
        texte.appendChild(el('div', { classe: 'at-ligne' }, [
          el('button', { type: 'button', texte: 'Modifier', 'data-modifier': m.id, sur: { click: function () { modifier(m.id); } } }),
          el('button', { type: 'button', texte: 'Supprimer', 'data-supprimer': m.id, sur: { click: function () { supprimer(m.id); } } })
        ]));
        carte.appendChild(texte);
        return carte;
      });
      R.remplacer(zoneListe, cartes.length ? cartes : el('p', { classe: 'at-aide', texte: 'Aucune pièce personnelle dans ce plateau.' }));

      var sources = acces.bibliotheque().filter(function (e) { return P.modeles(e.plateau).length > 0; });
      if (!sources.length) {
        R.remplacer(zoneCopie, el('p', { classe: 'at-aide', texte: 'Aucun plateau de la bibliothèque ne porte de pièce personnelle.' }));
      } else {
        var choix = el('select', { id: 'mo-source', 'aria-label': 'Plateau de la bibliothèque à copier' }, sources.map(function (e) {
          var o = el('option', { value: e.id });
          o.textContent = e.nom + ' (' + P.modeles(e.plateau).length + ')';
          return o;
        }));
        R.remplacer(zoneCopie, el('div', { classe: 'at-ligne' }, [
          choix,
          el('button', { type: 'button', id: 'mo-copier', texte: 'Copier ses monoblocs', sur: { click: function () { copier(choix.value); } } })
        ]));
      }
    }

    // Souris et clavier sur la grille.
    grille.addEventListener('click', function (ev) {
      var k = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-case') : null;
      if (!k || !H.estCle(k)) return;
      curseur = k;
      agir(k);
    });
    var FLECHES = { ArrowLeft: 'gauche', ArrowRight: 'droite', ArrowUp: 'haut', ArrowDown: 'bas' };
    grille.addEventListener('keydown', function (ev) {
      if (ev.ctrlKey || ev.altKey || ev.metaKey) return;
      if (Object.prototype.hasOwnProperty.call(FLECHES, ev.key)) {
        var suivante = R.caseVoisineFleche(curseur, FLECHES[ev.key]);
        if (H.distance(suivante, '0,0') <= RAYON_EDITEUR) curseur = suivante;
        dessinerGrille();
      } else if (ev.key === 'Enter' || ev.key === ' ') {
        agir(curseur);
      } else { return; }
      ev.preventDefault();
      ev.stopPropagation();
    });
    grille.addEventListener('focus', dessinerGrille);
    grille.addEventListener('blur', dessinerGrille);
    champNom.addEventListener('input', rafraichirEditeur);
    champQuantite.addEventListener('input', rafraichirEditeur);

    var element = el('div', { classe: 'at-mode-panneau', id: 'mo-panneau' }, [
      el('fieldset', null, [
        titreEditeur,
        el('p', { classe: 'at-aide', texte: 'Choisissez un terrain, puis cliquez les cases de la grille : une case vide est ajoutée, une case du même terrain est retirée. 2 à 6 cases qui se touchent ; jamais de ville dans un monobloc.' }),
        zoneTerrains,
        grille,
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'mo-nom', texte: 'Nom' }), champNom]),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'mo-quantite', texte: 'Quantité (exemplaires en carton)' }), champQuantite]),
        zoneApercu,
        zoneAvis,
        el('div', { classe: 'at-ligne' }, [btnValider, btnEffacer])
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Mes monoblocs (dans ce plateau)' }),
        zoneListe
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Copier depuis un plateau de la bibliothèque' }),
        zoneCopie
      ])
    ]);
    rafraichirEditeur();

    return {
      element: element,
      rafraichir: function () { rafraichirEditeur(); rafraichirListe(); },
      etat: function () { return { cases: cases.slice(), terrain: terrain, edite: edite, verrou: verrou, curseur: curseur }; }
    };
  }

  AT.vueMonoblocs.creer = creer;
})();
