# Avis design de jeu : 5×5 très connecté (advisor, Opus 5.5), 2026-10-18

Lecture seule ; rien n'est modifié dans le dépôt. Les scripts et les sorties sont dans le scratchpad `advisor-design-connexions/` :
- `degres.js` : mesure de la 4.00.0 ;
- `sim.js` et `catalogues.js` : modèle abstrait de tirage et d'orientation ;
- `reel.js` : plateaux du modèle passés dans le vrai code ;
- `indep.js` : dénombrement des placements ;
- `out-*.json` et `reel-*.json` : sorties.

**D'où viennent les chiffres :**
- **mesuré, vrai code** : `GR.construire`, `GR.equilibre`, `GR.rythme` et `GR.villesProches` de `connexions-5x5`, sur des documents créés en mémoire. Les modèles candidats ont des coordonnées fictives ; seuls les tracés de passage en dépendent.
- **Tirage et orientation** : ils viennent de mon modèle et non du vrai générateur.
  - Les tuiles sont tirées au poids.
  - Les centrales sont orientées par recherche locale : moins de raccords morts, de cases à 2 connexions et de jonctions à moins de 3 ports.
  - Le meilleur placement 2-3-2 est choisi sur S.
  - Il n'y a **ni affinage du rythme, ni rejet des jonctions vides**.
- **modèle seul** : pour le décompte des placements différents. Le modèle ne suit pas les passages d'une tuile à l'autre : ses chiffres sur la 4.00.0 ne valent qu'en relatif.
- **estimé** : calcul à la main.
- **Référence 4.00.0** : vrai générateur, `docs/48`, 1000 plateaux.

