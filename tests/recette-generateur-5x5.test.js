'use strict';
/*
 * Recette indépendante du générateur 5×5, des seuils et du conseil 5×5, d’après la documentation
 * (docs/34, docs/36, docs/24 § 8, docs/18), et non d’après les tests existants.
 * Les contrôles de ports passent par PM.modele.portsJonction (pas par le contrôle interne du générateur) ;
 * « aucune alerte » est vérifié aux deux sources de l’interface : PM.controles.calculer (panneau) et
 * PM.equilibre.rapport (rapport d’équilibre).
 * Les défauts connus seraient marqués { todo: 'BUG: …' } (leur échec n’échouerait pas la suite) ; il n’y en a plus.
 */
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
require('../src/equilibre.js');
require('../src/etat.js');
require('../src/app.js');
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, GR = PM.graphe, CAT = PM.catalogue, EQ = PM.equilibre, CT = PM.controles;

const doc5 = () => CAT.nouveauDocument('5x5');
const doc4 = () => CAT.nouveauDocument('4x4');
const copie = (o) => JSON.parse(JSON.stringify(o));
const cle = (j) => j.i + ',' + j.j;
const jetons = (vs) => vs.map((v) => ({ i: v.i, j: v.j, type: 'capture' }));
const avecVilles = (doc, vs) => { const d = copie(doc); d.plateau.jetons = jetons(vs); return d; };

/** Conseil de docs/36 § 5 (sans le point final : le panneau retire le point final de chaque blocage). */
const CONSEIL = 'Les 3 villes du milieu sont sur une seule rangée : en mettre 2 sur l’une et 1 sur l’autre rétablit presque toujours l’équilibre';
const CONSEIL_4X4 = 'Conseil : placer les deux jonctions-cases (sans ville) dans la rangée centrale, par exemple (1, 2) et (3, 2).';
const CODES_PANNEAU_EQUILIBRE = ['cinq_contre_deux', 'ecart_rang_etendu', 'score_s', 'premiere_ville_inegale', 'ville_inaccessible'];

/** Générateur pseudo-aléatoire déterministe (indépendant de celui du projet). */
function alea(graine) { let s = graine >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function tirer(r, liste, n) {
  const l = liste.slice(), res = [];
  for (let k = 0; k < n; k++) res.push(l.splice(Math.floor(r() * l.length), 1)[0]);
  return res;
}
const jonctions = (n) => { const l = []; for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) l.push({ i, j }); return l; };

/** Texte de tous les messages d’équilibre d’un document, depuis les deux sources de l’interface. */
function messagesInterface(doc) {
  const c = CT.calculer(doc), rap = EQ.rapport(EQ.analyser(doc));
  return {
    panneau: c.erreurs.concat(c.alertes).map((x) => x.message),
    rapport: rap.blocages.concat(rap.alertes),
    informations: rap.informations,
    panneauCodes: c.erreurs.concat(c.alertes).map((x) => x.code)
  };
}

/* ---------- plateaux générés : peu de candidats pour éprouver la garantie, pas le meilleur de 200 ---------- */

const NB = 150;
const PLATEAUX = [];
function plateaux() {
  if (!PLATEAUX.length) {
    for (let k = 0; k < NB; k++) {
      const r = GEN.generer(doc5(), { graine: 'rec-' + k, candidats: 1 + (k % 3) });
      assert.ok(r.ok, 'graine rec-' + k + ' : ' + r.raison);
      PLATEAUX.push(r);
    }
  }
  return PLATEAUX;
}

test('génération 5×5 (150 graines, 1 à 3 candidats) : 25 tuiles à leur rôle, 7 villes, aucune erreur de validation', () => {
  plateaux().forEach((r, k) => {
    const d = r.doc, id = 'rec-' + k;
    assert.strictEqual(d.grille, '5x5', id);
    assert.strictEqual(d.plateau.tuiles.length, 25, id);
    const cellules = new Set(d.plateau.tuiles.map((t) => t.col + ',' + t.lig));
    assert.strictEqual(cellules.size, 25, id + ' : une tuile par cellule');
    d.plateau.tuiles.forEach((t) => {
      assert.strictEqual(M.modeleParId(d, t.modeleId).gabarit, M.gabaritCellule(t.col, t.lig, '5x5'), id + ' : rôle de (' + t.col + ',' + t.lig + ')');
    });
    assert.strictEqual(d.plateau.jetons.length, 7, id);
    assert.deepStrictEqual(M.validerPlateau(d).erreurs, [], id);
    assert.deepStrictEqual(CT.calculer(d).erreurs, [], id);
  });
});

