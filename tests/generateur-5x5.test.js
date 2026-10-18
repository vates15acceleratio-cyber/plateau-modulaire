'use strict';
/*
 * Tests du générateur 5×5 (src/generateur.js) pour le catalogue à 2 cases par tuile (docs/53 § 3, docs/55 ; décisions de docs/18
 * « 5×5 très connecté ») : composition par quotas (4 coins, 12 bords, 9 des 12 centrales du stock « B3 » : 2 LC1, 1 LC2, 3 LC3, 1 LC4, 2 LC5, 1 LC6, 2 LC7), placement des villes
 * AVANT l'orientation des centrales (aucune porteuse ne dessert deux villes, 2-3-2, écart de 3 cases contrôlé par villesProches),
 * orientation pour ce placement, rejets (plus de 5 % de cases à 2 connexions, jonction à moins de 2 ports, ville à moins de 3 ports,
 * écart, S >= 5, « 5 contre 2 »), préférences (chaîne, raccords morts, points d'articulation, S), mesures gardées (rythme, accès,
 * moitiés), aide « placer les villes », abandon sur bibliothèque impossible, vrais miroirs, bornes des options, PM.graphe.flancs,
 * empreintes du 4×4. Bibliothèque : le vrai catalogue 5×5 (PM.catalogue).
 */
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/controles.js');
require('../src/etat.js');
const PM = globalThis.PM;
const M = PM.modele, GEN = PM.generateur, GR = PM.graphe, CAT = PM.catalogue;

const NB_GRAINES = 200;
const doc5 = () => CAT.nouveauDocument('5x5');
const cle = (j) => j.i + ',' + j.j;
const copie = (x) => JSON.parse(JSON.stringify(x));
/** Nombre de tuiles posées par modèle. */
const composition = (doc) => { const n = {}; doc.plateau.tuiles.forEach((t) => { n[t.modeleId] = (n[t.modeleId] || 0) + 1; }); return n; };
/** Nombre de murs voulus rencontrés : 2 raccords en face des murs de « Deux ponts » (LC4) s'il est posé, aucun sinon. */
const mursAttendus = (doc) => (composition(doc).LC4 || 0) * 2;

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

/** Jonctions-cases (sans ville) à moins de 3 ports d'un plateau posé. */
function faibles(doc) {
  const villes = new Set(doc.plateau.jetons.map(cle)), p = GEN.portsParJonction(doc);
  let n = 0;
  p.forEach((x, y) => { if (!villes.has(((y % 4) + 1) + ',' + (Math.floor(y / 4) + 1)) && x < 3) n++; });
  return n;
}
/** Une case de tuile porte-t-elle deux villes (deux ports vers deux jonctions qui ont une ville) ? */
function porteuseDeDeuxVilles(doc) {
  const g = GR.construire(doc, { villesTraversables: false });
  return [...g.cases.keys()].some((id) => [...g.voisins.get(id)].filter((v) => g.villes.has(v)).length >= 2);
}

test('200 graines : plateau valide, 25 tuiles, 7 villes, compteurs à ok, aucune erreur ; aucune alerte ; les 2 murs de « Deux ponts » (s’il est posé) en information', () => {
  plateaux().forEach((r, k) => {
    const doc = r.doc, v = M.validerPlateau(doc);
    assert.strictEqual(doc.grille, '5x5');
    assert.strictEqual(doc.plateau.tuiles.length, 25, 'g5-' + k);
    assert.strictEqual(doc.plateau.jetons.length, 7, 'g5-' + k);
    assert.deepStrictEqual(v.erreurs, [], 'g5-' + k);
    assert.deepStrictEqual(v.alertes, [], 'g5-' + k);
    assert.deepStrictEqual(v.informations.map((a) => a.code), Array(mursAttendus(doc)).fill('raccord_mur'), 'g5-' + k); // les murs voulus de « Deux ponts » (docs/18)
    const c = PM.controles.calculer(doc);
    assert.deepStrictEqual(c.erreurs.map((e) => e.code), [], 'g5-' + k);
    assert.deepStrictEqual(c.alertes, [], 'g5-' + k);
    assert.deepStrictEqual(c.informations.map((e) => e.code), Array(mursAttendus(doc)).fill('raccord_mur'), 'g5-' + k);
    assert.deepStrictEqual(c.compteurs.filter((x) => x.etat !== 'ok').map((x) => x.cle), [], 'g5-' + k);
    assert.strictEqual(r.rejets.plateau_invalide, 0);
  });
});

