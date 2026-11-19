'use strict';
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/hex.js');
const C = require('../src/catalogue.js');

test('totaux du cahier des charges : 64 pièces, 91 cases, 53 plaines / 11 forêts / 11 marais', () => {
  const t = C.totaux();
  assert.strictEqual(t.pieces, 64);
  assert.strictEqual(t.cases, 91);
  assert.strictEqual(t.parTerrain.plaine, 53);
  assert.strictEqual(t.parTerrain.foret, 11);
  assert.strictEqual(t.parTerrain.marais, 11);
  assert.strictEqual(t.parTerrain.ville, 7);
  assert.strictEqual(t.parTerrain.montagne, 9);
  assert.strictEqual(Object.keys(t.parTerrain).length, 5);
});

test('13 modèles, tous listés dans l’ordre d’affichage, nombres du cahier des charges', () => {
  assert.deepStrictEqual(Object.keys(C.MODELES).sort(), C.ORDRE_MODELES.slice().sort());
  const nombres = { N1: 1, M4: 1, M5: 1, V: 6, F3: 1, F31: 1, F21: 1, S3: 1, S31: 1, S21: 1, P: 39, F: 5, S: 5 };
  const tailles = { N1: 7, M4: 4, M5: 5, V: 1, F3: 3, F31: 4, F21: 3, S3: 3, S31: 4, S21: 3, P: 1, F: 1, S: 1 };
  C.ORDRE_MODELES.forEach((id) => {
    assert.strictEqual(C.MODELES[id].id, id);
    assert.strictEqual(C.MODELES[id].nombre, nombres[id], id);
    assert.strictEqual(C.MODELES[id].cases.length, tailles[id], id);
  });
});

test('A2 : aucune ville dans un monobloc hors noyau ; le noyau est une ville entourée de 6 plaines', () => {
  assert.deepStrictEqual(C.monoblocsAvecVille(), []);
  C.ORDRE_MODELES.forEach((id) => {
    const m = C.MODELES[id];
    if (m.cases.length > 1 && !m.noyau) assert.ok(m.cases.every((c) => c.terrain !== 'ville'), id);
  });
  const n = C.MODELES.N1;
  assert.strictEqual(n.noyau, true);
  assert.deepStrictEqual(n.cases[0], { q: 0, r: 0, terrain: 'ville' });
  assert.deepStrictEqual(n.cases.slice(1).map((c) => c.terrain), ['plaine', 'plaine', 'plaine', 'plaine', 'plaine', 'plaine']);
  assert.deepStrictEqual(n.cases.slice(1).map((c) => H.cle(c.q, c.r)).sort(), H.voisines('0,0').sort());
  assert.strictEqual(C.ORDRE_MODELES.filter((id) => C.MODELES[id].noyau).length, 1);
});

test('chaque forme part de (0,0), sans case en double, d’un seul tenant', () => {
  C.ORDRE_MODELES.forEach((id) => {
    const cles = C.MODELES[id].cases.map((c) => H.cle(c.q, c.r));
    assert.strictEqual(cles[0], '0,0', id);
    assert.strictEqual(new Set(cles).size, cles.length, id);
    const vues = new Set([cles[0]]), file = [cles[0]];
    while (file.length) H.voisines(file.pop()).forEach((v) => { if (cles.includes(v) && !vues.has(v)) { vues.add(v); file.push(v); } });
    assert.strictEqual(vues.size, cles.length, id + ' n’est pas d’un seul tenant');
  });
});

test('contenu des monoblocs de forêt et de marais ; jumeaux de même forme', () => {
  const terrains = (id) => C.MODELES[id].cases.map((c) => c.terrain);
  assert.deepStrictEqual(terrains('F3'), ['foret', 'foret', 'foret']);
  assert.deepStrictEqual(terrains('F31'), ['foret', 'plaine', 'plaine', 'plaine']);
  assert.deepStrictEqual(terrains('F21'), ['foret', 'foret', 'plaine']);
  assert.deepStrictEqual(terrains('S3'), ['marais', 'marais', 'marais']);
  assert.deepStrictEqual(terrains('S31'), ['marais', 'plaine', 'plaine', 'plaine']);
  assert.deepStrictEqual(terrains('S21'), ['marais', 'marais', 'plaine']);
  [['F3', 'S3'], ['F31', 'S31'], ['F21', 'S21']].forEach(([f, s]) => {
    assert.deepStrictEqual(C.MODELES[f].cases.map((c) => [c.q, c.r]), C.MODELES[s].cases.map((c) => [c.q, c.r]));
  });
  assert.ok(terrains('M4').concat(terrains('M5')).every((t) => t === 'montagne'));
});

test('réserve : 8 événements uniques, terrain effectif doté d’un coût', () => {
  assert.deepStrictEqual(Object.keys(C.EVENEMENTS).sort(), C.ORDRE_EVENEMENTS.slice().sort());
  assert.strictEqual(C.ORDRE_EVENEMENTS.length, 8);
  C.ORDRE_EVENEMENTS.forEach((id) => {
    const e = C.EVENEMENTS[id];
    assert.strictEqual(e.id, id);
    assert.ok(e.nom.length > 0 && e.effet.length > 0);
    assert.ok(Object.prototype.hasOwnProperty.call(C.REGLAGES.couts, e.terrain), id + ' : terrain sans coût');
  });
  assert.strictEqual(C.coutTerrain('boue'), 3);
  assert.strictEqual(C.coutTerrain('crevasse'), Infinity);
  assert.strictEqual(C.coutTerrain('tunnel'), 2);
  assert.strictEqual(C.coutTerrain('terre_brulee'), 1);
  assert.strictEqual(C.coutTerrain('eboulement'), Infinity);
  assert.strictEqual(C.coutTerrain('chaussee'), 1);
});

test('réglages provisoires regroupés : coûts, contact, villes', () => {
  const R = C.REGLAGES;
  assert.deepStrictEqual([R.couts.plaine, R.couts.foret, R.couts.marais, R.couts.ville, R.couts.montagne], [1, 2, 2, 1, null]);
  assert.strictEqual(R.seuilContact, 3);
  assert.strictEqual(R.mesureContact, 'pieces');
  assert.deepStrictEqual(R.seuilsContact, [2, 3]);
  assert.deepStrictEqual(R.mesuresContact, ['cotes', 'pieces']);
  assert.strictEqual(R.nombreVilles, 7);
  assert.strictEqual(R.villesParCamp, 2);
  assert.strictEqual(R.ecartVilles, 4);
  assert.strictEqual(C.coutTerrain('montagne'), Infinity);
  assert.strictEqual(C.coutTerrain('terrain inconnu'), Infinity);
  assert.strictEqual(C.coutTerrain('foret', { foret: 3 }), 3);
  assert.doesNotThrow(() => JSON.stringify({ m: C.MODELES, e: C.EVENEMENTS, r: R }));
});

test('modele et evenement : null pour un identifiant inconnu ou piégé', () => {
  assert.strictEqual(C.modele('P').nom, 'Plaine');
  assert.strictEqual(C.evenement('E3').nom, 'Tunnel');
  for (const id of ['X', '', '__proto__', 'constructor', 'toString', 'hasOwnProperty', null, undefined, 3, {}]) {
    assert.strictEqual(C.modele(id), null);
    assert.strictEqual(C.evenement(id), null);
  }
});
