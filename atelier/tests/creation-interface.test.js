'use strict';
// Lot E : logique pure de l'interface de création à la main (docs/02-atelier-cahier-des-charges.md, §8.2).
// Création guidée (essai de pose, palette, « reste à faire »), trait de pinceau, éditeur de monoblocs (recentrage),
// inventaire (hors catalogue, restantes), bibliothèque (résumé, dates, noms), paramètres d'adresse.
// Le DOM, les événements pointeur et le stockage réel sont vérifiés dans un vrai navigateur par outils/recette.html.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/plateau.js');
const K = require('../src/controles.js');
const G = require('../src/generateur.js');
const R = require('../src/rendu.js');
const A = require('../src/app.js');
const VP = require('../src/vue-plateau.js');
const VC = require('../src/vue-creation.js');
const VM = require('../src/vue-monoblocs.js');
const VB = require('../src/vue-bibliotheque.js');
const VI = require('../src/vue-inventaire.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue;

const CRETE = () => ({ nom: 'Crête', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'montagne' }, { q: 1, r: 0, terrain: 'foret' }, { q: 1, r: 1, terrain: 'plaine' }] });
const pose = (pl, modele, q, r, rot, options) => { const x = P.poser(pl, modele, q, r, rot || 0, options); assert.ok(x.ok, x.raison); return x.plateau; };
const genere = () => P.avecCamps(G.generer(1).plateau);

// ------------------------------------------------------------------ création guidée

test('essaiPose : possible sur des cases libres, refusé avec raison sur un chevauchement ou un stock épuisé, sans rien changer', () => {
  const pl = P.vierge(1), fige = JSON.stringify(pl);
  const ok = VC.essaiPose(pl, 'M4', 3, 0, 1);
  assert.strictEqual(ok.ok, true);
  assert.deepStrictEqual(ok.cles, P.casesModele('M4', 3, 0, 1).map((c) => c.cle));
  assert.strictEqual(ok.plateau.pieces.length, 2);
  const chevauche = VC.essaiPose(pl, 'M5', 0, 0, 0);
  assert.strictEqual(chevauche.ok, false);
  assert.match(chevauche.raison, /Chevauchement/);
  assert.strictEqual(chevauche.cles.length, 5, 'les cases visées sont rendues même en cas de refus (aperçu rouge)');
  assert.strictEqual(chevauche.plateau, pl);
  const epuise = VC.essaiPose(pl, 'N1', 5, 5, 0);
  assert.strictEqual(epuise.ok, false);
  assert.match(epuise.raison, /Stock épuisé/);
  assert.strictEqual(VC.essaiPose(pl, 'inconnu', 3, 3, 0).ok, false);
  assert.deepStrictEqual(VC.essaiPose(pl, 'inconnu', 3, 3, 0).cles, []);
  assert.strictEqual(JSON.stringify(pl), fige);
});

test('essaiPose avec « sauf » : une pièce déplacée ne se gêne pas elle-même et ne compte pas contre le stock', () => {
  const pl = pose(P.vierge(1), 'M4', 3, 0, 0), id = pl.pieces[1].id;
  // Décalée d'une case : elle recouvre ses propres cases, ce qui est permis.
  assert.strictEqual(VC.essaiPose(pl, 'M4', 4, 0, 0, id).ok, true);
  assert.strictEqual(VC.essaiPose(pl, 'M4', 4, 0, 0).ok, false, 'sans « sauf », le stock est épuisé');
  assert.match(VC.essaiPose(pl, 'M4', 0, 0, 0, id).raison, /Chevauchement/);
  assert.strictEqual(VC.essaiPose(pl, 'M4', 4, 0, 0, 'absente').ok, false);
  // Tuile hors stock (montagne d'une case du pinceau).
  const hors = P.peindre(pl, '5,0', 'montagne').plateau, m1 = hors.pieces.filter((p) => p.modele === 'M1')[0].id;
  assert.strictEqual(VC.essaiPose(hors, 'M1', 6, 0, 0, m1).ok, true);
});

