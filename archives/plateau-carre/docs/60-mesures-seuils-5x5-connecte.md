# Mesures définitives et seuils du 5×5 très connecté (advisor design de jeu, Opus 5.5), 2026-10-18

Lecture seule : aucun fichier du dépôt n'a été modifié. Code mesuré : `b1bf0a0` (catalogue B3) ; le commit `b051cae` du testeur ne touche que `tests/`. Scripts et sorties dans le scratchpad `advisor-seuils-connecte/` : `collecte.js`, `lancer.sh`, `rapport.js`, `extras.js`, `conseil.js`, et `out/` (JSON par série, `resume.txt`).

## 1. Méthode

| Série | Contenu | Graines | Plateaux |
|---|---|---|---|
| **G5** générateur | `generer`, options par défaut | `'a60-5x5-<n>'` | 1000 |
| **L5** pose libre au poids | `tirerTuiles` (poids, avec remise), bords et coins tournés vers l'extérieur, centrales tournées au hasard | `mulberry32(20261018 + 7919·n)` (celles du `48`) | 1000 |
| **B5** pose « boîte » | 9 centrales tirées sans remise parmi les 12 imprimées, rotations au hasard | `mulberry32(50261018 + 7919·n)` | 1000 |
| **O5** pose soignée (modèle) | B5 puis recherche locale des rotations : pas de jonction à < 2 ports, au moins un placement admissible, peu de cases à ≤ 2 connexions | mêmes que B5 | 1000 |
| **G4 / G4A** 4×4 | `generer` avec la nouvelle définition du rythme / l'ancienne (`GR.rythme` forcé à `sansJonctions`) | `'a60-4x4-<n>'` | 200 + 200 |

- Pour L5, B5 et O5, **les 2016 placements 2-3-2** sont mesurés, en trois populations :
  - « tous » ;
  - « 3 ports » : chaque ville sur une jonction à 3 ports au moins ;
  - « admissibles » : 3 ports et 3 cases d'écart, comme `placementsAdmissibles`.
- La chaîne de filtres est celle de `causeRejet` : I (ville inaccessible), D (blocage), E (écart > 2), P (première ville), S (S ≥ 5).
- Ensuite, **« Placer les villes »** (`meilleurPlacementVilles`) est appliqué à chaque plateau. Le rythme, les connexions et les goulets sont mesurés sur ce placement et sur 6 placements admissibles non bloqués tirés au hasard.
- La pose O5 est un modèle de joueur soigneux, plus systématique qu'un humain : c'est une borne haute de la pose manuelle.

## 2. Générateur 5×5 (1000 plateaux)

