'use strict';
const test = require('node:test');
const assert = require('node:assert');
// plateau.js doit se charger seul sous Node (il charge hex.js et catalogue.js au besoin).
const P = require('../src/plateau.js');
const H = globalThis.AT.hex;
const C = globalThis.AT.catalogue;

/** Pose une suite de pièces [modele, q, r, rotation] ; échoue si une pose est refusée. */
function monter(liste, depart) {
  let p = depart || P.vide(1);
  for (const [modele, q, r, rotation] of liste) {
    const res = P.poser(p, modele, q, r, rotation || 0);
    assert.ok(res.ok, 'pose refusée : ' + res.raison);
    p = res.plateau;
  }
  return p;
}

/** Petit plateau d'essai : noyau, une montagne, des plaines, une forêt, un marais, une ville. */
function petitPlateau() {
  return monter([
    ['N1', 0, 0], ['M4', 2, 0],              // montagne en (2,0) (3,0) (3,1) (4,1)
    ['P', 2, -1], ['F', 3, -1], ['S', 4, -1], ['P', 4, 0], ['V', 5, -1], ['P', 1, 1]
  ]);
}

test('vide : plateau au format du contrat', () => {
  assert.deepStrictEqual(P.vide('abc'), { version: 1, graine: 'abc', pieces: [], recouvrements: [], camps: { vert: [], rouge: [] } });
  assert.strictEqual(P.vide().graine, 0);
});

test('casesModele : rotation par sixièmes de tour autour de l’ancre', () => {
  const cles = (m, q, r, rot) => P.casesModele(m, q, r, rot).map((c) => c.cle);
  assert.deepStrictEqual(cles('M4', 2, 3, 0), ['2,3', '3,3', '3,4', '4,4']);
  assert.deepStrictEqual(cles('M4', 2, 3, 3), ['2,3', '1,3', '1,2', '0,2']);          // demi-tour autour de l'ancre
  assert.deepStrictEqual(cles('F21', 0, 0, 1), ['0,0', '0,1', '-1,2']);
  for (const id of C.ORDRE_MODELES) {
    const vues = new Set();
    for (let rot = 0; rot < 6; rot++) {
      const cs = P.casesModele(id, -3, 2, rot);
      assert.strictEqual(cs[0].cle, '-3,2', 'l’ancre ne bouge pas');
      assert.strictEqual(new Set(cs.map((c) => c.cle)).size, C.MODELES[id].cases.length);
      assert.deepStrictEqual(cs.map((c) => c.terrain), C.MODELES[id].cases.map((c) => c.terrain));
      assert.strictEqual(P.composantes(cs.map((c) => c.cle)).length, 1, id + ' reste d’un seul tenant');
      vues.add(H.trier(cs.map((c) => c.cle)).join(' '));
    }
    if (id === 'F21') assert.strictEqual(vues.size, 6);
  }
  assert.deepStrictEqual(P.casesModele('inconnu', 0, 0, 0), []);
  assert.deepStrictEqual(P.casesPiece({ modele: 'P', q: 4, r: -2, rotation: 0 }), [{ cle: '4,-2', q: 4, r: -2, terrain: 'plaine' }]);
});

test('poser : nouveau plateau, plateau reçu intact, identifiants uniques', () => {
  const vide = P.vide(5);
  const a = P.poser(vide, 'N1', 0, 0, 0);
  assert.ok(a.ok);
  assert.strictEqual(vide.pieces.length, 0);
  assert.notStrictEqual(a.plateau, vide);
  assert.deepStrictEqual(a.plateau.pieces, [{ id: a.id, modele: 'N1', q: 0, r: 0, rotation: 0 }]);
  const b = P.poser(a.plateau, 'P', 2, 0);
  assert.ok(b.ok);
  assert.notStrictEqual(b.id, a.id);
  assert.strictEqual(b.plateau.pieces[1].rotation, 0);
  assert.strictEqual(b.plateau.graine, 5);
  assert.strictEqual(Object.keys(P.cases(b.plateau)).length, 8);
});

