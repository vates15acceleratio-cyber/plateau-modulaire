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

## Réponses de l'utilisateur aux mesures définitives des catalogues organiques (2026-10-18, `48`)
1. **Seuil d'alerte S par format** : 4×4 inchangé (alerte S ≥ 5, information S = 4) ; **5×5 : alerte S ≥ 7, information S = 5 ou 6** (revirement assumé sur la constante commune du `36`) ; le générateur continue de rejeter S ≥ 5 dans les deux formats.
2. **Goulets 5×5** : le générateur **préfère** les plateaux sans point d'articulation (préférence, pas rejet ; objectif ≈ 0 %).
3. **4×4 : « jonctions variées » par défaut** (12 placements de villes au lieu de 3).
4. **Rythme et accès au centre : information seulement**, jamais d'alerte ; texte « bien au-dessus de la cible » si chaîne ≥ 7 ou distMax ≥ 6.

## Réponses de l'utilisateur à la revue de la branche `passages` (2026-10-18, `51`)
- **Rejet de S au générateur** : comportement inchangé depuis la 3.04 : **5×5 : rejet de S ≥ 5 ; 4×4 : pas de rejet, classement des candidats par S** (sans effet pratique, S ≤ 1 sur les plateaux 4×4 générés). *Note de l'orchestrateur* : la phrase « le générateur continue de rejeter S ≥ 5 dans les deux formats » de la section précédente venait d'une question mal formulée par l'orchestrateur ; elle est remplacée par la présente.
- **Format des documents** : un document dont un modèle a des passages ou des pivots est écrit en **`version: 3`** ; la 3.04 le refuse alors avec un message clair au lieu de perdre les passages sans prévenir. Les documents v1 et v2 s'ouvrent toujours.

