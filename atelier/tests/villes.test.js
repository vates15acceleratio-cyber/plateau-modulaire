'use strict';
// Phase « villes » du catalogue 2 (§9.1, B3 à B6) : fonctions pures de AT.plateau, refus expliqués, fichier.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, K = AT.controles, T = AT.partie;

const MODELE = (() => { const r = G.generer(7); if (!r.ok) throw new Error(r.raison); return JSON.stringify(r.plateau); })();
const complet = () => JSON.parse(MODELE);
/** Terrain construit, aucune ville posée. */
function construit() {
  let p = complet();
  P.etatVilles(p).neutres.forEach((n) => { p = P.retirerVilleNeutre(p, n.cle).plateau; });
  P.deploiements(p).forEach((d) => { p = P.retirerVilleDeploiement(p, d.cle).plateau; });
  return p;
}

test('plateau construit sans villes : ni champ « deploiements », ni camps, étape des villes', () => {
  const p = construit();
  assert.ok(!('deploiements' in p), 'forme canonique : champ absent quand il n’y a aucune ville de déploiement');
  assert.deepStrictEqual(p.camps, { vert: [], rouge: [] });
  assert.deepStrictEqual(P.deploiements(p), []);
  assert.deepStrictEqual(P.villes(p), ['0,0']);
  const etat = P.etatVilles(p);
  assert.deepStrictEqual([etat.vert, etat.rouge, etat.neutres], [[], [], []]);
  assert.deepStrictEqual(etat.manquantes, { vert: 2, rouge: 2, neutres: 2 });
  assert.strictEqual(etat.completes, false);
  assert.strictEqual(P.etatVilles(complet()).completes, true);
  assert.ok(P.lire(P.serialiser(p)).ok);
});

test('placesDeploiement : des Plaines du bord, dans les 2 rangées extrêmes, hors noyau, à 4 pas du centre', () => {
  const p = construit(), terrain = P.cases(p), e = P.etendueSurCases(terrain);
  const vert = P.placesDeploiement(p, 'vert'), rouge = P.placesDeploiement(p, 'rouge');
  assert.ok(vert.length >= 2 && rouge.length >= 2);
  assert.deepStrictEqual(vert, H.trier(vert));
  const centre = P.distancesPas(p, '0,0');
  vert.forEach((k) => {
    assert.strictEqual(terrain[k].terrain, 'plaine');
    assert.ok(H.decle(k).r <= e.haut + 1);
    assert.ok(H.voisines(k).some((v) => !terrain[v]));
    assert.ok(centre[k] >= 4);
    assert.deepStrictEqual(P.peutPoserVilleDeploiement(p, 'vert', k), { ok: true });
  });
  rouge.forEach((k) => assert.ok(H.decle(k).r >= e.bas - 1));
  assert.strictEqual(vert.some((k) => rouge.includes(k)), false);
  // La profondeur des extrémités est un réglage : plus de rangées, au moins autant de places.
  assert.ok(P.placesDeploiement(p, 'vert', { profondeurExtremite: 1 }).length <= vert.length);
  assert.ok(P.placesDeploiement(p, 'vert', { profondeurExtremite: 3 }).length >= vert.length);
  assert.deepStrictEqual(P.placesDeploiement(p, 'bleu'), []);
  assert.deepStrictEqual(P.placesDeploiement(complet(), 'vert'), [], 'un camp qui a ses 2 villes n’a plus de place à proposer');
});

test('poserVilleDeploiement : tuile posée par-dessus une Plaine, propriétaire, camps tenus à jour', () => {
  const p = construit(), fige = JSON.stringify(p);
  const k = P.placesDeploiement(p, 'vert')[0];
  const r = P.poserVilleDeploiement(p, 'vert', k);
  assert.ok(r.ok, r.raison);
  assert.strictEqual(JSON.stringify(p), fige, 'plateau reçu intact');
  assert.deepStrictEqual([r.camp, r.cle], ['vert', k]);
  assert.deepStrictEqual(r.plateau.deploiements, [{ cle: k, camp: 'vert' }]);
  assert.deepStrictEqual(r.plateau.camps, { vert: [k], rouge: [] });
  assert.deepStrictEqual(r.plateau.pieces, p.pieces, 'aucune pièce ajoutée : la tuile du dessous reste en place');
  const c = P.cases(r.plateau)[k], avant = P.cases(p)[k];
  assert.deepStrictEqual(c, { terrain: 'ville', piece: avant.piece, origine: 'plaine', modele: avant.modele, evenement: null, ville: 'VD', camp: 'vert' });
  assert.strictEqual(P.cout(r.plateau, k), 1);
  assert.ok(P.villes(r.plateau).includes(k));
  assert.strictEqual(P.cases(r.plateau, { sansVilles: true })[k].terrain, 'plaine');
  assert.deepStrictEqual(P.stock(r.plateau), P.stock(p));
  // Les cases que ne porte pas une ville gardent exactement leur forme d'avant.
  const autre = Object.keys(P.cases(r.plateau)).filter((x) => x !== k)[0];
  assert.deepStrictEqual(Object.keys(P.cases(r.plateau)[autre]), ['terrain', 'piece', 'origine', 'modele', 'evenement']);
  // Fichier : aller-retour à l'identique.
  const lu = P.lire(P.serialiser(r.plateau));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  assert.deepStrictEqual(lu.plateau, r.plateau);
});

