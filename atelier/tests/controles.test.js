'use strict';
const test = require('node:test');
const assert = require('node:assert');
const K = require('../src/controles.js');
const G = require('../src/generateur.js');
const H = globalThis.AT.hex;
const C = globalThis.AT.catalogue;
const P = globalThis.AT.plateau;

const REGLES = ['inventaire', 'continuite', 'monoblocs', 'villes', 'contact', 'equilibre', 'evenements'];

/** Un plateau complet et valide (seuil de contact 2, le réglage le plus souple), copié à chaque appel. */
const MODELE = (() => {
  for (let graine = 1; graine <= 20; graine++) {
    const res = G.generer(graine, { seuilContact: 2 });
    if (res.ok) return JSON.stringify(res.plateau);
  }
  throw new Error('aucun plateau de référence');
})();
const complet = () => JSON.parse(MODELE);
const OPTIONS = { seuilContact: 2 };

function monter(liste) {
  let p = P.vide(1);
  for (const [modele, q, r, rotation] of liste) {
    const res = P.poser(p, modele, q, r, rotation || 0);
    assert.ok(res.ok, 'pose refusée : ' + res.raison);
    p = res.plateau;
  }
  return p;
}

const niveaux = (constats, niveau) => constats.filter((x) => x.niveau === niveau);
const erreurs = (constats) => niveaux(constats, 'erreur');

function bienForme(constats, regle) {
  assert.ok(Array.isArray(constats) && constats.length > 0);
  constats.forEach((x) => {
    assert.strictEqual(x.regle, regle);
    assert.ok(['erreur', 'alerte', 'info'].includes(x.niveau));
    assert.ok(typeof x.message === 'string' && x.message.length > 0);
    assert.ok(Array.isArray(x.cases));
    x.cases.forEach((k) => assert.ok(H.estCle(k)));
  });
}

test('plateau complet : les 7 contrôles répondent, aucune erreur', () => {
  const bilan = K.tout(complet(), OPTIONS);
  assert.strictEqual(bilan.ok, true, erreurs(bilan.resultats).map((x) => x.message).join(' | '));
  assert.strictEqual(bilan.erreurs, 0);
  assert.deepStrictEqual([...new Set(bilan.resultats.map((x) => x.regle))], REGLES);
  REGLES.forEach((regle) => bienForme(bilan.resultats.filter((x) => x.regle === regle), regle));
  assert.strictEqual(bilan.alertes, niveaux(bilan.resultats, 'alerte').length);
  assert.strictEqual(bilan.equilibre.calculable, true);
});

test('plateau vide : des constats, pas d’exception', () => {
  const bilan = K.tout(P.vide(0));
  assert.strictEqual(bilan.ok, false);
  assert.ok(bilan.resultats.some((x) => x.regle === 'monoblocs' && x.niveau === 'erreur'));
  assert.ok(bilan.resultats.some((x) => x.regle === 'villes' && x.niveau === 'erreur'));
  REGLES.forEach((regle) => bienForme(bilan.resultats.filter((x) => x.regle === regle), regle));
});

test('1. inventaire : tout posé, pièces restantes listées, stock dépassé, pièce hors catalogue', () => {
  const tout = K.inventaire(complet());
  assert.deepStrictEqual(tout.map((x) => x.niveau), ['info']);
  assert.match(tout[0].message, /64 pièces/);

  const p = complet();
  const retiree = p.pieces.filter((x) => x.modele === 'P')[0];
  const moins = K.inventaire(P.retirer(p, retiree.id).plateau);
  assert.deepStrictEqual(moins.map((x) => x.niveau), ['alerte']);
  assert.match(moins[0].message, /Pièces restantes \(1\) : 1 × Plaine/);

  const trop = complet();
  trop.pieces.push({ id: 'trop', modele: 'M4', q: 20, r: 0, rotation: 0 });
  const depasse = erreurs(K.inventaire(trop));
  assert.strictEqual(depasse.length, 1);
  assert.match(depasse[0].message, /Stock dépassé : 2 × « Montagne zigzag » posées pour 1/);
  assert.ok(depasse[0].cases.includes('20,0'));

  const inconnue = complet();
  inconnue.pieces.push({ id: 'x', modele: 'ZZ', q: 20, r: 0, rotation: 0 });
  assert.match(erreurs(K.inventaire(inconnue))[0].message, /hors catalogue/);
});

