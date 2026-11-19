'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const K = require('../src/controles.js');
const G = require('../src/generateur.js');
const H = globalThis.AT.hex;
const C = globalThis.AT.catalogue;
const P = globalThis.AT.plateau;

// Groupe « construction », puis « villes », puis les événements.
const REGLES = ['inventaire', 'continuite', 'monoblocs', 'contact', 'villes', 'equilibre', 'evenements'];
const GROUPES = { inventaire: 'construction', continuite: 'construction', monoblocs: 'construction', contact: 'construction', villes: 'villes', equilibre: 'villes', evenements: 'evenements' };

/** Un plateau complet du catalogue 2 (terrain construit, villes posées), copié à chaque appel. */
const MODELE = (() => {
  const res = G.generer(7);
  if (!res.ok) throw new Error('aucun plateau de référence : ' + res.raison);
  return JSON.stringify(res.plateau);
})();
const complet = () => JSON.parse(MODELE);

/** Le même plateau à l'étape des villes : terrain construit, aucune ville posée. */
function construit() {
  let p = complet();
  P.etatVilles(p).neutres.forEach((n) => { p = P.retirerVilleNeutre(p, n.cle).plateau; });
  P.deploiements(p).forEach((d) => { p = P.retirerVilleDeploiement(p, d.cle).plateau; });
  return p;
}

/** Un plateau de l'ancien catalogue, tel qu'il a été enregistré en version 1. */
const ancien = () => {
  const lu = P.lire(fs.readFileSync(path.join(__dirname, 'fixtures-v1', 'plateau-genere.json'), 'utf8'));
  assert.ok(lu.ok, lu.erreurs.join(' '));
  return lu.plateau;
};

function monter(liste) {
  let p = P.vide(1);
  for (const [modele, q, r, rotation] of liste) {
    const res = P.poser(p, modele, q, r, rotation || 0, { horsStock: ['P', 'F', 'S', 'V', 'M1'].includes(modele) });
    assert.ok(res.ok, 'pose refusée : ' + res.raison);
    p = res.plateau;
  }
  return p;
}

const niveaux = (constats, niveau) => constats.filter((x) => x.niveau === niveau);
const erreurs = (constats) => niveaux(constats, 'erreur');
const alertes = (constats) => niveaux(constats, 'alerte');

function bienForme(constats, regle) {
  assert.ok(Array.isArray(constats) && constats.length > 0);
  constats.forEach((x) => {
    assert.strictEqual(x.regle, regle);
    assert.strictEqual(x.groupe, GROUPES[regle]);
    assert.ok(['erreur', 'alerte', 'info'].includes(x.niveau));
    assert.ok(typeof x.message === 'string' && x.message.length > 0);
    assert.ok(Array.isArray(x.cases));
    x.cases.forEach((k) => assert.ok(H.estCle(k)));
  });
}

test('plateau complet : tous les contrôles répondent, deux groupes, aucune erreur, étape « complet »', () => {
  const bilan = K.tout(complet());
  assert.strictEqual(bilan.ok, true, erreurs(bilan.resultats).map((x) => x.message).join(' | '));
  assert.strictEqual(bilan.erreurs, 0);
  assert.strictEqual(bilan.alertes, 0);
  assert.deepStrictEqual([...new Set(bilan.resultats.map((x) => x.regle))], REGLES);
  REGLES.forEach((regle) => bienForme(bilan.resultats.filter((x) => x.regle === regle), regle));
  assert.strictEqual(bilan.etape, 'complet');
  assert.match(bilan.etapeMessage, /Plateau complet/);
  assert.deepStrictEqual(bilan.construction, { erreurs: 0, alertes: 0, terminee: true, restantes: 0 });
  assert.deepStrictEqual(bilan.villes, { erreurs: 0, alertes: 0, completes: true, manquantes: { vert: 0, rouge: 0, neutres: 0 } });
  assert.strictEqual(bilan.equilibre.calculable, true);
});