test('correction : « Déplacer » une tuile posée hors stock est accepté, le compte des pièces ne change pas', () => {
  let pl = P.vierge(1);
  pl = P.peindre(pl, '5,0', 'montagne').plateau;
  for (let i = 0; i < 6; i++) pl = P.peindre(pl, (i - 3) + ',-3', 'foret').plateau;      // 5 forêts du stock + 1 hors stock
  const m1 = pl.pieces.filter((p) => p.modele === 'M1')[0], foret = pl.pieces.filter((p) => p.modele === 'F')[0];
  const a = VP.deplacerPiece(pl, m1.id, 5, 1);
  assert.ok(a.ok, a.raison);
  assert.ok(P.cases(a.plateau)['5,1'] && P.cases(a.plateau)['5,1'].modele === 'M1' && !P.cases(a.plateau)['5,0']);
  const b = VP.deplacerPiece(pl, foret.id, 0, 4);
  assert.ok(b.ok, b.raison);
  assert.strictEqual(P.stock(b.plateau).F.poses, 6);
  assert.strictEqual(b.plateau.pieces.length, pl.pieces.length);
  // Un déplacement vers une case occupée reste refusé, le plateau reçu est rendu.
  const c = VP.deplacerPiece(pl, m1.id, 0, 0);
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.plateau, pl);
});

test('palette : catalogue imprimé puis pièces personnelles, jamais la montagne d’une case, stock restant jamais négatif', () => {
  let pl = P.ajouterModele(P.vierge(1), CRETE()).plateau;
  const p0 = VC.palette(pl);
  assert.deepStrictEqual(p0.map((x) => x.id), C.ORDRE_MODELES.concat(['X1']));
  assert.ok(!p0.some((x) => x.id === 'M1'));
  assert.deepStrictEqual(p0.filter((x) => x.id === 'N1')[0], { id: 'N1', nom: 'Noyau', cases: 7, total: 1, poses: 1, restant: 0, perso: false });
  assert.deepStrictEqual(p0.filter((x) => x.id === 'X1')[0], { id: 'X1', nom: 'Crête', cases: 3, total: 2, poses: 0, restant: 2, perso: true });
  for (let i = 0; i < 7; i++) pl = P.peindre(pl, (i - 3) + ',-3', 'foret').plateau;
  assert.strictEqual(VC.palette(pl).filter((x) => x.id === 'F')[0].restant, 0, '7 forêts posées pour 5 : restant 0, pas -2');
  assert.strictEqual(VC.palette(pl).filter((x) => x.id === 'F')[0].poses, 7);
});

test('resteAFaire : plateau vierge, plateau en cours, plateau généré terminé', () => {
  const vierge = P.vierge(1), r0 = VC.resteAFaire(vierge, K.tout(vierge));
  assert.strictEqual(r0.nbPieces, 63);
  assert.deepStrictEqual(r0.pieces.filter((x) => x.id === 'P')[0], { id: 'P', nom: 'Plaine', restant: 39 });
  assert.ok(!r0.pieces.some((x) => x.id === 'N1'));
  assert.deepStrictEqual(r0.villes, { posees: 1, voulues: 7, manquantes: 6, enTrop: 0 });
  assert.deepStrictEqual(r0.haut, { posees: 0, voulues: 2, manquantes: 2, enTrop: 0 });
  assert.deepStrictEqual(r0.bas, { posees: 0, voulues: 2, manquantes: 2, enTrop: 0 });
  assert.ok(r0.erreurs.length > 0 && r0.erreurs.every((m) => typeof m === 'string'));
  assert.strictEqual(r0.termine, false);

  let pl = P.ajouterModele(vierge, CRETE()).plateau;
  pl = pose(pose(pose(pl, 'V', -1, -3), 'V', 2, -3), 'V', 0, -3);
  pl = P.avecCamps(pose(pl, 'V', 1, 3));
  const r1 = VC.resteAFaire(pl);
  assert.deepStrictEqual(r1.haut, { posees: 3, voulues: 2, manquantes: 0, enTrop: 1 }, '3 villes sur la rangée du haut : une en trop');
  assert.deepStrictEqual(r1.bas, { posees: 1, voulues: 2, manquantes: 1, enTrop: 0 });
  assert.strictEqual(r1.villes.posees, 5);
  assert.deepStrictEqual(r1.persos, [{ id: 'X1', nom: 'Crête', restant: 2 }]);
  assert.strictEqual(r1.nbPersos, 2);
  assert.deepStrictEqual(r1.erreurs, [], 'sans bilan, pas de liste d’erreurs');

  const fini = genere(), r2 = VC.resteAFaire(fini, K.tout(fini));
  assert.strictEqual(r2.nbPieces, 0);
  assert.strictEqual(r2.villes.manquantes + r2.haut.manquantes + r2.bas.manquantes, 0);
  assert.strictEqual(r2.termine, true);
});

