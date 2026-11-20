# Catalogue 2 : mesures de faisabilité (2026-11-19)

## Mesures du 2026-11-20 : villes libres sur une Plaine (cahier des charges §10)

Mesure courte sur 100 graines (1 à 100), réglages par défaut : `node outils/mesures-villes-libres.js 100` depuis `atelier/`. Elle remplace, pour les villes, les comptes de places de bord et de flanc donnés plus bas (règles abandonnées : bords haut et bas, flancs, profondeur des extrémités, ville neutre tenue par 2 pièces).

| Mesure | Résultat |
|---|---|
| Plateaux générés | 100 sur 100 (169 terrains construits ou tentés) |
| Plaines admissibles par plateau (hors noyau, à 4 pas au moins de la ville du centre) | minimum 25, moyenne 31,6, médiane 31,5, maximum 38 |
| Terrains sans solution pour les 6 villes | 1 terrain (le générateur en a construit un autre) ; **aucun plateau sans solution** |
| Score d'équilibre (0 = équilibré) | moyen 0,01, médian 0, maximal 1 (99 plateaux à 0, 1 plateau à 1) |
| Plateaux au-dessus du seuil d'annonce (4, provisoire) | 0 (0 %) |
| Temps de génération par plateau | moyen 56 ms, médian 35 ms, maximal 215 ms |
| Avec « Regrouper forêts et marais » (`accolerSpeciales` 2) | 100 sur 100, score moyen 0,02, maximal 1 |

Lecture : avec une trentaine de Plaines admissibles, la pose automatique trouve presque toujours un placement à égale distance des deux camps ; le seuil d'annonce de 4 ne se déclenche sur aucun plateau généré (il sert aux villes posées à la main et aux anciens plateaux ; le fichier témoin `atelier/tests/fixtures-v3/plateau-genere.json` est à 4, juste au seuil, donc non annoncé). À score égal, le placement retenu est celui qui éloigne le plus les villes de déploiement des deux camps (réglage `REGLAGES.villes.departage`, provisoire). Vérification indépendante : `node outils/verifier-regles.js 50` = 250 plateaux, 0 non conforme.

Captures refaites le même jour (1366 × 768) : `docs/captures/villes.png` (étape « Villes ») et `docs/captures/capture-plateau.png` (plateau généré). Les six autres captures datent d'avant ces règles.

> **Note du 2026-11-20.** Les comptes de places pour les villes neutres et les scores d'équilibre ci-dessous datent d'avant la revue `docs/08` (ville neutre tenue par 2 pièces, permise sur tout le flanc). Mesure refaite sur 300 graines après ces corrections : réussite 300 / 300, 4,3 places par flanc, score d'équilibre moyen 3,27 (2,18 avant), maximal 14 (10 avant). Détail dans `docs/04-recette-atelier.md`.


Rapport du cœur du plateau, demandé par `docs/02-atelier-cahier-des-charges.md` §9.3. Ce document a deux parties :
1. **Catalogue en vigueur** (décision du 2026-11-19, seconde série, point 8) : aucun monobloc tout en plaine, forêt ou marais à une extrémité de chaque pièce. Mesures refaites sur ce catalogue.
2. **Historique** : les mesures du premier jeu de pièces du catalogue 2 (avec 8 monoblocs tout en plaine), qui ont fondé les réglages (2 tuiles de remplissage, profondeur 2, plateau tenu dans 11 rangées). Son tableau des pièces est remplacé par celui ci-dessous.

## 1. Catalogue en vigueur : aucun monobloc tout en plaine

### Réponse courte