test('200 graines : composition par quotas (4 LK2, 12 LB2, 9 centrales dans le stock, composition variée), 57 ou 58 cases, 46 ou 48 ports, moitiés égales', () => {
  const stock = Object.fromEntries(doc5().modeles.map((m) => [m.id, m.exemplaires]));
  const compositions = new Set();
  plateaux().forEach((r, k) => {
    const doc = r.doc, n = composition(doc);
    assert.strictEqual(n.LK2, 4, 'g5-' + k);
    assert.strictEqual(n.LB2, 12, 'g5-' + k);
    for (const id of Object.keys(n)) assert.ok(n[id] <= stock[id], 'g5-' + k + ' : ' + id + ' ' + n[id] + ' > ' + stock[id]); // montable avec la boîte
    const centrales = Object.keys(n).filter((id) => id.startsWith('LC')).reduce((s2, id) => s2 + n[id], 0);
    assert.strictEqual(centrales, 9, 'g5-' + k);
    compositions.add(Object.keys(n).sort().map((id) => id + n[id]).join(' '));
    doc.plateau.tuiles.forEach((t) => assert.ok(t.modeleId === (M.gabaritCellule(t.col, t.lig, '5x5') === 'coin' ? 'LK2' : M.gabaritCellule(t.col, t.lig, '5x5') === 'bord' ? 'LB2' : t.modeleId)));
    const cases = 59 - (n.LC5 || 0); // 2 cases par tuile, 1 pour LC5, 9 jonctions-cases
    assert.strictEqual(r.score.cases.total, cases, 'g5-' + k);
    assert.ok(cases >= 57 && cases <= 58, 'g5-' + k);
    assert.strictEqual(PM.controles.calculer(doc).compteurs.find((x) => x.cle === 'cases').valeur, cases);
    assert.strictEqual(GEN.portsParJonction(doc).reduce((a, b) => a + b, 0), n.LC4 ? 48 : 46, 'g5-' + k);
    const mo = GR.casesParMoitie(doc, GR.construire(doc));
    assert.strictEqual(mo.ecart, 0, 'g5-' + k + ' : ' + JSON.stringify(mo));
    assert.strictEqual(r.score.cases.ecart, 0);
  });
  assert.ok(compositions.size >= 10, 'compositions de centrales différentes : ' + compositions.size);
});

test('200 graines : moins de 5 % de cases à 2 connexions (rejet), au moins 3 connexions en moyenne ; score.connexions = PM.graphe.connexions', () => {
  let total = 0;
  plateaux().forEach((r, k) => {
    const cx = GR.connexions(r.doc);
    assert.ok(cx.conforme && cx.part < GR.PART_CONNEXIONS_MAX && cx.faibles <= 2, 'g5-' + k + ' : ' + cx.faibles + ' case(s) faibles');
    assert.strictEqual(cx.cases, 59 - (composition(r.doc).LC5 || 0));
    assert.ok(cx.degreMoyen >= 3.5, 'g5-' + k + ' : degré moyen ' + cx.degreMoyen);
    assert.deepStrictEqual(r.score.connexions, { cases: cx.cases, faibles: cx.faibles, part: cx.part, degreMoyen: cx.degreMoyen, parDegre: cx.parDegre });
    // les jonctions-cases à 2 ports sont des cases faibles ; une case de tuile peut l'être aussi (le plus souvent le relais de LC6 ou LC7 dont un raccord fait face à un mur de « Deux ponts », mesuré sur 100 plateaux : 21 cases de tuile faibles contre 99 jonctions-cases)
    assert.strictEqual(cx.jonctionsFaibles.length, faibles(r.doc), 'g5-' + k);
    assert.ok(cx.jonctionsFaibles.length <= cx.faibles, 'g5-' + k);
    total += cx.faibles;
  });
  assert.ok(total / NB_GRAINES < 1.5, 'moyenne de cases faibles : ' + total / NB_GRAINES);
});

