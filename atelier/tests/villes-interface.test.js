'use strict';
// Lot G : logique pure de l'étape « Villes » et de l'interface du catalogue 2 (docs/02-atelier-cahier-des-charges.md, §9).
// Le DOM et les clics sont vérifiés dans un vrai navigateur par outils/recette.html.
const test = require('node:test');
const assert = require('node:assert');
const V = require('../src/vue-villes.js');
const VC = require('../src/vue-creation.js');
const VI = require('../src/vue-inventaire.js');
const R = require('../src/rendu.js');
const AT = globalThis.AT;
const H = AT.hex, C = AT.catalogue, P = AT.plateau, K = AT.controles, G = AT.generateur;

const copie = (o) => JSON.parse(JSON.stringify(o));
const genere = (graine) => { const g = G.generer(graine === undefined ? 1 : graine); assert.ok(g.ok, g.raison); return g.plateau; };
/** Terrain construit, sans aucune ville. */
const terrain = (graine) => V.retirerToutes(genere(graine)).plateau;

test('compteurs et outil suivant : 2 / 2 par joueur, 2 / 2 neutres', () => {
  const plein = genere();
  assert.deepStrictEqual(V.compteurs(plein), {
    vert: { posees: 2, voulues: 2, complet: true }, rouge: { posees: 2, voulues: 2, complet: true }, neutre: { posees: 2, voulues: 2, complet: true },
    completes: true, construction: 0
  });
  assert.strictEqual(V.outilSuivant(plein), null);
  const nu = terrain();
  assert.deepStrictEqual([V.compteurs(nu).vert.posees, V.compteurs(nu).neutre.posees, V.compteurs(nu).completes], [0, 0, false]);
  assert.strictEqual(V.outilSuivant(nu), 'vert');
  assert.strictEqual(V.compteurs(P.vierge(1)).construction, C.totaux().construction.pieces - 1);
});

test('retirerToutes : plus aucune ville, terrain intact, étape « villes » sans erreur ; plateau reçu intact', () => {
  const plein = genere(), fige = JSON.stringify(plein);
  const r = V.retirerToutes(plein);
  assert.strictEqual(r.nombre, 6);
  assert.strictEqual(JSON.stringify(plein), fige);
  assert.ok(!('deploiements' in r.plateau));
  assert.ok(!r.plateau.pieces.some((p) => p.modele === 'VN'));
  assert.deepStrictEqual(r.plateau.camps, { vert: [], rouge: [] });
  assert.strictEqual(r.plateau.pieces.length, plein.pieces.length - 2);
  const bilan = K.tout(r.plateau);
  assert.deepStrictEqual([bilan.etape, bilan.erreurs, bilan.ok], ['villes', 0, true], 'un plateau construit sans villes n’est pas en erreur');
  const rien = V.retirerToutes(r.plateau);
  assert.deepStrictEqual([rien.nombre, rien.plateau === r.plateau], [0, true]);
  assert.ok(P.lire(P.serialiser(r.plateau)).ok);
});

test('places : celles du modèle ; profondeur des extrémités ; pose libre plus large ; rien quand tout est posé', () => {
  const nu = terrain();
  for (const camp of ['vert', 'rouge']) {
    const p2 = V.places(nu, camp), p1 = V.places(nu, camp, { profondeurExtremite: 1 }), p3 = V.places(nu, camp, { profondeurExtremite: 3 });
    assert.deepStrictEqual(p2, P.placesDeploiement(nu, camp, { profondeurExtremite: C.REGLAGES.villes.profondeurExtremite }));
    assert.ok(p1.length <= p2.length && p2.length <= p3.length && p2.length > 0, camp + ' : ' + p1.length + ' / ' + p2.length + ' / ' + p3.length);
    assert.ok(p1.every((k) => p2.includes(k)));
    for (const k of p2) assert.ok(P.peutPoserVilleDeploiement(nu, camp, k).ok, k);
    const libres = V.places(nu, camp, { libre: true });
    assert.ok(libres.length > p3.length && p2.every((k) => libres.includes(k)));
    for (const k of libres.slice(0, 12)) assert.ok(P.peutPoserVilleDeploiement(nu, camp, k, { libre: true }).ok, k);
  }
  const neutres = V.places(nu, 'neutre');
  assert.deepStrictEqual(neutres, P.placesNeutres(nu).map((x) => x.cle));
  assert.ok(neutres.length > 0 && neutres.every((k) => !(k in P.cases(nu))), 'une ville neutre se pose sur une case VIDE');
  assert.ok(neutres.every((k) => V.anneau(nu).includes(k)));
  assert.ok(V.places(nu, 'neutre', { libre: true }).length > neutres.length);
  const plein = genere();
  for (const o of V.OUTILS) assert.deepStrictEqual(V.places(plein, o), []);
  assert.deepStrictEqual(V.places(nu, 'inconnu'), []);
});

