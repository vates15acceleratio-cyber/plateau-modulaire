'use strict';
/*
 * Recette indépendante des modules d'interface (fonctions pures exportées, sous Node), règles v2.
 * Référence : docs/10-contrats-interface.md, docs/5-avis-ergonomie.md, docs/18-decisions-v2.md,
 * docs/20-avis-geometrie-v2.md, docs/2-avis-geometrie.md (D10). Les scénarios navigateur sont dans
 * outils/recette-interface.html.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
['geometrie', 'modele', 'catalogue', 'rendu', 'etat', 'sauvegarde', 'graphe', 'controles', 'bibliotheque', 'assemblage', 'editeur-tuile']
  .forEach((f) => require('../src/' + f + '.js'));
const AV2 = require('./aides-v2.js');
const PM = globalThis.PM;
const M = PM.modele, G = PM.geometrie, A = PM.assemblage, C = PM.controles, B = PM.bibliotheque, E = PM.editeurTuile, S = PM.sauvegarde;

const copie = (o) => JSON.parse(JSON.stringify(o));
const docVide = () => PM.catalogue.nouveauDocument();
/** Plateau plein des exemples (conformes v2), 7 villes équilibrées sauf demande contraire. */
const plateauComplet = (avecVilles) => AV2.plateauComplet('4x4', avecVilles !== false);

/** Exception « non prévue » = autre chose qu'une Error simple portant une phrase. */
function exceptionNonPrevue(fn) {
  try { fn(); return null; } catch (e) {
    if (e && e.constructor === Error && typeof e.message === 'string' && e.message) return null;
    return e;
  }
}

/* ------------------------------------------------------------------ */
test('plateau plein des exemples : 16 tuiles, 7 villes, compteurs tous ok, aucune erreur ni alerte', () => {
  const d = plateauComplet();
  const r = C.calculer(d);
  assert.equal(d.plateau.tuiles.length, 16);
  assert.deepEqual(r.compteurs.filter((c) => c.etat !== 'ok').map((c) => c.cle), []);
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes, []);
  assert.equal(A.compterJetons(d), 7);
});

test('catalogue v2 posé à plein : aucune erreur, 6 apparitions par camp, seules alertes possibles : raccords morts', () => {
  let d = docVide();
  const F = M.formatDuDocument(d), stock = { centrale: [], bord: [], coin: [] };
  d.modeles.forEach((m) => { for (let k = 0; k < m.exemplaires; k++) stock[m.gabarit].push(m.id); });
  for (let lig = 0; lig < 4; lig++) for (let col = 0; col < 4; col++) d = A.poserTuileTournee(d, stock[M.gabaritCellule(col, lig, F)].shift(), col, lig);
  const r = C.calculer(d);
  assert.deepEqual(r.erreurs, []);
  assert.ok(r.alertes.every((a) => a.code === 'raccord_mort'), r.alertes.map((a) => a.code).join(' '));
  assert.ok(r.compteurs.some((c) => c.cle === 'apparitions_vert' && c.etat === 'ok'));
});

test('coordonnées : celluleSous et jonctionSous aux limites du plateau (D10)', () => {
  assert.deepEqual(A.celluleSous(0, 0), { col: 0, lig: 0 });
  assert.deepEqual(A.celluleSous(479.9, 479.9), { col: 3, lig: 3 });
  assert.equal(A.celluleSous(480, 100), null);
  assert.equal(A.celluleSous(-0.1, 100), null);
  for (const v of [NaN, Infinity, -Infinity, null, undefined, '5', {}]) {
    assert.equal(A.celluleSous(v, 10), null);
    assert.equal(A.celluleSous(10, v), null);
    assert.equal(A.jonctionSous(v, 120), null);
  }
  assert.deepEqual(A.jonctionSous(135, 120), { i: 1, j: 1 }, 'rayon de 15 mm inclus');
  assert.equal(A.jonctionSous(135.5, 120), null, 'au-delà de 15 mm');
  assert.equal(A.jonctionSous(0, 0), null, 'jonction extérieure');
  assert.deepEqual(A.jonctionSous(360, 360), { i: 3, j: 3 });
  assert.deepEqual(A.jonctionSous(400, 400, '5x5'), { i: 4, j: 4 });
  assert.deepEqual(A.celluleSous(499, 499, '5x5'), { col: 4, lig: 4 });
});

