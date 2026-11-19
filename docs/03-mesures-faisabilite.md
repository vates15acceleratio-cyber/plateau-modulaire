# Atelier du plateau : mesures de faisabilité (2026-11-19)

Rapport du lot A (cœur du plateau), demandé par `docs/02-atelier-cahier-des-charges.md` §4.
Question de l'utilisateur : « chaque tuile doit être en contact avec 3 autres tuiles minimum pour éviter les anomalies sur les bords (voir si 2 tuiles peuvent convenir aussi) ».

## Réponse courte

- **Les deux seuils sont faisables.** Le générateur rend un plateau complet et sans erreur pour 500 graines sur 500, dans les quatre combinaisons (seuil 2 ou 3, mesure « côtés » ou « pièces »), en moins d'une demi-seconde dans le pire cas mesuré.
- **Le seuil 3 ne rend pas la forme libre impossible, mais il la rigidifie nettement.** Une case seule qui dépasse du bord n'a que 2 voisines : elle est interdite. Tout ce qui dépasse doit donc compter au moins 2 cases côte à côte ; avec le réglage actuel du générateur (3 paires de cases retouchées), cela donne presque toujours une rangée de 3 cases collée à un côté de l'hexagone. Sur 500 plateaux, on n'observe que 7 dessins d'excroissance différents au seuil 3, contre 144 au seuil 2 ; et 182 formes de bord différentes contre 497. La variété qui reste vient presque uniquement des encoches (cases retirées). Retoucher plus de cases redonne de la variété, mais le tirage devient plus lent (voir le dernier tableau).
- **Le seuil 2 donne une forme vraiment libre, au prix de ce que l'utilisateur voulait éviter** : en moyenne 5,5 tuiles par plateau ne tiennent que par 2 côtés (pointes isolées sur le bord), et dans 6 plateaux sur 10 une ville de déploiement est dans ce cas.
- **La mesure « pièces » est plus exigeante que « côtés » et ne coûte rien** en réussite ni en temps. Elle interdit en plus qu'une tuile ne touche qu'un seul monobloc par plusieurs côtés. Au seuil 3 « côtés », seuls 21 % des plateaux respectent aussi « pièces ».

Rien n'a été ajusté en silence : le réglage par défaut reste celui du cahier des charges (seuil 3, mesure « côtés »). Le choix entre 2 et 3 revient à l'utilisateur, voir « Points à trancher ».

## Ce qui a été mesuré

Commandes (depuis la racine du dépôt), sorties reprises telles quelles dans les tableaux ci-dessous :

```
node atelier/outils/mesures-faisabilite.js 500 1 1          (les trois premiers tableaux : générateur)
node atelier/outils/mesures-faisabilite.js 500 2000 30000   (les deux derniers : espace des formes, environ 15 minutes)
```

Graines 1 à 500, réglages par défaut de `AT.catalogue.REGLAGES.generateur` : hexagone de rayon 5 (91 cases), 3 paires de cases retirées du bord puis 3 paires ajoutées (symétrie par demi-tour), au plus 3 formes par graine, 24 essais de remplissage par forme, 250 échanges de tuiles simples par essai. Node 24, poste de l'utilisateur ; les temps dépendent de la machine, tout le reste est déterministe.

Les deux mesures de contact :
- **côtés** : nombre de cases voisines de la tuile occupées par une autre pièce ;
- **pièces** : nombre de pièces voisines distinctes.

Pour une tuile d'une seule case, « côtés » ne dépend que de la **forme** du plateau (toutes ses voisines sont d'autres pièces). « Pièces » dépend aussi du **remplissage** : deux voisines qui appartiennent au même monobloc ne comptent que pour une.

### Générateur : 500 graines (1 à 500) par combinaison

| Seuil | Mesure | Réussite | Temps moyen (ms) | Temps maximal (ms) | Score moyen | Score maximal | Formes de bord distinctes | Motifs d’ajout distincts |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | côtés | 500 / 500 (100,0 %) | 12,3 | 44,2 | 0,00 | 0 | 497 | 144 |
| 2 | pièces | 500 / 500 (100,0 %) | 12,1 | 47,7 | 0,00 | 0 | 497 | 144 |
| 3 | côtés | 500 / 500 (100,0 %) | 47,0 | 300,4 | 0,00 | 0 | 182 | 7 |
| 3 | pièces | 500 / 500 (100,0 %) | 47,1 | 316,1 | 0,00 | 0 | 182 | 7 |

« Motif d'ajout » : l'ensemble des cases qui dépassent de l'hexagone de départ. Les temps varient d'un lancement à l'autre selon la charge du poste (un autre lancement a donné 17 et 74 ms de moyenne, 462 ms au maximum) ; les autres colonnes sont identiques à chaque lancement.

### Détail de la recherche

