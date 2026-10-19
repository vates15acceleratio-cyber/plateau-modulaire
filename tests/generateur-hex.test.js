'use strict';
/*
 * Tests du générateur hexagonal 'hex19' (src/generateur.js ; docs/72, docs/77, docs/79, docs/80) : composition dans le stock, 6 villes en
 * trèfle (ou « dispositions variées »), rotations des intérieures cherchées de façon exhaustive (S minimal), critères de rejet, mesures
 * sur 50 plateaux, placerVilles / meilleurPlacementVilles, non-régression 4×4 et 5×5.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/graphe.js');
require('../src/catalogue.js');
require('../src/generateur.js');
const PM = globalThis.PM;
const G = PM.generateur, M = PM.modele, GR = PM.graphe, CAT = PM.catalogue, F = PM.geometrie.format('hex19');

const doc0 = () => CAT.nouveauDocument('hex19');
const NB = 50;
const t0 = Date.now();
const plateaux = [];
for (let i = 0; i < NB; i++) plateaux.push(G.generer(doc0(), { graine: 'hex-' + i }));
const dureeTotale = Date.now() - t0;

test('hex19 : 50 plateaux générés, tous réussis, en moins de 3 s chacun en moyenne', () => {
  assert.equal(plateaux.filter((r) => r.ok).length, NB, plateaux.filter((r) => !r.ok).map((r) => r.raison).join(' | '));
  assert.ok(dureeTotale / NB < 3000, 'durée moyenne ' + Math.round(dureeTotale / NB) + ' ms');
});

test('hex19 : 19 tuiles, 6 villes en trèfle, 56 cases, 0 case faible, 0 raccord mort, 0 erreur de validation', () => {
  for (const r of plateaux) {
    const d = r.doc, g = GR.construire(d, { villesTraversables: false }), cx = GR.connexions(d, g);
    assert.equal(d.grille, 'hex19');
    assert.equal(d.plateau.tuiles.length, 19);
    assert.deepEqual(d.plateau.jetons.map((j) => j.i).sort((a, b) => a - b), F.TREFLE.slice());
    assert.ok(d.plateau.jetons.every((j) => j.j === 0 && j.type === 'capture'));
    assert.equal(cx.cases, 56);
    assert.equal(cx.faibles, 0);
    assert.deepEqual(M.raccordsMorts(d).filter((x) => x.raison !== 'absent'), []);
    assert.deepEqual(M.validerPlateau(d).erreurs, []);
    assert.equal(r.score.raccordsMorts, 0);
    assert.equal(r.score.cases.total, 56);
  }
});

test('hex19 : villes à 3 ports, aucun siège à moins de 2 ports, écart d’au moins 4 pas entre villes', () => {
  for (const r of plateaux) {
    const g = GR.construire(r.doc, { villesTraversables: false });
    g.jonctions.forEach((jn) => { assert.ok(jn.ports >= 2, 'siège ' + jn.i); if (jn.type === 'ville') assert.equal(jn.ports, 3); });
    assert.equal(g.villes.size, 6);
    assert.deepEqual(GR.villesProches(g), []);
    g.villes.forEach((v) => { const d = GR.distances(g, v); g.villes.forEach((w) => { if (w !== v) assert.ok(d.get(w) >= 4); }); });
  }
});

test('hex19 : équilibre : partage 3 / 3, S de 0 ou 1, aucun blocage ni alerte, première ville à égalité', () => {
  for (const r of plateaux) {
    const e = GR.equilibre(r.doc);
    assert.ok(e.complet, e.lacunes.join(' '));
    assert.deepEqual([e.partage[1], e.partage[2], e.partage.egalite], [3, 3, 0]);
    assert.ok(e.S <= 2, 'S = ' + e.S);
    assert.ok(e.S < GR.seuilS('hex19') - 1, 'rejet du générateur à S >= 3');
    assert.deepEqual([e.blocages, e.alertes], [[], []]);
    assert.equal(e.premiereEgale, true);
    assert.equal(r.score.S, e.S);
  }
});

test('hex19 : S minimal : aucune autre combinaison de rotations de la même composition ne fait mieux (recherche exhaustive)', () => {
  const r = plateaux[0], d = r.doc;
  const centrales = d.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, F) === 'centrale');
  assert.equal(centrales.length, 7);
  let meilleur = Infinity, tenus = 0;
  const essayer = (k, tuiles) => {
    if (k === centrales.length) {
      const c = { version: d.version, grille: 'hex19', modeles: d.modeles, plateau: { tuiles, jetons: d.plateau.jetons } };
      const g = GR.construire(c, { villesTraversables: false });
      if (GR.villesProches(g).length) return;
      tenus++;
      const e = GR.equilibre(c, { graphe: g });
      if (e.S !== null) meilleur = Math.min(meilleur, e.S);
      return;
    }
    for (let rot = 0; rot < 3; rot++) essayer(k + 1, tuiles.map((t) => (t === centrales[k] ? Object.assign({}, t, { rot }) : t)));
  };
  essayer(0, d.plateau.tuiles);
  assert.ok(tenus >= 1);
  assert.ok(r.score.S <= meilleur, 'S rendu ' + r.score.S + ', meilleur S de la composition ' + meilleur);
});

test('hex19 : stock respecté (30 pièces : HC2 ≤ 8, HC3 ≤ 7, HB1 ≤ 8, HK1 ≤ 7), composition 7 + 6 + 6', () => {
  for (const r of plateaux) {
    const n = (id) => r.doc.plateau.tuiles.filter((t) => t.modeleId === id).length;
    assert.ok(n('HC2') <= 8 && n('HC3') <= 7);
    assert.equal(n('HC2') + n('HC3'), 7);
    assert.equal(n('HB1'), 6);
    assert.equal(n('HK1'), 6);
    F.cellules.filter((c) => c.gabarit !== 'centrale').forEach((c) => {
      const t = r.doc.plateau.tuiles.find((x) => x.col === c.col && x.lig === c.lig);
      assert.equal(t.rot, c.rotation);
    });
  }
  const compositions = new Set(plateaux.map((r) => ['HC2', 'HC3'].map((id) => r.doc.plateau.tuiles.filter((t) => t.modeleId === id).length).join('/')));
  assert.ok(compositions.size >= 2, 'compositions : ' + [...compositions].join(' '));
});

test('hex19 : stock insuffisant (une seule pièce de chaque) : échec clair, pas de plateau', () => {
  const d = doc0();
  d.modeles.forEach((m) => { m.exemplaires = 1; });
  const r = G.generer(d, { graine: 'stock' });
  assert.equal(r.ok, false);
  assert.ok(/stock|Abandon|Aucun plateau/.test(r.raison), r.raison);
});

test('hex19 : même graine, même plateau ; graines différentes, plateaux différents', () => {
  const a = G.generer(doc0(), { graine: 'x1' }), b = G.generer(doc0(), { graine: 'x1' });
  assert.deepEqual(a.doc.plateau, b.doc.plateau);
  const signatures = new Set(plateaux.map((r) => JSON.stringify(r.doc.plateau.tuiles)));
  assert.ok(signatures.size >= 45, 'plateaux distincts : ' + signatures.size);
});

test('hex19 : rapport (6 villes, 18 campements, trèfle, exhaustif) et rejets documentés', () => {
  const r = plateaux[0];
  const texte = r.rapport.join('\n');
  assert.match(texte, /6 villes en trèfle/);
  assert.match(texte, /18 autres sièges sont des campements/);
  assert.match(texte, /exhaustif/);
  assert.match(texte, /6 rangs/);
  assert.ok(['jonction_ports', 'villes_ports', 'connexions', 'score_s', 'stock_insuffisant', 'cinq_contre_deux', 'villes_proches'].every((k) => k in r.rejets));
  assert.equal(r.score.positionsParDefaut, true);
  assert.deepEqual(r.score.disposition, F.TREFLE.slice());
});

test('hex19 : option « dispositions variées » : villes symétriques de la liste, 3 par camp, plateaux valides', () => {
  const liste = G.DISPOSITIONS_VARIEES_HEX.map((d) => d.join(','));
  assert.equal(liste.length, 10);
  assert.equal(liste[0], F.TREFLE.join(','));
  assert.ok(liste.includes('1,2,11,12,21,22'));
  const vues = new Set();
  for (let i = 0; i < 12; i++) {
    const r = G.generer(doc0(), { graine: 'var-' + i, dispositionsVariees: true });
    assert.ok(r.ok, r.raison);
    const sieges = r.doc.plateau.jetons.map((j) => j.i).sort((a, b) => a - b);
    assert.ok(liste.includes(sieges.join(',')), sieges.join(','));
    assert.equal(sieges.filter((s) => s < 12).length, 3);
    vues.add(sieges.join(','));
    const g = GR.construire(r.doc, { villesTraversables: false });
    assert.deepEqual(GR.villesProches(g), []);
    assert.equal(GR.connexions(r.doc, g).faibles, 0);
    const e = GR.equilibre(r.doc);
    assert.ok(e.S <= 2 && !e.blocages.length && !e.alertes.length);
  }
  assert.ok(vues.size >= 2, 'dispositions vues : ' + [...vues].join(' | '));
});

test('hex19 : dispositions symétriques par demi-tour : 220, trèfle d’abord, 3 sièges par camp', () => {
  const l = G.dispositionsSymetriquesHex(F);
  assert.equal(l.length, 220);
  assert.deepEqual(l[0], F.TREFLE.slice());
  assert.ok(l.every((d) => d.length === 6 && d.filter((s) => s < 12).length === 3 && d.every((s) => d.includes(23 - s))));
  assert.ok(Object.isFrozen(l));
});

test('hex19 : placerVilles / meilleurPlacementVilles : plateau incomplet refusé, trèfle choisi s’il convient', () => {
  const vide = G.meilleurPlacementVilles(doc0());
  assert.equal(vide.ok, false);
  assert.match(vide.raison, /0 sur 19/);
  const r = plateaux[0].doc;
  const sans = JSON.parse(JSON.stringify(r));
  sans.plateau.jetons = [];
  const m = G.meilleurPlacementVilles(sans);
  assert.equal(m.ok, true, m.raison);
  assert.equal(m.motif, true);
  assert.deepEqual(m.jetons.map((j) => j.i), F.TREFLE.slice());
  assert.equal(m.partageSymetrique, true);
  assert.ok(m.admissibles >= 1 && m.acceptes >= 1);
  // le trèfle ne convient plus : une autre disposition admissible est choisie, avec 6 villes à 4 pas au moins
  let trouve = null;
  for (let i = 0; i < NB && !trouve; i++) {
    const d = JSON.parse(JSON.stringify(plateaux[i].doc));
    d.plateau.jetons = [];
    d.plateau.tuiles.forEach((t) => { if (M.gabaritCellule(t.col, t.lig, F) === 'centrale') t.rot = (t.rot + 1) % 6; });
    const x = G.meilleurPlacementVilles(d);
    if (x.ok && !x.motif) trouve = { d, x };
  }
  if (trouve) {
    assert.equal(trouve.x.jetons.length, 6);
    const c = JSON.parse(JSON.stringify(trouve.d));
    c.plateau.jetons = trouve.x.jetons;
    assert.deepEqual(GR.villesProches(GR.construire(c, { villesTraversables: false })), []);
  }
});

test('hex19 : placerVilles pose les 6 villes sur le plateau via l’état (une étape d’historique)', () => {
  const sans = JSON.parse(JSON.stringify(plateaux[1].doc));
  sans.plateau.jetons = [];
  let courant = sans;
  const messages = [];
  const etat = {
    doc: () => courant,
    appliquer: (f) => { courant = f(courant); return { ok: true }; },
    signaler: (t, n) => messages.push([t, n])
  };
  const r = G.placerVilles(etat);
  assert.equal(r.ok, true);
  assert.equal(courant.plateau.jetons.filter((j) => j.type === 'capture').length, 6);
  assert.match(messages[0][0], /6 villes placées en trèfle/);
});

test('hex19 : placementsAdmissibles : les 220 dispositions symétriques sont filtrées par les ports et l’écart', () => {
  const sans = JSON.parse(JSON.stringify(plateaux[0].doc));
  sans.plateau.jetons = [];
  const ad = G.placementsAdmissibles(sans);
  assert.ok(ad.placements.length >= 1 && ad.placements.length < 220);
  assert.ok(ad.placements.some((p) => p.map((j) => j.i).join(',') === F.TREFLE.join(',')));
});

test('hex19 : bibliothèque sans bord : échec explicite', () => {
  const d = doc0();
  d.modeles = d.modeles.filter((m) => m.gabarit !== 'bord');
  const r = G.generer(d, { graine: 'sansbord' });
  assert.equal(r.ok, false);
  assert.match(r.raison, /Bibliothèque insuffisante/);
});

test('hex19 : boîte de dialogue : le formulaire se construit sans erreur et propose les dispositions variées', () => {
  const noeuds = [];
  const mk = (nom) => {
    const e = { nom, children: [], attrs: {}, className: '', listeners: {}, get firstChild() { return this.children[0] || null; },
      appendChild(c) { this.children.push(c); return c; }, removeChild(c) { this.children.splice(this.children.indexOf(c), 1); },
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, f) { this.listeners[k] = f; }, focus() {} };
    noeuds.push(e);
    return e;
  };
  const d = { createElement: mk };
  const cont = mk('conteneur');
  cont.ownerDocument = d;
  const etat = { doc: doc0, appliquer: () => ({ ok: true }), signaler: () => {} };
  const racine = G.remplir(cont, etat);
  assert.ok(racine.caseDispositions, 'case des dispositions variées');
  assert.equal(racine.caseVariees, null);
  assert.equal(racine.caseDispositions.checked, false);
  assert.ok(noeuds.some((n) => /hexagonal de 19 tuiles/.test(n.textContent || '')));
});

/* ============================ non-régression ============================ */

test('non-régression : le 4×4 et le 5×5 se génèrent comme avant (graine fixe, plateau valide, campements)', () => {
  const r4 = G.generer(CAT.nouveauDocument('4x4'), { graine: 'nr4', candidats: 20 });
  assert.ok(r4.ok, r4.raison);
  assert.equal(r4.doc.plateau.jetons.filter((j) => j.type === 'capture').length, 7);
  assert.ok(r4.rapport.some((t) => /jonctions variées/.test(t)));
  const r5 = G.generer(CAT.nouveauDocument('5x5'), { graine: 'nr5', candidats: 10 });
  assert.ok(r5.ok, r5.raison);
  assert.equal(r5.doc.plateau.jetons.filter((j) => j.type === 'capture').length, 8);
  assert.equal(r5.score.positionsParDefaut, true);
  assert.ok(!('disposition' in r5.score));
  assert.ok(!('stock_insuffisant' in r5.rejets));
  const p = G.meilleurPlacementVilles(r5.doc);
  assert.equal(p.ok, true);
});
