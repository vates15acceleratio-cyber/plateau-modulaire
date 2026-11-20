'use strict';
// Lot H : villes libres sur une Plaine (docs/02-atelier-cahier-des-charges.md, §10).
// Remplace villes.test.js, villes-interface.test.js et corrections-villes.test.js, écrits pour les règles d'avant
// (bords haut et bas, flancs, profondeur des extrémités, ville neutre tenue par 2 pièces, pose libre).
//   1. modèle : placesVille, poserVille, retirerVille, etatVilles ;
//   2. fichiers : validation stricte de `deploiements`, champ `profondeurExtremite` lu sans effet ;
//   3. plateaux des règles précédentes (tests/fixtures-v3, écrit AVANT le lot H ; ne pas le régénérer) ;
//   4. logique de l'étape « Villes » (compteurs, places, diagnostic, clic, pose automatique, autre proposition) ;
//   5. retouches du terrain sous une ville, rendu, table de jeu.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../src/vue-villes.js');
const VC = require('../src/vue-creation.js');
const VP = require('../src/vue-plateau.js');
const VI = require('../src/vue-inventaire.js');
const R = require('../src/rendu.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles, G = AT.generateur, T = AT.partie;

const copie = (o) => JSON.parse(JSON.stringify(o));
const garde = {};
const genere = (graine) => { if (!garde[graine]) { const g = G.generer(graine); assert.ok(g.ok, g.raison); garde[graine] = JSON.stringify(g.plateau); } return JSON.parse(garde[graine]); };
/** Terrain construit, aucune ville posée. */
const construit = (graine) => V.retirerToutes(genere(graine)).plateau;
const env = (graine) => ({ alea: AT.alea.creer(graine), hex: H, plateau: P });
const erreurs = (p) => K.tout(p).resultats.filter((x) => x.niveau === 'erreur').map((x) => x.message);
const texteV3 = () => fs.readFileSync(path.join(__dirname, 'fixtures-v3', 'plateau-genere.json'), 'utf8');
const pourPartie = (p) => { const q = { version: p.version, graine: p.graine, pieces: p.pieces, recouvrements: [], camps: p.camps }; if (p.deploiements) q.deploiements = p.deploiements; return q; };

// ------------------------------------------------------------------ 1. modèle

test('poserVille : les 6 villes se posent une à une sur des Plaines, dans n’importe quel ordre ; etatVilles et camps suivent', () => {
  let p = construit(1);
  const fige = JSON.stringify(p);
  assert.deepStrictEqual(P.PROPRIETAIRES, ['neutre', 'vert', 'rouge']);
  assert.deepStrictEqual(['neutre', 'vert', 'rouge'].map(P.quotaVilles), [2, 2, 2]);
  assert.deepStrictEqual(P.etatVilles(p), { vert: [], rouge: [], neutres: [], manquantes: { vert: 2, rouge: 2, neutres: 2 }, completes: false, reglesPrecedentes: false });
  assert.ok(!('deploiements' in p));
  // L'ordre conseillé (neutres d'abord) n'est pas imposé : on commence ici par Rouge.
  const posees = [];
  ['rouge', 'neutre', 'vert', 'neutre', 'rouge', 'vert'].forEach((qui) => {
    const places = P.placesVille(p, qui);
    assert.ok(places.length > 0, 'des places pour ' + qui);
    const r = P.poserVille(p, qui, places[places.length >> 1]);
    assert.ok(r.ok, r.raison);
    assert.deepStrictEqual([r.proprietaire, r.cle], [qui, places[places.length >> 1]]);
    posees.push(r.cle);
    p = r.plateau;
  });
  assert.strictEqual(JSON.stringify(construit(1)), fige, 'le plateau de départ n’est jamais modifié en place');
  const etat = P.etatVilles(p), cases = P.cases(p);
  assert.strictEqual(etat.completes, true);
  assert.deepStrictEqual(etat.manquantes, { vert: 0, rouge: 0, neutres: 0 });
  assert.deepStrictEqual(etat.neutres.map((n) => [n.piece, n.ancienne]), [[null, false], [null, false]]);
  assert.deepStrictEqual(p.camps, { vert: etat.vert, rouge: etat.rouge }, 'camps est déduit des villes de déploiement');
  assert.strictEqual(P.villes(p).length, 7);
  assert.strictEqual(Object.keys(cases).length, 91, 'une ville n’ajoute aucune case');
  etat.neutres.forEach((n) => assert.deepStrictEqual([cases[n.cle].terrain, cases[n.cle].origine, cases[n.cle].ville, cases[n.cle].camp], ['ville', 'plaine', 'VNP', 'neutre']));
  etat.vert.forEach((k) => assert.deepStrictEqual([cases[k].terrain, cases[k].origine, cases[k].ville, cases[k].camp], ['ville', 'plaine', 'VD', 'vert']));
  assert.strictEqual(P.cout(p, etat.neutres[0].cle), 1, 'une ville coûte 1 ration');
  // Toutes à 4 pas au moins ; contrôles sans erreur ; plateau complet ; fichier relu à l'identique.
  P.villes(p).forEach((a) => { const d = P.distancesPas(p, a); P.villes(p).forEach((b) => { if (a !== b) assert.ok(d[b] >= 4, a + ' ' + b); }); });
  const bilan = K.tout(p);
  assert.deepStrictEqual([bilan.erreurs, bilan.etape], [0, 'complet'], erreurs(p).join(' | '));
  assert.deepStrictEqual(P.lire(P.serialiser(p)).plateau, p);
  // Plus aucune place une fois le quota atteint ; retirer une ville en rend.
  ['neutre', 'vert', 'rouge'].forEach((qui) => assert.deepStrictEqual(P.placesVille(p, qui), []));
  const moins = P.retirerVille(p, etat.neutres[0].cle);
  assert.deepStrictEqual([moins.ok, moins.proprietaire, moins.ancienne], [true, 'neutre', false]);
  assert.ok(P.placesVille(moins.plateau, 'neutre').includes(etat.neutres[0].cle));
  assert.deepStrictEqual(moins.plateau.camps, p.camps);
  const sansVert = P.retirerVille(p, etat.vert[0]).plateau;
  assert.deepStrictEqual(sansVert.camps.vert, [etat.vert[1]]);
  assert.strictEqual(P.retirerVille(p, '0,0').ok, false, 'la ville du noyau ne se retire pas');
  assert.match(P.retirerVille(p, '0,0').raison, /Aucune ville à retirer/);
});

test('poserVille : refus en français clair qui donnent la cause (hors plateau, noyau, pas une Plaine, déjà une ville, événement, écart, quota)', () => {
  const p = construit(2), cases = P.cases(p), d0 = P.distancesPas(p, '0,0');
  const refus = (plateau, qui, cle) => { const r = P.poserVille(plateau, qui, cle); assert.strictEqual(r.ok, false); assert.strictEqual(r.plateau, plateau); return r; };
  assert.deepStrictEqual([refus(p, 'bleu', '3,0').cause, refus(p, 'bleu', '3,0').raison], ['proprietaire', 'Propriétaire inconnu (neutre, vert ou rouge).']);
  assert.deepStrictEqual([refus(p, 'neutre', '25,0').cause, refus(p, 'neutre', '__proto__').cause, refus(p, 'neutre', undefined).cause], ['hors', 'hors', 'hors']);
  assert.match(refus(p, 'neutre', '25,0').raison, /n’est pas sur le plateau/);
  assert.deepStrictEqual([refus(p, 'vert', '1,0').cause, refus(p, 'vert', '1,0').raison], ['noyau', 'Une ville ne se pose pas sur le noyau.']);
  assert.strictEqual(refus(p, 'vert', '0,0').cause, 'ville');
  const loin = (terrain) => Object.keys(cases).filter((k) => cases[k].terrain === terrain && d0[k] >= 4)[0];
  ['foret', 'marais'].forEach((t) => {
    const r = refus(p, 'rouge', loin(t));
    assert.deepStrictEqual([r.cause, r.raison], ['plaine', 'Ce n’est pas une Plaine (ici : ' + t + ') : une ville se pose par-dessus une case de Plaine.']);
  });
  assert.strictEqual(refus(p, 'rouge', Object.keys(cases).filter((k) => cases[k].terrain === 'montagne')[0]).cause, 'plaine');
  // Trop près du centre : la ville en cause est nommée par son numéro (celui du dessin) et sa case.
  const pres = Object.keys(cases).filter((k) => cases[k].terrain === 'plaine' && cases[k].modele !== 'N1' && d0[k] === 2)[0];
  const r1 = refus(p, 'neutre', pres);
  assert.deepStrictEqual([r1.cause, r1.ville, r1.numero, r1.pas], ['ecart', '0,0', 1, 2]);
  assert.strictEqual(r1.raison, 'Trop près de la ville n° 1 (0,0) : 2 pas, il en faut 4 (soit 3 cases entre elles).');
  // Trop près d'une ville posée ; son numéro est celui de R.numerosVilles.
  const place = P.placesVille(p, 'neutre')[0], un = P.poserVille(p, 'neutre', place).plateau;
  const voisine = H.voisines(place).filter((v) => cases[v] && cases[v].terrain === 'plaine' && cases[v].modele !== 'N1' && d0[v] >= 4)[0];
  if (voisine) {
    const r2 = refus(un, 'vert', voisine);
    assert.deepStrictEqual([r2.cause, r2.ville, r2.pas, r2.numero], ['ecart', place, 1, R.numerosVilles(un)[place]]);
  }
  assert.strictEqual(refus(un, 'vert', place).cause, 'ville');
  // Une Plaine qui porte une tuile d'événement ne reçoit pas de ville, et n'est plus proposée.
  const avecEv = P.poserEvenement(p, 'E8', place);
  assert.ok(avecEv.ok, avecEv.raison);
  assert.deepStrictEqual([refus(avecEv.plateau, 'neutre', place).cause, refus(avecEv.plateau, 'neutre', place).raison], ['evenement', 'Cette case porte une tuile d’événement.']);
  assert.strictEqual(P.placesVille(avecEv.plateau, 'neutre').includes(place), false);
  // Quota.
  const plein = genere(2);
  const q = refus(plein, 'vert', '3,0');
  assert.deepStrictEqual([q.cause, q.raison], ['quota', 'Quota atteint : Vert a déjà ses 2 villes de déploiement. Retirez-en une avant d’en poser une autre.']);
  assert.strictEqual(P.peutPoserVille(plein, 'neutre', '3,0').cause, 'quota');
  // L'écart est un réglage.
  assert.ok(P.placesVille(p, 'neutre', { ecartVilles: 6 }).length < P.placesVille(p, 'neutre').length);
});

// ------------------------------------------------------------------ 2. fichiers

test('fichier : le champ « deploiements » est validé strictement (propriétaire, case, doublons, quotas, Plaine du plateau)', () => {
  const bon = genere(3);
  const avec = (modifier) => { const o = copie(bon); modifier(o); return P.valider(o); };
  assert.ok(P.valider(copie(bon)).ok);
  const refuse = (nom, modifier, motif) => { const r = avec(modifier); assert.strictEqual(r.ok, false, nom); assert.match(r.erreurs.join(' | '), motif, nom); assert.strictEqual(r.plateau, null); };
  refuse('propriétaire inconnu', (o) => { o.deploiements[0].camp = 'bleu'; }, /Ville posée n° 1 : propriétaire invalide \(neutre, vert ou rouge\)/);
  refuse('propriétaire « constructor »', (o) => { o.deploiements[0].camp = 'constructor'; }, /propriétaire invalide/);
  refuse('propriétaire « __proto__ »', (o) => { o.deploiements[0].camp = '__proto__'; }, /propriétaire invalide/);
  refuse('propriétaire non textuel', (o) => { o.deploiements[0].camp = ['neutre']; }, /propriétaire invalide/);
  refuse('champ en trop', (o) => { o.deploiements[0].flanc = 'gauche'; }, /champ inconnu « flanc »/);
  refuse('entrée à clé __proto__', (o) => { o.deploiements[0] = JSON.parse('{"cle":"3,0","camp":"neutre","__proto__":{"x":1}}'); }, /champ inconnu/);
  refuse('case invalide', (o) => { o.deploiements[0].cle = '99,0'; }, /Ville posée n° 1 : case invalide/);
  refuse('case « __proto__ »', (o) => { o.deploiements[0].cle = '__proto__'; }, /case invalide/);
  refuse('deux villes sur la même case', (o) => { o.deploiements[1].cle = o.deploiements[0].cle; }, /deux villes sur la même case/);
  refuse('trois villes neutres', (o) => { o.deploiements[2].camp = 'neutre'; }, /plus de 2 villes neutres/);
  refuse('trois villes pour Rouge', (o) => { o.deploiements[0].camp = 'rouge'; }, /plus de 2 villes de déploiement pour Rouge/);
  refuse('liste trop longue', (o) => { for (let i = 0; i < 9; i++) o.deploiements.push({ cle: i + ',9', camp: 'neutre' }); }, /Liste des villes posées invalide \(8 au plus\)/);
  refuse('liste qui n’en est pas une', (o) => { o.deploiements = { length: 0 }; }, /Liste des villes posées invalide/);
  refuse('hors du plateau', (o) => { o.deploiements[0].cle = '25,0'; }, /aucune case du plateau en \(25,0\)/);
  const cases = P.cases(bon), foret = Object.keys(cases).filter((k) => cases[k].terrain === 'foret')[0];
  refuse('sur une forêt', (o) => { o.deploiements[0].cle = foret; }, /n’est pas une Plaine \(foret\)/);
  refuse('sur une case qui porte un événement', (o) => { o.recouvrements = [{ evenement: 'E8', cle: o.deploiements[0].cle }]; }, /porte déjà une tuile d’événement/);
  // Mal choisie mais lisible (trop près, sur le noyau) : ce sont les contrôles qui le disent.
  const surNoyau = avec((o) => { o.deploiements[0].cle = '1,0'; });
  assert.ok(surNoyau.ok);
  assert.ok(erreurs(surNoyau.plateau).some((m) => /mal placée : Une ville ne se pose pas sur le noyau/.test(m)));
});

test('règles précédentes : le champ « profondeurExtremite » est lu sans effet (1 à 3), n’est plus écrit, et reste validé strictement', () => {
  const bon = genere(3);
  [1, 2, 3].forEach((n) => {
    const lu = P.valider(Object.assign(copie(bon), { profondeurExtremite: n }));
    assert.ok(lu.ok, lu.erreurs.join(' '));
    assert.ok(!('profondeurExtremite' in lu.plateau), 'le champ est abandonné à la lecture');
    assert.deepStrictEqual(lu.plateau, bon);
    assert.ok(!/profondeurExtremite/.test(P.serialiser(Object.assign(copie(bon), { profondeurExtremite: n }))), 'jamais écrit');
  });
  [0, 4, 2.5, '2', null, [2]].forEach((v) => {
    const lu = P.valider(Object.assign(copie(bon), { profondeurExtremite: v }));
    assert.strictEqual(lu.ok, false, String(v));
    assert.match(lu.erreurs[0], /Profondeur des extrémités invalide/);
  });
  assert.strictEqual(P.profondeurExtremite, undefined, 'plus de fonction de profondeur dans le modèle');
  assert.strictEqual(C.REGLAGES.villes.profondeurExtremite, undefined);
  // Dans une partie : même chose (le plateau d'une partie est revalidé de son côté).
  const partie = T.creer({ graine: 4, plateau: Object.assign(pourPartie(bon), { profondeurExtremite: 3 }) }, env(4));
  assert.ok(partie.ok, partie.raison);
  assert.ok(!('profondeurExtremite' in partie.etat.plateau));
  assert.ok(T.charger(T.serialiser(partie.etat), env(4)).ok);
  assert.match(T.creer({ graine: 4, plateau: Object.assign(pourPartie(bon), { profondeurExtremite: 7 }) }, env(4)).raison, /profondeur des extrémités invalide/);
  assert.match(T.creer({ graine: 4, plateau: Object.assign(pourPartie(bon), { deploiements: [{ cle: '3,0', camp: 'bleu' }] }) }, env(4)).raison, /propriétaire invalide/);
});

// ------------------------------------------------------------------ 3. plateaux des règles précédentes

test('fichier témoin des règles d’avant le lot H (fixtures-v3) : il s’ouvre, se réenregistre, porte une partie ; alerte, jamais erreur', () => {
  const brut = JSON.parse(texteV3());
  assert.strictEqual(brut.pieces.filter((x) => x.modele === 'VN').length, 2, 'villes neutres en tuiles ajoutées contre le plateau');
  assert.deepStrictEqual(brut.deploiements.map((d) => d.camp), ['vert', 'vert', 'rouge', 'rouge']);
  const lu = P.lire(texteV3());
  assert.ok(lu.ok, lu.erreurs.join(' '));
  const p = lu.plateau;
  assert.deepStrictEqual(p.pieces, brut.pieces);
  assert.deepStrictEqual(p.deploiements, brut.deploiements);
  assert.deepStrictEqual(p.camps, brut.camps);
  assert.deepStrictEqual(P.villes(p), ['0,-4', '5,-4', '7,-1', '0,0', '-5,1', '-3,4', '2,4'], 'ses 7 villes, là où elles étaient');
  assert.strictEqual(Object.keys(P.cases(p)).length, 93);
  assert.deepStrictEqual(P.lire(P.serialiser(p)).plateau, p, 'réenregistré, il se relit à l’identique');
  assert.deepStrictEqual(P.catalogueDuPlateau(p).nom, 'courant');
  // Ses villes : comptées, complètes, signalées « règles précédentes ».
  const etat = P.etatVilles(p);
  assert.deepStrictEqual([etat.completes, etat.reglesPrecedentes, etat.neutres.map((n) => n.cle)], [true, true, ['7,-1', '-5,1']]);
  assert.deepStrictEqual(P.villesReglesPrecedentes(p), { precedentes: true, neutresTuiles: ['7,-1', '-5,1'], villesTuiles: [] });
  const bilan = K.tout(p);
  assert.deepStrictEqual([bilan.ok, bilan.erreurs, bilan.etape, bilan.villes.erreurs, bilan.villes.alertes], [true, 0, 'complet', 0, 1], erreurs(p).join(' | '));
  assert.strictEqual(bilan.equilibre.score, 4, 'le score d’équilibre qu’il avait');
  assert.match(bilan.resultats.filter((x) => x.niveau === 'alerte')[0].message, /^Règles précédentes pour les villes : 2 villes neutres en tuiles ajoutées contre le plateau \(7,-1\) \(-5,1\)\. Ce plateau reste lisible et jouable tel quel\./);
  assert.strictEqual(V.compteurs(p).reglesPrecedentes, true);
  assert.strictEqual(R.typeTuile(P.cases(p)['7,-1']), 'vn');
  // Avec le champ des règles précédentes (plateau fait à 3 rangées) : même verdict.
  const avecChamp = P.valider(Object.assign(copie(brut), { profondeurExtremite: 3 }));
  assert.ok(avecChamp.ok);
  assert.strictEqual(K.tout(avecChamp.plateau).erreurs, 0);
  // Une partie se crée dessus, on y forme sur une ville de déploiement, une ville neutre se capture, et elle se recharge.
  const partie = T.creer({ graine: 5, plateau: pourPartie(p) }, env(5));
  assert.ok(partie.ok, partie.raison);
  const e = partie.etat, j = e.actif, E = env(5);
  E.alea.restaurer(copie(e.alea));
  const forme = T.former(e, { joueur: j, numero: 1, carte: e.paquets[j].main[0], cle: e.plateau.camps[j][0] }, E);
  assert.ok(forme.ok, forme.raison);
  assert.ok(T.capturerVille(forme.etat, { cle: '7,-1', proprietaire: j }, E).ok);
  assert.ok(T.charger(T.serialiser(forme.etat), env(5)).ok);
  // Inventaire : les 2 tuiles VN ne sont pas « hors règles », et rien n'est « à poser » en plus.
  assert.ok(!K.inventaire(p).some((x) => x.niveau === 'erreur'));
  assert.strictEqual(VI.parRole(p).tuilesVilles.poses, 4, '4 tuiles posées par-dessus ; les 2 anciennes tuiles sont à part');
});

test('règles précédentes : l’ancienne tuile de ville neutre ne se retouche qu’à l’étape « Villes », qui met le plateau aux règles actuelles', () => {
  const p = P.lire(texteV3()).plateau, neutre = P.etatVilles(p).neutres[0], fige = JSON.stringify(p);
  const autre = p.pieces.filter((x) => x.modele !== 'VN' && x.modele !== 'N1')[0];
  assert.match(VP.refusRetoucheVille(p, neutre.piece), /règles précédentes .* qu’à l’étape « Villes »/);
  assert.strictEqual(VP.refusRetoucheVille(p, autre.id), null);
  assert.strictEqual(VP.deplacerPiece(p, neutre.piece, 12, 0).ok, false);
  ['plaine', 'foret'].forEach((terrain) => { const r = P.peindre(p, neutre.cle, terrain); assert.deepStrictEqual([r.ok, r.villeNeutre, r.plateau === p], [false, true, true]); });
  assert.deepStrictEqual([P.gommer(p, neutre.cle).ok, P.gommer(p, neutre.cle).villeNeutre], [false, true]);
  assert.strictEqual(VC.tracer(p, { type: 'gomme' }, [neutre.cle]).changees, 0);
  assert.strictEqual(JSON.stringify(p), fige);
  // Elle compte dans le quota : aucune ville neutre de plus tant qu'elle est là.
  assert.deepStrictEqual(P.placesVille(p, 'neutre'), []);
  assert.strictEqual(P.poserVille(p, 'neutre', '3,0').cause, 'quota');
  // Étape « Villes » : un clic la retire ; on la repose sur une Plaine.
  const retrait = V.cliquer(p, 'neutre', neutre.cle);
  assert.deepStrictEqual([retrait.ok, retrait.action], [true, 'retrait']);
  assert.match(retrait.message, /^Ville neutre des règles précédentes retirée de \(7,-1\) : posez-la maintenant sur une Plaine\.$/);
  assert.strictEqual(retrait.plateau.pieces.filter((x) => x.modele === 'VN').length, 1);
  const places = P.placesVille(retrait.plateau, 'neutre');
  assert.ok(places.length > 0 && places.every((k) => P.cases(p)[k].origine === 'plaine'));
  // Pose automatique : plus aucune ancienne tuile, 6 villes sur des Plaines, plus de signalement.
  const auto = V.poserAuto(p);
  assert.ok(auto.ok, auto.raison);
  assert.strictEqual(auto.plateau.pieces.some((x) => x.modele === 'VN'), false);
  assert.deepStrictEqual(P.deploiements(auto.plateau).map((d) => d.camp), ['neutre', 'neutre', 'vert', 'vert', 'rouge', 'rouge']);
  assert.deepStrictEqual([P.etatVilles(auto.plateau).reglesPrecedentes, K.tout(auto.plateau).erreurs, K.tout(auto.plateau).alertes, K.tout(auto.plateau).etape], [false, 0, 0, 'complet']);
});

// ------------------------------------------------------------------ 4. logique de l'étape « Villes »

test('étape « Villes » : compteurs, ordre conseillé (neutres d’abord), places, clic (pose, refus expliqué, retrait)', () => {
  let p = construit(4);
  assert.deepStrictEqual(V.OUTILS, ['neutre', 'vert', 'rouge']);
  assert.strictEqual(V.outilSuivant(p), 'neutre');
  const c0 = V.compteurs(p);
  assert.deepStrictEqual([c0.neutre, c0.vert, c0.rouge, c0.completes, c0.construction], [{ posees: 0, voulues: 2, complet: false }, { posees: 0, voulues: 2, complet: false }, { posees: 0, voulues: 2, complet: false }, false, 0]);
  // Toutes les Plaines admissibles sont proposées, les mêmes pour les trois outils ; ce sont celles du modèle.
  const places = V.places(p, 'neutre'), cases = P.cases(p), d0 = P.distancesPas(p, '0,0');
  assert.deepStrictEqual(places, Object.keys(cases).filter((k) => cases[k].terrain === 'plaine' && cases[k].modele !== 'N1' && d0[k] >= 4).sort((a, b) => H.trier([a, b])[0] === a ? -1 : 1));
  assert.deepStrictEqual(V.places(p, 'vert'), places);
  assert.deepStrictEqual(V.places(p, 'autre'), []);
  assert.strictEqual(V.diagnostic(p, 'neutre'), null);
  // Refus expliqué : la raison du modèle, le plateau reçu intact.
  const pres = Object.keys(cases).filter((k) => cases[k].terrain === 'plaine' && cases[k].modele !== 'N1' && d0[k] === 3)[0];
  const non = V.cliquer(p, 'neutre', pres);
  assert.deepStrictEqual([non.ok, non.plateau === p, non.action, non.niveau, non.cause], [false, true, null, 'erreur', 'ecart']);
  assert.strictEqual(non.message, 'Pose refusée : Trop près de la ville n° 1 (0,0) : 3 pas, il en faut 4 (soit 3 cases entre elles).');
  assert.match(V.cliquer(p, 'vert', '1,0').message, /^Pose refusée : Une ville ne se pose pas sur le noyau\.$/);
  assert.match(V.cliquer(p, null, places[0]).message, /Choisissez d’abord une ville à poser/);
  // Pose par clic des 6 villes, dans l'ordre conseillé.
  ['neutre', 'neutre', 'vert', 'vert', 'rouge', 'rouge'].forEach((qui, i) => {
    assert.strictEqual(V.outilSuivant(p), qui);
    const r = V.cliquer(p, qui, V.places(p, qui)[0]);
    assert.deepStrictEqual([r.ok, r.action, r.niveau], [true, 'pose', 'info'], r.message);
    assert.match(r.message, qui === 'neutre' ? /^Ville neutre posée sur la Plaine \(/ : /^Ville de déploiement de (Vert|Rouge) posée sur la Plaine \(/);
    p = r.plateau;
    assert.strictEqual(P.deploiements(p).length, i + 1);
  });
  assert.strictEqual(V.outilSuivant(p), null);
  assert.strictEqual(V.compteurs(p).completes, true);
  assert.deepStrictEqual(erreurs(p), []);
  assert.strictEqual(K.tout(p).etape, 'complet');
  const d = V.diagnostic(p, 'vert');
  assert.deepStrictEqual([d.cause, d.message], ['complet', 'Vert a ses 2 villes de déploiement. Cliquez une ville pour la retirer.']);
  assert.strictEqual(V.diagnostic(p, 'neutre').cause, 'complet');
  // Un clic sur une ville posée la retire, quel que soit l'outil.
  const neutre = P.etatVilles(p).neutres[0].cle, retrait = V.cliquer(p, 'rouge', neutre);
  assert.deepStrictEqual([retrait.ok, retrait.action], [true, 'retrait']);
  assert.strictEqual(retrait.message, 'Ville neutre retirée de (' + neutre + ') : la Plaine du dessous est de nouveau libre.');
  assert.strictEqual(V.outilSuivant(retrait.plateau), 'neutre');
  // Tout retirer : le terrain ne change pas.
  const nu = V.retirerToutes(p);
  assert.strictEqual(nu.nombre, 6);
  assert.deepStrictEqual(nu.plateau, construit(4));
  assert.strictEqual(V.retirerToutes(nu.plateau).nombre, 0);
});

test('étape « Villes » : diagnostic « aucune place » (écart de 4 pas, ou aucune Plaine)', () => {
  // Plateau vierge : les 6 plaines du noyau seulement.
  const vierge = V.diagnostic(P.vierge(1), 'neutre');
  assert.strictEqual(vierge.cause, 'terrain');
  assert.match(vierge.message, /^Aucune place pour : ville neutre\. Le plateau n’a aucune Plaine libre hors du noyau/);
  // Un seul monobloc contre le noyau : sa plaine est trop près de la ville du centre.
  const petit = P.poser(P.vierge(1), 'F12A', 2, -1, 0).plateau, d = V.diagnostic(petit, 'vert');
  assert.strictEqual(d.cause, 'ecart');
  assert.match(d.message, /^Aucune place pour : ville de déploiement de vert\. 2 Plaines conviendraient, mais toutes sont trop près d’une autre ville : il faut 4 pas entre deux villes \(soit 3 cases entre elles\)/);
  assert.deepStrictEqual(V.places(petit, 'vert'), []);
});

test('pose automatique : les 6 villes au meilleur équilibre, sans tirage, plateau complet ; ce sont celles du générateur', () => {
  [1, 5, 9].forEach((graine) => {
    const plein = genere(graine), p = construit(graine), fige = JSON.stringify(p);
    const r = V.poserAuto(p);
    assert.ok(r.ok, r.raison);
    assert.strictEqual(JSON.stringify(p), fige, 'plateau reçu intact');
    assert.deepStrictEqual(r.plateau, plein, 'graine ' + graine + ' : même placement que « Générer »');
    assert.deepStrictEqual(V.poserAuto(r.plateau).plateau, r.plateau, 'les villes déjà posées sont d’abord retirées ; même résultat');
    const bilan = K.tout(r.plateau);
    assert.deepStrictEqual([bilan.erreurs, bilan.etape, bilan.equilibre.score], [0, 'complet', r.score]);
    assert.strictEqual(r.avantageTexte, bilan.equilibre.avantageTexte);
    assert.strictEqual(r.annonce, null);
    assert.match(V.texteEquilibre(r), /^score d’équilibre \d+ \(0 = équilibré ; (aucun camp avantagé|avantage )/);
  });
  // Sans noyau, ou sans assez de Plaines : refus expliqué.
  assert.match(V.poserAuto(P.vide(1)).raison, /noyau doit être posé/);
  const court = V.poserAuto(P.vierge(1));
  assert.deepStrictEqual([court.ok, court.manque], [false, 'places']);
  assert.match(court.raison, /^Pas assez de Plaines admissibles pour les 6 villes : 0 /);
  // Le départage à score égal est un réglage : « eloignement » (défaut) ou l'ordre des cases ; toujours sans tirage.
  assert.strictEqual(C.REGLAGES.villes.departage, 'eloignement');
  const ordre = V.poserAuto(construit(5), { departage: 'ordre' });
  assert.ok(ordre.ok);
  assert.strictEqual(ordre.score, V.poserAuto(construit(5)).score, 'même score, autre départage');
});

test('« Autre proposition » : placement suivant, du mieux équilibré au moins équilibré ; la suite fait le tour et revient au premier', () => {
  const p = construit(6), options = { propositionsMax: 4 };
  const un = V.autreProposition(p, options);
  assert.ok(un.ok, un.raison);
  assert.deepStrictEqual([un.rang, un.nombre, un.seule], [1, 4, false]);
  assert.deepStrictEqual(un.plateau, V.poserAuto(p).plateau, 'sans villes posées : la première proposition est la pose automatique');
  const vus = [P.serialiser(un.plateau)], scores = [un.score];
  let courant = un.plateau;
  for (let i = 2; i <= 4; i++) {
    const r = V.autreProposition(courant, options);
    assert.deepStrictEqual([r.ok, r.rang, r.nombre], [true, i, 4]);
    assert.deepStrictEqual([K.tout(r.plateau).erreurs, K.tout(r.plateau).etape], [0, 'complet']);
    vus.push(P.serialiser(r.plateau)); scores.push(r.score);
    courant = r.plateau;
  }
  assert.strictEqual(new Set(vus).size, 4, 'quatre placements différents');
  assert.deepStrictEqual(scores, scores.slice().sort((a, b) => a - b));
  assert.deepStrictEqual(V.autreProposition(courant, options).plateau, un.plateau, 'après le dernier, retour au premier');
  // Même plateau = même proposition (aucun tirage) ; des villes posées à la main : on repart de la première.
  assert.deepStrictEqual(V.autreProposition(un.plateau, options).plateau, V.autreProposition(un.plateau, options).plateau);
  const main = P.poserVille(p, 'vert', P.placesVille(p, 'vert')[0]).plateau;
  assert.strictEqual(V.autreProposition(main, options).rang, 1);
  assert.strictEqual(C.REGLAGES.villes.propositionsMax, 60);
});

// ------------------------------------------------------------------ 5. retouches, rendu, inventaire, table de jeu

test('retouche du terrain sous une ville : la ville part avec sa Plaine, et c’est annoncé ; la gomme retire d’abord la ville', () => {
  const p = genere(7), cases = P.cases(p), neutre = P.etatVilles(p).neutres[0].cle, vert = p.camps.vert[0];
  const sousNeutre = P.retirer(p, cases[neutre].piece);
  assert.ok(sousNeutre.ok);
  assert.ok(sousNeutre.villesRetirees.includes(neutre));
  assert.strictEqual(P.etatVilles(sousNeutre.plateau).neutres.length, 1);
  assert.match(VC.mentionVilles(p, sousNeutre.plateau), /La ville neutre a été retirée avec la Plaine qui la portait : à reposer à l’étape « Villes »\./);
  const sousVert = P.retirer(p, cases[vert].piece);
  assert.deepStrictEqual(sousVert.plateau.camps.vert, p.camps.vert.filter((k) => !sousVert.villesRetirees.includes(k)));
  assert.match(VC.mentionVilles(p, sousVert.plateau), /ville de déploiement de Vert a été retirée|villes ont été retirées/);
  assert.ok(P.lire(P.serialiser(sousVert.plateau)).ok, 'le plateau retouché se relit toujours');
  // Gomme : la ville d'abord, la tuile du dessous reste.
  const g = P.gommer(p, neutre);
  assert.deepStrictEqual([g.ok, g.ville, g.camp], [true, 'VNP', 'neutre']);
  assert.strictEqual(P.cases(g.plateau)[neutre].terrain, 'plaine');
  assert.deepStrictEqual([P.gommer(p, vert).ville, P.gommer(p, vert).camp], ['VD', 'vert']);
  // Un événement ne se pose pas sur une ville, neutre ou non.
  assert.match(P.poserEvenement(p, 'E5', neutre).raison, /jamais sur une ville\./);
});

test('rendu, inventaire et « reste à faire » : la ville neutre posée sur une Plaine se distingue ; 6 tuiles de ville posées par-dessus', () => {
  const p = genere(8), toutes = P.cases(p), etat = P.etatVilles(p);
  assert.strictEqual(R.typeTuile(toutes[etat.neutres[0].cle]), 'vn-plaine');
  assert.strictEqual(R.typeTuile(toutes[p.camps.vert[0]]), 'vd-vert');
  assert.strictEqual(R.typeTuile(toutes[p.camps.rouge[0]]), 'vd-rouge');
  assert.strictEqual(R.typeTuile(toutes['0,0']), null, 'la ville du noyau est une case ordinaire');
  assert.deepStrictEqual(Object.keys(R.numerosVilles(p)).length, 7);
  const roles = VI.parRole(p);
  assert.deepStrictEqual(roles.tuilesVilles, { total: 6, neutres: 2, poses: 6, restantes: 0 });
  assert.deepStrictEqual(roles.deploiements, { total: 4, parCamp: 2, poses: 4, restantes: 0, vert: 2, rouge: 2 });
  assert.strictEqual(roles.villes, 7);
  assert.ok(!roles.roles.some((r) => r.id === 'ville'), 'plus de rôle « villes neutres en tuiles » dans le catalogue imprimé');
  assert.deepStrictEqual(VI.parRole(construit(8)).tuilesVilles, { total: 6, neutres: 2, poses: 0, restantes: 6 });
  const reste = VC.resteAFaire(construit(8));
  assert.deepStrictEqual([reste.etape, reste.neutres.manquantes, reste.vert.manquantes, reste.rouge.manquantes], ['villes', 2, 2, 2]);
  assert.strictEqual(K.etape(construit(8)).message, 'Construction terminée, villes à poser : 2 villes neutres, 2 villes de déploiement pour Vert, 2 villes de déploiement pour Rouge.');
});

test('table de jeu : former sur une ville de déploiement ne donne aucun avertissement ; une ville neutre posée sur une Plaine se capture', () => {
  const p = genere(9), partie = T.creer({ graine: 9, plateau: pourPartie(p) }, env(9));
  assert.ok(partie.ok, partie.raison);
  assert.deepStrictEqual(T.avisPlateau ? T.avisPlateau(partie.etat.plateau) : [], []);
  const e = partie.etat, j = e.actif, E = env(9);
  E.alea.restaurer(copie(e.alea));
  const forme = T.former(e, { joueur: j, numero: 1, carte: e.paquets[j].main[0], cle: p.camps[j][0] }, E);
  assert.ok(forme.ok, forme.raison);
  assert.deepStrictEqual(forme.avertissements, [], 'former sur une ville de déploiement : c’est la règle, rien à signaler');
  // Sur une ville neutre : ce n'est pas une ville de déploiement (avertissement), mais elle se capture comme avant.
  const neutre = P.etatVilles(p).neutres[0].cle;
  const ailleurs = T.former(e, { joueur: j, numero: 1, carte: e.paquets[j].main[0], cle: neutre }, E);
  assert.strictEqual(ailleurs.ok, false);
  assert.ok(ailleurs.avertissements.some((a) => a.code === 'hors-deploiement'));
  const prise = T.capturerVille(forme.etat, { cle: neutre, proprietaire: j }, E);
  assert.ok(prise.ok, prise.raison);
  assert.strictEqual(prise.etat.villes[neutre], j);
  assert.ok(T.charger(T.serialiser(prise.etat), env(9)).ok);
});

test('règles précédentes dans la bibliothèque et le travail en cours : fiches à pièces VN et champ « profondeurExtremite » toujours lues', () => {
  const B = require('../src/bibliotheque.js');
  const ancien = P.lire(texteV3()).plateau;
  // Export de bibliothèque tel que l'atelier l'écrivait : le plateau porte ses pièces VN et sa profondeur de 3 rangées.
  const exportAncien = B.exporter(B.ajouter(B.vide(), 'Ancien à 3 rangées', ancien, '2026-11-19T18:00:00.000Z').liste).replace('"camps":', '"profondeurExtremite":3,"camps":');
  assert.match(exportAncien, /"profondeurExtremite":3/);
  assert.match(exportAncien, /"modele":"VN"/);
  const lu = B.lire(exportAncien);
  assert.ok(lu.ok, lu.raison);
  assert.deepStrictEqual(lu.liste.map((x) => x.nom), ['Ancien à 3 rangées']);
  const importe = B.importer(B.vide(), exportAncien);
  assert.ok(importe.ok, importe.raison);
  [lu.liste[0].plateau, importe.liste[0].plateau].forEach((fiche) => {
    const ouvert = P.valider(copie(fiche));
    assert.ok(ouvert.ok, ouvert.erreurs.join(' '));
    assert.deepStrictEqual(ouvert.plateau, ancien, 'le plateau rouvert est celui de la fiche, champ abandonné');
    assert.strictEqual(K.tout(ouvert.plateau).erreurs, 0);
    // Rouvert puis remis dans une fiche : identique, donc jamais « (modifié) » à l'ouverture.
    assert.deepStrictEqual(B.ajouter(B.vide(), 'x', ouvert.plateau, '2026-11-20T10:00:00.000Z').liste[0].plateau, P.valider(copie(fiche)).plateau);
  });
  assert.ok(!/profondeurExtremite/.test(B.exporter(importe.liste)), 'réexportée, la bibliothèque n’écrit plus le champ');
  // Travail en cours sauvegardé par l'atelier d'avant.
  const stockage = B.stockageMemoire();
  assert.ok(B.enregistrerTravail(stockage, ancien, '2026-11-19T18:00:00.000Z', null).ok);
  const cle = C.REGLAGES.bibliotheque.prefixe + 'travail';
  assert.ok(typeof stockage.getItem(cle) === 'string');
  stockage.setItem(cle, stockage.getItem(cle).replace('"camps":', '"profondeurExtremite":3,"camps":'));
  assert.match(stockage.getItem(cle), /"profondeurExtremite":3/);
  const travail = B.chargerTravail(stockage);
  assert.ok(travail.ok, travail.raison);
  assert.deepStrictEqual(P.valider(copie(travail.plateau)).plateau, ancien);
});
