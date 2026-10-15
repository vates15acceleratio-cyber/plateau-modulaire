# Synthèse des advisors (orchestrateur), 2026-10-15

Sources : `1b-avis-design-jeu-variante-jonctions.md` (design de jeu, version B retenue) et `2-avis-geometrie.md` (géométrie). Ce fichier fait référence pour les sous-agents ; en cas de conflit, il prime sur les avis détaillés et sur les sections 2, 3 et 6 du brief.

## Décisions arrêtées

**Plateau**
- Grille 4×4 de tuiles carrées de **12 cm** : plateau de 48 × 48 cm.
- Joueur 1 au nord, joueur 2 au sud.
- Rôles fixés par la position : 4 **coins**, 4 **bords neutres** (est / ouest), 4 **apparitions** (2 au milieu de la rangée nord pour J1, 2 au milieu de la rangée sud pour J2), 4 **centrales**.

**Villes**
- **Jetons ronds de 3 cm** posés sur les 9 jonctions intérieures : 7 villes et 2 carrefours (case de déplacement).
- Jonctions laissées en carrefour : jamais les 2 du même côté.

**Tuiles**
- Les cases des tuiles sont de type `deplacement` ou `apparition` ; le type `capture` n'existe que sur les jetons.
- Raccords latéraux : 3 positions par côté, à 3, 6 et 9 cm ; un seul type de raccord ; raccord sur un chemin.
- Ports de coin obligatoires sur chaque coin intérieur : centrale 4, bord 2, coin 1. Une case porte au plus un port de coin.
- **Centrales : 4 cases** (arbitrage en faveur de la géométrie). **Coins et bords neutres : 3 cases. Apparitions : 3 cases, dont 1 apparition et 2 de déplacement.**
- **Décompte (correction de l'orchestrateur)** : avec « 2 à 3 cases » sur les tuiles de pourtour, on obtenait entre 38 et 50 cases de déplacement (≈ 45 en moyenne), et le garde-fou « 45 à 55 » de la version B était presque irréalisable. Avec la composition ci-dessus : 4 × 4 (centrales) + 4 × 3 (coins) + 4 × 3 (bords) + 4 × 2 (apparitions) + 2 carrefours = **50 cases de déplacement**, plus 4 apparitions et 7 villes. Le total est donc fixe : le garde-fou sur le nombre de cases devient un simple contrôle de validation des modèles.
- Raccords comptés en côtés non vides : centrale ≥ 3, bord ≥ 2.

**Règles de raccord et de rotation**
- Représentation, rotation et appariement : voir `2-avis-geometrie.md`, sections D3 et D4, avec les cas de test T1 à T4.
- Raccord mort ou face au vide : **permis avec alerte**, sans blocage.
- Rotation déduite automatiquement pour les coins, bords et apparitions ; libre (90°) pour les centrales seulement.

**Catalogue (point de départ)**
- 6 centrales, 5 coins, 5 bords neutres, 2 modèles d'apparition × 2 : **20 tuiles + 9 jetons**, 16 tuiles posées par partie.

**Équilibre**
- Distance = plus court chemin depuis l'apparition la plus proche.
- On trie les 7 distances de chaque joueur ; alerte si l'écart dépasse 2 à un rang de 1 à 4 ; alerte secondaire à 5 villes contre 2.

**Cotes d'impression (validées par l'advisor prépresse, `6-avis-prepresse.md`)**
- Chemins de 8 mm prolongés dans le fond perdu ; zone de coin R = 20 mm ; **cases à au moins 4 mm de la coupe**.
- Coupe à 120 mm, **tolérance −0,5 / 0 mm** ; fond perdu 3 mm ; zone de sécurité 4 mm ; jeton centré à ±3 mm ; carton 1,5 à 2 mm.
- Export : planches A3 (6 tuiles) ou A4 (2 tuiles) avec repères de coupe et barre de 100 mm ; planche de jetons A4 ; plateau assemblé en aperçu seulement. PDF / SVG vectoriels à l'échelle exacte, PNG 300 dpi. PDF par générateur maison ou jsPDF seul.
- Couleurs : vert `#007A4D`, rouge `#D8321C`, noir `#111111`, blanc ; codes de forme pour apparition (carré + chiffre), ville (couronne), carrefour (croix).

**Interface (`5-avis-ergonomie.md`)**
- Deux onglets Plateau / Tuiles, bibliothèque de modèles commune avec nombre d'exemplaires, modèle `complet | incomplet`, historique annuler / rétablir unique par document.

