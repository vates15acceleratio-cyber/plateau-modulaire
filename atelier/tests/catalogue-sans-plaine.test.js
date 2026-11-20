'use strict';
// Décision du 2026-11-19 (seconde série, point 8) : aucun monobloc tout en plaine ; forêt ou marais à une extrémité.
// Et fichiers témoins du catalogue 2 de la veille de cette décision (tests/fixtures-v2, écrits AVANT le changement).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const P = require('../src/plateau.js');
require('../src/alea.js');
require('../src/controles.js');
require('../src/generateur.js');
require('../src/bibliotheque.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, K = AT.controles, G = AT.generateur, B = AT.bibliotheque, T = AT.partie;

const fichier = (nom) => fs.readFileSync(path.join(__dirname, 'fixtures-v2', nom), 'utf8');
const env = () => ({ alea: AT.alea.creer(7), hex: H, plateau: P });
const TERRAIN = C.idsParRole('terrain');
const speciales = (m) => m.cases.filter((c) => c.terrain !== 'plaine');
const voisinesDans = (m, c) => m.cases.filter((x) => H.distance(x, c) === 1).length;

test('aucun monobloc de terrain tout en plaine ; chacun porte au moins une forêt ou un marais', () => {
  assert.deepStrictEqual(C.monoblocsToutPlaine(), []);
  assert.strictEqual(TERRAIN.length, 21);
  TERRAIN.forEach((id) => assert.ok(speciales(C.MODELES[id]).length >= 1, id + ' est tout en plaine'));
  assert.strictEqual(C.toutEnPlaine(C.modele('P4A').cases), true);
  assert.strictEqual(C.toutEnPlaine(C.modele('F31').cases), false);
  assert.strictEqual(C.toutEnPlaine(C.modele('R').cases), false, 'une tuile d’une case n’est pas un monobloc');
  // Un bloc tout en forêt ou tout en marais reste permis.
  assert.deepStrictEqual([speciales(C.MODELES.F3).length, speciales(C.MODELES.S3).length], [3, 3]);
  // Le contrôle du catalogue le dirait.
  const cases = C.MODELES.F12A.cases;
  try {
    C.MODELES.F12A.cases = cases.map((c) => ({ q: c.q, r: c.r, terrain: 'plaine' }));
    assert.deepStrictEqual(C.monoblocsToutPlaine(), ['F12A']);
    assert.ok(K.monoblocs(P.vierge(1)).some((x) => x.niveau === 'erreur' && /Catalogue : monobloc de terrain tout en plaine \(F12A\)/.test(x.message)));
  } finally {
    C.MODELES.F12A.cases = cases;
  }
  assert.strictEqual(K.monoblocs(P.vierge(1)).filter((x) => x.niveau === 'erreur').length, 0);
});

test('composition : 49 plaines, 13 forêts, 13 marais ; 4 + 3 pièces de 3 cases à une case spéciale, 5 + 6 de 4 cases, 1 mixte', () => {
  const n = { plaine: 0, foret: 0, marais: 0 }, genres = {};
  TERRAIN.forEach((id) => {
    const m = C.MODELES[id], s = speciales(m);
    m.cases.forEach((c) => { n[c.terrain] += 1; });
    const genre = m.cases.length + ' cases : ' + s.map((c) => c.terrain).sort().join('+');
    genres[genre] = (genres[genre] || 0) + 1;
  });
  assert.deepStrictEqual(n, { plaine: 49, foret: 13, marais: 13 });
  assert.deepStrictEqual(genres, {
    '4 cases : foret': 5, '4 cases : marais': 6, '4 cases : foret+marais': 1,
    '3 cases : foret+foret+foret': 1, '3 cases : marais+marais+marais': 1, '3 cases : foret': 4, '3 cases : marais': 3
  });
});

test('la case de forêt ou de marais est à une extrémité de la pièce, jamais au milieu ; pièce mixte : aux deux bouts opposés', () => {
  TERRAIN.forEach((id) => {
    const m = C.MODELES[id], s = speciales(m);
    if (s.length === m.cases.length) return;                       // bois et marécage : tout le bloc
    const max = Math.max(...m.cases.map((c) => voisinesDans(m, c)));
    s.forEach((c) => {
      const v = voisinesDans(m, c);
      // Une extrémité touche moins de cases de la pièce que la case la plus entourée (ou toutes se valent : triangle).
      assert.ok(v < max || m.cases.every((x) => voisinesDans(m, x) === max), id + ' : case spéciale au milieu de la pièce');
      assert.ok(v <= 2, id);
    });
  });
  const mixte = C.MODELES.FS4B, bouts = speciales(mixte);
  assert.deepStrictEqual(bouts.map((c) => c.terrain).sort(), ['foret', 'marais']);
  assert.strictEqual(H.distance(bouts[0], bouts[1]), Math.max(...mixte.cases.map((a) => Math.max(...mixte.cases.map((b) => H.distance(a, b))))), 'forêt et marais sont les deux cases les plus éloignées');
});

test('deux pièces de même contenu n’ont jamais la même forme (à rotation près ; le carton n’a qu’un recto)', () => {
  const signature = (m) => {
    let mieux = null;
    for (let rot = 0; rot < 6; rot++) {
      const pts = m.cases.map((c) => Object.assign(H.tourner(c.q, c.r, rot), { t: c.terrain }));
      const q0 = Math.min(...pts.map((p) => p.q)), r0 = Math.min(...pts.filter((p) => p.q === q0).map((p) => p.r));
      const sig = pts.map((p) => (p.q - q0) + ',' + (p.r - r0) + ':' + p.t).sort().join(' ');
      if (mieux === null || sig < mieux) mieux = sig;
    }
    return mieux;
  };
  const vues = new Set(TERRAIN.map((id) => signature(C.MODELES[id])));
  assert.strictEqual(vues.size, 21);
  const noms = new Set(TERRAIN.map((id) => C.MODELES[id].nom));
  assert.strictEqual(noms.size, 21, 'chaque pièce a son nom');
});

test('identifiants gardés : mêmes cases et mêmes terrains qu’avant ; pièces retirées : toujours connues, hors catalogue imprimé', () => {
  const cases = (id) => C.modele(id).cases.map((c) => c.q + ',' + c.r + ':' + c.terrain).join(' ');
  assert.strictEqual(cases('F31B'), '0,0:plaine 1,0:plaine 2,0:plaine 1,1:foret');
  assert.strictEqual(cases('S31B'), '0,0:marais 1,0:plaine 1,1:plaine 0,2:plaine');
  assert.strictEqual(cases('S12'), '0,0:marais 1,0:plaine 0,1:plaine');
  ['F3', 'S3', 'F31', 'S31', 'F31B', 'S31B', 'S12'].forEach((id) => assert.ok(C.ORDRE_MODELES.includes(id), id));
  const retirees = { P4A: '0,0:plaine 1,0:plaine 0,1:plaine 1,1:plaine', P4B: '0,0:plaine 1,0:plaine 1,1:plaine 2,1:plaine', P4C: '0,0:plaine 1,0:plaine 1,1:plaine 0,2:plaine',
    P4D: '0,0:plaine 1,0:plaine -1,1:plaine 0,-1:plaine', P4E: '0,0:plaine 1,0:plaine 2,0:plaine 2,1:plaine', P3A: '0,0:plaine 1,0:plaine 0,1:plaine', P3B: '0,0:plaine 1,0:plaine 2,0:plaine',
    P3C: '0,0:plaine 1,0:plaine 1,1:plaine', F22: '0,0:foret 1,0:foret 1,1:plaine 2,1:plaine', S22: '0,0:plaine 1,0:plaine 2,0:marais 2,1:marais', FS4: '0,0:plaine 1,0:foret -1,1:marais 0,-1:plaine',
    F21: '0,0:foret 1,0:foret 1,1:plaine', S21: '0,0:marais 1,0:marais 1,1:plaine', F12: '0,0:plaine 1,0:foret 2,0:plaine' };
  Object.keys(retirees).forEach((id) => {
    const m = C.modele(id);
    assert.strictEqual(cases(id), retirees[id], id);
    assert.deepStrictEqual([m.nombre, m.horsCatalogue, m.ancien, C.ORDRE_MODELES.includes(id), C.ORDRE_HORS_CATALOGUE.includes(id)], [0, true, true, false, true], id);
    assert.strictEqual(P.poser(P.vierge(1), id, 4, 0, 0).ok, false, id + ' ne se pose plus depuis le stock');
  });
});

test('fichiers du catalogue d’avant la décision : plateaux, partie et bibliothèque s’ouvrent toujours, case pour case', () => {
  const brut = JSON.parse(fichier('plateau-genere.json'));
  const lu = P.lire(fichier('plateau-genere.json'));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  const p = lu.plateau, cases = P.cases(p), n = {};
  assert.deepStrictEqual(p.pieces, brut.pieces);
  assert.deepStrictEqual(p.deploiements, brut.deploiements);
  assert.deepStrictEqual(p.camps, brut.camps);
  Object.keys(cases).forEach((k) => { n[cases[k].origine] = (n[cases[k].origine] || 0) + 1; });
  assert.deepStrictEqual(n, { ville: 3, plaine: 59, foret: 11, marais: 11, montagne: 9 });
  assert.deepStrictEqual(P.chevauchements(p), []);
  assert.strictEqual(P.villes(p).length, 7);
  assert.strictEqual(p.pieces.every((x) => P.modele(p, x.modele) !== null), true);
  assert.deepStrictEqual(P.lire(P.serialiser(p)).plateau, p);
  // Contrôles : aucune erreur d'inventaire (ni « stock dépassé » ni « hors catalogue ») ; les monoblocs retirés sont une alerte.
  const inventaire = K.inventaire(p);
  assert.strictEqual(inventaire.filter((x) => x.niveau === 'erreur').length, 0, inventaire.map((x) => x.message).join(' | '));
  const anciens = inventaire.filter((x) => /d’un ancien catalogue sur le plateau/.test(x.message))[0];
  assert.strictEqual(anciens.niveau, 'alerte');
  assert.strictEqual(anciens.donnees.monoblocsAnciens, 14);
  assert.match(anciens.message, /^14 monoblocs d’un ancien catalogue sur le plateau \(.*1 × Pré en losange \(ancien\)/);
  assert.strictEqual(K.etape(p).ancien, false, 'ce n’est pas un plateau du premier catalogue');
  assert.strictEqual(K.villes(p).filter((x) => x.niveau === 'erreur').length, 0);
  assert.strictEqual(K.tout(p).equilibre.calculable, true);
  // Plateau retouché (remplissages permis, tuile d'événement).
  const retouche = P.lire(fichier('plateau-retouche.json'));
  assert.ok(retouche.ok, retouche.erreurs.join(' '));
  assert.strictEqual(retouche.plateau.recouvrements.length, 1);
  assert.doesNotThrow(() => K.tout(retouche.plateau));
  // Partie : rechargée, puis poursuivie.
  const partie = T.charger(fichier('partie.json'), env());
  assert.ok(partie.ok, partie.raison);
  const e = partie.etat, j = e.actif, pose = e.bataillons[j].filter((b) => b.case !== null)[0];
  assert.ok(pose && e.plateau.camps[j].includes(pose.case));
  const voisine = H.voisines(pose.case).filter((k) => P.cout(e.plateau, k) !== Infinity)[0];
  const d = T.deplacer(e, { joueur: j, numero: pose.numero, cle: voisine }, env());
  assert.ok(d.ok, d.raison);
  assert.ok(T.charger(T.serialiser(d.etat), env()).ok);
  // Bibliothèque : ses deux fiches.
  const bib = B.lire(fichier('bibliotheque.json'));
  assert.ok(bib.ok, bib.raison);
  assert.deepStrictEqual(bib.liste.map((x) => x.nom), ['Plateau généré', 'Plateau retouché']);
  bib.liste.forEach((x) => assert.ok(P.valider(JSON.parse(JSON.stringify(x.plateau))).ok, x.nom));
});

test('contrôle 1 : un monobloc personnel tout en plaine est une alerte, pas une erreur', () => {
  let p = P.ajouterModele(P.vierge(1), { nom: 'Grand pré', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'plaine' }, { q: 1, r: 0, terrain: 'plaine' }, { q: 1, r: 1, terrain: 'plaine' }] });
  assert.ok(p.ok, p.raison);
  assert.ok(!K.inventaire(p.plateau).some((x) => /tout en plaine/.test(x.message)), 'non posé : rien à dire');
  p = P.poser(p.plateau, p.id, 3, 0, 0);
  assert.ok(p.ok, p.raison);
  const constats = K.inventaire(p.plateau).filter((x) => /tout en plaine/.test(x.message));
  assert.strictEqual(constats.length, 1);
  assert.strictEqual(constats[0].niveau, 'alerte');
  assert.match(constats[0].message, /^1 monobloc personnel tout en plaine \(Grand pré\) : la décision en vigueur est « chaque monobloc de terrain porte au moins une forêt ou un marais »\.$/);
  assert.deepStrictEqual(constats[0].cases, ['3,0', '4,0', '4,1']);
  assert.deepStrictEqual(constats[0].donnees, { monoblocsToutPlaine: 1 });
  assert.strictEqual(K.inventaire(p.plateau).filter((x) => x.niveau === 'erreur').length, 0);
  // Avec une forêt au bout : plus d'alerte.
  const bon = P.ajouterModele(P.vierge(1), { nom: 'Pré boisé', quantite: 1, cases: [{ q: 0, r: 0, terrain: 'foret' }, { q: 1, r: 0, terrain: 'plaine' }] });
  assert.ok(!K.inventaire(P.poser(bon.plateau, bon.id, 3, 0, 0).plateau).some((x) => /tout en plaine/.test(x.message)));
});

