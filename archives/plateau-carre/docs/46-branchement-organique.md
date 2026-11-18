# Branchement de la révision « centrales ouvertes » (sous-agent générateur / catalogue, Opus 5.5), 2026-10-18

Rapport du sous-agent, consigné par l'orchestrateur. L'orchestrateur a vérifié `node --test` : 632 tests, 625 OK, 0 échec, 7 sautés (PDF sans PyMuPDF). Les recettes navigateur, données par le sous-agent, sont à 313 OK et 116 OK, sans échec.

## Fichiers
- **`src/catalogue.js` :**
  - nouveaux catalogues 4×4 et 5×5, identiques à `outils/catalogue-organique.js` (un test le vérifie) ;
  - les anciens catalogues (3.04) restent dans `PM.catalogue.precedent`, gelés ;
  - `version` passe à 3.
- **`src/graphe.js`** (sans DOM) : `reseauxPassages`, `casesRaccourci`, `rythme` (`CHAINE_CIBLE` = 3), `zoneDuNoeud`, `accesCentre`, `casesParMoitie`. Ces mesures donnent les mêmes résultats que l'outil sur 56 plateaux.
- **`src/generateur.js` :**
  - égalité des cases entre moitiés ;
  - orientation des centrales en 4×4 ;
  - composition du 5×5 visant 78 à 81 cases ;
  - affinage pour le rythme et les accès ;
  - nouveau rejet `cases_moities` ;
  - champs ajoutés au rapport.
- **`src/equilibre.js` :** une section « Rythme, accès et moitiés », en information seulement, jamais en alerte.
- **`src/controles.js` :** la cible du compteur de cases passe à ≈ 58 en 4×4 et ≈ 80 en 5×5.
- **`src/bibliotheque.js` :** les modèles de l'ancien catalogue restent protégés dans un ancien document.
- **`outils/` :** l'outil de planches utilise désormais les fonctions de `src/graphe.js`. `mesures-equilibre.js` gagne l'option `orientes`. Les recettes navigateur sont adaptées.
- **Tests :**
  - catalogues réécrits ;
  - générateur, mesures, passages, équilibre, bibliothèque, contrôles et export mis à jour ;
  - nouveau fichier `tests/mesures-organiques.test.js` (11 tests) ;
  - règles toujours vérifiées : R1 à R4, tracés, aucune poche, aucun passage traversant ni vers un coin ni sur une porteuse ni depuis l'apparition, un passage par tuile en 4×4, aucun miroir, 4 pas entre jonctions.

## Exemplaires
- **4×4 :** Q1 ×4, Q2 ×3, B1 ×8, B8 ×1, K2 ×4, K4 ×1, soit 21 tuiles.
- **5×5 :** U1 ×5, P3 ×2, P5 ×2, P1 ×1, P2 ×1, **B1 ×6**, **B7 ×8**, K2 ×5, soit 30 tuiles.
- En 5×5, cases = 72 + nB1 + nU1 et ports = cases − 38. On compte entre 78 et 81 cases, soit 40 à 43 ports.

## Définitions
- **Rythme :**
  - zones d'intérêt : les villes, les cases d'un réseau de passages qui économise un pas, et les **cases reliées par un raccourci** (décision 3, d'où toutes les apparitions) ;
  - chaîne : le plus long trajet sans action sur un plus court chemin entre deux zones ;
  - cible : 3.
- **Accès au centre :** portes vertes − portes rouges vers le milieu, selon la définition de `45`. Le nombre de chemins indépendants est donné en complément.
- **Cases par moitié :** cases des tuiles selon le camp de leur cellule, la rangée neutre étant comptée à part.

## Générateur
- **Rejets** (ceux de `36`, plus un nouveau) :
  - `cases_moities` (nouveau) : le catalogue livré ne le produit jamais.
  - En 4×4, « jonctions variées » est limité à 12 paires équilibrées.
- **Construction :**
  1. Égaliser les moitiés en échangeant ou remplaçant des tuiles.
  2. Orienter les centrales selon les ports : au moins 3 par jonction en 4×4.
  3. En 5×5, choisir le nombre de B1 : 78 à 81 cases, B1 de préférence sur la rangée neutre.
- **Préférences :** l'affinage tourne les centrales de 6 bons candidats. Le plateau rendu est choisi d'après la chaîne, puis l'écart d'accès. Sur 40 graines, l'affinage fait passer la chaîne moyenne de 4,13 à 2,98 en 4×4, et de 3,75 à 2,65 en 5×5.

## Mesures de contrôle (200 plateaux par format, vrai générateur)

| | 4×4 | 5×5 |
|---|---|---|
| Réussite | 100 % | 100 % |
| Temps par plateau | 315 ms | 1075 ms |
| Cases moy. (min–max) | 58,2 (56–62) | 80,3 (78–81) |
| Écart de cases entre moitiés | 0 | 0 |
| Chaîne moy. / pire / ≤ 3 | 3,00 / 3 / 100 % | 2,60 / 3 / 100 % |
| distMax moy. / pire | 2,0 / 3 | 3,4 / 6 |
| Écart d'accès moy. / pire | 0,56 / 1 | 0,39 / 1 |
| S moyen | 0,49 | 0,53 |
| « 5 contre 2 » sur les plateaux rendus | 0 % | 0 % |
| Placements admissibles | 36 | 48 (3–90) |
| Ports minimum par jonction ; villes à 3 ports | 3 ; 7 sur 7 | 2 ; 7 sur 7 |
| Plateaux qui tiennent dans le jeu imprimé | 46 % (avant : 11,5 %) | 27,5 % (avant : 52,5 %) |

## Compatibilité
- Les anciens documents s'ouvrent sans changement ni migration, testé sur des plateaux complets 3.04 en 4×4 et 5×5. Le format de sauvegarde ne change pas (`version` 2).
- Ce qui change pour eux :
  - « Plateau aléatoire » donne d'autres plateaux pour une même graine ;
  - « jonctions variées » est restreint ;
  - le compteur affiche une nouvelle cible ;
  - le rapport d'équilibre gagne une section.
- Un ancien document ne reçoit pas les nouvelles tuiles ; il faut faire « Nouveau ».

## Points ouverts pour l'utilisateur
1. **Jeu imprimé :** le générateur ne respecte pas le stock. Seuls 46 % des plateaux 4×4 et 27,5 % des 5×5 se montent avec les tuiles imprimées ; par exemple, U1 peut être posé 7 fois pour 5 imprimés. Faut-il imposer le stock au générateur, ou imprimer plus ?
2. « Jonctions variées » en 4×4, limité aux paires équilibrées : à confirmer.
3. B1 sur la rangée neutre : simple préférence, tenue dans 72 % des plateaux.
4. Raccourci compté comme zone d'intérêt : toutes les apparitions deviennent des zones. La mesure du rythme est-elle encore assez sévère ?
5. En 5×5, l'écart de chemins indépendants va jusqu'à 4 et la distance max jusqu'à 6 : seules les portes sont optimisées.
6. Proposer le nouveau catalogue aux anciens documents ?
7. `docs/croquis/organique/mesures.json` et `centrales-ouvertes-200.json` sont périmés : ils ont été calculés sans compter le raccourci.
