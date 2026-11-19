# Catalogue 2 : mesures de faisabilité (2026-11-19)

Rapport du lot F (cœur du plateau, catalogue 2), demandé par `docs/02-atelier-cahier-des-charges.md` §9.3.
Décisions mesurées : terrain uniquement en monoblocs de 3 ou 4 cases, plateau construit par les joueurs, villes posées ensuite aux extrémités, quelques tuiles de remplissage tolérées.

## Réponse courte

- **Le « tout en monoblocs » est faisable.** Le générateur rend un plateau complet et sans erreur pour 300 graines sur 300, **sans aucune tuile de remplissage**, en 91 ms en moyenne et 658 ms au pire.
- **Sans tuile de remplissage, une construction sur deux échoue au premier essai.** Sur 300 constructions faites une seule fois, 174 (58 %) respectent « chaque monobloc touche 3 autres tuiles » ; les 126 autres ont un monobloc de bord qui n'en touche que 2. Le générateur s'en sort en recommençant (2,45 essais en moyenne) ; des joueurs qui construisent à la main, non.
- **Deux tuiles de remplissage suffisent.** Avec 2 tuiles en stock, 295 constructions sur 300 (98,3 %) réussissent du premier coup, en posant 0,56 tuile en moyenne ; la moitié des plateaux n'en pose aucune. Passer à 4, 6 ou 9 n'apporte presque rien (99,7 %).
- **Recommandation : 2 tuiles de remplissage au catalogue, facultatives ; le générateur n'en pose aucune par défaut.** C'est le plus petit nombre qui rend la construction à la main fiable ; le générateur, lui, est fiable à 0.
- **Les villes de déploiement ne tiennent pas dans une seule rangée.** Avec une profondeur de 1 rangée, 92 % des plateaux construits n'ont pas de solution. Avec 2 rangées et un plateau tenu dans 11 rangées, 72 % en ont une du premier coup ; le générateur recommence pour les autres.
- **Les plateaux ne sont jamais symétriques** (0 sur 300). L'équilibre se mesure donc sans symétrie : score moyen 2,0, médian 2, score 0 pour 22 % des plateaux.

Rien n'a été ajusté en silence : les réglages retenus sont listés plus bas, avec ce qui reste à trancher.

## Ce qui a été mesuré

Commande (depuis la racine du dépôt), sortie reprise telle quelle dans les tableaux :

```
node atelier/outils/mesures-catalogue-2.js 300
```

Graines 1 à 300, environ 10 minutes. Les temps dépendent de la machine (Node 24, poste de l'utilisateur, d'autres travaux tournaient en même temps) ; tout le reste est déterministe.

**Catalogue mesuré** (celui de `atelier/src/catalogue.js`) : le noyau (7 cases), 2 montagnes (4 et 5 cases), 21 monoblocs de terrain, soit 24 pièces pour 91 cases ; la tuile de remplissage `R` en stock variable.