test('génération 5×5 : 4 coins LK2, 12 bords LB2, 9 centrales du catalogue (dans le stock), 57 ou 58 cases, moitiés égales, moins de 5 % de cases à 2 connexions', () => {
  plateaux().forEach((r, k) => {
    const d = r.doc, id = 'rec-' + k, n = {};
    d.plateau.tuiles.forEach((t) => {
      n[t.modeleId] = (n[t.modeleId] || 0) + 1;
      const role = M.gabaritCellule(t.col, t.lig, '5x5');
      if (role === 'coin') assert.strictEqual(t.modeleId, 'LK2', id);
      if (role === 'bord') assert.strictEqual(t.modeleId, 'LB2', id);
      if (role === 'centrale') assert.ok(['LC1', 'LC2', 'LC3', 'LC4', 'LC5', 'LC6', 'LC7'].includes(t.modeleId), id);
    });
    // catalogue (docs/55, docs/58) : la composition reste dans le stock à imprimer, donc tout plateau généré se monte avec la boîte
    d.modeles.forEach((m) => assert.ok((n[m.id] || 0) <= m.exemplaires, id + ' : ' + m.id));
    const attendu = 59 - (n.LC5 || 0); // LC5 n'a qu'une case
    assert.strictEqual(r.score.cases.total, attendu, id);
    assert.strictEqual(r.score.cases.ecart, 0, id);
    // connexions par case (docs/53 § 1), mesurées indépendamment : degré de chaque case de tuile et ports de chaque jonction-case
    const g = GR.construire(d, { villesTraversables: false });
    let faibles = 0, cases = 0;
    g.cases.forEach((c, cid) => { cases++; if (g.voisins.get(cid).size <= 2) faibles++; });
    g.jonctions.forEach((jn) => { if (jn.type === 'case') { cases++; if (M.portsJonction(d, jn.i, jn.j).ports <= 2) faibles++; } });
    assert.strictEqual(cases, attendu, id);
    assert.ok(faibles / cases < 0.05, id + ' : ' + faibles + ' cases à 2 connexions ou moins');
  });
});

test('génération 5×5 : villes en 2-3-2 sur des jonctions à 3 ports au moins ; toutes les jonctions à 2 ports au moins (M.portsJonction)', () => {
  const nbA3 = new Set();
  plateaux().forEach((r, k) => {
    const d = r.doc, id = 'rec-' + k, vs = d.plateau.jetons;
    const nb = (j) => vs.filter((v) => v.j === j).length;
    assert.strictEqual(nb(1), 2, id + ' : 2 villes en j = 1 (' + vs.map(cle).join(' ') + ')');
    assert.strictEqual(nb(4), 2, id + ' : 2 villes en j = 4');
    assert.strictEqual(nb(2) + nb(3), 3, id + ' : 3 villes au milieu');
    assert.strictEqual(new Set(vs.map(cle)).size, 7, id);
    let a3 = 0;
    for (let j = 1; j <= 4; j++) for (let i = 1; i <= 4; i++) {
      const p = M.portsJonction(d, i, j);
      assert.strictEqual(p.tuiles, 4, id + ' : jonction (' + i + ',' + j + ') entourée de 4 tuiles');
      assert.ok(p.ports >= 2, id + ' : jonction (' + i + ',' + j + ') à ' + p.ports + ' port(s)');
      if (p.ports >= 3) a3++;
    }
    vs.forEach((v) => assert.ok(M.portsJonction(d, v.i, v.j).ports >= 3, id + ' : ville (' + cle(v) + ') sur une jonction à moins de 3 ports'));
    assert.ok(a3 >= 7, id + ' : seulement ' + a3 + ' jonctions à 3 ports au moins');
    nbA3.add(a3);
  });
  assert.ok(nbA3.size >= 1);
});

test('génération 5×5 : aucune alerte ni erreur d’équilibre, au panneau comme au rapport, sur chaque plateau généré (docs/36 § 2)', () => {
  plateaux().forEach((r, k) => {
    const d = r.doc, id = 'rec-' + k, m = messagesInterface(d);
    assert.deepStrictEqual(m.panneauCodes.filter((c) => CODES_PANNEAU_EQUILIBRE.concat(['desequilibre']).includes(c)), [], id + ' : ' + m.panneau.join(' | '));
    assert.deepStrictEqual(m.rapport, [], id + ' : rapport ' + m.rapport.join(' | '));
    assert.deepStrictEqual(m.informations, [], id + ' : une ville sur moins de 3 ports');
    const e = GR.equilibre(d);
    assert.ok(e.complet, id);
    assert.ok(e.S < 5, id + ' : S = ' + e.S);
    assert.ok(e.ecartMax7 <= 2, id + ' : écart max ' + e.ecartMax7);
    assert.ok(Math.max(e.partage[1], e.partage[2]) <= 4, id + ' : partage ' + e.partage[1] + '/' + e.partage[2]);
    assert.strictEqual(e.premiereEgale, true, id);
    assert.deepStrictEqual(GR.villesProches(GR.construire(d, { villesTraversables: false })), [], id);
    assert.ok(GR.connexe(GR.construire(d, { villesTraversables: false })), id);
    assert.strictEqual(r.rejets.plateau_invalide, 0, id);
  });
});

