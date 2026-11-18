# Plateau modulaire — Brief de projet

> **VERSION 2 : lire d'abord `docs/18-decisions-v2.md`, qui prime sur tout le reste.**
>
> **À LIRE EN PREMIER (2026-10-15).** Les décisions des advisors sont consolidées dans **`docs/archives/3-synthese.md`**, qui **prime** sur les sections 2, 3, 5 (point 3), 6, 8.3 et 9 de ce brief. Principaux changements : grille 4×4 de tuiles de 12 cm ; captures = **jetons posés sur les jonctions de 4 tuiles** (plus sur des tuiles centrales) ; plus de contour libre ni d'identifiant de compatibilité ; cases de tuile `deplacement | apparition` uniquement. Les lignes caduques ci-dessous sont annotées « → voir synthèse ».

## 1. Objectif

Disposer d'un outil de conception pour prototyper un **plateau de jeu modulaire** : le plateau est assemblé à partir de tuiles, et il est différent à chaque partie.

Le besoin se limite au **plateau**. Pas de règles, pas de simulation de tours, pas de moteur de jeu. Le résultat est imprimé sur papier.

## 2. Contraintes de conception (validées)

| Élément | Contrainte |
|---|---|
| Joueurs | 2 |
| Taille maximale du plateau assemblé | **50 × 50 cm** |
| Taille d'une case | **3 cm de diamètre maximum** |
| Zones d'apparition | au moins 2 par joueur, sur des **tuiles de bord fixes** |
| Zones de capture | 7, ~~sur des tuiles centrales~~ → voir synthèse : jetons sur les jonctions intérieures, avec un écart minimum entre elles |
| Cases de déplacement | environ 50, réparties de façon plus ou moins équilibrée |
| Cases par tuile | **2 minimum** par tuile (une ou plusieurs) |
| Symétrie entre joueurs | **non obligatoire** |
| Modularité | le plateau change à chaque partie (assemblage de tuiles) |

## 3. Décisions prises

- ~~Tuiles de forme libre.~~ **Remplacé le 2026-10-15 (voir 7.1) : toutes les tuiles ont la même taille et le même contour, choisi parmi des formes de base.** Le plateau actuel est à redessiner entièrement.
- Avec une taille unique, des rotations de 90° et des raccords possibles sur tous les côtés, le contour est **en pratique un carré** (un hexagone ou un L ne supporte pas les rotations de 90°). À confirmer par l'advisor géométrie.
- Ce qui rend un plateau modulable, ce sont les **points de raccord** entre tuiles.
- **Approche retenue : tuiles de contour identique + points de raccord standardisés sur les bords.** À l'intérieur d'une tuile, cases et chemins peuvent avoir n'importe quelle disposition. Deux tuiles s'assemblent quand leurs points de raccord se touchent.
- **Deux types de tuiles :**
  - **tuiles de bord** : placées sur le pourtour, elles portent les zones d'apparition (fixes). Elles peuvent avoir moins de 3 raccords, puisqu'un côté reste libre ;
  - **tuiles centrales** : ~~elles portent les zones de capture~~ (→ voir synthèse : captures sur jetons de jonction), et ont **3 raccords au minimum, jusqu'à 4**.
- **Rotations :** par multiples de 90° uniquement.
- **Forme du plateau final : deux modes**, au choix de l'utilisateur :
  1. un carré / rectangle contenu dans 50 × 50 cm ;
  2. une silhouette libre, elle aussi contenue dans 50 × 50 cm.