test('2. continuité : chevauchement, plateau en morceaux, cases franchissables coupées', () => {
  assert.deepStrictEqual(K.continuite(complet()).map((x) => x.niveau), ['info']);

  const double = complet();
  double.pieces.push({ id: 'double', modele: 'F', q: 1, r: 0, rotation: 0 });
  const e1 = erreurs(K.continuite(double));
  assert.strictEqual(e1.length, 1);
  assert.match(e1[0].message, /Chevauchement/);
  assert.deepStrictEqual(e1[0].cases, ['1,0']);

  const loin = complet();
  loin.pieces.filter((x) => x.modele === 'P')[0].q = 20;
  const e2 = erreurs(K.continuite(loin));
  assert.ok(e2.some((x) => /morceaux/.test(x.message)));

  // Deux plaines qui ne se rejoignent que par une montagne : un seul tenant, mais pas reliées.
  const coupe = monter([['P', -1, 0], ['M4', 0, 0], ['P', 3, 1]]);
  const e3 = erreurs(K.continuite(coupe));
  assert.strictEqual(e3.length, 1);
  assert.match(e3[0].message, /sans liaison/);
  assert.deepStrictEqual(e3[0].cases, ['3,1']);

  assert.deepStrictEqual(K.continuite(P.vide()).map((x) => x.niveau), ['alerte']);
});

test('3. monoblocs : noyau absent ou décentré', () => {
  assert.deepStrictEqual(K.monoblocs(complet()).map((x) => x.niveau), ['info']);
  const sans = complet();
  sans.pieces = sans.pieces.filter((x) => x.modele !== 'N1');
  assert.match(erreurs(K.monoblocs(sans))[0].message, /noyau n’est pas posé/);
  const decentre = monter([['N1', 1, 0]]);
  const e = erreurs(K.monoblocs(decentre));
  assert.strictEqual(e.length, 1);
  assert.match(e[0].message, /centré en \(0,0\)/);
  assert.strictEqual(e[0].cases.length, 7);
});

test('3. monoblocs : une ville dans un monobloc hors noyau est une erreur (catalogue modifié le temps du test)', () => {
  const casesF3 = C.MODELES.F3.cases;
  try {
    C.MODELES.F3.cases = casesF3.map((c, i) => ({ q: c.q, r: c.r, terrain: i === 0 ? 'ville' : c.terrain }));
    const res = erreurs(K.monoblocs(complet()));
    assert.strictEqual(res.length, 2);
    assert.match(res[0].message, /Catalogue/);
    assert.strictEqual(res[1].cases.length, 3);
  } finally {
    C.MODELES.F3.cases = casesF3;
  }
  assert.deepStrictEqual(C.monoblocsAvecVille(), []);
});

test('4. villes : nombre, écart, rangées de déploiement, camps enregistrés', () => {
  const bon = K.villes(complet());
  assert.deepStrictEqual(bon.map((x) => x.niveau), ['info']);
  assert.ok(bon[0].donnees.ecartMinimal >= 4);
  assert.strictEqual(bon[0].cases.length, 7);

  // Une ville neutre remplacée par une plaine : 6 villes.
  const p = complet();
  const camps = p.camps.vert.concat(p.camps.rouge);
  const neutre = p.pieces.filter((x) => x.modele === 'V' && !camps.includes(H.cle(x.q, x.r)))[0];
  neutre.modele = 'P';
  assert.ok(erreurs(K.villes(p)).some((x) => /6 villes sur le plateau ; il en faut 7/.test(x.message)));

  // Une ville de déploiement en moins sur la rangée du haut.
  const q = complet();
  q.pieces.filter((x) => x.modele === 'V' && H.cle(x.q, x.r) === q.camps.vert[0])[0].modele = 'P';
  const e = erreurs(K.villes(q));
  assert.ok(e.some((x) => /1 ville sur la rangée du haut/.test(x.message)));
  assert.ok(e.some((x) => /enregistrées pour Vert/.test(x.message)));

  // Camps enregistrés faux.
  const r = complet();
  r.camps.rouge = [r.camps.rouge[0]];
  const e2 = erreurs(K.villes(r));
  assert.strictEqual(e2.length, 1);
  assert.match(e2[0].message, /enregistrées pour Rouge/);
});

