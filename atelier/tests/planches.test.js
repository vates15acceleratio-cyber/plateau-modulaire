'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const PL = require('../src/planches.js');
const C = require('../src/catalogue.js');
const H = require('../src/hex.js');

const RACINE3 = Math.sqrt(3);
const TOLERANCE = 1e-6;
const DEFAUT = PL.lireReglages('');

/** Côtés communs à deux cases, comptés sans passer par planches.js. */
function cotesCommuns(cases) {
  let n = 0;
  for (let i = 0; i < cases.length; i++) {
    for (let j = i + 1; j < cases.length; j++) if (H.distance(cases[i], cases[j]) === 1) n += 1;
  }
  return n;
}

/** Sommets de l'hexagone pointe en haut de demi-largeur `a` centré en (x, y). */
function hexagone(x, y, a) { return H.sommets(x, y, 2 * a); }

function distancePointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Distance réelle entre les bords de deux hexagones qui ne se recouvrent pas (calcul indépendant du rangement). */
function distanceHexagones(s1, s2) {
  let mini = Infinity;
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      mini = Math.min(mini, distancePointSegment(s1[i], s2[j], s2[(j + 1) % 6]), distancePointSegment(s2[j], s1[i], s1[(i + 1) % 6]));
    }
  }
  return mini;
}

/** Contrôles communs d'un rangement : tout placé une fois, tout dans la zone, écart tenu entre les fonds perdus. */
function controlerRangement(fragment) {
  const reglages = PL.lireReglages(fragment), pieces = PL.listePieces(reglages), res = PL.ranger(pieces, reglages);
  const z = PL.zoneUtile(reglages), f = PL.feuille(reglages), fond = reglages.fond ? PL.FOND_PERDU : 0;
  assert.deepStrictEqual(res.horsFormat, [], fragment + ' : aucune pièce hors format');
  const vues = [];
  res.planches.forEach((poses, n) => {
    assert.ok(poses.length > 0, 'pas de planche vide');
    poses.forEach((p) => {
      vues.push(p.piece.ref);
      assert.ok(Number.isInteger(p.rotation) && p.rotation >= 0 && p.rotation <= 5);
      assert.strictEqual(p.cases.length, p.piece.cases.length);
      // La pose est bien la pièce tournée (jamais retournée) : mêmes cases, mêmes terrains.
      p.piece.cases.forEach((c, i) => {
        const t = H.tourner(c.q, c.r, p.rotation), centre = H.centre(t.q, t.r, p.piece.plat);
        assert.strictEqual(p.cases[i].terrain, c.terrain);
        assert.ok(Math.abs(p.cases[i].x - p.x - centre.x) < TOLERANCE && Math.abs(p.cases[i].y - p.y - centre.y) < TOLERANCE);
      });
      // Tout le fond perdu dans la zone imprimable : 8 mm au moins du bord, cartouche dégagé.
      assert.strictEqual(p.a, p.piece.plat / 2 + fond);
      p.cases.forEach((c) => {
        hexagone(c.x, c.y, p.a).forEach((s) => {
          assert.ok(s.x >= PL.MARGE - TOLERANCE && s.x <= f.l - PL.MARGE + TOLERANCE, p.piece.ref + ' déborde en largeur (planche ' + (n + 1) + ')');
          assert.ok(s.y >= PL.MARGE - TOLERANCE && s.y <= z.y1 + TOLERANCE, p.piece.ref + ' déborde en hauteur (planche ' + (n + 1) + ')');
        });
      });
      assert.ok(p.boite.x1 >= z.x0 - TOLERANCE && p.boite.x2 <= z.x1 + TOLERANCE && p.boite.y1 >= z.y0 - TOLERANCE && p.boite.y2 <= z.y1 + TOLERANCE);
    });
    // Aucune superposition, et au moins 4 mm entre les fonds perdus de deux pièces (distance réelle).
    for (let i = 0; i < poses.length; i++) {
      for (let j = i + 1; j < poses.length; j++) {
        assert.ok(PL.ecartPoses(poses[i], poses[j]) >= PL.ECART - TOLERANCE);
        poses[i].cases.forEach((c1) => {
          poses[j].cases.forEach((c2) => {
            const centres = Math.hypot(c1.x - c2.x, c1.y - c2.y), somme = poses[i].a + poses[j].a;
            assert.ok(centres >= somme + PL.ECART - TOLERANCE, poses[i].piece.ref + ' et ' + poses[j].piece.ref + ' se recouvrent');
            if (centres > 2 * somme + PL.ECART) return;
            const d = distanceHexagones(hexagone(c1.x, c1.y, poses[i].a), hexagone(c2.x, c2.y, poses[j].a));
            assert.ok(d >= PL.ECART - TOLERANCE, poses[i].piece.ref + ' et ' + poses[j].piece.ref + ' à ' + d.toFixed(3) + ' mm');
          });
        });
      }
    }
  });
  assert.deepStrictEqual(vues.slice().sort(), pieces.map((p) => p.ref).sort(), fragment + ' : chaque exemplaire placé une fois');
  assert.ok(res.planches.length >= res.borne, 'jamais moins de planches que la borne');
  return res;
}

