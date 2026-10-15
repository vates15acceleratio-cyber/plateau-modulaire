'use strict';
/*
 * Recette des modules de priorité 2 et de l'export (testeur, sous-agent 9).
 * Référence : la documentation (docs/14-export.md, 6-avis-prepresse.md, 16-avis-mesures-equilibre.md,
 * 12-mesures-equilibre.md, 15-mesures-generateur.md, 1b-... D7, 10-contrats-interface.md), pas les tests existants.
 *
 * Les contrôles du PDF utilisent PyMuPDF (Python) par un sous-processus ; ils sont ignorés si Python ou
 * PyMuPDF est absent. Les fichiers intermédiaires sont écrits dans le dossier temporaire du système.
 * Les scénarios qui exigent un navigateur (boîtes de dialogue, Ctrl+Z, PNG) sont dans outils/recette-p2.html.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');

const SRC = path.join(__dirname, '..', 'src');
['geometrie', 'modele', 'catalogue', 'rendu', 'graphe', 'equilibre', 'generateur', 'export', 'controles']
  .forEach((m) => require(path.join(SRC, m + '.js')));
const PM = globalThis.PM;
const M = PM.modele, E = PM.exportation, GR = PM.graphe, GEN = PM.generateur, CT = PM.controles;

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const clone = (o) => JSON.parse(JSON.stringify(o));
const docCatalogue = () => PM.catalogue.nouveauDocument();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-recette-p2-'));

function pythonDispo() {
  const r = spawnSync('python', ['-I', '-c', 'import pymupdf'], { encoding: 'utf8' });
  return r.status === 0;
}
const PYMUPDF = pythonDispo();
const SANS_PYMUPDF = PYMUPDF ? false : 'Python / PyMuPDF indisponible';

function python(script, args) {
  const r = spawnSync('python', ['-I', '-X', 'utf8', '-c', script].concat(args), { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error('python : ' + r.stderr);
  return JSON.parse(r.stdout);
}

/** Analyse d'un PDF par PyMuPDF : pages, tailles (mm), texte, échelle, rendu et contenu des tuiles. */
const PY_PDF = `
import sys, json, pymupdf
pdf, sortie, params = sys.argv[1], sys.argv[2], json.loads(sys.argv[3])
d = pymupdf.open(pdf)
pymupdf.TOOLS.mupdf_warnings()
res = {'n': len(d), 'reparé': d.is_repaired, 'tailles': [], 'textes': [], 'images': [], 'lignes100': [], 'dessins': [], 'tuiles': [], 'marges': []}
K = 72 / 25.4
for k, p in enumerate(d):
    res['tailles'].append([round(p.rect.width / K, 2), round(p.rect.height / K, 2)])
    res['textes'].append(p.get_text())
    res['images'].append(len(p.get_images()))
    dr = p.get_drawings()
    res['dessins'].append(len(dr))
    n100 = 0
    for it in dr:
        for item in it['items']:
            if item[0] == 'l':
                a, b = item[1], item[2]
                if abs(a.y - b.y) < 0.01 and abs(abs(a.x - b.x) - 100 * K) < 0.05:
                    n100 += 1
    res['lignes100'].append(n100)
    if k < len(params['pages']):
        pix = p.get_pixmap(dpi=params['dpi'])
        if k == 0 and params.get('png'):
            pix.save(params['png'])
        s, W, H, n = pix.samples, pix.width, pix.height, pix.n
        px = params['dpi'] / 25.4
        def pixel(x, y):
            o = (y * W + x) * n
            return s[o], s[o + 1], s[o + 2]
        def zone(x0, y0, x1, y1):
            nonblanc = vert = rouge = tot = 0
            for y in range(max(0, int(y0 * px)), min(H, int(y1 * px))):
                for x in range(max(0, int(x0 * px)), min(W, int(x1 * px))):
                    r, g, b = pixel(x, y)
                    tot += 1
                    if r < 235 or g < 235 or b < 235:
                        nonblanc += 1
                    if r < 60 and 90 < g < 160 and 40 < b < 120:
                        vert += 1
                    if r > 180 and g < 100 and b < 80:
                        rouge += 1
            return {'total': tot, 'nonblanc': nonblanc, 'vert': vert, 'rouge': rouge}
        res['tuiles'].append([zone(x + 3, y + 3, x + 123, y + 123) for (x, y) in params['pages'][k]])
        L, Ht = p.rect.width / K, p.rect.height / K
        e = params.get('bord', 5)
        res['marges'].append([zone(0, 0, e, Ht)['nonblanc'], zone(L - e, 0, L, Ht)['nonblanc'], zone(0, 0, L, e)['nonblanc'], zone(0, Ht - e, L, Ht)['nonblanc']])
res['avertissements'] = pymupdf.TOOLS.mupdf_warnings()
print(json.dumps(res))
`;

function analysePdf(octets, nom, planches, opts) {
  const fichier = path.join(TMP, nom + '.pdf');
  fs.writeFileSync(fichier, Buffer.from(octets));
  const params = {
    dpi: (opts && opts.dpi) || 40,
    png: opts && opts.png ? opts.png : null,
    pages: (planches || []).map((p) => (p.tuiles || []).map((t) => [t.x, t.y]))
  };
  return python(PY_PDF, [fichier, TMP, JSON.stringify(params)]);
}

/** SVG : bien formé (analyseur XML de Python), renvoie racine et nombre d'éléments par nom. */
const PY_XML = `
import sys, json
import xml.etree.ElementTree as ET
sortie = []
for f in sys.argv[1:]:
    try:
        racine = ET.parse(f).getroot()
        noms = {}
        for e in racine.iter():
            n = e.tag.split('}')[-1]
            noms[n] = noms.get(n, 0) + 1
        on = [a for e in racine.iter() for a in e.attrib if a.lower().startswith('on')]
        sortie.append({'ok': True, 'racine': racine.tag.split('}')[-1], 'width': racine.get('width'), 'height': racine.get('height'), 'viewBox': racine.get('viewBox'), 'noms': noms, 'on': on})
    except Exception as ex:
        sortie.append({'ok': False, 'erreur': str(ex)})
print(json.dumps(sortie))
`;
function analyseXml(svgs, prefixe) {
  const fichiers = svgs.map((s, k) => { const f = path.join(TMP, prefixe + k + '.svg'); fs.writeFileSync(f, s, 'utf8'); return f; });
  return python(PY_XML, fichiers);
}

const boite126 = (t) => ({ x0: t.x, y0: t.y, x1: t.x + E.COTE_PLANCHE, y1: t.y + E.COTE_PLANCHE });
const chevauche = (a, b) => a.x0 < b.x1 - 1e-9 && a.x1 > b.x0 + 1e-9 && a.y0 < b.y1 - 1e-9 && a.y1 > b.y0 + 1e-9;
function boiteSegment(s, e) {
  return { x0: Math.min(s.x1, s.x2) - e / 2, y0: Math.min(s.y1, s.y2) - e / 2, x1: Math.max(s.x1, s.x2) + e / 2, y1: Math.max(s.y1, s.y2) + e / 2 };
}

/** Renomme la première case et le premier chemin du modèle avec des identifiants hostiles, en gardant les références. */
function hostiliserCases(m) {
  const ancien = m.cases[0].id, nouveau = '"/><script>alert(2)</script>';
  m.cases[0].id = nouveau;
  m.chemins.forEach((c) => { ['a', 'b'].forEach((k) => { if (c[k] && c[k].case === ancien) c[k].case = nouveau; }); });
  m.chemins[0].id = '" onload="alert(3)';
}

/** Bibliothèque modifiée : exemplaires changés, un modèle incomplet, un nom hostile. */
function docModifie() {
  const doc = docCatalogue();
  doc.modeles.find((m) => m.id === 'C1').exemplaires = 3;
  doc.modeles.find((m) => m.id === 'K1').exemplaires = 0;
  doc.modeles.find((m) => m.id === 'B1').exemplaires = 2;
  const inc = doc.modeles.find((m) => m.id === 'C3');
  inc.cases = []; // incomplet (brouillon)
  return doc;
}

/* Plateaux générés, calculés une fois. */
const CACHE = {};
function plateau(graine, options) {
  const cle = graine + '|' + JSON.stringify(options || {});
  if (!CACHE[cle]) {
    const r = GEN.generer(docCatalogue(), Object.assign({ graine, candidats: 60 }, options || {}));
    assert.ok(r.ok, r.raison);
    CACHE[cle] = r;
  }
  return CACHE[cle];
}

/* ================================================================== */
/* 1. EXPORT                                                           */
/* ================================================================== */

test('export : catalogue en A3 = 4 planches (6, 6, 6, 2) de 297 x 420 ; en A4 = 10 planches de 2, 210 x 297', () => {
  const doc = docCatalogue();
  const a3 = E.calepiner(doc, { format: 'A3' }), a4 = E.calepiner(doc, { format: 'A4' });
  assert.deepStrictEqual(a3.map((p) => p.tuiles.length), [6, 6, 6, 2]);
  assert.ok(a3.every((p) => p.largeur === 297 && p.hauteur === 420));
  assert.strictEqual(a4.length, 10);
  assert.ok(a4.every((p) => p.tuiles.length === 2 && p.largeur === 210 && p.hauteur === 297));
  // 20 tuiles du catalogue : 18 modèles, A1 et A2 en deux exemplaires
  const total = (ps) => ps.reduce((s, p) => s + p.tuiles.length, 0);
  assert.strictEqual(total(a3), 20);
  assert.strictEqual(total(a4), 20);
});