test('4. villes : deux villes trop proches, trois villes à égalité sur une rangée', () => {
  const proches = monter([['N1', 0, 0], ['P', 2, 0], ['P', 3, 0], ['V', 4, 0]]);
  // Villes à 4 pas : conforme au réglage par défaut (4), fautif si l'on demande 5.
  assert.strictEqual(erreurs(K.villes(proches)).filter((x) => /trop proches/.test(x.message)).length, 0);
  const e = erreurs(K.villes(proches, { ecartVilles: 5 })).filter((x) => /trop proches/.test(x.message));
  assert.strictEqual(e.length, 1);
  assert.deepStrictEqual(e[0].cases, ['0,0', '4,0']);
  assert.match(e[0].message, /à 4 pas ; il en faut 5/);
  const tresProches = monter([['N1', 0, 0], ['V', 2, 0]]);
  assert.match(erreurs(K.villes(tresProches)).filter((x) => /trop proches/.test(x.message))[0].message, /à 2 pas ; il en faut 4 \(soit 3 tuiles entre elles\)/);

  const rangee = ['V', 'P', 'P', 'P', 'V', 'P', 'P', 'P', 'V'].map((m, i) => [m, i - 4, -2]);
  const egalite = monter([['N1', 0, 0]].concat(rangee));
  assert.ok(erreurs(K.villes(egalite)).some((x) => /3 villes à égalité sur la rangée du haut/.test(x.message)));
  // Cas ambigu : aucune ville de déploiement désignée pour Vert, et le plateau retouché (camps recalculés)
  // ne reçoit pas en plus une fausse erreur « enregistrées ».
  const retouche = P.avecCamps(egalite);
  assert.deepStrictEqual(retouche.camps.vert, []);
  const e3 = erreurs(K.villes(retouche));
  const egalites = e3.filter((x) => /à égalité/.test(x.message));
  assert.strictEqual(egalites.length, 1);
  assert.deepStrictEqual(egalites[0].cases, ['-4,-2', '0,-2', '4,-2']);
  assert.strictEqual(e3.filter((x) => /enregistrées pour Vert/.test(x.message)).length, 0);
  assert.strictEqual(K.equilibre(retouche).calculable, false);
  assert.match(K.controleEquilibre(retouche)[0].message, /trop/);
});

test('5. contact : les deux mesures sont calculées ; seule la mesure retenue donne une erreur', () => {
  // Un bois (triangle) et une plaine posée contre deux de ses cases : 2 côtés, mais 1 seule pièce voisine.
  const p = monter([['F3', 0, 0], ['P', 1, 1]]);
  const tous = K.contacts(p);
  const plaine = tous.filter((x) => x.modele === 'P')[0], bois = tous.filter((x) => x.modele === 'F3')[0];
  assert.strictEqual(plaine.cotes, 2);
  assert.strictEqual(plaine.pieces, 1);
  assert.strictEqual(bois.cotes, 1);
  assert.strictEqual(bois.pieces, 1);
  assert.deepStrictEqual(bois.cases, ['0,0', '1,0', '0,1']);

  const cotes2 = K.contact(p, { seuilContact: 2, mesureContact: 'cotes' });
  assert.strictEqual(cotes2.length, 2);
  assert.strictEqual(cotes2[0].donnees.mesure, 'cotes');
  assert.strictEqual(cotes2[0].niveau, 'erreur');                 // le bois n'a qu'un côté
  assert.deepStrictEqual(cotes2[0].cases, ['0,0', '1,0', '0,1']);
  assert.strictEqual(cotes2[1].donnees.mesure, 'pieces');
  assert.strictEqual(cotes2[1].niveau, 'info');                   // sous le seuil aussi, mais pour information
  assert.strictEqual(cotes2[1].donnees.sousLeSeuil, 2);

  const pieces2 = K.contact(p, { seuilContact: 2, mesureContact: 'pieces' });
  assert.strictEqual(pieces2[0].niveau, 'info');
  assert.strictEqual(pieces2[1].niveau, 'erreur');
  assert.strictEqual(pieces2[1].cases.length, 4);

  const seuil1 = K.contact(p, { seuilContact: 1, mesureContact: 'pieces' });
  assert.deepStrictEqual(seuil1.map((x) => x.niveau), ['info', 'info']);
  assert.strictEqual(erreurs(K.contact(p)).length, 1, 'par défaut : seuil 3, mesure « côtés »');
});

test('5. contact : sur le plateau complet, chaque tuile atteint le seuil demandé', () => {
  K.contacts(complet()).forEach((x) => assert.ok(x.cotes >= 2, x.piece + ' : ' + x.cotes + ' côté(s)'));
  assert.strictEqual(K.contacts(complet()).length, 64);
});

