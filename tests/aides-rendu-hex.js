'use strict';
/*
 * Aides de tests hexagonaux (lots rendu et export) : catalogue candidat de docs/75 (HC2, HC3, HB1, HK1) au format PM.modele, injecté en
 * mémoire, plateau complet de 19 tuiles et recherche de plateaux dont les villes du trèfle respectent l’écart (copie de tests/modele-hex.test.js).
 * Ce fichier n’est pas un test (node --test ne le lance pas).
 */
module.exports = (() => {
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
