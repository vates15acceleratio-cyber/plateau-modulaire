# Revue de la branche passages (relecteur, Opus 5.5), 2026-10-18

Périmètre : `origin/main..passages` (15 commits, de 302cc29 à 472201d ; le `main` local est en retard, à 3.03, la base de la PR est `origin/main` = df79b1f). La revue porte surtout sur ce qui a suivi `docs/41` (`docs/45` à `docs/50`). Lecture seule : aucun fichier du dépôt n'a été modifié.

## Résultats
- `node --test` : 681 tests, 674 OK, 0 échec, 7 ignorés (PDF), 76 s. Mesure du test de temps : 4×4 0,6 s, 5×5 7,9 s, pour une limite de 12 s.
- Recettes Edge sans fenêtre (profils dans le scratchpad) : `recette-interface` **320 OK, 0 ÉCHEC** ; `recette-p2` **116 OK, 0 ÉCHEC**.
- CI GitHub sur 472201d : verte (165 s ; 5×5 du test de temps à 4,7 s). Le run du 21e2e22 avait échoué sur l'ancienne limite de 5 s (5630 ms).

## Constats

### Bloquant
Aucun.

### À corriger
1. **Rejet de S en 4×4 : la décision et le code se contredisent.** `docs/18` (réponse 1 au `48`) dit : « le générateur continue de rejeter S ≥ 5 dans les deux formats ». `graphe.js:40` et `docs/10` reprennent « le même dans les deux formats », et `docs/25:60` écrit « rejet à 5 dans les deux ». Or `generateur.js:220` contient `REJET_S = { '4x4': false, '5x5': true }`, et le tableau du `docs/48` (§ 4) dit « 4×4 : aucun (classement) ». Le code reproduit le comportement de la 3.04 ; c'est le texte de la décision qui est faux. Correction : faire confirmer par l'utilisateur, puis corriger la note dans `docs/18`, ainsi que `graphe.js:40` (commentaire), `docs/10` et `docs/25`. Il n'y a aucun effet pratique : un plateau 4×4 généré a toujours S ≤ 1.
2. **Un document neuf ouvert par la 3.04 perd ses passages, sans aucun message.** Les documents enregistrés gardent `version: 2`. Ils contiennent `pivots`, `passages` et `poids`, que la 3.04 retire à la lecture sans alerte. Vérifié : en 3.04, les modèles Q1, P3, etc. restent « complets », mais P3 perd sa liaison en T et Q1 son virage (script `scratchpad/relecteur-passages/compat.js`). Le risque est réel, puisque l'utilisateur travaille sur deux postes, et la sauvegarde automatique de la 3.04 réécrit le document abîmé. Correction proposée : dans `sauvegarde.js` (`versJSON`), écrire `version: 3` dès qu'un modèle porte des passages ou des pivots. Il faut alors ajouter 3 aux versions lues, et le test de compatibilité suit. La 3.04 refuse proprement une version inconnue (« Version de fichier absente ou inconnue »). À défaut, le signaler au moins dans la rubrique « Connu » du CHANGELOG. `docs/46:69` (« le format de sauvegarde ne change pas ») est à nuancer.
3. **Le test de temps reste fragile hors CI.** `tests/generateur.test.js:191-199` mesure le temps écoulé (horloge) alors que la suite tourne en parallèle avec 8 fils de stock (`stock-et-catalogue-precedent.test.js:46`, 2 × `FILS = 4`). Le testeur a mesuré 8,6 à 14 s pour une limite de 12 s (`docs/49`). Correction : mesurer le temps processeur du processus (`process.cpuUsage()` : chaque fichier de test a son propre processus, donc la mesure ne dépend pas des autres fichiers), ou lancer les fils de stock à la demande dans leur test plutôt qu'au chargement du fichier.
4. **Le démarrage depuis une sauvegarde automatique 3.04 n'est testé nulle part.** C'est le cas que rencontrera la plupart des utilisateurs qui mettent à jour. `app.js:334` (`else if (aCataloguePrecedent(init.doc))`) n'est exécuté par aucun test ni aucune recette. Les autres écarts relevés en fin de `docs/49` restent ouverts : Ctrl+Y, refus répété dans le navigateur, document 5×5. Correction : ajouter à `recette-p2` (ou `recette-interface`) une étape qui écrit un document 3.04 dans `localStorage`, relance `demarrer()` dans une iframe d'`index.html` et vérifie la boîte, « Garder mes tuiles », puis « Charger », Ctrl+Z et Ctrl+Y ; y ajouter le cas 5×5 (`tests/donnees/document-3.04-5x5.json`).