test('étapes : construction en cours, puis « construction terminée, villes à poser », puis complet', () => {
  // Plateau vierge : le noyau seul.
  const vierge = K.tout(P.vierge(1));
  assert.strictEqual(vierge.etape, 'construction');
  assert.strictEqual(vierge.construction.terminee, false);
  assert.strictEqual(vierge.construction.restantes, 23);
  assert.match(vierge.etapeMessage, /Construction en cours : 23 pièces de terrain à poser/);
  const attente = vierge.resultats.filter((x) => x.regle === 'villes');
  assert.deepStrictEqual(attente.map((x) => x.niveau), ['info'], 'villes à poser pendant la construction : simple information');
  assert.match(attente[0].message, /une fois le terrain construit/);

  // Terrain construit, aucune ville : pas une erreur, une alerte qui dit quoi poser.
  const p = construit(), bilan = K.tout(p);
  assert.strictEqual(bilan.ok, true, erreurs(bilan.resultats).map((x) => x.message).join(' | '));
  assert.strictEqual(bilan.etape, 'villes');
  assert.strictEqual(bilan.construction.terminee, true);
  assert.strictEqual(bilan.construction.erreurs, 0);
  assert.strictEqual(bilan.villes.completes, false);
  assert.deepStrictEqual(bilan.villes.manquantes, { vert: 2, rouge: 2, neutres: 2 });
  assert.strictEqual(bilan.etapeMessage, 'Construction terminée, villes à poser : 2 villes de déploiement pour Vert, 2 villes de déploiement pour Rouge, 2 villes neutres.');
  const villes = bilan.resultats.filter((x) => x.regle === 'villes');
  assert.deepStrictEqual(villes.map((x) => x.niveau), ['alerte']);
  assert.match(villes[0].message, /^Construction terminée, villes à poser/);
  assert.deepStrictEqual(K.etape(p).villes, { vert: 2, rouge: 2, neutres: 2 });

  // Une ville posée : il en reste cinq.
  const une = P.poserVilleDeploiement(p, 'vert', P.placesDeploiement(p, 'vert')[0]).plateau;
  assert.match(K.etape(une).message, /1 ville de déploiement pour Vert, 2 villes de déploiement pour Rouge, 2 villes neutres/);
  assert.strictEqual(K.etape(complet()).etape, 'complet');
});

test('plateau vide : des constats, pas d’exception', () => {
  const bilan = K.tout(P.vide(0));
  assert.strictEqual(bilan.ok, false);
  assert.ok(bilan.resultats.some((x) => x.regle === 'monoblocs' && x.niveau === 'erreur'));
  assert.strictEqual(bilan.etape, 'construction');
  REGLES.forEach((regle) => bienForme(bilan.resultats.filter((x) => x.regle === regle), regle));
});

test('inventaire : tout posé, pièces restantes, remplissages facultatifs, stock dépassé, tuiles hors catalogue', () => {
  const tout = K.inventaire(complet());
  assert.deepStrictEqual(tout.map((x) => x.niveau), ['info', 'info']);
  assert.match(tout[0].message, /Toutes les pièces de terrain du catalogue sont posées \(24 pièces\)/);
  assert.match(tout[1].message, /Tuiles facultatives non posées : 2 × Remplissage/);

  const p = complet();
  const retiree = p.pieces.filter((x) => x.modele === 'P3A')[0];
  const moins = K.inventaire(P.retirer(p, retiree.id).plateau);
  assert.deepStrictEqual(alertes(moins).length, 1);
  assert.match(alertes(moins)[0].message, /Pièces de terrain restantes \(1\) : 1 × Pré en triangle/);

  // Les villes neutres restantes ne sont pas l'affaire de l'inventaire.
  assert.strictEqual(alertes(K.inventaire(construit())).length, 0);

  const trop = complet();
  trop.pieces.push({ id: 'trop', modele: 'M4', q: 20, r: 0, rotation: 0 });
  const depasse = erreurs(K.inventaire(trop));
  assert.strictEqual(depasse.length, 1);
  assert.match(depasse[0].message, /Stock dépassé : 2 × « Montagne zigzag » posées pour 1/);
  assert.ok(depasse[0].cases.includes('20,0'));

  const inconnue = complet();
  inconnue.pieces.push({ id: 'x', modele: 'ZZ', q: 20, r: 0, rotation: 0 });
  assert.match(erreurs(K.inventaire(inconnue))[0].message, /hors catalogue/);

  // Tuiles d'une case de l'ancien catalogue et montagne d'une case : du carton à prévoir, pas une faute.
  const peint = monter([['N1', 0, 0], ['P', 2, 0], ['F', 3, 0], ['M1', 2, -1]]);
  const constats = K.inventaire(peint);
  assert.strictEqual(erreurs(constats).length, 0);
  const enPlus = alertes(constats).filter((x) => /à prévoir en plus du catalogue \(3\)/.test(x.message))[0];
  assert.ok(enPlus, 'alerte « tuiles à prévoir en plus »');
  assert.deepStrictEqual(enPlus.donnees.parModele, { M1: 1, P: 1, F: 1 });
  assert.ok(alertes(constats).some((x) => /montagne d’une case/.test(x.message)));
});

