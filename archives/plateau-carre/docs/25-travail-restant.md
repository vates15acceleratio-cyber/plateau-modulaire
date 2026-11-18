# Travail restant et idées à étudier (mis à jour le 2026-10-19, après les décisions sur les villes et les ponts, `docs/64` à `docs/67`)

L'utilisateur a marqué une pause ; il reprendra **après discussion**. Rien ne doit être lancé sans son accord. État au moment de l'arrêt : version 3.03.0 (voir `CHANGELOG.md`), tout est sur GitHub, `node --test` et les deux recettes navigateur passent.

## 1. À faire (dans l'ordre prévu)

### 1.1 Catalogue 5×5 — fait (branche `catalogue-5x5`)
- **Fait** : cahier des charges et arbitrage (`docs/24`), avis design et géométrie (`docs/28`, `docs/29`), catalogue de 6 modèles et 30 tuiles (K2 5, B1 6, B7 4, B7m 4, C7 6, C8 5) dans `src/catalogue.js`, recette (`docs/32`), revue (`docs/33`). « Nouveau → 5×5 » crée un plateau ; la pose à la main est utilisable.
- ~~Ancienne consigne au sous-agent~~ (environ 30 modèles, coins K1 / K3, etc.) : **obsolète**, remplacée par `docs/24` § 8.
- ~~Brouillon inachevé `docs/brouillons/catalogue-5x5-inacheve.patch`~~ (règles plus anciennes : poches permises, coins K1 / K3) : **obsolète**, ne pas l'appliquer.

### 1.2 Générateur 5×5, mesures, seuils — fait (branche `generateur-5x5`, 2026-10-17)
- **Générateur 5×5** (`docs/34`) : centrales orientées, 5 ou 6 B1 (rangée neutre), villes en 2-3-2 sur jonctions à ≥ 3 ports, rejets sur les ports, abandon rapide sur une bibliothèque impossible ; 4×4 inchangé.
- **Mesures sur 1000 plateaux** (`docs/35`) et **seuils définitifs du 5×5** (`docs/36`, identiques au 4×4), conseil « 3 villes du milieu sur une rangée », information « ville sur jonction à moins de 3 ports ».
- Recette et revue (`docs/37`), corrections faites.
- **À soumettre à l'utilisateur** (`docs/36`) : le **tempo du 5×5** (4,75 villes sur 7 à ≤ 3 pas, contre 5,7 en 4×4) et le **rôle des centrales** (villes à 70 % sur les flancs, 7 % au centre) ; pistes pour plus tard : une centrale à 3 ou 4 ports, un bord de plus.

### 1.3 Seuils du 4×4 — décidé
- Gardés tels quels (`docs/36` § 7) : mêmes seuils dans les deux formats.

### 1.4 Recette, relecture, sécurité, version
- Testeur et relecteur sur les derniers ajouts (interface 5×5, retouches du 4×4, suppression des tuiles, légende illustrée). Le catalogue 5×5 est recetté (`docs/32`) et relu (`docs/33`) ; reste la recette du générateur 5×5 une fois fait.
- Audit de sécurité ciblé sur ces ajouts (le dernier, `docs/23`, porte sur la 2.00.0).
- Version, puis envoi sur GitHub.
- **Revue de la branche `passages` (`docs/51`, 2026-10-18)** : fait — rejet de S aligné (5×5 seulement), `version: 3` pour les documents à passages (la 3.04 les refuse), test de temps en temps processeur, recette du démarrage depuis une sauvegarde automatique 3.04 (`recette-interface`, S11, 4×4 et 5×5, Garder / Charger / Ctrl+Z / Ctrl+Y), `poids` en alerte (1 à 999), texte de la proposition v1 identique, commentaires et conseil 4×4 présenté comme conseil de pose à la main.
- **Remarques de `docs/51` à reporter** (non traitées) :
  - 7 : la proposition du nouveau catalogue revient à chaque démarrage tant que l'utilisateur garde ses tuiles ; on pourrait retenir le refus pour la session ;
  - 8 : les seuils de S dépendent du format, pas du catalogue (un document 5×5 au catalogue 3.04 passe aussi à l'alerte S ≥ 5 (7 avant la décision 1 de `docs/18` du 2026-10-18 après `docs/60`)) ; à mentionner dans le CHANGELOG ;
  - 9 : `casesParMoitie` (`graphe.js`) compte les jonctions posées même sans modèle trouvé, alors que le compteur « Cases » de `controles.js` les ignore ; réutiliser `M.portsJonction` ;
  - 10 : test des goulets à remplacer par une comparaison avec / sans le terme des articulations ; empreintes de `generateur-5x5.test.js` et `passages.test.js` à régénérer à chaque réglage du générateur ; stock testé sur 100 graines (cible mesurée sur 200) ;
  - 11 : conseil 4×4 « rangée centrale » (`graphe.js`, `equilibre.js`) devenu un conseil de pose à la main ; le générateur ne le suit plus par défaut ;
  - 6 : le poids est invisible dans l'interface (seule l'infobulle du champ des exemplaires le dit ; README mis à jour).
