'use strict';
const test = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/export.js');
const PM = globalThis.PM;
const M = PM.modele, E = PM.exportation, R = PM.rendu;

/** Document de test : les 3 modèles d'exemple (centrale, bord, coin), avec le nombre d'exemplaires choisi. */
function docAvec(exemplaires) {
  const doc = M.nouveauDocument();
  doc.modeles = M.copieExemples().map((m, i) => Object.assign(m, { exemplaires: exemplaires[i] }));
  return doc;
}
// 7 + 7 + 6 = 20 tuiles
const doc20 = () => docAvec([7, 7, 6]);

function texte(octets) { return Buffer.from(octets).toString('latin1'); }

/** Balises équilibrées d'un SVG (sans analyse de contenu). */
function equilibre(svg) {
  const pile = [];
  const re = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:\s+[^>]*?)?)(\/?)>/g;
  let m;
  while ((m = re.exec(svg))) {
    if (m[4] === '/') continue;
    if (m[1] === '/') assert.equal(pile.pop(), m[2], 'balise fermante inattendue ' + m[2]);
    else pile.push(m[2]);
  }
  assert.deepEqual(pile, [], 'balises non fermées');
}

/** Intersection stricte (intérieur) d'un segment très fin (épaisseur e) avec un rectangle. */
function segmentDansRect(s, r, e) {
  const x0 = Math.min(s.x1, s.x2) - e / 2, x1 = Math.max(s.x1, s.x2) + e / 2;
  const y0 = Math.min(s.y1, s.y2) - e / 2, y1 = Math.max(s.y1, s.y2) + e / 2;
  return x0 < r.x1 - 1e-9 && x1 > r.x0 + 1e-9 && y0 < r.y1 - 1e-9 && y1 > r.y0 + 1e-9;
}
function boitesSeChevauchent(a, b) { return a.x0 < b.x1 - 1e-9 && a.x1 > b.x0 + 1e-9 && a.y0 < b.y1 - 1e-9 && a.y1 > b.y0 + 1e-9; }

/* ------------------------------------------------------------------ */
/* Calepinage                                                          */
/* ------------------------------------------------------------------ */

test('marges : A3 (258 x 390 sur 297 x 420) et A4 en une colonne (126 x 258 sur 210 x 297)', () => {
  const a3 = E.margesFormat('A3'), a4 = E.margesFormat('A4');
  assert.ok(Math.abs(a3.x - 19.5) < 1e-9 && Math.abs(a3.y - 15) < 1e-9);
  assert.ok(Math.abs(a4.x - 42) < 1e-9 && Math.abs(a4.y - 19.5) < 1e-9);
  assert.throws(() => E.margesFormat('A5'));
});

test('20 tuiles : 4 planches A3 (6, 6, 6, 2) ou 10 planches A4 (2 chacune)', () => {
  const doc = doc20();
  const a3 = E.calepiner(doc, { format: 'A3' }), a4 = E.calepiner(doc, { format: 'A4' });
  assert.deepEqual(a3.map(p => p.tuiles.length), [6, 6, 6, 2]);
  assert.equal(a4.length, 10);
  assert.ok(a4.every(p => p.tuiles.length === 2));
  assert.equal(a3[0].nom, 'plateau-tuiles-A3-1');
  assert.equal(a3[3].nom, 'plateau-tuiles-A3-4');
});

test('toutes les tuiles tiennent dans la feuille avec des marges >= 15 mm, sans chevauchement', () => {
  for (const format of ['A3', 'A4']) {
    for (const p of E.calepiner(doc20(), { format })) {
      p.tuiles.forEach((t, i) => {
        assert.ok(t.x >= 15 - 1e-9 && t.y >= 15 - 1e-9, 'marge haute / gauche');
        assert.ok(p.largeur - (t.x + 126) >= 15 - 1e-9 && p.hauteur - (t.y + 126) >= 15 - 1e-9, 'marge basse / droite');
        p.tuiles.slice(i + 1).forEach(u => {
          const sep = Math.max(Math.abs(t.x - u.x), Math.abs(t.y - u.y));
          assert.ok(sep >= 132 - 1e-9, 'pas de 132 mm entre deux tuiles');
        });
      });
    }
  }
});

test('coordonnées A3 : colonnes x = 19,5 et 151,5 ; rangées y = 15, 147, 279', () => {
  const [p] = E.calepiner(doc20(), { format: 'A3' });
  assert.deepEqual(p.tuiles.map(t => [t.x, t.y]), [[19.5, 15], [151.5, 15], [19.5, 147], [151.5, 147], [19.5, 279], [151.5, 279]]);
  const [q] = E.calepiner(doc20(), { format: 'A4' });
  assert.deepEqual(q.tuiles.map(t => [t.x, t.y]), [[42, 19.5], [42, 151.5]]);
});

