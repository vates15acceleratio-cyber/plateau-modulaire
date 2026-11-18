# Revue du module des passages (relecteur, lecture seule), 2026-10-17

Objet : commit 302cc29, branche `passages` (voir `40-passages-realisation.md`). Les cas « sonde » ont été rejoués sous Node par le relecteur.

## Bloquant
- **B1. Fichier hostile : environ 44 s de blocage à l'ouverture**, contre 0,7 s avant. Il s'agit de 500 modèles de 64 passages courbes, dans un fichier de 4,95 Mo. Cause : la règle des tracés de `validerModele` compare toutes les paires de segments (`modele.js:653-678`), et les plafonds de sauvegarde sont larges (`sauvegarde.js:29`). Corrections : baisser les plafonds, sortir au premier croisement d'une paire, sauter les tracés quand la structure a déjà des erreurs.

## À corriger
- **C1. Réseaux de passages fusionnés à travers les cases** (`modele.js:153`), contrairement au graphe, qui ne les fusionne pas. Effets :
  - l'alerte `passages_bord` manque quand une case porte deux passages ;
  - `reseau_passages_grand` donne de faux positifs ;
  - une `poche` est masquée.

  Correction : construire les réseaux comme `relierPassages`. La fusion à travers les cases reste seulement pour `case_isolee` et `reseau_sans_sortie`.
- **C2. Alerte d'écart manquée** quand deux traits partent d'une même case par des segments droits. L'intersection au centre de la case est exemptée, et le reste n'est jamais mesuré (`modele.js:541`, `:661`).
- **C3. Pivot isolé imprimé en vert sans blocage** (`rendu.js:159`). Il faut ne pas imprimer un pivot de degré inférieur à 2, et ajouter le blocage `pivot_zone_coin` et la distance aux cases.
- **C4. Ctrl+Z pendant le glissement d'une poignée** : erreur non rattrapée (`editeur-tuile.js:986`).

## Remarques
- **R1.** « Jamais depuis l'apparition » et « un passage au plus » sont des alertes, pas des blocages.
- **R2.** Il manque des tests positifs : `passage_rayon`, `passages_proches`, `passage_chemin_proche`, `pivot_hors_tuile`, `pivot_invalide`, `passage_courbe`, `passage_invalide`, et `raccord_exterieur` sur un passage.
- **R3.** Une courbe invalide est retirée en silence au chargement, sans entrer dans `elements_ignores`. L'ordre `pivot` / `case` diffère entre la sauvegarde et le modèle.
- **R4.** `{}` au lieu de `dict()` dans `supprimer` (`editeur-tuile.js:361`).
- **R5.** Couleurs écrites en dur dans `styles/editeur-tuile.css`, au lieu des variables `--pm-…`.
- **R6.** La case visée par `passage_case` n'est pas entourée : la référence porte `cases` au lieu de `ids`.

## Vérifié sans problème
CSP ; conventions ; graphe (clique à 1 pas, case à deux sorties, chemin face à un passage, rotation) ; raccords morts ; PDF (Q → C exact) ; rendu ; compatibilité stricte des anciens documents ; prototype ; annuler / rétablir.

## Arbitrage de l'orchestrateur
- **Tous les points B1, C1 à C4 et R2 à R6 sont à corriger.** Ils sont confiés au testeur, déjà sur ces fichiers.
- **R1 : on garde des alertes.** C'est cohérent avec la décision « seules les règles physiques bloquent » (R1 à R4 sont aussi des alertes). Les tuiles du catalogue respectent la règle, et leurs tests le vérifieront. La remarque sur l'apparition reliée indirectement à un passage voisin reste une information de plateau ; elle n'est pas traitée maintenant.
