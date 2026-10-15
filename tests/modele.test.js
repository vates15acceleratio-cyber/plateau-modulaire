'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;

/* ---------- outils de test ---------- */
const copie = (o) => JSON.parse(JSON.stringify(o));
const exemple = (role) => copie(M.exemples.find((m) => m.role === role));
const codes = (modele) => M.validerModele(modele).erreurs.map((e) => e.code);

function documentVide(forme) {
  const doc = M.nouveauDocument();
  doc.modeles = copie(M.exemples);
  if (forme) doc.plateau.forme = forme;
  return doc;
}
const ID = { centrale: 'ex-centrale', coin: 'ex-coin', bord: 'ex-bord', apparition: 'ex-apparition' };

/** Pose toutes les tuiles du 4x4 complet avec les exemples. */
function plateauComplet() {
  let doc = documentVide();
  for (const c of M.cellulesActives(doc.plateau.forme)) {
    doc = M.poserTuile(doc, ID[M.roleCellule(c.col, c.lig, doc.plateau.forme)], c.col, c.lig);
  }
  return doc;
}

/* ---------- validation des modèles ---------- */

test('les 4 exemples sont complets', () => {
  assert.strictEqual(M.exemples.length, 4);
  for (const m of M.exemples) {
    const r = M.validerModele(m);
    assert.deepStrictEqual(r.erreurs, [], m.id);
    assert.strictEqual(r.complet, true);
  }
  assert.deepStrictEqual(M.exemples.map((m) => m.role).sort(), ['apparition', 'bord', 'centrale', 'coin']);
});

test('masques calculés depuis les chemins', () => {
  const coin = M.masquesDuModele(exemple('coin'));
  assert.strictEqual(coin.portsCoin, 0b0100);
  assert.strictEqual(coin.raccords, (1 << G.bitRaccord(1, 1)) | (1 << G.bitRaccord(2, 1)));
  const bord = M.masquesDuModele(exemple('bord'));
  assert.strictEqual(bord.portsCoin, 0b1100);
  assert.strictEqual(M.masquesDuModele(exemple('centrale')).portsCoin, 0xF);
});

/** Chaque entrée : [nom, rôle, mutation, code attendu]. */
const ECHECS = [
  ['rôle inconnu', 'bord', (m) => { m.role = 'truc'; }, 'role_inconnu'],
  ['exemplaires invalides', 'bord', (m) => { m.exemplaires = -1; }, 'exemplaires_invalides'],
  ['id double', 'bord', (m) => { m.chemins[1].id = 'h1'; }, 'id_double'],
  ['id manquant', 'bord', (m) => { delete m.cases[0].id; }, 'id_manquant'],
  ['trop de cases', 'bord', (m) => { m.cases.push({ id: 'c9', x: 60, y: 100, diametre: 10, type: 'deplacement' }); }, 'nombre_cases'],
  ['pas assez de cases (centrale)', 'centrale', (m) => {
    m.cases.pop(); m.chemins = m.chemins.filter((c) => c.a.case !== 'c4' && c.b.case !== 'c4');
  }, 'nombre_cases'],
  ['type de case inconnu', 'bord', (m) => { m.cases[0].type = 'capture'; }, 'type_case'],
  ['bord avec case apparition', 'bord', (m) => { m.cases[2].type = 'apparition'; }, 'cases_apparition'],
  ['apparition sans case apparition', 'apparition', (m) => { m.cases[2].type = 'deplacement'; }, 'cases_apparition'],
  ['apparition avec 2 cases apparition', 'apparition', (m) => { m.cases[0].type = 'apparition'; }, 'cases_apparition'],
  ['case invalide', 'bord', (m) => { m.cases[0].x = 'a'; }, 'case_invalide'],
  ['diamètre trop grand', 'centrale', (m) => { m.cases[0].diametre = 34; }, 'diametre'],
  ['hors tuile (marge 4 mm)', 'bord', (m) => { m.cases[2].y = 15; }, 'hors_tuile'],
  ['marge exactement 4 mm acceptée', 'bord', (m) => { m.cases[2].y = 16; }, null],
  ['chevauchement', 'bord', (m) => { m.cases[1].x = 80; }, 'chevauchement'],
  ['zone de coin', 'centrale', (m) => { m.cases[0].x = 20; m.cases[0].y = 20; }, 'zone_coin'],
  ['port manquant', 'bord', (m) => { m.chemins = m.chemins.filter((c) => c.id !== 'p2'); }, 'port_manquant'],
  ['port sur coin extérieur', 'bord', (m) => { m.chemins.push({ id: 'p9', a: { case: 'c3' }, b: { coin: 0 } }); }, 'port_interdit'],
  ['coin : port sur un coin intérieur de trop', 'coin', (m) => { m.chemins.push({ id: 'p9', a: { case: 'c2' }, b: { coin: 1 } }); }, 'port_interdit'],
  ['deux ports sur une case', 'bord', (m) => { m.chemins.push({ id: 'p9', a: { case: 'c1' }, b: { coin: 3 } }); }, 'ports_case'],
  ['raccord sur côté extérieur (bord)', 'bord', (m) => {
    m.chemins.push({ id: 'r9', a: { case: 'c3' }, b: { raccord: { cote: 0, pos: 1 } } });
  }, 'raccord_exterieur'],
  ['raccord sur côté extérieur (coin, ouest)', 'coin', (m) => {
    m.chemins.push({ id: 'r9', a: { case: 'c3' }, b: { raccord: { cote: 3, pos: 0 } } });
  }, 'raccord_exterieur'],
  ['trop peu de côtés à raccord (centrale)', 'centrale', (m) => {
    m.chemins = m.chemins.filter((c) => c.id !== 'r1' && c.id !== 'r2');
  }, 'cotes_raccord'],
  ['trop peu de côtés à raccord (coin)', 'coin', (m) => { m.chemins = m.chemins.filter((c) => c.id !== 'r2'); }, 'cotes_raccord'],
  ['raccord utilisé deux fois', 'bord', (m) => {
    m.chemins.push({ id: 'r9', a: { case: 'c3' }, b: { raccord: { cote: 1, pos: 1 } } });
  }, 'raccord_double'],
  ['chemin en double', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'c3' }, b: { case: 'c1' } }); }, 'chemin_double'],
  ['boucle sur soi-même', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'c1' }, b: { case: 'c1' } }); }, 'boucle'],
  ['case inconnue', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'zz' }, b: { case: 'c1' } }); }, 'case_inconnue'],
  ['chemin sans case', 'centrale', (m) => {
    m.chemins.push({ id: 'h9', a: { raccord: { cote: 3, pos: 0 } }, b: { coin: 0 } });
  }, 'chemin_sans_case'],
  ['extrémité mal formée', 'bord', (m) => { m.chemins[0].a = {}; }, 'chemin_invalide'],
  ['raccord hors plage', 'bord', (m) => { m.chemins[0].a = { raccord: { cote: 1, pos: 3 } }; }, 'chemin_invalide'],
  ['graphe non connexe', 'bord', (m) => { m.chemins = m.chemins.filter((c) => c.id !== 'h2'); }, 'non_connexe']
];