| Mesure | **B3, `b1bf0a0`** | 4.00.0 (`48`) |
|---|---|---|
| Réussite | 100 % | 100 % |
| Temps par plateau | **1,16 s** seul (max 1,3 s) ; 2,5 s sous charge | 1,1 s |
| Essais par plateau | 362 pour 200 candidats | 205 |
| Rejets, en part des essais | `villes_ports` 38,6 %, `villes_proches` 6,2 %, rien d'autre | ecart 0,8 %, score_s 0,8 %… |
| Cases | 57,3 (57 : 72 %, 58 : 28 %) | 80,3 |
| Cases à ≤ 2 connexions | **1,9 %** ; plateaux conformes **100 %** ; 0 / 1 / 2 cases : 23 / 48 / 30 % | ≈ 66 % |
| Connexions par degré (2 / 3 / 4 / 5 / 6) | 1,9 / 38,2 / 47,1 / 12,1 / 0,7 % ; degré moyen 3,72 | — |
| Ports par jonction (2 / 3 / 4) | 5,8 / 90,9 / 3,3 % | — |
| Villes à 3 ports | 98,1 % des villes ; 7 villes à 3 ports dans 86,5 % des plateaux | — |
| Écart minimal entre villes | 4 pas (3 cases) partout ; 0 villes trop proches | — |
| **S** : moyenne ; médiane / 90e / 95e / 99e | **1,37** ; 1 / 3 / 3 / 4 (0 : 16 %, 1 : 45 %, 2 : 29 %, 3 : 9 %, 4 : 1,6 %) | 0,53 (0 / 1) |
| « 5 contre 2 » | 0 | 0 |
| **« 4 contre 3 »** | **43,1 %** (4/3/0 : 36,6 %, 4/2/1 : 6,5 % ; 3/3/1 : 46,5 %) | 0,6 % |
| Première ville inégale | 0 (toujours à 2 pas) | 0 |
| Placements admissibles par plateau | 5,9 (de 1 à 21) | 46,6 |
| Placements de villes différents | **54 sur 1000** | 563 |
| Villes sur les 4 jonctions centrales | 42 % de ces jonctions (au moins une ville au centre partout) | 13,5 % |
| Tempo : villes à ≤ 3 pas | **3,33** | 4,97 |
| Chaîne avec les jonctions | **1,78** ; ≤ 3 dans 100 % (1 : 60 %, 3 : 38 %) | — |
| Chaîne sans les jonctions | 4,33 ; ≤ 3 dans 33 % ; pire 9 | 2,63 (avec le raccourci) |
| distMax : avec / sans les jonctions | 1,28 / 2,00 | 3,41 |
| Écart d'accès, portes : moyenne / pire | 0,69 / 5 (≥ 3 : 3 %) | 0,36 / 1 |
| Écart d'accès, chemins : moyenne / pire | 0,62 / 3 | 1,04 / 5 |
| Moitiés | écart 0 partout | 0 |
| Goulets | 0 % | 5,3 % (avant la préférence) |
| Murs | 1,6 information par plateau ; LC4 posé dans 80 % ; aucun raccord mort hors mur | — |
| Alertes ou informations d'équilibre | aucune | — |
| Compositions de centrales | 35 ; 985 plateaux distincts ; 109 profils | 288 |
| Montable avec la boîte | **100 %**, par construction des quotas | 95,3 % |
| Stock minimal pour 90 % | le stock B3 entier (12 centrales), sans marge | — |

**Composition par plateau :**

| Modèle | Exemplaires posés |
|---|---|
| LC1 | 1 ou 2 |
| LC2 | 0 ou 1 |
| LC3 | 2 ou 3 |
| LC4 | 0 ou 1 (80 %) |
| LC5 | 1 ou 2 |
| LC6 | 0 ou 1 |
| LC7 | 1 ou 2 |

**Sensibilité par modèle.** C'est l'effet de remplacer une centrale moyenne par un exemplaire du modèle (régression au générateur).

| Modèle | Effet |
|---|---|
| **LC4** | admissibles + 4,1 ; cases faibles − 1,0 |
| **LC5** | S + 0,36 ; chaîne − 0,8 |
| LC3, LC6 | admissibles − 1,2 à − 1,4 |
| Les autres | effet faible (± 0,2 sur S) |

**4 contre 3 :** sur 85 plateaux concernés (parmi les 200 premiers), 29, soit 34 %, ont sur les mêmes tuiles un autre placement accepté sans « 4 contre 3 », et de S plus bas (1,48 contre 1,83).

## 3. Pose libre

