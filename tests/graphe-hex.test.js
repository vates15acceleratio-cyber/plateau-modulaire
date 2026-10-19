'use strict';
/*
 * Tests du graphe et des mesures d'équilibre pour le format hexagonal 'hex19' (lot 2, docs/77).
 * Catalogue candidat (docs/75) injecté en mémoire ; mesures de docs/75 retrouvées sur des plateaux complets.
 */
const test = require('node:test');
const assert = require('node:assert');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
const M = globalThis.PM.modele;
const GR = globalThis.PM.graphe;
const F = globalThis.PM.geometrie.format('hex19');
/* Catalogue hexagonal candidat (docs/75) au format PM.modele, injecté en mémoire : HC2, HC3, HB1, HK1 (le vrai catalogue vient au lot catalogue). */
const cat = (() => {
const D = 20;
const kase = (id, x, y, type) => ({ id, x, y, diametre: D, type: type || 'deplacement' });
const lien = (id, a, b) => ({ id, a: { case: a }, b: { case: b } });
const port = (id, c, coin) => ({ id, a: { case: c }, b: { coin } });
const raccord = (id, c, cote) => ({ id, a: { case: c }, b: { raccord: { cote, pos: 0 } } });
const rac = (cote) => ({ raccord: { cote, pos: 0 } });

const PORTS_A = () => [port('p5', 'a', 5), port('p0', 'a', 0), port('p1', 'a', 1), raccord('r5', 'a', 5), raccord('r0', 'a', 0)];
const PORTS_B = () => [port('p2', 'b', 2), port('p3', 'b', 3), port('p4', 'b', 4), raccord('r2', 'b', 2), raccord('r3', 'b', 3)];
const CASES_AB = () => [kase('a', 0, -20.7), kase('b', 0, 20.7)];

function catalogue() {
  return [
    { id: 'HC2', nom: 'Deux ponts et traverse', gabarit: 'centrale', grille: 'hex19', exemplaires: 6,
      cases: CASES_AB(), chemins: [].concat(PORTS_A(), PORTS_B()),
      passages: [{ id: 't1', a: rac(1), b: rac(4) }] },
    { id: 'HC3', nom: 'Carrefour', gabarit: 'centrale', grille: 'hex19', exemplaires: 5,
      cases: CASES_AB(), chemins: [].concat(PORTS_A(), PORTS_B()),
      pivots: [{ id: 'v', x: 0, y: 0 }],
      passages: [
        { id: 't1', a: rac(1), b: { pivot: 'v' } }, { id: 't2', a: rac(4), b: { pivot: 'v' } },
        { id: 't3', a: { case: 'a' }, b: { pivot: 'v' } }, { id: 't4', a: { case: 'b' }, b: { pivot: 'v' } }
      ] },
    { id: 'HB1', nom: 'Bord', gabarit: 'bord', grille: 'hex19', exemplaires: 8,
      cases: [kase('a', 0, -30, 'apparition'), kase('p', 0, 20.7)],
      chemins: [raccord('r1', 'a', 1), raccord('r4', 'a', 4), lien('h1', 'a', 'p'),
        port('p2', 'p', 2), port('p3', 'p', 3), port('p4', 'p', 4), raccord('r2', 'p', 2), raccord('r3', 'p', 3)] },
    { id: 'HK1', nom: 'Coin', gabarit: 'coin', grille: 'hex19', exemplaires: 7,
      cases: [kase('a', 10, 0, 'apparition'), kase('p', -22, 0)],
      chemins: [raccord('r3', 'a', 3), raccord('r5', 'a', 5), lien('h1', 'a', 'p'),
        port('p4', 'p', 4), port('p5', 'p', 5), raccord('r4', 'p', 4)] }
  ];
}

/**
 * Plateau complet : document hex19 portant les 4 modèles, les 19 tuiles posées (la fonction `choixCentrale(cellule, index)` donne le
 * modèle et la rotation des 7 intérieures dans l'ordre de PM.geometrie.format('hex19').cellules ; par défaut HC2 / HC3 en alternance,
 * rotation 0), et les villes aux sièges `villes` (défaut : le trèfle).
 */
function plateau(M, options) {
  options = options || {};
  const F = globalThis.PM.geometrie.format('hex19');
  let doc = M.nouveauDocument('hex19');
  catalogue().forEach((m) => { doc = M.ajouterModele(doc, m); });
  let k = 0;
  F.cellules.forEach((c) => {
    if (c.gabarit === 'centrale') {
      const ch = options.choixCentrale ? options.choixCentrale(c, k) : { id: k % 2 ? 'HC3' : 'HC2', rot: 0 };
      doc = M.poserTuile(doc, ch.id, c.col, c.lig, ch.rot);
      k++;
    } else {
      doc = M.poserTuile(doc, c.gabarit === 'bord' ? 'HB1' : 'HK1', c.col, c.lig);
    }
  });
  (options.villes || F.TREFLE).forEach((s) => { doc = M.poserJeton(doc, s, 0, 'capture'); });
  return doc;
}

function alea(graine) {
  let x = graine >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; };
}

/**
 * Cherche par tirages déterministes (graine fixe) `nb` plateaux complets dont les 6 villes du trèfle sont à 4 pas au moins l'une de l'autre
 * (3 cases d'écart) : 7 intérieures tirées sans remise parmi 6 HC2 et 5 HC3, rotations 0 à 2 (HC2 et HC3 ont un demi-tour pour symétrie).
 * Environ 1 tirage sur 100 convient. Renvoie { plateaux: [{ doc, g }], tirages }.
 */
function plateauxBons(M, GR, nb, graine) {
  const rnd = alea(graine || 2026), plateaux = [];
  let tirages = 0;
  while (plateaux.length < nb && tirages < 20000) {
    tirages++;
    const stock = ['HC2', 'HC2', 'HC2', 'HC2', 'HC2', 'HC2', 'HC3', 'HC3', 'HC3', 'HC3', 'HC3'];
    const doc = plateau(M, { choixCentrale: () => ({ id: stock.splice(Math.floor(rnd() * stock.length), 1)[0], rot: Math.floor(rnd() * 3) }) });
    const g = GR.construire(doc);
    if (!GR.villesProches(g).length) plateaux.push({ doc, g });
  }
  return { plateaux, tirages };
}

return { catalogue, plateau, plateauxBons, alea };
})();

