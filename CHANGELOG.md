# Journal des modifications

## [2.00.0] - 2026-10-16

Majeure

Règles de la version 2 sur la grille 4×4 : grilles toujours pleines, cases d'apparition sur tout le pourtour, jonctions sans ville comptées comme cases, tuiles et pose libres, nouveau catalogue de 22 tuiles. Le changement des règles du jeu et de la structure des documents n'est pas compatible avec la version 1.x sans conversion : un document de la 1.x se rouvre converti, avec une phrase qui le signale. Le niveau majeure vient de cette rupture de compatibilité et du changement de règles. Ouvrir `README.md` pour la marche à suivre.

### Ajouté
- Formats de grille paramétrés (4×4 et 5×5) dans le code (`src/geometrie.js`, `src/modele.js`) ; le catalogue et l'interface du 5×5 restent à faire.
- Cases d'apparition sur tout le pourtour (bords et coins), colorées vert ou rouge à l'écran selon le camp de leur position ; imprimées en neutre.
- Jonctions-cases : une jonction sans ville est une case chemin, qui compte dans les distances.
- Raccourcis de coin : depuis la case d'apparition d'un coin, un raccord mène à la tuile de bord voisine.
- Catalogue 4×4 v2 de 22 tuiles (14 modèles, environ 60 cases par plateau) dans `src/catalogue.js`.
- Règles physiques des tuiles dans l'éditeur : chemins, marges de coupe, zone de coin, chevauchement et case isolée bloquent l'enregistrement de la tuile.
- Conversion des documents de la version 1 à l'ouverture, avec une phrase d'information ; proposition au démarrage de charger le nouveau catalogue.
- Mesures du catalogue v2 : `outils/mesures-equilibre.js` et `docs/21-mesures-catalogue-v2.md`.

### Modifié
- Tuiles et pose libres : les rôles imposés par la position disparaissent autant que possible ; une tuile de bord peut prendre la place d'une autre, et la rotation est libre (seulement suggérée sur le pourtour).
- Les règles R1 à R4, qui garantissent l'écart entre villes, sont signalées en alertes et ne bloquent plus la pose.
- Au moins 3 cases entre deux villes (4 pas), au lieu de 2.
- Villes non traversables : c'est la règle du jeu, on s'arrête dans une ville.
- Seuils d'équilibre : blocage si « 5 villes contre 2 » ou écart de plus de 3 cases entre joueurs, avec un plateau complet concerné qui devient une erreur (l'export de l'aperçu est refusé) ; alertes si écart de plus de 2 cases ou score S d'au moins 5.
- Générateur : les jonctions-cases sont placées par défaut sur la rangée centrale (aucun « 5 villes contre 2 » mesuré) ; option « jonctions variées ».

### Supprimé
- Formes réduites du plateau : la grille est toujours pleine.
- Jeton carrefour : une jonction sans ville devient une case chemin ; un document de la version 1 perd ses carrefours à l'ouverture.
- Tuiles et rôle « apparition » : la case d'apparition devient une case normale de la tuile.
- Rotation imposée par le rôle de la tuile.
- Option « villes traversables » de l'interface.

### Corrigé
- Case d'apparition : le carré dessiné ne dépasse plus du disque.
- Case d'apparition sans joueur : le liseré n'est plus imprimé en vert.

### Limites connues
- Format 5×5 à venir : catalogue et interface restent à faire, et ses seuils d'équilibre sont provisoires.
- Hexagonal en attente du feu vert de l'utilisateur ; aucun travail engagé.
- Impression réelle et mesure de la barre de 100 mm à la règle non faites.
- Audit de sécurité dédié à la version 2 à faire.

## [1.00.0] - 2026-10-15

Majeure

Export pour impression, rapport d'équilibre et générateur de plateau aléatoire : trois capacités nouvelles ajoutées ensemble. Le niveau majeure vient de cette addition (règle « plusieurs capacités liées d'un coup »). Ouvrir `README.md` pour la marche à suivre.

