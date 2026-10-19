'use strict';
/*
 * Recette des corrections de la relecture (docs/27) et de l'avis prépresse (docs/26) : cas limites autour de
 * DIAMETRE_CASE, du carré d'apparition, de K4, du halo de coin, du fond perdu des jetons et de la migration v1.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/catalogue.js');
require('../src/etat.js');
require('../src/editeur-tuile.js');
require('../src/sauvegarde.js');
require('../src/export.js');

const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, R = PM.rendu, E = PM.editeurTuile, CAT = PM.catalogue, S = PM.sauvegarde, X = PM.exportation;
const GRILLES = ['4x4', '5x5'];

function distPS(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/* ---------- DIAMETRE_CASE : une seule valeur partout ---------- */

test('DIAMETRE_CASE : même valeur (20) dans les deux formats, catalogue, éditeur, exemples et jonction', () => {
  for (const g of GRILLES) {
    const F = G.format(g);
    assert.equal(F.DIAMETRE_CASE, 20, g);
    assert.equal(F.DIAMETRE_CASE, F.DIAMETRE_CASE_JONCTION, g + ' = jonction');
    assert.ok(F.DIAMETRE_CASE <= F.DIAMETRE_CASE_MAX, g + ' <= Ø max');
    for (const m of M.copieExemples(g)) for (const c of m.cases) assert.equal(c.diametre, F.DIAMETRE_CASE, g + ' exemple ' + m.id + '/' + c.id);
  }
  assert.equal(E.DIAMETRE_DEFAUT, G.format('4x4').DIAMETRE_CASE);
  for (const m of CAT.modeles) for (const c of m.cases) assert.equal(c.diametre, G.format('4x4').DIAMETRE_CASE, 'catalogue ' + m.id + '/' + c.id);
});

test('éditeur : une case neuve (ajouterCase) a le diamètre DIAMETRE_CASE, dans les deux formats', () => {
  for (const g of GRILLES) {
    const m = E.ajouterCase(M.copieExemples(g).find((x) => x.gabarit === 'centrale'), 60, 60, 'deplacement', g);
    assert.equal(m.cases[m.cases.length - 1].diametre, G.format(g).DIAMETRE_CASE, g);
  }
});

/* ---------- rendu : repli sans diamètre ---------- */

test('rendu : une case sans diamètre (absent, 0, null) se dessine à Ø 20 dans les deux formats', () => {
  const rayon = (svg, id) => Number(new RegExp('<circle [^>]*r="([\\d.]+)"[^>]*data-case="' + id + '"').exec(svg)[1]);
  for (const g of GRILLES) {
    for (const vide of [undefined, 0, null]) {
      const c = { id: 'a', x: 50, y: 50, type: 'deplacement' };
      if (vide !== undefined) c.diametre = vide;
      assert.equal(rayon(R.contenuTuile({ cases: [c], chemins: [] }, { format: g }), 'a'), 10, g + ' ' + vide);
    }
    const app = R.contenuTuile({ cases: [{ id: 'p', x: 50, y: 50, type: 'apparition' }], chemins: [] }, { format: g });
    assert.equal(rayon(app, 'p'), 10, g + ' apparition');
    const w = Number(/<rect x="[\d.-]+" y="[\d.-]+" width="([\d.]+)"[^>]*data-apparition/.exec(app)[1]);
    assert.ok(Math.abs(w - (10 * Math.SQRT2 - 3)) < 1e-2, g + ' côté ' + w);
  }
});

test('rendu : un diamètre explicite n’est jamais remplacé par le repli', () => {
  const svg = R.contenuTuile({ cases: [{ id: 'a', x: 50, y: 50, diametre: 24, type: 'deplacement' }], chemins: [] });
  assert.match(svg, /r="12"[^>]*data-case="a"/);
});

/* ---------- carré d'apparition ---------- */

test('carré d’apparition : jeu >= 0,9 mm aux coins et côté > 0 pour tout diamètre de 10 à 30 mm, impression et camps', () => {
  for (let d = 10; d <= 30; d += 0.5) {
    for (const camp of [undefined, 'vert', 'rouge', 'neutre']) {
      const svg = R.contenuTuile({ cases: [{ id: 'p', x: 60, y: 60, diametre: d, type: 'apparition' }], chemins: [] }, camp ? { camp } : {});
      const m = /<rect x="[\d.-]+" y="[\d.-]+" width="([\d.]+)" height="[\d.]+" fill="none" stroke="[^"]+" stroke-width="([\d.]+)"/.exec(svg.slice(svg.indexOf('data-case="p"')));
      assert.ok(m, 'carré absent Ø ' + d);
      const cote = Number(m[1]), trait = Number(m[2]);
      assert.ok(cote > 0, `Ø ${d} côté ${cote}`);
      assert.equal(trait, camp ? 1.2 : 1.0, `trait ${camp || 'impression'}`);
      // jeu entre le coin du carré (trait compris) et le contour du disque (trait de 0,6 mm)
      const jeu = d / 2 - Math.hypot(cote / 2, cote / 2) - trait / 2 - 0.3;
      assert.ok(jeu >= 0.9 - 1e-6, `Ø ${d} ${camp || 'impression'} jeu ${jeu.toFixed(3)}`);
    }
  }
});

