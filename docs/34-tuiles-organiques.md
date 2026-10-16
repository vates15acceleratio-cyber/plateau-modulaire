# Cahier des charges : tuiles « organiques » (orchestrateur), 2026-10-16

Statut : **projet d'étude**, soumis aux advisors géométrie et design de jeu avant toute production. Sources : `18-decisions-v2.md` (dont « Orientation après essai du 5×5 »), `24-catalogue-5x5.md` § 8, `28`, `29`, `33`, catalogues de `src/catalogue.js`.

## 1. Constat et intention
- Le 5×5 actuel ressemble à un **quadrillage**. Toutes ses centrales (C7, C8) ont 4 raccords au milieu des côtés, reliés au relais central. Posées côte à côte, elles forment des lignes droites qui traversent le plateau. Les diagonales vers les jonctions se voient moins.
- **Cause :** la règle « côté qui regarde une centrale : raccord au milieu seulement ». Une centrale tourne librement, et seul le milieu d'un côté retrouve toujours son vis-à-vis.
- **Intention de l'utilisateur :** des routes qui **tournent** (virages), qui **bifurquent** (T), des **tuiles coupées en deux réseaux** (comme C3 « Deux ponts » du 4×4, apprécié) et, si possible, des tracés **coudés ou courbes**. L'inspiration est Carcassonne, où une tuile ne se pose que si ses bords correspondent à ceux de ses voisines.
- **Refusé :** des chemins qui se croisent sans se rejoindre (ponts).
- **Observé sur un plateau 5×5 (essai de l'utilisateur) :**
  - des jonctions dont tous les ports viennent du même côté (cul-de-sac) ;
  - une jonction à un seul port (impasse) ;
  - des villes à 2 accès.

## 2. Ce qui reste fixe
- Cases Ø 20, chemins de 8 mm, R1 à R4, aucune poche par tuile.
- Ports aux coins intérieurs ; apparitions et raccourcis du pourtour ; K2 seul en coin.
- Décisions du 5×5 :
  - ≈ 75 à 78 cases ;
  - au moins 39 ports pour garantir ≥ 2 ports par jonction et ≥ 3 aux villes ;
  - villes en 2-3-2.
- Positions des raccords 30 / 50 / 70 mm ; le milieu reste la seule position compatible avec une rotation libre.
- Grille toujours pleine.

## 3. Mécanismes à étudier
- **M1, raccords partiels et appariement des bords.**
  - Une centrale n'a plus forcément 4 raccords :
    - 2 côtés voisins : virage ;
    - 2 côtés opposés : ligne droite ;
    - 3 côtés : T ;
    - voire 1 côté.
  - Chaque côté de tuile devient « avec raccord » ou « sans raccord ». Deux tuiles voisines doivent avoir le **même type** de côté face à face (Carcassonne) :
    - avec contre avec : chemin continu ;
    - sans contre sans : un « mur » commun, sans raccord mort.
  - Le **générateur** choisit tuiles et rotations pour que tous les bords concordent.
  - En **pose à la main**, l'alerte « raccord mort », qui existe déjà, guide le joueur.
  - Questions :
    - le pourtour (bords et coins) et ses raccords S doivent-ils suivre la même logique ?
    - un raccord mort reste-t-il une simple alerte ou devient-il un refus de pose ?
- **M2, tuiles à deux réseaux** (esprit C3). Deux réseaux indépendants sur la même tuile, par exemple un virage N-E et un virage S-O, chacun avec son port vers « son » coin.
  - **Contrainte de densité :** R3 interdit un raccord sur une case porteuse. Chaque réseau qui porte à la fois un raccord et un port demande donc 2 cases (relais + porteuse). Une tuile à deux réseaux complets compte 4 cases, contre 3 pour C7 / C8.
- **M3, tracés coudés ou courbes.**
  - Aujourd'hui, un chemin est une amorce plus un segment droit (`geometrie.tracesModele`).
  - Piste : des **points de passage** facultatifs par chemin (polyligne), ou des courbes approchées par des polylignes. La validation (8 mm, r + 4, zones de coin), le rendu, l'export, l'éditeur et la sauvegarde travaillent déjà sur des polylignes.
  - Changement de modèle de données : le format des documents est à préserver (champ facultatif).
- **M4, règle de jonction « au moins 2 côtés ».** Une jonction-case ou une ville doit être reliée par des ports venant d'au moins 2 tuiles **non situées du même côté** de la jonction, contre le cul-de-sac observé. Cette règle est-elle tenable et utile ?

## 4. Portée
- **D'abord le 5×5.** Le 4×4 sera retouché ensuite pour l'harmonie (à confirmer avec l'utilisateur), en gardant ses formes appréciées (C3).
- Le générateur 5×5 en attente (`docs/25` § 1.2) devra intégrer M1 et M4. Ce chantier le précède ou le remplace.

## 5. Questions aux advisors
**Géométrie (Opus)**
1. Faisabilité, dans 100 mm avec des cases Ø 20, de 6 à 10 centrales organiques (virage, droite, T, deux réseaux) en respectant R1 à R4, 8 mm entre chemins, r + 4 et les zones de coin. Coordonnées vérifiées par calcul, nombre de cases et de ports pour chacune.
2. M3 : quel modèle de données pour les tracés coudés ou courbes ? Points de passage, arcs ? Impact sur la validation, le rendu et l'export, et compatibilité des documents.
3. M1 : avec des raccords au milieu seulement, combien de « signatures de bords » distinctes, et combien de rotations utiles par tuile ? Le pourtour peut-il s'y conformer, notamment les raccords S des bords et les raccourcis ?
4. Budget de ports : quelles combinaisons de centrales organiques tiennent au moins 39 ports à 75–78 cases (rappel : cases = 72 + nB1 et ports = 34 + nB1 avec 9 centrales à 3 cases et 2 ports ; `docs/33`) ?

**Design de jeu (Opus)**
1. Les raccords partiels avec appariement gardent-ils un plateau connexe et équilibré ? Quelles proportions de virages, de T et de droites conseiller ?
2. M4 : la règle « au moins 2 côtés » est-elle souhaitable ? Quel effet sur les villes et le tempo ?
3. Des routes coudées allongent les distances : effet sur le tempo, déjà plus lent en 5×5, et sur l'anneau du pourtour ?
4. Appariement façon Carcassonne : seulement une contrainte du générateur, ou aussi un **refus de pose** en mode manuel ? (La décision reviendra à l'utilisateur.)
5. Le générateur reste-t-il faisable (contraintes combinées : appariement, ports, 5 ou 6 B1, villes 2-3-2) ?

## 6. Suite
1. Avis des deux advisors, consignés dans `docs/`.
2. **Croquis** des centrales proposées, montrés à l'utilisateur avant tout code.
3. Décisions de l'utilisateur, puis production (modèle de données si M3, catalogue, générateur), testeur, relecteur, versionneur.
