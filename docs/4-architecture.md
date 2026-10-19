# Architecture du code

Mis à jour le 2026-10-19 (version 4.00.0 sur `main` ; branche `connexions-5x5` en cours, voir « Chantier en cours »). L'ancienne version de ce document décrivait un projet de la version 1 (`dist/`, `vendor/`, `outils/build.js`, 18 modèles) : ces éléments n'existent pas.

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
| `catalogue.js` | catalogue « organique » 4×4 (docs/45, branché en docs/46 ; 6 modèles, 24 tuiles imprimées ; les « poids » de tirage sont distincts des exemplaires) et catalogue 5×5 « très connecté » (docs/55, docs/56, docs/58 ; 9 modèles à 2 cases par tuile au plus, LC1 à LC7, LB2, LK2, 28 tuiles imprimées, poids de tirage = exemplaires ; LC4 déclare `murs: [1, 3]`, aucun autre modèle ne déclare de mur), `version` 4, `modelesParGrille`, `nouveauDocument(grille)` ; `precedent` : catalogues de la version 3.04 (13 et 6 modèles) ; `precedents` : tous les catalogues précédents par grille (`[{ version, modeles }]`, en 5×5 : 3.04 et 4.00), gelés, pour la compatibilité | non |
| `rendu.js` | tracé SVG des tuiles et des jetons ; jeton campement (`contenuJeton('campement')`, Ø 30 mm, deux bûches et une flamme noire) ; siège Ø 30 mm aux coins des tuiles (quarts de disque blancs) | non |
| `etat.js` | état partagé, historique annuler / rétablir | non |
| `sauvegarde.js` | JSON (version 3 écrite dès qu'un modèle a des passages ou des pivots, sinon 2 ; versions 1, 2 et 3 lues), migration des documents v1, champ `poids`, `bibliothequeCataloguePrecedent`, sauvegarde automatique | oui (stockage, fichiers) |
| `graphe.js` | graphe des cases, plus courts chemins, analyse d'équilibre (`equilibre` renvoie aussi `informations` : 5×5, ville sur une jonction à moins de `PORTS_VILLE_MIN` ports, jamais une alerte) ; exporte `PORTS_VILLE_MIN` (3), `PORTS_JONCTION_MIN` (2), `REPARTITION_VILLES_5X5` (2-3-2) et `flancs` (centre = colonnes 1 à colonnes − 2) ; mesures « organiques » (docs/46) : `reseauxPassages`, `rythme` (chaîne visée `CHAINE_CIBLE` = 3 ; zones d'intérêt : villes et jonctions-cases complètes, passages économes, raccourci), `accesCentre` (portes et chemins vers le milieu), `casesParMoitie` ; `connexions(doc, g)` (docs/53 § 1 : connexions par case, part de cases à 2 connexions ou moins, `PART_CONNEXIONS_MAX` = 5 %, degré moyen). Seuils de S par format : `seuilS(formatId)` / `seuilSInformation(formatId)` (4×4 : alerte 5, information 4 ; 5×5 : alerte 7, information 5 ou 6) ; `SEUIL_S` (5) n'est que le seuil de rejet du générateur, appliqué en 5×5 seulement. | non |
| `equilibre.js` | rapport d'équilibre | partiel (calcul pur + boîte de dialogue) |
| `generateur.js` | plateau aléatoire reproductible ; exporte aussi `causeRejet` (chaîne de filtres unique), `evaluer`, `sontMiroirs`, `placementsVilles5x5` (gelés), `tuilesOrientees5x5` (`tronque` si le budget de nœuds est dépassé) ; `candidats` borné à 1000 ; docs/46 : cases égales entre moitiés (`equilibrerMoities`, rejet `cases_moities`), orientation 4×4 (`tuilesOrientees4x4`), affinage du rythme et des accès sur les meilleurs candidats (option `affinage`) ; « jonctions variées » par défaut en 4×4 (12 paires équilibrées) ; 5×5 (docs/53 § 3, docs/56) : composition par quotas (`composer5x5`), placement des villes avant l'orientation (`placementsCompatibles`, `orienterPourVilles`), rejets `connexions` (plus de 5 % de cases à 2 connexions), `jonction_ports`, `villes_ports`, `score_s`, préférences chaîne, raccords morts, points d'articulation, S, abandon après 25 échecs structurels consécutifs ; aide « placer les villes » (`placementsAdmissibles`, `meilleurPlacementVilles`, `placerVilles(etat)`, bouton du panneau de contrôle) ; `poids` de tirage (1 à 999, sinon exemplaires). | partiel (calcul pur + boîte de dialogue) |
| `export.js` | planches PDF / SVG / PNG ; planche de jetons : 16 jetons recto-verso sur deux pages A4 (`svgJetons(face)`) : recto = 16 campements, avec cercles et repères de coupe ; verso = 16 villes en miroir (x → 210 − x), sans repère, fond perdu noir Ø 36 mm ; aperçu du plateau avec un campement à chaque jonction sans ville | oui |
| `controles.js` | compteurs et alertes | partiel (calcul pur + boîte de dialogue) |
| `bibliotheque.js` | colonne bibliothèque de modèles | oui |
| `assemblage.js` | écran Plateau | oui |
| `editeur-tuile.js` | écran Tuiles | oui |
| `aide.js` | aide et légende « Commandes » | oui |
| `app.js` | colle les écrans entre eux | oui |

