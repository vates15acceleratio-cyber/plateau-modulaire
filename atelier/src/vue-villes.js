/*
 * vue-villes.js : étape « Villes » de l'onglet Plateau (lot G, cahier des charges §9.1 B3 à B6).
 * Une fois le terrain construit, les joueurs posent les villes aux extrémités :
 *   - ville de déploiement (VD) : une tuile posée PAR-DESSUS une Plaine du bord haut (Vert) ou du bord bas (Rouge),
 *     2 par joueur ;
 *   - ville neutre (VN) : une tuile AJOUTÉE contre un flanc, une à gauche et une à droite.
 * Dépend de AT.hex, AT.catalogue, AT.plateau, AT.controles, AT.generateur, AT.alea ; AT.rendu pour le panneau.
 *
 * Les règles sont celles du modèle (AT.plateau.peutPoser… / poser… / retirer…) : ce fichier n'en invente aucune.
 * La logique est PURE et testée sous Node (compteurs, places, diagnostic « aucune place », clic, pose automatique,
 * tout retirer) ; le panneau ne fait qu'afficher et transmettre. Aucun innerHTML, aucun attribut style.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.alea) require('./alea.js');
    if (!AT.plateau) require('./plateau.js');
    if (!AT.controles) require('./controles.js');
    if (!AT.generateur) require('./generateur.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;

  var OUTILS = ['vert', 'rouge', 'neutre'];
  var NOMS_OUTILS = { vert: 'Ville de déploiement de Vert', rouge: 'Ville de déploiement de Rouge', neutre: 'Ville neutre' };
  var NOMS_CAMPS = { vert: 'Vert', rouge: 'Rouge' };
  var PROFONDEURS = P.profondeursPermises();

  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  // ================================================================== logique pure

  /**
   * Profondeur des extrémités en vigueur : celle que le plateau a enregistrée (s'il est fourni et la porte), sinon
   * options.profondeurExtremite, sinon le réglage du catalogue. Voir AT.plateau.profondeurExtremite.
   */
  function profondeur(options, plateau) {
    var p = options && options.profondeurExtremite;
    var demandee = (Number.isInteger(p) && p >= 1) ? p : C.REGLAGES.villes.profondeurExtremite;
    return plateau ? P.profondeurExtremite(plateau, { profondeurExtremite: demandee }) : demandee;
  }

  /** Options passées au modèle : la profondeur des extrémités, et `libre` si la pose libre est cochée. */
  function regles(options, supplement) {
    var o = { profondeurExtremite: profondeur(options) };
    if (options && options.libre) o.libre = true;
    Object.keys(supplement || {}).forEach(function (k) { o[k] = supplement[k]; });
    return o;
  }

  /**
   * Compteurs de l'étape : {vert, rouge, neutre : {posees, voulues, complet}, completes, construction (pièces de
   * terrain encore à poser)}.
   */
  function compteurs(plateau) {
    var etat = P.etatVilles(plateau), parCamp = C.REGLAGES.villesParCamp, neutre = C.modele('VN');
    var total = neutre ? neutre.nombre : 0;
    var un = function (posees, voulues) { return { posees: posees, voulues: voulues, complet: posees >= voulues }; };
    return {
      vert: un(etat.vert.length, parCamp), rouge: un(etat.rouge.length, parCamp), neutre: un(etat.neutres.length, total),
      completes: etat.completes, construction: AT.controles.etape(plateau).restantes
    };
  }

  /** Cases vides qui touchent le plateau (anneau autour du terrain) : clés triées. */
  function anneau(plateau) {
    var toutes = P.cases(plateau, { sansRecouvrements: true }), vues = Object.create(null), res = [];
    Object.keys(toutes).forEach(function (k) {
      H.voisines(k).forEach(function (v) {
        if (vues[v] === true || possede.call(toutes, v) || !H.estCle(v)) return;
        vues[v] = true;
        res.push(v);
      });
    });
    return H.trier(res);
  }

  /**
   * Places où l'outil peut poser une ville (clés triées ; [] si toutes ses villes sont posées). Ce n'est qu'une AIDE
   * à l'écran : l'autorité du clic reste AT.plateau.peutPoser…
   * options : profondeurExtremite, libre (pose libre : toutes les places matériellement possibles).
   */
  function places(plateau, outil, options) {
    var c = compteurs(plateau);
    if (OUTILS.indexOf(outil) === -1 || c[outil].complet) return [];
    if (outil === 'neutre') {
      if (options && options.libre) {
        return anneau(plateau).filter(function (k) { return P.peutPoserVilleNeutre(plateau, k, { libre: true }).ok; });
      }
      return P.placesNeutres(plateau, regles(options)).map(function (x) { return x.cle; });
    }
    if (options && options.libre) {
      var toutes = P.cases(plateau);
      return H.trier(Object.keys(toutes).filter(function (k) { return P.refusDeploiementSurCases(toutes, outil, k, { libre: true }) === null; }));
    }
    return P.placesDeploiement(plateau, outil, regles(options));
  }

  /**
   * Pourquoi l'outil n'a aucune place ? Renvoie null s'il en a (ou en pose libre), sinon
   * {cause, message, profondeurConseillee (1 à 3, ou null)} :
   *   cause 'complet'    : toutes les villes de cet outil sont posées ;
   *         'ecart'      : des cases conviendraient, mais toutes sont trop près d'une autre ville (écart de 4 pas) ;
   *         'profondeur' : rien dans les rangées de l'extrémité, mais il y en aurait avec une extrémité plus profonde ;
   *         'hauteur'    : (ville neutre) des cases conviendraient hors du tiers central des rangées (seulement si le
   *                        réglage neutresTiersCentral est remis à vrai : ce n'est plus une règle) ;
   *         'flanc'      : (ville neutre) le seul flanc qui a des places porte déjà sa ville neutre ;
   *         'terrain'    : aucune case ne convient, quelle que soit la règle assouplie.
   */
  function diagnostic(plateau, outil, options) {
    if (OUTILS.indexOf(outil) === -1) return null;
    var c = compteurs(plateau), ecart = C.REGLAGES.ecartVilles;
    if (c[outil].complet) {
      return { cause: 'complet', profondeurConseillee: null, message: outil === 'neutre'
        ? 'Les ' + c.neutre.voulues + ' villes neutres sont posées. Cliquez une ville pour la retirer.'
        : NOMS_CAMPS[outil] + ' a ses ' + c[outil].voulues + ' villes de déploiement. Cliquez une ville pour la retirer.' };
    }
    if ((options && options.libre) || places(plateau, outil, options).length) return null;
    var toutes = P.cases(plateau), prof = profondeur(options, plateau);
    var phraseEcart = 'trop près d’une autre ville : il faut ' + ecart + ' pas entre deux villes (soit ' + (ecart - 1) + ' cases entre elles)';

    if (outil === 'neutre') {
      var etat = P.etatVilles(plateau);
      var libres = function (liste) { return liste.filter(function (x) { return !etat.neutres.some(function (n) { return n.flanc === x.flanc; }); }); };
      var sansEcart = P.placesNeutresSurCases(toutes, regles(options, { sansEcart: true }));
      if (libres(sansEcart).length) {
        return { cause: 'ecart', profondeurConseillee: null, message: 'Aucune place pour une ville neutre : ' + pluriel(libres(sansEcart).length, 'case conviendrait', 'cases conviendraient')
          + ', mais ' + phraseEcart + '. Retirez ou déplacez une ville voisine (souvent une ville de déploiement).' };
      }
      if (sansEcart.length) {
        return { cause: 'flanc', profondeurConseillee: null, message: 'Aucune place pour une ville neutre : il en faut une par flanc, et le flanc qui reste n’a aucune case qui convienne (tenue par au moins '
          + C.REGLAGES.villes.contactVilleNeutre + ' tuiles différentes).' };
      }
      var horsTiers = P.placesNeutresSurCases(toutes, regles(options, { sansEcart: true, neutresTiersCentral: false }));
      if (libres(horsTiers).length) {
        return { cause: 'hauteur', profondeurConseillee: null, message: 'Aucune place pour une ville neutre à mi-hauteur du plateau (réglage du tiers central) : les flancs n’ont de case libre tenue par au moins '
          + C.REGLAGES.villes.contactVilleNeutre + ' tuiles que plus haut ou plus bas. Retouchez le bord du terrain, ou essayez en pose libre.' };
      }
      return { cause: 'terrain', profondeurConseillee: null, message: 'Aucune place pour une ville neutre : aucune case libre contre un flanc n’est tenue par au moins '
        + C.REGLAGES.villes.contactVilleNeutre + ' tuiles différentes. Retouchez le bord du terrain, ou essayez en pose libre.' };
    }

    var cote = outil === 'vert' ? 'haut' : 'bas', nom = NOMS_CAMPS[outil];
    var autres = function (p, sansEcartLa) { return P.placesDeploiementSurCases(toutes, outil, { profondeurExtremite: p, sansEcart: !!sansEcartLa }); };
    // Une extrémité plus profonde donnerait-elle des places (écart respecté) ?
    var conseil = null;
    PROFONDEURS.forEach(function (p) { if (conseil === null && p > prof && autres(p, false).length) conseil = p; });
    var suite = conseil !== null ? ' Ou élargissez l’extrémité à ' + conseil + ' rangées (réglage « Profondeur des extrémités » ci-dessous).' : '';
    var proches = autres(prof, true);
    if (proches.length) {
      return { cause: 'ecart', profondeurConseillee: conseil, message: 'Aucune place pour ' + nom + ' : ' + pluriel(proches.length, 'Plaine du bord ' + cote + ' conviendrait', 'Plaines du bord ' + cote + ' conviendraient')
        + ', mais ' + phraseEcart + '. Retirez ou déplacez une ville voisine.' + suite };
    }
    if (conseil !== null) {
      return { cause: 'profondeur', profondeurConseillee: conseil, message: 'Aucune place pour ' + nom + ' : aucune Plaine au bord du plateau dans ' + (prof > 1 ? 'les ' + prof + ' rangées' : 'la rangée')
        + ' du ' + cote + '. Avec ' + conseil + ' rangées, il y en a ' + autres(conseil, false).length + ' : changez le réglage « Profondeur des extrémités » ci-dessous.' };
    }
    return { cause: 'terrain', profondeurConseillee: null, message: 'Aucune place pour ' + nom + ' : le bord ' + cote + ' du plateau n’a pas de Plaine libre (hors noyau) qui convienne, même avec une extrémité de '
      + PROFONDEURS[PROFONDEURS.length - 1] + ' rangées. Retouchez le terrain, ou essayez en pose libre.' };
  }

  /**
   * Clic sur une case pendant l'étape « Villes » : une ville posée là est RETIRÉE, sinon l'outil y pose la sienne.
   * Renvoie {ok, plateau, action ('pose' | 'retrait' | null), message, niveau} ; un refus porte la raison du modèle.
   */
  function cliquer(plateau, outil, cle, options) {
    var toutes = P.cases(plateau, { sansRecouvrements: true }), ici = possede.call(toutes, cle) ? toutes[cle] : null, r;
    if (ici && ici.ville) {
      r = P.retirerVilleDeploiement(plateau, cle);
      if (!r.ok) return { ok: false, plateau: plateau, action: null, message: r.raison, niveau: 'erreur' };
      return { ok: true, plateau: r.plateau, action: 'retrait', message: 'Ville de déploiement de ' + NOMS_CAMPS[r.camp] + ' retirée de (' + cle + ') : la Plaine du dessous est de nouveau libre.', niveau: 'info' };
    }
    if (ici && ici.modele === 'VN') {
      r = P.retirerVilleNeutre(plateau, cle);
      if (!r.ok) return { ok: false, plateau: plateau, action: null, message: r.raison, niveau: 'erreur' };
      return { ok: true, plateau: r.plateau, action: 'retrait', message: 'Ville neutre retirée de (' + cle + ').', niveau: 'info' };
    }
    if (OUTILS.indexOf(outil) === -1) return { ok: false, plateau: plateau, action: null, message: 'Choisissez d’abord une ville à poser.', niveau: 'erreur' };
    var libre = !!(options && options.libre), suite = libre ? ' Pose libre : les contrôles disent si elle respecte les règles.' : '';
    if (outil === 'neutre') {
      r = P.poserVilleNeutre(plateau, cle, regles(options));
      if (!r.ok) return { ok: false, plateau: plateau, action: null, message: 'Pose refusée : ' + r.raison, niveau: 'erreur' };
      return { ok: true, plateau: r.plateau, action: 'pose', message: 'Ville neutre posée en (' + cle + ')' + (r.flanc ? ', sur le flanc ' + (r.flanc === 'droite' ? 'droit' : 'gauche') : '') + '.' + suite, niveau: libre ? 'alerte' : 'info' };
    }
    r = P.poserVilleDeploiement(plateau, outil, cle, regles(options));
    if (!r.ok) return { ok: false, plateau: plateau, action: null, message: 'Pose refusée : ' + r.raison, niveau: 'erreur' };
    return { ok: true, plateau: r.plateau, action: 'pose', message: 'Ville de déploiement de ' + NOMS_CAMPS[outil] + ' posée sur la Plaine (' + cle + ').' + suite, niveau: libre ? 'alerte' : 'info' };
  }

  /**
   * Plateau sans aucune ville posée : ni ville de déploiement (la liste entière est vidée, entrées fautives
   * comprises), ni ville neutre. Le terrain et le noyau ne bougent pas. Renvoie {plateau, nombre (villes retirées)}.
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

  /**
   * Pose toutes les villes d'un coup, au meilleur équilibre (AT.generateur.chercherVilles) : les villes déjà posées
   * sont d'abord retirées. Même plateau et même graine = mêmes villes.
   * Renvoie {ok, plateau, score, raison, manque}. options : profondeurExtremite (si le plateau n'a pas enregistré la
   * sienne), et les réglages des contrôles. La profondeur employée est enregistrée dans le plateau rendu.
   */
  function poserAuto(plateau, graine, options) {
    var G = AT.generateur, prep = preparerPose(plateau, options);
    if (!prep.ok) return prep;
    var v = G.chercherVilles(prep.terrain, AT.alea.creer(graine === undefined || graine === null ? 0 : graine), G.reglages(prep.options));
    if (!v.ok) {
      var cause = v.manque === 'ecart' || /Aucune paire/.test(v.raison || '') ? ' La cause est l’écart de ' + C.REGLAGES.ecartVilles + ' pas entre deux villes.' : '';
      return prep.refus(v.raison + cause + ' Places trouvées : ' + v.places.vert + ' pour Vert, ' + v.places.rouge + ' pour Rouge, ' + v.places.gauche + ' sur le flanc gauche, ' + v.places.droite + ' sur le flanc droit.', v.manque);
    }
    return appliquerVilles(prep, v);
  }

  /** Préparation commune aux poses automatiques : plateau sans villes, terrain, réglages ; refus si le noyau manque. */
  function preparerPose(plateau, options) {
    var refus = function (raison, manque) { return { ok: false, plateau: plateau, score: null, raison: raison, manque: manque || null }; };
    var base = retirerToutes(plateau).plateau;
    // Les distances et l'équilibre se mesurent sur le terrain sans les tuiles d'événement (comme les contrôles), mais
    // une Plaine couverte par une tuile d'événement posée à l'essai ne peut pas recevoir de ville : elle est marquée,
    // et refusDeploiementSurCases l'écarte des candidates.
    var terrain = P.cases(base, { sansRecouvrements: true });
    (base.recouvrements || []).forEach(function (x) { if (possede.call(terrain, x.cle)) terrain[x.cle].evenement = x.evenement; });
    var centre = possede.call(terrain, '0,0') ? C.modele(terrain['0,0'].modele) : null;
    if (!centre || !centre.noyau) return refus('Le noyau doit être posé au centre du plateau : l’équilibre se mesure depuis sa ville.');
    var o = { profondeurExtremite: profondeur(options, plateau) };
    ['seuilContact', 'mesureContact'].forEach(function (k) { if (options && options[k] !== undefined) o[k] = options[k]; });
    return { ok: true, base: base, terrain: terrain, options: o, refus: refus };
  }

  /** Pose sur le plateau préparé les six villes `v` ({vert, rouge, neutres}) et rend {ok, plateau, score, raison, manque}. */
  function appliquerVilles(prep, v) {
    var refus = prep.refus, o = prep.options;
    var pl = P.avecProfondeurExtremite(prep.base, o.profondeurExtremite).plateau, etape;
    var liste = v.vert.map(function (k) { return ['vert', k]; }).concat(v.rouge.map(function (k) { return ['rouge', k]; }));
    for (var i = 0; i < liste.length; i++) {
      etape = P.poserVilleDeploiement(pl, liste[i][0], liste[i][1], { libre: true });      // les règles ont été vérifiées par chercherVilles
      if (!etape.ok) return refus('Ville de déploiement en (' + liste[i][1] + ') : ' + etape.raison);
      pl = etape.plateau;
    }
    var flancs = ['gauche', 'droite'];
    for (var j = 0; j < flancs.length; j++) {
      etape = P.poserVilleNeutre(pl, v.neutres[flancs[j]], { libre: true });
      if (!etape.ok) return refus('Ville neutre en (' + v.neutres[flancs[j]] + ') : ' + etape.raison);
      pl = etape.plateau;
    }
    pl = P.avecCamps(pl);
    return { ok: true, plateau: pl, score: AT.controles.equilibre(pl, o).score, raison: null, manque: null };
  }

  /**
   * « Autre proposition » : pose les villes selon le placement qui SUIT celui du plateau dans la liste de
   * AT.generateur.propositionsVilles (du mieux équilibré au moins équilibré ; après le dernier, retour au premier).
   * Ce qui est parcouru : les placements des 4 villes de DÉPLOIEMENT ; à chacun, les 2 villes neutres vont à la
   * meilleure place de chaque flanc (les autres places des villes neutres ne sont pas proposées, et le message le dit). Sans villes posées, ou avec des villes qui ne sont pas une combinaison de la liste : la première.
   * Aucun tirage : même plateau = même proposition, et la suite des propositions se retrouve après « Annuler ».
   * Renvoie {ok, plateau, score, raison, manque, rang (1 à nombre), nombre, seule (true : il n'existe qu'une
   * combinaison, et c'est celle du plateau)}.
   */
  function autreProposition(plateau, options) {
    var G = AT.generateur, prep = preparerPose(plateau, options);
    if (!prep.ok) return prep;
    var liste = G.propositionsVilles(prep.terrain, G.reglages(prep.options));
    if (!liste.length) return poserAuto(plateau, plateau.graine, options);      // même explication que la pose automatique
    var etat = P.etatVilles(plateau), flancs = {};
    etat.neutres.forEach(function (n) { if (n.flanc) flancs[n.flanc] = n.cle; });
    var actuelle = G.signatureVilles({ vert: etat.vert, rouge: etat.rouge, neutres: { gauche: flancs.gauche, droite: flancs.droite } });
    var rang = -1;
    liste.forEach(function (x, i) { if (rang === -1 && G.signatureVilles(x) === actuelle) rang = i; });
    var suivant = (rang + 1) % liste.length;
    var r = appliquerVilles(prep, liste[suivant]);
    r.rang = suivant + 1; r.nombre = liste.length; r.seule = liste.length === 1 && rang === 0;
    return r;
  }

  /** Premier outil qui a encore des villes à poser (vert, rouge, puis neutre), ou null si tout est posé. */
  function outilSuivant(plateau) {
    var c = compteurs(plateau);
    return OUTILS.filter(function (o) { return !c[o].complet; })[0] || null;
  }

  AT.vueVilles = {
    OUTILS: OUTILS, NOMS_OUTILS: NOMS_OUTILS, PROFONDEURS: PROFONDEURS,
    profondeur: profondeur, compteurs: compteurs, anneau: anneau, places: places, diagnostic: diagnostic, cliquer: cliquer,
    retirerToutes: retirerToutes, poserAuto: poserAuto, autreProposition: autreProposition, outilSuivant: outilSuivant
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueVilles;
  if (typeof document === 'undefined') return;

  // ================================================================== panneau « Villes »

  /**
   * `acces` (fourni par vue-plateau.js) : plateau(), bilan(), changer(plateau), message(texte, niveau),
   *   reglages() (objet partagé avec les contrôles et le générateur ; profondeurExtremite y suit le plateau courant :
   *   le réglage est ENREGISTRÉ dans le document, la liste déroulante le modifie par changer()),
   *   redessiner() (après un changement de réglage ou d'outil).
   * Renvoie {element, rafraichir(), clic(cle), places(), outil(), libre()}.
   */
  function creer(acces) {
    var R = AT.rendu, el = R.el;
    var outil = 'vert', libre = false;
    var zoneEtape = el('p', { classe: 'at-villes-etape', id: 'vi-etape' });
    var zoneOutils = el('div', { classe: 'at-villes-outils', id: 'vi-outils', role: 'group', 'aria-label': 'Ville à poser' });
    var zoneDiagnostic = el('p', { classe: 'at-avis', id: 'vi-diagnostic', hidden: true });
    var zoneMessage = el('p', { classe: 'at-pinceau-message', id: 'vi-message', 'aria-live': 'polite' });
    var caseLibre = el('input', { type: 'checkbox', id: 'vi-libre' });
    var choixProfondeur = el('select', { id: 'vi-profondeur' }, PROFONDEURS.map(function (p) {
      return el('option', { value: p, texte: p + (p > 1 ? ' rangées' : ' rangée') + (p === C.REGLAGES.villes.profondeurExtremite ? ' (défaut)' : '') });
    }));
    var btnAuto = el('button', { type: 'button', id: 'vi-auto', classe: 'at-principal-bouton', texte: 'Poser les villes automatiquement', title: 'Retire les villes posées, puis pose les 6 villes au meilleur équilibre', sur: { click: auto } });
    var btnAutre = el('button', { type: 'button', id: 'vi-autre', texte: 'Autre proposition', title: 'Change la place des villes de déploiement (placement suivant, du mieux équilibré au moins équilibré) ; les villes neutres suivent, à la meilleure place de chaque flanc. Même plateau = même suite.', sur: { click: autre } });
    var btnRetirer = el('button', { type: 'button', id: 'vi-retirer', texte: 'Retirer toutes les villes', sur: { click: toutRetirer } });

    function options() { return { profondeurExtremite: profondeur(acces.reglages(), acces.plateau()), libre: libre }; }

    function dire(texte, niveau) {
      zoneMessage.textContent = texte;
      zoneMessage.className = 'at-pinceau-message at-niveau-' + (niveau === 'erreur' ? 'erreur' : (niveau === 'alerte' ? 'alerte' : 'info'));
      acces.message(texte, niveau);
    }

    function choisir(nouvel) { outil = nouvel; acces.redessiner(); }

    function clic(cle) {
      var r = cliquer(acces.plateau(), outil, cle, options());
      if (!r.ok) { dire(r.message, r.niveau); return; }
      // L'outil passe de lui-même à la ville suivante quand le sien a tout posé.
      var suivant = r.action === 'pose' && compteurs(r.plateau)[outil].complet ? outilSuivant(r.plateau) : null;
      if (suivant) outil = suivant;
      acces.changer(r.plateau);
      dire(r.message + (compteurs(r.plateau).completes ? ' Toutes les villes sont posées.' : ''), r.niveau);
    }

    function auto() {
      var pl = acces.plateau(), o = options(), regl = acces.reglages();
      ['seuilContact', 'mesureContact'].forEach(function (k) { if (regl[k] !== undefined) o[k] = regl[k]; });
      var r = poserAuto(pl, pl.graine, o);
      if (!r.ok) { dire('Pose automatique impossible : ' + r.raison, 'erreur'); return; }
      acces.changer(r.plateau);
      dire('Villes posées automatiquement au meilleur équilibre (score ' + r.score + ' ; 0 = équilibré). Annuler pour revenir en arrière.', 'info');
    }

    function autre() {
      var pl = acces.plateau(), o = options(), regl = acces.reglages();
      ['seuilContact', 'mesureContact'].forEach(function (k) { if (regl[k] !== undefined) o[k] = regl[k]; });
      var r = autreProposition(pl, o);
      if (!r.ok) { dire('Autre proposition impossible : ' + r.raison, 'erreur'); return; }
      if (r.seule) { dire('Il n’existe qu’un seul placement des villes de déploiement sur ce terrain avec ces règles : rien ne change.', 'info'); return; }
      acces.changer(r.plateau);
      dire('Autre proposition : placement n° ' + r.rang + ' sur ' + r.nombre + ' des villes de déploiement, du mieux équilibré au moins équilibré (score ' + r.score + ' ; 0 = équilibré). Les villes neutres vont à la meilleure place de chaque flanc ; leurs autres places ne sont pas parcourues. Annuler pour revenir à la précédente.', 'info');
    }

    function toutRetirer() {
      var r = retirerToutes(acces.plateau());
      if (!r.nombre) { dire('Aucune ville à retirer.', 'info'); return; }
      outil = 'vert';
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
        ? 'Plateau de l’ancien catalogue : ses villes sont des tuiles d’une case, posées pendant la construction. L’étape « Villes » est faite pour le catalogue 2 ; vous pouvez tout de même essayer d’y poser des villes.'
        : etape === 'construction'
        ? 'Le terrain n’est pas fini (' + pluriel(c.construction, 'pièce', 'pièces') + ' de terrain à poser). Les villes se posent une fois la construction terminée ; vous pouvez déjà essayer.'
        : (catalogue.precedent ? 'Plateau du catalogue précédent : ' : '') + (etape === 'villes' ? (catalogue.precedent ? 'posez les villes.' : 'Construction terminée : posez les villes.')
          : (catalogue.precedent ? 'toutes les villes sont posées.' : 'Plateau complet : toutes les villes sont posées.'));
      R.remplacer(zoneOutils, OUTILS.map(function (o) {
        var type = o === 'neutre' ? 'vn' : 'vd-' + o;
        return el('button', {
          type: 'button', classe: 'at-villes-outil' + (c[o].complet ? ' at-villes-complet' : ''), id: 'vi-outil-' + o, 'aria-pressed': outil === o ? 'true' : 'false',
          title: NOMS_OUTILS[o] + (o === 'neutre' ? ' : une tuile ajoutée contre un flanc du plateau' : ' : une tuile posée par-dessus une Plaine du bord ' + (o === 'vert' ? 'haut' : 'bas')),
          sur: { click: function () { choisir(o); } }
        }, [R.pastilleTuile(type, 0.42), el('span', { texte: o === 'neutre' ? 'Ville neutre' : 'Déploiement de ' + NOMS_CAMPS[o] }),
          el('strong', { classe: 'at-villes-compteur', 'data-compteur': o, texte: c[o].posees + ' / ' + c[o].voulues })]);
      }));
      var d = diagnostic(pl, outil, options());
      zoneDiagnostic.hidden = !d || d.cause === 'complet';
      zoneDiagnostic.textContent = d && d.cause !== 'complet' ? d.message : '';
      zoneDiagnostic.setAttribute('data-cause', d ? d.cause : '');
      caseLibre.checked = libre;
      choixProfondeur.value = String(profondeur(acces.reglages(), pl));
      btnRetirer.disabled = !(c.vert.posees + c.rouge.posees + c.neutre.posees) && !P.deploiements(pl).length;
    }

    caseLibre.addEventListener('change', function () { libre = caseLibre.checked; acces.redessiner(); });
    choixProfondeur.addEventListener('change', function () {
      // Le réglage est enregistré DANS le plateau (une étape d'annulation) : il se retrouve à la réouverture.
      var valeur = parseInt(choixProfondeur.value, 10), pl = acces.plateau();
      if (valeur === profondeur(acces.reglages(), pl)) return;
      var r = P.avecProfondeurExtremite(pl, valeur);
      if (!r.ok) { acces.message(r.raison, 'erreur'); acces.redessiner(); return; }
      acces.changer(r.plateau);
      acces.message('Extrémités : ' + valeur + (valeur === 1 ? ' rangée' : ' rangées') + ' en haut et en bas. Les places et les contrôles suivent ce réglage, enregistré avec le plateau (Annuler pour revenir en arrière).', 'info');
    });

    var element = el('div', { classe: 'at-mode-panneau', id: 'vi-panneau' }, [
      el('fieldset', null, [
        el('legend', { texte: 'Étape « Villes »' }),
        zoneEtape,
        el('p', { classe: 'at-aide', texte: 'Choisissez une ville, puis cliquez une case en surbrillance pour la poser. Cliquez une ville posée pour la retirer. Tout s’annule (Ctrl+Z).' }),
        zoneOutils,
        zoneDiagnostic,
        zoneMessage,
        el('div', { classe: 'at-ligne' }, [btnAuto, btnAutre]),
        el('div', { classe: 'at-ligne' }, [btnRetirer])
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Réglages de l’étape' }),
        el('div', { classe: 'at-ligne' }, [el('label', { for: 'vi-profondeur', texte: 'Profondeur des extrémités' }), choixProfondeur]),
        el('p', { classe: 'at-aide', texte: 'Nombre de rangées du haut (Vert) et du bas (Rouge) où une ville de déploiement peut se poser. Ce réglage est enregistré avec le plateau : il se retrouve à la réouverture.' }),
        el('div', { classe: 'at-ligne' }, [caseLibre, el('label', { for: 'vi-libre', texte: 'Pose libre (essai hors règles)' })]),
        el('p', { classe: 'at-aide', texte: 'En pose libre, une ville se pose sur toute Plaine ou contre tout bord ; les contrôles signalent ce qui ne respecte pas les règles (extrémité, flanc, écart de 4 pas).' })
      ]),
      el('fieldset', null, [
        el('legend', { texte: 'Rappel des règles' }),
        el('p', { classe: 'at-aide', texte: 'Ville de déploiement : posée PAR-DESSUS une Plaine du bord, en haut pour Vert, en bas pour Rouge, hors noyau ; 2 par joueur. Ville neutre : une tuile ajoutée contre le flanc gauche et une contre le flanc droit, n’importe où sur le flanc, tenue par au moins 2 tuiles différentes. Entre deux villes : 4 pas au moins (3 cases entre elles).' })
      ])
    ]);

    return {
      element: element, rafraichir: rafraichir, clic: clic,
      places: function () { return places(acces.plateau(), outil, options()); },
      outil: function () { return outil; }, libre: function () { return libre; },
      /** À l'entrée dans le mode : l'outil est la première ville qui reste à poser (Vert, Rouge, puis neutre). */
      entrer: function () { outil = outilSuivant(acces.plateau()) || outil; },
      choisir: choisir, auto: auto, autre: autre, toutRetirer: toutRetirer
    };
  }

  AT.vueVilles.creer = creer;
})();
