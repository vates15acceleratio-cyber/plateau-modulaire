'use strict';
/*
 * planche-organique.js : images et mesures des catalogues CANDIDATS « organiques » (outils/catalogue-organique.js), avec le
 * vrai rendu de src/rendu.js. Rien n'est branché dans l'application.
 *
 * Lancer à la racine du projet :
 *   node outils/planche-organique.js [dossier]          images et mesures.json (défaut : docs/croquis/organique)
 *   node outils/planche-organique.js series [N]         séries de N plateaux par format (défaut 200) -> centrales-ouvertes-N.json
 * Images, pour chaque format (4x4, 5x5) :
 *   - planche-<format>.svg / .png : modèles de la révision « centrales ouvertes » en orientation canonique ;
 *   - plateau-<format>-A.svg / .png : pose libre, centrales orientées ;
 *   - plateau-<format>-B.svg / .png : pose symétrique (moitié sud = moitié nord tournée de 180°).
 * PNG : PyMuPDF si présent, sinon capture par Edge sans fenêtre ; sinon SVG seulement.
 *
 * Mesures (docs/18, réponses sur la révision « rythme ») :
 *  - rythme STRICT : seules les cases d'un réseau de passages qui économise un pas sont des zones d'intérêt (réseau qui
 *    contient un passage sans case à ses deux bouts : raccord–raccord ou branche d'un T) ; un crochet raccord -> case ne
 *    compte pas (il vaut un chemin ordinaire) ;
 *  - équilibre des accès au centre : voir accesCentre ;
 *  - pose symétrique : voir tirerPlateau (option symetrique).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
require(path.join(RACINE, 'src/catalogue.js'));
require(path.join(RACINE, 'src/graphe.js'));
require(path.join(RACINE, 'src/rendu.js'));
require(path.join(__dirname, 'catalogue-organique.js'));
const TRACE = require(path.join(RACINE, 'tests/aides-trace.js')); // contrôle de tracé des tests (lecture seule)
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, GR = PM.graphe, R = PM.rendu, CO = PM.catalogueOrganique;

const MODES_CLI = ['series'];
const SORTIE = path.resolve(process.argv[2] && MODES_CLI.indexOf(process.argv[2]) < 0 ? process.argv[2] : path.join(RACINE, 'docs/croquis/organique'));
const NOMS_COINS = ['NO', 'NE', 'SE', 'SO'];
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Cible de ports des plateaux 5×5 : 39 ports = 77 cases (pose libre) ; 40 = 78 cases (pose symétrique : total pair). */
const PORTS_CIBLE_5X5 = { libre: 39, symetrique: 40 };

/* ------------------------------------------------------------------ */
/* Contrôle des modèles                                                */
/* ------------------------------------------------------------------ */

/** Le modèle est-il identique à lui-même tourné de 180° (ports, raccords, raccords des passages) ? */
function symetriqueDemiTour(m) {
  // liaisons du modèle (chemins et passages) entre cases, pivots, raccords et coins ; on cherche une permutation des cases
  // et des pivots qui, avec raccords (k, p) -> (k + 2, p) et coins c -> c + 2, redonne les mêmes liaisons
  const noeuds = (m.cases || []).map((c) => 'c:' + c.id).concat((m.pivots || []).map((p) => 'v:' + p.id));
  const ext = (e) => e['case'] !== undefined ? 'c:' + e['case'] : e.pivot !== undefined ? 'v:' + e.pivot : e.raccord ? 'R' + e.raccord.cote + e.raccord.pos : 'K' + e.coin;
  const liaisons = (m.chemins || []).map((c) => ['h', ext(c.a), ext(c.b)]).concat((m.passages || []).map((p) => ['p', ext(p.a), ext(p.b)]));
  const cle = (l) => l[0] + '|' + [l[1], l[2]].sort().join('|');
  const ref = new Set(liaisons.map(cle));
  const tourner = (x, perm) => x[0] === 'R' ? 'R' + ((+x[1] + 2) % 4) + x[2] : x[0] === 'K' ? 'K' + ((+x[1] + 2) % 4) : perm.get(x);
  const essayer = (k, perm, libres) => {
    if (k === noeuds.length) return liaisons.every((l) => ref.has(cle([l[0], tourner(l[1], perm), tourner(l[2], perm)])));
    for (const y of libres) {
      if (y[0] !== noeuds[k][0]) continue;
      perm.set(noeuds[k], y);
      if (essayer(k + 1, perm, libres.filter((z) => z !== y))) return true;
    }
    perm.delete(noeuds[k]);
    return false;
  };
  return essayer(0, new Map(), noeuds.slice());
}

/** Fiche d'un modèle : cases, ports (coins desservis), passages, validation et contrôle de tracé. */
function ficheModele(m, grille) {
  const v = M.validerModele(m, grille), mm = M.masquesDuModele(m);
  const coins = [0, 1, 2, 3].filter((k) => (mm.portsCoin >> k) & 1);
  const info = (CO.infos[grille] || {})[m.id] || {};
  return {
    id: m.id, nom: m.nom, gabarit: m.gabarit, famille: info.famille || '', repere: info.repere || '',
    cases: (m.cases || []).length, ports: coins.length, coins: coins.map((k) => NOMS_COINS[k]),
    chemins: (m.chemins || []).length, passages: (m.passages || []).length, pivots: (m.pivots || []).length, exemplaires: m.exemplaires,
    symetrique: m.gabarit === 'centrale' ? symetriqueDemiTour(m) : null,
    blocages: v.erreurs.map((e) => e.code), alertes: v.alertes.map((e) => e.code), trace: TRACE.problemesTrace(m, grille)
  };
}

/* ------------------------------------------------------------------ */
/* Tirage maison                                                       */
/* ------------------------------------------------------------------ */

