'use strict';
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/hex.js');
const C = require('../src/catalogue.js');

test('totaux du catalogue 2 : 24 pièces de construction pour 91 cases ; 21 monoblocs = 53 plaines / 11 forêts / 11 marais', () => {
  const t = C.totaux();
  assert.deepStrictEqual(t.construction, { pieces: 24, cases: 91 });
  assert.strictEqual(t.pieces, 28, 'avec 2 remplissages et 2 villes neutres');
  assert.strictEqual(t.cases, 95);
  assert.strictEqual(t.facultatives, 2);
  assert.strictEqual(t.parTerrain.montagne, 9);
  assert.strictEqual(t.parTerrain.foret, 11);
  assert.strictEqual(t.parTerrain.marais, 11);
  assert.strictEqual(t.parTerrain.ville, 3, 'le centre et les 2 villes neutres');
  // Les 21 monoblocs de terrain : 75 cases.
  const terrain = C.idsParRole('terrain'), n = { plaine: 0, foret: 0, marais: 0 };
  assert.strictEqual(terrain.length, 21);
  terrain.forEach((id) => C.MODELES[id].cases.forEach((c) => { n[c.terrain] += C.MODELES[id].nombre; }));
  assert.deepStrictEqual(n, { plaine: 53, foret: 11, marais: 11 });
});

test('catalogue 2 : terrain en monoblocs de 3 ou 4 cases seulement, composition du cahier des charges (§9.2)', () => {
  assert.deepStrictEqual(Object.keys(C.MODELES).sort(), C.ORDRE_MODELES.slice().sort());
  const compo = (id) => { const m = C.MODELES[id], c = { plaine: 0, foret: 0, marais: 0 }; m.cases.forEach((x) => { c[x.terrain] += 1; }); return m.cases.length + ':' + c.plaine + '/' + c.foret + '/' + c.marais; };
  const compte = {};
  C.idsParRole('terrain').forEach((id) => {
    const m = C.MODELES[id];
    assert.strictEqual(m.id, id);
    assert.strictEqual(m.nombre, 1, id);
    assert.ok(m.cases.length === 3 || m.cases.length === 4, id + ' : 3 ou 4 cases');
    assert.ok(m.cases.every((c) => ['plaine', 'foret', 'marais'].includes(c.terrain)), id);
    compte[compo(id)] = (compte[compo(id)] || 0) + 1;
  });
  // « cases:plaines/forêts/marais » → nombre de pièces.
  assert.deepStrictEqual(compte, {
    '4:4/0/0': 5, '4:3/1/0': 2, '4:3/0/1': 2, '4:2/2/0': 1, '4:2/0/2': 1, '4:2/1/1': 1,
    '3:3/0/0': 3, '3:0/3/0': 1, '3:0/0/3': 1, '3:1/2/0': 1, '3:1/0/2': 1, '3:2/1/0': 1, '3:2/0/1': 1
  });
  // Aucune pièce de terrain d'une case au catalogue, sauf le remplissage (l'exception) ; les montagnes restent des blocs.
  const uneCase = C.ORDRE_MODELES.filter((id) => C.MODELES[id].cases.length === 1);
  assert.deepStrictEqual(uneCase, ['R', 'VN']);
  assert.strictEqual(C.MODELES.R.role, 'remplissage');
  assert.strictEqual(C.MODELES.R.facultatif, true);
  assert.deepStrictEqual(C.MODELES.R.cases, [{ q: 0, r: 0, terrain: 'plaine' }]);
  assert.deepStrictEqual(C.MODELES.VN.cases, [{ q: 0, r: 0, terrain: 'ville' }]);
  assert.strictEqual(C.MODELES.VN.nombre, 2);
  assert.deepStrictEqual(C.idsParRole('montagne'), ['M4', 'M5']);
  assert.deepStrictEqual(C.VILLE_DEPLOIEMENT, { id: 'VD', nom: 'Ville de déploiement', nombre: 4, parCamp: 2, camps: ['vert', 'rouge'] });
  assert.strictEqual(C.estConstruction(C.MODELES.N1) && C.estConstruction(C.MODELES.M4) && C.estConstruction(C.MODELES.P4A), true);
  assert.strictEqual(C.estConstruction(C.MODELES.R) || C.estConstruction(C.MODELES.VN), false);
});

test('formes variées : 3 formes de 3 cases et 6 formes de 4 cases, à rotation près', () => {
  const canon = (cases) => {
    let mieux = null;
    for (let rot = 0; rot < 6; rot++) {
      const pts = cases.map((c) => H.tourner(c.q, c.r, rot));
      const q0 = Math.min(...pts.map((p) => p.q)), r0 = Math.min(...pts.filter((p) => p.q === q0).map((p) => p.r));
      const sig = pts.map((p) => (p.q - q0) + ',' + (p.r - r0)).sort().join(' ');
      if (mieux === null || sig < mieux) mieux = sig;
    }
    return mieux;
  };
  const formes = { 3: new Set(), 4: new Set() };
  C.idsParRole('terrain').forEach((id) => formes[C.MODELES[id].cases.length].add(canon(C.MODELES[id].cases)));
  assert.strictEqual(formes[3].size, 3);
  assert.strictEqual(formes[4].size, 6);
});

test('anciens fichiers : les identifiants du premier catalogue gardent exactement leurs cases', () => {
  const cases = (id) => C.modele(id).cases.map((c) => c.q + ',' + c.r + ':' + c.terrain).join(' ');
  assert.strictEqual(cases('N1'), '0,0:ville 1,0:plaine 1,-1:plaine 0,-1:plaine -1,0:plaine -1,1:plaine 0,1:plaine');
  assert.strictEqual(cases('M4'), '0,0:montagne 1,0:montagne 1,1:montagne 2,1:montagne');
  assert.strictEqual(cases('M5'), '0,0:montagne 1,0:montagne 2,0:montagne 0,1:montagne 1,1:montagne');
  assert.strictEqual(cases('F3'), '0,0:foret 1,0:foret 0,1:foret');
  assert.strictEqual(cases('S3'), '0,0:marais 1,0:marais 0,1:marais');
  assert.strictEqual(cases('F31'), '0,0:foret 1,0:plaine 0,1:plaine 1,1:plaine');
  assert.strictEqual(cases('S31'), '0,0:marais 1,0:plaine 0,1:plaine 1,1:plaine');
  assert.strictEqual(cases('F21'), '0,0:foret 1,0:foret 1,1:plaine');
  assert.strictEqual(cases('S21'), '0,0:marais 1,0:marais 1,1:plaine');
  // Tuiles d'une case du premier catalogue : toujours connues, hors catalogue imprimé, quantité 0.
  assert.deepStrictEqual(C.ORDRE_HORS_CATALOGUE, ['M1', 'P', 'F', 'S', 'V']);
  [['P', 'plaine'], ['F', 'foret'], ['S', 'marais'], ['V', 'ville'], ['M1', 'montagne']].forEach(([id, terrain]) => {
    const m = C.modele(id);
    assert.deepStrictEqual(m.cases, [{ q: 0, r: 0, terrain }]);
    assert.strictEqual(m.nombre, 0);
    assert.strictEqual(m.horsCatalogue, true);
    assert.strictEqual(C.ORDRE_MODELES.includes(id), false);
  });
  assert.strictEqual(C.modele('P').ancien && C.modele('F').ancien && C.modele('S').ancien && C.modele('V').ancien, true);
  assert.strictEqual(C.VERSION, 2);
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
