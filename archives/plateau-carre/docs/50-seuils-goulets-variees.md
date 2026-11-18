# Seuils par format, goulets 5×5, jonctions variées par défaut, durée de la suite (sous-agent de production, Sonnet 5.5), 2026-10-18

Rapport du sous-agent, consigné par l'orchestrateur. Il applique les décisions de `18` (« Réponses… `48` »), corrige le défaut de `49` et suit l'arbitrage de l'orchestrateur sur la durée des tests.

Vérification de l'orchestrateur : `node --test` donne 681 tests, 674 OK, 0 échec, 7 ignorés (PDF), en 75 s. Recettes navigateur données par le sous-agent : 320 OK et 116 OK, 0 échec.

## 1. Seuils de S par format
- `graphe.js` :
  - `SEUIL_S = 5` reste le seuil de rejet du générateur ;
  - `SEUIL_S_PAR_FORMAT` : alerte à 5 en 4×4, à 7 en 5×5 ;
  - `SEUIL_S_INFORMATION_PAR_FORMAT` : information à partir de 4 en 4×4, de 5 en 5×5 ;
  - fonctions `seuilS()` et `seuilSInformation()`.
- L'alerte `score_s`, le rapport d'équilibre et son texte d'explication utilisent les seuils du format.
- Tests adaptés, sans affaiblir le 4×4. Un nouveau test couvre S = 4 à 7 dans les deux formats.
- Dans la recette du générateur 5×5, la graine du plateau « conseil » change : avec l'alerte à 7, l'ancienne graine ne produisait plus le cas visé.

## 2. Goulets 5×5 (préférence)
`generateur.js` gagne `pointsArticulation(g)`. Les 6 finalistes sont classés dans cet ordre : chaîne au-delà de la cible, puis points d'articulation, puis écart d'accès, puis chaîne.

Mesure sur 200 plateaux :

| | Avant | Après |
|---|---|---|
| Point d'articulation | 8,5 % | **0 %** |
| Chaîne ≤ 3 | 100 % | 100 % |
| S moyen | 0,56 | 0,57 |
| Moitiés égales | 100 % | 100 % |
| Montable avec la boîte | 96,0 % | 95,5 % |
| Temps par plateau | 1228 ms | 1238 ms |

## 3. 4×4 : « jonctions variées » par défaut
- Option cochée par défaut ; `false` revient à la rangée centrale.
- Les anciens tests qui supposaient la rangée centrale passent `false` explicitement. Un nouveau test couvre le comportement par défaut.

Mesure sur 200 plateaux :

| | Rangée centrale | Variées (défaut) |
|---|---|---|
| Placements de villes | 3 | 12 |
| S moyen | 0,59 | 0,52 |
| Chaîne ≤ 3 | 100 % | 100 % |
| Montable | 96,5 % | 97,5 % |
| Point d'articulation | 0 % | 1,5 % |

L'évitement des points d'articulation n'est pas étendu au 4×4 : c'est noté dans `25`.

## 4. Rythme en information
Le rapport ajoute « (bien au-dessus de la cible) » quand la chaîne atteint 7 ou que distMax atteint 6. Ce n'est jamais une alerte.

## 5. Défaut de `49` corrigé
- `casesParMoitie` ne compte une jonction-case que si ses 4 tuiles sont posées. Le test laissé en `skip` est réactivé.
- Empreintes identiques sur des plateaux complets.
- **Correction annexe :** `GR.equilibre` signalait un « 5 contre 2 » sur un plateau où un camp n'a pas encore d'apparition. Le défaut apparaissait avec le nouveau réglage par défaut. Il est corrigé (`graphe.js:394`) et testé.

## 6. Durée de la suite
- Le calcul de stock est réparti sur 4 fils (`tests/aides-stock-worker.js`), avec les mêmes graines et le même seuil de 90 %.
- La limite du test « 200 candidats » passe à 12 s, avec un commentaire qui l'explique. Le 5×5 y prend 7,5 à 7,9 s.
- `node --test` passe de **157 s à 75 s**.

## 7. Documentation
- `10` : seuils par format, mesures, option par défaut, goulets.
- `25` : nouvelle section sur ce qui reste à mesurer.
- README : générateur et seuils.
- `docs/croquis/organique/` : mesures et images régénérées avec les mesures à jour.
