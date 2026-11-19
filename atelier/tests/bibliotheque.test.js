'use strict';
// Lot D : bibliothèque de plateaux (logique pure et stockage injecté), docs/02-atelier-cahier-des-charges.md §8.1.
const test = require('node:test');
const assert = require('node:assert');
const B = require('../src/bibliotheque.js');
const AT = globalThis.AT;
const P = AT.plateau, C = AT.catalogue;

const D1 = '2026-11-19T10:00:00.000Z', D2 = '2026-11-20T08:30:00Z';
const copie = (o) => JSON.parse(JSON.stringify(o));
/** Un petit plateau avec une pièce personnelle posée. */
function plateau(graine) {
  const a = P.ajouterModele(P.vierge(graine === undefined ? 1 : graine), { nom: 'Duo', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'marais' }, { q: 0, r: 1, terrain: 'foret' }] });
  return P.poser(a.plateau, 'X1', 3, 0, 0).plateau;
}
function remplie(n) {
  let liste = B.vide();
  for (let i = 0; i < n; i++) { const r = B.ajouter(liste, 'Plateau ' + (i + 1), plateau(i), D1); assert.ok(r.ok, r.raison); liste = r.liste; }
  return liste;
}
/** Stockage qui lève une exception à chaque appel (navigation privée, réglage de sécurité). */
const stockageHostile = (nom) => ({
  getItem() { throw new Error('refusé'); },
  setItem() { const e = new Error('refusé'); if (nom) e.name = nom; throw e; },
  removeItem() { throw new Error('refusé'); }
});

test('ajouter : identifiant, nom nettoyé, date injectée, plateau validé et copié ; liste reçue intacte', () => {
  const vide = B.vide(), pl = plateau();
  const r = B.ajouter(vide, '  Mon plateau  ', pl, D1);
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.id, 'b1');
  assert.deepStrictEqual(vide, []);
  assert.deepStrictEqual(r.liste, [{ id: 'b1', nom: 'Mon plateau', modifie: D1, plateau: pl }]);
  assert.notStrictEqual(r.liste[0].plateau, pl);
  assert.notStrictEqual(r.liste[0].plateau.modeles, pl.modeles);
  const deux = B.ajouter(r.liste, 'Autre', P.vierge(2), D2);
  assert.strictEqual(deux.id, 'b2');
  assert.strictEqual(r.liste.length, 1);
  assert.strictEqual(B.prochainId(deux.liste), 'b3');
  assert.strictEqual(B.prochainId(deux.liste, ['b3', 'b4']), 'b5');
  // Sans date : l'heure courante, au format attendu.
  assert.match(B.ajouter(vide, 'x', pl).liste[0].modifie, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  // trouver rend une copie.
  const t = B.trouver(deux.liste, 'b1');
  t.plateau.pieces.length = 0;
  assert.strictEqual(deux.liste[0].plateau.pieces.length, 2);
  assert.strictEqual(B.trouver(deux.liste, 'b9'), null);
  assert.strictEqual(B.trouver(deux.liste, '__proto__'), null);
});

