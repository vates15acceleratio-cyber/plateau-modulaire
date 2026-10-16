# Avis prépresse : cases à Ø 20 mm (advisor, Sonnet 5.5), 2026-10-16

Rapport de l'advisor consigné par l'orchestrateur. Avis rendu d'après le code et les docs : rien n'a été imprimé ni mesuré, et aucun fichier n'a été modifié.

## Synthèse
Le passage à Ø 20 est acceptable à l'impression. Deux points sont à corriger dans le code :
- le carré d'apparition laisse un jeu presque nul avec le contour de la case ;
- une case sans `diametre` se dessine encore à Ø 30 en 4×4 (Ø 24 en 5×5).

Le reste est à valider sur un essai réel.

## 1. Lisibilité et usage d'une case Ø 20
1. **Taille de pion : Ø 16 conseillé, Ø 18 au maximum, Ø 20 interdit.** À faire : le noter dans la consigne de l'utilisateur, qui disait « Ø 20 au plus ».
   - Un pion de Ø 20 recouvre tout le disque et son contour. Avec 1 mm de décalage à la découpe, il déborde sur le chemin.
   - Un pion de Ø 16 à 18 laisse 1 à 2 mm de blanc visible tout autour.
2. **Contraste chemin / case : sans changement.**
   - Le chemin de 8 mm paraît plus épais : 8 / 20 au lieu de 8 / 24.
   - Chaque case garde 6 mm de blanc de chaque côté du chemin, contre 8 mm avant.
   - À vérifier sur un essai : le chemin reste-t-il assez visible entre deux cases voisines ?
3. **Épaisseurs de trait de `rendu.js`.**
   - Contours de case et arcs de jonction à 0,6 mm (`rendu.js:69`, `:80`, `:125`) : sans changement, ils dépassent le minimum de 0,25 mm.
   - Carré d'apparition (`rendu.js:82`) : à faire, voir le point 4.
   - Contour de tuile à 0,25 mm (`rendu.js:132`) : sans changement, c'est un trait de coupe.

## 2. Symbole d'apparition sans la couleur
4. **À faire : le carré touche presque le cercle.**
   - La formule `cote = r·√2 − 1,2` (`rendu.js:77`) laisse environ 0,25 mm de blanc aux coins une fois les traits déduits. Le carré fait 12,9 mm de côté à Ø 20.
   - Proposition : `cote = r·√2 − 3`, soit environ 11,1 mm de côté et environ 1 mm de jeu aux coins.
   - Trait du carré à 1,0 ou 1,2 mm à l'impression, comme à l'écran (`rendu.js:82`).
5. **Reconnaissance sans la couleur : suffisante après correction.** Critère : reconnaître le symbole à 40 cm. Si ce n'est pas assez net, deux replis possibles : un carré plein avec un petit carré blanc au centre, ou un damier 2×2. À vérifier à l'impression.
6. Un pion posé cache le symbole. C'est normal : seule la case vide doit se lire.

## 3. Quarts de jonction Ø 20 sur 4 tuiles
7. **Géométrie cohérente, sans changement.** Chaque quart a un rayon de 10 mm et se prolonge de 3 mm dans le fond perdu (`rendu.js:60-70`). La marge de coupe de 4 mm ne s'applique qu'aux cases entières.
8. **Tolérance de découpe : acceptable, mais visible.**
   - Avec ±0,5 à 1 mm de dérive par tuile, une fente de 1 à 2 mm apparaît dans le disque reconstitué, et les chemins se raccordent mal.
   - Ça ne gêne pas le jeu, mais l'arc de 0,6 mm paraîtra brisé.
   - L'avis est favorable si la découpe est soignée (cutter et règle métallique, ou laser).
9. **Le jeton Ø 30 couvre le disque d'une ville** : il absorbe environ 2 mm de décalage. Une jonction sans ville n'a rien pour masquer ses défauts. À vérifier à l'impression sur les deux types de jonction.

## 4. Valeurs codées en dur qui devraient suivre le diamètre
10. **`rendu.js:120` : à faire.**
    - Le repli `c.diametre || F.DIAMETRE_CASE_MAX` dessine une case sans diamètre à Ø 30 en 4×4 (Ø 24 en 5×5), alors que la valeur normale est maintenant 20.
    - Ce repli est atteignable, car `sauvegarde.js:95-97` laisse `diametre` facultatif.
    - Correction : ajouter une constante `DIAMETRE_CASE` (20) dans `geometrie.js` et l'utiliser comme repli.
11. **`rendu.js:77` et `:82` : à faire** (voir le point 4).
12. **`rendu.js:151` : sans changement.** La couronne du jeton a une taille fixe, sans effet tant que le jeton reste à Ø 30.
13. **`export.js:356` : à faire, mineur.**
    - `DIAMETRE_JETON_FP = 33` donne 1,5 mm de fond perdu autour d'un jeton, contre 3 mm pour les tuiles.
    - Soit le dériver : `DIAMETRE_JETON + 2·FOND_PERDU`, avec `PAS_JETON` porté à 38 à 42 mm.
    - Soit commenter que 1,5 mm est un choix voulu.
14. **`DIAMETRE_CASE_MAX` (30 et 24) : sans changement.** C'est une borne de l'éditeur.
15. **Marge de coupe de 4 mm : sans changement.**

## 5. À valider sur une vraie impression
16. Faire un essai de 4 tuiles autour d'une jonction, sur carton de 1,5 à 2 mm, et vérifier :
    - la fente du disque reconstitué, avec et sans jeton ;
    - des pions de Ø 16 et de Ø 18, en prenant deux pions voisins ;
    - le carré d'apparition corrigé, à 40 cm ;
    - deux cases voisines reliées par un chemin de 8 mm ;
    - l'absence d'empâtement des traits ;
    - le fond perdu des jetons ;
    - un pion de Ø 18 qui ne se coince pas entre deux jetons.
