# Catalogues organiques 4×4 et 5×5 : proposition en images (sous-agent dev-web), 2026-10-17

Statut : **proposition, non branchée**. On attend l'avis de l'utilisateur sur les images avant de brancher et de mesurer, selon la décision du `18`.

## Fichiers
- Modèles candidats : `outils/catalogue-organique.js` (`PM.catalogueOrganique`).
- Script des images : `outils/planche-organique.js`. Il se lance par `node outils/planche-organique.js` et utilise le vrai rendu de `src/rendu.js`.
- Images : `docs/croquis/organique/`, soit `planche-4x4.png`, `planche-5x5.png` et les plateaux `plateau-4x4-A/B`, `plateau-5x5-A/B`. Les fiches et les mesures sont dans `mesures.json`.

## Modèles
- **4×4** : 13 modèles, 22 tuiles.
  - Centrales : O1 Virage double, O2 Double virage (2 passages), O3 T sans case (T, 3 passages), O4 Traversant droit, O5 Traversant courbe, O6 Demi-tour, O7 Boucle, O8 Couloir.
  - Bords : B1 ×6, B8 Bord à virage ×2 (remplace B3), B6 ×1. B3, B4 et B5 sont retirés.
  - Coins : K2 ×4, K4 ×1.
- **5×5** : 10 modèles, 30 tuiles.
  - Centrales : P1 Virage double ×3, P2 Équerre à virage ×3, P3 T sans case ×2, P4 T droit ×1 (traversant droit), P5 Double virage ×1, P6 Boucle ×1.
  - Bords : B1 ×6, B7 ×6 (**B7m retiré**), B9 Bord à virage ×2.
  - Coins : K2 ×5.
  - P0 « T pur » (sans case) a été dessiné pour information. Il n'est pas imprimé : c'est un mur, sans port.
- Les 24 modèles passent `validerModele` (0 blocage, 0 alerte) et les contrôles de tracé des tests.

## Plateaux d'exemple
| Plateau | Cases | Ports (min. par jonction) | Écart entre villes | S |
|---|---|---|---|---|
| 4×4-A, strict | 62 | 30 (3) | 4 pas | 0 (méd. 2) |
| 4×4-B, variantes | 62 | 32 (3) | 4 pas | 0 (méd. 1) |
| 5×5-A, strict | **80** | 39 (2) | 4 pas | 2 |
| 5×5-B, variante P4 | 78 | 40 (2) | 4 pas | 1 |

Les quatre plateaux sont connexes, sans raccord mort et sans alerte d'équilibre.

## Constat de l'orchestrateur (images regardées)
- L'aspect est nettement organique : quarts de tour, T, couloirs, plus de quadrillage. Aucune zone isolée.
- Un T pur sans case est impossible sans faire un mur. Les « T sans case » retenus ont donc des cases au bout de leurs branches, comme sur le croquis de l'utilisateur. Le compteur « Tuiles à moins de 2 cases » reste inchangé.
- Aucun coin à passage : les deux seuls raccords utiles d'un coin forment le raccourci, qui part de l'apparition.

## Questions soumises à l'utilisateur
1. **Passage traversant** d'un côté à l'autre (O4, O5, P4) : permis ou non ?
2. **4×4** : plafond d'un passage par centrale ? Si oui, O2 et O3 sortent.
3. **Densité 5×5** : deux options.
   - 6 B1 : 78 à 80 cases, toutes les villes sur des jonctions à 3 ports.
   - 4 à 5 B1 : 75 à 77 cases, mais des villes sur des jonctions à 2 ports.
4. **Apparitions reliées à un réseau de passages au niveau du plateau.** Le raccord S d'un bord part de l'apparition ; face au passage d'une centrale, l'apparition devient voisine à 1 pas de ce réseau. Deux options :
   - l'accepter ;
   - faire partir ce raccord d'un relais, ce qui coûte une case par bord.