/** Générateur pseudo-aléatoire à graine (mulberry32). */
function hasard(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cellules de la grille par rôle. */
function cellules(F) {
  const res = { coin: [], bord: [], centrale: [] };
  for (let lig = 0; lig < F.GRILLE.lignes; lig++) {
    for (let col = 0; col < F.GRILLE.colonnes; col++) res[M.gabaritCellule(col, lig, F)].push({ col, lig });
  }
  return res;
}

/** Ports par jonction intérieure d'un document : Map 'i,j' -> nombre. */
function portsParJonction(doc, F) {
  const res = new Map();
  for (let j = 1; j < F.GRILLE.lignes; j++) for (let i = 1; i < F.GRILLE.colonnes; i++) res.set(i + ',' + j, M.portsJonction(doc, i, j).ports);
  return res;
}

/** Note des ports : minimum, jonctions à 3 ports ou plus, total, et (5×5) existence d'un placement 2-3-2 sur des jonctions à 3 ports. */
function noteports(doc, F) {
  const p = portsParJonction(doc, F), v = Array.from(p.values());
  let faisable = true;
  if (F.id === '5x5') {
    const n3 = (rangs) => Array.from(p.entries()).filter(([k, x]) => x >= 3 && rangs.indexOf(+k.split(',')[1]) >= 0).length;
    faisable = n3([1]) >= 2 && n3([4]) >= 2 && n3([2, 3]) >= 3;
  }
  return { min: Math.min(...v), a3: v.filter((x) => x >= 3).length, total: v.reduce((s, x) => s + x, 0), faisable };
}

/** Cellule symétrique par demi-tour. */
function partenaire(c, F) { return { col: F.GRILLE.colonnes - 1 - c.col, lig: F.GRILLE.lignes - 1 - c.lig }; }
/** La cellule est-elle la « représentante » de sa paire (moitié nord, ou ouest de la rangée du milieu) ? */
function representante(c, F) { const p = partenaire(c, F); return c.lig < p.lig || (c.lig === p.lig && c.col <= p.col); }

/** Pioche `n` ids dans `stock` (tableau d'ids, modifié). */
function piocher(stock, n, alea) { const res = []; while (res.length < n && stock.length) res.push(stock.splice(Math.floor(alea() * stock.length), 1)[0]); return res; }

/**
 * Tire un plateau. Stock = exemplaires des modèles autorisés (`filtre`) ; `imposes` = ids posés d'abord.
 * options :
 *  - symetrique : moitié sud = moitié nord tournée de 180° (toutes les tuiles ; une paire consomme 2 exemplaires) ; en 5×5,
 *    la centrale du milieu est un modèle symétrique par demi-tour ;
 *  - portsCible (5×5) : composition choisie pour viser ce total de ports (nombre de B1 ajusté aux centrales tirées) ;
 *  - orienter (défaut vrai) : rotations des centrales (et, en 5×5, échanges de bords) choisies pour les ports puis le rythme.
 * Renvoie le document, ou null si le stock ne suffit pas.
 */
function tirerPlateau(grille, modeles, filtre, imposes, alea, options) {
  options = options || {};
  const F = G.format(grille), doc = M.nouveauDocument(grille), sym = !!options.symetrique;
  doc.modeles = clone(modeles);
  const cel = cellules(F), parId = new Map(modeles.map((m) => [m.id, m]));
  const portsDe = (id) => ficheModele(parId.get(id), grille).ports;
  const stockDe = (role) => {
    const s = [];
    // pose symétrique : les exemplaires ne servent que de poids (poses illimitées, docs/18) ; stock quadruplé pour former les paires
    modeles.filter((m) => m.gabarit === role && m.exemplaires > 0 && filtre(m)).forEach((m) => { for (let k = 0; k < m.exemplaires * (sym ? 4 : 1); k++) s.push(m.id); });
    return s;
  };
  const pose = new Map(); // 'col,lig' -> id
  const cle = (c) => c.col + ',' + c.lig;

  /* --- centrales --- */
  {
    const stock = stockDe('centrale'), cells = cel.centrale;
    imposes.filter((id) => !/^[BK]/.test(id)).forEach((id) => { const k = stock.indexOf(id); if (k >= 0) stock.splice(k, 1); });
    const imp = imposes.filter((id) => !/^[BK]/.test(id) && parId.has(id));
    if (!sym) {
      const pris = imp.concat(piocher(stock, cells.length - imp.length, alea));
      if (pris.length < cells.length) return null;
      melanger(pris, alea);
      cells.forEach((c, k) => pose.set(cle(c), pris[k]));
    } else {
      const reps = cells.filter((c) => representante(c, F));
      for (const c of reps) {
        const p = partenaire(c, F), seul = p.col === c.col && p.lig === c.lig;
        // paire : 2 exemplaires du même modèle ; milieu (5×5) : modèle symétrique par demi-tour
        const choix = seul ? stock.filter((id) => symetriqueDemiTour(parId.get(id)))
          : stock.filter((id, k) => stock.indexOf(id) === k && stock.filter((x) => x === id).length >= 2);
        if (!choix.length) return null;
        const id = choix[Math.floor(alea() * choix.length)];
        stock.splice(stock.indexOf(id), 1);
        if (!seul) stock.splice(stock.indexOf(id), 1);
        pose.set(cle(c), id); pose.set(cle(p), id);
      }
    }
  }
  /* --- bords : en 5×5 avec portsCible, nombre de B1 = ports manquants --- */
  {
    const stock = stockDe('bord'), cells = cel.bord;
    let pris;
    if (grille === '5x5' && options.portsCible) {
      const portsCentrales = cel.centrale.reduce((s, c) => s + portsDe(pose.get(cle(c))), 0);
      const nbCoins = cel.coin.length; // K2 : 1 port
      const deux = stock.filter((id) => portsDe(id) === 2), un = stock.filter((id) => portsDe(id) === 1);
      let x = options.portsCible - nbCoins - cells.length - portsCentrales; // chaque bord a 1 port, un B1 en ajoute 1
      x = Math.max(0, Math.min(x, deux.length, cells.length));
      if (sym && x % 2) x--; // paires
      if (cells.length - x > un.length) return null;
      pris = piocher(deux, x, alea).concat(piocher(un, cells.length - x, alea));
    } else {
      const imp = imposes.filter((id) => /^B/.test(id));
      imp.forEach((id) => { const k = stock.indexOf(id); if (k >= 0) stock.splice(k, 1); });
      pris = imp.concat(piocher(stock, cells.length - imp.length, alea));
    }
    if (pris.length < cells.length) return null;
    melanger(pris, alea);
    if (!sym) cells.forEach((c, k) => pose.set(cle(c), pris[k]));
    else {
      // paires de bords : on regroupe les ids par deux identiques
      const reps = cells.filter((c) => representante(c, F)), paires = [];
      const reste = pris.slice();
      while (reste.length) {
        const id = reste.shift(), k = reste.indexOf(id);
        if (k >= 0) { reste.splice(k, 1); paires.push(id); }
      }
      if (paires.length < reps.length) {
        // pas assez de paires : on complète avec des paires du modèle de bord le plus fourni
        const st = stockDe('bord'), plus = st.sort((a, b) => st.filter((x) => x === b).length - st.filter((x) => x === a).length)[0];
        while (paires.length < reps.length) paires.push(plus);
      }
      melanger(paires, alea);
      reps.forEach((c, k) => { pose.set(cle(c), paires[k]); pose.set(cle(partenaire(c, F)), paires[k]); });
    }
  }
  /* --- coins --- */
  {
    const stock = stockDe('coin'), cells = cel.coin;
    if (!sym) {
      const pris = piocher(stock, cells.length, alea);
      if (pris.length < cells.length) return null;
      cells.forEach((c, k) => pose.set(cle(c), pris[k]));
    } else {
      cells.filter((c) => representante(c, F)).forEach((c) => {
        const choix = stock.filter((id, k) => stock.indexOf(id) === k && stock.filter((x) => x === id).length >= 2);
        const id = choix.length ? choix[Math.floor(alea() * choix.length)] : stock[0];
        stock.splice(stock.indexOf(id), 1); if (stock.indexOf(id) >= 0) stock.splice(stock.indexOf(id), 1);
        pose.set(cle(c), id); pose.set(cle(partenaire(c, F)), id);
      });
    }
  }
  /* --- pose (rotation déduite pour les bords et les coins ; centrales au hasard puis orientées) --- */
  const ordre = ['coin', 'bord', 'centrale'];
  let d = doc;
  ordre.forEach((role) => cel[role].forEach((c) => {
    d = M.poserTuile(d, pose.get(cle(c)), c.col, c.lig, role === 'centrale' ? Math.floor(alea() * 4) : undefined);
  }));
  Object.assign(doc, d);
  const tuile = (c) => doc.plateau.tuiles.find((t) => t.col === c.col && t.lig === c.lig);
  // symétrie : la tuile partenaire d'une centrale prend la rotation + 2
  const centrales = cel.centrale.map(tuile);
  const groupesRot = []; // [tuile représentante, partenaire ou null]
  if (sym) {
    cel.centrale.filter((c) => representante(c, F)).forEach((c) => {
      const p = partenaire(c, F), seul = p.col === c.col && p.lig === c.lig;
      groupesRot.push([tuile(c), seul ? null : tuile(p)]);
    });
  } else centrales.forEach((t) => groupesRot.push([t, null]));
  const appliquer = () => groupesRot.forEach(([t, p]) => { if (p) p.rot = (t.rot + 2) % 4; });
  appliquer();
  if (options.orienter === false) return doc;

  // note d'orientation : ports (minimum, placement 2-3-2 possible), puis rythme estimé et, sauf equilibrer: false, écart des
  // portes d'accès au centre entre les camps (une case de chaîne pèse autant que 3 portes d'écart), puis distance max, puis
  // jonctions à 3 ports
  const equilibrer = options.equilibrer !== false;
  const note = () => {
    const n = noteports(doc, F), r = rythmeEstime(doc, F);
    const ecart = equilibrer ? Math.abs(accesCentre(doc, r.graphe, F, { sansFlot: true }).ecart) : 0;
    return n.min * 1e7 + (n.faisable ? 1e6 : 0) - r.chaineMax * 1000 - ecart * 300 - r.distMax * 100 + n.a3;
  };
  if (groupesRot.length <= 4) {
    // essai de toutes les combinaisons de rotations (4×4 : 4^4 en pose libre, 4^2 en pose symétrique)
    let best = -Infinity, rots = groupesRot.map(([t]) => t.rot);
    for (let code = 0; code < Math.pow(4, groupesRot.length); code++) {
      groupesRot.forEach(([t], k) => { t.rot = Math.floor(code / Math.pow(4, k)) % 4; });
      appliquer();
      const n = note();
      if (n > best || (n === best && alea() < 0.3)) { best = n; rots = groupesRot.map(([t]) => t.rot); }
    }
    groupesRot.forEach(([t], k) => { t.rot = rots[k]; });
    appliquer();
    return doc;
  }
  // 5×5 : montée de colline sur les rotations et sur les échanges de bords (paires en pose symétrique)
  const bords = cel.bord.filter((c) => !sym || representante(c, F)).map((c) => ({ t: tuile(c), p: sym ? tuile(partenaire(c, F)) : null }));
  const echanger = (a, b) => {
    [a.t.modeleId, b.t.modeleId] = [b.t.modeleId, a.t.modeleId];
    if (a.p && b.p) { a.p.modeleId = a.t.modeleId; b.p.modeleId = b.t.modeleId; }
    // la rotation d'un bord dépend de sa cellule seulement : inchangée
  };
  // montée de colline : rotations des centrales et échanges de bords, avec une note donnée
  const monter = (f) => {
    let meilleur = f(), progres = true, tours = 0;
    while (progres && tours++ < 30) {
      progres = false;
      for (const [t] of groupesRot) {
        const r0 = t.rot;
        for (let r = 0; r < 4; r++) {
          if (r === r0) continue;
          t.rot = r; appliquer();
          const n = f();
          if (n > meilleur || (n === meilleur && alea() < 0.15)) { if (n > meilleur) progres = true; meilleur = n; break; }
          t.rot = r0; appliquer();
        }
      }
      for (let a = 0; a < bords.length; a++) {
        for (let b = a + 1; b < bords.length; b++) {
          if (bords[a].t.modeleId === bords[b].t.modeleId) continue;
          echanger(bords[a], bords[b]);
          const n = f();
          if (n > meilleur) { meilleur = n; progres = true; } else echanger(bords[a], bords[b]);
        }
      }
    }
    return meilleur;
  };
  // 1) note rapide (ports seulement) avec plusieurs départs au hasard ; 2) note complète depuis le meilleur départ
  const rapide = () => { const n = noteports(doc, F); return n.min * 1e7 + (n.faisable ? 1e6 : 0) + n.a3; };
  const etat = () => ({ rots: groupesRot.map(([t]) => t.rot), ids: bords.map((b) => b.t.modeleId) });
  const remettre = (e) => {
    groupesRot.forEach(([t], k) => { t.rot = e.rots[k]; });
    bords.forEach((b, k) => { b.t.modeleId = e.ids[k]; if (b.p) b.p.modeleId = e.ids[k]; });
    appliquer();
  };
  let depart = null;
  for (let essai = 0; essai < 8; essai++) {
    if (essai) { groupesRot.forEach(([t]) => { t.rot = Math.floor(alea() * 4); }); appliquer(); }
    const n = monter(rapide);
    if (!depart || n > depart.n) depart = { n, e: etat() };
  }
  remettre(depart.e);
  monter(note);
  return doc;
}

function melanger(t, alea) { for (let k = t.length - 1; k > 0; k--) { const r = Math.floor(alea() * (k + 1)); [t[k], t[r]] = [t[r], t[k]]; } return t; }

/**
 * Rythme estimé pendant le choix des rotations (villes pas encore placées) : les jonctions à 3 ports ou plus jouent le rôle
 * des villes.
 */
function rythmeEstime(doc, F) {
  const ports = portsParJonction(doc, F), jetons = [];
  ports.forEach((n, k) => { if (n >= GR.PORTS_VILLE_MIN) { const [i, j] = k.split(',').map(Number); jetons.push({ i, j, type: 'capture' }); } });
  const g = GR.construire(doc, { jetons });
  return Object.assign(rythme(doc, g), { graphe: g });
}

/** Placements de villes à essayer : 4×4 toutes les combinaisons de 7 jonctions sur 9 ; 5×5 les placements 2-3-2. */
function placements(F) {
  const js = [];
  for (let j = 1; j < F.GRILLE.lignes; j++) for (let i = 1; i < F.GRILLE.colonnes; i++) js.push({ i, j });
  function combis(t, k) {
    if (k === 0) return [[]];
    if (t.length < k) return [];
    const [x, ...rest] = t;
    return combis(rest, k - 1).map((c) => [x].concat(c)).concat(combis(rest, k));
  }
  if (F.id === '4x4') return combis(js, 7);
  const r1 = js.filter((p) => p.j === 1), r23 = js.filter((p) => p.j === 2 || p.j === 3), r4 = js.filter((p) => p.j === 4);
  const res = [];
  combis(r1, 2).forEach((a) => combis(r23, 3).forEach((b) => combis(r4, 2).forEach((c) => res.push(a.concat(b, c)))));
  return res;
}

/** Plus petit écart (en pas) entre deux villes, villes non traversables (parcours depuis chaque ville). */
function ecartMinVilles(g) {
  let mini = Infinity;
  const villes = g.jonctions.filter((x) => x.type === 'ville');
  villes.forEach((v) => {
    const d = GR.distances(g, v.id);
    villes.forEach((w) => { if (w.id !== v.id && d.has(w.id)) mini = Math.min(mini, d.get(w.id)); });
  });
  return mini;
}

/**
 * Meilleur placement des villes d'un document : 7 villes sur des jonctions à 3 ports au moins, sans villes trop proches, non
 * très déséquilibré ; note = rythme strict, puis S. Renvoie aussi, sur les placements admissibles (ports et écart), la médiane
 * de S et la part des placements « 5 contre 2 » (mesure du plateau, indépendante du choix).
 */
function placerVilles(doc, F) {
  const ports = portsParJonction(doc, F);
  let meilleur = null, admissibles = 0, cinq = 0;
  const tousS = [], base = GR.construire(doc, { jetons: [] });
  for (const pl of placements(F)) {
    if (pl.some((p) => ports.get(p.i + ',' + p.j) < GR.PORTS_VILLE_MIN)) continue;
    const jetons = pl.map((p) => ({ i: p.i, j: p.j, type: 'capture' }));
    const g = grapheAvecVilles(base, jetons);
    if (GR.villesProches(g).length) continue;
    const e = GR.equilibre(doc, { graphe: g });
    admissibles++;
    if (e.cinqContreDeux) cinq++;
    if (e.S !== null) tousS.push(e.S);
    if (e.tresDesequilibre || e.S === null) continue;
    const ry = rythme(doc, g);
    const note = ry.chaineMax * 40 + ry.distMax * 15 + e.S * 10 + (e.premiereEgale ? 0 : 4);
    if (!meilleur || note < meilleur.note) meilleur = { note, jetons, e, ry };
  }
  if (meilleur) {
    tousS.sort((a, b) => a - b);
    meilleur.sMedian = tousS[Math.floor(tousS.length / 2)];
    meilleur.nbAdmissibles = admissibles;
    meilleur.partCinqContreDeux = admissibles ? cinq / admissibles : null;
  }
  return meilleur;
}

/* ------------------------------------------------------------------ */
/* Mesures d'un plateau                                                */
/* ------------------------------------------------------------------ */

/**
 * Réseaux de passages entre tuiles (même règle que relierPassages de src/graphe.js) : cases rattachées à chaque composante,
 * apparitions rattachées, et pour chaque réseau s'il ÉCONOMISE un pas (il contient un passage sans case à ses deux bouts :
 * raccord–raccord, raccord–pivot ou case–pivot, c'est-à-dire un trajet qui demanderait une case de plus avec des chemins).
 * Renvoie { tailles, apparitions, groupes: [Set], economes: [Set] }.
 */
function reseauxPlateau(doc) {
  const parent = new Map();
  const racine = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const emp = (t, c, p) => 'R ' + t.col + ',' + t.lig + ',' + c + ',' + p;
  const enFace = (t, c, p) => { const d = G.coteVoisin(c), f = G.raccordEnFace(c, p); return emp({ col: t.col + d.dc, lig: t.lig + d.dl }, f.cote, f.pos); };
  const elems = doc.plateau.tuiles.map((t) => ({ t, e: M.tuileEnPlateau(doc, t) })).filter((x) => x.e);
  const attaches = [], emplacements = [], types = new Map(), econ = [];
  elems.forEach((x) => x.e.cases.forEach((c) => types.set(c.id, c.type)));
  elems.forEach((x) => (x.e.passages || []).forEach((p) => {
    const ref = (e) => {
      if (e.pivot !== undefined) return { cle: 'P ' + e.pivot, pivot: true };
      if (e.raccord) { const k = emp(x.t, e.raccord.cote, e.raccord.pos); emplacements.push({ k, t: x.t, c: e.raccord.cote, p: e.raccord.pos }); return { cle: k }; }
      return { caseId: e['case'] };
    };
    const a = ref(p.a), b = ref(p.b);
    if (a.cle && b.cle) { parent.set(racine(a.cle), racine(b.cle)); econ.push(a.cle); }
    else if (a.cle) { attaches.push({ caseId: b.caseId, cle: a.cle }); if (a.pivot) econ.push(a.cle); }
    else if (b.cle) { attaches.push({ caseId: a.caseId, cle: b.cle }); if (b.pivot) econ.push(b.cle); }
  }));
  emplacements.forEach((s) => racine(s.k));
  emplacements.forEach((s) => { const f = enFace(s.t, s.c, s.p); if (parent.has(f)) parent.set(racine(s.k), racine(f)); });
  elems.forEach((x) => x.e.raccords.forEach((r) => { const f = enFace(x.t, r.cote, r.pos); if (parent.has(f)) attaches.push({ caseId: r.caseId, cle: f }); }));
  const groupes = new Map(), econome = new Set(econ.map(racine));
  attaches.forEach((a) => { const r = racine(a.cle); if (!groupes.has(r)) groupes.set(r, new Set()); groupes.get(r).add(a.caseId); });
  const tailles = Array.from(groupes.values()).map((s) => s.size).sort((a, b) => b - a);
  let apparitions = 0;
  groupes.forEach((s) => s.forEach((id) => { if (types.get(id) === 'apparition') apparitions++; }));
  return { tailles, apparitions, groupes: Array.from(groupes.values()), economes: Array.from(groupes.entries()).filter(([r]) => econome.has(r)).map(([, s]) => s) };
}

/** Copie légère d'un graphe déjà construit (sans villes) avec les villes `jetons` : évite de reconstruire le graphe par placement. */
function grapheAvecVilles(base, jetons) {
  const ids = new Set(jetons.map((j) => 'J' + j.i + ',' + j.j));
  return Object.assign({}, base, {
    villes: ids,
    jonctions: base.jonctions.map((x) => Object.assign({}, x, { type: ids.has(x.id) ? 'ville' : 'case' }))
  });
}

/*
 * Rythme (docs/18 ; mesure STRICTE arbitrée en docs/44). Zones d'intérêt : les villes et les cases d'un réseau de passages
 * qui relie au moins 2 cases ET économise un pas (voir reseauxPlateau). Option { large: true } : ancienne mesure (tout réseau
 * de 2 cases ou plus), pour information.
 *  (a) distance de chaque case sans action à la zone d'intérêt la plus proche ;
 *  (b) chaîne : plus court chemin entre deux zones A et B qui ne passe par aucune autre zone et qu'aucun autre itinéraire ne
 *      raccourcit ; sa longueur est le nombre de cases sans action traversées. On garde la plus longue du plateau.
 */
function rythme(doc, g, options) {
  const zones = new Set(g.villes), rs = reseauxPlateau(doc);
  ((options && options.large) ? rs.groupes : rs.economes).forEach((grp) => { if (grp.size >= 2) grp.forEach((id) => { if (g.voisins.has(id)) zones.add(id); }); });
  const d = new Map(), file = [];
  zones.forEach((z) => { d.set(z, 0); file.push(z); });
  for (let q = 0; q < file.length; q++) {
    const x = file[q];
    if (q >= zones.size && g.villes.has(x)) continue;
    g.voisins.get(x).forEach((y) => { if (!d.has(y)) { d.set(y, d.get(x) + 1); file.push(y); } });
  }
  const repartition = {};
  let distMax = 0, injoignables = 0;
  g.noeuds.forEach((id) => {
    if (zones.has(id)) return;
    if (!d.has(id)) { injoignables++; return; }
    const v = d.get(id);
    repartition[v] = (repartition[v] || 0) + 1;
    distMax = Math.max(distMax, v);
  });
  let chaine = { longueur: 0, chemin: [] };
  zones.forEach((s) => {
    const dr = new Map([[s, 0]]), parent = new Map(), f = [s];
    for (let q = 0; q < f.length; q++) {
      const x = f[q];
      if (x !== s && zones.has(x)) continue;
      g.voisins.get(x).forEach((y) => { if (!dr.has(y)) { dr.set(y, dr.get(x) + 1); parent.set(y, x); f.push(y); } });
    }
    const dg = GR.distances(g, s);
    zones.forEach((t) => {
      if (t === s || !dr.has(t) || dg.get(t) !== dr.get(t)) return;
      const n = dr.get(t) - 1;
      if (n > chaine.longueur) {
        const chemin = [t];
        while (chemin[0] !== s) chemin.unshift(parent.get(chemin[0]));
        chaine = { longueur: n, chemin };
      }
    });
  });
  return { zones: zones.size, distMax, repartition, injoignables, chaineMax: chaine.longueur, chaine: chaine.chemin,
    casesPassage: Array.from(zones).filter((z) => !g.villes.has(z)),
    plusLoin: g.noeuds.filter((id) => !zones.has(id) && d.get(id) === distMax) };
}

/*
 * Équilibre des accès au centre entre les deux camps (définition proposée).
 *  - Partage du graphe en trois : camp vert (cases des tuiles vertes, jonctions de la moitié nord), camp rouge (symétrique),
 *    « milieu » : en 4×4 la rangée de jonctions j = 2 (frontière des camps) ; en 5×5 les cases de la rangée neutre et les
 *    jonctions j = 2 et 3 qui la bordent.
 *  - PORTES d'un camp : arêtes du graphe qui relient un nœud du camp à un nœud du milieu (port d'une case vers une jonction
 *    du milieu, raccord ou réseau de passages vers une case du milieu). Chaque porte est une entrée distincte vers le centre.
 *  - écart = portes vertes − portes rouges (0 = équilibre) ; les contacts directs vert–rouge (raccords entre les deux
 *    rangées du milieu en 4×4) servent les deux camps à la fois et sont donnés à part.
 *  - CHEMINS INDÉPENDANTS : nombre maximal de chemins sans case commune des apparitions du camp au milieu, dans le camp
 *    (villes traversables) : complète les portes quand un goulet interne les réduit.
 */
function accesCentre(doc, g, F, options) {
  const N = F.GRILLE.lignes, demi = Math.floor(N / 2);
  const zone = (id) => {
    const m = /^J(\d+),(\d+)$/.exec(id);
    if (m) { const j = +m[2]; return j < demi ? 'vert' : j > N - demi ? 'rouge' : 'milieu'; }
    const c = /^(\d+),(\d+):/.exec(id);
    return F.campCellule(+c[1], +c[2]) || 'milieu';
  };
  const z = new Map(g.noeuds.map((id) => [id, zone(id)]));
  const portes = { vert: 0, rouge: 0 };
  let contacts = 0;
  g.noeuds.forEach((a) => g.voisins.get(a).forEach((b) => {
    if (a >= b) return;
    const za = z.get(a), zb = z.get(b);
    if (za === zb) return;
    if (za === 'milieu' || zb === 'milieu') portes[za === 'milieu' ? zb : za]++;
    else contacts++;
  }));
  const chemins = {};
  if (options && options.sansFlot) return { portes, ecart: portes.vert - portes.rouge, contacts };
  [['vert', 1], ['rouge', 2]].forEach(([camp, joueur]) => {
    chemins[camp] = flotVersMilieu(g, g.apparitions[joueur] || [], (id) => z.get(id) === camp, (id) => z.get(id) === 'milieu');
  });
  return { portes, ecart: portes.vert - portes.rouge, contacts, chemins, ecartChemins: chemins.vert - chemins.rouge };
}

/** Flot maximal (sommets de capacité 1, sources illimitées) des sources vers l'ensemble `cible`, dans les nœuds `dans` ∪ cible. */
function flotVersMilieu(g, sources, dans, cible) {
  const ids = g.noeuds.filter((id) => dans(id) || cible(id)), index = new Map(ids.map((id, n) => [id, n]));
  const N = ids.length, S = 2 * N, T = 2 * N + 1, tete = new Array(2 * N + 2).fill(-1), suiv = [], vers = [], cap = [];
  const aj = (a, b, c) => { vers.push(b); cap.push(c); suiv.push(tete[a]); tete[a] = vers.length - 1; vers.push(a); cap.push(0); suiv.push(tete[b]); tete[b] = vers.length - 1; };
  const INF = 1e6, src = new Set(sources);
  ids.forEach((id, n) => {
    aj(2 * n, 2 * n + 1, src.has(id) ? INF : 1);
    if (cible(id)) { aj(2 * n + 1, T, 1); return; } // une entrée du milieu compte une fois ; on ne le traverse pas
    g.voisins.get(id).forEach((w) => { if (index.has(w)) aj(2 * n + 1, 2 * index.get(w), 1); });
  });
  sources.forEach((s) => { if (index.has(s)) aj(S, 2 * index.get(s), INF); });
  let flot = 0;
  for (;;) {
    const pere = new Array(2 * N + 2).fill(-1), vu = new Array(2 * N + 2).fill(false), file = [S];
    vu[S] = true;
    for (let q = 0; q < file.length && !vu[T]; q++) for (let e = tete[file[q]]; e !== -1; e = suiv[e]) if (cap[e] > 0 && !vu[vers[e]]) { vu[vers[e]] = true; pere[vers[e]] = e; file.push(vers[e]); }
    if (!vu[T]) break;
    for (let v = T; v !== S; v = vers[pere[v] ^ 1]) { cap[pere[v]]--; cap[pere[v] ^ 1]++; }
    flot++;
  }
  return flot;
}

/** Mesures d'un plateau complet (villes posées). */
function mesurerPlateau(doc, F) {
  const g = GR.construire(doc), e = GR.equilibre(doc, { graphe: g });
  const casesTuiles = doc.plateau.tuiles.reduce((s, t) => s + (M.modeleParId(doc, t.modeleId).cases || []).length, 0);
  const jonctionsCases = g.jonctions.filter((x) => x.type === 'case').length;
  const ports = portsParJonction(doc, F);
  const villesPorts = doc.plateau.jetons.map((j) => ports.get(j.i + ',' + j.j));
  let contact = Infinity;
  const d1 = GR.distancesJoueur(g, 1);
  g.apparitions[2].forEach((id) => { if (d1.has(id)) contact = Math.min(contact, d1.get(id)); });
  const compte = {};
  doc.plateau.tuiles.forEach((t) => { compte[t.modeleId] = (compte[t.modeleId] || 0) + 1; });
  const res = reseauxPlateau(doc);
  return {
    tuiles: compte,
    cases: casesTuiles + jonctionsCases, casesTuiles, jonctionsCases,
    ports: Object.fromEntries(ports), portsMin: Math.min(...ports.values()), portsTotal: Array.from(ports.values()).reduce((s, x) => s + x, 0),
    villes: doc.plateau.jetons.map((j) => '(' + j.i + ',' + j.j + ')'), villesPorts, villesA3: villesPorts.filter((x) => x >= 3).length,
    ecartMinVilles: ecartMinVilles(g), villesProches: GR.villesProches(g).length,
    S: e.S, ecartMax7: e.ecartMax7, partage: e.partage, cinqContreDeux: e.cinqContreDeux, tempo: e.tempo, premiereVille: e.premiereVille,
    D: e.D, blocages: e.blocages.map((b) => b.code), alertes: e.alertes.map((a) => a.code),
    connexe: GR.connexe(g), raccordsMorts: M.raccordsMorts(doc).length,
    erreursPlateau: (M.validerPlateau(doc).erreurs || []).map((x) => x.code),
    reseauxPassages: res.tailles, reseauxEconomes: res.economes.map((s) => s.size), apparitionsDansReseaux: res.apparitions, contactVertRouge: contact,
    rythme: rythme(doc, g), rythmeLarge: (({ chaineMax, distMax }) => ({ chaineMax, distMax }))(rythme(doc, g, { large: true })),
    acces: accesCentre(doc, g, F)
  };
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

const ENTETE = '<?xml version="1.0" encoding="UTF-8"?>\n';
const POLICE = 'font-family="Helvetica, Arial, sans-serif"';

function svgPlanche(grille, modeles, titre) {
  const F = G.format(grille), C = F.COTE, colonnes = 4, marge = 12, larg = C + 2 * marge, haut = C + 44;
  const lignes = Math.ceil(modeles.length / colonnes), W = colonnes * larg, H = lignes * haut + 30;
  const s = [ENTETE + '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">',
    '<rect width="' + W + '" height="' + H + '" fill="#F4F4EF"/>',
    '<text x="' + marge + '" y="16" ' + POLICE + ' font-size="8" font-weight="bold">' + esc(titre) + '</text>'];
  modeles.forEach((m, k) => {
    const x = (k % colonnes) * larg + marge, y = Math.floor(k / colonnes) * haut + 26, f = ficheModele(m, grille);
    s.push('<g transform="translate(' + x + ',' + y + ')">' + R.contenuTuile(m, { format: F }) + '</g>');
    const ty = y + C + 7;
    s.push('<text x="' + x + '" y="' + ty + '" ' + POLICE + ' font-size="5.4" font-weight="bold">' + esc(m.id + ' · ' + m.nom) + '</text>');
    s.push('<text x="' + x + '" y="' + (ty + 6.5) + '" ' + POLICE + ' font-size="4.2">' +
      esc(f.cases + ' cases · ' + f.ports + ' coin' + (f.ports > 1 ? 's' : '') + ' (' + (f.coins.join(', ') || 'aucun') + ') · ' + f.passages + ' passage' + (f.passages > 1 ? 's' : '') + ' · ×' + f.exemplaires) + '</text>');
    s.push('<text x="' + x + '" y="' + (ty + 12.5) + '" ' + POLICE + ' font-size="4" fill="#555">' + esc(f.famille + (f.symetrique ? ' · symétrique (demi-tour)' : '') + (f.alertes.length ? ' · alertes : ' + f.alertes.join(', ') : '')) + '</text>');
    if (f.repere) {
      const w = 4 + f.repere.length * 2.6;
      s.push('<rect x="' + (x + C - w) + '" y="' + (y - 7) + '" width="' + w + '" height="7" rx="1.5" fill="#B0005A"/>');
      s.push('<text x="' + (x + C - w / 2) + '" y="' + (y - 2) + '" text-anchor="middle" ' + POLICE + ' font-size="4.6" font-weight="bold" fill="#FFFFFF">' + esc(f.repere) + '</text>');
    }
  });
  s.push('</svg>');
  return s.join('\n');
}

function svgPlateau(doc, F, titre, lignesTexte, ry, symetrique) {
  const C = F.COTE, NC = F.GRILLE.colonnes, NL = F.GRILLE.lignes, marge = 14, hautTexte = 12 + 6.5 * lignesTexte.length;
  const W = NC * C + 2 * marge, H = NL * C + 2 * marge + hautTexte + 10;
  const s = [ENTETE + '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">',
    '<rect width="' + W + '" height="' + H + '" fill="#F4F4EF"/>',
    '<text x="' + marge + '" y="10" ' + POLICE + ' font-size="7" font-weight="bold">' + esc(titre) + '</text>'];
  const oy = marge + 4;
  doc.plateau.tuiles.forEach((t) => {
    const m = M.modeleParId(doc, t.modeleId), camp = F.campCellule(t.col, t.lig) || 'neutre';
    s.push('<g transform="translate(' + (marge + t.col * C) + ',' + (oy + t.lig * C) + ')">' + R.contenuTuile(m, { rot: t.rot, format: F, camp }) + '</g>');
  });
  doc.plateau.tuiles.forEach((t) => {
    s.push('<text x="' + (marge + t.col * C + 22) + '" y="' + (oy + t.lig * C + 7) + '" ' + POLICE + ' font-size="4.5" fill="#888">' + esc(t.modeleId + (t.rot ? ' r' + t.rot : '')) + '</text>');
  });
  // frontière du milieu (rangée de jonctions en 4×4, rangée neutre en 5×5) : trait pointillé violet
  const yMil = NL % 2 ? [Math.floor(NL / 2), Math.ceil(NL / 2)] : [NL / 2];
  yMil.forEach((j) => s.push('<line x1="' + marge + '" y1="' + (oy + j * C) + '" x2="' + (marge + NC * C) + '" y2="' + (oy + j * C) + '" stroke="#7A3FB0" stroke-width="0.8" stroke-dasharray="4 3"/>'));
  if (symetrique) s.push('<text x="' + (marge + NC * C / 2) + '" y="' + (oy + NL * C / 2 + 2) + '" text-anchor="middle" ' + POLICE + ' font-size="6" fill="#7A3FB0">⟲ 180°</text>');
  const ports = portsParJonction(doc, F);
  for (let j = 1; j < NL; j++) {
    for (let i = 1; i < NC; i++) {
      const x = marge + i * C, y = oy + j * C, ville = doc.plateau.jetons.some((v) => v.i === i && v.j === j);
      if (ville) s.push(R.contenuJeton('capture', x, y, F));
      s.push('<text x="' + (x + 11) + '" y="' + (y - 11) + '" ' + POLICE + ' font-size="5" font-weight="bold" fill="#1F4E9E">' + ports.get(i + ',' + j) + 'p</text>');
    }
  }
  if (ry) {
    const pos = new Map();
    doc.plateau.tuiles.forEach((t) => M.tuileEnPlateau(doc, t).cases.forEach((c) => pos.set(c.id, c)));
    const ou = (id) => { const m = /^J(\d+),(\d+)$/.exec(id); return m ? { x: +m[1] * C, y: +m[2] * C } : pos.get(id); };
    ry.casesPassage.forEach((id) => { const p = ou(id); if (p) s.push('<circle cx="' + (marge + p.x) + '" cy="' + (oy + p.y) + '" r="2.6" fill="#1F6FD0"/>'); });
    ry.chaine.forEach((id, k) => {
      const p = ou(id), bout = k === 0 || k === ry.chaine.length - 1;
      if (p) s.push('<circle cx="' + (marge + p.x) + '" cy="' + (oy + p.y) + '" r="' + (bout ? 17 : 13) + '" fill="none" stroke="#F08A00" stroke-width="2.2"' + (bout ? ' stroke-dasharray="3 2"' : '') + '/>');
    });
  }
  const ty = oy + NL * C + 10;
  lignesTexte.forEach((l, k) => s.push('<text x="' + marge + '" y="' + (ty + k * 6.5) + '" ' + POLICE + ' font-size="4.6">' + esc(l) + '</text>'));
  s.push('</svg>');
  return s.join('\n');
}

/** Dimensions (mm) d'un SVG écrit par ce script. */
function tailleSvg(f) { const t = fs.readFileSync(f, 'utf8'), m = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(t); return { w: +m[1], h: +m[2] }; }

/** Convertit des SVG en PNG (dpi donné) : PyMuPDF, sinon Edge sans fenêtre. Renvoie true si la conversion a eu lieu. */
function enPng(fichiers, dpi) {
  const script = 'import sys, pymupdf\nfor f in sys.argv[2:]:\n    d = pymupdf.open(f)\n    d[0].get_pixmap(dpi=int(sys.argv[1])).save(f[:-4] + ".png")\n';
  for (const exe of ['python', 'py']) {
    const r = spawnSync(exe, ['-I', '-c', script, String(dpi)].concat(fichiers), { encoding: 'utf8' });
    if (r.status === 0) return true;
  }
  const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edge)) { console.error('Ni PyMuPDF ni Edge : seuls les SVG sont écrits.'); return false; }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'planche-'));
  let ok = true;
  fichiers.forEach((f, k) => {
    const t = tailleSvg(f), k2 = dpi / 25.4, w = Math.round(t.w * k2), h = Math.round(t.h * k2);
    const html = path.join(tmp, 'p' + k + '.html');
    fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden}img{display:block;width:' + w + 'px;height:' + h + 'px}</style></head><body><img src="' +
      'file:///' + path.resolve(f).replace(/\\/g, '/') + '"></body></html>');
    const png = f.slice(0, -4) + '.png';
    spawnSync(edge, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--user-data-dir=' + path.join(tmp, 'edge'), '--screenshot=' + png, '--window-size=' + w + ',' + h, '--virtual-time-budget=2000',
      'file:///' + html.replace(/\\/g, '/')], { encoding: 'utf8', timeout: 60000 });
    if (!fs.existsSync(png) || fs.statSync(png).mtimeMs < Date.now() - 60000) { ok = false; console.error('Capture Edge impossible pour ' + f); }
  });
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* dossier temporaire laissé */ }
  return ok;
}

