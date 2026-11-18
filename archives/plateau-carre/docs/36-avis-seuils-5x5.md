# Avis design de jeu : seuils définitifs du 5×5 (advisor, 2026-10-17)

Entrées : `docs/28`, `docs/34`, `docs/35` (mesures sur 1000 plateaux).

1. **Seuils 5×5 définitifs (inchangés)** : blocage « 5 contre 2 » (6,9 % en pose libre, 0 % au générateur) ou écart > 3 ; alertes écart > 2, **S ≥ 5** (95e centile = 5, 5,6 % hors blocages), première ville inégale, jonction à < 2 ports ; information S = 4 (15,3 %) et tempo ; aucune alerte pour « 4 contre 3 ». **Ajout** : « ville sur jonction à < 3 ports » en **information** seulement. Une constante S = 5 partagée par le générateur et l'interface.
2. **Rejet S ≥ 5 dans le générateur 5×5 : gardé** (0,6 % des essais) : un plateau généré n'affiche jamais d'alerte. Retirer « provisoire ».
3. **B1 forcés sur la rangée neutre : gardé** (sans placement admissible 1,9 % contre 7,3 % ; variété identique).
4. **Villes vers les flancs** (70 % colonnes 1 et 4, 7 % au centre) : **acceptable** (cause structurelle : peu de ports aux jonctions centrales ; pas d'effet sur l'équilibre). **Point de vigilance pour l'utilisateur** : le pourtour est plus court que le centre dans 95,5 % des cas ; les 9 tuiles centrales risquent de n'être qu'un décor → « rôle des centrales », à traiter avec les régions thématiques.
5. **Conseil de pose libre** conditionnel, joint aux messages « 5 contre 2 » et S ≥ 5, seulement si le squelette 2-3-2 est respecté et que les 3 villes du milieu sont sur une seule rangée : « Les 3 villes du milieu sont sur une seule rangée : en mettre 2 sur l'une et 1 sur l'autre rétablit presque toujours l'équilibre. »
6. **Diversité** (25 profils, 332 placements de villes) : suffisante pour livrer. Pour plus tard, après accord de l'utilisateur : une centrale à 3 ou 4 ports vers les jonctions centrales, un bord de plus (B3 ou B8) ; compenser les cases (déjà 77–78).
7. **Seuils du 4×4 : gardés tels quels** (« 5 contre 2 » 4,1 %, S ≥ 5 4,3 %, filets rares) ; mêmes seuils dans les deux formats.

À soumettre à l'utilisateur : **tempo 5×5** (4,75 villes sur 7 à ≤ 3 pas, contre 5,7 en 4×4) et **rôle des centrales**.