test('ajouter : refus expliqués (nom, plateau, date, bibliothèque pleine)', () => {
  const pl = plateau(), liste = B.vide();
  const refus = (r, motif) => { assert.strictEqual(r.ok, false); assert.strictEqual(r.liste, liste); assert.match(r.raison, motif); };
  refus(B.ajouter(liste, '   ', pl, D1), /Nom invalide : 1 à 60 caractères/);
  refus(B.ajouter(liste, 'n'.repeat(61), pl, D1), /Nom invalide/);
  refus(B.ajouter(liste, 'a\u0007b', pl, D1), /Nom invalide/);
  refus(B.ajouter(liste, 42, pl, D1), /Nom invalide/);
  refus(B.ajouter(liste, 'x', { pieces: [] }, D1), /Plateau invalide : /);
  refus(B.ajouter(liste, 'x', null, D1), /Plateau invalide/);
  refus(B.ajouter(liste, 'x', pl, 'hier'), /Date invalide/);
  refus(B.ajouter(liste, 'x', pl, '2026-13-45T99:00:00Z'), /Date invalide/);
  const fautif = copie(pl);
  fautif.modeles[0].cases[0].terrain = 'ville';
  refus(B.ajouter(liste, 'x', fautif, D1), /Plateau invalide : .*jamais de ville/);
  assert.ok(B.ajouter(liste, 'n'.repeat(60), pl, D1).ok);
  const max = C.REGLAGES.bibliotheque.plateauxMax, pleine = remplie(max);
  const trop = B.ajouter(pleine, 'un de trop', pl, D1);
  assert.strictEqual(trop.ok, false);
  assert.strictEqual(trop.liste, pleine);
  assert.match(trop.raison, new RegExp('Bibliothèque pleine : ' + max + ' plateaux au plus'));
  assert.strictEqual(B.ajouter(null, 'x', pl, D1).ok, false);
});

test('renommer, remplacer, dupliquer, supprimer', () => {
  const liste = remplie(2), fige = JSON.stringify(liste);
  const r = B.renommer(liste, 'b1', ' Vallée ', D2);
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(r.liste.map((e) => [e.id, e.nom, e.modifie]), [['b1', 'Vallée', D2], ['b2', 'Plateau 2', D1]]);
  assert.match(B.renommer(liste, 'b1', '', D2).raison, /Nom invalide/);
  assert.match(B.renommer(liste, 'b7', 'x', D2).raison, /introuvable/);
  const autre = P.vierge('autre');
  const p = B.remplacer(liste, 'b2', autre, D2);
  assert.ok(p.ok, p.raison);
  assert.deepStrictEqual(p.liste[1], { id: 'b2', nom: 'Plateau 2', modifie: D2, plateau: autre });
  assert.strictEqual(B.remplacer(liste, 'b2', { faux: true }, D2).ok, false);
  assert.match(B.remplacer(liste, 'b9', autre, D2).raison, /introuvable/);
  const d = B.dupliquer(liste, 'b1', D2);
  assert.ok(d.ok, d.raison);
  assert.strictEqual(d.id, 'b3');
  assert.deepStrictEqual(d.liste[2], { id: 'b3', nom: 'Plateau 1 (copie)', modifie: D2, plateau: liste[0].plateau });
  assert.notStrictEqual(d.liste[2].plateau, d.liste[0].plateau);
  assert.strictEqual(B.dupliquer(liste, 'b1', D2, 'Essai').liste[2].nom, 'Essai');
  const long = B.ajouter(B.vide(), 'n'.repeat(60), plateau(), D1).liste;
  const dl = B.dupliquer(long, 'b1', D2);
  assert.ok(dl.ok, dl.raison);
  assert.strictEqual(dl.liste[1].nom.length, 60);
  assert.match(dl.liste[1].nom, / \(copie\)$/);
  assert.match(B.dupliquer(liste, 'b9', D2).raison, /introuvable/);
  const s = B.supprimer(d.liste, 'b1');
  assert.deepStrictEqual(s.liste.map((e) => e.id), ['b2', 'b3']);
  assert.strictEqual(B.prochainId(s.liste), 'b1', 'le plus petit numéro libre');
  assert.match(B.supprimer(liste, 'b9').raison, /introuvable/);
  assert.strictEqual(JSON.stringify(liste), fige, 'la liste de départ n’a jamais été modifiée');
});

