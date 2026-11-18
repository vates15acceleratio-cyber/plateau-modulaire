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

## État (2026-11-18)
- Branche `hexagonal-tuiles` (non poussée, non fusionnée) : archivage de l'outil carré, dossier `tuiles/` avec l'échantillon de 8 tuiles, nouveau `docs/`. **Commencer par `git fetch` puis `git pull`** : le travail se fait aussi sur un autre poste.
- Prochaine étape : concevoir les vraies tuiles (répartition par terrain, coût en rations, noyau), puis les autres mécaniques (or, rations, marché, phases), puis les cartes et jetons.
- À confirmer avec l'utilisateur : méthode de travail (équipe d'agents et versionneur) et numérotation des versions du nouveau projet ; avec l'archivage, le `CHANGELOG.md` est dans `archives/plateau-carre/`.