test('poserVilleDeploiement : refus expliqués', () => {
  const p = construit(), cases = P.cases(p), e = P.etendueSurCases(cases);
  const refus = (camp, cle, motif, plateau) => {
    const r = P.poserVilleDeploiement(plateau || p, camp, cle);
    assert.strictEqual(r.ok, false, camp + ' en ' + cle + ' aurait dû être refusé');
    assert.match(r.raison, motif);
    assert.strictEqual(r.plateau, plateau || p);
  };
  refus('bleu', '0,0', /Camp inconnu/);
  refus('vert', '20,20', /n’est pas sur le plateau/);
  refus('vert', 'toString', /n’est pas sur le plateau/);
  refus('vert', '0,0', /porte déjà une ville/);
  refus('vert', '1,0', /ne se pose pas sur le noyau/);
  const foret = Object.keys(cases).filter((k) => cases[k].terrain === 'foret')[0];
  refus('vert', foret, /se pose sur une case de Plaine \(ici : foret\)/);
  const montagne = Object.keys(cases).filter((k) => cases[k].terrain === 'montagne')[0];
  refus('vert', montagne, /se pose sur une case de Plaine \(ici : montagne\)/);
  // Une Plaine du bas du plateau n'est pas à l'extrémité de Vert, et inversement.
  const bas = P.placesDeploiement(p, 'rouge')[0], haut = P.placesDeploiement(p, 'vert')[0];
  refus('vert', bas, /n’est pas à l’extrémité du haut : la ville de déploiement de Vert se pose dans les 2 rangées du haut/);
  refus('rouge', haut, /n’est pas à l’extrémité du bas/);
  // Une Plaine entourée de tuiles, dans les rangées du haut, n'est pas au bord.
  const dedans = Object.keys(cases).filter((k) => cases[k].terrain === 'plaine' && H.decle(k).r <= e.haut + 1 && H.voisines(k).every((v) => cases[v]))[0];
  if (dedans) refus('vert', dedans, /n’est pas au bord du plateau/);
  // Une case qui porte une tuile d'événement.
  const boue = P.poserEvenement(p, 'E1', haut).plateau;
  refus('vert', haut, /porte une tuile d’événement/, boue);
  // Pas plus de 2 villes par joueur.
  const deux = complet();
  const libre = Object.keys(P.cases(deux)).filter((k) => P.cases(deux)[k].terrain === 'plaine' && P.cases(deux)[k].modele !== 'N1')[0];
  refus('vert', libre, /Vert a déjà ses 2 villes de déploiement : retirez-en une avant d’en poser une autre/, deux);
  assert.strictEqual(P.poserVilleDeploiement(deux, 'vert', libre, { libre: true }).ok, false, 'même en pose libre, pas de 3e ville');
});

test('pose libre : seules les conditions matérielles sont vérifiées, les contrôles jugent le reste', () => {
  const p = construit(), cases = P.cases(p);
  const milieu = Object.keys(cases).filter((k) => cases[k].terrain === 'plaine' && cases[k].modele !== 'N1' && H.decle(k).r === 0)[0];
  assert.strictEqual(P.poserVilleDeploiement(p, 'vert', milieu).ok, false);
  const r = P.poserVilleDeploiement(p, 'vert', milieu, { libre: true });
  assert.ok(r.ok, r.raison);
  assert.ok(K.villes(r.plateau).some((x) => x.niveau === 'erreur' && /mal placée/.test(x.message)));
  const foret = Object.keys(cases).filter((k) => cases[k].terrain === 'foret')[0];
  assert.match(P.poserVilleDeploiement(p, 'vert', foret, { libre: true }).raison, /case de Plaine/);
  assert.match(P.poserVilleDeploiement(p, 'vert', '1,0', { libre: true }).raison, /noyau/);
});

