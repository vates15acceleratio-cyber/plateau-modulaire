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
  assert.strictEqual(p.pieces.length, 24 + remplissages);
  p.pieces.forEach((x) => { if (P.modele(p, x.modele).cases.length === 1) assert.strictEqual(x.modele, 'R', 'tuile d’une case inattendue : ' + x.modele); });
  const terrain = P.cases(p, { sansVilles: true }), cases = P.cases(p);
  assert.strictEqual(Object.keys(terrain).length, 91 + remplissages);
  assert.strictEqual(Object.keys(cases).length, 91 + remplissages, 'les villes n’ajoutent aucune case');
  assert.deepStrictEqual(P.chevauchements(p), []);
  assert.deepStrictEqual(P.trous(Object.keys(terrain)), []);
  assert.deepStrictEqual(p.recouvrements, []);
  // Tous les contrôles, relancés ici avec les mêmes options : aucune erreur, étape « complet ».
  const bilan = K.tout(p, options);
  assert.strictEqual(bilan.erreurs, 0, bilan.resultats.filter((x) => x.niveau === 'erreur').map((x) => x.message).join(' | '));
  assert.strictEqual(bilan.etape, 'complet');
  assert.strictEqual(bilan.equilibre.score, res.score);
  // §10, C5 : le résultat dit le score, le camp avantagé, et annonce un déséquilibre marqué (jamais un rejet).
  assert.strictEqual(res.avantage, bilan.equilibre.avantage);
  assert.strictEqual(res.avantageTexte, bilan.equilibre.avantageTexte);
  assert.strictEqual(res.annonce === null, res.score <= C.REGLAGES.equilibre.seuilAnnonce);
  if (res.annonce) assert.match(res.annonce, /^Déséquilibre marqué : score \d+/);
  assert.ok(Number.isInteger(res.score) && res.score >= 0);
  // Noyau au centre.
  assert.strictEqual(cases['0,0'].modele, 'N1');
  assert.deepStrictEqual(p.pieces[0], { id: 'p1', modele: 'N1', q: 0, r: 0, rotation: 0 });
  // Villes (§10) : 2 neutres puis 2 par camp, toutes posées par-dessus une Plaine hors noyau ; aucune ville en pièce.
  assert.deepStrictEqual(P.deploiements(p).map((x) => x.camp), ['neutre', 'neutre', 'vert', 'vert', 'rouge', 'rouge']);
  assert.strictEqual(p.camps.vert.length, 2);
  assert.strictEqual(p.camps.rouge.length, 2);
  assert.deepStrictEqual(P.campsAuto(p), p.camps);
  assert.ok(!('profondeurExtremite' in p));
  P.deploiements(p).forEach((d) => {
    const k = d.cle;
    assert.strictEqual(cases[k].terrain, 'ville');
    assert.strictEqual(cases[k].origine, 'plaine');
    assert.strictEqual(cases[k].ville, d.camp === 'neutre' ? 'VNP' : 'VD');
    assert.strictEqual(cases[k].camp, d.camp);
    assert.strictEqual(terrain[k].terrain, 'plaine');
    assert.ok(!C.modele(cases[k].modele).noyau);
  });
  const etat = P.etatVilles(p);
  assert.strictEqual(etat.completes, true);
  assert.strictEqual(etat.reglesPrecedentes, false);
  assert.deepStrictEqual(etat.neutres.map((n) => [n.piece, n.ancienne]), [[null, false], [null, false]]);
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
    const terrain = P.cases(res.plateau, { sansVilles: true }), rs = Object.keys(terrain).map((k) => H.decle(k).r);
    const haut = Math.min(...rs), bas = Math.max(...rs);
    formes.add(H.trier(Object.keys(terrain)).join(' '));
    hauteurs.add(bas - haut + 1);
    assert.ok(haut >= -5 && bas <= 5, 'réglage demiHauteur : le plateau tient dans 11 rangées');
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

