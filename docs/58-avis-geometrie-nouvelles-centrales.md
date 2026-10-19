# Avis géométrie : nouvelles centrales 5×5 (advisor, Opus 5.5), 2026-10-18

Avis seulement, aucun fichier du dépôt modifié. Mesures faites sur une copie figée de `src/` (branche `connexions-5x5`, HEAD `85e0810`, plus le `src/graphe.js` en cours du sous-agent, qui fait déjà compter les jonctions comme zones dans `rythme`). Fichiers dans `scratchpad/advisor-geo-centrales/` :
- `centrales-5x5.js` : les modèles, même forme que `src/catalogue.js` ;
- `verifier.js` : validation, tracé, règles, miroirs et marges ;
- `mesurer.js`, `configs.js`, `synthese.js` et `res/*.json` : les mesures.

## 1. Nouvelles centrales (ids provisoires LC5 à LC10)

Chaque modèle donne, sur la copie figée : `validerModele(m,'5x5')` 0 erreur et 0 alerte ; `problemesTrace` 0 ; `reglesPassages` 0 ; signature distincte de LC1 à LC4, LB2, LK2 et des autres nouveaux, dans les 4 rotations et en miroir. Conventions : côtés 0 = N, 1 = E, 2 = S, 3 = O ; coins 0 = NO, 1 = NE, 2 = SE, 3 = SO ; raccords au milieu (pos 1) ; cases de Ø 20 mm.

| Id | Nom | Cases (mm) | Chemins | Passages (pivot) | Ports | Raccords (côtés) | Connexions des cases | Marge chemins / passages |
|---|---|---|---|---|---|---|---|---|
| LC5 | Pont et carrefour | p (50,25) | p : NO, NE, N1 | T sans case (50,66) : E1, S1, O1 | 2 | N (chemin), E, S, O (T) ; aucun mur | p : 3 (2 jonctions + voisine N). Au plateau, les voisines E, S et O deviennent voisines entre elles (+2 chacune). | 10,04 / 19,49 |
| LC6 | Pont et fourche libres | p (50,25), r (66,62) | p : NO, NE, N1 ; r : E1 ; pas de lien p–r | T (31,76) : S1, O1, r | 2 | 4 au milieu | p : 3 ; r : 3 (E, S, O). Les voisines S et O se touchent. | 10,04 / 12,47 |
| LC7 | Pont et relais libres | p (50,25), r (50,64) | p : NO, NE, N1 ; r : E1, S1, O1 ; pas de lien | aucun | 2 | 4 au milieu | p : 3 ; r : 3 | 10,04 / — |
| LC8 | Carrefour | c (50,50) | c : N1, E1, S1, O1 | aucun | 0 | 4 au milieu | c : 4 | 11,80 / — |
| LC9 | Double relais | a (34,34), b (66,66) | a : N1, O1 ; b : E1, S1 ; lien a–b | aucun | 0 | 4 au milieu | a : 3 ; b : 3 | 13,65 / — |
| LC10 | Relais et fourche | a (62,38), b (62,70) | a : N1, E1 ; lien a–b | T (30,72) : S1, O1, b | 0 | 4 au milieu | a : 3 ; b : 3. Les voisines S et O se touchent. | 7,41 / **3,40** |

À titre de comparaison, les marges des modèles livrés vont de 3,79 mm (LC2) à 10,04 mm (LC3 et LC4) pour les chemins, et LC3 a 11,14 mm pour les passages.

Règles respectées :
- 2 cases au plus ;
- porteuse latérale toujours au nord, avec son seul raccord N1 (LC5 à LC7) ;
- R2 : aucune porteuse reliée à une autre ; R4 : sans objet sur une centrale ;
- pas de traversant : le T de LC5 a deux branches opposées, E et O, ce que la règle admet, comme pour P3 de la 4.00.0 ;
- pas de passage vers un coin, et aucune porteuse ne touche un passage ;
- un T au plus, aucun mur.