| Mesure | L5 au poids | B5 boîte | O5 soignée |
|---|---|---|---|
| Montable | 26 % | 100 % | 100 % |
| Alerte « jonction à < 2 ports » (plateau) | **72 %** | 67 % | 16 % |
| Plateaux sans placement admissible | **82,5 %** | 87,7 % | 10,6 % |
| Placements admissibles par plateau | 0,3 | 0,2 | 3,2 |
| Placements à 3 ports qui violent les 3 cases | 99,9 % | 99,9 % | 99,6 % |
| **Tous**, hors blocage : S moyen ; médiane / 90e / **95e** / 99e | 2,54 ; 2 / 4 / **5** / 6 | 2,58 ; 2 / 4 / 5 / 6 | 2,58 ; 2 / 4 / 5 / 6 |
| Tous : S ≥ 4 / ≥ 5 / ≥ 6 / ≥ 7 | 22,6 / **8,5** / 2,6 / 0,7 % | 23,5 / 8,7 / 2,7 / 0,7 % | 23,1 / 8,4 / 2,5 / 0,6 % |
| Tous : « 5 contre 2 » / « 4 contre 3 » | 10,5 / 68,9 % | 10,0 / 69,0 % | 9,2 / 68,4 % |
| Tous : ville inaccessible / écart > 2 / écart = 3 / première inégale | 8,3 / 0,5 / 0,6 / 0 % | 6,8 / 0,4 / 0,6 / 0 % | 6,2 / 0,5 / 0,7 / 0 % |
| Villes à 3 ports : S 95e ; S ≥ 5 / ≥ 6 | 5 ; 6,6 / 1,8 % | 5 ; 6,8 / 1,9 % | 5 ; 8,9 / 2,8 % |
| **Admissibles** : S 95e / 99e ; S ≥ 4 / ≥ 5 / ≥ 6 | 4 / 5 ; 8,5 / 2,4 / 0 % | 4 / 4 ; 10,6 / 0,6 / 0 % | 4 / 5 ; 11,1 / **2,4** / 0,6 % |
| Admissibles : écart > 2 ; « 5 contre 2 » | 0 ; 0 | 0 ; 0 | 0,5 % ; 0 |
| **Taux d'alerte d'équilibre**, tous (seuil S 5 / 6 / 7) | 17,0 / 11,8 / 10,2 % | 15,6 / 10,2 / 8,5 % | 14,8 / 9,4 / 7,8 % |
| Taux d'alerte, villes à 3 ports (5 / 6 / 7) | 7,1 / 2,4 / 1,0 % | 7,0 / 2,1 / 0,7 % | 9,1 / 3,2 / 1,3 % |
| Taux d'alerte, admissibles (5 / 6 / 7) | 2,4 / 0 / 0 % | 0,6 / 0 / 0 % | 2,5 / 0,7 / 0,5 % |
| **Placer les villes** : réussite | 17,1 % | 12,2 % | **88,7 %** |
| Placer les villes : refus | aucun admissible 82,5 % ; aucun équilibré 0,4 % | 87,7 % ; 0,1 % | 10,6 % ; 0,7 % |
| Placer les villes : S ; « 5 contre 2 » ; « 4 contre 3 » | 1,53 (≤ 4) ; 0 ; 70 % | 1,59 ; 0 ; 71 % | 1,45 (≤ 4) ; 0 ; 56 % |
| Placer les villes : alertes d'équilibre | aucune | aucune | aucune |
| Placer les villes : tempo | 3,61 | 3,66 | 3,41 |
| Placer les villes : chaîne (≤ 3) ; sans jonctions | 4,02 (44 %) ; 5,38 | 3,57 (62 %) ; 4,89 | 3,87 (55 %, ≥ 7 : 4 %) ; 5,27 |
| Placer les villes : distMax | 1,73 | 1,61 | 1,78 |
| Placer les villes : cases à ≤ 2 connexions, moyenne / **conformes** | 6,0 % / **10 %** | 5,9 % / 17 % | 3,0 % / **83 %** (pire : 4 cases) |
| Placer les villes : goulets | 1,8 % | 7,4 % | 0,6 % |
| Placer les villes : moitiés inégales | 48 % | 55 % | 63 % (de 1 à 2 cases) |
| Placer les villes : placements différents | 27 | 20 | 46 |

**Sensibilité en pose soignée :** LC4 donne + 1,7 placement admissible, LC5 en donne − 1,3. S en dépend peu (± 0,1).

## 4. 4×4 : la nouvelle définition du rythme (200 plateaux)