test('réglages : valeurs par défaut, adresse lue avec une liste de valeurs admises, aller-retour', () => {
  assert.deepStrictEqual(DEFAUT, { format: 'A3', orientation: 'paysage', fond: true, etiquettes: true, ville: 45, terrain: true, villes: true, evenements: true, miroir: false, captures: 5 });
  const r = PL.lireReglages('#format=A4&orientation=portrait&fond=non&etiquettes=non&ville=40&terrain=non&villes=oui&evenements=non&miroir=oui');
  assert.deepStrictEqual(r, { format: 'A4', orientation: 'portrait', fond: false, etiquettes: false, ville: 40, terrain: false, villes: true, evenements: false, miroir: true, captures: 5 });
  assert.deepStrictEqual(PL.lireReglages('#' + PL.ecrireReglages(r)), r);
  assert.deepStrictEqual(PL.lireReglages('format=A5&orientation=<svg>&ville=41&__proto__=oui&constructor=A3&fond=peut-etre&=&x'), DEFAUT);
  assert.deepStrictEqual(PL.feuille(DEFAUT), { l: 420, h: 297 });
  assert.deepStrictEqual(PL.feuille(r), { l: 210, h: 297 });
  assert.deepStrictEqual(PL.feuille(PL.lireReglages('orientation=portrait')), { l: 297, h: 420 });
});

