# Revue du générateur et des seuils 5×5 (relecteur, 2026-10-17)

**Verdict : aucun bloquant** ; version et fusion possibles après I1 et I2. Vérifié conforme : reproductibilité par graine, orientation exhaustive et bornée (élagage correct), villes 2-3-2 et chaîne de rejets, 4×4 inchangé, robustesse aux bibliothèques modifiées.

## Important
- **I1** : gel de l'interface sur une bibliothèque impossible (ex. 5×5 sans B1 : 1000 essais, 10,7 s) ; calcul synchrone. → abandon après N échecs structurels consécutifs (`jonction_ports` / `villes_ports`) ; à terme, génération par tranches.
- **I2** : `PM.graphe.flancs` prend les colonnes 1 et 3 comme « centre » en 5×5 (oublie la colonne 2) → `col >= 1 && col <= colonnes − 2` (4×4 inchangé) ; les outils de mesure peuvent alors appeler `GR.flancs` ; chiffres de `docs/35` inchangés (copie correcte dans les outils).
- **I3** : substitution de bord trop générique (tout bord de même taille remplace le bord tiré) → n'accepter que les vrais miroirs.

## Mineur
M1 constantes dupliquées (ports minimum des villes, squelette 2-3-2, littéraux dans les outils) → exporter depuis `PM.graphe` ; M2 chaîne de filtres écrite 3 fois → `causeRejet` commun ; M3 budget de nœuds dépassé non signalé ; M4 code mort dans le chemin 5×5, cache mutable des placements ; M5 B1 repéré par son id (à documenter) ; M6 textes périmés (tests, `docs/34`, `docs/4`) ; M7 `candidats` non borné.
