'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/sauvegarde.js');
const M = globalThis.PM.modele;
const S = globalThis.PM.sauvegarde;

/* ---------- outils de test ---------- */
const copie = (o) => JSON.parse(JSON.stringify(o));

/** Faux localStorage (Map). */
function fauxStockage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
    _m: m
  };
}
/** Faux localStorage qui lève toujours (quota plein, accès refusé). */
const stockageEnPanne = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
  removeItem() { throw new Error('SecurityError'); }
};

/** Document de test construit à partir des exemples (ids ex-*, pas ceux du catalogue). */
function documentTest() {
  const d = M.nouveauDocument();
  d.modeles = M.copieExemples();
  let r = M.poserTuile(d, 'ex-centrale', 1, 1);
  r = M.poserTuile(r, 'ex-coin', 0, 0);
  r.plateau.jetons.push({ i: 1, j: 1, type: 'capture' });
  return r;
}

/* ---------- aller-retour JSON ---------- */

test('versJSON puis depuisJSON redonne le même document', () => {
  const doc = documentTest();
  const texte = S.versJSON(doc);
  const r = S.depuisJSON(texte);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.doc, doc);
  assert.deepStrictEqual(r.erreurs, []);
});

test('versJSON écrit un en-tête format, version, grille et date ISO en tête', () => {
  const texte = S.versJSON(documentTest());
  const objet = JSON.parse(texte);
  assert.deepStrictEqual(Object.keys(objet).slice(0, 5), ['format', 'version', 'grille', 'date', 'modeles']);
  assert.strictEqual(objet.format, 'plateau-modulaire');
  assert.strictEqual(objet.version, 2);
  assert.strictEqual(objet.grille, '4x4');
  assert.match(objet.date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(texte.includes('\n  "modeles"'), 'JSON indenté');
});

test('un document nu {version, grille, modeles, plateau} est accepté', () => {
  const doc = documentTest();
  const r = S.depuisJSON(JSON.stringify({ version: 2, grille: '4x4', modeles: doc.modeles, plateau: doc.plateau }));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.doc, doc);
  // grille absente = 4×4
  assert.strictEqual(S.depuisJSON(JSON.stringify({ version: 2, modeles: [], plateau: { tuiles: [] } })).doc.grille, '4x4');
});

test('les champs inconnus sont ignorés, les ids conservés', () => {
  const doc = documentTest();
  const objet = JSON.parse(S.versJSON(doc));
  objet.extra = 'ignoré';
  objet.modeles[0].couleurBizarre = 'x';
  objet.modeles[0].cases[0].champInconnu = 1;
  objet.plateau.tuiles[0].autre = true;
  const r = S.depuisJSON(JSON.stringify(objet));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.modeles[0].couleurBizarre, undefined);
  assert.strictEqual(r.doc.modeles[0].cases[0].champInconnu, undefined, 'champs inconnus des cases écartés (revue B1)');
  assert.strictEqual(r.doc.plateau.tuiles[0].autre, undefined);
  assert.strictEqual(r.doc.modeles[0].id, doc.modeles[0].id);
});

/* ---------- fichiers refusés : ok:false, jamais d'exception ---------- */

const ENVELOPPE = { format: 'plateau-modulaire', version: 1, date: '2026-10-15T00:00:00.000Z' };
const corrompus = {
  'texte vide': '',
  'espaces seuls': '   \n ',
  'JSON tronqué': S.versJSON(documentTest()).slice(0, 120),
  'null': 'null',
  'tableau': '[1, 2, 3]',
  'nombre': '42',
  'mauvais format': JSON.stringify({ ...ENVELOPPE, format: 'autre' }),
  'version 99': JSON.stringify({ ...ENVELOPPE, version: 99 }),
  'version absente': JSON.stringify({ format: 'plateau-modulaire', modeles: [], plateau: {} }),
  'modeles non tableau': JSON.stringify({ ...ENVELOPPE, modeles: {}, plateau: { tuiles: [] } }),
  'modeles absents': JSON.stringify({ ...ENVELOPPE, plateau: { tuiles: [] } }),
  'plateau absent': JSON.stringify({ ...ENVELOPPE, modeles: [] }),
  'plateau null': JSON.stringify({ ...ENVELOPPE, modeles: [], plateau: null }),
  'plateau tableau': JSON.stringify({ ...ENVELOPPE, modeles: [], plateau: [] }),
  'tuiles non tableau': JSON.stringify({ ...ENVELOPPE, modeles: [], plateau: { tuiles: 'x' } })
};

