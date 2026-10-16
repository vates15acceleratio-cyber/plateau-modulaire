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