test('poser : refus expliqué (chevauchement, stock épuisé, pièce inconnue, hors bornes, rotation)', () => {
  const p = monter([['N1', 0, 0], ['M4', 2, 0]]);
  const chevauche = P.poser(p, 'P', 1, 0, 0);
  assert.strictEqual(chevauche.ok, false);
  assert.match(chevauche.raison, /Chevauchement/);
  assert.match(chevauche.raison, /\(1,0\)/);
  assert.strictEqual(chevauche.plateau, p);
  const partiel = P.poser(p, 'F3', 1, 1, 0);                     // (1,1) libre mais (2,1)… (1,1) (2,1) (1,2) : libre
  assert.ok(partiel.ok);
  assert.strictEqual(P.poser(p, 'M5', 3, 0, 0).ok, false);       // chevauche la montagne déjà posée
  const stock = P.poser(p, 'M4', -5, 0, 0);
  assert.strictEqual(stock.ok, false);
  assert.match(stock.raison, /Stock épuisé/);
  assert.strictEqual(P.poser(p, 'N1', 10, 10, 0).ok, false);
  assert.match(P.poser(p, '__proto__', 5, 5, 0).raison, /inconnue/);
  assert.strictEqual(P.poser(p, 'P', 1.5, 0, 0).ok, false);
  assert.strictEqual(P.poser(p, 'P', 31, 0, 0).ok, false);
  assert.strictEqual(P.poser(p, 'M5', 29, 0, 0).ok, false, 'une case du monobloc sortirait des bornes');
  assert.ok(P.poser(p, 'M5', 28, 0, 0).ok);
  assert.strictEqual(P.poser(p, 'P', 5, 5, 6).ok, false);
  assert.strictEqual(P.poser(p, 'P', 5, 5, '1').ok, false);
});

test('stock : total, posées, restant', () => {
  const s = P.stock(petitPlateau());
  assert.deepStrictEqual(s.P, { total: 39, poses: 3, restant: 36 });
  assert.deepStrictEqual(s.N1, { total: 1, poses: 1, restant: 0 });
  assert.deepStrictEqual(s.M5, { total: 1, poses: 0, restant: 1 });
  // Catalogue imprimé, puis les modèles hors catalogue (M1, total 0) ; les pièces personnelles viendraient ensuite.
  assert.deepStrictEqual(Object.keys(s), C.ORDRE_MODELES.concat(C.ORDRE_HORS_CATALOGUE));
  assert.deepStrictEqual(s.M1, { total: 0, poses: 0, restant: 0 });
});

test('cases, cout, villes : terrain, pièce, origine', () => {
  const p = petitPlateau(), cs = P.cases(p);
  assert.strictEqual(Object.keys(cs).length, 7 + 4 + 6);
  assert.deepStrictEqual(cs['0,0'], { terrain: 'ville', piece: p.pieces[0].id, origine: 'ville', modele: 'N1', evenement: null });
  assert.strictEqual(cs['3,1'].terrain, 'montagne');
  assert.strictEqual(cs['3,-1'].terrain, 'foret');
  assert.strictEqual(P.cout(p, '1,0'), 1);
  assert.strictEqual(P.cout(p, '3,-1'), 2);
  assert.strictEqual(P.cout(p, '4,-1'), 2);
  assert.strictEqual(P.cout(p, '5,-1'), 1);
  assert.strictEqual(P.cout(p, '3,0'), Infinity);
  assert.strictEqual(P.cout(p, '9,9'), Infinity);
  assert.strictEqual(P.cout(p, 'pas une case'), Infinity);
  assert.strictEqual(P.cout(p, '3,-1', { couts: { foret: 5 } }), 5);
  assert.deepStrictEqual(P.villes(p), ['5,-1', '0,0']);
  assert.deepStrictEqual(P.chevauchements(p), []);
});

