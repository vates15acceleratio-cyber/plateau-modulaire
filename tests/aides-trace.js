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
const G = PM.geometrie, R = PM.rendu;

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

module.exports = { distPointSegment, orient, distSegments, distPolylignes, distPointPolyligne, rogner, traces, problemesTrace };