const { plateaux, tirages } = cat.plateauxBons(M, GR, 8, 2026);
const jeton = (s) => ({ i: s, j: 0, type: 'capture' });

test('plateaux de test : trouvés par tirages déterministes', () => {
  assert.strictEqual(plateaux.length, 8, 'tirages : ' + tirages);
});

test('graphe : 38 cases de tuiles + 24 sièges, chaque siège relié par 3 ports, symétrique', () => {
  const { g } = plateaux[0];
  assert.strictEqual(g.cases.size, 38);
  assert.strictEqual(g.jonctions.length, 24);
  assert.strictEqual(g.noeuds.length, 62);
  g.jonctions.forEach((j) => { assert.strictEqual(j.ports, 3); assert.strictEqual(j.id, 'J' + j.i + ',0'); });
  assert.deepStrictEqual(g.jonctions.filter((j) => j.type === 'ville').map((j) => j.i), [0, 4, 8, 15, 19, 23]);
  assert.strictEqual(g.villes.size, 6);
  g.voisins.forEach((vs, a) => vs.forEach((b) => assert.ok(g.voisins.get(b).has(a))));
  assert.ok(GR.connexe(g));
  assert.strictEqual(g.apparitions[1].length, 5);
  assert.strictEqual(g.apparitions[2].length, 5);
});

test('table par format : 6 villes, « 4 contre 2 », S dès 4 (information dès 3)', () => {
  assert.strictEqual(GR.nbVilles('hex19'), 6);
  assert.strictEqual(GR.seuilMajorite('hex19'), 4);
  assert.strictEqual(GR.seuilMajoriteAlerte('hex19'), null);
  assert.strictEqual(GR.libelleMajorite('hex19'), '4 contre 2');
  assert.strictEqual(GR.seuilS('hex19'), 4);
  assert.strictEqual(GR.seuilSInformation('hex19'), 3);
  assert.strictEqual(GR.nbVilles('4x4'), 7);
  assert.strictEqual(GR.seuilMajorite('5x5'), 6);
  assert.deepStrictEqual(GR.MOTIF_VILLES_HEX.map((v) => v.i), [0, 4, 8, 15, 19, 23]);
});

