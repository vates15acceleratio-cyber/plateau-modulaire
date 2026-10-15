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

/** Document avec les modèles d'exemple (4 exemplaires par rôle). */
function docExemples() {
  var d = M.nouveauDocument();
  d.modeles = M.copieExemples();
  return d;
}
function idRole(doc, role) { return doc.modeles.filter(function (m) { return m.role === role; })[0].id; }

/** Remplit toutes les cellules actives avec le modèle d'exemple de leur rôle. */
function remplir(doc) {
  M.cellulesActives(doc.plateau.forme).forEach(function (c) {
    var role = M.roleCellule(c.col, c.lig, doc.plateau.forme);
    if (role && !M.tuileEn(doc, c.col, c.lig)) doc = M.poserTuile(doc, idRole(doc, role), c.col, c.lig);
  });
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

test('cellulesCompatibles : selon le rôle, les cellules occupées et le stock', function () {
  var d = docExemples();
  var coins = A.cellulesCompatibles(d, idRole(d, 'coin')).map(function (c) { return c.col + ',' + c.lig; }).sort();
  assert.deepEqual(coins, ['0,0', '0,3', '3,0', '3,3']);
  assert.equal(A.cellulesCompatibles(d, idRole(d, 'centrale')).length, 4);
  assert.equal(A.cellulesCompatibles(d, idRole(d, 'apparition')).length, 4);
  d = M.poserTuile(d, idRole(d, 'coin'), 0, 0);
  assert.equal(A.cellulesCompatibles(d, idRole(d, 'coin')).length, 3);
  var r = A.cellulesCompatibles(d, idRole(d, 'coin')).filter(function (c) { return c.col === 3 && c.lig === 3; })[0];
  assert.equal(r.rot, 2); // rotation déduite du coin SE
  // Stock épuisé : plus aucune cellule
  d = M.changerExemplaires(d, idRole(d, 'coin'), 1);
  assert.equal(A.cellulesCompatibles(d, idRole(d, 'coin')).length, 0);
  // Modèle incomplet : aucune cellule
  var inc = docExemples();
  inc.modeles[0].cases = [];
  assert.equal(A.cellulesCompatibles(inc, inc.modeles[0].id).length, 0);
});

test('poserTuileTournee : la rotation ne s\'applique qu\'aux centrales', function () {
  var d = docExemples();
  var c = A.poserTuileTournee(d, idRole(d, 'centrale'), 1, 1, 3);
  assert.equal(M.tuileEn(c, 1, 1).rot, 3);
  var b = A.poserTuileTournee(d, idRole(d, 'bord'), 3, 1, 1);
  assert.equal(M.tuileEn(b, 3, 1).rot, 1); // bord est : rotation déduite 1, quarts ignorés
  assert.throws(function () { A.poserTuileTournee(d, idRole(d, 'bord'), 1, 1, 0); }, /bord/);
  assert.equal(d.plateau.tuiles.length, 0); // pureté
});

test('deplacerTuile : retrait + pose, rotation de centrale conservée, refus expliqué', function () {
  var d = docExemples();
  d = M.poserTuile(d, idRole(d, 'centrale'), 1, 1);
  d = M.tournerTuile(d, 1, 1, 2);
  var n = A.deplacerTuile(d, { col: 1, lig: 1 }, { col: 2, lig: 2 });
  assert.equal(M.tuileEn(n, 1, 1), null);
  assert.equal(M.tuileEn(n, 2, 2).rot, 2);
  assert.equal(M.tuileEn(d, 1, 1).rot, 2); // pureté
  // Stock à 0 : le déplacement reste possible (la tuile déplacée libère son exemplaire)
  var plein = M.changerExemplaires(d, idRole(d, 'centrale'), 1);
  assert.equal(A.testerDeplacement(plein, { col: 1, lig: 1 }, { col: 2, lig: 1 }).ok, true);
  assert.equal(A.cellulesCompatiblesDeplacement(plein, { col: 1, lig: 1 }).length, 4);
  // Mauvais rôle
  var t = A.testerDeplacement(d, { col: 1, lig: 1 }, { col: 0, lig: 0 });
  assert.equal(t.ok, false);
  assert.match(t.raison, /coin/);
  assert.throws(function () { A.deplacerTuile(d, { col: 1, lig: 1 }, { col: 0, lig: 0 }); });
  // Même cellule
  assert.equal(A.testerDeplacement(d, { col: 1, lig: 1 }, { col: 1, lig: 1 }).identique, true);
  assert.equal(A.testerDeplacement(d, { col: 2, lig: 2 }, { col: 1, lig: 1 }).ok, false);
});

test('effetsDeAction : jetons retirés par un retrait, avec la raison', function () {
  var d = remplir(docExemples());
  assert.equal(d.plateau.tuiles.length, 16);
  d = M.cyclerJeton(d, 2, 1); // ville
  d = M.cyclerJeton(d, 2, 2);
  d = M.cyclerJeton(d, 2, 2); // carrefour
  var apres = M.retirerTuile(d, 1, 0);
  var e = A.effetsDeAction(d, apres);
  assert.deepEqual(e.jetonsRetires.map(function (j) { return [j.i, j.j, j.type]; }), [[2, 1, 'capture']]);
  assert.match(e.jetonsRetires[0].raison, /jonction \(2,1\) n'a plus 4 tuiles/);
  assert.deepEqual(e.tuilesRetirees, []); // le retrait demandé n'est pas un effet de bord
  assert.equal(A.messageEffets(e), '1 ville retirée : la jonction (2,1) n\'a plus 4 tuiles. Ctrl+Z pour annuler.');
  // Deux jetons
  var apres2 = M.retirerTuile(d, 1, 1);
  var m2 = A.messageEffets(A.effetsDeAction(d, apres2));
  assert.match(m2, /^2 jetons retirés \(1 ville, 1 carrefour\) : /);
  // Sans effet
  assert.equal(A.messageEffets(A.effetsDeAction(d, M.retirerTuile(d, 0, 0))), null);
});

test("effetsDeAction : rotation d'une centrale qui retire un jeton faute de ports", function () {
  var d = remplir(docExemples());
  // Centrale de test : ports de coin seulement en NO et NE (modèle incomplet, posé directement dans le document)
  var c = JSON.parse(JSON.stringify(d.modeles.filter(function (m) { return m.role === 'centrale'; })[0]));
  c.id = 'test-centrale';
  c.chemins = c.chemins.filter(function (ch) {
    var k = ch.a.coin !== undefined ? ch.a.coin : ch.b.coin;
    return k === undefined || k === 0 || k === 1;
  });
  assert.equal(M.masquesDuModele(c).portsCoin, 3);
  d.modeles.push(c);
  d.plateau.tuiles.forEach(function (t) { if (t.col >= 1 && t.col <= 2 && t.lig >= 1 && t.lig <= 2) { t.modeleId = 'test-centrale'; t.rot = 0; } });
  // Jonction (2,2) : coin NE de (1,2) et coin NO de (2,2) → 2 ports
  assert.deepEqual(M.portsJonction(d, 2, 2), { ports: 2, tuiles: 4 });
  d.plateau.jetons = [{ i: 2, j: 2, type: 'capture' }];
  var apres = M.tournerTuile(d, 2, 2, 1);
  var e = A.effetsDeAction(d, apres);
  assert.deepEqual(e.jetonsRetires.map(function (j) { return [j.i, j.j]; }), [[2, 2]]);
  assert.equal(A.messageEffets(e), "1 ville retirée : la jonction (2,2) n'a plus que 1 port. Ctrl+Z pour annuler.");
});

test('effetsDeAction : changement de forme, tuiles retirées et tuiles à revoir', function () {
  var d = remplir(docExemples());
  d = M.cyclerJeton(d, 1, 1);
  var f = A.formesProposees().filter(function (x) { return x.cle === 'c00'; })[0];
  var apres = M.changerForme(d, f.forme);
  var e = A.effetsDeAction(d, apres);
  assert.deepEqual(e.tuilesRetirees.map(function (t) { return [t.col, t.lig]; }), [[0, 0]]);
  assert.deepEqual(e.jetonsRetires.map(function (j) { return [j.i, j.j]; }), [[1, 1]]);
  // Le bord (0,1) devient une cellule de coin : la tuile reste mais ne convient plus
  assert.deepEqual(e.tuilesARevoir.map(function (t) { return [t.col, t.lig, t.attendu]; }), [[0, 1, 'coin']]);
  var msg = A.messageEffets(e);
  assert.match(msg, /^1 tuile retirée : \(0,0\)\. 1 ville retirée : la jonction \(1,1\) n'a plus 4 tuiles\. La tuile \(0,1\) ne convient plus à sa cellule \(un coin attendu\)\. Ctrl\+Z pour annuler\.$/);
});

test('formesProposees : 15 formes, toutes valides, clés retrouvées', function () {
  var f = A.formesProposees();
  assert.equal(f.length, 15);
  var cles = {};
  f.forEach(function (x) {
    assert.equal(M.validerForme(x.forme).valide, true, x.libelle);
    assert.equal(cles[x.cle], undefined);
    cles[x.cle] = true;
    var inverse = { retires: x.forme.retires.slice().reverse() };
    assert.equal(A.cleForme(inverse), x.cle);
  });
  assert.equal(A.cleForme({ retires: [] }), 'complet');
  assert.equal(A.cleForme(undefined), 'complet');
  assert.equal(A.cleForme({ retires: [{ col: 1, lig: 1 }] }), null);
});

test('etiquetteCellule : rôles attendus des cellules libres', function () {
  var forme = { retires: [] };
  assert.equal(A.etiquetteCellule(0, 0, forme), 'Coin');
  assert.equal(A.etiquetteCellule(0, 1, forme), 'Bord');
  assert.equal(A.etiquetteCellule(1, 0, forme), 'Apparition J1');
  assert.equal(A.etiquetteCellule(2, 3, forme), 'Apparition J2');
  assert.equal(A.etiquetteCellule(1, 1, forme), 'Centrale');
  assert.equal(A.etiquetteCellule(0, 0, { retires: [{ col: 0, lig: 0 }] }), null);
  assert.equal(A.etiquetteCellule(0, 1, { retires: [{ col: 0, lig: 0 }] }), 'Coin');
});

test('carrefours : alerte seulement si les 2 sont du même côté (j = 1 ou j = 3)', function () {
  function doc(jetons) { var d = M.nouveauDocument(); d.plateau.jetons = jetons; return d; }
  assert.equal(A.carrefoursMemeCote(doc([{ i: 1, j: 2, type: 'carrefour' }, { i: 3, j: 2, type: 'carrefour' }])), null);
  assert.equal(A.carrefoursMemeCote(doc([{ i: 1, j: 1, type: 'carrefour' }, { i: 3, j: 3, type: 'carrefour' }])), null);
  assert.equal(A.carrefoursMemeCote(doc([{ i: 1, j: 1, type: 'carrefour' }, { i: 2, j: 2, type: 'carrefour' }])), null);
  assert.equal(A.carrefoursMemeCote(doc([{ i: 1, j: 1, type: 'carrefour' }, { i: 3, j: 1, type: 'carrefour' }])), 'nord');
  assert.equal(A.carrefoursMemeCote(doc([{ i: 1, j: 3, type: 'carrefour' }, { i: 2, j: 3, type: 'carrefour' }])), 'sud');
  assert.equal(A.carrefoursMemeCote(doc([{ i: 1, j: 3, type: 'capture' }, { i: 2, j: 3, type: 'carrefour' }])), null);
  assert.match(A.alerteCarrefours(doc([{ i: 1, j: 1, type: 'carrefour' }, { i: 3, j: 1, type: 'carrefour' }])), /même côté \(camp J1/);
  assert.equal(A.coteJonction(2), null);
});

test('messageJeton et compterJetons : cycle vide → ville → carrefour → vide', function () {
  var d = remplir(docExemples());
  d = M.cyclerJeton(d, 1, 1);
  assert.equal(A.compterJetons(d), 1);
  assert.deepEqual(A.messageJeton(d, 1, 1), { texte: 'Ville sur la jonction (1,1).', niveau: 'info' });
  d = M.cyclerJeton(d, 1, 1);
  assert.equal(A.messageJeton(d, 1, 1).texte, 'Carrefour sur la jonction (1,1).');
  d = M.cyclerJeton(M.cyclerJeton(d, 3, 1), 3, 1); // second carrefour au nord
  var m = A.messageJeton(d, 3, 1);
  assert.equal(m.niveau, 'alerte');
  assert.match(m.texte, /même côté/);
  d = M.cyclerJeton(d, 1, 1);
  assert.equal(A.messageJeton(d, 1, 1).texte, 'Jeton retiré de la jonction (1,1).');
  assert.equal(A.compterJetons(d), 1);
});

test('alertesPlateau : raccords « vide » et « mort » signalés, « absent » ignoré, ports morts', function () {
  var d = docExemples();
  d = M.poserTuile(d, idRole(d, 'centrale'), 1, 1);
  // Centrale seule : tous ses raccords font face à des cellules vides mais actives → aucune alerte
  assert.equal(A.alertesPlateau(d).length, 0);
  assert.ok(M.raccordsMorts(d).length > 0);
  var plein = remplir(docExemples());
  var attendus = M.raccordsMorts(plein).filter(function (r) { return r.raison !== 'absent'; }).length;
  var al = A.alertesPlateau(plein).filter(function (a) { return a.type === 'raccord'; });
  assert.equal(al.length, attendus);
  al.forEach(function (a) {
    // le point d'alerte est sur la frontière de la cellule
    var surBord = Math.abs(a.x - a.col * 120) < 1e-9 || Math.abs(a.x - (a.col + 1) * 120) < 1e-9 ||
      Math.abs(a.y - a.lig * 120) < 1e-9 || Math.abs(a.y - (a.lig + 1) * 120) < 1e-9;
    assert.ok(surBord);
  });
  // Forme réduite : ports de coin morts
  var reduit = remplir(M.changerForme(docExemples(), { retires: [{ col: 0, lig: 0 }] }));
  var ports = A.alertesPlateau(reduit).filter(function (a) { return a.type === 'port'; });
  assert.equal(ports.length, M.portsCoinMorts(reduit).length);
  assert.ok(ports.length > 0);
  ports.forEach(function (p) { assert.equal(p.x, p.col * 120 + PM.geometrie.pointCoin(p.coin).x); });
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
  var p2 = A.cibleSurbrillance({ type: 'coin', col: 1, lig: 1, coin: 2 }, d)[0];
  assert.deepEqual([p2.x, p2.y], [240, 240]);
  assert.equal(A.cibleSurbrillance({ type: 'case', modeleId: idRole(d, 'coin'), id: 'c1' }, d).length, 4);
  assert.deepEqual(A.cibleSurbrillance(null, d), []);
  assert.deepEqual(A.cibleSurbrillance({ type: 'inconnu' }, d), []);
});

test('svgPlateau : 16 cellules, 9 jonctions, jetons, silhouettes et classes de glissement', function () {
  var d = docExemples();
  var s = A.svgPlateau(d, {});
  assert.equal((s.match(/data-cellule="/g) || []).length, 16);
  assert.equal((s.match(/data-jonction="/g) || []).length, 9);
  assert.match(s, />Apparition J1</);
  assert.match(s, />Apparition J2</);
  assert.match(s, /Camp J1 \(nord\)/);
  assert.match(s, /48 × 48 cm/);
  var compat = {};
  A.cellulesCompatibles(d, idRole(d, 'coin')).forEach(function (c) { compat[c.col + ',' + c.lig] = true; });
  var s2 = A.svgPlateau(d, { compatibles: compat });
  assert.equal((s2.match(/pm-assemblage-compatible/g) || []).length, 4);
  assert.equal((s2.match(/pm-assemblage-estompee/g) || []).length, 12);
  var plein = remplir(docExemples());
  plein = M.cyclerJeton(plein, 2, 2);
  var s3 = A.svgPlateau(plein, { selection: { col: 1, lig: 1 }, surbrillance: { type: 'tuile', col: 0, lig: 0 } });
  assert.equal((s3.match(/pm-assemblage-occupee/g) || []).length, 16);
  assert.equal((s3.match(/class="pm-assemblage-nord"/g) || []).length, 16);
  assert.match(s3, /pm-assemblage-jeton/);
  assert.match(s3, /pm-assemblage-selection/);
  assert.match(s3, /pm-assemblage-surbrillance/);
  // Forme réduite : cellule retirée et jonction impossible
  var r = M.changerForme(docExemples(), { retires: [{ col: 0, lig: 0 }] });
  var s4 = A.svgPlateau(r, {});
  assert.match(s4, /pm-assemblage-retiree/);
  assert.match(s4, /pm-assemblage-impossible/);
});

test('bibliothèque : groupes par rôle, filtre, stock et état incomplet', function () {
  var d = docExemples();
  var g = B.vignettesBibliotheque(d, 'tous');
  assert.deepEqual(g.map(function (x) { return x.role; }), ['centrale', 'coin', 'bord', 'apparition']);
  assert.equal(B.vignettesBibliotheque(d, 'coin').length, 1);
  assert.equal(B.vignettesBibliotheque(d, 'coin')[0].modeles[0].restants, 4);
  d = M.poserTuile(d, idRole(d, 'coin'), 0, 0);
  var v = B.vignettesBibliotheque(d, 'coin')[0].modeles[0];
  assert.equal(v.restants, 3);
  assert.equal(v.posees, 1);
  assert.equal(v.posable, true);
  d.modeles[0].cases = [];
  var vc = B.vignettesBibliotheque(d, 'centrale')[0].modeles[0];
  assert.equal(vc.complet, false);
  assert.equal(vc.posable, false);
  assert.equal(B.libelleRestants(0), '×0 restant');
  assert.equal(B.libelleRestants(1), '×1 restant');
  assert.equal(B.libelleRestants(3), '×3 restants');
  d.modeles.push({ id: 'bizarre', role: 'autre-chose', exemplaires: 1, cases: [], chemins: [] });
  var gs = B.vignettesBibliotheque(d, 'tous');
  assert.equal(gs[gs.length - 1].titre, 'Autres');
});
