# Revue des modules d'interface (relecteur, Opus 5.5), 2026-10-15

Contrats respectés dans l'ensemble (montage, `appliquer`, `signaler`, raccourcis limités à leur onglet).

## Bloquant
- **B1. Injection de script par un fichier JSON ouvert** : `sauvegarde.normaliserModele` laisse passer des coordonnées non numériques ; l'éditeur les concatène dans du SVG inséré par `innerHTML` (`svgMarquesErreur`, `svgHalo`, cercle « armé ») → un `<img onerror>` s'exécute à l'ouverture du modèle (et via la sauvegarde automatique).

## Important
- **I1.** « Ouvrir » vide l'historique, puis la sauvegarde automatique écrase l'ancien document : perte sans recours.
- **I2.** Échecs silencieux de la sauvegarde automatique (quota, stockage indisponible, sauvegarde illisible remplacée sans rien dire).
- **I3.** Règle « carrefours du même côté » différente : `assemblage.js` (rangées nord / sud) contre `controles.js` (rangées + colonnes).
- **I4.** Tout est recalculé à chaque notification (`calculer` deux fois, écrans masqués redessinés).
- **I5.** Logique recopiée faute d'export (`echapper` ×4, `typeExtremite`, `nbPosees`, `jetonEn`, libellés de rôle, `NORMALE` / `BISSECTRICE`).

## Mineur
M1 écouteurs jamais retirés (un seul montage : à documenter) ; M2 `majUi` depuis un abonné ; M3 pas de Retour arrière, pas de raccourcis 1 à 5 ; M4 une flèche = une entrée d'historique ; M5 bornes en dur ; M6 `e.message` en `innerHTML` dans `app.js` ; M7 surbrillance `case` / `chemin` jamais effacée ; M8 fichiers longs ; M9 « 48 × 48 cm » en dur.

## Trous dans les tests
Contenu hostile dans les fragments SVG ; cohérence des règles de carrefours entre modules ; `ecrireMaintenant` ; `remplacer` + autosave ; bout en bout de `app.js`.

## Arbitrages de l'orchestrateur
- **I3** : « même côté » = **même camp de joueur**, c'est-à-dire les 2 carrefours sur la rangée de jonctions nord (j = 1) ou les 2 sur la rangée sud (j = 3) (1b D7 : « sinon 3 villes contre 1 »). Les colonnes ouest / est ne sont pas des camps. Une seule fonction, dans `controles.js`, appelée par l'assemblage.
- **B1, I1, I2, I3, M6** corrigés avant la version ; I4, I5 et les autres points mineurs reportés à l'itération suivante.

# Recette de l'interface (testeur, Sonnet 5.5), 2026-10-15
- `tests/recette-interface.test.js` (27 tests) et `outils/recette-interface.html` (163 contrôles navigateur, vrais événements Pointer / clavier sur l'application complète) : **163 OK, 0 échec**, aucune erreur JavaScript.
- Parcours couverts : plateau 4×4 complet par glisser-déposer jusqu'à « Plateau complet » ; refus expliqués ; annuler / rétablir à travers les modules ; éditeur complet ; contrôles et surbrillance ; formes réduites ; sauvegarde, ouverture, autosave ; raccourcis par onglet.
- Bugs corrigés par l'orchestrateur : modèle incomplet glissé sans explication (B2), règle des carrefours divergente (B3), `appliquer` sans message sur résultat invalide (B4), mise en page étroite et cibles tactiles (B1, CSS).
- Restent (mineurs, `todo`) : `TypeError` natif de quelques fonctions pures sur des entrées nulles que l'interface ne produit jamais (B6).
- À savoir : les cases du catalogue ne sont pas toutes sur la grille de 1 cm de l'éditeur ; la première modification d'une case la recale de quelques mm.
- Non vérifié : ressenti réel souris / tactile, vrai téléphone, boîte de dialogue de fichier réelle.