test('pièces à imprimer : tout le catalogue, une entrée par exemplaire, rien de recopié', () => {
  const pieces = PL.listePieces(DEFAUT), parId = {};
  pieces.forEach((p) => { parId[p.id] = (parId[p.id] || 0) + 1; });
  const attendu = C.totaux().pieces + C.VILLE_NEUTRE.nombre + C.VILLE_DEPLOIEMENT.nombre + C.ORDRE_EVENEMENTS.length + 2 * DEFAUT.captures;
  assert.strictEqual(pieces.length, attendu);
  assert.strictEqual(pieces.length, 50, '26 pièces, 6 tuiles de ville, 10 tuiles de ville capturée, 8 tuiles d’événement');
  C.ORDRE_MODELES.forEach((id) => assert.strictEqual(parId[id], C.MODELES[id].nombre, id));
  C.ORDRE_EVENEMENTS.forEach((id) => assert.strictEqual(parId[id], 1, id));
  assert.strictEqual(parId.VD, 4);
  assert.strictEqual(parId.VNP, 2);
  assert.strictEqual(new Set(pieces.map((p) => p.ref)).size, pieces.length, 'références uniques');
  const camps = pieces.filter((p) => p.genre === 'ville' && p.id !== 'VC').map((p) => p.camp).sort();
  assert.deepStrictEqual(camps, ['neutre', 'neutre', 'rouge', 'rouge', 'vert', 'vert']);
  assert.strictEqual(pieces.filter((p) => p.role === 'terrain').length, 21);
  pieces.filter((p) => p.genre === 'modele').forEach((p) => {
    assert.strictEqual(p.nom, C.MODELES[p.id].nom);
    assert.deepStrictEqual(p.cases, C.MODELES[p.id].cases.map((c) => ({ q: c.q, r: c.r, terrain: c.terrain })));
  });
  pieces.filter((p) => p.genre === 'evenement').forEach((p) => {
    assert.strictEqual(p.nom, C.EVENEMENTS[p.id].nom);
    assert.strictEqual(p.cases[0].terrain, C.EVENEMENTS[p.id].terrain);
  });
  assert.ok(pieces.every((p) => p.plat === 45), '45 mm par défaut, villes comprises');
  // Familles et taille des villes.
  assert.strictEqual(PL.listePieces(PL.lireReglages('villes=non&evenements=non')).length, C.totaux().pieces);
  assert.deepStrictEqual(PL.listePieces(PL.lireReglages('terrain=non&evenements=non&captures=0')).map((p) => p.id), ['VNP', 'VNP', 'VD', 'VD', 'VD', 'VD']);
  assert.strictEqual(PL.listePieces(PL.lireReglages('terrain=non&villes=non')).length, 8);
  assert.strictEqual(PL.listePieces(PL.lireReglages('terrain=non&villes=non&evenements=non')).length, 0);
  const petites = PL.listePieces(PL.lireReglages('ville=40'));
  assert.ok(petites.every((p) => p.plat === (p.genre === 'ville' ? 40 : 45)));
  assert.strictEqual(PL.etiquette(pieces.find((p) => p.id === 'F31')), 'F31 Lisière');
  assert.strictEqual(PL.etiquette(pieces.find((p) => p.camp === 'rouge')), 'VD · Rouge');
  assert.strictEqual(PL.etiquette(pieces.find((p) => p.camp === 'neutre')), 'VNP · Neutre');
});

test('contour extérieur : un polygone fermé par pièce, 6 × cases − 2 × côtés communs sommets', () => {
  const cote = 45 / RACINE3;
  PL.listePieces(DEFAUT).forEach((p) => {
    const boucles = PL.contour(p.cases, p.plat);
    assert.strictEqual(boucles.length, 1, p.id + ' : un seul polygone');
    const b = boucles[0], attendus = 6 * p.cases.length - 2 * cotesCommuns(p.cases);
    assert.strictEqual(b.length, attendus, p.id + ' : nombre de sommets');
    assert.strictEqual(PL.adjacences(p.cases), cotesCommuns(p.cases));
    // Fermé : chaque sommet est à un côté de case du suivant, le dernier du premier ; aucun sommet en double.
    b.forEach((s, i) => {
      const t = b[(i + 1) % b.length];
      assert.ok(Math.abs(Math.hypot(t.x - s.x, t.y - s.y) - cote) < TOLERANCE, p.id + ' : côté ' + i);
    });
    assert.strictEqual(new Set(b.map((s) => Math.round(s.x * 1000) + ':' + Math.round(s.y * 1000))).size, b.length);
    // Aire du polygone (formule du lacet) = aire des cases : c'est bien le contour extérieur, sans trou.
    let aire = 0;
    b.forEach((s, i) => { const t = b[(i + 1) % b.length]; aire += s.x * t.y - t.x * s.y; });
    assert.ok(Math.abs(Math.abs(aire) / 2 - p.cases.length * 45 * 45 * RACINE3 / 2) < 1e-3, p.id + ' : aire');
  });
  const nombre = (id) => PL.contour(C.MODELES[id].cases, 45)[0].length;
  assert.strictEqual(nombre('F3'), 12, 'triangle');
  assert.strictEqual(nombre('F12B'), 14, 'ligne de 3 cases');
  assert.strictEqual(nombre('N1'), 18, 'noyau');
  assert.strictEqual(nombre('R'), 6, 'une case');
  // Un anneau a un trou : deux polygones.
  const anneau = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]].map((c) => ({ q: c[0], r: c[1] }));
  assert.deepStrictEqual(PL.contour(anneau, 45).map((b) => b.length).sort((a, b) => a - b), [6, 18]);
});