test('200 graines : villes en 2-3-2 sur des jonctions à 3 ports, jonctions à 2 ports au moins, aucune porteuse ne dessert deux villes, villes à 4 pas au moins', () => {
  plateaux().forEach((r, k) => {
    const doc = r.doc, jetons = doc.plateau.jetons;
    const ligne = (j) => jetons.filter((x) => x.j === j).length;
    assert.deepStrictEqual([ligne(1), ligne(2) + ligne(3), ligne(4)], [2, 3, 2], 'g5-' + k + ' : ' + jetons.map(cle).join(' '));
    assert.strictEqual(new Set(jetons.map(cle)).size, 7);
    jetons.forEach((x) => assert.ok(M.portsJonction(doc, x.i, x.j).ports >= 3, 'g5-' + k + ' : ville (' + cle(x) + ')'));
    GEN.portsParJonction(doc).forEach((p, y) => assert.ok(p >= 2, 'g5-' + k + ' : jonction ' + y + ' à ' + p + ' port(s)'));
    assert.deepStrictEqual(M.jonctionsMalReliees(doc), []);
    assert.strictEqual(r.score.jonctionsAMoins2, 0);
    assert.strictEqual(porteuseDeDeuxVilles(doc), false, 'g5-' + k);
    const g = GR.construire(doc, { villesTraversables: false });
    assert.ok(GR.connexe(g));
    assert.deepStrictEqual(GR.villesProches(g), [], 'g5-' + k);
  });
});

test('200 graines : seuils d\'équilibre du 5×5 respectés (S < 5, aucun « 5 contre 2 », écart <= 2, première ville égale), mesure rapide identique à PM.graphe', () => {
  plateaux().forEach((r, k) => {
    const doc = r.doc, g = GR.construire(doc, { villesTraversables: false });
    const e = GR.equilibre(doc, { graphe: g });
    assert.deepStrictEqual(e.blocages, [], 'g5-' + k);
    assert.deepStrictEqual(e.alertes, [], 'g5-' + k + ' : ' + JSON.stringify(e.alertes));
    assert.ok(e.ecartMax7 <= GR.SEUIL_ECART && e.S < GR.SEUIL_S && e.premiereEgale && !e.cinqContreDeux, 'g5-' + k);
    assert.ok(e.complet);
    const m = GEN.mesureRapide(doc);
    assert.strictEqual(m.S, e.S, 'g5-' + k);
    assert.strictEqual(m.ecartMax, e.ecartMax7);
    assert.deepStrictEqual(m.partage, e.partage);
    assert.strictEqual(m.premiereEgale, e.premiereEgale);
    assert.strictEqual(r.score.S, e.S);
  });
});

test('200 graines : préférences et mesures gardées (chaîne, distance maximale, accès, articulations, raccords morts, placements admissibles)', () => {
  const chaines = [];
  plateaux().forEach((r, k) => {
    const g = GR.construire(r.doc), ry = GR.rythme(r.doc, g), ac = GR.accesCentre(r.doc, g, { sansFlot: true });
    assert.strictEqual(r.score.chaine, ry.chaineMax);
    assert.strictEqual(r.score.distMax, ry.distMax);
    assert.deepStrictEqual(r.score.acces, { vert: ac.portes.vert, rouge: ac.portes.rouge, ecart: ac.ecart });
    assert.strictEqual(r.score.raccordsMorts, 0, 'g5-' + k + ' : les deux murs de LC4 sont voulus, donc ne comptent pas');
    assert.strictEqual(M.raccordsMorts(r.doc).filter((x) => x.mur).length, mursAttendus(r.doc), 'g5-' + k);
    assert.strictEqual(r.score.articulations, GR.goulets(GR.construire(r.doc, { villesTraversables: false }), 1).articulations.length + GR.goulets(GR.construire(r.doc, { villesTraversables: false }), 2).articulations.length);
    assert.ok(r.score.placementsAdmissibles >= 1, 'g5-' + k);
    assert.strictEqual(r.score.placementsAdmissibles, GEN.placementsAdmissibles5x5(r.doc));
    // le placement rendu est l'un des placements admissibles du plateau
    const ad = GEN.placementsAdmissibles(r.doc).placements.map((pl) => pl.map(cle).join(' '));
    assert.ok(ad.includes(r.doc.plateau.jetons.map(cle).join(' ')), 'g5-' + k);
    chaines.push(ry.chaineMax);
  });
  // mesuré (6 candidats par graine) : chaîne de 3 à 6, distance maximale de 2 ou 3 ; la cible 3 n'est pas tenue partout (docs/56)
  assert.ok(Math.max(...chaines) <= 7, 'chaînes : ' + JSON.stringify(chaines));
  assert.ok(plateaux().filter((r) => r.score.articulations === 0).length >= NB_GRAINES * 0.9);
});

