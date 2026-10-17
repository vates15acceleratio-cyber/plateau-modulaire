'use strict';
/*
 * planche-organique.js : images des catalogues CANDIDATS « organiques » (outils/catalogue-organique.js), avec le vrai rendu
 * de src/rendu.js. Rien n'est branché dans l'application.
 *
 * Lancer à la racine du projet : node outils/planche-organique.js [dossier de sortie]
 *   (défaut : docs/croquis/organique). Produit, pour chaque format (4x4, 5x5) :
 *   - planche-<format>.svg / .png : les modèles en orientation canonique (id, nom, cases, ports, exemplaires, repères) ;
 *   - plateau-<format>-A.svg / .png : plateau « strict » (sans les variantes en question) ;
 *   - plateau-<format>-B.svg / .png : plateau « avec variantes » (traversants, plusieurs passages) ;
 *   - mesures.json : contrôles des modèles et mesures des plateaux.
 * Conversion SVG -> PNG par PyMuPDF (python -c "import pymupdf") ; sans Python, seuls les SVG sont écrits.
 *
 * Plateaux : tirage maison à graine fixe dans le stock d'exemplaires (rôles respectés, rotation déduite pour les bords et
 * les coins, rotations des centrales cherchées pour nourrir les jonctions), puis recherche exhaustive des villes
 * (4×4 : 36 placements ; 5×5 : 2016 placements 2-3-2) ; on garde le meilleur plateau de plusieurs tirages.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
require(path.join(RACINE, 'src/catalogue.js'));
require(path.join(RACINE, 'src/graphe.js'));
require(path.join(RACINE, 'src/rendu.js'));
require(path.join(__dirname, 'catalogue-organique.js'));
const PM = globalThis.PM;
const G = PM.geometrie, M = PM.modele, GR = PM.graphe, R = PM.rendu, CO = PM.catalogueOrganique;

const SORTIE = path.resolve(process.argv[2] && process.argv[2] !== 'rythme' ? process.argv[2] : path.join(RACINE, 'docs/croquis/organique'));
const NOMS_COINS = ['NO', 'NE', 'SE', 'SO'];
const clone = (o) => JSON.parse(JSON.stringify(o));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ------------------------------------------------------------------ */
/* Contrôle des modèles                                                */
/* ------------------------------------------------------------------ */

