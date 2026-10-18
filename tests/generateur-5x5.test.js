'use strict';
/*
 * Tests du générateur 5×5 (src/generateur.js), règles de docs/18 (« Décisions de l'utilisateur pour le catalogue 5×5 », réponses sur la
 * révision « centrales ouvertes »), docs/24 § 8, docs/28, docs/29 et docs/46 : 78 à 81 cases (nombre de B1 choisi pour la cible, sans
 * dépasser ses exemplaires, de préférence sur la rangée neutre), cases égales entre moitiés, centrales orientées, villes en 2-3-2 sur des
 * jonctions à 3 ports au moins, toute jonction à 2 ports au moins (rejet), seuils d'équilibre définitifs du 5×5 (docs/36), affinage du
 * rythme, abandon sur bibliothèque impossible, vrais miroirs (bibliothèque du catalogue précédent), bornes des options, PM.graphe.flancs,
 * empreintes du 4×4. Bibliothèque : le vrai catalogue 5×5 (PM.catalogue).
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

test('200 graines : 78 à 81 cases (= 72 + nB1 + nU1), ports = cases − 38, au plus 6 B1, cases égales entre moitiés', () => {
  const casesVues = {};
  let neutres = 0;
  plateaux().forEach((r, k) => {
    const doc = r.doc, n = (id) => doc.plateau.tuiles.filter((t) => t.modeleId === id).length, nB1 = n('B1'), nU1 = n('U1');
    assert.ok(nB1 <= 6, 'g5-' + k + ' : ' + nB1 + ' B1 pour 6 exemplaires');
    assert.strictEqual(r.score.b1, nB1);
    // composition : 4 K2, centrales U1 / P1 / P2 / P3 / P5, bords B1 / B7
    const parRole = (g) => doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, '5x5') === g).map((t) => t.modeleId);
    assert.deepStrictEqual(parRole('coin'), ['K2', 'K2', 'K2', 'K2']);
    assert.ok(parRole('centrale').every((id) => ['U1', 'P1', 'P2', 'P3', 'P5'].includes(id)));
    assert.ok(parRole('bord').every((id) => id === 'B1' || id === 'B7'));
    const cases = doc.plateau.tuiles.reduce((s, t) => s + M.modeleParId(doc, t.modeleId).cases.length, 0) + 9;
    assert.strictEqual(cases, 72 + nB1 + nU1, 'g5-' + k);
    assert.ok(cases >= GEN.CASES_CIBLE_5X5[0] && cases <= GEN.CASES_CIBLE_5X5[1], 'g5-' + k + ' : ' + cases + ' cases');
    assert.deepStrictEqual(GEN.CASES_CIBLE_5X5, [78, 81]);
    casesVues[cases] = (casesVues[cases] || 0) + 1;
    assert.strictEqual(GEN.portsParJonction(doc).reduce((a, b) => a + b, 0), cases - 38, 'g5-' + k);
    assert.strictEqual(PM.controles.calculer(doc).compteurs.find((x) => x.cle === 'cases').valeur, cases);
    assert.strictEqual(r.score.cases.total, cases);
    // décision 2 (docs/18) : autant de cases dans la moitié verte que dans la moitié rouge (tuiles et jonctions-cases)
    const mo = GR.casesParMoitie(doc, GR.construire(doc));
    assert.strictEqual(mo.ecart, 0, 'g5-' + k + ' : ' + JSON.stringify(mo));
    assert.strictEqual(GEN.ecartMoities(doc.plateau.tuiles, PM.geometrie.format('5x5'), Object.fromEntries(doc.modeles.map((m) => [m.id, m.cases.length]))), 0);
    if (M.tuileEn(doc, 0, 2).modeleId === 'B1' && M.tuileEn(doc, 4, 2).modeleId === 'B1') neutres++;
  });
  // mesuré (200 graines) : 78 : 10, 79 : 26, 80 : 78, 81 : 86 ; les 4 valeurs sont tirées
  assert.deepStrictEqual(Object.keys(casesVues).sort(), ['78', '79', '80', '81'], JSON.stringify(casesVues));
  // préférence (pas une règle) : B1 d'abord sur les deux bords de la rangée neutre ; l'égalité des moitiés peut les déplacer (mesuré 65 %)
  assert.ok(neutres > NB_GRAINES / 2, neutres + ' plateaux avec deux B1 sur la rangée neutre');
});

test('200 graines : plusieurs placements de villes admissibles, rythme et accès au centre mesurés (préférences)', () => {
  const chaines = [], ecarts = [];
  plateaux().forEach((r, k) => {
    // au moins 40 ports : plusieurs placements 2-3-2 sur des jonctions à 3 ports (un seul à 39 ports, docs/45)
    assert.ok(r.score.placementsAdmissibles >= 2, 'g5-' + k + ' : ' + r.score.placementsAdmissibles + ' placement(s)');
    assert.strictEqual(r.score.placementsAdmissibles, GEN.placementsAdmissibles5x5(r.doc));
    const g = GR.construire(r.doc), ry = GR.rythme(r.doc, g), ac = GR.accesCentre(r.doc, g, { sansFlot: true });
    assert.strictEqual(r.score.chaine, ry.chaineMax);
    assert.deepStrictEqual(r.score.acces, { vert: ac.portes.vert, rouge: ac.portes.rouge, ecart: ac.ecart });
    chaines.push(ry.chaineMax); ecarts.push(Math.abs(ac.ecart));
  });
  // préférences mesurées (6 candidats par graine) : chaîne <= 3 sur la plupart des plateaux, écart d'accès <= 1 sur la plupart
  assert.ok(chaines.filter((c) => c <= 3).length > NB_GRAINES * 0.8, 'chaînes : ' + JSON.stringify(chaines));
  assert.ok(ecarts.filter((e) => e <= 1).length > NB_GRAINES * 0.8, 'écarts : ' + JSON.stringify(ecarts));
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

test('orientation : pas de rotation au hasard, aucune rotation d\'une seule centrale ne couvre mieux (ports d\'abord)', () => {
  // clé de couverture : [villes 2-3-2 possibles, jonctions à 3 ports, -déséquilibre nord / sud] ; plus grand = meilleur. Les deux premiers
  // termes priment (orientation selon les ports, docs/18) ; le troisième peut céder à l'affinage du rythme et des accès (préférence
  // venue après, docs/46) : il n'est pas comparé ici
  const compare = (a, b) => { for (let q = 0; q < 2; q++) if (a[q] !== b[q]) return a[q] > b[q] ? 1 : -1; return 0; };
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
      }
    });
  });
  // une orientation autre que celle choisie est souvent moins bonne (les égalités existent : la comparaison n'est pas stricte partout)
  assert.ok(strictementMeilleur > alternatives / 5, strictementMeilleur + ' alternatives moins bonnes sur ' + alternatives);
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
  assert.ok(r.entrees.every((e) => e.doc.plateau.tuiles.length === 25 && e.doc.plateau.jetons.length === 0 && e.b1 <= 6));
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

test('tirage : les modèles sont répartis (variété), les rôles sont respectés, chaque modèle du catalogue sert', () => {
  const vus = {};
  plateaux().forEach((r) => {
    r.doc.plateau.tuiles.forEach((t) => { vus[t.modeleId] = (vus[t.modeleId] || 0) + 1; });
    r.doc.plateau.tuiles.forEach((t) => {
      const role = M.modeleParId(r.doc, t.modeleId).gabarit;
      assert.strictEqual(role, M.gabaritCellule(t.col, t.lig, '5x5'));
    });
  });
  ['K2', 'B1', 'B7', 'U1', 'P1', 'P2', 'P3', 'P5'].forEach((id) => assert.ok(vus[id] > 0, id + ' jamais tiré'));
  // les poids sont les exemplaires : U1 (5) sort plus que P3 (2), qui sort plus que P1 (1)
  assert.ok(vus.U1 > vus.P3 && vus.P3 > vus.P1, JSON.stringify(vus));
});

test('bibliothèque sans B1 : pas de règle des B1, tirage ordinaire ; bibliothèque trop pauvre en ports : rejet explicite', () => {
  const sansB1 = doc5();
  sansB1.modeles = sansB1.modeles.filter((m) => m.id !== 'B1');
  const r = GEN.generer(sansB1, { graine: 'sans-b1', candidats: 5 });
  // peu de ports (K2, B7 et les centrales seulement) : si un plateau sort, il respecte les conditions fermes
  if (r.ok) {
    GEN.portsParJonction(r.doc).forEach((p) => assert.ok(p >= 2));
    assert.ok(r.doc.plateau.tuiles.every((t) => t.modeleId !== 'B1'));
  } else {
    assert.match(r.raison, /Aucun plateau acceptable/);
  }
  // que des bords à un port et des centrales à 2 ports : 34 ports, 3 ports aux villes introuvables, 2 ports par jonction encore possibles
  const pauvre = doc5();
  pauvre.modeles = pauvre.modeles.filter((m) => m.id !== 'B1' && m.id !== 'U1');
  const p = GEN.generer(pauvre, { graine: 'pauvre', candidats: 3, essaisMax: 12 });
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.rejets.villes_ports, 12, JSON.stringify(p.rejets));
  assert.match(p.raison, /aucun placement des villes en 2-3-2 sur des jonctions à 3 ports au moins : 12/);
  // centrales à un seul port : 25 ports pour 16 jonctions à 2 ports, aucune orientation ne convient
  const maigre = doc5();
  maigre.modeles = maigre.modeles.filter((m) => m.id !== 'B1' && m.gabarit !== 'centrale' || m.id === 'P1');
  const c7 = maigre.modeles.find((m) => m.id === 'P1');
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

/* ---------- abandon, miroirs, options, flancs, budget ---------- */

