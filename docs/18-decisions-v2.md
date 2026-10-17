# Décisions de la version 2 (utilisateur), 2026-10-15

> **Ce document prime sur tous les précédents** (brief, synthèse `archives/3-synthese.md`, avis) là où ils se contredisent. Il décrit ce que l'utilisateur a demandé après avoir utilisé la version 1.00.0.

## Formats de grille
- **Grilles toujours pleines** : le choix « 4×4 avec coins ou bords retirés » est **supprimé**.
- **Trois formats**, choisis à la création du projet (un document = un format) :
  1. **4×4 carré** (format actuel, tuiles de 12 cm) ;
  2. **5×5 carré** (tuiles de 10 cm au plus, pour tenir dans 50 × 50 cm) ;
  3. **Hexagonal** : plateau en grand hexagone, **réalisé en dernier**. Les camps sont les **3 côtés de l'hexagone les plus proches** de chaque joueur.
- Chaque format a son propre catalogue de tuiles.

## Joueurs, camps et apparitions
- Les joueurs sont **vert** et **rouge** (vert au nord, rouge au sud sur les grilles carrées).
- **Plus de tuile ni de catégorie « apparition »**. **Toutes les tuiles du pourtour** (bords et coins) portent **une case d'apparition** qui permet de faire apparaître un groupe.
- **Propriété des cases d'apparition selon la position** :
  - 4×4 : les **2 rangées les plus proches** de chaque joueur lui appartiennent (rangées 0 et 1 au vert, 2 et 3 au rouge) ;
  - 5×5 : 2 rangées par joueur ; la **rangée centrale est neutre** (ses cases d'apparition ne servent à personne).
- **Impression** : la case d'apparition est imprimée **neutre** (symbole noir et blanc) ; une même tuile de bord peut aller d'un côté ou de l'autre. **À l'écran**, elle s'affiche en **vert ou rouge** selon le camp de sa position (neutre au centre en 5×5).

## Jonctions et villes
- **Une jonction (coin commun à 4 tuiles) n'est jamais vide** : soit une **ville** (jeton), soit une **case chemin** — une vraie case, où un pion peut s'arrêter, qui compte dans les distances. Le jeton « carrefour » disparaît : toute jonction sans ville est une case chemin.
- **7 villes** sur tous les formats.
- **Au moins 3 cases entre deux villes** (4 pas ; auparavant 2 cases). Si un plateau ne le respecte pas : **alerte, sans blocage** ; le générateur ne produit jamais ce cas.

## Pose des tuiles sur le plateau
- **Plus de liberté** : les rôles imposés par la position disparaissent autant que possible (une tuile de bord peut prendre la place d'une autre tuile de bord, les coins aussi, etc.).
- **Seul blocage** : un plateau **très déséquilibré** pour les joueurs. Proposition retenue : bloquer seulement en cas de « 5 villes contre 2 » ou d'un écart de plus de 3 cases entre joueurs (critère à préciser par l'advisor design de jeu) ; le reste reste en alerte.

## Coins
- Les coins actuels sont **trop loin de l'action**. Ils deviennent des **coins d'apparition** (ils portent une case d'apparition, comme tous les bords) et doivent devenir utiles : piste « **raccourci** » (à concevoir par l'advisor design de jeu : chemin rapide vers le jeu central).

## Création des tuiles : plus de liberté
- **Supprimés comme obligations** : les chemins de coin obligatoires ; le nombre de cases imposé par rôle.
- **Autorisé** : des cases dont les chemins **ne se croisent pas** dans la tuile (plusieurs réseaux séparés sur une même tuile).
- **Garder un minimum pour rester modulaire** : positions de raccord standardisées sur les côtés, contraintes physiques (tuile dans son carré, marges de coupe, pas de chevauchement), cases reliées à quelque chose. Le détail est à proposer par l'advisor géométrie.

## Ordre de réalisation
1. Règles de la version 2 sur le **4×4** (points ci-dessus).
2. Format **5×5**.
3. Format **hexagonal** : **en attente du feu vert de l'utilisateur. Aucun travail dessus, pas même de préparation** (la section D6 / F de `20-avis-geometrie-v2.md` est mise de côté).

## Réponses de l'utilisateur à l'avis design v2 (`19-avis-design-v2.md`)
- **5×5, « 4 contre 3 » structurel** : accepté, compensé par les distances (pas d'alerte) ; le générateur cherche à rendre la 7e ville équidistante.
- **La case d'apparition est une vraie case** : elle compte dans les distances.
- **Villes non traversables** : c'est la **règle du jeu** (on s'arrête dans une ville). L'option « traversables » peut disparaître de l'interface.
- **Nombre de cases** : **≈ 75 pour le 5×5** (au lieu de 80 à 90), **≈ 60 pour le 4×4** (confirmé).
- **Conséquences arbitrées par l'orchestrateur** (détail dans `20-avis-geometrie-v2.md`) : les règles qui garantissent l'écart entre villes (R1 à R4) sont des **alertes** dans l'éditeur, pas des blocages ; un plateau **complet** très déséquilibré est une **erreur** (pose toujours permise, export de l'aperçu refusé).

