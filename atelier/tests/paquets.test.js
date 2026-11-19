'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/cartes.js');
require('../src/paquets.js');
const P = globalThis.AT.paquets;

/** Double minimal de l'aléa du lot A (contrat du cahier des charges) : générateur à graine entière. */
function creerAlea(graine) {
  let s = (Number(graine) >>> 0) || 1;
  const a = {
    suivant() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    entier(n) { return Math.floor(a.suivant() * n); },
    de() { return 1 + a.entier(6); },
    melanger(tableau) {
      const c = tableau.slice();
      for (let i = c.length - 1; i > 0; i--) { const j = a.entier(i + 1); const x = c[i]; c[i] = c[j]; c[j] = x; }
      return c;
    },
    choisir(tableau) { return tableau[a.entier(tableau.length)]; },
    etat() { return s; },
    restaurer(e) { s = e >>> 0; }
  };
  return a;
}

/** Gèle récursivement un objet : toute modification en place lève une erreur (tests de pureté). */
function geler(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.keys(o).forEach((k) => geler(o[k]));
  }
  return o;
}

function paquet(pioche, main, defausse) {
  return geler({ pioche: pioche || [], main: main || [], defausse: defausse || [] });
}
function trie(t) { return t.slice().sort(); }
function toutes(p) { return trie(p.pioche.concat(p.main, p.defausse)); }

test('creer : tout dans la pioche, dans l’ordre', () => {
  const p = P.creer(['a', 'b', 'c']);
  assert.deepEqual(p, { pioche: ['a', 'b', 'c'], main: [], defausse: [] });
  assert.deepEqual(P.compter(p), { pioche: 3, main: 0, defausse: 0, total: 3 });
});

