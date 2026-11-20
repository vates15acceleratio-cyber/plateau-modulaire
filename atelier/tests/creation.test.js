'use strict';
// Lot D : modèle de la création à la main (docs/02-atelier-cahier-des-charges.md, §8.1).
// Pièces personnelles portées par le document, pose hors stock, M1, pinceau et gomme, équilibre non comparable, générateur.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/plateau.js');
const K = require('../src/controles.js');
const G = require('../src/generateur.js');
const R = require('../src/rendu.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue;

const copie = (o) => JSON.parse(JSON.stringify(o));
/** Une pièce personnelle valide : coude montagne, forêt, plaine. */
const CRETE = () => ({ nom: 'Crête', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'montagne' }, { q: 1, r: 0, terrain: 'foret' }, { q: 1, r: 1, terrain: 'plaine' }] });
const DUO = () => ({ nom: 'Duo', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'marais' }, { q: 0, r: 1, terrain: 'marais' }] });

function ajouter(plateau, definition) {
  const r = P.ajouterModele(plateau, definition);
  assert.ok(r.ok, r.raison);
  return r.plateau;
}
function poser(plateau, modele, q, r, rotation, options) {
  // Les tuiles d'une case du premier catalogue (P, F, S, V) sont hors catalogue : elles se posent hors stock.
  const res = P.poser(plateau, modele, q, r, rotation || 0, options || { horsStock: ['P', 'F', 'S', 'V'].includes(modele) });
  assert.ok(res.ok, 'pose refusée : ' + res.raison);
  return res.plateau;
}
const avecCrete = () => ajouter(P.vierge(5), CRETE());
const niveaux = (constats, niveau) => constats.filter((x) => x.niveau === niveau);

test('catalogue : M1 est connu, hors catalogue imprimé ; les totaux ne changent pas', () => {
  const m = C.modele('M1');
  assert.strictEqual(m.nombre, 0);
  assert.strictEqual(m.horsCatalogue, true);
  assert.deepStrictEqual(m.cases, [{ q: 0, r: 0, terrain: 'montagne' }]);
  assert.ok(!C.ORDRE_MODELES.includes('M1') && !Object.keys(C.MODELES).includes('M1'));
  assert.deepStrictEqual(C.ORDRE_HORS_CATALOGUE.slice(0, 5), ['M1', 'P', 'F', 'S', 'V']);
  assert.strictEqual(C.totaux().pieces, 28);
  assert.strictEqual(C.totaux().cases, 95);
  assert.deepStrictEqual(C.totaux().construction, { pieces: 24, cases: 91 });
  assert.strictEqual(G.incompatibilite(G.reglages()), null);
  assert.deepStrictEqual(C.REGLAGES.perso.terrains, ['plaine', 'foret', 'marais', 'montagne']);
});

test('vierge : le seul noyau, posé en (0,0)', () => {
  const p = P.vierge('essai');
  assert.strictEqual(p.graine, 'essai');
  assert.deepStrictEqual(p.pieces.map((x) => [x.modele, x.q, x.r, x.rotation]), [['N1', 0, 0, 0]]);
  assert.strictEqual(Object.keys(P.cases(p)).length, 7);
  assert.ok(!('modeles' in p));
  assert.ok(P.valider(p).ok);
});

test('ajouterModele : identifiant attribué, plateau reçu intact, modèle trouvé par le plateau, stock', () => {
  const depart = P.vierge(1), fige = JSON.stringify(depart);
  const r = P.ajouterModele(depart, CRETE());
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.id, 'X1');
  assert.strictEqual(JSON.stringify(depart), fige);
  assert.deepStrictEqual(r.plateau.modeles, [Object.assign({ id: 'X1' }, CRETE())]);
  assert.deepStrictEqual(r.modele, r.plateau.modeles[0]);
  assert.notStrictEqual(r.modele, r.plateau.modeles[0]);
  const deux = P.ajouterModele(r.plateau, DUO());
  assert.strictEqual(deux.id, 'X2');
  assert.strictEqual(P.prochainIdModele(deux.plateau), 'X3');
  assert.strictEqual(P.prochainIdModele(P.vide(1)), 'X1');
  const m = P.modele(deux.plateau, 'X1');
  assert.strictEqual(m.perso, true);
  assert.strictEqual(m.nombre, 2);
  assert.strictEqual(m.nom, 'Crête');
  assert.strictEqual(P.modele(deux.plateau, 'P').nom, 'Plaine');
  assert.strictEqual(P.modele(deux.plateau, 'M1').horsCatalogue, true);
  assert.strictEqual(P.modele(P.vide(1), 'X1'), null);
  assert.strictEqual(P.modele(undefined, 'P').nom, 'Plaine');
  for (const id of ['__proto__', 'constructor', 'toString', 'X9', '', null, 3]) assert.strictEqual(P.modele(deux.plateau, id), null, String(id));
  assert.deepStrictEqual(P.idsModeles(deux.plateau), C.ORDRE_MODELES.concat(C.ORDRE_HORS_CATALOGUE, ['X1', 'X2']));
  const s = P.stock(deux.plateau);
  assert.deepStrictEqual(Object.keys(s), C.ORDRE_MODELES.concat(C.ORDRE_HORS_CATALOGUE, ['X1', 'X2']));
  assert.deepStrictEqual(s.X1, { total: 2, poses: 0, restant: 2 });
  assert.deepStrictEqual(s.X2, { total: 1, poses: 0, restant: 1 });
  // La liste rendue par modeles() est une copie.
  P.modeles(deux.plateau)[0].cases[0].terrain = 'ville';
  assert.strictEqual(deux.plateau.modeles[0].cases[0].terrain, 'montagne');
  assert.deepStrictEqual(P.modeles(P.vide(1)), []);
});