test('variété : plateaux distincts, et plusieurs dizaines de placements de villes différents sur 200 plateaux', () => {
  const profils = new Set(plateaux().map((r) => JSON.stringify(r.doc.plateau)));
  assert.ok(profils.size >= 195, 'plateaux distincts : ' + profils.size + ' / ' + NB_GRAINES);
  const placements = new Set(plateaux().map((r) => r.doc.plateau.jetons.map(cle).join(' ')));
  assert.ok(placements.size >= 30, 'placements différents : ' + placements.size);
});

test('orientation pour les villes : aucune rotation d\'une seule centrale ne fait moins de jonctions-cases à 2 ports sans enfreindre une condition ferme', () => {
  const ctx = GEN.contexteDocument5x5(doc5());
  let alternatives = 0, pires = 0;
  for (let k = 0; k < 40; k++) {
    const t = GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(1000 + k));
    if (t.cause) continue;
    const doc = Object.assign(doc5(), { plateau: { tuiles: t.tuiles, jetons: t.jetons } });
    const ref = faibles(doc);
    assert.strictEqual(ref, t.faibles, 'tirage ' + k);
    assert.strictEqual(porteuseDeDeuxVilles(doc), false);
    doc.plateau.tuiles.forEach((x, n) => {
      if (M.gabaritCellule(x.col, x.lig, '5x5') !== 'centrale') return;
      for (let rot = 0; rot < 4; rot++) {
        if (rot === x.rot) continue;
        const d = copie(doc);
        d.plateau.tuiles[n].rot = rot;
        const p = GEN.portsParJonction(d), villes = new Set(d.plateau.jetons.map((j) => (j.j - 1) * 4 + j.i - 1));
        const permis = p.every((v, y) => v >= 2 && (!villes.has(y) || v >= 3)) && !porteuseDeDeuxVilles(d);
        alternatives++;
        if (permis) assert.ok(faibles(d) >= ref, 'tirage ' + k + ' : centrale (' + x.col + ',' + x.lig + ') tournée de ' + rot);
        else pires++;
      }
    });
  }
  assert.ok(pires > alternatives / 3, pires + ' rotations interdites sur ' + alternatives);
});

test('orientation : des centrales tournées au hasard enfreignent presque toujours une condition ferme (le choix de rotation est utile)', () => {
  const rng = GEN.mulberry32(GEN.hacher('hasard'));
  let mauvais = 0;
  plateaux().slice(0, 60).forEach((r) => {
    const d = copie(r.doc);
    d.plateau.tuiles.forEach((t) => { if (M.gabaritCellule(t.col, t.lig, '5x5') === 'centrale') t.rot = Math.floor(rng() * 4); });
    const p = GEN.portsParJonction(d), villes = new Set(d.plateau.jetons.map((j) => (j.j - 1) * 4 + j.i - 1));
    if (!p.every((v, y) => v >= 2 && (!villes.has(y) || v >= 3)) || porteuseDeDeuxVilles(d)) mauvais++;
  });
  assert.ok(mauvais > 45, mauvais + ' / 60 plateaux à rotations aléatoires enfreignent une condition ferme');
});

test('placements compatibles : calcul par masques identique à optionsPermises (chaque cellule garde une option, ports possibles)', () => {
  const ctx = GEN.contexteDocument5x5(doc5()), rng = GEN.mulberry32(9);
  for (let k = 0; k < 5; k++) {
    const comp = GEN.composer5x5(ctx, rng), compat = GEN.placementsCompatibles(ctx, comp.options);
    const attendus = ctx.placements.filter((pl) => {
      const villes = new Array(16).fill(0); pl.indices.forEach((x) => { villes[x] = 1; });
      const ok = comp.options.every((l) => l.some((o) => o.groupes.every((g) => g.filter((x) => villes[x]).length < 2)));
      if (!ok) return false;
      const pot = new Array(16).fill(0);
      comp.options.forEach((l) => { const u = new Set(); l.filter((o) => o.groupes.every((g) => g.filter((x) => villes[x]).length < 2)).forEach((o) => o.jn.forEach((y) => u.add(y))); u.forEach((y) => pot[y]++); });
      return pot.every((v, y) => v >= 2 && (!villes[y] || v >= 3));
    });
    assert.deepStrictEqual(compat.map((c) => c.pl.indices.join()), attendus.map((pl) => pl.indices.join()), 'composition ' + k);
    assert.ok(compat.length > 10, compat.length + ' placements compatibles');
  }
});