test('correction : pièces de modèle inconnu comptées, et retirées sans toucher au reste', () => {
  const pl = pose(P.vierge(1), 'P', 3, 0);
  const orphelin = JSON.parse(JSON.stringify(pl));
  orphelin.pieces.push({ id: 'p90', modele: 'X7', q: 4, r: 0, rotation: 0 }, { id: 'p91', modele: 'constructor', q: 5, r: 0, rotation: 0 });
  assert.deepStrictEqual(VC.piecesInconnues(orphelin), ['p90', 'p91']);
  assert.strictEqual(VC.resteAFaire(orphelin).inconnues, 2);
  assert.strictEqual(VC.resteAFaire(orphelin).termine, false);
  assert.doesNotThrow(() => VC.palette(orphelin));
  const propre = VC.sansPiecesInconnues(orphelin);
  assert.deepStrictEqual(propre.pieces, pl.pieces);
  assert.deepStrictEqual(VC.piecesInconnues(pl), []);
  assert.strictEqual(VC.sansPiecesInconnues(pl), pl);
});

test('rendu.casesGrille : cases vides du disque de rayon 7 (169 cases moins celles du plateau)', () => {
  assert.strictEqual(R.casesGrille(P.vide(1), 7).length, 169);
  const grille = R.casesGrille(P.vierge(1), 7);
  assert.strictEqual(grille.length, 162);
  assert.ok(!grille.includes('0,0') && !grille.includes('1,-1') && grille.includes('7,-7') && grille.includes('2,0'));
  const loin = pose(P.vierge(1), 'P', 9, 0);
  assert.strictEqual(R.casesGrille(loin, 7).length, 162, 'une tuile hors du rayon ne retire aucune case de la grille');
});

// ------------------------------------------------------------------ trait de pinceau

test('trait de pinceau : plusieurs cases, plateau de départ intact, une case visitée deux fois ne compte qu’une fois', () => {
  const depart = P.vierge(1), fige = JSON.stringify(depart);
  const trait = VC.tracer(depart, { type: 'terrain', terrain: 'foret' }, ['2,-2', '3,-2', '3,-2', '4,-2']);
  assert.strictEqual(trait.cases, 3);
  assert.strictEqual(trait.changees, 3);
  assert.strictEqual(trait.plateau.pieces.length, 4);
  assert.strictEqual(JSON.stringify(depart), fige);
  assert.strictEqual(trait.depart, depart);
  const b = VC.bilanTrait(trait);
  assert.strictEqual(b.change, true);
  assert.strictEqual(b.niveau, 'info');
  assert.match(b.message, /^3 cases peintes en forêt\.$/);
  assert.strictEqual(b.confirmer, null);
  assert.deepStrictEqual(b.plateau.camps, P.campsAuto(b.plateau), 'les camps sont recalculés une fois, à la fin');
});

