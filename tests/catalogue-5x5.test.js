'use strict';
/*
 * Tests du catalogue 5×5 (src/catalogue.js, PM.catalogue.modelesParGrille['5x5']) : répartition B′ de docs/18 et docs/24 § 8,
 * coordonnées validées de docs/29. Contenu, validité (aucune erreur ni alerte, aucune poche), tracés (8 mm entre chemins,
 * rayon + 4 mm des autres cases, 24 mm des coins), règles R1 à R4, raccourci dans toutes les rotations imposées,
 * exemplaires, miroir B7 / B7m, nouveauDocument('5x5'), et un plateau 5×5 complet posé à la main.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/etat.js');
require('../src/sauvegarde.js');
require('../src/graphe.js');
require('../src/equilibre.js');
require('../src/generateur.js');
require('../src/export.js');
require('../src/controles.js');
require('../src/bibliotheque.js');
require('../src/assemblage.js');
require('../src/editeur-tuile.js');
require('../src/catalogue.js');
require('../src/app.js'); // chargeable sous Node : documentPourGrille est dans PM.nouveau
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, GR = PM.graphe, R = PM.rendu, CAT = PM.catalogue;
const F5 = G.format('5x5');

const C5 = CAT.modelesParGrille['5x5'];
const modele = (id) => C5.find((m) => m.id === id);
const parGabarit = (g) => C5.filter((m) => m.gabarit === g);
const copie = (o) => JSON.parse(JSON.stringify(o));

/* ---------------------------- géométrie des tracés ---------------------------- */
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
/** Mêmes contrôles que problemesTrace de tests/catalogue.test.js, au format 5×5 (cotes lues dans G.format('5x5')). */
function problemesTrace(m) {
  const pb = [], ts = R.tracesModele(m, F5);
  for (const t of ts) {
    for (const c of m.cases) {
      if (t.cases.includes(c)) continue;
      const d = distPointPolyligne(c, t.pts);
      if (d < c.diametre / 2 + 4 - 1e-9) pb.push(`${m.id} ${t.id} passe à ${d.toFixed(1)} mm de ${c.id}`);
    }
    for (let k = 0; k < 4; k++) {
      if (t.type === 'port' && t.coin === k) continue;
      const d = distPointPolyligne(F5.pointCoin(k), t.pts);
      if (d < F5.RAYON_ZONE_COIN + 4 - 1e-9) pb.push(`${m.id} ${t.id} entre dans la zone du coin ${k} (${d.toFixed(1)} mm)`);
    }
  }
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
    const commun = ts[i].cases.find((c) => ts[j].cases.includes(c));
    const d = distPolylignes(rogner(ts[i], commun), rogner(ts[j], commun));
    if (d < F5.LARGEUR_CHEMIN - 1e-9) pb.push(`${m.id} ${ts[i].id} et ${ts[j].id} se touchent (${d.toFixed(1)} mm)`);
  }
  return pb;
}

const porteuses = (m) => m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']);
const liens = (m) => m.chemins.filter((ch) => ch.b['case'] !== undefined);
const lateraux = (m) => m.chemins.filter((ch) => ch.b.raccord !== undefined);

/* ================================ contenu ================================ */

test('catalogue 5×5 : 6 modèles (K2 ; B1, B7, B7m ; C7, C8), grille 5×5, cases Ø 20, ids et noms distincts', () => {
  assert.deepEqual(parGabarit('coin').map((m) => m.id), ['K2']);
  assert.deepEqual(parGabarit('bord').map((m) => m.id), ['B1', 'B7', 'B7m']);
  assert.deepEqual(parGabarit('centrale').map((m) => m.id), ['C7', 'C8']);
  assert.equal(C5.length, 6);
  assert.ok(C5.every((m) => m.grille === '5x5' && !('role' in m)));
  assert.ok(C5.every((m) => m.cases.every((c) => c.diametre === F5.DIAMETRE_CASE && c.diametre === 20)));
  assert.equal(new Set(C5.map((m) => m.nom)).size, 6);
  for (const m of C5) {
    assert.ok(typeof m.nom === 'string' && m.nom.length > 0 && m.nom.length <= 20, m.id);
    for (const el of m.cases.concat(m.chemins)) assert.equal(typeof el.id, 'string', m.id);
  }
  // pas de C5 (mur) ni de K4 (trop serré dans 100 mm)
  assert.equal(modele('C5'), undefined);
  assert.equal(modele('K4'), undefined);
});

test('catalogue 5×5 : 30 exemplaires (5 coins, 14 bords, 11 centrales), coordonnées de docs/29', () => {
  const total = (g) => parGabarit(g).reduce((s, m) => s + m.exemplaires, 0);
  assert.deepEqual([total('coin'), total('bord'), total('centrale')], [5, 14, 11]);
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.exemplaires])), { C7: 6, C8: 5, B1: 6, B7: 4, B7m: 4, K2: 5 });
  assert.equal(C5.reduce((s, m) => s + m.exemplaires, 0), 30);
  // de quoi remplir 4 coins, 12 bords et 9 centrales
  assert.ok(total('coin') >= 4 && total('bord') >= 12 && total('centrale') >= 9);
  const pos = (m) => Object.fromEntries(m.cases.map((c) => [c.id, [c.x, c.y]]));
  assert.deepEqual(pos(modele('K2')), { a: [32, 32], r: [53, 53], c1: [74, 74] });
  assert.deepEqual(pos(modele('B1')), { a: [50, 40], c1: [82, 66], c2: [18, 66] });
  assert.deepEqual(pos(modele('B7')), { a: [56, 38], c1: [84, 64] });
  assert.deepEqual(pos(modele('B7m')), { a: [44, 38], c1: [16, 64] });
  assert.deepEqual(pos(modele('C7')), { c0: [50, 50], c1: [28, 28], c3: [72, 72] });
  assert.deepEqual(pos(modele('C8')), { c0: [50, 50], c1: [28, 28], c2: [72, 28] });
});

test('catalogue 5×5 : nombre de cases par tuile (K2, B1, C7, C8 : 3 ; B7, B7m : 2), 69 cases pour un plateau plein', () => {
  assert.deepEqual(Object.fromEntries(C5.map((m) => [m.id, m.cases.length])), { C7: 3, C8: 3, B1: 3, B7: 2, B7m: 2, K2: 3 });
  // 4 coins + 6 B1 + 6 B7 / B7m + 9 centrales (+ 9 jonctions-cases = 78)
  assert.equal(4 * 3 + 6 * 3 + 6 * 2 + 9 * 3, 69);
});

test('catalogue 5×5 : aucune erreur ni alerte de validerModele(m, 5x5) ; aucune poche, par la règle et par un calcul indépendant', () => {
  for (const m of C5) {
    const v = M.validerModele(m, '5x5');
    assert.deepEqual(v.erreurs, [], m.id);
    assert.deepEqual(v.alertes, [], m.id);
    assert.ok(!v.alertes.some((a) => a.code === 'poche'), m.id);
    for (const c of m.cases.filter((x) => x.type !== 'apparition')) {
      const touches = m.chemins.filter((ch) => ch.a['case'] === c.id || ch.b['case'] === c.id);
      const sorties = touches.filter((ch) => ch.b['case'] === undefined || ch.a['case'] === undefined);
      assert.ok(touches.length >= 2 || sorties.length >= 1, `${m.id} : ${c.id} est une impasse`);
    }
  }
});

