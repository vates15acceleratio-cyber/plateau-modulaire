/*
 * catalogue.js : catalogue réel des tuiles (orientation canonique, mm).
 * Aucun accès au DOM. Voir docs/3-synthese.md (catalogue, décompte des cases).
 *
 * 18 modèles, 20 tuiles physiques :
 *  - 6 centrales C1..C6 (1 exemplaire), 4 cases, 4 ports ;
 *  - 5 coins K1..K5 (1 exemplaire), 3 cases, port SE, raccords E et S ;
 *  - 5 bords neutres B1..B5 (1 exemplaire), 3 cases, ports SE et SO ;
 *  - 2 apparitions A1, A2 (2 exemplaires, partagées par les deux joueurs).
 *
 * Rappels de géométrie (docs/2-avis-geometrie.md) :
 *  - côtés 0 = N, 1 = E, 2 = S, 3 = O ; coins 0 = NO, 1 = NE, 2 = SE, 3 = SO ;
 *  - position de raccord 0 = début, 1 = milieu, 2 = fin, en lecture horaire
 *    (N d'ouest en est, E du nord au sud, S d'est en ouest, O du sud au nord) ;
 *  - un raccord (côté k, pos p) rencontre le raccord (k + 2, 2 - p) du voisin.
 *
 * Principes de conception (détaillés dans tests/catalogue.test.js) :
 *  - chaque côté intérieur porte la position milieu (pos 1), sauf le côté ouest
 *    de la centrale C6 (vide) : deux côtés face à face se raccordent presque toujours ;
 *  - les positions début / fin ne servent que de variantes, sur 3 modèles
 *    (C2 ouest pos 0, K4 est pos 2, B5 ouest pos 0), placées près d'une jonction
 *    pour contourner la ville ; chaque variante coûte en moyenne un raccord mort ;
 *  - les cases à port sont sur la bissectrice de leur coin ; chaque case d'une
 *    centrale porte exactement un port (4 cases, 4 ports) ;
 *  - dans une apparition, les deux cases à port touchent la case d'apparition
 *    (2 pas jusqu'aux deux jonctions voisines, pour A1 comme pour A2) ;
 *  - tracés (segments droits, amorce perpendiculaire de 10 mm à chaque raccord) :
 *    à 16 mm au moins des autres cases, 24 mm des coins (sauf le port), sans
 *    contact entre chemins (contrôlé par tests/catalogue.test.js).
 */
var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});

if (!PM.modele && typeof require === 'function') require('./modele.js'); // chargement sous Node

