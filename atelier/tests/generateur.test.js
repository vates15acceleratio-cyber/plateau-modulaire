'use strict';
const test = require('node:test');
const assert = require('node:assert');
const G = require('../src/generateur.js');
const A = globalThis.AT.alea;
const H = globalThis.AT.hex;
const C = globalThis.AT.catalogue;
const P = globalThis.AT.plateau;
const K = globalThis.AT.controles;

const COMBINAISONS = [
  { seuilContact: 2, mesureContact: 'cotes' }, { seuilContact: 2, mesureContact: 'pieces' },
  { seuilContact: 3, mesureContact: 'cotes' }, { seuilContact: 3, mesureContact: 'pieces' }
];
const GRAINES = [1, 2, 3, 4, 5, 6];

/** Vérifie tout ce que le cahier des charges (§9) promet d'un plateau généré. */
function verifierPlateau(res, options) {
  const p = res.plateau;
  assert.strictEqual(res.raison, null);
  // Toutes les pièces de construction, une fois chacune ; aucune tuile de terrain d'une case hors remplissage.
  const stock = P.stock(p);
  C.ORDRE_MODELES.forEach((id) => { if (C.estConstruction(C.MODELES[id])) assert.strictEqual(stock[id].restant, 0, id); });
  const remplissages = p.pieces.filter((x) => x.modele === 'R').length;
  assert.strictEqual(remplissages, res.remplissages);
  assert.ok(remplissages <= (options.remplissages || 0), 'pas plus de remplissages que permis');
  assert.strictEqual(p.pieces.length, 24 + remplissages + 2);
  p.pieces.forEach((x) => { if (P.modele(p, x.modele).cases.length === 1) assert.ok(['R', 'VN'].includes(x.modele), 'tuile d’une case inattendue : ' + x.modele); });
  const terrain = P.cases(p, { sansVilles: true }), cases = P.cases(p);
  assert.strictEqual(Object.keys(terrain).length, 91 + remplissages);
  assert.strictEqual(Object.keys(cases).length, 93 + remplissages);
  assert.deepStrictEqual(P.chevauchements(p), []);
  assert.deepStrictEqual(P.trous(Object.keys(terrain)), []);
  assert.deepStrictEqual(p.recouvrements, []);
  // Tous les contrôles, relancés ici avec les mêmes options : aucune erreur, étape « complet ».
  const bilan = K.tout(p, options);
  assert.strictEqual(bilan.erreurs, 0, bilan.resultats.filter((x) => x.niveau === 'erreur').map((x) => x.message).join(' | '));
  assert.strictEqual(bilan.etape, 'complet');
  assert.strictEqual(bilan.equilibre.score, res.score);
  assert.ok(Number.isInteger(res.score) && res.score >= 0);
  // Noyau au centre.
  assert.strictEqual(cases['0,0'].modele, 'N1');
  assert.deepStrictEqual(p.pieces[0], { id: 'p1', modele: 'N1', q: 0, r: 0, rotation: 0 });
  // Villes de déploiement : 2 par camp, posées sur une Plaine du bord, Vert en haut, Rouge en bas.
  const etendue = P.etendueSurCases(terrain);
  assert.deepStrictEqual(P.deploiements(p).map((x) => x.camp), ['vert', 'vert', 'rouge', 'rouge']);
  assert.strictEqual(p.camps.vert.length, 2);
  assert.strictEqual(p.camps.rouge.length, 2);
  assert.deepStrictEqual(P.campsAuto(p), p.camps);
  [['vert', (r) => r <= etendue.haut + 1], ['rouge', (r) => r >= etendue.bas - 1]].forEach(([camp, extremite]) => {
    p.camps[camp].forEach((k) => {
      assert.strictEqual(cases[k].terrain, 'ville');
      assert.strictEqual(cases[k].origine, 'plaine');
      assert.strictEqual(cases[k].ville, 'VD');
      assert.strictEqual(cases[k].camp, camp);
      assert.strictEqual(terrain[k].terrain, 'plaine');
      assert.ok(!C.modele(cases[k].modele).noyau);
      assert.ok(extremite(H.decle(k).r), camp + ' : ville hors des 2 rangées extrêmes');
      assert.ok(H.voisines(k).some((v) => !terrain[v]), 'ville de déploiement hors du bord');
    });
  });
  // Villes neutres : une tuile ajoutée contre chaque flanc.
  const etat = P.etatVilles(p);
  assert.deepStrictEqual(etat.neutres.map((n) => n.flanc).sort(), ['droite', 'gauche']);
  assert.strictEqual(etat.completes, true);
  etat.neutres.forEach((n) => assert.ok(!terrain[n.cle] && H.voisines(n.cle).filter((v) => terrain[v]).length >= 2));
  // 7 villes, toutes à 4 pas au moins les unes des autres.
  const villes = P.villes(p);
  assert.strictEqual(villes.length, 7);
  villes.forEach((a) => { const d = P.distancesPas(p, a); villes.forEach((b) => { if (a !== b) assert.ok(d[b] >= 4, a + ' et ' + b + ' à ' + d[b] + ' pas'); }); });
  // Règle de contact demandée.
  K.contacts(p).forEach((x) => { if (x.cases.length > 1) assert.ok(x[options.mesureContact] >= options.seuilContact, x.piece + ' sous le seuil'); });
  // Le plateau est un fichier valide.
  const lu = P.lire(P.serialiser(p));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  assert.deepStrictEqual(lu.plateau, p);
  assert.strictEqual(p.version, 2);
}

