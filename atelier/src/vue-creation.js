/*
 * vue-creation.js : création à la main dans l'onglet « Plateau » (lot E, cahier des charges §8.2).
 * Deux panneaux de la colonne de gauche, créés par vue-plateau.js :
 *   - création guidée : plateau vierge, palette de toutes les pièces (catalogue imprimé + pièces personnelles),
 *     tuiles d'événement à l'essai, et la liste « ce qu'il reste à faire » ;
 *   - pinceau libre : terrain ou gomme, un trait = une seule étape d'annulation.
 * Dépend de AT.hex, AT.catalogue, AT.plateau ; AT.rendu pour les panneaux.
 *
 * La logique est PURE et testée sous Node (essaiPose, palette, resteAFaire, trait de pinceau) ; les panneaux ne
 * font qu'afficher et transmettre. Aucun innerHTML, aucun attribut style (CSP stricte).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;

  /** Rayon de la grille vide affichée pendant la création (cahier des charges §8.2). */
  var RAYON_GRILLE = 7;
  var TERRAINS_PINCEAU = ['plaine', 'foret', 'marais', 'montagne', 'ville'];
  var NOMS_TERRAINS = { plaine: 'plaine', foret: 'forêt', marais: 'marais', montagne: 'montagne', ville: 'ville' };

  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }

  // ================================================================== logique pure

  /**
   * Essai de pose « à blanc » : la pièce du modèle `idModele` peut-elle être posée, ancre en (q, r) ?
   * `sauf` (facultatif) : identifiant d'une pièce déjà posée que l'on DÉPLACE (elle est d'abord retirée, et la
   * repose ne compte pas contre le stock : un déplacement ne change pas le nombre de pièces).
   * Renvoie {ok, cles (cases que la pièce couvrirait), raison, plateau (après la pose, camps non recalculés), id}.
   */
  function essaiPose(plateau, idModele, q, r, rotation, sauf) {
    var base = plateau, options;
    if (sauf !== undefined && sauf !== null) {
      var retrait = P.retirer(plateau, sauf);
      if (!retrait.ok) return { ok: false, cles: [], raison: retrait.raison, plateau: plateau, id: null };
      base = retrait.plateau;
      options = { horsStock: true };
    }
    var cles = P.casesModele(idModele, q, r, rotation || 0, plateau).map(function (c) { return c.cle; });
    var pose = P.poser(base, idModele, q, r, rotation || 0, options);
    return pose.ok
      ? { ok: true, cles: cles, raison: null, plateau: pose.plateau, id: pose.id }
      : { ok: false, cles: cles, raison: pose.raison, plateau: plateau, id: null };
  }

  /**
   * Palette de la création guidée : toutes les pièces du catalogue imprimé puis les pièces personnelles du
   * document (jamais les modèles hors catalogue, réservés au pinceau).
   * Renvoie [{id, nom, cases (nombre), total, poses, restant (jamais négatif), perso}].
   */
  function palette(plateau) {
    var stock = P.stock(plateau);
    return P.idsModeles(plateau).filter(function (id) {
      var m = P.modele(plateau, id);
      return !!m && !m.horsCatalogue;
    }).map(function (id) {
      var m = P.modele(plateau, id), s = stock[id];
      return { id: id, nom: m.nom, cases: m.cases.length, total: s.total, poses: s.poses, restant: Math.max(0, s.restant), perso: !!m.perso };
    });
  }

  /** Identifiants des pièces posées dont le modèle est inconnu du catalogue et du document. */
  function piecesInconnues(plateau) {
    return (plateau.pieces || []).filter(function (p) { return !P.modele(plateau, p.modele); }).map(function (p) { return p.id; });
  }

  /** Plateau sans ses pièces de modèle inconnu (elles n'ont aucune case : aucun clic ne peut les atteindre). */
  function sansPiecesInconnues(plateau) {
    var res = plateau;
    piecesInconnues(plateau).forEach(function (id) { res = P.retirer(res, id).plateau; });
    return res;
  }

  function compte(posees, voulues) {
    return { posees: posees, voulues: voulues, manquantes: Math.max(0, voulues - posees), enTrop: Math.max(0, posees - voulues) };
  }

  /**
   * « Ce qu'il reste à faire » sur un plateau en cours de création.
   * `bilan` (facultatif) : résultat de AT.controles.tout, pour la liste des erreurs en cours.
   * Renvoie {pieces: [{id, nom, restant}], nbPieces, persos: [...], nbPersos,
   *          villes, haut, bas : {posees, voulues, manquantes, enTrop} (haut = Vert, bas = Rouge),
   *          erreurs: [messages], inconnues: nombre de pièces de modèle inconnu, termine}.
   */
  function resteAFaire(plateau, bilan) {
    var R = C.REGLAGES, res = { pieces: [], nbPieces: 0, persos: [], nbPersos: 0 };
    palette(plateau).forEach(function (x) {
      if (x.restant <= 0) return;
      (x.perso ? res.persos : res.pieces).push({ id: x.id, nom: x.nom, restant: x.restant });
      if (x.perso) res.nbPersos += x.restant; else res.nbPieces += x.restant;
    });
    var toutes = P.cases(plateau, { sansRecouvrements: true });
    var nbVilles = Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }).length;
    var rangees = P.villesRangeesExtremes(plateau);
    res.villes = compte(nbVilles, R.nombreVilles);
    res.haut = compte(rangees.vert.length, R.villesParCamp);
    res.bas = compte(rangees.rouge.length, R.villesParCamp);
    res.erreurs = bilan && Array.isArray(bilan.resultats)
      ? bilan.resultats.filter(function (x) { return x.niveau === 'erreur'; }).map(function (x) { return x.message; })
      : [];
    res.inconnues = piecesInconnues(plateau).length;
    res.termine = !res.nbPieces && !res.nbPersos && !res.villes.manquantes && !res.villes.enTrop && !res.haut.manquantes && !res.haut.enTrop
      && !res.bas.manquantes && !res.bas.enTrop && !res.erreurs.length && !res.inconnues;
    return res;
  }

  // ------------------------------------------------------------------ trait de pinceau

  /** Outil valide : {type: 'terrain', terrain} (plaine, forêt, marais, montagne, ville) ou {type: 'gomme'}. */
  function outilValide(outil) {
    return !!outil && (outil.type === 'gomme' || (outil.type === 'terrain' && TERRAINS_PINCEAU.indexOf(outil.terrain) !== -1));
  }

  /**
   * Commence un trait de pinceau sur `plateau`. Le trait est un accumulateur : `plateau` y avance case après case,
   * SANS recalcul des camps ni des contrôles ; l'interface n'en fait qu'UNE étape d'annulation à la fin.
   */
  function nouveauTrait(plateau, outil) {
    return {
      depart: plateau, plateau: plateau, outil: outil, vues: Object.create(null),
      cases: 0,              // cases visitées
      changees: 0,           // cases réellement peintes ou gommées
      horsStock: 0,          // tuiles posées au-delà du stock
      evenements: 0,         // tuiles d'événement renvoyées en réserve
      refusNoyau: 0, refusMonobloc: 0, vides: 0, autres: 0,
      monobloc: null,        // premier monobloc (ou noyau) rencontré : {piece, nom, noyau, cases, raison}
      nomMonobloc: null,     // nom du premier monobloc rencontré, noyau exclu (pour le message)
      raison: null           // première raison de refus
    };
  }

  /**
   * Étend le trait à la case `cle` (une case déjà visitée pendant ce trait est ignorée).
   * Renvoie vrai si le plateau du trait a changé (il faut alors redessiner).
   */
  function etendreTrait(trait, cle) {
    if (!outilValide(trait.outil) || typeof cle !== 'string' || trait.vues[cle] === true) return false;
    trait.vues[cle] = true;
    trait.cases += 1;
    var r = trait.outil.type === 'gomme' ? P.gommer(trait.plateau, cle) : P.peindre(trait.plateau, cle, trait.outil.terrain);
    if (!r.ok) {
      if (r.vide) trait.vides += 1;
      else if (r.monobloc) {
        if (r.noyau) trait.refusNoyau += 1; else trait.refusMonobloc += 1;
        var m = P.modele(trait.plateau, r.modele || (P.cases(trait.plateau, { sansRecouvrements: true })[cle] || {}).modele);
        if (!trait.monobloc) trait.monobloc = { piece: r.piece, noyau: !!r.noyau, nom: m ? m.nom : 'monobloc', cases: r.cases || [cle], raison: r.raison };
        if (!r.noyau && !trait.nomMonobloc && m) trait.nomMonobloc = m.nom;
      } else trait.autres += 1;
      if (!trait.raison) trait.raison = r.raison;
      return false;
    }
    if (r.inchange) return false;
    trait.plateau = r.plateau;
    trait.changees += 1;
    if (r.horsStock) trait.horsStock += 1;
    trait.evenements += (r.evenementsRetires || []).length;
    return true;
  }

  /** Trait entier sur une liste de cases (tests, clavier). Renvoie le trait terminé. */
  function tracer(plateau, outil, cles) {
    var trait = nouveauTrait(plateau, outil);
    (cles || []).forEach(function (k) { etendreTrait(trait, k); });
    return trait;
  }

  /**
   * Compte rendu d'un trait terminé : {change, plateau (camps recalculés si le trait a changé quelque chose),
   * message, niveau ('info' | 'alerte' | 'erreur'), confirmer (monobloc à retirer après confirmation, ou null)}.
   * `confirmer` n'est proposé que pour la gomme, sur un trait d'UNE case tombé sur un monobloc ou le noyau.
   */
  function bilanTrait(trait) {
    var gomme = trait.outil.type === 'gomme', morceaux = [], niveau = 'info', confirmer = null;
    if (trait.changees) {
      morceaux.push(gomme
        ? pluriel(trait.changees, 'tuile gommée', 'tuiles gommées') + '.'
        : pluriel(trait.changees, 'case peinte', 'cases peintes') + ' en ' + NOMS_TERRAINS[trait.outil.terrain] + '.');
    }
    if (trait.horsStock) {
      morceaux.push(pluriel(trait.horsStock, 'tuile posée', 'tuiles posées') + ' hors stock : à prévoir en plus du catalogue.');
      niveau = 'alerte';
    }
    if (trait.evenements) {
      morceaux.push(pluriel(trait.evenements, 'tuile d’événement retourne', 'tuiles d’événement retournent') + ' en réserve.');
      niveau = 'alerte';
    }
    var refus = trait.refusNoyau + trait.refusMonobloc;
    if (refus) {
      if (gomme && trait.cases === 1 && trait.monobloc) {
        confirmer = trait.monobloc;
        morceaux.push(trait.monobloc.noyau ? 'Cette case appartient au noyau : confirmez pour le retirer en entier.'
          : 'Cette case appartient au monobloc « ' + trait.monobloc.nom + ' » : confirmez pour le retirer en entier.');
        niveau = 'alerte';
      } else if (gomme) {
        morceaux.push(pluriel(refus, 'case laissée', 'cases laissées') + ' : la gomme ne retire un monobloc (ou le noyau) qu’après confirmation ; cliquez-le seul.');
        niveau = trait.changees ? 'alerte' : 'erreur';
      } else {
        var quoi = [];
        if (trait.refusNoyau) quoi.push('le noyau');
        if (trait.refusMonobloc) quoi.push(trait.nomMonobloc ? 'le monobloc « ' + trait.nomMonobloc + ' »' : 'un monobloc');
        morceaux.push('Le pinceau ne modifie pas ' + quoi.join(' ni ') + ' (' + pluriel(refus, 'case laissée', 'cases laissées')
          + '). Pour le remplacer, retirez-le d’abord (gomme, avec confirmation).');
        niveau = trait.changees ? 'alerte' : 'erreur';
      }
    }
    if (trait.autres) { morceaux.push(trait.raison || 'Case refusée.'); niveau = trait.changees ? 'alerte' : 'erreur'; }
    if (!morceaux.length) {
      morceaux.push(gomme ? 'Case vide : rien à gommer.' : (trait.cases ? 'Rien à changer : ' + (trait.cases > 1 ? 'ces cases ont' : 'cette case a') + ' déjà ce terrain.' : 'Rien n’a été peint.'));
    }
    return {
      change: trait.changees > 0,
      plateau: trait.changees > 0 ? P.avecCamps(trait.plateau) : trait.depart,
      message: morceaux.join(' '), niveau: niveau, confirmer: confirmer
    };
  }

  AT.vueCreation = {
    RAYON_GRILLE: RAYON_GRILLE, TERRAINS_PINCEAU: TERRAINS_PINCEAU,
    essaiPose: essaiPose, palette: palette, piecesInconnues: piecesInconnues, sansPiecesInconnues: sansPiecesInconnues,
    resteAFaire: resteAFaire,
    outilValide: outilValide, nouveauTrait: nouveauTrait, etendreTrait: etendreTrait, tracer: tracer, bilanTrait: bilanTrait
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.vueCreation;
  if (typeof document === 'undefined') return;

  // ================================================================== panneau « Créer à la main »

  /**
   * Panneau de la création guidée. `acces` (fourni par vue-plateau.js) : plateau(), bilan(), etat() → {aPoser},
   * choisirModele(id), choisirEvenement(id), glisserModele(id, x, y), deposerModele(id, x, y), annulerGlisse(),
   * nouveauVierge(), vider(), retirerInconnues().
   * Renvoie {element (palette), reste (liste « ce qu'il reste à faire », pour la colonne de droite), rafraichir()}.
   */
  function creerGuide(acces) {
    var R = AT.rendu, el = R.el;
    var zoneStock = el('div', { classe: 'at-stock', id: 'pl-stock' });
    var zoneReste = el('section', { classe: 'at-reste', id: 'cr-reste', 'aria-label': 'Ce qu’il reste à faire' });
    var glisse = null, avalerClic = false;

    function bouton(texte, action, id, titre) {
      return el('button', { type: 'button', texte: texte, id: id, title: titre, sur: { click: action } });
    }

    // Glisser-déposer depuis la palette : événements pointeur suivis sur le document (le bouton peut être redessiné).
    function surMouvement(ev) {
      if (!glisse) return;
      if (!glisse.actif && Math.abs(ev.clientX - glisse.x) + Math.abs(ev.clientY - glisse.y) < 6) return;
      glisse.actif = true;
      acces.glisserModele(glisse.id, ev.clientX, ev.clientY);
    }
    function finGlisse(ev) {
      document.removeEventListener('pointermove', surMouvement);
      document.removeEventListener('pointerup', finGlisse);
      document.removeEventListener('pointercancel', abandon);
      var g = glisse;
      glisse = null;
      if (!g || !g.actif) return;                 // simple clic : le bouton s'en charge
      avalerClic = true;                          // le clic qui suit le relâchement appartient au glisser
      setTimeout(function () { avalerClic = false; }, 0);
      acces.deposerModele(g.id, ev.clientX, ev.clientY);
    }
    function abandon() {
      document.removeEventListener('pointermove', surMouvement);
      document.removeEventListener('pointerup', finGlisse);
      document.removeEventListener('pointercancel', abandon);
      var actif = glisse && glisse.actif;
      glisse = null;
      if (actif) acces.annulerGlisse();
    }
    function debutGlisse(id, ev) {
      if (ev.button !== 0) return;
      glisse = { id: id, x: ev.clientX, y: ev.clientY, actif: false };
      document.addEventListener('pointermove', surMouvement);
      document.addEventListener('pointerup', finGlisse);
      document.addEventListener('pointercancel', abandon);
    }

    function boutonPiece(x, plateau, aPoser) {
      var choisi = !!(aPoser && aPoser.type === 'piece' && aPoser.modele === x.id), epuise = x.restant <= 0;
      var b = el('button', {
        type: 'button', classe: 'at-piece-stock' + (x.perso ? ' at-piece-perso' : '') + (epuise ? ' at-piece-epuisee' : ''),
        'data-modele': x.id, 'aria-pressed': choisi ? 'true' : 'false', disabled: epuise,
        title: epuise ? x.nom + ' : plus aucune pièce en stock' : 'Poser : ' + x.nom + ' (cliquez puis cliquez une case, ou glissez sur le plateau)',
        sur: {
          click: function () { if (avalerClic) { avalerClic = false; return; } acces.choisirModele(x.id); },
          pointerdown: function (ev) { debutGlisse(x.id, ev); }
        }
      }, [R.dessinModele(x.id, { echelle: 0.24, titre: x.nom, plateau: plateau })]);
      // Le nom d'une pièce personnelle vient d'un fichier : textContent seulement.
      b.appendChild(el('span', { classe: 'at-piece-nom', texte: x.nom + ' × ' + x.restant }));
      return b;
    }

    function rafraichirPalette() {
      var pl = acces.plateau(), aPoser = acces.etat().aPoser, liste = palette(pl);
      var base = liste.filter(function (x) { return !x.perso; }), persos = liste.filter(function (x) { return x.perso; });
      var poses = {};
      pl.recouvrements.forEach(function (x) { poses[x.evenement] = true; });
      var evenements = C.ORDRE_EVENEMENTS.filter(function (id) { return !poses[id]; }).map(function (id) {
        var choisi = !!(aPoser && aPoser.type === 'evenement' && aPoser.id === id);
        return el('button', {
          type: 'button', classe: 'at-piece-stock', 'data-evenement': id, 'aria-pressed': choisi ? 'true' : 'false',
          title: 'Essayer la tuile d’événement : ' + C.EVENEMENTS[id].nom, sur: { click: function () { acces.choisirEvenement(id); } }
        }, [R.pastilleTerrain(C.EVENEMENTS[id].terrain, true), el('span', { texte: id + ' ' + C.EVENEMENTS[id].nom })]);
      });
      var contenu = [
        el('h3', { texte: 'Pièces du catalogue (stock restant)' }),
        el('div', { classe: 'at-grille-stock' }, base.map(function (x) { return boutonPiece(x, pl, aPoser); }))
      ];
      if (!base.some(function (x) { return x.restant > 0; })) contenu.push(el('p', { classe: 'at-aide', texte: 'Toutes les pièces du catalogue sont posées.' }));
      contenu.push(el('h3', { texte: 'Mes monoblocs' }));
      contenu.push(persos.length
        ? el('div', { classe: 'at-grille-stock', id: 'cr-persos' }, persos.map(function (x) { return boutonPiece(x, pl, aPoser); }))
        : el('p', { classe: 'at-aide', texte: 'Aucune pièce personnelle : créez-en dans le mode « Mes monoblocs ».' }));
      contenu.push(el('h3', { texte: 'Tuiles d’événement (essai de pose)' }));
      contenu.push(evenements.length ? el('div', { classe: 'at-grille-stock' }, evenements) : el('p', { classe: 'at-aide', texte: 'Les 8 tuiles sont posées.' }));
      R.remplacer(zoneStock, contenu);
    }

    function ligneReste(nom, fait, texte, detail) {
      var li = el('li', { classe: fait ? 'at-reste-fait' : 'at-reste-a-faire', 'data-reste': nom }, [
        el('span', { classe: 'at-reste-marque', 'aria-hidden': 'true', texte: fait ? '✓' : '•' }),
        el('span', { texte: ' ' + texte })
      ]);
      if (detail) li.appendChild(el('div', { classe: 'at-reste-detail', texte: detail }));
      return li;
    }

    function phraseCompte(c, nom) {
      if (c.manquantes) return nom + ' : ' + c.posees + ' / ' + c.voulues + ' — il en manque ' + c.manquantes;
      if (c.enTrop) return nom + ' : ' + c.posees + ' / ' + c.voulues + ' — ' + c.enTrop + ' en trop';
      return nom + ' : ' + c.posees + ' / ' + c.voulues;
    }

    function rafraichirReste() {
      var r = resteAFaire(acces.plateau(), acces.bilan());
      var detailler = function (liste) { return liste.map(function (x) { return x.restant + ' × ' + x.nom; }).join(', '); };
      var lignes = [
        ligneReste('pieces', !r.nbPieces, r.nbPieces ? 'Pièces du catalogue à poser : ' + r.nbPieces : 'Toutes les pièces du catalogue sont posées', r.nbPieces ? detailler(r.pieces) : null)
      ];
      if (r.nbPersos) lignes.push(ligneReste('persos', false, 'Monoblocs personnels à poser : ' + r.nbPersos, detailler(r.persos)));
      lignes.push(ligneReste('villes', !r.villes.manquantes && !r.villes.enTrop, phraseCompte(r.villes, 'Villes')));
      lignes.push(ligneReste('haut', !r.haut.manquantes && !r.haut.enTrop, phraseCompte(r.haut, 'Villes de déploiement en haut (Vert)')));
      lignes.push(ligneReste('bas', !r.bas.manquantes && !r.bas.enTrop, phraseCompte(r.bas, 'Villes de déploiement en bas (Rouge)')));
      lignes.push(ligneReste('erreurs', !r.erreurs.length, r.erreurs.length ? 'Erreurs en cours : ' + r.erreurs.length : 'Aucune erreur aux contrôles',
        r.erreurs.length ? r.erreurs.slice(0, 4).join(' ') + (r.erreurs.length > 4 ? ' …' : '') : null));
      var contenu = [
        el('h2', { texte: 'Ce qu’il reste à faire' }),
        el('ul', { classe: 'at-reste-liste' }, lignes)
      ];
      if (r.inconnues) {
        contenu.push(el('p', { classe: 'at-avis', id: 'cr-inconnues' }, [
          pluriel(r.inconnues, 'pièce', 'pièces') + ' d’un modèle inconnu : elles n’occupent aucune case. ',
          bouton('Les retirer', acces.retirerInconnues, 'cr-retirer-inconnues')
        ]));
      }
      if (r.termine) contenu.push(el('p', { classe: 'at-niveau-info at-reste-termine', id: 'cr-termine', texte: 'Plateau terminé : tout est posé, aucune erreur.' }));
      R.remplacer(zoneReste, contenu);
    }

    var element = el('div', { classe: 'at-mode-panneau', id: 'cr-panneau' }, [
      el('fieldset', null, [
        el('legend', { texte: 'Créer à la main' }),
        el('div', { classe: 'at-ligne' }, [
          bouton('Nouveau plateau vierge', acces.nouveauVierge, 'cr-vierge', 'Repartir du seul noyau, posé au centre (Annuler pour revenir en arrière)'),
          bouton('Vider le plateau', acces.vider, 'pl-vider', 'Tout remettre au stock, noyau compris')
        ]),
        el('p', { classe: 'at-aide', texte: 'Cliquez une pièce puis une case, ou glissez la pièce sur le plateau : l’aperçu est vert si la pose est possible, rouge sinon. R tourne la pièce. Une pièce posée se déplace en la glissant ; Maj + glisser déplace la vue.' }),
        zoneStock
      ])
    ]);

    return {
      element: element, reste: zoneReste,
      rafraichir: function () { rafraichirPalette(); rafraichirReste(); }
    };
  }

  // ================================================================== panneau « Pinceau »

  /**
   * Panneau du pinceau libre. `acces` : plateau(), changer(plateau), apercu(plateau), message(texte, niveau),
   * confirmer(texte, libelle, rappel). Renvoie {element, rafraichir(), geste(cle), clic(cle), outil()}.
   */
  function creerPinceau(acces) {
    var R = AT.rendu, el = R.el;
    var outil = { type: 'terrain', terrain: 'plaine' };
    var zoneOutils = el('div', { classe: 'at-pinceau-outils', id: 'pi-outils', role: 'group', 'aria-label': 'Outil du pinceau' });
    var zoneMessage = el('p', { classe: 'at-pinceau-message', id: 'pi-message', 'aria-live': 'polite' });

    function dire(texte, niveau) {
      zoneMessage.textContent = texte;
      zoneMessage.className = 'at-pinceau-message at-niveau-' + (niveau === 'erreur' ? 'erreur' : (niveau === 'alerte' ? 'alerte' : 'info'));
      acces.message(texte, niveau);
    }

    function choisir(nouvel) { outil = nouvel; rafraichir(); }

    function rafraichir() {
      var boutons = TERRAINS_PINCEAU.map(function (t) {
        var choisi = outil.type === 'terrain' && outil.terrain === t;
        return el('button', {
          type: 'button', classe: 'at-pinceau-outil', id: 'pi-terrain-' + t, 'aria-pressed': choisi ? 'true' : 'false',
          sur: { click: function () { choisir({ type: 'terrain', terrain: t }); } }
        }, [R.pastilleTerrain(t), el('span', { texte: R.nomTerrain(t) })]);
      });
      boutons.push(el('button', {
        type: 'button', classe: 'at-pinceau-outil at-pinceau-gomme', id: 'pi-gomme', 'aria-pressed': outil.type === 'gomme' ? 'true' : 'false',
        sur: { click: function () { choisir({ type: 'gomme' }); } }
      }, [el('span', { classe: 'at-gomme-dessin', 'aria-hidden': 'true', texte: '✕' }), el('span', { texte: 'Gomme' })]));
      R.remplacer(zoneOutils, boutons);
    }

    /** Fin d'un trait : une seule étape d'annulation, un seul recalcul des contrôles, un message. */
    function terminer(trait) {
      var b = bilanTrait(trait);
      if (b.change) acces.changer(b.plateau); else acces.apercu(null);
      dire(b.message, b.niveau);
      if (b.confirmer) {
        var cible = b.confirmer;
        acces.confirmer((cible.noyau ? 'Retirer le noyau en entier (' : 'Retirer le monobloc « ' + cible.nom + ' » en entier (') + cible.cases.length + ' cases) ?',
          'Retirer', function () {
            var r = P.retirer(acces.plateau(), cible.piece);
            if (!r.ok) { dire(r.raison, 'erreur'); return; }
            acces.changer(r.plateau);
            dire((cible.noyau ? 'Noyau retiré' : 'Monobloc « ' + cible.nom + ' » retiré') + ' : il retourne au stock.'
              + (r.evenementsRetires.length ? ' ' + pluriel(r.evenementsRetires.length, 'tuile d’événement retourne', 'tuiles d’événement retournent') + ' en réserve.' : ''), 'info');
          });
      }
    }

    /** Geste confié à la vue du plateau : peint dès l'appui, puis à chaque nouvelle case survolée. */
    function geste(cle) {
      var trait = nouveauTrait(acces.plateau(), outil);
      if (etendreTrait(trait, cle)) acces.apercu(trait.plateau);
      return {
        bouger: function (k) { if (etendreTrait(trait, k)) acces.apercu(trait.plateau); },
        finir: function () { terminer(trait); },
        annuler: function () { acces.apercu(null); dire('Trait abandonné : rien n’a changé.', 'info'); }
      };
    }

    /** Clic simple ou touche Entrée sur une case : un trait d'une case. */
    function clic(cle) { terminer(tracer(acces.plateau(), outil, [cle])); }

    var element = el('div', { classe: 'at-mode-panneau', id: 'pi-panneau' }, [
      el('fieldset', null, [
        el('legend', { texte: 'Pinceau libre' }),
        el('p', { classe: 'at-aide', texte: 'Choisissez un terrain ou la gomme, puis cliquez ou glissez sur les cases, y compris les cases vides de la grille. Un trait s’annule en une fois (Ctrl+Z).' }),
        zoneOutils,
        zoneMessage,
        el('p', { classe: 'at-aide', texte: 'Le pinceau pose des tuiles d’une case : celles du stock d’abord, puis « hors stock » (annoncé, à prévoir en plus du catalogue). Il ne touche ni aux monoblocs ni au noyau ; la gomme ne les retire qu’après confirmation. Maj + glisser déplace la vue.' })
      ])
    ]);
    rafraichir();

    return { element: element, rafraichir: rafraichir, geste: geste, clic: clic, outil: function () { return outil; } };
  }

  AT.vueCreation.creerGuide = creerGuide;
  AT.vueCreation.creerPinceau = creerPinceau;
})();
