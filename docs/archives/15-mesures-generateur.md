# Mesure 8 : sortie du générateur et ports de coin morts des formes réduites (sous-agent 8)

Généré par `outils/mesures-generateur.js` (300 graines « m8-1 » à « m8-300 », 200 plateaux par forme réduite). Catalogue réel `PM.catalogue.nouveauDocument()`.

Critère d'équilibre de `docs/archives/16-avis-mesures-equilibre.md` : S = Σ |D1(k) − D2(k)| sur les 7 rangs ; « D6 étendu » = écart > 2 à un rang de 1 à 7 ; « 5 contre 2 » ; invariant « première ville à la même distance ». N = villes non traversables (défaut de l'outil), T = traversables. Générateur : 200 candidats, élimination (5 contre 2 en N, D6 étendu, première ville, connexité, validation), tirage au hasard parmi les candidats de S ≤ Smin + 1 (tolérance 1, réglage par défaut) et, à S égal, de pénalité secondaire minimale (raccords morts au-delà de 2, ports morts, apparitions à moins de 2 sorties).

Tirage uniforme de comparaison : `tirerPlateaux(300, 20261015)` de `outils/mesures-equilibre.js` (mêmes tirages que `docs/archives/12-mesures-equilibre.md`, 300 premiers plateaux), carrefours (1,2)+(3,2).

## 1. Équilibre : générateur contre tirage uniforme

| Mesure | Uniforme, défaut | Générateur, défaut | Générateur, carrefours variés | Générateur, tolérance 0 (variante) |
|---|---|---|---|---|
| Plateaux | 300 | 300 | 300 | 300 |
| S moyen (N) | 1.92 | 0.75 | 0.62 | 0.00 |
| S maximal (N) | 8 | 1 | 1 | 0 |
| S ≥ 4 (N) | 26 (8.7 %) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) |
| Écart D6 moyen, rangs 1 à 4 (N) | 0.44 | 0.18 | 0.17 | 0.00 |
| Écart maximal, rangs 1 à 7 (N) | 3 | 1 | 1 | 0 |
| D6 étendu, écart > 2 (N) | 2 (0.7 %) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) |
| 5 contre 2 (N) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) |
| Première ville différente (N) | 0 | 0 | 0 | 0 |
| S moyen (T) | 1.68 | 0.73 | 0.69 | 0.18 |
| S maximal (T) | 6 | 2 | 2 | 2 |
| S ≥ 4 (T) | 15 (5.0 %) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) |
| Écart D6 moyen, rangs 1 à 4 (T) | 0.44 | 0.18 | 0.17 | 0.00 |
| Écart maximal, rangs 1 à 7 (T) | 2 | 1 | 1 | 1 |
| D6 étendu, écart > 2 (T) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) |
| 5 contre 2 (T) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) | 0 (0.0 %) |
| Première ville différente (T) | 0 | 0 | 0 | 0 |
| Raccords morts, moyenne | 0.69 | 0.65 | 0.65 | 0.64 |
| Raccords morts, maximum | 1 | 1 | 1 | 1 |
| Ports de coin morts, moyenne | 0.00 | 0.00 | 0.00 | 0.00 |

Distribution de S (N), tirage uniforme :
```
valeur |       n |      % |
     0 |      30 |  10.0 % | #####
     1 |      87 |  29.0 % | ###############
     2 |     103 |  34.3 % | #################
     3 |      54 |  18.0 % | #########
     4 |      17 |   5.7 % | ###
     5 |       3 |   1.0 % | #
     6 |       5 |   1.7 % | #
     8 |       1 |   0.3 % | 
```
Distribution de S (N), générateur, paire par défaut :
```
valeur |       n |      % |
     0 |      74 |  24.7 % | ############
     1 |     226 |  75.3 % | ######################################
```
Distribution de S (N), générateur, carrefours variés :
```
valeur |       n |      % |
     0 |     114 |  38.0 % | ###################
     1 |     186 |  62.0 % | ###############################
```
Distribution de S (N), générateur, tolérance 0 (variante, S = Smin) :
```
valeur |       n |      % |
     0 |     300 | 100.0 % | ##################################################
```
Distribution de S (T), générateur, paire par défaut :
```
valeur |       n |      % |
     0 |      96 |  32.0 % | ################
     1 |     188 |  62.7 % | ###############################
     2 |      16 |   5.3 % | ###
```
Raccords morts par plateau (uniforme / générateur) :
```
valeur |       n |      % |
     0 |      92 |  30.7 % | ###############
     1 |     208 |  69.3 % | ###################################
```
```
valeur |       n |      % |
     0 |     104 |  34.7 % | #################
     1 |     196 |  65.3 % | #################################
```
## 2. Carrefours retenus (option « carrefours variés »)