/* ================================ tracés ================================ */

test('tracés 5×5 : 8 mm entre chemins, r + 4 mm des autres cases, 24 mm des coins (sauf le port)', () => {
  assert.deepEqual([].concat(...C5.map(problemesTrace)), []);
  assert.equal(F5.LARGEUR_CHEMIN, 8);
  assert.equal(F5.RAYON_ZONE_COIN, 20);
});

test('tracés 5×5 : le contrôle détecte un chemin qui traverse une case, ou qui entre dans une zone de coin (témoins)', () => {
  const m = copie(modele('C7'));
  m.chemins.push({ id: 'x', a: { 'case': 'c1' }, b: { 'case': 'c3' } }); // diagonale NO-SE : passe par le centre c0
  assert.ok(problemesTrace(m).some((t) => t.includes('de c0')), problemesTrace(m).join(' | '));
  const k = copie(modele('K2'));
  Object.assign(k.cases.find((c) => c.id === 'r'), { x: 60, y: 45 }); // r près du chemin de l'apparition vers le raccord E
  assert.ok(problemesTrace(k).length > 0, 'K2 déformé');
  assert.ok(M.validerModele(k, '5x5').erreurs.some((e) => e.code === 'chemin_case'));
  const b = copie(modele('B7'));
  Object.assign(b.cases.find((c) => c.id === 'c1'), { x: 90, y: 90 }); // case et port dans la zone du coin SE
  assert.ok(problemesTrace(b).some((t) => t.includes('zone du coin')), problemesTrace(b).join(' | '));
  assert.ok(M.validerModele(b, '5x5').erreurs.some((e) => e.code === 'zone_coin'));
});

/* ================================ règles R1 à R4 ================================ */

test('règles R1 à R4 : un port par case au plus, porteuses jamais reliées, aucun raccord sur une porteuse, aucun port sur l\'apparition', () => {
  for (const m of C5) {
    const ports = porteuses(m);
    assert.equal(new Set(ports).size, ports.length, m.id + ' R1 : deux ports sur une case');
    for (const ch of liens(m)) {
      assert.ok(!(ports.includes(ch.a['case']) && ports.includes(ch.b['case'])), `${m.id} R2 : ${ch.id} relie deux porteuses`);
    }
    for (const ch of lateraux(m)) assert.ok(!ports.includes(ch.a['case']), `${m.id} R3 : ${ch.id} part d'une porteuse`);
    for (const c of m.cases.filter((x) => x.type === 'apparition')) assert.ok(!ports.includes(c.id), `${m.id} R4`);
  }
});

test('catalogue 5×5 : raccords au milieu pour les centrales, raccourci et raccord S seuls sur les bords, raccourci seul sur le coin', () => {
  for (const m of C5) {
    const r = M.masquesDuModele(m).raccords;
    if (m.gabarit === 'centrale') {
      assert.equal(r, 0x492, m.id);
      for (let cote = 0; cote < 4; cote++) assert.equal(G.triplet(r, cote), 0b010, `${m.id} côté ${cote}`);
      assert.equal(m.cases.find((c) => c.id === 'c0').type, 'deplacement');
      assert.equal(lateraux(m).length, 4);
      assert.ok(lateraux(m).every((ch) => ch.a['case'] === 'c0'), m.id + ' : les 4 raccords partent du relais central');
      assert.ok(!porteuses(m).includes('c0'), m.id + ' : le relais ne porte pas de port');
    } else if (m.gabarit === 'bord') {
      assert.equal(r, 0x808 | 0x080, `${m.id} : raccourci E0 + O2 et raccord S au milieu, rien d'autre`);
      assert.equal(G.triplet(r, 0), 0, `${m.id} : rien sur le côté extérieur`);
    } else {
      assert.equal(r, 0x108, `${m.id} : raccourci du coin et rien d'autre`);
    }
  }
});

test('catalogue 5×5 : ports (coins intérieurs seulement), apparition unique sur bords et coins, raccords tirés de l\'apparition', () => {
  assert.equal(M.masquesDuModele(modele('B1')).portsCoin, 0b1100);
  assert.equal(M.masquesDuModele(modele('B7')).portsCoin, 0b0100);   // SE
  assert.equal(M.masquesDuModele(modele('B7m')).portsCoin, 0b1000);  // SO
  assert.equal(M.masquesDuModele(modele('K2')).portsCoin, 0b0100);
  assert.equal(M.masquesDuModele(modele('C7')).portsCoin, 0b0101);   // NO + SE
  assert.equal(M.masquesDuModele(modele('C8')).portsCoin, 0b0011);   // NO + NE
  for (const m of C5) {
    const a = m.cases.filter((c) => c.type === 'apparition');
    assert.equal(a.length, m.gabarit === 'centrale' ? 0 : 1, m.id);
    assert.equal(M.aUneApparition(m), m.gabarit !== 'centrale', m.id);
    if (m.gabarit !== 'centrale') assert.ok(lateraux(m).every((ch) => ch.a['case'] === a[0].id), m.id);
  }
});

test('B7 et B7m : B7m est exactement le miroir x -> 100 - x de B7 (cases, port, raccords)', () => {
  const a = modele('B7'), b = modele('B7m');
  assert.equal(a.exemplaires, b.exemplaires);
  assert.equal(a.cases.length, b.cases.length);
  for (const c of a.cases) {
    const d = b.cases.find((x) => x.id === c.id);
    assert.deepEqual([d.x, d.y, d.type, d.diametre], [F5.COTE - c.x, c.y, c.type, c.diametre], c.id);
  }
  const coinMiroir = { 0: 1, 1: 0, 2: 3, 3: 2 };
  const sym = (e) => e.coin !== undefined ? { coin: coinMiroir[e.coin] }
    : e.raccord ? { raccord: { cote: e.raccord.cote === 1 ? 3 : e.raccord.cote === 3 ? 1 : e.raccord.cote, pos: 2 - e.raccord.pos } } : e;
  const norm = (m, f) => m.chemins.map((ch) => JSON.stringify([ch.a, f(ch.b)])).sort();
  assert.deepEqual(norm(b, (e) => e), norm(a, sym));
  assert.notEqual(M.masquesDuModele(a).portsCoin, M.masquesDuModele(b).portsCoin);
});

/* ================================ raccourci dans les rotations imposées ================================ */