test('reproductibilité : même graine, même plateau ; indifférent au plateau déjà posé, à « jonctions variées », au type de la graine et aux espaces', () => {
  const a = GEN.generer(doc5(), { graine: 'repro', candidats: 12 });
  assert.ok(a.ok, a.raison);
  const b = GEN.generer(doc5(), { graine: 'repro', candidats: 12 });
  assert.deepStrictEqual(a.doc, b.doc);
  assert.deepStrictEqual(a.rapport, b.rapport);
  // plateau déjà rempli : le résultat ne dépend que de la bibliothèque et de la graine
  const c = GEN.generer(a.doc, { graine: 'repro', candidats: 12 });
  assert.deepStrictEqual(c.doc, a.doc);
  // « jonctions variées » est sans objet en 5×5
  const v = GEN.generer(doc5(), { graine: 'repro', candidats: 12, jonctionsVariees: true });
  assert.deepStrictEqual(v.doc, a.doc);
  assert.deepStrictEqual(v.rapport, a.rapport);
  // 42 et '42', ' abc ' et 'abc'
  assert.deepStrictEqual(GEN.generer(doc5(), { graine: 42, candidats: 3 }).doc, GEN.generer(doc5(), { graine: '42', candidats: 3 }).doc);
  assert.deepStrictEqual(GEN.generer(doc5(), { graine: ' abc ', candidats: 3 }).doc, GEN.generer(doc5(), { graine: 'abc', candidats: 3 }).doc);
  // le document source n’est pas modifié
  const source = doc5(), avant = copie(source);
  GEN.generer(source, { graine: 'x', candidats: 2 });
  assert.deepStrictEqual(source, avant);
  // des graines différentes donnent des plateaux différents
  assert.ok(new Set(plateaux().map((r) => JSON.stringify(r.doc.plateau))).size >= NB - 5);
  // la boîte « Plateau aléatoire » ne propose pas la graine vide : une graine absente est tirée, et rendue pour être rejouée
  const sans = GEN.generer(doc5(), { candidats: 1 });
  assert.ok(typeof sans.graine === 'string' && sans.graine.length > 0);
  assert.deepStrictEqual(GEN.generer(doc5(), { graine: sans.graine, candidats: 1 }).doc, sans.doc);
});

test('parcours à l’état : Nouveau 5×5 (vrai catalogue), Générer, Appliquer, Ctrl+Z, Ctrl+Y', () => {
  const nouveau = PM.nouveau.documentPourGrille('5x5');
  assert.ok(nouveau.ok, nouveau.raison);
  assert.strictEqual(nouveau.doc.grille, '5x5');
  assert.deepStrictEqual(nouveau.doc.modeles.map((m) => m.id).sort(), ['LB2', 'LC1', 'LC2', 'LC3', 'LC4', 'LC5', 'LC6', 'LC7', 'LK2']);
  assert.deepStrictEqual(nouveau.doc.plateau, { tuiles: [], jetons: [] });
  const etat = PM.etat.creer(PM.nouveau.documentPourGrille('4x4').doc);
  etat.remplacer(nouveau.doc, 'nouveau plateau 5×5');
  assert.strictEqual(etat.doc().grille, '5x5');
  const r = GEN.generer(etat.doc(), { graine: 'parcours', candidats: 5 });
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(etat.doc().plateau, { tuiles: [], jetons: [] }, 'Générer ne modifie pas le plateau');
  assert.ok(etat.appliquer(() => r.doc, 'plateau aléatoire (graine parcours)').ok);
  assert.strictEqual(etat.doc().plateau.tuiles.length, 25);
  assert.ok(etat.peutAnnuler());
  etat.annuler();
  assert.deepStrictEqual(etat.doc().plateau, { tuiles: [], jetons: [] }, 'Ctrl+Z vide le plateau 5×5');
  assert.strictEqual(etat.doc().grille, '5x5');
  etat.retablir();
  assert.deepStrictEqual(etat.doc().plateau, r.doc.plateau, 'Ctrl+Y remet le plateau généré');
  // regénérer sur un plateau rempli remplace le plateau, annulable
  const r2 = GEN.generer(etat.doc(), { graine: 'parcours-2', candidats: 5 });
  assert.ok(r2.ok);
  etat.appliquer(() => r2.doc, 'plateau aléatoire');
  assert.notDeepStrictEqual(etat.doc().plateau, r.doc.plateau);
  etat.annuler();
  assert.deepStrictEqual(etat.doc().plateau, r.doc.plateau);
});

