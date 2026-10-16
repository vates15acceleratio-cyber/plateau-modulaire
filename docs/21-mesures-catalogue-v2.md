# Mesures du catalogue 4×4 de la version 2 (sous-agent catalogue v2), 2026-10-16

Sources : `docs/18-decisions-v2.md`, `docs/19-avis-design-v2.md`, `docs/20-avis-geometrie-v2.md`. Catalogue : `src/catalogue.js`. Tests : `tests/catalogue.test.js`. Ce document est produit par `node outils/mesures-equilibre.js` (1000 plateaux, graine 20261015, 36 combinaisons de jonctions-cases par plateau, soit 36 000 configurations). Les paragraphes « Le catalogue », « Constats », « Seuils figés » et « Décisions prises » sont rédigés à la main (fichier `outils/constats-catalogue-v2.md`, repris en tête par le script) et valent pour ce tirage de référence ; les tableaux de la dernière partie sont générés.

## 1. Le catalogue

22 tuiles, 14 modèles (B2, bord fermé, supprimé et B1 en 6 exemplaires : docs/22). Cases d'un plateau = cases des 16 tuiles + 2 jonctions-cases.

| Id | Nom | Gabarit | Tuiles | Cases | Ports | Raccords | Idée |
|---|---|---|---|---|---|---|---|
| C1 | Étoile | centrale | 1 | 5 | 4 | N, E, S, O au milieu | Relais au centre relié aux 4 cases à port : tout est à 2 pas. |
| C2 | Zigzag | centrale | 1 | 6 | 4 | N, E, S, O | Deux relais reliés ; chacun tient 2 ports voisins et 2 raccords : 3 pas d'un coin au coin opposé. |
| C3 | Deux ponts | centrale | 1 | 6 | 4 | N, E, S, O | **Deux réseaux séparés** (relais nord : ports nord, raccords N et E ; relais sud : ports sud, raccords S et O), sans lien entre eux. |
| C4 | Trident | centrale | 1 | 4 | **3** | N, E, S, O | Étoile sans port au coin SE. |
| C5 | Étoile fermée | centrale | 1 | 5 | 4 | N, E, S (ouest fermé) | Seconde étoile à 5 cases : ses raccords ne peuvent être qu'au milieu, elle ne diffère donc de C1 que par un « mur » (goulet). |
| C6 | Chaîne | centrale | 1 | 5 | 3 | N, E, S, O | Relais nord (N, E, deux ports) relié à un relais sud (S, O, un port) : 3 ports, chemin long. |
| B1 | Bord en V | bord | 6 | 3 | 2 | E0, O2 (raccourci), S1 | L'apparition tient les deux ports (2 pas jusqu'aux deux jonctions) et tous les raccords. |
| B3 | Bord en Y | bord | 1 | 4 | 2 | E0, O2, S1 | Un relais entre l'apparition et les ports : 3 pas jusqu'aux jonctions ; le raccord S part du relais. |
| B4 | Bord en fourche | bord | 1 | 4 | 2 | E0, O2, S1 | L'apparition tient les ports ; le raccord S part d'un relais pendant. |
| B5 | Bord décalé | bord | 1 | 4 | 2 | E0, O2, S1 | Port est à 2 pas, port ouest à 3 pas (par un relais) : asymétrique. |
| B6 | Bord en triangle | bord | 1 | 4 | 2 | E0, O2, S1 | Boucle apparition - relais - port est ; le port ouest passe par le relais. |
| K1 | Coin direct | coin | 2 | 2 | 1 | E0, S2 (raccourci) | L'apparition touche la case à port (2 pas jusqu'à la jonction). |
| K2 | Coin à relais | coin | 2 | 3 | 1 | E0, S2 | Un relais entre l'apparition et la case à port (3 pas). |
| K3 | Coin à poche | coin | 2 | 3 | 1 | E0, S2 | L'apparition tient le port et les deux raccords ; une case en impasse pend à la case à port. |