test('carré d’apparition : tourné avec la tuile, il reste centré sur la case (4 rotations, 2 formats)', () => {
  for (const g of GRILLES) {
    const m = M.copieExemples(g).find((x) => x.gabarit === 'coin'), c = m.cases.find((x) => x.type === 'apparition');
    const F = G.format(g);
    for (let rot = 0; rot < 4; rot++) {
      const svg = R.contenuTuile(m, { format: g, rot });
      const r = /<rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="[\d.]+" fill="none" stroke="[^"]+" stroke-width="[\d.]+" data-apparition/.exec(svg);
      const p = F.tournerPoint({ x: c.x, y: c.y }, rot), cote = Number(r[3]);
      assert.ok(Math.abs(Number(r[1]) + cote / 2 - p.x) < 1e-2 && Math.abs(Number(r[2]) + cote / 2 - p.y) < 1e-2, `${g} rot ${rot}`);
    }
  }
});

/* ---------- K4 ---------- */

test('K4 (4×4) : relais en (82,61) et (61,82), case à port en (92,92), modèle valide', () => {
  const k4 = CAT.modeles.find((m) => m.id === 'K4');
  const pos = (id) => { const c = k4.cases.find((x) => x.id === id); return [c.x, c.y]; };
  assert.deepEqual(pos('s1'), [82, 61]);
  assert.deepEqual(pos('s2'), [61, 82]);
  assert.deepEqual(pos('c1'), [92, 92]);
  assert.deepEqual(pos('a'), [40, 40]);
  assert.equal(M.validerModele(k4, '4x4').erreurs.length, 0);
});

test('K4 : les deux routes de l’apparition à la case à port ont la même longueur', () => {
  const k4 = CAT.modeles.find((m) => m.id === 'K4');
  const c = (id) => k4.cases.find((x) => x.id === id);
  const d = (a, b) => Math.hypot(c(a).x - c(b).x, c(a).y - c(b).y);
  assert.ok(Math.abs(d('a', 's1') + d('s1', 'c1') - d('a', 's2') - d('s2', 'c1')) < 1e-9);
});

/* ---------- halo de coin ---------- */

test('haloDe : le halo d’un coin enveloppe la case de jonction (rayon = Ø/2 + 3), 4 coins, 2 formats', () => {
  for (const g of GRILLES) {
    const F = G.format(g), m = M.copieExemples(g).find((x) => x.gabarit === 'coin');
    for (let k = 0; k < 4; k++) {
      const h = E.haloDe(m, { type: 'coin', id: k }, F);
      assert.equal(h.cercles.length, 1, g + ' coin ' + k);
      const p = F.pointCoin(k);
      assert.deepEqual(h.cercles[0], { x: p.x, y: p.y, r: F.DIAMETRE_CASE_JONCTION / 2 + 3 }, g + ' coin ' + k);
    }
  }
});

/* ---------- jetons : fond perdu ---------- */

test('jetons : fond perdu de 1,5 mm (Ø 33 pour Ø 30), tous les jetons dans les marges de l’A4', () => {
  const p = X.planchesJetons();
  assert.equal(p.rayonCoupe, 15);
  assert.equal(p.rayonFondPerdu, 16.5);
  assert.equal(p.jetons.length, 16); // 8 villes et 8 campements (docs/18, 2026-10-19)
  for (const j of p.jetons) {
    assert.ok(j.cx - 16.5 >= 3 - 1e-9 && j.cx + 16.5 <= p.largeur - 3 + 1e-9, 'marge latérale ' + j.cx);
    assert.ok(j.cy - 16.5 >= 3 - 1e-9 && j.cy + 16.5 <= p.hauteur - 3 + 1e-9, 'marge verticale ' + j.cy);
  }
  assert.ok(Math.abs(p.jetons[1].cx - p.jetons[0].cx - 38) < 1e-9);
  assert.ok((X.svgJetons().match(/r="16\.5"/g) || []).length >= 7);
});

/* ---------- migration v1 (cases Ø 24) ---------- */

test('document v1 (cases Ø 24) : rouvert, valide, rendu et exporté sans erreur ; les Ø 24 sont conservés', () => {
  const texte = fs.readFileSync(path.join(__dirname, 'donnees', 'document-v1.json'), 'utf8');
  const brut = JSON.parse(texte);
  assert.ok(brut.modeles.some((m) => m.cases.some((c) => c.diametre === 24)), 'le document de test contient des Ø 24');
  const r = S.depuisJSON(texte);
  assert.equal(r.ok, true);
  const d = r.doc;
  for (const m of d.modeles) {
    const v1 = brut.modeles.find((x) => x.id === m.id);
    assert.deepEqual(m.cases.map((c) => c.diametre), v1.cases.map((c) => c.diametre), m.id);
    assert.equal(M.validerModele(m, d.grille).erreurs.length, 0, m.id);
    for (let rot = 0; rot < 4; rot++) {
      const svg = R.svgTuile(m, { format: d.grille, rot, fondPerdu: 3 });
      assert.ok(!/NaN|undefined/.test(svg), m.id + ' rot ' + rot);
      assert.equal((svg.match(/data-case=/g) || []).length, m.cases.length, m.id);
      for (const c of m.cases) assert.match(svg, new RegExp('r="' + c.diametre / 2 + '"[^>]*data-case="' + c.id + '"'));
    }
  }
  const planches = X.calepiner(d, { format: 'A3' });
  assert.ok(planches.length >= 1);
  for (const pl of planches) assert.ok(!/NaN|undefined/.test(X.svgPlanche(d, pl)));
});
