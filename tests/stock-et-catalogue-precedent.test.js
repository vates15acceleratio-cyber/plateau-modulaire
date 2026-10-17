'use strict';
/*
 * Stock à imprimer, poids de tirage et catalogue précédent (docs/47) :
 *  - les exemplaires du catalogue livré (stock) sont distincts du poids de tirage (champ `poids`) : les plateaux tirés ne changent pas ;
 *  - au moins 90 % des plateaux générés se montent avec les tuiles imprimées (chaque modèle posé au plus autant de fois que ses exemplaires) ;
 *  - le champ `poids` : lecture, validation, sauvegarde ;
 *  - reconnaissance d'un document qui porte encore la bibliothèque du catalogue précédent (3.04), pour proposer le nouveau catalogue.
 * La proposition elle-même (boîte de dialogue, accepter / refuser, Ctrl+Z) est vérifiée par outils/recette-interface.html (étape S6).
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
require('../src/generateur.js');
require('../src/sauvegarde.js');
const PM = globalThis.PM;
const M = PM.modele, CAT = PM.catalogue, GEN = PM.generateur, S = PM.sauvegarde;

const copie = (x) => JSON.parse(JSON.stringify(x));

/** Part des plateaux générés (graines « e0 »…) qui se montent avec les exemplaires du document. */
function partMontable(grille, nb) {
  const doc = CAT.nouveauDocument(grille);
  const stock = Object.fromEntries(doc.modeles.map((m) => [m.id, m.exemplaires]));
  let ok = 0;
  for (let k = 0; k < nb; k++) {
    const r = GEN.generer(doc, { graine: 'e' + k });
    assert.ok(r.ok, grille + ' graine e' + k);
    const u = {};
    r.doc.plateau.tuiles.forEach((t) => { u[t.modeleId] = (u[t.modeleId] || 0) + 1; });
    if (Object.keys(u).every((id) => u[id] <= stock[id])) ok++;
  }
  return ok / nb;
}

test('stock : au moins 90 % des plateaux 4×4 générés (100 graines) se montent avec les tuiles imprimées', () => {
  const p = partMontable('4x4', 100);
  assert.ok(p >= 0.9, 'part montable 4×4 : ' + p);
});

test('stock : au moins 90 % des plateaux 5×5 générés (100 graines) se montent avec les tuiles imprimées', () => {
  const p = partMontable('5x5', 100);
  assert.ok(p >= 0.9, 'part montable 5×5 : ' + p);
});

test('poids et stock distincts : porter les exemplaires au niveau du poids ne change pas les plateaux tirés (mêmes graines)', () => {
  for (const [grille, graines] of [['4x4', ['p0', 'p1', 'p2', 'p3', 'p4']], ['5x5', ['p0', 'p1']]]) {
    const livre = CAT.nouveauDocument(grille), ancien = CAT.nouveauDocument(grille);
    ancien.modeles.forEach((m) => { m.exemplaires = m.poids; delete m.poids; }); // catalogue de docs/46 : exemplaires = poids
    for (const g of graines) {
      const a = GEN.generer(livre, { graine: g }), b = GEN.generer(ancien, { graine: g });
      assert.ok(a.ok && b.ok);
      assert.deepStrictEqual(a.doc.plateau, b.doc.plateau, grille + ' ' + g);
    }
  }
});

test('poids : champ facultatif ; absent, il vaut les exemplaires ; un modèle à 0 exemplaire n\'est jamais tiré', () => {
  const doc = CAT.nouveauDocument('4x4');
  const b8 = doc.modeles.find((m) => m.id === 'B8');
  assert.strictEqual(b8.exemplaires, 3);
  assert.strictEqual(b8.poids, 1);
  assert.strictEqual(M.poidsTirage(b8), 1);
  delete b8.poids;
  assert.strictEqual(M.poidsTirage(b8), 3);
  b8.poids = 0; b8.poids = 'x';
  assert.strictEqual(M.poidsTirage(b8), 3, 'poids invalide : exemplaires');
  assert.strictEqual(M.poidsTirage(null), 0);
  const F = M.formatDuDocument(doc);
  b8.poids = 7;
  assert.strictEqual(GEN.modelesParGabarit(doc, F).bord.find((m) => m.id === 'B8').poids, 7);
  b8.exemplaires = 0;
  assert.ok(!GEN.modelesParGabarit(doc, F).bord.some((m) => m.id === 'B8'));
});

test('poids : validation (entier d\'au moins 1) et sauvegarde (conservé s\'il est valide, ignoré sinon)', () => {
  const doc = CAT.nouveauDocument('4x4');
  const m = doc.modeles[0];
  assert.ok(!M.validerModele(m, '4x4').erreurs.some((e) => e.code === 'poids_invalide'));
  for (const mauvais of [0, -1, 1.5, 'x']) {
    const c = copie(m); c.poids = mauvais;
    assert.ok(M.validerModele(c, '4x4').erreurs.some((e) => e.code === 'poids_invalide'), String(mauvais));
  }
  const r = S.depuisJSON(S.versJSON(doc));
  assert.ok(r.ok);
  assert.deepStrictEqual(r.doc.modeles.map((x) => x.poids), doc.modeles.map((x) => x.poids));
  assert.deepStrictEqual(r.doc.modeles.map((x) => x.exemplaires), doc.modeles.map((x) => x.exemplaires));
  const brut = JSON.parse(S.versJSON(doc));
  brut.modeles[0].poids = 0; brut.modeles[1].poids = 'x'; brut.modeles[2].poids = 2.5; delete brut.modeles[3].poids;
  const r2 = S.depuisJSON(JSON.stringify(brut));
  assert.ok(r2.ok);
  assert.ok(r2.doc.modeles.slice(0, 4).every((x) => !('poids' in x)));
  assert.strictEqual(r2.doc.modeles[4].poids, doc.modeles[4].poids);
});