### Ajouté
- Export pour impression : planches A3 et A4 avec jetons et aperçu, en PDF vectoriel (écrit sans bibliothèque externe), en SVG et en PNG 300 dpi (`src/export.js`, `styles/export.css`).
- Graphe et rapport d'équilibre (`src/graphe.js`, `src/equilibre.js`) : score S, écart entre joueurs sur 7 rangs, alerte « 5 contre 2 » (villes non traversables par défaut).
- Générateur de plateau aléatoire (`src/generateur.js`) : graine reproductible, option « carrefours variés ». Plafond de 200 tuiles pour l'export et le générateur.
- Mesures d'équilibre et du générateur (`outils/mesures-equilibre.js`, `outils/mesures-generateur.js`) ; documentation dans `docs/12-mesures-equilibre.md` et `docs/15-mesures-generateur.md`.
- Boîte de dialogue commune pour les trois nouveaux outils.
- Recette `outils/recette-p2.html` et `tests/recette-p2.test.js`.
- `README.md` : présentation, lancement et tests de la version.

### Modifié
- Critère d'équilibre de l'advisor (`docs/16-avis-mesures-equilibre.md`) appliqué au rapport, aux contrôles et au générateur.
- Règle des camps de carrefours unique (`PM.modele.campJonction`), au lieu de trois copies dans les contrôles, l'assemblage et le générateur.
- Tests du catalogue (`tests/catalogue.test.js`) reposent sur `PM.graphe`.

### Corrigé
- Fichier de plus de 5 Mo refusé à l'ouverture ; nombres, tableaux et textes bornés (correctif de sécurité, voir ci-dessous).
- Serveur de test (`outils/serveur.js`) durci : URL mal encodée refusée au lieu de planter, dossiers `.git` et `.claude` non servis.
- Marqueur de découpe PDF : un identifiant piégé ne peut plus casser l'export ni s'imprimer mal.
- URL d'aperçu libérée après usage (fuite de mémoire).
- Page de recette : ne touche plus à la sauvegarde automatique de l'utilisateur.
- Fonctions pures robustes aux entrées nulles, au lieu de lever une erreur native.
- Sécurité : l'audit de l'agent sécurité (`docs/13-audit-securite.md`) couvrait la version 0.03.0. Les nouveaux modules (export, équilibre, générateur) ont été vérifiés par la relecture (`docs/17-revue-p2.md`, point 3) : injection dans les SVG et PDF, échappement PDF, absence de métadonnées et de ressources externes. Un audit dédié reste à faire.

### Limites connues
- Impression réelle et mesure de la barre de 100 mm à la règle non faites.
- PNG A3 au-delà de la limite de canvas de Safari iOS.
- Politique CSP non encore ajoutée.
- Tolérance du générateur à trancher.
- Règle « villes traversables » à décider en parties réelles.

## [0.03.0] - 2026-10-15

Mineure

Première version utilisable de l'interface : ouvrir `index.html` dans le navigateur.

### Ajouté
- Page `index.html` avec deux onglets : Plateau et Tuiles.
- Socle de l'interface : état partagé (`src/etat.js`) avec annuler et rétablir sur 100 niveaux, application (`src/app.js`), dessin SVG des tuiles et des jetons (`src/rendu.js`).
- Éditeur de tuile (`src/editeur-tuile.js`) : création (choix du rôle), duplication et modification des modèles.
- Bibliothèque de modèles et plateau d'assemblage (`src/bibliotheque.js`, `src/assemblage.js`) : glisser-déposer ou deux clics, rotations, jetons, formes réduites du plateau.
- Compteurs et alertes (`src/controles.js`), avec pastille dans la barre du haut.
- Sauvegarde : fichier JSON à télécharger et à ouvrir, et sauvegarde automatique dans le navigateur (`src/sauvegarde.js`).
- Recettes : `tests/recette-interface.test.js` et `outils/recette-interface.html`.
- Pages d'essai par module (`outils/essai-*.html`) et serveur local de test (`outils/serveur.js`).

### Modifié
- Catalogue (`src/catalogue.js`) retouché après la validation de l'advisor design de jeu : raccords morts en moyenne 0,69, au maximum 1 (seul le mur voulu de C6).

