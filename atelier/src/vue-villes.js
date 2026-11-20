/*
 * vue-villes.js : étape « Villes » de l'onglet Plateau (lot H, cahier des charges §10 : villes libres sur une Plaine).
 * Une fois le terrain construit, les joueurs posent les 2 villes neutres, puis chacun ses 2 villes de déploiement.
 * Toutes sont des tuiles posées PAR-DESSUS une case de Plaine ; la seule règle de place est l'écart de 4 pas entre
 * deux villes. L'ordre « neutres d'abord » est conseillé, jamais imposé.
 * Dépend de AT.hex, AT.catalogue, AT.plateau, AT.controles, AT.generateur ; AT.rendu pour le panneau.
 *
 * Les règles sont celles du modèle (AT.plateau.peutPoserVille / poserVille / retirerVille) : ce fichier n'en invente
 * aucune. La logique est PURE et testée sous Node (compteurs, places, diagnostic « aucune place », clic, pose
 * automatique, autre proposition, tout retirer) ; le panneau ne fait qu'afficher et transmettre. Aucun innerHTML,
 * aucun attribut style.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
    if (!AT.controles) require('./controles.js');
    if (!AT.generateur) require('./generateur.js');
  }
  var C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;

  // Ordre conseillé : les villes neutres d'abord, puis le déploiement de Vert, puis celui de Rouge.
  var OUTILS = ['neutre', 'vert', 'rouge'];
  var NOMS_OUTILS = { neutre: 'Ville neutre', vert: 'Ville de déploiement de Vert', rouge: 'Ville de déploiement de Rouge' };
  var NOMS_CAMPS = { vert: 'Vert', rouge: 'Rouge' };

  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  /** « Ville neutre » ou « Ville de déploiement de Vert » pour un propriétaire. */
  function nomVille(proprietaire) { return possede.call(NOMS_OUTILS, proprietaire) ? NOMS_OUTILS[proprietaire] : 'Ville'; }

  // ================================================================== logique pure

  /**
   * Compteurs de l'étape : {neutre, vert, rouge : {posees, voulues, complet}, completes, construction (pièces de
   * terrain encore à poser), reglesPrecedentes (le plateau porte des villes des règles d'avant le 2026-11-20)}.
   */
  function compteurs(plateau) {
    var etat = P.etatVilles(plateau);
    var un = function (posees, voulues) { return { posees: posees, voulues: voulues, complet: posees >= voulues }; };
    return {
      neutre: un(etat.neutres.length, P.quotaVilles('neutre')), vert: un(etat.vert.length, P.quotaVilles('vert')), rouge: un(etat.rouge.length, P.quotaVilles('rouge')),
      completes: etat.completes, construction: AT.controles.etape(plateau).restantes, reglesPrecedentes: etat.reglesPrecedentes
    };
  }

  /**
   * Plaines où l'outil peut poser une ville (clés triées ; [] si toutes ses villes sont posées). Ce n'est qu'une AIDE
   * à l'écran : l'autorité du clic reste AT.plateau.peutPoserVille.
   */
  function places(plateau, outil) {
    return OUTILS.indexOf(outil) === -1 ? [] : P.placesVille(plateau, outil);
  }

  /**
   * Pourquoi l'outil n'a aucune place ? Renvoie null s'il en a, sinon {cause, message} :
   *   cause 'complet' : toutes les villes de cet outil sont posées ;
   *         'ecart'   : des Plaines conviendraient, mais toutes sont trop près d'une autre ville (écart de 4 pas) ;
   *         'terrain' : le plateau n'a aucune Plaine libre hors noyau.
   */
  function diagnostic(plateau, outil) {
    if (OUTILS.indexOf(outil) === -1) return null;
    var c = compteurs(plateau), ecart = C.REGLAGES.ecartVilles;
    if (c[outil].complet) {
      return { cause: 'complet', message: outil === 'neutre'
        ? 'Les ' + c.neutre.voulues + ' villes neutres sont posées. Cliquez une ville pour la retirer.'
        : NOMS_CAMPS[outil] + ' a ses ' + c[outil].voulues + ' villes de déploiement. Cliquez une ville pour la retirer.' };
    }
    if (places(plateau, outil).length) return null;
    var plaines = P.placesVilleSurCases(P.casesPourVilles(plateau), { sansEcart: true });
    if (plaines.length) {
      return { cause: 'ecart', message: 'Aucune place pour : ' + nomVille(outil).toLowerCase() + '. ' + pluriel(plaines.length, 'Plaine conviendrait', 'Plaines conviendraient')
        + ', mais toutes sont trop près d’une autre ville : il faut ' + ecart + ' pas entre deux villes (soit ' + (ecart - 1) + ' cases entre elles). Retirez ou déplacez une ville, ou essayez « Poser les villes automatiquement ».' };
    }
    return { cause: 'terrain', message: 'Aucune place pour : ' + nomVille(outil).toLowerCase() + '. Le plateau n’a aucune Plaine libre hors du noyau : construisez d’abord le terrain.' };
  }

  /**
   * Clic sur une case pendant l'étape « Villes » : une ville posée là est RETIRÉE, sinon l'outil y pose la sienne.
   * Renvoie {ok, plateau, action ('pose' | 'retrait' | null), message, niveau, cause} ; un refus porte la raison du modèle.
   */
  function cliquer(plateau, outil, cle) {
    var toutes = P.cases(plateau, { sansRecouvrements: true }), ici = possede.call(toutes, cle) ? toutes[cle] : null, r;
    if (ici && (ici.ville || ici.modele === 'VN')) {
      r = P.retirerVille(plateau, cle);
      if (!r.ok) return { ok: false, plateau: plateau, action: null, message: r.raison, niveau: 'erreur' };
      return { ok: true, plateau: r.plateau, action: 'retrait', niveau: 'info', message: r.ancienne
        ? 'Ville neutre des règles précédentes retirée de (' + cle + ') : posez-la maintenant sur une Plaine.'
        : nomVille(r.proprietaire) + ' retirée de (' + cle + ') : la Plaine du dessous est de nouveau libre.' };
    }
    if (OUTILS.indexOf(outil) === -1) return { ok: false, plateau: plateau, action: null, message: 'Choisissez d’abord une ville à poser.', niveau: 'erreur' };
    r = P.poserVille(plateau, outil, cle);
    if (!r.ok) return { ok: false, plateau: plateau, action: null, message: 'Pose refusée : ' + r.raison, niveau: 'erreur', cause: r.cause };
    return { ok: true, plateau: r.plateau, action: 'pose', message: nomVille(outil) + ' posée sur la Plaine (' + cle + ').', niveau: 'info' };
  }

  /**
   * Plateau sans aucune ville posée : ni tuile posée par-dessus une Plaine (la liste entière est vidée, entrées
   * fautives comprises), ni ancienne tuile de ville neutre. Le terrain et le noyau ne bougent pas.
   * Renvoie {plateau, nombre (villes retirées)}.
   */
  function retirerToutes(plateau) {
    var copie = JSON.parse(JSON.stringify(plateau));
    var nombre = (Array.isArray(copie.deploiements) ? copie.deploiements.length : 0);
    delete copie.deploiements;
    var avant = copie.pieces.length;
    copie.pieces = copie.pieces.filter(function (p) { return p.modele !== 'VN'; });
    nombre += avant - copie.pieces.length;
    return { plateau: nombre ? P.avecCamps(copie) : plateau, nombre: nombre };
  }

  /** Préparation commune aux poses automatiques : plateau sans villes, cases où juger les villes ; refus si le noyau manque. */
  function preparerPose(plateau) {
    var refus = function (raison, manque) { return { ok: false, plateau: plateau, score: null, raison: raison, manque: manque || null }; };
    var base = retirerToutes(plateau).plateau, terrain = P.casesPourVilles(base);
    var centre = possede.call(terrain, '0,0') ? C.modele(terrain['0,0'].modele) : null;
    if (!centre || !centre.noyau) return refus('Le noyau doit être posé au centre du plateau : l’équilibre se mesure depuis sa ville.');
    if (P.catalogueDuPlateau(base).premier) return refus('Ce plateau du premier catalogue porte déjà ses villes en tuiles d’une case : la pose automatique ne s’y applique pas.');
    return { ok: true, base: base, terrain: terrain, refus: refus };
  }

  /** Pose sur le plateau préparé les six villes `v` ({neutres, vert, rouge}) et rend {ok, plateau, score, avantageTexte, annonce, raison, manque}. */
  function appliquerVilles(prep, v, options) {
    var pl = prep.base, etape;
    var liste = v.neutres.map(function (k) { return ['neutre', k]; }).concat(v.vert.map(function (k) { return ['vert', k]; }), v.rouge.map(function (k) { return ['rouge', k]; }));
    for (var i = 0; i < liste.length; i++) {
      etape = P.poserVille(pl, liste[i][0], liste[i][1]);
      if (!etape.ok) return prep.refus(nomVille(liste[i][0]) + ' en (' + liste[i][1] + ') : ' + etape.raison);
      pl = etape.plateau;
    }
    var e = AT.controles.equilibre(pl, options);
    return { ok: true, plateau: pl, score: e.score, avantageTexte: e.avantageTexte, annonce: AT.controles.texteAnnonce(e), raison: null, manque: null };
  }

  /** « (score 3 ; avantage Vert de 3) », suivi de l'annonce d'un déséquilibre marqué s'il y a lieu. */
  function texteEquilibre(r) {
    return 'score d’équilibre ' + r.score + ' (0 = équilibré ; ' + r.avantageTexte + ').' + (r.annonce ? ' ' + r.annonce : '');
  }

  /**
   * Pose toutes les villes d'un coup, au meilleur équilibre (AT.generateur.chercherVilles) : les villes déjà posées
   * sont d'abord retirées. Aucun tirage : même plateau = mêmes villes.
   * Renvoie {ok, plateau, score, avantageTexte, annonce, raison, manque}. options : réglages des contrôles.
   */
  function poserAuto(plateau, options) {
    var G = AT.generateur, prep = preparerPose(plateau);
    if (!prep.ok) return prep;
    var v = G.chercherVilles(prep.terrain, G.reglages(options));
    if (!v.ok) return prep.refus(v.raison, v.manque);
    return appliquerVilles(prep, v, options);
  }

  /**
   * « Autre proposition » : pose les villes selon le placement qui SUIT celui du plateau dans la liste de
   * AT.generateur.propositionsVilles (du mieux équilibré au moins équilibré ; après le dernier, retour au premier).
   * Sans villes posées, ou avec des villes qui ne sont pas un placement de la liste : le premier.
   * Aucun tirage : même plateau = même proposition, et la suite des propositions se retrouve après « Annuler ».
   * Renvoie {ok, plateau, score, avantageTexte, annonce, raison, manque, rang (1 à nombre), nombre, seule (true : il
   * n'existe qu'un placement, et c'est celui du plateau)}.
   */
  function autreProposition(plateau, options) {
    var G = AT.generateur, prep = preparerPose(plateau);
    if (!prep.ok) return prep;
    var liste = G.propositionsVilles(prep.terrain, G.reglages(options));
    if (!liste.length) return poserAuto(plateau, options);      // même explication que la pose automatique
    var etat = P.etatVilles(plateau);
    var actuelle = G.signatureVilles({ neutres: etat.neutres.map(function (n) { return n.cle; }), vert: etat.vert, rouge: etat.rouge });
    var rang = -1;
    liste.forEach(function (x, i) { if (rang === -1 && G.signatureVilles(x) === actuelle) rang = i; });
    var suivant = (rang + 1) % liste.length;
    var r = appliquerVilles(prep, liste[suivant], options);
    r.rang = suivant + 1; r.nombre = liste.length; r.seule = liste.length === 1 && rang === 0;
    return r;
  }

  /** Premier outil qui a encore des villes à poser (neutres, Vert, puis Rouge : l'ordre conseillé), ou null si tout est posé. */
  function outilSuivant(plateau) {
    var c = compteurs(plateau);
    return OUTILS.filter(function (o) { return !c[o].complet; })[0] || null;
  }

  AT.vueVilles = {
    OUTILS: OUTILS, NOMS_OUTILS: NOMS_OUTILS,
    compteurs: compteurs, places: places, diagnostic: diagnostic, cliquer: cliquer,
    retirerToutes: retirerToutes, poserAuto: poserAuto, autreProposition: autreProposition, outilSuivant: outilSuivant, texteEquilibre: texteEquilibre
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueVilles;
  if (typeof document === 'undefined') return;

  // ================================================================== panneau « Villes »

  /**
   * `acces` (fourni par vue-plateau.js) : plateau(), bilan(), changer(plateau), message(texte, niveau),
   *   reglages() (objet partagé avec les contrôles et le générateur), redessiner() (après un changement d'outil).
   * Renvoie {element, rafraichir(), clic(cle), places(), outil(), entrer(), choisir(outil), auto(), autre(), toutRetirer()}.
   */
  function creer(acces) {
    var R = AT.rendu, el = R.el;
    var outil = 'neutre';
    var zoneEtape = el('p', { classe: 'at-villes-etape', id: 'vi-etape' });
    var zonePrecedentes = el('p', { classe: 'at-avis', id: 'vi-precedentes', hidden: true });
    var zoneOutils = el('div', { classe: 'at-villes-outils', id: 'vi-outils', role: 'group', 'aria-label': 'Ville à poser' });
    var zoneDiagnostic = el('p', { classe: 'at-avis', id: 'vi-diagnostic', hidden: true });
    var zoneMessage = el('p', { classe: 'at-pinceau-message', id: 'vi-message', 'aria-live': 'polite' });
    var btnAuto = el('button', { type: 'button', id: 'vi-auto', classe: 'at-principal-bouton', texte: 'Poser les villes automatiquement', title: 'Retire les villes posées, puis pose les 6 villes au meilleur équilibre entre Vert et Rouge', sur: { click: auto } });
    var btnAutre = el('button', { type: 'button', id: 'vi-autre', texte: 'Autre proposition', title: 'Passe au placement suivant des 6 villes, du mieux équilibré au moins équilibré. Même plateau = même suite.', sur: { click: autre } });
    var btnRetirer = el('button', { type: 'button', id: 'vi-retirer', texte: 'Retirer toutes les villes', sur: { click: toutRetirer } });

    function optionsControles() {
      var regl = acces.reglages(), o = {};
      ['seuilContact', 'mesureContact'].forEach(function (k) { if (regl[k] !== undefined) o[k] = regl[k]; });
      return o;
    }

    function dire(texte, niveau) {
      zoneMessage.textContent = texte;
      zoneMessage.className = 'at-pinceau-message at-niveau-' + (niveau === 'erreur' ? 'erreur' : (niveau === 'alerte' ? 'alerte' : 'info'));
      acces.message(texte, niveau);
    }

    function choisir(nouvel) { outil = nouvel; acces.redessiner(); }

    function clic(cle) {
      var r = cliquer(acces.plateau(), outil, cle);
      if (!r.ok) { dire(r.message, r.niveau); return; }
      // L'outil passe de lui-même à la ville suivante quand le sien a tout posé.
      var suivant = r.action === 'pose' && compteurs(r.plateau)[outil].complet ? outilSuivant(r.plateau) : null;
      if (suivant) outil = suivant;
      acces.changer(r.plateau);
      dire(r.message + (compteurs(r.plateau).completes ? ' Toutes les villes sont posées.' : ''), r.niveau);
    }

    function auto() {
      var r = poserAuto(acces.plateau(), optionsControles());
      if (!r.ok) { dire('Pose automatique impossible : ' + r.raison, 'erreur'); return; }
      acces.changer(r.plateau);
      dire('Villes posées automatiquement au meilleur équilibre : ' + texteEquilibre(r) + ' Annuler pour revenir en arrière.', r.annonce ? 'alerte' : 'info');
    }

    function autre() {
      var r = autreProposition(acces.plateau(), optionsControles());
      if (!r.ok) { dire('Autre proposition impossible : ' + r.raison, 'erreur'); return; }
      if (r.seule) { dire('Il n’existe qu’un seul placement des villes sur ce terrain : rien ne change.', 'info'); return; }
      acces.changer(r.plateau);
      dire('Autre proposition : placement n° ' + r.rang + ' sur ' + r.nombre + ', du mieux équilibré au moins équilibré ; ' + texteEquilibre(r) + ' Annuler pour revenir à la précédente.', r.annonce ? 'alerte' : 'info');
    }

    function toutRetirer() {
      var r = retirerToutes(acces.plateau());
      if (!r.nombre) { dire('Aucune ville à retirer.', 'info'); return; }
      outil = 'neutre';
      acces.changer(r.plateau);
      dire(pluriel(r.nombre, 'ville retirée', 'villes retirées') + ' : le terrain n’a pas changé. Annuler pour les retrouver.', 'info');
    }

    function rafraichir() {
      var pl = acces.plateau(), c = compteurs(pl), bilan = acces.bilan();
      var etape = bilan ? bilan.etape : (c.construction ? 'construction' : (c.completes ? 'complet' : 'villes'));
      zoneEtape.setAttribute('data-etape', etape);
      var catalogue = P.catalogueDuPlateau(pl), ancien = catalogue.premier;
      if (ancien) zoneEtape.setAttribute('data-etape', 'ancien');
      zoneEtape.setAttribute('data-catalogue', catalogue.nom);
      zoneEtape.textContent = ancien
        ? 'Plateau de l’ancien catalogue : ses villes sont des tuiles d’une case, posées pendant la construction. L’étape « Villes » est faite pour les villes posées sur une Plaine ; vous pouvez tout de même essayer d’en poser.'
        : etape === 'construction'
        ? 'Le terrain n’est pas fini (' + pluriel(c.construction, 'pièce', 'pièces') + ' de terrain à poser). Les villes se posent une fois la construction terminée ; vous pouvez déjà essayer.'
        : (catalogue.precedent ? 'Plateau du catalogue précédent : ' : '') + (etape === 'villes' ? (catalogue.precedent ? 'posez les villes.' : 'Construction terminée : posez les villes.')
          : (catalogue.precedent ? 'toutes les villes sont posées.' : 'Plateau complet : toutes les villes sont posées.'));
      zonePrecedentes.hidden = !c.reglesPrecedentes || ancien;
      zonePrecedentes.textContent = zonePrecedentes.hidden ? '' : 'Règles précédentes pour les villes : ce plateau porte des villes neutres en tuiles ajoutées contre le plateau. Il reste jouable tel quel. '
        + 'Pour le mettre aux règles actuelles : « Retirer toutes les villes », puis reposez-les sur des Plaines (ou « Poser les villes automatiquement »).';
      R.remplacer(zoneOutils, OUTILS.map(function (o) {
        var type = o === 'neutre' ? 'vn-plaine' : 'vd-' + o;
        return el('button', {
          type: 'button', classe: 'at-villes-outil' + (c[o].complet ? ' at-villes-complet' : ''), id: 'vi-outil-' + o, 'aria-pressed': outil === o ? 'true' : 'false',
          title: NOMS_OUTILS[o] + ' : une tuile posée par-dessus une Plaine, à 4 pas au moins de toute autre ville',
          sur: { click: function () { choisir(o); } }
        }, [R.pastilleTuile(type, 0.42), el('span', { texte: o === 'neutre' ? 'Ville neutre' : 'Déploiement de ' + NOMS_CAMPS[o] }),
          el('strong', { classe: 'at-villes-compteur', 'data-compteur': o, texte: c[o].posees + ' / ' + c[o].voulues })]);
      }));
      var d = diagnostic(pl, outil);
      zoneDiagnostic.hidden = !d || d.cause === 'complet';
      zoneDiagnostic.textContent = d && d.cause !== 'complet' ? d.message : '';
      zoneDiagnostic.setAttribute('data-cause', d ? d.cause : '');
      btnRetirer.disabled = !(c.vert.posees + c.rouge.posees + c.neutre.posees) && !P.deploiements(pl).length;
    }

    var element = el('div', { classe: 'at-mode-panneau', id: 'vi-panneau' }, [
      el('fieldset', null, [
        el('legend', { texte: 'Étape « Villes »' }),
        zoneEtape,
        zonePrecedentes,
        el('p', { classe: 'at-aide', id: 'vi-ordre', texte: 'Ordre conseillé : les 2 villes neutres d’abord, puis les 2 villes de déploiement de chaque joueur (l’outil ne l’impose pas).' }),
        el('p', { classe: 'at-aide', texte: 'Choisissez une ville, puis cliquez une Plaine en surbrillance pour la poser. Cliquez une ville posée pour la retirer. Tout s’annule (Ctrl+Z).' }),
        zoneOutils,
        zoneDiagnostic,
        zoneMessage,
        el('div', { classe: 'at-ligne' }, [btnAuto, btnAutre]),
        el('div', { classe: 'at-ligne' }, [btnRetirer])
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Rappel des règles' }),
        el('p', { classe: 'at-aide', id: 'vi-regles', texte: 'Toutes les villes se posent PAR-DESSUS une case de Plaine, n’importe où sur le plateau, hors du noyau : 2 villes neutres, puis 2 villes de déploiement par joueur. '
          + 'Seule contrainte : 4 pas au moins entre deux villes, celle du centre comprise (3 cases entre elles). Une Plaine qui porte une tuile d’événement ne reçoit pas de ville.' })
      ])
    ]);

    return {
      element: element, rafraichir: rafraichir, clic: clic,
      places: function () { return places(acces.plateau(), outil); },
      outil: function () { return outil; },
      /** À l'entrée dans le mode : l'outil est la première ville qui reste à poser (neutres, Vert, puis Rouge). */
      entrer: function () { outil = outilSuivant(acces.plateau()) || outil; },
      choisir: choisir, auto: auto, autre: autre, toutRetirer: toutRetirer
    };
  }

  AT.vueVilles.creer = creer;
})();