| | Nouvelle (G4) | Ancienne (G4A) |
|---|---|---|
| S moyen ; « 5 contre 2 » ; « 4 contre 3 » | 0,55 ; 0 ; 3,5 % | 0,55 ; 0 ; 3,5 % |
| Tempo | 6,17 | 6,22 |
| Chaîne, nouvelle définition | 2,94 | 3,05 |
| Chaîne, ancienne définition | 3,09 | 2,97 |
| distMax, nouvelle définition | 1,01 | 1,03 |
| Écart des portes, moyenne / pire | 0,52 / 1 | 0,46 / 1 |
| Écart de chemins | 0 | 0 |
| Moitiés | égales | égales |
| Montable | 95 % | 96 % |
| Placements de villes | 12 | 12 |
| Goulets | 2,5 % | 2,0 % |
| Plateaux identiques entre les deux | 83 sur 200 | — |

**Constat :**
- Seul le plateau retenu parmi les finalistes change. Rien d'autre ne bouge au-delà du bruit.
- Hors sujet, mais nouveau : **2 à 2,5 % des plateaux 4×4 générés ont un goulet**, contre 0 % avec les jonctions de la rangée centrale (`jonctionsVariees: false`, 200 plateaux). Cela vient des jonctions variées par défaut (`docs/50`) ; la préférence anti-goulets ne joue qu'en 5×5.

## 5. Seuils proposés (5×5)

| Critère | Aujourd'hui | **Proposé** | Justification |
|---|---|---|---|
| **S d'alerte** | ≥ 7 | **≥ 5** | voir la conciliation sous le tableau. Le 7 du `48` venait des passages du catalogue 4.00.0. |
| **S en information** | 5 ou 6 | **S = 4** | 14 % (tous), 9 % (admissibles) |
| Rejet du générateur | S ≥ 5 | **inchangé** | « Placer les villes » et le générateur rendent S ≤ 4 : jamais d'alerte |
| Écart > 2 (alerte) ; > 3 et « 5 contre 2 » (blocage) | — | **inchangés** | 0,5 % ; 9 à 10 % de « 5 contre 2 » en pose libre, 0 en admissible |
| Première ville inégale | alerte | **alerte, inchangée** | 0 % : le coin et le bord à 2 cases mettent la première ville à 2 pas. Reste un filet pour les tuiles de l'utilisateur. |
| « 4 contre 3 » | rien | **rien** (constat ci-dessous) | 43 % au générateur, 56 à 70 % avec l'aide |
| **Cases à ≤ 2 connexions** | information | **rester information** | En alerte : 83 à 90 % des poses au hasard et 17 % des poses soignées. Ce n'est pas un critère d'équité (les deux camps sont touchés) ; le pire mesuré en pose soignée est 4 cases (7 %). Le compteur coloré (`etat: 'ecart'`) suffit. |
| Jonction à < 2 ports ; villes trop proches | alerte | **alerte, inchangée** | Défauts réels. Les villes trop proches touchent 99,6 % des placements faits à l'œil à 3 ports : l'aide est indispensable en 5×5. |

**Conciliation des deux centiles :**
- Sur toutes les configurations non bloquées, le 95e centile vaut **5** dans les trois séries (5 aussi en villes à 3 ports). L'alerte touche 8,4 à 8,9 % des configurations.
- Sur les seules configurations admissibles, le 95e centile vaut **4**. La référence est O5 (3 234 configurations) : les échantillons admissibles de L5 et B5 sont trop petits (295 et 179 configurations, environ 150 plateaux).
  - Une alerte à 4 y toucherait 11,1 %, au-dessus du plafond d'environ 10 % du `48`, celui qui y avait écarté 6 (11,3 %).
  - Une alerte à 4 serait aussi en dessous du rejet du générateur.
- **Les deux populations mènent donc à 5.**
- **Repli : 6.** Il touche 2,6 % de toutes les configurations et 0,6 % des admissibles.
- À 7, l'alerte ne sonnerait presque jamais (0,6 % et 0,1 %).