test('chevauchements : détecte un plateau fautif venu d’un fichier', () => {
  const p = petitPlateau();
  p.pieces.push({ id: 'x', modele: 'F', q: 1, r: 0, rotation: 0 });
  assert.deepStrictEqual(P.chevauchements(p), ['1,0']);
  assert.strictEqual(P.cases(p)['1,0'].terrain, 'plaine', 'la première pièce garde la case');
});

test('retirer : la pièce part, ses événements et ses camps aussi', () => {
  let p = petitPlateau();
  p = P.poserEvenement(p, 'E1', '3,-1').plateau;
  p.camps = { vert: ['5,-1'], rouge: [] };
  const foret = p.pieces.filter((x) => x.modele === 'F')[0], ville = p.pieces.filter((x) => x.modele === 'V')[0];
  const a = P.retirer(p, foret.id);
  assert.ok(a.ok);
  assert.strictEqual(a.plateau.pieces.length, p.pieces.length - 1);
  assert.deepStrictEqual(a.plateau.recouvrements, []);
  assert.deepStrictEqual(a.evenementsRetires, ['E1']);
  assert.strictEqual(p.recouvrements.length, 1, 'plateau reçu intact');
  const b = P.retirer(p, ville.id);
  assert.deepStrictEqual(b.plateau.camps, { vert: [], rouge: [] });
  assert.strictEqual(b.plateau.recouvrements.length, 1);
  const c = P.retirer(p, 'absente');
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.plateau, p);
  assert.strictEqual(P.stock(a.plateau).F.restant, 5);
});

test('tourner : rotation autour de l’ancre, refus en cas de chevauchement', () => {
  const p = monter([['N1', 0, 0], ['M4', 2, 0], ['P', 2, -1]]);
  const montagne = p.pieces[1];
  const tournee = P.tourner(p, montagne.id, 1);                  // (2,0) (2,1) (1,2) (1,3) : libre → accepté
  assert.ok(tournee.ok);
  assert.strictEqual(tournee.plateau.pieces[1].rotation, 1);
  assert.strictEqual(p.pieces[1].rotation, 0, 'plateau reçu intact');
  const versNoyau = P.tourner(p, montagne.id, 3);                // (2,0) (1,0) … : sur le noyau
  assert.strictEqual(versNoyau.ok, false);
  assert.match(versNoyau.raison, /Chevauchement/);
  const arriere = P.tourner(p, montagne.id, -1);                 // rotation 5 : (2,0) (3,-1) (4,-1) (5,-2)
  assert.ok(arriere.ok);
  assert.strictEqual(arriere.plateau.pieces[1].rotation, 5);
  assert.strictEqual(P.tourner(p, 'absente', 1).ok, false);
  assert.strictEqual(P.tourner(p, montagne.id, 0.5).ok, false);
  // Un tunnel posé sur une case que la montagne quitte repart en réserve.
  const avecTunnel = P.poserEvenement(p, 'E3', '4,1').plateau;
  const tourne = P.tourner(avecTunnel, montagne.id, 1);
  assert.deepStrictEqual(tourne.evenementsRetires, ['E3']);
  assert.deepStrictEqual(tourne.plateau.recouvrements, []);
});

test('campsAuto et avecCamps : villes de la rangée du haut et de la rangée du bas', () => {
  const p = monter([['N1', 0, 0], ['V', 0, -2], ['V', 2, -2], ['P', 1, -2], ['P', 0, 2], ['V', -1, 2], ['P', 2, 1]]);
  assert.deepStrictEqual(P.campsAuto(p), { vert: ['0,-2', '2,-2'], rouge: ['-1,2'] });
  assert.deepStrictEqual(P.avecCamps(p).camps, { vert: ['0,-2', '2,-2'], rouge: ['-1,2'] });
  assert.deepStrictEqual(p.camps, { vert: [], rouge: [] });
  assert.deepStrictEqual(P.campsAuto(P.vide()), { vert: [], rouge: [] });
});

