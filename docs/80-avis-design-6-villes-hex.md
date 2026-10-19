# Avis design de jeu : critères d'équilibre à 6 villes (hexagonal) (conseiller, Opus 5.5), 2026-10-19

Lecture seule : aucun fichier du dépôt n'a été modifié. Mesures faites sur une **copie** de `src/` et `tests/` (worktree `hexagonal`, commit `1335da2`). Scripts et sorties dans le scratchpad `conseiller-6villes/` : `lib.js`, `collecte.js`, `rapport.js`, `t2.js`, et `out/` (`c0..c3.json`, `tableaux.txt`, `complements.txt`).

## 1. Méthode
- **Catalogue** : HC2, HC3, HB1, HK1 de `tests/graphe-hex.test.js`. Stock de `docs/75` sans HC1 : les 7 intérieures sont tirées sans remise parmi 6 HC2 et 5 HC3 ; le pourtour est fixe (HB1, HK1, rotation imposée).
- **600 plateaux**, graine `mulberry32(20261019 + 7919·b)`.
- **Recherche** : pour chaque plateau, les **2187 combinaisons de rotations** des intérieures sont toutes essayées (0, 1, 2 : HC2 et HC3 sont symétriques par demi-tour). Pour chaque placement de villes, on retient au hasard une combinaison qui tient l'écart (villes à 4 pas au moins). Les ports n'entrent pas en compte : avec H2, les 24 sièges ont toujours 3 ports.
- **Placements** : 430 placements symétriques (3 sièges au nord et leur image par demi-tour ou par miroir nord-sud). Le trèfle en fait partie.
- **Pose libre** : rotations 0 à 5 au hasard. On mesure le trèfle, les 430 placements symétriques et 60 placements 3 + 3 au hasard par plateau (36 000 configurations).
- **Mesures** : `GR.equilibre`, `connexions`, `rythme`, `accesCentre`, `goulets` et `villesProches`. Pour l'anneau, l'équilibre est recalculé avec l'anneau coupé aux coins neutres.
- **Exactitude de l'écart** : la matrice des distances entre sièges est calculée une fois par combinaison. Elle est exacte sous 4 pas, car un chemin de 3 pas ou moins entre deux sièges ne peut pas traverser un troisième siège.

## 2. Mesures

| Mesure | Recherche, trèfle (600) | Recherche, autres placements (2537) | Pose libre, trèfle (600) | Pose libre, 430 sym. (258 000) | Pose libre, 3 + 3 au hasard (36 000) |
|---|---|---|---|---|---|
| Écart tenu (villes ≥ 4 pas) | 100 % (par construction) | 100 % | **0,9 %** des rotations | ≈ 0 % (22 configurations) | **0 %** |
| Bloqués | 0 | 0,3 % (« 4 contre 2 ») | 0 | 4,7 % | 6,3 % |
| S : moyenne ; médiane / 90e / **95e** / 99e / max | 0,52 ; 1 / 1 / **1** / 1 / 1 | 0,66 ; 1 / 2 / **2** / 3 / 3 | 0,77 ; 1 / 2 / 2 / 3 / 3 | 1,22 ; 1 / 3 / **3** / 4 / 8 | 2,22 ; 2 / 4 / **5** / 6 / 10 |
| S ≥ 3 / ≥ 4 / ≥ 5 | 0 / 0 / 0 | 1,3 / 0 / 0 % | 3,2 / 0 / 0 % | 12,1 / 3,4 / 0,8 % | 38 / 16 / 5,3 % |
| Majorité 4 ou plus | 0 | 0,3 % | 0 | 4,7 % | 6,3 % |
| Partage 3/3 | 100 % | 99,4 % | 100 % | 50 % | 43 % |
| Écart max par rang : 2 / 3 | 0 / 0 | 3,2 % / 0 | 5,5 % / 0 | 9,3 / 0,6 % | 13,2 / 0,6 % |
| Première ville 2/2 | 100 % | 100 % | 100 % | 99,8 % | 99,0 % |
| Tempo ≤ 3 pas (vert/rouge) | 4/4 partout | 4/4 51 %, 3/3 32 %, inégal 17 % | inégal 33 % | — | — |
| Cases / faibles | 56 / 0 | 56 / 0 | 56 / 0 | — | — |
| Rythme (distMax / chaîne) | 1 / 2 | 1 / 2 | 1 / 2 (99 %) | — | — |
| Accès au centre : écart des portes ; écart des chemins | −6 à +6 (0 : 37 %) ; ±1 dans 42 % | −6 à +6 ; ±1 dans 37 %, 3 dans 0,3 % | ±3 dans 6 % | — | — |
| Goulets | min 3 chemins, 0 articulation | id. | id. | — | — |