### Remarques
5. **`poids` : la validation et le tirage ne disent pas la même chose.** `modele.js:274` met `poids_invalide` dans les erreurs, ce qui rend le modèle non posable, alors que `poidsTirage` (`modele.js:946`) retombe simplement sur les exemplaires. De plus, `validerModele` ne borne pas le poids à 999, contrairement à `sauvegarde.js:156`. Ces cas sont inatteignables par fichier, puisqu'un poids invalide est retiré à la lecture. Pour aligner : rendre l'erreur une alerte, ou ajouter la borne 999 dans les deux.
6. **Le poids est invisible dans l'interface.** Si l'utilisateur change les exemplaires d'un modèle livré, la fréquence de tirage ne change pas, car le poids prime. Seule l'infobulle le dit (`editeur-tuile.js:823`). C'est acceptable (`docs/47`), mais à dire dans le README.
7. **La proposition revient à chaque démarrage tant que l'utilisateur refuse** (sauvegarde automatique 3.04). C'est conforme à `docs/47:56` et au comportement v1 → v2. On pourrait retenir le refus pour la session.
8. **Les seuils dépendent du format, pas du catalogue.** Un document 5×5 qui garde le catalogue 3.04 passe aussi à l'alerte S ≥ 7, alors que la 3.04 l'alertait dès 5. C'est conforme à la lettre de la décision ; à mentionner dans le CHANGELOG.
9. **`casesParMoitie` et le compteur « Cases » ne comptent pas les jonctions de la même façon.** `graphe.js:795` compte les tuiles posées, même dont le modèle est introuvable, alors que `controles.js:197` (`M.portsJonction(...).tuiles === 4`) les ignore sans doute. Il ne peut y avoir d'écart que dans ce cas, déjà signalé par la lacune « modèle introuvable ». Pour aligner : réutiliser `M.portsJonction`.
10. **Tests.**
    - Le test des goulets (`mesures-organiques.test.js:307`, « 12 graines : aucun ») vérifie un résultat, pas la préférence. Mieux : comparer, sur les mêmes graines, la clé avec et sans le terme des articulations.
    - Les empreintes (`generateur-5x5.test.js:448`, `passages.test.js:375`) figent l'implémentation. Elles sont utiles comme garde, mais tout réglage du générateur oblige à les régénérer.
    - Le test du stock porte sur 100 graines, alors que la cible de `docs/18` est mesurée sur 200 (95,5 % et 97,5 % sur 200 dans `docs/50`). C'est acceptable vu la marge ; le dire dans le titre ou le commentaire du test.
11. **Conseil 4×4 « rangée centrale »** (`graphe.js`, `equilibre.js:22`) : il reste juste (0 % de « 5 contre 2 » sur les 3 paires, `docs/48`), mais le générateur ne le suit plus par défaut. On pourrait le formuler comme un conseil de pose à la main.

## Conformité aux décisions (fin de `docs/18`)
Toutes les décisions sont appliquées, et chacune est couverte par un test :
- pas de traversant (P3 gardé, comme décidé) ;
- un passage par centrale en 4×4 ;
- pas de passage vers un coin ni depuis une apparition ;
- pas de miroir (B7m retiré) ;
- rythme ≤ 3, avec le raccourci compté comme zone d'intérêt ;
- Q2 gardé, K2 inchangé ;
- 78 à 81 cases en 5×5 ;
- moitiés égales ;
- stock qui permet de monter au moins 90 % des plateaux ;
- proposition du nouveau catalogue à l'ouverture et au démarrage, le refus laissant le document inchangé ;
- S par format (alerte à 5 et à 7, information à 4 et à 5-6) ;
- préférence contre les articulations en 5×5 ;
- jonctions variées par défaut ;
- rythme et accès en information, avec « bien au-dessus » si la chaîne atteint 7 ou distMax 6.

Seule exception : le point 1 (rejet de S en 4×4). Rien n'a été appliqué sans décision : les choix restants (stock, cible des cases 58 / 80, ordre de la clé des finalistes, limite de 12 s) sont des arbitrages de l'orchestrateur, consignés dans `docs/46` à `docs/50`. L'option « écart de chemins en 4e terme » (`docs/48` § 5.2) n'est pas appliquée, ce qui est correct puisqu'elle n'a pas été décidée.

Sécurité des fichiers JSON : `poids` est borné (de 1 à 999) ; pivots et passages sont plafonnés (8 et 16) et leurs coordonnées bornées. `bibliothequeCataloguePrecedent` est protégée par `try` et ne s'applique qu'à un document déjà lu et nettoyé (aussi depuis la sauvegarde automatique). Les textes de la proposition passent par `textContent`, sans attribut `style` (CSP respectée, vérifié par la recette). Pas de pollution par `__proto__` (testé).

## Documentation à mettre à jour avant PR / version
- **`CLAUDE.md` (État)** : la date (2026-10-17), « Prochaine étape : réponses aux 6 questions de `docs/45` », « catalogues non branchés » et les compteurs 610 / 312 sont périmés. À remplacer par :
  - catalogues organiques branchés (`docs/46` à `docs/50`) ;
  - 681 tests (674 OK, 7 ignorés), recettes 320 / 116 ;
  - suite : versionneur, puis PR ;
  - piège à ajouter : le `main` local est en retard, comparer à `origin/main`.