test('cliquer : pose, refus avec la raison du modèle, retrait d’une ville posée ; plateau reçu intact', () => {
  const nu = terrain(), fige = JSON.stringify(nu), place = V.places(nu, 'vert')[0];
  const pose = V.cliquer(nu, 'vert', place);
  assert.deepStrictEqual([pose.ok, pose.action, pose.niveau], [true, 'pose', 'info']);
  assert.strictEqual(pose.message, 'Ville de déploiement de Vert posée sur la Plaine (' + place + ').');
  assert.deepStrictEqual(pose.plateau.camps.vert, [place]);
  assert.strictEqual(P.cases(pose.plateau)[place].origine, 'plaine', 'la Plaine reste dessous');
  assert.strictEqual(JSON.stringify(nu), fige);
  // Refus : la raison est celle du modèle, mot pour mot.
  const centre = V.cliquer(nu, 'vert', '1,0');
  assert.deepStrictEqual([centre.ok, centre.action, centre.plateau === nu], [false, null, true]);
  assert.strictEqual(centre.message, 'Pose refusée : ' + P.peutPoserVilleDeploiement(nu, 'vert', '1,0').raison);
  assert.match(centre.message, /noyau/);
  const bas = V.places(nu, 'rouge')[0], mauvaisCote = V.cliquer(nu, 'vert', bas);
  assert.strictEqual(mauvaisCote.ok, false);
  assert.match(mauvaisCote.message, /extrémité du haut/);
  const proche = V.cliquer(pose.plateau, 'vert', H.voisines(place).filter((k) => V.places(nu, 'vert').includes(k))[0] || place);
  assert.strictEqual(proche.ok && proche.action === 'pose', false, 'une case voisine d’une ville est trop près (ou la ville est retirée)');
  const neutre = V.cliquer(nu, 'neutre', V.places(nu, 'neutre')[0]);
  assert.ok(neutre.ok && /^Ville neutre posée en \(.*\), sur le flanc (gauche|droit)\.$/.test(neutre.message), neutre.message);
  assert.match(V.cliquer(nu, 'neutre', '0,0').message, /^Pose refusée : .*déjà occupée/);
  // Cliquer une ville posée la retire, quel que soit l'outil.
  const retrait = V.cliquer(pose.plateau, 'rouge', place);
  assert.deepStrictEqual([retrait.ok, retrait.action], [true, 'retrait']);
  assert.match(retrait.message, /Ville de déploiement de Vert retirée/);
  assert.deepStrictEqual(retrait.plateau.camps.vert, []);
  const sansNeutre = V.cliquer(neutre.plateau, 'vert', V.places(nu, 'neutre')[0]);
  assert.deepStrictEqual([sansNeutre.action, sansNeutre.plateau.pieces.length], ['retrait', nu.pieces.length]);
  // Pose libre : acceptée hors des règles, annoncée, et signalée ensuite par les contrôles.
  const libre = V.cliquer(nu, 'vert', bas, { libre: true });
  assert.deepStrictEqual([libre.ok, libre.niveau], [true, 'alerte']);
  assert.match(libre.message, /Pose libre : les contrôles disent/);
  assert.ok(K.villes(libre.plateau).some((x) => x.niveau === 'erreur' && /mal placée/.test(x.message)));
  assert.strictEqual(V.cliquer(nu, null, place).ok, false);
});

