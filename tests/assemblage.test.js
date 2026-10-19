// Tests de la logique de l'écran d'assemblage et de la bibliothèque (sans DOM).
// Lancer : node --test tests/assemblage.test.js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');

require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/bibliotheque.js');
require('../src/assemblage.js');
var PM = globalThis.PM, M = PM.modele, A = PM.assemblage, B = PM.bibliotheque;

/** Document avec les modèles d'exemple (de quoi remplir la grille 4×4). */
function docExemples() {
  var d = M.nouveauDocument();
  d.modeles = M.copieExemples();
  return d;
}
var ID = { centrale: 'ex-centrale', bord: 'ex-bord', coin: 'ex-coin' };

/** Remplit la grille avec le modèle d'exemple du gabarit de chaque cellule (rotation suggérée). */
function remplir(doc) {
  for (var lig = 0; lig < 4; lig++) {
    for (var col = 0; col < 4; col++) {
      if (!M.tuileEn(doc, col, lig)) doc = M.poserTuile(doc, ID[M.gabaritCellule(col, lig)], col, lig);
    }
  }
  return doc;
}

test('conversions écran ↔ mm avec preserveAspectRatio meet (marges de centrage)', function () {
  var vue = { x: -40, y: -52, w: 560, h: 600 };
  // Élément 1120 × 600 px : échelle min(2, 1) = 1, marge horizontale (1120 - 560) / 2 = 280
  var rect = { left: 10, top: 20, width: 1120, height: 600 };
  var c = A.cadrage(rect, vue);
  assert.equal(c.echelle, 1);
  assert.equal(c.dx, 290);
  assert.equal(c.dy, 20);
  var p = A.ecranVersMm(290 + 40, 20 + 52, rect, vue); // origine du plateau
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9);
  var e = A.mmVersEcran(480, 480, rect, vue);
  var retour = A.ecranVersMm(e.x, e.y, rect, vue);
  assert.ok(Math.abs(retour.x - 480) < 1e-9 && Math.abs(retour.y - 480) < 1e-9);
  // Élément plus haut que large : échelle limitée par la largeur
  var r2 = { left: 0, top: 0, width: 280, height: 1000 };
  assert.equal(A.cadrage(r2, vue).echelle, 0.5);
  assert.equal(A.cadrage(r2, vue).dy, (1000 - 300) / 2);
});

test('celluleSous : aimantation sur la cellule (60 mm du centre, toute la cellule)', function () {
  assert.deepEqual(A.celluleSous(60, 60), { col: 0, lig: 0 });
  assert.deepEqual(A.celluleSous(119.9, 1), { col: 0, lig: 0 });   // coin de cellule : pas de zone morte
  assert.deepEqual(A.celluleSous(120, 240), { col: 1, lig: 2 });
  assert.deepEqual(A.celluleSous(479, 479), { col: 3, lig: 3 });
  assert.equal(A.celluleSous(-1, 50), null);
  assert.equal(A.celluleSous(480, 50), null);
  assert.equal(A.celluleSous(50, 500), null);
  assert.equal(A.celluleSous(NaN, 0), null);
});

test('jonctionSous : rayon de 15 mm autour des 9 jonctions intérieures', function () {
  assert.deepEqual(A.jonctionSous(120, 120), { i: 1, j: 1 });
  assert.deepEqual(A.jonctionSous(360 + 10, 240 - 10), { i: 3, j: 2 }); // 14,1 mm
  assert.equal(A.jonctionSous(120 + 11, 120 + 11), null);              // 15,6 mm
  assert.equal(A.jonctionSous(0, 0), null);                             // coin extérieur
  assert.equal(A.jonctionSous(480, 240), null);                         // bord extérieur
  var n = 0;
  for (var x = 0; x <= 480; x += 120) for (var y = 0; y <= 480; y += 120) if (A.jonctionSous(x, y)) n++;
  assert.equal(n, 9);
});

