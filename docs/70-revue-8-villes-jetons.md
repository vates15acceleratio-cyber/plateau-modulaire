# Revue : 8 villes fixes, campements, jetons recto-verso (relecteur, Sonnet), 2026-10-19

Objet : diff `1c2d89c~5..00c69bd` (`src` et `styles`). **Aucun point bloquant.**

## À corriger
1. **La boîte « Régénérer le plateau » n'est testée nulle part** (`app.js:179-250`). Aucun test ne clique « Régénérer » ou « Garder » ; les deux garanties (annulable par Ctrl+Z, refus sans effet) ne tiennent qu'à la lecture du code.
2. **Classes `pm-regenerer-*` sans aucune règle CSS** : la boîte n'a pas le style des autres boîtes.
3. **La proposition revient à chaque ouverture** (`sauvegarde.js:302`, `ancienPlateau5x5`). Elle se déclenche pour tout 5×5 à 7 villes : après « Garder », au rechargement, et même quand l'utilisateur a retiré une ville exprès.

## Vérifié conforme
- **R3 assouplie** : centrales 5×5 seulement, formulation exacte du `66`.
- **Critères et motif à 8 villes** : conformes.
- **Jetons en miroir** : correct.
- **`rechercherPose5x5`** : comparé à une force brute sur 24 compositions, 0 divergence ; 1 ms en moyenne.
- **Bibliothèque sans « ponts »** : abandon rapide avec un message clair.
- **Valeurs hostiles, CSP, conventions** : OK.

## Remarques
- Le test de `rechercherPose5x5` ne vérifie pas l'élagage.
- Quelques commentaires disent encore « jonction-case ».

## Arbitrage de l'orchestrateur sur le point 3
On ne propose la régénération que pour un document **produit par une version antérieure**, reconnu à sa bibliothèque (ancien catalogue 5×5 : sans LC11 ni LC12, ou avec LC2) **et** portant 7 villes. Un refus est retenu pour la session. Une ville retirée volontairement ne déclenche donc plus rien.
