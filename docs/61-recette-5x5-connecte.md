# Recette du 5×5 très connecté (testeur, Sonnet 5.5), 2026-10-18

Rapport du testeur, consigné et condensé par l'orchestrateur. Résultats :
- `node --test` : 740 tests, 732 OK, 0 échec, 8 ignorés (7 PDF et 1 défaut), en 71 s ;
- recettes navigateur : 358 OK et 116 OK, 0 échec.

## Tests ajoutés : `tests/testeur-5x5-connecte.test.js` (38 tests)
- **A. Règles des porteuses 5×5.**
  - Refusés : un raccord hors du milieu du côté, des ports en diagonale, 3 ou 4 ports, une porteuse qui touche un passage.
  - Paire basse du coin.
  - Les mêmes tuiles validées en 4×4 gardent leurs alertes.
- **B. Éditeur 5×5.** « Dupliquer » LC4 garde le champ `murs`, et un raccord posé sur un côté déclaré mur annule ce mur.
- **C. `connexions`.** Plateaux vide, partiel, non connexe, 4×4, modèles absents ; avec et sans villes ; seuil de 5 %.
- **D. `placerVilles`.**
  - Plateau incomplet, ou aucun placement possible : refus expliqué.
  - Ctrl+Z et Ctrl+Y fonctionnent.
  - Le résultat est stable et l'écart de 3 cases est respecté.
- **E. `murs`.**
  - JSON hostile : `[5]`, `"1"`, doublons, `__proto__`, sans aucune pollution.
  - Mur tourné, mur face à un mur, mur sur un bord.
- **F. `informations`.** Présentes partout. Les contrôles, le rapport et la relecture les lisent, sans jamais les compter comme alertes.
- **G. Générateur sur une bibliothèque modifiée.**
  - LC4 ou LC5 supprimés ou mis à 0 exemplaire, tuile de l'utilisateur ajoutée.
  - Si une famille manque, refus explicite.
- **H. Anciens documents 5×5 (3.04 et 4.00.0).**
  - Proposition du nouveau catalogue, refusée dans les cas prévus.
  - Acceptation, puis Ctrl+Z et Ctrl+Y.
- **I. Export.** Jeu complet de 28 tuiles, puis jeu modifié.
- **J. Libellés et pastille d'alertes.**

**Limite :** la boîte de dialogue de la proposition n'est vérifiée que par la recette S11. Le chemin « Ouvrir un fichier » (`app.js:284`) n'est exercé dans aucun navigateur.

## Défaut
**D1. Relecture quadratique de `murs`** (`sauvegarde.js:161`) : un `filter` avec `indexOf`, sans limite de longueur. Avec n valeurs invalides puis n valides, la lecture prend 3,9 s pour n = 80 000. Un fichier de 5 Mo pourrait donc figer l'outil plusieurs minutes. Correction proposée : tronquer à 4 avant de filtrer, ou passer par un masque. Le test E4 est laissé en `skip`.

## Constats
- `validerModele(m)` appelé sans format applique les règles 4×4. Tous les appels du code passent pourtant le format.
- **Le générateur dépasse le stock si on le réduit à la main** : par exemple, 12 LB2 posés pour 6 exemplaires. Aucune alerte ne le signale.
  - Arbitrage de l'orchestrateur : c'est conforme aux poses illimitées décidées. Le stock ne sert qu'à mesurer si un plateau se monte avec la boîte.
  - Le commentaire « exemplaires dépassés » de `modele.js:1363` est périmé.
- Le poids reste figé quand on change les exemplaires d'une tuile livrée ; seul le passage à 0 exemplaire l'exclut. Ce comportement est conforme à `47`.

## Seuils de test assouplis par la production (`59`)
- **Taux d'acceptation des candidats à 0,5 :** la cause est justifiée, mais la valeur est trop large, car le calcul est déterministe et le taux mesuré est de 63 %. **À resserrer à 0,58 ou 0,6.**
- **`tirerPlateaux5x5` à 10 sur 20 :** justifié. On peut monter à 11.
- **`jonctionsFaibles <= faibles` :** cette comparaison est toujours vraie. **À resserrer** par une moyenne de cases faibles inférieure à 1,3, ou une borne sur les cases de tuile faibles.
