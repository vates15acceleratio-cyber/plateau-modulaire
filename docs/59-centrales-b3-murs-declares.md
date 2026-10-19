# Centrales 5×5 « B3 » et murs déclarés seulement (sous-agent de production, Sonnet 5.5), 2026-10-18

Rapport du sous-agent, consigné et condensé par l'orchestrateur. Résultats :
- `node --test` : 702 tests, 695 OK, 0 échec, 7 ignorés (vérifié par l'orchestrateur) ;
- recettes navigateur : 358 OK et 116 OK, 0 échec.

## Changements
- **Catalogue 5×5 « B3 » :**
  - centrales : LC1 ×2, LC2 ×1, LC3 ×3, LC4 ×1, **LC5 ×2, LC6 ×1, LC7 ×2** ;
  - bords et coins : LB2 ×12, LK2 ×4 ;
  - en tout **28 tuiles** (5 planches A3 ou 14 A4), avec poids = exemplaires ;
  - LC4 « Deux ponts » déclare `murs: [1, 3]`.
- **Murs déclarés seulement :** `mursDuModele` ne retient plus que les côtés listés dans `murs`. Un ancien document (par exemple C5 « Étoile fermée » de la 3.04) et les tuiles de l'utilisateur gardent leurs **alertes**, et un test le vérifie.
- **Compteurs 5×5 :**
  - la cible de cases passe à ≈ 57 ;
  - « Tuiles sans case » remplace « Tuiles à moins de 2 cases », car LC5 n'a qu'une case (arbitrage de l'orchestrateur : accepté) ;
  - le 4×4 ne change pas.
- **Tests, recettes et documentation :**
  - tests et recettes adaptés : composition, 28 tuiles, ≈ 57 cases, murs ;
  - documentation mise à jour : README, `4`, `10`, `25`.

## Mesures B3 (vrai générateur, 200 plateaux)

| Mesure | Mesuré | Annoncé en `58` |
|---|---|---|
| Réussite | 100 % | 100 % |
| Cases | ≈ 57,3 (57 ou 58) | 57,2 |
| Cases à ≤ 2 connexions | 2,1 % (100 % des plateaux sous 5 %) | 2,44 % |
| Degré moyen | 3,72 | 3,74 |
| Placements admissibles | 5,7 (1–14) | 4,9 |
| Placements de villes différents | 48 | 40 |
| S moyen | 1,37 | 1,69 |
| Chaîne (jonctions comptées) | 1,75 | 1,75 |
| Murs (informations) | 1,49 (LC4 sur 75 % des plateaux) | 1,03 |
| Goulets | 0 | 0 |
| **Compositions de centrales différentes** | **30** | 32 |
| Montable avec la boîte | 100 % | 100 % |
| « 5 contre 2 » / villes trop proches | 0 / 0 | 0 / 0 |
| Temps par plateau | 1,2 s | 1,9 s |

**LC4 sort plus souvent que dans la mesure de `58`.** Le générateur ne pénalise plus les murs, alors que l'advisor avait mesuré une version qui les pénalisait encore. LC4 est donc posé sur 75 % des plateaux au lieu d'environ 50 %.

## Points pour la relecture
- **Remplacements de tuiles.** `equilibrerMoities` (`remplacants` en 5×5) n'est pas borné par le stock. Sur 72 378 compositions mesurées, il n'y a eu aucun remplacement et aucun dépassement du stock. C'est mesuré, pas garanti.
- **Seuils de test assouplis.**
  - Le taux d'acceptation des candidats passe de 0,8 à 0,5 (63 % mesuré, surtout des rejets `villes_ports`, sans effet sur la réussite).
  - `tirerPlateaux5x5` passe de 15 à 10 plateaux sur 20.
  - `jonctionsFaibles === faibles` devient `<=`.
- **Cases de tuile faibles.** On en compte 21 contre 99 jonctions-cases sur 100 plateaux. C'est surtout le relais de LC6 ou LC7 face à un mur de LC4.