test('retirerVilleDeploiement, et pièce retirée ou tournée sous une ville : la ville part, camps à jour', () => {
  const p = complet();
  const [a, b] = p.camps.vert;
  const r = P.retirerVilleDeploiement(p, a);
  assert.ok(r.ok);
  assert.deepStrictEqual([r.camp, r.cle], ['vert', a]);
  assert.deepStrictEqual(r.plateau.camps.vert, [b]);
  assert.deepStrictEqual(r.plateau.camps.rouge, p.camps.rouge);
  assert.strictEqual(P.cases(r.plateau)[a].terrain, 'plaine');
  assert.strictEqual(P.cases(r.plateau)[a].ville, undefined);
  assert.deepStrictEqual(p.camps.vert, [a, b], 'plateau reçu intact');
  assert.match(P.retirerVilleDeploiement(p, '0,0').raison, /Aucune ville de déploiement sur cette case/);
  // Retirer la pièce qui porte la ville.
  const piece = P.cases(p)[b].piece;
  const sans = P.retirer(p, piece);
  assert.ok(sans.ok);
  assert.deepStrictEqual(sans.villesRetirees.includes(b), true);
  assert.strictEqual(sans.plateau.camps.vert.includes(b), false);
  assert.strictEqual(P.deploiements(sans.plateau).some((d) => d.cle === b), false);
  assert.deepStrictEqual(P.campsAuto(sans.plateau), sans.plateau.camps);
  assert.ok(P.lire(P.serialiser(sans.plateau)).ok);
  // La gomme retire d'abord la ville, pas la tuile du dessous.
  const g = P.gommer(p, a);
  assert.ok(g.ok);
  assert.deepStrictEqual([g.ville, g.camp], ['VD', 'vert']);
  assert.strictEqual(g.plateau.pieces.length, p.pieces.length);
  assert.strictEqual(P.cases(g.plateau)[a].terrain, 'plaine');
  assert.deepStrictEqual(g.plateau.camps.vert, [b]);
});

test('placesNeutres et poserVilleNeutre : une tuile ajoutée contre chaque flanc', () => {
  const p = construit(), terrain = P.cases(p), e = P.etendueSurCases(terrain);
  const places = P.placesNeutres(p);
  assert.ok(places.some((x) => x.flanc === 'gauche') && places.some((x) => x.flanc === 'droite'));
  const tiers = Math.floor((e.bas - e.haut + 1) / 3);
  places.forEach((x) => {
    assert.ok(!terrain[x.cle], 'une case vide');
    assert.ok(x.cotes >= 2 && x.pieces >= 1);
    assert.strictEqual(x.cotes, H.voisines(x.cle).filter((v) => terrain[v]).length);
    const c = H.decle(x.cle);
    assert.ok(c.r >= e.haut + tiers && c.r <= e.bas - tiers, 'dans le tiers central des rangées');
    assert.ok(x.flanc === 'gauche' ? c.q < e.rangees[c.r].gauche : c.q > e.rangees[c.r].droite);
    assert.deepStrictEqual(P.peutPoserVilleNeutre(p, x.cle), { ok: true, flanc: x.flanc });
  });
  const gauche = places.filter((x) => x.flanc === 'gauche')[0], fige = JSON.stringify(p);
  const r = P.poserVilleNeutre(p, gauche.cle);
  assert.ok(r.ok, r.raison);
  assert.strictEqual(JSON.stringify(p), fige);
  assert.deepStrictEqual([r.cle, r.flanc], [gauche.cle, 'gauche']);
  const c = H.decle(gauche.cle);
  assert.deepStrictEqual(r.plateau.pieces[r.plateau.pieces.length - 1], { id: r.id, modele: 'VN', q: c.q, r: c.r, rotation: 0 });
  assert.strictEqual(P.cases(r.plateau)[gauche.cle].terrain, 'ville');
  assert.strictEqual(P.cases(r.plateau, { sansVilles: true })[gauche.cle], undefined);
  assert.deepStrictEqual(P.etatVilles(r.plateau).neutres, [{ cle: gauche.cle, piece: r.id, flanc: 'gauche' }]);
  assert.deepStrictEqual(r.plateau.camps, { vert: [], rouge: [] }, 'une ville neutre n’est à personne');
  // Il ne reste que des places à droite ; puis plus aucune.
  const reste = P.placesNeutres(r.plateau);
  assert.ok(reste.length > 0 && reste.every((x) => x.flanc === 'droite'));
  const deux = P.poserVilleNeutre(r.plateau, reste[0].cle);
  assert.ok(deux.ok, deux.raison);
  assert.deepStrictEqual(P.placesNeutres(deux.plateau), []);
  assert.match(P.poserVilleNeutre(deux.plateau, places.filter((x) => x.flanc === 'droite').pop().cle).raison, /Les 2 villes neutres sont déjà posées/);
  // Retirer : par la case, ou par l'identifiant de la pièce.
  const moins = P.retirerVilleNeutre(deux.plateau, gauche.cle);
  assert.ok(moins.ok);
  assert.deepStrictEqual([moins.id, moins.cle], [r.id, gauche.cle]);
  assert.strictEqual(P.etatVilles(moins.plateau).neutres.length, 1);
  assert.ok(P.retirerVilleNeutre(deux.plateau, deux.id).ok);
  assert.match(P.retirerVilleNeutre(p, gauche.cle).raison, /Aucune ville neutre à cet endroit/);
});