for (const [nom, texte] of Object.entries(corrompus)) {
  test(`fichier refusé sans exception : ${nom}`, () => {
    let r;
    assert.doesNotThrow(() => { r = S.depuisJSON(texte); });
    assert.strictEqual(r.ok, false);
    assert.ok(Array.isArray(r.erreurs) && r.erreurs.length > 0);
    assert.strictEqual(typeof r.erreurs[0].message, 'string');
  });
}

test('depuisJSON ne lève jamais, même pour des entrées non textuelles', () => {
  for (const entree of [undefined, null, 0, {}, [], true]) {
    let r;
    assert.doesNotThrow(() => { r = S.depuisJSON(entree); });
    assert.strictEqual(r.ok, false);
  }
});

/** Mutations : chaque champ remplacé par des valeurs inattendues. Aucune exception, et le résultat est exploitable. */
test('mutations de structure : aucune exception, résultat exploitable', () => {
  const base = JSON.parse(S.versJSON(documentTest()));
  const chemins = [
    ['format'], ['version'], ['modeles'], ['modeles', 0], ['modeles', 0, 'cases'],
    ['modeles', 0, 'chemins'], ['plateau'], ['grille'], ['modeles', 0, 'gabarit'], ['modeles', 0, 'grille'],
    ['plateau', 'tuiles', 0], ['plateau', 'jetons', 0], ['plateau', 'tuiles'], ['plateau', 'jetons']
  ];
  const valeurs = [null, 'x', 5, [], {}];
  let compte = 0;
  for (const chemin of chemins) {
    for (const val of valeurs) {
      const objet = copie(base);
      let cible = objet;
      for (let k = 0; k < chemin.length - 1; k++) cible = cible[chemin[k]];
      cible[chemin[chemin.length - 1]] = val;
      const texte = JSON.stringify(objet);
      let r;
      assert.doesNotThrow(() => { r = S.depuisJSON(texte); }, `chemin ${chemin.join('.')} = ${JSON.stringify(val)}`);
      assert.strictEqual(typeof r.ok, 'boolean');
      if (r.ok) {
        assert.doesNotThrow(() => M.validerPlateau(r.doc), `validerPlateau après ${chemin.join('.')}`);
      } else {
        assert.ok(r.erreurs.length > 0);
      }
      compte++;
    }
  }
  assert.strictEqual(compte, chemins.length * valeurs.length);
});

test('contenus internes mal formés : le document reste utilisable par le rendu et la validation', () => {
  const cas = [
    (d) => { d.modeles[0].cases = [{}]; },
    (d) => { d.modeles[0].cases = [{ id: 'c1', x: 'a' }]; },
    (d) => { d.modeles[0].chemins = [{ id: 'h', a: { case: 'inexistant' }, b: { case: 'c1' } }]; },
    (d) => { d.modeles[0].chemins = [{ a: null, b: 5 }]; },
    (d) => { d.modeles[0].grille = '9x9'; },
    (d) => { d.modeles[0].cases = [{ id: 5, x: 1, y: 1, diametre: 'a', type: 3 }]; },
    (d) => { d.plateau.tuiles = [{ modeleId: 'ex-centrale', col: 1, lig: 1, rot: 9 }]; },
    (d) => { d.modeles[0].gabarit = 'truc'; }
  ];
  for (const mutation of cas) {
    const d = M.nouveauDocument();
    d.modeles = M.copieExemples();
    mutation(d);
    const r = S.depuisJSON(JSON.stringify(d));
    if (!r.ok) continue;
    const m = r.doc.modeles[0];
    assert.doesNotThrow(() => {
      PM.rendu.contenuTuile(m, { rot: 0 });
      PM.rendu.tracesModele(m);
      M.masquesDuModele(m);
      M.validerPlateau(r.doc);
      M.validerModele(m);
    }, `après mutation ${mutation.toString()}`);
  }
});

/* ---------- plateau imparfait : ok:true + alertes ---------- */

test('un plateau imparfait s\'ouvre avec des alertes', () => {
  const doc = documentTest();
  doc.plateau.tuiles.push({ modeleId: 'inconnu', col: 2, lig: 2, rot: 0 });
  const r = S.depuisJSON(S.versJSON(doc));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.erreurs.length, 0);
  assert.ok(r.alertes.length > 0, 'des alertes sont remontées');
  assert.ok(r.alertes.every((a) => typeof a.message === 'string'));
  assert.strictEqual(r.doc.plateau.tuiles.length, 3, 'la tuile imparfaite est conservée');
});