test('abandon : bibliothèque impossible en 5×5 = 25 échecs structurels consécutifs, message clair, sans geler', () => {
  const t0 = Date.now();
  const pauvre = doc5();
  pauvre.modeles = pauvre.modeles.filter((m) => m.id !== 'B1' && m.id !== 'U1');
  const p = GEN.generer(pauvre, { graine: 'abandon-1' });
  assert.strictEqual(p.ok, false);
  assert.strictEqual(p.essais, 25, 'abandon après 25 essais, pas 1000');
  assert.strictEqual(p.rejets.villes_ports, 25, JSON.stringify(p.rejets));
  assert.match(p.raison, /Abandon après 25 échecs consécutifs/);
  assert.match(p.raison, /il manque le bord « B1 »/);
  // B1 présent mais à 0 exemplaire (non tirable) : le message le nomme quand même
  const sansExemplaire = doc5();
  sansExemplaire.modeles.find((m) => m.id === 'B1').exemplaires = 0;
  sansExemplaire.modeles.find((m) => m.id === 'U1').exemplaires = 0; // U1 (3 ports) suffirait sinon à fournir les ports manquants
  const z = GEN.generer(sansExemplaire, { graine: 'abandon-0' });
  assert.strictEqual(z.ok, false);
  assert.strictEqual(z.essais, 25);
  assert.match(z.raison, /il manque le bord « B1 »/);
  // B1 tirable mais trop peu de ports (seule centrale : P1 amputée) : conseil général, B1 n'est pas accusé à tort
  const maigre = doc5();
  maigre.modeles = maigre.modeles.filter((m) => m.gabarit !== 'centrale' || m.id === 'P1');
  const c7 = maigre.modeles.find((m) => m.id === 'P1');
  c7.cases = c7.cases.filter((c) => c.id !== 'c3');
  c7.chemins = c7.chemins.filter((c) => c.id !== 'h3' && c.id !== 'p3');
  const q = GEN.generer(maigre, { graine: 'abandon-2' });
  assert.strictEqual(q.ok, false);
  assert.strictEqual(q.essais, 25);
  assert.match(q.raison, /Abandon après 25 échecs consécutifs/);
  assert.match(q.raison, /n’apportent pas assez de ports/);
  assert.ok(!/il manque le bord/.test(q.raison));
  assert.ok(Date.now() - t0 < 5000, 'abandon rapide : ' + (Date.now() - t0) + ' ms');
});

