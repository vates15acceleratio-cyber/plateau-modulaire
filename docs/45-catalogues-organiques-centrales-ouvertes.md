# Catalogues organiques, révision « centrales ouvertes » (sous-agent de production, Opus 5.5), 2026-10-17

Statut : **proposition non branchée**. Elle suit les réponses de l'utilisateur sur la révision « rythme », consignées en fin de `18`. Rapport du sous-agent consigné par l'orchestrateur ; l'orchestrateur a relu les planches et deux plateaux d'exemple.

## Fichiers
- **`outils/catalogue-organique.js`** :
  - `PM.catalogueOrganique.modelesParGrille` contient la nouvelle révision ;
  - `revision44` conserve la révision du `44`.
- **`outils/planche-organique.js`** :
  - `node outils/planche-organique.js` produit les images et `mesures.json` ;
  - `node outils/planche-organique.js series 200` produit `centrales-ouvertes-200.json`, en 4 min environ ;
  - mesures ajoutées : rythme strict, équilibre des accès (`accesCentre`) et pose symétrique (`tirerPlateau`, option `symetrique`) ;
  - le générateur simulé oriente les centrales selon les ports, puis le rythme, puis l'écart d'accès.
- **`docs/croquis/organique/`** :
  - planches 4×4 et 5×5 ;
  - plateaux A (pose libre) et B (pose symétrique) pour chaque format ;
  - `mesures.json`, `centrales-ouvertes-200.json` ;
  - `rythme-200.json` est périmé, il vient de l'ancienne mesure.

## Modèles
Tous passent `validerModele` (0 blocage, 0 alerte) et le contrôle de tracé. Aucun n'a de poche, de passage traversant ou vers un coin, ni de miroir.

| Format | Modèle | Cases | Ports (coins desservis) | Passages | Exemplaires |
|---|---|---|---|---|---|
| 4×4 | **Q1** Trident à virage | 4 | 3 (NO, NE, SE) | 1 virage | 4 |
| 4×4 | **Q2** Étoile à crochet | 5 | 4 | 1 crochet | 3 |
| 4×4 | B1 Bord en V | 3 | 2 | 0 | 8 |
| 4×4 | B8 Bord à virage | 4 | 2 | 1 | 1 |
| 4×4 | K2 Coin à relais | 3 | 1 | 0 | 4 |
| 4×4 | K4 Coin en losange | 4 | 1 | 0 | 1 |
| 5×5 | **U1** Trident à virage | 4 | 3 | 1 | 5 |
| 5×5 | P3 T sans case | 3 | 2 | T | 2 |
| 5×5 | P5 Double virage | 3 | 2 | 2 | 2 |
| 5×5 | P1 Virage double | 3 | 2 | 1 | 1 |
| 5×5 | P2 Équerre à virage | 3 | 2 | 1 | 1 |
| 5×5 | B1 Bord en V | 3 | 2 | 0 | 3 |
| 5×5 | B7 Bord simple | 2 | 1 | 0 | 12 |
| 5×5 | K2 Coin à relais | 3 | 1 | 0 | 5 |

**Retirés :**
- en 4×4, O9, O10, O11, O6 et O7, qui desservent 1 ou 2 coins seulement, et O2, qui a 2 passages ;
- en 5×5, P6 (4 cases pour 2 ports) et B9 (3 cases pour 1 port).

En 5×5, B1 passe à 3 exemplaires et B7 à 12, pour descendre à 77 cases.

## Équilibre des accès au centre : définition
- **Milieu :**
  - 4×4 : la rangée de jonctions j = 2 ;
  - 5×5 : la rangée neutre et les jonctions j = 2 et 3.
- **Portes d'un camp :** les liaisons du graphe entre un nœud du camp et un nœud du milieu (port, raccord ou réseau de passages).
- **Écart :** portes vertes − portes rouges.
- **Complément :** le nombre de chemins indépendants des apparitions d'un camp vers le milieu.

## Mesures (200 plateaux par série, villes placées par `placerVilles`, rythme strict)

