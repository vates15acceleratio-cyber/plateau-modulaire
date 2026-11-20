'use strict';
// outils/verifier-regles.js vérifie les règles du §9.1 (B1 à B3, B7) et du §10 (C1 à C3, villes libres sur une Plaine) sans passer par AT.controles. Ce test prouve qu'il ne
// laisse rien passer : un plateau généré est conforme, et chaque règle enfreinte exprès est bien signalée.
const test = require('node:test');
const assert = require('node:assert');
const { verifier } = require('../outils/verifier-regles.js');
const AT = globalThis.AT;
const P = AT.plateau, G = AT.generateur, H = AT.hex, K = AT.controles;

const MODELE = (() => { const r = G.generer(1); if (!r.ok) throw new Error(r.raison); return JSON.stringify(r.plateau); })();
const bon = () => JSON.parse(MODELE);
const fautes = (plateau, options) => { const o = options || {}; return verifier(plateau, o.seuil || 3, o.mesure || 'pieces', o.remplissages || 0).fautes; };
/** Le plateau modifié doit être signalé par une faute qui correspond au motif. */
function detecte(nom, modifier, motif, options) {
  const p = bon();
  modifier(p);
  const liste = fautes(p, options);
  assert.ok(liste.some((x) => motif.test(x)), nom + ' : non détecté. Fautes : ' + (liste.join(' | ') || 'aucune'));
  return p;
}
/** Test croisé : le plateau fautif est aussi en erreur pour les contrôles de l'outil (groupe « villes »), écrits à part. */
function croise(nom, modifier, motif) {
  const p = detecte(nom, modifier, motif), bilan = K.tout(p);
  assert.ok(bilan.villes.erreurs > 0, nom + ' : le vérificateur le signale, pas les contrôles');
}
const terrain = (p) => P.cases(p, { sansVilles: true });
const casesDe = (p, f) => Object.keys(terrain(p)).filter((k) => f(terrain(p)[k], k));
const piece = (p, f) => p.pieces.filter(f)[0];
const camps = (p) => { p.camps = { vert: p.deploiements.filter((d) => d.camp === 'vert').map((d) => d.cle), rouge: p.deploiements.filter((d) => d.camp === 'rouge').map((d) => d.cle) }; };
const de = (p, qui) => p.deploiements.filter((d) => d.camp === qui);