test('échelle : une case fait 45 mm plat à plat, pointe en haut ; ville de 40 mm sur demande', () => {
  const largeur = (b) => Math.max(...b.map((s) => s.x)) - Math.min(...b.map((s) => s.x));
  const hauteur = (b) => Math.max(...b.map((s) => s.y)) - Math.min(...b.map((s) => s.y));
  const r = PL.contour(C.MODELES.R.cases, 45)[0];
  assert.ok(Math.abs(largeur(r) - 45) < TOLERANCE);
  assert.ok(Math.abs(hauteur(r) - 90 / RACINE3) < TOLERANCE, '51,96 mm de pointe à pointe');
  assert.ok(Math.abs(largeur(PL.contour(C.MODELES.F12B.cases, 45)[0]) - 135) < TOLERANCE, 'ligne de 3 cases : 135 mm');
  const ville = PL.listePieces(PL.lireReglages('ville=40')).find((p) => p.genre === 'ville');
  assert.ok(Math.abs(largeur(PL.contour(ville.cases, ville.plat)[0]) - 40) < TOLERANCE);
  assert.strictEqual(PL.PLAT_TUILE, 45);
  assert.strictEqual(PL.FOND_PERDU, 3);
  assert.strictEqual(PL.BARRE, 100);
  assert.ok(PL.CORPS >= 6 * 25.4 / 72, 'étiquettes de 6 pt au moins');
});

test('orientations : sixièmes de tour distincts seulement ; écart entre hexagones', () => {
  const nombre = (id) => PL.orientations({ plat: 45, cases: C.MODELES[id].cases }, DEFAUT).length;
  assert.strictEqual(nombre('R'), 1);
  assert.strictEqual(nombre('N1'), 1);
  assert.strictEqual(nombre('F3'), 2, 'triangle');
  assert.strictEqual(nombre('F12B'), 3, 'ligne');
  assert.strictEqual(nombre('F31E'), 6, 'crosse');
  const o = PL.orientations({ plat: 45, cases: C.MODELES.R.cases }, DEFAUT)[0];
  assert.ok(Math.abs(o.maxX - o.minX - 51) < TOLERANCE, 'fond perdu : 45 + 2 × 3 mm de large');
  assert.ok(Math.abs(o.maxY - o.minY - 102 / RACINE3) < TOLERANCE);
  assert.ok(Math.abs(PL.ecartHexagones(0, 0, 22.5, 55, 0, 22.5) - 10) < TOLERANCE, 'côte à côte');
  assert.ok(Math.abs(PL.ecartHexagones(0, 0, 22.5, 27.5, 55 * RACINE3 / 2, 22.5) - 10) < TOLERANCE, 'en quinconce');
  assert.ok(PL.ecartHexagones(0, 0, 22.5, 30, 0, 22.5) < 0, 'recouvrement');
  assert.ok(Math.abs(PL.aireAgrandie({ plat: 45, cases: C.MODELES.R.cases }, 3) - 51 * 51 * RACINE3 / 2) < TOLERANCE);
});

test('rangement A3 paysage par défaut : tout placé une fois, dans la zone, sans superposition', () => {
  const res = controlerRangement('');
  assert.strictEqual(res.borne, 3);
  assert.ok(res.planches.length <= 4, 'pas plus de 4 planches A3 (' + res.planches.length + ')');
  assert.deepStrictEqual(res.feuille, { l: 420, h: 297 });
  // Déterministe : deux rangements identiques.
  const bis = PL.ranger(PL.listePieces(DEFAUT), DEFAUT);
  assert.deepStrictEqual(bis.planches.map((poses) => poses.map((p) => [p.piece.ref, p.rotation, p.x, p.y])),
    res.planches.map((poses) => poses.map((p) => [p.piece.ref, p.rotation, p.x, p.y])));
});

