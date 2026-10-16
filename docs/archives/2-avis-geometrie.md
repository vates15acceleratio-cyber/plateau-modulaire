# Avis de l'advisor géométrie des raccords (Opus 5.5), version B, 2026-10-15

Entrées : `0-brief.md`, `1b-avis-design-jeu-variante-jonctions.md`. Cas de test T1 à T3 recalculés par l'orchestrateur : corrects.

**Conventions**
- Côtés : 0 = N, 1 = E, 2 = S, 3 = O. Coins : 0 = NO, 1 = NE, 2 = SE, 3 = SO (le coin k est le début du côté k).
- Lecture horaire (N d'ouest en est, E du nord au sud, S d'est en ouest, O du sud au nord). Position p : 0 = début, 1 = milieu, 2 = fin.
- Plateau : lignes croissantes vers le sud ; `rot` = nombre de quarts de tour horaires.

## D1. Contour carré de 12 cm, seul viable
Seul polygone qui supporte rotations de 90° et pavage, avec des coins à 90° pour les 4 tuiles d'une jonction. `contour` disparaît du modèle, remplacé par la constante `COTE = 12`.

## D2. 3 positions de raccord par côté, à 3, 6 et 9 cm (valeur par défaut maintenue)
- Zone de coin R = 20 mm, chemin de 8 mm : 6 mm de jeu entre le chemin « début » et la zone de coin.
- Case sur l'axe « début », centrée à 25 mm du bord : 39,1 mm du coin, pour un minimum de 37 mm (2,1 mm de jeu).
- {3, 6, 9} est symétrique (p devient 12 − p), condition de la règle face à face.
- Un seul type de raccord : l'« identifiant de compatibilité » disparaît. Raccord = (côté 0..3, pos 0..2).
- **Risque** : cette case passe à 3,5 mm de la diagonale du port de coin ; l'éditeur doit détecter les chevauchements.

## D3. Représentation et rotation
- `raccords` : masque de 12 bits, bit = 3k + p. `portsCoin` : masque de 4 bits, bit = k.
- Rotation de 90° horaire : `m' = ((m << 3) | (m >> 9)) & 0xFFF`, `c' = ((c << 1) | (c >> 3)) & 0xF`, appliquée `rot` fois.
- Tuile = { `raccords`, `portsCoin`, `role` }. Extrémités d'un chemin : une case, un raccord (k, p) ou un coin k.

## D4. Appariement face à face, raccords morts
- Le côté k de A touche le côté (k+2) % 4 de B ; la position p rencontre 2 − p.
- `a = (mA >> 3k) & 7`, `b = (mB >> 3((k+2)%4)) & 7`, `rev` échange les bits 0 et 2.
- `connectes = a & rev(b)` ; `mortsA = a & ~rev(b)` ; `mortsB = b & ~rev(a)`.
- **Raccord mort ou face au vide : permis, avec alerte, sans blocage.** Le générateur le pénalise.
- « 3 à 4 raccords » = nombre de **côtés** dont le triplet n'est pas nul : centrale ≥ 3, bord ≥ 2.
- Graphe : une arête case–case par bit de `connectes`.
- **Risque** : sur carton, un chemin qui bute sur le vide du voisin peut se lire comme une connexion.

## D5. Ports de coin et jonctions (désaccord partiel avec la version B)
- Port **obligatoire sur chaque coin intérieur** : centrale 4, bord 2, coin 1. Une case porte au plus un port de coin.
- Jonction connectée si au moins `minPortsJonction = 2` ports y aboutissent.
- La jonction (i, j) reçoit le coin 2 de la tuile (i−1, j−1), le coin 3 de (i, j−1), le coin 1 de (i−1, j) et le coin 0 de (i, j).
- **Désaccord** : les centrales ont **4 cases** (et non 3 à 4). Total ≈ 16 + 12 × 2,6 ≈ 47, plus 2 carrefours.
- Validation : `portsCoin == coinsInterieurs(role)`.
- **Risque** : jonctions toutes accessibles ; la variété vient du routage interne et des raccords latéraux.

## D6. Écart entre villes
- La règle « une case, un port au plus » garantit **au moins 3 pas** partout, par contrôle local.
- Si `ecartMinCaptures > 3` : plus court chemin global obligatoire (le chemin ville–case–case–ville à travers un raccord latéral fait 3 pas).