test('validerModele : bornes et refus expliqués (§8.1)', () => {
  const base = () => Object.assign({ id: 'X1' }, CRETE());
  assert.ok(P.validerModele(base()).ok);
  const ligne = (n) => Array.from({ length: n }, (_, i) => ({ q: i, r: 0, terrain: 'plaine' }));
  assert.ok(P.validerModele(Object.assign(base(), { cases: ligne(2) })).ok);
  assert.ok(P.validerModele(Object.assign(base(), { cases: ligne(6) })).ok);
  assert.ok(P.validerModele(Object.assign(base(), { quantite: 9 })).ok);
  assert.ok(P.validerModele(Object.assign(base(), { id: 'X9999' })).ok);
  const refus = {
    'une seule case': [(m) => { m.cases = ligne(1); }, /2 à 6 cases/],
    'sept cases': [(m) => { m.cases = ligne(7); }, /2 à 6 cases/],
    'cases non reliées': [(m) => { m.cases[2].q = 3; }, /seul tenant/],
    'sans la case (0,0)': [(m) => { m.cases.forEach((c) => { c.q += 1; }); }, /\(0,0\)/],
    'ville': [(m) => { m.cases[1].terrain = 'ville'; }, /jamais de ville/],
    'terrain inconnu': [(m) => { m.cases[1].terrain = 'boue'; }, /terrain invalide/],
    'terrain « constructor »': [(m) => { m.cases[1].terrain = 'constructor'; }, /terrain invalide/],
    'case en double': [(m) => { m.cases[2] = { q: 1, r: 0, terrain: 'plaine' }; }, /en double/],
    'case non entière': [(m) => { m.cases[1].q = 0.5; }, /position invalide/],
    'case lointaine': [(m) => { m.cases[1].q = 6; }, /position invalide/],
    'champ en trop dans une case': [(m) => { m.cases[1].miroir = true; }, /champ inconnu/],
    'cases : pas une liste': [(m) => { m.cases = { length: 3 }; }, /2 à 6 cases/],
    'quantité 0': [(m) => { m.quantite = 0; }, /quantité invalide \(1 à 9\)/],
    'quantité 10': [(m) => { m.quantite = 10; }, /quantité invalide/],
    'quantité 1,5': [(m) => { m.quantite = 1.5; }, /quantité invalide/],
    'quantité en texte': [(m) => { m.quantite = '2'; }, /quantité invalide/],
    'nom vide': [(m) => { m.nom = '   '; }, /nom invalide/],
    'nom trop long': [(m) => { m.nom = 'n'.repeat(41); }, /nom invalide \(1 à 40/],
    'nom avec caractère de contrôle': [(m) => { m.nom = 'a\u0000b'; }, /nom invalide/],
    'nom qui n’est pas un texte': [(m) => { m.nom = 12; }, /nom invalide/],
    'champ inconnu': [(m) => { m.noyau = true; }, /champ inconnu/],
    'champ manquant': [(m) => { delete m.quantite; }, /manquant/],
    'identifiant de base': [(m) => { m.id = 'P'; }, /identifiant invalide/],
    'identifiant M1': [(m) => { m.id = 'M1'; }, /identifiant invalide/],
    'identifiant X0': [(m) => { m.id = 'X0'; }, /identifiant invalide/],
    'identifiant X01': [(m) => { m.id = 'X01'; }, /identifiant invalide/],
    'identifiant trop long': [(m) => { m.id = 'X12345'; }, /identifiant invalide/],
    'identifiant __proto__': [(m) => { m.id = '__proto__'; }, /identifiant invalide/],
    'identifiant constructor': [(m) => { m.id = 'constructor'; }, /identifiant invalide/],
    'identifiant numérique': [(m) => { m.id = 1; }, /identifiant invalide/]
  };
  for (const nom of Object.keys(refus)) {
    const m = base();
    refus[nom][0](m);
    const r = P.validerModele(m);
    assert.strictEqual(r.ok, false, nom);
    assert.strictEqual(r.modele, null, nom);
    assert.match(r.erreurs.join(' '), refus[nom][1], nom);
  }
  for (const mauvais of [null, 3, 'X1', [], [base()]]) assert.strictEqual(P.validerModele(mauvais).ok, false);
  // Un identifiant ajouté au catalogue de base n'est plus libre pour une pièce personnelle.
  C.MODELES.X7 = { id: 'X7', nom: 'Essai', nombre: 1, cases: C.MODELES.F3.cases };
  try {
    assert.match(P.validerModele(Object.assign(base(), { id: 'X7' })).erreurs[0], /déjà celui d’une pièce du catalogue/);
    const p = ajouter(ajouter(ajouter(ajouter(ajouter(ajouter(P.vide(1), DUO()), DUO()), DUO()), DUO()), DUO()), DUO());
    assert.strictEqual(P.prochainIdModele(p), 'X8', 'X7 est sauté');
  } finally { delete C.MODELES.X7; }
  // Le refus de ajouterModele reprend la première erreur.
  const r = P.ajouterModele(P.vide(1), { nom: 'Bourg', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'ville' }, { q: 1, r: 0, terrain: 'plaine' }] });
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /jamais de ville dans un monobloc \(règle A2\)/);
  assert.ok(Array.isArray(r.erreurs) && r.erreurs.length >= 1);
  assert.strictEqual(P.ajouterModele(P.vide(1)).ok, false);
});