for (const [nom, role, mutation, attendu] of ECHECS) {
  test('validerModele : ' + nom, () => {
    const m = exemple(role);
    mutation(m);
    const r = M.validerModele(m);
    if (attendu === null) {
      assert.deepStrictEqual(r.erreurs, []);
      assert.strictEqual(r.complet, true);
    } else {
      assert.ok(r.erreurs.some((e) => e.code === attendu), 'attendu ' + attendu + ', obtenu ' + JSON.stringify(codes(m)));
      assert.strictEqual(r.complet, false);
      r.erreurs.forEach((e) => { assert.ok(e.message && typeof e.message === 'string'); assert.ok('ref' in e); });
    }
  });
}

test('validerModele : ref désigne l\'élément fautif', () => {
  const m = exemple('centrale');
  m.cases[1].diametre = 40;
  const e = M.validerModele(m).erreurs.find((x) => x.code === 'diametre');
  assert.deepStrictEqual(e.ref, { type: 'case', id: 'c2' });
});

test('validerModele : règle ajoutée extensible', () => {
  const regle = () => [{ code: 'test', message: 'x', ref: null }];
  M.regles.push(regle);
  try { assert.ok(codes(exemple('bord')).includes('test')); } finally { M.regles.pop(); }
  assert.strictEqual(M.validerModele(exemple('bord')).complet, true);
});

test('validerModele : entrée absente', () => {
  assert.strictEqual(M.validerModele(null).complet, false);
});

/* ---------- forme ---------- */

test('validerForme : formes valides', () => {
  const ok = [
    [], [{ col: 0, lig: 0 }], [{ col: 3, lig: 3 }],
    [{ col: 0, lig: 0 }, { col: 3, lig: 3 }],
    [{ col: 0, lig: 0 }, { col: 3, lig: 0 }],
    [{ col: 0, lig: 0 }, { col: 0, lig: 3 }],
    [{ col: 0, lig: 0 }, { col: 0, lig: 1 }],
    [{ col: 3, lig: 3 }, { col: 3, lig: 2 }]
  ];
  for (const retires of ok) {
    const r = M.validerForme({ retires });
    assert.deepStrictEqual(r.erreurs, [], JSON.stringify(retires));
    assert.strictEqual(r.valide, true);
  }
});

test('validerForme : formes invalides', () => {
  const ko = {
    'bord seul': [{ col: 0, lig: 1 }],
    'apparition': [{ col: 1, lig: 0 }],
    'centrale': [{ col: 1, lig: 1 }],
    'bord non voisin du coin retiré': [{ col: 0, lig: 0 }, { col: 3, lig: 1 }],
    'bord du mauvais coin': [{ col: 0, lig: 0 }, { col: 0, lig: 2 }],
    'trois retraits': [{ col: 0, lig: 0 }, { col: 3, lig: 0 }, { col: 0, lig: 3 }],
    'hors grille': [{ col: 4, lig: 0 }],
    'doublon': [{ col: 0, lig: 0 }, { col: 0, lig: 0 }]
  };
  for (const [nom, retires] of Object.entries(ko)) {
    const r = M.validerForme({ retires });
    assert.strictEqual(r.valide, false, nom);
    assert.ok(r.erreurs.length > 0 && r.erreurs[0].message, nom);
  }
});

test('cellulesActives', () => {
  assert.strictEqual(M.cellulesActives({ retires: [] }).length, 16);
  const c = M.cellulesActives({ retires: [{ col: 0, lig: 0 }] });
  assert.strictEqual(c.length, 15);
  assert.ok(!c.some((x) => x.col === 0 && x.lig === 0));
});

test('rôles, joueurs et rotations déduits sur le 4x4 complet', () => {
  const f = { retires: [] };
  const attendu = (col, lig) => {
    if ((col === 0 || col === 3) && (lig === 0 || lig === 3)) return 'coin';
    if ((lig === 0 || lig === 3)) return 'apparition';
    if (col === 0 || col === 3) return 'bord';
    return 'centrale';
  };
  for (let lig = 0; lig < 4; lig++) for (let col = 0; col < 4; col++) {
    assert.strictEqual(M.roleCellule(col, lig, f), attendu(col, lig), col + ',' + lig);
  }
  assert.strictEqual(M.roleCellule(4, 0, f), null);
  // coins : NO 0, NE 1, SE 2, SO 3
  assert.deepStrictEqual([[0, 0], [3, 0], [3, 3], [0, 3]].map(([c, l]) => M.rotationDeduite(c, l, f)), [0, 1, 2, 3]);
  // bords : O -> 3, E -> 1
  assert.strictEqual(M.rotationDeduite(0, 1, f), 3);
  assert.strictEqual(M.rotationDeduite(3, 2, f), 1);
  // apparitions
  assert.strictEqual(M.rotationDeduite(1, 0, f), 0);
  assert.strictEqual(M.rotationDeduite(2, 3, f), 2);
  assert.strictEqual(M.joueurCellule(1, 0), 1);
  assert.strictEqual(M.joueurCellule(2, 3), 2);
  assert.strictEqual(M.joueurCellule(0, 1), null);
  assert.strictEqual(M.joueurCellule(0, 0), null);
  // centrale
  assert.strictEqual(M.rotationDeduite(1, 1, f), null);
});

