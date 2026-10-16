/*
 * controles.js : compteurs, erreurs et alertes du plateau (sous-agent 4).
 *
 * Partie calcul (calculer, revaliderPlateau) : fonctions pures, aucun accès au DOM,
 * testables sous Node. Partie interface (monter) : panneau de droite, construit avec
 * createElement et textContent (jamais innerHTML : les messages contiennent des noms saisis).
 *
 * Vocabulaire : une « ville » est un jeton de type 'capture' ; une jonction sans ville est une case chemin.
 * Joueurs : vert (nord) et rouge (sud). Dans un compteur, `cible` est la valeur visée (7, 6...). Dans une
 * erreur ou une alerte, `cible` est l'objet de surbrillance défini dans l'en-tête de etat.js (ou null).
 * Un plateau complet très déséquilibré (PM.graphe : « 5 contre 2 » ou écart de plus de 3 pas à un rang)
 * est une ERREUR (code 'desequilibre') ; la pose reste toujours permise.
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var M = PM.modele;

  /** Composition visée : 7 villes ; cases (cases des tuiles + cases de jonction) ≈ 63 en 4×4 (accepté par l’utilisateur, docs/18), ≈ 75 en 5×5 (docs/20). */
  var NB_VILLES = 7;
  var CIBLE_CASES = { '4x4': 63, '5x5': 75 };

  /** Dimensions du plateau (en cm) pour le format F. */
  function dimensions(F) { return (F.GRILLE.colonnes * F.COTE / 10) + ' × ' + (F.GRILLE.lignes * F.COTE / 10) + ' cm'; }

  /** Libellés des groupes d'erreurs et d'alertes (un code sans libellé affiche le premier message). */
  var LIBELLES = {
    desequilibre: 'Plateau très déséquilibré',
    raccord_mort: 'Raccords morts',
    port_pourtour: 'Ports vers le bord du plateau',
    jonction_ports: 'Jonctions mal reliées',
    gabarit_place: 'Tuiles hors de leur place',
    pourtour_sans_apparition: 'Pourtour sans case d\'apparition',
    apparition_centre: 'Case d\'apparition au centre',
    trop_de_villes: 'Trop de villes',
    villes_proches: 'Villes trop proches',
    plateau_non_connexe: 'Plateau non connexe',
    cinq_contre_deux: '5 villes contre 2',
    ecart_rang_etendu: 'Écart de distance entre joueurs',
    score_s: 'Score S à surveiller',
    premiere_ville_inegale: 'Première ville inégale',
    ville_inaccessible: 'Ville inaccessible'
  };
  /** Alertes d'équilibre reprises de PM.graphe (villes non traversables). « 5 contre 2 » n'y est que s'il n'est pas bloquant. */
  var CODES_EQUILIBRE = ['cinq_contre_deux', 'ecart_rang_etendu', 'score_s', 'premiere_ville_inegale', 'ville_inaccessible'];

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
   * `modele` (pas de type de surbrillance) : on vise la première tuile posée de ce modèle.
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
        return null; // types inconnus
    }
  }

  function versEntree(x, niveau, doc) {
    return { code: x.code, message: x.message, niveau: niveau, cible: cibleDepuisRef(x.ref, doc) };
  }

  /* ------------------------------------------------------------------ */
  /* Alertes et erreur propres au module : villes, connexité, équilibre  */
  /* ------------------------------------------------------------------ */

  /** Toutes les cellules de la grille sont-elles occupées par une tuile dont le modèle existe ? */
  function plateauRempli(doc, F) {
    var n = 0;
    doc.plateau.tuiles.forEach(function (t) { if (t && M.modeleParId(doc, t.modeleId)) n++; });
    return n >= F.GRILLE.colonnes * F.GRILLE.lignes;
  }

  /**
   * Alertes sur les villes et le graphe : plus de 7 villes ; deux villes à moins de 3 cases (PM.graphe chargé) ;
   * plateau non connexe (seulement une fois toutes les tuiles posées : avant, des cases de jonction sont isolées).
   */
  function alertesGraphe(doc, g) {
    var res = [], villes = doc.plateau.jetons.filter(function (j) { return j && j.type === 'capture'; });
    if (villes.length > NB_VILLES) {
      res.push({ code: 'trop_de_villes', niveau: 'alerte', cible: cibleJonction(villes[villes.length - 1]),
        message: 'Il y a ' + villes.length + ' villes, la composition en prévoit ' + NB_VILLES + '.' });
    }
    if (!g) return res;
    PM.graphe.villesProches(g).forEach(function (p) {
      res.push({ code: 'villes_proches', niveau: 'alerte', cible: cibleJonction(p.b),
        message: 'Villes (' + p.a.i + ', ' + p.a.j + ') et (' + p.b.i + ', ' + p.b.j + ') à ' + (p.pas - 1) + ' case(s) d\'écart : la règle en demande au moins ' + PM.geometrie.ECART_MIN_VILLES + '.' });
    });
    if (plateauRempli(doc, M.formatDuDocument(doc)) && !PM.graphe.connexe(g)) {
      res.push({ code: 'plateau_non_connexe', niveau: 'alerte', cible: null,
        message: 'Le plateau n\'est pas d\'un seul tenant : certaines cases ne sont reliées à aucune autre partie.' });
    }
    return res;
  }

  /** Graphe du plateau (villes non traversables) si PM.graphe est chargé, sinon null ; null aussi si le calcul échoue. */
  function grapheDuPlateau(doc) {
    if (!PM.graphe || typeof PM.graphe.construire !== 'function') return null;
    try { return PM.graphe.construire(doc, { villesTraversables: false }); } catch (x) { return null; }
  }

  /**
   * Équilibre mesuré (villes non traversables), seulement si PM.graphe est chargé et que le plateau
   * est complet : 7 villes, une case d'apparition par camp au moins, toutes les tuiles posées. Renvoie null sinon.
   */
  function mesureEquilibre(doc, g) {
    if (!g || typeof PM.graphe.equilibre !== 'function') return null;
    var e;
    try { e = PM.graphe.equilibre(doc, { graphe: g }); } catch (x) { return null; }
    return e && e.complet ? e : null;
  }

  /** Alertes d'équilibre affichées (codes de CODES_EQUILIBRE) d'une mesure, ou aucune si elle manque. */
  function alertesEquilibre(e) {
    if (!e) return [];
    return e.alertes.filter(function (a) { return CODES_EQUILIBRE.indexOf(a.code) >= 0; }).map(function (a) {
      return { code: a.code, message: a.message, niveau: 'alerte', cible: null };
    });
  }

  /** Erreur « plateau très déséquilibré » d'une mesure complète (message qui nomme le critère), ou aucune. */
  function erreursEquilibre(e) {
    if (!e || !e.tresDesequilibre) return [];
    return [{ code: 'desequilibre', niveau: 'erreur', cible: null,
      message: 'Plateau très déséquilibré : ' + e.blocages.map(function (b) { return b.message.replace(/\.$/, ''); }).join(' ; ') +
        '. Changez des tuiles ou des villes (la pose reste permise).' }];
  }

  /* ------------------------------------------------------------------ */
  /* Compteurs                                                           */
  /* ------------------------------------------------------------------ */

  function compteur(cle, libelle, valeur, cible) {
    return { cle: cle, libelle: libelle, valeur: valeur, cible: cible, etat: valeur === cible ? 'ok' : 'ecart' };
  }

  /** Cellules du pourtour appartenant au camp (cases d'apparition attendues : 6 en 4×4, 7 en 5×5). */
  function apparitionsAttendues(F, camp) {
    var n = 0;
    for (var lig = 0; lig < F.GRILLE.lignes; lig++) {
      for (var col = 0; col < F.GRILLE.colonnes; col++) {
        if (M.gabaritCellule(col, lig, F) !== 'centrale' && F.campCellule(col, lig) === camp) n++;
      }
    }
    return n;
  }

  function compteursDuPlateau(doc) {
    var plateau = doc.plateau, F = M.formatDuDocument(doc);
    var villes = 0, cases = 0, petitesTuiles = 0, apparitions = { vert: 0, rouge: 0 };
    plateau.jetons.forEach(function (j) { if (j && j.type === 'capture') villes++; });
    plateau.tuiles.forEach(function (t) {
      var m = M.modeleParId(doc, t.modeleId);
      if (!m) return; // modèle absent : signalé par validerPlateau
      var cs = Array.isArray(m.cases) ? m.cases : [];
      if (cs.length < 2) petitesTuiles++;
      cs.forEach(function (c) {
        if (!c) return;
        cases++;
        var camp = c.type === 'apparition' ? F.campCellule(t.col, t.lig) : null;
        if (camp) apparitions[camp]++;
      });
    });
    // Cases de jonction : jonctions sans ville entourées de leurs 4 tuiles
    for (var j = 1; j < F.GRILLE.lignes; j++) {
      for (var i = 1; i < F.GRILLE.colonnes; i++) {
        var aVille = plateau.jetons.some(function (x) { return x && x.i === i && x.j === j && x.type === 'capture'; });
        if (!aVille && M.portsJonction(doc, i, j).tuiles === 4) cases++;
      }
    }
    var cibleCases = CIBLE_CASES[F.id];
    return [
      compteur('villes', 'Villes', villes, NB_VILLES),
      { cle: 'cases', libelle: 'Cases (tuiles et jonctions)', valeur: cases, cible: '≈ ' + cibleCases, etat: 'ok' },
      compteur('tuiles', 'Tuiles posées', plateau.tuiles.length, F.GRILLE.colonnes * F.GRILLE.lignes),
      compteur('apparitions_vert', 'Apparitions vert', apparitions.vert, apparitionsAttendues(F, 'vert')),
      compteur('apparitions_rouge', 'Apparitions rouge', apparitions.rouge, apparitionsAttendues(F, 'rouge')),
      { cle: 'dimensions', libelle: 'Dimensions', valeur: dimensions(F), cible: dimensions(F), etat: 'ok' },
      compteur('tuiles_petites', 'Tuiles à moins de 2 cases', petitesTuiles, 0)
    ];
  }

  /* ------------------------------------------------------------------ */
  /* Regroupement des erreurs et alertes                                 */
  /* ------------------------------------------------------------------ */

  /** Rang d'affichage : erreurs, raccords morts, ports vers le bord, autres. */
  function rangDe(entree) {
    if (entree.niveau === 'erreur') return 0;
    if (entree.code === 'raccord_mort') return 1;
    if (entree.code === 'port_pourtour') return 2;
    return 3;
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
    var p = doc && doc.plateau;
    // document mal formé : refus explicite (Error lisible), jamais un TypeError natif
    if (!p || typeof p !== 'object' || !Array.isArray(p.tuiles) || !Array.isArray(p.jetons)) {
      throw new Error('Document invalide : plateau absent ou mal formé.');
    }
    if (!Array.isArray(doc.modeles)) throw new Error('Document invalide : bibliothèque de modèles absente.');
    var v = M.validerPlateau(doc), g = grapheDuPlateau(doc), eq = mesureEquilibre(doc, g);
    var erreurs = v.erreurs.map(function (x) { return versEntree(x, 'erreur', doc); }).concat(erreursEquilibre(eq));
    var alertes = v.alertes.map(function (x) { return versEntree(x, 'alerte', doc); })
      .concat(alertesGraphe(doc, g)).concat(alertesEquilibre(eq));
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
    var texte = numerique ? c.valeur + ' / ' + c.cible : (estNb(c.valeur) ? c.valeur + ' (' + c.cible + ')' : String(c.valeur));
    li.appendChild(el('span', 'pm-controles-valeur', texte));
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
    CIBLE_CASES: CIBLE_CASES,
    calculer: calculer,
    monter: monter,
    revaliderPlateau: revaliderPlateau
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.controles;
})();
