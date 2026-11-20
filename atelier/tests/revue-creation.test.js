'use strict';
// Corrections demandées après la revue de la création à la main (docs/06-revue-creation.md) : un test par correction
// de logique pure. Ce qui tient au navigateur (événement « storage », gestes, panneaux) est dans outils/recette.html.
const test = require('node:test');
const assert = require('node:assert');
require('../src/alea.js');
const P = require('../src/plateau.js');
const K = require('../src/controles.js');
const B = require('../src/bibliotheque.js');
const PA = require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue;

const D1 = '2026-11-19T10:00:00.000Z', D2 = '2026-11-20T08:30:00.000Z', D3 = '2026-11-21T09:00:00.000Z';
const copie = (o) => JSON.parse(JSON.stringify(o));
const plateau = (graine) => P.avecCamps(P.peindre(P.vierge(graine), '3,0', 'foret').plateau);
function remplie(n) {
  let liste = B.vide();
  for (let i = 0; i < n; i++) liste = B.ajouter(liste, 'Plateau ' + (i + 1), plateau(i), D1).liste;
  return liste;
}

// ------------------------------------------------------------------ I1 : fusion

test('I1 fusionner : rien n’est perdu ; même fiche des deux côtés, la plus récente gagne et le conflit est rapporté', () => {
  const base = remplie(2);                                                       // b1, b2
  const ici = B.renommer(base, 'b1', 'Renommé ici', D2).liste;
  let ailleurs = B.ajouter(base, 'Fait ailleurs', plateau(9), D2).liste;          // b3
  ailleurs = B.remplacer(ailleurs, 'b1', plateau(8), D3).liste;                    // b1 modifié ailleurs, plus récent
  const fige = [JSON.stringify(ici), JSON.stringify(ailleurs)];
  const f = B.fusionner(ici, ailleurs);
  assert.deepStrictEqual(f.liste.map((e) => e.id), ['b1', 'b2', 'b3']);
  assert.strictEqual(f.ajoutees, 1);
  assert.deepStrictEqual(f.conflits, [{ id: 'b1', nom: 'Plateau 1', garde: 'distante' }]);
  assert.deepStrictEqual(f.liste[0].plateau, plateau(8), 'la version la plus récente de b1 est gardée');
  assert.deepStrictEqual([JSON.stringify(ici), JSON.stringify(ailleurs)], fige, 'les deux listes reçues sont intactes');
  // Dans l'autre sens, la locale (plus récente) gagne.
  const g = B.fusionner(ailleurs, ici);
  assert.deepStrictEqual(g.conflits, [{ id: 'b1', nom: 'Plateau 1', garde: 'locale' }]);
  assert.strictEqual(g.liste.length, 3);
  // Listes identiques : ni ajout ni conflit. Liste vide : l'autre est rendue.
  assert.deepStrictEqual(B.fusionner(base, copie(base)), { liste: base, ajoutees: 0, conflits: [] });
  assert.deepStrictEqual(B.fusionner([], base).liste, base);
  assert.ok(B.valider({ format: B.FORMAT, version: B.VERSION, plateaux: f.liste }).ok);
});

// ------------------------------------------------------------------ I2 : attache dans le travail en cours

test('I2 travail en cours : l’attache est écrite avec le plateau, en une seule écriture ; ancien format relu sans erreur', () => {
  const s = B.stockageMemoire(), pl = plateau(3);
  let ecritures = 0;
  const compte = { getItem: s.getItem, removeItem: s.removeItem, setItem(k, v) { ecritures += 1; s.setItem(k, v); } };
  assert.deepStrictEqual(B.enregistrerTravail(compte, pl, D1, 'b7'), { ok: true, raison: null });
  assert.strictEqual(ecritures, 1, 'plateau et attache : une seule écriture, une seule clé');
  assert.deepStrictEqual(JSON.parse(s.getItem(B.cleTravail())), { format: 'atelier-travail', version: 1, modifie: D1, plateau: pl, ouvert: 'b7' });
  const lu = B.chargerTravail(s);
  assert.deepStrictEqual([lu.ok, lu.ouvert, lu.modifie], [true, 'b7', D1]);
  assert.deepStrictEqual(lu.plateau, pl);
  // Sans attache : pas de champ ; attache invalide à l'écriture : ignorée.
  B.enregistrerTravail(s, pl, D1, null);
  assert.ok(!('ouvert' in JSON.parse(s.getItem(B.cleTravail()))));
  assert.strictEqual(B.chargerTravail(s).ouvert, null);
  B.enregistrerTravail(s, pl, D1, '__proto__');
  assert.ok(!('ouvert' in JSON.parse(s.getItem(B.cleTravail()))));
  // Ancien stockage : travail sans champ « ouvert », et l'ancienne clé « ouvert » à part, qui n'est plus lue.
  s.setItem(B.cleTravail(), JSON.stringify({ format: 'atelier-travail', version: 1, modifie: D1, plateau: pl }));
  s.setItem('atelier-plateau:ouvert', 'b2');
  const ancien = B.chargerTravail(s);
  assert.deepStrictEqual([ancien.ok, ancien.ouvert], [true, null]);
  assert.deepStrictEqual(ancien.plateau, pl);
  // Attache malformée dans le stockage : travail refusé comme illisible, jamais d'exception.
  for (const faux of ['b0', 'constructor', 12, null, ['b1']]) {
    s.setItem(B.cleTravail(), JSON.stringify({ format: 'atelier-travail', version: 1, modifie: D1, plateau: pl, ouvert: faux }));
    const r = B.chargerTravail(s);
    assert.deepStrictEqual([r.ok, r.corrompu, r.plateau], [false, true, null], String(faux));
    assert.strictEqual(typeof r.brut, 'string');
  }
});

