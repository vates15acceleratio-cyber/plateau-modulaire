'use strict';
/*
 * Tests des mesures « organiques » de src/graphe.js (docs/18, docs/44, docs/45, docs/46) : réseaux de passages, rythme (mesure stricte,
 * raccourci compté comme zone d'intérêt), équilibre des accès au centre, cases par moitié ; et des étapes du générateur qui s'en servent
 * (cases égales entre moitiés, orientation 4×4, affinage du rythme). Les mesures sont comparées à des oracles écrits ici sans PM.graphe.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/catalogue.js');
require('../src/generateur.js');
require('../src/equilibre.js');
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, GR = PM.graphe, GEN = PM.generateur, CAT = PM.catalogue;
const copie = (o) => JSON.parse(JSON.stringify(o));

/** Plateaux du générateur (villes posées), calculés une fois par format. */
const CACHE = {};
function plateaux(g) {
  if (!CACHE[g]) {
    CACHE[g] = [];
    for (let k = 0; k < 30; k++) {
      const r = GEN.generer(CAT.nouveauDocument(g), { graine: 'org-' + g + '-' + k, candidats: 8 });
      assert.ok(r.ok, r.raison);
      CACHE[g].push(r.doc);
    }
  }
  return CACHE[g];
}

/* ---------------------------- oracles ---------------------------- */

/** Parcours en largeur : `bloque(x)` empêche de repartir de x (sauf la source). */
function bfs(g, source, bloque) {
  const d = new Map([[source, 0]]), file = [source];
  for (let q = 0; q < file.length; q++) {
    const x = file[q];
    if (x !== source && bloque(x)) continue;
    for (const y of g.voisins.get(x)) if (!d.has(y)) { d.set(y, d.get(x) + 1); file.push(y); }
  }
  return d;
}

/** Zones d'intérêt écrites sans PM.graphe.rythme : villes, cases des réseaux de passages économes de 2 cases ou plus, raccourcis. */
function zonesOracle(doc, g) {
  const z = new Set(g.villes);
  GR.reseauxPassages(doc).economes.forEach((s) => { if (s.size >= 2) s.forEach((id) => z.add(id)); });
  const tuile = (id) => id.split(':')[0];
  g.cases.forEach((c, id) => {
    if (c.type !== 'apparition') return;
    for (const w of g.voisins.get(id)) if (g.cases.has(w) && g.cases.get(w).type === 'apparition' && tuile(w) !== tuile(id)) { z.add(id); z.add(w); }
  });
  return z;
}

/** Plus longue chaîne (oracle) : pour chaque paire de zones, plus court chemin (villes non traversables) qu'aucune autre zone n'interrompt. */
function chaineOracle(g, zones) {
  let max = 0;
  for (const a of zones) {
    const dVilles = bfs(g, a, (x) => g.villes.has(x)), dZones = bfs(g, a, (x) => zones.has(x));
    for (const b of zones) {
      if (b === a || !dZones.has(b) || dZones.get(b) !== dVilles.get(b)) continue;
      max = Math.max(max, dZones.get(b) - 1);
    }
  }
  return max;
}

/* ---------------------------- réseaux de passages ---------------------------- */

