# Avis design de jeu : cahier du catalogue 5×5 (advisor, Opus 5.5), 2026-10-16

Rapport de l'advisor consigné par l'orchestrateur. Entrée : `24-catalogue-5x5.md` § 6, `18` (prioritaire), `19`, `21`, `22`.

**Méthode.** L'advisor a construit un modèle abstrait, sans géométrie :
- chaque tuile est réduite à ses cases, ses liens, ses ports et ses raccords ;
- le modèle tient compte des raccourcis du pourtour, des rotations imposées des bords et des coins, de la rangée 2 neutre, des villes non traversables, et du tirage avec remise (pénalité de répétition 0,5) ;
- 200 plateaux par catalogue et par famille de placements ; 4000 tirages pour le calibrage des cases.

Les résultats « mesurés » portent sur ce modèle, les autres sont signalés comme estimés. **Tout est à refaire sur le vrai catalogue**, dans le rapport de mesures.

## 1. Répartition : B, à condition d'orienter les centrales
- **A est exclue**, car elle suppose de rétablir K1, que l'utilisateur a retiré. Pour information, elle équilibre mieux : S moyen 2,19 contre 2,67, et S ≥ 5 dans 1,1 % des cas contre 8,1 %.
- **B est tenable.** Catalogue de référence mesuré « P5 » :

  | Famille | Modèles (exemplaires) |
  |---|---|
  | Coins | K2 ×4, K4 ×1 |
  | Bords | B1 ×6, B7 ×4 (port SE), B7 miroir ×4 (port SO) |
  | Centrales | C7 ×4, C8 ×3, C9 ×3, C4 ×1 |

  Résultat : **76,4 cases** en moyenne (de 73 à 80 entre le 5e et le 95e centile), 37 ports pour 16 jonctions.
- **Chaque modèle lourd ajouté coûte des cases**, car les poses illimitées rendent le tirage presque uniforme entre modèles. Ajouter B8, B3 et C1 à 1 exemplaire chacun fait passer à 79–82 cases.
- **Condition indispensable : le générateur doit orienter les centrales** pour couvrir les jonctions, au lieu de les tourner au hasard. Cela vaut aussi pour le tirage de référence des mesures.
  - Au hasard : 0,28 jonction sans aucun port par plateau, et 8 à 12 % de villes inaccessibles.
  - Rotation choisie : aucune jonction sans port, 0,67 jonction à moins de 2 ports par plateau.
- **« ≥ 3 ports aux villes » (`docs/20`) est inatteignable** à 75 cases : seuls 0,1 à 2 % des placements y arrivent. Proposition : exiger ≥ 2 ports à chaque jonction, et garder ≥ 3 aux villes comme simple préférence.

## 2. Rangée neutre (rangée 2)
- **Bords (0,2) et (4,2)** : y placer des bords symétriques nord-sud (B1 ou B3).
  - Mesuré : avec B1 seul sur cette rangée, S passe de 2,67 à 2,42, et S ≥ 5 de 8,1 % à 5,1 %, pour 0,9 case de plus.
  - Le générateur applique cette préférence ; en pose manuelle, c'est une simple information.
- **Centrales (1..3, 2)** : le générateur choisit leur rotation pour équilibrer les ports entre nord et sud. C7, et C8 orientée est-ouest, sont neutres ; C9 et C4 favorisent toujours un camp.
- **Flancs** : par le pourtour, une apparition verte et une rouge sont à 2 pas, via l'apparition neutre (1 pas en 4×4).

## 3. Exemplaires
- **Base P5** : 30 tuiles pour 9 modèles, donc moins que les ≈ 15 modèles prévus.
- Pour élargir sans dépasser 78 cases, on peut ajouter B8, B3 et C1 à 1 exemplaire chacun, **à condition** que le générateur pénalise les plateaux hors de 75 ± 3. Sinon, l'advisor estime l'effet à +3 à +5 cases.
- **Les deux miroirs de B7 sont nécessaires.** La rotation d'un bord est imposée par sa place sur le pourtour, donc sans le miroir tous les ports uniques tomberaient du même côté.

