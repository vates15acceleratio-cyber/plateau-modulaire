'use strict';
const test = require('node:test');
const assert = require('node:assert');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const C = globalThis.AT.cartes;
const T = globalThis.AT.partie;

// ------------------------------------------------------------------------------------------------
// Doubles du lot A, conformes au contrat du cahier des charges (aucun fichier du lot A n'est chargé)
// ------------------------------------------------------------------------------------------------

/** Aléa à graine minimal : { suivant, entier, de, melanger (copie), choisir, etat, restaurer }. */
function creerAlea(graine) {
  let s = 0;
  String(graine).split('').forEach((c) => { s = (Math.imul(s, 31) + c.charCodeAt(0)) >>> 0; });
  const a = {
    suivant() {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    entier(n) { return Math.floor(a.suivant() * n); },
    de() { return 1 + a.entier(6); },
    melanger(tableau) {
      const c = tableau.slice();
      for (let i = c.length - 1; i > 0; i--) { const j = a.entier(i + 1); const x = c[i]; c[i] = c[j]; c[j] = x; }
      return c;
    },
    choisir(tableau) { return tableau[a.entier(tableau.length)]; },
    etat() { return { s: s }; },
    restaurer(e) { s = e.s >>> 0; }
  };
  return a;
}

/** Géométrie minimale : clés 'q,r' et voisines. */
const hex = {
  DIRS: [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]],
  cle(q, r) { return q + ',' + r; },
  decle(cle) { const p = cle.split(','); return { q: Number(p[0]), r: Number(p[1]) }; },
  voisines(cle) { const c = hex.decle(cle); return hex.DIRS.map((d) => hex.cle(c.q + d[0], c.r + d[1])); },
  distance(a, b) {
    const x = hex.decle(a), y = hex.decle(b);
    return (Math.abs(x.q - y.q) + Math.abs(x.r - y.r) + Math.abs(x.q + x.r - y.q - y.r)) / 2;
  }
};

const TERRAINS = { P: 'plaine', F: 'foret', S: 'marais', V: 'ville', M: 'montagne' };
const COUTS = { plaine: 1, foret: 2, marais: 2, ville: 1, montagne: Infinity, crevasse: Infinity, campement: 1, boue: 3 };
const EFFETS = { E1: 'boue', E2: 'crevasse', E8: 'campement' };

/** Plateau factice : chaque pièce est une case ; les recouvrements changent le terrain. */
const fauxPlateau = {
  cases(plateau) {
    const cases = {};
    plateau.pieces.forEach((p) => {
      cases[hex.cle(p.q, p.r)] = { terrain: TERRAINS[p.modele], piece: p.id, origine: TERRAINS[p.modele] };
    });
    plateau.recouvrements.forEach((rc) => { if (cases[rc.cle]) cases[rc.cle].terrain = EFFETS[rc.evenement] || 'plaine'; });
    return cases;
  },
  cout(plateau, cle) {
    const c = fauxPlateau.cases(plateau)[cle];
    return c ? COUTS[c.terrain] : Infinity;
  },
  villes(plateau) {
    const cases = fauxPlateau.cases(plateau);
    return Object.keys(cases).filter((k) => cases[k].terrain === 'ville');
  },
  poserEvenement(plateau, idEvenement, cle) {
    const cases = fauxPlateau.cases(plateau);
    if (!cases[cle]) return { ok: false, plateau: plateau, raison: 'Case hors du plateau.' };
    if (cases[cle].terrain !== 'plaine') return { ok: false, plateau: plateau, raison: 'Cette tuile se pose sur une plaine.' };
    const copie = JSON.parse(JSON.stringify(plateau));
    copie.recouvrements.push({ evenement: idEvenement, cle: cle });
    return { ok: true, plateau: copie, raison: null };
  },
  retirerEvenement(plateau, cle) {
    const copie = JSON.parse(JSON.stringify(plateau));
    copie.recouvrements = copie.recouvrements.filter((rc) => rc.cle !== cle);
    return { ok: true, plateau: copie, raison: null };
  }
};

/**
 * Hexagone de rayon 2 (19 cases). Villes de déploiement : Vert en 0,-2 et 2,-2 (rangée du haut),
 * Rouge en -2,2 et 0,2 (rangée du bas). Ville au centre, montagne en 1,0, forêt en 0,-1, marais en 0,1.
 */
function plateauExemple() {
  const speciales = { '0,0': 'V', '0,-2': 'V', '2,-2': 'V', '-2,2': 'V', '0,2': 'V', '1,0': 'M', '0,-1': 'F', '0,1': 'S' };
  const pieces = [];
  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      if (Math.abs(q + r) > 2) continue;
      pieces.push({ id: 'p' + pieces.length, modele: speciales[q + ',' + r] || 'P', q: q, r: r, rotation: 0 });
    }
  }
  return { version: 1, graine: 'essai', pieces: pieces, recouvrements: [], camps: { vert: ['0,-2', '2,-2'], rouge: ['-2,2', '0,2'] } };
}

function creerEnv(graine) { return { alea: creerAlea(graine), hex: hex, plateau: fauxPlateau }; }

function geler(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.keys(o).forEach((k) => geler(o[k]));
  }
  return o;
}

/** Nouvelle partie (état gelé : toute modification en place ferait échouer le test). */
function nouvelle(graine, options) {
  const g = graine === undefined ? 'g1' : graine;
  const env = creerEnv(g);
  const r = T.creer(Object.assign({ graine: g, plateau: plateauExemple() }, options || {}), env);
  assert.ok(r.ok, r.raison);
  return { etat: geler(r.etat), env: env };
}

/** Enchaîne une opération qui doit réussir et renvoie le résultat (état gelé). */
function faire(r) {
  assert.ok(r.ok, r.raison + ' ' + JSON.stringify(r.avertissements));
  geler(r.etat);
  return r;
}

function codes(r) { return r.avertissements.map((a) => a.code); }
function dernier(etat) { return etat.journal[etat.journal.length - 1]; }
function main(etat, joueur) { return etat.paquets[joueur].main; }

/** Partie avec le bataillon 1 de Vert formé en 0,-2. */
function avecBataillon(graine) {
  const p = nouvelle(graine);
  const r = faire(T.former(p.etat, { joueur: 'vert', numero: 1, carte: main(p.etat, 'vert')[0], cle: '0,-2' }, p.env));
  return { etat: r.etat, env: p.env };
}

// ------------------------------------------------------------------------------------------------
// Création
// ------------------------------------------------------------------------------------------------

test('module exposé sous AT.partie et par module.exports ; REGLAGES partagés', () => {
  assert.equal(require('../src/partie.js'), T);
  assert.equal(T.REGLAGES, C.REGLAGES);
});

test('chargement par simples balises <script> : sans module ni require, dans l’ordre cartes, paquets, partie', () => {
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  const contexte = vm.createContext({});
  for (const f of ['cartes.js', 'paquets.js', 'partie.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), contexte, { filename: f });
  }
  const AT = vm.runInContext('AT', contexte);
  assert.deepEqual(Object.keys(AT).sort(), ['cartes', 'paquets', 'partie']);
  const env = creerEnv('nav');
  const r = AT.partie.creer({ graine: 'nav', plateau: plateauExemple() }, env);
  assert.equal(r.ok, true, r.raison);
  assert.equal(JSON.stringify(r.etat), JSON.stringify(nouvelle('nav').etat));
  const d = AT.partie.lancerDes(r.etat, { n: 2 }, env);
  assert.equal(d.ok, true);
});

test('creer : un plateau sans graine (chaîne vide ou null) est accepté', () => {
  for (const g of ['', null]) {
    const plateau = plateauExemple();
    plateau.graine = g;
    const r = T.creer({ graine: 'g', plateau: plateau }, creerEnv('g'));
    assert.ok(r.ok, r.raison);
    assert.ok(T.charger(T.serialiser(r.etat), creerEnv('g')).ok);
  }
});

test('creer : mise en place des règles V2.3', () => {
  const { etat } = nouvelle();
  assert.equal(etat.format, 'atelier-partie');
  assert.equal(etat.tour, 1);
  assert.equal(etat.actif, 'vert');
  assert.equal(etat.actions, 0);
  assert.deepEqual(etat.gloire, { vert: 0, rouge: 0 });
  // main de départ 2, plus 1 carte piochée par le premier joueur pour son premier tour
  assert.equal(main(etat, 'vert').length, 3);
  assert.equal(main(etat, 'rouge').length, 2);
  assert.equal(etat.paquets.vert.pioche.length, 17);
  assert.equal(etat.paquets.rouge.pioche.length, 18);
  assert.equal(Object.keys(etat.exemplaires).length, 40);
  assert.equal(etat.paquets.campement.pioche.length, 15);
  assert.equal(etat.paquets.evenements.pioche.length, 8);
  for (const j of ['vert', 'rouge']) {
    assert.equal(etat.bataillons[j].length, 4);
    etat.bataillons[j].forEach((b, i) => assert.deepEqual(b, { numero: i + 1, case: null, troupes: [], campement: false }));
  }
  assert.deepEqual(etat.villes, {});
  assert.equal(Object.keys(etat.troupes).length, 12);
  Object.keys(etat.troupes).forEach((id) => assert.equal(etat.troupes[id].provisoire, true));
  assert.ok(etat.journal.length >= 4);
  assert.deepEqual(T.gagnants(etat), []);
});

test('creer : même graine = même partie ; autre graine = autre mélange', () => {
  const a = nouvelle('abc').etat, b = nouvelle('abc').etat, c = nouvelle('abd').etat;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.paquets.vert, c.paquets.vert);
});

