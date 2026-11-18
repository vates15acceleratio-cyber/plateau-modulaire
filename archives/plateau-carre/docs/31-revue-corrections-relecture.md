# Revue des corrections de la relecture (relecteur, Opus 5.5), 2026-10-16

Objet : branche `corrections-relecture`, commits `a12d712..3423fdd` (`git diff main...HEAD`). Revue en lecture seule : `git status` est resté propre.

> **Suite donnée par l’orchestrateur (2026-10-16).** Constat 1 : branche poussée, CI vérifiée avant la PR. Constat 2 : relais de K4 en (82, 61) / (61, 82), mesuré par l’orchestrateur (8,3 mm entre chemins, 9,7 mm entre relais), texte de docs/18, des constats et de docs/21 repris. **Constat 3 rejeté** : l’utilisateur a décidé de garder « pions Ø 20 au plus » contre l’avis prépresse (décision consignée dans docs/18 sur la branche catalogue-5x5). Constats 4 à 6 : faits (CHANGELOG, docs/25, test 12 retiré). Remarques : 7 (commentaire des jetons complété, choix des 4 colonnes laissé à l’utilisateur), 9 (test 8 retiré), 12 (rédaction) faites ; 8, 10 et 11 laissées en l’état.

## Vérifications faites
- `node --test` : 481 tests, 474 OK, 0 échec, 7 sautés (PyMuPDF absent ici).
- Recettes Edge sans fenêtre : `recette-interface` 243 OK et `recette-p2` 109 OK, 0 échec.
- `outils/mesures-equilibre.js 1000 20261015` a été régénéré dans le scratchpad. Le fichier obtenu est identique à `docs/21`, fins de ligne mises à part : seule la phrase K4 change.
- Ordre de chargement de `DIAMETRE_CASE` :
  - Sous Node, `catalogue.js` charge `modele.js`, qui charge `geometrie.js` ; `editeur-tuile.js` charge `geometrie.js`.
  - Dans le navigateur, `geometrie.js` vient en premier dans `index.html` et dans les 6 pages de `outils/`.
  - L'alias `PM.geometrie` expose la constante.
- Carré d'apparition : seul `caseApparition` le dessine. L'écran, l'impression et l'export PDF / SVG / PNG passent tous par `contenuTuile`.
- Repli de `rendu.js:120` : il n'est atteint que par une case invalide, que `validerModele` signale déjà (`case_invalide`, `modele.js:242-243`).
- Cadres de `graphe.js:193` et `catalogue.test.js:531` : désormais alignés.
- Workflow CI :
  - YAML valide ; `actions/setup-python@v5` avec Python 3.12, puis `pip install pymupdf`.
  - `python` est bien dans le PATH pour `recette-p2.test.js:36`.
  - J'ai relu les 7 tests PDF : aucun ne code une valeur modifiée par la branche (carré, trait, repli, K4).

## Constats

### Bloquant
Aucun.

### À corriger
1. **CI jamais lancée avec PyMuPDF.** La branche n'est pas poussée, et les 7 tests PDF (`tests/recette-p2.test.js:318, 336, 419, 456, 480, 504, 881`) n'ont jamais tourné. Leur contenu ne dépend pas de la branche, mais deux points sont sensibles à l'environnement Linux et à la version de MuPDF :
   - `avertissements === ''` (`:428`) ;
   - le texte accentué `réduit à 56` (`:491`).

   Correction : pousser la branche, puis exiger une exécution de `tests.yml` verte avec **0 test sauté** avant la PR. Figer la version (`pip install pymupdf==<x.y.z>`).
