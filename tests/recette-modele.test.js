'use strict';
/*
 * Recette indépendante du modèle, règles de la version 2 (geometrie.js, modele.js).
 * Référence : docs/18-decisions-v2.md, docs/20-avis-geometrie-v2.md (D1 à D4, cas T1 à T4, arbitrages).
 * Les oracles sont recalculés à partir de la doc (points géométriques, rangées des camps), pas du code testé.
 * (La recette de la version 1 portait sur les formes réduites, les rôles imposés et les carrefours : supprimée.)
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
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(gel); }
  return o;
}
const exemple = (gabarit, grille) => copie(M.copieExemples(grille).find((m) => m.gabarit === gabarit));
const codes = (modele, grille) => M.validerModele(modele, grille).erreurs.map((e) => e.code);
const ID = { centrale: 'ex-centrale', bord: 'ex-bord', coin: 'ex-coin' };
function prng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Oracle de position (indépendant de modele.js) : gabarit selon le nombre de côtés au bord de la grille. */
function oracleGabarit(col, lig, n) {
  const bords = (col === 0) + (col === n - 1) + (lig === 0) + (lig === n - 1);
  return ['centrale', 'bord', 'coin'][bords];
}
/** Oracle de camp (docs/18) : 2 rangées par joueur, rangée centrale neutre en 5×5. */
function oracleCamp(lig, n) {
  if (lig <= 1) return 'vert';
  if (lig >= n - 2) return 'rouge';
  return null;
}

function documentPlein(grille) {
  let doc = M.nouveauDocument(grille);
  doc.modeles = M.copieExemples(grille);
  doc.modeles.forEach((m) => { m.exemplaires = 99; });
  const n = G.format(grille || '4x4').GRILLE.colonnes;
  for (let lig = 0; lig < n; lig++) for (let col = 0; col < n; col++) doc = M.poserTuile(doc, ID[oracleGabarit(col, lig, n)], col, lig);
  return doc;
}

/* ------------------------------------------------------------------ */
/* 1. Positions, camps, pose libre                                     */
/* ------------------------------------------------------------------ */
for (const grille of ['4x4', '5x5']) {
  test(grille + ' : gabarit de position et camp de chaque cellule (oracle de la doc)', () => {
    const n = G.format(grille).GRILLE.colonnes;
    for (let lig = 0; lig < n; lig++) {
      for (let col = 0; col < n; col++) {
        assert.equal(M.gabaritCellule(col, lig, grille), oracleGabarit(col, lig, n), col + ',' + lig);
        assert.equal(M.campCellule(grille, col, lig), oracleCamp(lig, n), col + ',' + lig);
      }
    }
    assert.equal(M.campCellule(grille, -1, 0), null);
    assert.equal(M.campCellule(grille, 0, n), null);
  });

  test(grille + ' : rôle respecté à la pose (coin, bord, centrale), cellules libres du bon rôle seulement ; rotation suggérée = côté extérieur dehors', () => {
    const doc = M.nouveauDocument(grille);
    doc.modeles = M.copieExemples(grille);
    const n = G.format(grille).GRILLE.colonnes;
    for (const g of ['centrale', 'bord', 'coin']) {
      for (let lig = 0; lig < n; lig++) {
        for (let col = 0; col < n; col++) {
          const t = M.peutPoserTuile(doc, ID[g], col, lig);
          assert.equal(t.ok, oracleGabarit(col, lig, n) === g, g + ' ' + col + ',' + lig);
          if (!t.ok) {
            assert.match(t.raison, /^Cette tuile est (un coin|un bord|une centrale) : elle se pose /);
            assert.equal(t.rot, 0);
          } else if (g !== 'centrale') {
            // les côtés extérieurs canoniques, tournés de rot, tombent sur les côtés au bord de la grille
            const ext = G.GABARITS[g].cotesExterieurs.map((c) => (c + t.rot) % 4);
            const dehors = [0, 1, 2, 3].filter((c) => { const d = G.coteVoisin(c); const vc = col + d.dc, vl = lig + d.dl; return vc < 0 || vl < 0 || vc >= n || vl >= n; });
            assert.deepEqual(ext.sort(), dehors.sort(), g + ' ' + col + ',' + lig);
          } else {
            assert.equal(t.rot, 0);
          }
        }
      }
    }
  });

  test(grille + ' : plateau plein des exemples, aucune erreur ni alerte, aucun raccord mort, toutes les jonctions à 4 ports', () => {
    const d = documentPlein(grille), n = G.format(grille).GRILLE.colonnes;
    assert.deepEqual(M.validerPlateau(d), { erreurs: [], alertes: [], informations: [] });
    assert.deepEqual(M.raccordsMorts(d).filter((r) => r.raison !== 'absent'), []);
    for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) assert.deepEqual(M.portsJonction(d, i, j), { ports: 4, tuiles: 4 });
  });
}

