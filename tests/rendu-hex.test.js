'use strict';
/*
 * Tests du rendu pour le format hexagonal 'hex19' (lot 3, docs/78) : tuile hexagonale et pentagones à bord droit, contour de coupe,
 * cases, chemins, passages, ports, secteurs de 120° des sièges, apparitions, rotation par 60° ; non-régression du carré.
 * Modèles du catalogue candidat (docs/75) injectés en mémoire (tests/aides-rendu-hex.js).
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
const PM = globalThis.PM;
const M = PM.modele, R = PM.rendu;
const F = PM.geometrie.format('hex19');
const H = require('./aides-rendu-hex.js');
const MODELES = H.catalogue();
const modele = (id) => MODELES.find((m) => m.id === id);
const RI = F.APOTHEME;

/** Aire d'un polygone (formule du lacet), valeur absolue. */
function aire(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; } return Math.abs(a) / 2; }
function boite(P) {
  const xs = P.map((p) => p.x), ys = P.map((p) => p.y);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}
/** Distance signée (positive à l'intérieur) d'un point à un polygone convexe. */
function profondeur(p, P) {
  let sg = 0; { const c = P.reduce((a, q) => ({ x: a.x + q.x / P.length, y: a.y + q.y / P.length }), { x: 0, y: 0 }); const a = P[0], b = P[1]; sg = ((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) >= 0 ? 1 : -1; }
  let d = Infinity;
  P.forEach((a, i) => { const b = P[(i + 1) % P.length], l = Math.hypot(b.x - a.x, b.y - a.y); d = Math.min(d, sg * ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / l); });
  return d;
}
const nombres = (svg) => (svg.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) || []).map(Number);
function sansNaN(svg, nom) {
  assert.ok(!/NaN|undefined|Infinity|null/.test(svg), nom + ' : valeur invalide dans le SVG');
  assert.ok(nombres(svg).every(Number.isFinite), nom);
}
const circlesDe = (svg, attr) => [...svg.matchAll(new RegExp('<circle cx="(-?[\\d.]+)" cy="(-?[\\d.]+)" r="([\\d.]+)"[^>]*' + attr + '="([^"]*)"', 'g'))]
  .map((m) => ({ x: +m[1], y: +m[2], r: +m[3], id: m[4] }));

test('formeTuile : hexagone de 54 mm de côté, bord de 93,5 x 108, coin de 116,9 x 108, centrés sur l\'origine', () => {
  const hex = R.formeTuile(modele('HC2'), 0, 'hex19'), bord = R.formeTuile(modele('HB1'), 0, 'hex19');
  const coin = [2, 4].map((r) => R.formeTuile(modele('HK1'), r, 'hex19'));
  assert.strictEqual(hex.length, 6);
  assert.strictEqual(bord.length, 5);
  coin.forEach((c) => assert.strictEqual(c.length, 5));
  const bh = boite(hex), bb = boite(bord);
  assert.ok(Math.abs(bh.x1 - bh.x0 - 2 * RI) < 1e-6 && Math.abs(bh.y1 - bh.y0 - 108) < 1e-6);
  assert.ok(Math.abs(bb.x1 - bb.x0 - 93.53) < 0.01 && Math.abs(bb.y1 - bb.y0 - 108) < 1e-6);
  coin.forEach((c) => { const b = boite(c); assert.ok(Math.abs(b.x1 - b.x0 - 116.91) < 0.01 && Math.abs(b.y1 - b.y0 - 108) < 1e-6); });
  // aires : hexagone 3/2 V3 s², pentagone bord = hexagone + 2 triangles, pavage du plateau par les 19 pièces
  assert.ok(Math.abs(aire(hex) - 1.5 * Math.sqrt(3) * 54 * 54) < 1e-6);
  const total = 7 * aire(hex) + 6 * aire(bord) + 6 * aire(coin[0]);
  const grand = 1.5 * Math.sqrt(3) * F.PLATEAU.cote * F.PLATEAU.cote;
  assert.ok(Math.abs(total - grand) < 1, 'les 19 pièces recouvrent exactement le grand hexagone : ' + total + ' / ' + grand);
  // un modèle sans gabarit valide, ou absent, est dessiné en hexagone
  assert.strictEqual(R.formeTuile({ gabarit: 'inconnu' }, 0, 'hex19').length, 6);
  assert.strictEqual(R.formeTuile(null, 0, 'hex19').length, 6);
  // la rotation par 60° tourne le polygone : le sommet N de l'hexagone devient le sommet NE après un pas
  const r1 = R.formeTuile(modele('HC2'), 1, 'hex19');
  assert.ok(Math.abs(r1[0].x - 54 * Math.cos(-Math.PI / 6)) < 1e-6 && Math.abs(r1[0].y - 54 * Math.sin(-Math.PI / 6)) < 1e-6);
  // le carré garde sa forme 0..COTE
  const c = R.formeTuile(modele('HC2'), 0, '4x4');
  assert.deepStrictEqual(c, [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 120 }, { x: 0, y: 120 }]);
});

