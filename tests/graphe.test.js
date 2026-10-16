'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
const A = require('./aides-v2.js');
const M = globalThis.PM.modele;
const GR = globalThis.PM.graphe;

/* ---------------------------------------------------------------------- */
/* Petits graphes faits main : { noeuds, voisins, cases, jonctions, villes, apparitions }              */
/* ---------------------------------------------------------------------- */

/**
 * aretes : [['a', 'b'], ...] ; villes : ids de nœuds villes ; apparitions : {1: [ids], 2: [ids]}.
 * Les nœuds dont l'id commence par « J » sont des jonctions (ville si listés dans `villes`, sinon case chemin).
 */
function main(aretes, villes, apparitions, traversables) {
  const voisins = new Map(), cases = new Map();
  const noeud = (x) => { if (!voisins.has(x)) { voisins.set(x, new Set()); if (!x.startsWith('J')) cases.set(x, { id: x }); } };
  for (const [a, b] of aretes) { noeud(a); noeud(b); voisins.get(a).add(b); voisins.get(b).add(a); }
  const jonctions = [...voisins.keys()].filter((x) => x.startsWith('J')).map((id, n) => ({
    id, i: n + 1, j: 1, type: villes.includes(id) ? 'ville' : 'case', ports: voisins.get(id).size, cases: []
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

test('case de jonction : traversable (une case chemin) quand les villes ne le sont pas', () => {
  const g = main([['s', 'Jc'], ['Jc', 't']], [], { 1: ['s'] }, false); // Jc n'est pas dans `villes` : case chemin
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

/** Plateau plein des exemples (4×4 par défaut), sans ville. */
const plateauExemples = (grille) => A.plateauComplet(grille);

test('construire : toutes les jonctions intérieures sont des nœuds (case chemin ou ville), 9 en 4×4, 16 en 5×5', () => {
  for (const [grille, nb] of [['4x4', 9], ['5x5', 16]]) {
    let doc = plateauExemples(grille);
    let g = GR.construire(doc);
    assert.strictEqual(g.villesTraversables, false); // défaut : règle du jeu
    assert.strictEqual(g.jonctions.length, nb);
    assert.ok(g.jonctions.every((j) => j.type === 'case' && j.ports === 4 && g.voisins.get(j.id).size === 4));
    assert.strictEqual(g.villes.size, 0);
    doc = M.poserJeton(doc, 2, 2);
    g = GR.construire(doc);
    assert.deepStrictEqual(g.jonctions.filter((j) => j.type === 'ville').map((j) => j.id), ['J2,2']);
    assert.ok(g.villes.has('J2,2'));
    for (const [a, vs] of g.voisins) for (const b of vs) assert.ok(g.voisins.get(b).has(a), `${a}-${b}`);
  }
});

test('construire : cases d\'apparition par camp (6 par joueur en 4×4, 7 en 5×5, rangée centrale du 5×5 ignorée)', () => {
  const g4 = GR.construire(plateauExemples('4x4')), g5 = GR.construire(plateauExemples('5x5'));
  assert.deepStrictEqual([g4.apparitions[1].length, g4.apparitions[2].length], [6, 6]);
  assert.deepStrictEqual([g5.apparitions[1].length, g5.apparitions[2].length], [7, 7]);
  assert.ok(g5.apparitions[1].concat(g5.apparitions[2]).every((id) => !/^[04],2:/.test(id)));
  assert.strictEqual(g4.cases.size, 4 * 5 + 8 * 3 + 4 * 2);
});

test('construire : ne modifie pas le document et accepte l\'option jetons (seules les villes comptent)', () => {
  const doc = plateauExemples();
  const avant = JSON.stringify(doc);
  const g = GR.construire(doc, { jetons: [{ i: 2, j: 2, type: 'capture' }, { i: 2, j: 2, type: 'capture' }, null, { i: 1, j: 1, type: 'carrefour' }] });
  assert.strictEqual(JSON.stringify(doc), avant);
  assert.deepStrictEqual([...g.villes], ['J2,2']);
  assert.strictEqual(g.jonctions.find((j) => j.id === 'J1,1').type, 'case');
});

test('construire : plateau vide ou incomplet sans exception ; jonctions isolées ; connexe', () => {
  const g = GR.construire(M.nouveauDocument());
  assert.strictEqual(g.cases.size, 0);
  assert.strictEqual(g.noeuds.length, 9);
  assert.ok(g.jonctions.every((j) => j.ports === 0));
  assert.strictEqual(GR.connexe(g), false);
  const doc = M.nouveauDocument();
  doc.plateau.tuiles.push({ modeleId: 'absent', col: 0, lig: 0, rot: 0 });
  assert.strictEqual(GR.construire(doc).cases.size, 0);
  assert.doesNotThrow(() => GR.construire(undefined));
  assert.strictEqual(GR.connexe(GR.construire(plateauExemples())), true);
  assert.strictEqual(GR.connexe({ noeuds: [], voisins: new Map() }), false);
});

test('construire : filtreTuile retire des tuiles du graphe', () => {
  const g = GR.construire(plateauExemples(), { filtreTuile: (t) => t.col <= 1 });
  for (const id of g.cases.keys()) assert.ok(Number(id.split(',')[0]) <= 1);
});

test('T4 (docs/20) : deux ports vers J(2,2) sans jeton, puis villes en (1,1) et (2,1) : au moins 3 cases, pas d\'alerte', () => {
  // centrale sans le port SE, posée en (1,1) (SE vers J(2,2)) et en (2,1) tournée d'un quart (SE devient SO, vers J(2,2))
  const sansSE = M.copieExemples()[0];
  sansSE.id = 'sans-se';
  sansSE.chemins = sansSE.chemins.filter((c) => c.id !== 'p3');
  let doc = A.plateauComplet('4x4', null, (col, lig) => ((col === 1 || col === 2) && lig === 1 ? 'sans-se' : null), [sansSE]);
  doc = M.tournerTuile(doc, 2, 1, 1);
  let g = GR.construire(doc);
  const j22 = g.jonctions.find((j) => j.id === 'J2,2');
  assert.strictEqual(j22.type, 'case');
  assert.strictEqual(j22.ports, 2);
  doc = M.poserJeton(M.poserJeton(doc, 1, 1), 2, 1);
  g = GR.construire(doc);
  assert.ok(GR.distances(g, 'J1,1').get('J2,1') >= 4, 'ville–ville : ' + GR.distances(g, 'J1,1').get('J2,1') + ' pas');
  assert.deepStrictEqual(GR.villesProches(g), []);
  assert.strictEqual(g.voisins.get('J2,2').size, 2);
});

test('villesProches : deux villes à 3 pas (2 cases) signalées, à 4 pas non', () => {
  const g = main([['Ja', 'x'], ['x', 'y'], ['y', 'Jb'], ['Jb', 'z'], ['z', 'u'], ['u', 'v'], ['v', 'Jc']], ['Ja', 'Jb', 'Jc'], {}, false);
  assert.deepStrictEqual(GR.villesProches(g).map((p) => p.pas), [3]);
  assert.strictEqual(PM_ECART(), 3);
  // une ville intermédiaire ne raccourcit rien : villes non traversables, même si le graphe est en mode traversable
  const gT = main([['Ja', 'Jb'], ['Jb', 'Jc']], ['Ja', 'Jb', 'Jc'], {}, true);
  assert.deepStrictEqual(GR.villesProches(gT).map((p) => p.pas), [1, 1]);
});
function PM_ECART() { return globalThis.PM.geometrie.ECART_MIN_VILLES; }

test('villes non traversables sur un document : aucune distance ne diminue', () => {
  const doc = A.plateauComplet('4x4', true);
  const gT = GR.construire(doc, { villesTraversables: true }), gN = GR.construire(doc);
  for (const p of [1, 2]) {
    const dT = GR.distancesJoueur(gT, p), dN = GR.distancesJoueur(gN, p);
    for (const [id, d] of dN) assert.ok(d >= dT.get(id), id);
  }
});

test('profil : chaîne D1|D2 stable', () => {
  const doc = A.plateauComplet('4x4', true);
  assert.strictEqual(GR.profil(doc), GR.profil(doc));
  assert.match(GR.profil(doc), /\|/);
});

test('seuils exportés (paramètres, docs/19 et arbitrages de docs/20)', () => {
  assert.strictEqual(GR.SEUIL_BLOCAGE_ECART, 3);
  assert.strictEqual(GR.CINQ_CONTRE_DEUX_BLOQUANT, true);
  assert.strictEqual(GR.SEUIL_ECART, 2);
  assert.strictEqual(GR.SEUIL_S, 5); // docs/22 : S = 4 n'est qu'une information
  assert.strictEqual(GR.SEUIL_S_INFORMATION, 4);
  assert.strictEqual(GR.NB_VILLES, 7);
  assert.deepStrictEqual(GR.NOM_JOUEUR, { 1: 'vert', 2: 'rouge' });
});
