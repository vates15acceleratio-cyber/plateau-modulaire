'use strict';
/*
 * Recette du testeur (docs/46, docs/47) : cas limites du branchement des catalogues organiques.
 *  A. champ `poids` : valeurs hostiles en mémoire, dans un fichier JSON et dans le générateur ; modèle à 0 exemplaire jamais tiré ;
 *  B. reconnaissance du catalogue précédent (3.04) : une seule différence suffit à la refuser, le reste est toléré ; documents hostiles ;
 *  C. proposition : accepter, Ctrl+Z, Ctrl+Y, refus répété (au niveau de l'état ; la boîte de dialogue est dans outils/recette-interface.html) ;
 *  D. rythme / accès au centre / cases par moitié : plateau partiel, vide, non connexe, villes non traversables, plateaux abîmés ;
 *  E. générateur : moitiés égales sur plusieurs graines, 78 à 81 cases en 5×5, bibliothèque modifiée par l'utilisateur ;
 *  F. export du jeu complet avec le nouveau stock (24 tuiles en 4×4, 37 en 5×5).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/graphe.js');
require('../src/generateur.js');
require('../src/sauvegarde.js');
require('../src/etat.js');
require('../src/rendu.js');
require('../src/export.js');
require('../src/equilibre.js');
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, CAT = PM.catalogue, GEN = PM.generateur, S = PM.sauvegarde, GR = PM.graphe, E = PM.exportation;
const copie = (x) => JSON.parse(JSON.stringify(x));
const nouveau = (g) => CAT.nouveauDocument(g);
const modele = (doc, id) => doc.modeles.find((m) => m.id === id);
const comptes = (doc) => { const u = {}; doc.plateau.tuiles.forEach((t) => { u[t.modeleId] = (u[t.modeleId] || 0) + 1; }); return u; };
const mesures = (doc) => { const g = GR.construire(doc); return { g, r: GR.rythme(doc, g), a: GR.accesCentre(doc, g), c: GR.casesParMoitie(doc, g) }; };

/* ==================================================================== A. poids ==================================================================== */

test('poids : poidsTirage ignore toute valeur qui n\'est pas un entier d\'au moins 1 (0, négatif, décimal, texte, NaN, null, Infinity, tableau, objet)', () => {
  for (const v of [0, -3, 2.5, '5', NaN, null, Infinity, -Infinity, true, [3], { a: 1 }, 0.9999, -0]) {
    assert.equal(M.poidsTirage({ exemplaires: 4, poids: v }), 4, 'poids ' + String(v));
  }
  assert.equal(M.poidsTirage({ exemplaires: 4, poids: 1 }), 1);
  assert.equal(M.poidsTirage({ exemplaires: 4, poids: 7 }), 7);
  assert.equal(M.poidsTirage({ poids: 'x' }), 0, 'ni poids ni exemplaires valides : 0');
  assert.equal(M.poidsTirage({ exemplaires: -2, poids: 0 }), 0);
  assert.equal(M.poidsTirage({ exemplaires: 2.5 }), 0);
  assert.equal(M.poidsTirage(undefined), 0);
  assert.equal(M.poidsTirage('B1'), 0);
  assert.equal(M.poidsTirage(null), 0);
});

test('poids : validerModele signale en alerte (jamais en erreur) 0, négatif, décimal, texte, NaN, null, Infinity, au-delà de 999 ; accepte absent et entier de 1 à 999', () => {
  const m = copie(modele(nouveau('4x4'), 'B1'));
  delete m.poids;
  const signale = () => { const v = M.validerModele(m, '4x4'); return { alerte: v.alertes.some((e) => e.code === 'poids_invalide'), erreur: v.erreurs.some((e) => e.code === 'poids_invalide'), complet: v.complet }; };
  assert.equal(signale().alerte, false, 'absent');
  for (const ok of [1, 2, 999]) { m.poids = ok; assert.equal(signale().alerte, false, String(ok)); assert.equal(M.poidsTirage(m), ok); }
  for (const mauvais of [0, -1, 1.5, 'x', '3', NaN, Infinity, null, true, [2], {}, 1000, 100000, 1e15]) {
    m.poids = mauvais;
    const s = signale();
    assert.ok(s.alerte && !s.erreur && s.complet, 'poids ' + String(mauvais) + ' : alerte seule, modèle toujours posable');
    assert.equal(M.poidsTirage(m), m.exemplaires, 'poids ' + String(mauvais) + ' : le tirage retombe sur les exemplaires');
  }
});

/** Texte du fichier dont le premier modèle porte, à la place de son poids, le texte brut `brut` (pas forcément du JSON valide). */
function avecPoidsBrut(doc, brut) {
  const o = JSON.parse(S.versJSON(doc));
  o.modeles[0].poids = '@@POIDS@@';
  return JSON.stringify(o).replace('"@@POIDS@@"', brut);
}

test('poids : un fichier JSON hostile (chaîne, null, décimal, négatif, 0, tableau, objet, énorme, __proto__) ne crée ni exception ni poids', () => {
  const doc = nouveau('4x4'), base = JSON.parse(S.versJSON(doc));
  for (const v of ['5', '', 'abc', null, 1.5, -2, 0, [3], { a: 1 }, true, 1000, 1e9, 1e12, 1e308, '__proto__']) {
    const b = copie(base); b.modeles[0].poids = v;
    const r = S.depuisJSON(JSON.stringify(b));
    assert.ok(r.ok, 'poids ' + JSON.stringify(v));
    assert.ok(!('poids' in r.doc.modeles[0]), 'poids ' + JSON.stringify(v) + ' ignoré');
    assert.equal(r.doc.modeles[0].exemplaires, base.modeles[0].exemplaires);
  }
  for (const v of [1, 2, 999]) {
    const b = copie(base); b.modeles[0].poids = v;
    assert.equal(S.depuisJSON(JSON.stringify(b)).doc.modeles[0].poids, v, 'poids ' + v + ' gardé');
  }
  // texte non JSON : NaN / Infinity écrits tels quels dans le fichier
  for (const lit of ['NaN', 'Infinity', '-Infinity']) {
    const t = avecPoidsBrut(doc, lit);
    assert.doesNotThrow(() => S.depuisJSON(t));
    assert.equal(S.depuisJSON(t).ok, false, lit + ' n\'est pas du JSON');
  }
});

