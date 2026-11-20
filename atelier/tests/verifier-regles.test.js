'use strict';
// outils/verifier-regles.js vérifie les règles B1 à B7 du §9.1 sans passer par AT.controles. Ce test prouve qu'il ne
// laisse rien passer : un plateau généré est conforme, et chaque règle enfreinte exprès est bien signalée.
const test = require('node:test');
const assert = require('node:assert');
const { verifier } = require('../outils/verifier-regles.js');
const AT = globalThis.AT;
const P = AT.plateau, G = AT.generateur, H = AT.hex;

const MODELE = (() => { const r = G.generer(1); if (!r.ok) throw new Error(r.raison); return JSON.stringify(r.plateau); })();
const bon = () => JSON.parse(MODELE);
const fautes = (plateau, options) => { const o = options || {}; return verifier(plateau, o.seuil || 3, o.mesure || 'pieces', o.remplissages || 0, o.profondeur).fautes; };
/** Le plateau modifié doit être signalé par une faute qui correspond au motif. */
function detecte(nom, modifier, motif, options) {
  const p = bon();
  modifier(p);
  const liste = fautes(p, options);
  assert.ok(liste.some((x) => motif.test(x)), nom + ' : non détecté. Fautes : ' + (liste.join(' | ') || 'aucune'));
}
const terrain = (p) => P.cases(p, { sansVilles: true });
const casesDe = (p, f) => Object.keys(terrain(p)).filter((k) => f(terrain(p)[k], k));
const piece = (p, f) => p.pieces.filter(f)[0];
const camps = (p) => { p.camps = { vert: p.deploiements.filter((d) => d.camp === 'vert').map((d) => d.cle), rouge: p.deploiements.filter((d) => d.camp === 'rouge').map((d) => d.cle) }; };

test('vérificateur indépendant : un plateau généré est conforme (2 rangées, 1 et 3 rangées, remplissages)', () => {
  assert.deepStrictEqual(fautes(bon()), []);
  const trois = G.generer(2, { profondeurExtremite: 3 }).plateau;
  assert.deepStrictEqual(fautes(trois, { profondeur: 3 }), []);
  let un = null;      // à 1 rangée, toutes les graines ne réussissent pas : la première qui réussit
  for (let g = 1; g <= 80 && !un; g++) un = G.generer(g, { profondeurExtremite: 1 }).plateau;
  assert.ok(un, 'une graine de 1 à 80 réussit à 1 rangée');
  assert.deepStrictEqual(fautes(un, { profondeur: 1 }), []);
  let avecR = null;
  for (let g = 1; g <= 40 && !avecR; g++) { const r = G.generer(g, { remplissages: 2 }); if (r.ok && r.plateau.pieces.some((x) => x.modele === 'R')) avecR = r.plateau; }
  assert.ok(avecR, 'un plateau avec une tuile de remplissage');
  assert.deepStrictEqual(fautes(avecR, { remplissages: 2 }), []);
  assert.ok(fautes(avecR, { remplissages: 0 }).some((x) => /^B2 : /.test(x)), 'B2 : plus de remplissages que permis');
});

test('vérificateur indépendant : B1 (monoblocs de 3 ou 4 cases, noyau, montagnes en blocs) et A2', () => {
  detecte('tuile de terrain d’une case', (p) => { piece(p, (x) => !['N1', 'VN', 'M4', 'M5'].includes(x.modele)).modele = 'P'; }, /^B1 : pièce de terrain de 1 case/);
  detecte('montagne d’une case', (p) => { piece(p, (x) => x.modele === 'M4').modele = 'M1'; }, /^B1 : montagne de 1 case/);
  detecte('noyau décentré', (p) => { piece(p, (x) => x.modele === 'N1').q = 1; }, /^B1 : noyau absent, décentré ou tourné/);
  detecte('noyau tourné', (p) => { piece(p, (x) => x.modele === 'N1').rotation = 1; }, /^B1 : noyau absent, décentré ou tourné/);
  detecte('noyau absent', (p) => { p.pieces = p.pieces.filter((x) => x.modele !== 'N1'); }, /^B1 : noyau absent/);
  detecte('ville d’une case de l’ancien catalogue', (p) => { piece(p, (x) => !['N1', 'VN', 'M4', 'M5'].includes(x.modele)).modele = 'V'; }, /^A2 : ville dans la pièce/);
});

