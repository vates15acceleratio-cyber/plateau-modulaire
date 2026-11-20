# Création à la main : revue de code (2026-11-19)

Rapport du relecteur (lecture seule). Contrat : `docs/02-atelier-cahier-des-charges.md` §8. Périmètre : `git diff 82b2aed..HEAD -- atelier .gitattributes` (état `fa903b5`).

## Méthode et limites

- **Lus en entier** : `src/plateau.js`, `bibliotheque.js`, `controles.js`, `catalogue.js`, `vue-plateau.js`, `vue-creation.js`, `vue-monoblocs.js`, `vue-bibliotheque.js`, `app.js`, `Atelier.bat`, `Atelier.command`, `outils/empaqueter.py`. **Lus par leurs différences** : `partie.js`, `generateur.js`, `rendu.js`, `vue-inventaire.js`, `vue-partie.js`, `index.html`. **Parcourus par recherche** : `outils/recette.js`, les tests, les feuilles de style.
- **Exécuté** : `node --test` depuis `atelier/` (239 tests, 0 échec) et des scripts Node placés dans le dossier temporaire du système. Rien n'a été écrit dans le dépôt hors ce rapport.
- **Aucun navigateur n'a été ouvert**, `Atelier.bat` et `empaqueter.py` n'ont pas été exécutés. Les scénarios d'interface ont été rejoués sous Node en pilotant les **vraies vues** (`AT.vuePlateau.creer` et ses panneaux) avec un faux DOM minimal et un stockage en mémoire. « Reproduit » veut donc dire : reproduit sur le code réel, hors navigateur. Ce qui dépend du navigateur lui-même (événements pointeur, partage réel du `localStorage`, lecture d'une adresse `file://`) est marqué « lu seulement ».
- Les lanceurs ont été éprouvés par des **copies** dans des dossiers temporaires aux noms piégés : pour Windows, chaque `start` remplacé par `echo` (12 dossiers) ; pour Mac, sous le `sh` de Git Bash, avec une fausse commande `open` qui affiche ses arguments et le test de présence de Chrome forcé à vrai (6 dossiers). Aucun navigateur n'est lancé par ces copies.
- Scripts de revue, à relancer par `node <fichier>` : `<dossier temporaire de la session>\revue1.js` (modèle), `<dossier temporaire de la session>\revue2.js` (bibliothèque et vues, scénarios S1 à S8), `<dossier temporaire de la session>\revue3.js` (partie et rendu). Ce dossier temporaire peut être vidé par le système.
- Pendant la revue, `git status` montre 7 images modifiées dans `docs/captures/` (16 h 28 – 16 h 29). Elles ne viennent pas de cette revue.

## Verdict

**Aucun bloquant.** Le modèle (pièces personnelles, pinceau, stock, équilibre, générateur) est juste sur tout ce qui a été vérifié. Sur les pièces personnelles, les deux lecteurs rendent le même verdict aux réglages actuels ; ils divergent sur trois cas plus anciens que cette livraison (M14) et dès qu'un réglage `perso` change (M4).

Les défauts sont dans la **bibliothèque** : quatre constats importants, tous des pertes de plateaux enregistrés. Le plus exposé est I1. Il reste « important » et non « bloquant » parce qu'il demande deux fenêtres de l'atelier ouvertes en même temps et un enregistrement dans chacune ; lancer `Atelier.bat` deux fois devrait suffire à s'y trouver (non essayé).

## Vérifié et trouvé juste

