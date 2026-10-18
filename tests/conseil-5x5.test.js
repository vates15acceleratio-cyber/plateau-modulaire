'use strict';
/*
 * Tests de docs/36 : conseil conditionnel du 5×5 (joint à « 5 contre 2 » et à l’alerte S >= 7), information « ville sur une
 * jonction à moins de 3 ports », constante S unique, 4×4 inchangé.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/equilibre.js');
const PM = globalThis.PM;
const GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue;

const CONSEIL = 'Les 3 villes du milieu sont sur une seule rangée : en mettre 2 sur l’une et 1 sur l’autre rétablit presque toujours l’équilibre.';
const jetons = (vs) => vs.map((v) => ({ i: v.i, j: v.j, type: 'capture' }));

/** Générateur pseudo-aléatoire déterministe. */
function rng(graine) { let s = graine >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tirer(r, liste, n) {
  const l = liste.slice(), res = [];
  for (let k = 0; k < n; k++) res.push(l.splice(Math.floor(r() * l.length), 1)[0]);
  return res;
}
const JONCTIONS = []; for (let j = 1; j <= 4; j++) for (let i = 1; i <= 4; i++) JONCTIONS.push({ i, j });
const rangee = (j) => JONCTIONS.filter((v) => v.j === j);

/** Villes tirées : squelette 2-3-2 (3 du milieu sur une rangée, ou 2 + 1) ou 7 jonctions quelconques. */
function placement(r, genre) {
  if (genre === 'libre') return tirer(r, JONCTIONS, 7);
  const milieu = genre === 'une-rangee'
    ? tirer(r, rangee(2 + Math.floor(r() * 2)), 3)
    : tirer(r, rangee(2), 2).concat(tirer(r, rangee(3), 1));
  return tirer(r, rangee(1), 2).concat(milieu, tirer(r, rangee(4), 2));
}

/** Attendu, calculé indépendamment : 2 en j = 1, 2 en j = 4, et les 3 autres toutes en j = 2 ou toutes en j = 3. */
function squeletteUneRangee(vs) {
  const n = (j) => vs.filter((v) => v.j === j).length;
  return n(1) === 2 && n(4) === 2 && (n(2) === 3 || n(3) === 3);
}

// graine choisie pour que les trois genres de placement portent des alertes (le plateau de la graine « conseil » est si équilibré
// que le squelette 2 + 1 n'y donne jamais d'alerte, ce qui rendrait le test vide)
const doc5 = GEN.generer(CAT.nouveauDocument('5x5'), { graine: 'conseil-2', candidats: 6 }).doc;

test('seuils de S : rejet du générateur 5 (constante unique), alerte et information propres à chaque format, lus par l’interface', () => {
  assert.strictEqual(GR.SEUIL_S, 5);
  assert.strictEqual(PM.equilibre.EXPLICATION.includes('à partir de 5'), true);
  assert.strictEqual(PM.equilibre.explication('4x4'), PM.equilibre.EXPLICATION);
  assert.ok(PM.equilibre.explication('5x5').includes('à partir de 7 ; S = 5 ou 6 est une simple information'));
  assert.ok(PM.equilibre.EXPLICATION.includes('S = 4 est une simple information'));
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'generateur.js'), 'utf8');
  assert.ok(/GR\.SEUIL_S\b/.test(src));
  assert.ok(!/provisoire/.test(src), 'le rejet S >= 5 n’est plus provisoire');
});