test('continuité : chevauchement, plateau en morceaux, cases franchissables coupées', () => {
  assert.deepStrictEqual(K.continuite(complet()).map((x) => x.niveau), ['info']);

  const double = complet();
  double.pieces.push({ id: 'double', modele: 'F', q: 1, r: 0, rotation: 0 });
  const e1 = erreurs(K.continuite(double));
  assert.strictEqual(e1.length, 1);
  assert.match(e1[0].message, /Chevauchement/);
  assert.deepStrictEqual(e1[0].cases, ['1,0']);

  const loin = complet();
  loin.pieces.filter((x) => x.modele === 'P3A')[0].q = 20;
  assert.ok(erreurs(K.continuite(loin)).some((x) => /morceaux/.test(x.message)));

  // Deux plaines qui ne se rejoignent que par une montagne : un seul tenant, mais pas reliées.
  const coupe = monter([['P', -1, 0], ['M4', 0, 0], ['P', 3, 1]]);
  const e3 = erreurs(K.continuite(coupe));
  assert.strictEqual(e3.length, 1);
  assert.match(e3[0].message, /sans liaison/);
  assert.deepStrictEqual(e3[0].cases, ['3,1']);

  assert.deepStrictEqual(K.continuite(P.vide()).map((x) => x.niveau), ['alerte']);
});

test('trous : case vide entourée signalée en alerte (réglable : erreur, ignore) ; une ville neutre ne ferme pas un trou', () => {
  // Un anneau de 6 plaines autour d'une case vide.
  const anneau = monter(H.voisines('5,0').map((k) => { const c = H.decle(k); return ['P', c.q, c.r]; }));
  const trou = K.continuite(anneau).filter((x) => /trou/.test(x.message));
  assert.strictEqual(trou.length, 1);
  assert.strictEqual(trou[0].niveau, 'alerte');
  assert.deepStrictEqual(trou[0].cases, ['5,0']);
  assert.deepStrictEqual(trou[0].donnees, { trous: 1, cases: 1 });
  assert.strictEqual(K.continuite(anneau, { trous: 'erreur' }).filter((x) => /trou/.test(x.message))[0].niveau, 'erreur');
  assert.strictEqual(K.continuite(anneau, { trous: 'ignore' }).filter((x) => /trou/.test(x.message)).length, 0);
  assert.match(K.continuite(complet())[0].message, /aucun trou/);
  // Un anneau ouvert que seule une ville neutre refermerait : pas un trou du terrain.
  const ouvert = monter(H.voisines('5,0').slice(1).map((k) => { const c = H.decle(k); return ['P', c.q, c.r]; }));
  const manquante = H.decle(H.voisines('5,0')[0]);
  ouvert.pieces.push({ id: 'vn', modele: 'VN', q: manquante.q, r: manquante.r, rotation: 0 });
  assert.strictEqual(K.continuite(ouvert).filter((x) => /Un trou|trous dans/.test(x.message)).length, 0);
});

test('monoblocs : noyau absent ou décentré ; jamais de ville imprimée dans un monobloc', () => {
  assert.deepStrictEqual(K.monoblocs(complet()).map((x) => x.niveau), ['info']);
  const sans = complet();
  sans.pieces = sans.pieces.filter((x) => x.modele !== 'N1');
  assert.match(erreurs(K.monoblocs(sans))[0].message, /noyau n’est pas posé/);
  const decentre = monter([['N1', 1, 0]]);
  const e = erreurs(K.monoblocs(decentre));
  assert.strictEqual(e.length, 1);
  assert.match(e[0].message, /centré en \(0,0\)/);
  assert.strictEqual(e[0].cases.length, 7);
  // Catalogue modifié le temps du test : une ville dans un monobloc de terrain.
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
  // A2 relue : une ville de déploiement posée sur une Plaine de monobloc n'est pas « une ville dans un monobloc ».
  const p = complet(), surMonobloc = P.deploiements(p).filter((d) => P.modele(p, P.cases(p)[d.cle].modele).cases.length > 1);
  assert.ok(surMonobloc.length > 0);
  assert.strictEqual(erreurs(K.monoblocs(p)).length, 0);
});