test('poids : une clé __proto__ ou constructor dans un modèle du fichier ne pollue ni Object.prototype ni le modèle lu', () => {
  const doc = nouveau('4x4');
  const texte = avecPoidsBrut(doc, '1, "__proto__": {"poids": 77, "exemplaires": 77}, "constructor": {"prototype": {"poids": 55}}');
  assert.ok(texte.includes('__proto__'));
  const r = S.depuisJSON(texte);
  assert.ok(r.ok);
  assert.equal(({}).poids, undefined);
  assert.equal(Object.prototype.poids, undefined);
  assert.equal(Object.getPrototypeOf(r.doc.modeles[0]), Object.prototype);
  assert.ok(r.doc.modeles.every((m) => M.poidsTirage(m) < 77));
  assert.ok(!Object.keys(r.doc.modeles[0]).includes('__proto__'));
  // poids = objet portant __proto__ : ignoré
  const t2 = avecPoidsBrut(doc, '{"__proto__": {"x": 1}}');
  const r2 = S.depuisJSON(t2);
  assert.ok(r2.ok && !('poids' in r2.doc.modeles[0]));
  assert.equal(({}).x, undefined);
});

test('poids : réouverture après sauvegarde, exemplaires changés par l\'utilisateur : le poids reste celui du catalogue, le stock change', () => {
  for (const g of ['4x4', '5x5']) {
    const doc = nouveau(g), id = g === '4x4' ? 'B8' : 'LC2';
    const avant = modele(doc, id).poids;
    const d = M.changerExemplaires(doc, id, 11);
    const r = S.depuisJSON(S.versJSON(d));
    assert.ok(r.ok && r.alertes.length === 0);
    assert.equal(modele(r.doc, id).exemplaires, 11);
    assert.equal(modele(r.doc, id).poids, avant);
    assert.equal(M.poidsTirage(modele(r.doc, id)), avant);
    // à 0 exemplaire : le poids est conservé mais le modèle n'est pas tirable
    const z = S.depuisJSON(S.versJSON(M.changerExemplaires(doc, id, 0))).doc;
    assert.equal(modele(z, id).exemplaires, 0);
    assert.equal(modele(z, id).poids, avant);
    assert.ok(!GEN.modelesParGabarit(z, M.formatDuDocument(z))[modele(z, id).gabarit].some((m) => m.id === id));
  }
});

test('poids hostile en mémoire : valide (entier de 1 à 999) ou non = plateau normal (un poids invalide retombe sur les exemplaires), jamais d\'exception', () => {
  for (const v of [1, 999]) {
    const doc = nouveau('4x4');
    doc.modeles.forEach((m) => { m.poids = v; });
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(doc, { graine: 'ph', candidats: 4 }); }, 'poids ' + String(v));
    assert.ok(r.ok, 'poids ' + String(v) + ' : ' + r.raison);
    assert.equal(GR.equilibre(r.doc).blocages.length, 0);
  }
  // poids invalide posé à la main dans le document : validerModele l'alerte (poids_invalide) et le tirage retombe sur les exemplaires, le
  // modèle reste posable (la sauvegarde, elle, ignore ces valeurs : ce cas n'existe pas dans un fichier relu)
  for (const v of [-5, 0, 2.5, 'abc', NaN, Infinity, null, [1], 1e300, 1000, 1e6, 1e15, Number.MAX_SAFE_INTEGER]) {
    const doc = nouveau('4x4');
    doc.modeles.forEach((m) => { m.poids = v; });
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(doc, { graine: 'ph', candidats: 4 }); }, 'poids ' + String(v));
    assert.ok(r.ok, 'poids ' + String(v) + ' : ' + r.raison);
    assert.equal(GR.equilibre(r.doc).blocages.length, 0, 'poids ' + String(v));
  }
  // un poids élevé (999) sur un seul modèle le favorise sans empêcher le plateau (les autres gabarits sont inchangés)
  const doc = nouveau('4x4');
  modele(doc, 'B8').poids = 999;
  const r = GEN.generer(doc, { graine: 'ph2', candidats: 6 });
  assert.ok(r.ok, r.raison);
});

test('modèle à 0 exemplaire : jamais tiré, même avec un poids énorme, sur 25 graines en 4×4 (B8, K4) et 8 en 5×5 (LC2, LC4)', () => {
  const d4 = nouveau('4x4');
  ['B8', 'K4'].forEach((id) => { modele(d4, id).exemplaires = 0; modele(d4, id).poids = 1e9; });
  for (let k = 0; k < 25; k++) {
    const r = GEN.generer(d4, { graine: 'zero-' + k, candidats: 4 });
    assert.ok(r.ok, r.raison);
    const u = comptes(r.doc);
    assert.ok(!u.B8 && !u.K4, 'graine ' + k + ' : ' + JSON.stringify(u));
  }
  const d5 = nouveau('5x5');
  ['LC2', 'LC4'].forEach((id) => { modele(d5, id).exemplaires = 0; modele(d5, id).poids = 1e9; });
  for (let k = 0; k < 8; k++) {
    const r = GEN.generer(d5, { graine: 'zero-' + k, candidats: 2 });
    assert.ok(r.ok, r.raison);
    const u = comptes(r.doc);
    assert.ok(!u.LC2 && !u.LC4, 'graine ' + k + ' : ' + JSON.stringify(u));
  }
});

/* ========================================== B. reconnaissance du catalogue précédent ========================================== */

const precedent = (g) => { const d = nouveau(g); d.modeles = copie(CAT.precedent[g]); return d; };
const reconnu = (d) => S.bibliothequeCataloguePrecedent(d);

