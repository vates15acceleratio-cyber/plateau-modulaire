# Lot 6 : interface et sauvegarde pour `'hex19'` (producteur, Sonnet 5.5), 2026-10-19

Rapport du producteur, consigné et condensé par l'orchestrateur.

**Résultats :**
- `node --test` : 906 tests, 899 OK, 0 échec, 7 PDF ignorés (vérifié par l'orchestrateur) ;
- recettes navigateur : `recette-interface` 420 OK, `recette-p2` 125 OK, 0 échec ;
- capture de l'application : `docs/croquis/hexagonal/production/application-hex.png`.

## Changements
1. **Sauvegarde**
   - Lit la grille `hex19` et accepte les jetons `{i: 0..23, j: 0}`.
   - Un document hexagonal est **toujours écrit en version 3**, même sans passage, pour qu'une version ancienne le refuse.
   - Un contenu hostile ou hors limites est signalé par une alerte, jamais par une exception.
2. **« Nouveau »** : choix entre 4×4, 5×5 et **Hexagonal (19 tuiles)** (49,9 × 43,2 cm). `PM.geometrie.FORMATS` contient maintenant `hex19`, et `FORMATS_TOUS` en est l'alias.
3. **Plateau**
   - Grille de 19 cellules à bord droit et 24 sièges, avec les camps et la rangée neutre.
   - Pose par clic ou par glisser, rotation de 60° (touche R), retrait par clic droit.
   - Un clic sur un siège bascule entre ville et campement.
   - Alerte `rotation_pourtour`. Un bord ou un coin déplacé prend la rotation imposée de sa nouvelle place (choix du producteur).
4. **Éditeur de tuile**
   - Canevas centré sur la forme, aimantation dans la forme.
   - 6 raccords et 6 coins, pivots, aperçu des 6 rotations.
   - Les règles hexagonales s'affichent dans la validation.
5. **Bibliothèque** : vignettes hexagonales.
6. **Contrôles et équilibre**
   - Nouveaux libellés : `rotation_pourtour`, `coin_non_porte`, « 4 villes contre 2 ».
   - `trop_de_villes` n'est affiché qu'une fois.
   - Compteurs hexagonaux (cible de 56 cases), explication de l'équilibre à 6 villes.
7. **« Orienter les tuiles »** (décision de l'utilisateur)
   - `PM.generateur.orienterTuiles` (fonction pure) et `orienter` (version de l'interface) réutilisent `rechercherPoseHex`. Le pourtour reste fixe.
   - Le S minimal est garanti sur un plateau complet, ou à défaut le moins de tuiles tournées.
   - Une seule étape annulable (Ctrl+Z, Ctrl+Y). En cas d'échec, le refus est expliqué en une phrase.
   - Le bouton n'apparaît qu'en hexagonal. Pire cas mesuré : 0,6 s.
8. **Générateur** : rejet des plateaux à S ≥ 3 en hexagonal (`SEUIL_REJET_S_HEX`).
9. **Tests**
   - Nouveau fichier `tests/interface-hex.test.js` (48 tests).
   - Nouvelle étape `s12_hexagonal` dans la recette navigateur. Elle passe par Nouveau, la pose, la rotation, les alertes, le plateau aléatoire, Orienter, Placer les villes, l'export, la sauvegarde et l'éditeur.

## Points restants
- Le message `ville_peu_de_ports` (`graphe.js`) affiche encore « (i, j) » en hexagonal.
- `src/aide.js` n'est pas encore adapté.
- `docs/10` reste à compléter : `FORMATS` contient `hex19`, la version 3 s'applique à l'hexagonal, et `orienterTuiles` / `orienter` sont à décrire.
