/*
 * controles.js : compteurs, erreurs et alertes du plateau (sous-agent 4).
 *
 * Partie calcul (calculer, revaliderPlateau) : fonctions pures, aucun accès au DOM,
 * testables sous Node. Partie interface (monter) : panneau de droite, construit avec
 * createElement et textContent (jamais innerHTML : les messages contiennent des noms saisis).
 *
 * Vocabulaire : une « ville » est un jeton de type 'capture', un « carrefour » un jeton 'carrefour'.
 * Dans un compteur, `cible` est la valeur visée (7, 2, 50...). Dans une erreur ou une alerte,
 * `cible` est l'objet de surbrillance défini dans l'en-tête de etat.js (ou null).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele, G = PM.geometrie;
  var NC = G.GRILLE.colonnes, NL = G.GRILLE.lignes;

  /** Composition visée (synthèse des advisors). */
  var NB_VILLES = 7;
  var NB_CARREFOURS = 2;
  /** Cases de déplacement de la composition complète : 4x4 (centrales) + 4x3 (coins) + 4x3 (bords) + 4x2 (apparitions) + 2 carrefours. */
  var NB_CASES_DEPLACEMENT = 50;
  var NB_APPARITIONS_PAR_JOUEUR = 2;
  var NB_JETONS = 9;

  /** Dimensions de la boîte englobante du plateau (en cm). La forme retire des cellules, pas la boîte. */
  var DIMENSIONS = (NC * G.COTE / 10) + ' × ' + (NL * G.COTE / 10) + ' cm';

  /** Libellés des groupes d'erreurs et d'alertes (un code sans libellé affiche le premier message). */
  var LIBELLES = {
    exemplaires_depasses: 'Exemplaires dépassés',
    raccord_mort: 'Raccords morts',
    port_mort: 'Ports de coin morts',
    trop_de_villes: 'Trop de villes',
    trop_de_carrefours: 'Trop de carrefours',
    carrefours_meme_cote: 'Carrefours sur le même côté',
    carrefours_paire: 'Paire de carrefours à risque',
    cinq_contre_deux: '5 villes contre 2',
    ecart_rang_etendu: 'Écart de distance entre joueurs',
    premiere_ville_inegale: 'Première ville inégale'
  };
  /** Alertes d'équilibre reprises de PM.graphe (villes non traversables, avis docs/16). */
  var CODES_EQUILIBRE = ['cinq_contre_deux', 'ecart_rang_etendu', 'premiere_ville_inegale'];
  /**
   * Taux typique de « 5 contre 2 » (en %) par paire de carrefours, villes non traversables, tiré de
   * docs/12-mesures-equilibre.md (1000 plateaux du catalogue, graine 20261015, section 2). Clé : « i,j+i,j »,
   * jonctions triées par ligne puis colonne. La paire par défaut (1,2)+(3,2) vaut 0 %.
   */
  var TAUX_CINQ_CONTRE_DEUX = {
    '1,1+1,2': 9.6, '1,1+2,2': 8.5, '1,1+3,2': 4.4, '1,1+1,3': 4.5, '1,1+2,3': 4.5, '1,1+3,3': 4.4,
    '2,1+1,2': 9.6, '2,1+2,2': 8.5, '2,1+3,2': 4.4, '2,1+1,3': 4.5, '2,1+2,3': 4.5, '2,1+3,3': 4.4,
    '3,1+1,2': 9.6, '3,1+2,2': 8.5, '3,1+3,2': 4.4, '3,1+1,3': 4.5, '3,1+2,3': 4.5, '3,1+3,3': 4.4,
    '1,2+2,2': 0, '1,2+3,2': 0, '1,2+1,3': 5.1, '1,2+2,3': 5.1, '1,2+3,3': 4.9,
    '2,2+3,2': 0, '2,2+1,3': 8.5, '2,2+2,3': 8.5, '2,2+3,3': 8.4,
    '3,2+1,3': 7.9, '3,2+2,3': 7.9, '3,2+3,3': 7.9
  };
  var CODES_CARREFOURS = ['trop_de_carrefours', 'carrefours_meme_cote', 'carrefours_paire'];

  function estNb(x) { return typeof x === 'number' && isFinite(x); }

  /* ------------------------------------------------------------------ */
  /* Conversion des références vers la surbrillance (etat.js)            */
  /* ------------------------------------------------------------------ */

  /** Jonction (i, j) de jeton, ou null si mal formée. */
  function cibleJonction(j) {
    return j && estNb(j.i) && estNb(j.j) ? { type: 'jonction', i: j.i, j: j.j } : null;
  }

  /**
   * Convertit la référence `ref` d'une erreur de PM.modele en objet de surbrillance.
   * `modele` (exemplaires dépassés, pas de type de surbrillance) : on vise la première tuile posée de ce modèle.
   * `forme` (forme invalide, pas de type de surbrillance) : renvoie null.
   */
  function cibleDepuisRef(ref, doc) {
    if (!ref) return null;
    switch (ref.type) {
      case 'tuile':
        return estNb(ref.col) && estNb(ref.lig) ? { type: 'tuile', col: ref.col, lig: ref.lig } : null;
      case 'raccord':
        return { type: 'raccord', col: ref.col, lig: ref.lig, cote: ref.cote, pos: ref.pos };
      case 'coin':
        return { type: 'port', col: ref.col, lig: ref.lig, coin: ref.coin };
      case 'jeton':
        return cibleJonction(ref);
      case 'modele':
        for (var k = 0; k < doc.plateau.tuiles.length; k++) {
          var t = doc.plateau.tuiles[k];
          if (t && t.modeleId === ref.id) return { type: 'tuile', col: t.col, lig: t.lig };
        }
        return null;
      default:
        return null; // 'forme' et types inconnus
    }
  }

  function versEntree(x, niveau, doc) {
    return { code: x.code, message: x.message, niveau: niveau, cible: cibleDepuisRef(x.ref, doc) };
  }

  /* ------------------------------------------------------------------ */
  /* Alertes propres au module : villes, carrefours                      */
  /* ------------------------------------------------------------------ */

  /**
   * Camp d'une jonction : rangée nord (j = 1, camp J1) ou rangée sud (j = NL-1, camp J2), sinon aucun.
   * « Même côté » = même camp de joueur (docs/11-revue-interface.md, arbitrage I3 ; 1b D7 :
   * deux carrefours dans un camp donnent 3 villes contre 1). Les colonnes ouest / est ne sont pas des camps.
   * Même règle que `PM.assemblage.carrefoursMemeCote` (test de cohérence dans tests/controles.test.js).
   */
  function cotesJonction(i, j) {
    var res = [];
    if (j === 1) res.push('rangée nord');
    if (j === NL - 1) res.push('rangée sud');
    return res;
  }

  /** Premier côté commun à deux jetons, ou null. */
  function cotePartage(a, b) {
    var cb = cotesJonction(b.i, b.j);
    var ca = cotesJonction(a.i, a.j);
    for (var k = 0; k < ca.length; k++) if (cb.indexOf(ca[k]) >= 0) return ca[k];
    return null;
  }

  /** Alertes sur les jetons : plus de 7 villes, plus de 2 carrefours, 2 carrefours sur le même côté. */
  function alertesJetons(doc) {
    var villes = [], carrefours = [], res = [];
    doc.plateau.jetons.forEach(function (j) {
      if (!j) return;
      if (j.type === 'capture') villes.push(j);
      else if (j.type === 'carrefour') carrefours.push(j);
    });
    if (villes.length > NB_VILLES) {
      res.push({ code: 'trop_de_villes', niveau: 'alerte', cible: cibleJonction(villes[villes.length - 1]),
        message: 'Il y a ' + villes.length + ' villes, la composition en prévoit ' + NB_VILLES + '.' });
    }
    if (carrefours.length > NB_CARREFOURS) {
      res.push({ code: 'trop_de_carrefours', niveau: 'alerte', cible: cibleJonction(carrefours[carrefours.length - 1]),
        message: 'Il y a ' + carrefours.length + ' carrefours, la composition en prévoit ' + NB_CARREFOURS + '.' });
    }
    for (var a = 0; a < carrefours.length; a++) {
      for (var b = a + 1; b < carrefours.length; b++) {
        var cote = cotePartage(carrefours[a], carrefours[b]);
        if (cote) {
          res.push({ code: 'carrefours_meme_cote', niveau: 'alerte', cible: cibleJonction(carrefours[b]),
            message: 'Deux carrefours sur la même ' + cote + ' du plateau.' });
        }
      }
    }
    // Mode manuel : une paire autre que (1,2)+(3,2) est permise, mais son risque est annoncé
    if (carrefours.length === 2 && !cotePartage(carrefours[0], carrefours[1])) {
      var tri = carrefours.slice().sort(function (a, b) { return (a.j - b.j) || (a.i - b.i); });
      var cle = tri[0].i + ',' + tri[0].j + '+' + tri[1].i + ',' + tri[1].j;
      var taux = TAUX_CINQ_CONTRE_DEUX[cle];
      if (taux !== undefined && taux > 0) {
        res.push({ code: 'carrefours_paire', niveau: 'alerte', cible: cibleJonction(carrefours[1]),
          message: 'Carrefours en (' + tri[0].i + ', ' + tri[0].j + ') et (' + tri[1].i + ', ' + tri[1].j + ') : environ ' +
            String(taux).replace('.', ',') + ' % des plateaux ont « 5 villes contre 2 » avec cette paire (0 % avec (1, 2) et (3, 2)).' });
      }
    }
    return res;
  }

  /**
   * Alertes d'équilibre (villes non traversables), seulement si PM.graphe est chargé et que le plateau
   * est complet : 7 villes, 4 apparitions, toutes les tuiles posées. Sinon aucune alerte.
   */
  function alertesEquilibre(doc) {
    if (!PM.graphe || typeof PM.graphe.equilibre !== 'function') return [];
    var e;
    try { e = PM.graphe.equilibre(doc, { villesTraversables: false }); } catch (x) { return []; }
    if (!e.complet) return [];
    return e.alertes.filter(function (a) { return CODES_EQUILIBRE.indexOf(a.code) >= 0; }).map(function (a) {
      return { code: a.code, message: a.message, niveau: 'alerte', cible: null };
    });
  }

  /* ------------------------------------------------------------------ */
  /* Compteurs                                                           */
  /* ------------------------------------------------------------------ */

  function compteur(cle, libelle, valeur, cible) {
    return { cle: cle, libelle: libelle, valeur: valeur, cible: cible, etat: valeur === cible ? 'ok' : 'ecart' };
  }

  /** Cases de déplacement attendues par rôle de cellule (docs/3-synthese.md : composition des tuiles). */
  var DEPLACEMENT_PAR_ROLE = { centrale: 4, coin: 3, bord: 3, apparition: 2 };

  /**
   * Cibles qui dépendent de la forme (ajout de l'orchestrateur à l'intégration) : dans une forme réduite,
   * moins de jonctions sont possibles, donc moins de carrefours, et moins de cases de déplacement.
   * Sur le 4×4 complet : 2 carrefours, 9 jetons, 50 cases.
   */
  function ciblesSelonForme(forme) {
    var jonctions = 0, cases = 0;
    for (var i = 1; i <= 3; i++) for (var j = 1; j <= 3; j++) if (M.jonctionPossible(forme, i, j)) jonctions++;
    M.cellulesActives(forme).forEach(function (cel) {
      cases += DEPLACEMENT_PAR_ROLE[M.roleCellule(cel.col, cel.lig, forme)] || 0;
    });
    var carrefours = Math.max(0, Math.min(NB_CARREFOURS, jonctions - NB_VILLES));
    return { carrefours: carrefours, casesDeplacement: cases + carrefours };
  }

  function compteursDuPlateau(doc) {
    var plateau = doc.plateau;
    var villes = 0, carrefours = 0, casesDeplacement = 0, petitesTuiles = 0;
    var apparitions = { 1: 0, 2: 0 };
    plateau.jetons.forEach(function (j) {
      if (!j) return;
      if (j.type === 'capture') villes++;
      else if (j.type === 'carrefour') carrefours++;
    });
    // Les carrefours sont des cases de déplacement : ils comptent dans les 50.
    casesDeplacement = carrefours;
    plateau.tuiles.forEach(function (t) {
      var m = M.modeleParId(doc, t.modeleId);
      if (!m) return; // modèle absent : signalé par validerPlateau
      var cases = Array.isArray(m.cases) ? m.cases : [];
      if (cases.length < 2) petitesTuiles++;
      cases.forEach(function (c) {
        if (!c) return;
        if (c.type === 'deplacement') casesDeplacement++;
        else if (c.type === 'apparition') {
          var joueur = M.joueurCellule(t.col, t.lig);
          if (joueur) apparitions[joueur]++;
        }
      });
    });
    var c = ciblesSelonForme(plateau.forme);
    return [
      compteur('villes', 'Villes', villes, NB_VILLES),
      compteur('carrefours', 'Carrefours', carrefours, c.carrefours),
      compteur('cases_deplacement', 'Cases de déplacement', casesDeplacement, c.casesDeplacement),
      compteur('tuiles', 'Tuiles posées', plateau.tuiles.length, M.cellulesActives(plateau.forme).length),
      compteur('apparitions_j1', 'Apparitions J1', apparitions[1], NB_APPARITIONS_PAR_JOUEUR),
      compteur('apparitions_j2', 'Apparitions J2', apparitions[2], NB_APPARITIONS_PAR_JOUEUR),
      compteur('jetons', 'Jetons posés', plateau.jetons.length, NB_VILLES + c.carrefours),
      { cle: 'dimensions', libelle: 'Dimensions', valeur: DIMENSIONS, cible: DIMENSIONS, etat: 'ok' },
      compteur('tuiles_petites', 'Tuiles à moins de 2 cases', petitesTuiles, 0)
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Regroupement des erreurs et alertes                                 */
  /* ------------------------------------------------------------------ */

  /** Rang d'affichage : erreurs, raccords morts, ports morts, carrefours, autres. */
  function rangDe(entree) {
    if (entree.niveau === 'erreur') return 0;
    if (entree.code === 'raccord_mort') return 1;
    if (entree.code === 'port_mort') return 2;
    if (CODES_CARREFOURS.indexOf(entree.code) >= 0) return 3;
    return 4;
  }

  /** Groupes { code, niveau, libelle, nombre, rang, elements: [{message, cible}] } triés par rang (stable). */
  function regrouper(entrees) {
    var groupes = [], parCode = Object.create(null);
    entrees.forEach(function (e) {
      var g = parCode[e.code];
      if (!g) {
        var libelle = Object.prototype.hasOwnProperty.call(LIBELLES, e.code) ? LIBELLES[e.code] : e.message;
        g = parCode[e.code] = { code: e.code, niveau: e.niveau, libelle: libelle, nombre: 0, rang: rangDe(e), elements: [] };
        groupes.push(g);
      }
      g.nombre++;
      g.elements.push({ message: e.message, cible: e.cible });
    });
    return groupes
      .map(function (g, k) { return { g: g, k: k }; })
      .sort(function (a, b) { return (a.g.rang - b.g.rang) || (a.k - b.k); })
      .map(function (x) { return x.g; });
  }

  /* ------------------------------------------------------------------ */
  /* API de calcul (pure)                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Calcule compteurs, erreurs, alertes et groupes d'un document. Ne modifie pas `doc`.
   * Renvoie { compteurs, erreurs, alertes, regroupees }.
   * erreurs / alertes : [{ code, message, niveau: 'erreur'|'alerte', cible }].
   */
  function calculer(doc) {
    var v = M.validerPlateau(doc);
    var erreurs = v.erreurs.map(function (x) { return versEntree(x, 'erreur', doc); });
    var alertes = v.alertes.map(function (x) { return versEntree(x, 'alerte', doc); }).concat(alertesJetons(doc)).concat(alertesEquilibre(doc));
    return {
      compteurs: compteursDuPlateau(doc),
      erreurs: erreurs,
      alertes: alertes,
      regroupees: regrouper(erreurs.concat(alertes))
    };
  }

  /** Revalidation après modification d'un modèle posé : même résultat que calculer(doc).erreurs. */
  function revaliderPlateau(doc) {
    return calculer(doc).erreurs;
  }

  /* ------------------------------------------------------------------ */
  /* Interface (panneau de droite)                                       */
  /* ------------------------------------------------------------------ */

  function el(tag, classe, texte) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  /** Ligne d'un compteur : libellé, valeur / cible, jauge (colorée seulement en cas d'écart). */
  function ligneCompteur(c) {
    var li = el('li', 'pm-controles-compteur pm-controles-compteur--' + c.etat);
    li.appendChild(el('span', 'pm-controles-libelle', c.libelle));
    var numerique = estNb(c.valeur) && estNb(c.cible);
    li.appendChild(el('span', 'pm-controles-valeur', numerique ? c.valeur + ' / ' + c.cible : String(c.valeur)));
    if (numerique) {
      var pct = c.cible > 0 ? Math.min(100, c.valeur / c.cible * 100) : (c.valeur > 0 ? 100 : 0);
      var jauge = el('span', 'pm-controles-jauge');
      jauge.setAttribute('aria-hidden', 'true');
      var rempli = el('span', 'pm-controles-jauge-remplissage');
      rempli.style.width = pct + '%';
      jauge.appendChild(rempli);
      li.appendChild(jauge);
    }
    return li;
  }

  /**
   * Monte le panneau dans `conteneur` et s'abonne à `etat`.
   * Clic sur une alerte : etat.majUi({surbrillance: cible, onglet: 'plateau'}).
   */
  function monter(conteneur, etat) {
    var ouverts = Object.create(null); // groupes dépliés, conservés d'un rendu à l'autre
    var dernier = null;                // empreinte du dernier rendu : pas de redessin si rien ne change

    var racine = el('div', 'pm-controles');

    // Compteurs
    var blocCompteurs = el('section', 'pm-controles-bloc');
    blocCompteurs.setAttribute('aria-labelledby', 'pm-controles-titre-compteurs');
    var titreCompteurs = el('h2', 'pm-controles-titre', 'Compteurs');
    titreCompteurs.id = 'pm-controles-titre-compteurs';
    blocCompteurs.appendChild(titreCompteurs);
    var listeCompteurs = el('ul', 'pm-controles-compteurs');
    blocCompteurs.appendChild(listeCompteurs);
    racine.appendChild(blocCompteurs);

    // Erreurs et alertes
    var blocAlertes = el('section', 'pm-controles-bloc');
    blocAlertes.setAttribute('aria-labelledby', 'pm-controles-titre-alertes');
    var titreAlertes = el('h2', 'pm-controles-titre', 'Erreurs et alertes');
    titreAlertes.id = 'pm-controles-titre-alertes';
    blocAlertes.appendChild(titreAlertes);
    var zoneAlertes = el('div', 'pm-controles-zone-alertes');
    blocAlertes.appendChild(zoneAlertes);
    racine.appendChild(blocAlertes);

    // Outils de priorité 2 : actifs dès que leur module est chargé (PM.equilibre, PM.generateur),
    // qui exposent ouvrir(etat) et affichent leur contenu dans la boîte de dialogue commune (PM.dialogue).
    var blocAVenir = el('section', 'pm-controles-bloc');
    blocAVenir.appendChild(el('h2', 'pm-controles-titre', 'Outils'));
    var listeAVenir = el('ul', 'pm-controles-avenir');
    [['Rapport d\'équilibre', 'equilibre'], ['Plateau aléatoire', 'generateur']].forEach(function (outil) {
      var li = el('li', 'pm-controles-avenir-item');
      var bouton = el('button', 'pm-controles-avenir-bouton', outil[0]);
      bouton.type = 'button';
      var module = PM[outil[1]];
      li.appendChild(bouton);
      if (module && typeof module.ouvrir === 'function') {
        bouton.addEventListener('click', function () { module.ouvrir(etat); });
      } else {
        bouton.disabled = true;
        li.appendChild(el('span', 'pm-controles-badge', 'bientôt'));
      }
      listeAVenir.appendChild(li);
    });
    blocAVenir.appendChild(listeAVenir);
    racine.appendChild(blocAVenir);

    conteneur.appendChild(racine);

    /** Redessine la zone d'alertes en gardant le groupe déplié et le focus clavier. */
    function dessinerAlertes(groupes) {
      var repere = null, actif = document.activeElement;
      if (actif && zoneAlertes.contains(actif) && actif.getAttribute('data-repere')) repere = actif.getAttribute('data-repere');

      zoneAlertes.textContent = '';
      titreAlertes.textContent = groupes.length ? 'Erreurs et alertes (' + groupes.reduce(function (s, g) { return s + g.nombre; }, 0) + ')' : 'Erreurs et alertes';
      if (!groupes.length) {
        zoneAlertes.appendChild(el('p', 'pm-controles-vide', 'Aucune erreur ni alerte.'));
        return;
      }
      var liste = el('ul', 'pm-controles-groupes');
      groupes.forEach(function (g) {
        var li = el('li', 'pm-controles-groupe pm-controles-groupe--' + g.niveau);
        var details = el('details', 'pm-controles-details');
        details.open = !!ouverts[g.code];
        details.addEventListener('toggle', function () { ouverts[g.code] = details.open; });
        var sommaire = el('summary', 'pm-controles-sommaire');
        sommaire.setAttribute('data-repere', g.code + '#');
        sommaire.appendChild(el('span', 'pm-controles-sommaire-libelle', g.libelle));
        sommaire.appendChild(el('span', 'pm-controles-nombre', String(g.nombre)));
        details.appendChild(sommaire);

        var elements = el('ul', 'pm-controles-elements');
        g.elements.forEach(function (e, k) {
          var item = el('li', 'pm-controles-element');
          if (e.cible) {
            var bouton = el('button', 'pm-controles-alerte', e.message);
            bouton.type = 'button';
            bouton.setAttribute('data-repere', g.code + '#' + k);
            bouton.addEventListener('click', function () {
              etat.majUi({ surbrillance: Object.assign({}, e.cible), onglet: 'plateau' });
            });
            item.appendChild(bouton);
          } else {
            item.appendChild(el('p', 'pm-controles-sans-cible', e.message));
          }
          elements.appendChild(item);
        });
        details.appendChild(elements);
        li.appendChild(details);
        liste.appendChild(li);
      });
      zoneAlertes.appendChild(liste);

      if (repere) {
        var cible = zoneAlertes.querySelector('[data-repere="' + repere + '"]');
        if (cible) cible.focus();
      }
    }

    function rafraichir() {
      var r = calculer(etat.doc());
      var empreinte = JSON.stringify([r.compteurs, r.regroupees]);
      if (empreinte === dernier) return;
      dernier = empreinte;

      listeCompteurs.textContent = '';
      r.compteurs.forEach(function (c) { listeCompteurs.appendChild(ligneCompteur(c)); });
      dessinerAlertes(r.regroupees);
    }

    etat.abonner(rafraichir);
    rafraichir();
  }

  PM.controles = {
    NB_VILLES: NB_VILLES,
    NB_CARREFOURS: NB_CARREFOURS,
    ciblesSelonForme: ciblesSelonForme,
    calculer: calculer,
    monter: monter,
    revaliderPlateau: revaliderPlateau
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.controles;
})();