test('un modèle invalide est conservé comme brouillon avec une alerte', () => {
  const doc = documentTest();
  doc.modeles.push({ id: 'brouillon-1', nom: 'Brouillon', gabarit: 'bord', exemplaires: 1, cases: [{ id: 'c1', x: 60, y: 60, diametre: 24, type: 'deplacement' }], chemins: [] });
  const r = S.depuisJSON(S.versJSON(doc));
  assert.strictEqual(r.ok, true);
  assert.ok(r.doc.modeles.some((m) => m.id === 'brouillon-1'));
  assert.ok(r.alertes.some((a) => a.code === 'modele_incomplet' && a.message.includes('Brouillon')));
});

test('des identifiants de modèle en double sont renommés et signalés', () => {
  const doc = documentTest();
  doc.modeles.push(copie(doc.modeles[0]));
  const r = S.depuisJSON(S.versJSON(doc));
  assert.strictEqual(r.ok, true);
  const ids = r.doc.modeles.map((m) => m.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'identifiants uniques');
  assert.ok(ids.includes(`${doc.modeles[0].id}-2`));
  assert.ok(r.alertes.some((a) => a.code === 'id_renomme'));
});

test('un élément de plateau mal formé est ignoré avec une alerte', () => {
  const doc = documentTest();
  const objet = JSON.parse(S.versJSON(doc));
  objet.plateau.tuiles.push(null, 'texte');
  const r = S.depuisJSON(JSON.stringify(objet));
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.plateau.tuiles.length, doc.plateau.tuiles.length);
  assert.ok(r.alertes.some((a) => a.code === 'tuile_ignoree'));
});

/* ---------- bibliothèque ---------- */

test('bibliothequeVersJSON puis fusionnerBibliotheque sans conflit ajoute tous les modèles', () => {
  const source = documentTest();
  const cible = M.nouveauDocument();
  const r = S.fusionnerBibliotheque(cible, S.bibliothequeVersJSON(source));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.ajoutes, source.modeles.map((m) => m.id));
  assert.deepStrictEqual(r.renommes, []);
  assert.deepStrictEqual(r.doc.modeles, source.modeles);
  assert.deepStrictEqual(r.doc.plateau, cible.plateau, 'le plateau n\'est pas modifié');
});

test('fusionnerBibliotheque renomme les identifiants en conflit (id-2) et le signale', () => {
  const doc = documentTest();
  const idsAvant = doc.modeles.map((m) => m.id);
  const identique = { format: 'plateau-modulaire', version: 1, modeles: [copie(doc.modeles[0]), copie(doc.modeles[1])] };
  const r = S.fusionnerBibliotheque(doc, JSON.stringify(identique));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.renommes, [
    { de: doc.modeles[0].id, a: `${doc.modeles[0].id}-2` },
    { de: doc.modeles[1].id, a: `${doc.modeles[1].id}-2` }
  ]);
  assert.strictEqual(r.doc.modeles.length, doc.modeles.length + 2);
  assert.deepStrictEqual(r.doc.plateau, doc.plateau, 'le plateau n\'est pas modifié');
  assert.deepStrictEqual(doc.modeles.map((m) => m.id), idsAvant, 'document d\'origine intact');
});

test('fusionnerBibliotheque renomme aussi deux modèles de même id dans le fichier', () => {
  const m = copie(M.exemples[0]);
  const r = S.fusionnerBibliotheque(M.nouveauDocument(), JSON.stringify({ version: 1, modeles: [m, copie(m)] }));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.ajoutes, [m.id, `${m.id}-2`]);
});

test('fusionnerBibliotheque refuse un texte illisible et garde le document', () => {
  const doc = documentTest();
  for (const texte of ['', '{', 'null', JSON.stringify({ version: 99, modeles: [] }), JSON.stringify({ version: 1, modeles: 'x' })]) {
    let r;
    assert.doesNotThrow(() => { r = S.fusionnerBibliotheque(doc, texte); });
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.doc, doc);
    assert.ok(r.erreurs.length > 0);
  }
});

/* ---------- sauvegarde automatique (faux localStorage injecté) ---------- */