### Corrigé
- Fichier JSON piégé : les coordonnées non numériques sont écartées à l'ouverture, pour qu'un fichier ne puisse pas injecter de balisage dans l'interface (correctif de sécurité).
- « Ouvrir » est annulable : le document précédent reste dans l'historique.
- Sauvegarde automatique indisponible ou illisible : signalée dans la barre d'état au lieu d'échouer en silence.
- Règle des carrefours unifiée : une seule règle « même camp de joueur » pour l'assemblage et les contrôles.
- Modèle incomplet glissé sur le plateau : le refus est expliqué dans la barre d'état.
- Action au résultat invalide : un message s'affiche dans la barre d'état.
- Écran étroit : le plateau occupe toute la largeur et les cibles tactiles font 44 px.

### Limites connues
- Pas encore faits : export pour impression, plateau aléatoire, rapport d'équilibre.
- Deux limites mineures de robustesse, avec tests `todo` : quelques fonctions pures lèvent une erreur native sur des entrées nulles que l'interface ne produit pas.
- Non vérifié : ressenti souris et tactile, vrai téléphone, boîte de dialogue de fichier réelle.
- Les cases du catalogue ne sont pas toutes sur la grille de 1 cm de l'éditeur : la première modification d'une case la recale de quelques millimètres.

## [0.02.0] - 2026-10-15

### Ajouté
- Catalogue réel des tuiles (`src/catalogue.js`) : 18 modèles, 20 tuiles (6 centrales, 5 coins, 5 bords neutres, 2 modèles d'apparition en double), tous valides.
- Tests du catalogue (`tests/catalogue.test.js`) avec simulation de 1000 plateaux 4×4 aléatoires : connexité, écart entre villes, 50 cases de déplacement, raccords morts, équilibre.
- `docs/8-catalogue.md` : description des modèles et mesures de la simulation.

## [0.01.0] - 2026-10-15

Première version

### Ajouté
- Décisions de conception consignées dans `docs/` : brief, avis des advisors (design de jeu, dont la variante « jonctions », géométrie, ergonomie, prépresse), synthèse, architecture et revue du module 1.
- Architecture retenue : page unique hors ligne, ouverte en `file://`, sans modules ES ni dépendance à l'exécution, un espace de noms global `PM`, tests sous Node.
- Module 1 « modèle de données » :
  - `src/geometrie.js` : constantes en millimètres, côtés et coins, masques de raccords et de ports de coin, rotation, appariement des côtés.
  - `src/modele.js` : tuiles, cases, chemins, jetons, plateau et forme, avec validation (`validerModele`, `validerForme`, `validerPlateau`).
- Fonctions de modification du document, pures (elles renvoient un nouveau document sans modifier l'entrée) : pose et rotation de tuile, pose de jeton, contrôle préalable à la pose, changement de forme, gestion de la bibliothèque de modèles (ajout, remplacement, suppression, nombre d'exemplaires).
- Contrôles du plateau : jetons invalides (`jetonsInvalides`), ports de coin morts (`portsCoinMorts`), raccords morts avec la raison (absent, vide ou mort), revalidation d'une tuile posée (`verifierTuilePosee`).
- Référence structurée `{type, id}` pour désigner un modèle, une case, un chemin, un coin ou un raccord.
- Règle de coin : deux cases ne peuvent pas aboutir au même coin (`coin_double`). Zone de coin : distance coin–centre au moins égale à 35 mm pour un jeton de 30 mm.
- Exemples de modèles en lecture seule (copie via `copieExemples()`), génération d'identifiants (`nouvelId`).
- Tests : 225 tests (`node --test`), répartis entre `tests/geometrie.test.js`, `tests/modele.test.js` et la recette du testeur `tests/recette-modele.test.js`.
- Outil `outils/verif-chargement.html` : vérifie que les fichiers de `src/` se chargent par `<script src>` en `file://` et affiche la validation des modèles d'exemple.

### Corrigé
- Rotation d'une tuile avec un nombre de quarts de tour non entier : la rotation est refusée au lieu de corrompre l'orientation de la tuile.
- Validation d'un modèle ou d'une forme contenant une case ou un retrait vide (`null`) : une erreur est renvoyée au lieu d'une exception.
- Validation d'un modèle dont le rôle s'appelle `constructor` ou `__proto__` : plus d'exception.
- Identifiants nommés `constructor`, `toString`, etc. : plus de fausse signalisation d'identifiant en double.
- Copie d'un document absent (`undefined`) : plus d'exception.
- Message d'erreur trompeur pour une centrale retirée : corrigé.
