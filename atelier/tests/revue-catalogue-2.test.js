'use strict';
// Corrections décidées après la revue du catalogue 2 (docs/08-revue-catalogue-2.md). Un test au moins par constat,
// nommé par son numéro : I1 à I4, M1 à M8, M10.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const V = require('../src/vue-villes.js');
const VC = require('../src/vue-creation.js');
const VP = require('../src/vue-plateau.js');
const VI = require('../src/vue-inventaire.js');
require('../src/cartes.js');
require('../src/paquets.js');
require('../src/partie.js');
const { verifier } = require('../outils/verifier-regles.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles, G = AT.generateur, T = AT.partie;

const copie = (o) => JSON.parse(JSON.stringify(o));
const garde = {};
const genere = (graine) => { if (!garde[graine]) { const g = G.generer(graine); assert.ok(g.ok, g.raison); garde[graine] = JSON.stringify(g.plateau); } return JSON.parse(garde[graine]); };
const env = (graine) => ({ alea: AT.alea.creer(graine), hex: H, plateau: P });
const erreurs = (bilan) => bilan.resultats.filter((x) => x.niveau === 'erreur').map((x) => x.message);
const alertes = (bilan) => bilan.resultats.filter((x) => x.niveau === 'alerte').map((x) => x.message);
const fixture = (dossier, nom) => P.lire(fs.readFileSync(path.join(__dirname, dossier, nom), 'utf8')).plateau;
const FORET3 = [{ q: 0, r: 0, terrain: 'foret' }, { q: 1, r: 0, terrain: 'plaine' }, { q: 1, r: 1, terrain: 'plaine' }];
const forme = (n, terrains) => [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]].slice(0, n).map((c, i) => ({ q: c[0], r: c[1], terrain: terrains[i] || terrains[terrains.length - 1] }));

/** Cases vides qui touchent le plateau : clés triées. */
function anneau(plateau) {
  const toutes = P.cases(plateau, { sansRecouvrements: true }), vues = new Set();
  Object.keys(toutes).forEach((k) => H.voisines(k).forEach((v) => { if (!toutes[v]) vues.add(v); }));
  return H.trier([...vues]);
}
/** Pose le modèle (hors stock) contre le plateau, à la première place et rotation acceptées par `condition`. */
function poserContre(plateau, idModele, condition) {
  for (const k of anneau(plateau)) {
    const c = H.decle(k);
    for (let rot = 0; rot < 6; rot++) {
      const r = P.poser(plateau, idModele, c.q, c.r, rot, { horsStock: true });
      if (r.ok && (!condition || condition(P.avecCamps(r.plateau)))) return P.avecCamps(r.plateau);
    }
  }
  return null;
}
/** Peint le terrain sur la première case du pourtour acceptée par `condition`. */
function peindreContre(plateau, terrain, condition) {
  for (const k of anneau(plateau)) {
    const r = P.peindre(plateau, k, terrain);
    if (r.ok && (!condition || condition(P.avecCamps(r.plateau)))) return P.avecCamps(r.plateau);
  }
  return null;
}
const avecPerso = (plateau, nom, cases) => { const r = P.ajouterModele(plateau, { nom: nom, quantite: 1, cases: cases }); assert.ok(r.ok, r.raison); return r; };
const conformeK = (p) => K.tout(p).ok;
const conformeV = (p) => verifier(p, 3, 'pieces', 2).fautes.length === 0;

// ------------------------------------------------------------------ I1 et M1