test('contact : les deux mesures sont calculées ; seule la mesure retenue donne une erreur', () => {
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

  assert.deepStrictEqual(K.contact(p, { seuilContact: 1, mesureContact: 'pieces' }).map((x) => x.niveau), ['info', 'info']);
  assert.strictEqual(erreurs(K.contact(p)).length, 1, 'par défaut : seuil 3, mesure « pièces »');
});

test('contact : une tuile de remplissage a son propre seuil ; les villes neutres ne comptent pas', () => {
  // Deux monoblocs et un remplissage qui touche les deux : le remplissage touche 2 pièces.
  const p = monter([['P3A', 0, 0], ['P3C', 2, 0], ['R', 1, 1]]);
  const r = K.contacts(p).filter((x) => x.modele === 'R')[0];
  assert.strictEqual(r.pieces, 2);
  const pieces = (options) => K.contact(p, Object.assign({ mesureContact: 'pieces' }, options)).filter((x) => x.donnees.mesure === 'pieces')[0];
  assert.strictEqual(pieces({ seuilContact: 3 }).donnees.sousLeSeuil, 2, 'les deux monoblocs, pas le remplissage (seuil 2)');
  assert.strictEqual(pieces({ seuilContact: 3 }).cases.includes('1,1'), false);
  assert.strictEqual(pieces({ seuilContact: 3, seuilContactRemplissage: 3 }).donnees.sousLeSeuil, 3);
  assert.strictEqual(pieces({ seuilContact: 2 }).donnees.sousLeSeuil, 0);
  assert.strictEqual(C.REGLAGES.seuilContactRemplissage, 2);
  // Sur le plateau complet : 24 pièces de terrain jugées, les 2 villes neutres à part, chacune à 3 pièces au moins.
  const tous = K.contacts(complet());
  assert.strictEqual(tous.length, 24);
  assert.strictEqual(tous.some((x) => x.modele === 'VN'), false);
  tous.forEach((x) => assert.ok(x.pieces >= 3, x.piece + ' : ' + x.pieces + ' pièce(s)'));
  // Retirer les villes ne change pas le contact du terrain.
  assert.deepStrictEqual(K.contacts(construit()), tous);
});

test('villes : ville de déploiement mal placée (B4)', () => {
  const p = construit(), cases = P.cases(p);
  // Une Plaine du milieu du plateau, hors noyau : pose « libre » acceptée, contrôle en erreur.
  const milieu = Object.keys(cases).filter((k) => cases[k].terrain === 'plaine' && cases[k].modele !== 'N1' && Math.abs(H.decle(k).r) <= 1 && H.distance(k, '0,0') >= 4)[0];
  assert.ok(milieu);
  assert.strictEqual(P.poserVilleDeploiement(p, 'vert', milieu).ok, false, 'la pose stricte refuse');
  const fautif = P.poserVilleDeploiement(p, 'vert', milieu, { libre: true });
  assert.ok(fautif.ok);
  const e = erreurs(K.villes(fautif.plateau));
  assert.strictEqual(e.length, 1);
  assert.match(e[0].message, /Ville de déploiement de Vert en \(.*\) mal placée : Cette case n’est pas à l’extrémité du haut/);
  assert.deepStrictEqual(e[0].cases, [milieu]);
  assert.strictEqual(K.tout(fautif.plateau).ok, false);
  // La profondeur des extrémités est un réglage : avec 11 rangées, toute case de bord devient admissible.
  const bord = H.voisines(milieu).some((v) => !cases[v]);
  assert.strictEqual(erreurs(K.villes(fautif.plateau, { profondeurExtremite: 11 })).length, bord ? 0 : 1);
  // Bien placée : aucune erreur.
  const bon = P.poserVilleDeploiement(p, 'vert', P.placesDeploiement(p, 'vert')[0]);
  assert.strictEqual(erreurs(K.villes(bon.plateau)).length, 0);
});

