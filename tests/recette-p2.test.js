'use strict';
/*
 * Recette des modules de priorité 2 et de l'export (testeur, sous-agent 9), adaptée aux règles de la version 2.
 * Référence : la documentation (docs/archives/14-export.md, 6-avis-prepresse.md, 16-avis-mesures-equilibre.md,
 * 18-decisions-v2.md, 19-avis-design-v2.md, 20-avis-geometrie-v2.md, 10-contrats-interface.md), pas les tests existants.
 * Plateaux générés : bibliothèque d'exemples conformes à R1 à R4 (le catalogue v1 ne permet aucun plateau v2).
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
const AV2 = require('./aides-v2.js');
const PM = globalThis.PM;
const M = PM.modele, E = PM.exportation, GR = PM.graphe, GEN = PM.generateur, CT = PM.controles;

/* ------------------------------------------------------------------ */
/* Outils                                                              */
/* ------------------------------------------------------------------ */

const clone = (o) => JSON.parse(JSON.stringify(o));
// Les recettes d'export (planches, étiquettes, injection) sont écrites sur la bibliothèque du catalogue PRÉCÉDENT (version 3.04 :
// 13 modèles, 22 tuiles, C1 à C6…) : un ancien document, qui doit s'exporter comme avant. Le catalogue livré (21 tuiles) a ses comptes
// dans le test « export : catalogue livré (docs/46) » ci-dessous et dans tests/export.test.js.
const docCatalogue = () => AV2.documentPrecedent('4x4');
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
  doc.modeles.find((m) => m.id === 'K2').exemplaires = 2;
  doc.modeles.find((m) => m.id === 'B1').exemplaires = 3;
  const inc = doc.modeles.find((m) => m.id === 'C3');
  inc.cases = []; // incomplet (brouillon)
  return doc;
}

/** Bibliothèque du générateur : exemples conformes v2 et une seconde centrale (étoile sans raccord ouest). */
function libGenerateur(grille) {
  const d = AV2.documentExemples(grille);
  const v = clone(d.modeles[0]);
  v.id = 'ex-centrale-b'; v.nom = 'Étoile sans ouest'; v.exemplaires = 2;
  v.chemins = v.chemins.filter((c) => c.id !== 'r4');
  d.modeles.push(v);
  return d;
}

/* Plateaux générés, calculés une fois. */
const CACHE = {};
function plateau(graine, options) {
  const cle = graine + '|' + JSON.stringify(options || {});
  if (!CACHE[cle]) {
    const r = GEN.generer(libGenerateur(), Object.assign({ graine, candidats: 60 }, options || {}));
    assert.ok(r.ok, r.raison);
    CACHE[cle] = r;
  }
  return CACHE[cle];
}

/* ================================================================== */
/* 1. EXPORT                                                           */
/* ================================================================== */

test('export : catalogue en A3 = 4 planches (6, 6, 6, 4) de 297 x 420 ; en A4 = 11 planches de 2, 210 x 297', () => {
  const doc = docCatalogue();
  const a3 = E.calepiner(doc, { format: 'A3' }), a4 = E.calepiner(doc, { format: 'A4' });
  assert.deepStrictEqual(a3.map((p) => p.tuiles.length), [6, 6, 6, 4]);
  assert.ok(a3.every((p) => p.largeur === 297 && p.hauteur === 420));
  assert.strictEqual(a4.length, 11);
  assert.ok(a4.every((p) => p.tuiles.length === 2 && p.largeur === 210 && p.hauteur === 297));
  // 22 tuiles du catalogue : 13 modèles (B1 en 6 exemplaires, K2 en 4, K4 en 1, C4 en 2)
  const total = (ps) => ps.reduce((s, p) => s + p.tuiles.length, 0);
  assert.strictEqual(total(a3), 22);
  assert.strictEqual(total(a4), 22);
});