/** Document 5×5 avec les tuiles données [{id, col, lig, rot}], sans contrôle d'exemplaires. */
function docAvec(tuiles) {
  const doc = CAT.nouveauDocument('5x5');
  doc.modeles.forEach((m) => { m.exemplaires = 10; });
  doc.plateau.tuiles = tuiles.map((t) => ({ modeleId: t.id, col: t.col, lig: t.lig, rot: t.rot }));
  return doc;
}
/** Le raccourci relie-t-il deux tuiles voisines ? Lien direct entre cases (hors porteuses) et apparitions à 1 pas. */
function raccourciRelie(doc, a, b) {
  const g = GR.construire(doc, { jetons: [] });
  const cle = (t) => `${t.col},${t.lig}:`;
  const dans = (t) => [...g.cases.values()].filter((c) => c.id.startsWith(cle(t)));
  const appar = (t) => dans(t).filter((c) => c.type === 'apparition')[0].id;
  const porteuse = (id) => [...g.voisins.get(id)].some((v) => !g.cases.has(v));
  const ls = [];
  for (const c of dans(a)) for (const v of g.voisins.get(c.id)) if (g.cases.has(v) && v.startsWith(cle(b))) ls.push([c.id, v]);
  if (!ls.length || ls.some(([x, y]) => porteuse(x) || porteuse(y))) return false;
  return GR.distances(g, appar(a)).get(appar(b)) === 1;
}
const tuile = (id, col, lig) => ({ id, col, lig, rot: M.rotationDeduite(col, lig, modele(id).gabarit, '5x5') });
const nbMorts = (doc) => M.raccordsMorts(doc).filter((r) => r.raison === 'mort').length;

test('raccourci 5×5 : coin–bord aux 4 coins du plateau, de chaque côté, pour K2 et chaque bord (rotations imposées)', () => {
  const dispositions = [
    { coin: [0, 0], bords: [[1, 0], [0, 1]] }, { coin: [4, 0], bords: [[3, 0], [4, 1]] },
    { coin: [4, 4], bords: [[3, 4], [4, 3]] }, { coin: [0, 4], bords: [[1, 4], [0, 3]] }
  ];
  let essais = 0;
  for (const b of parGabarit('bord')) for (const d of dispositions) for (const [bc, bl] of d.bords) {
    const tk = tuile('K2', d.coin[0], d.coin[1]), tb = tuile(b.id, bc, bl);
    const doc = docAvec([tk, tb]);
    assert.ok(raccourciRelie(doc, tk, tb), `K2 en (${tk.col},${tk.lig}) rot ${tk.rot} et ${b.id} en (${bc},${bl}) rot ${tb.rot}`);
    assert.equal(nbMorts(doc), 0);
    essais++;
  }
  assert.equal(essais, 3 * 8);
});

test('raccourci 5×5 : bord–bord voisins sur les 4 côtés (2 paires par côté), pour toutes les paires de bords', () => {
  const cotes = [
    [[1, 0], [2, 0], [3, 0]], [[4, 1], [4, 2], [4, 3]], [[3, 4], [2, 4], [1, 4]], [[0, 3], [0, 2], [0, 1]]
  ];
  let essais = 0;
  for (const a of parGabarit('bord')) for (const b of parGabarit('bord')) for (const c of cotes) for (let k = 0; k < 2; k++) {
    const ta = tuile(a.id, c[k][0], c[k][1]), tb = tuile(b.id, c[k + 1][0], c[k + 1][1]);
    const doc = docAvec([ta, tb]);
    assert.ok(raccourciRelie(doc, ta, tb), `${a.id} (${c[k]}) et ${b.id} (${c[k + 1]})`);
    assert.equal(nbMorts(doc), 0);
    essais++;
  }
  assert.equal(essais, 9 * 4 * 2);
});

test('raccords du milieu 5×5 : bord face à centrale et centrale face à centrale se rejoignent (toutes rotations), sans raccord mort', () => {
  for (const b of parGabarit('bord')) for (const c of parGabarit('centrale')) for (let rot = 0; rot < 4; rot++) {
    const doc = docAvec([tuile(b.id, 2, 0), { id: c.id, col: 2, lig: 1, rot }]);
    assert.equal(nbMorts(doc), 0, `${b.id} / ${c.id} rot ${rot}`);
    assert.ok(GR.construire(doc, { jetons: [] }).voisins.get('2,0:a').has('2,1:c0'), `${b.id} : le raccord S relie l'apparition au relais de ${c.id}`);
  }
  for (const c1 of parGabarit('centrale')) for (const c2 of parGabarit('centrale')) for (let r = 0; r < 4; r++) {
    const doc = docAvec([{ id: c1.id, col: 1, lig: 1, rot: 0 }, { id: c2.id, col: 2, lig: 1, rot: r }]);
    assert.equal(nbMorts(doc), 0);
    assert.ok(GR.construire(doc, { jetons: [] }).voisins.get('1,1:c0').has('2,1:c0'));
  }
});

/* ================================ nouveauDocument et API ================================ */

test('API : modeles reste le 4×4 ; modelesParGrille gelé { 4x4, 5x5 }', () => {
  assert.equal(CAT.modeles.length, 13);
  assert.equal(CAT.modelesParGrille['4x4'], CAT.modeles);
  assert.deepEqual(Object.keys(CAT.modelesParGrille), ['4x4', '5x5']);
  assert.ok(Object.isFrozen(CAT.modelesParGrille) && Object.isFrozen(C5));
  assert.ok(Object.isFrozen(C5[0].cases[0]) && Object.isFrozen(C5[0].chemins[0].b));
  assert.ok(CAT.modeles.every((m) => m.grille === '4x4'));
});

test('nouveauDocument(\'5x5\') : document 5×5 vide avec une copie modifiable des 6 modèles ; défaut 4×4 ; grille inconnue refusée', () => {
  const doc = CAT.nouveauDocument('5x5');
  assert.equal(doc.version, 2);
  assert.equal(doc.grille, '5x5');
  assert.deepEqual(doc.plateau, M.nouveauDocument('5x5').plateau);
  assert.deepEqual(doc.modeles, copie(C5));
  doc.modeles.forEach((m) => assert.deepEqual(M.validerModele(m, '5x5').erreurs, []));
  doc.modeles[0].cases[0].x = 1;
  doc.modeles.pop();
  assert.equal(C5[0].cases[0].x, 50);
  assert.equal(C5.length, 6);
  assert.notEqual(CAT.nouveauDocument('5x5').modeles, CAT.nouveauDocument('5x5').modeles);
  assert.equal(CAT.nouveauDocument().grille, '4x4');
  assert.equal(CAT.nouveauDocument('4x4').modeles.length, 13);
  for (const g of ['6x6', 'hex', '', 5, {}, 'constructor', '__proto__']) assert.throws(() => CAT.nouveauDocument(g), /Grille inconnue/, String(g));
});

