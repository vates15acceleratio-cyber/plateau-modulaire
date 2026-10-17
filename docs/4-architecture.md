# Architecture du code

Mis à jour le 2026-10-16 (version 3.01.0). L'ancienne version de ce document décrivait un projet de la version 1 (`dist/`, `vendor/`, `outils/build.js`, 18 modèles) : ces éléments n'existent pas.

## Contraintes
- Page web unique, ouverte en `file://`, hors ligne, sans installation, sans build.
- Chrome bloque les modules ES (`<script type="module">`) en `file://` : **pas de modules ES, pas d'`import`**.
- CSP stricte dans `index.html` (voir `CLAUDE.md`) : aucun script, style ou attribut `style=` en ligne.
- Aucune dépendance à l'exécution. Node ≥ 20 sert aux tests et aux outils de mesure. Python et PyMuPDF sont facultatifs : sans eux, 7 tests (rendu des PDF) sont sautés ; la CI les installe.

## Arborescence

```
index.html          page de l'application ; charge src/*.js dans l'ordre ci-dessous
src/                modules JavaScript
styles/             base.css + une feuille par module d'écran (préfixe de classe propre)
tests/              tests Node (node:test), un fichier par module + recettes
outils/             recettes navigateur, pages d'essai, mesures d'équilibre, serveur local
docs/               décisions et références en vigueur (v2)
docs/archives/      historique de la version 1 (contexte seulement)
docs/brouillons/    travaux inachevés, à consulter sans les appliquer
.github/workflows/  CI : node --test à chaque push
```

## Modules de `src/` (ordre de chargement dans `index.html`)

| Module | Rôle | DOM |
|---|---|---|
| `geometrie.js` | constantes (mm), côtés et coins, masques, rotation, appariement | non |
| `modele.js` | structures Tuile / Case / Chemin / Jeton / Plateau et validation | non |
| `catalogue.js` | catalogues « organiques » (docs/45, branchés en docs/46) 4×4 (6 modèles, 21 tuiles) et 5×5 (8 modèles, 30 tuiles), `modelesParGrille`, `nouveauDocument(grille)` ; `precedent` : catalogues de la version 3.04 (13 et 6 modèles), gelés, pour la compatibilité | non |
| `rendu.js` | tracé SVG des tuiles et des jetons | non |
| `etat.js` | état partagé, historique annuler / rétablir | non |
| `sauvegarde.js` | JSON, migration des documents v1, sauvegarde automatique | oui (stockage, fichiers) |
| `graphe.js` | graphe des cases, plus courts chemins, analyse d'équilibre (`equilibre` renvoie aussi `informations` : 5×5, ville sur une jonction à moins de `PORTS_VILLE_MIN` ports, jamais une alerte) ; exporte `PORTS_VILLE_MIN` (3), `PORTS_JONCTION_MIN` (2), `REPARTITION_VILLES_5X5` (2-3-2) et `flancs` (centre = colonnes 1 à colonnes − 2) ; mesures « organiques » (docs/46) : `reseauxPassages`, `rythme` (chaîne visée `CHAINE_CIBLE` = 3, raccourci compté comme zone d'intérêt), `accesCentre` (portes et chemins vers le milieu), `casesParMoitie` | non |
| `equilibre.js` | rapport d'équilibre | partiel (calcul pur + boîte de dialogue) |
| `generateur.js` | plateau aléatoire reproductible ; exporte aussi `causeRejet` (chaîne de filtres unique), `sontMiroirs`, `placementsVilles5x5` (gelés), `tuilesOrientees5x5` (`tronque` si le budget de nœuds est dépassé) ; 5×5 : abandon après 25 échecs consécutifs de manque de ports, `candidats` borné à 1000 ; docs/46 : cases égales entre moitiés (`equilibrerMoities`, rejet `cases_moities`), orientation 4×4 (`tuilesOrientees4x4`), 78 à 81 cases en 5×5 (`CASES_CIBLE_5X5`), affinage du rythme et des accès sur les meilleurs candidats (option `affinage`) | partiel (calcul pur + boîte de dialogue) |
| `export.js` | planches PDF / SVG / PNG | oui |
| `controles.js` | compteurs et alertes | partiel (calcul pur + boîte de dialogue) |
| `bibliotheque.js` | colonne bibliothèque de modèles | oui |
| `assemblage.js` | écran Plateau | oui |
| `editeur-tuile.js` | écran Tuiles | oui |
| `aide.js` | aide et légende « Commandes » | oui |
| `app.js` | colle les écrans entre eux | oui |

Règle : les modules « non » ne touchent jamais au DOM, ce qui les rend testables sous Node et réutilisables côté serveur le jour venu. Les modules « partiel » ont un calcul pur testable sous Node et ne touchent au DOM que pour leur boîte de dialogue ; `PM.dialogue` est défini dans `app.js`.

## Conventions
- **Espace de noms global unique** : chaque fichier commence par
  `var PM = (typeof globalThis !== 'undefined' ? globalThis : window).PM = (globalThis.PM || {});`
  puis expose son module (`PM.geometrie = { ... }`) et, sous Node, `module.exports`.
- Les tests chargent les fichiers avec `require('../src/xxx.js')` puis lisent `globalThis.PM`.
- **Unité interne : le millimètre.** Conversion en pt / px dans `export.js` ; la conversion px ↔ mm de l'écran se fait aussi dans `assemblage.js` et `editeur-tuile.js`.
- Code et identifiants en français sans accents ; commentaires en français.
- Les fonctions de modification du document (`poserTuile`, `poserJeton`, …) sont **pures** et **lèvent une `Error`** si l'action est refusée ; l'interface appelle d'abord `peutPoser…`.
- Dans une chaîne JS entre apostrophes droites, une apostrophe française casse la syntaxe : utiliser `’`, puis `node --check`.

## Tests
- `node --test` à la racine (Node 24 refuse `node --test tests/`). Exécuté aussi par la CI GitHub.
- Recettes navigateur manuelles : `outils/recette-interface.html`, `outils/recette-p2.html` (procédure dans `CLAUDE.md`).

## Où lire ensuite
Encore en vigueur malgré l'archivage : `archives/2` (conventions côtés / coins, D3 / D4 / D10), `archives/6` (prépresse, palette), `archives/16` (critère d'équilibre), `archives/11` (B1 sécurité, I1, I2).

`docs/18-decisions-v2.md` (prioritaire), `docs/10-contrats-interface.md` (montage, état partagé, interactions), `docs/25-travail-restant.md`.

## Évolution prévue (non engagée)
Jeu à deux en ligne : le noyau sans DOM (`geometrie`, `modele`, `graphe`, `catalogue`) serait partagé avec un serveur. Cela demandera de le passer en modules ES ; l'éditeur actuel resterait en `file://`. Rien n'est préparé dans le code à ce jour.
