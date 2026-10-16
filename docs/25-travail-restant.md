# Travail restant et idées à étudier (point d'arrêt du 2026-10-16)

L'utilisateur a marqué une pause ; il reprendra **après discussion**. Rien ne doit être lancé sans son accord. État au moment de l'arrêt : version 3.03.0 (voir `CHANGELOG.md`), tout est sur GitHub, `node --test` et les deux recettes navigateur passent.

## 1. À faire (dans l'ordre prévu)

### 1.1 Catalogue 5×5 — fait (branche `catalogue-5x5`)
- **Fait** : cahier des charges et arbitrage (`docs/24`), avis design et géométrie (`docs/28`, `docs/29`), catalogue de 6 modèles et 30 tuiles (K2 5, B1 6, B7 4, B7m 4, C7 6, C8 5) dans `src/catalogue.js`, recette (`docs/32`), revue (`docs/33`). « Nouveau → 5×5 » crée un plateau ; la pose à la main est utilisable.
- ~~Ancienne consigne au sous-agent~~ (environ 30 modèles, coins K1 / K3, etc.) : **obsolète**, remplacée par `docs/24` § 8.
- ~~Brouillon inachevé `docs/brouillons/catalogue-5x5-inacheve.patch`~~ (règles plus anciennes : poches permises, coins K1 / K3) : **obsolète**, ne pas l'appliquer.

### 1.2 Générateur 5×5, mesures, seuils (à faire, dans cet ordre)
1. **Générateur 5×5** (provisoire aujourd'hui : villes tirées librement, centrales tournées au hasard, jonctions mal reliées en simple pénalité). Il doit :
   - **orienter les centrales** (pas de rotation au hasard) ;
   - imposer **5 ou 6 B1** (cases = 72 + nB1, ports = 34 + nB1 avec 4 K2 et 9 centrales à 3 cases), avec les B1 de préférence sur la rangée neutre ;
   - placer les **villes en 2-3-2** sur des jonctions à au moins 3 ports ;
   - faire de « **au moins 2 ports par jonction** » une condition de **rejet**, et non plus une pénalité ;
   - `pairesJonctionsCases` renvoie aujourd'hui `null` en 5×5 (placement par défaut des jonctions-cases à définir).
2. **Mesures sur 1000 plateaux** : les 12 points de `docs/28`, puis rapport de mesures dans `docs/` (prochain numéro libre).
3. **Seuils d'équilibre 5×5** : validés par l'advisor design de jeu, puis appliqués.

### 1.3 Seuils du 4×4 à revoir
- Les mesures ont changé avec le tirage avec répétition (63 cases ; « 5 contre 2 » 4,1 % ; S ≥ 5 : 4,3 % ; première ville inégale 0,2 % ; goulet à un chemin 0,4 %) : faire revalider les seuils de `src/graphe.js` par l'advisor design de jeu (`docs/21-mesures-catalogue-v2.md`).

### 1.4 Recette, relecture, sécurité, version
- Testeur et relecteur sur les derniers ajouts (interface 5×5, retouches du 4×4, suppression des tuiles, légende illustrée). Le catalogue 5×5 est recetté (`docs/32`) et relu (`docs/33`) ; reste la recette du générateur 5×5 une fois fait.
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
