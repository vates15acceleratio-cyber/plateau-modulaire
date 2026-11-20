'use strict';
// Corrections décidées après la revue du catalogue 2 (un test au moins par correction) :
//   1. profondeur des extrémités enregistrée dans le document du plateau ;
//   2. une ville neutre posée ne se retouche que par l'étape « Villes » ;
//   3. « Générer » qui échoue à cause de la profondeur des extrémités le dit ;
//   4. « Autre proposition » de pose des villes : suite déterministe ;
//   5. une entrée `deploiements` hors du plateau ou hors d'une Plaine est refusée à la lecture ;
//   6. contrôle 1 adapté à un plateau de l'ancien catalogue.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../src/vue-villes.js');
const VC = require('../src/vue-creation.js');
const VP = require('../src/vue-plateau.js');
const VB = require('../src/vue-bibliotheque.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles, G = AT.generateur, T = AT.partie;

const copie = (o) => JSON.parse(JSON.stringify(o));
const genere = (graine, options) => { const g = G.generer(graine, options); assert.ok(g.ok, g.raison); return g.plateau; };
const env = (graine) => ({ alea: AT.alea.creer(graine), hex: H, plateau: P });
const erreurs = (bilan) => bilan.resultats.filter((x) => x.niveau === 'erreur').map((x) => x.message);
const fixture = (nom) => fs.readFileSync(path.join(__dirname, 'fixtures-v1', nom), 'utf8');

/** Un plateau généré à 3 rangées dont une ville de déploiement est hors des 2 rangées extrêmes. */
let profondGarde = null;
function plateauProfond() {
  if (profondGarde) return JSON.parse(profondGarde);
  for (let g = 1; g <= 60; g++) {
    const r = G.generer(g, { profondeurExtremite: 3 });
    if (!r.ok) continue;
    const e = P.etendueSurCases(P.cases(r.plateau, { sansVilles: true }));
    const loin = P.deploiements(r.plateau).some((d) => { const rr = H.decle(d.cle).r; return d.camp === 'vert' ? rr > e.haut + 1 : rr < e.bas - 1; });
    if (loin) { profondGarde = JSON.stringify(r.plateau); return r.plateau; }
  }
  throw new Error('aucun plateau à 3 rangées avec une ville en troisième rangée (graines 1 à 60)');
}

/** Le même plateau sans son champ de profondeur (ce que l'outil écrivait avant la correction). */
function sansChampPourResume(plateau) { const c = copie(plateau); delete c.profondeurExtremite; return c; }

// ------------------------------------------------------------------ 1. profondeur des extrémités enregistrée

test('correction 1 : la profondeur des extrémités est enregistrée dans le plateau ; fait à 3 rangées, il se rouvre sans erreur', () => {
  const p = plateauProfond();
  assert.strictEqual(p.profondeurExtremite, 3, 'le générateur enregistre la profondeur employée');
  assert.strictEqual(P.profondeurExtremite(p), 3);
  const texte = P.serialiser(p);
  assert.match(texte, /"profondeurExtremite": 3/);
  const relu = P.lire(texte);
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, p);
  assert.strictEqual(JSON.stringify(relu.plateau), JSON.stringify(p), 'mêmes champs, dans le même ordre');
  // Contrôles SANS option, comme à la réouverture, et même avec un réglage de session différent : aucune erreur.
  assert.deepStrictEqual(erreurs(K.tout(relu.plateau)), []);
  assert.deepStrictEqual(erreurs(K.tout(relu.plateau, { profondeurExtremite: 1 })), [], 'le document prime sur l’option');
  assert.strictEqual(VB.resume(relu.plateau, { profondeurExtremite: 2 }).erreurs, 0, 'résumé d’une fiche de la bibliothèque');
  // Une fiche est jugée avec SA profondeur, jamais avec celle du plateau affiché : une fiche à 2 rangées (sans champ)
  // vue depuis un plateau réglé à 1 rangée n'a pas d'erreur, alors que jugée à 1 rangée elle en aurait.
  const deux = genere(1);
  assert.ok(erreurs(K.tout(deux, { profondeurExtremite: 1 })).length > 0, 'ce plateau a bien une ville en deuxième rangée');
  assert.strictEqual(VB.resume(deux, { profondeurExtremite: 1 }).erreurs, 0);
  assert.strictEqual(VB.resume(deux, { profondeurExtremite: 3, seuilContact: 2 }).erreurs, 0);
  assert.strictEqual(VB.resume(sansChampPourResume(p), { profondeurExtremite: 3 }).erreurs > 0, true, 'une fiche sans champ dont une ville est en troisième rangée garde ses erreurs, même vue depuis un plateau à 3 rangées');
  // Le même plateau privé de son champ (ce que l'outil écrivait avant) repasse en erreur : c'était le défaut.
  const sans = copie(p);
  delete sans.profondeurExtremite;
  assert.ok(erreurs(K.tout(sans)).some((m) => /mal placée : Cette case n’est pas à l’extrémité/.test(m)), erreurs(K.tout(sans)).join(' | '));
});