test('cellulesCompatibles : rôle respecté (coin, bord, centrale), occupation, poses illimitées, modèle incomplet', function () {
  var d = docExemples();
  assert.equal(A.cellulesCompatibles(d, 'ex-coin').length, 4);
  assert.equal(A.cellulesCompatibles(d, 'ex-bord').length, 8);
  assert.equal(A.cellulesCompatibles(d, 'ex-centrale').length, 4);
  d = M.poserTuile(d, 'ex-coin', 0, 0);
  assert.equal(A.cellulesCompatibles(d, 'ex-coin').length, 3);
  var r = A.cellulesCompatibles(d, 'ex-coin').filter(function (c) { return c.col === 3 && c.lig === 3; })[0];
  assert.equal(r.rot, 2); // rotation suggérée du coin SE
  assert.equal(A.cellulesCompatibles(d, 'ex-coin').filter(function (c) { return c.col === 1 && c.lig === 1; }).length, 0);
  // poses illimitées : même avec 1 exemplaire (ou 0) toutes les cellules libres du rôle restent compatibles
  d = M.changerExemplaires(d, 'ex-coin', 0);
  assert.equal(A.cellulesCompatibles(d, 'ex-coin').length, 3);
  var inc = docExemples();
  inc.modeles[0].cases[0].diametre = 60;
  assert.equal(A.cellulesCompatibles(inc, inc.modeles[0].id).length, 0);
});

test('poserTuileTournee : rotation choisie pour toute tuile, rotation suggérée si absente', function () {
  var d = docExemples();
  assert.equal(M.tuileEn(A.poserTuileTournee(d, 'ex-centrale', 1, 1, 3), 1, 1).rot, 3);
  assert.equal(M.tuileEn(A.poserTuileTournee(d, 'ex-bord', 3, 1, 2), 3, 1).rot, 2); // choix de l'utilisateur
  assert.equal(M.tuileEn(A.poserTuileTournee(d, 'ex-bord', 3, 1, null), 3, 1).rot, 1); // suggestion : bord est
  assert.equal(M.tuileEn(A.poserTuileTournee(d, 'ex-bord', 3, 1), 3, 1).rot, 1);
  assert.equal(M.tuileEn(A.poserTuileTournee(d, 'ex-bord', 1, 0, -1), 1, 0).rot, 3);
  assert.throws(function () { A.poserTuileTournee(d, 'ex-bord', 4, 1, 0); }, /hors de la grille/);
  assert.throws(function () { A.poserTuileTournee(d, 'ex-bord', 1, 1, 0); }, /Cette tuile est un bord/);
  assert.equal(d.plateau.tuiles.length, 0); // pureté
});

test('deplacerTuile : retrait + pose, rotation conservée, vers une autre cellule du même rôle', function () {
  var d = docExemples();
  d = M.poserTuile(d, 'ex-bord', 1, 0);
  d = M.tournerTuile(d, 1, 0, 1);
  var n = A.deplacerTuile(d, { col: 1, lig: 0 }, { col: 3, lig: 2 });
  assert.equal(M.tuileEn(n, 1, 0), null);
  assert.equal(M.tuileEn(n, 3, 2).rot, 1);
  assert.equal(M.tuileEn(d, 1, 0).rot, 1); // pureté
  assert.equal(A.testerDeplacement(d, { col: 1, lig: 0 }, { col: 0, lig: 0 }).ok, false); // un bord ne va pas dans un coin
  assert.match(A.testerDeplacement(d, { col: 1, lig: 0 }, { col: 2, lig: 2 }).raison, /Cette tuile est un bord/);
  assert.equal(A.cellulesCompatiblesDeplacement(d, { col: 1, lig: 0 }).length, 8); // les 8 cellules de bord, la sienne comprise
  d = M.poserTuile(d, 'ex-bord', 2, 0);
  var t = A.testerDeplacement(d, { col: 1, lig: 0 }, { col: 2, lig: 0 });
  assert.equal(t.ok, false);
  assert.match(t.raison, /occupée/);
  assert.throws(function () { A.deplacerTuile(d, { col: 1, lig: 0 }, { col: 2, lig: 0 }); });
  assert.equal(A.testerDeplacement(d, { col: 1, lig: 0 }, { col: 1, lig: 0 }).identique, true);
  assert.equal(A.testerDeplacement(d, { col: 2, lig: 2 }, { col: 1, lig: 1 }).ok, false);
});