test('abandon : le catalogue normal n\'est pas touché (aucun abandon, aucune recherche interrompue)', () => {
  for (let k = 0; k < 40; k++) {
    const r = GEN.generer(doc5(), { graine: 'ab-' + k, candidats: 3 });
    assert.ok(r.ok, r.raison);
    assert.strictEqual(r.score.orientationsTronquees, 0);
  }
});

test('vrais miroirs (bibliothèque du catalogue précédent) : B7 <-> B7m seulement ; un bord de même taille mais de forme différente n\'est pas substitué', () => {
  // le catalogue livré n'a plus de paire miroir (docs/18) ; la substitution du vrai miroir sert encore aux documents qui en ont (B7 / B7m)
  const docPrec = () => { const d = M.nouveauDocument('5x5'); d.modeles = JSON.parse(JSON.stringify(CAT.precedent['5x5'])); return d; };
  const F = PM.geometrie.format('5x5'), cat = docPrec().modeles, id = (x) => cat.find((m) => m.id === x);
  assert.strictEqual(GEN.sontMiroirs(id('B7'), id('B7m'), F), true);
  assert.strictEqual(GEN.sontMiroirs(id('B7m'), id('B7'), F), true);
  assert.strictEqual(GEN.sontMiroirs(id('B7'), id('B7'), F), false);
  assert.strictEqual(GEN.sontMiroirs(id('B1'), id('B1'), F), true, 'B1 est symétrique');
  assert.strictEqual(GEN.sontMiroirs(id('B1'), id('B7'), F), false);
  // même nombre de cases et de ports que B7 (SE), apparition ailleurs : l'ancienne règle l'acceptait
  const b7x = JSON.parse(JSON.stringify(id('B7')));
  b7x.id = 'B7x';
  b7x.cases.find((c) => c.type === 'apparition').x = 40;
  assert.strictEqual(GEN.sontMiroirs(id('B7'), b7x, F), false);
  assert.strictEqual(GEN.sontMiroirs(id('B7m'), b7x, F), false);
  // port du côté opposé (SO) mais apparition mal placée : pas un miroir de B7
  const b7y = JSON.parse(JSON.stringify(id('B7m')));
  b7y.id = 'B7y';
  b7y.cases.find((c) => c.type === 'apparition').y = 30;
  assert.strictEqual(GEN.sontMiroirs(id('B7'), b7y, F), false);
  // tirage forcé : tous les bords simples tirés sont B7 ; B7y (même taille et même nombre de ports que B7m) est dans la bibliothèque
  const doc = docPrec();
  b7y.exemplaires = 4;
  doc.modeles.push(b7y);
  assert.ok(M.validerModele(b7y, '5x5').complet, 'B7y est un modèle complet (donc tirable)');
  const ctx = GEN.contexteDocument5x5(doc);
  assert.ok(ctx.modelesDispo.bord.some((m) => m.id === 'B7y'));
  ctx.bordsSansB1 = ctx.modelesDispo.bord.filter((m) => m.id === 'B7');
  const vus = {};
  for (let k = 0; k < 40; k++) {
    const t = GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(k));
    if (t.cause) continue;
    t.tuiles.forEach((x) => { vus[x.modeleId] = (vus[x.modeleId] || 0) + 1; });
  }
  assert.strictEqual(vus.B7y, undefined, 'B7y ne remplace jamais un B7 : ' + JSON.stringify(vus));
  assert.ok(vus.B7m > 0, 'le vrai miroir B7m reste permis : ' + JSON.stringify(vus));
});

