# Mesures définitives et seuils des catalogues organiques (advisor design de jeu, Opus 5.5), 2026-10-18

Lecture seule : aucun fichier du dépôt n'a été modifié. Scripts et sorties dans le scratchpad `advisor-mesures-orga/` : `collecte.js`, `lancer.sh`, `rapport.js`, `extras.js`, `correl.js`, `paires4x4.js`, `goulet.js`, `union.js`, et `out/` avec `tableaux.md` et `resume.json`.

## 1. Méthode et graines
Branche `passages`, code livré (catalogue `version` 3, stock de `docs/47`). Il y a 1000 plateaux par série et par format. Le **catalogue précédent** (`PM.catalogue.precedent`, avec ses exemplaires d'alors) passe par **le même générateur actuel**, pas par celui de la 3.04.

Commit mesuré : `21e2e22e8f2c3db8ff0d99c147f366eb7636d409`. Aucun commit sur `src/` pendant la collecte. Les 5 fichiers de `tests/` modifiés ou non suivis dans l'arbre de travail ne viennent pas de cette mission.

**Recoupement avec `docs/35` :** la série « précédent, tuiles du générateur, villes libres » en 5×5 redonne les chiffres du `35` :

| | Cette mesure | `docs/35` |
|---|---|---|
| S moyen | 2,51 | 2,55 |
| 95e centile | 5 | 5 |
| S ≥ 5 | 5,2 % | 5,6 % |
| « 5 contre 2 » | 7,8 % | 6,9 % |

La méthode reproduit donc l'ancienne mesure. Les écarts relevés plus bas viennent du catalogue.

| Série | Contenu | Graine |
|---|---|---|
| **Générateur** | `generer` avec les options par défaut (200 candidats, affinage) | `'a48-<format>-<n>'`, n = 0 à 999, la même pour les deux catalogues |
| **Pose libre** | `tirerTuiles` : tirage au poids, bords et coins tournés vers l'extérieur, centrales tournées au hasard ; ni orientation, ni égalité des moitiés, ni filtre | `mulberry32(20261018 + 7919·n)` |
| **Tuiles du générateur, villes libres** | `tuilesOrientees4x4` / `5x5`, sans villes ni filtre d'équilibre | `mulberry32(30261018 + 7919·n)` |

Pour les deux séries « libres », **tous les placements de villes** sont mesurés : 36 en 4×4, 2016 placements 2-3-2 en 5×5. La chaîne de filtres est celle du générateur : I (ville inaccessible), D (blocage : « 5 contre 2 » ou écart > 3), E (écart > 2), P (première ville inégale), S (S ≥ 5).

Le **rythme** (`GR.rythme`, avec ou sans raccourci) est mesuré sur 6 placements non bloqués par plateau. S'y ajoutent l'accès au centre (`accesCentre`, avec le flot), les cases par moitié, les goulets (`GR.goulets`) et le pourtour (`GR.flancs`, villes traversables).

« Montable » veut dire que chaque modèle est posé au plus autant de fois que ses exemplaires.

Compléments :
- jonctions variées 4×4 : 1000 plateaux, graine `mulberry32(40261018)`, et `generer({ jonctionsVariees: true })` sur `'a48v-<n>'`, n < 200 ;
- goulets du 5×5 : les 53 plateaux concernés, rejoués un par un.

## 2. Tableaux

S est mesuré hors blocages ; les centiles sont pris par rang. « Libre » = pose libre ; « Tuiles gén. » = tuiles du générateur avec villes libres.

### 4×4

| Mesure | Organique, libre | Organique, tuiles gén. | **Organique, générateur** | Précédent, libre | Précédent, générateur |
|---|---|---|---|---|---|
| Cases, moyenne (min–max) | 58,3 (55–62) | 58,4 (54–64) | **58,2 (54–62)** | 63,1 (57–69) | 62,6 (58–68) |
| Écart minimal entre jonctions | 4 | 4 | 4 | 4 | 4 |
| Jonction à < 2 ports | 0,4 % | 0 | 0 | 0,4 % | 0 |
| « 5 contre 2 » / « 4 contre 3 » | 0,5 % / 14,2 % | 0,8 % / 14,6 % | 0 / 11,2 % | 3,8 % / 33,1 % | 0 / 19,0 % |
| Écart max = 2 / > 2 | 8,1 % / 0 | 8,1 % / 0 | 0 / 0 | 5,1 % / 0 | 0 / 0 |
| S moyen ; médiane / 90e / **95e** / 99e | 1,75 ; 2 / 3 / **4** / 5 | 1,74 ; 2 / 3 / 4 / 4 | 0,50 (S = 0 : 50 %, 1 : 50 %) | 2,18 ; 2 / 4 / 4 / 5 | 0,62 (0 / 1) |
| S = 4 / ≥ 5 / ≥ 6 | 5,3 / **1,0** / 0,1 % | 5,2 / 1,0 / 0,1 % | — | 10,7 / 3,0 / 0,4 % | — |
| Meilleur S atteignable : 0 / 1 / 2 | 84 / 15 / 1 % | 84 / 15 / 1 % | — | 55 / 32 / 10 % (et jusqu'à 4) | — |
| Placements qui passent tout, sur 36 | 35,4 | 35,3 | 35,6 | 33,6 | 35,0 |
| Tempo : villes à ≤ 3 pas | 6,15 | 6,18 | 5,99 | 5,63 | 5,55 |
| Pourtour plus court que le centre (pas) | 99,9 % (3,0 / 4,7) | 100 % | 100 % (3,0 / 4,7) | 100 % | 99,9 % |
| Chemins disjoints min = 1 ; articulation | 1,5 % ; 1,5 % | 1,3 % | **0 ; 0** | 0,3 % | 0 |
| Raccords morts (moyenne) | 0 | 0 | 0 | 0,57 | 0,75 |
| **Chaîne** : moyenne / pire / ≤ 3 | 3,87 / 7 / 43 % | 3,83 / 7 / 42 % | **2,98 / 3 / 100 %** | 5,76 / 9 / 0 % | 4,74 / 6 / 0 % |
| Chaîne sans raccourci : moyenne / ≤ 3 | 5,05 / 3 % | 4,92 / 2 % | 4,87 / **1,6 %** | 6,12 / 0 | 6,30 / 0 |
| distMax : moyenne / pire | 2,20 / 3 | 2,18 / 4 | 2,02 / 3 | 2,67 / 4 | 2,79 / 4 |
| Écart des portes : abs. moyen / pire / ≤ 1 | 0,63 / 2 / 92 % | 0,66 / 2 / 95 % | 0,53 / 1 / 100 % | 0,56 / 2 / 95 % | 0,14 / 1 / 100 % |
| Écart de chemins indépendants : abs. moyen / pire | 0,03 / 1 | 0 / 0 | 0 / 0 | 0,02 / 1 | 0 / 0 |
| Cases par moitié : écart abs. moyen / pire | 1,36 / 5 | 0 | 0 | 1,77 / 7 | 0 |
| **Montable avec la boîte** | 96,1 % | 94,6 % | **97,5 %** | 9,5 % | 12,1 % |

**Générateur 4×4 :**
- Rejets : **0 sur 200 000 essais** (précédent : 56, surtout « première ville ») ; les filtres ne mordent jamais, seul le tri sur S agit.
- Écart par rang ≤ 1 à tous les rangs.
- Partage : 3/3/1 dans 88,8 % des plateaux, 4/3 dans 11,2 %.
- Diversité :
  - 980 plateaux distincts sur 1000, 34 compositions, 29 profils de distances ;
  - **3 placements de villes seulement** : les jonctions-cases sont toujours prises sur la rangée centrale.
- Sensibilité par exemplaire posé (pose libre) :
  - Q1 : S + 0,20 et chaîne − 0,24 ;
  - Q2 : S − 0,20 et chaîne + 0,24 ;
  - B8 : S + 0,14 ;
  - le reste est négligeable.

### 5×5

| Mesure | Organique, libre | Organique, tuiles gén. | **Organique, générateur** | Précédent, libre | Précédent, générateur |
|---|---|---|---|---|---|
| Cases, moyenne (min–max) | 80,9 (75–86) | 80,1 (78–81) | **80,3 (78–81)** | 76,7 (73–80) | 78 |
| Écart minimal entre jonctions | 4 | 4 | 4 | 4 | 4 |
| Jonction à < 2 ports | 85 % | 0 | 0 | 99,4 % | 0 |
| Jonctions à ≥ 3 ports (moyenne) | 9,5 | 10,1 | 10,3 | 7,8 | 8,0 |
| Ville inaccessible (configurations) | 6,0 % | 0,6 % | 0 | 17,9 % | 0 |
| « 5 contre 2 » / « 4 contre 3 » | **6,7 %** / 48,8 % | 5,9 % / 43,0 % | 0 / 0,6 % | 6,6 % / 58,0 % | 0 / 0 |
| Écart max = 2 / **= 3** | 31,5 % / **5,7 %** | 31,2 % / 6,6 % | 0 / 0 | 16,2 % / 0 | 0 / 0 |
| S moyen ; médiane / 90e / **95e** / 99e | 3,35 ; 3 / 6 / **7** / 8 | 3,29 ; 3 / 6 / 7 / 9 | 0,53 (0 / 1) | 2,80 ; 3 / 5 / 5 / 6 | 0,48 (0 / 1) |
| S = 4 / ≥ 5 / ≥ 6 / ≥ 7 / ≥ 8 | 18,7 / **22,5** / 11,3 / **5,4** / 2,4 % | 17,0 / 22,3 / 11,9 / 6,0 / 2,8 % | — | 18,8 / 10,1 / 2,4 / 0,4 / 0 % | — |
| S des placements admissibles (≥ 3 ports) : moyenne / 95e / ≥ 5 | 2,93 / 6 / 14,9 % | 2,95 / 6 / 17,0 % | — | 2,11 / 4 / 1,1 % | — |
| Meilleur S atteignable : 0 / 1 / 2 | 85 / 13 / 2 % | 86 / 12 / 2 % | — | 96 / 4 / 0 % | — |
| Placements admissibles par plateau (aucun) | 32,5 (17 %) | 40,8 (0) | **46,6 (3–90)** | 4,8 (48 %) | **3,8 (1–4)** |
| Tempo : villes à ≤ 3 pas | 4,27 | 4,46 | **4,97** | 3,87 | 4,53 |
| Pourtour plus court que le centre (pas) | 79 % (4,0 / 6,5) | 72 % | **68 % (4,0 / 5,5)** | 99 % | 100 % (4,1 / 5,0) |
| Chemins disjoints min = 1 ; articulation | 49 % ; 49 % | 22 % ; 22 % | **5,3 % ; 5,3 %** | 62 % | 0 ; 0 |
| **Chaîne** : moyenne / pire / ≤ 3 | 4,00 / 12 / 52 % | 3,69 / 10 / 60 % | **2,63 / 3 / 100 %** | 6,33 / 7 / 0 % | 5,83 / 7 / 0 % |
| Chaîne ≥ 6 / ≥ 7 / ≥ 8 | 9,9 / 5,8 / 0,9 % | 3,9 / 1,6 / 0,2 % | 0 | 94 / 39 / 0 % | — |
| Chaîne sans raccourci : moyenne / ≤ 3 | 4,78 / 22 % | 4,21 / 35 % | 3,43 / 64 % | 7,92 / 0 | 8,19 / 0 |
| distMax : moyenne / pire ; ≥ 5 | 3,58 / 10 ; 6,7 % | 3,42 / 10 ; 2,3 % | 3,41 / **6** ; 3,2 % | 3,13 / 4 ; 0 | 3,00 / 3 ; 0 |
| Écart des portes : abs. moyen / pire / ≤ 1 ; ≥ 4 | 1,92 / 8 / 47 % ; 16 % | 1,41 / 7 / 59 % ; 5 % | 0,36 / 1 / 100 % | 1,19 / 5 / 67 % | 0,22 / 1 / 100 % |
| Écart de chemins indépendants : abs. moyen / pire ; ≥ 3 | 1,06 / 4 ; 7,7 % | 1,05 / 4 ; 5,5 % | 1,04 / **5** ; 5,9 % | 0,68 / 2 | 0,64 / 2 |
| Cases par moitié : écart abs. / pire | 1,40 / 6 | 0 | 0 | 1,13 / 4 | 0 |
| **Montable avec la boîte** | 73,0 % | 92,5 % | **95,3 %** | 46 % | 65,8 % |

**Générateur 5×5 :**
- Rejets, sur 205 165 essais :
  - ecart 0,82 %, score_s 0,79 %, desequilibre 0,70 % ;
  - connexite 0,09 %, ville_inaccessible 0,07 %, villes_ports 0,05 % ;
  - aucun rejet jonction_ports ni cases_moities.
- Écart par rang ≤ 1.
- Partage :
  - 3/3/1 dans 78,6 % des plateaux, 2/2/3 dans 9,6 %, 3/2/2 ou 2/3/2 dans 11,2 % ;
  - 4/2/1 dans 0,6 %.
- Diversité : 1000 plateaux distincts, **288 compositions**, **103 profils** et **563 placements de villes**, contre 37, 29 et 419 pour le précédent.
- Villes au centre (4 jonctions centrales) : **13,5 %**, contre 7,1 % au `35` et une cible de 20 % au `38`. Villes sur les colonnes 1 et 4 : 57 %, contre 70 %.
- B1 sur la rangée neutre :
  - 2 B1 dans 72,4 % des plateaux, 1 dans 27 %, 0 dans 0,6 % ;
  - S, accès et chaîne identiques entre 1 et 2 B1 ;
  - avec 0 B1 (6 plateaux) : aucun n'est montable, et 1 sur 6 a un goulet.
- Montable selon les cases : 78 cases 73 %, 79 cases 92 %, 80 et 81 cases 97 %.
- Sensibilité :
  - P3 : S − 0,15 à − 0,22 et chaîne − 0,2 par exemplaire ;
  - P5 et P1 : S + 0,1 ;
  - P3 est aussi surreprésenté dans les plateaux à goulet (2,28 contre 1,80).
- Temps : environ 1,1 s par plateau seul, 4,7 s sous charge, 14 processus.

## 3. Constats
1. **La refonte tient ses promesses au générateur.**
   - Chaîne ≤ 3 dans 100 % des plateaux, contre 0 % au précédent.
   - Tempo plus rapide : 4,97 villes à ≤ 3 pas en 5×5, contre 4,53.
   - Les centrales comptent en 5×5 : pourtour plus court que le centre dans 68 % des plateaux, contre 100 %.
   - 12 fois plus de placements admissibles en 5×5.
   - Plateaux montables : 97,5 % et 95,3 %.
   - Cases égales entre moitiés.
   - S toujours 0 ou 1, « 5 contre 2 » à 0.
2. **La pose libre du 5×5 est nettement moins équilibrée qu'avant.**
   - S ≥ 5 : 22,5 %, contre 10,1 %.
   - 95e centile : 7, contre 5.
   - Un écart de 3 pas à un rang (alerte) : 5,7 %, contre 0 %.
   - « 5 contre 2 » : inchangé (6,7 %).
   - Cause : les passages mettent des cases à 1 pas et rendent les distances plus inégales. Ce n'est pas l'orientation, puisque les tuiles du générateur donnent les mêmes chiffres.
   - Le 4×4 libre, lui, s'améliore : S ≥ 5 à 1,0 % contre 3,0 %, « 5 contre 2 » à 0,5 % contre 3,8 %.
3. **Goulets 5×5 (nouveau) :**
   - **5,3 % des plateaux générés** ont un point d'articulation ; il coupait 1 ville d'un joueur, 0 % au précédent ;
   - la case qui fait goulet est surtout une case d'U1 ou de B1 (apparition comprise) ;
   - **82 % des goulets coupent une ville du milieu**, donc disputée (190 sur 232 relevés) ; seuls 12 % coupent une ville du camp adverse depuis ce camp (29 sur 232), ce qui serait une simple défense ; il s'agit donc d'un vrai défaut ;
   - en pose libre : 49 %.
4. **L'écart d'accès ne prédit pas l'équilibre.**
   - Écart des portes de 0 à 5 et plus : S moyen et « 5 contre 2 » plats, en 5×5 libre comme en tuiles du générateur.
   - Écart de chemins ≥ 3, tuiles du générateur (5,5 %) : S ≥ 5 dans 42 % contre 21 %, « 5 contre 2 » 12,8 % contre 4 à 5 %. C'est un effet réel mais rare.
   - Au générateur, aucun effet : S de 0,52 à 0,54 quel que soit l'écart de chemins.

## 4. Seuils
| Critère | 4×4 | 5×5 | Justification (pose libre) |
|---|---|---|---|
| « 5 contre 2 » | blocage (inchangé) | blocage (inchangé) | 0,5 % / 6,7 % ; 0 au générateur |
| Écart > 3 | blocage (inchangé) | blocage (inchangé) | quasi nul |
| Écart > 2 | alerte (inchangé) | alerte (inchangé) | 0 % / 5,7 %, autour du 95e centile |
| **S d'alerte** (95e centile hors blocage) | **S ≥ 5, inchangé** (95e = 4 ; touche 1,0 %) | **S ≥ 7, nouveau** (95e = 7 ; touche 5,4 %, 6,0 % en tuiles du générateur) | à 5, l'alerte toucherait 22,5 % des poses en 5×5 ; à 6, 11,3 %, toujours plus de 10 % : la règle du `28` mène à 7 |
| S en information | S = 4 | **S = 5 ou 6** (17,1 % ; 16,3 % en tuiles du générateur) | |
| Rejet S du générateur | aucun (classement) | **S ≥ 5, gardé** (0,8 % des essais) | un plateau généré reste à S ≤ 1, donc sans alerte ni information |
| Première ville inégale ; jonction à < 2 ports | alerte (inchangé) | alerte (inchangé) | filets |
| « 4 contre 3 » ; ville à < 3 ports | rien ; — | rien ; information | |
| **Rythme** | **information** | **information** | voir ci-dessous |
| **Écart d'accès** (portes et chemins) | **information** | **information** | sans effet sur S ni sur « 5 contre 2 » |

**Taux d'alerte total en pose manuelle 5×5** (configurations non bloquées ayant au moins une alerte : ville inaccessible, écart > 2, première ville inégale ou S d'alerte) :

| Seuil S d'alerte | Pose libre | Tuiles du générateur |
|---|---|---|
| 5 (seuil actuel) | 28,1 % | 23,4 % |
| 6 | 18,6 % | 14,1 % |
| **7** | **14,4 %** (dont 6,4 % de villes inaccessibles) | **9,8 %** |

En 4×4, le taux reste à 1,0 %.

**Rythme et écart d'accès restent en information en pose manuelle.**
- Ce ne sont pas des critères d'équité : la chaîne et distMax pèsent sur les deux joueurs à la fois.
- Une alerte « chaîne > 3 » sonnerait sur 57 % des poses libres 4×4 et 48 % des 5×5.
- Même un seuil large, « chaîne ≥ 7 », sonnerait sur 39 à 41 % des plateaux faits avec le catalogue précédent, encore ouverts dans d'anciens documents.
- **Proposé, en information seulement :** ajouter « bien au-dessus de la cible » quand la chaîne vaut 7 ou plus (4×4 0,1 % ; 5×5 5,8 %) ou distMax 6 ou plus (5×5 5,3 %).

**Code exact à changer** (rien n'est modifié ici) :
- `src/graphe.js:35-36` : remplacer `SEUIL_S = 5` et `SEUIL_S_INFORMATION = 4` par
  `var SEUIL_S_PAR_FORMAT = { '4x4': 5, '5x5': 7 }; var SEUIL_S_INFORMATION_PAR_FORMAT = { '4x4': 4, '5x5': 5 };`
  - garder `var SEUIL_S = 5;`, rebaptisé « seuil de rejet du générateur » ;
  - exporter les deux tables et une fonction `seuilS(formatId)`, lignes 798-799.
- `src/graphe.js:414-415` et `:439` :
  - utiliser `var sAlerte = SEUIL_S_PAR_FORMAT[F.id]`, et l'équivalent pour l'information, à la place de `SEUIL_S` et `SEUIL_S_INFORMATION` ;
  - le conseil 5×5 reste joint à l'alerte ;
  - le commentaire de la ligne 308 est à mettre à jour.
- `src/equilibre.js:26` et `:223` : afficher le seuil du format du document, et non `GR.SEUIL_S`.
- `src/generateur.js:233` : inchangé, `m.S >= GR.SEUIL_S`, donc 5 ; mettre à jour le commentaire de la ligne 218.
- `src/equilibre.js:53-54` (information) : ajouter « bien au-dessus de la cible » si `chaineMax >= 2 * GR.CHAINE_CIBLE + 1` ou `distMax >= 6`.
- Les tests de l'alerte S en 5×5 seront à adapter (testeur).

## 5. Points ouverts du `46`
1. **Rythme avec le raccourci compté comme zone :**
   - la mesure reste assez sévère en 5×5 : sans le raccourci, 64 % des plateaux générés seraient déjà ≤ 3 ;
   - elle est indulgente en 4×4 : sans le raccourci, seulement 1,6 % ≤ 3 et une moyenne de 4,87. C'est précisément l'effet de la décision 3 de l'utilisateur.
   - Recommandation :
     - garder la mesure officielle ;
     - garder la chaîne sans raccourci et distMax comme mesures de contrôle dans les outils ;
     - ne pas changer `CHAINE_CIBLE`.
2. **5×5 : écart de chemins indépendants jusqu'à 5, distMax jusqu'à 6** (mesuré : écart ≥ 3 dans 5,9 %, distMax ≥ 5 dans 3,2 %) :
   - aucun effet mesuré sur S, le partage, la chaîne ni le tempo des plateaux générés : **accepter** ;
   - option peu coûteuse, à faire après le reste : ajouter |écart de chemins| comme 4e terme de la clé des finalistes (`generateur.js`, clé de `finalistes`, ligne 1093), seulement sur les 6 finalistes.
3. **« Jonctions variées » restreint en 4×4 : confirmer.**

   | Paires de jonctions-cases | « 5 contre 2 » | S ≥ 5 | S moyen |
   |---|---|---|---|
   | Les 24 paires exclues | 0,9 % | 1,2 % | 2,05 |
   | Les 9 paires « variées » de plus | 0 % | 0 % | 1,07 |
   | Les 3 paires par défaut | 0 % | 0 % | 0,86 |

   Avec `generer` en « jonctions variées » : 200 plateaux sur 200, S moyen 0,58, chaîne ≤ 3 à 100 %, écart des portes 0,43.
   - L'option ne coûte rien. Elle donne 12 placements de villes, contre **3 seulement par défaut**, sur les 1000 plateaux générés.
   - Voir la décision 3 plus bas.
4. **B1 sur la rangée neutre en simple préférence : garder.**
   - Tenue à 72 % avec 2 B1, 27 % avec 1, sans effet entre 1 et 2 B1.
   - Les 0,6 % sans B1 neutre sont les seuls problématiques : non montables, plus de goulets. Option : en faire un rejet doux, inutile vu leur rareté.

## 6. Recommandations
1. Adopter les seuils du § 4 : **S d'alerte à 7 en 5×5**, 5 en 4×4, et rejet du générateur à 5.
2. **Goulets 5×5** : préférence anti-articulation dans le générateur.
   - Où : départager les 6 finalistes, puis ajouter un terme `goulets` à `penaliteDe` (`generateur.js:483-490`), calculé seulement sur les finalistes pour le temps.
   - But : revenir de 5,3 % à environ 0 %, comme le catalogue précédent.
3. Garder le rythme et l'accès en information ; renforcer le texte au-delà de 6.
4. Villes au centre 5×5 : 13,5 %, toujours sous la cible de 20 % du `38`. Rien à coder, constat pour les « régions thématiques ».
5. **Points du `28` § 6 non mesurés ici** :
   - point 5 : S selon la jonction de la 7e ville (seule la répartition des villes est donnée) ;
   - point 8 : distance entre apparitions verte et rouge par la rangée neutre.
   - Le conseil 5×5 des 3 villes du milieu (`36`, point 5) n'a pas été remesuré sur le catalogue organique. À vérifier par le sous-agent des mesures avant de le garder tel quel.
6. Régénérer `docs/croquis/organique/mesures.json` et `centrales-ouvertes-200.json`, périmés.

## Décisions pour l'utilisateur
1. **5×5 : alerte S à partir de 7** au lieu de 5, avec S = 5 ou 6 en simple information ?
   - **Cela revient sur le `36`** : points 1 et 7, « une constante S = 5 partagée » et « mêmes seuils dans les deux formats ». Le seuil deviendrait propre à chaque format ; le 4×4 reste à 5 et le générateur rejette toujours S ≥ 5.
   - Le plateau organique posé à la main est plus inégal : S ≥ 5 toucherait une pose sur cinq.
   - Même à 7, environ **une pose manuelle sur dix** (9,8 à 14,4 %) aura une alerte, à cause de l'écart > 2 et des villes inaccessibles.
   - Les plateaux générés restent à S ≤ 1.
2. **Goulets 5×5 :** environ 5 % des plateaux générés ont une case qui, prise, coupe une ville d'un joueur. Dans 82 % des cas, cette ville est au milieu, donc disputée. Faut-il que le générateur les évite (préférence) ?
3. **4×4 : « jonctions variées » par défaut ?** Aujourd'hui, les villes sont toujours au même endroit, avec 3 placements possibles. Les jonctions variées donnent 12 placements, sans perte d'équilibre mesurable (S 0,58 contre 0,50).
4. Rythme et accès au centre restent des **informations**, jamais des alertes : à confirmer.
