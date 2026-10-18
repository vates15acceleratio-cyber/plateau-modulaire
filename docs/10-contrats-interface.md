# Contrats des modules d'interface (orchestrateur), 2026-10-15

Socle commun écrit par l'orchestrateur (ne pas modifier) : `index.html`, `styles/base.css`, `src/app.js`, `src/etat.js`, `src/rendu.js`. Lire aussi `docs/4-architecture.md` (conventions) et `docs/archives/5-avis-ergonomie.md` (parcours).

## Montage
- Chaque module d'écran expose `PM.<module>.monter(conteneur, etat)` ; `app.js` l'appelle une fois au démarrage.
- Le module construit son DOM **dans `conteneur` uniquement**, s'abonne lui-même à `etat.abonner(cb)` et se redessine à chaque notification.
- Conteneurs de `index.html` :

| Module | Objet global | Conteneur | Propriétaire |
|---|---|---|---|
| Bibliothèque (colonne gauche, commune aux 2 onglets) | `PM.bibliotheque` | `#bibliotheque` | sous-agent 3 |
| Plateau d'assemblage | `PM.assemblage` | `#assemblage` | sous-agent 3 |
| Compteurs et alertes | `PM.controles` | `#controles` | sous-agent 4 |
| Éditeur de tuile | `PM.editeurTuile` | `#editeur` | sous-agent 2 |
| Sauvegarde (pas d'écran) | `PM.sauvegarde` | — | sous-agent 5 |

## État partagé (`src/etat.js`)
- `etat.doc()` : document courant (ne jamais le modifier directement).
- `etat.appliquer(fn, libelle)` : `fn(doc) → nouveau document`, avec une fonction **pure** de `PM.modele`. Gère l'historique (100 niveaux). Si `fn` lève une `Error`, le document ne change pas et la raison s'affiche dans la barre d'état. Renvoie `{ok}` ou `{ok:false, raison}`.
- `etat.majUi(patch)` : état d'interface hors historique. Champs : `onglet` (`'plateau'|'tuiles'`), `modeleSelectionne` (id ou null), `surbrillance` (voir l'en-tête de `etat.js`), `message`.
- `etat.signaler(texte, niveau)` : barre d'état (`'info'|'alerte'|'erreur'`). **Tout refus s'explique ici en une phrase** ; jamais de fenêtre modale ni d'`alert()`.
- `etat.remplacer(doc, libelle)` : ouverture d'un fichier ; **annulable** (le document précédent reste dans l'historique).
- Annuler / rétablir, Ctrl+S et les onglets sont gérés par `app.js`. Les modules gèrent leurs propres raccourcis (R, Suppr, A, 1 à 5, Échap), seulement quand leur onglet est visible.

## Interactions entre modules
- **Bibliothèque → éditeur** : clic sur un modèle → `etat.majUi({modeleSelectionne: id, onglet: 'tuiles'})`.
- **Bibliothèque → plateau** : glisser-déposer interne au sous-agent 3 (bibliothèque et plateau sont à lui). Événements Pointer ; alternative en deux clics (sélection du modèle puis clic sur une cellule).
- **Contrôles → plateau** : clic sur une alerte → `etat.majUi({surbrillance: {...}, onglet: 'plateau'})` ; le plateau met l'élément en évidence et l'efface au clic suivant.
- **Éditeur** : boutons « Nouveau » (choix du rôle) et « Dupliquer » dans l'éditeur ; enregistre via `ajouterModele` / `remplacerModele`. Un modèle incomplet est accepté dans la bibliothèque (brouillon, non posable).
- **Pastille d'alertes** de la barre du haut : `app.js` appelle `PM.controles.calculer(doc)` et compte `erreurs.length + alertes.length`.
- **Sauvegarde** : `app.js` appelle `PM.sauvegarde.telecharger(doc, nom)`, `PM.sauvegarde.ouvrirFichier() → Promise<null | {ok, doc, erreurs, alertes}>`, `PM.sauvegarde.autosave(doc)`, `PM.sauvegarde.restaurerAutosave() → {ok, doc} | null`.

## Rendu
- Dessin des tuiles : **toujours** `PM.rendu.contenuTuile(modele, {rot, joueur, fondPerdu, contour})` (SVG dans le repère 0..120 mm) ou `PM.rendu.svgTuile`. Jetons : `PM.rendu.contenuJeton(type, cx, cy)`. Tracé des chemins : `PM.rendu.tracesModele(modele)`. Les surcouches d'interface (points cliquables, halos, alertes) sont dessinées par le module, par-dessus.
- Couleurs d'impression (vert / rouge / noir / blanc) pour les tuiles et jetons ; l'interface peut utiliser les variables CSS de `base.css` (`--pm-accent`, `--pm-alerte`, `--pm-erreur`…).