test('plateau.valider : pièces personnelles du fichier validées strictement', () => {
  let p = poser(avecCrete(), 'X1', 3, 0, 0);
  const bon = P.valider(copie(p));
  assert.ok(bon.ok, bon.erreurs.join(' '));
  assert.deepStrictEqual(bon.plateau, p);
  assert.notStrictEqual(bon.plateau.modeles, p.modeles);
  const refuse = (mutation, motif) => {
    const o = copie(p);
    mutation(o);
    const r = P.valider(o);
    assert.strictEqual(r.ok, false, String(motif));
    assert.strictEqual(r.plateau, null);
    assert.match(r.erreurs.join(' '), motif);
  };
  refuse((o) => { o.modeles = 'X1'; }, /Liste des pièces personnelles invalide/);
  refuse((o) => { o.modeles = null; }, /Liste des pièces personnelles invalide/);
  refuse((o) => { o.modeles.push(copie(o.modeles[0])); }, /identifiant X1 en double/);
  refuse((o) => { o.modeles = Array.from({ length: 25 }, (_, i) => Object.assign(CRETE(), { id: 'X' + (i + 1) })); }, /24 au plus/);
  refuse((o) => { o.modeles[0].cases[0].terrain = 'ville'; }, /jamais de ville/);
  refuse((o) => { o.modeles[0].id = 'N1'; }, /identifiant invalide/);
  refuse((o) => { o.modeles[0].quantite = 99; }, /quantité invalide/);
  refuse((o) => { o.modeles = []; }, /modèle inconnu du catalogue/);          // la pièce posée X1 n'a plus de modèle
  refuse((o) => { o.pieces[1].modele = 'X2'; }, /modèle inconnu du catalogue/);
  refuse((o) => { o.modeles[0] = ['X1']; }, /ce n’est pas un objet/);
  // « __proto__ » venu d'un fichier : champ inconnu, jamais une pollution.
  const piege = P.valider(JSON.parse(JSON.stringify(p).replace('"quantite":2', '"quantite":2,"__proto__":{"pollue":true}')));
  assert.strictEqual(piege.ok, false);
  assert.match(piege.erreurs.join(' '), /champ inconnu/);
  const piege2 = P.valider(JSON.parse(JSON.stringify(p).replace('"terrain":"foret"', '"terrain":"foret","constructor":1')));
  assert.strictEqual(piege2.ok, false);
  assert.strictEqual({}.pollue, undefined);
  // Liste vide acceptée quand rien ne s'y réfère : le champ disparaît (forme canonique).
  const vide = copie(P.vierge(1));
  vide.modeles = [];
  const r = P.valider(vide);
  assert.ok(r.ok, r.erreurs.join(' '));
  assert.ok(!('modeles' in r.plateau));
  // Fichier : serialiser puis lire redonne le même document.
  const relu = P.lire(P.serialiser(p));
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, p);
});

test('poser une pièce personnelle : cases, rotation, stock, refus au-delà de la quantité', () => {
  let p = avecCrete();
  const a = P.poser(p, 'X1', 3, 0, 0);
  assert.ok(a.ok, a.raison);
  assert.strictEqual(a.horsStock, false);
  assert.deepStrictEqual(P.casesPiece(a.plateau.pieces[1], a.plateau).map((c) => [c.cle, c.terrain]), [['3,0', 'montagne'], ['4,0', 'foret'], ['4,1', 'plaine']]);
  assert.deepStrictEqual(P.casesPiece(a.plateau.pieces[1]), [], 'sans le document, une pièce personnelle est inconnue');
  const cases = P.cases(a.plateau);
  assert.deepStrictEqual(cases['4,0'], { terrain: 'foret', piece: a.id, origine: 'foret', modele: 'X1', evenement: null });
  assert.strictEqual(P.cout(a.plateau, '3,0'), Infinity);
  assert.strictEqual(P.cout(a.plateau, '4,0'), 2);
  // Rotation : seulement des sixièmes de tour (pas de miroir).
  for (let rot = 0; rot < 6; rot++) {
    const cs = P.casesModele('X1', 0, 0, rot, p);
    assert.strictEqual(new Set(cs.map((c) => c.cle)).size, 3);
    assert.deepStrictEqual(cs.map((c) => c.terrain), ['montagne', 'foret', 'plaine']);
    cs.forEach((c, i) => assert.deepStrictEqual({ q: c.q, r: c.r }, H.tourner(CRETE().cases[i].q, CRETE().cases[i].r, rot)));
  }
  const chevauche = P.poser(a.plateau, 'X1', 2, 0, 0);
  assert.strictEqual(chevauche.ok, false);
  assert.match(chevauche.raison, /Chevauchement : case \(3,0\)/);
  const b = P.poser(a.plateau, 'X1', -4, 0, 3);
  assert.ok(b.ok, b.raison);
  assert.deepStrictEqual(P.stock(b.plateau).X1, { total: 2, poses: 2, restant: 0 });
  const c = P.poser(b.plateau, 'X1', 3, 3, 0);
  assert.strictEqual(c.ok, false);
  assert.match(c.raison, /Stock épuisé : plus de pièce « Crête » \(2 prévue\(s\) pour cette pièce personnelle\)/);
  assert.strictEqual(P.poser(P.vierge(1), 'X1', 3, 0, 0).ok, false, 'modèle d’un autre document');
  // Tourner et retirer passent par le document.
  const t = P.tourner(a.plateau, a.id, 1);
  assert.ok(t.ok, t.raison);
  const attendues = CRETE().cases.map((c) => { const x = H.tourner(c.q, c.r, 1); return H.cle(3 + x.q, x.r); });
  assert.deepStrictEqual(attendues, ['3,0', '3,1', '2,2'], 'un sixième de tour autour de l’ancre');
  assert.deepStrictEqual(Object.keys(P.cases(t.plateau)).filter((k) => P.cases(t.plateau)[k].modele === 'X1').sort(), attendues.slice().sort());
  const gene = poser(a.plateau, 'P', 3, 1, 0);
  const bloque = P.tourner(gene, a.id, 1);
  assert.strictEqual(bloque.ok, false);
  assert.match(bloque.raison, /Chevauchement/);
  const ev = P.poserEvenement(a.plateau, 'E4', '4,0');
  assert.ok(ev.ok, ev.raison);
  const retrait = P.retirer(ev.plateau, a.id);
  assert.deepStrictEqual(retrait.evenementsRetires, ['E4']);
  assert.strictEqual(Object.keys(P.cases(retrait.plateau)).length, 7);
  assert.deepStrictEqual(retrait.plateau.modeles, p.modeles);
});

