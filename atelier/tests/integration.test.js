'use strict';
// Lots A et B ensemble (vrai plateau, vraie partie) : ce que les doubles de partie.test.js ne peuvent pas montrer.
const test = require('node:test');
const assert = require('node:assert');
const P = require('../src/plateau.js');
const G = require('../src/generateur.js');
const K = require('../src/controles.js');
const VP = require('../src/vue-plateau.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, T = AT.partie;

const env = (graine) => ({ alea: AT.alea.creer(graine), hex: H, plateau: P });
const genere = (graine) => { const r = G.generer(graine); assert.ok(r.ok, r.raison); return P.avecCamps(r.plateau); };
/** Un plateau du premier catalogue (tuiles d'une case, villes sur les rangées extrêmes), relu d'un fichier de version 1. */
const ancienPlateau = () => {
  const lu = P.lire(require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures-v1', 'plateau-genere.json'), 'utf8'));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  return lu.plateau;
};

test('ancien plateau, 3 villes sur la rangée du haut après retouche : contrôle des villes en erreur, plateau enregistrable, relisible, jouable', () => {
  let p = ancienPlateau();
  const cases = P.cases(p);
  const haut = Math.min(...Object.keys(cases).map((k) => H.decle(k).r));
  const plaine = Object.keys(cases).find((k) => H.decle(k).r === haut && cases[k].modele === 'P');
  const neutre = P.villes(p).find((k) => k !== '0,0' && !p.camps.vert.includes(k) && !p.camps.rouge.includes(k));
  assert.ok(plaine && neutre);
  // Comme dans l’interface : retirer la plaine, puis déplacer une ville neutre à sa place.
  p = P.avecCamps(P.retirer(p, cases[plaine].piece).plateau);
  const c = H.decle(plaine);
  const d = VP.deplacerPiece(p, cases[neutre].piece, c.q, c.r);
  assert.ok(d.ok, d.raison);
  p = d.plateau;
  assert.strictEqual(P.villesRangeesExtremes(p).vert.length, 3);
  assert.deepStrictEqual(p.camps.vert, []);
  const bilan = K.tout(p);
  assert.ok(bilan.resultats.some((x) => x.regle === 'villes' && x.niveau === 'erreur' && /3 villes à égalité sur la rangée du haut/.test(x.message)));
  const relu = P.lire(P.serialiser(p));
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, p);
  const partie = T.creer({ graine: 7, plateau: p }, env(7));
  assert.ok(partie.ok, partie.raison);
  assert.ok(T.charger(T.serialiser(partie.etat), env(7)).ok);
});

test('partie créée sur un plateau portant des tuiles d’événement : cartes hors de la pioche, chaque tuile posée une seule fois', () => {
  let p = genere(2);
  const admissible = (id) => Object.keys(P.cases(p)).find((k) => P.peutPoserEvenement(p, id, k).ok);
  for (const id of ['E2', 'E5']) { const r = P.poserEvenement(p, id, admissible(id)); assert.ok(r.ok, r.raison); p = r.plateau; }
  const e = env(3);
  const partie = T.creer({ graine: 3, plateau: p }, e);
  assert.ok(partie.ok, partie.raison);
  const pe = partie.etat.paquets.evenements;
  assert.strictEqual(pe.pioche.length, C.ORDRE_EVENEMENTS.length - 2);
  assert.deepStrictEqual(pe.defausse.slice().sort(), ['E2', 'E5']);
  assert.strictEqual(partie.etat.plateau.recouvrements.length, 2);
  const relu = T.charger(T.serialiser(partie.etat), env(3));
  assert.ok(relu.ok, relu.raison);
  // Toute la pioche se tire, et chaque tuile se pose sur une case permise.
  let etat = partie.etat, posees = 0;
  for (let i = 0; i < pe.pioche.length; i++) {
    const tirage = T.piocherEvenement(etat, {}, e);
    assert.ok(tirage.ok, tirage.raison);
    assert.ok(tirage.carte.id !== 'E2' && tirage.carte.id !== 'E5');
    etat = tirage.etat;
    const cle = Object.keys(P.cases(etat.plateau)).find((k) => P.peutPoserEvenement(etat.plateau, tirage.carte.id, k).ok);
    if (!cle) continue;
    const pose = T.poserEvenement(etat, { evenement: tirage.carte.id, cle: cle }, e);
    assert.ok(pose.ok, pose.raison);
    etat = pose.etat;
    posees += 1;
  }
  assert.ok(posees >= 4, 'tuiles posées : ' + posees);
  assert.strictEqual(T.piocherEvenement(etat, {}, e).ok, false);
  assert.ok(T.charger(T.serialiser(etat), env(3)).ok);
});

test('graine du plateau : même longueur maximale dans plateau.valider et partie.creer', () => {
  assert.strictEqual(T.LIMITES.grainePlateau, C.REGLAGES.bornes.longueurGraine);
  const p = genere(1);
  for (const n of [1, 64, 65, 100]) {
    const q = JSON.parse(JSON.stringify(p));
    q.graine = 'x'.repeat(n);
    const fichier = P.valider(q).ok, partie = T.creer({ graine: 1, plateau: q }, env(1));
    assert.strictEqual(fichier, n <= 64, 'plateau.valider, longueur ' + n);
    assert.strictEqual(partie.ok, n <= 64, 'partie.creer, longueur ' + n);
    if (!partie.ok) assert.match(partie.raison, /graine invalide \(entier ou texte de 64 caractères au plus\)/);
  }
});

// ------------------------------------------------------------------ lot D : pièces personnelles portées par le document

/** Un plateau fait à la main : noyau, une pièce personnelle posée, deux villes de déploiement, une montagne d'une case. */
function plateauPerso() {
  let p = P.ajouterModele(P.vierge('main'), { nom: 'Crête', quantite: 2, cases: [{ q: 0, r: 0, terrain: 'montagne' }, { q: 1, r: 0, terrain: 'foret' }, { q: 1, r: 1, terrain: 'plaine' }] }).plateau;
  const poses = [['X1', 2, 0], ['V', 0, -2], ['P', 0, 2], ['V', 0, 3], ['P', 1, -2]];
  for (const [modele, q, r] of poses) { const res = P.poser(p, modele, q, r, 0, { horsStock: ['P', 'F', 'S', 'V'].includes(modele) }); assert.ok(res.ok, res.raison); p = res.plateau; }
  const m = P.peindre(p, '-2,0', 'montagne');
  assert.ok(m.ok && m.horsStock);
  return P.avecCamps(m.plateau);
}

test('pièce personnelle : enregistrer, rouvrir, créer une partie, enregistrer la partie, la recharger', () => {
  const p = plateauPerso();
  assert.deepStrictEqual([p.camps.vert, p.camps.rouge], [['0,-2'], ['0,3']]);
  // Le fichier du plateau se rouvre seul : les pièces personnelles sont dedans.
  const texte = P.serialiser(p);
  assert.match(texte, /"modeles"/);
  const relu = P.lire(texte);
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, p);
  // Partie créée sur le plateau relu.
  const e = env(11);
  const partie = T.creer({ graine: 11, plateau: relu.plateau }, e);
  assert.ok(partie.ok, partie.raison);
  assert.deepStrictEqual(partie.etat.plateau.modeles, p.modeles);
  assert.notStrictEqual(partie.etat.plateau.modeles, relu.plateau.modeles);
  // Une tuile d'événement sur la forêt de la pièce personnelle : le document garde ses pièces.
  const pioche = partie.etat.paquets.evenements.pioche.slice();
  let etat = partie.etat, incendie = false;
  for (let i = 0; i < pioche.length && !incendie; i++) {
    const tirage = T.piocherEvenement(etat, {}, e);
    assert.ok(tirage.ok, tirage.raison);
    etat = tirage.etat;
    if (tirage.carte.id !== 'E4') continue;
    const pose = T.poserEvenement(etat, { evenement: 'E4', cle: '3,0' }, e);
    assert.ok(pose.ok, pose.raison);
    etat = pose.etat;
    incendie = true;
  }
  assert.ok(incendie, 'la carte Incendie a été piochée');
  assert.deepStrictEqual(etat.plateau.modeles, p.modeles);
  // Le fichier de la partie se rouvre seul, lui aussi, sur un environnement neuf.
  const fichier = T.serialiser(etat);
  const recharge = T.charger(fichier, env(999));
  assert.ok(recharge.ok, recharge.raison);
  assert.deepStrictEqual(recharge.etat.plateau, etat.plateau);
  assert.deepStrictEqual(recharge.etat.plateau.modeles, p.modeles);
  const cases = P.cases(recharge.etat.plateau);
  assert.deepStrictEqual(['2,0', '3,0', '3,1'].map((k) => [cases[k].modele, cases[k].origine, cases[k].terrain]),
    [['X1', 'montagne', 'montagne'], ['X1', 'foret', 'terre_brulee'], ['X1', 'plaine', 'plaine']]);
  assert.deepStrictEqual([cases['-2,0'].modele, cases['-2,0'].terrain], ['M1', 'montagne']);
  assert.strictEqual(Object.keys(cases).length, 7 + 3 + 4 + 1);
  assert.deepStrictEqual(recharge.etat.plateau.camps, p.camps);
  // Les contrôles du plateau rechargé répondent (alertes de la création à la main comprises).
  const bilan = K.tout(recharge.etat.plateau);
  assert.ok(bilan.resultats.some((x) => /Tuiles à prévoir en plus du catalogue \(5\) : 1 × Montagne d’une case, 2 × Plaine, 2 × Ville \(ancien catalogue\)/.test(x.message)));
  assert.ok(bilan.resultats.some((x) => /Pièces personnelles restantes \(1\) : 1 × Crête/.test(x.message)));
  assert.strictEqual(bilan.equilibre.calculable, true);
});