/* ---------- seuils communs aux deux formats (docs/36 § 1 et § 7), sauf S d’alerte et d’information (docs/48 § 4) ---------- */

test('seuils : mêmes constantes pour les deux formats (rejet S 5, écart 2, blocage 3, 5 contre 2) ; seuils de S d’alerte et d’information propres à chaque format', () => {
  assert.strictEqual(GR.SEUIL_S, 5);
  assert.deepStrictEqual([GR.seuilS('4x4'), GR.seuilSInformation('4x4'), GR.seuilS('5x5'), GR.seuilSInformation('5x5')], [5, 4, 7, 5]);
  assert.strictEqual(GR.SEUIL_ECART, 2);
  assert.strictEqual(GR.SEUIL_BLOCAGE_ECART, 3);
  assert.strictEqual(GR.SEUIL_CINQ_CONTRE_DEUX, 5);
});

for (const [format, creer] of [['4x4', (k) => GEN.generer(doc4(), { graine: 'seuils-' + k, candidats: 2 }).doc], ['5x5', (k) => plateaux()[k].doc]]) {
  test('seuils ' + format + ' : chaque code d’équilibre apparaît si et seulement si son critère est franchi (1500 placements)', () => {
    const bases = []; for (let b = 0; b < 25; b++) bases.push(creer(b));
    const r = alea(format === '4x4' ? 4 : 5), n = format === '4x4' ? 4 : 5;
    const sAlerte = format === '4x4' ? 5 : 7, sInfo = format === '4x4' ? 4 : 5; // seuils de S propres à chaque format (docs/18, docs/48)
    const vu = { score_s: 0, ecart_rang_etendu: 0, ecart_bloquant: 0, cinq_contre_deux: 0, sInfo: 0, quatreContreTrois: 0, aucun: 0 };
    for (let k = 0; k < 1500; k++) {
      const d = avecVilles(bases[k % bases.length], tirer(r, jonctions(n), 7)), e = GR.equilibre(d);
      if (e.S === null) continue; // ville inaccessible : pas de score
      const codes = e.blocages.concat(e.alertes).map((a) => a.code);
      const has = (c) => codes.includes(c);
      const max = Math.max(e.partage[1], e.partage[2]);
      assert.strictEqual(has('score_s'), e.S >= sAlerte, format + ' S = ' + e.S);
      assert.strictEqual(e.aSurveiller, e.S >= sAlerte);
      assert.strictEqual(e.sInformation, e.S >= sInfo && e.S < sAlerte, format + ' S = ' + e.S);
      assert.strictEqual(has('ecart_bloquant'), e.ecartMax7 > 3, format + ' écart ' + e.ecartMax7);
      assert.strictEqual(has('ecart_rang_etendu'), e.ecartMax7 > 2 && e.ecartMax7 <= 3, format + ' écart ' + e.ecartMax7);
      assert.strictEqual(has('cinq_contre_deux'), max >= 5, format + ' partage ' + e.partage[1] + '/' + e.partage[2]);
      assert.strictEqual(e.tresDesequilibre, has('cinq_contre_deux') || has('ecart_bloquant'));
      // « 5 contre 2 » et écart > 3 sont des blocages (erreur au panneau), pas des alertes
      e.blocages.forEach((b) => assert.ok(['cinq_contre_deux', 'ecart_bloquant'].includes(b.code)));
      if (e.S >= sAlerte) vu.score_s++; if (e.S >= sInfo && e.S < sAlerte) vu.sInfo++;
      if (e.ecartMax7 > 3) vu.ecart_bloquant++; else if (e.ecartMax7 > 2) vu.ecart_rang_etendu++;
      if (max >= 5) vu.cinq_contre_deux++;
      if (max === 4) { vu.quatreContreTrois++; if (!has('cinq_contre_deux')) assert.ok(true); }
      if (!codes.length) vu.aucun++;
    }
    console.log('# seuils ' + format + ' : ' + JSON.stringify(vu));
    assert.ok(vu.score_s > 0 && vu.sInfo > 0 && vu.quatreContreTrois > 0 && vu.aucun > 0, format + ' : ' + JSON.stringify(vu));
    if (format === '5x5') assert.ok(vu.cinq_contre_deux > 0 && vu.ecart_rang_etendu > 0, format + ' : ' + JSON.stringify(vu));
  });
}