test('catalogue précédent : une seule différence de tracé sur un seul modèle suffit à refuser (tous les modèles, 4×4 et 5×5)', () => {
  for (const g of ['4x4', '5x5']) {
    CAT.precedent[g].forEach((ref, k) => {
      const essais = {
        'case déplacée': (m) => { m.cases[0].y += 1; },
        'type de case changé': (m) => { m.cases[0].type = m.cases[0].type === 'ordinaire' ? 'ville' : 'ordinaire'; },
        'chemin retiré': (m) => { m.chemins.pop(); },
        'case ajoutée': (m) => { m.cases.push({ id: 'zz', x: 50, y: 50, type: 'ordinaire' }); },
        'gabarit changé': (m) => { m.gabarit = m.gabarit === 'bord' ? 'coin' : 'bord'; },
        'passage ajouté': (m) => { m.pivots = [{ id: 'v1', x: 40, y: 40 }]; m.passages = [{ id: 'p1', a: { 'case': m.cases[0].id }, b: { pivot: 'v1' } }]; },
        'identifiant renommé': (m) => { m.id = m.id + 'x'; }
      };
      for (const [nom, change] of Object.entries(essais)) {
        const d = precedent(g);
        change(d.modeles[k]);
        assert.equal(reconnu(d), false, g + ' ' + ref.id + ' : ' + nom);
      }
    });
  }
});

test('catalogue précédent : noms, exemplaires, poids, ordre des modèles et ordre des clés ne comptent pas ; tableaux vides ajoutés non plus', () => {
  for (const g of ['4x4', '5x5']) {
    const d = precedent(g);
    d.modeles.forEach((m, k) => { m.nom = 'Perso ' + k; m.exemplaires = 99 - k; m.poids = k + 1; });
    assert.equal(reconnu(d), true, g + ' noms / exemplaires / poids');
    const inv = precedent(g);
    inv.modeles.reverse();
    assert.equal(reconnu(inv), true, g + ' ordre inversé');
    const cles = precedent(g);
    cles.modeles = cles.modeles.map((m) => { const o = {}; Object.keys(m).reverse().forEach((c) => { o[c] = m[c]; }); return o; });
    assert.equal(reconnu(cles), true, g + ' clés dans l\'ordre inverse');
    const vides = precedent(g);
    vides.modeles.forEach((m) => { m.pivots = []; m.passages = []; });
    assert.equal(reconnu(vides), true, g + ' pivots et passages vides');
    const exemplairesZero = precedent(g);
    exemplairesZero.modeles.forEach((m) => { m.exemplaires = 0; });
    assert.equal(reconnu(exemplairesZero), true, g + ' tous les exemplaires à 0');
  }
});

test('catalogue précédent : une tuile retournée (symétrie) ou tournée de 90° dans le tracé n\'est plus le même modèle', () => {
  for (const g of ['4x4', '5x5']) {
    const F = G.format(g), c = F.COTE / 2;
    for (const rot of [(x, y) => [2 * c - y, x], (x, y) => [2 * c - x, y]]) { // quart de tour, miroir
      const d = precedent(g);
      const m = d.modeles.find((x) => x.gabarit === 'bord' || x.gabarit === 'coin');
      m.cases.forEach((cs) => { const p = rot(cs.x, cs.y); cs.x = Math.round(p[0] * 100) / 100; cs.y = Math.round(p[1] * 100) / 100; });
      const identique = JSON.stringify(m.cases) === JSON.stringify(CAT.precedent[g].find((x) => x.id === m.id).cases);
      assert.equal(reconnu(d), identique, g + ' ' + m.id);
    }
  }
});

test('catalogue précédent : modèle dupliqué à la place d\'un autre, modèle d\'une autre grille, entrées nulles ou abîmées : refusé sans exception', () => {
  for (const g of ['4x4', '5x5']) {
    const dup = precedent(g);
    dup.modeles[1] = copie(dup.modeles[0]);
    assert.equal(reconnu(dup), false, g + ' doublon');
    const nul = precedent(g);
    nul.modeles[2] = null;
    assert.equal(reconnu(nul), false, g + ' null');
    const sansCases = precedent(g);
    delete sansCases.modeles[0].cases;
    assert.equal(reconnu(sansCases), false, g + ' sans cases');
    const nombres = precedent(g);
    nombres.modeles = nombres.modeles.map(() => 42);
    assert.equal(reconnu(nombres), false, g + ' nombres');
  }
  const autre = precedent('4x4');
  autre.modeles = copie(CAT.precedent['5x5']).slice(0, CAT.precedent['4x4'].length);
  assert.equal(reconnu(autre), false, 'modèles 5×5 dans un document 4×4');
  const croise = precedent('5x5');
  croise.grille = '4x4';
  assert.equal(reconnu(croise), false, 'modèles 5×5 dans un document déclaré 4×4');
  const hostile = precedent('4x4');
  Object.defineProperty(hostile, 'modeles', { get() { throw new Error('piège'); } });
  assert.equal(reconnu(hostile), false, 'accesseur qui lève');
  for (const x of ['x', 42, true, [], () => 0]) assert.equal(reconnu(x), false, String(x));
});

test('catalogue précédent : un document sans champ grille (ancien) est lu comme 4×4 ; un champ inconnu dans un modèle est éliminé à la lecture', () => {
  const d = precedent('4x4');
  delete d.grille;
  assert.equal(reconnu(d), true);
  assert.equal(M.formatDuDocument(d).id, '4x4');
  const brut = JSON.parse(S.versJSON(precedent('5x5')));
  brut.modeles[0].commentaire = 'ajouté à la main';
  brut.modeles[0].poids = 3;
  const r = S.depuisJSON(JSON.stringify(brut));
  assert.ok(r.ok);
  assert.equal(reconnu(r.doc), true, 'le champ inconnu ne survit pas à la lecture, le poids et le nom ne comptent pas');
});