| Seuil | Mesure | Essais de remplissage (moyenne) | Tirages de forme (moyenne) | Échecs : forme | montagnes | villes | monoblocs | contact | contrôles |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | côtés | 2,18 | 4,0 | 0 | 63 | 0 | 1 | 0 | 0 |
| 2 | pièces | 2,22 | 4,0 | 0 | 63 | 0 | 3 | 0 | 0 |
| 3 | côtés | 2,03 | 42,1 | 0 | 27 | 0 | 1 | 0 | 0 |
| 3 | pièces | 2,69 | 42,1 | 0 | 28 | 0 | 5 | 371 | 0 |

Les échecs sont des essais ratés puis recommencés (total sur les 500 graines), pas des graines en échec. « Montagnes » : une montagne enferme une case. « Contact » : au seuil 3 « pièces », 371 essais sont rejetés juste après la pose des montagnes et des villes, parce qu'une montagne occupe deux des voisines d'une tuile de bord qui n'en a que trois ; un essai suivant passe.

### Contact réellement obtenu sur les plateaux réussis

| Seuil | Mesure | Minimum de côtés | Minimum de pièces | Tuiles à 2 côtés ou moins (moyenne par plateau) | Tuiles à 2 pièces voisines ou moins (moyenne par plateau) | Plateaux qui respectent aussi l’autre mesure | Plateaux avec une ville de déploiement à 2 côtés ou moins | Plateaux dont la rangée du haut est faite de cases ajoutées |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | côtés | 2 | 1 | 5,51 | 6,99 | 385 / 500 (77,0 %) | 308 (61,6 %) | 61 (12,2 %) |
| 2 | pièces | 2 | 2 | 5,47 | 6,98 | 500 / 500 (100,0 %) | 305 (61,0 %) | 61 (12,2 %) |
| 3 | côtés | 3 | 1 | 0,00 | 2,48 | 106 / 500 (21,2 %) | 0 (0,0 %) | 0 (0,0 %) |
| 3 | pièces | 3 | 3 | 0,00 | 0,00 | 500 / 500 (100,0 %) | 0 (0,0 %) | 0 (0,0 %) |

Lecture : avec la mesure « côtés », on trouve des tuiles qui ne touchent qu'**une seule** pièce (minimum de pièces = 1), par exemple une plaine de coin dont les 3 voisines appartiennent au même monobloc.

### Espace des formes de bord, par seuil

| Seuil | Retouches à l’aveugle valides (sur 30000) | Formes distinctes parmi elles | Tirage guidé : formes distinctes (sur 2000 formes demandées) | Motifs d’ajout distincts | Motifs de retrait distincts | Tirages par forme (moyenne) | Échecs du tirage guidé |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2 | 1885 (6,3 %) | 1841 | 1944 | 177 | 710 | 4,0 | 0 |
| 3 | 13 (0,04 %) | 13 | 243 | 7 | 145 | 48,3 | 0 |

