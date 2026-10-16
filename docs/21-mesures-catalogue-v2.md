# Mesures du catalogue 4×4 de la version 2 (retouches après essai), 2026-10-16

Sources : `docs/18-decisions-v2.md` (dont « Retours de l'utilisateur après essai du plateau 4×4 »), `docs/19-avis-design-v2.md`, `docs/20-avis-geometrie-v2.md`. Catalogue : `src/catalogue.js`. Tests : `tests/catalogue.test.js`. Ce document est produit par `node outils/mesures-equilibre.js` (1000 plateaux, graine 20261015, 36 combinaisons de jonctions-cases par plateau, soit 36 000 configurations). Les paragraphes « Le catalogue », « Constats », « Seuils figés » et « Décisions prises » sont rédigés à la main (fichier `outils/constats-catalogue-v2.md`, repris en tête par le script) et valent pour ce tirage de référence ; les tableaux de la dernière partie sont générés.

**Ce qui change par rapport aux mesures précédentes.** Les poses sont maintenant illimitées : les plateaux de référence ne sont plus tirés sans remise dans les 22 tuiles physiques, mais **comme le générateur** (`PM.generateur.tirerTuiles` : tirage avec remise, poids d'un modèle = son nombre d'exemplaires, poids divisé par 1 + 0,5 × le nombre de fois où il a déjà servi sur le plateau, ce qui favorise la variété). Un même modèle peut donc revenir plusieurs fois, y compris C5 (le « mur ») et les centrales à 3 ports. Les chiffres ci-dessous sont à lire dans ce contexte ; la mesure d'avant (tirage sans remise) est rappelée entre parenthèses quand elle diffère.

## 1. Le catalogue

13 modèles, 22 exemplaires à imprimer (C4 en 2, B1 en 6, K2 en 4, K4 en 1, les autres en 1). **K1 (coin direct) et K3 (coin à poche) sont retirés** ; **B4 est refait** (le relais pendant devient un losange). Aucun modèle n'a de poche (nouvelle alerte `poche` de `validerModele`, test dédié). Cases d'un plateau = cases des 16 tuiles + 2 jonctions-cases.

| Id | Nom | Gabarit | Exemplaires | Cases | Ports | Raccords | Idée |
|---|---|---|---|---|---|---|---|
| C1 | Étoile | centrale | 1 | 5 | 4 | N, E, S, O au milieu | Relais au centre relié aux 4 cases à port : tout est à 2 pas. |
| C2 | Zigzag | centrale | 1 | 6 | 4 | N, E, S, O | Deux relais reliés ; chacun tient 2 ports voisins et 2 raccords : 3 pas d'un coin au coin opposé. |
| C3 | Deux ponts | centrale | 1 | 6 | 4 | N, E, S, O | **Deux réseaux séparés** (relais nord : ports nord, raccords N et E ; relais sud : ports sud, raccords S et O), sans lien entre eux. |
| C4 | Trident | centrale | 2 | 4 | **3** | N, E, S, O | Étoile sans port au coin SE. |
| C5 | Étoile fermée | centrale | 1 | 5 | 4 | N, E, S (ouest fermé) | Seconde étoile à 5 cases : ses raccords ne peuvent être qu'au milieu, elle ne diffère donc de C1 que par un « mur » (goulet). |
| C6 | Chaîne | centrale | 1 | 5 | 3 | N, E, S, O | Relais nord (N, E, deux ports) relié à un relais sud (S, O, un port) : 3 ports, chemin long. |
| B1 | Bord en V | bord | 6 | 3 | 2 | E0, O2 (raccourci), S1 | L'apparition tient les deux ports (2 pas jusqu'aux deux jonctions) et tous les raccords. |
| B3 | Bord en Y | bord | 1 | 4 | 2 | E0, O2, S1 | Un relais entre l'apparition et les ports : 3 pas jusqu'aux jonctions ; le raccord S part du relais. |
| B4 | Bord en losange | bord | 1 | 4 | 2 | E0, O2, S1 | **Refait.** L'apparition et un relais touchent chacun les deux cases à port (deux routes de même longueur) ; le raccord S part du relais, qui a donc deux chemins : plus d'impasse. |
| B5 | Bord décalé | bord | 1 | 4 | 2 | E0, O2, S1 | Port est à 2 pas, port ouest à 3 pas (par un relais) : asymétrique. |
| B6 | Bord en triangle | bord | 1 | 4 | 2 | E0, O2, S1 | Boucle apparition - relais - port est ; le port ouest passe par le relais. |
| K2 | Coin à relais | coin | 4 | 3 | 1 | E0, S2 (raccourci) | Un relais entre l'apparition et la case à port : 2 cases avant la jonction (3 pas), raccourci de coin pour filer le long du bord. |
| K4 | Coin en losange | coin | 1 | 4 | 1 | E0, S2 | **Nouveau.** Deux relais symétriques entre l'apparition et la case à port : deux routes de même longueur, toujours 2 cases avant la jonction. |