test('export : catalogue livré (docs/46) en A3 = 4 planches (6, 6, 6, 3) ; en A4 = 11 planches (10 de 2, 1 de 1), 21 tuiles', () => {
  const doc = PM.catalogue.nouveauDocument();
  const a3 = E.calepiner(doc, { format: 'A3' }), a4 = E.calepiner(doc, { format: 'A4' });
  assert.deepStrictEqual(a3.map((p) => p.tuiles.length), [6, 6, 6, 3]);
  assert.strictEqual(a4.length, 11);
  const total = (ps) => ps.reduce((s, p) => s + p.tuiles.length, 0);
  assert.strictEqual(total(a3), 21);
  assert.strictEqual(total(a4), 21);
  // les passages (courbes) sont imprimés : Q1, Q2 et B8 en ont
  assert.ok(a3.some((p) => /data-passage/.test(p.svg)), 'passages absents des planches');
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
  assert.strictEqual(nb('K2'), 2);
  assert.strictEqual(nb('B1'), 3);
  assert.strictEqual(liste.tuiles.length, 22 - 1 /* C3 */ + 2 /* C1 */ - 2 /* K2 : 4 -> 2 */ - 3 /* B1 : 6 -> 3 */);
  const a3 = E.calepiner(doc, { format: 'A3' });
  assert.deepStrictEqual(a3.map((p) => p.tuiles.length), [6, 6, 6]);
  // suffixe -n seulement pour les modèles à plusieurs exemplaires
  const etiq = a3.flatMap((p) => p.tuiles.map((t) => t.etiquette));
  assert.ok(etiq.includes('C1-1') && etiq.includes('C1-3') && etiq.includes('B1-3'));
  assert.ok(etiq.includes('C2') && !etiq.includes('C2-1'));
  assert.ok(etiq.includes('K2-2') && !etiq.includes('K2-3') && etiq.includes('K4') && !etiq.includes('K4-1'));
  // signalé par preparerSorties (c'est ce que la boîte affiche)
  const sortie = E.preparerSorties(doc, { format: 'A3' });
  assert.deepStrictEqual(sortie.exclus.map((x) => x.id), ['C3']);
  assert.strictEqual(sortie.nbTuiles, liste.tuiles.length);
  assert.strictEqual(sortie.feuilles.length, 3);
});

test('export : tuiles posées d\'abord, portée « posées », tuiles imprimées neutres (aucun joueur)', () => {
  const r = plateau('export');
  const posees = E.listeTuiles(r.doc, { portee: 'posees' });
  assert.strictEqual(posees.tuiles.length, 16);
  assert.ok(posees.tuiles.every((t) => t.posee));
  assert.deepStrictEqual(E.calepiner(r.doc, { format: 'A3', portee: 'posees' }).map((p) => p.tuiles.length), [6, 6, 4]);
  const stock = E.listeTuiles(r.doc);
  assert.strictEqual(stock.tuiles.length, 18);
  assert.ok(stock.tuiles.slice(0, 16).every((t) => t.posee) && stock.tuiles.slice(16).every((t) => !t.posee), 'posées d\'abord');
  assert.ok(stock.tuiles.every((t) => !('joueur' in t)), 'docs/18 : une même tuile de bord sert aux deux camps');
});

test('export : étiquette longue (60 caractères) reste dans la feuille et ne rencontre ni tuile ni repère', () => {
  const doc = docCatalogue();
  const m = doc.modeles.find((x) => x.id === 'C1');
  m.id = 'ABCDEFGHIJ'.repeat(6);
  doc.plateau = { tuiles: [], jetons: [] };
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
  // case d'apparition imprimée neutre : ni chiffre de joueur ni couleur de camp (docs/18, défauts de D3 corrigés)
  assert.ok(!r.textes.join('\n').split('\n').some((t) => t === '1' || t === '2'));
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
  r.tuiles.forEach((tuiles) => tuiles.forEach((z) => assert.strictEqual(z.rouge, 0, 'aucun pixel rouge sur une tuile imprimée')));
  assert.ok(fs.existsSync(png) && fs.statSync(png).size > 5000);
});

