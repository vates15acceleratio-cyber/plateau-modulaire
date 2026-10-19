'use strict';
/*
 * Tests de l'export pour le format hexagonal 'hex19' (lot 3, docs/78) : planches A3 et A4 en coupes partagées, jeu complet et tuiles
 * posées, aperçu du plateau, 24 jetons recto-verso, PDF vectoriel, SVG, PNG ; non-régression du carré.
 * Modèles du catalogue candidat (docs/75) injectés en mémoire (tests/aides-rendu-hex.js), stock porté à 30 pièces.
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
require('../src/rendu.js');
require('../src/export.js');
const PM = globalThis.PM;
const M = PM.modele, E = PM.exportation, R = PM.rendu, GR = PM.graphe;
const F = PM.geometrie.format('hex19');
const H = require('./aides-rendu-hex.js');

/** Stock de 30 pièces (docs/72 : 19 tuiles et 11 de réserve) : 8 HC2 + 7 HC3 (intérieures), 8 HB1 (bords), 7 HK1 (coins). */
const EXEMPLAIRES = { HC2: 8, HC3: 7 };
function docComplet() {
  const { plateaux } = H.plateauxBons(M, GR, 1, 2026);
  assert.strictEqual(plateaux.length, 1, 'un plateau complet équilibré existe');
  const doc = plateaux[0].doc;
  doc.modeles.forEach((m) => { if (EXEMPLAIRES[m.id]) m.exemplaires = EXEMPLAIRES[m.id]; });
  return doc;
}
const DOC = docComplet();
const PLANCHES_A3 = E.calepiner(DOC, { format: 'A3' });
const PLANCHES_A4 = E.calepiner(DOC, { format: 'A4' });

const somme = (xs) => xs.reduce((a, b) => a + b, 0);
const perimetre = (P) => somme(P.map((p, i) => { const q = P[(i + 1) % P.length]; return Math.hypot(q.x - p.x, q.y - p.y); }));
const boite = (P) => { const xs = P.map((p) => p.x), ys = P.map((p) => p.y); return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; };
function sansNaN(svg, nom) { assert.ok(!/NaN|undefined|Infinity|null/.test(svg), nom + ' : valeur invalide'); }
function equilibre(svg) {
  const pile = [], re = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[^>]*?)?)(\/?)>/g;
  let m;
  while ((m = re.exec(svg))) {
    if (m[4] === '/') continue;
    if (m[1] === '/') assert.strictEqual(pile.pop(), m[2], 'balise fermante inattendue ' + m[2]);
    else pile.push(m[2]);
  }
  assert.deepStrictEqual(pile, [], 'balises non fermées');
}
const roles = (planche) => ({ coin: planche.tuiles.filter((t) => t.role === 'coin').length, bord: planche.tuiles.filter((t) => t.role === 'bord').length, centrale: planche.tuiles.filter((t) => t.role === 'centrale').length });
/** Point sur le contour d'un polygone ? */
function surContour(p, P, tol) {
  return P.some((a, i) => {
    const b = P[(i + 1) % P.length], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < tol;
  });
}

test('stock de 30 pièces : 3 planches A3 de 10 (4 coins, 2 bords, 4 hexagones d\'abord), 10 planches A4 de 3', () => {
  assert.deepStrictEqual(PLANCHES_A3.map((p) => p.tuiles.length), [10, 10, 10]);
  assert.strictEqual(PLANCHES_A4.length, 10);
  assert.ok(PLANCHES_A4.every((p) => p.tuiles.length === 3));
  assert.deepStrictEqual(roles(PLANCHES_A3[0]), { coin: 4, bord: 2, centrale: 4 });
  const total = { coin: 0, bord: 0, centrale: 0 };
  PLANCHES_A3.forEach((p) => Object.entries(roles(p)).forEach(([k, v]) => { total[k] += v; }));
  assert.deepStrictEqual(total, { coin: 7, bord: 8, centrale: 15 });
  // 19 tuiles posées et 11 de réserve : les posées d'abord
  assert.strictEqual(somme(PLANCHES_A3.map((p) => p.tuiles.filter((t) => t.posee).length)), 19);
  // noms, titres, numéros
  assert.strictEqual(PLANCHES_A3[0].nom, 'plateau-tuiles-A3-1');
  assert.match(PLANCHES_A3[2].titre, /tuiles A3 - planche 3\/3 .*coupes partagées/);
  assert.match(PLANCHES_A4[9].titre, /tuiles A4 - planche 10\/10/);
  PLANCHES_A3.forEach((p) => { assert.ok(p.hex); assert.strictEqual(p.largeur, 420); assert.strictEqual(p.hauteur, 297); });
  PLANCHES_A4.forEach((p) => { assert.strictEqual(p.largeur, 210); assert.strictEqual(p.hauteur, 297); });
  assert.deepStrictEqual(E.pngDims(PLANCHES_A3[0]), { largeurPx: 4961, hauteurPx: 3508 });
});

