'use strict';
/*
 * aides-trace.js : contrôles de tracé des tuiles, communs à tests/catalogue.test.js (4×4) et tests/catalogue-5x5.test.js (5×5).
 * Ce fichier n'est pas un fichier de test : il n'est pas lancé seul. Sous Node : require('./aides-trace.js').
 * Le format (cotes de G.format) est un paramètre de problemesTrace : '4x4' ou '5x5'.
 */
require('../src/geometrie.js');
require('../src/modele.js');
require('../src/rendu.js');
const PM = globalThis.PM;
const G = PM.geometrie, R = PM.rendu, M = PM.modele;

function distPointSegment(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l = dx * dx + dy * dy;
  const t = l ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function orient(a, b, c) { return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x); }
function distSegments(a, b, c, d) {
  if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return 0;
  return Math.min(distPointSegment(a, c, d), distPointSegment(b, c, d), distPointSegment(c, a, b), distPointSegment(d, a, b));
}
function distPolylignes(P, Q) {
  let m = Infinity;
  for (let i = 0; i + 1 < P.length; i++) for (let j = 0; j + 1 < Q.length; j++) m = Math.min(m, distSegments(P[i], P[i + 1], Q[j], Q[j + 1]));
  return m;
}
function distPointPolyligne(p, P) {
  let m = Infinity;
  for (let i = 0; i + 1 < P.length; i++) m = Math.min(m, distPointSegment(p, P[i], P[i + 1]));
  return m;
}

/**
 * Tracé de chaque chemin : convention commune à l'écran et à l'export, définie dans src/rendu.js
 * (lien = segment ; raccord = amorce perpendiculaire de 10 mm puis segment ; port = amorce de 28 mm
 * sur la bissectrice puis segment).
 */
function traces(m, format) { return R.tracesModele(m, format); }

/** Retire d'un tracé la partie couverte par ses cases d'extrémité (rayon + 4 mm pour la case commune). */
function rogner(t, commun) {
  const coupe = (c, vers) => {
    const r = c.diametre / 2 + (c === commun ? 4 : 0), d = Math.hypot(vers.x - c.x, vers.y - c.y), k = Math.min(1, r / d);
    return { x: c.x + (vers.x - c.x) * k, y: c.y + (vers.y - c.y) * k };
  };
  const pts = t.pts.map((p) => ({ x: p.x, y: p.y }));
  if (t.type === 'lien') return [coupe(t.cases[0], t.pts[1]), coupe(t.cases[1], t.pts[0])];
  pts[pts.length - 1] = coupe(t.cases[0], t.pts[t.pts.length - 2]);
  return pts;
}

/**
 * Contrôles de tracé au format donné ('4x4' par défaut, ou '5x5'), anticipant la règle « chevauchement chemin / case » :
 *  - un chemin reste à r + 4 mm au moins des cases qui ne sont pas ses extrémités ;
 *  - un chemin (hors son propre port) reste à 24 mm au moins de chaque coin (zone du jeton + 4 mm) ;
 *  - deux chemins ne se touchent pas (axes à 8 mm au moins), hors des disques de leurs cases
 *    (la case commune à deux chemins est élargie de 4 mm : les chemins peuvent s'y rejoindre).
 */
function problemesTrace(m, format) {
  const F = G.format(format || '4x4');
  const pb = [], ts = traces(m, F);
  for (const t of ts) {
    for (const c of m.cases) {
      if (t.cases.includes(c)) continue;
      const d = distPointPolyligne(c, t.pts);
      if (d < c.diametre / 2 + 4 - 1e-9) pb.push(`${m.id} ${t.id} passe à ${d.toFixed(1)} mm de ${c.id}`);
    }
    for (let k = 0; k < 4; k++) {
      if (t.type === 'port' && t.coin === k) continue;
      const d = distPointPolyligne(F.pointCoin(k), t.pts);
      if (d < F.RAYON_ZONE_COIN + 4 - 1e-9) pb.push(`${m.id} ${t.id} entre dans la zone du coin ${k} (${d.toFixed(1)} mm)`);
    }
  }
  for (let i = 0; i < ts.length; i++) {
    for (let j = i + 1; j < ts.length; j++) {
      const commun = ts[i].cases.find((c) => ts[j].cases.includes(c));
      const d = distPolylignes(rogner(ts[i], commun), rogner(ts[j], commun));
      if (d < F.LARGEUR_CHEMIN - 1e-9) pb.push(`${m.id} ${ts[i].id} et ${ts[j].id} se touchent (${d.toFixed(1)} mm)`);
    }
  }
  return pb;
}

/* ---------------------------------------------------------------------- */
/* Passages sans case (docs/18, décisions du 2026-10-17) et variété        */
/* ---------------------------------------------------------------------- */