test('villes : ville neutre mal placée (B5), deux villes neutres sur le même flanc', () => {
  const p = construit(), terrain = P.cases(p), e = P.etendueSurCases(terrain);
  // Tout en haut du plateau : ce n'est pas un flanc.
  const haut = Object.keys(terrain).filter((k) => H.decle(k).r === e.haut)[0], c = H.decle(haut);
  const auDessus = H.cle(c.q, c.r - 1);
  assert.strictEqual(P.poserVilleNeutre(p, auDessus).ok, false);
  const fautif = P.poserVilleNeutre(p, auDessus, { libre: true });
  assert.ok(fautif.ok, fautif.raison);
  const err = erreurs(K.villes(fautif.plateau));
  assert.strictEqual(err.length, 1);
  assert.match(err[0].message, /Ville neutre en \(.*\) mal placée/);
  // Deux villes neutres à gauche.
  const gauches = P.placesNeutres(p).filter((x) => x.flanc === 'gauche');
  assert.ok(gauches.length >= 2, 'au moins deux places à gauche sur ce plateau');
  const un = P.poserVilleNeutre(p, gauches[0].cle).plateau;
  const loin = gauches.filter((x) => P.distancesPas(un, gauches[0].cle)[x.cle] === undefined && H.distance(x.cle, gauches[0].cle) >= 2)[0] || gauches[gauches.length - 1];
  assert.match(P.poserVilleNeutre(un, loin.cle).raison, /Le flanc gauche a déjà sa ville neutre/);
  const deux = P.poserVilleNeutre(un, loin.cle, { libre: true });
  assert.ok(deux.ok);
  assert.ok(erreurs(K.villes(deux.plateau)).some((x) => /Deux villes neutres sur le flanc gauche/.test(x.message)));
});

test('villes : écart de 4 pas entre toutes les villes (B6), camps enregistrés', () => {
  const p = construit();
  const places = P.placesDeploiement(p, 'vert');
  const un = P.poserVilleDeploiement(p, 'vert', places[0]).plateau;
  // Une case admissible avant la première pose, mais à moins de 4 pas d'elle : refusée ensuite, erreur si on force.
  const proche = places.filter((k) => k !== places[0] && P.distancesPas(un, places[0])[k] < 4)[0];
  if (proche) {
    assert.match(P.poserVilleDeploiement(un, 'vert', proche).raison, /Trop près d’une autre ville : \d pas, il en faut 4/);
    const force = P.poserVilleDeploiement(un, 'vert', proche, { libre: true }).plateau;
    const e = erreurs(K.villes(force));
    assert.strictEqual(e.length, 1);
    assert.match(e[0].message, /Villes trop proches/);
    assert.deepStrictEqual(e[0].cases, H.trier([places[0], proche]));
    assert.strictEqual(erreurs(K.villes(force, { ecartVilles: 1 })).length, 0);
  }
  assert.strictEqual(P.placesDeploiement(un, 'vert').includes(places[0]), false);
  // Camps enregistrés faux.
  const r = complet();
  r.camps.rouge = [r.camps.rouge[0]];
  const e2 = erreurs(K.villes(r));
  assert.strictEqual(e2.length, 1);
  assert.match(e2[0].message, /enregistrées pour Rouge ne sont pas celles des tuiles posées/);
  // Constat d'un plateau complet.
  const bon = K.villes(complet());
  assert.deepStrictEqual(bon.map((x) => x.niveau), ['info']);
  assert.ok(bon[0].donnees.ecartMinimal >= 4);
  assert.strictEqual(bon[0].cases.length, 7);
  assert.match(bon[0].message, /7 villes ; écart minimal \d+ pas ; déploiement de Vert en .*, de Rouge en .* ; villes neutres en /);
});