test('trait de pinceau : hors stock annoncé, villes de déploiement recalculées en fin de trait', () => {
  const sept = ['-3,-3', '-2,-3', '-1,-3', '0,-3', '1,-3', '2,-3', '3,-3'];
  const b = VC.bilanTrait(VC.tracer(P.vierge(1), { type: 'terrain', terrain: 'foret' }, sept));
  assert.match(b.message, /7 cases peintes en forêt\. 2 tuiles posées hors stock : à prévoir en plus du catalogue\./);
  assert.strictEqual(b.niveau, 'alerte');
  const m = VC.bilanTrait(VC.tracer(P.vierge(1), { type: 'terrain', terrain: 'montagne' }, ['3,0']));
  assert.match(m.message, /1 case peinte en montagne\. 1 tuile posée hors stock/);
  const v = VC.bilanTrait(VC.tracer(P.vierge(1), { type: 'terrain', terrain: 'ville' }, ['-1,-3', '2,-3']));
  assert.deepStrictEqual(v.plateau.camps.vert, ['-1,-3', '2,-3']);
});

test('trait de pinceau : noyau et monobloc laissés, avec explication ; rien à changer ; outil invalide', () => {
  const pl = pose(P.vierge(1), 'F3', 3, 0);
  const a = VC.bilanTrait(VC.tracer(pl, { type: 'terrain', terrain: 'marais' }, ['-2,0', '-1,0', '0,0', '1,0', '2,0', '3,0']));
  assert.strictEqual(a.change, true);
  assert.strictEqual(a.niveau, 'alerte');
  assert.match(a.message, /2 cases peintes en marais\./);
  assert.match(a.message, /ne modifie pas le noyau ni le monobloc « Bois » \(4 cases laissées\)/);
  const noyau = VC.bilanTrait(VC.tracer(pl, { type: 'terrain', terrain: 'plaine' }, ['0,0']));
  assert.strictEqual(noyau.change, false);
  assert.strictEqual(noyau.niveau, 'erreur');
  assert.strictEqual(noyau.plateau, pl);
  assert.match(noyau.message, /ne modifie pas le noyau \(1 case laissée\)/);
  assert.strictEqual(noyau.confirmer, null, 'le pinceau ne propose jamais de retirer un monobloc');
  const peint = VC.tracer(pl, { type: 'terrain', terrain: 'foret' }, ['4,-2']).plateau;
  const meme = VC.bilanTrait(VC.tracer(peint, { type: 'terrain', terrain: 'foret' }, ['4,-2']));
  assert.strictEqual(meme.change, false);
  assert.match(meme.message, /déjà ce terrain/);
  assert.strictEqual(VC.outilValide({ type: 'terrain', terrain: 'boue' }), false);
  assert.strictEqual(VC.outilValide({ type: 'gomme' }), true);
  assert.strictEqual(VC.tracer(pl, { type: 'terrain', terrain: 'boue' }, ['4,4']).changees, 0);
  assert.strictEqual(VC.tracer(pl, { type: 'terrain', terrain: 'plaine' }, ['99,99', 'x']).changees, 0);
});

test('gomme : tuiles d’une case retirées ; monobloc seulement après confirmation, sur un trait d’une case', () => {
  let pl = pose(P.vierge(1), 'F3', 3, 0);
  pl = VC.tracer(pl, { type: 'terrain', terrain: 'plaine' }, ['-2,0', '-3,0']).plateau;
  const glisse = VC.bilanTrait(VC.tracer(pl, { type: 'gomme' }, ['-3,0', '-2,0', '-1,0', '6,6']));
  assert.strictEqual(glisse.change, true);
  assert.match(glisse.message, /2 tuiles gommées\./);
  assert.match(glisse.message, /1 case laissée : la gomme ne retire un monobloc \(ou le noyau\) qu’après confirmation/);
  assert.strictEqual(glisse.confirmer, null, 'jamais de confirmation au milieu d’un trait');
  assert.strictEqual(glisse.plateau.pieces.length, 2);
  const seul = VC.bilanTrait(VC.tracer(pl, { type: 'gomme' }, ['4,0']));
  assert.strictEqual(seul.change, false);
  assert.strictEqual(seul.plateau, pl);
  assert.ok(seul.confirmer && seul.confirmer.nom === 'Bois' && seul.confirmer.noyau === false);
  assert.deepStrictEqual(seul.confirmer.cases.slice().sort(), ['3,0', '3,1', '4,0']);
  assert.strictEqual(seul.confirmer.piece, pl.pieces[1].id);
  const coeur = VC.bilanTrait(VC.tracer(pl, { type: 'gomme' }, ['0,0']));
  assert.ok(coeur.confirmer && coeur.confirmer.noyau === true && coeur.confirmer.cases.length === 7);
  const vide = VC.bilanTrait(VC.tracer(pl, { type: 'gomme' }, ['6,6']));
  assert.strictEqual(vide.change, false);
  assert.match(vide.message, /rien à gommer/);
  assert.strictEqual(vide.niveau, 'info');
});

