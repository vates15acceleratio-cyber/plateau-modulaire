# Atelier du plateau : recette du testeur (2026-11-19)

Contrat : `docs/02-atelier-cahier-des-charges.md`. Rien n'a été committé ni installé.

## Chiffres

| Vérification | Avant | Après corrections |
|---|---|---|
| `node --test` (depuis `atelier/`) | 177 OK, 0 échec | 184 OK, puis **189 OK, 0 échec** après la suite |
| Recette navigateur (`atelier/outils/recette.html`, Edge sans fenêtre, `file://`, budget 20000) | 151 OK, 0 ÉCHEC | 229 OK, puis **250 OK, 0 ÉCHEC** après la suite (durée réelle 3 s) |
| Règles du §1 sur plateaux générés (`node outils/verifier-regles.js 50`) | (n'existait pas) | **200 plateaux, 0 non conforme, 0 échec de génération** |

Les chiffres annoncés par les développeurs (177 / 151) sont confirmés avant toute modification. Les tests ajoutés pour les deux bogues signalés échouent bien sur l'ancienne logique (vérifié sur une copie hors projet).

## Bogues signalés : corrigés

### a. Trois villes sur une rangée extrême (`atelier/src/plateau.js`, `atelier/src/controles.js`)
- Cause : `campsAuto` rendait toutes les villes de la rangée ; `valider` refuse plus de 2 cases par camp, donc le fichier écrit ne se relisait pas et `partie.creer` refusait le plateau.
- Correction : `campsAuto` ne rend jamais plus de `REGLAGES.villesParCamp` cases. Dans le cas ambigu (3 villes ou plus sur la rangée), il ne choisit pas : la liste du camp est vide. Nouvelle fonction `plateau.villesRangeesExtremes` (toutes les villes des deux rangées, sans limite).
- Contrôle 4 : il compte sur `villesRangeesExtremes` et affiche « 3 villes à égalité sur la rangée du haut : on ne peut pas désigner les 2 villes de déploiement de Vert (aucune n'est retenue ; retirez-en 1) ». Les camps enregistrés sont comparés à `campsAuto`, donc pas de seconde erreur parasite. Le message d'équilibre non calculable couvre maintenant « il en manque, ou il y en a trop ».
- `plateau.valider` n'est pas assoupli (un fichier à 3 cases dans un camp reste refusé).
- Tests : `tests/plateau.test.js` (cas des 3 villes ; 1200 tentatives de retouche au hasard, les refus étant sautés, plateau relisible après chaque retouche acceptée, le cas ambigu est bien rencontré), `tests/controles.test.js`, `tests/integration.test.js` (retouche comme dans l'interface, puis enregistrer, relire, créer une partie).
- Recette : l'ancien cas « enregistrement refusé » est remplacé par « aucune ville désignée, contrôle 4 en erreur, fichier produit et rouvert à l'identique ».

### b. Cartes Événement des tuiles déjà posées (`atelier/src/partie.js`, `creer`)
- Cause : la pioche Événement recevait toujours les 8 cartes, même si le plateau portait déjà des tuiles.
- Correction : le mélange porte sur les 8 cartes (l'aléa avance de la même façon avec ou sans tuile posée), puis les cartes des tuiles déjà posées vont dans la défausse Événement, avec une ligne au journal. Les mains, la pioche Campement et l'ordre des cartes restantes sont identiques à ceux d'une partie sans tuile posée (testé).
- Relecture : un fichier de partie où la carte d'une tuile posée est encore à piocher ou en attente est refusé (« la tuile E2 est déjà sur le plateau, sa carte doit être dans la défausse »). Cet invariant tient pour tous les états que l'outil produit : l'opération générique sur les paquets ne touche que les decks des joueurs.
- L'interface garde son comportement : les tuiles posées à l'essai dans l'onglet Plateau ne suivent pas dans la partie (8 cartes, et c'est dit).
- Graine du plateau : `partie.validerPlateau` accepte maintenant 64 caractères au plus, comme `plateau.valider` (`LIMITES.grainePlateau`, test d'égalité avec `REGLAGES.bornes.longueurGraine`). La graine de la partie n'est pas modifiée (100).
- Tests : `tests/partie.test.js`, `tests/integration.test.js`.

## Défauts trouvés pendant les essais

| Défaut | État |
|---|---|
| Écran étroit (375 px) : la page de l'Inventaire débordait en largeur, textes et bandeau coupés. Cause : la grille `.at-atelier` n'avait pas de colonne bornée, elle prenait la largeur minimale des tableaux. | Corrigé (`styles/base.css` : `grid-template-columns: minmax(0, 1fr)` ; colonnes de nombres sans largeur imposée sous 1000 px). Capture refaite. |
| Onglet Plateau : retirer, tourner ou déplacer une pièce renvoie en réserve la tuile d'événement posée dessus, sans le dire. | Corrigé (`src/vue-plateau.js` : le message l'annonce, en alerte). Vérifié dans la recette pour le retrait et la rotation ; pas pour le déplacement. |
| Onglet Plateau : texte « Non calculable : il faut des villes de déploiement en haut et en bas » trompeur avec 3 villes sur une rangée. | Corrigé (texte). |
| Écran étroit : les deux tableaux de l'Inventaire restent plus larges que 375 px ; ils défilent dans leur zone, la dernière colonne n'est pas visible sans défilement. | Restant, mineur. |
| Écran étroit : boutons d’environ 25 à 30 px de haut (estimation sur capture), sous les 44 px d'une cible tactile. Le cahier des charges ne dit rien du mobile. | Non traité : voir « Décisions à soumettre ». |
| Graine de plateau `null` : `partie.validerPlateau` la laisse passer, puis le vrai `plateau.valider` la refuse (« Graine invalide »). Le résultat est un refus expliqué ; seule la tolérance annoncée en commentaire dans `partie.js` est sans effet avec le vrai plateau. L'interface ne produit jamais cette graine. | Restant, mineur. |
| Le tableau d'équilibre et l'affichage « rations depuis Vert / Rouge » se calculent sur `campsAuto`, les libellés « (Vert) / (Rouge) » sur les camps enregistrés. Sur un fichier ouvert dont les camps enregistrés diffèrent de la rangée, les deux ne concordent pas (le contrôle 4 signale déjà l'écart). | Restant, mineur. |

Aucun bogue de logique trouvé par mes essais dans le générateur, les paquets, l'annuler / rétablir ni la sérialisation.

## Constats du relecteur (`docs/05-revue-atelier.md`) repris ici

| Constat | État |
|---|---|
| I1 : un identifiant de pièce « constructor », « toString »… passe la validation et faisait planter le dessin. | Corrigé (`src/rendu.js` : table sans prototype). Vérifié dans le navigateur : plateau ouvert, 91 cases dessinées, partie créée dessus. |
| M1 : après un identifiant `p999999999999999` venu d'un fichier, la pièce posée ensuite recevait un identifiant trop long et le fichier ne se relisait plus. | Corrigé (`src/plateau.js`, `nouvelId` ignore les numéros de plus de 9 chiffres). Test Node ajouté. |
| M4 : une partie relue n'était pas passée aux contrôles du plateau. | Corrigé (`src/vue-partie.js` : le message d'ouverture annonce le nombre d'erreurs de construction). Cas ajouté à la recette. |
| I2, I3, M2, M3, M5, M6 | Tranchés ensuite par l'orchestrateur : voir « Suite : constats tranchés par l'orchestrateur », en fin de document. |
| M7 (graines hors du cas courant par appel direct), M8 (`creer` fait confiance à l'aléa reçu), M9 (`data:` permis pour les images), et la partie de M5 non demandée (`villesParCamp` hors options du contrôle 4, historique de 200 retouches, condition de E6 sur les coûts par défaut) | Non traités. Les questions 1 à 8 du relecteur restent pour l'utilisateur. |

Aucun constat du relecteur ne contredit les deux corrections (camp vide en cas d'égalité, carte d'une tuile posée en défausse) ; il les a vues et vérifiées.

## Essais exploratoires dans le navigateur (ajoutés à `atelier/outils/recette.js` : 78 vérifications de plus qu’au départ)

Tout passe par de vrais événements (clics, touches) dans Edge sans fenêtre, page ouverte en `file://`, même politique de sécurité que `index.html` ; aucune erreur JavaScript, aucune violation de la politique de sécurité. Le contrôle « page ouverte en `file://` » n'est compté que dans ce cas : ouverte par le serveur local, la recette compte un contrôle de moins et le dit sur une ligne INFO (non relancé par le serveur local).
- **Générer** : 6 graines (nombres et textes, dont accents et espaces) × seuils 3 et 2 : 64 pièces, 91 cases dessinées, 7 villes, 2 + 2 villes de déploiement, aucune erreur aux contrôles, fichier relisible, même graine = même plateau ; graine vide = graine 1.
- **Vider puis reconstruire à la main** : plateau vide enregistrable ; noyau, villes, 3e ville sur la rangée (cas ambigu, enregistré et rouvert), monoblocs posés tournés, 6 rotations sur place par monobloc comparées au modèle, déplacement refusé sur une place prise puis accepté, retrait, épuisement du stock de villes ; plateau relisible après chaque retouche ; partie possible sur un plateau partiel (erreurs rappelées) ; Ctrl+Z jusqu'au plateau de départ, retrouvé à l'identique.
- **Fichiers malformés ou hostiles** : 36 fichiers de plateau et 34 fichiers de partie (vide, tronqué, imbrication de 60 000 niveaux, trop gros, `__proto__`, `constructor`, identifiants et champs contenant du HTML, bornes dépassées, doublons, cartes en double, bataillon hors plateau…) : tous refusés avec un message, état inchangé, aucune pollution de `Object.prototype`, aucun élément injecté. Fichiers valides au contenu fautif (chevauchement, pièces dispersées, tuile hors plateau) : ouverts et signalés par les contrôles. HTML dans le journal et la graine d'une partie : affiché comme du texte.
- **Partie fictive de 5 tours** : former sur les villes de déploiement (clic et bouton), renfort, 3e action signalée, avertissements « hors déploiement » et « occupée », marche de 6 cases, case par case, vers une ville neutre (coût de chaque case au journal, total égal au chemin le moins cher), capture, montagne (avertissement puis « Faire quand même »), dés (bornes 1 à 100), carte Campement par bataillon (texte exact, second tirage averti), dégâts jusqu'à l'élimination, événement pioché puis posé (terrain changé, carte en défausse, seconde pose refusée même forcée), Gloire jusqu'à 15 (victoire, bornes), enregistrer puis rouvrir (état identique, mêmes dés et même carte Campement ensuite), annuler jusqu'au début puis rétablir jusqu'à la fin (états identiques).
- **Même graine = mêmes tirages** : même suite d'opérations rejouée, parties identiques au caractère près ; autre graine, autres tirages ; autre plateau avec la même graine de partie : mêmes mains et mêmes dés.

## Conformité aux règles du §1 (`atelier/outils/verifier-regles.js`)

Script indépendant des contrôles de l'outil (voisinage, parcours et comptes refaits ; seule la position des cases d'une pièce vient de `plateau.casesPiece`). Graines 1 à 50, pour chaque combinaison seuil 3 / 2 × mesure côtés / pièces : 200 plateaux générés, **0 échec de génération, 0 non conforme**.
- Toutes les pièces du catalogue posées (64 pièces, 91 cases), aucun chevauchement, plateau d'un seul tenant, cases franchissables reliées, noyau en (0,0).
- 7 villes ; écart minimal observé 4 pas (par les cases franchissables) ; exactement 2 villes sur chaque rangée extrême, égales aux camps enregistrés ; aucune ville dans un monobloc hors noyau.
- Contact minimal observé égal au seuil demandé (3, puis 2) avec la mesure demandée.
- Terrains : 53 plaines, 11 forêts, 11 marais partout ; score d'équilibre 0 partout ; fichier relisible ; même graine = même plateau (5 graines par combinaison).
- Le script détecte bien les manquements (essai avec une ville retirée : 6 manquements listés).

## Captures d'écran (dossier temporaire, hors projet)

- Bureau 1280 × 800, onglet Plateau (graine 12) : trois colonnes, plateau entier, légende complète, 7 contrôles « Conforme », rien de coupé.
- Bureau, onglet Inventaire : tableau des 13 modèles dessinés, totaux et répartition lisibles. Les onglets Plateau et Inventaire ont été recapturés après la correction de la grille : identiques.
- Bureau, onglet Partie (partie en cours de la recette, et `#onglet=partie&partie=5`) : mains, bataillons, pions V1 / V2 / R1 / R2, coûts sur les cases voisines, carte Campement, dés, journal.
- Largeur 375 px (page dans un cadre de 375 × 1600 px et non 375 × 812, ce qui étire la zone du plateau, réglée à 70 % de la hauteur ; cadre nécessaire car Edge sans fenêtre ne descend pas sous environ 500 px de large : une capture directe à 375 px est rognée à droite sans que la page déborde) : onglets Plateau et Partie en une colonne, sans débordement ; Inventaire corrigé (voir plus haut).
- Impression (PDF produit par Edge puis rendu) : une page, plateau et légende seuls.

## Non vérifié

- Le sélecteur de fichier du système (« Ouvrir… ») et l'écriture réelle d'un fichier téléchargé : la recette passe le texte directement à `ouvrirTexte` et intercepte les téléchargements.
- Firefox et Chrome (Edge seulement).
- Interactions à la souris réelles (survol continu, molette physique, cliquer-glisser manuel), boîte de dialogue des Troupes à l'écran, tactile : simulés par événements, pas vus sur une capture.
- Générateur au-delà des graines 1 à 50 et des 6 graines de la recette (`docs/03-mesures-faisabilite.md` annonce 500 graines par combinaison ; non refait ici).
- Lisibilité de l'impression sur papier.

## Décisions à soumettre

**Usage sur téléphone ou tablette.** Le cahier des charges ne dit rien du mobile ; l'outil s'affiche en une colonne sous 1000 px, mais ses boutons font environ 25 à 30 px de haut et les tableaux de l'Inventaire demandent un défilement horizontal.
- Option A, bureau seulement : rien à changer. Avantage : interface dense, tout tient à l'écran sur un poste. Inconvénient : commandes difficiles à toucher du doigt.
- Option B, hauteur minimale de 44 px pour les boutons et les champs sur écran étroit ou tactile (règle CSS dans `styles/base.css`, sans toucher au bureau). Avantage : utilisable au doigt. Inconvénient : panneaux plus longs à faire défiler sur petit écran ; les tableaux de l'Inventaire resteraient à traiter à part.

## Fichiers modifiés ou ajoutés

`atelier/src/plateau.js`, `atelier/src/controles.js`, `atelier/src/partie.js`, `atelier/src/rendu.js`, `atelier/src/vue-plateau.js`, `atelier/src/vue-partie.js`, `atelier/styles/base.css`, `atelier/outils/recette.js`, `atelier/outils/verifier-regles.js` (nouveau), `atelier/tests/integration.test.js` (nouveau), `atelier/tests/plateau.test.js`, `atelier/tests/controles.test.js`, `atelier/tests/partie.test.js`, `atelier/README.md`.

## Suite : constats tranchés par l'orchestrateur (même jour)

Chiffres après cette suite : `node --test` **189 OK, 0 échec** ; recette Edge **250 OK, 0 ÉCHEC** ; `node outils/verifier-regles.js 50` **200 plateaux, 0 non conforme, 0 échec de génération**.

| N° | Correction | Fichiers | Vérification |
|---|---|---|---|
| I2 | Contrôle 2 : constat « Un trou dans le plateau : 1 case vide entourée par des tuiles (q,r) », niveau **alerte**, cases du trou en surbrillance. Réglage `REGLAGES.trous` (`alerte`, `erreur`, `ignore`), aussi accepté en option des contrôles. Nouvelle fonction `plateau.trous(cles)`. Un plateau généré affiche « aucun trou ». | `src/catalogue.js`, `src/plateau.js`, `src/controles.js` | Test Node (les trois niveaux, trou de 2 cases, échancrure ouverte, scénario de la revue) ; recette (retrait d'une plaine entourée, surbrillance de la case vide, plaine reposée au bord : 0 erreur, alerte gardée). |
| I3 | `generer` échoue avant tout essai, avec `incompatible: true` et une raison qui nomme la cause : nombre de cases différent de celui de l'hexagone du rayon, nombre de villes d'une case différent de 6, monobloc ou modèle d'une case inconnu, monobloc en plusieurs exemplaires, `villesParCamp` différent de 2. Nouvelle fonction `generateur.incompatibilite`. En-tête de `catalogue.js` réécrit : ce qui se change librement, ce qui demande d'adapter le générateur. L'interface n'ajoute plus « Essayez la graine suivante » dans ce cas. | `src/generateur.js`, `src/catalogue.js`, `src/vue-plateau.js` | Test Node (8 villes, monobloc de plus, deux M4, modèle inconnu, 92 cases, rayons 4 et 6 ; 7 forêts et 37 plaines génère toujours) ; recette (message à l'écran, plateau inchangé, reprise après retour au catalogue). |
| M1 | `nouvelId` choisit un identifiant libre : il avance tant que le numéro est pris. | `src/plateau.js` | Test Node (fichier avec `p999999999`, `p1000000000`, `p1000000001` : 5 poses, aucun doublon, fichier relisible). |
| M2 | Le serveur répond 403 à tout chemin contenant une barre oblique inversée, écrite ou encodée (`%5c`). | `outils/serveur.js` | Nouveau `tests/serveur.test.js` : serveur lancé sur un port libre, 13 chemins refusés (dont `/%5c.git%5cconfig`), pages normales servies, POST 405, hôte étranger 403. |
| M3 | Opération `partie.defausserEvenement` (carte en attente vers la défausse Événement, journalisée, tuile laissée en réserve) et bouton « Défausser sans poser » sous chaque carte en attente. | `src/partie.js`, `src/vue-partie.js` | Test Node (refus si la carte n'est pas en attente, annuler / rétablir, fichier relisible) ; recette (bouton, compteurs, journal, annuler, rétablir). |
| M6 | Liste « Premier joueur » (Vert / Rouge) à côté de « Nouvelle partie » ; elle part du réglage par défaut et reprend celui d'une partie rouverte. | `src/vue-partie.js` | Recette (Rouge commence et pioche, puis Vert, puis réouverture d'un fichier). La logique de `creer` était déjà testée sous Node. |
| M5 | Listes « Seuil de contact » et « Mesure » initialisées depuis `REGLAGES` ; le maximum du champ des dés suit `desMax` de la partie. | `src/vue-plateau.js`, `src/vue-partie.js` | Recette (valeurs initiales ; partie réglée sur 50 dés : champ à 50, 40 dés lancés ; retour à 30). Pas de test Node : pur affichage. |

Capture refaite de l'onglet Partie (bureau et cadre de 375 px) : la liste « Premier joueur » tient dans la barre, rien de coupé.

Limites de cette suite :
- le test du serveur prouve le 403 ; il n'a pas été rejoué sur l'ancienne version du serveur (le relecteur y avait mesuré un 404 pour `/%5c.git%5cconfig`) ;
- le niveau `erreur` des trous n'a pas été essayé avec le générateur (il refuse déjà les trous à la construction de la forme) ;
- l'en-tête de `catalogue.js` a été vérifié sur deux points : forme et terrain des monoblocs changés (F3 et S3 en ligne, terrains de F31 et S31 modifiés : 20 générations sur 20 réussies à chaque fois, graines 1 à 10, seuils 3 et 2) ; en revanche ajouter ou retirer un événement demande aussi `src/cartes.js` et `src/rendu.js`, et l'en-tête le dit ;
- `docs/02-atelier-cahier-des-charges.md` (contrôle 2, contrat entre A et B) ne mentionne ni les trous ni les fonctions ajoutées : à mettre à jour par l'orchestrateur.

Recette relancée par le serveur local (`http://127.0.0.1:8793/outils/recette.html`, serveur arrêté ensuite) : **249 OK, 0 ÉCHEC**, avec la ligne INFO qui remplace le contrôle `file://`.

Fichiers touchés en plus : `atelier/src/catalogue.js`, `atelier/src/generateur.js`, `atelier/outils/serveur.js`, `atelier/tests/serveur.test.js` (nouveau), `atelier/tests/generateur.test.js`.
