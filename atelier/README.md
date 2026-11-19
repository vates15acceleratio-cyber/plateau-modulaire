# Atelier du plateau

Outil hors ligne pour concevoir le plateau hexagonal et jouer des parties fictives. Rien à installer, aucune connexion n'est utilisée.

## Lancer l'atelier

- **Le plus simple** : double-cliquez `index.html` (Edge, Chrome ou Firefox) : il s'ouvre dans un onglet du navigateur.
- **Dans sa propre fenêtre**, sans barre d'adresse :
  - Windows : double-cliquez `Atelier.bat`. Il ouvre la page avec Edge (sinon Chrome, sinon le navigateur par défaut).
  - Mac : clic droit sur `Atelier.command`, puis « Ouvrir » (la première fois, macOS demande une confirmation). Il ouvre la page avec Chrome (sinon Edge, sinon le navigateur par défaut).
  - Les deux lanceurs n'installent rien et n'envoient rien sur Internet. Si le dossier de l'atelier a un `#` ou un `%` dans son chemin, ils ouvrent la page dans le navigateur par défaut (ces deux caractères fausseraient l'adresse de la fenêtre à part).
- **La bibliothèque est propre au navigateur et au poste.** Vos plateaux enregistrés et le travail en cours sont gardés par le navigateur qui a ouvert la page, sur cet ordinateur. Un autre navigateur, un autre poste ou une autre session d'utilisateur partent d'une bibliothèque vide. Le lanceur et le double-clic sur `index.html` partagent la même bibliothèque s'ils ouvrent le même navigateur. Pour emporter vos plateaux : mode « Bibliothèque », « Exporter toute la bibliothèque », puis « Importer… » de l'autre côté.

## Le paquet à transmettre

Pour donner l'atelier à quelqu'un (clé USB, courriel), fabriquez l'archive depuis la racine du dépôt :

```
python -I atelier/outils/empaqueter.py
```

Elle est écrite dans `dist/atelier-plateau.zip` : la page, ses scripts et ses styles, les deux lanceurs et un `LISEZ-MOI.txt` (ni tests ni outils). Le destinataire la décompresse où il veut et lance comme ci-dessus.

- Seuls les fichiers **enregistrés dans git** sont emballés : un brouillon laissé dans `src/` ou `styles/` n'y entre jamais.
- Si l'un des fichiers à emballer a des modifications non enregistrées (non committées), le script **refuse** et le dit : le paquet ne correspondrait à aucune version. `--brouillon` fabrique quand même un paquet d'essai (à ne pas transmettre) ; `--sortie <fichier>` l'écrit ailleurs que dans `dist/`.

Le catalogue des pièces, les tuiles d'événement et les Troupes sont des **propositions provisoires, à valider**.

## Le plateau en deux étapes (catalogue 2)

Le plateau se fait comme le feront les joueurs, en deux étapes :

1. **Construction du terrain.** Le noyau au centre (il ne bouge pas), 2 blocs de montagne, et 21 monoblocs de terrain de 3 ou 4 cases (plaines, forêts, marais). Il n'y a plus de tuile de terrain d'une case, sauf 2 **tuiles de remplissage** (une plaine), facultatives : elles peuvent rester dans la boîte.
2. **Villes**, une fois le terrain construit :
   - **ville de déploiement** : une tuile posée **par-dessus une Plaine** du bord, en haut pour Vert, en bas pour Rouge, hors noyau ; 2 par joueur. Sur le plateau, la Plaine reste visible autour de la tuile, bordée de la couleur du camp ;
   - **ville neutre** : une tuile **ajoutée** contre le bord, une sur le flanc gauche et une sur le flanc droit, à mi-hauteur ; liseré doré ;
   - entre deux villes (celle du noyau comprise) : 4 pas au moins, soit 3 cases entre elles.

Un plateau dont le terrain est construit mais qui n'a pas encore ses villes **n'est pas en erreur** : il est « à l'étape des villes ».

## Onglet « Plateau »

