# Recette : 8 villes fixes, campements, jetons recto-verso (testeur, Sonnet), 2026-10-19

**Aucun bug trouvé, aucun fichier modifié.**
- `node --test` : 745 tests, 0 échec.
- Recettes : 365 et 116 OK, 0 échec.
- Console : aucune erreur, aucune violation de CSP.

## Vérifié dans le navigateur (Edge piloté par CDP)
- **5×5 généré** : 8 villes aux positions par défaut, 8 campements à flamme ; 58 cases, aucune alerte ; LC2 absent de la bibliothèque.
- **9e ville** : erreur « Trop de villes », compteur 9 / 8.
- **Placer les villes** : on revient au motif par défaut.
- **Ancien 5×5 à 7 villes**, ouverture simulée : la proposition de régénérer apparaît. Refus : document inchangé. Acceptation : 8 villes. Ctrl+Z : retour à 7 villes.
- **Export** : 30 tuiles et la case des jetons recto-verso.
- **Éditeur** : LC11 s'ouvre sans erreur ni alerte.
- **4×4 généré** : 7 villes, 2 campements, comportement inchangé.

## Vérifié hors navigateur
- **PDF des jetons** (2 pages, rendu PyMuPDF) : conforme.
- **R3 assouplie**, contrôlée sur le modèle et non par des clics dans l'éditeur : le cas permis passe sans alerte, un 3e raccord déclenche l'alerte.

## Non vérifié
- Clics réels dans l'éditeur.
- Bouton « Télécharger ».
- Réouverture d'un vrai fichier JSON de la 4.00.0.
- Remarques connues : mise en page mobile, noms de tuiles tronqués dans la bibliothèque.
