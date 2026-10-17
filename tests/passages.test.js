'use strict';
/*
 * Tests des passages sans case (docs/18 fin, docs/39) : modèle (blocages et alertes), graphe (cases voisines à 1 pas),
 * rendu (courbes dans le SVG), export PDF (opérateur c), sauvegarde aller-retour et anciens documents inchangés.
 * Les fonctions pures de l'éditeur sont dans la seconde moitié du fichier.
 * Lancer : node --test tests/passages.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
require('../src/export.js');
require('../src/sauvegarde.js');
require('../src/etat.js');
require('../src/editeur-tuile.js');
const PM = globalThis.PM;
const M = PM.modele, GR = PM.graphe, G = PM.geometrie, R = PM.rendu, X = PM.exportation, S = PM.sauvegarde, E = PM.editeurTuile;

const clone = (o) => JSON.parse(JSON.stringify(o));
const caseDe = (id, x, y) => ({ id, x, y, diametre: 20, type: 'deplacement' });
const rac = (cote, pos) => ({ raccord: { cote, pos } });
const modele = (id, o) => Object.assign({ id, nom: id, gabarit: 'centrale', grille: '4x4', exemplaires: 1, cases: [], chemins: [] }, o);
const codes = (m, quoi) => M.validerModele(m)[quoi || 'erreurs'].map((x) => x.code);

/** Document 4×4 vide dont la bibliothèque est `modeles` ; les tuiles sont posées sans contrôle de rôle. */
function doc(modeles, tuiles, jetons) {
  const d = M.nouveauDocument('4x4');
  d.modeles = modeles.map(clone);
  d.plateau.tuiles = tuiles.map(([modeleId, col, lig, rot]) => ({ modeleId, col, lig, rot: rot || 0 }));
  d.plateau.jetons = (jetons || []).map(([i, j]) => ({ i, j, type: 'capture' }));
  return d;
}

/* ---------- Cas 1 : quart de tour entre deux tuiles -> 1 pas ---------- */

// Deux cases reliées par un chemin droit ; chacune a un passage en quart de tour vers un raccord (W pos 1 et E pos 1).
const QUART = modele('quart', {
  cases: [caseDe('a', 40, 80), caseDe('b', 80, 80)],
  chemins: [{ id: 'h1', a: { 'case': 'a' }, b: { 'case': 'b' } }],
  pivots: [],
  passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(3, 1) }, { id: 'q2', a: { 'case': 'b' }, b: rac(1, 1) }]
});

test('cas 1 : le modèle à passages en quart de tour est complet et ses raccords entrent dans le masque', () => {
  const v = M.validerModele(QUART);
  assert.deepEqual(v.erreurs.map((x) => x.code), [], JSON.stringify(v.erreurs));
  const masque = M.masquesDuModele(QUART);
  assert.equal(masque.raccords, (1 << G.bitRaccord(3, 1)) | (1 << G.bitRaccord(1, 1)));
  assert.equal(masque.portsCoin, 0);
});

test('cas 1 : deux tuiles côte à côte, les cases de part et d\'autre du passage sont voisines à 1 pas', () => {
  const d = doc([QUART], [['quart', 1, 1], ['quart', 2, 1]]);
  const g = GR.construire(d);
  assert.ok(g.voisins.get('1,1:b').has('2,1:a'), 'b et a voisines');
  assert.equal(GR.distances(g, '1,1:b').get('2,1:a'), 1);
  // les cases d'une même tuile restent à leur distance de chemin : a (tuile 1) -> b (tuile 1) -> a (tuile 2) -> b (tuile 2)
  assert.equal(GR.distances(g, '1,1:a').get('2,1:b'), 3);
  // sans passage les deux tuiles ne se touchent pas
  const sans = clone(QUART); sans.passages = [];
  assert.equal(GR.distances(GR.construire(doc([sans], [['quart', 1, 1], ['quart', 2, 1]])), '1,1:b').has('2,1:a'), false);
});

test('cas 1 : tournée de 90°, la liaison suit les raccords tournés (rotation 1 : E devient S)', () => {
  // tuile 1 en (1,1) tournée d'un quart : son raccord E pos 1 devient S pos 1, face au N pos 1 de la tuile (1,2)
  const d = doc([QUART], [['quart', 1, 1, 1], ['quart', 1, 2, 1]]);
  const e = M.tuileEnPlateau(d, d.plateau.tuiles[0]);
  assert.deepEqual(e.passages.map((p) => p.b.raccord || null).filter(Boolean).map((r) => r.cote).sort(), [0, 2]);
  const g = GR.construire(d);
  const voisines = [...g.voisins.get('1,1:b')].concat([...g.voisins.get('1,1:a')]);
  assert.ok(voisines.some((id) => id.startsWith('1,2:')), 'une case de la tuile du dessous est voisine à 1 pas');
});

/* ---------- Cas 2 : un T sur 3 tuiles -> clique ---------- */

