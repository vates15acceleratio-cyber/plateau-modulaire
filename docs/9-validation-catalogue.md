# Validation du catalogue par l'advisor design de jeu (Opus 5.5), 2026-10-15

**Verdict : accepté avec retouches.** Conforme à D2–D7 et à la synthèse (composition, ports, écart ≥ 3, connexité, sorties d'apparition, flancs).

## Retouches demandées (confiées au sous-agent catalogue)
1. C2 : retirer `r5` (O pos 0, mort à coup sûr : un côté de centrale ne rencontre que des pos 1).
2. K4 : retirer `r3` (E pos 2).
3. B5 : retirer `r3` (O pos 0) et décaler la case haute vers ≈ (32, 40).
4. B2 : décaler la case haute vers ≈ (88, 40) (silhouettes de bords asymétriques).
5. Tests : seule variante = le côté ouest vide de C6 (un « mur » qui crée un goulet, voulu) ; seuils raccords morts **moyenne ≤ 1,5, max ≤ 2**.
6. Facultatif, à mesurer : second mur (C5 sans `r4`) ; cases des centrales décalées le long de la bissectrice (≈ 32 à 44 mm).

Rejeté : la piste « tout ou rien » du pourtour (double liaison = risque d'autoroute de flanc, faisabilité non prouvée). Un raccord mort est acceptable s'il a un sens de jeu (mur), pas comme bruit.

## Règles pour le générateur (sous-agent 8) et les contrôles (sous-agent 4)
- **Carrefours** : générateur → (1,2)+(3,2) par défaut (répartition 3 / 1 / 3 : « 5 contre 2 » impossible) ; autre paire permise seulement si le candidat n'a aucune alerte D6. Mode manuel → toute paire sauf « même côté », avec alerte D6, sans blocage.
- **Apparitions** : règle « un A1 et un A2 par joueur, en symétrie centrale » seulement si la mesure 3 ci-dessous montre un écart réel.

## Mesures à demander au sous-agent 7 (graphe / équilibre)
1. Villes **non traversables** (destination seulement) : refaire écart min, D6, 5 contre 2, flancs, et comparer.
2. Balayage de **toutes les paires de carrefours** permises : taux de 5 contre 2, histogramme D6.
3. D6 conditionné aux tirages d'apparitions (A1A1 / A2A2, A1A2 / A1A2).
4. Sensibilité **par modèle** (écart moyen et alertes quand le modèle est présent).
5. **Tempo** : villes atteignables en 3, 4, 5 pas par joueur ; écart sur la première ville ; villes à égalité.
6. **Goulets** : chemins disjoints apparition → ville ; points d'articulation.
7. **Diversité** : nombre de profils de distances distincts sur 1000 plateaux.
8. Mesures sur la **sortie du générateur** (meilleur de 200), et ports de coin morts des formes réduites.
9. Histogramme de l'écart D6 (le seuil « > 2 » ne se déclenche jamais : discrimine-t-il ?).