test('correction 1 : fichier sans le champ = réglage par défaut ; le réglage par défaut s’écrit par l’absence du champ', () => {
  const defaut = C.REGLAGES.villes.profondeurExtremite;
  const p = genere(1);
  assert.ok(!('profondeurExtremite' in p), 'plateau généré au réglage par défaut : champ absent');
  assert.strictEqual(P.profondeurExtremite(p), defaut);
  assert.strictEqual(P.profondeurExtremite(p, { profondeurExtremite: 1 }), 1, 'sans champ, l’option demandée sert');
  // Anciens fichiers (version 1) et fichiers du catalogue 2 d'avant la correction : lus, réglage par défaut.
  ['plateau-genere.json', 'plateau-retouche.json'].forEach((nom) => {
    const lu = P.lire(fixture(nom));
    assert.ok(lu.ok, nom + ' : ' + lu.erreurs.join(' '));
    assert.ok(!('profondeurExtremite' in lu.plateau));
    assert.strictEqual(P.profondeurExtremite(lu.plateau), defaut);
  });
  // Écrit en clair à la valeur par défaut : accepté, ramené à la forme canonique.
  const explicite = copie(p);
  explicite.profondeurExtremite = defaut;
  const lu = P.valider(explicite);
  assert.ok(lu.ok, lu.erreurs.join(' '));
  assert.ok(!('profondeurExtremite' in lu.plateau));
  assert.strictEqual(P.serialiser(lu.plateau), P.serialiser(p));
  // avecProfondeurExtremite : 1 et 3 s'écrivent, le défaut retire le champ, le reste est refusé sans rien changer.
  const un = P.avecProfondeurExtremite(p, 1);
  assert.ok(un.ok);
  assert.strictEqual(un.plateau.profondeurExtremite, 1);
  assert.ok(!('profondeurExtremite' in p), 'plateau reçu intact');
  assert.ok(!('profondeurExtremite' in P.avecProfondeurExtremite(un.plateau, defaut).plateau));
  [0, 4, 2.5, '3', null, undefined, NaN, -1].forEach((v) => {
    const r = P.avecProfondeurExtremite(un.plateau, v);
    assert.strictEqual(r.ok, false, String(v));
    assert.strictEqual(r.plateau, un.plateau);
    assert.match(r.raison, /Profondeur des extrémités invalide/);
  });
});

test('correction 1 : le champ est validé strictement (1 à 3), dans un fichier de plateau comme dans un fichier de partie', () => {
  const bon = () => JSON.parse(P.serialiser(plateauProfond()));
  [1, 2, 3].forEach((v) => { const o = bon(); o.profondeurExtremite = v; assert.ok(P.valider(o).ok, String(v)); });
  const hostiles = [0, 4, -1, 2.5, 1e9, '3', '', null, true, [3], { valeur: 3 }, '__proto__', '<img src=x onerror=alert(1)>'];
  hostiles.forEach((v) => {
    const o = bon();
    o.profondeurExtremite = v;
    const res = P.valider(o);
    assert.strictEqual(res.ok, false, 'aurait dû être refusé : ' + JSON.stringify(v));
    assert.match(res.erreurs.join(' | '), /Profondeur des extrémités invalide/);
    assert.strictEqual(res.plateau, null);
  });
  // Un champ de nom voisin reste un champ inconnu.
  const voisin = bon();
  voisin.profondeurExtremites = 3;
  assert.match(P.valider(voisin).erreurs.join(' | '), /champ inconnu/);
  // Fichier de partie : le plateau garde son champ ; une valeur fautive est refusée.
  const p = plateauProfond();
  const partie = T.creer({ graine: 5, plateau: p }, env(5));
  assert.ok(partie.ok, partie.raison);
  assert.strictEqual(partie.etat.plateau.profondeurExtremite, 3);
  const recharge = T.charger(T.serialiser(partie.etat), env(5));
  assert.ok(recharge.ok, recharge.raison);
  assert.deepStrictEqual(recharge.etat.plateau, partie.etat.plateau);
  assert.deepStrictEqual(erreurs(K.tout(recharge.etat.plateau)), []);
  hostiles.concat([undefined]).forEach((v) => {
    const brut = JSON.parse(T.serialiser(partie.etat));
    if (v === undefined) brut.plateau.profondeurExtremite = 7; else brut.plateau.profondeurExtremite = v;
    assert.strictEqual(T.charger(JSON.stringify(brut), env(5)).ok, false, 'partie refusée : ' + JSON.stringify(v));
  });
  assert.strictEqual(Object.prototype.profondeurExtremite, undefined);
});

