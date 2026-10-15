'use strict';
/*
 * Recette indépendante du module 1 (geometrie.js, modele.js).
 * Référence : docs/2-avis-geometrie.md (D3, D4, D5, D8, D9, D10), docs/3-synthese.md,
 * docs/4-architecture.md. Les oracles ci-dessous sont recalculés à partir de la doc
 * (côtés exposés, points géométriques), pas à partir du code testé.
 * Les tests marqués { todo: 'BUG: ...' } révèlent un défaut connu : ils ne font pas échouer la suite.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */
const copie = (o) => JSON.parse(JSON.stringify(o));
function gel(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(gel);
  }
  return o;
}
const exemple = (role) => copie(M.exemples.find((m) => m.role === role));
const codes = (modele) => M.validerModele(modele).erreurs.map((e) => e.code);
const ID = { centrale: 'ex-centrale', coin: 'ex-coin', bord: 'ex-bord', apparition: 'ex-apparition' };
const DIR = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S O

function forme(retires) { return { retires: retires.map(([col, lig]) => ({ col, lig })) }; }
function docForme(retires, exemplaires) {
  const doc = M.nouveauDocument();
  doc.modeles = copie(M.exemples);
  doc.modeles.forEach((m) => { m.exemplaires = exemplaires === undefined ? 16 : exemplaires; });
  doc.plateau.forme = forme(retires);
  return doc;
}

/* Oracle de forme (indépendant de modele.js) */
function exposes(col, lig, ret) {
  const res = [];
  DIR.forEach(([dc, dl], c) => {
    const vc = col + dc, vl = lig + dl;
    if (vc < 0 || vc > 3 || vl < 0 || vl > 3 || ret.some((r) => r[0] === vc && r[1] === vl)) res.push(c);
  });
  return res;
}
function oracleRole(col, lig, ret) {
  if ((lig === 0 || lig === 3) && (col === 1 || col === 2)) return 'apparition';
  const n = exposes(col, lig, ret).length;
  return ['centrale', 'bord', 'coin'][n];
}
function oracleRot(col, lig, ret) {
  const role = oracleRole(col, lig, ret), ex = exposes(col, lig, ret);
  if (role === 'centrale') return null;
  if (role === 'apparition') return lig === 0 ? 0 : 2;
  if (role === 'bord') return ex[0];
  for (let r = 0; r < 4; r++) {
    const s = [r, (r + 3) % 4].sort();
    if (s[0] === ex[0] && s[1] === ex[1]) return r;
  }
  throw new Error('oracle coin');
}
/** Coins (0..3) qui portent un port : ceux dont aucun des deux côtés adjacents n'est exposé / extérieur. */
function oraclePorts(col, lig, ret) {
  const role = oracleRole(col, lig, ret);
  if (role === 'centrale') return [0, 1, 2, 3];
  const ext = role === 'apparition' ? [lig === 0 ? 0 : 2] : exposes(col, lig, ret);
  return [0, 1, 2, 3].filter((k) => !ext.includes((k + 3) % 4) && !ext.includes(k));
}
const maskPorts = (l) => l.reduce((a, k) => a | (1 << k), 0);

const COINS = [[0, 0], [3, 0], [0, 3], [3, 3]];
const FORMES_VALIDES = [[]];
COINS.forEach((c) => FORMES_VALIDES.push([c]));
for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) FORMES_VALIDES.push([COINS[i], COINS[j]]);
[[[0, 0], [0, 1]], [[0, 3], [0, 2]], [[3, 0], [3, 1]], [[3, 3], [3, 2]]].forEach((f) => FORMES_VALIDES.push(f));
const nomForme = (r) => (r.length ? r.map((c) => '(' + c + ')').join('+') : 'complet');

function remplir(doc) {
  const ret = doc.plateau.forme.retires.map((r) => [r.col, r.lig]);
  for (let lig = 0; lig < 4; lig++) {
    for (let col = 0; col < 4; col++) {
      if (ret.some((r) => r[0] === col && r[1] === lig)) continue;
      doc = M.poserTuile(doc, ID[oracleRole(col, lig, ret)], col, lig);
    }
  }
  return doc;
}
function complet() { return remplir(docForme([])); }
function jonctionsToutes() { const r = []; for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) r.push([i, j]); return r; }

/* ------------------------------------------------------------------ */
/* 1. Formes valides : rôles, rotations, ports                         */
/* ------------------------------------------------------------------ */
for (const ret of FORMES_VALIDES) {
  test('forme valide ' + nomForme(ret) + ' : rôles, rotations, ports, apparitions', () => {
    const f = forme(ret);
    assert.deepEqual(M.validerForme(f), { valide: true, erreurs: [] });
    const actives = M.cellulesActives(f);
    assert.equal(actives.length, 16 - ret.length);
    let nbApp = 0;
    for (const { col, lig } of actives) {
      const role = M.roleCellule(col, lig, f);
      assert.notEqual(role, null, 'rôle impossible en (' + col + ',' + lig + ')');
      assert.equal(role, oracleRole(col, lig, ret), 'rôle en (' + col + ',' + lig + ')');
      assert.equal(M.rotationDeduite(col, lig, f), oracleRot(col, lig, ret), 'rotation en (' + col + ',' + lig + ')');
      if (role === 'apparition') {
        nbApp++;
        assert.equal(M.joueurCellule(col, lig), lig === 0 ? 1 : 2);
      } else {
        assert.equal(M.joueurCellule(col, lig), null);
      }
    }
    assert.equal(nbApp, 4, 'les 4 apparitions restent en place');
    for (const [c, l] of ret) {
      assert.equal(M.roleCellule(c, l, f), null);
      assert.equal(M.rotationDeduite(c, l, f), null);
    }
  });

  test('forme valide ' + nomForme(ret) + ' : tuiles posées, masques, jonctions', () => {
    const doc = remplir(docForme(ret));
    assert.equal(doc.plateau.tuiles.length, 16 - ret.length);
    for (const t of doc.plateau.tuiles) {
      const role = oracleRole(t.col, t.lig, ret);
      const rotO = oracleRot(t.col, t.lig, ret);
      assert.equal(t.rot, rotO === null ? 0 : rotO);
      const mm = M.masquesDuModele(M.modeleParId(doc, t.modeleId));
      const raccords = G.tournerRaccords(mm.raccords, t.rot);
      const ports = G.tournerPorts(mm.portsCoin, t.rot);
      assert.equal(ports, maskPorts(oraclePorts(t.col, t.lig, ret)), 'ports ' + t.col + ',' + t.lig + ' (' + role + ')');
      if (role === 'coin' || role === 'bord') {
        for (const c of exposes(t.col, t.lig, ret)) {
          assert.equal(G.triplet(raccords, c), 0, 'raccord sur côté exposé ' + c + ' de (' + t.col + ',' + t.lig + ')');
        }
      }
      if (role === 'apparition') assert.equal(G.triplet(raccords, t.lig === 0 ? 0 : 2), 0);
    }
    // jonctions : nombre de tuiles et de ports recalculés
    let valides = 0;
    for (const [i, j] of jonctionsToutes()) {
      const autour = [[i - 1, j - 1, 2], [i, j - 1, 3], [i - 1, j, 1], [i, j, 0]]
        .filter(([c, l]) => !ret.some((r) => r[0] === c && r[1] === l));
      const portsAttendus = autour.filter(([c, l, k]) => oraclePorts(c, l, ret).includes(k)).length;
      assert.deepEqual(M.portsJonction(doc, i, j), { ports: portsAttendus, tuiles: autour.length }, 'jonction ' + i + ',' + j);
      const ok = M.peutPoserJeton(doc, i, j).ok;
      assert.equal(ok, autour.length === 4 && portsAttendus >= 2);
      if (ok) valides++;
    }
    assert.ok(valides >= 7, 'au moins 7 jonctions utilisables (D9), obtenu ' + valides);
    // jonction à 3 tuiles : refusée
    for (const [i, j] of jonctionsToutes()) {
      if (M.portsJonction(doc, i, j).tuiles === 3) assert.equal(M.peutPoserJeton(doc, i, j).ok, false);
    }
  });

  test('forme valide ' + nomForme(ret) + ' : rôle refusé / accepté à la pose', () => {
    const doc = docForme(ret);
    for (const { col, lig } of M.cellulesActives(doc.plateau.forme)) {
      const bon = oracleRole(col, lig, ret);
      for (const role of Object.keys(ID)) {
        assert.equal(M.peutPoserTuile(doc, ID[role], col, lig).ok, role === bon, role + ' en (' + col + ',' + lig + ')');
      }
    }
    for (const [c, l] of ret) assert.equal(M.peutPoserTuile(doc, ID.coin, c, l).ok, false);
  });
}

