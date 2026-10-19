# Lot 2 : modèle et graphe pour `'hex19'` (sous-agent de production, Sonnet 5.5), 2026-10-19

Rapport du sous-agent, consigné et condensé par l'orchestrateur. Fichiers touchés : `src/modele.js`, `src/graphe.js`, nouveaux `tests/modele-hex.test.js` (22 tests) et `tests/graphe-hex.test.js` (12 tests). `node --test` : 799 tests, 792 OK, 0 échec, 7 PDF ignorés (vérifié par l'orchestrateur). Les tests du carré ne changent pas.

## Modèle
- **Format facultatif.** `masquesDuModele`, `mursDuModele` et `jonctionDuCoin` acceptent maintenant un format, et retombent sur le 4×4 s'il est absent. Aides ajoutées : `estHex`, `nbCotesDe`, `geoDe`, `gabaritsDe`, et la constante `NB_VILLES_HEX = 6`.
- **Validation hexagonale** :
  - la marge de 4 mm est mesurée sur la vraie forme de la tuile (hexagone ou pentagone) ;
  - **H1** : jusqu'à 3 ports par case, sur des coins consécutifs ;
  - R2 et R4 sont conservées ; il n'y a pas d'alerte `raccord_porteuse` ;
  - un passage peut toucher une porteuse et traverser la tuile ;
  - un pivot peut avoir jusqu'à 4 branches (celui de HC3 en a 4) ;
  - nouvelle alerte `coin_non_porte` (règle H2).
- **Poses** :
  - 19 cellules ;
  - rotation imposée du pourtour : simple suggestion, et une alerte `rotation_pourtour` si elle n'est pas respectée ;
  - rotation libre par 60° à l'intérieur.
- **Sièges** :
  - le jeton hexagonal s'écrit `{ i: siège 0..23, j: 0, type }` ;
  - un siège est complet quand ses 3 tuiles sont posées ;
  - fonctions de siège : `portsJonction`, `peutPoserJeton`, `jonctionsMalReliees`, `raccordsMorts` (côtés k et k + 3).
- **Erreurs et exemples** :
  - `trop_de_villes` devient une erreur dès la 7e ville ;
  - `copieExemples('hex19')` fournit une centrale, un bord et un coin.

## Graphe
- **`construire` en hexagonal** : cases, 24 nœuds de siège `J<i>,0`, ports, raccords, passages et anneau du pourtour.
- **Mesures** : `equilibre`, `rythme`, `connexions`, `casesParMoitie`, `accesCentre` et `villesProches` fonctionnent en hexagonal. `flancs` renvoie une liste vide.
- **Trèfle** : disponible sous `PM.graphe.MOTIF_VILLES_HEX`.

## Critères d'équilibre à 6 villes : proposition, à valider (conseiller design, puis utilisateur)
- 6 villes, 3 par camp.
- **« 4 contre 2 » bloquant** (N − 2, comme en carré), sans alerte intermédiaire.
- **S sur 6 rangs** : alerte dès 4, information dès 3. Table à part `SEUIL_S_HEX`, à recalibrer sur 1000 plateaux.
- Écart par rang inchangé : alerte au-dessus de 2, blocage au-dessus de 3.
- **En information seulement** : partage non symétrique (3/2/1) et ville à moins de 3 ports.
- **Zones du centre** : un siège qui touche une tuile de la rangée neutre compte comme « milieu ». Cela donne 5 sièges verts, 14 au milieu et 5 rouges.

## Mesures retrouvées (`75`), sur 8 plateaux complets (HC2 et HC3, trèfle)
- **Cases** : 56, aucune à 2 connexions ou moins.
- **Ports et écarts** : les 24 sièges ont 3 ports, et les villes sont à 4 pas au moins l'une de l'autre.
- **Raccords morts** : aucun.
- **Équilibre** : partage 3/3, S de 0 ou 1, première ville à 2 pas.
- **Tempo** : 4 villes à 3 pas au plus par camp.
- **Apparitions** : 5 par camp, 2 neutres.
- **Attention** : avec des rotations purement aléatoires, seuls 0,8 % des plateaux tiennent l'écart. Le générateur devra donc **chercher** les rotations.

## Points pour les lots suivants
- **Contrôles** : `trop_de_villes` serait affiché deux fois (erreur et alerte), et les codes `rotation_pourtour` et `coin_non_porte` n'ont pas encore de libellé.
- **Sauvegarde** : les jetons `{ i: 0..23, j: 0 }` ne doivent pas être bornés comme en carré, et il faut utiliser `FORMATS_TOUS`.
- **Rendu, export, éditeur, catalogue** : passer `'hex19'` aux fonctions du modèle. Retenir que `tuileEnPlateau` est en repère centré et que la rotation se compte par pas de 60°.
- **Seuils S** : intégrer `hex19` à `SEUIL_S_PAR_FORMAT` et mettre à jour `tests/graphe.test.js:222`.