| Paire | Plateaux | Part |
|---|---|---|
| (1,2)+(3,2) | 97 | 32.3 % |
| (1,2)+(2,2) | 39 | 13.0 % |
| (2,2)+(3,2) | 30 | 10.0 % |
| (1,1)+(1,3) | 21 | 7.0 % |
| (3,1)+(1,3) | 18 | 6.0 % |
| (1,1)+(2,3) | 15 | 5.0 % |
| (3,1)+(3,3) | 15 | 5.0 % |
| (1,1)+(3,3) | 14 | 4.7 % |
| (2,1)+(2,3) | 13 | 4.3 % |
| (2,1)+(1,3) | 13 | 4.3 % |
| (2,1)+(3,3) | 13 | 4.3 % |
| (3,1)+(2,3) | 10 | 3.3 % |
| (1,2)+(1,3) | 1 | 0.3 % |
| (2,1)+(3,2) | 1 | 0.3 % |

Nombre de paires permises par plateau (paire par défaut comprise) : moyenne 5.65, histogramme :
```
valeur |       n |      % |
     1 |      31 |  10.3 % | #####
     2 |      47 |  15.7 % | ########
     3 |      31 |  10.3 % | #####
     4 |      17 |   5.7 % | ###
     5 |      32 |  10.7 % | #####
     6 |      32 |  10.7 % | #####
     7 |      11 |   3.7 % | ##
     8 |      36 |  12.0 % | ######
     9 |      11 |   3.7 % | ##
    10 |      10 |   3.3 % | ##
    11 |      11 |   3.7 % | ##
    12 |      31 |  10.3 % | #####
```
Réglage par défaut : paire (1,2)+(3,2) sur 300 plateaux sur 300.

## 3. Diversité

Profil = « D1 trié | D2 trié ».

| Cas | Profils distincts (N) | Plus fréquent (N) | Profils distincts (T) | Plus fréquent (T) | Plateaux (tuiles et rotations) distincts |
|---|---|---|---|---|---|
| Uniforme, défaut | 112 | 11 (3.7 %) | 82 | 25 (8.3 %) | 300 |
| Générateur, défaut | 36 | 32 (10.7 %) | 37 | 51 (17.0 %) | 300 |
| Générateur, carrefours variés | 80 | 15 (5.0 %) | 74 | 27 (9.0 %) | 300 |
| Générateur, tolérance 0 (variante) | 10 | 79 (26.3 %) | 14 | 105 (35.0 %) | 300 |

Présence des modèles (part des plateaux où le modèle est posé) :

| Modèle | C1 | C2 | C3 | C4 | C5 | C6 | K1 | K2 | K3 | K4 | K5 | B1 | B2 | B3 | B4 | B5 | A1 | A2 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Uniforme | 71.0 % | 69.0 % | 68.3 % | 60.7 % | 61.7 % | 69.3 % | 79.7 % | 78.3 % | 80.0 % | 80.7 % | 81.3 % | 80.3 % | 84.7 % | 79.3 % | 75.0 % | 80.7 % | 100.0 % | 100.0 % |
| Générateur | 68.0 % | 66.3 % | 67.0 % | 67.0 % | 66.3 % | 65.3 % | 80.7 % | 81.3 % | 76.0 % | 83.0 % | 79.0 % | 81.7 % | 78.3 % | 82.3 % | 80.0 % | 77.7 % | 100.0 % | 100.0 % |
| Générateur, tolérance 0 | 60.3 % | 69.0 % | 70.3 % | 66.0 % | 70.0 % | 64.3 % | 82.0 % | 81.0 % | 71.3 % | 82.7 % | 83.0 % | 83.0 % | 80.0 % | 84.0 % | 77.3 % | 75.7 % | 100.0 % | 100.0 % |