// ------------------------------------------------------------------ I3 : identifiants jamais réutilisés

test('I3 identifiants : jamais réutilisés, même après la suppression de la dernière fiche (compteur conservé dans le stockage)', () => {
  const s = B.stockageMemoire();
  let r = B.ajouter(B.vide(), 'Plateau A', plateau(1), D1, { minimum: 1 });
  assert.strictEqual(r.id, 'b1');
  assert.ok(B.enregistrer(s, r.liste, 2).ok);
  assert.strictEqual(s.getItem(B.cleCompteur()), '2', 'le compteur a sa propre clé');
  assert.deepStrictEqual(Object.keys(JSON.parse(s.getItem(B.cleListe()))), ['format', 'version', 'plateaux'], 'l’enveloppe reste à trois champs : une copie plus ancienne de l’atelier la relit');
  // La fiche est supprimée : la liste est vide, mais le compteur reste.
  assert.ok(B.enregistrer(s, B.supprimer(r.liste, 'b1').liste, 2).ok);
  const lu = B.charger(s);
  assert.deepStrictEqual([lu.ok, lu.liste.length, lu.suivant], [true, 0, 2]);
  r = B.ajouter(lu.liste, 'Plateau Z', plateau(2), D2, { minimum: lu.suivant });
  assert.strictEqual(r.id, 'b2', 'le numéro de la fiche supprimée n’est pas redonné');
  // Sans compteur (ancien stockage) : au moins le plus grand numéro présent + 1 ; un trou n'est jamais comblé.
  const trois = remplie(3), troue = B.supprimer(trois, 'b2').liste;
  assert.strictEqual(B.prochainId(troue), 'b4');
  assert.strictEqual(B.suivantDe(troue), 4);
  assert.strictEqual(B.numero('b12'), 12);
  assert.strictEqual(B.numero('x12') + B.numero('b0') + B.numero(null), 0);
  // Le compteur écrit n'est jamais plus petit que les fiches présentes ; un compteur faux est refusé.
  assert.strictEqual(B.lire(B.exporter(trois)).suivant, 4);
  // Le compteur écrit ne recule jamais et n'est jamais plus petit que les fiches présentes.
  const s2 = B.stockageMemoire();
  B.enregistrer(s2, trois, 9);
  B.enregistrer(s2, trois, 1);
  assert.strictEqual(s2.getItem(B.cleCompteur()), '9');
  assert.strictEqual(B.charger(s2).suivant, 9);
  const s3 = B.stockageMemoire();
  B.enregistrer(s3, trois, 1);
  assert.strictEqual(s3.getItem(B.cleCompteur()), '4');
  B.enregistrer(s3, trois);
  assert.strictEqual(B.charger(s3).suivant, 4, 'sans compteur donné, rien n’est écrit dans sa clé et la liste suffit');
  // Compteur illisible dans le stockage : ignoré sans erreur (repli sur les fiches présentes).
  for (const faux of ['0', '-1', '1.5', 'quatre', '', '99999999', '{}']) {
    s3.setItem(B.cleCompteur(), faux);
    assert.deepStrictEqual([B.charger(s3).ok, B.charger(s3).suivant], [true, 4], faux);
  }
  assert.strictEqual(B.valider({ format: B.FORMAT, version: 1, plateaux: [], suivant: 4 }).ok, false, 'un champ en plus dans l’enveloppe reste refusé');
  // Le numéro d'une entrée écartée n'est pas redonné non plus.
  const abimee = { format: B.FORMAT, version: 1, plateaux: copie(trois) };
  abimee.plateaux[2].plateau = { faux: true };
  const v = B.valider(abimee);
  assert.deepStrictEqual([v.liste.length, v.ecartees, v.suivant], [2, 1, 4]);
  // Import : un identifiant du fichier déjà attribué ici autrefois (sous le compteur) est renuméroté.
  const imp = B.importer(B.vide(), B.exporter(remplie(2)), { minimum: 6 });
  assert.deepStrictEqual(imp.liste.map((e) => e.id), ['b6', 'b7']);
  // Numéros épuisés : refus expliqué, pas d'exception.
  assert.strictEqual(B.prochainId([], null, 1000000), null);
  assert.match(B.ajouter(B.vide(), 'x', plateau(1), D1, { minimum: 1000000 }).raison, /Plus de numéro de fiche/);
});