test('tri par identifiant, tuiles posées en tête, option « seulement les posées »', () => {
  const doc = docAvec([2, 2, 2]);
  const ids = doc.modeles.map(m => m.id).sort();
  const sansPose = E.listeTuiles(doc, {}).tuiles.map(t => t.modeleId);
  assert.deepEqual(sansPose, ids.flatMap(id => [id, id]));
  // pose d'un exemplaire du dernier id : il passe en tête
  const dernier = doc.modeles.find(m => m.id === ids[ids.length - 1]);
  const pose = M.poserTuile(doc, dernier.id, 0, 0); // ex-coin : le coin va dans un coin
  const liste = E.listeTuiles(pose, {}).tuiles;
  assert.equal(liste[0].modeleId, dernier.id);
  assert.equal(liste[0].posee, true);
  assert.equal(liste.length, 6);
  assert.ok(liste.every((t) => !('joueur' in t)), 'tuiles imprimées neutres : pas de joueur');
  const seules = E.listeTuiles(pose, { portee: 'posees' }).tuiles;
  assert.equal(seules.length, 1);
  assert.equal(seules[0].modeleId, dernier.id);
});

test('jeu complet : nombre d’exemplaires par modèle choisi dans la fenêtre (options.exemplaires), valeurs invalides ignorées', () => {
  const doc = docAvec([2, 2, 2]);
  const [bord, centrale, coin] = ['ex-bord', 'ex-centrale', 'ex-coin'];
  const nb = (liste, id) => liste.tuiles.filter(t => t.modeleId === id).length;
  const base = E.listeTuiles(doc, { portee: 'stock' });
  assert.deepEqual([nb(base, bord), nb(base, centrale), nb(base, coin)], [2, 2, 2], 'sans choix : champ exemplaires du modèle');
  const choisi = E.listeTuiles(doc, { portee: 'stock', exemplaires: { [bord]: 5, [centrale]: 0 } });
  assert.deepEqual([nb(choisi, bord), nb(choisi, centrale), nb(choisi, coin)], [5, 0, 2]);
  // valeurs invalides (négatif, décimal, texte, trop grand) : retour au champ du modèle
  for (const mauvais of [-1, 1.5, '3', NaN, 1000, null, undefined]) {
    assert.equal(nb(E.listeTuiles(doc, { portee: 'stock', exemplaires: { [bord]: mauvais } }), bord), 2, String(mauvais));
  }
  assert.equal(E.exemplairesImprimes({ id: 'x', exemplaires: 7 }, { exemplaires: { x: 3 } }), 3);
  assert.equal(E.exemplairesImprimes({ id: 'x', exemplaires: 7 }, {}), 7);
  assert.equal(E.exemplairesImprimes({ id: 'x', exemplaires: 7 }, { exemplaires: { x: 999 } }), 999);
  assert.equal(E.MAX_EXEMPLAIRES, 999);
  // le document n'est pas modifié
  assert.equal(doc.modeles.find(m => m.id === bord).exemplaires, 2);
  // les étiquettes portent un numéro dès qu'il y a plusieurs tuiles du modèle sur les planches
  const etiq = E.calepiner(doc, { format: 'A3', portee: 'stock', exemplaires: { [bord]: 3, [centrale]: 1 } }).flatMap(p => p.tuiles.map(t => t.etiquette));
  assert.ok(etiq.includes('ex-bord-3') && etiq.includes('ex-centrale') && !etiq.includes('ex-centrale-1') && etiq.includes('ex-coin-2'));
  // preparerSorties transmet le choix
  const sortie = E.preparerSorties(doc, { format: 'A3', portee: 'stock', exemplaires: { [bord]: 9 } });
  assert.equal(sortie.nbTuiles, 9 + 2 + 2);
});

test('plafond du jeu complet : calculé sur les exemplaires choisis, pas sur ceux du document', () => {
  const doc = docAvec([1, 1, 1]);
  assert.throws(() => E.listeTuiles(doc, { portee: 'stock', exemplaires: { 'ex-bord': 199, 'ex-coin': 1 } }), /201 tuiles .*200 au plus/);
  assert.equal(E.listeTuiles(doc, { portee: 'stock', exemplaires: { 'ex-bord': 198, 'ex-coin': 1 } }).tuiles.length, 200);
  assert.throws(() => E.preparerSorties(doc, { portee: 'stock', exemplaires: { 'ex-bord': 300 } }), /200 au plus/);
  // un jeu du document à 500 tuiles est ramené sous le plafond par le choix de la fenêtre
  const gros = docAvec([300, 1, 1]);
  assert.throws(() => E.listeTuiles(gros, { portee: 'stock' }), /200 au plus/);
  assert.equal(E.listeTuiles(gros, { portee: 'stock', exemplaires: { 'ex-centrale': 2 } }).tuiles.length, 4);
  // la portée « posées » n'est pas concernée par le plafond ni par les exemplaires choisis
  assert.equal(E.listeTuiles(gros, { portee: 'posees', exemplaires: { 'ex-centrale': 150 } }).tuiles.length, 0);
});

