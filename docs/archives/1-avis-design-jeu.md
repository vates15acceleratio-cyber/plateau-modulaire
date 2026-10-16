# Avis de l'advisor design de jeu (Opus 5.5), 2026-10-15

> **Note de l'orchestrateur.** L'utilisateur a confirmé après cet avis que le produit final est un jeu de **tuiles en carton découpées** (pas de plateau plié). Les arguments sur les plis à 25 cm (D1, D2) sont donc caducs. Le choix 4×4 reste valable pour les autres raisons. Le risque ouvert de D1 est levé.
>
> **Interprétation à confirmer par l'utilisateur :** « écart de 3 cases » lu comme au moins 3 cases intermédiaires, soit au moins 4 pas.

Convention : un **pas** est une arête du graphe. La règle D2 garantit l'écart dès la conception des tuiles.

## D1. Grille 4×4, tuiles de 12,5 cm
- **Décision** : 4×4 tuiles carrées de 12,5 cm, soit 16 tuiles, 50 × 50 cm.
- **Raison** : 3×3 n'a qu'une tuile centrale (7 captures impossibles). 5×5 (10 cm) : 25 tuiles à 2 cases en moyenne, trop pauvres et trop nombreuses. 4×4 : 60 cases (49 déplacement, 7 captures, 4 apparitions), 3 à 4 cases par tuile, disques de 3 cm à environ 6 cm d'entraxe.
- **Impact modèle** : le contour sort de la tuile. Le Plateau porte `grille {colonnes:4, lignes:4, tailleTuile:12.5}`, la Tuile hérite d'un carré fixe.

## D2. Captures dans les tuiles (« tuiles-villes »), pas aux jonctions
- **Décision** :
  - Une capture est une case d'une tuile ; une tuile porte au plus 1 capture.
  - « Captures sur tuiles centrales » devient « captures sur tuiles **neutres** » : rangées 2 et 3, soit 8 emplacements (4 centraux, 4 latéraux). On place 7 tuiles-villes et 1 tuile-carrefour.
  - **Règle de conception** : sur une tuile-ville, la capture est à au moins 2 cases de déplacement de chaque raccord (exemple : capture–m1, m1–m2, m1–m3, raccords sur m2 et m3).
- **Raison** : option la plus modulaire (les captures bougent avec les tuiles, alors que les sommets de jonction sont fixes). Aucun nouveau type de raccord, jamais de ville incomplète. Tout chemin entre deux captures traverse au moins 2 + 2 = 4 cases : écart garanti sans recherche. Les 4 tuiles centrales seules (~21 cases) ne peuvent pas accueillir 7 captures espacées.
- **Impact modèle** : section 6 inchangée (une case appartient à une seule tuile). Validations ajoutées : au plus 1 capture par tuile ; distance capture → raccord ≥ 2 sur les tuiles-villes. Si l'on retient plus tard les villes en jonction : entité `Ville {ancrage: sommet | milieu-de-côté, quartiers:[{tuileId, coin ou côté}]}`, nœud partagé, raccords `demi-ville` / `quart-de-ville`.
- **Risques** : captures en impasse derrière un goulot (variante « ville traversante » à 5 cases). 7 est impair : une rangée neutre porte 4 villes, l'autre 3, léger avantage au joueur voisin de la rangée à 4 (D5 doit le détecter). Une 7e ville au centre (jonction) annulerait le 4/3 : idée pour une V2.

## D3. Côtés et rôles des tuiles de bord
- **Décision** : rangée 1 = côté du joueur 1, rangée 4 = côté du joueur 2. Chaque rangée a 2 tuiles d'apparition et 2 tuiles de bord simples. Les tuiles latérales des rangées 2 et 3 sont des bords **neutres** et peuvent porter une capture. Les tuiles de bord ont un côté extérieur désigné (rotation imposée) ; la position des 2 apparitions parmi les 4 cases de la rangée est tirée au sort.
- **Impact modèle** : `type` devient `role: apparition | bord | ville | carrefour`, plus `coteExterieur`. Le Plateau porte `cotesJoueurs {j1:'nord', j2:'sud'}`.
- **Risque** : la variété vient surtout des positions et des 4 tuiles centrales ; à vérifier.