test('rôles et rotations sur une forme avec coin retiré', () => {
  const f = { retires: [{ col: 0, lig: 0 }] };
  assert.strictEqual(M.roleCellule(0, 0, f), null);
  assert.strictEqual(M.rotationDeduite(0, 0, f), null);
  // (0,1) : voisins vides au nord et hors grille à l'ouest -> coin NO
  assert.strictEqual(M.roleCellule(0, 1, f), 'coin');
  assert.strictEqual(M.rotationDeduite(0, 1, f), 0);
  // (1,0) reste une apparition
  assert.strictEqual(M.roleCellule(1, 0, f), 'apparition');
  assert.strictEqual(M.rotationDeduite(1, 0, f), 0);
  // (1,1) : voisin nord présent, ouest présent -> centrale
  assert.strictEqual(M.roleCellule(1, 1, f), 'centrale');
  // coin + bord retirés : (0,2) devient coin, (1,1) devient un bord exposé à l'ouest
  const g = { retires: [{ col: 0, lig: 0 }, { col: 0, lig: 1 }] };
  assert.strictEqual(M.roleCellule(0, 2, g), 'coin');
  assert.strictEqual(M.rotationDeduite(0, 2, g), 0);
  assert.strictEqual(M.roleCellule(1, 1, g), 'bord');
  assert.strictEqual(M.rotationDeduite(1, 1, g), 3);
  // coin SE retiré : (3,2) est un coin dont les côtés exposés sont E et S -> rot 2
  const h = { retires: [{ col: 3, lig: 3 }] };
  assert.strictEqual(M.roleCellule(3, 2, h), 'coin');
  assert.strictEqual(M.rotationDeduite(3, 2, h), 2);
});

/* ---------- pose de tuiles ---------- */

test('peutPoserTuile : poses acceptées avec rotation déduite', () => {
  const doc = documentVide();
  assert.deepStrictEqual(M.peutPoserTuile(doc, 'ex-coin', 3, 0), { ok: true, raison: '', rot: 1 });
  assert.strictEqual(M.peutPoserTuile(doc, 'ex-centrale', 1, 1).rot, 0);
  assert.strictEqual(M.peutPoserTuile(doc, 'ex-apparition', 2, 3).rot, 2);
});

test('peutPoserTuile : chaque motif de refus', () => {
  const doc = documentVide({ retires: [{ col: 0, lig: 0 }] });
  const raison = (id, c, l, d) => { const r = M.peutPoserTuile(d || doc, id, c, l); assert.strictEqual(r.ok, false); return r.raison; };
  assert.match(raison('inconnu', 1, 1), /introuvable/);
  assert.match(raison('ex-bord', 4, 0), /hors de la grille/);
  assert.match(raison('ex-coin', 0, 0), /retirée/);
  assert.strictEqual(raison('ex-bord', 0, 1), 'Cette tuile est un bord, la cellule attend un coin.');
  assert.strictEqual(raison('ex-coin', 1, 1), 'Cette tuile est un coin, la cellule attend une centrale.');
  const occupe = M.poserTuile(doc, 'ex-centrale', 1, 1);
  assert.match(raison('ex-centrale', 1, 1, occupe), /occupée/);
  const incomplet = copie(doc);
  incomplet.modeles.find((m) => m.id === 'ex-centrale').cases.pop();
  assert.match(raison('ex-centrale', 1, 1, incomplet), /incomplet/);
  let epuise = documentVide();
  epuise.modeles.find((m) => m.id === 'ex-centrale').exemplaires = 1;
  epuise = M.poserTuile(epuise, 'ex-centrale', 1, 1);
  assert.strictEqual(M.exemplairesRestants(epuise, 'ex-centrale'), 0);
  assert.match(raison('ex-centrale', 2, 1, epuise), /exemplaire/);
  assert.throws(() => M.poserTuile(epuise, 'ex-centrale', 2, 1), /exemplaire/);
});

test('pose / retrait / rotation : fonctions pures', () => {
  const d0 = documentVide();
  const avant = JSON.stringify(d0);
  const d1 = M.poserTuile(d0, 'ex-centrale', 1, 1);
  assert.strictEqual(JSON.stringify(d0), avant);
  assert.strictEqual(d1.plateau.tuiles.length, 1);
  const s1 = JSON.stringify(d1);
  const d2 = M.tournerTuile(d1, 1, 1);
  assert.strictEqual(JSON.stringify(d1), s1);
  assert.strictEqual(M.tuileEn(d2, 1, 1).rot, 1);
  assert.strictEqual(M.tournerTuile(d2, 1, 1, -1).plateau.tuiles[0].rot, 0);
  const s2 = JSON.stringify(d2);
  const d3 = M.retirerTuile(d2, 1, 1);
  assert.strictEqual(JSON.stringify(d2), s2);
  assert.strictEqual(d3.plateau.tuiles.length, 0);
  assert.strictEqual(M.exemplairesRestants(d3, 'ex-centrale'), 4);
  const s0 = JSON.stringify(d0);
  const clone = M.clonerDocument(d0);
  clone.plateau.tuiles.push({});
  assert.strictEqual(JSON.stringify(d0), s0);
});

test('tournerTuile : centrales seulement', () => {
  const d = M.poserTuile(documentVide(), 'ex-bord', 0, 1);
  assert.throws(() => M.tournerTuile(d, 0, 1), /centrales/);
  assert.throws(() => M.tournerTuile(d, 2, 2), /Aucune tuile/);
});

test('T3 : coin canonique ports 0b0100 posé en (3,0) : rot 1, ports 0b1000, compté sur la jonction (3,1)', () => {
  const doc = M.poserTuile(documentVide(), 'ex-coin', 3, 0);
  const t = M.tuileEn(doc, 3, 0);
  assert.strictEqual(t.rot, 1);
  assert.strictEqual(M.masquesDuModele(M.modeleParId(doc, 'ex-coin')).portsCoin, 0b0100);
  assert.strictEqual(G.tournerPorts(0b0100, t.rot), 0b1000);
  assert.deepStrictEqual(M.portsJonction(doc, 3, 1), { ports: 1, tuiles: 1 });
  assert.deepStrictEqual(M.portsJonction(doc, 2, 1), { ports: 0, tuiles: 0 });
});

/* ---------- plateau complet, jetons, raccords morts ---------- */

test('plateau 4x4 complet avec les exemples', () => {
  const doc = plateauComplet();
  assert.strictEqual(doc.plateau.tuiles.length, 16);
  for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) {
    assert.deepStrictEqual(M.portsJonction(doc, i, j), { ports: 4, tuiles: 4 }, i + ',' + j);
    assert.strictEqual(M.peutPoserJeton(doc, i, j).ok, true);
  }
});