2. **K4 (82, 60) / (60, 82) : la justification est fausse, et c'est mon §8 de `docs/27` qui en est la cause.** Ce §8 ne mesurait que l'écart entre les cases, pas la contrainte qui limite vraiment : l'écart entre chemins. Mesure (2 000 points par segment, rognage comme `catalogue.test.js`) :

   | Relais | Écart mini entre chemins | Paire limitante | Jeu s1 / s2 |
   |---|---|---|---|
   | (82, 60) | 8,09 mm | h1 / r1 | 11,1 mm |
   | (82, 61) | 8,35 mm | h1 / r1 | 9,7 mm |
   | (82, 62), sur `main` | 8,36 mm | h1 / h2 | 8,3 mm |
   | (82, 58) ou (82, 63) | 7,56 et 7,86 mm | | échec |

   En (82, 60), il ne reste que 0,09 mm de marge sur la règle des 8 mm, contre 0,36 mm sur `main`. La phrase « pour garder 8 mm entre chemins » (`docs/18:72`, `docs/21:27`, `outils/constats-catalogue-v2.md:27`) est donc trompeuse.

   Correction proposée : **(82, 61) / (61, 82)**, qui garde la marge de `main` et donne 1,4 mm de jeu de plus entre les cases. Sinon, revenir à (82, 62). Dans les deux cas, reprendre :
   - `catalogue.js:153` ;
   - le test 7 (`corrections-relecture.test.js:108-109`) ;
   - le texte de `constats-catalogue-v2.md`, puis régénérer `docs/21` ;
   - `docs/18:72`, en citant l'écart entre chemins (8,35 mm, h1 / r1).
3. **`docs/18-decisions-v2.md:73`** dit encore « Ø 20 mm au plus » pour les pions (`docs/26` §1, non fait). Remplacer par : « Pions : Ø 16 conseillé, Ø 18 au maximum ; Ø 20 exclu, car il couvre le contour de la case. À vérifier à l'impression (`docs/26` §16). »
4. **`CHANGELOG.md:5-7`** ne mentionne pas les changements visibles de la branche :
   - carré d'apparition plus petit (`r·√2 − 3`), avec un trait d'impression de 0,6 → 1,0 mm ;
   - case sans diamètre dessinée à Ø 20 au lieu du Ø maximal ;
   - CI avec PyMuPDF.

   Ajouter une puce « Rendu : … ».
5. **`docs/25-travail-restant.md:10`** cite encore `docs/24-mesures-catalogue-5x5.md` (`docs/27` §17, non traité). Écrire « au prochain numéro libre » : 28 et 29 sont pris sur `catalogue-5x5`, 30 ici.
6. **Test 12 (`tests/corrections-relecture.test.js:183-187`).** Il lit le texte source de `export.js` : il vérifie un commentaire, pas un comportement, et reformuler ce commentaire suffit à le casser. Le supprimer : le test 11 fige déjà la géométrie des jetons.

### Remarques
7. **Fond perdu des jetons (`export.js:355-357`) : la justification tient, mais seulement à 5 colonnes.** Les repères vont de `rFp + 1,5` à `rFp + 4` du centre, la feuille fait 210 mm et la marge imprimable 5 mm.

   | Fond perdu, pas, colonnes | Bord du fond perdu | Bord des repères | Verdict |
   |---|---|---|---|
   | 1,5 mm, 38, 5 (actuel) | 12,5 mm | 8,5 mm | correct |
   | 3 mm, 42, 5 | 3 mm | −1 mm | repères hors feuille |
   | 3 mm, 40, 5 | 7 mm | 3 mm | repères sous la marge imprimable |
   | 3 mm, 38, 5 | 11 mm | 7 mm | repère dans le fond perdu noir du voisin |
   | 3 mm, 44, 4 (rangées 4 + 3) | 21 mm | 17 mm | correct |

   Le commentaire présente la rangée de 5 comme une contrainte, alors que c'est un choix. Ajouter « (4 colonnes au pas de 44 le permettraient) », et laisser l'utilisateur trancher.
