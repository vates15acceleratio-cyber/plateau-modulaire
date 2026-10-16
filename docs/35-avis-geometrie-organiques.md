# Avis géométrie : tuiles organiques (advisor, Opus 5.5), 2026-10-16

Rapport de l'advisor consigné par l'orchestrateur. Objet : `34-tuiles-organiques.md` § 5. L'advisor a travaillé en lecture seule, avec des scripts de calcul dans son dossier temporaire.

**Méthode.** Recherche locale au pas de 1 mm, qui maximise la plus petite marge. Chaque centrale a passé `validerModele(m, '5x5')` sans erreur ni alerte, et `problemesTrace(m, '5x5')` sans problème. Deux contraintes de lisibilité ont été ajoutées :
- coude d'au plus 45° après chaque amorce ;
- une porteuse à environ 22 mm au plus de l'amorce de son port.

> **Note de l'orchestrateur.** Les 10 centrales ont été reconstruites à partir de ces coordonnées et revalidées avec le code du projet : 0 erreur, 0 alerte, 0 problème de tracé. Le plateau témoin « tout organique » donne exactement les ports annoncés, sans aucun raccord mort ni alerte. Croquis montrés à l'utilisateur le 2026-10-16.

## 1. Centrales organiques : toutes valides dans 100 mm

Les marges sont en mm. Pour comparaison, C7 et C8 actuels ont 2,7 de marge de tracé et 11,1 de jeu entre cases.

| Id | Nom | Côtés à raccord | Cases (x, y) | Cases / ports | Marge tracé | Jeu |
|---|---|---|---|---|---|---|
| C10 | Virage | N E | relais (56,44) ; NO (24,42) ; SE (58,76) | 3 / 2 | 9,3 | 12,1 |
| C11 | Virage à trois ports | N E | relais (52,52) ; NO (22,41) ; SE (64,77) ; SO (30,76) | 4 / 3 | 7,5 | 7,7 |
| C12 | Droite | N S | relais (50,49) ; NO (22,39) ; SE (78,59) | 3 / 2 | 8,1 | 9,7 |
| C13 | Té | E S O | relais (50,44) ; NO (35,21) ; NE (65,21) | 3 / 2 | 7,1 | 7,5 |
| C14 | Impasse | N | relais (51,43) ; SE (73,67) ; SO (26,64) | 3 / 2 | 12,2 | 12,6 |
| C15 | Deux virages | N E + S O | A : relais (56,25), NO (26,32) — B : relais (43,75), SE (72,67) | 4 / 2 | 10,0 | 10,1 |
| C16 | Deux virages fermés | N E + S O | A : relais (62,48), NE (78,28) — B : relais (34,50), SO (20,71) | 4 / 2 | 5,0 | 5,2 |
| C17 | Deux impasses | N + S | A : relais (56,29), NO (26,39) — B : relais (43,70), SE (73,60) | 4 / 2 | 11,7 | 11,6 |
| C18 | Deux ponts (C3 du 5×5) | N E + S O | A : relais (50,34), NO (26,26), NE (71,20) — B : relais (42,58), SE (73,69), SO (23,74) | 6 / 4 | 4,7 | 4,8 |
| C19 | Pont et demi | N E + S O | A : relais (59,45), NO (21,32), NE (76,26) — B : relais (39,76), SE (65,74) | 5 / 3 | 5,2 | 5,5 |

**Variantes vérifiées** (marge tracé / jeu) :
- C10b, virage NE + SO : relais (57,43), NE (75,25), SO (25,60) — 5,4 / 5,5 ;
- C10c, virage SE + SO : relais (61,46), SE (64,76), SO (24,59) — 9,3 / 10,1 ;
- C12b, droite NE + SE : relais (56,53), NE (79,38), SE (79,68) — 7,0 / 7,5 ;
- C13b, té SE + SO : relais (50,64), SE (71,79), SO (29,79) — 4,8 / 5,8 ;
- virage + impasse, 4 cases / 2 ports — 5,2 / 5,5 ;
- virage à 4 ports, 5 cases / 4 ports — 3,8 / 4,0.

**Ce qui ne tient pas :**
- deux réseaux sur des côtés opposés (N–S avec E–O) : ils se croisent forcément, il faudrait un pont ;
- un port dans le coin enfermé par l'autre réseau ;
- trois réseaux sur une tuile.

**Orientations distinctes :** C12, C15, C16, C17 et C18 n'en ont que 2, les autres en ont 4.