test('équilibre sans symétrie : écarts vers le centre, les villes neutres et les villes de déploiement adverses', () => {
  const p = complet();
  const e = K.equilibre(p);
  assert.strictEqual(e.calculable, true);
  assert.strictEqual(e.comparable, true);
  assert.strictEqual(e.villes.length, 7);
  assert.deepStrictEqual(e.horsAtteinte, []);
  assert.deepStrictEqual(e.villes.map((v) => v.type).sort(), ['centre', 'neutre', 'neutre', 'rouge', 'rouge', 'vert', 'vert']);
  const dv = P.distancesRations(p, p.camps.vert), dr = P.distancesRations(p, p.camps.rouge);
  let score = 0;
  e.villes.forEach((v) => {
    assert.strictEqual(v.vert, dv[v.cle]);
    assert.strictEqual(v.rouge, dr[v.cle]);
    if (v.type === 'centre' || v.type === 'neutre') { assert.strictEqual(v.ecart, Math.abs(dv[v.cle] - dr[v.cle])); score += v.ecart; }
    else assert.strictEqual(v.ecart, null);
  });
  const tri = (t) => t.slice().sort((a, b) => a - b);
  assert.deepStrictEqual(e.adverses.vert, tri(p.camps.rouge.map((k) => dv[k])));
  assert.deepStrictEqual(e.adverses.rouge, tri(p.camps.vert.map((k) => dr[k])));
  assert.strictEqual(e.adverses.ecart, Math.abs(e.adverses.vert[0] - e.adverses.rouge[0]) + Math.abs(e.adverses.vert[1] - e.adverses.rouge[1]));
  assert.strictEqual(e.score, score + e.adverses.ecart);
  assert.strictEqual(e.villes.filter((v) => v.type === 'vert').every((v) => v.vert === 0), true);
});

test('équilibre : un marais devant un seul camp dégrade le score (calcul sur des cases écrites à la main)', () => {
  const colonne = (devantVert) => {
    const t = {};
    [['0,-2', 'ville'], ['0,-1', devantVert], ['0,0', 'ville'], ['0,1', 'plaine'], ['0,2', 'ville']].forEach(([k, terrain], i) => {
      t[k] = { terrain, piece: 'p' + i, origine: terrain, modele: 'P', evenement: null };
    });
    return t;
  };
  const camps = { vert: ['0,-2'], rouge: ['0,2'] };
  const egal = K.ecartsCamps(colonne('plaine'), camps);
  assert.strictEqual(egal.score, 0);
  assert.deepStrictEqual(egal.adverses, { vert: [4], rouge: [4], ecart: 0 });
  const penche = K.ecartsCamps(colonne('marais'), camps);
  // Centre : 3 pour Vert (marais 2 + ville 1), 2 pour Rouge : écart 1 ; d'un camp à l'autre : 5 dans les deux sens.
  assert.strictEqual(penche.score, 1);
  assert.deepStrictEqual(penche.villes.filter((v) => v.cle === '0,0')[0], { cle: '0,0', type: 'centre', vert: 3, rouge: 2, ecart: 1 });
  assert.deepStrictEqual(penche.adverses, { vert: [5], rouge: [5], ecart: 0 });
  assert.strictEqual(K.ecartsCamps(colonne('marais'), camps, { couts: { plaine: 1, ville: 1, marais: 4 } }).score, 3);
  // Sans villes de déploiement : rien n'est calculé, et ce n'est pas une alerte.
  const sans = K.ecartsCamps(colonne('plaine'), { vert: [], rouge: ['0,2'] });
  assert.strictEqual(sans.calculable, false);
  assert.strictEqual(sans.score, null);
  const constats = K.controleEquilibre(construit());
  assert.strictEqual(constats[0].niveau, 'info');
  assert.match(constats[0].message, /une fois les villes de déploiement des deux camps posées/);
  assert.strictEqual(alertes(constats).length, 0);
});

test('équilibre : message et répartition des terrains', () => {
  const complets = K.controleEquilibre(complet());
  assert.strictEqual(erreurs(complets).length, 0);
  assert.match(complets[0].message, /^Équilibre : score \d+ .*Écart vers le centre \d+, vers les villes neutres \d+, vers les villes de déploiement adverses \d+\./);
  // Terrain construit : 59 plaines (53 des monoblocs + 6 du noyau), 11 forêts, 11 marais.
  assert.deepStrictEqual(K.repartition(construit()), { total: 81, plaine: 59, foret: 11, marais: 11 });
  // Plateau fini : 4 Plaines portent une ville de déploiement.
  assert.deepStrictEqual(K.repartition(complet()), { total: 77, plaine: 55, foret: 11, marais: 11 });
  assert.ok(complets.some((x) => /plaines 71,4 %, forêts 14,3 %, marais 14,3 %/.test(x.message)));
});