test('jetons : pose, cycle, retrait, purs', () => {
  const doc = plateauComplet();
  const avant = JSON.stringify(doc);
  const a = M.poserJeton(doc, 2, 2);
  assert.strictEqual(JSON.stringify(doc), avant);
  assert.deepStrictEqual(a.plateau.jetons, [{ i: 2, j: 2, type: 'capture' }]);
  assert.match(M.peutPoserJeton(a, 2, 2).raison, /déjà/);
  const b = M.cyclerJeton(a, 2, 2);
  assert.strictEqual(b.plateau.jetons[0].type, 'carrefour');
  assert.strictEqual(a.plateau.jetons[0].type, 'capture');
  const c = M.cyclerJeton(b, 2, 2);
  assert.strictEqual(c.plateau.jetons.length, 0);
  const d = M.cyclerJeton(c, 2, 2);
  assert.strictEqual(d.plateau.jetons[0].type, 'capture');
  assert.strictEqual(M.retirerJeton(d, 2, 2).plateau.jetons.length, 0);
  assert.strictEqual(M.poserJeton(doc, 1, 1, 'carrefour').plateau.jetons[0].type, 'carrefour');
  assert.throws(() => M.poserJeton(doc, 1, 1, 'truc'), /Type/);
});

test('jetons : refus hors jonction, moins de 4 tuiles, moins de 2 ports', () => {
  const vide = documentVide();
  assert.match(M.peutPoserJeton(vide, 0, 1).raison, /jonction intérieure/);
  assert.match(M.peutPoserJeton(vide, 4, 1).raison, /jonction intérieure/);
  assert.match(M.peutPoserJeton(vide, 2, 2).raison, /4 tuiles/);
  assert.throws(() => M.poserJeton(vide, 2, 2), /4 tuiles/);
  // 4 tuiles mais un seul port : modèle centrale sans ports sur 3 coins (invalide mais posé directement)
  const doc = documentVide();
  const faible = copie(doc.modeles.find((m) => m.id === 'ex-centrale'));
  faible.id = 'faible';
  faible.chemins = faible.chemins.filter((c) => !(c.b.coin !== undefined && c.b.coin !== 2));
  doc.modeles.push(faible);
  for (const [c, l] of [[1, 1], [2, 1], [1, 2], [2, 2]]) doc.plateau.tuiles.push({ modeleId: 'faible', col: c, lig: l, rot: 0 });
  assert.deepStrictEqual(M.portsJonction(doc, 2, 2), { ports: 1, tuiles: 4 });
  assert.match(M.peutPoserJeton(doc, 2, 2).raison, /ports/);
});

test('retirer une tuile retire les jetons devenus invalides', () => {
  let doc = M.poserJeton(M.poserJeton(plateauComplet(), 1, 1), 3, 3);
  doc = M.retirerTuile(doc, 1, 1);
  assert.deepStrictEqual(doc.plateau.jetons, [{ i: 3, j: 3, type: 'capture' }]);
});

test('T4 : forme sans la cellule (0,0), jeton en (1,1) refusé (3 tuiles)', () => {
  const forme = { retires: [{ col: 0, lig: 0 }] };
  assert.strictEqual(M.validerForme(forme).valide, true);
  let doc = documentVide(forme);
  for (const c of M.cellulesActives(forme)) {
    doc = M.poserTuile(doc, ID[M.roleCellule(c.col, c.lig, forme)], c.col, c.lig);
  }
  assert.strictEqual(doc.plateau.tuiles.length, 15);
  assert.deepStrictEqual(M.portsJonction(doc, 1, 1), { ports: 2, tuiles: 3 });
  const r = M.peutPoserJeton(doc, 1, 1);
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /4 tuiles/);
  assert.strictEqual(M.peutPoserJeton(doc, 2, 2).ok, true);
});

test('T2 sur plateau : raccords vivants et morts', () => {
  // E début (0x008) face à O fin (0x800) : connectés ; avec O début : 2 morts
  const doc = documentVide();
  const a = copie(doc.modeles[0]); a.id = 'a';
  a.chemins = a.chemins.filter((c) => !c.b.raccord); a.chemins.push({ id: 'rA', a: { case: 'c2' }, b: { raccord: { cote: 1, pos: 0 } } });
  const b = copie(doc.modeles[0]); b.id = 'b';
  b.chemins = b.chemins.filter((c) => !c.b.raccord); b.chemins.push({ id: 'rB', a: { case: 'c4' }, b: { raccord: { cote: 3, pos: 2 } } });
  doc.modeles.push(a, b);
  doc.plateau.tuiles.push({ modeleId: 'a', col: 1, lig: 1, rot: 0 }, { modeleId: 'b', col: 2, lig: 1, rot: 0 });
  assert.deepStrictEqual(M.raccordsMorts(doc), []);
  b.chemins.find((c) => c.id === 'rB').b.raccord.pos = 0;
  assert.deepStrictEqual(M.raccordsMorts(doc), [
    { col: 1, lig: 1, cote: 1, pos: 0, raison: 'mort' }, { col: 2, lig: 1, cote: 3, pos: 0, raison: 'mort' }
  ]);
});

test('raccordsMorts : voisin absent ou sans raccord en face, rotation prise en compte', () => {
  let doc = M.poserTuile(documentVide(), 'ex-centrale', 1, 1);
  // 4 raccords (N0, E1, S1, O1) tous sans voisin
  assert.strictEqual(M.raccordsMorts(doc).length, 4);
  doc = M.tournerTuile(doc, 1, 1); // N0 -> E0, E1 -> S1, S1 -> O1, O1 -> N1
  const morts = M.raccordsMorts(doc).map((r) => r.cote + ':' + r.pos).sort();
  assert.deepStrictEqual(morts, ['1:0', '2:1', '3:1', '0:1'].sort());
  // plateau complet : le raccord N0 de (1,1) fait face à l'apparition (1,0), sans raccord au sud
  const plein = plateauComplet();
  const m = M.raccordsMorts(plein);
  assert.ok(m.some((r) => r.col === 1 && r.lig === 1 && r.cote === 0 && r.pos === 0));
  // E1 de (1,1) face à O1 de (2,1) : vivant
  assert.ok(!m.some((r) => r.col === 1 && r.lig === 1 && r.cote === 1));
});

/* =====================================================================
 * Corrections après revue : robustesse, ref structuré, nouvelle API
 * ===================================================================== */