test('export : PDF A4 du catalogue (11 pages 210 x 297) et PDF de la bibliothèque modifiée (modèle incomplet absent)', { skip: SANS_PYMUPDF }, () => {
  const doc = docCatalogue();
  const p4 = E.calepiner(doc, { format: 'A4' });
  const r4 = analysePdf(E.pdfDepuisPlanches(p4, doc), 'catalogue-A4', p4);
  assert.strictEqual(r4.n, 11);
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
  assert.strictEqual(rm.n, 3);
  const texte = rm.textes.join('\n').split('\n');
  assert.ok(texte.includes('C1-3') && texte.includes('B1-2'));
  assert.ok(!texte.includes('C3') && texte.includes('K2-2') && !texte.some((t) => t.startsWith('K2-3')));
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
  // jetons : 7 villes de Ø 33 mm au pas de 38 mm (plus de carrefour en version 2)
  const j = E.planchesJetons();
  assert.strictEqual(j.jetons.length, 7);
  assert.ok(j.jetons.every((x) => x.type === 'capture'));
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
 * Graphe synthétique : deux apparitions (n0 pour le vert, n10 pour le rouge) et 7 villes. La ville k est reliée à n0
 * par une chaîne de d1 pas et à n10 par une chaîne de d2 pas (null = pas de liaison). Villes non traversables : les
 * distances valent exactement d1 et d2.
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
    jonctions.push({ id: ville, i: 1 + k % 3, j: 1 + Math.floor(k / 3), type: 'ville', ports: 1, cases: [] });
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
const VIDE = () => M.nouveauDocument();
/** Codes des alertes ET des blocages (plateau très déséquilibré), triés. */
const codes = (e) => e.alertes.concat(e.blocages).map((a) => a.code).sort();

test('graphe : distances sur un petit graphe connu, villes non traversables (règle) contre traversables (option interne)', () => {
  // P1 - a - C(ville) - b - P2 ; détour a - x - y - z - b
  const aretes = [['P1', 'a'], ['a', 'C'], ['C', 'b'], ['b', 'P2'], ['a', 'x'], ['x', 'y'], ['y', 'z'], ['z', 'b'], ['iso1', 'iso2']];
  for (const trav of [false, true]) {
    const voisins = new Map(), noeuds = [];
    aretes.forEach(([u, v]) => [u, v].forEach((n) => { if (!voisins.has(n)) { voisins.set(n, new Set()); noeuds.push(n); } }));
    aretes.forEach(([u, v]) => { voisins.get(u).add(v); voisins.get(v).add(u); });
    const g = { noeuds, voisins, cases: new Map(), jonctions: [], villes: new Set(['C']), apparitions: { 1: ['P1'], 2: ['P2'] }, villesTraversables: trav };
    const d = GR.distances(g, 'P1');
    assert.strictEqual(d.get('a'), 1);
    assert.strictEqual(d.get('C'), 2, 'une ville reste atteignable');
    assert.strictEqual(d.get('b'), trav ? 3 : 5, trav ? 'traversable : par la ville' : 'non traversable : par le détour');
    assert.strictEqual(d.get('P2'), trav ? 4 : 6);
    assert.ok(!d.has('iso1') && !d.has('iso2'), 'nœuds isolés absents');
    const dd = GR.distances(g, ['P1', 'P2']);
    assert.strictEqual(dd.get('b'), 1);
    assert.strictEqual(GR.distances(g, 'C').get('P1'), 2);
    assert.strictEqual(GR.distances(g, 'inconnu').size, 0);
  }
});

test('équilibre : valeurs exactes sur graphe synthétique (S, écart par rang, partage, première ville, blocages)', () => {
  const sym = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [6, 6], [8, 4], [9, 3], [10, 2]]) });
  assert.deepStrictEqual(sym.D[1], [2, 3, 4, 6, 8, 9, 10]);
  assert.deepStrictEqual(sym.D[2], [2, 3, 4, 6, 8, 9, 10]);
  assert.strictEqual(sym.S, 0);
  assert.deepStrictEqual(sym.partage, { 1: 3, 2: 3, egalite: 1 });
  assert.deepStrictEqual(codes(sym), []);

  // « 5 contre 2 » : D1 = 2,3,4,5,5,7,8 ; D2 = 4,5,7,7,8,9,10 ; écart max 3 (alerte), « 5 contre 2 » (blocage)
  const cinq = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [5, 7], [7, 5], [8, 4]]) });
  assert.deepStrictEqual(cinq.parRang.map((x) => x.ecart), [2, 2, 3, 2, 3, 2, 2]);
  assert.strictEqual(cinq.S, 16);
  assert.strictEqual(cinq.ecartMax7, 3);
  assert.deepStrictEqual(cinq.partage, { 1: 5, 2: 2, egalite: 0 });
  assert.deepStrictEqual(cinq.premiereVille, { 1: 2, 2: 4, ecart: 2 });
  assert.deepStrictEqual(cinq.blocages.map((b) => b.code), ['cinq_contre_deux']);
  assert.strictEqual(cinq.tresDesequilibre, true);
  for (const c of ['ecart_rang_etendu', 'premiere_ville_inegale', 'score_s']) assert.ok(cinq.alertes.some((a) => a.code === c), c);

  // écart 3 aux rangs 5 à 7 : alerte étendue (pas de blocage : 3 n'est pas plus de 3) et S = 9
  const loin = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 2], [3, 3], [4, 4], [5, 5], [6, 9], [7, 10], [8, 11]]) });
  assert.deepStrictEqual(loin.parRang.map((x) => x.ecart), [0, 0, 0, 0, 3, 3, 3]);
  assert.deepStrictEqual(codes(loin), ['ecart_rang_etendu', 'score_s']);

  // écart 4 à un rang : plus de SEUIL_BLOCAGE_ECART = 3 → plateau très déséquilibré
  const quatre = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 12]]) });
  assert.deepStrictEqual(quatre.blocages.map((b) => b.code), ['ecart_bloquant']);
  assert.ok(!quatre.alertes.some((a) => a.code === 'ecart_rang_etendu'), 'pas annoncé deux fois');

  // exactement 2 à chaque rang : pas d'alerte d'écart, mais S >= 4 « à surveiller »
  const deux = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 8], [3, 7], [4, 6], [5, 5], [6, 10], [7, 9], [8, 4]]) });
  assert.strictEqual(deux.S, 14);
  assert.strictEqual(deux.ecartMax7, 2);
  assert.ok(!codes(deux).includes('ecart_rang_etendu'));
  assert.ok(codes(deux).includes('score_s'));
  assert.strictEqual(deux.aSurveiller, true);
});