test('tuiles posées : un modèle posé plusieurs fois est imprimé autant de fois, avec numéro d’exemplaire', () => {
  let doc = docAvec([1, 1, 1]);   // 1 exemplaire par modèle, mais poses illimitées
  for (const [c, l] of [[1, 0], [2, 0], [3, 1]]) doc = M.poserTuile(doc, 'ex-bord', c, l);
  const liste = E.listeTuiles(doc, { portee: 'posees' });
  assert.deepEqual(liste.tuiles.map(t => t.modeleId + '#' + t.exemplaire), ['ex-bord#1', 'ex-bord#2', 'ex-bord#3']);
  assert.ok(liste.tuiles.every(t => t.posee));
  const etiq = E.calepiner(doc, { format: 'A3', portee: 'posees' })[0].tuiles.map(t => t.etiquette);
  assert.deepEqual(etiq, ['ex-bord-1', 'ex-bord-2', 'ex-bord-3']);
});

test('modèles incomplets exclus et signalés', () => {
  const doc = doc20();
  doc.modeles[1].cases[0].diametre = 40; // case trop grande : incomplet
  const r = E.listeTuiles(doc, {});
  assert.equal(r.exclus.length, 1);
  assert.equal(r.exclus[0].id, doc.modeles[1].id);
  assert.equal(r.tuiles.length, 13);
  // une alerte (R3) n'exclut pas un modèle
  const d2 = doc20();
  d2.modeles[0].chemins.push({ id: 'r9', a: { case: 'c1' }, b: { raccord: { cote: 0, pos: 0 } } });
  assert.equal(E.listeTuiles(d2, {}).tuiles.length, 20);
});

test('impression neutre (docs/18) : case d\'apparition en noir et blanc, sans couleur de camp, quarts de jonction imprimés', () => {
  const doc = doc20();
  for (const p of E.calepiner(doc, { format: 'A3' })) {
    const svg = E.svgPlanche(doc, p);
    assert.ok(!svg.includes(R.COULEURS.rouge), 'pas de rouge sur une planche de tuiles');
    assert.ok(!/data-apparition="(vert|rouge|neutre)"/.test(svg));
  }
  const svg = E.svgPlanche(doc, E.calepiner(doc, { format: 'A3' })[1]);
  assert.ok(svg.includes('data-apparition="impression"'));
  assert.ok(svg.includes('data-quart-jonction='));
});

/* ------------------------------------------------------------------ */
/* Repères et textes                                                   */
/* ------------------------------------------------------------------ */

test('repères : hors fond perdu, dans la feuille, sans doublon, 0,25 mm, un horizontal et un vertical par coin', () => {
  for (const format of ['A3', 'A4']) {
    for (const p of E.calepiner(doc20(), { format })) {
      const fonds = p.tuiles.map(t => ({ x0: t.x, y0: t.y, x1: t.x + 126, y1: t.y + 126 }));
      const cles = new Set();
      for (const s of p.reperes) {
        const cle = [s.x1, s.y1, s.x2, s.y2].join();
        assert.ok(!cles.has(cle), 'repère en double');
        cles.add(cle);
        assert.ok(s.x1 === s.x2 || s.y1 === s.y2, 'repère horizontal ou vertical');
        for (const f of fonds) assert.ok(!segmentDansRect(s, f, 0.25), 'repère dans un fond perdu');
        assert.ok(Math.min(s.x1, s.x2) >= E.MARGE_IMPRIMABLE && Math.max(s.x1, s.x2) <= p.largeur - E.MARGE_IMPRIMABLE);
        assert.ok(Math.min(s.y1, s.y2) >= E.MARGE_IMPRIMABLE && Math.max(s.y1, s.y2) <= p.hauteur - E.MARGE_IMPRIMABLE);
      }
      // chaque coin de coupe est servi : le trait horizontal passe par la ligne y de coupe, hors de la tuile coupée
      for (const t of p.tuiles) {
        for (const cx of [t.x + 3, t.x + 123]) {
          for (const cy of [t.y + 3, t.y + 123]) {
            const h = p.reperes.filter(s => s.y1 === s.y2 && Math.abs(s.y1 - cy) < 1e-9 && (cx === t.x + 3 ? s.x2 <= t.x : s.x1 >= t.x + 126));
            const v = p.reperes.filter(s => s.x1 === s.x2 && Math.abs(s.x1 - cx) < 1e-9 && (cy === t.y + 3 ? s.y2 <= t.y : s.y1 >= t.y + 126));
            assert.ok(h.length >= 1 && v.length >= 1, 'coin sans repère');
          }
        }
      }
    }
  }
});