// ------------------------------------------------------------------ éditeur de monoblocs

test('recentrer : la forme contient (0,0) ; ancre = première case dans l’ordre de lecture ; forme déjà centrée gardée telle quelle', () => {
  const forme = [{ q: 2, r: 2, terrain: 'montagne' }, { q: 1, r: 1, terrain: 'foret' }, { q: 2, r: 1, terrain: 'foret' }];
  const fige = JSON.stringify(forme);
  assert.deepStrictEqual(VM.recentrer(forme), [{ q: 0, r: 0, terrain: 'foret' }, { q: 1, r: 0, terrain: 'foret' }, { q: 1, r: 1, terrain: 'montagne' }]);
  assert.strictEqual(JSON.stringify(forme), fige, 'la liste reçue n’est pas modifiée');
  const centree = [{ q: 1, r: 0, terrain: 'plaine' }, { q: 0, r: 0, terrain: 'marais' }];
  assert.deepStrictEqual(VM.recentrer(centree), centree);
  assert.notStrictEqual(VM.recentrer(centree), centree);
  assert.deepStrictEqual(VM.recentrer([]), []);
  assert.deepStrictEqual(VM.recentrer(undefined), []);
  assert.deepStrictEqual(VM.recentrer([{ q: -3, r: 2, terrain: 'plaine' }]), [{ q: 0, r: 0, terrain: 'plaine' }]);
});

test('recentrer : sur toutes les formes d’un seul tenant de 2 à 4 cases de la grille, le résultat est valide et de même forme', () => {
  const grille = H.disque(VM.RAYON_EDITEUR).filter((k) => k !== '0,0' && H.distance(k, '0,0') >= 2);
  let essais = 0;
  for (const depart of grille) {
    // Chemin en zigzag de 2, 3 puis 4 cases à partir de la case de départ, sans jamais passer par (0,0).
    const cles = [depart];
    for (const dir of [0, 5, 0]) {
      const p = H.decle(cles[cles.length - 1]), suivant = H.cle(p.q + H.DIRS[dir].q, p.r + H.DIRS[dir].r);
      cles.push(suivant);
      if (cles.includes('0,0')) break;
      const cases = cles.map((k) => ({ q: H.decle(k).q, r: H.decle(k).r, terrain: 'plaine' }));
      const centre = VM.recentrer(cases);
      const avis = P.validerModele({ id: 'X1', nom: 'essai', cases: centre, quantite: 1 });
      assert.ok(avis.ok, depart + ' : ' + avis.erreurs[0]);
      assert.ok(centre.some((c) => c.q === 0 && c.r === 0));
      // Même forme : mêmes écarts entre les cases, à une translation près.
      const dq = centre[0].q - cases.slice().sort((a, b) => a.r - b.r || a.q - b.q)[0].q;
      const dr = centre[0].r - cases.slice().sort((a, b) => a.r - b.r || a.q - b.q)[0].r;
      assert.deepStrictEqual(centre.map((c) => H.cle(c.q - dq, c.r - dr)).sort(), cles.slice().sort());
      essais += 1;
    }
  }
  assert.ok(essais > 60, essais + ' formes essayées');
});