test('exporter puis lire : même liste ; toute lecture est validée', () => {
  const liste = remplie(3), texte = B.exporter(liste);
  const lu = B.lire(texte);
  assert.ok(lu.ok, lu.raison);
  assert.deepStrictEqual(lu.liste, liste);
  assert.deepStrictEqual([lu.ecartees, lu.avis], [0, []]);
  const enveloppe = () => JSON.parse(texte);
  const refuse = (mutation, motif) => {
    const o = enveloppe();
    mutation(o);
    const r = B.valider(o);
    assert.strictEqual(r.ok, false, String(motif));
    assert.deepStrictEqual(r.liste, []);
    assert.match(r.raison, motif);
  };
  refuse((o) => { o.format = 'atelier-partie'; }, /n’est pas une bibliothèque/);
  refuse((o) => { o.version = 2; }, /Version de bibliothèque non reconnue/);
  refuse((o) => { o.extra = 1; }, /n’est pas une bibliothèque/);
  refuse((o) => { delete o.version; }, /n’est pas une bibliothèque/);
  refuse((o) => { o.plateaux = {}; }, /Liste de plateaux invalide/);
  refuse((o) => { while (o.plateaux.length <= C.REGLAGES.bibliotheque.plateauxMax) o.plateaux.push(o.plateaux[0]); }, /au plus/);
  for (const mauvais of [null, [], 'texte', 7]) assert.strictEqual(B.valider(mauvais).ok, false);
  // Une entrée fautive est écartée sans faire perdre les autres.
  const ecarte = (mutation, motif) => {
    const o = enveloppe();
    mutation(o.plateaux[1], o);
    const r = B.valider(o);
    assert.ok(r.ok, String(motif));
    assert.deepStrictEqual(r.liste.map((e) => e.id), ['b1', 'b3'], String(motif));
    assert.strictEqual(r.ecartees, 1);
    assert.match(r.avis[0], motif);
  };
  ecarte((e) => { e.id = 'constructor'; }, /Plateau n° 2 écarté : identifiant invalide/);
  ecarte((e) => { e.id = 'b0'; }, /identifiant invalide/);
  ecarte((e) => { e.id = 'b1'; }, /identifiant en double/);
  ecarte((e) => { e.nom = ''; }, /nom invalide/);
  ecarte((e) => { e.nom = ' bords '; }, /nom invalide/);
  ecarte((e) => { e.nom = 'n'.repeat(61); }, /nom invalide/);
  ecarte((e) => { e.modifie = 'demain'; }, /date invalide/);
  ecarte((e) => { e.modifie = 0; }, /date invalide/);
  ecarte((e) => { e.vignette = '<svg>'; }, /champs inattendus/);
  ecarte((e) => { delete e.plateau; }, /champs inattendus/);
  ecarte((e) => { e.plateau.pieces[0].modele = 'Z9'; }, /Plateau invalide : .*modèle inconnu/);
  ecarte((e) => { e.plateau.modeles[0].quantite = 99; }, /quantité invalide/);
  ecarte((e, o) => { o.plateaux[1] = null; }, /champs inattendus/);
  // « __proto__ » dans le texte : champ en trop, jamais une pollution.
  const piege = B.lire(texte.replace('"nom":"Plateau 2"', '"nom":"Plateau 2","__proto__":{"pollue":true}'));
  assert.ok(piege.ok);
  assert.strictEqual(piege.ecartees, 1);
  assert.strictEqual({}.pollue, undefined);
  // Texte : type, JSON, taille.
  assert.match(B.lire('{pas du json').raison, /JSON valide/);
  assert.match(B.lire(undefined).raison, /illisible/);
  assert.match(B.lire(' '.repeat(C.REGLAGES.bibliotheque.tailleMax + 1)).raison, /trop volumineux/);
});

