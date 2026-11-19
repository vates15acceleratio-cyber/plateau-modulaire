/*
 * catalogue.js : DONNÉES de l'atelier (catalogue des pièces, réserve d'événements, réglages).
 * Aucun accès au DOM, aucune dépendance. Source : docs/02-atelier-cahier-des-charges.md, §9 (catalogue 2),
 * mesures dans docs/07-mesures-catalogue-2.md.
 *
 * Tout ce qui est ici est PROVISOIRE (à valider par l'utilisateur) :
 *  - MODELES    : le catalogue 2. Noyau, 2 montagnes, 21 monoblocs de terrain de 3 ou 4 cases (75 cases : 53 plaines,
 *                 11 forêts, 11 marais), 2 tuiles de remplissage (facultatives), 2 villes neutres ;
 *  - VILLE_DEPLOIEMENT : la tuile de ville de déploiement, posée par-dessus une Plaine (4 tuiles, 2 par joueur) ;
 *  - MODELES_HORS_CATALOGUE : M1 (pinceau) et les tuiles d'une case du premier catalogue (P, F, S, V), gardées
 *                 lisibles pour les anciens fichiers ;
 *  - EVENEMENTS : la réserve de 8 tuiles d'événement (uniques, posées par-dessus une case) ;
 *  - REGLAGES   : coûts en rations, seuils de contact, villes, trous, réglages du générateur, bornes des fichiers,
 *                 des pièces personnelles et de la bibliothèque.
 *
 * Ce qui se change ICI SEULEMENT (plateau, contrôles, inventaire, création à la main et générateur suivent) :
 *  - les noms ; les coûts en rations ; les seuils de contact ; l'écart entre villes ; la profondeur des extrémités ;
 *    le niveau du constat « trous » ; la condition de pose et le terrain produit par un événement existant ;
 *  - la forme, les terrains et le nombre d'exemplaires d'un monobloc de terrain ou d'une montagne ; l'ajout ou le
 *    retrait d'un monobloc (rôle 'terrain' ou 'montagne') : le générateur pose tout ce que le catalogue contient ;
 *  - le nombre de tuiles de remplissage.
 * Les identifiants F3, F31, F21, S3, S31, S21 existaient dans le premier catalogue : leurs cases ne doivent pas
 * changer (un test le fige), sinon les anciens plateaux ne se rouvrent plus à l'identique.
 *
 * Ce qui demande de modifier AUSSI d'autres fichiers :
 *  - le nombre de villes (2 de déploiement par joueur, 1 neutre par flanc) : src/plateau.js, src/controles.js,
 *    src/generateur.js ;
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

  // Formes de 3 cases : triangle, ligne, coude. Formes de 4 cases : losange, zigzag, arc, étoile, crosse, pistolet.
  var TRIANGLE = [[0, 0], [1, 0], [0, 1]];
  var LIGNE = [[0, 0], [1, 0], [2, 0]];
  var COUDE = [[0, 0], [1, 0], [1, 1]];
  var LOSANGE = [[0, 0], [1, 0], [0, 1], [1, 1]];
  var ZIGZAG = [[0, 0], [1, 0], [1, 1], [2, 1]];
  var ARC = [[0, 0], [1, 0], [1, 1], [0, 2]];
  var ETOILE = [[0, 0], [1, 0], [-1, 1], [0, -1]];
  var CROSSE = [[0, 0], [1, 0], [2, 0], [2, 1]];
  var PISTOLET = [[0, 0], [1, 0], [2, 0], [1, 1]];

  /** Associe une forme à une liste de terrains (même ordre). */
  function forme(points, terrains) {
    return points.map(function (p, i) {
      return { q: p[0], r: p[1], terrain: typeof terrains === 'string' ? terrains : terrains[i] };
    });
  }

  var PL = 'plaine', FO = 'foret', MA = 'marais';

  /*
   * CATALOGUE 2 (§9.2). `role` : 'noyau' | 'montagne' | 'terrain' (monobloc de 3 ou 4 cases) | 'remplissage' | 'ville'.
   * `facultatif` : la pièce peut rester dans la boîte sans que le plateau soit incomplet (tuiles de remplissage).
   * Les six monoblocs F3, F31, F21, S3, S31, S21 gardent EXACTEMENT les cases du premier catalogue (anciens fichiers).
   */
  var MODELES = {
    N1: { id: 'N1', nom: 'Noyau', nombre: 1, noyau: true, role: 'noyau',
      cases: forme([[0, 0], [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]],
        ['ville', 'plaine', 'plaine', 'plaine', 'plaine', 'plaine', 'plaine']) },
    M4: { id: 'M4', nom: 'Montagne zigzag', nombre: 1, role: 'montagne', cases: forme(ZIGZAG, 'montagne') },
    M5: { id: 'M5', nom: 'Montagne peigne', nombre: 1, role: 'montagne', cases: forme([[0, 0], [1, 0], [2, 0], [0, 1], [1, 1]], 'montagne') },
    // 12 monoblocs de 4 cases.
    P4A: { id: 'P4A', nom: 'Pré en losange', nombre: 1, role: 'terrain', cases: forme(LOSANGE, PL) },
    P4B: { id: 'P4B', nom: 'Pré en zigzag', nombre: 1, role: 'terrain', cases: forme(ZIGZAG, PL) },
    P4C: { id: 'P4C', nom: 'Pré en arc', nombre: 1, role: 'terrain', cases: forme(ARC, PL) },
    P4D: { id: 'P4D', nom: 'Pré en étoile', nombre: 1, role: 'terrain', cases: forme(ETOILE, PL) },
    P4E: { id: 'P4E', nom: 'Pré en crosse', nombre: 1, role: 'terrain', cases: forme(CROSSE, PL) },
    F31: { id: 'F31', nom: 'Lisière', nombre: 1, role: 'terrain', cases: forme(LOSANGE, [FO, PL, PL, PL]) },
    F31B: { id: 'F31B', nom: 'Orée', nombre: 1, role: 'terrain', cases: forme(PISTOLET, [PL, PL, PL, FO]) },
    S31: { id: 'S31', nom: 'Mare', nombre: 1, role: 'terrain', cases: forme(LOSANGE, [MA, PL, PL, PL]) },
    S31B: { id: 'S31B', nom: 'Gué', nombre: 1, role: 'terrain', cases: forme(ARC, [MA, PL, PL, PL]) },
    F22: { id: 'F22', nom: 'Futaie', nombre: 1, role: 'terrain', cases: forme(ZIGZAG, [FO, FO, PL, PL]) },
    S22: { id: 'S22', nom: 'Tourbière', nombre: 1, role: 'terrain', cases: forme(CROSSE, [PL, PL, MA, MA]) },
    FS4: { id: 'FS4', nom: 'Bocage', nombre: 1, role: 'terrain', cases: forme(ETOILE, [PL, FO, MA, PL]) },
    // 9 monoblocs de 3 cases.
    P3A: { id: 'P3A', nom: 'Pré en triangle', nombre: 1, role: 'terrain', cases: forme(TRIANGLE, PL) },
    P3B: { id: 'P3B', nom: 'Pré en ligne', nombre: 1, role: 'terrain', cases: forme(LIGNE, PL) },
    P3C: { id: 'P3C', nom: 'Pré en coude', nombre: 1, role: 'terrain', cases: forme(COUDE, PL) },
    F3: { id: 'F3', nom: 'Bois', nombre: 1, role: 'terrain', cases: forme(TRIANGLE, FO) },
    S3: { id: 'S3', nom: 'Marécage', nombre: 1, role: 'terrain', cases: forme(TRIANGLE, MA) },
    F21: { id: 'F21', nom: 'Bosquet', nombre: 1, role: 'terrain', cases: forme(COUDE, [FO, FO, PL]) },
    S21: { id: 'S21', nom: 'Roselière', nombre: 1, role: 'terrain', cases: forme(COUDE, [MA, MA, PL]) },
    F12: { id: 'F12', nom: 'Clairière', nombre: 1, role: 'terrain', cases: forme(LIGNE, [PL, FO, PL]) },
    S12: { id: 'S12', nom: 'Étang', nombre: 1, role: 'terrain', cases: forme(TRIANGLE, [MA, PL, PL]) },
    // Tuiles d'une case : remplissage (l'exception, B2) et villes neutres (B5).
    R: { id: 'R', nom: 'Remplissage', nombre: 2, role: 'remplissage', facultatif: true, cases: forme([[0, 0]], PL) },
    VN: { id: 'VN', nom: 'Ville neutre', nombre: 2, role: 'ville', cases: forme([[0, 0]], 'ville') }
  };

  /** Ordre d'affichage des modèles du catalogue imprimé. */
  var ORDRE_MODELES = ['N1', 'M4', 'M5',
    'P4A', 'P4B', 'P4C', 'P4D', 'P4E', 'F31', 'F31B', 'S31', 'S31B', 'F22', 'S22', 'FS4',
    'P3A', 'P3B', 'P3C', 'F3', 'S3', 'F21', 'S21', 'F12', 'S12', 'R', 'VN'];

  /**
   * Ville de déploiement (B4) : une tuile posée PAR-DESSUS une case de Plaine, avec un propriétaire. Ce n'est pas une
   * pièce du plateau (champ `deploiements` du document) ; `nombre` tuiles au catalogue, `parCamp` par joueur.
   */
  var VILLE_DEPLOIEMENT = { id: 'VD', nom: 'Ville de déploiement', nombre: 4, parCamp: 2, camps: ['vert', 'rouge'] };

  /*
   * Modèles de base HORS CATALOGUE IMPRIMÉ : connus de modele(), posables seulement « hors stock » (quantité 0),
   * jamais comptés dans les totaux ni dans ORDRE_MODELES, ignorés du générateur.
   *  - M1 sert au pinceau ; la décision en vigueur reste « montagnes en blocs de 4 ou 5 cases » (le contrôle 1 le rappelle) ;
   *  - P, F, S, V : tuiles d'une case du PREMIER catalogue (`ancien: true`). Elles restent lisibles pour que les
   *    plateaux, parties et bibliothèques déjà enregistrés s'ouvrent toujours ; le pinceau pose encore P, F et S.
   */
  var MODELES_HORS_CATALOGUE = {
    M1: { id: 'M1', nom: 'Montagne d’une case', nombre: 0, horsCatalogue: true, cases: forme([[0, 0]], 'montagne') },
    P: { id: 'P', nom: 'Plaine', nombre: 0, horsCatalogue: true, ancien: true, cases: forme([[0, 0]], PL) },
    F: { id: 'F', nom: 'Forêt', nombre: 0, horsCatalogue: true, ancien: true, cases: forme([[0, 0]], FO) },
    S: { id: 'S', nom: 'Marais', nombre: 0, horsCatalogue: true, ancien: true, cases: forme([[0, 0]], MA) },
    V: { id: 'V', nom: 'Ville (ancien catalogue)', nombre: 0, horsCatalogue: true, ancien: true, cases: forme([[0, 0]], 'ville') }
  };
  var ORDRE_HORS_CATALOGUE = ['M1', 'P', 'F', 'S', 'V'];

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
    // B7 : chaque monobloc touche au moins `seuilContact` autres tuiles, selon la mesure retenue.
    seuilContact: 3,
    // Seuil propre d'une tuile de remplissage (mesuré : une tuile seule au bord touche souvent 2 pièces seulement).
    seuilContactRemplissage: 2,
    seuilsContact: [2, 3],
    mesureContact: 'pieces',                // 'cotes' (cases voisines occupées par une autre pièce) ou 'pieces' (pièces voisines distinctes)
    mesuresContact: ['cotes', 'pieces'],
    // Villes.
    nombreVilles: 7,                        // le centre, 2 de déploiement par joueur, 2 neutres
    villesParCamp: 2,                       // villes de déploiement par joueur
    ecartVilles: 4,                         // pas au moins entre deux villes (4 pas = 3 cases entre elles)
    // Phase « villes » (§9.1, B4 et B5).
    villes: {
      profondeurExtremite: 2,               // rangées du haut (Vert) ou du bas (Rouge) où se pose une ville de déploiement
      profondeursExtremite: [1, 2, 3],      // valeurs permises (réglage de l'étape « Villes », champ `profondeurExtremite` d'un fichier)
      neutresTiersCentral: true,            // une ville neutre se pose dans le tiers central des rangées
      contactVilleNeutre: 2                 // cases du plateau qu'une ville neutre doit toucher au moins
    },
    // Répartition visée des terrains hors villes et montagnes, en pourcentage (affichage seulement).
    repartitionVisee: { plaine: 70, foret: 15, marais: 15 },
    // Événements : jamais sur ces terrains d'origine, jamais sur le noyau.
    evenementsInterditsSur: ['ville'],
    evenementsInterditsSurNoyau: true,
    // Trou (case vide entièrement entourée par le plateau) : niveau du constat du contrôle 2.
    // 'alerte' en attendant la décision de l'utilisateur ; 'erreur' pour les interdire ; 'ignore' pour ne rien dire.
    trous: 'alerte',
    niveauxTrous: ['alerte', 'erreur', 'ignore'],
    // Générateur (§9.4) : il construit le terrain pièce après pièce, comme des joueurs, puis pose les villes.
    generateur: {
      rayon: 5,                             // cadre affiché autour du noyau (un plateau tient à peu près dans ce rayon)
      demiHauteur: 5,                       // le plateau tient dans les rangées -5 à +5 (bords haut et bas plats) ; null : libre
      remplissages: 0,                      // tuiles de remplissage que le générateur a le droit de poser (0 à MODELES.R.nombre)
      tentatives: 30,                       // constructions essayées au plus pour une graine
      compacite: 1.2,                       // poids de la distance au centre (plus grand = plateau plus rond)
      fantaisie: 3,                         // part de hasard dans le choix d'une pose (plus grand = bord plus découpé)
      etirement: 0.25,                      // le plateau est tiré au sort plus large ou plus haut, dans cette proportion
      montagnesEcart: 2,                    // distance minimale entre deux blocs de montagne (2 = une case entre eux)
      reprises: 30,                         // monoblocs repris et reposés au plus, quand ils ne touchent pas assez de pièces
      remplissageTot: false                 // true : combler tout de suite une case enfermée plutôt que poser sous le seuil
    },
    // Bornes de validation d'un plateau lu dans un fichier.
    bornes: { coordonnee: 30, pieces: 200, recouvrements: 16, deploiements: 8, longueurGraine: 64, longueurId: 16, tailleFichier: 200000 },
    // Pièces personnelles portées par le document du plateau (§8.1). Jamais de ville (règle A2).
    perso: {
      casesMin: 2, casesMax: 6,             // cases d'une pièce personnelle, d'un seul tenant, case (0,0) comprise
      quantiteMax: 9,                       // exemplaires d'une pièce personnelle (1 au moins)
      modelesMax: 24,                       // pièces personnelles dans un document
      longueurNom: 40,                      // caractères du nom (1 au moins)
      chiffresId: 4,                        // identifiant : « X » suivi de 1 à 4 chiffres, sans zéro en tête
      terrains: ['plaine', 'foret', 'marais', 'montagne']
    },
    // Pinceau (§8.2, §9.4) : modèle d'une case posé pour chaque terrain, toujours hors catalogue (sauf une Plaine,
    // prise d'abord parmi les tuiles de remplissage en stock). Les villes se posent par les outils de la phase « villes ».
    pinceau: { plaine: 'P', foret: 'F', marais: 'S', montagne: 'M1' },
    pinceauRemplissage: 'R',
    // Bibliothèque de plateaux (§8.1) : bornes de ce qui est lu ou écrit dans le stockage du navigateur.
    bibliotheque: {
      prefixe: 'atelier-plateau:',          // préfixe des clés du stockage
      plateauxMax: 40,                      // plateaux enregistrés au plus
      longueurNom: 60,                      // caractères du nom d'un plateau (1 au moins)
      tailleMax: 4000000                    // caractères du texte de la bibliothèque (lecture, écriture, import)
    }
  };

  var possede = Object.prototype.hasOwnProperty;

  /**
   * Modèle de pièce DE BASE par identifiant (catalogue imprimé ou hors catalogue), ou null (identifiant inconnu,
   * y compris '__proto__' et compagnie). Les pièces personnelles d'un document se cherchent par AT.plateau.modele.
   */
  function modele(id) {
    if (typeof id !== 'string') return null;
    if (possede.call(MODELES, id)) return MODELES[id];
    return possede.call(MODELES_HORS_CATALOGUE, id) ? MODELES_HORS_CATALOGUE[id] : null;
  }

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

  /**
   * Totaux du catalogue imprimé : {pieces, cases, parTerrain: {terrain: nombre de cases}, facultatives, construction:
   * {pieces, cases}}. `facultatives` : pièces qui peuvent rester dans la boîte (remplissages) ; `construction` : les
   * pièces qu'un plateau construit doit toutes porter (noyau, montagnes, monoblocs de terrain), sans villes ni remplissages.
   * Les tuiles de ville de déploiement (VILLE_DEPLOIEMENT), posées par-dessus, ne sont pas comptées ici.
   */
  function totaux() {
    var pieces = 0, cases = 0, parTerrain = {}, facultatives = 0, construction = { pieces: 0, cases: 0 };
    ORDRE_MODELES.forEach(function (id) {
      var m = MODELES[id];
      pieces += m.nombre;
      cases += m.nombre * m.cases.length;
      if (m.facultatif) facultatives += m.nombre;
      if (estConstruction(m)) { construction.pieces += m.nombre; construction.cases += m.nombre * m.cases.length; }
      m.cases.forEach(function (c) { parTerrain[c.terrain] = (parTerrain[c.terrain] || 0) + m.nombre; });
    });
    return { pieces: pieces, cases: cases, parTerrain: parTerrain, facultatives: facultatives, construction: construction };
  }

  /** Vrai si le modèle est une pièce obligatoire de la phase de construction : noyau, montagne ou monobloc de terrain. */
  function estConstruction(m) { return !!m && (m.role === 'noyau' || m.role === 'montagne' || m.role === 'terrain'); }

  /** Identifiants des modèles du catalogue imprimé qui ont ce rôle. */
  function idsParRole(role) { return ORDRE_MODELES.filter(function (id) { return MODELES[id].role === role; }); }

  /** Règle A2 sur le catalogue : identifiants des monoblocs hors noyau qui contiennent une ville (liste vide = conforme). */
  function monoblocsAvecVille() {
    return ORDRE_MODELES.filter(function (id) {
      var m = MODELES[id];
      return estMonobloc(m) && !m.noyau && m.cases.some(function (c) { return c.terrain === 'ville'; });
    });
  }

  AT.catalogue = {
    MODELES: MODELES, ORDRE_MODELES: ORDRE_MODELES,
    MODELES_HORS_CATALOGUE: MODELES_HORS_CATALOGUE, ORDRE_HORS_CATALOGUE: ORDRE_HORS_CATALOGUE,
    VILLE_DEPLOIEMENT: VILLE_DEPLOIEMENT, VERSION: 2,
    EVENEMENTS: EVENEMENTS, ORDRE_EVENEMENTS: ORDRE_EVENEMENTS,
    REGLAGES: REGLAGES,
    modele: modele, evenement: evenement, estMonobloc: estMonobloc, coutTerrain: coutTerrain,
    totaux: totaux, monoblocsAvecVille: monoblocsAvecVille, estConstruction: estConstruction, idsParRole: idsParRole
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.catalogue;
})();