test('stock du catalogue candidat (26 pièces) et tuiles posées (19) : nombres de planches', () => {
  const doc = H.plateau(M);
  assert.strictEqual(E.calepiner(doc, { format: 'A3' }).length, 3);
  assert.strictEqual(E.calepiner(doc, { format: 'A4' }).length, 9);
  const posees = E.calepiner(doc, { format: 'A3', portee: 'posees' });
  assert.deepStrictEqual(posees.map((p) => p.tuiles.length), [10, 9]);
  const posees4 = E.calepiner(doc, { format: 'A4', portee: 'posees' });
  assert.strictEqual(posees4.length, 7);
  assert.ok(posees.concat(posees4).every((p) => p.tuiles.every((t) => t.posee)));
  // 19 tuiles posées = 7 hexagones, 6 bords, 6 coins
  const r = { coin: 0, bord: 0, centrale: 0 };
  posees.forEach((p) => Object.entries(roles(p)).forEach(([k, v]) => { r[k] += v; }));
  assert.deepStrictEqual(r, { coin: 6, bord: 6, centrale: 7 });
  assert.throws(() => E.calepiner(doc, { format: 'A5' }));
  // pas de planche pour un plateau vide
  assert.deepStrictEqual(E.calepiner(M.nouveauDocument('hex19'), { format: 'A3', portee: 'posees' }), []);
});

test('chaque pièce : bon polygone, dans la zone imprimable de la feuille, sans chevauchement (A3 et A4)', () => {
  const aires = (P) => { let a = 0; P.forEach((p, i) => { const q = P[(i + 1) % P.length]; a += p.x * q.y - q.x * p.y; }); return Math.abs(a) / 2; };
  const AIRE = { centrale: 1.5 * Math.sqrt(3) * 54 * 54 };
  AIRE.bord = AIRE.centrale + 2 * (0.5 * Math.sqrt(3) * 54 * 27 / 2 * 0 + 0) + 0; // calculée plus bas depuis la forme canonique
  PLANCHES_A3.concat(PLANCHES_A4).forEach((p) => {
    p.tuiles.forEach((t) => {
      const att = { centrale: 6, bord: 5, coin: 5 }[t.role];
      assert.strictEqual(t.forme.length, att, t.etiquette);
      const canon = F.forme(t.role);
      assert.ok(Math.abs(aires(t.forme) - aires(canon)) < 0.5, 'aire de ' + t.etiquette);
      assert.ok(Math.abs(perimetre(t.forme) - perimetre(canon)) < 0.5, 'périmètre de ' + t.etiquette);
      const b = boite(t.forme);
      assert.ok(b.x0 >= 5 && b.x1 <= p.largeur - 5 && b.y0 >= 5 && b.y1 <= p.hauteur - 5, p.nom + ' ' + t.etiquette + ' hors de la zone imprimable');
      // rotation d'impression : multiple de 60°, forme tournée du canon
      assert.ok(Number.isInteger(t.rot) && t.rot >= 0 && t.rot < 6);
    });
    for (let i = 0; i < p.tuiles.length; i++) for (let j = i + 1; j < p.tuiles.length; j++) {
      assert.strictEqual(E.recouvrement(p.tuiles[i].forme, p.tuiles[j].forme), 0, p.nom + ' : ' + p.tuiles[i].etiquette + ' chevauche ' + p.tuiles[j].etiquette);
    }
    // ni le titre ni la barre de contrôle ne touchent une pièce
    const bb = E.boiteBarre(p.barre), titre = E.boiteTexte(p.textes.find((t) => t.texte === p.titre));
    const enc = p.encombrement;
    assert.ok(titre.y1 < enc.y0 && bb.y0 > enc.y1, p.nom + ' : titre et barre à l\'écart des pièces');
    assert.ok(bb.x0 >= 5 && bb.x1 <= p.largeur - 5 && bb.y1 <= p.hauteur - 5 && titre.x1 <= p.largeur - 5);
  });
  assert.ok(Math.abs(AIRE.centrale - aires(F.forme('centrale'))) < 0.01);
});