Règle : les modules « non » ne touchent jamais au DOM, ce qui les rend testables sous Node et réutilisables côté serveur le jour venu. Les modules « partiel » ont un calcul pur testable sous Node et ne touchent au DOM que pour leur boîte de dialogue ; `PM.dialogue` est défini dans `app.js`.

## Chantier en cours (branche `connexions-5x5`, 2026-10-19)
Non fusionné. Source : `docs/18` (fin de fichier), `docs/64` à `docs/67`.
- **Fait** : campements (`rendu.js`, `export.js`, textes d'aide et de l'éditeur) ; jetons recto-verso (`export.js`, `docs/67`).
- **En cours** :
  - `catalogue.js`, 5×5 « P » : 30 tuiles (LC1 ×1, LC3 ×4, LC4 ×1, LC5 ×1, LC6 ×1, LC7 ×1, LC11 ×2, LC12 ×3, LB2 ×12, LK2 ×4) ; LC2 retiré ; LC11 et LC12 ajoutées (`docs/66`) ;
  - règle R3 assouplie sur les centrales 5×5 seulement (`validerModele`, `docs/66` § 2) ;
  - `generateur.js`, 5×5 à 8 villes fixes (1,1) (4,1) (2,2) (3,2) (2,3) (3,3) (1,4) (4,4), écart de 3 cases partout, choix de la place des centrales tirées (LC11 au milieu, LC12 sur les milieux de bord) ; alerte bloquante au-delà de 8 villes ;
  - `assemblage.js` (écran Plateau) : jeton campement à la place du petit point (la ligne 446 le trace déjà, à relire) ; textes restants « Case de jonction » et « case chemin », compteur « Cases (tuiles et jonctions) » dans `controles.js`, message `amorce_zone` dans `modele.js` ; `DIAMETRE_CASE_JONCTION` (20) dans `geometrie.js` et le halo de l'éditeur (r = 13) à aligner sur le siège Ø 30.

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
- Aides de test : `tests/aides-stock-worker.js` (fils de calcul du stock), `tests/aides-v2.js`, `tests/aides-trace.js` ; documents de compatibilité dans `tests/donnees/` (`document-v1.json`, `document-3.04-4x4.json`, `document-3.04-5x5.json`, `document-4.00-5x5.json` écrit par le code de l'étiquette 4.00.0). Mesures de contrôle du 5×5 : `outils/mesures-5x5-connecte.js` (200 plateaux, 4 fils ; `outils/mesures-5x5.js` est historique). Le test de temps du générateur mesure le temps processeur (`process.cpuUsage()`).
- Recettes navigateur manuelles : `outils/recette-interface.html`, `outils/recette-p2.html` (procédure dans `CLAUDE.md`).

## Où lire ensuite
Encore en vigueur malgré l'archivage : `archives/2` (conventions côtés / coins, D3 / D4 / D10), `archives/6` (prépresse, palette), `archives/16` (critère d'équilibre), `archives/11` (B1 sécurité, I1, I2).

`docs/18-decisions-v2.md` (prioritaire), `docs/10-contrats-interface.md` (montage, état partagé, interactions), `docs/25-travail-restant.md`.

## Évolution prévue (non engagée)
Jeu à deux en ligne : le noyau sans DOM (`geometrie`, `modele`, `graphe`, `catalogue`) serait partagé avec un serveur. Cela demandera de le passer en modules ES ; l'éditeur actuel resterait en `file://`. Rien n'est préparé dans le code à ce jour.