test('correction 1 : le champ suit toutes les retouches ; les places, la pose et la pose automatique suivent le document', () => {
  const profond = plateauProfond();
  let p = V.retirerToutes(profond).plateau;
  assert.strictEqual(p.profondeurExtremite, 3, 'retirer les villes ne retire pas le réglage');
  const places3 = V.places(p, 'vert'), places2 = P.placesDeploiementSurCases(P.cases(p), 'vert', { profondeurExtremite: 2 });
  assert.deepStrictEqual(places3, P.placesDeploiementSurCases(P.cases(p), 'vert', { profondeurExtremite: 3 }));
  assert.deepStrictEqual(V.places(p, 'vert', { profondeurExtremite: 1 }), places3, 'le document prime sur l’option');
  const loin = places3.filter((k) => places2.indexOf(k) === -1)[0];
  assert.ok(loin, 'une place de la troisième rangée');
  const pose = V.cliquer(p, 'vert', loin, {});
  assert.ok(pose.ok, pose.message);
  assert.strictEqual(pose.plateau.profondeurExtremite, 3);
  assert.deepStrictEqual(erreurs(K.tout(pose.plateau)), []);
  // Le même clic sur le même terrain sans le champ : refusé (réglage par défaut).
  const sans = copie(p);
  delete sans.profondeurExtremite;
  assert.strictEqual(V.cliquer(sans, 'vert', loin, {}).ok, false);
  // Retouches du terrain : le champ reste.
  const piece = pose.plateau.pieces.filter((x) => x.modele !== 'N1')[0];
  assert.strictEqual(P.retirer(pose.plateau, piece.id).plateau.profondeurExtremite, 3);
  assert.strictEqual(P.avecCamps(pose.plateau).profondeurExtremite, 3);
  assert.strictEqual(P.peindre(pose.plateau, '12,0', 'foret').plateau.profondeurExtremite, 3);
  // Pose automatique : elle emploie la profondeur du document et la garde ; sans champ, celle de l'option, qu'elle enregistre.
  const auto = V.poserAuto(p, p.graine, { profondeurExtremite: 1 });
  assert.ok(auto.ok, auto.raison);
  assert.strictEqual(auto.plateau.profondeurExtremite, 3);
  assert.deepStrictEqual(erreurs(K.tout(auto.plateau)), []);
  const auto3 = V.poserAuto(sans, sans.graine, { profondeurExtremite: 3 });
  assert.ok(auto3.ok, auto3.raison);
  assert.strictEqual(auto3.plateau.profondeurExtremite, 3);
  assert.deepStrictEqual(erreurs(K.tout(auto3.plateau)), []);
  assert.ok(P.lire(P.serialiser(auto3.plateau)).ok);
  const auto2 = V.poserAuto(sans, sans.graine, {});
  assert.ok(!('profondeurExtremite' in auto2.plateau));
  // Ordre des champs constant, avec pièces personnelles, villes et profondeur.
  const perso = P.ajouterModele(auto3.plateau, { nom: 'Duo', cases: [{ q: 0, r: 0, terrain: 'plaine' }, { q: 1, r: 0, terrain: 'foret' }], quantite: 1 }).plateau;
  const relu = P.lire(P.serialiser(perso));
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.strictEqual(P.serialiser(relu.plateau), P.serialiser(perso));
  assert.strictEqual(JSON.stringify(relu.plateau), JSON.stringify(perso), 'mêmes champs, dans le même ordre, après une retouche');
  assert.deepStrictEqual(Object.keys(relu.plateau), ['version', 'graine', 'pieces', 'recouvrements', 'camps', 'deploiements', 'profondeurExtremite', 'modeles']);
  assert.deepStrictEqual(Object.keys(P.poserVilleNeutre(V.retirerToutes(perso).plateau, P.placesNeutres(V.retirerToutes(perso).plateau)[0].cle).plateau),
    ['version', 'graine', 'pieces', 'recouvrements', 'camps', 'profondeurExtremite', 'modeles']);
});

// ------------------------------------------------------------------ 2. ville neutre : étape « Villes » seulement