test('autosave écrit sous la clé attendue, restaurerAutosave relit le document', () => {
  const st = fauxStockage();
  S.effacerAutosave(st);
  const doc = documentTest();
  assert.strictEqual(S.autosave(doc, st), true, 'première écriture immédiate');
  assert.strictEqual(S.CLE_AUTOSAVE, 'plateau-modulaire:autosave');
  assert.ok(st._m.has('plateau-modulaire:autosave'));
  const r = S.restaurerAutosave(st);
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.doc, doc);
  assert.match(r.date, /^\d{4}-\d{2}-\d{2}T/);
});

test('autosave limite la fréquence : la dernière demande gagne après le délai', async () => {
  const st = fauxStockage();
  S.effacerAutosave(st);
  const d1 = documentTest();
  const d2 = M.nouveauDocument();
  d2.modeles = M.copieExemples();
  const d3 = M.poserTuile(d2, 'ex-bord', 0, 1);
  assert.strictEqual(S.autosave(d1, st), true);
  assert.strictEqual(S.autosave(d2, st), false, 'différée (moins d\'une seconde après la précédente)');
  assert.strictEqual(S.autosave(d3, st), false);
  assert.deepStrictEqual(S.restaurerAutosave(st).doc, d1, 'pas encore réécrit');
  await new Promise((res) => setTimeout(res, 1100));
  assert.deepStrictEqual(S.restaurerAutosave(st).doc, d3, 'la dernière demande a été écrite');
  S.effacerAutosave(st);
});

test('effacerAutosave supprime la sauvegarde et annule l\'écriture différée', async () => {
  const st = fauxStockage();
  S.effacerAutosave(st);
  S.autosave(documentTest(), st);
  S.autosave(M.nouveauDocument(), st);   // différée
  S.effacerAutosave(st);
  await new Promise((res) => setTimeout(res, 1100));
  assert.strictEqual(st._m.has('plateau-modulaire:autosave'), false, 'l\'écriture différée n\'est pas revenue');
  assert.strictEqual(S.restaurerAutosave(st), null);
});

test('restaurerAutosave renvoie null si rien n\'est enregistré ou si le contenu est illisible', () => {
  const st = fauxStockage();
  S.effacerAutosave(st);
  assert.strictEqual(S.restaurerAutosave(st), null);
  st._m.set('plateau-modulaire:autosave', '{ pas du json');
  assert.strictEqual(S.restaurerAutosave(st), null);
  st._m.set('plateau-modulaire:autosave', JSON.stringify({ version: 99, modeles: [], plateau: {} }));
  assert.strictEqual(S.restaurerAutosave(st), null);
});

test('stockage qui lève une exception : écriture immédiate refusée sans exception', () => {
  S.effacerAutosave(stockageEnPanne);
  let ecrit;
  assert.doesNotThrow(() => { ecrit = S.autosave(documentTest(), stockageEnPanne); });
  assert.strictEqual(ecrit, false, 'setItem lève : l\'écriture immédiate échoue');
  assert.doesNotThrow(() => S.effacerAutosave(stockageEnPanne));
  assert.strictEqual(S.restaurerAutosave(stockageEnPanne), null);
});

test('stockage absent (null) : écriture immédiate refusée sans exception', () => {
  S.effacerAutosave(null);
  let ecrit;
  assert.doesNotThrow(() => { ecrit = S.autosave(documentTest(), null); });
  assert.strictEqual(ecrit, false, 'pas de stockage : pas d\'écriture immédiate');
  assert.strictEqual(S.restaurerAutosave(null), null);
  S.effacerAutosave(null);
});

/* ---------- Node : fonctions navigateur gardées ---------- */

test('telecharger sous Node lève une Error explicite (pas de plantage silencieux)', () => {
  assert.throws(() => S.telecharger(documentTest(), 'x.json'), /pas disponible/);
});

test('ouvrirFichier sous Node résout null sans planter', async () => {
  assert.strictEqual(await S.ouvrirFichier(), null);
});

