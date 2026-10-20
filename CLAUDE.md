# Plateau modulaire — consignes pour Claude

Outil web hors ligne (page unique `index.html` + `src/*.js`, sans dépendance ni modules ES, ouvert en `file://`) pour concevoir un plateau de jeu modulaire pour 2 joueurs, imprimé en tuiles de carton. Le périmètre est le plateau seulement (pas de règles de jeu ni de moteur).

## Langue
Toujours répondre à l'utilisateur **en français**. Code, identifiants et commentaires en français sans accents dans les identifiants.

## Où sont les décisions (lire avant tout travail)
1. **`docs/18-decisions-v2.md`** : décisions de l'utilisateur pour la version 2 ; **prime sur tout le reste** (dont les retours après essai du 4×4, en fin de fichier).
2. Avis des advisors v2 : `docs/19-avis-design-v2.md` (R1 à R4, apparitions, raccourci de coin), `docs/20-avis-geometrie-v2.md` (cotes 4×4 / 5×5, règles des tuiles, arbitrages), `docs/22-avis-seuils-v2.md` (seuils d'équilibre, cadrage 5×5).
3. Mesures : `docs/21-mesures-catalogue-v2.md` (catalogue 4×4 v2) ; audits : `docs/23-audit-securite-v2.md`.
4. Conventions de code et contrats entre modules : `docs/4-architecture.md`, `docs/10-contrats-interface.md`.
5. Encore en vigueur malgré l'archivage : `archives/2` (conventions côtés / coins, D3 / D4 / D10), `archives/6` (prépresse, palette), `archives/16` (critère d'équilibre), `archives/11` (B1 sécurité, I1, I2).
6. Historique de la version 1 (pour le contexte seulement) : `docs/0-brief.md`, `docs/archives/3-synthese.md`, `docs/archives/` (avis, mesures et revues de la version 1).

## Interdits et règles fermes
- Commits avec l'**adresse anonyme GitHub** de l'utilisateur (déjà réglée dans la configuration locale du dépôt) ; ne jamais publier son adresse personnelle. Dépôt public sans licence (tous droits réservés) : https://github.com/vates15acceleratio-cyber/plateau-modulaire
- Ne pas affaiblir la politique CSP de `index.html` (pas de script, style ou attribut `style=` en ligne ; utiliser des classes CSS).

