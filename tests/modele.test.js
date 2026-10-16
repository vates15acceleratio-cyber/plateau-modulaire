'use strict';
/*
 * Tests du modèle (src/modele.js), règles de la version 2 (docs/18, docs/20 D1 à D3 et arbitrages).
 * Données : PM.modele.copieExemples() (étoile, bord en V, coin raccourci, conformes R1 à R4).
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;

/* ---------- outils de test ---------- */
const copie = (o) => JSON.parse(JSON.stringify(o));
const exemple = (gabarit, grille) => copie(M.copieExemples(grille).find((m) => m.gabarit === gabarit));
const codes = (modele, grille) => M.validerModele(modele, grille).erreurs.map((e) => e.code);
const codesAlertes = (modele, grille) => M.validerModele(modele, grille).alertes.map((e) => e.code);
const ID = { centrale: 'ex-centrale', bord: 'ex-bord', coin: 'ex-coin' };

function documentVide(grille) {
  const doc = M.nouveauDocument(grille);
  doc.modeles = M.copieExemples(grille);
  return doc;
}

/** Pose forcée (sans contrôle de rôle), comme dans un document ancien ou chargé : pour tester les alertes de place. */
function forcer(doc, modeleId, col, lig, rot) {
  const d = copie(doc);
  d.plateau.tuiles.push({ modeleId, col, lig, rot: rot || 0 });
  return d;
}

/** Pose toutes les tuiles de la grille avec les exemples, chacune à sa place (rotation suggérée). */
function plateauComplet(grille) {
  let doc = documentVide(grille);
  const F = M.formatDuDocument(doc);
  for (let lig = 0; lig < F.GRILLE.lignes; lig++) {
    for (let col = 0; col < F.GRILLE.colonnes; col++) doc = M.poserTuile(doc, ID[M.gabaritCellule(col, lig, F)], col, lig);
  }
  return doc;
}

/* ---------- exemples et masques ---------- */

test('exemples : 3 gabarits, complets et sans alerte, dans les deux formats', () => {
  assert.strictEqual(M.exemples.length, 3);
  assert.deepStrictEqual(M.exemples.map((m) => m.gabarit).sort(), ['bord', 'centrale', 'coin']);
  for (const grille of ['4x4', '5x5']) {
    for (const m of M.copieExemples(grille)) {
      const r = M.validerModele(m, grille);
      assert.deepStrictEqual(r.erreurs, [], grille + ' ' + m.id);
      assert.deepStrictEqual(r.alertes, [], grille + ' ' + m.id);
      assert.strictEqual(r.complet, true);
      assert.strictEqual(m.grille, grille);
    }
  }
});

test('masques calculés depuis les chemins (raccourci de coin et de bord, docs/20 D5)', () => {
  assert.deepStrictEqual(M.masquesDuModele(exemple('coin')), { raccords: 0x108, portsCoin: 0b0100 });
  assert.deepStrictEqual(M.masquesDuModele(exemple('bord')), { raccords: 0x808 | (1 << G.bitRaccord(2, 1)), portsCoin: 0b1100 });
  assert.strictEqual(M.masquesDuModele(exemple('centrale')).portsCoin, 0xF);
});

/* ---------- règles physiques : erreurs bloquantes ---------- */