test('creer : réglages passés en option et premier joueur', () => {
  const { etat } = nouvelle('g', { reglages: { tailleDeck: 8, bataillonsParJoueur: 2, premierJoueur: 'rouge', mainDeDepart: 1 } });
  assert.equal(etat.actif, 'rouge');
  assert.equal(etat.bataillons.vert.length, 2);
  assert.equal(Object.keys(etat.exemplaires).length, 16);
  assert.equal(main(etat, 'rouge').length, 2);
  assert.equal(main(etat, 'vert').length, 1);
  assert.equal(etat.reglages.tailleMain, 5);
});

test('creer : refus des options invalides', () => {
  const env = creerEnv('g');
  const base = { graine: 'g', plateau: plateauExemple() };
  const refuse = (options, e) => {
    const r = T.creer(options, e || env);
    assert.equal(r.ok, false);
    assert.equal(r.etat, null);
    assert.ok(typeof r.raison === 'string' && r.raison.length > 0);
  };
  refuse(Object.assign({}, base, { graine: 1.5 }));
  refuse(Object.assign({}, base, { graine: '' }));
  refuse({ graine: 'g' });
  refuse(Object.assign({}, base, { reglages: { tailleMain: 0 } }));
  refuse(Object.assign({}, base, { reglages: { inconnu: 1 } }));
  refuse(Object.assign({}, base, { reglages: { premierJoueur: 'bleu' } }));
  refuse(Object.assign({}, base, { troupes: [] }));
  refuse(Object.assign({}, base, { troupes: [{ id: 'X1', nom: 'a', moral: 1, puissance: 1, des: 1 }] }));
  refuse(Object.assign({}, base, { troupes: [{ id: 'T1', nom: 'a', moral: 0, puissance: 1, des: 1 }] }));
  const mauvais = plateauExemple();
  mauvais.camps.vert = ['9,9', '0,-2'];
  refuse({ graine: 'g', plateau: mauvais });
  refuse(base, { alea: creerAlea('g') });
  refuse(base, { plateau: fauxPlateau });
});

test('creer : Troupes fournies par l’appelant', () => {
  const { etat } = nouvelle('g', { troupes: [{ id: 'T7', nom: 'Essai', moral: 2, puissance: 1, des: 1 }] });
  assert.deepEqual(Object.keys(etat.troupes), ['T7']);
  assert.equal(etat.exemplaires['vert-1'].modele, 'T7');
});

// ------------------------------------------------------------------------------------------------
// Gloire, dés, tour
// ------------------------------------------------------------------------------------------------

test('Gloire : jamais sous 0, bornée à 15, victoire signalée', () => {
  const { etat } = nouvelle();
  let r = faire(T.modifierGloire(etat, { joueur: 'vert', delta: 2 }));
  assert.equal(r.etat.gloire.vert, 2);
  assert.equal(r.victoire, false);
  r = faire(T.modifierGloire(r.etat, { joueur: 'vert', delta: -5 }));
  assert.equal(r.etat.gloire.vert, 0);
  assert.deepEqual(codes(r), ['gloire-bornee']);
  r = faire(T.modifierGloire(r.etat, { joueur: 'rouge', delta: 14 }));
  assert.deepEqual(T.gagnants(r.etat), []);
  r = faire(T.modifierGloire(r.etat, { joueur: 'rouge', delta: 3 }));
  assert.equal(r.etat.gloire.rouge, 15);
  assert.equal(r.victoire, true);
  assert.deepEqual(T.gagnants(r.etat), ['rouge']);
  assert.equal(dernier(r.etat).type, 'victoire');
  for (const p of [{ joueur: 'bleu', delta: 1 }, { joueur: 'vert', delta: 0 }, { joueur: 'vert', delta: 1.5 }, { joueur: 'vert' }, undefined]) {
    const x = T.modifierGloire(etat, p);
    assert.equal(x.ok, false);
    assert.equal(x.etat, etat);
  }
});

test('lancerDes : résultats détaillés, journal, bornes', () => {
  const { etat, env } = nouvelle();
  const r = faire(T.lancerDes(etat, { n: 6, joueur: 'vert', motif: 'attaque' }, env));
  assert.equal(r.des.length, 6);
  r.des.forEach((d) => assert.ok(Number.isInteger(d) && d >= 1 && d <= 6));
  assert.equal(r.total, r.des.reduce((s, d) => s + d, 0));
  const l = dernier(r.etat);
  assert.equal(l.type, 'des');
  assert.equal(l.tour, 1);
  assert.equal(l.joueur, 'vert');
  assert.ok(l.texte.includes(r.des.join(', ')) && l.texte.includes('attaque'));
  assert.notDeepEqual(r.etat.alea, etat.alea);
  for (const n of [0, -1, 2.5, 31, '3', undefined]) assert.equal(T.lancerDes(etat, { n: n }, env).ok, false);
});

test('aléa rejouable : le même état redonne les mêmes dés, quel que soit l’état de l’aléa injecté', () => {
  const { etat, env } = nouvelle();
  const a = faire(T.lancerDes(etat, { n: 5 }, env));
  env.alea.de(); env.alea.de();
  const b = faire(T.lancerDes(etat, { n: 5 }, env));
  assert.deepEqual(a.des, b.des);
  assert.deepEqual(a.etat, b.etat);
  // un autre aléa (créé après relecture d'un fichier) donne la même suite
  const c = faire(T.lancerDes(etat, { n: 5 }, creerEnv('toute autre graine')));
  assert.deepEqual(a.des, c.des);
  // deux lancers à la suite ne se répètent pas
  const d = faire(T.lancerDes(a.etat, { n: 5 }, env));
  assert.notDeepEqual(d.etat.alea, a.etat.alea);
});

test('finDeTour : joueur suivant, tour + 1, actions à 0, pioche de 1 carte', () => {
  const { etat, env } = nouvelle();
  const r = faire(T.finDeTour(etat, {}, env));
  assert.equal(r.etat.tour, 2);
  assert.equal(r.etat.actif, 'rouge');
  assert.equal(r.etat.actions, 0);
  assert.equal(r.piochees.length, 1);
  assert.equal(main(r.etat, 'rouge').length, 3);
  assert.equal(dernier(r.etat).tour, 2);
  const r2 = faire(T.finDeTour(r.etat, {}, env));
  assert.equal(r2.etat.actif, 'vert');
  assert.equal(r2.etat.tour, 3);
  assert.equal(main(r2.etat, 'vert').length, 4);
});

test('finDeTour : à 5 cartes en main, aucune pioche', () => {
  const { etat, env } = nouvelle();
  const r = faire(T.paquet(etat, { joueur: 'rouge', operation: 'piocher', n: 9 }, env));
  assert.equal(main(r.etat, 'rouge').length, 5);
  assert.equal(r.mainPleine, true);
  const f = faire(T.finDeTour(r.etat, {}, env));
  assert.deepEqual(f.piochees, []);
  assert.equal(f.mainPleine, true);
  assert.equal(main(f.etat, 'rouge').length, 5);
});