test('interface : documentPourGrille(\'5x5\') accepte le document du catalogue ; 4×4 reste accepté ; grille inconnue refusée', () => {
  const r = PM.nouveau.documentPourGrille('5x5');
  assert.equal(r.ok, true, r.raison);
  assert.equal(r.doc.grille, '5x5');
  assert.deepEqual(r.doc.modeles.map((m) => m.id), C5.map((m) => m.id));
  assert.ok(r.doc.modeles.every((m) => m.grille === '5x5'));
  assert.equal(r.doc.plateau.tuiles.length, 0);
  const r4 = PM.nouveau.documentPourGrille('4x4');
  assert.equal(r4.ok, true);
  assert.equal(r4.doc.modeles.length, 13);
  assert.equal(PM.nouveau.documentPourGrille('7x7').ok, false);
  // la bibliothèque reconnaît les modèles livrés de chaque grille
  assert.equal(PM.bibliotheque.estTuileUtilisateur(r.doc, 'K2'), false);
  const ajoute = M.ajouterModele(r.doc, Object.assign(copie(C5[0]), { id: 'Z9' }));
  assert.equal(PM.bibliotheque.estTuileUtilisateur(ajoute, 'Z9'), true);
});

/* ================================ plateau 5×5 complet ================================ */

/**
 * Plateau plein posé à la main : coins K2 aux 4 coins, 6 B1 + 4 B7 + 2 B7m sur les 12 cases de bord (rotation imposée par la
 * place), 9 centrales C7 / C8 dont la rotation (quatrième valeur) donne à chaque jonction intérieure au moins 2 ports.
 * Disposition trouvée par recherche aléatoire sur les poses puis fixée ici : 8 jonctions à 3 ports, 8 à 2, et le placement
 * « 2-3-2 » des 7 villes (2 sur j = 1, 3 sur j = 2 et 3, 2 sur j = 4) est possible avec au moins 3 ports à chaque ville.
 */
const PLATEAU = [
  ['K2', 0, 0], ['B7', 1, 0], ['B1', 2, 0], ['B1', 3, 0], ['K2', 4, 0],
  ['B1', 0, 1], ['C7', 1, 1, 1], ['C7', 2, 1, 1], ['C8', 3, 1, 2], ['B7', 4, 1],
  ['B7m', 0, 2], ['C7', 1, 2, 3], ['C7', 2, 2, 1], ['C8', 3, 2, 2], ['B1', 4, 2],
  ['B7m', 0, 3], ['C7', 1, 3, 0], ['C8', 2, 3, 0], ['C7', 3, 3, 1], ['B7', 4, 3],
  ['K2', 0, 4], ['B7', 1, 4], ['B1', 2, 4], ['B1', 3, 4], ['K2', 4, 4]
];
const VILLES = [[2, 1], [3, 1], [4, 2], [1, 3], [4, 3], [1, 4], [3, 4]]; // 2-3-2, chacune à 3 ports
function plateauComplet() {
  const doc = CAT.nouveauDocument('5x5');
  doc.plateau.tuiles = PLATEAU.map(([id, col, lig, rot]) => ({
    modeleId: id, col, lig, rot: rot !== undefined ? rot : M.rotationDeduite(col, lig, modele(id).gabarit, '5x5')
  }));
  return doc;
}

test('plateau 5×5 complet : 25 tuiles dans les exemplaires, aucune erreur ni alerte, aucun raccord mort, aucune jonction mal reliée', () => {
  const doc = plateauComplet();
  assert.equal(doc.plateau.tuiles.length, 25);
  const utilises = {};
  doc.plateau.tuiles.forEach((t) => { utilises[t.modeleId] = (utilises[t.modeleId] || 0) + 1; });
  assert.deepEqual(utilises, { K2: 4, B7: 4, B7m: 2, B1: 6, C7: 6, C8: 3 });
  for (const m of C5) assert.ok(utilises[m.id] <= m.exemplaires, `${m.id} : ${utilises[m.id]} posés pour ${m.exemplaires} exemplaires`);
  const v = M.validerPlateau(doc);
  assert.deepEqual(v.erreurs, []);
  assert.deepEqual(v.alertes, []);
  assert.deepEqual(M.raccordsMorts(doc), []);
  assert.deepEqual(M.jonctionsMalReliees(doc), []);
  for (const t of doc.plateau.tuiles) assert.equal(M.gabaritCellule(t.col, t.lig, '5x5'), M.modeleParId(doc, t.modeleId).gabarit);
});

test('plateau 5×5 complet : 78 cases (69 des tuiles + 9 jonctions-cases), 40 ports, au moins 2 ports à chaque jonction, 8 jonctions à 3', () => {
  const doc = plateauComplet();
  const g = GR.construire(doc, { jetons: VILLES.map(([i, j]) => ({ i, j, type: 'capture' })) });
  assert.equal(g.jonctions.length, 16);
  assert.equal(g.villes.size, 7);
  assert.equal(g.cases.size, 4 * 3 + 6 * 3 + 6 * 2 + 9 * 3);
  const jonctionsCases = g.jonctions.filter((j) => j.type === 'case').length;
  assert.equal(jonctionsCases, 9);
  assert.equal(g.cases.size + jonctionsCases, 78);
  const ports = g.jonctions.map((j) => j.ports);
  assert.equal(ports.reduce((a, b) => a + b, 0), 40);
  assert.ok(Math.min(...ports) >= 2, 'ports par jonction : ' + ports.join());
  assert.equal(ports.filter((p) => p >= 3).length, 8);
  assert.equal(Math.max(...ports), 3);
  // chaque ville (2-3-2) a au moins 3 ports
  for (const j of g.jonctions.filter((x) => x.type === 'ville')) assert.ok(j.ports >= 3, `ville (${j.i},${j.j})`);
  assert.deepEqual([1, 2, 3, 4].map((r) => VILLES.filter(([, j]) => j === r).length), [2, 1, 2, 2]); // rangées 2 et 3 : 3 villes
  // même décompte par PM.modele.portsJonction (indépendant du graphe)
  for (const j of g.jonctions) assert.equal(M.portsJonction(doc, j.i, j.j).ports, j.ports, `(${j.i},${j.j})`);
  assert.ok(GR.connexe(g));
});

test('plateau 5×5 complet : R1 à R3 lues dans le graphe, écart d\'au moins 4 pas entre deux jonctions, apparitions des deux camps', () => {
  const doc = plateauComplet();
  const g = GR.construire(doc, { jetons: [] });
  const jonction = (id) => !g.cases.has(id);
  for (const [id] of g.cases) {
    const js = [...g.voisins.get(id)].filter(jonction);
    assert.ok(js.length <= 1, id + ' : R1');
    if (js.length) for (const v of g.voisins.get(id)) {
      if (jonction(v)) continue;
      assert.equal([...g.voisins.get(v)].filter(jonction).length, 0, `${id} et ${v} : R2 / R3`);
    }
  }
  let mini = Infinity;
  for (const a of g.jonctions) {
    const d = GR.distances(g, a.id);
    for (const b of g.jonctions) if (a !== b && d.has(b.id)) mini = Math.min(mini, d.get(b.id));
  }
  assert.ok(mini >= 4, 'écart minimal ' + mini);
  // camps : rangées 0 et 1 vertes, rangées 3 et 4 rouges, rangée 2 neutre ; les 16 tuiles du pourtour portent chacune une
  // apparition : 5 (rangée 0) + 2 (rangée 1) pour le vert, autant pour le rouge, 2 neutres
  assert.equal(g.apparitions[1].length, 5 + 2);
  assert.equal(g.apparitions[2].length, 5 + 2);
});

