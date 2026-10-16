'use strict';
/*
 * Tests du catalogue (src/catalogue.js) : catalogue de la version 1, converti aux données de la version 2
 * (gabarit, grille). Contenu, validité (aucune erreur bloquante ; alertes R1 à R4 attendues) et tracés.
 * Les mesures sur 1000 plateaux tirés de ce catalogue (seuils de la version 1 : carrefours, rôle apparition,
 * 3 pas entre jonctions) sont désactivées : à refaire avec le catalogue v2.
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/catalogue.js');
require('../src/rendu.js');
const G = globalThis.PM.geometrie;
const M = globalThis.PM.modele;
const CAT = globalThis.PM.catalogue;
const R = globalThis.PM.rendu;

/* ====================================================================== */
/* Tirage d'un plateau                                                     */
/* ====================================================================== */

/** Générateur pseudo-aléatoire reproductible (mulberry32), valeurs dans [0, 1). */
function mulberry32(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function melanger(t, rng) {
  t = t.slice();
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j], t[i]];
  }
  return t;
}

/**
 * Plateau 4x4 plein tiré au hasard dans le stock du catalogue : modèles tirés sans remise selon les
 * exemplaires de chaque gabarit, à la place de leur gabarit, rotation suggérée sur le pourtour, aléatoire au centre.
 */
function tirerPlateau(rng) {
  let doc = CAT.nouveauDocument();
  const stock = {}, F = M.formatDuDocument(doc);
  for (const m of doc.modeles) {
    stock[m.gabarit] = stock[m.gabarit] || [];
    for (let k = 0; k < m.exemplaires; k++) stock[m.gabarit].push(m.id);
  }
  for (const r of Object.keys(stock)) stock[r] = melanger(stock[r], rng);
  for (let lig = 0; lig < 4; lig++) {
    for (let col = 0; col < 4; col++) {
      const g = M.gabaritCellule(col, lig, F);
      doc = M.poserTuile(doc, stock[g].pop(), col, lig);
      if (g === 'centrale') {
        const r = Math.floor(rng() * 4);
        if (r) doc = M.tournerTuile(doc, col, lig, r);
      }
    }
  }
  return doc;
}

/* ====================================================================== */
/* Outils de géométrie des tracés (segments droits)                        */
/* ====================================================================== */

function distPointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function distSegments(a, b, c, d) {
  if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return 0;
  return Math.min(distPointSegment(a, c, d), distPointSegment(b, c, d), distPointSegment(c, a, b), distPointSegment(d, a, b));
}
function distPolylignes(P, Q) {
  let m = Infinity;
  for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Q.length; j++) m = Math.min(m, distSegments(P[i], P[i + 1], Q[j], Q[j + 1]));
  return m;
}
function distPointPolyligne(p, P) {
  let m = Infinity;
  for (let i = 0; i + 1 < P.length; i++) m = Math.min(m, distPointSegment(p, P[i], P[i + 1]));
  return m;
}

/**
 * Tracé de chaque chemin : convention commune à l'écran et à l'export, définie dans src/rendu.js
 * (lien = segment ; raccord = amorce perpendiculaire de 10 mm puis segment ; port = amorce de 28 mm
 * sur la bissectrice puis segment).
 */
function traces(m) { return R.tracesModele(m); }

/** Retire d'un tracé la partie couverte par ses cases d'extrémité (rayon + 4 mm pour la case commune). */
function rogner(t, commun) {
  const coupe = (c, vers) => {
    const r = c.diametre / 2 + (c === commun ? 4 : 0), d = Math.hypot(vers.x - c.x, vers.y - c.y), k = Math.min(1, r / d);
    return { x: c.x + (vers.x - c.x) * k, y: c.y + (vers.y - c.y) * k };
  };
  const pts = t.pts.map((p) => ({ x: p.x, y: p.y }));
  if (t.type === 'lien') return [coupe(t.cases[0], t.pts[1]), coupe(t.cases[1], t.pts[0])];
  pts[pts.length - 1] = coupe(t.cases[0], t.pts[t.pts.length - 2]);
  return pts;
}

/**
 * Contrôles de tracé anticipant la règle « chevauchement chemin / case » :
 *  - un chemin reste à r + 4 mm au moins des cases qui ne sont pas ses extrémités ;
 *  - un chemin (hors son propre port) reste à 24 mm au moins de chaque coin (zone du jeton + 4 mm) ;
 *  - deux chemins ne se touchent pas (axes à 8 mm au moins), hors des disques de leurs cases
 *    (la case commune à deux chemins est élargie de 4 mm : les chemins peuvent s'y rejoindre).
 */