test('modifier la forme, supprimer : refusés avec explication tant que des exemplaires sont posés', () => {
  // Lot E : le nom et la quantité d'une pièce posée se changent (tests/creation-interface.test.js) ; sa forme, non.
  const libre = avecCrete();
  const pose = P.poser(libre, 'X1', 3, 0, 0);
  const m = P.modifierModele(pose.plateau, 'X1', { nom: 'Autre', cases: DUO().cases });
  assert.strictEqual(m.ok, false);
  assert.strictEqual(m.plateau, pose.plateau);
  assert.match(m.raison, /Modification de la forme refusée : 1 exemplaire de « Crête » est posé sur le plateau\. Retirez-le d’abord\./);
  assert.deepStrictEqual(m.pieces, [pose.id]);
  const deux = P.poser(pose.plateau, 'X1', -4, 0, 0);
  const s = P.supprimerModele(deux.plateau, 'X1');
  assert.strictEqual(s.ok, false);
  assert.match(s.raison, /Suppression refusée : 2 exemplaires de « Crête » sont posés sur le plateau\. Retirez-les d’abord\./);
  assert.deepStrictEqual(s.pieces, [pose.id, deux.id]);
  // Une fois les exemplaires retirés, tout est permis.
  const fige = JSON.stringify(libre);
  const change = P.modifierModele(libre, 'X1', { nom: 'Grande crête', quantite: 3 });
  assert.ok(change.ok, change.raison);
  assert.strictEqual(JSON.stringify(libre), fige);
  assert.deepStrictEqual(change.plateau.modeles[0], { id: 'X1', nom: 'Grande crête', cases: CRETE().cases, quantite: 3 });
  const forme = P.modifierModele(libre, 'X1', { cases: DUO().cases });
  assert.deepStrictEqual(forme.plateau.modeles[0].cases, DUO().cases);
  assert.strictEqual(forme.plateau.modeles[0].nom, 'Crête');
  const fautif = P.modifierModele(libre, 'X1', { cases: [{ q: 0, r: 0, terrain: 'ville' }, { q: 1, r: 0, terrain: 'plaine' }] });
  assert.strictEqual(fautif.ok, false);
  assert.match(fautif.raison, /jamais de ville/);
  assert.strictEqual(P.modifierModele(libre, 'X2', { nom: 'x' }).ok, false);
  assert.match(P.modifierModele(libre, 'P', { nom: 'x' }).raison, /introuvable/);
  assert.match(P.supprimerModele(libre, 'N1').raison, /introuvable/);
  const supprime = P.supprimerModele(libre, 'X1');
  assert.ok(supprime.ok, supprime.raison);
  assert.ok(!('modeles' in supprime.plateau), 'plus aucune pièce personnelle : le champ disparaît');
  assert.deepStrictEqual(supprime.plateau, P.vierge(5));
});

test('copierModeles : d’un plateau vers un autre, identifiants renumérotés sans collision', () => {
  const source = ajouter(avecCrete(), DUO());                         // X1 Crête, X2 Duo
  const cible = ajouter(P.vierge(9), { nom: 'Bande', quantite: 3, cases: [{ q: 0, r: 0, terrain: 'plaine' }, { q: 1, r: 0, terrain: 'plaine' }] });   // X1 Bande
  const figeSource = JSON.stringify(source), figeCible = JSON.stringify(cible);
  const r = P.copierModeles(source, cible);
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.copies, 2);
  // X1 est pris dans la cible : la Crête est renumérotée ; X2 y est libre : le Duo garde son identifiant.
  assert.deepStrictEqual(r.correspondance, { X1: 'X3', X2: 'X2' });
  assert.deepStrictEqual(r.plateau.modeles.map((m) => [m.id, m.nom]), [['X1', 'Bande'], ['X3', 'Crête'], ['X2', 'Duo']]);
  assert.strictEqual(new Set(r.plateau.modeles.map((m) => m.id)).size, 3);
  assert.strictEqual(JSON.stringify(source), figeSource);
  assert.strictEqual(JSON.stringify(cible), figeCible);
  assert.ok(P.valider(copie(r.plateau)).ok);
  r.plateau.modeles[1].cases[0].terrain = 'plaine';
  assert.strictEqual(source.modeles[0].cases[0].terrain, 'montagne', 'pas de partage entre les deux documents');
  // Vers un plateau sans pièce personnelle : les identifiants sont gardés.
  const neuf = P.copierModeles(source, P.vierge(2), ['X2']);
  assert.deepStrictEqual(neuf.correspondance, { X2: 'X2' });
  assert.deepStrictEqual(neuf.plateau.modeles.map((m) => m.id), ['X2']);
  // Refus : rien à copier, identifiant inconnu, trop de pièces, source fautive.
  assert.match(P.copierModeles(P.vierge(1), cible).raison, /Aucune pièce personnelle à copier/);
  assert.match(P.copierModeles(source, cible, ['X9']).raison, /introuvable/);
  assert.strictEqual(P.copierModeles(source, cible, 'X1').ok, false);
  let plein = P.vierge(3);
  for (let i = 0; i < 23; i++) plein = ajouter(plein, DUO());
  const trop = P.copierModeles(source, plein);
  assert.strictEqual(trop.ok, false);
  assert.strictEqual(trop.plateau, plein);
  assert.match(trop.raison, /25 pièces personnelles, pour 24 au plus/);
  assert.ok(P.copierModeles(source, plein, ['X1']).ok);
  assert.match(P.ajouterModele(ajouter(plein, DUO()), DUO()).raison, /Trop de pièces personnelles : 24 au plus/);
  const fautive = copie(source);
  fautive.modeles[0].cases[0].terrain = 'ville';
  assert.strictEqual(P.copierModeles(fautive, cible).ok, false);
});