test('catalogue précédent : la reconnaissance ne dépend pas du plateau ni des jetons ; le document n\'est pas modifié', () => {
  for (const g of ['4x4', '5x5']) {
    const vide = precedent(g);
    const plein = precedent(g);
    plein.plateau.jetons = [{ i: 1, j: 1, type: 'ville' }];
    plein.plateau.tuiles = [{ modeleId: CAT.precedent[g][0].id, col: 0, lig: 0, rot: 0 }, { modeleId: 'inexistant', col: 9, lig: 9, rot: 7 }];
    const avant = JSON.stringify(plein);
    assert.equal(reconnu(vide), true);
    assert.equal(reconnu(plein), true);
    assert.equal(JSON.stringify(plein), avant);
  }
});

/* ============================== C. proposition : accepter, Ctrl+Z, Ctrl+Y, refus (niveau état) ============================== */

/** Ce que fait outils/recette-interface.html et src/app.js : le bouton « Charger le nouveau catalogue ». */
const accepter = (etat) => etat.remplacer(CAT.nouveauDocument(etat.doc().grille || G.FORMAT_DEFAUT), 'nouveau catalogue');

test('proposition : accepter = une étape d\'historique ; Ctrl+Z rend le document tel quel ; Ctrl+Y le nouveau catalogue ; ni boucle ni perte', () => {
  for (const g of ['4x4', '5x5']) {
    const ancien = precedent(g);
    ancien.plateau.tuiles = [{ modeleId: CAT.precedent[g][0].id, col: 0, lig: 0, rot: 0 }];
    const etat = PM.etat.creer(ancien);
    assert.equal(reconnu(etat.doc()), true);
    accepter(etat);
    assert.equal(etat.doc().grille, g);
    assert.deepEqual(etat.doc().plateau, { tuiles: [], jetons: [] });
    assert.equal(reconnu(etat.doc()), false, 'le nouveau catalogue n\'est pas reproposé');
    assert.deepEqual(etat.doc().modeles, nouveau(g).modeles);
    // Ctrl+Z
    assert.equal(etat.annuler(), true);
    assert.deepEqual(etat.doc(), ancien);
    assert.equal(reconnu(etat.doc()), true);
    assert.equal(etat.peutAnnuler(), false, 'une seule étape');
    // Ctrl+Y
    assert.equal(etat.retablir(), true);
    assert.deepEqual(etat.doc().modeles, nouveau(g).modeles);
    assert.equal(etat.peutRetablir(), false);
    // Ctrl+Z, Ctrl+Y, Ctrl+Z : stable
    etat.annuler(); etat.retablir(); etat.annuler();
    assert.deepEqual(etat.doc(), ancien);
    // un travail après l'acceptation vide la pile « rétablir » ; Ctrl+Z revient au nouveau catalogue puis à l'ancien
    etat.retablir();
    const id = nouveau(g).modeles.find((m) => m.gabarit === 'bord').id;
    etat.appliquer((d) => M.poserTuile(d, id, 1, 0), 'poser');
    assert.equal(etat.peutRetablir(), false);
    etat.annuler();
    assert.deepEqual(etat.doc().plateau, { tuiles: [], jetons: [] });
    etat.annuler();
    assert.deepEqual(etat.doc(), ancien);
  }
});

test('proposition : accepter deux fois de suite (document déjà remplacé) ne casse pas l\'historique ; les modèles livrés sont des copies indépendantes', () => {
  const ancien = precedent('4x4');
  const etat = PM.etat.creer(ancien);
  accepter(etat);
  accepter(etat);
  etat.doc().modeles[0].nom = 'modifié dans le document';
  assert.notEqual(CAT.nouveauDocument('4x4').modeles[0].nom, 'modifié dans le document', 'le catalogue livré n\'est pas altéré');
  assert.equal(etat.annuler(), true);
  assert.deepEqual(etat.doc().modeles, nouveau('4x4').modeles);
  assert.equal(etat.annuler(), true);
  assert.deepEqual(etat.doc(), ancien);
  assert.equal(etat.annuler(), false);
});

test('proposition : refus répété (rien n\'est fait) = document et historique intacts, et la proposition revient à chaque réouverture', () => {
  for (const g of ['4x4', '5x5']) {
    const ancien = precedent(g);
    const etat = PM.etat.creer(ancien);
    const avant = JSON.stringify(etat.doc());
    for (let k = 0; k < 3; k++) {
      // « Garder mes tuiles » : aucun appel à l'état
      assert.equal(JSON.stringify(etat.doc()), avant);
      assert.equal(etat.peutAnnuler(), false);
      assert.equal(etat.peutRetablir(), false);
      // réouverture du même fichier : le document est de nouveau reconnu
      const relu = S.depuisJSON(S.versJSON(etat.doc()));
      assert.ok(relu.ok);
      assert.equal(reconnu(relu.doc), true, 'tour ' + k);
    }
    // l'utilisateur garde ses tuiles et en change une : plus de proposition
    etat.appliquer((d) => M.changerExemplaires(d, CAT.precedent[g][0].id, 9), 'exemplaires');
    assert.equal(reconnu(etat.doc()), true, 'changer des exemplaires n\'ôte pas la reconnaissance (proposition encore utile)');
    etat.appliquer((d) => { const c = copie(d); c.modeles[0].cases[0].x += 1; return c; }, 'tracé');
    assert.equal(reconnu(etat.doc()), false, 'un tracé modifié : plus de proposition');
  }
});

/* ======================= D. mesures de src/graphe.js sur des plateaux limites ======================= */

/** Tuiles du plateau du générateur gardées selon le filtre (plateau partiel). */
function partiel(doc, garde) { const d = copie(doc); d.plateau.tuiles = d.plateau.tuiles.filter(garde); d.plateau.jetons = []; return d; }
const plateauGenere = (g, k) => { const r = GEN.generer(nouveau(g), { graine: 'lim-' + g + '-' + k, candidats: 3 }); assert.ok(r.ok, r.raison); return r.doc; };