test('retirerParClicDroit : retire la tuile (pure), annonce les villes retirées, rien sur une cellule vide', function () {
  var d = remplir(docExemples());
  d = M.cyclerJeton(M.cyclerJeton(d, 2, 1), 2, 2);
  var avant = JSON.stringify(d);
  var r = A.retirerParClicDroit(d, 1, 0);
  assert.equal(r.ok, true);
  assert.equal(M.tuileEn(r.doc, 1, 0), null);
  assert.equal(r.doc.plateau.tuiles.length, 15);
  assert.equal(r.tuile.col, 1);
  assert.equal(JSON.stringify(d), avant); // pureté
  assert.equal(r.niveau, 'alerte');
  assert.equal(r.phrase, 'Tuile « ex-bord » retirée de (1,0). 1 ville retirée : la jonction (2,1) n\'a plus 4 tuiles. Ctrl+Z pour annuler.');
  var s = A.retirerParClicDroit(d, 0, 0);
  assert.equal(s.niveau, 'info');
  assert.equal(s.phrase, 'Tuile « ex-coin » retirée de (0,0).');
  var vide = A.retirerParClicDroit(r.doc, 1, 0);
  assert.equal(vide.ok, false);
  assert.equal(vide.doc, r.doc);
  assert.equal(A.retirerParClicDroit(d, 9, 9).ok, false);
});

test('effetsDeAction : villes retirées par un retrait, avec la raison', function () {
  var d = remplir(docExemples());
  assert.equal(d.plateau.tuiles.length, 16);
  d = M.cyclerJeton(M.cyclerJeton(d, 2, 1), 2, 2);
  var e = A.effetsDeAction(d, M.retirerTuile(d, 1, 0));
  assert.deepEqual(e.jetonsRetires.map(function (j) { return [j.i, j.j, j.type]; }), [[2, 1, 'capture']]);
  assert.equal(A.messageEffets(e), '1 ville retirée : la jonction (2,1) n\'a plus 4 tuiles. Ctrl+Z pour annuler.');
  assert.match(A.messageEffets(A.effetsDeAction(d, M.retirerTuile(d, 1, 1))), /^2 villes retirées : /);
  assert.equal(A.messageEffets(A.effetsDeAction(d, M.retirerTuile(d, 0, 0))), null);
  // une rotation ne retire jamais de ville (moins de 2 ports = alerte seulement)
  assert.deepEqual(A.effetsDeAction(d, M.tournerTuile(d, 1, 1, 1)).jetonsRetires, []);
});

test('etiquetteCellule : gabarit attendu et camp de la cellule', function () {
  assert.equal(A.etiquetteCellule(0, 0), 'Coin, camp vert');
  assert.equal(A.etiquetteCellule(0, 1), 'Bord, camp vert');
  assert.equal(A.etiquetteCellule(2, 3), 'Bord, camp rouge');
  assert.equal(A.etiquetteCellule(1, 1), 'Centrale');
  assert.equal(A.etiquetteCellule(0, 2, '5x5'), 'Bord, neutre');
  assert.equal(A.etiquetteCellule(4, 4), null);
});

test('messageJeton et compterJetons : cycle campement → ville → campement', function () {
  var d = remplir(docExemples());
  d = M.cyclerJeton(d, 1, 1);
  assert.equal(A.compterJetons(d), 1);
  assert.deepEqual(A.messageJeton(d, 1, 1), { texte: 'Ville sur la jonction (1,1).', niveau: 'info' });
  d = M.cyclerJeton(d, 1, 1);
  assert.equal(A.messageJeton(d, 1, 1).texte, 'Ville retirée : la jonction (1,1) redevient un campement.');
  assert.equal(A.compterJetons(d), 0);
});

