# Cahier des charges : catalogue 5×5 (orchestrateur), 2026-10-16

Statut : **arbitré (§ 8), réalisé** (catalogue 5×5 dans `src/catalogue.js`, branche `catalogue-5x5` ; le § 5 est remplacé par le § 8). Historique : projet soumis aux advisors géométrie et design de jeu avant toute production. Sources : `18-decisions-v2.md` (prioritaire, dont « Taille des cases »), `19-avis-design-v2.md`, `20-avis-geometrie-v2.md` (D4, D5, cible de cases), `22-avis-seuils-v2.md` § 5, `25-travail-restant.md` § 1.1, catalogue 4×4 `src/catalogue.js`.

## 1. Intention de l'utilisateur
« S'inspirer du 4×4, refaire des tuiles et garder une certaine harmonie. » Le 5×5 est la famille sœur du 4×4 : mêmes noms de familles, mêmes formes reconnaissables, mêmes règles ; seules les cotes et la densité changent.

## 2. Cadre fixe (déjà décidé)
| Élément | Valeur |
|---|---|
| Tuile ; plateau | 100 mm ; 500 × 500 mm |
| Raccords | 30 / 50 / 70 mm |
| Cases ; jonctions-cases | **Ø 20** (`docs/18`, 2026-10-16) ; Ø 20 |
| Zone de coin ; jeton ville | R 20 ; Ø 30 |
| Chemin ; amorces raccord / port | 8 ; 10 / 28 |
| Plateau | 25 cellules : 4 coins, 12 bords, 9 centrales ; 16 jonctions intérieures ; 7 villes, donc 9 jonctions-cases |
| Camps | rangées 0–1 vert, 3–4 rouge, **rangée 2 neutre** (ses apparitions ne servent à personne) |
| Cible de cases | **75 ± 3** par plateau (cases des 25 tuiles + 9 jonctions-cases), soit ≈ 66 cases de tuiles |
| Écart entre villes | au moins 3 cases (4 pas), vérifié sur 1000 plateaux |

Règles reprises du 4×4, sans exception : R1 une case porte au plus un port ; R2 deux cases porteuses jamais reliées directement ; R3 aucun raccord latéral sur une case porteuse ; R4 l'apparition ne porte jamais de port. **Aucune poche.** Une case d'apparition sur chaque bord et chaque coin ; raccourci tiré de l'apparition, à 30 mm du bord extérieur (bord : E pos 0 + O pos 2 ; coin : E pos 0 + S pos 2). Côté qui regarde une centrale : raccord au milieu (pos 1) seulement. Tracés : 8 mm au moins entre chemins, chemin à r + 4 mm des autres cases, 24 mm des coins (hors son port).

## 3. Harmonie avec le 4×4
- **Même nom et même idée de forme** pour un modèle repris : K2 5×5 est « Coin à relais », comme K2 4×4. Les ids peuvent être identiques (le champ `grille` les distingue ; les deux grilles ne se mélangent pas dans un document).
- **Mêmes orientations canoniques** (centrale : 4 coins en jonction ; bord : extérieur N, ports SE et SO ; coin : extérieurs N et O, port SE).
- **Proportions de la bibliothèque** proches du 4×4 (validé par l'utilisateur) : 2 à 3 modèles de coin, 5 à 6 de bord, 6 à 8 de centrale, soit ≈ 15 modèles pour ≈ 30 tuiles à imprimer (5 coins, 14 bords, 11 centrales, `docs/22` § 5).
- **Nouveaux modèles** seulement là où la densité l'impose (bords et centrales à 2 ou 3 cases), dessinés dans le même vocabulaire (segments droits, symétries, relais).

## 4. Le nœud du problème : la densité
Le 4×4 compte ≈ 3,9 cases par tuile ; le 5×5 doit descendre à ≈ 2,6 (66 / 25). Les ports manquent alors aux jonctions : `docs/20` donne un minimum de 80 cases avec tous les ports, et 75 en renonçant à quelques-uns (41 ports pour 16 jonctions ; le générateur garantit ≥ 2 ports par jonction, ≥ 3 aux jonctions des villes).

Deux répartitions candidates (cases des tuiles, hors 9 jonctions-cases) :

| | Coins (4) | Bords (12) | Centrales (9) | Total plateau |
|---|---|---|---|---|
| **A, `docs/20`** | 2 cases (8) | 6 × 3 + 6 × 2 (30) | 8 × 3 + 1 × 4 (28) | 75 |
| **B, coins dans l'esprit de K2** | 3 cases (12) | 6 × 3 + 6 × 2 (30) | 7 × 3 + 2 × 2 (25) | 76 |

La répartition A suppose des coins à 2 cases (apparition + case à port), c'est-à-dire un coin direct comme K1, **retiré par l'utilisateur** (`docs/18` : « K2 est le bon modèle »). L'orchestrateur propose donc **B** : coins K2 / K4 à 3 et 4 cases, et des centrales plus légères, dont deux à 2 cases (une case à port et un relais).

## 5. Liste provisoire des modèles

> **Remplacé par le § 8** (arbitrage final) : cette liste n'est conservée que pour l'historique.

### Coins (2 modèles, 5 tuiles)
| Id | Inspiré de | Cases | Ports | Exemplaires | Premier jet |
|---|---|---|---|---|---|
| K2 | K2 « Coin à relais » | 3 | 1 | 4 | apparition (32, 32), relais (53, 53), porteuse (74, 74) : **valide** (validerModele 5×5 et contrôle des tracés) |
| K4 | K4 « Coin en losange » | 4 | 1 | 1 | à reprendre : les deux relais rapprochent trop les chemins du raccourci (6 mm au lieu de 8) |

### Bords (5 à 6 modèles, 14 tuiles)
| Id | Inspiré de | Cases | Ports | Remarque |
|---|---|---|---|---|
| B1 | B1 « Bord en V » | 3 | 2 | l'apparition tient les deux ports et les raccords |
| B3 | B3 « Bord en Y » | 4 | 2 | un seul exemplaire (densité) |
| B5 | B5 « Bord décalé » | 4 | 2 | idem, ou réduit à 3 cases |
| B7 | nouveau « Bord simple » | 2 | 1 | apparition + une case à port ; deux variantes miroir (port SE ou SO) ou une seule tournée par l'utilisateur ? |
| B8 | nouveau « Bord à relais » | 3 | 1 | apparition, relais, case à port (même esprit que K2) |

### Centrales (6 à 8 modèles, 11 tuiles)
| Id | Inspiré de | Cases | Ports | Remarque |
|---|---|---|---|---|
| C1 | C1 « Étoile » | 5 | 4 | 1 exemplaire au plus (lourde) |
| C4 | C4 « Trident » | 4 | 3 | |
| C7 | nouveau « Pont » | 3 | 2 | port – relais – port, sur une diagonale |
| C8 | nouveau « Équerre » | 3 | 2 | port – relais – port, sur deux coins voisins |
| C9 | nouveau « Antenne » | 2 | 1 | relais (4 raccords) + une case à port |
| C5 | C5 « Étoile fermée » | 5 | 4 | à confirmer : un mur reste-t-il utile en 5×5 ? |
| C2 / C6 | Zigzag / Chaîne | — | — | probablement trop denses ; à confirmer |

## 6. Questions aux advisors
**Géométrie (Opus)** : 1) les gabarits de la section 5 tiennent-ils dans 100 mm avec des cases Ø 20 (positions types à proposer pour chaque famille) ? 2) les raccords latéraux des bords à 30 / 70 contre le raccourci : conflits ? 3) faut-il les deux miroirs de B7, ou une rotation suffit-elle (un bord ne tourne que de façon contrainte) ? 4) la répartition B tient-elle les ports nécessaires (≥ 2 par jonction, ≥ 3 aux villes) ?