test('export : planche A3, une planche A4 ; marges, pas et gouttière du doc 6 (126 mm + 6 mm, marges >= 15 mm)', () => {
  assert.strictEqual(E.COTE_PLANCHE, 126);
  assert.strictEqual(E.GOUTTIERE, 6);
  assert.strictEqual(E.FOND_PERDU, 3);
  assert.strictEqual(E.PAS, 132);
  const m3 = E.margesFormat('A3'), m4 = E.margesFormat('A4');
  assert.ok(Math.abs(m3.x - 19.5) < 1e-9 && Math.abs(m3.y - 15) < 1e-9);
  assert.ok(m4.x >= 15 && m4.y >= 15);
});

for (const format of ['A3', 'A4']) {
  test('export ' + format + ' : tout tient dans la feuille avec les marges, sans chevauchement, gouttières de 6 mm', () => {
    for (const doc of [docCatalogue(), docModifie()]) {
      for (const p of E.calepiner(doc, { format })) {
        const boites = p.tuiles.map(boite126);
        boites.forEach((b) => {
          assert.ok(b.x0 >= 15 - 1e-9 && b.y0 >= 15 - 1e-9, 'marge haute / gauche < 15 mm');
          assert.ok(p.largeur - b.x1 >= 15 - 1e-9 && p.hauteur - b.y1 >= 15 - 1e-9, 'marge basse / droite < 15 mm');
        });
        for (let a = 0; a < boites.length; a++) for (let b = a + 1; b < boites.length; b++) assert.ok(!chevauche(boites[a], boites[b]));
        // gouttières
        const xs = [...new Set(p.tuiles.map((t) => t.x))].sort((u, v) => u - v);
        const ys = [...new Set(p.tuiles.map((t) => t.y))].sort((u, v) => u - v);
        for (let k = 1; k < xs.length; k++) assert.ok(Math.abs(xs[k] - xs[k - 1] - 132) < 1e-9);
        for (let k = 1; k < ys.length; k++) assert.ok(Math.abs(ys[k] - ys[k - 1] - 132) < 1e-9);
        // texte, barre : dans la feuille, hors des tuiles (fond perdu compris)
        p.textes.forEach((t) => {
          const b = E.boiteTexte(t);
          assert.ok(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= p.largeur && b.y1 <= p.hauteur, 'texte hors feuille : ' + t.texte);
          boites.forEach((bt) => assert.ok(!chevauche(b, bt), 'texte sur une tuile : ' + t.texte));
        });
        const bb = E.boiteBarre(p.barre);
        assert.ok(bb.x0 >= 0 && bb.x1 <= p.largeur && bb.y1 <= p.hauteur);
        boites.forEach((bt) => assert.ok(!chevauche(bb, bt), 'barre de contrôle sur une tuile'));
        assert.strictEqual(p.barre.longueur, 100);
      }
    }
  });

  test('export ' + format + ' : repères de coupe hors fond perdu, jamais dans les tuiles, 2 traits par coin de coupe', () => {
    for (const doc of [docCatalogue(), docModifie()]) {
      for (const p of E.calepiner(doc, { format })) {
        const boites = p.tuiles.map(boite126);
        p.reperes.forEach((s) => {
          const b = boiteSegment(s, 0.25);
          boites.forEach((bt) => assert.ok(!chevauche(b, bt), 'repère dans un fond perdu : ' + JSON.stringify(s)));
          // dans la feuille et dans la zone imprimable (5 mm)
          assert.ok(b.x0 >= 5 && b.y0 >= 5 && b.x1 <= p.largeur - 5 && b.y1 <= p.hauteur - 5, 'repère hors zone imprimable : ' + JSON.stringify(s));
          const l = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
          assert.ok(l <= 5 + 1e-9 && l >= 4 - 1e-9, 'longueur de repère inattendue ' + l);
        });
        // chaque coin de coupe : un trait horizontal et un trait vertical alignés sur la ligne de coupe
        p.tuiles.forEach((t) => {
          [3, 123].forEach((dx) => [3, 123].forEach((dy) => {
            const cx = t.x + dx, cy = t.y + dy;
            const hori = p.reperes.some((s) => Math.abs(s.y1 - cy) < 1e-6 && Math.abs(s.y2 - cy) < 1e-6 &&
              Math.min(s.x1, s.x2) <= (dx === 3 ? cx - 3 + 1e-6 : cx + 6) && Math.max(s.x1, s.x2) >= (dx === 3 ? cx - 6 : cx + 3 - 1e-6));
            const vert = p.reperes.some((s) => Math.abs(s.x1 - cx) < 1e-6 && Math.abs(s.x2 - cx) < 1e-6 &&
              Math.min(s.y1, s.y2) <= (dy === 3 ? cy - 3 + 1e-6 : cy + 6) && Math.max(s.y1, s.y2) >= (dy === 3 ? cy - 6 : cy + 3 - 1e-6));
            assert.ok(hori && vert, 'coin de coupe sans repère : ' + format + ' tuile ' + t.etiquette + ' (' + dx + ',' + dy + ')');
          }));
        });
      }
    }
  });
}

test('export : bibliothèque modifiée, exemplaires pris en compte, modèle incomplet exclu et signalé', () => {
  const doc = docModifie();
  const liste = E.listeTuiles(doc);
  assert.deepStrictEqual(liste.exclus.map((x) => x.id), ['C3']);
  assert.ok(!liste.tuiles.some((t) => t.modeleId === 'C3'));
  const nb = (id) => liste.tuiles.filter((t) => t.modeleId === id).length;
  assert.strictEqual(nb('C1'), 3);
  assert.strictEqual(nb('K1'), 0);
  assert.strictEqual(nb('B1'), 2);
  assert.strictEqual(liste.tuiles.length, 20 - 1 /* C3 */ + 2 /* C1 */ - 1 /* K1 */ + 1 /* B1 */);
  const a3 = E.calepiner(doc, { format: 'A3' });
  assert.deepStrictEqual(a3.map((p) => p.tuiles.length), [6, 6, 6, 3]);
  // suffixe -n seulement pour les modèles à plusieurs exemplaires
  const etiq = a3.flatMap((p) => p.tuiles.map((t) => t.etiquette));
  assert.ok(etiq.includes('C1-1') && etiq.includes('C1-3') && etiq.includes('B1-2'));
  assert.ok(etiq.includes('C2') && !etiq.includes('C2-1'));
  assert.ok(!etiq.some((e) => e.startsWith('K1')));
  // signalé par preparerSorties (c'est ce que la boîte affiche)
  const sortie = E.preparerSorties(doc, { format: 'A3' });
  assert.deepStrictEqual(sortie.exclus.map((x) => x.id), ['C3']);
  assert.strictEqual(sortie.nbTuiles, liste.tuiles.length);
  assert.strictEqual(sortie.feuilles.length, 4);
});

test('export : tuiles posées d\'abord, portée « posées », apparitions réparties 2 pour J1 et 2 pour J2', () => {
  const r = plateau('export');
  const posees = E.listeTuiles(r.doc, { portee: 'posees' });
  assert.strictEqual(posees.tuiles.length, 16);
  assert.ok(posees.tuiles.every((t) => t.posee));
  assert.deepStrictEqual(E.calepiner(r.doc, { format: 'A3', portee: 'posees' }).map((p) => p.tuiles.length), [6, 6, 4]);
  const stock = E.listeTuiles(r.doc);
  const premieres = stock.tuiles.slice(0, 16);
  assert.ok(premieres.every((t) => t.posee) && stock.tuiles.slice(16).every((t) => !t.posee), 'posées d\'abord');
  const app = stock.tuiles.filter((t) => t.modeleId === 'A1' || t.modeleId === 'A2');
  assert.strictEqual(app.length, 4);
  assert.strictEqual(app.filter((t) => t.joueur === 1).length, 2);
  assert.strictEqual(app.filter((t) => t.joueur === 2).length, 2);
  // plateau vide : les 4 apparitions sont réparties quand même
  const vide = E.listeTuiles(docCatalogue()).tuiles.filter((t) => t.modeleId[0] === 'A');
  assert.strictEqual(vide.filter((t) => t.joueur === 1).length, 2);
  assert.strictEqual(vide.filter((t) => t.joueur === 2).length, 2);
});

test('export : étiquette longue (60 caractères) reste dans la feuille et ne rencontre ni tuile ni repère', () => {
  const doc = docCatalogue();
  const m = doc.modeles.find((x) => x.id === 'C1');
  m.id = 'ABCDEFGHIJ'.repeat(6);
  doc.plateau = { forme: { retires: [] }, tuiles: [], jetons: [] };
  for (const format of ['A3', 'A4']) {
    for (const p of E.calepiner(doc, { format })) {
      p.textes.forEach((t) => {
        const b = E.boiteTexte(t);
        assert.ok(b.x1 <= p.largeur - 5 && b.x0 >= 5, 'texte hors zone imprimable : ' + t.texte.slice(0, 20) + ' ' + b.x1);
        p.reperes.forEach((s) => assert.ok(!chevauche(b, boiteSegment(s, 0.25)), 'texte sur un repère : ' + t.texte.slice(0, 12)));
        p.tuiles.forEach((tu) => assert.ok(!chevauche(b, boite126(tu))));
      });
    }
  }
});