**Compléments**
- **Combinaisons valides pour le trèfle** : 19 sur 2187 en moyenne, au moins 1. Le nombre dépend de HC3 : 77 avec 1 HC3, 2,7 avec 5 HC3. Meilleur S atteignable : 0 dans 95 % des plateaux.
- **Placements faisables** :
  - 49 sur 430 au moins une fois ; médiane de 4 par plateau. Le chiffre de 66 du `75` n'est pas retrouvé avec ce stock.
  - Le trèfle et son miroir est-ouest (1, 2, 11, 12, 21, 22) passent toujours.
  - 8 autres placements passent sur 12 à 29 % des plateaux : 0,4,5,18,19,23 · 2,3,11,12,20,21 · 0,7,8,15,16,23 · 1,5,11,12,18,22 · 3,4,8,15,19,20 · 1,2,7,16,21,22 (demi-tour), 1,2,7,18,19,23 · 0,4,5,16,21,22 (miroir).
- **S selon le partage**, pose libre au hasard :

| Partage | S moyen | 95e centile |
|---|---|---|
| 3/3 | 2,1 | 4 |
| 3/2/1 | 2,4 | 5 |
| **4/2** | **3,4** | 6 |
| **4/1/1** | **4,6** | 7 |
| 5/1 | 5,9 | 8 |

  La majorité 4 va donc de pair avec un S élevé.
- **Zones du centre** : 5 / 14 / 5, ou 8 / 8 / 8 si « milieu » veut dire au moins 2 tuiles neutres. Les deux donnent **exactement** le même écart de portes : avec H2, chaque siège a un port par tuile. L'écart de portes dépend peu de l'équilibre (corrélation de 0,23 avec ΣD vert − ΣD rouge).

## 3. Critères proposés (validation du `77`)

| Critère | `77` | **Avis** | Raison |
|---|---|---|---|
| Majorité « 4 contre 2 » (≥ 4, ex-aequo compris) | bloquant | **bloquant, validé** | Jamais atteinte sur les plateaux acceptés, sauf 0,3 % des placements non trèfle. En pose libre, 5 à 6 % des configurations, avec un S moyen de 3,4 à 4,6. C'est la règle N − 2 du carré. |
| Alerte de majorité intermédiaire | aucune | **aucune** | « 3 contre 3 » est le seul partage symétrique, et 3/2/1 reste en information. |
| S, alerte | ≥ 4 | **≥ 4, validé** | Maximum des plateaux acceptés : 3 (99e = 3), donc jamais d'alerte sur un plateau du générateur. Alerte dans 3,4 % des poses libres symétriques et 16 % au hasard. |
| S, information | ≥ 3 | **= 3, validé** | 1 % des plateaux acceptés, 3 % pour le trèfle posé librement. |
| Règle « 95e centile des acceptés » du `48`, à la lettre | — | **non appliquée** | Elle donnerait 2 : une alerte sur 14 % des plateaux acceptés hors trèfle. Elle a été conciliée comme au `60` : alerte au-delà de tout plateau accepté, au 95e des poses libres (3 à 5). |
| Écart par rang : alerte > 2, blocage > 3 | inchangé | **validé** | Accepté : 2 au plus. Pose libre : 3 dans 0,6 %, jamais 4. |
| Première ville inégale | alerte | **alerte, inchangée** | 0 % sur les plateaux acceptés, 1 % au hasard. Elle sert de filet pour les tuiles de l'utilisateur. |
| Partage 3/2/1 | information | **validé** | |
| Ville à < 3 ports | information | **validé** | 0 % avec le catalogue. Un tel siège enfreint déjà H2 (`coin_non_porte`) : une alerte ferait doublon. |
| Zones du centre 5 / 14 / 5 | | **gardées** | Même définition qu'en 5×5 (« touche la rangée neutre »). Le découpage 8 / 8 / 8 ne change aucune mesure. L'écart d'accès au centre reste une information, trop bruité pour un critère. |
| Rythme | | **information seulement** | distMax 1 et chaîne 2 partout : la mesure ne discrimine plus (prévu au `73`). |

