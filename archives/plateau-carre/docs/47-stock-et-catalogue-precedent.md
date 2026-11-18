# Stock imprimé et proposition du nouveau catalogue (sous-agent de production, Sonnet 5.5), 2026-10-18

Rapport du sous-agent, consigné par l'orchestrateur. Il applique les décisions de `18` (« Réponses… après le branchement »). Vérification de l'orchestrateur : `node --test` donne 642 tests, 635 OK, 0 échec, 7 ignorés, en 155 s. Recettes navigateur données par le sous-agent : 320 OK et 116 OK, 0 échec.

## 1. Exemplaires à imprimer
Méthode : le vrai générateur sur 200 plateaux par format, une recherche exhaustive du plus petit ajout qui atteint 90 % de plateaux montables, puis un contrôle sur 200 autres graines.

| 4×4 | avant | après |
|---|---|---|
| Q1 / Q2 / B1 / K2 | 4 / 3 / 8 / 4 | inchangés |
| B8 | 1 | **3** |
| K4 | 1 | **2** |
| Total | 21 | **24** |

Planches 4×4 : 4 A3, ou 11 → 12 A4.

| 5×5 | avant | après |
|---|---|---|
| U1 / B1 / B7 / K2 | 5 / 6 / 8 / 5 | inchangés |
| P3 | 2 | **4** |
| P5 | 2 | **3** |
| P1 | 1 | **3** |
| P2 | 1 | **3** |
| Total | 30 | **37** |

Planches 5×5 : 5 → 7 A3 (la 7e ne porte qu'une tuile), ou 15 → 19 A4. Un jeu de 36 tuiles, soit exactement 6 A3, n'atteint que 89,5 % sur la série principale (91,5 % sur l'autre).

**Plateaux montables avec la boîte :**

| | Avant | Après | Contrôle sur d'autres graines |
|---|---|---|---|
| 4×4 | 39 % | 98,5 % | 95,5 % |
| 5×5 | 27 % | 93 % | 92 % |

**Poids et stock sont dissociés.**
- Augmenter les exemplaires seuls dégradait les mesures, puisqu'ils servaient aussi de poids au générateur :
  - en 4×4, il y avait plus de cases ;
  - en 4×4, l'écart d'accès et S montaient ;
  - en 5×5, la distance maximale montait.
- **Nouveau champ facultatif `poids`.** Le catalogue livré garde les anciens nombres comme `poids`. Les `exemplaires` portent le stock.
- Les plateaux générés sont identiques bit à bit, un test le vérifie, donc les mesures de `46` sont inchangées.
- **Sans `poids`**, il vaut les exemplaires. Un modèle à 0 exemplaire n'est jamais tiré.
- **Interface :** `poids` n'est pas modifiable. L'info-bulle du champ « Exemplaires » le dit, et une copie de tuile perd son poids.

## 2. Proposition du nouveau catalogue
- **Reconnaissance :** `PM.sauvegarde.bibliothequeCataloguePrecedent(doc)` compare le tracé de chaque modèle à `PM.catalogue.precedent`. Elle échoue dès qu'un modèle a été modifié, ajouté ou retiré : un travail personnel n'est jamais remplacé. Vérifié sur de vrais documents 3.04, désormais dans `tests/donnees/`.
- **Quand :**
  - à l'ouverture d'un fichier ;
  - au démarrage depuis la sauvegarde automatique ;
  - le cas v1 → v2 reste prioritaire.
- **Texte de la boîte** « Nouveau catalogue de tuiles » : le document utilise encore le catalogue précédent. Charger le nouveau remplace la bibliothèque et vide le plateau ; Ctrl+Z permet de revenir en arrière. Si l'utilisateur garde ses tuiles, le document reste inchangé. Deux boutons : « Charger le nouveau catalogue » et « Garder mes tuiles ».
- **Accepter :**
  - le document devient un document neuf, sur la même grille ;
  - l'opération est une seule étape d'historique, donc Ctrl+Z rend le document tel qu'il était ;
  - les anciennes tuiles ne sont pas gardées, pour ne pas mélanger les deux catalogues, ce qui fausserait le générateur.
- **Refuser :** rien ne change, et la proposition revient à chaque ouverture.
- **Recette :** 7 contrôles ajoutés à l'étape S6 de la recette navigateur. Le chemin de la sauvegarde automatique n'est couvert que par les tests Node.

## Réserves
- La suite de tests passe de 59 s à 155 s, dont 107 s pour le test de stock 5×5. Le test « 200 candidats en moins de 5 s » a échoué une fois sur une machine chargée, à 6,8 s. Si cela se reproduit, ramener le test de stock à 60 graines.
- `docs/croquis/organique/mesures.json` et `centrales-ouvertes-200.json` restent périmés (`46`).
