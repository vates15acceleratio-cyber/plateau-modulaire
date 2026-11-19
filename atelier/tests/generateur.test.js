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

/** Vérifie tout ce que le cahier des charges promet d'un plateau généré. */
function verifierPlateau(res, options) {
  const p = res.plateau;
  assert.strictEqual(res.raison, null);
  // Toutes les pièces du catalogue, 91 cases, pas de chevauchement.
  assert.strictEqual(p.pieces.length, 64);
  const stock = P.stock(p);
  C.ORDRE_MODELES.forEach((id) => assert.strictEqual(stock[id].restant, 0, id));
  const cases = P.cases(p), cles = Object.keys(cases);
  assert.strictEqual(cles.length, 91);
  assert.deepStrictEqual(P.chevauchements(p), []);
  assert.deepStrictEqual(p.recouvrements, []);
  // Tous les contrôles de niveau erreur, relancés ici avec les mêmes options.
  const bilan = K.tout(p, options);
  assert.strictEqual(bilan.erreurs, 0, bilan.resultats.filter((x) => x.niveau === 'erreur').map((x) => x.message).join(' | '));
  assert.strictEqual(bilan.equilibre.score, res.score);
  // Forme symétrique par demi-tour, noyau au centre.
  cles.forEach((k) => assert.ok(cases[H.symetrique(k)], 'pas de symétrique pour ' + k));
  assert.strictEqual(cases['0,0'].modele, 'N1');
  assert.deepStrictEqual(p.pieces[0], { id: 'p1', modele: 'N1', q: 0, r: 0, rotation: 0 });
  // Villes de déploiement : Vert sur la rangée r minimale, Rouge sur la rangée r maximale.
  const rs = cles.map((k) => H.decle(k).r), haut = Math.min(...rs), bas = Math.max(...rs);
  assert.strictEqual(p.camps.vert.length, 2);
  assert.strictEqual(p.camps.rouge.length, 2);
  p.camps.vert.forEach((k) => { assert.strictEqual(H.decle(k).r, haut); assert.strictEqual(cases[k].terrain, 'ville'); });
  p.camps.rouge.forEach((k) => { assert.strictEqual(H.decle(k).r, bas); assert.strictEqual(cases[k].terrain, 'ville'); });
  assert.deepStrictEqual(P.campsAuto(p), p.camps);
  assert.strictEqual(P.villes(p).length, 7);
  // Règle de contact demandée.
  K.contacts(p).forEach((x) => assert.ok(x[options.mesureContact] >= options.seuilContact, x.piece + ' sous le seuil'));
  // Le plateau est un fichier valide.
  const lu = P.lire(P.serialiser(p));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  assert.deepStrictEqual(lu.plateau, p);
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
    // Mesuré sur 200 graines (docs/03-mesures-faisabilite.md) : les quatre combinaisons réussissent presque toujours.
    assert.ok(reussites >= 1, 'aucune réussite sur ' + GRAINES.length + ' graines');
  });
}

test('réglage par défaut : seuil 3, mesure « pièces »', () => {
  const res = G.generer(3);
  assert.ok(res.ok, res.raison);
  verifierPlateau(res, { seuilContact: 3, mesureContact: 'pieces' });
  assert.deepStrictEqual(G.generer(3, { seuilContact: 3, mesureContact: 'pieces' }).plateau, res.plateau);
});

test('les plateaux générés ne sont pas tous l’hexagone régulier : la forme du bord varie', () => {
  const formes = new Set(), hexagone = H.trier(H.disque(5)).join(' ');
  for (const graine of GRAINES) {
    const res = G.generer(graine, { seuilContact: 2 });
    assert.ok(res.ok, res.raison);
    assert.strictEqual(res.forme, H.trier(Object.keys(P.cases(res.plateau))).join(' '));
    assert.notStrictEqual(res.forme, hexagone);
    formes.add(res.forme);
  }
  assert.ok(formes.size >= GRAINES.length - 1);
});

test('tirerForme : 91 cases, symétrique, noyau intact, chaque case a assez de voisines', () => {
  for (const seuil of [2, 3]) {
    const R = G.reglages({ seuilContact: seuil });
    const forme = G.tirerForme(A.creer(8), R);
    assert.ok(forme.ok);
    assert.strictEqual(forme.cases.length, 91);
    const dans = new Set(forme.cases);
    H.disque(1).forEach((k) => assert.ok(dans.has(k)));
    forme.cases.forEach((k) => {
      assert.ok(dans.has(H.symetrique(k)));
      assert.ok(H.voisines(k).filter((v) => dans.has(v)).length >= seuil);
    });
    assert.strictEqual(G.formeValide(dans, R), true);
  }
  const R3 = G.reglages({ seuilContact: 3 });
  const pointe = new Set(H.disque(5));
  pointe.delete('2,3'); pointe.delete('-2,-3'); pointe.add('6,-3'); pointe.add('-6,3');   // une case isolée qui dépasse : 2 voisines
  assert.strictEqual(pointe.size, 91);
  assert.strictEqual(G.formeValide(pointe, R3), false);
  assert.strictEqual(G.formeValide(pointe, G.reglages({ seuilContact: 2 })), true);
});