const gel = (o) => {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(gel); }
  return o;
};
const FORME_NO = { retires: [{ col: 0, lig: 0 }] };
function plateauForme(forme) {
  let doc = documentVide(forme);
  for (const c of M.cellulesActives(forme)) {
    doc = M.poserTuile(doc, ID[M.roleCellule(c.col, c.lig, forme)], c.col, c.lig);
  }
  return doc;
}
function clonerAvecForme(doc, forme) { const d = M.clonerDocument(doc); d.plateau.forme = forme; return d; }

/* ---------- robustesse ---------- */

test('validerModele : jamais d\'exception sur données malformées', () => {
  const entrees = [undefined, null, 5, 'x', [], {}, { role: 'bord', cases: null, chemins: 3 },
    { role: 'constructor', cases: [null], chemins: [null, 5, { a: null, b: {} }] },
    { role: '__proto__', id: 'constructor', cases: [{ id: 'toString' }], chemins: [] }];
  for (const e of entrees) {
    assert.doesNotThrow(() => M.validerModele(e), JSON.stringify(e));
    assert.strictEqual(M.validerModele(e).complet, false);
  }
  const m = exemple('bord'); m.cases[0] = null; m.chemins[0] = null;
  assert.doesNotThrow(() => M.validerModele(m));
  assert.ok(codes(m).includes('case_invalide'));
  assert.ok(codes(m).includes('chemin_invalide'));
});

test('validerModele : pure (modèle gelé accepté, rien n\'est modifié)', () => {
  const m = gel(exemple('apparition'));
  const avant = JSON.stringify(m);
  assert.strictEqual(M.validerModele(m).complet, true);
  assert.strictEqual(JSON.stringify(m), avant);
});

test('ids : chaînes non vides exigées, pas de faux doublon pour « constructor »', () => {
  let m = exemple('bord'); m.cases[0].id = 7;
  assert.ok(codes(m).includes('id_invalide'));
  m = exemple('bord'); m.chemins[0].id = '';
  assert.ok(codes(m).includes('id_manquant'));
  m = exemple('bord'); m.id = '';
  assert.ok(codes(m).includes('id_modele'));
  m = exemple('bord'); delete m.id;
  assert.ok(codes(m).includes('id_modele'));
  m = exemple('bord'); m.nom = 3;
  assert.ok(codes(m).includes('nom_invalide'));
  m = exemple('bord'); m.chemins[0].a = { case: 7 };
  assert.ok(codes(m).includes('chemin_invalide'));
  m = exemple('bord'); m.cases[2].id = 'constructor';
  m.chemins.forEach((c) => ['a', 'b'].forEach((s) => { if (c[s].case === 'c3') c[s].case = 'constructor'; }));
  assert.deepStrictEqual(M.validerModele(m).erreurs, []);
});

test('rôle hérité d\'Object.prototype : erreur role_inconnu, pas d\'exception', () => {
  for (const role of ['constructor', 'toString', '__proto__']) {
    const m = exemple('bord'); m.role = role;
    assert.ok(codes(m).includes('role_inconnu'), role);
  }
});

test('validerForme : jamais d\'exception, codes dédiés', () => {
  const cas = {
    retrait_invalide: [{ retires: [null] }, { retires: [{}] }, { retires: [{ col: 'a', lig: 0 }] }, { retires: [5] }],
    forme_invalide: [{ retires: 'x' }, 5, 'x', []]
  };
  for (const [code, formes] of Object.entries(cas)) {
    for (const f of formes) {
      assert.doesNotThrow(() => M.validerForme(f));
      assert.ok(M.validerForme(f).erreurs.some((e) => e.code === code), code + ' ' + JSON.stringify(f));
    }
  }
  assert.strictEqual(M.roleCellule(1, 1, { retires: [null] }), 'centrale');
});

test('validerForme : messages en français, vérifiés par code', () => {
  const msg = (retires, code) => {
    const e = M.validerForme({ retires }).erreurs.find((x) => x.code === code);
    assert.ok(e, code);
    return e.message;
  };
  assert.match(msg([{ col: 1, lig: 1 }], 'cellule_interieure'), /centrale/);
  assert.match(msg([{ col: 0, lig: 1 }], 'bord_seul'), /coin voisin/);
  assert.match(msg([{ col: 1, lig: 0 }], 'apparition_retiree'), /apparition/);
  assert.match(msg([{ col: 0, lig: 0 }, { col: 3, lig: 0 }, { col: 0, lig: 3 }], 'trop_de_retraits'), /au plus 2/);
  assert.match(msg([{ col: 0, lig: 0 }, { col: 0, lig: 0 }], 'doublon'), /deux fois/);
  assert.match(msg([{ col: 9, lig: 0 }], 'hors_grille'), /hors de la grille/);
});

test('tournerTuile : quarts non entier refusé, rot toujours entier 0..3', () => {
  const d = M.poserTuile(documentVide(), 'ex-centrale', 1, 1);
  for (const q of [0.5, NaN, Infinity, 'a', '1', null]) assert.throws(() => M.tournerTuile(d, 1, 1, q), /entier/, String(q));
  for (const q of [-7, -1, 0, 1, 5, 400]) {
    const rot = M.tuileEn(M.tournerTuile(d, 1, 1, q), 1, 1).rot;
    assert.ok(Number.isInteger(rot) && rot >= 0 && rot <= 3, q + ' -> ' + rot);
  }
  assert.strictEqual(M.tuileEn(M.tournerTuile(d, 1, 1, -1), 1, 1).rot, 3);
});

test('rotation d\'une centrale : un jeton qui perd un port est retiré', () => {
  // modèle dont les seuls ports sont aux coins 2 et 3 : 2 ports en (2,2) tant que la tuile (1,1) garde le coin 2
  const doc = documentVide();
  const m2 = copie(doc.modeles.find((m) => m.id === 'ex-centrale'));
  m2.id = 'm2';
  m2.chemins = m2.chemins.filter((c) => !(c.b.coin === 0 || c.b.coin === 1));
  doc.modeles.push(m2);
  for (const [c, l] of [[1, 1], [2, 1], [1, 2], [2, 2]]) doc.plateau.tuiles.push({ modeleId: 'm2', col: c, lig: l, rot: 0 });
  const avecJeton = M.poserJeton(doc, 2, 2);
  assert.strictEqual(M.portsJonction(avecJeton, 2, 2).ports, 2);
  const tourne = M.tournerTuile(avecJeton, 1, 1);
  assert.strictEqual(tourne.plateau.jetons.length, 0);
  assert.strictEqual(avecJeton.plateau.jetons.length, 1);
});

