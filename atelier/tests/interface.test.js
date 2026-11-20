'use strict';
// Logique pure du lot C (interface) : géométrie du dessin, paramètres d'adresse, retouche du plateau.
// Le DOM lui-même est vérifié dans un vrai navigateur par outils/recette.html.
const test = require('node:test');
const assert = require('node:assert');
const H = require('../src/hex.js');
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
const R = require('../src/rendu.js');
const A = require('../src/app.js');
const VP = require('../src/vue-plateau.js');

const proche = (a, b) => Math.abs(a - b) < 1e-9;

test('rendu : chaque arête est à mi-chemin entre la case et la voisine désignée par ARETE_DIR', () => {
  for (const cle of ['0,0', '3,-2', '-4,5']) {
    const p = H.decle(cle), c = H.centre(p.q, p.r, R.PLAT), s = H.sommets(c.x, c.y, R.PLAT), v = H.voisines(cle);
    for (let i = 0; i < 6; i++) {
      const milieu = { x: (s[i].x + s[(i + 1) % 6].x) / 2, y: (s[i].y + s[(i + 1) % 6].y) / 2 };
      const pv = H.decle(v[R.ARETE_DIR[i]]), cv = H.centre(pv.q, pv.r, R.PLAT);
      assert.ok(proche(milieu.x, (c.x + cv.x) / 2) && proche(milieu.y, (c.y + cv.y) / 2), 'arête ' + i + ' de ' + cle);
    }
  }
});

test('rendu : contour d’une case seule, de deux cases voisines, du noyau', () => {
  assert.strictEqual(R.aretesContour(['0,0']).length, 6);
  assert.strictEqual(R.aretesContour(['0,0', '1,0']).length, 10);
  const noyau = P.casesModele('N1', 0, 0, 0).map((c) => c.cle);
  assert.strictEqual(R.aretesContour(noyau).length, 18);
  // Aucune arête de contour ne sépare deux cases du groupe.
  for (const a of R.aretesContour(noyau)) assert.ok(!noyau.includes(H.voisines(a.cle)[a.dir]));
  assert.deepStrictEqual(R.aretesContour([]), []);
});

test('rendu : pointVersCase retrouve la case de son centre et des points proches du centre', () => {
  for (const cle of H.disque(6)) {
    const p = H.decle(cle), c = H.centre(p.q, p.r, R.PLAT);
    assert.strictEqual(R.pointVersCase(c.x, c.y), cle);
    for (const s of H.sommets(c.x, c.y, R.PLAT)) {
      assert.strictEqual(R.pointVersCase(c.x + (s.x - c.x) * 0.8, c.y + (s.y - c.y) * 0.8), cle, 'près du sommet de ' + cle);
    }
  }
  assert.strictEqual(R.pointVersCase(0.2, -0.2), '0,0');     // pas de « -0 » dans la clé
});

test('rendu : cadre d’un groupe de cases', () => {
  const c = R.cadre(['0,0'], 60, 0);
  assert.ok(proche(c.l, 60) && proche(c.h, 2 * 60 / Math.sqrt(3)) && proche(c.x, -30));
  const m = R.cadre(['0,0'], 60, 10);
  assert.ok(proche(m.l, 80) && proche(m.x, -40));
  const vide = R.cadre([], 60, 0);
  assert.ok(proche(vide.l, 60));
  const grand = R.cadre(H.disque(5), 60, 0);
  assert.ok(proche(grand.l, 11 * 60));
});

test('rendu : flèches du clavier, aller puis retour ramène à la même case', () => {
  for (const cle of ['0,0', '2,-3', '-1,4', '3,1']) {
    assert.strictEqual(R.caseVoisineFleche(R.caseVoisineFleche(cle, 'haut'), 'bas'), cle);
    assert.strictEqual(R.caseVoisineFleche(R.caseVoisineFleche(cle, 'bas'), 'haut'), cle);
    assert.strictEqual(R.caseVoisineFleche(R.caseVoisineFleche(cle, 'gauche'), 'droite'), cle);
    for (const sens of ['haut', 'bas', 'gauche', 'droite']) assert.strictEqual(H.distance(cle, R.caseVoisineFleche(cle, sens)), 1);
  }
  // Monter deux fois ne dérive pas : on reste sur la même verticale.
  const deux = H.decle(R.caseVoisineFleche(R.caseVoisineFleche('0,0', 'haut'), 'haut'));
  assert.ok(proche(H.centre(deux.q, deux.r, 60).x, 0));
});