**Comment le générateur construit** (`AT.generateur.batir`) : à partir du noyau, il pose les 23 pièces une à une, dans un ordre tiré au sort, contre le plateau. Chaque pose doit toucher 3 pièces déjà posées (moins tant que le plateau n'en a pas 3) et ne jamais enfermer de case vide ; parmi les poses permises, il préfère celles qui touchent le plus et restent près du centre, avec une part de hasard. Quand aucune pose ne touche 3 pièces, il pose quand même (les pièces suivantes complètent souvent le contact). À la fin, un monobloc qui ne touche pas assez de pièces est repris et reposé ailleurs.

**À quoi servent les tuiles de remplissage**, et seulement quand le réglage en autorise :
1. à combler une case vide isolée qu'une pose enfermerait, si aucune pose sans trou ne convient ;
2. à la fin, contre un monobloc qui ne touche que 2 pièces, pour lui en donner une troisième.

**Critère de réussite, le même à tous les stocks** : toutes les pièces posées, aucune case vide enfermée, plateau d'un seul tenant, cases franchissables reliées, chaque monobloc touche au moins 3 pièces distinctes, chaque tuile de remplissage au moins 2.

« Construction brute » : un seul essai, sans regarder si les villes y trouveront place. « Générateur complet » : `AT.generateur.generer`, qui construit, cherche les villes, passe les contrôles et recommence au besoin (30 essais au plus).

« 11 rangées » : réglage `demiHauteur: 5`, le plateau tient dans les rangées −5 à +5. « Libre » : aucune limite de hauteur.

### (a) Tuiles de remplissage : réussite, nombre posé, temps

| Forme | Remplissages en stock | Construction brute réussie (1 essai) | Échecs de la construction brute | Remplissages posés (moyenne) | (maximum) | Constructions sans aucun remplissage | Générateur complet réussi | Essais (moyenne) | (maximum) | Temps moyen (ms) | Temps maximal (ms) | Remplissages posés par le générateur (moyenne) | Essais ratés du générateur, par étape |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 0 | 174 / 300 (58,0 %) | contact 126 | 0,00 | 0 | 100,0 % | 300 / 300 (100,0 %) | 2,45 | 14 | 91 | 658 | 0,00 | contact 310, villes 123, contrôles 0, autres 1 |
| 11 rangées | 2 | 295 / 300 (98,3 %) | contact 5 | 0,56 | 2 | 50,2 % | 300 / 300 (100,0 %) | 1,44 | 5 | 62 | 192 | 0,60 | contact 6, villes 126, contrôles 0 |
| 11 rangées | 4 | 299 / 300 (99,7 %) | contact 1 | 0,60 | 4 | 49,5 % | 300 / 300 (100,0 %) | 1,41 | 5 | 60 | 199 | 0,63 | contact 1, villes 123, contrôles 0 |
| 11 rangées | 6 | 299 / 300 (99,7 %) | contact 1 | 0,60 | 4 | 49,5 % | 300 / 300 (100,0 %) | 1,41 | 5 | 63 | 240 | 0,63 | contact 1, villes 123, contrôles 0 |
| 11 rangées | 9 | 299 / 300 (99,7 %) | contact 1 | 0,60 | 4 | 49,5 % | 300 / 300 (100,0 %) | 1,41 | 5 | 60 | 200 | 0,63 | contact 1, villes 123, contrôles 0 |
| libre | 0 | 198 / 300 (66,0 %) | contact 102 | 0,00 | 0 | 100,0 % | 300 / 300 (100,0 %) | 5,25 | 26 | 278 | 1611 | 0,00 | contact 534, villes 742, contrôles 0 |
| libre | 2 | 300 / 300 (100,0 %) | – | 0,34 | 2 | 68,0 % | 300 / 300 (100,0 %) | 3,14 | 21 | 169 | 1008 | 0,36 | contact 0, villes 643, contrôles 0 |
| libre | 4 | 300 / 300 (100,0 %) | – | 0,34 | 2 | 68,0 % | 300 / 300 (100,0 %) | 3,14 | 21 | 168 | 1115 | 0,36 | contact 0, villes 643, contrôles 0 |
| libre | 6 | 300 / 300 (100,0 %) | – | 0,34 | 2 | 68,0 % | 300 / 300 (100,0 %) | 3,14 | 21 | 168 | 983 | 0,36 | contact 0, villes 643, contrôles 0 |
| libre | 9 | 300 / 300 (100,0 %) | – | 0,34 | 2 | 68,0 % | 300 / 300 (100,0 %) | 3,14 | 21 | 170 | 1003 | 0,36 | contact 0, villes 643, contrôles 0 |

Lecture :
- Tous les échecs de construction sont des échecs de **contact** : jamais une pièce impossible à poser, jamais un trou, jamais une case coupée du reste (un seul essai « autre » dans tout le tableau).
- Le stock utile plafonne à 2 : au-delà, le nombre posé ne bouge plus (maximum 4 sur 300 plateaux, moyenne 0,6).
- « Essais ratés du générateur » compte des essais recommencés, pas des graines en échec. Dans la forme « 11 rangées », deux essais ratés sur trois le sont pour le contact à 0 remplissage, presque tous pour les villes à 2 remplissages.
- Forme libre : le générateur réussit aussi, mais il lui faut 5 essais en moyenne et jusqu'à 1,6 seconde, parce que les villes y trouvent plus rarement place (voir c).

### (b) Contact : monoblocs aux seuils 2 et 3, remplissages, villes neutres

| Seuil de contact des monoblocs (pièces distinctes) | Remplissages en stock | Construction brute réussie | Remplissages posés (moyenne) | Contact minimal observé | Plateaux où tout monobloc touche 3 pièces ou plus |
| --- | --- | --- | --- | --- | --- |
| 2 | 0 | 300 / 300 (100,0 %) | 0,00 | 2 | 24,3 % |
| 2 | 2 | 300 / 300 (100,0 %) | 0,00 | 2 | 29,3 % |
| 3 | 0 | 174 / 300 (58,0 %) | 0,00 | 3 | 100,0 % |
| 3 | 2 | 295 / 300 (98,3 %) | 0,56 | 3 | 100,0 % |

Au seuil 2, la construction réussit toujours et n'a jamais besoin de remplissage ; mais trois plateaux sur quatre ont alors au moins un monobloc tenu par 2 pièces seulement. Le seuil 3 reste donc le réglage livré.

| Tuiles de remplissage posées | touchent 2 pièces | 3 pièces | 4 pièces ou plus | touchent 2 cases | 3 cases | 4 cases ou plus |
| --- | --- | --- | --- | --- | --- | --- |
| 165 | 111 | 52 | 2 | 36 | 87 | 42 |

Deux tuiles de remplissage sur trois ne touchent que 2 pièces : leur imposer le seuil 3 les rendrait inutiles. **Seuil retenu pour une tuile de remplissage : 2 pièces** (réglage `seuilContactRemplissage`).

| Exigence pour une ville neutre | Places par flanc (moyenne) | Plateaux sans place sur un flanc |
| --- | --- | --- |
| touche 2 cases au moins | 3,15 | 1 / 295 (0,3 %) |
| touche 3 cases au moins | 1,37 | 75 / 295 (25,4 %) |
| touche 2 pièces au moins | 1,63 | 3 / 295 (1,0 %) |
| touche 3 pièces au moins | 0,03 | 295 / 295 (100,0 %) |

Une ville neutre, tuile seule ajoutée contre le flanc, ne peut pas toucher 3 pièces (aucun plateau n'a de place). **Seuil retenu pour une ville neutre : 2 cases du plateau** (réglage `villes.contactVilleNeutre`), compté en cases et non en pièces.

### (c) Places pour les villes, sur des constructions brutes

Constructions faites une seule fois, avec 2 remplissages en stock, **sans** chercher à ménager de la place pour les villes : c'est ce qu'obtiendraient des joueurs qui construisent sans y penser.

| Forme | Profondeur de l’extrémité (rangées) | Constructions | Plaines admissibles par camp (moyenne) | Plateaux avec moins de 2 Plaines pour un camp | Plateaux avec 2 Plaines mais aucune paire à 4 pas | Places de ville neutre par flanc (moyenne) | Plateaux sans place neutre sur un flanc | Plateaux sans solution complète |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 1 | 295 | 2,44 | 161 (54,6 %) | 109 (36,9 %) | 3,15 | 1 (0,3 %) | 271 (91,9 %) |
| 11 rangées | 2 | 295 | 5,83 | 9 (3,1 %) | 72 (24,4 %) | 3,15 | 1 (0,3 %) | 83 (28,1 %) |
| 11 rangées | 3 | 295 | 7,75 | 0 (0,0 %) | 16 (5,4 %) | 3,15 | 1 (0,3 %) | 19 (6,4 %) |
| libre | 1 | 300 | 1,69 | 239 (79,7 %) | 57 (19,0 %) | 3,10 | 1 (0,3 %) | 296 (98,7 %) |
| libre | 2 | 300 | 4,39 | 40 (13,3 %) | 149 (49,7 %) | 3,10 | 1 (0,3 %) | 190 (63,3 %) |
| libre | 3 | 300 | 6,44 | 5 (1,7 %) | 62 (20,7 %) | 3,10 | 1 (0,3 %) | 70 (23,3 %) |

« Plaine admissible » : une Plaine du bord, hors noyau, dans les rangées extrêmes du camp, à 4 pas au moins du centre. « Solution complète » : 2 villes par camp et une ville neutre par flanc, toutes à 4 pas les unes des autres.

Lecture :
- **Une seule rangée ne suffit pas** : la rangée du haut d'un plateau construit librement compte 3 ou 4 cases en moyenne (tableau e), rarement 2 Plaines à 4 pas l'une de l'autre.
- **Ce qui bloque, c'est l'écart de 4 pas entre les deux villes d'un même camp**, plus que le nombre de Plaines : avec 2 rangées, 3 % des plateaux manquent de Plaines, 24 % en ont mais trop serrées.
- **Tenir le plateau dans 11 rangées aide** : les bords haut et bas deviennent plats et larges. À profondeur 2, 28 % de plateaux sans solution contre 63 % en forme libre.
- **Les villes neutres ne posent pas de difficulté** : 3 places par flanc en moyenne, un seul plateau sur 300 sans place.

**Réglages retenus** : profondeur 2 rangées, plateau tenu dans 11 rangées. Le générateur recommence la construction quand les villes n'y trouvent pas place : il réussit 300 fois sur 300.

### (d) Symétrie et équilibre sans symétrie, (e) variété des formes

Plateaux rendus par le générateur complet, sans remplissage.

| Forme | Plateaux | Symétriques par demi-tour | Score d’équilibre moyen | médian | maximal | Score 0 | Score 2 ou moins | Écart moyen vers le centre | vers les 2 villes neutres | vers les villes de déploiement adverses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 300 | 0 (0,0 %) | 2,01 | 2,0 | 11 | 22,3 % | 69,0 % | 0,44 | 1,36 | 0,22 |
| libre | 300 | 0 (0,0 %) | 3,11 | 3,0 | 11 | 9,0 % | 48,3 % | 0,89 | 1,79 | 0,42 |

**Score d'équilibre sans symétrie** (`AT.controles.ecartsCamps`). Le coût d'un camp vers une case est le plus petit coût en rations depuis l'une de ses deux villes de déploiement. Le score additionne :
- l'écart entre Vert et Rouge vers le centre ;
- l'écart entre Vert et Rouge vers chaque ville neutre ;
- l'écart vers les villes de déploiement adverses : les coûts de Vert vers les deux villes de Rouge et de Rouge vers les deux villes de Vert, rangés du plus petit au plus grand et comparés rang par rang.

0 = les deux camps sont à égale distance de tout. Pour chaque terrain construit, le générateur essaie toutes les combinaisons de villes admissibles et garde la mieux notée (à égalité, le hasard choisit).

Lecture : un écart moyen de 2 rations sur l'ensemble du plateau, dont les deux tiers viennent des villes neutres (une tuile collée au flanc est rarement à égale distance des deux camps). Le pire plateau a un score de 11.

| Forme | Plateaux | Formes distinctes | Hauteur en rangées : moyenne (étendue ; écart-type) | Rangée la plus large (cases) | Cases de bord | Cases de la rangée du haut | Cases de la rangée du bas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 300 | 300 | 10,8 (9 à 11 ; écart-type 0,4) | 11,6 (10 à 14 ; écart-type 0,9) | 36,5 (33 à 42 ; écart-type 1,6) | 4,0 (1 à 9 ; écart-type 1,7) | 4,0 (1 à 9 ; écart-type 1,8) |
| libre | 300 | 300 | 11,7 (9 à 16 ; écart-type 1,1) | 11,0 (8 à 14 ; écart-type 1,1) | 36,2 (32 à 40 ; écart-type 1,5) | 3,0 (1 à 7 ; écart-type 1,6) | 3,2 (1 à 8 ; écart-type 1,7) |

Les 300 plateaux ont 300 formes différentes dans les deux cas ; ce compte ne dit donc rien, les dispersions disent plus. Tenir le plateau dans 11 rangées fige la hauteur (presque toujours 11) mais laisse varier la largeur (10 à 14 cases), le bord (33 à 42 cases) et les rangées extrêmes (1 à 9 cases). La forme libre varie davantage en hauteur (9 à 16 rangées).

## Catalogue 2 retenu

Formes variées, sans miroir imposé : 3 formes de 3 cases (triangle, ligne, coude) et 6 formes de 4 cases (losange, zigzag, arc, étoile, crosse, pistolet).

| Id | Nom | Cases | Forme | Contenu |
|---|---|---|---|---|
| N1 | Noyau | 7 | fixe, en (0,0) | ville au centre, 6 plaines |
| M4 | Montagne zigzag | 4 | zigzag | montagne |
| M5 | Montagne peigne | 5 | peigne | montagne |
| P4A | Pré en losange | 4 | losange | 4 plaines |
| P4B | Pré en zigzag | 4 | zigzag | 4 plaines |
| P4C | Pré en arc | 4 | arc | 4 plaines |
| P4D | Pré en étoile | 4 | étoile | 4 plaines |
| P4E | Pré en crosse | 4 | crosse | 4 plaines |
| F31 | Lisière | 4 | losange | 1 forêt, 3 plaines |
| F31B | Orée | 4 | pistolet | 1 forêt, 3 plaines |
| S31 | Mare | 4 | losange | 1 marais, 3 plaines |
| S31B | Gué | 4 | arc | 1 marais, 3 plaines |
| F22 | Futaie | 4 | zigzag | 2 forêts, 2 plaines |
| S22 | Tourbière | 4 | crosse | 2 marais, 2 plaines |
| FS4 | Bocage | 4 | étoile | 1 forêt, 1 marais, 2 plaines |
| P3A | Pré en triangle | 3 | triangle | 3 plaines |
| P3B | Pré en ligne | 3 | ligne | 3 plaines |
| P3C | Pré en coude | 3 | coude | 3 plaines |
| F3 | Bois | 3 | triangle | 3 forêts |
| S3 | Marécage | 3 | triangle | 3 marais |
| F21 | Bosquet | 3 | coude | 2 forêts, 1 plaine |
| S21 | Roselière | 3 | coude | 2 marais, 1 plaine |
| F12 | Clairière | 3 | ligne | 1 forêt, 2 plaines |
| S12 | Étang | 3 | triangle | 1 marais, 2 plaines |
| R | Remplissage | 1 | – | 1 plaine ; **2 tuiles, facultatives** |
| VN | Ville neutre | 1 | – | ville ; 2 tuiles, ajoutées contre les flancs |
| VD | Ville de déploiement | 1 | – | tuile posée par-dessus une Plaine ; 4 tuiles, 2 par joueur |

Chaque pièce existe en un exemplaire, sauf R et VN (2) et VD (4). Les 21 monoblocs de terrain font 75 cases : 53 plaines, 11 forêts, 11 marais, comme demandé au §9.2. Les six monoblocs F3, F31, F21, S3, S31, S21 gardent exactement les cases du premier catalogue, pour que les anciens fichiers se rouvrent à l'identique.

## Écarts et limites

- **Répartition des terrains.** Le §9.2 compte 70,7 / 14,7 / 14,7 % sur les 75 cases des monoblocs. Sur le plateau, les 6 plaines du noyau s'y ajoutent : le terrain construit compte 59 plaines, 11 forêts, 11 marais, soit 72,8 / 13,6 / 13,6 %. Une fois les 4 villes de déploiement posées sur des Plaines : 71,4 / 14,3 / 14,3 %. Avec les 2 tuiles de remplissage posées en plus : 72,2 / 13,9 / 13,9 %. On reste à un point et demi de 70 / 15 / 15, pas à un point.
- **Le premier essai du générateur n'est pas un joueur.** La « construction brute » applique une règle simple et gloutonne ; un joueur attentif fera mieux, un joueur pressé moins bien. Les 58 % sont un ordre de grandeur de la difficulté, pas une prévision.
- **« Tenir dans 11 rangées » n'est pas une règle de l'utilisateur.** C'est un réglage du générateur (`demiHauteur`), retenu parce qu'il rend la pose des villes possible bien plus souvent. Les contrôles ne l'exigent pas d'un plateau fait à la main.
- **« Bord haut », « flanc », « tiers central »** sont des traductions provisoires : bord haut = les 2 rangées extrêmes ; flanc = une case vide à gauche ou à droite de toutes les tuiles de sa rangée ; tiers central = le tiers du milieu des rangées. Ce sont des réglages.
- **L'écart de 4 pas est compté en cases**, comme avant. Maintenant qu'une tuile fait 3 ou 4 cases, « 3 tuiles entre deux villes » et « 3 cases entre deux villes » ne veulent plus dire la même chose ; c'est le point B6 du cahier des charges, à confirmer.
- **Les montagnes** restent à une case au moins l'une de l'autre (réglage `montagnesEcart`, repris du premier générateur) : ce n'est pas une règle de l'utilisateur.
- **Les trous** (cases vides entourées) restent une simple alerte dans les contrôles, en attendant la décision de l'utilisateur ; le générateur, lui, n'en produit jamais.

## Points à trancher

| Sujet | Options | Faits |
|---|---|---|
| Tuiles de remplissage au catalogue | 0, 2 (retenu) ou plus | À 0, une construction sur deux échoue au premier essai (58 % de réussite). À 2 : 98,3 %, 0,56 tuile posée en moyenne. À 4 ou plus : 99,7 %, sans autre gain. Le générateur réussit 300 fois sur 300 dans tous les cas. |
| Le générateur pose-t-il des remplissages ? | non (retenu) ou jusqu'à 2 | Sans : 91 ms en moyenne, 658 ms au pire, 2,45 essais. Avec 2 : 62 ms, 192 ms au pire, 1,44 essai, 0,6 tuile par plateau. |
| Profondeur des extrémités pour les villes de déploiement | 1, 2 (retenu) ou 3 rangées | Plateaux construits sans solution : 92 %, 28 %, 6 % (plateau tenu dans 11 rangées). |
| Hauteur du plateau | tenu dans 11 rangées (retenu, générateur seulement) ou libre | Libre : 63 % de constructions sans solution pour les villes à profondeur 2, générateur 3 fois plus lent ; hauteur de 9 à 16 rangées. |
| Contact d'une ville neutre | 2 cases (retenu) ou 3 | À 3 cases, un plateau sur quatre n'a pas de place sur un flanc ; à 3 pièces, aucun. |
| Contact d'une tuile de remplissage | 2 pièces (retenu) ou 3 | 111 des 165 tuiles posées ne touchent que 2 pièces. |
| Écart entre villes | 4 pas en cases (retenu) ou autre lecture de « 3 tuiles » | À confirmer (B6). C'est cet écart qui bloque le plus la pose des villes de déploiement. |