test('échec expliqué : pas de plateau, pas de repli silencieux', () => {
  const impossible = G.generer(1, { seuilContact: 6, essaisForme: 20 });
  assert.strictEqual(impossible.ok, false);
  assert.strictEqual(impossible.plateau, null);
  assert.match(impossible.raison, /Aucune forme de bord valide/);
  assert.strictEqual(impossible.echecs.forme, 1);
  assert.match(G.generer(1, { mesureContact: 'autre' }).raison, /Mesure de contact inconnue/);
  assert.match(G.generer(1, { tentatives: 0 }).raison, /tentatives/);
  // Des villes exigées à 9 pas : aucune rangée du haut ne peut en porter deux.
  const villes = G.generer(1, { ecartVilles: 9, essaisForme: 20 });
  assert.strictEqual(villes.ok, false);
  assert.ok(villes.raison.length > 0);
});

test('le nombre de tentatives est un réglage ; un plateau se génère en moins de 2 secondes', () => {
  const une = G.generer(4, { tentatives: 1, formes: 1, seuilContact: 2 });
  assert.ok(une.essais <= 1);
  const debut = Date.now();
  const res = G.generer(21);
  const duree = Date.now() - debut;
  assert.ok(res.ok, res.raison);
  assert.ok(duree < 2000, 'génération en ' + duree + ' ms');
  assert.ok(res.essais >= 1 && res.formesEssayees >= 1 && res.tiragesForme >= 1);
});

test('le générateur ne modifie pas les réglages du catalogue', () => {
  const avant = JSON.stringify(C.REGLAGES);
  G.generer(2, { seuilContact: 2, mesureContact: 'pieces', tentatives: 3 });
  assert.strictEqual(JSON.stringify(C.REGLAGES), avant);
});

test('catalogue ou rayon hors de ce que le générateur sait poser : échec immédiat qui nomme la cause', () => {
  const Cat = globalThis.AT.catalogue;
  const copie = JSON.stringify(Cat.MODELES), ordre = Cat.ORDRE_MODELES.slice(), parCamp = Cat.REGLAGES.villesParCamp;
  const restaurer = () => {
    const m = JSON.parse(copie);
    Object.keys(Cat.MODELES).forEach((k) => { delete Cat.MODELES[k]; });
    Object.keys(m).forEach((k) => { Cat.MODELES[k] = m[k]; });
    Cat.ORDRE_MODELES.length = 0;
    ordre.forEach((k) => Cat.ORDRE_MODELES.push(k));
    Cat.REGLAGES.villesParCamp = parCamp;
  };
  const echec = (motif) => {
    const r = G.generer(1);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.incompatible, true);
    assert.strictEqual(r.essais, 0, 'aucun essai de remplissage lancé');
    assert.match(r.raison, motif);
    assert.match(r.raison, /générateur doit être adapté/);
  };
  assert.strictEqual(G.incompatibilite(G.reglages()), null);
  try {
    // 8 villes au lieu de 6 (total inchangé de 91 cases).
    Cat.MODELES.V.nombre = 8; Cat.MODELES.P.nombre = 37;
    echec(/8 villes d’une case, or le générateur en pose 6/);
    restaurer();
    // Un monobloc de plus.
    Cat.MODELES.X3 = { id: 'X3', nom: 'Essai', nombre: 1, cases: Cat.MODELES.F3.cases };
    Cat.ORDRE_MODELES.push('X3');
    Cat.MODELES.P.nombre = 36;
    echec(/ne sait pas poser : X3 \(monobloc\)/);
    restaurer();
    // Deux exemplaires d'un monobloc connu.
    Cat.MODELES.M4.nombre = 2; Cat.MODELES.P.nombre = 35;
    echec(/un seul exemplaire de chaque monobloc.*M4 × 2/);
    restaurer();
    // Un modèle d'une case inconnu.
    Cat.MODELES.D = { id: 'D', nom: 'Désert', nombre: 1, cases: [{ q: 0, r: 0, terrain: 'plaine' }] };
    Cat.ORDRE_MODELES.push('D');
    Cat.MODELES.P.nombre = 38;
    echec(/ne sait pas poser : D \(une case\)/);
    restaurer();
    // Nombre de cases différent de celui de l'hexagone de départ.
    Cat.MODELES.P.nombre = 40;
    echec(/Le catalogue compte 92 cases, or l’hexagone de départ de rayon 5 en compte 91/);
    restaurer();
    Cat.REGLAGES.villesParCamp = 3;
    echec(/villesParCamp = 3/);
    restaurer();
  } finally {
    restaurer();
  }
  // Rayon donné en option.
  for (const rayon of [4, 6]) {
    const r = G.generer(1, { rayon: rayon });
    assert.strictEqual(r.ok, false);
    assert.match(r.raison, new RegExp('91 cases, or l’hexagone de départ de rayon ' + rayon + ' en compte ' + (3 * rayon * (rayon + 1) + 1)));
  }
  // Ce qui se change librement continue de marcher : 7 forêts et 37 plaines.
  try {
    Cat.MODELES.F.nombre = 7; Cat.MODELES.P.nombre = 37;
    assert.strictEqual(G.generer(1, { seuilContact: 2 }).ok, true);
  } finally {
    restaurer();
  }
  assert.strictEqual(G.generer(1).ok, true, 'catalogue restauré');
});
