'use strict';
/*
 * Tests de la centrale 5×5 « Étoile » LE1 (docs/18, « Nouvelle tuile demandée par l’utilisateur », croquis docs/croquis/etoile-5x5-utilisateur.png) :
 * un relais au centre, 4 raccords au milieu des côtés, 4 cases sur les diagonales reliées au relais, chacune avec le port de son coin.
 * 5 cases (exception nommée à « 2 cases par tuile », tests/catalogue-5x5.test.js), un exemplaire, pose à la main seulement :
 * le drapeau `horsTirage` la tient hors du générateur, y compris après enregistrement et réouverture.
 * Id « LE1 » (E comme Étoile) : LC13 sert de témoin négatif dans tests/catalogue-5x5.test.js, les ids LC1 à LC12 sont pris.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
['geometrie', 'modele', 'rendu', 'etat', 'sauvegarde', 'graphe', 'equilibre', 'generateur', 'export', 'controles', 'catalogue'].forEach((f) => require('../src/' + f + '.js'));
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, GR = PM.graphe, CAT = PM.catalogue, S = PM.sauvegarde;
const { problemesTrace, reglesPassages } = require('./aides-trace.js');

const copie = (o) => JSON.parse(JSON.stringify(o));
const doc5 = () => CAT.nouveauDocument('5x5');
const lE1 = () => CAT.modelesParGrille['5x5'].find((m) => m.id === 'LE1');
const plateauDe = (r) => JSON.stringify([r.doc.plateau.tuiles, r.doc.plateau.jetons]);

test('LE1 « Étoile » : relais (50, 50), 4 raccords au milieu des côtés, 4 cases de diagonale reliées au relais, un port par case et par coin, aucune alerte', () => {
  const m = lE1();
  assert.equal(m.nom, 'Étoile');
  assert.equal(m.gabarit, 'centrale');
  assert.equal(m.exemplaires, 1);
  assert.equal(m.horsTirage, true);
  assert.equal(m.poids, undefined, 'pas de poids : hors tirage');
  assert.deepEqual(m.cases.map((c) => [c.id, c.x, c.y]), [['r', 50, 50], ['c1', 30, 30], ['c2', 70, 30], ['c3', 70, 70], ['c4', 30, 70]]);
  assert.deepEqual(m.chemins.filter((c) => c.b.raccord).map((c) => [c.a['case'], c.b.raccord.cote, c.b.raccord.pos]), [['r', 0, 1], ['r', 1, 1], ['r', 2, 1], ['r', 3, 1]]);
  assert.deepEqual(m.chemins.filter((c) => c.b['case'] !== undefined).map((c) => [c.a['case'], c.b['case']]), [['r', 'c1'], ['r', 'c2'], ['r', 'c3'], ['r', 'c4']]);
  assert.deepEqual(m.chemins.filter((c) => c.b.coin !== undefined).map((c) => [c.a['case'], c.b.coin]), [['c1', 0], ['c2', 1], ['c3', 2], ['c4', 3]]);
  for (const g of ['5x5', '4x4']) { // aucune alerte dans les deux formats (1 port par case, aucun raccord sur une porteuse, porteuses non reliées entre elles)
    const mg = copie(m); if (g === '4x4') delete mg.grille; // le même modèle, jugé aux règles du 4×4
    const v = M.validerModele(mg, g);
    assert.deepEqual([v.complet, v.erreurs, v.alertes], [true, [], []], g);
  }
  assert.deepEqual(problemesTrace(m, '5x5'), []);
  assert.deepEqual(reglesPassages(m, '5x5'), []);
  assert.equal(M.masquesDuModele(m).portsCoin, 0b1111);
  assert.equal(M.masquesDuModele(m).raccords, 0x492);
});

test('LE1 : le générateur ne la tire jamais (25 graines 5×5, 30 graines 4×4) et les plateaux sont identiques à ceux d’une bibliothèque sans LE1', () => {
  for (let k = 0; k < 25; k++) {
    const avec = GEN.generer(doc5(), { graine: 'etoile-' + k, candidats: 4 });
    const d = doc5(); d.modeles = d.modeles.filter((m) => m.id !== 'LE1');
    const sans = GEN.generer(d, { graine: 'etoile-' + k, candidats: 4 });
    assert.ok(avec.ok && sans.ok, 'graine ' + k);
    assert.ok(!avec.doc.plateau.tuiles.some((t) => t.modeleId === 'LE1'), 'graine ' + k);
    assert.equal(plateauDe(avec), plateauDe(sans), 'même plateau avec ou sans LE1, graine ' + k);
  }
  for (let k = 0; k < 30; k++) {
    const r = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'etoile4-' + k, candidats: 3 });
    assert.ok(r.ok, r.raison);
    assert.ok(!r.doc.plateau.tuiles.some((t) => t.modeleId === 'LE1'));
  }
  // LE1 seule centrale de la bibliothèque : rien à tirer pour les 9 places centrales, refus expliqué (jamais un plateau avec LE1)
  const seule = doc5(); seule.modeles = seule.modeles.filter((m) => m.gabarit !== 'centrale' || m.id === 'LE1');
  const r = GEN.generer(seule, { graine: 'seule' });
  assert.equal(r.ok, false);
  assert.ok(typeof r.raison === 'string' && r.raison.length > 10);
});

test('LE1 : le drapeau horsTirage survit à l’enregistrement ; seule la valeur booléenne true compte ; la pose à la main reste possible', () => {
  const d = doc5();
  const r = S.depuisJSON(S.versJSON(d));
  assert.equal(r.ok, true);
  assert.equal(M.modeleParId(r.doc, 'LE1').horsTirage, true);
  assert.equal(M.modeleParId(r.doc, 'LC1').horsTirage, undefined, 'les autres modèles n’ont pas le champ');
  assert.deepEqual(r.doc, d, 'aller-retour sans perte');
  for (const faux of ['true', 1, null, {}]) {
    const brut = JSON.parse(S.versJSON(d)); brut.modeles.find((m) => m.id === 'LE1').horsTirage = faux;
    assert.equal(M.modeleParId(S.depuisJSON(JSON.stringify(brut)).doc, 'LE1').horsTirage, undefined, String(faux));
  }
  // un document réouvert ne tire toujours pas LE1
  const g = GEN.generer(r.doc, { graine: 'rouvert', candidats: 3 });
  assert.ok(g.ok && !g.doc.plateau.tuiles.some((t) => t.modeleId === 'LE1'));
  // pose à la main au centre : plateau valide, aucune erreur
  const p = copie(g.doc), t = p.plateau.tuiles.find((x) => x.col === 2 && x.lig === 2);
  t.modeleId = 'LE1'; t.rot = 0;
  assert.deepEqual(M.validerPlateau(p).erreurs, []);
});

test('LE1 posée au centre (plateaux générés, 8 villes fixes) : écart de 3 cases tenu, au moins 3 ports à chaque ville, aucune alerte de plateau', () => {
  for (let k = 0; k < 20; k++) {
    const r = GEN.generer(doc5(), { graine: 'g5-' + k, candidats: 4 });
    assert.ok(r.ok, r.raison);
    const d = copie(r.doc), t = d.plateau.tuiles.find((x) => x.col === 2 && x.lig === 2);
    t.modeleId = 'LE1'; t.rot = 0; // symétrique : toutes les rotations sont équivalentes
    const v = M.validerPlateau(d);
    assert.deepEqual([v.erreurs, v.alertes.map((a) => a.code)], [[], []], 'graine ' + k);
    assert.deepEqual(GR.villesProches(GR.construire(d, { villesTraversables: false })), [], 'écart entre villes, graine ' + k);
    const ports = GEN.portsParJonction(d);
    assert.equal(d.plateau.jetons.length, 8);
    d.plateau.jetons.forEach((j) => assert.ok(ports[(j.j - 1) * 4 + (j.i - 1)] >= 3, `graine ${k} : ville (${j.i}, ${j.j}) à ${ports[(j.j - 1) * 4 + (j.i - 1)]} ports`));
  }
});

test('LE1 : stock et impression : un exemplaire, 31 tuiles au total, 6 planches A3 (5 pleines + 1) et 16 planches A4 ; aucune autre tuile à plus de 2 cases', () => {
  const d = doc5(), E = PM.exportation;
  const liste = E.listeTuiles(d, { portee: 'stock' });
  assert.equal(liste.tuiles.length, 31);
  assert.equal(liste.tuiles.filter((t) => t.modeleId === 'LE1').length, 1);
  assert.equal(E.calepiner(d, { format: 'A3', portee: 'stock' }).length, 6);
  assert.equal(E.calepiner(d, { format: 'A4', portee: 'stock' }).length, 16);
  assert.deepEqual(d.modeles.filter((m) => m.cases.length > 2).map((m) => m.id), ['LE1']);
});
