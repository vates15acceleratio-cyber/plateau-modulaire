# Plateau modulaire

Outil de conception d'un **plateau de jeu modulaire pour 2 joueurs** : le plateau s'assemble à partir de tuiles carrées et change à chaque partie. L'outil sert à dessiner les tuiles, à assembler des plateaux, à vérifier leurs contraintes et leur équilibre, puis à exporter les tuiles pour l'impression (tuiles en carton rigide, plateau de 48 × 48 cm).

Le périmètre est le **plateau** seulement : pas de règles, pas de tours de jeu, pas de moteur de jeu.

## Utilisation

Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox). Aucune installation, aucun serveur, aucune connexion : tout fonctionne hors ligne, en local.

- **Onglet Plateau** : choisir une tuile dans la bibliothèque (clic, puis clic sur une cellule éclairée ; Échap annule) ou la glisser sur la grille (4×4 ou 5×5, toujours pleine). Un double-clic sur une vignette (ou la touche E) l'ouvre dans l'éditeur. Chaque modèle se pose autant de fois qu'on veut, mais le rôle est respecté : un coin dans un coin, un bord sur le pourtour, une centrale au centre. Un clic droit sur une tuile posée la retire (Ctrl+Z annule). La rotation (touche R) est libre ; une rotation est suggérée pour les bords et les coins. Un clic sur une jonction y pose une ville ; une jonction sans ville est une case chemin. Les compteurs et les alertes sont à droite ; un clic sur une alerte montre l'élément concerné. Un plateau complet très déséquilibré est signalé en erreur.
- **Onglet Tuiles** : créer, dupliquer ou modifier une tuile (cases, chemins, raccords, ports de coin, case d'apparition), avec validation en direct et aperçu des 4 rotations. Seules les contraintes physiques bloquent ; les règles qui garantissent l'écart entre villes sont des alertes.
- **Plateau aléatoire** : génère un plateau valide et équilibré à partir d'une graine reproductible (4×4 : option « jonctions variées » cochée par défaut, 12 placements des deux jonctions sans ville, décochée elles restent dans la rangée centrale ; 5×5 : villes placées d'abord, en 2-3-2, sans case qui desserve deux villes, puis centrales orientées pour ce placement ; moins de 5 % de cases à 2 connexions ; préférence pour la chaîne la plus courte, puis le moins de raccords morts, puis un plateau sans point d'articulation). Le bouton « Placer les villes » pose les 7 villes au meilleur placement permis sur le plateau courant (Ctrl+Z pour revenir). Le rapport d'équilibre donne un score S : alerte dès 5 en 4×4 et dès 7 en 5×5, simple information juste en dessous ; le rythme et l'accès au centre n'y sont jamais des alertes.
- **Rapport d'équilibre** : distances de chaque joueur aux villes, score d'équilibre, partage des villes, goulets.
- **Exporter** : planches A3 (6 tuiles) ou A4 (2 tuiles) avec fond perdu, repères de coupe et barre de contrôle de 100 mm, soit pour les tuiles posées sur le plateau, soit pour un jeu complet dont le nombre d'exemplaires de chaque modèle se règle dans la fenêtre (200 tuiles au plus) ; planche des jetons ; aperçu du plateau. Formats : PDF vectoriel à l'échelle exacte, SVG, PNG 300 dpi.
- **Enregistrer / Ouvrir** : fichier JSON. Sauvegarde automatique dans le navigateur. Annuler / rétablir : Ctrl+Z / Ctrl+Y.

## Principes de conception

- Grille 4×4 de tuiles carrées de 12 cm (environ 58 cases par plateau, cases de 2 cm de diamètre).
- **Grille 5×5 disponible** (« Nouveau → 5×5 ») : tuiles carrées de 10 cm, plateau de 50 × 50 cm, 59 cases par plateau (2 cases par tuile), rangée centrale neutre (ses apparitions ne servent à aucun camp).
- Deux joueurs, **vert** (nord) et **rouge** (sud) : les 2 rangées les plus proches de chaque joueur lui appartiennent.
- **Toutes les tuiles du pourtour** (bords et coins) portent une case d'apparition, imprimée neutre et colorée à l'écran selon le camp. Les coins ont un raccourci vers la tuile de bord voisine.
- **7 villes**, sous forme de jetons posés aux jonctions de 4 tuiles ; les autres jonctions sont des cases chemin. Au moins 3 cases entre deux villes. On s'arrête dans une ville (elle ne se traverse pas).
- **Passages sans case** : un chemin peut relier deux côtés d'une tuile sans passer par une case (virage en quart de tour, T par un pivot) ; il s'imprime en vert, en courbe. Passer par un passage compte pour **un seul déplacement** : les cases qu'il relie sont voisines. Dans l'éditeur de tuiles, l'outil **Passage** (touche P) et les **pivots** (Maj+clic) les dessinent ; au plus un passage par bord ou coin, jamais depuis une case d'apparition ni vers un coin.
- Catalogue 4×4 « organique » de 6 modèles (**24 tuiles à imprimer**) : centrales Q1 (4) et Q2 (3), bords B1 (8) et B8 (3), coins K2 (4) et K4 (2) ; aucune case en impasse. Chaque modèle se pose autant de fois qu'on veut ; le coin se pose dans un coin, le bord sur un bord, la centrale au centre.
- Catalogue 5×5 « très connecté » de 6 modèles (**25 tuiles à imprimer**, de quoi monter chaque plateau généré) : centrales LC1 « Pont et relais » (3), LC2 « Pont et relais décalé » (2), LC3 « Pont et fourche » (3) et LC4 « Deux ponts » (1, deux murs voulus), bord LB2 « Bord à pont » (12), coin LK2 « Coin à porteuse » (4). Deux cases par tuile, trois connexions par case ou plus (moins de 5 % de cases à 2 connexions, information au panneau et au rapport). Règle propre au 5×5 : une case peut porter les deux ports d'un même côté (« porteuse latérale ») ; l'écart de 3 cases entre villes est assuré par leur placement (générateur, bouton « Placer les villes », alerte « villes trop proches »). Les documents 5×5 de la 3.04 et de la 4.00.0 s'ouvrent avec la proposition du nouveau catalogue ; avec leurs anciennes tuiles, le générateur 5×5 explique qu'il faut le nouveau catalogue.
- **Poids et exemplaires** : les exemplaires d'un modèle sont le stock à imprimer ; son **poids** (facultatif, entier de 1 à 999, absent : les exemplaires) règle sa fréquence dans les plateaux aléatoires. Modifier les exemplaires d'un modèle du catalogue livré ne change donc pas sa fréquence de tirage (seule l'infobulle du champ le dit). Un poids invalide est signalé en alerte et le tirage retombe sur les exemplaires.
- **Nouveau catalogue proposé** : à l'ouverture d'un document (fichier ou sauvegarde automatique) qui porte encore le catalogue de la version 3.04 ou de la version 1, l'application propose le nouveau catalogue ; « Garder mes tuiles » laisse le document tel quel, « Charger » remplace la bibliothèque et vide le plateau (Ctrl+Z revient en arrière).
- **Fichiers** : un document dont un modèle a des passages ou des pivots s'enregistre en version 3 du format ; la version 3.04 le refuse avec un message clair (« Version de fichier absente ou inconnue : 3. »). Les fichiers des versions 1 et 2 s'ouvrent toujours.
- Équilibre mesuré depuis les cases d'apparition de chaque camp : blocage si « 5 villes contre 2 » ou écart de plus de 3 cases entre joueurs ; alerte au-delà de 2 cases d'écart ou si le score d'équilibre S atteint 5 en 4×4 et 7 en 5×5 (information à 4 en 4×4, à 5 ou 6 en 5×5). Le générateur rejette S ≥ 5 en 5×5 seulement ; en 4×4 il classe les candidats par S.
- Couleurs d'impression : vert, rouge, noir, blanc, avec des codes de forme lisibles sans la couleur.

Les décisions et leurs raisons sont dans [`docs/`](docs/) : le brief d'origine (`0-brief.md`), les décisions de la version 2 (`18-decisions-v2.md`, prioritaires), l’historique de la version 1 (synthèse, avis de conception, mesures, revues) dans `docs/archives/`.

## Structure

```
index.html        page de l'application
src/              modules JavaScript (sans dépendance, sans modules ES)
styles/           feuilles de style
tests/            tests Node (node:test)
outils/           recettes navigateur, pages d’essai, mesures d’équilibre, serveur local de test
docs/             décisions et références en vigueur (v2) ; docs/archives/ : historique de la version 1
```

## Tests

Avec Node.js (version 20 ou plus), depuis la racine :

```
node --test
```

Les pages `outils/recette-interface.html` et `outils/recette-p2.html` jouent des parcours complets dans le navigateur et affichent leur bilan. Pour tester dans un navigateur par HTTP plutôt qu'en `file://` : `node outils/serveur.js 8765`, puis http://127.0.0.1:8765/.

## État

Version 4.00.0 : catalogues organiques 4×4 (24 tuiles) et 5×5 (37 tuiles) avec passages sans case (un passage compte pour un déplacement), générateur 4×4 et 5×5, seuils d'équilibre par format (score S : alerte à 5 en 4×4, à 7 en 5×5). Les documents 3.04 s'ouvrent avec la proposition du nouveau catalogue ; les documents à passages s'enregistrent en version 3, que la 3.04 refuse. Restent à valider en conditions réelles : une impression et la mesure de la barre de 100 mm à la règle, l'usage au doigt sur tablette, et l'équilibre ressenti en parties réelles.

## Droits

Tous droits réservés. Le code est visible publiquement, mais aucune licence de réutilisation n'est accordée.
