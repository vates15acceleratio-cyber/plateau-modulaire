# Avis design de jeu : plateau hexagonal à 19 tuiles (advisor Opus, lecture seule), 2026-10-19

Graphe abstrait sans cotes, solveur maison : les chiffres sont à refaire sur 1000 plateaux avec le vrai code. Scripts dans le scratchpad (`hex-design/`). Images : `docs/croquis/hexagonal/camps.png` et `villes6.png`.

## Faits de base
- **19 tuiles** :
  - le centre ;
  - une couronne de 6 tuiles ;
  - un pourtour de **6 coins** (3 voisines) et **6 bords** (4 voisines).
- **24 jonctions à 3 tuiles** (16 en 5×5) et 42 côtés partagés.
- **Tuiles pointe en haut** : le grand hexagone présente un côté plat à chaque joueur, ce qui donne 3 côtés nets par camp et des rangées de 3-4-5-4-3.

## Recommandations
1. **Camps, variante A** : la rangée du milieu (5 tuiles) est neutre.
   - Tuiles : 7 / 5 / 7. Jonctions : 12 / 12. Apparitions : 5 par camp, 2 neutres.
   - Symétrique par demi-tour et par miroir.
   - Variante B : seul le centre est neutre (6 apparitions par camp, frontière en escalier, S un peu plus faible).
2. **Apparitions** : sur les 12 tuiles du pourtour. La première ville est toujours à 2 pas.
3. **6 villes (3 par camp)**.
   - Une jonction n'a que 3 tuiles : « 3 accès » veut donc dire **les 3 tuiles**.
   - 8 villes n'est possible qu'avec au moins 4 murs, sur un plateau saturé.
   - 18 campements.
   - Disposition par défaut proposée : « **hélice** » (jonctions 0, 4, 8 / 15, 19, 23), qui donne S ≈ 0. Alternatives : « avancée » et « disputée ».
   - Le générateur choisit le placement des villes avant d'orienter les tuiles. Les 39 placements symétriques sont réalisables.
4. **Règles des tuiles** :
   - **H1** : une case porte au plus 3 ports, sur des coins consécutifs.
   - **H2** : tous les coins de tuile aux jonctions sont portés (indispensable pour moins de 5 % de cases faibles).
   - **H3** : les 2 cases d'une tuile ne sont jamais reliées si chacune dessert une ville.
   - **R4 gardée**.
   - Catalogue minimal « demi-tuiles 3 + 3 » : centrale reliée, centrale « deux ponts », bord, coin.
5. **Équilibre (N = 6)** :
   - S : alerte ≥ 4, information 3 (à recalibrer).
   - Majorité bloquante « 4 contre 2 » ; partage 3 / 2 / 1 en information.
   - Première ville : même distance.
   - Avec H2, le rythme (chaîne) perd son sens : distMax en information.
6. **Tempo** :
   - 3 à 4 villes sur 6 à ≤ 3 pas ;
   - diamètre de 7 à 9 pas ;
   - environ 56 cases ;
   - partie un peu plus courte qu'en 5×5.

## Questions de règle pour l'utilisateur
1. 6 villes ou 8 ?
2. Camps : variante A ou B ?
3. « 3 accès » strict ?
4. Écart d'au moins 3 cases ?
5. H1 et H2 (jusqu'à 3 ports par case, tous les coins portés) ?
6. Disposition par défaut « hélice » avec une liste de placements, ou placement libre ?
7. « 4 contre 2 » bloquant ?
8. Rythme remplacé par distMax ?
9. Passages entre côtés d'une même demi-tuile ?
10. Tuiles « deux ponts » sans mur ?