test('repères : longueur 5 mm décalée de 3 mm en marge ; trait commun de 4 mm dans la gouttière', () => {
  const [p] = E.calepiner(doc20(), { format: 'A3' });
  const t = p.tuiles[0]; // coin nord-ouest de la feuille, voisin à l'est et au sud
  const marge = p.reperes.find(s => s.y1 === s.y2 && Math.abs(s.y1 - (t.y + 3)) < 1e-9 && s.x2 <= t.x);
  assert.ok(Math.abs((marge.x2 - marge.x1) - 5) < 1e-9);
  assert.ok(Math.abs(t.x - marge.x2 - 3) < 1e-9);
  assert.equal(marge.partage, false);
  const commun = p.reperes.find(s => s.y1 === s.y2 && Math.abs(s.y1 - (t.y + 3)) < 1e-9 && s.x1 > t.x + 126);
  assert.equal(commun.partage, true);
  assert.ok(Math.abs((commun.x2 - commun.x1) - 4) < 1e-9);
  assert.ok(Math.abs(commun.x1 - (t.x + 126) - 1) < 1e-9);
  // partagé : le coin ouest de la tuile voisine (même ligne de coupe) n'ajoute pas de second trait
  const surLaLigne = p.reperes.filter(s => s.y1 === s.y2 && Math.abs(s.y1 - (t.y + 3)) < 1e-9 && s.x1 > t.x + 126 && s.x2 < p.tuiles[1].x);
  assert.equal(surLaLigne.length, 1);
});

test('textes et barre de contrôle : dans la zone imprimable, sans toucher fonds perdus, repères ni autres textes', () => {
  for (const format of ['A3', 'A4']) {
    for (const p of E.calepiner(doc20(), { format })) {
      const boites = p.textes.map(t => ({ t, b: E.boiteTexte(t) })).map(o => ({ x0: o.b.x0, y0: o.b.y0, x1: o.b.x1, y1: o.b.y1, texte: o.t.texte }));
      boites.push(Object.assign({ texte: 'barre' }, (() => { const b = E.boiteBarre(p.barre); return { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }; })()));
      const fonds = p.tuiles.map(t => ({ x0: t.x, y0: t.y, x1: t.x + 126, y1: t.y + 126 }));
      boites.forEach((b, i) => {
        assert.ok(b.x0 >= 5 && b.y0 >= 5 && b.x1 <= p.largeur - 5 && b.y1 <= p.hauteur - 5, 'zone imprimable : ' + b.texte);
        fonds.forEach(f => assert.ok(!boitesSeChevauchent(b, f), 'texte sur un fond perdu : ' + b.texte));
        p.reperes.forEach(s => assert.ok(!segmentDansRect(s, { x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 }, 0.25), 'texte sur un repère : ' + b.texte));
        boites.slice(i + 1).forEach(c => assert.ok(!boitesSeChevauchent(b, c), 'textes qui se chevauchent : ' + b.texte + ' / ' + c.texte));
      });
      assert.ok(p.barre.longueur === 100);
    }
  }
});

/* ------------------------------------------------------------------ */
/* SVG                                                                 */
/* ------------------------------------------------------------------ */

test('SVG de planche A3 : dimensions en mm, viewBox, balises équilibrées, une découpe par tuile', () => {
  const doc = doc20(), [p] = E.calepiner(doc, { format: 'A3' });
  const svg = E.svgPlanche(doc, p);
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="297mm" height="420mm" viewBox="0 0 297 420">/);
  equilibre(svg);
  assert.equal((svg.match(/<clipPath /g) || []).length, 6);
  assert.equal((svg.match(/clip-path="url\(#pm-clip-\d+\)"/g) || []).length, 6);
  assert.match(svg, /<rect x="-3" y="-3" width="126" height="126"\/>/);
  assert.match(svg, /<g transform="translate\(22\.5 18\)"/);
  // dessin des tuiles confié à PM.rendu : on retrouve exactement son contenu
  const m = M.modeleParId(doc, p.tuiles[0].modeleId);
  assert.ok(svg.includes(R.contenuTuile(m, { rot: 0, joueur: p.tuiles[0].joueur, fondPerdu: 3, contour: false })));
  assert.equal((svg.match(/<line /g) || []).length, p.reperes.length + 12); // repères + barre (trait + 11 graduations)
  assert.match(E.svgPlanche(doc, E.calepiner(doc, { format: 'A4' })[0]), /width="210mm" height="297mm" viewBox="0 0 210 297"/);
});

