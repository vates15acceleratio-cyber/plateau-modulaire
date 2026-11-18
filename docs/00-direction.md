# Direction du projet : plateau hexagonal (2026-11-18)

Ce document remplace l'ancien `docs/18-decisions-v2.md`, archivé avec l'outil de plateau carré dans `archives/plateau-carre/docs/`. Pour l'historique, le dépôt garde l'étiquette git `5.00.0` (dernière version de l'outil carré).

## Objectif
Concevoir le matériel d'un jeu de plateau pour 2 joueurs (« Bannerlord ») : **tuiles hexagonales modulaires, cartes, jetons**. Le plateau est assemblé à la main à partir des tuiles ; l'outil ne le crée pas.

## Plateau hexagonal
- **Strictement hexagonal et modulaire.** Une **tuile = une case de déplacement**.
- **Terrains** envisagés : plaine, forêt, marais, montagne.
- **Environ 90 tuiles** au départ (un grand hexagone de côté 6 en compte 91). **Forme quelconque**, avec un **noyau dur** de quelques tuiles invariables d'une partie à l'autre.
- **Taille : 45 mm plat à plat**, pointe en haut (fourchette de l'utilisateur : 4 à 4,5 cm).
- **Rations = déplacement** : le terrain peut changer le coût de déplacement.
- **Périmètre de l'outil : les tuiles, puis les cartes et les jetons.** Pas de plateau généré.

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

## Pas encore décidé
Répartition des ~90 tuiles par terrain ; coût en rations de chaque terrain ; marquage des tuiles du noyau ; villes et campements (tuiles ou jetons, où) ; palette des terrains (la règle vert / rouge / noir / blanc de l'ancien projet s'applique-t-elle encore ?) ; montant du revenu d'or, prix du marché, nombre de rations ; versions et journal des changements du nouveau projet.

## Outils
Voir `docs/01-outils-tuiles.md`.