test('options : candidats et essaisMax invalides donnent la valeur par défaut, candidats est borné', () => {
  const d4 = () => CAT.nouveauDocument('4x4');
  const ref = GEN.generer(d4(), { graine: 'opt', candidats: 200 });
  for (const mauvais of [Infinity, -Infinity, 'abc', '5', -3, 0, NaN, null, {}, [], true]) {
    const r = GEN.generer(d4(), { graine: 'opt', candidats: mauvais });
    assert.deepStrictEqual(r.doc, ref.doc, 'candidats = ' + String(mauvais));
    assert.strictEqual(r.candidats, ref.candidats);
  }
  assert.strictEqual(GEN.generer(d4(), { graine: 'opt', candidats: 2, essaisMax: 'x' }).ok, true);
  assert.strictEqual(GEN.generer(d4(), { graine: 'opt', candidats: 2, essaisMax: Infinity }).ok, true);
  const gros = GEN.generer(d4(), { graine: 'opt', candidats: 1e9, essaisMax: 1e9 });
  assert.ok(gros.ok && gros.candidats <= 1000 && gros.essais <= 5000, gros.candidats + ' candidats, ' + gros.essais + ' essais');
});

test('PM.graphe.flancs : « centre » = colonnes 1 à colonnes - 2 (5×5 : 1, 2 et 3), 4×4 inchangé', () => {
  for (const [id, n] of [['5x5', 5], ['4x4', 4]]) {
    const doc = GEN.generer(CAT.nouveauDocument(id), { graine: 'flancs-' + id, candidats: 2 }).doc;
    const jetons = [];
    for (let j = 1; j < n; j++) for (let i = 1; i < n; i++) jetons.push({ i, j, type: 'capture' });
    const mesure = (filtre, p, trav) => {
      const g = GR.construire(doc, { jetons, filtreTuile: filtre, villesTraversables: trav }), d = GR.distancesJoueur(g, p);
      let m = Infinity;
      g.jonctions.forEach((jn) => { if (jn.j === (p === 1 ? n - 1 : 1) && d.has(jn.id)) m = Math.min(m, d.get(jn.id)); });
      return m;
    };
    for (const trav of [false, true]) {
      const f = GR.flancs(doc, { villesTraversables: trav });
      [1, 2].forEach((p) => {
        assert.strictEqual(f[p - 1].centre, mesure((t) => t.col >= 1 && t.col <= n - 2, p, trav), id + ' joueur ' + p);
        const flanc = (t) => t.col === 0 || t.col === n - 1 || ((t.lig === 0 || t.lig === n - 1) && M.aUneApparition(M.modeleParId(doc, t.modeleId)));
        assert.strictEqual(f[p - 1].flanc, mesure(flanc, p, trav), id + ' flanc');
      });
    }
  }
});