test('export : SVG bien formé (analyseur XML), taille en mm égale au viewBox, une tuile = un clipPath', { skip: SANS_PYMUPDF }, () => {
  const doc = docCatalogue();
  const sortie = E.preparerSorties(doc, { format: 'A3', jetons: true, apercu: true });
  assert.strictEqual(sortie.feuilles.length, 6);
  const analyses = analyseXml(sortie.feuilles.map((f) => f.svg), 'cat');
  analyses.forEach((a, k) => {
    assert.ok(a.ok, 'SVG mal formé (' + sortie.feuilles[k].nom + ') : ' + a.erreur);
    assert.strictEqual(a.racine, 'svg');
    const f = sortie.feuilles[k];
    assert.strictEqual(a.width, f.largeur + 'mm');
    assert.strictEqual(a.height, f.hauteur + 'mm');
    assert.strictEqual(a.viewBox, '0 0 ' + f.largeur + ' ' + f.hauteur);
    assert.deepStrictEqual(a.on, []);
    assert.ok(!a.noms.script && !a.noms.image && !a.noms.foreignObject);
    if (f.type === 'tuiles') assert.strictEqual(a.noms.clipPath, f.planche.tuiles.length);
  });
});

test('export : injection, nom et identifiants hostiles neutralisés dans le SVG', { skip: SANS_PYMUPDF }, () => {
  const doc = docCatalogue();
  const m = doc.modeles.find((x) => x.id === 'C1');
  m.id = '</text><script>alert(1)</script>"\'&lt;(a\\b)é';
  m.nom = '"><img src=x onerror=alert(1)>';
  hostiliserCases(m);
  const doc2 = clone(doc);
  doc2.modeles.find((x) => x.id === 'C2').cases = []; // incomplet, au nom hostile
  doc2.modeles.find((x) => x.id === 'C2').nom = '<svg onload=alert(4)>';
  // le modèle hostile reste complet : il est donc bien imprimé (sinon le test ne prouverait rien)
  assert.strictEqual(M.validerModele(doc2.modeles.find((x) => x.id === m.id)).complet, true, 'le modèle hostile doit rester complet');
  const sortie = E.preparerSorties(doc2, { format: 'A3', jetons: true });
  assert.ok(!sortie.exclus.some((x) => x.id === m.id), 'le modèle hostile ne doit pas être exclu');
  assert.deepStrictEqual(sortie.exclus.map((x) => x.id), ['C2']);
  const svgs = sortie.feuilles.map((f) => f.svg);
  // preuves positives : l'identifiant et les identifiants de case / de chemin sont présents, sous forme échappée
  const tout = svgs.join('\n');
  assert.ok(tout.includes('&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;'), 'identifiant du modèle échappé dans le texte');
  assert.ok(tout.includes('data-case="&quot;/&gt;&lt;script&gt;alert(2)&lt;/script&gt;"'), 'identifiant de case échappé (data-case)');
  assert.ok(tout.includes('data-chemin="&quot; onload=&quot;alert(3)"'), 'identifiant de chemin échappé (data-chemin)');
  svgs.forEach((s) => {
    assert.ok(!/<script/i.test(s) && !/<img/i.test(s), 'balise injectée');
    // (les attributs on* réellement créés sont comptés plus bas par l'analyseur XML : le texte « onload= » reste possible
    //  à l'intérieur d'une valeur d'attribut échappée)
  });
  analyseXml(svgs, 'hostile').forEach((a, k) => {
    assert.ok(a.ok, 'SVG hostile mal formé (' + k + ') : ' + a.erreur);
    assert.deepStrictEqual(a.on, [], 'attribut on* injecté');
    assert.ok(!a.noms.script && !a.noms.img);
  });
  assert.ok(sortie.exclus.some((x) => x.nom === '<svg onload=alert(4)>'), 'le nom brut est renvoyé tel quel (affiché par textContent)');
});

test('export : PNG, dimensions 300 dpi (A3 3508 x 4961, A4 2480 x 3508)', () => {
  const a3 = E.calepiner(docCatalogue(), { format: 'A3' })[0], a4 = E.calepiner(docCatalogue(), { format: 'A4' })[0];
  assert.deepStrictEqual(E.pngDims(a3), { largeurPx: 3508, hauteurPx: 4961 });
  assert.deepStrictEqual(E.pngDims(a4), { largeurPx: 2480, hauteurPx: 3508 });
});

/** PNG synthétique valide (1 pixel RVB), avec CRC. */
function pngMinimal(avecPhys) {
  const crcTable = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0; }
  const crc = (buf) => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'latin1'), l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(Buffer.concat([t, data])));
    return Buffer.concat([l, t, data, c]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr)];
  if (avecPhys) { const p = Buffer.alloc(9); p.writeUInt32BE(2835, 0); p.writeUInt32BE(2835, 4); p[8] = 1; parts.push(chunk('pHYs', p)); }
  parts.push(chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))), chunk('IEND', Buffer.alloc(0)));
  return { png: new Uint8Array(Buffer.concat(parts)), crc };
}

test('export : ajouterPhys écrit pHYs 11811 px/m (unité mètre) juste après IHDR, CRC valide, remplace un pHYs existant', () => {
  for (const avec of [false, true]) {
    const { png, crc } = pngMinimal(avec);
    const res = Buffer.from(E.ajouterPhys(png, 11811));
    assert.deepStrictEqual([...res.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    // parcours des chunks
    let pos = 8; const types = [];
    while (pos < res.length) {
      const len = res.readUInt32BE(pos), type = res.toString('latin1', pos + 4, pos + 8);
      const donnees = res.subarray(pos + 8, pos + 8 + len);
      assert.strictEqual(res.readUInt32BE(pos + 8 + len), crc(res.subarray(pos + 4, pos + 8 + len)), 'CRC du chunk ' + type);
      if (type === 'pHYs') {
        assert.strictEqual(donnees.readUInt32BE(0), 11811);
        assert.strictEqual(donnees.readUInt32BE(4), 11811);
        assert.strictEqual(donnees[8], 1);
      }
      types.push(type);
      pos += 12 + len;
    }
    assert.deepStrictEqual(types, ['IHDR', 'pHYs', 'IDAT', 'IEND']);
    // l'image reste décodable
    const idat = res.subarray(res.indexOf('IDAT') + 4, res.indexOf('IEND') - 8);
    assert.deepStrictEqual([...zlib.inflateSync(idat)], [0, 255, 0, 0]);
  }
  assert.throws(() => E.ajouterPhys(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34]), 11811));
  assert.throws(() => E.ajouterPhys(new Uint8Array([]), 11811));
});

test('export : PDF du catalogue en A3 valide et lisible (PyMuPDF) : 4 pages 297 x 420, texte, échelle 100 mm, vectoriel', { skip: SANS_PYMUPDF }, () => {
  const doc = docCatalogue();
  const planches = E.calepiner(doc, { format: 'A3' });
  const pdf = E.pdfDepuisPlanches(planches, doc);
  assert.strictEqual(Buffer.from(pdf.subarray(0, 9)).toString('latin1'), '%PDF-1.4\n');
  const png = process.env.PM_RECETTE_PNG || path.join(TMP, 'catalogue-A3-page1.png');
  const r = analysePdf(pdf, 'catalogue-A3', planches, { png, dpi: 60 });
  assert.strictEqual(r.n, 4);
  assert.strictEqual(r['reparé'], false, 'PDF réparé par MuPDF : table xref fausse');
  assert.strictEqual(r.avertissements, '', 'avertissements MuPDF : ' + r.avertissements);
  r.tailles.forEach((t) => { assert.ok(Math.abs(t[0] - 297) < 0.1 && Math.abs(t[1] - 420) < 0.1, 'taille ' + t); });
  const attendu = planches.map((p) => p.tuiles.map((t) => t.etiquette));
  attendu.forEach((ids, k) => {
    ids.forEach((id) => assert.ok(r.textes[k].split('\n').includes(id), 'identifiant ' + id + ' absent du texte de la page ' + (k + 1)));
    assert.ok(r.textes[k].includes('100 mm'), '« 100 mm » absent de la page ' + (k + 1));
    assert.ok(r.textes[k].includes('planche ' + (k + 1) + '/4'), 'titre de planche absent');
  });
  assert.ok(r.textes[0].includes('Plateau modulaire'));
  // chiffres 1 / 2 des apparitions
  assert.ok(r.textes[0].split('\n').includes('1') && r.textes[0].split('\n').includes('2'));
  // vectoriel : aucune image, des tracés, et une barre horizontale de 100 mm exacts
  assert.deepStrictEqual(r.images, [0, 0, 0, 0]);
  r.dessins.forEach((n) => assert.ok(n > 20, 'peu de tracés : ' + n));
  r.lignes100.forEach((n, k) => assert.ok(n >= 1, 'barre de 100 mm (283,46 pt) introuvable page ' + (k + 1)));
  // rendu : chaque tuile est présente et colorée, les 5 mm de bord sont blancs
  r.tuiles.forEach((tuiles, k) => {
    assert.strictEqual(tuiles.length, planches[k].tuiles.length);
    tuiles.forEach((z, j) => {
      assert.ok(z.nonblanc / z.total > 0.02, 'tuile vide au rendu : page ' + (k + 1) + ' tuile ' + attendu[k][j] + ' (' + (z.nonblanc / z.total) + ')');
      assert.ok(z.vert > 100, 'pas de vert (chemins) : ' + attendu[k][j]);
    });
    assert.deepStrictEqual(r.marges[k], [0, 0, 0, 0], 'pixels dans les 5 mm de bord, page ' + (k + 1));
  });
  // apparitions : la planche 1 porte A1-2 (J2) en rouge pointillé
  assert.ok(r.tuiles[0][1].rouge > 20, 'apparition J2 non rouge');
  assert.ok(fs.existsSync(png) && fs.statSync(png).size > 5000);
});

