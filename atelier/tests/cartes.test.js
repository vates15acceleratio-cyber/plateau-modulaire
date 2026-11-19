'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
require('../src/cartes.js');
const C = globalThis.AT.cartes;

test('module exposé sous AT.cartes et par module.exports', () => {
  assert.equal(require('../src/cartes.js'), C);
  assert.equal(typeof C.campements, 'function');
});

test('REGLAGES : tous les réglages attendus, modifiables', () => {
  const r = C.REGLAGES;
  assert.equal(r.tailleMain, 5);
  assert.equal(r.gloireVictoire, 15);
  assert.equal(r.bataillonsParJoueur, 4);
  assert.equal(r.troupesParBataillon, 3);
  assert.equal(r.actionsParTour, 2);
  assert.equal(r.tailleDeck, 20);
  assert.equal(r.mainDeDepart, 2);
  assert.equal(r.piocheDebutTour, 1);
  assert.ok(!Object.isFrozen(r));
});

test('15 cartes Campement : texte et signe identiques à l’annexe 2 des règles V2.3', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'regles', 'Bannerlord_Regles_V2.3.html'), 'utf8');
  const annexe = html.slice(html.indexOf('ANNEXE 2'));
  const motif = /<tr><td class="t">(\d+)<\/td><td class="t">(.)<\/td><td>(.*?)<\/td><\/tr>/g;
  const lignes = [];
  let m;
  while ((m = motif.exec(annexe)) !== null) lignes.push({ numero: Number(m[1]), signe: m[2], texte: m[3] });
  assert.equal(lignes.length, 15, 'les 15 lignes du tableau des règles doivent être retrouvées');
  const cartes = C.campements();
  assert.equal(cartes.length, 15);
  lignes.forEach((l, i) => {
    assert.equal(cartes[i].numero, l.numero);
    assert.equal(cartes[i].id, 'C' + l.numero);
    assert.equal(cartes[i].signe, l.signe, 'signe de la carte ' + l.numero);
    assert.equal(cartes[i].texte, l.texte, 'texte de la carte ' + l.numero);
  });
});

test('Campement : signes + (6), = (5), − (4, signe moins typographique)', () => {
  const signes = C.campements().map((c) => c.signe);
  assert.equal(signes.filter((s) => s === '+').length, 6);
  assert.equal(signes.filter((s) => s === '=').length, 5);
  assert.equal(signes.filter((s) => s === '−').length, 4);
});

test('8 cartes Événement E1 à E8, provisoires, une par tuile de la réserve', () => {
  const ev = C.evenements();
  assert.deepEqual(ev.map((e) => e.id), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']);
  assert.deepEqual(ev.map((e) => e.nom), ['Torrent de boue', 'Crevasse', 'Tunnel', 'Incendie', 'Inondation',
    'Éboulement', 'Chaussée', 'Campement abandonné']);
  ev.forEach((e) => {
    assert.equal(e.provisoire, true);
    assert.ok(e.texte.includes(e.nom) && e.texte.includes(e.pose) && e.texte.includes(e.effet));
    assert.ok(e.texte.length < 200, 'texte court');
  });
});

test('Troupes provisoires : une douzaine, étiquetées, valeurs entières et variées', () => {
  const tr = C.troupes();
  assert.equal(tr.length, 12);
  assert.equal(new Set(tr.map((t) => t.id)).size, 12);
  assert.equal(new Set(tr.map((t) => t.nom)).size, 12);
  tr.forEach((t) => {
    assert.equal(t.provisoire, true);
    assert.match(t.id, /^T\d{1,3}$/);
    for (const k of ['moral', 'puissance', 'des']) assert.ok(Number.isInteger(t[k]) && t[k] >= 1, t.id + ' ' + k);
  });
  assert.ok(new Set(tr.map((t) => t.moral)).size >= 3);
  assert.ok(new Set(tr.map((t) => t.des)).size >= 3);
});

test('les fonctions renvoient des copies : les données ne sont pas modifiables de l’extérieur', () => {
  C.campements()[0].texte = 'modifié';
  C.troupes()[0].moral = 99;
  C.evenements()[0].nom = 'x';
  assert.equal(C.campements()[0].texte, 'Piochez 1 carte.');
  assert.equal(C.troupes()[0].moral, 1);
  assert.equal(C.evenements()[0].nom, 'Torrent de boue');
});

test('trouver : par identifiant, null si inconnu', () => {
  assert.equal(C.trouver('C15').numero, 15);
  assert.equal(C.trouver('E8').nom, 'Campement abandonné');
  assert.equal(C.trouver('T12').nom, 'Gardes');
  assert.equal(C.trouver('Z9'), null);
  assert.equal(C.trouver('__proto__'), null);
});

test('paquets de départ Campement et Événement', () => {
  assert.equal(C.paquetCampement().length, 15);
  assert.equal(new Set(C.paquetCampement()).size, 15);
  assert.deepEqual(C.paquetEvenements(), ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8']);
});

test('deckDeDepart : taille des REGLAGES, exemplaires uniques, modèles connus', () => {
  const deck = C.deckDeDepart('vert');
  assert.equal(deck.length, C.REGLAGES.tailleDeck);
  assert.equal(new Set(deck.map((c) => c.id)).size, deck.length);
  const ids = C.troupes().map((t) => t.id);
  deck.forEach((c) => {
    assert.equal(c.joueur, 'vert');
    assert.match(c.id, /^vert-\d+$/);
    assert.ok(ids.includes(c.modele));
  });
  const rouge = C.deckDeDepart('rouge', 7);
  assert.equal(rouge.length, 7);
  assert.equal(rouge[0].id, 'rouge-1');
  assert.deepEqual(C.deckDeDepart('vert').map((c) => c.modele), C.deckDeDepart('rouge').map((c) => c.modele));
  assert.throws(() => C.deckDeDepart('bleu'));
});

test('deckDeDepart suit REGLAGES.tailleDeck et accepte une autre liste de Troupes', () => {
  const avant = C.REGLAGES.tailleDeck;
  C.REGLAGES.tailleDeck = 6;
  try {
    assert.equal(C.deckDeDepart('vert').length, 6);
  } finally {
    C.REGLAGES.tailleDeck = avant;
  }
  const deck = C.deckDeDepart('vert', 3, [{ id: 'T50' }, { id: 'T51' }]);
  assert.deepEqual(deck.map((c) => c.modele), ['T50', 'T51', 'T50']);
});