test('vérificateur indépendant : B3 (toutes les pièces une fois, sans chevauchement, d’un seul tenant, sans trou)', () => {
  detecte('pièce manquante', (p) => { p.pieces = p.pieces.filter((x) => x !== piece(p, (y) => !['N1', 'VN'].includes(y.modele))); }, /^B3 : pièce .* : 0 posée\(s\) pour 1/);
  detecte('pièce en double', (p) => { const x = piece(p, (y) => !['N1', 'VN'].includes(y.modele)); p.pieces.push({ id: 'double', modele: x.modele, q: x.q + 20, r: x.r, rotation: x.rotation }); }, /^B3 : pièce .* : 2 posée\(s\) pour 1/);
  detecte('chevauchement', (p) => { const a = piece(p, (y) => !['N1', 'VN'].includes(y.modele)); a.q = 0; a.r = 0; }, /^chevauchement en /);
  detecte('plateau en deux morceaux', (p) => { const x = piece(p, (y) => !['N1', 'VN'].includes(y.modele)); x.q += 20; }, /^B3 : plateau en plusieurs morceaux/);
  detecte('pièce inconnue', (p) => { piece(p, (y) => !['N1', 'VN'].includes(y.modele)).modele = 'ZZ'; }, /pièce hors catalogue/);
  // Un trou : on retire une pièce entièrement entourée, s'il y en a une ; sinon le noyau (toujours entouré).
  detecte('trou', (p) => { p.pieces = p.pieces.filter((x) => x.modele !== 'N1'); }, /^B3 : \d+ case\(s\) vide\(s\) enfermée\(s\)/);
});

test('vérificateur indépendant : B4 (villes de déploiement)', () => {
  detecte('une ville de moins', (p) => { p.deploiements.pop(); camps(p); }, /^B4 : 3 ville\(s\) de déploiement pour 4/);
  detecte('sur une forêt', (p) => { p.deploiements[0].cle = casesDe(p, (c) => c.terrain === 'foret')[0]; camps(p); }, /^B4 : ville de déploiement sur foret/);
  detecte('sur une montagne', (p) => { p.deploiements[0].cle = casesDe(p, (c) => c.terrain === 'montagne')[0]; camps(p); }, /^B4 : ville de déploiement sur montagne/);
  detecte('sur le noyau', (p) => { p.deploiements[0].cle = '1,0'; camps(p); }, /^B4 : ville de déploiement sur le noyau/);
  detecte('hors du terrain', (p) => { p.deploiements[0].cle = '20,20'; camps(p); }, /^B4 : ville de déploiement hors du terrain/);
  detecte('pas au bord', (p) => { const t = terrain(p); p.deploiements[0].cle = casesDe(p, (c, k) => c.terrain === 'plaine' && c.modele !== 'N1' && H.voisines(k).every((v) => t[v]))[0]; camps(p); },
    /^B4 : ville de déploiement hors du bord/);
  detecte('Vert en bas', (p) => { const d = p.deploiements; const vert = d.filter((x) => x.camp === 'vert')[0], rouge = d.filter((x) => x.camp === 'rouge')[0]; vert.camp = 'rouge'; rouge.camp = 'vert'; camps(p); },
    /^B4 : ville de (vert|rouge) hors des 2 rangée\(s\) extrême\(s\)/);
  detecte('3 villes pour Vert', (p) => { p.deploiements.filter((x) => x.camp === 'rouge')[0].camp = 'vert'; camps(p); }, /^B4 : 3 ville\(s\) de déploiement pour vert/);
  detecte('camps enregistrés faux', (p) => { p.camps.vert = []; }, /^B4 : camp vert enregistré/);
  detecte('camp inconnu', (p) => { p.deploiements[0].camp = 'bleu'; }, /^B4 : camp inconnu/);
  detecte('deux villes sur la même case', (p) => { const d = p.deploiements.filter((x) => x.camp === 'vert'); d[1].cle = d[0].cle; camps(p); }, /^B4 : deux villes de déploiement sur la même case|^B4 : camp vert enregistré/);
  // Profondeur : un plateau fait à 3 rangées, avec une ville en troisième rangée, n'est pas conforme à 2 rangées.
  let loin = null;
  for (let g = 1; g <= 40 && !loin; g++) {
    const r = G.generer(g, { profondeurExtremite: 3 });
    if (r.ok && fautes(Object.assign({}, r.plateau, { profondeurExtremite: undefined }), { profondeur: 2 }).some((x) => /hors des 2 rangée/.test(x))) loin = r.plateau;
  }
  assert.ok(loin, 'un plateau à 3 rangées avec une ville en troisième rangée');
  assert.deepStrictEqual(fautes(loin, { profondeur: 3 }), []);
  assert.ok(fautes(loin, { profondeur: 2 }).some((x) => /^B4 : profondeur des extrémités enregistrée \(3\) ≠ profondeur demandée \(2\)/.test(x)));
  // La profondeur demandée doit être celle que le plateau a enregistrée ; 2 (défaut) s'écrit par l'absence du champ.
  detecte('profondeur écrite en clair à la valeur par défaut', (p) => { p.profondeurExtremite = 2; }, /^B4 : profondeur des extrémités enregistrée/);
  detecte('profondeur enregistrée différente', (p) => { p.profondeurExtremite = 3; }, /^B4 : profondeur des extrémités enregistrée \(3\) ≠ profondeur demandée \(2\)/);
});