/* ------------------------------------------------------------------ */
/* Programme : images                                                  */
/* ------------------------------------------------------------------ */

const TOUS = () => true;
const SCENARIOS = {
  '4x4': {
    A: { titre: 'pose libre, centrales orientées', options: {} },
    B: { titre: 'pose symétrique : moitié sud = moitié nord tournée de 180°', options: { symetrique: true } }
  },
  '5x5': {
    A: { titre: 'pose libre, centrales orientées', options: { portsCible: PORTS_CIBLE_5X5.libre } },
    // exemple symétrique : au moins une paire de centrales à 3 coins (sinon le tirage montre surtout P3 / P5)
    B: { titre: 'pose symétrique : moitié sud = moitié nord tournée de 180°', options: { symetrique: true, portsCible: PORTS_CIBLE_5X5.symetrique }, centrales3: 2 }
  }
};

function lignesPlateau(mes) {
  return [
    'Cases : ' + mes.cases + ' (tuiles ' + mes.casesTuiles + ' + ' + mes.jonctionsCases + ' jonctions-cases) · ports : ' + mes.portsTotal + ', minimum ' + mes.portsMin +
      ' par jonction · villes sur ' + mes.villesPorts.join('/') + ' ports (' + mes.villesA3 + ' villes à 3 accès ou plus)',
    'Écart minimal entre villes : ' + mes.ecartMinVilles + ' pas · S = ' + mes.S + ' (médiane ' + mes.sMedianPlacements + ' sur ' + mes.placementsAdmissibles + ' placements admissibles, dont ' +
      Math.round(100 * mes.partCinqContreDeux) + ' % « 5 contre 2 ») · partage vert ' + mes.partage[1] + ' / rouge ' + mes.partage[2] + ' / égalité ' + mes.partage.egalite,
    'Accès au centre (trait violet = milieu) : portes vert ' + mes.acces.portes.vert + ' / rouge ' + mes.acces.portes.rouge + ' (écart ' + (mes.acces.ecart > 0 ? '+' : '') + mes.acces.ecart +
      ') · chemins indépendants vert ' + mes.acces.chemins.vert + ' / rouge ' + mes.acces.chemins.rouge + ' · contacts directs vert-rouge ' + mes.acces.contacts,
    'Distances aux villes : vert ' + mes.D[1].join(' ') + ' · rouge ' + mes.D[2].join(' ') + ' · réseaux de passages ' + (mes.reseauxPassages.join(', ') || 'aucun') + ' (dont économes : ' + (mes.reseauxEconomes.join(', ') || 'aucun') + ')',
    'Rythme strict : plus longue chaîne sans zone d’intérêt = ' + mes.rythme.chaineMax + ' case(s) (anneaux orange) · distance max à une zone ' + mes.rythme.distMax +
      ' pas · ' + mes.rythme.zones + ' zones (mesure large : chaîne ' + mes.rythmeLarge.chaineMax + ')',
    'Zones d’intérêt : villes et cases reliées par un passage qui économise un pas (point bleu). « Np » : ports de la jonction. Passages = courbes vertes sans case.'
  ];
}