- **`README.md`** :
  - l. 22 et 23 : « 60 à 63 cases », à remplacer par environ 58 ; « environ 78 », par 78 à 81 ;
  - l. 25 et 26 : les catalogues 3.04 (13 modèles / 22 tuiles ; C7, C8, B7m) sont à remplacer par Q1, Q2, B1, B8, K2, K4 (24 tuiles) et U1, P1, P2, P3, P5, B1, B7, K2 (37 tuiles) ;
  - l. 27 : « alerte si le score atteint 5 », à remplacer par 5 en 4×4 et 7 en 5×5 ;
  - ajouter les passages sans case (un passage = 1 déplacement), l'outil Passage et les pivots dans l'onglet Tuiles (touche P, Maj+clic), la proposition du nouveau catalogue aux documents 3.04, la distinction poids / exemplaires ;
  - l. 55 : le paragraphe de version.
- **`CHANGELOG.md`** : l'entrée de la nouvelle version, qui manque.
  - Ajouté : passages et pivots (modèle, graphe, rendu, PDF Q/C, éditeur) ; mesures rythme, accès et moitiés ; `poids` ; `PM.catalogue.precedent` ; proposition du nouveau catalogue.
  - Modifié : les catalogues 4×4 et 5×5 remplacés ; le stock ; seuils S par format ; jonctions variées par défaut ; générateur (moitiés, orientation 4×4, 78 à 81 cases, affinage, articulations) ; cible des cases 58 / 80.
  - Corrigé : « 5 contre 2 » sans apparition ; `casesParMoitie` sur un plateau incomplet.
  - Connu : compatibilité descendante (point 2) ; recettes manquantes (point 4) ; articulations en 4×4 (1,5 %) ; conseil 5×5 à remesurer ; mobile ; hexagonal.
- **`docs/4-architecture.md`** :
  - l. 31 : « 21 tuiles » et « 30 tuiles » sont les poids. Les tuiles imprimées sont **24** et **37**.
  - l. 34 (`sauvegarde.js`) : ajouter `poids` et `bibliothequeCataloguePrecedent`.
  - l. 35 (`graphe.js`) : ajouter `seuilS` / `seuilSInformation` par format.
  - l. 37 (`generateur.js`) : ajouter les jonctions variées par défaut et la préférence contre les articulations.
  - Tests : citer `tests/aides-stock-worker.js` (fils de calcul) et `tests/donnees/`.
- **`docs/10-contrats-interface.md`** : corriger « seuil de rejet… le même dans les deux formats » (point 1), et nuancer la compatibilité des documents (point 2).
- **`docs/25-travail-restant.md`** :
  - l. 1 : le titre « point d'arrêt du 2026-10-16 » est daté ;
  - l. 60 : corriger « rejet à 5 dans les deux » ;
  - § 1.4 : y reporter les écarts de recette (point 4) et la compatibilité descendante (point 2).
- **`docs/18`** : la note de l'orchestrateur sur le point 1, après confirmation de l'utilisateur.

## Version proposée : **4.00.0 (Majeure)**
La convention du CHANGELOG est « majeure » pour une rupture de règles ou de compatibilité, ou pour une perte visible (2.00.0 : nouveau catalogue et nouvelles règles ; 3.00.0 : plusieurs capacités d'un coup et une perte). Ici :
- **Nouvelle règle de déplacement** : les passages sans case, où un passage compte 1 déplacement et les cases reliées sont voisines.
- **Catalogue livré entièrement remplacé** dans les deux formats. C1 à C8, B3 à B7m et B7m disparaissent des nouveaux documents ; le nombre de cases change (4×4 ≈ 58 au lieu de 60-63 ; 5×5 78 à 81).
- **Nouvelle capacité d'édition** : l'outil Passage et les pivots.
- **Format des documents enrichi** (pivots, passages, poids), illisible correctement par la 3.04. Les documents 3.04 s'ouvrent inchangés, et le nouveau catalogue leur est proposé.
- **Comportement visible modifié** : seuils de S par format (5×5 : 5 → 7) et jonctions variées par défaut en 4×4.

Une version mineure (3.05.0) sous-estimerait le changement : la 3.04 s'est déjà limitée à refaire un générateur à format et catalogue constants.

## Verdict
**Prêt pour PR après :**
- le point 1 (faire trancher le texte du rejet de S en 4×4 et aligner les docs) ;
- le point 2 (`version: 3` pour les documents à passages, ou au minimum la mention « Connu ») ;
- les mises à jour de documentation ci-dessus (CLAUDE.md, README, CHANGELOG 4.00.0, `docs/4`, `docs/10`, `docs/25`).

Les points 3 (test de temps) et 4 (recette du démarrage depuis la sauvegarde automatique 3.04) sont fortement recommandés avant la version, mais ne bloquent pas la PR : la CI est verte. Les remarques 5 à 11 peuvent attendre et sont à noter dans `docs/25`.