const PIVOT_T = modele('pivot-t', {
  pivots: [{ id: 'v1', x: 60, y: 60 }],
  passages: [{ id: 'q1', a: rac(3, 1), b: { pivot: 'v1' } }, { id: 'q2', a: { pivot: 'v1' }, b: rac(0, 1) }, { id: 'q3', a: { pivot: 'v1' }, b: rac(2, 1) }]
});
const BOUT_E = modele('bout-e', { cases: [caseDe('a', 60, 60)], passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(1, 1) }] });
const BOUT_S = modele('bout-s', { cases: [caseDe('c', 60, 60)], passages: [{ id: 'q1', a: { 'case': 'c' }, b: rac(2, 1) }] });
const BOUT_N = modele('bout-n', { cases: [caseDe('d', 60, 60)], passages: [{ id: 'q1', a: { 'case': 'd' }, b: rac(0, 1) }] });

test('cas 2 : un T (pivot de degré 3) sur 3 tuiles : les trois cases sont voisines deux à deux, sans nœud intermédiaire', () => {
  [PIVOT_T, BOUT_E, BOUT_S, BOUT_N].forEach((m) => assert.deepEqual(codes(m), [], m.id));
  assert.deepEqual(codes(PIVOT_T, 'alertes'), [], 'pivot de degré 3 : aucune alerte');
  // pivot au centre (2,1) ; tuile à l'ouest (1,1) avec sa case, tuile au nord (2,0), tuile au sud (2,2)
  // la case de l'ouest est à l'est de sa tuile (raccord E), celle du nord est raccordée par S, celle du sud par N
  const d = doc([PIVOT_T, BOUT_E, BOUT_S, BOUT_N], [['pivot-t', 2, 1], ['bout-e', 1, 1], ['bout-s', 2, 0], ['bout-n', 2, 2]]);
  const g = GR.construire(d);
  const a = '1,1:a', c = '2,0:c', dd = '2,2:d';
  [[a, c], [a, dd], [c, dd]].forEach(([x, y]) => {
    assert.ok(g.voisins.get(x).has(y), x + ' voisine de ' + y);
    assert.equal(GR.distances(g, x).get(y), 1);
  });
  assert.equal(g.noeuds.filter((n) => !/^J/.test(n) && !g.cases.has(n)).length, 0, 'aucun nœud ajouté');
});

test('cas 2 : une case à deux sorties ne rapproche pas ses deux voisins (les cases ne sont pas fusionnées)', () => {
  // y -- chemin -- x -- passage -- z ; y et z restent à 2 pas
  const centre = modele('centre', {
    cases: [caseDe('x', 60, 60)],
    chemins: [{ id: 'h1', a: { 'case': 'x' }, b: rac(3, 1) }],
    passages: [{ id: 'q1', a: { 'case': 'x' }, b: rac(1, 1) }]
  });
  const gauche = modele('gauche', { cases: [caseDe('y', 60, 60)], chemins: [{ id: 'h1', a: { 'case': 'y' }, b: rac(1, 1) }] });
  const droite = modele('droite', { cases: [caseDe('z', 60, 60)], passages: [{ id: 'q1', a: { 'case': 'z' }, b: rac(3, 1) }] });
  const g = GR.construire(doc([centre, gauche, droite], [['centre', 1, 1], ['gauche', 0, 1], ['droite', 2, 1]]));
  assert.equal(GR.distances(g, '0,1:y').get('1,1:x'), 1);
  assert.equal(GR.distances(g, '1,1:x').get('2,1:z'), 1);
  assert.equal(GR.distances(g, '0,1:y').get('2,1:z'), 2);
});

/* ---------- Cas 3 : porteuse touchée par un passage ---------- */

// Deux porteuses (ports NO et NE) reliées l'une à l'autre par un passage (pivot de degré 2 au milieu)
const PORTEUSES = modele('porteuses', {
  cases: [caseDe('p0', 45, 45), caseDe('p1', 75, 45)],
  chemins: [{ id: 'g0', a: { 'case': 'p0' }, b: { coin: 0 } }, { id: 'g1', a: { 'case': 'p1' }, b: { coin: 1 } }],
  pivots: [{ id: 'v1', x: 60, y: 85 }],
  passages: [{ id: 'q1', a: { 'case': 'p0' }, b: { pivot: 'v1' } }, { id: 'q2', a: { 'case': 'p1' }, b: { pivot: 'v1' } }]
});
const FOND = modele('fond', { cases: [caseDe('x', 60, 60)], chemins: [{ id: 'h1', a: { 'case': 'x' }, b: rac(0, 1) }] });

test('cas 3 : une porteuse touchée par un passage est une alerte (pas un blocage), pivot de degré 2 aussi', () => {
  const v = M.validerModele(PORTEUSES);
  assert.deepEqual(v.erreurs.map((x) => x.code), [], JSON.stringify(v.erreurs));
  const al = v.alertes.map((x) => x.code);
  assert.ok(al.includes('porteuse_passage'), al.join());
  assert.ok(al.includes('pivot_degre_faible'), al.join());
  assert.equal(al.filter((c) => c === 'porteuse_passage').length, 2, 'une alerte par porteuse');
});