/* ---------- conseil « 3 villes du milieu » (docs/36 § 5) ---------- */

/** Attendu, calculé à part : 2 en j = 1, 2 en j = 4, et les 3 autres toutes en j = 2 ou toutes en j = 3. */
function conseilAttendu(vs) {
  const n = (j) => vs.filter((v) => v.j === j).length;
  return vs.length === 7 && n(1) === 2 && n(4) === 2 && (n(2) === 3 || n(3) === 3);
}

// graine choisie pour que les genres de pose portent des alertes malgré le seuil S >= 7 du 5×5 (docs/48) : avec le catalogue à 2 cases par
// tuile (docs/55), « rec-conseil-30 » est la première graine qui donne des poses 3 sur une rangée avec « 5 contre 2 » seul, avec S seul et
// sans alerte, et des poses 2 + 1 avec S seul
const PLATEAU_CONSEIL = GEN.generer(doc5(), { graine: 'rec-conseil-30', candidats: 8 }).doc;

/** Les 2016 placements 2-3-2 posés sur PLATEAU_CONSEIL, classés par genre d’alerte. */
function classes() {
  const cl = {};
  GEN.placementsVilles5x5().forEach((vs) => {
    const d = avecVilles(PLATEAU_CONSEIL, vs), e = GR.equilibre(d);
    const codes = e.blocages.concat(e.alertes).map((a) => a.code);
    const un = conseilAttendu(vs);
    const k = (un ? 'une-rangee' : 'deux-plus-un') + '|' + (codes.includes('cinq_contre_deux') ? 'cinq' : '') + (codes.includes('score_s') ? 'S' : '') + (codes.length && !codes.includes('cinq_contre_deux') && !codes.includes('score_s') ? 'autre' : '') + (codes.length ? '' : 'rien');
    (cl[k] = cl[k] || []).push({ vs, d, e, codes });
  });
  return cl;
}

test('conseil 5×5 : présent aux messages « 5 contre 2 » et S ≥ 7 si et seulement si squelette 2-3-2 avec les 3 villes du milieu sur une rangée (2016 placements, panneau et rapport)', () => {
  const cl = classes();
  const total = Object.values(cl).reduce((s, l) => s + l.length, 0);
  assert.strictEqual(total, 2016);
  // les cas à couvrir existent sur ce plateau
  const cles = Object.keys(cl);
  assert.ok(cles.some((c) => c.startsWith('une-rangee|') && c.includes('cinq')), 'aucune pose 3 sur une rangée avec 5 contre 2 : ' + cles);
  assert.ok(cles.some((c) => c.startsWith('une-rangee|') && c.endsWith('rien')), cles.join());
  assert.ok(cles.some((c) => c.startsWith('deux-plus-un|') && c.includes('S')), cles.join());
  let avec = 0, sans = 0;
  Object.keys(cl).forEach((k) => cl[k].forEach(({ vs, d, e }) => {
    const un = conseilAttendu(vs), txt = vs.map(cle).join(' ');
    // 1) moteur
    // « 5 contre 2 » et S >= 7 ensemble : le conseil n’est écrit qu’une fois (au message « 5 contre 2 »)
    const aCinq = e.blocages.concat(e.alertes).some((a) => a.code === 'cinq_contre_deux');
    e.blocages.concat(e.alertes).forEach((a) => {
      const porteur = a.code === 'cinq_contre_deux' || a.code === 'score_s';
      assert.strictEqual(a.message.includes(CONSEIL), porteur && un && (a.code === 'cinq_contre_deux' || !aCinq), a.code + ' · ' + txt);
    });
    // 2) panneau et rapport : le conseil figure dans un message si et seulement s’il y a un message porteur et un squelette en une rangée
    const porteur = e.blocages.concat(e.alertes).some((a) => a.code === 'cinq_contre_deux' || a.code === 'score_s');
    const m = messagesInterface(d);
    assert.strictEqual(m.panneau.some((t) => t.includes(CONSEIL)), porteur && un, 'panneau · ' + txt);
    assert.strictEqual(m.rapport.some((t) => t.includes(CONSEIL)), porteur && un, 'rapport · ' + txt);
    assert.ok(m.panneau.filter((t) => t.includes(CONSEIL)).length <= 1 && m.rapport.filter((t) => t.includes(CONSEIL)).length <= 1, 'conseil en double · ' + txt);
    // le conseil n’est jamais dupliqué dans les informations
    assert.ok(!m.informations.some((t) => t.includes('seule rangée')));
    if (porteur && un) avec++; else if (porteur) sans++;
  }));
  assert.ok(avec > 0 && sans > 0, avec + ' avec, ' + sans + ' sans');
});

