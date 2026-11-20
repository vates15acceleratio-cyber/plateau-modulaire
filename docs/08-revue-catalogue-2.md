# Catalogue 2 et étape « Villes » : revue de code (2026-11-20)

Relecteur en lecture seule. Périmètre : `git diff 3c36bd9..HEAD -- atelier` (état `2a4c0d3`). Règles de référence : `docs/00-direction.md` (décisions du 2026-11-19, première et seconde série) et `docs/02-atelier-cahier-des-charges.md` §9.

## Méthode et limites

- Lecture complète de `catalogue.js`, `controles.js`, `plateau.js`, `generateur.js`, `vue-villes.js`, `outils/verifier-regles.js`, `outils/empaqueter.py`, `index.html` ; lecture ciblée de `partie.js`, `vue-plateau.js`, `vue-creation.js`, `vue-partie.js`, `vue-bibliotheque.js`.
- **Non lus** : les diffs de `rendu.js`, `vue-inventaire.js`, `styles/creation.css`, `outils/recette.js`, `outils/mesures-catalogue-2.js`, `README.md` et des fichiers de tests ; la plus grande partie de `vue-creation.js` et de `vue-plateau.js` (seuls les passages cités ici ont été lus). L'onglet Inventaire n'a donc pas été relu.
- Scripts Node écrits hors du dépôt (dossier temporaire de la session), dont **un vérificateur des règles écrit par moi**, qui ne reprend ni `AT.controles` ni `outils/verifier-regles.js` (rotation, voisinage, parcours, bords, flancs et comptes refaits). Trois verdicts comparés : le mien, `K.tout`, `verifier`.
- `node --test` depuis `atelier/` : **310 OK, 0 échec**.
- **Aucun navigateur.** Tout ce qui touche à l'écran est « lu seulement ». Les deux recettes navigateur n'ont pas été relancées. `Atelier.bat` n'a pas été lancé, rien n'a été écrit dans `dist/`, rien n'a été committé.
- Chaque constat porte « reproduit » (script exécuté, résultat observé) ou « lu seulement ».

## Verdict

**Aucun constat bloquant.** Le générateur, les contrôles et le vérificateur du développeur sont d'accord entre eux et avec mon vérificateur sur tous les plateaux générés. Les fichiers des deux catalogues précédents s'ouvrent, se réenregistrent et portent une partie.

Quatre constats importants, qui sont autant des questions de règle que des défauts :

1. un plateau complet d'hier est présenté comme un chantier de 14 pièces (I1) ;
2. une tuile de terrain d'une case ou un monobloc tout en plaine laissent le plateau « complet, aucune erreur » (I2) ;
3. « ville neutre tenue par 2 tuiles » est codé « 2 cases », et 45 % des villes neutres générées ne touchent qu'une seule pièce (I3) ;
4. une ville neutre posée sur un flanc mais hors du tiers central est mise en erreur, alors que ce tiers central est un réglage provisoire (I4).

## Vérifié et trouvé juste