test('T4 : sans (0,0), (1,1) a 3 tuiles et 2 ports, jeton refusé pour 4 tuiles', () => {
  const doc = remplir(docForme([[0, 0]]));
  assert.deepEqual(M.portsJonction(doc, 1, 1), { ports: 2, tuiles: 3 });
  const r = M.peutPoserJeton(doc, 1, 1);
  assert.equal(r.ok, false);
  assert.match(r.raison, /4 tuiles/);
});

/* ------------------------------------------------------------------ */
/* 2. Formes invalides                                                 */
/* ------------------------------------------------------------------ */
const FORMES_INVALIDES = {
  'bord seul ouest (0,1)': [[[0, 1]], 'bord_seul'],
  'bord seul est (3,2)': [[[3, 2]], 'bord_seul'],
  'coin + bord non voisin (0,0)+(0,2)': [[[0, 0], [0, 2]], 'bord_seul'],
  'coin + bord de l autre colonne (0,0)+(3,1)': [[[0, 0], [3, 1]], 'bord_seul'],
  'bord + coin de l autre extrémité (3,0)+(0,1)': [[[3, 0], [0, 1]], 'bord_seul'],
  'centrale retirée (1,1)': [[[1, 1]], 'cellule_interieure'], // arbitrage 2026-10-16 (revue, point 12)
  'apparition nord retirée (1,0)': [[[1, 0]], 'apparition_retiree'],
  'apparition sud retirée (2,3)': [[[2, 3]], 'apparition_retiree'],
  'coin + apparition (0,0)+(1,0)': [[[0, 0], [1, 0]], 'apparition_retiree'],
  '3 coins': [[[0, 0], [3, 0], [0, 3]], 'trop_de_retraits'],
  '4 coins': [[[0, 0], [3, 0], [0, 3], [3, 3]], 'trop_de_retraits'],
  'coin + bord + coin': [[[0, 0], [0, 1], [3, 3]], 'trop_de_retraits'],
  'doublon (0,0)x2': [[[0, 0], [0, 0]], 'doublon'],
  'hors grille col 4': [[[4, 0]], 'hors_grille'],
  'hors grille col -1': [[[-1, 0]], 'hors_grille'],
  'hors grille lig 4': [[[0, 4]], 'hors_grille'],
  'non entier': [[[1.5, 0]], 'hors_grille']
};
for (const [nom, [ret, code]] of Object.entries(FORMES_INVALIDES)) {
  test('forme invalide : ' + nom, () => {
    const r = M.validerForme(forme(ret));
    assert.equal(r.valide, false);
    assert.ok(r.erreurs.some((e) => e.code === code), 'code ' + code + ' attendu, obtenu ' + JSON.stringify(r.erreurs));
  });
}
test('forme absente / vide / sans retires : valide', () => {
  assert.equal(M.validerForme(undefined).valide, true);
  assert.equal(M.validerForme(null).valide, true);
  assert.equal(M.validerForme({}).valide, true);
  assert.equal(M.validerForme({ retires: [] }).valide, true);
});
test('bord seul : une cellule voisine (coin) ne reçoit aucun rôle, pose refusée', () => {
  const doc = docForme([[0, 1]]);
  assert.equal(M.roleCellule(0, 0, doc.plateau.forme), null);
  for (const id of Object.values(ID)) assert.equal(M.peutPoserTuile(doc, id, 0, 0).ok, false);
});
test('validerForme : entrées malformées sans exception', () => {
  for (const f of [{ retires: [null] }, { retires: [undefined] }, { retires: [{}] }, { retires: [{ col: 'a', lig: 'b' }] }, { retires: [5] }]) {
    assert.doesNotThrow(() => M.validerForme(f), JSON.stringify(f));
    assert.equal(M.validerForme(f).valide, false, JSON.stringify(f));
  }
});
test('hors grille et retiré : rôle null, pose refusée', () => {
  const doc = docForme([[0, 0]]);
  for (const [c, l] of [[-1, 0], [4, 4], [0, -1], [1.5, 1], [NaN, 0], ['0', '0'], [undefined, undefined]]) {
    assert.equal(M.roleCellule(c, l, doc.plateau.forme), null, c + ',' + l);
    assert.equal(M.peutPoserTuile(doc, ID.centrale, c, l).ok, false);
  }
});

/* ------------------------------------------------------------------ */
/* 3. Stock d'exemplaires                                              */
/* ------------------------------------------------------------------ */
test('stock : poses et retraits successifs, refus à épuisement', () => {
  let doc = docForme([], 2);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 2);
  doc = M.poserTuile(doc, ID.centrale, 1, 1);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 1);
  doc = M.poserTuile(doc, ID.centrale, 2, 1);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 0);
  const r = M.peutPoserTuile(doc, ID.centrale, 1, 2);
  assert.equal(r.ok, false);
  assert.match(r.raison, /exemplaire/);
  assert.throws(() => M.poserTuile(doc, ID.centrale, 1, 2), /exemplaire/);
  // les autres modèles ne sont pas affectés
  assert.equal(M.exemplairesRestants(doc, ID.coin), 2);
  doc = M.retirerTuile(doc, 1, 1);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 1);
  doc = M.poserTuile(doc, ID.centrale, 1, 2);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 0);
  doc = M.retirerTuile(doc, 1, 2);
  doc = M.retirerTuile(doc, 2, 1);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 2);
  // retirer une cellule vide ne change pas le stock
  doc = M.retirerTuile(doc, 2, 2);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 2);
});
test('stock : exemplaires 0, modèle inconnu', () => {
  const doc = docForme([], 0);
  assert.equal(M.peutPoserTuile(doc, ID.centrale, 1, 1).ok, false);
  assert.equal(M.exemplairesRestants(doc, 'inconnu'), 0);
  assert.equal(M.peutPoserTuile(doc, 'inconnu', 1, 1).ok, false);
  assert.throws(() => M.poserTuile(doc, 'inconnu', 1, 1));
});
test('stock : cellule occupée, tuile non posée si refus', () => {
  let doc = docForme([], 4);
  doc = M.poserTuile(doc, ID.centrale, 1, 1);
  assert.throws(() => M.poserTuile(doc, ID.centrale, 1, 1), /occup/);
  assert.equal(M.exemplairesRestants(doc, ID.centrale), 3);
});
test('stock : plateau complet avec exactement 4 exemplaires par rôle', () => {
  const doc = remplir(docForme([], 4));
  for (const id of Object.values(ID)) assert.equal(M.exemplairesRestants(doc, id), 0);
  assert.equal(doc.plateau.tuiles.length, 16);
});
test('stock : modèle incomplet refusé', () => {
  const doc = docForme([], 4);
  doc.modeles.find((m) => m.id === ID.centrale).chemins.pop();
  doc.modeles.find((m) => m.id === ID.centrale).chemins.pop();
  doc.modeles.find((m) => m.id === ID.centrale).chemins.pop();
  assert.equal(M.peutPoserTuile(doc, ID.centrale, 1, 1).ok, false);
});
test('stock : exemplaires réduits après pose => restants négatif (documenté comme revalidation à prévoir)', () => {
  let doc = docForme([], 4);
  doc = M.poserTuile(doc, ID.centrale, 1, 1);
  doc = M.poserTuile(doc, ID.centrale, 2, 1);
  doc.modeles.find((m) => m.id === ID.centrale).exemplaires = 1;
  assert.equal(M.exemplairesRestants(doc, ID.centrale), -1);
  assert.equal(M.peutPoserTuile(doc, ID.centrale, 1, 2).ok, false);
});

