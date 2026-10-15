# Avis design de jeu, version 2 (advisor, Opus 5.5), 2026-10-15

Entrée : `docs/18-decisions-v2.md`.

## Règles locales qui garantissent l'écart de 3 cases entre villes
- **R1** une case porte au plus un port de coin ;
- **R2** deux cases porteuses de port ne sont jamais reliées directement ;
- **R3** aucun raccord latéral sur une case porteuse de port ;
- **R4** une case d'apparition ne porte jamais de port.

Sur tout trajet ville–ville : case porteuse, case non porteuse (relais, apparition ou jonction-case), case porteuse → au moins 3 cases, 4 pas, quels que soient la pose et les villes. Tuile minimale à 2 ports : port – relais – port (3 cases). Centrale à 4 ports : **étoile à 5 cases**. Raccords issus du centre de l'étoile : au milieu (60 mm) seulement (à 30 ou 90 mm, le chemin frôle la case porteuse).

**5×5** (tuiles de 100 mm, zone de coin R 20) : impossible en Ø 30 (1,7 mm de jeu), **faisable en Ø 24** (11,7 mm de jeu) ; autres voies : jeton plus petit, centrales à 2 ou 3 ports.

## Apparitions et équilibre
- 6 cases d'apparition par joueur en 4×4, 7 en 5×5 (rangée centrale du 5×5 ignorée).
- Mesures du doc 16 conservées : D(k) depuis l'apparition la plus proche, S, « 5 contre 2 », villes non traversables par défaut.
- **Blocage en pose manuelle** : « 5 contre 2 » **ou** |D1(k) − D2(k)| > 3 au même rang (1 à 7). **Alertes** : écart > 2 à un rang, S ≥ 4. Information : villes à ≤ 3 pas par joueur.
- Seuils **provisoires** (mesurés avec 2 apparitions par joueur) : **refaire la mesure sur 1000 plateaux par format** avant de les figer.
- **5×5 : « 4 contre 3 » structurel** (aucune rangée de jonctions équidistante, 7 impair) : pas d'alerte, compensation par les rangs et S.
- Risque : tempo très rapide (ville à 2 pas depuis presque tout le pourtour).

## Coins utiles : « raccourci de coin »
La tuile de coin porte un raccord sur chacun de ses deux côtés intérieurs, qui part de sa case d'apparition (sans port) vers une case sans port de la tuile de bord voisine, à la **position « côté extérieur » (30 mm du bord extérieur)**. Toute tuile de bord a un raccord à cette position sur ses deux côtés latéraux (réversible entre les camps). Effet : depuis l'apparition du coin, la jonction voisine passe de 6 à 3 pas ; le coin touche 3 jonctions à ≤ 3 pas. Écarté : lien direct entre coins. Risque : autoroute le long des bords (à mesurer).

## Pose libre
Blocages : physiques (dans la grille, cellule libre) + plateau très déséquilibré. Alertes : tuile sans apparition sur le pourtour, apparition au centre, raccord face au vide, port sur un coin extérieur, jonction à moins de 2 ports, villes à moins de 3 cases, plateau non connexe, déséquilibre modéré. Rotation libre partout, rotation suggérée sur le pourtour.

## Catalogues
- **4×4** (22 tuiles) : 6 centrales × 1 (4 à 6 cases) ; 6 modèles de bord, 10 tuiles (3 à 4 cases) ; 3 coins × 2 (2 à 3 cases). ≈ **60 cases par partie** (+20 %, à cause du relais obligatoire).
- **5×5** (30 tuiles) : 11 centrales (3 à 5 cases), 14 bords (3 cases), 5 coins (2 à 3 cases) ; **80 à 90 cases**, Ø ≤ 24 mm.

## Générateur
Rejet : villes à moins de 3 cases, blocage, « 5 contre 2 », écart > 2 à un rang, non connexe. Classement : S, puis raccords morts et jonctions à moins de 2 ports. Les jonctions-cases (2 en 4×4, 9 en 5×5) sont choisies par le générateur (plus de paire fixe ; « carrefours variés » par défaut). Invariant « première ville à égalité » conservé.

## Questions transmises
Géométrie : impression des jonctions-cases ; règles minimales des tuiles libres ; cotes du 5×5 ; place de la case d'apparition et de son symbole ; raccord du raccourci à 30 mm du bord extérieur.
Utilisateur : 4 contre 3 du 5×5 ; tempo ; la case d'apparition compte-t-elle comme un pas ; villes traversables ; ≈ 60 cases en 4×4 et 80 à 90 en 5×5.
