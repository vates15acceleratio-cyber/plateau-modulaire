# Audit de sécurité (agent sécurité, Sonnet 5.5), 2026-10-15

**Verdict : acceptable.** Aucune faille critique ; la correction B1 (fichier JSON piégé) est complète : fichier piégé de démonstration (payloads `<img onerror>`, `<svg onload>`, `<script>` dans tous les champs, `__proto__`, ids géants, nombres extrêmes) chargé dans Edge sans fenêtre → aucun script exécuté, aucun attribut d'événement dans le DOM, prototype non pollué ; contrôle positif de la méthode (une injection volontaire est bien détectée).
- Réseau : aucune requête sortante, aucune ressource externe (polices, CDN). Pas de télémétrie.
- `localStorage` : seulement `plateau-modulaire:autosave` (+ `…-illisible`, clé de test éphémère). Fichiers JSON exportés : aucune donnée personnelle (date ISO seulement).
- Pas encore audité : export PDF / SVG / PNG, équilibre, générateur (modules en cours d'écriture).

## Constats et suites données (orchestrateur)
| # | Gravité | Constat | Suite |
|---|---|---|---|
| 1 | Important | Fichier hostile de taille modeste qui bloque le navigateur (croissance quadratique, mémoire) | **Corrigé** : fichier > 5 Mo refusé avant lecture ; bornes : 500 modèles, 64 cases et 256 chemins par modèle, 64 tuiles, 64 jetons, 16 retraits ; valeurs plafonnées (`PM.sauvegarde.LIMITES`) |
| 2 | Mineur | `role` non converti en texte | **Corrigé** (texte ou vide) |
| 3 | Mineur | `forme.retires` cloné tel quel | **Corrigé** : seuls `{col, lig}` entiers gardés |
| 4 | Mineur | Nombres extrêmes (1e308) → rendu « Infinity » | **Corrigé** : coordonnées ≤ 1000 en valeur absolue, exemplaires ≤ 999 |
| 5 | Mineur | Pas de politique CSP | **Reporté** : fiabilité de `'self'` en `file://` à vérifier, et l'export (blob:, data:) arrive ; à reprendre après l'export |
| 6 | Mineur | `serveur.js` plante sur une URL mal encodée | **Corrigé** (400) |
| 7 | Mineur | `serveur.js` sert `.git` / `.claude`, pas de contrôle de l'hôte | **Corrigé** (403) ; vérifié par requêtes |
| 8 | Mineur | `innerHTML` avec une constante dans `app.js` | **Corrigé** (`textContent`) |
| 9 | Mineur | Ids de longueur illimitée | **Corrigé** : textes tronqués à 200 caractères |
| 10 | Mineur | La page de recette efface la sauvegarde automatique de l'utilisateur (même origine en `file://`) | **Corrigé** : mise de côté puis remise en place à la fermeture de la page |