test('poserVilleNeutre : refus expliqués', () => {
  const p = construit(), terrain = P.cases(p), e = P.etendueSurCases(terrain);
  const refus = (cle, motif, plateau) => {
    const r = P.poserVilleNeutre(plateau || p, cle);
    assert.strictEqual(r.ok, false, cle + ' aurait dû être refusé');
    assert.match(r.raison, motif);
  };
  refus('1,0', /tuile ajoutée contre le bord : cette case est déjà occupée/);
  refus('20,0', /ne touche aucune tuile/);
  refus('99,0', /hors des limites/);
  // Au-dessus du plateau : ni à gauche ni à droite.
  const haut = H.decle(Object.keys(terrain).filter((k) => H.decle(k).r === e.haut)[0]);
  refus(H.cle(haut.q, haut.r - 1), /sur un côté du plateau \(flanc gauche ou droit\), pas en haut, en bas ni dans un creux/);
  // Sur un flanc, mais trop haut : hors du tiers central.
  const rangeeHaute = e.haut + 1, gaucheHaut = H.cle(e.rangees[rangeeHaute].gauche - 1, rangeeHaute);
  if (H.voisines(gaucheHaut).some((v) => terrain[v])) refus(gaucheHaut, /à mi-hauteur du plateau \(rangées -?\d+ à -?\d+\)/);
  // Un flanc n'a qu'une ville neutre.
  const places = P.placesNeutres(p), gauches = places.filter((x) => x.flanc === 'gauche');
  const un = P.poserVilleNeutre(p, gauches[0].cle).plateau;
  const autre = Object.keys(P.cases(un)).map((k) => H.voisines(k)).flat().filter((k) => !P.cases(un)[k] && P.flancSurCases(e, k) === 'gauche' && k !== gauches[0].cle
    && P.refusNeutreSurCases(P.cases(un), k, { sansEcart: true }) === null)[0];
  if (autre) refus(autre, /Le flanc gauche a déjà sa ville neutre : l’autre se pose sur le flanc droit/, un);
  // Pose libre : la case vide doit seulement toucher le plateau.
  const libre = P.poserVilleNeutre(p, H.cle(haut.q, haut.r - 1), { libre: true });
  assert.ok(libre.ok, libre.raison);
  assert.strictEqual(P.poserVilleNeutre(p, '20,0', { libre: true }).ok, false);
});

test('écart entre villes : une place à moins de 4 pas d’une ville posée n’est plus proposée', () => {
  const p = construit();
  const places = P.placesDeploiement(p, 'vert');
  const un = P.poserVilleDeploiement(p, 'vert', places[0]).plateau;
  const d = P.distancesPas(un, places[0]);
  const apres = P.placesDeploiement(un, 'vert');
  assert.ok(apres.length > 0, 'il reste une place pour la seconde ville');
  apres.forEach((k) => assert.ok(d[k] >= 4));
  places.filter((k) => k !== places[0] && d[k] < 4).forEach((k) => {
    assert.strictEqual(apres.includes(k), false);
    assert.match(P.peutPoserVilleDeploiement(un, 'vert', k).raison, /Trop près d’une autre ville : \d pas, il en faut 4 \(soit 3 cases entre elles\)/);
  });
  // L'écart est un réglage.
  assert.ok(P.placesDeploiement(un, 'vert', { ecartVilles: 1 }).length >= apres.length);
  // Les villes neutres s'écartent aussi des villes déjà posées.
  const fini = complet();
  const sansNeutres = P.etatVilles(fini).neutres.reduce((q, n) => P.retirerVilleNeutre(q, n.cle).plateau, fini);
  P.placesNeutres(sansNeutres).forEach((x) => {
    P.villes(sansNeutres).forEach((v) => {
      const pas = Math.min(...H.voisines(x.cle).map((k) => P.distancesPas(sansNeutres, v)[k]).filter((n) => n !== undefined)) + 1;
      assert.ok(pas >= 4, x.cle + ' à ' + pas + ' pas de ' + v);
    });
  });
});