## 4. Mur (C5)
- Mesuré : sans effet sur l'équilibre (S 2,68 contre 2,67), mais il ajoute 1,07 raccord mort par plateau.
- En 5×5, il manque déjà des ports. L'advisor **déconseille C5** : on pourra le réintroduire si des goulets manquent. C2 et C6 sont à écarter, car trop lourds.

## 5. Placement par défaut des 9 jonctions-cases : « 3 + 1 + 3 »
- **Principe** : 3 villes sur la rangée de jonctions j = 1, 3 sur j = 4, et la 7e sur j = 2 ou j = 3. Cela donne 128 placements par plateau. Le générateur prend le meilleur S, avec la 7e ville à égalité de distance (`docs/18`).
- **Mesuré sur P5**, placements tirés au hasard avant le choix du générateur :
  - 0 % de « 5 contre 2 », d'écart ≥ 3 et de première ville inégale ;
  - « 4 contre 3 » dans 84 % des cas, structurel et accepté ;
  - S moyen 2,67, S ≥ 5 dans 8,1 % des cas ;
  - meilleur S atteignable 0,52 en moyenne, et un placement valide existe sur tous les plateaux ;
  - pour comparaison, le tirage libre donne environ 20 % de « 5 contre 2 » et un S moyen de 4,3.
- **Variante conseillée** : la jonction-case extérieure sur un coin du plateau (i = 1 ou 4). S 2,41, S ≥ 5 dans 4,2 % des cas.
- **« Jonctions variées »** : placement 2 + 2 + 3 (S 2,8, 0 % de « 5 contre 2 »), en excluant les placements où toutes les villes sont sur le pourtour (15 % de « 5 contre 2 »).
- **Tempo** : environ 3,6 villes sur 7 à 3 pas au plus par joueur, contre 5,7 en 4×4. C'est **plus lent que le 4×4**.
- **Variante non retenue, « milieu 4 + 3 »** : S 2,3, mais première ville inégale dans 23 % des cas et aucun placement valide sur 10 % des plateaux.

## 6. Seuils provisoires et mesures
**Seuils provisoires**, repris du 4×4 :
- blocage : « 5 contre 2 », ou écart > 3 à un rang ;
- alerte : écart > 2, S ≥ 5, première ville inégale, ou jonction à moins de 2 ports ;
- information : S = 4 et tempo ;
- aucune alerte pour « 4 contre 3 ».

Le S d'alerte sera fixé au 95e centile après mesure : estimé à 5, il passera à 6 si plus de 10 % des plateaux le dépassent.

**Mesures à produire sur 1000 plateaux**, avec un générateur à rotation optimisée :
1. Cases par plateau, et part des plateaux dans 75 ± 3.
2. Écart minimal entre villes (4 pas).
3. Ports par jonction, et villes à ≥ 3 ports.
4. Pour chaque mode de placement : S, écarts, « 5 contre 2 », « 4 contre 3 », première ville inégale, meilleur S atteignable, plateaux sans placement valide.
5. La 7e ville sur chacune des 8 jonctions du milieu.
6. Tempo.
7. Pourtour.
8. Effet de la rangée neutre.
9. Goulets et raccords morts.
10. Sensibilité par modèle.
11. Diversité des plateaux.
12. Rejets du générateur par cause.

## Décisions pour l'utilisateur
1. **Placement par défaut « 3 + 1 + 3 »** : 3 villes par camp, et la 7e seule disputée. Te convient-il, ou préfères-tu le « milieu 4 + 3 », plus disputé mais moins équilibré ?
2. **Tempo plus lent qu'en 4×4** : environ 3,6 villes à 3 pas au plus, contre 5,7. Est-ce acceptable ?
3. **Bibliothèque** : 9 modèles à 76 cases, ou environ 12 modèles avec un filtre sur les cases dans le générateur ?
4. **Pas de mur C5** : à confirmer.
5. **≥ 3 ports aux villes** : à garder seulement comme préférence ?
