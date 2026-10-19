'use strict';
/*
 * 8 villes du 5×5 (docs/18, consigne du 2026-10-19 et réponses suivantes) : alerte BLOQUANTE (erreur) au-delà de 8 villes en 5×5 (le 4×4
 * garde une alerte au-delà de 7), anciens plateaux 5×5 à 7 villes reconnus (proposition de régénérer, app.js), campements.
 */
const test = require('node:test');
const assert = require('node:assert');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
require('../src/sauvegarde.js');
require('../src/etat.js');
require('../src/app.js');
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, CAT = PM.catalogue, C = PM.controles, S = PM.sauvegarde;

const copie = (o) => JSON.parse(JSON.stringify(o));
const plateau5 = () => GEN.generer(CAT.nouveauDocument('5x5'), { graine: 'fixes', candidats: 4 }).doc;

test('5×5 : plus de 8 villes est une erreur (alerte bloquante) ; 8 villes, aucune ; le 4×4 garde une alerte au-delà de 7', () => {
  const d = plateau5();
  assert.strictEqual(d.plateau.jetons.length, 8);
  assert.ok(!C.calculer(d).erreurs.some((e) => e.code === 'trop_de_villes'));
  const neuf = copie(d);
  const libre = [];
  for (let j = 1; j <= 4; j++) for (let i = 1; i <= 4; i++) if (!neuf.plateau.jetons.some((x) => x.i === i && x.j === j)) libre.push({ i, j });
  neuf.plateau.jetons.push({ i: libre[0].i, j: libre[0].j, type: 'capture' });
  const r = C.calculer(neuf);
  const e = r.erreurs.find((x) => x.code === 'trop_de_villes');
  assert.ok(e, JSON.stringify(r.erreurs.map((x) => x.code)));
  assert.strictEqual(e.niveau, 'erreur');
  assert.match(e.message, /Il y a 9 villes, la composition en prévoit 8\. En 5×5, 8 villes au plus/);
  assert.ok(!r.alertes.some((x) => x.code === 'trop_de_villes'));
  assert.ok(r.regroupees.some((g) => g.code === 'trop_de_villes' && g.niveau === 'erreur'));
  // 4×4 : 8 villes = alerte, pas une erreur
  const d4 = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'fixes4', candidats: 4 }).doc;
  const l4 = [];
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) if (!d4.plateau.jetons.some((x) => x.i === i && x.j === j)) l4.push({ i, j });
  d4.plateau.jetons.push({ i: l4[0].i, j: l4[0].j, type: 'capture' });
  const r4 = C.calculer(d4);
  assert.ok(r4.alertes.some((x) => x.code === 'trop_de_villes'));
  assert.ok(!r4.erreurs.some((x) => x.code === 'trop_de_villes'));
});

test('anciens plateaux 5×5 à 7 villes : reconnus (proposition de régénérer) ; un plateau à 8 villes, un 4×4 ou un plateau incomplet, non', () => {
  const d = plateau5();
  assert.strictEqual(S.ancienPlateau5x5(d), false);
  const sept = copie(d); sept.plateau.jetons.pop();
  assert.strictEqual(S.ancienPlateau5x5(sept), true);
  assert.strictEqual(PM.nouveau.aAncienPlateau5x5(sept), true);
  const troue = copie(sept); troue.plateau.tuiles.pop();
  assert.strictEqual(S.ancienPlateau5x5(troue), false);
  const d4 = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'fixes4', candidats: 4 }).doc;
  assert.strictEqual(S.ancienPlateau5x5(d4), false);
  assert.strictEqual(S.ancienPlateau5x5(null), false);
  // refus : document inchangé, la lacune « il manque 1 ville » reste signalée
  const e = PM.graphe.equilibre(sept);
  assert.ok(e.lacunes.some((t) => t.includes('Il manque 1 ville')), e.lacunes.join(' / '));
  // acceptation : le générateur donne un plateau à 8 villes ; appliqué en une étape (Ctrl+Z rend l'ancien plateau)
  const etat = PM.etat.creer(sept), avant = JSON.stringify(etat.doc());
  const r = GEN.generer(etat.doc(), { graine: 'regen' });
  assert.ok(r.ok, r.raison);
  etat.appliquer(() => r.doc, 'plateau régénéré à 8 villes');
  assert.strictEqual(etat.doc().plateau.jetons.length, 8);
  etat.annuler();
  assert.strictEqual(JSON.stringify(etat.doc()), avant);
});

test('ancien catalogue B3 (LC2, sans LC11 ni LC12) : le générateur abandonne vite et conseille les centrales « ponts »', () => {
  const d = CAT.nouveauDocument('5x5');
  d.modeles = d.modeles.filter((m) => m.id !== 'LC11' && m.id !== 'LC12');
  const t0 = Date.now(), r = GEN.generer(d, { graine: 'b3' });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /Coins opposés/);
  assert.ok(Date.now() - t0 < 5000);
});