**Taux d'alerte d'équilibre en pose manuelle, hors « villes trop proches »** (configurations non bloquées : ville inaccessible, écart > 2, première ville, S d'alerte), avec le seuil à 5 :

| Population | Taux |
|---|---|
| Villes posées au hasard | 15 à 17 % (surtout des villes inaccessibles) |
| Villes à 3 ports | 7 à 9 % |
| Admissibles | 0,6 à 2,5 % |
| Avec « Placer les villes » | 0 % |

**L'alerte `villes_proches` domine, et ce tableau ne la compte pas.**
- Elle sonne sur **99,6 à 99,9 %** des placements à 3 ports faits à l'œil, donc sur presque toute pose de villes à la main.
- En 4.00.0 (`48`), elle ne pouvait pas sonner : les tuiles garantissaient l'écart. Les taux ci-dessus ne sont donc pas comparables à ceux du `48`.
- En 5×5 très connecté, la difficulté de la pose manuelle est **le placement des villes**, pas S.

**Conseil 5×5 des 3 villes du milieu** (`graphe.js:53`, ajouté aux alertes `score_s` et « 5 contre 2 » par `conseil5x5Applicable`, `:284`) : **il est périmé.** Mesuré sur les plateaux O5 (`conseil.js`) :
- aucun placement admissible n'a ses 3 villes du milieu sur une même rangée (deux d'entre elles seraient trop proches) ;
- sur l'ensemble des placements, mettre les villes « en 2 + 1 » n'améliore rien : S ≥ 5 dans 8,0 % des cas, contre 3,2 % avec les 3 sur une même rangée.

Avec une alerte à 5, ce conseil s'afficherait plus souvent, et à tort. Il faut le remplacer en 5×5 par « Outils > Placer les villes pose les 7 villes au meilleur placement admissible ».

**Code exact à changer** (rien n'est modifié ici) :
- `src/graphe.js:43-44` :
  - `SEUIL_S_PAR_FORMAT = { '4x4': 5, '5x5': 5 }` ;
  - `SEUIL_S_INFORMATION_PAR_FORMAT = { '4x4': 4, '5x5': 4 }` ;
  - garder les tables : les formats peuvent de nouveau diverger.
- `src/graphe.js:41-42` et `:316` : commentaires (« 5×5 alerte dès 7… ») à mettre à jour, avec la référence à `docs/60`.
- `src/equilibre.js:28-34` (`explicationDe`) : rien à changer, le texte suit les tables.
- **Tests à adapter** (testeur) :
  - `tests/graphe.test.js:222` et `:224` ;
  - `tests/recette-generateur-5x5.test.js:214` ;
  - les assertions d'alerte S en 5×5 de `tests/equilibre.test.js`, `controles.test.js`, `conseil-5x5.test.js`, `generateur-5x5.test.js` et `recette-p2.test.js` (à vérifier ; `tests/testeur-5x5-connecte.test.js` de `b051cae` n'y fait aucune référence directe).
- `src/generateur.js:27` : le commentaire « deux villes à moins de 3 cases (jamais produit) » est faux en 5×5 (6,2 % des essais) ; écrire « rejet ; jamais produit en 4×4 ».
- `src/graphe.js:53` (`CONSEIL_5X5`) : remplacer le texte par le renvoi à « Placer les villes » ; `conseil5x5Applicable` (`:284`) ne s'applique plus à un placement admissible.
- `src/controles.js:116-117` (message `villes_proches`), en 5×5 : ajouter « Outils > Placer les villes pose les 7 villes au meilleur placement admissible ».
- Facultatif (« 4 contre 3 ») : `src/generateur.js:1229`, clé `[chaîne, raccords, articulations, S]`.
  - Ajouter en dernier un terme `max(partage) >= 4 ? 1 : 0`.
  - Gain attendu modeste : un tiers des plateaux concernés ont une alternative, mais la clé ne compare que 6 finalistes. À mesurer avant d'adopter.
- `PART_CONNEXIONS_MAX` (`graphe.js:821`) et `compteursConnexions` (`controles.js:221-228`) : inchangés.

