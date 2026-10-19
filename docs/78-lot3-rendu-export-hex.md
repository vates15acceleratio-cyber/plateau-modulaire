# Lot 3 : rendu et export pour `'hex19'` (producteur, Sonnet 5.5), 2026-10-19

Rapport du producteur, consigné et condensé par l'orchestrateur. Commit `3588d31`. L'orchestrateur l'a vérifié dans une copie propre, sans le générateur en cours de modification : `node --test` donne 841 tests, 834 OK, 0 échec, 7 PDF ignorés.

## Rendu (`src/rendu.js`)
- **Dessin des pièces.** `contenuTuile` dessine les pièces hexagonales en repère centré : hexagone pour l'intérieur, pentagones à bord droit pour les bords et les coins. Chaque pièce reçoit son contour de coupe, ses cases, chemins, ports, raccords, passages courbes et pivot à 4 branches.
- **Sièges et apparitions.** Chaque coin intérieur porte un secteur de 120° (rayon 15) qui forme une part de siège. Les apparitions sont neutres à l'impression et colorées à l'écran.
- **Rotation** par pas de 60°.
- **Découpe sans fond perdu** : le contenu est découpé à la forme de la pièce par un `clipPath`, pour que les ports ne débordent pas sur les voisines.
- **Nouvelles fonctions** : `formeTuile` est ajoutée ; `svgTuile` et `tournerTracePassage` sont généralisées. Le carré ne change pas.

## Export (`src/export.js`)
- **A3 paysage** : 10 pièces jointives sur trois rangées (3, 4, 3), disposition de `75`. Coupes partagées : un seul trait par côté commun, ce qui est vérifié.
- **A4 portrait** : 3 pièces jointives.
- **Nombre de planches** :
  - stock de 30 pièces : **3 A3** ou 10 A4 ;
  - tuiles posées : 2 A3 ou 7 A4.
- **Jetons** : **24 recto-verso pour tous les formats** (décision de `72`, qui n'avait pas encore été appliquée au 5×5). Grille de 4 × 6 au pas de 38 mm, sur 2 pages A4 en miroir.
- **Aperçu hex** : A3 portrait, plateau de 498,8 × 432 réduit à 54 %, avec les villes et campements aux 24 sièges.
- **Formats de sortie** : PDF vectoriel à l'échelle (le convertisseur accepte maintenant les `clipPath`), SVG et PNG. La barre de contrôle de 100 mm est présente.
- **Fenêtre d'export** : libellés adaptés au format, étiquettes de pièces.

## Tests
- Nouveaux fichiers `tests/rendu-hex.test.js` (12 tests) et `tests/export-hex.test.js` (14 tests), plus l'aide `tests/aides-rendu-hex.js` (copie du catalogue candidat).
- Tests existants adaptés au passage de 16 à 24 jetons : `export`, `corrections-relecture` et `recette-p2`.
- Le test d'aperçu « très déséquilibré » en hexagonal est simulé, car aucun cas n'a été trouvé en 3000 tirages. À revoir avec le générateur.

## Images
Dans le dossier temporaire de la session `lot3/` : planches A3 1 et 3, aperçu, A4, recto et verso des jetons.

## À reprendre
- `CLAUDE.md` et la documentation parlent encore de 16 jetons.
- `FORMATS` ne contient pas `hex19` : c'est au lot interface de l'ajouter.