function problemesTrace(m) {
  const pb = [], ts = traces(m);
  for (const t of ts) {
    for (const c of m.cases) {
      if (t.cases.includes(c)) continue;
      const d = distPointPolyligne(c, t.pts);
      if (d < c.diametre / 2 + 4 - 1e-9) pb.push(`${m.id} ${t.id} passe à ${d.toFixed(1)} mm de ${c.id}`);
    }
    for (let k = 0; k < 4; k++) {
      if (t.type === 'port' && t.coin === k) continue;
      const d = distPointPolyligne(G.pointCoin(k), t.pts);
      if (d < G.RAYON_ZONE_COIN + 4 - 1e-9) pb.push(`${m.id} ${t.id} entre dans la zone du coin ${k} (${d.toFixed(1)} mm)`);
    }
  }
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const commun = ts[i].cases.find((c) => ts[j].cases.includes(c));
      const d = distPolylignes(rogner(ts[i], commun), rogner(ts[j], commun));
      if (d < G.LARGEUR_CHEMIN - 1e-9) pb.push(`${m.id} ${ts[i].id} et ${ts[j].id} se touchent (${d.toFixed(1)} mm)`);
    }
  }
  return pb;
}

/* ====================================================================== */
/* Catalogue : contenu et validité                                         */
/* ====================================================================== */

const IDS_ATTENDUS = {
  centrale: ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'],
  coin: ['K1', 'K2', 'K3', 'K4', 'K5'],
  bord: ['B1', 'B2', 'B3', 'B4', 'B5', 'A1', 'A2']
};

test('catalogue : version 1 convertie, 18 modèles, ids attendus et uniques, gabarit et grille 4×4', () => {
  assert.strictEqual(CAT.version, 1);
  assert.strictEqual(CAT.modeles.length, 18);
  const ids = CAT.modeles.map((m) => m.id);
  assert.strictEqual(new Set(ids).size, 18);
  for (const g of Object.keys(IDS_ATTENDUS)) {
    assert.deepStrictEqual(CAT.modeles.filter((m) => m.gabarit === g).map((m) => m.id), IDS_ATTENDUS[g], g);
  }
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4' && !('role' in m)));
});

test('catalogue : les 18 modèles n\'ont aucune erreur bloquante (règles physiques v2)', () => {
  for (const m of CAT.modeles) assert.deepStrictEqual(M.validerModele(m).erreurs, [], m.id);
});

test('catalogue v1 et règles v2 : alertes R2 / R3 attendues, case d\'apparition seulement sur A1 et A2', () => {
  const alertes = (id) => M.validerModele(CAT.modeles.find((m) => m.id === id)).alertes.map((a) => a.code);
  for (const id of IDS_ATTENDUS.centrale) assert.ok(alertes(id).includes('porteuses_reliees') && alertes(id).includes('raccord_porteuse'), id);
  for (const id of IDS_ATTENDUS.coin.concat(['B1', 'B2', 'B3', 'B4', 'B5'])) assert.ok(alertes(id).includes('sans_apparition'), id);
  assert.deepStrictEqual(alertes('A2'), []);
  assert.ok(!alertes('A1').includes('sans_apparition'));
});

test('catalogue : gabarits, exemplaires et 20 tuiles physiques', () => {
  const parGabarit = {};
  for (const m of CAT.modeles) {
    parGabarit[m.gabarit] = (parGabarit[m.gabarit] || 0) + m.exemplaires;
    assert.strictEqual(m.exemplaires, m.id === 'A1' || m.id === 'A2' ? 2 : 1, m.id);
  }
  assert.deepStrictEqual(parGabarit, { centrale: 6, coin: 5, bord: 9 });
  assert.strictEqual(CAT.modeles.reduce((s, m) => s + m.exemplaires, 0), 20);
});

test('catalogue : noms courts, ids de cases et de chemins en chaînes', () => {
  for (const m of CAT.modeles) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 20, m.id);
    for (const el of m.cases.concat(m.chemins)) assert.strictEqual(typeof el.id, 'string', m.id);
  }
  assert.strictEqual(new Set(CAT.modeles.map((m) => m.nom)).size, 18); // bibliothèque commune : noms tous distincts
});