**Design de jeu (Opus)** : 1) répartition A ou B, ou autre ? 2) la rangée neutre (rangée 2) : quelles tuiles y favoriser pour ne pas avantager un camp ? 3) nombre d'exemplaires par modèle (poids du générateur) ; 4) faut-il garder un mur (C5) ; 5) placement par défaut des 9 jonctions-cases (équivalent de la rangée centrale du 4×4) ; 6) liste des mesures à produire sur 1000 plateaux (reprendre `docs/22` § 5) et seuils provisoires.

## 7. Suite prévue (brief § 8)
1. Avis des deux advisors, consignés dans `docs/` ; arbitrage par l'orchestrateur ; décisions de règle soumises à l'utilisateur.
2. Sous-agent catalogue (production) : modèles 5×5 dans `src/catalogue.js` (`modelesParGrille`, `nouveauDocument('5x5')`) et tests, périmètre limité à ces fichiers.
3. Mesures sur 1000 plateaux → rapport de mesures dans `docs/` (numéro suivant libre) ; validation des seuils par l'advisor design de jeu.
4. Testeur, relecteur, puis versionneur.

## 8. Arbitrage (orchestrateur, après avis 28 et 29 et décisions de l'utilisateur, `docs/18`)
- Retenu : **B′** (78 cases, 40 ports), **K2 seul**, villes par défaut **2-3-2**, pas de C5, aucun raccord latéral hors du raccourci, B7 + B7m.
- Exemplaires imprimés : **K2 5, B1 6, B7 4, B7m 4, C7 6, C8 5 (30 tuiles)**.
- La répartition B et la liste du § 5 sont remplacées. Catalogue de départ pour le sous-agent : K2 ; B1, B7, B7m ; C7, C8 (coordonnées validées dans `29-avis-geometrie-5x5.md`). B3, B5, B8, C1, C4, C9 : 0 ou 1 exemplaire au plus, seulement si les mesures le permettent (chacun coûte un port ou des cases).
- Contradiction entre advisors tranchée par l'utilisateur : l'advisor design de jeu jugeait « ≥ 3 ports aux villes » inatteignable sur son modèle abstrait (catalogue P5, avec C9 et C4) ; l'advisor géométrie le tient avec B′ (recherche sur des poses réelles : 8 jonctions à ≥ 3 ports). À confirmer par les mesures sur 1000 plateaux.
- Le générateur 5×5 devra : orienter les centrales (pas de rotation au hasard), placer les villes en 2-3-2, garantir ≥ 2 ports par jonction et ≥ 3 aux villes, préférer B1 sur les bords de la rangée neutre.
- La remarque du relecteur sur K4 en (82, 60) / (60, 82) concerne le **4×4** (voir `27-revue-retroactive-pr1-pr2.md` et la note en tête de `29`).
