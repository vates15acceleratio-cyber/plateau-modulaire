# Avis design de jeu : tuiles organiques (advisor, Opus 5.5), 2026-10-16

Rapport de l'advisor consigné par l'orchestrateur. Objet : `34-tuiles-organiques.md` § 5.

**Méthode.** L'advisor a repris son modèle abstrait de `docs/28` :
- chaque tuile est réduite à ses cases, ses liens, ses ports et ses côtés à raccord ;
- pourtour B′ : nB1 = 5 ou 6, de préférence sur la rangée neutre ;
- l'anneau des raccourcis est conservé, et les critères sont ceux de `graphe.js` ;
- 150 à 200 plateaux par configuration ;
- générateur simulé : pose des centrales avec retour arrière et appariement des bords, refus de toute jonction à moins de 2 ports, villes en 2-3-2 sur les jonctions à au moins 3 ports, puis meilleur S.

**Portée des chiffres :**
- ils portent sur ce modèle, pas sur le vrai catalogue ;
- seuls les écarts entre mélanges comptent, et des écarts de S de ± 0,2 ne sont pas significatifs ;
- tout est à refaire sur le vrai catalogue.

**Types de centrales modélisés** (2 ports chacun) :
- X : croix, comme C7 et C8 ;
- D et Dm : droite N-S et son miroir ;
- Va et Vb : deux variantes de virage N-E ;
- Ta, Tc, Tcm et Tb : quatre variantes de T N-E-S ;
- R2 : deux réseaux, 4 cases.

Ces types recoupent C10 à C14 et leurs variantes de `docs/35`.

**Trois modes pour le pourtour :**
- **fixe** : raccord S des bords toujours présent ;
- **libre** : chaque bord existe aussi sans raccord S, soit 3 modèles de plus ;
- **mort** : raccord S toujours présent, et des raccords morts acceptés en face.

## 1. Connexité, équilibre, proportions
- **Budget :** cases − ports = 38 + nR2. Il ne permet donc **qu'une tuile à deux réseaux au plus**, avec nB1 = 5, soit 78 cases pour 39 ports, sans aucune marge. Ce résultat concorde avec `docs/35` § 4. Mesuré : environ 0,4 R2 par plateau. La forme préférée de l'utilisateur reste donc marginale, sauf à accepter 79 à 80 cases.
- **Connexité :** tant que chaque jonction a au moins 2 ports, le plateau est toujours connexe. Avec des rotations au hasard, seuls 52 à 75 % des plateaux sont connexes, et c'est déjà vrai du catalogue actuel. **Le générateur doit choisir les rotations d'après les ports.**
- **Équilibre :** il n'est pas dégradé.
  - Actuel : S = 1,9, « 5 contre 2 » dans 0 à 1 % des cas, S ≥ 5 dans 1 % des cas.
  - Organiques : S de 2,1 à 2,3, « 5 contre 2 » dans 0 à 1 % des cas, S ≥ 5 dans 2 à 7 % des cas.
  - Dans tous les cas, au moins 7 jonctions ont 3 ports.
- **Effet visuel**, mesuré par le nombre de rangées ou colonnes qu'un même réseau traverse d'un bord à l'autre, sur 6 possibles :

  | Mélange | Lignes droites (sur 6) |
  |---|---|
  | Actuel | 6 |
  | Organiques, pourtour fixe | 1,7 à 2,1 |
  | Organiques, pourtour libre | 0,8 à 1,0 |
  | Virages et T seuls | 0,3 |

- **Proportions recommandées sur le plateau :**
  - virages 30 à 45 % ;
  - T 35 à 45 %, en au moins deux variantes de ports ;
  - droites 10 à 15 %, avec leur miroir ;
  - croix environ 10 % (une seule C7) ;
  - R2 : 1 au plus.
- **Poids de départ** (exemplaires) : Va 3, Vb 0 à 1, Ta 2, Tc 1, Tcm 1, D 1, Dm 1, X 1, R2 2 (plafonné par le générateur). L'appariement déforme ces poids. En pourtour fixe, les tuiles réellement posées glissent vers les T (49 %) et les X (22 %), et les virages tombent à 16 %.
- **Pourtour :**
  - **fixe** : aucun nouveau modèle ; une droite ne peut pas aller dans un coin du centre ;
  - **libre** : plus organique ; 8,5 liaisons bord-centre vivantes sur 12 ;
  - **mort** : 3 à 3,5 raccords morts par plateau, donc à écarter.

