/*
 * vue-partie.js : onglet « Partie fictive » (lot C). Une table libre : une aide, pas un arbitre.
 * Dépend de AT.hex, AT.plateau, AT.alea, AT.cartes, AT.partie, AT.rendu, AT.vuePlateau ; AT.app à l'exécution.
 *
 * Toutes les opérations passent par un seul exécuteur, `executer(operation, params)` :
 *   - réussite : l'état entre dans l'historique (annuler / rétablir) et le journal s'allonge ;
 *   - refus avec avertissement bloquant : un bandeau propose de « faire quand même » (params.forcer) ;
 *   - refus simple : la raison est affichée.
 * Le plateau dessiné est celui de la PARTIE (etat.plateau) : il s'écarte de celui de l'onglet Plateau
 * dès qu'une tuile d'événement est posée.
 * Les noms de Troupes et les notes viennent de l'utilisateur ou d'un fichier : ils ne sont écrits
 * que par textContent (jamais d'innerHTML).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  var JOUEURS = ['vert', 'rouge'];
  var NOMS = { vert: 'Vert', rouge: 'Rouge' };
  var COTES = { vert: 'nord, en haut', rouge: 'sud, en bas' };
  var JOURNAL_AFFICHE = 300;

  /** Opérations de paquet proposées pour résoudre à la main un effet (carte Campement…). */
  var OPERATIONS = [
    { id: 'piocher1', texte: 'Piocher 1', operation: 'piocher', n: 1 },
    { id: 'piocher2', texte: 'Piocher 2', operation: 'piocher', n: 2 },
    { id: 'defausser', texte: 'Défausser la carte choisie', operation: 'defausser', carte: true },
    { id: 'hasard', texte: 'Défausser 1 carte au hasard', operation: 'defausserAuHasard' },
    { id: 'main', texte: 'Défausser toute la main', operation: 'defausserMain' },
    { id: 'dessus', texte: 'Défausser le dessus de la pioche', operation: 'defausserDessusPioche' },
    { id: 'melanger', texte: 'Mélanger la pioche', operation: 'melangerPioche' },
    { id: 'recycler', texte: 'Mélanger la défausse dans la pioche', operation: 'melangerDefausseDansPioche' },
    { id: 'regarder', texte: 'Regarder les 3 premières', operation: 'regarder', n: 3 },
    { id: 'reprendre', texte: 'Reprendre le dessus de la défausse', operation: 'reprendreDefausse' },
    { id: 'sur', texte: 'Carte choisie sur la pioche', operation: 'remettreDessus', carte: true },
    { id: 'sous', texte: 'Carte choisie sous la pioche', operation: 'remettreDessous', carte: true },
    { id: 'remettre', texte: 'Remettre la main dans la pioche et mélanger', operation: 'remettreMainDansPioche' }
  ];

  function creer(ctx) {
    var R = AT.rendu, el = R.el, H = AT.hex, P = AT.plateau, PA = AT.partie, HI = AT.partie.historique;
    var possede = Object.prototype.hasOwnProperty;
    // Un seul aléa pour toutes les opérations : chacune le remet d'abord dans l'état enregistré dans la partie.
    var env = { alea: AT.alea.creer(0), hex: H, plateau: P };
    var h = null;                // historique {passe, present, futur} ; null = pas de partie
    var ui;                      // sélections et affichages passagers (jamais enregistrés)

    function uiNeuve() {
      return { carte: null, bataillon: null, evenement: null, ville: null, enAttente: null, lancer: null, campement: null, regard: null, joueurPaquet: null };
    }
    ui = uiNeuve();

    function etat() { return h ? h.present : null; }

    function bouton(texte, action, attrs) {
      var b = el('button', { type: 'button', texte: texte, sur: { click: action } });
      if (attrs) Object.keys(attrs).forEach(function (k) { if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) b.setAttribute(k, attrs[k] === true ? '' : attrs[k]); });
      return b;
    }

    // ---------------------------------------------------------------- éléments fixes
    var champGraine = el('input', { type: 'text', id: 'pa-graine', classe: 'at-champ-graine', value: '1', maxlength: 64, autocomplete: 'off', spellcheck: 'false' });
    var champDes = el('input', { type: 'number', id: 'pa-nb-des', classe: 'at-champ-nombre', value: '2', min: 1, max: AT.cartes.REGLAGES.desMax, step: 1 });
    var choixPremier = el('select', { id: 'pa-premier', title: 'Joueur qui commence la nouvelle partie' }, JOUEURS.map(function (j) {
      return el('option', { value: j, texte: NOMS[j] });
    }));
    choixPremier.value = AT.cartes.REGLAGES.premierJoueur;
    var champNote = el('input', { type: 'text', id: 'pa-note', maxlength: 300, autocomplete: 'off' });
    var btnAnnuler = bouton('Annuler', annuler, { id: 'pa-annuler', title: 'Annuler (Ctrl+Z)' });
    var btnRetablir = bouton('Rétablir', retablir, { id: 'pa-retablir', title: 'Rétablir (Ctrl+Y)' });
    var btnEnregistrer = bouton('Enregistrer', enregistrer, { id: 'pa-enregistrer', title: 'Enregistrer la partie (fichier JSON)' });
    var btnTroupes = bouton('Troupes provisoires…', ouvrirTroupes, { id: 'pa-troupes' });
    var zoneTour = el('div', { classe: 'at-tour', id: 'pa-tour' });
    var zoneAvis = el('div', { classe: 'at-avis-partie', id: 'pa-avis' });
    var zoneJoueurs = el('div', { id: 'pa-joueurs' });
    var zoneContexte = el('div', { classe: 'at-contexte', id: 'pa-contexte' });
    var infoSurvol = el('span', { classe: 'at-info-plateau', id: 'pa-survol' });
    var zoneDes = el('div', { id: 'pa-des' });
    var zoneCampement = el('div', { id: 'pa-campement' });
    var zoneEvenements = el('div', { id: 'pa-evenements' });
    var zoneJournal = el('ol', { classe: 'at-journal', id: 'pa-journal', reversed: true });
    var dialogue = el('dialog', { classe: 'at-dialogue', id: 'pa-dialogue-troupes', 'aria-labelledby': 'pa-titre-troupes' });
    var corpsDialogue = el('div');
    var vide = el('p', { classe: 'at-vide', id: 'pa-vide', texte: 'Aucune partie en cours. Choisissez une graine puis « Nouvelle partie » : elle se joue sur le plateau affiché dans l’onglet Plateau. Avec la même graine et le même plateau, la partie se rejoue à l’identique (mêmes mélanges, mêmes dés).' });
    var vue = R.creerVue({ etiquette: 'Plateau de la partie.', surClic: surClic, surSurvol: surSurvol });
    vue.barre.appendChild(infoSurvol);

    // ---------------------------------------------------------------- partie : créer, exécuter, historique
    /** Nouvelle partie sur le plateau courant de l'onglet Plateau. Renvoie vrai si elle est créée. */
    function nouvelle(graine) {
      var g = graine === undefined ? AT.app.graineSaisie(champGraine.value) : graine;
      if (g === null) g = 1;
      champGraine.value = String(g);
      // Les tuiles d'événement posées à l'essai dans l'onglet Plateau ne suivent pas : la partie commence
      // avec les 8 cartes Événement dans la pioche, donc avec les 8 tuiles en réserve.
      var source = ctx.plateau(), essais = source.recouvrements.length;
      var plateau = { version: source.version, graine: source.graine, pieces: source.pieces, recouvrements: [], camps: source.camps };
      if (source.modeles) plateau.modeles = source.modeles;          // pièces personnelles du document : la partie les emporte
      if (source.deploiements) plateau.deploiements = source.deploiements;   // villes de déploiement posées par-dessus une Plaine (catalogue 2)
      if (source.profondeurExtremite !== undefined) plateau.profondeurExtremite = source.profondeurExtremite;   // rangées des extrémités retenues pour ces villes
      var premier = JOUEURS.indexOf(choixPremier.value) !== -1 ? choixPremier.value : AT.cartes.REGLAGES.premierJoueur;
      var r = PA.creer({ graine: g, plateau: plateau, reglages: { premierJoueur: premier } }, { alea: AT.alea.creer(g), hex: H, plateau: P });
      if (!r.ok) { ctx.message('Partie impossible : ' + r.raison, 'erreur'); return false; }
      var precedente = !!h;
      h = precedente ? HI.pousser(h, r.etat) : HI.creer(r.etat);     // la partie précédente reste accessible par « Annuler »
      ui = uiNeuve();
      var bilan = AT.controles.tout(r.etat.plateau, ctx.reglagesControles());
      var sansEssais = essais ? ' Les tuiles d’événement posées à l’essai (' + essais + ') ne sont pas reprises : elles restent en réserve.' : '';
      rafraichir(false);
      if (bilan.erreurs) ctx.message('Partie créée, mais le plateau a ' + bilan.erreurs + ' erreur(s) aux contrôles (voir l’onglet Plateau).' + sansEssais, 'alerte');
      else ctx.message('Nouvelle partie (graine ' + g + '). ' + NOMS[r.etat.actif] + ' commence.' + sansEssais + (precedente ? ' « Annuler » revient à la partie précédente.' : ''), essais ? 'alerte' : 'info');
      return true;
    }

    function dernierTexte(e) { return e.journal.length ? e.journal[e.journal.length - 1].texte : ''; }

    /**
     * Exécute une opération de AT.partie. options.apres(resultat) : après une réussite, avant le redessin ;
     * options.garderRegard : ne pas refermer la liste des cartes regardées.
     */
    function executer(operation, params, options) {
      var o = options || {};
      if (!h) return null;
      var r = PA[operation](h.present, params, env);
      if (r.ok) {
        h = HI.pousser(h, r.etat);
        ui.enAttente = null;
        if (!o.garderRegard) ui.regard = null;
        var avertis = r.avertissements.map(function (a) { return a.message; });
        ctx.message(dernierTexte(r.etat) + (avertis.length ? ' Attention : ' + avertis.join(' ') : ''), avertis.length ? 'alerte' : 'info');
        if (o.apres) o.apres(r);
      } else if (r.avertissements && r.avertissements.some(function (a) { return a.bloquant; })) {
        ui.enAttente = { operation: operation, params: params, options: o, avertissements: r.avertissements, cout: r.cout };
        ctx.message('Avertissement : ' + r.avertissements.map(function (a) { return a.message; }).join(' '), 'alerte');
      } else {
        ui.enAttente = null;
        ctx.message('Refusé : ' + r.raison, 'erreur');
      }
      rafraichir(true);
      return r;
    }

    function forcer() {
      var a = ui.enAttente;
      if (!a) return;
      var params = {};
      Object.keys(a.params).forEach(function (k) { params[k] = a.params[k]; });
      params.forcer = true;
      ui.enAttente = null;
      executer(a.operation, params, a.options);
    }

    function annuler() {
      if (!h || !HI.peutAnnuler(h)) { ctx.message('Rien à annuler.', 'info'); return; }
      h = HI.annuler(h); ui = uiNeuve(); rafraichir(true); ctx.message('Dernière opération annulée.', 'info');
    }

    function retablir() {
      if (!h || !HI.peutRetablir(h)) { ctx.message('Rien à rétablir.', 'info'); return; }
      h = HI.retablir(h); ui = uiNeuve(); rafraichir(true); ctx.message('Opération rétablie.', 'info');
    }

    // ---------------------------------------------------------------- fichiers
    function enregistrer() {
      if (!h) { ctx.message('Aucune partie à enregistrer.', 'info'); return; }
      ctx.telecharger('partie-graine-' + AT.app.nomSur(h.present.graine) + '-tour-' + h.present.tour + '.json', PA.serialiser(h.present), 'application/json');
    }

    /** Ouvre le texte d'un fichier de partie (validé par AT.partie.charger). Renvoie vrai si la partie est acceptée. */
    function ouvrirTexte(texte) {
      var r = PA.charger(texte, env);
      if (!r.ok) { ctx.message('Fichier refusé : ' + r.raison, 'erreur'); return false; }
      h = h ? HI.pousser(h, r.etat) : HI.creer(r.etat);              // « Annuler » revient à la partie d'avant l'ouverture
      ui = uiNeuve();
      champGraine.value = String(r.etat.graine);
      choixPremier.value = r.etat.reglages.premierJoueur;
      rafraichir(false);
      // Comme à la création : le plateau du fichier est passé aux contrôles (construction seulement), pour information.
      var bilan = AT.controles.tout(r.etat.plateau, ctx.reglagesControles());
      var erreurs = bilan.resultats.filter(function (x) { return x.niveau === 'erreur' && x.regle !== 'evenements'; }).length;
      ctx.message('Partie ouverte : tour ' + r.etat.tour + ', au tour de ' + NOMS[r.etat.actif] + '.'
        + (erreurs ? ' Le plateau de ce fichier a ' + erreurs + ' erreur(s) aux contrôles.' : ''), erreurs ? 'alerte' : 'info');
      return true;
    }

    // ---------------------------------------------------------------- actions composées
    function nomCarte(e, carte) { var t = PA.troupeDe(e, carte); return t ? t.nom : String(carte); }

    function premierEnReserve(e, joueur) {
      var libres = e.bataillons[joueur].filter(function (b) { return b.case === null; });
      return libres.length ? libres[0].numero : null;
    }

    function former(joueur, carte, cle) {
      var numero = premierEnReserve(etat(), joueur);
      if (numero === null) { ctx.message('Les bataillons de ' + NOMS[joueur] + ' sont tous sur le plateau.', 'erreur'); return; }
      executer('former', { joueur: joueur, numero: numero, carte: carte, cle: cle }, { apres: function () { ui.carte = null; } });
    }

    function renforcer(joueur, numero, carte) {
      executer('renforcer', { joueur: joueur, numero: numero, carte: carte }, { apres: function () { ui.carte = null; } });
    }

    /** Renouveler ses cartes (règles V2.3) : défausser toute sa main, piocher autant ; coûte les 2 actions. Une seule entrée d'annulation. */
    function renouveler(joueur) {
      var e = etat(), n = e.paquets[joueur].main.length;
      if (!n) { ctx.message('La main de ' + NOMS[joueur] + ' est vide.', 'info'); return; }
      var r = PA.paquet(e, { joueur: joueur, operation: 'defausserMain' }, env);
      if (r.ok) r = PA.paquet(r.etat, { joueur: joueur, operation: 'piocher', n: n }, env);
      if (r.ok && joueur === e.actif) r = PA.ajusterActions(r.etat, { delta: e.reglages.actionsParTour, motif: 'renouvellement de la main' });
      if (!r.ok) { ctx.message('Refusé : ' + r.raison, 'erreur'); return; }
      h = HI.pousser(h, r.etat);
      ui.carte = null; ui.regard = null; ui.enAttente = null;
      ctx.message(NOMS[joueur] + ' renouvelle sa main (' + n + ' carte(s)).', 'info');
      rafraichir(true);
    }

    function lancer(n, joueur, motif, titre) {
      executer('lancerDes', { n: n, joueur: joueur, motif: motif }, { apres: function (r) { ui.lancer = { des: r.des, total: r.total, titre: titre }; } });
    }

    function desDuBataillon(e, joueur, numero) {
      var b = PA.bataillon(e, joueur, numero);
      return b ? b.troupes.reduce(function (s, t) { var d = PA.troupeDe(e, t.carte); return s + (d ? d.des : 0); }, 0) : 0;
    }

    function piocherCampement(joueur, numero) {
      var params = { joueur: joueur };
      if (numero) params.numero = numero;
      executer('piocherCampement', params, { apres: function (r) { ui.campement = { carte: r.carte, joueur: joueur }; ui.joueurPaquet = joueur; } });
    }

    function operationPaquet(joueur, op) {
      var params = { joueur: joueur, operation: op.operation };
      if (op.n) params.n = op.n;
      if (op.carte) {
        if (!ui.carte || ui.carte.joueur !== joueur) { ctx.message('Choisissez d’abord une carte dans la main de ' + NOMS[joueur] + '.', 'info'); return; }
        params.carte = ui.carte.carte;
      }
      executer('paquet', params, {
        garderRegard: op.operation === 'regarder',
        apres: function (r) {
          if (op.carte) ui.carte = null;
          if (op.operation === 'regarder') ui.regard = { joueur: joueur, n: r.cartes.length };
        }
      });
    }

    // ---------------------------------------------------------------- clics sur le plateau
    function casesOccupees(e) {
      var res = [];
      JOUEURS.forEach(function (j) { e.bataillons[j].forEach(function (b) { if (b.case !== null) res.push(b.case); }); });
      return res;
    }

    function descriptionCase(e, cle) {
      var cases = P.cases(e.plateau);
      if (!possede.call(cases, cle)) return '';
      var c = cases[cle], cout = P.cout(e.plateau, cle);
      return 'Case (' + cle + ') : ' + R.nomTerrain(c.terrain).toLowerCase() + (c.evenement ? ' (événement ' + c.evenement + ')' : '')
        + (cout === Infinity ? ', infranchissable' : ', coût ' + cout + ' ration(s)');
    }

    function surSurvol(cle) {
      var e = etat();
      infoSurvol.textContent = (e && cle) ? descriptionCase(e, cle) : '';
    }

    function surClic(cle) {
      var e = etat();
      if (!e) return;
      var cases = P.cases(e.plateau);
      if (!possede.call(cases, cle)) { ctx.message('Cette case est hors du plateau.', 'info'); return; }
      ui.enAttente = null;
      if (ui.evenement) {
        executer('poserEvenement', { evenement: ui.evenement, cle: cle, joueur: e.actif }, { apres: function () { ui.evenement = null; } });
        return;
      }
      var occupants = PA.occupants(e, cle);
      if (ui.carte) {
        var aRenforcer = occupants.filter(function (x) { return x.joueur === ui.carte.joueur; })[0];
        if (aRenforcer) renforcer(ui.carte.joueur, aRenforcer.numero, ui.carte.carte);
        else former(ui.carte.joueur, ui.carte.carte, cle);
        return;
      }
      if (ui.bataillon) {
        var b = PA.bataillon(e, ui.bataillon.joueur, ui.bataillon.numero);
        if (b && b.case === cle) { ui.bataillon = null; rafraichir(true); return; }
        var voisin = occupants.filter(function (x) { return x.joueur === ui.bataillon.joueur; })[0];
        if (voisin) { ui.bataillon = { joueur: voisin.joueur, numero: voisin.numero }; rafraichir(true); return; }
        executer('deplacer', { joueur: ui.bataillon.joueur, numero: ui.bataillon.numero, cle: cle });
        return;
      }
      if (occupants.length) { ui.bataillon = { joueur: occupants[0].joueur, numero: occupants[0].numero }; ui.ville = null; rafraichir(true); return; }
      ui.ville = (cases[cle].terrain === 'ville' && ui.ville !== cle) ? cle : null;
      ctx.message(descriptionCase(e, cle) + '.', 'info');
      rafraichir(true);
    }

    function touche(ev) {
      if (ev.key !== 'Escape' || !h) return false;
      ui.carte = null; ui.bataillon = null; ui.evenement = null; ui.ville = null; ui.enAttente = null;
      rafraichir(true);
      return true;
    }

    // ---------------------------------------------------------------- dessin : plateau
    function dessinerPlateau(garderVue) {
      var e = etat(), pions = [], etiquettes = {}, admissibles = [], selection = [];
      JOUEURS.forEach(function (j) {
        e.bataillons[j].forEach(function (b) { if (b.case !== null) pions.push({ cle: b.case, joueur: j, numero: b.numero }); });
      });
      var cases = P.cases(e.plateau), occupees = casesOccupees(e);
      if (ui.evenement) {
        admissibles = AT.vuePlateau.casesAdmissibles(e.plateau, ui.evenement, occupees);
      } else if (ui.carte) {
        admissibles = (e.plateau.camps[ui.carte.joueur] || []).filter(function (k) { return occupees.indexOf(k) === -1; });
      } else if (ui.bataillon) {
        var b = PA.bataillon(e, ui.bataillon.joueur, ui.bataillon.numero);
        if (b && b.case !== null) {
          selection = [b.case];
          H.voisines(b.case).forEach(function (k) {
            if (!possede.call(cases, k)) return;
            var cout = P.cout(e.plateau, k);
            etiquettes[k] = cout === Infinity ? '✕' : cout;
            if (cout !== Infinity && occupees.indexOf(k) === -1) admissibles.push(k);
          });
        }
      } else if (ui.ville) {
        selection = [ui.ville];
      }
      vue.afficher({ plateau: e.plateau, pions: pions, proprietaires: e.villes, etiquettes: etiquettes }, garderVue);
      vue.marquer('admissibles', admissibles, 'at-admissible');
      vue.marquer('selection', selection, 'at-selection');
    }

    // ---------------------------------------------------------------- dessin : panneaux
    function boutonsCapture(e, cle) {
      var actuel = possede.call(e.villes, cle) ? e.villes[cle] : null;
      return [['vert', 'À Vert'], ['rouge', 'À Rouge'], [null, 'Neutre']].map(function (x) {
        return bouton(x[1], function () { executer('capturerVille', { cle: cle, proprietaire: x[0] }); },
          { disabled: actuel === x[0], 'data-capture': x[0] || 'neutre' });
      });
    }

    function dessinerContexte() {
      var e = etat(), contenu = [], numeros = R.numerosVilles(e.plateau);
      var ligneVille = function (cle) {
        var proprio = possede.call(e.villes, cle) ? NOMS[e.villes[cle]] : 'neutre';
        return el('div', { classe: 'at-ligne' }, [el('span', { texte: 'Ville n° ' + numeros[cle] + ' (' + cle + '), propriétaire : ' + proprio + '. Marquer :' })].concat(boutonsCapture(e, cle)));
      };
      if (ui.evenement) {
        contenu.push(el('p', { texte: 'Tuile d’événement ' + ui.evenement + ' : cliquez une case surlignée pour la poser (Échap pour renoncer).' }));
      } else if (ui.carte) {
        contenu.push(el('p', { texte: 'Carte choisie : ' + nomCarte(e, ui.carte.carte) + ' (' + NOMS[ui.carte.joueur] + '). Cliquez une ville de déploiement surlignée pour former un bataillon, ou un bataillon de ' + NOMS[ui.carte.joueur] + ' pour le renforcer.' }));
      } else if (ui.bataillon) {
        var b = PA.bataillon(e, ui.bataillon.joueur, ui.bataillon.numero);
        if (b && b.case !== null) {
          contenu.push(el('p', { texte: 'Bataillon ' + b.numero + ' de ' + NOMS[ui.bataillon.joueur] + ' en (' + b.case + ') : cliquez une case voisine pour le déplacer (le coût en rations est écrit sur chaque case voisine ; ✕ = infranchissable).' }));
          if (possede.call(numeros, b.case)) contenu.push(ligneVille(b.case));
        }
      } else if (ui.ville) {
        contenu.push(ligneVille(ui.ville));
      } else {
        contenu.push(el('p', { classe: 'at-aide', texte: 'Cliquez un pion pour le déplacer, une ville pour marquer son propriétaire, ou choisissez une carte dans une main.' }));
      }
      R.remplacer(zoneContexte, contenu);
    }

    function dessinerAvis() {
      var a = ui.enAttente, contenu = [];
      if (a) {
        contenu.push(el('p', { classe: 'at-avertissement', id: 'pa-avertissement' }, [
          el('strong', { texte: 'Avertissement : ' }),
          a.avertissements.map(function (x) { return x.message; }).join(' ') + (typeof a.cout === 'number' ? ' Coût de la case : ' + a.cout + ' ration(s).' : '')
            + ' En table libre, vous pouvez le faire quand même.'
        ]));
        contenu.push(el('div', { classe: 'at-ligne' }, [
          bouton('Faire quand même', forcer, { id: 'pa-forcer' }),
          bouton('Renoncer', function () { ui.enAttente = null; rafraichir(true); }, { id: 'pa-renoncer' })
        ]));
      }
      zoneAvis.hidden = !a;
      R.remplacer(zoneAvis, contenu);
    }

    function dessinerTour() {
      var e = etat(), gagnants = PA.gagnants(e), contenu = [];
      contenu.push(el('span', { classe: 'at-tour-texte at-camp-' + e.actif, id: 'pa-tour-texte',
        texte: 'Tour ' + e.tour + ' — au tour de ' + NOMS[e.actif] + ' — actions comptées : ' + e.actions + ' / ' + e.reglages.actionsParTour }));
      contenu.push(bouton('+1 action', function () { executer('ajusterActions', { delta: 1 }); }, { id: 'pa-action-plus', title: 'Compter une action de plus (attaque…)' }));
      contenu.push(bouton('−1 action', function () { executer('ajusterActions', { delta: -1 }); }, { id: 'pa-action-moins', disabled: e.actions === 0 }));
      contenu.push(bouton('Fin du tour', function () { ui.carte = null; ui.bataillon = null; executer('finDeTour', {}); }, { id: 'pa-fin-tour', class: 'at-principal-bouton' }));
      if (gagnants.length) {
        contenu.push(el('strong', { classe: 'at-victoire', id: 'pa-victoire', texte: 'Victoire : ' + gagnants.map(function (j) { return NOMS[j]; }).join(' et ') + ' (' + e.reglages.gloireVictoire + ' points de Gloire)' }));
      }
      R.remplacer(zoneTour, contenu);
    }

    function carteTroupe(e, joueur, carte) {
      var t = PA.troupeDe(e, carte), choisie = !!(ui.carte && ui.carte.carte === carte);
      return el('button', {
        type: 'button', classe: 'at-carte', 'data-carte': carte, 'aria-pressed': choisie ? 'true' : 'false',
        sur: { click: function () {
          ui.carte = choisie ? null : { joueur: joueur, carte: carte };
          ui.bataillon = null; ui.evenement = null; ui.ville = null; ui.enAttente = null;
          rafraichir(true);
        } }
      }, [
        el('span', { classe: 'at-carte-nom', texte: t ? t.nom : carte }),
        el('span', { classe: 'at-carte-chiffres', texte: t ? 'Moral ' + t.moral + ' · Puissance ' + t.puissance + ' · ' + t.des + ' dé(s)' : '' }),
        t && t.provisoire ? el('span', { classe: 'at-etiquette-provisoire', texte: 'provisoire' }) : null
      ]);
    }

    function panneauBataillon(e, j, b) {
      if (b.case === null) return el('div', { classe: 'at-bataillon at-bataillon-reserve', 'data-bataillon': j + '-' + b.numero, texte: 'Bataillon ' + b.numero + ' : en réserve' });
      var choisi = !!(ui.bataillon && ui.bataillon.joueur === j && ui.bataillon.numero === b.numero);
      var nbDes = desDuBataillon(e, j, b.numero);
      var troupes = b.troupes.map(function (t, i) {
        var d = PA.troupeDe(e, t.carte);
        return el('li', null, [
          el('span', { classe: 'at-troupe-nom', texte: d.nom }),
          el('span', { texte: ' moral ' + d.moral + ', Puissance ' + d.puissance + ', ' + d.des + ' dé(s) — dégâts ' + t.degats + ' / ' + d.moral + ' ' }),
          bouton('−', function () { executer('marquerDegats', { joueur: j, numero: b.numero, troupe: i, delta: -1 }); },
            { class: 'at-petit', disabled: t.degats === 0, 'aria-label': 'Retirer un marqueur de dégâts à ' + d.nom, title: 'Retirer un marqueur de dégâts' }),
          bouton('+', function () { executer('marquerDegats', { joueur: j, numero: b.numero, troupe: i, delta: 1 }); },
            { class: 'at-petit', 'data-degats': j + '-' + b.numero + '-' + i, 'aria-label': 'Ajouter un marqueur de dégâts à ' + d.nom, title: 'Ajouter un marqueur de dégâts (au moral : Troupe éliminée)' })
        ]);
      });
      var actions = [
        bouton('Lancer ses ' + nbDes + ' dé(s)', function () { lancer(nbDes, j, 'bataillon ' + b.numero, 'Bataillon ' + b.numero + ' de ' + NOMS[j]); },
          { disabled: nbDes < 1, 'data-lancer': j + '-' + b.numero }),
        bouton('Carte Campement', function () { piocherCampement(j, b.numero); }, { title: 'Ce bataillon pioche une carte Campement' + (b.campement ? ' (il en a déjà pioché une)' : '') }),
        bouton('Éliminer', function () { if (choisi) ui.bataillon = null; executer('eliminerBataillon', { joueur: j, numero: b.numero }); }, { 'data-eliminer': j + '-' + b.numero })
      ];
      if (ui.carte && ui.carte.joueur === j) {
        actions.unshift(bouton('Renforcer avec la carte choisie', function () { renforcer(j, b.numero, ui.carte.carte); }, { 'data-renforcer': j + '-' + b.numero }));
      }
      return el('div', { classe: 'at-bataillon' + (choisi ? ' at-bataillon-choisi' : ''), 'data-bataillon': j + '-' + b.numero }, [
        el('button', {
          type: 'button', classe: 'at-bataillon-titre', 'aria-pressed': choisi ? 'true' : 'false',
          texte: 'Bataillon ' + b.numero + ' en (' + b.case + ') — moral restant ' + PA.moralRestant(e, j, b.numero) + (b.campement ? ' — a pioché un Campement' : ''),
          sur: { click: function () {
            ui.bataillon = choisi ? null : { joueur: j, numero: b.numero };
            ui.carte = null; ui.evenement = null; ui.ville = null; ui.enAttente = null;
            rafraichir(true);
          } }
        }),
        el('ul', { classe: 'at-troupes' }, troupes),
        el('div', { classe: 'at-ligne' }, actions)
      ]);
    }

    function panneauJoueur(e, j) {
      var p = e.paquets[j], max = e.reglages.gloireVictoire, gagne = e.gloire[j] >= max;
      var main = p.main.map(function (c) { return carteTroupe(e, j, c); });
      var blocs = [
        el('h2', { classe: 'at-joueur-titre' }, [NOMS[j] + ' (' + COTES[j] + ')', e.actif === j ? el('span', { classe: 'at-badge-actif', texte: 'joue' }) : null]),
        el('div', { classe: 'at-ligne at-gloire' }, [
          el('span', { texte: 'Gloire' }),
          bouton('−', function () { executer('modifierGloire', { joueur: j, delta: -1 }); }, { class: 'at-petit', disabled: e.gloire[j] === 0, 'aria-label': 'Retirer 1 point de Gloire à ' + NOMS[j] }),
          el('strong', { classe: 'at-gloire-valeur', 'data-gloire': j, texte: e.gloire[j] + ' / ' + max }),
          bouton('+', function () { executer('modifierGloire', { joueur: j, delta: 1 }); }, { class: 'at-petit', disabled: gagne, 'data-gloire-plus': j, 'aria-label': 'Ajouter 1 point de Gloire à ' + NOMS[j] }),
          gagne ? el('strong', { classe: 'at-victoire', texte: 'Victoire' }) : null
        ]),
        el('p', { classe: 'at-compteurs', 'data-compteurs': j, texte: 'Pioche : ' + p.pioche.length + ' — Défausse : ' + p.defausse.length + ' — Main : ' + p.main.length + ' / ' + e.reglages.tailleMain }),
        main.length ? el('div', { classe: 'at-main', 'data-main': j }, main) : el('p', { classe: 'at-aide', texte: 'Main vide.' }),
        el('div', { classe: 'at-ligne' }, [
          bouton('Piocher 1', function () { executer('paquet', { joueur: j, operation: 'piocher', n: 1 }); }, { 'data-piocher': j }),
          bouton('Renouveler la main', function () { renouveler(j); }, { 'data-renouveler': j, title: 'Défausser toute la main puis piocher autant (coûte les 2 actions)' })
        ])
      ];
      if (ui.carte && ui.carte.joueur === j) {
        var occupees = casesOccupees(e);
        var ligne = (e.plateau.camps[j] || []).map(function (cle) {
          return bouton('Former en (' + cle + ')', function () { former(j, ui.carte.carte, cle); }, { 'data-former': cle, title: occupees.indexOf(cle) !== -1 ? 'Ville occupée : un avertissement sera affiché' : 'Former un bataillon sur cette ville de déploiement' });
        });
        ligne.push(bouton('Défausser', function () { executer('paquet', { joueur: j, operation: 'defausser', carte: ui.carte.carte }, { apres: function () { ui.carte = null; } }); }, { 'data-defausser': j }));
        blocs.push(el('div', { classe: 'at-carte-actions' }, [el('span', { texte: 'Carte choisie : ' + nomCarte(e, ui.carte.carte) + ' ' }), el('div', { classe: 'at-ligne' }, ligne)]));
      }
      blocs.push(el('h3', { texte: 'Bataillons' }));
      e.bataillons[j].forEach(function (b) { blocs.push(panneauBataillon(e, j, b)); });
      return el('section', { classe: 'at-joueur at-joueur-' + j, 'aria-label': 'Joueur ' + NOMS[j] }, blocs);
    }

    function dessinerDes() {
      var contenu = [];
      if (ui.lancer) {
        contenu.push(el('p', { id: 'pa-resultat-des', 'aria-live': 'polite' }, [
          el('span', { texte: (ui.lancer.titre || 'Lancer') + ' : ' }),
          ui.lancer.des.map(function (d) { return el('span', { classe: 'at-de', texte: d }); }),
          el('strong', { texte: ' total ' + ui.lancer.total })
        ]));
      } else {
        contenu.push(el('p', { classe: 'at-aide', texte: 'Aucun lancer pour l’instant.' }));
      }
      R.remplacer(zoneDes, contenu);
    }

    function dessinerCampement() {
      var e = etat(), p = e.paquets.campement, contenu = [];
      contenu.push(el('p', { classe: 'at-compteurs', texte: 'Pioche : ' + p.pioche.length + ' — Défausse : ' + p.defausse.length }));
      contenu.push(el('div', { classe: 'at-ligne' }, JOUEURS.map(function (j) {
        return bouton('Piocher pour ' + NOMS[j], function () { piocherCampement(j); }, { 'data-campement': j });
      })));
      if (ui.campement) {
        var c = ui.campement.carte;
        contenu.push(el('blockquote', { classe: 'at-carte-campement', id: 'pa-carte-campement' }, [
          el('strong', { texte: 'Carte Campement n° ' + c.numero + ' (' + c.signe + '), piochée par ' + NOMS[ui.campement.joueur] + ' : ' }),
          el('span', { classe: 'at-texte-carte', texte: c.texte })
        ]));
      }
      // Opérations de paquet, à appliquer à la main.
      var j = ui.joueurPaquet || e.actif;
      contenu.push(el('h3', { texte: 'Appliquer l’effet à la main' }));
      contenu.push(el('div', { classe: 'at-ligne' }, [el('span', { texte: 'Paquet de :' })].concat(JOUEURS.map(function (x) {
        return bouton(NOMS[x], function () { ui.joueurPaquet = x; rafraichir(true); }, { 'aria-pressed': x === j ? 'true' : 'false', 'data-paquet-de': x });
      }))));
      contenu.push(el('div', { classe: 'at-operations' }, OPERATIONS.map(function (op) {
        return bouton(op.texte, function () { operationPaquet(j, op); }, { 'data-operation': op.id, disabled: !!op.carte && !(ui.carte && ui.carte.joueur === j) });
      })));
      if (ui.regard && ui.regard.joueur === j) {
        var vues = e.paquets[j].pioche.slice(0, ui.regard.n);
        contenu.push(el('div', { classe: 'at-regard', id: 'pa-regard' }, [
          el('p', { texte: 'Dessus de la pioche de ' + NOMS[j] + ' (la première sera piochée d’abord) :' }),
          el('ol', null, vues.map(function (carte) {
            return el('li', null, [
              el('span', { texte: nomCarte(e, carte) + ' ' }),
              bouton('Prendre en main', function () {
                executer('paquet', { joueur: j, operation: 'prendreDansPioche', carte: carte }, { garderRegard: true, apres: function () { ui.regard.n -= 1; if (ui.regard.n < 1) ui.regard = null; } });
              }, { 'data-prendre': carte }),
              bouton('Mettre au-dessus', function () {
                executer('paquet', { joueur: j, operation: 'reordonnerDessus', cartes: [carte] }, { garderRegard: true });
              })
            ]);
          })),
          bouton('Fermer', function () { ui.regard = null; rafraichir(true); })
        ]));
      }
      R.remplacer(zoneCampement, contenu);
    }

    function dessinerEvenements() {
      var e = etat(), p = e.paquets.evenements, contenu = [];
      contenu.push(el('p', { classe: 'at-compteurs', texte: 'Pioche : ' + p.pioche.length + ' — Tuiles posées : ' + e.plateau.recouvrements.length + ' — En attente de pose : ' + p.main.length }));
      contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Piocher un événement', function () {
        executer('piocherEvenement', { joueur: etat().actif }, { apres: function (r) { ui.evenement = r.carte.id; ui.carte = null; ui.bataillon = null; ui.ville = null; } });
      }, { id: 'pa-piocher-evenement', disabled: p.pioche.length === 0 })]));
      p.main.forEach(function (id) {
        var carte = AT.cartes.trouver(id), choisie = ui.evenement === id;
        contenu.push(el('button', {
          type: 'button', classe: 'at-carte at-carte-evenement', 'data-evenement': id, 'aria-pressed': choisie ? 'true' : 'false',
          sur: { click: function () {
            ui.evenement = choisie ? null : id;
            ui.carte = null; ui.bataillon = null; ui.ville = null; ui.enAttente = null;
            rafraichir(true);
          } }
        }, [
          el('span', { classe: 'at-carte-nom', texte: id + ' ' + carte.nom }),
          el('span', { classe: 'at-texte-carte', texte: carte.texte }),
          el('span', { classe: 'at-etiquette-provisoire', texte: 'provisoire' }),
          el('span', { classe: 'at-carte-chiffres', texte: choisie ? 'Cliquez une case surlignée du plateau.' : 'Cliquer pour poser la tuile.' })
        ]));
        contenu.push(el('div', { classe: 'at-ligne' }, [bouton('Défausser sans poser', function () {
          executer('defausserEvenement', { evenement: id, joueur: etat().actif }, { apres: function () { if (ui.evenement === id) ui.evenement = null; } });
        }, { 'data-defausser-evenement': id, title: 'Défausser la carte ' + id + ' sans poser sa tuile (aucune case ne convient, par exemple)' })]));
      });
      R.remplacer(zoneEvenements, contenu);
    }

    function dessinerJournal() {
      var e = etat(), lignes = e.journal.slice(-JOURNAL_AFFICHE).reverse();
      R.vider(zoneJournal);
      lignes.forEach(function (l) {
        zoneJournal.appendChild(el('li', { value: l.n, classe: l.joueur ? 'at-journal-' + l.joueur : null }, [
          el('span', { classe: 'at-journal-tour', texte: 'T' + l.tour + (l.joueur ? ' ' + NOMS[l.joueur] : '') + ' : ' }),
          el('span', { texte: l.texte })
        ]));
      });
    }

    function rafraichir(garderVue) {
      var e = etat();
      vide.hidden = !!e;
      corps.hidden = !e;
      btnAnnuler.disabled = !h || !HI.peutAnnuler(h);
      btnRetablir.disabled = !h || !HI.peutRetablir(h);
      btnEnregistrer.disabled = !e;
      btnTroupes.disabled = !e;
      if (!e) return;
      champDes.max = e.reglages.desMax;            // le champ suit le réglage de la partie (desMax)
      // Une sélection peut ne plus exister : carte sortie de la main, bataillon reparti en réserve, tuile posée.
      if (ui.carte && e.paquets[ui.carte.joueur].main.indexOf(ui.carte.carte) === -1) ui.carte = null;
      if (ui.bataillon) {
        var choisi = PA.bataillon(e, ui.bataillon.joueur, ui.bataillon.numero);
        if (!choisi || choisi.case === null) ui.bataillon = null;
      }
      if (ui.evenement && e.paquets.evenements.main.indexOf(ui.evenement) === -1) ui.evenement = null;
      dessinerPlateau(garderVue);
      dessinerTour();
      dessinerAvis();
      dessinerContexte();
      R.remplacer(zoneJoueurs, JOUEURS.map(function (j) { return panneauJoueur(e, j); }));
      dessinerDes();
      dessinerCampement();
      dessinerEvenements();
      dessinerJournal();
    }

    // ---------------------------------------------------------------- éditeur des Troupes provisoires
    function remplirTroupes() {
      var e = etat();
      var champNombre = function (id, nom, valeur, min, max) {
        return el('input', { type: 'number', classe: 'at-champ-nombre', value: valeur, min: min, max: max, step: 1, 'data-champ': nom, 'aria-label': nom + ' de ' + id });
      };
      var lignes = Object.keys(e.troupes).map(function (id) {
        var t = e.troupes[id];
        var nom = el('input', { type: 'text', value: t.nom, maxlength: PA.LIMITES.nom, 'data-champ': 'nom', 'aria-label': 'Nom de ' + id });
        var moral = champNombre(id, 'moral', t.moral, 1, 20), puissance = champNombre(id, 'puissance', t.puissance, 0, 20), des = champNombre(id, 'des', t.des, 0, 10);
        return el('tr', { 'data-troupe': id }, [
          el('th', { scope: 'row', texte: id }), el('td', null, nom), el('td', null, moral), el('td', null, puissance), el('td', null, des),
          el('td', null, bouton('Appliquer', function () {
            var r = executer('modifierTroupe', { id: id, nom: nom.value.trim(), moral: parseInt(moral.value, 10), puissance: parseInt(puissance.value, 10), des: parseInt(des.value, 10) });
            message.textContent = r && r.ok ? 'Troupe ' + id + ' modifiée.' : 'Refusé : ' + (r ? r.raison : '');
          }, { 'data-appliquer': id }))
        ]);
      });
      var message = el('p', { classe: 'at-avis', role: 'status', id: 'pa-message-troupes' });
      R.vider(corpsDialogue);
      corpsDialogue.appendChild(el('p', { classe: 'at-bandeau-provisoire', texte: 'Troupes provisoires : noms et chiffres inventés pour les essais, sans effet de carte. Rien n’est décidé ; modifiez-les librement (les changements valent pour cette partie et sont enregistrés avec elle).' }));
      corpsDialogue.appendChild(el('table', { classe: 'at-table' }, [
        el('thead', null, el('tr', null, ['Id', 'Nom', 'Moral', 'Puissance', 'Dés', ''].map(function (t) { return el('th', { scope: 'col', texte: t }); }))),
        el('tbody', null, lignes)
      ]));
      corpsDialogue.appendChild(message);
    }

    function ouvrirTroupes() {
      if (!h) return;
      remplirTroupes();
      if (typeof dialogue.showModal === 'function') dialogue.showModal(); else dialogue.setAttribute('open', '');
    }

    function fermerTroupes() {
      if (typeof dialogue.close === 'function') dialogue.close(); else dialogue.removeAttribute('open');
    }

    // ---------------------------------------------------------------- assemblage
    champGraine.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') nouvelle(); });
    champNote.addEventListener('keydown', function (ev) { if (ev.key === 'Enter') ajouterNote(); });

    function ajouterNote() {
      if (!h) return;
      var r = executer('noter', { texte: champNote.value });
      if (r && r.ok) champNote.value = '';
    }

    dialogue.appendChild(el('header', { classe: 'at-dialogue-entete' }, [
      el('h2', { id: 'pa-titre-troupes', texte: 'Troupes provisoires' }),
      bouton('Fermer', fermerTroupes, { id: 'pa-fermer-troupes' })
    ]));
    dialogue.appendChild(corpsDialogue);

    var barre = el('div', { classe: 'at-barre-partie' }, [
      el('label', { for: 'pa-graine', texte: 'Graine de la partie' }), champGraine,
      el('label', { for: 'pa-premier', texte: 'Premier joueur' }), choixPremier,
      bouton('Nouvelle partie', function () { nouvelle(); }, { id: 'pa-nouvelle', class: 'at-principal-bouton', title: 'Nouvelle partie sur le plateau de l’onglet Plateau' }),
      btnAnnuler, btnRetablir, btnEnregistrer,
      bouton('Ouvrir…', function () { ctx.ouvrirFichier(ouvrirTexte); }, { id: 'pa-ouvrir', title: 'Ouvrir une partie enregistrée' }),
      btnTroupes,
      el('span', { classe: 'at-rappel', texte: 'Table libre : l’outil aide et prévient, il n’arbitre pas.' })
    ]);
    var corps = el('div', { classe: 'at-ecran at-ecran-partie', id: 'pa-corps', hidden: true }, [
      el('div', { classe: 'at-colonne at-colonne-gauche' }, zoneJoueurs),
      el('div', { classe: 'at-centre' }, [zoneTour, zoneAvis, vue.element, zoneContexte]),
      el('div', { classe: 'at-colonne at-colonne-droite' }, [
        el('h2', { texte: 'Dés' }),
        el('div', { classe: 'at-ligne' }, [
          el('label', { for: 'pa-nb-des', texte: 'Nombre de d6' }), champDes,
          bouton('Lancer', function () {
            var n = parseInt(champDes.value, 10);
            lancer(n, etat().actif, '', n + ' dé(s)');
          }, { id: 'pa-lancer' })
        ]),
        zoneDes,
        el('h2', { texte: 'Pioche Campement' }), zoneCampement,
        el('h2', { texte: 'Pioche Événements' }), zoneEvenements,
        el('h2', { texte: 'Journal' }),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'pa-note', texte: 'Note' }), champNote, bouton('Ajouter', ajouterNote, { id: 'pa-noter' })]),
        zoneJournal
      ])
    ]);
    var element = el('div', { classe: 'at-partie' }, [barre, vide, corps, dialogue]);
    rafraichir(false);

    return {
      element: element, vue: vue,
      nouvelle: nouvelle, etat: etat, executer: executer, annuler: annuler, retablir: retablir, touche: touche,
      enregistrer: enregistrer, ouvrirTexte: ouvrirTexte,
      texteEnregistrement: function () { return h ? PA.serialiser(h.present) : null; },
      ui: function () { return ui; }
    };
  }

  AT.vuePartie = { creer: creer, OPERATIONS: OPERATIONS };
})();