test('export : PDF A4 du catalogue (10 pages 210 x 297) et PDF de la bibliothèque modifiée (modèle incomplet absent)', { skip: SANS_PYMUPDF }, () => {
  const doc = docCatalogue();
  const p4 = E.calepiner(doc, { format: 'A4' });
  const r4 = analysePdf(E.pdfDepuisPlanches(p4, doc), 'catalogue-A4', p4);
  assert.strictEqual(r4.n, 10);
  assert.strictEqual(r4['reparé'], false);
  r4.tailles.forEach((t) => assert.ok(Math.abs(t[0] - 210) < 0.1 && Math.abs(t[1] - 297) < 0.1, 'taille ' + t));
  p4.forEach((p, k) => {
    p.tuiles.forEach((t) => assert.ok(r4.textes[k].split('\n').includes(t.etiquette)));
    assert.ok(r4.textes[k].includes('100 mm'));
  });
  r4.tuiles.forEach((tuiles, k) => {
    tuiles.forEach((z) => assert.ok(z.nonblanc / z.total > 0.02));
    assert.deepStrictEqual(r4.marges[k], [0, 0, 0, 0]);
  });
  const mod = docModifie();
  const pm = E.calepiner(mod, { format: 'A3' });
  const rm = analysePdf(E.pdfDepuisPlanches(pm, mod), 'modifie-A3', pm);
  assert.strictEqual(rm.n, 4);
  const texte = rm.textes.join('\n').split('\n');
  assert.ok(texte.includes('C1-3') && texte.includes('B1-2'));
  assert.ok(!texte.includes('C3') && !texte.some((t) => t.startsWith('K1')));
});

test('export : PDF des jetons (A4) et de l\'aperçu (A3) : tailles, texte, repères', { skip: SANS_PYMUPDF }, () => {
  const sortie = E.preparerSorties(plateau('export').doc, { tuiles: false, jetons: true, apercu: true });
  assert.strictEqual(sortie.feuilles.length, 2);
  const pdf = E.pdfDepuisPlanches(sortie.feuilles);
  const r = analysePdf(pdf, 'jetons-apercu', []);
  assert.strictEqual(r.n, 2);
  assert.strictEqual(r['reparé'], false);
  assert.ok(Math.abs(r.tailles[0][0] - 210) < 0.1 && Math.abs(r.tailles[0][1] - 297) < 0.1);
  assert.ok(Math.abs(r.tailles[1][0] - 297) < 0.1 && Math.abs(r.tailles[1][1] - 420) < 0.1);
  assert.ok(r.textes[0].includes('100 mm') && r.textes[0].includes('jetons'));
  assert.ok(r.textes[1].includes('non imprimable'), 'aperçu marqué « non imprimable »');
  assert.ok(r.textes[1].includes('réduit à 56'), 'texte accentué de l\'aperçu : ' + JSON.stringify(r.textes[1]));
  // jetons : 9 jetons dans la feuille, 7 + 2 (doc 6, 9 jetons de Ø 33 mm au pas de 38 mm)
  const j = E.planchesJetons();
  assert.strictEqual(j.jetons.length, 9);
  assert.strictEqual(j.jetons.filter((x) => x.type === 'capture').length, 7);
  assert.strictEqual(j.jetons.filter((x) => x.type === 'carrefour').length, 2);
  j.jetons.forEach((x) => assert.ok(x.cx - 16.5 >= 5 && x.cx + 16.5 <= 205 && x.cy - 16.5 >= 5 && x.cy + 16.5 <= 292, 'jeton hors feuille'));
  for (let a = 0; a < j.jetons.length; a++) for (let b = a + 1; b < j.jetons.length; b++) {
    const d = Math.hypot(j.jetons[a].cx - j.jetons[b].cx, j.jetons[a].cy - j.jetons[b].cy);
    assert.ok(d >= 33 - 1e-9, 'jetons qui se chevauchent');
  }
  assert.ok(Math.abs(j.rayonCoupe * 2 - 30) < 1e-9 && Math.abs(j.rayonFondPerdu * 2 - 33) < 1e-9);
});

test('export : injection, identifiants hostiles dans le PDF (échappement, texte relu tel quel, aucune action active)', { skip: SANS_PYMUPDF }, () => {
  const doc = docCatalogue();
  const m = doc.modeles.find((x) => x.id === 'C1');
  const hostile = '<script>alert(1)</script>"\'&lt;(a\\b)) \\) é';
  m.id = hostile;
  m.nom = '"><img src=x>';
  const planches = E.calepiner(doc, { format: 'A3' });
  const pdf = E.pdfDepuisPlanches(planches, doc);
  const brut = Buffer.from(pdf).toString('latin1');
  for (const interdit of ['/JS', '/JavaScript', '/OpenAction', '/URI', '/Launch', '/AA', '/EmbeddedFile']) {
    assert.ok(!brut.includes(interdit), 'PDF contenant ' + interdit);
  }
  const r = analysePdf(pdf, 'hostile', planches);
  assert.strictEqual(r['reparé'], false);
  assert.strictEqual(r.avertissements, '');
  assert.ok(r.textes[0].split('\n').includes(hostile), 'identifiant hostile relu : ' + JSON.stringify(r.textes[0].split('\n').slice(0, 3)));
  // les caractères hors Latin-1 sont remplacés (documenté) sans casser le document
  const doc2 = clone(doc);
  doc2.modeles.find((x) => x.id === hostile).id = 'X€日本';
  const p2 = E.calepiner(doc2, { format: 'A3' });
  const r2 = analysePdf(E.pdfDepuisPlanches(p2, doc2), 'unicode', p2);
  assert.strictEqual(r2['reparé'], false);
  assert.ok(r2.textes.join('\n').includes('X'), 'texte hors Latin-1 : ' + JSON.stringify(r2.textes.join('|').slice(-200)));
});

test('export : erreurs franches (liste vide, élément SVG inconnu, format inconnu), sans PDF tronqué', () => {
  assert.throws(() => E.pdfDepuisPlanches([]), /Aucune planche/);
  assert.throws(() => E.pdfDepuisPlanches([{ tuiles: [] }]), /SVG/);
  assert.throws(() => E.pdfDepuisPlanches(['<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><image href="x"/></svg>']), /non pris en charge/);
  assert.throws(() => E.pdfDepuisPlanches(['<svg xmlns="http://www.w3.org/2000/svg" width="10mm" height="10mm" viewBox="0 0 10 10"><g></svg>']), /mal formé/);
  assert.throws(() => E.calepiner(docCatalogue(), { format: 'A5' }));
  assert.deepStrictEqual(E.calepiner({ modeles: [], plateau: { tuiles: [], jetons: [] } }, { format: 'A3' }), []);
  // sans tuile à imprimer, preparerSorties ne lève pas d'exception
  assert.doesNotThrow(() => E.preparerSorties({ modeles: [], plateau: { tuiles: [], jetons: [] } }, { format: 'A3' }));
});

test('export : lecture seule (le document n\'est pas modifié)', () => {
  const doc = docModifie(), avant = JSON.stringify(doc);
  E.preparerSorties(doc, { format: 'A3', jetons: true, apercu: true });
  E.pdfDepuisPlanches(E.calepiner(doc, { format: 'A4' }), doc);
  E.listeTuiles(doc, { portee: 'posees' });
  assert.strictEqual(JSON.stringify(doc), avant);
});

/* ================================================================== */
/* 2. GRAPHE / ÉQUILIBRE                                               */
/* ================================================================== */

/**
 * Graphe synthétique : deux apparitions (n0 pour J1, n10 pour J2) et 7 villes. La ville k est reliée à n0 par une chaîne
 * de d1 pas et à n10 par une chaîne de d2 pas (null = pas de liaison). Villes non traversables : les distances valent
 * exactement d1 et d2.
 */
function grapheDistances(paires, traversables) {
  const voisins = new Map(), noeuds = [];
  const noeud = (id) => { if (!voisins.has(id)) { voisins.set(id, new Set()); noeuds.push(id); } };
  const lier = (a, b) => { noeud(a); noeud(b); voisins.get(a).add(b); voisins.get(b).add(a); };
  noeud('n0'); noeud('n10');
  const jonctions = [], villes = new Set();
  paires.forEach(([d1, d2], k) => {
    const ville = 'J' + (1 + k % 3) + ',' + (1 + Math.floor(k / 3));
    noeud(ville);
    jonctions.push({ id: ville, i: 1 + k % 3, j: 1 + Math.floor(k / 3), type: 'capture', ports: 1, cases: [] });
    villes.add(ville);
    const chaine = (depart, d, nom) => {
      let prec = depart;
      for (let s = 1; s < d; s++) { const id = nom + '-' + k + '-' + s; lier(prec, id); prec = id; }
      lier(prec, ville);
    };
    if (d1 !== null) chaine('n0', d1, 'a');
    if (d2 !== null) chaine('n10', d2, 'b');
  });
  return { noeuds, voisins, cases: new Map(), jonctions, villes, apparitions: { 1: ['n0'], 2: ['n10'] }, villesTraversables: !!traversables };
}
const VIDE = () => ({ modeles: [], plateau: { forme: { retires: [] }, tuiles: [], jetons: [] } });
const codes = (e) => e.alertes.map((a) => a.code).sort();