## D4. Lot de tuiles : 11 modèles, 20 tuiles, 16 posées par partie

| Rôle | Modèles × exemplaires | Cases par tuile | Posées par partie |
|---|---|---|---|
| Apparition | 2 × 2 (même lot pour chaque joueur) | 1 apparition + 3 déplacement | 4 |
| Bord de joueur | 3 × 2 | 3 déplacement | 4 parmi 6 |
| Ville | 3 × 2 + 1 × 1 | 1 capture + 3 déplacement | 7 |
| Carrefour | 1 × 2 + 1 × 1 | 4 déplacement | 1 parmi 3 |

- Villes et carrefours ont 3 ou 4 raccords ; une tuile à 3 raccords peut aller en latéral, côté libre vers l'extérieur.
- **Raison** : 49 cases de déplacement ; lot identique pour chaque joueur.
- **Impact modèle** : la Tuile gagne `modeleId` et `exemplaire`, le Plateau gagne `graine`.
- **Risque** : 7 villes sur 8 emplacements, bande neutre presque toujours pleine. Option : 1 ville par rangée de joueur, sur une tuile sans apparition, sous contrôle de D5.

## D5. Critère d'équilibre sans symétrie
- **Distance** : plus court chemin en pas depuis l'apparition la plus proche du joueur. Pour chaque joueur p, D_p(c) pour chaque capture c, triées.
- **Alerte principale** : max |D₁(k) − D₂(k)| pour k = 1 à 4 (rang dans le tri) ; alerte au-delà de 2.
- **Alertes secondaires** : un joueur strictement plus proche de 5 captures ou plus ; une apparition à plus de 7 pas de toute capture (à calibrer).
- **Information** : écart des moyennes sur les 7 captures.
- **Raison** : 4 captures font la majorité ; une moyenne masquerait une course perdue d'avance.
- **Impact modèle** : rapport calculé `{D1[], D2[], ecartCourse, partage}`, sans stockage.
- **Risque** : seuils 2 / 5 / 7 à calibrer sur ~20 plateaux joués.

## D6. Silhouette libre
- Tuile **exposée** = au moins un côté sans voisin ; **intérieure** = 4 voisins (affichage seulement).
- Captures sur toute tuile qui n'est pas une tuile d'apparition.
- Tuiles d'apparition : côté extérieur exposé et orienté vers le côté de leur joueur (boîte englobante).
- **Risque** : formes étroites, captures alignées entre les camps.

## D7. Garde-fous du générateur
1. **Bloquant** : graphe connexe ; 7 captures et 4 apparitions dans la même composante ; règle D2 respectée.
2. Coupe minimale ≥ 2 cases entre chaque rangée de joueur et la bande neutre.
3. Les 2 apparitions d'un joueur ne débouchent pas sur la même case goulot.
4. ~200 candidats, rejet des invalides, tirage au hasard parmi ceux d'écart ≤ 2 ; afficher la graine.
5. Contrôler le 4/3 des rangées neutres et les villes groupées du même côté.
6. Nombre maximal d'essais, message clair en cas d'échec.

## Questions transmises à l'advisor géométrie
1. Positions exactes en cm des 3 raccords sur un côté de 12,5 cm (symétrie : p rencontre 12,5 − p).
2. Raccord face au vide ou face à un côté sans raccord : autorisé (chemin coupé) ou interdit ?
3. Modèles de coin à 2 côtés libres, ou une tuile de bord à 1 côté libre peut-elle aller en coin ?
4. Raccords d'un seul type ou typés ? Combien de profils de côté parmi les 8 combinaisons ?
5. Profils minimaux pour garantir la coupe minimale de 2 entre les rangées.
6. Marge disques / bord de tuile, tolérance de découpe, tracé des chemins à la jonction.
7. V2 : géométrie des quarts et demi-villes en jonction.
8. Rotation imposée des bords : les 3 modèles de bord donnent-ils assez d'assemblages distincts ?