test('centrerDansGrille : une pièce dont l’ancre est au bout tient dans la grille de l’éditeur', () => {
  const ligne = [0, 1, 2, 3, 4, 5].map((q) => ({ q, r: 0, terrain: 'plaine' }));
  const dans = VM.centrerDansGrille(ligne, VM.RAYON_EDITEUR);
  assert.strictEqual(dans.length, 6);
  assert.ok(dans.every((c) => H.distance({ q: c.q, r: c.r }, { q: 0, r: 0 }) <= VM.RAYON_EDITEUR), JSON.stringify(dans));
  assert.deepStrictEqual(dans.map((c) => c.q - dans[0].q), [0, 1, 2, 3, 4, 5], 'la forme est gardée');
  assert.ok(P.validerModele({ id: 'X1', nom: 'ligne', cases: VM.recentrer(dans), quantite: 1 }).ok);
  assert.deepStrictEqual(VM.centrerDansGrille([], 3), []);
  // Toutes les pièces du catalogue tiennent dans la grille.
  for (const id of C.ORDRE_MODELES) {
    const m = VM.centrerDansGrille(C.MODELES[id].cases, VM.RAYON_EDITEUR);
    assert.ok(m.every((c) => H.distance({ q: c.q, r: c.r }, { q: 0, r: 0 }) <= VM.RAYON_EDITEUR), id);
  }
});

test('basculer : ajouter, changer de terrain, retirer ; la liste reçue n’est pas modifiée', () => {
  const vide = [];
  const un = VM.basculer(vide, 1, 1, 'foret');
  assert.deepStrictEqual(un, [{ q: 1, r: 1, terrain: 'foret' }]);
  assert.deepStrictEqual(vide, []);
  const deux = VM.basculer(un, 2, 1, 'foret');
  const change = VM.basculer(deux, 1, 1, 'marais');
  assert.deepStrictEqual(change, [{ q: 1, r: 1, terrain: 'marais' }, { q: 2, r: 1, terrain: 'foret' }]);
  assert.strictEqual(deux[0].terrain, 'foret');
  assert.deepStrictEqual(VM.basculer(change, 1, 1, 'marais'), [{ q: 2, r: 1, terrain: 'foret' }]);
});

test('avis de l’éditeur : messages en clair, liste vide pour une pièce valide', () => {
  const def = (nom, quantite, cases) => VM.definition(nom, quantite, cases);
  assert.match(VM.avis(def('x', 1, []))[0], /cliquez 2 à 6 cases voisines/);
  assert.match(VM.avis(def('x', 1, [{ q: 1, r: 1, terrain: 'foret' }]))[0], /Ajoutez au moins une case voisine/);
  const duo = [{ q: 1, r: 1, terrain: 'foret' }, { q: 2, r: 1, terrain: 'plaine' }];
  assert.deepStrictEqual(VM.avis(def('  Duo  ', '2', duo)), []);
  assert.deepStrictEqual(def('  Duo  ', '2', duo), { nom: 'Duo', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'foret' }, { q: 1, r: 0, terrain: 'plaine' }] });
  assert.ok(VM.avis(def('', 1, duo)).some((m) => /Donnez un nom/.test(m)));
  assert.ok(VM.avis(def('x', 0, duo)).some((m) => /Quantité : un nombre entier de 1 à 9/.test(m)));
  assert.ok(VM.avis(def('x', 'beaucoup', duo)).some((m) => /Quantité/.test(m)));
  assert.ok(VM.avis(def('x', 10, duo)).some((m) => /Quantité/.test(m)));
  const separees = [{ q: 0, r: 0, terrain: 'foret' }, { q: 2, r: 0, terrain: 'foret' }];
  assert.deepStrictEqual(VM.avis(def('x', 1, separees)), ['Les cases doivent se toucher : la pièce est en plusieurs morceaux.']);
  const sept = [0, 1, 2, 3, 4, 5, 6].map((q) => ({ q: q - 3, r: 0, terrain: 'plaine' }));
  assert.match(VM.avis(def('x', 1, sept))[0], /Trop de cases : 7 pour 6 au plus\. Retirez-en 1\./);
  assert.match(VM.avis(def('x', 1, [{ q: 0, r: 0, terrain: 'ville' }, { q: 1, r: 0, terrain: 'plaine' }]))[0], /Jamais de ville dans un monobloc/);
  assert.ok(VM.avis(def('x'.repeat(41), 1, duo)).some((m) => /Nom invalide/.test(m)));
  assert.strictEqual(VM.contenu(def('x', 1, duo).cases), '2 cases : 1 × forêt, 1 × plaine');
  // Toute définition sans avis est acceptée par le modèle.
  assert.ok(P.ajouterModele(P.vierge(1), def('Duo', 2, duo)).ok);
});