test('cas 3 : le contrôle global villesProches voit la liaison par passage (3 pas entre deux villes voisines)', () => {
  const tuiles = [['fond', 0, 0], ['fond', 1, 0], ['fond', 2, 0], ['fond', 0, 1], ['porteuses', 1, 1], ['fond', 2, 1]];
  const villes = [[1, 1], [2, 1]];
  const avec = doc([PORTEUSES, FOND], tuiles, villes);
  const proches = GR.villesProches(GR.construire(avec));
  assert.equal(proches.length, 1);
  assert.equal(proches[0].pas, 3);
  // sans le passage, les deux porteuses ne sont plus reliées : plus de paire proche
  const sans = clone(PORTEUSES); sans.passages = []; sans.pivots = [];
  assert.equal(GR.villesProches(GR.construire(doc([sans, FOND], tuiles, villes))).length, 0);
});

test('alertes : passage depuis une case d\'apparition, plus d\'un réseau sur un bord, réseau de plus de 4 cases', () => {
  const appar = modele('appar', { gabarit: 'bord', cases: [Object.assign(caseDe('a', 60, 60), { type: 'apparition' })], passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(2, 1) }] });
  assert.ok(codes(appar, 'alertes').includes('passage_apparition'));
  const deux = modele('deux', { gabarit: 'bord', cases: [caseDe('a', 40, 60), caseDe('b', 80, 60)], chemins: [{ id: 'h1', a: { 'case': 'a' }, b: { 'case': 'b' } }],
    passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(2, 2) }, { id: 'q2', a: { 'case': 'b' }, b: rac(2, 0) }] });
  assert.ok(codes(deux, 'alertes').includes('passages_bord'));
  assert.ok(!codes(Object.assign(clone(deux), { gabarit: 'centrale' }), 'alertes').includes('passages_bord'));
  const gros = modele('gros', { pivots: [{ id: 'v1', x: 60, y: 60 }], cases: [caseDe('a', 30, 60), caseDe('b', 90, 60), caseDe('c', 60, 30), caseDe('d', 60, 90), caseDe('e', 60, 60)] });
  gros.cases = [caseDe('a', 40, 40), caseDe('b', 80, 40), caseDe('c', 40, 80), caseDe('d', 80, 80), caseDe('e', 60, 60)];
  gros.pivots = [{ id: 'v1', x: 60, y: 20 }, { id: 'v2', x: 60, y: 100 }];
  gros.passages = [
    { id: 'q1', a: { 'case': 'a' }, b: { pivot: 'v1' } }, { id: 'q2', a: { 'case': 'b' }, b: { pivot: 'v1' } },
    { id: 'q3', a: { 'case': 'c' }, b: { pivot: 'v2' } }, { id: 'q4', a: { 'case': 'd' }, b: { pivot: 'v2' } },
    { id: 'q5', a: { pivot: 'v1' }, b: { pivot: 'v2' } }, { id: 'q6', a: { 'case': 'e' }, b: { pivot: 'v2' } }
  ];
  assert.ok(codes(gros, 'alertes').includes('reseau_passages_grand'), codes(gros, 'alertes').join());
});

/* ---------- Cas 4 : interdits (blocages) ---------- */

test('cas 4 : passage vers un coin, entre deux cases, boucle, doublon : refusés', () => {
  const base = { cases: [caseDe('a', 40, 60), caseDe('b', 80, 60)], chemins: [{ id: 'h1', a: { 'case': 'a' }, b: { 'case': 'b' } }] };
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: [{ id: 'q1', a: { 'case': 'a' }, b: { coin: 2 } }] }))).includes('passage_coin'));
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: [{ id: 'q1', a: { 'case': 'a' }, b: { 'case': 'b' } }] }))).includes('passage_case_case'));
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: [{ id: 'q1', a: { 'case': 'a' }, b: { 'case': 'a' } }] }))).includes('passage_boucle'));
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: [{ id: 'q1', a: rac(1, 1), b: rac(1, 1) }] }))).includes('passage_boucle'));
  const dbl = [{ id: 'q1', a: { 'case': 'a' }, b: rac(3, 1) }, { id: 'q2', a: rac(3, 1), b: { 'case': 'a' } }];
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: dbl }))).includes('passage_double'));
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: [{ id: 'q1', a: { 'case': 'zz' }, b: rac(3, 1) }] }))).includes('passage_inconnu'));
  assert.ok(codes(modele('t', Object.assign({}, base, { passages: [{ id: 'q1', a: { pivot: 'zz' }, b: rac(3, 1) }] }))).includes('passage_inconnu'));
});

test('cas 4 : raccord partagé par deux passages ou par un chemin et un passage : refusé', () => {
  const deux = modele('t', { cases: [caseDe('a', 40, 60)], passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(3, 1) }, { id: 'q2', a: rac(3, 1), b: rac(0, 0) }] });
  assert.ok(codes(deux).includes('raccord_double'));
  const mixte = modele('t', {
    cases: [caseDe('a', 40, 60)], chemins: [{ id: 'h1', a: { 'case': 'a' }, b: rac(3, 1) }],
    passages: [{ id: 'q1', a: rac(3, 1), b: rac(0, 0) }]
  });
  assert.ok(codes(mixte).includes('raccord_double'));
});