/* ------------------------------------------------------------------ */
/* 4. Pureté                                                           */
/* ------------------------------------------------------------------ */
function docRiche() {
  let doc = complet();
  doc = M.poserJeton(doc, 1, 1, 'capture');
  doc = M.poserJeton(doc, 2, 2, 'carrefour');
  doc = M.poserJeton(doc, 3, 3, 'capture');
  return doc;
}
const OPERATIONS = {
  poserTuile: (d) => M.poserTuile(d, ID.coin, 0, 0),
  'poserTuile (centrale)': (d) => M.poserTuile(d, ID.centrale, 2, 2),
  retirerTuile: (d) => M.retirerTuile(d, 1, 1),
  'retirerTuile (cellule vide)': (d) => M.retirerTuile(d, 9, 9),
  tournerTuile: (d) => M.tournerTuile(d, 1, 1, 1),
  'tournerTuile (défaut)': (d) => M.tournerTuile(d, 2, 2),
  'tournerTuile (négatif)': (d) => M.tournerTuile(d, 2, 1, -1),
  poserJeton: (d) => M.poserJeton(d, 2, 1),
  'poserJeton (carrefour)': (d) => M.poserJeton(d, 3, 1, 'carrefour'),
  retirerJeton: (d) => M.retirerJeton(d, 1, 1),
  'retirerJeton (absent)': (d) => M.retirerJeton(d, 3, 1),
  'cyclerJeton (vide->capture)': (d) => M.cyclerJeton(d, 2, 1),
  'cyclerJeton (capture->carrefour)': (d) => M.cyclerJeton(d, 1, 1),
  'cyclerJeton (carrefour->vide)': (d) => M.cyclerJeton(d, 2, 2),
  clonerDocument: (d) => M.clonerDocument(d)
};
for (const [nom, op] of Object.entries(OPERATIONS)) {
  test('pureté : ' + nom, () => {
    let doc = docRiche();
    if (nom.startsWith('poserTuile')) doc = M.retirerTuile(M.retirerTuile(doc, 0, 0), 2, 2);
    if (nom === 'retirerTuile (cellule vide)') doc = M.retirerTuile(doc, 0, 0);
    const avant = copie(doc);
    const res = op(gel(doc)); // document gelé : toute mutation lève en mode strict
    assert.deepEqual(doc, avant);
    assert.notEqual(res, doc);
    // le résultat ne partage aucune référence mutable avec l'entrée
    const refs = new Set();
    (function marque(o) { if (o && typeof o === 'object') { refs.add(o); Object.values(o).forEach(marque); } })(doc);
    (function verifie(o, chemin) {
      if (o && typeof o === 'object') {
        assert.equal(refs.has(o), false, 'référence partagée : ' + chemin);
        Object.entries(o).forEach(([k, v]) => verifie(v, chemin + '.' + k));
      }
    })(res, 'res');
  });
}
test('pureté : les refus (exceptions) ne modifient pas le document', () => {
  const doc = docRiche();
  const avant = copie(doc);
  gel(doc);
  assert.throws(() => M.poserTuile(doc, ID.centrale, 1, 1));
  assert.throws(() => M.poserTuile(doc, ID.centrale, 9, 9));
  assert.throws(() => M.tournerTuile(doc, 0, 0, 1));
  assert.throws(() => M.tournerTuile(doc, 9, 9, 1));
  assert.throws(() => M.poserJeton(doc, 1, 1));
  assert.throws(() => M.poserJeton(doc, 0, 0));
  assert.throws(() => M.poserJeton(doc, 3, 1, 'ville'));
  assert.deepEqual(doc, avant);
});
test('pureté : peutPoser*, portsJonction, raccordsMorts, valider* ne modifient pas le document', () => {
  const doc = docRiche();
  const avant = copie(doc);
  gel(doc);
  M.peutPoserTuile(doc, ID.centrale, 1, 1);
  M.peutPoserJeton(doc, 2, 1);
  M.portsJonction(doc, 1, 1);
  M.raccordsMorts(doc);
  M.exemplairesRestants(doc, ID.coin);
  doc.modeles.forEach((m) => M.validerModele(m));
  M.validerForme(doc.plateau.forme);
  assert.deepEqual(doc, avant);
});
test('pureté : modifier le résultat ne touche pas l original', () => {
  const doc = docRiche();
  const avant = copie(doc);
  const res = M.tournerTuile(doc, 1, 1, 1);
  res.plateau.tuiles.length = 0;
  res.modeles[0].nom = 'zzz';
  res.plateau.jetons.push({ i: 1, j: 1, type: 'x' });
  assert.deepEqual(doc, avant);
});