test('plateau.modifierModele : pièce posée, le nom et la quantité se changent tant que la quantité couvre les exemplaires posés', () => {
  let pl = P.ajouterModele(P.vierge(5), CRETE()).plateau;
  pl = pose(pose(pl, 'X1', 3, 0), 'X1', -4, 0);
  const fige = JSON.stringify(pl);
  const nom = P.modifierModele(pl, 'X1', { nom: 'Grande crête', quantite: 4 });
  assert.ok(nom.ok, nom.raison);
  assert.deepStrictEqual(nom.plateau.modeles[0], { id: 'X1', nom: 'Grande crête', cases: CRETE().cases, quantite: 4 });
  assert.strictEqual(nom.plateau.pieces.length, 3);
  assert.strictEqual(JSON.stringify(pl), fige);
  assert.ok(P.modifierModele(pl, 'X1', { quantite: 2 }).ok, 'quantité égale au nombre d’exemplaires posés : permise');
  const trop = P.modifierModele(pl, 'X1', { quantite: 1 });
  assert.strictEqual(trop.ok, false);
  assert.strictEqual(trop.plateau, pl);
  assert.match(trop.raison, /Quantité refusée : 2 exemplaires de « Crête » sont posés sur le plateau ; la quantité ne peut pas descendre en dessous\./);
  assert.strictEqual(trop.pieces.length, 2);
  const forme = P.modifierModele(pl, 'X1', { cases: [{ q: 0, r: 0, terrain: 'marais' }, { q: 0, r: 1, terrain: 'marais' }] });
  assert.strictEqual(forme.ok, false);
  assert.match(forme.raison, /Modification de la forme refusée : 2 exemplaires de « Crête » sont posés sur le plateau\. Retirez-les d’abord\./);
  const terrain = P.modifierModele(pl, 'X1', { cases: CRETE().cases.map((c, i) => (i ? c : { q: 0, r: 0, terrain: 'plaine' })) });
  assert.strictEqual(terrain.ok, false, 'changer un terrain d’une pièce posée est refusé aussi');
  assert.ok(P.modifierModele(pl, 'X1', { nom: 'Même forme', cases: CRETE().cases }).ok, 'les mêmes cases redonnées ne sont pas un changement de forme');
  assert.strictEqual(P.modifierModele(pl, 'X1', { quantite: 12 }).ok, false, 'les bornes restent celles de validerModele');
  assert.strictEqual(P.modifierModele(pl, 'X1', { nom: '' }).ok, false);
  assert.ok(P.valider(JSON.parse(P.serialiser(nom.plateau))).ok);
});

// ------------------------------------------------------------------ inventaire