test('clonerDocument(undefined) renvoie undefined', () => {
  assert.strictEqual(M.clonerDocument(undefined), undefined);
});

/* ---------- ref structuré ---------- */

test('ref structuré : type et id selon l\'élément fautif', () => {
  const ref = (m, code) => M.validerModele(m).erreurs.find((e) => e.code === code).ref;
  let m = exemple('bord'); m.chemins = m.chemins.filter((c) => c.id !== 'p2');
  assert.deepStrictEqual(ref(m, 'port_manquant'), { type: 'coin', id: 3 });
  m = exemple('bord'); m.cases.pop();
  assert.deepStrictEqual(ref(m, 'nombre_cases'), { type: 'modele', id: 'ex-bord' });
  m = exemple('bord'); m.chemins.push({ id: 'h9', a: { case: 'c1' }, b: { case: 'c1' } });
  assert.deepStrictEqual(ref(m, 'boucle'), { type: 'chemin', id: 'h9' });
  m = exemple('bord'); m.chemins.push({ id: 'r9', a: { case: 'c3' }, b: { raccord: { cote: 0, pos: 1 } } });
  const r = ref(m, 'raccord_exterieur');
  assert.strictEqual(r.type, 'raccord');
  assert.strictEqual(r.cote, 0); assert.strictEqual(r.pos, 1); assert.strictEqual(r.chemin, 'r9');
  m = exemple('bord'); m.cases[1].x = 80;
  const ch = ref(m, 'chevauchement');
  assert.strictEqual(ch.type, 'case');
  assert.deepStrictEqual(ch.ids, ['c1', 'c2']);
  assert.strictEqual(ch.id, 'c1');
  m = exemple('bord'); m.chemins.push({ id: 'p9', a: { case: 'c1' }, b: { coin: 3 } });
  assert.deepStrictEqual(ref(m, 'ports_case'), { type: 'case', id: 'c1' });
});

test('coin_double : deux chemins vers le même coin', () => {
  const m = exemple('bord');
  m.chemins.push({ id: 'p9', a: { case: 'c3' }, b: { coin: 2 } });
  const e = M.validerModele(m).erreurs.find((x) => x.code === 'coin_double');
  assert.ok(e);
  assert.deepStrictEqual(e.ref, { type: 'coin', id: 2 });
  assert.strictEqual(M.validerModele(m).complet, false);
});

test('coin : les deux côtés intérieurs sont exigés (message avec le nombre de côtés)', () => {
  const m = exemple('coin');
  m.chemins = m.chemins.filter((c) => c.id !== 'r2');
  const e = M.validerModele(m).erreurs.find((x) => x.code === 'cotes_raccord');
  assert.match(e.message, /au moins 2 côtés \(il y en a 1\)/);
});

/* ---------- pose et forme invalide ---------- */

test('peutPoserTuile : refus tant que la forme est invalide', () => {
  const doc = documentVide({ retires: [{ col: 1, lig: 1 }] });
  const r = M.peutPoserTuile(doc, 'ex-coin', 0, 0);
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /forme/);
  assert.throws(() => M.poserTuile(doc, 'ex-coin', 0, 0), /forme/);
});

/* ---------- raccordsMorts : raisons ---------- */

test('raccordsMorts : raisons absent / vide / mort', () => {
  let doc = M.poserTuile(documentVide(FORME_NO), 'ex-apparition', 1, 0);
  assert.deepStrictEqual(M.raccordsMorts(doc), [
    { col: 1, lig: 0, cote: 1, pos: 1, raison: 'absent' },
    { col: 1, lig: 0, cote: 3, pos: 1, raison: 'vide' }
  ]);
  doc = M.poserTuile(doc, 'ex-centrale', 1, 1);
  const morts = M.raccordsMorts(doc);
  assert.ok(morts.some((r) => r.col === 1 && r.lig === 1 && r.cote === 0 && r.pos === 0 && r.raison === 'mort'));
  // les raccords tournés vers l'extérieur de la grille sont « vide » : coin (3,3) rot 2, raccords E et S d'origine
  const coin = M.poserTuile(documentVide(), 'ex-coin', 3, 3);
  assert.ok(M.raccordsMorts(coin).every((r) => r.raison === 'absent'));
  // une centrale au bord de la grille ne peut pas exister, mais un document peut en contenir une : hors grille = vide
  const hors = documentVide();
  hors.plateau.tuiles.push({ modeleId: 'ex-centrale', col: 0, lig: 1, rot: 0 });
  const vides = M.raccordsMorts(hors).filter((r) => r.raison === 'vide');
  assert.deepStrictEqual(vides.map((r) => [r.cote, r.pos]), [[3, 1]]);
});

/* ---------- verifierTuilePosee / validerPlateau ---------- */

test('validerPlateau : plateau complet sans erreur, alertes de raccords morts seulement', () => {
  const doc = plateauComplet();
  const r = M.validerPlateau(doc);
  assert.deepStrictEqual(r.erreurs, []);
  assert.ok(r.alertes.length > 0);
  assert.ok(r.alertes.every((a) => a.code === 'raccord_mort' && a.ref.type === 'raccord'));
  assert.deepStrictEqual(M.validerPlateau(M.nouveauDocument()), { erreurs: [], alertes: [] });
});

test('verifierTuilePosee : chaque motif d\'erreur', () => {
  const doc = plateauComplet();
  const code = (d, t) => M.verifierTuilePosee(d, t).map((e) => e.code);
  assert.deepStrictEqual(code(doc, M.tuileEn(doc, 0, 0)), []);
  const t = (changes) => Object.assign({}, M.tuileEn(doc, 0, 0), changes);
  assert.ok(code(doc, t({ rot: 1 })).includes('rot_incorrecte'));
  assert.ok(code(doc, t({ rot: 0.5 })).includes('rot_invalide'));
  assert.ok(code(doc, t({ rot: 4 })).includes('rot_invalide'));
  assert.ok(code(doc, t({ modeleId: 'ex-bord' })).includes('role_incorrect'));
  assert.ok(code(doc, t({ modeleId: 'inconnu' })).includes('modele_absent'));
  assert.ok(code(doc, t({ col: 5 })).includes('hors_grille'));
  const retiree = clonerAvecForme(doc, FORME_NO);
  assert.ok(code(retiree, M.tuileEn(doc, 0, 0)).includes('cellule_retiree'));
  const doublon = M.clonerDocument(doc); doublon.plateau.tuiles.push({ modeleId: 'ex-coin', col: 0, lig: 0, rot: 0 });
  assert.ok(code(doublon, M.tuileEn(doublon, 0, 0)).includes('doublon'));
  const incomplet = M.clonerDocument(doc); incomplet.modeles.find((m) => m.id === 'ex-coin').cases.pop();
  assert.ok(code(incomplet, M.tuileEn(incomplet, 0, 0)).includes('modele_incomplet'));
  assert.deepStrictEqual(M.verifierTuilePosee(doc, t({ rot: 1 }))[0].ref, { type: 'tuile', col: 0, lig: 0 });
});