test('ajusterActions et noter', () => {
  const { etat } = nouvelle();
  let r = faire(T.ajusterActions(etat, { delta: 2, motif: 'renouveler ses cartes' }));
  assert.equal(r.etat.actions, 2);
  assert.deepEqual(codes(r), []);
  r = faire(T.ajusterActions(r.etat, { delta: 1 }));
  assert.deepEqual(codes(r), ['actions-depassees']);
  r = faire(T.ajusterActions(r.etat, { delta: -9 }));
  assert.equal(r.etat.actions, 0);
  const n = faire(T.noter(etat, { texte: '  Attaque de Vert\n sur Rouge ', joueur: 'vert' }));
  assert.equal(dernier(n.etat).texte, 'Attaque de Vert  sur Rouge');
  assert.equal(T.noter(etat, { texte: '   ' }).ok, false);
  assert.equal(dernier(faire(T.noter(etat, { texte: 'x'.repeat(2000) })).etat).texte.length, 300);
});

// ------------------------------------------------------------------------------------------------
// Bataillons
// ------------------------------------------------------------------------------------------------

test('former : sur une ville de déploiement libre de son camp', () => {
  const { etat, env } = nouvelle();
  const carte = main(etat, 'vert')[0];
  const r = faire(T.former(etat, { joueur: 'vert', numero: 1, carte: carte, cle: '0,-2' }, env));
  assert.deepEqual(r.etat.bataillons.vert[0], { numero: 1, case: '0,-2', troupes: [{ carte: carte, degats: 0 }], campement: false });
  assert.ok(!main(r.etat, 'vert').includes(carte));
  assert.equal(r.etat.actions, 1);
  assert.deepEqual(r.avertissements, []);
  assert.equal(dernier(r.etat).type, 'former');
  assert.deepEqual(T.occupants(r.etat, '0,-2'), [{ joueur: 'vert', numero: 1 }]);
});

test('former : avertissements bloquants, puis forcé', () => {
  const { etat, env } = avecBataillon();
  const carte = main(etat, 'vert')[0];
  // ville de déploiement adverse
  let r = T.former(etat, { joueur: 'vert', numero: 2, carte: carte, cle: '0,2' }, env);
  assert.equal(r.ok, false);
  assert.equal(r.etat, etat);
  assert.deepEqual(codes(r), ['hors-deploiement']);
  // ville de déploiement occupée
  r = T.former(etat, { joueur: 'vert', numero: 2, carte: carte, cle: '0,-2' }, env);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ['occupee']);
  // forcé : la table libre laisse faire
  r = faire(T.former(etat, { joueur: 'vert', numero: 2, carte: carte, cle: '-1,0', forcer: true }, env));
  assert.equal(r.etat.bataillons.vert[1].case, '-1,0');
  assert.deepEqual(codes(r), ['hors-deploiement']);
  assert.ok(dernier(r.etat).texte.includes('forcé'));
});

test('former : refus fermes (bataillon, carte, case)', () => {
  const { etat, env } = avecBataillon();
  const carte = main(etat, 'vert')[0];
  const cas = [
    { joueur: 'vert', numero: 9, carte: carte, cle: '2,-2' },
    { joueur: 'bleu', numero: 1, carte: carte, cle: '2,-2' },
    { joueur: 'vert', numero: 1, carte: carte, cle: '2,-2' },                       // déjà posé
    { joueur: 'vert', numero: 2, carte: main(etat, 'rouge')[0], cle: '2,-2' },      // carte adverse
    { joueur: 'vert', numero: 2, carte: 'vert-999', cle: '2,-2' },
    { joueur: 'vert', numero: 2, carte: carte, cle: '9,9', forcer: true },          // hors plateau, même forcé
    { joueur: 'vert', numero: 2, carte: carte, cle: '__proto__', forcer: true }
  ];
  cas.forEach((p, i) => {
    const r = T.former(etat, p, env);
    assert.equal(r.ok, false, 'cas ' + i);
    assert.equal(r.etat, etat);
  });
});

test('renforcer : jusqu’à 3 Troupes, sur déploiement ou ville contrôlée', () => {
  let { etat, env } = avecBataillon();
  let r = faire(T.renforcer(etat, { joueur: 'vert', numero: 1, carte: main(etat, 'vert')[0] }, env));
  assert.equal(r.etat.bataillons.vert[0].troupes.length, 2);
  assert.equal(r.etat.actions, 2);
  r = faire(T.renforcer(r.etat, { joueur: 'vert', numero: 1, carte: main(r.etat, 'vert')[0] }, env));
  assert.equal(r.etat.bataillons.vert[0].troupes.length, 3);
  assert.deepEqual(codes(r), ['actions-depassees']);
  etat = faire(T.paquet(r.etat, { joueur: 'vert', operation: 'piocher', n: 2 }, env)).etat;
  const plein = T.renforcer(etat, { joueur: 'vert', numero: 1, carte: main(etat, 'vert')[0], forcer: true }, env);
  assert.equal(plein.ok, false, 'la limite de 3 Troupes ne se force pas');
  assert.equal(T.renforcer(etat, { joueur: 'vert', numero: 2, carte: main(etat, 'vert')[0] }, env).ok, false, 'bataillon en réserve');
});