## 1. Mesure « connexions d'une case »
- **Définition** : le **nombre de cases différentes que l'on atteint en un déplacement**, c'est-à-dire le degré du nœud dans `GR.construire`.
  - Comptent : les chemins internes, les raccords appariés, les ports, et les passages (une case au bout d'un passage, même en T, est voisine).
  - Une même voisine compte une seule fois.
  - Un raccord mort ne compte pas.
- **Cases comptées** : toutes les cases où l'on s'arrête, c'est-à-dire les cases des tuiles (apparitions comprises) et les **jonctions-cases**.
  - Les **villes sont à part** : leur nombre de connexions est la règle des « 3 accès ».
  - Le chiffre de 62 % de l'orchestrateur comptait aussi les villes. Mesuré en 4.00.0 sur 40 plateaux générés :
    - 67,2 % des cases de tuile sont à 2 connexions ;
    - 63,6 % des jonctions-cases n'ont que 2 ports ;
    - toutes les apparitions ont au moins 3 connexions ;
    - 61,5 % sur tous les nœuds.
- **Plateau conforme** : **moins de 5 % de cases à 2 connexions ou moins**, soit 2 cases au plus sur environ 59.
  - Une jonction-case à 2 ports compte.
  - Les impasses restent interdites.
  - Une jonction sans port, case isolée, est **rejetée**.
- **À afficher** :
  - la part par plateau ;
  - sur 200 plateaux : la moyenne et la part de plateaux conformes ;
  - le degré moyen.

## 2. Faisabilité avec 2 cases par tuile au plus
**Budget de ports (estimé)**
- Pour que les jonctions-cases aient aussi 3 connexions, il faut 7 × 3 + 9 × 3 = **48 ports**, sur 64 coins de tuile.
- **Avec R1 (un port par case) et R4 (aucun port sur l'apparition)** : 9 × 2 + 12 + 4 = **34 ports au plus**, moins que le minimum actuel de 39.
- **R1 doit donc être levée** en 5×5. Lever R4 à la place mettrait une ville à 1 pas de l'apparition.

**Ce que coûte une case à 2 ports**
- Ses deux jonctions sont à 2 pas : elles ne seront **jamais villes ensemble**.
- Deux porteuses de paires différentes reliées mettent leurs jonctions à 3 pas : autre conflit.
- Dénombré sur les 2016 placements 2-3-2 :
  - si toutes les paires orthogonales sont desservies par une même case, il reste **12 placements** ;
  - avec des conflits en diagonale (centrale qui relie ses deux porteuses), il n'en reste **aucun**.
  - Le modèle « tout relié » donne 0 placement à 3 cases d'écart, et environ 18 par plateau si l'écart passe à 2 cases.

**Seule structure viable trouvée : « porteuse latérale + relais »**
- Chaque tuile a une case qui porte les ports et une case qui porte les raccords (relais, ou apparition sur le pourtour).
- La **porteuse latérale** :
  - dessert les **2 coins d'un même côté**, jamais deux coins en diagonale ;
  - porte le raccord du milieu de ce côté ;
  - en face, elle ne rencontre qu'un relais, une apparition, ou la porteuse de la même paire.
- Ville – porteuse – relais – porteuse – ville fait 4 pas : seules les paires desservies par une même case créent des conflits.

**Résultats** (100 plateaux, vrai code)
- **R** = cadre minimal : Pont et relais, Deux ponts, Bord à pont, Coin à porteuse.
- **RF** = R plus la centrale « **Pont et fourche** » : le relais part en T sans case vers deux côtés.

| Mesure | R | RF | 4.00.0 (vrai générateur) |
|---|---|---|---|
| Cases par plateau | **59** | **59** | 80,3 |
| Connexions (toutes cases d'arrêt) | 2 : 2 % ; 3 : 32 % ; 4 : 66 % | 2 : 2 % ; 3 : 30 % ; 4 : 59 % ; 5–6 : 8 % | 2 : environ 66 % |
| Part de cases à 2 connexions (moyenne) | **3 %** | **3 %** | environ 66 % |
| Plateaux sous 5 % (parmi ceux qui ont un placement) | **86 %** | **94 %** | 0 % |
| Jonction sans port, à rejeter : plateaux touchés | 15 % | 17 % | 0 |
| Plateaux sans placement admissible | 1 % | **14 %** | 0 |
| Placements admissibles par plateau (moyenne) | 7,5 | 3,5 | 46,6 |
| Placements différents sur 200 plateaux (modèle seul) | **49** | **44** | 563 sur 1000 |
| S du placement retenu (moyenne) | 1,15 | 1,5 | 0,53 (rejet à 5) |
| « 5 contre 2 » ; villes trop proches | 0 ; 0 | 0 ; 0 | 0 ; 0 |
| Tempo : villes à ≤ 3 pas par joueur | 3,7 | 3,5 | 4,97 |
| Chaîne du rythme (`GR.rythme`) : moyenne, plage | **8,6** (8–10) | **6,6** (3–9 ; ≤ 4 dans 10 %) | 2,63 (≤ 3 partout, après affinage) |
| distMax : moyenne (≤ 2 / 3 / 4) | 3,2 (29 / 19 / 51 %) | **2,3** (68 / 14 / 4 %) | 3,41 |

**Variantes (vrai code)**
- **Bords à 1 port mêlés** :
  - 192 placements différents sur 200 plateaux (modèle seul), au lieu de 49 ;
  - mais 4 % de cases à 2 connexions, 43 % de plateaux conformes et 24 % sans placement.
- **« Pont et virage »** (quart de tour entre deux côtés, relais sur un seul raccord) : son relais n'a que 2 connexions, soit **8 %** de cases à 2. Écarté.

**Bilan des règles**
- **Écart d'au moins 3 cases entre villes** : tenable, mais **il n'est plus garanti par les tuiles**. Il est garanti par le placement choisi au générateur ; l'éditeur aura plus d'alertes.
  - En pose libre, sans orientation, 52 % des plateaux n'ont aucun placement valable (modèle).
- **3 accès aux villes** : tenable, les villes ont 3 ou 4 ports.
- **Villes 2-3-2** : tenable. Les bords à 2 ports limitent les rangées 1 et 4 aux paires {1, 3}, {1, 4} ou {2, 4}.
- **Équilibre** : S de 1 à 1,5 sans rejet, et aucun « 5 contre 2 ».
- **Rythme** : sans affinage, la chaîne vaut 6 à 9.
  - Les longues géodésiques suivent les porteuses du pourtour et les couloirs de relais : ce ne sont pas des cases à 2 connexions, mais rien ne s'y passe.
  - Avec la fourche, la chaîne tombe à ≤ 4 sur 10 % des plateaux. Un générateur qui affine le rythme fera mieux.
  - **≤ 3 reste probablement hors d'atteinte**, à mesurer avec le vrai générateur.
- **Tempo** : un peu plus lent malgré 59 cases. L'écart de 4 pas entre villes sur une grille de 4 × 4 jonctions fixe l'échelle des distances.

## Tableau des décisions (5×5 seulement)

| Décision | Avis | Coût ou raison |
|---|---|---|
| R1, un port par case | **Lever** : porteuse latérale à 2 ports (deux coins d'un même côté, jamais en diagonale) | Indispensable (34 ports au plus sinon) ; ses deux jonctions ne seront jamais villes ensemble |
| R2, porteuses jamais reliées | **Garder, assouplie** : contact seulement entre porteuses de la même paire | La lever = 0 placement |
| R3, pas de raccord latéral sur une porteuse | **Lever en partie** : raccord du milieu de son côté ; porteuse du coin vers l'apparition du bord voisin | Règle moins locale : validateur propre au 5×5 |
| R4, pas de port sur l'apparition | **Garder** | Sinon ville à 1 pas de l'apparition |
| Au moins 3 cases entre villes | **Garder** | Plus garanti par les tuiles ; 3,5 à 7,5 placements par plateau au lieu de 46,6 |
| 3 accès aux villes | **Garder** | Aucun |
| Villes 2-3-2 | **Garder** | Rangées 1 et 4 limitées à 3 paires |
| Liberté de placement des villes (`docs/45`) | **Abandonner en grande partie** | Environ 45 placements différents sur 200 plateaux, au lieu de 563 sur 1000 |
| K2 seul, retrait de K1 | **Lever** : coin à 2 cases, ville à 2 pas de l'apparition, comme depuis chaque bord | Un coin « détour » à 3 pas laisse l'apparition à 2 connexions (8 % de cases à 2) |
| 78 à 81 cases | **Lever** : **57 à 59** | Imposé par les 2 cases par tuile |
| **Plateau organique (passages, virages, T ; au moins 3 motifs)** | **Fortement réduit** : seul le T du relais (« Pont et fourche ») tient, sur 3 ou 4 centrales ; pas de quart de tour seul ; pas de passage sur le pourtour | Une porteuse ne peut toucher un passage ; avec 2 cases, c'est le relais qui porte le motif ; la fourche coûte des placements (14 % de plateaux sans placement au lieu de 1 %) |
| Rythme : chaîne ≤ 3 | **Garder la mesure, cible à revoir après mesure du vrai générateur** ; en contrôle : distMax ≤ 3 (≤ 2 visé avec la fourche) | Chaîne de 6 à 9 sans affinage |
| Moitiés égales | **Garder** | Automatique avec des tuiles toutes à 2 cases |
| Pas de traversant | **Garder** | La fourche relie deux côtés voisins par un T qui part d'une case : ce n'est pas un traversant (comme P3) |
| Pas de passage vers un coin ; un passage au plus par bord ou coin ; jamais depuis l'apparition | **Garder** | Aucun passage sur le pourtour |
| Une porteuse ne touche jamais un passage | **Garder** | Sinon conflits en diagonale |
| Pas de miroir | **Garder** | Aucune tuile du cadre n'en demande |
| Passage = 1 déplacement | **Garder** | |
| Raccords au milieu des côtés des centrales | **Garder** | Le cadre n'utilise que les milieux |
| Aucun raccord latéral hors du raccourci, sur les bords | **Lever** : E1 / O1 sur l'apparition, pour rejoindre la porteuse du coin | Plus de chemins depuis l'apparition : à vérifier en géométrie |
| Aucun mur | **Lever pour « Deux ponts » seulement** | Sans lui : 46 ports, 2 jonctions-cases au moins à 2 ports |
| Seuils S du 5×5 (alerte à 7) | **À remesurer** | S plus faible |
| Préférence anti-goulets | **Garder, à remesurer** | Les jonctions-cases deviennent des carrefours |

## 3. Cadre proposé pour le catalogue 5×5
**Familles de tuiles** (2 cases au plus, aucun miroir)

| Famille | Modèle | Contenu | Proportion |
|---|---|---|---|
| Centrale | **« Pont et relais »** | Porteuse au nord (ports NO et NE, raccord N1) ; relais (E1, S1, O1) ; un lien | 4 ou 5 sur 9, en 2 dessins |
| Centrale | **« Pont et fourche »** | Même porteuse ; relais E1 avec un T sans case vers S1 et O1 | 3 sur 9 ; c'est le motif organique |
| Centrale | **« Deux ponts »** | Porteuses opposées (NO + NE et SO + SE, N1 et S1), non reliées ; murs E et O | 1 sur 9 ; fait monter les ports à 48 |
| Bord | **« Bord à pont »** | Apparition-relais (raccourci E0 / O2, plus E1 / O1) ; porteuse SE + SO (S1) | 12 sur 12 |
| Coin | **« Coin à porteuse »** | Apparition (raccourci E0 / S2) ; porteuse SE (E1 et S1), reliée à l'apparition | 4 sur 4 |

- **Nombre de modèles** : 5 topologies et 6 à 7 dessins, contre 8 aujourd'hui.
- **Stock** : à recalculer (90 % montables).

**Cibles**
- 57 à 59 cases.
- 46 à 50 ports.
- Chaque jonction a au moins 2 ports (rejet), 3 de préférence.
- Chaque ville a au moins 3 ports.

**Générateur**
- Il choisit le placement des villes **avant** d'orienter les centrales : aucune porteuse ne doit desservir deux villes.
- **Rejets** :
  - **plus de 5 % de cases à 2 connexions** ;
  - jonction à moins de 2 ports ;
  - ville à moins de 3 ports ;
  - écart de moins de 4 pas entre deux villes ;
  - S ≥ 5 ;
  - « 5 contre 2 ».
- **Préférences**, dans l'ordre :
  1. chaîne ;
  2. raccords morts ;
  3. points d'articulation ;
  4. S.

**Nouvelles mesures**, sur 200 plateaux :
- part de cases à 2 connexions et part de plateaux conformes ;
- degré moyen ;
- ports par jonction ;
- placements admissibles par plateau et placements différents ;
- chaîne et distMax ;
- tempo ;
- goulets ;
- montable avec la boîte.

**Pour l'éditeur** :
- une information « case à 2 connexions » ;
- R1 et R3 propres au format ;
- une aide « placer les villes ».

## 4. À vérifier par l'advisor géométrie
1. **Porteuse latérale** (Ø 20, tuile de 100 mm) : deux ports vers les coins d'un même côté, plus N1 au milieu, sans gêner les zones de coin ni les ports des tuiles voisines.
2. **Relais** : à 3 raccords plus le lien ; et, pour la fourche, un T sans case dont le pivot n'est pas sur le relais. Garder 8 mm entre les chemins.
3. **Apparition de bord à 5 chemins** (E0, E1, O1, O2 et le lien), ou une autre solution pour joindre la porteuse du coin.
4. **Coin** : port SE et raccords E1 / S1 sur la porteuse, raccourci sur l'apparition, sans croisement.
5. **« Deux ponts »** : lisibilité de deux réseaux séparés et de deux murs.
6. **Variété** : 2 dessins de « Pont et relais » de même topologie.
7. La règle « porteuse latérale » peut-elle être exprimée dans `validerModele` pour le seul 5×5 ?

## Décisions pour l'utilisateur
1. **Placement des villes** : 3 à 7 placements par plateau, et environ 45 différents sur 200 plateaux, au lieu de la liberté du `45` : acceptable ?
2. **Plateau organique** : il ne reste qu'un T sans case par centrale « fourche » (3 sur 9) et aucun quart de tour seul. Est-ce assez organique ?
3. **Coin à 2 cases**, ville à 2 pas de l'apparition comme K1 : accepté en 5×5 ?
4. **Écart entre villes** : garder 3 cases ? À 2 cases, des tuiles toutes reliées deviendraient possibles (environ 18 placements par plateau, degré de 3 à 6), mais c'est une règle ferme.
5. **« Deux ponts »**, centrale à deux murs, nécessaire pour atteindre 48 ports : accepté ?
6. **Rythme** : chaîne ≤ 3 probablement hors d'atteinte (6 à 9 sans affinage) ; accepter une cible revue après mesure du vrai générateur ?
7. **Tempo** : un peu plus lent (3,5 villes à 3 pas contre 5 aujourd'hui) malgré 59 cases : acceptable ?