test('événements : pose correcte, pose fautive venue d’un fichier, jamais sur une ville de déploiement, coupure', () => {
  assert.deepStrictEqual(K.evenements(complet()).map((x) => x.niveau), ['info']);

  const p = complet();
  const cases = P.cases(p);
  const foret = Object.keys(cases).filter((k) => cases[k].terrain === 'foret')[0];
  const bon = P.poserEvenement(p, 'E4', foret);
  assert.ok(bon.ok);
  if (!bon.alertes.length) assert.deepStrictEqual(K.evenements(bon.plateau).map((x) => x.niveau), ['info']);

  const fautif = complet();
  fautif.recouvrements = [{ evenement: 'E3', cle: foret }, { evenement: 'E2', cle: '0,0' }, { evenement: 'E9', cle: foret }, { evenement: 'E5', cle: p.camps.vert[0] }];
  const e = erreurs(K.evenements(fautif));
  assert.ok(e.some((x) => /« Tunnel » mal posé/.test(x.message) && x.cases[0] === foret));
  assert.ok(e.some((x) => /« Crevasse » mal posé/.test(x.message)));
  assert.ok(e.some((x) => /inconnu/.test(x.message)));
  assert.ok(e.some((x) => /« Inondation » mal posé : Un événement ne se pose jamais sur une ville de déploiement/.test(x.message)));
  assert.match(P.poserEvenement(p, 'E5', p.camps.vert[0]).raison, /jamais sur une ville de déploiement/);

  const ligne = monter([['P', 0, 0], ['P', 1, 0], ['V', 2, 0]]);
  const coupe = P.poserEvenement(ligne, 'E2', '1,0').plateau;
  const constats = K.evenements(coupe);
  assert.strictEqual(erreurs(constats).length, 0);
  assert.strictEqual(alertes(constats).length, 1);
  assert.match(alertes(constats)[0].message, /coupent le plateau/);
  // Les contrôles de construction ignorent les événements : la crevasse ne crée pas d'erreur de continuité.
  assert.strictEqual(erreurs(K.continuite(coupe)).length, 0);
});

test('ancien catalogue : un plateau enregistré en version 1 garde ses contrôles de villes et reste jouable', () => {
  const p = ancien();
  assert.strictEqual(p.version, 2, 'relu, le plateau est au format courant');
  const bilan = K.tout(p, { seuilContact: 2 });
  const e = K.etape(p);
  assert.strictEqual(e.ancien, true);
  assert.match(e.message, /tuiles de l’ancien catalogue/);
  // Ses villes d'une case sont jugées par l'ancienne règle (rangées extrêmes) : aucune erreur de villes.
  const villes = bilan.resultats.filter((x) => x.regle === 'villes');
  assert.strictEqual(erreurs(villes).length, 0, erreurs(villes).map((x) => x.message).join(' | '));
  assert.match(villes[0].message, /7 villes/);
  assert.deepStrictEqual(K.villes(p), K.villesAnciennes(p));
  assert.strictEqual(bilan.villes.erreurs, 0);
  // Ses tuiles d'une case sont annoncées « à prévoir en plus du catalogue » ; l'équilibre se calcule.
  assert.ok(alertes(bilan.resultats).some((x) => x.regle === 'inventaire' && /à prévoir en plus du catalogue/.test(x.message)));
  assert.strictEqual(bilan.equilibre.calculable, true);
  assert.strictEqual(p.camps.vert.length, 2);
  assert.deepStrictEqual(P.campsAuto(p), p.camps);
  // Ancien contrôle : une ville retirée de la rangée du haut est une erreur.
  const q = JSON.parse(JSON.stringify(p));
  q.pieces.filter((x) => x.modele === 'V' && H.cle(x.q, x.r) === q.camps.vert[0])[0].modele = 'P';
  assert.ok(erreurs(K.villes(q)).some((x) => /1 ville sur la rangée du haut/.test(x.message)));
});

test('tout : les options choisissent le seuil et la mesure de contact', () => {
  const p = monter([['F3', 0, 0], ['P', 1, 1]]);
  const contact = (options) => K.tout(p, options).resultats.filter((x) => x.regle === 'contact' && x.niveau === 'erreur').length;
  assert.strictEqual(contact({ seuilContact: 1, mesureContact: 'cotes' }), 0);
  assert.strictEqual(contact({ seuilContact: 2, mesureContact: 'cotes' }), 1);
  assert.strictEqual(contact({ seuilContact: 2, mesureContact: 'pieces' }), 1);
  assert.strictEqual(contact(), 1);
});
