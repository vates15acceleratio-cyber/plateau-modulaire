'use strict';
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/hex.js');

test('cle et decle sont inverses ; clés non canoniques refusées', () => {
  assert.strictEqual(H.cle(3, -2), '3,-2');
  assert.deepStrictEqual(H.decle('3,-2'), { q: 3, r: -2 });
  assert.deepStrictEqual(H.decle('0,0'), { q: 0, r: 0 });
  for (const mauvaise of ['', '1', '1,2,3', 'a,b', '01,2', '-0,1', '1.5,2', ' 1,2', '1,2 ', '__proto__', '1e3,0', '1234,0']) {
    assert.throws(() => H.decle(mauvaise), 'devrait refuser « ' + mauvaise + ' »');
    assert.strictEqual(H.estCle(mauvaise), false);
  }
  assert.throws(() => H.decle(null));
  assert.strictEqual(H.estCle('-12,7'), true);
});

test('DIRS : 6 directions distinctes, opposées deux à deux', () => {
  assert.strictEqual(H.DIRS.length, 6);
  assert.strictEqual(new Set(H.DIRS.map((d) => H.cle(d.q, d.r))).size, 6);
  for (let i = 0; i < 6; i++) {
    assert.strictEqual(H.DIRS[i].q + H.DIRS[(i + 3) % 6].q, 0);
    assert.strictEqual(H.DIRS[i].r + H.DIRS[(i + 3) % 6].r, 0);
  }
});

test('voisines : 6 clés à distance 1, relation réciproque', () => {
  const v = H.voisines('2,-1');
  assert.strictEqual(v.length, 6);
  assert.strictEqual(new Set(v).size, 6);
  v.forEach((k) => {
    assert.strictEqual(H.distance('2,-1', k), 1);
    assert.ok(H.voisines(k).includes('2,-1'));
  });
  assert.deepStrictEqual(H.voisines({ q: 2, r: -1 }), v);
});

test('distance : clés ou objets, symétrique, valeurs connues', () => {
  assert.strictEqual(H.distance('0,0', '0,0'), 0);
  assert.strictEqual(H.distance('0,0', '3,-3'), 3);
  assert.strictEqual(H.distance('0,0', '2,2'), 4);
  assert.strictEqual(H.distance('-2,5', '3,-1'), H.distance('3,-1', '-2,5'));
  assert.strictEqual(H.distance({ q: 0, r: -5 }, '4,-5'), 4);
});

test('tourner : six sixièmes = identité, trois = demi-tour, distance conservée, pas de zéro négatif', () => {
  assert.deepStrictEqual(H.tourner(1, 0, 1), { q: 0, r: 1 });
  assert.deepStrictEqual(H.tourner(2, -1, 6), { q: 2, r: -1 });
  assert.deepStrictEqual(H.tourner(2, -1, 3), { q: -2, r: 1 });
  assert.deepStrictEqual(H.tourner(2, -1, -1), H.tourner(2, -1, 5));
  assert.deepStrictEqual(H.tourner(0, 0, 1), { q: 0, r: 0 });
  for (let k = 0; k < 6; k++) {
    const t = H.tourner(3, -1, k);
    assert.strictEqual(H.anneau(t), 3);
    assert.ok(!Object.is(t.q, -0) && !Object.is(t.r, -0));
  }
  // Les 6 rotations d'une direction redonnent les 6 directions.
  const images = new Set();
  for (let k = 0; k < 6; k++) { const t = H.tourner(1, 0, k); images.add(H.cle(t.q, t.r)); }
  assert.strictEqual(images.size, 6);
});

test('symetrique : demi-tour autour de (0,0), clé canonique', () => {
  assert.strictEqual(H.symetrique('3,-5'), '-3,5');
  assert.strictEqual(H.symetrique('0,0'), '0,0');
  assert.strictEqual(H.symetrique('0,4'), '0,-4');
});

test('disque : 1, 7, 19, 37, 61, 91 cases', () => {
  [1, 7, 19, 37, 61, 91].forEach((n, rayon) => {
    const d = H.disque(rayon);
    assert.strictEqual(d.length, n);
    assert.strictEqual(new Set(d).size, n);
    d.forEach((k) => assert.ok(H.anneau(k) <= rayon));
  });
});

test('trier : par rangée puis par colonne, sans modifier l’entrée', () => {
  const entree = ['1,1', '-1,0', '5,-5', '0,0', '0,-5'];
  assert.deepStrictEqual(H.trier(entree), ['0,-5', '5,-5', '-1,0', '0,0', '1,1']);
  assert.strictEqual(entree[0], '1,1');
});

test('centre et sommets : voisines à une largeur de case, sommets à égale distance', () => {
  const o = H.centre(0, 0, 45), e = H.centre(1, 0, 45), s = H.centre(0, 1, 45);
  assert.deepStrictEqual(o, { x: 0, y: 0 });
  assert.ok(Math.abs(e.x - 45) < 1e-9 && Math.abs(e.y) < 1e-9);
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - 45) < 1e-9);
  const pts = H.sommets(10, 20, 45);
  assert.strictEqual(pts.length, 6);
  pts.forEach((p) => assert.ok(Math.abs(Math.hypot(p.x - 10, p.y - 20) - 45 / Math.sqrt(3)) < 1e-9));
  assert.ok(Math.abs(pts[0].x - 10) < 1e-9 && pts[0].y < 20, 'premier sommet : la pointe du haut');
});