/** Cases porteuses (départ d'un chemin vers un coin) d'un modèle. */
function porteuses(m) { return m.chemins.filter((ch) => ch.b.coin !== undefined).map((ch) => ch.a['case']); }

/** Réseaux de passages d'un modèle : composantes des passages reliés par un pivot (un T = un réseau). */
function reseauxDePassages(m) {
  const ps = m.passages || [], parent = ps.map((_, k) => k);
  const racine = (k) => { while (parent[k] !== k) k = parent[k]; return k; };
  ps.forEach((p, k) => ps.forEach((q, n) => {
    if (n <= k) return;
    const pivots = (x) => [x.a, x.b].filter((e) => e.pivot !== undefined).map((e) => e.pivot);
    if (pivots(p).some((v) => pivots(q).includes(v))) parent[racine(n)] = racine(k);
  }));
  const groupes = new Map();
  ps.forEach((p, k) => { const r = racine(k); if (!groupes.has(r)) groupes.set(r, []); groupes.get(r).push(p); });
  return [...groupes.values()];
}

/**
 * Règles des passages décidées par l'utilisateur (docs/18) et de docs/39, vérifiées sur un modèle du catalogue (format '4x4' ou '5x5').
 * Renvoie la liste des manquements (vide si tout est respecté) :
 *  - aucun passage vers un coin ; aucun passage entre deux cases (c'est un chemin) ;
 *  - aucun passage TRAVERSANT : un passage dont les deux bouts sont des raccords de côtés opposés (droit ou courbe) ; un T dont deux
 *    branches vont à des côtés opposés n'en est pas un (P3 du 5×5, docs/18 réponse 5 : il porte des cases en plus) ;
 *  - une case porteuse ne touche jamais un passage ;
 *  - bords et coins : un réseau de passages au plus, jamais depuis la case d'apparition ;
 *  - centrale 4×4 : un passage au plus (docs/18) ; centrale 5×5 : un T au plus (un pivot) ;
 *  - aucun mur sur une centrale : chaque côté a un raccord (de chemin ou de passage) au milieu ; en 5×5, sauf « Deux ponts » (deux murs
 *    opposés sur une centrale à deux porteuses latérales opposées non reliées, docs/18) ;
 *  - R1 et R3 : un port par case et aucun raccord sur une porteuse ; en 5×5, règles de la porteuse latérale (docs/55 point 7).
 */
function reglesPassages(m, format) {
  const pb = [], ps = m.passages || [], port = new Set(porteuses(m));
  const appar = new Set(m.cases.filter((c) => c.type === 'apparition').map((c) => c.id));
  for (const p of ps) {
    const ext = [p.a, p.b];
    if (ext.some((e) => e.coin !== undefined)) pb.push(`${m.id} ${p.id} : passage vers un coin`);
    if (ext.every((e) => e['case'] !== undefined)) pb.push(`${m.id} ${p.id} : passage entre deux cases`);
    if (ext.every((e) => e.raccord) && (p.a.raccord.cote + 2) % 4 === p.b.raccord.cote) pb.push(`${m.id} ${p.id} : passage traversant`);
    for (const e of ext) {
      if (e['case'] !== undefined && port.has(e['case'])) pb.push(`${m.id} ${p.id} : touche la porteuse ${e['case']}`);
      if (e['case'] !== undefined && appar.has(e['case'])) pb.push(`${m.id} ${p.id} : part de la case d'apparition`);
    }
  }
  // une porteuse ne touche pas non plus un passage par un chemin vers un raccord qui ferait face à un passage : R3 (aucun raccord latéral) ;
  // 5×5 (docs/55 point 7) : une porteuse latérale (2 ports, coins k et k + 1) porte le seul raccord (k, 1) ; une porteuse à 1 port (coin k)
  // peut porter la paire basse qui longe ce coin, (k − 1, 2) et (k, 0)
  const permis = (id) => {
    if (format !== '5x5') return [];
    const coins = m.chemins.filter((ch) => ch.a['case'] === id && ch.b.coin !== undefined).map((ch) => ch.b.coin).sort((a, b) => a - b);
    if (coins.length === 1) return m.gabarit !== 'coin' ? [] : [`${(coins[0] + 3) % 4}:2`, `${coins[0]}:0`];
    if (coins.length === 2 && (coins[0] + 1) % 4 === coins[1]) return [`${coins[0]}:1`];
    if (coins.length === 2 && (coins[1] + 1) % 4 === coins[0]) return [`${coins[1]}:1`];
    return [];
  };
  for (const ch of m.chemins) {
    if (!ch.b.raccord || !port.has(ch.a['case'])) continue;
    if (!permis(ch.a['case']).includes(`${ch.b.raccord.cote}:${ch.b.raccord.pos}`)) pb.push(`${m.id} ${ch.id} : raccord sur une porteuse`);
  }
  // 5×5 : une porteuse a au plus 2 ports, ceux d'un même côté (porteuse latérale) ; ailleurs, un seul (R1)
  for (const id of port) {
    const n = m.chemins.filter((ch) => ch.a['case'] === id && ch.b.coin !== undefined).length;
    if (n > 1 && !(format === '5x5' && n === 2 && permis(id).length === 1)) pb.push(`${m.id} ${id} : plusieurs ports hors d'une porteuse latérale`);
  }
  if (m.gabarit !== 'centrale' && reseauxDePassages(m).length > 1) pb.push(`${m.id} : plus d'un passage sur un ${m.gabarit}`);
  if (m.gabarit === 'centrale' && format === '4x4' && ps.length > 1) pb.push(`${m.id} : plus d'un passage sur une centrale 4×4`);
  if (m.gabarit === 'centrale' && (m.pivots || []).length > 1) pb.push(`${m.id} : plus d'un T`);
  if (m.gabarit === 'centrale') {
    const rac = M.masquesDuModele(m).raccords;
    // 5×5 (« Deux ponts », docs/18) : deux murs opposés permis sur une centrale à deux porteuses latérales opposées non reliées
    const deuxPonts = format === '5x5' && port.size === 2 && [...port].every((id) => permis(id).length === 1) &&
      !m.chemins.some((ch) => ch.b['case'] !== undefined) && !(m.passages || []).length;
    for (let cote = 0; cote < 4; cote++) {
      const t = G.triplet(rac, cote);
      if (t === 0b010) continue;
      if (deuxPonts && t === 0 && G.triplet(rac, (cote + 2) % 4) === 0) continue;
      pb.push(`${m.id} : côté ${cote} sans raccord au milieu (mur) ou hors du milieu`);
    }
  }
  return pb;
}

