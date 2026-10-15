# Export impression (sous-agent 6, Sonnet 5.5), 2026-10-15

Livré : `src/export.js` (`PM.exportation`), `styles/export.css`, `tests/export.test.js` (26 tests), `outils/essai-export.html`. Bouton « Exporter » de la barre actif.

- Planches **A3 portrait 2 × 3** (6 tuiles, marges 19,5 / 15 mm) ou **A4 portrait 1 × 2** (deux colonnes ne tiennent pas dans 210 mm) ; fond perdu 3 mm ; repères de coupe hors fond perdu, **un trait commun de 4 mm dans les gouttières** de 6 mm ; identifiant du modèle (suffixe `-n` par exemplaire) dans la gouttière ; nom de planche et barre de contrôle de 100 mm graduée.
- Planche A4 des jetons (7 villes, 2 carrefours, Ø 33 mm fond perdu compris, cercle de coupe) ; aperçu du plateau assemblé réduit à 56 % sur A3, marqué « Aperçu, non imprimable ».
- Tuiles imprimées en orientation canonique (tournées à la pose) ; apparitions réparties 2 pour J1, 2 pour J2.
- **PDF vectoriel maison** (PDF 1.4, sans dépendance) : une seule source, le SVG des planches, converti en flux PDF (sous-ensemble connu ; tout élément inconnu lève une erreur) ; SVG ; PNG 300 dpi par `canvas` (A3 3508 × 4961 px) avec chunk `pHYs`.
- Noir de repérage `#000000` (RVB) pour les repères ; flux PDF non compressés.
- **Identifiant du modèle imprimé seulement dans la marge (gouttière), pas au recto de la tuile** : repli permis par `docs/6-avis-prepresse.md`, §4 (revue `docs/17`, M8).
- Corrections après revue (`docs/17`) : stock exporté plafonné à 200 tuiles au total (somme des exemplaires des modèles complets ; la portée « posées » n'est pas concernée) ; en portée « posées », une tuile dont le modèle est introuvable est signalée (`exclus`, raison `introuvable`) ; URL de l'aperçu libérée à la fermeture et à la réouverture de la boîte ; découpes résolues sans marqueur textuel (un identifiant contenant `%%CLIP:…%%` s'imprime tel quel).

## Vérification par l'orchestrateur
PDF du catalogue (4 planches A3) ouvert avec PyMuPDF : 4 pages de **297,0 × 420,0 mm**, rendu de la planche 1 conforme (6 tuiles, apparitions « 1 » vertes et « 2 » rouges pointillées, repères, identifiants A1-1 … B2, barre de 100 mm), textes extraits correctement.

## Non vérifié
Impression réelle et mesure de la barre de 100 mm à la règle ; téléchargement réel dans le navigateur ; navigateurs autres que Chromium pour le PNG.