(function () {
  'use strict';

  var DIAMETRE = 24;

  /* Petits constructeurs pour garder les modèles lisibles. */
  function kase(id, x, y, type) { return { id: id, x: x, y: y, diametre: DIAMETRE, type: type || 'deplacement' }; }
  function lien(id, a, b) { return { id: id, a: { 'case': a }, b: { 'case': b } }; }
  function port(id, c, coin) { return { id: id, a: { 'case': c }, b: { coin: coin } }; }
  function raccord(id, c, cote, pos) { return { id: id, a: { 'case': c }, b: { raccord: { cote: cote, pos: pos } } }; }
  function modele(id, nom, role, exemplaires, cases, chemins) {
    return { id: id, nom: nom, role: role, exemplaires: exemplaires, cases: cases, chemins: chemins };
  }

  /* Centrales : 4 cases sur les bissectrices, une par quart (c1 NO, c2 NE, c3 SE, c4 SO). */
  function casesCentrale() {
    return [kase('c1', 36, 36), kase('c2', 84, 36), kase('c3', 84, 84), kase('c4', 36, 84)];
  }
  function portsCentrale() {
    return [port('p1', 'c1', 0), port('p2', 'c2', 1), port('p3', 'c3', 2), port('p4', 'c4', 3)];
  }

  function construire() {
    return [
      /* ---------------- Centrales ---------------- */
      // anneau des 4 cases ; raccords en moulinet (chaque milieu sur la case de début du côté)
      modele('C1', 'Anneau', 'centrale', 1, casesCentrale(), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4'), lien('h4', 'c4', 'c1')
      ].concat(portsCentrale(), [
        raccord('r1', 'c1', 0, 1), raccord('r2', 'c2', 1, 1), raccord('r3', 'c3', 2, 1), raccord('r4', 'c4', 3, 1)
      ])),
      // U ouvert à l'ouest ; variante ouest pos 0 : l'ouest relie les deux bras par le voisin
      modele('C2', 'Fer à cheval', 'centrale', 1, casesCentrale(), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4')
      ].concat(portsCentrale(), [
        raccord('r1', 'c2', 0, 1), raccord('r2', 'c3', 1, 1), raccord('r3', 'c4', 2, 1),
        raccord('r4', 'c1', 3, 1), raccord('r5', 'c4', 3, 0)
      ])),
      // Z : bord nord, diagonale NE-SO, bord sud ; NO et SE à 3 pas
      modele('C3', 'Zigzag', 'centrale', 1, casesCentrale(), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c4'), lien('h3', 'c4', 'c3')
      ].concat(portsCentrale(), [
        raccord('r1', 'c1', 0, 1), raccord('r2', 'c2', 1, 1), raccord('r3', 'c3', 2, 1), raccord('r4', 'c4', 3, 1)
      ])),
      // étoile autour de la case NO (diagonale vers SE) ; deux raccords sur la case SE
      modele('C4', 'Étoile', 'centrale', 1, casesCentrale(), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c4'), lien('h3', 'c1', 'c3')
      ].concat(portsCentrale(), [
        raccord('r1', 'c2', 0, 1), raccord('r2', 'c3', 1, 1), raccord('r3', 'c3', 2, 1), raccord('r4', 'c4', 3, 1)
      ])),
      // patte : triangle NO-NE-SE et queue vers SO
      modele('C5', 'Patte', 'centrale', 1, casesCentrale(), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c1', 'c3'), lien('h4', 'c3', 'c4')
      ].concat(portsCentrale(), [
        raccord('r1', 'c2', 0, 1), raccord('r2', 'c3', 1, 1), raccord('r3', 'c4', 2, 1),
        raccord('r4', 'c1', 3, 1)
      ])),
      // losange (anneau + diagonale NE-SO), très relié : côté ouest sans raccord
      modele('C6', 'Losange', 'centrale', 1, casesCentrale(), [
        lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4'), lien('h4', 'c4', 'c1'), lien('h5', 'c2', 'c4')
      ].concat(portsCentrale(), [
        raccord('r1', 'c1', 0, 1), raccord('r2', 'c2', 1, 1), raccord('r3', 'c3', 2, 1)
      ])),

      /* ---------------- Coins (extérieurs N et O, port SE) ---------------- */
      // V autour de la case à port ; E-S en 2 pas par la case à port
      modele('K1', 'Coude', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 36, 88)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c3'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),
      // triangle : E-S en 1 pas sans passer par la case à port
      modele('K2', 'Raccourci', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 36, 88)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c3'), lien('h3', 'c2', 'c3'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),
      // crochet par l'angle extérieur ; le sud entre directement sur la case à port
      modele('K3', 'Détour', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 40, 40)], [
          lien('h1', 'c2', 'c3'), lien('h2', 'c3', 'c1'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c1', 2, 1)
        ]),
      // chemin E - S - port ; variante est pos 2 sur la case à port (contourne la ville)
      modele('K4', 'Double est', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 88, 36), kase('c3', 36, 88)], [
          lien('h1', 'c2', 'c3'), lien('h2', 'c3', 'c1'), port('p1', 'c1', 2),
          raccord('r1', 'c2', 1, 1), raccord('r2', 'c3', 2, 1), raccord('r3', 'c1', 1, 2)
        ]),
      // symétrique de K3 : l'est entre directement sur la case à port
      modele('K5', 'Équerre', 'coin', 1,
        [kase('c1', 84, 84), kase('c2', 40, 40), kase('c3', 36, 88)], [
          lien('h1', 'c3', 'c2'), lien('h2', 'c2', 'c1'), port('p1', 'c1', 2),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c3', 2, 1)
        ]),

      /* ---------------- Bords neutres (extérieur N, ports SE et SO) ---------------- */
      // V : la case haute descend vers la centrale ; est-ouest en 2 pas
      modele('B1', 'Bord en V', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 58)], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c3', 2, 1)
        ]),
      // barre basse entre les ports, case haute vers l'est ; est-ouest en 1 pas
      modele('B2', 'Barre', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c1', 2, 1)
        ]),
      // triangle ; la centrale entre par la case SO
      modele('B3', 'Triangle', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42)], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), lien('h3', 'c1', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c2', 2, 1)
        ]),
      // crochet : case haute vers l'est accrochée à la case SE ; est-ouest en 2 pas
      modele('B4', 'Crochet', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c1', 'c3'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c2', 2, 1)
        ]),
      // barre basse + case haute vers l'ouest ; variante ouest pos 0 sur la case SO
      modele('B5', 'Pont', 'bord', 1,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42)], [
          lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c3', 3, 1), raccord('r3', 'c2', 3, 0), raccord('r4', 'c1', 2, 1)
        ]),

      /* ---------------- Apparitions (extérieur N, ports SE et SO) ---------------- */
      // fourche : l'apparition descend vers la centrale, sorties latérales par les cases à port
      modele('A1', 'Fourche', 'apparition', 2,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 58, 'apparition')], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c1', 1, 1), raccord('r2', 'c2', 3, 1), raccord('r3', 'c3', 2, 1)
        ]),
      // arc : l'apparition porte les trois raccords (est, ouest, sud), cases à port en retrait
      modele('A2', 'Arc', 'apparition', 2,
        [kase('c1', 84, 84), kase('c2', 36, 84), kase('c3', 60, 42, 'apparition')], [
          lien('h1', 'c3', 'c1'), lien('h2', 'c3', 'c2'), port('p1', 'c1', 2), port('p2', 'c2', 3),
          raccord('r1', 'c3', 1, 1), raccord('r2', 'c3', 3, 1), raccord('r3', 'c3', 2, 1)
        ])
    ];
  }

  /** Gèle récursivement un objet (le catalogue partagé ne doit pas être modifié). */
  function geler(o) {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { geler(o[k]); });
    }
    return o;
  }

  var MODELES = geler(construire());

  /** Document neuf (PM.modele.nouveauDocument) contenant une copie modifiable des 18 modèles. */
  function nouveauDocument() {
    var doc = PM.modele.nouveauDocument();
    doc.modeles = JSON.parse(JSON.stringify(MODELES));
    return doc;
  }

  PM.catalogue = {
    version: 1,
    modeles: MODELES,                 // tableau gelé (lecture seule)
    nouveauDocument: nouveauDocument
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PM.catalogue;
})();