/** Nombre de passages et de pivots, ports (coins) d'un modèle, validation. */
function ficheModele(m, grille) {
  const v = M.validerModele(m, grille), mm = M.masquesDuModele(m);
  const coins = [0, 1, 2, 3].filter((k) => (mm.portsCoin >> k) & 1);
  const info = (CO.infos[grille] || {})[m.id] || {};
  return {
    id: m.id, nom: m.nom, gabarit: m.gabarit, famille: info.famille || '', repere: info.repere || '',
    cases: (m.cases || []).length, ports: coins.length, coins: coins.map((k) => NOMS_COINS[k]),
    passages: (m.passages || []).length, pivots: (m.pivots || []).length, exemplaires: m.exemplaires,
    blocages: v.erreurs.map((e) => e.code), alertes: v.alertes.map((e) => e.code)
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

/** Note des ports : (minimum, nombre de jonctions à 3 ports ou plus). */
function noteports(doc, F) {
  const v = Array.from(portsParJonction(doc, F).values());
  return { min: Math.min(...v), a3: v.filter((x) => x >= 3).length, total: v.reduce((s, x) => s + x, 0) };
}

/**
 * Tire un plateau : stock = exemplaires des modèles autorisés (`filtre`), `imposes` = ids à poser d'abord sur les centrales.
 * Renvoie le document (tuiles posées, rotations des centrales optimisées), ou null si le stock ne suffit pas.
 */
function tirerPlateau(grille, modeles, filtre, imposes, alea) {
  const F = G.format(grille), doc = M.nouveauDocument(grille);
  doc.modeles = clone(modeles);
  const cel = cellules(F);
  for (const role of ['coin', 'bord', 'centrale']) {
    const stock = [];
    modeles.filter((m) => m.gabarit === role && m.exemplaires > 0 && filtre(m)).forEach((m) => { for (let k = 0; k < m.exemplaires; k++) stock.push(m.id); });
    const pris = [];
    (role === 'centrale' ? imposes.filter((id) => !/^B/.test(id)) : role === 'bord' ? imposes.filter((id) => /^B/.test(id)) : []).forEach((id) => { const k = stock.indexOf(id); if (k >= 0) { pris.push(id); stock.splice(k, 1); } });
    while (pris.length < cel[role].length && stock.length) pris.push(stock.splice(Math.floor(alea() * stock.length), 1)[0]);
    if (pris.length < cel[role].length) return null;
    // ordre de pose mélangé
    for (let k = pris.length - 1; k > 0; k--) { const r = Math.floor(alea() * (k + 1)); [pris[k], pris[r]] = [pris[r], pris[k]]; }
    cel[role].forEach((c, k) => {
      const rot = role === 'centrale' ? Math.floor(alea() * 4) : undefined;
      Object.assign(doc, M.poserTuile(doc, pris[k], c.col, c.lig, rot));
    });
  }
  // rotations des centrales : montée de colline (minimum de ports, puis rythme estimé, puis jonctions à 3 ports, puis variété)
  const centrales = doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, F) === 'centrale');
  const cle = () => {
    const n = noteports(doc, F), r = rythmeEstime(doc, F);
    return n.min * 1e6 - r.chaineMax * 1000 - r.distMax * 100 + n.a3;
  };
  if (centrales.length <= 4) {
    // 4×4 : les 4^4 = 256 combinaisons de rotations sont essayées
    let best = -Infinity, rots = centrales.map((t) => t.rot);
    for (let code = 0; code < Math.pow(4, centrales.length); code++) {
      centrales.forEach((t, k) => { t.rot = Math.floor(code / Math.pow(4, k)) % 4; });
      const n = cle();
      if (n > best || (n === best && alea() < 0.3)) { best = n; rots = centrales.map((t) => t.rot); }
    }
    centrales.forEach((t, k) => { t.rot = rots[k]; });
    return doc;
  }
  let meilleur = cle(), progres = true;
  while (progres) {
    progres = false;
    for (const t of centrales) {
      const r0 = t.rot;
      for (let r = 0; r < 4; r++) {
        if (r === r0) continue;
        t.rot = r;
        const n = cle();
        if (n > meilleur || (n === meilleur && alea() < 0.15)) { if (n > meilleur) progres = true; meilleur = n; break; }
        t.rot = r0;
      }
    }
  }
  return doc;
}

/**
 * Rythme estimé pendant le choix des rotations (les villes ne sont pas encore placées) : les jonctions à 3 ports ou plus
 * jouent le rôle des villes.
 */
function rythmeEstime(doc, F) {
  const ports = portsParJonction(doc, F), jetons = [];
  ports.forEach((n, k) => { if (n >= GR.PORTS_VILLE_MIN) { const [i, j] = k.split(',').map(Number); jetons.push({ i, j, type: 'capture' }); } });
  return rythme(doc, GR.construire(doc, { jetons }));
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
 * Meilleur placement des villes d'un document : 7 villes sur des jonctions à 3 ports au moins (placement admissible, comme le
 * générateur 5×5), sans villes trop proches, non très déséquilibré, S minimal. Renvoie aussi le S médian des placements admissibles.
 */
