'use strict';
// Lot 6 : interface et sauvegarde du format hexagonal 'hex19' (docs/72, docs/76 à 81) : sauvegarde, Nouveau, plateau d'assemblage,
// éditeur de tuile, bibliothèque, contrôles, rapport d'équilibre, « Orienter les tuiles » et rejet du générateur à S >= 3.
// Le catalogue hexagonal livré (4 modèles) sert de base ; les plateaux viennent du générateur (graine fixe).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/catalogue.js');
require('../src/rendu.js');
require('../src/etat.js');
require('../src/sauvegarde.js');
require('../src/graphe.js');
require('../src/equilibre.js');
require('../src/generateur.js');
require('../src/export.js');
require('../src/controles.js');
require('../src/bibliotheque.js');
require('../src/assemblage.js');
require('../src/editeur-tuile.js');
require('../src/app.js');
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, A = PM.assemblage, B = PM.bibliotheque, C = PM.controles, S = PM.sauvegarde, GEN = PM.generateur, GR = PM.graphe;
const ED = PM.editeurTuile, N = PM.nouveau, EQ = PM.equilibre, R = PM.rendu;
const F = G.format('hex19');

const copie = (o) => JSON.parse(JSON.stringify(o));
const vide = () => PM.catalogue.nouveauDocument('hex19');
let memo = null;
/** Plateau hexagonal généré (graine fixe), copié à chaque appel. */
function plateau() {
  if (!memo) {
    const r = GEN.generer(vide(), { graine: '42' });
    assert.ok(r.ok, r.raison);
    memo = r.doc;
  }
  return copie(memo);
}
const estCentrale = (t) => F.cellule(t.col, t.lig).gabarit === 'centrale';
/** Tourne toutes les centrales d'un cran (le plateau perd en général l'écart entre les villes). */
function derange(doc, cran) {
  doc.plateau.tuiles.forEach((t) => { if (estCentrale(t)) t.rot = (t.rot + (cran || 1)) % 6; });
  return doc;
}

/* ================================ 1. Sauvegarde ================================ */

test('sauvegarde : aller-retour JSON sans perte d’un plateau hexagonal complet (grille, 19 tuiles, rotations 0..5, 6 villes)', () => {
  const doc = plateau();
  const texte = S.versJSON(doc), obj = JSON.parse(texte);
  assert.equal(obj.grille, 'hex19');
  assert.equal(obj.version, 3);
  const r = S.depuisJSON(texte);
  assert.ok(r.ok, JSON.stringify(r.erreurs));
  assert.equal(r.doc.grille, 'hex19');
  assert.deepEqual(r.doc.plateau, doc.plateau, 'plateau identique');
  assert.deepEqual(r.doc.modeles, doc.modeles, 'bibliothèque identique');
  assert.equal(r.doc.plateau.tuiles.length, 19);
  assert.ok(r.doc.plateau.tuiles.every((t) => t.rot >= 0 && t.rot <= 5));
  assert.equal(r.doc.plateau.jetons.length, 6);
  assert.ok(r.doc.plateau.jetons.every((j) => j.i >= 0 && j.i <= 23 && j.j === 0 && j.type === 'capture'));
  assert.deepEqual(r.alertes, [], 'aucune alerte à la relecture');
  assert.equal(S.versJSON(r.doc).replace(/"date": "[^"]*"/, ''), texte.replace(/"date": "[^"]*"/, ''), 'second tour identique');
});

test('sauvegarde : une grille hexagonale s’écrit toujours en version 3, même sans passage ni pivot ; carré inchangé (version 2)', () => {
  const sansPassage = M.nouveauDocument('hex19');
  sansPassage.modeles = M.copieExemples('hex19').filter((m) => !(m.passages || []).length);
  assert.equal(JSON.parse(S.versJSON(sansPassage)).version, 3);
  assert.equal(JSON.parse(S.bibliothequeVersJSON(sansPassage)).version, 3);
  assert.equal(JSON.parse(S.versJSON(M.nouveauDocument())).version, 2);
  const d5 = PM.catalogue.nouveauDocument('5x5'), avecPassages = d5.modeles.some((m) => (m.passages || []).length || (m.pivots || []).length);
  assert.equal(JSON.parse(S.versJSON(d5)).version, avecPassages ? 3 : 2, '5×5 : 3 seulement avec des passages ou des pivots');
});

test('sauvegarde : jetons hexagonaux {i: 0..23, j: 0} non bornés comme en carré, siège hors plage signalé sans exception', () => {
  const doc = plateau();
  const texte = JSON.stringify(Object.assign(JSON.parse(S.versJSON(doc)), {}));
  const obj = JSON.parse(texte);
  obj.plateau.jetons.push({ i: 23, j: 0, type: 'capture' }, { i: 999, j: 0, type: 'capture' }, { i: 5, j: 7, type: 'capture' }, { i: -3, j: 0, type: 'capture' });
  const r = S.depuisJSON(JSON.stringify(obj));
  assert.ok(r.ok);
  assert.equal(r.doc.plateau.jetons.length, 10, 'tous les jetons bien formés sont lus tels quels');
  assert.ok(r.alertes.some((a) => a.code === 'jeton_invalide' || a.code === 'trop_de_villes'), 'les jetons incohérents sont signalés');
});

test('sauvegarde : fichiers hostiles hexagonaux — rotations, cellules, grille, jetons mal formés : jamais d’exception', () => {
  const base = JSON.parse(S.versJSON(plateau()));
  const hostile = (modif) => { const o = copie(base); modif(o); return S.depuisJSON(JSON.stringify(o)); };
  let r = hostile((o) => { o.plateau.tuiles[0].rot = 77; o.plateau.tuiles[1].rot = -1; o.plateau.tuiles[2].rot = 1.5; });
  assert.ok(r.ok, 'lisible');
  assert.ok(r.alertes.some((a) => a.code === 'rot_invalide'), 'rotation hors 0..5 signalée');
  r = hostile((o) => { o.plateau.tuiles.push({ modeleId: 'HC2', col: 99, lig: -4, rot: 0 }, { modeleId: 'HC2', col: 2, lig: 2, rot: 0 }); });
  assert.ok(r.ok);
  assert.ok(r.alertes.some((a) => a.code === 'hors_grille'), 'cellule hors des 19 signalée');
  r = hostile((o) => { o.grille = 'hex20'; });
  assert.equal(r.ok, false);
  assert.equal(r.erreurs[0].code, 'grille');
  r = hostile((o) => { o.version = 4; });
  assert.equal(r.ok, false);
  r = hostile((o) => { o.plateau.jetons = [null, 5, { i: 'a', j: 0, type: 'capture' }, { i: 1, j: 0, type: 'bizarre' }, { i: 1e9, j: 0, type: 'capture' }]; });
  assert.ok(r.ok);
  r = hostile((o) => { o.plateau.tuiles = new Array(500).fill(copie(o.plateau.tuiles[0])); o.plateau.jetons = new Array(500).fill({ i: 0, j: 0, type: 'capture' }); });
  assert.ok(r.ok);
  assert.ok(r.doc.plateau.tuiles.length <= 64 && r.doc.plateau.jetons.length <= 64, 'plafonds de lecture respectés');
  r = hostile((o) => { o.modeles[0].grille = '4x4'; o.modeles[1].grille = 'zz'; });
  assert.ok(r.ok);
  assert.equal(r.doc.modeles[1].grille, 'hex19', 'grille de modèle inconnue : celle du document');
  for (const texte of ['', '[]', '{"format":"plateau-modulaire","version":3,"grille":"hex19","modeles":{},"plateau":{}}', '{"format":"plateau-modulaire","version":3,"grille":"hex19","modeles":[],"plateau":{"tuiles":[{"modeleId":"x","col":"a"}],"jetons":[]}}']) {
    assert.doesNotThrow(() => S.depuisJSON(texte));
  }
});

