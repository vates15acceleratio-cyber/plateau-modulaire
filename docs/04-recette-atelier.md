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

## Création à la main (recette du même jour, cahier des charges §8)

### Chiffres

| Vérification | Annoncé | Constaté avant mes changements | Après |
|---|---|---|---|
| `node --test` (depuis `atelier/`) | 237 OK | 237 OK, 0 échec | **239 OK, 0 échec** |
| Recette Edge sans fenêtre, `file://`, budget 20000 | 393 OK | 393 OK, 0 ÉCHEC | **456 OK, 0 ÉCHEC** (15 s réelles) |
| `node outils/verifier-regles.js 50` | 0 non conforme | 200 plateaux, 0 non conforme | **200 plateaux, 0 non conforme, 0 échec de génération** |
| Persistance réelle (`#persistance=ecrire` puis `lire`, même profil temporaire neuf, sans fenêtre) | | | 6 OK puis 7 OK ; `index.html` relancé sur ce profil reprend le travail en cours (6 pièces, 12 cases) |

### Point 6 : « côtés (retenue) » sur `docs/captures/creation-guidee.png`
C'est l'état de la recette, pas un défaut d'initialisation. Le scénario « Générer » de `outils/recette.js` remettait la mesure sur « côtés » (écrit quand c'était le défaut) ; toute la suite, états de démonstration compris, tournait donc sous « côtés ». Une capture directe de `index.html#mode=creer&graine=12` sur un profil neuf affiche « pièces » (retenue). Corrigé dans la recette : elle revient à `REGLAGES.mesureContact`, et un contrôle le vérifie. Aucun des 393 contrôles n'a échoué sous « pièces ». **La capture de `docs/captures` est à refaire par l'orchestrateur.**

### Défauts trouvés

