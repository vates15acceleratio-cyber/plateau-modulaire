'use strict';
// Lots A et B ensemble (vrai plateau, vraie partie) : ce que les doubles de partie.test.js ne peuvent pas montrer.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
const K = require('../src/controles.js');
const VP = require('../src/vue-plateau.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, T = AT.partie;

const env = (graine) => ({ alea: AT.alea.creer(graine), hex: H, plateau: P });
const genere = (graine) => { const r = G.generer(graine); assert.ok(r.ok, r.raison); return P.avecCamps(r.plateau); };

test('3 villes sur la rangée du haut après retouche : contrôle 4 en erreur, plateau enregistrable, relisible, jouable', () => {
  let p = genere(1);
  const cases = P.cases(p);
  const haut = Math.min(...Object.keys(cases).map((k) => H.decle(k).r));
  const plaine = Object.keys(cases).find((k) => H.decle(k).r === haut && cases[k].modele === 'P');
  const neutre = P.villes(p).find((k) => k !== '0,0' && !p.camps.vert.includes(k) && !p.camps.rouge.includes(k));
  assert.ok(plaine && neutre);
  // Comme dans l’interface : retirer la plaine, puis déplacer une ville neutre à sa place.
  p = P.avecCamps(P.retirer(p, cases[plaine].piece).plateau);
  const c = H.decle(plaine);
  const d = VP.deplacerPiece(p, cases[neutre].piece, c.q, c.r);
  assert.ok(d.ok, d.raison);
  p = d.plateau;
  assert.strictEqual(P.villesRangeesExtremes(p).vert.length, 3);
  assert.deepStrictEqual(p.camps.vert, []);
  const bilan = K.tout(p);
  assert.ok(bilan.resultats.some((x) => x.regle === 'villes' && x.niveau === 'erreur' && /3 villes à égalité sur la rangée du haut/.test(x.message)));
  const relu = P.lire(P.serialiser(p));
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, p);
  const partie = T.creer({ graine: 7, plateau: p }, env(7));
  assert.ok(partie.ok, partie.raison);
  assert.ok(T.charger(T.serialiser(partie.etat), env(7)).ok);
});

test('partie créée sur un plateau portant des tuiles d’événement : cartes hors de la pioche, chaque tuile posée une seule fois', () => {
  let p = genere(2);
  const admissible = (id) => Object.keys(P.cases(p)).find((k) => P.peutPoserEvenement(p, id, k).ok);
  for (const id of ['E2', 'E5']) { const r = P.poserEvenement(p, id, admissible(id)); assert.ok(r.ok, r.raison); p = r.plateau; }
  const e = env(3);
  const partie = T.creer({ graine: 3, plateau: p }, e);
  assert.ok(partie.ok, partie.raison);
  const pe = partie.etat.paquets.evenements;
  assert.strictEqual(pe.pioche.length, C.ORDRE_EVENEMENTS.length - 2);
  assert.deepStrictEqual(pe.defausse.slice().sort(), ['E2', 'E5']);
  assert.strictEqual(partie.etat.plateau.recouvrements.length, 2);
  const relu = T.charger(T.serialiser(partie.etat), env(3));
  assert.ok(relu.ok, relu.raison);
  // Toute la pioche se tire, et chaque tuile se pose sur une case permise.
  let etat = partie.etat, posees = 0;
  for (let i = 0; i < pe.pioche.length; i++) {
    const tirage = T.piocherEvenement(etat, {}, e);
    assert.ok(tirage.ok, tirage.raison);
    assert.ok(tirage.carte.id !== 'E2' && tirage.carte.id !== 'E5');
    etat = tirage.etat;
    const cle = Object.keys(P.cases(etat.plateau)).find((k) => P.peutPoserEvenement(etat.plateau, tirage.carte.id, k).ok);
    if (!cle) continue;
    const pose = T.poserEvenement(etat, { evenement: tirage.carte.id, cle: cle }, e);
    assert.ok(pose.ok, pose.raison);
    etat = pose.etat;
    posees += 1;
  }
  assert.ok(posees >= 4, 'tuiles posées : ' + posees);
  assert.strictEqual(T.piocherEvenement(etat, {}, e).ok, false);
  assert.ok(T.charger(T.serialiser(etat), env(3)).ok);
});

test('graine du plateau : même longueur maximale dans plateau.valider et partie.creer', () => {
  assert.strictEqual(T.LIMITES.grainePlateau, C.REGLAGES.bornes.longueurGraine);
  const p = genere(1);
  for (const n of [1, 64, 65, 100]) {
    const q = JSON.parse(JSON.stringify(p));
    q.graine = 'x'.repeat(n);
    const fichier = P.valider(q).ok, partie = T.creer({ graine: 1, plateau: q }, env(1));
    assert.strictEqual(fichier, n <= 64, 'plateau.valider, longueur ' + n);
    assert.strictEqual(partie.ok, n <= 64, 'partie.creer, longueur ' + n);
    if (!partie.ok) assert.match(partie.raison, /graine invalide \(entier ou texte de 64 caractères au plus\)/);
  }
});
