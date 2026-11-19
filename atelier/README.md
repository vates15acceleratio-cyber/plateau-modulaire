# Atelier du plateau

Outil hors ligne pour concevoir le plateau hexagonal et jouer des parties fictives. Rien à installer : **double-cliquez `index.html`** (Edge, Chrome ou Firefox). Aucune connexion n'est utilisée.

Le catalogue des pièces, les tuiles d'événement et les Troupes sont des **propositions provisoires, à valider**.

## Onglet « Plateau »

En tête de la colonne de gauche, cinq boutons choisissent le **mode de travail** : « Générer », « Créer à la main », « Pinceau », « Mes monoblocs », « Bibliothèque ». « Annuler » (Ctrl+Z) et « Rétablir » (Ctrl+Y) restent visibles dans tous les modes. Les fichiers et les images sont dans le mode « Générer ».

- **Générer** : saisissez une graine (un nombre ou un mot) puis « Générer ». La même graine redonne toujours le même plateau. « Graine suivante » passe au nombre suivant.
- **Réglages** : seuil de contact (3 tuiles par défaut, ou 2) et mesure (pièces voisines distinctes par défaut, ou côtés). Ils servent au générateur et aux contrôles.
- **Retoucher à la main** (modes « Générer » et « Créer à la main ») :
  - cliquez une pièce du plateau pour la sélectionner, puis « Tourner » (touche R), « Déplacer » ou « Retirer » (touche Suppr) ;
  - pour poser des pièces, passez en mode « Créer à la main » (voir plus bas) ;
  - « Annuler » (Ctrl+Z) et « Rétablir » (Ctrl+Y) reviennent sur chaque retouche, y compris une génération, un plateau vierge ou un plateau ouvert depuis la bibliothèque.
- **Villes de déploiement** : ce sont les villes de la rangée du haut (Vert) et de la rangée du bas (Rouge), recalculées à chaque retouche. Avec 3 villes ou plus sur une de ces rangées, aucune n’est retenue pour ce camp et le contrôle 4 le signale ; le plateau reste enregistrable.
- **Trous** : une case vide entièrement entourée de tuiles est signalée par le contrôle 2, en alerte (réglage `trous` de `src/catalogue.js` : `alerte`, `erreur` ou `ignore`).
- **Tuiles d'événement (essai de pose)**, en mode « Créer à la main », sous la palette : choisissez une tuile, les cases permises s'allument, cliquez-en une. Pour l'enlever, cliquez la case puis « Retirer la tuile d'événement ».
- **Contrôles** (colonne de droite), mis à jour à chaque retouche : les 7 contrôles avec leur niveau (erreur, alerte, conforme). Survolez un constat pour voir les cases concernées, cliquez-le pour les garder affichées. Dessous : le coût en rations de chaque ville depuis Vert et depuis Rouge, le score d'équilibre (0 = équilibré) et la répartition des terrains.
- **Sur les cases** (au-dessus du plateau) : affiche sur chaque case ses contacts, son coût en rations depuis un camp, ou ses coordonnées.
- **Vue** : molette pour zoomer, cliquer-glisser pour déplacer, « Tout voir » pour recadrer. En mode « Pinceau », et sur une pièce en mode « Créer à la main », glisser sert à peindre ou à déplacer la pièce : tenez **Maj** en glissant pour déplacer la vue.
- **Fichier et image** : « Enregistrer » et « Ouvrir » (fichier JSON), « Image SVG », « Image PNG », « Imprimer ».

### Créer à la main (création guidée)