test('correction 2 : une ville neutre posée ne se déplace, ne se tourne, ne se repeint et ne se gomme qu’à l’étape « Villes »', () => {
  const p = genere(1), neutre = P.etatVilles(p).neutres[0], fige = JSON.stringify(p);
  const autre = p.pieces.filter((x) => x.modele !== 'VN' && x.modele !== 'N1')[0];
  // Retouche de pièce (modes « Générer » et « Créer à la main ») : message qui renvoie à l'étape « Villes ».
  assert.match(VP.refusRetoucheVille(p, neutre.piece), /ville neutre .* qu’à l’étape « Villes »/);
  assert.strictEqual(VP.refusRetoucheVille(p, autre.id), null);
  assert.strictEqual(VP.refusRetoucheVille(p, 'inconnue'), null);
  const deplacement = VP.deplacerPiece(p, neutre.piece, 12, 0);
  assert.strictEqual(deplacement.ok, false);
  assert.strictEqual(deplacement.plateau, p);
  assert.match(deplacement.raison, /étape « Villes »/);
  assert.ok(VP.deplacerPiece(p, autre.id, 12, 0).ok, 'une pièce de terrain se déplace toujours');
  // Pinceau et gomme.
  ['plaine', 'foret', 'marais', 'montagne'].forEach((terrain) => {
    const r = P.peindre(p, neutre.cle, terrain);
    assert.strictEqual(r.ok, false, terrain);
    assert.strictEqual(r.villeNeutre, true);
    assert.strictEqual(r.plateau, p);
    assert.match(r.raison, /étape « Villes »/);
  });
  const gomme = P.gommer(p, neutre.cle);
  assert.strictEqual(gomme.ok, false);
  assert.strictEqual(gomme.villeNeutre, true);
  assert.match(gomme.raison, /étape « Villes »/);
  // Un trait qui passe sur la ville neutre : elle reste, et le message du trait dit pourquoi.
  const trait = VC.tracer(p, { type: 'gomme' }, [neutre.cle]);
  assert.strictEqual(trait.changees, 0);
  assert.match(VC.bilanTrait(trait).message, /étape « Villes »/);
  const peint = VC.tracer(p, { type: 'terrain', terrain: 'foret' }, [neutre.cle]);
  assert.strictEqual(peint.changees, 0);
  assert.match(VC.bilanTrait(peint).message, /étape « Villes »/);
  assert.strictEqual(JSON.stringify(p), fige, 'plateau intact');
  assert.strictEqual(P.etatVilles(p).neutres.length, 2);
  // L'étape « Villes » la retire et la repose.
  const retrait = V.cliquer(p, 'neutre', neutre.cle, {});
  assert.ok(retrait.ok && retrait.action === 'retrait');
  assert.strictEqual(P.etatVilles(retrait.plateau).neutres.length, 1);
  assert.ok(P.retirerVilleNeutre(p, neutre.cle).ok);
  // La gomme retire toujours une ville de déploiement (tuile posée par-dessus) et une tuile d'une case ordinaire.
  assert.ok(P.gommer(p, p.camps.vert[0]).ok);
});

// ------------------------------------------------------------------ 3. « Générer » : la profondeur en cause est dite

test('correction 3 : un échec de « Générer » dû à la profondeur des extrémités le dit, avec la profondeur qui aurait suffi', () => {
  let echec = null;
  // Une graine qui échoue à 1 rangée ALORS qu'un de ses terrains construits aurait eu ses villes avec 2 rangées.
  for (let g = 1; g <= 40 && !echec; g++) { const r = G.generer(g, { profondeurExtremite: 1 }); if (!r.ok && r.echecs.profondeur >= 1) echec = { graine: g, r: r }; }
  assert.ok(echec, 'une graine de 1 à 40 échoue à 1 rangée à cause de la profondeur');
  const r = echec.r;
  assert.match(r.raison, /La profondeur des extrémités \(1 rangée en haut et en bas\) est en cause : \d+ terrains? construits? aurai(en)?t eu (leurs|ses) villes avec 2 rangées\./);
  assert.match(r.raison, /Changez le réglage « Profondeur des extrémités » \(étape « Villes »\)/);
  assert.ok(r.echecs.profondeur >= 1 && r.echecs.profondeur <= r.echecs.villes);
  assert.deepStrictEqual(r.profondeur, { essais: r.echecs.profondeur, conseillee: 2 });
  // Le conseil est vrai : la même graine réussit à la profondeur conseillée, et le plateau l'enregistre s'il le faut.
  const mieux = G.generer(echec.graine, { profondeurExtremite: r.profondeur.conseillee });
  assert.ok(mieux.ok, mieux.raison);
  assert.deepStrictEqual(mieux.plateau, G.generer(echec.graine).plateau, '2 rangées = réglage par défaut : même plateau, sans champ');
  // Un échec qui ne tient pas à la profondeur n'en parle pas : contact, ou profondeur déjà maximale.
  let autre = null;
  for (let g = 1; g <= 80 && !autre; g++) { const x = G.generer(g, { tentatives: 1, profondeurExtremite: 3 }); if (!x.ok) autre = x; }
  assert.ok(autre, 'une graine échoue en un seul essai');
  assert.strictEqual(autre.echecs.profondeur, 0);
  assert.strictEqual(autre.profondeur, undefined);
  assert.ok(!/profondeur des extrémités/i.test(autre.raison), autre.raison);
  // Une génération réussie n'a pas de champ `profondeur`, même si des essais ont manqué de places en chemin.
  const reussies = [];
  for (let g = 1; g <= 80 && reussies.length < 2; g++) if (G.generer(g, { profondeurExtremite: 1 }).ok) reussies.push(g);
  assert.strictEqual(reussies.length, 2, 'deux graines de 1 à 80 réussissent à 1 rangée');
  for (const g of reussies) { const x = G.generer(g, { profondeurExtremite: 1 }); assert.ok(x.ok, x.raison); if (x.ok) { assert.strictEqual(x.profondeur, undefined); assert.strictEqual(x.plateau.profondeurExtremite, 1); assert.deepStrictEqual(erreurs(K.tout(x.plateau)), []); } }
});