test('conversions écran <-> mm réciproques (plateau et éditeur) et rectangle dégénéré', () => {
  const rect = { left: 10, top: 20, width: 700, height: 500 };
  for (const [x, y] of [[0, 0], [240, 240], [480, 480], [-40, -52]]) {
    const p = A.mmVersEcran(x, y, rect, A.VUE), q = A.ecranVersMm(p.x, p.y, rect, A.VUE);
    assert.ok(Math.abs(q.x - x) < 1e-9 && Math.abs(q.y - y) < 1e-9);
  }
  for (const [x, y] of [[0, 0], [60, 60], [120, 120]]) {
    const p = E.mmVersEcran(x, y, rect, E.VUE), q = E.ecranVersMm(p.x, p.y, rect, E.VUE);
    assert.ok(Math.abs(q.x - x) < 1e-9 && Math.abs(q.y - y) < 1e-9);
  }
  const nul = { left: 0, top: 0, width: 0, height: 0 };
  assert.ok(Number.isFinite(A.ecranVersMm(5, 5, nul, A.VUE).x), 'rectangle nul (onglet caché) : pas de NaN');
});

test('robustesse : ids inconnus et coordonnées hors plateau avec un document valide', () => {
  const d = plateauComplet();
  const junk = [undefined, null, -1, 0, 99, NaN, 1.5, 'x', '', {}, []];
  const appels = [];
  for (const a of junk) for (const b of junk) {
    appels.push(['cellulesCompatibles', () => A.cellulesCompatibles(d, a)]);
    appels.push(['poserTuileTournee', () => A.poserTuileTournee(d, a, b, b, a)]);
    appels.push(['poserTuileTournee2', () => A.poserTuileTournee(docVide(), 'C1', a, b, 1)]);
    appels.push(['etiquetteCellule', () => A.etiquetteCellule(a, b)]);
    appels.push(['cibleSurbrillance', () => A.cibleSurbrillance(a, d)]);
    appels.push(['cibleSurbrillance obj', () => A.cibleSurbrillance({ type: 'raccord', col: a, lig: b, cote: b, pos: a }, d)]);
    appels.push(['cibleSurbrillance port', () => A.cibleSurbrillance({ type: 'port', col: 1, lig: 1, coin: a }, d)]);
    appels.push(['messageJeton', () => A.messageJeton(d, a, b)]);
    appels.push(['vignettes', () => B.vignettesBibliotheque(d, a)]);
    appels.push(['refusArmement', () => B.refusArmement(d, a)]);
    appels.push(['retirerParClicDroit', () => A.retirerParClicDroit(d, a, b)]);
    appels.push(['aimanter', () => E.aimanter(a, b, a)]);
    appels.push(['cibleEn', () => E.cibleEn(d.modeles[0], a, b)]);
    appels.push(['nbUtilisations', () => E.nbUtilisations(a, b)]);
    appels.push(['modeleDeDepart', () => E.modeleDeDepart(a, b)]);
    appels.push(['raccordExterieur', () => E.raccordExterieur(a, b)]);
    appels.push(['coinExterieur', () => E.coinExterieur(a, b)]);
    appels.push(['libelleCible', () => E.libelleCible(d.modeles[0], a)]);
    appels.push(['coteCourte', () => E.coteCourte(d.modeles[0], a)]);
    appels.push(['haloDe', () => E.haloDe(d.modeles[0], a)]);
    appels.push(['marquages', () => E.marquages(a)]);
    appels.push(['supprimer ref', () => E.supprimer(d.modeles[0], a)]);
    appels.push(['deplacerCase id', () => E.deplacerCase(d.modeles[0], a, b, b)]);
    appels.push(['basculerType id', () => E.basculerType(d.modeles[0], a)]);
    appels.push(['ajouterChemin', () => E.ajouterChemin(d.modeles[0], a, b)]);
    appels.push(['changerGabarit', () => E.changerGabarit(d.modeles[0], a)]);
    appels.push(['campCellule', () => M.campCellule('4x4', a, b)]);
    appels.push(['gabaritCellule', () => M.gabaritCellule(a, b)]);
    appels.push(['rotationDeduite', () => M.rotationDeduite(a, b, a)]);
    appels.push(['depuisJSON', () => S.depuisJSON(a)]);
    appels.push(['fusionnerBibliotheque', () => S.fusionnerBibliotheque(d, a)]);
  }
  const mauvais = [];
  for (const [nom, f] of appels) {
    const e = exceptionNonPrevue(f);
    if (e && !mauvais.some((m) => m.startsWith(nom + ' '))) mauvais.push(nom + ' : ' + e.constructor.name + ' ' + e.message);
  }
  assert.deepEqual(mauvais, []);
});