test('réseaux de passages : un virage raccord–raccord est économe, un crochet raccord -> case ne l\'est pas ; les cases ne fondent pas deux réseaux', () => {
  const doc = CAT.nouveauDocument('4x4'), F = G.format('4x4');
  // Q1 en (1,1) : virage sans case S–O ; B1 en (0,1) (raccord vers l'est) et Q2 en (1,2) (raccord nord sur son relais) s'y rattachent
  doc.plateau.tuiles = [
    { modeleId: 'Q1', col: 1, lig: 1, rot: 0 },
    { modeleId: 'B1', col: 0, lig: 1, rot: M.rotationDeduite(0, 1, 'bord', F) },
    { modeleId: 'Q2', col: 1, lig: 2, rot: 0 }
  ];
  const rs = GR.reseauxPassages(doc);
  const groupe = (id) => rs.groupes.find((s) => s.has(id));
  assert.deepEqual([...groupe('0,1:a')].sort(), ['0,1:a', '1,2:r']);
  assert.ok(rs.economes.includes(groupe('0,1:a')), 'le virage de Q1 économise un pas');
  // le crochet de Q2 (raccord O -> relais) seul : réseau non économe
  const g = GR.construire(doc, { jetons: [] });
  assert.ok(g.voisins.get('0,1:a').has('1,2:r'), 'cases reliées par le virage : voisines (1 pas)');
  const seul = CAT.nouveauDocument('4x4');
  seul.plateau.tuiles = [{ modeleId: 'Q2', col: 1, lig: 1, rot: 0 }, { modeleId: 'B1', col: 0, lig: 1, rot: M.rotationDeduite(0, 1, 'bord', F) }];
  const rs2 = GR.reseauxPassages(seul);
  assert.equal(rs2.groupes.length, 1);
  assert.equal(rs2.economes.length, 0, 'un crochet vaut un chemin ordinaire');
  // sans passage : rien
  assert.deepEqual(GR.reseauxPassages(PM.aidesV2 ? PM.aidesV2.plateauComplet('4x4') : require('./aides-v2.js').plateauComplet('4x4')).groupes, []);
});

/* ---------------------------- rythme ---------------------------- */

test('rythme : zones = villes, passages économes et raccourcis ; chaîne et distance maximale égales à un oracle (4×4 et 5×5)', () => {
  for (const g0 of ['4x4', '5x5']) {
    for (const doc of plateaux(g0)) {
      const g = GR.construire(doc), r = GR.rythme(doc, g), z = zonesOracle(doc, g);
      assert.equal(r.zones, z.size);
      assert.equal(r.chaineMax, chaineOracle(g, z), g0);
      // distance maximale : parcours depuis toutes les zones
      const d = new Map(), file = [];
      z.forEach((x) => { d.set(x, 0); file.push(x); });
      for (let q = 0; q < file.length; q++) for (const y of g.voisins.get(file[q])) if (!d.has(y)) { d.set(y, d.get(file[q]) + 1); file.push(y); }
      assert.equal(r.distMax, Math.max(...g.noeuds.filter((id) => !z.has(id)).map((id) => d.get(id))));
      // la chaîne rendue est un vrai chemin du graphe, d'une zone à une zone, sans zone au milieu
      if (r.chaineMax) {
        assert.equal(r.chaine.length, r.chaineMax + 2);
        assert.ok(z.has(r.chaine[0]) && z.has(r.chaine[r.chaine.length - 1]));
        r.chaine.slice(1, -1).forEach((id) => assert.ok(!z.has(id)));
        for (let k = 1; k < r.chaine.length; k++) assert.ok(g.voisins.get(r.chaine[k - 1]).has(r.chaine[k]));
      }
    }
  }
});

test('rythme : le raccourci compte comme zone d\'intérêt (docs/18, réponse 3) : toutes les apparitions du pourtour, option sansRaccourci pour comparer', () => {
  for (const [g0, n] of [['4x4', 12], ['5x5', 16]]) {
    for (const doc of plateaux(g0).slice(0, 10)) {
      const g = GR.construire(doc), r = GR.rythme(doc, g), s = GR.rythme(doc, g, { sansRaccourci: true });
      assert.equal(GR.casesRaccourci(g).size, n, 'toutes les apparitions sont reliées en anneau par les raccourcis');
      assert.equal(r.casesRaccourci.length, n);
      assert.ok(r.casesRaccourci.every((id) => g.cases.get(id).type === 'apparition'));
      assert.equal(s.casesRaccourci.length, 0);
      assert.ok(r.zones > s.zones);
      // l'ancienne mesure « large » compte tout réseau de passages de 2 cases ou plus
      assert.ok(GR.rythme(doc, g, { large: true }).zones >= r.zones);
    }
  }
});