// ------------------------------------------------------------------ 4. « Autre proposition »

test('correction 4 : « Autre proposition » donne la combinaison suivante, sans tirage, toujours conforme', () => {
  const plein = genere(1), nu = V.retirerToutes(plein).plateau;
  const liste = G.propositionsVilles(P.cases(nu, { sansRecouvrements: true }), G.reglages({}));
  assert.ok(liste.length > 3, liste.length + ' combinaisons');
  for (let i = 1; i < liste.length; i++) assert.ok(liste[i - 1].score <= liste[i].score, 'de la mieux équilibrée à la moins équilibrée');
  assert.strictEqual(new Set(liste.map(G.signatureVilles)).size, liste.length, 'toutes différentes');
  assert.deepStrictEqual(G.propositionsVilles(P.cases(nu, { sansRecouvrements: true }), G.reglages({})), liste, 'même terrain = même liste');
  // La pose automatique est l'une des meilleures ; elle n'a pas changé.
  const auto = V.poserAuto(nu, nu.graine, {});
  assert.ok(auto.ok, auto.raison);
  assert.strictEqual(auto.score, liste[0].score);
  // Sans villes : la première proposition. Puis les suivantes : toutes différentes, complètes, sans erreur.
  const premiere = V.autreProposition(nu, {});
  assert.ok(premiere.ok, premiere.raison);
  assert.deepStrictEqual([premiere.rang, premiere.nombre, premiere.seule], [1, liste.length, false]);
  const vues = new Set();
  let p = auto.plateau, scores = [];
  for (let i = 0; i < 6; i++) {
    const r = V.autreProposition(p, {});
    assert.ok(r.ok, r.raison);
    assert.notStrictEqual(JSON.stringify(P.deploiements(r.plateau)) + JSON.stringify(P.etatVilles(r.plateau).neutres), JSON.stringify(P.deploiements(p)) + JSON.stringify(P.etatVilles(p).neutres), 'les villes changent');
    const signature = JSON.stringify([r.plateau.camps, P.etatVilles(r.plateau).neutres.map((n) => n.cle)]);
    assert.ok(!vues.has(signature), 'jamais deux fois la même en 6 propositions');
    vues.add(signature);
    const bilan = K.tout(r.plateau);
    assert.deepStrictEqual(erreurs(bilan), []);
    assert.strictEqual(bilan.etape, 'complet');
    assert.strictEqual(bilan.equilibre.score, r.score);
    assert.strictEqual(r.score, liste[r.rang - 1].score);
    assert.ok(P.lire(P.serialiser(r.plateau)).ok);
    assert.deepStrictEqual(V.retirerToutes(r.plateau).plateau, nu, 'le terrain ne change pas');
    assert.deepStrictEqual(V.autreProposition(p, {}).plateau, r.plateau, 'même plateau = même proposition');
    scores.push(r.score);
    p = r.plateau;
  }
  // Après « Annuler » (retour au plateau d'avant), la même suite se retrouve.
  const suite = V.autreProposition(auto.plateau, {});
  assert.strictEqual(suite.score, scores[0]);
  // Des villes posées à la main qui ne sont pas une combinaison de la liste : on repart de la première.
  const aLaMain = V.cliquer(nu, 'vert', V.places(nu, 'vert')[0], {}).plateau;
  assert.deepStrictEqual(V.autreProposition(aLaMain, {}).plateau, premiere.plateau);
});