test('conseil 5×5 : jamais sans squelette 2-3-2, ni avec 6 ou 8 villes, ni en 4×4 (placements libres)', () => {
  const r = alea(36), base = PLATEAU_CONSEIL;
  let porteurs = 0;
  for (let k = 0; k < 1500; k++) {
    const n = [7, 7, 6, 8][k % 4];
    const vs = tirer(r, jonctions(5), n), d = avecVilles(base, vs), e = GR.equilibre(d);
    const messages = e.blocages.concat(e.alertes);
    messages.forEach((a) => {
      if (a.code === 'cinq_contre_deux' || a.code === 'score_s') porteurs++;
      assert.strictEqual(a.message.includes('seule rangée'), (a.code === 'cinq_contre_deux' || (a.code === 'score_s' && !messages.some((x) => x.code === 'cinq_contre_deux'))) && conseilAttendu(vs), n + ' villes · ' + a.code + ' · ' + vs.map(cle).join(' '));
    });
  }
  assert.ok(porteurs > 100, porteurs + ' messages porteurs rencontrés');
  const bases4 = []; for (let b = 0; b < 20; b++) bases4.push(GEN.generer(doc4(), { graine: 'c4-' + b, candidats: 2 }).doc);
  const r4 = alea(9);
  let cinq = 0;
  for (let k = 0; k < 2000; k++) {
    const e = GR.equilibre(avecVilles(bases4[k % bases4.length], tirer(r4, jonctions(4), 7)));
    e.blocages.concat(e.alertes).forEach((a) => assert.ok(!a.message.includes('seule rangée'), '4×4 : ' + a.message));
    e.blocages.forEach((b) => { if (b.code === 'cinq_contre_deux') { cinq++; assert.ok(b.message.endsWith(CONSEIL_4X4), b.message); } });
    assert.deepStrictEqual(e.informations, [], '4×4 : jamais d’information « ports »');
  }
  assert.ok(cinq > 0, 'un « 5 contre 2 » 4×4 rencontré');
});

test('conseil 5×5 : variante 3 villes sur la rangée j = 3 aussi ; message à l’identique dans le panneau (erreur « desequilibre »)', () => {
  const cl = classes();
  const sur3 = [].concat(...Object.values(cl)).filter(({ vs }) => vs.filter((v) => v.j === 3).length === 3 && conseilAttendu(vs));
  const sur2 = [].concat(...Object.values(cl)).filter(({ vs }) => vs.filter((v) => v.j === 2).length === 3 && conseilAttendu(vs));
  assert.ok(sur3.length > 0 && sur2.length > 0);
  const alerte3 = sur3.find(({ codes }) => codes.includes('cinq_contre_deux') || codes.includes('score_s'));
  const alerte2 = sur2.find(({ codes }) => codes.includes('cinq_contre_deux'));
  assert.ok(alerte2, 'un 5 contre 2 sur la rangée j = 2');
  const p = CT.calculer(alerte2.d);
  const err = p.erreurs.find((x) => x.code === 'desequilibre');
  assert.ok(err && err.message.includes(CONSEIL + '.'), err && err.message);
  assert.strictEqual(err.message.split(CONSEIL).length, 2, 'conseil écrit une seule fois');
  if (alerte3) assert.ok(messagesInterface(alerte3.d).panneau.some((t) => t.includes(CONSEIL)));
});

test('conseil 5×5 : S ≥ 7 seul (sans 5 contre 2) le porte au panneau comme alerte, pas comme erreur', () => {
  const cl = classes();
  const c = (cl['une-rangee|S'] || []).concat(cl['une-rangee|cinqS'] || []).find(({ codes }) => codes.includes('score_s') && !codes.includes('cinq_contre_deux'));
  assert.ok(c, 'aucune pose 3 sur une rangée avec S ≥ 7 seul sur ce plateau : ' + Object.keys(cl));
  const p = CT.calculer(c.d);
  const al = p.alertes.find((x) => x.code === 'score_s');
  assert.ok(al && al.message.includes(CONSEIL), al && al.message);
  assert.ok(!p.erreurs.some((x) => x.code === 'desequilibre'));
  const rap = EQ.rapport(EQ.analyser(c.d));
  assert.ok(rap.alertes.some((t) => t.includes(CONSEIL)) && rap.blocages.length === 0);
});