1. « **Nouveau plateau vierge** » : il ne reste que le noyau, au centre. Les cases pointillées autour sont la grille vide (jusqu'à 7 cases du centre) : on peut cliquer dessus. « Vider le plateau » retire aussi le noyau. Vos monoblocs personnels sont gardés.
2. **Palette** : toutes les pièces du catalogue, puis vos monoblocs, avec leur dessin et le nombre qu'il en reste (« × 3 »). Une pièce épuisée est grisée.
3. **Poser** : cliquez une pièce puis une case, ou **glissez** la pièce de la palette sur le plateau. L'aperçu est **vert** si la pose est possible, **rouge** sinon (place prise, stock épuisé). **R** (ou « Tourner ») tourne la pièce, même pendant le glisser. Échap arrête.
4. **Déplacer une pièce posée** : glissez-la, ou sélectionnez-la puis « Déplacer ».
5. **Ce qu'il reste à faire** (en haut à droite) : pièces restantes par type, villes manquantes, villes de déploiement manquantes en haut (Vert) et en bas (Rouge), erreurs en cours. Quand tout est coché : « Plateau terminé ».

### Pinceau libre

Choisissez un terrain (plaine, forêt, marais, montagne, ville) ou la **gomme**, puis cliquez ou glissez sur les cases, vides ou non.

- Un trait entier s'annule en une fois.
- Le pinceau pose des tuiles d'une case : celles du stock d'abord, puis **hors stock**. Le message le dit, et le contrôle 1 liste les « tuiles à prévoir en plus du catalogue ». La montagne peinte est une tuile d'une case hors catalogue (la décision en vigueur reste « montagnes en blocs de 4 ou 5 cases » : le contrôle 1 le rappelle).
- Le pinceau ne modifie ni un monobloc ni le noyau : le message dit lequel.
- La gomme retire une tuile d'une case. Sur un monobloc ou le noyau, cliquez-le seul : une fenêtre demande confirmation, puis la pièce entière est retirée.

### Mes monoblocs

- **Dessiner** : choisissez un terrain (plaine, forêt, marais, montagne ; jamais de ville), puis cliquez les cases de la petite grille. Une case vide est ajoutée ; une case du même terrain est retirée ; une case d'un autre terrain change de terrain. 2 à 6 cases qui se touchent.
- Donnez un **nom** et une **quantité** (1 à 9 exemplaires), regardez l'aperçu, puis « Ajouter à mes monoblocs ». Les messages sous l'aperçu disent ce qui manque.
- La pièce apparaît dans la palette du mode « Créer à la main ». Elle est enregistrée **dans le plateau** : elle le suit dans son fichier et dans la bibliothèque.
- **Modifier / Supprimer** dans la liste. Une pièce déjà posée ne se supprime pas et sa forme ne se change pas (retirez d'abord ses exemplaires) ; son nom et sa quantité se changent, tant que la quantité couvre les exemplaires posés.
- **Copier depuis un plateau de la bibliothèque** : reprend les monoblocs d'un autre plateau enregistré.

### Bibliothèque

- **Enregistrer** : donnez un nom puis « Enregistrer sous ce nom ». Le nom du plateau s'affiche dans la barre du haut, avec « (modifié) » dès qu'il diffère de sa version enregistrée ; « Mettre à jour » enregistre par-dessus.
- Chaque fiche montre une vignette, le nombre de cases, de pièces et de villes, le nombre d'erreurs et d'alertes, et la date. Boutons : **Ouvrir** (annulable), **Dupliquer**, **Renommer**, **Supprimer** (avec confirmation ; ne s'annule pas).
- **Exporter toute la bibliothèque** écrit un fichier ; **Importer…** ajoute les plateaux d'un tel fichier sans rien écraser. C'est la façon de passer d'un poste ou d'un navigateur à un autre.
- **Sauvegarde automatique** : le travail en cours est sauvegardé tout seul après chaque changement, et **repris à la prochaine ouverture** de la page (un message le dit en bas). « Générer » ou « Nouveau plateau vierge » repart d'autre chose.
- **Où c'est gardé** : dans le navigateur, sur ce poste (40 plateaux au plus). La bibliothèque n'est **pas partagée** entre navigateurs, ni entre la page ouverte par double-clic (`file://`) et la même page servie par le serveur local (`http://127.0.0.1:8770`) : ce sont deux bibliothèques séparées (vérifié avec Edge). Vider les données de navigation l'efface : exportez-la de temps en temps.
- Si le navigateur refuse le stockage, s'il est plein ou si son contenu est illisible, un avis s'affiche et l'outil continue de marcher ; les fichiers (« Enregistrer », « Exporter toute la bibliothèque ») restent disponibles.

## Onglet « Inventaire »

Toutes les pièces du catalogue imprimé dessinées, avec le nombre total, posé et restant sur le plateau courant, les totaux (64 pièces, 91 cases, jamais modifiés), puis à part : la ligne « Tuiles hors catalogue posées » (tuiles du pinceau au-delà du stock, montagne d'une case comprise), la section « Mes monoblocs », et la réserve des 8 tuiles d'événement (condition de pose, effet).

## Onglet « Partie fictive »

Une table libre : l'outil compte, mélange, lance les dés et prévient, mais **n'arbitre pas**. Un avertissement peut toujours être passé avec « Faire quand même ».

1. Choisissez une graine de partie et le premier joueur (Vert ou Rouge), puis « Nouvelle partie » : elle se joue sur le plateau de l'onglet Plateau. Même graine et même plateau = mêmes mélanges et mêmes dés.
2. **Former un bataillon** : cliquez une carte de la main, puis une ville de déploiement surlignée (ou le bouton « Former en … »).
3. **Renforcer** : cliquez une carte, puis un bataillon du même joueur (ou « Renforcer avec la carte choisie »).
4. **Déplacer** : cliquez un pion, puis une case voisine. Le coût en rations est écrit sur chaque case voisine (✕ = infranchissable).
5. **Ville capturée** : cliquez la ville (ou le pion qui s'y trouve), puis « À Vert », « À Rouge » ou « Neutre ».
6. **Dés** : nombre de dés puis « Lancer », ou « Lancer ses dés » sur un bataillon (somme des dés de ses Troupes).
7. **Carte Campement** : « Piocher pour Vert / Rouge » (ou « Carte Campement » sur un bataillon). Le texte exact s'affiche ; appliquez-le avec les boutons « Appliquer l'effet à la main » (piocher, défausser, mélanger, regarder les 3 premières…).
8. **Événement** : « Piocher un événement », puis cliquez une case surlignée pour poser la tuile. Un refus est expliqué en bas de l'écran. Si aucune case ne convient, « Défausser sans poser » envoie la carte à la défausse ; la tuile reste en réserve.
9. Gloire (+ / −, victoire signalée à 15), marqueurs de dégâts (+ / −), « Éliminer », « +1 action », « Fin du tour » (le joueur suivant pioche 1 carte).
10. « Annuler » / « Rétablir », « Enregistrer » / « Ouvrir » (fichier JSON), notes dans le journal, « Troupes provisoires… » pour changer nom, moral, Puissance et dés.

## Création à la main : ce qu'il faut savoir du modèle

- **Pièces personnelles** : un plateau peut porter ses propres monoblocs (champ facultatif `modeles` du fichier : 2 à 6 cases, plaine / forêt / marais / montagne, jamais de ville, 1 à 9 exemplaires, 24 pièces au plus). Elles voyagent avec le fichier du plateau et avec celui de la partie.
- **Pose hors stock et montagne d’une case** (`M1`, hors catalogue imprimé) : le contrôle 1 annonce en alerte les « tuiles à prévoir en plus du catalogue » et rappelle la décision « montagnes en blocs de 4 ou 5 cases ».
- **Équilibre** : sur un plateau qui n’est pas symétrique par demi-tour (forme ou villes), le score est « non comparable » ; le tableau des coûts par ville reste affiché.
- **Générer** sur un plateau qui a des pièces personnelles : elles sont gardées dans le plateau généré, non posées, et le message le dit.

## Changer le catalogue

L'en-tête de `src/catalogue.js` dit ce qui se change librement (noms, coûts, seuils, événements, nombre de plaines, forêts et marais à total constant) et ce qui demande d'adapter aussi `src/generateur.js` (nombre de cases ou rayon, nombre de villes, monoblocs ajoutés ou retirés). Dans le second cas, « Générer » échoue tout de suite avec un message qui nomme la cause ; la retouche à la main et les contrôles continuent de marcher.

## Au clavier

Tab passe d'une commande à l'autre ; flèches gauche / droite entre les onglets. Sur le plateau (après Tab jusqu'à lui) : flèches pour déplacer le curseur, Entrée pour agir sur la case (poser la pièce choisie, peindre ou gommer en mode « Pinceau »), + et − pour zoomer, 0 pour tout voir. La petite grille de « Mes monoblocs » marche de même : flèches, puis Entrée ou Espace. Dans une fenêtre de confirmation : Tab, Entrée, Échap pour renoncer. R, Suppr, Échap, Ctrl+Z et Ctrl+Y sont sans effet pendant la saisie dans un champ. Le glisser-déposer a toujours un équivalent au clic.

## Commandes (pour le développement)

Depuis le dossier `atelier/` :

- Tests de la logique : `node --test`
- Règles du plateau vérifiées sur des plateaux générés, sans passer par les contrôles de l’outil : `node outils/verifier-regles.js 50` (50 graines × 2 seuils × 2 mesures)
- Serveur local facultatif : `node outils/serveur.js 8770` puis http://127.0.0.1:8770/
- Recette automatique dans le navigateur : ouvrir `outils/recette.html` ; la dernière ligne du rapport doit être `TOTAL : N OK, 0 ÉCHEC`. Sans fenêtre, avec Edge (PowerShell) :

  ```
  Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList @("--headless=new","--disable-gpu","--user-data-dir=<dossier temporaire>","--window-size=1366,768","--virtual-time-budget=20000","--dump-dom","file:///<dossier du projet>/atelier/outils/recette.html") -RedirectStandardOutput <fichier> -RedirectStandardError <fichier2> -Wait -NoNewWindow
  ```

- La recette travaille sur un stockage en mémoire : elle ne touche jamais à la bibliothèque du poste. Le vrai stockage se vérifie à part, par deux lancements successifs sur le **même** dossier de profil : `outils/recette.html#persistance=ecrire` puis `outils/recette.html#persistance=lire` (lignes `PERSISTANCE …` et `TOTAL`).
- Adresses utiles pour une capture d'écran (ajouter `--screenshot=<fichier.png>` à la place de `--dump-dom`) : `index.html#onglet=plateau&graine=12`, `index.html#mode=creer` (ou `pinceau`, `monoblocs`, `bibliotheque`), `index.html#onglet=inventaire`, `index.html#onglet=partie&partie=5` ; `outils/recette.html#arret=partie` laisse une partie en cours à l'écran, `#arret=creation`, `#arret=pinceau`, `#arret=monoblocs`, `#arret=bibliotheque` un état de démonstration de chaque volet. Avec `#graine=`, le travail en cours n'est pas repris.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles/` | page unique et feuilles de style (politique de sécurité stricte : ni script ni style en ligne) |
| `src/rendu.js` | dessin SVG du plateau, vue avec zoom, export SVG et PNG |
| `src/app.js` | onglets, barre d'état, fichiers, raccourcis |
| `src/vue-plateau.js`, `src/vue-inventaire.js`, `src/vue-partie.js` | les trois onglets |
| `src/vue-creation.js`, `src/vue-monoblocs.js`, `src/vue-bibliotheque.js`, `styles/creation.css` | création à la main : palette et pinceau, éditeur de monoblocs, bibliothèque et sauvegarde automatique |
| `src/alea.js` … `src/generateur.js` | cœur du plateau (lot A) |
| `src/cartes.js`, `src/paquets.js`, `src/partie.js` | table de jeu (lot B) |
| `src/bibliotheque.js` | bibliothèque de plateaux et travail en cours : logique et stockage du navigateur injecté |
| `outils/serveur.js`, `outils/recette.html`, `outils/recette.js` | serveur local, recette automatique |
| `outils/verifier-regles.js`, `outils/mesures-faisabilite.js` | vérification indépendante des règles, mesures de faisabilité |
| `tests/` | tests Node |