test('sécurité (revue B1) : un fichier piégé ne fait passer aucun balisage dans les cases ni les chemins', () => {
  const S = globalThis.PM.sauvegarde;
  const piege = '0"/><foreignObject><img src=x onerror=alert(1)></foreignObject><circle cx="0';
  const m = { id: 'P', nom: 'piège', gabarit: 'centrale', exemplaires: 1,
    cases: [{ id: 'c1', x: piege, y: 10, diametre: 24, type: 'deplacement' }, { id: 'c2', x: 60, y: 60, diametre: piege, type: 'deplacement' },
      { id: 'c3', x: 40, y: 40, type: 'deplacement', extra: piege }],
    chemins: [{ id: 'k1', a: { case: 'c3' }, b: { raccord: { cote: piege, pos: 1 } } }, { id: 'k2', a: { case: 'c3' }, b: { coin: 0, extra: piege } }] };
  const r = S.depuisJSON(JSON.stringify({ format: 'plateau-modulaire', version: 2, modeles: [m], plateau: { tuiles: [], jetons: [] } }));
  assert.equal(r.ok, true);
  const texte = JSON.stringify(r.doc.modeles);
  assert.ok(!texte.includes('onerror'), texte);
  const mm = r.doc.modeles[0];
  assert.deepEqual(mm.cases.map((c) => c.id), ['c3']);
  assert.deepEqual(mm.chemins.map((c) => c.id), ['k2']);
  assert.ok(r.alertes.some((a) => a.code === 'elements_ignores'));
});

test('audit de sécurité : plafonds à l’ouverture (taille, tableaux, valeurs)', () => {
  const S = globalThis.PM.sauvegarde, L = S.LIMITES;
  const env = (modeles, plateau) => JSON.stringify({ format: 'plateau-modulaire', version: 2, modeles, plateau: plateau || { tuiles: [], jetons: [] } });
  // fichier trop volumineux : refusé avant JSON.parse
  const gros = S.depuisJSON(' '.repeat(L.octets + 1) + '{}');
  assert.equal(gros.ok, false);
  assert.equal(gros.erreurs[0].code, 'trop_gros');
  // trop de cases : tronquées ; gabarit non textuel → '' ; coordonnée extrême écartée ; exemplaires bornés
  const cases = Array.from({ length: L.cases + 50 }, (_, k) => ({ id: 'c' + k, x: 10, y: 10, diametre: 24, type: 'deplacement' }));
  cases.push({ id: 'z', x: 1e308, y: 10 });
  const r = S.depuisJSON(env([{ id: 'M', nom: 'n', gabarit: { pas: 'texte' }, exemplaires: 1e308, cases, chemins: [] }]));
  assert.equal(r.ok, true);
  assert.equal(r.doc.modeles[0].cases.length, L.cases);
  assert.equal(r.doc.modeles[0].gabarit, '');
  assert.equal(r.doc.modeles[0].exemplaires, 0);
  // trop de tuiles : seules les premières sont lues, avec une alerte
  const tuiles = Array.from({ length: L.tuiles + 10 }, () => ({ modeleId: 'M', col: 1, lig: 1, rot: 0 }));
  const t = S.depuisJSON(env([], { tuiles, jetons: [] }));
  assert.equal(t.doc.plateau.tuiles.length, L.tuiles);
  assert.ok(t.alertes.some((a) => a.code === 'tuiles_en_trop'));
});

/* ---------- version 2 : grille, migration d'un document de la version 1 ---------- */

const fs = require('fs');
const path = require('path');
/** Document réel de la version 1.00.0 (catalogue v1, coin SO retiré, 2 carrefours), écrit par le versJSON du tag 1.00.0. */
const TEXTE_V1 = fs.readFileSync(path.join(__dirname, 'donnees', 'document-v1.json'), 'utf8');

