# Recette de l'hexagonal (testeur, Sonnet 5.5), 2026-10-19

Rapport du testeur, consigné et condensé par l'orchestrateur. Nouveau fichier `tests/testeur-hex.test.js` (60 tests : 58 OK, 2 laissés en `skip` pour défaut).
- `node --test` : 966 tests, 957 OK, 0 échec, 9 sautés (7 PDF et 2 défauts).
- Recettes navigateur : 420 OK et 125 OK, 0 échec.

## Tests ajoutés
- **Fichiers JSON hostiles** : grille, version, rotations, cellules, `modeleId`, jetons et modèles piégés ; plafonds.
- **Tuiles de l'utilisateur en hexagonal** :
  - cases hors forme ;
  - côtés et coins hors plage ;
  - règle H1 : 3 ports consécutifs acceptés, 4 ports ou ports non consécutifs signalés par une alerte ;
  - passages traversants, passages vers un coin ;
  - pivots à 4 ou 5 branches ;
  - tuile de l'utilisateur posée.
- **Bibliothèque modifiée** : modèle à 0 exemplaire, supprimé ou incomplet ; stock insuffisant ; HC2 ou HC3 seul ; tuile de l'utilisateur ; options hostiles ; déterminisme.
- **Orienter les tuiles** : modèles supprimés ; 7 villes, 1 ville, villes hors plage ; plateau partiel ; Ctrl+Z et Ctrl+Y.
- **Placer les villes** : cas limites.
- **Mélange de formats** : tuile carrée dans un document hexagonal, et inversement.
- **Export** : bibliothèque modifiée, plafond de 200 exemplaires, noms piégés, 24 jetons.
- **Non-régression 4×4 et 5×5** : empreintes figées sur `origin/main`, identiques.
- **Fuzz déterministe** : 60 fichiers altérés, aucune exception.

## Défauts (laissés en `skip`)
- **D1. `src/graphe.js:196`, appelé ligne 240.** Un modèle posé dont un chemin cite une case absente fait lever une exception à `construire`. L'exception se propage au rapport d'équilibre, à « Placer les villes » et à l'export avec aperçu. Le défaut existait déjà sur `main`, en 4×4 aussi. C'est le constat 6 du relecteur (`84`).
- **D2. `src/generateur.js:1244-1248`.** Si toutes les centrales ont une rotation invalide, Orienter refuse avec le message trompeur « aucune tuile intérieure posée ».
