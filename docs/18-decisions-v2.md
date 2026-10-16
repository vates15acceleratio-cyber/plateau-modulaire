# Décisions de la version 2 (utilisateur), 2026-10-15

> **Ce document prime sur tous les précédents** (brief, synthèse `archives/3-synthese.md`, avis) là où ils se contredisent. Il décrit ce que l'utilisateur a demandé après avoir utilisé la version 1.00.0.

## Formats de grille
- **Grilles toujours pleines** : le choix « 4×4 avec coins ou bords retirés » est **supprimé**.
- **Trois formats**, choisis à la création du projet (un document = un format) :
  1. **4×4 carré** (format actuel, tuiles de 12 cm) ;
  2. **5×5 carré** (tuiles de 10 cm au plus, pour tenir dans 50 × 50 cm) ;
  3. **Hexagonal** : plateau en grand hexagone, **réalisé en dernier**. Les camps sont les **3 côtés de l'hexagone les plus proches** de chaque joueur.
- Chaque format a son propre catalogue de tuiles.

## Joueurs, camps et apparitions
- Les joueurs sont **vert** et **rouge** (vert au nord, rouge au sud sur les grilles carrées).
- **Plus de tuile ni de catégorie « apparition »**. **Toutes les tuiles du pourtour** (bords et coins) portent **une case d'apparition** qui permet de faire apparaître un groupe.
- **Propriété des cases d'apparition selon la position** :
  - 4×4 : les **2 rangées les plus proches** de chaque joueur lui appartiennent (rangées 0 et 1 au vert, 2 et 3 au rouge) ;
  - 5×5 : 2 rangées par joueur ; la **rangée centrale est neutre** (ses cases d'apparition ne servent à personne).
- **Impression** : la case d'apparition est imprimée **neutre** (symbole noir et blanc) ; une même tuile de bord peut aller d'un côté ou de l'autre. **À l'écran**, elle s'affiche en **vert ou rouge** selon le camp de sa position (neutre au centre en 5×5).

## Jonctions et villes
- **Une jonction (coin commun à 4 tuiles) n'est jamais vide** : soit une **ville** (jeton), soit une **case chemin** — une vraie case, où un pion peut s'arrêter, qui compte dans les distances. Le jeton « carrefour » disparaît : toute jonction sans ville est une case chemin.
- **7 villes** sur tous les formats.
- **Au moins 3 cases entre deux villes** (4 pas ; auparavant 2 cases). Si un plateau ne le respecte pas : **alerte, sans blocage** ; le générateur ne produit jamais ce cas.

## Pose des tuiles sur le plateau
- **Plus de liberté** : les rôles imposés par la position disparaissent autant que possible (une tuile de bord peut prendre la place d'une autre tuile de bord, les coins aussi, etc.).
- **Seul blocage** : un plateau **très déséquilibré** pour les joueurs. Proposition retenue : bloquer seulement en cas de « 5 villes contre 2 » ou d'un écart de plus de 3 cases entre joueurs (critère à préciser par l'advisor design de jeu) ; le reste reste en alerte.

## Coins
- Les coins actuels sont **trop loin de l'action**. Ils deviennent des **coins d'apparition** (ils portent une case d'apparition, comme tous les bords) et doivent devenir utiles : piste « **raccourci** » (à concevoir par l'advisor design de jeu : chemin rapide vers le jeu central).

## Création des tuiles : plus de liberté
- **Supprimés comme obligations** : les chemins de coin obligatoires ; le nombre de cases imposé par rôle.
- **Autorisé** : des cases dont les chemins **ne se croisent pas** dans la tuile (plusieurs réseaux séparés sur une même tuile).
- **Garder un minimum pour rester modulaire** : positions de raccord standardisées sur les côtés, contraintes physiques (tuile dans son carré, marges de coupe, pas de chevauchement), cases reliées à quelque chose. Le détail est à proposer par l'advisor géométrie.

## Ordre de réalisation
1. Règles de la version 2 sur le **4×4** (points ci-dessus).
2. Format **5×5**.
3. Format **hexagonal** : **en attente du feu vert de l'utilisateur. Aucun travail dessus, pas même de préparation** (la section D6 / F de `20-avis-geometrie-v2.md` est mise de côté).

## Réponses de l'utilisateur à l'avis design v2 (`19-avis-design-v2.md`)
- **5×5, « 4 contre 3 » structurel** : accepté, compensé par les distances (pas d'alerte) ; le générateur cherche à rendre la 7e ville équidistante.
- **La case d'apparition est une vraie case** : elle compte dans les distances.
- **Villes non traversables** : c'est la **règle du jeu** (on s'arrête dans une ville). L'option « traversables » peut disparaître de l'interface.
- **Nombre de cases** : **≈ 75 pour le 5×5** (au lieu de 80 à 90), **≈ 60 pour le 4×4** (confirmé).
- **Conséquences arbitrées par l'orchestrateur** (détail dans `20-avis-geometrie-v2.md`) : les règles qui garantissent l'écart entre villes (R1 à R4) sont des **alertes** dans l'éditeur, pas des blocages ; un plateau **complet** très déséquilibré est une **erreur** (pose toujours permise, export de l'aperçu refusé).