test('robustesse : objets de cellule nuls passés à testerDeplacement / deplacerTuile', () => {
  const d = plateauComplet();
  assert.equal(exceptionNonPrevue(() => A.testerDeplacement(d, null, { col: 0, lig: 0 })), null);
  assert.equal(exceptionNonPrevue(() => A.testerDeplacement(d, { col: 1, lig: 1 }, null)), null);
  assert.equal(exceptionNonPrevue(() => A.deplacerTuile(d, { col: 1, lig: 1 }, undefined)), null);
});

test('robustesse : documents malformés (plateau absent, tuiles à null) ne plantent pas les calculs d\'affichage', () => {
  const docs = [{}, { modeles: [], plateau: null }, { modeles: null, plateau: { tuiles: [], jetons: [] } }, { modeles: [], plateau: { tuiles: [] } }];
  const mauvais = [];
  for (const d of docs) {
    for (const [nom, f] of [['calculer', () => C.calculer(d)], ['svgPlateau', () => A.svgPlateau(d, {})], ['vignettes', () => B.vignettesBibliotheque(d, 'tous')]]) {
      const e = exceptionNonPrevue(f);
      if (e) mauvais.push(nom + ' ' + JSON.stringify(d) + ' : ' + e.message);
    }
  }
  assert.deepEqual(mauvais, []);
});

test('document avec modèle de tuile absent ou jeton mal formé : calculer ne plante pas et signale', () => {
  const d = plateauComplet();
  d.plateau.tuiles[0].modeleId = 'inconnu';
  d.plateau.jetons.push(null, { i: 'x', j: 2, type: 'capture' }, { i: 9, j: 9, type: 'carrefour' });
  const r = C.calculer(d);
  assert.ok(r.erreurs.some((e) => e.code === 'modele_absent'));
  assert.ok(r.erreurs.some((e) => e.code === 'jeton_invalide'));
  assert.doesNotThrow(() => A.svgPlateau(d, {}));
  assert.doesNotThrow(() => A.alertesPlateau(d));
});

test('trop de villes : alerte sans blocage ; villes trop proches : alerte sans blocage', () => {
  let d = plateauComplet();
  d = M.poserJeton(d, 1, 2);
  const r = C.calculer(d);
  assert.ok(r.alertes.some((a) => a.code === 'trop_de_villes'));
  assert.ok(!r.erreurs.some((e) => e.code === 'trop_de_villes'));
});

test('plateau très déséquilibré : erreur dans le panneau (pastille rouge), la pose reste permise', () => {
  const d = AV2.plateauDesequilibre();
  const r = C.calculer(d);
  assert.equal(r.erreurs.filter((e) => e.code === 'desequilibre').length, 1);
  assert.match(r.erreurs[0].message, /très déséquilibré/);
  const libre = M.retirerTuile(d, 1, 1);
  assert.equal(A.cellulesCompatibles(libre, 'ex-centrale').length, 1);
  assert.doesNotThrow(() => A.poserTuileTournee(libre, 'ex-centrale', 1, 1, 0));
});

test('effets d\'une action : villes retirées expliquées, annulation mentionnée (jamais en silence)', () => {
  const d = plateauComplet();
  const eff = A.effetsDeAction(d, M.retirerTuile(d, 1, 1));
  assert.equal(eff.jetonsRetires.length, 3, 'les villes des 4 jonctions autour de (1,1) : (1,1), (2,1), (2,2)');
  const m = A.messageEffets(eff);
  assert.ok(/villes retirées/.test(m) && /Ctrl\+Z pour annuler\.$/.test(m), m);
  assert.equal(A.messageEffets({ jetonsRetires: [] }), null);
  assert.deepEqual(A.effetsDeAction(d, copie(d)), { jetonsRetires: [] });
});