test('chemins : pas, rations (entrer dans une case coûte son terrain), chemin le moins cher', () => {
  // Rangée du haut : plaine, forêt, forêt, plaine ; rangée du bas : trois plaines (détour plus long mais moins cher).
  const p = monter([['P', 0, 0], ['F', 1, 0], ['F', 2, 0], ['P', 3, 0], ['P', 0, 1], ['P', 1, 1], ['P', 2, 1]]);
  const rations = P.distancesRations(p, '0,0'), pas = P.distancesPas(p, ['0,0']);
  assert.strictEqual(rations['0,0'], 0);
  assert.strictEqual(rations['1,0'], 2);
  assert.strictEqual(rations['3,0'], 4);
  assert.strictEqual(pas['3,0'], 3);
  const moinsCher = P.chemin(p, '0,0', '3,0');
  assert.deepStrictEqual(moinsCher, { ok: true, cases: ['0,0', '0,1', '1,1', '2,1', '3,0'], pas: 4, cout: 4 });
  const plusCourt = P.chemin(p, '0,0', '3,0', { mode: 'pas' });
  assert.strictEqual(plusCourt.pas, 3);
  assert.strictEqual(plusCourt.cout, 5);
  assert.deepStrictEqual(P.chemin(p, '2,1', '2,1'), { ok: true, cases: ['2,1'], pas: 0, cout: 0 });
  assert.strictEqual(P.chemin(p, '0,0', '8,8').ok, false);
  // Plusieurs sources : coût depuis la plus proche.
  assert.strictEqual(P.distancesRations(p, ['0,0', '3,0'])['2,1'], 1);
  // Autre table de coûts.
  assert.strictEqual(P.distancesRations(p, '0,0', { couts: { plaine: 1, foret: 1 } })['3,0'], 3);
});

test('chemins : les montagnes bloquent, les cases coupées sont hors d’atteinte', () => {
  const p = monter([['P', -1, 0], ['M4', 0, 0], ['P', 3, 1]]);    // deux plaines séparées par la montagne
  assert.deepStrictEqual(P.distancesPas(p, '-1,0'), { '-1,0': 0 });
  assert.strictEqual(P.chemin(p, '-1,0', '3,1').ok, false);
  assert.match(P.chemin(p, '-1,0', '0,0').raison, /infranchissable/);
  assert.deepStrictEqual(P.distancesRations(p, '0,0'), {}, 'une source infranchissable est ignorée');
  const c = P.coupures(p);
  assert.strictEqual(c.groupes, 2);
  assert.deepStrictEqual(c.isolees, ['3,1']);
  assert.strictEqual(P.composantes(Object.keys(P.cases(p))).length, 1);
});

test('poserEvenement : recouvrement, terrain effectif, la tuile d’origine reste dessous', () => {
  const p = petitPlateau();
  const res = P.poserEvenement(p, 'E1', '3,-1');
  assert.ok(res.ok);
  assert.strictEqual(res.raison, null);
  assert.deepStrictEqual(res.plateau.recouvrements, [{ evenement: 'E1', cle: '3,-1' }]);
  assert.deepStrictEqual(p.recouvrements, []);
  const c = P.cases(res.plateau)['3,-1'];
  assert.strictEqual(c.terrain, 'boue');
  assert.strictEqual(c.origine, 'foret');
  assert.strictEqual(c.evenement, 'E1');
  assert.strictEqual(P.cout(res.plateau, '3,-1'), 3);
  assert.strictEqual(P.cases(res.plateau, { sansRecouvrements: true })['3,-1'].terrain, 'foret');
  assert.strictEqual(res.plateau.pieces.length, p.pieces.length);
});

