'use strict';
// Les fichiers faits avec le premier catalogue (version 1 du format) s'ouvrent toujours : plateau, partie, bibliothèque.
// Les fichiers de tests/fixtures-v1/ ont été écrits par l'atelier AVANT le passage au catalogue 2 ; ne pas les régénérer.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/plateau.js');
require('../src/alea.js');
require('../src/controles.js');
require('../src/bibliotheque.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, K = AT.controles, B = AT.bibliotheque, T = AT.partie;

const fichier = (nom) => fs.readFileSync(path.join(__dirname, 'fixtures-v1', nom), 'utf8');
const env = () => ({ alea: AT.alea.creer(7), hex: H, plateau: P });

test('plateau généré en version 1 : il s’ouvre, ses cases et ses villes sont celles d’origine', () => {
  const brut = JSON.parse(fichier('plateau-genere.json'));
  assert.strictEqual(brut.version, 1);
  assert.ok(!('deploiements' in brut));
  const lu = P.lire(fichier('plateau-genere.json'));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  const p = lu.plateau;
  assert.strictEqual(p.version, 2, 'le plateau relu est au format courant');
  assert.deepStrictEqual(p.pieces, brut.pieces);
  assert.deepStrictEqual(p.camps, brut.camps);
  assert.ok(!('deploiements' in p));
  // 64 pièces, 91 cases, 7 villes : comme à l'enregistrement.
  const cases = P.cases(p);
  assert.strictEqual(p.pieces.length, 64);
  assert.strictEqual(Object.keys(cases).length, 91);
  assert.deepStrictEqual(P.chevauchements(p), []);
  assert.strictEqual(P.villes(p).length, 7);
  const n = {};
  Object.keys(cases).forEach((k) => { n[cases[k].terrain] = (n[cases[k].terrain] || 0) + 1; });
  assert.deepStrictEqual(n, { ville: 7, plaine: 53, foret: 11, marais: 11, montagne: 9 });
  // Ses tuiles d'une case sont des pièces hors catalogue : connues, comptées « en plus », jamais « inconnues ».
  const stock = P.stock(p);
  assert.deepStrictEqual([stock.P, stock.V], [{ total: 0, poses: 39, restant: -39 }, { total: 0, poses: 6, restant: -6 }]);
  assert.strictEqual(p.pieces.every((x) => P.modele(p, x.modele) !== null), true);
  // Villes de déploiement : celles des rangées extrêmes, comme avant.
  assert.deepStrictEqual(P.campsAuto(p), brut.camps);
  // Enregistré de nouveau, il se relit à l'identique.
  const encore = P.lire(P.serialiser(p));
  assert.ok(encore.ok);
  assert.deepStrictEqual(encore.plateau, p);
  assert.strictEqual(JSON.parse(P.serialiser(p)).version, 2);
});

test('plateau retouché en version 1 : pièce personnelle, tuiles peintes, événements', () => {
  const lu = P.lire(fichier('plateau-retouche.json'));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  const p = lu.plateau, cases = P.cases(p);
  assert.strictEqual(p.modeles.length, 1);
  assert.strictEqual(p.modeles[0].nom, 'Bois long');
  assert.strictEqual(p.pieces.filter((x) => x.modele === 'X1').length, 1);
  assert.strictEqual(p.pieces.filter((x) => x.modele === 'M1').length, 1);
  assert.deepStrictEqual(p.recouvrements.map((x) => x.evenement), ['E4', 'E8']);
  assert.strictEqual(cases[p.recouvrements[0].cle].terrain, 'terre_brulee');
  assert.strictEqual(cases[p.recouvrements[1].cle].terrain, 'campement');
  // Les contrôles répondent sans exception ; le plateau reste retouchable.
  const bilan = K.tout(p);
  assert.ok(Array.isArray(bilan.resultats) && bilan.resultats.length > 0);
  assert.strictEqual(bilan.resultats.filter((x) => x.regle === 'villes' && x.niveau === 'erreur').length, 0);
  const plaine = Object.keys(cases).filter((k) => cases[k].modele === 'P')[0];
  const peint = P.peindre(p, plaine, 'foret');
  assert.ok(peint.ok, peint.raison);
  assert.ok(P.lire(P.serialiser(P.avecCamps(peint.plateau))).ok);
});

test('ancien plateau : on peut y poser les villes du catalogue 2, les camps suivent alors les tuiles posées', () => {
  const p = P.lire(fichier('plateau-genere.json')).plateau, cases = P.cases(p, { sansVilles: true });
  const e = P.etendueSurCases(cases);
  const k = Object.keys(cases).filter((x) => cases[x].terrain === 'plaine' && H.decle(x).r <= e.haut + 1 && H.voisines(x).some((v) => !cases[v]))[0];
  assert.ok(k);
  const r = P.poserVilleDeploiement(p, 'vert', k, { libre: true });
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(r.plateau.camps, { vert: [k], rouge: [] });
  assert.ok(P.lire(P.serialiser(r.plateau)).ok);
  const retour = P.retirerVilleDeploiement(r.plateau, k).plateau;
  assert.deepStrictEqual(retour.camps, p.camps, 'sans tuile posée, on revient aux villes des rangées extrêmes');
});

test('partie enregistrée en version 1 : elle se recharge et se poursuit', () => {
  const brut = JSON.parse(fichier('partie.json'));
  assert.strictEqual(brut.plateau.version, 1);
  const r = T.charger(fichier('partie.json'), env());
  assert.ok(r.ok, r.raison);
  let e = r.etat;
  assert.strictEqual(P.villes(e.plateau).length, 7);
  assert.deepStrictEqual(e.plateau.camps, brut.plateau.camps);
  assert.deepStrictEqual(e.bataillons, brut.bataillons);
  // Le bataillon formé avant l'enregistrement est toujours sur sa ville de déploiement ; on continue à jouer.
  const j = e.actif, pose = e.bataillons[j].filter((b) => b.case !== null)[0];
  assert.ok(pose && e.plateau.camps[j].includes(pose.case));
  const des = T.lancerDes(e, { n: 2 }, env());
  assert.ok(des.ok, des.raison);
  const voisine = H.voisines(pose.case).filter((k) => P.cout(e.plateau, k) !== Infinity)[0];
  const d = T.deplacer(des.etat, { joueur: j, numero: pose.numero, cle: voisine }, env());
  assert.ok(d.ok, d.raison);
  const encore = T.charger(T.serialiser(d.etat), env());
  assert.ok(encore.ok, encore.raison);
});

test('bibliothèque enregistrée en version 1 : ses deux plateaux se lisent et se rouvrent', () => {
  const r = B.lire(fichier('bibliotheque.json'));
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(r.liste.map((x) => x.nom), ['Plateau généré', 'Plateau retouché']);
  assert.deepStrictEqual(r.ecartees || [], []);
  r.liste.forEach((entree) => {
    const avis = P.valider(JSON.parse(JSON.stringify(entree.plateau)));
    assert.ok(avis.ok, entree.nom + ' : ' + avis.erreurs.join(' '));
    assert.strictEqual(Object.keys(P.cases(avis.plateau)).length >= 91, true);
    assert.doesNotThrow(() => K.tout(avis.plateau));
  });
  // Exportée de nouveau, puis relue.
  const encore = B.lire(B.exporter(r.liste));
  assert.ok(encore.ok, encore.raison);
  assert.strictEqual(encore.liste.length, 2);
  // Une partie se crée sur un plateau sorti de l'ancienne bibliothèque.
  assert.ok(T.creer({ graine: 3, plateau: r.liste[0].plateau }, env()).ok);
});

test('les tuiles d’une case du premier catalogue restent posables, hors stock seulement', () => {
  const p = P.vierge(1);
  ['P', 'F', 'S', 'V'].forEach((id, i) => {
    const strict = P.poser(p, id, 3 + i, 0, 0);
    assert.strictEqual(strict.ok, false);
    assert.match(strict.raison, /est hors catalogue : elle ne se pose que hors stock/);
    const libre = P.poser(p, id, 3 + i, 0, 0, { horsStock: true });
    assert.ok(libre.ok, libre.raison);
    assert.strictEqual(libre.horsStock, true);
  });
  assert.deepStrictEqual(C.REGLAGES.pinceau, { plaine: 'P', foret: 'F', marais: 'S', montagne: 'M1' });
});