/** Chaque entrée : [nom, gabarit, mutation, code attendu]. */
const ECHECS = [
  ['exemplaires invalides', 'bord', (m) => { m.exemplaires = -1; }, 'exemplaires_invalides'],
  ['id double', 'bord', (m) => { m.chemins[1].id = 'h1'; }, 'id_double'],
  ['id manquant', 'bord', (m) => { delete m.cases[0].id; }, 'id_manquant'],
  ['type de case inconnu', 'bord', (m) => { m.cases[0].type = 'capture'; }, 'type_case'],
  ['case invalide', 'bord', (m) => { m.cases[0].x = 'a'; }, 'case_invalide'],
  ['diamètre trop grand', 'bord', (m) => { m.cases[0].diametre = 34; }, 'diametre'],
  ['hors tuile (marge 4 mm)', 'bord', (m) => { m.cases[2].y = 15; }, 'hors_tuile'],
  ['chevauchement', 'bord', (m) => { m.cases[1].x = 70; m.cases[1].y = 50; }, 'chevauchement'],
  ['zone de coin', 'centrale', (m) => { m.cases[1].x = 20; m.cases[1].y = 20; }, 'zone_coin'],
  ['raccord utilisé deux fois', 'bord', (m) => { m.chemins.push({ id: 'r9', a: { case: 'c1' }, b: { raccord: { cote: 1, pos: 0 } } }); }, 'raccord_double'],
  ['coin utilisé deux fois', 'bord', (m) => { m.chemins.push({ id: 'p9', a: { case: 'c3' }, b: { coin: 2 } }); }, 'coin_double'],
  ['chemin en double', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'c1' }, b: { case: 'c3' } }); }, 'chemin_double'],
  ['boucle sur soi-même', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'c1' }, b: { case: 'c1' } }); }, 'boucle'],
  ['case inconnue', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'zz' }, b: { case: 'c1' } }); }, 'case_inconnue'],
  ['chemin sans case', 'centrale', (m) => { m.chemins.push({ id: 'h9', a: { raccord: { cote: 3, pos: 0 } }, b: { coin: 0 } }); }, 'chemin_sans_case'],
  ['extrémité mal formée', 'bord', (m) => { m.chemins[0].a = {}; }, 'chemin_invalide'],
  ['raccord hors plage', 'bord', (m) => { m.chemins[0].a = { raccord: { cote: 1, pos: 3 } }; }, 'chemin_invalide'],
  // T3 de docs/20 : raccord p0 issu du centre de l'étoile, trop près de la case porteuse NO
  ['chemin contre une case (T3)', 'centrale', (m) => { m.chemins.push({ id: 'r9', a: { case: 'c0' }, b: { raccord: { cote: 0, pos: 0 } } }); }, 'chemin_case'],
  ['chemins croisés', 'bord', (m) => { m.chemins.push({ id: 'h9', a: { case: 'c1' }, b: { case: 'c2' } }); }, 'chemins_croises'],
  ['chemin dans une zone de coin', 'centrale', (m) => {
    m.cases.push({ id: 'c8', x: 6, y: 26, diametre: 4, type: 'deplacement' }, { id: 'c9', x: 26, y: 6, diametre: 4, type: 'deplacement' });
    m.chemins.push({ id: 'h9', a: { case: 'c8' }, b: { case: 'c9' } });
  }, 'amorce_zone'],
  ['case reliée à rien', 'centrale', (m) => { m.cases.push({ id: 'c9', x: 60, y: 100, diametre: 10, type: 'deplacement' }); }, 'case_isolee'],
  ['tuile d\'une autre grille', 'bord', (m) => { m.grille = '5x5'; }, 'grille_modele']
];

for (const [nom, gabarit, mutation, attendu] of ECHECS) {
  test('validerModele, erreur : ' + nom, () => {
    const m = exemple(gabarit);
    mutation(m);
    const r = M.validerModele(m);
    assert.ok(r.erreurs.some((e) => e.code === attendu), 'attendu ' + attendu + ', obtenu ' + JSON.stringify(codes(m)));
    assert.strictEqual(r.complet, false);
    r.erreurs.forEach((e) => { assert.ok(e.message && typeof e.message === 'string'); assert.ok('ref' in e); assert.ok(!('alerte' in e)); });
  });
}

test('validerModele : marge exactement 4 mm acceptée', () => {
  const m = exemple('bord');
  m.cases[2].y = 16;
  assert.deepStrictEqual(codes(m), []);
});