test('mesures : plateau vide (aucune tuile, aucun jeton) en 4×4 et 5×5 : zéros, pas d\'exception, moitiés égales', () => {
  for (const g of ['4x4', '5x5']) {
    const { r, a, c } = mesures(nouveau(g));
    assert.equal(r.zones, 0);
    assert.equal(r.chaineMax, 0);
    assert.deepEqual(r.chaine, []);
    assert.equal(r.distMax, 0);
    assert.deepEqual(a.portes, { vert: 0, rouge: 0 });
    assert.equal(a.ecart, 0);
    assert.deepEqual(a.chemins, { vert: 0, rouge: 0 });
    assert.equal(a.ecartChemins, 0);
    assert.deepEqual(c.tuiles, { vert: 0, rouge: 0, neutre: 0 });
    assert.equal(c.ecart, 0, 'les jonctions-cases sont réparties symétriquement');
    assert.equal(c.jonctions.vert, c.jonctions.rouge);
  }
});

test('mesures : documents abîmés (sans plateau, tuiles nulles, modèle inconnu, hors grille) : ni exception ni valeur NaN', () => {
  for (const g of ['4x4', '5x5']) {
    const variantes = [
      (d) => { delete d.plateau; },
      (d) => { d.plateau = { tuiles: null, jetons: null }; },
      (d) => { d.plateau = { tuiles: [null, undefined, 3, 'x', {}, { modeleId: 'inconnu', col: 0, lig: 0, rot: 0 }], jetons: [] }; },
      (d) => { d.plateau = { tuiles: [{ modeleId: d.modeles[0].id, col: 99, lig: -4, rot: 12 }], jetons: [{ i: 99, j: 99, type: 'ville' }, null] }; }
    ];
    for (const v of variantes) {
      const d = nouveau(g); v(d);
      assert.doesNotThrow(() => GR.reseauxPassages(d));
      const gr = GR.construire(d);
      assert.doesNotThrow(() => GR.rythme(d, gr));
      assert.doesNotThrow(() => GR.accesCentre(d, gr));
      assert.doesNotThrow(() => GR.casesParMoitie(d, gr));
      const c = GR.casesParMoitie(d, gr), a = GR.accesCentre(d, gr), r = GR.rythme(d, gr);
      [c.ecart, a.ecart, a.ecartChemins, r.chaineMax, r.distMax].forEach((x) => assert.ok(Number.isInteger(x), String(x)));
    }
  }
});

test('mesures : plateau partiel (une seule tuile, une moitié, une seule rangée) : cases par moitié = cases posées ; accès bornés ; chaîne finie', () => {
  for (const g of ['4x4', '5x5']) {
    const doc = plateauGenere(g, 0), F = G.format(g);
    const N = F.GRILLE.lignes;
    const nbCases = (t) => M.modeleParId(doc, t.modeleId).cases.length;
    // une seule tuile du camp vert
    const t0 = doc.plateau.tuiles.find((t) => F.campCellule(t.col, t.lig) === 'vert');
    const un = partiel(doc, (t) => t.col === t0.col && t.lig === t0.lig);
    let m = mesures(un);
    assert.equal(m.c.tuiles.vert, nbCases(t0));
    assert.equal(m.c.tuiles.rouge, 0);
    assert.equal(m.c.ecart, m.c.vert - m.c.rouge);
    assert.equal(m.c.vert + m.c.rouge, m.c.tuiles.vert + m.c.tuiles.rouge + m.c.jonctions.vert + m.c.jonctions.rouge);
    assert.ok(m.a.portes.rouge === 0);
    // moitié rouge seule
    const rouge = partiel(doc, (t) => F.campCellule(t.col, t.lig) === 'rouge');
    m = mesures(rouge);
    assert.equal(m.c.tuiles.vert, 0);
    assert.ok(m.c.tuiles.rouge > 0);
    assert.ok(m.a.portes.vert === 0 && m.a.portes.rouge >= 0);
    // première rangée seule
    const rangee = partiel(doc, (t) => t.lig === 0);
    m = mesures(rangee);
    assert.equal(m.c.tuiles.rouge, 0);
    assert.equal(m.r.zones, m.r.casesRaccourci.length + new Set([...m.r.casesPassage]).size + m.g.villes.size - new Set([...m.r.casesRaccourci].filter((x) => m.r.casesPassage.includes(x))).size);
    assert.ok(Number.isFinite(m.r.chaineMax));
    // toutes les rangées sauf la dernière
    const sansDerniere = partiel(doc, (t) => t.lig < N - 1);
    m = mesures(sansDerniere);
    assert.equal(m.c.tuiles.vert + m.c.tuiles.rouge + m.c.tuiles.neutre, m.g.cases.size);
  }
});

test('mesures : plateau non connexe (tuiles isolées) : les cases injoignables sont comptées, la chaîne reste celle d\'un chemin réel du graphe', () => {
  for (const g of ['4x4', '5x5']) {
    const F = G.format(g), N = F.GRILLE.lignes;
    const doc = plateauGenere(g, 1);
    // deux coins opposés seulement : aucune liaison entre eux
    const d = partiel(doc, (t) => (t.col === 0 && t.lig === 0) || (t.col === N - 1 && t.lig === N - 1));
    const { g: gr, r } = mesures(d);
    assert.equal(d.plateau.tuiles.length, 2);
    // les deux tuiles ne partagent aucun raccord : le graphe a au moins 2 composantes
    const vu = new Set(), compo = [];
    gr.noeuds.forEach((id) => {
      if (vu.has(id) || !gr.cases.has(id)) return;
      const f = [id]; vu.add(id); let n = 0;
      for (let q = 0; q < f.length; q++) { if (gr.cases.has(f[q])) n++; gr.voisins.get(f[q]).forEach((w) => { if (!vu.has(w)) { vu.add(w); f.push(w); } }); }
      compo.push(n);
    });
    assert.ok(compo.length >= 2, g + ' composantes de cases : ' + compo);
    assert.ok(r.injoignables > 0, 'cases sans zone atteignable : ' + r.injoignables);
    if (r.chaineMax) for (let k = 1; k < r.chaine.length; k++) assert.ok(gr.voisins.get(r.chaine[k - 1]).has(r.chaine[k]));
    // accès : bornes
    const a = GR.accesCentre(d, gr);
    assert.ok(a.chemins.vert <= a.portes.vert + a.contacts && a.chemins.rouge <= a.portes.rouge + a.contacts);
  }
});

