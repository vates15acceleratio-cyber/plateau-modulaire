# Recette des corrections de la relecture (testeur, Sonnet 5.5), 2026-10-16

Objet : commit ae21cca (docs/27 et docs/26), branche `corrections-relecture`. Aucun fichier de `src/` modifié par le testeur.

## Tests ajoutés : `tests/corrections-relecture.test.js` (13 tests)
1. DIAMETRE_CASE : valeur 20 dans 4×4 et 5×5, égale à DIAMETRE_CASE_JONCTION, <= Ø max ; toutes les cases des exemples (2 formats) et du catalogue ; `DIAMETRE_DEFAUT` de l'éditeur.
2. Éditeur : `ajouterCase` crée une case de Ø DIAMETRE_CASE (2 formats).
3. Rendu : case sans diamètre (absent, 0, null) dessinée à r = 10 dans les deux formats ; apparition sans diamètre : disque r = 10 et carré de côté 10·√2 − 3.
4. Rendu : un diamètre explicite (24) n'est pas remplacé par le repli.
5. Carré d'apparition : pour Ø 10 à 30 (pas de 0,5) et impression / vert / rouge / neutre, côté > 0, trait 1,0 (impression) ou 1,2 (camps), jeu aux coins >= 0,9 mm.
6. Carré d'apparition centré sur la case après rotation 0..3 (2 formats).
7. K4 : positions (82,60), (60,82), (92,92), (40,40), modèle valide.
8. K4 : dans les 4 rotations, chemins à >= r + 4 mm des cases non reliées, et >= 8 mm entre chemins hors du disque commun + 4 mm.
9. K4 : les deux routes ont la même longueur.
10. Halo de coin : rayon = DIAMETRE_CASE_JONCTION/2 + 3, 4 coins, 2 formats.
11. Jetons : rayon de coupe 15, fond perdu 16,5, 7 jetons dans les marges de 3 mm de l'A4, pas de 38 mm.
12. Jetons : le commentaire de fond perdu est présent dans export.js (docs/26 § 13).
13. Document v1 (`document-v1.json`, Ø 24) : rouvert, diamètres conservés, modèles valides, `svgTuile` sans NaN aux 4 rotations, calepinage et `svgPlanche` sans erreur.

## Défauts trouvés
Aucun. Tous les tests passent ; aucun `skip` ni `todo` ajouté. (Le jeu aux coins du carré vaut 3/√2 − trait/2 − 0,3, soit 1,32 mm à l'impression et 1,22 mm avec un camp, indépendamment du diamètre.)

## Résultats
- `node --test` : 481 tests, 474 réussis, 0 échec, 0 annulé, 7 ignorés (`skip` préexistants, aucun de mes tests), 0 todo.
- `recette-interface.html` : `=== TOTAL : 243 OK, 0 ÉCHEC ===`
- `recette-p2.html` : `=== TOTAL : 109 OK, 0 ÉCHEC ===`

## git status --short
```
?? docs/30-recette-corrections-relecture.md (renuméroté par l’orchestrateur ; le n° 28 est pris sur la branche catalogue-5x5)
?? tests/corrections-relecture.test.js
```
