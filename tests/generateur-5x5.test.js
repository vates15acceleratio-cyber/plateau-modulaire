'use strict';
/*
 * Tests du générateur 5×5 (src/generateur.js), règles de docs/18 (« Décisions de l'utilisateur pour le catalogue 5×5 »),
 * docs/24 § 8, docs/28 et docs/29 : centrales et bords orientés, 5 ou 6 B1 (de préférence sur la rangée neutre), villes en 2-3-2
 * sur des jonctions à 3 ports au moins, toute jonction à 2 ports au moins (rejet), seuils d'équilibre provisoires du 5×5,
 * et 4×4 inchangé (empreintes). Bibliothèque : le vrai catalogue 5×5 (PM.catalogue).
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, GR = PM.graphe, CAT = PM.catalogue;

const NB_GRAINES = 200;
const doc5 = () => CAT.nouveauDocument('5x5');
const cle = (j) => j.i + ',' + j.j;

/** Plateaux 5×5 générés une fois (200 graines, quelques candidats chacune : le test vérifie les règles, pas la qualité moyenne). */
const PLATEAUX = [];
function plateaux() {
  if (!PLATEAUX.length) {
    for (let k = 0; k < NB_GRAINES; k++) {
      const r = GEN.generer(doc5(), { graine: 'g5-' + k, candidats: 6 });
      assert.ok(r.ok, 'graine g5-' + k + ' : ' + r.raison);
      PLATEAUX.push(r);
    }
  }
  return PLATEAUX;
}

test('200 graines : plateau valide, 25 tuiles, 7 villes, compteurs à ok, aucune erreur ni alerte de jonction', () => {
  plateaux().forEach((r, k) => {
    const doc = r.doc, v = M.validerPlateau(doc);
    assert.strictEqual(doc.grille, '5x5');
    assert.strictEqual(doc.plateau.tuiles.length, 25, 'g5-' + k);
    assert.strictEqual(doc.plateau.jetons.length, 7, 'g5-' + k);
    assert.deepStrictEqual(v.erreurs, [], 'g5-' + k);
    assert.ok(!v.alertes.some((a) => a.code === 'jonction_ports' || a.code === 'gabarit_place'), 'g5-' + k);
    const c = PM.controles.calculer(doc);
    assert.deepStrictEqual(c.erreurs.map((e) => e.code), [], 'g5-' + k);
    assert.deepStrictEqual(c.compteurs.filter((x) => x.etat !== 'ok').map((x) => x.cle), [], 'g5-' + k);
    assert.strictEqual(r.rejets.plateau_invalide, 0);
  });
});

test('200 graines : 5 ou 6 B1, cases = 72 + nB1, ports = 34 + nB1, B1 sur les bords de la rangée neutre', () => {
  const vus = { 5: 0, 6: 0 };
  plateaux().forEach((r, k) => {
    const doc = r.doc, nB1 = doc.plateau.tuiles.filter((t) => t.modeleId === 'B1').length;
    assert.ok(nB1 === 5 || nB1 === 6, 'g5-' + k + ' : ' + nB1 + ' B1');
    vus[nB1]++;
    assert.strictEqual(r.score.b1, nB1);
    // les deux bords de la rangée neutre (0,2) et (4,2) portent un B1
    ['0,2', '4,2'].forEach((p) => {
      const [col, lig] = p.split(',').map(Number);
      assert.strictEqual(M.tuileEn(doc, col, lig).modeleId, 'B1', 'g5-' + k + ' : bord (' + p + ')');
    });
    // composition : 4 K2, 9 centrales à 3 cases, bords B1 / B7 / B7m
    const parRole = (g) => doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, '5x5') === g).map((t) => t.modeleId);
    assert.deepStrictEqual(parRole('coin'), ['K2', 'K2', 'K2', 'K2']);
    assert.ok(parRole('centrale').every((id) => id === 'C7' || id === 'C8'));
    const cases = doc.plateau.tuiles.reduce((s, t) => s + M.modeleParId(doc, t.modeleId).cases.length, 0) + 9;
    assert.strictEqual(cases, 72 + nB1, 'g5-' + k);
    assert.strictEqual(GEN.portsParJonction(doc).reduce((a, b) => a + b, 0), 34 + nB1, 'g5-' + k);
    assert.strictEqual(PM.controles.calculer(doc).compteurs.find((x) => x.cle === 'cases').valeur, 72 + nB1);
  });
  assert.ok(vus[5] > 20 && vus[6] > 20, 'les deux compositions sont tirées : ' + JSON.stringify(vus));
});

