# Architecture du code (orchestrateur), 2026-10-15

## Contraintes
- Page web unique, ouverte en `file://`, hors ligne, sans installation.
- Chrome bloque les modules ES (`<script type="module">`) en `file://` : **pas de modules ES, pas d'`import`**.
- Chaque sous-agent livre un module et ses tests, sans modifier les autres modules.

## Arborescence

```
PlateauModulaire/
  index.html            page de développement : charge src/*.js dans l'ordre par <script src>
  src/
    geometrie.js        constantes (mm), côtés/coins, masques, rotation, appariement  (sous-agent 1)
    modele.js           structures Tuile / Case / Chemin / Jeton / Plateau + validation (sous-agent 1)
    graphe.js           graphe global des cases + plus courts chemins                   (sous-agent 7)
    editeur-tuile.js    écran d'édition de tuile                                        (sous-agent 2)
    assemblage.js       écran de plateau                                                (sous-agent 3)
    controles.js        compteurs et alertes                                            (sous-agent 4)
    sauvegarde.js       JSON                                                            (sous-agent 5)
    export.js           PDF / SVG / PNG                                                 (sous-agent 6)
    generateur.js       plateau aléatoire                                               (sous-agent 8)
    catalogue.js        catalogue réel des 18 modèles / 20 tuiles                       (sous-agent catalogue)
    app.js              colle les écrans entre eux (orchestrateur)
    etat.js             état partagé, historique annuler / rétablir (orchestrateur)
    rendu.js            tracé des chemins et SVG des tuiles / jetons (orchestrateur)
    bibliotheque.js     colonne bibliothèque de modèles                                 (sous-agent 3)
  styles/               base.css (orchestrateur) + une feuille par module d'écran
  vendor/               bibliothèques tierces embarquées (version figée), ex. jsPDF
  tests/
    *.test.js           tests Node (node:test + node:assert), un fichier par module
  outils/
    build.js            produit dist/plateau-modulaire.html (scripts et CSS inlinés, un seul fichier)
  dist/                 livrable final
  docs/                 brief, avis, synthèse, ce fichier
```

## Conventions
- **Espace de noms global unique** : chaque fichier commence par
  `var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});`
  puis expose son module : `PM.geometrie = { ... }`, `PM.modele = { ... }`.
- Les modules logiques (`geometrie`, `modele`, `graphe`, `sauvegarde`, `generateur`, partie calcul de `controles`) **n'accèdent jamais au DOM**, pour être testables sous Node.
- Les tests chargent les fichiers avec `require('../src/geometrie.js')` puis lisent `globalThis.PM`.
- **Unité interne : le millimètre.** Conversion en pt / px seulement dans `export.js`.
- Code et identifiants en français sans accents (`tuile`, `raccords`, `portsCoin`, `jetons`), commentaires en français.
- Pas de dépendance npm à l'exécution ; Node (v24) sert seulement aux tests et au build.
- Lancer les tests (depuis la racine du projet) : `node --test` (Node 24 refuse `node --test tests/`, qu'il prend pour un fichier).
- Les fonctions de modification du document (`poserTuile`, `poserJeton`, …) sont **pures** et **lèvent une `Error`** si l'action est refusée : l'interface appelle toujours `peutPoser…` avant.

## État des modules
| Module | État | Tests |
|---|---|---|
| `geometrie.js`, `modele.js` (sous-agent 1) | livré le 2026-10-15, corrigé après revue et recette le 2026-10-15 | 225 / 225 (dont recette du testeur) |
| `catalogue.js` (sous-agent catalogue) | livré le 2026-10-15, 18 modèles / 20 tuiles, à charger après `modele.js` | 19 (simulation de 1000 plateaux) |

## Référence fonctionnelle
`docs/3-synthese.md`, puis `docs/2-avis-geometrie.md` (conventions de côtés / coins, masques, cas de test T1 à T4).

## Contrats des modules d'interface
Voir `docs/10-contrats-interface.md` (montage, état partagé, interactions, périmètres d'écriture, vérification dans Edge sans fenêtre).