test('rangement : A3 portrait, A4, sans fond perdu, villes de 40 mm, une seule famille', () => {
  controlerRangement('orientation=portrait');
  controlerRangement('format=A4&orientation=portrait&ville=40');
  controlerRangement('format=A4');
  const sansFond = controlerRangement('fond=non');
  assert.ok(sansFond.planches.length <= 3, 'sans fond perdu : 3 planches A3 au plus');
  assert.strictEqual(controlerRangement('terrain=non&ville=40').planches.length, 1, 'villes et événements : une planche');
  const vide = PL.ranger([], DEFAUT);
  assert.deepStrictEqual([vide.planches.length, vide.borne, vide.horsFormat.length], [0, 0, 0]);
});

test('miroir : chaque pièce est l’image miroir gauche-droite de la pièce d’origine, sur des planches autonomes', () => {
  const miroir = PL.lireReglages('miroir=oui'), pieces = PL.listePieces(DEFAUT);
  const droit = PL.ranger(pieces, DEFAUT), retourne = controlerRangement('miroir=oui');
  const L = PL.feuille(miroir).l, nom = (s) => Math.round(s.x * 1000) + ':' + Math.round(s.y * 1000);
  assert.strictEqual(retourne.planches.length, droit.planches.length, 'même nombre de planches');
  let vues = 0;
  retourne.planches.forEach((poses, n) => {
    assert.strictEqual(poses.length, droit.planches[n].length);
    poses.forEach((m, i) => {
      const o = droit.planches[n][i];
      vues += 1;
      assert.strictEqual(m.piece.ref, o.piece.ref);
      assert.strictEqual(m.piece.miroir, true);
      assert.ok(!o.piece.miroir, 'la pièce d’origine n’est pas modifiée');
      // La pièce : mêmes terrains, cases retournées (q, r) → (−q − r, r), soit x → −x et y inchangé.
      o.piece.cases.forEach((c, k) => {
        const a = H.centre(c.q, c.r, 45), b = H.centre(m.piece.cases[k].q, m.piece.cases[k].r, 45);
        assert.ok(Math.abs(a.x + b.x) < TOLERANCE && Math.abs(a.y - b.y) < TOLERANCE);
        assert.strictEqual(m.piece.cases[k].terrain, c.terrain);
      });
      // Sur la planche : chaque case et chaque terrain à la place symétrique par rapport à l'axe vertical médian.
      o.cases.forEach((c, k) => {
        assert.ok(Math.abs(m.cases[k].x - (L - c.x)) < TOLERANCE && Math.abs(m.cases[k].y - c.y) < TOLERANCE);
        assert.strictEqual(m.cases[k].terrain, c.terrain);
      });
      // Le contour (trait de coupe) du miroir est le miroir exact du contour d'origine.
      const d = PL.contour(o.cases, o.piece.plat)[0].map((s) => nom({ x: L - (o.x + s.x), y: o.y + s.y })).sort();
      const g = PL.contour(m.cases, m.piece.plat)[0].map((s) => nom({ x: m.x + s.x, y: m.y + s.y })).sort();
      assert.deepStrictEqual(g, d, o.piece.ref + ' : contour en miroir');
    });
  });
  assert.strictEqual(vues, pieces.length);
  // Une forme sans symétrie change vraiment : le miroir du coude F12C n'est aucune rotation de F12C, mais c'est F12D.
  const forme = (cases) => { const pts = cases.map((c) => H.centre(c.q, c.r, 45)), x0 = Math.min(...pts.map((p) => p.x)), y0 = Math.min(...pts.map((p) => p.y)); return pts.map((p, i) => Math.round((p.x - x0) * 100) + ':' + Math.round((p.y - y0) * 100) + ':' + cases[i].terrain).sort().join(' '); };
  const rotations = (cases) => [0, 1, 2, 3, 4, 5].map((k) => forme(cases.map((c) => Object.assign(H.tourner(c.q, c.r, k), { terrain: c.terrain }))));
  const f12c = pieces.find((p) => p.id === 'F12C'), f12d = pieces.find((p) => p.id === 'F12D');
  assert.ok(!rotations(f12c.cases).includes(forme(PL.pieceMiroir(f12c).cases)));
  assert.ok(rotations(f12d.cases).includes(forme(PL.pieceMiroir(f12c).cases)));
  // Deux miroirs redonnent la pièce.
  assert.deepStrictEqual(PL.pieceMiroir(PL.pieceMiroir(f12c)).cases, f12c.cases);
  // Étiquettes et cartouche.
  assert.strictEqual(PL.etiquette(PL.pieceMiroir(f12c)), 'F12C Bosquet (miroir)');
  assert.strictEqual(PL.etiquette(f12c), 'F12C Bosquet');
  assert.strictEqual(PL.etiquette(PL.pieceMiroir(pieces.find((p) => p.camp === 'vert'))), 'VD · Vert');
  assert.strictEqual(PL.cartouche(2, 4, miroir, '2026-11-20').titre, 'Planche 2 / 4 — miroir');
});