test('migration v1 → v2 : document réel de la version 1.00.0 converti, une phrase dans les alertes', () => {
  const brut = JSON.parse(TEXTE_V1);
  assert.strictEqual(brut.version, 1);
  const r = S.depuisJSON(TEXTE_V1);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.migre, true);
  assert.strictEqual(r.alertes[0].code, 'migration_v1');
  assert.match(r.alertes[0].message, /^Document de la version 1 converti/);
  assert.match(r.alertes[0].message, /1 cellule\(s\) retirée\(s\) remise\(s\)/);
  assert.match(r.alertes[0].message, /2 carrefour\(s\) supprimé\(s\)/);
  assert.strictEqual(r.alertes.filter((a) => a.code === 'migration_v1').length, 1);
  const d = r.doc;
  assert.strictEqual(d.version, 2);
  assert.strictEqual(d.grille, '4x4');
  assert.ok(!('forme' in d.plateau), 'plus de forme : grille pleine');
  // carrefours supprimés, villes conservées
  assert.deepStrictEqual(d.plateau.jetons, brut.plateau.jetons.filter((j) => j.type === 'capture'));
  assert.ok(d.plateau.jetons.every((j) => j.type === 'capture'));
  // rôle → gabarit (apparition → bord), grille sur chaque modèle, plus de champ role
  for (const m of d.modeles) {
    const v1 = brut.modeles.find((x) => x.id === m.id);
    assert.strictEqual(m.gabarit, v1.role === 'apparition' ? 'bord' : v1.role, m.id);
    assert.strictEqual(m.grille, '4x4');
    assert.ok(!('role' in m));
    assert.strictEqual(M.validerModele(m, d.grille).complet, true, m.id);
  }
  // rotations stockées telles quelles, entiers 0..3
  assert.deepStrictEqual(d.plateau.tuiles.map((t) => t.rot), brut.plateau.tuiles.map((t) => t.rot));
  assert.strictEqual(M.validerPlateau(d).erreurs.length, 0);
  // relu après écriture : version 2, plus de migration, document identique
  const r2 = S.depuisJSON(S.versJSON(d));
  assert.strictEqual(r2.migre, false);
  assert.ok(!r2.alertes.some((a) => a.code === 'migration_v1'));
  assert.deepStrictEqual(r2.doc, d);
});

test('migration : la sauvegarde automatique d\'un document v1 se rouvre convertie', () => {
  const st = fauxStockage();
  st.setItem(S.CLE_AUTOSAVE, TEXTE_V1);
  const r = S.restaurerAutosave(st);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.version, 2);
  assert.strictEqual(r.alertes[0].code, 'migration_v1');
});

test('bibliothequeVersion1 : reconnue à ses modèles A1 et A2', () => {
  const d = S.depuisJSON(TEXTE_V1).doc;
  assert.strictEqual(S.bibliothequeVersion1(d), true);
  assert.strictEqual(S.bibliothequeVersion1(documentTest()), false);
  assert.strictEqual(S.bibliothequeVersion1(undefined), false);
});

test('version 2 : grille 5×5 conservée ; grille inconnue ou version inconnue (4) refusées, version 3 lue ; carrefour d\'un fichier v2 ignoré', () => {
  const d = M.nouveauDocument('5x5');
  d.modeles = M.copieExemples('5x5');
  const r = S.depuisJSON(S.versJSON(d));
  assert.strictEqual(r.doc.grille, '5x5');
  assert.deepStrictEqual(r.doc, d);
  assert.strictEqual(S.depuisJSON(JSON.stringify({ version: 2, grille: 'hexagone', modeles: [], plateau: { tuiles: [] } })).erreurs[0].code, 'grille');
  assert.strictEqual(S.depuisJSON(JSON.stringify({ version: 4, modeles: [], plateau: { tuiles: [] } })).erreurs[0].code, 'version');
  assert.strictEqual(S.depuisJSON(JSON.stringify({ version: 3, modeles: [], plateau: { tuiles: [] } })).ok, true, 'la version 3 (passages et pivots) est lue');
  const v2 = S.depuisJSON(JSON.stringify({ version: 2, modeles: [], plateau: { tuiles: [], jetons: [{ i: 1, j: 1, type: 'carrefour' }] } }));
  assert.deepStrictEqual(v2.doc.plateau.jetons, []);
  assert.ok(v2.alertes.some((a) => a.code === 'jeton_ignore'));
  // un modèle d'une autre grille est conservé, comme brouillon (non posable sur cette grille)
  const autre = S.depuisJSON(JSON.stringify({ version: 2, grille: '4x4', modeles: M.copieExemples('5x5'), plateau: { tuiles: [] } }));
  assert.ok(autre.doc.modeles.every((m) => m.grille === '5x5'));
  assert.ok(autre.alertes.some((a) => a.code === 'modele_incomplet'));
});

test('fusionnerBibliotheque : une bibliothèque de la version 1 reçoit ses gabarits', () => {
  const v1 = JSON.parse(TEXTE_V1);
  const texte = JSON.stringify({ format: 'plateau-modulaire', version: 1, contenu: 'bibliotheque', modeles: v1.modeles });
  const r = S.fusionnerBibliotheque(M.nouveauDocument(), texte);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.doc.modeles.find((m) => m.id === 'A1').gabarit, 'bord');
  assert.strictEqual(r.doc.modeles.find((m) => m.id === 'K1').gabarit, 'coin');
  assert.ok(r.doc.modeles.every((m) => !('role' in m)));
});