test('toutes les fonctions de modification gardent les pièces personnelles, sans les partager', () => {
  const p = P.avecCamps(poser(poser(poser(avecCrete(), 'X1', 3, 0, 0), 'F', 2, -1, 0), 'V', 0, -3, 0));
  const attendu = JSON.stringify(p.modeles);
  const idCrete = p.pieces.filter((x) => x.modele === 'X1')[0].id;
  const resultats = {
    poser: P.poser(p, 'P', -3, 0, 0, { horsStock: true }),
    retirer: P.retirer(p, idCrete),
    tourner: P.tourner(p, idCrete, 2),
    peindre: P.peindre(p, '-3,0', 'marais'),
    gommer: P.gommer(p, '2,-1'),
    poserEvenement: P.poserEvenement(p, 'E4', '2,-1'),
    ajouterModele: null, modifierModele: null
  };
  resultats.retirerEvenement = P.retirerEvenement(resultats.poserEvenement.plateau, 'E4');
  delete resultats.ajouterModele; delete resultats.modifierModele;
  for (const nom of Object.keys(resultats)) {
    const r = resultats[nom];
    assert.ok(r.ok, nom + ' : ' + r.raison);
    assert.strictEqual(JSON.stringify(r.plateau.modeles), attendu, nom);
    assert.notStrictEqual(r.plateau.modeles, p.modeles, nom);
    assert.notStrictEqual(r.plateau.modeles[0].cases[0], p.modeles[0].cases[0], nom);
  }
  const camps = P.avecCamps(p);
  assert.strictEqual(JSON.stringify(camps.modeles), attendu);
  assert.notStrictEqual(camps.modeles, p.modeles);
  assert.deepStrictEqual(JSON.parse(P.serialiser(p)).modeles, p.modeles);
  assert.strictEqual(JSON.stringify(p.modeles), attendu, 'le document de départ n’a pas bougé');
});

test('pose hors stock : stricte par défaut, permise sur option, annoncée', () => {
  const p = P.vierge(1);
  const strict = P.poser(p, 'M1', 3, 0, 0);
  assert.strictEqual(strict.ok, false);
  assert.match(strict.raison, /« Montagne d’une case » est hors catalogue : elle ne se pose que hors stock/);
  const libre = P.poser(p, 'M1', 3, 0, 0, { horsStock: true });
  assert.ok(libre.ok, libre.raison);
  assert.strictEqual(libre.horsStock, true);
  assert.deepStrictEqual(P.stock(libre.plateau).M1, { total: 0, poses: 1, restant: -1 });
  assert.strictEqual(P.cases(libre.plateau)['3,0'].terrain, 'montagne');
  const enStock = P.poser(p, 'R', 3, 0, 0, { horsStock: true });
  assert.strictEqual(enStock.horsStock, false, 'tant qu’il reste du stock, la pose n’est pas hors stock');
  assert.strictEqual(P.poser(p, 'N1', 5, 5, 0).ok, false);
  assert.strictEqual(P.poser(p, 'N1', 5, 5, 0, { horsStock: 1 }).ok, false, 'l’option doit valoir true');
  assert.strictEqual(P.poser(p, 'P', 0, 0, 0, { horsStock: true }).ok, false, 'un chevauchement reste refusé');
  // Un plateau avec M1 s'enregistre et se relit.
  const relu = P.lire(P.serialiser(libre.plateau));
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, libre.plateau);
});

test('contrôle 1 : tuiles à prévoir en plus du catalogue, montagne d’une case, monobloc en trop', () => {
  let p = P.vierge(1);
  // 7 forêts d'une case (hors catalogue depuis le catalogue 2) ; 2 montagnes d'une case.
  for (let i = 0; i < 7; i++) p = poser(p, 'F', 3 + i, 0, 0, { horsStock: true });
  p = poser(poser(p, 'M1', 3, 2, 0, { horsStock: true }), 'M1', 4, 2, 0, { horsStock: true });
  const constats = K.inventaire(p);
  assert.strictEqual(niveaux(constats, 'erreur').length, 0, 'une pose hors stock d’une tuile d’une case n’est pas une erreur');
  const enPlus = constats.filter((x) => /à prévoir en plus du catalogue/.test(x.message))[0];
  assert.strictEqual(enPlus.niveau, 'alerte');
  assert.strictEqual(enPlus.message, 'Tuiles à prévoir en plus du catalogue (9) : 2 × Montagne d’une case, 7 × Forêt.');
  assert.deepStrictEqual(enPlus.donnees, { enPlus: 9, parModele: { M1: 2, F: 7 } });
  assert.deepStrictEqual(enPlus.cases, H.trier(['3,0', '4,0', '5,0', '6,0', '7,0', '8,0', '9,0', '3,2', '4,2']), 'toutes les tuiles hors catalogue');
  const montagnes = constats.filter((x) => /d’une case sur le plateau/.test(x.message))[0];
  assert.strictEqual(montagnes.niveau, 'alerte');
  assert.match(montagnes.message, /^2 montagnes d’une case sur le plateau : la décision en vigueur est « montagnes en blocs de 4 ou 5 cases »\.$/);
  assert.deepStrictEqual(montagnes.cases, ['3,2', '4,2']);
  assert.ok(constats.some((x) => x.niveau === 'alerte' && /^Pièces de terrain restantes \(23\)/.test(x.message)));
  assert.ok(!/Montagne d’une case/.test(constats.filter((x) => /^Pièces de terrain restantes/.test(x.message))[0].message), 'M1 n’est jamais une pièce restante');
  // Sans rien hors stock : aucune de ces deux alertes.
  assert.ok(!K.inventaire(P.vierge(1)).some((x) => /à prévoir|d’une case/.test(x.message)));
  // Un monobloc posé plus de fois que prévu reste une erreur (catalogue comme pièce personnelle).
  const trop = poser(poser(P.vierge(1), 'M4', 3, 0, 0), 'M4', 3, 3, 0, { horsStock: true });
  assert.ok(niveaux(K.inventaire(trop), 'erreur').some((x) => /Stock dépassé : 2 × « Montagne zigzag » posées pour 1 au catalogue/.test(x.message)));
  let perso = ajouter(P.vierge(1), DUO());
  assert.ok(K.inventaire(perso).some((x) => x.niveau === 'alerte' && x.message === 'Pièces personnelles restantes (1) : 1 × Duo.'));
  perso = poser(poser(perso, 'X1', 3, 0, 0), 'X1', -3, 0, 0, { horsStock: true });
  const erreurs = niveaux(K.inventaire(perso), 'erreur');
  assert.strictEqual(erreurs.length, 1);
  assert.match(erreurs[0].message, /Stock dépassé : 2 × « Duo » posées pour 1 prévue\(s\) \(pièce personnelle\)/);
  assert.deepStrictEqual(erreurs[0].cases, H.trier(['3,0', '3,1', '-3,0', '-3,1']));
  // Pièce d'un modèle inconnu du document : erreur « hors catalogue ».
  const orphelin = copie(perso);
  delete orphelin.modeles;
  assert.ok(niveaux(K.inventaire(orphelin), 'erreur').some((x) => /2 pièces hors catalogue/.test(x.message)));
  assert.doesNotThrow(() => K.tout(orphelin));
});