/* ------------------------------------------------------------------ */
/* 5. Rotations                                                        */
/* ------------------------------------------------------------------ */
test('tournerTuile refusée hors centrale (coin, bord, apparition) et sur cellule vide', () => {
  const doc = complet();
  for (const [c, l] of [[0, 0], [3, 3], [0, 1], [3, 2], [1, 0], [2, 3]]) {
    assert.throws(() => M.tournerTuile(doc, c, l, 1), /centrale/, c + ',' + l);
  }
  assert.throws(() => M.tournerTuile(docForme([]), 1, 1, 1), /Aucune tuile/);
  // toutes les rotations restent refusées, même 0 et 4
  for (const q of [0, 1, 2, 3, 4, -1]) assert.throws(() => M.tournerTuile(doc, 0, 0, q));
});
function centraleAsymetrique() {
  // raccords : N0, N2, E1, S0, O1, O2 ; un port par coin ; 4 cases
  const m = exemple('centrale');
  m.id = 'asym';
  m.chemins = m.chemins.filter((c) => !c.id.startsWith('r'));
  const rac = [[0, 0, 'c1'], [0, 2, 'c2'], [1, 1, 'c2'], [2, 0, 'c3'], [3, 1, 'c4'], [3, 2, 'c1']];
  rac.forEach(([cote, pos, c], n) => m.chemins.push({ id: 'rr' + n, a: { 'case': c }, b: { raccord: { cote, pos } } }));
  return m;
}
const cle = (p) => p.x + ',' + p.y;
test('centrale tournée 1, 2, 3 fois : raccords morts = points tournés par tournerPoint', () => {
  const modele = centraleAsymetrique();
  assert.equal(M.validerModele(modele).complet, true, JSON.stringify(M.validerModele(modele).erreurs));
  const doc0 = docForme([], 4);
  doc0.modeles.push(modele);
  let doc = M.poserTuile(doc0, 'asym', 1, 1);
  // une centrale seule : tous ses raccords sont morts
  const attendu = (rot) => modele.chemins
    .map((c) => (c.b.raccord || c.a.raccord))
    .filter(Boolean)
    .map((r) => cle(G.tournerPoint(G.pointRaccord(r.cote, r.pos), rot)))
    .sort();
  const obtenu = (d) => M.raccordsMorts(d).map((r) => cle(G.pointRaccord(r.cote, r.pos))).sort();
  assert.deepEqual(obtenu(doc), attendu(0));
  for (let q = 1; q <= 3; q++) {
    doc = M.tournerTuile(doc, 1, 1, 1);
    assert.equal(M.tuileEn(doc, 1, 1).rot, q);
    assert.deepEqual(obtenu(doc), attendu(q), 'rot ' + q);
    // chaque raccord mort est bien le côté (cote+q)%4, même position
    const cotes = M.raccordsMorts(doc).map((r) => r.cote + ':' + r.pos).sort();
    const exp = modele.chemins.map((c) => c.b.raccord || c.a.raccord).filter(Boolean)
      .map((r) => ((r.cote + q) % 4) + ':' + r.pos).sort();
    assert.deepEqual(cotes, exp);
  }
  doc = M.tournerTuile(doc, 1, 1, 1);
  assert.equal(M.tuileEn(doc, 1, 1).rot, 0, '4 quarts = identité');
  assert.deepEqual(obtenu(doc), attendu(0));
  // quarts en un appel, négatifs, > 4
  assert.equal(M.tuileEn(M.tournerTuile(doc, 1, 1, 3), 1, 1).rot, 3);
  assert.equal(M.tuileEn(M.tournerTuile(doc, 1, 1, -1), 1, 1).rot, 3);
  assert.equal(M.tuileEn(M.tournerTuile(doc, 1, 1, 6), 1, 1).rot, 2);
  assert.equal(M.tuileEn(M.tournerTuile(doc, 1, 1), 1, 1).rot, 1);
});
test('centrale tournée : le port (un seul port conservé) tombe sur la bonne jonction', () => {
  let doc = docForme([], 4);
  doc = M.poserTuile(doc, ID.centrale, 1, 1);
  // on garde seul le port du coin NO (mutation volontaire du modèle après pose)
  const m = doc.modeles.find((x) => x.id === ID.centrale);
  m.chemins = m.chemins.filter((c) => !(c.id === 'p2' || c.id === 'p3' || c.id === 'p4'));
  const jonctionDuCoin = (k) => [[1, 1], [2, 1], [2, 2], [1, 2]][k];
  for (let q = 0; q < 4; q++) {
    const d = q === 0 ? doc : M.tournerTuile(doc, 1, 1, q);
    // coin NO (0,0) tourné de q quarts : point tourné == pointCoin((0+q)%4)
    assert.deepEqual(G.tournerPoint(G.pointCoin(0), q), G.pointCoin(q % 4));
    for (let k = 0; k < 4; k++) {
      const [i, j] = jonctionDuCoin(k);
      assert.equal(M.portsJonction(d, i, j).ports, k === q % 4 ? 1 : 0, 'rot ' + q + ' jonction ' + i + ',' + j);
    }
  }
});
test('geometrie : tournerRaccords / tournerPorts / T1 / T2 / identité à 4 quarts', () => {
  assert.equal(G.tournerRaccords(0x050, 1), 0x280);
  assert.equal(G.tournerRaccords(0x050, 4), 0x050);
  assert.equal(G.tournerRaccords(0x050, -3), 0x280);
  assert.equal(G.tournerPorts(0b0100, 1), 0b1000);
  assert.equal(G.tournerPorts(0b1000, 1), 0b0001);
  for (let m = 0; m < 4096; m += 7) {
    assert.equal(G.tournerRaccords(m, 4), m);
    assert.equal(G.tournerRaccords(G.tournerRaccords(m, 1), 3), m);
    assert.equal(G.tournerRaccords(m, 2), G.tournerRaccords(G.tournerRaccords(m, 1), 1));
  }
  // chaque bit de raccord (côté, pos) tourné correspond au point tourné
  for (let cote = 0; cote < 4; cote++) for (let pos = 0; pos < 3; pos++) for (let q = 0; q < 4; q++) {
    const bit = 1 << G.bitRaccord(cote, pos);
    const m2 = G.tournerRaccords(bit, q);
    const c2 = (cote + q) % 4;
    assert.equal(m2, 1 << G.bitRaccord(c2, pos));
    assert.deepEqual(G.tournerPoint(G.pointRaccord(cote, pos), q), G.pointRaccord(c2, pos));
  }
  for (let k = 0; k < 4; k++) for (let q = 0; q < 4; q++) {
    assert.equal(G.tournerPorts(1 << k, q), 1 << ((k + q) % 4));
    assert.deepEqual(G.tournerPoint(G.pointCoin(k), q), G.pointCoin((k + q) % 4));
  }
  // T2
  let r = G.apparier(0x008, 1, 0x800);
  assert.equal(r.connectes, 1); assert.equal(r.mortsA, 0); assert.equal(r.mortsB, 0);
  r = G.apparier(0x008, 1, 0x200);
  assert.equal(r.connectes, 0); assert.equal(r.mortsA, 1); assert.equal(r.mortsB, 1);
});
test('tournerTuile : quarts non entier ou invalide ne doit pas corrompre rot', () => {
  const doc = complet();
  for (const q of [0.5, NaN, Infinity, 'a', '1']) {
    let res = null;
    try { res = M.tournerTuile(M.tournerTuile(doc, 1, 1, 1), 1, 1, q); } catch (e) { continue; }
    const rot = M.tuileEn(res, 1, 1).rot;
    assert.ok(Number.isInteger(rot) && rot >= 0 && rot <= 3 && (q !== '1' || rot === 2), 'rot corrompu : ' + rot + ' pour quarts=' + q);
  }
});
test('tournerTuile : quarts = null ne corrompt pas rot (accepté comme 0 ou refusé)', () => {
  const doc = complet();
  let res = null;
  try { res = M.tournerTuile(doc, 1, 1, null); } catch (e) { return; }
  assert.ok([0, 1].includes(M.tuileEn(res, 1, 1).rot));
});

