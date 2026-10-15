'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/modele.js');
require('../src/etat.js');
const M = globalThis.PM.modele;
const E = globalThis.PM.etat;

function docAvecExemples() {
  let d = M.nouveauDocument();
  for (const m of M.copieExemples()) d = M.ajouterModele(d, m);
  return d;
}

test('appliquer, annuler, rétablir', () => {
  const e = E.creer(docAvecExemples());
  const r = e.appliquer((d) => M.poserTuile(d, 'ex-centrale', 1, 1), 'poser');
  assert.deepEqual(r, { ok: true });
  assert.equal(e.doc().plateau.tuiles.length, 1);
  assert.ok(e.peutAnnuler());
  e.annuler();
  assert.equal(e.doc().plateau.tuiles.length, 0);
  assert.ok(e.peutRetablir());
  e.retablir();
  assert.equal(e.doc().plateau.tuiles.length, 1);
});

test('appliquer : une Error laisse le document intact et signale la raison', () => {
  const e = E.creer(docAvecExemples());
  const avant = e.doc();
  const r = e.appliquer((d) => M.poserTuile(d, 'ex-coin', 1, 1));
  assert.equal(r.ok, false);
  assert.ok(r.raison.length > 0);
  assert.equal(e.doc(), avant);
  assert.equal(e.ui().message.niveau, 'erreur');
  assert.equal(e.peutAnnuler(), false);
});

test('historique limité et vidé par une nouvelle action après annulation', () => {
  const e = E.creer(docAvecExemples());
  for (let n = 0; n < E.MAX_HISTORIQUE + 10; n++) e.appliquer((d) => M.changerExemplaires(d, 'ex-centrale', 4 + (n % 2)));
  let k = 0; while (e.annuler()) k++;
  assert.equal(k, E.MAX_HISTORIQUE);
  e.retablir();
  e.appliquer((d) => M.poserTuile(d, 'ex-centrale', 1, 1));
  assert.equal(e.peutRetablir(), false);
});

test('remplacer vide l\'historique ; majUi et abonnés', () => {
  const e = E.creer(docAvecExemples());
  const vus = [];
  const stop = e.abonner((evt) => vus.push(evt.raison));
  e.appliquer((d) => M.poserTuile(d, 'ex-centrale', 1, 1));
  e.majUi({ onglet: 'tuiles', modeleSelectionne: 'ex-coin' });
  assert.equal(e.ui().onglet, 'tuiles');
  e.remplacer(M.nouveauDocument());
  assert.equal(e.peutAnnuler(), false);
  assert.equal(e.ui().modeleSelectionne, null);
  stop();
  e.majUi({ onglet: 'plateau' });
  assert.deepEqual(vus, ['doc', 'ui', 'doc']);
});