test('correction 4 : la suite des propositions fait le tour et revient à la première ; une seule combinaison = rien ne change', () => {
  // Terrain qui a peu de combinaisons (extrémités d'une rangée) : le tour complet est court.
  let cas = null;
  for (let g = 1; g <= 40 && !cas; g++) {
    const r = G.generer(g, { profondeurExtremite: 1 });
    if (!r.ok) continue;
    const nu = V.retirerToutes(r.plateau).plateau;
    const n = G.propositionsVilles(P.cases(nu, { sansRecouvrements: true }), G.reglages({ profondeurExtremite: 1 })).length;
    if (n >= 2 && n <= 12) cas = { nu: nu, n: n };
  }
  assert.ok(cas, 'un terrain de 2 à 12 combinaisons');
  let p = cas.nu;
  const rangs = [], plateaux = [];
  for (let i = 0; i < cas.n + 1; i++) { const r = V.autreProposition(p, {}); assert.ok(r.ok, r.raison); rangs.push(r.rang); plateaux.push(JSON.stringify(r.plateau)); p = r.plateau; }
  assert.deepStrictEqual(rangs, Array.from({ length: cas.n }, (x, i) => i + 1).concat([1]));
  assert.strictEqual(new Set(plateaux.slice(0, cas.n)).size, cas.n);
  assert.strictEqual(plateaux[cas.n], plateaux[0], 'après la dernière, la première');
  // Aucune combinaison (noyau seul) : même explication que la pose automatique.
  const seul = V.autreProposition(P.vierge(1), {});
  assert.strictEqual(seul.ok, false);
  assert.match(seul.raison, /Pas assez de places/);
  assert.strictEqual(V.autreProposition(P.vide(1), {}).ok, false);
});

// ------------------------------------------------------------------ 5. `deploiements` hors du plateau ou hors d'une Plaine

test('correction 5 : une entrée « deploiements » hors du plateau ou sur une case qui n’est pas une Plaine est refusée à la lecture', () => {
  const bon = () => JSON.parse(P.serialiser(genere(7)));
  const refuse = (modifier, motif) => {
    const o = bon();
    modifier(o);
    const res = P.valider(o);
    assert.strictEqual(res.ok, false, 'aurait dû être refusé : ' + motif);
    assert.match(res.erreurs.join(' | '), motif);
    assert.strictEqual(res.plateau, null);
    // Même refus par la table de jeu (fichier de partie).
    const partie = T.creer({ graine: 1, plateau: genere(7) }, env(1));
    const brut = JSON.parse(T.serialiser(partie.etat));
    modifier(brut.plateau);
    assert.strictEqual(T.charger(JSON.stringify(brut), env(1)).ok, false, 'partie : ' + motif);
  };
  const toutes = P.cases(genere(7), { sansVilles: true });
  const premiere = (terrain) => Object.keys(toutes).filter((k) => toutes[k].origine === terrain)[0];
  refuse((o) => { o.deploiements[0].cle = '20,20'; }, /Ville de déploiement n° 1 : aucune case du plateau en \(20,20\)/);
  refuse((o) => { o.deploiements[1].cle = '-30,30'; }, /Ville de déploiement n° 2 : aucune case du plateau/);
  refuse((o) => { o.deploiements[0].cle = premiere('foret'); }, /n’est pas une Plaine \(foret\)/);
  refuse((o) => { o.deploiements[0].cle = premiere('marais'); }, /n’est pas une Plaine \(marais\)/);
  refuse((o) => { o.deploiements[3].cle = premiere('montagne'); }, /Ville de déploiement n° 4 : la case \(.*\) n’est pas une Plaine \(montagne\)/);
  refuse((o) => { o.deploiements[0].cle = '0,0'; }, /n’est pas une Plaine \(ville\)/);
  // Sur la case d'une ville neutre : ce n'est pas une case du terrain.
  refuse((o) => { const vn = o.pieces.filter((x) => x.modele === 'VN')[0]; o.deploiements[0].cle = vn.q + ',' + vn.r; }, /aucune case du plateau/);
  // La pièce qui portait la ville a été retirée du fichier.
  refuse((o) => { const k = o.deploiements[0].cle, id = P.cases(o)[k].piece; o.pieces = o.pieces.filter((x) => x.id !== id); }, /aucune case du plateau/);
  // Chevauchement : la case est celle de la PREMIÈRE pièce de la liste, comme dans cases().
  const k = bon().deploiements[0].cle, c = H.decle(k);
  refuse((o) => { o.pieces.unshift({ id: 'devant', modele: 'F', q: c.q, r: c.r, rotation: 0 }); }, /n’est pas une Plaine \(foret\)/);
  const derriere = bon();
  derriere.pieces.push({ id: 'derriere', modele: 'F', q: c.q, r: c.r, rotation: 0 });
  assert.ok(P.valider(derriere).ok, 'la Plaine d’origine est dessous : format accepté, le chevauchement est l’affaire des contrôles');
  // Sur une Plaine mal choisie (noyau, hors de l'extrémité) : le format l'accepte, ce sont les contrôles qui jugent.
  const surNoyau = bon();
  surNoyau.deploiements[0].cle = '1,0';
  surNoyau.camps.vert = H.trier(surNoyau.deploiements.filter((x) => x.camp === 'vert').map((x) => x.cle));
  const lu = P.valider(surNoyau);
  assert.ok(lu.ok, lu.erreurs.join(' '));
  assert.ok(erreurs(K.tout(lu.plateau)).some((m) => /ne se pose pas sur le noyau/.test(m)));
  // Un plateau correct se relit.
  assert.ok(P.valider(bon()).ok);
});

