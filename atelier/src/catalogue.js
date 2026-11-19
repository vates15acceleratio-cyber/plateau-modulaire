/*
 * catalogue.js : DONNÉES de l'atelier (catalogue des pièces, réserve d'événements, réglages).
 * Aucun accès au DOM, aucune dépendance. Source : docs/02-atelier-cahier-des-charges.md, §1 et §2.
 *
 * Tout ce qui est ici est PROVISOIRE (à valider par l'utilisateur) :
 *  - MODELES    : les 13 modèles de pièces (64 pièces, 91 cases) ;
 *  - EVENEMENTS : la réserve de 8 tuiles d'événement (uniques, posées par-dessus une case) ;
 *  - REGLAGES   : coûts en rations, seuil et mesure de contact, villes, trous, réglages du générateur, bornes des fichiers.
 *
 * Ce qui se change ICI SEULEMENT (plateau, contrôles, inventaire, retouche à la main et générateur suivent) :
 *  - les noms ; les coûts en rations ; le seuil et la mesure de contact ; l'écart entre villes ; le niveau du constat « trous » ;
 *  - la condition de pose et le terrain produit par un événement existant ;
 *  - le nombre de plaines, de forêts et de marais d'une case (P, F, S), tant que le total des cases reste celui de
 *    l'hexagone de départ (rayon 5 = 91 cases) ;
 *  - la forme ou le terrain des monoblocs existants, tant que chaque pièce de forêt garde la forme de sa jumelle de marais.
 *
 * Ce qui demande D'ADAPTER AUSSI src/generateur.js (sinon « Générer » échoue tout de suite, avec un message qui nomme la
 * cause ; la retouche à la main et les contrôles, eux, continuent de marcher) :
 *  - le nombre total de cases (ou le réglage generateur.rayon) ;
 *  - le nombre de villes d'une case (le générateur pose 2 villes en haut, 2 en bas, 2 neutres) et villesParCamp ;
 *  - l'ajout, le retrait ou le nombre d'exemplaires d'un monobloc, d'une montagne ou du noyau (le générateur connaît
 *    N1, M4, M5 et les paires F3 / S3, F31 / S31, F21 / S21, en un exemplaire chacun) ;
 *  - un nouveau modèle d'une case autre que V, P, F, S.
 *
 * Ce qui demande de modifier AUSSI d'autres fichiers :
 *  - ajouter ou retirer un événement : sa carte dans src/cartes.js (liste EVENEMENTS, même identifiant), et pour un
 *    nouveau terrain son coût dans REGLAGES.couts et son motif dans src/rendu.js.
 *
 * Une forme est une liste de cases en coordonnées axiales relatives à l'ancre (0,0) de la pièce.
 * Terrains de base : 'plaine', 'foret', 'marais', 'ville', 'montagne'.
 * Terrains créés par un événement : 'boue', 'crevasse', 'tunnel', 'terre_brulee', 'eboulement', 'chaussee', 'campement'.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  // Formes communes (cahier des charges §2).
  var TRIANGLE = [[0, 0], [1, 0], [0, 1]];
  var LOSANGE = [[0, 0], [1, 0], [0, 1], [1, 1]];
  var COUDE = [[0, 0], [1, 0], [1, 1]];

  /** Associe une forme à une liste de terrains (même ordre). */
  function forme(points, terrains) {
    return points.map(function (p, i) {
      return { q: p[0], r: p[1], terrain: typeof terrains === 'string' ? terrains : terrains[i] };
    });
  }

  var MODELES = {
    N1: { id: 'N1', nom: 'Noyau', nombre: 1, noyau: true,
      cases: forme([[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]],
        ['ville', 'plaine', 'plaine', 'plaine', 'plaine', 'plaine', 'plaine']) },
    M4: { id: 'M4', nom: 'Montagne zigzag', nombre: 1, cases: forme([[0, 0], [1, 0], [1, 1], [2, 1]], 'montagne') },
    M5: { id: 'M5', nom: 'Montagne peigne', nombre: 1, cases: forme([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]], 'montagne') },
    V: { id: 'V', nom: 'Ville', nombre: 6, cases: forme([[0, 0]], 'ville') },
    F3: { id: 'F3', nom: 'Bois', nombre: 1, cases: forme(TRIANGLE, 'foret') },
    F31: { id: 'F31', nom: 'Lisière', nombre: 1, cases: forme(LOSANGE, ['foret', 'plaine', 'plaine', 'plaine']) },
    F21: { id: 'F21', nom: 'Bosquet', nombre: 1, cases: forme(COUDE, ['foret', 'foret', 'plaine']) },
    S3: { id: 'S3', nom: 'Marécage', nombre: 1, cases: forme(TRIANGLE, 'marais') },
    S31: { id: 'S31', nom: 'Mare', nombre: 1, cases: forme(LOSANGE, ['marais', 'plaine', 'plaine', 'plaine']) },
    S21: { id: 'S21', nom: 'Roselière', nombre: 1, cases: forme(COUDE, ['marais', 'marais', 'plaine']) },
    P: { id: 'P', nom: 'Plaine', nombre: 39, cases: forme([[0, 0]], 'plaine') },
    F: { id: 'F', nom: 'Forêt', nombre: 5, cases: forme([[0, 0]], 'foret') },
    S: { id: 'S', nom: 'Marais', nombre: 5, cases: forme([[0, 0]], 'marais') }
  };

  /** Ordre d'affichage des modèles. */
  var ORDRE_MODELES = ['N1', 'M4', 'M5', 'V', 'F3', 'F31', 'F21', 'S3', 'S31', 'S21', 'P', 'F', 'S'];

  /*
   * Réserve d'événements. `sur` = condition de pose sur le terrain d'ORIGINE de la case :
   *   terrains      : liste des terrains acceptés (absent = tout terrain) ;
   *   franchissable : true = la case doit être franchissable ;
   *   voisineDe     : la case doit toucher au moins une case de ce terrain.
   * `terrain` = terrain effectif de la case une fois recouverte (son coût est dans REGLAGES.couts).
   */
  var EVENEMENTS = {
    E1: { id: 'E1', nom: 'Torrent de boue', sur: { terrains: ['plaine', 'foret'] }, terrain: 'boue', effet: 'Boue : coût 3.' },
    E2: { id: 'E2', nom: 'Crevasse', sur: { terrains: ['plaine'] }, terrain: 'crevasse', effet: 'Infranchissable.' },
    E3: { id: 'E3', nom: 'Tunnel', sur: { terrains: ['montagne'] }, terrain: 'tunnel', effet: 'Franchissable, coût 2.' },
    E4: { id: 'E4', nom: 'Incendie', sur: { terrains: ['foret'] }, terrain: 'terre_brulee', effet: 'Terre brûlée : coût 1.' },
    E5: { id: 'E5', nom: 'Inondation', sur: { terrains: ['plaine'] }, terrain: 'marais', effet: 'Marais : coût 2.' },
    E6: { id: 'E6', nom: 'Éboulement', sur: { franchissable: true, voisineDe: 'montagne' }, terrain: 'eboulement', effet: 'Infranchissable.' },
    E7: { id: 'E7', nom: 'Chaussée', sur: { terrains: ['marais'] }, terrain: 'chaussee', effet: 'Coût 1.' },
    E8: { id: 'E8', nom: 'Campement abandonné', sur: { terrains: ['plaine'] }, terrain: 'campement', effet: 'Campement : on y pioche une carte Campement.' }
  };

  var ORDRE_EVENEMENTS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'];

  /* Tous les réglages provisoires. `null` dans les coûts = infranchissable. */
  var REGLAGES = {
    couts: {
      plaine: 1, foret: 2, marais: 2, ville: 1, montagne: null,
      boue: 3, crevasse: null, tunnel: 2, terre_brulee: 1, eboulement: null, chaussee: 1, campement: 1
    },
    // A6 : chaque tuile touche au moins `seuilContact` autres tuiles, selon la mesure retenue.
    seuilContact: 3,
    seuilsContact: [2, 3],
    mesureContact: 'cotes',                 // 'cotes' (cases voisines occupées par une autre pièce) ou 'pieces' (pièces voisines distinctes)
    mesuresContact: ['cotes', 'pieces'],
    // Villes.
    nombreVilles: 7,
    villesParCamp: 2,                       // villes de déploiement par joueur, sur la rangée extrême
    ecartVilles: 4,                         // pas au moins entre deux villes (4 pas = 3 tuiles entre elles)
    // Répartition visée des terrains hors villes et montagnes, en pourcentage (affichage seulement).
    repartitionVisee: { plaine: 70, foret: 15, marais: 15 },
    // Événements : jamais sur ces terrains d'origine, jamais sur le noyau.
    evenementsInterditsSur: ['ville'],
    evenementsInterditsSurNoyau: true,
    // Trou (case vide entièrement entourée par le plateau) : niveau du constat du contrôle 2.
    // 'alerte' en attendant la décision de l'utilisateur ; 'erreur' pour les interdire ; 'ignore' pour ne rien dire.
    trous: 'alerte',
    niveauxTrous: ['alerte', 'erreur', 'ignore'],
    // Générateur (§4).
    generateur: {
      rayon: 5,                             // hexagone de départ : rayon 5 = 91 cases
      retouches: 3,                         // paires de cases retirées puis ajoutées sur le bord (symétrie par demi-tour)
      essaisForme: 600,                     // tirages de forme au plus avant de déclarer l'échec « forme »
      formes: 3,                            // formes essayées au plus pour une graine (on change de forme seulement si rien ne passe)
      tentatives: 24,                       // essais de remplissage par forme
      echanges: 250,                        // échanges de tuiles simples par essai pour améliorer l'équilibre
      montagnesRayonMax: 4,                 // les montagnes ne touchent pas le bord de l'hexagone de départ
      montagnesEcart: 2                     // distance minimale entre deux blocs de montagne (2 = une case entre eux)
    },
    // Bornes de validation d'un plateau lu dans un fichier.
    bornes: { coordonnee: 30, pieces: 200, recouvrements: 16, longueurGraine: 64, longueurId: 16, tailleFichier: 200000 }
  };

  var possede = Object.prototype.hasOwnProperty;

  /** Modèle de pièce par identifiant, ou null (identifiant inconnu, y compris '__proto__' et compagnie). */
  function modele(id) { return (typeof id === 'string' && possede.call(MODELES, id)) ? MODELES[id] : null; }

  /** Événement par identifiant, ou null. */
  function evenement(id) { return (typeof id === 'string' && possede.call(EVENEMENTS, id)) ? EVENEMENTS[id] : null; }

  /** Vrai si le modèle est un monobloc (plusieurs cases). */
  function estMonobloc(m) { return !!m && m.cases.length > 1; }

  /** Coût en rations pour entrer dans une case de ce terrain ; Infinity si infranchissable ou inconnu. */
  function coutTerrain(terrain, couts) {
    var table = couts || REGLAGES.couts;
    var v = possede.call(table, terrain) ? table[terrain] : null;
    return (typeof v === 'number' && v >= 0) ? v : Infinity;
  }

  /** Totaux du catalogue : {pieces, cases, parTerrain: {terrain: nombre de cases}}. */
  function totaux() {
    var pieces = 0, cases = 0, parTerrain = {};
    ORDRE_MODELES.forEach(function (id) {
      var m = MODELES[id];
      pieces += m.nombre;
      cases += m.nombre * m.cases.length;
      m.cases.forEach(function (c) { parTerrain[c.terrain] = (parTerrain[c.terrain] || 0) + m.nombre; });
    });
    return { pieces: pieces, cases: cases, parTerrain: parTerrain };
  }

  /** Règle A2 sur le catalogue : identifiants des monoblocs hors noyau qui contiennent une ville (liste vide = conforme). */
  function monoblocsAvecVille() {
    return ORDRE_MODELES.filter(function (id) {
      var m = MODELES[id];
      return estMonobloc(m) && !m.noyau && m.cases.some(function (c) { return c.terrain === 'ville'; });
    });
  }

  AT.catalogue = {
    MODELES: MODELES, ORDRE_MODELES: ORDRE_MODELES, EVENEMENTS: EVENEMENTS, ORDRE_EVENEMENTS: ORDRE_EVENEMENTS,
    REGLAGES: REGLAGES,
    modele: modele, evenement: evenement, estMonobloc: estMonobloc, coutTerrain: coutTerrain,
    totaux: totaux, monoblocsAvecVille: monoblocsAvecVille
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.catalogue;
})();