/** Oracle indépendant : plus longue chaîne entre zones, villes traversables ou non selon le graphe. */
function chaineOracle(gr, zones) {
  const bloque = (x) => !gr.villesTraversables && gr.villes.has(x);
  const bfs = (s, stop) => {
    const d = new Map([[s, 0]]), f = [s];
    for (let q = 0; q < f.length; q++) { const x = f[q]; if (x !== s && stop(x)) continue; for (const y of gr.voisins.get(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); f.push(y); } }
    return d;
  };
  let max = 0;
  for (const a of zones) {
    const reel = bfs(a, bloque), vers = bfs(a, (x) => zones.has(x));
    for (const b of zones) if (b !== a && vers.has(b) && reel.get(b) === vers.get(b)) max = Math.max(max, vers.get(b) - 1);
  }
  return max;
}

test('rythme : villes traversables ou non (option du graphe) : la chaîne reste celle de l\'oracle, sur plateaux complets et partiels, 4×4 et 5×5', () => {
  for (const g of ['4x4', '5x5']) {
    for (let k = 0; k < 4; k++) {
      const doc = plateauGenere(g, k);
      const docs = [doc, partiel(doc, (t) => t.lig <= 2)];
      docs.forEach((d, n) => {
        if (n === 1) d.plateau.jetons = copie(doc.plateau.jetons);
        for (const trav of [false, true]) {
          const gr = GR.construire(d, { villesTraversables: trav }), r = GR.rythme(d, gr);
          const zones = new Set(gr.villes);
          r.casesPassage.forEach((x) => zones.add(x));
          r.casesRaccourci.forEach((x) => zones.add(x));
          assert.equal(r.zones, zones.size);
          assert.equal(r.chaineMax, chaineOracle(gr, zones), g + ' graine ' + k + (trav ? ' villes traversables' : '') + (n ? ' partiel' : ''));
        }
      });
    }
  }
});

test('rythme : sans villes (jetons retirés), les zones sont les passages et les raccourcis seulement ; les sept villes ajoutent des zones', () => {
  for (const g of ['4x4', '5x5']) {
    const doc = plateauGenere(g, 2);
    const sans = copie(doc); sans.plateau.jetons = [];
    const gr = GR.construire(sans), r = GR.rythme(sans, gr);
    assert.equal(gr.villes.size, 0);
    assert.equal(new Set([...r.casesPassage, ...r.casesRaccourci]).size, r.zones);
    const { r: r2 } = mesures(doc);
    assert.ok(r2.zones >= r.zones + 7, 'sept villes de plus');
  }
});

test('accès au centre et moitiés : plateau retourné par demi-tour d\'ensemble (cases) : écarts opposés ; jonctions-cases symétriques', () => {
  for (const g of ['4x4', '5x5']) {
    const F = G.format(g), N = F.GRILLE.lignes;
    for (let k = 0; k < 4; k++) {
      const doc = plateauGenere(g, k);
      const tourne = copie(doc);
      tourne.plateau.tuiles = doc.plateau.tuiles.map((t) => ({ modeleId: t.modeleId, col: N - 1 - t.col, lig: N - 1 - t.lig, rot: (t.rot + 2) % 4 }));
      tourne.plateau.jetons = [];
      const sans = copie(doc); sans.plateau.jetons = [];
      const a = mesures(sans), b = mesures(tourne);
      assert.equal(b.c.vert, a.c.rouge, g + ' cases : le demi-tour échange les camps');
      assert.equal(b.c.rouge, a.c.vert);
      assert.equal(b.c.ecart + a.c.ecart, 0);
      assert.equal(b.a.ecart + a.a.ecart, 0, g + ' portes');
      assert.equal(b.a.portes.vert, a.a.portes.rouge);
      assert.equal(b.a.ecartChemins + a.a.ecartChemins, 0);
      assert.equal(b.r.chaineMax, a.r.chaineMax, 'le rythme ne dépend pas du camp');
    }
  }
});

test('égalité des moitiés : écart de cases nul sur 40 graines en 4×4 et 25 en 5×5, aucun rejet cases_moities, plateau sans blocage', () => {
  for (const [g, n] of [['4x4', 40], ['5x5', 25]]) {
    for (let k = 0; k < n; k++) {
      const r = GEN.generer(nouveau(g), { graine: 'moitie-' + k, candidats: 3 });
      assert.ok(r.ok, r.raison);
      const { c } = mesures(r.doc);
      assert.equal(c.ecart, 0, g + ' graine ' + k + ' : ' + JSON.stringify(c));
      assert.equal(r.rejets.cases_moities, 0);
      assert.equal(GR.equilibre(r.doc).blocages.length, 0);
    }
  }
});

/** Cases du plateau : cases des tuiles plus jonctions qui ne portent pas de ville (la jonction-case compte une case). */
const casesTotales = (doc) => { const g = GR.construire(doc); return g.cases.size + g.jonctions.filter((j) => j.type === 'case').length; };