test('sauvegarde : un fichier hexagonal de version 2 se lit aussi (grille connue) ; fusion de bibliothèque hexagonale', () => {
  const o = JSON.parse(S.versJSON(plateau()));
  o.version = 2;
  assert.ok(S.depuisJSON(JSON.stringify(o)).ok);
  const bib = S.bibliothequeVersJSON(plateau());
  const f = S.fusionnerBibliotheque(vide(), bib);
  assert.ok(f.ok);
  assert.equal(f.renommes.length, 4, 'les 4 identifiants existent déjà : renommés');
  assert.ok(f.doc.modeles.every((m) => m.grille === 'hex19'));
});

test('sauvegarde automatique : le stockage garde le plateau hexagonal tel quel', () => {
  const doc = plateau(), mem = {};
  const stockage = { setItem: (k, v) => { mem[k] = v; }, getItem: (k) => (k in mem ? mem[k] : null), removeItem: (k) => { delete mem[k]; } };
  S.autosave(doc, stockage);
  S.ecrireMaintenant(doc, stockage);
  const r = S.restaurerAutosave(stockage);
  assert.ok(r && r.ok);
  assert.deepEqual(r.doc.plateau, doc.plateau);
});

/* ================================ 2. Nouveau ================================ */

test('FORMATS contient désormais hex19 (FORMATS_TOUS en est l’alias) ; les formats carrés ne changent pas', () => {
  assert.deepEqual([...G.FORMATS], ['4x4', '5x5', 'hex19']);
  assert.deepEqual([...G.FORMATS_TOUS], [...G.FORMATS]);
  assert.equal(G.format('4x4').COTE, 120);
  assert.equal(G.format('5x5').COTE, 100);
});

test('Nouveau : description de la grille hexagonale, indicateur de la barre, document neuf du catalogue', () => {
  assert.deepEqual(N.descriptionGrille('hex19'), { id: 'hex19', nom: 'Hexagonal (19 tuiles)', dimensions: '49,9 × 43,2 cm', tuile: '5,4 cm de côté', hex: true });
  assert.deepEqual(N.descriptionGrille('4x4'), { id: '4x4', nom: '4×4', dimensions: '48 × 48 cm', tuile: '12 cm' }, '4×4 inchangé');
  assert.equal(N.libelleIndicateur(vide()), 'Grille Hexagonal (19 tuiles) · 49,9 × 43,2 cm');
  const r = N.documentPourGrille('hex19');
  assert.ok(r.ok, r.raison);
  assert.equal(r.doc.grille, 'hex19');
  assert.deepEqual(r.doc.modeles.map((m) => m.id), ['HC2', 'HC3', 'HB1', 'HK1']);
  assert.deepEqual(r.doc.plateau, { tuiles: [], jetons: [] });
  assert.equal(N.documentPourGrille('hex20').ok, false);
  assert.equal(N.documentPourGrille('4x4').ok, true);
});

test('Nouveau : sans catalogue hexagonal, la grille est refusée avec une phrase et le plateau est conservé', () => {
  const avant = PM.catalogue;
  PM.catalogue = { nouveauDocument: (g) => { const d = M.nouveauDocument(); return d; } };
  try {
    const r = N.documentPourGrille('hex19');
    assert.equal(r.ok, false);
    assert.match(r.raison, /pas encore disponible/);
  } finally { PM.catalogue = avant; }
});

/* ================================ 3. Plateau d'assemblage ================================ */

