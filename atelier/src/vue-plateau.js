/*
 * vue-plateau.js : onglet « Plateau » (lot C). Générer, retoucher à la main, contrôler en direct,
 * enregistrer / ouvrir, exporter, imprimer.
 * Dépend de AT.hex, AT.catalogue, AT.plateau, AT.controles, AT.generateur, AT.rendu ; AT.app à l'exécution.
 *
 * Après chaque retouche (poser, retirer, tourner, déplacer), les villes de déploiement sont recalculées
 * par AT.plateau.avecCamps. Un fichier ouvert est affiché tel quel : les contrôles disent ce qui ne va pas.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;
  var TAILLE_HISTORIQUE = 200;

  // ------------------------------------------------------------------ logique pure (testée sous Node)

  /**
   * Déplace une pièce posée : son ancre va en (q, r), avec la rotation donnée (la sienne par défaut).
   * C'est un retrait suivi d'une pose : l'identifiant de la pièce change. Si la pose est refusée,
   * le plateau reçu est rendu inchangé. Renvoie {ok, plateau, id, raison}.
   */
  function deplacerPiece(plateau, idPiece, q, r, rotation) {
    var piece = (plateau.pieces || []).filter(function (p) { return p.id === idPiece; })[0];
    if (!piece) return { ok: false, plateau: plateau, raison: 'Pièce introuvable sur le plateau.' };
    var retrait = P.retirer(plateau, idPiece);
    var pose = P.poser(retrait.plateau, piece.modele, q, r, rotation === undefined ? piece.rotation : rotation);
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

  /** Cases où la tuile d'événement peut être posée (liste de clés). */
  function casesAdmissibles(plateau, idEvenement, occupees) {
    return Object.keys(P.cases(plateau)).filter(function (k) {
      return P.peutPoserEvenement(plateau, idEvenement, k, { occupees: occupees || [] }).ok;
    });
  }

  var NOMS_REGLES = {
    inventaire: '1. Inventaire', continuite: '2. Chevauchement et continuité', monoblocs: '3. Monoblocs et noyau',
    villes: '4. Villes', contact: '5. Contact entre tuiles', equilibre: '6. Équilibre et terrains', evenements: '7. Tuiles d’événement'
  };
  var ORDRE_REGLES = ['inventaire', 'continuite', 'monoblocs', 'villes', 'contact', 'equilibre', 'evenements'];
  var NOMS_NIVEAUX = { erreur: 'Erreur', alerte: 'Alerte', info: 'Conforme' };

  // ------------------------------------------------------------------ la vue

  function creer(ctx) {
    var R = AT.rendu, el = R.el, K = AT.controles;
    var historique = [P.vide(1)], rang = 0;
    var reglages = { seuilContact: C.REGLAGES.seuilContact, mesureContact: C.REGLAGES.mesureContact };
    var selection = null;        // identifiant de la pièce sélectionnée
    var caseSelection = null;    // case cliquée lors de la sélection (pour retirer une tuile d'événement)
    var aPoser = null;           // {type: 'piece', modele, rotation} | {type: 'evenement', id} | {type: 'deplacement', rotation}
    var survol = null, epingle = null, affichage = 'rien', bilan = null;

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
    var avisGeneration = el('p', { classe: 'at-avis', id: 'pl-avis', hidden: true });
    var zoneOutil = el('div', { classe: 'at-outil', id: 'pl-outil' });
    var zoneStock = el('div', { classe: 'at-stock', id: 'pl-stock' });
    var zoneControles = el('div', { id: 'pl-controles' });
    var infoPlateau = el('span', { classe: 'at-info-plateau', id: 'pl-info' });
    var btnAnnuler = bouton('Annuler', annuler, { id: 'pl-annuler', title: 'Annuler (Ctrl+Z)' });
    var btnRetablir = bouton('Rétablir', retablir, { id: 'pl-retablir', title: 'Rétablir (Ctrl+Y)' });

    var vue = R.creerVue({ etiquette: 'Plateau.', surClic: surClic, surSurvol: function (k) { survol = k; dessinerFantome(); } });
    vue.barre.appendChild(el('label', { classe: 'at-etiquette-ligne', for: 'pl-affichage', texte: 'Sur les cases : ' }));
    vue.barre.appendChild(choixAffichage);
    vue.barre.appendChild(infoPlateau);

    function bouton(texte, action, attrs) {
      var b = el('button', { type: 'button', texte: texte, sur: { click: action } });
      if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) b.setAttribute(k, attrs[k] === true ? '' : attrs[k]); });
      return b;
    }

    // ---------------------------------------------------------------- historique
    /** Nouveau plateau courant. options.brut : ne pas recalculer les camps (fichier ouvert) ; options.garderVue. */
    function changer(nouveau, options) {
      var o = options || {};
      epingle = null;                 // les cases épinglées d'un constat ne valent que pour l'ancien plateau
      historique = historique.slice(0, rang + 1);
      historique.push(o.brut ? nouveau : P.avecCamps(nouveau));
      if (historique.length > TAILLE_HISTORIQUE) historique.shift();
      rang = historique.length - 1;
      rafraichir(o.garderVue !== false);
    }

    function annuler() {
      if (rang === 0) { ctx.message('Rien à annuler.', 'info'); return; }
      rang -= 1; quitterModes(); rafraichir(true); ctx.message('Retouche annulée.', 'info');
    }

    function retablir() {
      if (rang >= historique.length - 1) { ctx.message('Rien à rétablir.', 'info'); return; }
      rang += 1; quitterModes(); rafraichir(true); ctx.message('Retouche rétablie.', 'info');
    }

    function quitterModes() { selection = null; caseSelection = null; aPoser = null; epingle = null; }

    // ---------------------------------------------------------------- générer
    function generer(graine) {
      var g = graine === undefined ? AT.app.graineSaisie(champGraine.value) : graine;
      if (g === null) g = 1;
      champGraine.value = String(g);
      var r = AT.generateur.generer(g, { seuilContact: reglages.seuilContact, mesureContact: reglages.mesureContact });
      if (!r.ok) {
        avisGeneration.hidden = false;
        // Catalogue ou rayon hors de ce que le générateur sait poser : changer de graine n'y ferait rien.
        avisGeneration.textContent = 'Échec de la génération avec la graine « ' + g + ' » : ' + r.raison + (r.incompatible ? '' : ' Essayez la graine suivante, ou le seuil de contact 2.');
        ctx.message('Échec de la génération : le plateau affiché n’a pas changé.', 'erreur');
        return false;
      }
      avisGeneration.hidden = true;
      quitterModes();
      changer(r.plateau, { garderVue: false });
      ctx.message('Plateau généré (graine ' + g + ', score d’équilibre ' + r.score + ').', 'info');
      return true;
    }

    // ---------------------------------------------------------------- retouche
    function pieceDe(id) { return plateau().pieces.filter(function (p) { return p.id === id; })[0] || null; }

    /** Phrase à ajouter au message quand une retouche a renvoyé des tuiles d'événement en réserve (chaîne vide sinon). */
    function mentionEvenements(avant, apres) {
      var n = avant.recouvrements.length - apres.recouvrements.length;
      return n > 0 ? ' ' + n + (n > 1 ? ' tuiles d’événement retournent' : ' tuile d’événement retourne') + ' en réserve.' : '';
    }

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
      var r = P.tourner(plateau(), selection, 1);
      if (!r.ok) { ctx.message('Rotation impossible : ' + r.raison, 'erreur'); return; }
      var mention = mentionEvenements(plateau(), r.plateau);
      changer(r.plateau);
      ctx.message('Pièce tournée d’un sixième de tour.' + mention, mention ? 'alerte' : 'info');
    }

    function retirerSelection() {
      if (!selection) return;
      var r = P.retirer(plateau(), selection);
      if (!r.ok) { ctx.message(r.raison, 'erreur'); return; }
      selection = null; caseSelection = null; aPoser = null;
      var mention = mentionEvenements(plateau(), r.plateau);
      changer(r.plateau);
      ctx.message('Pièce retirée : elle retourne au stock.' + mention, mention ? 'alerte' : 'info');
    }

    function commencerDeplacement() {
      var piece = pieceDe(selection);
      if (!piece) return;
      aPoser = { type: 'deplacement', rotation: piece.rotation };
      rafraichirOutils();
    }

    function viderPlateau() {
      quitterModes();
      changer(P.vide(plateau().graine));
      ctx.message('Plateau vidé : toutes les pièces sont au stock (Annuler pour revenir en arrière).', 'info');
    }

    function retirerEvenement(cle) {
      var r = P.retirerEvenement(plateau(), cle);
      if (!r.ok) { ctx.message(r.raison, 'erreur'); return; }
      changer(r.plateau, { brut: true });
      ctx.message('Tuile d’événement retirée.', 'info');
    }

    function surClic(cle) {
      var p = H.decle(cle), r;
      if (aPoser && aPoser.type === 'piece') {
        r = P.poser(plateau(), aPoser.modele, p.q, p.r, aPoser.rotation);
        if (!r.ok) { ctx.message('Pose refusée : ' + r.raison, 'erreur'); return; }
        if (P.stock(r.plateau)[aPoser.modele].restant <= 0) aPoser = null;      // dernière pièce de ce modèle
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
        r = deplacerPiece(plateau(), selection, p.q, p.r, aPoser.rotation);
        if (!r.ok) { ctx.message('Déplacement refusé : ' + r.raison, 'erreur'); return; }
        selection = r.id; caseSelection = null; aPoser = null;
        var mention = mentionEvenements(plateau(), r.plateau);
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
      var cles = [], refus = false;
      if (survol && aPoser && aPoser.type !== 'evenement') {
        var p = H.decle(survol), piece = aPoser.type === 'deplacement' ? pieceDe(selection) : null;
        var modele = piece ? piece.modele : aPoser.modele;
        if (modele) {
          var occupees = P.cases({ pieces: plateau().pieces.filter(function (x) { return !piece || x.id !== piece.id; }) }, { sansRecouvrements: true });
          P.casesModele(modele, p.q, p.r, aPoser.rotation).forEach(function (c) {
            cles.push(c.cle);
            if (possede.call(occupees, c.cle)) refus = true;
          });
        }
      }
      vue.marquer('fantome', cles, refus ? 'at-fantome at-fantome-refus' : 'at-fantome');
    }

    function dessinerMarques() {
      var piece = selection ? pieceDe(selection) : null;
      vue.marquer('selection', piece ? P.casesPiece(piece).map(function (c) { return c.cle; }) : [], 'at-selection');
      vue.marquer('admissibles', aPoser && aPoser.type === 'evenement' ? casesAdmissibles(plateau(), aPoser.id) : [], 'at-admissible');
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

    function rafraichirOutils() {
      var pl = plateau(), stock = P.stock(pl), contenu = [], piece = selection ? pieceDe(selection) : null;
      if (selection && !piece) { selection = null; caseSelection = null; }

      if (aPoser && aPoser.type === 'piece') {
        contenu.push(el('p', { texte: 'À poser : ' + C.MODELES[aPoser.modele].nom + ' (rotation ' + aPoser.rotation + ' / 6). Cliquez une case du plateau.' }));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Tourner (R)', tourner, { id: 'pl-tourner' }), bouton('Arrêter la pose (Échap)', function () { aPoser = null; rafraichirOutils(); })]));
      } else if (aPoser && aPoser.type === 'evenement') {
        contenu.push(el('p', { texte: 'Tuile d’événement à poser : ' + C.EVENEMENTS[aPoser.id].nom + '. Cliquez une case surlignée.' }));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Arrêter la pose (Échap)', function () { aPoser = null; rafraichirOutils(); })]));
      } else if (aPoser && aPoser.type === 'deplacement' && piece) {
        contenu.push(el('p', { texte: 'Déplacement de « ' + C.MODELES[piece.modele].nom + ' » (rotation ' + aPoser.rotation + ' / 6) : cliquez la nouvelle case.' }));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Tourner (R)', tourner, { id: 'pl-tourner' }), bouton('Renoncer (Échap)', function () { aPoser = null; rafraichirOutils(); })]));
      } else if (piece) {
        var m = C.MODELES[piece.modele], nb = m.cases.length;
        contenu.push(el('p', { texte: 'Pièce sélectionnée : ' + m.nom + ' (' + nb + (nb > 1 ? ' cases' : ' case') + '), en (' + H.cle(piece.q, piece.r) + ').' }));
        var ligne = [bouton('Tourner (R)', tourner, { id: 'pl-tourner' }), bouton('Déplacer', commencerDeplacement, { id: 'pl-deplacer' }), bouton('Retirer (Suppr)', retirerSelection, { id: 'pl-retirer' })];
        var toutes = P.cases(pl);
        if (caseSelection && possede.call(toutes, caseSelection) && toutes[caseSelection].evenement) {
          ligne.push(bouton('Retirer la tuile d’événement ' + toutes[caseSelection].evenement, function () { retirerEvenement(caseSelection); }, { id: 'pl-retirer-evenement' }));
        }
        contenu.push(el('div', { classe: 'at-ligne' }, ligne));
      } else {
        contenu.push(el('p', { classe: 'at-aide', texte: 'Cliquez une pièce du plateau pour la sélectionner, ou une pièce du stock pour la poser.' }));
      }
      R.remplacer(zoneOutil, contenu);

      // Stock restant.
      var pieces = C.ORDRE_MODELES.filter(function (id) { return stock[id].restant > 0; }).map(function (id) {
        var choisi = !!(aPoser && aPoser.type === 'piece' && aPoser.modele === id);
        return el('button', {
          type: 'button', classe: 'at-piece-stock', 'data-modele': id, 'aria-pressed': choisi ? 'true' : 'false',
          title: 'Poser : ' + C.MODELES[id].nom, sur: { click: function () { choisirModele(id); } }
        }, [R.dessinModele(id, { echelle: 0.24, titre: C.MODELES[id].nom }), el('span', { texte: C.MODELES[id].nom + ' × ' + stock[id].restant })]);
      });
      var poses = {};
      pl.recouvrements.forEach(function (x) { poses[x.evenement] = true; });
      var evenements = C.ORDRE_EVENEMENTS.filter(function (id) { return !poses[id]; }).map(function (id) {
        var choisi = !!(aPoser && aPoser.type === 'evenement' && aPoser.id === id);
        return el('button', {
          type: 'button', classe: 'at-piece-stock', 'data-evenement': id, 'aria-pressed': choisi ? 'true' : 'false',
          title: 'Essayer la tuile d’événement : ' + C.EVENEMENTS[id].nom, sur: { click: function () { choisirEvenement(id); } }
        }, [R.pastilleTerrain(C.EVENEMENTS[id].terrain, true), el('span', { texte: id + ' ' + C.EVENEMENTS[id].nom })]);
      });
      R.remplacer(zoneStock, [
        el('h3', { texte: 'Stock restant' }),
        pieces.length ? el('div', { classe: 'at-grille-stock' }, pieces) : el('p', { classe: 'at-aide', texte: 'Toutes les pièces sont posées.' }),
        el('h3', { texte: 'Tuiles d’événement (essai de pose)' }),
        evenements.length ? el('div', { classe: 'at-grille-stock' }, evenements) : el('p', { classe: 'at-aide', texte: 'Les 8 tuiles sont posées.' })
      ]);
      btnAnnuler.disabled = rang === 0;
      btnRetablir.disabled = rang >= historique.length - 1;
      dessinerMarques();
    }

    function rafraichirControles() {
      var pl = plateau(), blocs = [];
      bilan = K.tout(pl, reglages);
      blocs.push(el('p', { classe: 'at-bilan ' + (bilan.erreurs ? 'at-niveau-erreur' : (bilan.alertes ? 'at-niveau-alerte' : 'at-niveau-info')), id: 'pl-bilan',
        texte: bilan.erreurs ? bilan.erreurs + ' erreur(s), ' + bilan.alertes + ' alerte(s)' : (bilan.alertes ? 'Aucune erreur, ' + bilan.alertes + ' alerte(s)' : 'Plateau conforme : aucune erreur, aucune alerte') }));
      var liste = el('ul', { classe: 'at-constats' });
      ORDRE_REGLES.forEach(function (regle) {
        var constats = bilan.resultats.filter(function (x) { return x.regle === regle; });
        liste.appendChild(el('li', { classe: 'at-regle', texte: NOMS_REGLES[regle] }));
        constats.forEach(function (x, i) {
          var cle = regle + '/' + i + '/' + x.message, epingleIci = !!(epingle && epingle.cle === cle);
          var corps = [el('span', { classe: 'at-badge at-niveau-' + x.niveau, texte: NOMS_NIVEAUX[x.niveau] }), el('span', { texte: ' ' + x.message })];
          var item;
          if (x.cases.length) {
            corps.push(el('span', { classe: 'at-voir', texte: epingleIci ? ' (cases affichées : cliquer pour masquer)' : ' (survoler ou cliquer : ' + x.cases.length + ' case(s))' }));
            item = avecSurbrillance(el('button', { type: 'button', classe: 'at-constat', 'data-regle': regle, 'data-niveau': x.niveau, 'aria-pressed': epingleIci ? 'true' : 'false' }, corps), x.cases, cle);
          } else {
            item = el('div', { classe: 'at-constat', 'data-regle': regle, 'data-niveau': x.niveau }, corps);
          }
          liste.appendChild(el('li', null, item));
        });
      });
      blocs.push(liste);

      // Tableau d'équilibre.
      var e = bilan.equilibre, numeros = R.numerosVilles(pl);
      blocs.push(el('h3', { texte: 'Équilibre : coût en rations vers chaque ville' }));
      if (!e.calculable) {
        blocs.push(el('p', { classe: 'at-aide', texte: 'Non calculable : il faut 1 ou 2 villes sur la rangée du haut et sur celle du bas (avec 3 villes ou plus sur une rangée, aucune n’est retenue).' }));
      } else {
        var corpsTable = el('tbody');
        e.villes.forEach(function (v) {
          var camp = pl.camps.vert.indexOf(v.cle) !== -1 ? ' (Vert)' : (pl.camps.rouge.indexOf(v.cle) !== -1 ? ' (Rouge)' : '');
          var ligne = el('tr', { tabindex: 0 }, [
            el('th', { scope: 'row', texte: (numeros[v.cle] || '?') + camp }),
            el('td', { texte: '(' + v.cle + ')' }),
            el('td', { texte: v.vert === null ? '—' : v.vert }),
            el('td', { texte: v.rouge === null ? '—' : v.rouge }),
            el('td', { texte: v.ecart === null ? '—' : v.ecart })
          ]);
          corpsTable.appendChild(avecSurbrillance(ligne, [v.cle, v.symetrique], 'ville/' + v.cle));
        });
        blocs.push(el('table', { classe: 'at-table', id: 'pl-equilibre' }, [
          el('thead', null, el('tr', null, ['Ville', 'Case', 'Depuis Vert', 'Depuis Rouge', 'Écart'].map(function (t) { return el('th', { scope: 'col', texte: t }); }))),
          corpsTable
        ]));
        blocs.push(el('p', { id: 'pl-score', texte: 'Score d’équilibre : ' + e.score + ' (0 = équilibré ; écart = différence avec la ville symétrique vue de l’autre camp).' }));
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
          el('td', { texte: visee[t] + ' %' })
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
      vue.afficher({ plateau: pl, etiquettes: etiquettes(pl, affichage) }, garderVue);
      infoPlateau.textContent = 'Graine du plateau : ' + pl.graine + ' ; ' + pl.pieces.length + ' pièce(s), ' + Object.keys(P.cases(pl)).length + ' case(s)';
      rafraichirControles();
      rafraichirOutils();
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
      changer(r.plateau, { brut: true, garderVue: false });
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
    choixAffichage.addEventListener('change', function () { affichage = choixAffichage.value; rafraichir(true); });
    champGraine.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') generer(); });

    var legende = el('div', { classe: 'at-legende', id: 'pl-legende', 'aria-label': 'Légende' },
      R.ORDRE_TERRAINS.map(function (t) { return el('span', { classe: 'at-legende-item' }, [R.pastilleTerrain(t), R.nomTerrain(t)]); })
        .concat(C.ORDRE_EVENEMENTS.map(function (id) {
          return el('span', { classe: 'at-legende-item' }, [R.pastilleTerrain(C.EVENEMENTS[id].terrain, true), id + ' ' + C.EVENEMENTS[id].nom]);
        }))
        .concat([
          el('span', { classe: 'at-legende-item' }, [el('span', { classe: 'at-puce at-puce-vert', texte: 'V' }), 'ville de déploiement de Vert (haut)']),
          el('span', { classe: 'at-legende-item' }, [el('span', { classe: 'at-puce at-puce-rouge', texte: 'R' }), 'ville de déploiement de Rouge (bas)']),
          el('span', { classe: 'at-legende-item' }, [el('span', { classe: 'at-trait-epais' }), 'contour d’une pièce monobloc']),
          el('span', { classe: 'at-legende-item' }, [el('span', { classe: 'at-trait-epais at-trait-noyau' }), 'noyau'])
        ]));

    var gauche = el('div', { classe: 'at-colonne at-colonne-gauche' }, [
      el('fieldset', null, [
        el('legend', { texte: 'Générer' }),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-graine', texte: 'Graine' }), champGraine]),
        el('div', { classe: 'at-ligne' }, [
          bouton('Générer', function () { generer(); }, { id: 'pl-generer', class: 'at-principal-bouton' }),
          bouton('Graine suivante', function () { generer(AT.app.graineSuivante(AT.app.graineSaisie(champGraine.value))); }, { id: 'pl-suivante' })
        ]),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-seuil', texte: 'Seuil de contact' }), choixSeuil]),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pl-mesure', texte: 'Mesure' }), choixMesure]),
        avisGeneration
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Retouche à la main' }),
        el('div', { classe: 'at-ligne' }, [btnAnnuler, btnRetablir, bouton('Vider le plateau', viderPlateau, { id: 'pl-vider' })]),
        zoneOutil,
        zoneStock
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
    var centre = el('div', { classe: 'at-centre' }, [vue.element, legende]);
    var droite = el('div', { classe: 'at-colonne at-colonne-droite' }, [el('h2', { texte: 'Contrôles du plateau' }), zoneControles]);
    var element = el('div', { classe: 'at-ecran at-ecran-plateau' }, [gauche, centre, droite]);

    rafraichir(false);

    return {
      element: element, vue: vue,
      plateau: plateau, bilan: function () { return bilan; }, reglages: function () { return reglages; },
      generer: generer, annuler: annuler, retablir: retablir, touche: touche,
      enregistrer: enregistrer, texteEnregistrement: texteEnregistrement, ouvrirTexte: ouvrirTexte,
      imageExport: imageExport, exporterSvg: exporterSvg, exporterPng: exporterPng,
      etat: function () { return { selection: selection, aPoser: aPoser, rang: rang, longueur: historique.length }; }
    };
  }

  AT.vuePlateau = { creer: creer, deplacerPiece: deplacerPiece, etiquettes: etiquettes, casesAdmissibles: casesAdmissibles };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vuePlateau;
})();
