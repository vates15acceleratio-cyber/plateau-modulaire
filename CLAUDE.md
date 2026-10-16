# Plateau modulaire — consignes pour Claude

Outil web hors ligne (page unique `index.html` + `src/*.js`, sans dépendance ni modules ES, ouvert en `file://`) pour concevoir un plateau de jeu modulaire pour 2 joueurs, imprimé en tuiles de carton. Le périmètre est le plateau seulement (pas de règles de jeu ni de moteur).

## Langue
Toujours répondre à l'utilisateur **en français**. Code, identifiants et commentaires en français sans accents dans les identifiants.

## Où sont les décisions (lire avant tout travail)
1. **`docs/18-decisions-v2.md`** : décisions de l'utilisateur pour la version 2 ; **prime sur tout le reste** (dont les retours après essai du 4×4, en fin de fichier).
2. Avis des advisors v2 : `docs/19-avis-design-v2.md` (R1 à R4, apparitions, raccourci de coin), `docs/20-avis-geometrie-v2.md` (cotes 4×4 / 5×5, règles des tuiles, arbitrages), `docs/22-avis-seuils-v2.md` (seuils d'équilibre, cadrage 5×5).
3. Mesures : `docs/21-mesures-catalogue-v2.md` (catalogue 4×4 v2) ; audits : `docs/23-audit-securite-v2.md`.
4. Conventions de code et contrats entre modules : `docs/4-architecture.md`, `docs/10-contrats-interface.md`.
5. Historique de la version 1 (pour le contexte seulement) : `docs/0-brief.md`, `docs/3-synthese.md`, `docs/1b-…` à `docs/17-…`.

## Interdits et règles fermes
- **Format hexagonal : ne rien faire, pas même préparer**, tant que l'utilisateur n'a pas donné son feu vert.
- Commits avec l'**adresse anonyme GitHub** de l'utilisateur (déjà réglée dans la configuration locale du dépôt) ; ne jamais publier son adresse personnelle. Dépôt public sans licence (tous droits réservés) : https://github.com/vates15acceleratio-cyber/plateau-modulaire
- Ne pas affaiblir la politique CSP de `index.html` (pas de script, style ou attribut `style=` en ligne ; utiliser des classes CSS).

## Méthode de travail voulue par l'utilisateur
- Équipe d'agents du brief (`docs/0-brief.md` §8) : advisors en lecture seule, sous-agents de production avec un périmètre de fichiers précis, puis **testeur** et **relecteur** après chaque module, puis **versionneur** (numéro `X.xx.x`, étiquette git sans « v », entrée dans `CHANGELOG.md`).
- L'orchestrateur consigne chaque rapport d'agent dans `docs/`, tranche les points ouverts et soumet à l'utilisateur les décisions qui lui reviennent (règles de jeu, publication, licence…).
- Avant de déclarer un travail fini : `node --test` (0 échec) et les deux recettes navigateur à 0 échec.

## Commandes
- Tests : `node --test` à la racine (Node 24 refuse `node --test tests/`).
- Recettes navigateur (Edge sans fenêtre ; sur cette machine il faut passer par PowerShell `Start-Process`, la sortie par Bash est vide) :
  `Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList @("--headless=new","--disable-gpu","--user-data-dir=<dossier temporaire>","--virtual-time-budget=<budget>","--dump-dom","file:///<dossier du projet>/outils/<page>.html") -RedirectStandardOutput <fichier> -RedirectStandardError <fichier2> -Wait -NoNewWindow`
  avec `recette-interface.html` (budget 8000) et `recette-p2.html` (budget 300000) ; chercher la ligne `TOTAL : N OK, 0 ÉCHEC`.
- Serveur local de test (pour le panneau navigateur) : `node outils/serveur.js 8765`.
- Rendu d'un PDF exporté : PyMuPDF (`import pymupdf`).

## Pièges connus
- Dans une chaîne JS entre apostrophes droites, une apostrophe française casse la syntaxe : utiliser `’` ; lancer `node --check` après chaque modification.
- Ne jamais modifier le fichier d'un sous-agent en cours avec une expression régulière large.

## État (2026-10-16)
- Version **2.01.0** : règles v2 sur la grille 4×4, catalogue 4×4 v2 (13 modèles, 22 tuiles imprimées, coins K2 et K4, aucune poche), poses illimitées, rôle respecté à la pose, bibliothèque large (clic = poser, double-clic = modifier, clic droit = retirer), interface 5×5 (bouton « Nouveau », choix de la grille, rangée neutre).
- Points ouverts à soumettre à l'utilisateur : 63 cases par plateau au lieu de ≈ 60 (effet du tirage avec répétition) ; seuils d'équilibre à revoir avec les nouvelles mesures (`docs/21-mesures-catalogue-v2.md`).
- À faire ensuite : **catalogue 5×5** (≈ 75 cases, cases Ø 24, sans poches, coins dans l'esprit de K2 / K4) et ses mesures ; seuils 5×5 par l'advisor design de jeu ; recette, version, publication.