test('SVG de la planche des jetons : 7 villes au pas de 38 mm, ville = disque noir de 33 mm', () => {
  const svg = E.svgJetons();
  assert.match(svg, /width="210mm" height="297mm" viewBox="0 0 210 297"/);
  equilibre(svg);
  const p = E.planchesJetons();
  assert.equal(p.jetons.length, 7);
  assert.ok(p.jetons.every(j => j.type === 'capture'));
  assert.match(p.titre, /7 villes\)$/);
  assert.equal((svg.match(/<circle [^>]*r="15" fill="none"/g) || []).length, 7, 'cercle de coupe par jeton');
  assert.ok(Math.abs(p.jetons[1].cx - p.jetons[0].cx - 38) < 1e-9);
  assert.ok(Math.abs(p.jetons[5].cy - p.jetons[0].cy - 38) < 1e-9);
  assert.equal((svg.match(/r="16\.5"/g) || []).length, 7);
  assert.ok(svg.includes(R.contenuJeton('capture', p.jetons[0].cx, p.jetons[0].cy)));
  // chaque jeton, fond perdu compris, tient dans la zone imprimable
  p.jetons.forEach(j => assert.ok(j.cx - 16.5 >= 5 && j.cx + 16.5 <= 205 && j.cy + 16.5 <= 292));
});

test('SVG de l\'aperçu : A3, marqué non imprimable, sans repères de coupe', () => {
  const doc = docAvec([5, 5, 5]);
  const svg = E.svgApercuPlateau(M.poserTuile(doc, doc.modeles[0].id, 1, 1));
  assert.match(svg, /width="297mm" height="420mm" viewBox="0 0 297 420"/);
  equilibre(svg);
  assert.match(svg, /Aperçu, non imprimable/);
  assert.equal((svg.match(/<line /g) || []).length, 0);
});

test('absence d\'injection : un nom ou un identifiant de modèle hostile est neutralisé', () => {
  const doc = docAvec([1, 1, 1, 1]);
  const hostile = '<script>alert(1)</script>"&';
  doc.modeles[0].id = hostile; doc.modeles[0].nom = hostile;
  const svg = E.svgPlanche(doc, E.calepiner(doc, { format: 'A3' })[0]);
  assert.ok(!svg.includes('<script'), 'balise script');
  assert.ok(svg.includes('&lt;script&gt;'));
  equilibre(svg);
  // le PDF sait aussi les écrire
  const pdf = texte(E.pdfDepuisPlanches([{ svg }]));
  assert.ok(pdf.includes('alert\\(1\\)'), 'parenthèses échappées dans le PDF');
  assert.ok(!svg.includes('"<script'));
  assert.ok(!E.svgApercuPlateau(doc).includes('<script'));
});

test('PNG : dimensions à 300 dpi', () => {
  const [a3] = E.calepiner(doc20(), { format: 'A3' }), [a4] = E.calepiner(doc20(), { format: 'A4' });
  assert.deepEqual(E.pngDims(a3), { largeurPx: 3508, hauteurPx: 4961 });
  assert.deepEqual(E.pngDims(a4), { largeurPx: 2480, hauteurPx: 3508 });
});

/* ------------------------------------------------------------------ */
/* PDF                                                                 */
/* ------------------------------------------------------------------ */