/* ------------------------------------------------------------------ */
/* 6. Jetons                                                           */
/* ------------------------------------------------------------------ */
test('jetons : motifs de refus', () => {
  const doc = complet();
  const raison = (i, j) => M.peutPoserJeton(doc, i, j);
  for (const [i, j] of [[0, 1], [1, 0], [4, 2], [2, 4], [0, 0], [4, 4], [-1, 2], [1.5, 2], [NaN, 2], ['1', '1'], [undefined, undefined], [null, null]]) {
    const r = raison(i, j);
    assert.equal(r.ok, false, i + ',' + j);
    assert.match(r.raison, /jonction intérieure/);
    assert.throws(() => M.poserJeton(doc, i, j));
  }
  // occupée
  const d1 = M.poserJeton(doc, 2, 2);
  assert.match(M.peutPoserJeton(d1, 2, 2).raison, /déjà/);
  assert.throws(() => M.poserJeton(d1, 2, 2, 'carrefour'), /déjà/);
  // moins de 4 tuiles
  const d2 = M.retirerTuile(doc, 1, 1);
  assert.match(M.peutPoserJeton(d2, 1, 1).raison, /4 tuiles/);
  assert.match(M.peutPoserJeton(docForme([]), 2, 2).raison, /4 tuiles/);
  // moins de 2 ports (mutation du modèle de centrale après pose)
  const d3 = copie(doc);
  const m = d3.modeles.find((x) => x.id === ID.centrale);
  m.chemins = m.chemins.filter((c) => !['p2', 'p3', 'p4'].includes(c.id)); // reste coin 0 seulement
  // jonction (2,2) : (1,1)c2 non, (2,1)c3 non, (1,2)c1 non, (2,2)c0 oui => 1 port
  assert.deepEqual(M.portsJonction(d3, 2, 2), { ports: 1, tuiles: 4 });
  assert.match(M.peutPoserJeton(d3, 2, 2).raison, /ports/);
  assert.throws(() => M.poserJeton(d3, 2, 2), /ports/);
  // type inconnu
  for (const t of ['ville', 'deplacement', 'apparition', 42, {}]) assert.throws(() => M.poserJeton(doc, 2, 2, t), /Type de jeton/);
});
test('jetons : type par défaut = capture, undefined/null/vide acceptés comme défaut', () => {
  const doc = complet();
  assert.equal(M.poserJeton(doc, 2, 2).plateau.jetons[0].type, 'capture');
  assert.equal(M.poserJeton(doc, 2, 2, undefined).plateau.jetons[0].type, 'capture');
});
test('jetons : cycle vide -> capture -> carrefour -> vide', () => {
  let doc = complet();
  assert.equal(M.plateauJeton, undefined);
  const etat = (d) => { const j = d.plateau.jetons.find((x) => x.i === 2 && x.j === 2); return j ? j.type : null; };
  assert.equal(etat(doc), null);
  doc = M.cyclerJeton(doc, 2, 2); assert.equal(etat(doc), 'capture');
  doc = M.cyclerJeton(doc, 2, 2); assert.equal(etat(doc), 'carrefour');
  doc = M.cyclerJeton(doc, 2, 2); assert.equal(etat(doc), null);
  assert.equal(doc.plateau.jetons.length, 0);
  doc = M.cyclerJeton(doc, 2, 2); assert.equal(etat(doc), 'capture');
  assert.equal(doc.plateau.jetons.length, 1);
  // cycle refusé sur jonction non valide
  assert.throws(() => M.cyclerJeton(doc, 0, 0));
  assert.throws(() => M.cyclerJeton(M.retirerTuile(complet(), 1, 1), 1, 1));
  // les autres jetons ne bougent pas
  doc = M.poserJeton(doc, 1, 1, 'carrefour');
  doc = M.cyclerJeton(doc, 2, 2);
  assert.equal(doc.plateau.jetons.find((x) => x.i === 1 && x.j === 1).type, 'carrefour');
});
test('jetons : retirerJeton absent = no-op, un seul jeton retiré', () => {
  let doc = complet();
  doc = M.poserJeton(M.poserJeton(doc, 1, 1), 2, 2);
  assert.equal(M.retirerJeton(doc, 3, 3).plateau.jetons.length, 2);
  const r = M.retirerJeton(doc, 1, 1);
  assert.deepEqual(r.plateau.jetons, [{ i: 2, j: 2, type: 'capture' }]);
});
test('jetons : nettoyage après retirerTuile (coin, bord, centrale)', () => {
  let doc = complet();
  for (const [i, j] of jonctionsToutes()) doc = M.poserJeton(doc, i, j);
  assert.equal(doc.plateau.jetons.length, 9);
  const reste = (d) => d.plateau.jetons.map((x) => x.i + ',' + x.j).sort();
  const attendu = (col, lig) => jonctionsToutes()
    .filter(([i, j]) => !(i - col >= 0 && i - col <= 1 && j - lig >= 0 && j - lig <= 1))
    .map(([i, j]) => i + ',' + j).sort();
  for (const [c, l] of [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2], [3, 3], [3, 2], [2, 3]]) {
    assert.deepEqual(reste(M.retirerTuile(doc, c, l)), attendu(c, l), 'retrait ' + c + ',' + l);
  }
  // le doc source garde ses 9 jetons
  assert.equal(doc.plateau.jetons.length, 9);
});
test('jetons : nettoyage après rotation d une centrale (ports qui changent)', () => {
  let doc = docForme([], 4);
  for (const [c, l] of [[1, 1], [2, 1], [1, 2], [2, 2]]) doc = M.poserTuile(doc, ID.centrale, c, l);
  const m = doc.modeles.find((x) => x.id === ID.centrale);
  m.chemins = m.chemins.filter((c) => !['p3', 'p4'].includes(c.id)); // ports coins 0 et 1 seulement
  // jonction (2,2) : (1,1)c2 non ; (2,1)c3 non ; (1,2)c1 oui ; (2,2)c0 oui => 2 ports
  doc = M.poserJeton(doc, 2, 2);
  // rotation de (2,2) : ses ports passent en coins 1 et 2 ; coin 0 n'y est plus => 1 port => jeton retiré
  assert.equal(M.tournerTuile(doc, 2, 2, 1).plateau.jetons.length, 0);
  // rotation de (1,1) : ports en coins 1,2 ; le coin 2 touche (2,2) => 3 ports => jeton conservé
  const d2 = M.tournerTuile(doc, 1, 1, 1);
  assert.equal(d2.plateau.jetons.length, 1);
  // rotation de 4 quarts : jeton conservé
  assert.equal(M.tournerTuile(doc, 2, 2, 4).plateau.jetons.length, 1);
  // la rotation d une centrale d un autre endroit ne touche pas le jeton
  assert.equal(M.tournerTuile(doc, 2, 1, 1).plateau.jetons.length, 1);
});
test('jetons : rotation d une centrale de modèle valide ne retire jamais un jeton (4 ports)', () => {
  let doc = complet();
  for (const [i, j] of jonctionsToutes()) doc = M.poserJeton(doc, i, j);
  for (const [c, l] of [[1, 1], [2, 1], [1, 2], [2, 2]]) {
    for (let q = 1; q <= 3; q++) assert.equal(M.tournerTuile(doc, c, l, q).plateau.jetons.length, 9);
  }
});

/* ------------------------------------------------------------------ */
/* 7. raccordsMorts                                                    */
/* ------------------------------------------------------------------ */
test('raccordsMorts : bord de plateau, voisin absent, voisin sans raccord en face', () => {
  // coin (0,0) seul : E pos1 et S pos1 sont morts (voisins absents)
  let doc = docForme([]);
  doc = M.poserTuile(doc, ID.coin, 0, 0);
  assert.deepEqual(M.raccordsMorts(doc).map((r) => [r.col, r.lig, r.cote, r.pos]).sort(), [[0, 0, 1, 1], [0, 0, 2, 1]]);
  // bord (1,0)? c est une apparition : E1 et O1 morts, avec le coin en face de O ? coin n a pas de raccord ouest (extérieur)
  doc = M.poserTuile(doc, ID.apparition, 1, 0);
  const morts = M.raccordsMorts(doc).map((r) => r.col + ',' + r.lig + ',' + r.cote + ',' + r.pos).sort();
  // coin E1 face à O1 de l apparition (2-1=1) : vivant ; apparition E1 face à rien : mort
  assert.deepEqual(morts, ['0,0,2,1', '1,0,1,1'].sort().concat([]).sort());
});
test('raccordsMorts : voisin avec raccord en position décalée = deux morts', () => {
  // T2 : A=(1,1) E début (0x008) ; B=(2,1) O début => mortsA et mortsB
  const doc = docForme([], 4);
  const a = centraleAsymetrique(); a.id = 'A';
  a.chemins = a.chemins.filter((c) => !c.id.startsWith('rr'));
  a.chemins.push({ id: 'rr0', a: { 'case': 'c1' }, b: { raccord: { cote: 1, pos: 0 } } });
  a.chemins.push({ id: 'rr1', a: { 'case': 'c2' }, b: { raccord: { cote: 0, pos: 1 } } });
  a.chemins.push({ id: 'rr2', a: { 'case': 'c3' }, b: { raccord: { cote: 2, pos: 1 } } });
  const b = copie(a); b.id = 'B';
  b.chemins = b.chemins.filter((c) => c.id !== 'rr0');
  b.chemins.push({ id: 'rr0', a: { 'case': 'c1' }, b: { raccord: { cote: 3, pos: 0 } } });
  doc.modeles.push(a, b);
  assert.equal(M.validerModele(a).complet, true);
  assert.equal(M.validerModele(b).complet, true);
  let d = M.poserTuile(M.poserTuile(doc, 'A', 1, 1), 'B', 2, 1);
  const cote = (r) => r.col + ',' + r.lig + ',' + r.cote + ',' + r.pos;
  let morts = M.raccordsMorts(d).map(cote);
  assert.ok(morts.includes('1,1,1,0'));
  assert.ok(morts.includes('2,1,3,0'));
  // B avec O fin (pos 2) : face à E début de A : connecté
  const b2 = copie(b); b2.id = 'B2';
  b2.chemins.find((c) => c.id === 'rr0').b.raccord.pos = 2;
  d = copie(d); d.modeles.push(b2);
  d = M.retirerTuile(d, 2, 1);
  d = M.poserTuile(d, 'B2', 2, 1);
  morts = M.raccordsMorts(d).map(cote);
  assert.ok(!morts.includes('1,1,1,0'));
  assert.ok(!morts.includes('2,1,3,2'));
  // après rotation de B2 (centrale) le raccord O fin devient N fin : plus de vis-à-vis
  d = M.tournerTuile(d, 2, 1, 1);
  morts = M.raccordsMorts(d).map(cote);
  assert.ok(morts.includes('1,1,1,0'), 'E de A mort après rotation de B2');
});

