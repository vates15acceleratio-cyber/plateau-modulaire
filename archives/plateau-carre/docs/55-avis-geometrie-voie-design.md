# Avis géométrie : voie « porteuse latérale + relais » (docs/53) contre voie « tuiles à deux cases » (docs/54) (advisor, Opus 5.5), 2026-10-18

Rapport de l'advisor, consigné et condensé par l'orchestrateur. Tous les chiffres viennent du vrai code. Fichiers dans le dossier temporaire de la session : `advisor-geo-connexions/` (`modeles-5x5-voie-design.js`, `R-document.json`, `RF-document.json`, comparaisons). Croquis : `docs/croquis/connexions/voie-design-R-RF.png`.

## Conclusion
- **La voie design (`53`) tient nettement mieux les cibles, et elle garde R4** (aucun port sur une apparition).
- Elle remplace la conclusion de `54` : le vrai conflit tenait à **R1 et R4 ensemble**. Lever R1 (une case peut porter 2 ports) en gardant R4 donne de bien meilleurs résultats que l'inverse.

## Réponses aux points de `53` § 4
1. **Porteuse latérale** (ports NO + NE et raccord N1) : dessinable, case en (50, 25), marge de 9,75 à 10,04 mm.
2. **Relais à 3 raccords :** dessinable (9,75 mm).
   - **Fourche LC3 :** relais en (62, 60), pivot en (31, 76), 10,04 mm.
   - La fourche ne touche pas de porteuse.
3. **Apparition de bord à 5 chemins (E0, E1, O1, O2 et le lien) :** **impossible.** E0 et E1 ne sont qu'à 20 mm l'un de l'autre, et il n'y a pas d'angle suffisant pour garder 8 mm entre les traits.
   - Substitut : **LB2** « Bord à pont bas », avec la paire basse E2 / O0 (4,50 mm).
   - Il s'accorde avec **LK2** (4,57 mm). Le graphe est le même.
4. **Coin :** LK2, 4,57 mm.
5. **« Deux ponts » (LC4) :** lisible (10,04 mm), mais ses murs E et O laissent **2 raccords morts à chaque pose**.
6. **Second dessin de « Pont et relais » (LC2) :** même topologie que LC1, une variété visuelle seulement (3,79 mm).
7. **La règle peut s'écrire dans `validerModele`, pour le 5×5 seulement.** Une case à 2 ports :
   - dessert les coins k et k + 1 ;
   - n'a que le raccord (k, 1) ;
   - ne touche aucun passage ;
   - n'est reliée à aucune autre porteuse.

## Modèles

| Id | Nom | Cases | Règles levées | Marge |
|---|---|---|---|---|
| LC1 | Pont et relais | porteuse p (50,25) : NO, NE, N1 ; relais r (50,58) : E1, S1, O1 ; lien p–r | R1, R3 | 9,75 |
| LC2 | Pont et relais décalé | p (44,27), r (62,62) | R1, R3 | 3,79 |
| LC3 | Pont et fourche | p (50,25) ; r (62,60) : E1 ; pivot (31,76) avec S1, O1 et r | R1, R3 | 10,04 |
| LC4 | Deux ponts | p (50,25) : NO, NE, N1 ; q (50,75) : SE, SO, S1 ; murs E et O | R1, R3, **2 raccords morts** | 10,04 |
| LB2 | Bord à pont bas | apparition (50,48) : E0, O2, E2, O0, lien ; porteuse (50,81) : SE, SO, S1 | R1, R3, paire basse | 4,50 |
| LK2 | Coin à porteuse bas | apparition (39,42) : E0, S2, lien ; porteuse (75,75) : SE, E2, S0 | R3, paire basse ; coin du type K1 | 4,57 |

R2 et R4 sont respectées partout, et aucun modèle n'a de passage traversant.

## Comparaison (30 plateaux par famille)
Méthode : les centrales sont réparties au hasard, puis une recherche locale optimise rotations et échanges. C'est une **borne optimiste**, pas un générateur.

| Mesure | G (`54`) | **R** (avec LC4) | RF (avec fourche) | R0 (sans LC4) |
|---|---|---|---|---|
| Cases | 59 | 59 | 59 | 59 |
| Cases à 2 connexions | 5,3 % | **0,1 %** | 0,3 % | 3,4 % |
| Ports / jonctions à moins de 3 ports | 46 / 3,1 | **48 / 0,07** | 48 / 0,17 | 46 / 2 |
| Placements « 2-3-2 » admissibles, moyenne (min–max) | **0** | **16,9 (6–24)** | 9,7 (6–20) | 5,5 (3–8) |
| Écart minimal entre jonctions | 3 pas | 2 pas (deux coins d'un même côté) | 2 pas | 2 pas |
| Raccords morts | 0 | **2** | 2 | **0** |
| Liens entre tuiles (4.00.0 : 31) | 56 | 46 | 48,5 | 48 |
| R4 respectée | non | oui | oui | oui |
| S du placement retenu | — | 1 | 0,83 | 2,4 |
| Première ville vue d'une apparition | 1 pas | 2 pas | 2 pas | 2 pas |

**Plateau R :** 0 % de cases à 2 connexions, les 16 jonctions à 3 ports, villes en 2-3-2 toutes à 3 ports, 2 raccords morts.

**En pose libre** (rotations au hasard, 200 plateaux), il y a au moins un placement de villes admissible sur 43 % des plateaux R, 26 % des RF et 0 % des G. Le générateur, et dans l'éditeur une aide « placer les villes », sont donc indispensables.

## Prix de la voie design (décisions pour l'utilisateur)
1. **Règles R1 et R3 propres au 5×5,** dans la validation et dans les tests.
2. **L'écart de 3 cases entre villes** n'est garanti que par le placement des villes.
3. **« Deux ponts » :**
   - **avec** : 2 raccords morts par pose, 0,1 % de cases à 2 connexions, environ 17 placements ;
   - **sans** : 0 raccord mort, 3,4 % de cases à 2 connexions, environ 5 placements, S autour de 2,4.
4. **Bord :** la paire basse au lieu de E1 / O1, avec deux rails parallèles sur le pourtour. Les anciens B1, B7 et K2 deviennent incompatibles.
5. **Coin du type K1 :** la première ville est à 2 pas de l'apparition.
6. **Côté organique réduit :** seule la fourche LC3 reste, et elle coûte des placements.
7. **59 cases.**
