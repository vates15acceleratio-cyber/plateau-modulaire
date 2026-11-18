# Seuil S à 5 en 5×5, conseil « Placer les villes », goulets en 4×4, défaut D1 (sous-agent de production, Sonnet 5.5), 2026-10-18

Rapport du sous-agent, consigné et condensé par l'orchestrateur. Il applique les décisions 1, 2 et 4 de `18` (« Réponses… `60` »). Résultats :
- `node --test` : 739 tests, 732 OK, 0 échec, 7 PDF ignorés ;
- recettes navigateur : 358 OK et 116 OK, 0 échec.

1. **Seuils S** : alerte à 5 et information à 4 dans les deux formats (`graphe.js:43-44`). Tests adaptés.
2. **Conseil 5×5** : `CONSEIL_5X5` devient « Outils > Placer les villes pose les 7 villes au meilleur placement admissible. ».
   - Il ne s'affiche plus sur un placement admissible.
   - Le message « villes trop proches » du 5×5 renvoie aussi vers « Placer les villes ».
   - Les tests du conseil et le scénario S9c de la recette sont réécrits.
3. **Goulets en 4×4** : `pointsArticulation` devient le dernier critère de la clé des finalistes. Mesure sur 200 plateaux : **2,0 % → 0 %** de plateaux à goulet. S, chaîne, distMax, accès, moitiés, montable et temps sont inchangés. Une empreinte 4×4 change (`emp-3`), les 40 autres sont identiques.
4. **Défaut D1** : `mursLus` lit `murs` en un seul passage avec un masque de 4 bits, donc en temps linéaire. Le sous-agent n'a pas tronqué à 4, ce qui aurait perdu un mur valide placé après des valeurs invalides. Le test E4 est réactivé : 80 000 éléments en moins de 500 ms.
5. **Seuils de test** :
   - taux d'acceptation des candidats à 0,58 ;
   - `tirerPlateaux5x5` à 11 sur 20 ;
   - au lieu du test qui ne pouvait pas échouer, deux bornes : moyenne de cases faibles < 1,3, et moyenne de cases de tuile faibles < 0,4.
6. **Commentaires périmés** corrigés dans `generateur.js:27` et `modele.js:1363`.
7. **Documentation** : `docs/10`, `docs/25` et le README mis à jour.