test('contrôle 3 : une pièce personnelle avec une ville (document monté à la main) est une erreur', () => {
  const p = poser(avecCrete(), 'X1', 3, 0, 0);
  assert.ok(!niveaux(K.monoblocs(p), 'erreur').length);
  const fautif = copie(p);
  fautif.modeles[0].cases[1].terrain = 'ville';
  const erreurs = niveaux(K.monoblocs(fautif), 'erreur');
  assert.ok(erreurs.some((x) => /Pièce personnelle avec une ville \(X1\)/.test(x.message)));
  assert.ok(erreurs.some((x) => x.cases.includes('4,0')));
});

test('peindre : tuile d’une case hors catalogue (une Plaine vient d’abord des remplissages), remplacement, refus', () => {
  const depart = P.vierge(1), fige = JSON.stringify(depart);
  const a = P.peindre(depart, '3,0', 'foret');
  assert.ok(a.ok, a.raison);
  assert.strictEqual(JSON.stringify(depart), fige);
  assert.deepStrictEqual({ modele: a.modele, terrain: a.terrain, horsStock: a.horsStock, remplace: a.remplace, inchange: a.inchange },
    { modele: 'F', terrain: 'foret', horsStock: true, remplace: null, inchange: false });
  assert.match(a.note, /« Forêt » posée hors stock : elle est à prévoir en plus du catalogue/);
  assert.strictEqual(P.cases(a.plateau)['3,0'].piece, a.id);
  // Catalogue 2 : toute tuile peinte est hors catalogue, sauf une Plaine tant qu'il reste un remplissage en stock.
  const modeles = { plaine: 'R', foret: 'F', marais: 'S', montagne: 'M1' };
  for (const terrain of Object.keys(modeles)) {
    const r = P.peindre(depart, '4,-2', terrain);
    assert.ok(r.ok, terrain + ' : ' + r.raison);
    assert.strictEqual(r.modele, modeles[terrain]);
    assert.strictEqual(P.cases(r.plateau)['4,-2'].terrain, terrain);
    assert.strictEqual(r.horsStock, terrain !== 'plaine');
  }
  // Les villes ne se peignent plus : elles se posent à l'étape « Villes ».
  const ville = P.peindre(depart, '4,-2', 'ville');
  assert.strictEqual(ville.ok, false);
  assert.match(ville.raison, /Le pinceau ne pose pas de ville : les villes se posent à l’étape « Villes »/);
  // Montagne : toujours hors stock, et le résultat le dit.
  const m = P.peindre(a.plateau, '4,0', 'montagne');
  assert.strictEqual(m.horsStock, true);
  assert.match(m.note, /« Montagne d’une case » posée hors stock : elle est à prévoir en plus du catalogue/);
  // Remplacement d'une tuile d'une case ; la tuile d'événement posée dessus repart en réserve.
  const ev = P.poserEvenement(m.plateau, 'E4', '3,0');
  assert.ok(ev.ok, ev.raison);
  const b = P.peindre(ev.plateau, '3,0', 'marais');
  assert.ok(b.ok, b.raison);
  assert.strictEqual(b.remplace, a.id);
  assert.deepStrictEqual(b.evenementsRetires, ['E4']);
  assert.strictEqual(P.cases(b.plateau)['3,0'].terrain, 'marais');
  assert.strictEqual(b.plateau.pieces.length, ev.plateau.pieces.length);
  assert.strictEqual(P.stock(b.plateau).F.poses, 0, 'la forêt remplacée est revenue au stock');
  // Même terrain : rien ne change.
  const c = P.peindre(b.plateau, '3,0', 'marais');
  assert.ok(c.ok);
  assert.strictEqual(c.inchange, true);
  assert.strictEqual(c.plateau, b.plateau);
  assert.strictEqual(c.id, b.id);
  // Plaines : les 2 remplissages du stock d'abord, puis une Plaine hors catalogue.
  let p = depart, dernier = null;
  for (let i = 0; i < 3; i++) {
    dernier = P.peindre(p, (3 + i) + ',0', 'plaine');
    assert.ok(dernier.ok);
    assert.strictEqual(dernier.modele, i < 2 ? 'R' : 'P', 'plaine n° ' + (i + 1));
    assert.strictEqual(dernier.horsStock, i === 2, 'plaine n° ' + (i + 1));
    p = dernier.plateau;
  }
  assert.match(dernier.note, /« Plaine » posée hors stock/);
  assert.strictEqual(P.stock(p).R.restant, 0);
  assert.strictEqual(P.peindre(p, '3,0', 'plaine').inchange, true, 'un remplissage est déjà une Plaine');
  // Remplacer une tuile par une autre : toujours hors catalogue.
  const echange = P.peindre(P.peindre(p, '3,0', 'marais').plateau, '3,0', 'foret');
  assert.strictEqual(echange.horsStock, true);
  // Refus : noyau, monobloc du catalogue, pièce personnelle, terrain ou case invalides.
  const noyau = P.peindre(depart, '1,0', 'foret');
  assert.strictEqual(noyau.ok, false);
  assert.strictEqual(noyau.plateau, depart);
  assert.deepStrictEqual({ raison: noyau.raison, monobloc: noyau.monobloc, noyau: noyau.noyau, piece: noyau.piece },
    { raison: 'Le pinceau ne modifie pas le noyau.', monobloc: true, noyau: true, piece: depart.pieces[0].id });
  assert.strictEqual(P.peindre(depart, '0,0', 'plaine').ok, false);
  const bois = poser(depart, 'F3', 3, 0, 0);
  const surBois = P.peindre(bois, '4,0', 'plaine');
  assert.strictEqual(surBois.ok, false);
  assert.match(surBois.raison, /Cette case appartient au monobloc « Bois » : le pinceau ne le modifie pas/);
  assert.deepStrictEqual([surBois.monobloc, surBois.noyau], [true, false]);
  const crete = poser(avecCrete(), 'X1', 3, 0, 0);
  assert.match(P.peindre(crete, '4,1', 'foret').raison, /monobloc « Crête »/);
  assert.match(P.peindre(depart, '3,0', 'boue').raison, /Terrain inconnu du pinceau/);
  assert.match(P.peindre(depart, '3,0', 'constructor').raison, /Terrain inconnu du pinceau/);
  assert.match(P.peindre(depart, '31,0', 'plaine').raison, /hors des limites/);
  assert.strictEqual(P.peindre(depart, 'ici', 'plaine').ok, false);
  assert.strictEqual(P.peindre(depart, null, 'plaine').ok, false);
});

