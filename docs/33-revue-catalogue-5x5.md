# Revue du catalogue 5×5 (relecteur, Opus 5.5), 2026-10-16

Rapport du relecteur, consigné par l'orchestrateur. Objet : branche `catalogue-5x5`, commits `7a814b6` (catalogue) et `7c76eb0` (recette), plus les docs 24, 28, 29, 32 et les sections 5×5 de `docs/18`. Revue en lecture seule.

`node --test` : 522 tests, 515 OK, 0 échec, 7 ignorés (tests PDF).

## 1. Conformité aux décisions : conforme
- Le catalogue suit la répartition B′ : K2 seul ; B1, B7 et B7m ; C7 et C8. Il n'y a ni C5 ni K4.
- Aucun raccord latéral hors du raccourci.
- 30 exemplaires : K2 5, B1 6, B7 4, B7m 4, C7 6, C8 5.
- Les coordonnées sont identiques à `docs/29`.
- **Plateau du test, recalculé indépendamment :** 78 cases et 40 ports ; au moins 2 ports à chaque jonction et 8 jonctions à 3 ports ; les 7 villes sont sur des jonctions à 3 ports, en 2-3-2.
- **Ce que le test prouve :** qu'une telle pose **existe**. Il ne dit ni à quelle fréquence on l'obtient, ni que le générateur la trouve. La marge est d'un seul port.

## 2. Constats

### Bloquant
Aucun.

### À corriger
1. **Le générateur 5×5 ne tient pas les garanties décidées.** Échantillon de 50 graines, ce ne sont pas encore les mesures sur 1000 plateaux.
   - **Ce qui marche :** aucun échec, 75 à 80 cases.
   - **Ce qui manque :**
     - 39 plateaux sur 40 portent une alerte `jonction_ports` ;
     - aucun n'a 3 ports à chaque ville ;
     - seuls 11 sur 40 tombent en 2-3-2, par hasard.
   - **Causes :**
     - `generateur.js:227-228` : rotation des centrales au hasard ;
     - `:104` : villes tirées librement en 5×5 ;
     - `:305` : une jonction mal reliée n'est qu'une pénalité secondaire.
   - **Correction :** chantier générateur. D'ici là, le dire dans la documentation.
2. **Les bords comptent autant que les centrales.**
   - Avec 4 K2 et 9 centrales à 3 cases, on a toujours cases = 72 + nB1 et ports = 34 + nB1, où nB1 est le nombre de B1 posés.
   - La garantie demande au moins 39 ports, donc **nB1 ≥ 5**. Les 6 B1 imprimés et la cible de 75 ± 3 cases imposent **nB1 ≤ 6**.
   - Sur 60 plateaux tirés :
     - 18 % ont nB1 ≤ 4 : ils ne peuvent pas tenir la garantie, quelle que soit la rotation ;
     - 12 % ont nB1 de 7 ou 8 : plus que les 6 B1 imprimés.
   - Le générateur doit donc imposer nB1 = 5 ou 6, avec des B1 de préférence sur la rangée neutre.
   - `catalogue.js:165-166` doit préciser que « 78 cases, 40 ports » correspond à la pose avec 6 B1.
3. **Fonctions de tracé dupliquées** dans `tests/catalogue-5x5.test.js:35-86`. Il faut les mettre en commun dans une aide (par exemple `tests/aides-trace.js`), puis appeler `problemesTrace(m, '5x5')`.
4. **Tests qui dépendent de l'ordre du catalogue**, contrairement à `docs/10:47`. Lignes `:321`, `:505`, `:640-642` et `:657-658` : passer par l'id du modèle.
5. **Commentaire périmé** dans `bibliotheque.js:96-97` : « le seul catalogue livré à ce jour ».

### Remarques
6. **Tests qui ne testent rien** : `:130` (un calcul), `:401` (une constante comparée à elle-même), `:117` et `:138` (des répétitions).
7. **Recoupements entre fichiers de tests :**
   - le test d'API recoupe ceux de `catalogue-5x5.test.js` ;
   - l'export recoupe `formats.test.js` ;
   - le test `:602` dépend d'un libellé.
8. **Le 4×4 n'est pas affaibli** par le paramétrage de `problemesTrace` (vérifié).
9. **En-tête et commentaires de `catalogue.js` :**
   - `:8-15` et `:42-44` ne parlent que du 4×4 ;
   - `:170` cite C7 comme id commun avec le 4×4, alors que C7 n'existe pas en 4×4 ;
   - `:168-169` présente le raccord S d'un bord comme « latéral », ce qui prête à confusion.
10. **Les exemplaires par modèle ne sont consignés nulle part.** Les ajouter à `docs/24` § 8.
11. **Le plateau du test place B7m sur la rangée neutre,** alors que la préférence va à B1. Ce n'est pas une erreur : ce test prouve seulement l'existence d'une pose.
12. **Aucune recette navigateur n'utilise le vrai catalogue 5×5.** La recette S9 utilise un faux catalogue. Ajouter une étape « Nouveau → 5×5 ».
13. **Le reste est sain :**
    - l'API ;
    - le gel des modèles livrés ;
    - le refus de `__proto__` ;
    - la compatibilité avec `app.js`, `bibliotheque.js` et `sauvegarde.js`.

## 3. Documentation à mettre à jour avant la PR
- **README :**
  - le 5×5 est disponible, à environ 78 cases ;
  - liste des 6 modèles ;
  - générateur 5×5 **provisoire** ;
  - section « État ».
- **`docs/4` :** les catalogues 4×4 et 5×5, `modelesParGrille`, `nouveauDocument(grille)`.
- **`docs/10` :** facultatif.
- **`CLAUDE.md` :** l'état réel.
- **`docs/25` :**
  - version 3.02.0 ;
  - § 1.1 fait ;
  - § 1.2 complété avec le générateur 5×5 (centrales orientées, nB1 de 5 ou 6, villes 2-3-2, ports), puis les mesures, puis les seuils ;
  - § 1.4.
- **`docs/24` :** statut « arbitré, réalisé ».
- **`CHANGELOG.md` :**
  - **Ajouté :** catalogue 5×5, et « Nouveau → 5×5 » crée enfin un plateau ;
  - **Connu :** générateur 5×5 provisoire, seuils provisoires ;
  - dire que la mention « refusé tant que son catalogue n'existe pas » de la 3.01.0 est caduque.

## 4. Ce qui manque avant un 5×5 utilisable
1. **Le générateur 5×5 :**
   - centrales orientées ;
   - nB1 de 5 ou 6 ;
   - villes en 2-3-2 sur des jonctions à au moins 3 ports ;
   - « au moins 2 ports par jonction » en condition de rejet, et non plus en simple pénalité.
2. **Les mesures sur 1000 plateaux :** les 12 points de `docs/28`.
3. **Les seuils 5×5,** validés par l'advisor design de jeu.

## Verdict
- **Le catalogue peut être fusionné seul, utilisable en pose manuelle.** Les défauts du générateur 5×5 sont visibles, sous forme d'alertes, et non silencieux.
- **Conditions :**
  - mettre à jour la documentation du § 3, avec la mention « générateur 5×5 provisoire » ;
  - de préférence, appliquer les corrections 3 à 5.
- **Ne pas annoncer un « 5×5 utilisable »** avant le générateur, les mesures et les seuils.