test('rangement : une pièce trop grande pour la feuille est signalée, pas imprimée de travers', () => {
  const geante = { ref: 'G#1', id: 'G', nom: 'Géante', genre: 'modele', famille: 'terrain', plat: 45, cases: H.disque(3).map((k) => Object.assign(H.decle(k), { terrain: 'plaine' })) };
  const res = PL.ranger([geante].concat(PL.listePieces(PL.lireReglages('terrain=non&villes=non'))), PL.lireReglages('format=A4'));
  assert.deepStrictEqual(res.horsFormat.map((p) => p.id), ['G']);
  assert.strictEqual(res.planches.reduce((n, poses) => n + poses.length, 0), 8);
});

test('cartouche : « Planche n / N », format, date et rappel d’impression', () => {
  const c = PL.cartouche(2, 4, DEFAUT, '2026-11-20');
  assert.strictEqual(c.titre, 'Planche 2 / 4');
  assert.strictEqual(c.detail, 'A3 paysage · 2026-11-20');
  assert.strictEqual(c.rappel, 'Imprimer à 100 %, sans ajustement à la page');
  assert.strictEqual(PL.dateDuJour(new Date(2026, 0, 5)), '2026-01-05');
  const z = PL.zoneUtile(DEFAUT);
  assert.ok(z.x0 === 8 && z.y0 === 8 && z.x1 === 412 && z.y1 < 297 - 8, 'le cartouche a sa bande au-dessus de la marge du bas');
});

