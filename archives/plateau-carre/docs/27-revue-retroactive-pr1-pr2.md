# Revue rétroactive des PR 1 et 2 (relecteur, Opus 5.5), 2026-10-16

Rapport du relecteur consigné par l'orchestrateur. Revue en lecture seule.

## Vérifications faites
- `node --test` : 461 OK, 0 échec, 7 sautés (PyMuPDF absent).
- Recettes navigateur après la PR 2 : `recette-interface` 243 OK, `recette-p2` 109 OK, 0 échec.
- CI : les 6 exécutions de `tests.yml` sont vertes.
- `outils/mesures-equilibre.js 1000 20261015` régénère un fichier identique à `docs/21`, aux fins de ligne près. La mention « sans effet sur les mesures » de `docs/18` est donc confirmée.

## À corriger
1. **`docs/4-architecture.md`, colonne « DOM ».** `equilibre.js`, `generateur.js` et `controles.js` construisent aussi une boîte de dialogue (`equilibre.js:93`, `generateur.js:362-492`). Écrire « partiel (calcul pur + boîte de dialogue) » et noter que `PM.dialogue` vient de `app.js`.
2. **`docs/4-architecture.md`, deux affirmations inexactes.**
   - « Conversion en pt / px seulement dans `export.js` » : la conversion px ↔ mm de l'écran se fait aussi dans `assemblage.js` et `editeur-tuile.js`.
   - « Aucune dépendance pour les tests » : Python et PyMuPDF sont facultatifs ; sans eux, 7 tests sont sautés.
3. **Des archives encore normatives.** Le code vivant cite encore :
   - `archives/2` (conventions, D3, D4, D10) ;
   - `archives/6` (palette d'impression) ;
   - `archives/16` (critère d'équilibre) ;
   - `archives/11` (B1 sécurité, I1, I2).

   Le signaler dans `CLAUDE.md` et `docs/4`, sans nouveau `sed`.
4. **`docs/10-contrats-interface.md:70`** : « quart de case de jonction Ø 24 » doit devenir Ø 20.
5. **`outils/constats-catalogue-v2.md:27`, recopié dans `docs/21`.** La phrase sur le jeu de K4 (12,8 mm) est périmée. Il faut la mettre à jour, puis régénérer `docs/21` (les tableaux ne changent pas).
6. **`src/catalogue.js:41`** : « 16 mm des autres cases » vaut maintenant 14 mm (r + 4).
7. **`tests/editeur-tuile.test.js:60-68`.** Le test d'aimantation garde « rayon 12 », la borne `>= 32` et `diametre: 24`. Il passe seulement grâce à la grille de 10 mm. Utiliser `E.DIAMETRE_DEFAUT` et la borne `20 + E.DIAMETRE_DEFAUT / 2`.

## Remarques
8. **K4 en (82, 60) / (60, 82)** : 11,1 mm de jeu entre les relais, contre 8,3 mm aujourd'hui, avec la même forme et les mêmes liaisons. Adopter cette position oblige à mettre à jour `docs/18`.
9. **`docs/20` (texte D1 et tableau D4)** indique encore une jonction-case Ø 24. Ajouter un renvoi vers `docs/18`.
10. **`CHANGELOG.md`.**
    - Fusionner les deux blocs « Non publié » ; il n'y a pas encore de numéro de version.
    - Préciser que le rendu des anciens documents change : leurs quarts de jonction passent à Ø 20, à côté de cases restées à Ø 24.
    - Noter dans `docs/25` que les anciennes copies de B5 et K4 restent à Ø 24.
11. **`outils/mesures-equilibre.js:86`** cite encore `outils/mesures-generateur.js`, retiré.
12. **Remplacements `sed` incomplets dans les archives** (références courtes), sans gravité. Cadres de commentaire désalignés à `graphe.js:193` et `catalogue.test.js:531`.
13. **Ø 20 écrit dans 4 constantes séparées** : `catalogue.js:51`, `editeur-tuile.js:35`, `modele.js:480` et `geometrie.js:32`. Proposer une constante `COMMUNES.DIAMETRE_CASE` unique, ou un test qui vérifie qu'elles sont égales.
14. **Valeurs par défaut divergentes.**
    - `rendu.js:120` dessine une case sans diamètre en Ø 30 (même constat que l'avis prépresse, `docs/26`).
    - `editeur-tuile.js:417` : le halo de coin vaut encore 12 mm de rayon ; écrire `DIAMETRE_CASE_JONCTION / 2 + 3`.
15. **CI** : les 7 tests PyMuPDF y sont sautés. Installer PyMuPDF dans le workflow, ou l'écrire dans `docs/4`.
16. **Règle des 8 mm entre chemins** : elle n'est vérifiée que par les tests du catalogue, pas par `validerModele`. Une tuile créée par l'utilisateur peut donc avoir des chemins qui se touchent sans alerte. À noter dans `docs/25`.
17. **Numérotation** : `docs/25` réservait le n° 24 au rapport de mesures du 5×5. Le n° 24 est maintenant le cahier des charges, et le rapport de mesures prendra le prochain numéro libre.

## Points sains
- Toutes les références `docs/…` des fichiers vivants pointent vers un fichier existant.
- L'ordre de chargement décrit dans `docs/4` est exact.
- Les conventions sont respectées (en-tête `PM`, `module.exports`), et le catalogue compte bien 13 modèles et 22 tuiles.
- Ø 20 : tout ce qui dépend de la taille d'une case suit `c.diametre` ou `DIAMETRE_CASE_JONCTION` (quarts de jonction, symbole d'apparition, aimantation, validation, export).
- Les tests adaptés gardent la même exigence.
- B5 et K4 : les anciennes positions échouaient à la règle des 8 mm, les nouvelles la respectent. Les liaisons sont inchangées et K4 reste symétrique.

## Verdicts
- **PR 1** : acceptée, avec des corrections de documentation (constats 1 à 3).
- **PR 2** : acceptée, avec des corrections mineures (constats 4 à 7).