- **Impression : recto seul. Toutes les tuiles assemblées ensemble tiennent dans 50 × 50 cm maximum** (c'est la taille du plateau, pas d'une planche à découper).
- **Écart minimum entre zones de capture : 3 cases.**
- **Équilibre sans symétrie :** le test d'équilibre alerte au-delà de 2 cases d'écart entre les deux joueurs, sans bloquer.
- **Couleurs : vert, rouge, noir et blanc uniquement.** Habillage simple pour le prototype (pas de thème pour l'instant).
- **Plateforme : une page web unique (HTML + JavaScript)**, ouverte dans le navigateur, sans installation, fonctionnant hors ligne.
- **Sorties :** export image (PNG/SVG) et PDF pour impression.

## 4. Pourquoi pas une table virtuelle existante

Des outils existent (Tabletop Simulator, Tabletopia, Tabletop Playground, Owlbear Rodeo, éditeurs de tilemap comme Tiled ou Sprite Fusion), mais aucun ne génère à lui seul un plateau modulaire équilibré. Ils permettent d'importer des tuiles et de les réarranger, pas de les concevoir ni de vérifier l'équilibre. D'où l'outil sur mesure.

Boardgame Lab (boardgamelab.app) a été écarté : l'application n'est pas sortie.

## 5. Fonctionnalités cibles

**Priorité 1 (version utilisable)**
1. Éditeur de tuile : forme libre, cases (3 cm max), chemins entre cases, points de raccord sur les bords, type de tuile (bord / centrale), marquage des types de cases (déplacement / apparition / capture).
2. Plateau d'assemblage : poser, déplacer, faire pivoter (90°) les tuiles, aimantation sur les points de raccord compatibles, limite 50 × 50 cm affichée.
3. Choix du mode de forme du plateau : rectangle ou silhouette libre.
4. Compteurs en direct : nombre de cases (cible ~50), zones de capture (7), zones d'apparition par joueur (min. 2), cases par tuile (min. 2), dimensions du plateau (max 50 × 50).
5. Sauvegarde / chargement (fichier JSON).
6. Export image et PDF 50 × 50 cm, recto, en vert / rouge / noir / blanc.

**Priorité 2**
7. Bouton « plateau aléatoire » : apparitions sur les tuiles d'apparition, captures sur les jetons de jonction avec écart minimum (→ voir synthèse).
8. Test d'équilibre : distance en cases entre chaque zone d'apparition et chaque zone de capture. Le rapport montre l'écart entre les deux joueurs, sans imposer de symétrie.

**Hors périmètre :** règles, tours de jeu, IA, multijoueur en ligne.

## 6. Modèle de données proposé

> **Caduc en partie → voir `docs/archives/3-synthese.md` et `docs/archives/2-avis-geometrie.md` (D3, D4, D10).** Tuile = { `modeleId`, `role` (centrale | coin | bord | apparition), `raccords` (masque 12 bits), `portsCoin` (masque 4 bits), cases, chemins } ; plus de contour ni d'identifiant de compatibilité ; Case de type `deplacement | apparition` ; nouvelle entité Jeton / Jonction (`i`, `j`, `capture | carrefour`) ; Plateau = { mode, `tuiles: [{modeleId, col, lig, rot}]`, `jetons: [{i, j, type}]` }.

- **Tuile** : `id`, type (`bord` | `centrale`), contour (polygone libre), liste de cases (2 minimum), liste de chemins, liste de points de raccord (3 à 4 pour une tuile centrale).
- **Case** : `id`, position (x, y), diamètre (3 cm max), type (`deplacement` | `apparition` | `capture`), joueur propriétaire pour une apparition (joueur 1 / 2).
- **Chemin** : paire de cases reliées.
- **Point de raccord** : côté de la tuile, position standardisée sur ce côté, identifiant de compatibilité.
- **Plateau** : mode de forme (`rectangle` | `libre`), liste de tuiles posées (position, rotation 0/90/180/270), graphe global des cases calculé à partir des raccords.

## 7. Questions encore ouvertes

1. **Nombre de tuiles et d'exemplaires** : non décidé par l'utilisateur. À déterminer par l'advisor design de jeu, puis à tester avec le prototype. Point de départ : 8 à 10 tuiles pour ~50 cases, avec un maximum suggéré de 7 cases par tuile.
2. **Raccords des tuiles de bord** : suggestion, 2 au minimum (valeur par défaut tant que non contredit).
3. **Positions standard des raccords** sur un côté : suggestion, 3 positions fixes (début, milieu, fin), valeur par défaut.
4. **Raccord sur une case ou sur un chemin** : suggestion, chemin seulement, valeur par défaut.
5. **Zones d'apparition** : suggestion, 2 tuiles de bord fixes par joueur, une zone chacune, valeur par défaut.

### 7.1 Réponses de l'utilisateur (2026-10-15)

- **Taille des tuiles : toutes identiques**, c'est plus simple. Piste à étudier, inspirée de *Civolution* : placer les villes / zones (captures) **à cheval sur plusieurs tuiles** (à leur jonction), ou bien certaines tuiles portent une ville à la place d'une simple case de déplacement. **À trancher par l'advisor design de jeu** selon ce qui est le plus modulaire.
- **Tuiles de bord : à concevoir.** Chaque joueur a son côté du plateau.
- **Silhouette libre : déduite des tuiles posées** (pas de contour dessiné à la main).
- **Produit final : tuiles en carton rigide.** Chaque tuile est imprimée, contrecollée sur carton et découpée ; on assemble un plateau différent à chaque partie (pas de plateau plié unique). Le document de sortie doit être fidèle à l'échelle et à la résolution : **PDF/SVG vectoriels à l'échelle exacte + PNG à 300 dpi**.
- **Forme des tuiles : on part de formes de base** (pas de dessin point par point).
- **Valeurs par défaut de la section 7 (questions 2 à 5) : acceptées.**
- **Équipe d'agents complète dès le départ.**
- **Dossier de travail : `<dossier du projet>`.**
- **Villes : version B retenue** (`docs/archives/1b-avis-design-jeu-variante-jonctions.md`) : grille 4×4 de tuiles de 12 cm, villes = jetons de 3 cm posés sur les 9 jonctions intérieures (7 villes + 2 carrefours). La version A (`docs/archives/1-avis-design-jeu.md`) est écartée.
- **Écart entre captures : 3 pas** (au moins 2 cases intermédiaires), confirmé par l'utilisateur ; paramètre réglable.
- **Forme du plateau : 4×4 complet, ou 4×4 avec 1 ou 2 coins retirés** (confirmé par l'utilisateur ; remplace les modes rectangle / silhouette libre).

## 8. Équipe d'agents

Convention : l'**orchestrateur** coordonne, les **advisors** donnent un avis sans écrire de code, les **sous-agents** produisent un module précis. Chaque sous-agent livre son module et ses tests, et ne modifie pas les autres modules.

**Modèles :** chaque agent a un modèle Claude assigné (récapitulatif en 8.5). Les modèles utilisés sont Claude Opus 5.5, Claude Sonnet 5.5 et Claude Haiku 5.5, avec Claude Fable 5.1 en renfort ponctuel.

**Modèle de la conversation : Claude Opus 5.5.** C'est le modèle choisi par l'utilisateur pour dialoguer et piloter le projet. Il joue le rôle d'orchestrateur : il reçoit les demandes, lance les advisors et les sous-agents, et intègre leurs résultats. Le brief lui-même a été préparé avec Claude Sonnet 5.5 ; à partir du lancement de la construction, la conversation se poursuit sur Opus 5.5.

### 8.1 Orchestrateur

- **Modèle : Claude Opus 5.5, le même que celui de la conversation avec l'utilisateur.** Il coordonne toute l'équipe et arbitre les conflits entre modules, ce qui demande un bon raisonnement sur l'ensemble du projet.
- **Rôle :** découper le travail, lancer les sous-agents dans le bon ordre, intégrer les modules dans le fichier HTML final, résumer l'avancement.
- **Entrées :** ce brief, les retours de l'utilisateur.
- **Sorties :** page web finale, courte note de changements à chaque itération.
- **Règle :** ne pas ajouter de fonctionnalité hors périmètre (règles, tours de jeu) sans demande explicite.

### 8.2 Advisors (avis seulement, pas de code)

**Advisor design de jeu**
- **Modèle : Claude Opus 5.5.** Raisonnement sur l'équilibre et les contraintes combinées.
- Vérifie que les contraintes sont tenables : 2 apparitions/joueur, 7 captures, ~50 cases, 2 cases minimum par tuile, dans 50 × 50 cm.
- Propose le nombre et les types de tuiles, la répartition des zones, et le critère d'équilibre sans symétrie.
- Signale les configurations aléatoires qui risquent d'être déséquilibrées.

**Advisor prépresse / impression**
- **Modèle : Claude Sonnet 5.5.** Tâche bien cadrée (formats, marges, lisibilité).
- Définit les dimensions d'export (50 × 50 cm, recto), les marges, la taille des tuiles pour qu'elles soient découpables, des cases de 3 cm maximum.
- Vérifie la lisibilité avec la palette vert / rouge / noir / blanc (contraste, épaisseur des traits, repères de découpe).

**Advisor ergonomie**
- **Modèle : Claude Sonnet 5.5.** Avis sur des écrans et des parcours simples.
- Garde l'interface simple : on doit pouvoir assembler un plateau sans lire de notice.
- Critique les maquettes d'écran avant qu'elles soient codées.

**Advisor géométrie des raccords**
- **Modèle : Claude Opus 5.5.** Règle de compatibilité avec rotations à vérifier sur tous les cas.
- Tranche les questions 2 à 4 de la section 7 : positions standard, compatibilité entre côtés, raccords des tuiles de bord.
- Propose une règle de compatibilité simple, vérifiable par le code, avec rotations de 90°.

### 8.3 Sous-agents (production)

| # | Sous-agent | Mission | Livrable |
|---|---|---|---|
| 1 | Modèle de données | Implémenter les structures de la section 6 et la validation (tuile cohérente, 2 cases minimum, raccords valides, cases de 3 cm max). | Module de données + fonctions de validation |
| 2 | Éditeur de tuile | Interface pour dessiner la forme, placer cases, chemins, raccords, typer les cases, choisir bord / centrale. | Écran d'édition de tuile |
| 3 | Assemblage | Poser, déplacer, pivoter (90°) les tuiles, aimantation sur raccords compatibles, refus des raccords invalides, limite 50 × 50 cm, deux modes de forme. | Écran de plateau |
| 4 | Compteurs et contrôles | Calculer en direct cases, captures, apparitions, cases par tuile, dimensions, et signaler les contraintes non respectées. | Panneau de contrôle |
| 5 | Sauvegarde | Export/import JSON de tuiles et de plateaux. | Fonctions de sauvegarde |
| 6 | Export impression | Export PNG/SVG/PDF en 50 × 50 cm, recto, vert / rouge / noir / blanc. | Fonctions d'export |
| 7 | Analyse d'équilibre | Construire le graphe des cases, calculer les distances apparitions → captures, comparer les deux joueurs sans imposer de symétrie. | Module d'analyse + rapport affiché |
| 8 | Générateur aléatoire | Assembler un plateau valide : apparitions sur tuiles d'apparition, captures sur jetons de jonction avec écart minimum (→ voir synthèse). Dépend de 3 et 7. | Bouton « plateau aléatoire » |
| 9 | Testeur | Écrire des tests (raccords, rotations, compteurs, distances, export) et chercher les cas limites. | Suite de tests + liste de bugs |
| 10 | Relecteur | Revoir le code de chaque module : lisibilité, erreurs, cohérence entre modules. | Rapport de revue |

### 8.4 Ordre de travail

1. Advisors géométrie + design de jeu → fixer les règles de raccord et le critère d'équilibre.
2. Sous-agent 1 (données) en premier, car tout en dépend.
3. Sous-agents 2, 3, 4, 5 (version utilisable), puis 6 (export).
4. Testeur et relecteur après chaque module.
5. Sous-agents 7 puis 8 (priorité 2), avec l'advisor design de jeu en validation.
6. Retour de l'utilisateur après la première version utilisable.

### 8.5 Modèles Claude par agent

Le modèle est choisi au lancement de chaque agent (paramètre de modèle de l'outil d'agents). Principe : **Opus 5.5** pour les tâches de géométrie, de logique et d'arbitrage, **Sonnet 5.5** pour la production courante, **Haiku 5.5** pour les modules simples et répétitifs.

| Agent | Rôle | Modèle | Pourquoi |
|---|---|---|---|
| Conversation avec l'utilisateur | Dialogue et pilotage | Claude Opus 5.5 | Choix de l'utilisateur, garde la vue d'ensemble du projet |
| Orchestrateur | Coordination | Claude Opus 5.5 | Même modèle que la conversation : vue d'ensemble, arbitrages |
| Advisor design de jeu | Avis | Claude Opus 5.5 | Équilibre, contraintes combinées |
| Advisor géométrie des raccords | Avis | Claude Opus 5.5 | Règle de compatibilité avec rotations |
| Advisor prépresse / impression | Avis | Claude Sonnet 5.5 | Tâche cadrée |
| Advisor ergonomie | Avis | Claude Sonnet 5.5 | Écrans et parcours simples |
| 1. Modèle de données | Production | Claude Sonnet 5.5 | Structures et validation classiques |
| 2. Éditeur de tuile | Production | Claude Sonnet 5.5 | Interface de dessin |
| 3. Assemblage | Production | Claude Opus 5.5 | Aimantation, rotations, cas limites géométriques |
| 4. Compteurs et contrôles | Production | Claude Haiku 5.5 | Calculs simples |
| 5. Sauvegarde | Production | Claude Haiku 5.5 | Export / import JSON |
| 6. Export impression | Production | Claude Sonnet 5.5 | Dimensions exactes, formats multiples |
| 7. Analyse d'équilibre | Production | Claude Sonnet 5.5 | Graphe et distances |
| 8. Générateur aléatoire | Production | Claude Opus 5.5 | Assemblage valide sous plusieurs contraintes |
| 9. Testeur | Production | Claude Sonnet 5.5 | Tests et cas limites |
| 10. Relecteur | Production | Claude Opus 5.5 | Revue de cohérence entre modules |

**Renfort ponctuel : Claude Fable 5.1.** À réserver aux points bloquants que les modèles ci-dessus ne résolvent pas (par exemple un générateur aléatoire qui produit trop de plateaux déséquilibrés). Il est plus coûteux, donc à utiliser seulement dans ce cas.

Ces choix sont des recommandations pour les advisors et les sous-agents : ils peuvent être changés agent par agent sans toucher au reste du brief. Le modèle de la conversation (Opus 5.5) est, lui, décidé par l'utilisateur et reste fixe.

## 9. Critères de réussite

- On assemble un plateau complet de ~50 cases en quelques minutes, sans dépasser 50 × 50 cm.
- Les compteurs confirment 7 captures sur des jonctions intérieures et au moins 2 apparitions par joueur sur des tuiles d'apparition.
- Un plateau s'imprime proprement en 50 × 50 cm, recto, et les tuiles se raccordent sur papier.
- Le test d'équilibre repère un plateau injuste (priorité 2).