test('chercherVilles (§10) : 2 villes neutres et 2 par camp sur des Plaines, déterministe, ou un refus qui dit ce qui manque', () => {
  const cat = G.piecesDuCatalogue(), R = G.reglages({ remplissages: 2 });
  let trouvees = 0;
  for (const graine of GRAINES) {
    const terrain = G.batir(A.creer(graine), cat.noyau, cat.pieces, cat.remplissage, R);
    if (!terrain.ok) continue;
    const v = G.chercherVilles(terrain.cases, R);
    assert.strictEqual(typeof v.places, 'number');
    if (!v.ok) { assert.ok(['places', 'ecart'].includes(v.manque)); assert.ok(v.raison.length > 0); continue; }
    trouvees += 1;
    assert.deepStrictEqual([v.neutres.length, v.vert.length, v.rouge.length], [2, 2, 2]);
    const six = v.neutres.concat(v.vert, v.rouge);
    assert.strictEqual(new Set(six).size, 6);
    six.forEach((k) => { assert.strictEqual(terrain.cases[k].terrain, 'plaine'); assert.notStrictEqual(terrain.cases[k].modele, 'N1'); });
    // Toutes à 4 pas au moins les unes des autres et du centre.
    six.concat(['0,0']).forEach((a) => { const d = P.pasSurCases(terrain.cases, [a]); six.forEach((b) => { if (a !== b) assert.ok(d[b] >= 4, a + ' et ' + b); }); });
    // Aucun tirage : le même terrain donne le même placement ; le premier de la liste des propositions est celui-là.
    assert.deepStrictEqual(G.chercherVilles(terrain.cases, R), v);
    const propositions = G.propositionsVilles(terrain.cases, R);
    assert.ok(propositions.length >= 1 && propositions.length <= C.REGLAGES.villes.propositionsMax);
    assert.strictEqual(G.signatureVilles(propositions[0]), G.signatureVilles(v));
    assert.strictEqual(propositions[0].score, v.score);
    for (let i = 1; i < propositions.length; i++) assert.ok(propositions[i].score >= propositions[i - 1].score, 'du mieux équilibré au moins équilibré');
    assert.strictEqual(new Set(propositions.map(G.signatureVilles)).size, propositions.length, 'aucune proposition en double');
  }
  assert.ok(trouvees >= 1);
  // Écart impossible : le refus est expliqué.
  const etroit = G.batir(A.creer(3), cat.noyau, cat.pieces, cat.remplissage, R);
  const refus = G.chercherVilles(etroit.cases, G.reglages({ ecartVilles: 30 }));
  assert.strictEqual(refus.ok, false);
  assert.strictEqual(refus.manque, 'places');
  assert.match(refus.raison, /^Pas assez de Plaines admissibles pour les 6 villes : 0 /);
});

test('générateur (§10, C5 et C6) : aucun plateau écarté pour déséquilibre, il est annoncé ; « regrouper forêts et marais » est une option', () => {
  // Seuil d'annonce abaissé le temps du test : le plateau est rendu quand même, avec l'annonce.
  const seuil = C.REGLAGES.equilibre.seuilAnnonce;
  try {
    C.REGLAGES.equilibre.seuilAnnonce = -1;
    const res = G.generer(3);
    assert.ok(res.ok, res.raison);
    assert.match(res.annonce, /^Déséquilibre marqué : score \d+, au-delà du seuil d’annonce \(-1\) ; (aucun camp avantagé|avantage )/);
    assert.strictEqual(res.controles.ok, true);
    assert.ok(res.controles.resultats.some((x) => x.regle === 'equilibre' && x.niveau === 'alerte'));
  } finally {
    C.REGLAGES.equilibre.seuilAnnonce = seuil;
  }
  assert.strictEqual(G.generer(3).annonce, null);
  // Option cochée = accolerSpeciales 2 ; décochée = 0 (le défaut).
  const avec = G.generer(9, { accolerSpeciales: 2 });
  assert.ok(avec.ok, avec.raison);
  assert.deepStrictEqual(G.generer(9, { accolerSpeciales: 0 }).plateau, G.generer(9).plateau);
  assert.notDeepStrictEqual(avec.plateau.pieces, G.generer(9).plateau.pieces);
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
  const nombre = C.REGLAGES.villes.neutres, parCamp = C.REGLAGES.villesParCamp;
  try {
    C.REGLAGES.villes.neutres = 3;
    const res = G.generer(1);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.incompatible, true);
    assert.match(res.raison, /2 villes neutres/);
    assert.strictEqual(res.essais, 0);
    C.REGLAGES.villes.neutres = nombre;
    C.REGLAGES.villesParCamp = 3;
    assert.match(G.generer(1).raison, /villesParCamp = 3/);
  } finally {
    C.REGLAGES.villes.neutres = nombre;
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