test('importer : fusion sans collision d’identifiants, rien n’est écrasé', () => {
  const ici = remplie(2), fige = JSON.stringify(ici);
  let ailleurs = B.ajouter(B.vide(), 'Importé A', P.vierge('a'), D2).liste;      // b1
  ailleurs = B.ajouter(ailleurs, 'Importé B', P.vierge('b'), D2).liste;          // b2
  ailleurs = B.supprimer(B.ajouter(B.ajouter(ailleurs, 'x', P.vierge(1), D2).liste, 'Importé D', plateau(4), D2).liste, 'b3').liste;   // b1 b2 b4
  const r = B.importer(ici, B.exporter(ailleurs));
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.ajoutes, 3);
  assert.deepStrictEqual(r.correspondance, { b1: 'b3', b2: 'b5', b4: 'b4' });
  assert.deepStrictEqual(r.liste.map((e) => [e.id, e.nom]), [['b1', 'Plateau 1'], ['b2', 'Plateau 2'], ['b3', 'Importé A'], ['b5', 'Importé B'], ['b4', 'Importé D']]);
  assert.strictEqual(new Set(r.liste.map((e) => e.id)).size, 5);
  assert.strictEqual(r.liste[2].modifie, D2);
  assert.deepStrictEqual(r.liste[4].plateau, plateau(4));
  assert.strictEqual(JSON.stringify(ici), fige);
  assert.ok(B.valider(JSON.parse(B.exporter(r.liste))).ok);
  // Dans une bibliothèque vide : identifiants gardés.
  assert.deepStrictEqual(B.importer(B.vide(), B.exporter(ailleurs)).liste.map((e) => e.id), ['b1', 'b2', 'b4']);
  // Entrées fautives du fichier : écartées, les autres sont importées.
  const abime = JSON.parse(B.exporter(ailleurs));
  abime.plateaux[0].plateau.pieces[0].rotation = 9;
  const partiel = B.importer(ici, JSON.stringify(abime));
  assert.ok(partiel.ok);
  assert.deepStrictEqual([partiel.ajoutes, partiel.ecartees], [2, 1]);
  assert.match(partiel.avis[0], /Plateau n° 1 écarté/);
  // Refus : pas du JSON, pas une bibliothèque, fichier vide, borne dépassée (tout ou rien).
  const refus = (r2, motif) => { assert.strictEqual(r2.ok, false); assert.strictEqual(r2.liste, ici); assert.match(r2.raison, motif); };
  refus(B.importer(ici, 'coucou'), /Import refusé : .*JSON valide/);
  refus(B.importer(ici, P.serialiser(plateau())), /Import refusé : .*n’est pas une bibliothèque/);
  refus(B.importer(ici, B.exporter(B.vide())), /aucun plateau/);
  abime.plateaux = [abime.plateaux[0]];
  refus(B.importer(ici, JSON.stringify(abime)), /aucun plateau valide/);
  const max = C.REGLAGES.bibliotheque.plateauxMax;
  const presque = remplie(max - 2), trop = B.importer(presque, B.exporter(ailleurs));
  assert.strictEqual(trop.ok, false);
  assert.strictEqual(trop.liste, presque);
  assert.match(trop.raison, new RegExp('aurait ' + (max + 1) + ' plateaux, pour ' + max + ' au plus'));
});

test('stockage : enregistrer puis charger ; clés à préfixe ; clé absente = bibliothèque vide', () => {
  const s = B.stockageMemoire(), liste = remplie(2);
  assert.strictEqual(B.cleListe(), 'atelier-plateau:bibliotheque');
  assert.strictEqual(B.cleTravail(), 'atelier-plateau:travail');
  assert.deepStrictEqual(B.charger(s), { ok: true, liste: [], ecartees: 0, avis: [], raison: null });
  assert.deepStrictEqual(B.enregistrer(s, liste), { ok: true, raison: null });
  assert.strictEqual(s.getItem('atelier-plateau:bibliotheque'), B.exporter(liste));
  const lu = B.charger(s);
  assert.ok(lu.ok, lu.raison);
  assert.deepStrictEqual(lu.liste, liste);
  // Une liste fautive n'est jamais écrite : le contenu précédent reste.
  const fautive = copie(liste);
  fautive[0].plateau.pieces[0].modele = 'Z9';
  const r = B.enregistrer(s, fautive);
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /Bibliothèque non enregistrée : Plateau n° 1 écarté/);
  assert.strictEqual(B.enregistrer(s, 'liste').ok, false);
  assert.deepStrictEqual(B.charger(s).liste, liste);
});

