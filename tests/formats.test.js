'use strict';
// Formats de grille 4×4 et 5×5 (docs/20-avis-geometrie-v2.md, D4, D5 et cas de test T1, T2).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/export.js');
require('../src/assemblage.js');
require('../src/editeur-tuile.js');
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele;
const F4 = G.format('4x4'), F5 = G.format('5x5');

test('les deux formats existent, un format inconnu est refusé', () => {
  assert.deepEqual([...G.FORMATS], ['4x4', '5x5']);
  assert.ok(Object.isFrozen(G.FORMATS));
  assert.equal(F4.id, '4x4');
  assert.equal(F5.id, '5x5');
  assert.equal(G.format('4x4'), F4, 'même objet à chaque appel');
  assert.equal(G.format('5x5'), F5);
  assert.throws(() => G.format('6x6'), /Format de grille inconnu/);
  assert.throws(() => G.format(undefined), /Format de grille inconnu/);
});

test('valeurs du tableau D4', () => {
  const communes = {
    RAYON_ZONE_COIN: 20, DIAMETRE_JETON: 30, DIAMETRE_CASE_JONCTION: 24, LARGEUR_CHEMIN: 8,
    AMORCE_RACCORD: 10, AMORCE_PORT: 28, MARGE_COUPE_CASE: 4, FOND_PERDU: 3, PAS_EDITEUR: 10
  };
  for (const F of [F4, F5]) for (const [k, v] of Object.entries(communes)) assert.equal(F[k], v, F.id + ' ' + k);
  assert.equal(F4.COTE, 120);
  assert.deepEqual([...F4.POSITIONS_RACCORD], [30, 60, 90]);
  assert.equal(F4.DIAMETRE_CASE_MAX, 30);
  assert.deepEqual({ ...F4.GRILLE }, { colonnes: 4, lignes: 4 });
  assert.equal(F5.COTE, 100);
  assert.deepEqual([...F5.POSITIONS_RACCORD], [30, 50, 70]);
  assert.equal(F5.DIAMETRE_CASE_MAX, 24);
  assert.deepEqual({ ...F5.GRILLE }, { colonnes: 5, lignes: 5 });
});

test('objets gelés : une modification lève une erreur (mode strict)', () => {
  for (const F of [F4, F5]) {
    assert.ok(Object.isFrozen(F) && Object.isFrozen(F.GRILLE) && Object.isFrozen(F.POSITIONS_RACCORD));
    assert.throws(() => { F.COTE = 1; }, TypeError);
    assert.throws(() => { F.GRILLE.colonnes = 9; }, TypeError);
    assert.throws(() => { F.POSITIONS_RACCORD[0] = 1; }, TypeError);
    assert.throws(() => { F.nouveau = 1; }, TypeError);
  }
  assert.equal(F4.COTE, 120);
});

test('PM.geometrie.* est un alias de format(\'4x4\')', () => {
  for (const k of Object.keys(F4)) {
    if (k === 'id') continue;
    assert.equal(G[k], F4[k], k);
  }
  assert.equal(G.FORMAT_DEFAUT, '4x4');
  assert.equal(typeof G.format, 'function');
});

test('formatDuDocument : champ absent = 4×4', () => {
  assert.equal(M.formatDuDocument(M.nouveauDocument()), F4);
  assert.equal(M.formatDuDocument(undefined), F4);
  assert.equal(M.formatDuDocument({ format: '5x5' }), F5);
  assert.throws(() => M.formatDuDocument({ format: 'hexagone' }), /Format de grille inconnu/);
});

test('raccourci D5 : rotations des masques', () => {
  for (const F of [F4, F5]) {
    assert.equal(F.tournerRaccords(0x808, 2), 0x220);
    assert.equal(F.tournerRaccords(0x108, 2), 0x204);
    assert.equal(F.tournerRaccords(0x808, 1), 0x044);
  }
});

test('T1 : coin et bord du raccourci appariés (les deux formats)', () => {
  for (const F of [F4, F5]) {
    // coin 0x108 en (0,0) rot 0, bord 0x808 en (1,0) rot 0 : côté E du coin contre côté O du bord
    assert.equal(F.apparier(0x108, 1, 0x808).connectes, 1);
    // coin (3,3) rot 2 (0x204) au sud du bord (3,2) rot 1 (0x044)
    assert.equal(F.apparier(0x044, 2, 0x204).connectes, 1);
  }
});

test('T2 : deux bords retournés 0x220 côte à côte, raccord p2 connecté', () => {
  for (const F of [F4, F5]) assert.equal(F.apparier(0x220, 1, 0x220).connectes, 4);
});

test('pointRaccord et pointCoin 5×5 sur 100 mm', () => {
  assert.deepEqual(F5.pointRaccord(0, 0), { x: 30, y: 0 });
  assert.deepEqual(F5.pointRaccord(0, 1), { x: 50, y: 0 });
  assert.deepEqual(F5.pointRaccord(0, 2), { x: 70, y: 0 });
  assert.deepEqual(F5.pointRaccord(1, 0), { x: 100, y: 30 });
  assert.deepEqual(F5.pointRaccord(2, 0), { x: 70, y: 100 });
  assert.deepEqual(F5.pointRaccord(3, 0), { x: 0, y: 70 });
  assert.deepEqual(F5.pointCoin(2), { x: 100, y: 100 });
  // le format 4×4 n'est pas modifié
  assert.deepEqual(F4.pointRaccord(1, 0), { x: 120, y: 30 });
  assert.deepEqual(G.pointRaccord(2, 1), { x: 60, y: 120 });
});