test('renforcer : hors déploiement = avertissement bloquant ; ville contrôlée = permis', () => {
  let { etat, env } = avecBataillon();
  etat = faire(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,-1' }, env)).etat;
  etat = faire(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,0' }, env)).etat;
  const carte = main(etat, 'vert')[0];
  const r = T.renforcer(etat, { joueur: 'vert', numero: 1, carte: carte }, env);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ['hors-renfort']);
  etat = faire(T.capturerVille(etat, { cle: '0,0', proprietaire: 'vert' }, env)).etat;
  const ok = faire(T.renforcer(etat, { joueur: 'vert', numero: 1, carte: carte }, env));
  assert.deepEqual(codes(ok).filter((c) => c === 'hors-renfort'), []);
});

test('deplacer : coût en rations de la case d’arrivée', () => {
  const { etat, env } = avecBataillon();
  let r = faire(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,-1' }, env));
  assert.equal(r.cout, 2);
  assert.equal(r.terrain, 'foret');
  assert.equal(r.depuis, '0,-2');
  assert.equal(r.etat.bataillons.vert[0].case, '0,-1');
  assert.equal(r.etat.actions, 2);
  assert.ok(dernier(r.etat).texte.includes('2 ration'));
  r = faire(T.deplacer(r.etat, { joueur: 'vert', numero: 1, cle: '-1,0' }, env));
  assert.equal(r.cout, 1);
  assert.deepEqual(codes(r), ['actions-depassees']);
});

test('deplacer : non voisine, infranchissable, occupée ; refusé sauf si on force', () => {
  let { etat, env } = avecBataillon();
  // non voisine
  let r = T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,0' }, env);
  assert.equal(r.ok, false);
  assert.equal(r.etat, etat);
  assert.deepEqual(codes(r), ['non-voisine']);
  assert.equal(r.cout, 1);
  r = faire(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,0', forcer: true }, env));
  assert.equal(r.etat.bataillons.vert[0].case, '0,0');
  // infranchissable : coût null (jamais Infinity, l'état et le résultat restent sérialisables)
  const m = T.deplacer(r.etat, { joueur: 'vert', numero: 1, cle: '1,0' }, env);
  assert.equal(m.ok, false);
  assert.deepEqual(codes(m), ['infranchissable']);
  assert.equal(m.cout, null);
  const mf = faire(T.deplacer(r.etat, { joueur: 'vert', numero: 1, cle: '1,0', forcer: true }, env));
  assert.equal(mf.etat.bataillons.vert[0].case, '1,0');
  assert.deepEqual(JSON.parse(JSON.stringify(mf.etat)), mf.etat);
  // occupée
  etat = faire(T.former(etat, { joueur: 'vert', numero: 2, carte: main(etat, 'vert')[0], cle: '2,-2' }, env)).etat;
  etat = faire(T.deplacer(etat, { joueur: 'vert', numero: 2, cle: '1,-2' }, env)).etat;
  const o = T.deplacer(etat, { joueur: 'vert', numero: 2, cle: '0,-2' }, env);
  assert.equal(o.ok, false);
  assert.deepEqual(codes(o), ['occupee']);
  const of = faire(T.deplacer(etat, { joueur: 'vert', numero: 2, cle: '0,-2', forcer: true }, env));
  assert.equal(T.occupants(of.etat, '0,-2').length, 2);
});

test('deplacer : refus fermes', () => {
  const { etat, env } = avecBataillon();
  const cas = [
    { joueur: 'vert', numero: 2, cle: '0,-1' },                 // en réserve
    { joueur: 'vert', numero: 1, cle: '0,-2' },                 // sur place
    { joueur: 'vert', numero: 1, cle: '5,5', forcer: true },    // hors plateau
    { joueur: 'vert', numero: 1, cle: 12, forcer: true },
    { joueur: 'rouge', numero: 0, cle: '0,-1' }
  ];
  cas.forEach((p, i) => assert.equal(T.deplacer(etat, p, env).ok, false, 'cas ' + i));
  assert.equal(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,-1' }, { plateau: fauxPlateau }).ok, false);
});

test('actions : hors de son tour, l’action n’est pas comptée ; option compter: false', () => {
  const { etat, env } = nouvelle();
  const r = faire(T.former(etat, { joueur: 'rouge', numero: 1, carte: main(etat, 'rouge')[0], cle: '0,2' }, env));
  assert.deepEqual(codes(r), ['hors-tour']);
  assert.equal(r.avertissements[0].bloquant, false);
  assert.equal(r.etat.actions, 0);
  const s = faire(T.former(etat, { joueur: 'vert', numero: 1, carte: main(etat, 'vert')[0], cle: '0,-2', compter: false }, env));
  assert.equal(s.etat.actions, 0);
});

test('marquerDegats : marqueurs par Troupe, élimination quand les dégâts atteignent le moral', () => {
  let { etat, env } = nouvelle('g', { troupes: [{ id: 'T1', nom: 'Essai', moral: 3, puissance: 1, des: 1 }] });
  const c1 = main(etat, 'vert')[0], c2 = main(etat, 'vert')[1];
  etat = faire(T.former(etat, { joueur: 'vert', numero: 1, carte: c1, cle: '0,-2' }, env)).etat;
  etat = faire(T.renforcer(etat, { joueur: 'vert', numero: 1, carte: c2 }, env)).etat;
  assert.equal(T.moralRestant(etat, 'vert', 1), 6);
  let r = faire(T.marquerDegats(etat, { joueur: 'vert', numero: 1, troupe: 0, delta: 2 }));
  assert.equal(r.degats, 2);
  assert.equal(r.eliminee, false);
  assert.equal(T.moralRestant(r.etat, 'vert', 1), 4);
  // retirer des marqueurs, jamais sous 0
  const moins = faire(T.marquerDegats(r.etat, { joueur: 'vert', numero: 1, troupe: 0, delta: -5 }));
  assert.equal(moins.etat.bataillons.vert[0].troupes[0].degats, 0);
  // élimination de la première Troupe
  r = faire(T.marquerDegats(r.etat, { joueur: 'vert', numero: 1, troupe: 0, delta: 1 }));
  assert.equal(r.eliminee, true);
  assert.equal(r.bataillonElimine, false);
  assert.deepEqual(r.etat.bataillons.vert[0].troupes, [{ carte: c2, degats: 0 }]);
  assert.deepEqual(r.etat.paquets.vert.defausse, [c1]);
  // la dernière Troupe tombe : bataillon en réserve, la Gloire ne bouge pas toute seule
  etat = faire(T.piocherCampement(r.etat, { joueur: 'vert', numero: 1 }, env)).etat;
  assert.equal(etat.bataillons.vert[0].campement, true);
  r = faire(T.marquerDegats(etat, { joueur: 'vert', numero: 1, troupe: 0, delta: 7 }));
  assert.equal(r.bataillonElimine, true);
  assert.deepEqual(r.etat.bataillons.vert[0], { numero: 1, case: null, troupes: [], campement: false });
  assert.deepEqual(r.etat.paquets.vert.defausse, [c1, c2]);
  assert.deepEqual(r.etat.gloire, { vert: 0, rouge: 0 });
  assert.equal(dernier(r.etat).type, 'elimination');
  for (const p of [{ joueur: 'vert', numero: 1, troupe: 3, delta: 1 }, { joueur: 'vert', numero: 1, troupe: 0, delta: 0 },
    { joueur: 'vert', numero: 2, troupe: 0, delta: 1 }, { joueur: 'vert', numero: 1, troupe: -1, delta: 1 }]) {
    assert.equal(T.marquerDegats(etat, p).ok, false);
  }
});

test('eliminerBataillon : Troupes défaussées, pion en réserve', () => {
  const { etat } = avecBataillon();
  const carte = etat.bataillons.vert[0].troupes[0].carte;
  const r = faire(T.eliminerBataillon(etat, { joueur: 'vert', numero: 1 }));
  assert.equal(r.etat.bataillons.vert[0].case, null);
  assert.deepEqual(r.etat.paquets.vert.defausse, [carte]);
  assert.equal(T.eliminerBataillon(r.etat, { joueur: 'vert', numero: 1 }).ok, false);
});

// ------------------------------------------------------------------------------------------------
// Villes, Campement, Événements
// ------------------------------------------------------------------------------------------------

test('capturerVille : propriétaire par case, seulement sur une ville', () => {
  const { etat, env } = nouvelle();
  let r = faire(T.capturerVille(etat, { cle: '0,0', proprietaire: 'rouge' }, env));
  assert.deepEqual(r.etat.villes, { '0,0': 'rouge' });
  assert.equal(r.avant, null);
  r = faire(T.capturerVille(r.etat, { cle: '0,0', proprietaire: 'vert' }, env));
  assert.equal(r.avant, 'rouge');
  assert.deepEqual(r.etat.gloire, { vert: 0, rouge: 0 }, 'la Gloire reste manuelle');
  assert.equal(T.capturerVille(r.etat, { cle: '0,0', proprietaire: 'vert' }, env).ok, false);
  r = faire(T.capturerVille(r.etat, { cle: '0,0', proprietaire: null }, env));
  assert.deepEqual(r.etat.villes, {});
  assert.equal(T.capturerVille(etat, { cle: '-1,0', proprietaire: 'vert' }, env).ok, false);
  assert.equal(T.capturerVille(etat, { cle: '0,0', proprietaire: 'bleu' }, env).ok, false);
  assert.equal(T.capturerVille(etat, { cle: '__proto__', proprietaire: 'vert' }, env).ok, false);
});

test('piocherCampement : carte jouée aussitôt, une seule fois par bataillon', () => {
  const { etat, env } = avecBataillon();
  const r = faire(T.piocherCampement(etat, { joueur: 'vert', numero: 1 }, env));
  assert.equal(r.carte.id, etat.paquets.campement.pioche[0]);
  assert.deepEqual(r.etat.paquets.campement.defausse, [r.carte.id]);
  assert.equal(r.etat.paquets.campement.pioche.length, 14);
  assert.equal(r.etat.bataillons.vert[0].campement, true);
  assert.ok(dernier(r.etat).texte.includes(r.carte.texte));
  const deja = T.piocherCampement(r.etat, { joueur: 'vert', numero: 1 }, env);
  assert.equal(deja.ok, false);
  assert.deepEqual(codes(deja), ['deja-campement']);
  assert.ok(T.piocherCampement(r.etat, { joueur: 'vert', numero: 1, forcer: true }, env).ok);
  assert.equal(T.piocherCampement(etat, { joueur: 'vert', numero: 2 }, env).ok, false, 'bataillon en réserve');
  // sans bataillon : pioche libre
  assert.ok(T.piocherCampement(etat, { joueur: 'rouge' }, env).ok);
});

test('piocherCampement : la défausse Campement est remélangée quand la pioche est vide', () => {
  let { etat, env } = nouvelle();
  const vues = [];
  for (let i = 0; i < 15; i++) {
    const r = faire(T.piocherCampement(etat, { joueur: 'vert' }, env));
    vues.push(r.carte.id);
    etat = r.etat;
  }
  assert.equal(new Set(vues).size, 15);
  assert.equal(etat.paquets.campement.pioche.length, 0);
  const r = faire(T.piocherCampement(etat, { joueur: 'vert' }, env));
  assert.equal(r.etat.paquets.campement.pioche.length, 14);
  assert.deepEqual(r.etat.paquets.campement.defausse, [r.carte.id]);
});

test('piocherEvenement puis poserEvenement par la fonction du plateau injectée', () => {
  const { etat, env } = nouvelle();
  const p = faire(T.piocherEvenement(etat, { joueur: 'vert' }, env));
  const id = p.carte.id;
  assert.equal(p.carte.provisoire, true);
  assert.deepEqual(p.etat.paquets.evenements.main, [id]);
  assert.equal(p.etat.paquets.evenements.pioche.length, 7);
  const r = faire(T.poserEvenement(p.etat, { evenement: id, cle: '-1,0', joueur: 'vert' }, env));
  assert.deepEqual(r.etat.plateau.recouvrements, [{ evenement: id, cle: '-1,0' }]);
  assert.deepEqual(r.etat.paquets.evenements.main, []);
  assert.deepEqual(r.etat.paquets.evenements.defausse, [id]);
  assert.deepEqual(etat.plateau.recouvrements, [], 'le plateau d’origine n’est pas modifié');
  assert.equal(dernier(r.etat).type, 'evenement');
});

test('poserEvenement : refus du plateau, case occupée, carte non piochée', () => {
  let { etat, env } = avecBataillon();
  const p = faire(T.piocherEvenement(etat, { joueur: 'vert' }, env));
  const id = p.carte.id;
  etat = p.etat;
  // le plateau refuse (ville, forêt...) : cela ne se force pas
  const ville = T.poserEvenement(etat, { evenement: id, cle: '0,0', forcer: true }, env);
  assert.equal(ville.ok, false);
  assert.equal(ville.raison, 'Cette tuile se pose sur une plaine.');
  assert.equal(ville.etat, etat);
  // case occupée par un bataillon
  const dep = faire(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '1,-2' }, env)).etat;
  const occ = T.poserEvenement(dep, { evenement: id, cle: '1,-2' }, env);
  assert.equal(occ.ok, false);
  assert.deepEqual(codes(occ), ['occupee']);
  // carte non piochée
  const autreId = etat.paquets.evenements.pioche[0];
  const np = T.poserEvenement(etat, { evenement: autreId, cle: '-1,0' }, env);
  assert.equal(np.ok, false);
  assert.deepEqual(codes(np), ['pas-piochee']);
  const force = faire(T.poserEvenement(etat, { evenement: autreId, cle: '-1,0', forcer: true }, env));
  assert.ok(!force.etat.paquets.evenements.pioche.includes(autreId));
  assert.ok(force.etat.paquets.evenements.defausse.includes(autreId));
  assert.equal(T.poserEvenement(etat, { evenement: 'E99', cle: '-1,0' }, env).ok, false);
  assert.equal(T.poserEvenement(etat, { evenement: id, cle: 'x' }, env).ok, false);
});

test('piocherEvenement : 8 tuiles uniques, pas de remélange', () => {
  let { etat, env } = nouvelle();
  for (let i = 0; i < 8; i++) etat = faire(T.piocherEvenement(etat, { joueur: 'vert' }, env)).etat;
  assert.equal(etat.paquets.evenements.main.length, 8);
  const r = T.piocherEvenement(etat, { joueur: 'vert' }, env);
  assert.equal(r.ok, false);
  assert.equal(r.etat, etat);
});

test('une crevasse posée rend la case infranchissable pour deplacer', () => {
  let { etat, env } = avecBataillon();
  etat = faire(T.poserEvenement(etat, { evenement: 'E2', cle: '-1,-1', forcer: true }, env)).etat;
  const r = T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '-1,-1' }, env);
  assert.equal(r.ok, false);
  assert.deepEqual(codes(r), ['infranchissable']);
});