test('constantes partagées : ports minimum, répartition 2-3-2, causeRejet et placements gelés', () => {
  assert.strictEqual(GR.PORTS_VILLE_MIN, 3);
  assert.strictEqual(GR.PORTS_JONCTION_MIN, 2);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(GR.REPARTITION_VILLES_5X5)), [{ rangees: [1], nb: 2 }, { rangees: [2, 3], nb: 3 }, { rangees: [4], nb: 2 }]);
  assert.strictEqual(GEN.REPARTITION_VILLES_5X5, GR.REPARTITION_VILLES_5X5);
  assert.ok(Object.isFrozen(GEN.placementsVilles5x5()) && Object.isFrozen(GEN.placementsVilles5x5()[0]));
  assert.strictEqual(GEN.placementsVilles5x5().length, 2016);
  const ok = { accessible: true, cinq: false, ecartMax: 1, premiereEgale: true, S: 3 };
  const avec = (o) => Object.assign({}, ok, o);
  assert.strictEqual(GEN.causeRejet(ok, '5x5'), null);
  assert.strictEqual(GEN.causeRejet(avec({ S: 5 }), '5x5'), 'score_s');
  assert.strictEqual(GEN.causeRejet(avec({ S: 5 }), '4x4'), null);
  assert.strictEqual(GEN.causeRejet(avec({ accessible: false }), '5x5'), 'ville_inaccessible');
  assert.strictEqual(GEN.causeRejet(avec({ cinq: true }), '4x4'), 'desequilibre');
  assert.strictEqual(GEN.causeRejet(avec({ ecartMax: 4 }), '4x4'), 'desequilibre');
  assert.strictEqual(GEN.causeRejet(avec({ ecartMax: 3 }), '4x4'), 'ecart');
  assert.strictEqual(GEN.causeRejet(avec({ premiereEgale: false }), '4x4'), 'premiere_ville');
});

