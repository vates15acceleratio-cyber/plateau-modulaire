# Suites de la revue de la branche `passages` (sous-agent de production, Sonnet 5.5), 2026-10-18

Rapport du sous-agent, consigné par l'orchestrateur. Il applique les points de `51` et les décisions de `18` (« Réponses… revue de la branche passages »).

Résultats :
- `node --test` : 682 tests, 675 OK, 0 échec, 7 ignorés (PDF), environ 75 s, vérifié par l'orchestrateur ;
- `recette-interface` : 337 OK, 0 échec ;
- `recette-p2` : 116 OK, 0 échec.

1. **Rejet de S.** Le code est inchangé : rejet en 5×5, classement par S en 4×4. Les textes sont alignés : commentaires de `graphe.js`, `docs/10` et `docs/25`.
2. **Format version 3.**
   - `sauvegarde.js` lit les versions 1, 2 et 3 (`VERSIONS_LUES`). La fonction `versionEcriture` écrit 3 dès qu'un modèle a un passage ou un pivot, sinon 2. Le poids seul ne change pas la version.
   - Cela vaut pour l'enregistrement, l'export de bibliothèque et la sauvegarde automatique.
   - Tests ajoutés dans `passages.test.js` et `sauvegarde.test.js`. Les fichiers v1 et 3.04 s'ouvrent toujours, et la version 4 est refusée.
   - **Vérifié avec le code de l'étiquette 3.04.0 :** un fichier v3 y est refusé avec le message « Version de fichier absente ou inconnue : 3. ».
   - Une sauvegarde automatique v3 lue par la 3.04 est mise de côté dans la clé « autosave-illisible », sans être écrasée.
   - **Reste :** la 3.04 perd toujours `poids` sans prévenir, puisque le poids seul ne fait pas passer en version 3. Noté dans `25`.
3. **Proposition aux documents v1.** Le texte est partagé avec la proposition aux documents 3.04 (`texteNouveauCatalogue`) : titre « Nouveau catalogue de tuiles », mention des virages sans case, chargement de `nouveauDocument(grille)`.
4. **Test de rapidité.** Il mesure désormais le temps processeur (`process.cpuUsage()`) avec une limite de 12 s. Seuls, le 4×4 prend 0,2 s et le 5×5 3,2 s.
5. **Recette du démarrage depuis une sauvegarde automatique 3.04.** Nouvelle étape S11, en 4×4 puis en 5×5.
   - Elle passe par une iframe `srcdoc`, parce que `index.html` dans une iframe ne se pilote pas en `file://`.
   - Ce qu'elle vérifie :
     - la boîte s'affiche, sans style en ligne ;
     - « Garder » laisse le document intact, et la proposition revient au démarrage suivant ;
     - « Charger » installe le nouveau catalogue et vide le plateau ;
     - Ctrl+Z puis Ctrl+Y.
   - Le localStorage est restauré à la fin de l'étape.
6. **Poids.**
   - `poidsValide` et `POIDS_MAX = 999`.
   - `poids_invalide` devient une **alerte** au lieu d'une erreur, et le tirage retombe alors sur les exemplaires.
   - Commentaires périmés corrigés dans `generateur.js`, `equilibre.js` et `graphe.js`. Le conseil « rangée centrale » est présenté comme un conseil de pose à la main.
7. **Documentation.**
   - README : nombre de cases, passages, nouveaux catalogues, tuiles imprimées, seuils, poids, proposition du nouveau catalogue, version 3.
   - `docs/4` et `docs/25` mis à jour. Les remarques de `51` sont reportées dans `25`.