function principal() {
  fs.mkdirSync(SORTIE, { recursive: true });
  const rapport = { modeles: {}, modelesRevision44: {}, plateaux: {} }, svgs = [];
  for (const grille of ['4x4', '5x5']) {
    const F = G.format(grille), modeles = CO.modelesParGrille[grille];
    rapport.modeles[grille] = modeles.map((m) => ficheModele(m, grille));
    rapport.modelesRevision44[grille] = CO.revision44[grille].map((m) => ficheModele(m, grille));
    const fp = path.join(SORTIE, 'planche-' + grille + '.svg');
    fs.writeFileSync(fp, svgPlanche(grille, modeles, 'Catalogue candidat « organique » ' + grille.replace('x', '×') + ', révision « centrales ouvertes » : orientation canonique (non branché)'));
    svgs.push(fp);
    ['A', 'B'].forEach((nom, n) => {
      const sc = SCENARIOS[grille][nom];
      const candidats = [];
      for (let essai = 0; essai < (grille === '5x5' ? 60 : 80); essai++) {
        const alea = hasard(20261017 + 7919 * essai + 104729 * n + (grille === '5x5' ? 1 : 0));
        const doc = tirerPlateau(grille, modeles, TOUS, [], alea, sc.options);
        if (!doc) continue;
        const np = noteports(doc, F);
        if (np.min < 2 || !np.faisable) continue;
        const c3 = doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, F) === 'centrale' && ficheModele(M.modeleParId(doc, t.modeleId), grille).ports >= 3).length;
        if (sc.centrales3 && c3 < sc.centrales3) continue;
        candidats.push({ doc, np });
      }
      let meilleur = null;
      candidats.slice(0, 25).forEach((c) => {
        const pv = placerVilles(c.doc, F);
        if (!pv) return;
        const acc = accesCentre(c.doc, GR.construire(c.doc, { jetons: pv.jetons }), F);
        // préférence : accès équilibrés, peu de ports au total, et ports portés par les centrales plutôt que par des B1 (docs/18)
        const nbB1 = c.doc.plateau.tuiles.filter((t) => t.modeleId === 'B1').length;
        const note = pv.note + Math.abs(acc.ecart) * 5 + c.np.total + (grille === '5x5' ? nbB1 * 3 : 0);
        if (!meilleur || note < meilleur.note) meilleur = { note, doc: c.doc, pv };
      });
      if (!meilleur) { console.error('Aucun plateau ' + grille + ' ' + nom + ' valable.'); return; }
      const doc = meilleur.doc;
      doc.plateau.jetons = meilleur.pv.jetons;
      const mes = mesurerPlateau(doc, F);
      mes.sMedianPlacements = meilleur.pv.sMedian;
      mes.placementsAdmissibles = meilleur.pv.nbAdmissibles;
      mes.partCinqContreDeux = meilleur.pv.partCinqContreDeux;
      rapport.plateaux[grille + '-' + nom] = mes;
      const f = path.join(SORTIE, 'plateau-' + grille + '-' + nom + '.svg');
      fs.writeFileSync(f, svgPlateau(doc, F, 'Plateau ' + grille.replace('x', '×') + ' ' + nom + ' (' + sc.titre + ')', lignesPlateau(mes), mes.rythme, !!sc.options.symetrique));
      svgs.push(f);
      rapport.plateaux[grille + '-' + nom].document = doc.plateau;
    });
  }
  fs.writeFileSync(path.join(SORTIE, 'mesures.json'), JSON.stringify(rapport, null, 1));
  const ok = enPng(svgs, 110);
  console.log('Images écrites dans ' + SORTIE + (ok ? ' (SVG et PNG)' : ' (SVG seulement)'));
  return rapport;
}