test('diagnostic « aucune place » : tout est posé, écart de 4 pas, profondeur conseillée ; rien à dire quand il y a des places', () => {
  const nu = terrain(), plein = genere();
  for (const o of V.OUTILS) assert.strictEqual(V.diagnostic(nu, o), null);
  assert.deepStrictEqual([V.diagnostic(plein, 'vert').cause, V.diagnostic(plein, 'neutre').cause], ['complet', 'complet']);
  // Cas trouvés par recherche : des plateaux où une première ville bien choisie prive le camp de toute autre place.
  let ecart = null;
  for (let g = 1; g <= 12 && !ecart; g++) {
    const t = terrain(g);
    for (const camp of ['vert', 'rouge']) {
      for (const k of V.places(t, camp, { profondeurExtremite: 1 })) {
        const un = V.cliquer(t, camp, k, { profondeurExtremite: 1 }).plateau;
        const d = V.diagnostic(un, camp, { profondeurExtremite: 1 });
        if (d && d.cause === 'ecart' && !ecart) ecart = { d, un, camp };
      }
    }
  }
  assert.ok(ecart, 'aucun cas « écart » trouvé sur 12 graines');
  assert.match(ecart.d.message, /trop près d’une autre ville : il faut 4 pas entre deux villes \(soit 3 cases entre elles\)/);
  assert.deepStrictEqual(V.places(ecart.un, ecart.camp, { profondeurExtremite: 1 }), []);
  if (ecart.d.profondeurConseillee !== null) {
    assert.ok(ecart.d.profondeurConseillee > 1 && ecart.d.profondeurConseillee <= 3);
    assert.ok(V.places(ecart.un, ecart.camp, { profondeurExtremite: ecart.d.profondeurConseillee }).length > 0, 'la profondeur conseillée donne bien des places');
    assert.match(ecart.d.message, /Profondeur des extrémités/);
  }
  // En pose libre, pas de diagnostic : tout se pose.
  assert.strictEqual(V.diagnostic(ecart.un, ecart.camp, { profondeurExtremite: 1, libre: true }), null);
  // Plateau sans bord utilisable : le noyau seul n'offre aucune Plaine hors noyau.
  const seul = V.diagnostic(P.vierge(1), 'vert');
  assert.strictEqual(seul.cause, 'terrain');
  assert.match(seul.message, /Aucune place pour Vert/);
  assert.match(V.diagnostic(P.vierge(1), 'neutre').message, /Aucune place pour une ville neutre/);
});

test('poserAuto : les 6 villes au meilleur équilibre, plateau complet et conforme, même graine = mêmes villes', () => {
  const nu = terrain(), fige = JSON.stringify(nu);
  const a = V.poserAuto(nu, 7), b = V.poserAuto(nu, 7);
  assert.ok(a.ok, a.raison);
  assert.strictEqual(JSON.stringify(nu), fige);
  assert.strictEqual(JSON.stringify(a.plateau), JSON.stringify(b.plateau));
  const bilan = K.tout(a.plateau);
  assert.deepStrictEqual([bilan.etape, bilan.erreurs], ['complet', 0]);
  assert.strictEqual(a.score, bilan.equilibre.score);
  assert.ok(a.score <= K.tout(genere()).equilibre.score, 'jamais moins bon que les villes du générateur sur le même terrain');
  assert.ok(P.lire(P.serialiser(a.plateau)).ok);
  // Des villes déjà posées (même mal, en pose libre) sont remplacées.
  const mal = V.cliquer(nu, 'vert', V.places(nu, 'rouge')[0], { libre: true }).plateau;
  const refait = V.poserAuto(mal, 7);
  assert.strictEqual(JSON.stringify(refait.plateau.camps), JSON.stringify(a.plateau.camps));
  // Sans noyau au centre, ou sans place : refus expliqué, plateau rendu tel quel.
  const vide = V.poserAuto(P.vide(1), 1);
  assert.deepStrictEqual([vide.ok, vide.plateau.pieces.length], [false, 0]);
  assert.match(vide.raison, /noyau/);
  const seul = V.poserAuto(P.vierge(1), 1);
  assert.strictEqual(seul.ok, false);
  assert.match(seul.raison, /Pas assez de places/);
  assert.match(seul.raison, /Places trouvées : 0 pour Vert/);
});

