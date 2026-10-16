# Plateau modulaire

Outil de conception d'un **plateau de jeu modulaire pour 2 joueurs** : le plateau s'assemble à partir de tuiles carrées et change à chaque partie. L'outil sert à dessiner les tuiles, à assembler des plateaux, à vérifier leurs contraintes et leur équilibre, puis à exporter les tuiles pour l'impression (tuiles en carton rigide, plateau de 48 × 48 cm).

Le périmètre est le **plateau** seulement : pas de règles, pas de tours de jeu, pas de moteur de jeu.

## Utilisation

Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox). Aucune installation, aucun serveur, aucune connexion : tout fonctionne hors ligne, en local.

- **Onglet Plateau** : choisir une tuile dans la bibliothèque (clic, puis clic sur une cellule éclairée ; Échap annule) ou la glisser sur la grille (4×4 ou 5×5, toujours pleine). Un double-clic sur une vignette (ou la touche E) l'ouvre dans l'éditeur. Chaque modèle se pose autant de fois qu'on veut, mais le rôle est respecté : un coin dans un coin, un bord sur le pourtour, une centrale au centre. Un clic droit sur une tuile posée la retire (Ctrl+Z annule). La rotation (touche R) est libre ; une rotation est suggérée pour les bords et les coins. Un clic sur une jonction y pose une ville ; une jonction sans ville est une case chemin. Les compteurs et les alertes sont à droite ; un clic sur une alerte montre l'élément concerné. Un plateau complet très déséquilibré est signalé en erreur.
- **Onglet Tuiles** : créer, dupliquer ou modifier une tuile (cases, chemins, raccords, ports de coin, case d'apparition), avec validation en direct et aperçu des 4 rotations. Seules les contraintes physiques bloquent ; les règles qui garantissent l'écart entre villes sont des alertes.
- **Plateau aléatoire** : génère un plateau valide et équilibré à partir d'une graine reproductible (jonctions sans ville dans la rangée centrale par défaut, option « jonctions variées »). **En 5×5, le générateur est provisoire** : villes tirées librement, centrales tournées au hasard, jonctions souvent mal reliées (l'alerte « jonction_ports » apparaît presque toujours) ; il ne tient pas encore les garanties décidées (voir `docs/25-travail-restant.md`).
- **Rapport d'équilibre** : distances de chaque joueur aux villes, score d'équilibre, partage des villes, goulets.
- **Exporter** : planches A3 (6 tuiles) ou A4 (2 tuiles) avec fond perdu, repères de coupe et barre de contrôle de 100 mm, soit pour les tuiles posées sur le plateau, soit pour un jeu complet dont le nombre d'exemplaires de chaque modèle se règle dans la fenêtre (200 tuiles au plus) ; planche des jetons ; aperçu du plateau. Formats : PDF vectoriel à l'échelle exacte, SVG, PNG 300 dpi.
- **Enregistrer / Ouvrir** : fichier JSON. Sauvegarde automatique dans le navigateur. Annuler / rétablir : Ctrl+Z / Ctrl+Y.

## Principes de conception

- Grille 4×4 de tuiles carrées de 12 cm (environ 60 à 63 cases par plateau, cases de 2 cm de diamètre).
- **Grille 5×5 disponible** (« Nouveau → 5×5 ») : tuiles carrées de 10 cm, plateau de 50 × 50 cm, environ 78 cases par plateau avec la pose de référence, rangée centrale neutre (ses apparitions ne servent à aucun camp).
- Deux joueurs, **vert** (nord) et **rouge** (sud) : les 2 rangées les plus proches de chaque joueur lui appartiennent.
- **Toutes les tuiles du pourtour** (bords et coins) portent une case d'apparition, imprimée neutre et colorée à l'écran selon le camp. Les coins ont un raccourci vers la tuile de bord voisine.
- **7 villes**, sous forme de jetons posés aux jonctions de 4 tuiles ; les autres jonctions sont des cases chemin. Au moins 3 cases entre deux villes. On s'arrête dans une ville (elle ne se traverse pas).
- Catalogue 4×4 de 13 modèles (22 tuiles à imprimer) : 6 centrales, 5 modèles de bord, 2 modèles de coin (K2, K4) ; aucune case en impasse. Chaque modèle se pose autant de fois qu'on veut ; le coin se pose dans un coin, le bord sur un bord, la centrale au centre.
- Catalogue 5×5 de 6 modèles (30 tuiles à imprimer) : coin K2 (5), bords B1 (6), B7 (4) et son miroir B7m (4), centrales C7 « Pont » (6) et C8 « Équerre » (5) ; aucune case en impasse ni mur.
- Équilibre mesuré depuis les cases d'apparition de chaque camp : blocage si « 5 villes contre 2 » ou écart de plus de 3 cases entre joueurs ; alerte au-delà de 2 cases d'écart ou si le score d'équilibre atteint 5.
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

Version 3.03.0 : catalogue 5×5, cases à Ø 20 mm, règles de la version 2 sur la grille 4×4 (grilles pleines, apparitions sur tout le pourtour, jonctions-cases, tuiles libres, nouveau catalogue), poses illimitées, bibliothèque élargie, choix de la grille au bouton « Nouveau ». Un document de la version 1 se rouvre converti, et le nouveau catalogue est proposé. Le **catalogue 5×5 est disponible pour la pose à la main** ; le générateur 5×5 est provisoire. À venir : le générateur 5×5 (centrales orientées, 5 ou 6 B1, villes en 2-3-2), les mesures sur 1000 plateaux, puis les seuils d’équilibre 5×5. Restent à valider en conditions réelles : une impression et la mesure de la barre de 100 mm à la règle, l'usage au doigt sur tablette, et l'équilibre ressenti en parties réelles.

## Droits

Tous droits réservés. Le code est visible publiquement, mais aucune licence de réutilisation n'est accordée.