/* ------------------------------------------------------------------ */
/* Programme : séries de N plateaux                                    */
/* ------------------------------------------------------------------ */

/** Mesures d'un plateau pour les séries (villes posées par placerVilles). */
function ligneSerie(doc, F, pv) {
  doc.plateau.jetons = pv.jetons;
  const g = GR.construire(doc), ry = rythme(doc, g), acc = accesCentre(doc, g, F), e = GR.equilibre(doc, { graphe: g });
  const ports = Array.from(portsParJonction(doc, F).values());
  const casesTuiles = doc.plateau.tuiles.reduce((t, x) => t + M.modeleParId(doc, x.modeleId).cases.length, 0);
  const villesPorts = pv.jetons.map((j) => M.portsJonction(doc, j.i, j.j).ports);
  return {
    cases: casesTuiles + g.jonctions.filter((x) => x.type === 'case').length, portsTotal: ports.reduce((a, b) => a + b, 0), portsMin: Math.min(...ports),
    villesA3: villesPorts.filter((x) => x >= 3).length, chaineMax: ry.chaineMax, distMax: ry.distMax, ecart: ecartMinVilles(g),
    S: e.S, sMedian: pv.sMedian, cinq: pv.partCinqContreDeux, admissibles: pv.nbAdmissibles, acces: acc.ecart, accesChemins: acc.ecartChemins, portesV: acc.portes.vert, portesR: acc.portes.rouge
  };
}