test('melangerPioche : mêmes cartes, même graine = même ordre, paquet reçu intact', () => {
  const p = paquet(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  const r1 = P.melangerPioche(p, creerAlea(7));
  const r2 = P.melangerPioche(p, creerAlea(7));
  const r3 = P.melangerPioche(p, creerAlea(8));
  assert.ok(r1.ok);
  assert.deepEqual(r1.paquet, r2.paquet);
  assert.deepEqual(trie(r1.paquet.pioche), trie(p.pioche));
  assert.notDeepEqual(r1.paquet.pioche, r3.paquet.pioche);
  assert.equal(P.melangerPioche(p, null).ok, false);
});

test('piocher : prend le dessus de la pioche', () => {
  const r = P.piocher(paquet(['a', 'b', 'c']), 2, creerAlea(1), { limiteMain: 5 });
  assert.deepEqual(r.piochees, ['a', 'b']);
  assert.deepEqual(r.paquet, { pioche: ['c'], main: ['a', 'b'], defausse: [] });
  assert.equal(r.mainPleine, false);
});

test('piocher : main limitée à 5, à 5 cartes aucune pioche ne s’effectue', () => {
  const plein = paquet(['x', 'y'], ['1', '2', '3', '4', '5']);
  const r = P.piocher(plein, 1, creerAlea(1), { limiteMain: 5 });
  assert.ok(r.ok);
  assert.deepEqual(r.piochees, []);
  assert.equal(r.mainPleine, true);
  assert.deepEqual(r.paquet, plein);
  // 4 cartes en main, 2 à piocher : une seule entre
  const r2 = P.piocher(paquet(['x', 'y'], ['1', '2', '3', '4']), 2, creerAlea(1), { limiteMain: 5 });
  assert.deepEqual(r2.piochees, ['x']);
  assert.equal(r2.mainPleine, true);
  assert.equal(r2.paquet.main.length, 5);
});

test('piocher : sans option, la limite est celle des REGLAGES (5)', () => {
  const r = P.piocher(paquet(['a', 'b', 'c', 'd', 'e', 'f', 'g']), 7, creerAlea(1));
  assert.equal(r.paquet.main.length, globalThis.AT.cartes.REGLAGES.tailleMain);
});

test('piocher : main pleine, la défausse n’est pas remélangée pour rien', () => {
  const p = paquet([], ['1', '2', '3', '4', '5'], ['d1', 'd2']);
  const r = P.piocher(p, 1, creerAlea(1), { limiteMain: 5 });
  assert.equal(r.remelanges, 0);
  assert.deepEqual(r.paquet, p);
});

test('piocher : pioche vide, la défausse est remélangée puis on continue', () => {
  const p = paquet(['a'], [], ['d1', 'd2', 'd3']);
  const r = P.piocher(p, 3, creerAlea(3), { limiteMain: 5 });
  assert.equal(r.remelanges, 1);
  assert.equal(r.piochees.length, 3);
  assert.equal(r.piochees[0], 'a');
  assert.deepEqual(r.paquet.defausse, []);
  assert.equal(r.paquet.pioche.length, 1);
  assert.deepEqual(toutes(r.paquet), toutes(p));
});

test('piocher : pioche et défausse vides, on en fait autant que possible', () => {
  const r = P.piocher(paquet(['a'], ['m']), 3, creerAlea(1), { limiteMain: 5 });
  assert.ok(r.ok);
  assert.deepEqual(r.piochees, ['a']);
  assert.equal(r.manquantes, 2);
  const vide = P.piocher(paquet(), 1, creerAlea(1), { limiteMain: 5 });
  assert.ok(vide.ok);
  assert.deepEqual(vide.piochees, []);
  assert.equal(vide.manquantes, 1);
});

test('piocher : nombre invalide refusé', () => {
  const p = paquet(['a']);
  for (const n of [-1, 1.5, NaN, '2', undefined]) assert.equal(P.piocher(p, n, creerAlea(1)).ok, false);
});

test('tirer : retire le dessus sans le mettre en main ; remélange facultatif', () => {
  const p = paquet(['a'], [], ['d1', 'd2']);
  const r = P.tirer(p, 2, creerAlea(1));
  assert.equal(r.cartes.length, 2);
  assert.deepEqual(r.paquet.main, []);
  assert.equal(r.remelanges, 1);
  const sans = P.tirer(p, 2, null, { remelanger: false });
  assert.deepEqual(sans.cartes, ['a']);
  assert.equal(sans.manquantes, 1);
  assert.deepEqual(sans.paquet.defausse, ['d1', 'd2']);
  // remélange nécessaire sans aléa : refus, paquet intact
  const refus = P.tirer(p, 2, null);
  assert.equal(refus.ok, false);
  assert.equal(refus.paquet, p);
});

test('defausser : carte de la main vers le dessus de la défausse ; refus si absente', () => {
  const p = paquet(['x'], ['a', 'b'], ['d']);
  const r = P.defausser(p, 'a');
  assert.deepEqual(r.paquet, { pioche: ['x'], main: ['b'], defausse: ['d', 'a'] });
  const refus = P.defausser(p, 'zz');
  assert.equal(refus.ok, false);
  assert.equal(refus.paquet, p);
  assert.ok(refus.raison.length > 0);
});

test('retirerDeMain, ajouterEnMain, mettreEnDefausse', () => {
  const p = paquet(['x'], ['a'], []);
  assert.deepEqual(P.retirerDeMain(p, 'a').paquet.main, []);
  assert.equal(P.retirerDeMain(p, 'x').ok, false);
  assert.deepEqual(P.ajouterEnMain(p, 'n').paquet.main, ['a', 'n']);
  assert.deepEqual(P.mettreEnDefausse(p, 'n').paquet.defausse, ['n']);
});

test('reordonnerDessus : refuse une carte absente de la pioche', () => {
  const p = paquet(['a', 'b', 'c']);
  assert.equal(P.reordonnerDessus(p, ['a', 'z']).ok, false);
  assert.equal(P.reordonnerDessus(p, 'a').ok, false);
  assert.deepEqual(P.reordonnerDessus(p, ['c', 'a']).paquet.pioche, ['c', 'a', 'b']);
});

test('remettreDessus : de la main vers le dessus de la pioche', () => {
  const r = P.remettreDessus(paquet(['x'], ['a']), 'a');
  assert.deepEqual(r.paquet, { pioche: ['a', 'x'], main: [], defausse: [] });
});

test('reprendreDefausse : carte précise', () => {
  const p = paquet([], [], ['d1', 'd2', 'd3']);
  assert.deepEqual(P.reprendreDefausse(p, 'd1').paquet, { pioche: [], main: ['d1'], defausse: ['d2', 'd3'] });
  assert.equal(P.reprendreDefausse(p, 'zz').ok, false);
});

test('prendreAuHasard : ne déplace rien ; main vide = null', () => {
  const p = paquet([], ['a', 'b', 'c']);
  const r = P.prendreAuHasard(p, creerAlea(4));
  assert.ok(p.main.includes(r.carte));
  assert.deepEqual(r.paquet, p);
  assert.equal(P.prendreAuHasard(paquet(), creerAlea(4)).carte, null);
});

// ------------------------------------------------------------------------------------------------
// Les 15 effets Campement, résolus à la main avec les seules primitives de AT.paquets
// ------------------------------------------------------------------------------------------------

const L = { limiteMain: 5 };

test('Campement 1 : piochez 1 carte', () => {
  const r = P.piocher(paquet(['a', 'b'], ['m']), 1, creerAlea(1), L);
  assert.deepEqual(r.paquet, { pioche: ['b'], main: ['m', 'a'], defausse: [] });
});

test('Campement 2 : regarder 3, en prendre 1, remettre les 2 autres dessus dans l’ordre choisi', () => {
  const p = paquet(['a', 'b', 'c', 'd'], ['m']);
  const vues = P.regarder(p, 3);
  assert.deepEqual(vues.cartes, ['a', 'b', 'c']);
  assert.deepEqual(vues.paquet, p);
  const pris = P.prendreDansPioche(vues.paquet, 'b');
  const fin = P.reordonnerDessus(pris.paquet, ['c', 'a']);
  assert.deepEqual(fin.paquet, { pioche: ['c', 'a', 'd'], main: ['m', 'b'], defausse: [] });
  // moins de 3 cartes : on en fait autant que possible
  assert.deepEqual(P.regarder(paquet(['a']), 3).cartes, ['a']);
});

test('Campement 3 : reprendre en main la carte du dessus de la défausse', () => {
  const r = P.reprendreDefausse(paquet([], ['m'], ['d1', 'd2']));
  assert.equal(r.carte, 'd2');
  assert.deepEqual(r.paquet, { pioche: [], main: ['m', 'd2'], defausse: ['d1'] });
  const vide = P.reprendreDefausse(paquet());
  assert.ok(vide.ok);
  assert.equal(vide.carte, null);
});

test('Campement 4 : 1 carte au hasard de la main adverse va dans sa défausse', () => {
  const adverse = paquet(['x'], ['a', 'b', 'c'], ['d']);
  const r = P.defausserAuHasard(adverse, creerAlea(11));
  assert.ok(adverse.main.includes(r.carte));
  assert.equal(r.paquet.main.length, 2);
  assert.equal(r.paquet.defausse[r.paquet.defausse.length - 1], r.carte);
  assert.deepEqual(toutes(r.paquet), toutes(adverse));
  // même graine = même carte
  assert.equal(P.defausserAuHasard(adverse, creerAlea(11)).carte, r.carte);
  // main vide : rien ne se passe
  const vide = P.defausserAuHasard(paquet(['x']), creerAlea(11));
  assert.ok(vide.ok);
  assert.equal(vide.carte, null);
});

test('Campement 5 : piocher 2 cartes puis défausser 1 carte de sa main', () => {
  const r1 = P.piocher(paquet(['a', 'b', 'c'], ['m']), 2, creerAlea(1), L);
  const r2 = P.defausser(r1.paquet, 'm');
  assert.deepEqual(r2.paquet, { pioche: ['c'], main: ['a', 'b'], defausse: ['m'] });
});

test('Campement 6 : l’adversaire défausse 1 carte de son choix', () => {
  const r = P.defausser(paquet([], ['a', 'b']), 'b');
  assert.deepEqual(r.paquet, { pioche: [], main: ['a'], defausse: ['b'] });
});

test('Campement 7 : chaque joueur pioche 1 carte', () => {
  const v = P.piocher(paquet(['a']), 1, creerAlea(1), L);
  const r = P.piocher(paquet(['z'], ['1', '2', '3', '4', '5']), 1, creerAlea(1), L);
  assert.deepEqual(v.paquet.main, ['a']);
  assert.equal(r.paquet.main.length, 5, 'main pleine : aucune pioche');
});

test('Campement 8 : défausser autant de cartes qu’on veut puis en piocher autant', () => {
  let p = paquet(['x', 'y', 'z'], ['a', 'b', 'c']);
  p = P.defausser(p, 'a').paquet;
  p = P.defausser(p, 'c').paquet;
  const r = P.piocher(p, 2, creerAlea(1), L);
  assert.deepEqual(r.paquet, { pioche: ['z'], main: ['b', 'x', 'y'], defausse: ['a', 'c'] });
});

test('Campement 9 : mélanger sa défausse dans sa pioche', () => {
  const p = paquet(['a', 'b'], ['m'], ['d1', 'd2', 'd3']);
  const r = P.melangerDefausseDansPioche(p, creerAlea(5));
  assert.deepEqual(r.paquet.defausse, []);
  assert.deepEqual(r.paquet.main, ['m']);
  assert.deepEqual(trie(r.paquet.pioche), ['a', 'b', 'd1', 'd2', 'd3']);
});

test('Campement 10 : 1 dé ; 1 à 3 défausser 1 carte, 4 à 6 piocher 2 cartes', () => {
  const alea = creerAlea(21);
  const p = paquet(['a', 'b', 'c'], ['m']);
  for (let i = 0; i < 20; i++) {
    const de = alea.de();
    assert.ok(de >= 1 && de <= 6);
    const r = de <= 3 ? P.defausser(p, 'm') : P.piocher(p, 2, alea, L);
    assert.ok(r.ok);
    assert.equal(r.paquet.main.length, de <= 3 ? 0 : 3);
  }
});

test('Campement 11 : chaque joueur défausse 1 carte de son choix', () => {
  const v = P.defausser(paquet([], ['a', 'b']), 'a');
  const r = P.defausser(paquet([], ['y']), 'y');
  assert.deepEqual(v.paquet.defausse, ['a']);
  assert.deepEqual(r.paquet.main, []);
  // main vide : effet impossible, rien ne change
  assert.equal(P.defausser(paquet(), 'a').ok, false);
});

test('Campement 12 : défausser 1 carte de son choix', () => {
  assert.deepEqual(P.defausser(paquet(['x'], ['a']), 'a').paquet, { pioche: ['x'], main: [], defausse: ['a'] });
});

test('Campement 13 : mettre 1 carte de sa main sous sa pioche', () => {
  const r = P.remettreDessous(paquet(['x', 'y'], ['a', 'b']), 'a');
  assert.deepEqual(r.paquet, { pioche: ['x', 'y', 'a'], main: ['b'], defausse: [] });
  assert.equal(P.remettreDessous(paquet(['x']), 'a').ok, false);
});

test('Campement 14 : défausser la première carte de sa pioche', () => {
  const r = P.defausserDessusPioche(paquet(['a', 'b'], [], ['d']), creerAlea(1));
  assert.equal(r.carte, 'a');
  assert.deepEqual(r.paquet, { pioche: ['b'], main: [], defausse: ['d', 'a'] });
  // pioche vide : la défausse est remélangée, puis la première carte est défaussée
  const r2 = P.defausserDessusPioche(paquet([], [], ['d1', 'd2']), creerAlea(1));
  assert.equal(r2.remelanges, 1);
  assert.equal(r2.paquet.pioche.length, 1);
  assert.deepEqual(r2.paquet.defausse, [r2.carte]);
  // plus aucune carte
  const r3 = P.defausserDessusPioche(paquet(), creerAlea(1));
  assert.ok(r3.ok);
  assert.equal(r3.carte, null);
});

test('Campement 15 : remettre toute sa main dans sa pioche, mélanger, piocher 2 cartes', () => {
  const p = paquet(['a', 'b'], ['m1', 'm2', 'm3'], ['d']);
  const alea = creerAlea(9);
  const r1 = P.remettreMainDansPioche(p, alea);
  assert.deepEqual(r1.paquet.main, []);
  assert.deepEqual(trie(r1.paquet.pioche), ['a', 'b', 'm1', 'm2', 'm3']);
  assert.deepEqual(r1.paquet.defausse, ['d']);
  const r2 = P.piocher(r1.paquet, 2, alea, L);
  assert.equal(r2.paquet.main.length, 2);
  assert.equal(r2.paquet.pioche.length, 3);
  assert.deepEqual(toutes(r2.paquet), toutes(p));
});

test('pureté : aucune primitive ne modifie le paquet reçu (paquet gelé)', () => {
  const p = paquet(['a', 'b', 'c'], ['m1', 'm2'], ['d1', 'd2']);
  const alea = creerAlea(2);
  const appels = [
    () => P.melangerPioche(p, alea), () => P.melangerDefausseDansPioche(p, alea), () => P.tirer(p, 5, alea),
    () => P.piocher(p, 5, alea, L), () => P.defausser(p, 'm1'), () => P.defausserMain(p),
    () => P.prendreAuHasard(p, alea), () => P.defausserAuHasard(p, alea), () => P.defausserDessusPioche(p, alea),
    () => P.mettreEnDefausse(p, 'n'), () => P.ajouterEnMain(p, 'n'), () => P.retirerDeMain(p, 'm2'),
    () => P.regarder(p, 2), () => P.prendreDansPioche(p, 'b'), () => P.reordonnerDessus(p, ['c', 'a']),
    () => P.remettreDessus(p, 'm1'), () => P.remettreDessous(p, 'm1'), () => P.reprendreDefausse(p),
    () => P.remettreMainDansPioche(p, alea), () => P.copier(p), () => P.compter(p)
  ];
  appels.forEach((f, i) => {
    const r = f();
    assert.ok(r, 'appel ' + i);
    if (r.paquet) {
      assert.ok(r.ok, 'appel ' + i);
      assert.notEqual(r.paquet, p);
      assert.notEqual(r.paquet.pioche, p.pioche);
    }
  });
  assert.deepEqual(p, { pioche: ['a', 'b', 'c'], main: ['m1', 'm2'], defausse: ['d1', 'd2'] });
});

test('defausserMain : toute la main dans la défausse', () => {
  const r = P.defausserMain(paquet(['x'], ['a', 'b'], ['d']));
  assert.deepEqual(r.paquet, { pioche: ['x'], main: [], defausse: ['d', 'a', 'b'] });
  assert.deepEqual(r.cartes, ['a', 'b']);
});