- Autres écarts de recette de `docs/49` encore ouverts : refus répété dans le navigateur ; la 3.04 qui ouvre un document v3 met la sauvegarde automatique de côté (« illisible ») sans l'écraser.

### 1.5 Petites dettes
- ~~Pages d’essai cassées et `outils/mesures-generateur.js`~~ : retirées (consolidation du 2026-10-16). Restent `essai-assemblage`, `essai-editeur-tuile`, `essai-generateur`, `essai-sauvegarde` et `verif-chargement`, non revérifiées.
- Phrases d'aide en haut de la bibliothèque et dans l'éditeur qui recoupent la légende « Commandes » : à retirer si l'utilisateur le souhaite.
- Onglet Tuiles : rendu de la légende non vérifié à l'œil.
- Tactile non testé (double-tap, appui long qui déclenche le clic droit).
- Affichage sur téléphone (375 px) dégradé : barre du haut coupée, bibliothèque qui déborde, plateau minuscule (recette du 2026-10-17) : à traiter si le mobile compte pour l'utilisateur.
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
- Barre d'outils de l'éditeur sur deux lignes entre 1600 et 1920 px depuis le bouton « Outil » des passages (`docs/43`) ; à reprendre avec la carte « Commandes » flottante (`styles/aide.css`).

## 3. Refonte organique (branche `passages`, 2026-10-17)
- Fait : passages sans case (`docs/39` à `docs/41`, `docs/43`).
- En cours : catalogues candidats non branchés (`docs/42`, `docs/44`). Prochaine révision demandée par l'utilisateur (fin de `docs/18`) : centrales plus ouvertes, moins de cases, équilibre des accès au centre, pose symétrique à essayer, rythme strict ≤ 3 ; images à montrer avant tout branchement.
- Ensuite : branchement du catalogue, générateur orienté pour le rythme (et peut-être symétrique), mesures, testeur, relecteur, version, PR.

## 4. Après les mesures définitives du catalogue organique (branche `passages`, 2026-10-18)
- **Fait** (décisions de `docs/18`, fin de fichier ; mesures `docs/48`) : seuils de S par format (4×4 alerte dès 5 ; 5×5 alerte dès 7, information 5 ou 6 ; rejet du générateur à S ≥ 5 en 5×5 seulement ; en 4×4 classement par S, sans rejet), préférence anti-point d'articulation en 5×5 (8,5 % de plateaux concernés sur 200 avant, 0 % après), « jonctions variées » cochée par défaut en 4×4, texte « bien au-dessus de la cible » (chaîne ≥ 7 ou distance maximale ≥ 6), correction de `casesParMoitie` (`docs/49`), mesures régénérées (`docs/croquis/organique/mesures.json`, `centrales-ouvertes-200.json`, commandes `node outils/planche-organique.js` puis `node outils/planche-organique.js series 200 > docs/croquis/organique/centrales-ouvertes-200.json`).
- **Reste à mesurer ou à vérifier** :
  - point 5 du `docs/28` § 6 : S selon la jonction de la 7e ville (seule la répartition des villes est mesurée) ;
  - point 8 du `docs/28` § 6 : distance entre apparitions verte et rouge par la rangée neutre ;
  - conseil 5×5 « 3 villes du milieu sur une rangée » (`docs/36` point 5) : **fait** (`docs/60`, décision 1 de `docs/18`) : remplacé par un renvoi à « Outils > Placer les villes », et seuil S du 5×5 revenu à 5 (information 4) ;
  - 4×4 en « jonctions variées » : 2,0 % des plateaux générés (4 sur 200) avaient un point d'articulation ; **fait** (décision 4 de `docs/18`) : la préférence s'applique aussi au 4×4, 0 % sur 200 plateaux ;
  - villes au centre en 5×5 : 13,5 %, sous la cible de 20 % du `docs/38` (à reprendre avec les « régions thématiques »).
- **Suite prévue** : relecteur, versionneur (numéro, étiquette, `CHANGELOG.md`), PR.

