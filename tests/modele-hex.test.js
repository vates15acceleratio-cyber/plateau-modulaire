'use strict';
/*
 * Tests du modèle pour le format hexagonal 'hex19' (lot 2, docs/77) : validation des modèles, poses, rotations, raccords morts,
 * jetons sur les sièges, plateau complet. Modèles du catalogue candidat (docs/75) injectés en mémoire (tests/donnees).
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
const M = globalThis.PM.modele;
const GR = globalThis.PM.graphe;
const F = globalThis.PM.geometrie.format('hex19');
/* Catalogue hexagonal candidat (docs/75) au format PM.modele, injecté en mémoire : HC2, HC3, HB1, HK1 (le vrai catalogue vient au lot catalogue). */
const cat = (() => {
const D = 20;
const kase = (id, x, y, type) => ({ id, x, y, diametre: D, type: type || 'deplacement' });
const lien = (id, a, b) => ({ id, a: { case: a }, b: { case: b } });
const port = (id, c, coin) => ({ id, a: { case: c }, b: { coin } });
const raccord = (id, c, cote) => ({ id, a: { case: c }, b: { raccord: { cote, pos: 0 } } });
const rac = (cote) => ({ raccord: { cote, pos: 0 } });

const PORTS_A = () => [port('p5', 'a', 5), port('p0', 'a', 0), port('p1', 'a', 1), raccord('r5', 'a', 5), raccord('r0', 'a', 0)];
const PORTS_B = () => [port('p2', 'b', 2), port('p3', 'b', 3), port('p4', 'b', 4), raccord('r2', 'b', 2), raccord('r3', 'b', 3)];
const CASES_AB = () => [kase('a', 0, -20.7), kase('b', 0, 20.7)];

function catalogue() {
  return [
    { id: 'HC2', nom: 'Deux ponts et traverse', gabarit: 'centrale', grille: 'hex19', exemplaires: 6,
      cases: CASES_AB(), chemins: [].concat(PORTS_A(), PORTS_B()),
      passages: [{ id: 't1', a: rac(1), b: rac(4) }] },
    { id: 'HC3', nom: 'Carrefour', gabarit: 'centrale', grille: 'hex19', exemplaires: 5,
      cases: CASES_AB(), chemins: [].concat(PORTS_A(), PORTS_B()),
      pivots: [{ id: 'v', x: 0, y: 0 }],
      passages: [
        { id: 't1', a: rac(1), b: { pivot: 'v' } }, { id: 't2', a: rac(4), b: { pivot: 'v' } },
        { id: 't3', a: { case: 'a' }, b: { pivot: 'v' } }, { id: 't4', a: { case: 'b' }, b: { pivot: 'v' } }
      ] },
    { id: 'HB1', nom: 'Bord', gabarit: 'bord', grille: 'hex19', exemplaires: 8,
      cases: [kase('a', 0, -30, 'apparition'), kase('p', 0, 20.7)],
      chemins: [raccord('r1', 'a', 1), raccord('r4', 'a', 4), lien('h1', 'a', 'p'),
        port('p2', 'p', 2), port('p3', 'p', 3), port('p4', 'p', 4), raccord('r2', 'p', 2), raccord('r3', 'p', 3)] },
    { id: 'HK1', nom: 'Coin', gabarit: 'coin', grille: 'hex19', exemplaires: 7,
      cases: [kase('a', 10, 0, 'apparition'), kase('p', -22, 0)],
      chemins: [raccord('r3', 'a', 3), raccord('r5', 'a', 5), lien('h1', 'a', 'p'),
        port('p4', 'p', 4), port('p5', 'p', 5), raccord('r4', 'p', 4)] }
  ];
}

/**
 * Plateau complet : document hex19 portant les 4 modèles, les 19 tuiles posées (la fonction `choixCentrale(cellule, index)` donne le
 * modèle et la rotation des 7 intérieures dans l'ordre de PM.geometrie.format('hex19').cellules ; par défaut HC2 / HC3 en alternance,
 * rotation 0), et les villes aux sièges `villes` (défaut : le trèfle).
 */
function plateau(M, options) {
  options = options || {};
  const F = globalThis.PM.geometrie.format('hex19');
  let doc = M.nouveauDocument('hex19');
  catalogue().forEach((m) => { doc = M.ajouterModele(doc, m); });
  let k = 0;
  F.cellules.forEach((c) => {
    if (c.gabarit === 'centrale') {
      const ch = options.choixCentrale ? options.choixCentrale(c, k) : { id: k % 2 ? 'HC3' : 'HC2', rot: 0 };
      doc = M.poserTuile(doc, ch.id, c.col, c.lig, ch.rot);
      k++;
    } else {
      doc = M.poserTuile(doc, c.gabarit === 'bord' ? 'HB1' : 'HK1', c.col, c.lig);
    }
  });
  (options.villes || F.TREFLE).forEach((s) => { doc = M.poserJeton(doc, s, 0, 'capture'); });
  return doc;
}

function alea(graine) {
  let x = graine >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/**
 * Cherche par tirages déterministes (graine fixe) `nb` plateaux complets dont les 6 villes du trèfle sont à 4 pas au moins l'une de l'autre
 * (3 cases d'écart) : 7 intérieures tirées sans remise parmi 6 HC2 et 5 HC3, rotations 0 à 2 (HC2 et HC3 ont un demi-tour pour symétrie).
 * Environ 1 tirage sur 100 convient. Renvoie { plateaux: [{ doc, g }], tirages }.
 */
function plateauxBons(M, GR, nb, graine) {
  const rnd = alea(graine || 2026), plateaux = [];
  let tirages = 0;
  while (plateaux.length < nb && tirages < 20000) {
    tirages++;
    const stock = ['HC2', 'HC2', 'HC2', 'HC2', 'HC2', 'HC2', 'HC3', 'HC3', 'HC3', 'HC3', 'HC3'];
    const doc = plateau(M, { choixCentrale: () => ({ id: stock.splice(Math.floor(rnd() * stock.length), 1)[0], rot: Math.floor(rnd() * 3) }) });
    const g = GR.construire(doc);
    if (!GR.villesProches(g).length) plateaux.push({ doc, g });
  }
  return { plateaux, tirages };
}

return { catalogue, plateau, plateauxBons, alea };
})();

const copie = (o) => JSON.parse(JSON.stringify(o));
const modele = (id) => copie(cat.catalogue().find((m) => m.id === id));
const codes = (m) => M.validerModele(m, 'hex19').erreurs.map((e) => e.code);
const alertes = (m) => M.validerModele(m, 'hex19').alertes.map((e) => e.code);
const kase = (id, x, y, type) => ({ id, x, y, diametre: 20, type: type || 'deplacement' });
const port = (id, c, coin) => ({ id, a: { case: c }, b: { coin } });
const raccord = (id, c, cote) => ({ id, a: { case: c }, b: { raccord: { cote, pos: 0 } } });

function docVide() {
  let doc = M.nouveauDocument('hex19');
  cat.catalogue().forEach((m) => { doc = M.ajouterModele(doc, m); });
  return doc;
}

test('nouveauDocument(hex19) : grille, 19 cellules, 24 sièges, aucun jeton', () => {
  const doc = M.nouveauDocument('hex19');
  assert.strictEqual(doc.grille, 'hex19');
  assert.deepStrictEqual(doc.plateau, { tuiles: [], jetons: [] });
  assert.strictEqual(M.formatDuDocument(doc).cellules.length, 19);
  assert.strictEqual(M.formatDuDocument(doc).sieges.length, 24);
  assert.strictEqual(M.NB_VILLES_HEX, 6);
});

test('exemples hexagonaux et modèles du catalogue candidat : aucune erreur, aucune alerte', () => {
  M.copieExemples('hex19').forEach((m) => {
    const r = M.validerModele(m, 'hex19');
    assert.deepStrictEqual([r.erreurs, r.alertes], [[], []], m.id);
  });
  cat.catalogue().forEach((m) => {
    const r = M.validerModele(m, 'hex19');
    assert.deepStrictEqual([m.id, r.erreurs, r.alertes], [m.id, [], []]);
  });
});

test('masques hexagonaux : 6 bits, raccords et ports', () => {
  const mm = M.masquesDuModele(modele('HC2'), 'hex19');
  assert.strictEqual(mm.raccords, 0b111111); // côtés 5, 0, 2, 3 par chemins, 1 et 4 par le passage
  assert.strictEqual(mm.portsCoin, 0b111111);
  const hb = M.masquesDuModele(modele('HB1'), 'hex19');
  assert.strictEqual(hb.raccords, (1 << 1) | (1 << 4) | (1 << 2) | (1 << 3));
  assert.strictEqual(hb.portsCoin, (1 << 2) | (1 << 3) | (1 << 4));
});

test('règles hexagonales : raccord et coin hors format, pos non nul', () => {
  let m = modele('HB1'); m.chemins[0].b.raccord.cote = 6;
  assert.ok(codes(m).includes('chemin_invalide'));
  m = modele('HB1'); m.chemins[0].b.raccord.pos = 1;
  assert.ok(codes(m).includes('chemin_invalide'));
  m = modele('HB1'); m.chemins.find((c) => c.id === 'p2').b.coin = 6;
  assert.ok(codes(m).includes('chemin_invalide'));
});

test('H1 : 3 ports consécutifs permis (même autour du coin 5 / 0), 4 ports ou ports non consécutifs en alerte', () => {
  const base = () => ({ id: 'X', gabarit: 'centrale', exemplaires: 1, cases: [kase('a', 0, -20.7), kase('b', 0, 20.7)], chemins: [] });
  let m = base(); m.chemins = [port('p4', 'a', 4), port('p5', 'a', 5), port('p0', 'a', 0), port('q2', 'b', 2), port('q3', 'b', 3), port('q1', 'b', 1)];
  assert.ok(!alertes(m).includes('ports_case'));
  m = base(); m.chemins = [port('p5', 'a', 5), port('p0', 'a', 0), port('p1', 'a', 1), port('p2', 'a', 2), port('q3', 'b', 3)];
  assert.ok(alertes(m).includes('ports_case'), '4 ports');
  m = base(); m.chemins = [port('p0', 'a', 0), port('p2', 'a', 2), port('q3', 'b', 3)];
  assert.ok(alertes(m).includes('ports_case'), 'non consécutifs');
});

test('H2 : un coin intérieur sans port donne l’alerte coin_non_porte', () => {
  const m = modele('HC2'); m.chemins = m.chemins.filter((c) => c.id !== 'p1');
  assert.ok(alertes(m).includes('coin_non_porte'));
});

test('R4 : port sur l’apparition ; R2 : deux porteuses reliées ; pas d’alerte raccord_porteuse en hexagonal', () => {
  let m = modele('HB1'); m.chemins.push(port('px', 'a', 3));
  assert.ok(alertes(m).includes('port_apparition'));
  m = modele('HC2'); m.chemins.push({ id: 'pont', a: { case: 'a' }, b: { case: 'b' } });
  assert.ok(alertes(m).includes('porteuses_reliees'));
  assert.ok(!alertes(modele('HC2')).includes('raccord_porteuse'), 'raccords sur porteuses permis');
});

test('passages traversants et sur porteuses permis ; pivot de 4 branches permis, de 5 refusé', () => {
  assert.deepStrictEqual(alertes(modele('HC2')), []);
  const hc3 = modele('HC3');
  assert.deepStrictEqual([codes(hc3), alertes(hc3)], [[], []]);
  hc3.passages.push({ id: 't5', a: rac(2), b: { pivot: 'v' } });
  assert.ok(codes(hc3).includes('pivot_degre'));
  function rac(c) { return { raccord: { cote: c, pos: 0 } }; }
});

test('marge de 4 mm sur la forme : hexagone pour une centrale, pentagone pour un bord', () => {
  const centrale = { id: 'Y', gabarit: 'centrale', exemplaires: 1, cases: [kase('a', 0, -40), kase('b', 0, 20.7)], chemins: [raccord('r', 'a', 1), raccord('s', 'b', 3)] };
  assert.ok(codes(centrale).includes('hors_tuile'));
  const bord = copie(centrale); bord.gabarit = 'bord'; bord.cases[0].x = 0; bord.cases[0].y = -38;
  assert.ok(!codes(bord).includes('hors_tuile'), 'le bord droit du pentagone est à y = -54');
  bord.cases[0].y = -44;
  assert.ok(codes(bord).includes('hors_tuile'));
  const dehors = copie(centrale); dehors.cases[0].x = 60; dehors.cases[0].y = 0;
  assert.ok(codes(dehors).includes('hors_tuile'), 'case hors de la forme');
});

test('zone de coin, chevauchement, case isolée, chemin sur une case', () => {
  const m = { id: 'Z', gabarit: 'centrale', exemplaires: 1, cases: [kase('a', 0, -30), kase('b', 0, 20.7)], chemins: [raccord('r', 'a', 1), raccord('s', 'b', 3)] };
  assert.ok(codes(m).includes('zone_coin'), 'case à moins de 30 mm du coin N');
  const c = { id: 'C', gabarit: 'centrale', exemplaires: 1, cases: [kase('a', 0, -5), kase('b', 0, 5)], chemins: [raccord('r', 'a', 1)] };
  assert.ok(codes(c).includes('chevauchement') && codes(c).includes('case_isolee'));
  const d = modele('HC2'); d.passages = [{ id: 't1', a: { raccord: { cote: 2, pos: 0 } }, b: { raccord: { cote: 5, pos: 0 } } }];
  assert.ok(codes(d).includes('raccord_double'), 'un raccord pris par un chemin et un passage est refusé');
});

test('raccord extérieur et port extérieur du gabarit hexagonal', () => {
  const m = modele('HB1'); m.chemins.push(raccord('rx', 'p', 0)); m.chemins.push(port('px', 'p', 1));
  const a = alertes(m);
  assert.ok(a.includes('raccord_exterieur') && a.includes('port_exterieur'));
});

test('murs hexagonaux : côtés 0 à 5, un côté avec raccord n’est pas un mur', () => {
  const m = { id: 'W', exemplaires: 1, murs: [0, 5, 6, 3.5], cases: [kase('a', 0, 0)], chemins: [raccord('r', 'a', 0)] };
  assert.strictEqual(M.mursDuModele(m, 'hex19'), 1 << 5);
});

test('dénombrements des poses : 7 intérieures, 6 bords, 6 coins', () => {
  const doc = docVide();
  const ok = { HC2: 0, HC3: 0, HB1: 0, HK1: 0 };
  F.cellules.forEach((c) => {
    ['HC2', 'HC3', 'HB1', 'HK1'].forEach((id) => { if (M.peutPoserTuile(doc, id, c.col, c.lig).ok) ok[id]++; });
  });
  assert.deepStrictEqual(ok, { HC2: 7, HC3: 7, HB1: 6, HK1: 6 });
  assert.strictEqual(M.peutPoserTuile(doc, 'HC2', 0, 0).ok, false); // hors des 19 cellules
  assert.strictEqual(M.peutPoserTuile(doc, 'HC2', 5, 2).ok, false);
  assert.match(M.peutPoserTuile(doc, 'HB1', 2, 2).raison, /bord/);
  assert.match(M.peutPoserTuile(doc, 'HK1', 3, 0).raison, /coin/);
  assert.match(M.peutPoserTuile(doc, 'HC2', 3, 0).raison, /centrale/);
  assert.strictEqual(M.peutPoserTuile(doc, 'inconnu', 2, 2).ok, false);
});

test('rotations : imposée suggérée au pourtour, libre par 60° à l’intérieur', () => {
  let doc = docVide();
  F.cellules.forEach((c) => {
    const id = c.gabarit === 'bord' ? 'HB1' : (c.gabarit === 'coin' ? 'HK1' : 'HC2');
    const t = M.peutPoserTuile(doc, id, c.col, c.lig);
    assert.strictEqual(t.rot, c.gabarit === 'centrale' ? 0 : c.rotation, c.cle);
  });
  doc = M.poserTuile(doc, 'HC2', 2, 2, 4);
  assert.strictEqual(M.tuileEn(doc, 2, 2).rot, 4);
  assert.strictEqual(M.poserTuile(docVide(), 'HC2', 2, 2, 8).plateau.tuiles[0].rot, 2);
  assert.strictEqual(M.poserTuile(docVide(), 'HC2', 2, 2, -1).plateau.tuiles[0].rot, 5);
  assert.strictEqual(M.tournerTuile(doc, 2, 2, 2).plateau.tuiles[0].rot, 0);
  assert.strictEqual(M.tournerTuile(doc, 2, 2, -5).plateau.tuiles[0].rot, 5);
  let t = doc; for (let i = 0; i < 6; i++) t = M.tournerTuile(t, 2, 2);
  assert.strictEqual(M.tuileEn(t, 2, 2).rot, 4);
  assert.throws(() => M.poserTuile(doc, 'HC2', 2, 2), /occup/);
  assert.throws(() => M.poserTuile(docVide(), 'HC2', 2, 2, 1.5), /entier/);
  // rotation invalide en fichier, et rotation du pourtour non imposée
  const d2 = copie(M.poserTuile(docVide(), 'HC2', 2, 2)); d2.plateau.tuiles[0].rot = 6;
  assert.ok(M.validerPlateau(d2).erreurs.some((e) => e.code === 'rot_invalide'));
  const d3 = M.poserTuile(docVide(), 'HB1', 3, 0, 1);
  assert.ok(M.validerPlateau(d3).alertes.some((e) => e.code === 'rotation_pourtour'));
  assert.ok(!M.validerPlateau(M.poserTuile(docVide(), 'HB1', 3, 0)).alertes.some((e) => e.code === 'rotation_pourtour'));
});

test('masques d’une tuile posée tournée et ports par siège', () => {
  let doc = M.poserTuile(docVide(), 'HB1', 3, 0); // rotation imposée 0
  const mp = M.masquesTuilePosee(doc, doc.plateau.tuiles[0]);
  assert.strictEqual(mp.portsCoin, (1 << 2) | (1 << 3) | (1 << 4));
  doc = M.tournerTuile(doc, 3, 0, 1);
  assert.strictEqual(M.masquesTuilePosee(doc, doc.plateau.tuiles[0]).portsCoin, (1 << 3) | (1 << 4) | (1 << 5));
  const doc2 = cat.plateau(M);
  F.sieges.forEach((s) => assert.deepStrictEqual(M.portsJonction(doc2, s.id, 0), { ports: 3, tuiles: 3 }, 'siège ' + s.id));
  assert.deepStrictEqual(M.portsJonction(docVide(), 0, 0), { ports: 0, tuiles: 0 });
});

test('raccords morts : vide, mort, mur voulu, absent', () => {
  let doc = docVide();
  doc = M.ajouterModele(doc, { id: 'X', exemplaires: 1, cases: [kase('a', 0, 0)], chemins: [raccord('r', 'a', 0)] });
  doc = M.ajouterModele(doc, { id: 'XM', exemplaires: 1, murs: [5], cases: [kase('a', 0, 0)], chemins: [raccord('r', 'a', 0)] });
  // HB1 (3,0) rot 0 : raccords 1, 2, 3, 4 ; X en (3,1) rot 0 n’a que le côté 0 : le raccord 2 de HB1 est mort
  let d = M.poserTuile(M.poserTuile(doc, 'HB1', 3, 0), 'X', 3, 1, 0);
  let morts = M.raccordsMorts(d).filter((r) => r.col === 3 && r.lig === 0 && r.cote === 2);
  assert.deepStrictEqual(morts.map((r) => [r.raison, r.mur]), [['mort', false]]);
  assert.ok(M.validerPlateau(d).alertes.some((a) => a.code === 'raccord_mort'));
  // mur voulu côté 5 de XM : information raccord_mur
  d = M.poserTuile(M.poserTuile(doc, 'HB1', 3, 0), 'XM', 3, 1, 0);
  morts = M.raccordsMorts(d).filter((r) => r.col === 3 && r.lig === 0 && r.cote === 2);
  assert.deepStrictEqual(morts.map((r) => [r.raison, r.mur]), [['mort', true]]);
  assert.ok(M.validerPlateau(d).informations.some((a) => a.code === 'raccord_mur'));
  // HB1 mal tournée : un raccord face au vide
  d = M.poserTuile(doc, 'HB1', 3, 0, 1);
  assert.ok(M.raccordsMorts(d).some((r) => r.raison === 'vide'));
  assert.ok(M.validerPlateau(d).alertes.some((a) => a.code === 'raccord_mort' && /vide/.test(a.message)));
  // voisine pas encore posée
  assert.ok(M.raccordsMorts(M.poserTuile(doc, 'HB1', 3, 0)).some((r) => r.raison === 'absent'));
});

test('raccords morts : 0 avec HC2 et HC3 quelles que soient les rotations des intérieures', () => {
  const rnd = cat.alea(7);
  for (let i = 0; i < 60; i++) {
    const doc = cat.plateau(M, { choixCentrale: (c, k) => ({ id: rnd() < 0.5 ? 'HC2' : 'HC3', rot: Math.floor(rnd() * 6) }) });
    assert.strictEqual(M.raccordsMorts(doc).filter((r) => r.raison !== 'absent').length, 0);
  }
});

test('jetons sur les sièges : trois tuiles requises, doublons, hors format, retrait de tuile', () => {
  const doc = docVide();
  assert.strictEqual(M.peutPoserJeton(doc, 0, 0).ok, false);
  assert.match(M.peutPoserJeton(doc, 0, 0).raison, /3 tuiles/);
  assert.strictEqual(M.peutPoserJeton(doc, 24, 0).ok, false);
  assert.strictEqual(M.peutPoserJeton(doc, 0, 1).ok, false);
  const plein = cat.plateau(M);
  assert.strictEqual(plein.plateau.jetons.length, 6);
  assert.strictEqual(M.peutPoserJeton(plein, 0, 0).raison, 'Cette jonction a déjà une ville.');
  assert.strictEqual(M.peutPoserJeton(plein, 1, 0).ok, true);
  assert.deepStrictEqual(M.jetonsInvalides(plein), []);
  assert.strictEqual(M.cyclerJeton(plein, 0, 0).plateau.jetons.length, 5);
  assert.strictEqual(M.cyclerJeton(plein, 1, 0).plateau.jetons.length, 7);
  const apres = M.retirerTuile(plein, 2, 0); // le coin NO touche les sièges 0, 2...
  assert.ok(apres.plateau.jetons.length < 6);
  assert.deepStrictEqual(M.jonctionDuCoin(2, 0, 2, F), { i: 0, j: 0 });
  assert.deepStrictEqual(M.jonctionDuCoin(2, 0, 0, F), { i: null, j: null });
});

test('plateau complet sans erreur ni alerte ; plus de 6 villes est une erreur', () => {
  let doc = cat.plateau(M);
  let v = M.validerPlateau(doc);
  assert.deepStrictEqual([v.erreurs.length, v.alertes.length, v.informations.length], [0, 0, 0]);
  assert.deepStrictEqual(M.portsVersPourtour(doc), []);
  assert.deepStrictEqual(M.jonctionsMalReliees(doc), []);
  doc = M.poserJeton(doc, 1, 0);
  v = M.validerPlateau(doc);
  assert.deepStrictEqual(v.erreurs.map((e) => e.code), ['trop_de_villes']);
  assert.deepStrictEqual(v.erreurs[0].ref, { type: 'jeton', i: 1, j: 0 });
});

test('jonction mal reliée et ports vers le pourtour', () => {
  let doc = docVide();
  doc = M.ajouterModele(doc, { id: 'N', exemplaires: 1, cases: [kase('a', 0, 0)], chemins: [raccord('r', 'a', 0)] });
  const sg = F.sieges.find((s) => s.tuiles.every((t) => F.cellule(t.col, t.lig).gabarit === 'centrale'));
  sg.tuiles.forEach((t) => { doc = M.poserTuile(doc, 'N', t.col, t.lig, 0); });
  const mal = M.jonctionsMalReliees(doc);
  assert.deepStrictEqual(mal, [{ i: sg.id, j: 0, ports: 0 }]);
  assert.ok(M.validerPlateau(doc).alertes.some((a) => a.code === 'jonction_ports' && /siège/.test(a.message)));
  const hk = M.poserTuile(docVide(), 'HK1', 2, 0, 0); // coin mal tourné : un port vers le pourtour
  assert.ok(M.portsVersPourtour(hk).length > 0);
});

test('tuileEnPlateau : cases en mm autour du centre de la cellule, ports vers les sièges', () => {
  let doc = M.poserTuile(docVide(), 'HC2', 2, 2, 0);
  let e = M.tuileEnPlateau(doc, doc.plateau.tuiles[0]);
  const a = e.cases.find((c) => c.id === '2,2:a');
  assert.ok(Math.abs(a.x) < 1e-6 && Math.abs(a.y + 20.7) < 1e-6);
  assert.strictEqual(e.ports.length, 6);
  assert.deepStrictEqual(e.ports.map((p) => p.j), [0, 0, 0, 0, 0, 0]);
  assert.strictEqual(new Set(e.ports.map((p) => p.i)).size, 6);
  doc = M.tournerTuile(doc, 2, 2, 3);
  e = M.tuileEnPlateau(doc, doc.plateau.tuiles[0]);
  const a3 = e.cases.find((c) => c.id === '2,2:a');
  assert.ok(Math.abs(a3.y - 20.7) < 1e-6);
  // une tuile dans une cellule qui n’existe pas : ignorée
  const bad = copie(doc); bad.plateau.tuiles[0].col = 0; bad.plateau.tuiles[0].lig = 0;
  assert.strictEqual(M.tuileEnPlateau(bad, bad.plateau.tuiles[0]), null);
  // passages en mm plateau
  assert.strictEqual(e.passages.length, 1);
  assert.ok(Array.isArray(e.passages[0].pts) && e.passages[0].pts.length > 1);
});

test('formats carrés inchangés par les ajouts', () => {
  const d = M.nouveauDocument('4x4');
  assert.strictEqual(d.grille, '4x4');
  assert.strictEqual(M.gabaritCellule(0, 0, '4x4'), 'coin');
  assert.strictEqual(M.gabaritCellule(1, 1, '5x5'), 'centrale');
  assert.strictEqual(M.masquesDuModele(M.copieExemples()[0]).raccords > 0, true);
  assert.strictEqual(M.copieExemples('5x5').length, 3);
});