test('tournerPoint 5×5 autour de (50, 50) : ×4 = identité, un quart envoie chaque raccord sur le côté suivant', () => {
  for (const p of [{ x: 30, y: 0 }, { x: 17, y: 83 }, { x: 50, y: 50 }, { x: 100, y: 0 }]) {
    assert.deepEqual(F5.tournerPoint(p, 4), p);
    assert.deepEqual(F5.tournerPoint(F5.tournerPoint(p, 1), 3), p);
  }
  assert.deepEqual(F5.tournerPoint({ x: 50, y: 50 }, 1), { x: 50, y: 50 });
  for (let cote = 0; cote < 4; cote++) {
    for (let pos = 0; pos < 3; pos++) assert.deepEqual(F5.tournerPoint(F5.pointRaccord(cote, pos), 1), F5.pointRaccord((cote + 1) % 4, pos));
  }
});

test('les fonctions paramétrées suivent le format passé (sans règle v2)', () => {
  const forme = { retires: [] };
  assert.equal(M.cellulesActives(forme).length, 16);
  assert.equal(M.cellulesActives(forme, '5x5').length, 25);
  assert.equal(M.campJonction(2, 3), 2);
  assert.equal(M.campJonction(2, 3, F5), null);
  assert.equal(M.campJonction(2, 4, F5), 2);
  assert.equal(PM.assemblage.celluleSous(490, 490), null);
  assert.deepEqual(PM.assemblage.celluleSous(490, 490, F5), { col: 4, lig: 4 });
  assert.deepEqual(PM.assemblage.jonctionSous(400, 400, F5), { i: 4, j: 4 });
  assert.deepEqual(PM.assemblage.vuePour(), PM.assemblage.VUE);
  assert.deepEqual(PM.assemblage.VUE, { x: -40, y: -52, w: 560, h: 600 });
  assert.deepEqual(PM.assemblage.vuePour(F5), { x: -40, y: -52, w: 580, h: 620 });
  assert.deepEqual(PM.editeurTuile.vuePour(F5), { x: -16, y: -16, l: 132, h: 132 });
  // case Ø 30 : admise en 4×4, trop grande en 5×5 (case max Ø 24)
  const m = { id: 'm', role: 'centrale', exemplaires: 1, cases: [{ id: 'c1', x: 50, y: 50, diametre: 30, type: 'deplacement' }], chemins: [] };
  const codes = (F) => M.validerModele(m, F).erreurs.map((e) => e.code);
  assert.ok(!codes().includes('diametre'));
  assert.ok(codes('5x5').includes('diametre'));
  assert.match(PM.rendu.svgTuile(m, { format: F5 }), /width="100mm" height="100mm"/);
  assert.match(PM.rendu.svgTuile(m), /width="120mm" height="120mm"/);
});

test('export : tuile avec fond perdu de 106 mm en 5×5, 126 mm en 4×4', () => {
  const E = PM.exportation;
  assert.equal(E.COTE_PLANCHE, 126);
  assert.equal(E.PAS, 132);
  // centrale complète du format 5×5 (règles v1 : 4 cases, 4 ports, raccords sur 4 côtés)
  const k = (id, x, y) => ({ id, x, y, diametre: 24, type: 'deplacement' });
  const modele = {
    id: 'c5', nom: 'Centrale 5×5', role: 'centrale', exemplaires: 1,
    cases: [k('c1', 32, 32), k('c2', 68, 32), k('c3', 68, 68), k('c4', 32, 68)],
    chemins: [
      { id: 'h1', a: { case: 'c1' }, b: { case: 'c2' } }, { id: 'h2', a: { case: 'c2' }, b: { case: 'c3' } },
      { id: 'h3', a: { case: 'c3' }, b: { case: 'c4' } },
      { id: 'p1', a: { case: 'c1' }, b: { coin: 0 } }, { id: 'p2', a: { case: 'c2' }, b: { coin: 1 } },
      { id: 'p3', a: { case: 'c3' }, b: { coin: 2 } }, { id: 'p4', a: { case: 'c4' }, b: { coin: 3 } },
      { id: 'r1', a: { case: 'c1' }, b: { raccord: { cote: 0, pos: 0 } } }, { id: 'r2', a: { case: 'c2' }, b: { raccord: { cote: 1, pos: 1 } } },
      { id: 'r3', a: { case: 'c3' }, b: { raccord: { cote: 2, pos: 1 } } }, { id: 'r4', a: { case: 'c4' }, b: { raccord: { cote: 3, pos: 1 } } }
    ]
  };
  assert.deepEqual(M.validerModele(modele, F5).erreurs, []);
  const doc5 = { format: '5x5', version: 1, modeles: [modele], plateau: { forme: { retires: [] }, tuiles: [], jetons: [] } };
  const [planche] = E.calepiner(doc5, { format: 'A3' });
  const marges5 = E.margesFormat('A3', '5x5');
  assert.equal(planche.pas, 112);
  assert.equal(marges5.x, (297 - (2 * 106 + 6)) / 2);
  assert.equal(planche.tuiles[0].x, marges5.x);
  assert.match(planche.svg, /<clipPath id="pm-clip-1"><rect x="-3" y="-3" width="106" height="106"\/>/);
  assert.equal(E.margesFormat('A3').x, (297 - (2 * 126 + 6)) / 2);
});
