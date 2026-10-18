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

## État (2026-10-19)
- Le travail se fait aussi sur un autre poste : **toujours commencer par `git fetch` puis `git pull`**. Les fonctionnalités se font sur une branche, fusionnée par PR. Le `main` local peut être en retard : comparer avec `origin/main`.
- **Version 4.00.0 sur `main`** (étiquette `4.00.0`).
- **Branche `connexions-5x5` (en cours, non fusionnée)** : refonte du **5×5 très connecté** (remarques de l’utilisateur après essai de la 4.00.0 ; décisions en fin de `docs/18` ; rapports `docs/53` à `docs/63`). Fait : catalogue 5×5 à 2 cases par tuile (porteuse latérale + relais ; centrales B3 LC1–LC7, bords LB2, coins LK2 ; 28 tuiles ; ≈ 57 cases), règles propres au 5×5, mesure des connexions (< 5 % de cases à ≤ 2), générateur 5×5, aide « Placer les villes », rythme (toute jonction = zone d’intérêt), murs déclarés en information, seuil S à 5 dans les deux formats, goulets évités aussi en 4×4. `node --test` 739 tests (732 OK, 7 PDF ignorés), recettes 358 / 116.
- **Villes et campements en 5×5 (consigne du 2026-10-19, fin de `docs/18`)** : 8 villes à des **positions fixes par défaut** (1,1) (4,1) (2,2) (3,2) (2,3) (3,3) (1,4) (4,4), déplaçables par l’utilisateur ; **alerte bloquante au-delà de 8 villes** ; les jonctions-cases deviennent des **« campements »** (une intersection = campement ou ville). « Pas grand-chose à changer » selon l’utilisateur. **À la reprise** : faire vérifier par l’advisor design (Opus) que le générateur peut orienter les centrales pour ce motif fixe (écart de 3 cases, 3 ports aux villes ; (2,2)–(3,2) sont voisines), puis production (générateur à villes fixes, alerte > 8, vocabulaire « campement », critères à 8 villes de `docs/62` § 2, planche de 8 jetons, régénération des anciens 5×5), testeur, relecteur, versionneur, PR. La branche `wip-8-villes` (damiers, non testée) est en grande partie dépassée : s’en servir seulement comme référence.
- **Travail restant** : `docs/25-travail-restant.md`.