test('dessin d’une planche (faux DOM) : feuille en millimètres, un trait de coupe par pièce, barre de 100 mm', () => {
  function Element(nom) { this.nom = nom; this.attributs = {}; this.enfants = []; }
  Element.prototype.setAttribute = function (k, v) { this.attributs[k] = String(v); };
  Element.prototype.getAttribute = function (k) { return this.attributs[k]; };
  Element.prototype.appendChild = function (e) { this.enfants.push(e); return e; };
  const tous = (e, filtre) => e.enfants.reduce((l, x) => l.concat(tous(x, filtre)), filtre(e) ? [e] : []);
  const avant = globalThis.document;
  globalThis.document = { createElementNS: (ns, nom) => new Element(nom), createElement: (nom) => new Element(nom), createTextNode: (t) => ({ nom: '#texte', textContent: t, enfants: [] }) };
  try {
    const res = PL.ranger(PL.listePieces(DEFAUT), DEFAUT), total = res.planches.length;
    let coupes = 0;
    const textes = [];
    res.planches.forEach((poses, i) => {
      const svg = PL.dessinerPlanche(poses, i + 1, total, DEFAUT, '2026-11-20');
      assert.strictEqual(svg.attributs.width, '420mm');
      assert.strictEqual(svg.attributs.height, '297mm');
      assert.strictEqual(svg.attributs.viewBox, '0 0 420 297');
      const traits = tous(svg, (e) => e.attributs.class === 'pl-coupe');
      assert.strictEqual(traits.length, poses.length, 'un trait de coupe par pièce');
      traits.forEach((t) => {
        assert.match(t.attributs.d, /^M[^M]+Z$/, 'un seul contour fermé');
        assert.ok(Number(t.attributs['stroke-width']) >= 0.25);
        // Le trait de coupe est sur la feuille, à 8 mm + fond perdu du bord au moins.
        const xy = t.attributs.d.match(/-?\d+(\.\d+)?/g).map(Number);
        for (let k = 0; k < xy.length; k += 2) {
          assert.ok(xy[k] >= 11 - 1e-3 && xy[k] <= 409 + 1e-3 && xy[k + 1] >= 11 - 1e-3 && xy[k + 1] <= 286 + 1e-3);
        }
      });
      coupes += traits.length;
      const barre = tous(svg, (e) => e.attributs.class === 'pl-barre');
      assert.strictEqual(barre.length, 1);
      assert.strictEqual(Number(barre[0].attributs.x2) - Number(barre[0].attributs.x1), 100);
      assert.strictEqual(barre[0].attributs.y1, barre[0].attributs.y2);
      assert.ok(Number(barre[0].attributs.x1) >= 8 && Number(barre[0].attributs.y1) <= 297 - 8);
      tous(svg, (e) => e.nom === 'text').forEach((t) => {
        textes.push(t.textContent);
        assert.ok(Number(t.attributs['font-size']) >= 6 * 25.4 / 72, 'texte de 6 pt au moins : ' + t.textContent);
      });
      assert.ok(tous(svg, (e) => e.nom === 'pattern').length === 0, 'aucun <pattern> (il sortirait en image à l’impression)');
      assert.ok(tous(svg, (e) => 'style' in e.attributs).length === 0, 'aucun attribut style');
      tous(svg, (e) => 'stroke-width' in e.attributs && e.attributs.stroke !== 'none').forEach((e) => {
        // Épaisseur réelle : les traits du groupe mis à l'échelle (45 / 60) sont en unités de dessin.
        assert.ok(Number(e.attributs['stroke-width']) >= 0.25 - 1e-9, 'trait de 0,25 mm au moins');
      });
    });
    assert.strictEqual(coupes, 50);
    assert.ok(textes.some((t) => /^Planche 1 \/ \d+ · A3 paysage · 2026-11-20 · Imprimer à 100 %, sans ajustement à la page$/.test(t)));
    PL.listePieces(DEFAUT).filter((p) => p.genre !== 'ville').forEach((p) => {
      const attendu = p.genre === 'evenement' ? p.nom : PL.etiquette(p);
      assert.ok(textes.includes(attendu), 'étiquette « ' + attendu + ' »');
    });
    // Sans étiquettes : les pièces du catalogue n'en portent plus ; villes et événements gardent leur nom.
    const sans = PL.lireReglages('etiquettes=non'), r2 = PL.ranger(PL.listePieces(sans), sans), t2 = [];
    r2.planches.forEach((poses, i) => { tous(PL.dessinerPlanche(poses, i + 1, r2.planches.length, sans, '2026-11-20'), (e) => e.nom === 'text').forEach((t) => t2.push(t.textContent)); });
    assert.ok(!t2.includes('F31 Lisière') && t2.includes('Crevasse'));
    assert.ok(!t2.some((x) => /Ville|VD ·|VC ·|VNP ·/.test(x)), 'aucun texte sur les tuiles de ville');
    // Jeu en miroir : planches autonomes, avec trait de coupe, étiquettes « (miroir) » et cartouche « — miroir ».
    const mi = PL.lireReglages('miroir=oui'), r3 = PL.ranger(PL.listePieces(mi), mi), t3 = [];
    let coupes3 = 0;
    r3.planches.forEach((poses, i) => {
      const svg = PL.dessinerPlanche(poses, i + 1, r3.planches.length, mi, '2026-11-20');
      coupes3 += tous(svg, (e) => e.attributs.class === 'pl-coupe').length;
      assert.strictEqual(tous(svg, (e) => e.attributs.class === 'pl-barre').length, 1);
      tous(svg, (e) => e.nom === 'text').forEach((t) => t3.push(t.textContent));
    });
    assert.strictEqual(coupes3, 50);
    assert.ok(t3.includes('F31 Lisière (miroir)') && !t3.includes('F31 Lisière') && t3.includes('Crevasse') && !t3.some((x) => /Ville|VD ·|VC ·/.test(x)));
    assert.ok(t3.some((t) => /^Planche 1 \/ \d+ — miroir · A3 paysage · 2026-11-20 · /.test(t)));
  } finally {
    if (avant === undefined) delete globalThis.document; else globalThis.document = avant;
  }
});