## 4. Goulets et flancs (fonctions de `outils/mesures-equilibre.js`, villes traversables)

| Cas | Min. chemins disjoints par joueur | Points d'articulation (cas avec au moins un) | Flanc plus court que le centre |
|---|---|---|---|
| Uniforme | 3 : 600 | 0 / 600 | 0 / 600 |
| Générateur | 3 : 600 | 0 / 600 | 0 / 600 |

## 5. Temps et essais

- Paire par défaut : temps moyen 88.41 ms par génération (médiane 87.09 ms, max 122.88 ms) ; essais moyens 202.10 pour 200.00 candidats valides ; bons candidats (S ≤ Smin + tolérance) : moyenne 89.36, minimum 69 ; échecs : 0.
- Carrefours variés : temps moyen 91.20 ms par génération (médiane 89.46 ms, max 115.69 ms) ; essais moyens 202.10 pour 200.00 candidats valides ; bons candidats (S ≤ Smin + tolérance) : moyenne 89.36, minimum 69 ; échecs : 0.
- Tolérance 0 : temps moyen 86.31 ms par génération (médiane 83.99 ms, max 124.15 ms) ; essais moyens 202.10 pour 200.00 candidats valides ; bons candidats (S ≤ Smin + tolérance) : moyenne 24.47, minimum 11 ; échecs : 0.

## 6. Ports de coin morts des formes réduites

14 formes réduites valides, 200 plateaux remplis au hasard par forme (tirage sans remise par rôle, rotation aléatoire des centrales), sans jetons. Un port de coin mort vise une jonction qui ne peut pas recevoir de jeton avec cette forme (`PM.modele.portsCoinMorts`).

| Forme | Besoins (centrale / coin / bord / apparition) | Jonctions possibles | Ports morts : moyenne | min | max | Raccords morts ou face au vide : moyenne | max |
|---|---|---|---|---|---|---|---|
| coin (0,0) | 4 / 4 / 3 / 4 | 8 | 2.00 | 2 | 2 | 1.70 | 2 |
| coin (3,0) | 4 / 4 / 3 / 4 | 8 | 2.00 | 2 | 2 | 1.70 | 2 |
| coin (0,3) | 4 / 4 / 3 / 4 | 8 | 2.00 | 2 | 2 | 1.70 | 2 |
| coin (3,3) | 4 / 4 / 3 / 4 | 8 | 2.00 | 2 | 2 | 1.65 | 2 |
| coins (0,0) et (3,0) | 4 / 4 / 2 / 4 | 7 | 4.00 | 4 | 4 | 2.69 | 3 |
| coins (0,0) et (0,3) | 4 / 4 / 2 / 4 | 7 | 4.00 | 4 | 4 | 2.67 | 3 |
| coins (0,0) et (3,3) | 4 / 4 / 2 / 4 | 7 | 4.00 | 4 | 4 | 2.65 | 3 |
| coins (3,0) et (0,3) | 4 / 4 / 2 / 4 | 7 | 4.00 | 4 | 4 | 2.67 | 3 |
| coins (3,0) et (3,3) | 4 / 4 / 2 / 4 | 7 | 4.00 | 4 | 4 | 2.77 | 3 |
| coins (0,3) et (3,3) | 4 / 4 / 2 / 4 | 7 | 4.00 | 4 | 4 | 2.62 | 3 |
| coin (0,0) et bord (0,1) | 3 / 4 / 3 / 4 | 7 | 2.00 | 2 | 2 | 1.48 | 2 |
| coin (3,0) et bord (3,1) | 3 / 4 / 3 / 4 | 7 | 2.00 | 2 | 2 | 1.51 | 2 |
| coin (0,3) et bord (0,2) | 3 / 4 / 3 / 4 | 7 | 2.00 | 2 | 2 | 1.54 | 2 |
| coin (3,3) et bord (3,2) | 3 / 4 / 3 / 4 | 7 | 2.00 | 2 | 2 | 1.56 | 2 |

