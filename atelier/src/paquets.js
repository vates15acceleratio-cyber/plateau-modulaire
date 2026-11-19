/*
 * paquets.js : logique pure des paquets de cartes (lot B, table de jeu).
 * Aucun accès au DOM, aucune dépendance. L'aléa est toujours REÇU en paramètre
 * (contrat du lot A : alea.melanger(tableau) renvoie une copie mélangée, alea.entier(n) dans 0..n-1).
 *
 * Un paquet est un objet JSON simple : { pioche: [...], main: [...], defausse: [...] }.
 *  - pioche[0] est la carte du DESSUS de la pioche ; la dernière est celle du dessous.
 *  - la DERNIÈRE carte de `defausse` est celle du dessus de la défausse (la plus récente).
 *  - une carte est une valeur simple (identifiant en chaîne) ; chaque exemplaire a un identifiant unique.
 *
 * Toutes les fonctions sont pures : le paquet reçu n'est jamais modifié.
 * Elles renvoient { ok, paquet, raison, ... } ; en cas d'échec, `paquet` est le paquet reçu, inchangé.
 *
 * Limite de main : elle ne concerne que `piocher` (règles V2.3 : « si vous avez 5 cartes et devez
 * piocher, aucune pioche ne s'effectue »). Les autres mouvements vers la main (reprendre dans la
 * défausse, prendre une carte regardée) ne sont pas limités : les règles ne tranchent pas, la table reste libre.
 */
var AT = (typeof globalThis !== 'undefined' ? globalThis : window).AT = ((typeof globalThis !== 'undefined' ? globalThis : window).AT || {});

