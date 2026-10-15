'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
const M = globalThis.PM.modele;
const GR = globalThis.PM.graphe;

/* ---------------------------------------------------------------------- */
/* Petits graphes faits main : { noeuds, voisins, cases, jonctions, villes, apparitions }              */
/* ---------------------------------------------------------------------- */

/**
 * aretes : [['a', 'b'], ...] ; villes : ids de nœuds villes ; apparitions : {1: [ids], 2: [ids]}.
 * Les nœuds dont l'id commence par « J » sont des jonctions (ville si listés dans `villes`, sinon carrefour).
 */
function main(aretes, villes, apparitions, traversables) {
  const voisins = new Map(), cases = new Map();
  const noeud = (x) => { if (!voisins.has(x)) { voisins.set(x, new Set()); if (!x.startsWith('J')) cases.set(x, { id: x }); } };
  for (const [a, b] of aretes) { noeud(a); noeud(b); voisins.get(a).add(b); voisins.get(b).add(a); }
  const jonctions = [...voisins.keys()].filter((x) => x.startsWith('J')).map((id, n) => ({
    id, i: n + 1, j: 1, type: villes.includes(id) ? 'capture' : 'carrefour', ports: voisins.get(id).size, cases: []
  }));
  return {
    noeuds: [...voisins.keys()], voisins, cases, jonctions, villes: new Set(villes),
    apparitions: Object.assign({ 1: [], 2: [] }, apparitions), villesTraversables: traversables !== false
  };
}

test('distances : chaîne a-b-c-d et plusieurs sources', () => {
  const g = main([['a', 'b'], ['b', 'c'], ['c', 'd']], [], {});
  assert.deepStrictEqual([...GR.distances(g, 'a')], [['a', 0], ['b', 1], ['c', 2], ['d', 3]]);
  const d = GR.distances(g, ['a', 'd']);
  assert.strictEqual(d.get('b'), 1);
  assert.strictEqual(d.get('c'), 1);
  assert.strictEqual(GR.distances(g, 'inconnu').size, 0);
});

test('distancesJoueur : minimum sur les apparitions du joueur', () => {
  const g = main([['s1', 'x'], ['x', 'y'], ['y', 'z'], ['z', 's2']], [], { 1: ['s1', 's2'] });
  const d = GR.distancesJoueur(g, 1);
  assert.strictEqual(d.get('y'), 2);
  assert.strictEqual(d.get('x'), 1);
  assert.strictEqual(d.get('z'), 1);
  assert.strictEqual(GR.distancesJoueur(g, 2).size, 0); // aucune apparition : rien d'atteint
});

test('villes non traversables : la ville est une destination, pas un passage', () => {
  // s - Va - t ; t n'est joignable que par la ville Va
  const aretes = [['s', 'Va'], ['Va', 't']];
  const gT = main(aretes, ['Va'], { 1: ['s'] }, true);
  const gN = main(aretes, ['Va'], { 1: ['s'] }, false);
  assert.strictEqual(GR.distancesJoueur(gT, 1).get('t'), 2);
  assert.strictEqual(GR.distancesJoueur(gN, 1).get('Va'), 1);   // la ville reste atteignable
  assert.strictEqual(GR.distancesJoueur(gN, 1).has('t'), false); // mais on n'en ressort pas
  // une ville peut être le point de départ d'un parcours
  assert.strictEqual(GR.distances(gN, 'Va').get('t'), 1);
});

test('villes non traversables : détour plus long, aucune distance ne diminue', () => {
  // raccourci s - Va - t (2 pas) contre détour s - p - q - r - t (4 pas)
  const aretes = [['s', 'Va'], ['Va', 't'], ['s', 'p'], ['p', 'q'], ['q', 'r'], ['r', 't']];
  const dT = GR.distancesJoueur(main(aretes, ['Va'], { 1: ['s'] }, true), 1);
  const dN = GR.distancesJoueur(main(aretes, ['Va'], { 1: ['s'] }, false), 1);
  assert.strictEqual(dT.get('t'), 2);
  assert.strictEqual(dN.get('t'), 4);
  for (const [id, d] of dN) assert.ok(d >= dT.get(id), id);
});