test('budget de nœuds : une recherche d\'orientation interrompue est signalée (tronque)', () => {
  const ctx = GEN.contexteDocument5x5(doc5());
  assert.strictEqual(GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(1)).tronque, false);
  ctx.budgetNoeuds = 40;
  assert.strictEqual(GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(1)).tronque, true);
});

/* ---------- 4×4 : empreintes ---------- */

// Empreintes du générateur 4×4 depuis le branchement des catalogues « centrales ouvertes » (docs/46 : cases égales entre moitiés,
// centrales orientées selon les ports, affinage du rythme ; graines 'emp-0' à 'emp-19', 60 candidats, mode par défaut puis « variées »,
// puis la graine 'defaut' à 200 candidats avec son rapport). Elles ne changent que si le 4×4 est volontairement modifié (les empreintes
// d'avant, docs/34, valaient pour le catalogue et le générateur de la version 3.04).
const EMPREINTES_4X4 = [
  'cc51470500', '246271612f', '92a566ce6e', '5981107510', '43e4ad7ce8', '9214010d4f', 'f31302608c', '108f564629', 'a6b27a7b30', 'bad0dc90f0',
  '39f0c79733', 'a2eecf3c25', 'a1d94d62fe', 'c7da110096', '3425c93c26', '4b616a5df1', '5208d28f4d', 'ae8b324e7a', 'f09c2be2a4', '579dc8625f',
  '1ccbfff93e', 'e7777499de', 'e30441f014', '8227e5ed09', '769e4aa3ad', '96cea7885e', 'e702f071ce', '18d35bc1fe', '6440133aff', '4eb00f21b0',
  'e1dc029b7b', 'edb1ae75be', 'aaa73697c3', '799e4da997', '2fba9126bf', '86376f6505', '5591b9c420', '63e3bf5285', '62c20533ca', 'fc27fda8c7',
  '3768a123a1'
];
const sha = (x) => crypto.createHash('sha1').update(JSON.stringify(x)).digest('hex').slice(0, 10);

test('4×4 : mêmes plateaux, mêmes rejets, mêmes scores à graine donnée (20 graines, 2 modes, empreintes de docs/46)', () => {
  const obtenues = [];
  for (let k = 0; k < 20; k++) {
    for (const v of [false, true]) {
      const r = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'emp-' + k, candidats: 60, jonctionsVariees: v });
      obtenues.push(sha([r.ok, r.doc && r.doc.plateau, r.essais, r.candidats, r.rejets, r.score]));
      assert.ok(!('jonction_ports' in r.rejets) && !('b1' in r.score), 'aucune clé propre au 5×5 en 4×4');
    }
  }
  const d = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'defaut', jonctionsVariees: false }); // rangée centrale : le défaut est « variées » depuis docs/48
  obtenues.push(sha([d.doc.plateau, d.essais, d.rejets, d.rapport]));
  assert.deepStrictEqual(obtenues, EMPREINTES_4X4);
});