## Constats

- **Élimination** : sur les 300 graines, le générateur produit 300 plateaux (0 échec(s)). Aucun n'a « 5 contre 2 » en N (0) ni en T (0) ; D6 étendu > 2 : 0 en N, 0 en T ; première ville différente : 0 (N), 0 (T).
- **Score S (N)** : moyenne 0.75 pour le générateur contre 1.92 au tirage uniforme ; S ≥ 4 : 0.0 % contre 8.7 %. En T : 0.73 contre 1.68 (le générateur optimise S dans le mode N).
- **Carrefours variés** : la paire par défaut reste retenue dans 32.3 % des plateaux ; 14 paires différentes apparaissent ; S moyen (N) 0.62, « 5 contre 2 » 0 (N) / 0 (T).
- **Diversité** : 36 profils (N) sur 300 plateaux générés contre 112 au tirage uniforme ; 80 avec carrefours variés ; 10 avec la tolérance 0 (S moyen 0.00, S maximal 0). Le profil le plus fréquent couvre 10.7 % des plateaux générés contre 3.7 % au tirage uniforme. Les tuiles et rotations restent toutes distinctes.
- **Raccords morts** : moyenne 0.65 (max 1) contre 0.69 (max 1) ; présence de C6 (le « mur ») : 65.3 % contre 69.3 %.
- **Temps** : 88.41 ms en moyenne par génération de 200 candidats sous Node (91.20 ms avec carrefours variés).
- **Formes réduites** : ports de coin morts par plateau entre 2 et 4 selon la forme ; 14 forme(s) sur 14 ont un nombre constant (ports obligatoires des rôles) ; 0 forme(s) impossibles à remplir avec le catalogue.

## Points à soumettre à l'advisor design de jeu

1. **Diversité contre équilibre (tolérance réglée à 1).** Avec la tolérance 1 (réglage par défaut), S moyen 0.75, S maximal 1, 36 profils (N). Avec la tolérance 0 (meilleur S seulement), S = 0 sur 100.0 % des plateaux mais 10 profils seulement, le plus fréquent couvrant 26.3 % des plateaux (tirage uniforme : 112 profils, S moyen 1.92). La tolérance 1 respecte « pas toujours le meilleur » (D7 n° 4) sans approcher le seuil « à surveiller » S ≥ 4. Garder 1, revenir à 0, ou fixer un seuil absolu (par exemple S ≤ 2) ?
2. **Carrefours variés.** Avec la règle du doc 16 (aucune alerte dans les deux modes, S ≤ S de la paire par défaut), 10.3 % des plateaux n'admettent que la paire par défaut, et les paires (1,2)+(2,2) et (2,2)+(3,2) dominent parmi les autres. Faut-il activer l'option par défaut pour gagner en variété (80 profils au lieu de 36) ?
3. **Mode de calcul.** Le générateur minimise S en villes non traversables ; en villes traversables le S obtenu reste faible (moyenne 0.73, maximum 2). À reconsidérer quand la règle « villes traversables » sera tranchée.
4. **Formes réduites.** Le nombre de ports de coin morts est fixé par la forme (2 avec un coin retiré ou un coin et son bord, 4 avec deux coins), quel que soit le tirage : ce sont les ports obligatoires des rôles vers des jonctions perdues. Alerte permanente acceptable en mode manuel, ou faut-il la regrouper en une seule information par forme ?
5. **Raccords morts** : le générateur ne pénalise qu'au-delà de 2 (seuil du doc 9) pour ne pas écarter le « mur » de C6 ; présence de C6 inchangée à quelques points près. À confirmer.
6. **Raccords morts des formes à 2 coins retirés** : jusqu'à 3 raccords morts ou face au vide par plateau (moyenne 2.68), au-dessus du seuil « max ≤ 2 » du doc 9 (raccords des apparitions voisines vers le vide, plus le « mur » de C6). Seuil à adapter aux formes réduites ?

Durée du calcul : 82.6 s.