| Sujet | Vérification | Résultat |
|---|---|---|
| Validation d'une pièce personnelle | 32 variantes passées à `plateau.valider` et à `partie.creer` : ville, cases disjointes, sans (0,0), 1 et 7 cases, identifiants `P`, `__proto__`, `constructor`, `X0`, `X01`, `X12345`, `x1`, doublon, case en double, coordonnée décimale, quantités 0 / 10 / texte, nom vide / trop long / caractère de contrôle, champs `perso` et `noyau` en trop, terrain d'événement, 25 pièces, objet à la place d'une liste | les deux lecteurs rendent le même verdict partout ; `Object.prototype` intact |
| Rotations d'une pièce personnelle | pièce de 4 cases, 6 rotations : cases distinctes, d'un seul tenant, ancre fixe, terrains dans l'ordre ; rotation d'une pièce posée avec événements | 6 formes distinctes ; l'événement dont la case change de terrain repart en réserve ; chevauchement refusé |
| Stock et contrôle 1 | 6 forêts peintes pour 5, une montagne d'une case ; fichier avec 3 exemplaires d'une pièce personnelle prévue en 2 et 2 × F3 | alertes « à prévoir en plus » et « montagne d'une case » ; erreurs « stock dépassé » pour les monoblocs ; totaux 64 / 91 inchangés |
| Pinceau et gomme | noyau, monobloc, clés et terrains invalides (`constructor`, `__proto__`, `tunnel`, hors bornes), remplacement d'une tuile portant un événement, d'une ville de déploiement, même terrain, 217 cases peintes | refus expliqués ; événement renvoyé en réserve ; camps nettoyés ; arrêt propre à 200 pièces, plateau toujours relisible |
| Un trait = une étape | trait de 3 cases par `geste`, puis Annuler | 1 étape ajoutée, 0 case restante après Annuler |
| `modifierModele` / `supprimerModele` | pièce posée : forme, quantité sous le nombre posé, nom, suppression | forme et suppression refusées avec explication ; nom accepté |
| `copierModeles` | collisions d'identifiants, deuxième copie, source invalide, identifiants inconnus, dépassement de 24, mutation de la copie | jamais de collision ; tout ou rien ; la source n'est pas partagée |
| Équilibre | plateau généré ; une plaine du bord retirée ; terrain seul rendu asymétrique | score 0 ; « non comparable », score `null`, 7 villes toujours listées ; score 2 (forme symétrique : comparable, c'est voulu) |
| Générateur | 30 graines × seuils 2 et 3 ; avec une pièce personnelle | 60 réussites, 91 cases, 7 villes, 64 pièces, 0 erreur, relisibles, `partie.creer` les accepte ; mêmes pièces avec ou sans pièce personnelle, note affichée |
| Identifiants piégés | pièces nommées `constructor`, `toString`, `valueOf`, `hasOwnProperty`, `0`, `NaN`… et graine `<svg onload=…>` dans un plateau valide | contrôles, résumé, inventaire, « reste à faire », palette, partie, bibliothèque : aucune exception |
| Stockage hostile | quota dépassé, stockage qui lève à chaque appel, stockage `null`, JSON avec `__proto__`, entrées `null`, clé `ouvert` = `__proto__`, travail mal formé ; import avec doublon, identifiant et date faux, nom `<img onerror>` | aucune exception ; le reste est accepté, les entrées fautives écartées avec leur raison |
| Import | réimport du même export ; import dépassant 40 | renuméroté `b3`, `b4`, rien d'écrasé ; refus tout ou rien |
| Partie avec pièce personnelle | plateau généré, pièce personnelle posée tournée (rotation 1), `partie.creer`, `serialiser`, `charger` | relue, pièce personnelle gardée, mêmes cases |
| Rendu, troisième lecteur | `vignette` et `dessinModele` (faux DOM) : pièce personnelle posée, modèle inconnu, identifiants piégés, plateau vide, camp et événement hors plateau | aucune exception |
| Sécurité de la page | recherche de `innerHTML`, `insertAdjacentHTML`, `outerHTML`, `eval`, `new Function`, `document.write`, `.style`, `'style'`, `cssText`, `setAttributeNS`, `srcdoc`, `javascript:` dans `atelier/src` ; `url(` et `@import` dans les styles ; CSP de `index.html` et `recette.html` | aucune occurrence hors commentaires ; `appliquer` lève sur l'attribut `style` (`rendu.js:134`) ; CSP identique à celle de l'archive ; noms saisis écrits par `textContent` ; export SVG sérialisé par `XMLSerializer` (texte échappé) |
| Recette | `outils/recette.js:24-39` | le stockage en mémoire est posé avant le démarrage ; la recette normale ne fait que lire le vrai stockage |
| Lanceur Windows, injection | copie avec `echo`, dossiers `a&b`, `a&calc&`, `100% pur`, `%EDGE%`, `x^y`, `(1) test)`, `!bang!`, `d#1`, `p%41q`, apostrophe, `;,=`, espaces et accent | la ligne de commande reste entre guillemets dans les 12 cas : aucune injection |
| Lanceur Mac, injection | copie avec fausse commande `open`, dossiers avec espace, apostrophe, guillemet, `$HOME`, accent grave, `;rm -x` | l'adresse arrive en un seul argument, sans expansion, dans les 6 cas : aucune injection (sous `sh` de Git Bash, pas sur un Mac) |
| Archive `dist/atelier-plateau.zip` | listage en lecture seule | 26 fichiers, tous sous `Atelier du plateau/`, `.command` en 755 sans retour chariot, ni chemin personnel ni adresse |

## Bloquant

Aucun.

## Important

### I1. Deux fenêtres de l'atelier : la dernière qui enregistre efface les fiches de l'autre
- **Où** : `src/vue-bibliotheque.js:106-118` (liste lue une seule fois, au démarrage), `:126-137` (`persister` réécrit toute la liste depuis la mémoire), `src/bibliotheque.js:324-331`. Aucune relecture avant écriture, aucun écouteur `storage`.
- **Scénario** : deux fenêtres ouvertes sur une bibliothèque vide. Fenêtre A : « Enregistrer sous » « Fait dans A ». Fenêtre B : « Enregistrer sous » « Fait dans B ». Le stockage ne contient plus que `b1 = Fait dans B`. A retouche et clique « Mettre à jour » : le stockage ne contient plus que `b1 = Fait dans A`. Chaque fenêtre affiche pourtant sa fiche comme enregistrée.
- **Reproduit** : oui (deux instances des vraies vues sur un même stockage en mémoire).
- **Lu seulement** : le partage réel du `localStorage`. Il est certain pour deux fenêtres de la même page. Pour deux copies du dossier (dépôt et paquet décompressé), je crois que les navigateurs Chromium partagent le stockage entre toutes les pages `file://` ; ce n'est pas vérifié ici.
- **Piste** : avant chaque écriture, relire le texte du stockage ; s'il a changé depuis la dernière lecture, fusionner (comme `importer`) ou refuser en le disant. Écouter `storage` pour recharger la liste.

### I2. L'attache « plateau ouvert » est rangée à part du travail en cours : après rechargement, « Mettre à jour » vise la mauvaise fiche
- **Où** : `src/vue-bibliotheque.js:99`, `:114-123` (clé `atelier-plateau:ouvert`, écrite tout de suite), `:168-172` (travail écrit 400 ms plus tard), `src/vue-plateau.js:608-617` (reprise).
- **Scénario 1** : fiches A (`b1`) et B (`b2`). Ouvrir A, retoucher, attendre la sauvegarde. Ouvrir B, et la page se recharge avant 400 ms sans `pagehide` (plantage, coupure). À la reprise : le plateau affiché est A retouché, l'en-tête dit « B (modifié) », le bouton propose « Mettre à jour « B » ».
- **Scénario 2** : deux fenêtres (voir I1). La fenêtre rouverte reprend le travail de l'une avec l'attache de l'autre : plateau de graine 2 sous l'en-tête « Fait dans A (modifié) ».
- **Reproduit** : oui, les deux. Le seul garde-fou est le nom affiché sur le bouton.
- **Piste** : ranger l'identifiant ouvert dans l'enregistrement du travail (une seule écriture, un seul format validé), et supprimer la clé séparée.

### I3. Un identifiant de fiche supprimée est réutilisé : Annuler rattache l'ancien plateau à la nouvelle fiche
- **Où** : `src/bibliotheque.js:101-108` (`prochainId` rend le plus petit numéro libre), `src/vue-plateau.js:163-173` et `src/vue-bibliotheque.js:370` (l'historique ne retient que l'identifiant).
- **Scénario** : enregistrer « Plateau A » (`b1`), le retoucher. « Nouveau plateau vierge ». Supprimer « Plateau A ». Enregistrer le vierge sous « Plateau Z » : il reçoit `b1`. Annuler : l'écran montre l'ancien plateau A (65 pièces), l'en-tête dit « Plateau Z (modifié) ». « Mettre à jour » réussit : la fiche Z contient le plateau A, son contenu d'origine n'est plus dans la bibliothèque.
- **Reproduit** : oui.
- **Piste** : ne jamais réutiliser un numéro (plus grand numéro connu + 1, ou compteur conservé dans le stockage).

### I4. Ce qui est illisible est écrasé sans copie, et l'avis qui le dit peut disparaître
- **Où** : `src/bibliotheque.js:129-144` (entrées écartées), `:311-318` ; `src/vue-bibliotheque.js:106-113`, `:126-137` (la liste sans les écartées est réécrite), `:181` (`avisStockage` remplacé par l'avis du travail) ; `src/app.js:243-248` (le plateau généré remplace le travail illisible à la fermeture).
- **Scénario** : `REGLAGES.perso.casesMax` passé à 7 dans `catalogue.js` (réglage que le cahier veut facile à changer). Enregistrer une fiche avec une pièce de 7 cases et une fiche ordinaire. Revenir à 6, ou ouvrir une autre copie de l'atelier. Au démarrage : une fiche sur deux, et l'avis affiché ne parle que du travail en cours. Renommer la fiche ordinaire : la fiche à 7 cases a disparu du stockage. Fermer : le travail en cours est remplacé par le plateau généré.
- **Variante** : une bibliothèque de `version` 2 (copie plus récente de l'outil) est remplacée entièrement au premier enregistrement. Là, l'avis l'annonce.
- **Reproduit** : oui, les trois effets.
- **Piste** : avant de réécrire, garder le texte brut sous une clé de secours (l'archive `plateau-carre` le fait déjà : `archives/plateau-carre/src/app.js:60`) ; conserver telles quelles les entrées écartées ; cumuler les avis au lieu de les remplacer.

## Mineur

| N° | Constat | Fichier:ligne | Scénario | Statut |
|---|---|---|---|---|
| M1 | Ouvrir la page avec `#graine=…` écrase le travail en cours à la fermeture | `src/app.js:234-248`, `src/vue-bibliotheque.js:150-153` | Travail sauvegardé : plateau fait main de 3 pièces. Ouvrir `index.html#graine=12`, fermer. Travail sauvegardé : plateau généré de 64 pièces | reproduit en rejouant à la main la suite d'appels de `demarrer` (pas `demarrer` lui-même) |
| M2 | Annuler pendant un trait de pinceau fait revenir la retouche annulée | `src/vue-creation.js:441-449`, `src/vue-plateau.js:163-167`, `src/app.js:170-176` | Peindre (3,0). Bouton enfoncé sur (4,0), Ctrl+Z, glisser en (5,0), relâcher : (3,0) est de nouveau là avec (4,0) et (5,0) | reproduit par appel de `geste` puis `annuler` ; l'enchaînement souris + clavier réel est lu seulement |
| M3 | Un plateau valide peut avoir des cases hors bornes ; un événement posé dessus donne un fichier refusé à la relecture | `src/plateau.js:934` (seule l'ancre est bornée ; `poser` borne les cases, `:239`), `:601-613` | Fichier modifié à la main : pièce personnelle de 6 cases en ligne, ancre (30,0). Accepté par les deux lecteurs, cases jusqu'à (35,0). Poser E1 en (33,0) : accepté ; relecture : « case invalide ». L'interface refuse alors « Enregistrer » et la sauvegarde automatique échoue | reproduit |
| M4 | Les bornes des pièces personnelles sont recopiées en dur dans la table de jeu | `src/partie.js:70-73`, `:291-315` | `REGLAGES.perso` élargi (7 cases, quantité 12, nom de 50 caractères) : le plateau s'enregistre et se relit, mais « Partie impossible : 2 à 6 cases attendues ». Même chose en dur dans l'aide (`src/vue-monoblocs.js:341`) | reproduit |
| M5 | Annuler en deçà du moment de l'enregistrement détache le plateau de sa fiche | `src/vue-plateau.js:146-167` | Retoucher, « Enregistrer sous » « Mon plateau », Annuler : en-tête « sans nom », « Mettre à jour » refusé. Aucune perte ; l'utilisateur doit enregistrer sous un nom à nouveau | reproduit |
| M6 | Deux fiches peuvent porter le même nom | `src/bibliotheque.js:150-161` | « Enregistrer sous » « Même nom » deux fois : `b1` et `b2`. Avec M5, on ne sait plus laquelle « Mettre à jour » vise | reproduit |
| M7 | Stockage plein : la fiche n'est gardée nulle part, pas même en mémoire | `src/vue-bibliotheque.js:8-9`, `:102-105`, `:126-133` | Quota atteint : « Enregistrer sous » échoue, liste vide. L'en-tête du fichier promet une bibliothèque « en mémoire le temps de la session » ; ce repli n'existe que si le stockage est absent. Le message est clair et les fichiers restent disponibles | reproduit |
| M8 | Lanceurs : l'adresse `file://` n'est pas encodée | `Atelier.bat:6`, `:10`, `:16` ; `Atelier.command:7`, `:9` | Dossier `d#1` ou `p%41q` : l'adresse passée à `--app=` contient `#` ou `%41` tels quels. Le navigateur devrait lire `#1/index.html` comme une ancre et `%41` comme « A » : page introuvable. Le repli final (`start "" "%FICHIER%"`, `open "$PAGE"`) n'a pas ce défaut | adresse produite : reproduit ; effet dans le navigateur : lu seulement |
| M9 | `Atelier.command` n'est pas exécutable dans le dépôt | `git ls-files -s` : mode 100644 | Seule l'archive lui donne 755. Depuis un clone sur Mac, le double-clic échoue | reproduit (mode) ; effet sur Mac : lu seulement |
| M10 | `empaqueter.py` emballe ce qu'il trouve sur le disque | `outils/empaqueter.py:15`, `:53` | Tout fichier présent dans `src/` ou `styles/` part dans l'archive, suivi par git ou non (brouillon, copie de secours). Rien de tel aujourd'hui : 22 fichiers suivis, 22 emballés | lu seulement |
| M11 | L'archive présente dans `dist/` est en retard sur `HEAD` | `dist/atelier-plateau.zip` | `src/rendu.js` et `styles/base.css` diffèrent de l'arbre de travail ; ces deux fichiers ont été touchés en dernier par `fa903b5`, l'archive date donc sans doute d'avant. À refaire avant de la transmettre | écart reproduit ; cause déduite |
| M12 | Une pièce posée au-delà de sa quantité ne se renomme pas depuis l'éditeur | `src/plateau.js:827` | Fichier avec 3 exemplaires d'une pièce prévue en 2 : l'éditeur envoie nom et quantité (2, inchangée), refusé « la quantité ne peut pas descendre en dessous » | reproduit sur `modifierModele` |
| M13 | Le `README.md` de l'atelier ne parle ni des lanceurs ni du paquet | `atelier/README.md` | Seul le `LISEZ-MOI.txt` de l'archive les décrit | lu |
| M14 | Trois plateaux acceptés par `plateau.valider` sont refusés par `partie.validerPlateau` | `src/plateau.js:943-982` (camps et événements : clé bien formée seulement) ; `src/partie.js:337`, `:375-378` | Plateau vide ; camp sur une case qui n'existe pas ; événement sur une case qui n'existe pas. Ils s'ouvrent dans l'onglet Plateau et entrent dans la bibliothèque (les contrôles y comptent des erreurs : 6 sur le cas essayé), puis « Partie impossible ». Ces vérifications datent d'avant `82b2aed` : la table de jeu est volontairement plus stricte | reproduit |

## Écarts par rapport au §8

- **§8.1, pièce posée** : le cahier dit « modifier ou supprimer une pièce personnelle déjà posée est refusé ». Le code refuse la forme et la suppression, mais accepte le nom et la quantité (`src/plateau.js:811-843`, annoncé dans le README). Écart assumé, à faire confirmer.
- **§8.1, stockage** : « repli propre s'il est absent, plein ou illisible ». Absent : conforme. Plein : refus propre, sans repli (M7). Illisible : pas d'exception, mais le contenu est perdu à l'écriture suivante (I4).
- **§8.2, gomme** : le cahier prévoit la confirmation pour un monobloc. Le code l'étend au noyau, qui peut donc être retiré (voir question 3).
- **Hors cahier** : les deux lanceurs, `empaqueter.py` et `.gitattributes` ne figurent pas au §8.
- Le reste du §8 est présent : plateau vierge, grille de rayon 7, palette avec stock, glisser-déposer, rotation, « reste à faire », pinceau (un trait = une étape, contrôles une fois par trait), éditeur de monoblocs, copie depuis la bibliothèque, inventaire à part, bibliothèque complète, sauvegarde et reprise, trois lecteurs, test d'intégration.
- **Clavier** (lu seulement) : modes, palette, pose par Entrée, pinceau par Entrée, grille de l'éditeur aux flèches, fenêtre de confirmation, champ de renommage ont tous un chemin au clavier. Le glisser-déposer a un équivalent au clic.
- **Libellés** : rien ne présente une règle provisoire comme décidée, sauf le point de la question 2.

## Questions pour l'utilisateur (pas des défauts de code)

1. **Montagnes personnelles.** Un monobloc personnel peut être tout en montagne, de 2 à 6 cases. Seule la montagne d'une case du pinceau rappelle « blocs de 4 ou 5 ». Faut-il la même alerte pour un monobloc de 2, 3 ou 6 montagnes ?
2. **« Plateau terminé ».** Le message n'apparaît que si les 64 pièces du catalogue provisoire sont posées (`src/vue-creation.js:109-110`, `:365`). Un plateau fait main plus petit, sans erreur, n'est jamais « terminé ». Est-ce voulu ?
3. **Noyau.** La gomme peut retirer le noyau après confirmation. Faut-il l'interdire ?
4. **Pièce posée.** Nom et quantité restent modifiables quand la pièce est posée. Est-ce accepté ?
5. **Deux fenêtres.** Faut-il seulement fusionner (I1), ou aussi avertir qu'une autre fenêtre de l'atelier est ouverte ?
6. **Noms en double** dans la bibliothèque : les refuser, ou les numéroter ?
7. **Annuler après un enregistrement** (M5) : le plateau doit-il rester attaché à sa fiche ?