/* ================================ recette du testeur : cas limites (chaîne complète) ================================ */

const VILLES_JETONS = VILLES.map(([i, j]) => ({ i, j, type: 'capture' }));
function plateauAvecVilles() {
  const doc = plateauComplet();
  doc.plateau.jetons = copie(VILLES_JETONS);
  return doc;
}
/** Modèle 4×4 du catalogue livré, sous un autre identifiant (pour l'ajouter à un document 5×5). */
const modele4 = (id, nouvelId) => Object.assign(copie(CAT.modelesParGrille['4x4'].find((m) => m.id === id)), { id: nouvelId || id });

test('chaîne : enregistrement / réouverture JSON d\'un plateau 5×5 complet, sans perte ni alerte, grille conservée', () => {
  const doc = plateauAvecVilles();
  const texte = PM.sauvegarde.versJSON(doc);
  assert.equal(JSON.parse(texte).grille, '5x5');
  const r = PM.sauvegarde.depuisJSON(texte);
  assert.equal(r.ok, true, JSON.stringify(r.erreurs));
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes, []);
  assert.equal(r.migre, false);
  assert.equal(r.doc.grille, '5x5');
  assert.deepEqual(r.doc.modeles, doc.modeles);
  assert.deepEqual(r.doc.plateau, doc.plateau);
  // la réouverture est stable (deuxième aller-retour identique) et valide encore
  const r2 = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(r.doc));
  assert.deepEqual(r2.doc, r.doc);
  const v = M.validerPlateau(r.doc);
  assert.deepEqual([v.erreurs, v.alertes], [[], []]);
  // document 5×5 vide (juste après « Nouveau ») : aller-retour sans perte ni changement de grille
  const vide = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(CAT.nouveauDocument('5x5')));
  assert.equal(vide.ok, true);
  assert.equal(vide.doc.grille, '5x5');
  assert.equal(vide.doc.modeles.length, 6);
});

test('chaîne : un fichier 5×5 dont l\'en-tête `grille` manque n\'est pas lu sans aucun signalement', () => {
  const o = JSON.parse(PM.sauvegarde.versJSON(plateauComplet()));
  delete o.grille;
  const r = PM.sauvegarde.depuisJSON(JSON.stringify(o));
  // soit le fichier est refusé, soit il est lu en 4×4 avec des alertes / erreurs sur les modèles ou le plateau : jamais « tout va bien »
  const signale = !r.ok || r.alertes.length > 0 || (r.doc && (M.validerPlateau(r.doc).erreurs.length > 0 ||
    r.doc.modeles.some((m) => M.validerModele(m, M.formatDuDocument(r.doc)).erreurs.length > 0)));
  assert.ok(signale, 'un fichier 5×5 sans grille a été lu sans aucun signalement');
});

test('chaîne : annuler / rétablir sur un document 5×5 (pose, remplacement), grille et catalogue inchangés', () => {
  const etat = PM.etat.creer(CAT.nouveauDocument('5x5'));
  assert.equal(etat.doc().grille, '5x5');
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'K2', 0, 0)), { ok: true });
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'B7', 1, 0)), { ok: true });
  assert.deepEqual(etat.appliquer((d) => M.poserTuile(d, 'C7', 2, 2, 1)), { ok: true });
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.deepEqual(etat.doc().plateau.tuiles[0], { modeleId: 'K2', col: 0, lig: 0, rot: 0 });
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 2);
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 1);
  assert.ok(etat.peutRetablir());
  etat.retablir(); etat.retablir();
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.deepEqual(etat.doc().plateau.tuiles[2], { modeleId: 'C7', col: 2, lig: 2, rot: 1 });
  assert.ok(!etat.peutRetablir());
  // pose refusée : le document ne change pas
  const avant = JSON.stringify(etat.doc());
  const refus = etat.appliquer((d) => M.poserTuile(d, 'C7', 0, 0));
  assert.equal(refus.ok, false);
  assert.equal(JSON.stringify(etat.doc()), avant);
  // remplacement complet par un document 4×4 puis annulation : retour au 5×5
  etat.remplacer(CAT.nouveauDocument('4x4'), 'Nouveau 4×4');
  assert.equal(etat.doc().grille, '4x4');
  etat.annuler();
  assert.equal(etat.doc().grille, '5x5');
  assert.equal(etat.doc().plateau.tuiles.length, 3);
  assert.equal(C5.length, 6);
  assert.equal(C5[5].cases[0].x, 32);
});

test('chaîne : PM.controles.calculer sur le plateau 5×5 complet (7 villes) : aucune erreur ni alerte, compteurs 5×5 à leur cible', () => {
  const c = PM.controles.calculer(plateauAvecVilles());
  assert.deepEqual(c.erreurs, []);
  assert.deepEqual(c.alertes, []);
  const v = (cle) => c.compteurs.find((x) => x.cle === cle);
  assert.equal(v('villes').valeur, 7);
  assert.equal(v('cases').valeur, 78);
  assert.equal(v('tuiles').valeur, 25);
  assert.equal(v('tuiles').cible, 25);
  assert.deepEqual([v('apparitions_vert').valeur, v('apparitions_rouge').valeur], [7, 7]);
  assert.equal(v('dimensions').valeur, '50 × 50 cm');
  assert.equal(v('tuiles_petites').valeur, 0);
  assert.ok(c.compteurs.every((x) => x.etat === 'ok'), JSON.stringify(c.compteurs.filter((x) => x.etat !== 'ok')));
});

test('chaîne : PM.controles.calculer sur un document 5×5 vide et sur des plateaux partiels ne lève pas d\'erreur', () => {
  const vide = PM.controles.calculer(CAT.nouveauDocument('5x5'));
  assert.deepEqual(vide.erreurs, []);
  assert.equal(vide.compteurs.find((x) => x.cle === 'tuiles').valeur, 0);
  const partiel = docAvec([tuile('K2', 0, 0)]);
  assert.doesNotThrow(() => PM.controles.calculer(partiel));
  partiel.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }];
  assert.doesNotThrow(() => PM.controles.calculer(partiel));
  // plateau complet moins un bord : calculable, et le trou est signalé (pas de silence)
  const trou = plateauAvecVilles();
  trou.plateau.tuiles = trou.plateau.tuiles.filter((t) => !(t.col === 2 && t.lig === 0));
  const c = PM.controles.calculer(trou);
  assert.ok(c.erreurs.length + c.alertes.length > 0, 'un plateau 5×5 troué ne déclenche ni erreur ni alerte');
});

