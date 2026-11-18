# Centrale 5×5 « Étoile » (LE1) (sous-agent dev-web, Sonnet), 2026-10-19

Décision : fin de `18`. Image : `docs/croquis/etoile-5x5.png`.

## Vérification de l'orchestrateur
- `node --test` : 750 tests, 0 échec.
- Recettes : 365 et 125 OK.

## Contenu
- **Forme** : un relais en (50,50) avec 4 raccords au milieu des côtés, et 4 cases de diagonale en (30,30), (70,30), (70,70) et (30,70), chacune reliée au relais et portant le port de son coin. Aucune erreur ni alerte.
- **Exception « 2 cases au plus »** : cette règle n'existe que dans les tests du catalogue. L'exception y est nommée `EXCEPTIONS_CASES = { LE1: 5 }`. Les tuiles de l'utilisateur n'ont jamais eu cette limite.
- **Jamais tirée** : nouveau drapeau `horsTirage: true`. Le générateur l'écarte (`modelesParGabarit`), la sauvegarde le conserve (seule la valeur `true` est gardée), et il est exclu de la signature.
  - Empreintes du générateur identiques avant et après : 60 graines en 4×4, 40 en 5×5.
- **Au centre avec les 8 villes fixes** : testé sur 40 plateaux, sans alerte ni villes trop proches, avec 3 ou 4 ports par ville.
- **Impression** : 31 tuiles, soit 6 planches A3 (la dernière avec 1 tuile) ou 16 A4.

## À savoir
- La vignette de la bibliothèque n'indique pas que la tuile est hors tirage.
- Les anciens documents 5×5 n'ont pas l'Étoile tant que l'utilisateur ne charge pas le nouveau catalogue.
