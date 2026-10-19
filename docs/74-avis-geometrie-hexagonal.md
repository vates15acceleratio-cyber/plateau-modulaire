# Avis géométrie : plateau hexagonal à 19 tuiles (advisor Opus, lecture seule), 2026-10-19

Scripts dans le scratchpad (`hex-geometrie/`). Images dans `docs/croquis/hexagonal/` :
- `plateau-vide-54.png` ;
- `gabarits-54.png` ;
- `plateau-exemple-54.png` ;
- `villes-placements-54.png`.

## Conclusions
- **Nombre de villes** : avec des tuiles très connectées, dont les 2 cases sont reliées, on tient **6 villes au plus** (3 par camp), avec 3 ports et un écart de 3 cases. Le design de jeu (`73`) arrive à la même conclusion. Pour 8 villes, il faudrait des cases non reliées, des villes à 2 ports ou un écart de 2 cases.
- **Orientation** : tuiles pointe en haut, grand hexagone à côté plat en haut. C'est la seule orientation qui donne 3 côtés nets à chaque camp.
  - Rangées : 3-4-5-4-3.
  - La rangée du milieu est neutre, et aucun sommet intérieur n'est sur la médiane (12 au nord, 12 au sud).
  - Les coins E et O sont neutres.
- **Dénombrement** :
  - 24 sièges (sommets à 3 tuiles), 12 sommets du pourtour à 2 tuiles, 42 côtés partagés.
  - Rôles : centre et couronne partagent le gabarit « intérieure » ; il y a 6 bords et 6 coins.
  - Cases : 38 sur les tuiles + 24 sièges = 62.
- **Taille** (s = côté de l'hexagone, plancher 53,4 mm) :
  - **54 mm** : plateau de 468 × 432 mm, 8 tuiles par A3, soit 3 planches A3 ;
  - **57 mm** : plateau de 494 × 456 mm, 4 planches A3 ;
  - dans les deux cas, 10 planches en A4.

  Une tuile hexagonale **ne se coupe pas au massicot**. La découpe est à étudier.
- **Raccords** : un seul raccord, au milieu de chaque côté. Avec deux raccords par côté, le plateau dépasserait 600 mm.
  - Masque de 6 + 6 bits, rotation de 60° ; le côté k touche le côté (k + 3) % 6 du voisin.
  - Le siège est un secteur de 120°.
- **Gabarits essayés à 54 mm**, sans erreur de règle :
  - CH1 « Pont » : 2 cases reliées, 3 ports chacune ;
  - CH2 « Porteuse et relais » ;
  - BH1 (bord) ;
  - KH1 (coin).

  Sur le plateau d'exemple : 12,9 % de cases à 2 connexions ou moins, et des raccords morts. Le catalogue est à travailler.
- **Anneau du pourtour** : si les apparitions portent les raccords de l'anneau, une apparition verte est à 2 pas d'une apparition rouge, en passant par le coin neutre. À éviter.
- **Code** :
  - Le graphe, l'équilibre, le rythme, la sauvegarde et les passages sont génériques.
  - `geometrie`, `modele`, `graphe.construire`, `rendu`, `export`, `generateur` et l'interface supposent le carré.
  - Découpage en environ 6 lots pour des agents Sonnet ; on garde les clés `col,lig`.

## Questions pour l'utilisateur
1. 6 villes ou 8 ?
2. Jetons : 24 sièges (16 jetons aujourd'hui).
3. Taille : 54 ou 57 mm ?
4. Moyen de découpe des hexagones.
5. Interdire l'anneau des apparitions le long du bord ?
6. Coins E et O neutres ?
