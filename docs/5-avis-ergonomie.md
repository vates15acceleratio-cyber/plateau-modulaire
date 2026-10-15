# Avis de l'advisor ergonomie (Sonnet 5.5), 2026-10-15

> **Conséquences pour le modèle de données (orchestrateur)** : un document unique contient la **bibliothèque de modèles** (chaque modèle a un nombre d'exemplaires et un état `complet | incomplet`) et le **plateau** (tuiles posées qui référencent un `modeleId`). Modifier un modèle met à jour toutes ses tuiles posées. Un modèle incomplet est enregistrable mais non posable. Historique annuler / rétablir unique par document (100 niveaux) : le modèle doit être sérialisable et clonable facilement.

## 1. Structure de la page
- Barre du haut fixe + 2 onglets plein écran : **Plateau** (par défaut) | **Tuiles**.
- Permanents : nom du projet, onglets, Annuler / Rétablir, Enregistrer / Ouvrir, Exporter, pastille de statut (« 2 alertes »).
- **Bibliothèque de modèles** en colonne gauche, commune aux deux onglets : clic = ouvre dans l'éditeur ; glisser = pose sur le plateau.
- Stock = compteur d'exemplaires par modèle (« ×2 », grisé à 0), modifiable par +/− sur la vignette.
- Un modèle modifié se met à jour partout sur le plateau (avertir si cela crée des raccords morts). « Dupliquer » proposé en premier dans l'éditeur.

## 2. Maquettes

```
PLATEAU
[Plateau|Tuiles] [<Annuler][Rétablir>] [Ouvrir][Enreg.] [Exporter v] [Forme: 4x4 v] (!) 3 alertes
+-----------+------------------------------+--------------------+
|BIBLIOTH.  |  Camp J1 (nord)              | COMPTEURS          |
|Filtre:    |  +--+--+--+--+  . = jonction | Tuiles   14/16     |
|[Tous v]   |  |C |A |A |C |  o = jeton    | Cases dépl. 48/50  |
|[vign.] x2 |  +--+--+--+--+               | Villes   5/7       |
|[vign.] x1 |  |B |  |  |B |               | Carref.  1/2       |
|[vign.] x0 |  +--+--+--+--+               | Appar. J1 2 J2 2   |
|...        |  |B |  |  |B |               | ALERTES (clic=zoom)|
|[+ Nouveau]|  +--+--+--+--+               | ! Raccord mort 2   |
|[Dupliquer]|  |C |A |A |C |               | ! Écart villes     |
|           |  +--+--+--+--+  Camp J2 (sud)| [Rapport équilibre]|
|           |  48 x 48 cm                  | [Aléatoire]        |
+-----------+------------------------------+--------------------+
Barre d'état : dernier refus / aide (« Glissez un coin sur un coin libre »)
```
Cellules libres : silhouette fantôme avec l'étiquette du rôle (Coin, Bord, Apparition J1, Centrale).

```
EDITEUR DE TUILE
+-----------+-----------------------------+---------------------+
|BIBLIOTH.  |  Rôle: (Centrale)(Coin)     | OUTILS (touches)    |
|(commune)  |        (Bord)(Apparition)   | (1) Case dépl.      |
|           |  o-- o-- o  (raccords N)    | (2) Case apparition |
|           |  o  [carré 12 cm]  o        | (3) Chemin          |
|           |  o   cases, chemins  o      | (4) Raccord         |
|           |  o-- o-- o                  | (5) Port de coin    |
|           |  coins = 4 gros points      | (Suppr) Gomme       |
|           |  Zoom 100% | Aperçu rotation| VALIDATION          |
|           |                             | v 3 cases  x 0 port |
+-----------+-----------------------------+---------------------+
```

## 3. Parcours éditeur
- Outil contextuel unique : les 12 points de raccord et les 4 coins sont toujours affichés et cliquables (grisés s'ils sont interdits par le rôle).
- **Case** : clic sur le fond (aimantée sur une grille de 1 cm, cercle fantôme de 3 cm au survol) ; clic droit ou touche A pour changer le type.
- **Chemin** : glisser d'une case vers une case, un raccord ou un coin ; ou deux clics successifs (tactile).
- **Raccord** : clic sur un des 12 points ; trace un chemin s'il y a une case proche, sinon alerte « raccord sans chemin ».
- **Port de coin** : clic sur le coin intérieur, puis sur la case.
- Selon le rôle, la tuile démarre avec le bon nombre de cases fantômes (3, ou 4 pour une centrale).
- **Erreurs** : liste « Validation » cliquable (halo rouge sur l'élément), marquage direct (case rouge si chevauchement, deux ports sur une case, coin pulsant si port obligatoire manquant). Enregistrement possible en brouillon : modèle « incomplet », non posable.
- **Risque** : confusion entre raccords et cases ; cotes au survol, raccords dessinés en demi-disques sur le bord.

## 4. Parcours assemblage
- Glisser-déposer depuis la bibliothèque ; cellules compatibles éclairées, autres estompées ; aimantation animée (100 ms).
- Rotation : touche R ou clic, **centrales seulement** ; aucune poignée pour les autres rôles.
- **Refus** : la tuile revient vers la bibliothèque (200 ms), la cellule clignote en rouge pâle, la barre d'état explique en une phrase. Pas de fenêtre modale.
- **Raccords morts** : triangle orange sur la frontière + ligne dans les alertes (clic = centre et fait clignoter). Connectés en trait plein, morts en pointillé.
- **Jetons** : clic sur une jonction = Ville → Carrefour → vide. Jonction refusée grisée avec info-bulle. Compteur « Jetons posés 7/9 ».
- **Compteurs** par ordre d'importance : alertes, villes x/7, cases de déplacement x/50, tuiles x/16, apparitions J1/J2, dimensions. Jauge colorée seulement en cas d'écart.

## 5. Annuler, raccourcis, entrées
- Historique unique par document, 100 niveaux ; Ctrl+Z / Ctrl+Y (ou Ctrl+Maj+Z) ; un glissement = une étape.
- Raccourcis : R pivoter, Suppr gomme, A type de case, 1 à 5 outils, Espace + glisser défiler, Ctrl+S, Ctrl+D dupliquer, Échap annuler le geste.
- Souris d'abord, tactile pris en charge : événements Pointer, cibles ≥ 44 px, deux clics au lieu du glissement, double toucher pour pivoter.
- Sauvegarde automatique dans localStorage avec invitation à la reprise.

## 6. Les 3 pièges
1. **Lien invisible modèle ↔ tuiles posées** : compteur « utilisé × fois », avertissement avant enregistrement, Dupliquer, revalidation immédiate.
2. **Rotations et raccords qui trompent l'œil** : repère N sur chaque tuile, aperçu des 4 rotations dans l'éditeur, mention « posée automatiquement ».
3. **Contraintes dures qui ressemblent à des bogues** : refus expliqués en une phrase, alertes hiérarchisées et regroupées, aide de premier lancement en 3 bulles au lieu d'une notice.