Toutes les tuiles ont leurs raccords au milieu (pos 1) sur les côtés qui regardent une centrale ; les raccourcis des bords et des coins sont seuls à 30 mm du bord extérieur (bord `0x808`, coin `0x108`, docs/20 D5), et **partent tous de la case d'apparition** (docs/19). Aucun modèle ne porte d'erreur ni d'alerte de `validerModele` ; tous les tracés respectent les contrôles du test (8 mm entre chemins, r + 4 mm des autres cases, 24 mm des coins ; plus petit écart mesuré entre deux chemins : 8,6 mm, modèle B5, pour un minimum exigé de 8 mm).

**Cases par plateau** : moyenne 60,5 (57 à 64, 1000 plateaux), 60,53 mesuré ; cible ≈ 60 (docs/20).

## 2. Constats

1. **Écart entre villes : garanti.** Sur 1000 plateaux, le plus petit nombre de pas entre deux jonctions quelconques (toutes en cases) est exactement 4, sans exception : au moins 3 cases entre deux villes, quel que soit le choix des 7 villes (36 000 configurations : 4 pas au minimum). Preuve locale, relue dans le graphe par le test : une jonction ne touche que des cases à port (R1 : une case à port touche une seule jonction), deux cases à port ne sont jamais voisines (R2, R3), donc tout trajet jonction - jonction est « case à port, case sans port, case à port » au moins : 4 pas. Témoin négatif : des centrales en anneau (R2 violée) donnent un écart de 3 pas.
2. **Équilibre : bon.** S moyen 2,09 ; écart max (rangs 1 à 7) de 1 pas dans 87,8 % des configurations, de 2 pas dans 4,7 %, jamais 3 ni 4. Aux rangs 1 et 2 l'écart est nul (100 % et 99,5 %). La première ville est à 2 pas des deux joueurs dans les 36 000 configurations : l'invariant « première ville à égalité » tient toujours.
3. **« 5 contre 2 » : 3,1 % des configurations (36 combinaisons de jonctions-cases tirées uniformément), et c'est presque entièrement le choix des 2 jonctions-cases.** Trois combinaisons n'en ont jamais : les paires de la rangée centrale (1,2)+(2,2), (1,2)+(3,2), (2,2)+(3,2) (S moyen 1,14 à 1,37) ; les deux jonctions-cases dans la même rangée extérieure en ont 8,3 à 8,6 % (S moyen 2,9 à 3,5). Tout plateau a au moins une combinaison non bloquée (1000 sur 1000, au moins 15 sur 36) ; 83,1 % n'en bloquent aucune, 16,1 % en bloquent 6 sur 36, 0,8 % en bloquent 21. Le meilleur S atteignable par plateau vaut 0 (60,4 %), 1 (29,7 %), 2 (9,0 %), 3 ou 4 (0,9 %). Aucun modèle ne dégrade l'équilibre à lui seul (plus grand écart de S moyen avec / sans un modèle : 0,27, B3). **Modes du générateur** (docs/22) : par défaut (3 paires de la rangée centrale) 0 % de « 5 contre 2 », S moyen 1,29, S ≥ 5 : 0,1 % ; « jonctions variées » (30 paires : toutes sauf les 6 d'une même rangée extérieure) 2,1 % de « 5 contre 2 » avant filtre, S moyen 1,85, S ≥ 5 : 0,7 %.
4. **Générateur : valide.** 50 graines sur 50 donnent un plateau valide dans chaque mode (graines « v2-0 » à « v2-49 », 200 candidats par défaut). Mode par défaut : S du plateau rendu 0 (20 fois) ou 1 (30 fois), aucun essai rejeté sur 10 000, donc aucun « 5 contre 2 ». Mode « jonctions variées » : S 0 (12 fois) ou 1 (38 fois), 1,7 % des essais rejetés (« plateau très déséquilibré » 171 fois sur 10 171), aucun autre rejet. Sur 1000 tirages d'un seul candidat, le mode par défaut ne produit aucun plateau très déséquilibré, le mode varié en produit 17 (1,7 %), que le générateur écarte.
5. **Raccords morts : 0,68 par plateau en moyenne, 1 au plus.** Seul le « mur » C5 en crée (côté fermé face à un raccord) : 67,9 % des plateaux ont C5 en place avec un raccord mort, 32,1 % n'en ont aucun. Jonctions reliées par moins de 2 ports : aucune ; jonctions à 2 ports : 33 sur 9000 (0,4 %).
6. **Tempo très rapide (risque annoncé par docs/19, voulu : docs/18).** Villes atteignables en 3 pas : 5,77 sur 7 (vert), 5,75 (rouge) ; en 4 pas : 6,84 et 6,84 ; en 5 pas : 7 sur 7. La première ville est à 2 pas dans 100 % des cas. La cause est structurelle : 6 cases d'apparition par joueur, toutes à 2 ou 3 pas d'une jonction.
7. **« Autoroute » du pourtour : réelle, acceptée (docs/18).** Les raccourcis relient les 12 cases d'apparition en anneau : une apparition verte et une rouge sont **toujours à 1 pas** (colonnes de gauche et de droite : apparitions de (0,1) et (0,2), de (3,1) et (3,2)). Jusqu'à la rangée de jonctions du camp adverse, un joueur met en moyenne 3,0 pas par le pourtour (3 à 4) contre 4,9 par les colonnes 1 et 2 (4 à 9) ; le pourtour est plus court que le centre dans 99,1 % des mesures de `PM.graphe.flancs`. C'est symétrique (les deux joueurs en profitent), donc sans effet sur S.
8. **Goulets.** Placement de référence (1,2)+(3,2), villes non traversables : au moins 2 chemins disjoints des apparitions d'un joueur vers chaque ville (exactement 3 dans 79,1 % des cas, 4 dans 0,3 %, 2 dans 20,6 % ; donc 3 ou plus dans 79,3 %), aucun point d'articulation sur 2000 cas.
9. **Raccords seuls.** Sans passer par les jonctions, les raccords relient toutes les cases dans 1000 plateaux sur 1000 (996 avant la suppression de B2).

## 3. Seuils figés (docs/22, avis de l'advisor design de jeu)

Seuils codés dans `src/graphe.js`, valables pour le 4×4 (le 5×5 sera mesuré à part : seuils provisoires identiques, S d'alerte à fixer au 95e centile des plateaux acceptés).

| Critère | Seuil | Part des configurations (36 000) | Argument |
|---|---|---|---|
| « 5 contre 2 » | **blocage** | 3,1 % | Évitable à coup sûr : au moins 15 combinaisons sur 36 par plateau, et les 3 paires de la rangée centrale n'en ont jamais. Le message conseille la rangée centrale pour les jonctions-cases. |
| Écart max > 3 (≥ 4 pas) | **blocage** | 0 % | Filet pour les tuiles libres, sans coût sur le catalogue. |
| Écart max > 2 (= 3 pas) | **alerte** | 0 % | Jamais atteint avec le catalogue, utile pour les tuiles libres. Un écart d'au moins 2 pas touche 4,7 % des configurations pour un seul pas de plus : bruit, pas de signal. |
| **S ≥ 5** | **alerte** | 2,7 % | Remplace S ≥ 4 (11,6 % des configurations, trop bruyant). Actionnable : le meilleur S atteignable est ≤ 2 pour 99,1 % des plateaux. |
| S = 4 | **information**, sans alerte | 8,9 % | Affiché dans le rapport d'équilibre. |
| « 4 contre 3 » | aucune alerte | 28,2 % | Partage normal de 7 villes. |
| Première ville inégale | alerte | 0 % | Invariant tenu à 100 % ; ne se déclenche que pour des tuiles libres. |
| Tempo (villes à ≤ 3 pas) | information | 5,8 villes sur 7 à ≤ 3 pas | Tempo voulu (docs/18). |

**Générateur** (4×4) : par défaut les 2 jonctions-cases sont tirées au hasard parmi les 3 paires de la rangée centrale ; l'option « jonctions variées » ouvre les 30 paires qui ne sont pas deux jonctions d'une même rangée extérieure. Le blocage « 5 contre 2 » reste un filtre dans les deux modes. Le seuil de blocage « écart max > 3 » ne sera éprouvé qu'avec des tuiles libres ou le 5×5.

## 4. Décisions prises

1. **Autoroute du pourtour** (constat 7) : acceptée, aucun changement (docs/18).
2. **Tempo** (constat 6) : voulu, aucun changement (docs/18).
3. **Murs et raccords morts** : B2 supprimé, B1 en 6 exemplaires (raccords morts 1,41 → 0,68 par plateau, 60,5 cases) ; C5 gardé (un seul mur possible, goulet intéressant). Cinq modèles de bord au lieu de six (docs/22).

---

## Tableaux de mesure


Généré par `outils/mesures-equilibre.js` (graine 20261015) : 1000 plateau(x) 4×4 tiré(s) du catalogue réel `PM.catalogue.nouveauDocument()`, 36 combinaisons de 2 jonctions-cases par plateau (7 villes sur les 7 autres jonctions), soit 36000 configurations.

Plateaux tirés comme dans `tests/catalogue.test.js` : modèles tirés sans remise selon les exemplaires de chaque gabarit, bords et coins tournés vers l'extérieur, centrales en rotation aléatoire. Villes non traversables (règle du jeu). D(k) : distance du rang k de villes, depuis la case d'apparition la plus proche de chaque joueur. S = somme des |D1(k) − D2(k)| sur les rangs 1 à 7 ; « écart max » = plus grand |D1(k) − D2(k)| sur les rangs 1 à 7 ; « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus.

Seuils actuellement codés dans `src/graphe.js` (figés par docs/22) : blocage si « 5 contre 2 » ou écart max > 3 ; alerte si écart max > 2 ou S ≥ 5 (S = 4 : information seulement).

### 1. Cases par plateau

Cases des 16 tuiles + 2 jonctions-cases (cible ≈ 60, docs/20) :
```
valeur |       n |      % |
    57 |       2 |   0.2 % | 
    58 |      50 |   5.0 % | ###
    59 |     161 |  16.1 % | ########
    60 |     292 |  29.2 % | ###############
    61 |     267 |  26.7 % | #############
    62 |     160 |  16.0 % | ########
    63 |      66 |   6.6 % | ###
    64 |       2 |   0.2 % | 
```
Moyenne : 60.53 cases.

### 2. Écart entre villes

Plus petit écart (en pas) entre deux jonctions quelconques, toutes les jonctions étant des cases (aucune ville) : c'est un minorant de l'écart entre deux villes, quel que soit le choix des 7 villes. Exigence : 4 pas (3 cases entre deux villes).
```
valeur |       n |      % |
     4 |    1000 | 100.0 % | ##################################################
```
Même mesure sur les configurations réelles (villes non traversables) :
```
valeur |       n |      % |
     4 |   36000 | 100.0 % | ##################################################
```
### 3. Score S

36000 configurations. Moyenne 2.09.
```
valeur |       n |      % |
     0 |    2682 |   7.5 % | ####
     1 |    9086 |  25.2 % | #############
     2 |   12010 |  33.4 % | #################
     3 |    8037 |  22.3 % | ###########
     4 |    3200 |   8.9 % | ####
     5 |     846 |   2.4 % | #
     6 |     128 |   0.4 % | 
     7 |      11 |   0.0 % | 
```
Part des configurations selon S :

| S ≥ | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|
| Configurations | 67.3 % | 34.0 % | 11.6 % | 2.7 % | 0.4 % | 0.0 % |

### 4. Écart par rang (1 à 7)

Écart |D1(k) − D2(k)| au rang k, sur toutes les configurations :

| Rang | Écart moyen | = 0 | = 1 | = 2 | = 3 | ≥ 4 |
|---|---|---|---|---|---|---|
| 1 | 0.00 | 100.0 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| 2 | 0.00 | 99.5 % | 0.5 % | 0.0 % | 0.0 % | 0.0 % |
| 3 | 0.16 | 84.2 % | 15.8 % | 0.0 % | 0.0 % | 0.0 % |
| 4 | 0.65 | 34.9 % | 65.0 % | 0.1 % | 0.0 % | 0.0 % |
| 5 | 0.27 | 73.6 % | 26.1 % | 0.4 % | 0.0 % | 0.0 % |
| 6 | 0.48 | 52.3 % | 47.7 % | 0.0 % | 0.0 % | 0.0 % |
| 7 | 0.53 | 51.8 % | 44.0 % | 4.3 % | 0.0 % | 0.0 % |

### 5. Écart max (rangs 1 à 7)
```
valeur |       n |      % |
     0 |    2682 |   7.5 % | ####
     1 |   31613 |  87.8 % | ############################################
     2 |    1705 |   4.7 % | ##
```
| Écart max ≥ | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Configurations | 92.5 % | 4.7 % | 0.0 % | 0.0 % |

### 6. Partage des villes (« 5 contre 2 », « 4 contre 3 »)

« 5 contre 2 » (ou pire) : 1134 configurations sur 36000 (3.1 %). « 4 contre 3 » : 10150 (28.2 %). Villes à égalité de distance : 1.53 en moyenne sur 7.

Partage (plus proches du joueur le mieux placé contre l'autre) :
```
valeur |       n |      % |
3 contre 1 (+3 égalité) |    1710 |   4.8 % | ##
3 contre 2 (+2 égalité) |   13050 |  36.3 % | ##################
2 contre 2 (+3 égalité) |    2565 |   7.1 % | ####
3 contre 3 (+1 égalité) |    7391 |  20.5 % | ##########
4 contre 3 |    2938 |   8.2 % | ####
4 contre 2 (+1 égalité) |    5892 |  16.4 % | ########
4 contre 1 (+2 égalité) |    1320 |   3.7 % | ##
5 contre 1 (+1 égalité) |     396 |   1.1 % | #
5 contre 2 |     714 |   2.0 % | #
6 contre 1 |      24 |   0.1 % | 
```
### 7. Première ville et tempo

Distance de la première ville (la plus proche), joueur vert :
```
valeur |       n |      % |
     2 |   36000 | 100.0 % | ##################################################
```
Joueur rouge :
```
valeur |       n |      % |
     2 |   36000 | 100.0 % | ##################################################
```
Écart sur la première ville (|D1(1) − D2(1)|) :
```
valeur |       n |      % |
     0 |   36000 | 100.0 % | ##################################################
```
Nombre moyen de villes atteignables en au plus n pas :

| Pas | Vert | Rouge |
|---|---|---|
| ≤ 3 | 5.77 | 5.75 |
| ≤ 4 | 6.84 | 6.84 |
| ≤ 5 | 7.00 | 7.00 |

### 8. Autoroute du pourtour

Les raccourcis de coin et de bord (docs/20 D5) relient entre elles les 12 cases d'apparition du pourtour. Deux mesures :

**a.** Distance minimale (en pas) entre une case d'apparition verte et une rouge (graphe complet) :
```
valeur |       n |      % |
     1 |    1000 | 100.0 % | ##################################################
```
**b.** Distance d'une case d'apparition d'un joueur à la rangée de jonctions du camp adverse (j = 3 pour le vert, j = 1 pour le rouge), sans ville, en n'empruntant que les tuiles du pourtour (« pourtour ») ou que les colonnes 1 et 2 (« centre ») :

| Joueur | Voie | Moyenne | Minimum | Maximum |
|---|---|---|---|---|
| vert | pourtour | 3.02 | 3 | 4 |
| vert | centre | 4.90 | 4 | 9 |
| rouge | pourtour | 3.03 | 3 | 4 |
| rouge | centre | 4.92 | 4 | 8 |

**c.** `PM.graphe.flancs` (toutes les jonctions portent une ville ; sous-graphe « flancs » = tuiles du pourtour, « centre » = colonnes 1 et 2) :

| Cas | Mesures | Pourtour plus court que le centre | Pourtour − centre moyen |
|---|---|---|---|
| Villes non traversables (règle) | 2000 | 1982 (99.1 %) | -1.80 |
| Villes traversables (comparaison) | 2000 | 1982 (99.1 %) | -1.88 |

### 9. Raccords morts et jonctions mal reliées

Raccords morts par plateau (voisin posé sans raccord en face) :
```
valeur |       n |      % |
     0 |     321 |  32.1 % | ################
     1 |     679 |  67.9 % | ##################################
```
Moyenne 0.68. Jonctions reliées par moins de 2 ports :
```
valeur |       n |      % |
     0 |    1000 | 100.0 % | ##################################################
```
### 10. Sensibilité par modèle

Pour chaque modèle : plateaux où il est posé / non posé, S moyen (moyenne sur les 36 combinaisons), part de configurations « 5 contre 2 » et d'écart max > 2.

| Modèle | Plateaux avec | S moyen avec | S moyen sans | 5 contre 2 avec | 5 contre 2 sans | Écart max > 2 avec | Écart max > 2 sans |
|---|---|---|---|---|---|---|---|
| C1 Étoile | 688 | 2.04 | 2.19 | 2.7 % | 4.0 % | 0.0 % | 0.0 % |
| C2 Zigzag | 651 | 2.14 | 1.99 | 3.3 % | 3.0 % | 0.0 % | 0.0 % |
| C3 Deux ponts | 666 | 2.12 | 2.03 | 3.6 % | 2.2 % | 0.0 % | 0.0 % |
| C4 Trident | 652 | 2.04 | 2.18 | 2.9 % | 3.6 % | 0.0 % | 0.0 % |
| C5 Étoile fermée | 679 | 2.04 | 2.18 | 3.0 % | 3.5 % | 0.0 % | 0.0 % |
| C6 Chaîne | 664 | 2.15 | 1.96 | 3.4 % | 2.6 % | 0.0 % | 0.0 % |
| B1 Bord en V | 1000 | 2.09 | n/a | 3.2 % | n/a | 0.0 % | n/a |
| B3 Bord en Y | 798 | 2.14 | 1.87 | 3.6 % | 1.2 % | 0.0 % | 0.0 % |
| B4 Bord en fourche | 821 | 2.08 | 2.10 | 3.0 % | 3.7 % | 0.0 % | 0.0 % |
| B5 Bord décalé | 802 | 2.10 | 2.02 | 3.2 % | 2.8 % | 0.0 % | 0.0 % |
| B6 Bord en triangle | 788 | 2.10 | 2.03 | 3.4 % | 2.4 % | 0.0 % | 0.0 % |
| K1 Coin direct | 935 | 2.08 | 2.21 | 3.1 % | 3.7 % | 0.0 % | 0.0 % |
| K2 Coin à relais | 917 | 2.09 | 2.01 | 3.1 % | 3.5 % | 0.0 % | 0.0 % |
| K3 Coin à poche | 936 | 2.08 | 2.14 | 3.1 % | 4.0 % | 0.0 % | 0.0 % |

### 11. Les 36 combinaisons de jonctions-cases

| Jonctions-cases | S moyen | S ≥ 4 | S ≥ 5 | Écart max > 2 | Écart max > 3 | 5 contre 2 |
|---|---|---|---|---|---|---|
| (1,1)+(2,1) | 3.30 | 42.5 % | 12.7 % | 0.0 % | 0.0 % | 8.6 % |
| (1,1)+(3,1) | 2.92 | 28.2 % | 7.7 % | 0.0 % | 0.0 % | 8.6 % |
| (1,1)+(1,2) | 1.83 | 5.3 % | 0.4 % | 0.0 % | 0.0 % | 1.5 % |
| (1,1)+(2,2) | 1.93 | 7.3 % | 0.7 % | 0.0 % | 0.0 % | 1.3 % |
| (1,1)+(3,2) | 2.19 | 8.6 % | 1.2 % | 0.0 % | 0.0 % | 6.2 % |
| (1,1)+(1,3) | 1.53 | 2.5 % | 0.2 % | 0.0 % | 0.0 % | 0.8 % |
| (1,1)+(2,3) | 1.83 | 5.4 % | 1.5 % | 0.0 % | 0.0 % | 0.8 % |
| (1,1)+(3,3) | 1.61 | 3.1 % | 0.1 % | 0.0 % | 0.0 % | 0.8 % |
| (2,1)+(3,1) | 3.48 | 48.5 % | 16.8 % | 0.0 % | 0.0 % | 8.6 % |
| (2,1)+(1,2) | 2.09 | 7.7 % | 0.7 % | 0.0 % | 0.0 % | 1.5 % |
| (2,1)+(2,2) | 2.24 | 7.4 % | 0.3 % | 0.0 % | 0.0 % | 1.3 % |
| (2,1)+(3,2) | 2.45 | 14.3 % | 2.1 % | 0.0 % | 0.0 % | 6.2 % |
| (2,1)+(1,3) | 1.62 | 3.6 % | 0.2 % | 0.0 % | 0.0 % | 0.8 % |
| (2,1)+(2,3) | 1.29 | 1.3 % | 0.1 % | 0.0 % | 0.0 % | 0.8 % |
| (2,1)+(3,3) | 1.81 | 6.7 % | 0.8 % | 0.0 % | 0.0 % | 0.8 % |
| (3,1)+(1,2) | 1.79 | 4.2 % | 0.3 % | 0.0 % | 0.0 % | 1.5 % |
| (3,1)+(2,2) | 1.86 | 5.3 % | 0.4 % | 0.0 % | 0.0 % | 1.3 % |
| (3,1)+(3,2) | 2.15 | 8.7 % | 1.3 % | 0.0 % | 0.0 % | 6.2 % |
| (3,1)+(1,3) | 1.42 | 2.0 % | 0.3 % | 0.0 % | 0.0 % | 0.8 % |
| (3,1)+(2,3) | 1.66 | 4.1 % | 0.5 % | 0.0 % | 0.0 % | 0.8 % |
| (3,1)+(3,3) | 1.54 | 2.6 % | 0.2 % | 0.0 % | 0.0 % | 0.8 % |
| (1,2)+(2,2) | 1.37 | 1.7 % | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| (1,2)+(3,2) | 1.14 | 0.7 % | 0.1 % | 0.0 % | 0.0 % | 0.0 % |
| (1,2)+(1,3) | 2.16 | 9.2 % | 1.2 % | 0.0 % | 0.0 % | 5.7 % |
| (1,2)+(2,3) | 2.49 | 14.9 % | 3.3 % | 0.0 % | 0.0 % | 5.7 % |
| (1,2)+(3,3) | 2.22 | 9.8 % | 1.6 % | 0.0 % | 0.0 % | 5.7 % |
| (2,2)+(3,2) | 1.37 | 1.6 % | 0.2 % | 0.0 % | 0.0 % | 0.0 % |
| (2,2)+(1,3) | 1.89 | 5.6 % | 0.3 % | 0.0 % | 0.0 % | 2.1 % |
| (2,2)+(2,3) | 2.32 | 9.4 % | 1.0 % | 0.0 % | 0.0 % | 2.1 % |
| (2,2)+(3,3) | 1.96 | 8.1 % | 0.6 % | 0.0 % | 0.0 % | 2.1 % |
| (3,2)+(1,3) | 1.80 | 3.6 % | 0.2 % | 0.0 % | 0.0 % | 1.7 % |
| (3,2)+(2,3) | 2.14 | 7.2 % | 1.1 % | 0.0 % | 0.0 % | 1.7 % |
| (3,2)+(3,3) | 1.87 | 4.9 % | 0.4 % | 0.0 % | 0.0 % | 1.7 % |
| (1,3)+(2,3) | 3.51 | 49.0 % | 16.8 % | 0.0 % | 0.0 % | 8.3 % |
| (1,3)+(3,3) | 2.96 | 29.7 % | 8.0 % | 0.0 % | 0.0 % | 8.3 % |
| (2,3)+(3,3) | 3.37 | 43.8 % | 15.2 % | 0.0 % | 0.0 % | 8.3 % |

Modes du générateur (une paire autorisée tirée au hasard, avant le filtre du critère) :

| Mode | Paires | S moyen | S ≥ 4 | S ≥ 5 | 5 contre 2 |
|---|---|---|---|---|---|
| Par défaut (rangée centrale) | 3 | 1.29 | 1.3 % | 0.1 % | 0.0 % |
| Jonctions variées | 30 | 1.85 | 5.9 % | 0.7 % | 2.1 % |

Meilleure combinaison : (1,2)+(3,2) (S moyen 1.14) ; la moins bonne : (1,3)+(2,3) (S moyen 3.51).

### 11b. Goulets

Placement de référence (1,2)+(3,2) (jonctions-cases dans la rangée centrale), villes non traversables : 2000 cas (un par joueur et par plateau). Chemins sans case commune (hors les cases d'apparition) entre les apparitions d'un joueur et chaque ville ; points d'articulation : case dont le retrait coupe au moins une ville de toutes les apparitions du joueur.

Minimum, sur les 7 villes, du nombre de chemins disjoints :
```
valeur |       n |      % |
     2 |     413 |  20.6 % | ##########
     3 |    1582 |  79.1 % | ########################################
     4 |       5 |   0.3 % | 
```
Nombre de chemins disjoints, toutes villes :
```
valeur |       n |      % |
     2 |     446 |   3.2 % | ##
     3 |    5114 |  36.5 % | ##################
     4 |    8440 |  60.3 % | ##############################
```
Points d'articulation : au moins un dans 0.0 % des cas ; un point qui coupe au moins 2 villes dans 0.0 % ; nombre moyen par cas 0.00.

### 12. Seuils : ce que chaque seuil attraperait

Part des configurations (une configuration = un plateau et un choix de 2 jonctions-cases) touchées par chaque critère candidat :

| Critère | Configurations touchées |
|---|---|
| « 5 contre 2 » | 3.1 % |
| Écart max ≥ 2 | 4.7 % |
| Écart max ≥ 3 | 0.0 % |
| Écart max ≥ 4 | 0.0 % |
| S ≥ 4 (information) | 11.6 % |
| S ≥ 5 (alerte) | 2.7 % |
| S ≥ 6 | 0.4 % |
| S ≥ 7 | 0.0 % |
| Blocage actuel (« 5 contre 2 » ou écart max > 3) | 3.1 % |

Par plateau : 1000 plateau(x) sur 1000 (100.0 %) ont au moins une combinaison de jonctions-cases non bloquée ; 831 (83.1 %) n'en ont aucune bloquée. Nombre de combinaisons bloquées sur 36 :
```
valeur |       n |      % |
     0 |     831 |  83.1 % | ##########################################
     6 |     161 |  16.1 % | ########
    21 |       8 |   0.8 % | 
```
Meilleur S atteignable par plateau (minimum sur les combinaisons) :
```
valeur |       n |      % |
     0 |     604 |  60.4 % | ##############################
     1 |     297 |  29.7 % | ###############
     2 |      90 |   9.0 % | #####
     3 |       8 |   0.8 % | 
     4 |       1 |   0.1 % | 
```
### 13. Diversité

538 profils de distances distincts (« D1 trié | D2 trié ») sur 36000 configurations.