test('partie.creer et partie.charger : pièces personnelles validées strictement, avec ou sans le contrôle du lot A', () => {
  const p = plateauPerso();
  // Les bornes recopiées dans partie.js (qui ne dépend pas du catalogue) sont celles de REGLAGES.perso.
  const R = C.REGLAGES.perso;
  assert.deepStrictEqual([T.LIMITES.persoModeles, T.LIMITES.persoCases, T.LIMITES.persoQuantite, T.LIMITES.persoNom], [R.modelesMax, R.casesMax, R.quantiteMax, R.longueurNom]);
  const sansLotA = (g) => ({ alea: AT.alea.creer(g), hex: H, plateau: Object.assign({}, P, { valider: undefined }) });
  assert.ok(T.creer({ graine: 1, plateau: p }, sansLotA(1)).ok);
  const fautes = {
    'liste qui n’est pas un tableau': [(o) => { o.modeles = { 0: o.modeles[0], length: 1 }; }, /pièces personnelles invalide/],
    '25 pièces personnelles': [(o) => { o.modeles = Array.from({ length: 25 }, (_, i) => Object.assign({}, o.modeles[0], { id: 'X' + (i + 1) })); }, /24 au plus/],
    'identifiant en double': [(o) => { o.modeles.push(JSON.parse(JSON.stringify(o.modeles[0]))); }, /en double/],
    'identifiant « constructor »': [(o) => { o.modeles[0].id = 'constructor'; }, /identifiant invalide/],
    'identifiant « __proto__ »': [(o) => { o.modeles[0].id = '__proto__'; }, /identifiant invalide/],
    'identifiant de base': [(o) => { o.modeles[0].id = 'P'; }, /identifiant invalide/],
    'champ inconnu': [(o) => { o.modeles[0].noyau = true; }, /champ inconnu/],
    'ville': [(o) => { o.modeles[0].cases[1].terrain = 'ville'; }, /jamais de ville/],
    'terrain « toString »': [(o) => { o.modeles[0].cases[1].terrain = 'toString'; }, /terrain invalide/],
    'sept cases': [(o) => { o.modeles[0].cases = Array.from({ length: 7 }, (_, i) => ({ q: i, r: 0, terrain: 'plaine' })); }, /2 à 6 cases/],
    'une case': [(o) => { o.modeles[0].cases = [o.modeles[0].cases[0]]; }, /2 à 6 cases/],
    'case en double': [(o) => { o.modeles[0].cases[2] = { q: 0, r: 0, terrain: 'plaine' }; }, /en double/],
    'case non entière': [(o) => { o.modeles[0].cases[1].q = '1'; }, /case invalide|position invalide/],
    'quantité 10': [(o) => { o.modeles[0].quantite = 10; }, /quantité invalide/],
    'nom trop long': [(o) => { o.modeles[0].nom = 'n'.repeat(41); }, /nom invalide/]
  };
  for (const nom of Object.keys(fautes)) {
    for (const e of [env(1), sansLotA(1)]) {
      const o = JSON.parse(JSON.stringify(p));
      fautes[nom][0](o);
      const r = T.creer({ graine: 1, plateau: o }, e);
      assert.strictEqual(r.ok, false, nom + (e.plateau.valider ? '' : ' (sans lot A)'));
      assert.match(r.raison, fautes[nom][1], nom);
    }
  }
  // Règles que seul le lot A connaît : un seul tenant, pièce posée dont le modèle manque.
  const eparse = JSON.parse(JSON.stringify(p));
  eparse.modeles[0].cases[2] = { q: 4, r: 4, terrain: 'plaine' };
  assert.match(T.creer({ graine: 1, plateau: eparse }, env(1)).raison, /seul tenant/);
  const orphelin = JSON.parse(JSON.stringify(p));
  delete orphelin.modeles;
  assert.match(T.creer({ graine: 1, plateau: orphelin }, env(1)).raison, /modèle inconnu/);
  // Fichier de partie : « __proto__ » dans une pièce personnelle = champ inconnu, rien ne fuit.
  const partie = T.creer({ graine: 2, plateau: p }, env(2));
  const fichier = T.serialiser(partie.etat);
  const piege = fichier.replace(/"quantite":\s*2/, '"quantite":2,"__proto__":{"pollue":true}');
  assert.notStrictEqual(piege, fichier);
  const r = T.charger(piege, env(2));
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /champ inconnu/);
  assert.strictEqual({}.pollue, undefined);
  // Liste vide : acceptée, et le champ disparaît (forme canonique).
  const vide = JSON.parse(JSON.stringify(P.vierge(1)));
  vide.modeles = [];
  const v = T.creer({ graine: 3, plateau: vide }, env(3));
  assert.ok(v.ok, v.raison);
  assert.ok(!('modeles' in v.etat.plateau));
});