| Défaut | État |
|---|---|
| **Impression en mode « Créer à la main » ou « Pinceau »** : la grille vide en pointillés (rayon 7) sortait sur la page imprimée. | Corrigé (`src/rendu.js` : groupe `at-grille-vide` ; `styles/base.css` : masqué à l'impression). Vérifié sur un PDF rendu, avant et après. Le cadrage tient toujours compte de la grille : le plateau imprimé est un peu plus petit dans ces modes. |
| **Mes monoblocs, quantité** : « 2.5 » était lu 2 et « 1e1 » lu 1, sans rien dire. | Corrigé (`src/vue-monoblocs.js`, `definition` : chiffres seulement, sinon refus avec le message habituel). Test Node ajouté. |
| **Mes monoblocs, deux cases éloignées** : le message était « Position invalide. », qui ne dit pas quoi faire. | Corrigé (`avis` : « Les cases doivent se toucher : la pièce est en plusieurs morceaux. »). Test Node ajouté. |
| La recette tournait sous une mesure de contact qui n'est plus le défaut (voir point 6). | Corrigé dans `outils/recette.js`. |

Aucun autre défaut trouvé par les essais ci-dessous.

### Essais ajoutés à `outils/recette.js` (4 scénarios « Testeur », 62 contrôles de plus)
1. **Plateau complet construit à la main** : plateau vierge, puis les 63 pièces d'un plateau généré posées une à une par l'interface (clic, glisser-déposer des 8 monoblocs avec rotation par R pendant le geste, clavier) ; plateau identique au patron case pour case, « Plateau terminé », « Plateau conforme », palette épuisée, fichier relisible ; stock épuisé : ni clic ni glisser ne posent ; 63 annulations puis 63 rétablissements, états identiques ; les 13 modèles posés par glisser-déposer ; une pièce personnelle posée par clic et par glisser.
2. **Pinceau** : 8e ville (hors stock annoncée, contrôle 4 en erreur, « 1 en trop ») ; trait entièrement sur le noyau (aucune étape d'annulation) ; trait interrompu (`pointercancel`) ; case portant une tuile d'événement repeinte ; noyau gommé après confirmation puis annulé ; clic très loin de la grille (jamais hors des bornes du format).
3. **Mes monoblocs** : 1 case, 6 cases sans (0,0) (recentrée), 7 cases, non connexe ; nom vide, nom de 1000 caractères posé malgré la limite du champ (refusé), nom en HTML (texte dans la liste, la palette et l'inventaire) ; quantités invalides ; pièce chargée dans l'éditeur puis posée entre-temps (sa forme ne change pas) ; suppression d'une pièce posée refusée ; 25e pièce refusée ; palette à 37 boutons ; fichier de plateau et fichier de partie à 24 pièces personnelles rouverts à l'identique.
4. **Entrées hostiles et bibliothèque aux limites** : 30 pièces personnelles fautives (ville, 7 cases, non connexe, sans (0,0), identifiants `P`, `constructor`, `__proto__`, doublons, quantités, noms, champs en trop, 25 pièces…) passées par les quatre entrées (fichier de plateau, fichier de partie, import de bibliothèque, contenu du stockage : liste et travail en cours) : jamais acceptées, états inchangés ; 40 plateaux puis le 41e, duplication et import dans une bibliothèque pleine (refus expliqués) ; même fichier importé deux fois (identifiants distincts) ; stockage qui lève une exception quelconque (aucune exception ne sort, avis affiché).

Non-régression : tous les scénarios antérieurs passent (générer, partie fictive, export SVG et PNG) ; impression du mode « Générer » déjà vue plus haut.

### Paquet (`python -I atelier/outils/empaqueter.py`)
- Produit `dist/atelier-plateau.zip` (26 fichiers, 140 891 octets). **`dist/` est un nouvel artefact hors de `atelier/`** : à ignorer ou à suivre, au choix de l'orchestrateur.
- Contenu : un seul dossier « Atelier du plateau », les 18 scripts de `src/`, ni tests ni outils.
- `Atelier.command` : système Unix, mode 0755, aucune fin de ligne Windows, commence par `#!/bin/sh`. `Atelier.bat` : fins de ligne Windows gardées.
- Page décompressée dans un dossier temporaire, ouverte sans fenêtre avec `#graine=7` : 64 pièces, 91 cases, « Plateau conforme », 4 feuilles de style, aucune erreur en console.

### Lanceur `Atelier.bat` : vérifié sans le laisser démarrer Edge
- Le `.bat` a été exécuté contre un **témoin** (faux `msedge.exe` qui note ses arguments, `ProgramFiles` redirigés) : il n'a donc lancé aucun navigateur. Depuis « Jeux de société à moi\Atelier du plateau », il passe exactement `--app=file:///…/Jeux de société à moi/Atelier du plateau/index.html` (un seul argument, accents intacts, fichier existant). Même résultat depuis un dossier avec parenthèses, esperluette et apostrophe.
- Cette adresse, donnée à Edge sans fenêtre, charge la page et génère un plateau (espaces seuls, accents seuls, les deux, et le dossier à caractères spéciaux).
- Non essayé : un chemin contenant `%` ou `#` (le lanceur ne les encode pas).
- **Fenêtres visibles ouvertes par erreur de ma part, avant la consigne de l'utilisateur** : pour voir le mode application, j'ai lancé moi-même le vrai Edge (pas par le `.bat`) dix fois, quelques secondes chacune, sur des profils temporaires (`--user-data-dir`), puis fermé chaque fois le seul processus que j'avais lancé. L'Edge de l'utilisateur n'a pas été touché et sa bibliothèque n'a pas été lue. Deux effets à connaître : sur un profil neuf, Edge s'est connecté de lui-même au compte du poste (une fenêtre « synchronisation » est apparue dans l'un des essais) ; et les dossiers de ces profils (`p-app`, `p-app-1` à `p-app-5`, dans le dossier temporaire de la session) n'ont pas pu être supprimés (accès refusé). Aucun processus de ces essais ne tourne plus.
- Ces essais n'ont rien établi de fiable sur le mode application avec un chemin accentué (résultats incohérents d'un essai à l'autre, sans doute dus au premier lancement du profil) : **l'ouverture réelle en fenêtre d'application depuis un dossier accentué reste à vérifier par l'utilisateur lui-même**, en double-cliquant le lanceur.

### Non vérifié
- `Atelier.bat` et `Atelier.command` lancés pour de bon (voir ci-dessus) ; le Mac.
- Touche Échap dans la fenêtre de confirmation, sélecteur de fichier (« Ouvrir… », « Importer… ») : non simulables par la recette.
- Stockage réel plein ou refusé par le navigateur (simulé par un stockage injecté).
- Firefox et Chrome ; souris et tactile réels ; affichage des nouveaux modes sur écran étroit.

### Fichiers touchés dans cette recette
`atelier/src/vue-monoblocs.js`, `atelier/src/rendu.js`, `atelier/styles/base.css`, `atelier/outils/recette.js`, `atelier/tests/creation-interface.test.js`, `docs/04-recette-atelier.md` ; `dist/atelier-plateau.zip` produit par l'empaqueteur.

## Catalogue 2 et étape « Villes » (recette du même jour, cahier des charges §9)

Rien n'a été committé ni installé. Edge seulement sans fenêtre (`--headless=new`), sur des profils temporaires ; `Atelier.bat` n'a pas été lancé.

### Chiffres

| Vérification | Annoncé | Constaté avant mes changements | Après |
|---|---|---|---|
| `node --test` (depuis `atelier/`) | 284 OK | 284 OK, 0 échec | **302 OK, 0 échec** (13 s) |
| Recette Edge sans fenêtre, `file://`, budget 20000 | 584 OK | 584 OK, 0 ÉCHEC (52 s) | **675 OK, 0 ÉCHEC** (98 s réelles) |
| `node outils/verifier-regles.js 50` | 250 plateaux, 0 non conforme | 250 plateaux, 0 non conforme, 0 échec de génération | **391 plateaux, 0 non conforme** ; 9 échecs de génération, tous à 1 rangée (voir plus bas) |
| `node outils/verifier-regles.js 100` | | | **785 plateaux, 0 non conforme** ; 15 échecs de génération, tous à 1 rangée |
| Persistance réelle (deux lancements du même profil temporaire) | | | `ecrire` / `lire` : 6 OK puis 7 OK ; `ecrire-villes` / `lire-villes` : 7 OK puis 8 OK |

Le nombre de plateaux du vérificateur change parce qu'il essaie maintenant 8 combinaisons au lieu de 5 (ajout des extrémités de 1 et de 3 rangées). Sur les 5 combinaisons d'origine, les chiffres sont les mêmes qu'avant : 250 plateaux, 0 non conforme, 0 échec.

Non-régression du générateur : l'empreinte des plateaux générés (graines 1 à 50 × les 5 combinaisons d'origine, la pose automatique sur 20 graines, les extrémités de 1 et 3 rangées sur 20 graines) est identique avant et après, au seul texte des trois échecs à 1 rangée près.

### A. Corrections décidées par l'orchestrateur

| N° | Ce qui est fait | Fichiers | Tests |
|---|---|---|---|
| 1 | Champ facultatif `profondeurExtremite` du plateau (1, 2 ou 3 ; **absent = 2**, le réglage par défaut, comme `modeles` et `deploiements` s'écrivent par leur absence). Validé strictement par `plateau.valider` et par `partie.validerPlateau`. Les contrôles, les places, la pose, la pose automatique et le résumé d'une fiche emploient d'abord la profondeur du document, puis l'option, puis le défaut (`plateau.profondeurExtremite(plateau, options)`). Le générateur l'écrit dans le plateau rendu. Dans l'interface, le plateau affiché est la seule source : la liste déroulante le montre et le modifie (une étape d'annulation) ; ouvrir un fichier ou une fiche, annuler, rétablir la remettent d'eux-mêmes. « Générer », « Nouveau plateau vierge » et « Vider » gardent le réglage du plateau affiché. La partie fictive l'emporte. Les champs du plateau sortent toujours dans le même ordre. | `src/plateau.js`, `src/catalogue.js`, `src/controles.js`, `src/generateur.js`, `src/partie.js`, `src/vue-partie.js`, `src/vue-plateau.js`, `src/vue-villes.js` | 4 tests « correction 1 » ; recette : scénarios « générer 20 graines » et « profondeur enregistrée » ; persistance `ecrire-villes` / `lire-villes` |
| 2 | Une ville neutre posée ne se tourne, ne se déplace et ne se retire que par l'étape « Villes ». Ailleurs : « Tourner » (R), « Déplacer », « Retirer » (Suppr), le glisser en création guidée, le pinceau et la gomme la laissent en place, avec le message « Une ville neutre ne se déplace, ne se tourne et ne se retire qu'à l'étape « Villes »… ». `plateau.retirer` reste libre (l'étape « Villes » s'en sert). | `src/plateau.js` (`peindre`, `gommer`), `src/vue-plateau.js` (`refusRetoucheVille`, `deplacerPiece`) | test « correction 2 » ; recette : 7 contrôles de refus dans « Retouche », « Essais : vider puis reconstruire » et le scénario fait main |
| 3 | Quand « Générer » échoue et que des terrains construits n'ont manqué de places de villes qu'à cause de la profondeur, le message le dit, donne le nombre de terrains concernés et la profondeur qui aurait suffi, et ne conseille plus « le seuil de contact 2 ». La cause n'est annoncée que si un essai plus profond **sur le même terrain** réussit ; cet essai se fait sur un aléa à part, donc les plateaux générés ne changent pas. | `src/generateur.js`, `src/vue-plateau.js` | test « correction 3 » ; recette : 3 échecs sur 40 générations à 1 rangée, tous expliqués ainsi |
| 4 | Bouton « Autre proposition » dans la même ligne que « Poser les villes automatiquement ». Il passe à la combinaison valide suivante, de la mieux équilibrée à la moins équilibrée (`generateur.propositionsVilles`), en partant de celle du plateau ; après la dernière, retour à la première. Aucun tirage : même plateau = même suite, y compris après « Annuler ». Une étape d'annulation par proposition ; le message donne le rang, le nombre de combinaisons et le score. « Poser automatiquement » n'a pas changé (vérifié par l'empreinte). | `src/generateur.js`, `src/vue-villes.js` | 2 tests « correction 4 » ; recette : 5 propositions de suite, annuler, reprendre |
| 5 | `plateau.valider` **refuse** une entrée `deploiements` qui vise une case absente du plateau ou une case dont la tuile du dessous n'est pas une Plaine. Voir le choix ci-dessous. | `src/plateau.js` | 3 tests « correction 5 », dont 2 457 retouches au hasard ; recette : 43 fichiers hostiles par quatre entrées |
| 6 | Sur un plateau de l'ancien catalogue (il porte une tuile de ville d'une case), le contrôle 1 rend un seul constat, en « Conforme » : « Plateau de l'ancien catalogue : 55 tuiles d'une case de ce catalogue (39 × Plaine, 5 × Forêt, 5 × Marais, 6 × Ville). Il ne se compare pas à l'inventaire du catalogue 2. » Plus de « Pièces de terrain restantes (15) », de « Tuiles à prévoir en plus (55) » ni de « Tuiles facultatives non posées ». Une tuile qui n'est d'aucun catalogue (montagne d'une case) reste annoncée. Un plateau du catalogue 2 avec une forêt peinte n'est pas un ancien plateau : rien ne change pour lui. | `src/controles.js` | test « correction 6 », `tests/controles.test.js`, `tests/integration.test.js` ; recette : 4 contrôles |

**Correction 5 : option retenue et raison.** Refus strict, sans exception pour la pose libre. La question était de savoir si un plateau enregistré par l'outil peut porter une telle entrée ; la réponse est non, pour trois raisons vérifiées dans le code puis par test :
- la pose libre elle-même exige une Plaine du plateau, hors noyau (dans `refusDeploiementSurCases`, le contrôle du terrain passe avant la sortie « libre ») : testé sur toutes les cases d'un plateau et sur son pourtour ;
- toute retouche du terrain (retirer, tourner, déplacer, repeindre, gommer) retire la ville avec la Plaine qui la portait ;
- un test applique 2 457 retouches acceptées, tirées au hasard, depuis trois départs (plateau généré, plateau vierge, fichier valide dont deux pièces se chevauchent sous une ville) : après chacune, le fichier se relit et se réécrit à l'identique, et aucune ville n'est hors d'une Plaine.

Une exception « pose libre » aurait demandé un marqueur de plus dans le fichier pour un cas qui n'existe pas. Ce qui reste accepté à la lecture et signalé par les contrôles : une ville sur une Plaine mal choisie (noyau, hors de l'extrémité, trop près d'une autre), c'est-à-dire tout ce que la pose libre sait produire. En cas de chevauchement, la « Plaine d'origine » est celle de la première pièce de la liste, comme dans `cases()`. Le contrôle des villes garde sa vérification pour un document monté en mémoire. Effet sur le contenu déjà stocké : une fiche de la bibliothèque qui porterait une telle entrée serait écartée à la lecture avec une copie de secours (comportement existant), sans rendre la bibliothèque illisible ; l'outil n'a jamais pu en écrire.

Conséquence assumée : deux contrôles de la recette et un test Node attendaient l'ancien comportement (fichier accepté puis signalé) ; ils attendent maintenant le refus.

### Défauts trouvés pendant les essais

| Défaut | État |
|---|---|
| `copier()` rendait les champs du plateau dans un ordre qui dépendait de la retouche (une ville posée sur un plateau à pièces personnelles donnait `modeles` avant `deploiements`, le fichier relu l'inverse). Sans effet sur les fichiers, mais deux plateaux égaux pouvaient différer une fois écrits par `JSON.stringify`. | Corrigé (`src/plateau.js`, ordre fixe). Testé. |
| **Une fiche ou une partie était jugée avec la profondeur du plateau affiché** quand elle n'avait pas la sienne (défaut introduit par ma correction 1, vu à la relecture) : plateau affiché à 1 rangée, une fiche à 2 rangées annonçait « 3 erreurs » sur sa carte et une partie ouverte « 3 erreur(s) aux contrôles », alors que toutes deux s'ouvrent sans erreur. À 3 rangées, de vraies erreurs étaient cachées. | Corrigé (`src/vue-bibliotheque.js`, `src/app.js` : la profondeur du plateau affiché n'est plus transmise aux contrôles d'un autre document). Test Node et 3 contrôles de recette ajoutés. |
| Le vérificateur indépendant ne signalait pas une ville hors d'atteinte (distance infinie jamais comparée) et ne connaissait que 2 rangées. | Corrigé, voir C. |
| Le vérificateur affichait « même graine = même plateau 2/5 » à 1 rangée, parce que 3 des 5 premières graines échouent. | Corrigé (compte sur les plateaux générés). |

Aucun autre défaut de logique trouvé dans l'étape « Villes », la table de jeu, les exports ni la reprise du travail en cours.

### B. Essais ajoutés à `outils/recette.js` (4 scénarios « Testeur C2 », 91 contrôles de plus qu'au départ)

Tout passe par de vrais événements dans Edge sans fenêtre, page ouverte en `file://`, même politique de sécurité : aucune erreur JavaScript, aucune violation de la politique de sécurité.

1. **Générer 20 graines × profondeur 1 / 2 / 3 × remplissages 0 / 2** (120 générations par l'interface). Tout plateau rendu est complet, sans erreur, à 7 villes, relisible, rouvert à l'identique, ses villes dans les rangées de sa profondeur (calcul refait dans la recette), profondeur enregistrée et réglage affiché d'accord.

   | Profondeur | Remplissages permis | Générés | Échecs | Remplissages posés | Plateaux avec une ville au-delà de la 2e rangée |
   |---|---|---|---|---|---|
   | 1 | 0 | 17 | 3 (profondeur en cause, dit) | 0 | 0 |
   | 1 | 2 | 20 | 0 | 10 | 0 |
   | 2 | 0 | 20 | 0 | 0 | 0 |
   | 2 | 2 | 20 | 0 | 14 | 0 |
   | 3 | 0 | 20 | 0 | 0 | 15 |
   | 3 | 2 | 20 | 0 | 13 | 17 |

   À 3 rangées, 32 plateaux sur 40 ont une ville au-delà de la 2e rangée : ce sont eux qui repassaient en erreur à la réouverture avant la correction 1 (vérifié sur l'un d'eux, privé de son champ).
2. **Plateau construit entièrement à la main, puis villes.** Les 23 pièces de terrain d'un patron posées une à une (clic, et une sur trois au clavier) ; « Passer à l'étape Villes » ; ville posée par clic, puis au clavier (flèches et Entrée) ; 5 refus de ville de déploiement (forêt, montagne, noyau, case vide, extrémité de l'autre camp) et 3 de ville neutre (case occupée, hors des flancs, flanc déjà pourvu), chacun avec la raison du modèle ; pose libre acceptée, signalée « mal placée », enregistrée et rouverte ; les 6 villes posées à la main jusqu'à « Plateau terminé » ; pose automatique égale au calcul pur ; « Autre proposition » 5 fois (96 combinaisons sur ce terrain), annuler, reprendre. Puis retirer, tourner et déplacer en la glissant la pièce qui porte une ville ; glisser, gommer et peindre une ville neutre (refusés) ; 32 annulations jusqu'au noyau seul et 32 rétablissements, chaque état relisible, les étapes « complet », « villes », « construction » traversées, plateau final identique.
3. **Profondeur enregistrée, anciens fichiers, fichiers hostiles.** Réglage à 3, annulé, rétabli ; plateau généré à 3 rangées enregistré, rouvert après un plateau à 2 rangées (réglage relu, aucune erreur) ; ramené à 2 (« mal placée »), annulé ; fiche de bibliothèque jugée avec sa propre profondeur, rouverte sans « (modifié) », exportée et importée ; travail en cours ; fiches à 2 et à 3 rangées et partie à 2 rangées vues depuis un plateau affiché à 1 rangée (aucune erreur annoncée) ; partie créée, enregistrée et rouverte. **43 fichiers hostiles** sur `deploiements` et sur la profondeur (valeurs hors bornes, textes, listes, objets, HTML, `__proto__`, `constructor`, clés mal formées, ville hors du plateau, sur forêt, marais, montagne, ville du noyau, ville neutre, 9 villes, doublons, 3 villes pour un camp, ville sous un événement), chacun par quatre entrées (fichier de plateau, fichier de partie, import de bibliothèque, travail en cours du stockage) : jamais acceptés, états inchangés, aucune pollution de `Object.prototype`, aucun élément injecté. **Anciens fichiers** : `plateau-retouche.json` (67 pièces, bandeau, contrôle 1 adapté), `bibliotheque.json` (2 fiches importées, l'une rouverte), `partie.json` (ouverte, 91 cases, bataillon formé). Les trois sont embarqués dans `outils/recette-ancien.js` (copies exactes de `tests/fixtures-v1/`).
4. **Partie fictive sur un plateau du catalogue 2, exports.** Bataillon formé sur une ville de déploiement ; avertissement sur celle de l'adversaire ; marche de 5 cases jusqu'à une ville neutre (coût de chaque case au journal, total égal au chemin le moins cher) ; capture de la ville neutre, puis d'une ville de déploiement adverse ; tuile d'événement refusée sur une ville de déploiement, puis posée sur une case permise ; partie enregistrée et rouverte à l'identique. Export SVG bien formé avec les 2 + 2 villes de déploiement et les 2 villes neutres ; export PNG décodé, où les couleurs des trois sortes de villes sont retrouvées.

**Reprise du travail en cours sur deux lancements** (vrai stockage du navigateur, même profil temporaire) : plateau généré à 3 rangées avec une ville en troisième rangée, enregistré en fiche, puis une ville neutre retirée. Au second lancement : fiche retrouvée avec sa profondeur, travail repris (25 pièces, 6 villes), réglage affiché à 3, **aucune erreur**, « (modifié) », villes dessinées. Un troisième lancement, sur `index.html` cette fois, montre le même état (capture).

Deux aides de mise au point ajoutées à la recette : `#seul=<texte>` (un seul scénario) et `#durees` (temps de chaque scénario).

### C. Règles B1 à B7 vérifiées sans `AT.controles`

`outils/verifier-regles.js` relu. Il refait bien lui-même voisinage, parcours, bords, flancs et comptes ; seule la position des cases d'une pièce vient de l'outil. Ce qu'il laissait passer, et qui est complété :
- la profondeur des extrémités était figée à 2 : elle est maintenant un paramètre, avec trois combinaisons de plus (1 rangée, 3 rangées, 3 rangées avec remplissages), et la profondeur demandée doit être celle que le plateau a enregistrée ;
- deux villes non reliées n'étaient pas signalées (B6) ;
- rien ne prouvait qu'il détecte une faute : `tests/verifier-regles.test.js` enfreint chaque règle exprès (35 plateaux fautifs, de B1 à B7 et A2) et exige la faute attendue. Aucune n'a échappé.

Résultat sur 100 graines : **785 plateaux, 0 non conforme**. Les 500 plateaux à 2 rangées et les 200 à 3 rangées sont tous générés ; à 1 rangée, 85 générés sur 100 et 15 échecs, tous expliqués par la profondeur. Écart minimal entre villes 4 pas partout ; contact minimal égal au seuil ; villes neutres touchant au moins 2 cases ; à 3 rangées, 75 et 74 plateaux sur 100 ont une ville au-delà de la 2e rangée.

### D. Paquet (`python -I atelier/outils/empaqueter.py --brouillon --sortie <fichier temporaire>`)

- 27 fichiers, 180 370 octets, un seul dossier « Atelier du plateau » ; `dist/` n'a pas été touché.
- Les 23 fichiers référencés par `index.html` (19 scripts, 4 feuilles de style) sont tous dans l'archive, et l'archive ne contient aucun script ni style non référencé, ni test, ni outil.
- `Atelier.command` : système Unix, mode 0755, 17 fins de ligne Unix, aucune fin de ligne Windows, commence par `#!/bin/sh`. `Atelier.bat` : fins de ligne Windows gardées.
- C'est bien l'arbre de travail qui est emballé (le bouton « Autre proposition » et le champ de profondeur y sont) ; le script annonce « paquet BROUILLON : 10 fichiers diffèrent de la dernière version committée ».
- Page décompressée dans un dossier temporaire, ouverte sans fenêtre avec `#mode=villes&graine=7` : 26 pièces, 93 cases, « Plateau conforme », 4 feuilles de style, mise en page vue sur capture.

### Captures (dossier temporaire, hors projet)

- **Bureau 1280 × 800, mode « Villes »** (graine 12) : trois colonnes, plateau entier avec ses 7 villes numérotées, compteurs 2 / 2, rien de coupé. « Autre proposition » est sous « Poser les villes automatiquement » : la colonne de gauche (environ 300 px) ne tient pas les deux boutons côte à côte.
- **Largeur 375 px** (page dans un cadre, rognée sur le panneau) : le panneau « Villes » tient en largeur, les deux boutons sont côte à côte, rien ne déborde. Boutons d'environ 26 px de haut, sous les 44 px d'une cible tactile (point déjà soumis plus haut).
- **Reprise du travail en cours** (troisième lancement du profil de persistance) : « Plateau : « Villes profondes 0 » (modifié) », liste sur « 3 rangées », « Aucune erreur, 1 alerte », places de la ville neutre manquante en surbrillance.
- **Impression** (PDF produit par Edge puis rendu) : une page, plateau avec ses villes et légende ; depuis le mode « Villes », les places en surbrillance ne sortent pas.

### Non vérifié

- Souris, molette et tactile réels ; sélecteur de fichier (« Ouvrir… », « Importer… ») ; Firefox et Chrome ; `Atelier.bat` et `Atelier.command` lancés pour de bon ; le Mac.
- États après interaction vus à l'écran : aucune capture d'un refus, d'une pose libre ou d'une « autre proposition » en cours (vérifiés par la recette, pas par l'œil).
- Le cas « une seule combinaison de villes possible » d'« Autre proposition » (message « rien ne change ») : aucun terrain de ce genre rencontré.
- Lisibilité de l'impression sur papier.

### Points à connaître

- **Réglage par défaut de la profondeur.** Un plateau fait à 2 rangées n'écrit pas le champ. Si le défaut du catalogue passait un jour à 1, ces plateaux seraient relus à 1 rangée et pourraient repasser en erreur ; s'il passait à 3, rien ne casserait. L'autre choix (toujours écrire le champ) change tous les fichiers générés ; il revient à l'orchestrateur.
- **« 15 pièces de terrain à poser »** est aussi le texte de `controles.etape()`. Il n'est affiché nulle part pour un ancien plateau : son seul écran (`#pl-etape`, `src/vue-plateau.js`) montre à la place « Plateau de l'ancien catalogue », et la recette le vérifie. La fonction elle-même n'a pas été changée.
- **Profils temporaires d'Edge** : ils n'ont pas pu être supprimés (accès refusé) ; aucun processus Edge ne tourne plus dessus. Ils sont dans le dossier temporaire de la session, sous les noms `prof1`, `profA` à `profD`, `profF`, `profP1`, `profP2`, `profS`, `profZ`.
- **`docs/02-atelier-cahier-des-charges.md`** (non modifié, hors de mon périmètre) ne mentionne ni le champ `profondeurExtremite`, ni le refus des entrées `deploiements` hors Plaine, ni « Autre proposition », ni la règle de retouche des villes neutres.
- La recette complète dure maintenant 98 s au lieu de 52 s (120 générations de plus).

### Fichiers touchés dans cette recette

`atelier/src/plateau.js`, `atelier/src/catalogue.js`, `atelier/src/controles.js`, `atelier/src/generateur.js`, `atelier/src/partie.js`, `atelier/src/vue-partie.js`, `atelier/src/vue-plateau.js`, `atelier/src/vue-villes.js`, `atelier/src/vue-bibliotheque.js`, `atelier/src/app.js`, `atelier/outils/recette.js`, `atelier/outils/recette-ancien.js`, `atelier/outils/verifier-regles.js`, `atelier/tests/corrections-villes.test.js` (nouveau), `atelier/tests/verifier-regles.test.js` (nouveau), `atelier/tests/controles.test.js`, `atelier/tests/integration.test.js`, `atelier/tests/villes-interface.test.js`, `atelier/README.md`, `docs/04-recette-atelier.md`.
