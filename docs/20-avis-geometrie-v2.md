# Avis géométrie des raccords, version 2 (advisor, Opus 5.5), 2026-10-15

Entrées : `18-decisions-v2.md`, `19-avis-design-v2.md`. Cas de test T2 recalculé par l'orchestrateur : correct.

## D1. Jonction-case
- **Modèle** : chaque jonction intérieure est un nœud du graphe, avec ou sans jeton (9 en 4×4, 16 en 5×5), état `case` ou `ville`, relié aux cases porteuses des ports qui y aboutissent ; compte comme une case ; ville non traversable. Le jeton `carrefour` disparaît : `jetons: [{i, j, type: 'capture'}]`. Un port vers un coin du pourtour ne crée aucun nœud (alerte).
- **Impression** : quart de **disque Ø 24 centré sur le coin**, prolongé dans le fond perdu, fond blanc, contour noir 0,6 mm sur l'arc seulement, dessiné par-dessus l'amorce du port ; imprimé sur **les coins intérieurs du gabarit**, même sans port (les 4 quarts reforment toujours la case).
- **Jeton ville** : Ø 30 sur les deux formats (Ø 24 = 30 − 2 × 3 mm de tolérance de pose).
- Code : `graphe.construire` crée tous les nœuds de jonction ; `rendu.contenuQuartJonction` ; `sauvegarde` supprime les jetons `carrefour` au chargement ; `DIAMETRE_CASE_JONCTION` ; `ECART_MIN_CAPTURES` (3 pas) devient `ECART_MIN_VILLES = 3` cases (4 pas).

## D2. Règles minimales des tuiles libres
- **Blocages** (en plus de l'existant : ids, extrémités, boucle, doublon, raccord / coin utilisé une fois, Ø ≤ max, marge 4 mm, hors zone de coin, pas de chevauchement) : `chemin_case` (segment à ≥ r + L/2 d'une case non extrémité) ; `chemins_croises` (sauf case partagée) ; `amorce_zone` ; `case_isolee` ; **R1** `ports_case` ; **R2** `porteuses_reliees` ; **R3** `raccord_porteuse` ; **R4** `port_apparition`. « Porteuse » = case reliée à un coin.
- **Alertes** : réseau sans sortie ; plus d'une case d'apparition ; raccord sur un côté extérieur / port sur un coin extérieur du gabarit ; gabarit hors de sa place sur le plateau.
- **Supprimés** : `NB_CASES_PAR_ROLE`, `PORTS_OBLIGATOIRES`, `MIN_COTES_RACCORD`, `cases_apparition`, `non_connexe`, rôle `apparition`.
- **Gabarit déclaré** `centrale | bord | coin` (jamais bloquant) : coins qui portent un quart de jonction, rotation suggérée sur le pourtour, tri du catalogue, guide du générateur.
- `peutPoserTuile` : refus seulement hors grille, cellule occupée, plus le blocage de déséquilibre (doc 19). Rotation stockée pour toutes les tuiles ; `rotationDeduite` ne fait que suggérer.
- Migration : format absent → `'4x4'` ; `role` → `gabarit` (`apparition` → `bord`) ; rotations écrites dans le fichier.

## D3. Case d'apparition
Case normale `type: 'apparition'` (même Ø), placée librement dans le respect de R4 ; bord : près du milieu du côté extérieur ; coin : sur la diagonale extérieure. Symbole : carré inscrit dans le disque (côté ≤ D/√2), noir et blanc, sans chiffre. Camp déduit : `campCellule(format, col, lig)` → `'vert' | 'rouge' | null` (4×4 : rangées 0–1 vert, 2–3 rouge ; 5×5 : 0–1 vert, 3–4 rouge, 2 neutre). Corrige deux défauts de `rendu.js` (carré qui déborde du disque ; liseré vert imprimé même sans joueur). Écran : forme en plus de la couleur (daltonisme).

## D4. Cotes et formats paramétrés

| Cote (mm) | 4×4 | 5×5 |
|---|---|---|
| Côté de tuile | 120 | 100 (plateau 500) |
| Raccords | 30 / 60 / 90 | **30 / 50 / 70** |
| Zone de coin R ; jeton | 20 ; Ø 30 | 20 ; Ø 30 |
| Case max ; jonction-case | Ø 30 ; Ø 24 | **Ø 24** ; Ø 24 |
| Chemin ; amorce raccord ; amorce port | 8 ; 10 ; 28 | 8 ; 10 ; 28 |
| Marge de coupe ; fond perdu | 4 ; 3 | 4 ; 3 |

Vérifications : étoile 5×5 (centre (50,50), porteuses (28,28)…) et 4×4 (porteuses (32,32)) ; bord 5×5 (porteuses (25,72) et (75,72), apparition (50,34)) ; coin 5×5 (apparition (36,36), porteuse (70,70)). Raccords issus du centre de l'étoile : au milieu seulement.
**Structure** : `PM.geometrie.format(id)` → objet gelé `{id, nbCotes, COTE, POSITIONS_RACCORD, …, GRILLE, campCellule, pointRaccord, pointCoin, tournerPoint, tournerRaccords, tournerPorts, apparier, voisin, jonctions}` ; `PM.geometrie.*` reste un alias de `format('4x4')` pendant la migration ; chaque document porte `format`. À adapter : `rendu.js`, `assemblage.js` (`COTE = 120` en dur), `controles.js`, `export.js` (126 → 106 mm), `editeur-tuile.js`.

## D5. Raccourci de coin
Coin canonique (extérieurs N, O) : raccords **E p0** et **S p2** (`0x108`) ; bord canonique (extérieur N) : **E p0** et **O p2** (`0x808`) ; tous à 30 mm du bord extérieur, depuis la case d'apparition. Se rencontrent dans toutes les rotations ; bord retourné (rot 2) = `0x220`, compatible : réversible entre les camps. Risque : « autoroute » du pourtour (bords voisins aussi reliés) : à mesurer.

## D6. Préparer l'hexagone
Rien en dur pour 4 côtés : masques de 3N bits, rotation modulo 3N, côté opposé (k + N/2) % N ; points de raccord, normales et bissectrices calculés depuis les sommets du polygone ; jonctions = listes (tuile, coin) fournies par `format.jonctions()` (3 tuiles en hexagone) ; cellules par clé opaque ; camps par `format.campCellule` ; jonction-case = secteur de 120°.

## Cas de test
| # | Situation | Attendu |
|---|---|---|
| T1 | Coin `0x108` (0,0) rot 0 / bord `0x808` (1,0) rot 0 ; coin (3,3) rot 2 (`0x204`) / bord (3,2) rot 1 (`0x044`) | `apparier(0x108,1,0x808).connectes = 1` ; `apparier(0x044,2,0x204).connectes = 1` |
| T2 | Bord `0x808` rot 2 (`0x220`) en (1,3) et (2,3) | `apparier(0x220,1,0x220).connectes = 4` |
| T3 | Étoile 5×5, raccord N du centre en p0 | distance porteuse–segment 9,8 < 16 : blocage `chemin_case` (4×4 : 9,6 < 19) |
| T4 | 4×4 sans jeton, deux ports vers J(2,2), puis villes en (1,1) et (2,1) | J(2,2) a 2 voisins ; ville–ville ≥ 3 cases ; pas d'alerte |
