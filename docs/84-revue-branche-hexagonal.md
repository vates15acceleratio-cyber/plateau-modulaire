# Revue de la branche hexagonal (relecteur, Sonnet 5.5), 2026-10-19

Branche `hexagonal` au commit `b215a82` (21 commits, 68 fichiers, +6742 / −388). Lecture seule : aucun fichier du dépôt modifié, scripts d'essai dans le scratchpad `relecteur-hex/`.

## Vérifications faites
- `node --test` : 906 tests, 899 OK, 0 échec, 7 PDF sautés (PyMuPDF absent). Recettes navigateur : `recette-interface` 420 OK, `recette-p2` 125 OK, 0 échec.
- **Non-régression 4×4 / 5×5 (comparaison octet à octet avec `origin/main` extrait dans le scratchpad)** :
  - plateaux générés (3 graines par format) : JSON, contrôles et équilibre identiques ;
  - fixtures 3.04 (4×4, 5×5), 4.00 (5×5), v1 : mêmes alertes, même réécriture ;
  - 800 modèles carrés mutés au hasard : `validerModele` donne des résultats identiques ;
  - planches A3, aperçu, SVG du plateau, liste des tuiles, rapport d'équilibre : identiques.
  - Seule différence voulue : 24 jetons au lieu de 16.
