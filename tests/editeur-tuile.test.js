'use strict';
// Tests des fonctions pures de l'éditeur de tuile (aucun DOM).
// Lancer : node --test tests/editeur-tuile.test.js
const test = require('node:test');
const assert = require('node:assert/strict');

require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
require('../src/etat.js');
require('../src/editeur-tuile.js');

const PM = globalThis.PM;
const E = PM.editeurTuile;
const M = PM.modele;

/** Gèle récursivement : toute mutation lève une erreur (modules en mode strict). */
function geler(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(geler); }
  return o;
}
const gele = (o) => geler(JSON.parse(JSON.stringify(o)));
const codes = (m) => M.validerModele(m).erreurs.map((e) => e.code);
const exemple = (role) => M.copieExemples().find((m) => m.role === role);

test('module exposé et chargeable sous Node', () => {
  assert.equal(typeof E.monter, 'function');
  assert.ok(PM.editeurTuile === E);
});

/* ---------- conversion écran <-> mm ---------- */

test('ecranVersMm / mmVersEcran : aller-retour, rect carré et rect large (bandes)', () => {
  [{ left: 100, top: 50, width: 608, height: 608 }, { left: 10, top: 20, width: 900, height: 500 }].forEach((rect) => {
    [[0, 0], [60, 60], [120, 120], [-10, 130], [33.3, 77.7]].forEach(([x, y]) => {
      const px = E.mmVersEcran(x, y, rect);
      const mm = E.ecranVersMm(px.x, px.y, rect);
      assert.ok(Math.abs(mm.x - x) < 1e-9 && Math.abs(mm.y - y) < 1e-9, JSON.stringify([rect, x, y, mm]));
    });
  });
});

test('ecranVersMm : le centre du rect est le centre de la vue ; échelle meet', () => {
  const rect = { left: 0, top: 0, width: 760, height: 760 }; // 152 mm -> 5 px / mm
  const c = E.ecranVersMm(380, 380, rect);
  assert.ok(Math.abs(c.x - 60) < 1e-9 && Math.abs(c.y - 60) < 1e-9);
  // 0 mm : (0 - (-16)) * 5 = 80 px
  const p = E.mmVersEcran(0, 0, rect);
  assert.ok(Math.abs(p.x - 80) < 1e-9 && Math.abs(p.y - 80) < 1e-9);
  // rect large : la hauteur limite, bandes à gauche et à droite
  const large = { left: 0, top: 0, width: 1000, height: 760 };
  const q = E.mmVersEcran(-16, -16, large);
  assert.ok(Math.abs(q.x - 120) < 1e-9 && Math.abs(q.y) < 1e-9);
});

/* ---------- aimantation ---------- */

test('aimanter : grille de 1 cm, marge de coupe et zones de coin respectées', () => {
  assert.deepEqual(E.aimanter(61, 59), { x: 60, y: 60 });
  assert.deepEqual(E.aimanter(63, 47), { x: 60, y: 50 });
  // hors de la tuile : ramené dans les limites (4 mm + rayon 12 => 20..100)
  assert.deepEqual(E.aimanter(500, 60), { x: 100, y: 60 });
  // dans une zone de coin : écarté du coin (distance >= 20 + 12)
  const p = E.aimanter(0, 0);
  assert.ok(Math.hypot(p.x, p.y) >= 32 - 1e-9, JSON.stringify(p));
  for (let x = -20; x <= 140; x += 7) {
    for (let y = -20; y <= 140; y += 7) {
      const m = Object.assign({}, exemple('coin'), { cases: [{ id: 'z', x: E.aimanter(x, y).x, y: E.aimanter(x, y).y, diametre: 24, type: 'deplacement' }] });
      const c = codes(m);
      assert.ok(!c.includes('hors_tuile') && !c.includes('zone_coin'), `(${x},${y}) -> ${c}`);
    }
  }
});

/* ---------- modèle de départ ---------- */

test('modeleDeDepart : 4 rôles, bon nombre de cases, positions valides', () => {
  M.ROLES.forEach((role) => {
    const m = E.modeleDeDepart(role, []);
    assert.equal(m.role, role);
    assert.equal(m.exemplaires, 1);
    assert.equal(m.cases.length, M.NB_CASES_PAR_ROLE[role]);
    assert.deepEqual(m.chemins, []);
    const c = codes(m);
    ['hors_tuile', 'zone_coin', 'chevauchement', 'nombre_cases', 'cases_apparition', 'case_invalide', 'diametre', 'id_double', 'type_case'].forEach((x) => {
      assert.ok(!c.includes(x), `${role} : ${x}`);
    });
    assert.equal(M.validerModele(m).complet, false); // pas encore de chemins
  });
  assert.equal(E.modeleDeDepart('apparition', []).cases.filter((c) => c.type === 'apparition').length, 1);
});