test('outils de mesure : tirages orientés (villes d\'abord) sans ville posée, rejets du générateur par cause', () => {
  const MES = require('../outils/mesures-equilibre.js');
  const r = MES.tirerPlateaux5x5(20, 3);
  assert.strictEqual(r.entrees.length + r.sansOrientation, 20);
  assert.ok(r.entrees.every((e) => e.doc.plateau.tuiles.length === 25 && e.doc.plateau.jetons.length === 0 && e.villes.length === 7));
  assert.strictEqual(r.generateur.essais, 20);
  assert.ok(r.generateur.acceptes >= 10, JSON.stringify(r.generateur));
});

test('reproductibilité : même graine, même plateau et mêmes compteurs', () => {
  for (const graine of ['abc', 42, 'g5-7']) {
    const a = GEN.generer(doc5(), { graine, candidats: 15 }), b = GEN.generer(doc5(), { graine, candidats: 15 });
    assert.ok(a.ok, a.raison);
    assert.deepStrictEqual(a.doc, b.doc);
    assert.deepStrictEqual(a.rejets, b.rejets);
    assert.strictEqual(a.essais, b.essais);
  }
});

test('tirage par quotas : les poids fixent la composition ; d\'autres poids donnent d\'autres compositions, au plus près des proportions', () => {
  const ctx = GEN.contexteDocument5x5(doc5()), rng = GEN.mulberry32(3);
  const compte = (ids) => { const n = {}; ids.forEach((id, k) => { if (ctx.cellules[k].gabarit === 'centrale') n[id] = (n[id] || 0) + 1; }); return n; };
  // poids = exemplaires du stock « B3 » (12 centrales pour 9 places) : chaque modèle au plus près de 9 × poids / 12 (arrondi par défaut ou par excès)
  const poids = { LC1: 2, LC2: 1, LC3: 3, LC4: 1, LC5: 2, LC6: 1, LC7: 2 }, vues = new Set();
  for (let k = 0; k < 40; k++) {
    const n = compte(GEN.composer5x5(ctx, rng).ids);
    assert.strictEqual(Object.values(n).reduce((a, b) => a + b, 0), 9);
    for (const id of Object.keys(poids)) {
      const v = 9 * poids[id] / 12, nb = n[id] || 0;
      assert.ok(nb >= Math.floor(v) && nb <= Math.ceil(v) && nb <= poids[id], id + ' : ' + nb + ' pour ' + v + ' ' + JSON.stringify(n));
    }
    vues.add(JSON.stringify(n));
  }
  assert.ok(vues.size >= 10, 'compositions de centrales différentes : ' + vues.size);
  // poids 1 pour les 7 modèles : 9 centrales = 1 de chaque + 2 tirées au hasard
  const d = doc5(); d.modeles.forEach((m) => { if (m.gabarit === 'centrale') m.poids = 1; });
  const ctx2 = GEN.contexteDocument5x5(d), vus = new Set();
  for (let k = 0; k < 20; k++) {
    const n = compte.call(null, GEN.composer5x5(ctx2, rng).ids.map((x) => x));
    const v = Object.values(n).sort();
    assert.deepStrictEqual(v, [1, 1, 1, 1, 1, 2, 2], JSON.stringify(n));
    vus.add(JSON.stringify(n));
  }
  assert.ok(vus.size >= 3, 'le reste est tiré au hasard');
});