test('poserEvenement : effets des 8 tuiles', () => {
  const p = petitPlateau();
  const effet = (id, cle) => {
    const res = P.poserEvenement(p, id, cle);
    assert.ok(res.ok, id + ' : ' + res.raison);
    return P.cout(res.plateau, cle);
  };
  assert.strictEqual(effet('E1', '2,-1'), 3);          // torrent de boue sur plaine
  assert.strictEqual(effet('E2', '2,-1'), Infinity);   // crevasse
  assert.strictEqual(effet('E3', '3,0'), 2);           // tunnel dans la montagne
  assert.strictEqual(effet('E4', '3,-1'), 1);          // incendie sur forêt
  assert.strictEqual(effet('E5', '2,-1'), 2);          // inondation
  assert.strictEqual(effet('E6', '2,-1'), Infinity);   // éboulement à côté de la montagne (2,0)
  assert.strictEqual(effet('E7', '4,-1'), 1);          // chaussée sur marais
  assert.strictEqual(effet('E8', '2,-1'), 1);          // campement abandonné
  assert.strictEqual(P.cases(P.poserEvenement(p, 'E8', '2,-1').plateau)['2,-1'].terrain, 'campement');
  assert.strictEqual(P.cases(P.poserEvenement(p, 'E5', '2,-1').plateau)['2,-1'].terrain, 'marais');
});

test('poserEvenement : refus expliqués', () => {
  const p = petitPlateau();
  const refus = (id, cle, motif, options, depart) => {
    const res = P.poserEvenement(depart || p, id, cle, options);
    assert.strictEqual(res.ok, false, id + ' en ' + cle + ' aurait dû être refusé');
    assert.match(res.raison, motif);
    assert.strictEqual(res.plateau, depart || p);
  };
  refus('E9', '2,-1', /inconnu/);
  refus('__proto__', '2,-1', /inconnu/);
  refus('E1', '9,9', /hors du plateau/);
  refus('E1', 'toString', /hors du plateau/);
  refus('E1', '5,-1', /jamais/);                        // ville
  refus('E3', '0,0', /jamais/);                         // ville du noyau
  refus('E1', '1,0', /noyau/);                          // plaine du noyau
  refus('E2', '3,-1', /plaine/);                        // crevasse sur forêt
  refus('E3', '2,-1', /montagne/);                      // tunnel hors montagne
  refus('E4', '2,-1', /foret/);
  refus('E7', '2,-1', /marais/);
  refus('E6', '5,-1', /jamais/);
  refus('E6', '3,0', /franchissable/);                  // éboulement sur la montagne elle-même
  refus('E1', '2,-1', /bataillon/, { occupees: ['2,-1'] });
  const loin = monter([['P', -4, 0]], p);
  refus('E6', '-4,0', /voisine/, undefined, loin);      // éboulement loin de toute montagne
  const deja = P.poserEvenement(p, 'E1', '2,-1').plateau;
  refus('E1', '3,-1', /déjà sur le plateau/, undefined, deja);
  refus('E2', '2,-1', /porte déjà/, undefined, deja);
  assert.deepStrictEqual(P.peutPoserEvenement(p, 'E1', '2,-1'), { ok: true });
});

test('poserEvenement : avertit sans refuser quand la pose coupe le plateau ou isole une ville', () => {
  // La ville (5,-1) ne tient au reste que par (4,-1) et (4,0).
  let p = petitPlateau();
  const sans = P.poserEvenement(p, 'E2', '4,0');
  assert.deepStrictEqual(sans.alertes, []);
  p = P.poserEvenement(p, 'E2', '4,0').plateau;
  const res = P.poserEvenement(p, 'E1', '4,-1');
  assert.deepStrictEqual(res.alertes, [], 'la boue ralentit mais ne coupe pas');
  const isole = monter([['P', 0, 0], ['P', 1, 0], ['V', 2, 0]]);
  const coupe = P.poserEvenement(isole, 'E2', '1,0');
  assert.ok(coupe.ok);
  assert.strictEqual(coupe.alertes.length, 2);
  assert.match(coupe.alertes[0], /coupe le plateau/);
  assert.match(coupe.alertes[1], /isole une ville/);
});