Ce tableau sépare la **règle** du **tirage** :
- « à l'aveugle » : on retire 3 paires de cases de bord et on en ajoute 3 au hasard, sans regarder la règle ; 6,3 % des formes conviennent au seuil 2, 0,04 % au seuil 3 (environ 150 fois moins) ;
- « tirage guidé » : celui du générateur, qui écarte en cours de route les cases menant à une impasse. Sur 2000 formes demandées, il en sort 1944 différentes au seuil 2 (l'espace est loin d'être épuisé) et seulement 243 au seuil 3 (l'espace est petit : on retombe sans cesse sur les mêmes formes).

### Effet du nombre de retouches (300 formes demandées par ligne)

| Retouches | Seuil | Formes distinctes | Motifs d’ajout distincts | Motifs de retrait distincts | Tirages par forme (moyenne) | Échecs du tirage |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 119 | 10 | 15 | 1,5 | 0 |
| 1 | 3 | 0 | 0 | 0 | 600,0 | 300 |
| 2 | 2 | 283 | 48 | 116 | 2,5 | 0 |
| 2 | 3 | 139 | 8 | 59 | 7,4 | 0 |
| 3 | 2 | 300 | 136 | 249 | 4,1 | 0 |
| 3 | 3 | 145 | 7 | 112 | 51,0 | 0 |
| 4 | 2 | 300 | 229 | 291 | 7,8 | 0 |
| 4 | 3 | 239 | 24 | 202 | 179,8 | 13 |
| 5 | 2 | 300 | 268 | 299 | 12,1 | 0 |
| 5 | 3 | 187 | 38 | 177 | 360,8 | 102 |

Lecture : au seuil 3, **une seule paire retouchée est impossible** (une case ajoutée seule n'a que 2 voisines) ; avec 2 ou 3 paires, les excroissances se réduisent à 7 ou 8 dessins (2 ou 3 cases en rangée). Passer à 4 ou 5 paires redonne de la variété (24 à 38 dessins), mais le tirage devient coûteux et échoue parfois dans la limite de 600 tirages (13 puis 102 échecs sur 300). Ces échecs-là sont une limite du tirage, pas une preuve d'impossibilité.

## Conclusion pour l'utilisateur

1. **« 3 tuiles » fonctionne.** On peut l'exiger sans jamais bloquer le générateur. Le prix est la forme : avec le réglage actuel (3 paires retouchées), le plateau ressemble à un hexagone avec quelques encoches et, sur deux côtés opposés, un bourrelet de 3 cases ; jamais de pointe d'une seule case. La règle elle-même demande seulement qu'une excroissance fasse au moins 2 cases côte à côte : avec 4 ou 5 paires retouchées on obtient 24 à 38 dessins au lieu de 7.
2. **« 2 tuiles » fonctionne aussi** et donne une forme beaucoup plus libre (presque toutes les graines donnent une forme différente). Mais il reste alors 5 à 6 tuiles par plateau tenues par 2 côtés seulement : ce sont exactement les anomalies de bord citées dans la demande. Les villes de déploiement sont les premières touchées : au seuil 2, 308 plateaux sur 500 (61,6 %) ont une ville de déploiement qui ne tient que par 2 côtés, et dans 61 plateaux (12,2 %) la « rangée du haut » n'est plus celle de l'hexagone mais quelques cases ajoutées au-dessus (exemple : graine 3, villes de Vert en (2,-6) et (6,-6), la première ne touchant que 2 cases). Au seuil 3, cela n'arrive jamais (0 sur 500).
3. **La façon de compter change le résultat.** Si « toucher 3 tuiles » veut dire « 3 morceaux de carton différents », il faut la mesure « pièces » : la mesure « côtés » laisse passer en moyenne 2,5 tuiles par plateau qui touchent 2 pièces ou moins, et parfois une seule. Si le but est seulement qu'une tuile soit calée sur 3 côtés, « côtés » suffit.
4. **Le score d'équilibre ne départage rien** : il vaut 0 sur les 2000 plateaux. Cela tient à la construction (forme et villes symétriques par demi-tour, chaque monobloc de forêt face à son jumeau de marais, puis échanges de tuiles simples pour compenser les deux montagnes, qui ne sont pas symétriques). Sans les échanges, un premier essai n'obtient 0 que 7 fois sur 100 (contrôle ponctuel hors script : graines 1 à 100, options `tentatives: 1, echanges: 0`).

## Limites de ces mesures

- **Famille de formes.** Tout est mesuré sur une seule famille : hexagone de rayon 5, 3 paires retouchées, symétrie par demi-tour. Une autre façon de dessiner le bord (plus de retouches, bord allongé, pas de symétrie) donnerait d'autres chiffres ; le dernier tableau en donne un aperçu.
- **Générateur plus strict que le contrôle.** Le générateur exige que chaque **case** ait au moins « seuil » cases voisines, même une case de monobloc. Le contrôle n° 5, lui, compte par **pièce** : un monobloc dont une case dépasse seule serait accepté par le contrôle, mais le générateur n'en produit jamais. Le générateur produit aussi uniquement des plateaux symétriques (forme et villes), ce que les contrôles n'exigent pas.
- **Tirage guidé.** Le tirage de forme n'est pas uniforme : il favorise les formes faciles à compléter. Les nombres de « formes distinctes » sont des minorants de la variété réelle, pas un dénombrement exact.
- **Montagnes.** Elles restent à l'intérieur de l'hexagone de rayon 4 et à une case au moins l'une de l'autre (réglages `montagnesRayonMax` et `montagnesEcart`, repris du générateur d'exemple en Python) : ce n'est pas une règle du cahier des charges.
- **Villes de déploiement.** « Les deux villes les plus proches de son côté » est mesuré par la rangée (r minimal pour Vert, r maximal pour Rouge). Le générateur garantit seulement que cette rangée peut porter deux villes à 4 pas. Au seuil 2, la rangée extrême peut donc être entamée, ou même remplacée par des cases ajoutées au-dessus de l'hexagone (voir la conclusion, point 2).

## Points à trancher

| Sujet | Options | Faits |
|---|---|---|
| Seuil de contact | 3 (défaut actuel) ou 2 | 3 : aucune tuile à 2 côtés, mais 7 dessins d'excroissance et 182 formes sur 500. 2 : 497 formes sur 500, mais 5,5 tuiles par plateau à 2 côtés. Réussite 100 % dans les deux cas. |
| Mesure de contact | « côtés » (défaut actuel) ou « pièces » | « pièces » est plus stricte, même réussite, même temps. Avec « côtés » au seuil 3, 79 % des plateaux ont au moins une tuile qui touche moins de 3 pièces. |
| Nombre de retouches du bord | 3 (défaut actuel), 4 ou 5 | Plus de retouches = plus de variété au seuil 3, mais tirage plus lent et parfois en échec (voir le dernier tableau). Sans objet au seuil 2. |
| Rangée de déploiement (seuil 2) | la laisser libre, ou interdire d'y toucher | Aujourd'hui libre tant qu'elle porte deux villes à 4 pas : 61,6 % des plateaux au seuil 2 ont une ville de déploiement tenue par 2 côtés, 12,2 % ont une rangée du haut faite de cases ajoutées. L'interdire demande une règle de plus (non écrite dans le cahier des charges). |
