# Bannerlord : plateau hexagonal et matériel de jeu, consignes pour Claude

Projet : concevoir le matériel d'un jeu de plateau pour 2 joueurs : **tuiles hexagonales modulaires, cartes, jetons**, imprimés et collés sur carton. Le plateau est assemblé à la main (forme quelconque, noyau fixe) : l'outil ne le crée pas. L'ancien outil de plateau carré est archivé.

## Langue
Toujours répondre à l'utilisateur **en français**. Code, identifiants et commentaires en français sans accents dans les identifiants.

## Où sont les décisions (lire avant tout travail)
1. **`docs/00-direction.md`** : direction actuelle, décisions de l'utilisateur, ce qui est obsolète, ce qui reste à décider. **Prime sur tout le reste.**
2. `docs/01-outils-tuiles.md` : essai des outils (pymupdf, protograf…), limites mesurées, impression.
3. `regles/Bannerlord_Regles_V2.3.pdf` (source `.html`) : règles de jeu validées. Sa section 4A (mise en place du plateau carré) est **dépassée**.
4. `archives/plateau-carre/` : l'ancien outil de plateau carré 4×4 / 5×5 (version 5.00.0, étiquette git `5.00.0`) avec ses docs, tests et CHANGELOG. **Figé, ne pas modifier** ; ses tests se lancent depuis ce dossier (`node --test`, 750 OK).

## Règles fermes
- Commits avec l'**adresse anonyme GitHub** de l'utilisateur (déjà réglée dans la configuration locale du dépôt) ; ne jamais publier son adresse personnelle. Dépôt public sans licence (tous droits réservés) : https://github.com/vates15acceleratio-cyber/plateau-modulaire
- Ne jamais pousser ni fusionner sans demande. Les fonctionnalités se font sur une branche, fusionnée par PR.
- Ne rien installer au niveau du système (par exemple GTK/Cairo) sans l'accord de l'utilisateur.

## Commandes
- Un seul environnement Python à la racine, non versionné : `python -m venv .venv`, puis `.venv/Scripts/python.exe -m pip install protograf` (pymupdf et Pillow suivent). Lancer avec `.venv/Scripts/python.exe -I <script>`.
- Tuiles : voir `tuiles/README.md` (échantillon, contrôle, aperçu en gris).
- Avant de déclarer fini un travail sur les tuiles : régénérer, mesurer les hexagones (45 mm plat à plat, fond perdu 51 mm) et regarder le rendu, en couleur et en gris.

## Pièges connus
- protograf demande Cairo sous Windows : voir `docs/01-outils-tuiles.md` (contournement dans les scripts).
- Dans un script Python qui écrit du texte français, utiliser `’` plutôt que l'apostrophe droite dans les chaînes entre apostrophes.
- Rendu d'un PDF : pymupdf (`import pymupdf`). PDF d'une page HTML : Edge sans fenêtre via PowerShell `Start-Process` (voir comment les règles ont été exportées : `--headless=new --no-pdf-header-footer --print-to-pdf=...`).

## Atelier du plateau (`atelier/`)
- Page unique hors ligne, sans dépendance ni modules ES (`atelier/index.html`, ouverte en `file://`). Onglet Plateau en six modes : Générer, Créer à la main, Pinceau, Villes, Mes monoblocs, Bibliothèque ; onglets Inventaire et Partie fictive (table libre). Contrat : `docs/02-atelier-cahier-des-charges.md` (le §9 donne les règles en vigueur) ; mode d'emploi : `atelier/README.md`.
- Règles du plateau en vigueur (`docs/00-direction.md`, troisième série du 2026-11-20 ; `docs/02` §9 et §10) : terrain en monoblocs de 3 ou 4 cases, aucun tout en plaine (21 monoblocs validés, 49 plaines / 13 forêts / 13 marais), noyau fixe, 2 montagnes en blocs, 2 tuiles de remplissage facultatives, contact ≥ 3 pièces, trous en alerte ; le plateau est construit puis les villes sont posées **librement sur une Plaine** (2 neutres d'abord, puis 2 de déploiement par joueur), sans contrainte de bord ni de côté : seule compte la distance de 4 pas entre villes. Former sur une ville de déploiement est la règle.
- Tests : `node --test` lancé **depuis `atelier/`** (0 échec) ; règles sur plateaux générés : `node atelier/outils/verifier-regles.js 50` ; recette navigateur : `atelier/outils/recette.html` dans Edge **sans fenêtre** via PowerShell `Start-Process` (`--headless=new --disable-gpu --user-data-dir=<temp> --virtual-time-budget=20000 --dump-dom`), chercher `TOTAL : N OK, 0 ÉCHEC`.
- **Ne jamais ouvrir de fenêtre de navigateur visible sur le poste de l'utilisateur**, ne pas exécuter `atelier/Atelier.bat`, ne pas désactiver le bac à sable ; le dire dans chaque mission d'agent.
- Ne pas affaiblir la CSP de `atelier/index.html` (aucun script, style ni attribut `style=` en ligne ; pas d'`innerHTML` avec des données).
- Paquet transportable (Windows et Mac) : `python -I atelier/outils/empaqueter.py` → `dist/atelier-plateau.zip` (non versionné ; n'emballe que les fichiers suivis par git, arbre propre exigé).
- Catalogue, effets des événements et Troupes sont **provisoires** (étiquetés tels quels) : ne rien présenter comme décidé.

## État (2026-11-20)
- Branche `atelier-plateau`, **poussée sur GitHub, non fusionnée dans `main`**. `node --test` 305 OK, recette 631 OK, 250 plateaux générés conformes (les totaux ont baissé avec le retrait des règles de bord). Rapports `docs/02` à `docs/08`. **Commencer par `git fetch` puis `git pull`.**
- Méthode confirmée par l'utilisateur : orchestrateur, advisor, développeurs par lot, testeur, puis relecteur, versionneur. L'utilisateur a demandé d'aller plus vite sur les petites modifications : le dernier lot (villes libres) n'a pas eu de relecteur séparé. Pas encore de numéro de version ni de journal des changements pour le nouveau projet.
- Finalité annoncée : jeu de test en 1 contre 1 sur le même écran, app transportable Windows et Mac ; **la partie « jeu » viendra plus tard**, sur demande.
- En attente de l'utilisateur : effets des 8 événements ; numérotation des versions ; essai réel des lanceurs (Windows et Mac) ; questions de `docs/05`, `docs/06`, `docs/08`.
- Restes connus : `atelier/outils/mesures-catalogue-2.js` et `mesures-faisabilite.js` mesurent d'anciennes règles et ne tournent plus ; six captures de `docs/captures/` datent d'avant les villes libres ; le format de fichier est resté en version 2 alors que les villes neutres posées (`camp: 'neutre'`) sont nouvelles.
- Ensuite : feuilles d'impression des monoblocs, villes et événements (`tuiles/`), puis or, rations, marché, cartes et jetons.
