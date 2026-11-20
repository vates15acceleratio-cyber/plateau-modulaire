# Atelier du plateau : cahier des charges (2026-11-19)

Demande de l'utilisateur du 2026-11-19 : un outil pour **travailler sur le plateau** (priorité) et faire des **parties fictives** (jets de dés, mélange des cartes). Ce document est le contrat entre l'orchestrateur et les sous-agents. Tout ce qui est marqué **(provisoire)** est un réglage par défaut choisi par l'orchestrateur, à faire valider par l'utilisateur : il doit rester un **paramètre** facile à changer, jamais une constante enfouie.

## 1. Règles du plateau

Reprises de l'autre conversation (`docs/00-direction.md`) : cases hexagonales pointe en haut, coordonnées axiales (q, r) ; environ 91 cases ; forme libre ; noyau fixe ; montagnes en blocs infranchissables (4 et 5 cases) ; 7 villes ; au moins 3 tuiles entre deux villes (donc 4 pas, mesurés sur les cases franchissables) ; 70 % de plaines, 15 % de forêts, 15 % de marais ; coûts en rations plaine 1, forêt 2, marais 2, ville 1 (provisoire).

Ajouts du 2026-11-19 :

| N° | Règle | Traduction dans l'outil |
|---|---|---|
| A1 | Quelques tuiles **monoblocs de 3 ou 4 cases** avec forêts ou marais (ex. 3 plaines + 1 forêt, 3 forêts). | Pièces du catalogue à plusieurs cases, terrain par case. |
| A2 | **Jamais de ville dans un monobloc**, sauf le **noyau central fixe**. | Contrôle sur le catalogue et sur le plateau. Le noyau est une pièce de 7 cases : ville au centre, 6 plaines autour (provisoire). |
| A3 | **Plus de tuiles de déploiement.** Chaque joueur déploie sur **ses deux villes les plus proches de son côté**. | Aucune pièce « camp ». Chaque joueur a 2 villes de déploiement. |
| A4 | 3 tuiles au moins entre deux villes ; les villes de déploiement sont sur le **bord haut** (Vert) et le **bord bas** (Rouge). | Villes de déploiement sur la rangée extrême (r minimal / r maximal) du plateau. Les 7 villes : 1 centre + 2 Vert + 2 Rouge + 2 neutres. |
| A5 | **Tuiles d'événement** uniques, en **réserve**, posées **par-dessus** une tuile existante quand un joueur pioche l'événement. Elles ne servent pas à construire le plateau. | Réserve séparée du catalogue ; couche de recouvrement dans l'état du plateau (la tuile d'origine reste dessous). |
| A6 | Chaque tuile touche **au moins 3 autres tuiles** (voir si 2 suffisent). | Contrôle paramétré (seuil 3 ou 2), mesuré de deux façons, voir §3. |

## 2. Catalogue (provisoire) : 64 pièces, 91 cases

Formes en coordonnées axiales relatives ; une pièce se pose avec une ancre et une rotation (0 à 5 sixièmes de tour).

| Id | Pièce | Cases | Nombre | Contenu |
|---|---|---|---|---|
| N1 | Noyau | 7 | 1 | (0,0) ville ; les 6 voisines en plaine |
| M4 | Montagne zigzag | 4 | 1 | (0,0)(1,0)(1,1)(2,1) montagne |
| M5 | Montagne peigne | 5 | 1 | (0,0)(1,0)(2,0)(0,1)(1,1) montagne |
| V | Ville | 1 | 6 | ville |
| F3 | Bois | 3 | 1 | triangle (0,0)(1,0)(0,1) : 3 forêts |
| F31 | Lisière | 4 | 1 | losange (0,0)(1,0)(0,1)(1,1) : forêt en (0,0), 3 plaines |
| F21 | Bosquet | 3 | 1 | coude (0,0)(1,0)(1,1) : forêt, forêt, plaine |
| S3 | Marécage | 3 | 1 | triangle : 3 marais |
| S31 | Mare | 4 | 1 | losange : marais en (0,0), 3 plaines |
| S21 | Roselière | 3 | 1 | coude : marais, marais, plaine |
| P | Plaine | 1 | 39 | plaine |
| F | Forêt | 1 | 5 | forêt |
| S | Marais | 1 | 5 | marais |

Vérification : 7 + 9 + 6 + 20 + 49 = 91 cases ; hors villes et montagnes, 75 cases dont 53 plaines (70,7 %), 11 forêts, 11 marais (14,7 % chacun). Le plateau généré utilise **toutes** les pièces du catalogue.