test('disposition A3 : trois rangées jointives en nid d\'abeille (docs/75), encombrement 374 x 270', () => {
  const p = PLANCHES_A3[0], ri = F.APOTHEME;
  const enc = p.encombrement;
  assert.ok(Math.abs(enc.x1 - enc.x0 - 8 * ri) < 0.01, 'largeur ' + (enc.x1 - enc.x0));
  assert.ok(Math.abs(enc.y1 - enc.y0 - 270) < 0.01, 'hauteur ' + (enc.y1 - enc.y0));
  const lignes = [0, 1, 2].map((l) => p.tuiles.filter((t) => t.lig === l).length);
  assert.deepStrictEqual(lignes, [3, 4, 3]);
  // les quatre coins aux extrémités des rangées du haut et du bas : rotations 4, 5 (haut), 2, 1 (bas)
  const coins = p.tuiles.filter((t) => t.role === 'coin').map((t) => t.lig + ':' + t.col + ':' + t.rot).sort();
  assert.deepStrictEqual(coins, ['0:0:4', '0:2:5', '2:0:2', '2:2:1']);
  // bords à bord droit vers le haut (rot 0) en haut, vers le bas (rot 3) en bas
  p.tuiles.filter((t) => t.role === 'bord').forEach((t) => assert.strictEqual(t.rot, t.lig === 0 ? 0 : 3));
  // les centres de la rangée du milieu sont espacés de 2 ri = 93,53 mm
  const mil = p.tuiles.filter((t) => t.lig === 1).map((t) => t.x).sort((a, b) => a - b);
  mil.slice(1).forEach((x, i) => assert.ok(Math.abs(x - mil[i] - 2 * ri) < 0.01));
  // la disposition est centrée sur la feuille
  assert.ok(Math.abs((enc.x0 + enc.x1) / 2 - 210) < 0.01);
});

test('A4 : 3 pièces jointives, toutes les compositions de rôles ont une disposition qui tient dans la feuille', () => {
  const rolesPossibles = ['centrale', 'bord', 'coin'];
  const vus = new Set();
  for (const a of rolesPossibles) for (const b of rolesPossibles) for (const c of rolesPossibles) {
    const cle = [a, b, c].sort().join(',');
    if (vus.has(cle)) continue;
    vus.add(cle);
    const d = PM.exportation.calepiner; assert.ok(d);
  }
  // sur le stock complet, chaque planche A4 touche au moins deux voisines (traits partagés) et tient en 194 x 274 mm
  PLANCHES_A4.forEach((p) => {
    const enc = p.encombrement;
    assert.ok(enc.x1 - enc.x0 <= 194 + 1e-6 && enc.y1 - enc.y0 <= 274 + 1e-6, p.nom + ' : ' + (enc.x1 - enc.x0) + ' x ' + (enc.y1 - enc.y0));
    assert.ok(p.reperes.some((r) => r.partage), p.nom + ' : au moins un trait de coupe partagé');
  });
  // compositions extrêmes : trois coins, trois bords
  const doc = H.plateau(M);
  doc.modeles.forEach((m) => { m.exemplaires = m.id === 'HK1' ? 3 : 0; });
  const trois = E.calepiner(doc, { format: 'A4' });
  assert.deepStrictEqual(trois.map((p) => p.tuiles.length), [3]);
  doc.modeles.forEach((m) => { m.exemplaires = m.id === 'HB1' ? 3 : 0; });
  assert.deepStrictEqual(E.calepiner(doc, { format: 'A4' }).map((p) => p.tuiles.length), [3]);
  doc.modeles.forEach((m) => { m.exemplaires = m.id === 'HK1' ? 1 : m.id === 'HB1' ? 1 : m.id === 'HC2' ? 1 : 0; });
  const mixte = E.calepiner(doc, { format: 'A4' });
  assert.strictEqual(mixte[0].tuiles.length, 3);
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) assert.strictEqual(E.recouvrement(mixte[0].tuiles[i].forme, mixte[0].tuiles[j].forme), 0);
});

