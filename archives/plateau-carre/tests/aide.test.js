// Tests du bloc « Commandes » : structure de COMMANDES, filtrage par onglet, et vérification de chaque ligne dans le code source.
// Lancer : node --test tests/aide.test.js
'use strict';
var test = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');

require('../src/aide.js');
var A = globalThis.PM.aide;
var RACINE = path.join(__dirname, '..');

test('COMMANDES : champs obligatoires, onglets et groupes valides, textes non vides', function () {
  assert.ok(A.COMMANDES.length >= 30);
  A.COMMANDES.forEach(function (c, k) {
    var nom = 'ligne ' + k + ' (' + c.geste + ')';
    assert.ok(Array.isArray(c.onglets) && c.onglets.length > 0, nom);
    c.onglets.forEach(function (o) { assert.ok(A.ONGLETS.indexOf(o) >= 0, nom + ' : onglet ' + o); });
    assert.ok(c.groupe === 'souris' || c.groupe === 'clavier', nom);
    assert.ok(Array.isArray(c.picto) && c.picto.length > 0, nom + ' : picto');
    assert.ok(c.court.split(' ').length <= 6, nom + ' : phrase courte (6 mots au plus) : ' + c.court);
    ['geste', 'effet', 'court', 'source', 'preuve'].forEach(function (champ) {
      assert.equal(typeof c[champ], 'string', nom + ' : ' + champ);
      assert.ok(c[champ].trim().length > 0, nom + ' : ' + champ + ' vide');
    });
  });
});

test('chaque ligne a sa preuve dans le fichier source (le geste ou la touche existe vraiment dans le code)', function () {
  var cache = {};
  A.COMMANDES.forEach(function (c) {
    if (!(c.source in cache)) cache[c.source] = fs.readFileSync(path.join(RACINE, c.source), 'utf8');
    assert.ok(cache[c.source].indexOf(c.preuve) >= 0, 'introuvable dans ' + c.source + ' : ' + c.preuve + ' (ligne « ' + c.geste + ' »)');
  });
});

test('pas de doublon (même onglet, même groupe, même geste)', function () {
  var vus = {};
  A.COMMANDES.forEach(function (c) {
    c.onglets.forEach(function (o) {
      var cle = o + '|' + c.groupe + '|' + c.geste;
      assert.ok(!vus[cle], 'doublon : ' + cle);
      vus[cle] = true;
    });
  });
});

test('lignesAide : le contenu dépend de l’onglet, souris et clavier réunis dans le même résultat', function () {
  var p = A.lignesAide('plateau'), t = A.lignesAide('tuiles');
  assert.ok(p.souris.length > 0 && p.clavier.length > 0);
  assert.ok(t.souris.length > 0 && t.clavier.length > 0);
  var gestes = function (l) { return l.souris.concat(l.clavier).map(function (c) { return c.geste; }); };
  assert.ok(gestes(p).indexOf('Clic sur un campement ou une ville') >= 0 && gestes(t).indexOf('Clic sur un campement ou une ville') < 0);
  assert.ok(gestes(t).indexOf('Clic droit sur une case') >= 0 && gestes(p).indexOf('Clic droit sur une case') < 0);
  assert.ok(gestes(t).indexOf('Flèches') >= 0 && gestes(p).indexOf('Flèches') < 0, 'pas de flèches sur le plateau');
  assert.ok(gestes(p).indexOf('R') >= 0 && gestes(t).indexOf('R') < 0);
  // les raccourcis globaux et la bibliothèque sont communs aux deux onglets
  ['Ctrl+Z', 'Ctrl+Y ou Ctrl+Maj+Z', 'Ctrl+S'].forEach(function (g) {
    assert.ok(gestes(p).indexOf(g) >= 0 && gestes(t).indexOf(g) >= 0, g);
  });
  assert.ok(gestes(p).indexOf('✕ sur une tuile utilisateur') >= 0 && gestes(t).indexOf('✕ sur une tuile utilisateur') >= 0);
  assert.deepEqual(A.lignesAide('autre'), { souris: [], clavier: [] });
});

test('la légende cite les commandes demandées (souris : pose, glisser, double-clic, clic droit, campement, alerte, ✕ ; clavier : annuler, rétablir, enregistrer, R, Suppr, Échap, E, A, flèches, Ctrl+D)', function () {
  var tout = A.COMMANDES.map(function (c) { return c.geste; }).join(' | ');
  ['Clic sur une tuile de la bibliothèque', 'Glisser une tuile de la bibliothèque', 'Double-clic', 'Clic droit sur une tuile posée',
    'Clic sur un campement ou une ville', 'Clic sur une alerte', '✕', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+S', 'R', 'Suppr', 'Échap', 'E sur', 'A', 'Flèches', 'Ctrl+D']
    .forEach(function (g) { assert.ok(tout.indexOf(g) >= 0, g); });
});

test('pictogrammes : chaque élément est connu (souris, ×2, flèche, séparateur ou nom de touche)', function () {
  var speciaux = ['sg', 'sd', 'x2', '->', '+'];
  A.COMMANDES.forEach(function (c) {
    c.picto.forEach(function (p) { assert.ok(typeof p === 'string' && p.length > 0 && (speciaux.indexOf(p) >= 0 || p.length <= 6), c.geste + ' : ' + p); });
    if (c.picto.indexOf('x2') >= 0) assert.ok(c.picto[0] === 'sg', c.geste + ' : ×2 suit une souris');
  });
});

test('index.html : conteneur, feuille et script du bloc, dans le bon ordre', function () {
  var html = fs.readFileSync(path.join(RACINE, 'index.html'), 'utf8');
  assert.ok(/id="aide"/.test(html));
  assert.ok(html.indexOf('styles/aide.css') > 0);
  assert.ok(html.indexOf('src/aide.js') > html.indexOf('src/editeur-tuile.js') && html.indexOf('src/aide.js') < html.indexOf('src/app.js'));
  assert.ok(html.indexOf('id="aide"') > html.indexOf('id="ecran-tuiles"'), 'la carte est après les écrans, hors de la colonne de gauche');
  assert.ok(!/\sstyle=|\sonclick=/i.test(html), 'CSP : aucun attribut style ou gestionnaire en ligne');
  var app = fs.readFileSync(path.join(RACINE, 'src/app.js'), 'utf8');
  assert.ok(app.indexOf("monterModule('aide', 'aide', etat)") > 0);
});
