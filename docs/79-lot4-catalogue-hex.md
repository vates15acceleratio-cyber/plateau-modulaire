# Lot 4 : catalogue `'hex19'` (producteur, Sonnet 5.5), 2026-10-19

Rapport du producteur, consigné et condensé par l'orchestrateur. Fichiers : `src/catalogue.js`, nouveau `tests/catalogue-hex.test.js` (16 tests) et `tests/catalogue-5x5.test.js` (la liste des grilles inclut maintenant hex19). Résultat : `node --test` 815 tests, 808 OK, 0 échec, 7 PDF ignorés.

## Modèles (`PM.catalogue.modelesParGrille['hex19']`)
| Id | Nom | Gabarit | Cases | Ports | Passages | Exemplaires | Poids |
|---|---|---|---|---|---|---|---|
| HC2 | Deux ponts et traverse | centrale | a (0 ; −20,7), b (0 ; 20,7) | a : 5, 0, 1 ; b : 2, 3, 4 | traverse E–O courbe | 8 | 6 |
| HC3 | Carrefour | centrale | idem | idem | pivot à 4 branches (E, O, a, b) | 7 | 5 |
| HB1 | Bord | bord | apparition (0 ; −30), porteuse (0 ; 20,7) | 2, 3, 4 | — | 8 | 6 |
| HK1 | Coin | coin | apparition (10 ; 0), porteuse (−22 ; 0) | 4, 5 | — | 7 | 6 |

- **Raccords :** 6 sur chaque intérieure.
- **Ni mur ni miroir.**
- **Validation :** `validerModele(m, 'hex19')` ne signale aucune erreur ni alerte sur les 4 modèles.
- **Stock :** **30 pièces**, soit les 19 du plateau et 11 de réserve. Les 4 exemplaires du HC1 retiré sont répartis sur HC2 et HC3. Proposition du producteur, à valider : 15 intérieures pour 7 places, 8 bords pour 6, 7 coins pour 6.
- **Poids :** ceux du candidat, séparés du stock.
- **`nouveauDocument('hex19')` :** il utilise le modèle du lot 2. `FORMATS` reste carré.

## Écarts au candidat
- **Courbe de la traverse de HC2 :** point de contrôle en (0 ; 4) au lieu de (0 ; 6). Le tracé du code part du raccord, et avec (0 ; 6) il passait à 17,7 mm de la case b, sous le seuil de 18 mm. Avec (0 ; 4), il passe à 18,7 mm. À confirmer.
- **HC1** est absent, comme décidé dans `72`.

## Tests
- **Contenu et validité** des 4 modèles.
- **Contrôle de tracé hexagonal**, écrit dans le test, parce que `aides-trace.js` ne connaît que 4 coins. Il détecte bien deux tuiles volontairement abîmées.
- **Plateaux complets en trèfle**, avec des rotations trouvées par recherche : 56 cases, 0 case faible, 0 raccord mort, 3 ports sur les 24 sièges, écart de 4 pas, partage 3/3, stock respecté.
- **4×4 et 5×5** inchangés.