## 6. Constats et recommandations
1. **Le générateur B3 tient tous ses objectifs :**
   - 100 % de plateaux conformes en connexions (1,9 %) ;
   - aucun goulet ;
   - S ≤ 4, aucun « 5 contre 2 » ;
   - chaîne ≤ 3 partout avec la nouvelle définition ;
   - montable à 100 % ;
   - 1,16 s par plateau.
2. **Les coûts du très connecté sont connus et assumés :**
   - tempo 3,33 contre 4,97 ;
   - 5,9 placements admissibles par plateau ;
   - **54 placements de villes différents seulement sur 1000 plateaux** (563 en 4.00.0) : la variété vient des tuiles (985 plateaux distincts), pas des villes ;
   - 35 compositions.
3. **« 4 contre 3 » dans 43 % des plateaux générés** (0,6 % en 4.00.0). Les villes équidistantes sont devenues rares (3/3/1 dans 46 % contre 79 %). Ce n'est pas un critère du jeu, et S reste ≤ 4. À signaler à l'utilisateur ; préférence possible (§ 5).
4. **La pose manuelle n'est jouable qu'avec soin et l'aide :**
   - en tournant les centrales au hasard, 83 à 88 % des plateaux n'ont **aucun** placement admissible, et 67 à 72 % ont une jonction à < 2 ports ;
   - posées à l'œil, les villes violent presque toujours les 3 cases d'écart ;
   - une pose soignée donne 89 % de réussite à « Placer les villes ».

   Recommandation : mettre l'aide en avant en 5×5 (message `villes_proches` ; et le message de refus de `meilleurPlacementVilles`, `generateur.js:1025`, qui conseille déjà de tourner les centrales).
5. **S en pose libre est bien plus faible qu'en 4.00.0** (95e : 5 contre 7 ; S ≥ 5 : 8,4 % contre 22,5 %). On revient donc à **un seuil commun aux deux formats** (alerte 5, information 4), aligné sur le rejet du générateur.
6. **LC4 « Deux ponts » est la centrale qui ouvre le placement des villes :** + 4 placements admissibles par exemplaire et − 1 case faible. LC5 raccourcit la chaîne mais déséquilibre un peu (S + 0,36). S'il faut réimprimer, un 2e LC4 vaudrait d'être mesuré (au prix de 2 murs en plus).
7. **Stock B3 :** il est exactement le minimum pour 90 % (et 100 %) ; aucune marge à retirer.

## Décisions pour l'utilisateur
1. **Seuil S d'alerte en 5×5 : revenir de 7 à 5** (information à S = 4), comme en 4×4 et comme le rejet du générateur ?
   - L'alerte toucherait environ 8 % des poses libres et 2 % des placements admissibles. Avec « Placer les villes », jamais.
   - Le conseil des « 3 villes du milieu » serait à remplacer en même temps (§ 5).
   - **Revient sur la décision 1 du `48`**, justifiée par le catalogue 4.00.0.
   - Repli possible : **alerte à 6** (2,6 % de toutes les poses, 0,6 % des admissibles), information à 4 ou 5.
   - Un document qui garderait les anciennes tuiles 5×5 de la 4.00.0 aurait de nouveau environ 22 % d'alertes S.
2. **Cases à ≤ 2 connexions : rester information** (proposé), ou devenir alerte en pose manuelle ? En alerte, elle sonnerait sur 17 % des poses soignées et sur presque toutes les poses au hasard.
3. **« 4 contre 3 » dans 43 % des plateaux générés :** l'accepter tel quel, ou demander une préférence au générateur (gain modeste, à mesurer) ?
4. **Variété des villes :** 54 placements différents sur 1000 plateaux. Est-ce acceptable, au vu des 985 plateaux distincts ?
5. **4×4, goulets :** 2 à 2,5 % des plateaux générés en ont un depuis les jonctions variées. Faut-il étendre la préférence anti-goulets au 4×4 ? Le coût est faible : elle est déjà calculée pour les finalistes du 5×5.