test('générateur : option « accolerSpeciales », désactivée par défaut, sans effet à 0, reproductible', () => {
  assert.strictEqual(C.REGLAGES.generateur.accolerSpeciales, 0);
  assert.deepStrictEqual(G.generer(9, { accolerSpeciales: 0 }).plateau, G.generer(9).plateau);
  const a = G.generer(9, { accolerSpeciales: 2 }), b = G.generer(9, { accolerSpeciales: 2 });
  assert.ok(a.ok, a.raison);
  assert.deepStrictEqual(a.plateau, b.plateau);
  assert.strictEqual(K.tout(a.plateau).erreurs, 0);
  // Sur quelques graines, accoler donne en moyenne moins de cases de forêt ou de marais isolées.
  const isolees = (pl) => { const c = P.cases(pl, { sansVilles: true }); return ['foret', 'marais'].reduce((n, t) => n + P.composantes(Object.keys(c).filter((k) => c[k].terrain === t)).filter((g) => g.length === 1).length, 0); };
  let sans = 0, avec = 0;
  for (let g = 1; g <= 8; g++) { sans += isolees(G.generer(g).plateau); avec += isolees(G.generer(g, { accolerSpeciales: 4 }).plateau); }
  assert.ok(avec < sans, avec + ' cases isolées avec l’option, ' + sans + ' sans');
});