| Sujet | Essai | Résultat |
|---|---|---|
| Plateaux générés | 302 plateaux (graines 1 à 80 × 4 réglages : défaut, 2 remplissages, extrémités de 3 rangées, de 1 rangée) jugés par mon vérificateur, `K.tout` et `verifier` | 0 divergence. Échecs de génération : 0 sur 80 pour les trois premiers réglages, **18 sur 80 à 1 rangée** (cause connue, `docs/07`). `docs/04` annonçait 15 sur 100 avec le jeu de pièces d'hier : le taux mesuré ici, sur le catalogue sans monobloc tout en plaine, est plus haut (22 % contre 15 %) |
| Déterminisme | même graine générée deux fois, 302 fois ; `poserAuto` deux fois | identique |
| Usage des pièces | noyau, 2 montagnes, 21 monoblocs, une fois chacun | toujours |
| Catalogue | 21 monoblocs (9 de 3 cases, 12 de 4), 49 / 13 / 13, aucun tout en plaine, aucune ville, aucune pièce en double à rotation près | conforme à §9.5 |
| `VD` fautives (en mémoire) | sur forêt, sur le noyau, hors du bord, camp inversé, 3 pour un camp, `camps` falsifié, deux `VD` à 3 pas | erreur de `K.tout` à chaque fois, d'accord avec les deux vérificateurs |
| `VN` fautives | au-dessus du plateau, sur une Plaine (chevauchement), deux sur le même flanc | erreur à chaque fois, d'accord avec les deux vérificateurs (le tiers central : voir I4) |
| Contact | 60 plateaux bâtis au seuil 2, jugés au seuil 3 | 46 plateaux sur 60 ont une faute de contact ; 60 accords sur 60 entre les trois vérificateurs |
| Plateau construit sans villes | `retirerToutes` sur un plateau généré | `ok = true`, étape « villes », 0 erreur, 1 alerte, `camps` vides, champ `deploiements` absent |
| `deploiements` et `camps` | 697 retouches acceptées tirées au hasard (retirer, tourner, peindre, gommer, poser pièce, `VD`, `VN`, pose libre ou non) | après chacune : `camps` = `campsAuto`, toute `VD` sur une Plaine, fichier relu à l'identique |
| Propositions de villes | 875 propositions sur 40 terrains appliquées par `autreProposition` | toutes « complet » sans erreur ; score du tri = score affiché ; rang croissant |
| Meilleure combinaison | la combinaison du générateur comparée à la liste triée | toujours au meilleur score de la liste |
| `profondeurExtremite` | graine 2 générée à 3 rangées : champ écrit, sans erreur, même avec l'option 1 ; privée de son champ : en erreur ; généré à 2 : champ absent ; fichier avec `2` explicite : accepté, champ retiré | le document prime sur l'option, conforme à `docs/04` |
| Anciens fichiers | `fixtures-v1` et `fixtures-v2` : 4 plateaux, 2 parties, 2 bibliothèques (4 fiches) | tout s'ouvre, se réenregistre à l'identique, se réexporte ; `partie.creer` réussit sur les 8 plateaux |
| Verdict d'hier sur les anciens fichiers | code de `3c36bd9` sur `fixtures-v1`, code de `a4aa673` sur `fixtures-v2` | mêmes nombres d'erreurs qu'aujourd'hui (0, 1, 0, 0) ; seule la présentation de `fixtures-v2` change (I1) |
| Table de jeu | former sur sa `VD` (accepté), sur celle de l'adversaire et sur une ville neutre (avertissement bloquant), 8 événements forcés sur une `VD` et sur une `VN` (16 refus), enregistrer puis recharger | conforme |
| Fichiers hostiles | 34 cas sur `deploiements`, `profondeurExtremite`, `role`, `noyau`, `__proto__`, `constructor`, `toString`, clés mal formées, version, `VD` sur `VN` / noyau / événement, par `plateau.valider` et par `partie.charger` | 34 refus sur 34 ; `Object.prototype` intact |
| DOM | recherche de `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval`, `new Function`, `document.write`, `style` dans `atelier/src` | rien : 4 lignes trouvées, toutes des commentaires (`rendu.js:10`, `vue-villes.js:11`, `vue-creation.js:10`, `vue-partie.js:12`) ; `rendu.js:135` refuse l'attribut `style` |
| CSP | diff de `index.html` | une seule ligne ajoutée (`vue-villes.js`), politique inchangée |
| Paquet | `index.html` cite 19 scripts et 4 feuilles ; `git ls-files atelier/src atelier/styles` rend les mêmes 23 fichiers, `vue-villes.js` compris ; `empaqueter.py` emballe `index.html`, les deux lanceurs, `src`, `styles` suivis par git | complet (lu et listé, archive non fabriquée) |

## Bloquant

Aucun.

## Important