test('alertesPlateau : raccords « vide » et « mort » signalés, « absent » ignoré, ports vers le bord', function () {
  var d = docExemples();
  d = M.poserTuile(d, 'ex-centrale', 1, 1);
  assert.equal(A.alertesPlateau(d).length, 0);
  assert.ok(M.raccordsMorts(d).length > 0);
  assert.deepEqual(A.alertesPlateau(remplir(docExemples())), []);
  // bord retourné sur la rangée nord : raccord face au vide et deux ports vers le bord
  var r = M.poserTuile(docExemples(), 'ex-bord', 1, 0, 2);
  var al = A.alertesPlateau(r);
  var rac = al.filter(function (a) { return a.type === 'raccord'; });
  assert.ok(rac.some(function (a) { return a.raison === 'vide' && a.y === 0; }));
  var ports = al.filter(function (a) { return a.type === 'port'; });
  assert.equal(ports.length, 2);
  ports.forEach(function (p) { assert.equal(p.y, 0); assert.equal(p.x, p.col * 120 + PM.geometrie.pointCoin(p.coin).x); });
});

test('cibleSurbrillance : références de l\'état et de validerPlateau', function () {
  var d = remplir(docExemples());
  assert.deepEqual(A.cibleSurbrillance({ type: 'tuile', col: 2, lig: 1 }, d), [{ forme: 'rect', x: 240, y: 120, w: 120, h: 120 }]);
  assert.deepEqual(A.cibleSurbrillance({ type: 'jonction', i: 2, j: 3 }, d), [{ forme: 'cercle', x: 240, y: 360, r: 22 }]);
  assert.deepEqual(A.cibleSurbrillance({ type: 'jeton', i: 2, j: 3 }, d), [{ forme: 'cercle', x: 240, y: 360, r: 22 }]);
  var r = A.cibleSurbrillance({ type: 'raccord', col: 1, lig: 1, cote: 1, pos: 0 }, d)[0];
  assert.deepEqual([r.x, r.y], [240, 150]);
  var p = A.cibleSurbrillance({ type: 'port', col: 1, lig: 1, coin: 2 }, d)[0];
  assert.deepEqual([p.x, p.y], [240, 240]);
  assert.equal(A.cibleSurbrillance({ type: 'case', modeleId: 'ex-coin', id: 'c1' }, d).length, 4);
  assert.deepEqual(A.cibleSurbrillance(null, d), []);
  assert.deepEqual(A.cibleSurbrillance({ type: 'forme' }, d), []);
});

