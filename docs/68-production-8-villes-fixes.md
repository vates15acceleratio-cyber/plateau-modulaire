# Production : 8 villes fixes en 5×5, catalogue P, R3 assouplie, campements à l'écran (sous-agent dev-web), 2026-10-19

## Vérification de l'orchestrateur
- `node --test` : 745 tests, 0 échec, 0 sauté.
- `recette-interface` : 365 OK, 0 ÉCHEC.
- `recette-p2` : 116 OK, 0 ÉCHEC.
- Capture regardée : `docs/croquis/ponts/plateau-genere-5x5.png`. Les 8 villes sont à leur place, il y a 8 campements, LC4 est au milieu.

## Mesure sur 200 plateaux 5×5 du vrai générateur (`outils/mesures-5x5-villes-fixes.js`)
- **Réussite** : 200 sur 200, villes aux positions par défaut. Temps de génération : 386 ms en moyenne, 599 ms au plus.
- **Écart entre villes** : aucune paire à moins de 3 cases.
- **Rythme** : chaîne moyenne de 2,95, au plus 3 sur 197 plateaux.
- **Connexions** : 1,5 % de cases faibles (3,5 % au plus) ; degré moyen 3,77.
- **Équilibre** : S de 0,26 en moyenne (1 au plus) ; aucune majorité ; partage symétrique sur 200 plateaux.
- **Taille et variété** : 57,4 cases ; 38 compositions de centrales différentes.
- **4×4** : 90 générations identiques avant et après.

## Contenu
- **Catalogue P** : 30 tuiles, LC11 et LC12 ajoutés, LC2 retiré.
- **R3 assouplie** sur les centrales 5×5 (`porteuse5x5`, `tests/aides-trace.js`).
- **Générateur** : `rechercherPose5x5` choisit la place puis l'orientation des centrales.
- **Critères à 8 villes** : « 6 contre 2 » bloquant, « 5 contre 3 » en alerte.
- **Au-delà de 8 villes** (`trop_de_villes`) : erreur.
- **« Placer les villes »** essaie d'abord le motif par défaut.
- **Anciens 5×5** : l'outil propose de les régénérer.
- **Écran Plateau** : le jeton campement remplace le petit point.
- **Textes** : « campement » partout. `DIAMETRE_CASE_JONCTION` passe à 30.

## Points ouverts
- **Pose d'une 9e ville** : elle est signalée en erreur au panneau mais pas refusée, comme les autres règles bloquantes du projet.
- **Cases à 2 connexions** : l'ancienne optimisation qui les réduisait n'existe plus ; on reste sous le seuil.
- **Restes** : commentaires internes à renommer ; tableau D4 (`archives/2`) à mettre à jour (siège Ø 30).
- **À valider par l'advisor prépresse** : la marge de 4,97 mm de LC12.
