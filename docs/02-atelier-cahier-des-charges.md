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
5. A6, contact : seuil paramétré (3 par défaut). Deux mesures, toutes deux calculées et affichées : **côtés** (nombre de cases voisines occupées par une autre pièce) et **pièces** (nombre de pièces voisines distinctes). La mesure retenue par défaut est « côtés » (provisoire).
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