test('svgPlateau : 16 cellules, 9 jonctions, camps vert et rouge, villes, classes de glissement ; 5×5', function () {
  var d = docExemples();
  var s = A.svgPlateau(d, {});
  assert.equal((s.match(/data-cellule="/g) || []).length, 16);
  assert.equal((s.match(/data-jonction="/g) || []).length, 9);
  assert.match(s, />Bord, camp vert</);
  assert.match(s, />Coin, camp rouge</);
  assert.match(s, /Camp vert \(nord\)/);
  assert.match(s, /Camp rouge \(sud\)/);
  assert.doesNotMatch(s, /J1|J2|Retirée|[Cc]arrefour/);
  assert.match(s, /48 × 48 cm/);
  var compat = {};
  [[0, 0], [1, 1]].forEach(function (c) { compat[c.join(',')] = true; });
  var s2 = A.svgPlateau(d, { compatibles: compat });
  assert.equal((s2.match(/pm-assemblage-compatible/g) || []).length, 2);
  assert.equal((s2.match(/pm-assemblage-estompee/g) || []).length, 14);
  var plein = remplir(docExemples());
  plein = M.cyclerJeton(plein, 2, 2);
  var s3 = A.svgPlateau(plein, { selection: { col: 1, lig: 1 }, surbrillance: { type: 'tuile', col: 0, lig: 0 } });
  assert.equal((s3.match(/pm-assemblage-occupee/g) || []).length, 16);
  assert.equal((s3.match(/class="pm-assemblage-nord"/g) || []).length, 16);
  assert.match(s3, /pm-assemblage-jeton/);
  assert.match(s3, /pm-assemblage-selection/);
  assert.match(s3, /pm-assemblage-surbrillance/);
  // à l'écran : cases d'apparition aux couleurs (et formes) de leur camp
  assert.equal((s3.match(/data-apparition="vert"/g) || []).length, 6);
  assert.equal((s3.match(/data-apparition="rouge"/g) || []).length, 6);
  // campements (docs/18, 2026-10-19) : jeton feu de bois aux intersections sans ville dont les 4 tuiles sont posées, petit point sinon
  assert.match(s3, /Campement \(1,1\) : clic pour y poser une ville/);
  assert.equal((s3.match(/class="pm-assemblage-campement"/g) || []).length, 8, '9 jonctions, 1 ville : 8 campements');
  assert.ok(s3.includes(PM.rendu.contenuJeton('campement', 120, 120, '4x4')), 'jeton campement de PM.rendu en (1,1)');
  assert.equal((s3.match(/class="pm-assemblage-point"/g) || []).length, 0);
  assert.equal((s.match(/class="pm-assemblage-campement"/g) || []).length, 0, 'sans tuile : aucun campement');
  assert.equal((s.match(/class="pm-assemblage-point"/g) || []).length, 9, 'sans tuile : 9 petits points');
  assert.match(s, /Jonction \(1,1\) : /);
  assert.ok(!/style=/.test(s3), 'aucun style en ligne (CSP)');
  var d5 = M.nouveauDocument('5x5');
  d5.modeles = M.copieExemples('5x5');
  var s5 = A.svgPlateau(d5, {});
  assert.equal((s5.match(/data-cellule="/g) || []).length, 25);
  assert.equal((s5.match(/data-jonction="/g) || []).length, 16);
  assert.match(s5, />Bord, neutre</);
});

test('bibliothèque : groupes par gabarit, filtre, poses illimitées (pas de compteur), état incomplet, alertes', function () {
  var d = docExemples();
  var g = B.vignettesBibliotheque(d, 'tous');
  assert.deepEqual(g.map(function (x) { return x.gabarit; }), ['centrale', 'bord', 'coin']);
  assert.deepEqual(g.map(function (x) { return x.titre; }), ['Centrales', 'Bords', 'Coins']);
  assert.equal(B.vignettesBibliotheque(d, 'coin').length, 1);
  assert.equal(B.vignettesBibliotheque(d, 'coin')[0].modeles[0].exemplaires, 4);
  assert.equal('restants' in B.vignettesBibliotheque(d, 'coin')[0].modeles[0], false);
  for (var n = 0; n < 4; n++) d = M.poserTuile(d, 'ex-coin', [0, 3, 3, 0][n], [0, 0, 3, 3][n]); // les 4 exemplaires posés
  var v = B.vignettesBibliotheque(d, 'coin')[0].modeles[0];
  assert.deepEqual([v.posees, v.posable, v.alertes], [4, true, 0]); // toujours posable (poses illimitées)
  d.modeles[0].cases[0].diametre = 60;
  var vc = B.vignettesBibliotheque(d, 'centrale')[0].modeles[0];
  assert.equal(vc.complet, false);
  assert.equal(vc.posable, false);
  d.modeles[1].cases[2].type = 'deplacement'; // bord sans case d'apparition : alerte, toujours posable
  var vb = B.vignettesBibliotheque(d, 'bord')[0].modeles[0];
  assert.deepEqual([vb.complet, vb.alertes], [true, 1]);
  assert.equal(B.libelleRestants, undefined);
  assert.equal(M.exemplairesRestants, undefined);
  d.modeles.push({ id: 'bizarre', gabarit: 'autre-chose', exemplaires: 1, cases: [], chemins: [] });
  var gs = B.vignettesBibliotheque(d, 'tous');
  assert.equal(gs[gs.length - 1].titre, 'Autres');
});