test('I1 : un plateau fait avec le catalogue précédent a son état propre : rien « à poser », étape jugée sur les villes, une seule alerte de construction', () => {
  ['plateau-genere.json', 'plateau-retouche.json'].forEach((nom) => {
    const p = fixture('fixtures-v2', nom), cat = P.catalogueDuPlateau(p), b = K.tout(p);
    assert.deepStrictEqual([cat.nom, cat.precedent, cat.monoblocsRetires], ['precedent', true, 14], nom);
    assert.strictEqual(b.catalogue, 'precedent');
    assert.strictEqual(b.ok, true, nom + ' : ' + erreurs(b).join(' | '));
    assert.strictEqual(b.erreurs, 0);
    assert.strictEqual(b.etape, 'complet', 'il a ses 6 villes : complet');
    assert.strictEqual(b.etapeTitre, 'Plateau du catalogue précédent');
    assert.match(b.etapeMessage, /^14 de ses monoblocs ne sont plus au catalogue imprimé ; il reste lisible, jouable et modifiable, et aucune pièce n’est à poser\. Ses villes sont posées\.$/);
    assert.deepStrictEqual(b.construction, { erreurs: 0, alertes: 1, terminee: true, restantes: 0 });
    const construction = b.resultats.filter((x) => x.groupe === 'construction' && x.niveau === 'alerte');
    assert.strictEqual(construction.length, 1, 'une seule alerte de construction');
    assert.match(construction[0].message, /^14 monoblocs d’un ancien catalogue sur le plateau/);
    assert.ok(!b.resultats.some((x) => /Pièces de terrain restantes|pièces? de terrain à poser|Construction en cours|Tuiles facultatives/.test(x.message)), b.resultats.map((x) => x.message).join(' | '));
    assert.deepStrictEqual(K.etape(p).detail, []);
    // « Reste à faire » et panneau des villes : aucune pièce de terrain à poser.
    const reste = VC.resteAFaire(p, b);
    assert.deepStrictEqual([reste.catalogue, reste.nbPieces, reste.pieces, reste.etape], ['precedent', 0, [], 'complet']);
    assert.strictEqual(V.compteurs(p).construction, 0);
    assert.strictEqual(VC.estAncien(p), false, 'ce n’est pas un plateau du premier catalogue');
    // Sans ses villes : étape « villes », toujours sans erreur ni pièce à poser.
    const nu = V.retirerToutes(p).plateau, bn = K.tout(nu);
    assert.deepStrictEqual([bn.etape, bn.erreurs, bn.construction.restantes, bn.etapeTitre], ['villes', 0, 0, 'Plateau du catalogue précédent']);
    assert.match(bn.etapeMessage, /Villes à poser : 2 villes neutres, 2 villes de déploiement pour Vert, 2 villes de déploiement pour Rouge\.$/);
    // Il se rouvre, se réenregistre et porte une partie.
    assert.deepStrictEqual(P.lire(P.serialiser(p)).plateau, p);
    assert.ok(T.creer({ graine: 1, plateau: { version: p.version, graine: p.graine, pieces: p.pieces, recouvrements: [], camps: p.camps, deploiements: p.deploiements } }, env(1)).ok);
  });
  // Les villes neutres de ces plateaux sont des tuiles ajoutées contre le plateau (règles précédentes) : alerte, pas erreur.
  const b = K.tout(fixture('fixtures-v2', 'plateau-genere.json'));
  const villes = b.resultats.filter((x) => x.groupe === 'villes' && x.niveau === 'alerte');
  assert.strictEqual(villes.length, 1);
  assert.match(villes[0].message, /^Règles précédentes pour les villes : 2 villes neutres en tuiles ajoutées contre le plateau \(-7,0\) \(5,0\)\./);
  assert.strictEqual(b.alertes, 2);
});

test('I1 : la frontière entre « catalogue précédent » et « catalogue courant »', () => {
  // Plateau du catalogue courant auquel on ajoute un monobloc retiré : il reste « courant » (il porte des monoblocs
  // apparus depuis), et ce monobloc tout en plaine y est hors règles.
  const ajoute = poserContre(genere(1), 'P3A');
  assert.ok(ajoute);
  assert.strictEqual(P.catalogueDuPlateau(ajoute).nom, 'courant');
  assert.ok(erreurs(K.tout(ajoute)).some((m) => /^Hors règles : 1 monobloc tout en plaine \(1 × Pré en triangle \(ancien\)\)/.test(m)));
  // Choix consigné : le noyau et un seul monobloc retiré, sans aucun monobloc du catalogue courant = « précédent ».
  const debut = P.poser(P.vierge(1), 'P3A', 3, 0, 0, { horsStock: true }).plateau;
  assert.strictEqual(P.catalogueDuPlateau(debut).nom, 'precedent');
  assert.strictEqual(K.tout(debut).construction.restantes, 0);
  // Dès qu'un monobloc apparu depuis est posé à côté : « courant », et le pré est hors règles.
  const mixte = P.poser(debut, 'F12A', -3, 0, 0).plateau;
  assert.strictEqual(P.catalogueDuPlateau(mixte).nom, 'courant');
  assert.strictEqual(K.tout(mixte).ok, false);
  // Les 7 monoblocs gardés d'un catalogue à l'autre ne suffisent pas à faire un plateau « précédent ».
  assert.strictEqual(P.catalogueDuPlateau(P.poser(P.vierge(1), 'F31', 3, 0, 0).plateau).nom, 'courant');
  assert.strictEqual(P.catalogueDuPlateau(P.vierge(1)).nom, 'courant');
  assert.strictEqual(P.catalogueDuPlateau(P.vide(1)).nom, 'courant');
  // Premier catalogue : inchangé.
  const v1 = fixture('fixtures-v1', 'plateau-genere.json'), b1 = K.tout(v1);
  assert.deepStrictEqual([P.catalogueDuPlateau(v1).nom, b1.catalogue, b1.erreurs, b1.etapeTitre, K.etape(v1).ancien], ['premier', 'premier', 0, 'Plateau de l’ancien catalogue', true]);
  assert.strictEqual(VC.estAncien(v1), true);
  assert.strictEqual(VI.parRole(v1).ancien.present, true);
  assert.strictEqual(VI.parRole(fixture('fixtures-v2', 'plateau-genere.json')).ancien.present, false);
});

