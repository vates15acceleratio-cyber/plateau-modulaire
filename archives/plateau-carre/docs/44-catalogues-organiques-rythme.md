# Catalogues organiques, révision « rythme » (sous-agent dev-web), 2026-10-17

Statut : **proposition non branchée**. Elle suit les réponses de l'utilisateur consignées en fin de `18`. Fichiers : `outils/catalogue-organique.js`, `outils/planche-organique.js`, `docs/croquis/organique/` (planches, plateaux A et B, `mesures.json`, `rythme-200.json`).

## Modèles
- **4×4, 21 tuiles.**
  - Centrales : O9 Virage et pont ×2, O10 Équerre à virage ×1, O11 Virage et deux ponts ×2, O6 Demi-tour ×1, O7 Boucle ×1. Chacune a un seul passage.
  - Bords : B1 ×8, B8 Bord à virage ×1.
  - Coins : K2 ×4, K4 ×1.
  - Retirés : O2, O3, O4, O5 (décision de l'utilisateur) ; O1, O8 et B6, parce qu'ils faisaient des chaînes de 4.
- **5×5, 30 tuiles.**
  - Centrales : P1 ×3, P2 ×3, P3 (T) ×2, P5 ×1, P6 ×2.
  - Bords : B1 ×6, B7 ×6 (sans miroir), B9 ×2.
  - Coins : K2 ×5.
  - Retiré : P4.

## Mesure du rythme (fonction `rythme`, graphe complet)
- **Zone d'intérêt** : une ville, ou une case d'un réseau de passages reliant au moins 2 cases.
- **Chaîne** : la plus longue suite de cases sans action sur un plus court chemin entre deux zones d'intérêt.
- **Distance** : le nombre de pas de chaque case à la zone d'intérêt la plus proche.

| Série (200 plateaux) | Chaîne moy. | Pire | Chaîne ≤ 3 | Distance max moy. / pire | Cases |
|---|---|---|---|---|---|
| 4×4 nouveau, centrales orientées | 3,08 | 4 | 84 % | 2,6 / 4 | 56 |
| 4×4 actuel | 6,36 | 8 | 0 % | 4 / 4 | 63 |
| 5×5 nouveau, centrales orientées | 3,31 | 5 | 72 % | 3,2 / 5 | 81 |
| 5×5 actuel | 7,87 | 9 | 0 % | 5,4 / 6 | 78 |

Plateaux d'exemple :

| Plateau | Cases | Chaîne la plus longue | Distance max |
|---|---|---|---|
| 4×4-A | 57 | 2 | 2 |
| 4×4-B | 56 | 3 | 2 |
| 5×5-A | 80 | 3 | 2 |
| 5×5-B | 81 | 2 | 3 |

## Constats
- Le gain vient surtout de l'**orientation des centrales**. Avec des rotations au hasard, seuls 12 à 14 % des plateaux ont une chaîne ≤ 3. Le générateur devra orienter les centrales pour le rythme.
- **4×4** : avec un seul passage par centrale, environ 16 % des plateaux plafonnent à une chaîne de 4. Ville → porteuse → relais → porteuse → ville fait déjà 3 cases, ce qu'impose l'écart entre villes.
- **5×5** : garder toutes les villes sur des jonctions à 3 ports impose 6 B1, soit 80 à 81 cases.

## Arbitrages de l'orchestrateur
- **Mesure plus stricte.** Un passage qui n'économise aucun pas ne fait pas de zone d'intérêt : c'est le cas d'une case reliée à un raccord qui fait face à un simple chemin. Cette mesure plus stricte servira aux mesures définitives.
- **Le générateur orientera les centrales selon le rythme**, en plus des ports.

## Questions soumises à l'utilisateur
- 4×4 : accepter une chaîne de 4 sur environ 1 plateau sur 6 (rejet au générateur possible), ou rouvrir un 2e passage par centrale ?
- 5×5 : garder les villes sur 3 accès (80 à 81 cases), ou accepter des villes à 2 accès pour alléger ?
