/*
 * equilibre.js : rapport d'équilibre du plateau (boîte de dialogue commune PM.dialogue).
 * Le calcul est dans PM.graphe (pur) ; ce module en fait une présentation en lecture seule :
 * il ne modifie jamais le document et ne s'abonne pas à l'état (le rapport est un instantané).
 * Villes non traversables (règle du jeu, docs/18) ; joueurs vert (1) et rouge (2).
 *
 *  - PM.equilibre.analyser(doc, options) : { graphe, resultat, goulets: {1, 2} } (pur)
 *  - PM.equilibre.rapport(analyse)       : modèle de présentation sans DOM (pur, testé sous Node)
 *  - PM.equilibre.remplir(conteneur, doc)     : dessine le rapport dans `conteneur`
 *  - PM.equilibre.ouvrir(etat)           : ouvre le rapport dans PM.dialogue
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.graphe && typeof require === 'function') require('./graphe.js'); // chargement sous Node

(function () {
  'use strict';

  var GR = PM.graphe;

  /** Conseil de pose À LA MAIN propre au 4×4 (deux jonctions-cases) : absent du rapport d'un plateau 5×5. Il reste juste (0 % de « 5 contre 2 » dans la rangée centrale, docs/48), mais le générateur ne le suit plus par défaut (12 paires de jonctions variées équilibrées, docs/51 remarque 11). */
  var CONSEIL_4X4 = 'Pour éviter « 5 contre 2 » en 4×4, placez les deux jonctions-cases (sans ville) dans la rangée centrale. ';
  var DIST_MAX_TRES_HAUTE = 6; // distMax à partir duquel le rythme est « bien au-dessus de la cible » (information seulement, docs/48 § 4)

  /** Texte d'explication du rapport pour le format (« 4x4 » par défaut) : les seuils de S sont propres à chaque format (docs/18, docs/48). */
  function explicationDe(formatId) {
    var id = formatId === '5x5' ? '5x5' : '4x4';
    var info = GR.seuilSInformation(id), alerte = GR.seuilS(id);
    return 'Pour chaque joueur (vert, rouge), on mesure en pas la distance de chaque ville à sa case d\'apparition la plus proche, ' +
      'puis on trie les 7 distances. Plateau très déséquilibré (erreur) : un joueur plus proche de 5 villes ou plus (« 5 contre 2 ») ' +
      'ou plus de ' + GR.SEUIL_BLOCAGE_ECART + ' pas d\'écart à un rang de 1 à 7. Alerte : plus de ' + GR.SEUIL_ECART + ' pas d\'écart à un rang. ' +
      'Le score S est la somme de ces écarts sur les 7 rangs (à surveiller à partir de ' + alerte + ' ; S = ' + info + (alerte - 1 > info ? ' ou ' + (alerte - 1) : '') + ' est une simple information). ' +
      (id === '4x4' ? CONSEIL_4X4 : '') +
      'La première ville doit être à la même distance pour les deux joueurs. Une ville n\'est qu\'une destination : on ne la traverse pas.';
  }
  var EXPLICATION = explicationDe('4x4');

  /**
   * Analyse complète : graphe, résultat d'équilibre, goulets des deux joueurs (villes non traversables) et, en information
   * (docs/18, docs/45, docs/46), rythme (PM.graphe.rythme), accès au centre (PM.graphe.accesCentre) et cases par moitié
   * (PM.graphe.casesParMoitie).
   */
  function analyser(doc, options) {
    options = options || {};
    var graphe = GR.construire(doc, options);
    var resultat = GR.equilibre(doc, Object.assign({}, options, { graphe: graphe }));
    return {
      grille: PM.modele.formatDuDocument(doc).id, graphe: graphe, resultat: resultat, goulets: { 1: GR.goulets(graphe, 1), 2: GR.goulets(graphe, 2) },
      rythme: GR.rythme(doc, graphe), acces: GR.accesCentre(doc, graphe), moities: GR.casesParMoitie(doc, graphe),
      connexions: GR.connexions ? GR.connexions(doc, graphe) : null
    };
  }

  /**
   * Lignes d'information sur le rythme, l'accès au centre, les cases par moitié et, en 5×5, les connexions par case (jamais des
   * alertes) ; [] si l'analyse ne les a pas (analyse construite à la main). Rangée neutre et jonctions du milieu à part.
   */
  function lignesOrganiques(analyse) {
    var ry = analyse.rythme, ac = analyse.acces, mo = analyse.moities, res = [];
    if (!ry || !ac || !mo) return res;
    var est5x5 = analyse.grille === '5x5';
    var tresHaut = ry.chaineMax >= 2 * GR.CHAINE_CIBLE + 1 || ry.distMax >= DIST_MAX_TRES_HAUTE; // chaîne >= 7 ou distMax >= 6 : information seulement
    res.push('Rythme : au plus ' + ry.chaineMax + ' case(s) d’affilée sans zone d’intérêt (ville, passage sans case qui fait gagner un pas, raccourci du pourtour) ; cible ' +
      GR.CHAINE_CIBLE + ' ou moins' + (tresHaut ? ' (bien au-dessus de la cible).' : (ry.chaineMax > GR.CHAINE_CIBLE ? ' (au-dessus de la cible).' : '.')) + ' Distance maximale d’une case à une zone : ' + ry.distMax + ' pas.');
    res.push('Accès au centre (' + (est5x5 ? 'rangée neutre et jonctions qui la bordent' : 'rangée de jonctions du milieu') + ') : ' + ac.portes.vert + ' porte(s) côté vert, ' +
      ac.portes.rouge + ' côté rouge (écart ' + ac.ecart + ') ; chemins indépendants depuis les apparitions : vert ' + ac.chemins.vert + ', rouge ' + ac.chemins.rouge + '.');
    res.push('Cases par moitié : vert ' + mo.vert + ', rouge ' + mo.rouge + (mo.ecart ? ' (écart ' + mo.ecart + ')' : ' (égales)') + ' ; à part : ' +
      (est5x5 ? mo.tuiles.neutre + ' sur la rangée neutre et ' : '') + mo.jonctions.milieu + ' jonction(s)-case(s) du milieu.');
    // 5×5 (docs/18, docs/53 § 1) : connexions par case, en information seulement
    var cx = analyse.connexions;
    if (est5x5 && cx && cx.cases) {
      res.push('Connexions par case : ' + cx.faibles + ' case(s) à 2 connexions ou moins sur ' + cx.cases + ' (' + texteParts(cx.part) + ' ; visé : moins de ' +
        texteParts(GR.PART_CONNEXIONS_MAX) + (cx.conforme ? ', tenu' : ', non tenu') + ') ; ' + texteDegre(cx.degreMoyen) + ' connexions par case en moyenne (villes à part).');
    }
    return res;
  }

  /** Part en pour cent, une décimale, virgule française (0,034 -> « 3,4 % »). */
  function texteParts(x) { return (Math.round(x * 1000) / 10).toString().replace('.', ',') + ' %'; }
  /** Nombre à deux décimales, virgule française. */
  function texteDegre(x) { return x === null || x === undefined ? '—' : (Math.round(x * 100) / 100).toString().replace('.', ','); }

  function texteDistance(d) { return d === null || d === undefined ? '—' : (isFinite(d) ? String(d) : '∞'); }
  function nomVille(v) { return '(' + v.i + ', ' + v.j + ')'; }

  /**
   * Modèle de présentation (sans DOM) :
   *  { explication, complet, blocages: [texte], lacunes: [texte], rangs: [{rang, d1, d2, ecart, fort, compte}],
   *    ecartRang (rangs 1 à 4, information), ecartMax7 (rangs 1 à 7), partage: {j1, j2, egalite}, tempo: [{pas, j1, j2}], premiere: {j1, j2, ecart},
   *    goulets: [{ville, j1, j2, faible}], articulations: {1: [texte], 2: [texte]}, alertes: [texte], informations: [texte],
   *    organique: [texte] (rythme, accès au centre, cases par moitié : information) }
   */
  function rapport(analyse) {
    var r = analyse.resultat, seuil = GR.SEUIL_ECART;
    var rangs = r.parRang.map(function (x) {
      return {
        rang: x.rang, d1: texteDistance(x.d1), d2: texteDistance(x.d2),
        ecart: x.ecart === null ? '—' : String(x.ecart), fort: x.ecart !== null && x.ecart > seuil, compte: x.compte
      };
    });
    var tempo = [3, 4, 5].map(function (n) { return { pas: n, j1: r.tempo[1][n], j2: r.tempo[2][n] }; });
    var g1 = analyse.goulets[1], g2 = analyse.goulets[2];
    var goulets = g1.parVille.map(function (v, k) {
      var c2 = g2.parVille[k] ? g2.parVille[k].chemins : 0;
      return { ville: nomVille(v), j1: v.chemins, j2: c2, faible: v.chemins <= 1 || c2 <= 1 };
    });
    function articulations(gj) {
      return gj.articulations.map(function (a) {
        var libelle = a.type === 'case' ? 'Une case' : (a.type === 'ville' ? 'Une ville' : 'Une case de jonction');
        return libelle + ' coupe ' + a.villesCoupees.length + ' ville(s) du joueur ' + GR.NOM_JOUEUR[gj.joueur] + ' : ' + a.villesCoupees.map(nomVille).join(', ') + '.';
      });
    }
    return {
      S: r.S, scoreTexte: r.S === null ? '—' : String(r.S), aSurveiller: !!r.aSurveiller, sInformation: !!r.sInformation,
      villesA4: { j1: r.villesA4[1], j2: r.villesA4[2], ecart: r.villesA4.ecart },
      explication: explicationDe(analyse.grille),
      seuilS: GR.seuilS(analyse.grille), seuilSInformation: GR.seuilSInformation(analyse.grille),
      complet: r.complet,
      blocages: r.blocages.map(function (b) { return b.message; }),
      lacunes: r.lacunes.slice(),
      rangs: rangs,
      ecartRang: r.ecartRang,
      ecartMax7: r.ecartMax7,
      partage: { j1: r.partage[1], j2: r.partage[2], egalite: r.partage.egalite },
      tempo: tempo,
      premiere: { j1: texteDistance(r.premiereVille[1]), j2: texteDistance(r.premiereVille[2]), ecart: texteDistance(r.premiereVille.ecart) },
      goulets: goulets,
      articulations: { 1: articulations(g1), 2: articulations(g2) },
      alertes: r.alertes.map(function (a) { return a.message; }),
      informations: (r.informations || []).map(function (a) { return a.message; }),
      organique: lignesOrganiques(analyse)
    };
  }

  /* ------------------------------------------------------------------ */
  /* Dessin                                                              */
  /* ------------------------------------------------------------------ */

  var cptId = 0;

  function el(doc, nom, classe, texte) {
    var e = doc.createElement(nom);
    if (classe) e.className = classe;
    if (texte !== undefined) e.textContent = texte;
    return e;
  }

  function tableau(doc, legende, entetes, lignes) {
    var t = el(doc, 'table', 'pm-equilibre-tableau');
    t.appendChild(el(doc, 'caption', 'pm-equilibre-legende', legende));
    var tete = el(doc, 'thead'), tr = el(doc, 'tr');
    entetes.forEach(function (h) { var th = el(doc, 'th', null, h); th.setAttribute('scope', 'col'); tr.appendChild(th); });
    tete.appendChild(tr);
    t.appendChild(tete);
    var corps = el(doc, 'tbody');
    lignes.forEach(function (l) {
      var ligne = el(doc, 'tr', l.classe || '');
      l.cellules.forEach(function (c, k) {
        var cel = el(doc, k === 0 ? 'th' : 'td', null, c);
        if (k === 0) cel.setAttribute('scope', 'row');
        ligne.appendChild(cel);
      });
      corps.appendChild(ligne);
    });
    t.appendChild(corps);
    return t;
  }

  function section(doc, titre) {
    var s = el(doc, 'section', 'pm-equilibre-section');
    s.appendChild(el(doc, 'h3', 'pm-equilibre-titre', titre));
    return s;
  }

  /** Dessine le rapport du document `docCourant` dans `conteneur` (vidé d'abord). */
  function dessiner(conteneur, docCourant) {
    var doc = conteneur.ownerDocument || document;
    while (conteneur.firstChild) conteneur.removeChild(conteneur.firstChild);
    var racine = el(doc, 'div', 'pm-equilibre');
    var m = rapport(analyser(docCourant));

    racine.appendChild(el(doc, 'p', 'pm-equilibre-explication', m.explication));

    // Ce qui manque
    if (!m.complet) {
      var manque = el(doc, 'div', 'pm-equilibre-manque');
      manque.setAttribute('role', 'note');
      manque.appendChild(el(doc, 'strong', null, 'Plateau incomplet : résultat partiel.'));
      var ul = el(doc, 'ul');
      m.lacunes.forEach(function (t) { ul.appendChild(el(doc, 'li', null, t)); });
      manque.appendChild(ul);
      racine.appendChild(manque);
    }

    // Plateau très déséquilibré (erreur, seulement sur un plateau complet)
    if (m.complet && m.blocages.length) {
      var sBloc = section(doc, 'Plateau très déséquilibré');
      var lBloc = el(doc, 'ul', 'pm-equilibre-alertes');
      m.blocages.forEach(function (t) { lBloc.appendChild(el(doc, 'li', 'pm-equilibre-alerte pm-equilibre-blocage', t)); });
      sBloc.appendChild(lBloc);
      racine.appendChild(sBloc);
    }

    // Alertes
    var sAlertes = section(doc, 'Alertes');
    if (m.alertes.length) {
      var lAl = el(doc, 'ul', 'pm-equilibre-alertes');
      m.alertes.forEach(function (t) { lAl.appendChild(el(doc, 'li', 'pm-equilibre-alerte', t)); });
      sAlertes.appendChild(lAl);
    } else {
      sAlertes.appendChild(el(doc, 'p', 'pm-equilibre-ok', m.complet ? 'Aucune alerte d\'équilibre.' : 'Aucune alerte sur les données disponibles.'));
    }
    racine.appendChild(sAlertes);

    // Informations (jamais des alertes)
    if (m.informations.length) {
      var sInfo = section(doc, 'Informations');
      var lInfo = el(doc, 'ul', 'pm-equilibre-informations');
      m.informations.forEach(function (t) { lInfo.appendChild(el(doc, 'li', 'pm-equilibre-note', t)); });
      sInfo.appendChild(lInfo);
      racine.appendChild(sInfo);
    }

    // Rythme, accès au centre, cases par moitié, connexions en 5×5 (information, docs/46, docs/53)
    if (m.organique.length) {
      var sOrg = section(doc, 'Rythme, accès et moitiés (information)');
      var lOrg = el(doc, 'ul', 'pm-equilibre-organique');
      m.organique.forEach(function (t) { lOrg.appendChild(el(doc, 'li', 'pm-equilibre-note', t)); });
      sOrg.appendChild(lOrg);
      racine.appendChild(sOrg);
    }

    // Distances triées
    var sDist = section(doc, 'Distances des villes (en pas), triées');
    if (m.rangs.length) {
      sDist.appendChild(tableau(doc, 'Distance de la k-ième ville la plus proche, par joueur. Écart mis en évidence au-delà de 2 (rangs 1 à 7).',
        ['Rang', 'Vert', 'Rouge', 'Écart'],
        m.rangs.map(function (x) {
          return { classe: x.fort ? 'pm-equilibre-ecart-fort' : '', cellules: [String(x.rang), x.d1, x.d2, x.ecart] };
        })));
      sDist.appendChild(el(doc, 'p', 'pm-equilibre-note', m.ecartMax7 === null
        ? 'Écart maximal aux rangs 1 à 7 : non calculable (ville manquante ou inaccessible).'
        : 'Écart maximal aux rangs 1 à 7 : ' + m.ecartMax7 + (m.ecartMax7 > GR.SEUIL_ECART ? ' (supérieur à ' + GR.SEUIL_ECART + ').' : '.')));
      var pS = el(doc, 'p', 'pm-equilibre-score' + (m.aSurveiller ? ' pm-equilibre-surveiller' : ''),
        'Score S (somme des écarts sur les 7 rangs) : ' + m.scoreTexte + (m.aSurveiller ? ' : à surveiller (' + m.seuilS + ' ou plus).' : (m.sInformation ? ' (information : à partir de ' + m.seuilSInformation + ', sans alerte).' : '.')));
      sDist.appendChild(pS);
    } else {
      sDist.appendChild(el(doc, 'p', 'pm-equilibre-note', 'Aucune distance à afficher : il faut des villes et des apparitions reliées.'));
    }
    racine.appendChild(sDist);

    // Partage, tempo, première ville
    var sPartage = section(doc, 'Partage et tempo');
    sPartage.appendChild(el(doc, 'p', null, 'Villes strictement plus proches du joueur vert : ' + m.partage.j1 +
      ' · du joueur rouge : ' + m.partage.j2 + ' · à égalité : ' + m.partage.egalite + '.'));
    sPartage.appendChild(tableau(doc, 'Villes atteignables en au plus n pas', ['Pas', 'Vert', 'Rouge'],
      m.tempo.map(function (t) { return { cellules: ['≤ ' + t.pas, String(t.j1), String(t.j2)] }; })));
    sPartage.appendChild(el(doc, 'p', 'pm-equilibre-note', 'Villes à au plus 4 pas : vert ' + m.villesA4.j1 + ', rouge ' + m.villesA4.j2 + ' (différence ' + m.villesA4.ecart + ', information).'));
    sPartage.appendChild(el(doc, 'p', 'pm-equilibre-note', 'Première ville : vert à ' + m.premiere.j1 + ' pas, rouge à ' +
      m.premiere.j2 + ' pas (écart ' + m.premiere.ecart + ').'));
    racine.appendChild(sPartage);

    // Goulets
    var sGoulets = section(doc, 'Goulets');
    if (m.goulets.length) {
      sGoulets.appendChild(tableau(doc, 'Chemins disjoints (sans case commune, hors cases d\'apparition) entre les apparitions du joueur et chaque ville. Un seul chemin = goulet.',
        ['Ville (i, j)', 'Vert', 'Rouge'],
        m.goulets.map(function (x) { return { classe: x.faible ? 'pm-equilibre-goulet' : '', cellules: [x.ville, String(x.j1), String(x.j2)] }; })));
      var arts = m.articulations[1].concat(m.articulations[2]);
      if (arts.length) {
        var lArt = el(doc, 'ul', 'pm-equilibre-articulations');
        arts.forEach(function (t) { lArt.appendChild(el(doc, 'li', null, t)); });
        sGoulets.appendChild(lArt);
      } else {
        sGoulets.appendChild(el(doc, 'p', 'pm-equilibre-note', 'Aucun point d\'articulation.'));
      }
    } else {
      sGoulets.appendChild(el(doc, 'p', 'pm-equilibre-note', 'Aucune ville posée.'));
    }
    racine.appendChild(sGoulets);

    conteneur.appendChild(racine);
    return racine;
  }

  /** Dessine le rapport d'un document fixe dans `conteneur` (page d'essai, tests). */
  function remplir(conteneur, docPlateau) {
    return dessiner(conteneur, docPlateau);
  }

  /** Ouvre le rapport dans la boîte de dialogue commune. Lecture seule. */
  function ouvrir(etat) {
    var contenu = PM.dialogue.ouvrir('Rapport d\'équilibre');
    return dessiner(contenu, etat.doc());
  }

  PM.equilibre = { analyser: analyser, rapport: rapport, remplir: remplir, ouvrir: ouvrir, EXPLICATION: EXPLICATION, explication: explicationDe };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.equilibre;
})();