test('conseil 5×5 : présent si et seulement si squelette 2-3-2 et 3 villes du milieu sur une seule rangée', () => {
  const r = rng(36), vus = { avec: 0, deuxPlusUn: 0, horsSquelette: 0 };
  for (let k = 0; k < 1500; k++) {
    const genre = ['une-rangee', 'deux-un', 'libre'][k % 3], vs = placement(r, genre);
    const e = GR.equilibre(doc5, { jetons: jetons(vs) });
    const msgs = e.blocages.concat(e.alertes).filter((a) => a.code === 'cinq_contre_deux' || a.code === 'score_s');
    const attendu = squeletteUneRangee(vs);
    // « 5 contre 2 » et S >= 5 ensemble : le conseil n’est écrit qu’une fois (au message « 5 contre 2 »)
    const aCinq = msgs.some((a) => a.code === 'cinq_contre_deux');
    msgs.forEach((a) => {
      assert.strictEqual(a.message.includes(CONSEIL), attendu && (a.code === 'cinq_contre_deux' || !aCinq), genre + ' ' + a.code + ' : ' + a.message);
      if (attendu) vus.avec++; else if (genre === 'deux-un') vus.deuxPlusUn++; else if (genre === 'libre') vus.horsSquelette++;
    });
    assert.ok(msgs.filter((a) => a.message.includes(CONSEIL)).length <= 1, 'conseil en double : ' + genre);
    if (!msgs.length) assert.ok(!JSON.stringify(e).includes('seule rangée'), 'sans alerte, pas de conseil');
  }
  assert.ok(vus.avec > 0 && vus.deuxPlusUn > 0 && vus.horsSquelette > 0, JSON.stringify(vus));
});

test('conseil 5×5 : le même message ne contient jamais le conseil du 4×4, et le 4×4 garde le sien', () => {
  const r = rng(7);
  for (let k = 0; k < 300; k++) {
    const e = GR.equilibre(doc5, { jetons: jetons(placement(r, 'libre')) });
    e.blocages.concat(e.alertes).forEach((a) => assert.ok(!a.message.includes('rangée centrale')));
  }
  const r4 = rng(9);
  const j4 = []; for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) j4.push({ i, j });
  let trouve = false;
  for (let g = 0; g < 200 && !trouve; g++) { // catalogue de docs/46 : « 5 contre 2 » rare (1 % des placements admissibles), recherche plus longue
    const doc4 = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'q' + g, candidats: 6 }).doc;
    for (let k = 0; k < 100; k++) {
      const e = GR.equilibre(doc4, { jetons: jetons(tirer(r4, j4, 7)) });
      e.blocages.forEach((b) => { if (b.code === 'cinq_contre_deux') { trouve = true; assert.ok(b.message.includes('rangée centrale') && !b.message.includes('seule rangée')); } });
      assert.deepStrictEqual(e.informations, [], 'pas d’information « ports » en 4×4');
    }
  }
  assert.ok(trouve, 'un « 5 contre 2 » 4×4 a été rencontré');
});

test('information « ville sur une jonction à moins de 3 ports » : 5×5 seulement, jamais une alerte', () => {
  const g = GR.construire(doc5), peu = g.jonctions.filter((j) => j.ports < 3), beaucoup = g.jonctions.filter((j) => j.ports >= 3);
  assert.ok(peu.length > 0 && beaucoup.length >= 7);
  const bases = beaucoup.slice(0, 7);
  const sans = GR.equilibre(doc5, { jetons: jetons(bases) });
  assert.deepStrictEqual(sans.informations, []);
  const avec = GR.equilibre(doc5, { jetons: jetons(bases.slice(0, 6).concat([peu[0]])) });
  assert.strictEqual(avec.informations.length, 1);
  assert.strictEqual(avec.informations[0].code, 'ville_peu_de_ports');
  assert.ok(avec.informations[0].message.includes('(' + peu[0].i + ', ' + peu[0].j + ')'));
  assert.ok(avec.alertes.every((a) => a.code !== 'ville_peu_de_ports') && avec.blocages.every((a) => a.code !== 'ville_peu_de_ports'));
  // rapport d’équilibre : section d’information
  const docV = JSON.parse(JSON.stringify(doc5));
  docV.plateau.jetons = jetons(bases.slice(0, 6).concat([peu[0]]));
  const m = PM.equilibre.rapport(PM.equilibre.analyser(docV));
  assert.strictEqual(m.informations.length, 1);
  assert.ok(m.alertes.every((t) => !t.includes('port(s)')));
});