// ------------------------------------------------------------------ I4 : copies de secours

test('I4 copies de secours : clé datée, texte brut intact, pas de doublon, cinq au plus, exportables ; contenu illisible signalé avec son texte', () => {
  const s = B.stockageMemoire();
  const futur = JSON.stringify({ format: B.FORMAT, version: 2, plateaux: [{ id: 'b1', nouveau: true }] });
  s.setItem(B.cleListe(), futur);
  const lu = B.charger(s);
  assert.deepStrictEqual([lu.ok, lu.corrompu, lu.brut], [false, true, futur]);
  assert.match(lu.raison, /Version de bibliothèque non reconnue/);
  const c1 = B.sauverSecours(s, 'bibliotheque', lu.brut, D1);
  assert.deepStrictEqual(c1, { ok: true, cle: 'atelier-plateau:secours:bibliotheque:' + D1, deja: false, raison: null });
  assert.strictEqual(s.getItem(c1.cle), futur, 'le texte d’origine est gardé tel quel');
  assert.strictEqual(B.sauverSecours(s, 'bibliotheque', futur, D2).deja, true, 'le même texte n’est pas copié deux fois');
  B.sauverSecours(s, 'travail', '{abîmé', D2);
  assert.deepStrictEqual(B.listerSecours(s).map((x) => [x.origine, x.date, x.texte]), [['bibliotheque', D1, futur], ['travail', D2, '{abîmé']]);
  const exporte = JSON.parse(B.exporterSecours(s));
  assert.deepStrictEqual([exporte.format, exporte.copies.length, exporte.copies[0].texte], ['atelier-secours', 2, futur]);
  // Fiches écartées : le texte brut est rendu aussi, pour être copié avant la première réécriture.
  const liste = remplie(2), abime = JSON.parse(B.exporter(liste));
  abime.plateaux[1].plateau.modeles = [{ id: 'X1', nom: 'Sept', quantite: 1, cases: [0, 1, 2, 3, 4, 5, 6].map((q) => ({ q, r: 0, terrain: 'plaine' })) }];
  s.setItem(B.cleListe(), JSON.stringify(abime));
  const partiel = B.charger(s);
  assert.deepStrictEqual([partiel.ok, partiel.liste.length, partiel.ecartees, partiel.brut], [true, 1, 1, JSON.stringify(abime)]);
  // Cinq copies au plus : les plus anciennes sont retirées du stockage.
  for (let i = 0; i < 7; i++) assert.ok(B.sauverSecours(s, 'travail', 'texte ' + i, '2026-12-0' + (i + 1) + 'T00:00:00.000Z').ok);
  const reste = B.listerSecours(s);
  assert.strictEqual(reste.length, 5);
  assert.strictEqual(reste[4].texte, 'texte 6');
  assert.strictEqual(s.getItem(c1.cle), null, 'la plus ancienne copie a été retirée');
  // Stockage plein ou absent : refus propre, sans exception ; arguments faux refusés.
  assert.strictEqual(B.sauverSecours(B.stockageMemoire({ quota: 5 }), 'bibliotheque', futur, D1).plein, true);
  assert.strictEqual(B.sauverSecours(null, 'bibliotheque', futur, D1).absent, true);
  assert.strictEqual(B.sauverSecours(s, 'ailleurs', futur, D1).ok, false);
  assert.deepStrictEqual(B.listerSecours(null), []);
  s.setItem(B.cleSecours(), '{pas une liste');
  assert.deepStrictEqual(B.listerSecours(s), []);
});