test('modeleDeDepart : id de modèle unique par rapport aux ids existants', () => {
  assert.equal(E.modeleDeDepart('coin', []).id, 'modele-1');
  assert.equal(E.modeleDeDepart('coin', ['modele-1', 'modele-2']).id, 'modele-3');
  assert.throws(() => E.modeleDeDepart('inconnu', []), /Rôle inconnu/);
});

test('dupliquer : nouvel id, 1 exemplaire, nom « (copie) », original intact', () => {
  const m = gele(exemple('bord'));
  const c = E.dupliquer(m, ['ex-bord']);
  assert.notEqual(c.id, m.id);
  assert.equal(c.exemplaires, 1);
  assert.match(c.nom, /\(copie\)$/);
  assert.deepEqual(c.cases, m.cases);
  assert.equal(M.validerModele(c).complet, true);
});

/* ---------- cases ---------- */

test('ajouterCase / deplacerCase / basculerType : purs et aimantés', () => {
  const m = gele(E.modeleDeDepart('coin', []));
  const m2 = E.ajouterCase(m, 62, 58);
  assert.equal(m.cases.length, 3);
  assert.equal(m2.cases.length, 4);
  const n = m2.cases[3];
  assert.equal(n.id, 'c4');
  assert.deepEqual([n.x, n.y, n.diametre, n.type], [60, 60, 24, 'deplacement']);
  const m3 = E.deplacerCase(gele(m2), 'c4', 83, 31);
  assert.deepEqual([m3.cases[3].x, m3.cases[3].y], [80, 30]);
  assert.throws(() => E.deplacerCase(m2, 'zzz', 0, 0), /introuvable/);
  const m4 = E.basculerType(gele(m3), 'c1');
  assert.equal(m4.cases[0].type, 'apparition');
  assert.equal(E.basculerType(gele(m4), 'c1').cases[0].type, 'deplacement');
  assert.throws(() => E.basculerType(m4, 'zzz'), /introuvable/);
});

test('ids de cases uniques même après suppression', () => {
  let m = E.modeleDeDepart('centrale', []);
  m = E.supprimer(m, { type: 'case', id: 'c2' });
  m = E.ajouterCase(m, 60, 60);
  assert.equal(new Set(m.cases.map((c) => c.id)).size, m.cases.length);
});

/* ---------- chemins ---------- */

test('ajouterChemin : case-case, case-raccord, case-coin ; la case vient en premier', () => {
  let m = gele(E.modeleDeDepart('coin', []));
  m = gele(E.ajouterChemin(m, { 'case': 'c1' }, { 'case': 'c2' }));
  assert.equal(m.chemins[0].id, 'h1');
  m = gele(E.ajouterChemin(m, { raccord: { cote: 1, pos: 1 } }, { 'case': 'c2' }));
  assert.deepEqual(m.chemins[1].a, { 'case': 'c2' });
  assert.deepEqual(m.chemins[1].b, { raccord: { cote: 1, pos: 1 } });
  m = gele(E.ajouterChemin(m, { 'case': 'c1' }, { coin: 2 }));
  assert.equal(m.chemins.length, 3);
  assert.equal(new Set(m.chemins.map((c) => c.id)).size, 3);
});

