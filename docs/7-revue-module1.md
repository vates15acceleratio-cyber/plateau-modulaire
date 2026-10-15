# Revue du module 1 par le relecteur (Opus 5.5), 2026-10-16

Verdict : cœur géométrique juste (D3, D4, D5, D8, D9, T1 à T4 recalculés). Pas encore prêt pour les sous-agents 2 à 5 : ajouts d'API et de robustesse, sans refonte.

## Bloquant
1. **`ref` ambigu** (modele.js:102, 114, 228, 257) : tantôt id de modèle, de case, de chemin ou `'coin:k'`. → `ref: { type: 'modele'|'case'|'chemin'|'coin'|'raccord', id }` ; `chevauchement` désigne les deux cases (`ids: [a, b]`).
2. **Pas de revalidation d'un plateau existant** (modele.js:513, 660). → exporter `masquesTuilePosee(doc, tuile)` ; ajouter `verifierTuilePosee(doc, tuile)` (modèle absent / incomplet, rôle ≠ `roleCellule`, `rot` ≠ `rotationDeduite`, cellule retirée, doublon) et `validerPlateau(doc) → {erreurs, alertes}` (forme, tuiles, exemplaires dépassés, jetons invalides).
3. **Pas de fonctions pour la forme et la bibliothèque.** → `changerForme(doc, forme)` (retire les tuiles des cellules retirées, recalcule `rot` hors centrales, nettoie les jetons), `ajouterModele`, `remplacerModele`, `supprimerModele`, `changerExemplaires` (toutes pures).

## Important
4. `validerModele` et `validerForme` lèvent une exception sur une case ou un retrait `null` (l.140, 191, 266, 385, 401). → erreur `case_invalide`, jamais d'exception.
5. `tournerTuile` accepte un `quarts` non entier (`rot: NaN`) (l.573). → refus.
6. Jetons retirés automatiquement non exposés (l.541, 594). → exporter `jetonsInvalides(doc) → [{i, j, type, raison}]`.
7. Ports de coin morts. → `jonctionPossible(forme, i, j)`, `portsCoinMorts(doc) → [{col, lig, coin, i, j}]`.
8. `raccordsMorts` ne distingue pas les cas (l.651). → `raison: 'absent' | 'vide' | 'mort'`.
9. API insuffisante pour le graphe. → `tuileEnPlateau(doc, tuile) → {cases (mm plateau), aretes, raccords: [{cote, pos, caseId}], ports: [{coin, caseId, i, j}]}` ; `PM.geometrie.raccordEnFace(cote, pos)`.
10. Deux cases peuvent aboutir au même coin (l.222-242). → règle `coin_double`.

## Mineur
11. Coin : 2 côtés intérieurs à raccord exigés (non documenté). 12. Message trompeur pour une centrale retirée (`cellule_interieure`). 13. Id / nom du modèle non validés. 14. Ids numériques et texte confondus. 15. `exemples` partagé et modifiable → fonction qui renvoie une copie. 16. Pas de générateur d'id → `nouvelId(modele, prefixe)`. 17. Commenter `{i, j}` = colonne, ligne ; camp d'apparition déduit de la cellule (le refus « mauvais camp » de D10 est sans objet). 18. Duplication des boucles d'extrémités → itérateur.

## Trous dans les tests
Case `null`, pureté de `validerModele`, `raccordsMorts` face à une cellule retirée, exemplaires réduits sous le nombre posé, `quarts` invalide, pose sur forme invalide, rotation qui retire un jeton (titre l.344 trompeur), ports de coin morts. Tests qui entérinent le code : « trop peu de côtés (coin) » (l.85), messages de `validerForme` non vérifiés.

## Arbitrages de l'orchestrateur
- Point 10 : **règle `coin_double` adoptée** (un coin = un seul chemin vers la jonction, comme un raccord).
- Point 11 : **règle conservée** (un coin n'a que 2 côtés intérieurs ; les exiger tous deux garantit son raccordement) ; inscrite dans la synthèse.
- Point 17 : camp d'apparition déduit de la position ; inscrit dans la synthèse.

# Recette du testeur (Sonnet 5.5), 2026-10-16

`tests/recette-modele.test.js` : 195 tests au total, 189 réussis, 0 échec, 6 `todo` (bugs). Oracles recalculés depuis la doc (15 formes valides, 17 invalides, stock, pureté sur document gelé, rotations, jetons, `raccordsMorts` sur 375 plateaux aléatoires, cas limites de `validerModele`, sérialisation). **Aucun bug fonctionnel** ; 6 bugs de robustesse :
1. (moyen) `tournerTuile` avec `quarts` non entier : `rot` corrompu (0.5, null après JSON, concaténation `'1'`).
2. `validerModele` : case `null` → exception (modele.js:140).
3. `validerModele` : `role: 'constructor'` / `'__proto__'`… → exception (tables par rôle héritées d'`Object.prototype`).
4. `validerForme({retires:[null]})` → exception (l.401).
5. Ids `'constructor'`, `'toString'`… → faux `id_double` (dictionnaires `{}`) → `Object.create(null)`.
6. `clonerDocument(undefined)` → exception.

## Arbitrages de l'orchestrateur sur les ambiguïtés relevées
- **Zone de coin** : la règle du code (distance coin–centre ≥ R + rayon = 35 mm pour Ø30) est retenue ; R = 20 mm inclut déjà la marge de 5 mm autour du jeton. Le « 37 mm » de D2 ajoutait une marge supplémentaire non nécessaire.
- **Forme invalide** : `peutPoserTuile` doit refuser toute pose tant que la forme est invalide.
- **Cellule active vide** : distinguer « voisin absent (pas encore posé) » de « face au vide définitif » (point 8 du relecteur).
- **Quota 7 villes / 2 carrefours et règle « jamais les 2 carrefours du même côté »** : contrôle (alerte) dans le module de contrôles (sous-agent 4) et contrainte dans le générateur (sous-agent 8) ; pas dans le module 1.

# Corrections (sous-agent 1), 2026-10-16
Tous les points de la revue et les 6 bugs de la recette sont traités (détail des signatures dans `src/modele.js`). Écarts acceptés : `exemples` reste un tableau gelé (+ `copieExemples()`), `changerForme` garde en place les tuiles dont le rôle ne correspond plus (signalées par `validerPlateau`, code `role_incorrect`).
Trois assertions de la recette contredisaient les arbitrages (ref structuré, ids chaînes, code `cellule_interieure`) : alignées par l'orchestrateur. Résultat : `node --test` → 225 / 225.