test('cas 4 : croisements (passage / passage, passage / chemin) refusés ; un pivot est le seul point de rencontre', () => {
  const croix = modele('t', { passages: [{ id: 'q1', a: rac(0, 0), b: rac(2, 2) }, { id: 'q2', a: rac(3, 1), b: rac(1, 1) }] });
  assert.ok(codes(croix).includes('passages_croises'), codes(croix).join());
  const chemin = modele('t', {
    cases: [caseDe('c', 60, 40)], chemins: [{ id: 'h1', a: { 'case': 'c' }, b: rac(2, 1) }],
    passages: [{ id: 'q1', a: rac(3, 1), b: rac(1, 1) }]
  });
  assert.ok(codes(chemin).includes('passage_chemin_croise'), codes(chemin).join());
  const T = M.validerModele(PIVOT_T);
  assert.ok(!T.erreurs.some((x) => /croise/.test(x.code)));
});

test('cas 4 : passage trop près d\'une case qu\'il ne relie pas, passage dans une zone de coin, pivot de degré 4', () => {
  const pres = modele('t', {
    cases: [caseDe('c', 60, 75)], chemins: [{ id: 'h1', a: { 'case': 'c' }, b: rac(2, 1) }],
    passages: [{ id: 'q1', a: rac(3, 1), b: rac(1, 1) }]
  });
  assert.ok(codes(pres).includes('passage_case'), codes(pres).join());
  const coin = modele('t', { pivots: [{ id: 'v1', x: 10, y: 10 }], passages: [{ id: 'q1', a: rac(0, 0), b: { pivot: 'v1' } }] });
  assert.ok(codes(coin).includes('passage_zone_coin'), codes(coin).join());
  const quatre = modele('t', {
    pivots: [{ id: 'v1', x: 60, y: 60 }],
    passages: [rac(0, 1), rac(1, 1), rac(2, 1), rac(3, 1)].map((r, k) => ({ id: 'q' + k, a: r, b: { pivot: 'v1' } }))
  });
  assert.ok(codes(quatre).includes('pivot_degre'));
});

test('cas 4 : une case reliée seulement par un passage n\'est pas isolée ; ni poche, ni réseau sans sortie si le passage mène à un raccord', () => {
  const seul = modele('t', { cases: [caseDe('a', 60, 60)], passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(1, 1) }] });
  assert.deepEqual(codes(seul), []);
  assert.deepEqual(codes(seul, 'alertes'), []);
  const sansSortie = modele('t', { cases: [caseDe('a', 40, 60)], pivots: [{ id: 'v1', x: 80, y: 60 }], passages: [{ id: 'q1', a: { 'case': 'a' }, b: { pivot: 'v1' } }] });
  assert.deepEqual(codes(sansSortie), []);
  assert.ok(codes(sansSortie, 'alertes').includes('reseau_sans_sortie'));
});

test('passage hors tuile (point de contrôle trop loin) : refusé ; courbe trop serrée : alerte', () => {
  const loin = modele('t', { passages: [{ id: 'q1', a: rac(3, 1), b: rac(1, 1), courbe: { x: 60, y: -80 } }] });
  assert.ok(codes(loin).includes('passage_hors_tuile'));
  const serre = modele('t', { passages: [{ id: 'q1', a: rac(0, 0), b: rac(0, 1) }] });
  assert.deepEqual(codes(serre), []);
  assert.ok(codes(serre, 'alertes').includes('passage_rayon') === false, 'demi-cercle de 15 mm : rayon suffisant');
  const aigu = modele('t', { passages: [{ id: 'q1', a: rac(3, 1), b: rac(1, 1), courbe: { x: 60, y: 60.5 } }] });
  assert.deepEqual(codes(aigu), []);
});

/* ---------- Rendu et PDF ---------- */

test('rendu : un passage est une courbe verte de 8 mm (Q ou C dans le SVG), prolongée dans le fond perdu aux raccords', () => {
  const svg = R.contenuTuile(QUART, { fondPerdu: 3 });
  assert.equal((svg.match(/data-passage="/g) || []).length, 2);
  const d = /data-passage="q1"/.exec(svg) && /<path d="([^"]+)"[^>]*data-passage="q1"/.exec(svg)[1];
  assert.match(d, /Q/, 'quadratique');
  assert.match(svg, new RegExp('stroke="' + R.COULEURS.vert + '" stroke-width="8"[^>]*data-passage="q1"'));
  // la tuile à raccord W pos 1 : le tracé se prolonge de 3 mm hors tuile (x = -3)
  assert.match(d, /^M40 80 Q20 60 0 60 L-3 60$/);
  // les chemins restent droits
  assert.match(/<path d="([^"]+)"[^>]*data-chemin="h1"/.exec(svg)[1], /^M[\d. ]+L[\d. ]+$/);
  // demi-cercle : deux cubiques ; droit : un seul L ; rotation : points tournés
  const demi = modele('t', { passages: [{ id: 'q1', a: rac(0, 0), b: rac(0, 2) }, { id: 'q2', a: rac(2, 0), b: rac(0, 1), courbe: { x: 60, y: 90 } }] });
  const svg2 = R.contenuTuile(demi, { fondPerdu: 0 });
  assert.equal(((/data-passage="q1"/.test(svg2) && /<path d="([^"]+)"[^>]*data-passage="q1"/.exec(svg2)[1]).match(/C/g) || []).length, 2);
  const tourne = R.contenuTuile(QUART, { rot: 1, fondPerdu: 0 });
  assert.match(/<path d="([^"]+)"[^>]*data-passage="q1"/.exec(tourne)[1], /^M40 40 Q60 20 60 0$/, 'la case tourne de (40, 80) à (40, 40), le raccord W pos 1 devient N pos 1');
});