**Ce qu'on ne peut pas faire, et pourquoi.**
- Deux porteuses latérales sur des côtés voisins : elles se partagent un coin, et `coin_double` est une erreur. La seule centrale à deux porteuses reste donc LC4.
- Une centrale à 3 ports : la porteuse à 1 port d'une centrale n'a droit à aucun raccord (R3), ne peut être reliée ni à l'autre porteuse (R2) ni à un passage. Elle n'aurait qu'une connexion.
- Un relais à 2 raccords plus un passage qui revient sur ce même relais : c'est la topologie de LC1 (variante de dessin seulement).
- Un relais à 2 raccords avec un passage raccord–raccord : le relais n'aurait que 2 connexions.
- Le T en E–O avec le relais au sud : il croiserait le lien vers la porteuse.
- Les miroirs de LC3 et de LC6 sont exclus.

## 2. Mesures dans le vrai générateur

Méthode : `PM.generateur.generer` réglé par défaut, avec 200 candidats. Le document est `nouveauDocument('5x5')`, ses centrales sont remplacées en mémoire (poids = exemplaires), et LB2 ×12 et LK2 ×4 ne changent pas. 200 plateaux par configuration, graines `e0` à `e199`.

Les configurations U5 à U10, sur 40 plateaux, testent chaque nouveau modèle à forte dose :
- **LC5** : chaîne 1,0, degré moyen 3,78, mais 55 cases et 4,3 placements ;
- **LC6** : 2,2 % de cases faibles, 6,1 placements ;
- **LC7** : 11,1 placements, le meilleur résultat, mais un degré moyen de 3,60 ;
- **LC8, LC9 et LC10** : à 0 port, ils demandent 2 LC4, donc 3,5 à 3,7 raccords morts, et 3,6 à 6 placements.

| Mesure (200 plateaux) | A0 livré | **B3 (recommandé)** | B1 | B2 (variété +) | A1 | A3 (+LC5) | A2 (tout) |
|---|---|---|---|---|---|---|---|
| Poids des centrales | LC1 3, LC2 2, LC3 3, LC4 1 | B1 avec LC3 3 | LC1 2, LC2 1, LC3 2, LC4 1, LC5 2, LC6 1, LC7 2 | B1 + LC4 2, LC10 1 | B1 avec LC7 1 | LC1 2, LC2 1, LC3 3, LC4 1, LC5 3 | les 10 |
| Réussite | 100 % | **100 %** | **100 %** | 100 % | 100 % | 100 % | **95 %** (10 abandons « villes_ports ») |
| Cases | 59 | 57,2 (57–58) | 57,2 (57–58) | 57,4 | 57,1 | 56,1 | 57,2 (56–58) |
| Cases à ≤ 2 connexions (maximum) | 1,23 % (1,7) | 2,44 % (3,5) | 2,17 % (3,5) | 2,18 % (3,5) | 1,46 % (3,5) | 1,57 % (3,6) | 2,82 % (3,6) |
| Degré moyen | 3,74 | 3,74 | 3,70 | 3,64 | 3,71 | 3,81 | 3,64 |
| Jonctions à 2 / 3 / 4 ports (sur 3 200) | 145 / 2 910 / 145 | 263 / 2 868 / 69 | 226 / 2 906 / 68 | 184 / 2 814 / 202 | 140 / 2 982 / 78 | 172 / 2 936 / 92 | 262 / 2 628 / 150 (sur 3 040) |
| Ports par plateau | 48 | 47,0 | 47,2 | 48,1 | 47,7 | 47,6 | 47,4 |
| Placements admissibles, moyenne (min–max) | 8,2 (1–15) | 4,9 (1–14) | 5,8 (1–14) | 6,7 (1–30) | 7,3 (1–20) | 4,2 (1–14) | 4,3 (1–24) |
| Placements de villes différents | 41 | 40 | 46 | 55 | 40 | 33 | 51 |
| Plateaux différents | 193 | **200** | **200** | 200 | 194 | 191 | 190 |
| S, moyenne (max) | 0,98 (4) | 1,69 (4) | 1,60 (4) | 1,61 (4) | 1,52 (4) | 1,58 (4) | 1,71 (4) |
| Chaîne, jonctions comptées comme zones | 3,02 (3–4) | **1,75 (1–3)** | **2,17 (1–3)** | 2,25 (1–3) | 1,58 | 1,11 | 2,88 (1–7) |
| Chaîne, sans les jonctions | 5,92 | 4,14 | 4,36 | 5,11 | 3,95 | 3,47 | 5,23 |
| Raccords morts, moyenne (max) | 2 (2) | **1,03 (2)** | **1,21 (2)** | 2,51 (4) | 1,69 (2) | 1,60 (2) | 2,66 (4) |
| Plateaux à goulet | 0 | 0 | 0 | 2 | 0 | 0 | 4 |
| Compositions de centrales différentes | **1** | **32** | **20** | 52 | 7 | 5 | 83 |
| Stock de centrales pour ≥ 90 % de plateaux montables | 9 (100 %) | 12 (100 %) | 11 (100 %) | 13 (100 %) | 10 | 10 | 14 |
| Jeu complet | 25 tuiles : 5 A3 / 13 A4 | **28 tuiles : 5 A3 / 14 A4** | **27 tuiles : 5 A3 / 14 A4** | 29 : 5 A3 / 15 A4 | 26 : 5 / 13 | 26 : 5 / 13 | 30 : 5 / 15 |
| Temps par plateau | 1,3 s | 1,9 s | 1,7 s | 1,7 s | 1,9 s | 3,2 s | 0,8 s |