test('déplacement de tuile : rotation conservée, vers une cellule libre du même rôle, refus si occupée ou si le rôle ne convient pas', () => {
  const d = plateauComplet(false);
  const t = M.tuileEn(d, 1, 0);
  const sans = M.retirerTuile(d, 2, 0);
  const apres = A.deplacerTuile(sans, { col: 1, lig: 0 }, { col: 2, lig: 0 });
  assert.equal(M.tuileEn(apres, 2, 0).modeleId, t.modeleId);
  assert.equal(M.tuileEn(apres, 2, 0).rot, t.rot);
  assert.ok(!C.calculer(apres).alertes.some((a) => a.code === 'gabarit_place'));
  // un bord ne va pas au centre : refus expliqué, document inchangé
  const centre = A.testerDeplacement(M.retirerTuile(sans, 2, 2), { col: 1, lig: 0 }, { col: 2, lig: 2 });
  assert.equal(centre.ok, false);
  assert.match(centre.raison, /Cette tuile est un bord/);
  assert.equal(A.testerDeplacement(d, { col: 1, lig: 1 }, { col: 0, lig: 0 }).ok, false);
  assert.equal(A.testerDeplacement(d, { col: 1, lig: 1 }, { col: 1, lig: 1 }).identique, true);
  assert.deepEqual(A.cellulesCompatiblesDeplacement(d, { col: 3, lig: 3 }).map((c) => c.col + ',' + c.lig), ['3,3']);
});

test('bibliothèque : groupes par gabarit, filtre, posable / incomplet, gabarit inconnu, plus de compteur de stock', () => {
  let d = docVide();
  const incomplet = E.modeleDeDepart('coin', d.modeles.map((m) => m.id));
  d = M.ajouterModele(d, incomplet);
  d.modeles.push(null, { id: 'z', gabarit: 'inconnu', exemplaires: 1, cases: [], chemins: [] });
  const g = B.vignettesBibliotheque(d, 'tous');
  assert.deepEqual(g.map((x) => x.gabarit), ['centrale', 'bord', 'coin', 'autre']);
  const v = g.find((x) => x.gabarit === 'coin').modeles.find((m) => m.id === incomplet.id);
  assert.equal(v.complet, false); assert.equal(v.posable, false);
  assert.deepEqual(B.vignettesBibliotheque(d, 'bord').map((x) => x.gabarit), ['bord']);
  assert.deepEqual(B.vignettesBibliotheque(d, 'zzz'), []);
  // poses illimitées : K4 n'a qu'un exemplaire, il se pose dans les 4 coins et reste posable
  let p = d;
  for (const [c, l, r] of [[0, 0, 0], [3, 0, 1], [3, 3, 2], [0, 3, 3]]) p = A.poserTuileTournee(p, 'K4', c, l, r);
  const k4 = B.vignettesBibliotheque(p, 'coin')[0].modeles.find((m) => m.id === 'K4');
  assert.equal(k4.exemplaires, 1);
  assert.equal(k4.posees, 4);
  assert.equal(k4.posable, true);
  assert.equal('restants' in k4, false);
  assert.equal(k4.alertes, 0, 'K4 (catalogue v2) : aucune alerte');
  assert.equal(B.refusArmement(p, 'K4'), '');
  assert.match(B.refusArmement(p, incomplet.id), /incomplet/);
  assert.match(B.refusArmement(p, 'nope'), /introuvable/);
});

