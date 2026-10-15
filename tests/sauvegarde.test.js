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

test('versJSON écrit un en-tête format, version et date ISO en tête', () => {
  const texte = S.versJSON(documentTest());
  const objet = JSON.parse(texte);
  assert.deepStrictEqual(Object.keys(objet).slice(0, 4), ['format', 'version', 'date', 'modeles']);
  assert.strictEqual(objet.format, 'plateau-modulaire');
  assert.strictEqual(objet.version, 1);
  assert.match(objet.date, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.ok(texte.includes('\n  "modeles"'), 'JSON indenté');
});

test('un document nu {version, modeles, plateau} est accepté', () => {
  const doc = documentTest();
  const r = S.depuisJSON(JSON.stringify({ version: 1, modeles: doc.modeles, plateau: doc.plateau }));
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.doc, doc);
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
    ['modeles', 0, 'chemins'], ['plateau'], ['plateau', 'forme'], ['plateau', 'forme', 'retires'],
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
    (d) => { d.plateau.forme.retires = [null, 'x', {}]; },
    (d) => { d.modeles[0].cases = [{ id: 5, x: 1, y: 1, diametre: 'a', type: 3 }]; },
    (d) => { d.plateau.tuiles = [{ modeleId: 'ex-centrale', col: 1, lig: 1, rot: 9 }]; },
    (d) => { d.modeles[0].role = 'truc'; }
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
      M.cellulesActives(r.doc.plateau.forme);
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
  doc.modeles.push({ id: 'brouillon-1', nom: 'Brouillon', role: 'bord', exemplaires: 1, cases: [], chemins: [] });
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
  const m = { id: 'P', nom: 'piège', role: 'centrale', exemplaires: 1,
    cases: [{ id: 'c1', x: piege, y: 10, diametre: 24, type: 'deplacement' }, { id: 'c2', x: 60, y: 60, diametre: piege, type: 'deplacement' },
      { id: 'c3', x: 40, y: 40, type: 'deplacement', extra: piege }],
    chemins: [{ id: 'k1', a: { case: 'c3' }, b: { raccord: { cote: piege, pos: 1 } } }, { id: 'k2', a: { case: 'c3' }, b: { coin: 0, extra: piege } }] };
  const r = S.depuisJSON(JSON.stringify({ format: 'plateau-modulaire', version: 1, modeles: [m], plateau: { forme: { retires: [] }, tuiles: [], jetons: [] } }));
  assert.equal(r.ok, true);
  const texte = JSON.stringify(r.doc.modeles);
  assert.ok(!texte.includes('onerror'), texte);
  const mm = r.doc.modeles[0];
  assert.deepEqual(mm.cases.map((c) => c.id), ['c3']);
  assert.deepEqual(mm.chemins.map((c) => c.id), ['k2']);
  assert.ok(r.alertes.some((a) => a.code === 'elements_ignores'));
});