/* ---------------------------- catalogue précédent reconnu ---------------------------- */

/** Document de la grille portant le catalogue précédent (3.04) et une tuile posée de l'un de ses modèles. */
function documentPrecedent(grille) {
  const d = CAT.nouveauDocument(grille);
  d.modeles = copie(CAT.precedent[grille]);
  const t = grille === '4x4' ? { modeleId: 'C1', col: 1, lig: 1, rot: 0 } : { modeleId: 'C7', col: 1, lig: 1, rot: 0 };
  d.plateau.tuiles = [t];
  return d;
}

test('catalogue précédent : reconnu en 4×4 et en 5×5, directement et après un aller-retour de sauvegarde', () => {
  for (const g of ['4x4', '5x5']) {
    const d = documentPrecedent(g);
    assert.strictEqual(S.bibliothequeCataloguePrecedent(d), true, g);
    const r = S.depuisJSON(S.versJSON(d));
    assert.ok(r.ok);
    assert.strictEqual(S.bibliothequeCataloguePrecedent(r.doc), true, g + ' relu');
    assert.strictEqual(r.doc.plateau.tuiles.length, 1);
  }
});

test('catalogue précédent : les exemplaires et les noms modifiés ne changent pas la reconnaissance', () => {
  const d = documentPrecedent('4x4');
  d.modeles.forEach((m, k) => { m.exemplaires = k + 5; m.nom = 'Mon ' + m.nom; });
  assert.strictEqual(S.bibliothequeCataloguePrecedent(d), true);
});

test('catalogue précédent : non reconnu pour le nouveau catalogue, un modèle modifié, ajouté ou retiré, la version 1 ou un document absent', () => {
  for (const g of ['4x4', '5x5']) {
    assert.strictEqual(S.bibliothequeCataloguePrecedent(CAT.nouveauDocument(g)), false, 'nouveau catalogue ' + g);
    const bouge = documentPrecedent(g);
    bouge.modeles[0].cases[0].x += 1;
    assert.strictEqual(S.bibliothequeCataloguePrecedent(bouge), false, 'case déplacée ' + g);
    const moins = documentPrecedent(g);
    moins.modeles.pop();
    assert.strictEqual(S.bibliothequeCataloguePrecedent(moins), false, 'modèle retiré ' + g);
    const plus = documentPrecedent(g);
    plus.modeles.push(Object.assign(copie(plus.modeles[0]), { id: 'perso' }));
    assert.strictEqual(S.bibliothequeCataloguePrecedent(plus), false, 'modèle ajouté ' + g);
    const mele = documentPrecedent(g);
    mele.modeles[0] = copie(CAT.modelesParGrille[g].find((m) => m.gabarit === mele.modeles[0].gabarit));
    assert.strictEqual(S.bibliothequeCataloguePrecedent(mele), false, 'modèle du nouveau catalogue mêlé ' + g);
  }
  for (const x of [undefined, null, {}, { modeles: 'x' }, { grille: '9x9', modeles: [] }]) assert.strictEqual(S.bibliothequeCataloguePrecedent(x), false);
  const fs = require('fs'), path = require('path');
  const v1 = S.depuisJSON(fs.readFileSync(path.join(__dirname, 'donnees', 'document-v1.json'), 'utf8')).doc;
  assert.strictEqual(S.bibliothequeCataloguePrecedent(v1), false);
});

test('catalogue précédent : le remplacement par le nouveau catalogue garde la grille et vide le plateau', () => {
  for (const g of ['4x4', '5x5']) {
    const nouveau = CAT.nouveauDocument(g);
    assert.strictEqual(nouveau.grille, g);
    assert.deepStrictEqual(nouveau.plateau, { tuiles: [], jetons: [] });
    assert.ok(nouveau.modeles.every((m) => !CAT.precedent[g].some((p) => p.id === m.id) || ['B1', 'K2', 'K4', 'B7'].includes(m.id)));
  }
});

test('catalogue précédent : de vrais documents écrits par la version 3.04.0 (versJSON de l\'étiquette 3.04.0) sont reconnus', () => {
  const fs = require('fs'), path = require('path');
  for (const g of ['4x4', '5x5']) {
    const texte = fs.readFileSync(path.join(__dirname, 'donnees', 'document-3.04-' + g + '.json'), 'utf8');
    const r = S.depuisJSON(texte);
    assert.ok(r.ok && r.alertes.length === 0, g);
    assert.strictEqual(r.doc.grille, g);
    assert.strictEqual(r.doc.plateau.tuiles.length, 1);
    assert.strictEqual(S.bibliothequeCataloguePrecedent(r.doc), true, g);
  }
});