**Écran d'assemblage**
- Aimantation sur cellule de grille (rayon 6 cm) et sur jonction (rayon 15 mm).
- Refus et alertes : voir `2-avis-geometrie.md`, section D10.

## Réponses de l'utilisateur (2026-10-15)
- **Forme** : choix conservé entre **4×4 complet** et **4×4 avec 1 ou 2 coins retirés** (ou un coin et son bord est / ouest). Le générateur aléatoire ne travaille que sur le 4×4 complet.
- **Écart entre villes : 3 pas** (au moins 2 cases intermédiaires), garanti par la conception des tuiles. `ecartMinCaptures` reste un paramètre.

## Précisions issues du sous-agent 1 (modèle de données)
- **Formes valides** : 4×4 complet ; 1 ou 2 coins retirés (quelconques) ; ou 1 coin + le **bord neutre de la même colonne** ((0,0)+(0,1), (0,3)+(0,2), (3,0)+(3,1), (3,3)+(3,2)). Une apparition voisine d'un coin retiré reste une apparition ; son raccord vers le vide devient un raccord mort (alerte).
- **Cas T4 corrigé** : sans la tuile (0,0), la jonction (1,1) reçoit 2 ports (coin 3 de l'apparition (1,0), coin 0 de la centrale (1,1)) pour 3 tuiles. Le jeton est refusé à cause de la règle « 4 tuiles autour », pas du nombre de ports.
- Retirer ou tourner une tuile retire les jetons devenus invalides.
- **Tuile de coin : ses 2 côtés intérieurs doivent porter un raccord** ; un coin de tuile porte au plus un chemin (règle `coin_double`).
- **Camp d'une apparition : déduit de la cellule** (rangée nord = J1, sud = J2), pas stocké dans le modèle ; le refus « apparition du mauvais camp » (D10) est donc sans objet.
- Points ouverts pour l'interface et les contrôles (sous-agents 3 et 4) :
  - tuiles posées quand on change la forme (rotations et rôles non recalculés) ;
  - **jetons retirés automatiquement** par `retirerTuile` / `tournerTuile` : l'interface doit le **montrer** (message + annulable), jamais en silence (piège n° 1 de l'ergonomie) ;
  - **ports de coin morts** : dans les formes réduites, certains ports visent une jonction qui ne pourra jamais porter de jeton ; `raccordsMorts` ne couvre que les raccords latéraux, le module de contrôles doit signaler aussi ces ports ;
  - **revalidation du plateau entier** après modification d'un modèle déjà posé (rôle changé, exemplaires réduits, modèle devenu incomplet) : fonction à prévoir dans le module de contrôles ;
  - contrôle du chevauchement chemin / case à ajouter dans `PM.modele.regles`.
- **Catalogue réel : confié à un sous-agent** (décision de l'utilisateur du 2026-10-15 : il ne dessine pas les tuiles). Un sous-agent « catalogue » (Opus, avec l'advisor design de jeu en validation) produira les 20 tuiles (6 centrales / 5 coins / 5 bords / 2 apparitions × 2) dans `src/catalogue.js` (`PM.catalogue`, chargé par `<script src>`, pas de JSON lu en `file://`), chaque modèle validé par `validerModele`. Lancé après les corrections du module 1. L'éditeur de tuile sert alors à retoucher, pas à créer de zéro.

## Points qui étaient en attente (résolus ci-dessus)
1. **Forme du plateau (fonctionnalité 3 du brief)** : la géométrie supprime les deux modes d'origine. Le rectangle devient une taille unique, 4×4 (4×3 n'offre que 6 jonctions). La silhouette libre se réduit à « 4×4 avec 1 ou 2 coins retirés » (ou un coin et son bord est / ouest). Garder ce choix « 4×4 / 4×4 moins des coins », ou le retirer ?
2. **Écart entre villes** : 3 pas (défaut, garanti localement par la conception des tuiles), ou 4 pas (3 cases intermédiaires) ? Avec 4 pas, la garantie locale tombe, les centrales demandent probablement plus de 4 cases, et le catalogue et les règles de validation changent. Le modèle de données, lui, ne change pas (`ecartMinCaptures` est un paramètre) : le sous-agent 1 peut démarrer avant la réponse, pas le catalogue.
3. **Taille du catalogue** : 20 tuiles proposées ; à ajuster après les premiers essais.

## Suite (ordre du brief, section 8.4)
1. Advisors prépresse et ergonomie (cotes définitives, maquette d'écran).
2. Sous-agent 1 : modèle de données et validation, avec les cas T1 à T4 en tests.
3. Sous-agents 2 à 5, puis 6 ; testeur et relecteur après chaque module.