test('5×5 : 59 cases sur 25 graines (2 cases par tuile, 9 jonctions-cases, docs/55) ; 4×4 : de 56 à 62 cases sur 15 graines', () => {
  for (let k = 0; k < 25; k++) {
    const r = GEN.generer(nouveau('5x5'), { graine: 'cases-' + k, candidats: 2 });
    assert.ok(r.ok, r.raison);
    assert.equal(casesTotales(r.doc), 59, 'graine ' + k);
  }
  for (let k = 0; k < 15; k++) {
    const r = GEN.generer(nouveau('4x4'), { graine: 'cases-' + k, candidats: 2 });
    assert.ok(r.ok, r.raison);
    const n = casesTotales(r.doc);
    assert.ok(n >= 56 && n <= 62, '4×4 graine ' + k + ' : ' + n + ' cases');
  }
});

/* ================= E. générateur dans une bibliothèque modifiée par l'utilisateur ================= */

test('bibliothèque modifiée (4×4) : tuile supprimée, exemplaires à 0, tuile ajoutée : plateau valide, moitiés égales, le modèle absent n\'est jamais posé', () => {
  const doc = nouveau('4x4');
  doc.modeles = doc.modeles.filter((m) => m.id !== 'Q2');
  modele(doc, 'B8').exemplaires = 0;
  const ajout = copie(modele(doc, 'B1')); ajout.id = 'X1'; ajout.nom = 'Ajout'; ajout.exemplaires = 30; delete ajout.poids;
  doc.modeles.push(ajout);
  let x1 = 0;
  for (let k = 0; k < 12; k++) {
    const r = GEN.generer(doc, { graine: 'bib-' + k, candidats: 4 });
    assert.ok(r.ok, r.raison);
    const u = comptes(r.doc);
    assert.ok(!u.Q2 && !u.B8, JSON.stringify(u));
    x1 += u.X1 || 0;
    assert.equal(mesures(r.doc).c.ecart, 0);
    assert.equal(r.doc.modeles.length, doc.modeles.length, 'la bibliothèque du résultat est celle du document');
  }
  assert.ok(x1 > 0, 'la tuile ajoutée (poids = 30 exemplaires) est tirée');
});

test('bibliothèque modifiée : tuile ajoutée incomplète (brouillon) ou à 0 exemplaire jamais posée ; plus aucun modèle d\'un gabarit : refus avec message, sans exception', () => {
  const doc = nouveau('4x4');
  const b = copie(modele(doc, 'B1')); b.id = 'brouillon'; b.chemins = []; b.exemplaires = 50;
  const z = copie(modele(doc, 'B1')); z.id = 'zero'; z.exemplaires = 0; z.poids = 50;
  doc.modeles.push(b, z);
  for (let k = 0; k < 8; k++) {
    const r = GEN.generer(doc, { graine: 'br-' + k, candidats: 3 });
    assert.ok(r.ok, r.raison);
    const u = comptes(r.doc);
    assert.ok(!u.zero && !u.brouillon, JSON.stringify(u));
  }
  for (const gabarit of ['coin', 'bord', 'centrale']) {
    const d = nouveau('4x4');
    d.modeles = d.modeles.filter((m) => m.gabarit !== gabarit);
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(d, { graine: 'sans-' + gabarit, candidats: 3 }); });
    assert.equal(r.ok, false);
    assert.match(r.raison, new RegExp('aucun modèle de ' + gabarit));
  }
  const tout0 = nouveau('4x4'); tout0.modeles.forEach((m) => { m.exemplaires = 0; });
  assert.equal(GEN.generer(tout0, { graine: 'zero' }).ok, false);
});

test('bibliothèque modifiée (5×5) : LC1 à 0 exemplaire et LC2 supprimé : plateau valide, 25 tuiles, moitiés égales, ni LC1 ni LC2 ; LB2 ou LK2 supprimé : jamais d’exception', () => {
  const d5 = nouveau('5x5');
  d5.modeles = d5.modeles.filter((m) => m.id !== 'LC2');
  modele(d5, 'LC1').exemplaires = 0;
  for (let k = 0; k < 6; k++) {
    const r = GEN.generer(d5, { graine: 'b5-' + k, candidats: 2 });
    assert.ok(r.ok, r.raison);
    assert.equal(r.doc.plateau.tuiles.length, 25);
    const u = comptes(r.doc);
    assert.ok(!u.LC1 && !u.LC2);
    assert.equal(mesures(r.doc).c.ecart, 0, 'graine ' + k);
    assert.equal(GR.equilibre(r.doc).blocages.length, 0);
  }
  for (const id of ['LB2', 'LK2']) {
    const d = nouveau('5x5');
    d.modeles = d.modeles.filter((m) => m.id !== id);
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(d, { graine: 'sans-' + id, candidats: 2, essaisMax: 30 }); });
    if (!r.ok) assert.ok(typeof r.raison === 'string' && r.raison.length > 0, id + ' : refus sans message');
    else assert.equal(GR.equilibre(r.doc).blocages.length, 0, id + ' : plateau accepté mais bloquant');
  }
});

test('document 3.04 ou 4.00.0 conservé tel quel par l\'utilisateur (« Garder mes tuiles ») : 4×4, le générateur fonctionne encore ; 5×5, il abandonne en conseillant le nouveau catalogue', () => {
  const d = precedent('4x4');
  for (let k = 0; k < 3; k++) {
    const r = GEN.generer(d, { graine: 'ancien-' + k, candidats: 3 });
    assert.ok(r.ok, '4x4 : ' + r.raison);
    assert.equal(GR.equilibre(r.doc).blocages.length, 0);
  }
  // 5×5 (docs/18, « 5×5 très connecté ») : moins de 5 % de cases à 2 connexions, intenable avec les tuiles 3.04 ou 4.00.0
  for (const x of CAT.precedents['5x5']) {
    const d5 = nouveau('5x5'); d5.modeles = copie(x.modeles);
    const r = GEN.generer(d5, { graine: 'ancien-0', candidats: 3 });
    assert.equal(r.ok, false, x.version);
    assert.match(r.raison, /Charger le nouveau catalogue/, x.version);
  }
});

/* ======================= F. export du jeu complet avec le nouveau stock ======================= */