8. **Test 11 (`:176-177`).** Il contrôle le fond perdu à 3 mm du bord, alors que la vraie contrainte est `MARGE_IMPRIMABLE` (5 mm), repères compris (`rFp + 4`). `recette-p2.test.js:496` contrôle déjà 5 mm pour le fond perdu.
9. **Test 8 (K4, `:115-145`).** Il double `problemesTrace` de `catalogue.test.js`, en moins strict : 60 points par segment et une tolérance de 0,2 mm, plus large que la marge réelle (constat 2). Les 4 rotations n'ajoutent rien, puisqu'une rotation conserve les distances. Le supprimer, ou le rendre exact.
10. **Tests qui recopient le code ou qui sont faibles.**
    - Test 10 et `editeur-tuile.test.js:293` reprennent la formule `DIAMETRE_CASE_JONCTION / 2 + 3`. Mieux vaut tester un comportement : `r > DIAMETRE_CASE_JONCTION / 2`.
    - Test 5 : le jeu vaut `3/√2 − trait/2 − 0,3` quel que soit le Ø, donc la boucle de Ø 10 à 30 ne vérifie que le signe du côté. Il double aussi `rendu.test.js:54-55`.
    - Test 9 : la symétrie suffit à le rendre vrai.
    - Expressions régulières des tests 3 et 6 : elles dépendent de l'ordre des attributs, ce qui reste acceptable.
    - Tests 2, 3, 4, 6 et 13 : ils vérifient un vrai comportement, notamment la migration v1 à Ø 24.
11. **Test 1 (`:35`).** Il impose `DIAMETRE_CASE === DIAMETRE_CASE_JONCTION`. C'est conforme à `docs/18` ; le jour où ces deux valeurs devront différer, ce test cassera, et c'est voulu.
12. **Rédaction.**
    - `CLAUDE.md:13` et `docs/4:63` mêlent `docs/archives/2` et `archives/6`.
    - `docs/20:7` : écrire « quart de disque Ø 24 (→ Ø 20, voir …) » plutôt que de placer le renvoi avant.
    - `docs/30:3` : « Aucun fichier de `src/` modifié » est vrai pour le testeur seulement ; ajouter « par le testeur ».

## Suivi

| Point | État | Où |
|---|---|---|
| 27 §1 colonne DOM | corrigé | `docs/4:36-39, 46` |
| 27 §2 conversions, dépendances | corrigé | `docs/4:9, 53` |
| 27 §3 archives normatives | corrigé | `CLAUDE.md:13`, `docs/4:63` |
| 27 §4 `docs/10:70` | corrigé | |
| 27 §5 K4 dans les constats, `docs/21` | corrigé | régénéré à l'identique |
| 27 §6 14 mm | corrigé | `catalogue.js:41` |
| 27 §7 test d'aimantation | corrigé | `editeur-tuile.test.js:61-68` |
| 27 §8 K4 (82, 60) | appliqué, à revoir | constat 2 |
| 27 §9 renvoi `docs/20` | corrigé | remarque 12 |
| 27 §10 CHANGELOG, `docs/25` | corrigé | bloc unique ; constat 4 pour le reste |
| 27 §11 `mesures-equilibre.js:86` | corrigé | |
| 27 §12 cadres, `sed` des archives | partiel, accepté | cadres faits, archives laissées |
| 27 §13 constante unique | corrigé | `geometrie.js:32`, test 1 |
| 27 §14 repli du rendu, halo | corrigé | `rendu.js:120`, `editeur-tuile.js:417` |
| 27 §15 CI PyMuPDF | fait, non vérifié | constat 1 |
| 27 §16 règle des 8 mm dans `docs/25` | corrigé | `docs/25:30` |
| 27 §17 numérotation | non fait | constat 5 |
| 26 §1 consigne des pions | non fait | constat 3 |
| 26 §4 et §11 carré `r·√2 − 3`, trait 1,0 | corrigé | `rendu.js:77, 82` ; jeu de 1,32 mm |
| 26 §10 repli `DIAMETRE_CASE` | corrigé | `rendu.js:120` |
| 26 §13 fond perdu des jetons | commenté (choix b) | valable à 5 colonnes ; remarque 7 |
| 26 §16 essai d'impression | ouvert | `docs/25:31` |

## Verdict
**Pas encore prêt pour la PR**, sans bloquant dans le code. Il faut d'abord :
- une CI verte avec PyMuPDF et 0 test sauté (constat 1) ;
- la position K4 revue, (82, 61) proposé, avec sa justification (constat 2) ;
- les corrections de doc 3 à 5 ;
- le retrait du test 12 (constat 6).

Les remarques 7 à 12 peuvent attendre.