test('inventaire : totaux du catalogue imprimé inchangés, restantes jamais négatives, hors catalogue et pièces personnelles à part', () => {
  const plein = genere(), b0 = VI.bilan(plein);
  assert.strictEqual(b0.lignes.length, 13);
  assert.deepStrictEqual([b0.poses, b0.casesPosees, b0.restantes], [64, 91, 0]);
  assert.deepStrictEqual(b0.horsCatalogue, { pieces: 0, cases: 0, detail: [] });
  assert.deepStrictEqual(b0.persos, []);

  let pl = P.ajouterModele(P.vierge(1), CRETE()).plateau;
  pl = pose(pl, 'X1', 3, 0);
  pl = P.peindre(pl, '0,3', 'montagne').plateau;
  for (let i = 0; i < 7; i++) pl = P.peindre(pl, (i - 3) + ',-3', 'foret').plateau;
  const b = VI.bilan(pl);
  assert.deepStrictEqual(b.lignes.filter((x) => x.id === 'F')[0], { id: 'F', nom: 'Forêt', cases: 1, total: 5, poses: 5, restantes: 0, enPlus: 2 });
  assert.deepStrictEqual([b.poses, b.casesPosees, b.restantes], [6, 12, 58], 'noyau + 5 forêts ; 64 − 6 = 58 restantes');
  assert.strictEqual(b.poses + b.restantes, C.totaux().pieces);
  assert.deepStrictEqual(b.horsCatalogue, { pieces: 3, cases: 3, detail: [{ id: 'F', nom: 'Forêt', nombre: 2 }, { id: 'M1', nom: 'Montagne d’une case', nombre: 1 }] });
  assert.deepStrictEqual(b.persos, [{ id: 'X1', nom: 'Crête', cases: 3, total: 2, poses: 1, restantes: 1, enPlus: 0 }]);
  assert.ok(b.lignes.every((x) => x.restantes >= 0 && x.poses <= x.total));
  assert.ok(!b.lignes.some((x) => x.id === 'M1' || x.id === 'X1'));
  assert.deepStrictEqual(C.totaux().pieces, 64);
  assert.deepStrictEqual(C.totaux().cases, 91);
});

// ------------------------------------------------------------------ bibliothèque (vue)

test('bibliothèque : résumé d’une fiche, date lisible, nom proposé, plateaux identiques', () => {
  const plein = genere();
  assert.deepStrictEqual(VB.resume(plein), { cases: 91, pieces: 64, villes: 7, erreurs: K.tout(plein).erreurs, alertes: K.tout(plein).alertes });
  assert.strictEqual(VB.texteResume({ cases: 91, pieces: 64, villes: 7, erreurs: 0, alertes: 0 }), '91 cases, 64 pièces, 7 villes ; aucune erreur, aucune alerte');
  assert.strictEqual(VB.texteResume({ cases: 1, pieces: 1, villes: 1, erreurs: 1, alertes: 2 }), '1 case, 1 pièce, 1 ville ; 1 erreur, 2 alertes');
  assert.strictEqual(VB.texteResume({ cases: 0, pieces: 0, villes: 0, erreurs: 3, alertes: 0 }), 'aucune case, aucune pièce, aucune ville ; 3 erreurs, aucune alerte');
  const vierge = VB.resume(P.vierge(1));
  assert.deepStrictEqual([vierge.cases, vierge.pieces, vierge.villes], [7, 1, 1]);
  assert.ok(vierge.erreurs > 0);
  assert.match(VB.dateLisible('2026-11-19T12:05:09.000Z'), /^\d\d\/11\/2026 à \d\d:05$/);
  assert.strictEqual(VB.dateLisible('pas une date'), '');
  assert.strictEqual(VB.dateLisible(undefined), '');
  assert.strictEqual(VB.nomLibre([]), 'Plateau 1');
  assert.strictEqual(VB.nomLibre([{ nom: 'Plateau 1' }, { nom: 'plateau 2' }, { nom: 'Autre' }]), 'Plateau 3');
  assert.strictEqual(VB.nomLibre(null), 'Plateau 1');
  assert.strictEqual(VB.memePlateau(plein, JSON.parse(JSON.stringify(plein))), true);
  assert.strictEqual(VB.memePlateau(plein, P.vierge(1)), false);
});

// ------------------------------------------------------------------ paramètres d'adresse

test('app : paramètre d’adresse « mode » (modes de l’onglet Plateau)', () => {
  assert.strictEqual(A.lireParametres('#mode=pinceau').mode, 'pinceau');
  assert.strictEqual(A.lireParametres('#onglet=plateau&mode=bibliotheque&graine=3').mode, 'bibliotheque');
  assert.strictEqual(A.lireParametres('#mode=pirate').mode, null);
  assert.strictEqual(A.lireParametres('#mode=__proto__').mode, null);
  assert.deepStrictEqual(VP.MODES.map((m) => m.id), ['generer', 'creer', 'pinceau', 'monoblocs', 'bibliotheque']);
  for (const m of VP.MODES) assert.strictEqual(A.lireParametres('#mode=' + m.id).mode, m.id);
});