test('6. équilibre : score par les coûts en rations, villes symétriques', () => {
  const p = complet();
  const e = K.equilibre(p);
  assert.strictEqual(e.calculable, true);
  assert.strictEqual(e.villes.length, 7);
  assert.deepStrictEqual(e.sansSymetrique, []);
  assert.deepStrictEqual(e.horsAtteinte, []);
  const dv = P.distancesRations(p, p.camps.vert), dr = P.distancesRations(p, p.camps.rouge);
  let score = 0;
  e.villes.forEach((v) => {
    assert.strictEqual(v.symetrique, H.symetrique(v.cle));
    assert.strictEqual(v.vert, dv[v.cle]);
    assert.strictEqual(v.rouge, dr[v.cle]);
    assert.strictEqual(v.ecart, Math.abs(dv[v.cle] - dr[H.symetrique(v.cle)]));
    score += v.ecart;
  });
  assert.strictEqual(e.score, score);
  assert.strictEqual(e.villes.filter((v) => p.camps.vert.includes(v.cle)).every((v) => v.vert === 0), true);
});

test('6. équilibre : un marais devant un seul camp dégrade le score', () => {
  // Vert en haut, Rouge en bas, ville au centre ; colonne de plaines de chaque côté.
  const symetrique = monter([['V', 0, -2], ['P', 0, -1], ['V', 0, 0], ['P', 0, 1], ['V', 0, 2]]);
  assert.strictEqual(K.equilibre(symetrique).score, 0);
  const penche = monter([['V', 0, -2], ['S', 0, -1], ['V', 0, 0], ['P', 0, 1], ['V', 0, 2]]);
  const e = K.equilibre(penche);
  // Centre : 3 pour Vert, 2 pour Rouge (écart 1) ; ville du haut vue par Vert 0, ville du bas vue par Rouge 0 ;
  // ville du bas vue par Vert 5, ville du haut vue par Rouge 5 : score 1.
  assert.strictEqual(e.score, 1);
  assert.strictEqual(e.villes.filter((v) => v.cle === '0,0')[0].vert, 3);
  assert.strictEqual(e.villes.filter((v) => v.cle === '0,0')[0].rouge, 2);
  assert.strictEqual(K.equilibre(penche, { couts: { plaine: 1, ville: 1, marais: 4 } }).score, 3);
});

test('6. équilibre : non calculable sans camps, ville sans symétrique signalée, répartition des terrains', () => {
  const seul = monter([['N1', 0, 0]]);
  assert.strictEqual(K.equilibre(seul).calculable, false);
  assert.strictEqual(K.controleEquilibre(seul)[0].niveau, 'alerte');
  const bancal = monter([['V', 0, -2], ['P', 0, -1], ['P', 0, 0], ['V', 1, 0], ['P', 0, 1], ['V', 0, 2]]);
  const constats = K.controleEquilibre(bancal);
  assert.ok(constats.some((x) => x.niveau === 'alerte' && /sans ville symétrique/.test(x.message) && x.cases.includes('1,0')));
  const complets = K.controleEquilibre(complet());
  assert.strictEqual(erreurs(complets).length, 0);
  assert.match(complets[0].message, /^Équilibre : score \d+/);
  assert.deepStrictEqual(K.repartition(complet()), { total: 75, plaine: 53, foret: 11, marais: 11 });
  assert.ok(complets.some((x) => /plaines 70,7 %, forêts 14,7 %, marais 14,7 %/.test(x.message)));
});

test('7. événements : pose correcte, pose fautive venue d’un fichier, coupure du plateau', () => {
  assert.deepStrictEqual(K.evenements(complet()).map((x) => x.niveau), ['info']);

  const p = complet();
  const cases = P.cases(p);
  const foret = Object.keys(cases).filter((k) => cases[k].terrain === 'foret')[0];
  const bon = P.poserEvenement(p, 'E4', foret);
  assert.ok(bon.ok);
  if (!bon.alertes.length) assert.deepStrictEqual(K.evenements(bon.plateau).map((x) => x.niveau), ['info']);

  const fautif = complet();
  fautif.recouvrements = [{ evenement: 'E3', cle: foret }, { evenement: 'E2', cle: '0,0' }, { evenement: 'E9', cle: foret }];
  const e = erreurs(K.evenements(fautif));
  assert.ok(e.some((x) => /« Tunnel » mal posé/.test(x.message) && x.cases[0] === foret));
  assert.ok(e.some((x) => /« Crevasse » mal posé/.test(x.message)));
  assert.ok(e.some((x) => /inconnu/.test(x.message)));

  const ligne = monter([['P', 0, 0], ['P', 1, 0], ['V', 2, 0]]);
  const coupe = P.poserEvenement(ligne, 'E2', '1,0').plateau;
  const constats = K.evenements(coupe);
  assert.strictEqual(erreurs(constats).length, 0);
  const alerte = niveaux(constats, 'alerte');
  assert.strictEqual(alerte.length, 1);
  assert.match(alerte[0].message, /coupent le plateau/);
  assert.match(alerte[0].message, /1 ville/);
  // Les contrôles 1 à 6 jugent la construction : la crevasse ne crée pas d'erreur de continuité.
  assert.strictEqual(erreurs(K.continuite(coupe)).length, 0);
});