test('page planches.html : même politique de sécurité que index.html, rien en ligne, scripts dans l’ordre', () => {
  const lire = (nom) => fs.readFileSync(path.join(__dirname, '..', nom), 'utf8');
  const page = lire('planches.html'), index = lire('index.html'), csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/;
  assert.strictEqual(csp.exec(page)[1], csp.exec(index)[1]);
  assert.ok(!/\sstyle\s*=/.test(page) && !/<style/i.test(page) && !/\son[a-z]+\s*=/i.test(page));
  assert.ok(!/<script(?![^>]*\ssrc=)[^>]*>/.test(page), 'aucun script en ligne');
  assert.deepStrictEqual(page.match(/<script src="[^"]+"/g).map((s) => s.slice(13, -1)),
    ['src/hex.js', 'src/catalogue.js', 'src/plateau.js', 'src/rendu.js', 'src/planches.js']);
  assert.ok(!/https?:\/\//.test(page), 'aucune ressource distante');
  ['format', 'orientation', 'ville', 'fond', 'etiquettes', 'terrain', 'villes', 'evenements', 'miroir'].forEach((nom) => {
    assert.ok(page.includes('name="' + nom + '"'), 'réglage ' + nom);
  });
  assert.ok(/<button type="button" id="pl-imprimer">Imprimer<\/button>/.test(page));
  const code = lire('src/planches.js'), css = lire('styles/planches.css');
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(code.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.match(css, /@page\s*\{\s*size:\s*A3 landscape;\s*margin:\s*0;?\s*\}/);
  assert.match(css, /break-after:\s*page/);
  assert.ok(/@media print[\s\S]*\.pl-entete[^{]*\{\s*display:\s*none/.test(css), 'réglages masqués à l’impression');
  assert.ok(lire('src/vue-inventaire.js').includes("href: 'planches.html'"), 'lien dans l’onglet Inventaire');
  assert.ok(/GARDER = \[[^\]]*'planches\.html'/.test(lire('outils/empaqueter.py')), 'planches.html dans le paquet');
});

test('tuiles de ville capturée : 5 par joueur par défaut, réglables, aux couleurs des deux joueurs', () => {
  const compte = (texte) => PL.listePieces(PL.lireReglages(texte)).filter((p) => p.id === 'VC');
  const defaut = compte('');
  assert.strictEqual(defaut.length, 10);
  assert.strictEqual(defaut.filter((p) => p.camp === 'vert').length, 5);
  assert.strictEqual(defaut.filter((p) => p.camp === 'rouge').length, 5);
  assert.strictEqual(compte('captures=3').length, 6);
  assert.strictEqual(compte('captures=0').length, 0);
  assert.strictEqual(compte('captures=99').length, 10, 'valeur inconnue : réglage par défaut');
  assert.strictEqual(compte('villes=non').length, 0);
  assert.strictEqual(PL.etiquette(defaut[0]), 'VC · Vert');
});
