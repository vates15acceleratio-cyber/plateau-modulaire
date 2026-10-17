# Avis géométrie : passages sans case (advisor, 2026-10-17)

Entrée : fin de `docs/18-decisions-v2.md`, croquis.

1. **Modèle** : `chemins` inchangé ; deux tableaux optionnels par modèle : `pivots: [{id, x, y}]` (points de ramification sans case) et `passages: [{id, a, b, courbe?}]` avec la nouvelle extrémité `{pivot}`. Permis : raccord–raccord, raccord–case, raccord–pivot, case–pivot (T = pivot de degré 3, au plus 3). Interdits : passage–coin, case–case (c'est un chemin droit), deux passages sur un même raccord, raccord partagé par un chemin et un passage. Les raccords des passages entrent dans le masque (appariement inchangé).
2. **Graphe** : union-find (raccords appariés, pivots, cases) ; chaque composante relie ses cases deux à deux à **1 pas** (clique, au plus 4 cases) ; aucun nœud d'arrêt ajouté.
3. **Écart entre villes** : règles étendues en **alertes** (une porteuse ne touche jamais un passage ; pas de passage depuis une case d'apparition ; les cases reliées par passage ne comptent pas pour « porteuses reliées ») ; garantie réelle par le contrôle global (`villesProches`) ; catalogue et générateur la respectent ; mesures à refaire.
4. **Tracé** : courbes pour les passages seulement (quadratique entre côtés adjacents, droit entre côtés opposés, demi-cercle sur un même côté, poignée modifiable) ; **rendu proposé** : tube blanc à bord noir et filet central tireté (lisible en noir et blanc ; le bleu n'est pas dans la palette d'impression) ; distances : 8 mm aux chemins, r + 4 + L/2 aux cases, rayon ≥ 10 mm, hors zone de coin ; **aucun croisement** (le pivot est le seul point de rencontre).
5. **Éditeur** : outil Passage (raccord ou case → raccord ou case), poignée de courbe, Maj + clic pour créer un pivot (T) ; erreurs bloquantes et alertes.
6. **Compatibilité** : tableaux absents = vides, anciens documents intacts ; export PDF en courbes ; catalogues 4×4 et 5×5 à redessiner, mesures et seuils à refaire.

## Divergences avec l'avis design (`38`) à trancher
- **Passage relié à un coin (port)** : design oui (un coin par passage), géométrie non.
- **Passages sur les bords et les coins** : design oui (variante à passage), géométrie : pas depuis une case d'apparition.
- **Apparence** des passages à l'impression : tube blanc tireté (géométrie) ou autre.