test('trou signalé : une ville de déploiement hors du plateau ou hors d’une Plaine est refusée à la lecture ; montée en mémoire, c’est une erreur des contrôles, et elle se retire', () => {
  const nu = terrain();
  // Hors du plateau : la case n'existe pas.
  const dehors = copie(nu);
  dehors.deploiements = [{ cle: '20,20', camp: 'vert' }];
  const avis = P.valider(copie(dehors));
  assert.strictEqual(avis.ok, false, 'un fichier ne peut plus porter une telle entrée');
  assert.match(avis.erreurs.join(' | '), /Ville de déploiement n° 1 : aucune case du plateau en \(20,20\)/);
  // Un document monté en mémoire reste jugé par les contrôles (défense en profondeur).
  const c1 = K.villes(dehors).filter((x) => x.niveau === 'erreur');
  assert.ok(c1.some((x) => /Ville de déploiement de Vert en \(20,20\) hors du plateau : aucune case à cet endroit/.test(x.message)), c1.map((x) => x.message).join(' | '));
  assert.ok(K.tout(dehors).villes.erreurs >= 1);
  assert.strictEqual(K.tout(dehors).ok, false);
  // Sur une case qui n'est pas une Plaine.
  const toutes = P.cases(nu), foret = Object.keys(toutes).filter((k) => toutes[k].terrain === 'foret')[0];
  const surForet = copie(nu);
  surForet.deploiements = [{ cle: foret, camp: 'rouge' }];
  const c2 = K.villes(surForet).filter((x) => x.niveau === 'erreur');
  assert.ok(c2.some((x) => /Ville de déploiement de Rouge en \(.*\) mal placée : Une ville de déploiement se pose sur une case de Plaine \(ici : foret\)/.test(x.message)), c2.map((x) => x.message).join(' | '));
  // Sur le noyau.
  const surNoyau = copie(nu);
  surNoyau.deploiements = [{ cle: '1,0', camp: 'vert' }];
  assert.ok(K.villes(surNoyau).some((x) => x.niveau === 'erreur' && /ne se pose pas sur le noyau/.test(x.message)));
  // Le remède : « Retirer toutes les villes » vide aussi l'entrée fautive.
  const propre = V.retirerToutes(dehors);
  assert.strictEqual(propre.nombre, 1);
  assert.strictEqual(K.tout(propre.plateau).erreurs, 0);
  // Un plateau correct n'a aucune de ces erreurs.
  assert.strictEqual(K.villes(genere()).filter((x) => x.niveau === 'erreur').length, 0);
});

test('villes retirées par une retouche du terrain : annoncées (retirer, tourner, gommer, repeindre)', () => {
  const plein = genere(), vd = plein.camps.vert[0], piece = P.cases(plein)[vd].piece;
  const retrait = P.retirer(plein, piece);
  assert.deepStrictEqual(retrait.villesRetirees, [vd]);
  assert.strictEqual(VC.mentionVilles(plein, retrait.plateau), ' La ville de déploiement de Vert a été retirée avec la Plaine qui la portait : à reposer à l’étape « Villes ».');
  assert.strictEqual(VC.mentionVilles(plein, plein), '');
  assert.match(VC.mentionVilles(plein, V.retirerToutes(plein).plateau), /^ 4 villes de déploiement ont été retirées avec la Plaine qui les portait/);
  // Gomme sur la ville elle-même : elle part, le trait le dit.
  const gomme = VC.bilanTrait(VC.tracer(plein, { type: 'gomme' }, [vd]));
  assert.match(gomme.message, /ville de déploiement de Vert a été retirée/);
  assert.strictEqual(P.etatVilles(gomme.plateau).vert.length, 1);
  // Un trait qui ne touche aucune ville ne dit rien.
  const libre = V.anneau(plein).filter((k) => !P.cases(plein)[k])[0];
  assert.ok(!/ville de déploiement/.test(VC.bilanTrait(VC.tracer(plein, { type: 'terrain', terrain: 'foret' }, [libre])).message));
});