/* Oracle géométrique : un raccord est vivant ssi un autre raccord tombe sur le même point global. */
function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function modeleAleatoire(role, rnd, idx) {
  const m = exemple(role);
  m.id = 'g' + idx; m.exemplaires = 99;
  m.chemins = m.chemins.filter((c) => !c.id.startsWith('r'));
  const interdits = G ? (role === 'centrale' ? [] : role === 'coin' ? [0, 3] : [0]) : [];
  const nbCases = m.cases.length;
  let n = 0, cotes = 0;
  const minC = role === 'centrale' ? 3 : 2;
  do {
    m.chemins = m.chemins.filter((c) => !c.id.startsWith('q'));
    cotes = 0; n = 0;
    for (let cote = 0; cote < 4; cote++) {
      if (interdits.includes(cote)) continue;
      let any = false;
      for (let pos = 0; pos < 3; pos++) {
        if (rnd() < 0.5) {
          m.chemins.push({ id: 'q' + (n++), a: { 'case': m.cases[Math.floor(rnd() * nbCases)].id }, b: { raccord: { cote, pos } } });
          any = true;
        }
      }
      if (any) cotes++;
    }
  } while (cotes < minC);
  return m;
}
test('raccordsMorts : oracle géométrique sur toutes les formes valides, tuiles et rotations aléatoires', () => {
  const rnd = prng(12345);
  let compte = 0;
  for (const ret of FORMES_VALIDES) {
    for (let essai = 0; essai < 25; essai++) {
      let doc = docForme(ret);
      const modelesParRole = { centrale: [], coin: [], bord: [], apparition: [] };
      let idx = 0;
      for (const role of Object.keys(modelesParRole)) {
        for (let k = 0; k < 3; k++) {
          const m = modeleAleatoire(role, rnd, idx++);
          assert.equal(M.validerModele(m).complet, true, JSON.stringify(M.validerModele(m).erreurs));
          modelesParRole[role].push(m); doc.modeles.push(m);
        }
      }
      const posees = [];
      for (const { col, lig } of M.cellulesActives(doc.plateau.forme)) {
        if (rnd() < 0.25) continue; // cellule laissée vide
        const role = oracleRole(col, lig, ret);
        const m = modelesParRole[role][Math.floor(rnd() * 3)];
        doc = M.poserTuile(doc, m.id, col, lig);
        let rot = oracleRot(col, lig, ret);
        if (rot === null) {
          rot = Math.floor(rnd() * 4);
          if (rot) doc = M.tournerTuile(doc, col, lig, rot);
        }
        assert.equal(M.tuileEn(doc, col, lig).rot, rot);
        posees.push({ col, lig, m, rot });
      }
      // points globaux
      const pts = posees.map((t) => t.m.chemins.map((c) => c.b.raccord || c.a.raccord).filter(Boolean).map((r) => {
        const p = G.tournerPoint(G.pointRaccord(r.cote, r.pos), t.rot);
        return { tuile: t, r, key: (t.col * 120 + p.x) + ',' + (t.lig * 120 + p.y) };
      }));
      const tous = [].concat(...pts);
      const attendus = [];
      for (const e of tous) {
        const vivant = tous.some((o) => o.tuile !== e.tuile && o.key === e.key);
        if (vivant) continue;
        // cote / pos dans le repère du plateau
        let found = null;
        for (let c = 0; c < 4; c++) for (let p = 0; p < 3; p++) {
          const pp = G.pointRaccord(c, p), q = G.tournerPoint(G.pointRaccord(e.r.cote, e.r.pos), e.tuile.rot);
          if (pp.x === q.x && pp.y === q.y) found = [c, p];
        }
        attendus.push(e.tuile.col + ',' + e.tuile.lig + ',' + found[0] + ',' + found[1]);
      }
      const obtenus = M.raccordsMorts(doc).map((r) => r.col + ',' + r.lig + ',' + r.cote + ',' + r.pos);
      assert.deepEqual(obtenus.sort(), attendus.sort(), 'forme ' + nomForme(ret) + ' essai ' + essai);
      compte++;
    }
  }
  assert.ok(compte > 300);
});

