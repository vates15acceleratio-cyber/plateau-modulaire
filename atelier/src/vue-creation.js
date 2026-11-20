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
  // Les villes ne se peignent plus (§9.4) : elles se posent à l'étape « Villes ».
  var TERRAINS_PINCEAU = ['plaine', 'foret', 'marais', 'montagne'];
  var NOMS_TERRAINS = { plaine: 'plaine', foret: 'forêt', marais: 'marais', montagne: 'montagne' };

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
   * Renvoie [{id, nom, cases (nombre), total, poses, restant (jamais négatif), perso, role, facultatif}] ;
   * role : 'noyau' | 'montagne' | 'terrain' | 'remplissage' | 'ville' (ville neutre) | 'perso'.
   */
  function palette(plateau) {
    var stock = P.stock(plateau);
    return P.idsModeles(plateau).filter(function (id) {
      var m = P.modele(plateau, id);
      return !!m && !m.horsCatalogue;
    }).map(function (id) {
      var m = P.modele(plateau, id), s = stock[id];
      return { id: id, nom: m.nom, cases: m.cases.length, total: s.total, poses: s.poses, restant: Math.max(0, s.restant), perso: !!m.perso,
        role: m.perso ? 'perso' : (m.role || 'terrain'), facultatif: !!m.facultatif };
    });
  }

  /**
   * Phrase qui annonce qu'une retouche du TERRAIN a enlevé des villes de déploiement (la Plaine qui les portait a
   * été retirée, tournée, déplacée, repeinte ou gommée) ; chaîne vide si aucune n'a disparu. `avant` et `apres` :
   * le plateau avant et après la retouche.
   */
  function mentionVilles(avant, apres) {
    var restent = Object.create(null), perdues = [];
    P.deploiements(apres).forEach(function (x) { restent[x.cle] = true; });
    P.deploiements(avant).forEach(function (x) { if (restent[x.cle] !== true) perdues.push(x); });
    if (!perdues.length) return '';
    var noms = { vert: 'Vert', rouge: 'Rouge' };
    return ' ' + (perdues.length > 1 ? perdues.length + ' villes de déploiement ont été retirées' : 'La ville de déploiement de ' + noms[perdues[0].camp] + ' a été retirée')
      + ' avec la Plaine qui ' + (perdues.length > 1 ? 'les' : 'la') + ' portait : à reposer à l’étape « Villes ».';
  }

  /**
   * Vrai pour un plateau fait avec le PREMIER catalogue : il porte au moins une tuile de ville d'une case (modèle V).
   * Une plaine, une forêt ou un marais d'une case ne suffisent pas : le pinceau en pose aussi sur un plateau du
   * catalogue 2. Sur un ancien plateau, les étapes du catalogue 2 (construction, puis villes) ne s'appliquent pas.
   */
  function estAncien(plateau) { return !!plateau && P.catalogueDuPlateau(plateau).premier; }

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
   * Renvoie {pieces: [{id, nom, restant}], nbPieces (pièces de TERRAIN à poser : noyau, montagnes, monoblocs),
   *          facultatives: [{id, nom, restant}] (tuiles de remplissage en stock), persos: [...], nbPersos,
   *          villes, haut, bas, neutres : {posees, voulues, manquantes, enTrop} (haut = villes de déploiement de Vert,
   *          bas = celles de Rouge, neutres = villes neutres), etape ('construction' | 'villes' | 'complet'),
   *          erreurs: [messages], inconnues: nombre de pièces de modèle inconnu, termine}.
   * Sur un plateau de l'ancien catalogue (villes d'une case), haut et bas comptent les villes des rangées extrêmes.
   */
  function resteAFaire(plateau, bilan) {
    var R = C.REGLAGES, res = { pieces: [], nbPieces: 0, facultatives: [], persos: [], nbPersos: 0 };
    palette(plateau).forEach(function (x) {
      if (x.restant <= 0 || x.role === 'ville') return;              // les villes neutres sont comptées plus bas
      if (x.facultatif) { res.facultatives.push({ id: x.id, nom: x.nom, restant: x.restant }); return; }
      (x.perso ? res.persos : res.pieces).push({ id: x.id, nom: x.nom, restant: x.restant });
      if (x.perso) res.nbPersos += x.restant; else res.nbPieces += x.restant;
    });
    var toutes = P.cases(plateau, { sansRecouvrements: true });
    var nbVilles = Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }).length;
    var etat = P.etatVilles(plateau), rangees = P.villesRangeesExtremes(plateau), cat = P.catalogueDuPlateau(plateau);
    // Plateau du premier catalogue sans ville du catalogue 2 : ses villes de déploiement sont celles des rangées extrêmes.
    var ancien = cat.premier && !etat.vert.length && !etat.rouge.length && !etat.neutres.length;
    res.catalogue = cat.nom;
    // Plateau d'un catalogue antérieur : aucune pièce du catalogue courant n'est « à poser » sur lui.
    if (!cat.courant) { res.pieces = []; res.nbPieces = 0; res.facultatives = []; }
    var neutre = C.modele('VN');
    res.villes = compte(nbVilles, R.nombreVilles);
    res.haut = compte(ancien ? rangees.vert.length : etat.vert.length, R.villesParCamp);
    res.bas = compte(ancien ? rangees.rouge.length : etat.rouge.length, R.villesParCamp);
    res.neutres = compte(etat.neutres.length, ancien || !neutre ? 0 : neutre.nombre);
    res.etape = res.nbPieces ? 'construction' : (res.haut.manquantes || res.bas.manquantes || res.neutres.manquantes ? 'villes' : 'complet');
    res.erreurs = bilan && Array.isArray(bilan.resultats)
      ? bilan.resultats.filter(function (x) { return x.niveau === 'erreur'; }).map(function (x) { return x.message; })
      : [];
    res.inconnues = piecesInconnues(plateau).length;
    res.termine = !res.nbPieces && !res.nbPersos && !res.villes.manquantes && !res.villes.enTrop && !res.haut.manquantes && !res.haut.enTrop
      && !res.bas.manquantes && !res.bas.enTrop && !res.neutres.manquantes && !res.neutres.enTrop && !res.erreurs.length && !res.inconnues;
    return res;
  }

  // ------------------------------------------------------------------ trait de pinceau

  /** Outil valide : {type: 'terrain', terrain} (plaine, forêt, marais, montagne) ou {type: 'gomme'}. */
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
   * `confirmer` n'est proposé que pour la gomme, sur un trait d'UNE case tombé sur un monobloc. Le NOYAU est fixe
   * (règle de l'utilisateur) : la gomme ne le retire jamais, seuls « Vider le plateau » et un nouveau plateau le font.
   */
  function bilanTrait(trait) {
    var gomme = trait.outil.type === 'gomme', morceaux = [], niveau = 'info', confirmer = null;
    if (trait.changees) {
      morceaux.push(gomme
        ? pluriel(trait.changees, 'tuile gommée', 'tuiles gommées') + '.'
        : pluriel(trait.changees, 'case peinte', 'cases peintes') + ' en ' + NOMS_TERRAINS[trait.outil.terrain] + '.');
    }
    if (trait.horsStock) {
      morceaux.push(pluriel(trait.horsStock, 'tuile posée', 'tuiles posées') + ' hors stock : à prévoir en plus du catalogue. Hors règles (le terrain se construit en monoblocs de 3 ou 4 cases) : signalé par les contrôles.');
      niveau = 'alerte';
    }
    if (trait.evenements) {
      morceaux.push(pluriel(trait.evenements, 'tuile d’événement retourne', 'tuiles d’événement retournent') + ' en réserve.');
      niveau = 'alerte';
    }
    var refus = trait.refusNoyau + trait.refusMonobloc;
    if (refus) {
      if (gomme && trait.cases === 1 && trait.monobloc && !trait.monobloc.noyau) {
        confirmer = trait.monobloc;
        morceaux.push('Cette case appartient au monobloc « ' + trait.monobloc.nom + ' » : confirmez pour le retirer en entier.');
        niveau = 'alerte';
      } else if (gomme) {
        if (trait.refusNoyau) {
          morceaux.push('Le noyau est fixe : la gomme ne le retire jamais (' + pluriel(trait.refusNoyau, 'case laissée', 'cases laissées')
            + '). Seuls « Vider le plateau » et « Nouveau plateau vierge » le font.');
        }
        if (trait.refusMonobloc) {
          morceaux.push(pluriel(trait.refusMonobloc, 'case de monobloc laissée', 'cases de monobloc laissées') + ' : la gomme ne retire un monobloc qu’après confirmation ; cliquez-le seul.');
        }
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
    // Une ville de déploiement dont la Plaine a été repeinte ou gommée part avec elle : on le dit.
    var villesPerdues = mentionVilles(trait.depart, trait.plateau);
    if (villesPerdues) { morceaux.push(villesPerdues.trim()); if (niveau === 'info') niveau = 'alerte'; }
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
    essaiPose: essaiPose, palette: palette, piecesInconnues: piecesInconnues, sansPiecesInconnues: sansPiecesInconnues, mentionVilles: mentionVilles, estAncien: estAncien,
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
      if (x.facultatif) b.appendChild(el('span', { classe: 'at-piece-facultatif', texte: 'facultatif' }));
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
      // Catalogue 2 : noyau et montagnes, monoblocs de 4 cases, de 3 cases, puis les tuiles de remplissage (facultatives).
      // Les villes neutres ne sont pas dans la palette : elles se posent à l'étape « Villes ».
      var groupes = [
        { id: 'socle', titre: 'Noyau et montagnes', pieces: base.filter(function (x) { return x.role === 'noyau' || x.role === 'montagne'; }) },
        { id: 'quatre', titre: 'Monoblocs de 4 cases', pieces: base.filter(function (x) { return x.role === 'terrain' && x.cases === 4; }) },
        { id: 'trois', titre: 'Monoblocs de 3 cases', pieces: base.filter(function (x) { return x.role === 'terrain' && x.cases !== 4; }) },
        { id: 'remplissage', titre: 'Tuiles de remplissage (facultatif)', pieces: base.filter(function (x) { return x.role === 'remplissage'; }) }
      ];
      var contenu = [];
      groupes.forEach(function (g) {
        if (!g.pieces.length) return;
        var restant = 0;
        g.pieces.forEach(function (x) { restant += x.restant; });
        contenu.push(el('h3', { 'data-groupe': g.id, texte: g.titre + ' (' + restant + ' en stock)' }));
        contenu.push(el('div', { classe: 'at-grille-stock', 'data-groupe': g.id }, g.pieces.map(function (x) { return boutonPiece(x, pl, aPoser); })));
      });
      contenu.push(el('p', { classe: 'at-aide', id: 'cr-note-villes', texte: 'Les villes ne sont pas dans la palette : elles se posent à l’étape « Villes », une fois le terrain construit.' }));
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
      // Deux étapes (§9.1) : 1. construction du terrain ; 2. villes, une fois le terrain construit.
      var construction = [
        ligneReste('pieces', !r.nbPieces, r.nbPieces ? 'Pièces de terrain à poser : ' + r.nbPieces : 'Terrain construit : toutes les pièces de terrain sont posées', r.nbPieces ? detailler(r.pieces) : null)
      ];
      if (r.facultatives.length) construction.push(ligneReste('facultatives', true, 'Tuiles de remplissage en réserve (facultatives) : ' + detailler(r.facultatives)));
      if (r.nbPersos) construction.push(ligneReste('persos', false, 'Monoblocs personnels à poser : ' + r.nbPersos, detailler(r.persos)));
      var villes = [
        ligneReste('villes', !r.villes.manquantes && !r.villes.enTrop, phraseCompte(r.villes, 'Villes')),
        ligneReste('haut', !r.haut.manquantes && !r.haut.enTrop, phraseCompte(r.haut, 'Villes de déploiement en haut (Vert)')),
        ligneReste('bas', !r.bas.manquantes && !r.bas.enTrop, phraseCompte(r.bas, 'Villes de déploiement en bas (Rouge)'))
      ];
      if (r.neutres.voulues || r.neutres.posees) villes.push(ligneReste('neutres', !r.neutres.manquantes && !r.neutres.enTrop, phraseCompte(r.neutres, 'Villes neutres (une par flanc)')));
      var erreurs = [ligneReste('erreurs', !r.erreurs.length, r.erreurs.length ? 'Erreurs en cours : ' + r.erreurs.length : 'Aucune erreur aux contrôles',
        r.erreurs.length ? r.erreurs.slice(0, 4).join(' ') + (r.erreurs.length > 4 ? ' …' : '') : null)];
      var titreEtape = function (numero, nom, etat) {
        return el('h3', { classe: 'at-reste-etape', 'data-etape': nom, 'data-etat': etat, texte: numero + '. ' + (nom === 'construction' ? 'Construction du terrain' : 'Villes')
          + (etat === 'faite' ? ' : faite' : (etat === 'en-cours' ? ' : en cours' : ' : ensuite')) });
      };
      var ancien = r.catalogue === 'premier';
      var contenu = r.catalogue === 'precedent' ? [
        // Plateau du catalogue précédent : rien à poser pour le terrain, seules les villes et les erreurs sont suivies.
        el('h2', { texte: 'Ce qu’il reste à faire' }),
        el('p', { classe: 'at-aide', id: 'cr-reste-precedent', texte: 'Plateau du catalogue précédent : son terrain est fait de monoblocs qui ne sont plus tous au catalogue imprimé. Aucune pièce n’est à poser ; seules ses villes et ses erreurs sont suivies ici.' }),
        titreEtape(2, 'villes', r.etape === 'villes' ? 'en-cours' : 'faite'),
        el('ul', { classe: 'at-reste-liste' }, villes)
      ] : ancien ? [
        // Ancien plateau : ses pièces ne sont pas celles du catalogue 2, les deux étapes ne s'y appliquent pas.
        el('h2', { texte: 'Ce qu’il reste à faire' }),
        el('p', { classe: 'at-aide', id: 'cr-reste-ancien', texte: 'Plateau de l’ancien catalogue : ses tuiles d’une case et ses villes ont été posées pendant la construction. Les étapes du catalogue 2 ne s’y appliquent pas ; seules ses villes et ses erreurs sont suivies ici.' }),
        el('ul', { classe: 'at-reste-liste' }, villes)
      ] : [
        el('h2', { texte: 'Ce qu’il reste à faire' }),
        titreEtape(1, 'construction', r.etape === 'construction' ? 'en-cours' : 'faite'),
        el('ul', { classe: 'at-reste-liste' }, construction),
        titreEtape(2, 'villes', r.etape === 'construction' ? 'ensuite' : (r.etape === 'villes' ? 'en-cours' : 'faite')),
        el('ul', { classe: 'at-reste-liste' }, villes)
      ];
      // L'étape « Villes » se propose d'elle-même quand la construction est terminée.
      if (!ancien && r.etape === 'villes' && acces.allerAuxVilles && acces.etat().mode !== 'villes') {
        contenu.push(el('p', { classe: 'at-reste-proposition', id: 'cr-proposition' }, [
          'Le terrain est construit : ',
          bouton('Passer à l’étape « Villes »', acces.allerAuxVilles, 'cr-vers-villes', 'Poser les villes de déploiement et les villes neutres')
        ]));
      }
      contenu.push(el('ul', { classe: 'at-reste-liste' }, erreurs));
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
      /** Vrai tant qu'une pièce de la palette est glissée (bouton enfoncé, seuil de mouvement dépassé). */
      glisseEnCours: function () { return !!(glisse && glisse.actif); },
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
        acces.confirmer('Retirer le monobloc « ' + cible.nom + ' » en entier (' + cible.cases.length + ' cases) ?',
          'Retirer', function () {
            var avantRetrait = acces.plateau(), r = P.retirer(avantRetrait, cible.piece);
            if (!r.ok) { dire(r.raison, 'erreur'); return; }
            acces.changer(r.plateau);
            dire('Monobloc « ' + cible.nom + ' » retiré : il retourne au stock.' + mentionVilles(avantRetrait, r.plateau)
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
        el('p', { classe: 'at-aide', texte: 'Le pinceau sert à essayer des idées : il pose des tuiles d’une case, alors que le terrain se construit en monoblocs de 3 ou 4 cases. Ces tuiles sont donc HORS RÈGLES, signalées en erreur par les contrôles (le plateau reste enregistrable), sauf une plaine prise d’abord parmi les tuiles de remplissage du catalogue. Les villes se posent à l’étape « Villes ». Il ne touche ni aux monoblocs ni au noyau. La gomme retire un monobloc après confirmation ; elle ne retire jamais le noyau, qui est fixe. Maj + glisser déplace la vue.' })
      ])
    ]);
    rafraichir();

    return { element: element, rafraichir: rafraichir, geste: geste, clic: clic, outil: function () { return outil; } };
  }

  AT.vueCreation.creerGuide = creerGuide;
  AT.vueCreation.creerPinceau = creerPinceau;
})();