test('200 graines : villes en 2-3-2 sur des jonctions à 3 ports au moins, toute jonction à 2 ports au moins', () => {
  plateaux().forEach((r, k) => {
    const doc = r.doc, jetons = doc.plateau.jetons;
    const ligne = (j) => jetons.filter((x) => x.j === j).length;
    assert.deepStrictEqual([ligne(1), ligne(2) + ligne(3), ligne(4)], [2, 3, 2], 'g5-' + k + ' : ' + jetons.map(cle).join(' '));
    assert.strictEqual(new Set(jetons.map(cle)).size, 7);
    jetons.forEach((x) => assert.ok(M.portsJonction(doc, x.i, x.j).ports >= 3, 'g5-' + k + ' : ville (' + cle(x) + ')'));
    GEN.portsParJonction(doc).forEach((p, y) => assert.ok(p >= 2, 'g5-' + k + ' : jonction ' + y + ' à ' + p + ' port(s)'));
    assert.deepStrictEqual(M.jonctionsMalReliees(doc), []);
    assert.strictEqual(r.score.jonctionsAMoins2, 0);
    assert.ok(r.score.jonctions3 >= 7);
  });
});

test('200 graines : villes à 4 pas au moins, seuils d\'équilibre du 5×5 respectés, mesure rapide identique à PM.graphe', () => {
  plateaux().forEach((r, k) => {
    const doc = r.doc, g = GR.construire(doc, { villesTraversables: false });
    assert.ok(GR.connexe(g));
    assert.deepStrictEqual(GR.villesProches(g), [], 'g5-' + k);
    const e = GR.equilibre(doc, { graphe: g });
    assert.deepStrictEqual(e.blocages, [], 'g5-' + k);
    assert.deepStrictEqual(e.alertes, [], 'g5-' + k + ' : ' + JSON.stringify(e.alertes));
    assert.ok(e.ecartMax7 <= GR.SEUIL_ECART && e.S < GR.SEUIL_S && e.premiereEgale && !e.cinqContreDeux, 'g5-' + k);
    assert.ok(e.complet);
    // « 4 contre 3 » structurel : aucune alerte
    assert.ok(Math.max(e.partage[1], e.partage[2]) <= 4);
    // la mesure rapide des placements donne les mêmes S, écart, partage et première ville que PM.graphe.equilibre
    const m = GEN.mesureRapide(doc);
    assert.strictEqual(m.S, e.S, 'g5-' + k);
    assert.strictEqual(m.ecartMax, e.ecartMax7);
    assert.deepStrictEqual(m.partage, e.partage);
    assert.strictEqual(m.premiereEgale, e.premiereEgale);
    // le score rendu est celui du critère
    assert.strictEqual(r.score.S, e.S);
  });
});

test('7e ville équidistante : préférée à S égal (docs/18), jamais au prix d\'un rejet ; « 4 contre 3 » sans alerte', () => {
  const avec = plateaux().filter((r) => r.score.partage.egalite >= 1).length;
  assert.ok(avec > NB_GRAINES / 4, avec + ' plateaux sur ' + NB_GRAINES + ' ont une ville équidistante');
  plateaux().forEach((r) => assert.ok(Math.max(r.score.partage[1], r.score.partage[2]) <= 4));
  // avec les 200 candidats par défaut, la préférence joue à plein
  let egal = 0;
  for (let k = 0; k < 5; k++) if (GEN.generer(doc5(), { graine: 'equi-' + k }).score.partage.egalite >= 1) egal++;
  assert.ok(egal >= 4, egal + ' / 5');
});

