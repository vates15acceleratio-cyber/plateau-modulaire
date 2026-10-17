# Générateur 5×5 (sous-agent, Sonnet 5.5), 2026-10-17

Branche `generateur-5x5`. Mission : `docs/25` § 1.2 et `docs/24` § 8.

## Conception
- **Chemin 5×5 séparé** dans `src/generateur.js` ; le **4×4 est inchangé** (41 empreintes identiques avant / après, embarquées dans les tests).
- **B1** : 5 ou 6 par plateau ; posés d'abord sur les bords de la rangée neutre (0,2) et (4,2), puis au hasard sur les autres bords.
- **Orientation des centrales** (et miroir B7 ↔ B7m) par exploration complète avec élagage. Priorités : toutes les jonctions à ≥ 2 ports (condition ferme) ; 7 villes possibles en 2-3-2 sur jonctions à ≥ 3 ports ; maximum de jonctions à ≥ 3 ports ; équilibre des ports nord / sud. Budget jamais atteint (max 477 378 nœuds sur 1000 tirages).
- **Villes en 2-3-2** : les 2016 placements sont énumérés, filtrés (≥ 3 ports), triés par S puis par la présence d'une ville équidistante (7e ville équidistante : 100 % des plateaux à 200 candidats).
- `pairesJonctionsCases` ne renvoie plus `null` en 5×5 (2016 listes de 9 jonctions-cases) ; option « jonctions variées » masquée en 5×5 (sans objet).
- **Rejets** : `jonction_ports`, `villes_ports`, `desequilibre` (« 5 contre 2 » ou écart > 3), `ecart` (> 2), `premiere_ville`, `score_s` (S ≥ 5, définitif, `docs/36`), `ville_inaccessible`, connexité, villes proches. « 4 contre 3 » : aucune alerte.

## Mesures rapides (pas encore les 1000 plateaux)
- 200 candidats : ≈ 1,3 s ; ≈ 7 ms par candidat.
- 1000 graines à 1 candidat : 97 % acceptés ; rejets : 15 `villes_ports`, 9 `desequilibre`, 6 `score_s`, 0 `jonction_ports`. 469 plateaux à 5 B1, 501 à 6 B1.
- Jonctions à ≥ 3 ports : 7 (52 %) ou 8 (48 %) ; toujours ≥ 2 ports partout. Rotation au hasard : plus d'un tiers des plateaux auraient une jonction à < 2 ports.
- Tests à l'écriture de ce document : 536 (dont `tests/generateur-5x5.test.js`, 12 tests sur 200 graines) ; recettes 250 et 116 OK. Après les corrections de `docs/37` : 572 tests (0 échec, 0 todo, 0 ignoré) ; recettes 289 et 116 OK, 0 échec.

## Arbitrages de l'orchestrateur
Les arbitrages 1 à 3 sont **confirmés par `docs/36`** (S ≥ 5 définitif, B1 forcés gardés, villes vers les flancs acceptable).

1. **S ≥ 5 rejeté en 5×5** : gardé (coût 0,6 % des tirages) ; confirmé comme définitif par `docs/36`.
2. **B1 systématiques sur (0,2) et (4,2)** : gardé (c'est la préférence de `docs/24` § 8 appliquée pleinement) ; à reconsidérer si les mesures montrent un manque de variété.
3. **Tendance des villes vers les flancs** (colonnes 1 et 4) avec le placement au meilleur S : à vérifier dans les mesures (point 5 de `docs/28` : 7e ville sur chacune des 8 jonctions du milieu).