En tête de la colonne de gauche, six boutons choisissent le **mode de travail** : « Générer », « Créer à la main », « Pinceau », « Villes », « Mes monoblocs », « Bibliothèque ». « Annuler » (Ctrl+Z) et « Rétablir » (Ctrl+Y) restent visibles dans tous les modes. Les fichiers et les images sont dans le mode « Générer ». Quand le terrain est construit, le bouton « Villes » se met en avant (liseré vert) : c'est le moment de poser les villes.

- **Générer** : saisissez une graine (un nombre ou un mot) puis « Générer ». La même graine redonne toujours le même plateau. « Graine suivante » passe au nombre suivant. Le générateur construit le terrain pièce après pièce, comme des joueurs, puis pose les villes au meilleur équilibre.
- **Réglages** : seuil de contact (3 tuiles par défaut, ou 2), mesure (pièces voisines distinctes par défaut, ou côtés) et **tuiles de remplissage permises** (aucune par défaut, jusqu'aux 2 du catalogue : le générateur en pose le moins possible, et le message dit combien). Ils servent au générateur et aux contrôles.
- **Retoucher à la main** (modes « Générer » et « Créer à la main ») :
  - cliquez une pièce du plateau pour la sélectionner, puis « Tourner » (touche R), « Déplacer » ou « Retirer » (touche Suppr) ;
  - pour poser des pièces, passez en mode « Créer à la main » (voir plus bas) ;
  - « Annuler » (Ctrl+Z) et « Rétablir » (Ctrl+Y) reviennent sur chaque retouche, y compris une génération, un plateau vierge ou un plateau ouvert depuis la bibliothèque.
- **Une retouche du terrain peut enlever une ville** : retirer, tourner, déplacer, repeindre ou gommer la pièce qui porte une ville de déploiement enlève cette ville avec sa Plaine. Le message le dit ; elle se repose à l'étape « Villes ».
- **Anciens plateaux** : un plateau fait avec le premier catalogue (tuiles d'une case, villes posées pendant la construction) s'ouvre toujours, depuis un fichier ou la bibliothèque. Un bandeau discret le signale au-dessus du plateau et les contrôles s'y adaptent.
- **Trous** : une case vide entièrement entourée de tuiles est signalée par le contrôle 2, en alerte (réglage `trous` de `src/catalogue.js` : `alerte`, `erreur` ou `ignore`).
- **Tuiles d'événement (essai de pose)**, en mode « Créer à la main », sous la palette : choisissez une tuile, les cases permises s'allument, cliquez-en une. Pour l'enlever, cliquez la case puis « Retirer la tuile d'événement ».
- **Contrôles** (colonne de droite), mis à jour à chaque retouche. En tête, l'**étape** : « Construction en cours », « Construction terminée : posez les villes » ou « Plateau complet ». Puis deux groupes titrés : **Construction** (inventaire, chevauchement et continuité, monoblocs et noyau, contact) et **Villes** (villes, équilibre), chacun avec son état ; les tuiles d'événement à l'essai sont jugées à part. Survolez un constat pour voir les cases concernées, cliquez-le pour les garder affichées.
- **Équilibre** (sous les contrôles) : le coût en rations de chaque ville depuis les villes de déploiement de Vert et de Rouge. Le score additionne l'écart entre les deux camps vers le centre, vers chaque ville neutre, et vers les villes de déploiement adverses (ligne du bas) ; 0 = équilibré. Dessous, la répartition des terrains.
- **Sur les cases** (au-dessus du plateau) : affiche sur chaque case ses contacts, son coût en rations depuis un camp, ou ses coordonnées.
- **Vue** : molette pour zoomer, cliquer-glisser pour déplacer, « Tout voir » pour recadrer. En mode « Pinceau », et sur une pièce en mode « Créer à la main », glisser sert à peindre ou à déplacer la pièce : tenez **Maj** en glissant pour déplacer la vue.
- **Fichier et image** : « Enregistrer » et « Ouvrir » (fichier JSON), « Image SVG », « Image PNG », « Imprimer ».

### Créer à la main (création guidée)

1. « **Nouveau plateau vierge** » : il ne reste que le noyau, au centre. Les cases pointillées autour sont la grille vide (jusqu'à 7 cases du centre) : on peut cliquer dessus. « Vider le plateau » retire aussi le noyau. Vos monoblocs personnels sont gardés.
2. **Palette** du catalogue 2, par rôle : noyau et montagnes, monoblocs de 4 cases, monoblocs de 3 cases, tuiles de remplissage (marquées « facultatif »), puis vos monoblocs, avec leur dessin et le nombre qu'il en reste (« × 1 »). Une pièce épuisée est grisée. **Les villes ne sont pas dans la palette** : elles se posent à l'étape « Villes ».
3. **Poser** : cliquez une pièce puis une case, ou **glissez** la pièce de la palette sur le plateau. L'aperçu est **vert** si la pose est possible, **rouge** sinon (place prise, stock épuisé). **R** (ou « Tourner ») tourne la pièce, même pendant le glisser. Échap arrête.
4. **Déplacer une pièce posée** : glissez-la, ou sélectionnez-la puis « Déplacer ».
5. **Ce qu'il reste à faire** (en haut à droite), par étape : « 1. Construction du terrain » (pièces de terrain restantes, remplissages en réserve) puis « 2. Villes » (villes de déploiement de chaque camp, villes neutres), et les erreurs en cours. Quand le terrain est construit, le bouton « Passer à l'étape Villes » apparaît. Quand tout est coché : « Plateau terminé ».

### Pinceau libre

Choisissez un terrain (plaine, forêt, marais, montagne) ou la **gomme**, puis cliquez ou glissez sur les cases, vides ou non. Les villes ne se peignent pas : elles se posent à l'étape « Villes ».

- Un trait entier s'annule en une fois.
- Le pinceau pose des tuiles d'une case, qui sont **hors catalogue** (le catalogue 2 est fait de monoblocs) : une plaine est prise d'abord parmi les tuiles de remplissage en stock, le reste est annoncé par le message, et le contrôle 1 liste les « tuiles à prévoir en plus du catalogue ». La montagne peinte est une tuile d'une case hors catalogue (la décision en vigueur reste « montagnes en blocs de 4 ou 5 cases » : le contrôle 1 le rappelle).
- Le pinceau ne modifie ni un monobloc ni le noyau : le message dit lequel.
- La gomme retire une tuile d'une case. Sur un monobloc, cliquez-le seul : une fenêtre demande confirmation, puis la pièce entière est retirée.
- **Le noyau est fixe** : ni la gomme, ni « Retirer » (touche Suppr) ne l’enlèvent. Seuls « Vider le plateau » et « Nouveau plateau vierge » (mode « Créer à la main ») le font.
- Annuler et Rétablir attendent la fin du geste : pendant un trait (bouton de la souris enfoncé), ils sont ignorés.

### Villes (étape « Villes »)

1. Choisissez la ville à poser : **déploiement de Vert**, **déploiement de Rouge** ou **ville neutre**. Chaque bouton montre son compteur (« 1 / 2 »). Les places admissibles s'allument sur le plateau.
2. **Cliquez une place en surbrillance** pour poser la ville (au clavier : flèches puis Entrée sur le plateau). **Cliquez une ville posée** pour la retirer. Quand un camp a ses 2 villes, l'outil passe de lui-même à la ville suivante.
3. Un refus est expliqué avec sa raison : noyau, case qui n'est pas une Plaine, hors de l'extrémité du camp, trop près d'une autre ville (« 3 pas, il en faut 4 »), flanc déjà pourvu…
4. **Poser les villes automatiquement** : retire les villes posées puis place les 6 au meilleur équilibre (le même calcul que le générateur). **Retirer toutes les villes** : le terrain ne change pas.
5. **Aucune place ?** Un avis dit pourquoi (souvent l'écart de 4 pas avec une ville voisine) et propose, quand cela aide, d'élargir les extrémités.
6. Réglages de l'étape :
   - **Profondeur des extrémités** : 1, 2 (défaut) ou 3 rangées du haut et du bas où une ville de déploiement peut se poser. La surbrillance, la pose, la pose automatique, le générateur et les contrôles suivent ce réglage. Il n'est **pas enregistré avec le plateau** : un plateau fait à 3 rangées sera signalé « mal placé » à la réouverture tant que le réglage n'est pas remis.
   - **Pose libre** : pour essayer hors règles. Une ville se pose alors sur toute Plaine (hors noyau) ou contre tout bord ; les contrôles signalent ce qui ne respecte pas les règles.

Tout s'annule (Ctrl+Z), y compris la pose automatique, en une étape.

### Mes monoblocs

- **Dessiner** : choisissez un terrain (plaine, forêt, marais, montagne ; jamais de ville), puis cliquez les cases de la petite grille. Une case vide est ajoutée ; une case du même terrain est retirée ; une case d'un autre terrain change de terrain. 2 à 6 cases qui se touchent.
- Donnez un **nom** et une **quantité** (1 à 9 exemplaires), regardez l'aperçu, puis « Ajouter à mes monoblocs ». Les messages sous l'aperçu disent ce qui manque.
- La pièce apparaît dans la palette du mode « Créer à la main ». Elle est enregistrée **dans le plateau** : elle le suit dans son fichier et dans la bibliothèque.
- **Modifier / Supprimer** dans la liste. Une pièce déjà posée ne se supprime pas et sa forme ne se change pas (retirez d'abord ses exemplaires) ; son nom et sa quantité se changent, tant que la quantité couvre les exemplaires posés.
- Une pièce qui porte de la **montagne** sans être un bloc de 4 ou 5 cases tout en montagne reste permise, mais l'éditeur le rappelle et, une fois posée, le contrôle 1 la signale en alerte (décision en vigueur : « montagnes en blocs de 4 ou 5 cases »), comme la montagne d'une case du pinceau.
- **Copier depuis un plateau de la bibliothèque** : reprend les monoblocs d'un autre plateau enregistré.

### Bibliothèque

- **Enregistrer** : donnez un nom puis « Enregistrer sous ce nom ». Le nom du plateau s'affiche dans la barre du haut, avec « (modifié) » dès qu'il diffère de sa version enregistrée ; « Mettre à jour » enregistre par-dessus. Annuler des retouches ne détache pas le plateau de sa fiche.
- **Nom déjà pris** : il est numéroté tout seul (« Mon plateau (2) ») et le message le dit. Deux fiches n'ont jamais le même nom.
- Chaque fiche montre une vignette, le nombre de cases, de pièces et de villes, le nombre d'erreurs et d'alertes, et la date. Boutons : **Ouvrir** (annulable), **Dupliquer**, **Renommer**, **Supprimer** (avec confirmation ; ne s'annule pas).
- **Exporter toute la bibliothèque** écrit un fichier ; **Importer…** ajoute les plateaux d'un tel fichier sans rien écraser. C'est la façon de passer d'un poste ou d'un navigateur à un autre.
- **Sauvegarde automatique** : le travail en cours est sauvegardé tout seul après chaque changement, et **repris à la prochaine ouverture** de la page (un message le dit en bas). « Générer » ou « Nouveau plateau vierge » repart d'autre chose. Le plateau repris retrouve aussi sa fiche de la bibliothèque. Ouvrir la page avec `#graine=…` dans l'adresse affiche un plateau généré sans toucher au travail sauvegardé, tant que vous ne modifiez rien.
- **Plusieurs fenêtres de l'atelier** ouvertes en même temps : chacune relit la bibliothèque avant d'y écrire, donc aucune n'efface les fiches de l'autre, et la liste se met à jour toute seule. Si la même fiche est modifiée dans deux fenêtres, la plus récente gagne et le message le dit. Une fiche supprimée ailleurs ne peut plus être « mise à jour » : enregistrez sous un nom.
- **Où c'est gardé** : dans le navigateur, sur ce poste (40 plateaux au plus). La bibliothèque n'est **pas partagée** entre navigateurs, ni entre la page ouverte par double-clic (`file://`) et la même page servie par le serveur local (`http://127.0.0.1:8770`) : ce sont deux bibliothèques séparées (vérifié avec Edge). Vider les données de navigation l'efface : exportez-la de temps en temps.
- **Stockage refusé ou plein** : un avis s'affiche et la bibliothèque continue **en mémoire** jusqu'à la fermeture de la page. Cliquez « Exporter toute la bibliothèque » pour ne rien perdre ; les fichiers (« Enregistrer ») restent disponibles.
- **Contenu illisible** (abîmé, ou écrit par une version plus récente de l'atelier) : il n'est jamais effacé sans copie. Avant le premier enregistrement qui le remplacerait, son texte d'origine est gardé dans le navigateur sous une clé de secours datée (5 copies au plus) ; l'avis le dit et « Exporter les copies de secours » les sort dans un fichier. Les avis s'ajoutent les uns aux autres, aucun n'en cache un autre.

## Onglet « Inventaire »

Le catalogue 2 dessiné **par rôle** : noyau, montagnes, monoblocs de 4 cases, monoblocs de 3 cases, tuiles de remplissage (facultatives), villes neutres, puis les villes de déploiement (4 tuiles posées par-dessus une Plaine, qui n'ajoutent aucune case), avec le nombre total, posé et restant sur le plateau courant. En tête : les totaux du catalogue imprimé (28 pièces, 95 cases, jamais modifiés) et la répartition du terrain (53 plaines, 11 forêts, 11 marais sur les 75 cases des monoblocs, soit 70,7 / 14,7 / 14,7 %). À part : la ligne « Tuiles hors catalogue posées » (tuiles d'une case du pinceau), la section « Ancien catalogue » seulement si le plateau ouvert en porte, la section « Mes monoblocs », et la réserve des 8 tuiles d'événement (condition de pose, effet).

## Onglet « Partie fictive »

Une table libre : l'outil compte, mélange, lance les dés et prévient, mais **n'arbitre pas**. Un avertissement peut toujours être passé avec « Faire quand même ».

1. Choisissez une graine de partie et le premier joueur (Vert ou Rouge), puis « Nouvelle partie » : elle se joue sur le plateau de l'onglet Plateau. Même graine et même plateau = mêmes mélanges et mêmes dés.
2. **Former un bataillon** : cliquez une carte de la main, puis une ville de déploiement surlignée (ou le bouton « Former en … »). Les villes de déploiement sont les tuiles posées à l'étape « Villes ».
3. **Renforcer** : cliquez une carte, puis un bataillon du même joueur (ou « Renforcer avec la carte choisie »).
4. **Déplacer** : cliquez un pion, puis une case voisine. Le coût en rations est écrit sur chaque case voisine (✕ = infranchissable).
5. **Ville capturée** : cliquez la ville (ou le pion qui s'y trouve), puis « À Vert », « À Rouge » ou « Neutre ».
6. **Dés** : nombre de dés puis « Lancer », ou « Lancer ses dés » sur un bataillon (somme des dés de ses Troupes).
7. **Carte Campement** : « Piocher pour Vert / Rouge » (ou « Carte Campement » sur un bataillon). Le texte exact s'affiche ; appliquez-le avec les boutons « Appliquer l'effet à la main » (piocher, défausser, mélanger, regarder les 3 premières…).
8. **Événement** : « Piocher un événement », puis cliquez une case surlignée pour poser la tuile. Un refus est expliqué en bas de l'écran (une tuile d'événement ne se pose jamais sur une ville de déploiement, ni sur le noyau). Si aucune case ne convient, « Défausser sans poser » envoie la carte à la défausse ; la tuile reste en réserve.
9. Gloire (+ / −, victoire signalée à 15), marqueurs de dégâts (+ / −), « Éliminer », « +1 action », « Fin du tour » (le joueur suivant pioche 1 carte).
10. « Annuler » / « Rétablir », « Enregistrer » / « Ouvrir » (fichier JSON), notes dans le journal, « Troupes provisoires… » pour changer nom, moral, Puissance et dés.

## Création à la main : ce qu'il faut savoir du modèle

- **Pièces personnelles** : un plateau peut porter ses propres monoblocs (champ facultatif `modeles` du fichier : 2 à 6 cases, plaine / forêt / marais / montagne, jamais de ville, 1 à 9 exemplaires, 24 pièces au plus). Elles voyagent avec le fichier du plateau et avec celui de la partie.
- **Tuiles d’une case** : le catalogue 2 n’en a que deux sortes, le remplissage (`R`) et la ville neutre (`VN`). Les tuiles `P`, `F`, `S` du pinceau et la montagne d’une case (`M1`) sont hors catalogue : le contrôle 1 annonce en alerte les « tuiles à prévoir en plus du catalogue » et rappelle la décision « montagnes en blocs de 4 ou 5 cases ».
- **Villes de déploiement** : elles ne sont pas des pièces mais des tuiles posées par-dessus (champ `deploiements` du fichier : case et camp). Une entrée qui vise une case hors du plateau ou une case qui n’est pas une Plaine est signalée en erreur par le contrôle des villes ; « Retirer toutes les villes » l’enlève.
- **Équilibre** : il se mesure sans symétrie, par l’écart de coût en rations entre Vert et Rouge vers le centre, vers chaque ville neutre et vers les villes de déploiement adverses ; il se calcule dès que les deux camps ont leurs villes de déploiement.
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
- Adresses utiles pour une capture d'écran (ajouter `--screenshot=<fichier.png>` à la place de `--dump-dom`) : `index.html#onglet=plateau&graine=12`, `index.html#mode=creer` (ou `pinceau`, `villes`, `monoblocs`, `bibliotheque`), `index.html#onglet=inventaire`, `index.html#onglet=partie&partie=5` ; `outils/recette.html#arret=partie` laisse une partie en cours à l'écran, `#arret=creation`, `#arret=pinceau`, `#arret=villes`, `#arret=monoblocs`, `#arret=bibliotheque` un état de démonstration de chaque volet. Avec `#graine=`, le travail en cours n'est pas repris.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html`, `styles/` | page unique et feuilles de style (politique de sécurité stricte : ni script ni style en ligne) |
| `src/rendu.js` | dessin SVG du plateau, vue avec zoom, export SVG et PNG |
| `src/app.js` | onglets, barre d'état, fichiers, raccourcis |
| `src/vue-plateau.js`, `src/vue-inventaire.js`, `src/vue-partie.js` | les trois onglets |
| `src/vue-creation.js`, `src/vue-villes.js`, `src/vue-monoblocs.js`, `src/vue-bibliotheque.js`, `styles/creation.css` | création à la main : palette et pinceau, étape « Villes », éditeur de monoblocs, bibliothèque et sauvegarde automatique |
| `src/alea.js` … `src/generateur.js` | cœur du plateau (lot A) |
| `src/cartes.js`, `src/paquets.js`, `src/partie.js` | table de jeu (lot B) |
| `src/bibliotheque.js` | bibliothèque de plateaux et travail en cours : logique et stockage du navigateur injecté |
| `Atelier.bat`, `Atelier.command` | lanceurs Windows et Mac (fenêtre à part) |
| `outils/empaqueter.py` | fabrique le paquet à transmettre (`dist/atelier-plateau.zip`) |
| `outils/serveur.js`, `outils/recette.html`, `outils/recette.js` | serveur local, recette automatique |
| `outils/verifier-regles.js`, `outils/mesures-faisabilite.js` | vérification indépendante des règles, mesures de faisabilité |
| `tests/` | tests Node |
