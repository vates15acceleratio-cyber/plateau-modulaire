# Rythme avec les jonctions, murs voulus en information (sous-agent de production, Sonnet 5.5), 2026-10-18

Rapport du sous-agent, consigné et condensé par l'orchestrateur. Il applique les décisions de `18` (« Réponses… 5×5 très connecté réalisé »). Résultats :
- `node --test` : 701 tests, 694 OK, 0 échec, 7 ignorés (vérifié par l'orchestrateur) ;
- recettes navigateur : 357 OK et 116 OK, 0 échec.

## 1. Toute jonction est une zone d'intérêt
- **Ce qui change dans `GR.rythme` :** toute jonction dont les 4 tuiles sont posées devient une zone d'intérêt, en plus des villes, des passages économes et du raccourci. C'est la fonction `jonctionsCompletes`.
- **Ancienne mesure :** l'option `sansJonctions` la redonne.
- **Cible inchangée :** 3.

Mesure sur 200 plateaux par format (vrai générateur, mêmes graines avant et après) :

| | 4×4 avant | 4×4 après | 5×5 avant | 5×5 après |
|---|---|---|---|---|
| Chaîne (nouvelle définition) | 3,08 | **2,98** | 4,88 | **3,02** (≤ 3 sur 196 plateaux) |
| distMax (nouvelle définition) | 1,04 | 1,02 | 1,96 | 1,89 |
| S moyen | 0,57 | 0,55 | 1,32 | 1,08 |
| Cases à 2 connexions | — | — | 1,35 % | 1,31 % |
| Montable avec la boîte | 96,5 % | 97,5 % | 100 % | 100 % |

Aucune autre mesure ne se dégrade.

## 2. Murs voulus en information
- **`mursDuModele` (`modele.js`) :** prend le champ facultatif `murs` (côtés 0 à 3) s'il est présent. Sinon, une détection par défaut considère comme murs tous les côtés sans raccord d'une centrale qui porte au moins un raccord.
- **`raccordsMorts` :** marque `mur: true` le raccord qui fait face à un mur.
- **`validerPlateau` :** renvoie maintenant `{ erreurs, alertes, informations }`. Un raccord face à un mur devient l'information `raccord_mur` au lieu de l'alerte `raccord_mort`.
- **Générateur :** il ne pénalise plus les murs.
- **Interface :**
  - les contrôles ajoutent un groupe d'informations, sans le compter dans la pastille ;
  - le plateau dessine un mur en gris pointillé ;
  - la sauvegarde relit le champ `murs`.
- **Tests :** nouveau fichier `tests/murs.test.js` (11 tests).

## 3. « Placer les villes »
Inchangé, et disponible dans les deux formats. Le comportement est testé (`placerVilles` en 4×4 et 5×5, annulable par Ctrl+Z) et la recette navigateur le vérifie.

## Données de test modifiées
- **Empreintes du générateur 4×4 régénérées.** Avec l'ancienne définition, elles sont identiques à `HEAD` : le changement vient bien de la nouvelle mesure.
- **Graines changées pour leur scénario :**
  - `export` → `export-2` (recette p2) ;
  - `recette-5x5-ui` → `recette-5x5-ui-a` (recette interface).

## Arbitrage de l'orchestrateur
**La détection des murs par défaut est trop large.** Une centrale de l'utilisateur à qui il manque un raccord verrait son voisin passer en simple information au lieu d'une alerte. Seuls les murs **déclarés par le champ `murs`** comptent donc : `murs: [1, 3]` sur « Deux ponts ». Les anciens documents, comme « Étoile fermée » de la 3.04, gardent leurs alertes. La modification est confiée à la production suivante.