**Coins : pourquoi K4 et pas d'autres.** Un coin n'a qu'un port (SE) et ses deux raccourcis (E pos 0, S pos 2) doivent partir de l'apparition ; aucun autre raccord latéral n'est possible sans créer un raccord mort ; il faut exactement 2 cases entre l'apparition et la jonction, aucune poche. Sans poche et en 4 cases au plus, il ne reste que deux formes : le relais simple (K2) et le losange (K4). Les autres variantes (un triangle qui boucle sur le relais, ou une case qui boucle sur l'apparition) ne changent aucun trajet : elles ne seraient que des décorations. Les coordonnées de K4 viennent d'une recherche systématique (1 718 positions valides sur la grille de 2 mm testée, la plus dégagée a 12,8 mm de jeu entre cases).

Toutes les tuiles ont leurs raccords au milieu (pos 1) sur les côtés qui regardent une centrale ; les raccourcis des bords et des coins sont seuls à 30 mm du bord extérieur (bord `0x808`, coin `0x108`, docs/20 D5), et **partent tous de la case d'apparition** (docs/19). Aucun modèle ne porte d'erreur ni d'alerte de `validerModele` ; tous les tracés respectent les contrôles du test.

**Cases par plateau** : moyenne 63,1 (57 à 69, 1000 plateaux) ; **cible ≈ 60 non tenue** (60,5 avant). La cause est le tirage avec remise qui favorise la variété : il sort plus souvent les modèles à 4 ou 6 cases que ne le faisait le tirage dans 22 tuiles physiques. Mesuré sur 20 000 tirages : 63,2 avec les exemplaires du catalogue (B1 en 6, C4 en 2, K2 en 4, K4 en 1) ; 67,1 si tous les modèles pesaient 1 ; 62,2 sans K4 ; 62,0 sans pénalité de répétition (mais seulement 7,9 modèles distincts par plateau au lieu de 8,9). Voir « Décisions à soumettre ».

## 2. Constats

1. **Écart entre villes : garanti.** Sur 1000 plateaux, le plus petit nombre de pas entre deux jonctions quelconques (toutes en cases) est exactement 4, sans exception : au moins 3 cases entre deux villes, quel que soit le choix des 7 villes (36 000 configurations : 4 pas au minimum). Preuve locale, relue dans le graphe par le test : une jonction ne touche que des cases à port (R1 : une case à port touche une seule jonction), deux cases à port ne sont jamais voisines (R2, R3), donc tout trajet jonction - jonction est « case à port, case sans port, case à port » au moins : 4 pas. La garantie ne dépend pas du tirage : elle tient aussi quand un modèle est répété. Témoin négatif : des centrales en anneau (R2 violée) donnent un écart de 3 pas.
2. **Équilibre : bon, un peu moins serré.** S moyen 2,19 (2,09 avant) ; écart max (rangs 1 à 7) de 1 pas dans 87,8 % des configurations, de 2 pas dans 5,1 %, de 3 pas dans 7 configurations sur 36 000 (0,02 %), jamais 4. Aux rangs 1 et 2 l'écart est nul dans 99,8 % et 97,0 % des configurations.
3. **Première ville : l'invariant « à égalité » n'est plus absolu.** La première ville est à 2 pas des deux joueurs dans 99,98 % (vert) et 99,8 % (rouge) des configurations ; elle est à des distances différentes dans 72 configurations sur 36 000 (0,2 %), contre 0 avant. Le générateur écarte ces cas (cause « première ville » : 3 essais rejetés sur 10 004 en mode par défaut).
4. **« 5 contre 2 » : 4,1 % des configurations** (36 combinaisons de jonctions-cases tirées uniformément ; 3,1 % avant), et c'est presque entièrement le choix des 2 jonctions-cases. Trois combinaisons n'en ont jamais : les paires de la rangée centrale (1,2)+(2,2), (1,2)+(3,2), (2,2)+(3,2) (S moyen 1,32 à 1,58) ; les deux jonctions-cases dans la même rangée extérieure en ont 9,4 à 12,9 % (S moyen 2,8 à 3,7). Tout plateau a au moins une combinaison non bloquée (1000 sur 1000) ; 77,7 % n'en bloquent aucune, 21,3 % en bloquent 6 sur 36, 1,0 % en bloquent 21. Le meilleur S atteignable par plateau vaut 0 (61,9 %), 1 (28,0 %), 2 (7,7 %), 3 (2,0 %) ou 4 (0,4 %). Aucun modèle ne dégrade l'équilibre à lui seul (plus grand écart de S moyen avec / sans un modèle : 0,34, B3). **Modes du générateur** (docs/22) : par défaut (3 paires de la rangée centrale) 0 % de « 5 contre 2 », S moyen 1,47, S ≥ 5 : 0,9 % ; « jonctions variées » (30 paires : toutes sauf les 6 d'une même rangée extérieure) 2,7 % de « 5 contre 2 » avant filtre, S moyen 1,97, S ≥ 5 : 1,9 %.
5. **Générateur : valide, plateaux variés.** 50 graines sur 50 (graines « v2-0 » à « v2-49 », 200 candidats par défaut) donnent un plateau valide, sans erreur, dans chaque mode. Mode par défaut : S du plateau rendu 0 (8 fois) ou 1 (42 fois), aucun « 5 contre 2 » ; rejets sur 10 004 essais : connexité 1, première ville 3, aucun autre. Mode « jonctions variées » : S 0 (10 fois) ou 1 (40 fois), rejets « plateau très déséquilibré » 311 sur 10 316 essais (autres rejets : connexité 1, écart 1, première ville 3). Un plateau généré compte en moyenne 8,7 modèles distincts sur 16 tuiles (un modèle jamais plus de 7 fois, B1 pesant 6 exemplaires sur 22).
6. **Raccords morts : 0,60 par plateau en moyenne, 3 au plus.** Seul le « mur » C5 en crée (côté fermé face à un raccord) : 49,6 % des plateaux n'en ont aucun, 41,3 % un, 8,5 % deux, 0,6 % trois (C5 peut maintenant être posé plusieurs fois ; le maximum est le nombre d'exemplaires de C5 posés, vérifié par le test). Jonctions reliées par moins de 2 ports : 4 plateaux sur 1000 (0,4 %), toujours la jonction centrale (2,2), entourée de centrales à 3 ports (C4 ou C6 répétés) ; avant : aucune. Le générateur pénalise ce cas.
7. **Tempo très rapide (risque annoncé par docs/19, voulu : docs/18).** Villes atteignables en 3 pas : 5,67 sur 7 (vert), 5,65 (rouge) ; en 4 pas : 6,83 et 6,80 ; en 5 pas : 7 sur 7. La première ville est à 2 pas dans la quasi-totalité des cas. La cause est structurelle : 6 cases d'apparition par joueur, toutes à 2 ou 3 pas d'une jonction.
8. **« Autoroute » du pourtour : réelle, acceptée (docs/18).** Les raccourcis relient les 12 cases d'apparition en anneau : une apparition verte et une rouge sont **toujours à 1 pas** (colonnes de gauche et de droite). Jusqu'à la rangée de jonctions du camp adverse, un joueur met en moyenne 3,0 pas par le pourtour (3 à 4) contre 4,8 à 5,0 par les colonnes 1 et 2 (4 à 10) ; le pourtour est plus court que le centre dans 98,0 % des mesures de `PM.graphe.flancs`. C'est symétrique (les deux joueurs en profitent), donc sans effet sur S.
9. **Goulets.** Placement de référence (1,2)+(3,2), villes non traversables : au moins 2 chemins disjoints des apparitions d'un joueur vers chaque ville dans 99,6 % des cas (exactement 3 dans 79,7 %, 4 dans 1,9 %, 2 dans 18,0 %) ; un seul chemin dans 0,4 % des cas (8 sur 2 000) et un point d'articulation dans 0,4 % des cas ; aucun avant.
10. **Raccords seuls.** Sans passer par les jonctions, les raccords relient toutes les cases dans 1000 plateaux sur 1000 (mesuré sur les 1000 plateaux de référence).

## 3. Seuils figés (docs/22, avis de l'advisor design de jeu)

Seuils codés dans `src/graphe.js`, **inchangés** : valables pour le 4×4 (le 5×5 sera mesuré à part : seuils provisoires identiques, S d'alerte à fixer au 95e centile des plateaux acceptés). Les pourcentages sont ceux du tirage avec répétition.

| Critère | Seuil | Part des configurations (36 000) | Argument |
|---|---|---|---|
| « 5 contre 2 » | **blocage** | 4,1 % (3,1 % avant) | Évitable à coup sûr : au moins 15 combinaisons sur 36 par plateau, et les 3 paires de la rangée centrale n'en ont jamais. Le message conseille la rangée centrale pour les jonctions-cases. |
| Écart max > 3 (≥ 4 pas) | **blocage** | 0 % | Filet pour les tuiles libres, sans coût sur le catalogue. |
| Écart max > 2 (= 3 pas) | **alerte** | 0,02 % (7 configurations) | Presque jamais atteint avec le catalogue, utile pour les tuiles libres. Un écart d'au moins 2 pas touche 5,1 % des configurations pour un seul pas de plus : bruit, pas de signal. |
| **S ≥ 5** | **alerte** | 4,3 % (2,7 % avant) | Remplace S ≥ 4 (14,8 % des configurations, trop bruyant). Actionnable : le meilleur S atteignable est ≤ 2 pour 97,6 % des plateaux (99,1 % avant). |
| S = 4 | **information**, sans alerte | 10,4 % | Affiché dans le rapport d'équilibre. |
| « 4 contre 3 » | aucune alerte | 33,4 % | Partage normal de 7 villes. |
| Première ville inégale | alerte | 0,2 % (0 % avant) | Ne se déclenche plus seulement pour des tuiles libres : quelques plateaux tirés avec répétition la déclenchent. |
| Tempo (villes à ≤ 3 pas) | information | 5,7 villes sur 7 à ≤ 3 pas | Tempo voulu (docs/18). |

**Générateur** (4×4) : par défaut les 2 jonctions-cases sont tirées au hasard parmi les 3 paires de la rangée centrale ; l'option « jonctions variées » ouvre les 30 paires qui ne sont pas deux jonctions d'une même rangée extérieure. Le blocage « 5 contre 2 » reste un filtre dans les deux modes. Le seuil de blocage « écart max > 3 » ne sera éprouvé qu'avec des tuiles libres ou le 5×5.

## 4. Décisions prises

1. **Autoroute du pourtour** (constat 8) : acceptée, aucun changement (docs/18).
2. **Tempo** (constat 7) : voulu, aucun changement (docs/18).
3. **Murs et raccords morts** : C5 gardé (un seul mur possible, goulet intéressant) ; B2 reste supprimé. Raccords morts 0,60 par plateau, tous dus à C5.
4. **Retours après essai** (docs/18) : poses illimitées (le tirage de référence est celui du générateur), K1 et K3 retirés, B4 refait, K4 ajouté, aucune poche. Cases par plateau 63,1 au lieu de ≈ 60 : à arbitrer par l'utilisateur.

---

## Tableaux de mesure


Généré par `outils/mesures-equilibre.js` (graine 20261015) : 1000 plateau(x) 4×4 tiré(s) du catalogue réel `PM.catalogue.nouveauDocument()`, 36 combinaisons de 2 jonctions-cases par plateau (7 villes sur les 7 autres jonctions), soit 36000 configurations.

Plateaux tirés comme dans `tests/catalogue.test.js` : tirage du générateur (`PM.generateur.tirerTuiles`) : modèles tirés avec remise, poids = exemplaires, pénalité de répétition (poids divisé par (1 + 0,5 × usages)) qui favorise la variété, bords et coins tournés vers l'extérieur, centrales en rotation aléatoire. Villes non traversables (règle du jeu). D(k) : distance du rang k de villes, depuis la case d'apparition la plus proche de chaque joueur. S = somme des |D1(k) − D2(k)| sur les rangs 1 à 7 ; « écart max » = plus grand |D1(k) − D2(k)| sur les rangs 1 à 7 ; « 5 contre 2 » = un joueur strictement plus proche de 5 villes ou plus.

Seuils actuellement codés dans `src/graphe.js` (figés par docs/22) : blocage si « 5 contre 2 » ou écart max > 3 ; alerte si écart max > 2 ou S ≥ 5 (S = 4 : information seulement).

### 1. Cases par plateau

Cases des 16 tuiles + 2 jonctions-cases (cible ≈ 60, docs/20) :
```
valeur |       n |      % |
    57 |       1 |   0.1 % | 
    58 |       5 |   0.5 % | 
    59 |      19 |   1.9 % | #
    60 |      57 |   5.7 % | ###
    61 |     107 |  10.7 % | #####
    62 |     180 |  18.0 % | #########
    63 |     212 |  21.2 % | ###########
    64 |     193 |  19.3 % | ##########
    65 |     111 |  11.1 % | ######
    66 |      83 |   8.3 % | ####
    67 |      22 |   2.2 % | #
    68 |       9 |   0.9 % | 
    69 |       1 |   0.1 % | 
```
Moyenne : 63.13 cases.

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

36000 configurations. Moyenne 2.19.
```
valeur |       n |      % |
     0 |    2561 |   7.1 % | ####
     1 |    8594 |  23.9 % | ############
     2 |   11478 |  31.9 % | ################
     3 |    8057 |  22.4 % | ###########
     4 |    3751 |  10.4 % | #####
     5 |    1262 |   3.5 % | ##
     6 |     259 |   0.7 % | 
     7 |      35 |   0.1 % | 
     8 |       3 |   0.0 % | 
```
Part des configurations selon S :

| S ≥ | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|
| Configurations | 69.0 % | 37.1 % | 14.8 % | 4.3 % | 0.8 % | 0.1 % |

### 4. Écart par rang (1 à 7)

Écart |D1(k) − D2(k)| au rang k, sur toutes les configurations :

| Rang | Écart moyen | = 0 | = 1 | = 2 | = 3 | ≥ 4 |
|---|---|---|---|---|---|---|
| 1 | 0.00 | 99.8 % | 0.2 % | 0.0 % | 0.0 % | 0.0 % |
| 2 | 0.03 | 97.0 % | 3.0 % | 0.0 % | 0.0 % | 0.0 % |
| 3 | 0.26 | 73.6 % | 26.4 % | 0.0 % | 0.0 % | 0.0 % |
| 4 | 0.61 | 38.7 % | 61.1 % | 0.2 % | 0.0 % | 0.0 % |
| 5 | 0.27 | 73.1 % | 26.4 % | 0.5 % | 0.0 % | 0.0 % |
| 6 | 0.51 | 49.3 % | 50.4 % | 0.3 % | 0.0 % | 0.0 % |
| 7 | 0.50 | 54.7 % | 41.0 % | 4.2 % | 0.0 % | 0.0 % |

### 5. Écart max (rangs 1 à 7)
```
valeur |       n |      % |
     0 |    2561 |   7.1 % | ####
     1 |   31606 |  87.8 % | ############################################
     2 |    1826 |   5.1 % | ###
     3 |       7 |   0.0 % | 
```
| Écart max ≥ | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Configurations | 92.9 % | 5.1 % | 0.0 % | 0.0 % |

### 6. Partage des villes (« 5 contre 2 », « 4 contre 3 »)

« 5 contre 2 » (ou pire) : 1488 configurations sur 36000 (4.1 %). « 4 contre 3 » : 12020 (33.4 %). Villes à égalité de distance : 1.39 en moyenne sur 7.

Partage (plus proches du joueur le mieux placé contre l'autre) :
```
valeur |       n |      % |
5 contre 1 (+1 égalité) |     456 |   1.3 % | #
4 contre 2 (+1 égalité) |    6480 |  18.0 % | #########
5 contre 2 |    1002 |   2.8 % | #
3 contre 3 (+1 égalité) |    7771 |  21.6 % | ###########
4 contre 3 |    4280 |  11.9 % | ######
3 contre 2 (+2 égalité) |   11466 |  31.9 % | ################
4 contre 1 (+2 égalité) |    1260 |   3.5 % | ##
3 contre 1 (+3 égalité) |    1302 |   3.6 % | ##
2 contre 2 (+3 égalité) |    1953 |   5.4 % | ###
6 contre 1 |      30 |   0.1 % | 
```
### 7. Première ville et tempo

Distance de la première ville (la plus proche), joueur vert :
```
valeur |       n |      % |
     2 |   35992 | 100.0 % | ##################################################
     3 |       8 |   0.0 % | 
```
Joueur rouge :
```
valeur |       n |      % |
     2 |   35936 |  99.8 % | ##################################################
     3 |      64 |   0.2 % | 
```
Écart sur la première ville (|D1(1) − D2(1)|) :
```
valeur |       n |      % |
     0 |   35928 |  99.8 % | ##################################################
     1 |      72 |   0.2 % | 
```
Nombre moyen de villes atteignables en au plus n pas :

| Pas | Vert | Rouge |
|---|---|---|
| ≤ 3 | 5.67 | 5.65 |
| ≤ 4 | 6.83 | 6.80 |
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
| vert | pourtour | 3.05 | 3 | 4 |
| vert | centre | 4.80 | 4 | 10 |
| rouge | pourtour | 3.04 | 3 | 4 |
| rouge | centre | 4.99 | 4 | 10 |

**c.** `PM.graphe.flancs` (toutes les jonctions portent une ville ; sous-graphe « flancs » = tuiles du pourtour, « centre » = colonnes 1 et 2) :

| Cas | Mesures | Pourtour plus court que le centre | Pourtour − centre moyen |
|---|---|---|---|
| Villes non traversables (règle) | 2000 | 1961 (98.0 %) | -1.76 |
| Villes traversables (comparaison) | 2000 | 1961 (98.0 %) | -1.85 |

### 9. Raccords morts et jonctions mal reliées

Raccords morts par plateau (voisin posé sans raccord en face) :
```
valeur |       n |      % |
     0 |     496 |  49.6 % | #########################
     1 |     413 |  41.3 % | #####################
     2 |      85 |   8.5 % | ####
     3 |       6 |   0.6 % | 
```
Moyenne 0.60. Jonctions reliées par moins de 2 ports :
```
valeur |       n |      % |
     0 |     996 |  99.6 % | ##################################################
     1 |       4 |   0.4 % | 
```
### 10. Sensibilité par modèle

Pour chaque modèle : plateaux où il est posé / non posé, S moyen (moyenne sur les 36 combinaisons), part de configurations « 5 contre 2 » et d'écart max > 2.

| Modèle | Plateaux avec | S moyen avec | S moyen sans | 5 contre 2 avec | 5 contre 2 sans | Écart max > 2 avec | Écart max > 2 sans |
|---|---|---|---|---|---|---|---|
| C1 Étoile | 493 | 2.08 | 2.29 | 3.2 % | 5.0 % | 0.0 % | 0.0 % |
| C2 Zigzag | 504 | 2.24 | 2.14 | 4.3 % | 4.0 % | 0.0 % | 0.0 % |
| C3 Deux ponts | 481 | 2.27 | 2.11 | 4.7 % | 3.6 % | 0.0 % | 0.0 % |
| C4 Trident | 773 | 2.17 | 2.26 | 4.4 % | 3.2 % | 0.0 % | 0.1 % |
| C5 Étoile fermée | 508 | 2.15 | 2.23 | 3.6 % | 4.7 % | 0.0 % | 0.0 % |
| C6 Chaîne | 492 | 2.28 | 2.11 | 4.7 % | 3.6 % | 0.0 % | 0.0 % |
| B1 Bord en V | 1000 | 2.19 | n/a | 4.1 % | n/a | 0.0 % | n/a |
| B3 Bord en Y | 730 | 2.28 | 1.94 | 4.9 % | 2.0 % | 0.0 % | 0.0 % |
| B4 Bord en losange | 718 | 2.20 | 2.18 | 4.0 % | 4.5 % | 0.0 % | 0.0 % |
| B5 Bord décalé | 698 | 2.17 | 2.24 | 4.0 % | 4.4 % | 0.0 % | 0.0 % |
| B6 Bord en triangle | 738 | 2.20 | 2.16 | 4.2 % | 4.1 % | 0.0 % | 0.1 % |
| K2 Coin à relais | 1000 | 2.19 | n/a | 4.1 % | n/a | 0.0 % | n/a |
| K4 Coin en losange | 771 | 2.19 | 2.19 | 4.4 % | 3.3 % | 0.0 % | 0.1 % |

### 11. Les 36 combinaisons de jonctions-cases

| Jonctions-cases | S moyen | S ≥ 4 | S ≥ 5 | Écart max > 2 | Écart max > 3 | 5 contre 2 |
|---|---|---|---|---|---|---|
| (1,1)+(2,1) | 3.24 | 39.7 % | 15.4 % | 0.1 % | 0.0 % | 9.4 % |
| (1,1)+(3,1) | 2.83 | 27.9 % | 8.8 % | 0.0 % | 0.0 % | 9.4 % |
| (1,1)+(1,2) | 1.83 | 6.8 % | 1.1 % | 0.0 % | 0.0 % | 1.0 % |
| (1,1)+(2,2) | 1.95 | 9.0 % | 2.0 % | 0.0 % | 0.0 % | 2.5 % |
| (1,1)+(3,2) | 2.22 | 12.4 % | 2.5 % | 0.0 % | 0.0 % | 6.5 % |
| (1,1)+(1,3) | 1.67 | 5.7 % | 1.0 % | 0.0 % | 0.0 % | 1.0 % |
| (1,1)+(2,3) | 1.99 | 10.2 % | 2.2 % | 0.0 % | 0.0 % | 1.0 % |
| (1,1)+(3,3) | 1.70 | 5.3 % | 0.8 % | 0.0 % | 0.0 % | 1.0 % |
| (2,1)+(3,1) | 3.42 | 44.8 % | 17.6 % | 0.1 % | 0.0 % | 9.4 % |
| (2,1)+(1,2) | 2.14 | 11.2 % | 1.5 % | 0.1 % | 0.0 % | 1.0 % |
| (2,1)+(2,2) | 2.37 | 14.4 % | 2.5 % | 0.1 % | 0.0 % | 2.5 % |
| (2,1)+(3,2) | 2.54 | 17.6 % | 5.2 % | 0.1 % | 0.0 % | 6.5 % |
| (2,1)+(1,3) | 1.76 | 5.7 % | 1.3 % | 0.1 % | 0.0 % | 1.0 % |
| (2,1)+(2,3) | 1.46 | 3.4 % | 0.8 % | 0.0 % | 0.0 % | 1.0 % |
| (2,1)+(3,3) | 1.95 | 8.2 % | 1.7 % | 0.1 % | 0.0 % | 1.0 % |
| (3,1)+(1,2) | 1.79 | 5.4 % | 0.6 % | 0.0 % | 0.0 % | 1.0 % |
| (3,1)+(2,2) | 1.91 | 7.8 % | 1.4 % | 0.0 % | 0.0 % | 2.5 % |
| (3,1)+(3,2) | 2.18 | 11.9 % | 2.6 % | 0.0 % | 0.0 % | 6.5 % |
| (3,1)+(1,3) | 1.53 | 4.1 % | 0.7 % | 0.0 % | 0.0 % | 1.0 % |
| (3,1)+(2,3) | 1.77 | 6.4 % | 1.0 % | 0.0 % | 0.0 % | 1.0 % |
| (3,1)+(3,3) | 1.62 | 4.4 % | 0.6 % | 0.0 % | 0.0 % | 1.0 % |
| (1,2)+(2,2) | 1.58 | 6.0 % | 1.5 % | 0.0 % | 0.0 % | 0.0 % |
| (1,2)+(3,2) | 1.32 | 3.1 % | 0.2 % | 0.0 % | 0.0 % | 0.0 % |
| (1,2)+(1,3) | 2.40 | 14.8 % | 3.8 % | 0.0 % | 0.0 % | 9.6 % |
| (1,2)+(2,3) | 2.74 | 24.2 % | 6.4 % | 0.0 % | 0.0 % | 9.6 % |
| (1,2)+(3,3) | 2.41 | 14.2 % | 3.3 % | 0.0 % | 0.0 % | 9.6 % |
| (2,2)+(3,2) | 1.51 | 4.0 % | 1.0 % | 0.0 % | 0.0 % | 0.0 % |
| (2,2)+(1,3) | 2.05 | 9.4 % | 1.9 % | 0.0 % | 0.0 % | 2.6 % |
| (2,2)+(2,3) | 2.44 | 14.3 % | 3.0 % | 0.0 % | 0.0 % | 2.6 % |
| (2,2)+(3,3) | 2.10 | 10.8 % | 1.8 % | 0.0 % | 0.0 % | 2.6 % |
| (3,2)+(1,3) | 1.91 | 7.1 % | 1.2 % | 0.0 % | 0.0 % | 2.1 % |
| (3,2)+(2,3) | 2.25 | 12.6 % | 3.0 % | 0.0 % | 0.0 % | 2.1 % |
| (3,2)+(3,3) | 1.93 | 7.2 % | 1.2 % | 0.0 % | 0.0 % | 2.1 % |
| (1,3)+(2,3) | 3.74 | 56.0 % | 25.7 % | 0.0 % | 0.0 % | 12.9 % |
| (1,3)+(3,3) | 3.10 | 35.2 % | 11.4 % | 0.0 % | 0.0 % | 12.9 % |
| (2,3)+(3,3) | 3.51 | 49.8 % | 19.2 % | 0.0 % | 0.0 % | 12.9 % |

Modes du générateur (une paire autorisée tirée au hasard, avant le filtre du critère) :

| Mode | Paires | S moyen | S ≥ 4 | S ≥ 5 | 5 contre 2 |
|---|---|---|---|---|---|
| Par défaut (rangée centrale) | 3 | 1.47 | 4.4 % | 0.9 % | 0.0 % |
| Jonctions variées | 30 | 1.97 | 9.3 % | 1.9 % | 2.7 % |

Meilleure combinaison : (1,2)+(3,2) (S moyen 1.32) ; la moins bonne : (1,3)+(2,3) (S moyen 3.74).

### 11b. Goulets

Placement de référence (1,2)+(3,2) (jonctions-cases dans la rangée centrale), villes non traversables : 2000 cas (un par joueur et par plateau). Chemins sans case commune (hors les cases d'apparition) entre les apparitions d'un joueur et chaque ville ; points d'articulation : case dont le retrait coupe au moins une ville de toutes les apparitions du joueur.

Minimum, sur les 7 villes, du nombre de chemins disjoints :
```
valeur |       n |      % |
     1 |       8 |   0.4 % | 
     2 |     360 |  18.0 % | #########
     3 |    1593 |  79.7 % | ########################################
     4 |      39 |   1.9 % | #
```
Nombre de chemins disjoints, toutes villes :
```
valeur |       n |      % |
     1 |       8 |   0.1 % | 
     2 |     378 |   2.7 % | #
     3 |    4699 |  33.6 % | #################
     4 |    8915 |  63.7 % | ################################
```
Points d'articulation : au moins un dans 0.4 % des cas ; un point qui coupe au moins 2 villes dans 0.0 % ; nombre moyen par cas 0.01.

### 12. Seuils : ce que chaque seuil attraperait

Part des configurations (une configuration = un plateau et un choix de 2 jonctions-cases) touchées par chaque critère candidat :

| Critère | Configurations touchées |
|---|---|
| « 5 contre 2 » | 4.1 % |
| Écart max ≥ 2 | 5.1 % |
| Écart max ≥ 3 | 0.0 % |
| Écart max ≥ 4 | 0.0 % |
| S ≥ 4 (information) | 14.8 % |
| S ≥ 5 (alerte) | 4.3 % |
| S ≥ 6 | 0.8 % |
| S ≥ 7 | 0.1 % |
| Blocage actuel (« 5 contre 2 » ou écart max > 3) | 4.1 % |

Par plateau : 1000 plateau(x) sur 1000 (100.0 %) ont au moins une combinaison de jonctions-cases non bloquée ; 777 (77.7 %) n'en ont aucune bloquée. Nombre de combinaisons bloquées sur 36 :
```
valeur |       n |      % |
     0 |     777 |  77.7 % | #######################################
     6 |     213 |  21.3 % | ###########
    21 |      10 |   1.0 % | #
```
Meilleur S atteignable par plateau (minimum sur les combinaisons) :
```
valeur |       n |      % |
     0 |     619 |  61.9 % | ###############################
     1 |     280 |  28.0 % | ##############
     2 |      77 |   7.7 % | ####
     3 |      20 |   2.0 % | #
     4 |       4 |   0.4 % | 
```
### 13. Diversité

894 profils de distances distincts (« D1 trié | D2 trié ») sur 36000 configurations.