test('carrefour : reste traversable même quand les villes ne le sont pas', () => {
  const g = main([['s', 'Jc'], ['Jc', 't']], [], { 1: ['s'] }, false); // Jc n'est pas dans `villes` : carrefour
  assert.strictEqual(GR.distancesJoueur(g, 1).get('t'), 2);
});

test('goulets : les chemins sont disjoints hors du point de départ (apparition)', () => {
  // une seule apparition : les deux branches du losange partent toutes deux de s
  const g2 = main([['s', 'a'], ['s', 'b'], ['a', 'Jt'], ['b', 'Jt']], ['Jt'], { 1: ['s'] });
  let r = GR.goulets(g2, 1);
  assert.strictEqual(r.parVille[0].chemins, 2);
  assert.ok(r.articulations.some((x) => x.id === 's') === false); // l'apparition elle-même n'est jamais listée
  const g3 = main([['s1', 'a'], ['s2', 'b'], ['a', 'Jt'], ['b', 'Jt']], ['Jt'], { 1: ['s1', 's2'] });
  r = GR.goulets(g3, 1);
  assert.strictEqual(r.parVille[0].chemins, 2);
  assert.strictEqual(r.minChemins, 2);
  assert.deepStrictEqual(r.articulations, []);
});

test('goulets : un nœud papillon est un point d\'articulation', () => {
  // s1, s2 convergent en m, puis m - n - ville ; deux villes derrière m
  const g = main([['s1', 'm'], ['s2', 'm'], ['m', 'a'], ['m', 'b'], ['a', 'Jx'], ['b', 'Jy']], ['Jx', 'Jy'], { 1: ['s1', 's2'] });
  const r = GR.goulets(g, 1);
  assert.deepStrictEqual(r.parVille.map((x) => x.chemins), [1, 1]);
  const ids = r.articulations.map((x) => x.id).sort();
  assert.ok(ids.includes('m'));
  const m = r.articulations.find((x) => x.id === 'm');
  assert.strictEqual(m.villesCoupees.length, 2);
  assert.strictEqual(m.type, 'case');
  // le joueur 2 n'a pas d'apparition : 0 chemin, aucune articulation
  const r2 = GR.goulets(g, 2);
  assert.deepStrictEqual(r2.parVille.map((x) => x.chemins), [0, 0]);
  assert.deepStrictEqual(r2.articulations, []);
});

test('goulets : une ville non traversable ne sert pas d\'intermédiaire', () => {
  // deux chemins vers Jt : l'un direct (a), l'autre par la ville Jv
  const aretes = [['s1', 'a'], ['a', 'Jt'], ['s2', 'Jv'], ['Jv', 'Jt']];
  const apps = { 1: ['s1', 's2'] };
  assert.strictEqual(GR.goulets(main(aretes, ['Jt', 'Jv'], apps, true), 1).parVille.find((x) => x.id === 'Jt').chemins, 2);
  assert.strictEqual(GR.goulets(main(aretes, ['Jt', 'Jv'], apps, false), 1).parVille.find((x) => x.id === 'Jt').chemins, 1);
});

/* ---------------------------------------------------------------------- */
/* Construction depuis un document                                         */
/* ---------------------------------------------------------------------- */

/** Plateau 4x4 complet avec les modèles d'exemple (4 exemplaires par rôle), jetons sur les 9 jonctions si possible. */
function plateauExemples() {
  let doc = M.nouveauDocument();
  doc.modeles = M.copieExemples();
  for (const c of M.cellulesActives(doc.plateau.forme)) {
    const role = M.roleCellule(c.col, c.lig, doc.plateau.forme);
    doc = M.poserTuile(doc, doc.modeles.find((m) => m.role === role).id, c.col, c.lig);
  }
  return doc;
}

