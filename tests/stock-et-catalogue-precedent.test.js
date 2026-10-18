'use strict';
/*
 * Stock à imprimer, poids de tirage et catalogue précédent (docs/47) :
 *  - les exemplaires du catalogue livré (stock) sont distincts du poids de tirage (champ `poids`) : les plateaux tirés ne changent pas ;
 *  - au moins 90 % des plateaux générés se montent avec les tuiles imprimées (chaque modèle posé au plus autant de fois que ses exemplaires) ;
 *  - le champ `poids` : lecture, validation, sauvegarde ;
 *  - reconnaissance d'un document qui porte encore la bibliothèque du catalogue précédent (3.04), pour proposer le nouveau catalogue.
 * La proposition elle-même (boîte de dialogue, accepter / refuser, Ctrl+Z) est vérifiée par outils/recette-interface.html (étapes S6 et S11,
 * cette dernière au démarrage depuis une sauvegarde automatique 3.04).
 * Le stock est vérifié ici sur 100 graines par format, la cible de docs/18 étant mesurée sur 200 (95,5 % en 4×4 et 97,5 % en 5×5, docs/50) :
 * la marge sur 90 % rend les 100 graines suffisantes pour une garde de non-régression (docs/51, remarque 10).
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

/**
 * Part des plateaux générés (graines « e0 »…) qui se montent avec les exemplaires du document. Le calcul est réparti sur FILS fils
 * (tests/aides-stock-worker.js) : mêmes graines, même vérification, même seuil de 90 % : sans cela ces deux tests prenaient 145 s de la suite (107 s en 5×5).
 * Les deux formats démarrent dès le chargement du fichier et se calculent en même temps.
 */
const { Worker } = require('node:worker_threads');
const path = require('node:path');
const FILS = 4;
function partMontableAsync(grille, nb) {
  const taille = Math.ceil(nb / FILS);
  const travaux = [];
  for (let d = 0; d < nb; d += taille) {
    travaux.push(new Promise((resolve, reject) => {
      const w = new Worker(path.join(__dirname, 'aides-stock-worker.js'), { workerData: { grille, debut: d, fin: Math.min(nb, d + taille) } });
      w.once('message', resolve); w.once('error', reject);
      w.once('exit', (code) => { if (code !== 0) reject(new Error('fil de calcul du stock ' + grille + ' arrêté (code ' + code + ')')); });
    }));
  }
  return Promise.all(travaux).then((rs) => {
    rs.forEach((r) => assert.deepStrictEqual(r.echecs, [], grille));
    return rs.reduce((s, r) => s + r.montables, 0) / nb;
  });
}
const PART_4x4 = partMontableAsync('4x4', 100), PART_5x5 = partMontableAsync('5x5', 100);
PART_4x4.catch(() => {}); PART_5x5.catch(() => {}); // le rejet est rapporté par le test qui attend la promesse, pas comme rejet non géré

test('stock : au moins 90 % des plateaux 4×4 générés (100 graines) se montent avec les tuiles imprimées', async () => {
  const p = await PART_4x4;
  assert.ok(p >= 0.9, 'part montable 4×4 : ' + p);
});

