/*
 * cartes.js : DONNÉES des cartes de la table de jeu (lot B). Aucun accès au DOM, aucune dépendance.
 *
 *  - REGLAGES : tous les réglages provisoires de la table (modifiables).
 *  - CAMPEMENTS : les 15 cartes Campement de l'annexe 2 des règles V2.3, texte EXACT, avec leur signe.
 *    (Dans les règles elles sont « à valider » : le texte est repris mot pour mot, rien n'est ajouté.)
 *  - EVENEMENTS : une carte par tuile de la réserve d'événements du cahier des charges (§2), PROVISOIRE.
 *  - TROUPES : jeu de Troupes PROVISOIRE, inventé pour pouvoir composer un deck de test. Ce ne sont pas
 *    des règles : les règles V2.3 n'ont pas encore de liste de Troupes (annexe 1 « à venir »).
 *    Aucun effet de Troupe n'est défini ici.
 *
 * Les fonctions renvoient toujours des copies : les tableaux de données ne sont pas modifiables de l'extérieur.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  /**
   * Réglages de la table. Tous sont des paramètres, pas des règles enfouies dans le code :
   * `AT.partie.creer` en prend une copie (complétée par `options.reglages`) et l'enregistre dans la partie.
   */
  var REGLAGES = {
    tailleMain: 5,              // main limitée à 5 : à 5 cartes, aucune pioche ne s'effectue (règles V2.3)
    gloireVictoire: 15,         // victoire signalée à 15 points de Gloire (règles V2.3)
    bataillonsParJoueur: 4,     // 4 pions Bataillon par joueur (règles V2.3)
    troupesParBataillon: 3,     // 1 à 3 Troupes par bataillon (règles V2.3)
    actionsParTour: 2,          // 2 actions par tour, comptées pour aider (règles V2.3)
    mainDeDepart: 2,            // chacun pioche 2 cartes à la mise en place (règles V2.3)
    piocheDebutTour: 1,         // 1 carte piochée au début de chaque tour, dès le premier (règles V2.3)
    tailleDeck: 20,             // PROVISOIRE : taille du deck de test de chaque joueur
    premierJoueur: 'vert',      // PROVISOIRE : paramètre (les règles désignent le premier joueur hors du jeu)
    desMax: 30,                 // PROVISOIRE : nombre maximal de dés lancés d'un coup
    tailleHistorique: 200       // PROVISOIRE : nombre d'états gardés pour annuler / rétablir
  };

  /** Les deux joueurs : Vert au nord, Rouge au sud. */
  var JOUEURS = ['vert', 'rouge'];

  /** Les 15 cartes Campement (annexe 2 des règles V2.3). Signe : '+' avantageux, '=' neutre, '−' pénalisant. */
  var CAMPEMENTS = [
    { id: 'C1', numero: 1, signe: '+', texte: 'Piochez 1 carte.' },
    { id: 'C2', numero: 2, signe: '+', texte: 'Regardez les 3 premières cartes de votre pioche, prenez-en 1 en main, remettez les 2 autres dessus dans l’ordre de votre choix.' },
    { id: 'C3', numero: 3, signe: '+', texte: 'Reprenez en main la carte du dessus de votre défausse.' },
    { id: 'C4', numero: 4, signe: '+', texte: 'Prenez au hasard 1 carte de la main adverse et mettez-la dans sa défausse.' },
    { id: 'C5', numero: 5, signe: '+', texte: 'Piochez 2 cartes. Défaussez 1 carte de votre main.' },
    { id: 'C6', numero: 6, signe: '+', texte: 'L’adversaire défausse 1 carte de son choix dans sa main.' },
    { id: 'C7', numero: 7, signe: '=', texte: 'Chaque joueur pioche 1 carte.' },
    { id: 'C8', numero: 8, signe: '=', texte: 'Défaussez autant de cartes de votre main que vous voulez, puis piochez autant de cartes.' },
    { id: 'C9', numero: 9, signe: '=', texte: 'Mélangez votre défausse dans votre pioche.' },
    { id: 'C10', numero: 10, signe: '=', texte: 'Lancez 1 dé. De 1 à 3 : défaussez 1 carte de votre main. De 4 à 6 : piochez 2 cartes.' },
    { id: 'C11', numero: 11, signe: '=', texte: 'Chaque joueur défausse 1 carte de son choix dans sa main.' },
    { id: 'C12', numero: 12, signe: '−', texte: 'Défaussez 1 carte de votre choix.' },
    { id: 'C13', numero: 13, signe: '−', texte: 'Mettez 1 carte de votre main sous votre pioche.' },
    { id: 'C14', numero: 14, signe: '−', texte: 'Défaussez la première carte de votre pioche.' },
    { id: 'C15', numero: 15, signe: '−', texte: 'Remettez toute votre main dans votre pioche, mélangez, puis piochez 2 cartes.' }
  ];

  /**
   * Les 8 cartes Événement : une par tuile de la réserve (cahier des charges §2). PROVISOIRE.
   * L'identifiant de la carte est celui de la tuile à poser. `pose` et `effet` reprennent le tableau du cahier.
   */
  var EVENEMENTS = [
    { id: 'E1', nom: 'Torrent de boue', pose: 'plaine ou forêt', effet: 'boue : coût 3', provisoire: true },
    { id: 'E2', nom: 'Crevasse', pose: 'plaine', effet: 'infranchissable', provisoire: true },
    { id: 'E3', nom: 'Tunnel', pose: 'une case de montagne', effet: 'franchissable, coût 2', provisoire: true },
    { id: 'E4', nom: 'Incendie', pose: 'forêt', effet: 'terre brûlée : coût 1', provisoire: true },
    { id: 'E5', nom: 'Inondation', pose: 'plaine', effet: 'marais : coût 2', provisoire: true },
    { id: 'E6', nom: 'Éboulement', pose: 'case franchissable voisine d’une montagne', effet: 'infranchissable', provisoire: true },
    { id: 'E7', nom: 'Chaussée', pose: 'marais', effet: 'coût 1', provisoire: true },
    { id: 'E8', nom: 'Campement abandonné', pose: 'plaine', effet: 'campement : on y pioche une carte Campement', provisoire: true }
  ].map(function (e) {
    e.texte = 'Posez la tuile « ' + e.nom + ' » par-dessus une case : ' + e.pose + '. Effet sur la case : ' + e.effet + '.';
    return e;
  });

  /** Restrictions de pose communes à toutes les tuiles d'événement (cahier des charges §2, provisoire). */
  var RESTRICTIONS_EVENEMENTS = 'Jamais sur une ville, jamais sur le noyau, jamais sur une case occupée par un bataillon (provisoire).';

  /**
   * Troupes PROVISOIRES (noms et chiffres inventés pour les essais, sans effet de carte).
   * moral : résistance ; puissance : dégâts infligés ; des : nombre de dés lancés.
   */
  var TROUPES = [
    { id: 'T1', nom: 'Recrues', moral: 1, puissance: 1, des: 1, provisoire: true },
    { id: 'T2', nom: 'Milice', moral: 2, puissance: 1, des: 1, provisoire: true },
    { id: 'T3', nom: 'Lanciers', moral: 2, puissance: 1, des: 2, provisoire: true },
    { id: 'T4', nom: 'Archers', moral: 1, puissance: 2, des: 2, provisoire: true },
    { id: 'T5', nom: 'Arbalétriers', moral: 2, puissance: 2, des: 1, provisoire: true },
    { id: 'T6', nom: 'Fantassins', moral: 3, puissance: 1, des: 2, provisoire: true },
    { id: 'T7', nom: 'Piquiers', moral: 3, puissance: 2, des: 1, provisoire: true },
    { id: 'T8', nom: 'Éclaireurs', moral: 1, puissance: 1, des: 3, provisoire: true },
    { id: 'T9', nom: 'Cavaliers légers', moral: 2, puissance: 2, des: 2, provisoire: true },
    { id: 'T10', nom: 'Cavaliers lourds', moral: 3, puissance: 3, des: 1, provisoire: true },
    { id: 'T11', nom: 'Vétérans', moral: 3, puissance: 2, des: 2, provisoire: true },
    { id: 'T12', nom: 'Gardes', moral: 4, puissance: 2, des: 1, provisoire: true }
  ];

  function copier(o) { return JSON.parse(JSON.stringify(o)); }

  /** Copie des 15 cartes Campement. */
  function campements() { return copier(CAMPEMENTS); }

  /** Copie des 8 cartes Événement (provisoires). */
  function evenements() { return copier(EVENEMENTS); }

  /** Copie des Troupes provisoires. */
  function troupes() { return copier(TROUPES); }

  /** Retrouve une carte Campement, Événement ou Troupe par son identifiant (copie), ou null. */
  function trouver(id) {
    var listes = [CAMPEMENTS, EVENEMENTS, TROUPES];
    for (var i = 0; i < listes.length; i++) {
      for (var j = 0; j < listes[i].length; j++) {
        if (listes[i][j].id === id) return copier(listes[i][j]);
      }
    }
    return null;
  }

  /** Paquet de départ Campement : les 15 identifiants, dans l'ordre (à mélanger avec l'aléa de la partie). */
  function paquetCampement() { return CAMPEMENTS.map(function (c) { return c.id; }); }

  /** Paquet de départ Événement : les 8 identifiants, dans l'ordre (à mélanger avec l'aléa de la partie). */
  function paquetEvenements() { return EVENEMENTS.map(function (e) { return e.id; }); }

  /**
   * Deck de test PROVISOIRE d'un joueur : `taille` exemplaires (REGLAGES.tailleDeck par défaut), obtenus
   * en parcourant la liste des Troupes en boucle (avec 12 Troupes et 20 cartes : T1 à T8 en double).
   * `modeles` : liste de Troupes à utiliser (par défaut les Troupes provisoires).
   * Renvoie [{ id, modele, joueur }] dans l'ordre, NON mélangé ; chaque exemplaire a un identifiant
   * unique `<joueur>-<numéro>` (deux exemplaires de la même Troupe restent distincts).
   */
  function deckDeDepart(joueur, taille, modeles) {
    if (JOUEURS.indexOf(joueur) < 0) throw new Error('Joueur inconnu : ' + joueur);
    var liste = modeles && modeles.length ? modeles : TROUPES;
    var n = (taille === undefined || taille === null) ? REGLAGES.tailleDeck : taille;
    var deck = [];
    for (var i = 0; i < n; i++) {
      deck.push({ id: joueur + '-' + (i + 1), modele: liste[i % liste.length].id, joueur: joueur });
    }
    return deck;
  }

  AT.cartes = {
    REGLAGES: REGLAGES,
    JOUEURS: JOUEURS.slice(),
    RESTRICTIONS_EVENEMENTS: RESTRICTIONS_EVENEMENTS,
    campements: campements,
    evenements: evenements,
    troupes: troupes,
    trouver: trouver,
    paquetCampement: paquetCampement,
    paquetEvenements: paquetEvenements,
    deckDeDepart: deckDeDepart
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.cartes;
})();