test('correction 5 : la pose libre elle-même exige une Plaine du plateau, hors noyau', () => {
  const nu = V.retirerToutes(genere(3)).plateau, toutes = P.cases(nu);
  let acceptees = 0;
  Object.keys(toutes).concat(V.anneau(nu), ['20,20']).forEach((cle) => {
    const r = P.poserVilleDeploiement(nu, 'vert', cle, { libre: true });
    const plaine = !!toutes[cle] && toutes[cle].origine === 'plaine' && toutes[cle].modele !== 'N1';
    assert.strictEqual(r.ok, plaine, cle + ' : ' + (r.raison || 'acceptée'));
    if (r.ok) { acceptees += 1; assert.ok(P.lire(P.serialiser(r.plateau)).ok); }
  });
  assert.ok(acceptees > 20);
});

test('correction 5 : après n’importe quelle suite de retouches acceptées, le plateau enregistré se relit toujours', () => {
  const departs = [];
  departs.push(genere(3));
  departs.push(P.vierge('fait main'));
  // Fichier valide dont deux pièces se chevauchent sous une ville de déploiement.
  const double = JSON.parse(P.serialiser(genere(5))), cle = H.decle(double.deploiements[0].cle);
  double.pieces.push({ id: 'double', modele: 'S', q: cle.q, r: cle.r, rotation: 0 });
  const lu = P.valider(double);
  assert.ok(lu.ok, lu.erreurs.join(' '));
  departs.push(lu.plateau);
  const terrains = ['plaine', 'foret', 'marais', 'montagne'], modeles = C.ORDRE_MODELES.concat(['P', 'F', 'S', 'V', 'M1']);
  let acceptes = 0, avecVilles = 0, retirees = 0;
  departs.forEach((depart, n) => {
    const alea = AT.alea.creer('retouches ' + n);
    let p = depart;
    // Une fois sur trois, la retouche vise exprès une case qui porte une ville de déploiement, ou la pièce qui la porte.
    const villeAuHasard = () => { const d = P.deploiements(p); return d.length && alea.entier(3) === 0 ? d[alea.entier(d.length)].cle : null; };
    const caseAuHasard = () => { const cles = Object.keys(P.cases(p)).concat(V.anneau(p)); return villeAuHasard() || (cles.length ? cles[alea.entier(cles.length)] : '0,0'); };
    const pieceAuHasard = () => { const k = villeAuHasard(); return k ? P.cases(p)[k].piece : (p.pieces.length ? p.pieces[alea.entier(p.pieces.length)].id : 'aucune'); };
    for (let i = 0; i < 2000; i++) {
      const k = caseAuHasard(), c = H.decle(k), camp = alea.entier(2) ? 'vert' : 'rouge', libre = alea.entier(3) > 0;
      let r;
      const tirage = alea.entier(13), villesAvant = P.deploiements(p).length;
      switch (tirage) {   // 13 retouches possibles
        case 0: r = P.poser(p, modeles[alea.entier(modeles.length)], c.q, c.r, alea.entier(6), { horsStock: alea.entier(2) === 0 }); break;
        case 1: r = P.retirer(p, pieceAuHasard()); break;
        case 2: r = P.tourner(p, pieceAuHasard(), 1 + alea.entier(5)); break;
        case 3: r = VP.deplacerPiece(p, pieceAuHasard(), c.q, c.r, alea.entier(6)); break;
        case 4: r = P.peindre(p, k, terrains[alea.entier(4)]); break;
        case 5: r = P.gommer(p, k); break;
        case 6: case 7: r = P.poserVilleDeploiement(p, camp, k, { libre: libre, profondeurExtremite: 1 + alea.entier(3) }); break;
        case 8: r = P.poserVilleNeutre(p, k, { libre: libre }); break;
        case 9: r = P.deploiements(p).length ? P.retirerVilleDeploiement(p, P.deploiements(p)[0].cle) : { ok: false }; break;
        case 10: r = P.poserEvenement(p, C.ORDRE_EVENEMENTS[alea.entier(C.ORDRE_EVENEMENTS.length)], k); break;
        case 11: r = P.avecProfondeurExtremite(p, 1 + alea.entier(3)); break;
        default: r = p.recouvrements.length ? P.retirerEvenement(p, p.recouvrements[0].cle) : { ok: false };
      }
      if (!r.ok) continue;
      acceptes += 1;
      p = P.avecCamps(r.plateau);                        // comme l'interface après chaque retouche
      if (tirage !== 9 && P.deploiements(p).length < villesAvant) retirees += 1;      // ville partie avec sa Plaine
      const texte = P.serialiser(p), relu = P.lire(texte);
      assert.ok(relu.ok, 'départ ' + n + ', retouche ' + i + ' : ' + relu.erreurs.join(' | '));
      assert.strictEqual(P.serialiser(relu.plateau), texte);
      const dessous = P.cases(p, { sansRecouvrements: true, sansVilles: true });
      P.deploiements(p).forEach((d) => assert.strictEqual(dessous[d.cle] && dessous[d.cle].origine, 'plaine'));
      if (P.deploiements(p).length) avecVilles += 1;
    }
  });
  if (process.env.RECETTE_BAVARDE) console.log(acceptes, avecVilles, retirees);
  assert.ok(acceptes > 600, acceptes + ' retouches acceptées');
  assert.ok(avecVilles > 50, avecVilles + ' états avec des villes de déploiement');
  assert.ok(retirees > 5, retirees + ' retouches ont retiré une ville avec sa Plaine');
});

