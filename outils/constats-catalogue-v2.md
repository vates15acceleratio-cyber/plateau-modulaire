# Mesures du catalogue 4×4 de la version 2 (sous-agent catalogue v2), 2026-10-16

Sources : `docs/18-decisions-v2.md`, `docs/19-avis-design-v2.md`, `docs/20-avis-geometrie-v2.md`. Catalogue : `src/catalogue.js`. Tests : `tests/catalogue.test.js`. Ce document est produit par `node outils/mesures-equilibre.js` (1000 plateaux, graine 20261015, 36 combinaisons de jonctions-cases par plateau, soit 36 000 configurations). Les paragraphes « Le catalogue », « Constats », « Seuils proposés » et « Décisions à soumettre » sont rédigés à la main (fichier `outils/constats-catalogue-v2.md`, repris en tête par le script) et valent pour ce tirage de référence ; les tableaux de la dernière partie sont générés.

## 1. Le catalogue

22 tuiles, 15 modèles. Cases d'un plateau = cases des 16 tuiles + 2 jonctions-cases.

| Id | Nom | Gabarit | Tuiles | Cases | Ports | Raccords | Idée |
|---|---|---|---|---|---|---|---|
| C1 | Étoile | centrale | 1 | 5 | 4 | N, E, S, O au milieu | Relais au centre relié aux 4 cases à port : tout est à 2 pas. |
| C2 | Zigzag | centrale | 1 | 6 | 4 | N, E, S, O | Deux relais reliés ; chacun tient 2 ports voisins et 2 raccords : 3 pas d'un coin au coin opposé. |
| C3 | Deux ponts | centrale | 1 | 6 | 4 | N, E, S, O | **Deux réseaux séparés** (relais nord : ports nord, raccords N et E ; relais sud : ports sud, raccords S et O), sans lien entre eux. |
| C4 | Trident | centrale | 1 | 4 | **3** | N, E, S, O | Étoile sans port au coin SE. |
| C5 | Étoile fermée | centrale | 1 | 5 | 4 | N, E, S (ouest fermé) | Seconde étoile à 5 cases : ses raccords ne peuvent être qu'au milieu, elle ne diffère donc de C1 que par un « mur » (goulet). |
| C6 | Chaîne | centrale | 1 | 5 | 3 | N, E, S, O | Relais nord (N, E, deux ports) relié à un relais sud (S, O, un port) : 3 ports, chemin long. |
| B1 | Bord en V | bord | 5 | 3 | 2 | E0, O2 (raccourci), S1 | L'apparition tient les deux ports (2 pas jusqu'aux deux jonctions) et tous les raccords. |
| B2 | Bord fermé | bord | 1 | 3 | 2 | E0, O2 | Comme B1 sans raccord vers le centre : le second « mur » du catalogue. |
| B3 | Bord en Y | bord | 1 | 4 | 2 | E0, O2, S1 | Un relais entre l'apparition et les ports : 3 pas jusqu'aux jonctions ; le raccord S part du relais. |
| B4 | Bord en fourche | bord | 1 | 4 | 2 | E0, O2, S1 | L'apparition tient les ports ; le raccord S part d'un relais pendant. |
| B5 | Bord décalé | bord | 1 | 4 | 2 | E0, O2, S1 | Port est à 2 pas, port ouest à 3 pas (par un relais) : asymétrique. |
| B6 | Bord en triangle | bord | 1 | 4 | 2 | E0, O2, S1 | Boucle apparition - relais - port est ; le port ouest passe par le relais. |
| K1 | Coin direct | coin | 2 | 2 | 1 | E0, S2 (raccourci) | L'apparition touche la case à port (2 pas jusqu'à la jonction). |
| K2 | Coin à relais | coin | 2 | 3 | 1 | E0, S2 | Un relais entre l'apparition et la case à port (3 pas). |
| K3 | Coin à poche | coin | 2 | 3 | 1 | E0, S2 | L'apparition tient le port et les deux raccords ; une case en impasse pend à la case à port. |

Toutes les tuiles ont leurs raccords au milieu (pos 1) sur les côtés qui regardent une centrale ; les raccourcis des bords et des coins sont seuls à 30 mm du bord extérieur (bord `0x808`, coin `0x108`, docs/20 D5), et **partent tous de la case d'apparition** (docs/19). Aucun modèle ne porte d'erreur ni d'alerte de `validerModele` ; tous les tracés respectent les contrôles du test (8 mm entre chemins, r + 4 mm des autres cases, 24 mm des coins ; plus petit écart mesuré entre deux chemins : 8,6 mm, modèle B5, pour un minimum exigé de 8 mm).