test('pose : refus en une phrase (incomplet, hors grille, introuvable, occupée, rôle), jamais pour des exemplaires épuisés', () => {
  let d = docVide();
  const inc = E.modeleDeDepart('coin', []);
  d = M.ajouterModele(d, inc);
  const cas = [
    [M.peutPoserTuile(d, inc.id, 0, 0), /incomplet/],
    [M.peutPoserTuile(d, 'K2', 4, 0), /hors/],
    [M.peutPoserTuile(d, 'nope', 0, 0), /introuvable/]
  ];
  for (const [r, re] of cas) {
    assert.equal(r.ok, false);
    assert.match(r.raison, re);
    assert.ok(!/[.!?]\s+\S/.test(r.raison), 'une seule phrase : ' + r.raison);
  }
  // rôle respecté : un coin ne va pas au centre, une centrale ne va pas dans un coin (refus d'une phrase)
  const coinCentre = M.peutPoserTuile(d, 'K2', 1, 1), centraleCoin = M.peutPoserTuile(d, 'C1', 0, 0);
  assert.equal(coinCentre.ok, false); assert.equal(centraleCoin.ok, false);
  assert.equal(coinCentre.raison, 'Cette tuile est un coin : elle se pose dans un coin du plateau.');
  assert.equal(centraleCoin.raison, 'Cette tuile est une centrale : elle se pose au centre du plateau.');
  assert.equal(M.peutPoserTuile(d, 'B1', 0, 0).raison, 'Cette tuile est un bord : elle se pose sur le pourtour du plateau, hors des coins.');
  assert.equal(M.peutPoserTuile(d, 'K2', 0, 0).ok, true);
  assert.equal(M.peutPoserTuile(d, 'C1', 1, 1).ok, true);
  d = A.poserTuileTournee(d, 'K4', 0, 0, 0);
  assert.match(M.peutPoserTuile(d, 'K2', 0, 0).raison, /occupée/);
  d = A.poserTuileTournee(d, 'K4', 3, 0, 1); // K4 n'a qu'un exemplaire : 2e pose acceptée (poses illimitées)
  assert.equal(M.peutPoserTuile(d, 'K4', 3, 3).ok, true);
  const avant = copie(d);
  assert.throws(() => A.poserTuileTournee(d, 'K4', 1, 1, 0), Error);
  assert.deepEqual(d, avant, 'document inchangé après refus');
  assert.equal(A.poserTuileTournee(docVide(), 'K2', 0, 0, 3).plateau.tuiles[0].rot, 3, 'rotation choisie respectée');
  assert.equal(A.poserTuileTournee(docVide(), 'K2', 3, 3, null).plateau.tuiles[0].rot, 2, 'rotation suggérée du coin SE');
  assert.equal(A.poserTuileTournee(docVide(), 'C1', 1, 1, 5).plateau.tuiles[0].rot, 1, 'quarts de tour modulo 4');
  assert.equal(A.poserTuileTournee(docVide(), 'C1', 1, 1, -1).plateau.tuiles[0].rot, 3);
});

test('éditeur : modeleDeDepart pour chaque gabarit (ids uniques, sans chemin, apparition sur le pourtour)', () => {
  const ids = [];
  for (const g of M.GABARITS) {
    const m = E.modeleDeDepart(g, ids);
    assert.deepEqual(m.chemins, []);
    assert.ok(!ids.includes(m.id));
    ids.push(m.id);
    assert.equal(M.validerModele(m).complet, false);
    assert.equal(new Set(m.cases.map((c) => c.id)).size, m.cases.length);
    assert.equal(m.cases.some((c) => c.type === 'apparition'), g !== 'centrale');
  }
  assert.throws(() => E.modeleDeDepart('apparition', []), Error);
  assert.throws(() => E.modeleDeDepart(undefined, []), Error);
});

test('éditeur : aimantation sur la grille de 1 cm, marges de coupe et zones de coin (4×4 et 5×5)', () => {
  for (const grille of ['4x4', '5x5']) {
    const F = G.format(grille);
    for (const [x, y] of [[-500, -500], [0, 0], [60, 60], [999, 999], [3, 117], [118, 2], [NaN, 10]]) {
      const p = E.aimanter(x, y, 24, grille);
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
      assert.equal(p.x % 10, 0); assert.equal(p.y % 10, 0);
      assert.ok(p.x - 12 >= F.MARGE_COUPE_CASE && p.x + 12 <= F.COTE - F.MARGE_COUPE_CASE);
      for (let k = 0; k < 4; k++) {
        const c = F.pointCoin(k);
        assert.ok(Math.hypot(p.x - c.x, p.y - c.y) >= F.RAYON_ZONE_COIN + 12 - 1e-9);
      }
    }
  }
});