test('chaîne : rapport d\'équilibre du plateau 5×5 complet (grille 5x5, 7 villes, complet, pas de blocage)', () => {
  const doc = plateauAvecVilles();
  const a = PM.equilibre.analyser(doc);
  assert.equal(a.grille, '5x5');
  const r = PM.equilibre.rapport(a);
  assert.equal(r.complet, true);
  assert.deepEqual(r.blocages, []);
  assert.deepEqual(r.lacunes, []);
  assert.equal(r.rangs.length, 7);
  assert.ok(r.rangs.every((x) => !x.fort), JSON.stringify(r.rangs));
  assert.equal(r.aSurveiller, false);
  assert.equal(a.resultat.tresDesequilibre, false);
  assert.equal(r.rangs[0].d1, r.rangs[0].d2);
  // sans ville : analyse sans exception, rapport incomplet
  const sans = PM.equilibre.rapport(PM.equilibre.analyser(plateauComplet()));
  assert.equal(sans.complet, false);
});

test('chaîne : export du jeu complet 5×5 : 30 tuiles, planches A3 (2×3) et A4 (1×2), pas de 112 mm, tuile de 106 mm', () => {
  const E = PM.exportation;
  const doc = CAT.nouveauDocument('5x5');
  const liste = E.listeTuiles(doc, { portee: 'stock' });
  assert.equal(liste.tuiles.length, 30);
  assert.deepEqual(liste.exclus, []);
  const a3 = E.calepiner(doc, { format: 'A3' });
  assert.equal(a3.length, 5);                    // 30 / 6
  assert.ok(a3.every((p) => p.pas === 112 && p.tuiles.length === 6));
  assert.equal(a3[0].tuiles[1].x - a3[0].tuiles[0].x, 112);
  assert.equal(a3[0].tuiles[2].y - a3[0].tuiles[0].y, 112);
  const a4 = E.calepiner(doc, { format: 'A4' });
  assert.equal(a4.length, 15);                   // 30 / 2
  assert.ok(a4.every((p) => p.colonnes === 1 && p.tuiles.length === 2));
  for (const p of a3.concat(a4)) {
    assert.ok(p.margeX >= E.MARGE_MIN - 1e-9 && p.margeY >= E.MARGE_MIN - 1e-9, `${p.nom} marges ${p.margeX} / ${p.margeY}`);
    const droite = p.margeX + (p.colonnes - 1) * p.pas + 106, bas = p.margeY + (p.lignes - 1) * p.pas + 106;
    assert.ok(p.largeur - droite >= E.MARGE_MIN - 1e-9 && p.hauteur - bas >= E.MARGE_MIN - 1e-9, p.nom);
  }
  for (const p of a3) {
    const svg = p.svg;
    assert.ok(svg.includes('width="106" height="106"'), p.nom);
    assert.ok(!svg.includes('width="126"'), p.nom + ' : cote 4×4 dans une planche 5×5');
    assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), p.nom);
  }
  const pdf = Buffer.from(E.pdfDepuisPlanches(a3, doc)).toString('latin1');
  assert.ok(pdf.startsWith('%PDF-'));
  assert.ok(pdf.includes('/Count 5'));
  assert.ok(pdf.includes('/MediaBox [0 0 841.89 1190.55]'));
  assert.ok(Buffer.from(E.pdfDepuisPlanches(a4.slice(0, 1), doc)).toString('latin1').includes('/MediaBox [0 0 595.28 841.89]'));
});

test('chaîne : export des seules tuiles posées du plateau 5×5 complet (25 tuiles) et PDF', () => {
  const E = PM.exportation, doc = plateauAvecVilles();
  const liste = E.listeTuiles(doc, { portee: 'posees' });
  assert.equal(liste.tuiles.length, 25);
  assert.deepEqual(liste.exclus, []);
  assert.equal(E.calepiner(doc, { format: 'A3', portee: 'posees' }).length, 5); // ceil(25 / 6)
  const planches = E.calepiner(doc, { format: 'A4', portee: 'posees' });
  assert.equal(planches.length, 13);              // ceil(25 / 2)
  assert.ok(E.pdfDepuisPlanches(planches, doc).length > 1000);
});

test('chaîne : aperçu du plateau 5×5 (SVG) : 50 × 50 cm, tuiles tous les 100 mm, PDF', () => {
  const E = PM.exportation, doc = plateauAvecVilles();
  const svg = E.svgApercuPlateau(doc);
  assert.ok(svg.includes('Plateau assemblé 50 x 50 cm, réduit à 54 %'), svg.match(/Plateau assembl[^<]*/)[0]);
  const decalages = (svg.match(/<g transform="translate\((\d+) (\d+)\)" clip-path/g) || []).map((s) => s.match(/\((\d+) (\d+)\)/).slice(1).map(Number));
  assert.equal(decalages.length, 25);
  assert.ok(decalages.every(([x, y]) => x % 100 === 0 && y % 100 === 0 && x <= 400 && y <= 400));
  assert.equal(new Set(decalages.map((d) => d.join())).size, 25);
  assert.ok(svg.includes('width="100" height="100"'));
  assert.ok(!svg.includes('width="120"') && !svg.includes('width="126"'));
  assert.ok(svg.includes('<rect x="0" y="0" width="500" height="500"'), 'cadre 500 × 500 mm');
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined'));
  assert.ok(E.pdfDepuisPlanches([{ svg }], doc).length > 1000);
});

test('chaîne : exemplaires modifiés d\'un document 5×5 : export du stock et réouverture', () => {
  const doc = CAT.nouveauDocument('5x5');
  doc.modeles.find((m) => m.id === 'K2').exemplaires = 0;
  doc.modeles.find((m) => m.id === 'C7').exemplaires = 2;
  assert.equal(PM.exportation.listeTuiles(doc, { portee: 'stock' }).tuiles.length, 30 - 5 - 4);
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  assert.equal(r.doc.modeles.find((m) => m.id === 'K2').exemplaires, 0);
  assert.equal(r.doc.modeles.find((m) => m.id === 'C7').exemplaires, 2);
});

/* ---------------------------- copies indépendantes ---------------------------- */

test('nouveauDocument : copies indépendantes entre elles, du catalogue gelé et de l\'autre grille', () => {
  const a = CAT.nouveauDocument('5x5'), b = CAT.nouveauDocument('5x5'), c4 = CAT.nouveauDocument('4x4');
  const instantane = JSON.stringify(C5);
  const instantane4 = JSON.stringify(CAT.modelesParGrille['4x4']);
  for (const [i, m] of a.modeles.entries()) {
    assert.notEqual(m, b.modeles[i]); assert.notEqual(m, C5[i]);
    assert.notEqual(m.cases, b.modeles[i].cases); assert.notEqual(m.cases[0], C5[i].cases[0]);
    assert.notEqual(m.chemins, C5[i].chemins); assert.notEqual(m.chemins[0].b, C5[i].chemins[0].b);
    assert.ok(!Object.isFrozen(m) && !Object.isFrozen(m.cases) && !Object.isFrozen(m.cases[0]), m.id + ' : copie gelée');
  }
  assert.notEqual(a.plateau, b.plateau);
  assert.notEqual(a.plateau.tuiles, b.plateau.tuiles);
  a.modeles[0].cases[0].x = 1; a.modeles[0].nom = 'X'; a.modeles[0].chemins.length = 0; a.modeles[1].exemplaires = 99;
  a.plateau.tuiles.push({ modeleId: 'K2', col: 0, lig: 0, rot: 0 }); a.plateau.jetons.push({ i: 1, j: 1, type: 'capture' });
  assert.equal(b.modeles[0].cases[0].x, 50);
  assert.equal(b.modeles[0].nom, 'Pont');
  assert.equal(b.modeles[1].exemplaires, 5);
  assert.deepEqual(b.plateau, { tuiles: [], jetons: [] });
  assert.deepEqual(CAT.nouveauDocument('5x5').plateau, { tuiles: [], jetons: [] });
  assert.equal(JSON.stringify(C5), instantane);
  assert.equal(JSON.stringify(CAT.modelesParGrille['4x4']), instantane4);
  assert.equal(JSON.stringify(CAT.nouveauDocument('5x5').modeles), instantane);
  assert.equal(c4.modeles.length, 13);
  assert.ok(c4.modeles.every((m) => m.grille === '4x4') && b.modeles.every((m) => m.grille === '5x5'));
  const ids = new Set(b.modeles.map((m) => m.id));
  for (const x of ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'B3', 'B4', 'B5', 'B6', 'K4']) assert.ok(!ids.has(x), x);
});