test('mesure rapide : identique à PM.graphe sur des placements quelconques d\'un même plateau', () => {
  const doc = plateaux()[0].doc, placements = GEN.placementsVilles5x5();
  for (let k = 0; k < placements.length; k += 37) {
    const d = JSON.parse(JSON.stringify(doc));
    d.plateau.jetons = placements[k].map((j) => ({ i: j.i, j: j.j, type: 'capture' }));
    const e = GR.equilibre(d, { graphe: GR.construire(d, { villesTraversables: false }) }), m = GEN.mesureRapide(d);
    if (e.S === null) { assert.strictEqual(m.accessible, false); continue; }
    assert.strictEqual(m.S, e.S);
    assert.strictEqual(m.ecartMax, e.ecartMax7);
    assert.deepStrictEqual(m.partage, e.partage);
    assert.strictEqual(m.premiereEgale, e.premiereEgale);
  }
});

test('orientation : pas de rotation au hasard, aucune rotation d\'une seule centrale ni miroir d\'un bord ne couvre mieux', () => {
  // clé de couverture : [villes 2-3-2 possibles, jonctions à 3 ports, -déséquilibre nord / sud] ; plus grand = meilleur
  const compare = (a, b) => { for (let q = 0; q < 3; q++) if (a[q] !== b[q]) return a[q] > b[q] ? 1 : -1; return 0; };
  let strictementMeilleur = 0, alternatives = 0;
  plateaux().slice(0, 60).forEach((r, k) => {
    const doc = r.doc, ref = GEN.cleCouverture(doc);
    assert.ok(ref.toutes2 && ref.cle[0] === 1, 'g5-' + k);
    doc.plateau.tuiles.forEach((t, n) => {
      const role = M.gabaritCellule(t.col, t.lig, '5x5');
      if (role === 'centrale') {
        for (let rot = 0; rot < 4; rot++) {
          if (rot === t.rot) continue;
          const d = JSON.parse(JSON.stringify(doc));
          d.plateau.tuiles[n].rot = rot;
          const alt = GEN.cleCouverture(d);
          alternatives++;
          if (alt.toutes2) assert.ok(compare(alt.cle, ref.cle) <= 0, 'g5-' + k + ' : centrale (' + t.col + ',' + t.lig + ') tournée de ' + rot);
          if (!alt.toutes2 || compare(alt.cle, ref.cle) < 0) strictementMeilleur++;
        }
      } else if (role === 'bord' && (t.modeleId === 'B7' || t.modeleId === 'B7m')) {
        const d = JSON.parse(JSON.stringify(doc));
        d.plateau.tuiles[n].modeleId = t.modeleId === 'B7' ? 'B7m' : 'B7';
        const alt = GEN.cleCouverture(d);
        alternatives++;
        if (alt.toutes2) assert.ok(compare(alt.cle, ref.cle) <= 0, 'g5-' + k + ' : miroir du bord (' + t.col + ',' + t.lig + ')');
        if (!alt.toutes2 || compare(alt.cle, ref.cle) < 0) strictementMeilleur++;
      }
    });
  });
  // une orientation autre que celle choisie est souvent moins bonne (les égalités existent : la comparaison n'est pas stricte partout)
  assert.ok(strictementMeilleur > alternatives / 4, strictementMeilleur + ' alternatives moins bonnes sur ' + alternatives);
});

test('orientation : les centrales tirées au hasard ne couvrent pas toutes les jonctions (le choix de rotation est utile)', () => {
  const rng = GEN.mulberry32(GEN.hacher('hasard'));
  let incomplets = 0, n = 0;
  plateaux().slice(0, 60).forEach((r) => {
    const d = JSON.parse(JSON.stringify(r.doc));
    d.plateau.tuiles.forEach((t) => { if (M.gabaritCellule(t.col, t.lig, '5x5') === 'centrale') t.rot = Math.floor(rng() * 4); });
    n++;
    if (!GEN.cleCouverture(d).toutes2) incomplets++;
  });
  assert.ok(incomplets > n / 3, incomplets + ' / ' + n + ' plateaux à rotations aléatoires ont une jonction à moins de 2 ports');
});