**À retenir pour le générateur et l'interface.** En pose libre, l'écart de 3 cases n'est tenu que dans **0,9 %** des rotations, même avec le trèfle. Un plateau fait à la main a donc presque toujours l'alerte « villes trop proches ». Il faut une aide « Orienter les tuiles » (recherche exhaustive, 2187 combinaisons, environ 1,3 s) ou bien le générateur.

## 4. Code à changer (lignes de la copie)
Les seuils proposés sont bons : **aucune valeur ne change**. Seuls des commentaires, un test et le futur générateur sont touchés.
- **`src/graphe.js:68`** : commentaire de calibrage à remplacer par :
  `/** Hexagonal (6 rangs, calibré docs/80 sur 600 plateaux : S accepté ≤ 3, 95e de la pose libre 3 à 5) : alerte dès S = 4, information à 3. Tables à part. */`
- **`src/graphe.js:52`** : remplacer « (docs/73) » par « (docs/73, validé docs/80) ». Les valeurs `'hex19': 4` et `SEUIL_MAJORITE_ALERTE_PAR_FORMAT` sans `hex19` (`:53`) restent telles quelles.
- **`tests/graphe.test.js:222-224`** : laisser `SEUIL_S_PAR_FORMAT` au carré. `tests/graphe-hex.test.js` vérifie déjà `seuilS('hex19') = 4` et `3`.
- **Générateur, lot à venir** (`src/generateur.js`, à créer en hexagonal) :
  - poser les villes d'abord (trèfle par défaut, ou les 10 placements listés au § 2), puis **parcourir les 2187 combinaisons** de rotations ;
  - garder les combinaisons qui tiennent l'écart et prendre celle de S minimal (S = 0 dans 95 % des cas) ;
  - rejet hexagonal à **S ≥ 3**, comme `REJET_S` en 5×5 : aucune information S ne s'affiche sur un plateau généré ;
  - passer au plateau suivant s'il n'y a aucune combinaison (jamais vu avec le trèfle ; 1 combinaison au pire avec 5 HC3).

## 5. Anneau du pourtour
**Il ne déséquilibre pas de façon mesurable.**
- Le pourtour est identique par rotation : un seul modèle de bord et un seul modèle de coin, à rotation imposée. L'anneau est donc symétrique par construction.
- Le couper aux coins neutres **dégrade** le plateau :

| Mesure | Anneau gardé | Anneau coupé |
|---|---|---|
| S moyen, recherche (trèfle) | 0,52 | 0,93 (jusqu'à 5) |
| S moyen, pose libre | 0,77 | 1,42 |
| Tempo | 4/4 | 3/3 |
| Cases faibles | 0 | 6 cases |
| Partage et première ville | inchangés | inchangés |

- Son seul effet propre : **une apparition verte est à 2 pas d'une rouge** (4 à 5 pas sans l'anneau). C'est une question de contact et d'agression, donc une règle de jeu, pas un défaut d'équilibre.

## Décisions pour l'utilisateur
1. **« 4 contre 2 » bloquant** (ex-aequo compris : 4/1/1 aussi), sans alerte intermédiaire : confirmer.
2. **Seuils S de l'hexagonal : alerte dès 4, information à 3** ; rejet du générateur à S ≥ 3 : confirmer.
3. **Liste de dispositions** : le trèfle seul, ou aussi son miroir et les 8 autres placements faisables sur au moins 12 % des plateaux ? Les 66 du `75` ne sont pas retrouvés : 49 au mieux, médiane de 4 par plateau.
4. **Aide « Orienter les tuiles »** pour la pose à la main ? Sans elle, 99 % des plateaux faits à la main ont des villes trop proches.
5. **Anneau du pourtour** : gardé. Le contact à 2 pas entre apparitions adverses est-il voulu par les règles ?