test('même graine et mêmes options = même plateau ; graines différentes = plateaux différents', () => {
  const a = G.generer(11), b = G.generer(11), c = G.generer(12);
  assert.deepStrictEqual(a, b);
  assert.ok(a.ok && c.ok);
  assert.notDeepStrictEqual(a.plateau.pieces, c.plateau.pieces);
  assert.strictEqual(a.plateau.graine, 11);
});

test('graine en chaîne acceptée et reproductible', () => {
  const a = G.generer('soirée du 19'), b = G.generer('soirée du 19');
  assert.deepStrictEqual(a.plateau, b.plateau);
  assert.strictEqual(a.plateau.graine, 'soirée du 19');
});

test('la génération ne dépend ni de Math.random ni de l’ordre des appels', () => {
  const reference = G.generer(5).plateau;
  const hasard = Math.random;
  try {
    Math.random = () => { throw new Error('Math.random ne doit pas servir'); };
    G.generer(99);
    assert.deepStrictEqual(G.generer(5).plateau, reference);
  } finally {
    Math.random = hasard;
  }
});

for (const options of COMBINAISONS) {
  test('seuil ' + options.seuilContact + ', mesure « ' + options.mesureContact + ' » : un plateau rendu est complet et sans erreur ; un échec est expliqué', () => {
    let reussites = 0;
    for (const graine of GRAINES) {
      const res = G.generer(graine, options);
      if (res.ok) {
        reussites += 1;
        verifierPlateau(res, options);
      } else {
        assert.strictEqual(res.plateau, null);
        assert.ok(typeof res.raison === 'string' && res.raison.length > 0);
      }
    }
    // Mesuré sur 300 graines (docs/07-mesures-catalogue-2.md) : le générateur réussit presque toujours.
    assert.ok(reussites >= GRAINES.length - 1, reussites + ' réussite(s) sur ' + GRAINES.length + ' graines');
  });
}

test('réglage par défaut : seuil 3, mesure « pièces », aucun remplissage', () => {
  const res = G.generer(3);
  assert.ok(res.ok, res.raison);
  verifierPlateau(res, { seuilContact: 3, mesureContact: 'pieces' });
  assert.strictEqual(res.remplissages, 0);
  assert.deepStrictEqual(G.generer(3, { seuilContact: 3, mesureContact: 'pieces' }).plateau, res.plateau);
  assert.strictEqual(C.REGLAGES.mesureContact, 'pieces');
  assert.strictEqual(C.REGLAGES.generateur.remplissages, 0);
});