Remarques :
- Sur tous les plateaux, la seule alerte de `validerPlateau` est `raccord_mort` (les murs de LC4).
- Contrôle du panneau (`PM.controles.calculer` de la copie figée, et `GR.villesProches`) sur 240 plateaux, B3 et B1 : seule l'alerte `raccord_mort` (262), **aucune paire de villes trop proches**.
- Fourches par plateau : B1 donne 1,81 LC3 (jamais 3), soit 2,69 fourches avec LC6 ; **B3 donne 2,46 LC3** (2 ou 3), soit 3,33 fourches avec LC6.
- Connexions des cases au plateau (degré moyen, minimum ; B3 et B1, 240 plateaux) :
  - LC1 4,62 ; LC2 4,58 ; LC3 4,25 ; LC4 3,15 (min 3) ;
  - **LC5 3,16 ; LC6 3,24 ; LC7 3,50** (min 2 : 1, 14 et 10 cases sur 425, 412 et 710 ; cause non analysée, probablement un raccord face à un mur de LC4) ;
  - LB2 4,01 ; LK2 3,50.
  Les voisines E, S et O d'un LC5 y gagnent 2 connexions chacune.
- **La règle « intersections = zones »** n'est **pas dans HEAD** : elle n'est que dans le `src/graphe.js` en cours, avec l'option `sansJonctions` pour comparer. Les mesures ont été faites avec elle, et c'est elle que les préférences du générateur utilisent ici. On donne aussi la chaîne « sans les jonctions », l'ancienne mesure.
- **Stock = poids, mesuré** : sur ces 200 plateaux, avec le tirage par quotas, aucun modèle n'a été posé plus de fois que son poids quand la somme des poids dépasse 9. Ce n'est pas garanti : `equilibrerMoities` peut remplacer une tuile hors quota. Le stock égal aux poids monte donc 100 % des plateaux, et la variété des compositions vient de ce que cette somme dépasse 9.

## 3. Catalogue de centrales recommandé (B3)