test('géométrie : arrivée perpendiculaire au côté, quart de tour par l\'intersection des normales, rayon et polyligne', () => {
  const t = G.tracesPassages(modele('t', { passages: [{ id: 'q1', a: rac(0, 0), b: rac(1, 0) }] }), '4x4')[0];
  assert.deepEqual(t.cmds.map((c) => c[0]), ['M', 'Q']);
  assert.deepEqual(t.cmds[1][1], { x: 30, y: 30 }, 'contrôle = intersection des normales (N pos 0 = (30, 0), E pos 0 = (120, 30))');
  assert.ok(t.rayonMin > 10);
  assert.ok(t.pts.length > 10);
  assert.deepEqual(t.pts[0], { x: 30, y: 0 });
  assert.deepEqual(t.pts[t.pts.length - 1], { x: 120, y: 30 });
});

test('PDF : un passage en courbe donne des opérateurs c, accepte Q et C, et le PDF est produit', () => {
  const m = modele('pdf', { passages: [{ id: 'q1', a: rac(3, 1), b: rac(0, 1) }, { id: 'q2', a: rac(2, 0), b: rac(2, 2) }, { id: 'q3', a: rac(1, 0), b: rac(1, 2) }] });
  assert.deepEqual(codes(m), []);
  const d = doc([m], [['pdf', 1, 1]]);
  const planche = X.calepiner(d, { format: 'A3', portee: 'posees' });
  const flux = X.svgVersFlux(planche[0].svg).flux;
  assert.ok((flux.match(/ c$/gm) || []).length >= 4, 'au moins 1 + 1 + 2 courbes : ' + (flux.match(/ c$/gm) || []).length);
  const pdf = X.pdfDepuisPlanches(planche, d);
  assert.equal(String.fromCharCode(...pdf.slice(0, 5)), '%PDF-');
  const e = 'xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"';
  const cub = X.svgVersFlux('<svg ' + e + '><path d="M0 0 C1 1 2 2 3 3" fill="none" stroke="#000000"/></svg>').flux;
  assert.match(cub, /1 1 2 2 3 3 c/);
  const quad = X.svgVersFlux('<svg ' + e + '><path d="M0 0 Q3 0 3 3" fill="none" stroke="#000000"/></svg>').flux;
  assert.match(quad, /2 0 3 1 3 3 c/, 'Q (0,0) (3,0) (3,3) = cubique de contrôles (2,0) et (3,1)');
});

/* ---------- Sauvegarde ---------- */

test('sauvegarde : pivots et passages font l\'aller-retour, la courbe est conservée, les valeurs hostiles sont écartées', () => {
  const m = clone(QUART);
  m.pivots = [{ id: 'v1', x: 60, y: 100 }];
  m.passages[0].courbe = { x: 20, y: 70 };
  const d = doc([m], [['quart', 1, 1]]);
  const r = S.depuisJSON(S.versJSON(d));
  assert.ok(r.ok);
  assert.deepEqual(r.doc.modeles[0].passages, m.passages);
  assert.deepEqual(r.doc.modeles[0].pivots, m.pivots);
  const hostile = clone(d);
  hostile.modeles[0].passages.push({ id: 'z', a: { pivot: { x: 1 } }, b: rac(1, 1) }, { id: 'y', a: { 'case': 'a' }, b: rac(3, 1), courbe: { x: 'a', y: 1e9 } });
  hostile.modeles[0].pivots.push({ id: 'w', x: 1e9, y: 0 });
  const r2 = S.depuisJSON(JSON.stringify({ format: S.FORMAT, version: 2, grille: '4x4', modeles: hostile.modeles, plateau: hostile.plateau }));
  assert.ok(r2.ok);
  const lu = r2.doc.modeles[0];
  assert.equal(lu.pivots.length, 1);
  assert.equal(lu.passages.length, 3);
  assert.equal(lu.passages[2].courbe, undefined);
  assert.ok(r2.alertes.some((a) => a.code === 'elements_ignores'));
  // plafonds
  const trop = clone(d);
  trop.modeles[0].passages = Array.from({ length: S.LIMITES.passages + 5 }, (_, k) => ({ id: 'p' + k, a: rac(1, 1), b: rac(3, 1) }));
  const r3 = S.depuisJSON(JSON.stringify({ format: S.FORMAT, version: 2, grille: '4x4', modeles: trop.modeles, plateau: trop.plateau }));
  assert.equal(r3.doc.modeles[0].passages.length, S.LIMITES.passages);
});

test('sauvegarde : un ancien modèle (sans passage) ne reçoit aucun champ pivots ni passages', () => {
  const d = doc(M.copieExemples(), []);
  const lu = S.depuisJSON(S.versJSON(d)).doc;
  lu.modeles.forEach((m) => { assert.equal('pivots' in m, false); assert.equal('passages' in m, false); });
});

/* ---------- Anciens documents strictement inchangés ---------- */