/** Analyse minimale d'un PDF : vérifie en-tête, xref, trailer, startxref, Length. Renvoie les objets. */
function analyserPdf(octets) {
  const s = texte(octets);
  assert.ok(s.startsWith('%PDF-1.4\n'), 'en-tête');
  assert.ok(s.endsWith('%%EOF\n'), 'fin');
  const debut = s.lastIndexOf('startxref\n');
  const posXref = parseInt(s.slice(debut + 10), 10);
  assert.equal(s.substr(posXref, 5), 'xref\n', 'startxref pointe sur xref');
  const m = /^xref\n0 (\d+)\n/.exec(s.slice(posXref));
  const n = parseInt(m[1], 10);
  const tete = posXref + m[0].length;
  assert.equal(s.substr(tete, 20), '0000000000 65535 f \n');
  const objets = {};
  for (let i = 1; i < n; i++) {
    const entree = s.substr(tete + 20 * i, 20);
    assert.match(entree, /^\d{10} 00000 n \n$/, 'entrée xref de 20 octets');
    const dec = parseInt(entree.slice(0, 10), 10);
    assert.ok(s.substr(dec).startsWith(i + ' 0 obj\n'), 'décalage de l\'objet ' + i);
    const fin = s.indexOf('endobj\n', dec);
    objets[i] = s.slice(dec, fin);
  }
  assert.ok(s.includes('trailer\n<< /Size ' + n + ' /Root 1 0 R >>'));
  // /Length exact
  for (const o of Object.values(objets)) {
    const l = /\/Length (\d+) >>\nstream\n/.exec(o);
    if (l) {
      const flux = o.slice(o.indexOf('stream\n') + 7, o.lastIndexOf('endstream'));
      assert.equal(flux.length, parseInt(l[1], 10), 'Length du flux');
    }
  }
  return { texte: s, objets, n };
}

test('PDF A3 : en-tête, xref aux bons décalages, trailer, %%EOF, MediaBox 841,89 x 1190,55 pt', () => {
  const doc = doc20(), planches = E.calepiner(doc, { format: 'A3' });
  const pdf = E.pdfDepuisPlanches(planches, doc);
  assert.ok(pdf instanceof Uint8Array);
  const a = analyserPdf(pdf);
  assert.equal(a.n, 1 + 4 + 2 * 4);
  assert.equal((a.texte.match(/\/MediaBox \[0 0 841\.89 1190\.55\]/g) || []).length, 4);
  assert.match(a.texte, /\/Count 4/);
  assert.match(a.texte, /\/BaseFont \/Helvetica /);
  // échelle exacte : 1 mm = 72 / 25,4 pt
  assert.match(a.texte, /2\.8346457 0 0 -2\.8346457 0 1190\.55 cm/);
});

test('pdfDepuisPlanches(calepiner(doc)) fonctionne avec un seul argument', () => {
  const doc = doc20();
  analyserPdf(E.pdfDepuisPlanches(E.calepiner(doc, { format: 'A4' })));
});