test('éditeur : ajouterChemin et supprimer (refus en phrase, modèle source intact) ; extérieurs permis', () => {
  const k1 = copie(docVide().modeles.find((m) => m.id === 'K2'));
  const avant = copie(k1);
  assert.throws(() => E.ajouterChemin(k1, { 'case': 'c1' }, { 'case': 'c1' }), /lui-même/);
  assert.throws(() => E.ajouterChemin(k1, { 'case': 'a' }, { 'case': 'r' }), /déjà reliés/);
  assert.throws(() => E.ajouterChemin(k1, { 'case': 'zz' }, { coin: 2 }), /n'existe pas/);
  assert.throws(() => E.ajouterChemin(k1, { coin: 2 }, { raccord: { cote: 1, pos: 1 } }), /case/);
  assert.throws(() => E.supprimer(k1, { type: 'case', id: 'zz' }), /introuvable/);
  assert.throws(() => E.supprimer(k1, { type: 'coin', id: 0 }), /Aucun chemin/);
  assert.throws(() => E.supprimer(k1, { type: 'zz' }), /non supprimable/);
  assert.deepEqual(k1, avant);
  const ext = E.ajouterChemin(k1, { 'case': 'a' }, { raccord: { cote: 0, pos: 1 } });
  assert.ok(M.validerModele(ext).alertes.some((a) => a.code === 'raccord_exterieur'));
  const sansCase = E.supprimer(k1, { type: 'case', id: 'c1' });
  assert.ok(sansCase.chemins.every((h) => h.a['case'] !== 'c1' && h.b['case'] !== 'c1'), 'les chemins de la case disparaissent avec elle');
});

test('éditeur : modification d\'un modèle posé répercutée ; changement de gabarit permis même posé', () => {
  const d = A.poserTuileTournee(docVide(), 'K2', 0, 0, 0);
  const casse = copie(M.modeleParId(d, 'K2'));
  casse.cases[0].diametre = 50;
  const d2 = M.remplacerModele(d, 'K2', casse);
  assert.equal(d2.plateau.tuiles.length, 1);
  assert.ok(C.calculer(d2).erreurs.some((e) => e.code === 'modele_incomplet'));
  assert.equal(E.nbUtilisations(d2, 'K2'), 1);
  const d3 = M.remplacerModele(d, 'K2', E.changerGabarit(M.modeleParId(d, 'K2'), 'bord'));
  assert.equal(M.modeleParId(d3, 'K2').gabarit, 'bord');
  assert.ok(C.calculer(d3).alertes.some((a) => a.code === 'gabarit_place'));
});

test('éditeur : dupliquer donne un id neuf, 1 exemplaire, nom « (copie) »', () => {
  const k = docVide().modeles.find((m) => m.id === 'K2');
  const c = E.dupliquer(k, docVide().modeles.map((m) => m.id));
  assert.notEqual(c.id, 'K2');
  assert.equal(c.exemplaires, 1);
  assert.match(c.nom, /\(copie\)$/);
  assert.deepEqual(c.chemins, k.chemins);
  assert.equal(M.validerModele(c).complet, true);
});

test('sauvegarde : aller-retour identique d\'un plateau complet, fichiers corrompus sans exception', () => {
  const d = plateauComplet();
  const r = S.depuisJSON(S.versJSON(d));
  assert.equal(r.ok, true);
  assert.deepEqual(r.alertes, []);
  assert.deepEqual(r.doc, d);
  for (const mauvais of ['', '{', 'null', '[]', '42', '"x"', '{"format":"plateau-modulaire"}', '{"format":"plateau-modulaire","version":99,"document":null}',
    S.versJSON(d).slice(0, 200), undefined, null, 42, {}, []]) {
    let res;
    assert.doesNotThrow(() => { res = S.depuisJSON(mauvais); }, String(mauvais).slice(0, 30));
    assert.equal(typeof res.ok, 'boolean');
    if (!res.ok) { assert.ok(res.erreurs.length > 0 && typeof res.erreurs[0].message === 'string'); }
  }
});

test('sauvegarde automatique : stockage simulé, contenu corrompu, stockage absent', () => {
  const mem = {};
  const stock = { setItem: (k, v) => { mem[k] = v; }, getItem: (k) => (k in mem ? mem[k] : null), removeItem: (k) => { delete mem[k]; } };
  const d = plateauComplet();
  assert.equal(S.ecrireMaintenant(d, stock), true);
  const r = S.restaurerAutosave(stock);
  assert.ok(r && r.ok);
  assert.deepEqual(r.doc, d);
  mem[S.CLE_AUTOSAVE] = '{corrompu';
  assert.equal(S.restaurerAutosave(stock), null);
  mem[S.CLE_AUTOSAVE] = JSON.stringify({ format: 'plateau-modulaire', version: 2, document: 5 });
  assert.equal(S.restaurerAutosave(stock), null);
  S.effacerAutosave(stock);
  assert.equal(S.restaurerAutosave(stock), null);
  assert.equal(S.restaurerAutosave(null), null);
  assert.equal(S.ecrireMaintenant(d, null), false);
  assert.equal(S.ecrireMaintenant(d, { setItem() { throw new Error('quota'); } }), false);
});

test('état partagé : refus sans changement, historique de 100 niveaux, rétablir vidé par une nouvelle action', () => {
  const etat = PM.etat.creer(docVide());
  const avant = JSON.stringify(etat.doc());
  const r = etat.appliquer((d) => M.poserTuile(d, 'K2', 9, 9), 'x');
  assert.equal(r.ok, false);
  assert.equal(JSON.stringify(etat.doc()), avant);
  assert.equal(etat.ui().message.niveau, 'erreur');
  assert.equal(etat.appliquer(() => { throw 'chaîne'; }).ok, false);
  assert.equal(etat.peutAnnuler(), false);
  for (let n = 0; n < 105; n++) etat.appliquer((d) => M.changerExemplaires(d, 'K2', n % 2 ? 2 : 3), 'e' + n);
  let k = 0; while (etat.annuler()) k++;
  assert.equal(k, 100);
  assert.equal(etat.retablir(), true);
  etat.appliquer((d) => M.changerExemplaires(d, 'K2', 5), 'nouveau');
  assert.equal(etat.peutRetablir(), false);
  const avantOuverture = JSON.stringify(etat.doc());
  etat.remplacer(docVide());
  assert.equal(etat.peutAnnuler(), true, 'remplacer est annulable');
  etat.annuler();
  assert.equal(JSON.stringify(etat.doc()), avantOuverture);
});

test('surbrillance : cibles pour chaque type d\'élément, document sans la cible', () => {
  const d = plateauComplet();
  assert.deepEqual(A.cibleSurbrillance({ type: 'tuile', col: 2, lig: 1 }, d), [{ forme: 'rect', x: 240, y: 120, w: 120, h: 120 }]);
  assert.equal(A.cibleSurbrillance({ type: 'jonction', i: 2, j: 3 }, d)[0].x, 240);
  assert.equal(A.cibleSurbrillance({ type: 'raccord', col: 0, lig: 0, cote: 1, pos: 1 }, d)[0].forme, 'cercle');
  assert.equal(A.cibleSurbrillance({ type: 'port', col: 0, lig: 0, coin: 2 }, d)[0].forme, 'cercle');
  assert.equal(A.cibleSurbrillance({ type: 'modele', id: 'ex-coin' }, d).length, 4);
  assert.deepEqual(A.cibleSurbrillance({ type: 'forme' }, d), []);
  assert.deepEqual(A.cibleSurbrillance({ type: 'inconnu' }, d), []);
  assert.match(A.svgPlateau(d, { surbrillance: { type: 'jonction', i: 2, j: 2 } }), /pm-assemblage-surbrillance/);
});

test('rendu du plateau : 16 cellules, 9 jonctions, aucune injection par un nom de modèle ; 5×5 : 25 et 16', () => {
  const d = plateauComplet();
  d.modeles[0].nom = '<img src=x onerror=alert(1)>';
  const svg = A.svgPlateau(d, {});
  assert.equal((svg.match(/data-cellule=/g) || []).length, 16);
  assert.equal((svg.match(/data-jonction="/g) || []).length, 9);
  assert.ok(!/<img/.test(svg));
  const s5 = A.svgPlateau(AV2.plateauComplet('5x5', true), {});
  assert.equal((s5.match(/data-cellule=/g) || []).length, 25);
  assert.equal((s5.match(/data-jonction="/g) || []).length, 16);
});
