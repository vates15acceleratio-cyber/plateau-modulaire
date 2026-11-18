# Recette du catalogue 5×5 (testeur, Sonnet 5.5), 2026-10-16

Rapport du testeur, consigné par l'orchestrateur. Branche `catalogue-5x5`, commit testé `7a814b6`. Le testeur n'a pas modifié `src/`.

## Verdict
**Aucun défaut dans le code.** Le testeur a ajouté 21 tests à `tests/catalogue-5x5.test.js`, qui passe ainsi de 21 à 42 tests. Tous passent, et aucun n'est en `skip`.

## Tests ajoutés
- **Chaîne complète sur le plateau 5×5 du test :**
  - **Sauvegarde :** l'aller-retour JSON conserve la grille et les modèles.
  - **Annuler / rétablir :** fonctionne, et un remplacement par un document 4×4 s'annule correctement.
  - **Contrôles :** tous les compteurs sont à leur cible (78 cases, 25 tuiles, 7 / 7 apparitions, 50 × 50 cm) ; un plateau troué est bien signalé.
  - **Équilibre :** le rapport est complet.
  - **Export :** tuiles de 106 mm (100 + 2 × 3 de fond perdu) ; 5 planches A3 ou 15 A4 pour les 30 tuiles ; PDF aux bonnes dimensions de page ; aperçu à 54 %.
- **Copies indépendantes :** `nouveauDocument('5x5')` ne partage rien avec le catalogue gelé ni avec une autre copie.
- **Refus croisés 4×4 / 5×5 :**
  - un modèle d'une grille est refusé dans un document de l'autre (`grille_modele`, refus de pose expliqué) ;
  - un modèle sans champ `grille` reste accepté partout.
- **Ids communs aux deux grilles :** les modèles livrés restent protégés de la suppression, y compris renommés. Une tuile utilisateur reprenant un id de l'autre grille reste supprimable.
- **Poses :** chaque modèle n'accepte que sa place, sur les 25 cellules. Les 4 B7 prennent 4 rotations distinctes, et chaque port tombe sur une jonction intérieure.

## Remarques (non bloquantes)
- Un fichier 5×5 sans en-tête `grille` est lu en 4×4, conformément à la règle « absent = 4×4 ». Le défaut est signalé, mais le document est inutilisable. Un tel fichier ne peut venir que d'une édition à la main.
- `rotationDeduite` renvoie `null` pour une centrale, et la pose prend alors 0. C'est voulu.

## Résultats
- `node --test` : 522 tests, 515 OK, 0 échec, 7 ignorés (tests PDF, PyMuPDF absent en local).
- Recettes navigateur : `recette-interface` 243 OK, `recette-p2` 109 OK, 0 échec.