| Id | Nom | Ports | Poids = exemplaires |
|---|---|---|---|
| LC1 | Pont et relais | 2 | 2 |
| LC2 | Pont et relais décalé | 2 | 1 |
| LC3 | Pont et fourche | 2 | **3** |
| LC4 | Deux ponts | 4 | 1 |
| LC5 | Pont et carrefour | 2 | 2 |
| LC6 | Pont et fourche libres | 2 | 1 |
| LC7 | Pont et relais libres | 2 | 2 |
| **Total** | | | **12 centrales** |

Avec LB2 ×12 et LK2 ×4, cela fait **28 tuiles**, soit **5 planches A3** (comme aujourd'hui, sur 30 places) ou **14 A4** (une de plus).

Ce que donne B3 :
- **32 compositions** de centrales au lieu d'une, et 200 plateaux différents sur 200 ;
- **100 % de réussite** et tous les plateaux sous 5 % de cases faibles (2,4 % en moyenne) ;
- aucun goulet, aucune ville trop proche ;
- chaîne 1,75 au lieu de 3,0 ;
- 1,03 raccord mort au lieu de 2 : LC4 n'est pas posé sur environ 40 % des plateaux (79 plateaux B1 sur 200 sans LC4, tous à 0 raccord mort).

**Il tient la décision « LC3 sur environ 3 centrales sur 9 »** : 2,46 LC3 par plateau, et 3,3 fourches en comptant LC6. Ce n'est pas le cas de B1 (1,81, jamais 3).

**Variante B1** (LC3 ×2, 11 centrales, 27 tuiles, 5 A3 ou 14 A4) : 5,8 placements admissibles au lieu de 4,9, mais moins de fourches. Il faudrait alors présenter à l'utilisateur la baisse de LC3 comme un écart à sa décision.

**Variante B2** (B1 plus LC10 ×1, avec LC4 à 2 ; 29 tuiles, 5 A3 ou 15 A4) : 52 compositions et 55 placements différents, mais jusqu'à 4 raccords morts et 1 % de plateaux à goulet.

**Non recommandés** : LC8, LC9, et LC10 sans LC4 ×2. Ce sont des centrales à 0 port, qui font tomber la réussite (A2 : 95 %) et doublent les murs. Le fichier JS les porte à 0 exemplaire.

## 4. Risques
1. **Moins de cases** (57 en moyenne au lieu de 59 ; 55 avec beaucoup de LC5), parce que LC5 n'a qu'une case. Les moitiés restent égales, puisque le générateur échange les tuiles, mais la décision de `18` disait 59 cases. C'est à confirmer par l'utilisateur, qui avait demandé de la rapidité.
2. **Placements de villes admissibles en baisse** : 8,2 → 4,9 en moyenne avec B3 (5,8 avec B1), toujours 1 au moins. Pourtant, 40 placements différents sont tirés, comme aujourd'hui (41). Il y a plus de jonctions-cases à 2 ports (263 contre 145), ce qui reste permis et sous 5 % de cases faibles.
3. **LC6 et LC7 (« libres »)** : leur porteuse ne compte que 3 connexions et ne mène pas au relais. Cela fait moins de raccourcis internes, mais LC7 est le modèle qui augmente le plus le nombre de placements.
4. **Marge de passage de LC10 à 3,40 mm**, la plus faible, du même ordre que LC2. À redessiner si on garde LC10 (B2), par exemple en écartant le pivot.
5. **Le T de LC5** (cliques E-S-O) crée des raccourcis entre trois tuiles voisines. L'écart de 3 cases entre villes reste garanti par le placement des villes : aucune alerte `villes_proches` sur 200 plateaux.
6. **Mesures faites sur un `graphe.js` en cours** (et un `controles.js` antérieur aux murs passés en information) : une fois la règle des jonctions committée, il faut refaire les mesures. Les tests du dépôt qui figent la composition (3/2/3/1, 25 exemplaires, `catalogue-5x5.test.js` et `stock-et-catalogue-precedent.test.js`) seront à mettre à jour.