test('gommer : retire une tuile d’une case, signale un monobloc sans le retirer', () => {
  const p = poser(poser(P.vierge(1), 'F', 3, 0, 0), 'F3', 3, 2, 0), fige = JSON.stringify(p);
  const ev = P.poserEvenement(p, 'E4', '3,0');
  const a = P.gommer(ev.plateau, '3,0');
  assert.ok(a.ok, a.raison);
  assert.strictEqual(a.modele, 'F');
  assert.strictEqual(a.id, p.pieces[1].id);
  assert.deepStrictEqual(a.evenementsRetires, ['E4']);
  assert.ok(!('3,0' in P.cases(a.plateau)));
  assert.strictEqual(a.plateau.recouvrements.length, 0);
  assert.strictEqual(JSON.stringify(p), fige);
  const b = P.gommer(p, '4,2');
  assert.strictEqual(b.ok, false);
  assert.strictEqual(b.plateau, p);
  assert.strictEqual(b.monobloc, true);
  assert.strictEqual(b.noyau, false);
  assert.strictEqual(b.piece, p.pieces[2].id);
  assert.strictEqual(b.modele, 'F3');
  assert.deepStrictEqual(H.trier(b.cases), H.trier(['3,2', '4,2', '3,3']));
  assert.match(b.raison, /Cette case appartient au monobloc « Bois » \(3 cases\) : la gomme ne le retire qu’après confirmation/);
  // Après confirmation, l'interface retire la pièce désignée.
  assert.strictEqual(Object.keys(P.cases(P.retirer(p, b.piece).plateau)).length, 8);
  const n = P.gommer(p, '0,0');
  assert.deepStrictEqual([n.ok, n.monobloc, n.noyau, n.cases.length], [false, true, true, 7]);
  assert.match(n.raison, /appartient au noyau \(7 cases\)/);
  const v = P.gommer(p, '9,9');
  assert.deepStrictEqual([v.ok, v.vide, v.raison], [false, true, 'Case vide : rien à gommer.']);
  assert.strictEqual(P.gommer(p, undefined).vide, true);
  const crete = poser(avecCrete(), 'X1', 3, 0, 0);
  assert.strictEqual(P.gommer(crete, '4,1').monobloc, true);
});

test('équilibre : plus de « non comparable » ; le score se calcule sans symétrie dès que les deux camps ont leurs villes', () => {
  const monter = (liste) => liste.reduce((p, x) => poser(p, x[0], x[1], x[2], 0), P.vide(1));
  // Ancien plateau en colonne : villes d'une case, déploiement sur les rangées extrêmes.
  const penche = P.avecCamps(monter([['V', 0, -2], ['S', 0, -1], ['V', 0, 0], ['P', 0, 1], ['V', 0, 2]]));
  const e1 = K.equilibre(penche);
  assert.deepStrictEqual([e1.calculable, e1.comparable, e1.score, e1.raison], [true, true, 1, null]);
  assert.ok(/^Équilibre : score 1/.test(K.controleEquilibre(penche)[0].message));
  // Forme non symétrique (une plaine de plus d'un côté) : le score est toujours calculé.
  const forme = poser(penche, 'P', 1, 0, 0);
  const e2 = K.equilibre(forme);
  assert.deepStrictEqual([e2.calculable, e2.comparable, e2.score], [true, true, 1]);
  assert.deepStrictEqual(e2.villes.map((v) => [v.cle, v.type, v.vert, v.rouge, v.ecart]),
    [['0,-2', 'vert', 0, 5, null], ['0,0', 'centre', 3, 2, 1], ['0,2', 'rouge', 5, 0, null]]);
  assert.deepStrictEqual(e2.adverses, { vert: [5], rouge: [5], ecart: 0 });
  const c2 = K.controleEquilibre(forme);
  assert.strictEqual(c2[0].niveau, 'info');
  assert.strictEqual(c2[0].donnees.villes.length, 3);
  assert.ok(!c2.some((x) => /non comparable/.test(x.message)));
  // Une ville d'un seul côté : elle compte comme les autres (coût de Vert contre coût de Rouge).
  const villes = P.avecCamps(monter([['V', 0, -2], ['P', 0, -1], ['V', 0, 0], ['P', 0, 1], ['V', 0, 2], ['V', 2, 0], ['P', -2, 0], ['P', 1, 0], ['P', -1, 0]]));
  const e3 = K.equilibre(villes);
  assert.deepStrictEqual([e3.calculable, e3.score], [true, 1]);
  assert.deepStrictEqual(e3.villes.filter((v) => v.cle === '2,0')[0], { cle: '2,0', type: 'neutre', vert: 4, rouge: 3, ecart: 1 });
  // Le bilan complet porte le même score.
  assert.strictEqual(K.tout(forme).equilibre.score, 1);
  // Non calculable tant que les deux camps n'ont pas de ville de déploiement : pas de score, simple information.
  const e4 = K.equilibre(P.vierge(1));
  assert.deepStrictEqual([e4.calculable, e4.comparable, e4.score], [false, false, null]);
  assert.strictEqual(K.controleEquilibre(P.vierge(1))[0].niveau, 'info');
  // Un plateau généré (jamais symétrique) a un score.
  const genere = G.generer(1);
  assert.ok(genere.ok, genere.raison);
  assert.strictEqual(K.equilibre(genere.plateau).score, genere.score);
});

