# Travail restant et idées à étudier (point d'arrêt du 2026-10-16)

L'utilisateur a marqué une pause ; il reprendra **après discussion**. Rien ne doit être lancé sans son accord. État au moment de l'arrêt : version 3.01.0 (voir `CHANGELOG.md`), tout est sur GitHub, `node --test` et les deux recettes navigateur passent.

## 1. À faire (dans l'ordre prévu)

### 1.1 Catalogue 5×5 — en pause, attend le feu vert de l'utilisateur
- L'interface 5×5 est prête (bouton « Nouveau », choix de la grille, rangée neutre, refus de mélange, export en tuiles de 100 mm, générateur en tirage libre) ; **il manque le catalogue** : « Nouveau → 5×5 » est refusé tant qu'il n'existe pas.
- Consigne prête (voir l'historique de la session) : environ 30 modèles, **≈ 75 cases par plateau**, cases Ø 20 (décision du 2026-10-16, docs/18), raccords à 30 / 50 / 70 mm, cases d'apparition sur tout le pourtour, raccourcis de coin, **aucune poche**, coins dans l'esprit de K2 / K4, règles R1 à R4 respectées, écart minimal de 4 pas entre jonctions vérifié sur 1000 plateaux ; exposer `PM.catalogue.nouveauDocument('5x5')` et `PM.catalogue.modelesParGrille`.
- Mesures à faire (1000 plateaux, docs/22 §5) puis rapport de mesures dans `docs/` (prochain numéro libre ; le n° 24 est le cahier des charges `docs/24-catalogue-5x5.md`) : cases, S, écart par rang, « 5 contre 2 », « 4 contre 3 », tempo, pourtour, goulets, raccords morts, meilleurs placements des villes / jonctions-cases.
- Brouillon inachevé d'un premier essai (règles plus anciennes : poches permises, coins K1 / K3) : `docs/brouillons/catalogue-5x5-inacheve.patch` — à consulter seulement, **ne pas l'appliquer tel quel**.

### 1.2 Seuils et placement par défaut du 5×5
- L'advisor design de jeu valide les seuils d'équilibre 5×5 et le placement par défaut des jonctions-cases (équivalent de la rangée centrale du 4×4), puis le générateur les applique (`pairesJonctionsCases` renvoie aujourd'hui `null` en 5×5).

### 1.3 Seuils du 4×4 à revoir
- Les mesures ont changé avec le tirage avec répétition (63 cases ; « 5 contre 2 » 4,1 % ; S ≥ 5 : 4,3 % ; première ville inégale 0,2 % ; goulet à un chemin 0,4 %) : faire revalider les seuils de `src/graphe.js` par l'advisor design de jeu (`docs/21-mesures-catalogue-v2.md`).

### 1.4 Recette, relecture, sécurité, version
- Testeur et relecteur sur les derniers ajouts (interface 5×5, retouches du 4×4, suppression des tuiles, légende illustrée, puis catalogue 5×5).
- Audit de sécurité ciblé sur ces ajouts (le dernier, `docs/23`, porte sur la 2.00.0).
- Version, puis envoi sur GitHub.

### 1.5 Petites dettes
- ~~Pages d’essai cassées et `outils/mesures-generateur.js`~~ : retirées (consolidation du 2026-10-16). Restent `essai-assemblage`, `essai-editeur-tuile`, `essai-generateur`, `essai-sauvegarde` et `verif-chargement`, non revérifiées.
- Phrases d'aide en haut de la bibliothèque et dans l'éditeur qui recoupent la légende « Commandes » : à retirer si l'utilisateur le souhaite.
- Onglet Tuiles : rendu de la légende non vérifié à l'œil.
- Tactile non testé (double-tap, appui long qui déclenche le clic droit).
- Documents anciens : ils gardent leurs copies de K1, K3 et de l'ancien B4 (proposer le catalogue à jour à l'ouverture d'une bibliothèque v2 antérieure ?) ; leurs copies de B5 et K4 restent en Ø 24.
- La règle des 8 mm entre chemins n'est vérifiée que par les tests du catalogue, pas par `validerModele` : une tuile créée par l'utilisateur peut avoir des chemins qui se touchent sans alerte.
- À valider en conditions réelles : impression et mesure de la barre de 100 mm à la règle ; CSP sous Firefox et Safari.

### 1.6 Format hexagonal
- **Ne rien faire, pas même préparer**, tant que l'utilisateur n'a pas donné son feu vert (camps prévus sur les 3 côtés les plus proches de chaque joueur).

## 2. Idée nouvelle à étudier : les régions thématiques

Proposée par l'utilisateur au moment de l'arrêt, **pas encore définie** : à discuter avant tout travail.

- **Principe** : une tuile peut représenter une **région**, et une région a une **thématique** (exemple donné : C3 = Montagne).
- **Questions à poser à l'utilisateur** (pistes pour la discussion, rien n'est décidé) :
  - La thématique est-elle **purement visuelle** (illustration, couleur, symbole sur la tuile) ou a-t-elle un **effet de jeu** (déplacement plus lent en montagne, bonus, ressource…) ? L'outil ne gère pas les règles : un effet de jeu se traduirait au mieux par une donnée sur la tuile et, éventuellement, par un poids dans le calcul des distances.
  - Une région = **une tuile** ou un **ensemble de tuiles voisines de même thème** (une chaîne de montagnes sur plusieurs tuiles) ? Faut-il que des régions se forment à l'assemblage (règles de voisinage, comme les dominos) ?
  - Quelles **thématiques** (montagne, forêt, plaine, marais, lac, désert…) et combien ?
  - La thématique est-elle liée à la **forme des chemins** de la tuile (une montagne a peu de chemins, une plaine beaucoup) ou indépendante ?
  - **Impression** : la palette actuelle est limitée à vert, rouge, noir, blanc ; un thème se représenterait par un **motif ou un symbole** en noir sur blanc, ou faut-il élargir la palette ?
  - Le **générateur** et l'**équilibre** doivent-ils en tenir compte (répartir les régions entre les camps, éviter qu'un joueur ait toutes les montagnes) ?
- **Incidences probables** (à évaluer par les advisors design de jeu et prépresse le moment venu) : un champ `theme` (ou `region`) sur les modèles, un choix dans l'éditeur, un affichage dans la bibliothèque et sur le plateau, un rendu d'impression, et peut-être des compteurs par thème et par camp.