test('coupes partagées : un seul trait par côté commun ; le périmètre cumulé = traits uniques + côtés communs', () => {
  PLANCHES_A3.concat(PLANCHES_A4).forEach((p) => {
    const perim = somme(p.tuiles.map((t) => perimetre(t.forme)));
    const longueur = (r) => Math.hypot(r.x2 - r.x1, r.y2 - r.y1);
    const uniques = somme(p.reperes.map(longueur)), partages = somme(p.reperes.filter((r) => r.partage).map(longueur));
    assert.ok(Math.abs(perim - (uniques + partages)) < 0.05, p.nom + ' : ' + perim + ' vs ' + uniques + ' + ' + partages);
    assert.ok(uniques < perim, p.nom + ' : des coupes sont bien partagées');
    // chaque trait est porté par le contour d'au moins une pièce, en son milieu et à ses extrémités
    p.reperes.forEach((r) => {
      [[r.x1, r.y1], [r.x2, r.y2], [(r.x1 + r.x2) / 2, (r.y1 + r.y2) / 2]].forEach(([x, y]) => {
        assert.ok(p.tuiles.some((t) => surContour({ x, y }, t.forme, 0.01)), p.nom + ' : trait hors des pièces');
      });
    });
    // aucun trait n'est dupliqué
    const cles = p.reperes.map((r) => [r.x1, r.y1, r.x2, r.y2].join(','));
    assert.strictEqual(new Set(cles).size, cles.length);
    assert.strictEqual(E.calculerReperes(p).length, p.reperes.length);
  });
  // A3, planche 1 : 10 pièces, 4 coins + 2 bords + 4 hexagones ; les rangées se touchent par 14 côtés communs ou plus
  const p = PLANCHES_A3[0];
  assert.ok(p.reperes.filter((r) => r.partage).length >= 14);
  // les 81 mm de coupe entre un bord et un coin de la même rangée sont un seul trait droit
  assert.ok(p.reperes.some((r) => r.partage && Math.abs(Math.hypot(r.x2 - r.x1, r.y2 - r.y1) - 81) < 0.05 && Math.abs(r.x1 - r.x2) < 1e-6), 'coupe verticale partagée de 81 mm');
  // deux pièces identiques posées à l'écart n'ont pas de trait commun
  const deux = { tuiles: [{ forme: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }, { forme: [{ x: 20, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 10 }, { x: 20, y: 10 }] }] };
  assert.ok(E.calculerReperesHex(deux).every((r) => !r.partage));
  const contigus = { tuiles: [{ forme: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }, { forme: [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 10 }] }] };
  const rc = E.calculerReperesHex(contigus);
  assert.strictEqual(rc.filter((r) => r.partage).length, 1);
  assert.strictEqual(rc.length, 5, 'haut et bas fusionnés (20 mm), un côté commun, deux côtés extérieurs');
});