// ------------------------------------------------------------------------------------------------
// Paquets des joueurs
// ------------------------------------------------------------------------------------------------

test('paquet : chaque opération permise s’applique et se journalise', () => {
  let { etat, env } = nouvelle();
  const fait = (params) => { const r = faire(T.paquet(etat, params, env)); etat = r.etat; assert.equal(dernier(etat).type, 'paquet'); return r; };
  const total = () => etat.paquets.vert.pioche.length + etat.paquets.vert.main.length + etat.paquets.vert.defausse.length;
  assert.equal(fait({ joueur: 'vert', operation: 'piocher', n: 1 }).piochees.length, 1);
  const c = main(etat, 'vert')[0];
  assert.equal(fait({ joueur: 'vert', operation: 'defausser', carte: c }).carte, c);
  assert.equal(fait({ joueur: 'vert', operation: 'reprendreDefausse' }).carte, c);
  assert.ok(fait({ joueur: 'vert', operation: 'defausserAuHasard' }).carte);
  assert.ok(fait({ joueur: 'vert', operation: 'defausserDessusPioche' }).carte);
  const vues = fait({ joueur: 'vert', operation: 'regarder', n: 3 }).cartes;
  assert.equal(vues.length, 3);
  fait({ joueur: 'vert', operation: 'prendreDansPioche', carte: vues[1] });
  fait({ joueur: 'vert', operation: 'reordonnerDessus', cartes: [vues[2], vues[0]] });
  assert.deepEqual(etat.paquets.vert.pioche.slice(0, 2), [vues[2], vues[0]]);
  fait({ joueur: 'vert', operation: 'remettreDessous', carte: vues[1] });
  assert.equal(etat.paquets.vert.pioche[etat.paquets.vert.pioche.length - 1], vues[1]);
  fait({ joueur: 'vert', operation: 'remettreDessus', carte: main(etat, 'vert')[0] });
  fait({ joueur: 'vert', operation: 'melangerPioche' });
  fait({ joueur: 'vert', operation: 'melangerDefausseDansPioche' });
  assert.equal(etat.paquets.vert.defausse.length, 0);
  fait({ joueur: 'vert', operation: 'defausserMain' });
  assert.equal(main(etat, 'vert').length, 0);
  fait({ joueur: 'vert', operation: 'piocher', n: 2 });
  fait({ joueur: 'vert', operation: 'remettreMainDansPioche' });
  assert.equal(main(etat, 'vert').length, 0);
  assert.equal(total(), 20);
  assert.deepEqual(T.OPERATIONS_PAQUET.length, 14);
});

test('paquet : refus (opération inconnue, joueur, carte, nombre) sans changer l’état', () => {
  const { etat, env } = nouvelle();
  const cas = [
    { joueur: 'vert', operation: 'detruire' },
    { joueur: 'vert', operation: '__proto__' },
    { joueur: 'vert', operation: 'constructor' },
    { joueur: 'campement', operation: 'piocher', n: 1 },
    { joueur: 'vert', operation: 'piocher', n: -1 },
    { joueur: 'vert', operation: 'defausser', carte: 'vert-999' },
    { joueur: 'vert', operation: 'defausser', carte: main(etat, 'rouge')[0] },
    { joueur: 'vert', operation: 'reordonnerDessus', cartes: 'x' }
  ];
  cas.forEach((p, i) => {
    const r = T.paquet(etat, p, env);
    assert.equal(r.ok, false, 'cas ' + i);
    assert.equal(r.etat, etat);
  });
});

test('modifierTroupe : valeurs bornées, journalisées ; moral protégé par les dégâts en jeu', () => {
  let { etat } = avecBataillon();
  const carte = etat.bataillons.vert[0].troupes[0].carte;
  const id = etat.exemplaires[carte].modele;
  let r = faire(T.modifierTroupe(etat, { id: id, nom: 'Garde d’essai', moral: 5, puissance: 3, des: 2 }));
  assert.deepEqual(r.etat.troupes[id], { nom: 'Garde d’essai', moral: 5, puissance: 3, des: 2, provisoire: true });
  assert.equal(dernier(r.etat).type, 'troupe');
  etat = faire(T.marquerDegats(r.etat, { joueur: 'vert', numero: 1, troupe: 0, delta: 3 })).etat;
  assert.equal(T.modifierTroupe(etat, { id: id, moral: 3 }).ok, false);
  assert.ok(T.modifierTroupe(etat, { id: id, moral: 4 }).ok);
  for (const p of [{ id: 'T99', moral: 2 }, { id: id, moral: 0 }, { id: id, moral: 2.5 }, { id: id, nom: '' },
    { id: id, nom: 'x'.repeat(41) }, { id: id, des: 11 }, { id: id, puissance: '2' }, { id: '__proto__', moral: 2 }]) {
    assert.equal(T.modifierTroupe(etat, p).ok, false, JSON.stringify(p));
  }
});

// ------------------------------------------------------------------------------------------------
// Journal, annuler / rétablir
// ------------------------------------------------------------------------------------------------