test('stockage : contenu corrompu, absent ou plein, sans jamais d’exception', () => {
  const liste = remplie(2);
  // Corrompu : JSON cassé, autre format, texte tronqué, valeur qui n'est pas un texte.
  for (const contenu of ['{', '[]', '"texte"', 'null', JSON.stringify({ format: 'autre', version: 1, plateaux: [] }), B.exporter(liste).slice(0, -20)]) {
    const s = B.stockageMemoire();
    s.setItem(B.cleListe(), contenu);
    const r = B.charger(s);
    assert.deepStrictEqual([r.ok, r.corrompu, r.liste], [false, true, []], contenu.slice(0, 20));
    assert.match(r.raison, /^Bibliothèque enregistrée illisible : /);
    assert.strictEqual(s.getItem(B.cleListe()), contenu, 'le contenu fautif est laissé en place');
    assert.ok(B.enregistrer(s, liste).ok, 'un nouvel enregistrement le remplace');
    assert.deepStrictEqual(B.charger(s).liste, liste);
  }
  const bizarre = { getItem: () => 42, setItem() {}, removeItem() {} };
  assert.strictEqual(B.charger(bizarre).corrompu, true);
  // Une entrée abîmée dans un contenu lisible : écartée, signalée.
  const s2 = B.stockageMemoire(), abime = JSON.parse(B.exporter(liste));
  abime.plateaux[0].plateau.camps = null;
  s2.setItem(B.cleListe(), JSON.stringify(abime));
  const partiel = B.charger(s2);
  assert.deepStrictEqual([partiel.ok, partiel.liste.length, partiel.ecartees], [true, 1, 1]);
  // Absent : null, objet incomplet, stockage qui lève à chaque appel.
  for (const absent of [null, undefined, {}, { getItem() {} }, 'localStorage', stockageHostile()]) {
    const c = B.charger(absent), e = B.enregistrer(absent, liste), t = B.chargerTravail(absent), w = B.enregistrerTravail(absent, plateau(), D1), x = B.effacerTravail(absent);
    assert.deepStrictEqual([c.ok, c.absent, c.liste], [false, true, []]);
    assert.deepStrictEqual([e.ok, e.absent], [false, true]);
    assert.deepStrictEqual([t.ok, t.absent, t.plateau], [false, true, null]);
    assert.deepStrictEqual([w.ok, w.absent], [false, true]);
    assert.deepStrictEqual([x.ok, x.absent], [false, true]);
    [c, e, t, w, x].forEach((r) => assert.ok(typeof r.raison === 'string' && r.raison.length > 10));
  }
  assert.match(B.charger(null).raison, /Stockage du navigateur indisponible/);
  // Plein : quota du stockage, puis borne propre de la bibliothèque. Le contenu précédent reste intact.
  const petit = B.stockageMemoire({ quota: B.exporter(liste).length + 10 });
  assert.ok(B.enregistrer(petit, liste).ok);
  const plus = B.ajouter(liste, 'Troisième', plateau(3), D1).liste;
  const plein = B.enregistrer(petit, plus);
  assert.deepStrictEqual([plein.ok, plein.plein], [false, true]);
  assert.match(plein.raison, /Stockage du navigateur plein : rien n’a été enregistré/);
  assert.deepStrictEqual(B.charger(petit).liste, liste);
  for (const nom of ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED']) {
    const hostile = stockageHostile(nom);
    hostile.getItem = () => null;
    assert.strictEqual(B.enregistrer(hostile, liste).plein, true, nom);
    assert.strictEqual(B.enregistrerTravail(hostile, plateau(), D1).plein, true, nom);
  }
  const taille = C.REGLAGES.bibliotheque.tailleMax;
  C.REGLAGES.bibliotheque.tailleMax = 500;
  try {
    const s3 = B.stockageMemoire(), r = B.enregistrer(s3, liste);
    assert.deepStrictEqual([r.ok, r.plein], [false, true]);
    assert.match(r.raison, /trop volumineuse/);
    assert.strictEqual(s3.getItem(B.cleListe()), null);
  } finally { C.REGLAGES.bibliotheque.tailleMax = taille; }
  // Sous Node, pas de localStorage utilisable : null, sans exception.
  assert.doesNotThrow(() => B.stockageNavigateur());
});

