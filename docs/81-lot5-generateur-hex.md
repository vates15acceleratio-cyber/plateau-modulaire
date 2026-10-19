# Lot 5 : générateur pour `'hex19'` (producteur, Sonnet 5.5), 2026-10-19

Rapport du producteur, consigné et condensé par l'orchestrateur. Fichiers : `src/generateur.js` et nouveau `tests/generateur-hex.test.js` (17 tests). Les tests 4×4 et 5×5 ne changent pas, empreintes comprises. Il applique **provisoirement** les recommandations de `80`, qui attendent la confirmation de l'utilisateur.

## Fonctionnement
- **Composition** : 7 intérieures, 6 bords et 6 coins, tirés par quotas selon les poids et plafonnés au stock (rejet `stock_insuffisant` sinon). Les deux moitiés ont le même nombre de cases, et la rotation du pourtour est imposée.
- **Villes** : en **trèfle** par défaut. Avec l'option `dispositionsVariees`, une des **10 dispositions** de `80` § 2 est tirée (liste `DISPOSITIONS_VARIEES_HEX`).
- **Orientation des intérieures par recherche exhaustive** : au plus 3⁷ = 2187 combinaisons. La recherche abandonne une branche dès que deux villes sont à moins de 4 pas, ou qu'un siège ne peut plus avoir assez de ports. Budget de 8000 nœuds.
- **Rejets** :
  - villes à moins de 4 pas ;
  - siège à moins de 2 ports, ville à moins de 3 ports ;
  - plus de 5 % de cases faibles ;
  - ville inaccessible ;
  - « 4 contre 2 » ;
  - écart supérieur à 2 à un rang ;
  - première ville inégale ;
  - S ≥ 4 ;
  - stock insuffisant ;
  - moitiés inégales.
- **Préférences** : S minimal, puis partage symétrique, chaîne, raccords morts et goulets.
- **« Placer les villes » en hexagonal** : le trèfle d'abord, puis les autres dispositions symétriques (220), puis des placements 3 + 3 libres.
- **Interface** : la boîte de dialogue gagne un texte hexagonal, une case « Dispositions variées » et un aperçu.

## Mesures (200 plateaux)
| | Trèfle | Dispositions variées |
|---|---|---|
| Réussite | 100 % | 100 % |
| Temps moyen / max | 1,0 s / 5,8 s (0,55 s sans charge) | 1,0 s / 6,2 s |
| Cases ; cases faibles ; raccords morts | 56 ; 0 ; 0 | 56 ; 0 ; 0 |
| Ports des sièges | 3 partout | 3 partout |
| Partage ; S | 3/3 ; 0 | 3/3 ; 0 (1 plateau à 1) |
| Chaîne ; goulets | 2 ; 0 | 2 ; 0 |
| Tempo | 4/4 | 4/4 (167), 3/3 (33) |
| Alertes ou blocages | 0 | 0 |

**Dispositions tirées avec l'option variées** : trèfle 80, miroir est-ouest 80, les autres de 1 à 11 fois. Une disposition n'est jamais sortie.

## Points ouverts
- **Rejet du générateur à S ≥ 4** au lieu de S ≥ 3, que suggérait `80`. Sans effet en pratique, puisque S vaut 0 ou 1. **Arbitrage de l'orchestrateur : passer à S ≥ 3**, comme le recommande `80`. C'est un changement d'une ligne, fait au lot 6.
- L'aperçu de la boîte de dialogue dessine les villes en simples cercles.
- Le calcul est synchrone, avec un pire cas d'environ 6 s sous charge.