**Cases par plateau** : moyenne 60,5 (57 à 64, 1000 plateaux), espérance exacte 60,53 ; cible ≈ 60 (docs/20).

## 2. Constats

1. **Écart entre villes : garanti.** Sur 1000 plateaux, le plus petit nombre de pas entre deux jonctions quelconques (toutes en cases) est exactement 4, sans exception : au moins 3 cases entre deux villes, quel que soit le choix des 7 villes (36 000 configurations : 4 pas au minimum). Preuve locale, relue dans le graphe par le test : une jonction ne touche que des cases à port (R1 : une case à port touche une seule jonction), deux cases à port ne sont jamais voisines (R2, R3), donc tout trajet jonction - jonction est « case à port, case sans port, case à port » au moins : 4 pas. Témoin négatif : des centrales en anneau (R2 violée) donnent un écart de 3 pas.
2. **Équilibre : bon.** S moyen 2,16 ; écart max (rangs 1 à 7) de 1 pas dans 87,5 % des configurations, de 2 pas dans 5,7 %, de 3 pas dans 1 configuration sur 36 000, jamais 4. Aux rangs 1 et 2 l'écart est nul (100 % et 99,5 %). La première ville est à 2 pas des deux joueurs dans les 36 000 configurations : l'invariant « première ville à égalité » tient toujours.
3. **« 5 contre 2 » : 3,5 % des configurations, et c'est presque entièrement le choix des 2 jonctions-cases.** Trois combinaisons n'en ont jamais : les paires de la rangée centrale (1,2)+(2,2), (1,2)+(3,2), (2,2)+(3,2) (S moyen 1,22 à 1,43) ; les deux jonctions-cases dans la même rangée extérieure en ont 8,7 à 9,5 % (S moyen 3,0 à 3,6). Tout plateau a au moins une combinaison non bloquée (1000 sur 1000, au moins 15 sur 36) ; 81,8 % n'en bloquent aucune, 17,1 % en bloquent 6 sur 36, 1,1 % en bloquent 21. Le meilleur S atteignable par plateau vaut 0 (57,6 %), 1 (32,3 %), 2 (9,0 %), 3 ou 4 (1,1 %). Aucun modèle ne dégrade l'équilibre à lui seul (plus grand écart de S moyen avec / sans un modèle : 0,26, B3).
4. **Générateur : valide.** 50 graines sur 50 donnent un plateau valide (graines « v2-0 » à « v2-49 », 200 candidats par défaut) ; S du plateau rendu : 0 (11 fois) ou 1 (39 fois) ; 3,6 % des essais rejetés (« plateau très déséquilibré » 370 fois, écart > 2 : 2 fois), aucun pour villes proches, connexité ou ville inaccessible.
5. **Raccords morts : 1,41 par plateau en moyenne, 2 au plus.** Seuls les deux « murs » en créent (côté fermé de B2 ou de C5 face à un raccord) : au plus un chacun ; 8,8 % des plateaux n'en ont aucun (ni B2 ni C5), 41,4 % en ont 1, 49,8 % en ont 2. Jonctions reliées par moins de 2 ports : aucune ; jonctions à 2 ports : 33 sur 9000 (0,4 %).
6. **Tempo très rapide (risque annoncé par docs/19).** Villes atteignables en 3 pas : 5,73 sur 7 (vert), 5,72 (rouge) ; en 4 pas : 6,80 et 6,80 ; en 5 pas : 7 sur 7. La première ville est à 2 pas dans 100 % des cas. La cause est structurelle : 6 cases d'apparition par joueur, toutes à 2 ou 3 pas d'une jonction.
7. **« Autoroute » du pourtour : réelle.** Les raccourcis relient les 12 cases d'apparition en anneau : une apparition verte et une rouge sont **toujours à 1 pas** (colonnes de gauche et de droite : apparitions de (0,1) et (0,2), de (3,1) et (3,2)). Jusqu'à la rangée de jonctions du camp adverse, un joueur met en moyenne 3,0 pas par le pourtour (3 à 4) contre 5,1 par les colonnes 1 et 2 (4 à 9) ; le pourtour est plus court que le centre dans 99,1 % des mesures de `PM.graphe.flancs`. C'est symétrique (les deux joueurs en profitent), donc sans effet sur S, mais cela change la nature du jeu : un groupe qui apparaît sur un flanc touche une case d'apparition adverse. Voir « Décisions à soumettre ».
8. **Goulets.** Placement de référence (1,2)+(3,2), villes non traversables : au moins 2 chemins disjoints des apparitions d'un joueur vers chaque ville (3 ou plus dans 79,1 % des cas), aucun point d'articulation sur 2000 cas.
9. **Raccords seuls.** Sans passer par les jonctions, les raccords relient toutes les cases dans 996 plateaux sur 1000 ; dans les 4 autres, un des deux réseaux de C3 est coupé par deux murs (il reste relié par ses ports).

