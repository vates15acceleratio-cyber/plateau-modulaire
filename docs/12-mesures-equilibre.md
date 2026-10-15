# Mesures d'équilibre du catalogue (sous-agent 7)

Généré par `outils/mesures-equilibre.js` (graine 20261015). 1000 plateau(x) 4x4, 30 paires de carrefours permises par plateau (soit 30000 configurations).

Plateaux tirés comme dans `tests/catalogue.test.js` (mêmes tirages pour la même graine), catalogue réel `PM.catalogue.nouveauDocument()`.

Définitions : « écart D6 » = plus grand |D1(k) − D2(k)| aux rangs 1 à 4 (distances de chaque ville à l'apparition la plus proche de chaque joueur, triées). « Alerte D6 » = écart > 2. « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus. « Apparition > 7 pas » = une case d'apparition à plus de 7 pas de toute ville. Villes traversables (T) : on peut passer par une ville ; non traversables (N) : une ville n'est qu'une destination. Les carrefours sont toujours traversables.

## 1. Villes non traversables contre traversables

| Cas | Mesures | Écart D6 moyen | Écart max | Alerte D6 (> 2) | 5 contre 2 | Apparition > 7 pas | Ville inaccessible | Au moins une alerte |
|---|---|---|---|---|---|---|---|---|
| T, placement par défaut (1,2)+(3,2) | 1000 | 0.42 | 2 | 0 (0.0 %) | 0 (0.0 %) | 0 | 0 | 0 (0.0 %) |
| N, placement par défaut (1,2)+(3,2) | 1000 | 0.42 | 2 | 0 (0.0 %) | 0 (0.0 %) | 0 | 0 | 0 (0.0 %) |
| T, (2,1)+(2,3) | 1000 | 0.58 | 2 | 0 (0.0 %) | 44 (4.4 %) | 0 | 0 | 44 (4.4 %) |
| N, (2,1)+(2,3) | 1000 | 0.58 | 2 | 0 (0.0 %) | 45 (4.5 %) | 0 | 0 | 45 (4.5 %) |
| T, toutes les paires | 30000 | 0.98 | 3 | 48 (0.2 %) | 1707 (5.7 %) | 0 | 0 | 1710 (5.7 %) |
| N, toutes les paires | 30000 | 0.99 | 4 | 281 (0.9 %) | 1719 (5.7 %) | 0 | 0 | 1848 (6.2 %) |

Écart minimal entre deux villes (en pas, règle des 3 pas), placement par défaut :

Traversables :
```
valeur |       n |      % |
     3 |    1000 | 100.0 % | ##################################################
```
Non traversables :
```
valeur |       n |      % |
     3 |    1000 | 100.0 % | ##################################################
```
Flancs (distance de l'apparition à la ligne de jonctions adverse, flancs moins centre ; négatif = autoroute de flanc) :

| Cas | Mesures | Flanc plus court que le centre | Flanc − centre moyen |
|---|---|---|---|
| Villes traversables | 2000 | 0 (0.0 %) | 1.55 |
| Villes non traversables | 2000 | 0 (0.0 %) | 2.59 |

Histogramme de l'écart D6, placement par défaut. Traversables :
```
valeur |       n |      % |
     0 |     578 |  57.8 % | #############################
     1 |     421 |  42.1 % | #####################
     2 |       1 |   0.1 % | 
```
Non traversables :
```
valeur |       n |      % |
     0 |     578 |  57.8 % | #############################
     1 |     421 |  42.1 % | #####################
     2 |       1 |   0.1 % | 
```
## 2. Toutes les paires de carrefours permises

30 paires (toutes sauf « même camp » : pas les deux sur j = 1, ni les deux sur j = 3). Contrôle croisé avec `PM.controles` : 30 paires sans alerte « carrefours_meme_cote ».

| Paire de carrefours | Écart D6 moyen (T) | Alerte D6 (T) | 5 contre 2 (T) | Écart D6 moyen (N) | Alerte D6 (N) | 5 contre 2 (N) |
|---|---|---|---|---|---|---|
| (1,1)+(1,2) | 1.24 | 0.1 % | 9.6 % | 1.25 | 0.9 % | 9.6 % |
| (1,1)+(2,2) | 1.36 | 0.8 % | 8.5 % | 1.37 | 1.6 % | 8.5 % |
| (1,1)+(3,2) | 1.14 | 0.0 % | 4.4 % | 1.14 | 0.0 % | 4.4 % |
| (1,1)+(1,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.5 % |
| (1,1)+(2,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.5 % |
| (1,1)+(3,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.4 % |
| (2,1)+(1,2) | 1.24 | 0.1 % | 9.6 % | 1.24 | 0.1 % | 9.6 % |
| (2,1)+(2,2) | 1.36 | 0.8 % | 8.5 % | 1.38 | 2.3 % | 8.5 % |
| (2,1)+(3,2) | 1.14 | 0.0 % | 4.4 % | 1.17 | 2.5 % | 4.4 % |
| (2,1)+(1,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.5 % |
| (2,1)+(2,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.5 % |
| (2,1)+(3,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.4 % |
| (3,1)+(1,2) | 1.24 | 0.1 % | 9.6 % | 1.24 | 0.1 % | 9.6 % |
| (3,1)+(2,2) | 1.36 | 0.8 % | 8.5 % | 1.38 | 2.3 % | 8.5 % |
| (3,1)+(3,2) | 1.14 | 0.0 % | 4.4 % | 1.17 | 2.5 % | 4.4 % |
| (3,1)+(1,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.5 % |
| (3,1)+(2,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.5 % |
| (3,1)+(3,3) | 0.58 | 0.0 % | 4.4 % | 0.58 | 0.0 % | 4.4 % |
| (1,2)+(2,2) | 0.63 | 0.0 % | 0.0 % | 0.68 | 2.2 % | 0.0 % |
| (1,2)+(3,2) | 0.42 | 0.0 % | 0.0 % | 0.42 | 0.0 % | 0.0 % |
| (1,2)+(1,3) | 1.16 | 0.0 % | 4.9 % | 1.19 | 2.7 % | 5.1 % |
| (1,2)+(2,3) | 1.16 | 0.0 % | 4.9 % | 1.18 | 2.6 % | 5.1 % |
| (1,2)+(3,3) | 1.16 | 0.0 % | 4.9 % | 1.16 | 0.0 % | 4.9 % |
| (2,2)+(3,2) | 0.64 | 0.0 % | 0.0 % | 0.67 | 1.9 % | 0.0 % |
| (2,2)+(1,3) | 1.36 | 0.7 % | 8.4 % | 1.38 | 2.6 % | 8.5 % |
| (2,2)+(2,3) | 1.36 | 0.7 % | 8.4 % | 1.37 | 2.2 % | 8.5 % |
| (2,2)+(3,3) | 1.36 | 0.7 % | 8.4 % | 1.36 | 1.1 % | 8.4 % |
| (3,2)+(1,3) | 1.22 | 0.0 % | 7.9 % | 1.22 | 0.0 % | 7.9 % |
| (3,2)+(2,3) | 1.22 | 0.0 % | 7.9 % | 1.22 | 0.0 % | 7.9 % |
| (3,2)+(3,3) | 1.22 | 0.0 % | 7.9 % | 1.22 | 0.5 % | 7.9 % |

Histogramme de l'écart D6, toutes paires, villes traversables :
```
valeur |       n |      % |
     0 |    5355 |  17.9 % | #########
     1 |   19947 |  66.5 % | #################################
     2 |    4650 |  15.5 % | ########
     3 |      48 |   0.2 % | 
```
Toutes paires, villes non traversables :
```
valeur |       n |      % |
     0 |    5351 |  17.8 % | #########
     1 |   19908 |  66.4 % | #################################
     2 |    4460 |  14.9 % | #######
     3 |     266 |   0.9 % | 
     4 |      15 |   0.1 % | 
```
## 3. Écart D6 selon le tirage des apparitions

J1 occupe (1,0) et (2,0), J2 occupe (1,3) et (2,3). Avec 2 exemplaires de A1 et 2 de A2, les cas sont : A1A1 contre A2A2 (ou l'inverse), ou A1A2 contre A1A2 en symétrie centrale ((1,0) et (2,3) identiques) ou en miroir ((1,0) et (1,3) identiques).

| Tirage | Plateaux | Écart D6 moyen, défaut (T) | Alerte D6, défaut | 5 contre 2, défaut | Écart D6 moyen, toutes paires | Alerte D6, toutes paires | 5 contre 2, toutes paires |
|---|---|---|---|---|---|---|---|
| A1A1 contre A2A2 | 335 | 0.44 | 0.0 % | 0.0 % | 1.00 | 0.2 % | 6.5 % |
| A1A2 contre A1A2, miroir | 337 | 0.41 | 0.0 % | 0.0 % | 0.98 | 0.1 % | 4.7 % |
| A1A2 contre A1A2, symétrie centrale | 328 | 0.43 | 0.0 % | 0.0 % | 0.96 | 0.2 % | 5.9 % |

## 4. Sensibilité par modèle

Pour chaque modèle : plateaux où il est posé / non posé, écart D6 moyen (moyenne sur les 30 paires, villes traversables) et part de configurations avec 5 contre 2 ou avec au moins une alerte (D6, 5 contre 2, apparition lointaine). A1 et A2 sont posés sur tous les plateaux (2 exemplaires chacun) : pas de comparaison possible, voir la mesure 3.

| Modèle | Plateaux avec | Écart moyen avec | Écart moyen sans | Différence | 5 contre 2 avec | 5 contre 2 sans | Au moins une alerte avec | Au moins une alerte sans |
|---|---|---|---|---|---|---|---|---|
| C1 | 679 | 0.96 | 1.02 | -0.05 | 4.6 % | 8.0 % | 4.6 % | 8.0 % |
| C2 | 668 | 0.99 | 0.96 | +0.03 | 5.4 % | 6.2 % | 5.4 % | 6.2 % |
| C3 | 659 | 0.98 | 0.98 | +0.00 | 6.0 % | 5.2 % | 6.0 % | 5.2 % |
| C4 | 638 | 0.99 | 0.96 | +0.03 | 6.3 % | 4.7 % | 6.3 % | 4.7 % |
| C5 | 669 | 0.97 | 0.99 | -0.02 | 6.0 % | 5.0 % | 6.0 % | 5.0 % |
| C6 | 687 | 0.98 | 0.98 | +0.00 | 5.9 % | 5.2 % | 5.9 % | 5.2 % |
| K1 | 797 | 0.98 | 0.99 | -0.01 | 5.4 % | 6.7 % | 5.5 % | 6.7 % |
| K2 | 792 | 0.98 | 0.98 | +0.00 | 5.9 % | 4.7 % | 6.0 % | 4.7 % |
| K3 | 799 | 0.98 | 0.98 | +0.00 | 5.7 % | 5.7 % | 5.7 % | 5.7 % |
| K4 | 817 | 0.97 | 1.00 | -0.03 | 5.5 % | 6.6 % | 5.5 % | 6.6 % |
| K5 | 795 | 0.99 | 0.96 | +0.03 | 5.9 % | 4.9 % | 5.9 % | 5.0 % |
| B1 | 807 | 0.98 | 0.98 | -0.00 | 5.8 % | 5.1 % | 5.8 % | 5.1 % |
| B2 | 815 | 0.98 | 0.98 | -0.00 | 5.7 % | 5.6 % | 5.7 % | 5.6 % |
| B3 | 812 | 0.98 | 0.99 | -0.01 | 5.6 % | 6.3 % | 5.6 % | 6.3 % |
| B4 | 781 | 0.98 | 0.98 | +0.00 | 5.8 % | 5.4 % | 5.8 % | 5.4 % |
| B5 | 785 | 0.98 | 0.97 | +0.01 | 5.6 % | 6.1 % | 5.6 % | 6.1 % |
| A1 | 1000 | 0.98 | (toujours posé) | | 5.7 % | | 5.7 % | |
| A2 | 1000 | 0.98 | (toujours posé) | | 5.7 % | | 5.7 % | |

## 5. Tempo (villes traversables)

Mesuré sur toutes les configurations (30000 mesures). Nombre moyen de villes atteignables en au plus n pas :

| Pas | Joueur 1 | Joueur 2 |
|---|---|---|
| ≤ 3 | 3.61 | 3.61 |
| ≤ 4 | 4.47 | 4.48 |
| ≤ 5 | 4.86 | 4.84 |

Villes à égalité de distance : 1.10 en moyenne sur 7.

Distance de la première ville, joueur 1 :
```
valeur |       n |      % |
     2 |   30000 | 100.0 % | ##################################################
```
Distance de la première ville, joueur 2 :
```
valeur |       n |      % |
     2 |   30000 | 100.0 % | ##################################################
```
Écart sur la première ville :
```
valeur |       n |      % |
     0 |   30000 | 100.0 % | ##################################################
```
## 6. Goulets (placement par défaut)

Mesuré par joueur et par plateau (2000 cas par mode). Chemins sans case commune (hors les cases d'apparition, points de départ) entre les apparitions d'un joueur et chaque ville ; une ville a au plus 4 ports. Points d'articulation : case ou jeton dont le retrait coupe au moins une ville de toutes les apparitions du joueur.

**Villes traversables.** Minimum, sur les 7 villes, du nombre de chemins disjoints :
```
valeur |       n |      % |
     3 |    2000 | 100.0 % | ##################################################
```
Nombre de chemins disjoints, toutes villes :
```
valeur |       n |      % |
     3 |    5699 |  40.7 % | ####################
     4 |    8301 |  59.3 % | ##############################
```
Points d'articulation : au moins un dans 0.0 % des cas ; un point qui coupe au moins 2 villes dans 0.0 % ; nombre moyen par cas 0.00.

**Villes non traversables.** Minimum, sur les 7 villes, du nombre de chemins disjoints :
```
valeur |       n |      % |
     3 |    2000 | 100.0 % | ##################################################
```
Nombre de chemins disjoints, toutes villes :
```
valeur |       n |      % |
     3 |    6087 |  43.5 % | ######################
     4 |    7913 |  56.5 % | ############################
```
Points d'articulation : au moins un dans 0.0 % des cas ; un point qui coupe au moins 2 villes dans 0.0 % ; nombre moyen par cas 0.00.

## 7. Diversité des profils de distances

Profil = « D1 trié | D2 trié » (7 distances par joueur).

| Mesure | Profils distincts | Plus fréquent |
|---|---|---|
| Placement par défaut (1,2)+(3,2), sur 1000 plateaux | 114 | 86 (8.6 %) |
| Même mesure, joueurs non ordonnés | 72 | 105 |
| Distances d'un seul joueur (D triées) | 19 | 492 (24.6 %) |
| Toutes les configurations (30000) | 1916 | 413 (1.4 %) |

## 8. Sortie du générateur

Non mesurée ici : voir `mesurer(entrees, { paires: 'fixe' })` et `rediger(stats)` exportés par ce script.

## 9. Le seuil « écart > 2 » discrimine-t-il ?

| Part des configurations avec écart ≥ | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Placement par défaut | 42.2 % | 0.1 % | 0.0 % | 0.0 % |
| Toutes les paires | 82.2 % | 15.7 % | 0.2 % | 0.0 % |

Écart moyen par rang (placement par défaut / toutes les paires) :

| Rang | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| Défaut | 0.00 | 0.00 | 0.00 | 0.42 | 0.42 | 0.28 | 0.47 |
| Toutes paires | 0.00 | 0.00 | 0.77 | 0.65 | 1.40 | 0.35 | 0.48 |

Autre indicateur à titre de comparaison : somme des écarts sur les 7 rangs (placement par défaut) :
```
valeur |       n |      % |
     0 |     166 |  16.6 % | ########
     1 |     348 |  34.8 % | #################
     2 |     276 |  27.6 % | ##############
     3 |     165 |  16.5 % | ########
     4 |      34 |   3.4 % | ##
     5 |       7 |   0.7 % | 
     6 |       3 |   0.3 % | 
     7 |       1 |   0.1 % | 
```

## Constats (1000 plateaux, graine 20261015)

Faits relevés dans les tableaux ci-dessus.

- **Reproduction** : avec le placement (1,2)+(3,2), écart D6 moyen 0,42, pire écart 2 (1 plateau), 0 alerte « 5 contre 2 » ; avec (2,1)+(2,3), 44 « 5 contre 2 » sur 1000 et 12 plateaux à l'écart 2. Mêmes valeurs que `tests/catalogue.test.js`, qui valide l'implémentation de `PM.graphe`.
- **Villes non traversables** : aucun changement sur le placement par défaut (mêmes histogrammes, écart maximal 2). Sur les 30 paires, la part d'écart > 2 passe de 0,2 % (48 configurations sur 30000) à 0,9 % (281), avec un écart maximal de 4 (15 configurations) ; « 5 contre 2 » reste à 5,7 %. Les flancs ne sont jamais plus courts que le centre (flanc moins centre : +1,55 pas, villes traversables ; +2,59 pas, non traversables). L'écart minimal entre deux villes reste 3 pas dans les deux modes.
- **Paires de carrefours** : seules (1,2)+(2,2), (1,2)+(3,2) et (2,2)+(3,2) ont 0 % de « 5 contre 2 » ; toutes les autres paires en ont entre 4,4 % et 9,6 % (le maximum à 9,6 % pour (1,1)+(1,2), (2,1)+(1,2) et (3,1)+(1,2)). Les alertes D6 (> 2) ne dépassent 1 % sur aucune paire en villes traversables.
- **Seuil « écart > 2 »** : il ne se déclenche presque jamais (0,1 % sur le placement par défaut, 0,2 % sur toutes les paires). Part des écarts ≥ 1 : 42,2 % (défaut) et 82,2 % (toutes paires) ; ≥ 2 : 0,1 % et 15,7 %. L'alerte « 5 contre 2 » (5,7 % sur toutes les paires) est l'alerte qui se déclenche réellement.
- **Écart par rang** : aux rangs 1 à 3 l'écart moyen est 0,00 pour le placement par défaut (rangs 1 et 2 : 0,00 aussi sur toutes les paires). Pour le placement par défaut, l'écart sur les rangs 1 à 4 est donc porté par le rang 4. Chaque joueur a toujours sa première ville à 2 pas (30000 configurations sur 30000), l'écart sur la première ville est toujours 0.
- **Tirage des apparitions** : écart moyen au placement par défaut 0,44 (A1A1 / A2A2), 0,41 (A1A2 miroir), 0,43 (A1A2 symétrie centrale) ; sur toutes les paires 1,00 / 0,98 / 0,96. « 5 contre 2 » sur toutes les paires : 6,5 % / 4,7 % / 5,9 %. Alertes D6 : 0,1 % à 0,2 % dans les trois cas.
- **Modèles** : l'écart moyen avec ou sans un modèle diffère de 0,05 au plus (C1 : −0,05). Le seul écart marqué porte sur « 5 contre 2 » : 4,6 % avec C1 contre 8,0 % sans ; pour les autres modèles la différence va de −1,3 à +1,6 point. A1 et A2 sont posés sur tous les plateaux.
- **Tempo** : villes atteignables en au plus 3 / 4 / 5 pas : 3,61 / 4,47 / 4,86 pour J1 et 3,61 / 4,48 / 4,84 pour J2 ; 1,10 ville à égalité en moyenne.
- **Goulets** : au moins 3 chemins disjoints entre les apparitions d'un joueur et chaque ville (40,7 % des couples à 3, 59,3 % à 4) ; aucun point d'articulation sur 2000 cas, villes traversables ou non.
- **Diversité** : 114 profils distincts sur 1000 plateaux au placement par défaut (le plus fréquent : 8,6 %) ; 72 si l'on ignore quel joueur est lequel ; 19 suites de distances distinctes pour un joueur, la plus fréquente représentant 24,6 % des cas. 1916 profils sur les 30000 configurations.
- Aucune ville inaccessible, aucune apparition à plus de 7 pas de toute ville dans l'échantillon.

## Points à soumettre à l'advisor design de jeu

1. **Pouvoir discriminant du critère D6.** L'alerte « écart > 2 » est quasi muette ; au placement par défaut l'écart est nul aux rangs 1 à 3 sur les 1000 plateaux, seul le rang 4 varie. Faut-il garder le seuil, comparer d'autres rangs (5 à 7), ou considérer que le catalogue est équilibré par construction ?
2. **Villes traversables ou non.** Le choix de règle change le taux d'écart > 2 sur les autres paires (0,2 % contre 0,9 %, écart jusqu'à 4). Quelle règle de jeu est retenue ?
3. **Paires de carrefours.** Trois paires sur 30 évitent tout « 5 contre 2 ». La règle du générateur (paire par défaut, autre paire si aucune alerte) est cohérente avec ces chiffres ; l'ouverture du mode manuel à toutes les paires expose à 4,4 % à 9,6 % de « 5 contre 2 ».
4. **Variété de jeu.** Un joueur voit presque toujours l'une des 19 suites de distances, dont une dans un quart des cas ; la variété vient surtout des chemins, pas des distances. Est-ce suffisant ?
5. **Règle sur les apparitions.** Les écarts selon le tirage (0,96 à 1,00 sur toutes les paires) ne justifient pas à eux seuls une règle de symétrie centrale ; la différence de « 5 contre 2 » (4,7 % à 6,5 %) reste à interpréter.
6. **C1.** Moins de « 5 contre 2 » quand C1 est posée (4,6 % contre 8,0 %) : effet à confirmer sur un autre tirage avant d'en tirer une conséquence.
7. **Première ville** toujours à 2 pas : aucun tempo différentiel dans l'ouverture, à confirmer comme voulu.
8. **Goulets** : aucun point d'articulation et au moins 3 chemins disjoints ; le « mur » de C6 n'a pas d'effet mesurable sur ces indicateurs.