test('vérificateur indépendant : B5 (villes neutres)', () => {
  detecte('une ville neutre de moins', (p) => { p.pieces = p.pieces.filter((x) => x !== piece(p, (y) => y.modele === 'VN')); }, /^B5 : 1 ville\(s\) neutre\(s\) pour 2/);
  detecte('ville neutre au-dessus du plateau', (p) => {
    const t = terrain(p), haut = Math.min(...Object.keys(t).map((k) => H.decle(k).r)), sommet = H.decle(Object.keys(t).filter((k) => H.decle(k).r === haut)[0]);
    const vn = piece(p, (y) => y.modele === 'VN'); vn.q = sommet.q; vn.r = sommet.r - 1;
  }, /^B5 : ville neutre en .* hors des flancs/);
  detecte('ville neutre sur le terrain', (p) => { const vn = piece(p, (y) => y.modele === 'VN'); vn.q = 1; vn.r = 0; }, /^ville neutre posée sur une case du terrain/);
  detecte('ville neutre loin du plateau', (p) => { const vn = piece(p, (y) => y.modele === 'VN'); vn.q = 25; vn.r = 0; }, /^B5 : ville neutre en .* touchant 0 case\(s\)/);
  detecte('deux villes neutres sur le même flanc', (p) => {
    const t = terrain(p), vns = p.pieces.filter((y) => y.modele === 'VN'), r = vns[0].r + 1, qs = Object.keys(t).map(H.decle).filter((c) => c.r === r).map((c) => c.q);
    const aGauche = vns[0].q < Math.min(...Object.keys(t).map(H.decle).filter((c) => c.r === vns[0].r).map((c) => c.q));
    vns[1].r = r; vns[1].q = aGauche ? Math.min(...qs) - 1 : Math.max(...qs) + 1;
  }, /^B5 : flancs des villes neutres/);
  detecte('ville neutre hors du tiers central', (p) => {
    const t = terrain(p), rs = Object.keys(t).map((k) => H.decle(k).r), haut = Math.min(...rs), qs = Object.keys(t).map(H.decle).filter((c) => c.r === haut).map((c) => c.q);
    const vn = piece(p, (y) => y.modele === 'VN'); vn.r = haut; vn.q = Math.max(...qs) + 1;
  }, /^B5 : ville neutre en .* hors du tiers central des rangées/);
});

test('vérificateur indépendant : B6 (7 villes, écart de 4 pas, toutes reliées) et B7 (contact)', () => {
  detecte('deux villes voisines', (p) => {
    const t = terrain(p), d = p.deploiements.filter((x) => x.camp === 'vert');
    d[1].cle = H.voisines(d[0].cle).filter((v) => t[v])[0]; camps(p);
  }, /^B6 : villes .* à 1 pas/);
  detecte('une ville de moins', (p) => { p.pieces = p.pieces.filter((x) => x !== piece(p, (y) => y.modele === 'VN')); }, /^B6 : 6 villes pour 7/);
  detecte('ville hors d’atteinte', (p) => { const vn = piece(p, (y) => y.modele === 'VN'); vn.q = 25; vn.r = 0; }, /^B6 : villes .* non reliées par les cases franchissables/);
  // Contact : le même plateau jugé avec un seuil plus exigeant que celui de sa génération.
  assert.ok(fautes(bon(), { seuil: 7 }).some((x) => /^B7 : pièce .* contact \d < 7 \(pieces\)/.test(x)));
  assert.ok(fautes(bon(), { seuil: 12, mesure: 'cotes' }).some((x) => /^B7 : pièce .* contact \d+ < 12 \(cotes\)/.test(x)));
  // Une pièce écartée du plateau ne touche plus rien.
  detecte('pièce isolée', (p) => { piece(p, (y) => !['N1', 'VN'].includes(y.modele)).q += 20; }, /^B7 : pièce .* contact 0 < 3/);
});