test('bibliothèque trop pauvre ou ancienne : rejet explicite, abandon après 25 échecs consécutifs, conseil du catalogue livré, sans geler', () => {
  const t0 = Date.now();
  // centrales à un seul port : aucun placement des villes à 3 ports
  const maigre = doc5();
  maigre.modeles = maigre.modeles.filter((m) => m.gabarit !== 'centrale' || m.id === 'LC1');
  const lc1 = maigre.modeles.find((m) => m.id === 'LC1');
  lc1.chemins = lc1.chemins.filter((c) => c.id !== 'p2');
  assert.ok(M.validerModele(lc1, '5x5').complet);
  const q = GEN.generer(maigre, { graine: 'maigre' });
  assert.strictEqual(q.ok, false);
  assert.strictEqual(q.essais, 25);
  assert.match(q.raison, /Abandon après 25 échecs consécutifs/);
  assert.match(q.raison, /Le catalogue 5×5 livré/);
  // catalogue de la 4.00.0 gardé tel quel (« Garder mes tuiles ») : plus de 5 % de cases à 2 connexions, abandon expliqué
  const ancien = doc5(); ancien.modeles = copie(CAT.precedents['5x5'][1].modeles);
  const a = GEN.generer(ancien, { graine: 'ancien' });
  assert.strictEqual(a.ok, false);
  assert.strictEqual(a.essais, 25);
  assert.ok(a.rejets.connexions > 0, JSON.stringify(a.rejets));
  assert.match(a.raison, /2 connexions ou moins/);
  assert.match(a.raison, /Charger le nouveau catalogue/);
  // catalogue 3.04 : même abandon, même conseil
  const v304 = doc5(); v304.modeles = copie(CAT.precedent['5x5']);
  const b = GEN.generer(v304, { graine: 'v304' });
  assert.strictEqual(b.ok, false);
  assert.match(b.raison, /Abandon après 25 échecs consécutifs.*Le catalogue 5×5 livré/);
  assert.ok(Date.now() - t0 < 8000, 'abandons rapides : ' + (Date.now() - t0) + ' ms');
});

test('bibliothèque modifiée : sans « Deux ponts » (46 ports), les plateaux restent conformes mais ont 2 jonctions à 2 ports au moins', () => {
  const d = doc5(); d.modeles = d.modeles.filter((m) => m.id !== 'LC4');
  for (let k = 0; k < 4; k++) {
    const r = GEN.generer(d, { graine: 'sans-lc4-' + k, candidats: 10 });
    assert.ok(r.ok, r.raison);
    assert.strictEqual(GEN.portsParJonction(r.doc).reduce((a, b) => a + b, 0), 46);
    assert.strictEqual(r.score.connexions.faibles, 2);
    assert.strictEqual(r.score.raccordsMorts, 0);
  }
});

test('taux de rejet par cause et temps (200 candidats) sur le catalogue 5×5', () => {
  const t0 = Date.now();
  const r = GEN.generer(doc5(), { graine: 'chrono-5x5' });
  const ms = Date.now() - t0;
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.candidats, 200);
  assert.ok(ms < 6000, ms + ' ms');
  const rej = {}; let essais = 0, acceptes = 0;
  for (let k = 0; k < 200; k++) {
    const x = GEN.generer(doc5(), { graine: 'taux-' + k, candidats: 1, essaisMax: 1 });
    essais += x.essais;
    if (x.ok) acceptes++;
    Object.keys(x.rejets).forEach((c) => { rej[c] = (rej[c] || 0) + x.rejets[c]; });
  }
  console.log(`# 5×5 : 200 candidats en ${ms} ms (${r.essais} essais) ; ${acceptes}/${essais} candidats acceptés ; rejets : ${JSON.stringify(rej)}`);
  assert.ok(acceptes >= essais * 0.5, 'taux d\'acceptation : ' + acceptes + ' / ' + essais); // ≈ 63 % avec le stock « B3 » (rejets « villes_ports » surtout) ; 100 % des plateaux sont réussis
  assert.strictEqual(rej.plateau_invalide, 0);
  assert.strictEqual(rej.connexite, 0);
  assert.strictEqual(rej.connexions, 0, 'le catalogue livré ne laisse jamais plus de 5 % de cases faibles après orientation');
  assert.strictEqual(rej.cases_moities, 0);
});

test('abandon : le catalogue normal n\'est pas touché (aucun abandon, aucune recherche interrompue)', () => {
  for (let k = 0; k < 40; k++) {
    const r = GEN.generer(doc5(), { graine: 'ab-' + k, candidats: 3 });
    assert.ok(r.ok, r.raison);
    assert.strictEqual(r.score.orientationsTronquees, 0);
  }
});