test('graphe : distances sur un petit graphe connu, villes non traversables contre traversables', () => {
  // P1 - a - C(ville) - b - P2 ; détour a - x - y - z - b
  const aretes = [['P1', 'a'], ['a', 'C'], ['C', 'b'], ['b', 'P2'], ['a', 'x'], ['x', 'y'], ['y', 'z'], ['z', 'b'], ['iso1', 'iso2']];
  for (const trav of [false, true]) {
    const voisins = new Map(), noeuds = [];
    aretes.forEach(([u, v]) => [u, v].forEach((n) => { if (!voisins.has(n)) { voisins.set(n, new Set()); noeuds.push(n); } }));
    aretes.forEach(([u, v]) => { voisins.get(u).add(v); voisins.get(v).add(u); });
    const g = { noeuds, voisins, cases: new Map(), jonctions: [], villes: new Set(['C']), apparitions: { 1: ['P1'], 2: ['P2'] }, villesTraversables: trav };
    const d = GR.distances(g, 'P1');
    assert.strictEqual(d.get('P1'), 0);
    assert.strictEqual(d.get('a'), 1);
    assert.strictEqual(d.get('C'), 2, 'une ville reste atteignable');
    assert.strictEqual(d.get('b'), trav ? 3 : 5, trav ? 'traversable : par la ville' : 'non traversable : par le détour');
    assert.strictEqual(d.get('P2'), trav ? 4 : 6);
    assert.ok(!d.has('iso1') && !d.has('iso2'), 'nœuds isolés absents');
    // depuis plusieurs sources : minimum
    const dd = GR.distances(g, ['P1', 'P2']);
    assert.strictEqual(dd.get('b'), 1);
    assert.strictEqual(dd.get('C'), 2);
    assert.strictEqual(dd.get('a'), 1);
    // depuis la ville elle-même : la ville est source, elle peut sortir
    assert.strictEqual(GR.distances(g, 'C').get('P1'), 2);
    // source inconnue : rien, pas d'exception
    assert.strictEqual(GR.distances(g, 'inconnu').size, 0);
  }
});

test('équilibre : valeurs exactes sur graphe synthétique (S, écart par rang, partage, première ville)', () => {
  // symétrique : D1 = D2
  const sym = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [6, 6], [8, 4], [9, 3], [10, 2]]) });
  assert.deepStrictEqual(sym.D[1], [2, 3, 4, 6, 8, 9, 10]);
  assert.deepStrictEqual(sym.D[2], [2, 3, 4, 6, 8, 9, 10]);
  assert.strictEqual(sym.S, 0);
  assert.strictEqual(sym.ecartMax7, 0);
  assert.deepStrictEqual(sym.partage, { 1: 3, 2: 3, egalite: 1 });
  assert.strictEqual(sym.premiereVille.ecart, 0);
  assert.deepStrictEqual(sym.alertes, []);
  assert.strictEqual(sym.aSurveiller, false);

  // « 5 contre 2 » : D1 = 2,3,4,5,5,7,8 ; D2 = 4,5,7,7,8,9,10
  const cinq = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [5, 7], [7, 5], [8, 4]]) });
  assert.deepStrictEqual(cinq.D[1], [2, 3, 4, 5, 5, 7, 8]);
  assert.deepStrictEqual(cinq.D[2], [4, 5, 7, 7, 8, 9, 10]);
  assert.deepStrictEqual(cinq.parRang.map((x) => x.ecart), [2, 2, 3, 2, 3, 2, 2]);
  assert.strictEqual(cinq.S, 16);
  assert.strictEqual(cinq.ecartMax7, 3);
  assert.strictEqual(cinq.ecartRang, 3);
  assert.deepStrictEqual(cinq.partage, { 1: 5, 2: 2, egalite: 0 });
  assert.strictEqual(cinq.aSurveiller, true);
  assert.deepStrictEqual(cinq.premiereVille, { 1: 2, 2: 4, ecart: 2 });
  for (const c of ['cinq_contre_deux', 'ecart_rang_etendu', 'ecart_rang', 'premiere_ville_inegale']) assert.ok(codes(cinq).includes(c), c);

  // écart > 2 seulement aux rangs 5 à 7 (doc 16 b) : alerte étendue, pas l'ancienne alerte des rangs 1 à 4
  const loin = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 2], [3, 3], [4, 4], [5, 5], [6, 9], [7, 10], [8, 11]]) });
  assert.deepStrictEqual(loin.parRang.map((x) => x.ecart), [0, 0, 0, 0, 3, 3, 3]);
  assert.strictEqual(loin.S, 9);
  assert.strictEqual(loin.ecartRang, 0);
  assert.strictEqual(loin.ecartMax7, 3);
  assert.deepStrictEqual(codes(loin), ['ecart_rang_etendu']);

  // exactement 2 à chaque rang : pas d'alerte d'écart (seuil strictement supérieur à 2), mais S >= 4 « à surveiller »
  const deux = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 8], [3, 7], [4, 6], [5, 5], [6, 10], [7, 9], [8, 4]]) });
  assert.deepStrictEqual(deux.D[1], [2, 3, 4, 5, 6, 7, 8]);
  assert.deepStrictEqual(deux.D[2], [4, 5, 6, 7, 8, 9, 10]);
  assert.strictEqual(deux.S, 14);
  assert.strictEqual(deux.ecartMax7, 2);
  assert.ok(!codes(deux).includes('ecart_rang_etendu') && !codes(deux).includes('ecart_rang'));
  assert.strictEqual(deux.aSurveiller, true);
  assert.strictEqual(GR.SEUIL_S, 4);
});

test('équilibre : « 4 contre 3 » n\'alerte pas ; moins de 7 villes jamais de « 5 contre 2 » ; ville inaccessible signalée', () => {
  const quatre = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [8, 4], [9, 3], [10, 2]]) });
  assert.deepStrictEqual(quatre.partage, { 1: 4, 2: 3, egalite: 0 });
  assert.ok(!codes(quatre).includes('cinq_contre_deux'));
  const six = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [6, 6], [7, 5]]) });
  assert.ok(!codes(six).includes('cinq_contre_deux'));
  assert.ok(six.lacunes.some((l) => /Il manque 1 ville/.test(l)));
  assert.strictEqual(six.complet, false);
  const inacc = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [6, 6], [7, 5], [8, null]]) });
  assert.strictEqual(inacc.inaccessibles[2].length, 1);
  assert.ok(codes(inacc).includes('ville_inaccessible'));
  assert.strictEqual(inacc.D[2].length, 6);
  assert.strictEqual(inacc.parRang.length, 7);
  assert.strictEqual(inacc.parRang[6].ecart, null, 'rang 7 non comparable');
});

test('équilibre : défaut « villes non traversables » (graphe, équilibre, rapport) ; le mode traversable est une option', () => {
  const doc = plateau('graphe').doc;
  assert.strictEqual(GR.construire(doc).villesTraversables, false);
  assert.strictEqual(GR.equilibre(doc).villesTraversables, false);
  assert.strictEqual(PM.equilibre.analyser(doc).resultat.villesTraversables, false);
  assert.strictEqual(GR.equilibre(doc, { villesTraversables: true }).villesTraversables, true);
  assert.strictEqual(GR.equilibre(doc, { villesTraversables: undefined }).villesTraversables, false);
  // les distances en mode traversable ne sont jamais plus longues
  const n = GR.equilibre(doc, { villesTraversables: false }), t = GR.equilibre(doc, { villesTraversables: true });
  for (const p of [1, 2]) n.D[p].forEach((x, k) => assert.ok(t.D[p][k] <= x || t.D[p].length === n.D[p].length));
});

/** Parcours en largeur indépendant (oracle) sur le graphe construit. */
function bfs(g, sources, traversables) {
  const d = new Map(sources.map((s) => [s, 0]));
  const file = sources.slice();
  while (file.length) {
    const x = file.shift();
    if (!traversables && d.get(x) > 0 && g.villes.has(x)) continue;
    for (const y of g.voisins.get(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); file.push(y); }
  }
  return d;
}

test('graphe : structure du graphe d\'un plateau complet et distances égales à un parcours indépendant', () => {
  for (const graine of ['graphe', 'b', 'c']) {
    const doc = plateau(graine).doc;
    const g = GR.construire(doc);
    const nbCases = doc.plateau.tuiles.reduce((s, t) => s + M.modeleParId(doc, t.modeleId).cases.length, 0);
    assert.strictEqual(g.noeuds.length, nbCases + 9, 'cases + 9 jetons');
    assert.strictEqual(g.villes.size, 7);
    assert.strictEqual(g.jonctions.length, 9);
    assert.strictEqual(g.apparitions[1].length, 2);
    assert.strictEqual(g.apparitions[2].length, 2);
    for (const [a, vs] of g.voisins) for (const b of vs) assert.ok(g.voisins.get(b).has(a), 'arête non symétrique');
    for (const trav of [false, true]) {
      const gt = GR.construire(doc, { villesTraversables: trav });
      for (const p of [1, 2]) {
        const mien = GR.distancesJoueur(gt, p), oracle = bfs(gt, gt.apparitions[p], trav);
        assert.deepStrictEqual([...mien].sort(), [...oracle].sort(), 'joueur ' + p + (trav ? ' T' : ' N'));
      }
    }
  }
});