## Méthode de travail voulue par l'utilisateur
- Équipe d'agents (réorganisée le 2026-10-19, `docs/72`), définie dans `.claude/agents/` : **`conseiller` Opus** en lecture seule (géométrie, design de jeu, prépresse ; mesures et images avant tout code) ; **`producteur`, `testeur` et `relecteur` en Sonnet**, périmètre de fichiers précis, en parallèle si les fichiers sont distincts ; **`versionneur` en Haiku** (numéro `X.xx.x`, étiquette git sans « v », entrée dans `CHANGELOG.md`).
- Pour ce dépôt, cette répartition prime sur celle du `CLAUDE.md` global (choix de l'utilisateur, 2026-10-16).
- L'orchestrateur consigne chaque rapport d'agent dans `docs/`, tranche les points ouverts et soumet à l'utilisateur les décisions qui lui reviennent (règles de jeu, publication, licence…).
- Avant de déclarer un travail fini : `node --test` (0 échec) et les deux recettes navigateur à 0 échec. Sans PyMuPDF (`pip install pymupdf`), 7 tests de rendu PDF sont sautés : c'est le cas sur cette machine.

## Commandes
- Tests : `node --test` à la racine (Node 24 refuse `node --test tests/` ; la CI GitHub tourne en Node 22).
- Recettes navigateur (Edge sans fenêtre ; sur cette machine il faut passer par PowerShell `Start-Process`, la sortie par Bash est vide) :
  `Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList @("--headless=new","--disable-gpu","--user-data-dir=<dossier temporaire>","--virtual-time-budget=<budget>","--dump-dom","file:///<dossier du projet>/outils/<page>.html") -RedirectStandardOutput <fichier> -RedirectStandardError <fichier2> -Wait -NoNewWindow`
  avec `recette-interface.html` (budget 8000) et `recette-p2.html` (budget 300000) ; chercher la ligne `TOTAL : N OK, 0 ÉCHEC`.
- Serveur local de test (pour le panneau navigateur) : `node outils/serveur.js 8765`.
- Rendu d'un PDF exporté : PyMuPDF (`import pymupdf`).

## Pièges connus
- Dans une chaîne JS entre apostrophes droites, une apostrophe française casse la syntaxe : utiliser `’` ; lancer `node --check` après chaque modification.
- Ne jamais modifier le fichier d'un sous-agent en cours avec une expression régulière large.

## État (2026-10-19)
- Le travail se fait aussi sur un autre poste : **toujours commencer par `git fetch` puis `git pull`**. Les fonctionnalités se font sur une branche, fusionnée par PR. Le `main` local peut être en retard : comparer avec `origin/main`.
- **Version 5.00.0 sur `main`** (étiquette `5.00.0`, PR #8 fusionnée). Contenu : 5×5 très connecté (`docs/53` à `docs/63`), catalogue 5×5 « P » de 31 tuiles (LC11 Coins opposés, LC12 Deux ponts ouverts, Étoile LE1 hors tirage `horsTirage: true`, LC2 retiré), R3 assouplie sur les centrales 5×5, **8 villes à positions fixes** (1,1) (4,1) (2,2) (3,2) (2,3) (3,3) (1,4) (4,4) avec écart de 3 cases partout (générateur `rechercherPose5x5` : place puis orientation des centrales), critères à 8 villes, erreur au-delà de 8 villes, **campements** (jeton feu de bois Ø 30, siège Ø 30, deux formats), **16 jetons recto-verso** (campement / ville, deux pages A4 en miroir), régénération proposée pour les anciens 5×5. Rapports `docs/64` à `docs/71`. `node --test` 750 OK, recettes 365 / 125 OK.
- **Prochaine étape** : à définir avec l’utilisateur (voir les points ouverts).
- **Format hexagonal : feu vert donné le 2026-10-19** (cadrage : `docs/72-hexagonal-cadrage.md`). Sur `main`, ce CLAUDE.md dit encore « ne rien faire » : il faut le mettre à jour à la fusion de la branche `hexagonal`.
- **Branche `hexagonal` (2026-10-20, worktree `plateau-modulaire-hex`)** : lots 1 à 6 produits (`docs/76` à `82`), conseiller `80`, recette `83` (60 tests), revue `84` (prête pour PR après corrections). Décisions provisoires confirmées par l’utilisateur (`docs/72`). **Corrections en cours (producteur interrompu, travail partiel commité)** : faits : D1 (`graphe.js` garde `lier`), D2 (rotation invalide dans `orienterTuiles`), commentaires `graphe.js`, `aide.js` hexagonal ; tests 966, 959 OK, 0 échec. **Reste** : vérifier le message `ville_peu_de_ports` en « siège i » (`docs/84` constat 3) ; remarques 7 à 9 de `84` (fabrique unique du catalogue hex dans `tests/aides-rendu-hex.js`, durée 6 s, test `typeof` interface-hex:667) ; documentation (README, `docs/4`, `10`, `25`, `81`) ; rapport `docs/85` ; recettes ; versionneur 6.00.0 ; PR vers `main` sans fusionner.
- **Points ouverts** : validation par l’advisor prépresse (jeton campement, marge 4,97 mm de LC12, recto-verso) ; audit de sécurité des derniers ajouts ; la 9e ville est signalée en erreur mais pas refusée ; vignette de LE1 sans mention « hors tirage » ; reste `docs/25-travail-restant.md` (affichage mobile, régions thématiques).