test('journal : chaque opération réussie ajoute une entrée numérotée, datée par le tour', () => {
  let { etat, env } = nouvelle();
  const ops = [
    (e) => T.modifierGloire(e, { joueur: 'vert', delta: 1 }),
    (e) => T.lancerDes(e, { n: 2 }, env),
    (e) => T.ajusterActions(e, { delta: 1 }),
    (e) => T.noter(e, { texte: 'note' }),
    (e) => T.paquet(e, { joueur: 'vert', operation: 'piocher', n: 1 }, env),
    (e) => T.former(e, { joueur: 'vert', numero: 1, carte: main(e, 'vert')[0], cle: '0,-2' }, env),
    (e) => T.renforcer(e, { joueur: 'vert', numero: 1, carte: main(e, 'vert')[0] }, env),
    (e) => T.deplacer(e, { joueur: 'vert', numero: 1, cle: '1,-2' }, env),
    (e) => T.marquerDegats(e, { joueur: 'vert', numero: 1, troupe: 0, delta: 1 }),
    (e) => T.capturerVille(e, { cle: '0,0', proprietaire: 'vert' }, env),
    (e) => T.piocherCampement(e, { joueur: 'vert', numero: 1 }, env),
    (e) => T.piocherEvenement(e, { joueur: 'vert' }, env),
    (e) => T.poserEvenement(e, { evenement: e.paquets.evenements.main[0], cle: '-1,0' }, env),
    (e) => T.modifierTroupe(e, { id: 'T1', nom: 'Recrues bis' }),
    (e) => T.finDeTour(e, {}, env),
    (e) => T.eliminerBataillon(e, { joueur: 'vert', numero: 1 })
  ];
  ops.forEach((op, i) => {
    const avant = etat.journal.length;
    const r = faire(op(etat));
    assert.ok(r.etat.journal.length > avant, 'opération ' + i);
    assert.equal(etat.journal.length, avant, 'l’état reçu garde son journal');
    etat = r.etat;
  });
  etat.journal.forEach((l, i) => {
    assert.equal(l.n, i + 1);
    assert.ok(l.tour >= 1 && l.tour <= etat.tour);
    assert.ok(typeof l.texte === 'string' && l.texte.length > 0 && l.texte.length <= T.LIMITES.texte);
    assert.match(l.type, /^[a-z-]+$/);
  });
  assert.equal(dernier(etat).tour, 2);
});

test('pureté : aucune opération ne modifie l’état reçu, même refusée', () => {
  const { etat, env } = avecBataillon();
  const copie = JSON.parse(JSON.stringify(etat));
  const carte = main(etat, 'vert')[0];
  [
    () => T.modifierGloire(etat, { joueur: 'vert', delta: 3 }),
    () => T.lancerDes(etat, { n: 3 }, env),
    () => T.finDeTour(etat, {}, env),
    () => T.paquet(etat, { joueur: 'vert', operation: 'defausserMain' }, env),
    () => T.paquet(etat, { joueur: 'vert', operation: 'defausser', carte: 'vert-999' }, env),
    () => T.former(etat, { joueur: 'vert', numero: 2, carte: carte, cle: '2,-2' }, env),
    () => T.former(etat, { joueur: 'vert', numero: 2, carte: carte, cle: '0,0' }, env),
    () => T.renforcer(etat, { joueur: 'vert', numero: 1, carte: carte }, env),
    () => T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '1,0', forcer: true }, env),
    () => T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '1,0' }, env),
    () => T.marquerDegats(etat, { joueur: 'vert', numero: 1, troupe: 0, delta: 9 }),
    () => T.eliminerBataillon(etat, { joueur: 'vert', numero: 1 }),
    () => T.capturerVille(etat, { cle: '0,0', proprietaire: 'vert' }, env),
    () => T.piocherCampement(etat, { joueur: 'vert', numero: 1 }, env),
    () => T.piocherEvenement(etat, { joueur: 'vert' }, env),
    () => T.poserEvenement(etat, { evenement: 'E5', cle: '-1,0', forcer: true }, env),
    () => T.modifierTroupe(etat, { id: 'T1', moral: 4 }),
    () => T.serialiser(etat),
    () => T.valider(etat, env)
  ].forEach((f) => f());
  assert.deepEqual(etat, copie);
});

test('historique : annuler / rétablir, et l’aléa se rejoue à l’identique', () => {
  const { etat, env } = nouvelle();
  const H = T.historique;
  let h = H.creer(etat);
  assert.equal(H.peutAnnuler(h), false);
  assert.equal(H.annuler(h), h);
  const a = faire(T.lancerDes(h.present, { n: 4 }, env));
  h = H.pousser(h, a.etat);
  const b = faire(T.finDeTour(h.present, {}, env));
  h = H.pousser(h, b.etat);
  assert.equal(h.passe.length, 2);
  h = H.annuler(h);
  assert.equal(h.present, a.etat);
  assert.ok(H.peutRetablir(h));
  h = H.annuler(h);
  assert.equal(h.present, etat);
  // après annulation, le même lancer redonne les mêmes dés
  const a2 = faire(T.lancerDes(h.present, { n: 4 }, env));
  assert.deepEqual(a2.des, a.des);
  h = H.retablir(h);
  assert.equal(h.present, a.etat);
  h = H.retablir(h);
  assert.equal(h.present, b.etat);
  assert.equal(H.retablir(h), h);
  // une nouvelle opération après une annulation vide la liste à rétablir
  h = H.pousser(H.annuler(h), a2.etat);
  assert.equal(H.peutRetablir(h), false);
});

test('historique : taille bornée par le réglage tailleHistorique', () => {
  const { etat } = nouvelle('g', { reglages: { tailleHistorique: 3 } });
  let h = T.historique.creer(etat);
  for (let i = 0; i < 10; i++) h = T.historique.pousser(h, faire(T.noter(h.present, { texte: 'n' + i })).etat);
  assert.equal(h.passe.length, 3);
});

// ------------------------------------------------------------------------------------------------
// Sérialisation et validation stricte
// ------------------------------------------------------------------------------------------------

/** Partie avancée, avec des opérations forcées, pour les essais d'enregistrement. */
function partieAvancee() {
  let { etat, env } = avecBataillon('fichier');
  const f = (r) => { etat = faire(r).etat; };
  f(T.renforcer(etat, { joueur: 'vert', numero: 1, carte: main(etat, 'vert')[0] }, env));
  f(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '0,-1' }, env));
  f(T.marquerDegats(etat, { joueur: 'vert', numero: 1, troupe: 0, delta: 1 }));
  f(T.piocherCampement(etat, { joueur: 'vert', numero: 1 }, env));
  f(T.finDeTour(etat, {}, env));
  f(T.former(etat, { joueur: 'rouge', numero: 3, carte: main(etat, 'rouge')[0], cle: '0,2' }, env));
  f(T.deplacer(etat, { joueur: 'rouge', numero: 3, cle: '0,-1', forcer: true }, env));   // deux pions sur une case
  f(T.deplacer(etat, { joueur: 'vert', numero: 1, cle: '1,0', forcer: true }, env));     // sur une montagne
  f(T.capturerVille(etat, { cle: '0,0', proprietaire: 'rouge' }, env));
  f(T.modifierGloire(etat, { joueur: 'rouge', delta: 2 }));
  f(T.piocherEvenement(etat, { joueur: 'rouge' }, env));
  f(T.piocherEvenement(etat, { joueur: 'rouge' }, env));
  f(T.poserEvenement(etat, { evenement: etat.paquets.evenements.main[0], cle: '-1,0' }, env));
  f(T.lancerDes(etat, { n: 3, joueur: 'rouge' }, env));
  f(T.paquet(etat, { joueur: 'vert', operation: 'defausserAuHasard' }, env));
  f(T.modifierTroupe(etat, { id: 'T2', nom: 'Milice d’essai', moral: 3 }));
  f(T.noter(etat, { texte: 'fin de l’essai' }));
  return { etat: etat, env: env };
}

test('serialiser puis charger : aller-retour exact, objet neuf', () => {
  const { etat, env } = partieAvancee();
  const texte = T.serialiser(etat);
  assert.equal(typeof texte, 'string');
  const r = T.charger(texte, env);
  assert.ok(r.ok, r.raison);
  assert.deepEqual(r.etat, etat);
  assert.notEqual(r.etat, etat);
  assert.equal(T.serialiser(r.etat), texte);
});