function placerVilles(doc, F) {
  const ports = portsParJonction(doc, F);
  let meilleur = null;
  const tousS = [], base = GR.construire(doc, { jetons: [] });
  for (const pl of placements(F)) {
    if (pl.some((p) => ports.get(p.i + ',' + p.j) < GR.PORTS_VILLE_MIN)) continue;
    const jetons = pl.map((p) => ({ i: p.i, j: p.j, type: 'capture' }));
    const g = grapheAvecVilles(base, jetons);
    if (GR.villesProches(g).length) continue;
    const e = GR.equilibre(doc, { graphe: g });
    if (e.S !== null) tousS.push(e.S);
    if (e.tresDesequilibre || e.S === null) continue;
    const sur3 = pl.filter((p) => ports.get(p.i + ',' + p.j) >= 3).length;
    const ry = rythme(doc, g);
    const note = ry.chaineMax * 40 + ry.distMax * 15 + e.S * 10 - sur3 * 3 + (e.premiereEgale ? 0 : 4);
    if (!meilleur || note < meilleur.note) meilleur = { note, jetons, e, sur3, ry };
  }
  if (meilleur) {
    tousS.sort((a, b) => a - b);
    meilleur.sMedian = tousS[Math.floor(tousS.length / 2)];
    meilleur.nbAdmissibles = tousS.length;
  }
  return meilleur;
}

/* ------------------------------------------------------------------ */
/* Mesures d'un plateau                                                */
/* ------------------------------------------------------------------ */

/**
 * Réseaux de passages entre tuiles (même règle que relierPassages de src/graphe.js) : nombre de cases rattachées à chaque
 * composante, apparitions rattachées. Renvoie { tailles: [n...], apparitions: n }.
 */
function reseauxPlateau(doc) {
  const parent = new Map();
  const racine = (x) => { if (!parent.has(x)) parent.set(x, x); while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
  const emp = (t, c, p) => 'R ' + t.col + ',' + t.lig + ',' + c + ',' + p;
  const enFace = (t, c, p) => { const d = G.coteVoisin(c), f = G.raccordEnFace(c, p); return emp({ col: t.col + d.dc, lig: t.lig + d.dl }, f.cote, f.pos); };
  const elems = doc.plateau.tuiles.map((t) => ({ t, e: M.tuileEnPlateau(doc, t) })).filter((x) => x.e);
  const attaches = [], emplacements = [], types = new Map();
  elems.forEach((x) => x.e.cases.forEach((c) => types.set(c.id, c.type)));
  elems.forEach((x) => (x.e.passages || []).forEach((p) => {
    const ref = (e) => {
      if (e.pivot !== undefined) return { cle: 'P ' + e.pivot };
      if (e.raccord) { const k = emp(x.t, e.raccord.cote, e.raccord.pos); emplacements.push({ k, t: x.t, c: e.raccord.cote, p: e.raccord.pos }); return { cle: k }; }
      return { caseId: e['case'] };
    };
    const a = ref(p.a), b = ref(p.b);
    if (a.cle && b.cle) parent.set(racine(a.cle), racine(b.cle));
    else if (a.cle) attaches.push({ caseId: b.caseId, cle: a.cle });
    else if (b.cle) attaches.push({ caseId: a.caseId, cle: b.cle });
  }));
  emplacements.forEach((s) => racine(s.k));
  emplacements.forEach((s) => { const f = enFace(s.t, s.c, s.p); if (parent.has(f)) parent.set(racine(s.k), racine(f)); });
  elems.forEach((x) => x.e.raccords.forEach((r) => { const f = enFace(x.t, r.cote, r.pos); if (parent.has(f)) attaches.push({ caseId: r.caseId, cle: f }); }));
  const groupes = new Map();
  attaches.forEach((a) => { const r = racine(a.cle); if (!groupes.has(r)) groupes.set(r, new Set()); groupes.get(r).add(a.caseId); });
  const tailles = Array.from(groupes.values()).map((s) => s.size).sort((a, b) => b - a);
  let apparitions = 0;
  groupes.forEach((s) => s.forEach((id) => { if (types.get(id) === 'apparition') apparitions++; }));
  return { tailles, apparitions, groupes: Array.from(groupes.values()) };
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
 * Rythme (demande de l'utilisateur, docs/18 « Réponses de l'utilisateur sur les catalogues organiques »).
 * Zones d'intérêt : les villes (jetons sur les jonctions) et les cases reliées par un passage (cases d'un réseau de passages
 * qui en relie au moins deux, voisines à 1 pas : le « raccourci »). Toutes les autres cases (cases de tuile, apparitions
 * comprises, et jonctions sans ville) sont des cases « sans action ».
 *  (a) distance de chaque case sans action à la zone d'intérêt la plus proche (parcours sur le graphe complet ; une ville
 *      n'est jamais traversée, mais c'est une zone, donc la question ne se pose pas) ;
 *  (b) chaîne : plus court chemin entre deux zones d'intérêt A et B qui ne passe par aucune autre zone d'intérêt ET qu'aucun
 *      autre itinéraire ne raccourcit (sa longueur égale la distance A-B sur le graphe complet) ; sa longueur est le nombre de
 *      cases sans action traversées entre A et B. On garde la plus longue chaîne du plateau.
 */