test('PDF A4 : MediaBox 595,28 x 841,89 pt ; planche mixte (tuiles, jetons, aperçu)', () => {
  const doc = doc20();
  const a4 = analyserPdf(E.pdfDepuisPlanches(E.calepiner(doc, { format: 'A4' }).slice(0, 1), doc));
  assert.match(a4.texte, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  const mixte = analyserPdf(E.pdfDepuisPlanches([
    E.calepiner(doc, { format: 'A3' })[0], { svg: E.svgJetons() }, { svg: E.svgApercuPlateau(doc) }], doc));
  assert.equal((mixte.texte.match(/\/Type \/Page /g) || []).length, 3);
});

test('PDF : opérateurs vectoriels, aucun nombre exponentiel, texte en WinAnsi', () => {
  const doc = doc20(), p = E.calepiner(doc, { format: 'A3' })[0];
  const t = analyserPdf(E.pdfDepuisPlanches([p, { svg: E.svgJetons() }, { svg: E.svgApercuPlateau(doc) }], doc)).texte;
  for (const op of [' m\n', ' l\n', ' c\n', ' re\n', '\nh\n', ' W n', ' rg', ' RG', ' w ', ' Tf ', ' Tj ']) assert.ok(t.includes(op), 'opérateur ' + op);
  assert.ok(/\nB Q/.test(t) || /\nS Q/.test(t) || /\nf Q/.test(t));
  assert.ok(!/\d[eE][-+]?\d/.test(t.replace(/\/[A-Za-z]+/g, '')), 'notation exponentielle');
  assert.ok(t.includes('Aper\\347u, non imprimable'), 'ç codé en octal WinAnsi');
});

test('PDF : la conversion couvre tout le SVG de rendu (exemples des 3 gabarits, apparitions, quarts de jonction)', () => {
  const doc = doc20();
  const p = E.calepiner(doc, { format: 'A3' })[1]; // centrales et bords
  const svg = E.svgPlanche(doc, p);
  const { flux } = E.svgVersFlux(svg);
  // l'écran (camp rouge, en tirets ou triangle) passe aussi dans la conversion
  assert.doesNotThrow(() => E.svgVersFlux('<svg xmlns="http://www.w3.org/2000/svg" width="120mm" height="120mm" viewBox="0 0 120 120">' +
    R.contenuTuile(doc.modeles[1], { camp: 'neutre' }) + R.contenuTuile(doc.modeles[1], { camp: 'rouge' }) + '</svg>'));
  // autant de découpes que de tuiles
  assert.equal((flux.match(/ W n/g) || []).length, p.tuiles.length);
  // q / Q équilibrés
  assert.equal((flux.match(/\bq\b/g) || []).length, (flux.match(/\bQ\b/g) || []).length);
});

test('PDF : un élément SVG inconnu lève une erreur (rien ne disparaît en silence)', () => {
  const entete = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10">';
  assert.throws(() => E.svgVersFlux(entete + '<polygon points="0,0 1,1 2,0"/></svg>'), /non pris en charge/);
  assert.throws(() => E.svgVersFlux(entete + '<path d="M0 0 A1 1 0 0 1 2 2"/></svg>'), /non prise en charge/);
  assert.throws(() => E.svgVersFlux(entete + '<g transform="rotate(10)"></g></svg>'), /non prise en charge/);
  assert.throws(() => E.svgVersFlux(entete + '<rect x="0" y="0" width="1" height="1" fill="rgb(1,2,3)"/></svg>'), /Couleur/);
  assert.throws(() => E.pdfDepuisPlanches([]), /Aucune planche/);
  assert.throws(() => E.svgVersFlux(entete + '<g></svg>'), /inattendue|non fermée/);
});

test('PDF : chemins M L H V Z du jeton et rectangles arrondis', () => {
  const entete = '<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10">';
  const { flux } = E.svgVersFlux(entete + '<path d="M1 2 H5 V7 L2 3 Z" fill="#FFFFFF"/><rect x="1" y="1" width="4" height="4" rx="1" stroke="#111111"/></svg>');
  assert.ok(flux.includes('1 2 m\n5 2 l\n5 7 l\n2 3 l\nh'));
  assert.ok(flux.includes(' c\n')); // coins arrondis en courbes de Bézier
});

/* ------------------------------------------------------------------ */
/* PNG : chunk pHYs                                                    */
/* ------------------------------------------------------------------ */

/** PNG 1x1 minimal valide (construit à la main avec zlib). */
function pngMinimal(avecPhys) {
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'latin1'), len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const phys = Buffer.alloc(9); phys.writeUInt32BE(2835, 0); phys.writeUInt32BE(2835, 4); phys[8] = 1;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), avecPhys ? chunk('pHYs', phys) : Buffer.alloc(0),
    chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))), chunk('IEND', Buffer.alloc(0))]));
}
function chunks(octets) {
  const b = Buffer.from(octets), res = [];
  for (let pos = 8; pos < b.length;) {
    const len = b.readUInt32BE(pos), type = b.toString('latin1', pos + 4, pos + 8);
    const donnees = b.subarray(pos + 8, pos + 8 + len);
    assert.equal(b.readUInt32BE(pos + 8 + len), zlib.crc32(b.subarray(pos + 4, pos + 8 + len)), 'CRC de ' + type);
    res.push({ type, donnees }); pos += 12 + len;
  }
  return res;
}

