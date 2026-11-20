/*
 * controles.js : les contrôles du plateau (docs/02-atelier-cahier-des-charges.md, §3 et §9.4).
 * Aucun accès au DOM. Dépend de AT.hex, AT.catalogue, AT.plateau.
 *
 * Chaque contrôle renvoie une LISTE de constats {regle, groupe, niveau, message, cases} (au moins un) :
 *   regle   : 'inventaire' | 'continuite' | 'monoblocs' | 'contact' | 'villes' | 'equilibre' | 'evenements'
 *   groupe  : 'construction' (inventaire, continuité et trous, monoblocs et noyau, contact) | 'villes' (villes,
 *             équilibre) | 'evenements'
 *   niveau  : 'erreur' | 'alerte' | 'info'
 *   message : texte en français pour l'utilisateur
 *   cases   : clés des cases concernées (pour la surbrillance), éventuellement vide
 * Certains constats portent en plus un champ `donnees` (chiffres pour l'affichage).
 *
 * Deux phases (§9.1, B3) : la CONSTRUCTION du terrain, puis les VILLES. Un plateau construit sans villes n'est pas
 * en erreur : etape() dit « construction terminée, villes à poser » et le contrôle des villes le signale en alerte.
 * Les contrôles de construction jugent le terrain seul (sans villes neutres ni villes de déploiement) ; aucun
 * contrôle de construction ou de villes ne regarde les tuiles d'événement, jugées à part.
 *
 * options (toutes facultatives, valeurs par défaut dans AT.catalogue.REGLAGES) :
 *   seuilContact (2 ou 3), mesureContact ('cotes' | 'pieces'), seuilContactRemplissage, ecartVilles, nombreVilles, couts,
 *   profondeurExtremite (ne sert que si le plateau n'a pas enregistré la sienne : voir AT.plateau.profondeurExtremite),
 *   contactVilleNeutre, neutresTiersCentral,
 *   trous ('alerte' | 'erreur' | 'ignore' : niveau du constat quand le plateau a un trou).
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
    if (!AT.plateau) require('./plateau.js');
  }
  var H = AT.hex, C = AT.catalogue, P = AT.plateau;
  var possede = Object.prototype.hasOwnProperty;
  var BASE = { sansRecouvrements: true };                          // terrain et villes, sans les tuiles d'événement
  var TERRAIN = { sansRecouvrements: true, sansVilles: true };     // le terrain construit seul
  var GROUPES = { inventaire: 'construction', continuite: 'construction', monoblocs: 'construction', contact: 'construction',
    villes: 'villes', equilibre: 'villes', evenements: 'evenements' };
  var NOMS_CAMPS = { vert: 'Vert', rouge: 'Rouge' };

  function constat(regle, niveau, message, cases, donnees) {
    var c = { regle: regle, groupe: GROUPES[regle], niveau: niveau, message: message, cases: cases ? H.trier(cases) : [] };
    if (donnees !== undefined) c.donnees = donnees;
    return c;
  }

  function reglage(options, nom) {
    return (options && options[nom] !== undefined) ? options[nom] : C.REGLAGES[nom];
  }

  function liste(cles) { return cles.map(function (k) { return '(' + k + ')'; }).join(' '); }

  /** « 1 case », « 3 cases », « 4 pas » ; `auPluriel` pour les accords irréguliers. */
  function pluriel(n, mot, auPluriel) {
    if (n > 1) return n + ' ' + (auPluriel || (/s$/.test(mot) ? mot : mot + 's'));
    return n + ' ' + mot;
  }

  function pourcent(x) { return x.toFixed(1).replace('.', ',') + ' %'; }

  // ------------------------------------------------------------------ 1. inventaire

  /**
   * Vrai si une forme [{q, r, terrain}] porte de la montagne SANS être un bloc de 4 ou 5 cases tout en montagne
   * (décision en vigueur : « montagnes en blocs de 4 ou 5 cases »). Sans montagne : faux.
   */
  function montagneHorsBloc(cases) {
    var liste = Array.isArray(cases) ? cases : [];
    var n = liste.filter(function (c) { return c && c.terrain === 'montagne'; }).length;
    if (!n) return false;
    return !(n === liste.length && (n === 4 || n === 5));
  }

  /**
   * Inventaire. Erreurs : pièce de modèle inconnu ; monobloc (ou noyau) posé plus de fois que prévu.
   * Alertes : pièces de terrain restantes (noyau, montagnes, monoblocs), puis pièces personnelles restantes ; tuiles
   * d'UNE case posées hors catalogue (pinceau, ancien catalogue : « à prévoir en plus du catalogue », détail par
   * modèle) ; toute montagne d'une case. Les tuiles de remplissage non posées sont une simple information ; les
   * villes neutres restantes sont l'affaire du contrôle des villes.
   * Plateau de l'ancien catalogue (il porte une tuile de ville d'une case) : une seule information le dit ; ni
   * « pièces de terrain restantes », ni « tuiles à prévoir en plus » pour ses tuiles P / F / S / V.
   */
  function inventaire(plateau) {
    var res = [], inconnues = 0, pieces = plateau.pieces || [];
    // Plateau de l'ANCIEN catalogue (il porte des tuiles de ville d'une case) : ses tuiles d'une case ne sont pas du
    // carton « à prévoir en plus », et les pièces de terrain du catalogue 2 ne sont pas « à poser » sur lui.
    var ancien = pieces.some(function (p) { return p.modele === 'V'; }), nbAnciennes = 0, detailAnciennes = [];
    pieces.forEach(function (p) { if (!P.modele(plateau, p.modele)) inconnues += 1; });
    if (inconnues) res.push(constat('inventaire', 'erreur', pluriel(inconnues, 'pièce') + ' hors catalogue sur le plateau.', []));
    var stock = P.stock(plateau), restantes = [], nbRestantes = 0, restantesPerso = [], nbRestantesPerso = 0;
    var enPlus = [], nbEnPlus = 0, casesEnPlus = [], parModele = {}, facultatives = [];
    var monoblocsAnciens = [], nbMonoblocsAnciens = 0, casesMonoblocsAnciens = [];
    var casesDe = function (liste) {
      var cases = [];
      liste.forEach(function (p) { P.casesPiece(p, plateau).forEach(function (c) { cases.push(c.cle); }); });
      return cases;
    };
    Object.keys(stock).forEach(function (id) {
      var s = stock[id], m = P.modele(plateau, id);
      if (s.restant < 0) {
        var posees = pieces.filter(function (p) { return p.modele === id; });
        if (m.ancien === true && m.cases.length > 1) {
          // Monobloc retiré du catalogue (relu d'un fichier) : ni faute ni « stock dépassé ». Sur un plateau du premier
          // catalogue il fait partie de ce catalogue-là ; ailleurs, il est signalé plus bas, en alerte.
          if (!ancien) { monoblocsAnciens.push(s.poses + ' × ' + m.nom); nbMonoblocsAnciens += s.poses; casesMonoblocsAnciens = casesMonoblocsAnciens.concat(casesDe(posees)); }
        } else if (ancien && m.ancien === true) {
          detailAnciennes.push(s.poses + ' × ' + m.nom);
          nbAnciennes += s.poses;
        } else if (m.cases.length === 1) {
          // Tuile d'une case posée hors stock (pinceau) : ce n'est pas une faute, c'est du carton à prévoir.
          enPlus.push((0 - s.restant) + ' × ' + m.nom);
          nbEnPlus -= s.restant;
          parModele[id] = 0 - s.restant;
          casesEnPlus = casesEnPlus.concat(casesDe(posees.slice(s.total)));
        } else {
          res.push(constat('inventaire', 'erreur', 'Stock dépassé : ' + s.poses + ' × « ' + m.nom + ' » posées pour ' + s.total
            + (m.perso ? ' prévue(s) (pièce personnelle).' : ' au catalogue.'), casesDe(posees)));
        }
      } else if (s.restant > 0) {
        if (m.perso) { restantesPerso.push(s.restant + ' × ' + m.nom); nbRestantesPerso += s.restant; }
        else if (m.facultatif) { facultatives.push(s.restant + ' × ' + m.nom); }
        else if (C.estConstruction(m)) { restantes.push(s.restant + ' × ' + m.nom); nbRestantes += s.restant; }
      }
    });
    if (ancien) {
      res.push(constat('inventaire', 'info', 'Plateau de l’ancien catalogue : ' + pluriel(nbAnciennes, 'tuile') + ' d’une case de ce catalogue (' + detailAnciennes.join(', ')
        + '). Il ne se compare pas à l’inventaire du catalogue 2.', [], { ancien: true, tuilesAnciennes: nbAnciennes }));
    } else if (nbRestantes) {
      res.push(constat('inventaire', 'alerte', 'Pièces de terrain restantes (' + nbRestantes + ') : ' + restantes.join(', ') + '.', [], { restantes: nbRestantes }));
    } else if (!res.length) {
      res.push(constat('inventaire', 'info', 'Toutes les pièces de terrain du catalogue sont posées (' + C.totaux().construction.pieces + ' pièces).', [], { restantes: 0 }));
    }
    if (facultatives.length && !ancien) res.push(constat('inventaire', 'info', 'Tuiles facultatives non posées : ' + facultatives.join(', ') + '.', []));
    if (nbRestantesPerso) {
      res.push(constat('inventaire', 'alerte', 'Pièces personnelles restantes (' + nbRestantesPerso + ') : ' + restantesPerso.join(', ') + '.', [], { restantesPerso: nbRestantesPerso }));
    }
    if (nbEnPlus) {
      res.push(constat('inventaire', 'alerte', 'Tuiles à prévoir en plus du catalogue (' + nbEnPlus + ') : ' + enPlus.join(', ') + '.', casesEnPlus,
        { enPlus: nbEnPlus, parModele: parModele }));
    }
    if (nbMonoblocsAnciens) {
      res.push(constat('inventaire', 'alerte', pluriel(nbMonoblocsAnciens, 'monobloc') + ' d’un ancien catalogue sur le plateau (' + monoblocsAnciens.join(', ')
        + ') : ces pièces ne sont plus au catalogue imprimé (aucun monobloc tout en plaine, forêt ou marais à une extrémité).', casesMonoblocsAnciens, { monoblocsAnciens: nbMonoblocsAnciens }));
    }
    var montagnes = pieces.filter(function (p) {
      var m = P.modele(plateau, p.modele);
      return !!m && m.cases.length === 1 && m.cases[0].terrain === 'montagne';
    });
    if (montagnes.length) {
      res.push(constat('inventaire', 'alerte', pluriel(montagnes.length, 'montagne') + ' d’une case sur le plateau : la décision en vigueur est « montagnes en blocs de 4 ou 5 cases ».',
        casesDe(montagnes), { montagnesUneCase: montagnes.length }));
    }
    // Même rappel pour un monobloc personnel qui porte de la montagne sans être un bloc de 4 ou 5 cases tout en montagne.
    var horsBloc = pieces.filter(function (p) {
      var m = P.modele(plateau, p.modele);
      return !!m && m.perso === true && montagneHorsBloc(m.cases);
    });
    // Décision du 2026-11-19 : aucun monobloc tout en plaine. Pour une pièce personnelle, c'est un rappel, pas une faute.
    var toutPlaine = pieces.filter(function (p) {
      var m = P.modele(plateau, p.modele);
      return !!m && m.perso === true && C.toutEnPlaine(m.cases);
    });
    if (toutPlaine.length) {
      var nomsPlaine = [];
      toutPlaine.forEach(function (p) { var nom = P.modele(plateau, p.modele).nom; if (nomsPlaine.indexOf(nom) === -1) nomsPlaine.push(nom); });
      res.push(constat('inventaire', 'alerte', pluriel(toutPlaine.length, 'monobloc personnel', 'monoblocs personnels') + ' tout en plaine (' + nomsPlaine.join(', ')
        + ') : la décision en vigueur est « chaque monobloc de terrain porte au moins une forêt ou un marais ».', casesDe(toutPlaine), { monoblocsToutPlaine: toutPlaine.length }));
    }
    if (horsBloc.length) {
      var noms = [];
      horsBloc.forEach(function (p) { var nom = P.modele(plateau, p.modele).nom; if (noms.indexOf(nom) === -1) noms.push(nom); });
      res.push(constat('inventaire', 'alerte', pluriel(horsBloc.length, 'monobloc personnel', 'monoblocs personnels') + ' avec de la montagne hors bloc de 4 ou 5 cases (' + noms.join(', ')
        + ') : la décision en vigueur est « montagnes en blocs de 4 ou 5 cases ».', casesDe(horsBloc), { montagnesHorsBloc: horsBloc.length }));
    }
    return res;
  }

  // ------------------------------------------------------------------ 2. chevauchement, continuité

  function continuite(plateau, options) {
    var res = [], toutes = P.cases(plateau, BASE), cles = Object.keys(toutes);
    // Les trous se jugent sur le terrain construit : une ville neutre, ajoutée après coup, n'en ferme pas.
    var clesTerrain = Object.keys(P.cases(plateau, TERRAIN));
    if (!cles.length) return [constat('continuite', 'alerte', 'Le plateau est vide.', [])];
    var doubles = P.chevauchements(plateau);
    if (doubles.length) res.push(constat('continuite', 'erreur', 'Chevauchement : ' + pluriel(doubles.length, 'case') + ' sous plusieurs pièces.', doubles));
    var groupes = P.composantes(cles);
    if (groupes.length > 1) {
      var ecartees = [];
      groupes.slice(1).forEach(function (g) { ecartees = ecartees.concat(g); });
      res.push(constat('continuite', 'erreur', 'Le plateau est en ' + groupes.length + ' morceaux : ' + pluriel(ecartees.length, 'case') + ' hors du morceau principal.', ecartees));
    }
    var coupe = P.coupures(plateau, { sansRecouvrements: true, couts: options && options.couts });
    if (coupe.groupes > 1) {
      res.push(constat('continuite', 'erreur', pluriel(coupe.isolees.length, 'case franchissable', 'cases franchissables') + ' sans liaison avec le reste du plateau.', coupe.isolees));
    }
    // Trous : cases vides entièrement entourées. Niveau réglable (REGLAGES.trous), « alerte » par défaut.
    var niveauTrous = reglage(options, 'trous'), sansTrou = '';
    if (niveauTrous === 'alerte' || niveauTrous === 'erreur') {
      var groupesVides = P.trous(clesTerrain);
      if (groupesVides.length) {
        var videes = [];
        groupesVides.forEach(function (g) { videes = videes.concat(g); });
        res.push(constat('continuite', niveauTrous, (groupesVides.length > 1 ? groupesVides.length + ' trous' : 'Un trou') + ' dans le plateau : '
          + pluriel(videes.length, 'case vide entourée', 'cases vides entourées') + ' par des tuiles ' + liste(H.trier(videes).slice(0, 12)) + (videes.length > 12 ? '…' : '') + '.',
          videes, { trous: groupesVides.length, cases: videes.length }));
      } else {
        sansTrou = ' ; aucun trou';
      }
    }
    if (!res.length) res.push(constat('continuite', 'info', 'Aucun chevauchement ; plateau d’un seul tenant' + sansTrou + ' ; toutes les cases franchissables sont reliées (' + pluriel(cles.length, 'case') + ').', []));
    return res;
  }

  // ------------------------------------------------------------------ 3. monoblocs (A2) et noyau

  function monoblocs(plateau) {
    var res = [];
    var fautifs = C.monoblocsAvecVille();
    if (fautifs.length) res.push(constat('monoblocs', 'erreur', 'Catalogue : ville dans un monobloc hors noyau (' + fautifs.join(', ') + ').', []));
    var plats = C.monoblocsToutPlaine();
    if (plats.length) res.push(constat('monoblocs', 'erreur', 'Catalogue : monobloc de terrain tout en plaine (' + plats.join(', ') + ') ; chaque monobloc porte au moins une forêt ou un marais.', []));
    // Une pièce personnelle validée n'a jamais de ville ; un document monté en mémoire est quand même vérifié.
    var fautifsPerso = P.modeles(plateau).filter(function (m) {
      return !C.modele(m.id) && m.cases.length > 1 && m.cases.some(function (c) { return c.terrain === 'ville'; });
    }).map(function (m) { return m.id; });
    if (fautifsPerso.length) res.push(constat('monoblocs', 'erreur', 'Pièce personnelle avec une ville (' + fautifsPerso.join(', ') + ') : jamais de ville dans un monobloc (règle A2).', []));
    fautifs = fautifs.concat(fautifsPerso);
    var cases = [];
    (plateau.pieces || []).forEach(function (p) {
      if (fautifs.indexOf(p.modele) !== -1) P.casesPiece(p, plateau).forEach(function (c) { cases.push(c.cle); });
    });
    if (cases.length) res.push(constat('monoblocs', 'erreur', 'Une ville se trouve dans un monobloc qui n’est pas le noyau.', cases));
    var noyaux = (plateau.pieces || []).filter(function (p) { var m = C.modele(p.modele); return m && m.noyau; });
    if (!noyaux.length) {
      res.push(constat('monoblocs', 'erreur', 'Le noyau n’est pas posé.', []));
    } else {
      noyaux.forEach(function (p) {
        if (p.q !== 0 || p.r !== 0) {
          res.push(constat('monoblocs', 'erreur', 'Le noyau doit être centré en (0,0) ; il est en (' + H.cle(p.q, p.r) + ').', P.casesPiece(p, plateau).map(function (c) { return c.cle; })));
        }
      });
    }
    if (!res.length) res.push(constat('monoblocs', 'info', 'Aucune ville dans un monobloc hors noyau ; noyau présent, centré en (0,0).', []));
    return res;
  }

  // ------------------------------------------------------------------ 4. villes

  /** Rangées extrêmes du plateau : {haut, bas} (r minimal, r maximal), ou null si le plateau est vide. */
  function rangees(toutes) {
    var rs = Object.keys(toutes).map(function (k) { return H.decle(k).r; });
    return rs.length ? { haut: Math.min.apply(null, rs), bas: Math.max.apply(null, rs) } : null;
  }

  function memesCles(a, b) { return H.trier(a).join(' ') === H.trier(b).join(' '); }

  /** Pièces de construction (noyau, montagnes, monoblocs de terrain) encore à poser : {nombre, detail: ['2 × Nom']}. */
  function resteConstruction(plateau) {
    var stock = P.stock(plateau), detail = [], nombre = 0;
    C.ORDRE_MODELES.forEach(function (id) {
      var m = C.MODELES[id];
      if (C.estConstruction(m) && stock[id].restant > 0) { detail.push(stock[id].restant + ' × ' + m.nom); nombre += stock[id].restant; }
    });
    return { nombre: nombre, detail: detail };
  }

  /** « 2 villes de déploiement pour Vert, 1 ville neutre » : ce qu'il reste à poser, ou '' si rien. */
  function texteVillesManquantes(manquantes) {
    var morceaux = [];
    ['vert', 'rouge'].forEach(function (camp) {
      if (manquantes[camp]) morceaux.push(pluriel(manquantes[camp], 'ville de déploiement', 'villes de déploiement') + ' pour ' + NOMS_CAMPS[camp]);
    });
    if (manquantes.neutres) morceaux.push(pluriel(manquantes.neutres, 'ville neutre', 'villes neutres'));
    return morceaux.join(', ');
  }

  /**
   * Villes (phase « villes », §9.1). Erreurs : ville de déploiement mal placée (B4), ville neutre mal placée (B5),
   * villes trop proches (B6), villes en trop, camps enregistrés qui ne sont pas ceux des tuiles posées.
   * Les villes qui restent à poser ne sont PAS une erreur : alerte si le terrain est construit, information sinon.
   * Un plateau de l'ancien catalogue (villes d'une case, aucune ville du catalogue 2) garde l'ancien contrôle.
   */
  function villes(plateau, options) {
    var etat = P.etatVilles(plateau), pieces = plateau.pieces || [];
    var anciennes = pieces.filter(function (p) { return p.modele === 'V'; });
    if (anciennes.length && !etat.vert.length && !etat.rouge.length && !etat.neutres.length) return villesAnciennes(plateau, options);

    var res = [], toutes = P.cases(plateau, BASE), terrain = P.cases(plateau, TERRAIN);
    var ecart = reglage(options, 'ecartVilles'), parCamp = C.REGLAGES.villesParCamp, couts = options && options.couts;
    var regles = { sansEcart: true, couts: couts };
    ['contactVilleNeutre', 'neutresTiersCentral'].forEach(function (nom) { if (options && options[nom] !== undefined) regles[nom] = options[nom]; });
    // Profondeur des extrémités : celle que le document a enregistrée, sinon l'option, sinon le réglage par défaut.
    regles.profondeurExtremite = P.profondeurExtremite(plateau, options);
    var cles = H.trier(Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }));

    // Entrée de déploiement visant une case qui n'existe pas : etatVilles() et cases() l'écartent sans rien dire,
    // alors qu'elle est dans le document (et compte pour la borne de valider) : c'est une erreur, à retirer.
    P.deploiements(plateau).forEach(function (x) {
      if (possede.call(terrain, x.cle)) return;
      res.push(constat('villes', 'erreur', 'Ville de déploiement de ' + NOMS_CAMPS[x.camp] + ' en (' + x.cle + ') hors du plateau : aucune case à cet endroit. Retirez-la (étape « Villes », « Retirer toutes les villes »).', []));
    });

    // Villes de déploiement : une Plaine du bord haut (Vert) ou du bord bas (Rouge), hors noyau.
    ['vert', 'rouge'].forEach(function (camp) {
      if (etat[camp].length > parCamp) {
        res.push(constat('villes', 'erreur', pluriel(etat[camp].length, 'ville de déploiement', 'villes de déploiement') + ' pour ' + NOMS_CAMPS[camp] + ' ; il en faut ' + parCamp + '.', etat[camp]));
      }
      etat[camp].forEach(function (k) {
        var raison = P.refusDeploiementSurCases(terrain, camp, k, regles);
        if (raison) res.push(constat('villes', 'erreur', 'Ville de déploiement de ' + NOMS_CAMPS[camp] + ' en (' + k + ') mal placée : ' + raison, [k]));
      });
    });

    // Villes neutres : une tuile ajoutée contre chaque flanc.
    var total = C.modele('VN') ? C.modele('VN').nombre : 0, flancs = {};
    if (etat.neutres.length > total) res.push(constat('villes', 'erreur', pluriel(etat.neutres.length, 'ville neutre', 'villes neutres') + ' ; il en faut ' + total + '.', etat.neutres.map(function (n) { return n.cle; })));
    etat.neutres.forEach(function (n) {
      if (possede.call(terrain, n.cle)) return;                       // chevauchement : c'est le contrôle 2 qui le dit
      var raison = P.refusNeutreSurCases(terrain, n.cle, regles);
      if (raison) { res.push(constat('villes', 'erreur', 'Ville neutre en (' + n.cle + ') mal placée : ' + raison, [n.cle])); return; }
      if (flancs[n.flanc]) res.push(constat('villes', 'erreur', 'Deux villes neutres sur le flanc ' + n.flanc + ' : il en faut une par flanc.', [n.cle, flancs[n.flanc]]));
      flancs[n.flanc] = n.cle;
    });
    if (anciennes.length) {
      res.push(constat('villes', 'alerte', pluriel(anciennes.length, 'ville') + ' de l’ancien catalogue (tuile d’une case) sur le plateau : dans le catalogue 2, les villes sont des tuiles de déploiement ou des villes neutres.',
        anciennes.map(function (p) { return H.cle(p.q, p.r); })));
    }

    // Écart entre toutes les paires, en pas, par les cases franchissables.
    var minimum = Infinity;
    cles.forEach(function (a, i) {
      var d = P.pasSurCases(toutes, [a], { couts: couts });
      cles.slice(i + 1).forEach(function (b) {
        if (!possede.call(d, b)) return;                 // villes non reliées : c'est le contrôle 2 qui le dit
        minimum = Math.min(minimum, d[b]);
        if (d[b] < ecart) {
          res.push(constat('villes', 'erreur', 'Villes trop proches : ' + liste([a, b]) + ' à ' + pluriel(d[b], 'pas') + ' ; il en faut ' + ecart + ' (soit ' + pluriel(ecart - 1, 'case') + ' entre elles).', [a, b]));
        }
      });
    });

    // `camps` doit être celui que donnent les tuiles posées.
    var auto = P.campsAuto(plateau);
    ['vert', 'rouge'].forEach(function (camp) {
      var notes = (plateau.camps && plateau.camps[camp]) || [];
      if (!memesCles(notes, auto[camp])) {
        res.push(constat('villes', 'erreur', 'Les villes de déploiement enregistrées pour ' + NOMS_CAMPS[camp] + ' ne sont pas celles des tuiles posées.', notes.concat(auto[camp])));
      }
    });

    // Ce qu'il reste à poser : jamais une erreur.
    var manque = texteVillesManquantes(etat.manquantes), reste = resteConstruction(plateau);
    if (manque) {
      res.push(constat('villes', reste.nombre ? 'info' : 'alerte', reste.nombre
        ? 'Villes : elles se posent une fois le terrain construit (' + manque + ' à poser).'
        : 'Construction terminée, villes à poser : ' + manque + '.', [], { manquantes: etat.manquantes }));
    } else if (!res.length) {
      res.push(constat('villes', 'info', pluriel(cles.length, 'ville') + ' ; écart minimal ' + pluriel(minimum, 'pas') + ' ; déploiement de Vert en ' + liste(auto.vert) + ', de Rouge en ' + liste(auto.rouge)
        + ' ; villes neutres en ' + liste(etat.neutres.map(function (n) { return n.cle; })) + '.', cles, { ecartMinimal: minimum }));
    }
    return res;
  }

  /** Villes d'un plateau de l'ANCIEN catalogue (tuiles de ville d'une case, déploiement sur les rangées extrêmes). */
  function villesAnciennes(plateau, options) {
    var res = [], toutes = P.cases(plateau, BASE);
    var nombre = reglage(options, 'nombreVilles'), ecart = reglage(options, 'ecartVilles'), parCamp = C.REGLAGES.villesParCamp;
    var couts = options && options.couts;
    var cles = H.trier(Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }));
    if (cles.length !== nombre) res.push(constat('villes', 'erreur', pluriel(cles.length, 'ville') + ' sur le plateau ; il en faut ' + nombre + '.', cles));

    // Écart entre toutes les paires, en pas, par les cases franchissables.
    var minimum = Infinity;
    cles.forEach(function (a, i) {
      var d = P.pasSurCases(toutes, [a], { couts: couts });
      cles.slice(i + 1).forEach(function (b) {
        if (!possede.call(d, b)) return;                 // villes non reliées : c'est le contrôle 2 qui le dit
        minimum = Math.min(minimum, d[b]);
        if (d[b] < ecart) {
          res.push(constat('villes', 'erreur', 'Villes trop proches : ' + liste([a, b]) + ' à ' + pluriel(d[b], 'pas') + ' ; il en faut ' + ecart + ' (soit ' + pluriel(ecart - 1, 'tuile') + ' entre elles).', [a, b]));
        }
      });
    });

    // Villes de déploiement : rangée du haut (Vert), rangée du bas (Rouge).
    // Le compte se fait sur toutes les villes de la rangée ; campsAuto ne désigne rien en cas d'égalité.
    var bornes = rangees(toutes), auto = P.campsAuto(plateau), surRangee = P.villesRangeesExtremes(plateau);
    if (bornes) {
      [['vert', 'haut', 'Vert'], ['rouge', 'bas', 'Rouge']].forEach(function (x) {
        var trouvees = surRangee[x[0]], designees = auto[x[0]];
        if (trouvees.length < parCamp) {
          res.push(constat('villes', 'erreur', pluriel(trouvees.length, 'ville') + ' sur la rangée du ' + x[1] + ' (r = ' + bornes[x[1]] + ') ; il en faut ' + parCamp + ' pour le déploiement de ' + x[2] + '.', trouvees));
        } else if (trouvees.length > parCamp) {
          res.push(constat('villes', 'erreur', pluriel(trouvees.length, 'ville') + ' à égalité sur la rangée du ' + x[1] + ' : on ne peut pas désigner les ' + parCamp + ' villes de déploiement de ' + x[2]
            + ' (aucune n’est retenue ; retirez-en ' + (trouvees.length - parCamp) + ').', trouvees));
        }
        var notes = (plateau.camps && plateau.camps[x[0]]) || [];
        if (!memesCles(notes, designees)) {
          res.push(constat('villes', 'erreur', 'Les villes de déploiement enregistrées pour ' + x[2] + ' ne sont pas celles de la rangée du ' + x[1] + '.', notes.concat(trouvees)));
        }
      });
    }
    if (!res.length) {
      res.push(constat('villes', 'info', pluriel(cles.length, 'ville') + ' ; écart minimal ' + pluriel(minimum, 'pas') + ' ; déploiement de Vert en ' + liste(auto.vert) + ', de Rouge en ' + liste(auto.rouge) + '.', cles,
        { ecartMinimal: minimum }));
    }
    return res;
  }

  // ------------------------------------------------------------------ 5. contact (A6)

  /**
   * Contact de chaque pièce du terrain construit (les villes neutres, jugées par le contrôle des villes, ne comptent
   * ni comme pièces ni comme voisines) : [{piece, modele, cases: [clés], cotes, pieces}].
   *   cotes  : nombre de cases voisines de la pièce occupées par une autre pièce ;
   *   pieces : nombre de pièces voisines distinctes.
   */
  function contacts(plateau) {
    var toutes = P.cases(plateau, TERRAIN), parPiece = new Map();
    H.trier(Object.keys(toutes)).forEach(function (k) {
      var id = toutes[k].piece;
      if (!parPiece.has(id)) parPiece.set(id, { piece: id, modele: toutes[k].modele, cases: [] });
      parPiece.get(id).cases.push(k);
    });
    var res = [];
    parPiece.forEach(function (x) {
      var casesVoisines = new Set(), piecesVoisines = new Set();
      x.cases.forEach(function (k) {
        H.voisines(k).forEach(function (v) {
          if (possede.call(toutes, v) && toutes[v].piece !== x.piece) { casesVoisines.add(v); piecesVoisines.add(toutes[v].piece); }
        });
      });
      res.push({ piece: x.piece, modele: x.modele, cases: x.cases, cotes: casesVoisines.size, pieces: piecesVoisines.size });
    });
    return res;
  }

  var NOMS_MESURES = { cotes: 'côtés', pieces: 'pièces' };

  function contact(plateau, options) {
    var seuil = reglage(options, 'seuilContact'), retenue = reglage(options, 'mesureContact');
    var tous = contacts(plateau), res = [];
    if (!tous.length) return [constat('contact', 'info', 'Contact : plateau vide.', [])];
    // Une tuile de remplissage a son propre seuil (jamais plus exigeant que celui des monoblocs).
    var seuilRemplissage = Math.min(seuil, reglage(options, 'seuilContactRemplissage'));
    var seuilDe = function (x) { var m = P.modele(plateau, x.modele); return (m && m.role === 'remplissage') ? seuilRemplissage : seuil; };
    C.REGLAGES.mesuresContact.forEach(function (mesure) {
      var faibles = tous.filter(function (x) { return x[mesure] < seuilDe(x); });
      var minimum = Math.min.apply(null, tous.map(function (x) { return x[mesure]; }));
      var cases = [];
      faibles.forEach(function (x) { cases = cases.concat(x.cases); });
      var entete = 'Contact, mesure « ' + NOMS_MESURES[mesure] + ' »' + (mesure === retenue ? ' (retenue)' : ' (pour information)') + ', seuil ' + seuil + ' : ';
      var donnees = { mesure: mesure, seuil: seuil, retenue: mesure === retenue, sousLeSeuil: faibles.length, minimum: minimum };
      if (faibles.length) {
        res.push(constat('contact', mesure === retenue ? 'erreur' : 'info', entete + pluriel(faibles.length, 'tuile') + ' sous le seuil (minimum ' + minimum + ').', cases, donnees));
      } else {
        res.push(constat('contact', 'info', entete + 'toutes les tuiles le respectent (minimum ' + minimum + ').', [], donnees));
      }
    });
    return res;
  }

  // ------------------------------------------------------------------ 6. équilibre et répartition

  /**
   * Équilibre du plateau (sans symétrie) : ecartsCamps sur le terrain et les villes, avec les villes de déploiement
   * de campsAuto. Renvoie le résultat de ecartsCamps, complété pour l'affichage : `comparable` (= calculable).
   */
  function equilibre(plateau, options) {
    var e = ecartsCamps(P.cases(plateau, BASE), P.campsAuto(plateau), options);
    e.comparable = e.calculable;
    return e;
  }

  /**
   * Équilibre SANS symétrie (cahier des charges §9.3 d), sur un résultat de AT.plateau.cases().
   * `camps` : {vert: [clés], rouge: [clés]} (villes de déploiement). Le coût d'un camp vers une case est le plus
   * petit coût en rations depuis l'une de ses villes de déploiement (entrer dans une case coûte son terrain).
   *   - pour chaque autre ville (centre, villes neutres) : écart entre le coût de Vert et celui de Rouge ;
   *   - villes de déploiement adverses : coûts de Vert vers chaque ville de Rouge et de Rouge vers chaque ville de
   *     Vert, rangés du plus petit au plus grand et comparés rang par rang.
   * Score = somme de ces écarts (0 = les deux camps sont à égale distance de tout).
   * Renvoie {calculable, score, raison, villes: [{cle, type: 'centre' | 'neutre' | 'vert' | 'rouge', vert, rouge, ecart}],
   *          adverses: {vert: [coûts], rouge: [coûts], ecart}, horsAtteinte: [clés]}.
   *   Une ville de déploiement a ecart = null (elle compte dans `adverses`) ; une ville hors d'atteinte d'un camp
   *   a ecart = null, figure dans horsAtteinte et ne compte pas dans le score.
   */
  function ecartsCamps(toutes, camps, options) {
    var couts = options && options.couts;
    var res = { calculable: false, score: null, raison: null, villes: [], adverses: { vert: [], rouge: [], ecart: null }, horsAtteinte: [] };
    var vert = ((camps && camps.vert) || []).filter(function (k) { return possede.call(toutes, k); });
    var rouge = ((camps && camps.rouge) || []).filter(function (k) { return possede.call(toutes, k); });
    if (!vert.length || !rouge.length) {
      res.raison = 'Les villes de déploiement ne sont pas toutes posées.';
      return res;
    }
    var dv = P.rationsSurCases(toutes, vert, { couts: couts }), dr = P.rationsSurCases(toutes, rouge, { couts: couts });
    var score = 0;
    H.trier(Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; })).forEach(function (k) {
      var type = vert.indexOf(k) !== -1 ? 'vert' : rouge.indexOf(k) !== -1 ? 'rouge' : (k === '0,0' ? 'centre' : 'neutre');
      var ligne = { cle: k, type: type, vert: possede.call(dv, k) ? dv[k] : null, rouge: possede.call(dr, k) ? dr[k] : null, ecart: null };
      if (ligne.vert === null || ligne.rouge === null) res.horsAtteinte.push(k);
      else if (type === 'centre' || type === 'neutre') { ligne.ecart = Math.abs(ligne.vert - ligne.rouge); score += ligne.ecart; }
      res.villes.push(ligne);
    });
    var croissant = function (a, b) { return a - b; };
    res.adverses.vert = rouge.filter(function (k) { return possede.call(dv, k); }).map(function (k) { return dv[k]; }).sort(croissant);
    res.adverses.rouge = vert.filter(function (k) { return possede.call(dr, k); }).map(function (k) { return dr[k]; }).sort(croissant);
    if (res.adverses.vert.length === res.adverses.rouge.length && res.adverses.vert.length) {
      res.adverses.ecart = 0;
      res.adverses.vert.forEach(function (c, i) { res.adverses.ecart += Math.abs(c - res.adverses.rouge[i]); });
      score += res.adverses.ecart;
    }
    res.calculable = true;
    res.score = score;
    return res;
  }

  /** Répartition des terrains hors villes et montagnes : {total, plaine, foret, marais} en nombre de cases. */
  function repartition(plateau) {
    var toutes = P.cases(plateau, BASE), n = { total: 0, plaine: 0, foret: 0, marais: 0 };
    Object.keys(toutes).forEach(function (k) {
      var t = toutes[k].terrain;
      if (t === 'plaine' || t === 'foret' || t === 'marais') { n[t] += 1; n.total += 1; }
    });
    return n;
  }

  function controleEquilibre(plateau, options) {
    var res = [], e = equilibre(plateau, options);
    if (!e.calculable) {
      res.push(constat('equilibre', 'info', 'Équilibre : il se calcule une fois les villes de déploiement des deux camps posées.', [], e));
    } else {
      var centre = 0, neutres = 0;
      e.villes.forEach(function (v) { if (v.ecart !== null) { if (v.type === 'centre') centre += v.ecart; else neutres += v.ecart; } });
      res.push(constat('equilibre', 'info', 'Équilibre : score ' + e.score + ' (0 = les deux camps sont à égale distance de tout, en rations). Écart vers le centre ' + centre
        + ', vers les villes neutres ' + neutres + ', vers les villes de déploiement adverses ' + (e.adverses.ecart === null ? '–' : e.adverses.ecart) + '.', [], e));
      if (e.horsAtteinte.length) {
        res.push(constat('equilibre', 'alerte', 'Villes hors d’atteinte d’un camp : ' + liste(e.horsAtteinte) + ' ; elles ne comptent pas dans le score.', e.horsAtteinte));
      }
    }
    var n = repartition(plateau);
    if (n.total) {
      var v = C.REGLAGES.repartitionVisee;
      res.push(constat('equilibre', 'info', 'Terrains (hors villes et montagnes) : plaines ' + pourcent(100 * n.plaine / n.total) + ', forêts ' + pourcent(100 * n.foret / n.total)
        + ', marais ' + pourcent(100 * n.marais / n.total) + ' (visé : ' + [v.plaine, v.foret, v.marais].map(function (x) { return String(x).replace('.', ','); }).join(' / ') + ').', [], n));
    }
    return res;
  }

  // ------------------------------------------------------------------ 7. événements posés

  function evenements(plateau, options) {
    var res = [], recs = plateau.recouvrements || [];
    if (!recs.length) return [constat('evenements', 'info', 'Aucune tuile d’événement posée.', [])];
    var base = P.cases(plateau, BASE), evVus = new Set(), clesVues = new Set();
    recs.forEach(function (x) {
      var ev = C.evenement(x.evenement);
      var cases = (typeof x.cle === 'string' && possede.call(base, x.cle)) ? [x.cle] : [];
      if (!ev) { res.push(constat('evenements', 'erreur', 'Événement inconnu de la réserve.', cases)); return; }
      if (evVus.has(ev.id)) res.push(constat('evenements', 'erreur', '« ' + ev.nom + ' » est posé deux fois (tuile unique).', cases));
      if (clesVues.has(x.cle)) res.push(constat('evenements', 'erreur', 'Deux tuiles d’événement sur la même case.', cases));
      evVus.add(ev.id);
      clesVues.add(x.cle);
      var raison = P.refusTerrainEvenement(base, ev.id, x.cle);
      if (raison) res.push(constat('evenements', 'erreur', '« ' + ev.nom + ' » mal posé : ' + raison, cases));
    });
    var couts = options && options.couts;
    var avant = P.coupures(plateau, { sansRecouvrements: true, couts: couts }), apres = P.coupures(plateau, { couts: couts });
    if (apres.groupes > avant.groupes) {
      res.push(constat('evenements', 'alerte', 'Les tuiles d’événement coupent le plateau : ' + pluriel(apres.isolees.length, 'case') + ' sans liaison avec le reste'
        + (apres.villesIsolees.length ? ', dont ' + pluriel(apres.villesIsolees.length, 'ville') : '') + '.', apres.isolees));
    }
    if (!res.length) res.push(constat('evenements', 'info', pluriel(recs.length, 'tuile') + ' d’événement, conditions de pose respectées, pas de coupure.', []));
    return res;
  }

  // ------------------------------------------------------------------ tout

  // ------------------------------------------------------------------ étape et bilan

  /**
   * Étape du plateau (§9.1, B3). Renvoie {etape, message, restantes, detail, villes, ancien} :
   *   etape : 'construction' (il reste des pièces de terrain à poser), 'villes' (terrain construit, villes à poser)
   *           ou 'complet' (terrain construit, toutes les villes posées) ; l'étape ne dit rien des erreurs ;
   *   restantes / detail : pièces de construction à poser (nombre, ['2 × Nom']) ;
   *   villes : {vert, rouge, neutres} villes à poser ; ancien : le plateau porte des tuiles du premier catalogue.
   */
  function etape(plateau) {
    var reste = resteConstruction(plateau), etat = P.etatVilles(plateau);
    // « Ancien plateau » : il porte des tuiles d'une case du premier catalogue. Un monobloc retiré depuis ne suffit pas.
    var ancien = (plateau.pieces || []).some(function (p) { var m = C.modele(p.modele); return !!m && m.ancien === true && m.cases.length === 1; });
    var nom = reste.nombre ? 'construction' : (etat.completes ? 'complet' : 'villes'), message;
    if (nom === 'construction') message = 'Construction en cours : ' + pluriel(reste.nombre, 'pièce') + ' de terrain à poser.';
    else if (nom === 'villes') message = 'Construction terminée, villes à poser : ' + texteVillesManquantes(etat.manquantes) + '.';
    else message = 'Plateau complet : terrain construit, villes posées.';
    if (ancien) message += ' Ce plateau porte des tuiles de l’ancien catalogue.';
    return { etape: nom, message: message, restantes: reste.nombre, detail: reste.detail, villes: etat.manquantes, ancien: ancien };
  }

  /**
   * Lance tous les contrôles. Renvoie {ok, erreurs, alertes, resultats, equilibre, etape, etapeMessage, construction, villes} :
   *   ok : aucun constat de niveau 'erreur' (un plateau sans villes peut être ok : voir `etape`) ;
   *   erreurs / alertes : nombres de constats ; resultats : tous les constats, groupe « construction » d'abord
   *   (inventaire, continuité, monoblocs, contact), puis « villes » (villes, équilibre), puis les événements ;
   *   equilibre : résultat de equilibre() ; etape : 'construction' | 'villes' | 'complet' (voir etape()) ;
   *   construction / villes : {erreurs, alertes} du groupe, et pour la construction `terminee`, pour les villes `completes`.
   * Un plateau est jouable tel que le générateur le rend quand ok est vrai ET etape vaut 'complet'.
   */
  function tout(plateau, options) {
    var resultats = [].concat(
      inventaire(plateau), continuite(plateau, options), monoblocs(plateau), contact(plateau, options),
      villes(plateau, options), controleEquilibre(plateau, options), evenements(plateau, options));
    var compte = function (niveau, groupe) {
      return resultats.filter(function (x) { return x.niveau === niveau && (!groupe || x.groupe === groupe); }).length;
    };
    var e = etape(plateau);
    return {
      ok: compte('erreur') === 0, erreurs: compte('erreur'), alertes: compte('alerte'), resultats: resultats, equilibre: equilibre(plateau, options),
      etape: e.etape, etapeMessage: e.message,
      construction: { erreurs: compte('erreur', 'construction'), alertes: compte('alerte', 'construction'), terminee: e.etape !== 'construction', restantes: e.restantes },
      villes: { erreurs: compte('erreur', 'villes'), alertes: compte('alerte', 'villes'), completes: e.etape === 'complet', manquantes: e.villes }
    };
  }

  AT.controles = {
    inventaire: inventaire, continuite: continuite, monoblocs: monoblocs, villes: villes, contact: contact,
    controleEquilibre: controleEquilibre, evenements: evenements, tout: tout, etape: etape, villesAnciennes: villesAnciennes,
    contacts: contacts, equilibre: equilibre, ecartsCamps: ecartsCamps, repartition: repartition,
    montagneHorsBloc: montagneHorsBloc
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.controles;
})();
