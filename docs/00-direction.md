# Direction du projet : plateau hexagonal (2026-11-18)

Ce document remplace l'ancien `docs/18-decisions-v2.md`, archivé avec l'outil de plateau carré dans `archives/plateau-carre/docs/`. Pour l'historique, le dépôt garde l'étiquette git `5.00.0` (dernière version de l'outil carré).

## Objectif
Concevoir le matériel d'un jeu de plateau pour 2 joueurs (« Bannerlord ») : **tuiles hexagonales modulaires, cartes, jetons**. Le plateau est assemblé à la main à partir des tuiles ; l'outil ne le crée pas.

## Plateau hexagonal
- **Strictement hexagonal et modulaire.** Une **tuile = une case de déplacement**.
- **Forme quelconque**, avec un **noyau dur** de quelques tuiles invariables d'une partie à l'autre. **Environ 90 cases** au départ (un grand hexagone de côté 6 en compte 91).
- **Tuiles simples (une case)** : plaine, forêt, marais. **Plus de plaines que de forêts ou de marais ; autant de marais que de forêts.**
- **Montagnes** (décision du 2026-11-18) : **blocs de 4 ou 5 hexagones d'un seul tenant, infranchissables** ; 3 blocs au plus, **2 retenus** pour l'exemple.
- **Tuiles de ville** : il en faut ; leur nombre reste à confirmer. **Cases de réapparition** : l'utilisateur ne s'est pas décidé, rien n'est dessiné.
- **Taille : 45 mm plat à plat**, pointe en haut (fourchette de l'utilisateur : 4 à 4,5 cm).
- **Rations = déplacement** : le terrain peut changer le coût de déplacement.
- **Périmètre de l'outil** : les tuiles, les cartes et les jetons, et depuis le 2026-11-19 un **atelier du plateau** (`atelier/`) qui assemble des plateaux à partir du catalogue de tuiles et sert de table pour des parties fictives. La décision « pas de plateau généré » du 2026-11-18 est levée.

## Règles de jeu : ce qui reste valable (règles V2.3, `regles/`)
- **Gloire** : 15 points. +1 bataillon éliminé ; +1 pour plus de dégâts infligés (les deux joueurs marquent en cas d'égalité, même si son bataillon est éliminé) ; +2 ville neutre capturée ; reprise d'une ville ennemie : +2 pour soi, l'adversaire perd 2 (jamais sous 0).
- **Combat aux dés (d6)** : toutes les Troupes du bataillon lancent leurs dés ; des effets selon les résultats ; dégâts comptés avant la pose des marqueurs (valeur 1 ou 3) ; le **moral** d’une Troupe tombe à 0 → éliminée ; si les dégâts atteignent le moral restant du bataillon, il est éliminé ; les marqueurs persistent.
- **Attaque** : 1 action, bataillon **adjacent** seulement ; elle termine le tour ; le contact ne déclenche pas de combat.
- **4 bataillons** par joueur, 1 à 3 Troupes chacun, 1 par case. Capture d'une ville : un tour complet sur place.
- **Cartes** : main limitée à 5 (aucune pioche à 5 cartes) ; plusieurs effets d'une carte résolus dans l'ordre, indépendants ; effet impossible : on en fait autant que possible.
- **Campements** : un bataillon qui s'arrête sur un campement pioche une carte Campement jouée aussitôt, **une seule fois par bataillon** ; la pioche Campement se remélange (défausse) quand elle est vide. 15 effets proposés dans l'annexe 2 des règles.
- **Premier joueur** : celui qui a visité un château ou une forteresse le plus récemment (à égalité, le plus âgé).
- **Retirés** : puces pouvoir, Troupes de zone, Engins de siège, pièce de monnaie.

## Obsolète (propre au plateau carré, à reprendre avec l'hexagonal)
La section 4A « Mise en place : le plateau » des règles V2.3 décrit le montage carré (pourtour d'abord, puis le centre ; 4×4 / 5×5 ; 8 villes aux croisements ; jetons recto-verso ville / campement ; camps par rangées de tuiles). **Elle est dépassée** et sera réécrite avec le plateau hexagonal. Même chose, à réexaminer, pour : les cases de déploiement du pourtour, « on renforce sur une case de déploiement ou une ville contrôlée », les villes et campements posés sur les croisements. Le fichier PDF n'est pas modifié tant que les mécaniques ne sont pas arrêtées.

## Nouvelles mécaniques (description de l'utilisateur, à préciser)
- **Dés conservés** pour les actions.
- **Or** : chaque joueur en reçoit à chaque tour. Il sert à acheter au **marché**.
- **Marché** : espace commun aux deux joueurs ; on y trouve des **troupes**, des **cartes stratégie** (effet passif, ou actif résolu immédiatement) et des **rations** (pile séparée).
- **Rations** : servent aux **déplacements** (décidé).
- **Phases d'un tour** : 1. achat de cartes au marché ; 2. déplacement des joueurs sur la carte ; 3. résolution des actions.

## Décisions du 2026-11-19 (atelier du plateau)
Elles priment sur la proposition d'inventaire du 2026-11-18 ci-dessous. Détail et traduction dans l'outil : `docs/02-atelier-cahier-des-charges.md`.
1. **Monoblocs de 3 ou 4 cases** avec forêts ou marais (par exemple 3 plaines + 1 forêt, ou 3 forêts).
2. **Jamais de ville dans un monobloc**, sauf le **noyau central fixe**, qui ne change pas.
3. **Plus de tuiles de déploiement** : chaque joueur déploie sur **ses deux villes les plus proches de son côté**.
4. **3 tuiles au moins entre deux villes** (maintenu) ; les villes de déploiement sont sur le **bord haut** et le **bord bas**.
5. **Tuiles d'événement** uniques (torrent de boue, crevasse, tunnel dans la montagne…), gardées en **réserve** et posées **par-dessus** une tuile du plateau quand un joueur pioche l'événement ; elles ne servent pas à construire le plateau.
6. Chaque tuile touche **au moins 3 autres tuiles** (à voir : 2 peuvent-elles suffire ?). Mesures : `docs/03-mesures-faisabilite.md`.
7. **Parties fictives** dans l'outil : jets de dés, mélange des cartes. La conception du plateau reste la priorité.
8. **Création à la main** (même jour, après la première livraison) : mode création guidé sur plateau vierge, pinceau libre hors catalogue, monoblocs dessinés par l'utilisateur, bibliothèque de plateaux. Voir `docs/02-atelier-cahier-des-charges.md` §8.
9. **Finalité** (même jour) : un jeu pour **tester des parties en 1 contre 1 en local, deux joueurs sur le même écran**. L'outil doit être une **app transportable**, sous **Windows et Mac**. On reste sur le format web (pas de Godot) ; lanceur et empaquetage à faire après la création à la main.

## Proposition d'inventaire (à valider ; dessinée dans `tuiles/sortie/types_de_tuiles.pdf`)
Décisions de l'utilisateur du 2026-11-18 : **2 montagnes** (au lieu de 3) ; tuiles simples à **70 % de plaines, 15 % de forêts, 15 % de marais** ; **7 villes**, au moins **3 tuiles entre deux villes** voisines.

| Type | Quantité | Coût en rations (proposition) |
|---|---|---|
| Plaine | 49 tuiles | 1 |
| Forêt | 10 tuiles | 2 |
| Marais | 10 tuiles | 2 |
| Montagne | 2 blocs (5 + 4 = 9 cases) | infranchissable |
| Ville | 7 tuiles | 1 |
| Déploiement (option C, à confirmer) | 6 tuiles (3 par joueur) | 1 |
| **Total** | **91 cases** | |

Les 69 tuiles simples donnent 71 % / 14,5 % / 14,5 %, avec autant de marais que de forêts. Les formes de montagne retenues pour l'exemple sont un zigzag (4) et un peigne (5). Les coûts sont imprimés sur les tuiles simples sous forme de 1 à 2 pastilles.

Un **plateau d'exemple** de 91 cases (forme libre, noyau fixe de 7 cases, 7 villes dont une au centre, symétrie par demi-tour) est dessiné par `tuiles/essais/plateau_exemple.py` ; c'est une illustration, pas un outil de génération. Cases de déploiement : trois options comparées dans `tuiles/sortie/schema_deploiement.png`, rien décidé.

## Pas encore décidé
Nombres définitifs par type et coût en rations de chaque terrain (voir la proposition ci-dessus) ; marquage des tuiles du noyau ; cases de réapparition ; campements (tuiles ou jetons) ; palette des terrains (la règle vert / rouge / noir / blanc de l'ancien projet s'applique-t-elle encore ?) ; montant du revenu d'or, prix du marché, nombre de rations ; versions et journal des changements du nouveau projet.

## Outils
Voir `docs/01-outils-tuiles.md`.