function resume(liste) {
  const moy = (t) => Math.round(t.reduce((a, b) => a + b, 0) / t.length * 100) / 100;
  const rep = (t) => { const r = {}; t.forEach((x) => { r[x] = (r[x] || 0) + 1; }); return r; };
  const pc = (n) => Math.round(n / liste.length * 100) + ' %';
  const col = (k) => liste.map((r) => r[k]);
  const ac = col('acces').map(Math.abs), acc = col('accesChemins').map(Math.abs);
  return {
    plateaux: liste.length,
    cases: { moyenne: moy(col('cases')), min: Math.min(...col('cases')), max: Math.max(...col('cases')), repartition: rep(col('cases')) },
    portsParJonction: moy(col('portsTotal').map((x) => x / (liste[0].nbJonctions || 1))), portsTotalMoyen: moy(col('portsTotal')), portsMinPire: Math.min(...col('portsMin')),
    villesA3: { moyenne: moy(col('villesA3')), toutes7: pc(col('villesA3').filter((x) => x >= 7).length) },
    chaine: { moyenne: moy(col('chaineMax')), pire: Math.max(...col('chaineMax')), repartition: rep(col('chaineMax')), partAuPlus3: pc(col('chaineMax').filter((x) => x <= 3).length) },
    distMax: { moyenne: moy(col('distMax')), pire: Math.max(...col('distMax')), repartition: rep(col('distMax')) },
    ecartVillesMin: Math.min(...col('ecart')),
    S: { moyenne: moy(col('S')), medianePlacements: moy(col('sMedian')) },
    placementsAdmissibles: { moyenne: moy(col('admissibles')), un: pc(col('admissibles').filter((x) => x === 1).length) },
    cinqContreDeuxPlacements: Math.round(moy(col('cinq').map((x) => x || 0)) * 1000) / 10 + ' %',
    accesPortes: { ecartAbsMoyen: moy(ac), pire: Math.max(...ac), partAuPlus1: pc(ac.filter((x) => x <= 1).length), repartitionEcart: rep(col('acces')),
      vertMoyen: moy(col('portesV')), rougeMoyen: moy(col('portesR')) },
    accesChemins: { ecartAbsMoyen: moy(acc), pire: Math.max(...acc), partAuPlus1: pc(acc.filter((x) => x <= 1).length) }
  };
}