## Fichiers par module (périmètre d'écriture)
Chaque sous-agent écrit **seulement** : son `src/<module>.js`, sa feuille `styles/<module>.css` (classes préfixées `pm-<module>-`), son fichier de tests `tests/<module>.test.js`, et une page d'essai `outils/essai-<module>.html` qui monte son module seul (avec `PM.catalogue.nouveauDocument()`, ou `PM.catalogue.nouveauDocument('5x5')` pour le catalogue 5×5). Jamais `index.html`, `app.js`, `base.css`, `etat.js`, `rendu.js`, `modele.js`, ni les fichiers d'un autre module.

## Vérifications à faire par chaque sous-agent
1. `node --test tests/<module>.test.js` (seulement son fichier : les autres modules sont en cours d'écriture et peuvent être rouges).
2. Logique testable séparée du DOM (fonctions pures exportées et testées sous Node).
3. Page d'essai chargée sans erreur dans Edge sans fenêtre, puis contrôle du DOM produit :
   `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "file:///<dossier du projet>/outils/essai-<module>.html"`
   (pour capter les erreurs JavaScript, la page d'essai écrit `window.onerror` dans un élément `#erreurs`).
4. Les tests n'utilisent pas les identifiants ni les coordonnées du catalogue (il peut changer) : utiliser `PM.modele.copieExemples()` ou des données propres au test.

## Modules de priorité 2 et export (2026-10-15)

| Module | Objet global | Fichiers | Point d'accroche (écrit par l'orchestrateur) |
|---|---|---|---|
| Export impression (sous-agent 6) | `PM.exportation` | `src/export.js`, `styles/export.css` | bouton « Exporter » de la barre → `PM.exportation.ouvrir(etat)` |
| Graphe (sous-agent 7) | `PM.graphe` | `src/graphe.js` (pur, sans DOM) | — |
| Rapport d'équilibre (sous-agent 7) | `PM.equilibre` | `src/equilibre.js`, `styles/equilibre.css` | bouton « Rapport d'équilibre » du panneau de contrôles → `PM.equilibre.ouvrir(etat)` |
| Générateur (sous-agent 8) | `PM.generateur` | `src/generateur.js`, `styles/generateur.css` | bouton « Plateau aléatoire » du panneau de contrôles → `PM.generateur.ouvrir(etat)` |

- **Boîte de dialogue commune** : `PM.dialogue.ouvrir(titre)` renvoie l'élément de contenu (vide) à remplir ; `PM.dialogue.fermer()`. Le module ne crée pas d'autre fenêtre.
- Ordre de chargement dans `index.html` : … `sauvegarde.js`, `graphe.js`, `equilibre.js`, `generateur.js`, `export.js`, `controles.js`, … `app.js`.
- Mêmes règles qu'au-dessus : périmètre d'écriture limité aux fichiers du module, tests `tests/<module>.test.js` lancés seuls, page d'essai `outils/essai-<module>.html`, vérification dans Edge sans fenêtre.

## Mise à jour règles v2 (2026-10-16)

Ce qui change dans les contrats ci-dessus (détail : `18-decisions-v2.md`, `19-avis-design-v2.md`, `20-avis-geometrie-v2.md`) :
- **Document** : `doc.grille` = `'4x4'` | `'5x5'` (absent = `'4x4'`) ; grille toujours pleine (plus de forme réduite). Un fichier de la version 1 est converti à l'ouverture (`PM.sauvegarde.depuisJSON` ajoute en tête des alertes `migration_v1`, une phrase) ; `app.js` la dit au démarrage et signale une bibliothèque v1 (`PM.sauvegarde.bibliothequeVersion1(doc)`).
- **Modèles** : `gabarit` = `centrale | bord | coin` (jamais bloquant) remplace `role` ; plus de rôle `apparition`. `PM.modele.validerModele(modele, format)` → `{complet, erreurs, alertes}` : seules les règles physiques bloquent, R1 à R4 sont des alertes expliquées.
- **Plateau** : `PM.modele.campCellule(format, col, lig)` → `'vert' | 'rouge' | null`. `peutPoserTuile` refuse seulement : hors grille, cellule occupée, modèle incomplet, rôle qui ne correspond pas à la cellule (coin dans un coin, bord sur le pourtour hors coins, centrale au centre ; un modèle sans gabarit connu va partout). **Retours après essai (2026-10-16)** : les poses sont illimitées (plus de refus pour exemplaires épuisés, plus d'erreur `exemplaires_depasses`, `exemplairesRestants` supprimé ; `changerExemplaires` n'exige plus d'être au moins égal au nombre de tuiles posées : l'exemplaire ne sert qu'à l'impression et de poids au générateur) ; `validerModele` ajoute l'alerte `poche` ; `PM.assemblage.retirerParClicDroit(doc, col, lig)` (pure) et `PM.bibliotheque.refusArmement(doc, id)` (pure) ; l'export accepte `exemplaires: {id: n}` pour le jeu complet ; le générateur tire avec remise (poids = exemplaires, pénalité de répétition `PM.generateur.facteurRepetition`). **2026-10-18 (`docs/47`)** : champ facultatif `poids` sur un modèle (`PM.modele.poidsTirage(m)` : `poids` s’il est présent, sinon `exemplaires` ; 0 exemplaire = jamais tiré) ; les `exemplaires` sont le stock imprimé, le `poids` la fréquence de tirage ; une copie de tuile perd son poids. `PM.sauvegarde.bibliothequeCataloguePrecedent(doc)` reconnaît une bibliothèque du catalogue 3.04 (`PM.catalogue.precedent`), à laquelle l’application propose le nouveau catalogue (ouverture et démarrage). Rotation libre, `rotationDeduite` ne fait que suggérer (bord / coin) ; la rotation est toujours stockée.
- **Jetons** : seul le type `capture` (ville) existe ; toute jonction intérieure sans ville est une case chemin (nœud du graphe). Villes non traversables (règle du jeu, plus d'option dans l'interface). Écart minimal : `ECART_MIN_VILLES = 3` cases, alerte seulement.
- **Seuils de S par format (2026-10-18, `docs/18` et `docs/48`)** : `PM.graphe.SEUIL_S` (= 5) n’est plus que le seuil de **rejet du générateur**, le même dans les deux formats. L’alerte `score_s` et l’information `sInformation` dépendent du format du document : `PM.graphe.SEUIL_S_PAR_FORMAT` (`{ '4x4': 5, '5x5': 7 }`), `SEUIL_S_INFORMATION_PAR_FORMAT` (`{ '4x4': 4, '5x5': 5 }`) et les fonctions `seuilS(formatId)` / `seuilSInformation(formatId)`. 4×4 : alerte dès S = 5, information S = 4. 5×5 : alerte dès S = 7, information S = 5 ou 6. `SEUIL_S_INFORMATION` n’existe plus. `PM.equilibre.explication(formatId)` donne le texte du rapport avec les seuils du format (`EXPLICATION` = celui du 4×4) ; `rapport()` expose `seuilS` et `seuilSInformation`. « 5 contre 2 » n’est plus signalé sur un plateau sans case d’apparition pour un camp (plateau incomplet).
- **Rythme et accès au centre (information seulement, jamais une alerte)** : la ligne « Rythme » du rapport ajoute « bien au-dessus de la cible » quand la chaîne vaut 7 ou plus (2 × `CHAINE_CIBLE` + 1) ou la distance maximale 6 ou plus. `PM.graphe.casesParMoitie(doc, g)` ne compte une jonction-case que si ses 4 tuiles sont posées (même règle que le compteur « Cases » de `PM.controles`).
- **Générateur** : `jonctionsVariees` vaut **vrai par défaut** (seul `false` revient aux 3 paires de la rangée centrale ; 4×4 seulement, 12 paires équilibrées) ; la case « Jonctions variées » du dialogue est cochée au départ. En 5×5, le choix final entre les finalistes préfère les plateaux sans point d’articulation (`GR.goulets`), après la chaîne et avant l’écart des accès : préférence, jamais un rejet.
- **Contrôles** : `PM.controles.calculer` ajoute l'erreur `desequilibre` sur un plateau complet très déséquilibré (seuils `PM.graphe.SEUIL_*`) ; la pose reste permise, l'export de l'aperçu est refusé.
- **Rendu** : `PM.rendu.contenuTuile(modele, {rot, camp, fondPerdu, contour, identifiant, format})` (`camp` remplace `joueur` ; absent = impression noir et blanc) ; quart de case de jonction Ø 20 sur les coins intérieurs du gabarit ; `PM.rendu.contenuJeton(type, cx, cy, format)`.
- **Formats** : `PM.geometrie.format(id)` donne les cotes du format ; `PM.geometrie.*` reste l'alias du 4×4. Le format hexagonal n'est pas commencé (en attente du feu vert).
