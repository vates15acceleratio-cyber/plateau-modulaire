# Atelier du plateau

Outil hors ligne pour concevoir le plateau hexagonal et jouer des parties fictives. Rien à installer : **double-cliquez `index.html`** (Edge, Chrome ou Firefox). Aucune connexion n'est utilisée.

Le catalogue des pièces, les tuiles d'événement et les Troupes sont des **propositions provisoires, à valider**.

## Onglet « Plateau »

- **Générer** : saisissez une graine (un nombre ou un mot) puis « Générer ». La même graine redonne toujours le même plateau. « Graine suivante » passe au nombre suivant.
- **Réglages** : seuil de contact (3 tuiles par défaut, ou 2) et mesure (côtés ou pièces voisines). Ils servent au générateur et aux contrôles.
- **Retoucher à la main** :
  - cliquez une pièce du plateau pour la sélectionner, puis « Tourner » (touche R), « Déplacer » ou « Retirer » (touche Suppr) ;
  - cliquez une pièce du « Stock restant » puis une case pour la poser ; un aperçu suit la souris (rouge si la place est prise) ; R la tourne ; Échap arrête ;
  - « Vider le plateau » remet tout au stock ; « Annuler » (Ctrl+Z) et « Rétablir » (Ctrl+Y) reviennent sur chaque retouche, y compris une génération.
- **Villes de déploiement** : ce sont les villes de la rangée du haut (Vert) et de la rangée du bas (Rouge), recalculées à chaque retouche. Avec 3 villes ou plus sur une de ces rangées, aucune n’est retenue pour ce camp et le contrôle 4 le signale ; le plateau reste enregistrable.
- **Trous** : une case vide entièrement entourée de tuiles est signalée par le contrôle 2, en alerte (réglage `trous` de `src/catalogue.js` : `alerte`, `erreur` ou `ignore`).
- **Tuiles d'événement (essai de pose)** : choisissez une tuile, les cases permises s'allument, cliquez-en une. Pour l'enlever, cliquez la case puis « Retirer la tuile d'événement ».
- **Contrôles** (colonne de droite), mis à jour à chaque retouche : les 7 contrôles avec leur niveau (erreur, alerte, conforme). Survolez un constat pour voir les cases concernées, cliquez-le pour les garder affichées. Dessous : le coût en rations de chaque ville depuis Vert et depuis Rouge, le score d'équilibre (0 = équilibré) et la répartition des terrains.
- **Sur les cases** (au-dessus du plateau) : affiche sur chaque case ses contacts, son coût en rations depuis un camp, ou ses coordonnées.
- **Vue** : molette pour zoomer, cliquer-glisser pour déplacer, « Tout voir » pour recadrer.
- **Fichier et image** : « Enregistrer » et « Ouvrir » (fichier JSON), « Image SVG », « Image PNG », « Imprimer ».

## Onglet « Inventaire »

Toutes les pièces dessinées, avec le nombre total, posé et restant sur le plateau courant, les totaux, et la réserve des 8 tuiles d'événement (condition de pose, effet).

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

## Changer le catalogue

L'en-tête de `src/catalogue.js` dit ce qui se change librement (noms, coûts, seuils, événements, nombre de plaines, forêts et marais à total constant) et ce qui demande d'adapter aussi `src/generateur.js` (nombre de cases ou rayon, nombre de villes, monoblocs ajoutés ou retirés). Dans le second cas, « Générer » échoue tout de suite avec un message qui nomme la cause ; la retouche à la main et les contrôles continuent de marcher.

## Au clavier

Tab passe d'une commande à l'autre ; flèches gauche / droite entre les onglets. Sur le plateau (après Tab jusqu'à lui) : flèches pour déplacer le curseur, Entrée pour agir sur la case, + et − pour zoomer, 0 pour tout voir. R, Suppr, Échap, Ctrl+Z et Ctrl+Y sont sans effet pendant la saisie dans un champ.

## Commandes (pour le développement)

Depuis le dossier `atelier/` :

- Tests de la logique : `node --test`
- Règles du plateau vérifiées sur des plateaux générés, sans passer par les contrôles de l’outil : `node outils/verifier-regles.js 50` (50 graines × 2 seuils × 2 mesures)
- Serveur local facultatif : `node outils/serveur.js 8770` puis http://127.0.0.1:8770/
- Recette automatique dans le navigateur : ouvrir `outils/recette.html` ; la dernière ligne du rapport doit être `TOTAL : N OK, 0 ÉCHEC`. Sans fenêtre, avec Edge (PowerShell) :

  ```
  Start-Process -FilePath "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" -ArgumentList @("--headless=new","--disable-gpu","--user-data-dir=<dossier temporaire>","--window-size=1366,768","--virtual-time-budget=20000","--dump-dom","file:///<dossier du projet>/atelier/outils/recette.html") -RedirectStandardOutput <fichier> -RedirectStandardError <fichier2> -Wait -NoNewWindow
  ```

- Adresses utiles pour une capture d'écran : `index.html#onglet=plateau&graine=12`, `index.html#onglet=inventaire`, `index.html#onglet=partie&partie=5` ; `outils/recette.html#arret=partie` laisse une partie en cours à l'écran.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles/` | page unique et feuilles de style (politique de sécurité stricte : ni script ni style en ligne) |
| `src/rendu.js` | dessin SVG du plateau, vue avec zoom, export SVG et PNG |
| `src/app.js` | onglets, barre d'état, fichiers, raccourcis |
| `src/vue-plateau.js`, `src/vue-inventaire.js`, `src/vue-partie.js` | les trois onglets |
| `src/alea.js` … `src/generateur.js` | cœur du plateau (lot A) |
| `src/cartes.js`, `src/paquets.js`, `src/partie.js` | table de jeu (lot B) |
| `outils/serveur.js`, `outils/recette.html`, `outils/recette.js` | serveur local, recette automatique |
| `outils/verifier-regles.js`, `outils/mesures-faisabilite.js` | vérification indépendante des règles, mesures de faisabilité |
| `tests/` | tests Node |