test('construire : plateau d\'exemples, jetons seulement là où ils sont posés', () => {
  let doc = plateauExemples();
  let g = GR.construire(doc);
  assert.strictEqual(g.jonctions.length, 0);           // aucun jeton : aucun nœud de jonction
  assert.deepStrictEqual([g.apparitions[1].length, g.apparitions[2].length], [2, 2]);
  assert.strictEqual(g.cases.size, 4 * 4 + 4 * 3 + 4 * 3 + 4 * 3);
  doc = M.poserJeton(doc, 2, 2, 'capture');
  doc = M.poserJeton(doc, 1, 1, 'carrefour');
  g = GR.construire(doc);
  assert.deepStrictEqual(g.jonctions.map((j) => [j.id, j.type]), [['J2,2', 'capture'], ['J1,1', 'carrefour']]);
  assert.strictEqual(g.jonctions[0].ports, 4);
  assert.strictEqual(g.voisins.get('J2,2').size, 4);
  assert.ok(g.villes.has('J2,2') && !g.villes.has('J1,1'));
  // symétrie du graphe
  for (const [a, vs] of g.voisins) for (const b of vs) assert.ok(g.voisins.get(b).has(a), `${a}-${b}`);
});

test('construire : ne modifie pas le document et accepte l\'option jetons', () => {
  const doc = plateauExemples();
  const avant = JSON.stringify(doc);
  const g = GR.construire(doc, { jetons: [{ i: 2, j: 2, type: 'capture' }, { i: 2, j: 2, type: 'carrefour' }, null, { i: 1, j: 1, type: 'autre' }] });
  assert.strictEqual(JSON.stringify(doc), avant);
  assert.strictEqual(g.jonctions.length, 1); // doublon, jeton nul et type inconnu ignorés
});

test('construire : plateau vide, sans tuile ni modèle, sans exception', () => {
  const g = GR.construire(M.nouveauDocument());
  assert.strictEqual(g.noeuds.length, 0);
  const doc = M.nouveauDocument();
  doc.plateau.tuiles.push({ modeleId: 'absent', col: 0, lig: 0, rot: 0 }); // modèle introuvable
  doc.plateau.jetons.push({ i: 1, j: 1, type: 'capture' });
  const g2 = GR.construire(doc);
  assert.strictEqual(g2.cases.size, 0);
  assert.strictEqual(g2.jonctions[0].ports, 0); // jeton isolé
  assert.doesNotThrow(() => GR.construire(undefined));
});

test('construire : filtreTuile retire des tuiles du graphe', () => {
  const doc = plateauExemples();
  const g = GR.construire(doc, { filtreTuile: (t) => t.col <= 1 });
  assert.ok(g.cases.size < 4 * 4 + 4 * 3 * 3);
  for (const id of g.cases.keys()) assert.ok(Number(id.split(',')[0]) <= 1);
});

test('villesTraversables false sur un document : aucune distance ne diminue', () => {
  let doc = plateauExemples();
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) {
    try { doc = M.poserJeton(doc, i, j, (i === 2 && j === 2) ? 'carrefour' : 'capture'); } catch (e) { /* jonction refusée */ }
  }
  const gT = GR.construire(doc), gN = GR.construire(doc, { villesTraversables: false });
  assert.ok(gT.villes.size >= 2);
  for (const p of [1, 2]) {
    const dT = GR.distancesJoueur(gT, p), dN = GR.distancesJoueur(gN, p);
    for (const [id, d] of dN) assert.ok(d >= dT.get(id), id);
  }
});

test('profil : chaîne D1|D2 stable', () => {
  const doc = plateauExemples();
  assert.strictEqual(typeof GR.profil(doc), 'string');
  assert.strictEqual(GR.profil(doc), GR.profil(doc));
  assert.match(GR.profil(doc), /\|/);
});