test('catalogue : profils de raccords (pos 1 partout, variantes recensées)', () => {
  // Seule variante voulue : le côté ouest vide de C6 (« mur », docs/9-validation-catalogue.md).
  // Tout autre écart au profil « pos 1 sur chaque côté intérieur » est une régression.
  const variantes = { C6: { 3: 0b000 } };
  for (const m of CAT.modeles) {
    const r = M.masquesDuModele(m).raccords;
    for (let cote = 0; cote < 4; cote++) {
      const exterieur = G.GABARITS[m.gabarit].cotesExterieurs.includes(cote);
      const attendu = exterieur ? 0 : (variantes[m.id] && variantes[m.id][cote] !== undefined ? variantes[m.id][cote] : 0b010);
      assert.strictEqual(G.triplet(r, cote), attendu, `${m.id} côté ${cote}`);
    }
  }
});

test('catalogue : chaque case d\'apparition touche les deux cases à port', () => {
  for (const m of CAT.modeles.filter((x) => M.aUneApparition(x))) {
    const sp = m.cases.find((c) => c.type === 'apparition').id;
    const voisins = m.chemins.filter((ch) => ch.a['case'] === sp || ch.b['case'] === sp)
      .map((ch) => (ch.a['case'] === sp ? ch.b['case'] : ch.a['case'])).filter(Boolean);
    const aPort = m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']);
    assert.deepStrictEqual(aPort.filter((c) => voisins.includes(c)).sort(), aPort.slice().sort(), m.id);
    assert.ok(!aPort.includes(sp), m.id + ' : la case d\'apparition ne porte pas de port');
  }
});

/**
 * Signature d'un modèle tourné de `rot` quarts de tour : cases étiquetées par leur port et
 * leurs raccords (tournés), arêtes internes entre étiquettes. Deux modèles de même signature
 * ont le même routage.
 */
function signature(m, rot) {
  const etiquette = new Map(m.cases.map((c) => [c.id, []]));
  for (const ch of m.chemins) {
    const o = ch.b['case'] === undefined ? ch.b : null;
    if (!o) continue;
    const e = etiquette.get(ch.a['case']);
    if (o.coin !== undefined) e.push('p' + ((o.coin + rot) % 4));
    else e.push('r' + ((o.raccord.cote + rot) % 4) + o.raccord.pos);
  }
  const lab = (id) => etiquette.get(id).sort().join('') + (m.cases.find((c) => c.id === id).type === 'apparition' ? '*' : '');
  const aretes = m.chemins.filter((ch) => ch.b['case'] !== undefined).map((ch) => [lab(ch.a['case']), lab(ch.b['case'])].sort().join('-')).sort();
  return m.cases.map((c) => lab(c.id)).sort().join(',') + '|' + aretes.join(',');
}

test('variété : aucune centrale n\'est la copie tournée d\'une autre, aucun doublon par gabarit', () => {
  const centrales = CAT.modeles.filter((m) => m.gabarit === 'centrale');
  for (let i = 0; i < centrales.length; i++) {
    for (let j = i + 1; j < centrales.length; j++) {
      for (let rot = 0; rot < 4; rot++) {
        assert.notStrictEqual(signature(centrales[i], rot), signature(centrales[j], 0), `${centrales[i].id} tourné = ${centrales[j].id}`);
      }
    }
  }
  // les 6 centrales ont 6 routages internes différents (anneau, U, Z, étoile, patte, losange) :
  // nombre de liens, degrés des cases, nombre de diagonales (liens entre coins opposés)
  const formes = centrales.map((m) => {
    const deg = new Map(m.cases.map((c) => [c.id, 0]));
    const coin = new Map(m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => [ch.a['case'], ch.b.coin]));
    const liens = m.chemins.filter((ch) => ch.b['case'] !== undefined);
    for (const ch of liens) { deg.set(ch.a['case'], deg.get(ch.a['case']) + 1); deg.set(ch.b['case'], deg.get(ch.b['case']) + 1); }
    const diagonales = liens.filter((ch) => Math.abs(coin.get(ch.a['case']) - coin.get(ch.b['case'])) === 2).length;
    return liens.length + ':' + [...deg.values()].sort().join('') + ':' + diagonales;
  });
  assert.strictEqual(new Set(formes).size, 6, formes.join(' '));
  for (const g of ['coin', 'bord']) {
    const sigs = CAT.modeles.filter((m) => m.gabarit === g).map((m) => signature(m, 0));
    assert.strictEqual(new Set(sigs).size, sigs.length, g);
  }
});