test('rendu : villes numérotées dans l’ordre de lecture ; un motif par terrain du catalogue', () => {
  const plateau = G.generer(1).plateau, numeros = R.numerosVilles(plateau);
  assert.deepStrictEqual(Object.keys(numeros).map((k) => numeros[k]).sort(), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepStrictEqual(H.trier(Object.keys(numeros)), Object.keys(numeros).sort((a, b) => numeros[a] - numeros[b]));
  const C = require('../src/catalogue.js');
  for (const t of Object.keys(C.REGLAGES.couts)) assert.ok(R.TERRAINS[t], 'motif manquant pour ' + t);
  for (const id of C.ORDRE_EVENEMENTS) assert.ok(R.TERRAINS[C.EVENEMENTS[id].terrain]);
  assert.strictEqual(R.nomTerrain('foret'), 'Forêt');
  assert.strictEqual(R.nomTerrain('inconnu'), 'inconnu');
});

test('app : graine saisie (les chiffres seuls deviennent un entier)', () => {
  assert.strictEqual(A.graineSaisie('12'), 12);
  assert.strictEqual(A.graineSaisie(' 007 '), 7);
  assert.strictEqual(A.graineSaisie('abc'), 'abc');
  assert.strictEqual(A.graineSaisie('12a'), '12a');
  assert.strictEqual(A.graineSaisie(''), null);
  assert.strictEqual(A.graineSaisie('   '), null);
  assert.strictEqual(A.graineSaisie(undefined), null);
  assert.strictEqual(A.graineSaisie('1234567890'), '1234567890');     // trop long pour un entier sûr sur 32 bits : reste un texte
  assert.strictEqual(A.graineSaisie('x'.repeat(100)).length, 64);
  // Même plateau que la graine entière utilisée par les mesures de faisabilité.
  assert.deepStrictEqual(G.generer(A.graineSaisie('3')).plateau, G.generer(3).plateau);
  assert.strictEqual(A.graineSuivante(7), 8);
  assert.strictEqual(A.graineSuivante('abc'), 1);
  assert.strictEqual(A.graineSuivante(null), 1);
});

test('app : paramètres de l’adresse', () => {
  assert.deepStrictEqual(A.lireParametres('#onglet=partie&graine=12&partie=5'), { onglet: 'partie', graine: 12, partie: 5, mode: null });
  assert.deepStrictEqual(A.lireParametres(''), { onglet: null, graine: null, partie: null, mode: null });
  assert.deepStrictEqual(A.lireParametres('#onglet=pirate&graine=mon%20plateau'), { onglet: null, graine: 'mon plateau', partie: null, mode: null });
  assert.deepStrictEqual(A.lireParametres('#graine=%E0%A4%A&onglet=inventaire'), { onglet: 'inventaire', graine: null, partie: null, mode: null });
  assert.deepStrictEqual(A.lireParametres('#__proto__=x&constructor=y'), { onglet: null, graine: null, partie: null, mode: null });
  assert.strictEqual(A.nomSur('<img src=x>'), '_img_src_x_');
  assert.strictEqual(A.nomSur(''), 'sans-nom');
});

test('plateau : déplacer une pièce (retrait puis pose), refus sans rien changer', () => {
  let pl = P.vide(1);
  pl = P.poser(pl, 'N1', 0, 0, 0).plateau;
  const pose = P.poser(pl, 'M4', 3, 0, 0);
  pl = P.avecCamps(pose.plateau);
  const r = VP.deplacerPiece(pl, pose.id, -4, 0, 2);
  assert.ok(r.ok);
  const deplacee = r.plateau.pieces.find((p) => p.id === r.id);
  assert.deepStrictEqual({ modele: deplacee.modele, q: deplacee.q, r: deplacee.r, rotation: deplacee.rotation }, { modele: 'M4', q: -4, r: 0, rotation: 2 });
  assert.strictEqual(r.plateau.pieces.length, 2);
  assert.strictEqual(pl.pieces.length, 2, 'le plateau reçu n’est pas modifié');
  const sans = VP.deplacerPiece(pl, pose.id, 5, 2);
  assert.strictEqual(sans.plateau.pieces.find((p) => p.id === sans.id).rotation, 0, 'rotation conservée par défaut');
  const refus = VP.deplacerPiece(pl, pose.id, 0, 0);
  assert.strictEqual(refus.ok, false);
  assert.strictEqual(refus.plateau, pl);
  assert.match(refus.raison, /Chevauchement/);
  assert.strictEqual(VP.deplacerPiece(pl, 'inconnue', 1, 1).ok, false);
});

test('plateau : déplacer une ville de déploiement recalcule les camps', () => {
  const pl = G.generer(1).plateau, cases = P.cases(pl);
  const idVille = cases[pl.camps.vert[0]].piece;
  const libre = '9,0';
  const p = H.decle(libre), r = VP.deplacerPiece(pl, idVille, p.q, p.r);
  assert.ok(r.ok);
  assert.ok(!r.plateau.camps.vert.includes(pl.camps.vert[0]));
  assert.deepStrictEqual(r.plateau.camps, P.campsAuto(r.plateau));
});

test('plateau : étiquettes des cases (contacts, rations, coordonnées)', () => {
  const pl = G.generer(1).plateau, n = Object.keys(P.cases(pl)).length;
  assert.deepStrictEqual(VP.etiquettes(pl, 'rien'), {});
  const cotes = VP.etiquettes(pl, 'cotes');
  // Le contact se juge sur le terrain construit ; les villes, posées par-dessus une Plaine, n'ajoutent aucune case.
  const terrain = Object.keys(P.cases(pl, { sansVilles: true })).length;
  assert.strictEqual(terrain, n);
  assert.strictEqual(Object.keys(cotes).length, terrain);
  assert.ok(Object.values(cotes).every((v) => Number.isInteger(v) && v >= 3));
  assert.strictEqual(Object.keys(VP.etiquettes(pl, 'pieces')).length, terrain);
  const vert = VP.etiquettes(pl, 'rations-vert'), rouge = VP.etiquettes(pl, 'rations-rouge');
  assert.strictEqual(vert[pl.camps.vert[0]], 0);
  assert.strictEqual(rouge[pl.camps.rouge[1]], 0);
  assert.ok(vert[pl.camps.rouge[0]] > 0, 'une ville de Rouge est à portée de Vert, à un coût positif');
  assert.strictEqual(Object.keys(vert).length, n - 9, 'toutes les cases sauf les 9 de montagne');
  assert.strictEqual(VP.etiquettes(pl, 'coordonnees')['0,0'], '0,0');
  assert.deepStrictEqual(VP.etiquettes(P.vide(1), 'rations-vert'), {});
});

test('plateau : cases admissibles pour une tuile d’événement', () => {
  const pl = G.generer(1).plateau, cases = P.cases(pl);
  const tunnel = VP.casesAdmissibles(pl, 'E3');
  assert.strictEqual(tunnel.length, 9);
  assert.ok(tunnel.every((k) => cases[k].terrain === 'montagne'));
  const crevasse = VP.casesAdmissibles(pl, 'E2');
  assert.ok(crevasse.length > 0 && crevasse.every((k) => cases[k].terrain === 'plaine' && cases[k].modele !== 'N1'));
  assert.ok(!VP.casesAdmissibles(pl, 'E2', [crevasse[0]]).includes(crevasse[0]), 'case occupée par un bataillon exclue');
  assert.deepStrictEqual(VP.casesAdmissibles(pl, 'inconnu'), []);
});