test('générateur : les pièces personnelles du document sont reportées, non posées, et une note le dit', () => {
  const doc = ajouter(avecCrete(), DUO());
  const sans = G.generer(3), avec = G.generer(3, { modeles: P.modeles(doc) });
  assert.ok(avec.ok, avec.raison);
  assert.ok(!avec.incompatible);
  assert.strictEqual(sans.note, null);
  assert.strictEqual(avec.note, 'Le générateur ne pose que le catalogue de base : 2 pièces personnelles sont conservées dans le plateau, non posées.');
  assert.deepStrictEqual(avec.plateau.modeles, doc.modeles);
  assert.notStrictEqual(avec.plateau.modeles[0], doc.modeles[0]);
  assert.deepStrictEqual(avec.plateau.pieces, sans.plateau.pieces, 'même graine = mêmes pièces posées');
  assert.ok(!('modeles' in sans.plateau));
  assert.strictEqual(avec.score, sans.score);
  assert.ok(avec.plateau.pieces.every((x) => !/^X/.test(x.modele)));
  assert.strictEqual(avec.controles.ok, true);
  assert.ok(avec.controles.resultats.some((x) => x.niveau === 'alerte' && /^Pièces personnelles restantes \(3\) : 2 × Crête, 1 × Duo\.$/.test(x.message)));
  assert.ok(P.valider(copie(avec.plateau)).ok);
  assert.match(G.generer(4, { modeles: [Object.assign({ id: 'X1' }, DUO())] }).note, /1 pièce personnelle est conservée dans le plateau, non posée\./);
  assert.strictEqual(G.generer(3, { modeles: [] }).note, null);
  // Pièces personnelles fautives : échec nommé, qui n'est pas l'incompatibilité de catalogue.
  const fautif = G.generer(3, { modeles: [{ id: 'X1', nom: 'Bourg', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'ville' }, { q: 1, r: 0, terrain: 'plaine' }] }] });
  assert.strictEqual(fautif.ok, false);
  assert.ok(!fautif.incompatible);
  assert.match(fautif.raison, /Pièces personnelles du document invalides : .*jamais de ville/);
});

test('rendu : une pièce personnelle et le modèle M1 se dessinent (faux DOM)', () => {
  // Faux DOM minimal : assez pour dessinModele (éléments SVG, attributs, enfants).
  function Element(nom) { this.nom = nom; this.attributs = {}; this.enfants = []; }
  Element.prototype.setAttribute = function (k, v) { this.attributs[k] = String(v); };
  Element.prototype.appendChild = function (e) { this.enfants.push(e); return e; };
  const tous = (e, nom) => e.enfants.reduce((l, x) => l.concat(tous(x, nom)), e.nom === nom ? [e] : []);
  const avant = globalThis.document;
  globalThis.document = { createElementNS: (ns, nom) => new Element(nom), createElement: (nom) => new Element(nom) };
  try {
    const p = avecCrete();
    const perso = R.dessinModele('X1', { plateau: p, titre: 'Crête' });
    assert.strictEqual(tous(perso, 'polygon').length, 3);
    assert.strictEqual(tous(perso, 'path').filter((x) => x.attributs['stroke-width'] === '5').length, 1, 'contour de monobloc');
    assert.deepStrictEqual(tous(perso, 'pattern').map((x) => x.attributs.id.replace(/^at\d+-/, '')).sort(), ['foret', 'montagne', 'plaine']);
    assert.strictEqual(perso.attributs['aria-label'], 'Crête');
    assert.strictEqual(tous(R.dessinModele('X1'), 'polygon').length, 0, 'sans le document, la pièce personnelle est inconnue');
    const m1 = R.dessinModele('M1');
    assert.strictEqual(tous(m1, 'polygon').length, 1);
    assert.match(tous(m1, 'polygon')[0].attributs.fill, /montagne\)$/);
    assert.strictEqual(tous(R.dessinModele('N1'), 'polygon').length, 7);
  } finally {
    if (avant === undefined) delete globalThis.document; else globalThis.document = avant;
  }
  // La scène lit les cases par le document : la pièce personnelle y figure avec ses terrains.
  const scene = P.cases(poser(avecCrete(), 'X1', 3, 0, 0));
  assert.deepStrictEqual(['3,0', '4,0', '4,1'].map((k) => scene[k].terrain), ['montagne', 'foret', 'plaine']);
  assert.strictEqual(R.cadre(Object.keys(scene), R.PLAT, 0).l > R.cadre(Object.keys(P.cases(P.vierge(1))), R.PLAT, 0).l, true);
});