// ------------------------------------------------------------------ 6. contrôle 1 sur un plateau de l'ancien catalogue

test('correction 6 : sur un plateau de l’ancien catalogue, le contrôle 1 ne parle ni de pièces de terrain à poser ni de tuiles à prévoir en plus', () => {
  ['plateau-genere.json', 'plateau-retouche.json'].forEach((nom) => {
    const lu = P.lire(fixture(nom));
    assert.ok(lu.ok, lu.erreurs.join(' '));
    const constats = K.inventaire(lu.plateau), textes = constats.map((x) => x.message).join(' | ');
    assert.ok(constats.some((x) => x.niveau === 'info' && /^Plateau de l’ancien catalogue : \d+ tuiles d’une case de ce catalogue \(/.test(x.message) && x.donnees.ancien === true), nom + ' : ' + textes);
    assert.ok(!/pièces? de terrain (restantes|à poser)/i.test(textes), nom + ' : ' + textes);
    // Seule une tuile qui n'est d'aucun catalogue (montagne d'une case du pinceau) reste « à prévoir en plus ».
    constats.filter((x) => /à prévoir en plus du catalogue/.test(x.message)).forEach((x) => assert.ok(!/Plaine|Forêt|Marais|Ville/.test(x.message), nom + ' : ' + x.message));
    assert.strictEqual(constats.filter((x) => x.niveau === 'erreur').length, 0, textes);
  });
  const genereV1 = P.lire(fixture('plateau-genere.json')).plateau;
  assert.match(K.inventaire(genereV1)[0].message, /55 tuiles d’une case de ce catalogue \(39 × Plaine, 5 × Forêt, 5 × Marais, 6 × Ville \(ancien catalogue\)\)\. Il ne se compare pas à l’inventaire du catalogue 2\.$/);
  assert.strictEqual(K.inventaire(genereV1).length, 1, 'un seul constat');
  assert.strictEqual(K.tout(genereV1).resultats.filter((x) => x.regle === 'inventaire' && x.niveau === 'alerte').length, 0);
  // Une montagne d'une case peinte sur cet ancien plateau reste annoncée (elle n'est d'aucun catalogue).
  const vide = V.anneau(genereV1)[0];
  const peint = P.peindre(genereV1, vide, 'montagne').plateau;
  assert.ok(K.inventaire(peint).some((x) => x.niveau === 'alerte' && /^Tuiles à prévoir en plus du catalogue \(1\) : 1 × Montagne d’une case\.$/.test(x.message)));
  // Plateau du catalogue 2 : une forêt peinte au pinceau n'en fait pas un ancien plateau ; elle y est hors règles (I2).
  const p2 = genere(1);
  assert.match(K.inventaire(p2)[0].message, /^Toutes les pièces de terrain du catalogue sont posées/);
  const foret = P.peindre(p2, V.anneau(p2)[0], 'foret').plateau;
  assert.ok(K.inventaire(foret).some((x) => x.niveau === 'erreur' && /^Hors règles : 1 tuile de terrain d’une case \(1 × Forêt\)\./.test(x.message)));
  assert.ok(!K.inventaire(foret).some((x) => /ancien catalogue/.test(x.message)));
  assert.match(K.inventaire(P.vierge(1)).filter((x) => x.niveau === 'alerte')[0].message, /^Pièces de terrain restantes \(23\)/);
});
