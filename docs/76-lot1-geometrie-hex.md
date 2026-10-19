# Lot 1 : géométrie du format hexagonal `'hex19'` (sous-agent de production, Sonnet 5.5), 2026-10-19

Rapport du sous-agent, consigné et condensé par l'orchestrateur. Fichiers touchés : `src/geometrie.js`, nouveau `tests/geometrie-hex.test.js` (15 tests). `node --test` : 765 tests, 758 OK, 0 échec, 7 PDF ignorés (vérifié par l'orchestrateur). Les formats 4×4 et 5×5 ne changent pas.

## Choix et écarts
- **`FORMATS` reste `['4x4','5x5']`.** `app.js`, `sauvegarde.js` et `bibliotheque.js` parcourent cette liste et proposeraient sinon un format que rien ne sait encore gérer. Deux ajouts :
  - `PM.geometrie.FORMATS_TOUS = ['4x4','5x5','hex19']` ;
  - `PM.geometrie.ID_HEX = 'hex19'`.

  `format('hex19')` fonctionne. Les consommateurs de `FORMATS` passeront sur `FORMATS_TOUS` au lot interface et sauvegarde.
- **`DIAMETRE_CASE_MAX = 20` en hexagonal** (marges de 3 mm).

## API de `format('hex19')`
- **Constantes :**
  - `nbCotes: 6`, `COTE: 54`, `APOTHEME` ≈ 46,77 ;
  - `POSITIONS_RACCORD: [0]` : un seul raccord, au milieu de chaque côté ;
  - cases et jonctions-cases de Ø 20, jeton de Ø 30, chemin de 8 mm ;
  - `GRILLE` donne la boîte englobante, les rangées 3-4-5-4-3 et les 19 cellules ;
  - `PLATEAU` : 498,83 × 432, côté de 249,42 ;
  - `TREFLE` : `[0,4,8,15,19,23]`.
- **Masques :** raccords et ports sur 6 bits, rotation par pas de 60° (`tournerRaccords`, `tournerPorts`, `tournerCote`, `tournerPoint`).
- **Appariement :** `apparier` fait rencontrer le côté k avec le côté (k + 3) % 6 du voisin. `raccordEnFace` donne le raccord d'en face.
- **Points de référence :** `pointRaccord(cote)`, `pointCoin(k)`, et les tableaux `NORMALE` et `BISSECTRICE` propres au format.
- **Gabarits :**
  - centrale (alias `interieure`) : 6 coins intérieurs ;
  - bord : côtés extérieurs [5, 0], coins intérieurs [2, 3, 4] ;
  - coin : côtés extérieurs [0, 1, 2], coins intérieurs [4, 5].
- **Grille :**
  - `cellules`, 19 objets : col, lig, q, r, x, y, rôle, gabarit, camp, rotation imposée, voisins, côtés extérieurs, sièges des coins ;
  - fonctions `cellule`, `estCellule`, `cle`, `voisin`, `campCellule`, `roleCellule`, `rotationImposee`, `positionCellule`.
- **Formes :** `forme(rôle)`, `formeCellule(col, lig)` (rotation imposée comprise) et `contourPlateau()`.
- **Sièges :**
  - `sieges` : 24 sièges `{id, x, y, camp, tuiles ×3}` ;
  - `sommetsPourtour` : 12 sommets ;
  - `siegeDuCoin(col, lig, coinLocal, rot)`.
- **`tracesModele` et `tracesPassages`** acceptent le format hexagonal.

## Conventions
- **Côtés,** dans le sens horaire : 0 = NE, 1 = E, 2 = SE, 3 = SO, 4 = O, 5 = NO.
- **Coins :** 0 = N, 1 = NE, 2 = SE, 3 = S, 4 = SO, 5 = NO. Le coin k est le début du côté k.
- **Rotation :** `rot` par pas de 60° horaires ; le côté local k devient le côté global (k + rot) % 6.
- **Repère local centré :** x vers l'est, y vers le sud. Le carré, lui, a son origine au coin NO.
- **Clés `col,lig` :** coordonnées axiales décalées, `lig = r + 2` et `col = q + 2`.
  - Décalages des voisins par côté : [(+1,−1), (+1,0), (0,+1), (−1,+1), (−1,0), (0,−1)].
  - Centre d'une cellule : `x = 54·√3·(q + r/2)`, `y = 81·r`.
- **Camps :** lig 0 et 1 vertes, lig 3 et 4 rouges, lig 2 neutre (7 / 5 / 7 cellules). Les coins E et O sont neutres.
- **Rôles :** 1 centre, 6 couronne, 6 bords, 6 coins.
- **Rotations imposées :**
  - bord nord 0, bord sud 3 ;
  - coin NO 4, coin NE 5, coin E 0, coin O 3.
- **Sièges :**
  - numérotés comme `camps.png` : 0 à 11 au nord, 12 à 23 au sud ;
  - le champ `tuiles[].coin` donne le coin **global**, le coin local valant `(coin − rotation + 6) % 6` ;
  - le trèfle est symétrique par demi-tour (le siège i correspond au siège 23 − i).
- **Formes :** bord de 93,5 × 108, coin de 116,9 × 108 en position NO, plateau de 498,8 × 432. Le pavage a été vérifié par l'aire.

## Différences avec l'API carrée (pour les lots suivants)
1. **Raccords :** `pos` vaut toujours 0. Les contrôles qui imposent un côté entre 0 et 3 et une position entre 0 et 2 doivent dépendre de `nbCotes` et de `POSITIONS_RACCORD`.
2. **Masques :** sur 6 bits. `triplet` ne lit qu'un bit et `inverser3` ne change rien.
3. **Directions :** pas de NORD, EST, SUD ni OUEST.
4. **Repère local :** centré, et non à partir du coin NO.
5. **Grille :** `GRILLE` n'est qu'une boîte englobante. Il faut parcourir `cellules`, jamais `colonnes × lignes`.
6. **Valeurs par format :** `GABARITS`, `NORMALE` et `BISSECTRICE` dépendent du format. Les valeurs globales restent celles du carré.
7. **Voisins :** `voisin` est une fonction du format.
8. **Pourtour :** ses tuiles ont une rotation imposée et une forme non hexagonale.
9. **Sièges et trèfle :** ils sont définis dans le format.
10. **Passages courbes en hexagonal :** leurs formes par défaut ne sont pas encore étudiées (HC3 avec pivot, à traiter aux lots catalogue et rendu).