test('mesures de docs/75 : 56 cases, 0 % de cases faibles, S 0 ou 1, partage 3/3, première ville à 2 pas, 4 villes à 3 pas', () => {
  plateaux.forEach(({ doc, g }) => {
    const cx = GR.connexions(doc, g);
    assert.strictEqual(cx.cases, 56);
    assert.strictEqual(cx.faibles, 0);
    assert.strictEqual(cx.part, 0);
    assert.ok(cx.conforme);
    const e = GR.equilibre(doc, { graphe: g });
    assert.ok(e.complet, e.lacunes.join(' '));
    assert.ok(e.S === 0 || e.S === 1, 'S = ' + e.S);
    assert.deepStrictEqual([e.partage[1], e.partage[2], e.partage.egalite], [3, 3, 0]);
    assert.ok(e.partageSymetrique && e.premiereEgale);
    assert.deepStrictEqual([e.premiereVille[1], e.premiereVille[2]], [2, 2]);
    assert.deepStrictEqual([e.tempo[1][3], e.tempo[2][3]], [4, 4]);
    assert.deepStrictEqual([e.alertes, e.blocages, e.informations], [[], [], []]);
    assert.ok(!e.cinqContreDeux && !e.cinqContreTrois && !e.tresDesequilibre && !e.aSurveiller);
    assert.deepStrictEqual(GR.villesProches(g), []);
    assert.deepStrictEqual(M.raccordsMorts(doc).filter((r) => r.raison !== 'absent'), []);
    // écart de 4 pas au moins entre deux villes, vérifié par parcours
    g.villes.forEach((v) => { const d = GR.distances(g, v); g.villes.forEach((w) => { if (w !== v) assert.ok(d.get(w) >= 4); }); });
  });
});

test('anneau du pourtour : une apparition verte est à 2 pas d’une rouge (par le coin neutre)', () => {
  const { g } = plateaux[0];
  const d = GR.distances(g, g.apparitions[1]);
  assert.strictEqual(Math.min(...g.apparitions[2].map((x) => d.get(x))), 2);
  // les apparitions du pourtour sont reliées le long du bord : le coin E neutre touche une verte et une rouge
  const neutres = [...g.cases.values()].filter((c) => c.type === 'apparition' && c.camp === null);
  assert.strictEqual(neutres.length, 2);
});

test('rythme, accès au centre, cases par moitié sur un plateau complet', () => {
  const { doc, g } = plateaux[0];
  const r = GR.rythme(doc, g);
  assert.strictEqual(r.zones, 6 + 18 + r.casesRaccourci.length + r.casesPassage.length - 0 || r.zones, r.zones);
  assert.strictEqual(r.casesJonction.length, 18, 'les 18 campements complets sont des zones');
  assert.ok(r.distMax <= 2 && r.chaineMax <= GR.CHAINE_CIBLE && r.injoignables === 0);
  const ac = GR.accesCentre(doc, g);
  assert.ok(ac.portes.vert > 0 && ac.portes.rouge > 0);
  assert.ok(ac.chemins.vert >= 3 && ac.chemins.rouge >= 3);
  const cm = GR.casesParMoitie(doc, g);
  assert.deepStrictEqual([cm.tuiles.vert, cm.tuiles.rouge, cm.tuiles.neutre], [14, 14, 10]);
  assert.deepStrictEqual([cm.jonctions.vert, cm.jonctions.rouge, cm.jonctions.milieu], [3, 3, 12]);
  assert.strictEqual(cm.ecart, 0);
  assert.strictEqual(cm.vert + cm.rouge + cm.tuiles.neutre + cm.jonctions.milieu, 56);
});

test('zones des sièges : milieu s’il touche la rangée neutre ; symétrie vert / rouge', () => {
  const z = F.sieges.map((s) => GR.zoneDuNoeud('J' + s.id + ',0', F)[0]).join('');
  assert.strictEqual(z, 'vvvvvmmmmmmmmmmmmmmrrrrr');
  assert.strictEqual(GR.zoneDuNoeud('2,2:a', F), 'milieu');
  assert.strictEqual(GR.zoneDuNoeud('3,0:a', F), 'vert');
  assert.strictEqual(GR.zoneDuNoeud('1,4:a', F), 'rouge');
});

test('villesProches : un plateau à rotations nulles a des villes à 3 pas (alerte), un bon plateau aucune', () => {
  const g = GR.construire(cat.plateau(M));
  const proches = GR.villesProches(g);
  assert.ok(proches.length > 0 && proches.every((p) => p.pas < 4));
  assert.deepStrictEqual(plateaux.map((p) => GR.villesProches(p.g).length), plateaux.map(() => 0));
});