test('rythme : témoin, sans passage ni raccourci la chaîne s\'allonge (plateau des exemples, villes seules)', () => {
  const AV2 = require('./aides-v2.js');
  const doc = AV2.plateauComplet('4x4', true), g = GR.construire(doc);
  const r = GR.rythme(doc, g, { sansRaccourci: true }), z = new Set(g.villes);
  assert.equal(r.zones, 7);
  assert.equal(r.chaineMax, chaineOracle(g, z));
  assert.ok(GR.rythme(doc, g).chaineMax <= r.chaineMax, 'ajouter les raccourcis ne rallonge pas la chaîne ici');
});

/* ---------------------------- accès au centre ---------------------------- */

test('accès au centre : portes = arêtes camp–milieu (oracle), contacts vert–rouge à part, chemins indépendants bornés par les portes', () => {
  for (const g0 of ['4x4', '5x5']) {
    const F = G.format(g0), N = F.GRILLE.lignes, demi = Math.floor(N / 2);
    const zone = (id) => {
      const m = /^J(\d+),(\d+)$/.exec(id);
      if (m) return +m[2] < demi ? 'vert' : (+m[2] > N - demi ? 'rouge' : 'milieu');
      const [col, lig] = id.split(':')[0].split(',').map(Number);
      return lig < demi ? 'vert' : (lig > N - 1 - demi ? 'rouge' : 'milieu');
    };
    for (const doc of plateaux(g0)) {
      const g = GR.construire(doc), a = GR.accesCentre(doc, g);
      const o = { vert: 0, rouge: 0 }; let contacts = 0;
      for (const x of g.noeuds) for (const y of g.voisins.get(x)) {
        if (x >= y) continue;
        const zx = zone(x), zy = zone(y);
        if (zx === zy) continue;
        if (zx === 'milieu') o[zy]++; else if (zy === 'milieu') o[zx]++; else contacts++;
      }
      assert.deepEqual(a.portes, o, g0);
      assert.equal(a.ecart, o.vert - o.rouge);
      assert.equal(a.contacts, contacts);
      assert.ok(a.chemins.vert >= 1 && a.chemins.vert <= o.vert && a.chemins.rouge >= 1 && a.chemins.rouge <= o.rouge);
      assert.equal(a.ecartChemins, a.chemins.vert - a.chemins.rouge);
      assert.deepEqual(GR.accesCentre(doc, g, { sansFlot: true }).portes, a.portes);
      assert.ok(!('chemins' in GR.accesCentre(doc, g, { sansFlot: true })));
    }
  }
});

test('accès au centre : un plateau symétrique par demi-tour a un écart nul ; 4×4 : le milieu est la rangée j = 2, 5×5 : la rangée neutre et j = 2, 3', () => {
  for (const g0 of ['4x4', '5x5']) {
    const F = G.format(g0), N = F.GRILLE.lignes, doc = copie(plateaux(g0)[0]);
    // moitié sud = moitié nord tournée de 180° (centrale du milieu du 5×5 : P5, symétrique par demi-tour)
    const t = (c, l) => doc.plateau.tuiles.find((x) => x.col === c && x.lig === l);
    doc.plateau.tuiles.forEach((x) => {
      const p = t(N - 1 - x.col, N - 1 - x.lig);
      if (x.lig < (N - 1) / 2 || (x.lig === (N - 1) / 2 && x.col < (N - 1) / 2)) { p.modeleId = x.modeleId; p.rot = (x.rot + 2) % 4; }
    });
    if (g0 === '5x5') t(2, 2).modeleId = 'P5';
    doc.plateau.jetons = [];
    const g = GR.construire(doc, { jetons: [] }), a = GR.accesCentre(doc, g);
    assert.equal(a.ecart, 0, g0 + ' : ' + JSON.stringify(a));
    assert.equal(a.ecartChemins, 0);
    assert.equal(GR.casesParMoitie(doc, g).ecart, 0);
  }
  assert.equal(GR.zoneDuNoeud('J1,2', G.format('4x4')), 'milieu');
  assert.equal(GR.zoneDuNoeud('J1,1', G.format('4x4')), 'vert');
  assert.equal(GR.zoneDuNoeud('J3,3', G.format('4x4')), 'rouge');
  assert.deepEqual([1, 2, 3, 4].map((j) => GR.zoneDuNoeud('J1,' + j, G.format('5x5'))), ['vert', 'milieu', 'milieu', 'rouge']);
  assert.equal(GR.zoneDuNoeud('2,2:r', G.format('5x5')), 'milieu');
  assert.equal(GR.zoneDuNoeud('0,1:a', G.format('5x5')), 'vert');
});