/* ------------------------------------------------------------------ */
/* 8. validerModele : cas limites                                      */
/* ------------------------------------------------------------------ */
const sur = (modele, id) => M.validerModele(modele).erreurs.filter((e) => e.ref && e.ref.id === id).map((e) => e.code);
function avecC1(x, y, d) {
  const m = exemple('centrale');
  Object.assign(m.cases[0], { x, y, diametre: d });
  return m;
}
test('modèles d exemple : tous complets', () => {
  for (const m of M.exemples) assert.deepEqual(M.validerModele(m), { complet: true, erreurs: [] }, m.id);
});
test('marge de coupe : pile à 4 mm accepté, 3,99 refusé (4 côtés)', () => {
  assert.deepEqual(sur(avecC1(16, 60, 24), 'c1'), []);
  assert.deepEqual(sur(avecC1(15.99, 60, 24), 'c1'), ['hors_tuile']);
  // côté droit : c2 à x = 104 => bord à 116 = 120 - 4
  const m = exemple('centrale'); Object.assign(m.cases[1], { x: 104, y: 60 });
  assert.deepEqual(sur(m, 'c2'), []);
  m.cases[1].x = 104.01;
  assert.deepEqual(sur(m, 'c2'), ['hors_tuile']);
  // haut / bas
  const h = exemple('centrale'); Object.assign(h.cases[0], { x: 60, y: 16 });
  assert.deepEqual(sur(h, 'c1').filter((c) => c === 'hors_tuile'), []);
  h.cases[0].y = 15.99;
  assert.ok(sur(h, 'c1').includes('hors_tuile'));
  const b = exemple('centrale'); Object.assign(b.cases[3], { x: 60, y: 104 });
  assert.ok(!sur(b, 'c4').includes('hors_tuile'));
  b.cases[3].y = 104.01;
  assert.ok(sur(b, 'c4').includes('hors_tuile'));
});
test('zone de coin : pile à la limite (distance = 20 + r) accepté, juste en dessous refusé', () => {
  // d24 : r = 12, limite 32 ; triplet 3-4-5
  assert.deepEqual(sur(avecC1(19.2, 25.6, 24), 'c1'), []);
  const k = 31.99 / 32;
  assert.deepEqual(sur(avecC1(19.2 * k, 25.6 * k, 24), 'c1'), ['zone_coin']);
  // d30 : r = 15, limite 35, triplet 21-28-35
  assert.deepEqual(sur(avecC1(21, 28, 30), 'c1'), []);
  assert.ok(sur(avecC1(21 * 0.999, 28 * 0.999, 30), 'c1').includes('zone_coin'));
  // les 4 coins
  for (const [x, y] of [[19.2, 25.6], [120 - 19.2, 25.6], [120 - 19.2, 120 - 25.6], [19.2, 120 - 25.6]]) {
    const m = exemple('centrale'); Object.assign(m.cases[0], { x, y });
    m.cases.slice(1).forEach((c, n) => { c.x = 60 + 5 * n; c.y = 60 + 5 * n; c.diametre = 4; });
    assert.ok(!sur(m, 'c1').includes('zone_coin'), x + ',' + y);
  }
});
test('diamètre : 30 exact accepté, 30,01 refusé, 0 / négatif / NaN invalides', () => {
  assert.ok(!sur(avecC1(40, 60, 30), 'c1').includes('diametre'));
  assert.ok(sur(avecC1(40, 60, 30.01), 'c1').includes('diametre'));
  assert.ok(!sur(avecC1(40, 60, 30), 'c1').includes('case_invalide'));
  for (const d of [0, -5, NaN, Infinity, '24', null, undefined]) {
    assert.ok(sur(avecC1(40, 60, d), 'c1').includes('case_invalide'), String(d));
  }
});
test('chevauchement : tangentes acceptées, recouvrement refusé', () => {
  const m = exemple('centrale');
  Object.assign(m.cases[0], { x: 40, y: 60, diametre: 24 });
  Object.assign(m.cases[3], { x: 64, y: 60, diametre: 24 }); // centres à 24 = d : tangentes
  assert.ok(!codes(m).includes('chevauchement'));
  m.cases[3].x = 63.9;
  assert.ok(codes(m).includes('chevauchement'));
});
test('ports : chemin vers un coin extérieur refusé pour chaque rôle', () => {
  const coin = exemple('coin');
  for (const k of [0, 1, 3]) {
    const m = copie(coin); m.chemins.push({ id: 'x', a: { 'case': 'c2' }, b: { coin: k } });
    assert.ok(codes(m).includes('port_interdit'), 'coin ' + k);
  }
  const bord = exemple('bord'); bord.chemins.push({ id: 'x', a: { 'case': 'c3' }, b: { coin: 0 } });
  assert.ok(codes(bord).includes('port_interdit'));
  const bord2 = exemple('bord'); bord2.chemins.push({ id: 'x', a: { 'case': 'c3' }, b: { coin: 1 } });
  assert.ok(codes(bord2).includes('port_interdit'));
  const app = exemple('apparition'); app.chemins.push({ id: 'x', a: { 'case': 'c3' }, b: { coin: 1 } });
  assert.ok(codes(app).includes('port_interdit'));
});
test('ports : manquants, doublons sur une case, coin dans les deux extrémités', () => {
  const c = exemple('centrale'); c.chemins = c.chemins.filter((x) => x.id !== 'p4');
  assert.ok(codes(c).includes('port_manquant'));
  const c2 = exemple('centrale'); c2.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { coin: 1 } });
  assert.ok(codes(c2).includes('ports_case'));
  const c3 = exemple('centrale'); c3.chemins.push({ id: 'x', a: { coin: 1 }, b: { coin: 2 } });
  assert.ok(codes(c3).includes('chemin_sans_case'));
});
test('raccords : côté extérieur refusé, côtés non vides insuffisants', () => {
  const coin = exemple('coin'); coin.chemins.push({ id: 'x', a: { 'case': 'c3' }, b: { raccord: { cote: 0, pos: 0 } } });
  assert.ok(codes(coin).includes('raccord_exterieur'));
  const coin2 = exemple('coin'); coin2.chemins.push({ id: 'x', a: { 'case': 'c3' }, b: { raccord: { cote: 3, pos: 2 } } });
  assert.ok(codes(coin2).includes('raccord_exterieur'));
  const bord = exemple('bord'); bord.chemins.push({ id: 'x', a: { 'case': 'c3' }, b: { raccord: { cote: 0, pos: 1 } } });
  assert.ok(codes(bord).includes('raccord_exterieur'));
  const cen = exemple('centrale'); cen.chemins = cen.chemins.filter((c) => c.id !== 'r4'); // 3 côtés : ok
  assert.ok(!codes(cen).includes('cotes_raccord'));
  cen.chemins = cen.chemins.filter((c) => c.id !== 'r3'); // 2 côtés : refus
  assert.ok(codes(cen).includes('cotes_raccord'));
  const bord2 = exemple('bord'); bord2.chemins = bord2.chemins.filter((c) => c.id !== 'r1'); // 2 côtés : ok
  assert.ok(!codes(bord2).includes('cotes_raccord'));
  bord2.chemins = bord2.chemins.filter((c) => c.id !== 'r2');
  assert.ok(codes(bord2).includes('cotes_raccord'));
  // 3 raccords sur le même côté = 1 côté
  const cen2 = exemple('centrale');
  cen2.chemins = cen2.chemins.filter((c) => !c.id.startsWith('r'));
  [0, 1, 2].forEach((p, n) => cen2.chemins.push({ id: 'z' + n, a: { 'case': 'c' + (n + 1) }, b: { raccord: { cote: 1, pos: p } } }));
  assert.ok(codes(cen2).includes('cotes_raccord'));
});
test('raccords : raccord double, raccord hors plage', () => {
  const m = exemple('centrale'); m.chemins.push({ id: 'x', a: { 'case': 'c2' }, b: { raccord: { cote: 0, pos: 0 } } });
  assert.ok(codes(m).includes('raccord_double'));
  for (const r of [{ cote: 4, pos: 0 }, { cote: 0, pos: 3 }, { cote: -1, pos: 0 }, { cote: 0.5, pos: 0 }, { cote: '0', pos: '0' }, {}, null]) {
    const n = exemple('centrale'); n.chemins.push({ id: 'x', a: { 'case': 'c2' }, b: { raccord: r } });
    assert.ok(codes(n).includes('chemin_invalide'), JSON.stringify(r));
  }
});
test('chemins : boucle, doublon (sens inverse), case inconnue, graphe non connexe', () => {
  let m = exemple('centrale'); m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c1' } });
  assert.ok(codes(m).includes('boucle'));
  m = exemple('centrale'); m.chemins.push({ id: 'x', a: { 'case': 'c2' }, b: { 'case': 'c1' } });
  assert.ok(codes(m).includes('chemin_double'));
  m = exemple('centrale'); m.chemins.push({ id: 'x', a: { 'case': 'zz' }, b: { 'case': 'c1' } });
  assert.ok(codes(m).includes('case_inconnue'));
  m = exemple('centrale'); m.chemins = m.chemins.filter((c) => !['h1', 'h2', 'h3'].includes(c.id));
  assert.ok(codes(m).includes('non_connexe'));
});
test('ids manquants, doublons, vides', () => {
  let m = exemple('centrale'); delete m.cases[0].id;
  assert.ok(codes(m).includes('id_manquant'));
  m = exemple('centrale'); m.chemins[0].id = '';
  assert.ok(codes(m).includes('id_manquant'));
  m = exemple('centrale'); m.cases[1].id = null;
  assert.ok(codes(m).includes('id_manquant'));
  m = exemple('centrale'); m.chemins[0].id = 'c1';
  assert.ok(codes(m).includes('id_double'));
  m = exemple('centrale'); m.cases[1].id = 'c1';
  assert.ok(codes(m).includes('id_double'));
  // id numérique refusé : ids chaînes non vides exigés (arbitrage 2026-10-16, revue point 14)
  m = exemple('centrale'); m.cases[0].id = 0; m.chemins.forEach((c) => { ['a', 'b'].forEach((s) => { if (c[s]['case'] === 'c1') c[s]['case'] = 0; }); });
  assert.ok(codes(m).includes('id_invalide'));
});
test('ids de type propriété d Object.prototype ne produisent pas de faux id_double', () => {
  for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
    const m = exemple('centrale');
    m.cases[0].id = id;
    m.chemins.forEach((c) => { ['a', 'b'].forEach((s) => { if (c[s]['case'] === 'c1') c[s]['case'] = id; }); });
    assert.deepEqual(M.validerModele(m).erreurs, [], id);
  }
});
test('rôle inconnu, exemplaires invalides, nombre de cases, apparition', () => {
  let m = exemple('centrale'); m.role = 'roi';
  assert.ok(codes(m).includes('role_inconnu'));
  assert.equal(M.validerModele(m).complet, false);
  for (const e of [-1, 1.5, '3', NaN, null, undefined, Infinity]) {
    m = exemple('centrale'); m.exemplaires = e;
    assert.ok(codes(m).includes('exemplaires_invalides'), String(e));
  }
  m = exemple('centrale'); m.exemplaires = 0;
  assert.equal(M.validerModele(m).complet, true);
  m = exemple('centrale'); m.cases.pop();
  assert.ok(codes(m).includes('nombre_cases'));
  m = exemple('coin'); m.cases[0].type = 'apparition';
  assert.ok(codes(m).includes('cases_apparition'));
  m = exemple('apparition'); m.cases[2].type = 'deplacement';
  assert.ok(codes(m).includes('cases_apparition'));
  m = exemple('apparition'); m.cases[0].type = 'apparition';
  assert.ok(codes(m).includes('cases_apparition'));
  m = exemple('centrale'); m.cases[0].type = 'capture';
  assert.ok(codes(m).includes('type_case'));
});
test('modèle vide / absent / malformé : pas d exception', () => {
  for (const v of [undefined, null, 0, 'x', true]) {
    const r = M.validerModele(v);
    assert.equal(r.complet, false);
    assert.equal(r.erreurs[0].code, 'modele_absent');
  }
  for (const v of [{}, [], { role: 'centrale' }, { role: 'centrale', cases: null, chemins: null }, { role: 'coin', cases: {}, chemins: 'x' },
    { role: 'bord', cases: 'abc', chemins: 12 }, { cases: [], chemins: [] }]) {
    assert.doesNotThrow(() => M.validerModele(v), JSON.stringify(v));
    assert.equal(M.validerModele(v).complet, false);
  }
  assert.ok(codes({}).includes('role_inconnu'));
  assert.ok(codes({ role: 'centrale', cases: [], chemins: [] }).includes('nombre_cases'));
});
test('modèle avec chemins malformés : pas d exception', () => {
  const mauvais = [null, undefined, 5, 'x', {}, { id: 'p' }, { id: 'p', a: null, b: null }, { id: 'p', a: {}, b: {} },
    { id: 'p', a: { 'case': null }, b: { coin: 1 } }, { id: 'p', a: { 'case': {} }, b: { coin: 1 } },
    { id: 'p', a: { coin: 'x' }, b: { 'case': 'c1' } }, { id: 'p', a: { raccord: 5 }, b: { 'case': 'c1' } },
    { id: 'p', a: { 'case': 'c1' }, b: { raccord: { cote: 9 } } }];
  for (const role of ['centrale', 'coin', 'bord', 'apparition']) {
    for (const ch of mauvais) {
      const m = exemple(role); m.chemins.push(ch);
      assert.doesNotThrow(() => M.validerModele(m), role + ' ' + JSON.stringify(ch));
      assert.doesNotThrow(() => M.masquesDuModele(m));
    }
  }
});
test('modèle avec cases malformées (null, nombres, chaînes) : pas d exception', () => {
  for (const c of [null, undefined]) {
    const m = exemple('centrale'); m.cases.push(c);
    assert.doesNotThrow(() => M.validerModele(m), String(c));
    assert.equal(M.validerModele(m).complet, false);
  }
  for (const c of [5, 'x', {}, [], { id: 'z' }, { id: 'z', x: 'a', y: 1, diametre: 3 }]) {
    const m = exemple('centrale'); m.cases.push(c);
    assert.doesNotThrow(() => M.validerModele(m), JSON.stringify(c));
    assert.equal(M.validerModele(m).complet, false);
  }
});
test('rôle hérité d Object.prototype (constructor, toString) : pas d exception avec raccords', () => {
  for (const role of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const m = exemple('centrale'); m.role = role;
    assert.doesNotThrow(() => M.validerModele(m), role);
    assert.equal(M.validerModele(m).complet, false, role);
  }
});