test('partie rejouée à l’identique après relecture, avec un aléa recréé depuis la graine', () => {
  const { etat, env } = partieAvancee();
  const relu = T.charger(T.serialiser(etat), env).etat;
  const env2 = creerEnv(relu.graine);
  const suite = (e, en) => {
    let x = faire(T.lancerDes(e, { n: 6 }, en));
    const des = x.des;
    x = faire(T.finDeTour(x.etat, {}, en));
    x = faire(T.paquet(x.etat, { joueur: 'vert', operation: 'melangerDefausseDansPioche' }, en));
    x = faire(T.piocherCampement(x.etat, { joueur: 'rouge' }, en));
    return { des: des, etat: x.etat };
  };
  const a = suite(etat, env), b = suite(relu, env2);
  assert.deepEqual(a.des, b.des);
  assert.deepEqual(a.etat, b.etat);
});

test('tout état produit par les opérations (forcées comprises) repasse la validation', () => {
  const { etat, env } = partieAvancee();
  assert.ok(T.valider(JSON.parse(JSON.stringify(etat)), env).ok);
  const debut = nouvelle('v').etat;
  assert.ok(T.valider(JSON.parse(T.serialiser(debut)), creerEnv('v')).ok);
});

test('charger : texte illisible, trop gros, ou sans les fonctions du plateau', () => {
  const { etat, env } = nouvelle();
  assert.equal(T.charger('{pas du json', env).ok, false);
  assert.equal(T.charger(42, env).ok, false);
  assert.equal(T.charger('"' + 'x'.repeat(T.LIMITES.fichier) + '"', env).ok, false);
  assert.equal(T.charger('null', env).ok, false);
  assert.equal(T.charger('[]', env).ok, false);
  assert.equal(T.charger(T.serialiser(etat), {}).ok, false);
  assert.equal(T.charger(T.serialiser(etat), undefined).ok, false);
});

test('valider : ne fait jamais confiance au fichier (types, bornes, identifiants, cohérence)', () => {
  const { etat, env } = partieAvancee();
  const texte = T.serialiser(etat);
  const idVert = etat.paquets.vert.pioche[0], idRouge = etat.paquets.rouge.pioche[0];
  const alterations = {
    'format': (o) => { o.format = 'autre'; },
    'version': (o) => { o.version = 2; },
    'champ inconnu': (o) => { o.pirate = 1; },
    'champ manquant': (o) => { delete o.journal; },
    'graine': (o) => { o.graine = { a: 1 }; },
    'aléa trop profond': (o) => { o.alea = { a: { b: { c: { d: { e: 1 } } } } }; },
    'aléa démesuré': (o) => { o.alea = 'x'.repeat(5000); },
    'réglage hors bornes': (o) => { o.reglages.tailleMain = 1000; },
    'réglage inconnu': (o) => { o.reglages.triche = true; },
    'réglage manquant': (o) => { delete o.reglages.gloireVictoire; },
    'tour': (o) => { o.tour = 0; },
    'tour non entier': (o) => { o.tour = 1.5; },
    'actif': (o) => { o.actif = 'bleu'; },
    'actions': (o) => { o.actions = -1; },
    'gloire négative': (o) => { o.gloire.vert = -1; },
    'gloire au-dessus du maximum': (o) => { o.gloire.rouge = 16; },
    'gloire en chaîne': (o) => { o.gloire.vert = '3'; },
    'joueur en trop': (o) => { o.gloire.bleu = 1; },
    'troupe : moral nul': (o) => { o.troupes.T1.moral = 0; },
    'troupe : nom trop long': (o) => { o.troupes.T1.nom = 'x'.repeat(41); },
    'troupe : nom non textuel': (o) => { o.troupes.T1.nom = { toString: 1 }; },
    'troupe : identifiant': (o) => { o.troupes['<script>'] = o.troupes.T1; },
    'troupe : champ en trop': (o) => { o.troupes.T1.effet = 'x'; },
    'exemplaire : modèle inconnu': (o) => { o.exemplaires[idVert].modele = 'T999'; },
    'exemplaire : autre joueur': (o) => { o.exemplaires[idVert].joueur = 'rouge'; },
    'exemplaire en trop': (o) => { o.exemplaires['vert-777'] = { modele: 'T1', joueur: 'vert' }; },
    'carte en double': (o) => { o.paquets.vert.main.push(idVert); },
    'carte disparue': (o) => { o.paquets.vert.pioche.shift(); },
    'carte adverse dans un paquet': (o) => { o.paquets.vert.pioche[0] = idRouge; },
    'carte inconnue': (o) => { o.paquets.vert.pioche[0] = 'vert-999'; },
    'paquet : zone manquante': (o) => { delete o.paquets.rouge.defausse; },
    'paquet : zone non liste': (o) => { o.paquets.rouge.main = 'vert-1'; },
    'paquet en trop': (o) => { o.paquets.bleu = { pioche: [], main: [], defausse: [] }; },
    'campement : carte inconnue': (o) => { o.paquets.campement.pioche[0] = 'C99'; },
    'campement : carte en double': (o) => { o.paquets.campement.pioche[0] = o.paquets.campement.pioche[1]; },
    'campement : carte manquante': (o) => { o.paquets.campement.pioche.pop(); },
    'campement : main': (o) => { o.paquets.campement.main.push(o.paquets.campement.pioche.pop()); },
    'événement inconnu': (o) => { o.paquets.evenements.pioche[0] = 'E9'; },
    'bataillon en trop': (o) => { o.bataillons.vert.push({ numero: 5, case: null, troupes: [], campement: false }); },
    'bataillon : numéro': (o) => { o.bataillons.vert[0].numero = 2; },
    'bataillon : case hors plateau': (o) => { o.bataillons.vert[0].case = '9,9'; },
    'bataillon : case mal formée': (o) => { o.bataillons.vert[0].case = '0;0'; },
    'bataillon : posé sans Troupe': (o) => { o.bataillons.vert[1].case = '0,0'; },
    'bataillon : réserve avec marque Campement': (o) => { o.bataillons.vert[1].campement = true; },
    'bataillon : campement non booléen': (o) => { o.bataillons.vert[0].campement = 1; },
    'bataillon : trop de Troupes': (o) => {
      const b = o.bataillons.vert[0];
      while (b.troupes.length < 4) b.troupes.push({ carte: o.paquets.vert.pioche.shift(), degats: 0 });
    },
    'bataillon : dégâts au niveau du moral': (o) => { o.bataillons.vert[0].troupes[0].degats = 20; },
    'bataillon : dégâts négatifs': (o) => { o.bataillons.vert[0].troupes[0].degats = -1; },
    'bataillon : Troupe adverse': (o) => { o.bataillons.vert[0].troupes[0].carte = idRouge; },
    'ville : case qui n’est pas une ville': (o) => { o.villes['-1,1'] = 'vert'; },
    'ville : propriétaire': (o) => { o.villes['0,0'] = 'bleu'; },
    'plateau : champ en trop': (o) => { o.plateau.extra = 1; },
    'plateau : rotation': (o) => { o.plateau.pieces[0].rotation = 6; },
    'plateau : coordonnée': (o) => { o.plateau.pieces[0].q = '0'; },
    'plateau : pièces vides': (o) => { o.plateau.pieces = []; },
    'plateau : recouvrement inconnu': (o) => { o.plateau.recouvrements[0].evenement = 'E42'; },
    'plateau : recouvrement hors plateau': (o) => { o.plateau.recouvrements[0].cle = '9,9'; },
    'plateau : camp hors plateau': (o) => { o.plateau.camps.vert[0] = '9,9'; },
    'plateau : camp manquant': (o) => { delete o.plateau.camps.rouge; },
    'journal : pas une liste': (o) => { o.journal = {}; },
    'journal : texte non textuel': (o) => { o.journal[0].texte = 12; },
    'journal : texte trop long': (o) => { o.journal[0].texte = 'x'.repeat(501); },
    'journal : type': (o) => { o.journal[0].type = '<b>'; },
    'journal : numéros non croissants': (o) => { o.journal[1].n = o.journal[0].n; },
    'journal : joueur': (o) => { o.journal[0].joueur = 'bleu'; },
    'journal : champ en trop': (o) => { o.journal[0].html = '<img>'; }
  };
  Object.keys(alterations).forEach((nom) => {
    const o = JSON.parse(texte);
    alterations[nom](o);
    const r = T.valider(o, env);
    assert.equal(r.ok, false, 'altération acceptée à tort : ' + nom);
    assert.equal(r.etat, null);
    assert.ok(typeof r.raison === 'string' && r.raison.length > 0 && r.raison.length < 300, nom);
  });
});

