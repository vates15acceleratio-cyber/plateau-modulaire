# Campements : apparence, jeton et planche (sous-agent dev-web), 2026-10-19

Décisions : fin de `18` (campements dans les deux formats, même taille qu'une ville, icône de feu de bois).

## Résultats
- `node --test` : 741 tests, 0 échec (vérifié par l'orchestrateur).
- `recette-interface` : 361 OK, 0 ÉCHEC.
- `recette-p2` : 116 OK, 0 ÉCHEC.

## Ce qui a été fait
- **Jeton campement** (`rendu.js`, `contenuJeton('campement', …)`). Il a le même diamètre que la ville (30 mm), en noir et blanc, à l'inverse de la ville :
  - un disque blanc, avec un anneau noir rentré pour que la coupe reste régulière ;
  - deux bûches croisées et une flamme noire à cœur blanc.

  Il est lisible en gris et neutre (le rouge reste la couleur du camp J2).
- **Siège Ø 30** imprimé aux coins des tuiles : quarts de disque blanc, au lieu de Ø 20. Mesures de place sur tous les modèles :
  - 4×4 : 7,6 mm de marge aux cases, 9 mm aux chemins ;
  - 5×5 : 10,4 mm aux cases, 9 mm aux chemins ;
  - aucun conflit.
- **Aperçu du plateau** (export) : un campement à chaque intersection sans ville.
- **Planche de jetons A4** : 8 villes (1 de réserve en 4×4) et 8 campements (6 de réserve en 4×4).
- **Textes** (aide, éditeur) : « campement » remplace « case de jonction ».
- **Images** : `docs/croquis/campements/` (plateaux 4×4 et 5×5, jeton agrandi et en gris, planche, siège sur planche A3).

## Reste à faire (hors périmètre de l'agent)
- **Écran Plateau** (`assemblage.js`) : dessiner le jeton campement à la place du petit point quand les 4 tuiles sont posées.
- **Renommer les textes restants** :
  - `assemblage.js` : « Case de jonction », et « la jonction redevient une case chemin » ;
  - `controles.js` : compteur « Cases (tuiles et jonctions) » ;
  - `modele.js` : message `amorce_zone`.

  Les tests et la recette sont à adapter en même temps.
- `DIAMETRE_CASE_JONCTION` (20) dans `geometrie.js` et le halo de l'éditeur (r = 13) ne correspondent plus au siège Ø 30. À reprendre avec leurs tests.
- **Validation par l'advisor prépresse** : pas encore faite.

## Points soumis à l'utilisateur
1. Campements en **jetons à part**, découpés comme les villes (fait), ou feu imprimé en quarts sur les tuiles.
2. **Flamme noire** (fait), ou rouge cernée de noir.
3. **Siège Ø 30** : toutes les tuiles sont à réimprimer.
4. **8 jetons campement** : il en manquerait si l'on pose moins de villes que par défaut.