test('équilibre : « 4 contre 3 » n\'alerte pas ; moins de 7 villes jamais de « 5 contre 2 » ; ville inaccessible signalée', () => {
  const quatre = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [8, 4], [9, 3], [10, 2]]) });
  assert.deepStrictEqual(quatre.partage, { 1: 4, 2: 3, egalite: 0 });
  assert.ok(!codes(quatre).includes('cinq_contre_deux'));
  const six = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [6, 6], [7, 5]]) });
  assert.ok(!codes(six).includes('cinq_contre_deux'));
  assert.ok(six.lacunes.some((l) => /Il manque 1 ville/.test(l)));
  const inacc = GR.equilibre(VIDE(), { graphe: grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [6, 6], [7, 5], [8, null]]) });
  assert.strictEqual(inacc.inaccessibles[2].length, 1);
  assert.ok(codes(inacc).includes('ville_inaccessible'));
  assert.ok(inacc.alertes.find((a) => a.code === 'ville_inaccessible').message.includes('joueur rouge'));
  assert.strictEqual(inacc.parRang[6].ecart, null, 'rang 7 non comparable');
});

test('équilibre : villes non traversables partout (graphe, équilibre, rapport) ; le mode traversable reste une option interne', () => {
  const doc = plateau('graphe').doc;
  assert.strictEqual(GR.construire(doc).villesTraversables, false);
  assert.strictEqual(GR.equilibre(doc).villesTraversables, false);
  assert.strictEqual(PM.equilibre.analyser(doc).resultat.villesTraversables, false);
  assert.strictEqual(GR.equilibre(doc, { villesTraversables: true }).villesTraversables, true);
  assert.ok(!('traversables' in PM.equilibre.rapport(PM.equilibre.analyser(doc))));
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

test('graphe : structure du graphe d\'un plateau complet (jonctions-cases) et distances égales à un parcours indépendant', () => {
  for (const graine of ['graphe', 'b', 'c']) {
    const doc = plateau(graine).doc;
    const g = GR.construire(doc);
    const nbCases = doc.plateau.tuiles.reduce((s, t) => s + M.modeleParId(doc, t.modeleId).cases.length, 0);
    assert.strictEqual(g.noeuds.length, nbCases + 9, 'cases des tuiles + 9 jonctions (cases chemin ou villes)');
    assert.strictEqual(g.villes.size, 7);
    assert.strictEqual(g.jonctions.length, 9);
    assert.strictEqual(g.jonctions.filter((j) => j.type === 'case').length, 2);
    assert.strictEqual(g.apparitions[1].length, 6);
    assert.strictEqual(g.apparitions[2].length, 6);
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
  const b = clone(plein); b.plateau.jetons = []; cas.push(['sans villes', b]);
  const c = clone(plein); c.plateau.jetons.pop(); cas.push(['une ville en moins', c]);
  const d = clone(plein); d.plateau.tuiles = d.plateau.tuiles.filter((t) => t.lig > 1); cas.push(['sans le camp vert', d]);
  cas.push(['document vide', VIDE()]);
  const g = clone(plein); g.plateau.jetons.push({ i: 9, j: 9, type: 'capture' }); cas.push(['jeton hors grille', g]);
  cas.push(['plateau absent', { modeles: plein.modeles }]);
  for (const [nom, doc] of cas) {
    const avant = JSON.stringify(doc);
    let res;
    assert.doesNotThrow(() => { res = GR.equilibre(doc); }, nom);
    assert.doesNotThrow(() => PM.equilibre.rapport(PM.equilibre.analyser(doc)), nom + ' (rapport)');
    assert.strictEqual(JSON.stringify(doc), avant, nom + ' : document modifié');
    if (nom !== 'jeton hors grille') {
      assert.strictEqual(res.complet, false, nom);
      assert.ok(res.lacunes.length > 0, nom);
      assert.deepStrictEqual(res.blocages.length === 0 || res.complet, true, nom + ' : pas de blocage sur plateau incomplet');
    }
  }
  assert.ok(GR.equilibre(a).lacunes.some((l) => /Il manque 1 tuile/.test(l)));
  assert.ok(GR.equilibre(b).lacunes.some((l) => /Il manque 7 ville/.test(l)));
  assert.ok(GR.equilibre(d).lacunes.some((l) => /joueur vert n'a aucune case d'apparition/.test(l)));
  assert.doesNotThrow(() => GR.equilibre(null));
  assert.doesNotThrow(() => GR.goulets(GR.construire(a), 1));
});

test('équilibre : lecture seule, aucun appel ne modifie le document', () => {
  const doc = plateau('graphe').doc, avant = JSON.stringify(doc);
  GR.construire(doc); GR.equilibre(doc); GR.equilibre(doc, { villesTraversables: true });
  GR.profil(doc); GR.flancs(doc); GR.villesProches(GR.construire(doc)); GR.connexe(GR.construire(doc));
  PM.equilibre.rapport(PM.equilibre.analyser(doc));
  assert.strictEqual(JSON.stringify(doc), avant);
});

test('équilibre : rapport, rangs 1 à 7 avec écarts, « 5 contre 2 » (plateau très déséquilibré), première ville et S', () => {
  const g = grapheDistances([[2, 10], [3, 9], [4, 8], [5, 7], [5, 7], [7, 5], [8, 4]]);
  const analyse = { graphe: g, resultat: GR.equilibre(VIDE(), { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  const r = PM.equilibre.rapport(analyse);
  assert.strictEqual(r.rangs.length, 7);
  assert.deepStrictEqual(r.rangs.map((x) => x.ecart), ['2', '2', '3', '2', '3', '2', '2']);
  assert.strictEqual(r.rangs.filter((x) => x.fort).length, 2, 'écarts > 2 signalés aux rangs 3 et 5');
  assert.strictEqual(r.scoreTexte, '16');
  assert.strictEqual(r.aSurveiller, true);
  assert.deepStrictEqual(r.partage, { j1: 5, j2: 2, egalite: 0 });
  assert.deepStrictEqual(r.premiere, { j1: '2', j2: '4', ecart: '2' });
  assert.ok(r.blocages.some((t) => /« 5 contre 2 »/.test(t) && /vert/.test(t)));
  assert.ok(r.tempo.length === 3);
  assert.ok(!('comparaison' in r), 'plus de comparaison des modes : la règle est « villes non traversables »');
});

/* ================================================================== */
/* 3. GÉNÉRATEUR                                                       */
/* ================================================================== */

test('générateur : même graine, même plateau (200 candidats par défaut), 4×4 et 5×5', () => {
  const a = GEN.generer(libGenerateur(), { graine: 'recette' });
  const b = GEN.generer(libGenerateur(), { graine: 'recette' });
  assert.ok(a.ok, a.raison);
  assert.deepStrictEqual(a.doc, b.doc);
  assert.strictEqual(a.graine, 'recette');
  assert.strictEqual(a.score.S, b.score.S);
  const x = GEN.generer(libGenerateur(), { graine: 'recette' }), y = GEN.generer(libGenerateur(), { graine: 'recette2' });
  assert.notDeepStrictEqual(x.doc.plateau, y.doc.plateau);
  assert.deepStrictEqual(GEN.generer(libGenerateur(), { graine: 42, candidats: 20 }).doc, GEN.generer(libGenerateur(), { graine: '42', candidats: 20 }).doc);
  const c5 = GEN.generer(libGenerateur('5x5'), { graine: 'recette', candidats: 40 });
  assert.ok(c5.ok, c5.raison);
  assert.deepStrictEqual(c5.doc, GEN.generer(libGenerateur('5x5'), { graine: 'recette', candidats: 40 }).doc);
});

const GRAINES = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8'];

test('générateur : plateau valide, 16 tuiles, 7 villes, compteurs à ok, aucune erreur ni alerte', () => {
  for (const graine of GRAINES) {
    const doc = plateau(graine).doc;
    assert.strictEqual(M.validerPlateau(doc).erreurs.length, 0, graine);
    assert.strictEqual(doc.plateau.tuiles.length, 16);
    assert.strictEqual(doc.plateau.jetons.length, 7);
    assert.ok(doc.plateau.jetons.every((j) => j.type === 'capture'));
    const c = CT.calculer(doc);
    assert.deepStrictEqual(c.erreurs, [], graine);
    c.compteurs.forEach((x) => assert.strictEqual(x.etat, 'ok', graine + ' : ' + x.cle + ' ' + x.valeur + '/' + x.cible));
    assert.deepStrictEqual(c.alertes.filter((a) => a.code !== 'raccord_mort').map((a) => a.code), [], graine + ' : alertes ' + c.alertes.map((a) => a.message).join(' / '));
    assert.deepStrictEqual(doc.modeles, libGenerateur().modeles);
  }
});

test('générateur : critère v2 vérifié indépendamment (3 cases entre villes, pas de blocage, écart <= 2, première ville égale)', () => {
  for (const graine of GRAINES) {
    const doc = plateau(graine).doc;
    const e = GR.equilibre(doc);
    assert.strictEqual(e.complet, true);
    assert.deepStrictEqual(e.blocages, [], graine);
    assert.ok(Math.max(e.partage[1], e.partage[2]) < 5, graine + ' : ' + JSON.stringify(e.partage));
    assert.ok(e.ecartMax7 <= 2, graine);
    assert.strictEqual(e.premiereVille.ecart, 0, graine);
    // distances recalculées par un parcours en largeur indépendant
    const g = GR.construire(doc);
    const d = [1, 2].map((p) => {
      const m = bfs(g, g.apparitions[p], false);
      return g.jonctions.filter((j) => j.type === 'ville').map((j) => m.get(j.id)).sort((a, b) => a - b);
    });
    assert.deepStrictEqual(e.D[1], d[0]);
    assert.deepStrictEqual(e.D[2], d[1]);
    // au moins 3 cases (4 pas) entre deux villes, en villes non traversables
    for (const v of g.villes) {
      const m = bfs(g, [v], false);
      for (const w of g.villes) if (w !== v && m.has(w)) assert.ok(m.get(w) >= 4, graine + ' : villes ' + v + ' et ' + w + ' à ' + m.get(w) + ' pas');
    }
    [1, 2].forEach((p) => g.apparitions[p].forEach((id) => assert.ok(g.voisins.get(id).size >= 2, graine + ' : apparition ' + id)));
  }
});

/** Bibliothèque du catalogue dont les centrales sont des anneaux de 4 cases à port reliées (R2 violée). */
function docCatalogueAnneaux() {
  const doc = docCatalogue();
  const c = (id, x, y) => ({ id, x, y, diametre: 24, type: 'deplacement' });
  const lien = (id, a, b) => ({ id, a: { case: a }, b: { case: b } });
  const anneau = {
    id: 'C1', nom: 'Anneau', gabarit: 'centrale', grille: '4x4', exemplaires: 6,
    cases: [c('c1', 36, 36), c('c2', 84, 36), c('c3', 84, 84), c('c4', 36, 84)],
    chemins: [lien('h1', 'c1', 'c2'), lien('h2', 'c2', 'c3'), lien('h3', 'c3', 'c4'), lien('h4', 'c4', 'c1'),
      ...[0, 1, 2, 3].map((k) => ({ id: 'p' + k, a: { case: 'c' + (k + 1) }, b: { coin: k } }))]
  };
  doc.modeles = doc.modeles.filter((m) => m.gabarit !== 'centrale').concat([anneau]);
  return doc;
}

test('générateur : le catalogue v2 donne un plateau ; des centrales en anneau (R2 violée) sont refusées avec une raison qui nomme le problème', () => {
  const bon = GEN.generer(docCatalogue(), { graine: 'v2', candidats: 10 });
  assert.strictEqual(bon.ok, true, bon.raison);
  const r = GEN.generer(docCatalogueAnneaux(), { graine: 'anneaux', candidats: 10, essaisMax: 30 });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.doc, null);
  assert.match(r.raison, /villes à moins de 3 cases/);
  assert.match(r.raison, /R1 à R4/);
});

test('générateur : bibliothèque insuffisante, raison claire et document inchangé', () => {
  const cas = [];
  const sansCoins = libGenerateur(); sansCoins.modeles.forEach((m) => { if (m.gabarit === 'coin') m.exemplaires = 0; });
  cas.push(['coins à 0 exemplaire', sansCoins, /coin/]);
  const bordsCasses = libGenerateur(); bordsCasses.modeles.forEach((m) => { if (m.gabarit === 'bord') m.cases[0].diametre = 60; });
  cas.push(['bords incomplets', bordsCasses, /bord/]);
  const sansCentrale = libGenerateur(); sansCentrale.modeles = sansCentrale.modeles.filter((m) => m.gabarit !== 'centrale');
  cas.push(['sans centrale', sansCentrale, /centrale/]);
  const zero = libGenerateur(); zero.modeles.forEach((m) => { if (m.gabarit === 'centrale') m.exemplaires = 0; });
  cas.push(['centrales à 0 exemplaire', zero, /centrale/]);
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
  for (const doc of [null, undefined, 42, 'x', {}, { modeles: [] }, { modeles: [null, 3], plateau: null }, { grille: 'hexagone' }]) {
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(doc, { graine: 'x', candidats: 10 }); });
    assert.strictEqual(r.ok, false);
    assert.ok(typeof r.raison === 'string' && r.raison.length > 0);
  }
  for (const opt of [{ candidats: 0 }, { candidats: -5 }, { candidats: NaN }, { candidats: 'abc' }, { graine: '   ' }, { graine: null }, { tolerance: -1 }, { paireCarrefours: 'varies' }, { graine: { a: 1 } }]) {
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(libGenerateur(), Object.assign({ candidats: 10 }, opt)); }, JSON.stringify(opt));
    assert.ok(r.ok || typeof r.raison === 'string', JSON.stringify(opt));
    assert.ok(typeof r.graine === 'string' && r.graine.length > 0);
  }
});

test('générateur : même résultat sur le plateau vide ou rempli (seule la bibliothèque compte), entrée intacte', () => {
  const vide = libGenerateur(), plein = clone(plateau('r1').doc), avant = JSON.stringify(plein);
  const a = GEN.generer(vide, { graine: 'mm', candidats: 30 }), b = GEN.generer(plein, { graine: 'mm', candidats: 30 });
  assert.deepStrictEqual(a.doc, b.doc);
  assert.strictEqual(JSON.stringify(plein), avant);
});

test('générateur : aperçu SVG neutralise un identifiant de modèle hostile', { skip: SANS_PYMUPDF }, () => {
  const lib = libGenerateur();
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

test('contrôles : plateau complet très déséquilibré = erreur (« 5 contre 2 ») ; incomplet = rien', () => {
  const des = AV2.plateauDesequilibre();
  const c = CT.calculer(des);
  const e = c.erreurs.filter((x) => x.code === 'desequilibre');
  assert.strictEqual(e.length, 1);
  assert.match(e[0].message, /5 contre 2/);
  assert.ok(c.regroupees[0].code === 'desequilibre' && c.regroupees[0].niveau === 'erreur');
  // mêmes critères que PM.graphe
  assert.ok(GR.equilibre(des).blocages.every((b) => e[0].message.includes(b.message.replace(/\.$/, ''))));
  const moins = clone(des); moins.plateau.tuiles.pop();
  assert.deepStrictEqual(CT.calculer(moins).erreurs.filter((x) => x.code === 'desequilibre'), []);
  const moinsVille = clone(des); moinsVille.plateau.jetons.pop();
  assert.deepStrictEqual(CT.calculer(moinsVille).erreurs.filter((x) => x.code === 'desequilibre'), []);
});

test('contrôles : déséquilibre modéré = alerte « à surveiller », reprise de PM.graphe', () => {
  const doc = AV2.plateauASurveiller();
  const c = CT.calculer(doc);
  assert.deepStrictEqual(c.erreurs, []);
  const attendu = GR.equilibre(doc).alertes.filter((a) => ['score_s', 'ecart_rang_etendu', 'premiere_ville_inegale', 'ville_inaccessible'].includes(a.code)).map((a) => a.code).sort();
  assert.deepStrictEqual(c.alertes.filter((a) => ['score_s', 'ecart_rang_etendu', 'premiere_ville_inegale', 'ville_inaccessible'].includes(a.code)).map((a) => a.code).sort(), attendu);
  assert.ok(attendu.includes('score_s'));
});

test('contrôles : silence quand PM.graphe lève une exception', () => {
  const sauve = GR.equilibre;
  GR.equilibre = () => { throw new Error('boum'); };
  try {
    assert.doesNotThrow(() => CT.calculer(AV2.plateauDesequilibre()));
    assert.deepStrictEqual(CT.calculer(AV2.plateauDesequilibre()).erreurs, []);
  } finally { GR.equilibre = sauve; }
});

test('générateur x contrôles : un plateau généré ne porte aucune erreur ni alerte', () => {
  let avecAlerte = null;
  for (const graine of GRAINES) {
    const al = CT.calculer(plateau(graine).doc).alertes.filter((a) => a.code !== 'raccord_mort');
    if (al.length) { avecAlerte = graine + ' : ' + al.map((a) => a.code).join(', '); break; }
  }
  assert.strictEqual(avecAlerte, null, 'plateau généré avec alerte : ' + avecAlerte);
});

test.after(() => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignoré */ } });

/* ================================================================== */
/* Défauts constatés autrefois (non-régression)                         */
/* ================================================================== */

test('rapport d\'équilibre : les rangs 5 à 7 comptent comme les rangs 1 à 4 (docs/archives/16 b)', () => {
  const g = grapheDistances([[2, 2], [3, 3], [4, 4], [5, 5], [6, 9], [7, 10], [8, 11]]);
  const analyse = { graphe: g, resultat: GR.equilibre(VIDE(), { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  assert.deepStrictEqual(PM.equilibre.rapport(analyse).rangs.map((x) => x.compte), [true, true, true, true, true, true, true]);
});

test('rapport d\'équilibre : un même écart n\'est pas annoncé deux fois', () => {
  const g = grapheDistances([[2, 2], [3, 3], [4, 4], [5, 5], [6, 6], [7, 7], [8, 12]]);
  const analyse = { graphe: g, resultat: GR.equilibre(VIDE(), { graphe: g }), goulets: { 1: GR.goulets(g, 1), 2: GR.goulets(g, 2) } };
  const r = PM.equilibre.rapport(analyse);
  assert.strictEqual(r.alertes.concat(r.blocages).filter((t) => /pas d'écart/.test(t)).length, 1, r.alertes.concat(r.blocages).join(' / '));
});

test('équilibre : une tuile posée dont le modèle est introuvable rend le plateau incomplet', () => {
  const doc = clone(plateau('graphe').doc);
  doc.plateau.tuiles[0].modeleId = 'fantome';
  assert.strictEqual(GR.equilibre(doc).complet, false);
});