// ------------------------------------------------------------------ M6 : noms en double

test('M6 nom déjà pris : numéroté automatiquement, à l’enregistrement, au renommage, à la copie et à l’import', () => {
  let liste = B.ajouter(B.vide(), 'Même nom', plateau(1), D1, { unique: true }).liste;
  const deux = B.ajouter(liste, '  même NOM ', plateau(2), D1, { unique: true });
  assert.deepStrictEqual([deux.nom, deux.renomme, deux.liste[1].nom], ['même NOM (2)', true, 'même NOM (2)']);
  const trois = B.ajouter(deux.liste, 'Même nom', plateau(3), D1, { unique: true });
  assert.deepStrictEqual([trois.nom, trois.renomme], ['Même nom (3)', true]);
  assert.deepStrictEqual(B.nomUnique(trois.liste, 'Autre'), { nom: 'Autre', change: false });
  assert.deepStrictEqual(B.nomUnique(trois.liste, ''), { nom: null, change: false });
  // Renommer : son propre nom ne compte pas ; celui d'une autre fiche, si.
  const meme = B.renommer(trois.liste, 'b1', 'Même nom', D2, { unique: true });
  assert.deepStrictEqual([meme.ok, meme.nom, meme.renomme], [true, 'Même nom', false]);
  const pris = B.renommer(trois.liste, 'b3', 'Même nom', D2, { unique: true });
  assert.deepStrictEqual([pris.nom, pris.renomme, pris.liste[2].nom], ['Même nom (3)', true, 'Même nom (3)']);
  // Copie d'une copie, import d'un export de soi-même.
  const c1 = B.dupliquer(liste, 'b1', D2, undefined, { unique: true }), c2 = B.dupliquer(c1.liste, 'b1', D2, undefined, { unique: true });
  assert.deepStrictEqual([c1.nom, c2.nom], ['Même nom (copie)', 'Même nom (copie) (2)']);
  const imp = B.importer(liste, B.exporter(liste), { unique: true });
  assert.deepStrictEqual([imp.liste.map((e) => e.nom), imp.renommes], [['Même nom', 'Même nom (2)'], 1]);
  // Nom à la longueur maximale : le suffixe tient dans la borne.
  const long = 'x'.repeat(C.REGLAGES.bibliotheque.longueurNom);
  const l2 = B.ajouter(B.ajouter(B.vide(), long, plateau(1), D1).liste, long, plateau(2), D1, { unique: true });
  assert.ok(l2.ok && l2.nom.length <= C.REGLAGES.bibliotheque.longueurNom && / \(2\)$/.test(l2.nom), l2.nom);
  // Sans l'option, le comportement d'origine est gardé (deux fiches de même nom).
  assert.strictEqual(B.ajouter(liste, 'Même nom', plateau(2), D1).liste[1].nom, 'Même nom');
});

// ------------------------------------------------------------------ M3 : bornes de toutes les cases

test('M3 plateau.valider : toutes les cases d’une pièce sont bornées, pas seulement son ancre', () => {
  const borne = C.REGLAGES.bornes.coordonnee;
  const base = P.ajouterModele(P.vierge(1), { nom: 'Ligne', quantite: 1, cases: [0, 1, 2, 3, 4, 5].map((q) => ({ q, r: 0, terrain: 'plaine' })) }).plateau;
  const loin = copie(base);
  loin.pieces.push({ id: 'p9', modele: 'X1', q: borne, r: 0, rotation: 0 });      // ancre permise, cases jusqu'à borne + 5
  const avis = P.valider(loin);
  assert.strictEqual(avis.ok, false);
  assert.match(avis.erreurs[0], /Pièce n° 2 : une de ses cases sort des limites du plateau/);
  assert.strictEqual(PA.creer({ graine: 1, plateau: loin }, { alea: AT.alea.creer(1), hex: H, plateau: P }).ok, false, 'la table de jeu le refuse aussi');
  // Tournée d'un demi-tour, la même pièce tient dans les bornes : acceptée, et toutes ses cases sont des clés valides.
  const dedans = copie(base);
  dedans.pieces.push({ id: 'p9', modele: 'X1', q: borne, r: 0, rotation: 3 });
  const ok = P.valider(dedans);
  assert.ok(ok.ok, ok.erreurs[0]);
  assert.ok(Object.keys(P.cases(ok.plateau)).every((k) => Math.abs(H.decle(k).q) <= borne && Math.abs(H.decle(k).r) <= borne));
  // Pièce du catalogue : même règle (M5 ancrée au bord).
  const bord = copie(P.vierge(1));
  bord.pieces.push({ id: 'p2', modele: 'M5', q: borne - 1, r: 0, rotation: 0 });
  assert.strictEqual(P.valider(bord).ok, false);
  // Un événement posé sur un plateau valide se relit donc toujours ; événements et camps hors bornes restent refusés.
  const pose = P.poserEvenement(ok.plateau, 'E1', H.cle(borne - 2, 0));
  assert.ok(pose.ok, pose.raison);
  assert.ok(P.lire(P.serialiser(pose.plateau)).ok);
  const ev = copie(base); ev.recouvrements.push({ evenement: 'E1', cle: (borne + 3) + ',0' });
  const camp = copie(base); camp.camps.vert.push((borne + 3) + ',0');
  assert.strictEqual(P.valider(ev).ok, false);
  assert.strictEqual(P.valider(camp).ok, false);
});

