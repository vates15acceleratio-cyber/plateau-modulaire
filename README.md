# Plateau modulaire

Outil de conception d'un **plateau de jeu modulaire pour 2 joueurs** : le plateau s'assemble à partir de tuiles carrées et change à chaque partie. L'outil sert à dessiner les tuiles, à assembler des plateaux, à vérifier leurs contraintes et leur équilibre, puis à exporter les tuiles pour l'impression (tuiles en carton rigide, plateau de 48 × 48 cm).

Le périmètre est le **plateau** seulement : pas de règles, pas de tours de jeu, pas de moteur de jeu.

## Utilisation

Ouvrir `index.html` dans un navigateur récent (Chrome, Edge, Firefox). Aucune installation, aucun serveur, aucune connexion : tout fonctionne hors ligne, en local.

- **Onglet Plateau** : glisser les tuiles de la bibliothèque sur la grille 4×4 (ou 4×4 avec un ou deux coins retirés). Les tuiles de bord s'orientent seules ; les centrales tournent avec la touche R. Un clic sur une jonction pose une ville, puis un carrefour. Les compteurs et les alertes sont à droite ; un clic sur une alerte montre l'élément concerné.
- **Onglet Tuiles** : créer, dupliquer ou modifier une tuile (cases, chemins, raccords, ports de coin), avec validation en direct et aperçu des 4 rotations.
- **Plateau aléatoire** : génère un plateau valide et équilibré à partir d'une graine reproductible.
- **Rapport d'équilibre** : distances de chaque joueur aux villes, score d'équilibre, partage des villes, goulets.
- **Exporter** : planches A3 (6 tuiles) ou A4 (2 tuiles) avec fond perdu, repères de coupe et barre de contrôle de 100 mm ; planche des jetons ; aperçu du plateau. Formats : PDF vectoriel à l'échelle exacte, SVG, PNG 300 dpi.
- **Enregistrer / Ouvrir** : fichier JSON. Sauvegarde automatique dans le navigateur. Annuler / rétablir : Ctrl+Z / Ctrl+Y.

## Principes de conception

- Grille 4×4 de tuiles carrées de 12 cm ; 50 cases de déplacement ; cases de 3 cm de diamètre au plus.
- 7 villes et 2 carrefours, sous forme de jetons posés aux jonctions de 4 tuiles ; au moins 3 pas entre deux villes.
- Chaque joueur a son côté (nord, sud) avec 2 tuiles d'apparition.
- Catalogue de 18 modèles (20 tuiles) : 6 centrales, 5 coins, 5 bords, 2 modèles d'apparition en double.
- Couleurs d'impression : vert, rouge, noir, blanc, avec des codes de forme lisibles sans la couleur.

Les décisions et leurs raisons sont dans [`docs/`](docs/) : le brief d'origine (`0-brief.md`), la synthèse de référence (`3-synthese.md`), les avis de conception (design de jeu, géométrie des raccords, ergonomie, prépresse), les mesures d'équilibre et les revues.

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

Version 1.00.0 : toutes les fonctionnalités prévues sont présentes. Restent à valider en conditions réelles : une impression et la mesure de la barre de 100 mm à la règle, l'usage au doigt sur tablette, et l'équilibre ressenti en parties réelles (notamment la règle « villes traversables ou non », qui relève des règles du jeu).

## Droits

Tous droits réservés. Le code est visible publiquement, mais aucune licence de réutilisation n'est accordée.