## D7. Cotes et tolérances
- Zone de coin : quart de disque R = 20 mm (jeton de 15 mm de rayon + 5 mm).
- Chemins de 8 mm. Segment droit perpendiculaire d'au moins 10 mm depuis le bord à chaque raccord (case sur l'axe centrée à ≥ 25 mm du bord).
- Cases (Ø 30 mm) à ≥ 3 mm de la ligne de coupe.
- Port de coin : chemin de 8 mm sur la bissectrice jusqu'au coin, sous le jeton (les 4 tuiles forment un X).
- Découpe : ±0,5 mm visé, ±1 mm acceptable. Fond perdu 3 mm (à confirmer par le prépresse). Jeton centré à ±3 mm.
- **Risque** : marche due à l'épaisseur du carton sous le jeton.

## D8. Rotation imposée déduite automatiquement
- Orientation canonique : bord = côté extérieur au N ; coin = côtés extérieurs N et O.
- Bords : nord 0, est 1, sud 2, ouest 3. Coins : NO 0, NE 1, SE 2, SO 3. Apparition : J1 rot 0, J2 rot 2.
- Rotation stockée seulement pour les centrales. Modèle de bord invalide s'il a un raccord sur le côté extérieur ou un port sur un coin extérieur.

## D9. Silhouette libre (désaccord avec le brief) : mode réduit
- Au plus 4 tuiles par côté (50 / 12) : toute silhouette est un sous-ensemble de la grille 4×4.
- Pour garder ≥ 7 jonctions de 4 tuiles, 3 formes seulement : moins 1 coin, moins 2 coins, ou moins 1 coin et son bord adjacent est ou ouest.
- Retirer un bord seul laisse un coin à 3 côtés ouverts (aucun modèle) : invalide.
- Jonction de 3 tuiles : **interdite aux villes et aux carrefours** (1 seul port, cul-de-sac).
- Rôle déduit du nombre de voisins vides : 0 → centrale, 1 → bord, 2 adjacents → coin, sinon refus.
- Mode rectangle = **4×4 uniquement** (4×3 ne donne que 6 jonctions).
- Suggestion : présenter le mode libre comme « 4×4 avec 1 à 2 coins retirés ».

## D10. Aimantation de l'écran d'assemblage
- Grille unique au pas de 12 cm pour les deux modes ; tuile aimantée sur la cellule la plus proche (rayon 6 cm).
- Jeton aimanté sur le nœud de jonction le plus proche (rayon 15 mm).
- **Pose de tuile refusée** : hors grille 4×4, cellule occupée, rôle du modèle différent du rôle de la cellule, apparition du mauvais camp, ou (mode libre) tuile non contiguë par un côté entier.
- **Pose de jeton refusée** : moins de 4 tuiles autour, moins de 2 ports, jonction occupée.
- **Alertes sans blocage** : raccords morts, écart entre villes, graphe non connexe.
- Rotation automatique sauf centrales (touche R ou clic). Message court quand un refus est dû au rôle.
- Plateau = { mode, `tuiles: [{modeleId, col, lig, rot}]`, `jetons: [{i, j, type}]` }.

## Cas de test

| # | Situation | Résultat attendu |
|---|---|---|
| T1 | Masque 0x050 (E milieu, S début), rot 1 | 0x280 (S milieu, O début). Après rot 4 : 0x050. |
| T2 | A en (1,1) rot 0, masque 0x008 (E début) ; B en (2,1) rot 0, masque 0x800 (O fin) | a = 1, rev(b) = 1 : connecté. Avec B = 0x200 (O début) : pas de connexion, 2 raccords morts, 2 alertes. |
| T3 | Coin canonique, ports 0b0100 (SE), posé en (3,0) | rot 1 déduite, ports 0b1000 (SO), port compté sur la jonction (3,1). |
| T4 | Silhouette sans la tuile (0,0), jeton posé en (1,1) | Refus : 3 tuiles. ~~1 seul port~~ → corrigé par le sous-agent 1 : 2 ports (apparition (1,0) coin 3 + centrale (1,1) coin 0). |