- **CSP** : `index.html` ne change que le libellé du bouton. Aucun `style=`, `<style>`, `<script>` ni gestionnaire `on…=` ajouté dans le diff. Les seules écritures de style sont des propriétés CSSOM (`fantome.style.width`, `rempli.style.width`), déjà en usage sur `main`.
- **Contenu hostile** (20 variantes d'un document hex19 : rotations 1e15, négatives, hors entiers sûrs ; cellules ou jetons hors plage ; 500 jetons ou tuiles ; identifiants `__proto__` / `constructor` ; grille et modèles incohérents ; coordonnées 1e308 ; 5000 cases ; ports et côtés absurdes ; murs hors plage) : lecture, validation, rendu, aperçu, planches, contrôles, Orienter, Placer les villes, écriture. Aucun blocage (< 70 ms) ; deux exceptions, décrites au constat 6, qui existent à l'identique sur `main` en 4×4. Un nom ou un identifiant de modèle `"><img onerror=…>` est échappé partout (plateau, aperçu, planches, contrôles, vignettes).
- **Refus par une version antérieure** (exécuté : `src` des étiquettes 3.04.0, 4.00.0 et 5.00.0 extraits avec `git archive`, `depuisJSON` sur un `versJSON` et un `bibliothequeVersJSON` hex) : la 3.04 refuse les deux (« Version de fichier absente ou inconnue : 3 ») ; la 4.00 et la 5.00 refusent les deux (« Format de grille inconnu : hex19 »). Une sauvegarde automatique hex rouverte dans la 5.00 n’est pas détruite : `app.js:58-61` la met de côté sous la clé `plateau-modulaire:autosave-illisible` et ouvre un plateau neuf (la clé principale est ensuite écrasée) ; à signaler dans le CHANGELOG. Un fichier hex de version 2 écrit à la main se lit dans la version actuelle (sans conséquence).
- **Performance** : 60 plateaux hex (la moitié en dispositions variées) : 443 ms en moyenne, 564 ms au maximum, 0 échec. Orienter : 17 à 41 ms. **Tuiles utilisateur asymétriques** (clones de HC2 et HC3 privés d’un raccord, donc 6 rotations distinctes) : génération 2,0 à 4,2 s, Orienter 0,7 s (390 combinaisons, non tronqué). Bornes du code : 8000 nœuds, 5000 poses jugées à 0,3 ms l’équilibre. Le calcul reste synchrone et sans indication « en cours » : acceptable, voir la remarque 12.
- **Conformité à `docs/72`** :
  - 19 tuiles, côté 54 mm, pourtour à bord droit, plateau 498,8 × 432 mm ;
  - 6 villes en trèfle, 24 sièges, 24 jetons ;
  - HC2, HC3, HB1, HK1 sans HC1, stock 8 / 7 / 8 / 7 (= 30 pièces de `79`) ;
  - 3 planches A3 et 10 A4 ;
  - `SEUIL_REJET_S_HEX` = 3, seuils S 4 / 3 et « 4 contre 2 » bloquant (`80`) ;
  - 10 dispositions variées : celles de `80` § 2, trèfle compris ;
  - bouton Orienter (une étape d'historique, Ctrl+Z) ;
  - `trop_de_villes` à plus de 6.
  Les décisions de `docs/18` ne sont pas touchées (preuve : comparaison ci-dessus).

## Constats

Aucun constat bloquant : le code est prêt. Les corrections demandées sont documentaires, plus quelques retouches de code courtes.

### Bloquant
Aucun.

### À corriger avant la PR
1. **`CLAUDE.md` périmé** (section État, lignes 40 à 43 ; liste des décisions, lignes 8 à 14) :
   - la ligne « Branche `hexagonal` (conception terminée, aucun code) … Prochaine étape : production en lots » est fausse (les lots 1 à 6 sont faits) ;
   - la ligne « Sur `main`, ce CLAUDE.md dit encore « ne rien faire » » n'a plus d'objet à la fusion ;
   - la section « Où sont les décisions » ne cite pas `docs/72` à `82`.
   Correction : réécrire en « Version 6.00.0 (hexagonal) : lots 1 à 6, `docs/72` à `82` », avec les tests et recettes (906 / 420 / 125), ajouter `72` (prime pour l'hexagonal) à la liste des décisions, supprimer la ligne « Sur `main`… ». L'État 5.00.0 qui cite « 16 jetons » est historique : ajouter « 24 depuis 6.00.0 » plutôt que de le réécrire.
2. **`README.md`** : l'État annonce « Version 4.00.0 … 37 tuiles » alors que `main` est en 5.00.0 (31 tuiles). Ligne 15 : « 16 jetons ». Ni le format hexagonal ni l'« Orienter » n'y figurent. Voir la liste de documentation.
3. **`src/graphe.js:460`** : le message `ville_peu_de_ports` écrit « La ville (i, j) » en hexagonal, alors que les autres messages disent « siège i ».
   Correction : `(F.nbCotes === 6 ? 'siège ' + v.i : '(' + v.i + ', ' + v.j + ')')`, même motif qu'à `controles.js:141`. Le producteur l'a signalé dans `docs/82`. De même `src/generateur.js:1727` construit `nomsVilles` en `(i,j)`, utilisé ensuite seulement hors hexagonal : sans effet.
4. **`src/graphe.js:68` et `:52`** : le commentaire dit encore « docs/73, à recalibrer sur 1000 plateaux ». `docs/80` § 4 demande de le remplacer par « calibré docs/80 sur 600 plateaux : S accepté ≤ 3 » et d'ajouter « validé docs/80 ». Valeurs inchangées.
5. **`src/aide.js`** (preuve par source dans `aide.test.js`) :
   - ligne 50 : « la tourne d'un quart de tour » est faux en hexagonal (60°, touche R) ;
   - aucune entrée pour « Orienter les tuiles » ni pour le clic sur un siège ;
   - ligne 60 « Clic sur un campement ou une ville » est correct, mais l'aide ne dit rien du format hexagonal.
   Correction : formulations neutres (« d'un cran »), une entrée « Orienter les tuiles (hexagonal) » avec `source: GEN` / `CO` et `preuve` sur le libellé du bouton.
6. **`src/graphe.js:240`** (défaut déjà présent sur `main` en 4×4, vérifié ; classé « à corriger » parce que l’exception sort d’un gestionnaire de clic ; peut aller en PR séparée) : `portees.forEach(c => lier(id, c))` lève `Cannot read properties of undefined (reading 'add')` quand un modèle d'un fichier hostile fait aboutir un port à une case absente (identifiants de cases renommés, 5000 cases, coordonnées 1e308).
   - `PM.graphe.equilibre`, `PM.equilibre.analyser`, `placementsAdmissibles` et `meilleurPlacementVilles` lèvent donc depuis le rapport d'équilibre et « Placer les villes ». `controles.calculer` est déjà protégé (`controles.js:154`).
   - Aucune corruption, mais une exception non rattrapée dans un gestionnaire de clic.
   - Correction d'une ligne : `portees.forEach(function (c) { if (voisins.has(c)) lier(id, c); })`. Peut aussi aller en PR séparée, la branche n'étant pas en cause.

### Remarques
7. **Tests : catalogue candidat recopié 3 fois** (`tests/graphe-hex.test.js:14-45`, `tests/modele-hex.test.js:14-48`, `tests/aides-rendu-hex.js:19-41`), alors que le vrai catalogue existe depuis le lot 4.
   - Les copies divergent du livré : exemplaires 6 / 5 / 8 / 7 au lieu de 8 / 7 / 8 / 7, traverse de HC2 sans le point de contrôle (0 ; 4), commentaire « le vrai catalogue vient au lot catalogue ».
   - `export-hex.test.js:75` valide « 26 pièces » / 9 planches A4 alors que le jeu livré compte 30 pièces et 10 A4.
   - Ces tests ne couvrent donc pas le catalogue réel, hormis `catalogue-hex`, `generateur-hex` et `interface-hex`.
   - Correction : une fabrique unique dans `tests/aides-rendu-hex.js` qui part de `PM.catalogue.modelesParGrille.hex19` (clonage), ou au minimum aligner les exemplaires et les commentaires. À confier au testeur.
8. **Test de durée** `tests/generateur-hex.test.js:24` : « moins de 3 s en moyenne » sur 50 plateaux. Marge confortable (0,44 s mesuré) mais dépend de la charge de la CI GitHub (Node 22).
   Suggestion : 6 s ou supprimer l'assertion de durée.
9. **Tests qui vérifient l'implémentation** : `interface-hex.test.js:667` (« réutilise rechercherPoseHex ») ne teste que le type de la fonction (`typeof`), pas la réutilisation. Le comportement (déterminisme, bornes) est bien vérifié. Renommer le test ou supprimer l'assertion `typeof`.
10. **Écart au catalogue candidat à valider** (`docs/79`) : point de contrôle de la traverse de HC2 en (0 ; 4) au lieu de (0 ; 6), pour tenir 18 mm à la case b (18,7 mm mesurés). « À confirmer » : à soumettre au conseiller géométrie ou à l'utilisateur avec l'image `docs/croquis/hexagonal/catalogue/catalogue-hex.png`, qui montre sans doute encore l'ancienne courbe.
11. **Décisions provisoires de `docs/72` (dernier alinéa)** : tout est appliqué comme annoncé. Elles attendent encore la confirmation de l'utilisateur : le CHANGELOG et le message de PR doivent le dire, ou la confirmation est à obtenir avant la fusion.
12. **Interface** : calculs synchrones (génération 0,5 s avec le catalogue livré, 2 à 4 s avec des tuiles utilisateur asymétriques, jusqu’à 6 s sous charge selon `81` ; Orienter moins d’une seconde, mesuré) sans message « calcul en cours ». Acceptable, à noter dans les points ouverts. L'aperçu de « Plateau aléatoire » dessine les villes en simples cercles (`81`).
13. **Documents `docs/81`** : le texte cite le rejet à S ≥ 4 ; la décision finale est S ≥ 3 (`72`, `82`). Ajouter une ligne « remplacé par S ≥ 3 » ou la laisser, `72` faisant foi.
14. **Agents** : `relecteur.md` et `conseiller.md` donnent l'outil `Bash`, qui peut écrire ; la « lecture seule » repose sur la consigne. `CLAUDE.md` dit que la répartition du dépôt prime sur le `CLAUDE.md` global (sous-agents en Haiku là-bas) : contradiction documentée, à garder en tête.
15. **Recette `outils/recette-p2.html`** : le contrôle sur les boutons exige désormais 4 boutons dont « Orienter les tuiles » masqué en 4×4. Correct, et la preuve du masquage est dans la même ligne.
16. **Jetons, test assoupli** : `tests/export.test.js:308` passe la marge haute de `cy - 22 > 40` à `> 30`, adaptation du test à 6 rangées de jetons. Mesure : première rangée à cy = 53,5 (haut des repères à 31,5), dernier texte d’en-tête à y = 28 (écart de 2,5 mm, serré mais sans chevauchement), bas de la dernière rangée à 265,5 pour une barre de 100 mm à y = 289. Pas de chevauchement ; la validation prépresse du jeton (`CLAUDE.md`, points ouverts) reste à faire.
17. **Taille** : `docs/croquis/hexagonal` pèse 4,6 Mo d'images PNG. Acceptable pour un dépôt de documentation, à connaître.

## Documentation à mettre à jour

**Avant la PR** : `CLAUDE.md`, `README.md`, `CHANGELOG.md`, `src/aide.js`. **Avant l’étiquette 6.00.0** (dans la PR ou juste après) : `docs/4`, `docs/10`, `docs/25`, `docs/81`.

- **`CLAUDE.md`** : constat 1 ; ajouter la commande des recettes (inchangée) ; remplacer « Prochaine étape » ; noter 24 jetons ; ligne de règle « format hexagonal : voir `docs/72` » à la place de l'interdit supprimé.
- **`README.md`** :
  - Fonctionnalités : format hexagonal 19 tuiles (6 villes, 18 campements), Orienter les tuiles ;
  - ligne 15 : 24 jetons, dont 3 planches A3 / 10 A4 pour l'hexagonal ;
  - ligne 30 : un document hexagonal s'enregistre toujours en version 3 et est refusé par les versions antérieures ;
  - section « État » : passer à 6.00.0 (elle est déjà en retard sur 5.00.0).
- **`CHANGELOG.md`** : entrée `[6.00.0] - 2026-10-19` « Majeure » (voir le numéro ci-dessous), avec :
  - **Ajouté** : format hexagonal `hex19` (19 tuiles de 54 mm, plateau 498,8 × 432 mm, tuiles du pourtour à bord droit, rangée du milieu neutre, 6 villes en trèfle ou dispositions variées, 18 campements, H1 / H2 avec 3 ports par case) ; catalogue HC2, HC3, HB1, HK1 (30 pièces) ; passages traversants permis en hexagonal ; générateur hex19 ; « Orienter les tuiles » ; critères à 6 villes (« 4 contre 2 » bloquant, S 4 / 3, rejet à S ≥ 3) ; export (planches A3 / A4 à coupes partagées, aperçu) ; équipe d'agents `.claude/agents/` ;
  - **Modifié** : 24 jetons recto-verso pour tous les formats (au lieu de 16) ; `Nouveau` propose trois formats ; une grille hex s'écrit en version 3 ;
  - mention des décisions provisoires encore à confirmer par l'utilisateur.
- **`docs/4-architecture.md`** : ligne 31 (catalogue : ajouter hex19), 34 (sauvegarde : version 3 aussi pour l'hexagonal), 37 (générateur : `rechercherPoseHex`, `orienterTuiles`, `orienter`, dispositions), 38 (export : « 16 jetons » devient 24 ; planches hex) ; ajouter `geometrie.js` : format `hex19`.
- **`docs/10-contrats-interface.md`** :
  - ligne 65 `doc.grille` accepte `'hex19'` ;
  - ligne 67 `campCellule` ;
  - ligne 76 « Placer les villes » hex ;
  - ligne 81 rendu hex ;
  - ligne 82 à réécrire : `PM.geometrie.FORMATS` = `['4x4', '5x5', 'hex19']` (`FORMATS_TOUS` alias), le format hexagonal est fait ;
  - ligne 84 compatibilité : version 3 aussi pour toute grille hex19 ;
  - jetons hex `{ i: 0..23, j: 0, type }` (sièges, pas des jonctions i, j) ;
  - ajouter `PM.generateur.orienterTuiles(doc)` (pure : `{ ok, doc, changees, S, tronque, raison, combinaisons }`) et `orienter(etat)` (une étape d'historique).
- **`docs/25-travail-restant.md`** : § 1.6 « Format hexagonal : ne rien faire » à remplacer par « fait en 6.00.0 (`72` à `82`) » ; ligne 91 « 16 jetons ».
- **`src/aide.js`** : constat 5.
- **`docs/81`** : constat 13.

## Numéro de version proposé : **6.00.0** (Majeure)
Convention du CHANGELOG, d'après les précédents :
- 3.00.0 : Majeure pour « un nouvel espace de l'application (le choix de la grille 4×4 ou 5×5) » ;
- 2.00.0 et 4.00.0 : Majeures pour un changement de structure des documents et des règles ;
- Mineure : changement de comportement sans nouveau format.

L'hexagonal ajoute un nouveau format de plateau, un nouveau choix dans « Nouveau », des documents que les versions antérieures refusent, et un changement d'impression pour tous les formats (24 jetons). Cela relève de la Majeure. L'étiquette git est `6.00.0` (sans « v »), à poser après la fusion de la PR.

## Verdict
**Prêt pour PR après les corrections 1 à 5 (CLAUDE.md, README, CHANGELOG, aide.js, message `ville_peu_de_ports` et commentaires de `graphe.js`) et la garde de `graphe.js:240` (constat 6, ou PR séparée). `docs/4`, `docs/10` et `docs/25` sont à mettre à jour avant l’étiquette 6.00.0.** Aucun défaut bloquant : plateaux 4×4 et 5×5 identiques octet pour octet à `main`, CSP intacte, fichiers hostiles sans effet, 906 tests et deux recettes verts. Les constats 7 à 13 peuvent suivre dans une PR de nettoyage. Avant la fusion, obtenir ou mentionner la confirmation de l'utilisateur sur les décisions provisoires (critères à 6 villes, dispositions variées, stock de `79`, constat 10).