- **Rien ne change pour la faisabilité.** Le générateur rend un plateau complet et sans erreur pour 300 graines sur 300, sans tuile de remplissage, en 121 ms en moyenne et 662 ms au pire.
- **Les tuiles de remplissage gardent le même rôle.** Sans elles, 52,7 % des constructions réussissent au premier essai (58,0 % avec l'ancien jeu de pièces) ; avec 2 en stock, 99,7 % (98,3 %), en posant 0,54 tuile en moyenne. Deux tuiles facultatives restent le bon nombre.
- **Les villes trouvent place aussi souvent.** Plateaux construits sans solution à profondeur 1 / 2 / 3 rangées : 88 % / 29 % / 8 % (ancien jeu : 92 % / 28 % / 6 %). La profondeur 2 reste le réglage.
- **Équilibre inchangé** : score moyen 2,2, médian 2, maximal 10 ; aucun plateau symétrique.
- **Les bois et les marécages restent petits si le générateur n'y prête pas attention** : sur les 13 cases d'un terrain, 5,5 restent isolées en moyenne (42 %), et la plus grande zone fait 4 cases.
- **Une option gratuite les regroupe.** Avec `accolerSpeciales: 2`, les cases isolées tombent à 3,0 (23 %) et la plus grande zone monte à 5,5 cases, sans coût : même réussite (300 / 300), même temps (121 ms), même équilibre (2,0). L'option est livrée **désactivée** (valeur 0), comme demandé ; l'activer est un point à trancher.

### Les 21 monoblocs de terrain

75 cases : 49 plaines (65,3 %), 13 forêts et 13 marais (17,3 % chacun). Sur le plateau, avec les 6 plaines du noyau : 55 / 13 / 13, soit 67,9 / 16,0 / 16,0 % ; une fois les 4 villes de déploiement posées sur des Plaines : 66,2 / 16,9 / 16,9 %. Répartition visée dans les réglages : 65 / 17,5 / 17,5.

| Id | Nom | Cases | Forme | Contenu | Place de la case spéciale |
|---|---|---|---|---|---|
| F31 | Lisière | 4 | losange | 1 forêt, 3 plaines | une pointe du losange |
| F31B | Orée | 4 | pistolet | 1 forêt, 3 plaines | l'ergot |
| F31C | Haie | 4 | zigzag | 1 forêt, 3 plaines | un bout |
| F31D | Taillis | 4 | étoile | 1 forêt, 3 plaines | une branche |
| F31E | Fourré | 4 | crosse | 1 forêt, 3 plaines | le bout recourbé |
| S31 | Mare | 4 | losange | 1 marais, 3 plaines | une pointe du losange |
| S31B | Gué | 4 | arc | 1 marais, 3 plaines | un bout |
| S31C | Bourbier | 4 | zigzag | 1 marais, 3 plaines | un bout |
| S31D | Fondrière | 4 | étoile | 1 marais, 3 plaines | une branche |
| S31E | Vasière | 4 | crosse | 1 marais, 3 plaines | le bout droit |
| S31F | Noue | 4 | pistolet | 1 marais, 3 plaines | un bout de la ligne |
| FS4B | Bocage | 4 | arc | 1 forêt, 1 marais, 2 plaines | les deux bouts opposés |
| F3 | Bois | 3 | triangle | 3 forêts | (tout le bloc) |
| S3 | Marécage | 3 | triangle | 3 marais | (tout le bloc) |
| F12A | Bouquet | 3 | triangle | 1 forêt, 2 plaines | un coin |
| F12B | Allée | 3 | ligne | 1 forêt, 2 plaines | un bout |
| F12C | Bosquet | 3 | coude | 1 forêt, 2 plaines | un bout |
| F12D | Remise | 3 | coude (miroir du précédent) | 1 forêt, 2 plaines | l'autre bout |
| S12 | Étang | 3 | triangle | 1 marais, 2 plaines | un coin |
| S12B | Fossé | 3 | ligne | 1 marais, 2 plaines | un bout |
| S12C | Roselière | 3 | coude | 1 marais, 2 plaines | un bout |

- Inchangés : noyau `N1`, montagnes `M4` et `M5`, remplissage `R` (2, facultatif), ville neutre `VN` (2), ville de déploiement `VD` (4).
- Identifiants gardés parce que leurs cases et leurs terrains n'ont pas changé : `F3`, `S3`, `F31`, `S31`, `F31B`, `S31B`, `S12`.
- Pièces retirées, toujours connues comme pièces d'un ancien catalogue (lisibles, hors catalogue imprimé) : `P4A` à `P4E`, `P3A` à `P3C` (tout en plaine), `F22`, `S22`, `F21`, `S21` (deux cases spéciales), `F12` (forêt au milieu), `FS4` (bocage en étoile).
- **Une limite de la consigne « jamais la même forme »** : il n'existe que trois formes de 3 cases (triangle, ligne, coude) pour quatre pièces « 1 forêt + 2 plaines ». La quatrième, `F12D`, est le coude avec la forêt à l'autre bout : c'est le miroir de `F12C`, qu'aucune rotation ne ramène sur lui (le carton n'a qu'un recto). À valider.

### Mesures (300 graines)

Commande : `node atelier/outils/mesures-catalogue-2.js 300`. Sortie reprise telle quelle. Les temps ont été pris pendant que d'autres travaux tournaient sur le poste (deux mesures en parallèle, la recette, les captures) : ils sont majorés ; le reste est déterministe. La section (f) est nouvelle.

Catalogue mesuré : noyau, 23 pièces à poser (84 cases), remplissage « R » en stock variable (2 au catalogue). Graines 1 à 300. Réglages du générateur : {"rayon":5,"demiHauteur":5,"remplissages":0,"tentatives":30,"compacite":1.2,"fantaisie":3,"etirement":0.25,"montagnesEcart":2,"reprises":30,"remplissageTot":false,"accolerSpeciales":0} ; villes : {"profondeurExtremite":2,"profondeursExtremite":[1,2,3],"neutresTiersCentral":true,"contactVilleNeutre":2}.

#### (a) Tuiles de remplissage : réussite, nombre posé, temps

| Forme | Remplissages en stock | Construction brute réussie (1 essai) | Échecs de la construction brute | Remplissages posés (moyenne) | (maximum) | Constructions sans aucun remplissage | Générateur complet réussi | Essais (moyenne) | (maximum) | Temps moyen (ms) | Temps maximal (ms) | Remplissages posés par le générateur (moyenne) | Essais ratés du générateur, par étape |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 0 | 158 / 300 (52,7 %) | contact 142 | 0,00 | 0 | 100,0 % | 300 / 300 (100,0 %) | 2,88 | 13 | 121 | 662 | 0,00 | contact 433, villes 132, contrôles 0 |
| 11 rangées | 2 | 299 / 300 (99,7 %) | contact 1 | 0,54 | 2 | 54,2 % | 300 / 300 (100,0 %) | 1,38 | 5 | 66 | 304 | 0,57 | contact 3, villes 112, contrôles 0 |
| 11 rangées | 4 | 300 / 300 (100,0 %) | – | 0,55 | 3 | 54,0 % | 300 / 300 (100,0 %) | 1,37 | 4 | 71 | 263 | 0,59 | contact 0, villes 112, contrôles 0 |
| 11 rangées | 6 | 300 / 300 (100,0 %) | – | 0,55 | 3 | 54,0 % | 300 / 300 (100,0 %) | 1,37 | 4 | 66 | 257 | 0,59 | contact 0, villes 112, contrôles 0 |
| 11 rangées | 9 | 300 / 300 (100,0 %) | – | 0,55 | 3 | 54,0 % | 300 / 300 (100,0 %) | 1,37 | 4 | 66 | 268 | 0,59 | contact 0, villes 112, contrôles 0 |
| libre | 0 | 184 / 300 (61,3 %) | contact 116 | 0,00 | 0 | 100,0 % | 299 / 300 (99,7 %) | 5,07 | 30 | 311 | 1857 | 0,00 | contact 532, villes 691, contrôles 0 |
| libre | 2 | 299 / 300 (99,7 %) | contact 1 | 0,30 | 2 | 70,6 % | 300 / 300 (100,0 %) | 3,48 | 16 | 230 | 1133 | 0,30 | contact 2, villes 743, contrôles 0 |
| libre | 4 | 300 / 300 (100,0 %) | – | 0,31 | 3 | 70,3 % | 300 / 300 (100,0 %) | 3,48 | 16 | 229 | 1128 | 0,31 | contact 0, villes 743, contrôles 0 |
| libre | 6 | 300 / 300 (100,0 %) | – | 0,31 | 3 | 70,3 % | 300 / 300 (100,0 %) | 3,48 | 16 | 227 | 1098 | 0,31 | contact 0, villes 743, contrôles 0 |
| libre | 9 | 300 / 300 (100,0 %) | – | 0,31 | 3 | 70,3 % | 300 / 300 (100,0 %) | 3,48 | 16 | 226 | 1086 | 0,31 | contact 0, villes 743, contrôles 0 |

#### (b) Contact : monoblocs aux seuils 2 et 3, remplissages, villes neutres

| Seuil de contact des monoblocs (pièces distinctes) | Remplissages en stock | Construction brute réussie | Remplissages posés (moyenne) | Contact minimal observé | Plateaux où tout monobloc touche 3 pièces ou plus |
| --- | --- | --- | --- | --- | --- |
| 2 | 0 | 300 / 300 (100,0 %) | 0,00 | 2 | 29,7 % |
| 2 | 2 | 300 / 300 (100,0 %) | 0,00 | 2 | 28,3 % |
| 3 | 0 | 158 / 300 (52,7 %) | 0,00 | 3 | 100,0 % |
| 3 | 2 | 299 / 300 (99,7 %) | 0,54 | 3 | 100,0 % |

| Tuiles de remplissage posées | touchent 2 pièces | 3 pièces | 4 pièces ou plus | touchent 2 cases | 3 cases | 4 cases ou plus |
| --- | --- | --- | --- | --- | --- | --- |
| 161 | 129 | 32 | 0 | 44 | 83 | 34 |

| Exigence pour une ville neutre | Places par flanc (moyenne) | Plateaux sans place sur un flanc |
| --- | --- | --- |
| touche 2 cases au moins | 3,09 | 1 / 299 (0,3 %) |
| touche 3 cases au moins | 1,38 | 68 / 299 (22,7 %) |
| touche 2 pièces au moins | 1,61 | 7 / 299 (2,3 %) |
| touche 3 pièces au moins | 0,03 | 299 / 299 (100,0 %) |

#### (c) Places pour les villes, sur des constructions brutes (non orientées vers les villes, sans nouvel essai)

| Forme | Profondeur de l’extrémité (rangées) | Constructions | Plaines admissibles par camp (moyenne) | Plateaux avec moins de 2 Plaines pour un camp | Plateaux avec 2 Plaines mais aucune paire à 4 pas | Places de ville neutre par flanc (moyenne) | Plateaux sans place neutre sur un flanc | Plateaux sans solution complète |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 1 | 299 | 2,31 | 166 (55,5 %) | 96 (32,1 %) | 3,09 | 1 (0,3 %) | 263 (88,0 %) |
| 11 rangées | 2 | 299 | 5,47 | 8 (2,7 %) | 76 (25,4 %) | 3,09 | 1 (0,3 %) | 86 (28,8 %) |
| 11 rangées | 3 | 299 | 7,24 | 0 (0,0 %) | 21 (7,0 %) | 3,09 | 1 (0,3 %) | 23 (7,7 %) |
| libre | 1 | 299 | 1,37 | 250 (83,6 %) | 47 (15,7 %) | 3,15 | 2 (0,7 %) | 297 (99,3 %) |
| libre | 2 | 299 | 3,94 | 44 (14,7 %) | 165 (55,2 %) | 3,15 | 2 (0,7 %) | 211 (70,6 %) |
| libre | 3 | 299 | 5,94 | 5 (1,7 %) | 75 (25,1 %) | 3,15 | 2 (0,7 %) | 83 (27,8 %) |

#### (d) Symétrie et équilibre sans symétrie, (e) variété des formes : plateaux du générateur complet

| Forme | Plateaux | Symétriques par demi-tour | Score d’équilibre moyen | médian | maximal | Score 0 | Score 2 ou moins | Écart moyen vers le centre | vers les 2 villes neutres | vers les villes de déploiement adverses |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 300 | 0 (0,0 %) | 2,18 | 2,0 | 10 | 16,0 % | 65,3 % | 0,46 | 1,45 | 0,27 |
| libre | 299 | 0 (0,0 %) | 3,02 | 3,0 | 16 | 10,4 % | 47,5 % | 0,87 | 1,71 | 0,44 |

| Forme | Plateaux | Formes distinctes | Hauteur en rangées : moyenne (étendue ; écart-type) | Rangée la plus large (cases) | Cases de bord | Cases de la rangée du haut | Cases de la rangée du bas |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 11 rangées | 300 | 300 | 10,8 (10 à 11 ; écart-type 0,4) | 11,5 (9 à 15 ; écart-type 0,9) | 36,6 (33 à 42 ; écart-type 1,5) | 4,0 (1 à 9 ; écart-type 1,7) | 3,9 (1 à 8 ; écart-type 1,7) |
| libre | 299 | 299 | 11,7 (9 à 14 ; écart-type 1,1) | 10,9 (8 à 13 ; écart-type 1,1) | 36,3 (32 à 42 ; écart-type 1,5) | 3,1 (1 à 9 ; écart-type 1,8) | 3,4 (1 à 9 ; écart-type 1,8) |

#### (f) Zones de forêt et de marais d’un seul tenant, sur les plateaux du générateur complet (11 rangées, sans remplissage)

| Réglage accolerSpeciales | Générateur réussi | Essais (moyenne) | Temps moyen (ms) | Temps maximal (ms) | Score d’équilibre moyen | Zones par terrain (moyenne) | Taille moyenne d’une zone | Plus grande zone (moyenne) | Plus grande zone (maximum) | Zones de 3 cases ou plus par terrain | Cases isolées par terrain (moyenne) | Part des 13 cases du terrain qui restent isolées |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 (réglage livré) | 300 / 300 | 2,88 | 122 | 662 | 2,18 | 8,00 | 1,67 | 4,15 | 8 | 1,31 | 5,49 | 42,2 % |
| 1 | 300 / 300 | 2,75 | 115 | 863 | 2,23 | 6,70 | 2,03 | 4,98 | 10 | 1,51 | 3,99 | 30,7 % |
| 2 | 300 / 300 | 2,82 | 121 | 590 | 1,98 | 5,76 | 2,38 | 5,48 | 10 | 1,71 | 2,96 | 22,8 % |
| 4 | 300 / 300 | 2,73 | 126 | 774 | 2,23 | 5,22 | 2,64 | 5,97 | 11 | 1,78 | 2,56 | 19,7 % |

### Lecture de la section (f)

Une « zone » est un groupe de cases de forêt (ou de marais) qui se touchent. Chaque terrain compte 13 cases : un bloc de 3 (Bois ou Marécage) et 10 cases portées une à une par les autres pièces.

- **Sans l'option** (réglage livré), le générateur ne regarde pas les terrains : 8 zones par terrain, la plus grande de 4 cases en moyenne, et 5,5 cases isolées sur 13.
- **Avec `accolerSpeciales`**, une pose qui met forêt contre forêt ou marais contre marais reçoit un bonus dans le choix de la pose. À 2 : 5,8 zones, la plus grande de 5,5 cases, 3 cases isolées. À 4 : la plus grande zone atteint 6 cases en moyenne (11 au plus), 2,6 cases isolées ; le gain ralentit.
- **Le coût est nul** aux trois valeurs : 300 plateaux sur 300, 2,7 à 2,9 essais, 115 à 126 ms, score d'équilibre entre 2,0 et 2,2. Les écarts de temps sont dans le bruit de la mesure.

### Ce qui change dans l'outil

- `REGLAGES.repartitionVisee` : 65 / 17,5 / 17,5.
- Contrôle du catalogue : un monobloc de terrain tout en plaine au catalogue est une erreur (`AT.catalogue.monoblocsToutPlaine()`, vérifié par un test et par le vérificateur indépendant).
- Contrôle 1 : un monobloc **personnel** tout en plaine posé sur le plateau est une alerte, pas une erreur ; un monobloc d'un ancien catalogue relu d'un fichier est une alerte (« monoblocs d'un ancien catalogue »), jamais « stock dépassé ».
- Fichiers témoins du catalogue de la veille : `atelier/tests/fixtures-v2/` (deux plateaux, une partie, une bibliothèque), relus par `atelier/tests/catalogue-sans-plaine.test.js`.

### Points à trancher

| Sujet | Options | Faits |
|---|---|---|
| Regrouper forêts et marais à la génération | désactivé (livré) ou `accolerSpeciales` à 2 | À 2 : 3,0 cases isolées par terrain au lieu de 5,5, plus grande zone 5,5 cases au lieu de 4,2 ; réussite, temps et équilibre inchangés. |
| Quatrième pièce « 1 forêt + 2 plaines » | coude miroir `F12D` (retenu) ou autre composition | Trois formes de 3 cases seulement ; le miroir est la seule façon de ne pas répéter une forme. |
| Tuiles de remplissage | 2 facultatives (inchangé) | 52,7 % de constructions réussies au premier essai sans elles, 99,7 % avec 2. |
| Profondeur des extrémités | 2 rangées (inchangé) | Sans solution : 88 % / 29 % / 8 % à 1 / 2 / 3 rangées. |
| Noms des 21 pièces | à valider | Proposition (Haie, Taillis, Fourré, Bourbier, Fondrière, Vasière, Noue, Bouquet, Allée, Remise, Fossé…). |

## 2. Historique : premier jeu de pièces du catalogue 2 (remplacé le 2026-11-19)

Ce qui suit est le rapport d'origine, conservé tel quel. Il porte sur le jeu de pièces qui comptait 8 monoblocs tout en plaine (53 plaines, 11 forêts, 11 marais) ; son tableau « Catalogue 2 retenu » et ses chiffres de répartition ne sont plus en vigueur.

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
