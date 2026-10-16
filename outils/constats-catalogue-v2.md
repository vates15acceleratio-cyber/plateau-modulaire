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
