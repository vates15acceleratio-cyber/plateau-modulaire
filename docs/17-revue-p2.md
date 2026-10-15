# Revue de l'export, du graphe, de l'équilibre et du générateur (relecteur, Opus 5.5), 2026-10-15

**Verdict : version enregistrable ; aucun bloquant.** Vérifié juste : conversions mm / pt / px, structure du PDF (xref à l'octet, `/Length`, échappement des chaînes), repères et calepinage, parcours en largeur, S, « 5 contre 2 », goulets (flot maximal), générateur pur et reproductible, sécurité des SVG / PDF (pas de `/Info`, pas de ressource externe), coût du panneau (≈ 0,3 ms par calcul).

## Important
- **I1.** S et les seuils calculés deux fois (`generateur.critere` et `PM.graphe.equilibre`), désaccord si une ville est inaccessible en villes non traversables ; constantes définies à trois endroits.
- **I2.** Panneau et rapport ne disent pas la même chose : `ville_inaccessible` absent du panneau ; le rapport double `ecart_rang` (ancien D6 rangs 1 à 4) et `ecart_rang_etendu`.
- **I3.** Règle des camps codée trois fois (`controles`, `assemblage`, `generateur`) → une fonction `PM.modele.campJonction(i, j)`.
- **I4.** Utilitaire de graphe provisoire resté dans `tests/catalogue.test.js`, avec l'ancien critère.

## Mineur
M1 marqueur `%%CLIP:id%%` remplacé aussi dans les textes du PDF (un identifiant piégé fait échouer l'export ou s'imprime mal) ; M2 URL d'aperçu jamais libérée ; M3 PNG rastérisé avec une largeur en mm, limite de canvas de Safari iOS ; M4 `exemplaires` lus différemment, stock total non plafonné ; M5 génération synchrone sans indication ; M6 garde-fou « 45 à 55 cases » absent pour une bibliothèque personnalisée ; M7 tolérance 1 du générateur (à trancher) ; M8 identifiant non imprimé au recto (repli « marge seule » à noter) ; M9 CSP à reprendre.