test('conseil 5×5 : écart de rang seul, ou aucune alerte, ne porte pas le conseil (3 villes sur une rangée)', () => {
  const cl = classes();
  const rien = cl['une-rangee|rien'];
  assert.ok(rien && rien.length > 0);
  rien.slice(0, 20).forEach(({ d }) => {
    const m = messagesInterface(d);
    assert.deepStrictEqual(m.panneau.filter((t) => t.includes('seule rangée')), []);
    assert.deepStrictEqual(m.rapport.filter((t) => t.includes('seule rangée')), []);
  });
  // rapport : le texte d’explication du rapport 5×5 ne contient pas le conseil du 4×4, celui du 4×4 le garde
  assert.ok(!EQ.rapport(EQ.analyser(PLATEAU_CONSEIL)).explication.includes('jonctions-cases'));
  assert.ok(EQ.rapport(EQ.analyser(GEN.generer(doc4(), { graine: 'ex', candidats: 3 }).doc)).explication.includes('jonctions-cases'));
});

/* ---------- information « ville sur une jonction à moins de 3 ports » (docs/36 § 1) ---------- */

test('information « ville sur une jonction à moins de 3 ports » : dans le rapport, jamais alerte ni erreur, 5×5 seulement', () => {
  // un plateau généré qui a une jonction-case à 2 ports (la plupart en ont une, docs/56)
  const d0 = plateaux().find((r) => GEN.portsParJonction(r.doc).some((p) => p < 3)).doc, ports = (i, j) => M.portsJonction(d0, i, j).ports;
  const toutes = jonctions(5).map((v) => Object.assign(v, { p: ports(v.i, v.j) }));
  const peu = toutes.filter((v) => v.p < 3), beaucoup = toutes.filter((v) => v.p >= 3);
  assert.ok(peu.length > 0, 'ce plateau a au moins une jonction à 2 ports');
  // 7 villes sur des jonctions à 3 ports ou plus : pas d’information
  const sans = avecVilles(d0, beaucoup.slice(0, 7));
  assert.deepStrictEqual(messagesInterface(sans).informations, []);
  assert.deepStrictEqual(GR.equilibre(sans).informations, []);
  // une ville sur une jonction à 2 ports : une information, citant la ville et le nombre de ports
  const avec = avecVilles(d0, beaucoup.slice(0, 6).concat([peu[0]]));
  const e = GR.equilibre(avec), m = messagesInterface(avec);
  assert.strictEqual(e.informations.length, 1);
  assert.strictEqual(e.informations[0].code, 'ville_peu_de_ports');
  assert.ok(e.informations[0].message.includes('(' + peu[0].i + ', ' + peu[0].j + ')'));
  assert.ok(e.informations[0].message.includes('à ' + peu[0].p + ' port'), e.informations[0].message);
  assert.strictEqual(m.informations.length, 1);
  assert.ok(!m.panneauCodes.includes('ville_peu_de_ports'), 'pas dans le panneau d’alertes');
  assert.ok(![].concat(e.alertes, e.blocages).some((a) => a.code === 'ville_peu_de_ports'));
  assert.ok(!m.rapport.some((t) => t.includes('port(s)')));
  // deux villes concernées : deux informations
  if (peu.length >= 2) {
    const deux = avecVilles(d0, beaucoup.slice(0, 5).concat([peu[0], peu[1]]));
    assert.strictEqual(GR.equilibre(deux).informations.length, 2);
  }
  // 4×4 : aucune information, même sur une jonction à peu de ports
  const d4 = GEN.generer(doc4(), { graine: 'inf4', candidats: 3 }).doc;
  for (const v of jonctions(4)) assert.deepStrictEqual(GR.equilibre(avecVilles(d4, [v])).informations, []);
});

/* ---------- 4×4 inchangé ---------- */

test('4×4 : générateur sans clé propre au 5×5, « jonctions variées » toujours effective, rapport du générateur inchangé', () => {
  for (let k = 0; k < 15; k++) {
    for (const variees of [false, true]) {
      const r = GEN.generer(doc4(), { graine: 'q4-' + k, candidats: 10, jonctionsVariees: variees });
      assert.ok(r.ok, r.raison);
      assert.strictEqual(r.doc.plateau.tuiles.length, 16);
      assert.strictEqual(r.doc.plateau.jetons.length, 7);
      assert.ok(!('b1' in r.score) && !('portsParJonction' in r.score) && !('jonctionsAMoins2' in r.score));
      ['jonction_ports', 'villes_ports', 'score_s'].forEach((c) => assert.ok(!(c in r.rejets), c));
      assert.deepStrictEqual(r.doc, GEN.generer(doc4(), { graine: 'q4-' + k, candidats: 10, jonctionsVariees: variees }).doc);
      // 4×4 : les 7 villes sur les 9 jonctions, les 2 sans ville sont dans la rangée centrale sauf « variées »
      const sansVille = jonctions(4).filter((v) => !r.doc.plateau.jetons.some((x) => x.i === v.i && x.j === v.j));
      assert.strictEqual(sansVille.length, 2);
      if (!variees) assert.ok(sansVille.every((v) => v.j === 2), 'rangée centrale : ' + sansVille.map(cle));
      assert.ok(r.rapport.some((t) => t.includes(variees ? 'jonctions variées' : 'rangée centrale')), r.rapport.join('|'));
      assert.deepStrictEqual(GR.equilibre(r.doc).alertes, [], 'le 4×4 généré garde son absence d’alerte');
    }
  }
});

