# 5×5 très connecté : réalisation (sous-agent générateur / catalogue, Opus 5.5), 2026-10-18

Rapport du sous-agent, consigné et condensé par l'orchestrateur. Il applique les décisions de `18` (« Décisions… 5×5 très connecté »). Résultats :
- `node --test` : 689 tests, 682 OK, 0 échec, 7 ignorés (PDF), vérifié par l'orchestrateur ;
- `recette-interface` : 352 OK, 0 échec ;
- `recette-p2` : 116 OK, 0 échec.

## Changements
- **Catalogue 5×5 remplacé :**
  - LC1 « Pont et relais » ×3 ;
  - LC2 « Pont et relais décalé » ×2 ;
  - LC3 « Pont et fourche » ×3 ;
  - LC4 « Deux ponts » ×1 ;
  - LB2 « Bord à pont » ×12 ;
  - LK2 « Coin à porteuse » ×4.

  Cela fait **25 tuiles, soit un plateau exactement** : 5 planches A3 ou 13 A4. Les coordonnées sont celles de `55`. Les anciens catalogues 5×5 (3.04 et 4.00.0) sont gelés dans `PM.catalogue.precedents`, et `version` passe à 4.
- **Règles propres au 5×5** (`validerModele`) :
  - **porteuse latérale :** 2 ports sur les coins d'un même côté, avec le seul raccord du milieu de ce côté ;
  - **porteuse du coin :** sur une tuile de coin seulement, la paire basse ;
  - **murs :** permis sur « Deux ponts » seulement ;
  - **toujours en alerte :** ports en diagonale, porteuses reliées entre elles, port sur une apparition, porteuse qui touche un passage.

  Le 4×4 est inchangé, un test le vérifie.
- **Mesure `PM.graphe.connexions` :** le nombre de cases voisines en un déplacement, compté sur les cases des tuiles et les jonctions-cases complètes, villes à part. Le plateau est conforme si moins de 5 % des cases ont 2 connexions ou moins. Elle s'affiche en information dans le rapport et dans les compteurs.
- **Générateur 5×5 :**
  - composition par quotas ;
  - placement des villes en 2-3-2 compatible, sans porteuse qui desserve deux villes ;
  - puis recherche complète des orientations.

  | Rejets | Préférences, dans cet ordre |
  |---|---|
  | plus de 5 % de cases à 2 connexions (`connexions`) | chaîne |
  | jonction à moins de 2 ports | raccords morts |
  | ville à moins de 3 ports | points d'articulation |
  | écart entre villes | S |
  | S ≥ 5 | |
  | « 5 contre 2 » | |

  Environ 0,7 s par plateau.
- **Aide « Placer les villes » :** un bouton dans les Outils pose les 7 villes au meilleur placement admissible. Il est annulable par Ctrl+Z, fonctionne en 4×4 comme en 5×5, et respecte la CSP.
- **Anciens documents :** les documents 5×5 de la 3.04 et de la 4.00.0 se voient proposer le nouveau catalogue, à l'ouverture d'un fichier comme au démarrage. C'est testé sous Node et par la recette S11. Le format de sauvegarde ne change pas.

## Mesures de contrôle (200 plateaux)

| | Générateur | Témoin R (`55`) |
|---|---|---|
| Réussite | 100 % | — |
| Cases | 59 | 59 |
| Cases à 2 connexions ou moins | **1,3 %** (100 % des plateaux sous 5 %) | 0 % |
| Degré moyen | 3,74 | 3,64 |
| Jonctions : à 2 / 3 / 4 ports | 153 / 2 894 / 153 (sur 3 200) | toutes à 3 |
| Placements admissibles | 8,3 (1–21) | 16 |
| S | 1,34 (0–4) | 1 |
| « 5 contre 2 » / villes trop proches | 0 / 0 | 0 / 0 |
| Chaîne du rythme | **4,67** (3–5) | 9 |
| distMax | 2,03 | 4 |
| Points d'articulation | 0 | 0 |
| Raccords morts | 2 (murs de LC4) | 2 |
| Montable avec la boîte | 100 % | — |

## Points soumis à l'utilisateur
1. **Chaîne du rythme :** 4,67 en moyenne, au-dessus de la cible de 3. Faut-il revoir la cible pour le 5×5 ?
2. **Composition toujours identique :** 3 LC1, 2 LC2, 3 LC3, 1 LC4. Avec un tirage au poids, on obtenait 0,5 % de plateaux montables et 9 placements différents ; avec les quotas, 100 % et 47. La variété ne vient donc que des positions et des rotations. Faut-il un tirage plus libre, avec plus de tuiles à imprimer ?
3. **Documents qui gardent les anciennes tuiles 5×5 :** le générateur 5×5 y abandonne et conseille le nouveau catalogue.
4. **Les 2 alertes « raccord mort »** des murs de « Deux ponts » sur chaque plateau : les présenter autrement ?
5. **« Placer les villes » en 4×4 :** le garder ?
