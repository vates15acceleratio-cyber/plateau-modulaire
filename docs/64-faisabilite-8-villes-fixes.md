# Faisabilité des 8 villes fixes en 5×5 (agent générateur, temps 1), 2026-10-19

Motif demandé : (1,1) (4,1) (2,2) (3,2) (2,3) (3,3) (1,4) (4,4), avec le catalogue B3. Script : `outils/mesures-8-villes-fixes.js` (`node outils/mesures-8-villes-fixes.js 300 300`).

## Résultat : impossible par construction avec B3
- La centrale du milieu a ses 4 coins sur les 4 villes du carré central.
- Toutes les centrales B3 (LC1 à LC7) ont leurs 2 ports sur **une seule case**, qui dessert deux coins voisins. Toutes les orientations ont été testées.
- Deux villes voisines du carré central sont donc toujours à 2 pas, soit **1 case d'écart**. C'est moins que les 3 cases demandées par la règle, et moins que les 2 cases tolérées.
- La règle des 3 ports aggrave le problème : il faut 12 ports vers le carré central, et sans case partagée entre deux villes, on n'en obtient pas plus de 10.

| Règle | Plateaux réussis sur 300 |
|---|---|
| (a) 3 cases partout | 0 |
| (b) 2 cases au carré central | 0 |

## Variantes mesurées (hors des règles décidées)
| Variante | Résultat |
|---|---|
| 1 case tolérée pour **une seule** paire du carré central | 100 plateaux sur 100 ; environ 3,5 s par plateau avec le prototype ; LC4 interdit au milieu |
| 1 case tolérée pour les **4 paires** du carré central | 100 sur 100 ; environ 0,8 s ; 1 à 2 paires à 1 case par plateau |
| LC4 au milieu | toujours au moins 2 paires à 1 case |

## Options soumises à l'utilisateur
1. Tolérer 1 case pour une seule paire du carré central.
2. Tolérer 1 case pour les paires du carré central (1 à 2 par plateau).
3. Revoir le motif : les damiers du `62` évitent le problème. Les coordonnées actuelles viennent de la lecture de l'image par l'orchestrateur.
4. Ajouter une centrale réservée au milieu, dont les ports vers deux coins voisins passent par deux cases différentes. Cela demande un avis géométrie et une mesure des 12 ports.

Le temps 2 (production) n'est pas codé.
