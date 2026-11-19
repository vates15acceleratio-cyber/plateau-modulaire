# Atelier du plateau : revue de code (2026-11-19)

Rapport du relecteur (lecture seule). Référence : `docs/02-atelier-cahier-des-charges.md`, `docs/00-direction.md`, `regles/Bannerlord_Regles_V2.3.html`.

## État relu et méthode

- **État relu : fichiers de `atelier/` à 12 h 40.** Le testeur modifiait le code pendant la revue (12 h 25, 12 h 32, 12 h 39) et a corrigé trois constats de ce rapport dès sa première version. Chaque constat porte donc un statut. Les numéros de ligne datent de 12 h 40 et peuvent avoir bougé depuis.
- **Lus en entier** : `src/hex.js`, `alea.js`, `catalogue.js`, `plateau.js`, `controles.js`, `generateur.js`, `cartes.js`, `paquets.js`, `partie.js`, `rendu.js`, `vue-plateau.js`, `vue-partie.js`, `app.js`, `index.html`, `outils/recette.html`, `outils/serveur.js`. Pour `plateau.js`, `controles.js` et `partie.js`, la lecture complète date d'avant 12 h 25 ; ensuite, seuls ont été relus les camps, le contrôle 4, la graine du plateau dans une partie, la cohérence cartes / tuiles d'événement, et les différences de 12 h 32 et 12 h 39. Une autre modification de 12 h 25 a pu m'échapper.
- **Seulement parcourus par recherche de motifs** : `vue-inventaire.js`, `outils/recette.js`, `outils/mesures-faisabilite.js`, `outils/verifier-regles.js` (apparu pendant la revue), les tests, les trois feuilles de style.
- **Vérifications exécutées** : scripts Node placés dans le dossier temporaire du système (rien n'a été écrit dans le dépôt hors ce rapport) ; le serveur local a été lancé une fois sur le port 8799 puis arrêté. `node --test` depuis `atelier/` à 12 h 39 : 184 tests, 0 échec.
- **Non fait** : les recettes navigateur n'ont pas été lancées ; rien n'a été vérifié dans un vrai navigateur. L'export SVG / PNG a été lu, pas exécuté. La validation des fichiers de plateau a été sondée par 8 fichiers hostiles ; le reste repose sur la lecture et sur les tests existants.

## Verdict

Aucun défaut bloquant. La géométrie, les sept contrôles, le générateur, les paquets et la rejouabilité à graine sont justes sur tout ce qui a été vérifié. Restent ouverts : deux constats importants (I2, I3) et six mineurs.

## Ce qui a été vérifié et trouvé juste

| Sujet | Vérification | Résultat |
|---|---|---|
| Rotations | Les 13 modèles × 6 rotations : nombre de cases, contiguïté, distances à l'ancre et entre cases conservées | 0 anomalie |
| Distance, voisinage | `AT.hex.distance` et `voisines` comparés à un calcul indépendant sur le disque de rayon 4 | 0 écart |
| Contrôles 4 et 5 | Sur 40 plateaux générés (seuils 2 et 3) : contacts « côtés » et « pièces », écart minimal entre villes, villes des rangées extrêmes, 91 cases, 53 / 11 / 11, recalculés à part | 0 écart |
| Plateaux fautifs fabriqués | Ville neutre à 3 pas du centre, ville de déploiement descendue d'une rangée, camps intervertis, noyau absent, tuile en pointe, pièce en double | tous refusés, par le bon contrôle |
| Générateur | 100 générations (4 combinaisons × 25 graines), deux fois chacune | plateaux identiques, stock épuisé, contrôles sans erreur, score 0 |
| Événements | Pour les 8 tuiles, sur le plateau de la graine 4 : terrains d'origine des cases permises, noyau, villes, voisinage d'une montagne (E6), terrain et coût après pose, seconde pose, autre tuile sur la même case, case occupée, retrait | conforme au tableau du §2 ; une Crevasse écrite sur une forêt dans un fichier est signalée en erreur par le contrôle 7 |
| Coupure par un événement | Graine 10, seuil 2 : Crevasse en (-4,5) | pose acceptée, deux alertes à la pose, alerte au contrôle 7 |
| Cartes Campement | Numéro, signe et texte des 15 cartes cherchés tels quels dans le fichier des règles | 15 sur 15 identiques |
| Paquets | Main de départ 3 / 2, pioche refusée à 5 cartes, pioche de fin de tour refusée main pleine, 40 cycles défausse / pioche, 16 pioches Campement | 20 cartes distinctes conservées, remélange correct |
| Gloire | −3 depuis 0, +99, +1 à 15, valeur non entière | bornée à 0 et 15, victoire signalée une fois |
| Rejouabilité | Deux parties de même graine, même suite d'opérations ; dés après annulation ; dés après enregistrement et relecture | identiques |
| Fichiers de partie hostiles | `__proto__` à cinq endroits, Gloire hors bornes, carte en double, carte de l'adversaire, état d'aléa invalide, modèle inconnu, tour 0, ville inexistante, graine de plateau objet / décimale / de 1000 caractères | tous refusés, `Object.prototype` intact |
| Fichiers de plateau hostiles | `__proto__`, champ `constructor`, modèle `__proto__`, coordonnée infinie, rotation 6, clé non canonique, 201 pièces, texte trop long | tous refusés |
| CSP | `index.html` et `recette.html` : même politique que l'archive ; aucun `innerHTML`, `insertAdjacentHTML`, `eval`, `document.write`, attribut `style` dans `atelier/` (recherche refaite sur `outils/` à 12 h 39) ; aucun `url(` ni `@import` dans les feuilles de style | conforme |
| Serveur local | Sur le serveur lancé : hôte étranger, POST, trois essais de traversée (`%2e%2e`, `..%5c..`, `outils%5c..%5c..`). Sur la même logique rejouée dans un script : huit autres chemins | 403 ou 405 sur le serveur ; aucun chemin hors de `atelier/` dans le script |
| Conventions | Identifiants sans accent, modules IIFE sur `AT` | conforme |

Deux défauts repérés à la lecture de la version d'avant 12 h 25 étaient déjà corrigés par le testeur quand les scripts ont tourné : un plateau avec 3 villes sur une rangée extrême ne s'enregistrait pas ; une partie pouvait garder dans la pioche la carte d'une tuile d'événement déjà posée.

## Bloquant

Aucun.

## Important

### I1. Un identifiant de pièce comme « constructor » faisait planter le dessin — corrigé à 12 h 39
- **Où** : `atelier/src/plateau.js:26` et `atelier/src/partie.js:80` acceptent ces identifiants ; l'exception partait de `atelier/src/rendu.js:249`.
- **Scénario** : fichier de plateau ou de partie dont une pièce a pour `id` « constructor » ou « toString ». Accepté à la lecture, puis `parPiece[...].push is not a function` au dessin.
- **Reproduit** : oui pour l'exception, sous Node avec un faux DOM (`AT.rendu.svgAutonome`). L'effet à l'écran (plateau effacé, aucun message) est déduit de la lecture.
- **Statut** : `parPiece` est maintenant créé par `Object.create(null)`. Même script relancé : plus d'exception.

### I2. Un plateau troué passe tous les contrôles — ouvert, important si les trous sont interdits
- **Où** : `atelier/src/controles.js:78` (contrôle 2). Le générateur, lui, refuse les trous (`atelier/src/generateur.js:134`).
- **Scénario** : plateau de la graine 3, plaine de la case (0,-2) (voisine du noyau) déplacée en (-3,-2) contre le bord. Résultat : `tout().ok === true`, 0 erreur, aux seuils 2 et 3.
- **Reproduit** : oui.
- **Nature** : le cahier des charges ne dit rien des trous. C'est d'abord une question pour l'utilisateur ; s'ils sont interdits, il manque un contrôle.

### I3. Le générateur est lié en dur au catalogue, annoncé comme modifiable « dans ce seul fichier » — ouvert
- **Où** : `atelier/src/generateur.js:31-32` (paires de monoblocs, montagnes), `:254` (noyau), `:306` (2 + 2 + 2 villes), `:346` et `:385` (modèles P, F, S). L'en-tête de `atelier/src/catalogue.js` (lignes 5 à 8) dit que tout se change dans ce fichier.
- **Scénarios**, reproduits :
  - 8 villes au lieu de 6 et 37 plaines (91 cases ; `nombreVilles` laissé à 7) : échec, « inventaire 71 » sur 72 essais ;
  - un monobloc de plus (3 cases, 36 plaines, toujours 91 cases) : même échec.
- **Effet** : dès que le catalogue provisoire évoluera, le générateur échouera avec un message qui ne nomme pas la cause.
- **À noter** : changer seulement le nombre de forêts (7 forêts, 37 plaines) fonctionne. Avec `rayon: 4` ou `6`, l'échec est normal (61 ou 127 cases pour 91 au catalogue), mais le message ne le dit pas non plus.

## Mineur

| N° | Constat | Fichier:ligne | Scénario | Reproduit | Statut |
|---|---|---|---|---|---|
| M1 | Numéro automatique d'une pièce | `plateau.js:139-148` | Avant 12 h 39 : avec `p999999999999999` dans un fichier, la pièce posée recevait un identifiant de 17 caractères, refusé à la relecture. Après correction (identifiants de plus de 9 chiffres ignorés) : un fichier contenant `p999999999` et `p1000000000` donne à la pièce posée l'identifiant `p1000000000`, en double ; le fichier enregistré est refusé, et « Retirer » enlève les deux pièces | oui, les deux | corrigé en partie ; reste le doublon |
| M2 | Le filtre des fichiers cachés du serveur se contourne par une barre oblique inversée | `outils/serveur.js:27` | `/.git/config` répond 403, `/%5c.git%5cconfig` répond 404 (le fichier est donc cherché). Sortir de `atelier/` reste impossible. Sans effet aujourd'hui : `atelier/` n'a pas de fichier caché | oui, sur le serveur lancé | ouvert |
| M3 | Une carte Événement piochée ne peut être ni défaussée ni posée de force | `partie.js:1040-1043` | Carte E1 piochée ; pose forcée sur une case non permise : refus (reproduit). Aucune opération de défausse d'une carte Événement (lecture). Si un jour aucune case ne convenait, la carte resterait en attente : hypothèse, non rencontrée | en partie | ouvert |
| M4 | Une partie relue n'était pas passée aux contrôles du plateau | `vue-partie.js:163-174` | Fichier de partie avec deux noyaux superposés, ou des camps sur des cases qui ne sont pas des villes : accepté sans avertissement | oui (acceptation) | corrigé à 12 h 39 : le message d'ouverture compte les erreurs ; lu, pas exécuté |
| M5 | Réglages non surchargeables ou fixés dans l'interface | `controles.js:134` ; `plateau.js:414` ; `vue-plateau.js:89` ; `vue-partie.js:64` | `villesParCamp` ignoré dans les options du contrôle 4 (reproduit). Condition « franchissable » de E6 jugée sur les coûts par défaut, liste « Mesure » non initialisée depuis `REGLAGES.mesureContact`, champ des dés limité à 30 alors que `desMax` est réglable : lus, non exécutés | en partie | ouvert |
| M6 | Le premier joueur est un réglage sans commande à l'écran | `cartes.js:32`, `partie.js:570` | Vert commence toujours ; les règles le désignent hors du jeu | lecture | ouvert |
| M7 | Graines hors du cas courant | `generateur.js:420`, `alea.js:21-34` | `generer(1.5)` rend un plateau que `lire` refuse ; une graine ni nombre ni texte devient 0 sans le dire ; `'12'` et `12` donnent deux plateaux. L'interface normalise la saisie (`app.js:27`) : atteignable seulement par appel direct | oui | ouvert |
| M8 | `creer` fait confiance à l'aléa reçu | `partie.js:550-554` | Aléa déjà utilisé une fois : partie différente, enregistrée avec la même graine. L'interface crée bien un aléa neuf (`vue-partie.js:95`) | oui | ouvert |
| M9 | `data:` permis pour les images sans usage trouvé | `index.html:6`, `outils/recette.html:6` | Aucune adresse `data:` dans le code ; l'export PNG passe par `blob:`. Identique à l'archive : pas un affaiblissement | lecture | ouvert |

## Écarts par rapport au cahier des charges

- Aucune fonction demandée ne manque, d'après la lecture du code.
- Règles ajoutées par le générateur, déjà signalées dans `docs/03-mesures-faisabilite.md` et réglables : montagnes à l'intérieur du rayon 4 et à une case l'une de l'autre, plateau toujours symétrique, chaque case (et non chaque pièce) avec assez de voisines.
- Les cartes Événement et les Troupes sont étiquetées « provisoire » dans les données et à l'écran. Rien n'a été trouvé qui présente une règle inventée comme décidée.

## Questions pour l'utilisateur (règles de jeu, pas défauts de code)

1. **Former sur une ville.** Les règles V2.3 (§6) disent « jamais directement sur une ville » ; le cahier des charges (A3) fait déployer sur les deux villes du camp, et l'outil suit le cahier. Faut-il corriger les règles ?
2. **Limite de main hors pioche.** Avec 5 cartes en main, reprendre la carte du dessus de la défausse (Campement 3) donne 6 cartes (reproduit). Avec 4 cartes, « piochez 2 » n'en pioche qu'une. Est-ce voulu ?
3. **Trous dans le plateau.** Sont-ils permis ? (voir I2)
4. **Événement qui isole une ville.** Graine 10 au seuil 2 : la Crevasse en (-4,5) isole (-5,5), ville de déploiement de Rouge. L'outil pose la tuile et affiche une alerte. Faut-il refuser la pose ?
5. **Événements et écart entre villes.** Les contrôles 1 à 6 ignorent les tuiles d'événement : un Tunnel pourrait rapprocher deux villes à moins de 4 pas sans alerte. Non reproduit sur 200 graines. Faut-il le contrôler ?
6. **Carte Événement sans case possible.** Que devient-elle (défausse, remise dans la pioche) ? (voir M3)
7. **Premier joueur.** Faut-il un choix à l'écran ? (voir M6)
8. Les points déjà posés dans `docs/03-mesures-faisabilite.md` restent ouverts : seuil 2 ou 3, mesure « côtés » ou « pièces », nombre de retouches du bord, rangée de déploiement au seuil 2.