test('vrais miroirs (bibliothèque du catalogue 3.04) : B7 <-> B7m seulement ; un bord de même taille mais de forme différente n\'est pas substitué', () => {
  const docPrec = () => { const d = M.nouveauDocument('5x5'); d.modeles = copie(CAT.precedent['5x5']); return d; };
  const F = PM.geometrie.format('5x5'), cat = docPrec().modeles, id = (x) => cat.find((m) => m.id === x);
  assert.strictEqual(GEN.sontMiroirs(id('B7'), id('B7m'), F), true);
  assert.strictEqual(GEN.sontMiroirs(id('B7m'), id('B7'), F), true);
  assert.strictEqual(GEN.sontMiroirs(id('B7'), id('B7'), F), false);
  assert.strictEqual(GEN.sontMiroirs(id('B1'), id('B1'), F), true, 'B1 est symétrique');
  assert.strictEqual(GEN.sontMiroirs(id('B1'), id('B7'), F), false);
  const b7x = copie(id('B7')); b7x.id = 'B7x';
  b7x.cases.find((c) => c.type === 'apparition').x = 40;
  assert.strictEqual(GEN.sontMiroirs(id('B7'), b7x, F), false);
  const b7y = copie(id('B7m')); b7y.id = 'B7y';
  b7y.cases.find((c) => c.type === 'apparition').y = 30;
  assert.strictEqual(GEN.sontMiroirs(id('B7'), b7y, F), false);
  // composition : une cellule tirée B7 peut prendre son vrai miroir B7m, jamais B7y
  const doc = docPrec(); b7y.exemplaires = 4; doc.modeles.push(b7y);
  const ctx = GEN.contexteDocument5x5(doc), rng = GEN.mulberry32(4);
  let vuB7m = false;
  for (let k = 0; k < 20; k++) {
    const c = GEN.composer5x5(ctx, rng);
    c.ids.forEach((x, n) => {
      if (x !== 'B7') return;
      const ids = new Set(c.options[n].map((o) => o.modeleId));
      assert.ok(!ids.has('B7y'), 'B7y proposé pour un B7');
      if (ids.has('B7m')) vuB7m = true;
    });
  }
  assert.ok(vuB7m, 'le vrai miroir B7m reste permis');
});

/* ---------- aide « placer les villes » ---------- */

test('aide « placer les villes » : meilleur placement admissible (2-3-2, 3 ports, 4 pas, équilibre) d\'un plateau généré, au plus petit S', () => {
  plateaux().slice(0, 30).forEach((r, k) => {
    const sans = copie(r.doc); sans.plateau.jetons = [];
    const p = GEN.meilleurPlacementVilles(sans);
    assert.ok(p.ok, 'g5-' + k + ' : ' + p.raison);
    assert.strictEqual(p.jetons.length, 7);
    assert.strictEqual(p.admissibles, r.score.placementsAdmissibles);
    const d = copie(sans); d.plateau.jetons = p.jetons;
    const g = GR.construire(d, { villesTraversables: false }), e = GR.equilibre(d, { graphe: g });
    assert.deepStrictEqual(GR.villesProches(g), []);
    assert.ok(p.jetons.every((j) => M.portsJonction(d, j.i, j.j).ports >= 3));
    assert.strictEqual(e.S, p.S);
    assert.ok(p.S <= r.score.S, 'g5-' + k + ' : le meilleur S vaut au plus celui du générateur');
    assert.ok(e.premiereEgale && !e.cinqContreDeux && e.ecartMax7 <= 2);
    // les villes déjà posées sont ignorées : même résultat
    assert.deepStrictEqual(GEN.meilleurPlacementVilles(r.doc).jetons, p.jetons);
  });
});

test('aide « placer les villes » : refus expliqués (plateau incomplet, aucun placement admissible) ; 4×4 aussi', () => {
  const vide = GEN.meilleurPlacementVilles(doc5());
  assert.strictEqual(vide.ok, false);
  assert.match(vide.raison, /Posez d’abord toutes les tuiles du plateau \(0 sur 25\)/);
  // toutes les centrales tournées pour que leur porteuse soit au nord : aucun placement admissible
  const d = copie(plateaux()[0].doc); d.plateau.jetons = [];
  d.plateau.tuiles.forEach((t) => { if (M.gabaritCellule(t.col, t.lig, '5x5') === 'centrale') t.rot = 0; });
  const r = GEN.meilleurPlacementVilles(d);
  assert.strictEqual(r.ok, false);
  assert.match(r.raison, /Aucun placement des 7 villes \(en 2-3-2, sur des jonctions à 3 ports au moins, à 3 cases d’écart au moins\)/);
  assert.strictEqual(GEN.placementsAdmissibles5x5(d), 0);
  // 4×4 : placements complémentaires des 12 paires équilibrées, sans condition de ports
  const g4 = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'aide-4x4', candidats: 5 });
  const s4 = copie(g4.doc); s4.plateau.jetons = [];
  const p4 = GEN.meilleurPlacementVilles(s4);
  assert.ok(p4.ok, p4.raison);
  assert.strictEqual(p4.jetons.length, 7);
  assert.ok(p4.admissibles >= 1 && p4.admissibles <= 12);
});

