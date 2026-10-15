# Avis de l'advisor design de jeu, version B (villes en jonction), 2026-10-15

> **Note de l'orchestrateur.** Le même advisor a rendu une seconde version après avoir reçu la précision « tuiles en carton découpées ». Elle diverge de la version A (`1-avis-design-jeu.md`) sur le placement des villes. **Choix à faire par l'utilisateur.** L'advisor géométrie a été arrêté en attendant ce choix.

## D1. Grille 4×4, tuiles carrées de 12 cm (plateau 48 cm)
- 12 cm plutôt que 12,5 pour garder une marge de découpe dans 50 cm (à confirmer par l'advisor prépresse).
- 3×3 : 4 jonctions intérieures, moins de 7, impossible. 5×5 à 10 cm : 25 tuiles à 2 cases, trop pauvres. 4×4 : 9 jonctions intérieures, 7 villes + 2 en réserve.
- Impact §6 : contour = carré de taille fixe ; tuile posée = (colonne, ligne, rotation).

## D2. Villes = jetons ronds de 3 cm posés sur les coins communs à 4 tuiles
- Les 9 jonctions intérieures sont des nœuds du graphe : 7 portent une ville, 2 un jeton « carrefour » (case de déplacement).
- Raison : ville imprimée sur tuile = captures limitées aux tuiles centrales (selon cet avis) ; jeton = placement des villes indépendant des tuiles, 36 combinaisons de plus (7 parmi 9) ; un quart de cercle imprimé sur 4 coins casserait aux rotations.
- Impact §6 : nouvelle entité **Jonction** `(i, j)`, type `capture | carrefour`, rattachée à aucune tuile. Cases de tuile : `deplacement | apparition`. La tuile reçoit `portsCoin` (coins atteints par un chemin) et une zone réservée d'un quart de disque de 1,5 cm + marge à chaque coin.
- Risque : tenue et lisibilité du jeton (marche due à l'épaisseur du carton).

## D3. Écart entre villes
- Mesuré en pas sur le graphe : **au moins 3 pas** (2 cases intermédiaires), paramètre `ecartMinCaptures = 3`.
- Validation de tuile : deux coins d'une tuile séparés par au moins 2 cases à l'intérieur de la tuile.
- Contrôle par plus court chemin sur le plateau assemblé (raccourcis latéraux possibles).
- La lecture « 3 cases intermédiaires » (4 pas) exigerait 4 cases ou plus par tuile. **À confirmer par l'utilisateur.**

## D4. Côtés et rôles
- J1 au nord, J2 au sud. Les 2 tuiles du milieu des rangées nord / sud = **apparition** (position et orientation fixes). 4 **coins**. 4 **bords neutres** est / ouest.
- Impact §6 : `bord` reçoit un rôle `apparition | coin | neutre`, et `joueur` pour une apparition.
- Risque : flancs est / ouest qui deviennent des autoroutes vers les villes adverses.

## D5. Catalogue : 20 tuiles + 9 jetons

| Type | Modèles | Exemplaires | Posées par partie | Cases par tuile |
|---|---|---|---|---|
| Centrale (4 côtés, 4 coins) | 6 | 1 | 4, rotation libre | 3 à 4 |
| Coin | 5 | 1 | 4 | 2 à 3 |
| Bord neutre | 5 | 1 | 4 | 2 à 3 |
| Apparition | 2 | 2 (mêmes modèles pour chaque joueur) | 4 | 2 à 3, dont 1 apparition |

- ~47 cases de déplacement + 2 carrefours. Impact §6 : liste `stock` distincte des tuiles posées.
- Risque : 6 centrales pour 4 places peut-être juste ; en prévoir 2 de plus si besoin.

## D6. Équilibre (identique à la version A)
- Distance = plus court chemin depuis l'apparition la plus proche. 7 distances triées par joueur ; alerte si l'écart dépasse 2 à un rang 1 à 4. Alerte secondaire à 5 villes contre 2.

## D7. Garde-fous du générateur
- Graphe connexe ; toutes les paires de captures respectent `ecartMinCaptures` (plus court chemin).
- Jonctions sans ville : les 2 du milieu, ou une près de chaque joueur ; jamais les 2 du même côté.
- Chaque apparition a au moins 2 sorties distinctes. Cases de déplacement entre 45 et 55.
- ~200 candidats, garder le mieux noté, afficher la graine.
- Silhouette libre : ville seulement sur une jonction de 4 tuiles ; blocage si moins de 7 jonctions valides ; générateur en mode rectangle seulement.

## Questions pour l'advisor géométrie
1. Raccords latéraux : 3 positions par côté, ou seulement le milieu (début et fin empiètent sur la zone de coin) ?
2. Ports de coin : imposer les 4 coins aux centrales ? Combien de ports minimum par jonction ?
3. Raccord mort (chemin face à un côté sans chemin) : permis ou refusé ?
4. Rotation imposée des coins et bords : déductible automatiquement ?
5. Rayon de la zone de coin, tolérance d'alignement des jetons.
6. Éviter dès la conception les raccourcis latéraux entre jonctions.
7. Silhouette libre : jonction de 3 tuiles (coin rentrant), ville interdite ou carrefour ?
