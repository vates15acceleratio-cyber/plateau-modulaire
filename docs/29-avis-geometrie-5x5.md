# Avis géométrie : cahier du catalogue 5×5 (advisor, Opus 5.5), 2026-10-16

Rapport de l'advisor consigné par l'orchestrateur.

**Méthode.** Chaque modèle est vérifié de deux façons :
- par `validerModele(m, '5x5')`, sans erreur ni alerte ;
- par une copie de `problemesTrace` adaptée au 5×5 : 8 mm entre chemins, rayon + 4 mm des autres cases, 24 mm des coins sauf le port.

Les positions ont été cherchées par balayage au pas de 1 à 2 mm. Le banc redonne les deux constats du cahier : K2 (32,32)/(53,53)/(74,74) est valide ; K4 du cahier échoue à 6,0 mm.

> **Note de l'orchestrateur.** La remarque du relecteur sur K4 en (82, 60) / (60, 82) (`docs/27` § 8) portait sur le **K4 du 4×4**, sur une tuile de 120 mm. Le message de relance transmis à cet advisor l'a mal présentée comme une position 5×5, et l'advisor l'a donc jugée invalide en 5×5, ce qui est exact. La remarque reste valable pour le 4×4.

## 1. Les gabarits tiennent-ils dans 100 mm avec des cases Ø 20 ?
Oui pour tous les modèles, sauf K4, qui ne tient que de justesse.
- **Étoiles et dérivés (C1, C4, C5, C7, C8, C9)** : le relais reste au centre (50, 50), avec ses 4 raccords au milieu des côtés. La marge est fixe à 2,7 mm. Les porteuses sont valides de (20, 20) à (32, 32) ; (28, 28) est recommandé.
- **B1 et B7** : l'apparition doit être à y ≥ 38 environ, et les porteuses hautes et écartées, vers (18, 66) / (82, 66).
- **K4** : il n'est valide qu'avec l'apparition vers (44, 44), avec 1,4 mm de marge de tracé et 2,6 mm de jeu entre cases. Il ne garde aucune réserve, et ses 4 cases vont contre l'objectif de densité.

## 2. Raccords latéraux des bords contre le raccourci
- **Raccourci seul** : aucun conflit si les positions du tableau ci-dessous sont respectées.
- **Paire latérale à 70 mm** :
  - impossible depuis l'apparition de B1 ou de B7 ;
  - possible depuis le relais de B3 ou de B8 ;
  - impossible sur K2 et K4, d'où des raccords morts aux 8 contacts coin–bord.
- **Paire à 50 mm** : possible, mais elle doublerait le raccourci.
- **Recommandation** : comme en 4×4, **aucun raccord latéral hors du raccourci** sur les bords et les coins.

## 3. B7 : deux miroirs ou une rotation ?
- La rotation d'un bord est imposée par sa place, et le carton ne se retourne pas.
- Le port SE de B7 arrive toujours sur la jonction suivante dans le sens horaire. Chacune des 12 jonctions du pourtour reçoit un port, donc une seule version est déjà symétrique entre les camps.
- Le miroir sert à laisser le générateur choisir quelle jonction nourrir. Comme les ports sont rares, l'advisor **recommande deux modèles imprimés : B7 et son miroir B7m**.

## 4. La répartition B tient-elle les ports ?
**Non.**
- **Borne** : au plus un port par case (R1), aucun sur l'apparition (R4).
- **Ce que B permet** : 38 ports au mieux, et seulement si tous les bords à 3 cases sont du type B1.
- **Ce qu'il faut** : 7 × 3 + 9 × 2 = 39 ports. La recherche sur la pose trouve au plus 6 jonctions à 3 ports, alors qu'il en faut 7.
- **Modèles qui coûtent des ports** : chaque B8, B3 ou B5 posé en enlève un.
- **Proposition B′, à 78 cases** (haut de la cible 75 ± 3) :

| Tuiles | Cases | Ports |
|---|---|---|
| 4 × K2 | 12 | 4 |
| 6 × B1 + 6 × B7 / B7m | 30 | 18 |
| 9 centrales à 3 cases (C7 / C8) | 27 | 18 |
| 9 jonctions-cases | 9 | — |
| **Total** | **78** | **40** |

  La recherche trouve des poses où 8 jonctions ont au moins 3 ports et toutes en ont au moins 2. La marge n'est que d'un port. Variantes équivalentes : 7 × B1 + 5 × B7, ou 8 centrales à 3 cases + 1 C9.
- **Répartition A** : 41 ports, mais elle suppose le coin direct K1, retiré par l'utilisateur.

## Coordonnées validées (Ø 20, orientation canonique)

| Id | Cases (x, y) | Marge tracé | Jeu min entre cases |
|---|---|---|---|
| K2 | a (32,32) ; r (53,53) ; c1 (74,74) | 3,2 | 9,7 |
| K4 | a (44,44) ; s1 (71,55) ; s2 (55,71) ; c1 (78,78) | 1,4 | 2,6 (limite, déconseillé) |
| B1 | a (50,40) ; c1 (82,66) ; c2 (18,66) | 4,0 | 21,2 |
| B3 | a (50,30) ; r (50,54) ; c1 (78,78) ; c2 (22,78) | 3,7 | 4,0 |
| B5 | a (50,42) ; r (26,60) ; c1 (82,66) ; c2 (30,84) | 4,5 | 4,3 |
| B7 (port SE) | a (56,38) ; c1 (84,64) ; B7m : miroir x → 100 − x | 4,7 | 18,2 |
| B8 | a (50,32) ; r (52,56) ; c1 (78,78) | 4,5 | 4,1 |
| C1 / C5 | c0 (50,50) ; (28,28) (72,28) (72,72) (28,72) ; C5 sans le raccord O | 2,7 | 11,1 |
| C4 | C1 sans la case SE | 2,7 | 11,1 |
| C7 pont | c0 (50,50) ; NO (28,28) ; SE (72,72) | 2,7 | 11,1 |
| C8 équerre | c0 (50,50) ; NO (28,28) ; NE (72,28) | 2,7 | 11,1 |
| C9 antenne | c0 (50,50) ; SE (74,74) | 2,7 | 13,9 |

## Corrections du cahier
1. La répartition B ne donne que 38 ports, contre 39 nécessaires. Passer à B′, ou assouplir la règle « ≥ 3 ports aux villes ».
2. Les décomptes de cases sont justes ; ajouter les ports : A = 41, B = 38, B′ = 40.
3. Seules les centrales nourrissent les 4 jonctions intérieures. Le générateur doit en tenir compte.
4. B8, B3 et B5 sont à limiter à 0 ou 1 exemplaire.
5. K4 tient trop juste en 5×5 : l'advisor recommande **K2 seul**.
6. B1 et B7 : apparition à y ≈ 38 à 42, porteuses écartées.
7. B7 et B7m sont deux modèles distincts.
8. Écrire explicitement « aucun raccord latéral hors du raccourci ».
9. Pour le sous-agent catalogue : `problemesTrace` dans `tests/catalogue.test.js` utilise les coins et les tracés du 4×4. Il faut le paramétrer par format.