### Réserve d'événements (provisoire) : 8 tuiles uniques d'une case
Effets et conditions de pose sont des propositions. Jamais sur une ville, jamais sur le noyau, jamais sur une case occupée par un bataillon (provisoire). L'outil avertit si la pose coupe le plateau en deux ou isole une ville.

| Id | Nom | Se pose sur | Effet sur la case |
|---|---|---|---|
| E1 | Torrent de boue | plaine ou forêt | boue : coût 3 |
| E2 | Crevasse | plaine | infranchissable |
| E3 | Tunnel | une case de montagne | franchissable, coût 2 |
| E4 | Incendie | forêt | terre brûlée : coût 1 |
| E5 | Inondation | plaine | marais : coût 2 |
| E6 | Éboulement | case franchissable voisine d'une montagne | infranchissable |
| E7 | Chaussée | marais | coût 1 |
| E8 | Campement abandonné | plaine | campement : on y pioche une carte Campement |

## 3. Contrôles du plateau
Chaque contrôle renvoie `{regle, niveau ('erreur' | 'alerte' | 'info'), message, cases}`.
1. Inventaire : le plateau n'utilise que des pièces du catalogue, pas plus que le stock ; pièces restantes listées.
2. Pas de chevauchement ; plateau d'un seul tenant ; toutes les cases franchissables reliées entre elles. Un **trou** dans le plateau (zone vide fermée) est signalé en alerte (réglage `REGLAGES.trous` ; ajout de la revue, la règle revient à l'utilisateur).
3. A2 : aucune ville dans un monobloc hors noyau. Noyau présent, centré en (0,0).
4. Villes : 7 ; écart ≥ 4 pas entre toutes les paires (par les cases franchissables) ; 2 villes sur la rangée du haut, 2 sur la rangée du bas ; ce sont bien les deux villes les plus proches de chaque côté, sans égalité avec une troisième.
5. A6, contact : seuil paramétré (3 par défaut). Deux mesures, toutes deux calculées et affichées : **côtés** (nombre de cases voisines occupées par une autre pièce) et **pièces** (nombre de pièces voisines distinctes). La mesure retenue par défaut est « pièces » : c’est la lecture littérale de « 3 autres tuiles », et elle implique aussi 3 côtés ; « côtés » reste au choix.
6. Équilibre : pour chaque ville, coût minimal en rations depuis les villes de déploiement de Vert et depuis celles de Rouge ; score = somme des écarts entre une ville et sa symétrique vue de l'autre camp (0 = parfaitement équilibré). Répartition des terrains (%).
7. Événements posés : condition de pose respectée ; pas de coupure du plateau.

## 4. Générateur
`generer(graine, options)` : forme libre symétrique par demi-tour (hexagone de rayon 5 retouché sur le bord), noyau au centre, montagnes, monoblocs, villes, puis tuiles simples ; recherche qui minimise le score d'équilibre ; renvoie un plateau qui passe tous les contrôles en « erreur », ou un échec expliqué. Même graine = même plateau. Options : seuil de contact (2 ou 3), mesure de contact, nombre de tentatives.