test('PNG : CRC32 identique à zlib, pHYs 11811 px/m inséré après IHDR (et remplacé s\'il existe)', () => {
  const x = new Uint8Array([1, 2, 3, 250, 0, 77]);
  assert.equal(E.crc32(x, 0, x.length), zlib.crc32(Buffer.from(x)));
  for (const avec of [false, true]) {
    const ch = chunks(E.ajouterPhys(pngMinimal(avec), 11811));
    assert.deepEqual(ch.map(c => c.type), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
    const d = ch[1].donnees;
    assert.equal(d.readUInt32BE(0), 11811); assert.equal(d.readUInt32BE(4), 11811); assert.equal(d[8], 1);
  }
  assert.throws(() => E.ajouterPhys(new Uint8Array(40)), /PNG/);
});

/* ------------------------------------------------------------------ */
/* Sorties                                                             */
/* ------------------------------------------------------------------ */

test('preparerSorties : planches, jetons, aperçu ; rien de coché = aucune feuille', () => {
  const doc = doc20();
  const s = E.preparerSorties(doc, { format: 'A3', jetons: true, apercu: true });
  assert.ok(s.feuilles.find(f => f.type === 'apercu').svg.includes('Aperçu'));
  assert.deepEqual(s.feuilles.map(f => f.nom), ['plateau-tuiles-A3-1', 'plateau-tuiles-A3-2', 'plateau-tuiles-A3-3', 'plateau-tuiles-A3-4', 'plateau-jetons-A4', 'plateau-apercu-A3']);
  assert.equal(s.nbTuiles, 20);
  assert.equal(E.preparerSorties(doc, { tuiles: false }).feuilles.length, 0);
  assert.equal(E.preparerSorties(doc, { portee: 'posees' }).feuilles.length, 0); // rien de posé
});

test('le catalogue réel (comptes globaux) : 24 tuiles, 4 planches A3, 12 planches A4, conversion PDF complète', () => {
  require('../src/catalogue.js');
  const doc = PM.catalogue.nouveauDocument();
  assert.equal(E.listeTuiles(doc, {}).tuiles.length, 24);
  assert.equal(E.calepiner(doc, { format: 'A3' }).length, 4);
  assert.equal(E.calepiner(doc, { format: 'A4' }).length, 12);
  const pdf = E.pdfDepuisPlanches(E.calepiner(doc, { format: 'A3' }), doc);
  analyserPdf(pdf);
});

test('découpe : un texte contenant %%CLIP:zz%% est imprimé tel quel (aucun remplacement dans les textes)', () => {
  // conversion directe : le texte piège ne doit ni échouer ni être remplacé
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100mm" height="100mm" viewBox="0 0 100 100">' +
    '<g clip-path="url(#c1)"><clipPath id="c1"><rect x="0" y="0" width="10" height="10"/></clipPath>' +
    '<text x="1" y="5" font-size="3">%%CLIP:zz%% et %%CLIP:c1%%</text></g></svg>';
  const f = E.svgVersFlux(svg);
  assert.ok(f.flux.includes('(%%CLIP:zz%% et %%CLIP:c1%%) Tj'));
  assert.equal((f.flux.match(/ W n/g) || []).length, 1);
  // identifiant de modèle piégé, imprimé dans la marge d'une planche
  const doc = doc20();
  doc.modeles[0].id = 'X%%CLIP:zz%%';
  assert.ok(M.validerModele(doc.modeles[0]).complet, 'le modèle piégé reste exportable');
  const planches = E.calepiner(doc, {});
  const pdf = texte(E.pdfDepuisPlanches(planches, doc));
  assert.ok(pdf.includes('(X%%CLIP:zz%%-1) Tj'));
  // une découpe absente reste une erreur
  assert.throws(() => E.svgVersFlux(svg.replace('id="c1"', 'id="c2"')), /clipPath introuvable : c1/);
});

test('plafond : plus de 200 tuiles au total dans le stock, export refusé avec un message clair ; « posées » non concerné', () => {
  const trop = docAvec([67, 67, 67]); // 201
  assert.throws(() => E.listeTuiles(trop, {}), /201 tuiles.*200 au plus/);
  assert.throws(() => E.preparerSorties(trop, {}), /200 au plus/);
  assert.equal(E.listeTuiles(docAvec([67, 67, 66]), {}).tuiles.length, 200);
  assert.doesNotThrow(() => E.listeTuiles(trop, { portee: 'posees' }));
  // exemplaires invalides lus comme 0 (lecture commune PM.modele.exemplairesValides)
  assert.equal(E.listeTuiles(docAvec([2.5, -1, 2]), {}).tuiles.length, 2);
});

test('export « posées » : une tuile au modèle introuvable est signalée dans exclus', () => {
  let doc = doc20();
  doc = M.poserTuile(doc, doc.modeles[0].id, 1, 1);
  doc = M.poserTuile(doc, doc.modeles[0].id, 2, 1);
  doc.plateau.tuiles[1].modeleId = 'fantome';
  const r = E.listeTuiles(doc, { portee: 'posees' });
  assert.equal(r.tuiles.length, 1);
  assert.deepEqual(r.exclus, [{ id: 'fantome', nom: 'fantome', raison: 'introuvable' }]);
  assert.deepEqual(E.listeTuiles(doc, {}).exclus, []); // portée « stock » : rien à signaler
});

test('aperçu du plateau refusé si le plateau complet est très déséquilibré (le critère est nommé) ; accepté sinon', () => {
  require('../src/graphe.js');
  const A = require('./aides-v2.js');
  const des = A.plateauDesequilibre();
  assert.throws(() => E.preparerSorties(des, { tuiles: false, apercu: true }), /Aperçu du plateau refusé : plateau très déséquilibré \(.*5 contre 2/);
  // les planches de tuiles restent exportables
  assert.ok(E.preparerSorties(des, { apercu: false }).feuilles.length > 0);
  assert.equal(E.preparerSorties(A.plateauComplet('4x4', true), { tuiles: false, apercu: true }).feuilles.length, 1);
  // plateau incomplet : pas de mesure, aperçu accepté
  assert.equal(E.preparerSorties(M.retirerTuile(des, 1, 1), { tuiles: false, apercu: true }).feuilles.length, 1);
});