test('équilibre : plateau incomplet, résultat partiel sans exception, lacunes explicites', () => {
  const plein = plateau('graphe').doc;
  const cas = [];
  const a = clone(plein); a.plateau.tuiles.pop(); cas.push(['une tuile en moins', a]);
  const b = clone(plein); b.plateau.jetons = b.plateau.jetons.filter((j) => j.type === 'carrefour'); cas.push(['sans villes', b]);
  const c = clone(plein); c.plateau.jetons.pop(); cas.push(['un jeton en moins', c]);
  const d = clone(plein); d.plateau.tuiles = d.plateau.tuiles.filter((t) => t.lig > 0); cas.push(['sans la rangée nord', d]);
  const e = VIDE(); cas.push(['document vide', e]);
  const g = clone(plein); g.plateau.jetons.push({ i: 9, j: 9, type: 'capture' }); cas.push(['jeton hors grille', g]);
  const h = { modeles: plein.modeles }; cas.push(['plateau absent', h]);
  for (const [nom, doc] of cas) {
    const avant = JSON.stringify(doc);
    let res;
    assert.doesNotThrow(() => { res = GR.equilibre(doc); }, nom);
    assert.doesNotThrow(() => PM.equilibre.rapport(PM.equilibre.analyser(doc), PM.equilibre.analyser(doc, { villesTraversables: true })), nom + ' (rapport)');
    assert.strictEqual(JSON.stringify(doc), avant, nom + ' : document modifié');
    if (nom !== 'jeton hors grille') {
      assert.strictEqual(res.complet, false, nom);
      assert.strictEqual(res.partiel, true, nom);
      assert.ok(res.lacunes.length > 0, nom);
    }
  }
  assert.ok(GR.equilibre(a).lacunes.some((l) => /Il manque 1 tuile/.test(l)));
  assert.ok(GR.equilibre(b).lacunes.some((l) => /Il manque 7 ville/.test(l)));
  assert.doesNotThrow(() => GR.equilibre(null));
  assert.doesNotThrow(() => GR.construire(undefined));
  assert.doesNotThrow(() => GR.goulets(GR.construire(a), 1));
});

test('équilibre : lecture seule, aucun appel ne modifie le document', () => {
  const doc = plateau('graphe').doc, avant = JSON.stringify(doc);
  GR.construire(doc); GR.equilibre(doc); GR.equilibre(doc, { villesTraversables: true });
  GR.profil(doc); GR.flancs(doc);
  const an = PM.equilibre.analyser(doc);
  PM.equilibre.rapport(an, PM.equilibre.analyser(doc, { villesTraversables: true }));
  assert.strictEqual(JSON.stringify(doc), avant);
});