test('tuiles de remplissage : posées seulement si le réglage le permet, jamais plus que le stock', () => {
  let posees = 0;
  for (const graine of GRAINES) {
    const res = G.generer(graine, { remplissages: 2 });
    assert.ok(res.ok, res.raison);
    verifierPlateau(res, { seuilContact: 3, mesureContact: 'pieces', remplissages: 2 });
    posees += res.remplissages;
  }
  assert.ok(posees <= 2 * GRAINES.length);
  const trop = G.generer(1, { remplissages: 3 });
  assert.strictEqual(trop.ok, false);
  assert.strictEqual(trop.incompatible, true);
  assert.match(trop.raison, /3 tuiles de remplissage : le catalogue en compte 2/);
  assert.match(G.generer(1, { remplissages: -1 }).raison, /remplissage invalide/);
});

test('le plateau est construit librement : les formes varient d’une graine à l’autre', () => {
  const formes = new Set(), hauteurs = new Set();
  for (const graine of GRAINES) {
    const res = G.generer(graine);
    assert.ok(res.ok, res.raison);
    const terrain = P.cases(res.plateau, { sansVilles: true }), e = P.etendueSurCases(terrain);
    formes.add(H.trier(Object.keys(terrain)).join(' '));
    hauteurs.add(e.bas - e.haut + 1);
    assert.ok(e.haut >= -5 && e.bas <= 5, 'réglage demiHauteur : le plateau tient dans 11 rangées');
  }
  assert.strictEqual(formes.size, GRAINES.length);
  const libre = G.generer(2, { demiHauteur: null });
  assert.ok(libre.ok, libre.raison);
});

test('batir : un terrain réussi porte toutes les pièces, sans trou ; un échec nomme son étape', () => {
  const cat = G.piecesDuCatalogue();
  assert.strictEqual(cat.noyau.id, 'N1');
  assert.strictEqual(cat.pieces.length, 23);
  assert.strictEqual(cat.remplissage.id, 'R');
  let reussis = 0;
  for (const graine of GRAINES) {
    const res = G.batir(A.creer(graine), cat.noyau, cat.pieces, cat.remplissage, G.reglages({ remplissages: 2 }));
    if (!res.ok) { assert.ok(['pose', 'trou', 'franchissable', 'contact', 'contactRemplissage'].includes(res.echec)); continue; }
    reussis += 1;
    assert.strictEqual(Object.keys(res.cases).length, 91 + res.remplissages);
    assert.strictEqual(res.pieces.length, 24 + res.remplissages);
    assert.deepStrictEqual(res.pieces[0], { modele: 'N1', q: 0, r: 0, rotation: 0 });
    assert.deepStrictEqual(P.trous(Object.keys(res.cases)), []);
    // Les cases annoncées sont bien celles des pièces posées.
    res.pieces.forEach((x, i) => P.casesModele(x.modele, x.q, x.r, x.rotation).forEach((c) => {
      assert.strictEqual(res.cases[c.cle].piece, 'p' + (i + 1));
      assert.strictEqual(res.cases[c.cle].terrain, c.terrain);
    }));
  }
  assert.ok(reussis >= GRAINES.length - 1);
});

test('chercherVilles : 2 villes par camp et une ville neutre par flanc, ou un refus qui dit ce qui manque', () => {
  const cat = G.piecesDuCatalogue(), R = G.reglages({ remplissages: 2 });
  let trouvees = 0;
  for (const graine of GRAINES) {
    const terrain = G.batir(A.creer(graine), cat.noyau, cat.pieces, cat.remplissage, R);
    if (!terrain.ok) continue;
    const v = G.chercherVilles(terrain.cases, A.creer(graine), R);
    assert.strictEqual(typeof v.places.vert, 'number');
    if (!v.ok) { assert.ok(['vert', 'rouge', 'gauche', 'droite', 'ecart'].includes(v.manque)); assert.ok(v.raison.length > 0); continue; }
    trouvees += 1;
    assert.strictEqual(v.vert.length, 2);
    assert.strictEqual(v.rouge.length, 2);
    assert.ok(v.neutres.gauche && v.neutres.droite);
    v.vert.concat(v.rouge).forEach((k) => assert.strictEqual(terrain.cases[k].terrain, 'plaine'));
    assert.ok(!terrain.cases[v.neutres.gauche] && !terrain.cases[v.neutres.droite]);
  }
  assert.ok(trouvees >= 1);
  // Profondeur 1 : presque jamais de place (mesuré) ; le refus est expliqué.
  const etroit = G.batir(A.creer(3), cat.noyau, cat.pieces, cat.remplissage, R);
  const refus = G.chercherVilles(etroit.cases, A.creer(3), G.reglages({ ecartVilles: 30 }));
  assert.strictEqual(refus.ok, false);
  assert.ok(refus.raison.length > 0);
});