## 2. M3 : tracés coudés ou courbes
- **Modèle de données :** un champ facultatif `via: [{x, y}]` sur un chemin, de 1 à 4 points, dans l'ordre de `a` vers `b`. Pas d'arc stocké, car l'export PDF ne connaît que les segments. Le lissage pourrait venir plus tard (`lisse: true`, subdivision faite dans `tracesModele`).
- **Ce qui change :**
  - `tracesModele` insère les `via` après l'amorce ;
  - la validation gagne deux règles : `via_invalide`, et l'auto-croisement d'un même chemin ;
  - `rogner` dans `tests/aides-trace.js` est à généraliser ;
  - l'éditeur gagne des poignées de points de passage, avec une aimantation plus fine que 10 mm ;
  - **la sauvegarde jette aujourd'hui `via` sans rien dire** (`sauvegarde.js:108-111`) : il faut le lire ;
  - il faut passer à `version: 3`, mais seulement si un chemin a des `via`.
  - Le rendu, l'export, le graphe et le générateur ne changent pas.
- **Ce que ça apporte :** la courbure est **esthétique**. Elle ne fait gagner ni case ni port, et elle coûte de 0,5 à 2,4 mm de marge. L'aspect organique vient surtout du **relais décentré**, qui donne déjà des coudes de 24 à 44°. **M3 peut attendre.**

## 3. M1 : appariement des bords
- 16 signatures de bord, en 6 classes : vide, impasse, virage, droite, té, croix.
  - Les tuiles à deux réseaux N E + S O se posent comme une croix.
  - C17 se pose comme une droite.
- **Apparier les bords revient à n'avoir aucun raccord mort.** Aucune règle nouvelle n'est nécessaire : une alerte en pose manuelle, une contrainte pour le générateur.
- **Le pourtour reste tel quel.**
  - Les raccourcis aux positions 0 et 2 et K2 restent hors du jeu.
  - Le raccord S des bords oblige les 12 côtés extérieurs des centrales à porter un raccord. Il est conseillé de le garder.
- **Pour le générateur :**
  - 12 contacts internes sont libres ;
  - une cellule d'angle du centre a 4 signatures possibles, une cellule de milieu 8, et la cellule centrale 16.
- **Motifs internes réalisables** (sur 4096) :

  | Classes au catalogue | Motifs |
  |---|---|
  | croix seule (aujourd'hui) | 1 |
  | virage + té | 16 |
  | virage + droite + té | 258 |
  | virage + droite + té + croix | 1888 |
  | toutes sauf le vide | 3840 |

## 4. Budget de ports
- **Invariant :** cases − ports = 38 + k, où k est le nombre de centrales « coûteuses ». Une centrale coûte quand elle a 2 cases de plus que de ports : C15, C16, C17, C18, C19, virage + impasse.
- Avec au moins 39 ports et au plus 78 cases, on obtient **k ≤ 1** : **une seule tuile à deux réseaux par plateau**.
- Les autres centrales sont neutres :
  - C10, C12, C13 et C14 font 3 cases pour 2 ports ;
  - C11 compte comme un B1 : la règle devient nB1 + n(C11) = 5 ou 6.
- **Recherche de pose (recuit simulé).** Chaque témoin a été contrôlé par le code du dépôt : 0 raccord mort, 0 jonction mal reliée, villes 2-3-2 sur des jonctions à 3 ports, plateau connexe.
  - Tous les mélanges permis par le budget ont des poses valides.
  - « Tout organique » (C10, C12, C13, C14) : 78 cases / 40 ports, 33 réussites sur 50.
  - Avec les croix et les variantes en plus : 48 à 49 réussites sur 50.
  - Avec 1 C18 : 78 / 39, sans marge.
  - 2 C18 : 79 cases ; 3 C18 : 81 cases.
- **Pour plus d'une tuile à deux réseaux, trois leviers** (décision de l'utilisateur) :
  - accepter plus de cases ;
  - relâcher « 3 ports aux villes » ;
  - tolérer une alerte R2 sur ces seules tuiles.

## 5. Risques
1. Le budget n'a plus de marge dès qu'une tuile à deux réseaux est posée : le générateur doit compter exactement.
2. Les 4 jonctions intérieures ne reçoivent de ports que des centrales. C13 et C14 concentrent leurs ports d'un seul côté, d'où un risque de cul-de-sac (M4 non vérifié).
3. Jeu de 4,8 à 5,5 mm entre les cases des tuiles à deux réseaux serrées (C16, C18, C19) : imprimées, elles peuvent sembler reliées. À voir sur croquis à l'échelle 1.
4. Porteuses loin de la bissectrice (C10, C12) : le chemin du port fait un coude de 34 à 39°.
5. Tant que les bords gardent leur raccord S, virages et tés ne jouent que sur les 12 contacts internes.
6. M3 : `via` est perdu à la lecture par une ancienne version, d'où la version 3.