/* ------------------------------------------------------------------ */
/* 2. Pureté                                                           */
/* ------------------------------------------------------------------ */
function docRiche() {
  let doc = documentPlein();
  doc = M.poserJeton(doc, 1, 1);
  doc = M.poserJeton(doc, 3, 3);
  return doc;
}
const OPERATIONS = {
  poserTuile: (d) => M.poserTuile(d, ID.coin, 0, 0),
  'poserTuile (rotation choisie)': (d) => M.poserTuile(d, ID.coin, 0, 0, 3),
  retirerTuile: (d) => M.retirerTuile(d, 1, 1),
  'retirerTuile (cellule vide)': (d) => M.retirerTuile(d, 9, 9),
  tournerTuile: (d) => M.tournerTuile(d, 1, 1, 1),
  'tournerTuile (bord)': (d) => M.tournerTuile(d, 1, 0),
  'tournerTuile (négatif)': (d) => M.tournerTuile(d, 2, 1, -1),
  poserJeton: (d) => M.poserJeton(d, 2, 1),
  retirerJeton: (d) => M.retirerJeton(d, 1, 1),
  'retirerJeton (absent)': (d) => M.retirerJeton(d, 3, 1),
  'cyclerJeton (case → ville)': (d) => M.cyclerJeton(d, 2, 1),
  'cyclerJeton (ville → case)': (d) => M.cyclerJeton(d, 1, 1),
  remplacerModele: (d) => M.remplacerModele(d, ID.bord, Object.assign(copie(d.modeles[1]), { gabarit: 'coin' })),
  clonerDocument: (d) => M.clonerDocument(d)
};
for (const [nom, op] of Object.entries(OPERATIONS)) {
  test('pureté : ' + nom, () => {
    let doc = docRiche();
    if (nom.startsWith('poserTuile')) doc = M.retirerTuile(doc, 0, 0);
    const avant = copie(doc);
    const res = op(gel(doc)); // document gelé : toute mutation lève en mode strict
    assert.deepEqual(doc, avant);
    assert.notEqual(res, doc);
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
  const doc = gel(docRiche());
  const avant = copie(doc);
  assert.throws(() => M.poserTuile(doc, ID.centrale, 1, 1));
  assert.throws(() => M.poserTuile(doc, ID.centrale, 9, 9));
  assert.throws(() => M.tournerTuile(doc, 9, 9, 1));
  assert.throws(() => M.poserJeton(doc, 1, 1));
  assert.throws(() => M.poserJeton(doc, 0, 0));
  assert.throws(() => M.poserJeton(doc, 2, 1, 'carrefour'));
  assert.deepEqual(doc, avant);
});
test('pureté : peutPoser*, portsJonction, raccordsMorts, valider* ne modifient pas le document', () => {
  const doc = gel(docRiche());
  const avant = copie(doc);
  M.peutPoserTuile(doc, ID.centrale, 1, 1);
  M.peutPoserJeton(doc, 2, 1);
  M.portsJonction(doc, 1, 1);
  M.raccordsMorts(doc);
  M.portsVersPourtour(doc);
  M.jonctionsMalReliees(doc);
  M.validerPlateau(doc);
  doc.modeles.forEach((m) => M.validerModele(m));
  assert.deepEqual(doc, avant);
});

/* ------------------------------------------------------------------ */
/* 3. raccordsMorts : oracle géométrique                               */
/* ------------------------------------------------------------------ */
/** Modèle aléatoire : les cases d'un exemple, des raccords tirés au hasard sur les 4 côtés (extérieurs permis). */
function modeleAleatoire(gabarit, grille, rnd, idx) {
  const m = exemple(gabarit, grille);
  m.id = 'g' + idx; m.exemplaires = 99;
  m.chemins = m.chemins.filter((c) => !c.b.raccord);
  let n = 0;
  for (let cote = 0; cote < 4; cote++) {
    for (let pos = 0; pos < 3; pos++) {
      if (rnd() < 0.4) m.chemins.push({ id: 'q' + (n++), a: { 'case': m.cases[Math.floor(rnd() * m.cases.length)].id }, b: { raccord: { cote, pos } } });
    }
  }
  return m;
}
for (const grille of ['4x4', '5x5']) {
  test(grille + ' : raccordsMorts = oracle géométrique (tuiles, rotations et cases vides au hasard)', () => {
    const rnd = prng(grille === '4x4' ? 12345 : 678), F = G.format(grille), n = F.GRILLE.colonnes, C = F.COTE;
    for (let essai = 0; essai < 30; essai++) {
      let doc = M.nouveauDocument(grille);
      const modeles = [];
      for (let k = 0; k < 6; k++) { const m = modeleAleatoire(['centrale', 'bord', 'coin'][k % 3], grille, rnd, k); modeles.push(m); doc.modeles.push(m); }
      const posees = [];
      for (let lig = 0; lig < n; lig++) {
        for (let col = 0; col < n; col++) {
          if (rnd() < 0.25) continue;
          const m = modeles[Math.floor(rnd() * modeles.length)];
          // une tuile aux tracés croisés est incomplète, donc non posable : on la place directement
          const rot = Math.floor(rnd() * 4);
          doc.plateau.tuiles.push({ modeleId: m.id, col, lig, rot });
          posees.push({ col, lig, m, rot });
        }
      }
      const pts = [].concat(...posees.map((t) => t.m.chemins.filter((c) => c.b.raccord).map((c) => {
        const p = F.tournerPoint(F.pointRaccord(c.b.raccord.cote, c.b.raccord.pos), t.rot);
        return { t, p, key: (t.col * C + p.x) + ',' + (t.lig * C + p.y) };
      })));
      const attendus = [];
      for (const e of pts) {
        if (pts.some((o) => o.t !== e.t && o.key === e.key)) continue;
        let trouve = null;
        for (let c = 0; c < 4; c++) for (let q = 0; q < 3; q++) { const pp = F.pointRaccord(c, q); if (pp.x === e.p.x && pp.y === e.p.y) trouve = [c, q]; }
        attendus.push(e.t.col + ',' + e.t.lig + ',' + trouve[0] + ',' + trouve[1]);
      }
      const obtenus = M.raccordsMorts(doc).map((r) => r.col + ',' + r.lig + ',' + r.cote + ',' + r.pos);
      assert.deepEqual(obtenus.sort(), attendus.sort(), 'essai ' + essai);
      // raison : vide si le voisin est hors grille
      for (const r of M.raccordsMorts(doc)) {
        const d = G.coteVoisin(r.cote), vc = r.col + d.dc, vl = r.lig + d.dl;
        const hors = vc < 0 || vl < 0 || vc >= n || vl >= n;
        assert.equal(r.raison === 'vide', hors);
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* 4. validerModele : cas limites des règles physiques                 */
/* ------------------------------------------------------------------ */
const sur = (modele, id, grille) => M.validerModele(modele, grille).erreurs.filter((e) => e.ref && e.ref.type === 'case' && e.ref.id === id).map((e) => e.code);
function avecC1(x, y, d, grille) {
  const m = exemple('centrale', grille);
  Object.assign(m.cases[1], { x, y, diametre: d });
  return m;
}
test('marge de coupe : pile à 4 mm accepté, 3,99 refusé', () => {
  assert.ok(!sur(avecC1(16, 60, 24), 'c1').includes('hors_tuile'));
  assert.ok(sur(avecC1(15.99, 60, 24), 'c1').includes('hors_tuile'));
  assert.ok(!sur(avecC1(84, 60, 24, '5x5'), 'c1', '5x5').includes('hors_tuile')); // 100 - 4 - 12
  assert.ok(sur(avecC1(84.01, 60, 24, '5x5'), 'c1', '5x5').includes('hors_tuile'));
});
test('zone de coin : pile à la limite (distance = 20 + r) accepté, juste en dessous refusé, dans les 4 coins', () => {
  assert.deepEqual(sur(avecC1(19.2, 25.6, 24), 'c1').filter((c) => c === 'zone_coin'), []);
  const k = 31.99 / 32;
  assert.ok(sur(avecC1(19.2 * k, 25.6 * k, 24), 'c1').includes('zone_coin'));
  for (const grille of ['4x4', '5x5']) {
    const C = G.format(grille).COTE;
    for (const [x, y] of [[19.2, 25.6], [C - 19.2, 25.6], [C - 19.2, C - 25.6], [19.2, C - 25.6]]) {
      assert.ok(!sur(avecC1(x, y, 24, grille), 'c1', grille).includes('zone_coin'), grille + ' ' + x + ',' + y);
      assert.ok(sur(avecC1(x + (x < C / 2 ? -0.5 : 0.5), y, 24, grille), 'c1', grille).includes('zone_coin'), grille + ' ' + x + ',' + y);
    }
  }
});
test('diamètre : Ø 30 max en 4×4, Ø 24 max en 5×5 ; 0 / négatif / NaN invalides', () => {
  assert.ok(!sur(avecC1(40, 60, 30), 'c1').includes('diametre'));
  assert.ok(sur(avecC1(40, 60, 30.01), 'c1').includes('diametre'));
  assert.ok(!sur(avecC1(40, 50, 24, '5x5'), 'c1', '5x5').includes('diametre'));
  assert.ok(sur(avecC1(40, 50, 24.01, '5x5'), 'c1', '5x5').includes('diametre'));
  for (const d of [0, -5, NaN, Infinity, '24', null, undefined]) assert.ok(sur(avecC1(40, 60, d), 'c1').includes('case_invalide'), String(d));
});
test('chevauchement : tangentes acceptées, recouvrement refusé', () => {
  const m = exemple('centrale');
  Object.assign(m.cases[1], { x: 40, y: 60 }); // centre c0 en (60, 60) : centres à 20 = d, tangentes
  assert.ok(!codes(m).includes('chevauchement'));
  m.cases[1].x = 40.1;
  assert.ok(codes(m).includes('chevauchement'));
});
test('chemin contre une case : distance r + L/2 pile acceptée, en dessous refusée', () => {
  // lien horizontal y = 60 entre deux cases ; une troisième case Ø 24 au-dessus à 16 mm (12 + 4) du segment
  const k = (id, x, y) => ({ id, x, y, diametre: 24, type: 'deplacement' });
  const m = { id: 'm', gabarit: 'centrale', exemplaires: 1, cases: [k('a', 30, 60), k('b', 90, 60), k('c', 60, 44)],
    chemins: [{ id: 'h', a: { case: 'a' }, b: { case: 'b' } }, { id: 'h2', a: { case: 'c' }, b: { raccord: { cote: 0, pos: 1 } } }] };
  assert.ok(!codes(m).includes('chemin_case'), codes(m).join(' '));
  m.cases[2].y = 44.1;
  assert.ok(codes(m).includes('chemin_case'));
});
test('ports et raccords hors gabarit : jamais bloquants (alertes), pour chaque gabarit', () => {
  for (const g of ['bord', 'coin']) {
    const ext = G.GABARITS[g].cotesExterieurs, inter = G.GABARITS[g].coinsInterieurs;
    for (const k of [0, 1, 2, 3].filter((x) => !inter.includes(x))) {
      const m = exemple(g); m.cases.push({ id: 'z', x: k === 1 || k === 2 ? 80 : 40, y: k >= 2 ? 80 : 40, diametre: 10, type: 'deplacement' });
      m.chemins.push({ id: 'x', a: { case: 'z' }, b: { coin: k } });
      const v = M.validerModele(m);
      assert.ok(v.alertes.some((a) => a.code === 'port_exterieur'), g + ' coin ' + k);
      assert.ok(!v.erreurs.some((e) => e.code === 'port_exterieur'));
    }
    for (const c of ext) {
      const m = exemple(g);
      const pos = c === 0 ? 1 : 0;
      m.chemins.push({ id: 'x', a: { case: m.cases.find((x) => x.type === 'apparition').id }, b: { raccord: { cote: c, pos } } });
      const v = M.validerModele(m);
      assert.ok(v.alertes.some((a) => a.code === 'raccord_exterieur'), g + ' côté ' + c);
    }
  }
});

/* ------------------------------------------------------------------ */
/* 5. Robustesse                                                       */
/* ------------------------------------------------------------------ */
test('modèles malformés : jamais d\'exception, toujours {complet, erreurs, alertes}', () => {
  const cas = [undefined, null, 5, 'x', [], {}, { cases: null, chemins: 'x' }, { cases: [null, 3, { x: 'a' }] },
    { chemins: [null, 1, { a: null }, { a: { case: 1 }, b: { raccord: null } }, { a: { coin: 9 }, b: { case: 'c' } }] },
    { gabarit: 'toString', cases: [{ id: '__proto__', x: 60, y: 60, diametre: 24 }], chemins: [{ id: 'h', a: { case: '__proto__' }, b: { raccord: { cote: 0, pos: 1 } } }] }];
  for (const m of cas) {
    let r;
    assert.doesNotThrow(() => { r = M.validerModele(m); }, JSON.stringify(m));
    assert.equal(typeof r.complet, 'boolean');
    assert.ok(Array.isArray(r.erreurs) && Array.isArray(r.alertes));
  }
});
test('document rechargé depuis JSON : mêmes résultats pour toutes les opérations', () => {
  const doc = docRiche();
  const relu = JSON.parse(JSON.stringify(doc));
  assert.deepEqual(M.validerPlateau(relu), M.validerPlateau(doc));
  assert.deepEqual(M.raccordsMorts(relu), M.raccordsMorts(doc));
  assert.deepEqual(M.peutPoserTuile(relu, ID.bord, 0, 0), M.peutPoserTuile(doc, ID.bord, 0, 0));
  assert.deepEqual(M.tournerTuile(relu, 1, 1), M.tournerTuile(doc, 1, 1));
  assert.deepEqual(M.tuileEnPlateau(relu, relu.plateau.tuiles[5]), M.tuileEnPlateau(doc, doc.plateau.tuiles[5]));
});
test('poses illimitées : aucun refus pour exemplaires épuisés, refus de rôle en une phrase, retrait sans effet sur la pose', () => {
  let doc = M.nouveauDocument();
  doc.modeles = M.copieExemples();
  doc = M.changerExemplaires(doc, ID.coin, 2);
  doc = M.poserTuile(M.poserTuile(doc, ID.coin, 0, 0), ID.coin, 3, 0);
  assert.equal(M.exemplairesRestants, undefined);
  assert.equal(M.peutPoserTuile(doc, ID.coin, 3, 3).ok, true);        // 3e coin posé avec 2 exemplaires
  doc = M.poserTuile(M.poserTuile(doc, ID.coin, 3, 3), ID.coin, 0, 3); // 4 coins posés avec 2 exemplaires
  assert.equal(doc.plateau.tuiles.length, 4);
  assert.deepEqual(M.validerPlateau(doc).erreurs, []);
  assert.equal(M.peutPoserTuile(doc, ID.coin, 1, 1).raison, 'Cette tuile est un coin : elle se pose dans un coin du plateau.');
  doc = M.retirerTuile(doc, 3, 3);
  assert.equal(M.peutPoserTuile(doc, ID.coin, 3, 3).ok, true);
});