## Réponses de l'utilisateur aux mesures du catalogue 4×4 v2 (`21-mesures-catalogue-v2.md`)
- **Anneau du pourtour** (raccourcis qui relient toutes les apparitions, contact vert / rouge en 1 pas sur les flancs) : **accepté**, aucun changement.
- **Tempo** (première ville à 2 pas, 5,7 villes sur 7 à 3 pas au plus) : **voulu**, aucun changement.

## Retours de l'utilisateur après essai du plateau 4×4 (2026-10-16)
- **Poses illimitées** : chaque modèle peut être posé autant de fois qu'on veut ; le compteur « ×N restants » disparaît de la bibliothèque. Les exemplaires ne servent plus qu'à l'**impression** (l'export imprime les tuiles posées, ou un nombre d'exemplaires choisi dans sa fenêtre) et au **générateur**, qui peut réutiliser un modèle **en favorisant la variété**.
- **Bibliothèque** : plus large, tuiles sur plusieurs colonnes, catégories bien visibles. **Clic = armer la pose** (puis clic sur une cellule ; le glisser-déposer reste), **double-clic = ouvrir dans l'éditeur**. Le bouton « Poser » disparaît.
- **Clic droit sur une tuile posée = la retirer** (annulable).
- **Rôle respecté à la pose** : coin dans un coin, bord sur un bord, centrale au centre (refus expliqué). Remplace la « pose libre » des décisions précédentes.
- **Coins** : **K1 et K3 retirés** ; K2 est le bon modèle (2 cases avant la ville la plus proche, déplacement rapide le long du bord) : chercher d'autres coins du même esprit, sinon garder K2 seul.
- **Plus de poches** (case en impasse) dans les tuiles du catalogue (4×4 et 5×5) ; l'éditeur signale une poche par une alerte. B4 (« bord en fourche ») est à revoir.
- **Autre poste** : tout est envoyé sur GitHub, avec un `CLAUDE.md` qui résume la méthode et où trouver les décisions.
- **Cases par plateau 4×4 : ≈ 63 accepté** (effet du tirage avec répétition ; plus de retour vers 60).

## Point d'arrêt du 2026-10-16
- **Pause** à la demande de l'utilisateur ; reprise après discussion.
- **Suppression des tuiles utilisateur** (avec confirmation) et **légende « Commandes » illustrée** (souris et touches dessinées, à droite du plateau à partir de 1600 px de large) ajoutées.
- **Idée nouvelle, non définie : les régions thématiques** (une tuile représente une région ; une région a une thématique, ex. C3 = Montagne) : à étudier avec l'utilisateur. Questions préparées dans `docs/25-travail-restant.md`.

## Taille des cases (2026-10-16)
- **Cases à Ø 20 mm dans tous les formats** : 4×4, 5×5 et, le jour venu, hexagonal (simple consigne pour ce format, qui reste en attente du feu vert). Les tuiles gardent leur taille (120 mm en 4×4, 100 mm en 5×5). But : plus de place sur les tuiles 5×5 et la même apparence d'un format à l'autre.
- Appliqué aux cases du catalogue 4×4, aux jonctions-cases et aux cases neuves de l'éditeur. Le diamètre **maximal** permis dans l'éditeur ne change pas (Ø 30 en 4×4, Ø 24 en 5×5) ; les documents déjà enregistrés gardent leurs diamètres. Le jeton ville reste Ø 30.
- Conséquence : deux modèles retouchés pour garder 8 mm entre les chemins qui partent d'une même case, sans changer leurs liaisons (donc sans effet sur les mesures d'équilibre de `21-mesures-catalogue-v2.md`) : B5, case à port est de (92, 90) à (96, 90) ; K4, relais de (82, 56) / (56, 82) à (82, 61) / (61, 82) : 8,35 mm au plus près entre chemins (h1 / r1), autant qu’en (82, 62), et 9,7 mm de jeu entre les relais au lieu de 8,3 (docs/31, constat 2 ; (82, 60) ne laissait que 8,09 mm entre chemins).
- À vérifier à l'impression : taille des pions (Ø 20 mm au plus pour tenir sur une case).