test('retirerEvenement : par la case ou par l’identifiant', () => {
  let p = P.poserEvenement(petitPlateau(), 'E1', '2,-1').plateau;
  p = P.poserEvenement(p, 'E7', '4,-1').plateau;
  const a = P.retirerEvenement(p, '2,-1');
  assert.ok(a.ok);
  assert.strictEqual(a.evenement, 'E1');
  assert.deepStrictEqual(a.plateau.recouvrements, [{ evenement: 'E7', cle: '4,-1' }]);
  assert.strictEqual(P.cout(a.plateau, '2,-1'), 1);
  const b = P.retirerEvenement(p, 'E7');
  assert.ok(b.ok);
  assert.strictEqual(b.cle, '4,-1');
  assert.strictEqual(p.recouvrements.length, 2, 'plateau reçu intact');
  const c = P.retirerEvenement(p, '3,-1');
  assert.strictEqual(c.ok, false);
  assert.strictEqual(c.plateau, p);
  assert.ok(P.poserEvenement(a.plateau, 'E1', '3,-1').ok, 'la tuile retirée est de nouveau disponible');
});

test('serialiser puis lire : aller-retour à l’identique, objet reconstruit', () => {
  let p = P.poserEvenement(petitPlateau(), 'E1', '2,-1').plateau;
  p.camps = { vert: ['5,-1'], rouge: [] };
  const texte = P.serialiser(p);
  const lu = P.lire(texte);
  assert.ok(lu.ok, lu.erreurs.join(' '));
  assert.deepStrictEqual(lu.plateau, p);
  assert.deepStrictEqual(lu.erreurs, []);
  const brut = JSON.parse(texte), valide = P.valider(brut);
  assert.notStrictEqual(valide.plateau, brut);
  assert.notStrictEqual(valide.plateau.pieces, brut.pieces);
  assert.notStrictEqual(valide.plateau.pieces[0], brut.pieces[0]);
});

test('valider : refuse tout ce qui sort du format (types, bornes, identifiants)', () => {
  const bon = () => JSON.parse(P.serialiser(petitPlateau()));
  const refuse = (modifier, motif) => {
    const o = bon();
    const cible = modifier(o);
    const res = P.valider(cible === undefined ? o : cible);
    assert.strictEqual(res.ok, false, 'aurait dû être refusé : ' + motif);
    assert.strictEqual(res.plateau, null);
    assert.ok(res.erreurs.length > 0);
    assert.match(res.erreurs.join(' | '), motif);
  };
  assert.ok(P.valider(bon()).ok);
  refuse(() => null, /pas un plateau/);
  refuse(() => [], /pas un plateau/);
  refuse(() => 'texte', /pas un plateau/);
  refuse((o) => { o.extra = 1; }, /champ inconnu/);
  refuse((o) => { delete o.camps; }, /manquant/);
  refuse((o) => { o.version = 2; }, /Version/);
  refuse((o) => { o.version = '1'; }, /Version/);
  refuse((o) => { o.graine = 1.5; }, /Graine/);
  refuse((o) => { o.graine = 'x'.repeat(65); }, /Graine/);
  refuse((o) => { o.graine = null; }, /Graine/);
  refuse((o) => { o.pieces = {}; }, /Liste des pièces/);
  refuse((o) => { o.pieces = new Array(201).fill(o.pieces[0]); }, /Liste des pièces/);
  refuse((o) => { o.pieces[1] = 'M4'; }, /pas un objet/);
  refuse((o) => { o.pieces[1].modele = 'M9'; }, /modèle inconnu/);
  refuse((o) => { o.pieces[1].modele = 'constructor'; }, /modèle inconnu/);
  refuse((o) => { o.pieces[1].q = '2'; }, /position invalide/);
  refuse((o) => { o.pieces[1].r = 0.5; }, /position invalide/);
  refuse((o) => { o.pieces[1].q = 31; }, /position invalide/);
  refuse((o) => { o.pieces[1].rotation = 6; }, /rotation invalide/);
  refuse((o) => { o.pieces[1].rotation = -1; }, /rotation invalide/);
  refuse((o) => { o.pieces[1].id = o.pieces[0].id; }, /en double/);
  refuse((o) => { o.pieces[1].id = ''; }, /identifiant invalide/);
  refuse((o) => { o.pieces[1].id = '__proto__'; }, /identifiant invalide/);
  refuse((o) => { o.pieces[1].id = '<b>x</b>'; }, /identifiant invalide/);
  refuse((o) => { o.pieces[1].id = 'x'.repeat(17); }, /identifiant invalide/);
  refuse((o) => { o.pieces[1].id = 7; }, /identifiant invalide/);
  refuse((o) => { o.pieces[1].couleur = 'rouge'; }, /champ inconnu/);
  refuse((o) => { delete o.pieces[1].rotation; }, /manquant/);
  refuse((o) => { o.recouvrements = [{ evenement: 'E9', cle: '2,-1' }]; }, /événement inconnu/);
  refuse((o) => { o.recouvrements = [{ evenement: 'E1', cle: '2;-1' }]; }, /case invalide/);
  refuse((o) => { o.recouvrements = [{ evenement: 'E1', cle: '999,0' }]; }, /case invalide/);
  refuse((o) => { o.recouvrements = [{ evenement: 'E1', cle: '2,-1' }, { evenement: 'E1', cle: '4,0' }]; }, /deux fois/);
  refuse((o) => { o.recouvrements = [{ evenement: 'E1', cle: '2,-1' }, { evenement: 'E5', cle: '2,-1' }]; }, /même case/);
  refuse((o) => { o.recouvrements = 'E1'; }, /événements posés invalide/);
  refuse((o) => { o.camps = []; }, /Camps invalides/);
  refuse((o) => { o.camps = { vert: [] }; }, /manquant/);
  refuse((o) => { o.camps.vert = ['0,0', '1,0', '2,-1']; }, /Camp vert/);
  refuse((o) => { o.camps.rouge = ['zéro']; }, /Camp rouge/);
  refuse((o) => { o.camps.vert = ['5,-1']; o.camps.rouge = ['5,-1']; }, /deux fois/);
});