test('T3 (docs/20) : distance porteuse – segment 9,8 mm en 5×5 (seuil 16) et 9,6 mm en 4×4 (seuil 19) : chemin_case', () => {
  for (const [grille, p, D] of [['5x5', 28, 24], ['4x4', 32, 30]]) {
    const C = G.format(grille).COTE, k = (id, x, y) => ({ id, x, y, diametre: D, type: 'deplacement' });
    const m = { id: 't3', gabarit: 'centrale', exemplaires: 1, cases: [k('c0', C / 2, C / 2), k('c1', p, p)],
      chemins: [{ id: 'h1', a: { case: 'c0' }, b: { case: 'c1' } }, { id: 'r1', a: { case: 'c0' }, b: { raccord: { cote: 0, pos: 0 } } }] };
    const t = G.tracesModele(m, grille).find((x) => x.id === 'r1'), a = t.pts[1], b = t.pts[2], c = m.cases[1];
    const d = Math.abs((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / Math.hypot(b.x - a.x, b.y - a.y);
    assert.strictEqual(Math.round(d * 10) / 10, grille === '5x5' ? 9.8 : 9.6);
    assert.ok(codes(m, grille).includes('chemin_case'), grille);
    // au milieu (p1), le même raccord est accepté
    m.chemins[1].b.raccord.pos = 1;
    assert.ok(!codes(m, grille).includes('chemin_case'), grille);
  }
});

/* ---------- R1 à R4 et règles de place : alertes, jamais bloquantes ---------- */

const ALERTES = [
  ['gabarit non déclaré', 'bord', (m) => { delete m.gabarit; }, 'gabarit_inconnu'],
  ['plus d\'une case d\'apparition', 'centrale', (m) => { m.cases[0].type = 'apparition'; m.cases[1].type = 'apparition'; }, 'plusieurs_apparitions'],
  ['bord sans case d\'apparition', 'bord', (m) => { m.cases[2].type = 'deplacement'; }, 'sans_apparition'],
  ['coin sans case d\'apparition', 'coin', (m) => { m.cases[1].type = 'deplacement'; }, 'sans_apparition'],
  ['R1 : deux ports sur une case', 'centrale', (m) => {
    m.cases = m.cases.filter((c) => c.id !== 'c2');
    m.chemins = m.chemins.filter((c) => ['h2', 'p2', 'r2', 'r1'].indexOf(c.id) < 0);
    m.chemins.push({ id: 'p9', a: { case: 'c1' }, b: { coin: 1 } });
  }, 'ports_case'],
  ['R2 : porteuses reliées', 'centrale', (m) => {
    m.chemins = m.chemins.filter((c) => c.id !== 'r1');
    m.chemins.push({ id: 'h9', a: { case: 'c1' }, b: { case: 'c2' } });
  }, 'porteuses_reliees'],
  ['R3 : raccord sur une porteuse', 'centrale', (m) => { m.chemins.push({ id: 'r9', a: { case: 'c1' }, b: { raccord: { cote: 0, pos: 0 } } }); }, 'raccord_porteuse'],
  ['R4 : port sur la case d\'apparition', 'coin', (m) => { m.chemins.push({ id: 'p9', a: { case: 'c2' }, b: { coin: 0 } }); }, 'port_apparition'],
  ['raccord sur le côté extérieur d\'un bord', 'bord', (m) => { m.chemins.push({ id: 'r9', a: { case: 'c3' }, b: { raccord: { cote: 0, pos: 1 } } }); }, 'raccord_exterieur'],
  ['port sur un coin extérieur d\'un coin', 'coin', (m) => { m.chemins.push({ id: 'p9', a: { case: 'c2' }, b: { coin: 0 } }); }, 'port_exterieur'],
  ['réseau sans sortie', 'bord', (m) => {
    m.cases.push({ id: 'c8', x: 100, y: 50, diametre: 10, type: 'deplacement' }, { id: 'c9', x: 100, y: 66, diametre: 10, type: 'deplacement' });
    m.chemins.push({ id: 'h9', a: { case: 'c8' }, b: { case: 'c9' } });
  }, 'reseau_sans_sortie'],
  ['poche : case en impasse accrochée à une case qui a une sortie', 'bord', (m) => {
    m.cases.push({ id: 'c8', x: 100, y: 50, diametre: 10, type: 'deplacement' });
    m.chemins.push({ id: 'h9', a: { case: 'c8' }, b: { case: 'c3' } });
  }, 'poche']
];

for (const [nom, gabarit, mutation, attendu] of ALERTES) {
  test('validerModele, alerte : ' + nom, () => {
    const m = exemple(gabarit);
    mutation(m);
    const r = M.validerModele(m);
    assert.ok(r.alertes.some((e) => e.code === attendu), 'attendu ' + attendu + ', obtenu ' + JSON.stringify(r.alertes.map((e) => e.code)));
    assert.deepStrictEqual(r.erreurs, [], 'une alerte ne bloque pas : ' + JSON.stringify(codes(m)));
    assert.strictEqual(r.complet, true);
    r.alertes.forEach((e) => { assert.ok(e.message && typeof e.message === 'string'); assert.ok('ref' in e); });
  });
}

test('alerte `poche` : définition précise (un seul chemin, vers une case, ni raccord ni port, pas la case d\'apparition)', () => {
  const avecPoche = (m) => {
    m.cases.push({ id: 'c8', x: 100, y: 50, diametre: 10, type: 'deplacement' });
    m.chemins.push({ id: 'h9', a: { case: 'c8' }, b: { case: 'c3' } });
    return m;
  };
  // la poche est signalée, avec une phrase claire et la case en référence
  const m = avecPoche(exemple('bord'));
  const a = M.validerModele(m).alertes.filter((x) => x.code === 'poche');
  assert.strictEqual(a.length, 1);
  assert.deepStrictEqual(a[0].ref, { type: 'case', id: 'c8' });
  assert.match(a[0].message, /^La case c8 est une poche : un seul chemin y mène et elle n'a ni raccord ni port/);
  assert.strictEqual(M.validerModele(m).complet, true); // alerte, pas erreur
  // pas une poche : une case en bout de chaîne qui porte un raccord, ou un port
  const raccord = avecPoche(exemple('bord'));
  raccord.chemins.push({ id: 'r9', a: { case: 'c8' }, b: { raccord: { cote: 3, pos: 1 } } });
  assert.ok(!codesAlertes(raccord).includes('poche'));
  const port = avecPoche(exemple('bord'));
  port.chemins.push({ id: 'p9', a: { case: 'c8' }, b: { coin: 2 } });
  assert.ok(!codesAlertes(port).includes('poche'));
  // pas une poche : une case à deux chemins (boucle ou passage)
  const boucle = avecPoche(exemple('bord'));
  boucle.chemins.push({ id: 'h8', a: { case: 'c8' }, b: { case: 'c2' } });
  assert.ok(!codesAlertes(boucle).includes('poche'));
  // pas une poche : la case d'apparition en bout de chaîne (elle sert au jeu)
  const appar = exemple('coin');
  appar.chemins = appar.chemins.filter((c) => c.id !== 'r1' && c.id !== 'r2'); // c2 (apparition) n'a plus que le lien h1
  assert.ok(!codesAlertes(appar).includes('poche'));
  // un réseau entier sans sortie reste signalé par `reseau_sans_sortie` seulement
  const reseau = exemple('bord');
  reseau.cases.push({ id: 'c8', x: 100, y: 50, diametre: 10, type: 'deplacement' }, { id: 'c9', x: 100, y: 66, diametre: 10, type: 'deplacement' });
  reseau.chemins.push({ id: 'h9', a: { case: 'c8' }, b: { case: 'c9' } });
  assert.ok(codesAlertes(reseau).includes('reseau_sans_sortie') && !codesAlertes(reseau).includes('poche'));
  // les exemples fournis n'ont aucune poche
  for (const grille of ['4x4', '5x5']) for (const x of M.copieExemples(grille)) assert.ok(!codesAlertes(x, grille).includes('poche'), x.id);
});

test('R1 à R4 : la phrase explique le risque pour l\'écart entre villes', () => {
  const m = exemple('centrale');
  m.chemins.push({ id: 'r9', a: { case: 'c1' }, b: { raccord: { cote: 0, pos: 0 } } });
  const a = M.validerModele(m).alertes.find((x) => x.code === 'raccord_porteuse');
  assert.match(a.message, /rapprocher deux villes à moins de 3 cases/);
  assert.deepStrictEqual(a.ref, { type: 'case', id: 'c1' });
});

test('validerModele : ref désigne l\'élément fautif ; règle ajoutée extensible ; entrée absente', () => {
  const m = exemple('centrale');
  m.cases[1].diametre = 40;
  assert.deepStrictEqual(M.validerModele(m).erreurs.find((x) => x.code === 'diametre').ref, { type: 'case', id: 'c1' });
  M.regles.push(() => [{ code: 'test', message: 'x', ref: null }]);
  try { assert.ok(codes(exemple('bord')).includes('test')); } finally { M.regles.pop(); }
  assert.strictEqual(M.validerModele(exemple('bord')).complet, true);
  const r = M.validerModele(null);
  assert.strictEqual(r.complet, false);
  assert.deepStrictEqual(r.alertes, []);
});

test('validerModele : jamais d\'exception sur données malformées, pure sur un modèle gelé', () => {
  for (const m of [{}, { cases: 3 }, { cases: [null, 1, 'a'], chemins: [null, {}, { a: 1, b: 2 }] }, { gabarit: 'constructor', chemins: [{ a: { case: 'x' }, b: { raccord: {} } }] }]) {
    const r = M.validerModele(m);
    assert.strictEqual(r.complet, false);
    assert.ok(Array.isArray(r.alertes));
  }
  const gele = Object.freeze(exemple('bord'));
  assert.doesNotThrow(() => M.validerModele(gele));
});

test('ids : chaînes non vides exigées, pas de faux doublon pour « constructor »', () => {
  const m = exemple('bord');
  m.cases[0].id = 'constructor';
  m.chemins.forEach((c) => { if (c.a.case === 'c1') c.a.case = 'constructor'; if (c.b.case === 'c1') c.b.case = 'constructor'; });
  assert.deepStrictEqual(codes(m), []);
  m.cases[1].id = 5;
  assert.ok(codes(m).includes('id_invalide'));
});

/* ---------- cellules, camps, rotations suggérées ---------- */

test('gabaritCellule et campCellule (4×4 : 2 rangées par camp ; 5×5 : rangée centrale neutre)', () => {
  assert.strictEqual(M.gabaritCellule(0, 0), 'coin');
  assert.strictEqual(M.gabaritCellule(1, 0), 'bord');
  assert.strictEqual(M.gabaritCellule(1, 1), 'centrale');
  assert.strictEqual(M.gabaritCellule(4, 0), null);
  assert.strictEqual(M.gabaritCellule(4, 2, '5x5'), 'bord');
  assert.deepStrictEqual([0, 1, 2, 3].map((l) => M.campCellule('4x4', 0, l)), ['vert', 'vert', 'rouge', 'rouge']);
  assert.deepStrictEqual([0, 1, 2, 3, 4].map((l) => M.campCellule('5x5', 2, l)), ['vert', 'vert', null, 'rouge', 'rouge']);
  assert.strictEqual(M.campCellule('4x4', 0, 4), null);
  assert.strictEqual(M.campCellule('4x4', 0, 1.5), null);
});

test('rotationDeduite : suggestion pour un bord ou un coin à sa place, null sinon', () => {
  assert.strictEqual(M.rotationDeduite(1, 0, 'bord'), 0);
  assert.strictEqual(M.rotationDeduite(3, 1, 'bord'), 1);
  assert.strictEqual(M.rotationDeduite(2, 3, 'bord'), 2);
  assert.strictEqual(M.rotationDeduite(0, 2, 'bord'), 3);
  assert.deepStrictEqual([[0, 0], [3, 0], [3, 3], [0, 3]].map(([c, l]) => M.rotationDeduite(c, l, 'coin')), [0, 1, 2, 3]);
  assert.deepStrictEqual([[0, 0], [4, 0], [4, 4], [0, 4]].map(([c, l]) => M.rotationDeduite(c, l, 'coin', '5x5')), [0, 1, 2, 3]);
  assert.strictEqual(M.rotationDeduite(1, 1, 'centrale'), null);
  assert.strictEqual(M.rotationDeduite(1, 1, 'bord'), null);
  assert.strictEqual(M.rotationDeduite(0, 0, 'bord'), null);
  assert.strictEqual(M.rotationDeduite(1, 0, undefined), null);
});

/* ---------- document, pose libre ---------- */

test('nouveauDocument : version 2, grille pleine (pas de forme), champ grille lu par formatDuDocument', () => {
  const d = M.nouveauDocument();
  assert.deepStrictEqual(d, { version: 2, grille: '4x4', modeles: [], plateau: { tuiles: [], jetons: [] } });
  assert.strictEqual(M.formatDuDocument(M.nouveauDocument('5x5')).id, '5x5');
  assert.strictEqual(M.formatDuDocument({ plateau: {} }).id, '4x4');
  assert.throws(() => M.nouveauDocument('6x6'), /inconnu/);
});

test('peutPoserTuile : rotation suggérée sur le pourtour, centrale au centre', () => {
  const d = documentVide();
  assert.deepStrictEqual(M.peutPoserTuile(d, 'ex-bord', 3, 2), { ok: true, raison: '', rot: 1 });
  assert.deepStrictEqual(M.peutPoserTuile(d, 'ex-coin', 0, 3), { ok: true, raison: '', rot: 3 });
  assert.deepStrictEqual(M.peutPoserTuile(d, 'ex-centrale', 2, 1), { ok: true, raison: '', rot: 0 });
});

test('peutPoserTuile : le rôle est respecté (coin dans un coin, bord sur le pourtour hors coins, centrale au centre), en 4×4 et en 5×5', () => {
  for (const grille of ['4x4', '5x5']) {
    const d = documentVide(grille), F = M.formatDuDocument(d), n = F.GRILLE.colonnes;
    const nbOk = { 'ex-coin': 0, 'ex-bord': 0, 'ex-centrale': 0 };
    for (let lig = 0; lig < n; lig++) {
      for (let col = 0; col < n; col++) {
        for (const id of Object.values(ID)) {
          const t = M.peutPoserTuile(d, id, col, lig);
          assert.strictEqual(t.ok, ID[M.gabaritCellule(col, lig, F)] === id, `${grille} ${id} en (${col},${lig})`);
          if (t.ok) nbOk[id]++;
          else assert.match(t.raison, /^Cette tuile est (un coin|un bord|une centrale) : elle se pose /);
        }
      }
    }
    assert.deepStrictEqual(nbOk, { 'ex-coin': 4, 'ex-bord': 4 * (n - 2), 'ex-centrale': (n - 2) * (n - 2) }, grille);
  }
  const d = documentVide();
  assert.strictEqual(M.peutPoserTuile(d, 'ex-coin', 1, 0).raison, 'Cette tuile est un coin : elle se pose dans un coin du plateau.');
  assert.strictEqual(M.peutPoserTuile(d, 'ex-bord', 0, 0).raison, 'Cette tuile est un bord : elle se pose sur le pourtour du plateau, hors des coins.');
  assert.strictEqual(M.peutPoserTuile(d, 'ex-centrale', 1, 0).raison, 'Cette tuile est une centrale : elle se pose au centre du plateau.');
  assert.throws(() => M.poserTuile(d, 'ex-bord', 1, 1), /Cette tuile est un bord/);
  // un modèle sans gabarit connu n'a pas de rôle : il se pose partout (alerte `gabarit_inconnu` dans l'éditeur)
  const libre = documentVide();
  delete libre.modeles.find((m) => m.id === 'ex-bord').gabarit;
  assert.strictEqual(M.peutPoserTuile(libre, 'ex-bord', 1, 1).ok, true);
  assert.strictEqual(M.peutPoserTuile(libre, 'ex-bord', 0, 0).ok, true);
});

test('poses illimitées : un modèle se pose autant de fois qu\'on veut, même à 0 ou 1 exemplaire', () => {
  let d = documentVide();
  assert.strictEqual(M.exemplairesRestants, undefined);
  d = M.changerExemplaires(d, 'ex-bord', 1);
  for (const [c, l] of [[1, 0], [2, 0], [3, 1], [3, 2], [2, 3], [1, 3], [0, 1], [0, 2]]) d = M.poserTuile(d, 'ex-bord', c, l);
  assert.strictEqual(d.plateau.tuiles.filter((t) => t.modeleId === 'ex-bord').length, 8);
  assert.deepStrictEqual(M.validerPlateau(d).erreurs, []);
  d = M.changerExemplaires(d, 'ex-bord', 0); // même sous le nombre de tuiles posées : seul l'entier positif est exigé
  assert.strictEqual(M.modeleParId(d, 'ex-bord').exemplaires, 0);
  assert.deepStrictEqual(M.validerPlateau(d).erreurs, []);
  assert.strictEqual(M.peutPoserTuile(documentVide(), 'ex-coin', 0, 0).ok, true);
  let z = M.changerExemplaires(documentVide(), 'ex-coin', 0);
  z = M.poserTuile(z, 'ex-coin', 0, 0);
  assert.strictEqual(M.tuileEn(z, 0, 0).modeleId, 'ex-coin');
});

test('peutPoserTuile : refus seulement hors grille, occupée, incomplet, rôle, introuvable', () => {
  let d = documentVide();
  assert.match(M.peutPoserTuile(d, 'zz', 0, 0).raison, /introuvable/);
  assert.match(M.peutPoserTuile(d, 'ex-bord', 4, 0).raison, /hors de la grille/);
  assert.match(M.peutPoserTuile(d, 'ex-bord', -1, 0).raison, /hors de la grille/);
  d = M.poserTuile(d, 'ex-bord', 1, 0);
  assert.match(M.peutPoserTuile(d, 'ex-bord', 1, 0).raison, /occupée/);
  d.modeles[0].cases[0].diametre = 50;
  assert.match(M.peutPoserTuile(d, 'ex-centrale', 1, 1).raison, /incomplet/);
  // une alerte (R3) n'empêche pas la pose
  const d2 = documentVide();
  d2.modeles[0].chemins.push({ id: 'r9', a: { case: 'c1' }, b: { raccord: { cote: 0, pos: 0 } } });
  assert.strictEqual(M.peutPoserTuile(d2, 'ex-centrale', 1, 1).ok, true);
});

test('poserTuile / tournerTuile : rotation choisie, toutes les tuiles tournent, fonctions pures', () => {
  const d0 = documentVide();
  const avant = JSON.stringify(d0);
  let d = M.poserTuile(d0, 'ex-bord', 1, 0);
  assert.strictEqual(M.tuileEn(d, 1, 0).rot, 0);
  d = M.poserTuile(d, 'ex-bord', 2, 0, 6);
  assert.strictEqual(M.tuileEn(d, 2, 0).rot, 2);
  assert.throws(() => M.poserTuile(d, 'ex-bord', 3, 1, 1.5), /entier/);
  d = M.tournerTuile(d, 1, 0, 3);
  assert.strictEqual(M.tuileEn(d, 1, 0).rot, 3);
  d = M.tournerTuile(d, 1, 0, -1);
  assert.strictEqual(M.tuileEn(d, 1, 0).rot, 2);
  assert.throws(() => M.tournerTuile(d, 1, 0, 0.5), /entier/);
  assert.throws(() => M.tournerTuile(d, 3, 3), /Aucune tuile/);
  assert.strictEqual(JSON.stringify(d0), avant);
  const r = M.retirerTuile(d, 1, 0);
  assert.strictEqual(M.tuileEn(r, 1, 0), null);
  assert.ok(M.tuileEn(d, 1, 0));
});

test('plateau complet des exemples : aucune erreur ni alerte, en 4×4 et en 5×5', () => {
  for (const grille of ['4x4', '5x5']) {
    const d = plateauComplet(grille), n = G.format(grille).GRILLE.colonnes;
    assert.strictEqual(d.plateau.tuiles.length, n * n);
    assert.deepStrictEqual(M.validerPlateau(d), { erreurs: [], alertes: [] }, grille);
    assert.deepStrictEqual(M.raccordsMorts(d).filter((r) => r.raison !== 'absent'), []);
  }
});

test('validerPlateau : alertes de place (gabarit, pourtour sans apparition, apparition au centre)', () => {
  let d = documentVide();
  d = forcer(d, 'ex-centrale', 1, 0);   // posées hors rôle (document ancien ou chargé) : alertes, pas de blocage
  d = forcer(d, 'ex-bord', 1, 1);
  const v = M.validerPlateau(d);
  assert.deepStrictEqual(v.erreurs, []);
  const c = v.alertes.map((a) => a.code);
  assert.ok(c.includes('gabarit_place'));
  assert.ok(c.includes('pourtour_sans_apparition'));
  assert.ok(c.includes('apparition_centre'));
  assert.deepStrictEqual(v.alertes.find((a) => a.code === 'apparition_centre').ref, { type: 'tuile', col: 1, lig: 1 });
  assert.match(v.alertes.find((a) => a.code === 'gabarit_place').message, /une centrale, posée à la place d'un bord/);
});

test('validerPlateau et verifierTuilePosee : erreurs (modèle absent ou incomplet, rotation, doublon) ; plus d\'erreur d\'exemplaires', () => {
  let d = plateauComplet();
  d.plateau.tuiles.push({ modeleId: 'zz', col: 1, lig: 1, rot: 0 });
  d.plateau.tuiles[0].rot = 7;
  const c = M.validerPlateau(d).erreurs.map((e) => e.code);
  for (const k of ['modele_absent', 'rot_invalide', 'doublon']) assert.ok(c.includes(k), k);
  d = plateauComplet();
  d.modeles[1].exemplaires = 2;   // 8 bords posés pour 2 exemplaires : ce n'est plus une erreur (poses illimitées)
  assert.ok(!M.validerPlateau(d).erreurs.some((e) => e.code === 'exemplaires_depasses'));
  assert.deepStrictEqual(M.validerPlateau(d).erreurs, []);
  d.modeles[1].cases[0].diametre = 50;
  assert.ok(M.validerPlateau(d).erreurs.some((e) => e.code === 'modele_incomplet'));
  assert.deepStrictEqual(M.verifierTuilePosee(plateauComplet(), { modeleId: 'ex-bord', col: 9, lig: 0, rot: 0 }).map((e) => e.code), ['hors_grille']);
});

/* ---------- villes, jonctions ---------- */

test('jetons : villes seulement, cycle case chemin → ville → case chemin, purs', () => {
  const d0 = plateauComplet();
  let d = M.cyclerJeton(d0, 1, 1);
  assert.deepStrictEqual(d.plateau.jetons, [{ i: 1, j: 1, type: 'capture' }]);
  assert.deepStrictEqual(d0.plateau.jetons, []);
  d = M.cyclerJeton(d, 1, 1);
  assert.deepStrictEqual(d.plateau.jetons, []);
  assert.throws(() => M.poserJeton(d0, 1, 1, 'carrefour'), /inconnu/);
  assert.deepStrictEqual(M.poserJeton(d0, 2, 2).plateau.jetons, [{ i: 2, j: 2, type: 'capture' }]);
  assert.deepStrictEqual(M.retirerJeton(d0, 2, 2).plateau.jetons, []);
});

test('jetons : refus hors jonction intérieure, jonction occupée, moins de 4 tuiles ; 1 port suffit (alerte)', () => {
  let d = plateauComplet();
  assert.match(M.peutPoserJeton(d, 0, 1).raison, /intérieure/);
  assert.match(M.peutPoserJeton(d, 4, 4).raison, /intérieure/);
  d = M.poserJeton(d, 1, 1);
  assert.match(M.peutPoserJeton(d, 1, 1).raison, /déjà/);
  const sans = M.retirerTuile(plateauComplet(), 1, 1);
  assert.match(M.peutPoserJeton(sans, 2, 2).raison, /4 tuiles .*3 posées/);
  // une jonction reliée par un seul port : ville permise, alerte jonction_ports
  let p = documentVide();
  const F = M.formatDuDocument(p);
  for (const [c, l] of [[0, 0], [1, 0], [0, 1], [1, 1]]) p = M.poserTuile(p, ID[M.gabaritCellule(c, l, F)], c, l, c === 1 && l === 1 ? 0 : undefined);
  p = M.tournerTuile(M.tournerTuile(p, 1, 0, 2), 0, 1, 2);
  p = M.tournerTuile(p, 0, 0, 2);
  assert.strictEqual(M.portsJonction(p, 1, 1).ports, 1);
  assert.strictEqual(M.peutPoserJeton(p, 1, 1).ok, true);
  const a = M.validerPlateau(p).alertes.filter((x) => x.code === 'jonction_ports');
  assert.deepStrictEqual(a.map((x) => x.ref), [{ type: 'jeton', i: 1, j: 1 }]);
});

test('jetons : retirer une tuile retire les villes devenues invalides ; jetonsInvalides', () => {
  let d = M.poserJeton(M.poserJeton(plateauComplet(), 1, 1), 3, 3);
  d = M.retirerTuile(d, 0, 0);
  assert.deepStrictEqual(d.plateau.jetons, [{ i: 3, j: 3, type: 'capture' }]);
  const mal = plateauComplet();
  mal.plateau.jetons = [{ i: 1, j: 1, type: 'carrefour' }, { i: 2, j: 2, type: 'capture' }, { i: 2, j: 2, type: 'capture' }, null];
  assert.deepStrictEqual(M.jetonsInvalides(mal).map((x) => x.raison), ['Type de jeton inconnu.', 'Deux villes sur la même jonction.', 'Jeton mal formé.']);
});

test('raccordsMorts : absent, vide (bord du plateau), mort ; portsVersPourtour', () => {
  let d = documentVide();
  d = forcer(d, 'ex-bord', 1, 1, 2); // retourné, hors rôle : raccord S p1 au nord, vers la cellule (1,0) vide
  const r = M.raccordsMorts(d);
  assert.ok(r.every((x) => x.raison === 'absent'));
  d = M.poserTuile(d, 'ex-bord', 1, 0, 2); // bord retourné en haut : raccord S p1 au nord (face au vide), rien au sud
  const morts = M.raccordsMorts(d);
  assert.ok(morts.some((x) => x.col === 1 && x.lig === 0 && x.cote === 0 && x.raison === 'vide'));
  assert.ok(morts.some((x) => x.col === 1 && x.lig === 1 && x.cote === 0 && x.raison === 'mort'));
  const pp = M.portsVersPourtour(d);
  assert.deepStrictEqual(pp.map((p) => [p.col, p.lig, p.coin, p.i, p.j]), [[1, 0, 0, 1, 0], [1, 0, 1, 2, 0]]);
  assert.ok(M.validerPlateau(d).alertes.some((a) => a.code === 'port_pourtour'));
});

test('T2 (docs/20) : deux bords retournés côte à côte, raccord p2 connecté ; T1 sur plateau', () => {
  let d = documentVide();
  d = M.poserTuile(d, 'ex-bord', 1, 3);
  d = M.poserTuile(d, 'ex-bord', 2, 3);
  const m1 = M.masquesTuilePosee(d, M.tuileEn(d, 1, 3)).raccords;
  assert.strictEqual(m1 & 0x228, 0x220);
  assert.strictEqual(G.apparier(m1, 1, M.masquesTuilePosee(d, M.tuileEn(d, 2, 3)).raccords).connectes, 4);
  d = M.poserTuile(M.poserTuile(d, 'ex-coin', 0, 0), 'ex-bord', 1, 0);
  assert.strictEqual(G.apparier(M.masquesTuilePosee(d, M.tuileEn(d, 0, 0)).raccords, 1, M.masquesTuilePosee(d, M.tuileEn(d, 1, 0)).raccords).connectes, 1);
});

test('tuileEnPlateau : cases en mm plateau, camp des cases d\'apparition, ports et raccords tournés', () => {
  const d = plateauComplet('5x5');
  const nord = M.tuileEnPlateau(d, M.tuileEn(d, 2, 0)), milieu = M.tuileEnPlateau(d, M.tuileEn(d, 0, 2)), sud = M.tuileEnPlateau(d, M.tuileEn(d, 4, 4));
  assert.strictEqual(nord.cases.find((c) => c.type === 'apparition').camp, 'vert');
  assert.strictEqual(milieu.cases.find((c) => c.type === 'apparition').camp, null);
  assert.strictEqual(sud.cases.find((c) => c.type === 'apparition').camp, 'rouge');
  assert.ok(nord.cases.filter((c) => c.type !== 'apparition').every((c) => c.camp === null));
  const c3 = nord.cases.find((c) => c.id === '2,0:c3');
  assert.deepStrictEqual([c3.x, c3.y], [250, 34]);
  assert.deepStrictEqual(sud.ports.map((p) => [p.coin, p.i, p.j]), [[0, 4, 4]]);
  assert.strictEqual(M.tuileEnPlateau(d, { modeleId: 'zz', col: 0, lig: 0, rot: 0 }), null);
});

/* ---------- bibliothèque ---------- */

test('ajouterModele / remplacerModele (gabarit modifiable même posé) / supprimerModele / changerExemplaires', () => {
  let d = plateauComplet();
  assert.throws(() => M.ajouterModele(d, { id: 'ex-bord' }), /déjà/);
  assert.throws(() => M.ajouterModele(d, {}), /identifiant/);
  d = M.ajouterModele(d, Object.assign(exemple('bord'), { id: 'b2' }));
  assert.ok(M.modeleParId(d, 'b2'));
  const autre = Object.assign(exemple('bord'), { gabarit: 'centrale' });
  d = M.remplacerModele(d, 'ex-bord', autre);
  assert.strictEqual(M.modeleParId(d, 'ex-bord').gabarit, 'centrale');
  assert.ok(M.validerPlateau(d).alertes.some((a) => a.code === 'gabarit_place'));
  assert.throws(() => M.remplacerModele(d, 'ex-bord', exemple('coin')), /même identifiant/);
  assert.throws(() => M.supprimerModele(d, 'ex-bord'), /posé 8 fois/);
  d = M.supprimerModele(d, 'b2');
  assert.strictEqual(M.modeleParId(d, 'b2'), null);
  assert.throws(() => M.changerExemplaires(d, 'ex-coin', -1), /entier positif/);
  assert.strictEqual(M.modeleParId(M.changerExemplaires(d, 'ex-coin', 1), 'ex-coin').exemplaires, 1); // sous le nombre de tuiles posées : permis
  assert.throws(() => M.changerExemplaires(d, 'ex-coin', 1.5), /entier/);
  assert.strictEqual(M.modeleParId(M.changerExemplaires(d, 'ex-coin', 9), 'ex-coin').exemplaires, 9);
});

test('exemples : tableau gelé, copieExemples modifiable et indépendante ; nouvelId ; exemplairesValides', () => {
  assert.ok(Object.isFrozen(M.exemples) && Object.isFrozen(M.exemples[0].cases[0]));
  const a = M.copieExemples();
  a[0].cases[0].x = 1;
  assert.notStrictEqual(M.copieExemples()[0].cases[0].x, 1);
  assert.strictEqual(M.nouvelId(exemple('bord'), 'c'), 'c4');
  assert.strictEqual(M.nouvelId({}, 'h'), 'h1');
  assert.deepStrictEqual([3, 0, -1, 1.5, '2', null].map((n) => M.exemplairesValides({ exemplaires: n })), [3, 0, 0, 0, 0, 0]);
  assert.strictEqual(M.clonerDocument(undefined), undefined);
});

test('jonctionDuCoin', () => {
  assert.deepStrictEqual([0, 1, 2, 3].map((k) => M.jonctionDuCoin(1, 2, k)), [{ i: 1, j: 2 }, { i: 2, j: 2 }, { i: 2, j: 3 }, { i: 1, j: 3 }]);
});