test('validerPlateau : forme, exemplaires dépassés, jetons invalides', () => {
  let doc = plateauComplet();
  doc.plateau.forme = { retires: [{ col: 1, lig: 1 }] };
  assert.ok(M.validerPlateau(doc).erreurs.some((e) => e.code === 'cellule_interieure' && e.ref.type === 'forme'));
  doc = plateauComplet();
  doc.modeles.find((m) => m.id === 'ex-centrale').exemplaires = 3;
  const e1 = M.validerPlateau(doc).erreurs.find((e) => e.code === 'exemplaires_depasses');
  assert.deepStrictEqual(e1.ref, { type: 'modele', id: 'ex-centrale' });
  doc = plateauComplet();
  doc.plateau.jetons.push({ i: 0, j: 0, type: 'capture' });
  const e2 = M.validerPlateau(doc).erreurs.find((e) => e.code === 'jeton_invalide');
  assert.deepStrictEqual(e2.ref, { type: 'jeton', i: 0, j: 0 });
});

test('validerPlateau : alerte de port mort', () => {
  const r = M.validerPlateau(plateauForme(FORME_NO));
  assert.strictEqual(r.alertes.filter((a) => a.code === 'port_mort').length, 2);
});

/* ---------- forme, jonctions, ports morts ---------- */

test('changerForme : retire les tuiles, recalcule les rotations, nettoie les jetons, pure', () => {
  const plein = M.poserJeton(plateauComplet(), 1, 1);
  const avant = JSON.stringify(plein);
  const doc = M.changerForme(plein, FORME_NO);
  assert.strictEqual(JSON.stringify(plein), avant);
  assert.deepStrictEqual(doc.plateau.forme, FORME_NO);
  assert.strictEqual(M.tuileEn(doc, 0, 0), null);
  assert.strictEqual(doc.plateau.tuiles.length, 15);
  assert.strictEqual(M.tuileEn(doc, 0, 1).rot, 0);       // ex-bord, rot 3 -> 0 (cellule devenue coin)
  assert.strictEqual(M.tuileEn(doc, 1, 1).rot, 0);       // centrale inchangée
  assert.deepStrictEqual(doc.plateau.jetons, []);
  assert.ok(M.validerPlateau(doc).erreurs.some((e) => e.code === 'role_incorrect'));
  assert.throws(() => M.changerForme(plein, { retires: [{ col: 1, lig: 1 }] }), /centrale/);
  // retour à la forme complète
  assert.deepStrictEqual(M.changerForme(doc, { retires: [] }).plateau.forme, { retires: [] });
});

test('jonctionPossible', () => {
  assert.strictEqual(M.jonctionPossible({ retires: [] }, 2, 2), true);
  assert.strictEqual(M.jonctionPossible({ retires: [] }, 0, 1), false);
  assert.strictEqual(M.jonctionPossible({ retires: [] }, 4, 2), false);
  assert.strictEqual(M.jonctionPossible({ retires: [] }, 1.5, 2), false);
  assert.strictEqual(M.jonctionPossible(FORME_NO, 1, 1), false);
  assert.strictEqual(M.jonctionPossible(FORME_NO, 2, 1), true);
  assert.strictEqual(M.jonctionPossible(FORME_NO, 1, 2), true);
  const deux = { retires: [{ col: 0, lig: 0 }, { col: 0, lig: 1 }] };
  assert.strictEqual(M.jonctionPossible(deux, 1, 2), false);
  assert.strictEqual(M.jonctionPossible(deux, 1, 3), true);
});

test('portsCoinMorts', () => {
  assert.deepStrictEqual(M.portsCoinMorts(plateauComplet()), []);
  const morts = M.portsCoinMorts(plateauForme(FORME_NO));
  assert.deepStrictEqual(morts, [
    { col: 1, lig: 0, coin: 3, i: 1, j: 1 },
    { col: 1, lig: 1, coin: 0, i: 1, j: 1 }
  ]);
});

test('jetonsInvalides : type, doublon, jonction, tuiles, ports', () => {
  const doc = plateauComplet();
  assert.deepStrictEqual(M.jetonsInvalides(doc), []);
  doc.plateau.jetons.push({ i: 2, j: 2, type: 'capture' }, { i: 2, j: 2, type: 'carrefour' },
    { i: 0, j: 1, type: 'capture' }, { i: 1, j: 1, type: 'ville' }, null);
  const inv = M.jetonsInvalides(doc);
  assert.strictEqual(inv.length, 4);
  assert.deepStrictEqual(inv.map((x) => [x.i, x.j, x.type]), [[2, 2, 'carrefour'], [0, 1, 'capture'], [1, 1, 'ville'], [undefined, undefined, undefined]]);
  inv.forEach((x) => assert.ok(typeof x.raison === 'string' && x.raison.length > 0));
  const seul = documentVide(); seul.plateau.jetons.push({ i: 2, j: 2, type: 'capture' });
  assert.match(M.jetonsInvalides(seul)[0].raison, /4 tuiles/);
});

/* ---------- tuileEnPlateau ---------- */