## Décisions de l'utilisateur pour le catalogue 5×5 (2026-10-16)
Après les avis `28-avis-design-5x5.md` (design de jeu) et `29-avis-geometrie-5x5.md` (géométrie), sur le cahier `24-catalogue-5x5.md`.
- **Répartition B′, ≈ 78 cases** (avis géométrie) : 4 coins K2, 6 B1 + 6 B7 / B7m sur le pourtour, 9 centrales à 3 cases (C7 Pont, C8 Équerre), 9 jonctions-cases ; 40 ports. La garantie **≥ 3 ports aux villes** est conservée (≥ 2 à chaque jonction).
- **Coins : K2 seul** en 5×5 (K4 trop serré dans 100 mm).
- **Placement par défaut des 7 villes : « 2-3-2 »** : 2 villes sur la rangée de jonctions côté vert (j = 1), 3 sur les deux rangées du milieu (j = 2 et 3), 2 côté rouge (j = 4). Remplace le « 3 + 1 + 3 » proposé par l'advisor design de jeu ; à mesurer sur le vrai catalogue.
- **Pions : Ø 20 au plus** (consigne maintenue ; l'advisor prépresse, `26-avis-prepresse-cases-20.md`, conseillait Ø 16 à 18).
- Acceptés par défaut, sans objection de l'utilisateur : pas de mur (C5) en 5×5 ; aucun raccord latéral hors du raccourci sur les bords et les coins ; B7 et son miroir B7m sont deux modèles ; le générateur oriente les centrales pour nourrir les jonctions ; tempo plus lent qu'en 4×4, à confirmer à la mesure.

## Retours de l'utilisateur sur le dessin des tuiles (2026-10-17)
- **Constat** : les centrales (surtout C7 / C8 du 5×5 : une croix droite + deux cases vers les coins) donnent un plateau **artificiel et bloquant**, en quadrillage ; l'utilisateur veut un plateau **organique** : quarts de tour, virages en T, tracés variés (croquis de principe fourni).
- **Chemin sans case (« passage »)** : un chemin peut relier deux côtés d'une tuile **sans passer par une case** (le chemin bleu du croquis, en quart de tour). Il est **gratuit** : les cases qu'il relie de part et d'autre sont traitées comme voisines directes (aucun pas de plus).
- **Courbes** : seuls les **passages** sont tracés en courbes ; les chemins entre cases restent droits.
- **Portée** : redessiner les centrales (et les bords si utile) des **deux** catalogues, **4×4 et 5×5**.
- **Virage en T** (image de 4 tuiles fournie par l'utilisateur) : le passage bleu part d'une case, traverse la limite de tuile par un raccord, se **ramifie en T sans case** et mène à deux autres cases, dont une sur la tuile voisine. Les chemins verts relient des cases placées librement ; les tuiles s'assemblent par les raccords des côtés.
- **Coût d'un passage (confirmé par l'utilisateur)** : comme pour la courbe à 90°, aller d'une case à l'autre en empruntant un passage (même long, même ramifié en T) **compte pour une seule action de déplacement** : on arrive directement sur la case au bout du chemin, **sans case intermédiaire**. Les cases reliées par un réseau de passages sont donc **voisines (1 pas)**. Les raccords restent aux **positions standard** des côtés (lecture de l'orchestrateur, nécessaire à l'assemblage).
- **Réponses de l'utilisateur aux avis `38` et `39`** (2026-10-17) :
  - **Apparence** : un passage s'imprime **en vert, comme un chemin**, simplement en courbe (on le reconnaît à l'absence de case) ; pas de rendu distinct.
  - **Pas de passage vers un coin** (jonction) : les passages relient des cases et des côtés seulement.
  - **Bords et coins** : **un passage au plus** par bord ou coin, jamais depuis la case d'apparition.
  - **Pas de paires miroir** : les tuiles doivent fonctionner dans les deux sens par rotation (moins de cartons) ; la paire B7 / B7m du 5×5 est à revoir dans la refonte.
  - Arbitrage de l'orchestrateur sur le reste : modèle et graphe selon `39` (pivots, passages, clique à 1 pas, aucun croisement) ; principes et familles de tuiles selon `38` ; les nouveaux catalogues sont **montrés à l'utilisateur en images avant les mesures**.