test('nouveauDocument : un document réouvert via JSON reste indépendant du catalogue ; les changements purs ne touchent pas l\'original', () => {
  const doc = CAT.nouveauDocument('5x5');
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  r.doc.modeles[2].cases[0].x = 3;
  assert.equal(C5[2].cases[0].x, 50);
  const apres = M.changerExemplaires(doc, 'K2', 9);
  assert.equal(M.modeleParId(apres, 'K2').exemplaires, 9);
  assert.equal(M.modeleParId(doc, 'K2').exemplaires, 5);
  assert.equal(modele('K2').exemplaires, 5);
});

/* ---------------------------- 4×4 / 5×5 : refus croisés ---------------------------- */

test('grilles : un modèle 4×4 est refusé dans un document 5×5 (validation, pose, armement)', () => {
  const doc = M.ajouterModele(CAT.nouveauDocument('5x5'), modele4('K2', 'K2-44'));
  const v = M.validerModele(M.modeleParId(doc, 'K2-44'), '5x5');
  assert.ok(v.erreurs.some((e) => e.code === 'grille_modele'), JSON.stringify(v.erreurs));
  assert.equal(v.complet, false);
  const p = M.peutPoserTuile(doc, 'K2-44', 0, 0);
  assert.equal(p.ok, false, 'un modèle 4×4 a été posé sur un coin 5×5');
  assert.throws(() => M.poserTuile(doc, 'K2-44', 0, 0));
  assert.match(PM.bibliotheque.refusArmement(doc, 'K2-44'), /grille/);
  assert.notEqual(PM.bibliotheque.phraseAutreGrille(M.modeleParId(doc, 'K2-44'), doc), '');
  assert.equal(M.peutPoserTuile(doc, 'K2', 0, 0).ok, true);
  assert.equal(PM.bibliotheque.refusArmement(doc, 'K2'), '');
  for (const m of CAT.modelesParGrille['4x4']) {
    assert.ok(M.validerModele(m, '5x5').erreurs.some((e) => e.code === 'grille_modele'), m.id);
  }
});

test('grilles : un modèle 5×5 est refusé dans un document 4×4 (validation, pose, armement)', () => {
  let doc = CAT.nouveauDocument('4x4');
  for (const m of C5) doc = M.ajouterModele(doc, Object.assign(copie(m), { id: m.id + '-55' }));
  for (const m of C5) {
    const id = m.id + '-55';
    assert.ok(M.validerModele(M.modeleParId(doc, id), '4x4').erreurs.some((e) => e.code === 'grille_modele'), id);
    const col = m.gabarit === 'coin' ? 0 : 1, lig = m.gabarit === 'centrale' ? 1 : 0;
    assert.equal(M.peutPoserTuile(doc, id, col, lig).ok, false, id + ' posé en 4×4');
    assert.match(PM.bibliotheque.refusArmement(doc, id), /grille/, id);
  }
});

test('grilles : un modèle sans champ `grille` reste accepté partout (compatibilité des fichiers anciens)', () => {
  const m = copie(modele('K2')); delete m.grille; m.id = 'ancien';
  const doc = M.ajouterModele(CAT.nouveauDocument('5x5'), m);
  assert.equal(PM.bibliotheque.phraseAutreGrille(M.modeleParId(doc, 'ancien'), doc), '');
  assert.ok(!M.validerModele(M.modeleParId(doc, 'ancien'), '5x5').erreurs.some((e) => e.code === 'grille_modele'));
});

test('grilles : une tuile 4×4 posée à la main sur un plateau 5×5 est signalée (validation, contrôles, réouverture JSON)', () => {
  const doc = M.ajouterModele(CAT.nouveauDocument('5x5'), modele4('K2', 'K2-44'));
  doc.plateau.tuiles.push({ modeleId: 'K2-44', col: 0, lig: 0, rot: 0 });
  const v = M.validerPlateau(doc);
  assert.ok(v.erreurs.length + v.alertes.length > 0, 'tuile 4×4 sur un plateau 5×5 acceptée sans signalement');
  const c = PM.controles.calculer(doc);
  assert.ok(c.erreurs.length + c.alertes.length > 0);
  const r = PM.sauvegarde.depuisJSON(PM.sauvegarde.versJSON(doc));
  assert.ok(!r.ok || r.alertes.length > 0 || M.validerPlateau(r.doc).erreurs.length > 0, 'réouverture muette');
});

/* ---------------------------- ids identiques entre grilles ---------------------------- */

test('bibliothèque : K2 / B1 / C7 sont du catalogue dans leur grille ; un id propre à l\'autre grille est une tuile utilisateur', () => {
  const B = PM.bibliotheque, d5 = CAT.nouveauDocument('5x5'), d4 = CAT.nouveauDocument('4x4');
  for (const id of ['K2', 'B1', 'B7', 'B7m', 'C7', 'C8']) assert.equal(B.estTuileUtilisateur(d5, id), false, '5×5 ' + id);
  for (const m of CAT.modelesParGrille['4x4']) assert.equal(B.estTuileUtilisateur(d4, m.id), false, '4×4 ' + m.id);
  assert.equal(B.estTuileUtilisateur(d5, 'inconnu'), false);
  assert.equal(B.estTuileUtilisateur(d4, 'C7'), false);
  // C1 (catalogue 4×4) ajouté par l'utilisateur dans un document 5×5 : pas une tuile livrée du 5×5
  const d5c1 = M.ajouterModele(d5, Object.assign(copie(modele('C7')), { id: 'C1' }));
  assert.equal(B.estTuileUtilisateur(d5c1, 'C1'), true);
  assert.equal(B.supprimerTuileUtilisateur(d5c1, 'C1').modeles.length, 6);
  // C7 (catalogue 5×5) ajouté par l'utilisateur dans un document 4×4 : tuile utilisateur du 4×4
  const d4c7 = M.ajouterModele(d4, Object.assign(copie(CAT.modelesParGrille['4x4'][0]), { id: 'C7' }));
  assert.equal(B.estTuileUtilisateur(d4c7, 'C7'), true);
  assert.equal(B.supprimerTuileUtilisateur(d4c7, 'C7').modeles.length, 13);
});