| Série | Cases moy. | Chaîne moy. / pire / ≤ 3 | S meilleur / médiane | « 5 contre 2 » | Écart d'accès : moy. abs / pire / ≤ 1 | Placements admissibles |
|---|---|---|---|---|---|---|
| 4×4 actuel | 63,1 | 5,24 / 7 / 0 % | 0,85 / 1,84 | 3 % | 0,62 / 2 / 95 % | 32,8 |
| 4×4 `44` | 56,2 | 3,85 / 6 / 36 % | 0,97 / 2,24 | 1 % | 0,95 / 3 / 81 % | 35,4 |
| **4×4 révision, pose libre** | 57,4 | 3,55 / 4 / 46 % | 0,55 / 1,59 | 0 % | **0,22 / 1 / 100 %** | 36 |
| **4×4 révision, pose symétrique** | 58,5 | 3,28 / 5 / **73 %** | 0,02 / 1,02 | 0 % | 0 / 0 / 100 % | 36 |
| 5×5 actuel | 77,6 | 7,71 / 9 / 0 % | 1,01 / 1,41 | 0 % | 1,14 / 3 / 76 % | 2,55 |
| 5×5 `44` | 80,9 | 3,76 / 6 / 45 % | 2,58 / 3,08 | 1 % | 1,40 / 6 / 63 % | 2,84 |
| **5×5 révision, pose libre** | **77** | 3,07 / 5 / **91 %** | 3,07 | 0 % | **0,50 / 4 / 91 %** | **1** |
| **5×5 révision, pose symétrique** | 78 | 2,90 / 5 / **94 %** | 0,84 / 1,38 | 0 % | 0 / 0 / 100 % | 4 |

Sur toutes les séries :
- l'écart minimal entre villes vaut 4 pas ;
- toutes les villes ont 3 accès ;
- le 4×4 a au moins 3 ports par jonction, le 5×5 au moins 2.

## Constats
1. **5×5 : la contrainte est arithmétique.**
   - On a toujours cases = ports + 38.
   - À 77 cases, il n'y a que 39 ports, exactement le minimum pour 7 villes à 3 ports et 9 jonctions à 2.
   - D'où un **seul placement de villes admissible** par plateau, avec un S d'environ 3, contre 1 pour l'actuel.
2. **Pose symétrique en 5×5 :** elle demande 78 cases au minimum, puisque le nombre de ports y est pair, et P5 obligatoire au centre.
3. **L'écart nul et le S presque nul de la pose symétrique sont construits** par la symétrie elle-même. Le vrai gain se lit sur le rythme : 73 % de chaînes ≤ 3 contre 46 % en 4×4, 94 % contre 91 % en 5×5.
4. **D'où vient la baisse du déséquilibre d'accès :**
   - en 4×4, du catalogue ;
   - en 5×5, de l'**orientation** choisie par le générateur. Le catalogue seul donne 1,34.
5. **Les chaînes de 4 qui restent en 4×4** (54 % des plateaux en pose libre) viennent à environ 60 % de la ligne porteuse – apparition – apparition – porteuse, le long du raccourci entre deux bords voisins.
6. **Variété du 4×4 :** il ne reste que 2 centrales, et Q2 ressemble à l'ancienne étoile.
7. **Écart avec le `44`** sur les mêmes séries : il vient de la mesure stricte et du placement des villes par `placerVilles`.
8. **Pose symétrique et stock :** elle demande des exemplaires en nombre pair.

## Questions soumises à l'utilisateur (2026-10-17)
1. 5×5 : 77 cases avec un seul placement de villes, ou 78 cases avec plus de liberté ?
2. Pose symétrique (180°) dans le générateur ?
3. 4×4, chaînes de 4 le long du raccourci : les accepter, compter le raccourci comme une zone d'intérêt, ou redessiner un bord ?
4. Q2, qui rappelle l'ancienne étoile, ou des centrales à 3 coins seulement ?
5. P3 (T sans case qui relie O et E) : est-ce un passage traversant ?
6. Un coin plus léger que K2 ?