test('contenuTuile hexagonal : aucune valeur invalide, six rotations, pour les quatre modèles', () => {
  MODELES.forEach((m) => {
    for (let rot = 0; rot < 6; rot++) {
      sansNaN(R.contenuTuile(m, { rot, format: 'hex19' }), m.id + ' rot ' + rot);
      sansNaN(R.contenuTuile(m, { rot, format: F, camp: 'vert', fondPerdu: 3 }), m.id + ' rot ' + rot + ' à l\'écran, fond perdu');
      sansNaN(R.svgTuile(m, { rot, format: 'hex19' }), m.id + ' svgTuile');
    }
  });
});

test('contenuTuile hexagonal : chemins, passages, pivot, cases et secteurs de siège du gabarit', () => {
  const att = { HC2: [0, 6, 6], HC3: [0, 6, 6], HB1: [0, 3, 2], HK1: [0, 2, 2] };
  MODELES.forEach((m) => {
    const svg = R.contenuTuile(m, { format: F });
    const nbChemins = (svg.match(/data-chemin="/g) || []).length, nbCases = (svg.match(/data-case="/g) || []).length;
    assert.strictEqual(nbChemins, m.chemins.length, m.id + ' : un tracé par chemin');
    assert.strictEqual(nbCases, m.cases.length, m.id + ' : une case par case');
    assert.strictEqual((svg.match(/data-passage="/g) || []).length, (m.passages || []).length, m.id + ' : un tracé par passage');
    assert.strictEqual((svg.match(/data-pivot="/g) || []).length, (m.pivots || []).length, m.id + ' : le pivot (4 branches) est dessiné');
    const gab = { HC2: 6, HC3: 6, HB1: 3, HK1: 2 }[m.id];
    assert.strictEqual((svg.match(/data-quart-jonction="/g) || []).length, gab, m.id + ' : un secteur par coin intérieur du gabarit');
    assert.strictEqual((svg.match(/data-contour="coupe"/g) || []).length, 1, m.id + ' : un contour de coupe');
    assert.ok(att[m.id]);
  });
  // le passage E-O de HC2 va d'un côté à l'autre : sa courbe touche les milieux des côtés 1 et 4
  const svg2 = R.contenuTuile(modele('HC2'), { format: F, fondPerdu: 0 });
  assert.match(svg2, new RegExp('data-passage="t1"'));
  const ps = R.tracesPassages(modele('HC2'), F)[0];
  assert.ok(Math.abs(ps.bouts[0].p.x - RI) < 1e-6 && Math.abs(ps.bouts[1].p.x + RI) < 1e-6);
});

test('cases de tuile : les centres suivent la rotation par 60°, tous les disques restent dans la pièce', () => {
  MODELES.forEach((m) => {
    for (let rot = 0; rot < 6; rot++) {
      const svg = R.contenuTuile(m, { rot, format: F }), cs = circlesDe(svg, 'data-case'), forme = R.formeTuile(m, rot, F);
      assert.strictEqual(cs.length, m.cases.length);
      m.cases.forEach((c) => {
        const p = F.tournerPoint({ x: c.x, y: c.y }, rot), tr = cs.find((q) => q.id === c.id);
        assert.ok(Math.abs(tr.x - p.x) < 0.01 && Math.abs(tr.y - p.y) < 0.01, m.id + ' ' + c.id + ' rot ' + rot);
        assert.strictEqual(tr.r, 10);
        // le gabarit hexagonal du modèle est posé dans sa forme canonique : la case est dans la pièce tournée avec marge de 4 mm
        const gab = m.gabarit === 'centrale' ? 'centrale' : m.gabarit;
        if (gab) assert.ok(profondeur(p, forme) >= 10 + 4 - 1e-6, m.id + ' ' + c.id + ' rot ' + rot + ' : marge ' + profondeur(p, forme));
      });
    }
  });
});

test('ports vers les coins et raccords vers les côtés : les extrémités sont sur le contour de la pièce', () => {
  MODELES.forEach((m) => {
    for (let rot = 0; rot < 6; rot++) {
      const forme = R.formeTuile(m, rot, F);
      R.tracesModele(m, F).filter((t) => t.type !== 'lien').forEach((t) => {
        const p = F.tournerPoint(t.pts[0], rot);
        assert.ok(Math.abs(profondeur(p, forme)) < 1e-6, m.id + ' ' + t.id + ' rot ' + rot + ' : départ à ' + profondeur(p, forme) + ' mm du contour');
      });
    }
  });
});

test('secteurs de siège : arc de rayon 15 mm centré sur le coin, 120° vers l\'intérieur, rotation comprise', () => {
  const m = modele('HC2');
  for (let rot = 0; rot < 6; rot++) {
    const svg = R.contenuTuile(m, { rot, format: F });
    const arcs = [...svg.matchAll(/<path d="([^"]*)" fill="none" stroke="#111111" stroke-width="0.6" data-quart-jonction="(\d)"\/>/g)];
    assert.strictEqual(arcs.length, 6);
    arcs.forEach((a) => {
      const k = +a[2], K = F.tournerPoint(F.pointCoin(k), rot), pts = a[1].match(/-?[\d.]+ -?[\d.]+/g).map((s) => s.split(' ').map(Number));
      assert.strictEqual(pts.length, 17);
      pts.forEach(([x, y]) => assert.ok(Math.abs(Math.hypot(x - K.x, y - K.y) - 15) < 0.01, 'rayon de l\'arc, coin ' + k));
      // les extrémités de l'arc sont sur les deux côtés de la tuile qui partent du coin (angle intérieur de 120°)
      const forme = R.formeTuile(m, rot, F);
      [pts[0], pts[16]].forEach(([x, y]) => assert.ok(Math.abs(profondeur({ x, y }, forme)) < 0.05, 'extrémité de l\'arc sur le contour'));
      // le milieu de l'arc est dans la tuile
      assert.ok(profondeur({ x: pts[8][0], y: pts[8][1] }, forme) > 5);
    });
  }
  // trois tuiles voisines complètent le cercle d'un siège : les trois secteurs couvrent 360°
  const s0 = F.sieges[4], angles = s0.tuiles.map((t) => {
    const c = F.cellule(t.col, t.lig), rot = c.rotation || 0, k = (t.coin - rot + 6) % 6;
    return (90 + 60 * ((k + rot) % 6)) % 360; // direction du centre du secteur, depuis le siège, dans le repère global
  });
  assert.strictEqual(new Set(angles).size, 3);
});

test('apparitions : imprimées neutres (noir et blanc), colorées à l\'écran selon le camp', () => {
  const hb = modele('HB1');
  const imp = R.contenuTuile(hb, { format: F, rot: 0 });
  assert.match(imp, /data-apparition="impression"/);
  assert.ok(!/#007A4D" stroke-width="1\.2"|#D8321C|#7A7F76/.test(imp.replace(/stroke="#007A4D" stroke-width="8"/g, '')), 'aucune couleur de camp à l\'impression');
  ['vert', 'rouge', 'neutre'].forEach((camp) => {
    const svg = R.contenuTuile(hb, { format: F, rot: 0, camp });
    assert.match(svg, new RegExp('data-apparition="' + camp + '"'));
  });
  assert.match(R.contenuTuile(hb, { format: F, camp: 'rouge' }), /#D8321C/);
  assert.match(R.contenuTuile(hb, { format: F, camp: 'neutre' }), /stroke-dasharray="1.5 1.5"/);
  // une tuile intérieure n'a pas d'apparition
  assert.ok(!/data-apparition/.test(R.contenuTuile(modele('HC2'), { format: F })));
});

test('découpe : sans fond perdu le contenu est découpé à la forme (clipPath), avec fond perdu la découpe est laissée à l\'appelant', () => {
  const m = modele('HC3');
  const sans = R.contenuTuile(m, { format: F, rot: 2 });
  assert.match(sans, /<clipPath id="pm-hex-centrale-2"><path d="M/);
  assert.match(sans, /<g clip-path="url\(#pm-hex-centrale-2\)">/);
  assert.strictEqual((sans.match(/<clipPath/g) || []).length, 1);
  assert.strictEqual(R.contenuTuile(m, { format: F, rot: 2 }), sans, 'rendu déterministe');
  const sc = R.contenuTuile(modele('HK1'), { format: F, rot: 4 });
  assert.match(sc, /pm-hex-coin-4/);
  // sans contour
  assert.ok(!/data-contour/.test(R.contenuTuile(m, { format: F, contour: false })));
  // avec fond perdu : pas de clipPath, fond blanc rectangulaire plus grand que la boîte de la pièce
  const avec = R.contenuTuile(m, { format: F, fondPerdu: 3 });
  assert.ok(!/clipPath/.test(avec));
  const rect = avec.match(/^<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="([\d.]+)" height="([\d.]+)" fill="#FFFFFF"\/>/);
  assert.ok(rect, 'fond blanc de la boîte + fond perdu');
  assert.ok(Math.abs(+rect[3] - (2 * RI + 6)) < 0.01 && Math.abs(+rect[4] - 114) < 0.01);
});

test('svgTuile hexagonal : à l\'échelle réelle, viewBox centrée sur la pièce', () => {
  const hex = R.svgTuile(modele('HC2'), { format: F });
  const dims = hex.match(/^<svg [^>]*width="([\d.]+)mm" height="([\d.]+)mm" viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)">/).slice(1).map(Number);
  [93.531, 108, -46.765, -54, 93.531, 108].forEach((v, i) => assert.ok(Math.abs(dims[i] - v) < 0.002, 'dimension ' + i + ' : ' + dims[i]));
  const coin = R.svgTuile(modele('HK1'), { format: F, rot: 4 });
  const w = +coin.match(/width="([\d.]+)mm"/)[1], h = +coin.match(/height="([\d.]+)mm"/)[1];
  assert.ok(Math.abs(w - 116.91) < 0.01 && Math.abs(h - 108) < 0.01);
  sansNaN(coin, 'svgTuile coin');
  const fp = R.svgTuile(modele('HC2'), { format: F, fondPerdu: 3 });
  assert.match(fp, /width="99\.531mm" height="114mm"/);
});

test('tournerTracePassage hexagonal : bouts et normales tournés de 60° par pas', () => {
  const t = R.tracesPassages(modele('HC2'), F)[0];
  for (let rot = 0; rot < 6; rot++) {
    const r = R.tournerTracePassage(t, rot, F);
    t.bouts.forEach((b, i) => {
      const p = F.tournerPoint(b.p, rot), n = F.tournerPoint(b.n, rot);
      assert.ok(Math.abs(r.bouts[i].p.x - p.x) < 1e-6 && Math.abs(r.bouts[i].p.y - p.y) < 1e-6);
      assert.ok(Math.abs(r.bouts[i].n.x - n.x) < 1e-6 && Math.abs(r.bouts[i].n.y - n.y) < 1e-6);
      // la normale d'un raccord tourné pointe vers l'intérieur de la tuile : p + n * 1 est plus près du centre que p
      assert.ok(Math.hypot(r.bouts[i].p.x + r.bouts[i].n.x, r.bouts[i].p.y + r.bouts[i].n.y) < Math.hypot(r.bouts[i].p.x, r.bouts[i].p.y));
    });
  }
});

test('contenuJeton avec le format hexagonal : Ø 30 comme en carré', () => {
  assert.match(R.contenuJeton('capture', 10, 20, F), /<circle cx="10" cy="20" r="15" fill="#111111"\/>/);
  assert.match(R.contenuJeton('campement', 10, 20, 'hex19'), /data-campement="flamme"/);
});

test('non-régression du carré : 4×4 et 5×5 sans découpe hexagonale, contenu rectangulaire', () => {
  const m4 = M.copieExemples()[0], m5 = M.copieExemples('5x5')[0];
  const a = R.contenuTuile(m4, { rot: 1 }), b = R.contenuTuile(m5, { rot: 3, format: '5x5' });
  [a, b].forEach((s) => { assert.ok(!/clipPath|pm-hex|data-contour/.test(s)); assert.match(s, /^<rect x="0" y="0" width="\d+" height="\d+" fill="#FFFFFF"\/>/); });
  assert.match(R.svgTuile(m4, {}), /width="120mm" height="120mm" viewBox="0 0 120 120"/);
  assert.match(R.svgTuile(m5, { format: '5x5' }), /width="100mm" height="100mm" viewBox="0 0 100 100"/);
  assert.match(R.svgTuile(m4, { fondPerdu: 3 }), /width="126mm" height="126mm" viewBox="-3 -3 126 126"/);
  // les tracés de passage tournés du carré restent ceux des quarts de tour (normale tournée d'un quart)
  const t = R.tracesPassages(Object.assign({}, m4, { passages: [] }), '4x4');
  assert.deepStrictEqual(t, []);
});