/* ---------------------------- cases par moitié ---------------------------- */

test('cases par moitié : somme = cases du plateau ; égales sur les plateaux du générateur ; témoin, un modèle plus riche côté vert fait +1', () => {
  for (const g0 of ['4x4', '5x5']) {
    for (const doc of plateaux(g0)) {
      const g = GR.construire(doc), mo = GR.casesParMoitie(doc, g);
      const jc = g.jonctions.filter((j) => j.type === 'case').length;
      assert.equal(mo.tuiles.vert + mo.tuiles.rouge + mo.tuiles.neutre, g.cases.size);
      assert.equal(mo.jonctions.vert + mo.jonctions.rouge + mo.jonctions.milieu, jc);
      assert.equal(mo.ecart, 0, g0);
      if (g0 === '4x4') assert.equal(mo.tuiles.neutre, 0);
      else assert.ok(mo.tuiles.neutre > 0);
    }
  }
  const doc = copie(plateaux('4x4')[0]), b = doc.plateau.tuiles.find((t) => t.col === 1 && t.lig === 0);
  const avant = GR.casesParMoitie(doc, GR.construire(doc)).ecart;
  const plus = doc.modeles.find((m) => m.gabarit === 'bord' && m.cases.length === M.modeleParId(doc, b.modeleId).cases.length + 1)
    || doc.modeles.find((m) => m.gabarit === 'bord' && m.cases.length === M.modeleParId(doc, b.modeleId).cases.length - 1);
  const delta = plus.cases.length - M.modeleParId(doc, b.modeleId).cases.length;
  b.modeleId = plus.id;
  assert.equal(GR.casesParMoitie(doc, GR.construire(doc)).ecart, avant + delta);
});

/* ---------------------------- générateur ---------------------------- */

test('equilibrerMoities : échanges d\'abord (composition gardée), remplacement au poids sinon ; impossible sans remplaçant', () => {
  const F = G.format('4x4'), cellules = GEN.cellulesDuFormat(F);
  const nb = { A: 3, B: 5, C: 4, X: 4, Y: 4 };
  const tuiles = () => cellules.map((c) => ({ modeleId: c.gabarit === 'coin' ? 'A' : (c.gabarit === 'bord' ? 'X' : 'Y'), col: c.col, lig: c.lig, rot: 0 }));
  // échange : un B (5 cases) côté vert, aucun côté rouge -> un échange vert / rouge le corrige-t-il ? 5 + 3 contre 3 + 3 : écart 2, un
  // échange déplace l'écart de 2 x 2 : -2. Impossible par échanges ; un remplacant C (4 cases) le corrige
  const t1 = tuiles(); t1.find((t) => t.col === 0 && t.lig === 0).modeleId = 'B';
  assert.equal(GEN.ecartMoities(t1, F, nb), 2);
  assert.equal(GEN.equilibrerMoities(copie(t1), cellules, F, nb, GEN.mulberry32(1), null), false, 'aucun remplaçant : échec');
  const t2 = copie(t1);
  assert.equal(GEN.equilibrerMoities(t2, cellules, F, nb, GEN.mulberry32(1), (t) => (t.modeleId === 'A' || t.modeleId === 'B') ? ['A', 'B', 'C'].filter((x) => x !== t.modeleId) : [], { A: 4, B: 1, C: 1 }), true);
  assert.equal(GEN.ecartMoities(t2, F, nb), 0);
  // échange seul : deux B côté vert, aucun côté rouge -> un échange suffit et garde la composition (deux B, deux A)
  const t3 = tuiles(); t3.find((t) => t.col === 0 && t.lig === 0).modeleId = 'B'; t3.find((t) => t.col === 3 && t.lig === 0).modeleId = 'B';
  assert.equal(GEN.equilibrerMoities(t3, cellules, F, nb, GEN.mulberry32(2), null), true);
  assert.deepEqual(t3.filter((t) => M.gabaritCellule(t.col, t.lig, F) === 'coin').map((t) => t.modeleId).sort(), ['A', 'A', 'B', 'B']);
  assert.equal(GEN.ecartMoities(t3, F, nb), 0);
  // la cause de rejet existe (et son libellé) ; le catalogue livré ne la produit jamais
  const r = GEN.generer(CAT.nouveauDocument('4x4'), { graine: 'moities', candidats: 30 });
  assert.equal(r.rejets.cases_moities, 0);
});