test('fichier : le champ « deploiements » est validé strictement', () => {
  const bon = () => JSON.parse(P.serialiser(complet()));
  assert.ok(P.valider(bon()).ok);
  assert.strictEqual(bon().version, 2);
  const refuse = (modifier, motif) => {
    const o = bon();
    modifier(o);
    const res = P.valider(o);
    assert.strictEqual(res.ok, false, 'aurait dû être refusé : ' + motif);
    assert.match(res.erreurs.join(' | '), motif);
  };
  refuse((o) => { o.deploiements = {}; }, /Liste des villes de déploiement invalide/);
  refuse((o) => { o.deploiements = new Array(9).fill(o.deploiements[0]); }, /Liste des villes de déploiement invalide \(8 au plus\)/);
  refuse((o) => { o.deploiements[0] = 'vert'; }, /pas un objet/);
  refuse((o) => { o.deploiements[0].camp = 'bleu'; }, /camp invalide/);
  refuse((o) => { o.deploiements[0].cle = '2;3'; }, /case invalide/);
  refuse((o) => { o.deploiements[0].cle = '__proto__'; }, /case invalide/);
  refuse((o) => { o.deploiements[0].proprietaire = 'vert'; }, /champ inconnu/);
  refuse((o) => { delete o.deploiements[0].camp; }, /manquant/);
  refuse((o) => { o.deploiements[1].cle = o.deploiements[0].cle; }, /deux villes sur la même case/);
  refuse((o) => { o.deploiements[2].camp = 'vert'; }, /plus de 2 villes de déploiement pour Vert/);
  refuse((o) => { o.recouvrements = [{ evenement: 'E1', cle: o.deploiements[0].cle }]; }, /porte déjà une tuile d’événement/);
  // Sans villes de déploiement, le champ est absent ; une liste vide est acceptée et ramenée à la forme canonique.
  const vide = bon();
  vide.deploiements = [];
  vide.camps = { vert: [], rouge: [] };
  const res = P.valider(vide);
  assert.ok(res.ok, res.erreurs.join(' '));
  assert.ok(!('deploiements' in res.plateau));
  // Un fichier dont les camps ne sont pas ceux des tuiles posées se lit (format valide), et le contrôle le dit.
  const faux = bon();
  faux.camps.vert = [];
  const lu = P.valider(faux);
  assert.ok(lu.ok);
  assert.ok(K.villes(lu.plateau).some((x) => x.niveau === 'erreur' && /enregistrées pour Vert/.test(x.message)));
});

test('table de jeu : partie créée sur un plateau du catalogue 2, déploiement sur ses villes, événements hors des villes', () => {
  const p = complet();
  const env = () => ({ alea: AT.alea.creer(7), hex: H, plateau: P });
  const partie = T.creer({ graine: 7, plateau: p }, env());
  assert.ok(partie.ok, partie.raison);
  let e = partie.etat;
  assert.deepStrictEqual(e.plateau.camps, p.camps);
  assert.deepStrictEqual(e.plateau.deploiements, p.deploiements);
  const j = e.actif, ville = e.plateau.camps[j][0];
  const forme = T.former(e, { joueur: j, numero: 1, carte: e.paquets[j].main[0], cle: ville }, env());
  assert.ok(forme.ok, forme.raison);
  assert.deepStrictEqual(forme.avertissements.filter((a) => a.bloquant), []);
  e = forme.etat;
  // Hors d'une ville de déploiement de son camp : avertissement bloquant.
  const ailleurs = T.former(e, { joueur: j, numero: 2, carte: e.paquets[j].main[0], cle: '1,0' }, env());
  assert.strictEqual(ailleurs.ok, false);
  // Enregistrer puis recharger la partie : le plateau garde ses villes.
  const recharge = T.charger(T.serialiser(e), env());
  assert.ok(recharge.ok, recharge.raison);
  assert.deepStrictEqual(recharge.etat.plateau, e.plateau);
  assert.strictEqual(P.villes(recharge.etat.plateau).length, 7);
  // Une partie dont le plateau porte un champ « deploiements » fautif est refusée.
  const brut = JSON.parse(T.serialiser(e));
  brut.plateau.deploiements[0].camp = 'bleu';
  assert.strictEqual(T.charger(JSON.stringify(brut), env()).ok, false);
});