test('travail en cours : sauvegarde automatique, reprise, effacement, contenu validé', () => {
  const s = B.stockageMemoire(), pl = plateau(7);
  assert.deepStrictEqual(B.chargerTravail(s), { ok: true, plateau: null, modifie: null, raison: null });
  assert.deepStrictEqual(B.enregistrerTravail(s, pl, D1), { ok: true, raison: null });
  const lu = B.chargerTravail(s);
  assert.ok(lu.ok, lu.raison);
  assert.deepStrictEqual(lu.plateau, pl);
  assert.strictEqual(lu.modifie, D1);
  // Le travail en cours ne touche pas la bibliothèque, et réciproquement.
  assert.deepStrictEqual(B.charger(s).liste, []);
  assert.ok(B.enregistrer(s, remplie(1)).ok);
  assert.deepStrictEqual(B.chargerTravail(s).plateau, pl);
  // Refus d'écriture : plateau ou date invalides.
  assert.match(B.enregistrerTravail(s, { pieces: 3 }, D1).raison, /Plateau invalide/);
  assert.match(B.enregistrerTravail(s, pl, 'tantôt').raison, /Date invalide/);
  assert.deepStrictEqual(B.chargerTravail(s).plateau, pl);
  // Contenu corrompu : signalé, jamais d'exception.
  const bon = s.getItem(B.cleTravail());
  const corrompus = ['{', 'null', '[]', bon.replace('atelier-travail', 'autre'), bon.replace('"version":1', '"version":2'), bon.replace(D1, 'hier'),
    bon.replace('"modele":"X1"', '"modele":"X9"'), bon.replace('{"format"', '{"__proto__":{"pollue":1},"format"'), 'x'.repeat(C.REGLAGES.bornes.tailleFichier + 500)];
  for (const contenu of corrompus) {
    s.setItem(B.cleTravail(), contenu);
    const r = B.chargerTravail(s);
    assert.deepStrictEqual([r.ok, r.corrompu, r.plateau], [false, true, null], contenu.slice(0, 30));
    assert.match(r.raison, /^Travail en cours illisible : /);
  }
  assert.strictEqual({}.pollue, undefined);
  assert.deepStrictEqual(B.effacerTravail(s), { ok: true, raison: null });
  assert.strictEqual(B.chargerTravail(s).plateau, null);
  assert.strictEqual(B.charger(s).liste.length, 1, 'effacer le travail en cours ne touche pas la bibliothèque');
});

test('bornes de la bibliothèque : dans REGLAGES, compatibles avec celles d’un plateau', () => {
  const R = C.REGLAGES.bibliotheque;
  assert.strictEqual(R.prefixe, 'atelier-plateau:');
  assert.ok(Number.isInteger(R.plateauxMax) && R.plateauxMax >= 1);
  assert.ok(R.tailleMax >= C.REGLAGES.bornes.tailleFichier, 'un plateau à la taille maximale d’un fichier doit tenir');
  // Une bibliothèque pleine de plateaux générés complets tient largement sous la borne de taille.
  const complet = AT.generateur ? AT.generateur.generer(1).plateau : require('../src/generateur.js').generer(1).plateau;
  let liste = B.vide();
  for (let i = 0; i < R.plateauxMax; i++) liste = B.ajouter(liste, 'Complet ' + i, complet, D1).liste;
  const texte = B.exporter(liste);
  assert.ok(texte.length < R.tailleMax / 4, texte.length + ' caractères');
  assert.ok(B.enregistrer(B.stockageMemoire(), liste).ok);
});