test('outils de mesure : tirages orientés sans ville pour tous les plateaux, rejets du générateur par cause', () => {
  const MES = require('../outils/mesures-equilibre.js');
  const r = MES.tirerPlateaux5x5(20, 3);
  assert.strictEqual(r.entrees.length + r.sansOrientation, 20);
  assert.ok(r.entrees.every((e) => e.doc.plateau.tuiles.length === 25 && e.doc.plateau.jetons.length === 0 && (e.b1 === 5 || e.b1 === 6)));
  assert.ok(r.entrees.every((e) => GEN.cleCouverture(e.doc).toutes2));
  assert.strictEqual(r.generateur.essais, 20);
  assert.ok(r.generateur.acceptes >= 15 && 'jonction_ports' in r.generateur.rejets);
});

test('reproductibilité : même graine, même plateau et mêmes compteurs ; graines différentes, plateaux différents', () => {
  for (const graine of ['abc', 42, 'g5-7']) {
    const a = GEN.generer(doc5(), { graine, candidats: 15 }), b = GEN.generer(doc5(), { graine, candidats: 15 });
    assert.ok(a.ok, a.raison);
    assert.deepStrictEqual(a.doc, b.doc);
    assert.deepStrictEqual(a.rejets, b.rejets);
    assert.strictEqual(a.essais, b.essais);
  }
  const profils = new Set(plateaux().map((r) => JSON.stringify(r.doc.plateau)));
  assert.ok(profils.size >= 190, 'plateaux distincts : ' + profils.size + ' / ' + NB_GRAINES);
});

test('tirage : les modèles sont répartis (variété), les rôles sont respectés, B7 et B7m servent tous deux', () => {
  const vus = {};
  plateaux().forEach((r) => {
    r.doc.plateau.tuiles.forEach((t) => { vus[t.modeleId] = (vus[t.modeleId] || 0) + 1; });
    r.doc.plateau.tuiles.forEach((t) => {
      const role = M.modeleParId(r.doc, t.modeleId).gabarit;
      assert.strictEqual(role, M.gabaritCellule(t.col, t.lig, '5x5'));
    });
  });
  ['K2', 'B1', 'B7', 'B7m', 'C7', 'C8'].forEach((id) => assert.ok(vus[id] > 0, id + ' jamais tiré'));
  // les poids sont les exemplaires : C7 (6) et C8 (5) restent du même ordre de grandeur
  assert.ok(vus.C7 / vus.C8 > 0.5 && vus.C7 / vus.C8 < 2, JSON.stringify(vus));
});

test('bibliothèque sans B1 : pas de règle des B1, tirage ordinaire ; bibliothèque trop pauvre en ports : rejet explicite', () => {
  const sansB1 = doc5();
  sansB1.modeles = sansB1.modeles.filter((m) => m.id !== 'B1');
  const r = GEN.generer(sansB1, { graine: 'sans-b1', candidats: 5 });
  // peu de ports (K2, B7, C7, C8 seulement) : si un plateau sort, il respecte les conditions fermes
  if (r.ok) {
    GEN.portsParJonction(r.doc).forEach((p) => assert.ok(p >= 2));
    assert.ok(r.doc.plateau.tuiles.every((t) => t.modeleId !== 'B1'));
  } else {
    assert.match(r.raison, /Aucun plateau acceptable/);
  }
  // que des bords à un port : 3 ports aux villes introuvables, mais 2 ports par jonction encore possibles
  const pauvre = doc5();
  pauvre.modeles = pauvre.modeles.filter((m) => m.id !== 'B1' && m.id !== 'B7m' && m.id !== 'C8');
  const p = GEN.generer(pauvre, { graine: 'pauvre', candidats: 3, essaisMax: 12 });
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.rejets.villes_ports, 12, JSON.stringify(p.rejets));
  assert.match(p.raison, /aucun placement des villes en 2-3-2 sur des jonctions à 3 ports au moins : 12/);
  // centrales à un seul port : 25 ports pour 16 jonctions à 2 ports, aucune orientation ne convient
  const maigre = doc5();
  maigre.modeles = maigre.modeles.filter((m) => m.id !== 'B1' && m.id !== 'B7m' && m.id !== 'C8');
  const c7 = maigre.modeles.find((m) => m.id === 'C7');
  c7.cases = c7.cases.filter((c) => c.id !== 'c3');
  c7.chemins = c7.chemins.filter((c) => c.id !== 'h3' && c.id !== 'p3');
  assert.ok(M.validerModele(c7, '5x5').complet);
  const q = GEN.generer(maigre, { graine: 'maigre', candidats: 3, essaisMax: 12 });
  assert.strictEqual(q.ok, false);
  assert.strictEqual(q.rejets.jonction_ports, 12, JSON.stringify(q.rejets));
  assert.match(q.raison, /aucune orientation ne relie chaque jonction par 2 ports au moins : 12/);
});

