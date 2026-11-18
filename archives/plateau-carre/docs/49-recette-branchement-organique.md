# Recette du branchement organique (testeur, Sonnet 5.5), 2026-10-18

Rapport du testeur, consigné par l'orchestrateur. Branche `passages`. Le testeur n'a rien modifié dans `src/`.

## Résultats
- `node --test` : 676 tests, 668 OK, 0 échec, 8 ignorés. Les 8 ignorés sont les 7 tests PDF sans PyMuPDF, plus 1 test laissé en `skip` à cause d'un défaut (voir plus bas). Durée : environ 155 s.
- Recettes navigateur : `recette-interface` 320 OK, `recette-p2` 116 OK, 0 échec.

## Tests ajoutés : `tests/recette-branchement-organique.test.js` (34 tests)
- **A. `poids`.**
  - Valeurs hostiles : 0, négatif, décimal, texte, NaN, Infinity, tableau, objet. On retombe alors sur les exemplaires.
  - `validerModele` signale `poids_invalide`.
  - Fichier JSON hostile, `__proto__` et `constructor` : aucune pollution.
  - Un poids énorme reste sans effet.
  - Un modèle à 0 exemplaire n'est jamais posé.
- **B. Reconnaissance du catalogue précédent.**
  - Refus dès que le tracé d'un modèle est modifié.
  - Acceptation malgré des noms, exemplaires, poids ou un ordre différents.
  - Entrées abîmées refusées sans exception.
- **C. Proposition (au niveau `PM.etat`).** Accepter, Ctrl+Z, Ctrl+Y ; refus répété ; plus de proposition après une modification.
- **D. Mesures** (`rythme`, `accesCentre`, `casesParMoitie`, `reseauxPassages`).
  - Plateaux vides, abîmés, partiels ou non connexes.
  - Chaîne comparée à un calcul indépendant.
  - Plateau retourné : les écarts s'opposent.
- **E. Générateur.**
  - Moitiés égales sur 40 et 25 graines.
  - 78 à 81 cases en 5×5.
  - Bibliothèques modifiées par l'utilisateur : refus avec message, ou plateau valide, jamais d'exception.
  - Fonctionne aussi avec le catalogue 3.04.
- **F. Export du jeu complet.**
  - 24 tuiles en 4×4 (4 A3, 12 A4) et 37 en 5×5 (7 A3, 19 A4).
  - Stock modifié ; le poids n'intervient pas.
  - Après acceptation du nouveau catalogue puis Ctrl+Z, l'export suit.

## Défaut trouvé
**Cases par moitié sur un plateau incomplet.**
- `graphe.js:784` (`casesParMoitie`) compte toute jonction sans ville comme une case, même sans tuiles autour.
- `controles.js:195-198` ne compte que les jonctions entourées de 4 tuiles.
- Conséquence : le rapport affiche « vert 3, rouge 3 » sur un plateau vide, alors que le compteur de cases indique 0.
- Sans effet sur les plateaux complets ni sur le générateur.
- Le test est laissé en `skip`.

## Observations
- `validerModele` accepte un poids entier de 1e15, alors que la sauvegarde ignore les poids supérieurs à 999. Ce cas est inatteignable depuis l'interface.
- Le message du générateur ne mentionne pas un poids invalide.

## Durée de la suite et test de rapidité
- **Durée :** environ 155 s. Deux tests de stock prennent 145 s à eux seuls (107 s pour le 5×5, 37 s pour le 4×4).
- **Le test « 200 candidats en moins de 5 s » est fragile par construction :**
  - le 5×5 met 4,0 à 4,5 s seul ;
  - il échoue à 6,2 à 6,8 s quand la suite occupe tous les cœurs ;
  - l'affinage et l'orientation ont triplé le coût annoncé dans `34`.
- **Variante prête, non appliquée :** le calcul de stock réparti sur 4 fils ramène la suite à 71 à 79 s, mais pousse le test de rapidité à 8,6 à 14 s. Elle demande de revoir la limite.

## Écarts de couverture
- `proposerRemplacement` et `proposerNouveauCatalogue` (`app.js`) ne sont exécutés que par la recette navigateur.
- Ne sont pas couverts :
  - Ctrl+Y ;
  - le refus répété dans le navigateur ;
  - un document 5×5 ;
  - le démarrage depuis la sauvegarde automatique : seul `restaurerAutosave` est testé, `47` disait à tort « couvert ».