test('ajouterChemin : refus expliqués', () => {
  const m = gele(E.modeleDeDepart('coin', []));
  const refus = (a, b, re) => assert.throws(() => E.ajouterChemin(m, a, b), re);
  refus({ raccord: { cote: 0, pos: 0 } }, { coin: 2 }, /part toujours d'une case/);
  refus({ 'case': 'c1' }, { 'case': 'c1' }, /lui-même/);
  refus({ 'case': 'c1' }, { 'case': 'inexistante' }, /n'existe pas/);
  refus({ 'case': 'c1' }, { raccord: { cote: 0, pos: 1 } }, /extérieur/); // côté nord extérieur pour un coin
  refus({ 'case': 'c1' }, { raccord: { cote: 3, pos: 1 } }, /extérieur/);
  refus({ 'case': 'c1' }, { coin: 0 }, /extérieur/);                       // seul le coin SE est un port du coin
  refus({ 'case': 'c1' }, null, /invalide/);
  const m2 = gele(E.ajouterChemin(m, { 'case': 'c1' }, { 'case': 'c2' }));
  assert.throws(() => E.ajouterChemin(m2, { 'case': 'c2' }, { 'case': 'c1' }), /déjà reliés/);
});

test('raccordActif / coinActif suivent le rôle', () => {
  assert.equal(E.raccordActif('coin', 0), false);
  assert.equal(E.raccordActif('coin', 1), true);
  assert.equal(E.raccordActif('centrale', 0), true);
  assert.equal(E.coinActif('coin', 2), true);
  assert.equal(E.coinActif('coin', 0), false);
  assert.equal(E.coinActif('centrale', 3), true);
  assert.equal(E.coinActif('bord', 0), false);
  assert.equal(E.coinActif('bord', 3), true);
});

/* ---------- suppression ---------- */

test('supprimer : case (avec ses chemins), chemin, coin, raccord ; refus si absent', () => {
  const base = gele(exemple('coin'));
  const sansCase = E.supprimer(base, { type: 'case', id: 'c1' });
  assert.equal(sansCase.cases.length, 2);
  assert.ok(sansCase.chemins.every((ch) => JSON.stringify(ch).indexOf('"c1"') < 0));
  assert.ok(!codes(sansCase).includes('case_inconnue'));
  assert.equal(E.supprimer(base, { type: 'chemin', id: 'h1' }).chemins.length, base.chemins.length - 1);
  const sansPort = E.supprimer(base, { type: 'coin', id: 2 });
  assert.ok(codes(sansPort).includes('port_manquant'));
  const sansRaccord = E.supprimer(base, { type: 'raccord', cote: 1, pos: 1 });
  assert.equal(sansRaccord.chemins.length, base.chemins.length - 1);
  assert.throws(() => E.supprimer(base, { type: 'case', id: 'zzz' }), /introuvable/);
  assert.throws(() => E.supprimer(base, { type: 'chemin', id: 'zzz' }), /introuvable/);
  assert.throws(() => E.supprimer(base, { type: 'coin', id: 0 }), /Aucun chemin/);
  assert.throws(() => E.supprimer(base, { type: 'raccord', cote: 0, pos: 0 }), /Aucun chemin/);
  assert.throws(() => E.supprimer(base, null), /Rien/);
  assert.throws(() => E.supprimer(base, { type: 'modele' }), /non supprimable/);
});

/* ---------- scénario complet ---------- */

test('intégration : de modeleDeDepart(coin) à un modèle complet, uniquement avec les fonctions de l\'éditeur', () => {
  let m = E.modeleDeDepart('coin', []);
  // c1 (60,40), c2 (30,90), c3 (90,90)
  m = E.deplacerCase(m, 'c1', 80, 40);     // la case du haut vers la droite
  m = E.deplacerCase(m, 'c2', 40, 90);
  m = E.deplacerCase(m, 'c3', 80, 90);
  m = E.ajouterChemin(m, { 'case': 'c1' }, { 'case': 'c3' });
  m = E.ajouterChemin(m, { 'case': 'c2' }, { 'case': 'c3' });
  m = E.ajouterChemin(m, { 'case': 'c3' }, { coin: 2 });
  m = E.ajouterChemin(m, { 'case': 'c1' }, { raccord: { cote: 1, pos: 1 } });
  assert.ok(codes(m).includes('cotes_raccord'));
  m = E.ajouterChemin(m, { 'case': 'c2' }, { raccord: { cote: 2, pos: 1 } });
  const v = M.validerModele(m);
  assert.deepEqual(v.erreurs, []);
  assert.equal(v.complet, true);
  // le modèle complet s'ajoute à un document et se remplace sans erreur
  let doc = M.nouveauDocument();
  doc = M.ajouterModele(doc, m);
  doc = M.remplacerModele(doc, m.id, E.renommer(m, '  Mon coin '));
  assert.equal(doc.modeles[0].nom, 'Mon coin');
});

test('intégration via PM.etat : modifications = une étape d\'historique chacune, annulables', () => {
  const etat = PM.etat.creer(M.nouveauDocument());
  const m0 = E.modeleDeDepart('bord', []);
  assert.equal(etat.appliquer((d) => M.ajouterModele(d, m0), 'Nouveau').ok, true);
  const m1 = E.ajouterCase(m0, 60, 60);
  assert.equal(etat.appliquer((d) => M.remplacerModele(d, m0.id, m1), 'Ajouter une case').ok, true);
  assert.equal(etat.doc().modeles[0].cases.length, 4);
  etat.annuler();
  assert.equal(etat.doc().modeles[0].cases.length, 3);
});

/* ---------- utilisation et rôle ---------- */

test('nbUtilisations et refus de changement de rôle d\'un modèle posé', () => {
  let doc = M.nouveauDocument();
  const m = exemple('centrale');
  doc = M.ajouterModele(doc, m);
  doc = M.poserTuile(doc, m.id, 1, 1);
  doc = M.poserTuile(doc, m.id, 2, 2);
  assert.equal(E.nbUtilisations(doc, m.id), 2);
  assert.equal(E.nbUtilisations(doc, 'autre'), 0);
  assert.equal(E.nbUtilisations(M.nouveauDocument(), 'x'), 0);
  const refuse = () => M.remplacerModele(doc, m.id, E.changerRole(m, 'bord'));
  assert.throws(refuse, /posé sur le plateau/);
  // même rôle : accepté
  assert.doesNotThrow(() => M.remplacerModele(doc, m.id, E.renommer(m, 'Autre nom')));
  assert.throws(() => E.changerRole(m, 'zzz'), /Rôle inconnu/);
});

/* ---------- cibles ---------- */

test('cibleEn : priorité raccord > coin > case > chemin, inactifs signalés', () => {
  const m = exemple('coin'); // côtés extérieurs N et O, port SE
  assert.deepEqual(E.cibleEn(m, 120, 60), { type: 'raccord', cote: 1, pos: 1, actif: true });
  assert.deepEqual(E.cibleEn(m, 60, 1), { type: 'raccord', cote: 0, pos: 1, actif: false });
  assert.deepEqual(E.cibleEn(m, 119, 119), { type: 'coin', coin: 2, actif: true });
  assert.deepEqual(E.cibleEn(m, 1, 1), { type: 'coin', coin: 0, actif: false });
  assert.deepEqual(E.cibleEn(m, 85, 85), { type: 'case', id: 'c1' });
  assert.deepEqual(E.cibleEn(m, 62, 86), { type: 'chemin', id: 'h2' }); // segment c1 - c3 (y = 85), hors des deux cases
  assert.equal(E.cibleEn(m, 20, 20), null);
});

test('extremiteDeCible / refDeCible', () => {
  assert.deepEqual(E.extremiteDeCible({ type: 'case', id: 'c1' }), { 'case': 'c1' });
  assert.deepEqual(E.extremiteDeCible({ type: 'raccord', cote: 1, pos: 2, actif: true }), { raccord: { cote: 1, pos: 2 } });
  assert.equal(E.extremiteDeCible({ type: 'raccord', cote: 0, pos: 2, actif: false }), null);
  assert.deepEqual(E.extremiteDeCible({ type: 'coin', coin: 2, actif: true }), { coin: 2 });
  assert.equal(E.extremiteDeCible({ type: 'chemin', id: 'h1' }), null);
  assert.equal(E.extremiteDeCible(null), null);
  assert.deepEqual(E.refDeCible({ type: 'coin', coin: 3, actif: true }), { type: 'coin', id: 3 });
  assert.equal(E.refDeCible({ type: 'raccord', cote: 2, pos: 1, actif: true }).cote, 2);
});

test('libelleCible et coteCourte : cotes en cm', () => {
  const m = exemple('centrale');
  assert.match(E.libelleCible(m, { type: 'raccord', cote: 0, pos: 1, actif: true }), /nord.*6 cm/);
  assert.match(E.libelleCible(m, { type: 'raccord', cote: 0, pos: 1, actif: false }), /inactif/);
  assert.match(E.libelleCible(m, { type: 'coin', coin: 1, actif: true }), /obligatoire/);
  assert.match(E.libelleCible(m, { type: 'coin', coin: 1, actif: false }), /extérieur/);
  assert.match(E.libelleCible(m, { type: 'case', id: 'c1' }), /3,6 ; 3,6 cm/);
  assert.equal(E.libelleCible(m, null), '');
  assert.deepEqual(E.coteCourte(m, { type: 'raccord', cote: 0, pos: 0, actif: true }), { x: 30, y: 0, texte: '3 cm' });
  assert.equal(E.coteCourte(m, { type: 'coin', coin: 0, actif: true }), null);
});

/* ---------- validation : halo et marquages ---------- */

test('haloDe : une forme pour chaque type de ref de validerModele', () => {
  const m = exemple('coin');
  assert.equal(E.haloDe(m, { type: 'case', id: 'c1' }).cercles.length, 1);
  assert.equal(E.haloDe(m, { type: 'case', id: 'c1', ids: ['c1', 'c2'] }).cercles.length, 2);
  assert.equal(E.haloDe(m, { type: 'chemin', id: 'h1' }).lignes.length, 1);
  assert.deepEqual(E.haloDe(m, { type: 'coin', id: 2 }).cercles[0], { x: 120, y: 120, r: 12 });
  assert.equal(E.haloDe(m, { type: 'raccord', id: '1:1', cote: 1, pos: 1 }).cercles.length, 1);
  assert.equal(E.haloDe(m, { type: 'modele', id: 'x' }).tuile, true);
  assert.deepEqual(E.haloDe(m, null), { cercles: [], lignes: [], tuile: false });
  assert.equal(E.haloDe(m, { type: 'case', id: 'absente' }).cercles.length, 0);
});

test('chaque erreur de validation d\'un modèle abîmé produit un halo ou un marquage', () => {
  const m = exemple('centrale');
  m.cases[1].x = 40; // chevauche c1
  m.chemins = m.chemins.filter((c) => c.id !== 'p3'); // port manquant au coin SE
  const v = M.validerModele(m);
  assert.ok(v.erreurs.length >= 2);
  const mq = E.marquages(v.erreurs);
  assert.ok(mq.cases.includes('c1') && mq.cases.includes('c2'), 'chevauchement : les deux cases');
  assert.deepEqual(mq.coinsManquants, [2]);
  v.erreurs.forEach((e) => {
    const h = E.haloDe(m, e.ref);
    assert.ok(h.cercles.length + h.lignes.length > 0 || h.tuile, e.code);
  });
});

test('marquages : chemins, raccords, coins en erreur', () => {
  const mq = E.marquages([
    { code: 'boucle', message: '', ref: { type: 'chemin', id: 'h9' } },
    { code: 'raccord_double', message: '', ref: { type: 'raccord', id: '1:1', cote: 1, pos: 1 } },
    { code: 'coin_double', message: '', ref: { type: 'coin', id: 2 } },
    { code: 'x', message: '' }
  ]);
  assert.deepEqual(mq, { cases: [], coinsManquants: [], coinsErreur: [2], raccords: ['1:1'], chemins: ['h9'] });
});

test('extremitesUtilisees', () => {
  assert.deepEqual(E.extremitesUtilisees(exemple('coin')), { raccords: ['1:1', '2:1'], coins: [2] });
});

/* ---------- fragments SVG ---------- */

test('fragments SVG : 12 raccords, 4 coins, 4 zones, grille, vignettes', () => {
  const m = exemple('coin');
  const mq = E.marquages(M.validerModele(m).erreurs);
  const r = E.svgRaccords(m, mq);
  assert.equal((r.match(/data-raccord=/g) || []).length, 12);
  assert.equal((r.match(/pm-editeur-inactif/g) || []).length, 6); // côtés N et O
  assert.equal((r.match(/pm-editeur-utilise/g) || []).length, 2);
  const c = E.svgCoins(m, mq);
  assert.equal((c.match(/data-coin=/g) || []).length, 4);
  assert.equal((c.match(/pm-editeur-inactif/g) || []).length, 3);
  const vide = Object.assign({}, m, { chemins: [] });
  const c2 = E.svgCoins(vide, E.marquages(M.validerModele(vide).erreurs));
  assert.equal((c2.match(/pm-editeur-pulse/g) || []).length, 1); // port SE manquant
  assert.equal((E.svgZonesCoin().match(/<path/g) || []).length, 4);
  assert.equal((E.svgGrille().match(/<line/g) || []).length, 22);
  for (let rot = 0; rot < 4; rot++) {
    const v = E.svgVignette(m, rot);
    assert.match(v, /^<svg /);
    assert.match(v, />N<\/text>/);
    assert.equal((v.match(/<svg/g) || []).length, 1);
  }
  assert.match(E.svgHalo(E.haloDe(m, { type: 'modele' })), /<rect/);
});

test('les fonctions pures ne modifient pas leurs entrées gelées', () => {
  const m = gele(exemple('apparition'));
  assert.doesNotThrow(() => {
    E.ajouterCase(m, 50, 50); E.deplacerCase(m, 'c1', 50, 50); E.basculerType(m, 'c1');
    E.supprimer(m, { type: 'case', id: 'c1' }); E.renommer(m, 'x'); E.changerRole(m, 'bord');
    E.dupliquer(m, []); E.haloDe(m, { type: 'case', id: 'c1' }); E.cibleEn(m, 50, 50);
    E.svgVignette(m, 1); E.extremitesUtilisees(m);
    try { E.ajouterChemin(m, { 'case': 'c1' }, { 'case': 'c1' }); } catch (e) { /* refus attendu */ }
  });
});