## 2. M4, ports venant d'au moins 2 côtés
- **Définition retenue :** les ports d'une jonction viennent de 3 quadrants au moins, ou de 2 quadrants en diagonale. Le cul-de-sac correspond à deux tuiles voisines placées du même côté de la jonction.
- **Sans contrainte :** environ 10 jonctions sur 16 tiennent M4.
- **M4 exigé sur les 16 jonctions :** solution rarement trouvée (1 à 2 pourtours sur 15). C'est cher, sans être prouvé impossible.
- **M4 exigé aux 7 villes seulement :** 83 à 94 % de réussite en 20 tentatives, sans effet sur S ni sur le tempo.
- **Avis :** **obligatoire aux villes**, simple préférence (pénalité) aux jonctions-cases.

## 3. Routes coudées, tempo, anneau
- **Tempo inchangé :** 4,55 à 4,72 villes à 3 pas au plus, contre 4,65 avec l'actuel. Les virages et les T ne rallongent pas les trajets.
- **Coudes et courbes (M3) :** ils ne changent rien au tempo, sauf s'ils demandent une case relais de plus, ce qu'il faut éviter.
- **Anneau du pourtour :** conservé. Le contact vert / rouge sur les flancs reste à 2 pas.

## 4. Pose manuelle : alerte ou refus ?
Mesure : part des poses à la main qui finissent dans une impasse, quand plus aucune tuile ne convient à une cellule.

| Jeu de tuiles | Pourtour fixe | Pourtour libre |
|---|---|---|
| Virages et T seuls | 92 % | 26 % |
| Virages, droites, T, X | 12,5 % | 7,8 % |
| Idem + une tuile « 1 côté » | 1,4 % | 1,2 % |
| Idem + une tuile « sans raccord » | 0 % | 0 % |

**Avis :** une **alerte** (le raccord mort, qui existe déjà) avec une aide qui propose d'abord la rotation qui concorde. Une pose stricte pourrait exister en option, mais elle demanderait des tuiles « 1 côté » et « sans raccord ». La décision revient à l'utilisateur.

## 5. Faisabilité du générateur : oui
**Ordre conseillé :**
1. Fixer nB1 à 5 ou 6, avec les B1 d'abord sur la rangée neutre, et plafonner les R2 (nB1 + nR2 ≤ 6).
2. Tirer B7 ou B7m pour les autres bords.
3. Poser les centrales ligne par ligne, avec retour arrière : appariement des bords, ports comptés au fur et à mesure, refus de toute jonction à moins de 2 ports.
4. En cas d'échec, environ 20 000 nœuds au plus, puis retirer un nouveau pourtour, jusqu'à 60 reprises.
5. Placer les villes en 2-3-2 sur des jonctions à au moins 3 ports qui respectent M4, appliquer les filtres actuels, puis garder le meilleur S.
6. Pénalités : M4 non tenu aux jonctions-cases, lignes droites, répétitions.

**Réussite :** 83 à 94 % des plateaux aboutissent en 20 tentatives, 99,5 % en 60. Comptez de quelques millisecondes dans le modèle à environ une seconde estimée avec `PM.graphe`.

## Recommandations
1. Le générateur choisit les rotations d'après les ports, quel que soit le catalogue.
2. Pourtour **fixe** par défaut. Passer au pourtour **libre** si le plateau paraît encore quadrillé.
3. Proportions : virages 30 à 45 %, T 35 à 45 %, droites 10 à 15 %, croix environ 10 %, R2 au plus 1.
4. M4 obligatoire aux villes, simple préférence ailleurs.
5. Pose manuelle : une alerte, avec une aide à la rotation.
6. M3 sans case relais ajoutée.
7. Refaire les mesures sur le vrai catalogue (les 12 points de `docs/28`).

## Décisions pour l'utilisateur
1. **Tuiles à deux réseaux :** 1 au plus par plateau (78 cases et 39 ports, sans marge), ou accepter 79 à 80 cases pour en voir davantage ?
2. **Pourtour :** fixe (aucun nouveau modèle), ou libre (3 bords sans raccord S, plateau plus organique) ?
3. **Pose manuelle :** une alerte avec aide (conseillé), ou un refus de pose (qui impose des tuiles « 1 côté » et « sans raccord ») ?
4. **M4 :** obligatoire aux villes et simple préférence ailleurs, ou obligatoire partout (plus cher, souvent sans solution) ?
5. **Proportions** de virages, T, droites et croix : celles proposées conviennent-elles ?