test('tout : les options choisissent le seuil et la mesure de contact', () => {
  const p = monter([['F3', 0, 0], ['P', 1, 1]]);
  const contact = (options) => K.tout(p, options).resultats.filter((x) => x.regle === 'contact' && x.niveau === 'erreur').length;
  assert.strictEqual(contact({ seuilContact: 1, mesureContact: 'cotes' }), 0);
  assert.strictEqual(contact({ seuilContact: 2, mesureContact: 'cotes' }), 1);
  assert.strictEqual(contact({ seuilContact: 2, mesureContact: 'pieces' }), 1);
  assert.strictEqual(contact(), 1);
});

test('2. trous : case vide entourée signalée en alerte (réglable : erreur, ignore), cases du trou à montrer', () => {
  // Un plateau généré n'a pas de trou, et le contrôle le dit.
  const sain = K.continuite(complet(), OPTIONS);
  assert.deepStrictEqual(sain.map((x) => x.niveau), ['info']);
  assert.match(sain[0].message, /aucun trou/);
  assert.deepStrictEqual(P.trous(Object.keys(P.cases(complet()))), []);

  // Une plaine entourée de six cases est retirée : un trou d'une case.
  const p = complet(), cases = P.cases(p);
  const entouree = Object.keys(cases).find((k) => cases[k].modele === 'P' && H.voisines(k).every((v) => cases[v]));
  assert.ok(entouree, 'une plaine entourée existe');
  const troue = P.avecCamps(P.retirer(p, cases[entouree].piece).plateau);
  assert.deepStrictEqual(P.trous(Object.keys(P.cases(troue))), [[entouree]]);
  const constats = K.continuite(troue, OPTIONS).filter((x) => /trou/i.test(x.message));
  assert.strictEqual(constats.length, 1);
  assert.strictEqual(constats[0].niveau, 'alerte');
  assert.strictEqual(C.REGLAGES.trous, 'alerte');
  assert.deepStrictEqual(constats[0].cases, [entouree]);
  assert.match(constats[0].message, /Un trou dans le plateau : 1 case vide entourée/);
  assert.strictEqual(erreurs(K.continuite(troue, OPTIONS)).length, 0, 'en alerte, un trou ne fait pas d’erreur');

  // Niveau réglable.
  const enErreur = K.continuite(troue, Object.assign({ trous: 'erreur' }, OPTIONS)).filter((x) => /trou/i.test(x.message));
  assert.strictEqual(enErreur[0].niveau, 'erreur');
  assert.strictEqual(K.tout(troue, Object.assign({ trous: 'erreur' }, OPTIONS)).ok, false);
  assert.strictEqual(K.continuite(troue, Object.assign({ trous: 'ignore' }, OPTIONS)).filter((x) => /trou/i.test(x.message)).length, 0);

  // La même plaine reposée au bord : toutes les pièces sont là, aucune erreur, mais l'alerte demeure (constat I2 de la revue).
  const bords = [];
  Object.keys(P.cases(troue)).forEach((k) => H.voisines(k).forEach((v) => { if (!P.cases(troue)[v] && v !== entouree) bords.push(v); }));
  let repose = null;
  for (const v of bords) {
    const c = H.decle(v), r = P.poser(troue, 'P', c.q, c.r, 0);
    if (r.ok && K.tout(P.avecCamps(r.plateau), OPTIONS).ok) { repose = P.avecCamps(r.plateau); break; }
  }
  assert.ok(repose, 'une place au bord garde le plateau sans erreur');
  const bilan = K.tout(repose, OPTIONS);
  assert.strictEqual(bilan.ok, true);
  assert.ok(bilan.alertes >= 1 && bilan.resultats.some((x) => x.regle === 'continuite' && x.niveau === 'alerte' && x.cases.join() === entouree));

  // Deux cases vides voisines : un seul trou de 2 cases ; une échancrure ouverte sur l'extérieur n'est pas un trou.
  const anneau = monter([['P', 0, -1], ['P', 1, -1], ['P', 2, -1], ['P', -1, 0], ['P', 2, 0], ['P', -1, 1], ['P', 0, 1], ['P', 1, 1]]);
  assert.deepStrictEqual(P.trous(Object.keys(P.cases(anneau))), [['0,0', '1,0']]);
  const ouvert = P.retirer(anneau, P.cases(anneau)['2,0'].piece).plateau;
  assert.deepStrictEqual(P.trous(Object.keys(P.cases(ouvert))), []);
  assert.deepStrictEqual(P.trous([]), []);
});
