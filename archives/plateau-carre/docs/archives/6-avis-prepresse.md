# Avis de l'advisor prépresse / impression (Sonnet 5.5), 2026-10-15

> **Notes de l'orchestrateur.**
> - Vérification A3 : 3 rangées × 126 mm + 2 gouttières × 6 mm = 390 mm, plus 2 × 15 mm de marge = 420 mm. **Ça tient tout juste.** En revanche, des repères de 5 mm décalés de 3 mm hors du fond perdu demandent 8 mm de chaque côté : dans une gouttière de 6 mm, ceux des tuiles voisines se chevauchent. Le module d'export doit **partager les repères dans les gouttières** (un trait commun entre deux tuiles) ou réduire leur longueur. À trancher en codant `export.js`.
> - Les valeurs CMJN sont des approximations à valider sur un essai imprimé.
> - La palette vert / rouge / noir / blanc s'applique au **rendu des tuiles et des jetons** ; l'interface de l'outil peut utiliser d'autres couleurs (ex. l'orange des alertes de l'avis ergonomie).

## 1. Livrables d'export
- **Planches A3 portrait (297 × 420 mm)** : 2 colonnes × 3 rangées = 6 tuiles par planche ; 20 tuiles sur 4 planches.
- Variante **A4** : 2 tuiles par planche, 10 planches (imprimante de bureau).
- **Planche de jetons A4** : 9 jetons de Ø 33 mm (fond perdu compris), grille au pas de 38 mm.
- **Plateau assemblé 48 × 48** : aperçu seulement (PNG d'écran + PDF A3 sans repères, marqué « non imprimable »).
- Pas de planche 50 × 50 (format inexistant chez les imprimeurs), pas une planche par tuile.
- Calepinage : pas = 126 + 6 mm, marges ≥ 15 mm, tuiles triées par identifiant, tuiles posées en tête. Option : compléter la dernière planche avec des tuiles de réserve.

## 2. Fond perdu, sécurité, repères
- Coupe nette à **120 mm** ; fond perdu de **3 mm** (motif prolongé jusqu'à 126 mm) ; zone de sécurité de 4 mm pour tout texte.
- Repères de coupe : traits de 0,25 mm, 5 mm de long, décalés de 3 mm hors du fond perdu, aux 4 coins, en noir de repérage ; jamais dans le fond perdu. **Obligatoires.**
- Gouttière de 6 mm entre fonds perdus.
- Sur chaque planche : barre de contrôle d'échelle de 100 mm et nom de la planche.
- Une tuile = un rectangle de 126 mm décalé de 3 mm, géométrie commune au PDF, au SVG et au PNG.

## 3. Conversions et couleurs
- 1 mm = 72 / 25,4 = **2,83465 pt**. Tuile 120 mm = 340,157 pt ; 126 mm = 357,165 pt ; A3 = 841,89 × 1190,55 pt.
- SVG : `width="297mm" height="420mm" viewBox="0 0 297 420"` (unité interne = mm).
- PNG 300 dpi : 1 mm = 11,811 px. Tuile coupée **1417 × 1417 px** ; avec fond perdu 1488 px ; A3 **3508 × 4961 px** ; A4 2480 × 3508 px. Arrondir à l'entier, écrire le chunk `pHYs` (11811 px/m), ne jamais rééchantillonner.
- Profil **RVB sRGB par défaut**, option CMJN si un imprimeur la demande.

| Couleur | HEX | CMJN (approx.) |
|---|---|---|
| Vert (bleuté, sombre) | `#007A4D` | 95 / 15 / 85 / 5 |
| Rouge (orangé, clair) | `#D8321C` | 0 / 90 / 100 / 0 |
| Noir (texte, traits) | `#111111` | 0 / 0 / 0 / 100 |
| Blanc | `#FFFFFF` | papier |

Vert sombre et rouge clair : séparés par la luminosité pour les daltoniens.

**Codes de forme (indépendants de la couleur)**
- Case de déplacement : cercle Ø 30 mm, contour noir 0,6 mm.
- Apparition : **carré** aux angles arrondis, chiffre **1** ou **2** de 8 mm ; J1 hachures diagonales vertes, J2 pointillé rouge.
- Ville (jeton) : cercle noir, **couronne crénelée** blanche.
- Carrefour (jeton) : cercle blanc, **croix « + »** noire.
- Limiter les aplats noirs (gondolage du carton). Tester une impression en niveaux de gris.

## 4. Traits et textes
- Trait positif (noir sur clair) ≥ **0,25 mm** ; trait négatif (blanc sur couleur) ≥ **0,5 mm**.
- Texte ≥ 6 pt, sans empattement épaisse ; chiffres 1 / 2 de 8 mm.
- Identifiant du modèle (ex. `C3`) : sur la **marge de la planche** près du repère de coupe, et en 7 pt au recto dans la zone de sécurité, au premier emplacement libre (test de collision avec cases et chemins ; repli sur la marge seule). Recopié à la main au verso après la coupe.

## 5. Cotes D7 de la géométrie
- Chemins de 8 mm : **validé**. Ils vont jusqu'au bord et dans le fond perdu, sans filet blanc.
- Zone de coin R 20 mm : **validée** (aucun texte dedans).
- Cases à 3 mm de la coupe : **corrigé à 4 mm** (plancher d'impression).
- Tolérance de coupe : **corrigée en −0,5 / 0 mm** (une tuile trop grande empêche d'emboîter le 4×4). Emporte-pièce : ±0,3 mm.
- Fond perdu 3 mm : **validé**. Jeton à ±3 mm : **validé** ; découpe du jeton ±0,3 mm.
- Carton de **1,5 à 2 mm** d'épaisseur (marche sous le jeton) ; à valider sur un essai.

## 6. PDF vectoriel hors ligne
- **Recommandé : générateur PDF maison** (~200 lignes, sans dépendance) : opérateurs `re`, `c`, `l`, `S`, police standard Helvetica, CMJN possible (`k` / `K`), échelle exacte.
- Alternative : `jsPDF` seul embarqué, `unit: 'mm'`, API vectorielle directe.
- Déconseillé : `svg2pdf.js` (dépendance lourde ~600 Ko, polices, rastérisation possible).
- Repli : impression navigateur avec `@page { size: 297mm 420mm; margin: 0 }`, échelle 100 %. Pièges : « ajuster à la page », marges, 1 mm CSS = 3,7795 px, rastérisation.
- Contrôle : mesurer la barre de 100 mm à la règle sur le premier essai.