## Réponses de l'utilisateur sur les catalogues organiques (2026-10-17, images du `42`)
- **Pas de passage traversant** d'un côté au côté opposé, ni droit ni courbe : O4, O5 (4×4) et P4 (5×5) sortent.
- **4×4 : un seul passage par centrale** : O2 et O3 sortent.
- **Apparition reliée au passage d'une centrale voisine** (rencontre entre tuiles au niveau du plateau) : **acceptable**.
- **Rythme plutôt que densité** (à la place du choix 75–77 / 78–80 en 5×5) : « éviter les longues chaînes de cases » ; sur les exemples, il y a parfois 6 cases d'affilée sans ville ni raccourci, soit autant de tours sans action. **Rester sur un déplacement sain d'environ 3 cases entre deux zones d'intérêt** (ville, passage) ; **la rapidité est plus intéressante** que la densité. Conséquence : moins de cases par tuile si nécessaire, et une mesure « plus longue chaîne de cases sans zone d'intérêt » à ajouter.

## Réponses de l'utilisateur sur la révision « rythme » (2026-10-17, images du `44`)
- **4×4** : « Les centrales doivent avoir plus de chemins ; cela crée trop de déséquilibre entre les deux camps ; il faut plus de routes aux coins. » Le 5×5 est un peu mieux équilibré, mais **les chemins vers le centre montrent un déséquilibre** entre les camps.
- **5×5** : **garder 3 accès aux villes** et **réduire le nombre total de cases** ; **sur les centrales surtout, autoriser plus d'accès**.
- Lecture de l'orchestrateur :
  - les centrales doivent desservir **plus de coins** (jonctions, donc villes), 3 ou 4, par davantage de chemins, avec moins de cases de relais ;
  - l'**équilibre des accès au centre** entre les deux camps devient un critère mesuré ;
  - le plafond « 1 passage par centrale » en 4×4 reste en vigueur (non rouvert).

## Réponses de l'utilisateur sur la révision « centrales ouvertes » (2026-10-17, `45`)
1. **5×5 : plus de cases autorisées** pour retrouver la liberté de placement des villes : on ne vise plus « sous 78 » ; lecture de l'orchestrateur : 78 à 81 cases, avec plusieurs placements de villes admissibles et toujours 3 accès aux villes.
2. **Pas de pose strictement symétrique** : « tant que ça crée de la diversité de gameplay, on peut avoir des chemins différents mais le même nombre de cases par moitié ». Lecture de l'orchestrateur : le générateur cherche **autant de cases dans la moitié verte que dans la moitié rouge** (rangée neutre à part en 5×5), avec des tuiles et des chemins libres de part et d'autre ; l'équilibre des accès au centre reste un critère.
3. **4×4, chaînes de 4 le long du raccourci** : le **raccourci compte comme une zone d'intérêt** dans la mesure du rythme (option 2).
4. **Q2 (Étoile à crochet) gardé.**
5. **P3 (T sans case) n'est pas un traversant** : il porte des cases en plus ; il reste au catalogue.
6. **Coin : K2 inchangé** (pas de coin plus léger).

## Réponses de l'utilisateur après le branchement (2026-10-18, `46`)
- **Jeu imprimé : imprimer davantage.** Les poses restent illimitées au générateur ; on augmente les exemplaires à imprimer pour que la plupart des plateaux générés se montent avec la boîte (cible de l'orchestrateur : au moins 90 % des plateaux générés, mesurés sur 200 par format).
- **Anciens documents : proposer le nouveau catalogue** à l'ouverture (comme pour le passage v1 → v2) ; le document reste inchangé si l'utilisateur refuse.