test('équilibre : rapport, rangs 1 à 7 avec écarts, « 5 contre 2 », première ville et S', () => {
  const g = grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [5, 7], [7, 5], [8, 4]]);
  const analyse = { graphe: g, resultat: GR.equilibre(VIDE(), { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  const r = PM.equilibre.rapport(analyse, null);
  assert.strictEqual(r.rangs.length, 7);
  assert.deepStrictEqual(r.rangs.map((x) => x.ecart), ['2', '2', '3', '2', '3', '2', '2']);
  assert.strictEqual(r.rangs.filter((x) => x.fort).length, 2, 'écarts > 2 signalés aux rangs 3 et 5');
  assert.strictEqual(r.rangs[4].fort, true, 'le rang 5 compte aussi (doc 16 b)');
  assert.strictEqual(r.scoreTexte, '16');
  assert.strictEqual(r.aSurveiller, true);
  assert.deepStrictEqual(r.partage, { j1: 5, j2: 2, egalite: 0 });
  assert.deepStrictEqual(r.premiere, { j1: '2', j2: '4', ecart: '2' });
  assert.ok(r.alertes.some((t) => /5 villes contre 2/.test(t)));
  assert.ok(r.tempo.length === 3);
});

test('équilibre : rapport, comparaison des deux modes seulement quand ils diffèrent', () => {
  const doc = plateau('graphe').doc;
  const n = PM.equilibre.analyser(doc), t = PM.equilibre.analyser(doc, { villesTraversables: true });
  const r = PM.equilibre.rapport(n, t);
  const different = JSON.stringify([n.resultat.D, n.resultat.alertes]) !== JSON.stringify([t.resultat.D, t.resultat.alertes]);
  assert.strictEqual(r.comparaison !== null, different);
  const meme = PM.equilibre.rapport(n, n);
  assert.strictEqual(meme.comparaison, null);
});

/* ================================================================== */
/* 3. GÉNÉRATEUR                                                       */
/* ================================================================== */

test('générateur : même graine, même plateau (200 candidats par défaut, carrefours variés compris)', () => {
  for (const opt of [{}, { paireCarrefours: 'varies' }]) {
    const a = GEN.generer(docCatalogue(), Object.assign({ graine: 'recette' }, opt));
    const b = GEN.generer(docCatalogue(), Object.assign({ graine: 'recette' }, opt));
    assert.ok(a.ok, a.raison);
    assert.deepStrictEqual(a.doc, b.doc);
    assert.strictEqual(a.paire, b.paire);
    assert.strictEqual(a.graine, 'recette');
    assert.strictEqual(a.score.S, b.score.S);
  }
  const x = GEN.generer(docCatalogue(), { graine: 'recette' }), y = GEN.generer(docCatalogue(), { graine: 'recette2' });
  assert.notDeepStrictEqual(x.doc.plateau.tuiles, y.doc.plateau.tuiles);
  // la graine nombre et sa forme texte sont équivalentes
  assert.deepStrictEqual(GEN.generer(docCatalogue(), { graine: 42, candidats: 20 }).doc, GEN.generer(docCatalogue(), { graine: '42', candidats: 20 }).doc);
});

const CODES_EQ = ['cinq_contre_deux', 'ecart_rang_etendu', 'premiere_ville_inegale'];
const GRAINES = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8', 'r9', 'r10', 'r11', 'r12'];

test('générateur : plateau valide, 16 tuiles, 9 jetons, tous les compteurs à ok, aucune alerte d\'équilibre ni autre alerte', () => {
  for (const graine of GRAINES) {
    const r = plateau(graine);
    const doc = r.doc;
    assert.strictEqual(M.validerPlateau(doc).erreurs.length, 0, graine);
    assert.strictEqual(doc.plateau.tuiles.length, 16);
    assert.strictEqual(doc.plateau.jetons.length, 9);
    assert.strictEqual(doc.plateau.jetons.filter((j) => j.type === 'capture').length, 7);
    const c = CT.calculer(doc);
    assert.deepStrictEqual(c.erreurs, [], graine);
    c.compteurs.forEach((x) => assert.strictEqual(x.etat, 'ok', graine + ' : ' + x.cle + ' ' + x.valeur + '/' + x.cible));
    assert.deepStrictEqual(c.alertes.filter((a) => CODES_EQ.includes(a.code)), [], graine);
    // doc 15 : le générateur tolère jusqu'à 2 raccords morts ; aucune autre alerte n'est admise
    assert.deepStrictEqual(c.alertes.filter((a) => a.code !== 'raccord_mort').map((a) => a.code), [], graine + ' : alertes ' + c.alertes.map((a) => a.message).join(' / '));
    // les modèles ne sont pas modifiés
    assert.deepStrictEqual(doc.modeles, docCatalogue().modeles);
  }
});

test('générateur : critère du doc 16 vérifié indépendamment (pas de 5 contre 2, écart <= 2 aux 7 rangs, première ville égale)', () => {
  for (const graine of GRAINES) {
    const doc = plateau(graine).doc;
    const e = GR.equilibre(doc, { villesTraversables: false });
    assert.strictEqual(e.complet, true);
    assert.ok(Math.max(e.partage[1], e.partage[2]) < 5, graine + ' : ' + JSON.stringify(e.partage));
    assert.ok(e.ecartMax7 <= 2, graine);
    assert.strictEqual(e.premiereVille.ecart, 0, graine);
    assert.ok(e.S < GR.SEUIL_S, graine + ' : S ' + e.S);
    assert.deepStrictEqual(e.alertes, [], graine);
    // même résultat en recalcul indépendant des distances (parcours en largeur)
    const g = GR.construire(doc);
    const d = [1, 2].map((p) => {
      const m = bfs(g, g.apparitions[p], false);
      return g.jonctions.filter((j) => j.type === 'capture').map((j) => m.get(j.id)).sort((a, b) => a - b);
    });
    assert.deepStrictEqual(e.D[1], d[0]);
    assert.deepStrictEqual(e.D[2], d[1]);
    // garde-fous D7 : 45 à 55 cases de déplacement, deux sorties au moins par apparition
    const cases = doc.plateau.tuiles.reduce((s, t) => s + M.modeleParId(doc, t.modeleId).cases.filter((x) => x.type === 'deplacement').length, 0);
    assert.ok(cases >= 45 && cases <= 55, 'cases de déplacement ' + cases);
    // D7 : au moins 2 sorties distinctes par apparition, villes à 3 pas au moins (plus court chemin, villes traversables)
    assert.ok(plateau(graine).score.sortiesMin >= 2, graine + ' : sorties minimales ' + plateau(graine).score.sortiesMin);
    for (const opt of [undefined, { paireCarrefours: 'varies' }]) {
      const dv = plateau(graine, opt).doc;
      const gT = GR.construire(dv, { villesTraversables: true });
      for (const v of gT.villes) {
        const m = bfs(gT, [v], true);
        for (const w of gT.villes) if (w !== v) assert.ok(m.get(w) >= 3, graine + ' : villes ' + v + ' et ' + w + ' à ' + m.get(w) + ' pas');
      }
      // sorties de chaque apparition : au moins 2 voisins distincts
      const gN = GR.construire(dv);
      [1, 2].forEach((p) => gN.apparitions[p].forEach((id) => assert.ok(gN.voisins.get(id).size >= 2, graine + ' : apparition ' + id + ' à ' + gN.voisins.get(id).size + ' sortie(s)')));
    }
  }
});

test('générateur : paire de carrefours par défaut (1,2)+(3,2) et jamais deux carrefours du même camp', () => {
  for (const graine of GRAINES) {
    const r = plateau(graine);
    assert.strictEqual(r.paire, GEN.PAIRE_DEFAUT);
    assert.strictEqual(GEN.PAIRE_DEFAUT, '(1,2)+(3,2)');
    const car = r.doc.plateau.jetons.filter((j) => j.type === 'carrefour').map((j) => j.i + ',' + j.j).sort();
    assert.deepStrictEqual(car, ['1,2', '3,2']);
  }
  assert.strictEqual(GEN.PAIRES.length, 30, '30 paires permises (docs/12)');
});

test('générateur : carrefours variés, paire permise, aucune alerte a) ni b) dans les deux modes, S <= S de la paire par défaut', () => {
  const vues = new Set();
  for (const graine of GRAINES) {
    const r = plateau(graine, { paireCarrefours: 'varies' });
    vues.add(r.paire);
    assert.ok(r.pairesPermises.includes(r.paire));
    assert.ok(GEN.PAIRES.includes(r.paire));
    assert.strictEqual(r.doc.plateau.jetons.filter((j) => j.type === 'carrefour').length, 2);
    const car = r.doc.plateau.jetons.filter((j) => j.type === 'carrefour');
    assert.ok(!(car[0].j === car[1].j && car[0].j !== 2), 'carrefours du même camp');
    for (const trav of [false, true]) {
      const e = GR.equilibre(r.doc, { villesTraversables: trav });
      assert.ok(Math.max(e.partage[1], e.partage[2]) < 5, graine + (trav ? ' T' : ' N') + ' : 5 contre 2');
      assert.ok(e.ecartMax7 <= 2, graine + (trav ? ' T' : ' N') + ' : écart ' + e.ecartMax7);
      assert.strictEqual(e.premiereVille.ecart, 0, graine + ' première ville');
    }
    // S de la paire par défaut sur les mêmes tuiles
    // placement par défaut complet : carrefours en (1,2) et (3,2), villes sur les 7 autres jonctions
    const defaut = clone(r.doc);
    defaut.plateau.jetons = jetonsPourPaire({ i: 1, j: 2 }, { i: 3, j: 2 });
    const sDef = GR.equilibre(defaut, { villesTraversables: false }).S;
    const sEff = GR.equilibre(r.doc, { villesTraversables: false }).S;
    assert.strictEqual(sEff, r.score.S, 'le S annoncé est le S mesuré');
    assert.ok(sEff <= sDef, graine + ' : paire ' + r.paire + ', S ' + sEff + ' > S de la paire par défaut ' + sDef + ' sur les mêmes tuiles');
  }
  assert.ok(vues.size > 1, 'au moins deux paires différentes sur ' + GRAINES.length + ' graines : ' + [...vues].join(' '));
});

test('générateur : option « villes traversables » ; « 5 contre 2 » reste absent en villes non traversables', () => {
  for (const graine of ['t1', 't2', 't3']) {
    const r = GEN.generer(docCatalogue(), { graine, candidats: 40, villesTraversables: true });
    assert.ok(r.ok, r.raison);
    assert.strictEqual(r.score.villesTraversables, true);
    const e = GR.equilibre(r.doc, { villesTraversables: false });
    assert.ok(Math.max(e.partage[1], e.partage[2]) < 5, 'doc 16 a) : toujours vérifié en non traversable');
  }
});

test('générateur : bibliothèque insuffisante, raison claire et document inchangé', () => {
  const retirer = (id, nb) => { const d = docCatalogue(); const m = d.modeles.find((x) => x.id === id); m.exemplaires = nb; return d; };
  const cas = [];
  const sansCoins = docCatalogue(); sansCoins.modeles.forEach((m) => { if (m.role === 'coin') m.exemplaires = 0; });
  cas.push(['coins à 0 exemplaire', sansCoins, /coin/]);
  const unApp = retirer('A1', 1); unApp.modeles.find((m) => m.id === 'A2').exemplaires = 0;
  cas.push(['une seule apparition', unApp, /apparition/]);
  const incomplets = docCatalogue(); incomplets.modeles.forEach((m) => { if (m.role === 'bord') m.cases = []; });
  cas.push(['bords incomplets', incomplets, /bord/]);
  const centrales = docCatalogue(); centrales.modeles = centrales.modeles.filter((m) => m.role !== 'centrale');
  cas.push(['sans centrale', centrales, /centrale/]);
  const exemples = M.nouveauDocument(); exemples.modeles = M.copieExemples(); exemples.modeles[0].exemplaires = 3;
  cas.push(['3 centrales seulement', exemples, /centrale/]);
  for (const [nom, doc, motif] of cas) {
    const avant = JSON.stringify(doc);
    const r = GEN.generer(doc, { graine: 'x', candidats: 20 });
    assert.strictEqual(r.ok, false, nom);
    assert.strictEqual(r.doc, null, nom);
    assert.match(r.raison, /Bibliothèque insuffisante/, nom);
    assert.match(r.raison, motif, nom);
    assert.strictEqual(JSON.stringify(doc), avant, nom + ' : document modifié');
  }
});

test('générateur : entrées invalides (document absent, options absurdes) sans exception', () => {
  for (const doc of [null, undefined, 42, 'x', {}, { modeles: [] }, { modeles: [null, 3], plateau: null }]) {
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(doc, { graine: 'x', candidats: 10 }); });
    assert.strictEqual(r.ok, false);
    assert.ok(typeof r.raison === 'string' && r.raison.length > 0);
  }
  for (const opt of [{ candidats: 0 }, { candidats: -5 }, { candidats: NaN }, { candidats: 'abc' }, { graine: '   ' }, { graine: null }, { tolerance: -1 }, { paireCarrefours: 'n\'importe quoi' }, { graine: { a: 1 } }]) {
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(docCatalogue(), Object.assign({ candidats: 10 }, opt)); }, JSON.stringify(opt));
    assert.ok(r.ok || typeof r.raison === 'string', JSON.stringify(opt));
    assert.ok(typeof r.graine === 'string' && r.graine.length > 0);
  }
});

test('générateur : plateau d\'entrée non vide et forme réduite remplacés par le 4x4 complet, document d\'entrée intact', () => {
  const base = plateau('r1').doc;
  const reduit = clone(base);
  reduit.plateau.forme.retires = [{ col: 0, lig: 0 }];
  const avant = JSON.stringify(reduit);
  const r = GEN.generer(reduit, { graine: 'forme', candidats: 30 });
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(r.doc.plateau.forme, { retires: [] });
  assert.strictEqual(r.doc.plateau.tuiles.length, 16);
  assert.ok(r.rapport.some((t) => /forme réduite/.test(t)));
  assert.strictEqual(JSON.stringify(reduit), avant);
});

test('générateur : même résultat sur le plateau vide ou rempli (seule la bibliothèque compte)', () => {
  const vide = docCatalogue(), plein = clone(plateau('r1').doc);
  const a = GEN.generer(vide, { graine: 'mm', candidats: 30 }), b = GEN.generer(plein, { graine: 'mm', candidats: 30 });
  assert.deepStrictEqual(a.doc, b.doc);
});

test('générateur : aperçu SVG neutralise un identifiant de modèle hostile', { skip: SANS_PYMUPDF }, () => {
  const lib = docCatalogue();
  lib.modeles.forEach((x) => { hostiliserCases(x); x.nom = '<b>' + x.nom + '</b>'; });
  lib.modeles.forEach((x) => assert.strictEqual(M.validerModele(x).complet, true));
  const r = GEN.generer(lib, { graine: 'inj', candidats: 20 });
  assert.ok(r.ok, r.raison);
  const svg = GEN.svgApercu(r.doc);
  assert.ok(svg.includes('data-case="&quot;/&gt;&lt;script&gt;alert(2)&lt;/script&gt;"'), 'preuve positive : identifiant de case hostile présent, échappé');
  assert.ok(!/<script/i.test(svg));
  const a = analyseXml([svg], 'apercu-gen')[0];
  assert.ok(a.ok, a.erreur);
  assert.deepStrictEqual(a.on, []);
});

/* ================================================================== */
/* 4. CONTRÔLES                                                        */
/* ================================================================== */

const JONCTIONS = [];
for (let j = 1; j <= 3; j++) for (let i = 1; i <= 3; i++) JONCTIONS.push({ i, j });
function jetonsPourPaire(p1, p2, villes) {
  const reste = JONCTIONS.filter((x) => !(x.i === p1.i && x.j === p1.j) && !(x.i === p2.i && x.j === p2.j));
  const captures = villes || reste;
  return captures.map((x) => ({ i: x.i, j: x.j, type: 'capture' })).concat([{ i: p1.i, j: p1.j, type: 'carrefour' }, { i: p2.i, j: p2.j, type: 'carrefour' }]);
}