/**
 * Séries : « actuel » (générateur et catalogue de src/), « révision 44 » (tirage orienté de docs/44, 5 B1 imposés en 5×5),
 * « centrales ouvertes » en pose libre orientée et en pose symétrique. Villes : meilleur placement admissible (placerVilles)
 * pour toutes les séries, y compris l'actuel (même méthode partout).
 */
function series(n) {
  require(path.join(RACINE, 'src/generateur.js'));
  const res = {}, t0 = Date.now();
  for (const grille of ['4x4', '5x5']) {
    const F = G.format(grille), nbJ = (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1);
    const sorte = [
      ['actuel (générateur)', null],
      ['révision 44, orientée', { modeles: CO.revision44[grille], filtre: (m) => !/mur|écarté/.test((CO.infos[grille][m.id] || {}).repere || ''), imposes: grille === '5x5' ? ['B1', 'B1', 'B1', 'B1', 'B1'] : [], options: { equilibrer: false } }],
      ['centrales ouvertes, libre orientée sans critère d’accès', { modeles: CO.modelesParGrille[grille], filtre: TOUS, imposes: [], options: grille === '5x5' ? { portsCible: PORTS_CIBLE_5X5.libre, equilibrer: false } : { equilibrer: false } }],
      ['centrales ouvertes, libre orientée', { modeles: CO.modelesParGrille[grille], filtre: TOUS, imposes: [], options: grille === '5x5' ? { portsCible: PORTS_CIBLE_5X5.libre } : {} }],
      ['centrales ouvertes, symétrique', { modeles: CO.modelesParGrille[grille], filtre: TOUS, imposes: [], options: grille === '5x5' ? { symetrique: true, portsCible: PORTS_CIBLE_5X5.symetrique } : { symetrique: true } }]
    ];
    for (const [nom, s] of sorte) {
      const liste = [];
      let essai = 0, rates = 0;
      while (liste.length < n && essai < n * 10) {
        let doc;
        if (!s) {
          const r = PM.generateur.generer(PM.catalogue.nouveauDocument(grille), { graine: 'rythme-' + grille + '-' + essai++, candidats: 20 });
          if (!r.ok) { rates++; continue; }
          doc = r.doc;
        } else {
          doc = tirerPlateau(grille, s.modeles, s.filtre, s.imposes, hasard(424242 + essai++), s.options);
          if (!doc || noteports(doc, F).min < 2) { rates++; continue; }
        }
        const pv = placerVilles(doc, F);
        if (!pv) { rates++; continue; }
        const l = ligneSerie(doc, F, pv);
        l.nbJonctions = nbJ;
        liste.push(l);
      }
      res[grille + ' ' + nom] = Object.assign(resume(liste), { tiragesRejetes: rates });
      console.error(grille, nom, liste.length, 'plateaux', Math.round((Date.now() - t0) / 1000) + ' s');
    }
  }
  fs.mkdirSync(SORTIE, { recursive: true });
  fs.writeFileSync(path.join(SORTIE, 'centrales-ouvertes-' + n + '.json'), JSON.stringify(res, null, 1));
  return res;
}

if (require.main === module && process.argv[2] === 'series') {
  console.log(JSON.stringify(series(Number(process.argv[3]) || 200), null, 1));
} else if (require.main === module) {
  const r = principal();
  for (const g of Object.keys(r.modeles)) r.modeles[g].forEach((f) => console.log(g, f.id, f.nom, '|', f.cases, 'cases', f.ports, 'ports', f.coins.join(','), '|', f.passages, 'pass. | ×' + f.exemplaires, '| sym:', f.symetrique, '| B:', f.blocages.join(',') || '0', '| A:', f.alertes.join(',') || '0', '| T:', f.trace.length));
  for (const k of Object.keys(r.plateaux)) { const p = Object.assign({}, r.plateaux[k]); delete p.document; console.log(k, JSON.stringify(p)); }
}

module.exports = { series, ficheModele, tirerPlateau, placerVilles, mesurerPlateau, reseauxPlateau, rythme, accesCentre, grapheAvecVilles, symetriqueDemiTour };
