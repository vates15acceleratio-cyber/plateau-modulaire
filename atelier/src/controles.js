/*
 * controles.js : les 7 contrôles du plateau (docs/02-atelier-cahier-des-charges.md, §3).
 * Aucun accès au DOM. Dépend de AT.hex, AT.catalogue, AT.plateau.
 *
 * Chaque contrôle renvoie une LISTE de constats {regle, niveau, message, cases} (au moins un) :
 *   regle   : 'inventaire' | 'continuite' | 'monoblocs' | 'villes' | 'contact' | 'equilibre' | 'evenements'
 *   niveau  : 'erreur' | 'alerte' | 'info'
 *   message : texte en français pour l'utilisateur
 *   cases   : clés des cases concernées (pour la surbrillance), éventuellement vide
 * Certains constats portent en plus un champ `donnees` (chiffres pour l'affichage).
 *
 * Les contrôles 1 à 6 jugent la CONSTRUCTION du plateau : ils ignorent les tuiles d'événement.
 * Le contrôle 7 juge les tuiles d'événement posées.
 *
 * options (toutes facultatives, valeurs par défaut dans AT.catalogue.REGLAGES) :
 *   seuilContact (2 ou 3), mesureContact ('cotes' | 'pieces'), ecartVilles, nombreVilles, couts,
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
  var BASE = { sansRecouvrements: true };

  function constat(regle, niveau, message, cases, donnees) {
    var c = { regle: regle, niveau: niveau, message: message, cases: cases ? H.trier(cases) : [] };
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
   * Alertes : pièces restantes (catalogue imprimé, puis pièces personnelles) ; tuiles d'UNE case posées hors stock
   * par le pinceau (« à prévoir en plus du catalogue », détail par modèle) ; toute montagne d'une case.
   */
  function inventaire(plateau) {
    var res = [], inconnues = 0, pieces = plateau.pieces || [];
    pieces.forEach(function (p) { if (!P.modele(plateau, p.modele)) inconnues += 1; });
    if (inconnues) res.push(constat('inventaire', 'erreur', pluriel(inconnues, 'pièce') + ' hors catalogue sur le plateau.', []));
    var stock = P.stock(plateau), restantes = [], nbRestantes = 0, restantesPerso = [], nbRestantesPerso = 0;
    var enPlus = [], nbEnPlus = 0, casesEnPlus = [], parModele = {};
    var casesDe = function (liste) {
      var cases = [];
      liste.forEach(function (p) { P.casesPiece(p, plateau).forEach(function (c) { cases.push(c.cle); }); });
      return cases;
    };
    Object.keys(stock).forEach(function (id) {
      var s = stock[id], m = P.modele(plateau, id);
      if (s.restant < 0) {
        var posees = pieces.filter(function (p) { return p.modele === id; });
        if (m.cases.length === 1) {
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
        else { restantes.push(s.restant + ' × ' + m.nom); nbRestantes += s.restant; }
      }
    });
    if (nbRestantes) {
      res.push(constat('inventaire', 'alerte', 'Pièces restantes (' + nbRestantes + ') : ' + restantes.join(', ') + '.', [], { restantes: nbRestantes }));
    } else if (!res.length) {
      res.push(constat('inventaire', 'info', 'Toutes les pièces du catalogue sont posées (' + C.totaux().pieces + ' pièces).', [], { restantes: 0 }));
    }
    if (nbRestantesPerso) {
      res.push(constat('inventaire', 'alerte', 'Pièces personnelles restantes (' + nbRestantesPerso + ') : ' + restantesPerso.join(', ') + '.', [], { restantesPerso: nbRestantesPerso }));
    }
    if (nbEnPlus) {
      res.push(constat('inventaire', 'alerte', 'Tuiles à prévoir en plus du catalogue (' + nbEnPlus + ') : ' + enPlus.join(', ') + '.', casesEnPlus,
        { enPlus: nbEnPlus, parModele: parModele }));
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
      var groupesVides = P.trous(cles);
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

  function villes(plateau, options) {
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
   * Contact de chaque pièce : [{piece, modele, cases: [clés], cotes, pieces}].
   *   cotes  : nombre de cases voisines de la pièce occupées par une autre pièce ;
   *   pieces : nombre de pièces voisines distinctes.
   */
  function contacts(plateau) {
    var toutes = P.cases(plateau, BASE), parPiece = new Map();
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
    C.REGLAGES.mesuresContact.forEach(function (mesure) {
      var faibles = tous.filter(function (x) { return x[mesure] < seuil; });
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
   * Équilibre entre les deux camps. Pour chaque ville : coût minimal en rations depuis les villes de
   * déploiement de Vert, et depuis celles de Rouge. Score = somme, sur les villes, de l'écart entre le
   * coût de Vert vers la ville et le coût de Rouge vers la ville symétrique (demi-tour autour de (0,0)).
   * 0 = parfaitement équilibré.
   *
   * Le score n'a de sens que sur un plateau SYMÉTRIQUE par demi-tour, pour la forme (cases occupées) et pour
   * les villes. Sinon : comparable = false, score = null, `raison` dit pourquoi ; le tableau `villes` (coûts
   * depuis chaque camp) reste rempli, et l'écart d'une ville sans ville symétrique vaut null.
   *
   * Renvoie {calculable, comparable, score, raison, villes: [{cle, vert, rouge, symetrique, ecart}],
   *          sansSymetrique: [villes sans ville symétrique], casesSansSymetrique: [cases sans case symétrique],
   *          horsAtteinte: [clés]}.
   *   calculable : les villes de déploiement des deux camps sont désignées (sinon rien n'est calculé) ;
   *   symetrique : la ville symétrique, ou la ville elle-même si elle n'en a pas.
   */
  function equilibre(plateau, options) {
    var toutes = P.cases(plateau, BASE), camps = P.campsAuto(plateau), couts = options && options.couts;
    var res = { calculable: false, comparable: false, score: null, raison: null, villes: [], sansSymetrique: [], casesSansSymetrique: [], horsAtteinte: [] };
    if (!camps.vert.length || !camps.rouge.length) {
      res.raison = 'Les villes de déploiement ne sont pas désignées.';
      return res;
    }
    var dv = P.rationsSurCases(toutes, camps.vert, { couts: couts });
    var dr = P.rationsSurCases(toutes, camps.rouge, { couts: couts });
    res.casesSansSymetrique = H.trier(Object.keys(toutes).filter(function (k) { return !possede.call(toutes, H.symetrique(k)); }));
    var cles = H.trier(Object.keys(toutes).filter(function (k) { return toutes[k].terrain === 'ville'; }));
    var score = 0;
    cles.forEach(function (k) {
      var s = H.symetrique(k), seule = !(possede.call(toutes, s) && toutes[s].terrain === 'ville');
      if (seule) { res.sansSymetrique.push(k); s = k; }
      var ligne = { cle: k, vert: possede.call(dv, k) ? dv[k] : null, rouge: possede.call(dr, k) ? dr[k] : null, symetrique: s, ecart: null };
      if (possede.call(dv, k) && possede.call(dr, s)) {
        if (!seule) { ligne.ecart = Math.abs(dv[k] - dr[s]); score += ligne.ecart; }
      } else {
        res.horsAtteinte.push(k);
      }
      res.villes.push(ligne);
    });
    res.calculable = true;
    res.comparable = !res.casesSansSymetrique.length && !res.sansSymetrique.length;
    if (res.comparable) {
      res.score = score;
    } else {
      var causes = [];
      if (res.casesSansSymetrique.length) causes.push('forme : ' + pluriel(res.casesSansSymetrique.length, 'case') + ' sans case symétrique');
      if (res.sansSymetrique.length) causes.push(pluriel(res.sansSymetrique.length, 'ville') + ' sans ville symétrique : ' + liste(res.sansSymetrique));
      res.raison = 'Plateau non symétrique par demi-tour (' + causes.join(' ; ') + ').';
    }
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
      res.push(constat('equilibre', 'alerte', 'Équilibre non calculable : les villes de déploiement ne sont pas désignées (il en manque, ou il y en a trop, sur la rangée du haut ou du bas).', [], e));
    } else {
      if (e.comparable) {
        res.push(constat('equilibre', 'info', 'Équilibre : score ' + e.score + ' (0 = les deux camps atteignent les villes au même coût en rations).', [], e));
      } else {
        res.push(constat('equilibre', 'alerte', 'Équilibre non comparable : ' + e.raison + ' Le score n’est pas calculé ; les coûts par ville restent affichés.',
          e.casesSansSymetrique.concat(e.sansSymetrique.filter(function (k) { return e.casesSansSymetrique.indexOf(k) === -1; })), e));
      }
      if (e.horsAtteinte.length) {
        res.push(constat('equilibre', 'alerte', 'Villes hors d’atteinte d’un camp : ' + liste(e.horsAtteinte) + ' ; elles ne comptent pas dans le score.', e.horsAtteinte));
      }
    }
    var n = repartition(plateau);
    if (n.total) {
      var v = C.REGLAGES.repartitionVisee;
      res.push(constat('equilibre', 'info', 'Terrains (hors villes et montagnes) : plaines ' + pourcent(100 * n.plaine / n.total) + ', forêts ' + pourcent(100 * n.foret / n.total)
        + ', marais ' + pourcent(100 * n.marais / n.total) + ' (visé : ' + v.plaine + ' / ' + v.foret + ' / ' + v.marais + ').', [], n));
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

  /**
   * Lance les 7 contrôles. Renvoie {ok, erreurs, alertes, resultats, equilibre} :
   *   ok : aucun constat de niveau 'erreur' ; erreurs / alertes : nombres de constats ; resultats : tous les constats,
   *   dans l'ordre des contrôles ; equilibre : résultat de equilibre() (score…).
   */
  function tout(plateau, options) {
    var resultats = [].concat(
      inventaire(plateau), continuite(plateau, options), monoblocs(plateau), villes(plateau, options),
      contact(plateau, options), controleEquilibre(plateau, options), evenements(plateau, options));
    var compte = function (niveau) { return resultats.filter(function (x) { return x.niveau === niveau; }).length; };
    return { ok: compte('erreur') === 0, erreurs: compte('erreur'), alertes: compte('alerte'), resultats: resultats, equilibre: equilibre(plateau, options) };
  }

  AT.controles = {
    inventaire: inventaire, continuite: continuite, monoblocs: monoblocs, villes: villes, contact: contact,
    controleEquilibre: controleEquilibre, evenements: evenements, tout: tout,
    contacts: contacts, equilibre: equilibre, repartition: repartition,
    montagneHorsBloc: montagneHorsBloc
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.controles;
})();
