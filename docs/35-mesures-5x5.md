# Mesures du catalogue 5×5 : 1000 plateaux (sous-agent des mesures, Sonnet 5.5), 2026-10-17

Sources : `docs/28` § 6 (mesures demandées, seuils provisoires), `docs/34` (générateur 5×5 et trois arbitrages), `docs/24`, `docs/18`. Ce document est produit par `node outils/mesures-5x5.js tout [dossier de cache] [fichier]` (8 processus en parallèle, environ 6 minutes : collecte puis rapport ; graine fixe 20261017, 1000 plateaux, résultat identique à l'octet près), ou en deux temps par `node outils/mesures-5x5.js collecte …` puis `node outils/mesures-5x5.js rapport <dossier>`. Les paragraphes « Constats », « Seuils proposés » et « Recommandations sur les trois arbitrages » sont rédigés à la main (fichier `outils/constats-5x5.md`, repris en tête par le script) et valent pour ce tirage de référence ; les tableaux de la dernière partie sont générés. **Aucun seuil du code n'est modifié** : l'advisor design de jeu valide d'abord.

Trois familles : **générateur** (1000 appels à `generer`, options par défaut, 200 candidats), **placements admissibles** (tous les placements 2-3-2 sur jonctions à 3 ports au moins des 1000 plateaux tirés et orientés, avant filtre d'équilibre) et **pose libre** (les 2016 placements 2-3-2 sans exigence de ports ; échantillon de 40 par plateau, soit 40 000 configurations : c'est ce que fait un utilisateur qui pose ses villes à la main). Le S du générateur est tronqué (rejet S ≥ 5) et choisi au meilleur parmi 200 candidats : il ne sert pas à fixer un seuil, la pose libre oui.

## 1. Constats

1. **Cases, ports, jonctions : tenus.** 77 cases (49 % des plateaux tirés, 37 % du générateur) ou 78 (51 %, 63 %), moyenne 77,5 à 77,6 : 100 % dans 75 ± 3, mais en haut de la plage (72 + nB1, avec 5 ou 6 B1). 39 ou 40 ports. **Aucune jonction à moins de 2 ports** (0 sur 16 000) ; 7 jonctions à 3 ports ou plus (nB1 = 5) ou 8 (nB1 = 6). Les villes du générateur sont à 100 % sur des jonctions à 3 ports ou plus ; en pose libre seulement 47,8 % des villes le sont, et 0,1 % des 2016 placements sont admissibles (la préférence « 3 ports aux villes » ne se tient pas sans l'orientation du générateur).
2. **Écart entre villes : 4 pas sur 1000 plateaux sur 1000**, aucune exception (minorant sur les jonctions toutes en cases, donc valable pour tout placement).
3. **Le choix du placement est très étroit.** Les placements admissibles sont **1** (47,8 % des plateaux), **3** (27,9 %) ou **4** (22,4 %), jamais 2 ; aucun pour 1,9 %. Avec 5 B1 : 0,98 placement par plateau ; avec 6 B1 : 3,40. Le « meilleur S parmi 2016 placements » est donc en pratique un choix entre 1 et 4 placements, et c'est l'orientation qui décide presque tout. Taux précis, sur les 205 853 essais du générateur : « villes_ports » (aucun placement admissible) 1,1 %, « desequilibre » 1,2 %, « score_s » 0,6 %, soit environ 2,9 % de rejets au total. Sur les 1000 plateaux tirés, ce n'est qu'une estimation bruitée : 19 sans placement admissible (1,9 %) et 38 sans placement valide (3,8 %, S ≥ 5 compris).
4. **Équilibre du générateur : très serré.** S = 0 (48,7 %) ou 1 (51,3 %), jamais plus ; écart par rang 0 aux rangs 1, 2 et 4, 1 pas au plus ailleurs ; 0 % de « 5 contre 2 », 0 % de « 4 contre 3 » (87,6 % de « 3 contre 3 + 1 ville équidistante », 12,4 % de « 3 contre 2 + 2 équidistantes ») ; première ville à 2 pas des deux joueurs dans 100 % des cas. Sans le tri du générateur (placements admissibles tirés au hasard) : S moyen 1,99, 95e centile 4, maximum 5 ; « 4 contre 3 » 77,8 % ; « 5 contre 2 » 1,5 %.
5. **Pose libre : le « 5 contre 2 » est le vrai danger.** 6,9 % des configurations (blocage), contre 0 % pour le générateur. Hors blocage : S moyen 2,55, médian 3, 90e centile 4, **95e centile 5**, 99e centile 5 ; S ≥ 4 : 20,9 % ; S ≥ 5 : 5,6 % ; S ≥ 6 : 0,9 % ; S ≥ 7 : 0,1 %. Écart max : 2 pas dans 7,2 %, **jamais 3** (les seuils « écart > 2 » et « écart > 3 » ne se déclenchent jamais avec ce catalogue). Première ville inégale : 0,1 %. Tout plateau a au moins un placement libre qui passe tous les filtres (meilleur S libre : 0 pour 95,2 % des plateaux, 1 pour 4,7 %, 2 pour 0,1 %).
6. **Tempo : plus lent qu'en 4×4, plus rapide que l'estimation.** Villes atteignables en au plus 3 pas : 4,75 sur 7 (générateur), 4,52 (admissibles), 4,17 (pose libre), contre 5,7 en 4×4 et 3,6 estimé par docs/28 ; en 4 pas : 5,99 ; en 5 pas : 7. La première ville est à 2 pas des deux joueurs dans 100 % des cas.
7. **Autoroute du pourtour : plus faible qu'en 4×4, mais réelle.** Jusqu'à la rangée de jonctions adverse : 4,2 pas en moyenne par le pourtour (4 à 6) contre 5,0 par le centre (toujours 5), contre 3,0 et 4,8 en 4×4. Avec toutes les jonctions en villes, le pourtour est plus court que le centre dans 89,2 % des mesures (95,5 % pour les plateaux du générateur). Une apparition verte et une rouge sont toujours à 2 pas (par la rangée neutre ; 1 pas en 4×4). Symétrique, sans effet sur S. (`PM.graphe.flancs` prend les colonnes 1 et 3 comme « centre » en 5×5, la colonne 2 est oubliée : les mesures utilisent leurs propres sous-graphes ; `src/graphe.js` n'est pas modifié.)
8. **Goulets : aucun.** Aucun point d'articulation (0 % des cas), toujours au moins 2 chemins disjoints vers chaque ville (générateur : minimum de 2 dans 67,3 % des cas, 3 dans 32,8 %). Raccords morts : 0 (pas de mur dans le catalogue 5×5), jonctions mal reliées : 0.
9. **Diversité : bonne en plateaux, faible en équilibre.** 1000 plateaux distincts sur 1000, 74 compositions (nombre de chaque modèle), 5,96 modèles distincts par plateau (sur 6 modèles). Mais seulement **25 profils de distances** distincts sur 1000 plateaux du générateur (S ∈ {0, 1}) et 332 placements de villes distincts : les parties diffèrent par la forme du plateau, pas par l'équilibre.
10. **Rejets du générateur** (205 853 essais à 200 candidats) : « desequilibre » 1,2 %, « villes_ports » 1,1 %, « score_s » 0,6 %, tout le reste 0 (aucun « jonction_ports », aucune connexité, aucun « villes_proches » : il n'y en a pas à rejeter puisque l'écart est toujours de 4 pas). À 1 candidat : 96,4 % acceptés.
11. **Sensibilité par modèle.** Les 9 centrales sont des C7 ou des C8 (C8 × k = C7 × (9 − k)). Plus de C7 (6 ou 7 sur 9) réduit la part de plateaux avec placement valide (92,8 % et 89,8 % contre 98,5 % à 4 C7 sur 9), sans effet net sur S moyen (1,9 à 2,2) ni sur « 5 contre 2 » (0 à 3 %). Les 5 B1 donnent 0,98 placement admissible par plateau, les 6 B1 en donnent 3,40 (effet principal du nombre de B1). B7 / B7m : pas d'effet monotone net sur S.

## 2. Seuils 5×5 proposés (à valider par l'advisor design de jeu)

Les chiffres sont ceux de la **pose libre hors blocages** (40 000 configurations de 1000 plateaux), la référence pour la pose manuelle ; entre parenthèses, les placements admissibles et le générateur.

| Critère | Seuil proposé | Part touchée (pose libre) | Argument |
|---|---|---|---|
| « 5 contre 2 » | **blocage** (inchangé) | 6,9 % (admissibles 1,5 % ; générateur 0 %) | Évitable à coup sûr (le générateur ne le produit jamais) ; c'est le seul critère qui discrimine fortement. |
| Écart max > 3 | **blocage** (inchangé) | 0 % | Filet pour les tuiles libres ; jamais déclenché par le catalogue. |
| Écart max > 2 | **alerte** (inchangé) | 0 % | Idem. Un écart de 2 pas touche 7,2 % : bruit. |
| **S ≥ 5** | **alerte** (inchangé : le 95e centile est 5, il ne passe donc pas à 6) | 5,6 % (0,8 % ; 0 %) | Le 95e centile hors blocage vaut 5 ; la règle de docs/28 (passer à 6 si plus de 10 % des plateaux dépassent) ne s'applique pas : S ≥ 5 touche 5,6 % (7,7 % avec les blocages), S ≥ 6 touche 0,9 %. |
| S = 4 | **information** (inchangé) | 15,3 % de S = 4 (S ≥ 4 : 20,9 %) | Trop fréquent pour une alerte. |
| Première ville inégale | **alerte** (inchangé) | 0,1 % | Filet. |
| Jonction à moins de 2 ports | **alerte** (inchangé) | 0 % | Garanti par l'orientation ; utile pour les tuiles libres. |
| « 4 contre 3 » | aucune alerte (inchangé) | 64,3 % (générateur 0 %) | Partage normal de 7 villes. |
| Ville sur une jonction à moins de 3 ports | **information éventuelle**, pas d'alerte | 52 % des villes en pose libre | Préférence de docs/28, inatteignable sans orientation : ne pas en faire une alerte (hors périmètre ici, à décider). |
| Tempo (villes à ≤ 3 pas) | information | 4,2 sur 7 (générateur 4,75) | Plus lent qu'en 4×4 (5,7) ; pas de seuil. |

Conclusion : **les seuils provisoires repris du 4×4 conviennent sans changement** pour le 5×5. Seuls « 5 contre 2 » et S ≥ 5 agissent réellement ; les autres sont des filets qui ne se déclenchent pas avec ce catalogue.

## 3. Recommandations sur les trois arbitrages de docs/34

1. **S ≥ 5 en rejet dans le générateur : à garder.** Coût : 0,6 % des essais à 200 candidats (0,8 % à 1 candidat) et 7 plateaux sur 1000 sans placement valide (96,2 % contre 96,9 % de plateaux valides). Le meilleur S étant toujours choisi, le rejet ne joue que sur les plateaux dont aucun placement ne descend sous S = 5 : sans lui, 0,7 % des plateaux seraient rendus avec une alerte « S ≥ 5 ». Garder le rejet assure qu'un plateau généré ne porte jamais l'alerte de l'interface. Retirer le rejet serait aussi défendable (effet minime).
2. **B1 systématiques sur (0,2) et (4,2) : à garder.** Le contrefactuel « B1 libres » est moins bon sans gagner en variété : plateaux sans placement admissible 7,3 % contre 1,9 %, sans placement valide 7,6 % contre 3,8 %, S moyen des admissibles 2,08 contre 1,99 ; variété identique (1000 plateaux distincts sur 1000 dans les deux cas, 82 compositions contre 77, 5,95 modèles distincts par plateau contre 5,97). Seul avantage des B1 libres : « 5 contre 2 » plus rare parmi les admissibles (0,2 % contre 1,5 %), sans conséquence puisque le générateur filtre.
3. **Position de la 7e ville et tendance vers les flancs : constat confirmé, à soumettre.** Quand il n'y a qu'une seule ville équidistante (la 7e ; 87,6 % des plateaux du générateur), elle est **toujours** sur l'un des quatre flancs du milieu (1,2) (1,3) (4,2) (4,3) et **jamais** sur les quatre jonctions centrales (la répartition gauche / droite, 53 % / 47 %, est dans le bruit d'échantillonnage, environ ± 1,7 point). Pour les 12,4 % de plateaux à deux villes équidistantes, la position n'est pas mesurée séparément. Plus généralement, les villes du générateur sont à 70,0 % sur les colonnes 1 et 4 (50 % pour un tirage uniforme parmi les 2016 placements) et seulement 7,1 % sur les 4 jonctions centrales (21,4 % en uniforme). La tendance vient d'abord de la **structure des ports** : les jonctions centrales n'ont des ports que par les 4 centrales (25 à 28 % des plateaux à 3 ports ou plus, contre 40 à 65 % sur le pourtour), si bien que, parmi les placements admissibles, 63,3 % des villes sont déjà sur les flancs et 13,8 % sur le centre ; le choix du meilleur S parmi 1 à 4 placements ajoute peu (63,7 %), le tirage de 200 candidats ajoute le reste (70,0 %). **Qualité de chaque position** (point 5 de docs/28) : en pose libre, une ville sur n'importe laquelle des 16 jonctions donne le même équilibre (S moyen 2,64 à 2,71, S ≥ 5 de 7,0 à 8,5 %, 5 contre 2 de 6,4 à 7,3 %, à comparer à 2,66 / 7,7 % / 6,9 %) ; parmi les placements admissibles, une ville sur une des 4 jonctions centrales est un peu moins équilibrée (S moyen 2,11 à 2,17 contre 1,90 à 2,04 ailleurs), ce qui explique en partie que le tri au meilleur S écarte légèrement le centre. Le centre n'est donc pas pénalisant en soi : la tendance vient surtout des ports. Recommandation : accepter pour l'instant (la zone centrale reste une zone de passage, la ville disputée est un flanc symétrique) et la signaler à l'advisor design de jeu comme caractéristique du plateau 5×5, à discuter avec les « régions thématiques » de docs/25 ; rien à coder.

## 4. Conseil propre au 5×5 pour « 5 contre 2 » (graphe.js l'attend « après mesure »)

En pose libre, ce qui décide du « 5 contre 2 » est la **répartition des 3 villes du milieu entre les rangées j = 2 et j = 3** : 3 sur une seule rangée donne 47,8 % à 49,6 % de « 5 contre 2 » (S moyen 3,5, S ≥ 5 : 20 %) ; 2 + 1 ou 1 + 2 en donne 0 % (S moyen 2,5, S ≥ 5 : 5 à 6 %). Conseil à afficher : « répartir les 3 villes du milieu sur les deux rangées (2 + 1 ou 1 + 2) ». Non codé (message de `src/graphe.js` laissé tel quel : à décider avec les seuils).

## 5. Points à signaler

- **Écart avec le générateur** : `candidat5x5` ne contrôle `villes_proches` que sur ses 12 meilleurs placements ; la mesure ne le rejoue pas (inutile : écart minimal de 4 pas, mesuré). Le générateur compte les raccords morts avec `raison !== 'absent'`, les mesures avec `raison === 'mort'` comme en 4×4 (0 dans les deux cas ici).
- **Placements admissibles = 3 ports au moins** (sens de `candidat5x5`), non élargi. La pose libre est un échantillon (40 par plateau) des 2016 placements, avec les comptes par filtre sur la totalité.
- Le catalogue réel (C7, C8, B1, B7, B7m, K2) est plus pauvre que le catalogue « P5 » modélisé dans docs/28 (9 modèles) : les chiffres sont à lire sur ce catalogue.
- Pistes hors périmètre, non réalisées : un 3e modèle de centrale ou de bord pour élargir la variété des profils d'équilibre (constat 9) ; un modèle de centrale avec plus de ports pour nourrir les jonctions centrales (arbitrage 3).

---

## Tableaux de mesure


Généré par `outils/mesures-5x5.js` + `outils/rapport-5x5.js` (graine 20261017). Catalogue réel `PM.catalogue.nouveauDocument('5x5')` : C7 ×6, C8 ×5, B1 ×6, B7 ×4, B7m ×4, K2 ×5 (6 modèles ; le catalogue P5 modélisé dans docs/28 est plus riche). **Aucun seuil du code n'est modifié.**

**Familles mesurées.**

- **Générateur** : 1000 appels à `PM.generateur.generer` (graines « m5-20261017-<n> »), **options par défaut** (200 candidats, tolérance 1 sur S), un plateau par graine : c'est ce que reçoit l'utilisateur. Le S de cette famille est **tronqué par le rejet S ≥ 5** et choisi au meilleur S parmi 200 candidats : il ne sert pas à fixer un seuil.
- **Plateaux tirés et orientés** : 1000 plateaux (graine 20261017) issus de `tuilesOrientees5x5` (modèles tirés, 5 ou 6 B1, orientation optimisée), sans ville ni filtre d'équilibre. Orientation impossible : 0 plateau(x). Sur chacun :
  - **placements admissibles** = les 7 villes en 2-3-2 sur des jonctions à **3 ports au moins** (même sens que `candidat5x5`) : tous sont mesurés ;
  - **pose libre** = les 2016 placements 2-3-2 **sans** exigence de ports, dont un échantillon de 40 tirés au hasard par plateau est conservé (pour la pose manuelle : on ne choisit pas toujours une jonction à 3 ports) ; les comptes par filtre portent sur les 2016.
- **Chaîne de filtres** rejouée comme dans le générateur : ville inaccessible (« I »), puis « 5 contre 2 » ou écart > 3 (« D », blocage), écart > 2 (« E »), première ville inégale (« P »), S ≥ 5 (« S »), « o » = passe tout. Le contrôle `villesProches` n'est pas rejoué placement par placement : l'écart minimal entre deux jonctions (toutes en cases) est mesuré par plateau (§ 1) et vaut au moins 4 pas, donc des villes non traversables ne peuvent être plus proches ; le générateur, lui, ne le vérifie que sur ses 12 meilleurs placements.
- **Contrefactuel** (arbitrage 2) : mêmes tirages sans forcer les B1 sur la rangée neutre.

Définitions : D(k) distance du rang k de villes depuis la case d'apparition la plus proche de chaque joueur, villes non traversables ; S = somme des |D1(k) − D2(k)| sur les rangs 1 à 7 ; « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus ; centile par le rang le plus proche (rang = ⌈p × n⌉ dans la liste triée). Cases d'un plateau = cases des 25 tuiles + 9 jonctions-cases. Pas de rendu navigateur ici : tout est calculé sur le graphe.

### 1. Plateaux : cases, ports, jonctions, écart entre villes

Cases par plateau (cible 75 ± 3, soit 72 à 78) : générateur 77.63 en moyenne, 100.0 % dans la cible ; plateaux tirés 77.51, 100.0 % dans la cible. (cases = 72 + nB1 : seules les valeurs 77 et 78 sortent, voir tests/generateur-5x5.test.js.)

Cases, plateaux du générateur :
```
valeur |       n |      % |
    77 |     372 |  37.2 % | ###################
    78 |     628 |  62.8 % | ###############################
```
Cases, plateaux tirés et orientés :
```
valeur |       n |      % |
    77 |     490 |  49.0 % | #########################
    78 |     510 |  51.0 % | ##########################
```
Ports par plateau (34 + nB1), plateaux tirés :
```
valeur |       n |      % |
    39 |     490 |  49.0 % | #########################
    40 |     510 |  51.0 % | ##########################
```
Ports par jonction (16 jonctions × plateaux tirés) :
```
valeur |       n |      % |
     2 |    8490 |  53.1 % | ###########################
     3 |    7510 |  46.9 % | #######################
```
Jonctions à 3 ports ou plus par plateau, générateur :
```
valeur |       n |      % |
     7 |     372 |  37.2 % | ###################
     8 |     628 |  62.8 % | ###############################
```
Jonctions à 3 ports ou plus par plateau, plateaux tirés :
```
valeur |       n |      % |
     7 |     490 |  49.0 % | #########################
     8 |     510 |  51.0 % | ##########################
```
Jonctions à moins de 2 ports : 0 sur 16000 (plateaux tirés), 0 sur 16000 (générateur).
Villes du générateur sur une jonction à 3 ports ou plus : 7000 sur 7000 (100.0 %).
Pose libre (échantillon) : 47.8 % des villes sont sur une jonction à 3 ports ou plus (hasard) ; 0.1 % des 2016 placements sont admissibles.

B1 par plateau (générateur) :
```
valeur |       n |      % |
     5 |     372 |  37.2 % | ###################
     6 |     628 |  62.8 % | ###############################
```
Écart minimal entre deux jonctions, toutes en cases (minorant de l'écart entre villes, exigence 4 pas) :
Générateur :
```
valeur |       n |      % |
     4 |    1000 | 100.0 % | ##################################################
```
Plateaux tirés :
```
valeur |       n |      % |
     4 |    1000 | 100.0 % | ##################################################
```
### 2. Placements 2-3-2 admissibles par plateau

Plateaux tirés : 1000. Sans placement admissible (« villes_ports ») : 19 (1.9 %). Nombre moyen : 2.21.
```
valeur |       n |      % |
     0 |      19 |   1.9 % | #
     1 |     478 |  47.8 % | ########################
     3 |     279 |  27.9 % | ##############
     4 |     224 |  22.4 % | ###########
```
Placements admissibles qui passent tous les filtres, par plateau :
```
valeur |       n |      % |
     0 |      38 |   3.8 % | ##
     1 |     467 |  46.7 % | #######################
     2 |       3 |   0.3 % | 
     3 |     280 |  28.0 % | ##############
     4 |     212 |  21.2 % | ###########
```
Plateaux sans placement valide (filtres complets, S ≥ 5 compris) : 38 (3.8 %) ; sans S comme rejet : 31.

Pose libre : sur les 1000 × 2016 placements, résultat de la chaîne de filtres :
| Code | Sens | Placements | Part |
|---|---|---|---|
| I | ville inaccessible | 0 | 0.0 % |
| D | 5 contre 2 ou écart > 3 (blocage) | 143532 | 7.1 % |
| E | écart > 2 | 0 | 0.0 % |
| P | première ville inégale | 1518 | 0.1 % |
| S | S ≥ 5 seul | 101080 | 5.0 % |
| o | passe tout | 1769870 | 87.8 % |

Meilleur S atteignable par plateau en pose libre (parmi les 2016, filtres complets) :
```
valeur |       n |      % |
     0 |     952 |  95.2 % | ################################################
     1 |      47 |   4.7 % | ##
     2 |       1 |   0.1 % | 
```
### 3. Score S

| Mesure | Générateur (200 candidats) | Admissibles, tous | Admissibles, hors blocages | Admissibles, retenu (1 par plateau) | Pose libre, échantillon | Pose libre, hors blocages |
|---|---|---|---|---|---|---|
| Configurations mesurées | 1000 | 2211 | 2178 | 962 | 40000 | 37232 |
| S moyen | 0.51 | 1.99 | 1.96 | 1.72 | 2.66 | 2.55 |
| S médian | 1 | 2 | 2 | 2 | 3 | 3 |
| S 90e centile | 1 | 3 | 3 | 3 | 4 | 4 |
| **S 95e centile** | 1 | 4 | 4 | 3 | 5 | 5 |
| S 99e centile | 1 | 4 | 4 | 4 | 6 | 5 |
| S maximal | 1 | 5 | 5 | 4 | 8 | 8 |
| S ≥ 4 | 0.0 % | 8.3 % | 7.5 % | 3.7 % | 24.7 % | 20.9 % |
| S ≥ 5 | 0.0 % | 0.9 % | 0.8 % | 0.0 % | 7.7 % | 5.6 % |
| S ≥ 6 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 1.4 % | 0.9 % |
| S ≥ 7 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.1 % | 0.1 % |

S, générateur (200 candidats, tronqué à S < 5) :
```
valeur |       n |      % |
     0 |     487 |  48.7 % | ########################
     1 |     513 |  51.3 % | ##########################
```
S, placements admissibles (tous) :
```
valeur |       n |      % |
     0 |      92 |   4.2 % | ##
     1 |     666 |  30.1 % | ###############
     2 |     834 |  37.7 % | ###################
     3 |     435 |  19.7 % | ##########
     4 |     165 |   7.5 % | ####
     5 |      19 |   0.9 % | 
```
S, placement retenu parmi les admissibles (1 par plateau, rejet de S ≥ 5 actif) :
```
valeur |       n |      % |
     0 |      64 |   6.7 % | ###
     1 |     366 |  38.0 % | ###################
     2 |     344 |  35.8 % | ##################
     3 |     152 |  15.8 % | ########
     4 |      36 |   3.7 % | ##
```
S, pose libre (échantillon de 40 placements par plateau) :
```
valeur |       n |      % |
     0 |    1234 |   3.1 % | ##
     1 |    5969 |  14.9 % | #######
     2 |   11398 |  28.5 % | ##############
     3 |   11521 |  28.8 % | ##############
     4 |    6815 |  17.0 % | #########
     5 |    2496 |   6.2 % | ###
     6 |     510 |   1.3 % | #
     7 |      54 |   0.1 % | 
     8 |       3 |   0.0 % | 
```
S, pose libre hors blocages :
```
valeur |       n |      % |
     0 |    1234 |   3.3 % | ##
     1 |    5969 |  16.0 % | ########
     2 |   11341 |  30.5 % | ###############
     3 |   10892 |  29.3 % | ###############
     4 |    5710 |  15.3 % | ########
     5 |    1749 |   4.7 % | ##
     6 |     303 |   0.8 % | 
     7 |      32 |   0.1 % | 
     8 |       2 |   0.0 % | 
```
### 4. Écart par rang (1 à 7)

**Générateur (200 candidats)** : écart |D1(k) − D2(k)| au rang k.

| Rang | Écart moyen | = 0 | = 1 | = 2 | = 3 | ≥ 4 |
|---|---|---|---|---|---|---|
| 1 | 0.00 | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| 2 | 0.00 | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| 3 | 0.08 | 92.0 % | 8.0 % | 0.0 % | 0.0 % | 0.0 % |
| 4 | 0.00 | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| 5 | 0.04 | 95.6 % | 4.4 % | 0.0 % | 0.0 % | 0.0 % |
| 6 | 0.21 | 79.3 % | 20.7 % | 0.0 % | 0.0 % | 0.0 % |
| 7 | 0.18 | 81.8 % | 18.2 % | 0.0 % | 0.0 % | 0.0 % |

**Admissibles, tous** : écart |D1(k) − D2(k)| au rang k.

| Rang | Écart moyen | = 0 | = 1 | = 2 | = 3 | ≥ 4 |
|---|---|---|---|---|---|---|
| 1 | 0.00 | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| 2 | 0.00 | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| 3 | 0.45 | 54.8 % | 45.2 % | 0.0 % | 0.0 % | 0.0 % |
| 4 | 0.31 | 68.7 % | 31.3 % | 0.0 % | 0.0 % | 0.0 % |
| 5 | 0.59 | 41.1 % | 58.9 % | 0.0 % | 0.0 % | 0.0 % |
| 6 | 0.36 | 63.5 % | 36.5 % | 0.0 % | 0.0 % | 0.0 % |
| 7 | 0.27 | 73.3 % | 26.7 % | 0.0 % | 0.0 % | 0.0 % |

**Pose libre, échantillon** : écart |D1(k) − D2(k)| au rang k.

| Rang | Écart moyen | = 0 | = 1 | = 2 | = 3 | ≥ 4 |
|---|---|---|---|---|---|---|
| 1 | 0.00 | 99.9 % | 0.1 % | 0.0 % | 0.0 % | 0.0 % |
| 2 | 0.11 | 88.5 % | 11.5 % | 0.0 % | 0.0 % | 0.0 % |
| 3 | 0.58 | 42.1 % | 57.9 % | 0.0 % | 0.0 % | 0.0 % |
| 4 | 0.34 | 65.8 % | 34.1 % | 0.0 % | 0.0 % | 0.0 % |
| 5 | 0.57 | 46.7 % | 50.0 % | 3.3 % | 0.0 % | 0.0 % |
| 6 | 0.51 | 49.6 % | 49.5 % | 1.0 % | 0.0 % | 0.0 % |
| 7 | 0.55 | 48.9 % | 47.6 % | 3.5 % | 0.0 % | 0.0 % |

### 5. Écart maximal (rangs 1 à 7)

| Mesure | Générateur (200 candidats) | Admissibles, tous | Admissibles, hors blocages | Admissibles, retenu (1 par plateau) | Pose libre, échantillon | Pose libre, hors blocages |
|---|---|---|---|---|---|---|
| Écart max ≥ 1 | 51.3 % | 95.8 % | 95.8 % | 93.3 % | 96.9 % | 96.7 % |
| Écart max ≥ 2 | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 7.5 % | 7.2 % |
| Écart max ≥ 3 (alerte > 2) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| Écart max ≥ 4 (blocage > 3) | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |

### 6. Partage des villes (« 5 contre 2 », « 4 contre 3 »)

| Mesure | Générateur (200 candidats) | Admissibles, tous | Admissibles, hors blocages | Admissibles, retenu (1 par plateau) | Pose libre, échantillon | Pose libre, hors blocages |
|---|---|---|---|---|---|---|
| « 5 contre 2 » ou pire | 0.0 % | 1.5 % | 0.0 % | 0.0 % | 6.9 % | 0.0 % |
| « 4 contre 3 » | 0.0 % | 77.8 % | 79.0 % | 75.7 % | 59.8 % | 64.3 % |
| Villes équidistantes (moyenne sur 7) | 1.12 | 0.33 | 0.34 | 0.37 | 0.61 | 0.65 |
| Aucune ville équidistante | 0.0 % | 68.7 % | 68.3 % | 65.6 % | 48.8 % | 45.0 % |
| Une ville équidistante | 87.6 % | 29.1 % | 29.5 % | 32.1 % | 41.9 % | 45.0 % |
| Deux ou plus | 12.4 % | 2.2 % | 2.2 % | 2.3 % | 9.3 % | 10.0 % |

Partage, générateur :
```
valeur |       n |      % |
3 contre 3 (+1 égalité) |     876 |  87.6 % | ############################################
3 contre 2 (+2 égalité) |     124 |  12.4 % | ######
```
Partage, pose libre (échantillon) :
```
valeur |       n |      % |
4 contre 2 (+1 égalité) |    7181 |  18.0 % | #########
3 contre 3 (+1 égalité) |    9579 |  23.9 % | ############
4 contre 3 |   16754 |  41.9 % | #####################
3 contre 2 (+2 égalité) |    3558 |   8.9 % | ####
5 contre 2 |    2768 |   6.9 % | ###
2 contre 2 (+3 égalité) |     160 |   0.4 % | 
```
### 7. Première ville et tempo

| Mesure | Générateur (200 candidats) | Admissibles, tous | Admissibles, hors blocages | Admissibles, retenu (1 par plateau) | Pose libre, échantillon | Pose libre, hors blocages |
|---|---|---|---|---|---|---|
| Première ville à la même distance | 100.0 % | 100.0 % | 100.0 % | 100.0 % | 99.9 % | 99.9 % |
| Première ville, vert : distance moyenne | 2.00 | 2.00 | 2.00 | 2.00 | 2.00 | 2.00 |
| Première ville, rouge : distance moyenne | 2.00 | 2.00 | 2.00 | 2.00 | 2.00 | 2.00 |

Nombre moyen de villes atteignables en au plus n pas (moyenne des deux joueurs ; en 4×4 : 5,7 sur 7 à 3 pas, 6,8 à 4 pas) :

| Mesure | Générateur (200 candidats) | Admissibles, tous | Pose libre, échantillon |
|---|---|---|---|
| ≤ 3 pas | 4.75 | 4.52 | 4.17 |
| ≤ 4 pas | 5.99 | 5.91 | 5.56 |
| ≤ 5 pas | 7.00 | 7.00 | 6.70 |
| ≤ 6 pas | 7.00 | 7.00 | 7.00 |
| ≤ 7 pas | 7.00 | 7.00 | 7.00 |

Première ville, distance du joueur vert (générateur) :
```
valeur |       n |      % |
     2 |    1000 | 100.0 % | ##################################################
```
### 8. Autoroute du pourtour

Distance d'une apparition d'un joueur à la rangée de jonctions du camp adverse (j = 4 pour le vert, j = 1 pour le rouge), sans ville, par le **pourtour** (tuiles des colonnes et rangées 0 et 4) ou par le **centre** (colonnes 1 à 3). Les raccourcis de coin et de bord relient les apparitions en anneau, mais la rangée 2 est neutre : une apparition verte et une rouge ne sont plus voisines.

Distance minimale entre une apparition verte et une rouge (graphe complet) :
Plateaux tirés :
```
valeur |       n |      % |
     2 |    1000 | 100.0 % | ##################################################
```
| Famille | Joueur | Voie | Moyenne | Minimum | Maximum |
|---|---|---|---|---|---|
| plateaux tirés | vert | pourtour | 4.22 | 4 | 6 |
| plateaux tirés | vert | centre | 5.00 | 5 | 5 |
| plateaux tirés | rouge | pourtour | 4.22 | 4 | 6 |
| plateaux tirés | rouge | centre | 5.00 | 5 | 5 |
| générateur | vert | pourtour | 4.09 | 4 | 6 |
| générateur | vert | centre | 5.00 | 5 | 5 |
| générateur | rouge | pourtour | 4.09 | 4 | 6 |
| générateur | rouge | centre | 5.00 | 5 | 5 |

Toutes les jonctions portent une ville (sous-graphes « flanc » : colonnes 0 et 4 + tuiles d'apparition des rangées 0 et 4 ; « centre » : colonnes 1 à 3 ; `PM.graphe.flancs` prend les colonnes 1 et 3 seulement en 5×5, d'où ce calcul propre aux mesures) :

| Famille | Villes | Mesures | Flanc plus court que le centre | Égal | Flanc − centre moyen |
|---|---|---|---|---|---|
| plateaux tirés | non traversables (règle) | 2000 | 89.2 % | 0.0 % | -0.78 |
| plateaux tirés | traversables (comparaison) | 2000 | 89.2 % | 0.0 % | -0.78 |
| générateur | non traversables (règle) | 2000 | 95.5 % | 0.0 % | -0.91 |
| générateur | traversables (comparaison) | 2000 | 95.5 % | 0.0 % | -0.91 |

### 9. Goulets et points d'articulation

Chemins sans case commune (hors apparitions) entre les apparitions d'un joueur et chaque ville ; articulation = case dont le retrait coupe au moins une ville de toutes les apparitions du joueur. Générateur : placement retenu ; plateaux tirés : un placement admissible tiré au hasard par plateau.

| Mesure | Générateur | Plateaux tirés |
|---|---|---|
| Cas (joueurs × plateaux) | 2000 | 1962 |
| Minimum de chemins disjoints = 1 | 0.0 % | 0.0 % |
| Minimum de chemins disjoints = 2 | 67.3 % | 53.9 % |
| Minimum de chemins disjoints ≥ 3 | 32.8 % | 46.1 % |
| Au moins un point d'articulation | 0.0 % | 0.0 % |
| Une articulation qui coupe 2 villes ou plus | 0.0 % | 0.0 % |
| Articulations par cas (moyenne) | 0.00 | 0.00 |

Chemins disjoints, toutes villes (générateur) :
```
valeur |       n |      % |
     2 |    1487 |  10.6 % | #####
     3 |   12513 |  89.4 % | #############################################
```
### 10. Raccords morts et jonctions mal reliées

Raccords morts (`raison = 'mort'`, comme en 4×4) : générateur 0.00 par plateau, plateaux tirés 0.00. Compte du générateur (tout sauf « absent ») : 0.00. Jonctions reliées par moins de 2 ports : 0 plateau(x) tiré(s), 0 du générateur.
```
valeur |       n |      % |
     0 |    1000 | 100.0 % | ##################################################
```
### 11. Diversité

| Mesure | Générateur | Plateaux tirés | Tirés, B1 libres |
|---|---|---|---|
| Plateaux | 1000 | 1000 | 1000 |
| Plateaux distincts (tuiles et rotations) | 1000 | 1000 | 1000 |
| Compositions distinctes (nombre de chaque modèle) | 74 | 82 | 77 |
| Modèles distincts par plateau (moyenne) | 5.96 | 5.95 | 5.97 |
| Profils de distances distincts (retenu / générateur) | 25 sur 1000 | 159 sur 962 | n/a |
| Placements de villes distincts (retenu / générateur) | 332 | 608 | n/a |

### 12. Rejets du générateur par cause

Options par défaut (200 candidats) : 1000 graines, 205853 essais, 1000 plateaux rendus ; 1 candidat, 1 essai par graine : 1000 graines, 964 acceptées (96.4 %).

| Cause | Rejets (200 candidats) | Part des essais | Rejets (1 candidat) | Part des essais |
|---|---|---|---|---|
| plateau_invalide | 0 | 0.0 % | 0 | 0.0 % |
| connexite | 0 | 0.0 % | 0 | 0.0 % |
| villes_proches | 0 | 0.0 % | 0 | 0.0 % |
| ville_inaccessible | 0 | 0.0 % | 0 | 0.0 % |
| desequilibre | 2421 | 1.2 % | 18 | 1.8 % |
| cinq_contre_deux | 0 | 0.0 % | 0 | 0.0 % |
| ecart | 0 | 0.0 % | 0 | 0.0 % |
| premiere_ville | 0 | 0.0 % | 0 | 0.0 % |
| jonction_ports | 0 | 0.0 % | 0 | 0.0 % |
| villes_ports | 2239 | 1.1 % | 10 | 1.0 % |
| score_s | 1193 | 0.6 % | 8 | 0.8 % |

### 13. Arbitrage 1 : effet du rejet S ≥ 5

| Mesure | Rejet S ≥ 5 actif | S seulement comme classement |
|---|---|---|
| Plateaux avec un placement valide | 962 (96.2 %) | 969 (96.9 %) |
| S du placement retenu (moyenne) | 1.72 | 1.74 |
| S du placement retenu ≥ 5 | 0.0 % | 0.7 % |
| S du placement retenu ≥ 4 | 3.7 % | 4.4 % |

Le rejet n'a d'effet que sur les plateaux dont aucun placement admissible ne descend sous S = 5 (le meilleur S est toujours choisi, donc un placement à S < 5 passe avant tout placement à S ≥ 5) : 7 plateau(x) sur 1000, qui seraient rendus avec S ≥ 5 au lieu d'être rejetés au tirage. Cause « score_s » : 0.6 % des essais à 200 candidats, 0.8 % à 1 candidat. Parmi les placements admissibles hors blocage, S ≥ 5 touche 0.8 % ; en pose libre hors blocage, 5.6 %.

### 14. Arbitrage 2 : B1 forcés sur la rangée neutre ou libres

« Forcés » : situation actuelle (B1 d'abord sur (0,2) et (4,2)). « Libres » : les 5 ou 6 B1 sont répartis au hasard sur les 12 bords (contrefactuel : le générateur n'est pas modifié).

| Mesure | B1 forcés (neutre) | B1 libres |
|---|---|---|
| Plateaux tirés / sans orientation | 1000 / 0 | 1000 / 0 |
| B1 sur les deux bords neutres | 100.0 % | 20.6 % |
| Placements admissibles par plateau | 2.21 | 2.03 |
| Plateaux sans placement admissible | 1.9 % | 7.3 % |
| Plateaux sans placement valide (filtres complets) | 3.8 % | 7.6 % |
| Jonctions à 3 ports ou plus (moyenne) | 7.51 | 7.49 |
| |ports nord − ports sud| (moyenne) | 0.61 | 0.54 |
| Ports nord = ports sud | 46.2 % | 47.6 % |
| S moyen, placements admissibles | 1.99 | 2.08 |
| S ≥ 5, placements admissibles | 0.9 % | 0.7 % |
| « 5 contre 2 », placements admissibles | 1.5 % | 0.2 % |
| S moyen du placement retenu | 1.72 | 1.84 |
| Plateaux distincts | 1000 | 1000 |
| Modèles distincts par plateau (moyenne) | 5.95 | 5.97 |

### 15. Arbitrage 3 : la 7e ville et la tendance des villes vers les flancs

La « 7e ville » est la ville équidistante des deux joueurs dans le placement retenu (le générateur la favorise : tri à S égal, pénalité sans égalité, docs/18). Fréquence de chaque jonction comme ville (j = rangée, i = colonne ; les flancs sont les colonnes i = 1 et i = 4) :

**Référence : 2016 placements 2-3-2 tirés uniformément** : part des configurations qui ont une ville sur la jonction. Villes sur les flancs : 50.0 % ; sur les 4 jonctions centrales (2,2) (3,2) (2,3) (3,3) : 21.4 %.

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 50.0 % | 50.0 % | 50.0 % | 50.0 % |
| j = 2 | 37.5 % | 37.5 % | 37.5 % | 37.5 % |
| j = 3 | 37.5 % | 37.5 % | 37.5 % | 37.5 % |
| j = 4 | 50.0 % | 50.0 % | 50.0 % | 50.0 % |

**Pose libre (échantillon)** : part des configurations qui ont une ville sur la jonction. Villes sur les flancs : 50.0 % ; sur les 4 jonctions centrales (2,2) (3,2) (2,3) (3,3) : 21.5 %.

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 50.3 % | 49.9 % | 49.5 % | 50.3 % |
| j = 2 | 37.6 % | 37.5 % | 37.5 % | 37.3 % |
| j = 3 | 37.3 % | 37.9 % | 37.6 % | 37.3 % |
| j = 4 | 50.1 % | 50.4 % | 49.5 % | 49.9 % |

**Placements admissibles (tous)** : part des configurations qui ont une ville sur la jonction. Villes sur les flancs : 63.3 % ; sur les 4 jonctions centrales (2,2) (3,2) (2,3) (3,3) : 13.8 %.

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 58.1 % | 38.8 % | 39.9 % | 63.2 % |
| j = 2 | 53.2 % | 23.0 % | 25.2 % | 48.2 % |
| j = 3 | 49.8 % | 26.7 % | 21.9 % | 52.0 % |
| j = 4 | 59.8 % | 43.3 % | 38.1 % | 58.8 % |

**Placement retenu parmi les admissibles** : part des configurations qui ont une ville sur la jonction. Villes sur les flancs : 63.7 % ; sur les 4 jonctions centrales (2,2) (3,2) (2,3) (3,3) : 13.4 %.

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 59.6 % | 39.7 % | 40.3 % | 60.4 % |
| j = 2 | 53.8 % | 22.7 % | 23.1 % | 49.4 % |
| j = 3 | 51.1 % | 25.1 % | 23.1 % | 51.8 % |
| j = 4 | 60.2 % | 42.8 % | 37.4 % | 59.6 % |

**Générateur (200 candidats)** : part des configurations qui ont une ville sur la jonction. Villes sur les flancs : 70.0 % ; sur les 4 jonctions centrales (2,2) (3,2) (2,3) (3,3) : 7.1 %.

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 61.8 % | 40.5 % | 41.2 % | 56.5 % |
| j = 2 | 61.2 % | 12.9 % | 12.0 % | 64.2 % |
| j = 3 | 62.7 % | 12.6 % | 11.9 % | 62.5 % |
| j = 4 | 60.6 % | 41.9 % | 37.1 % | 60.4 % |

**Qualité de chaque position** : pour les configurations qui ont une ville sur la jonction, « S moyen / part de S ≥ 5 / part de 5 contre 2 ». Une position sans effet sur l’équilibre aurait les valeurs de la moyenne de la famille (pose libre : S 2.66, S ≥ 5 : 7.7 %, 5 contre 2 : 6.9 % ; admissibles : S 1.99, S ≥ 5 : 0.9 %, 5 contre 2 : 1.5 %).

Pose libre (échantillon) :

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 2.71 / 8.5 % / 6.9 % | 2.64 / 7.3 % / 7.0 % | 2.64 / 7.0 % / 7.0 % | 2.66 / 7.8 % / 6.8 % |
| j = 2 | 2.66 / 7.1 % / 6.4 % | 2.66 / 7.8 % / 7.2 % | 2.65 / 7.8 % / 7.2 % | 2.67 / 7.4 % / 6.6 % |
| j = 3 | 2.68 / 7.7 % / 6.9 % | 2.66 / 7.9 % / 7.1 % | 2.66 / 8.1 % / 7.3 % | 2.66 / 7.4 % / 6.8 % |
| j = 4 | 2.68 / 8.1 % / 7.0 % | 2.64 / 7.2 % / 6.8 % | 2.66 / 7.6 % / 7.0 % | 2.67 / 7.8 % / 6.9 % |

Placements admissibles (tous) :

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 2.00 / 0.7 % / 0.9 % | 1.96 / 1.2 % / 2.3 % | 1.92 / 1.0 % / 1.7 % | 2.04 / 0.7 % / 1.4 % |
| j = 2 | 1.92 / 0.5 % / 1.2 % | 2.15 / 1.4 % / 1.6 % | 2.12 / 1.4 % / 2.2 % | 1.92 / 0.8 % / 1.6 % |
| j = 3 | 1.90 / 0.5 % / 1.5 % | 2.11 / 0.8 % / 0.5 % | 2.17 / 1.6 % / 2.7 % | 1.92 / 0.8 % / 1.4 % |
| j = 4 | 2.04 / 1.0 % / 1.9 % | 1.91 / 0.6 % / 0.9 % | 2.00 / 0.5 % / 1.2 % | 1.98 / 1.2 % / 1.7 % |

Répartition des 3 villes du milieu entre les rangées j = 2 et j = 3 (pose libre, échantillon) :

| Répartition | Configurations | S moyen | 5 contre 2 | S ≥ 5 |
|---|---|---|---|---|
| 0 sur la rangée j = 2, 3 sur j = 3 | 2827 | 3.55 | 49.6 % | 20.7 % |
| 1 sur la rangée j = 2, 2 sur j = 3 | 17201 | 2.52 | 0.0 % | 5.8 % |
| 2 sur la rangée j = 2, 1 sur j = 3 | 17117 | 2.51 | 0.0 % | 5.4 % |
| 3 sur la rangée j = 2, 0 sur j = 3 | 2855 | 3.52 | 47.8 % | 19.6 % |

**Origine de la tendance : jonctions à 3 ports ou plus** (plateaux tirés et orientés, part des plateaux où la jonction a 3 ports ou plus) :

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 63.2 % | 42.9 % | 43.0 % | 64.8 % |
| j = 2 | 56.0 % | 25.3 % | 26.7 % | 51.4 % |
| j = 3 | 54.0 % | 27.8 % | 24.8 % | 55.7 % |
| j = 4 | 64.9 % | 46.5 % | 40.4 % | 63.6 % |

Ports moyens par jonction :

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 2.63 | 2.43 | 2.43 | 2.65 |
| j = 2 | 2.56 | 2.25 | 2.27 | 2.51 |
| j = 3 | 2.54 | 2.28 | 2.25 | 2.56 |
| j = 4 | 2.65 | 2.46 | 2.40 | 2.64 |

**7e ville, Générateur (200 candidats)** : une seule ville équidistante dans 87.6 % des plateaux (aucune : 0.0 % ; deux ou plus : 12.4 %). Position de cette ville (en % des plateaux à une seule ville équidistante) :

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| j = 2 | 26.6 % | 0.0 % | 0.0 % | 23.5 % |
| j = 3 | 26.4 % | 0.0 % | 0.0 % | 23.5 % |
| j = 4 | 0.0 % | 0.0 % | 0.0 % | 0.0 % |

Sur les 8 jonctions du milieu (j = 2 et 3) : 100.0 % ; sur les flancs (i = 1 ou 4) : 100.0 %.

**7e ville, Placement retenu parmi les admissibles** : une seule ville équidistante dans 32.1 % des plateaux (aucune : 65.6 % ; deux ou plus : 2.3 %). Position de cette ville (en % des plateaux à une seule ville équidistante) :

|  | i = 1 | i = 2 | i = 3 | i = 4 |
|---|---|---|---|---|
| j = 1 | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| j = 2 | 26.9 % | 0.0 % | 0.0 % | 23.6 % |
| j = 3 | 25.2 % | 0.0 % | 0.0 % | 24.3 % |
| j = 4 | 0.0 % | 0.0 % | 0.0 % | 0.0 % |

Sur les 8 jonctions du milieu (j = 2 et 3) : 100.0 % ; sur les flancs (i = 1 ou 4) : 100.0 %.

### 16. Sensibilité par modèle (plateaux tirés)

Par nombre d'exemplaires posés d'un modèle : plateaux concernés, placements admissibles par plateau, part de plateaux avec un placement valide, S moyen et part de « 5 contre 2 » sur les placements admissibles.

(C8 n’est pas tabulé : les 9 centrales sont des C7 ou des C8, donc C8 × k est le miroir exact de C7 × (9 − k).)

| Modèle | Plateaux | Admissibles / plateau | Plateaux avec placement valide | S moyen | 5 contre 2 |
|---|---|---|---|---|---|
| C7 × 1 | 1 | 3.00 | 100.0 % | 2.33 | 0.0 % |
| C7 × 2 | 13 | 2.00 | 100.0 % | 2.15 | 0.0 % |
| C7 × 3 | 93 | 2.34 | 98.9 % | 1.89 | 0.5 % |
| C7 × 4 | 275 | 2.28 | 98.5 % | 1.96 | 1.6 % |
| C7 × 5 | 345 | 2.17 | 96.5 % | 2.03 | 1.3 % |
| C7 × 6 | 223 | 2.20 | 92.8 % | 1.99 | 1.8 % |
| C7 × 7 | 49 | 1.90 | 89.8 % | 2.00 | 3.2 % |
| C7 × 8 | 1 | 3.00 | 100.0 % | 1.33 | 0.0 % |

| Modèle | Plateaux | Admissibles / plateau | Plateaux avec placement valide | S moyen | 5 contre 2 |
|---|---|---|---|---|---|
| B7 × 0 | 24 | 2.38 | 95.8 % | 1.77 | 1.8 % |
| B7 × 1 | 88 | 2.39 | 98.9 % | 2.12 | 0.0 % |
| B7 × 2 | 185 | 2.43 | 94.6 % | 2.18 | 3.1 % |
| B7 × 3 | 258 | 2.41 | 97.7 % | 1.90 | 0.6 % |
| B7 × 4 | 249 | 2.05 | 95.2 % | 1.99 | 1.8 % |
| B7 × 5 | 143 | 1.96 | 96.5 % | 1.86 | 1.1 % |
| B7 × 6 | 40 | 1.80 | 95.0 % | 1.88 | 2.8 % |
| B7 × 7 | 13 | 0.92 | 92.3 % | 1.58 | 0.0 % |

| Modèle | Plateaux | Admissibles / plateau | Plateaux avec placement valide | S moyen | 5 contre 2 |
|---|---|---|---|---|---|
| B7m × 0 | 27 | 2.15 | 96.3 % | 1.57 | 1.7 % |
| B7m × 1 | 86 | 2.60 | 95.3 % | 1.93 | 1.8 % |
| B7m × 2 | 191 | 2.39 | 96.9 % | 1.95 | 1.5 % |
| B7m × 3 | 297 | 2.21 | 95.6 % | 1.93 | 0.8 % |
| B7m × 4 | 211 | 2.27 | 96.7 % | 2.14 | 2.9 % |
| B7m × 5 | 124 | 1.96 | 96.0 % | 2.11 | 0.4 % |
| B7m × 6 | 55 | 1.58 | 96.4 % | 1.87 | 1.1 % |
| B7m × 7 | 9 | 1.00 | 100.0 % | 2.11 | 0.0 % |

| Modèle | Plateaux | Admissibles / plateau | Plateaux avec placement valide | S moyen | 5 contre 2 |
|---|---|---|---|---|---|
| B1 × 5 | 490 | 0.98 | 95.3 % | 1.99 | 1.0 % |
| B1 × 6 | 510 | 3.40 | 97.1 % | 1.99 | 1.6 % |

### 17. Seuils : ce que chaque critère attraperait

| Mesure | Générateur (200 candidats) | Admissibles, tous | Pose libre, échantillon |
|---|---|---|---|
| « 5 contre 2 » (blocage) | 0.0 % | 1.5 % | 6.9 % |
| Écart max ≥ 4 (blocage > 3) | 0.0 % | 0.0 % | 0.0 % |
| Écart max ≥ 3 (alerte > 2) | 0.0 % | 0.0 % | 0.0 % |
| Écart max ≥ 2 | 0.0 % | 0.0 % | 7.5 % |
| Première ville inégale | 0.0 % | 0.0 % | 0.1 % |
| S ≥ 4 (information) | 0.0 % | 8.3 % | 24.7 % |
| S ≥ 5 | 0.0 % | 0.9 % | 7.7 % |
| S ≥ 6 | 0.0 % | 0.0 % | 1.4 % |
| S ≥ 7 | 0.0 % | 0.0 % | 0.1 % |
| Bloquée (code D ou I) | 0.0 % | 1.5 % | 6.9 % |
| Alerte seule (E, P ou S) | 0.0 % | 0.8 % | 5.2 % |