function rythme(doc, g) {
  const zones = new Set(g.villes);
  reseauxPlateau(doc).groupes.forEach((grp) => { if (grp.size >= 2) grp.forEach((id) => { if (g.voisins.has(id)) zones.add(id); }); });
  // (a) distance à la zone la plus proche
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
  // (b) plus longue chaîne entre deux zones voisines
  let chaine = { longueur: 0, chemin: [] };
  zones.forEach((s) => {
    const dr = new Map([[s, 0]]), parent = new Map(), f = [s];
    for (let q = 0; q < f.length; q++) {
      const x = f[q];
      if (x !== s && zones.has(x)) continue; // on s'arrête à la première zone rencontrée
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

/** Mesures d'un plateau complet (villes posées). */
function mesurerPlateau(doc, F) {
  const g = GR.construire(doc), e = GR.equilibre(doc, { graphe: g });
  const casesTuiles = doc.plateau.tuiles.reduce((s, t) => s + (M.modeleParId(doc, t.modeleId).cases || []).length, 0);
  const jonctionsCases = g.jonctions.filter((x) => x.type === 'case').length;
  const ports = portsParJonction(doc, F);
  const villesPorts = doc.plateau.jetons.map((j) => ports.get(j.i + ',' + j.j));
  // distance minimale entre une apparition verte et une rouge
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
    villes: doc.plateau.jetons.map((j) => '(' + j.i + ',' + j.j + ')'), villesPorts,
    ecartMinVilles: ecartMinVilles(g), villesProches: GR.villesProches(g).length,
    S: e.S, ecartMax7: e.ecartMax7, partage: e.partage, tempo: e.tempo, premiereVille: e.premiereVille,
    D: e.D, blocages: e.blocages.map((b) => b.code), alertes: e.alertes.map((a) => a.code),
    connexe: GR.connexe(g), raccordsMorts: M.raccordsMorts(doc).length,
    erreursPlateau: (M.validerPlateau(doc).erreurs || []).map((x) => x.code),
    reseauxPassages: res.tailles, apparitionsDansReseaux: res.apparitions, contactVertRouge: contact,
    rythme: rythme(doc, g)
  };
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

const ENTETE = '<?xml version="1.0" encoding="UTF-8"?>\n';
const POLICE = 'font-family="Helvetica, Arial, sans-serif"';

function svgPlanche(grille, modeles) {
  const F = G.format(grille), C = F.COTE, colonnes = 4, marge = 12, larg = C + 2 * marge, haut = C + 44;
  const visibles = modeles;
  const lignes = Math.ceil(visibles.length / colonnes), W = colonnes * larg, H = lignes * haut + 30;
  const s = [ENTETE + '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">',
    '<rect width="' + W + '" height="' + H + '" fill="#F4F4EF"/>',
    '<text x="' + marge + '" y="16" ' + POLICE + ' font-size="8" font-weight="bold">Catalogue candidat « organique » ' + grille.replace('x', '×') +
    ' : modèles en orientation canonique (proposition, non branchée)</text>'];
  visibles.forEach((m, k) => {
    const x = (k % colonnes) * larg + marge, y = Math.floor(k / colonnes) * haut + 26, f = ficheModele(m, grille);
    s.push('<g transform="translate(' + x + ',' + y + ')">' + R.contenuTuile(m, { format: F }) + '</g>');
    const ty = y + C + 7;
    s.push('<text x="' + x + '" y="' + ty + '" ' + POLICE + ' font-size="5.4" font-weight="bold">' + esc(m.id + ' · ' + m.nom) + '</text>');
    s.push('<text x="' + x + '" y="' + (ty + 6.5) + '" ' + POLICE + ' font-size="4.2">' +
      esc(f.cases + ' cases · ' + f.ports + ' ports (' + (f.coins.join(', ') || 'aucun') + ') · ' + f.passages + ' passage' + (f.passages > 1 ? 's' : '') + ' · ×' + f.exemplaires) + '</text>');
    s.push('<text x="' + x + '" y="' + (ty + 12.5) + '" ' + POLICE + ' font-size="4" fill="#555">' + esc(f.famille + (f.alertes.length ? ' · alertes : ' + f.alertes.join(', ') : '')) + '</text>');
    if (f.repere) {
      const w = 4 + f.repere.length * 2.6;
      s.push('<rect x="' + (x + C - w) + '" y="' + (y - 7) + '" width="' + w + '" height="7" rx="1.5" fill="#B0005A"/>');
      s.push('<text x="' + (x + C - w / 2) + '" y="' + (y - 2) + '" text-anchor="middle" ' + POLICE + ' font-size="4.6" font-weight="bold" fill="#FFFFFF">' + esc(f.repere) + '</text>');
    }
  });
  s.push('</svg>');
  return s.join('\n');
}

function svgPlateau(doc, F, titre, lignesTexte, ry) {
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
  // identifiants des modèles posés, par-dessus toutes les tuiles (sinon les quarts de jonction des voisines les cachent)
  doc.plateau.tuiles.forEach((t) => {
    s.push('<text x="' + (marge + t.col * C + 22) + '" y="' + (oy + t.lig * C + 7) + '" ' + POLICE + ' font-size="4.5" fill="#888">' + esc(t.modeleId + (t.rot ? ' r' + t.rot : '')) + '</text>');
  });
  const ports = portsParJonction(doc, F);
  for (let j = 1; j < NL; j++) {
    for (let i = 1; i < NC; i++) {
      const x = marge + i * C, y = oy + j * C, ville = doc.plateau.jetons.some((v) => v.i === i && v.j === j);
      if (ville) s.push(R.contenuJeton('capture', x, y, F));
      s.push('<text x="' + (x + 11) + '" y="' + (y - 11) + '" ' + POLICE + ' font-size="5" font-weight="bold" fill="#1F4E9E">' + ports.get(i + ',' + j) + 'p</text>');
    }
  }
  // repères du rythme : point bleu = case reliée par un passage (zone d'intérêt) ; anneaux orange = plus longue chaîne
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

/** Convertit des SVG en PNG avec PyMuPDF (dpi donné). Renvoie true si la conversion a eu lieu. */
function enPng(fichiers, dpi) {
  const script = 'import sys, pymupdf\nfor f in sys.argv[2:]:\n    d = pymupdf.open(f)\n    d[0].get_pixmap(dpi=int(sys.argv[1])).save(f[:-4] + ".png")\n';
  for (const exe of ['python', 'py']) {
    const r = spawnSync(exe, ['-I', '-c', script, String(dpi)].concat(fichiers), { encoding: 'utf8' });
    if (r.status === 0) return true;
    if (r.error && r.error.code === 'ENOENT') continue;
    console.error('Conversion PNG impossible :', r.stderr || r.error);
    return false;
  }
  console.error('Python introuvable : seuls les SVG sont écrits.');
  return false;
}

/* ------------------------------------------------------------------ */
/* Programme                                                           */
/* ------------------------------------------------------------------ */

/** Choix des plateaux A (strict) et B (avec variantes) par grille. */
const HORS = (m, info) => info.repere !== 'hors règles : mur' && info.repere !== 'écarté : 2 passages';
const SCENARIOS = {
  '4x4': {
    cible: 63,
    A: { titre: 'tirage 1', filtre: HORS, imposes: ['O9', 'O6', 'O11'] },
    B: { titre: 'tirage 2', filtre: HORS, imposes: ['O10', 'O7', 'B8'] }
  },
  '5x5': {
    cible: 76,
    A: { titre: 'tirage 1', filtre: HORS, imposes: ['P3', 'P5', 'B1', 'B1', 'B1', 'B1', 'B1'] },
    B: { titre: 'tirage 2', filtre: HORS, imposes: ['P6', 'P3', 'B1', 'B1', 'B1', 'B1', 'B1', 'B9'] }
  }
};

function principal() {
  fs.mkdirSync(SORTIE, { recursive: true });
  const rapport = { modeles: {}, plateaux: {} }, svgs = { planche: [], plateau: [] };
  for (const grille of ['4x4', '5x5']) {
    const F = G.format(grille), modeles = CO.modelesParGrille[grille], infos = CO.infos[grille];
    rapport.modeles[grille] = modeles.map((m) => ficheModele(m, grille));
    const fp = path.join(SORTIE, 'planche-' + grille + '.svg');
    fs.writeFileSync(fp, svgPlanche(grille, modeles));
    svgs.planche.push(fp);
    const sc = SCENARIOS[grille];
    ['A', 'B'].forEach((nom, n) => {
      const s = sc[nom], filtre = (m) => s.filtre(m, infos[m.id] || {});
      // 1) tirages : on garde ceux dont chaque jonction a 2 ports au moins, classés par jonctions à 3 ports et densité
      const candidats = [];
      for (let essai = 0; essai < 200; essai++) {
        const alea = hasard(20261017 + 7919 * essai + 104729 * n + (grille === '5x5' ? 1 : 0));
        const doc = tirerPlateau(grille, modeles, filtre, s.imposes, alea);
        if (!doc) continue;
        const np = noteports(doc, F);
        if (np.min < 2) continue;
        const casesTuiles = doc.plateau.tuiles.reduce((t, x) => t + M.modeleParId(doc, x.modeleId).cases.length, 0);
        const total = casesTuiles + (F.GRILLE.colonnes - 1) * (F.GRILLE.lignes - 1) - GR.NB_VILLES;
        candidats.push({ doc, np, total, pre: Math.max(0, total - sc.cible) * 4 - np.a3 * 2 });
      }
      candidats.sort((a, b) => a.pre - b.pre);
      // 2) villes cherchées sur les meilleurs tirages seulement (la recherche exhaustive est coûteuse en 5×5)
      let meilleur = null;
      candidats.slice(0, grille === '5x5' ? 20 : 40).forEach((c) => {
        const pv = placerVilles(c.doc, F);
        if (!pv) return;
        const note = pv.note + c.pre;
        if (!meilleur || note < meilleur.note) meilleur = { note, doc: c.doc, pv };
      });
      if (!meilleur) { console.error('Aucun plateau ' + grille + ' ' + nom + ' valable.'); return; }
      const doc = meilleur.doc;
      doc.plateau.jetons = meilleur.pv.jetons;
      const mes = mesurerPlateau(doc, F);
      mes.sMedianPlacements = meilleur.pv.sMedian;
      mes.placementsAdmissibles = meilleur.pv.nbAdmissibles;
      rapport.plateaux[grille + '-' + nom] = mes;
      const lignes = [
        'Cases : ' + mes.cases + ' (tuiles ' + mes.casesTuiles + ' + ' + mes.jonctionsCases + ' jonctions-cases ; repère des catalogues actuels ≈ ' + sc.cible + ')' +
          ' · ports : ' + mes.portsTotal + ', minimum ' + mes.portsMin + ' par jonction · villes sur ' + mes.villesPorts.join('/') + ' ports',
        'Écart minimal entre villes : ' + mes.ecartMinVilles + ' pas (' + (mes.ecartMinVilles - 1) + ' cases) · S = ' + mes.S + ' (meilleur placement ; médiane ' + mes.sMedianPlacements + ' sur ' + mes.placementsAdmissibles + ' placements admissibles)' + ' · écart max ' + mes.ecartMax7 +
          ' · partage vert ' + mes.partage[1] + ' / rouge ' + mes.partage[2] + ' / égalité ' + mes.partage.egalite,
        'Distances aux villes : vert ' + mes.D[1].join(' ') + ' · rouge ' + mes.D[2].join(' ') + ' · contact vert-rouge ' + mes.contactVertRouge + ' pas',
        'Réseaux de passages entre tuiles (cases voisines à 1 pas) : ' + (mes.reseauxPassages.join(', ') || 'aucun') + ' · connexe : ' + (mes.connexe ? 'oui' : 'non') +
          ' · raccords morts : ' + mes.raccordsMorts + (mes.alertes.length ? ' · alertes : ' + mes.alertes.join(', ') : ''),
        'Rythme : plus longue chaîne sans zone d’intérêt = ' + mes.rythme.chaineMax + ' case(s) (anneaux orange, bouts en tirets) · distance à la zone d’intérêt la plus proche : max ' + mes.rythme.distMax +
          ' pas, répartition ' + Object.keys(mes.rythme.repartition).map((k) => k + ' pas : ' + mes.rythme.repartition[k]).join(', ') + ' · ' + mes.rythme.zones + ' zones d’intérêt',
        'Zones d’intérêt : villes et cases reliées par un passage (point bleu). « Np » : ports de la jonction. Passages = courbes vertes sans case (rendu réel de src/rendu.js).'
      ];
      const f = path.join(SORTIE, 'plateau-' + grille + '-' + nom + '.svg');
      fs.writeFileSync(f, svgPlateau(doc, F, 'Plateau ' + grille.replace('x', '×') + ' ' + nom + ' (' + s.titre + ')', lignes, mes.rythme));
      svgs.plateau.push(f);
      rapport.plateaux[grille + '-' + nom].document = doc.plateau;
    });
  }
  fs.writeFileSync(path.join(SORTIE, 'mesures.json'), JSON.stringify(rapport, null, 1));
  const okA = enPng(svgs.planche, 110), okB = enPng(svgs.plateau, 110);
  console.log('Images écrites dans ' + SORTIE + (okA && okB ? ' (SVG et PNG)' : ' (SVG seulement)'));
  return rapport;
}

/*
 * Statistiques de rythme sur N plateaux (node outils/planche-organique.js rythme [N]) :
 *  - « maison orienté » : tirage maison (rotations des centrales choisies pour les ports puis le rythme), villes admissibles ;
 *  - « maison au hasard » : même stock, rotations des centrales au hasard (seule contrainte : 2 ports par jonction), villes admissibles ;
 *  - « actuel » : plateaux de PM.generateur sur les catalogues actuels de src/catalogue.js (20 candidats par graine).
 * Écrit docs/croquis/organique/rythme-200.json et affiche moyenne, pire cas et répartition de la plus longue chaîne.
 */
function resume(liste) {
  const ch = liste.map((r) => r.chaineMax), dm = liste.map((r) => r.distMax), cs = liste.map((r) => r.cases);
  const moy = (t) => Math.round(t.reduce((a, b) => a + b, 0) / t.length * 100) / 100;
  const rep = {}, repD = {};
  ch.forEach((x) => { rep[x] = (rep[x] || 0) + 1; });
  dm.forEach((x) => { repD[x] = (repD[x] || 0) + 1; });
  return { plateaux: liste.length, chaineMoyenne: moy(ch), chainePire: Math.max(...ch), repartitionChaine: rep,
    distMaxMoyenne: moy(dm), distMaxPire: Math.max(...dm), repartitionDistMax: repD, partChaine3: Math.round(ch.filter((x) => x <= 3).length / ch.length * 100) + ' %', casesMoyenne: moy(cs), ecartVillesMin: Math.min(...liste.map((r) => r.ecart)) };
}
function statsRythme(n) {
  require(path.join(RACINE, 'src/generateur.js'));
  const res = {};
  for (const grille of ['4x4', '5x5']) {
    const F = G.format(grille), modeles = CO.modelesParGrille[grille], filtre = (m) => (CO.infos[grille][m.id] || {}).repere !== 'hors règles : mur';
    const imposes = grille === '5x5' ? ['B1', 'B1', 'B1', 'B1', 'B1'] : [];
    for (const mode of ['oriente', 'hasard']) {
      const liste = [];
      let essai = 0, rates = 0;
      while (liste.length < n && essai < n * 20) {
        const alea = hasard(424242 + essai++ + (mode === 'hasard' ? 1e6 : 0));
        let doc;
        if (mode === 'oriente') doc = tirerPlateau(grille, modeles, filtre, imposes, alea);
        else { doc = tirerPlateauHasard(grille, modeles, filtre, imposes, alea); }
        if (!doc || noteports(doc, F).min < 2) { rates++; continue; }
        const pv = placerVilles(doc, F);
        if (!pv) { rates++; continue; }
        doc.plateau.jetons = pv.jetons;
        const g = GR.construire(doc), ry = rythme(doc, g);
        const cases = doc.plateau.tuiles.reduce((t, x) => t + M.modeleParId(doc, x.modeleId).cases.length, 0) + g.jonctions.filter((x) => x.type === 'case').length;
        liste.push({ chaineMax: ry.chaineMax, distMax: ry.distMax, cases, ecart: ecartMinVilles(g) });
      }
      res[grille + ' maison ' + mode] = Object.assign(resume(liste), { tiragesRejetes: rates });
    }
    const liste = [];
    for (let k = 0; liste.length < n && k < n * 3; k++) {
      const r = PM.generateur.generer(PM.catalogue.nouveauDocument(grille), { graine: 'rythme-' + grille + '-' + k, candidats: 20 });
      if (!r.ok) continue;
      const g = GR.construire(r.doc), ry = rythme(r.doc, g);
      const cases = r.doc.plateau.tuiles.reduce((t, x) => t + M.modeleParId(r.doc, x.modeleId).cases.length, 0) + g.jonctions.filter((x) => x.type === 'case').length;
      liste.push({ chaineMax: ry.chaineMax, distMax: ry.distMax, cases, ecart: ecartMinVilles(g) });
    }
    res[grille + ' actuel (générateur)'] = resume(liste);
  }
  fs.mkdirSync(SORTIE, { recursive: true });
  fs.writeFileSync(path.join(SORTIE, 'rythme-' + n + '.json'), JSON.stringify(res, null, 1));
  return res;
}

/** Tirage maison sans orientation choisie : rotations des centrales au hasard jusqu'à 2 ports par jonction (200 essais). */
function tirerPlateauHasard(grille, modeles, filtre, imposes, alea) {
  const F = G.format(grille), doc = tirerPlateau(grille, modeles, filtre, imposes, alea);
  if (!doc) return null;
  const centrales = doc.plateau.tuiles.filter((t) => M.gabaritCellule(t.col, t.lig, F) === 'centrale');
  for (let k = 0; k < 200; k++) {
    centrales.forEach((t) => { t.rot = Math.floor(alea() * 4); });
    if (noteports(doc, F).min >= 2) return doc;
  }
  return null;
}

if (require.main === module && process.argv[2] === 'rythme') {
  console.log(JSON.stringify(statsRythme(Number(process.argv[3]) || 200), null, 1));
} else if (require.main === module) {
  const r = principal();
  for (const g of Object.keys(r.modeles)) r.modeles[g].forEach((f) => console.log(g, f.id, f.nom, '|', f.cases, 'cases', f.ports, 'ports', f.coins.join(','), '| ×' + f.exemplaires, '| B:', f.blocages.join(',') || '0', '| A:', f.alertes.join(',') || '0'));
  for (const k of Object.keys(r.plateaux)) { const p = Object.assign({}, r.plateaux[k]); delete p.document; console.log(k, JSON.stringify(p)); }
}

module.exports = { statsRythme, ficheModele, tirerPlateau, placerVilles, mesurerPlateau, reseauxPlateau, rythme, grapheAvecVilles };
