# Contrats des modules d'interface (orchestrateur), 2026-10-15

Socle commun écrit par l'orchestrateur (ne pas modifier) : `index.html`, `styles/base.css`, `src/app.js`, `src/etat.js`, `src/rendu.js`. Lire aussi `docs/4-architecture.md` (conventions) et `docs/5-avis-ergonomie.md` (parcours).

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
- `etat.remplacer(doc)` : ouverture d'un fichier (vide l'historique).
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
Chaque sous-agent écrit **seulement** : son `src/<module>.js`, sa feuille `styles/<module>.css` (classes préfixées `pm-<module>-`), son fichier de tests `tests/<module>.test.js`, et une page d'essai `outils/essai-<module>.html` qui monte son module seul (avec `PM.catalogue.nouveauDocument()`). Jamais `index.html`, `app.js`, `base.css`, `etat.js`, `rendu.js`, `modele.js`, ni les fichiers d'un autre module.

## Vérifications à faire par chaque sous-agent
1. `node --test tests/<module>.test.js` (seulement son fichier : les autres modules sont en cours d'écriture et peuvent être rouges).
2. Logique testable séparée du DOM (fonctions pures exportées et testées sous Node).
3. Page d'essai chargée sans erreur dans Edge sans fenêtre, puis contrôle du DOM produit :
   `"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom "file:///C:/Users/EQC/Documents/Claude/PlateauModulaire/outils/essai-<module>.html"`
   (pour capter les erreurs JavaScript, la page d'essai écrit `window.onerror` dans un élément `#erreurs`).
4. Les tests n'utilisent pas les identifiants ni les coordonnées du catalogue (il peut changer) : utiliser `PM.modele.copieExemples()` ou des données propres au test.