test('valider : clés dangereuses refusées, rien ne fuit vers Object.prototype', () => {
  const { etat, env } = nouvelle();
  const texte = T.serialiser(etat);
  const pieges = [
    texte.replace('"gloire":{', '"gloire":{"__proto__":{"pollue":1},'),
    texte.replace('"villes":{', '"villes":{"__proto__":"vert",'),
    texte.replace('"troupes":{', '"troupes":{"constructor":{"nom":"x","moral":1,"puissance":1,"des":1,"provisoire":true},'),
    texte.replace('"alea":{', '"alea":{"__proto__":{"pollue":1},'),
    texte.replace('"exemplaires":{', '"exemplaires":{"__proto__":{"modele":"T1","joueur":"vert"},')
  ];
  pieges.forEach((t, i) => {
    assert.notEqual(t, texte, 'le piège ' + i + ' doit modifier le texte');
    assert.equal(T.charger(t, env).ok, false, 'piège ' + i);
  });
  assert.equal({}.pollue, undefined);
});

test('valider : un plateau dont le calcul des cases échoue est refusé sans exception', () => {
  const { etat } = nouvelle();
  const env = { alea: creerAlea('x'), plateau: Object.assign({}, fauxPlateau, { cases() { throw new Error('boum'); } }) };
  const r = T.valider(JSON.parse(T.serialiser(etat)), env);
  assert.equal(r.ok, false);
});

test('valider : état d’aléa refusé par le générateur injecté, contrôle de plateau du lot A s’il existe', () => {
  const { etat, env } = nouvelle();
  const strict = { alea: Object.assign(creerAlea('x'), { restaurer() { throw new Error('état invalide'); } }), plateau: fauxPlateau };
  assert.equal(T.valider(JSON.parse(T.serialiser(etat)), strict).ok, false);
  const avecControle = { alea: env.alea, plateau: Object.assign({}, fauxPlateau, { valider() { return { ok: false, plateau: null, erreurs: ['Pièce n° 1 : modèle inconnu du catalogue.'] }; } }) };
  const r = T.valider(JSON.parse(T.serialiser(etat)), avecControle);
  assert.equal(r.ok, false);
  assert.ok(r.raison.includes('modèle inconnu'));
  assert.equal(T.valider(JSON.parse(T.serialiser(etat)), { plateau: fauxPlateau }).ok, false, 'aléa manquant');
});

test('poserEvenement : les alertes du plateau reviennent en avertissements non bloquants', () => {
  const { etat, env } = avecBataillon();
  let recues = null;
  const bavard = Object.assign({}, fauxPlateau, {
    poserEvenement(plateau, id, cle, options) {
      recues = options;
      return Object.assign(fauxPlateau.poserEvenement(plateau, id, cle), { alertes: ['Cette pose coupe le plateau.'] });
    }
  });
  const r = faire(T.poserEvenement(etat, { evenement: 'E2', cle: '-1,0', forcer: true }, { alea: env.alea, hex: hex, plateau: bavard }));
  assert.deepEqual(r.avertissements.filter((a) => a.code === 'plateau'), [{ code: 'plateau', message: 'Cette pose coupe le plateau.', bloquant: false }]);
  assert.deepEqual(recues, { occupees: [] }, 'forcé : les cases occupées ne sont pas opposées au plateau');
  const p = faire(T.piocherEvenement(etat, {}, env));
  T.poserEvenement(p.etat, { evenement: p.carte.id, cle: '-1,0' }, { alea: env.alea, hex: hex, plateau: bavard });
  assert.deepEqual(recues, { occupees: ['0,-2'] });
});

test('creer : les cartes des tuiles d’événement déjà posées sur le plateau ne reviennent pas dans la pioche', () => {
  const sans = nouvelle('ev').etat;
  const plateau = plateauExemple();
  plateau.recouvrements = [{ evenement: 'E2', cle: '-1,0' }, { evenement: 'E8', cle: '1,1' }];
  const env = creerEnv('ev');
  const r = T.creer({ graine: 'ev', plateau: plateau }, env);
  assert.ok(r.ok, r.raison);
  const pe = r.etat.paquets.evenements;
  assert.equal(pe.pioche.length, 6);
  assert.ok(!pe.pioche.includes('E2') && !pe.pioche.includes('E8'));
  assert.deepEqual(pe.defausse.slice().sort(), ['E2', 'E8']);
  assert.deepEqual(pe.main, []);
  // Le reste de la mise en place ne change pas : même ordre de pioche, mêmes mains, même aléa.
  assert.deepEqual(pe.pioche, sans.paquets.evenements.pioche.filter((c) => c !== 'E2' && c !== 'E8'));
  assert.deepEqual(r.etat.paquets.vert, sans.paquets.vert);
  assert.deepEqual(r.etat.paquets.campement, sans.paquets.campement);
  assert.deepEqual(r.etat.alea, sans.alea);
  assert.ok(r.etat.journal.some((l) => /déjà sur le plateau : E2, E8/.test(l.texte)));
  // Les 6 cartes restantes se piochent, jamais les deux autres ; le fichier se relit.
  let etat = r.etat;
  const piochees = [];
  for (let i = 0; i < 6; i++) { const p = faire(T.piocherEvenement(etat, {}, env)); piochees.push(p.carte.id); etat = p.etat; }
  assert.equal(T.piocherEvenement(etat, {}, env).ok, false);
  assert.ok(!piochees.includes('E2') && !piochees.includes('E8'));
  const relu = T.charger(T.serialiser(r.etat), creerEnv('ev'));
  assert.ok(relu.ok, relu.raison);
  assert.deepEqual(relu.etat, r.etat);
  // Fichier incohérent : la carte d’une tuile posée remise dans la pioche est refusée.
  const faux = JSON.parse(T.serialiser(r.etat));
  faux.paquets.evenements.defausse = ['E8'];
  faux.paquets.evenements.pioche.push('E2');
  const refus = T.charger(JSON.stringify(faux), creerEnv('ev'));
  assert.equal(refus.ok, false);
  assert.match(refus.raison, /E2 est déjà sur le plateau/);
});

test('defausserEvenement : carte en attente → défausse Événement, journalisée, annulable, fichier relisible', () => {
  const { etat, env } = nouvelle('def');
  assert.equal(T.defausserEvenement(etat, { evenement: 'E1' }).ok, false, 'carte pas encore piochée');
  assert.equal(T.defausserEvenement(etat, { evenement: 'E99' }).ok, false);
  assert.equal(T.defausserEvenement(etat, {}).ok, false);
  const p = faire(T.piocherEvenement(etat, { joueur: 'vert' }, env));
  const id = p.carte.id;
  assert.deepEqual(p.etat.paquets.evenements.main, [id]);
  const d = faire(T.defausserEvenement(p.etat, { evenement: id, joueur: 'vert' }));
  assert.deepEqual(d.etat.paquets.evenements.main, []);
  assert.deepEqual(d.etat.paquets.evenements.defausse, [id]);
  assert.equal(d.etat.paquets.evenements.pioche.length, 7);
  assert.equal(d.etat.plateau.recouvrements.length, 0, 'la tuile reste en réserve');
  assert.match(dernier(d.etat).texte, new RegExp('Carte Événement ' + id + ' .* défaussée sans être posée'));
  assert.equal(dernier(d.etat).joueur, 'vert');
  assert.deepEqual(d.etat.alea, p.etat.alea, 'aucun tirage');
  assert.equal(T.defausserEvenement(d.etat, { evenement: id }).ok, false, 'pas deux fois');
  // Annulable : l'historique revient à la carte en attente.
  let h = T.historique.pousser(T.historique.creer(p.etat), d.etat);
  h = T.historique.annuler(h);
  assert.deepEqual(h.present.paquets.evenements.main, [id]);
  assert.deepEqual(T.historique.retablir(h).present, d.etat);
  const relu = T.charger(T.serialiser(d.etat), creerEnv('def'));
  assert.ok(relu.ok, relu.raison);
  assert.ok(T.OPERATIONS_PAQUET.indexOf('defausserEvenement') === -1, 'ce n’est pas une opération de deck de joueur');
});
