/*
 * vue-plateau.js : onglet « Plateau » (lots C et E). Générer, retoucher à la main, contrôler en direct,
 * enregistrer / ouvrir, exporter, imprimer.
 * Dépend de AT.hex, AT.catalogue, AT.plateau, AT.controles, AT.generateur, AT.rendu ; AT.app à l'exécution.
 *
 * La colonne de gauche a cinq MODES (bascule en tête) : « Générer », « Créer à la main » (palette, vue-creation.js),
 * « Pinceau » (vue-creation.js), « Mes monoblocs » (vue-monoblocs.js), « Bibliothèque » (vue-bibliotheque.js).
 * Cette vue garde le plateau courant et son historique : toute modification, d'où qu'elle vienne, passe par
 * changer() (une étape d'annulation, contrôles recalculés, sauvegarde automatique planifiée).
 *
 * Après chaque retouche (poser, retirer, tourner, déplacer), les villes de déploiement sont recalculées
 * par AT.plateau.avecCamps. Un fichier ouvert est affiché tel quel : les contrôles disent ce qui ne va pas.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
    if (!AT.vueCreation) require('./vue-creation.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;
  var TAILLE_HISTORIQUE = 200;

  /** Modes de la colonne de gauche de l'onglet Plateau. */
  var MODES = [
    { id: 'generer', nom: 'Générer' },
    { id: 'creer', nom: 'Créer à la main' },
    { id: 'pinceau', nom: 'Pinceau' },
    { id: 'villes', nom: 'Villes' },
    { id: 'monoblocs', nom: 'Mes monoblocs' },
    { id: 'bibliotheque', nom: 'Bibliothèque' }
  ];

  /** Couleurs de l'aperçu fantôme, en attributs SVG : vert si la pose est possible, rouge sinon. */
  var FANTOME_OK = { fill: '#00965A', 'fill-opacity': 0.38, stroke: '#00703F', 'stroke-width': 3, 'stroke-dasharray': '6 4' };
  var FANTOME_REFUS = { fill: '#D8321C', 'fill-opacity': 0.42, stroke: '#B3200E', 'stroke-width': 3, 'stroke-dasharray': '6 4' };

  // ------------------------------------------------------------------ logique pure (testée sous Node)

  /**
   * Déplace une pièce posée : son ancre va en (q, r), avec la rotation donnée (la sienne par défaut).
   * C'est un retrait suivi d'une pose : l'identifiant de la pièce change. Si la pose est refusée,
   * le plateau reçu est rendu inchangé. Renvoie {ok, plateau, id, raison}.
   * La repose ne compte pas contre le stock (un déplacement ne change pas le nombre de pièces) : une tuile
   * posée hors stock, comme la montagne d'une case du pinceau, se déplace donc aussi.
   * Une ville neutre ne se déplace pas ainsi (refus) : elle se retire et se repose à l'étape « Villes ».
   */
  function deplacerPiece(plateau, idPiece, q, r, rotation) {
    var piece = (plateau.pieces || []).filter(function (p) { return p.id === idPiece; })[0];
    if (!piece) return { ok: false, plateau: plateau, raison: 'Pièce introuvable sur le plateau.' };
    if (refusRetoucheVille(plateau, idPiece)) return { ok: false, plateau: plateau, raison: P.RAISON_VILLE_NEUTRE };
    var retrait = P.retirer(plateau, idPiece);
    var pose = P.poser(retrait.plateau, piece.modele, q, r, rotation === undefined ? piece.rotation : rotation, { horsStock: true });
    if (!pose.ok) return { ok: false, plateau: plateau, raison: pose.raison };
    return { ok: true, plateau: P.avecCamps(pose.plateau), id: pose.id, raison: null };
  }

  /**
   * Étiquettes à écrire sur les cases. mode : 'rien', 'cotes', 'pieces' (contacts de la pièce),
   * 'rations-vert', 'rations-rouge' (coût minimal depuis les villes de déploiement), 'coordonnees'.
   */
  function etiquettes(plateau, mode) {
    var res = {};
    if (mode === 'cotes' || mode === 'pieces') {
      AT.controles.contacts(plateau).forEach(function (x) { x.cases.forEach(function (k) { res[k] = x[mode]; }); });
    } else if (mode === 'rations-vert' || mode === 'rations-rouge') {
      var camp = mode === 'rations-vert' ? 'vert' : 'rouge', sources = P.campsAuto(plateau)[camp];
      if (sources.length) {
        var d = P.distancesRations(plateau, sources);
        Object.keys(d).forEach(function (k) { res[k] = d[k]; });
      }
    } else if (mode === 'coordonnees') {
      Object.keys(P.cases(plateau)).forEach(function (k) { res[k] = k; });
    }
    return res;
  }

  /**
   * Une ville neutre posée ne se déplace, ne se tourne et ne se retire qu'à l'étape « Villes » : renvoie le message
   * de refus si la pièce `idPiece` est une ville neutre, null sinon (retouche permise).
   */
  function refusRetoucheVille(plateau, idPiece) {
    var piece = (plateau.pieces || []).filter(function (p) { return p.id === idPiece; })[0];
    return piece && piece.modele === 'VN' ? P.RAISON_VILLE_NEUTRE : null;
  }

  /** Cases où la tuile d'événement peut être posée (liste de clés). */
  function casesAdmissibles(plateau, idEvenement, occupees) {
    return Object.keys(P.cases(plateau)).filter(function (k) {
      return P.peutPoserEvenement(plateau, idEvenement, k, { occupees: occupees || [] }).ok;
    });
  }

  var NOMS_REGLES = {
    inventaire: '1. Inventaire', continuite: '2. Chevauchement et continuité', monoblocs: '3. Monoblocs et noyau',
    contact: '4. Contact entre tuiles', villes: '5. Villes', equilibre: '6. Équilibre et terrains', evenements: '7. Tuiles d’événement'
  };
  // Les contrôles s'affichent en deux groupes titrés (§9.4), puis les tuiles d'événement, jugées à part.
  var GROUPES = [
    { id: 'construction', nom: 'Construction', regles: ['inventaire', 'continuite', 'monoblocs', 'contact'] },
    { id: 'villes', nom: 'Villes', regles: ['villes', 'equilibre'] },
    { id: 'evenements', nom: 'Tuiles d’événement (essai)', regles: ['evenements'] }
  ];
  var TITRES_ETAPES = { construction: 'Construction en cours', villes: 'Construction terminée : posez les villes', complet: 'Plateau complet'
  };
  var NOMS_NIVEAUX = { erreur: 'Erreur', alerte: 'Alerte', info: 'Conforme' };

  // ------------------------------------------------------------------ la vue

  function creer(ctx) {
    var R = AT.rendu, el = R.el, K = AT.controles;
    var historique = [P.vide(1)], rang = 0;
    // Fiche de la bibliothèque à laquelle chaque pas d'historique est attaché (null = aucune), et pas où commence un
    // nouveau DOCUMENT (plateau généré, vierge, fichier ou fiche ouverts). Annuler après « Ouvrir » rend le plateau
    // précédent AVEC sa propre attache : « Mettre à jour » n'écrase jamais une autre fiche. « Enregistrer sous »
    // attache toute la lignée du document : annuler en deçà de l'enregistrement garde donc l'attache.
    var attaches = [null], debuts = [true];
    // Réglages partagés par les contrôles, le générateur et l'étape « Villes ». Jamais écrits dans AT.catalogue.REGLAGES.
    var reglages = {
      seuilContact: C.REGLAGES.seuilContact, mesureContact: C.REGLAGES.mesureContact,
      profondeurExtremite: C.REGLAGES.villes.profondeurExtremite,          // rangées des extrémités (étape « Villes »)
      remplissages: C.REGLAGES.generateur.remplissages                     // tuiles de remplissage permises au générateur
    };
    var selection = null;        // identifiant de la pièce sélectionnée
    var caseSelection = null;    // case cliquée lors de la sélection (pour retirer une tuile d'événement)
    var aPoser = null;           // {type: 'piece', modele, rotation} | {type: 'evenement', id} | {type: 'deplacement', rotation, decalage}
    var survol = null, epingle = null, affichage = 'rien', bilan = null;
    var mode = 'generer';        // mode de la colonne de gauche (voir MODES)
    var guide = null, pinceau = null, monoblocs = null, biblio = null, villes = null;      // panneaux des modes (créés à l'assemblage)

    function plateau() { return historique[rang]; }

    // ---------------------------------------------------------------- éléments fixes
    var champGraine = el('input', { type: 'text', id: 'pl-graine', classe: 'at-champ-graine', value: '1', maxlength: 64, autocomplete: 'off', spellcheck: 'false' });
    var choixSeuil = el('select', { id: 'pl-seuil' }, C.REGLAGES.seuilsContact.slice().reverse().map(function (s) {
      return el('option', { value: s, texte: s + ' tuiles' + (s === C.REGLAGES.seuilContact ? ' (défaut)' : ''), selected: s === reglages.seuilContact });
    }));
    var choixMesure = el('select', { id: 'pl-mesure' }, [
      el('option', { value: 'cotes', texte: 'côtés (cases voisines)', selected: reglages.mesureContact === 'cotes' }),
      el('option', { value: 'pieces', texte: 'pièces voisines distinctes', selected: reglages.mesureContact === 'pieces' })
    ]);
    // Les deux listes partent des réglages du catalogue, quel que soit l'ordre de leurs options.
    choixSeuil.value = String(reglages.seuilContact);
    choixMesure.value = reglages.mesureContact;
    var choixAffichage = el('select', { id: 'pl-affichage' }, [
      ['rien', 'rien'], ['cotes', 'contacts (côtés)'], ['pieces', 'contacts (pièces)'],
      ['rations-vert', 'rations depuis Vert'], ['rations-rouge', 'rations depuis Rouge'], ['coordonnees', 'coordonnées']
    ].map(function (x) { return el('option', { value: x[0], texte: x[1] }); }));
    var stockRemplissage = C.MODELES.R ? C.MODELES.R.nombre : 0, choixRemplissages = el('select', { id: 'pl-remplissages' });
    for (var nr = 0; nr <= stockRemplissage; nr++) choixRemplissages.appendChild(el('option', { value: nr, texte: nr === 0 ? 'aucune (défaut)' : nr + (nr > 1 ? ' tuiles au plus' : ' tuile au plus') }));
    choixRemplissages.value = String(reglages.remplissages);
    var avisGeneration = el('p', { classe: 'at-avis', id: 'pl-avis', hidden: true });
    var bandeauAncien = el('p', { classe: 'at-bandeau-ancien', id: 'pl-ancien', hidden: true,
      texte: 'Plateau de l’ancien catalogue (tuiles d’une case, villes posées pendant la construction) : il reste lisible et modifiable, et les contrôles s’y adaptent.' });
    var zoneOutil = el('div', { classe: 'at-outil', id: 'pl-outil' });
    var zoneControles = el('div', { id: 'pl-controles' });
    var infoPlateau = el('span', { classe: 'at-info-plateau', id: 'pl-info' });
    var btnAnnuler = bouton('Annuler', annuler, { id: 'pl-annuler', title: 'Annuler (Ctrl+Z)' });
    var btnRetablir = bouton('Rétablir', retablir, { id: 'pl-retablir', title: 'Rétablir (Ctrl+Y)' });

    var vue = R.creerVue({ etiquette: 'Plateau.', surClic: surClic, surAppui: surAppui, surSurvol: function (k) { survol = k; dessinerFantome(); } });
    vue.barre.appendChild(el('label', { classe: 'at-etiquette-ligne', for: 'pl-affichage', texte: 'Sur les cases : ' }));
    vue.barre.appendChild(choixAffichage);
    vue.barre.appendChild(infoPlateau);

    function bouton(texte, action, attrs) {
      var b = el('button', { type: 'button', texte: texte, sur: { click: action } });
      if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) b.setAttribute(k, attrs[k] === true ? '' : attrs[k]); });
      return b;
    }

    // ---------------------------------------------------------------- historique
    /**
     * Nouveau plateau courant. options.brut : ne pas recalculer les camps (fichier ouvert) ; options.garderVue ;
     * options.nouveauDocument : le plateau n'est plus celui de la fiche ouverte (généré, vierge, fichier, autre fiche).
     */
    function changer(nouveau, options) {
      var o = options || {}, attache = o.nouveauDocument ? null : attaches[rang];
      epingle = null;                 // les cases épinglées d'un constat ne valent que pour l'ancien plateau
      historique = historique.slice(0, rang + 1);
      attaches = attaches.slice(0, rang + 1);
      debuts = debuts.slice(0, rang + 1);
      historique.push(o.brut ? nouveau : P.avecCamps(nouveau));
      attaches.push(attache);
      debuts.push(!!o.nouveauDocument);
      if (historique.length > TAILLE_HISTORIQUE) { historique.shift(); attaches.shift(); debuts.shift(); }
      rang = historique.length - 1;
      biblio.attacher(attaches[rang]);
      rafraichir(o.garderVue !== false);
      biblio.planifier();
    }

    /**
     * Attache à la fiche `id` (ou détache, null) toute la LIGNÉE du plateau courant : les pas d'historique du même
     * document, avant et après le pas courant. Appelé par la bibliothèque (enregistrer sous, ouvrir, supprimer).
     */
    function lierLignee(id) {
      var i = rang;
      while (i > 0 && !debuts[i]) i -= 1;
      for (var k = i; k < historique.length && (k === i || !debuts[k]); k++) attaches[k] = id;
    }

    /** Vrai pendant un trait de pinceau, le glisser d'une pièce posée ou un glisser depuis la palette. */
    function gesteEnCours() { return vue.gesteEnCours() || (guide !== null && guide.glisseEnCours()); }

    function annuler() {
      // Annuler au milieu d'un geste ferait revenir, au relâchement, ce que l'on vient d'annuler.
      if (gesteEnCours()) { ctx.message('Geste en cours : relâchez d’abord la souris, puis annulez.', 'info'); return; }
      if (rang === 0) { ctx.message('Rien à annuler.', 'info'); return; }
      rang -= 1; biblio.attacher(attaches[rang]); quitterModes(); rafraichir(true); biblio.planifier(); ctx.message('Retouche annulée.', 'info');
    }

    function retablir() {
      if (gesteEnCours()) { ctx.message('Geste en cours : relâchez d’abord la souris, puis rétablissez.', 'info'); return; }
      if (rang >= historique.length - 1) { ctx.message('Rien à rétablir.', 'info'); return; }
      rang += 1; biblio.attacher(attaches[rang]); quitterModes(); rafraichir(true); biblio.planifier(); ctx.message('Retouche rétablie.', 'info');
    }

    function quitterModes() { selection = null; caseSelection = null; aPoser = null; epingle = null; }

    // ---------------------------------------------------------------- générer
    function generer(graine) {
      var g = graine === undefined ? AT.app.graineSaisie(champGraine.value) : graine;
      if (g === null) g = 1;
      champGraine.value = String(g);
      // Les pièces personnelles du document sont reportées dans le plateau généré (non posées) : r.note le dit.
      var r = AT.generateur.generer(g, { seuilContact: reglages.seuilContact, mesureContact: reglages.mesureContact, profondeurExtremite: reglages.profondeurExtremite,
        remplissages: reglages.remplissages, modeles: P.modeles(plateau()) });
      if (!r.ok) {
        avisGeneration.hidden = false;
        // Catalogue ou rayon hors de ce que le générateur sait poser : changer de graine n'y ferait rien.
        // Profondeur des extrémités en cause : la raison le dit et donne le remède, on n'en propose pas un autre.
        avisGeneration.textContent = 'Échec de la génération avec la graine « ' + g + ' » : ' + r.raison + (r.incompatible || r.profondeur ? '' : ' Essayez la graine suivante, ou le seuil de contact 2.');
        ctx.message('Échec de la génération : le plateau affiché n’a pas changé.', 'erreur');
        return false;
      }
      avisGeneration.hidden = true;
      quitterModes();
      changer(r.plateau, { garderVue: false, nouveauDocument: true });      // un plateau généré n'est plus celui de la fiche ouverte
      ctx.message('Plateau généré (graine ' + g + ', score d’équilibre ' + r.score + (r.remplissages ? ', ' + r.remplissages + (r.remplissages > 1 ? ' tuiles' : ' tuile') + ' de remplissage' : '') + ').' + (r.note ? ' ' + r.note : ''), 'info');
      return true;
    }

    // ---------------------------------------------------------------- retouche
    function pieceDe(id) { return plateau().pieces.filter(function (p) { return p.id === id; })[0] || null; }

    /** Phrase à ajouter au message quand une retouche a renvoyé des tuiles d'événement en réserve (chaîne vide sinon). */
    function mentionEvenements(avant, apres) {
      var n = avant.recouvrements.length - apres.recouvrements.length;
      return n > 0 ? ' ' + n + (n > 1 ? ' tuiles d’événement retournent' : ' tuile d’événement retourne') + ' en réserve.' : '';
    }

    /**
     * Phrase à ajouter quand une retouche du terrain a enlevé une ville de déploiement (la Plaine qui la portait a
     * été retirée, tournée ou déplacée) ; chaîne vide sinon.
     */
    function mentionVilles(avant, apres) { return AT.vueCreation.mentionVilles(avant, apres); }

    function choisirModele(id) {
      selection = null; caseSelection = null;
      aPoser = (aPoser && aPoser.type === 'piece' && aPoser.modele === id) ? null : { type: 'piece', modele: id, rotation: 0 };
      rafraichirOutils();
    }

    function choisirEvenement(id) {
      selection = null; caseSelection = null;
      aPoser = (aPoser && aPoser.type === 'evenement' && aPoser.id === id) ? null : { type: 'evenement', id: id };
      rafraichirOutils();
    }

    function tourner() {
      if (aPoser && (aPoser.type === 'piece' || aPoser.type === 'deplacement')) {
        aPoser.rotation = (aPoser.rotation + 1) % 6;
        rafraichirOutils();
        return;
      }
      if (!selection) { ctx.message('Sélectionnez d’abord une pièce du plateau ou du stock.', 'info'); return; }
      if (refusRetoucheVille(plateau(), selection)) { ctx.message(P.RAISON_VILLE_NEUTRE, 'erreur'); return; }
      var r = P.tourner(plateau(), selection, 1);
      if (!r.ok) { ctx.message('Rotation impossible : ' + r.raison, 'erreur'); return; }
      var mention = mentionEvenements(plateau(), r.plateau) + mentionVilles(plateau(), r.plateau);
      changer(r.plateau);
      ctx.message('Pièce tournée d’un sixième de tour.' + mention, mention ? 'alerte' : 'info');
    }

    function retirerSelection() {
      if (!selection) return;
      // Le noyau est fixe (règle de l'utilisateur) : ni la gomme ni « Retirer » ne l'enlèvent.
      var visee = pieceDe(selection), modeleVise = visee ? P.modele(plateau(), visee.modele) : null;
      if (modeleVise && modeleVise.noyau) {
        ctx.message('Le noyau est fixe : il ne se retire pas. Seuls « Vider le plateau » et « Nouveau plateau vierge » le font.', 'erreur');
        return;
      }
      if (refusRetoucheVille(plateau(), selection)) { ctx.message(P.RAISON_VILLE_NEUTRE, 'erreur'); return; }
      var r = P.retirer(plateau(), selection);
      if (!r.ok) { ctx.message(r.raison, 'erreur'); return; }
      selection = null; caseSelection = null; aPoser = null;
      var mention = mentionEvenements(plateau(), r.plateau) + mentionVilles(plateau(), r.plateau);
      changer(r.plateau);
      ctx.message('Pièce retirée : elle retourne au stock.' + mention, mention ? 'alerte' : 'info');
    }

    function commencerDeplacement() {
      var piece = pieceDe(selection);
      if (!piece) return;
      if (refusRetoucheVille(plateau(), selection)) { ctx.message(P.RAISON_VILLE_NEUTRE, 'erreur'); return; }
      aPoser = { type: 'deplacement', rotation: piece.rotation };
      rafraichirOutils();
    }

    function viderPlateau() {
      quitterModes();
      var vide = P.vide(plateau().graine);
      if (P.modeles(plateau()).length) vide.modeles = P.modeles(plateau());      // les pièces personnelles restent dans le document
      vide = P.avecProfondeurExtremite(vide, P.profondeurExtremite(plateau())).plateau;      // le réglage des extrémités aussi
      changer(vide);
      ctx.message('Plateau vidé : toutes les pièces sont au stock (Annuler pour revenir en arrière).', 'info');
    }

    /** Nouveau plateau vierge : le seul noyau, au centre. Les pièces personnelles du document sont gardées. */
    function nouveauVierge() {
      quitterModes();
      var vierge = P.vierge('fait main');
      if (P.modeles(plateau()).length) vierge.modeles = P.modeles(plateau());
      vierge = P.avecProfondeurExtremite(vierge, P.profondeurExtremite(plateau())).plateau;
      changer(vierge, { garderVue: false, nouveauDocument: true });
      ctx.message('Nouveau plateau vierge : le noyau est posé au centre (Annuler pour revenir au plateau précédent).', 'info');
    }

    /** Retire les pièces de modèle inconnu (elles n'occupent aucune case : aucun clic ne les atteint). */
    function retirerInconnues() {
      var n = AT.vueCreation.piecesInconnues(plateau()).length;
      if (!n) return;
      quitterModes();
      changer(AT.vueCreation.sansPiecesInconnues(plateau()));
      ctx.message(n + (n > 1 ? ' pièces de modèle inconnu retirées.' : ' pièce de modèle inconnu retirée.'), 'info');
    }

    // ---------------------------------------------------------------- glisser-déposer (mode « Créer à la main »)
    /** Une pièce de la palette est glissée au-dessus de l'écran en (x, y) : l'aperçu fantôme la suit. */
    function glisserModele(id, x, y) {
      if (!(aPoser && aPoser.type === 'piece' && aPoser.modele === id)) {
        selection = null; caseSelection = null;
        aPoser = { type: 'piece', modele: id, rotation: 0 };
        rafraichirZoneOutil();
      }
      survol = vue.caseSousEcran(x, y);
      dessinerFantome();
    }

    /** La pièce glissée est relâchée en (x, y) : posée si le point est sur le plateau et la pose possible. */
    function deposerModele(id, x, y) {
      var cle = vue.caseSousEcran(x, y), rotation = aPoser && aPoser.type === 'piece' && aPoser.modele === id ? aPoser.rotation : 0;
      aPoser = null; survol = null;
      if (!cle) { rafraichirOutils(); ctx.message('Pièce relâchée hors du plateau : rien n’est posé.', 'info'); return; }
      var p = H.decle(cle), r = P.poser(plateau(), id, p.q, p.r, rotation);
      if (!r.ok) { rafraichirOutils(); ctx.message('Pose refusée : ' + r.raison, 'erreur'); return; }
      changer(r.plateau);
      ctx.message('Pièce posée en (' + cle + ').', 'info');
    }

    function annulerGlisse() { aPoser = null; survol = null; rafraichirOutils(); }

    /**
     * Appui sur une case (voir AT.rendu.creerVue, option surAppui). Pinceau : le trait commence. Création guidée,
     * sans pièce en attente de pose : la pièce sous le pointeur se déplace en la glissant. Sinon null (la vue se déplace).
     */
    function surAppui(cle) {
      if (mode === 'pinceau') return pinceau.geste(cle);
      if (mode !== 'creer' || aPoser) return null;
      var toutes = P.cases(plateau());
      if (!possede.call(toutes, cle)) return null;
      var piece = pieceDe(toutes[cle].piece), depart = H.decle(cle);
      if (!piece) return null;
      // Une ville neutre ne se déplace pas en la glissant : un simple clic la sélectionne, un glisser est refusé.
      if (refusRetoucheVille(plateau(), piece.id)) {
        return {
          bouger: function () {},
          finir: function (k, aBouge) { if (aBouge) ctx.message(P.RAISON_VILLE_NEUTRE, 'erreur'); else surClic(cle); },
          annuler: function () {}
        };
      }
      var decalage = { q: piece.q - depart.q, r: piece.r - depart.r };
      var fin = function () { aPoser = null; survol = null; };
      return {
        bouger: function (k) {
          if (!(aPoser && aPoser.type === 'deplacement')) {
            selection = piece.id; caseSelection = null;
            aPoser = { type: 'deplacement', rotation: piece.rotation, decalage: decalage };
            rafraichirZoneOutil();
            dessinerMarques();
          }
          survol = k;
          dessinerFantome();
        },
        finir: function (k, aBouge) {
          if (!aBouge || !(aPoser && aPoser.type === 'deplacement')) { fin(); surClic(cle); return; }   // simple clic : sélection
          var rotation = aPoser.rotation, p = H.decle(k);
          fin();
          var r = deplacerPiece(plateau(), piece.id, p.q + decalage.q, p.r + decalage.r, rotation);
          if (!r.ok) { rafraichirOutils(); ctx.message('Déplacement refusé : ' + r.raison, 'erreur'); return; }
          selection = r.id; caseSelection = null;
          var mention = mentionEvenements(plateau(), r.plateau) + mentionVilles(plateau(), r.plateau);
          changer(r.plateau);
          ctx.message('Pièce déplacée.' + mention, mention ? 'alerte' : 'info');
        },
        annuler: function () { fin(); rafraichirOutils(); }
      };
    }

    function retirerEvenement(cle) {
      var r = P.retirerEvenement(plateau(), cle);
      if (!r.ok) { ctx.message(r.raison, 'erreur'); return; }
      changer(r.plateau, { brut: true });
      ctx.message('Tuile d’événement retirée.', 'info');
    }

    function surClic(cle) {
      var p = H.decle(cle), r;
      if (mode === 'pinceau') { pinceau.clic(cle); return; }
      if (mode === 'villes') { villes.clic(cle); return; }
      if (mode === 'monoblocs' || mode === 'bibliotheque') return;       // dans ces modes, le plateau ne se retouche pas
      if (aPoser && aPoser.type === 'piece') {
        r = P.poser(plateau(), aPoser.modele, p.q, p.r, aPoser.rotation);
        if (!r.ok) { ctx.message('Pose refusée : ' + r.raison, 'erreur'); return; }
        var reste = P.stock(r.plateau)[aPoser.modele];
        if (!reste || reste.restant <= 0) aPoser = null;                         // dernière pièce de ce modèle
        changer(r.plateau);
        ctx.message('Pièce posée en (' + cle + ').', 'info');
        return;
      }
      if (aPoser && aPoser.type === 'evenement') {
        r = P.poserEvenement(plateau(), aPoser.id, cle);
        if (!r.ok) { ctx.message('Pose refusée : ' + r.raison, 'erreur'); return; }
        aPoser = null;
        changer(r.plateau, { brut: true });
        ctx.message('Tuile d’événement posée en (' + cle + ').' + (r.alertes.length ? ' ' + r.alertes.join(' ') : ''), r.alertes.length ? 'alerte' : 'info');
        return;
      }
      if (aPoser && aPoser.type === 'deplacement') {
        var dec = aPoser.decalage || { q: 0, r: 0 };
        r = deplacerPiece(plateau(), selection, p.q + dec.q, p.r + dec.r, aPoser.rotation);
        if (!r.ok) { ctx.message('Déplacement refusé : ' + r.raison, 'erreur'); return; }
        selection = r.id; caseSelection = null; aPoser = null;
        var mention = mentionEvenements(plateau(), r.plateau) + mentionVilles(plateau(), r.plateau);
        changer(r.plateau);
        ctx.message('Pièce déplacée en (' + cle + ').' + mention, mention ? 'alerte' : 'info');
        return;
      }
      var toutes = P.cases(plateau());
      if (possede.call(toutes, cle)) {
        var id = toutes[cle].piece;
        if (selection === id && caseSelection === cle) { selection = null; caseSelection = null; } else { selection = id; caseSelection = cle; }
      } else {
        selection = null; caseSelection = null;
      }
      rafraichirOutils();
    }

    /** Touches propres à l'onglet (R, Suppr, Échap). Renvoie vrai si la touche a servi. */
    function touche(ev) {
      var t = ev.key.toLowerCase();
      if (t === 'r') { tourner(); return true; }
      if (t === 'delete') { if (selection && !aPoser) { retirerSelection(); return true; } return false; }
      if (t === 'escape') {
        if (aPoser) aPoser = null; else { selection = null; caseSelection = null; }
        rafraichirOutils();
        return true;
      }
      return false;
    }

    // ---------------------------------------------------------------- dessin
    function dessinerFantome() {
      // Aperçu de la pose : essai « à blanc » (stock, limites, chevauchement), vert si elle est possible, rouge sinon.
      var cles = [], refus = false;
      if (survol && aPoser && aPoser.type !== 'evenement') {
        var p = H.decle(survol), piece = aPoser.type === 'deplacement' ? pieceDe(selection) : null;
        var modele = piece ? piece.modele : aPoser.modele, dec = aPoser.decalage || { q: 0, r: 0 };
        if (modele) {
          var essai = AT.vueCreation.essaiPose(plateau(), modele, p.q + dec.q, p.r + dec.r, aPoser.rotation, piece ? piece.id : null);
          cles = essai.cles;
          refus = !essai.ok;
        }
      }
      vue.marquer('fantome', cles, refus ? 'at-fantome at-fantome-refus' : 'at-fantome', refus ? FANTOME_REFUS : FANTOME_OK);
    }

    function dessinerMarques() {
      var piece = selection ? pieceDe(selection) : null;
      vue.marquer('selection', piece ? P.casesPiece(piece, plateau()).map(function (c) { return c.cle; }) : [], 'at-selection');
      vue.marquer('admissibles', mode === 'villes' ? villes.places() : (aPoser && aPoser.type === 'evenement' ? casesAdmissibles(plateau(), aPoser.id) : []), 'at-admissible');
      vue.marquer('surbrillance', epingle ? epingle.cases : [], 'at-surbrillance');
      dessinerFantome();
    }

    function surligner(cases) { vue.marquer('surbrillance', cases, 'at-surbrillance'); }
    function finSurlignage() { vue.marquer('surbrillance', epingle ? epingle.cases : [], 'at-surbrillance'); }

    /** Élément qui met des cases en surbrillance au survol, au focus, et les épingle au clic. */
    function avecSurbrillance(element, cases, cle) {
      if (!cases.length) return element;
      element.addEventListener('mouseenter', function () { surligner(cases); });
      element.addEventListener('mouseleave', finSurlignage);
      element.addEventListener('focus', function () { surligner(cases); });
      element.addEventListener('blur', finSurlignage);
      element.addEventListener('click', function () {
        epingle = (epingle && epingle.cle === cle) ? null : { cle: cle, cases: cases };
        rafraichirControles();
        finSurlignage();
      });
      return element;
    }

    /** Nom d'un modèle, même inconnu du catalogue et du document (pièce orpheline d'un document monté à la main). */
    function nomModele(pl, id) {
      var m = P.modele(pl, id);
      return m ? m.nom : 'pièce de modèle inconnu (' + String(id).slice(0, 16) + ')';
    }

    function rafraichirZoneOutil() {
      var pl = plateau(), contenu = [], piece = selection ? pieceDe(selection) : null;
      if (selection && !piece) { selection = null; caseSelection = null; }
      if (aPoser && aPoser.type === 'piece' && !P.modele(pl, aPoser.modele)) aPoser = null;     // modèle disparu (annulation, suppression)

      if (aPoser && aPoser.type === 'piece') {
        contenu.push(el('p', { texte: 'À poser : ' + nomModele(pl, aPoser.modele) + ' (rotation ' + aPoser.rotation + ' / 6). Cliquez une case du plateau.' }));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Tourner (R)', tourner, { id: 'pl-tourner' }), bouton('Arrêter la pose (Échap)', function () { aPoser = null; rafraichirOutils(); })]));
      } else if (aPoser && aPoser.type === 'evenement') {
        contenu.push(el('p', { texte: 'Tuile d’événement à poser : ' + C.EVENEMENTS[aPoser.id].nom + '. Cliquez une case surlignée.' }));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Arrêter la pose (Échap)', function () { aPoser = null; rafraichirOutils(); })]));
      } else if (aPoser && aPoser.type === 'deplacement' && piece) {
        contenu.push(el('p', { texte: 'Déplacement de « ' + nomModele(pl, piece.modele) + ' » (rotation ' + aPoser.rotation + ' / 6) : cliquez la nouvelle case.' }));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Tourner (R)', tourner, { id: 'pl-tourner' }), bouton('Renoncer (Échap)', function () { aPoser = null; rafraichirOutils(); })]));
      } else if (piece) {
        var m = P.modele(pl, piece.modele), nb = m ? m.cases.length : 0;
        contenu.push(el('p', { texte: 'Pièce sélectionnée : ' + nomModele(pl, piece.modele) + ' (' + nb + (nb > 1 ? ' cases' : ' case') + '), en (' + H.cle(piece.q, piece.r) + ').' }));
        var ligne = [bouton('Tourner (R)', tourner, { id: 'pl-tourner' }), bouton('Déplacer', commencerDeplacement, { id: 'pl-deplacer' }), bouton('Retirer (Suppr)', retirerSelection, { id: 'pl-retirer' })];
        var toutes = P.cases(pl);
        if (caseSelection && possede.call(toutes, caseSelection) && toutes[caseSelection].evenement) {
          ligne.push(bouton('Retirer la tuile d’événement ' + toutes[caseSelection].evenement, function () { retirerEvenement(caseSelection); }, { id: 'pl-retirer-evenement' }));
        }
        contenu.push(el('div', { classe: 'at-ligne' }, ligne));
      } else {
        contenu.push(el('p', { classe: 'at-aide', texte: mode === 'creer'
          ? 'Cliquez une pièce de la palette pour la poser, ou une pièce du plateau pour la sélectionner.'
          : 'Cliquez une pièce du plateau pour la sélectionner (tourner, déplacer, retirer). Pour poser des pièces : mode « Créer à la main ».' }));
      }
      R.remplacer(zoneOutil, contenu);
    }

    /** Zone d'outil, panneaux des modes (palette, « reste à faire », monoblocs, bibliothèque) et marques sur le plateau. */
    function rafraichirOutils() {
      rafraichirZoneOutil();
      guide.rafraichir();
      villes.rafraichir();
      // L'étape « Villes » se propose d'elle-même quand la construction est terminée (bouton de mode mis en avant).
      var proposer = !!bilan && bilan.etape === 'villes' && mode !== 'villes' && !estAncien(plateau());
      boutonsModes.villes.setAttribute('data-propose', proposer ? 'oui' : 'non');
      boutonsModes.villes.title = proposer ? 'Construction terminée : c’est le moment de poser les villes' : 'Poser les villes de déploiement et les villes neutres';
      if (mode === 'monoblocs') monoblocs.rafraichir();
      biblio.rafraichir();
      btnAnnuler.disabled = rang === 0;
      btnRetablir.disabled = rang >= historique.length - 1;
      dessinerMarques();
    }

    function rafraichirControles() {
      var pl = plateau(), blocs = [];
      bilan = K.tout(pl, reglages);
      blocs.push(el('p', { classe: 'at-bilan ' + (bilan.erreurs ? 'at-niveau-erreur' : (bilan.alertes ? 'at-niveau-alerte' : 'at-niveau-info')), id: 'pl-bilan',
        texte: bilan.erreurs ? bilan.erreurs + ' erreur(s), ' + bilan.alertes + ' alerte(s)' : (bilan.alertes ? 'Aucune erreur, ' + bilan.alertes + ' alerte(s)' : 'Plateau conforme : aucune erreur, aucune alerte') }));
      // Étape du plateau (§9.1), en tête : construction en cours, villes à poser, ou complet. Un plateau construit
      // sans villes n'est pas en erreur : il est « à l'étape des villes ».
      var ancien = estAncien(pl);
      // Ancien plateau : les étapes du catalogue 2 ne s'y appliquent pas (ses pièces ne sont pas celles du catalogue 2).
      // À l'inverse, une tuile d'une case peinte au pinceau ne fait pas d'un plateau du catalogue 2 un « ancien plateau » :
      // la mention du modèle est alors retirée de l'affichage.
      var mentionAncien = ' Ce plateau porte des tuiles de l’ancien catalogue.';
      blocs.unshift(el('p', { classe: 'at-etape at-etape-' + (ancien ? 'ancien' : bilan.etape), id: 'pl-etape', 'data-etape': ancien ? 'ancien' : bilan.etape }, ancien ? [
        el('strong', { id: 'pl-etape-titre', texte: 'Plateau de l’ancien catalogue' }),
        el('span', { classe: 'at-etape-detail', texte: ' Il se juge avec les contrôles de l’ancien catalogue ; les étapes du catalogue 2 (construction, puis villes) ne s’y appliquent pas.' })
      ] : [
        el('strong', { id: 'pl-etape-titre', texte: TITRES_ETAPES[bilan.etape] || '' }),
        el('span', { classe: 'at-etape-detail', texte: ' ' + String(bilan.etapeMessage || '').split(mentionAncien).join('') })
      ]));
      bandeauAncien.hidden = !ancien;
      var liste = el('ul', { classe: 'at-constats' });
      GROUPES.forEach(function (groupe) {
        var dansGroupe = bilan.resultats.filter(function (x) { return groupe.regles.indexOf(x.regle) !== -1; });
        var nbErreurs = dansGroupe.filter(function (x) { return x.niveau === 'erreur'; }).length, nbAlertes = dansGroupe.filter(function (x) { return x.niveau === 'alerte'; }).length;
        var etatGroupe = nbErreurs ? nbErreurs + (nbErreurs > 1 ? ' erreurs' : ' erreur') : (nbAlertes ? nbAlertes + (nbAlertes > 1 ? ' alertes' : ' alerte') : 'conforme');
        if (groupe.id === 'villes' && !nbErreurs && !ancien && bilan.etape !== 'complet') etatGroupe = bilan.etape === 'villes' ? 'à poser' : 'après la construction';
        liste.appendChild(el('li', { classe: 'at-groupe', id: 'pl-groupe-' + groupe.id, 'data-groupe': groupe.id }, [
          el('span', { classe: 'at-groupe-nom', texte: groupe.nom }),
          el('span', { classe: 'at-groupe-etat ' + (nbErreurs ? 'at-niveau-erreur' : (nbAlertes ? 'at-niveau-alerte' : 'at-niveau-info')), texte: etatGroupe })
        ]));
      groupe.regles.forEach(function (regle) {
        var constats = bilan.resultats.filter(function (x) { return x.regle === regle; });
        liste.appendChild(el('li', { classe: 'at-regle', texte: NOMS_REGLES[regle] }));
        constats.forEach(function (x, i) {
          var cle = regle + '/' + i + '/' + x.message, epingleIci = !!(epingle && epingle.cle === cle);
          var corps = [el('span', { classe: 'at-badge at-niveau-' + x.niveau, texte: NOMS_NIVEAUX[x.niveau] }), el('span', { texte: ' ' + x.message })];
          var item;
          if (x.cases.length) {
            corps.push(el('span', { classe: 'at-voir', texte: epingleIci ? ' (cases affichées : cliquer pour masquer)' : ' (survoler ou cliquer : ' + x.cases.length + ' case(s))' }));
            item = avecSurbrillance(el('button', { type: 'button', classe: 'at-constat', 'data-regle': regle, 'data-groupe': groupe.id, 'data-niveau': x.niveau, 'aria-pressed': epingleIci ? 'true' : 'false' }, corps), x.cases, cle);
          } else {
            item = el('div', { classe: 'at-constat', 'data-regle': regle, 'data-groupe': groupe.id, 'data-niveau': x.niveau }, corps);
          }
          liste.appendChild(el('li', null, item));
        });
      });
      });
      blocs.push(liste);

      // Tableau d'équilibre.
      var e = bilan.equilibre, numeros = R.numerosVilles(pl);
      blocs.push(el('h3', { texte: 'Équilibre : coût en rations vers chaque ville' }));
      if (!e.calculable) {
        blocs.push(el('p', { classe: 'at-aide', texte: 'Non calculable : il faut les villes de déploiement des deux camps (elles se posent à l’étape « Villes », une fois le terrain construit).' }));
      } else {
        var corpsTable = el('tbody');
        var NOMS_TYPES = { centre: ' (centre)', neutre: ' (neutre)', vert: ' (Vert)', rouge: ' (Rouge)' };
        e.villes.forEach(function (v) {
          var camp = NOMS_TYPES[v.type] || '';
          var ligne = el('tr', { tabindex: 0, 'data-type': v.type || '' }, [
            el('th', { scope: 'row', texte: (numeros[v.cle] || '?') + camp }),
            el('td', { texte: '(' + v.cle + ')' }),
            el('td', { texte: v.vert === null ? '—' : v.vert }),
            el('td', { texte: v.rouge === null ? '—' : v.rouge }),
            el('td', { texte: v.ecart === null ? '—' : v.ecart })
          ]);
          corpsTable.appendChild(avecSurbrillance(ligne, [v.cle], 'ville/' + v.cle));
        });
        // Villes de déploiement adverses : coûts de chaque camp vers les villes de l'autre, comparés rang par rang.
        var adv = e.adverses || { vert: [], rouge: [], ecart: null };
        var pied = el('tfoot', null, el('tr', { id: 'pl-adverses' }, [
          el('th', { scope: 'row', colspan: 2, texte: 'Villes de déploiement adverses' }),
          el('td', { texte: adv.vert.length ? adv.vert.join(' et ') : '—' }),
          el('td', { texte: adv.rouge.length ? adv.rouge.join(' et ') : '—' }),
          el('td', { texte: adv.ecart === null ? '—' : adv.ecart })
        ]));
        blocs.push(el('table', { classe: 'at-table', id: 'pl-equilibre' }, [
          el('thead', null, el('tr', null, ['Ville', 'Case', 'Depuis Vert', 'Depuis Rouge', 'Écart'].map(function (t) { return el('th', { scope: 'col', texte: t }); }))),
          corpsTable,
          pied
        ]));
        blocs.push(el('p', { id: 'pl-score', texte: 'Score d’équilibre : ' + e.score + ' (0 = équilibré). Il additionne l’écart entre Vert et Rouge vers le centre et vers chaque ville neutre'
          + (e.adverses && e.adverses.ecart !== null ? ', et l’écart vers les villes de déploiement adverses (' + e.adverses.ecart + ').' : '.') }));
      }

      // Répartition des terrains.
      var n = K.repartition(pl), visee = C.REGLAGES.repartitionVisee;
      blocs.push(el('h3', { texte: 'Terrains (hors villes et montagnes)' }));
      var lignes = ['plaine', 'foret', 'marais'].map(function (t) {
        var part = n.total ? 100 * n[t] / n.total : 0;
        return el('tr', null, [
          el('th', { scope: 'row' }, [R.pastilleTerrain(t), ' ' + R.nomTerrain(t)]),
          el('td', { texte: n[t] }),
          el('td', { texte: part.toFixed(1).replace('.', ',') + ' %' }),
          el('td', { texte: String(visee[t]).replace('.', ',') + ' %' })
        ]);
      });
      blocs.push(el('table', { classe: 'at-table', id: 'pl-terrains' }, [
        el('thead', null, el('tr', null, ['Terrain', 'Cases', 'Part', 'Visé'].map(function (t) { return el('th', { scope: 'col', texte: t }); }))),
        el('tbody', null, lignes)
      ]));
      R.remplacer(zoneControles, blocs);
    }

    function rafraichir(garderVue) {
      var pl = plateau();
      // La profondeur des extrémités est celle du DOCUMENT affiché (champ enregistré, sinon le réglage par défaut) :
      // elle suit donc l'ouverture d'un fichier ou d'une fiche, l'annulation et le rétablissement.
      reglages.profondeurExtremite = P.profondeurExtremite(pl);
      vue.afficher(scene(pl, true), garderVue);
      infoPlateau.textContent = 'Graine du plateau : ' + pl.graine + ' ; ' + pl.pieces.length + ' pièce(s), ' + Object.keys(P.cases(pl)).length + ' case(s)';
      rafraichirControles();
      rafraichirOutils();
    }

    /**
     * Scène à dessiner : la grille vide (rayon 7) s'ajoute dans les modes de création ; à l'étape « Villes », le
     * cadre s'élargit d'une case autour du plateau (les villes neutres se posent sur des cases vides, contre le bord).
     */
    function scene(pl, avecEtiquettes) {
      var s = { plateau: pl };
      if (avecEtiquettes) s.etiquettes = etiquettes(pl, affichage);
      if (mode === 'creer' || mode === 'pinceau') s.grille = R.casesGrille(pl, AT.vueCreation.RAYON_GRILLE);
      if (mode === 'villes') s.autour = AT.vueVilles.anneau(pl);
      return s;
    }

    /** Un vrai plateau de l'ancien catalogue porte des tuiles de ville d'une case (une forêt peinte au pinceau ne suffit pas). */
    function estAncien(pl) { return AT.vueCreation.estAncien(pl); }

    /** Ce qui élargit le cadre selon le mode : il faut recadrer quand cela change. */
    function cadreDuMode(m) { return (m === 'creer' || m === 'pinceau') ? 'grille' : (m === 'villes' ? 'anneau' : 'plateau'); }

    /** Aperçu d'un plateau provisoire (trait de pinceau en cours), hors historique et sans contrôles ; null : retour au plateau courant. */
    function apercu(provisoire) { vue.afficher(provisoire ? scene(provisoire, false) : scene(plateau(), true), true); }

    // ---------------------------------------------------------------- modes
    function choisirMode(nouveau) {
      if (!MODES.some(function (m) { return m.id === nouveau; })) return false;
      var cadreAvant = cadreDuMode(mode);
      quitterModes();
      mode = nouveau;
      var cadreApres = cadreDuMode(mode), grilleApres = mode === 'creer' || mode === 'pinceau';
      if (mode === 'villes') villes.entrer();
      MODES.forEach(function (m) {
        boutonsModes[m.id].setAttribute('aria-pressed', m.id === mode ? 'true' : 'false');
        panneauxModes[m.id].hidden = m.id !== mode;
      });
      zoneOutil.hidden = !(mode === 'generer' || mode === 'creer');
      guide.reste.hidden = !(grilleApres || mode === 'villes');
      element.setAttribute('data-mode', mode);
      biblio.montrer(mode === 'bibliotheque');
      rafraichir(cadreAvant === cadreApres);            // la grille ou l'anneau changent le cadre : on recadre
      return true;
    }

    /** Ouvre un plateau de la bibliothèque (annulable comme une retouche). */
    function ouvrirDocument(nouveau) {
      quitterModes();
      changer(nouveau, { brut: true, garderVue: false, nouveauDocument: true });
    }

    /** Reprend le travail en cours sauvegardé, s'il y en a un. Renvoie {repris, modifie, raison}. */
    function reprendreTravail() {
      var r = biblio.reprendre();
      if (!r.ok || !r.plateau) return { repris: false, modifie: null, raison: r.ok ? null : r.raison, corrompu: !!r.corrompu };
      quitterModes();
      historique = [r.plateau];
      attaches = [biblio.ouvert()];
      debuts = [true];
      rang = 0;
      rafraichir(false);
      return { repris: true, modifie: r.modifie, raison: null };
    }

    // ---------------------------------------------------------------- fichiers
    function texteEnregistrement() { return P.serialiser(plateau()); }

    function enregistrer() {
      var texte = texteEnregistrement(), relu = P.lire(texte);
      if (!relu.ok) {
        ctx.message('Enregistrement refusé, le fichier ne pourrait pas être rouvert : ' + relu.erreurs[0], 'erreur');
        return false;
      }
      ctx.telecharger('plateau-graine-' + AT.app.nomSur(plateau().graine) + '.json', texte, 'application/json');
      return true;
    }

    /** Ouvre le texte d'un fichier de plateau (validé par AT.plateau.lire). Renvoie vrai si le plateau est accepté. */
    function ouvrirTexte(texte) {
      var r = P.lire(texte);
      if (!r.ok) { ctx.message('Fichier refusé : ' + r.erreurs[0], 'erreur'); return false; }
      quitterModes();
      changer(r.plateau, { brut: true, garderVue: false, nouveauDocument: true });
      ctx.message('Plateau ouvert (' + r.plateau.pieces.length + ' pièces). Les contrôles sont à jour.', 'info');
      return true;
    }

    function imageExport() {
      return R.svgAutonome({ plateau: plateau() }, { titre: 'Plateau, graine ' + plateau().graine });
    }

    function exporterSvg() {
      ctx.telecharger('plateau-graine-' + AT.app.nomSur(plateau().graine) + '.svg', imageExport().texte, 'image/svg+xml');
    }

    function exporterPng(rappel) {
      var nom = 'plateau-graine-' + AT.app.nomSur(plateau().graine) + '.png';
      R.versPng(imageExport(), 2, function (blob) {
        if (blob) ctx.telecharger(nom, blob, 'image/png');
        else ctx.message('Ce navigateur a refusé de produire le PNG : utilisez l’export SVG.', 'erreur');
        if (typeof rappel === 'function') rappel(blob);
      });
    }

    // ---------------------------------------------------------------- assemblage
    choixSeuil.addEventListener('change', function () { reglages.seuilContact = parseInt(choixSeuil.value, 10); rafraichir(true); });
    choixMesure.addEventListener('change', function () { reglages.mesureContact = choixMesure.value; rafraichir(true); });
    choixRemplissages.addEventListener('change', function () { reglages.remplissages = parseInt(choixRemplissages.value, 10); });
    choixAffichage.addEventListener('change', function () { affichage = choixAffichage.value; rafraichir(true); });
    champGraine.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') generer(); });

    var legende = el('div', { classe: 'at-legende', id: 'pl-legende', 'aria-label': 'Légende' },
      R.ORDRE_TERRAINS.map(function (t) { return el('span', { classe: 'at-legende-item' }, [R.pastilleTerrain(t), R.nomTerrain(t)]); })
        .concat(C.ORDRE_EVENEMENTS.map(function (id) {
          return el('span', { classe: 'at-legende-item' }, [R.pastilleTerrain(C.EVENEMENTS[id].terrain, true), id + ' ' + C.EVENEMENTS[id].nom]);
        }))
        .concat([
          el('span', { classe: 'at-legende-item' }, [R.pastilleTuile('vd-vert'), 'ville de déploiement de Vert, posée sur une Plaine (haut)']),
          el('span', { classe: 'at-legende-item' }, [R.pastilleTuile('vd-rouge'), 'ville de déploiement de Rouge, posée sur une Plaine (bas)']),
          el('span', { classe: 'at-legende-item' }, [R.pastilleTuile('vn'), 'ville neutre (tuile ajoutée sur un flanc)']),
          el('span', { classe: 'at-legende-item' }, [R.pastilleTuile('remplissage'), 'tuile de remplissage (facultative)']),
          el('span', { classe: 'at-legende-item' }, [el('span', { classe: 'at-trait-epais' }), 'contour d’une pièce monobloc']),
          el('span', { classe: 'at-legende-item' }, [el('span', { classe: 'at-trait-epais at-trait-noyau' }), 'noyau'])
        ]));

    // Panneaux des modes de création (lot E).
    var accesCommun = {
      plateau: plateau, bilan: function () { return bilan; }, reglages: function () { return reglages; },
      changer: function (nouveau) { changer(nouveau); }, apercu: apercu,
      message: ctx.message, confirmer: ctx.confirmer, telecharger: ctx.telecharger, ouvrirFichier: ctx.ouvrirFichier,
      etat: function () { return { aPoser: aPoser, selection: selection, mode: mode }; },
      choisirModele: choisirModele, choisirEvenement: choisirEvenement,
      glisserModele: glisserModele, deposerModele: deposerModele, annulerGlisse: annulerGlisse,
      nouveauVierge: nouveauVierge, vider: viderPlateau, retirerInconnues: retirerInconnues,
      ouvrirDocument: ouvrirDocument, indiquer: ctx.indiquerPlateau, lier: lierLignee,
      redessiner: function () { rafraichir(true); }, allerAuxVilles: function () { choisirMode('villes'); },
      bibliotheque: function () { return biblio.liste(); }
    };
    biblio = AT.vueBibliotheque.creer(accesCommun, { stockage: ctx.stockage });
    guide = AT.vueCreation.creerGuide(accesCommun);
    pinceau = AT.vueCreation.creerPinceau(accesCommun);
    monoblocs = AT.vueMonoblocs.creer(accesCommun);
    villes = AT.vueVilles.creer(accesCommun);

    var boutonsModes = {}, panneauxModes = {};
    var bascule = el('div', { classe: 'at-modes', id: 'pl-modes', role: 'group', 'aria-label': 'Mode de travail sur le plateau' }, MODES.map(function (m) {
      boutonsModes[m.id] = el('button', { type: 'button', id: 'pl-mode-' + m.id, texte: m.nom, 'aria-pressed': m.id === mode ? 'true' : 'false', sur: { click: function () { choisirMode(m.id); } } });
      return boutonsModes[m.id];
    }));

    panneauxModes.generer = el('div', { classe: 'at-mode-panneau', id: 'ge-panneau' }, [
      el('fieldset', null, [
        el('legend', { texte: 'Générer' }),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-graine', texte: 'Graine' }), champGraine]),
        el('div', { classe: 'at-ligne' }, [
          bouton('Générer', function () { generer(); }, { id: 'pl-generer', class: 'at-principal-bouton' }),
          bouton('Graine suivante', function () { generer(AT.app.graineSuivante(AT.app.graineSaisie(champGraine.value))); }, { id: 'pl-suivante' })
        ]),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-seuil', texte: 'Seuil de contact' }), choixSeuil]),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-mesure', texte: 'Mesure' }), choixMesure]),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-remplissages', texte: 'Tuiles de remplissage permises' }), choixRemplissages]),
        el('p', { classe: 'at-aide', texte: 'Le générateur construit le terrain en monoblocs, comme des joueurs, puis pose les villes. Les tuiles de remplissage (une case de plaine) restent l’exception : il en pose le moins possible.' }),
        avisGeneration
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Fichier et image' }),
        el('div', { classe: 'at-ligne' }, [
          bouton('Enregistrer', enregistrer, { id: 'pl-enregistrer', title: 'Enregistrer le plateau (fichier JSON)' }),
          bouton('Ouvrir…', function () { ctx.ouvrirFichier(ouvrirTexte); }, { id: 'pl-ouvrir', title: 'Ouvrir un plateau enregistré' })
        ]),
        el('div', { classe: 'at-ligne' }, [
          bouton('Image SVG', exporterSvg, { id: 'pl-svg' }),
          bouton('Image PNG', function () { exporterPng(); }, { id: 'pl-png' }),
          bouton('Imprimer', function () { window.print(); }, { id: 'pl-imprimer' })
        ])
      ])
    ]);
    panneauxModes.creer = guide.element;
    panneauxModes.pinceau = pinceau.element;
    panneauxModes.villes = villes.element;
    panneauxModes.monoblocs = monoblocs.element;
    panneauxModes.bibliotheque = biblio.element;
    MODES.forEach(function (m) { panneauxModes[m.id].hidden = m.id !== mode; });
    guide.reste.hidden = true;

    var gauche = el('div', { classe: 'at-colonne at-colonne-gauche' }, [
      bascule,
      el('div', { classe: 'at-ligne at-ligne-historique' }, [btnAnnuler, btnRetablir]),
      zoneOutil,
      MODES.map(function (m) { return panneauxModes[m.id]; })
    ]);
    var centre = el('div', { classe: 'at-centre' }, [bandeauAncien, vue.element, legende]);
    var droite = el('div', { classe: 'at-colonne at-colonne-droite' }, [guide.reste, el('h2', { texte: 'Contrôles du plateau' }), zoneControles]);
    var element = el('div', { classe: 'at-ecran at-ecran-plateau', 'data-mode': mode }, [gauche, centre, droite]);

    rafraichir(false);

    return {
      element: element, vue: vue,
      plateau: plateau, bilan: function () { return bilan; }, reglages: function () { return reglages; },
      generer: generer, annuler: annuler, retablir: retablir, touche: touche,
      enregistrer: enregistrer, texteEnregistrement: texteEnregistrement, ouvrirTexte: ouvrirTexte,
      imageExport: imageExport, exporterSvg: exporterSvg, exporterPng: exporterPng,
      etat: function () { return { selection: selection, aPoser: aPoser, rang: rang, longueur: historique.length, mode: mode }; },
      choisirMode: choisirMode, mode: function () { return mode; },
      bibliotheque: biblio, monoblocs: monoblocs, pinceau: pinceau, villes: villes,
      reprendreTravail: reprendreTravail, activerSauvegarde: biblio.activer, sauverTravail: biblio.sauverTravail
    };
  }

  AT.vuePlateau = { MODES: MODES, creer: creer, deplacerPiece: deplacerPiece, refusRetoucheVille: refusRetoucheVille, etiquettes: etiquettes, casesAdmissibles: casesAdmissibles };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vuePlateau;
})();