test('stock : au moins 90 % des plateaux 5×5 générés (100 graines) se montent avec les tuiles imprimées', async () => {
  const p = await PART_5x5;
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

test('poids : validation (entier de 1 à 999, alerte sinon) et sauvegarde (conservé s\'il est valide, ignoré sinon)', () => {
  const doc = CAT.nouveauDocument('4x4');
  const m = doc.modeles[0];
  assert.ok(!M.validerModele(m, '4x4').erreurs.some((e) => e.code === 'poids_invalide'));
  for (const mauvais of [0, -1, 1.5, 'x', 1000]) {
    const c = copie(m); c.poids = mauvais;
    const v = M.validerModele(c, '4x4');   // alerte seule : le tirage retombe sur les exemplaires (docs/51, remarque 5)
    assert.ok(v.alertes.some((e) => e.code === 'poids_invalide') && !v.erreurs.some((e) => e.code === 'poids_invalide'), String(mauvais));
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

/* ---------- catalogue 5×5 de la version 4.00.0 (organique), précédent du catalogue à 2 cases par tuile (docs/55, docs/56) ---------- */

test('catalogue précédent 4.00.0 (5×5) : un vrai document écrit par la version 4.00.0 est reconnu, après aller-retour aussi ; modifié, il ne l\'est plus', () => {
  const fs = require('fs'), path = require('path');
  const texte = fs.readFileSync(path.join(__dirname, 'donnees', 'document-4.00-5x5.json'), 'utf8');
  const r = S.depuisJSON(texte);
  assert.ok(r.ok, JSON.stringify(r.erreurs));
  assert.strictEqual(r.doc.grille, '5x5');
  assert.strictEqual(r.doc.plateau.tuiles.length, 25);
  assert.deepStrictEqual(r.doc.modeles.map((m) => m.id), ['U1', 'P3', 'P5', 'P1', 'P2', 'B1', 'B7', 'K2']);
  assert.strictEqual(S.bibliothequeCataloguePrecedent(r.doc), true);
  assert.strictEqual(S.bibliothequeCataloguePrecedent(S.depuisJSON(S.versJSON(r.doc)).doc), true, 'relu');
  // le document s'ouvre tel quel (ses copies de modèles), sans erreur
  assert.deepStrictEqual(M.validerPlateau(r.doc).erreurs, []);
  // exemplaires et noms changés : toujours reconnu ; une case déplacée ou un modèle en plus : plus reconnu
  const ex = copie(r.doc); ex.modeles.forEach((m) => { m.exemplaires = 1; m.nom = 'x'; });
  assert.strictEqual(S.bibliothequeCataloguePrecedent(ex), true);
  const bouge = copie(r.doc); bouge.modeles[0].cases[0].x += 2;
  assert.strictEqual(S.bibliothequeCataloguePrecedent(bouge), false);
  const plus = copie(r.doc); plus.modeles.push(Object.assign(copie(plus.modeles[0]), { id: 'perso' }));
  assert.strictEqual(S.bibliothequeCataloguePrecedent(plus), false);
  // mélange 4.00.0 et 3.04 (C7 à la place de U1) : aucun des deux catalogues
  const mele = copie(r.doc); mele.modeles[0] = copie(CAT.precedent['5x5'][0]);
  assert.strictEqual(S.bibliothequeCataloguePrecedent(mele), false);
  // les deux catalogues précédents du 5×5 sont reconnus ; le catalogue courant ne l'est pas
  for (const x of CAT.precedents['5x5']) {
    const d = CAT.nouveauDocument('5x5'); d.modeles = copie(x.modeles);
    assert.strictEqual(S.bibliothequeCataloguePrecedent(d), true, x.version);
  }
  assert.strictEqual(S.bibliothequeCataloguePrecedent(CAT.nouveauDocument('5x5')), false);
});

test('catalogue précédent 4.00.0 (5×5) : accepter la proposition charge le catalogue à 2 cases par tuile, vide le plateau, Ctrl+Z rend le document', () => {
  require('../src/etat.js');
  const fs = require('fs'), path = require('path');
  const doc = S.depuisJSON(fs.readFileSync(path.join(__dirname, 'donnees', 'document-4.00-5x5.json'), 'utf8')).doc;
  const etat = PM.etat.creer(doc), avant = JSON.stringify(etat.doc());
  etat.remplacer(CAT.nouveauDocument('5x5'), 'nouveau catalogue'); // ce que fait le bouton « Charger le nouveau catalogue » (app.js)
  assert.deepStrictEqual(etat.doc().modeles.map((m) => m.id), ['LC1', 'LC2', 'LC3', 'LC4', 'LB2', 'LK2']);
  assert.deepStrictEqual(etat.doc().plateau, { tuiles: [], jetons: [] });
  assert.strictEqual(etat.doc().grille, '5x5');
  assert.strictEqual(S.bibliothequeCataloguePrecedent(etat.doc()), false, 'plus de proposition ensuite');
  etat.annuler();
  assert.strictEqual(JSON.stringify(etat.doc()), avant);
});
