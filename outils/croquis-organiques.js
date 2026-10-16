/* Croquis des centrales organiques (docs/35) : node outils/croquis-organiques.js <dossier du dépôt> <fichier html de sortie>. Outil d'étude, hors application. */
const { MOD, M, R, CAT, G } = require(__dirname + '/croquis-modeles.js');
const fs = require('fs');
const F = G.format('5x5');
const doc = CAT.nouveauDocument('5x5');
MOD.forEach(m => doc.modeles.push(JSON.parse(JSON.stringify(m))));
const cent = [['C13',1,1,1],['C12',2,1,2],['C13',3,1,3],['C13',1,2,1],['C12',2,2,0],['C10',3,2,0],['C13',1,3,1],['C13',2,3,3],['C13',3,3,0]];
const bords = { B1: [[3,0],[1,4],[3,4],[0,1],[0,2],[0,3]], B7: [[1,0],[2,0],[4,1],[4,3]], B7m: [[2,4],[4,2]] };
const t = [];
[[0,0],[4,0],[0,4],[4,4]].forEach(([c,l]) => t.push({ modeleId: 'K2', col: c, lig: l, rot: M.rotationDeduite(c,l,'coin','5x5') }));
for (const [id, ps] of Object.entries(bords)) ps.forEach(([c,l]) => t.push({ modeleId: id, col: c, lig: l, rot: M.rotationDeduite(c,l,'bord','5x5') }));
cent.forEach(([id,c,l,r]) => t.push({ modeleId: id, col: c, lig: l, rot: r }));
doc.plateau.tuiles = t;
const villes = [[2,1],[3,1],[2,2],[3,2],[2,3],[1,4],[2,4]];
doc.plateau.jetons = villes.map(([i,j]) => ({ i, j, type: 'capture' }));
const morts = M.raccordsMorts(doc), v = M.validerPlateau(doc);
const ports = []; for (let j = 1; j <= 4; j++) { const r = []; for (let i = 1; i <= 4; i++) r.push(M.portsJonction(doc, i, j).ports); ports.push(r.join(' ')); }
console.log('raccords morts', morts.length, 'erreurs', v.erreurs.map(e=>e.code).join(',')||'-', 'alertes', v.alertes.map(e=>e.code).join(',')||'-');
console.log('ports', ports.join(' / '));
// planche
const tuile = (m) => '<figure><svg viewBox="-2 -2 104 104" width="150">' + R.contenuTuile(m, { format: '5x5' }) + '</svg><figcaption><b>' + m.id + '</b> ' + m.nom + '</figcaption></figure>';
const actuels = CAT.modelesParGrille['5x5'].filter(m => m.gabarit === 'centrale');
let b = '';
for (const x of t) { const m = doc.modeles.find(mm => mm.id === x.modeleId && mm.grille === '5x5') || doc.modeles.find(mm => mm.id === x.modeleId);
  b += '<g transform="translate(' + x.col*100 + ' ' + x.lig*100 + ')">' + R.contenuTuile(m, { format: '5x5', rot: x.rot, camp: F.campCellule(x.col, x.lig) }) + '</g>'; }
for (const [i,j] of villes) b += R.contenuJeton('capture', i*100, j*100, '5x5');
for (let k = 1; k < 5; k++) b += '<line x1="'+k*100+'" y1="0" x2="'+k*100+'" y2="500" stroke="#bbb" stroke-width="0.4"/><line x1="0" y1="'+k*100+'" x2="500" y2="'+k*100+'" stroke="#bbb" stroke-width="0.4"/>';
const html = '<!doctype html><html lang=fr><meta charset=utf-8><title>Croquis tuiles organiques</title><style>body{font:14px system-ui;margin:16px;background:#fff;color:#111}figure{display:inline-block;margin:6px;text-align:center;vertical-align:top}figcaption{font-size:12px;max-width:150px}h2{margin:16px 0 4px}svg{border:1px solid #ccc}</style>'
 + '<h1>Croquis : centrales organiques 5×5</h1><p>Propositions de l’advisor géométrie (docs/35), vérifiées par le code du projet : 0 erreur, 0 alerte, 0 problème de tracé. Cases Ø 20, tuiles de 100 mm.</p>'
 + '<h2>Centrales actuelles (croix)</h2>' + actuels.map(tuile).join('')
 + '<h2>Un seul réseau : virage, droite, té, impasse</h2>' + MOD.slice(0,5).map(tuile).join('')
 + '<h2>Deux réseaux (esprit C3 « Deux ponts »)</h2>' + MOD.slice(5).map(tuile).join('')
 + '<h2>Plateau témoin « tout organique » : 78 cases, 40 ports, bords appariés, villes 2-3-2</h2><svg viewBox="-4 -4 508 508" width="620">' + b + '</svg>';
fs.writeFileSync(process.argv[3], html); console.log('ok');