test('M1 : une seule définition de « ancien », dans le modèle ; une forêt peinte ne fait pas un ancien plateau', () => {
  const foret = P.peindre(P.vierge(1), '3,0', 'foret').plateau, e = K.etape(foret);
  assert.deepStrictEqual([P.catalogueDuPlateau(foret).nom, e.catalogue, e.ancien, e.etape], ['courant', 'courant', false, 'construction']);
  assert.strictEqual(e.message, 'Construction en cours : 23 pièces de terrain à poser.');
  assert.strictEqual(e.titre, 'Construction en cours');
  assert.ok(!/ancien/.test(e.message + K.tout(foret).etapeMessage));
  // Une tuile de ville d'une case (elle ne vient que d'un fichier) : premier catalogue, pour le modèle comme pour les vues.
  const avecV = P.poser(P.poser(P.vierge(1), 'F31', 3, 0, 0).plateau, 'V', -3, 0, 0, { horsStock: true }).plateau;
  assert.strictEqual(P.catalogueDuPlateau(avecV).nom, 'premier');
  assert.strictEqual(K.etape(avecV).ancien, true);
  assert.strictEqual(VC.estAncien(avecV), true);
  assert.strictEqual(VC.resteAFaire(avecV).catalogue, 'premier');
  assert.strictEqual(VI.parRole(avecV).ancien.present, true);
  // Aucune vue ne refait le test elle-même, et plus aucun remplacement de texte dans vue-plateau.js.
  const src = path.join(__dirname, '..', 'src');
  fs.readdirSync(src).filter((f) => f.endsWith('.js')).forEach((f) => {
    const texte = fs.readFileSync(path.join(src, f), 'utf8');
    assert.ok(!/modele === 'V'|mentionAncien/.test(texte), f + ' : la définition de « ancien » est dans AT.plateau.catalogueDuPlateau');
    if (f !== 'plateau.js' && f !== 'catalogue.js') assert.ok(!/m\.ancien === true && m\.cases\.length === 1/.test(texte), f);
  });
  assert.ok(!/\.split\(/.test(fs.readFileSync(path.join(src, 'vue-plateau.js'), 'utf8').split('\n').filter((l) => /etapeMessage/.test(l)).join('\n')));
});

// ------------------------------------------------------------------ I2

test('I2 : sur un plateau du catalogue courant, ce qui enfreint les règles de l’utilisateur est une erreur « hors règles » ; contrôles et vérificateur rendent le même verdict', () => {
  const base = genere(1);
  assert.strictEqual(conformeK(base) && conformeV(base), true);
  const cas = [];
  const fautif = (nom, plateau, motifK, motifV) => cas.push({ nom, plateau, attendu: false, motifK, motifV });
  const sain = (nom, plateau) => cas.push({ nom, plateau, attendu: true });

  // --- hors règles : tuiles de terrain d'une case
  fautif('forêt d’une case', peindreContre(base, 'foret'), /^Hors règles : 1 tuile de terrain d’une case \(1 × Forêt\)/, /^B1 : pièce de terrain de 1 case/);
  fautif('marais d’une case', peindreContre(base, 'marais'), /^Hors règles : 1 tuile de terrain d’une case \(1 × Marais\)/, /^B1 : pièce de terrain de 1 case/);
  let troisPlaines = base;
  for (let i = 0; i < 3; i++) troisPlaines = peindreContre(troisPlaines, 'plaine');
  assert.deepStrictEqual(troisPlaines.pieces.slice(-3).map((x) => x.modele), ['R', 'R', 'P'], 'deux remplissages du stock, puis une plaine hors stock');
  fautif('plaine d’une case au-delà des 2 remplissages', troisPlaines, /^Hors règles : 1 tuile de terrain d’une case \(1 × Plaine\)/, /^B1 : pièce de terrain de 1 case\(s\) \(P\)/);
  fautif('montagne d’une case', peindreContre(base, 'montagne'), /^Hors règles : 1 montagne d’une case\. Les montagnes sont des blocs de 4 ou 5 cases\.$/, /^B1 : montagne de 1 case/);
  // --- hors règles : monoblocs tout en plaine
  fautif('monobloc retiré tout en plaine (P3A)', poserContre(base, 'P3A'), /^Hors règles : 1 monobloc tout en plaine \(1 × Pré en triangle \(ancien\)\)/, /^B1 : monobloc tout en plaine \(P3A\)/);
  const pre = avecPerso(base, 'Grand pré', forme(3, ['plaine']));
  fautif('monobloc personnel tout en plaine', poserContre(pre.plateau, pre.id), /^Hors règles : 1 monobloc tout en plaine \(1 monobloc personnel \(Grand pré\)\)/, /^B1 : monobloc tout en plaine/);
  // --- hors règles : taille d'un monobloc personnel
  [2, 5, 6].forEach((n) => {
    const x = avecPerso(base, 'Bande de ' + n, forme(n, ['foret', 'plaine']));
    fautif('monobloc personnel de ' + n + ' cases (avec une forêt)', poserContre(x.plateau, x.id), new RegExp('^Hors règles : 1 monobloc personnel qui ne est pas de 3 ou 4 cases \\(Bande de ' + n + '\\)'.replace('ne est', 'n’est')),
      new RegExp('^B1 : pièce de terrain de ' + n + ' case'));
  });
  // --- hors règles : montagne (extension du même principe : « montagnes en blocs de 4 ou 5 cases »)
  const col = avecPerso(base, 'Col', forme(3, ['montagne', 'plaine', 'foret']));
  fautif('monobloc personnel qui mêle montagne et terrain', poserContre(col.plateau, col.id), /^Hors règles : 1 monobloc personnel avec de la montagne hors bloc de 4 ou 5 cases \(Col\)/, /^B1 : pièce .* de terrains mêlés/);
  const pics = avecPerso(base, 'Trois pics', forme(3, ['montagne']));
  fautif('bloc de montagne personnel de 3 cases', poserContre(pics.plateau, pics.id), /^Hors règles : 1 monobloc personnel avec de la montagne hors bloc de 4 ou 5 cases \(Trois pics\)/, /^B1 : montagne de 3 case/);

  // --- conformes : les cas voisins qui ne doivent PAS être mis en erreur
  sain('plateau généré', base);
  sain('une tuile de remplissage du stock', peindreContre(base, 'plaine', (p) => conformeK(p)));
  sain('deux tuiles de remplissage du stock', peindreContre(peindreContre(base, 'plaine', (p) => conformeK(p)), 'plaine', (p) => conformeK(p)));
  const bois = avecPerso(base, 'Petit bois', FORET3);
  sain('monobloc personnel de 3 cases avec une forêt', poserContre(bois.plateau, bois.id, (p) => conformeK(p)));
  const quatre = avecPerso(base, 'Quatre', forme(4, ['marais', 'plaine']));
  sain('monobloc personnel de 4 cases avec un marais', poserContre(quatre.plateau, quatre.id, (p) => conformeK(p)));
  const massif = avecPerso(base, 'Massif', forme(4, ['montagne']));
  sain('bloc de montagne personnel de 4 cases', poserContre(massif.plateau, massif.id, (p) => conformeK(p)));
  sain('monobloc retiré qui respecte les règles (F22 : 2 forêts, 2 plaines)', poserContre(base, 'F22', (p) => conformeK(p)));

  cas.forEach((x) => {
    assert.ok(x.plateau, x.nom + ' : aucune place trouvée pour monter le cas');
    const b = K.tout(x.plateau), v = verifier(x.plateau, 3, 'pieces', 2);
    assert.strictEqual(b.ok, x.attendu, x.nom + ' (contrôles) : ' + erreurs(b).join(' | '));
    assert.strictEqual(v.fautes.length === 0, x.attendu, x.nom + ' (vérificateur) : ' + v.fautes.join(' | '));
    if (x.attendu) return;
    const constat = b.resultats.filter((c) => c.niveau === 'erreur' && x.motifK.test(c.message))[0];
    assert.ok(constat, x.nom + ' : erreur « hors règles » attendue. ' + erreurs(b).join(' | '));
    assert.strictEqual(constat.groupe, 'construction');
    assert.ok(constat.cases.length > 0, x.nom + ' : cases en surbrillance');
    assert.strictEqual(constat.donnees.horsRegles, true);
    assert.ok(v.fautes.some((f) => x.motifV.test(f)), x.nom + ' : faute B1 attendue du vérificateur. ' + v.fautes.join(' | '));
    // Le plateau ne peut pas être « complet, aucune erreur », mais il reste enregistrable et relisible.
    assert.ok(b.construction.erreurs >= 1);
    assert.ok(P.lire(P.serialiser(x.plateau)).ok, x.nom + ' : enregistrable');
  });
  assert.strictEqual(cas.filter((x) => !x.attendu).length, 11);
  // F22 sur un plateau courant : conforme aux règles, mais signalé en alerte (il n'est plus au catalogue imprimé).
  const f22 = cas.filter((x) => /F22/.test(x.nom))[0].plateau;
  assert.ok(alertes(K.tout(f22)).some((m) => /^1 monobloc d’un ancien catalogue sur le plateau \(1 × Futaie \(ancien\)\)/.test(m)));
});

test('I2 : divergence voulue et consignée : un plateau du catalogue précédent est conforme pour les contrôles, non conforme pour le vérificateur (règles d’aujourd’hui)', () => {
  const p = fixture('fixtures-v2', 'plateau-genere.json');
  assert.strictEqual(K.tout(p).ok, true);
  const v = verifier(p, 3, 'pieces', 2);
  assert.ok(v.fautes.some((f) => /^B1 : monobloc tout en plaine \(P4A\)/.test(f)));
  assert.ok(v.fautes.some((f) => /^B3 : pièce F31C : 0 posée/.test(f)));
  // Sur un ancien plateau, une tuile peinte reste une alerte (il ne se juge pas avec les règles du catalogue courant).
  const peint = peindreContre(p, 'foret');
  assert.ok(alertes(K.tout(peint)).some((m) => /^Tuiles à prévoir en plus du catalogue \(1\) : 1 × Forêt\.$/.test(m)));
  assert.ok(!erreurs(K.tout(peint)).some((m) => /Hors règles/.test(m)));
});

test('I2 : le pinceau et l’éditeur disent « hors règles, signalé par les contrôles » ; les poses restent possibles', () => {
  const foret = P.peindre(P.vierge(1), '3,0', 'foret');
  assert.strictEqual(foret.ok, true);
  assert.match(foret.note, /hors règles \(le terrain se construit en monoblocs\) : les contrôles la signalent\.$/);
  const trait = VC.bilanTrait(VC.tracer(P.vierge(1), { type: 'terrain', terrain: 'marais' }, ['3,0', '4,0']));
  assert.match(trait.message, /Hors règles \(le terrain se construit en monoblocs de 3 ou 4 cases\) : signalé par les contrôles\.$/);
  assert.strictEqual(trait.change, true);
  // Une plaine prise dans les remplissages du stock : rien à signaler.
  assert.strictEqual(P.peindre(P.vierge(1), '3,0', 'plaine').note, null);
  // Éditeur de monoblocs : ce que la forme a de contraire aux règles.
  assert.deepStrictEqual(K.horsReglesForme(FORET3), []);
  assert.deepStrictEqual(K.horsReglesForme(forme(4, ['montagne'])), []);
  assert.deepStrictEqual(K.horsReglesForme(forme(5, ['montagne'])), []);
  assert.match(K.horsReglesForme(forme(3, ['plaine'])).join(' ; '), /^tout en plaine \(chaque monobloc de terrain porte au moins une forêt ou un marais\)$/);
  assert.match(K.horsReglesForme(forme(2, ['foret', 'plaine'])).join(' ; '), /^2 cases \(un monobloc de terrain compte 3 ou 4 cases\)$/);
  assert.match(K.horsReglesForme(forme(6, ['plaine'])).join(' ; '), /^6 cases \(un monobloc de terrain compte 3 ou 4 cases\) ; tout en plaine/);
  assert.match(K.horsReglesForme(forme(3, ['montagne'])).join(' ; '), /^montagne de 3 cases \(les montagnes sont des blocs de 4 ou 5 cases\)$/);
  assert.match(K.horsReglesForme(forme(3, ['montagne', 'plaine'])).join(' ; '), /^montagne mêlée à un autre terrain/);
  // Toutes ces formes restent acceptées par le modèle (on essaie des idées).
  [forme(3, ['plaine']), forme(2, ['foret', 'plaine']), forme(6, ['plaine']), forme(3, ['montagne', 'plaine'])].forEach((cases) => assert.ok(P.ajouterModele(P.vierge(1), { nom: 'Essai', quantite: 1, cases: cases }).ok));
});

// ------------------------------------------------------------------ I3 et I4

// ------------------------------------------------------------------ M2 à M8, M10

test('M2 : la pose automatique et « Autre proposition » ignorent une Plaine couverte par une tuile d’événement', () => {
  const nu = V.retirerToutes(genere(7)).plateau, libre = V.poserAuto(nu, nu.graine, {});
  assert.ok(libre.ok, libre.raison);
  const cle = libre.plateau.camps.vert[0];
  const couvert = P.poserEvenement(nu, 'E5', cle);
  assert.ok(couvert.ok, couvert.raison);
  const auto = V.poserAuto(couvert.plateau, nu.graine, {});
  assert.ok(auto.ok, auto.raison);
  assert.ok(P.deploiements(auto.plateau).every((d) => d.cle !== cle), 'la Plaine inondée n’est pas choisie');
  assert.strictEqual(auto.plateau.recouvrements.length, 1, 'la tuile d’événement reste');
  const b = K.tout(auto.plateau);
  assert.deepStrictEqual([b.erreurs, b.etape], [0, 'complet'], erreurs(b).join(' | '));
  let p = auto.plateau;
  for (let i = 0; i < 6; i++) {
    const r = V.autreProposition(p, {});
    assert.ok(r.ok, r.raison);
    assert.ok(P.deploiements(r.plateau).every((d) => d.cle !== cle));
    p = r.plateau;
  }
  // Sans tuile d'événement, rien ne change.
  assert.deepStrictEqual(V.poserAuto(nu, nu.graine, {}).plateau, libre.plateau);
});

test('M4 : l’équilibre dit quel camp est avantagé ; la ville adverse la plus proche, toujours égale, ne compte plus', () => {
  let penches = 0;
  for (let g = 1; g <= 30; g++) {
    const e = K.equilibre(genere(g));
    assert.strictEqual(e.calculable, true);
    // Premier rang « adverse » : identique pour les deux camps, sur tous les plateaux.
    assert.strictEqual(e.adverses.vert[0], e.adverses.rouge[0], 'graine ' + g);
    assert.strictEqual(e.adverses.ecart, Math.abs(e.adverses.vert[1] - e.adverses.rouge[1]));
    assert.deepStrictEqual([e.adverses.vertLoin, e.adverses.rougeLoin], [e.adverses.vert[1], e.adverses.rouge[1]]);
    // Le score ne change pas ; les avantages le répartissent entre les camps.
    const centreEtNeutres = e.villes.filter((v) => v.ecart !== null).reduce((n, v) => n + v.ecart, 0);
    assert.strictEqual(e.score, centreEtNeutres + e.adverses.ecart);
    assert.strictEqual(e.avantages.vert + e.avantages.rouge, e.score);
    assert.strictEqual(e.avantageNet, e.avantages.vert - e.avantages.rouge);
    assert.strictEqual(e.avantage, e.avantageNet > 0 ? 'vert' : (e.avantageNet < 0 ? 'rouge' : null));
    e.villes.filter((v) => v.ecart !== null).forEach((v) => assert.strictEqual(v.avantage, v.vert < v.rouge ? 'vert' : (v.rouge < v.vert ? 'rouge' : null)));
    assert.strictEqual(e.avantageTexte, K.texteAvantage(e.avantages));
    if (e.score) penches += 1;
    assert.match(K.controleEquilibre(genere(g))[0].message, new RegExp('Sens : ' + e.avantageTexte.replace(/[()]/g, '\\$&') + '\\.$'));
  }
  // La pose automatique minimise désormais le déséquilibre : un plateau penché se trouve dans les fichiers témoins.
  assert.ok(penches >= 0 && K.equilibre(fixture('fixtures-v3', 'plateau-genere.json')).score > 0);
  assert.strictEqual(K.texteAvantage({ vert: 0, rouge: 0 }), 'aucun camp avantagé');
  assert.strictEqual(K.texteAvantage({ vert: 9, rouge: 0 }), 'avantage Vert de 9');
  assert.strictEqual(K.texteAvantage({ vert: 0, rouge: 4 }), 'avantage Rouge de 4');
  assert.strictEqual(K.texteAvantage({ vert: 3, rouge: 2 }), 'avantage Vert de 3 et avantage Rouge de 2 (ils se compensent en partie)');
  assert.deepStrictEqual([K.texteAvantageLigne('vert', 3), K.texteAvantageLigne(null, 0), K.texteAvantageLigne(null, null)], ['avantage Vert de 3', 'égal', '']);
});

test('M5 : la table de jeu s’en tient aux tuiles posées, avertit sans bloquer si « camps » ne leur correspond pas, et annonce un plateau sans villes de déploiement', () => {
  const p = genere(3);
  assert.deepStrictEqual(T.avisPlateau(p), []);
  assert.deepStrictEqual(T.villesDeDeploiement(p, 'vert'), p.camps.vert);
  // Fichier retouché à la main : `camps` désigne une forêt et une Plaine du noyau, les 4 tuiles sont gardées.
  const toutes = P.cases(p), foret = Object.keys(toutes).filter((k) => toutes[k].terrain === 'foret')[0];
  const partie = T.creer({ graine: 3, plateau: p }, env(3));
  assert.ok(partie.ok, partie.raison);
  const brut = JSON.parse(T.serialiser(partie.etat));
  brut.plateau.camps.vert = [foret, '1,0'];
  const charge = T.charger(JSON.stringify(brut), env(3));
  assert.ok(charge.ok, 'non bloquant : ' + charge.raison);
  const avis = T.avisPlateau(charge.etat.plateau);
  assert.strictEqual(avis.length, 1);
  assert.match(avis[0], /^Les villes de déploiement enregistrées pour Vert \(champ « camps »\) ne sont pas celles des tuiles posées : la table de jeu s’en tient aux tuiles posées\.$/);
  const e = charge.etat, j = 'vert', carte = e.paquets[j].main[0];
  const surForet = T.former(e, { joueur: j, numero: 1, carte: carte, cle: foret }, env(3));
  assert.strictEqual(surForet.ok, false, 'former sur la forêt citée dans « camps » : avertissement');
  assert.ok(surForet.avertissements.some((a) => a.code === 'hors-deploiement' || /n’est pas une ville de déploiement de Vert/.test(a.texte || a.message || '')), JSON.stringify(surForet.avertissements));
  assert.ok(T.former(e, { joueur: j, numero: 1, carte: carte, cle: foret, forcer: true }, env(3)).ok, '« Faire quand même » reste possible');
  assert.deepStrictEqual(T.villesDeDeploiement(e.plateau, j), p.camps.vert, 'les villes proposées sont celles des tuiles, pas la forêt de « camps »');
  const surTuile = T.former(e, { joueur: j, numero: 1, carte: carte, cle: p.camps.vert[0] }, env(3));
  assert.ok(surTuile.ok, 'la vraie ville de déploiement est acceptée sans avertissement : ' + surTuile.raison);
  // Plateau construit sans villes : la partie se crée, et c'est dit clairement.
  const nu = V.retirerToutes(p).plateau, sans = T.creer({ graine: 3, plateau: nu }, env(3));
  assert.ok(sans.ok, sans.raison);
  assert.match(T.avisPlateau(sans.etat.plateau)[0], /^Ce plateau n’a aucune ville de déploiement : former un bataillon demandera « Faire quand même »\. Posez d’abord les villes/);
  const unCamp = P.poserVille(nu, 'vert', V.places(nu, 'vert')[0]).plateau;
  assert.match(T.avisPlateau(unCamp)[0], /^Rouge n’a aucune ville de déploiement sur ce plateau/);
  // Ancien plateau (villes d'une case, pas de tuiles posées) : `camps` fait foi, rien à dire.
  const v1 = fixture('fixtures-v1', 'plateau-genere.json');
  assert.deepStrictEqual(T.avisPlateau(v1), []);
  assert.deepStrictEqual(T.villesDeDeploiement(v1, 'rouge'), v1.camps.rouge);
});

test('M6 : le noyau ne se tourne pas et ne se déplace pas (modèle et vues), avec un seul message', () => {
  const p = genere(1), noyau = p.pieces.filter((x) => x.modele === 'N1')[0], autre = p.pieces.filter((x) => x.modele === 'F3')[0];
  assert.match(P.RAISON_NOYAU_FIXE, /^Le noyau est fixe : il ne se tourne pas, ne se déplace pas et ne se retire pas\./);
  for (let pas = 1; pas <= 5; pas++) {
    const r = P.tourner(p, noyau.id, pas);
    assert.deepStrictEqual([r.ok, r.raison, r.noyau, r.plateau === p], [false, P.RAISON_NOYAU_FIXE, true, true]);
  }
  const seul = P.vierge(1);
  assert.strictEqual(P.tourner(seul, seul.pieces[0].id, 1).ok, false, 'même seul sur le plateau');
  const d = VP.deplacerPiece(seul, seul.pieces[0].id, 3, 0);
  assert.deepStrictEqual([d.ok, d.raison, d.plateau === seul], [false, P.RAISON_NOYAU_FIXE, true]);
  assert.strictEqual(VP.refusRetouche(p, noyau.id), P.RAISON_NOYAU_FIXE);
  assert.strictEqual(VP.refusRetouche(p, autre.id), null);
  // Une ancienne tuile de ville neutre (règles précédentes) ne se retouche qu'à l'étape « Villes ».
  const v3 = fixture('fixtures-v3', 'plateau-genere.json');
  assert.strictEqual(VP.refusRetouche(v3, P.etatVilles(v3).neutres[0].piece), P.RAISON_VILLE_NEUTRE);
  // Les autres pièces se tournent et se déplacent toujours ; la gomme garde son refus du noyau.
  assert.notStrictEqual(P.tourner(seul, P.poser(seul, 'F3', 3, 0, 0).id, 1).raison, P.RAISON_NOYAU_FIXE);
  assert.ok(VP.deplacerPiece(P.poser(seul, 'F3', 3, 0, 0).plateau, P.poser(seul, 'F3', 3, 0, 0).id, -4, 0).ok);
  assert.match(P.gommer(p, '1,0').raison, /noyau .* qui est fixe : la gomme ne le retire jamais/);
  // Le vérificateur n'a donc plus à rencontrer un noyau tourné venu de l'outil ; un fichier qui en porte un reste une faute pour lui.
  const tourne = copie(p);
  tourne.pieces.filter((x) => x.modele === 'N1')[0].rotation = 1;
  assert.ok(verifier(tourne, 3, 'pieces', 0).fautes.some((f) => /^B1 : noyau absent, décentré ou tourné/.test(f)));
});

test('M8 : le contrôle des villes vérifie le total : 1 au centre, 2 neutres, 4 de déploiement, pas davantage', () => {
  const p = genere(1);
  assert.ok(!erreurs(K.tout(p)).length);
  const huit = poserContre(p, 'V');
  assert.strictEqual(P.villes(huit).length, 8);
  const constats = K.villes(huit).filter((x) => x.niveau === 'erreur');
  assert.ok(constats.some((x) => /^8 villes sur le plateau ; il en faut 7 au plus \(1 au centre, 2 neutres, 4 de déploiement\)\.$/.test(x.message) && x.cases.length === 8), constats.map((x) => x.message).join(' | '));
  // Une troisième ville neutre (fichier) : c'est le contrôle des villes qui le dit, pas « tuile de terrain d'une case ».
  const troisNeutres = copie(p), ajout = anneau(p)[0];
  troisNeutres.pieces.push({ id: 'vn3', modele: 'VN', q: H.decle(ajout).q, r: H.decle(ajout).r, rotation: 0 });
  const b3 = K.tout(troisNeutres);
  assert.ok(erreurs(b3).some((m) => /^3 villes neutres ; il en faut 2\.$/.test(m)), erreurs(b3).join(' | '));
  assert.ok(erreurs(b3).some((m) => /^8 villes sur le plateau ; il en faut 7 au plus/.test(m)));
  assert.ok(!b3.resultats.some((x) => /tuile de terrain d’une case|à prévoir en plus/.test(x.message)), b3.resultats.map((x) => x.message).join(' | '));
  // Moins de 7 : ce sont des villes à poser, pas une erreur.
  const six = P.retirerVille(p, P.etatVilles(p).neutres[0].cle).plateau;
  assert.ok(!K.villes(six).some((x) => /villes sur le plateau ; il en faut/.test(x.message)));
  assert.strictEqual(K.tout(six).villes.erreurs, 0);
});

test('M10 : contrôles et vérificateur comptent le contact d’une tuile de remplissage de la même façon, quelle que soit la mesure', () => {
  const base = genere(1);
  // Une tuile de remplissage qui touche 2 cases d'UNE seule pièce : 2 « côtés », 1 « pièce ».
  let cas = null;
  for (const k of anneau(base)) {
    const r = P.peindre(base, k, 'plaine');
    if (!r.ok) continue;
    const x = K.contacts(r.plateau).filter((c) => c.modele === 'R')[0];
    if (x && x.cotes === 2 && x.pieces === 1) { cas = P.avecCamps(r.plateau); break; }
  }
  assert.ok(cas, 'une tuile de remplissage à 2 côtés et 1 pièce');
  const fauteV = (mesure, seuil) => verifier(cas, seuil, mesure, 2).fautes.some((f) => /^B7 : remplissage/.test(f));
  const fauteK = (mesure, seuil) => {
    const faibles = K.contacts(cas).filter((c) => c.modele === 'R' && c[mesure] < Math.min(seuil, C.REGLAGES.seuilContactRemplissage));
    const erreur = K.contact(cas, { mesureContact: mesure, seuilContact: seuil }).some((c) => c.niveau === 'erreur' && c.cases.indexOf(K.contacts(cas).filter((x) => x.modele === 'R')[0].cases[0]) !== -1);
    assert.strictEqual(erreur, faibles.length > 0);
    return erreur;
  };
  [['cotes', 3], ['pieces', 3], ['cotes', 2], ['pieces', 2]].forEach(([mesure, seuil]) => {
    assert.strictEqual(fauteV(mesure, seuil), fauteK(mesure, seuil), mesure + ', seuil ' + seuil);
  });
  assert.deepStrictEqual([fauteV('cotes', 3), fauteV('pieces', 3)], [false, true], '2 côtés suffisent avec la mesure « côtés », 1 pièce ne suffit pas avec la mesure « pièces »');
});
