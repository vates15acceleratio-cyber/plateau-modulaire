# Recette du module des passages et corrections de la revue (testeur), 2026-10-17

Branche `passages`. Objet : commit 302cc29 et revue `41`.

## Résultats
- `node --test` : **610 tests, 0 échec**, vérifié par l'orchestrateur. Il y a 9 tests de plus dans `tests/passages.test.js`.
- `recette-interface.html` : **312 OK, 0 ÉCHEC**. Le scénario S10 compte 2 contrôles de plus, pour C4. Sans la correction, la recette donne 2 ÉCHEC.
- `recette-p2.html` : **116 OK, 0 ÉCHEC**.
- Les anciens documents restent identiques : générateurs 4×4 et 5×5 sur 6 graines, SVG du catalogue en 4 rotations, PDF. Le catalogue organique candidat donne le même résultat avant et après les nouvelles règles (0 erreur, 0 alerte).

## Vérifié dans le navigateur
Edge sans fenêtre a été piloté par CDP, avec des événements générés par le navigateur.
- **CSP** : aucune violation sur le parcours complet (outil P, quart de tour, pivot, T, poignée, pose). Un contrôle positif confirme que l'écouteur fonctionne.
- **Cas limites** : un passage vers un coin est refusé ; `raccord_double` est signalé ; les croisements sont signalés ; supprimer un pivot puis annuler et rétablir fonctionne ; les alertes de bord laissent la tuile posable.
- **Sauvegarde et réouverture** de documents 4×4 et 5×5 avec passages, tuiles tournées : correctes.
- **PDF** : rendu avec PyMuPDF et regardé, correct.
- **Graphe** : 56 contrôles, 0 échec. Une case reliée par un passage, en T, à travers les tuiles et quelle que soit la rotation est toujours à 1 pas. Trois de ces cas sont maintenant dans les tests.

## Corrections de la revue `41`
- **B1** : plafonds de sauvegarde à 8 pivots et 16 passages par modèle. La règle des tracés est sautée si la structure a des erreurs, avec un tri par boîtes englobantes et un arrêt au premier croisement. Un fichier hostile passe de 43 s à environ 0,1 s. Un test borne le temps.
- **C1** : les réseaux de passages se construisent comme dans le graphe (les cases sont rattachées, pas fusionnées).
- **C2** : l'écart entre traits est mesuré hors des zones communes (`horsZones`).
- **C3** : un pivot de degré inférieur à 2 n'est plus imprimé. Deux nouveaux blocages : `pivot_zone_coin` et `pivot_case`.
- **C4** : Ctrl+Z pendant le glissement d'une poignée ne plante plus.
- **R2 à R6** : tests positifs ajoutés ; une courbe invalide est comptée dans `elements_ignores` ; l'ordre case / raccord / pivot est le même partout ; `Object.create(null)` ; variables CSS ; la case visée est entourée.

## Défaut restant (dette)
Entre 1600 et 1920 px, le bouton « Outil » fait passer la barre d'outils de l'éditeur sur deux lignes : le canevas descend de 60 px. Il est lié à la carte « Commandes » flottante (`styles/aide.css`), qui masquait déjà la colonne de validation. Ce point est à traiter avec la dette de mise en page.

## Non vérifié
Gestes humains réels ; téléchargement par le bouton Enregistrer ; dialogue d'export dans le navigateur ; affichage mobile, déjà dégradé avant ce module.