## Remarques de l'utilisateur après essai de la 4.00.0 (2026-10-18)
- **5×5 seulement** (le 4×4 garde ses règles) :
  - **plus de connexions par case, trois idéalement** : les cases à **deux connexions** doivent représenter **moins de 5 %** des cases (mesure de l'orchestrateur sur 40 plateaux générés en 4.00.0 : 62 % de nœuds à 2 voisins en 5×5, 58 % en 4×4) ;
  - **plus d'interconnexions entre tuiles** ;
  - **deux cases par tuile au maximum, sur toutes les tuiles** (coins et bords compris, case d'apparition comprise). Jugement de l'utilisateur sur le 5×5 actuel : « terrible ».
- Connexions sans case supplémentaires dans l'éditeur : abandonné (« oublie ça »).
- Conséquences à étudier par les advisors (non encore tranchées) : un coin à 2 cases ressemble au coin direct K1 retiré en v2 ; au plus 50 cases de tuiles + 9 jonctions-cases ≈ 59 cases (décision précédente : 78 à 81) ; règles R1 à R4 (écart d'au moins 3 cases entre villes) et « 3 accès aux villes » à confronter à l'objectif de degré 3.

## Décisions de l'utilisateur pour le 5×5 très connecté (2026-10-18, `53`, `54`, `55`)
- **Voie « porteuse latérale + relais »** (`53`, vérifiée en `55`) pour un **nouveau catalogue 5×5 à 2 cases par tuile, 59 cases par plateau**, qui remplace entièrement le catalogue 5×5 de la 4.00.0 (le 4×4 ne change pas). Conséquences acceptées avec ce choix : R1 levée (une case peut porter 2 ports, sur les deux coins d'un même côté) et R3 levée en partie, en règles **propres au 5×5** ; R2 assouplie, R4 gardée ; paire basse (E2 / O0) sur le pourtour ; coin à deux cases (première ville à 2 pas de l'apparition, comme l'ancien K1).
- **« Deux ponts » (LC4) gardé avec ses murs** (2 raccords morts par pose acceptés).
- **« Pont et fourche » (LC3) gardé sur quelques tuiles** (environ 3 centrales sur 9), pour le côté organique.
- **Écart d'au moins 3 cases entre villes maintenu**, garanti par le placement des villes (générateur ; aide au placement et alerte dans l'éditeur), plus par les tuiles.

## Réponses de l'utilisateur sur le 5×5 très connecté réalisé (2026-10-18, `56`)
1. **Rythme** : « chaque intersection sera un point d'intérêt désormais, les règles ont été un peu révisées » : toute **jonction** (ville ou jonction-case) compte comme zone d'intérêt dans la mesure du rythme. Lecture de l'orchestrateur : dans les deux formats (c'est une règle de jeu), la cible de chaîne reste 3.
2. **Composition 5×5** : bords et coins gardent leur composition ; **plus de choix dans les tuiles centrales** qu'aujourd'hui (nouveaux modèles de centrales, dans les règles du 5×5 très connecté ; tirage plus varié des centrales, stock à recalculer).
3. **Murs voulus** (« Deux ponts ») : les raccords morts face à un mur voulu passent **en information**, plus en alerte ; les autres raccords morts restent des alertes.
4. **« Placer les villes »** : gardé dans les deux formats.

## Choix de l'utilisateur sur les nouvelles centrales 5×5 (2026-10-18, `58`)
- **Jeu « B3 »** : centrales LC1 ×2, LC2 ×1, LC3 ×3, LC4 ×1, **LC5 Pont et carrefour ×2, LC6 Pont et fourche libres ×1, LC7 Pont et relais libres ×2** (12 centrales, 28 tuiles au total, 5 planches A3). LC8 à LC10 non retenues.
- **Environ 57 cases par plateau** acceptées (LC5 n'a qu'une case).

## Réponses de l'utilisateur aux mesures définitives du 5×5 très connecté (2026-10-18, `60`)
1. **Seuil S en 5×5 : alerte à 5, information à S = 4** (comme en 4×4 et comme le rejet du générateur ; revient sur la décision 1 du `48`, qui tenait au catalogue 4.00.0). Le conseil « 3 villes du milieu » (périmé) est remplacé par un renvoi à « Outils > Placer les villes ».
2. **Cases à ≤ 2 connexions : information** (pas d'alerte).
3. **« 4 contre 3 » : 8 villes en 5×5, toujours 8**, « pour garder un jeu symétrique » (4 villes par camp). Le 4×4 garde 7 villes. À étudier par l'advisor design de jeu (placements, écart de 3 cases, critères d'équilibre à adapter) avant production ; il faut 8 jetons ville à imprimer en 5×5.
4. **Goulets en 4×4 : la préférence anti-goulets s'étend au 4×4.**

## Décisions de l'utilisateur sur les 8 villes en 5×5 (2026-10-19, `62`)
1. **8 villes en damier** acceptées : avec le catalogue livré, deux dispositions seulement (« 2-2-2-2 », damiers pair et impair), 4 villes par camp (j ≤ 2 / j ≥ 3), symétrie par demi-tour. Énumération générique conservée (des tuiles de l'utilisateur peuvent rendre d'autres placements admissibles).
2. **Partage non symétrique (4/3/1) : préférence seulement** au générateur (pas de rejet) ; information dans l'éditeur ; « Placer les villes » préfère un partage symétrique.
3. **Critères à 8 villes** : S sur 8 rangs (alerte 5, information 4), écart par rang inchangé (alerte > 2, blocage > 3), **« 6 contre 2 » bloquant, « 5 contre 3 » en alerte**. Le 4×4 garde 7 villes et ses critères.
4. **Jetons : une planche de 8 pour tous les formats** (1 jeton de réserve en 4×4).
5. **Anciens documents 5×5 à 7 villes : proposer de régénérer le plateau** à l'ouverture (refus : document inchangé, avec la lacune « il manque 1 ville » ; acceptation annulable par Ctrl+Z).

## Nouvelle consigne de l'utilisateur sur les villes et les intersections (2026-10-19, image fournie)
Remplace, pour le 5×5, les décisions « 8 villes en damier » de la section précédente (points 1 et 2).
- **Position par défaut des 8 villes, toujours la même** (lecture de l'orchestrateur sur l'image, jonctions (colonne i, rangée j) de 1 à 4) : **(1,1), (4,1), (2,2), (3,2), (2,3), (3,3), (1,4), (4,4)** — les deux jonctions extrêmes des rangées 1 et 4 et le carré central ; 4 villes par camp, figure symétrique. Le générateur pose les villes à ces positions ; **l'utilisateur décide s'il veut les déplacer**.
- **Alerte bloquante s'il y a plus de 8 villes** (pose de l'utilisateur).
- **Les cases blanches aux intersections deviennent des « campements »** : une intersection est **soit un campement, soit une ville**. Positions prédéfinies par le générateur ; l'utilisateur les modifie s'il le souhaite. (Nouveau vocabulaire : « campement » remplace « jonction-case » dans l'interface et les textes.)
- « Je ne pense pas que tu aies besoin de changer grand-chose. »
- **À vérifier à la reprise (orchestrateur)** : avec ce motif fixe, (2,2)–(3,2) et (2,3)–(3,3) sont des jonctions voisines, que les porteuses latérales du catalogue B3 peuvent mettre à 2 pas ; le générateur doit donc orienter les centrales pour tenir l'écart d'au moins 3 cases et les 3 ports aux villes — à mesurer ; si c'est impossible ou trop rare, soumettre à l'utilisateur l'assouplissement de l'écart pour les villes par défaut. Critères à 8 villes (`62` § 2 ; « 6 contre 2 », « 5 contre 3 », S sur 8 rangs), planche de 8 jetons et proposition de régénérer les anciens 5×5 restent valables. Le travail partiel de `wip-8-villes` (placement générique en damier) est en grande partie dépassé.
- **Apparence des campements** (complément du 2026-10-19) : un campement a **la même taille qu'une ville** (jeton Ø 30) et porte une **icône de feu de bois** (à dessiner dans la palette d'impression, lisible sans la couleur ; à faire valider par l'advisor prépresse).

## Réponses de l'utilisateur à la reprise (2026-10-19)
- **Campements dans les deux formats** : le mot « campement » et le jeton de la taille d'une ville avec une icône de feu de bois s'appliquent aussi au 4×4.
- **4×4 inchangé pour les villes** : 7 villes, positions choisies par le générateur comme aujourd'hui.
- **Si l'écart de 3 cases ne tient pas assez souvent** entre les villes voisines du carré central du 5×5 ((2,2)–(3,2) et (2,3)–(3,3), puis les paires verticales) : **assouplir à 2 cases pour ces villes du carré central seulement** ; l'écart d'au moins 3 cases reste la règle partout ailleurs.