/**
 * Signature d'un modèle tourné de `rot` quarts de tour, puis reflété gauche-droite si `miroir` : cases étiquetées par leurs ports et
 * leurs raccords (tournés), arêtes internes (chemins et passages) entre étiquettes ; un pivot est étiqueté par ses raccords. Deux
 * modèles de même signature ont le même routage (mêmes coins, mêmes côtés, mêmes liaisons).
 */
function signature(m, rot, miroir) {
  const coin = (k) => { const c = (k + rot) % 4; return miroir ? [1, 0, 3, 2][c] : c; };
  const rac = (r) => { let c = (r.cote + rot) % 4, p = r.pos; if (miroir) { c = c === 1 ? 3 : (c === 3 ? 1 : c); p = 2 - p; } return 'r' + c + p; };
  const etiquette = new Map(m.cases.map((c) => [c.id, []]).concat((m.pivots || []).map((v) => ['v:' + v.id, ['v']])));
  const cle = (e) => e['case'] !== undefined ? e['case'] : 'v:' + e.pivot;
  for (const ch of m.chemins) {
    if (ch.b['case'] !== undefined) continue;
    etiquette.get(ch.a['case']).push(ch.b.coin !== undefined ? 'p' + coin(ch.b.coin) : rac(ch.b.raccord));
  }
  for (const p of m.passages || []) {
    if (p.a.raccord && p.b.raccord) continue; // passage raccord–raccord : compté à part
    const [x, r] = p.a.raccord ? [p.b, p.a] : (p.b.raccord ? [p.a, p.b] : [null, null]);
    if (x) etiquette.get(cle(x)).push('q' + rac(r.raccord));
  }
  const lab = (id) => etiquette.get(id).sort().join('') + (m.cases.some((c) => c.id === id && c.type === 'apparition') ? '*' : '');
  const aretes = m.chemins.filter((ch) => ch.b['case'] !== undefined).map((ch) => 'h' + [lab(ch.a['case']), lab(ch.b['case'])].sort().join('-'))
    .concat((m.passages || []).filter((p) => !p.a.raccord && !p.b.raccord).map((p) => 'q' + [lab(cle(p.a)), lab(cle(p.b))].sort().join('-')))
    .concat((m.passages || []).filter((p) => p.a.raccord && p.b.raccord).map((p) => 'qq' + [rac(p.a.raccord), rac(p.b.raccord)].sort().join('-')))
    .sort();
  return [...etiquette.keys()].map(lab).sort().join(',') + '|' + aretes.join(',');
}

module.exports = { distPointSegment, orient, distSegments, distPolylignes, distPointPolyligne, rogner, traces, problemesTrace, porteuses, reseauxDePassages, reglesPassages, signature };
