# Avis design de jeu : seuils du 4×4 v2 et cadrage du 5×5 (advisor, Sonnet 5.5), 2026-10-16

Entrée : `21-mesures-catalogue-v2.md`. (Opus indisponible jusqu'au 18 octobre : advisor en Sonnet.)

1. **Seuils définitifs 4×4** : blocage = « 5 contre 2 » **ou** écart > 3 à un rang (inchangé) ; alertes = écart > 2 à un rang, **S ≥ 5** (au lieu de S ≥ 4 : 12,9 % des configurations, trop bruyant ; S ≥ 5 : 3,2 %) ; S = 4 en simple information. Le message « 5 contre 2 » conseille la rangée centrale pour les jonctions-cases.
2. **Générateur** : par défaut, jonctions-cases dans la **rangée centrale** (paires (1,2)+(2,2), (1,2)+(3,2), (2,2)+(3,2), tirage au hasard : 0 % de « 5 contre 2 », S moyen 1,2 à 1,4) ; option « jonctions variées » décochée : choix libre parmi les 36 combinaisons **sauf les 6 paires d'une même rangée extérieure**, classé par S.
3. **Murs** : **supprimer B2** (bord fermé), **B1 en 6 exemplaires** (raccords morts 1,41 → ≈ 0,68 par plateau, 60,5 cases) ; garder C5 (un seul mur possible, goulet intéressant).
4. **« 4 contre 3 »** (30 %) : aucune alerte, confirmé.
5. **5×5** : 30 tuiles (11 centrales de 3 à 5 cases, 14 bords, 5 coins), **75 ± 3 cases**, R1 à R4 et raccourcis d'apparition, plus de relais qu'en 4×4 ; seuils provisoires identiques au 4×4 ; à mesurer sur 1000 plateaux : cases et écart minimal (4 pas), S, écart max, « 5 contre 2 », placement des jonctions-cases, tempo, pourtour, goulets, raccords morts, jeu entre chemins (≥ 8 mm) ; S d'alerte à fixer au 95e centile des plateaux acceptés.