test('aide « placer les villes » à l\'état : pose en une étape d\'historique (Ctrl+Z), refus dans la barre d\'état sans changer le document', () => {
  const d = copie(plateaux()[1].doc); d.plateau.jetons = [{ i: 1, j: 1, type: 'capture' }];
  const etat = PM.etat.creer(d);
  const r = GEN.placerVilles(etat);
  assert.ok(r.ok, r.raison);
  assert.deepStrictEqual(etat.doc().plateau.jetons, r.jetons);
  assert.match(etat.ui().message.texte, /7 villes placées au meilleur placement \(S = \d+, parmi \d+ placement\(s\) équilibré\(s\) sur \d+ admissible\(s\)\)\. Ctrl\+Z pour revenir\./);
  etat.annuler();
  assert.deepStrictEqual(etat.doc().plateau.jetons, [{ i: 1, j: 1, type: 'capture' }]);
  const etat2 = PM.etat.creer(doc5()), avant = JSON.stringify(etat2.doc());
  const refus = GEN.placerVilles(etat2);
  assert.strictEqual(refus.ok, false);
  assert.strictEqual(JSON.stringify(etat2.doc()), avant);
  assert.strictEqual(etat2.ui().message.niveau, 'alerte');
  assert.strictEqual(etat2.peutAnnuler(), false);
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

/* ---------- options, flancs, constantes, budget ---------- */

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

test('budget de nœuds : une recherche d’orientation interrompue est signalée (tronque)', () => {
  const ctx = GEN.contexteDocument5x5(doc5());
  let graine = 1;
  while (GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(graine)).cause) graine++; // un tirage dont le placement s'oriente
  const t = GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(graine));
  assert.strictEqual(t.tronque, false);
  assert.ok(t.noeuds > 40, String(t.noeuds));
  ctx.budgetNoeuds = 40;
  assert.strictEqual(GEN.tuilesOrientees5x5(ctx, GEN.mulberry32(graine)).tronque, true);
});

/* ---------- 4×4 : empreintes ---------- */

// Empreintes du générateur 4×4 depuis le branchement des catalogues « centrales ouvertes » (docs/46 : cases égales entre moitiés,
// centrales orientées selon les ports, affinage du rythme ; graines 'emp-0' à 'emp-19', 60 candidats, mode par défaut puis « variées »,
// puis la graine 'defaut' à 200 candidats avec son rapport). Elles ne changent que si le 4×4 est volontairement modifié (les empreintes
// d'avant, docs/34, valaient pour le catalogue et le générateur de la version 3.04). Recalculées le 2026-10-18 : toute jonction est une
// zone d'intérêt du rythme (docs/18), donc l'affinage du rythme et le classement des finalistes du 4×4 changent.
const EMPREINTES_4X4 = [
  'c7b84c04d8', 'c67f70b22a', 'bc9804d8fb', '49ec6c1763', 'd1b58d23aa', 'b849b7208e', '10915156ee', 'd0cb277dce', 'd850a1b869', '7203f8f526',
  'a4da801b19', '47ecc07d80', 'cbc169bf66', '6798312960', '2ed6de112a', 'd574c6c673', '8ee3208ef5', 'eafac54e7c', '2b03155fa7', '0d333266b7',
  '928c4975b9', '2ba53d56ce', '304b762f96', '3a5e15c89d', '35418b6859', '648c604e4d', '942ad45295', '080d881eee', 'e32517cdfd', '417f823d3a',
  'd2a6e5b9ce', 'efcf47b9e5', 'beb2734d92', '00eb11f779', '20d23f4d46', '5d1db830e2', '0813f4b905', '98c08d3a59', 'cbb8d5229d', 'eaeeb65ec2',
  'a73459917d'
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