test('bibliothèque : suppression interdite des 6 modèles livrés 5×5 (K2 et B1 aussi en 4×4), même posés ou modifiés', () => {
  const B = PM.bibliotheque, doc = plateauAvecVilles();
  for (const id of ['K2', 'B1', 'B7', 'B7m', 'C7', 'C8']) {
    assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('5x5'), id), /catalogue livré/, id);
    assert.throws(() => B.supprimerTuileUtilisateur(doc, id), /catalogue livré/, id + ' posé');
  }
  assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('5x5'), 'zzz'), /introuvable/);
  for (const id of ['K2', 'B1']) assert.throws(() => B.supprimerTuileUtilisateur(CAT.nouveauDocument('4x4'), id), /catalogue livré/, '4×4 ' + id);
  const modif = M.remplacerModele(CAT.nouveauDocument('5x5'), 'K2', Object.assign(copie(modele('K2')), { nom: 'Mon coin' }));
  assert.equal(B.estTuileUtilisateur(modif, 'K2'), false);
  const groupes = B.vignettesBibliotheque(CAT.nouveauDocument('5x5'), 'tous');
  const tous = [].concat(...groupes.map((g) => g.modeles));
  assert.equal(tous.length, 6);
  assert.ok(tous.every((m) => m.utilisateur === false && m.complet && m.posable && m.autreGrille === false), JSON.stringify(tous));
});

test('bibliothèque : suppression d\'une tuile utilisateur 5×5 posée (tuile retirée, annulable en une entrée)', () => {
  const B = PM.bibliotheque;
  let doc = plateauAvecVilles();
  doc = M.ajouterModele(doc, Object.assign(copie(modele('C7')), { id: 'U1' }));
  doc = M.retirerTuile(doc, 2, 1);
  doc = M.poserTuile(doc, 'U1', 2, 1, 1);
  assert.equal(B.estTuileUtilisateur(doc, 'U1'), true);
  assert.equal(B.effetsSuppression(doc, 'U1').tuilesRetirees, 1);
  const apres = B.supprimerTuileUtilisateur(doc, 'U1');
  assert.equal(apres.plateau.tuiles.length, 24);
  assert.equal(apres.grille, '5x5');
  assert.equal(M.modeleParId(apres, 'U1'), null);
  assert.equal(apres.modeles.length, 6);
  const etat = PM.etat.creer(doc);
  etat.appliquer((d) => B.supprimerTuileUtilisateur(d, 'U1'));
  assert.equal(etat.doc().plateau.tuiles.length, 24);
  etat.annuler();
  assert.equal(etat.doc().plateau.tuiles.length, 25);
  assert.ok(M.modeleParId(etat.doc(), 'U1'));
});

/* ---------------------------- poses : chaque modèle n'accepte que sa place ---------------------------- */

test('poses 5×5 : chaque modèle ne se pose que dans les cellules de son gabarit (4 coins, 12 bords, 9 centrales), rotation imposée', () => {
  const doc = CAT.nouveauDocument('5x5');
  const attendus = { coin: 4, bord: 12, centrale: 9 };
  for (const m of C5) {
    let ok = 0;
    for (let lig = 0; lig < 5; lig++) for (let col = 0; col < 5; col++) {
      const role = M.gabaritCellule(col, lig, '5x5');
      const p = M.peutPoserTuile(doc, m.id, col, lig);
      assert.equal(p.ok, role === m.gabarit, `${m.id} en (${col},${lig}) [${role}] : ${p.raison}`);
      if (p.ok) {
        ok++;
        const dedu = M.rotationDeduite(col, lig, m.gabarit, '5x5');
        assert.equal(p.rot, dedu === null ? 0 : dedu, `${m.id} (${col},${lig})`);
        assert.equal(M.poserTuile(doc, m.id, col, lig).plateau.tuiles[0].rot, p.rot);
      } else {
        assert.ok(p.raison.length > 0);
        assert.throws(() => M.poserTuile(doc, m.id, col, lig));
      }
    }
    assert.equal(ok, attendus[m.gabarit], m.id);
  }
});

test('poses 5×5 : cellules hors grille et cellule occupée refusées ; le centre (2,2) est une centrale neutre', () => {
  const doc = CAT.nouveauDocument('5x5');
  for (const [c, l] of [[5, 0], [0, 5], [-1, 0], [0, -1], [5, 5], [7, 2]]) {
    for (const id of ['K2', 'B1', 'C7']) assert.equal(M.peutPoserTuile(doc, id, c, l).ok, false, `${id} (${c},${l})`);
  }
  const un = M.poserTuile(doc, 'C7', 2, 2);
  assert.equal(M.peutPoserTuile(un, 'C8', 2, 2).ok, false);
  assert.equal(M.peutPoserTuile(un, 'C7', 2, 2).ok, false);
  assert.equal(M.gabaritCellule(2, 2, '5x5'), 'centrale');
  assert.equal(F5.campCellule(2, 2), null);
});

test('poses 5×5 : les 4 B7 posés sur les 4 côtés prennent 4 rotations distinctes et leurs ports tombent sur des jonctions intérieures', () => {
  const doc = CAT.nouveauDocument('5x5');
  const cases = [[1, 0], [4, 1], [3, 4], [0, 3]];
  const rots = cases.map(([col, lig]) => M.peutPoserTuile(doc, 'B7', col, lig).rot);
  assert.deepEqual(rots.slice().sort(), [0, 1, 2, 3]);
  const d = docAvec(cases.map(([c, l]) => tuile('B7', c, l)));
  const g = GR.construire(d, { jetons: [] });
  const portes = [...g.cases.keys()].filter((id) => [...g.voisins.get(id)].some((v) => !g.cases.has(v)));
  assert.equal(portes.length, 4);
  for (const id of portes) {
    const j = [...g.voisins.get(id)].filter((v) => !g.cases.has(v));
    assert.equal(j.length, 1, id);
    const [i, jj] = j[0].match(/\d+/g).map(Number);
    assert.ok(i >= 1 && i <= 4 && jj >= 1 && jj <= 4, `${id} -> jonction ${j[0]}`);
  }
});

test('rendu 5×5 : chaque modèle se dessine à la cote 100 mm + fond perdu 3 mm dans les 4 rotations, sans valeur invalide', () => {
  for (const m of C5) for (let rot = 0; rot < 4; rot++) {
    const s = R.contenuTuile(m, { rot, fondPerdu: 3, contour: false, format: F5 });
    assert.equal(typeof s, 'string');
    assert.ok(s.length > 100 && !s.includes('NaN') && !s.includes('undefined') && !s.includes('Infinity'), `${m.id} rot ${rot}`);
  }
});