### I1. Un plateau complet du catalogue d'hier s'affiche « Construction en cours : 14 pièces de terrain à poser » — reproduit (modèle), lu seulement (écran)

- **Où** : `atelier/src/controles.js:259-266` (`resteConstruction`), `:128-129` (alerte « Pièces de terrain restantes »), `:590-600` (`etape`) ; repris par `atelier/src/vue-plateau.js:583-596`, `atelier/src/vue-creation.js:122-140` (« reste à faire ») et `atelier/src/vue-villes.js:373-374`.
- **Scénario** : ouvrir `atelier/tests/fixtures-v2/plateau-genere.json` (plateau complet, 7 villes, enregistré hier). Avec le code d'hier (`a4aa673`) : `ok`, 0 erreur, 0 alerte, « Plateau complet ». Aujourd'hui : `ok`, 0 erreur, **2 alertes**, `etape = 'construction'`, « Construction en cours : 14 pièces de terrain à poser », alerte « Pièces de terrain restantes (14) : 1 × Haie, 1 × Taillis… » et alerte « 14 monoblocs d'un ancien catalogue ». Même résultat pour `plateau-retouche.json`.
- **Conséquences lues dans l'interface** : titre « Construction en cours », groupe « Villes » marqué « après la construction » alors que les 6 villes sont posées, panneau « Villes » : « Le terrain n'est pas fini (14 pièces de terrain à poser) », liste « reste à faire » de 14 pièces. Rien n'est bloqué : la partie se crée, les villes se retouchent.
- **Jugement** : pas acceptable tel quel. Le message invite à poser 14 pièces sur un plateau qui a déjà ses 21 monoblocs ; qui le suit obtient 35 monoblocs. Le plateau n'a pas changé, c'est le catalogue qui a changé.
- **Comportement proposé** : un troisième état, distinct de « ancien catalogue (tuiles d'une case) ». Quand un plateau porte au moins un monobloc retiré (`ancien: true`, plusieurs cases) et aucune tuile `V` :
  - titre « Plateau du catalogue précédent » et une phrase : « 14 de ses monoblocs ne sont plus au catalogue imprimé ; il reste lisible, jouable et modifiable » ;
  - pas de « pièces de terrain restantes », pas de liste « reste à faire » pour la construction ;
  - l'étape se juge sur les villes seules (« complet » si elles sont toutes posées) ;
  - l'alerte « 14 monoblocs d'un ancien catalogue » reste, c'est la seule utile.
  - À décider par l'utilisateur : faut-il en plus proposer « convertir vers le catalogue actuel » ? Je ne le recommande pas (les formes ont changé, la conversion ne peut pas être fidèle).

### I2. Une tuile de terrain d'une case, ou un monobloc tout en plaine, laissent le plateau « complet, aucune erreur » — reproduit

- **Où** : `atelier/src/controles.js:109-114` et `:137-140` (tuiles d'une case : alerte « à prévoir en plus »), `:102-105` et `:141-144` (monobloc retiré : alerte), `:158-168` (monobloc personnel tout en plaine : alerte), `:590-600` (`etape`).
- **Scénarios**, tous sur un plateau généré auquel on ajoute une pièce (graines 1 ou 2) :

  | Ajout | `K.tout` | Mon vérificateur | `verifier-regles.js` |
  |---|---|---|---|
  | forêt d'une case peinte en (0,-5) | `ok`, « complet », 0 erreur, 1 alerte | terrain d'une case | B1 : pièce de terrain de 1 case |
  | marais d'une case peint | idem | idem | idem |
  | 3 plaines peintes (2 `R`, puis 1 `P` hors stock) | idem | terrain d'une case `P` | B1 |
  | montagne d'une case `M1` | `ok`, « complet », 2 alertes | montagne de 1 case | B1 |
  | monobloc `P3A` (retiré, tout en plaine) | `ok`, « complet », 1 alerte | monobloc tout en plaine | B1 |
  | monobloc personnel tout en plaine de 2, 5 ou 6 cases | `ok`, « complet », 1 alerte | hors catalogue | hors catalogue |

- **Lecture** : c'est le comportement écrit au §8.1 et au §9.4 (« tuile peinte = hors catalogue, annoncée en alerte »), donc pas un écart au cahier des charges. Mais les décisions 1 et 8 de la seconde série disent « plus de tuile de terrain d'une seule case » et « pas de monobloc tout en plaine ». L'écran affiche « Plateau complet » et « Aucune erreur, 1 alerte » pour un plateau qui enfreint ces deux règles ; le vérificateur du développeur, lui, le déclare non conforme. Les deux outils du dépôt ne disent pas la même chose du même plateau.
- **Proposition** : soit passer ces constats en erreur (le pinceau reste un outil d'essai, mais le plateau n'est plus « conforme »), soit garder l'alerte et ne plus écrire « Plateau complet » sans réserve (« complet, avec N tuiles hors règle »). Le choix revient à l'utilisateur (question 1).
- **Même sujet, reproduit** : une pièce personnelle de 5 cases qui porte une forêt (1 forêt + 4 plaines, graine 1) ne reçoit **aucun** constat : `ok`, « complet », 0 erreur, 0 alerte. `controles.js:158-174` ne regarde que « tout en plaine » et « montagne hors bloc », alors que la règle dit « monoblocs de 3 ou 4 cases ». Les tailles 2 et 6 passent par le même code (lu seulement).

### I3. « Ville neutre tenue par 2 tuiles » est codé « 2 cases » : 45 % des villes neutres générées ne touchent qu'une seule pièce — reproduit

- **Où** : `atelier/src/plateau.js:801` et `:814-815` (`voisinesLa.length < contact`), `atelier/src/catalogue.js:189` (`contactVilleNeutre: 2`, commenté « cases du plateau »), `atelier/outils/verifier-regles.js:148-150` (même compte en cases).
- **Mesure** : graines 1 à 120, 240 villes neutres générées : **108 touchent une seule pièce** (deux cases du même monobloc). Sur 739 places admissibles, 373 ne touchent qu'une pièce.
- **Écart de mots** : `docs/07-mesures-catalogue-2.md` ligne 236 dit bien « 2 cases, compté en cases et non en pièces ». Mais ce qui est consigné comme accepté par l'utilisateur (`docs/00-direction.md`, seconde série, point 7 ; `docs/02` §9.5) est « ville neutre tenue par **2 tuiles** ». Depuis le catalogue 2, une tuile est un monobloc de 3 ou 4 cases. Contrôles et vérificateur sont d'accord entre eux, mais peut-être pas avec ce que l'utilisateur a compris.
- **Proposition** : poser la question (question 2). Si la réponse est « 2 pièces », le changement tient en une ligne dans `refusNeutreSurCases` et une dans le vérificateur ; il faut alors remesurer les places (environ la moitié disparaît).

### I4. Une ville neutre sur un flanc, hors du tiers central des rangées, est une erreur : un réglage provisoire refuse un plateau peut-être conforme — reproduit

- **Où** : `atelier/src/plateau.js:807-812` (`neutresTiersCentral`), `atelier/src/catalogue.js:188`, `atelier/outils/verifier-regles.js:144` et `:154`.
- **Scénario** : plateau généré (graine 1), une ville neutre déplacée en (-5,-3) : flanc gauche, contre le bord, 2 cases touchées, à 4 pas de toute ville. Mon vérificateur, qui applique la phrase de l'utilisateur (« tuiles placées aux extrémités, sur les côtés, pas sur une Plaine »), la dit conforme. `K.tout` : erreur « Une ville neutre se pose à mi-hauteur du plateau (rangées -2 à 2) ; cette case est en rangée -3 ». `verifier-regles.js` : faute B5.
- **Lecture** : le tiers central est noté « provisoire » au §9.1 (B5). Il est pourtant appliqué en erreur par les contrôles, par le générateur (aucune ville neutre générée n'en sort) et par le vérificateur, et le panneau l'écrit comme une règle (M9). Si « aux extrémités, sur les côtés » veut dire autre chose que « à mi-hauteur », l'outil refuse des plateaux conformes et n'en propose aucun de cette sorte.
- **Proposition** : question 3. En attendant, soit descendre ce constat en alerte, soit écrire « réglage provisoire » dans le message et dans le rappel des règles.

## Mineur

### M1. `etape()` déclare « ancien catalogue » un plateau du catalogue 2 qui porte une forêt peinte — reproduit
`atelier/src/controles.js:593` : `ancien` est vrai pour toute tuile d'une case marquée `ancien`, donc pour `F`, `S` et `P` que le pinceau pose encore. Plateau vierge + une forêt peinte : « Construction en cours : 23 pièces de terrain à poser. Ce plateau porte des tuiles de l'ancien catalogue. » L'écran retire la phrase par un remplacement de texte (`atelier/src/vue-plateau.js:582-588`), ce qui masque le défaut sans le corriger. Quatre définitions de « ancien » coexistent : `controles.js:87` (tuile `V`), `controles.js:593` (toute tuile d'une case ancienne), `vue-creation.js:92-94` (tuile `V`), `vue-creation.js:133-134` (pas de ville du catalogue 2 et une ville de rangée extrême). À unifier dans le modèle, avec I1.
Effet lié, reproduit : une seule tuile `V` (elle ne vient que d'un fichier) fait basculer un plateau du catalogue 2 en « ancien ». Plateau vierge + `F31` + une `V` : l'alerte « Pièces de terrain restantes (22) » disparaît, remplacée par « Plateau de l'ancien catalogue : 1 tuile d'une case ». Rien n'est caché pour autant : le contrôle des villes passe alors à l'ancien mode et rend 3 erreurs.

### M2. La pose automatique échoue si une tuile d'événement couvre la Plaine choisie — reproduit
`atelier/src/vue-villes.js:227` calcule le terrain sans les événements, puis `:241` pose par `poserVilleDeploiement`, qui les voit. Plateau généré (graine 7), villes retirées, « Inondation » posée à l'essai en (2,-5) : « Pose automatique impossible : Ville de déploiement en (2,-5) : Cette case porte une tuile d'événement. » D'autres combinaisons existent. « Autre proposition » peut rester bloquée de la même façon, puisque le rang n'avance pas après un refus (lu seulement : dans mon essai, la proposition suivante évitait la case). Correction : chercher sur le terrain avec événements, ou écarter ces Plaines des candidates.

### M3. « Autre proposition » ne parcourt pas toutes les combinaisons valides — reproduit
`atelier/src/generateur.js:355-367` : pour chaque quadruplet de villes de déploiement, une seule paire de villes neutres est retenue. Graine 7 : 105 propositions listées, **661** combinaisons valides en comptant toutes les paires de villes neutres ; graine 12 : 10 pour 20. Le meilleur score est le même (2 et 4), donc la pose automatique n'y perd rien. Mais le commentaire `:383` (« Toutes les façons valides ») et le message « n° 3 sur 105 » promettent plus que ce qui est fait : une ville neutre ne bouge jamais tant que les villes de déploiement ne changent pas. À dire dans le message, ou à compléter.

### M4. Mesure d'équilibre : un terme à moitié vide, et pas de sens — reproduit
`atelier/src/controles.js:489-518`.
- Le coût d'entrée d'une ville vaut 1 des deux côtés, donc le coût de Vert vers une ville de Rouge égale le coût inverse. Le plus petit des deux coûts « adverses » est **toujours identique** pour les deux camps (302 plateaux sur 302). La ligne « Villes de déploiement adverses » ne mesure en réalité que l'écart du second rang ; il est non nul sur 68 plateaux sur 302.
- Le score additionne des valeurs absolues : il ne dit pas si les écarts profitent tous au même camp ou se compensent. Graine 85 : score 9, et les trois écarts vont à Vert (centre 4 contre 7, villes neutres 4 contre 8 et 7 contre 8). 58 plateaux sur 302 ont au moins deux écarts non nuls (centre et villes neutres) et les ont tous du même côté.
- Aucun biais de camp : écart signé moyen vers le centre +0,01, vers les villes neutres −0,07.
- Le générateur n'a pas de score maximal : il rend le plateau de la graine 85 comme un autre. Question 4.

### M5. La table de jeu ne recoupe pas `camps` et `deploiements` — reproduit
`atelier/src/partie.js:393-413` et `:905`. Partie enregistrée dont `plateau.camps.vert` est remplacé par `["-1,-1", "1,0"]` (une forêt et une Plaine du noyau) en gardant les 4 `deploiements` : `charger` réussit, et `former` sur la forêt (-1,-1) passe **sans avertissement**. `creer` sur un plateau à `camps` falsifié garde aussi ces `camps`. Il faut un fichier modifié à la main ; l'onglet Plateau signale l'incohérence en erreur, la table non. Correction simple : dans `validerPlateau`, exiger `camps` = `campsAuto` quand `deploiements` est présent.
Dans le même esprit (reproduit) : `creer` réussit sur un plateau construit **sans villes** (`camps` vides) et le message de `vue-partie.js:111-112` n'en dit rien (0 erreur) ; toute formation demandera alors de forcer. Un mot dans le message suffirait.

### M6. Le noyau « ne bouge pas », mais « Tourner » et « Déplacer » ne le refusent pas — lu seulement (écran), reproduit (modèle)
`atelier/src/vue-plateau.js:274-287` (`tourner`), `:306-312` et `:51-59` (`deplacerPiece`) n'ont pas la garde du noyau que `retirerSelection` a (`:291-296`). Au niveau du modèle : `retirer` puis `poser` le noyau en (3,0) est accepté ; le contrôle 3 le signale alors en erreur (« Le noyau doit être centré en (0,0) »). La rotation est sans effet visible (le noyau est symétrique) : `K.tout` l'accepte, `verifier-regles.js:110` la compte comme faute B1. Écart sans conséquence, à aligner.

### M7. « Au bord du plateau » est satisfait par un trou intérieur — reproduit (fonction), sans plateau réel
`atelier/src/plateau.js:758` : une case est « au bord » si l'une de ses voisines est vide, trou compris. Terrain d'essai plein avec un trou en (0,0) : la Plaine (0,-1), entourée de tuiles sauf ce trou, est acceptée pour une `VD` de Vert. Le générateur ne produit pas de trou et un trou n'est qu'une alerte (`trous: 'alerte'`, décision encore ouverte) : cas de création à la main seulement.

### M8. Le nombre total de villes n'est pas contrôlé dans le chemin « catalogue 2 » — lu seulement
`atelier/src/controles.js:284-363` : avec des `VD` ou des `VN` posées, une tuile `V` en plus (fichier, ancien plateau retouché) ne donne qu'une alerte (`:325-328`) ; `nombreVilles` n'est vérifié que par `villesAnciennes` (`:371`). Je n'ai pas réussi à fabriquer un plateau à 8 villes qui passe : sur 60 graines, l'écart de 4 pas ou le contact l'ont toujours mis en erreur. Risque théorique.

### M9. « Rappel des règles » présente « à mi-hauteur » comme une règle — lu seulement
`atelier/src/vue-villes.js:425`. Le tiers central des rangées est marqué « provisoire » au §9.1 (B5) ; l'utilisateur a dit « aux extrémités, sur les côtés ». Le panneau l'écrit sans réserve. Voir la question 3.

### M10. Contact d'une tuile de remplissage : contrôles et vérificateur ne comptent pas pareil avec la mesure « côtés » — lu seulement
`atelier/src/controles.js:446-449` applique la mesure retenue (côtés ou pièces) ; `atelier/outils/verifier-regles.js:176` compte toujours des pièces. Sans effet avec la mesure par défaut ni sur les plateaux générés (le générateur compte des pièces, `generateur.js:291`).

### M11. « Plateau complet » s'affiche aussi sur un plateau en erreur — reproduit (modèle), lu seulement (écran)
`atelier/src/controles.js:594-597` : l'étape ne regarde que ce qui est posé, comme son commentaire le dit (« l'étape ne dit rien des erreurs »). Mes plateaux fautifs (`VD` sur forêt, sur le noyau, hors du bord, deux `VN` sur le même flanc, deux `VD` à 3 pas) rendent tous `etape = 'complet'` avec `ok = false`. À l'écran, le titre « Plateau complet » (`vue-plateau.js:583-588`) et « Plateau complet : toutes les villes sont posées » (`vue-villes.js:375`) voisinent donc avec « 3 erreur(s) ». C'est voulu, et « Plateau terminé : tout est posé, aucune erreur » (`vue-creation.js:145-146` et `:449`) tient bien compte des erreurs. Un titre « Tout est posé » éviterait de lire « complet » comme « conforme ».

## Points d'interface (lecture seule)

- **Libellés** : « posée PAR-DESSUS une Plaine du bord, en haut pour Vert, en bas pour Rouge, hors noyau ; 2 par joueur », « 4 pas au moins (3 cases entre elles) », « une tuile ajoutée contre le flanc » : conformes aux décisions. Réserve : M9.
- **Annuler / rétablir à travers les deux étapes** : l'historique garde le plateau entier (`vue-plateau.js:180-220`), donc villes, `camps` et profondeur reviennent ensemble ; `rafraichir` relit la profondeur dans le document (`:679`). Chaque pose, chaque proposition et chaque changement de profondeur est un pas. Rien à signaler à la lecture ; la recette l'a exercé dans le navigateur (`docs/04`).
- **Non exercé** : le message « une seule façon de poser les villes » (aucun terrain à combinaison unique sur 40).

## Questions pour l'utilisateur

1. **Tuiles de terrain d'une case et monoblocs tout en plaine posés à la main** (I2) : doivent-ils rendre le plateau **non conforme** (erreur), ou rester un simple avertissement comme aujourd'hui ? Même question pour une pièce personnelle de 2, 5 ou 6 cases.
2. **Ville neutre « tenue par 2 tuiles »** (I3) : 2 **pièces** distinctes, ou 2 **cases**, qui peuvent appartenir au même monobloc ? Aujourd'hui : 2 cases, et près d'une ville neutre sur deux ne touche qu'une pièce.
3. **Place des villes neutres** (I4) : « aux extrémités, sur les côtés » veut-il dire à mi-hauteur des flancs gauche et droit (ce que fait l'outil, qui met en erreur toute autre place), ou ailleurs (par exemple vers les coins, ou n'importe où sur un flanc) ?
4. **Équilibre** : faut-il un score maximal au-delà duquel le générateur refuse un plateau ? Faut-il afficher quel camp est avantagé ? Aujourd'hui le score moyen est 2,3 et le pire vu 9, tout à l'avantage d'un camp.
5. **Plateaux faits hier** (I1) : le comportement proposé (« Plateau du catalogue précédent », jouable, sans pièces « à poser ») convient-il, ou préférez-vous qu'ils soient signalés comme à refaire ?
6. **« Autre proposition »** (M3) : suffit-il qu'elle fasse varier les villes de déploiement, ou doit-elle aussi proposer les autres places des villes neutres ?
7. Déjà ouvert, rappelé : les trous restent en alerte (M7 en dépend) ; la profondeur par défaut s'écrit par l'absence du champ (`docs/04`, « Points à connaître »).