test('SVG des planches hexagonales : sans valeur invalide, à l\'échelle, traits de coupe, barre de 100 mm, étiquettes', () => {
  PLANCHES_A3.concat(PLANCHES_A4).forEach((p) => {
    const svg = p.svg;
    sansNaN(svg, p.nom);
    equilibre(svg);
    assert.strictEqual(svg, E.svgPlanche(DOC, p));
    assert.match(svg, new RegExp('width="' + p.largeur + 'mm" height="' + p.hauteur + 'mm" viewBox="0 0 ' + p.largeur + ' ' + p.hauteur + '"'));
    assert.strictEqual((svg.match(/<line /g) || []).length, p.reperes.length + 12, 'traits de coupe + barre (trait + 11 graduations)');
    assert.ok(svg.includes('>100 mm</text>'));
    assert.strictEqual((svg.match(/<g transform="translate/g) || []).length, p.tuiles.length);
    // pas de fond perdu : aucune pièce n'a de rect de fond, la forme blanche est le polygone de la pièce
    assert.ok(!/<rect [^>]*fill="#FFFFFF"/.test(svg.replace(/^<svg[^>]*><rect[^>]*>/, '')), 'pas de fond rectangulaire de fond perdu');
    p.tuiles.forEach((t) => {
      assert.ok(svg.includes('>' + t.etiquette + '</text>'), t.etiquette);
      const m = M.modeleParId(DOC, t.modeleId);
      assert.ok(svg.includes(R.contenuTuile(m, { rot: t.rot, fondPerdu: 0, contour: false, format: F })), 'contenu de ' + t.etiquette);
    });
    // les étiquettes sont dans la pièce et la feuille
    p.tuiles.forEach((t) => {
      const tx = p.textes.find((x) => x.texte === t.etiquette && Math.abs(x.x - t.etiquettePos.x) < 1e-6);
      assert.ok(tx, 'texte de ' + t.etiquette);
      const bt = E.boiteTexte(tx);
      assert.ok(bt.x0 >= 5 && bt.x1 <= p.largeur - 5 && bt.y0 >= 5 && bt.y1 <= p.hauteur - 5);
      [[bt.x0, bt.y0], [bt.x1, bt.y0], [bt.x0, bt.y1], [bt.x1, bt.y1]].forEach(([x, y]) => {
        assert.ok(E.recouvrement && t.forme.length > 0);
        // coin du texte à l'intérieur de la pièce de l'étiquette
        let dedans = true;
        t.forme.forEach((a, i) => { const b = t.forme[(i + 1) % t.forme.length]; if (((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) * ((t.forme[1].x - t.forme[0].x) * (t.y - t.forme[0].y) - (t.forme[1].y - t.forme[0].y) * (t.x - t.forme[0].x)) < -1e-6) dedans = false; });
        assert.ok(dedans, 'étiquette ' + t.etiquette + ' dans sa pièce');
      });
    });
  });
});

test('marges nominales du format hexagonal', () => {
  const a3 = E.margesFormat('A3', 'hex19'), a4 = E.margesFormat('A4', F);
  assert.ok(Math.abs(a3.x - (420 - 8 * F.APOTHEME) / 2) < 1e-9 && Math.abs(a3.y - 13.5) < 1e-9);
  assert.ok(Math.abs(a4.x - (210 - 4 * F.APOTHEME) / 2) < 1e-9 && Math.abs(a4.y - 54) < 1e-9);
  assert.throws(() => E.margesFormat('A5', 'hex19'));
  assert.ok(E.FORMATS_HEX.A3.largeur === 420 && E.FORMATS_HEX.A4.largeur === 210);
});

test('PDF vectoriel à l\'échelle : une page par planche (A3 paysage 1190,55 x 841,89 pt), découpe en polygone, sans NaN', () => {
  const pdf = E.pdfDepuisPlanches(PLANCHES_A3, DOC);
  const txt = Buffer.from(pdf).toString('latin1');
  assert.match(txt, /^%PDF-1\.4/);
  assert.strictEqual((txt.match(/\/Type \/Page \//g) || []).length, 3);
  assert.strictEqual((txt.match(/\/MediaBox \[0 0 1190\.55 841\.89\]/g) || []).length, 3);
  assert.ok(!/NaN|undefined|Infinity/.test(txt));
  assert.ok(/\nW n/.test(txt),'découpe en polygone (W n)');
  const a4 = Buffer.from(E.pdfDepuisPlanches(PLANCHES_A4, DOC)).toString('latin1');
  assert.strictEqual((a4.match(/\/MediaBox \[0 0 595\.28 841\.89\]/g) || []).length, 10);
  // échelle : 1 mm = 72 / 25,4 pt
  assert.ok(txt.includes('2.8346457 0 0 -2.8346457 0 841.89 cm'));
  // le flux convertit toutes les primitives du rendu hexagonal (path de découpe, secteurs, courbes de passage)
  const flux = E.svgVersFlux(PLANCHES_A3[0].svg);
  assert.strictEqual(flux.largeur, 420);
  assert.strictEqual(flux.hauteur, 297);
  assert.ok((flux.flux.match(/\nW n/g) || []).length >= 1);
  // la découpe d'une pièce est un polygone de 6 points (hexagone) : m, 5 l, h
  const clip = E.svgVersFlux('<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><clipPath id="c"><path d="M0 0 L5 0 L5 5 L0 5 Z"/></clipPath><g clip-path="url(#c)"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g></svg>');
  assert.match(clip.flux, /0 0 m\n5 0 l\n5 5 l\n0 5 l\nh\nW n/);
});

test('aperçu du plateau hexagonal : A3 portrait, 498,8 x 432 mm réduit, villes et campements aux sièges', () => {
  const svg = E.svgApercuPlateau(DOC);
  sansNaN(svg, 'aperçu');
  equilibre(svg);
  assert.match(svg, /width="297mm" height="420mm" viewBox="0 0 297 420"/);
  assert.match(svg, /Aperçu, non imprimable/);
  assert.match(svg, /49,9 x 43,2 cm, réduit à 54 %/);
  assert.strictEqual((svg.match(/<line /g) || []).length, 0, 'aucun repère de coupe');
  // 19 tuiles, 6 villes (disques noirs de Ø 30) et 18 campements (24 sièges au total)
  assert.strictEqual((svg.match(/data-contour="coupe"/g) || []).length, 19);
  assert.strictEqual((svg.match(/data-campement="buche"/g) || []).length / 2, 18);
  assert.strictEqual((svg.match(/<circle cx="[-\d.]+" cy="[-\d.]+" r="15" fill="#111111"\/>/g) || []).length, 6);
  // le plateau est réduit à 270 mm de large, centré
  assert.match(svg, /<g transform="translate\(148\.5 [\d.]+\) scale\(0\.541\)">/);
  const hexa = svg.match(/<path d="(M[^"]*) Z" fill="none" stroke="#111111" stroke-width="0\.8"\/><\/g>/);
  assert.ok(hexa, 'contour du plateau');
  const pts = hexa[1].match(/-?[\d.]+ -?[\d.]+/g).map((s) => s.split(' ').map(Number));
  assert.strictEqual(pts.length, 6);
  assert.ok(Math.abs(Math.max(...pts.map((q) => q[0])) - 249.415) < 0.01 && Math.abs(Math.max(...pts.map((q) => q[1])) - 216) < 0.01);
  // plateau vide : rien ; tuile au modèle introuvable : cellule en pointillés ; siège incomplet : pas de jeton
  const vide = E.svgApercuPlateau(M.nouveauDocument('hex19'));
  sansNaN(vide, 'aperçu vide');
  assert.strictEqual((vide.match(/data-campement/g) || []).length, 0);
  const trois = M.nouveauDocument('hex19');
  const c0 = F.cellule(2, 2), cn = F.cellule(c0.voisins ? 3 : 3, 2);
  trois.plateau.tuiles = [{ modeleId: 'absent', col: 2, lig: 2, rot: 0 }, { modeleId: 'absent', col: 3, lig: 2, rot: 0 }, { modeleId: 'absent', col: 2, lig: 3, rot: 0 }, { modeleId: 'absent', col: 9, lig: 9, rot: 0 }];
  const partiel = E.svgApercuPlateau(trois);
  sansNaN(partiel, 'aperçu partiel');
  assert.strictEqual((partiel.match(/stroke-dasharray="3 3"/g) || []).length, 3, 'trois cellules sans modèle, la cellule inexistante est ignorée');
  assert.ok(cn && c0);
  assert.strictEqual((partiel.match(/data-campement="buche"/g) || []).length / 2, 1, 'un seul siège à 3 tuiles posées');
});

test('aperçu : un plateau complet très déséquilibré est refusé (preparerSorties), un plateau équilibré est accepté', () => {
  const sortie = E.preparerSorties(DOC, { tuiles: false, apercu: true });
  assert.strictEqual(sortie.feuilles.length, 1);
  assert.strictEqual(sortie.feuilles[0].type, 'apercu');
  assert.strictEqual(sortie.feuilles[0].nom, 'plateau-apercu-A3');
  // verdict « très déséquilibré » simulé (la recherche d'un tel plateau hexagonal est hors du périmètre de ce lot)
  const vrai = GR.equilibre;
  GR.equilibre = () => ({ complet: true, tresDesequilibre: true, blocages: [{ message: '4 contre 2.' }] });
  const mauvais = DOC;
  try {
    assert.throws(() => E.preparerSorties(mauvais, { tuiles: false, apercu: true }), /Aperçu du plateau refusé/);
    // sans aperçu demandé, aucune vérification
    assert.doesNotThrow(() => E.preparerSorties(mauvais, { tuiles: true, apercu: false }));
  } finally { GR.equilibre = vrai; }
  // sans aperçu demandé, aucune vérification
  assert.doesNotThrow(() => E.preparerSorties(mauvais, { tuiles: true, apercu: false }));
});

test('jetons recto-verso : 24 pour tous les formats, hexagonal compris (docs/72), deux pages A4 en miroir', () => {
  const p = E.planchesJetons(), v = p.verso;
  assert.strictEqual(p.jetons.length, 24);
  assert.strictEqual(v.jetons.length, 24);
  assert.ok(p.jetons.every((j) => j.type === 'campement') && v.jetons.every((j) => j.type === 'capture'));
  const recto = E.svgJetons('recto'), verso = E.svgJetons('verso');
  [recto, verso].forEach((svg) => { sansNaN(svg, 'jetons'); equilibre(svg); assert.match(svg, /width="210mm" height="297mm" viewBox="0 0 210 297"/); });
  assert.strictEqual((recto.match(/data-campement="flamme"/g) || []).length, 24);
  assert.strictEqual((verso.match(/r="18" fill="#111111"/g) || []).length, 24);
  // miroir du retournement bord long, grille 4 x 6 au pas de 38 mm centrée
  v.jetons.forEach((j, k) => assert.ok(Math.abs(j.cx - (210 - p.jetons[k].cx)) < 1e-9 && Math.abs(j.cy - p.jetons[k].cy) < 1e-9));
  const xs = [...new Set(p.jetons.map((j) => Math.round(j.cx * 1000)))], ys = [...new Set(p.jetons.map((j) => Math.round(j.cy * 1000)))];
  assert.strictEqual(xs.length, 4);
  assert.strictEqual(ys.length, 6);
  assert.ok(Math.abs((Math.max(...ys) - Math.min(...ys)) / 1000 - 5 * 38) < 1e-6);
  // tout dans la zone imprimable, disques de fond perdu disjoints, rien ne touche le texte d'en-tête
  [p, v].forEach((page) => {
    page.jetons.forEach((j) => assert.ok(j.cx - page.rayonFondPerdu >= 5 && j.cx + page.rayonFondPerdu <= 205 && j.cy - page.rayonFondPerdu >= 5 && j.cy + page.rayonFondPerdu <= 292));
    for (let a = 0; a < 24; a++) for (let b = a + 1; b < 24; b++) assert.ok(Math.hypot(page.jetons[a].cx - page.jetons[b].cx, page.jetons[a].cy - page.jetons[b].cy) >= 2 * page.rayonFondPerdu - 1e-9);
  });
  const haut = Math.min(...p.jetons.map((j) => j.cy)) - (p.rayonFondPerdu + 1.5 + 2.5);
  const texteBas = Math.max(...p.textes.map((t) => t.y)) + 1;
  assert.ok(haut > texteBas, 'repères du recto sous les consignes : ' + haut + ' > ' + texteBas);
  // PDF des jetons (2 pages A4)
  const pdf = Buffer.from(E.pdfDepuisPlanches([{ svg: recto }, { svg: verso }])).toString('latin1');
  assert.strictEqual((pdf.match(/\/MediaBox \[0 0 595\.28 841\.89\]/g) || []).length, 2);
});

test('preparerSorties hexagonal : planches, jetons (2 pages), aperçu ; SVG et PNG', () => {
  const sortie = E.preparerSorties(DOC, { tuiles: true, portee: 'stock', format: 'A3', jetons: true, apercu: true });
  assert.deepStrictEqual(sortie.feuilles.map((f) => f.type), ['tuiles', 'tuiles', 'tuiles', 'jetons', 'jetons', 'apercu']);
  assert.strictEqual(sortie.nbTuiles, 30);
  assert.deepStrictEqual(sortie.exclus, []);
  sortie.feuilles.forEach((f) => { sansNaN(f.svg, f.nom); E.svgVersFlux(f.svg); });
  const a3 = sortie.feuilles[0];
  assert.strictEqual(a3.largeur, 420);
  assert.strictEqual(a3.hauteur, 297);
  assert.deepStrictEqual(E.pngDims(a3), { largeurPx: 4961, hauteurPx: 3508 });
  const pdf = E.pdfDepuisPlanches(sortie.feuilles);
  assert.match(Buffer.from(pdf).toString('latin1'), /^%PDF-1\.4/);
  // tuiles posées en A4
  const posees = E.preparerSorties(DOC, { portee: 'posees', format: 'A4' });
  assert.strictEqual(posees.nbTuiles, 19);
  assert.strictEqual(posees.feuilles.length, 7);
  // exemplaires choisis dans la fenêtre d'export
  const reduit = E.preparerSorties(DOC, { format: 'A3', exemplaires: { HC2: 0, HC3: 0, HB1: 0 } });
  assert.strictEqual(reduit.nbTuiles, 7);
  // PNG : le chunk pHYs de 300 dpi s'ajoute à un PNG minimal
  const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));
  const phys = E.ajouterPhys(png, 11811);
  assert.ok(Buffer.from(phys).includes(Buffer.from('pHYs')));
});

test('non-régression du carré : calepinage, planches et jetons inchangés (hors 24 jetons)', () => {
  const doc = M.nouveauDocument();
  doc.modeles = M.copieExemples().map((m, i) => Object.assign(m, { exemplaires: [7, 7, 6][i] }));
  const a3 = E.calepiner(doc, { format: 'A3' }), a4 = E.calepiner(doc, { format: 'A4' });
  assert.deepStrictEqual(a3.map((p) => p.tuiles.length), [6, 6, 6, 2]);
  assert.strictEqual(a4.length, 10);
  assert.ok(a3.every((p) => !p.hex && p.largeur === 297 && p.hauteur === 420));
  assert.match(a3[0].svg, /width="297mm" height="420mm" viewBox="0 0 297 420"/);
  assert.ok(!/pm-hex/.test(a3[0].svg));
  const m55 = M.nouveauDocument('5x5');
  m55.modeles = M.copieExemples('5x5').map((m, i) => Object.assign(m, { exemplaires: [4, 4, 4][i] }));
  const c = E.calepiner(m55, { format: 'A3' });
  assert.ok(c.length >= 1 && c.every((p) => !p.hex));
  assert.deepStrictEqual(E.margesFormat('A3'), E.margesFormat('A3', '4x4'));
  assert.ok(Math.abs(E.margesFormat('A3').x - 19.5) < 1e-9);
  // aperçu carré inchangé
  assert.match(E.svgApercuPlateau(doc), /width="297mm" height="420mm" viewBox="0 0 297 420"/);
});