test('orientation 4×4 : le plus petit nombre de ports d\'une jonction est maximal (au moins 3), aucune rotation d\'une centrale ne fait mieux', () => {
  const doc = CAT.nouveauDocument('4x4'), ctx = GEN.contexteDocument4x4(doc), rng = GEN.mulberry32(9);
  for (let k = 0; k < 40; k++) {
    const r = GEN.tuilesOrientees4x4(ctx, rng);
    assert.ok(!r.cause);
    const d = copie(doc); d.plateau.tuiles = r.tuiles;
    const cle = (x) => { const p = GEN.portsParJonction(x); return [Math.min(...p), p.filter((v) => v >= 3).length]; };
    const ref = cle(d);
    assert.ok(ref[0] >= 3, 'ports minimum ' + ref[0]);
    assert.deepEqual(ref, [r.minPorts, r.jonctions3]);
    d.plateau.tuiles.forEach((t) => {
      if (M.gabaritCellule(t.col, t.lig, '4x4') !== 'centrale') return;
      const r0 = t.rot;
      for (let rot = 0; rot < 4; rot++) {
        t.rot = rot;
        const c = cle(d);
        assert.ok(c[0] < ref[0] || (c[0] === ref[0] && c[1] <= ref[1]), 'centrale (' + t.col + ',' + t.lig + ') tournée de ' + rot);
      }
      t.rot = r0;
    });
    assert.equal(GEN.ecartMoities(r.tuiles, G.format('4x4'), Object.fromEntries(doc.modeles.map((m) => [m.id, m.cases.length]))), 0);
  }
});

test('affinage du rythme : une préférence (jamais un rejet) qui raccourcit la chaîne et rapproche les accès, sans sortir des seuils', () => {
  for (const g0 of ['4x4', '5x5']) {
    let avec = 0, sans = 0, accAvec = 0, accSans = 0;
    // 4×4 en « jonctions variées » (défaut depuis docs/48) : l'écart des accès est bruité sur 12 graines (7 contre 6), net sur 40 (18 contre 32)
    for (let k = 0, nb = g0 === '4x4' ? 40 : 12; k < nb; k++) {
      const a = GEN.generer(CAT.nouveauDocument(g0), { graine: 'aff-' + k, candidats: 20 });
      const b = GEN.generer(CAT.nouveauDocument(g0), { graine: 'aff-' + k, candidats: 20, affinage: false });
      assert.ok(a.ok && b.ok);
      // mêmes candidats, mêmes rejets : l'affinage ne joue qu'au choix final
      assert.deepEqual(a.rejets, b.rejets);
      assert.equal(a.candidats, b.candidats);
      // 4×4 : S dans la tolérance ; 5×5 : S n'est que la dernière préférence (docs/53 § 3), sous le seuil de rejet
      if (g0 === '4x4') assert.ok(a.score.S <= a.score.Smin + 1, 'S dans la tolérance');
      else assert.ok(a.score.S < GR.SEUIL_S, 'S sous le seuil de rejet');
      const e = GR.equilibre(a.doc);
      assert.deepEqual(e.blocages, []);
      if (g0 === '5x5') assert.deepEqual(e.alertes, []);
      GEN.portsParJonction(a.doc).forEach((p) => assert.ok(p >= (g0 === '4x4' ? 3 : 2), g0 + ' : l’affinage ne cède aucun port (ports d’abord)'));
      avec += a.score.chaine; sans += b.score.chaine;
      accAvec += Math.abs(a.score.acces.ecart); accSans += Math.abs(b.score.acces.ecart);
      assert.ok(a.rapport.some((t) => /affiné/.test(t)) && b.rapport.some((t) => /sans affinage/.test(t)));
    }
    // mesuré (40 graines, 40 candidats) : chaîne moyenne 4×4 2,98 contre 4,13 ; 5×5 (catalogue de docs/55, 12 graines) : voir docs/56
    assert.ok(avec < sans, g0 + ' : chaîne ' + avec + ' contre ' + sans);
    assert.ok(accAvec <= accSans, g0 + ' : accès ' + accAvec + ' contre ' + accSans);
  }
});