test('rendu : type de tuile d’une case (ville de déploiement, ville neutre, remplissage) ; anneau dans le cadre', () => {
  const plein = genere(), toutes = P.cases(plein);
  assert.strictEqual(R.typeTuile(toutes[plein.camps.vert[0]]), 'vd-vert');
  assert.strictEqual(R.typeTuile(toutes[plein.camps.rouge[0]]), 'vd-rouge');
  const vn = plein.pieces.filter((p) => p.modele === 'VN')[0];
  assert.strictEqual(R.typeTuile(toutes[H.cle(vn.q, vn.r)]), 'vn');
  assert.strictEqual(R.typeTuile(toutes['0,0']), null, 'la ville du noyau est une case ordinaire');
  assert.strictEqual(R.typeTuile(toutes['1,0']), null);
  assert.strictEqual(R.typeTuile(undefined), null);
  const avecR = P.poser(V.retirerToutes(plein).plateau, 'R', 9, 0, 0).plateau;
  assert.strictEqual(R.typeTuile(P.cases(avecR)['9,0']), 'remplissage');
  const anneau = V.anneau(plein);
  assert.ok(anneau.length > 20 && anneau.every((k) => !(k in toutes) && H.voisines(k).some((v) => v in toutes)));
});

test('inventaire du catalogue 2 par rôle : totaux et répartition justes ; section « ancien catalogue » seulement s’il y a lieu', () => {
  const plein = genere(), r = VI.parRole(plein), t = C.totaux();
  assert.deepStrictEqual(r.roles.map((x) => [x.id, x.lignes.length, x.pieces, x.cases]),
    [['noyau', 1, 1, 7], ['montagne', 2, 2, 9], ['quatre', 12, 12, 48], ['trois', 9, 9, 27], ['remplissage', 1, 2, 2], ['ville', 1, 2, 2]]);
  let pieces = 0, cases = 0;
  r.roles.forEach((x) => { pieces += x.pieces; cases += x.cases; });
  assert.deepStrictEqual([pieces, cases], [t.pieces, t.cases], 'les rôles couvrent tout le catalogue imprimé, sans doublon');
  assert.deepStrictEqual(r.terrain, { cases: 75, plaine: 49, foret: 13, marais: 13 });
  assert.deepStrictEqual([r.montagne, r.remplissage, r.villes], [9, { pieces: 2, plaine: 2 }, 7]);
  assert.deepStrictEqual(r.deploiements, { total: 4, parCamp: 2, poses: 4, restantes: 0, vert: 2, rouge: 2 });
  assert.deepStrictEqual(r.ancien, { present: false, lignes: [], pieces: 0 });
  const nu = V.retirerToutes(plein).plateau;
  assert.deepStrictEqual([VI.parRole(nu).deploiements.poses, VI.parRole(nu).deploiements.restantes, VI.parRole(nu).roles[5].poses], [0, 4, 0]);
  // Une forêt peinte au pinceau (tuile hors catalogue) ne fait pas d'un plateau un « ancien » plateau.
  assert.strictEqual(VC.estAncien(plein), false);
  assert.strictEqual(VC.estAncien(P.peindre(nu, V.anneau(nu)[0], 'foret').plateau), false);
  assert.strictEqual(VC.estAncien(undefined), false);
  const peint = P.peindre(nu, V.anneau(nu)[0], 'foret').plateau;
  assert.strictEqual(VI.parRole(peint).ancien.present, false);
  assert.strictEqual(VI.bilan(peint).horsCatalogue.pieces, 1);
  // Un vrai plateau de l'ancien catalogue porte des tuiles de ville d'une case.
  const ancien = P.lire(require('node:fs').readFileSync(require('node:path').join(__dirname, 'fixtures-v1', 'plateau-genere.json'), 'utf8'));
  assert.ok(ancien.ok, ancien.erreurs && ancien.erreurs[0]);
  assert.strictEqual(VC.estAncien(ancien.plateau), true);
  const a = VI.parRole(ancien.plateau).ancien;
  assert.strictEqual(a.present, true);
  // Avec ses tuiles d'une case, ce plateau porte les deux monoblocs à deux forêts / deux marais, retirés depuis du catalogue.
  assert.deepStrictEqual(a.lignes.map((x) => x.id), ['P', 'F', 'S', 'V', 'F21', 'S21']);
  assert.strictEqual(a.lignes.filter((x) => x.id === 'V')[0].poses, 6);
  assert.strictEqual(a.pieces, a.lignes.reduce((n, x) => n + x.poses, 0));
});
