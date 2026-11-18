# Jetons recto-verso (sous-agent dev-web), 2026-10-19

Décision : fin de `18` (16 jetons, campement au recto, ville au verso, pour tous les formats).

## Ce qui a été fait (`src/export.js`)
- **Page 1 (recto)** : 16 campements sur une grille de 4 × 4 au pas de 38 mm, centrée.
  - Sur cette page seulement : cercles et repères de coupe, barre de 100 mm.
  - Consigne imprimée : « recto-verso, retournement bord long, taille réelle ».
- **Page 2 (verso)** : 16 villes en miroir (x → 210 − x), sans repère.
  - Fond perdu noir de 3 mm (Ø 36), qui absorbe le décalage du recto-verso.
  - Tolérance mesurée : environ 2,6 mm.
- On découpe du côté recto, dont le bord blanc ne trahit pas le décalage.
- **Alignement mesuré** à 600 dpi : 0,004 mm au plus.
- **Images** : `docs/croquis/campements/jetons-recto.png` et `jetons-verso.png`.
- **Tests** : `node --test` passe (742, 0 échec).

## Suites
- `outils/recette-p2.html` attend encore l'ancienne planche (3 contrôles). Le correctif est confié à l'agent de production, dont c'est le périmètre.
- Le titre d'un test de `corrections-relecture` (« fond perdu de 1,5 mm ») est devenu trompeur : à renommer.
- Points mineurs :
  - en SVG et PNG, on obtient 2 fichiers à imprimer soi-même en recto-verso ;
  - dans un PDF mixte, la consigne « imprimer ces 2 pages seules » évite le décalage de parité ;
  - le verso consomme beaucoup d'encre.
- Validation par l'advisor prépresse : à faire.