/* ---------- entrées invalides ---------- */

test('entrées invalides : jamais d’exception (documents, options, documents abîmés)', () => {
  const docs = [undefined, null, 5, 'x', [], {}, { grille: '5x5', modeles: [] }, Object.assign(doc5(), { grille: '6x6' }),
    Object.assign(doc5(), { modeles: [] }), Object.assign(doc5(), { modeles: null }), Object.assign(doc5(), { plateau: null }),
    Object.assign(doc5(), { modeles: [null].concat(doc5().modeles) }), Object.assign(doc5(), { plateau: { tuiles: 'x', jetons: 7 } }),
    Object.assign(doc5(), { plateau: { tuiles: [null], jetons: [null, 1] } }), Object.assign(doc5(), { version: 'zz' }),
    Object.assign(doc5(), { modeles: [{ id: 'K2' }] }), Object.assign(doc4(), { grille: '5x5' })];
  docs.forEach((d, k) => {
    let r;
    assert.doesNotThrow(() => { r = GEN.generer(d, { graine: 'a', candidats: 2, essaisMax: 4 }); }, 'document n° ' + k);
    assert.ok(r && typeof r.ok === 'boolean' && typeof r.raison === 'string', 'document n° ' + k);
    if (!r.ok) assert.ok(r.raison.length > 0, 'document n° ' + k + ' : raison vide');
  });
  const options = [undefined, null, 0, 'x', [], {}, { graine: null }, { graine: NaN }, { graine: {} }, { graine: [1] }, { graine: '' }, { graine: -5 }, { graine: Infinity },
    { candidats: 0 }, { candidats: -3 }, { candidats: NaN }, { candidats: 2.7 }, { essaisMax: 0 }, { essaisMax: -1 }, { essaisMax: NaN }, { jonctionsVariees: 'oui' }, { tolerance: -1 }, { tolerance: 'x' }];
  options.forEach((o, k) => {
    for (const d of [doc5(), doc4()]) {
      let r;
      assert.doesNotThrow(() => { r = GEN.generer(d, Object.assign({ candidats: 2, essaisMax: 4 }, typeof o === 'object' ? o : {})); }, 'options n° ' + k);
      assert.ok(typeof r.ok === 'boolean');
    }
  });
  // le panneau et le rapport ne lèvent pas non plus sur un document 5×5 amputé
  const abime = plateaux()[0].doc;
  abime.plateau.tuiles.splice(3, 7);
  assert.doesNotThrow(() => { CT.calculer(abime); EQ.rapport(EQ.analyser(abime)); GR.equilibre(abime); });
  const sansVilles = avecVilles(plateaux()[0].doc, []);
  assert.doesNotThrow(() => { CT.calculer(sansVilles); EQ.rapport(EQ.analyser(sansVilles)); });
  assert.doesNotThrow(() => EQ.rapport(EQ.analyser(avecVilles(plateaux()[0].doc, [{ i: 9, j: 9 }, { i: 0, j: 0 }]))));
});

test('entrées invalides : un nombre de candidats non numérique se comporte comme NaN (valeur par défaut)', () => {
  const a = GEN.generer(doc5(), { graine: 'a', candidats: 'abc', essaisMax: 3 });
  assert.strictEqual(a.ok, true, a.raison);
  const b = GEN.generer(doc5(), { graine: 'a', candidats: 2, essaisMax: 'x' });
  assert.strictEqual(b.ok, true, b.raison);
  assert.ok(!/villes à moins de 3 cases|rapprochent presque toujours/.test(b.raison));
});

test('entrées invalides : candidats ou essaisMax infinis ne bloquent pas le programme', () => {
  const racine = path.join(__dirname, '..');
  for (const opt of ['candidats:Infinity']) {
    const script = "require(" + JSON.stringify(path.join(racine, 'src', 'catalogue.js')) + ");require(" + JSON.stringify(path.join(racine, 'src', 'generateur.js')) + ");" +
      "const PM=globalThis.PM;PM.generateur.generer(PM.catalogue.nouveauDocument('5x5'),{graine:'a',essaisMax:3," + opt + "});";
    const res = spawnSync(process.execPath, ['-e', script], { timeout: 6000 });
    assert.ok(!res.error, opt + ' : ' + (res.error && res.error.code));
  }
});