test('vérificateur indépendant : un plateau généré est conforme (avec et sans remplissages) ; contrôles et vérificateur d’accord', () => {
  assert.deepStrictEqual(fautes(bon()), []);
  for (let g = 2; g <= 6; g++) { const r = G.generer(g); assert.ok(r.ok, r.raison); assert.deepStrictEqual(fautes(r.plateau), []); assert.strictEqual(K.tout(r.plateau).erreurs, 0); }
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
  detecte('ville d’une case de l’ancien catalogue', (p) => { piece(p, (x) => !['N1', 'VN', 'M4', 'M5'].includes(x.modele)).modele = 'V'; }, /^C1 : ville en pièce d’une case \(V\)/);
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

test('vérificateur indépendant : C1 (6 villes posées par-dessus : 2 neutres, 2 par camp ; camps), test croisé avec les contrôles', () => {
  croise('une ville neutre de trop', (p) => { de(p, 'vert')[0].camp = 'neutre'; camps(p); }, /^C1 : 3 ville\(s\) neutre\(s\) pour 2/);
  croise('trois villes pour Vert', (p) => { de(p, 'neutre')[0].camp = 'vert'; camps(p); }, /^C1 : 3 ville\(s\) de déploiement pour vert/);
  croise('camps enregistrés faux', (p) => { p.camps.vert = [p.camps.vert[0]]; }, /^C1 : camp vert enregistré/);
  detecte('une ville de moins', (p) => { p.deploiements.pop(); camps(p); }, /^C1 : 5 ville\(s\) posée\(s\) pour 6/);
  detecte('propriétaire inconnu', (p) => { de(p, 'neutre')[0].camp = 'bleu'; }, /^C1 : propriétaire inconnu/);
  detecte('ville neutre en pièce d’une case (règles précédentes)', (p) => {
    const t = terrain(p), bord = Object.keys(t).map((k) => H.voisines(k).filter((v) => !t[v])[0]).filter(Boolean)[0], c = H.decle(bord);
    p.pieces.push({ id: 'vn', modele: 'VN', q: c.q, r: c.r, rotation: 0 });
  }, /^C1 : ville en pièce d’une case \(VN\)/);
  detecte('champ des règles précédentes écrit', (p) => { p.profondeurExtremite = 3; }, /^format : champ profondeurExtremite/);
});

test('vérificateur indépendant : C2 (sur une Plaine du plateau, hors noyau, une par case), test croisé avec les contrôles', () => {
  croise('ville sur une forêt', (p) => { de(p, 'neutre')[0].cle = casesDe(p, (c) => c.terrain === 'foret')[0]; }, /^C2 : ville sur foret/);
  croise('ville sur le noyau', (p) => { de(p, 'rouge')[0].cle = '1,0'; camps(p); }, /^C2 : ville sur le noyau/);
  croise('ville hors du terrain', (p) => { de(p, 'vert')[0].cle = '25,0'; camps(p); }, /^C2 : ville hors du terrain/);
  detecte('deux villes sur la même case', (p) => { de(p, 'neutre')[1].cle = de(p, 'neutre')[0].cle; }, /^C2 : deux villes sur la même case/);
  // Plus aucune règle de bord : une ville au milieu du plateau, entourée de tuiles et à l'écart des autres, est conforme.
  const p = bon(), t = terrain(p), sans = JSON.parse(JSON.stringify(p));
  sans.deploiements = sans.deploiements.filter((d) => d !== de(sans, 'vert')[0]);
  const milieu = P.placesVille(P.avecCamps(sans), 'vert').filter((k) => H.voisines(k).every((v) => t[v]))[0];
  assert.ok(milieu, 'une Plaine admissible entourée de tuiles');
  de(p, 'vert')[0].cle = milieu; camps(p);
  assert.deepStrictEqual(fautes(p), []);
  assert.strictEqual(K.tout(p).erreurs, 0);
});

test('vérificateur indépendant : C3 (7 villes, écart de 4 pas) et B7 (contact), test croisé avec les contrôles', () => {
  croise('deux villes voisines', (p) => {
    const t = terrain(p), d = de(p, 'vert'), proche = H.voisines(d[0].cle).filter((v) => t[v] && t[v].terrain === 'plaine' && t[v].modele !== 'N1')[0] || H.voisines(de(p, 'neutre')[0].cle).filter((v) => t[v] && t[v].terrain === 'plaine')[0];
    d[1].cle = proche; camps(p);
  }, /^C3 : villes .* à [123] pas/);
  croise('ville à 3 pas du centre', (p) => {
    const d0 = P.distancesPas(p, '0,0'), t = terrain(p);
    de(p, 'neutre')[0].cle = Object.keys(t).filter((k) => t[k].terrain === 'plaine' && t[k].modele !== 'N1' && d0[k] === 3)[0];
  }, /^C3 : villes .* à 3 pas/);
  detecte('une ville de moins', (p) => { p.deploiements.shift(); }, /^C3 : 6 villes pour 7/);
  // Contact : le même plateau jugé avec un seuil plus exigeant que celui de sa génération.
  assert.ok(fautes(bon(), { seuil: 7 }).some((x) => /^B7 : pièce .* contact \d < 7 \(pieces\)/.test(x)));
  assert.ok(fautes(bon(), { seuil: 12, mesure: 'cotes' }).some((x) => /^B7 : pièce .* contact \d+ < 12 \(cotes\)/.test(x)));
  // Une pièce écartée du plateau ne touche plus rien.
  detecte('pièce isolée', (p) => { piece(p, (y) => !['N1', 'VN'].includes(y.modele)).q += 20; }, /^B7 : pièce .* contact 0 < 3/);
});
