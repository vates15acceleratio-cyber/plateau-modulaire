# Avis géométrie : tuiles 5×5 à deux cases (advisor, Opus 5.5), 2026-10-18

Rapport de l'advisor, consigné et condensé par l'orchestrateur. Tous les chiffres viennent du code du dépôt (`validerModele`, `problemesTrace`, `reglesPassages`, `PM.graphe`). Fichiers dans le dossier temporaire de la session : `advisor-geo-connexions/` (`modeles-5x5-deux-cases.js`, `T3-document.json`, scripts et sorties).

## À retenir
1. **Une famille à 2 cases par tuile tient dans 100 mm.**
   - 9 modèles complets : 0 erreur, aucun problème de tracé, aucun raccord mort, aucune paire miroir.
   - Sur un plateau témoin, toutes les cases des tuiles ont **3 connexions ou plus**.
   - 55 à 56 liens entre tuiles, contre 31 en 4.00.0.
2. **Le blocage vient des règles, pas du dessin.**
   - Deux jonctions voisines se retrouvent à **3 pas**.
   - Le plus grand ensemble de jonctions deux à deux à 4 pas ou plus compte 6 jonctions sur un plateau monté à la main (16 en 4.00.0).
   - Le plateau T3, trouvé par une recherche de 4 minutes, atteint 7 jonctions, mais avec **un seul placement de villes**.
3. **En gardant « un port par case » (R1), la cible oblige à lever R4 sur les bords :** l'apparition doit porter un port.
   - **Avec R4 gardée** (T2) : 11,9 % de cases à 2 connexions, et des villes à 2 accès.
   - **Sans R4** (T1, T3) : 3,4 à 6,8 % de cases à 2 connexions, mais 3 villes par camp à 1 pas d'une apparition sur T3.

## Standard de côtés proposé
- Les centrales et le côté S des bords gardent un raccord au milieu des côtés.
- **Les côtés latéraux du pourtour ont deux paires de raccords :**
  - paire haute, celle du raccourci actuel : E0 + O2 ;
  - paire basse, nouvelle : E2 + O0.
- Un raccord à 30 ou 70 mm sur les centrales est faisable, mais il obligerait à changer tout le catalogue d'un coup. Non retenu.

## Modèles (coordonnées en mm, cases Ø 20)

| Id | Nom | Cases | Connexions plateau | Règles enfreintes | Marge |
|---|---|---|---|---|---|
| DK1 | Coin à deux | a (40,40) apparition ; c (75,75) port SE | 3 / 4 | R3 ; paire basse | 4,57 |
| DK2 | Coin direct (option) | a (74,74) apparition + port | ≈ 3 | R3, R4 ; ancien K1 | 4,11 |
| DB1 | Bord double | a (26,62) apparition + port SO ; c (74,78) port SE | 5 / 4–5 | R2, R3, R4 ; paire basse | **2,56** (sous le plancher de 2,7) |
| DB2 | Bord à relais bas | a (57,38) apparition ; c (71,66) port SE | 3 / 5–6 | R3 ; paire basse (R4 respectée) | 2,73 |
| DC1 | Pont à deux | (30,30) port NO ; (70,70) port SE | 4 / 4–5 | R2, R3 | 11,8 |
| DC2 | Équerre à deux | (26,50) port NO ; (66,33) port NE | 4 / 4–5 | R2, R3 | 9,66 |
| DC3 | Virage à deux | (42,27) port NO ; (73,58) port SE ; quart de tour S1–O1 | 3 / 3 | R2, R3 | 13,0 |
| DC4 | T à deux | (38,28) port NO ; (72,62) port SE ; pivot (38,73) | 3 / 5 | R2, R3, porteuse touchant un passage | 13,36 |
| DC5 | Carrefour (option) | (42,42) port NO + 4 raccords | ≈ 5 | R3 | 5,80 |

Ce que la famille respecte toujours :
- aucun passage traversant, aucun passage vers un coin, aucun passage partant d'une apparition ;
- aucun mur, aucune poche, aucune paire miroir ;
- R1 (un port par case) partout.

## Plateaux témoins

| | T1 (12 DB1, à la main) | T2 (12 DB2) | T3 (12 DB1, recherche) | 4.00.0 |
|---|---|---|---|---|
| Cases | 59 | 59 | 59 | 80,5 |
| Cases à 2 connexions | 6,8 % | 11,9 % | **3,4 %** | 66,5 % |
| Ports | 46 | 34 | 46 | — |
| Ports des villes | 3–4 | **2** | 3 | — |
| Écart minimal entre jonctions | 3 pas | 3 pas | 3 pas | 4 pas |
| Placements de 7 villes admissibles | **0** | 0 | **1** | — |
| Liens entre tuiles | 56 | 56 | 55 | 31 |

## Impossibilités
1. **Avec R1, R2 et R3 et 2 cases par tuile, une case porteuse a au plus 2 connexions.** Pour en avoir 3, il faut lever R3, ou laisser la porteuse toucher un passage.
2. **Les connexions d'une jonction-case sont ses ports.** Avec R1, on a au plus 46 ports ; avec R4 en plus, au plus 34. Il en faudrait 48 pour que toutes les jonctions aient 3 connexions. « Moins de 5 % » revient donc à 2 jonctions-cases à 2 ports au plus, avec une répartition parfaite.
3. **Une tuile qui nourrit deux jonctions les met à 3 pas.** L'écart de 3 cases entre villes ne peut plus être garanti par les tuiles : il faut le contrôler globalement au placement. Un écart de 2 cases, lui, reste garanti.
4. **Géométrie :**
   - une case doit être à 30 mm au moins des coins ;
   - deux chemins partant d'une même case doivent faire environ 33° entre eux ;
   - une apparition à port sous la paire basse est impossible ;
   - un bord à une seule case portant les deux paires tient à 0,72 mm de marge, ce qui n'est pas imprimable ;
   - un coin ne donne qu'un port.

## Risques
- **Sans R4 :** tempo très rapide.
- **Placements de villes :** souvent aucun. Le générateur devrait chercher toutes les orientations (262 144, environ 1 s) et faire une recherche globale du placement des villes. L'autre voie est de ramener l'écart à 2 cases.
- **Marge de DB1 :** à faire contrôler par l'advisor prépresse.
- **La paire basse :** elle transforme le raccourci en deux rails parallèles. Elle est incompatible avec les anciennes tuiles, donc tout le catalogue 5×5 serait à remplacer.
- **59 cases**, contre 78 à 81 décidés.
- **Code et tests :** règles R1 à R4 et `reglesPassages` à adapter au format.

> **Note de l'orchestrateur.** Cet avis et `53` divergent. `53` garde R4 et lève R1 : une « porteuse latérale » à 2 ports, sur les coins d'un même côté. Il obtient 3 % de cases à 2 connexions, mais sur un modèle abstrait aux coordonnées fictives. Cet avis-ci garde R1 et doit lever R4. Une vérification géométrique du cadre de `53` est demandée à l'advisor géométrie.
