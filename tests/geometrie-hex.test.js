'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
const G = globalThis.PM.geometrie;
const H = G.format('hex19');
const S3 = Math.sqrt(3);
const proche = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ' : ' + a + ' vs ' + b);
const pointProche = (p, q, tol, msg) => { proche(p.x, q.x, tol, msg); proche(p.y, q.y, tol, msg); };
const boite = (pts) => {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return { l: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

test('hex19 : format connu, gelé, même objet, formats carrés inchangés', () => {
  assert.strictEqual(H.id, 'hex19');
  assert.strictEqual(G.format('hex19'), H);
  assert.ok(Object.isFrozen(H));
  assert.deepStrictEqual([...G.FORMATS], ['4x4', '5x5']);
  assert.deepStrictEqual([...G.FORMATS_TOUS], ['4x4', '5x5', 'hex19']);
  assert.throws(() => G.format('hex7'), /Format de grille inconnu/);
  assert.strictEqual(G.format('4x4').COTE, 120);
  assert.strictEqual(G.format('5x5').COTE, 100);
  assert.strictEqual(G.format('4x4').nbCotes, undefined);
});

test('hex19 : constantes', () => {
  assert.strictEqual(H.nbCotes, 6);
  assert.strictEqual(H.COTE, 54);
  assert.strictEqual(H.DIAMETRE_CASE, 20);
  assert.strictEqual(H.LARGEUR_CHEMIN, 8);
  assert.strictEqual(H.AMORCE_RACCORD, 10);
  assert.strictEqual(H.AMORCE_PORT, 28);
  assert.strictEqual(H.RAYON_ZONE_COIN, 20);
  assert.strictEqual(H.DIAMETRE_JETON, 30);
  assert.strictEqual(H.DIAMETRE_CASE_JONCTION, 30);
  assert.deepStrictEqual([...H.POSITIONS_RACCORD], [0]);
  proche(H.APOTHEME, 54 * S3 / 2, 1e-6);
});

test('hex19 : dénombrements de la grille', () => {
  assert.strictEqual(H.cellules.length, 19);
  const parLig = [0, 0, 0, 0, 0];
  H.cellules.forEach((c) => parLig[c.lig]++);
  assert.deepStrictEqual(parLig, [3, 4, 5, 4, 3]);
  assert.deepStrictEqual([...H.GRILLE.rangees], [3, 4, 5, 4, 3]);
  assert.strictEqual(H.sieges.length, 24);
  assert.strictEqual(H.sommetsPourtour.length, 12);
  assert.deepStrictEqual(H.sieges.map((s) => s.id), [...Array(24).keys()]);
  let paires = 0;
  H.cellules.forEach((c) => { for (let k = 0; k < 6; k++) if (H.voisin(c.col, c.lig, k)) paires++; });
  assert.strictEqual(paires / 2, 42);
  const roles = {};
  H.cellules.forEach((c) => { roles[c.role] = (roles[c.role] || 0) + 1; });
  assert.deepStrictEqual(roles, { centre: 1, couronne: 6, bord: 6, coin: 6 });
  assert.ok(H.estCellule(2, 2) && !H.estCellule(0, 0) && !H.estCellule(4, 4) && !H.estCellule(5, 2) && !H.estCellule(1.5, 2));
  assert.strictEqual(H.cellule(0, 0), null);
});

test('hex19 : voisins réciproques et appariement (côté k contre côté (k+3)%6)', () => {
  H.cellules.forEach((c) => {
    for (let k = 0; k < 6; k++) {
      const v = H.voisin(c.col, c.lig, k);
      if (!v) { assert.deepStrictEqual(H.cotesExterieursCellule(c.col, c.lig).includes(k), true); continue; }
      assert.deepStrictEqual(H.voisin(v.col, v.lig, (k + 3) % 6), { col: c.col, lig: c.lig });
      const pc = H.positionCellule(c.col, c.lig), pv = H.positionCellule(v.col, v.lig), pm = H.pointRaccord(k, 0);
      // le centre du voisin est à 2 apothèmes dans la direction du milieu du côté k
      pointProche({ x: pv.x - pc.x, y: pv.y - pc.y }, { x: 2 * pm.x, y: 2 * pm.y }, 1e-6, c.cle + ' côté ' + k);
    }
  });
  assert.strictEqual(H.voisin(2, 2, 6), null);
  assert.strictEqual(H.voisin(2, 2, -1), null);
  assert.strictEqual(H.voisin(0, 0, 1), null);
  // apparier : un seul bit par côté
  for (let a = 0; a < 64; a += 5) for (let b = 0; b < 64; b += 3) for (let k = 0; k < 6; k++) {
    const ab = H.apparier(a, k, b), ba = H.apparier(b, (k + 3) % 6, a);
    assert.strictEqual(ab.connectes, ba.connectes);
    assert.strictEqual(ab.mortsA, ba.mortsB);
    assert.strictEqual(ab.mortsB, ba.mortsA);
    assert.ok(ab.connectes <= 1 && ab.mortsA <= 1 && ab.mortsB <= 1);
  }
  assert.deepStrictEqual(H.apparier(0b000001, 0, 0b001000), { connectes: 1, mortsA: 0, mortsB: 0 });
  assert.deepStrictEqual(H.apparier(0b000001, 0, 0b000001), { connectes: 0, mortsA: 1, mortsB: 0 });
  assert.deepStrictEqual(H.apparier(0b000000, 0, 0b001000), { connectes: 0, mortsA: 0, mortsB: 1 });
  assert.deepStrictEqual(H.raccordEnFace(1, 0), { cote: 4, pos: 0 });
  assert.deepStrictEqual(H.coteVoisin(1), { dc: 1, dl: 0 });
});

test('hex19 : rotations par 60 degrés, six fois = identité', () => {
  for (let m = 0; m < 64; m++) {
    assert.strictEqual(H.tournerRaccords(m, 6), m);
    assert.strictEqual(H.tournerRaccords(H.tournerRaccords(m, 2), 4), m);
    assert.strictEqual(H.tournerPorts(m, 6), m);
  }
  assert.strictEqual(H.tournerRaccords(0b000001, 1), 0b000010);
  assert.strictEqual(H.tournerRaccords(0b100000, 1), 0b000001);
  assert.strictEqual(H.tournerPorts(0b100001, 2), 0b000110);
  assert.strictEqual(H.tournerRaccords(0b000101, 1.5), 0b000101, 'rotation non entière = 0');
  for (let k = 0; k < 6; k++) {
    pointProche(H.tournerPoint(H.pointRaccord(k, 0), 1), H.pointRaccord((k + 1) % 6, 0), 1e-6, 'raccord ' + k);
    pointProche(H.tournerPoint(H.pointCoin(k), 1), H.pointCoin((k + 1) % 6), 1e-6, 'coin ' + k);
    pointProche(H.tournerPoint(H.pointCoin(k), 6), H.pointCoin(k), 1e-6);
    assert.strictEqual(H.tournerCote(k, 2), (k + 2) % 6);
  }
  const p = { x: 13.7, y: -22.1 };
  pointProche(H.tournerPoint(p, 6), p, 1e-6);
  pointProche(H.tournerPoint(H.tournerPoint(p, 2), 4), p, 1e-6);
});

test('hex19 : conventions des côtés et des coins (pointe en haut, sens horaire)', () => {
  pointProche(H.pointCoin(0), { x: 0, y: -54 }, 1e-6);
  pointProche(H.pointCoin(1), { x: 54 * S3 / 2, y: -27 }, 1e-6);
  pointProche(H.pointCoin(3), { x: 0, y: 54 }, 1e-6);
  // le raccord du côté k est au milieu du segment coin k - coin k+1, à 1 apothème du centre
  for (let k = 0; k < 6; k++) {
    const a = H.pointCoin(k), b = H.pointCoin((k + 1) % 6), r = H.pointRaccord(k, 0);
    pointProche(r, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, 1e-6, 'milieu ' + k);
    proche(Math.hypot(r.x, r.y), H.APOTHEME, 1e-6);
    // la normale rentrante pointe vers le centre ; la bissectrice du coin aussi
    const n = H.NORMALE[k], b2 = H.BISSECTRICE[k];
    proche(n.x * r.x + n.y * r.y, -H.APOTHEME, 1e-6);
    proche(b2.x * a.x + b2.y * a.y, -54, 1e-6);
    proche(Math.hypot(n.x, n.y), 1, 1e-9);
  }
  pointProche(H.pointRaccord(1, 0), { x: H.APOTHEME, y: 0 }, 1e-6, 'côté 1 = E');
  pointProche(H.pointRaccord(4, 0), { x: -H.APOTHEME, y: 0 }, 1e-6, 'côté 4 = O');
  pointProche(H.pointRaccord(2, 3), H.pointRaccord(2, 0), 1e-9, 'pos ignorée');
  assert.strictEqual(H.pointRaccord(6, 0), undefined);
  assert.strictEqual(H.bitRaccord(4, 0), 4);
  assert.strictEqual(H.triplet(0b010000, 4), 1);
});

test('hex19 : rôles, rotations imposées, côtés extérieurs', () => {
  const attendu = {
    '2,2': 'centre',
    '2,1': 'couronne', '3,1': 'couronne', '1,2': 'couronne', '3,2': 'couronne', '1,3': 'couronne', '2,3': 'couronne',
    '3,0': 'bord', '1,1': 'bord', '4,1': 'bord', '0,3': 'bord', '3,3': 'bord', '1,4': 'bord',
    '2,0': 'coin', '4,0': 'coin', '0,2': 'coin', '4,2': 'coin', '0,4': 'coin', '2,4': 'coin'
  };
  Object.keys(attendu).forEach((k) => {
    const [c, l] = k.split(',').map(Number);
    assert.strictEqual(H.roleCellule(c, l), attendu[k], k);
  });
  H.cellules.forEach((c) => {
    if (c.role === 'centre' || c.role === 'couronne') {
      assert.strictEqual(c.rotation, null);
      assert.strictEqual(c.cotesExterieurs.length, 0);
      assert.strictEqual(c.gabarit, 'centrale');
    } else {
      assert.ok(Number.isInteger(c.rotation) && c.rotation >= 0 && c.rotation < 6, c.cle);
      const g = H.GABARITS[c.gabarit];
      assert.strictEqual(c.cotesExterieurs.length, g.cotesExterieurs.length);
      // les côtés extérieurs canoniques, tournés, sont exactement les côtés sans voisin
      assert.deepStrictEqual(g.cotesExterieurs.map((k) => (k + c.rotation) % 6).sort(), [...c.cotesExterieurs].sort(), c.cle);
    }
  });
  // exemples : bord nord = rotation 0, bord sud = 3, coin NO = 4, coin NE = 5, coin E = 0, coin O = 3
  assert.strictEqual(H.rotationImposee(3, 0), 0);
  assert.strictEqual(H.rotationImposee(1, 4), 3);
  assert.strictEqual(H.rotationImposee(2, 0), 4);
  assert.strictEqual(H.rotationImposee(4, 0), 5);
  assert.strictEqual(H.rotationImposee(4, 2), 0);
  assert.strictEqual(H.rotationImposee(0, 2), 3);
  assert.strictEqual(H.rotationImposee(2, 2), null);
  assert.strictEqual(H.rotationImposee(0, 0), null);
  // gabarits
  assert.deepStrictEqual([...H.GABARITS.centrale.coinsInterieurs], [0, 1, 2, 3, 4, 5]);
  assert.strictEqual(H.GABARITS.interieure, H.GABARITS.centrale);
  assert.deepStrictEqual([...H.GABARITS.bord.cotesExterieurs], [5, 0]);
  assert.deepStrictEqual([...H.GABARITS.bord.coinsInterieurs], [2, 3, 4]);
  assert.deepStrictEqual([...H.GABARITS.coin.cotesExterieurs], [0, 1, 2]);
  assert.deepStrictEqual([...H.GABARITS.coin.coinsInterieurs], [4, 5]);
});

test('hex19 : camps (rangée du milieu neutre, coins E et O neutres)', () => {
  H.cellules.forEach((c) => {
    assert.strictEqual(H.campCellule(c.col, c.lig), c.lig < 2 ? 'vert' : (c.lig > 2 ? 'rouge' : null), c.cle);
  });
  const compte = { vert: 0, rouge: 0, neutre: 0 };
  H.cellules.forEach((c) => { compte[c.camp || 'neutre']++; });
  assert.deepStrictEqual(compte, { vert: 7, rouge: 7, neutre: 5 });
  assert.strictEqual(H.campCellule(0, 2), null, 'coin O');
  assert.strictEqual(H.campCellule(4, 2), null, 'coin E');
  assert.strictEqual(H.campCellule(0, 0), null);
  assert.strictEqual(H.campCellule(2.5, 2), null);
  assert.strictEqual(H.campCellule('2', 2), null);
  // apparitions : tuiles du pourtour hors rangée neutre, 5 par camp
  const app = (camp) => H.cellules.filter((c) => c.role !== 'centre' && c.role !== 'couronne' && c.camp === camp).length;
  assert.strictEqual(app('vert'), 5);
  assert.strictEqual(app('rouge'), 5);
  const sieges = (camp) => H.sieges.filter((s) => s.camp === camp).map((s) => s.id);
  assert.deepStrictEqual(sieges('vert'), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.deepStrictEqual(sieges('rouge'), [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  H.sieges.forEach((s) => assert.ok(Math.abs(s.y) > 1, 'aucun siège sur la médiane'));
});

test('hex19 : sièges (jonctions à 3 tuiles) numérotés comme camps.png', () => {
  H.sieges.forEach((s) => {
    assert.strictEqual(s.tuiles.length, 3);
    const cles = new Set(s.tuiles.map((t) => t.col + ',' + t.lig));
    assert.strictEqual(cles.size, 3, 'trois tuiles distinctes');
    s.tuiles.forEach((t) => {
      assert.strictEqual(H.siegeDuCoin(t.col, t.lig, t.coin, 0), s.id);
      const pc = H.positionCellule(t.col, t.lig), k = H.pointCoin(t.coin);
      pointProche({ x: pc.x + k.x, y: pc.y + k.y }, s, 1e-6, 'siège ' + s.id);
    });
  });
  // quelques sièges repères (voir camps.png)
  const ids = (n) => H.sieges[n].tuiles.map((t) => t.col + ',' + t.lig).sort().join(' ');
  assert.strictEqual(ids(0), ['2,0', '3,0', '2,1'].sort().join(' '));
  assert.strictEqual(ids(8), ['1,1', '0,2', '1,2'].sort().join(' '));
  assert.strictEqual(ids(15), ['3,2', '4,2', '3,3'].sort().join(' '));
  assert.strictEqual(ids(23), ['2,3', '1,4', '2,4'].sort().join(' '));
  // numérotation : y croissant, puis x croissant
  for (let i = 1; i < 24; i++) {
    const a = H.sieges[i - 1], b = H.sieges[i];
    assert.ok(Math.round(a.y) < Math.round(b.y) || (Math.round(a.y) === Math.round(b.y) && a.x < b.x), 'ordre ' + i);
  }
  // chaque tuile du pourtour : coins-jonctions = coinsInterieurs du gabarit (tournés), les autres coins sont des sommets du pourtour
  H.cellules.forEach((c) => {
    const g = H.GABARITS[c.gabarit], rot = c.rotation || 0;
    const attendus = g.coinsInterieurs.map((k) => (k + rot) % 6).sort();
    const reels = [0, 1, 2, 3, 4, 5].filter((k) => c.coins[k] !== null);
    assert.deepStrictEqual(reels, attendus, c.cle);
    g.coinsInterieurs.forEach((k) => assert.notStrictEqual(H.siegeDuCoin(c.col, c.lig, k, rot), null));
  });
  // sommets du pourtour : 2 tuiles voisines, sur le contour des 12 tuiles du pourtour
  H.sommetsPourtour.forEach((v) => {
    assert.strictEqual(v.tuiles.length, 2);
    v.tuiles.forEach((t) => assert.ok(['bord', 'coin'].includes(H.roleCellule(t.col, t.lig))));
  });
  // sièges par tuile : centre 6, couronne 6, bord 3, coin 2 -> 6 + 36 + 18 + 12 = 72 = 24 x 3
  assert.strictEqual(H.cellules.reduce((t, c) => t + c.coins.filter((x) => x !== null).length, 0), 72);
});

test('hex19 : trèfle (sièges 0, 4, 8 / 15, 19, 23), trois par camp', () => {
  assert.deepStrictEqual([...H.TREFLE], [0, 4, 8, 15, 19, 23]);
  assert.deepStrictEqual(H.TREFLE.filter((i) => H.sieges[i].camp === 'vert'), [0, 4, 8]);
  assert.deepStrictEqual(H.TREFLE.filter((i) => H.sieges[i].camp === 'rouge'), [15, 19, 23]);
  // symétrie par demi-tour du trèfle : le siège i est l'opposé du siège 23 - i
  H.TREFLE.forEach((i) => {
    const o = H.sieges[23 - i];
    assert.ok(H.TREFLE.includes(23 - i));
    pointProche({ x: -H.sieges[i].x, y: -H.sieges[i].y }, o, 1e-6);
  });
});

test('hex19 : dimensions du plateau et des formes (0,1 mm)', () => {
  proche(H.PLATEAU.largeur, 498.8, 0.1, 'largeur');
  proche(H.PLATEAU.hauteur, 432, 0.1, 'hauteur');
  proche(H.PLATEAU.cote, 249.4, 0.1, 'côté du grand hexagone');
  const toutes = [].concat(...H.cellules.map((c) => H.formeCellule(c.col, c.lig)));
  const b = boite(toutes);
  proche(b.l, 498.8, 0.1, 'largeur mesurée');
  proche(b.h, 432, 0.1, 'hauteur mesurée');
  proche(b.x0 + b.x1, 0, 1e-6, 'centré en x');
  proche(b.y0 + b.y1, 0, 1e-6, 'centré en y');
  const contour = H.contourPlateau();
  assert.strictEqual(contour.length, 6);
  const bc = boite(contour);
  proche(bc.l, 498.8, 0.1); proche(bc.h, 432, 0.1);
  for (let k = 0; k < 6; k++) proche(Math.hypot(contour[(k + 1) % 6].x - contour[k].x, contour[(k + 1) % 6].y - contour[k].y), 249.4, 0.1);
  // hexagone de l'intérieur : 54 mm de côté
  const hx = H.forme('centre');
  assert.strictEqual(hx.length, 6);
  for (let k = 0; k < 6; k++) proche(Math.hypot(hx[(k + 1) % 6].x - hx[k].x, hx[(k + 1) % 6].y - hx[k].y), 54, 1e-6);
  assert.strictEqual(H.forme('couronne').length, 6);
  // bord : pentagone 93,5 x 108 ; coin : pentagone 116,9 x 108
  const fb = H.forme('bord'), fc = H.forme('coin');
  assert.strictEqual(fb.length, 5);
  assert.strictEqual(fc.length, 5);
  const bb = boite(fb), bk = boite(H.formeCellule(2, 0)); // coin en position NO (docs/75)
  proche(bb.l, 93.5, 0.1, 'bord largeur'); proche(bb.h, 108, 0.1, 'bord hauteur');
  proche(bk.l, 116.9, 0.1, 'coin largeur'); proche(bk.h, 108, 0.1, 'coin hauteur');
  const lg = (P, i) => Math.hypot(P[(i + 1) % P.length].x - P[i].x, P[(i + 1) % P.length].y - P[i].y);
  proche(lg(fb, 0), 93.5, 0.1, 'bord droit du bord');
  proche(lg(fb, 1), 81, 0.1, 'coupe'); proche(lg(fb, 2), 54, 1e-6); proche(lg(fb, 3), 54, 1e-6); proche(lg(fb, 4), 81, 0.1, 'coupe');
  const cotesCoin = fc.map((_, i) => lg(fc, i)).sort((x, y) => x - y);
  [54, 77.9, 77.9, 81, 81].forEach((v, i) => proche(cotesCoin[i], v, 0.1, 'côté du coin ' + i));
  assert.strictEqual(H.forme('inconnu'), undefined);
  assert.strictEqual(H.formeCellule(0, 0), undefined);
});

test('hex19 : les 19 formes pavent le grand hexagone (aire, sans recouvrement)', () => {
  const aire = (P) => Math.abs(P.reduce((t, p, i) => { const q = P[(i + 1) % P.length]; return t + p.x * q.y - q.x * p.y; }, 0) / 2);
  const total = H.cellules.reduce((t, c) => t + aire(H.formeCellule(c.col, c.lig)), 0);
  const R = H.PLATEAU.cote;
  proche(total, 3 * S3 / 2 * R * R, 1, 'aire totale = aire du grand hexagone');
  // les sommets de chaque pentagone sont dans le grand hexagone (apothème 4 s = 216 sur les côtés plats)
  H.cellules.forEach((c) => H.formeCellule(c.col, c.lig).forEach((p) => {
    for (let k = 0; k < 6; k++) {
      const a = (k * 60 + 30) * Math.PI / 180;
      assert.ok(p.x * Math.cos(a) + p.y * Math.sin(a) <= 216 + 1e-6, c.cle);
    }
  }));
});

test('hex19 : tracesModele (amorces sur la normale du côté et sur la bissectrice du coin)', () => {
  const m = {
    cases: [{ id: 'a', x: 0, y: -20.7 }, { id: 'b', x: 0, y: 20.7 }],
    chemins: [
      { id: 'c1', a: { case: 'a' }, b: { coin: 5 } },
      { id: 'c2', a: { case: 'a' }, b: { raccord: { cote: 0, pos: 0 } } },
      { id: 'c3', a: { case: 'a' }, b: { case: 'b' } },
      { id: 'c4', a: { case: 'b' }, b: { raccord: { cote: 2, pos: 0 } } },
      { id: 'mauvais1', a: { case: 'b' }, b: { raccord: { cote: 6, pos: 0 } } },
      { id: 'mauvais2', a: { case: 'b' }, b: { raccord: { cote: 1, pos: 1 } } },
      { id: 'mauvais3', a: { case: 'b' }, b: { coin: 6 } }
    ]
  };
  const t = G.tracesModele(m, H);
  assert.deepStrictEqual(t.map((x) => x.id), ['c1', 'c2', 'c3', 'c4']);
  const [c1, c2, c3, c4] = t;
  assert.strictEqual(c1.type, 'port');
  pointProche(c1.pts[0], H.pointCoin(5), 1e-9);
  const b5 = H.BISSECTRICE[5];
  pointProche(c1.pts[1], { x: H.pointCoin(5).x + 28 * b5.x, y: H.pointCoin(5).y + 28 * b5.y }, 1e-9);
  pointProche(c1.pts[2], { x: 0, y: -20.7 }, 1e-9);
  assert.strictEqual(c2.type, 'raccord');
  pointProche(c2.pts[0], H.pointRaccord(0, 0), 1e-9);
  const n0 = H.NORMALE[0];
  pointProche(c2.pts[1], { x: H.pointRaccord(0, 0).x + 10 * n0.x, y: H.pointRaccord(0, 0).y + 10 * n0.y }, 1e-9);
  assert.strictEqual(c3.type, 'lien');
  assert.strictEqual(c4.type, 'raccord');
  assert.deepStrictEqual(c4.raccord, { cote: 2, pos: 0 });
  // identifiant en chaîne accepté
  assert.strictEqual(G.tracesModele(m, 'hex19').length, 4);
});

test('hex19 : tracesPassages (passage E-O sans case, droit)', () => {
  const m = { cases: [], passages: [{ id: 'p1', a: { raccord: { cote: 1, pos: 0 } }, b: { raccord: { cote: 4, pos: 0 } } },
    { id: 'p2', a: { raccord: { cote: 7, pos: 0 } }, b: { raccord: { cote: 4, pos: 0 } } }] };
  const t = G.tracesPassages(m, H);
  assert.strictEqual(t.length, 1);
  pointProche(t[0].pts[0], H.pointRaccord(1, 0), 1e-9);
  pointProche(t[0].pts[t[0].pts.length - 1], H.pointRaccord(4, 0), 1e-9);
  assert.strictEqual(t[0].bouts.length, 2);
});

test('non-régression carré : API et valeurs inchangées', () => {
  const F4 = G.format('4x4'), F5 = G.format('5x5');
  assert.deepStrictEqual(F4.pointRaccord(1, 2), { x: 120, y: 90 });
  assert.deepStrictEqual(F5.pointCoin(2), { x: 100, y: 100 });
  assert.strictEqual(F4.tournerRaccords(0x050, 1), 0x280);
  assert.strictEqual(G.campCellule(0, 0), 'vert');
  assert.strictEqual(G.campCellule(0, 3), 'rouge');
  assert.strictEqual(F5.campCellule(2, 2), null);
  assert.deepStrictEqual(G.GABARITS.bord.cotesExterieurs, [0]);
  const m = { cases: [{ id: 'a', x: 60, y: 60 }], chemins: [
    { id: 'r', a: { case: 'a' }, b: { raccord: { cote: 3, pos: 2 } } },
    { id: 'p', a: { case: 'a' }, b: { coin: 2 } },
    { id: 'x', a: { case: 'a' }, b: { raccord: { cote: 4, pos: 0 } } },
    { id: 'y', a: { case: 'a' }, b: { raccord: { cote: 0, pos: 3 } } },
    { id: 'z', a: { case: 'a' }, b: { coin: 4 } }] };
  const t = G.tracesModele(m);
  assert.deepStrictEqual(t.map((x) => x.id), ['r', 'p']);
  assert.deepStrictEqual(t[0].pts[0], { x: 0, y: 30 });
  assert.deepStrictEqual(t[0].pts[1], { x: 10, y: 30 });
  assert.strictEqual(G.tracesModele(m, '4x4').length, 2);
  const m5 = { cases: [{ id: 'a', x: 50, y: 50 }], chemins: [{ id: 'r', a: { case: 'a' }, b: { raccord: { cote: 0, pos: 1 } } }] };
  assert.deepStrictEqual(G.tracesModele(m5, F5)[0].pts[0], { x: 50, y: 0 });
  assert.deepStrictEqual(G.tracesPassages({ cases: [], passages: [{ id: 'p', a: { raccord: { cote: 0, pos: 1 } }, b: { raccord: { cote: 2, pos: 1 } } },
    { id: 'q', a: { raccord: { cote: 4, pos: 1 } }, b: { raccord: { cote: 2, pos: 1 } } }] }, F4).length, 1);
});