// ------------------------------------------------------------------ M4 : bornes lues au moment de valider

test('M4 table de jeu : les bornes des pièces personnelles sont lues dans REGLAGES.perso au moment de valider', () => {
  const R = C.REGLAGES.perso, garde = { casesMax: R.casesMax, quantiteMax: R.quantiteMax, longueurNom: R.longueurNom };
  const env = () => ({ alea: AT.alea.creer(1), hex: H, plateau: P });
  const sept = () => ({ nom: 'N'.repeat(45), quantite: 12, cases: [0, 1, 2, 3, 4, 5, 6].map((q) => ({ q, r: 0, terrain: 'plaine' })) });
  try {
    R.casesMax = 7; R.quantiteMax = 12; R.longueurNom = 50;
    const large = P.ajouterModele(P.vierge(1), sept());
    assert.ok(large.ok, large.raison);
    const partie = PA.creer({ graine: 1, plateau: large.plateau }, env());
    assert.ok(partie.ok, partie.raison);
    assert.strictEqual(partie.etat.plateau.modeles[0].cases.length, 7);
    // Revenu aux réglages d'origine, le même plateau est refusé par les DEUX lecteurs, avec les bornes en vigueur.
    R.casesMax = garde.casesMax; R.quantiteMax = garde.quantiteMax; R.longueurNom = garde.longueurNom;
    assert.strictEqual(P.valider(copie(large.plateau)).ok, false);
    const refus = PA.creer({ graine: 1, plateau: large.plateau }, env());
    assert.strictEqual(refus.ok, false);
    assert.match(refus.raison, /nom invalide \(1 à 40 caractères\)|quantité invalide \(1 à 9\)|2 à 6 cases attendues/);
    // La ville n'est jamais permise, même si un réglage l'ajoutait par erreur.
    R.terrains.push('ville');
    const ville = copie(P.ajouterModele(P.vierge(1), { nom: 'x', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'plaine' }, { q: 1, r: 0, terrain: 'plaine' }] }).plateau);
    ville.modeles[0].cases[1].terrain = 'ville';
    assert.match(PA.creer({ graine: 1, plateau: ville }, env()).raison, /jamais de ville/);
  } finally {
    R.casesMax = garde.casesMax; R.quantiteMax = garde.quantiteMax; R.longueurNom = garde.longueurNom;
    const i = R.terrains.indexOf('ville');
    if (i !== -1) R.terrains.splice(i, 1);
  }
});

// ------------------------------------------------------------------ M12 : renommer une pièce posée au-delà de sa quantité

test('M12 modifierModele : une pièce posée au-delà de sa quantité se renomme encore (quantité inchangée)', () => {
  let pl = P.ajouterModele(P.vierge(1), { nom: 'Duo', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'marais' }, { q: 0, r: 1, terrain: 'foret' }] }).plateau;
  pl = P.poser(P.poser(pl, 'X1', 3, 0, 0).plateau, 'X1', -4, 0, 0).plateau;
  const trop = copie(pl);
  trop.pieces.push({ id: 'p9', modele: 'X1', q: 0, r: 3, rotation: 0 });          // 3 exemplaires posés pour 2 prévus (fichier)
  assert.ok(P.valider(trop).ok);
  const nom = P.modifierModele(trop, 'X1', { nom: 'Duo renommé', quantite: 2 });   // ce que l'éditeur envoie : nom + quantité inchangée
  assert.ok(nom.ok, nom.raison);
  assert.deepStrictEqual([nom.plateau.modeles[0].nom, nom.plateau.modeles[0].quantite, nom.plateau.pieces.length], ['Duo renommé', 2, 4]);
  assert.ok(P.modifierModele(trop, 'X1', { nom: 'Seul le nom' }).ok);
  assert.ok(P.modifierModele(trop, 'X1', { quantite: 3 }).ok, 'monter la quantité au niveau des exemplaires posés reste permis');
  const baisse = P.modifierModele(trop, 'X1', { quantite: 1 });
  assert.strictEqual(baisse.ok, false, 'baisser encore la quantité reste refusé');
  assert.match(baisse.raison, /Quantité refusée : 3 exemplaires/);
  assert.strictEqual(P.modifierModele(pl, 'X1', { quantite: 1 }).ok, false, 'cas ordinaire inchangé : 2 posés, quantité 1 refusée');
});