## 5. 5×5 très connecté (branche `connexions-5x5`, 2026-10-18, `docs/53` à `docs/56`)
- **Fait** (`docs/56`, `docs/58`, `docs/59`) : catalogue 5×5 « B3 » à 2 cases par tuile au plus (LC1 à LC7, LB2, LK2 ; 28 tuiles à imprimer dont 12 centrales pour 9 places, environ 57 cases par plateau ; murs déclarés seulement, `murs: [1, 3]` sur LC4), règles propres au 5×5 (porteuse latérale, paire basse du coin ; R2 et R4 gardées ; 4×4 inchangé), mesure `PM.graphe.connexions` (panneau et rapport d'équilibre), générateur 5×5 qui place les villes avant d'orienter les centrales (rejet au-delà de 5 % de cases à 2 connexions), aide « Placer les villes », proposition du nouveau catalogue aux documents 5×5 de la 4.00.0, mesures de contrôle sur 200 plateaux (`outils/mesures-5x5-connecte.js`).
- **À soumettre à l'utilisateur** (`docs/56`) :
  - **chaîne du rythme** : 4,7 en moyenne (3 à 5) en 5×5, au-dessus de la cible 3 (texte « au-dessus de la cible » au rapport) ; cible à revoir pour le 5×5 ?
  - **composition** : réglée par le choix « B3 » (`docs/58`) : une trentaine de compositions de centrales sur 200 plateaux, 100 % de plateaux montables avec la boîte ;
  - **documents gardés avec leurs anciennes tuiles 5×5** (3.04, 4.00.0) : ils s'ouvrent, mais le générateur 5×5 abandonne et conseille le nouveau catalogue ;
  - **raccords morts** : 2 informations (murs de « Deux ponts ») sur les plateaux qui portent LC4 (environ 75 %), aucune alerte ;
  - **placements de villes** : avec « B3 », 5,7 admissibles par plateau en moyenne (1 à 14), 48 placements différents sur 200 plateaux (8,3 et 47 avant) ; environ 63 % des candidats du générateur sont acceptés (rejets « villes_ports »), sans effet sur la réussite (100 %).
- **Reste** : relecture, recette indépendante, versionneur ; l'ancien outil `outils/mesures-5x5.js` (`docs/35`) est historique ; prépresse des nouvelles tuiles (marges de 3,79 à 10,04 mm, `docs/55`) à faire contrôler à l'impression.

## 6. Villes, campements et ponts (branche `connexions-5x5`, 2026-10-19)
- **Fait** :
  - campements : jeton Ø 30 mm à icône de feu de bois, siège Ø 30 mm aux coins, planche de 8 villes et 8 campements (`docs/65`) ;
  - jetons recto-verso : 16 jetons, campement au recto, ville au verso, deux pages A4 en miroir (`docs/67`) ;
  - décisions de `docs/18` : motif des 8 villes confirmé, pas de tuile centrale dédiée, piste des ponts, R3 assouplie sur les centrales 5×5, catalogue « P » à 30 tuiles, campements dans les deux formats, 4×4 à 7 villes inchangé.
- **En cours** : catalogue 5×5 « P » (LC2 retiré, LC11 et LC12 ajoutées), R3 assouplie, générateur 5×5 à 8 villes fixes avec choix de la place des centrales, écran Plateau (jeton campement, textes restants, `DIAMETRE_CASE_JONCTION`). Détail dans `docs/4-architecture.md`, « Chantier en cours ».
- **À faire ensuite** : testeur, relecteur, versionneur (numéro, étiquette, `CHANGELOG.md`), PR.
- **Points à valider** :
  - advisor prépresse : jeton campement, marge de 4,97 mm de LC12 (`docs/66`), recto-verso (`docs/67`) ;
  - impression réelle des jetons en recto-verso (tolérance de décalage mesurée à environ 2,6 mm, `docs/67`) ;
  - emporte-pièce Ø 30 mm conseillé pour les campements ;
  - repères de coupe en croix, peut-être inutiles pour une coupe ronde ;
  - rythme en génération libre : chaîne moyenne de 1,75 (B3) à 2,95 avec le catalogue « P12 » (`docs/66` § 4), à soumettre à l'utilisateur.
- **Mesures** : sur 200 plateaux au motif fixe, écart de 3 cases respecté avec « P12 » (200 réussis) et avec « P » (200 réussis) ; le catalogue « P » ajoute LC6 et une LC3 de plus (`docs/66` § 3). Les tests qui figent la composition B3 et la règle R3 sont à mettre à jour (`docs/66` § 4).