test('tuileEnPlateau : cases en mm plateau, arêtes, raccords et ports après rotation', () => {
  const doc = M.poserTuile(M.poserTuile(documentVide(), 'ex-coin', 3, 0), 'ex-apparition', 1, 3);
  const avant = JSON.stringify(doc);
  const c = M.tuileEnPlateau(doc, M.tuileEn(doc, 3, 0));
  assert.deepStrictEqual(c.cases[0], { id: '3,0:c1', x: 395, y: 85, diametre: 24, type: 'deplacement', joueur: null });
  assert.deepStrictEqual(c.cases[1], { id: '3,0:c2', x: 440, y: 85, diametre: 24, type: 'deplacement', joueur: null });
  assert.deepStrictEqual(c.aretes, [['3,0:c1', '3,0:c2'], ['3,0:c1', '3,0:c3']]);
  assert.deepStrictEqual(c.raccords, [
    { cote: 2, pos: 1, caseId: '3,0:c2' }, { cote: 3, pos: 1, caseId: '3,0:c3' }
  ]);
  assert.deepStrictEqual(c.ports, [{ coin: 3, caseId: '3,0:c1', i: 3, j: 1 }]);
  const a = M.tuileEnPlateau(doc, M.tuileEn(doc, 1, 3));
  assert.deepStrictEqual(a.cases[2], { id: '1,3:c3', x: 180, y: 440, diametre: 24, type: 'apparition', joueur: 2 });
  assert.strictEqual(M.tuileEnPlateau(doc, { modeleId: 'x', col: 0, lig: 0, rot: 0 }), null);
  assert.strictEqual(JSON.stringify(doc), avant);
  // cohérence avec les masques : les raccords exportés sont ceux du masque tourné
  const bits = c.raccords.reduce((m, r) => m | (1 << G.bitRaccord(r.cote, r.pos)), 0);
  assert.strictEqual(bits, M.masquesTuilePosee(doc, M.tuileEn(doc, 3, 0)).raccords);
});

/* ---------- bibliothèque de modèles ---------- */

test('ajouterModele / remplacerModele / supprimerModele / changerExemplaires', () => {
  const doc = M.poserTuile(M.poserTuile(documentVide(), 'ex-centrale', 1, 1), 'ex-centrale', 2, 1);
  const avant = JSON.stringify(doc);
  // ajouter
  const nouveau = exemple('bord'); nouveau.id = 'bord2';
  const a = M.ajouterModele(doc, nouveau);
  assert.strictEqual(a.modeles.length, 5);
  nouveau.nom = 'modifié après coup';
  assert.notStrictEqual(M.modeleParId(a, 'bord2').nom, 'modifié après coup');
  assert.throws(() => M.ajouterModele(doc, exemple('bord')), /déjà/);
  assert.throws(() => M.ajouterModele(doc, { id: '' }), /identifiant/);
  // remplacer
  const rem = exemple('centrale'); rem.nom = 'Autre nom';
  assert.strictEqual(M.modeleParId(M.remplacerModele(doc, 'ex-centrale', rem), 'ex-centrale').nom, 'Autre nom');
  const autreRole = exemple('bord'); autreRole.id = 'ex-centrale';
  assert.throws(() => M.remplacerModele(doc, 'ex-centrale', autreRole), /rôle/);
  const autreId = exemple('centrale'); autreId.id = 'zzz';
  assert.throws(() => M.remplacerModele(doc, 'ex-centrale', autreId), /identifiant/);
  assert.throws(() => M.remplacerModele(doc, 'inconnu', rem), /introuvable/);
  // un modèle non posé peut changer de rôle
  const bordEnCentrale = exemple('centrale'); bordEnCentrale.id = 'ex-bord';
  assert.strictEqual(M.modeleParId(M.remplacerModele(doc, 'ex-bord', bordEnCentrale), 'ex-bord').role, 'centrale');
  // supprimer
  assert.throws(() => M.supprimerModele(doc, 'ex-centrale'), /posé 2 fois/);
  assert.throws(() => M.supprimerModele(doc, 'inconnu'), /introuvable/);
  assert.strictEqual(M.supprimerModele(doc, 'ex-coin').modeles.length, 3);
  // exemplaires
  assert.strictEqual(M.exemplairesRestants(M.changerExemplaires(doc, 'ex-centrale', 2), 'ex-centrale'), 0);
  assert.throws(() => M.changerExemplaires(doc, 'ex-centrale', 1), /2 tuile/);
  assert.throws(() => M.changerExemplaires(doc, 'ex-centrale', 1.5), /entier/);
  assert.throws(() => M.changerExemplaires(doc, 'ex-centrale', -1), /entier/);
  assert.throws(() => M.changerExemplaires(doc, 'inconnu', 3), /introuvable/);
  assert.strictEqual(JSON.stringify(doc), avant);
});

test('remplacerModele : retire les jetons devenus invalides', () => {
  let doc = M.poserJeton(plateauComplet(), 2, 2);
  const faible = exemple('centrale');
  faible.chemins = faible.chemins.filter((c) => c.b.coin === undefined || c.b.coin === 2);
  doc = M.remplacerModele(doc, 'ex-centrale', faible);
  assert.deepStrictEqual(doc.plateau.jetons, []);
});

test('exemples : tableau gelé, copieExemples modifiable et indépendante', () => {
  assert.throws(() => { M.exemples[0].nom = 'x'; }, TypeError);
  assert.throws(() => { M.exemples.push({}); }, TypeError);
  const c = M.copieExemples();
  c[0].nom = 'modifié';
  assert.notStrictEqual(M.exemples[0].nom, 'modifié');
  assert.deepStrictEqual(M.copieExemples(), JSON.parse(JSON.stringify(M.exemples)));
  assert.strictEqual(M.copieExemples().every((m) => M.validerModele(m).complet), true);
});

test('nouvelId : premier identifiant libre', () => {
  const m = exemple('bord');
  assert.strictEqual(M.nouvelId(m, 'c'), 'c4');
  assert.strictEqual(M.nouvelId(m, 'h'), 'h3');
  assert.strictEqual(M.nouvelId(m, 'z'), 'z1');
  assert.strictEqual(M.nouvelId(m), 'x1');
  m.cases = m.cases.filter((c) => c.id !== 'c1');
  assert.strictEqual(M.nouvelId(m, 'c'), 'c1');
  assert.strictEqual(M.nouvelId({}, 'c'), 'c1');
  assert.strictEqual(M.nouvelId({ cases: [{ id: 'constructor1' }] }, 'constructor'), 'constructor2');
});

test('jonctionDuCoin', () => {
  assert.deepStrictEqual(M.jonctionDuCoin(3, 0, 3), { i: 3, j: 1 });
  assert.deepStrictEqual(M.jonctionDuCoin(1, 1, 0), { i: 1, j: 1 });
  assert.deepStrictEqual(M.jonctionDuCoin(1, 1, 2), { i: 2, j: 2 });
});