test('taux de rejet par cause et temps (200 candidats) sur le catalogue 5×5', () => {
  const t0 = Date.now();
  const r = GEN.generer(doc5(), { graine: 'chrono-5x5' });
  const ms = Date.now() - t0;
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.candidats, 200);
  assert.ok(ms < 5000, ms + ' ms');
  // un seul candidat par graine : les rejets comptent les tirages avant tout choix
  const rej = {}; let essais = 0, acceptes = 0;
  for (let k = 0; k < 200; k++) {
    const x = GEN.generer(doc5(), { graine: 'taux-' + k, candidats: 1, essaisMax: 1 });
    essais += x.essais;
    if (x.ok) acceptes++;
    Object.keys(x.rejets).forEach((c) => { rej[c] = (rej[c] || 0) + x.rejets[c]; });
  }
  console.log(`# 5×5 : 200 candidats en ${ms} ms (${r.essais} essais) ; ${acceptes}/${essais} candidats acceptés ; rejets : ${JSON.stringify(rej)}`);
  assert.ok(acceptes >= essais * 0.8, 'taux d\'acceptation : ' + acceptes + ' / ' + essais);
  assert.strictEqual(rej.plateau_invalide, 0);
  assert.strictEqual(rej.connexite, 0);
  assert.strictEqual(rej.villes_proches, 0);
});

/* ---------- 4×4 inchangé ---------- */

// Empreintes du générateur 4×4 avant l'ajout du 5×5 (graines 'emp-0' à 'emp-19', 60 candidats, mode par défaut puis « variées »,
// puis la graine 'defaut' à 200 candidats avec son rapport). Elles ne changent que si le 4×4 est volontairement modifié.
const EMPREINTES_4X4 = [
  'e2ccae2c3e', 'bad26165c8', '19f76faf80', '42acc0b6c0', 'c39c335de0', '47b07ae841', 'fabc26632b', '276ecc5525', 'b8be8cd849', '3e943d5615',
  'fe181aa735', '2ac924cf54', '2c613554d2', '733048d623', 'eacbf1d5bd', 'aa2634fcf3', 'd26918546c', 'ea41459027', 'e2773f1333', '8a5d5ec9f4',
  'fba22ef13e', '32e2cbf165', 'ff4f4ee914', '7cdfdd5e2a', '4cd68bfdd9', '9629c68830', '3e89cfe564', '2da0b0a02d', '17735f4a1b', '63a5c1a56f',
  '7625c20e64', '8c3ea18c14', '0e8f4697f3', '4ee1ac87b1', 'a29d787cfd', '5577d75e55', '54bbfa5c2a', 'cfc914e759', '1a883c6271', '8d0369da93',
  'a4dccbb607'
];
const sha = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 10);

test('4×4 inchangé : mêmes plateaux, mêmes rejets, mêmes scores qu\'avant le 5×5 (20 graines, 2 modes, empreintes)', () => {
  const obtenues = [];
  for (let k = 0; k < 20; k++) {
    for (const v of [false, true]) {
      const r = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'emp-' + k, candidats: 60, jonctionsVariees: v });
      obtenues.push(sha([r.ok, r.doc && r.doc.plateau, r.essais, r.candidats, r.rejets, r.score]));
      assert.ok(!('jonction_ports' in r.rejets) && !('b1' in r.score), 'aucune clé propre au 5×5 en 4×4');
    }
  }
  const d = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'defaut' });
  obtenues.push(sha([d.doc.plateau, d.essais, d.rejets, d.rapport]));
  assert.deepStrictEqual(obtenues, EMPREINTES_4X4);
});