/** Cherche un plateau complet avec « 5 contre 2 » en villes non traversables (placement manuel). */
function chercherCinqContreDeux() {
  for (const graine of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']) {
    const base = plateau(graine).doc;
    for (const a of JONCTIONS) for (const b of JONCTIONS) {
      if ((a.j > b.j) || (a.j === b.j && a.i >= b.i)) continue;
      if (a.j === b.j && a.j !== 2) continue; // même camp
      const doc = clone(base);
      doc.plateau.jetons = jetonsPourPaire(a, b);
      const e = GR.equilibre(doc, { villesTraversables: false });
      if (codes(e).includes('cinq_contre_deux')) return { doc, e, paire: [a, b] };
    }
  }
  return null;
}

test('contrôles : alertes d\'équilibre présentes sur un plateau complet, absentes sur un plateau incomplet', () => {
  const trouve = chercherCinqContreDeux();
  assert.ok(trouve, 'aucune configuration « 5 contre 2 » trouvée parmi 8 plateaux x 30 paires');
  const c = CT.calculer(trouve.doc);
  const eq = c.alertes.filter((a) => CODES_EQ.includes(a.code));
  assert.ok(eq.some((a) => a.code === 'cinq_contre_deux'), 'alerte « 5 contre 2 » attendue sur plateau complet');
  assert.ok(c.regroupees.some((g) => g.code === 'cinq_contre_deux'));
  // même alertes que PM.graphe (villes non traversables)
  const attendu = trouve.e.alertes.filter((a) => CODES_EQ.includes(a.code)).map((a) => a.code).sort();
  assert.deepStrictEqual(eq.map((a) => a.code).sort(), attendu);
  // une tuile en moins : l'équilibre n'est plus évalué par les contrôles
  const moins = clone(trouve.doc); moins.plateau.tuiles.pop();
  const c2 = CT.calculer(moins);
  assert.deepStrictEqual(c2.alertes.filter((a) => CODES_EQ.includes(a.code)), [], 'pas d\'alerte d\'équilibre sur plateau incomplet');
  // un jeton de ville en moins
  const moinsVille = clone(trouve.doc);
  moinsVille.plateau.jetons.splice(moinsVille.plateau.jetons.findIndex((j) => j.type === 'capture'), 1);
  assert.deepStrictEqual(CT.calculer(moinsVille).alertes.filter((a) => CODES_EQ.includes(a.code)), []);
  // plateau vide
  assert.deepStrictEqual(CT.calculer(docCatalogue()).alertes.filter((a) => CODES_EQ.includes(a.code)), []);
});

test('contrôles : alerte d\'équilibre silencieuse quand PM.graphe lève une exception', () => {
  const trouve = chercherCinqContreDeux();
  const sauve = GR.equilibre;
  GR.equilibre = () => { throw new Error('boum'); };
  try {
    assert.doesNotThrow(() => CT.calculer(trouve.doc));
  } finally { GR.equilibre = sauve; }
});

/** Taux de « 5 contre 2 » (non traversables) lus dans docs/12-mesures-equilibre.md, section 2. */
function tauxDoc12() {
  const texte = fs.readFileSync(path.join(__dirname, '..', 'docs', '12-mesures-equilibre.md'), 'utf8');
  const section = texte.split('## 2. ')[1].split('## 3. ')[0];
  const res = {};
  section.split('\n').forEach((l) => {
    const m = /^\| \((\d),(\d)\)\+\((\d),(\d)\) \|(.*)\|$/.exec(l);
    if (!m) return;
    const cols = m[5].split('|').map((x) => x.trim());
    res[m[1] + ',' + m[2] + '+' + m[3] + ',' + m[4]] = parseFloat(cols[5]); // 5 contre 2 (N)
  });
  return res;
}

test('contrôles : message de paire de carrefours avec son taux (30 paires, taux de docs/12 section 2)', () => {
  const taux = tauxDoc12();
  assert.strictEqual(Object.keys(taux).length, 30, 'tableau du doc 12 lu');
  const base = docCatalogue();
  for (const cle of Object.keys(taux)) {
    const [a, b] = cle.split('+').map((s) => { const [i, j] = s.split(',').map(Number); return { i, j }; });
    for (const ordre of [[a, b], [b, a]]) {
      const doc = clone(base);
      doc.plateau.jetons = ordre.map((p) => ({ i: p.i, j: p.j, type: 'carrefour' }));
      const al = CT.calculer(doc).alertes;
      const paire = al.filter((x) => x.code === 'carrefours_paire');
      assert.ok(!al.some((x) => x.code === 'carrefours_meme_cote'), cle);
      if (taux[cle] > 0) {
        assert.strictEqual(paire.length, 1, 'alerte de paire attendue : ' + cle);
        const attendu = String(taux[cle]).replace('.', ',') + ' %';
        assert.ok(paire[0].message.includes(attendu), cle + ' : taux ' + attendu + ' dans « ' + paire[0].message + ' »');
        assert.ok(paire[0].message.includes('(' + a.i + ', ' + a.j + ')') && paire[0].message.includes('(' + b.i + ', ' + b.j + ')'), cle);
        assert.ok(/5 villes contre 2/.test(paire[0].message));
        assert.ok(paire[0].cible && paire[0].cible.type === 'jonction');
      } else {
        assert.strictEqual(paire.length, 0, 'pas d\'alerte pour la paire sûre ' + cle);
      }
    }
  }
});

test('contrôles : deux carrefours du même camp, alerte dédiée sans message de paire', () => {
  const doc = docCatalogue();
  doc.plateau.jetons = [{ i: 1, j: 1, type: 'carrefour' }, { i: 2, j: 1, type: 'carrefour' }];
  const codesAl = CT.calculer(doc).alertes.map((a) => a.code);
  assert.ok(codesAl.includes('carrefours_meme_cote'));
  assert.ok(!codesAl.includes('carrefours_paire'));
});

/* Incohérence éventuelle : un plateau généré en mode « carrefours variés » avec une paire autre que la paire par défaut
 * reçoit l'alerte manuelle « Paire de carrefours à risque » (taux typique > 0), alors que le générateur a vérifié l'équilibre
 * de ce plateau (docs/16 : « une autre paire seulement si la configuration n'a aucune alerte »). */
test('générateur x contrôles : un plateau « carrefours variés » ne porte aucune alerte', { todo: 'BUG: (mineur) un plateau généré avec une paire de carrefours autre que (1,2)+(3,2) reçoit une alerte manuelle carrefours_paire (taux typique > 0 %), alors que le générateur a vérifié ce plateau (docs/16, carrefours)' }, () => {
  let avecAlerte = null;
  for (const graine of GRAINES) {
    const r = plateau(graine, { paireCarrefours: 'varies' });
    const al = CT.calculer(r.doc).alertes.filter((a) => a.code !== 'raccord_mort');
    if (al.length) { avecAlerte = graine + ' (' + r.paire + ') : ' + al.map((a) => a.code).join(', '); break; }
  }
  assert.strictEqual(avecAlerte, null, 'plateau généré avec alerte : ' + avecAlerte);
});

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignoré */ } });

/* ================================================================== */
/* Défauts constatés (todo : le test décrit le comportement attendu)    */
/* ================================================================== */

test('rapport d\'équilibre : les rangs 5 à 7 comptent comme les rangs 1 à 4 (docs/16 b), pas de rang grisé ni de note « rangs 1 à 4 »', { todo: 'BUG: (mineur) PM.equilibre.rapport marque compte=false pour les rangs 5 à 7 (affichés grisés, classe pm-equilibre-rang-libre) et la note « Écart maximal aux rangs 1 à 4 » subsiste, alors que docs/16 b) étend l\'alerte aux 7 rangs' }, () => {
  const g = grapheDistances([[2, 2], [3, 3], [4, 4], [5, 5], [6, 9], [7, 10], [8, 11]]);
  const analyse = { graphe: g, resultat: GR.equilibre(VIDE(), { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  const r = PM.equilibre.rapport(analyse, null);
  assert.deepStrictEqual(r.rangs.map((x) => x.compte), [true, true, true, true, true, true, true]);
});

test('rapport d\'équilibre : un même écart n\'est pas annoncé deux fois (ecart_rang et ecart_rang_etendu)', { todo: 'BUG: (mineur) pour un écart > 2 aux rangs 1 à 4, la liste des alertes du rapport contient deux messages quasi identiques (ecart_rang puis ecart_rang_etendu)' }, () => {
  const g = grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [5, 7], [7, 5], [8, 4]]);
  const analyse = { graphe: g, resultat: GR.equilibre(VIDE(), { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  const r = PM.equilibre.rapport(analyse, null);
  assert.ok(r.alertes.filter((t) => /pas d'écart/.test(t)).length <= 1, r.alertes.join(' / '));
});

test('équilibre : une tuile posée dont le modèle est introuvable rend le plateau incomplet', { todo: 'BUG: (mineur) GR.equilibre ignore la tuile mais déclare complet = true, sans lacune (le décompte des tuiles se fait sur plateau.tuiles.length)' }, () => {
  const doc = clone(plateau('graphe').doc);
  doc.plateau.tuiles[0].modeleId = 'fantome';
  const e = GR.equilibre(doc);
  assert.strictEqual(e.complet, false);
});