// ------------------------------------------------------------------ question 1 : montagne hors bloc

test('question 1 : un monobloc personnel avec de la montagne hors bloc de 4 ou 5 cases déclenche l’alerte du contrôle 1', () => {
  const m = (n, terrain) => Array.from({ length: n }, (_, q) => ({ q, r: 0, terrain: terrain || 'montagne' }));
  assert.strictEqual(K.montagneHorsBloc(m(4)), false);
  assert.strictEqual(K.montagneHorsBloc(m(5)), false);
  for (const n of [2, 3, 6]) assert.strictEqual(K.montagneHorsBloc(m(n)), true, n + ' montagnes');
  assert.strictEqual(K.montagneHorsBloc(m(3).concat([{ q: 3, r: 0, terrain: 'plaine' }])), true, 'mélange montagne / plaine');
  assert.strictEqual(K.montagneHorsBloc(m(4, 'foret')), false, 'sans montagne : rien à dire');
  assert.strictEqual(K.montagneHorsBloc([]), false);

  let pl = P.ajouterModele(P.vierge(1), { nom: 'Trois pics', quantite: 2, cases: m(3) }).plateau;
  pl = P.ajouterModele(pl, { nom: 'Massif', quantite: 1, cases: m(4) }).plateau;
  pl = P.ajouterModele(pl, { nom: 'Col', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'montagne' }, { q: 1, r: 0, terrain: 'plaine' }] }).plateau;
  const sans = K.inventaire(pl);
  assert.ok(!sans.some((x) => /hors bloc/.test(x.message)), 'pièces non posées : pas d’alerte sur le plateau');
  pl = P.poser(pl, 'X1', 3, 0, 0).plateau;
  pl = P.poser(pl, 'X1', 3, 2, 0).plateau;
  pl = P.poser(pl, 'X2', -5, 0, 0).plateau;
  pl = P.poser(pl, 'X3', -3, 3, 0).plateau;
  const constats = K.inventaire(pl), alerte = constats.filter((x) => /hors bloc/.test(x.message))[0];
  assert.ok(alerte, 'constat attendu');
  // Depuis la revue du catalogue 2 (I2) : sur un plateau du catalogue courant, c'est hors règles, donc une erreur.
  assert.strictEqual(alerte.niveau, 'erreur');
  assert.strictEqual(alerte.message, 'Hors règles : 3 monoblocs personnels avec de la montagne hors bloc de 4 ou 5 cases (Trois pics, Col). Les montagnes sont des blocs de 4 ou 5 cases, tout en montagne.');
  assert.strictEqual(alerte.cases.length, 3 + 3 + 2);
  assert.deepStrictEqual(alerte.donnees, { montagnesHorsBloc: 3, horsRegles: true });
  // Les montagnes du catalogue (4 et 5 cases) et le bloc personnel de 4 ne déclenchent rien.
  const catalogue = P.poser(P.poser(P.vierge(1), 'M4', 3, 0, 0).plateau, 'M5', -5, 0, 0).plateau;
  assert.ok(!K.inventaire(catalogue).some((x) => /hors bloc|d’une case/.test(x.message)));
});

// ------------------------------------------------------------------ question 3 : noyau fixe

test('question 3 : la gomme ne retire jamais le noyau (message du modèle)', () => {
  const pl = P.vierge(1), r = P.gommer(pl, '1,0');
  assert.deepStrictEqual([r.ok, r.noyau, r.monobloc, r.plateau === pl], [false, true, true, true]);
  assert.strictEqual(r.raison, 'Cette case appartient au noyau (7 cases), qui est fixe : la gomme ne le retire jamais.');
});