test('échec expliqué : pas de plateau, pas de repli silencieux', () => {
  const impossible = G.generer(1, { ecartVilles: 30, tentatives: 3 });
  assert.strictEqual(impossible.ok, false);
  assert.strictEqual(impossible.plateau, null);
  assert.match(impossible.raison, /Aucun plateau valide en 3 essais/);
  assert.strictEqual(impossible.essais, 3);
  assert.strictEqual(Object.keys(impossible.echecs).reduce((n, k) => n + impossible.echecs[k], 0), 3);
  assert.match(G.generer(1, { mesureContact: 'autre' }).raison, /Mesure de contact inconnue/);
  assert.match(G.generer(1, { tentatives: 0 }).raison, /tentatives/);
  assert.match(G.generer(1, { seuilContact: 9 }).raison, /Seuil de contact invalide/);
});

test('le nombre de tentatives est un réglage ; un plateau se génère en moins de 2 secondes', () => {
  const une = G.generer(4, { tentatives: 1 });
  assert.strictEqual(une.essais, 1);
  const debut = Date.now();
  const res = G.generer(21);
  const duree = Date.now() - debut;
  assert.ok(res.ok, res.raison);
  assert.ok(duree < 2000, 'génération en ' + duree + ' ms');
  assert.ok(res.essais >= 1);
});

test('le générateur ne modifie pas les réglages du catalogue', () => {
  const avant = JSON.stringify(C.REGLAGES);
  G.generer(2, { seuilContact: 2, mesureContact: 'pieces', tentatives: 3, remplissages: 1 });
  assert.strictEqual(JSON.stringify(C.REGLAGES), avant);
});

test('pièces personnelles du document : reportées dans le plateau généré, non posées', () => {
  const persos = [{ id: 'X1', nom: 'Bois long', cases: [{ q: 0, r: 0, terrain: 'foret' }, { q: 1, r: 0, terrain: 'foret' }], quantite: 2 }];
  const res = G.generer(8, { modeles: persos });
  assert.ok(res.ok, res.raison);
  assert.deepStrictEqual(res.plateau.modeles, persos);
  assert.match(res.note, /conservée dans le plateau, non posée/);
  assert.strictEqual(res.plateau.pieces.some((x) => x.modele === 'X1'), false);
  assert.deepStrictEqual(G.generer(8).plateau.pieces, res.plateau.pieces);
  assert.match(G.generer(8, { modeles: [{ id: 'P', nom: 'x', cases: [], quantite: 1 }] }).raison, /Pièces personnelles du document invalides/);
});

test('catalogue hors de ce que le générateur sait faire : échec immédiat qui nomme la cause', () => {
  assert.strictEqual(G.incompatibilite(G.reglages()), null);
  const nombre = C.MODELES.VN.nombre, parCamp = C.REGLAGES.villesParCamp;
  try {
    C.MODELES.VN.nombre = 3;
    const res = G.generer(1);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.incompatible, true);
    assert.match(res.raison, /2 villes neutres/);
    assert.strictEqual(res.essais, 0);
    C.MODELES.VN.nombre = nombre;
    C.REGLAGES.villesParCamp = 3;
    assert.match(G.generer(1).raison, /villesParCamp = 3/);
  } finally {
    C.MODELES.VN.nombre = nombre;
    C.REGLAGES.villesParCamp = parCamp;
  }
  assert.ok(G.generer(1).ok);
});

test('le générateur pose ce que le catalogue contient : un monobloc de plus est posé lui aussi', () => {
  const nombre = C.MODELES.F12A.nombre;
  try {
    C.MODELES.F12A.nombre = 2;
    const res = G.generer(4);
    assert.ok(res.ok, res.raison);
    assert.strictEqual(res.plateau.pieces.filter((x) => x.modele === 'F12A').length, 2);
    assert.strictEqual(Object.keys(P.cases(res.plateau, { sansVilles: true })).length, 94);
  } finally {
    C.MODELES.F12A.nombre = nombre;
  }
});