## 3. Seuils proposés (à valider par l'advisor design de jeu)

Seuils actuels de `src/graphe.js` : blocage si « 5 contre 2 » ou écart max > 3 ; alerte si écart max > 2 ou S ≥ 4 ; rien pour « 4 contre 3 ».

| Critère | Seuil actuel | Part des configurations (36 000) | Proposition | Argument |
|---|---|---|---|---|
| « 5 contre 2 » | blocage | 3,5 % | **garder en blocage** | Évitable à coup sûr : chaque plateau a au moins 15 combinaisons de jonctions-cases sur 36 sans « 5 contre 2 », et 3 combinaisons (rangée centrale) n'en ont jamais. Le message peut conseiller de placer les jonctions-cases dans la rangée centrale. |
| Écart max > 3 (≥ 4 pas) | blocage | 0 % | **garder en blocage** | Jamais atteint avec le catalogue : filet pour les tuiles libres, sans coût sur le catalogue. Un écart de 4 pas à un rang est plus que l'ouverture entière (première ville à 2 pas). |
| Écart max > 2 (= 3 pas) | alerte | 0,003 % (1 configuration) | **garder en alerte** | Très rare avec le catalogue, utile pour les tuiles libres. Abaisser l'alerte à « écart max ≥ 2 » toucherait 5,7 % des configurations pour un écart d'un seul pas de plus : bruit, pas de signal. |
| S ≥ 4 | alerte | 12,9 % | **garder en alerte** | Actionnable : le meilleur S atteignable est ≤ 2 pour 98,9 % des plateaux, donc un plateau à S ≥ 4 se corrige presque toujours en déplaçant les 2 jonctions-cases. S ≥ 5 (3,2 %) ne signalerait plus que les cas franchement mauvais ; S ≥ 4 les signale aussi quand 4 rangs sont décalés d'un pas. À arbitrer selon le bruit toléré. |
| « 4 contre 3 » | aucun | 30,0 % | **aucune alerte** | Partage normal de 7 villes (docs/19, docs/18). |
| Première ville inégale | alerte | 0 % | garder | Invariant tenu à 100 % ; l'alerte ne se déclenche que pour des tuiles libres. |
| Tempo (villes à ≤ 3 pas) | information | 5,7 villes sur 7 à ≤ 3 pas | information seulement | Pas de seuil possible sans décision sur le tempo voulu (voir ci-dessous). |

Le seuil de blocage « écart max > 3 » ne se déclenche jamais avec ce catalogue ; il ne sera éprouvé qu'avec des tuiles libres ou le 5×5. Les seuils de ce rapport valent pour le 4×4 seulement (docs/19 : refaire la mesure sur 1000 plateaux 5×5).

## 4. Décisions à soumettre

1. **Autoroute du pourtour** (constat 7). Options :
   - *Accepter* : le pourtour est un circuit commun aux deux camps, les groupes apparaissent au contact de l'adversaire ; avantage : aucune modification, cohérent avec la vision « coins utiles » ; inconvénient : un groupe vert sur un flanc touche une apparition rouge, la partie démarre au corps à corps.
   - *Supprimer le raccourci entre les deux camps* (côtés nord / sud des tuiles des colonnes de gauche et de droite, entre les rangées 1 et 2) : il faudrait des bords sans raccourci du côté de la frontière, donc des tuiles non réversibles et une règle de pose (contraire à « une même tuile de bord va des deux côtés ») ;
   - *Raccourci sur un seul côté du bord* (par exemple E seulement, sens horaire) : le pourtour devient un sens unique et la frontière est coupée une fois sur deux ; le raccourci de coin et de bord perd sa réversibilité (docs/20 D5).
2. **Tempo** (constat 6). Première ville à 2 pas, 5,7 villes sur 7 à 3 pas au plus : à confirmer avec l'utilisateur. Levier : relais obligatoire entre l'apparition et les ports (comme B3 ou K2, 3 pas) sur plus de tuiles ; moins de cases d'apparition par joueur n'est pas possible en grille pleine (docs/18).
3. **Murs et raccords morts.** La seconde étoile à 5 cases demandée (C5) ne peut différer de C1 que par un côté fermé ; avec B2 cela donne 1,41 raccord mort par plateau (2 au plus). Si ce niveau gêne : remplacer B2 par un 6e exemplaire de B1 (0,68 raccord mort par plateau, 60,5 cases, mesuré sur les mêmes 1000 tirages ; un modèle de bord de moins, 5 au lieu de 6) ; ou accepter une seconde étoile qui ne soit que la copie de C1 (moins de variété, aucun mur).
