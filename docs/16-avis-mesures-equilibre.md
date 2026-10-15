# Avis de l'advisor design de jeu sur les mesures d'équilibre (Opus 5.5), 2026-10-15

Source : `docs/12-mesures-equilibre.md`. **Ces décisions priment sur D6 de `1b-…` et sur `9-validation-catalogue.md` pour le critère d'équilibre.**

## Critère d'équilibre commun (rapport, contrôles, générateur)
- **a) Alerte principale « 5 contre 2 »**, mesurée en **villes non traversables** : élimine la configuration dans le générateur ; alerte en mode manuel.
- **b) D6 étendu** : alerte si |D1(k) − D2(k)| > 2 à **n'importe quel rang de 1 à 7**.
- **c) Score S** = Σ |D1(k) − D2(k)| sur les 7 rangs : le générateur classe les candidats par S ; le rapport signale « à surveiller » si S ≥ 4.
- **d) Invariant** : la première ville est à la même distance pour les deux joueurs.
- Information seulement : villes à égalité ; différence entre joueurs du nombre de villes à ≤ 4 pas.
- Raison : rangs 1 et 2 toujours à 0 ; l'écart ne varie qu'aux rangs 3 à 7 ; « 5 contre 2 » 5,7 % contre 0,2 % pour « écart > 2 » ; S vaut 0 dans 16,6 % des cas et ≥ 4 dans 4,5 % au placement par défaut.

## Villes traversables
**Défaut de l'outil : non traversables** (cas le plus pessimiste ; identique au placement par défaut), option « traversables » conservée ; le rapport montre les deux modes quand ils diffèrent. La règle de jeu reste à trancher par l'utilisateur.

## Carrefours
- Générateur : défaut (1,2)+(3,2) ; une autre paire seulement si la configuration n'a aucune alerte a) ou b) **dans les deux modes** et si son S ne dépasse pas celui du placement par défaut sur le même plateau. Option **« carrefours variés »** (désactivée par défaut) : paire tirée au hasard parmi celles qui passent cette règle.
- Mode manuel : alerte seulement, message avec la paire et son taux typique de « 5 contre 2 ».

## Diversité, autres points
- Suffisante pour une première version ; catalogue inchangé (le choix des modèles change l'écart moyen de 0,05 au plus) ; le levier de variété est le placement des carrefours (114 → 1916 profils).
- Pas de règle de symétrie des apparitions. C1 : refaire la mesure avec deux autres graines. Goulets : garder le calcul comme alerte en mode manuel et en formes réduites. « Mur » de C6 : à juger sur table. Première ville à 2 pas : voulu (invariant d).

## Ordre des actions
**Nécessaire pour une version utilisable** : 1) « 5 contre 2 » non traversables (contrôles + générateur) ; 2) D6 étendu aux rangs 1 à 7 + invariant d) ; 3) générateur classé par S, règle des autres paires ; 4) défaut non traversables ; 5) rapport : S, écart par rang 1 à 7, taux de b) sur 30 paires, mesure C1 sur 2 graines ; 6) alerte manuelle enrichie.
**Option** : 7) « carrefours variés ».
**À tester en parties réelles** : 8) règle « villes traversables » ; 9) tempo et ressenti de S ≥ 4 ; 10) « mur » de C6, lisibilité ; 11) variété ressentie (piste : tuile d'apparition A3).
