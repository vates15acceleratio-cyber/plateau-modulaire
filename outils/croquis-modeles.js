// Reconstruction des centrales organiques de l'avis géométrie (docs/35), pour croquis seulement.
const P = process.argv[2];
['geometrie','modele','catalogue','rendu'].forEach(n => require(P + '/src/' + n + '.js'));
const { modele: M, rendu: R, catalogue: CAT, geometrie: G } = globalThis.PM;
const AT = require(P + '/tests/aides-trace.js');
const COTES = { N: 0, E: 1, S: 2, O: 3 }, COINS = { NO: 0, NE: 1, SE: 2, SO: 3 };
// reseaux : [{ relais:[x,y], raccords:'NE', ports:{NO:[x,y],...} }]
function centrale(id, nom, reseaux) {
  const cases = [], chemins = []; let n = 0;
  reseaux.forEach((r, k) => {
    const rid = 'r' + k; cases.push({ id: rid, x: r.relais[0], y: r.relais[1], diametre: 20, type: 'deplacement' });
    for (const c of r.raccords) chemins.push({ id: 'k' + (n++), a: { case: rid }, b: { raccord: { cote: COTES[c], pos: 1 } } });
    for (const [coin, xy] of Object.entries(r.ports)) {
      const pid = 'p' + coin; cases.push({ id: pid, x: xy[0], y: xy[1], diametre: 20, type: 'deplacement' });
      chemins.push({ id: 'h' + (n++), a: { case: rid }, b: { case: pid } });
      chemins.push({ id: 'q' + (n++), a: { case: pid }, b: { coin: COINS[coin] } });
    }
  });
  return { id, nom, gabarit: 'centrale', grille: '5x5', exemplaires: 1, cases, chemins };
}
const MOD = [
  centrale('C10', 'Virage', [{ relais: [56,44], raccords: 'NE', ports: { NO: [24,42], SE: [58,76] } }]),
  centrale('C11', 'Virage à trois ports', [{ relais: [52,52], raccords: 'NE', ports: { NO: [22,41], SE: [64,77], SO: [30,76] } }]),
  centrale('C12', 'Droite', [{ relais: [50,49], raccords: 'NS', ports: { NO: [22,39], SE: [78,59] } }]),
  centrale('C13', 'Té', [{ relais: [50,44], raccords: 'ESO', ports: { NO: [35,21], NE: [65,21] } }]),
  centrale('C14', 'Impasse', [{ relais: [51,43], raccords: 'N', ports: { SE: [73,67], SO: [26,64] } }]),
  centrale('C15', 'Deux virages', [{ relais: [56,25], raccords: 'NE', ports: { NO: [26,32] } }, { relais: [43,75], raccords: 'SO', ports: { SE: [72,67] } }]),
  centrale('C16', 'Deux virages fermés', [{ relais: [62,48], raccords: 'NE', ports: { NE: [78,28] } }, { relais: [34,50], raccords: 'SO', ports: { SO: [20,71] } }]),
  centrale('C17', 'Deux impasses', [{ relais: [56,29], raccords: 'N', ports: { NO: [26,39] } }, { relais: [43,70], raccords: 'S', ports: { SE: [73,60] } }]),
  centrale('C18', 'Deux ponts', [{ relais: [50,34], raccords: 'NE', ports: { NO: [26,26], NE: [71,20] } }, { relais: [42,58], raccords: 'SO', ports: { SE: [73,69], SO: [23,74] } }]),
  centrale('C19', 'Pont et demi', [{ relais: [59,45], raccords: 'NE', ports: { NO: [21,32], NE: [76,26] } }, { relais: [39,76], raccords: 'SO', ports: { SE: [65,74] } }]),
];
module.exports = { MOD, M, R, CAT, G };
if (require.main === module) for (const m of MOD) {
  const v = M.validerModele(m, '5x5');
  console.log(m.id, 'err', v.erreurs.map(e => e.code).join(',') || '-', 'alertes', v.alertes.map(e => e.code).join(',') || '-', 'trace', AT.problemesTrace(m, '5x5').length);
}
