# Audit de sécurité de la version 2.00.0 (agent sécurité, Sonnet 5.5), 2026-10-16

**Verdict : acceptable.** Aucun constat critique ni important ; aucune injection démontrée (contrôle positif de la méthode réussi). Vérifié en pratique dans Edge sans fenêtre : sauvegardes automatiques et fichiers piégés (ids, noms, `gabarit`, types de case et de jeton, `grille` hostile, fichier v1 piégé, ids `__proto__`…) à travers bibliothèque, plateau, éditeur, export, générateur et boîte « catalogue v2 » ; valeurs hostiles et tableaux énormes (refusés ou normalisés, aucun blocage) ; pas de pollution de prototype ; `PM.geometrie.format` en liste blanche ; export SVG / PDF échappé, sans métadonnée ni action active ; aucune requête réseau ; dépôt public sans secret ni adresse électronique (auteur unique : adresse anonyme GitHub).

## Constats et suites (orchestrateur)
| # | Constat | Suite |
|---|---|---|
| CSP | Politique de sécurité absente | **Ajoutée** dans `index.html` (valeur testée par l'audit) ; vérifié : application montée en `file://`, 14 vignettes, 16 cellules, aucune violation |
| M1 | `graphe.construire` plante sur un chemin vers une case absente (modèle invalide posé) | **Corrigé** : raccord ignoré |
| M2 | `id` de modèle, `modeleId`, `type` de case, message de version non plafonnés | **Corrigé** (200 caractères ; version tronquée) |
| M3 | Taille du fichier contrôlée après la lecture | **Corrigé** : refus avant lecture au-delà de 5 Mo |
| M4 | Chemin personnel (nom d'utilisateur Windows) dans `docs/0-brief.md` et dans l'historique public | Fichier **corrigé** ; historique : décision de l'utilisateur |
| M5 | `localStorage` partagé entre toutes les pages `file://` | Laissé (données non personnelles, normalisées à la lecture) |
| M6 | Copie « illisible » conservée sans limite | Laissée (elle permet une récupération à la main) |
| M7 | Dictionnaire `{}` indexé par id dans `export.js` | **Corrigé** (`Object.create(null)`) |
| M8 | `.gitignore` | **Complété** (environnements Python, binaires, `build/`) |

Non vérifié : Firefox et Safari (comportement de `'self'` en `file://`), téléchargement réel, gestes d'édition avec des ids piégés.