test('anciens documents : tuileEnPlateau, rendu et validation d\'un modèle sans passage n\'ont aucun champ ni alerte en plus', () => {
  const d = PM.catalogue.nouveauDocument('4x4');
  const t = { modeleId: d.modeles[0].id, col: 1, lig: 1, rot: 2 };
  const e = M.tuileEnPlateau(Object.assign(d, { plateau: { tuiles: [t], jetons: [] } }), t);
  assert.deepEqual(Object.keys(e).sort(), ['aretes', 'cases', 'ports', 'raccords']);
  d.modeles.forEach((m) => {
    assert.ok(!/data-passage|data-pivot/.test(R.contenuTuile(m, { fondPerdu: 3 })));
    assert.ok(!M.validerModele(m).alertes.concat(M.validerModele(m).erreurs).some((x) => /passage|pivot/.test(x.code)));
  });
});

test('anciens documents : générateurs 4×4 et 5×5 à graine donnée, mêmes plateaux (empreintes de la version sans passage)', () => {
  const h = (o) => crypto.createHash('sha1').update(JSON.stringify(o)).digest('hex').slice(0, 12);
  const attendu = {
    '4x4': ['c229dc80f0a1:3483103e71f6', 'fe450d228d97:d8875b1c81f5', 'c989b780f666:bd752fea07c5'],
    '5x5': ['c4f9948fc97d:65d12b3037bb', '8cfdf34dd189:4885e574394f', 'cf246b72830d:8c5d691eda90']
  };
  for (const g of ['4x4', '5x5']) {
    const obtenu = [0, 1, 2].map((k) => {
      const r = PM.generateur.generer(PM.catalogue.nouveauDocument(g), { graine: 's' + k, candidats: 8 });
      return h(r.doc) + ':' + h(GR.equilibre(r.doc));
    });
    assert.deepEqual(obtenu, attendu[g], g);
  }
});

/* ---------- Éditeur : fonctions pures ---------- */

const gele = (o) => { const c = clone(o); const f = (x) => { if (x && typeof x === 'object' && !Object.isFrozen(x)) { Object.freeze(x); Object.values(x).forEach(f); } return x; }; return f(c); };