test('valider : une clé « __proto__ » dans le fichier est un champ inconnu, pas une pollution', () => {
  const texte = P.serialiser(petitPlateau()).replace('"rotation": 0', '"rotation": 0, "__proto__": {"pollue": true}');
  const res = P.lire(texte);
  assert.strictEqual(res.ok, false);
  assert.match(res.erreurs.join(' '), /champ inconnu/);
  assert.strictEqual({}.pollue, undefined);
});

test('lire : JSON invalide, fichier trop gros, entrée non textuelle', () => {
  assert.match(P.lire('{pas du json').erreurs[0], /JSON/);
  assert.match(P.lire(' '.repeat(200001)).erreurs[0], /volumineux/);
  assert.strictEqual(P.lire(null).ok, false);
  assert.strictEqual(P.lire('[]').ok, false);
  assert.ok(P.lire(JSON.stringify(P.vide(3))).ok);
});

test('poser : un identifiant de fichier démesuré ne fait pas déborder le numéro de la pièce suivante', () => {
  const p = P.vide(1);
  p.pieces.push({ id: 'p999999999999999', modele: 'N1', q: 0, r: 0, rotation: 0 }, { id: 'p41', modele: 'P', q: 3, r: 0, rotation: 0 }, { id: 'constructor', modele: 'P', q: 4, r: 0, rotation: 0 });
  assert.ok(P.valider(JSON.parse(P.serialiser(p))).ok);
  const r = P.poser(p, 'P', 5, 0, 0);
  assert.ok(r.ok, r.raison);
  assert.strictEqual(r.id, 'p42');
  const relu = P.lire(P.serialiser(r.plateau));
  assert.ok(relu.ok, relu.erreurs.join(' '));
});

