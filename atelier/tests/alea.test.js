'use strict';
const test = require('node:test');
const assert = require('node:assert');
const A = require('../src/alea.js');

test('même graine = même suite ; graines différentes = suites différentes', () => {
  const a = A.creer(42), b = A.creer(42), c = A.creer(43);
  const sa = [], sb = [], sc = [];
  for (let i = 0; i < 20; i++) { sa.push(a.suivant()); sb.push(b.suivant()); sc.push(c.suivant()); }
  assert.deepStrictEqual(sa, sb);
  assert.notDeepStrictEqual(sa, sc);
});

test('graine en chaîne : déterministe, distincte selon le texte', () => {
  assert.strictEqual(A.creer('partie du soir').suivant(), A.creer('partie du soir').suivant());
  assert.notStrictEqual(A.creer('a').suivant(), A.creer('b').suivant());
  assert.strictEqual(A.creer(-5).suivant(), A.creer('-5').suivant());
});

test('suivant dans [0, 1[ ; entier dans 0..n-1 ; de dans 1..6', () => {
  const a = A.creer(1);
  const vus = new Set();
  for (let i = 0; i < 2000; i++) {
    const x = a.suivant();
    assert.ok(x >= 0 && x < 1);
    const e = a.entier(4);
    assert.ok(Number.isInteger(e) && e >= 0 && e <= 3);
    const d = a.de();
    assert.ok(Number.isInteger(d) && d >= 1 && d <= 6);
    vus.add(d);
  }
  assert.strictEqual(vus.size, 6);
  assert.throws(() => a.entier(0));
  assert.throws(() => a.entier(2.5));
});

test('le dé est à peu près équitable', () => {
  const a = A.creer('equite'), n = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 6000; i++) n[a.de() - 1] += 1;
  n.forEach((x) => assert.ok(x > 850 && x < 1150, 'face tirée ' + x + ' fois sur 6000'));
});

test('melanger renvoie une copie mélangée sans toucher au tableau reçu', () => {
  const a = A.creer(7), source = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], copie = source.slice();
  const m = a.melanger(source);
  assert.deepStrictEqual(source, copie);
  assert.notStrictEqual(m, source);
  assert.deepStrictEqual(m.slice().sort((x, y) => x - y), copie);
  assert.notDeepStrictEqual(m, copie);
  assert.deepStrictEqual(A.creer(7).melanger(source), m);
  assert.deepStrictEqual(a.melanger([]), []);
});

test('choisir prend un élément du tableau ; undefined si vide', () => {
  const a = A.creer(3);
  for (let i = 0; i < 50; i++) assert.ok(['x', 'y', 'z'].includes(a.choisir(['x', 'y', 'z'])));
  assert.strictEqual(a.choisir([]), undefined);
});

test('etat / restaurer : la suite reprend à l’identique, l’état passe par JSON', () => {
  const a = A.creer('reprise');
  a.suivant(); a.de();
  const etat = JSON.parse(JSON.stringify(a.etat()));
  const suite = [a.de(), a.de(), a.entier(100), a.suivant()];
  a.restaurer(etat);
  assert.deepStrictEqual([a.de(), a.de(), a.entier(100), a.suivant()], suite);
  const b = A.creer(0);
  b.restaurer(etat);
  assert.deepStrictEqual([b.de(), b.de(), b.entier(100), b.suivant()], suite);
  assert.throws(() => a.restaurer('n’importe quoi'));
  assert.throws(() => a.restaurer(-1));
});