(function () {
  'use strict';

  /** Crée un paquet : `cartes` va dans la pioche (dans l'ordre donné, non mélangé). */
  function creer(cartes) {
    return { pioche: (cartes || []).slice(), main: [], defausse: [] };
  }

  /** Copie indépendante d'un paquet. */
  function copier(paquet) {
    return { pioche: paquet.pioche.slice(), main: paquet.main.slice(), defausse: paquet.defausse.slice() };
  }

  function reussite(paquet, extras) {
    var r = { ok: true, paquet: paquet, raison: null };
    if (extras) Object.keys(extras).forEach(function (k) { r[k] = extras[k]; });
    return r;
  }

  function echec(paquet, raison) {
    return { ok: false, paquet: paquet, raison: raison };
  }

  function estEntierPositif(n) {
    return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= 0;
  }

  function aleaValide(alea) {
    return !!alea && typeof alea.melanger === 'function' && typeof alea.entier === 'function';
  }

  /** Limite de main utilisée par `piocher` : option explicite, sinon le réglage commun s'il est chargé, sinon aucune. */
  function limiteDeMain(options) {
    if (options && options.limiteMain !== undefined && options.limiteMain !== null) return options.limiteMain;
    if (AT.cartes && AT.cartes.REGLAGES && estEntierPositif(AT.cartes.REGLAGES.tailleMain)) return AT.cartes.REGLAGES.tailleMain;
    return Infinity;
  }

  /** Nombre de cartes par zone. */
  function compter(paquet) {
    return {
      pioche: paquet.pioche.length, main: paquet.main.length, defausse: paquet.defausse.length,
      total: paquet.pioche.length + paquet.main.length + paquet.defausse.length
    };
  }

  /** Mélange la pioche seule. */
  function melangerPioche(paquet, alea) {
    if (!aleaValide(alea)) return echec(paquet, 'Aléa manquant : impossible de mélanger.');
    var p = copier(paquet);
    p.pioche = alea.melanger(p.pioche);
    return reussite(p);
  }

  /**
   * Mélange la défausse DANS la pioche (effet Campement 9). Quand la pioche est vide,
   * c'est le remélange ordinaire de la défausse.
   */
  function melangerDefausseDansPioche(paquet, alea) {
    if (!aleaValide(alea)) return echec(paquet, 'Aléa manquant : impossible de mélanger.');
    var p = copier(paquet);
    p.pioche = alea.melanger(p.pioche.concat(p.defausse));
    p.defausse = [];
    return reussite(p);
  }

  /**
   * Retire les `n` cartes du dessus de la pioche SANS les mettre en main (elles sont renvoyées dans `cartes`).
   * Pioche vide : la défausse est remélangée pour refaire une pioche, puis on continue
   * (sauf `options.remelanger === false`). S'il n'y a plus de carte nulle part, on s'arrête
   * (« on en fait autant que possible ») : `manquantes` dit combien n'ont pas pu être tirées.
   */
  function tirer(paquet, n, alea, options) {
    if (!estEntierPositif(n)) return echec(paquet, 'Nombre de cartes invalide.');
    var remelanger = !(options && options.remelanger === false);
    var p = copier(paquet), cartes = [], remelanges = 0;
    while (cartes.length < n) {
      if (!p.pioche.length) {
        if (!remelanger || !p.defausse.length) break;
        if (!aleaValide(alea)) return echec(paquet, 'Aléa manquant : impossible de remélanger la défausse.');
        p.pioche = alea.melanger(p.defausse);
        p.defausse = [];
        remelanges += 1;
      }
      cartes.push(p.pioche.shift());
    }
    return reussite(p, { cartes: cartes, remelanges: remelanges, manquantes: n - cartes.length });
  }

  /**
   * Pioche jusqu'à `n` cartes vers la main. La main est limitée (`options.limiteMain`) :
   * à la limite, aucune pioche ne s'effectue (et la défausse n'est pas remélangée pour rien).
   * Renvoie aussi `piochees`, `remelanges`, `manquantes` (cartes introuvables) et `mainPleine`
   * (vrai si la limite de main a empêché une partie de la pioche).
   */
  function piocher(paquet, n, alea, options) {
    if (!estEntierPositif(n)) return echec(paquet, 'Nombre de cartes invalide.');
    var limite = limiteDeMain(options);
    var places = Math.max(0, limite - paquet.main.length);
    var aTirer = Math.min(n, places);
    var r = tirer(paquet, aTirer, alea, options);
    if (!r.ok) return r;
    r.paquet.main = r.paquet.main.concat(r.cartes);
    return reussite(r.paquet, {
      piochees: r.cartes, remelanges: r.remelanges, manquantes: r.manquantes, mainPleine: aTirer < n
    });
  }

  /** Retire une carte précise d'une zone ; renvoie l'indice trouvé ou -1. */
  function retirer(zone, carte) {
    var i = zone.indexOf(carte);
    if (i >= 0) zone.splice(i, 1);
    return i;
  }

  /** Défausse une carte précise de la main. */
  function defausser(paquet, carte) {
    var p = copier(paquet);
    if (retirer(p.main, carte) < 0) return echec(paquet, 'Cette carte n’est pas dans la main.');
    p.defausse.push(carte);
    return reussite(p, { carte: carte });
  }

  /** Défausse toute la main (dans l'ordre de la main). */
  function defausserMain(paquet) {
    var p = copier(paquet);
    var cartes = p.main;
    p.defausse = p.defausse.concat(cartes);
    p.main = [];
    return reussite(p, { cartes: cartes });
  }

  /** Choisit une carte au hasard dans la main, sans rien déplacer (`carte` vaut null si la main est vide). */
  function prendreAuHasard(paquet, alea) {
    if (!aleaValide(alea)) return echec(paquet, 'Aléa manquant : impossible de tirer au hasard.');
    if (!paquet.main.length) return reussite(copier(paquet), { carte: null });
    return reussite(copier(paquet), { carte: paquet.main[alea.entier(paquet.main.length)] });
  }

  /** Défausse une carte prise au hasard dans la main (effet Campement 4, appliqué à la main adverse). */
  function defausserAuHasard(paquet, alea) {
    var r = prendreAuHasard(paquet, alea);
    if (!r.ok || r.carte === null) return r;
    return defausser(paquet, r.carte);
  }

  /** Défausse la première carte de la pioche (effet Campement 14) ; `carte` vaut null s'il n'y a plus de carte. */
  function defausserDessusPioche(paquet, alea, options) {
    var r = tirer(paquet, 1, alea, options);
    if (!r.ok) return r;
    if (!r.cartes.length) return reussite(r.paquet, { carte: null, remelanges: r.remelanges });
    r.paquet.defausse.push(r.cartes[0]);
    return reussite(r.paquet, { carte: r.cartes[0], remelanges: r.remelanges });
  }

  /** Ajoute dans la défausse une carte venue d'ailleurs (Troupe éliminée, carte Campement jouée). */
  function mettreEnDefausse(paquet, carte) {
    var p = copier(paquet);
    p.defausse.push(carte);
    return reussite(p, { carte: carte });
  }

  /** Ajoute en main une carte venue d'ailleurs (sans limite de main). */
  function ajouterEnMain(paquet, carte) {
    var p = copier(paquet);
    p.main.push(carte);
    return reussite(p, { carte: carte });
  }

  /** Retire une carte de la main (carte jouée, par exemple une Troupe posée dans un bataillon). */
  function retirerDeMain(paquet, carte) {
    var p = copier(paquet);
    if (retirer(p.main, carte) < 0) return echec(paquet, 'Cette carte n’est pas dans la main.');
    return reussite(p, { carte: carte });
  }

  /** Regarde les `n` premières cartes de la pioche sans rien déplacer (moins s'il en reste moins). */
  function regarder(paquet, n) {
    if (!estEntierPositif(n)) return echec(paquet, 'Nombre de cartes invalide.');
    return reussite(copier(paquet), { cartes: paquet.pioche.slice(0, n) });
  }

  /** Prend en main une carte précise de la pioche (effet Campement 2, après `regarder`). */
  function prendreDansPioche(paquet, carte) {
    var p = copier(paquet);
    if (retirer(p.pioche, carte) < 0) return echec(paquet, 'Cette carte n’est pas dans la pioche.');
    p.main.push(carte);
    return reussite(p, { carte: carte });
  }

  /**
   * Remet sur le dessus de la pioche, dans l'ordre donné (la première sera au-dessus),
   * des cartes qui sont déjà dans la pioche (effet Campement 2 : « dans l'ordre de votre choix »).
   */
  function reordonnerDessus(paquet, cartes) {
    if (!Array.isArray(cartes)) return echec(paquet, 'Liste de cartes invalide.');
    var p = copier(paquet);
    for (var i = 0; i < cartes.length; i++) {
      if (retirer(p.pioche, cartes[i]) < 0) return echec(paquet, 'Une de ces cartes n’est pas dans la pioche.');
    }
    p.pioche = cartes.slice().concat(p.pioche);
    return reussite(p);
  }

  /** Met une carte de la main sur le dessus de la pioche. */
  function remettreDessus(paquet, carte) {
    var p = copier(paquet);
    if (retirer(p.main, carte) < 0) return echec(paquet, 'Cette carte n’est pas dans la main.');
    p.pioche.unshift(carte);
    return reussite(p, { carte: carte });
  }

  /** Met une carte de la main sous la pioche (effet Campement 13). */
  function remettreDessous(paquet, carte) {
    var p = copier(paquet);
    if (retirer(p.main, carte) < 0) return echec(paquet, 'Cette carte n’est pas dans la main.');
    p.pioche.push(carte);
    return reussite(p, { carte: carte });
  }

  /**
   * Reprend en main une carte de la défausse : celle du dessus par défaut (effet Campement 3),
   * ou une carte précise si `carte` est donnée. `carte` vaut null si la défausse est vide.
   */
  function reprendreDefausse(paquet, carte) {
    var p = copier(paquet);
    if (carte === undefined || carte === null) {
      if (!p.defausse.length) return reussite(p, { carte: null });
      carte = p.defausse.pop();
    } else {
      var i = p.defausse.lastIndexOf(carte);
      if (i < 0) return echec(paquet, 'Cette carte n’est pas dans la défausse.');
      p.defausse.splice(i, 1);
    }
    p.main.push(carte);
    return reussite(p, { carte: carte });
  }

  /** Remet toute la main dans la pioche et mélange (première moitié de l'effet Campement 15). */
  function remettreMainDansPioche(paquet, alea) {
    if (!aleaValide(alea)) return echec(paquet, 'Aléa manquant : impossible de mélanger.');
    var p = copier(paquet);
    var cartes = p.main;
    p.pioche = alea.melanger(p.pioche.concat(cartes));
    p.main = [];
    return reussite(p, { cartes: cartes });
  }

  AT.paquets = {
    creer: creer,
    copier: copier,
    compter: compter,
    melangerPioche: melangerPioche,
    melangerDefausseDansPioche: melangerDefausseDansPioche,
    tirer: tirer,
    piocher: piocher,
    defausser: defausser,
    defausserMain: defausserMain,
    prendreAuHasard: prendreAuHasard,
    defausserAuHasard: defausserAuHasard,
    defausserDessusPioche: defausserDessusPioche,
    mettreEnDefausse: mettreEnDefausse,
    ajouterEnMain: ajouterEnMain,
    retirerDeMain: retirerDeMain,
    regarder: regarder,
    prendreDansPioche: prendreDansPioche,
    reordonnerDessus: reordonnerDessus,
    remettreDessus: remettreDessus,
    remettreDessous: remettreDessous,
    reprendreDefausse: reprendreDefausse,
    remettreMainDansPioche: remettreMainDansPioche
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = AT.paquets;
})();