test('éditeur : ajouterPassage refuse coin, deux cases, boucle, doublon, inconnu ; accepte raccord, case, pivot', () => {
  const m = gele(modele('e', { cases: [caseDe('a', 40, 60), caseDe('b', 80, 60)], chemins: [{ id: 'h1', a: { 'case': 'a' }, b: { 'case': 'b' } }], pivots: [{ id: 'pv1', x: 60, y: 100 }] }));
  assert.throws(() => E.ajouterPassage(m, { 'case': 'a' }, { coin: 2 }), /coin/);
  assert.throws(() => E.ajouterPassage(m, { 'case': 'a' }, { 'case': 'b' }), /chemin/);
  assert.throws(() => E.ajouterPassage(m, { 'case': 'a' }, { 'case': 'a' }), /lui-même/);
  assert.throws(() => E.ajouterPassage(m, { 'case': 'zz' }, rac(1, 1)), /n'existe pas/);
  assert.throws(() => E.ajouterPassage(m, { pivot: 'zz' }, rac(1, 1)), /n'existe pas/);
  assert.throws(() => E.ajouterPassage(m, null, rac(1, 1)), /invalide/);
  const m1 = E.ajouterPassage(m, rac(3, 1), { 'case': 'a' });
  assert.deepEqual(m1.passages, [{ id: 'ps1', a: { 'case': 'a' }, b: rac(3, 1) }], 'la case passe en premier');
  assert.throws(() => E.ajouterPassage(m1, { 'case': 'a' }, rac(3, 1)), /déjà reliés/);
  const m2 = E.ajouterPassage(m1, { pivot: 'pv1' }, rac(2, 1));
  const m3 = E.ajouterPassage(m2, { 'case': 'b' }, { pivot: 'pv1' });
  assert.deepEqual(m3.passages.map((p) => p.id), ['ps1', 'ps2', 'ps3']);
  assert.equal(M.validerModele(m3).complet, true, JSON.stringify(M.validerModele(m3).erreurs));
  assert.equal(m.passages, undefined, 'le modèle d\'entrée est intact');
});

test('éditeur : pivots (création aimantée à 1 cm, doublon refusé, déplacement), courbe, réinitialisation', () => {
  const m = gele(modele('e', { cases: [caseDe('a', 40, 60)], passages: [{ id: 'ps1', a: { 'case': 'a' }, b: rac(3, 1) }] }));
  const p1 = E.ajouterPivot(m, 63, 41, '4x4');
  assert.deepEqual(p1.pivots, [{ id: 'pv1', x: 60, y: 40 }]);
  assert.throws(() => E.ajouterPivot(p1, 61, 39, '4x4'), /existe déjà/);
  assert.deepEqual(E.ajouterPivot(m, -50, 500, '4x4').pivots[0], { id: 'pv1', x: 10, y: 110 }, 'à 1 cm du bord au moins');
  assert.deepEqual(E.deplacerPivot(p1, 'pv1', 80, 90, '4x4').pivots[0], { id: 'pv1', x: 80, y: 90 });
  assert.throws(() => E.deplacerPivot(p1, 'zz', 80, 90), /introuvable/);
  const c = E.definirCourbe(m, 'ps1', 33.33, 200, '4x4');
  assert.deepEqual(c.passages[0].courbe, { x: 33.3, y: 120 }, 'dans la tuile, au dixième de mm');
  assert.equal('courbe' in E.reinitialiserCourbe(c, 'ps1').passages[0], false);
  assert.throws(() => E.definirCourbe(m, 'zz', 1, 1), /introuvable/);
});

test('éditeur : supprimer un passage, un pivot (avec ses passages), une case, un raccord ; un pivot sans branche disparaît', () => {
  const m = gele(modele('e', {
    cases: [caseDe('a', 40, 60), caseDe('b', 80, 60)], pivots: [{ id: 'pv1', x: 60, y: 100 }],
    passages: [{ id: 'ps1', a: { 'case': 'a' }, b: { pivot: 'pv1' } }, { id: 'ps2', a: { 'case': 'b' }, b: { pivot: 'pv1' } }, { id: 'ps3', a: { pivot: 'pv1' }, b: rac(2, 1) }]
  }));
  assert.deepEqual(E.supprimer(m, { type: 'passage', id: 'ps3' }).passages.map((p) => p.id), ['ps1', 'ps2']);
  assert.equal(E.supprimer(m, { type: 'passage', id: 'ps3' }).pivots.length, 1, 'le pivot garde 2 branches');
  const sans = E.supprimer(E.supprimer(E.supprimer(m, { type: 'passage', id: 'ps1' }), { type: 'passage', id: 'ps2' }), { type: 'passage', id: 'ps3' });
  assert.deepEqual(sans.pivots, [], 'plus aucune branche : le pivot est retiré');
  const sansPivot = E.supprimer(m, { type: 'pivot', id: 'pv1' });
  assert.deepEqual(sansPivot.passages, []);
  assert.deepEqual(sansPivot.pivots, []);
  const sansCase = E.supprimer(m, { type: 'case', id: 'a' });
  assert.deepEqual(sansCase.passages.map((p) => p.id), ['ps2', 'ps3']);
  assert.equal(sansCase.pivots.length, 1);
  assert.deepEqual(E.supprimer(m, { type: 'raccord', cote: 2, pos: 1 }).passages.map((p) => p.id), ['ps1', 'ps2']);
  assert.throws(() => E.supprimer(m, { type: 'raccord', cote: 0, pos: 0 }), /Aucun chemin/);
  assert.throws(() => E.supprimer(m, { type: 'passage', id: 'zz' }), /introuvable/);
  assert.throws(() => E.supprimer(m, { type: 'pivot', id: 'zz' }), /introuvable/);
});

test('éditeur : cibleEn trouve pivot et passage, poigneeEn la poignée du passage sélectionné, haloDe et marquages', () => {
  const m = modele('e', {
    cases: [caseDe('a', 40, 80)], pivots: [{ id: 'pv1', x: 90, y: 90 }],
    passages: [{ id: 'ps1', a: { 'case': 'a' }, b: rac(3, 1) }, { id: 'ps2', a: { pivot: 'pv1' }, b: rac(1, 2) }]
  });
  assert.deepEqual(E.cibleEn(m, 90, 91), { type: 'pivot', id: 'pv1' });
  const t = G.tracesPassages(m, '4x4')[0];
  const milieu = t.pts[12];
  assert.deepEqual(E.cibleEn(m, milieu.x, milieu.y), { type: 'passage', id: 'ps1' });
  assert.deepEqual(E.extremiteDeCible({ type: 'pivot', id: 'pv1' }), { pivot: 'pv1' });
  assert.deepEqual(E.refDeCible({ type: 'passage', id: 'ps1' }), { type: 'passage', id: 'ps1' });
  assert.equal(E.poigneeEn(m, null, t.controle.x, t.controle.y), null);
  assert.equal(E.poigneeEn(m, { type: 'case', id: 'a' }, t.controle.x, t.controle.y), null);
  assert.equal(E.poigneeEn(m, { type: 'passage', id: 'ps1' }, 0, 0), null);
  assert.deepEqual(E.poigneeEn(m, { type: 'passage', id: 'ps1' }, t.controle.x + 2, t.controle.y - 2), { id: 'ps1', x: t.controle.x, y: t.controle.y });
  assert.equal(E.haloDe(m, { type: 'passage', id: 'ps1' }).lignes.length, 1);
  assert.equal(E.haloDe(m, { type: 'pivot', id: 'pv1' }).cercles.length, 1);
  const mq = E.marquages([{ code: 'passages_croises', message: '', ref: { type: 'passage', id: 'ps1', ids: ['ps1', 'ps2'] } }, { code: 'pivot_degre', message: '', ref: { type: 'pivot', id: 'pv1' } }]);
  assert.deepEqual([mq.passages, mq.pivots], [['ps1', 'ps2'], ['pv1']]);
  assert.match(E.svgPoignee(m, { type: 'passage', id: 'ps1' }, '4x4'), /data-poignee="ps1"/);
  assert.equal(E.svgPoignee(m, null, '4x4'), '');
  assert.match(E.svgPivots(m, { type: 'pivot', id: 'pv1' }, mq), /pm-editeur-pivot-choisi pm-editeur-en-erreur/);
  assert.deepEqual(E.extremitesUtilisees(m), { raccords: ['3:1', '1:2'], coins: [] });
  assert.match(E.libelleCible(m, { type: 'pivot', id: 'pv1' }), /Pivot pv1/);
  assert.match(E.libelleCible(m, { type: 'passage', id: 'ps1' }), /poignée/);
});

test('éditeur : la validation en direct signale les erreurs et alertes des passages créés par les fonctions pures', () => {
  let m = modele('e', { cases: [caseDe('a', 40, 60)], chemins: [{ id: 'h1', a: { 'case': 'a' }, b: rac(0, 1) }] });
  m = E.ajouterPivot(m, 60, 60);
  m = E.ajouterPassage(m, { 'case': 'a' }, { pivot: 'pv1' });
  m = E.ajouterPassage(m, { pivot: 'pv1' }, rac(0, 1));
  const v = M.validerModele(m);
  assert.ok(v.erreurs.some((x) => x.code === 'raccord_double'), 'raccord déjà pris par le chemin : blocage');
  assert.ok(v.alertes.some((x) => x.code === 'pivot_degre_faible'));
});

/* ---------- Générateur, format 5×5, poignée du demi-cercle ---------- */

test('générateur : avec une bibliothèque qui contient une centrale à passages, l\'écart entre villes est vérifié sur le graphe complet', () => {
  const A = require('./aides-v2.js');
  const d = A.documentExemples('4x4');
  const quart = clone(QUART); quart.exemplaires = 6;
  d.modeles.push(quart);
  let avecPassages = 0;
  for (let k = 0; k < 8; k++) {
    const r = PM.generateur.generer(d, { graine: 'passages-' + k, candidats: 15 });
    assert.ok(r.ok, r.raison);
    if (r.doc.plateau.tuiles.some((t) => t.modeleId === 'quart')) avecPassages++;
    const g = GR.construire(r.doc);
    assert.deepEqual(GR.villesProches(g), [], 'aucune paire de villes à moins de 4 pas, passages compris');
    assert.equal(GR.equilibre(r.doc).S, r.score.S, 'le score du générateur est celui du graphe complet');
  }
  assert.ok(avecPassages >= 4, 'le générateur utilise la tuile à passages : ' + avecPassages + '/8');
});

test('5×5 : demi-cercle par défaut entre raccords voisins (rayon 10 mm), sans erreur ni alerte ; quart de tour à 1 pas', () => {
  const m5 = (o) => Object.assign(modele('m5', { grille: '5x5' }), o);
  const demi = m5({ passages: [{ id: 'q1', a: rac(0, 0), b: rac(0, 1) }] });
  const t = G.tracesPassages(demi, '5x5')[0];
  assert.ok(t.rayonMin > 9.5 && t.rayonMin < 10.1, String(t.rayonMin));
  const v = M.validerModele(demi, '5x5');
  assert.deepEqual([v.erreurs, v.alertes], [[], []]);
  // quart de tour entre deux tuiles du 5×5 : case (30, 70) -> raccord W pos 1 (0, 50), puis raccord E pos 1 -> case
  const q5 = m5({
    cases: [caseDe('a', 30, 70), caseDe('b', 70, 70)], chemins: [{ id: 'h1', a: { 'case': 'a' }, b: { 'case': 'b' } }],
    passages: [{ id: 'q1', a: { 'case': 'a' }, b: rac(3, 1) }, { id: 'q2', a: { 'case': 'b' }, b: rac(1, 1) }]
  });
  assert.deepEqual(M.validerModele(q5, '5x5').erreurs, []);
  const d = M.nouveauDocument('5x5');
  d.modeles = [q5];
  d.plateau.tuiles = [{ modeleId: 'm5', col: 1, lig: 1, rot: 0 }, { modeleId: 'm5', col: 2, lig: 1, rot: 0 }];
  const g = GR.construire(d);
  assert.equal(GR.distances(g, '1,1:b').get('2,1:a'), 1);
  const svg = R.contenuTuile(q5, { format: '5x5', fondPerdu: 3 });
  assert.match(/<path d="([^"]+)"[^>]*data-passage="q1"/.exec(svg)[1], /^M30 70 Q\S+ \S+ 0 50 L-3 50$/);
});

test('éditeur : la poignée du demi-cercle est au point de contrôle de la quadratique de même sommet (pas de saut au premier glissement)', () => {
  const demi = modele('d', { passages: [{ id: 'q1', a: rac(0, 0), b: rac(0, 2) }] });
  const t = G.tracesPassages(demi, '4x4')[0];
  assert.deepEqual(t.controle, { x: 60, y: 60 });
  const apexCercle = t.pts[24]; // sommet du demi-cercle (fin de la première cubique)
  const quad = G.tracesPassages(E.definirCourbe(demi, 'q1', t.controle.x, t.controle.y, '4x4'), '4x4')[0];
  const apexQuad = quad.pts[12];
  assert.ok(Math.hypot(apexCercle.x - apexQuad.x, apexCercle.y - apexQuad.y) < 0.01);
});
