# Plateau modulaire

Outil de conception d'un **plateau de jeu modulaire pour 2 joueurs** : le plateau s'assemble à partir de tuiles carrées et change à chaque partie. L'outil sert à dessiner les tuiles, à assembler des plateaux, à vérifier leurs contraintes et leur équilibre, puis à exporter les tuiles pour l'impression (tuiles en carton rigide, plateau de 48 × 48 cm).

Le périmètre est le **plateau** seulement : pas de règles, pas de tours de jeu, pas de moteur de jeu.

## Utilisation

Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox). Aucune installation, aucun serveur, aucune connexion : tout fonctionne hors ligne, en local.

- **Onglet Plateau** : glisser les tuiles de la bibliothèque sur la grille 4×4 (toujours pleine). La pose et la rotation (touche R) sont libres ; une rotation est suggérée pour les bords et les coins. Un clic sur une jonction y pose une ville ; une jonction sans ville est une case chemin. Les compteurs et les alertes sont à droite ; un clic sur une alerte montre l'élément concerné. Un plateau complet très déséquilibré est signalé en erreur.
- **Onglet Tuiles** : créer, dupliquer ou modifier une tuile (cases, chemins, raccords, ports de coin, case d'apparition), avec validation en direct et aperçu des 4 rotations. Seules les contraintes physiques bloquent ; les règles qui garantissent l'écart entre villes sont des alertes.
- **Plateau aléatoire** : génère un plateau valide et équilibré à partir d'une graine reproductible (jonctions sans ville dans la rangée centrale par défaut, option « jonctions variées »).
- **Rapport d'équilibre** : distances de chaque joueur aux villes, score d'équilibre, partage des villes, goulets.
- **Exporter** : planches A3 (6 tuiles) ou A4 (2 tuiles) avec fond perdu, repères de coupe et barre de contrôle de 100 mm ; planche des jetons ; aperçu du plateau. Formats : PDF vectoriel à l'échelle exacte, SVG, PNG 300 dpi.
- **Enregistrer / Ouvrir** : fichier JSON. Sauvegarde automatique dans le navigateur. Annuler / rétablir : Ctrl+Z / Ctrl+Y.

## Principes de conception

- Grille 4×4 de tuiles carrées de 12 cm (environ 60 cases par plateau, cases de 3 cm de diamètre au plus). Un format 5×5 est en préparation.
- Deux joueurs, **vert** (nord) et **rouge** (sud) : les 2 rangées les plus proches de chaque joueur lui appartiennent.
- **Toutes les tuiles du pourtour** (bords et coins) portent une case d'apparition, imprimée neutre et colorée à l'écran selon le camp. Les coins ont un raccourci vers la tuile de bord voisine.
- **7 villes**, sous forme de jetons posés aux jonctions de 4 tuiles ; les autres jonctions sont des cases chemin. Au moins 3 cases entre deux villes. On s'arrête dans une ville (elle ne se traverse pas).
- Catalogue de 14 modèles (22 tuiles) : 6 centrales, 5 modèles de bord (10 tuiles), 3 modèles de coin (6 tuiles).
- Équilibre mesuré depuis les cases d'apparition de chaque camp : blocage si « 5 villes contre 2 » ou écart de plus de 3 cases entre joueurs ; alerte au-delà de 2 cases d'écart ou si le score d'équilibre atteint 5.
- Couleurs d'impression : vert, rouge, noir, blanc, avec des codes de forme lisibles sans la couleur.

Les décisions et leurs raisons sont dans [`docs/`](docs/) : le brief d'origine (`0-brief.md`), les décisions de la version 2 (`18-decisions-v2.md`, prioritaires), la synthèse de la version 1 (`3-synthese.md`), les avis de conception (design de jeu, géométrie des raccords, ergonomie, prépresse), les mesures d'équilibre et les revues.

## Structure

```
index.html        page de l'application
src/              modules JavaScript (sans dépendance, sans modules ES)
styles/           feuilles de style
tests/            tests Node (node:test)
outils/           pages d'essai et de recette, scripts de mesure, serveur local de test
docs/             brief, décisions, avis, mesures, revues
```

## Tests

Avec Node.js (version 20 ou plus), depuis la racine :

```
node --test
```

Les pages `outils/recette-interface.html` et `outils/recette-p2.html` jouent des parcours complets dans le navigateur et affichent leur bilan. Pour tester dans un navigateur par HTTP plutôt qu'en `file://` : `node outils/serveur.js 8765`, puis http://127.0.0.1:8765/.

## État

Version 2.00.0 : règles de la version 2 sur la grille 4×4 (grilles pleines, apparitions sur tout le pourtour, jonctions-cases, tuiles et pose libres, nouveau catalogue). Un document de la version 1 se rouvre converti, et le nouveau catalogue est proposé. À venir : le format 5×5. Restent à valider en conditions réelles : une impression et la mesure de la barre de 100 mm à la règle, l'usage au doigt sur tablette, et l'équilibre ressenti en parties réelles.

## Droits

Tous droits réservés. Le code est visible publiquement, mais aucune licence de réutilisation n'est accordée.