/* ------------------------------------------------------------------ */
/* 9. Sérialisation                                                    */
/* ------------------------------------------------------------------ */
test('clonerDocument : JSON identique, indépendant de la source', () => {
  const doc = docRiche();
  const c = M.clonerDocument(doc);
  assert.equal(JSON.stringify(c), JSON.stringify(doc));
  assert.deepEqual(c, doc);
  c.plateau.tuiles[0].rot = 3; c.plateau.jetons.pop(); c.modeles[0].nom = 'x';
  assert.notDeepEqual(c, doc);
  assert.equal(M.clonerDocument(M.nouveauDocument()).version, 1);
});
test('nouveauDocument : instances indépendantes, forme valide, plateau vide', () => {
  const a = M.nouveauDocument(), b = M.nouveauDocument();
  a.plateau.tuiles.push(1); a.plateau.forme.retires.push({ col: 0, lig: 0 });
  assert.equal(b.plateau.tuiles.length, 0);
  assert.equal(b.plateau.forme.retires.length, 0);
  assert.equal(M.validerForme(b.plateau.forme).valide, true);
});
test('clonerDocument(undefined) ne lève pas d exception', () => {
  assert.doesNotThrow(() => M.clonerDocument(undefined));
});
test('document rechargé depuis JSON : mêmes résultats pour toutes les opérations', () => {
  const doc = docRiche();
  const rech = JSON.parse(JSON.stringify(doc));
  assert.deepEqual(rech, doc);
  const ops = [
    (d) => M.raccordsMorts(d),
    (d) => M.portsJonction(d, 1, 1),
    (d) => M.peutPoserTuile(d, ID.coin, 0, 0),
    (d) => M.peutPoserJeton(d, 1, 2),
    (d) => M.tournerTuile(d, 1, 2, 2),
    (d) => M.retirerTuile(d, 2, 2),
    (d) => M.cyclerJeton(d, 1, 1),
    (d) => M.cyclerJeton(d, 2, 1),
    (d) => M.exemplairesRestants(d, ID.bord),
    (d) => d.modeles.map((m) => M.validerModele(m)),
    (d) => d.modeles.map((m) => M.masquesDuModele(m))
  ];
  ops.forEach((op, n) => assert.deepEqual(op(rech), op(doc), 'op ' + n));
  // et pour un document avec forme réduite
  const d2 = remplir(docForme([[3, 0], [3, 1]]));
  const r2 = JSON.parse(JSON.stringify(d2));
  assert.deepEqual(M.raccordsMorts(r2), M.raccordsMorts(d2));
  assert.deepEqual(M.validerForme(r2.plateau.forme), M.validerForme(d2.plateau.forme));
  assert.deepEqual(r2.plateau.tuiles.map((t) => M.rotationDeduite(t.col, t.lig, r2.plateau.forme)),
    d2.plateau.tuiles.map((t) => M.rotationDeduite(t.col, t.lig, d2.plateau.forme)));
});
test('exemples : le module expose des exemples non partagés par les documents créés par les tests', () => {
  const avant = copie(M.exemples);
  const doc = docRiche();
  M.tournerTuile(doc, 1, 1, 1);
  assert.deepEqual(M.exemples, avant);
});
