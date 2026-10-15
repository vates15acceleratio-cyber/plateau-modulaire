'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
const G = globalThis.PM.geometrie;

test('constantes', () => {
  assert.strictEqual(G.COTE, 120);
  assert.deepStrictEqual(G.POSITIONS_RACCORD, [30, 60, 90]);
  assert.strictEqual(G.MIN_PORTS_JONCTION, 2);
  assert.deepStrictEqual(G.GRILLE, { colonnes: 4, lignes: 4 });
});

test('bitRaccord', () => {
  assert.strictEqual(G.bitRaccord(0, 0), 0);
  assert.strictEqual(G.bitRaccord(1, 1), 4);
  assert.strictEqual(G.bitRaccord(3, 2), 11);
});

test('T1 : 0x050 tourné d\'un quart donne 0x280, puis retour à 0x050 après 4', () => {
  assert.strictEqual(G.tournerRaccords(0x050, 1), 0x280);
  assert.strictEqual(G.tournerRaccords(0x050, 4), 0x050);
});

test('rotation x4 = identité pour masques et points', () => {
  for (let m = 0; m < 4096; m += 7) {
    assert.strictEqual(G.tournerRaccords(m, 4), m);
    assert.strictEqual(G.tournerRaccords(G.tournerRaccords(m, 1), 3), m);
  }
  for (let c = 0; c < 16; c++) assert.strictEqual(G.tournerPorts(c, 4), c);
  const p = { x: 30, y: 0 };
  assert.deepStrictEqual(G.tournerPoint(p, 4), p);
  assert.deepStrictEqual(G.tournerPoint({ x: 17, y: 93 }, 4), { x: 17, y: 93 });
});

test('rotation des ports : 0b0100 -> 0b1000', () => {
  assert.strictEqual(G.tournerPorts(0b0100, 1), 0b1000);
  assert.strictEqual(G.tournerPorts(0b1000, 1), 0b0001);
});

test('rotation de point cohérente avec la rotation des raccords', () => {
  for (let cote = 0; cote < 4; cote++) {
    for (let pos = 0; pos < 3; pos++) {
      const tourne = G.tournerPoint(G.pointRaccord(cote, pos), 1);
      assert.deepStrictEqual(tourne, G.pointRaccord((cote + 1) % 4, pos));
    }
    assert.deepStrictEqual(G.tournerPoint(G.pointCoin(cote), 1), G.pointCoin((cote + 1) % 4));
  }
});

test('points de raccord et de coin', () => {
  assert.deepStrictEqual(G.pointRaccord(0, 0), { x: 30, y: 0 });
  assert.deepStrictEqual(G.pointRaccord(1, 2), { x: 120, y: 90 });
  assert.deepStrictEqual(G.pointRaccord(2, 0), { x: 90, y: 120 });
  assert.deepStrictEqual(G.pointRaccord(3, 0), { x: 0, y: 90 });
  assert.deepStrictEqual(G.pointCoin(2), { x: 120, y: 120 });
});

test('triplet, inverser3', () => {
  assert.strictEqual(G.triplet(0x050, 1), 2);
  assert.strictEqual(G.triplet(0x050, 2), 1);
  assert.strictEqual(G.inverser3(1), 4);
  assert.strictEqual(G.inverser3(4), 1);
  assert.strictEqual(G.inverser3(2), 2);
  assert.strictEqual(G.inverser3(7), 7);
});

test('T2 : A (E début) face à B (O fin) connectés, B (O début) : 2 morts', () => {
  let r = G.apparier(0x008, 1, 0x800);
  assert.strictEqual(r.connectes, 1);
  assert.strictEqual(r.mortsA, 0);
  assert.strictEqual(r.mortsB, 0);
  r = G.apparier(0x008, 1, 0x200);
  assert.strictEqual(r.connectes, 0);
  assert.strictEqual(r.mortsA, 1);
  assert.strictEqual(r.mortsB, 1);
});

test('positions face à face : p rencontre 2 - p', () => {
  for (let p = 0; p < 3; p++) {
    const mA = 1 << G.bitRaccord(1, p);
    const mB = 1 << G.bitRaccord(3, 2 - p);
    assert.strictEqual(G.apparier(mA, 1, mB).connectes, 1 << p);
    // la même position (non inversée) ne se connecte que pour p = 1
    assert.strictEqual(G.apparier(mA, 1, 1 << G.bitRaccord(3, p)).connectes !== 0, p === 1);
  }
});

test('apparier symétrique', () => {
  for (let i = 0; i < 300; i++) {
    const mA = (i * 2654435761) & 0xFFF, mB = (i * 40503 + 77) & 0xFFF;
    for (let cote = 0; cote < 4; cote++) {
      const ab = G.apparier(mA, cote, mB);
      const ba = G.apparier(mB, (cote + 2) % 4, mA);
      assert.strictEqual(ab.mortsA, ba.mortsB);
      assert.strictEqual(ab.mortsB, ba.mortsA);
      assert.strictEqual(G.inverser3(ab.connectes), ba.connectes);
    }
  }
});

test('coteVoisin', () => {
  assert.deepStrictEqual(G.coteVoisin(0), { dc: 0, dl: -1 });
  assert.deepStrictEqual(G.coteVoisin(1), { dc: 1, dl: 0 });
  assert.deepStrictEqual(G.coteVoisin(2), { dc: 0, dl: 1 });
  assert.deepStrictEqual(G.coteVoisin(3), { dc: -1, dl: 0 });
});

test('raccordEnFace : côté opposé, position 2 - p, involutive', () => {
  assert.deepStrictEqual(G.raccordEnFace(1, 0), { cote: 3, pos: 2 });
  assert.deepStrictEqual(G.raccordEnFace(0, 1), { cote: 2, pos: 1 });
  for (let c = 0; c < 4; c++) for (let p = 0; p < 3; p++) {
    const f = G.raccordEnFace(c, p);
    assert.deepStrictEqual(G.raccordEnFace(f.cote, f.pos), { cote: c, pos: p });
  }
});

test('rotation : un nombre de quarts non entier compte pour 0, négatif accepté', () => {
  assert.strictEqual(G.tournerRaccords(0x050, 0.5), 0x050);
  assert.strictEqual(G.tournerRaccords(0x050, NaN), 0x050);
  assert.strictEqual(G.tournerPorts(0b0100, 'a'), 0b0100);
  assert.strictEqual(G.tournerRaccords(0x050, -3), 0x280);
  assert.deepStrictEqual(G.tournerPoint({ x: 30, y: 0 }, undefined), { x: 30, y: 0 });
});