test('export du jeu complet : 24 tuiles en 4×4 (4 planches A3, 12 A4) et 25 en 5×5 (5 planches A3, 13 A4), exemplaires par modèle respectés', () => {
  for (const [g, total, a3, a4] of [['4x4', 24, 4, 12], ['5x5', 25, 5, 13]]) {
    const doc = nouveau(g);
    assert.equal(doc.modeles.reduce((s, m) => s + m.exemplaires, 0), total);
    const liste = E.listeTuiles(doc, { portee: 'stock' });
    assert.equal(liste.tuiles.length, total);
    for (const m of doc.modeles) assert.equal(liste.tuiles.filter((t) => t.modeleId === m.id).length, m.exemplaires, m.id);
    const p3 = E.calepiner(doc, { format: 'A3', portee: 'stock' }), p4 = E.calepiner(doc, { format: 'A4', portee: 'stock' });
    assert.equal(p3.length, a3, g + ' A3');
    assert.equal(p4.length, a4, g + ' A4');
    assert.equal(p3.reduce((s, p) => s + p.tuiles.length, 0), total);
    assert.equal(p4.reduce((s, p) => s + p.tuiles.length, 0), total);
    // étiquettes uniques et numérotées dès qu'un modèle a plusieurs exemplaires
    const etiq = p3.flatMap((p) => p.tuiles.map((t) => t.etiquette));
    assert.equal(new Set(etiq).size, total);
    for (const m of doc.modeles) {
      if (m.exemplaires > 1) assert.ok(etiq.includes(m.id + '-' + m.exemplaires) && !etiq.includes(m.id), m.id);
      else assert.ok(etiq.includes(m.id));
    }
  }
});

test('export du jeu complet : dernière planche A3 du 5×5 ne porte qu\'une tuile ; le SVG de chaque planche est produit ; le document n\'est pas modifié', () => {
  const doc = nouveau('5x5'), avant = JSON.stringify(doc);
  const planches = E.calepiner(doc, { format: 'A3', portee: 'stock' });
  assert.equal(planches[planches.length - 1].tuiles.length, 1);
  assert.equal(planches[0].tuiles.length, 6);
  planches.forEach((p) => { const svg = p.svg; assert.match(svg, /^<svg|^<\?xml/); assert.ok(svg.length > 1000); });
  assert.equal(JSON.stringify(doc), avant);
});

test('export du jeu complet : stock modifié (0 exemplaire, modèle supprimé, tuile ajoutée) et tuiles posées d\'abord ; le poids n\'intervient pas', () => {
  for (const g of ['4x4', '5x5']) {
    const doc = nouveau(g);
    const premier = doc.modeles[0].id, second = doc.modeles[1].id;
    modele(doc, premier).exemplaires = 0;
    modele(doc, premier).poids = 999;
    modele(doc, second).poids = 1;
    const l = E.listeTuiles(doc, { portee: 'stock' });
    assert.ok(!l.tuiles.some((t) => t.modeleId === premier));
    assert.equal(l.tuiles.filter((t) => t.modeleId === second).length, modele(doc, second).exemplaires);
    const sans = copie(doc); sans.modeles = sans.modeles.filter((m) => m.id !== second);
    assert.ok(!E.listeTuiles(sans, { portee: 'stock' }).tuiles.some((t) => t.modeleId === second));
    const ajout = copie(modele(doc, second)); ajout.id = 'Z9'; ajout.exemplaires = 2;
    const plus = copie(doc); plus.modeles.push(ajout);
    assert.equal(E.listeTuiles(plus, { portee: 'stock' }).tuiles.filter((t) => t.modeleId === 'Z9').length, 2);
  }
  // un plateau généré avec le stock : les tuiles posées en tête de liste, les réserves ensuite
  const doc = nouveau('4x4');
  const r = GEN.generer(doc, { graine: 'exp', candidats: 3 });
  assert.ok(r.ok);
  const l = E.listeTuiles(r.doc, { portee: 'stock' });
  assert.equal(l.tuiles.length, 24);
  const posees = l.tuiles.filter((t) => t.posee).length;
  assert.ok(l.tuiles.slice(0, posees).every((t) => t.posee) && l.tuiles.slice(posees).every((t) => !t.posee));
  const u = comptes(r.doc), enTrop = Object.keys(u).reduce((s, id) => s + Math.max(0, u[id] - modele(r.doc, id).exemplaires), 0);
  assert.equal(posees, r.doc.plateau.tuiles.length - enTrop, 'les poses au-delà du stock ne sont pas des exemplaires du jeu');
});

test('export du jeu complet : après acceptation du nouveau catalogue, le jeu exporté est celui du nouveau stock (et non de l\'ancien)', () => {
  for (const [g, total] of [['4x4', 24], ['5x5', 25]]) {
    const etat = PM.etat.creer(precedent(g));
    const avant = E.listeTuiles(etat.doc(), { portee: 'stock' }).tuiles.length;
    accepter(etat);
    assert.equal(E.listeTuiles(etat.doc(), { portee: 'stock' }).tuiles.length, total);
    etat.annuler();
    assert.equal(E.listeTuiles(etat.doc(), { portee: 'stock' }).tuiles.length, avant);
  }
});

/* ======================================== défaut corrigé (docs/49) ======================================== */

test('cases par moitié : une jonction sans tuile autour n\'est pas une case (même compte que le compteur « Cases » sur un plateau partiel)', () => {
  require('../src/controles.js');
  for (const g of ['4x4', '5x5']) {
    const doc = plateauGenere(g, 0);
    for (const d of [nouveau(g), partiel(doc, (t) => t.lig === 0)]) {
      const compteur = PM.controles.calculer(d).compteurs.find((c) => c.cle === 'cases').valeur;
      const { c } = mesures(d);
      assert.equal(c.vert + c.rouge + c.tuiles.neutre + c.jonctions.milieu, compteur, g + ' : ' + d.plateau.tuiles.length + ' tuile(s)');
    }
  }
});