test('rapport d\'équilibre : « bien au-dessus de la cible » (information) quand la chaîne vaut 7 ou plus, ou la distance maximale 6 ou plus', () => {
  for (const g0 of ['4x4', '5x5']) {
    const a = PM.equilibre.analyser(plateaux(g0)[0]);
    const ligne = (ry) => PM.equilibre.rapport(Object.assign({}, a, { rythme: Object.assign({}, a.rythme, ry) })).organique[0];
    assert.ok(!/au-dessus/.test(ligne({ chaineMax: 3, distMax: 3 })), g0 + ' : à la cible');
    assert.ok(/\(au-dessus de la cible\)/.test(ligne({ chaineMax: 4, distMax: 3 })) && !/bien au-dessus/.test(ligne({ chaineMax: 6, distMax: 5 })), g0 + ' : au-dessus, pas « bien »');
    assert.ok(/bien au-dessus de la cible/.test(ligne({ chaineMax: 7, distMax: 3 })), g0 + ' : chaîne 7');
    assert.ok(/bien au-dessus de la cible/.test(ligne({ chaineMax: 3, distMax: 6 })), g0 + ' : distMax 6');
    const r = PM.equilibre.rapport(a);
    assert.ok(!r.alertes.some((t) => /au-dessus/.test(t)) && !r.blocages.length, 'jamais une alerte');
  }
});

test('goulets 5×5 : le générateur préfère les plateaux sans point d\'articulation (12 graines : aucun)', () => {
  for (let k = 0; k < 12; k++) {
    const r = GEN.generer(CAT.nouveauDocument('5x5'), { graine: 'gou-' + k, candidats: 20 });
    assert.ok(r.ok, r.raison);
    const g = GR.construire(r.doc, { villesTraversables: false });
    assert.equal(GR.goulets(g, 1).articulations.length + GR.goulets(g, 2).articulations.length, 0, 'gou-' + k);
  }
});

test('rapport d\'équilibre : rythme, accès au centre et cases par moitié en information (jamais une alerte)', () => {
  for (const g0 of ['4x4', '5x5']) {
    const doc = plateaux(g0)[0], a = PM.equilibre.analyser(doc), r = PM.equilibre.rapport(a);
    assert.equal(r.organique.length, g0 === '5x5' ? 4 : 3);
    if (g0 === '5x5') assert.match(r.organique[3], /^Connexions par case : \d+ case\(s\) à 2 connexions ou moins sur 59 \(.* %.*\) ; .* connexions par case en moyenne/);
    assert.match(r.organique[0], /^Rythme : au plus \d+ case/);
    assert.match(r.organique[1], /^Accès au centre/);
    assert.match(r.organique[2], /^Cases par moitié : vert \d+, rouge \d+ \(égales\)/);
    assert.ok(!r.alertes.some((t) => /Rythme|Accès au centre|moitié/.test(t)));
    assert.equal(a.rythme.chaineMax, GR.rythme(doc, GR.construire(doc)).chaineMax);
  }
  // analyse construite à la main (sans les champs) : pas de ligne
  const a0 = PM.equilibre.analyser(plateaux('4x4')[0]);
  delete a0.rythme;
  assert.deepEqual(PM.equilibre.rapport(a0).organique, []);
});
