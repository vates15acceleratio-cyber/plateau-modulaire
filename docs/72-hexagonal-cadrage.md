# Format hexagonal : feu vert et cadrage (2026-10-19)

**Feu vert de l'utilisateur** (2026-10-19) : « on peut commencer à imaginer le plateau hexagonal ». L'interdiction « ne rien faire, pas même préparer » est levée.

## Choix de l'utilisateur
- **Tuiles hexagonales** qui s'assemblent en un grand hexagone. Les rotations se font par 60°. Les villes sont aux sommets où 3 tuiles se touchent.
- **Petit plateau, environ 19 tuiles** : un hexagone de 3 tuiles de côté (1 + 6 + 12).
- **Point de départ, repris du 5×5** :
  - campements et villes aux jonctions (une intersection = une ville ou un campement ; jetons recto-verso communs) ;
  - 5×5 très connecté (2 cases par tuile, cases à 3 connexions, rythme d'environ 3 cases entre zones d'intérêt) ;
  - passages sans case.
- **Villes à positions fixes** : non retenu comme point de départ. Le placement est à étudier.
- **Déjà décidé** (`18`) : camps = les 3 côtés du grand hexagone les plus proches de chaque joueur ; cases Ø 20 mm.

## Méthode de travail réorganisée (accord de l'utilisateur)
- **Advisors** (Opus, lecture seule) : géométrie, design de jeu, prépresse. Ils mesurent et montrent des images avant tout code.
- **Production, testeur, relecteur** : Sonnet, avec un périmètre de fichiers précis. Plusieurs agents en parallèle quand les fichiers sont distincts.
- **Documentation, CHANGELOG, versionneur** : Haiku.
- **L'orchestrateur** tranche, consigne, et soumet à l'utilisateur les décisions de règle et les images.
- Les décisions propres à l'hexagonal sont consignées ici (`72`), puis dans les documents suivants.

## Réponses de l'utilisateur aux avis 73 et 74 (2026-10-19)
- **6 villes, 3 par camp** ; 18 campements.
- **Rangée du milieu neutre** (5 tuiles) : 5 apparitions par camp, coins E et O neutres. Tuiles pointe en haut, grand hexagone à côté plat face à chaque joueur.
- **Tuiles de 54 mm de côté** : plateau de 468 × 432 mm, 3 planches A3 (10 en A4).
- **Découpe au cutter et à la règle** : traits de coupe imprimés sur les 6 côtés ; disposition qui partage les lignes droites quand c'est possible.
- Questions encore ouvertes : liaison des apparitions le long du bord, disposition des villes, règle des ports (jusqu'à 3 par case), nombre de jetons (24 intersections).
- **Bord droit** (2026-10-19) : l'utilisateur pensait que le bord plat des hexagones formerait le bord du plateau. Or un grand hexagone de tuiles hexagonales a toujours un bord en dents de scie ou en créneaux. Choix retenu : **les 12 tuiles du pourtour (bords et coins) ont un côté extérieur droit**, qui comble les creux. Le plateau est un vrai hexagone à 6 côtés droits ; le centre et la couronne restent des hexagones. Le principe de jeu ne change pas (graphe, intersections, camps).
- **Apparitions reliées le long du bord, comme en carré** : l'anneau du pourtour est gardé, malgré les 2 pas d'une apparition verte à une rouge par le coin neutre. À mesurer, et à signaler si l'équilibre en souffre.
- **Disposition des villes** : « trèfle » par défaut (jonctions 0, 4, 8 / 15, 19, 23, numérotation de `camps.png`). Le générateur peut aussi tirer parmi les dispositions symétriques admissibles.
- **H1 et H2 acceptées** : une case porte jusqu'à 3 ports sur des coins consécutifs, et tous les coins des tuiles intérieures desservent leur intersection.
- **24 jetons recto-verso** (ville / campement) pour tous les formats, au lieu de 16.

## Réponses de l'utilisateur au catalogue candidat (2026-10-19, `75`)
- **Intérieures : HC2 « Deux ponts et traverse » et HC3 « Carrefour »**, sans HC1 : aucun mur, aucun raccord mort. Exception aux règles du carré, pour l'hexagonal seulement : un passage peut traverser la tuile (E–O) et toucher une porteuse.
- **Plateau fini de 498,8 × 432 mm** (hexagone régulier de 249,4 mm de côté).
- **Coupes partagées** : tuiles jointives en nid d'abeille, 3 planches A3 (19 tuiles et 11 de réserve).
- Arbitrage de l'orchestrateur : apparitions imprimées neutres, comme en carré.
- **Suite prévue** : production en lots Sonnet (géométrie du format hex, modèle et graphe, rendu et export, catalogue, générateur, interface), testeur, relecteur, versionneur, PR.
