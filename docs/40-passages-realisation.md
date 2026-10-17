# Passages sans case : réalisation (sous-agent dev-web), 2026-10-17

Branche `passages`. Spécification : `39-avis-geometrie-passages.md` et décisions de l'utilisateur (`18-decisions-v2.md`, fin de fichier). Catalogues non modifiés (refonte à suivre).

## Vérification de l'orchestrateur
- `node --test` : **601 tests, 0 échec** (572 avant, 29 nouveaux dans `tests/passages.test.js`).
- `recette-interface.html` : **310 OK, 0 ÉCHEC** (nouveau scénario S10) ; `recette-p2.html` : **116 OK, 0 ÉCHEC**.
- Anciens documents : empreintes avant / après identiques (générateurs 4×4 et 5×5 sur 6 graines, SVG du catalogue en 4 rotations, `tuileEnPlateau`, PDF) ; un test en rejoue 3 graines par format.

## Ce qui a été fait
1. **Modèle** (`modele.js`) : tableaux facultatifs `pivots` et `passages` ; les anciens modèles gardent exactement leurs clés. Raccords des passages dans les masques ; `case_isolee`, `poche`, `reseau_sans_sortie` en tiennent compte. Plafonds de sauvegarde : 32 pivots, 64 passages.
   - Blocages : `passage_coin`, `passage_case_case`, `raccord_double`, `passage_boucle`, `passage_double`, `pivot_degre` (> 3), `passages_croises`, `passage_chemin_croise`, `passage_case`, `passage_zone_coin` ; ajoutés par le sous-agent : `passage_hors_tuile`, `pivot_hors_tuile`, `passage_courbe`, `passage_invalide`, `passage_inconnu`, `pivot_invalide`.
   - Alertes : `porteuse_passage`, `passage_apparition`, `passages_bord`, `pivot_degre_faible`, `reseau_passages_grand` (> 4 cases), `passages_proches`, `passage_chemin_proche`, `passage_rayon`.
2. **Graphe** (`graphe.js`) : union-find sur les raccords de passages et les pivots ; les cases d'une composante sont voisines à 1 pas (clique), sans nœud d'arrêt ; une case à deux sorties ne rapproche pas ses voisins. `villesProches`, `equilibre`, `goulets` et le générateur suivent sans changement.
3. **Rendu** (`geometrie.js` `tracesPassages`, `rendu.js`) : passages verts de 8 mm, arrivée perpendiculaire aux raccords ; côtés adjacents = quart de tour, opposés = droit, même côté = demi-cercle ; disque de 8 mm sur les pivots.
4. **PDF** (`export.js`) : commandes `Q` et `C` (opérateur `c`), vérifié avec PyMuPDF.
5. **Éditeur** (`editeur-tuile.js`, `aide.js`, CSS) : bouton « Outil : Chemin / Passage » et touche P ; Maj + clic = pivot ; poignée de courbe (double-clic = courbe par défaut) ; Suppr emporte les passages ; légende « Commandes » complétée.

## Arbitrages de l'orchestrateur sur les écarts signalés
- **8 mm entre passages et rayon ≥ 10 mm en alertes** (et non en blocages) : **accepté**. Tolérance de 0,5 mm sur le rayon (le demi-cercle du 5×5 mesure 9,92 mm après approximation) : accepté.
- **« Un passage au plus sur un bord ou un coin » compté par réseau** (un T = 1) : **accepté**, conforme à l'esprit de la décision (une seule liaison sans case par tuile de bord).
- **Forme par défaut raccord → case adoucie**, exemption de 16 mm autour d'un pivot pour l'alerte d'écart, pivot imprimé par son seul disque vert : acceptés.
- **Tuile faite seulement de passages** (sans case) : signalée par le compteur « Tuiles à moins de 2 cases ». À trancher avec la refonte des catalogues (une centrale « T sans case » est prévue par `38`) : le compteur devra l'exempter si le modèle est retenu.

## Non vérifié
Gestes réels à la souris (seuls des événements synthétiques ont tourné) ; `index.html` avec sa CSP en navigateur (aucun style ni script en ligne ajouté, contrôlé sur le diff) ; capture du rendu 5×5 des passages.