test('tracés : pas de chemin sur une case, dans une zone de coin, ou contre un autre chemin', () => {
  const pb = [].concat(...CAT.modeles.map(problemesTrace));
  assert.deepStrictEqual(pb, []);
});

test('tracés : le contrôle détecte un chemin qui traverse une case (témoin)', () => {
  const m = JSON.parse(JSON.stringify(CAT.modeles.find((x) => x.id === 'C1')));
  m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c3' } }); // diagonale NO-SE : croise rien
  m.chemins.push({ id: 'y', a: { 'case': 'c2' }, b: { 'case': 'c4' } }); // diagonale NE-SO : croise x
  assert.ok(problemesTrace(m).some((t) => t.includes('x et y se touchent')));
  m.cases.push({ id: 'c5', x: 60, y: 60, diametre: 24, type: 'deplacement' });
  assert.ok(problemesTrace(m).some((t) => t.includes('de c5')));
  // les mêmes défauts sont des erreurs bloquantes de validerModele (règles physiques v2)
  const codes = M.validerModele(m).erreurs.map((e) => e.code);
  assert.ok(codes.includes('chemins_croises') && codes.includes('chemin_case'), codes.join(' '));
});

/* ====================================================================== */
/* Document                                                                */
/* ====================================================================== */

test('nouveauDocument : document vide (version 2, grille 4×4) avec une copie modifiable des 18 modèles', () => {
  const doc = CAT.nouveauDocument();
  const vide = M.nouveauDocument();
  assert.strictEqual(doc.version, 2);
  assert.strictEqual(doc.grille, '4x4');
  assert.deepStrictEqual(doc.plateau, vide.plateau);
  assert.strictEqual(doc.version, vide.version);
  assert.deepStrictEqual(doc.modeles, JSON.parse(JSON.stringify(CAT.modeles)));
  assert.ok(Object.isFrozen(CAT.modeles) && Object.isFrozen(CAT.modeles[0].cases[0]));
  doc.modeles[0].cases[0].x = 1;
  doc.modeles.pop();
  assert.strictEqual(CAT.modeles[0].cases[0].x, 36);
  assert.strictEqual(CAT.modeles.length, 18);
  assert.notStrictEqual(CAT.nouveauDocument().modeles, CAT.nouveauDocument().modeles);
});

test('nouveauDocument : un plateau plein se pose et se valide sans erreur (alertes de pourtour sans apparition)', () => {
  const doc = tirerPlateau(mulberry32(1));
  assert.strictEqual(doc.plateau.tuiles.length, 16);
  const v = M.validerPlateau(doc);
  assert.deepStrictEqual(v.erreurs, []);
  assert.ok(v.alertes.every((a) => ['raccord_mort', 'pourtour_sans_apparition'].includes(a.code)), v.alertes.map((a) => a.code).join(' '));
  assert.ok(v.alertes.filter((a) => a.code === 'pourtour_sans_apparition').length >= 8);
});

/* ====================================================================== */
/* Simulation de plateaux aléatoires : désactivée                          */
/* Ces 8 mesures portaient sur le catalogue v1 et ses règles (2 carrefours,  */
/* rôle apparition, 3 pas entre jonctions, 50 cases de déplacement) :       */
/* à refaire avec le catalogue v2 (docs/19 : 1000 plateaux par format).     */
/* ====================================================================== */

const A_REFAIRE = 'à refaire avec le catalogue v2';
test.skip('simulation : graphe connexe, 9 jonctions à 4 ports, 50 cases de déplacement', A_REFAIRE);
test.skip('simulation : les raccords latéraux relient à eux seuls toutes les cases (sans les jonctions)', A_REFAIRE);
test.skip('simulation : au moins 3 pas entre deux jonctions quelconques', A_REFAIRE);
test.skip('simulation : chaque case d\'apparition a au moins 2 sorties', A_REFAIRE);
test.skip('simulation : peu de raccords morts (moyenne <= 1,5, max <= 2)', A_REFAIRE);
test.skip('simulation : équilibre (docs/16), écarts rares et bornés, pas de « 5 contre 2 » au milieu, première ville égale', A_REFAIRE);
test.skip('simulation : pas d\'autoroute de flanc vers le camp adverse', A_REFAIRE);
test.skip('simulation : les 2 modèles d\'apparition donnent des distances comparables (écart <= 0,5 par rang)', A_REFAIRE);
