# Avis design de jeu : 8 villes en 5×5 (advisor, Opus 5.5), 2026-10-18

Lecture seule : aucun fichier du dépôt n'a été modifié. Code mesuré : la copie figée de `connexions-5x5` au commit `d6cf77a` (code de `b1bf0a0` ; le seuil d'alerte S du 5×5 y vaut encore 7, j'applique le 5 décidé). Scripts et sorties dans le scratchpad `advisor-8villes/` :
- `v8/src/` : copie figée avec des réglages en mémoire, par variables d'environnement (`NBV` nombre de villes, `REP` répartition, `C5` seuil de majorité, `ESM` garde-fou d'abandon, `DAMIERS`, `ABANDON0`, `SYM`) et un correctif indispensable (`generateur.js:151`, voir § 4) ;
- `collecte8.js`, `rapport8.js`, `tous8.js`, `voisines.js` ; sorties `out/` (`resume.txt`, `tous.txt`, `voisines.txt`, JSON par série).

| Série | Contenu | Plateaux |
|---|---|---|
| G7 | référence : vrai générateur à 7 villes (copie figée) | 500 |
| G8 | générateur adapté à 8 villes, sinon inchangé (12 870 placements, garde-fou 25) | 500 |
| G8R | idem, garde-fou porté à 1000 | 500 |
| GD | générateur restreint aux 2 damiers (accélération), abandon seulement sans aucun candidat (garde-fou 200) | 500 |
| GDR / GDP | GD + rejet / préférence du partage asymétrique | 200 + 200 |
| B8 | pose « boîte » (9 centrales sur 12), rotations au hasard | 500 |
| O8 | B8 puis rotations soignées (recherche locale, jusqu'à 12 reprises) visant un damier | 500 |
| T8 | 200 plateaux O8 : les 12 870 poses de 8 villes, mesurées une à une | 2,6 M poses |

## 1. Faisabilité

**Avec le catalogue B3, seuls deux placements de 8 villes ont été observés, les deux damiers** (constat empirique, non démontré) :
- **pair** (i + j pair) : (1,1) (3,1) (2,2) (4,2) (1,3) (3,3) (2,4) (4,4) ;
- **impair** : (2,1) (4,1) (1,2) (3,2) (2,3) (4,3) (1,4) (3,4).

Mesuré :
- **aucun placement admissible hors damier** dans les séries sans biais vers les damiers, où tous les ensembles de chaque plateau sont testés :
  - G8, G8R et G8C5 : environ 1 300 plateaux réussis, où le générateur tirait au hasard parmi les 12 870 ensembles de 8 jonctions ;
  - G7 : 500 plateaux à 7 villes ;
  - B8 : 500 poses « boîte ».

  O8 n'apporte pas de preuve : sa recherche vise les damiers.
- par plateau, **1 placement admissible** (2 dans 0,2 à 0,6 % des cas), contre 5,9 à 7 villes.

**Ce qui est démontré, et ce qui ne l'est pas :**
- **Démontré, pour l'anneau seulement.** Les 12 jonctions du pourtour forment un anneau où deux voisines sont toujours à 2 pas : la porteuse de chaque bord dessert ses deux jonctions intérieures. L'anneau prend donc au plus 6 villes, et les rangées 1 et 4 au plus 2 chacune.
- **Pas démontré au milieu.** Deux jonctions voisines du milieu sont à 4 pas ou plus dans 22 % des cas (`voisines.txt`). La règle « jamais deux voisines » n'y tient donc pas a priori.
  - Sans la règle des 3 ports, des ensembles hors damier existent : jusqu'à 24 par plateau en pose au hasard, sur des jonctions faibles.
  - Avec la règle des 3 ports, on n'en a observé aucun.
  - Si deux voisines ne sont jamais villes ensemble, une grille de 4 × 4 jonctions n'admet que les 2 damiers.
- **Avec des tuiles de l'utilisateur, d'autres placements peuvent devenir admissibles.**

**Répartition :**
- **« 2-2-2-2 » remplace « 2-3-2 »** : 2 villes par rangée de jonctions ; avec le catalogue B3, il n'y a pas d'autre choix.
- Variété des placements : **2** sur 500 plateaux, contre 50 à 7 villes (54 dans `60`). La variété ne vient plus que des tuiles : 492 à 496 plateaux distincts sur 500.

**Rangée neutre et « 4 par camp » :**
- La rangée neutre du 5×5 est une rangée de **tuiles** (lig = 2). Aucune jonction n'est dessus : les jonctions j = 1 et 2 sont au nord (vert), j = 3 et 4 au sud (rouge).
- « 4 par camp » se définit donc sans ambiguïté : **4 villes en j ≤ 2 et 4 en j ≥ 3**. Les deux damiers le respectent toujours. Chaque camp a 2 villes en rangée 1 (ou 4), 1 sur un flanc et **1 sur une jonction du milieu**.
- Chaque damier est **invariant par le demi-tour** qui échange les camps : le jeu est symétrique par construction. Le miroir nord-sud, lui, change un damier en l'autre.
- En distance, les villes de son camp sont presque toujours plus proches : chaque joueur a 3 villes à 2 pas, 1 à 3 pas, puis celles d'en face à 4 à 6 pas.

## 2. Définitions proposées
On note N le nombre de villes du format : **N = 7 en 4×4, 8 en 5×5** (une table par format, comme les seuils S).

| Critère | 4×4 (inchangé) | **5×5, 8 villes** |
|---|---|---|
| Rangs comparés | 1 à 7 | **1 à 8** |
| S | Σ des écarts sur 7 rangs | **Σ sur 8 rangs** ; alerte **≥ 5**, information **4** (inchangés) |
| Écart par rang | alerte > 2, blocage > 3 | idem, rangs 1 à 8 |
| Majorité bloquante | « 5 contre 2 » (≥ N − 2) | **« 6 contre 2 »** (≥ N − 2) |
| Majorité en alerte | aucune (« 4 contre 3 » : rien) | **« 5 contre 3 »** |
| Partage symétrique | sans objet | **p₁ = p₂** (4/4/0 ou 3/3/2, villes à égalité comprises) ; « 4 contre 4 » = 4/4/0. Un partage non symétrique (4/3/1) : **information** dans l'éditeur, **rejet** au générateur |
| Villes par moitié | sans objet | information si ce n'est pas 4 / 4 (j ≤ 2 / j ≥ 3) |
| Première ville | même distance (invariant d) | inchangé (toujours 2 pas mesurés) |
| Rejet S ≥ 5 au générateur | — | inchangé (ne joue jamais : S ≤ 4) |

**Justification des seuils** (T8, poses à la main sur plateaux soignés) :

| Population | Comparaison à 7 villes (`60`) | S ≥ 5 | S, 95e centile | « 5 contre 3 » | « 6 contre 2 » | Partage symétrique |
|---|---|---|---|---|---|---|
| Poses « 2-2-2-2 » | « 2-3-2 » : 8,4 % de S ≥ 5, 95e = 5 | **9,1 %** | **5** | 3,0 % | 0 % | 54 % |
| Poses « 4 par moitié » | — | 18,2 % | 6 | 3,2 % | 0,1 % | 54 % |
| Poses quelconques | — | 43 % | 9 | 36 % | 8,2 % | 24 % |
| Damiers admissibles (O8) | — | 0 % | 2 | 0 | 0 | 61 % |

- **Portée de ce calibrage.** Comme dans `60`, les populations sont des poses à la main. Presque toutes déclenchent déjà « villes trop proches » (seuls les damiers y échappent). Les damiers admissibles n'atteignent jamais S = 5 et n'ont aucune majorité. Les seuils S, « 5 contre 3 » et « 6 contre 2 » ne joueront donc qu'avec des tuiles de l'utilisateur ou des poses fautives. **Les 9 % ne sont pas un taux d'alerte réel.**
- **S sur 8 rangs avec une alerte à 5** retrouve le taux du 7 villes (environ 9 %). S sur les rangs 1 à 7 seulement ignorerait la moitié des écarts du damier (rangs 7 et 8) : je l'écarte.
- « 6 contre 2 » est l'analogue exact de « 5 contre 2 » (N − 2), et il est quasi absent des poses structurées. « 5 contre 3 » (écart de 2) n'existe pas à 7 villes : une alerte suffit.

## 3. Mesures

**Générateur 5×5**

| | G7 (réf.) | G8 | G8R | **GD** | **GDR** |
|---|---|---|---|---|---|
| Réussite | 100 % | **63,8 %** | 100 % | 100 % | 100 % |
| Temps par plateau, seul | 1,24 s | arrêt précoce | 2,24 s | non mesuré seul | **0,73 s** ; **1,05 s** en « 2-2-2-2 » générique (1 296 placements, 20 plateaux, réussite 100 %, damiers seulement) |
| Rejets, en part des essais | ports 39 %, proches 6 % | ports 95 % | ports 96 % | ports 61 %, proches 34 % | + partage 1,9 % |
| Placements différents | 50 | 2 | 2 | 2 | 2 |
| S : moyenne (maximum) | 1,38 (4) | 0,49 (4) | 0,20 (4) | 0,23 (4) | **0,10 (2)** |
| Partage 4/4/0 ; 3/3/2 ; 4/3/1 | — | 72 ; 6 ; 23 % | 82 ; 10 ; 8 % | 80 ; 10 ; 10 % | **89 ; 11 ; 0 %** |
| « 5 contre 3 » / « 6 contre 2 » | — | 0 | 0 | 0 | 0 |
| Tempo : villes à ≤ 3 pas | 3,33 | 4,00 | 4,00 | 4,00 | 4,00 |
| Distances par rang | 2 2 2,4 3,6 4 4,4 5,5 | 2 2 2 3 4 4 4,9 5,8 | idem | idem | idem |
| Cases | 57,3 | 56,7 | 56,4 | 56,4 | 56,5 (56 ou 57) |
| Cases à ≤ 2 connexions | 1,9 % | 1,1 % | 0,8 % | 1,0 % | 0,9 % (100 % conformes partout) |
| Chaîne du rythme (≤ 3) | 1,75 (100 %) | 3,34 (81 %) | 2,30 (100 %) | 2,19 (100 %) | 2,34 (100 %) |
| distMax | 1,30 | 1,87 | 1,58 | 1,51 | 1,59 |
| Goulets ; alertes | 0 ; aucune | 0 ; aucune | 0 ; aucune | 0 ; aucune | 0 ; aucune |

- **G8 échoue sur 36 % des plateaux.** Le garde-fou (`ECHECS_STRUCTURELS_MAX = 25` essais rejetés de suite pour manque de ports) se déclenche, car 95 % des essais sont rejetés pour cette cause. Il arrête aussi la génération après quelques candidats seulement, et le résultat s'en ressent : chaîne 3,34 au lieu de 2,3, S 0,49 au lieu de 0,2.
- **GD** se limite aux 2 damiers et n'abandonne que si aucun candidat n'est encore trouvé. Il est **plus rapide que le 7 villes**.
- **GDR** (rejet du partage non symétrique) coûte 1,9 % des essais et donne **100 % de partages symétriques**.
- **GDP** (préférence au lieu du rejet) n'en donne que 94 %.
- Une série G8C5, avec « 5 contre 3 » bloquant, est identique à G8R : cette majorité ne se présente jamais.
- Sur les plateaux du générateur à 7 villes (G7), un damier est admissible dans **38 %** des cas.

**Pose libre et « Placer les villes »**

| | B8 (rotations au hasard) | **O8 (pose soignée)** | O5 à 7 villes (`60`) |
|---|---|---|---|
| Jonction à < 2 ports | 66 % | 0 % | 16 % |
| Plateaux avec un placement admissible | **0,2 %** | **70,6 %** | 89 % |
| Placer les villes : réussite | 0,2 % | 70,6 % | 88,7 % |
| Placer les villes : S ; alertes | — | 0,89 (≤ 4) ; aucune | 1,45 ; aucune |
| Placer les villes : partage symétrique / 4/3/1 | — | 61 % / 39 % | — |
| Placer les villes : tempo ; chaîne (≤ 3) | — | 4,0 ; 3,71 (61 %) | 3,41 ; 3,87 (55 %) |
| Placer les villes : cases ; ≤ 2 connexions ; conformes | — | 56,6 ; 3,2 % ; 84 % | — ; 3,0 % ; 83 % |
| Placer les villes : goulets ; placements différents | — | 0,8 % ; 2 | 0,6 % ; 46 |

**Temps de « Placer les villes » :** 12 à 15 ms (12 870 ensembles) ; ce serait négligeable avec 2 damiers.

**En pose manuelle, toute ville posée hors damier déclenche « villes trop proches »** : l'aide et le conseil du damier deviennent indispensables.

## 4. Code à changer (lignes de la copie figée)

**`src/graphe.js`**
- `:35` : remplacer `NB_VILLES = 7` par une table `NB_VILLES_PAR_FORMAT = { '4x4': 7, '5x5': 8 }` et une fonction `nbVilles(formatId)` (à exporter `:861`).
  - **Piège** : le générateur 4×4 tire ses villes avec `NB_VILLES` (`generateur.js:54`, `:197`). Une valeur globale de 8 casserait le 4×4.
- `:38` : `SEUIL_CINQ_CONTRE_DEUX` devient des seuils par format :
  - majorité bloquante `{ '4x4': 5, '5x5': 6 }` ;
  - majorité d'alerte `{ '5x5': 5 }`.
- `:47-52` : `REPARTITION_VILLES_5X5` passe à 4 groupes de 2 (« 2-2-2-2 », 1 296 placements).
  - **Garder une énumération générique** dans `placementsAdmissibles`, `meilleurPlacementVilles` et le générateur, pour ne pas exclure des placements que les tuiles de l'utilisateur rendraient admissibles.
  - 1,05 s par plateau, et 12 à 15 ms pour l'aide même sur les 12 870 ensembles.
  - Une liste réduite aux 2 damiers (0,73 s) ne serait qu'une accélération facultative du générateur, avec repli générique.
  - « 4 par moitié » (4 900 placements) est l'autre lecture possible de « 4 par camp ». Avec le catalogue B3, elle donne les mêmes placements.
- `:53` et `:284-296` : remplacer `CONSEIL_5X5` et `conseil5x5Applicable` par une aide, sans test « est-ce un damier ? ». L'aide dit : « Avec le catalogue livré, les 8 villes se posent en damier (deux dispositions) : Outils > Placer les villes ». Elle se joint aux alertes `villes_proches` et `score_s` du 5×5.
- `:324` : le nombre de villes par défaut devient `nbVilles(format)`.
- `:394` et `:411-416` : majorité par format, message « 6 contre 2 » ; nouvelle alerte `cinq_contre_trois`.
- Nouveau champ `partageSymetrique` (p₁ = p₂), et une information en 5×5 quand il est faux.
- `:417-424` : messages « de 1 à 7 » et « sur les 7 rangs » à écrire avec N.
- `:56`, `:300-318` : commentaires.

**`src/generateur.js`**
- **`:151` : le produit des groupes ne combine que 3 groupes.** Avec 4 groupes, il rend des placements de 6 villes. À généraliser (`reduce`), ou à remplacer par la liste des damiers.
- `:139-163`, `:188-197` : 8 jonctions-cases au lieu de 9 ; `tirerVilles` (4×4) garde 7.
- `:59` et `:1163` : abandonner seulement si aucun candidat n'a encore été accepté. En 5×5, porter le seuil à 200 : sinon 36 % d'échecs.
- `:233-238` et `:251-270` : rejet `partage_asymetrique` en 5×5. Il faut passer `partage` à `causeRejet`, ajouter la clé à `rejets` et aux libellés `:1078-1090`.
- `:792` : `mesurePlacement` doit utiliser la majorité du format (il lit aujourd'hui la constante globale).
- `:1008-1040` (`meilleurPlacementVilles`) :
  - préférer un partage symétrique, puis le plus petit S ;
  - si le seul placement possible est 4/3/1, le poser avec une information ;
  - textes `:1023-1025` (« 7 villes (en 2-3-2… »).
- Textes à mettre à jour : `:1058` (« 7 villes placées »), `:1080`, `:1102`, `:1281` (« 2-3-2 », « les 9 autres jonctions »), `:1293`, `:1346-1347` (« 7 villes », « environ 57 cases »), en-tête `:19-30`.

**`src/controles.js`**
- `:23-25` : 8 villes par format ; `CIBLE_CASES['5x5']` passe de 57 à **56**.
- `:43` : libellé « 6 villes contre 2 » en 5×5.
- `:105-117` : `trop_de_villes` par format. Le message `villes_proches` en 5×5 doit renvoyer au damier et à « Placer les villes ».
- `:134`, `:204`, `:374` (« Pose les 7 villes »), `:456`.

**Autres fichiers**
- `src/equilibre.js:25-34` (`explicationDe` : « les 7 distances », « 5 contre 2 », « rangs 1 à 7 ») ; `:89`, `:236-245`. Le nom `ecartMax7` peut rester, mais il faut le documenter.
- `src/assemblage.js:24`, `:511` : compteur « Villes posées x/7 » par format.
- `src/export.js:15`, `:354-355`, `:369`, `:376`, `:936` : **8 jetons**. Ils tiennent sur l'A4 actuel (5 + 3 au pas de 38 mm). Choix : une planche par format, ou 8 pour tous (1 jeton de réserve en 4×4).
- `src/sauvegarde.js:30` : commentaire seulement.
- Tests (testeur) : `tests/aides-v2.js:17-19` (`VILLES['5x5']` à 7 villes) et toutes les assertions « 2016 placements », « 2-3-2 », « 9 jonctions-cases », « 57 cases » et « 7 villes » du 5×5.

## 5. Ce que cela change ailleurs

| Point | Conséquence |
|---|---|
| **Jetons** | 8 à imprimer en 5×5. La planche A4 a la place. |
| **Cases** | **≈ 56** (56 ou 57) au lieu de 57 : une jonction-case de moins. Les cases à ≤ 2 connexions tombent à 1 % (générateur). |
| **Éditeur** | Le placement à la main devient binaire : un des deux damiers, ou une alerte « villes trop proches ». Il faut mettre en avant « Placer les villes » et montrer les deux dispositions (texte d'aide, et éventuellement une surbrillance des 8 jonctions). |
| **Pose soignée** | Elle réussit dans 71 % des cas, contre 89 % à 7 villes. Le message de refus doit dire de tourner les centrales pour libérer un damier. |
| **Rapport d'équilibre** | 8 rangs ; partage symétrique affiché ; « 6 contre 2 » et « 5 contre 3 ». |
| **Anciens documents 5×5 à 7 villes** | Pas de migration des jetons. Le rapport affiche la lacune « Il manque 1 ville : 7 posées sur 8 ». Avec 7 villes sur 8, `equilibre` rend S = null et ne vérifie aucune majorité : **aucun chiffre d'équilibre** n'est affiché tant que la 8e ville n'est pas posée. « Placer les villes » réussit sur 38 % des plateaux générés en 7 villes ; ailleurs, il faut tourner des centrales ou régénérer. Le format de sauvegarde ne change pas. |
| **Documents `36`, `48`, `60` (5×5 à 7 villes)** | Leurs chiffres d'équilibre, de partage, de tempo et de placements ne valent plus. Les seuils S restent bons. Le conseil des « 3 villes du milieu » est périmé une seconde fois. |
| **4×4** | Aucun changement. Tout passe par des tables par format. |

## Décisions pour l'utilisateur
1. **Accepter qu'avec le catalogue B3, 8 villes en 5×5 = deux dispositions seulement (damiers, « 2-2-2-2 », constat mesuré)** ?
   - Le placement des villes n'est plus un choix (2 placements différents, contre environ 50 à 7 villes).
   - Chaque joueur a 3 villes à 2 pas et 1 à 3 pas, toutes dans sa moitié. Aucune ville n'est disputée dans 89 % des plateaux (3/3/2 dans 11 %).
   - En contrepartie :
     - symétrie parfaite par demi-tour ;
     - tempo plus rapide (4 villes à ≤ 3 pas, contre 3,3) ;
     - S ≤ 2 au générateur ;
     - générateur plus rapide (0,7 à 1,05 s par plateau, contre 1,24 s).
   - Pour plus de variété, il faudrait assouplir les 3 ports ou les 3 cases d'écart en 5×5 (non mesuré ici).
2. **Partage non symétrique (4/3/1)** :
   - **rejet au générateur** (proposé : 100 % symétrique pour 1,9 % d'essais en plus) ;
   - **information** dans l'éditeur ;
   - « Placer les villes » préfère un partage symétrique quand il a le choix, sinon il pose avec une information.
3. **Seuils** :
   - « 6 contre 2 » bloquant ;
   - « 5 contre 3 » en alerte ;
   - S sur 8 rangs avec alerte à 5 et information à 4 (inchangés) ?
4. **Planche de jetons** : une planche de 8 pour tous les formats (1 jeton de réserve en 4×4), ou une planche par format ?
5. **Anciens documents 5×5 à 7 villes** : simple lacune et « Placer les villes » (proposé), ou proposition automatique de régénérer ?