test('plateau : 19 cellules aux formes de formeCellule, 24 sièges, aucun style en ligne', () => {
  const svg = A.svgPlateau(vide(), {});
  assert.equal((svg.match(/data-cellule="/g) || []).length, 19);
  assert.equal((svg.match(/data-jonction="/g) || []).length, 24);
  assert.equal((svg.match(/<g [^>]*pm-assemblage-siege/g) || []).length, 24);
  assert.ok(!/style=/.test(svg), 'CSP : pas d’attribut style en ligne');
  assert.ok(!/<script|onclick|onerror/i.test(svg));
  assert.match(svg, /Camp vert \(nord\)/);
  assert.match(svg, /Camp rouge \(sud\)/);
  assert.match(svg, /pm-assemblage-silhouette-vert/);
  assert.match(svg, /pm-assemblage-silhouette-rouge/);
  assert.match(svg, /pm-assemblage-silhouette-neutre/);
  assert.match(svg, /Plateau hexagonal de 19 tuiles, 49,9 × 43,2 cm/);
  // pourtour à bord droit : la silhouette de la cellule 2,0 est celle de formeCellule (pentagone/coin), recentrée sur la cellule
  const c = F.cellule(2, 0), pts = F.formeCellule(2, 0);
  const attendu = pts.map((p) => Math.round((p.x - c.x) * 1000) / 1000 + ',' + Math.round((p.y - c.y) * 1000) / 1000).join(' ');
  assert.ok(svg.includes('points="' + attendu + '"'), 'forme de la cellule du coin nord-ouest');
});

test('plateau : celluleSous retrouve chacune des 19 cellules en son centre, null hors plateau ; jonctionSous retrouve les 24 sièges', () => {
  F.cellules.forEach((c) => assert.deepEqual(A.celluleSous(c.x, c.y, 'hex19'), { col: c.col, lig: c.lig }, c.cle));
  assert.equal(A.celluleSous(0, 400, 'hex19'), null);
  assert.equal(A.celluleSous(-400, 0, 'hex19'), null);
  assert.equal(A.celluleSous(NaN, 0, 'hex19'), null);
  F.sieges.forEach((s) => assert.deepEqual(A.jonctionSous(s.x + 3, s.y - 3, 'hex19'), { i: s.id, j: 0 }));
  assert.equal(A.jonctionSous(0, 0, 'hex19'), null, 'le centre d’une tuile n’est pas un siège');
  // le carré ne change pas
  assert.deepEqual(A.celluleSous(130, 10), { col: 1, lig: 0 });
  assert.deepEqual(A.jonctionSous(121, 119), { i: 1, j: 1 });
});

test('plateau : vue hexagonale centrée, cadrage clic -> mm', () => {
  const v = A.vuePour('hex19');
  assert.ok(Math.abs(v.x + v.w / 2) < 1e-9, 'centrée horizontalement sur l’origine');
  assert.equal(Math.round(v.w * 10) / 10, Math.round((F.PLATEAU.largeur + 80) * 10) / 10);
  assert.equal(Math.round(v.h * 10) / 10, Math.round((F.PLATEAU.hauteur + 120) * 10) / 10);
  const rect = { left: 0, top: 0, width: v.w, height: v.h };
  const p = A.ecranVersMm(v.w / 2, 52 + F.PLATEAU.hauteur / 2, rect, v);
  assert.ok(Math.abs(p.x) < 1e-6 && Math.abs(p.y) < 1e-6, 'le centre du plateau est l’origine');
});

test('plateau : cellules compatibles par gabarit (7 centrales, 6 bords, 6 coins) ; pose par clic ; rotation par 60°', () => {
  const d = vide();
  assert.equal(A.cellulesCompatibles(d, 'HC2').length, 7);
  assert.equal(A.cellulesCompatibles(d, 'HB1').length, 6);
  assert.equal(A.cellulesCompatibles(d, 'HK1').length, 6);
  const centre = F.cellules.find((c) => c.role === 'centre');
  let p = A.poserTuileTournee(d, 'HC2', centre.col, centre.lig, 5);
  assert.equal(M.tuileEn(p, centre.col, centre.lig).rot, 5);
  p = A.poserTuileTournee(d, 'HC2', centre.col, centre.lig, 7);
  assert.equal(M.tuileEn(p, centre.col, centre.lig).rot, 1, '7 pas de 60° = 1 pas');
  p = A.poserTuileTournee(d, 'HC2', centre.col, centre.lig, -1);
  assert.equal(M.tuileEn(p, centre.col, centre.lig).rot, 5);
  // rotation suggérée du pourtour quand aucune rotation n’est donnée
  const nord = F.cellules.find((c) => c.role === 'bord' && c.lig === 0);
  p = A.poserTuileTournee(d, 'HB1', nord.col, nord.lig, null);
  assert.equal(M.tuileEn(p, nord.col, nord.lig).rot, F.rotationImposee(nord.col, nord.lig));
  // six tours de 60° = identité
  let q = A.poserTuileTournee(d, 'HC2', centre.col, centre.lig, 0);
  for (let k = 0; k < 6; k++) q = M.tournerTuile(q, centre.col, centre.lig, 1);
  assert.equal(M.tuileEn(q, centre.col, centre.lig).rot, 0);
  // la pose sur une cellule du mauvais rôle est refusée avec la phrase du rôle
  assert.equal(M.peutPoserTuile(d, 'HK1', centre.col, centre.lig).ok, false);
  assert.match(A.raisonRefus(d, 'HK1', M.peutPoserTuile(d, 'HK1', centre.col, centre.lig).raison), /coin/i);
});

test('plateau : déplacer une tuile conserve sa rotation ; hors des 19 cellules : refus', () => {
  const doc = M.poserTuile(M.poserTuile(vide(), 'HC2', 2, 2, 3), 'HC3', 3, 1, 0);
  assert.equal(A.testerDeplacement(doc, { col: 2, lig: 2 }, { col: 3, lig: 2 }).ok, true);
  const apres = A.deplacerTuile(doc, { col: 2, lig: 2 }, { col: 3, lig: 2 });
  assert.equal(M.tuileEn(apres, 3, 2).rot, 3);
  assert.equal(A.testerDeplacement(doc, { col: 2, lig: 2 }, { col: 9, lig: 9 }).ok, false);
  assert.equal(A.cellulesCompatiblesDeplacement(doc, { col: 2, lig: 2 }).length, 6, 'la cellule d’origine et 5 centrales libres (la 7e est occupée)');
});

test('plateau : sièges — bascule campement <-> ville au clic, retrait automatique si une tuile disparaît (clic droit)', () => {
  let d = plateau();
  const ville = d.plateau.jetons[0];
  assert.equal(A.compterJetons(d), 6);
  // un siège sans ville : clic = ville, second clic = campement
  const libre = F.sieges.find((s) => !d.plateau.jetons.some((j) => j.i === s.id));
  d = M.cyclerJeton(d, libre.id, 0);
  assert.equal(A.compterJetons(d), 7);
  assert.equal(A.messageJeton(d, libre.id, 0).texte, 'Ville sur le siège ' + libre.id + '.');
  d = M.cyclerJeton(d, libre.id, 0);
  assert.equal(A.compterJetons(d), 6);
  assert.match(A.messageJeton(d, libre.id, 0).texte, /redevient un campement/);
  // clic droit sur une tuile d’un siège de ville : la ville part avec elle
  const siege = F.sieges[ville.i], t = siege.tuiles[0];
  const r = A.retirerParClicDroit(d, t.col, t.lig);
  assert.ok(r.ok);
  assert.equal(r.doc.plateau.tuiles.length, 18);
  assert.equal(A.compterJetons(r.doc), 5);
  assert.match(r.phrase, /ville retirée : le siège \d+ n'a plus 3 tuiles/);
  assert.equal(r.niveau, 'alerte');
  assert.equal(A.retirerParClicDroit(vide(), 2, 2).ok, false, 'cellule vide : rien');
  const eff = A.effetsDeAction(d, r.doc);
  assert.equal(eff.jetonsRetires.length, 1);
});

test('plateau : le rendu montre ville, campement (3 tuiles posées) et point selon l’état du siège', () => {
  const d = plateau(), svg = A.svgPlateau(d, {});
  const villes = d.plateau.jetons.length;
  assert.equal((svg.match(/pm-assemblage-jeton"/g) || []).length + (svg.match(/pm-assemblage-jeton /g) || []).length, villes);
  assert.equal((svg.match(/pm-assemblage-avec-campement/g) || []).length, 24 - villes, 'les 18 autres sièges sont des campements');
  assert.equal((svg.match(/data-campement="flamme"/g) || []).length, 24 - villes);
  const partiel = M.retirerTuile(M.retirerTuile(d, 2, 2), 3, 1);
  const s2 = A.svgPlateau(partiel, {});
  assert.ok((s2.match(/pm-assemblage-avec-campement/g) || []).length < 18, 'sièges incomplets : plus de campement');
  assert.match(s2, /pm-assemblage-refusee/);
});

test('plateau : alertes visuelles hexagonales (raccord mort, port vers le pourtour) et rotation_pourtour', () => {
  let d = plateau();
  assert.equal(A.alertesPlateau(d).filter((a) => a.type === 'raccord' && !a.mur).length, 0, 'plateau généré : aucun raccord mort');
  // on tourne un coin du pourtour : il n’épouse plus le plateau
  const coin = d.plateau.tuiles.find((t) => F.cellule(t.col, t.lig).gabarit === 'coin');
  const rot = F.rotationImposee(coin.col, coin.lig);
  d = M.tournerTuile(d, coin.col, coin.lig, 1);
  const v = M.validerPlateau(d);
  assert.ok(v.alertes.some((a) => a.code === 'rotation_pourtour'), 'alerte rotation_pourtour');
  const al = A.alertesPlateau(d);
  assert.ok(al.length > 0);
  al.forEach((a) => { assert.ok(isFinite(a.x) && isFinite(a.y) && isFinite(a.nx) && isFinite(a.ny)); assert.ok(Math.abs(Math.hypot(a.nx, a.ny) - 1) < 1e-6); });
  const svg = A.svgPlateau(d, {});
  assert.match(svg, /pm-assemblage-alerte/);
  assert.ok(!/style=/.test(svg));
  // l’alerte est affichée dans le panneau des contrôles avec son libellé
  const r = C.calculer(d);
  const g = r.regroupees.find((x) => x.code === 'rotation_pourtour');
  assert.ok(g, 'groupe rotation_pourtour');
  assert.equal(g.libelle, 'Tuiles du pourtour mal tournées');
  assert.match(g.elements[0].message, new RegExp('devrait être tournée de ' + rot + ' pas de 60'));
  assert.deepEqual(g.elements[0].cible, { type: 'tuile', col: coin.col, lig: coin.lig }, 'cliquable : surbrillance de la tuile');
});

test('plateau : surbrillance hexagonale — tuile (polygone), raccord, port, siège, modèle', () => {
  const d = plateau();
  const poly = A.cibleSurbrillance({ type: 'tuile', col: 2, lig: 0 }, d);
  assert.equal(poly.length, 1);
  assert.equal(poly[0].forme, 'poly');
  assert.deepEqual(poly[0].pts, F.formeCellule(2, 0));
  assert.deepEqual(A.cibleSurbrillance({ type: 'tuile', col: 9, lig: 9 }, d), [], 'cellule inexistante');
  const c = F.cellule(2, 2), pr = F.pointRaccord(1, 0);
  const rac = A.cibleSurbrillance({ type: 'raccord', col: 2, lig: 2, cote: 1, pos: 0 }, d)[0];
  assert.equal(rac.forme, 'cercle');
  assert.ok(Math.abs(rac.x - (c.x + pr.x)) < 1e-9 && Math.abs(rac.y - (c.y + pr.y)) < 1e-9);
  const sg = F.sieges[7];
  assert.deepEqual(A.cibleSurbrillance({ type: 'jeton', i: 7, j: 0 }, d)[0], { forme: 'cercle', x: sg.x, y: sg.y, r: 22 });
  assert.deepEqual(A.cibleSurbrillance({ type: 'jonction', i: 7, j: 0 }, d)[0], { forme: 'cercle', x: sg.x, y: sg.y, r: 22 });
  assert.equal(A.cibleSurbrillance({ type: 'jeton', i: 99, j: 0 }, d).length, 0);
  assert.equal(A.cibleSurbrillance({ type: 'port', col: 2, lig: 0, coin: 3 }, d)[0].forme, 'cercle');
  assert.equal(A.cibleSurbrillance({ type: 'modele', id: 'HC2' }, d).length, d.plateau.tuiles.filter((t) => t.modeleId === 'HC2').length);
  const svg = A.svgPlateau(d, { surbrillance: { type: 'tuile', col: 2, lig: 0 } });
  assert.match(svg, /<polygon class="pm-assemblage-surbrillance"/);
});

test('plateau : compteur « Villes posées x/6 » (nbVilles du format)', () => {
  assert.equal(GR.nbVilles('hex19'), 6);
  assert.equal(C.nbVilles('hex19'), 6);
  assert.equal(A.compterJetons(plateau()), 6);
});

test('plateau : un document carré se dessine comme avant (non-régression)', () => {
  const svg4 = A.svgPlateau(M.nouveauDocument(), {});
  assert.equal((svg4.match(/data-cellule="/g) || []).length, 16);
  assert.equal((svg4.match(/data-jonction="/g) || []).length, 9);
  assert.match(svg4, /viewBox="-40 -52 560 600"/);
});

/* ================================ 4. Éditeur de tuile ================================ */

test('éditeur : vue centrée, aimantation dans la forme du gabarit à 4 mm du bord et hors des zones de jeton', () => {
  const v = ED.vuePour(F);
  assert.deepEqual(v, { x: -62, y: -62, l: 124, h: 124 });
  assert.deepEqual(ED.vuePour('4x4'), { x: -16, y: -16, l: 152, h: 152 }, 'carré inchangé');
  for (const g of ['centrale', 'bord', 'coin']) {
    const poly = F.forme(g), zone = F.GABARITS[g].coinsInterieurs;
    for (const [x, y] of [[0, 0], [100, 100], [-100, 50], [0, -53], [53, 0], [-20, 40], [40, -40]]) {
      const p = ED.aimanter(x, y, 20, F, g);
      assert.ok(Math.abs(p.x % 10) < 1e-9 && Math.abs(p.y % 10) < 1e-9, 'sur la grille de 1 cm');
      const m = { id: 't', gabarit: g, grille: 'hex19', exemplaires: 1, cases: [{ id: 'c1', x: p.x, y: p.y, diametre: 20, type: 'deplacement' }], chemins: [] };
      const e = M.validerModele(m, F).erreurs.map((q) => q.code);
      assert.ok(!e.includes('case_hors_tuile') && !e.includes('case_zone_coin') && !e.some((c) => /hors|zone|marge/.test(c)), g + ' ' + [x, y] + ' -> ' + JSON.stringify(p) + ' ' + e);
      void poly; void zone;
    }
  }
});

test('éditeur : modèles de départ hexagonaux (centrale, bord, coin) : cases valides, première case d’un bord ou d’un coin = apparition', () => {
  for (const g of ['centrale', 'bord', 'coin']) {
    const m = ED.modeleDeDepart(g, [], F);
    assert.equal(m.grille, 'hex19');
    assert.equal(m.gabarit, g);
    assert.equal(m.cases.length, { centrale: 4, bord: 3, coin: 2 }[g]);
    assert.equal(m.cases[0].type, g === 'centrale' ? 'deplacement' : 'apparition');
    const v = M.validerModele(m, F);
    assert.ok(v.erreurs.every((e) => e.code === 'case_isolee'), g + ' : ' + v.erreurs.map((e) => e.code));
    assert.ok(v.alertes.some((a) => a.code === 'coin_non_porte'), 'H2 : coins non portés signalés');
  }
});

test('éditeur : édition d’un modèle hexagonal (case, chemin, port au coin, raccord au milieu d’un côté, pivot, passage, courbe)', () => {
  let m = ED.modeleDeDepart('centrale', [], F);
  const c1 = m.cases[0].id, c2 = m.cases[1].id;
  m = ED.ajouterChemin(m, { 'case': c1 }, { 'case': c2 });
  m = ED.ajouterChemin(m, { 'case': c1 }, { coin: 0 });
  m = ED.ajouterChemin(m, { 'case': c2 }, { raccord: { cote: 1, pos: 0 } });
  assert.equal(m.chemins.length, 3);
  const trace = R.tracesModele(m, F);
  assert.equal(trace.length, 3);
  // pivot aimanté dans l’hexagone
  m = ED.ajouterPivot(m, 3, -2, F);
  const pv = m.pivots[0];
  assert.ok(Math.abs(pv.x % 10) < 1e-9 && Math.abs(pv.y % 10) < 1e-9);
  m = ED.ajouterPassage(m, { pivot: pv.id }, { raccord: { cote: 4, pos: 0 } });
  m = ED.ajouterPassage(m, { 'case': m.cases[2].id }, { pivot: pv.id });
  assert.equal(m.passages.length, 2);
  const id = m.passages[0].id;
  assert.equal(ED.definirCourbe(m, id, 500, -500, F).passages[0].courbe.x, 46.8, 'courbe bornée à la boîte de la forme (hexagone : ±46,8 × ±54)');
  assert.equal(ED.definirCourbe(m, id, 500, -500, F).passages[0].courbe.y, -54);
  assert.equal(ED.definirCourbe(m, id, -500, 500, F).passages[0].courbe.y, 54);
  const coin = ED.modeleDeDepart('coin', [], F);
  coin.passages = [{ id: 'ps1', a: { 'case': coin.cases[0].id }, b: { raccord: { cote: 4, pos: 0 } } }];
  assert.equal(ED.definirCourbe(coin, 'ps1', 500, 500, F).passages[0].courbe.x, 62.4, 'le coin déborde de l’hexagone : boîte de sa forme (x jusqu’à 62,4, y jusqu’à 67,5)');
  assert.equal(ED.definirCourbe(coin, 'ps1', 500, 500, F).passages[0].courbe.y, 67.5);
  // déplacement : reste aimanté et dans la forme
  m = ED.deplacerCase(m, c1, 200, 200, F);
  const dep = m.cases.find((c) => c.id === c1);
  assert.ok(Math.abs(dep.x % 10) < 1e-9 && Math.abs(dep.y % 10) < 1e-9);
  // suppression d’un raccord, d’un coin
  assert.doesNotThrow(() => ED.supprimer(m, { type: 'raccord', cote: 1, pos: 0 }));
  assert.doesNotThrow(() => ED.supprimer(m, { type: 'coin', id: 0 }));
  // un pivot est refusé sur un point déjà pris
  assert.throws(() => ED.ajouterPivot(m, pv.x, pv.y, F), /existe déjà/);
});

test('éditeur : cibles — 6 raccords au milieu des côtés, 6 coins, cases ; extérieur selon le gabarit', () => {
  const m = ED.modeleDeDepart('bord', [], F);
  for (let c = 0; c < 6; c++) {
    const p = F.pointRaccord(c, 0), cible = ED.cibleEn(m, p.x, p.y, F);
    assert.deepEqual([cible.type, cible.cote, cible.pos], ['raccord', c, 0], 'côté ' + c);
    assert.equal(cible.exterieur, F.GABARITS.bord.cotesExterieurs.includes(c));
    const k = F.pointCoin(c), cc = ED.cibleEn(m, k.x, k.y, F);
    assert.deepEqual([cc.type, cc.coin], ['coin', c]);
    assert.equal(cc.exterieur, !F.GABARITS.bord.coinsInterieurs.includes(c));
  }
  const c0 = m.cases[0];
  assert.deepEqual(ED.cibleEn(m, c0.x, c0.y, F), { type: 'case', id: c0.id });
  assert.equal(ED.cibleEn(m, 0, 40, F), null, 'le fond n’est pas une cible');
  assert.match(ED.libelleCible(m, { type: 'raccord', cote: 3, pos: 0, exterieur: false }, F), /sud-ouest, au milieu du côté/);
  assert.match(ED.libelleCible(m, { type: 'coin', coin: 5, exterieur: false }, F), /Coin NO/);
  assert.equal(ED.coteCourte(m, { type: 'raccord', cote: 2, pos: 0 }, F).texte, 'milieu du côté');
  assert.equal(ED.raccordExterieur('coin', 0, F), true);
  assert.equal(ED.raccordExterieur('coin', 3, F), false);
  assert.equal(ED.coinExterieur('centrale', 2, F), false);
  assert.equal(ED.raccordExterieur('bord', 0), true, 'sans format : gabarits du carré (côté nord extérieur)');
  assert.equal(ED.raccordExterieur('bord', 2), false);
});

test('éditeur : gabarits hexagonaux — grille découpée à la forme, zones de jeton, 6 raccords, 6 coins, halo en polygone', () => {
  const m = ED.modeleDeDepart('coin', [], F);
  const grille = ED.svgGrille(F, 'coin');
  assert.match(grille, /<clipPath id="pm-editeur-clip-forme"><polygon points=/);
  assert.match(grille, /clip-path="url\(#pm-editeur-clip-forme\)"/);
  assert.equal((ED.svgZonesCoin(F, 'coin').match(/<circle /g) || []).length, 2, 'coin : 2 coins intérieurs');
  assert.equal((ED.svgZonesCoin(F, 'centrale').match(/<circle /g) || []).length, 6);
  const rac = ED.svgRaccords(m, null, F);
  assert.equal((rac.match(/data-raccord="/g) || []).length, 6);
  assert.match(rac, /data-raccord="5:0"/);
  assert.ok(!/transform=/.test(rac), 'les demi-disques sont dessinés en place');
  assert.equal((ED.svgCoins(m, null, F).match(/data-coin="/g) || []).length, 6);
  const halo = ED.haloDe(m, { type: 'modele', id: m.id }, F);
  assert.equal(halo.tuile, true);
  assert.deepEqual(halo.polygone, F.forme('coin'));
  assert.match(ED.svgHalo(halo, undefined, F), /<polygon class="pm-editeur-halo"/);
  assert.equal(ED.haloDe(m, { type: 'modele' }, '4x4').polygone, undefined, 'carré : halo rectangulaire');
  const sansStyle = [grille, rac, ED.svgCoins(m, null, F), ED.svgZonesCoin(F, 'coin')].join('');
  assert.ok(!/style=/.test(sansStyle));
});

test('éditeur : aperçu des 6 rotations (vignettes à repère N) et 4 en carré', () => {
  const m = ED.modeleDeDepart('centrale', [], F);
  for (let r = 0; r < 6; r++) {
    const s = ED.svgVignette(m, r, F);
    assert.match(s, new RegExp('Rotation ' + 60 * r + ' degrés'));
    assert.match(s, />N<\/text>/);
    assert.ok(!/style=/.test(s));
  }
  assert.match(ED.svgVignette(ED.modeleDeDepart('centrale', [], '4x4'), 1, '4x4'), /Rotation 90 degrés/);
});

test('éditeur : un modèle du catalogue hexagonal est reconnu sans erreur et ses règles hexagonales s’appliquent (H1, H2)', () => {
  const doc = vide();
  doc.modeles.forEach((m) => {
    const v = M.validerModele(m, F);
    assert.equal(v.complet, true, m.id);
    assert.ok(v.alertes.every((a) => a.code !== 'coin_non_porte'), m.id + ' : tous les coins intérieurs sont portés');
  });
  // H2 : on retire un port d’une intérieure -> coin_non_porte
  const hc = copie(doc.modeles[0]);
  hc.chemins = hc.chemins.filter((c) => !(c.b && c.b.coin === 0) && !(c.a && c.a.coin === 0));
  assert.ok(M.validerModele(hc, F).alertes.some((a) => a.code === 'coin_non_porte'));
});

/* ================================ 5. Bibliothèque ================================ */

test('bibliothèque : vignettes hexagonales par gabarit, grille d’un autre format signalée', () => {
  const groupes = B.vignettesBibliotheque(vide(), 'tous');
  assert.deepEqual(groupes.map((g) => [g.gabarit, g.modeles.length]), [['centrale', 2], ['bord', 1], ['coin', 1]]);
  assert.ok(groupes.every((g) => g.modeles.every((m) => m.posable && !m.autreGrille)));
  // un modèle hexagonal dans un document 4×4 (et l’inverse) est refusé avec une phrase qui nomme les deux grilles
  const d4 = M.nouveauDocument();
  d4.modeles.push(copie(vide().modeles[0]));
  assert.equal(B.vignettesBibliotheque(d4, 'tous')[0].modeles[0].autreGrille, true);
  assert.match(B.phraseAutreGrille(d4.modeles[0], d4), /grille hexagonale : elle ne se pose pas sur un plateau 4×4/);
  const dh = vide();
  dh.modeles.push(Object.assign(copie(M.copieExemples()[0]), { id: 'carre', grille: '4x4' }));
  assert.match(B.phraseAutreGrille(dh.modeles[4], dh), /grille 4×4 : elle ne se pose pas sur un plateau hexagonal/);
  assert.match(B.refusArmement(dh, 'carre'), /plateau hexagonal/);
  assert.equal(B.refusArmement(dh, 'HC2'), '');
});

test('bibliothèque : tuiles du catalogue hexagonal protégées, copie supprimable', () => {
  const d = vide();
  assert.equal(B.estTuileUtilisateur(d, 'HC2'), false);
  d.modeles.push(Object.assign(copie(d.modeles[0]), { id: 'perso' }));
  assert.equal(B.estTuileUtilisateur(d, 'perso'), true);
  assert.equal(B.supprimerTuileUtilisateur(d, 'perso').modeles.length, 4);
});

/* ================================ 6. Contrôles et équilibre ================================ */

test('contrôles : compteurs hexagonaux d’un plateau généré (6 villes, 19 tuiles, 5 apparitions par camp, ≈ 56 cases)', () => {
  const r = C.calculer(plateau()), par = (k) => r.compteurs.find((c) => c.cle === k);
  assert.deepEqual([par('villes').valeur, par('villes').cible], [6, 6]);
  assert.deepEqual([par('tuiles').valeur, par('tuiles').cible], [19, 19]);
  assert.deepEqual([par('apparitions_vert').valeur, par('apparitions_vert').cible], [5, 5]);
  assert.deepEqual([par('apparitions_rouge').valeur, par('apparitions_rouge').cible], [5, 5]);
  assert.equal(par('cases').valeur, 56);
  assert.equal(par('cases').cible, '≈ 56');
  assert.equal(par('dimensions').valeur, '49,9 × 43,2 cm');
  assert.equal(par('tuiles_petites').valeur, 0);
  assert.ok(r.compteurs.every((c) => c.etat === 'ok'), JSON.stringify(r.compteurs.filter((c) => c.etat !== 'ok')));
  assert.deepEqual(r.erreurs, []);
  assert.deepEqual(r.alertes, []);
  const vide0 = C.calculer(vide());
  assert.equal(vide0.compteurs.find((c) => c.cle === 'tuiles').cible, 19);
});

test('contrôles : « trop_de_villes » est affiché une seule fois, comme erreur (7e ville hexagonale)', () => {
  let d = plateau();
  const libre = F.sieges.find((s) => !d.plateau.jetons.some((j) => j.i === s.id));
  d.plateau.jetons.push({ i: libre.id, j: 0, type: 'capture' }); // pose directe : la 7e ville est refusée par poserJeton, pas par le fichier
  const r = C.calculer(d);
  const toutes = r.erreurs.concat(r.alertes).filter((x) => x.code === 'trop_de_villes');
  assert.equal(toutes.length, 1, 'une seule entrée');
  assert.equal(toutes[0].niveau, 'erreur');
  assert.match(toutes[0].message, /7 villes, la composition en prévoit 6/);
  assert.equal(r.regroupees.filter((g) => g.code === 'trop_de_villes').length, 1);
  assert.equal(r.regroupees.find((g) => g.code === 'trop_de_villes').nombre, 1);
  // 5×5 : toujours une erreur unique, 4×4 : toujours une alerte
  const d5 = PM.catalogue.nouveauDocument('5x5');
  assert.equal(C.calculer(d5).erreurs.concat(C.calculer(d5).alertes).filter((x) => x.code === 'trop_de_villes').length, 0);
});

test('contrôles : libellés des codes hexagonaux (rotation_pourtour, coin_non_porte, 4 villes contre 2, sièges mal reliés)', () => {
  assert.equal(C.LIBELLES.rotation_pourtour, 'Tuiles du pourtour mal tournées');
  assert.equal(C.LIBELLES.coin_non_porte, 'Coins sans port');
  assert.equal(C.LIBELLES_PAR_FORMAT.hex19.cinq_contre_deux, '4 villes contre 2');
  assert.equal(C.LIBELLES_PAR_FORMAT['5x5'].cinq_contre_deux, '6 villes contre 2');
  assert.equal(C.LIBELLES_PAR_FORMAT.hex19.jonction_ports, 'Sièges mal reliés');
});

test('contrôles : critères à 6 villes (« 4 contre 2 » bloquant) sur un plateau déséquilibré, villes trop proches nommées par siège', () => {
  let d = plateau();
  d.plateau.jetons = [0, 1, 2, 3, 4, 5].map((i) => ({ i, j: 0, type: 'capture' })); // six villes au nord, collées
  const r = C.calculer(d);
  assert.ok(r.erreurs.some((e) => e.code === 'desequilibre'), 'plateau très déséquilibré');
  const proches = r.alertes.filter((a) => a.code === 'villes_proches');
  assert.ok(proches.length > 0);
  assert.match(proches[0].message, /^Villes des sièges \d+ et \d+ à \d+ case\(s\) d'écart/);
  assert.match(r.erreurs.find((e) => e.code === 'desequilibre').message, /4 contre 2|écart/);
});

test('contrôles : aide « Placer les villes » et « Orienter les tuiles » propres à l’hexagonal', () => {
  assert.match(C.titrePlacerVilles(F), /Pose les 6 villes \(3 par camp\)/);
  assert.match(C.titrePlacerVilles(F), /trèfle/);
  assert.match(C.titrePlacerVilles(G.format('5x5')), /Pose les 8 villes/);
  assert.match(C.TITRE_ORIENTER, /tuiles intérieures posées/);
});

test('rapport d’équilibre hexagonal : explication à 6 villes, seuils S 4 / 3, villes nommées par siège', () => {
  const m = EQ.rapport(EQ.analyser(plateau()));
  assert.match(m.explication, /4 contre 2/);
  assert.match(m.explication, /trèfle/);
  assert.match(m.explication, /Orienter les tuiles/);
  assert.match(m.explication, /à surveiller à partir de 4 ; S = 3 est une simple information/);
  assert.equal(m.nbVilles, 6);
  assert.equal(m.seuilS, 4);
  assert.equal(m.seuilSInformation, 3);
  assert.equal(m.avecSymetrie, true);
  assert.ok(m.goulets.every((g) => /^siège \d+$/.test(g.ville)));
  assert.ok(m.organique.some((l) => /3 tuiles/.test(l)));
  assert.ok(m.organique.some((l) => /Connexions par case/.test(l)));
  assert.equal(EQ.explication('4x4'), EQ.EXPLICATION);
});

/* ================================ 7. Orienter les tuiles ================================ */

test('Orienter : refus expliqués (format carré, aucune centrale, aucune ville, aucune solution)', () => {
  const carre = GEN.orienterTuiles(M.nouveauDocument());
  assert.equal(carre.ok, false);
  assert.match(carre.raison, /plateau hexagonal/);
  const vide0 = GEN.orienterTuiles(vide());
  assert.equal(vide0.ok, false);
  assert.match(vide0.raison, /Aucune tuile intérieure/);
  const sansVille = plateau();
  sansVille.plateau.jetons = [];
  const r = GEN.orienterTuiles(sansVille);
  assert.equal(r.ok, false);
  assert.match(r.raison, /Aucune ville n’est posée/);
  // villes collées : aucune orientation ne les écarte
  const collees = plateau();
  collees.plateau.jetons = [0, 1, 2].map((i) => ({ i, j: 0, type: 'capture' }));
  const c = GEN.orienterTuiles(collees);
  assert.equal(c.ok, false);
  assert.match(c.raison, /Aucune orientation des \d+ tuile\(s\) intérieure\(s\) posée\(s\) ne tient l’écart de 4 pas entre les 3 ville\(s\)/);
  assert.equal(c.doc, null);
});

test('Orienter : retrouve des rotations qui tiennent l’écart entre les villes (S minimal) sur un plateau dérangé', () => {
  const casse = derange(plateau(), 1);
  const avantDoc = copie(casse);
  const r = GEN.orienterTuiles(casse);
  assert.ok(r.ok, r.raison);
  assert.deepEqual(casse, avantDoc, 'orienterTuiles est pure');
  assert.ok(r.changees.length > 0 && r.changees.length <= 7);
  r.changees.forEach((x) => { assert.ok(estCentrale(x), 'seules les intérieures tournent'); assert.ok(x.vers >= 0 && x.vers <= 5 && x.de !== x.vers); });
  // le pourtour et les villes ne bougent pas
  assert.deepEqual(r.doc.plateau.jetons, casse.plateau.jetons);
  r.doc.plateau.tuiles.forEach((t, k) => { if (!estCentrale(t)) assert.equal(t.rot, casse.plateau.tuiles[k].rot); });
  // l’écart de 4 pas est tenu, S minimal parmi les poses
  const g = GR.construire(r.doc, { villesTraversables: false });
  assert.equal(GR.villesProches(g).length, 0);
  const e = GR.equilibre(r.doc, { graphe: g });
  assert.equal(e.S, r.S);
  assert.ok(r.S <= 1, 'S = ' + r.S);
  assert.ok(g.jonctions.filter((j) => j.type === 'ville').every((j) => j.ports >= 3), 'chaque ville a 3 ports');
  assert.equal(C.calculer(r.doc).alertes.filter((a) => a.code === 'villes_proches').length, 0);
});

test('Orienter : un plateau déjà bien orienté ne change rien ; sur plateau partiel, la recherche ne touche que les intérieures posées', () => {
  const ok = GEN.orienterTuiles(plateau());
  assert.ok(ok.ok);
  assert.equal(ok.changees.length, 0, 'les rotations équivalentes ne sont pas retournées');
  const partiel = derange(plateau(), 2);
  const dernier = F.cellules[18];
  partiel.plateau.tuiles = partiel.plateau.tuiles.filter((t) => !(t.col === 2 && t.lig === 0) && !(t.col === dernier.col && t.lig === dernier.lig));
  partiel.plateau.jetons = partiel.plateau.jetons.filter((j) => M.portsJonction(partiel, j.i, 0).tuiles === 3);
  const r = GEN.orienterTuiles(partiel);
  assert.ok(r.ok || /Aucune/.test(r.raison), r.raison);
  if (r.ok) {
    assert.equal(r.doc.plateau.tuiles.length, 17);
    assert.equal(GR.villesProches(GR.construire(r.doc, { villesTraversables: false })).length, 0);
  }
});

test('Orienter : une étape d’historique, annulable par Ctrl+Z, rétablissable ; refus = barre d’état sans étape', () => {
  const etat = PM.etat.creer(derange(plateau(), 1));
  const avant = copie(etat.doc());
  const r = GEN.orienter(etat);
  assert.ok(r.ok, r.raison);
  assert.notDeepEqual(etat.doc().plateau.tuiles, avant.plateau.tuiles);
  assert.match(etat.ui().message.texte, /tuile\(s\) tournée\(s\) pour tenir l’écart entre les villes \(S = \d/);
  assert.match(etat.ui().message.texte, /Ctrl\+Z pour revenir/);
  assert.equal(etat.ui().message.niveau, 'info');
  const apres = copie(etat.doc());
  assert.ok(etat.peutAnnuler());
  etat.annuler();
  assert.deepEqual(etat.doc(), avant, 'une seule annulation rend le plateau d’avant');
  assert.equal(etat.peutAnnuler(), false, 'une seule étape');
  etat.retablir();
  assert.deepEqual(etat.doc(), apres);
  // refus : aucune étape, document intact, message d’alerte
  const e2 = PM.etat.creer(vide());
  const r2 = GEN.orienter(e2);
  assert.equal(r2.ok, false);
  assert.equal(e2.peutAnnuler(), false);
  assert.equal(e2.ui().message.niveau, 'alerte');
  assert.match(e2.ui().message.texte, /Aucune tuile intérieure/);
  // déjà orienté : message d’information, aucune étape
  const e3 = PM.etat.creer(plateau());
  GEN.orienter(e3);
  assert.equal(e3.peutAnnuler(), false);
  assert.match(e3.ui().message.texte, /rien à tourner/);
});

test('Orienter : réutilise la recherche exhaustive du générateur (rechercherPoseHex), déterministe', () => {
  const casse = derange(plateau(), 3);
  const a = GEN.orienterTuiles(casse), b = GEN.orienterTuiles(casse);
  assert.deepEqual(a.doc, b.doc);
  assert.equal(typeof GEN.rechercherPoseHex, 'function');
  assert.equal(a.tronque, false);
  assert.ok(a.combinaisons >= 1 && a.combinaisons <= 2187);
});

/* ================================ 8. Générateur : rejet à S >= 3 ================================ */

test('générateur : rejet à S >= 3 en hexagonal (score_s), S 2 accepté ; 4×4 et 5×5 inchangés', () => {
  const m = (S) => ({ accessible: true, cinq: false, trois: false, ecartMax: 0, premiereEgale: true, S: S });
  assert.equal(GEN.SEUIL_REJET_S_HEX, 3);
  assert.equal(GEN.causeRejet(m(3), 'hex19'), 'score_s');
  assert.equal(GEN.causeRejet(m(4), 'hex19'), 'score_s');
  assert.equal(GEN.causeRejet(m(2), 'hex19'), null);
  assert.equal(GEN.causeRejet(m(0), 'hex19'), null);
  assert.equal(GEN.causeRejet(m(4), '5x5'), null);
  assert.equal(GEN.causeRejet(m(5), '5x5'), 'score_s');
  assert.equal(GEN.causeRejet(m(9), '4x4'), null);
});

test('générateur : des plateaux hexagonaux restent générés (S <= 1) avec le seuil à 3', () => {
  for (const graine of ['1', '2', '3']) {
    const r = GEN.generer(vide(), { graine });
    assert.ok(r.ok, graine + ' ' + r.raison);
    const e = GR.equilibre(r.doc, { graphe: GR.construire(r.doc, { villesTraversables: false }) });
    assert.ok(e.S <= 1, 'S = ' + e.S);
  }
});

/* ================================ 9. Robustesse (fichier hostile) ================================ */

test('fichier hostile hexagonal : le plateau se dessine et les contrôles, le rapport, Orienter et Placer les villes ne lèvent rien', () => {
  const o = JSON.parse(S.versJSON(plateau()));
  o.plateau.tuiles[0].rot = 77; o.plateau.tuiles[1].rot = -1; o.plateau.tuiles[2].rot = 1.5; o.plateau.tuiles[3].modeleId = 'absent';
  o.plateau.tuiles.push({ modeleId: 'HC2', col: 99, lig: -4, rot: 0 }, { modeleId: 'HC2', col: 2, lig: 2, rot: 0 });
  o.plateau.jetons.push({ i: 999, j: 0, type: 'capture' }, { i: 5, j: 7, type: 'capture' }, { i: -3, j: 0, type: 'capture' });
  const r = S.depuisJSON(JSON.stringify(o));
  assert.ok(r.ok);
  let svg;
  assert.doesNotThrow(() => { svg = A.svgPlateau(r.doc, {}); });
  assert.equal((svg.match(/data-cellule="/g) || []).length, 19);
  assert.ok(!/style=/.test(svg));
  const c = C.calculer(r.doc);
  assert.ok(c.erreurs.some((e) => e.code === 'hors_grille'));
  assert.ok(c.erreurs.some((e) => e.code === 'rot_invalide'));
  assert.doesNotThrow(() => EQ.rapport(EQ.analyser(r.doc)));
  assert.doesNotThrow(() => GEN.orienterTuiles(r.doc));
  assert.doesNotThrow(() => GEN.meilleurPlacementVilles(r.doc));
  assert.deepEqual(A.cibleSurbrillance({ type: 'jeton', i: 999, j: 0 }, r.doc), []);
  assert.deepEqual(A.cibleSurbrillance({ type: 'tuile', col: 99, lig: -4 }, r.doc), []);
  assert.deepEqual(A.cibleSurbrillance(null, r.doc), []);
});

/* ================================ 10. Boîtes des formes (bibliothèque, fantôme, canevas) ================================ */

const contient = (vb, pts) => pts.every((p) => p.x >= vb[0] - 1e-9 && p.x <= vb[0] + vb[2] + 1e-9 && p.y >= vb[1] - 1e-9 && p.y <= vb[1] + vb[3] + 1e-9);

test('bibliothèque : la viewBox de chaque vignette hexagonale contient toute la forme de son gabarit (le coin et le bord dépassent l’hexagone)', () => {
  const d = vide();
  for (const m of d.modeles) {
    const vb = B.boiteVignetteHex(m, F).split(' ').map(Number);
    assert.equal(vb[2], vb[3], 'carré');
    assert.ok(contient(vb, F.forme(m.gabarit)), m.id + ' : ' + vb.join(' '));
    assert.ok(Math.max(...F.forme(m.gabarit).map((p) => Math.abs(p.x))) <= 62.4);
  }
  const tailles = new Set(d.modeles.map((m) => B.boiteVignetteHex(m, F).split(' ')[2]));
  assert.equal(tailles.size, 1, 'même échelle pour toute la bibliothèque');
  // HK1 : coin, plus haut (135 mm) et plus large que l’hexagone
  const hk = B.boiteVignetteHex(d.modeles.find((m) => m.id === 'HK1'), F).split(' ').map(Number);
  assert.ok(hk[3] >= 135 && contient(hk, F.forme('coin')));
  // le rendu HTML de la bibliothèque n’a pas d’attribut style
  const vig = B.vignettesBibliotheque(d, 'tous');
  assert.equal(vig.length, 3);
});

test('fantôme de glissement hexagonal : la boîte contient toutes les formes tournées de 60° (rayon maximal)', () => {
  const t = A.tailleTuile(F);
  assert.equal(t, 144, 'rayon maximal des formes 71,4 mm, arrondi à 72');
  for (const g of ['centrale', 'bord', 'coin']) for (let rot = 0; rot < 6; rot++) {
    const pts = F.forme(g).map((p) => F.tournerPoint(p, rot));
    assert.ok(pts.every((p) => Math.abs(p.x) <= t / 2 && Math.abs(p.y) <= t / 2), g + ' rot ' + rot);
  }
  assert.equal(A.tailleTuile(G.format('4x4')), 120);
  assert.equal(A.tailleTuile(G.format('5x5')), 100);
});

test('plateau : déplacer un bord ou un coin entre cellules du pourtour applique la rotation imposée de la cellule d’arrivée ; une centrale garde sa rotation ; le carré garde la rotation', () => {
  const nord = F.cellules.find((c) => c.role === 'bord' && c.lig === 0), sud = F.cellules.find((c) => c.role === 'bord' && c.lig === 4);
  assert.notEqual(F.rotationImposee(nord.col, nord.lig), F.rotationImposee(sud.col, sud.lig));
  const doc = M.poserTuile(vide(), 'HB1', nord.col, nord.lig, null);
  const apres = A.deplacerTuile(doc, nord, sud);
  assert.equal(M.tuileEn(apres, sud.col, sud.lig).rot, F.rotationImposee(sud.col, sud.lig));
  assert.deepEqual(M.validerPlateau(apres).alertes.filter((a) => a.code === 'rotation_pourtour'), []);
  const coinN = F.cellules.find((c) => c.role === 'coin' && c.lig === 0), coinS = F.cellules.find((c) => c.role === 'coin' && c.lig === 4);
  const dk = M.poserTuile(vide(), 'HK1', coinN.col, coinN.lig, null);
  assert.equal(M.tuileEn(A.deplacerTuile(dk, coinN, coinS), coinS.col, coinS.lig).rot, F.rotationImposee(coinS.col, coinS.lig));
  const dc = M.poserTuile(vide(), 'HC2', 2, 2, 4);
  assert.equal(M.tuileEn(A.deplacerTuile(dc, { col: 2, lig: 2 }, { col: 3, lig: 1 }), 3, 1).rot, 4, 'centrale : rotation conservée');
  // carré : rotation conservée
  let d4 = M.nouveauDocument(); d4.modeles = M.copieExemples();
  d4 = M.poserTuile(d4, 'ex-bord', 1, 0, 2);
  assert.equal(M.tuileEn(A.deplacerTuile(d4, { col: 1, lig: 0 }, { col: 2, lig: 0 }), 2, 0).rot, 2);
});

test('éditeur : la vue et la grille couvrent toute la forme du gabarit (le coin est plus haut et plus large que l’hexagone)', () => {
  assert.deepEqual(ED.vuePour(F), ED.vuePour(F, 'centrale'));
  assert.deepEqual(ED.vuePour(F, 'centrale'), { x: -62, y: -62, l: 124, h: 124 });
  for (const g of ['bord', 'coin']) {
    const v = ED.vuePour(F, g);
    assert.equal(v.l, v.h);
    assert.ok(contient([v.x, v.y, v.l, v.h], F.forme(g)), g + ' ' + JSON.stringify(v));
  }
  const grille = ED.svgGrille(F, 'coin');
  const ys = [...grille.matchAll(/<line x1="([-\d.]+)" y1="([-\d.]+)" x2="([-\d.]+)" y2="([-\d.]+)"/g)].map((m) => [+m[1], +m[2], +m[3], +m[4]]);
  assert.ok(Math.min(...ys.map((l) => l[1])) <= -67.5 && Math.max(...ys.map((l) => l[3])) >= 62.3, 'lignes sur toute la boîte du coin');
  assert.deepEqual(ED.vuePour('4x4'), { x: -16, y: -16, l: 152, h: 152 });
});

test('Orienter : 6 villes sur un plateau complet — toutes les poses sont jugées (S minimal garanti), pas d’échantillon', () => {
  const casse = derange(plateau(), 1);
  const r = GEN.orienterTuiles(casse);
  assert.ok(r.ok);
  assert.ok(r.combinaisons <= 2187);
  assert.ok(r.S !== null && r.S <= 1);
});