test('campsAuto : jamais plus de 2 villes par camp ; 3 villes sur une rangée extrême = aucune désignée, fichier relisible', () => {
  const rangee = ['V', 'P', 'P', 'P', 'V', 'P', 'P', 'P', 'V'].map((m, i) => [m, i - 4, -2]);
  const p = monter([['N1', 0, 0]].concat(rangee, [['P', 0, 2], ['V', -1, 2], ['V', 1, 2]]));
  assert.deepStrictEqual(P.villesRangeesExtremes(p), { vert: ['-4,-2', '0,-2', '4,-2'], rouge: ['-1,2', '1,2'] });
  assert.deepStrictEqual(P.campsAuto(p), { vert: [], rouge: ['-1,2', '1,2'] }, 'cas ambigu : pas de choix silencieux');
  const q = P.avecCamps(p);
  const relu = P.lire(P.serialiser(q));
  assert.ok(relu.ok, relu.erreurs.join(' '));
  assert.deepStrictEqual(relu.plateau, q);
  // Une ville en trop retirée : les deux restantes sont désignées.
  const idVille = P.cases(q)['0,-2'].piece;
  assert.deepStrictEqual(P.campsAuto(P.retirer(q, idVille).plateau).vert, ['-4,-2', '4,-2']);
});

test('retouches au hasard (poser, tourner, retirer) : le plateau reste toujours enregistrable et relisible', () => {
  const alea = require('../src/alea.js');
  let egalites = 0;
  for (const graine of [1, 2, 3]) {
    const a = alea.creer(graine);
    let p = P.vide(graine);
    for (let i = 0; i < 400; i++) {
      const tirage = a.entier(10);
      let r;
      if (tirage < 6 || !p.pieces.length) {
        // Les villes sont tirées plus souvent, sur les rangées extrêmes, pour provoquer les égalités.
        const modele = a.entier(3) === 0 ? 'V' : a.choisir(C.ORDRE_MODELES);
        const rr = a.entier(3) === 0 ? a.choisir([-3, 3]) : a.entier(7) - 3;
        r = P.poser(p, modele, a.entier(9) - 4, rr, a.entier(6));
      } else if (tirage < 8) {
        r = P.tourner(p, a.choisir(p.pieces).id, 1 + a.entier(5));
      } else {
        r = P.retirer(p, a.choisir(p.pieces).id);
      }
      if (!r.ok) continue;
      p = P.avecCamps(r.plateau);
      const rangees = P.villesRangeesExtremes(p);
      if (rangees.vert.length > 2 || rangees.rouge.length > 2) egalites += 1;
      assert.ok(p.camps.vert.length <= 2 && p.camps.rouge.length <= 2, 'plus de 2 villes dans un camp');
      const relu = P.lire(P.serialiser(p));
      assert.ok(relu.ok, 'graine ' + graine + ', étape ' + i + ' : ' + relu.erreurs.join(' '));
      assert.deepStrictEqual(relu.plateau, p);
    }
    assert.ok(p.pieces.length > 5, 'le parcours a bien posé des pièces');
  }
  assert.ok(egalites > 0, 'le parcours a bien rencontré le cas de 3 villes sur une rangée extrême');
});

test('poser : jamais d’identifiant en double, même quand le numéro suivant est déjà pris par une pièce d’un fichier', () => {
  const p = P.vide(1);
  p.pieces.push({ id: 'p999999999', modele: 'N1', q: 0, r: 0, rotation: 0 }, { id: 'p1000000000', modele: 'P', q: 3, r: 0, rotation: 0 },
    { id: 'p1000000001', modele: 'P', q: 4, r: 0, rotation: 0 }, { id: 'p007', modele: 'P', q: 5, r: 0, rotation: 0 });
  assert.ok(P.valider(JSON.parse(P.serialiser(p))).ok);
  let q = p;
  for (let i = 0; i < 5; i++) {
    const r = P.poser(q, 'P', -3 - i, 0, 0);
    assert.ok(r.ok, r.raison);
    q = r.plateau;
  }
  const ids = q.pieces.map((x) => x.id);
  assert.strictEqual(new Set(ids).size, ids.length, 'identifiants : ' + ids.join(' '));
  assert.strictEqual(ids[4], 'p1000000002');
  assert.ok(P.lire(P.serialiser(q)).ok);
});