## Réponses de l'utilisateur aux mesures du catalogue 4×4 v2 (`21-mesures-catalogue-v2.md`)
- **Anneau du pourtour** (raccourcis qui relient toutes les apparitions, contact vert / rouge en 1 pas sur les flancs) : **accepté**, aucun changement.
- **Tempo** (première ville à 2 pas, 5,7 villes sur 7 à 3 pas au plus) : **voulu**, aucun changement.

## Retours de l'utilisateur après essai du plateau 4×4 (2026-10-16)
- **Poses illimitées** : chaque modèle peut être posé autant de fois qu'on veut ; le compteur « ×N restants » disparaît de la bibliothèque. Les exemplaires ne servent plus qu'à l'**impression** (l'export imprime les tuiles posées, ou un nombre d'exemplaires choisi dans sa fenêtre) et au **générateur**, qui peut réutiliser un modèle **en favorisant la variété**.
- **Bibliothèque** : plus large, tuiles sur plusieurs colonnes, catégories bien visibles. **Clic = armer la pose** (puis clic sur une cellule ; le glisser-déposer reste), **double-clic = ouvrir dans l'éditeur**. Le bouton « Poser » disparaît.
- **Clic droit sur une tuile posée = la retirer** (annulable).
- **Rôle respecté à la pose** : coin dans un coin, bord sur un bord, centrale au centre (refus expliqué). Remplace la « pose libre » des décisions précédentes.
- **Coins** : **K1 et K3 retirés** ; K2 est le bon modèle (2 cases avant la ville la plus proche, déplacement rapide le long du bord) : chercher d'autres coins du même esprit, sinon garder K2 seul.
- **Plus de poches** (case en impasse) dans les tuiles du catalogue (4×4 et 5×5) ; l'éditeur signale une poche par une alerte. B4 (« bord en fourche ») est à revoir.
- **Autre poste** : tout est envoyé sur GitHub, avec un `CLAUDE.md` qui résume la méthode et où trouver les décisions.
- **Cases par plateau 4×4 : ≈ 63 accepté** (effet du tirage avec répétition ; plus de retour vers 60).

## Point d'arrêt du 2026-10-16
- **Pause** à la demande de l'utilisateur ; reprise après discussion.
- **Suppression des tuiles utilisateur** (avec confirmation) et **légende « Commandes » illustrée** (souris et touches dessinées, à droite du plateau à partir de 1600 px de large) ajoutées.
- **Idée nouvelle, non définie : les régions thématiques** (une tuile représente une région ; une région a une thématique, ex. C3 = Montagne) : à étudier avec l'utilisateur. Questions préparées dans `docs/25-travail-restant.md`.
