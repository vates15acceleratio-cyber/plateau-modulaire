# Avis géométrie : centrales « ponts » pour les 8 villes fixes du 5×5 (advisor, lecture seule), 2026-10-19

Scripts et sorties dans le scratchpad de la session (`advisor-ponts/`). Images copiées dans `docs/croquis/ponts/`.

## 1. Pourquoi B3 coince
- Les 4 villes du carré central demandent 12 ports. Ces ports viennent tous des centrales.
- **Centrale du milieu** : ses 4 coins sont des villes. Toute porteuse latérale (pont) B3 met deux villes voisines à 1 case. Aucune orientation n'est permise.
- **Centrales de milieu de bord** : leurs deux villes sont sur le même côté. Elles donnent 1 port au plus (2 pour LC4 posé est-ouest).
- **Centrales de coin** : 1 port au plus.
- On obtient donc **au plus 9 ports**, pas 12 (le `64` disait 10 par erreur). Résultat mesuré : 0 plateau sur 200, avec la règle de 3 cases comme avec la tolérance de 2 cases.

## 2. Nouvelles centrales ordinaires
| Id | Nom | Cases | Ports | Marge de tracé |
|---|---|---|---|---|
| **LC11** | Coins opposés | a (30,30) : port NO, raccords N et O ; b (70,70) : port SE, raccords E et S | 2 | 11,8 mm |
| **LC12** | Deux ponts ouverts | p (33,44) : NO + SO, raccords O et N ; q (67,56) : NE + SE, raccords E et S | 4 | 4,97 mm |
| LC13 | Équerre libre (non retenue) | — | 2 | 11,6 mm |

Contrôles sur LC11 et LC12 :
- 0 erreur au `validerModele` ;
- 0 problème de tracé ;
- signatures distinctes des modèles existants ;
- R1, R2 et R4 respectées.

Seule alerte : **R3** (raccord sur une porteuse).

**Assouplissement de R3 proposé**, pour les centrales 5×5 seulement :
- une porteuse à 1 port, sur le coin k, peut porter les raccords au milieu des deux côtés qui encadrent ce coin ;
- une porteuse latérale peut porter son raccord, plus le milieu d'un côté voisin (2 raccords au plus).

Avec cette règle, tous les modèles actuels restent sans alerte, et LC13 reste signalé : la règle reste étroite.

## 3. Mesures (200 plateaux, motif fixe, règle stricte de 3 cases partout)
| | B3 | **P12** | P |
|---|---|---|---|
| Plateaux réussis | 0 | **200** | 200 |
| Paires de villes à 2 cases | — | 0 | 0 |
| Chaîne ≤ 3 | — | 199 / 200 | 199 / 200 |
| Cases à ≤ 2 connexions | — | 1,7 % | 2,3 % |
| Cases par plateau | — | 57 | 57 |
| S moyen (max) | — | 0,5 (2) | 0,7 (3) |
| « 5 contre 3 », « 6 contre 2 » | — | 0 | 0 |

Composition des deux catalogues :
- **P12** : LC1 ×1, LC3 ×3, LC4 ×1, LC5 ×1, LC7 ×1, **LC11 ×2, LC12 ×3**, avec LB2 ×12 et LK2 ×4. Soit 28 tuiles, 5 planches A3. **LC2 et LC6 sont retirés.**
- **P** : comme P12, avec en plus LC6 ×1 et un LC3 de plus (4 au lieu de 3). Soit 30 tuiles, 5 planches A3 pleines.

**La tolérance de 2 cases n'est plus nécessaire.** La règle de 3 cases tient partout.

Le générateur doit **choisir la place** de chaque centrale tirée (LC11 au milieu, LC12 sur les milieux de bord). Sans ce choix, le taux de réussite tombe à 58 %.

Placements libres (damiers, générateur à 7 villes) : 200 sur 200 dans tous les cas. LC11 n'est pas une tuile du centre : dans les damiers, il est surtout posé ailleurs.

## 4. Risques
- **Rythme en génération libre** : la chaîne moyenne passe de 1,75 (B3) à 2,95 (P12).
- **Variété** : avec P12, les fourches passent d'environ 3,3 à 2,5 par plateau.
- **Marge de 4,97 mm sur LC12** : à faire valider par l'advisor prépresse.
- **Tests** : ceux qui figent la composition B3 et la règle R3 sont à mettre à jour.

## Décisions à soumettre à l'utilisateur
1. Assouplissement de R3 sur les centrales 5×5.
2. P12 (28 tuiles, sans LC2 ni LC6) ou P (30 tuiles, garde LC6).
3. Nouvelles tuiles LC11 et LC12 (images).
4. Recul du rythme en génération libre.