test('majorité bloquante « 4 contre 2 » et partage asymétrique en information', () => {
  const { doc, g } = plateaux[0];
  const nord = [0, 1, 2, 3, 5, 6].map(jeton);
  const e = GR.equilibre(doc, { graphe: GR.construire(doc, { jetons: nord }), jetons: nord });
  assert.ok(e.cinqContreDeux && e.tresDesequilibre);
  assert.ok(e.blocages.some((b) => b.code === 'cinq_contre_deux' && /4 contre 2/.test(b.message)));
  // un partage 3 / 2 / 1 : information, aucun blocage de majorité
  const rnd = cat.alea(99);
  let trouve = null;
  for (let t = 0; t < 400 && !trouve; t++) {
    const s = new Set();
    while (s.size < 6) s.add(Math.floor(rnd() * 24));
    const js = [...s].map(jeton);
    const x = GR.equilibre(doc, { graphe: GR.construire(doc, { jetons: js }), jetons: js });
    if (!x.cinqContreDeux && !x.partageSymetrique) trouve = x;
  }
  assert.ok(trouve, 'un partage non symétrique existe');
  assert.ok(trouve.informations.some((i) => i.code === 'partage_asymetrique'));
  assert.ok(!trouve.alertes.some((a) => a.code === 'cinq_contre_trois'));
  assert.strictEqual(g.villes.size, 6);
});

test('plateau partiel : lacunes (19 tuiles, 6 villes), 7 villes, ville à moins de 3 ports', () => {
  let doc = M.nouveauDocument('hex19');
  cat.catalogue().forEach((m) => { doc = M.ajouterModele(doc, m); });
  doc = M.poserTuile(doc, 'HC2', 2, 2);
  const e = GR.equilibre(doc);
  assert.ok(e.partiel);
  assert.ok(e.lacunes.some((l) => l === 'Il manque 18 tuile(s) sur 19.'));
  const g = GR.construire(doc);
  assert.strictEqual(g.jonctions.length, 24);
  const cm = GR.casesParMoitie(doc, g);
  assert.strictEqual(cm.jonctions.milieu + cm.jonctions.vert + cm.jonctions.rouge, 0, 'aucun siège complet');
  // 7 villes
  const plein = plateaux[0].doc, sept = M.poserJeton(plein, 1, 0);
  assert.ok(GR.equilibre(sept).lacunes.includes('Il y a 7 villes pour 6 prévues.'));
  // ville sur un siège à moins de 3 ports : tuile sans port au centre
  let d = M.ajouterModele(plein, { id: 'N', exemplaires: 1, cases: [{ id: 'a', x: 0, y: 0, diametre: 20, type: 'deplacement' }], chemins: [{ id: 'r', a: { case: 'a' }, b: { raccord: { cote: 0, pos: 0 } } }] });
  d = M.retirerTuile(d, 2, 2);
  d = M.poserTuile(d, 'N', 2, 2, 0);
  const faible = F.sieges.find((s) => s.tuiles.some((t) => t.col === 2 && t.lig === 2) && !d.plateau.jetons.some((j) => j.i === s.id));
  d = M.poserJeton(d, faible.id, 0);
  const e2 = GR.equilibre(d);
  assert.ok(e2.informations.some((i) => i.code === 'ville_peu_de_ports'), 'siège ' + faible.id);
  assert.ok(GR.connexions(d).faibles >= 0);
});

test('goulets, flancs et profil acceptent un plateau hexagonal', () => {
  const { doc, g } = plateaux[1];
  const go = GR.goulets(g, 1);
  assert.strictEqual(go.parVille.length, 6);
  assert.ok(go.minChemins >= 1);
  assert.deepStrictEqual(GR.flancs(doc), []);
  assert.match(GR.profil(doc), /^\d(,\d)*\|\d(,\d)*$/);
  assert.ok(GR.reseauxPassages(doc).tailles.length > 0, 'les passages de HC2 / HC3 forment des réseaux');
});

test('passages : une case du pourtour atteint a et b du carrefour à travers le passage E–O de HC2 et le pivot de HC3', () => {
  let doc = M.nouveauDocument('hex19');
  cat.catalogue().forEach((m) => { doc = M.ajouterModele(doc, m); });
  doc = M.poserTuile(M.poserTuile(M.poserTuile(M.poserTuile(doc, 'HC2', 1, 2, 0), 'HC3', 2, 2, 0), 'HC2', 3, 2, 0), 'HK1', 4, 2);
  const g = GR.construire(doc);
  assert.ok(g.voisins.get('2,2:a').has('2,2:b'), 'pivot du carrefour : a et b voisines');
  assert.ok(g.voisins.get('4,2:p').has('2,2:a') && g.voisins.get('4,2:p').has('2,2:b'), 'à 1 pas à travers deux tuiles');
  assert.ok(!g.voisins.get('4,2:p').has('3,2:a'), 'HC2 n a aucune case sur son passage');
});