**Mesure de faisabilité** (à faire avant l'interface) : sur 200 graines au moins, pour chaque combinaison seuil 2 / 3 × mesure côtés / pièces : taux de réussite, temps, score d'équilibre moyen, nombre de formes de bord différentes obtenues. Rapport dans `docs/03-mesures-faisabilite.md`. C'est la réponse à « voir si 2 tuiles peuvent convenir ».

## 5. Parties fictives : une table de jeu, pas un moteur de règles
Les règles V2.3 (`regles/`) n'ont ni liste de Troupes, ni or, ni marché arrêtés. L'outil ne les invente pas : il fournit une **table libre** où l'on joue à la main, avec des aides.
- Deux joueurs (Vert au nord, Rouge au sud) ; compteur de Gloire (0 à 15, jamais sous 0) ; 4 pions Bataillon par joueur, posés sur une case (1 par case), 1 à 3 Troupes par bataillon, marqueurs de dégâts par Troupe.
- Paquets : deck de chaque joueur (pioche, main limitée à 5, défausse, remélange de la défausse quand la pioche est vide), pioche **Campement** (les 15 effets de l'annexe 2, texte exact), pioche **Événements** (une carte par tuile de la réserve, provisoire).
- Troupes : **cartes provisoires clairement étiquetées** (nom, moral, Puissance, dés), modifiables dans l'outil ; rien n'est présenté comme décidé.
- Dés : lancer n d6, résultat détaillé, journal.
- Plateau : déplacer un pion vers une case voisine (l'outil indique le coût en rations et signale une case infranchissable ou occupée, sans interdire en mode libre) ; former sur une ville de déploiement libre de son camp ; marquer une ville capturée ; poser une tuile d'événement sur une case (recouvrement).
- Tour : compteur de tour, joueur actif, 2 actions comptées (aide seulement), bouton « fin du tour » qui pioche 1 carte pour le joueur suivant.
- Journal de tout ce qui se passe ; annuler / rétablir ; **aléa à graine** (une partie se rejoue à l'identique) ; enregistrer / ouvrir en JSON.

## 6. Technique
- Dossier `atelier/` : `index.html`, `src/*.js`, `styles/*.css`, `tests/*.test.js`, `outils/`. Page unique **hors ligne**, sans dépendance, sans modules ES, ouverte en `file://`. Mêmes conventions que `archives/plateau-carre/` (à lire : `docs/4-architecture.md`, un module de `src/`) : IIFE, espace de noms global `AT`, `if (typeof module !== 'undefined' && module.exports) module.exports = ...` pour les tests sous Node.
- **CSP stricte** comme `archives/plateau-carre/index.html` : aucun script ni style en ligne, aucun attribut `style=`, pas de `innerHTML` avec des données venues d'un fichier ouvert ; rendu en SVG construit par le DOM.
- Identifiants et commentaires en français sans accents dans les identifiants ; `’` dans les chaînes ; `node --check` après chaque modification.
- Tests : `node --test` lancé depuis `atelier/` (0 échec). Logique pure séparée de l'interface.
- Ne pas toucher à `archives/`, `tuiles/essais/`, `regles/`. Ne rien pousser, ne rien committer (le versionneur s'en charge).

### Modules
| Lot | Fichiers | Rôle |
|---|---|---|
| A cœur du plateau | `src/alea.js`, `src/hex.js`, `src/catalogue.js`, `src/plateau.js`, `src/controles.js`, `src/generateur.js`, `outils/mesures-faisabilite.js`, tests associés | aléa à graine ; géométrie hexagonale ; données du catalogue et de la réserve ; modèle du plateau (pièces posées, recouvrements, terrain effectif, coûts, chemins) ; contrôles ; générateur ; mesures |
| B table de jeu | `src/cartes.js`, `src/paquets.js`, `src/partie.js`, tests associés | données des cartes ; paquets ; état de la partie, journal, annuler / rétablir, sérialisation |
| C interface | `index.html`, `styles/*.css`, `src/rendu.js`, `src/app.js`, `src/vue-*.js`, `outils/serveur.js`, `outils/recette.html` | onglets Plateau / Inventaire / Partie |

### Contrat entre A et B (fixé ici pour travailler en parallèle)
- `AT.alea.creer(graine)` → `{ suivant() dans [0,1[, entier(n) dans 0..n-1, de() dans 1..6, melanger(tableau) (copie mélangée), choisir(tableau), etat() / restaurer(etat) }`. Graine : entier ou chaîne.
- `AT.hex` : `cle(q, r)` → `'q,r'` ; `decle(cle)` → `{q, r}` ; `DIRS` ; `voisines(cle)` → 6 clés ; `distance(a, b)`.
- `AT.plateau` : un plateau est un objet JSON simple `{ version, graine, pieces: [{id, modele, q, r, rotation}], recouvrements: [{evenement, cle}], camps: {vert: [cle, cle], rouge: [cle, cle]} }`. Fonctions pures : `cases(plateau)` → `{cle: {terrain, piece, origine}}` (terrain effectif, recouvrement compris) ; `cout(plateau, cle)` → nombre ou `Infinity` ; `villes(plateau)` → clés ; `poserEvenement(plateau, idEvenement, cle)` → `{ok, plateau, raison}` ; `retirerEvenement`.
- B ne dépend que de ce contrat ; B reçoit l'aléa et le plateau en paramètres.

## 7. Suites de la recette et de la revue (2026-11-19)
Rapports : `docs/03-mesures-faisabilite.md`, `docs/04-recette-atelier.md`, `docs/05-revue-atelier.md`. Ajouts au contrat : `plateau.trous`, `plateau.villesRangeesExtremes`, `generateur.incompatibilite`, `partie.defausserEvenement`, choix du premier joueur. Le générateur ne sait poser que le catalogue du §2 (il refuse tôt, avec la cause, un catalogue qu'il ne connaît pas) ; l'en-tête de `atelier/src/catalogue.js` dit ce qui se change librement.

## 8. Création à la main (demande de l'utilisateur du 2026-11-19, après la première livraison)
L'utilisateur veut créer lui-même des plateaux, en plus du générateur. Il a retenu les quatre volets ci-dessous. Les décisions encore ouvertes de la première livraison (seuil de contact, trous, catalogue…) restent ouvertes.

### 8.1 Modèle (lot D, à faire en premier)
- **Pièces personnelles dans le document du plateau** : champ facultatif `modeles` du plateau, liste de `{id, nom, cases: [{q, r, terrain}], quantite}`. Aucun registre global : un plateau ou une partie enregistrés se rouvrent seuls sur un autre poste. Toute recherche de modèle passe par le plateau (catalogue de base + pièces du document).
- Validation stricte d'une pièce personnelle : 2 à `REGLAGES.perso.casesMax` (6) cases d'un seul tenant, case (0,0) présente, terrains plaine / forêt / marais / montagne seulement (**jamais de ville**, règle A2), quantité 1 à `REGLAGES.perso.quantiteMax` (9), au plus `REGLAGES.perso.modelesMax` (24) pièces, identifiant de la forme `X` + chiffres (jamais un identifiant de base ni un nom de propriété d'objet), nom borné. Rotation seulement, pas de miroir (le carton n'a qu'un recto).
- Modifier ou supprimer une pièce personnelle déjà posée est refusé avec explication (il faut d'abord retirer ses exemplaires). On peut copier les pièces personnelles d'un plateau vers un autre.
- **Pose hors stock** : `poser` reste strict par défaut ; option explicite `{horsStock: true}` pour le pinceau. Modèle de base ajouté pour le pinceau : `M1` (une case de montagne, quantité 0, hors catalogue imprimé). Le contrôle 1 annonce en **alerte** « tuiles à prévoir en plus du catalogue : … » et, pour toute montagne d'une case, une alerte rappelant la décision « montagnes en blocs de 4 ou 5 ». Les totaux du catalogue imprimé (64 pièces, 91 cases) ne changent pas.
- **Équilibre** : sur un plateau sans symétrie par demi-tour, le score dit « non comparable » au lieu d'un nombre trompeur ; le tableau des coûts par ville reste affiché.
- **Générateur** : ne connaît que le catalogue de base ; sur un document qui a des pièces personnelles, il le dit (elles sont conservées dans le document mais non posées).
- Trois lecteurs acceptent ces plateaux : `plateau.valider`, `partie.validerPlateau`, `rendu`. Test d'intégration : pièce personnelle → enregistrer → rouvrir → `partie.creer`.
- **Bibliothèque** (logique pure, `src/bibliotheque.js`) : liste de `{id, nom, modifie, plateau}` sérialisée ; ajouter, renommer, dupliquer, supprimer, exporter tout / importer ; chaque lecture est validée (le stockage est une entrée non fiable) ; bornes de nombre et de taille. Le stockage (`localStorage`, clé à préfixe `atelier-plateau:`) est injecté, avec repli propre s'il est absent, plein ou illisible.

### 8.2 Interface (lot E)
- **Mode création guidé** : « Nouveau plateau vierge » (noyau déjà posé au centre, grille vide visible jusqu'au rayon 7), palette des pièces (catalogue + personnelles) avec stock restant, pose par clic **et** par glisser-déposer avec aperçu fantôme, rotation (R), contrôles en direct, liste « ce qu'il reste à faire » (pièces restantes, villes manquantes…).
- **Pinceau libre** : choisir un terrain (plaine, forêt, marais, montagne, ville) ou la gomme, peindre en cliquant ou en glissant ; un trait = une seule étape d'annulation, contrôles recalculés une fois par trait. Le pinceau pose des tuiles d'une case (stock d'abord, puis hors stock, annoncé). Il ne modifie ni une case de monobloc ni le noyau (message) ; la gomme retire une tuile d'une case, et un monobloc seulement après confirmation.
- **Mes monoblocs** : éditeur (petite grille : cliquer pour ajouter / retirer une case, choisir son terrain ; nom ; quantité), liste, modifier / supprimer (refus si posé), « copier depuis un plateau de la bibliothèque ». Visibles dans l'onglet Inventaire, à part du catalogue imprimé.
- **Bibliothèque** : enregistrer le plateau courant sous un nom, ouvrir, dupliquer, renommer, supprimer (confirmation), vignette et résumé (cases, erreurs / alertes), exporter tout / importer ; sauvegarde automatique du travail en cours et reprise à l'ouverture.
- Nouveaux fichiers : `src/vue-creation.js`, `src/vue-monoblocs.js`, `src/vue-bibliotheque.js`, `styles/creation.css` ; mêmes contraintes (CSP, pas de `style=`, pas d'`innerHTML`).

## 9. Catalogue 2 : monoblocs seulement, villes posées après la construction (décisions de l'utilisateur, 2026-11-19, seconde série)
Voir `docs/00-direction.md`. Ce chapitre remplace le catalogue du §2 et les règles de villes des §1 et §3. Compléments au §8.1 déjà en place : compteur d'identifiants de fiche, copies de secours, attache `ouvert` dans le travail en cours, nom et quantité d'une pièce posée modifiables, noyau jamais retiré par la gomme.

### 9.1 Règles
| N° | Règle de l'utilisateur | Traduction (les réglages marqués provisoires restent des paramètres) |
|---|---|---|
| B1 | Terrain uniquement en monoblocs de 3 ou 4 cases ; le noyau ne bouge pas ; montagnes en blocs. | Plus de pièce P / F / S d'une case dans le catalogue imprimé. |
| B2 | Quelques tuiles uniques de **remplissage** permises si le tout-monobloc est trop compliqué. | Pièce `R` (plaine d'une case), en petit nombre ; le nombre minimal utile est **mesuré** (§9.3). Elles restent l'exception : le générateur en pose le moins possible. |
| B3 | Le plateau est **construit par les joueurs**, puis ils **disposent les villes aux extrémités**. | Deux phases : **construction** (pièces de terrain), puis **villes**. Un plateau construit sans villes n'est pas en erreur : il est « à l'étape des villes ». |
| B4 | Villes de déploiement **posées SUR une case de Plaine** après la construction ; **2 par joueur**. | Tuile `VD` posée par-dessus (couche de recouvrement, avec propriétaire `vert` / `rouge`) ; sur une Plaine du **bord haut** (Vert) ou du **bord bas** (Rouge), hors noyau. « Bord haut / bas » : case de bord du plateau située dans les `profondeurExtremite` rangées extrêmes (provisoire : mesurer 1 et 2). `camps` est déduit de ces tuiles. |
| B5 | Villes neutres : **tuiles** placées **aux extrémités sur les côtés**, **pas sur une Plaine**. | Pièce `VN` (ville d'une case, ×2), ajoutée contre le bord du plateau, une sur le flanc gauche et une sur le flanc droit (provisoire : dans le tiers central des rangées). |
| B6 | Maintenu : 3 tuiles au moins entre deux villes. | 4 pas entre toutes les paires de villes (centre, 2 neutres, 4 de déploiement), comptés en cases franchissables (provisoire : à confirmer maintenant qu'une tuile fait 3 ou 4 cases). |
| B7 | Maintenu : contact ≥ 3 autres tuiles. | Mesure « pièces » pour les monoblocs. Tuile de remplissage et ville neutre : seuil propre, à **mesurer** (une tuile seule collée au bord touche souvent 2 pièces). |
| A2 relue | « Jamais de ville en monobloc sauf le noyau ». | Aucune ville **imprimée** dans un monobloc ; une `VD` posée par-dessus une Plaine de monobloc est permise (c'est une tuile à part). |

### 9.2 Catalogue 2 (provisoire)
Noyau `N1` (7 cases), montagnes `M4` et `M5`, 21 monoblocs de terrain = 75 cases (53 plaines, 11 forêts, 11 marais, soit 70,7 / 14,7 / 14,7 %) :
- 12 pièces de 4 cases : 5 tout en plaine ; 2 « 1 forêt + 3 plaines » ; 2 « 1 marais + 3 plaines » ; 1 « 2 forêts + 2 plaines » ; 1 « 2 marais + 2 plaines » ; 1 « 1 forêt + 1 marais + 2 plaines ».
- 9 pièces de 3 cases : 3 tout en plaine ; 1 « 3 forêts » ; 1 « 3 marais » ; 1 « 2 forêts + 1 plaine » ; 1 « 2 marais + 1 plaine » ; 1 « 1 forêt + 2 plaines » ; 1 « 1 marais + 2 plaines ».
- Formes variées (triangle, ligne, coude ; losange, zigzag, coude long, T…), sans miroir obligatoire. Si une tuile de remplissage `R` est retenue, la répartition doit rester à 70 / 15 / 15 à un point près.
- Villes : `VN` ×2 (tuiles d'une case), `VD` ×4 (tuiles posées par-dessus, 2 par joueur). Réserve d'événements inchangée ; un événement ne se pose pas sur une case portant une `VD`.

### 9.3 Mesure de faisabilité (avant toute interface) : `docs/07-mesures-catalogue-2.md`
Sur 300 graines au moins : (a) taux de réussite et temps du générateur selon le nombre de tuiles de remplissage en stock (0, 2, 4, 6, 9), et nombre réellement posé ; (b) contact des monoblocs, des remplissages et des villes neutres aux seuils 2 et 3 ; (c) nombre de Plaines admissibles pour les villes de déploiement (profondeur 1 et 2) et de places pour les villes neutres, plateaux sans solution ; (d) part des plateaux symétriques par demi-tour, et équilibre **sans symétrie** : écart entre Vert et Rouge du coût en rations vers le centre, vers chaque ville neutre et vers les villes de déploiement adverses ; (e) variété des formes. Conclusion en clair, avec une recommandation chiffrée sur le nombre de tuiles de remplissage.

### 9.4 Modèle et outil
- Le générateur **construit comme des joueurs** (à partir du noyau, pièce après pièce) plutôt que de remplir une forme tirée d'avance, puis pose les villes en cherchant le meilleur équilibre. Même graine = même plateau.
- Contrôles en deux groupes : construction (inventaire, chevauchement, continuité, trous, contact) et villes (nombre, écart, placement, équilibre). Équilibre redéfini sans symétrie (d).
- `villes()`, `camps` et `cases()` gardent leur forme pour que la table de jeu fonctionne ; test d'intégration avec `partie.creer`.
- **Anciens plateaux** (fichiers et bibliothèque faits avec le premier catalogue) : ils s'ouvrent toujours ; version du format augmentée ; leurs tuiles d'une case P / F / S / V restent lisibles comme pièces « hors catalogue ».
- Pinceau : toute tuile d'une case peinte est hors catalogue (sauf remplissage en stock) ; le pinceau « ville » est remplacé par les outils de la phase villes.
- Interface (lot suivant) : étape « Villes » après la construction (cases admissibles en surbrillance, refus expliqué), inventaire du catalogue 2, palette et « reste à faire » adaptés, onglet Partie inchangé dans son principe.

### 9.5 Suites (2026-11-19, soir)
- **Confirmé par l'utilisateur** : 4 pas au moins (en cases) entre deux villes ; ville neutre tenue par 2 tuiles ; extrémités = 2 rangées par défaut ; anciens plateaux toujours ouvrables.
- **Aucun monobloc tout en plaine** (décision de l'utilisateur) : chaque monobloc de terrain porte au moins une forêt ou un marais ; un bloc tout en forêt ou tout en marais reste permis. Le catalogue du §9.2 est remplacé : 21 monoblocs = 75 cases = 49 plaines (65,3 %), 13 forêts, 13 marais (17,3 % chacun) : `F3`, `S3`, une pièce mixte de 4 cases, et 18 pièces à une seule case spéciale (7 de 3 cases, 11 de 4 cases). La case spéciale est à une **extrémité** de la pièce, pour que les joueurs forment des bois et des marécages en accolant les pièces. Les pièces retirées restent lisibles (ancien catalogue).
- **Ajouts de la recette** (`docs/04`) : champ facultatif `profondeurExtremite` (1 à 3) enregistré dans le plateau ; `deploiements` refusés à la lecture hors du plateau ou hors d'une Plaine ; bouton « Autre proposition » pour la pose automatique des villes ; une ville neutre posée ne se manipule que dans l'étape « Villes ».
- **Suites de la revue `docs/08`** (tranchées par l'orchestrateur d'après les décisions de l'utilisateur) : la ville neutre touche **2 pièces distinctes** et se pose **n'importe où sur un flanc**, une par flanc (le tiers central n'est qu'une préférence du générateur) ; les poses **hors règles** faites à la main (tuile de terrain d'une case hors remplissage, monobloc tout en plaine, monobloc personnel d'une autre taille que 3 ou 4 cases) restent possibles mais sont des **erreurs** des contrôles ; le **noyau** ne se tourne ni ne se déplace ; le total de **7 villes** est contrôlé ; un plateau du **catalogue précédent** a son propre état (jouable, rien « à poser ») ; le tableau d'équilibre dit quel camp est avantagé.
