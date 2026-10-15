# Catalogue des tuiles (sous-agent catalogue, Opus 5.5), 2026-10-15

Livré : `src/catalogue.js` (`PM.catalogue = { version, modeles, nouveauDocument() }`, à charger **après** `modele.js`) et `tests/catalogue.test.js`. 18 modèles, 20 tuiles, tous valides.

| id | nom | rôle | N | E | S | O | Routage |
|---|---|---|---|---|---|---|---|
| C1 | Anneau | centrale | {1} | {1} | {1} | {1} | anneau des 4 cases |
| C2 | Fer à cheval | centrale | {1} | {1} | {1} | {0,1} | U ouvert à l'ouest |
| C3 | Zigzag | centrale | {1} | {1} | {1} | {1} | Z |
| C4 | Étoile | centrale | {1} | {1} | {1} | {1} | étoile autour de la case NO |
| C5 | Patte | centrale | {1} | {1} | {1} | {1} | triangle + queue |
| C6 | Losange | centrale | {1} | {1} | {1} | — | anneau + diagonale |
| K1 | Coude | coin | ext. | {1} | {1} | ext. | V |
| K2 | Raccourci | coin | ext. | {1} | {1} | ext. | triangle |
| K3 | Détour | coin | ext. | {1} | {1} | ext. | crochet |
| K4 | Double est | coin | ext. | {1,2} | {1} | ext. | E–S–port |
| K5 | Équerre | coin | ext. | {1} | {1} | ext. | symétrique de K3 |
| B1 | Bord en V | bord | ext. | {1} | {1} | {1} | V |
| B2 | Barre | bord | ext. | {1} | {1} | {1} | barre basse |
| B3 | Triangle | bord | ext. | {1} | {1} | {1} | triangle |
| B4 | Crochet | bord | ext. | {1} | {1} | {1} | crochet |
| B5 | Pont | bord | ext. | {1} | {1} | {0,1} | barre + case haute ouest |
| A1 ×2 | Fourche | apparition | ext. | {1} | {1} | {1} | apparition vers la centrale |
| A2 ×2 | Arc | apparition | ext. | {1} | {1} | {1} | apparition porte les 3 raccords |

## Simulation (1000 plateaux 4×4 aléatoires, graine 20261015)
- Connexité : 1000 / 1000 (même sans les jonctions) ; 4 ports par jonction ; écart min entre villes 3 pas ; 50 cases de déplacement.
- Raccords morts : moyenne 2,83, max 4 (0,8 % des plateaux à zéro). Chaque variante de position coûte ≈ 0,7 raccord mort par plateau (7 variantes → 4,75 en moyenne : ramené à 4 variantes).
- Équilibre D6 : pire écart 2, aucune alerte > 2. Alerte « 5 villes contre 2 » : 0 avec carrefours en (1,2)+(3,2) ; 44 / 1000 avec un carrefour par camp ((2,1)+(2,3)).
- Flancs jamais plus courts que le centre (+1,55 pas en moyenne). Apparitions : au moins 2 sorties ; A1 et A2 proches (≤ 0,4 par rang).

## Limites et recommandations
- Variété visuelle limitée : A1 / A2 même squelette, K3 / K5 symétriques, bords aux mêmes positions de cases. Profils de raccords peu variés (position milieu partout, 4 variantes).
- **Arbitrage variété / raccords morts à soumettre à l'advisor design de jeu.**
- Utilitaires de graphe dans `tests/catalogue.test.js` (`construireGraphe`, `distances`, `equilibre`, `mesureFlancs`) : à reprendre dans `src/graphe.js` (sous-agent 7). Contrôle de tracé `problemesTrace` : base de la règle « chevauchement chemin / case ».
- Tracé attendu des chemins : amorce perpendiculaire de 10 mm au raccord, puis coude.
