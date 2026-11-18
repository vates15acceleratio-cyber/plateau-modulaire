# Outils pour les tuiles, cartes et jetons (essai du 2026-11-18)

Essai : la même feuille de 8 tuiles hexagonales (45 mm plat à plat, pointe en haut, 4 terrains avec motifs, fond perdu 3 mm, sécurité 4 mm, repères de coupe, barre de 100 mm), dessinée par deux outils. Scripts et rendus dans `tuiles/`.

## Verdict

| Outil | Résultat |
|---|---|
| **pymupdf** (Python) | Fonctionne sans rien installer d'autre. Formes libres, texte, échelle exacte en points. **Choix par défaut** pour les tuiles. |
| **protograf** (Python) | Fonctionne, avec un contournement de Cairo sous Windows. Utile pour les cartes et grilles en série. Limites ci-dessous. |
| **nandeck** | Non testé : demande de télécharger un .exe. Script texte + tableau CSV pour les cartes en série. |
| **Figma** | Non testé : demande que l'utilisateur autorise le connecteur dans `/mcp`. |
| **Worldographer, Tabletop Creator, Instaludo, Dungeon Scrawl** | Non pilotables par Claude (interfaces à la souris, pas de script ni d'API). |

## Limites de protograf (mesurées)
- **Cairo absent sous Windows** : `import protograf` échoue (`no library called "cairo-2"`). Contournement : remplacer le module `cairosvg` par une coquille vide avant l'import. Conséquence : **pas d'insertion d'images SVG**. Solution propre : installer GTK/Cairo sur le poste (installation système, avec l'accord de l'utilisateur).
- Ne remplit que des hexagones, triangles réguliers, cercles et rectangles ; **pas de polygone quelconque rempli**.
- Les épaisseurs de trait sont en **points**, pas dans l'unité de la page.
- Lit lui-même `sys.argv` : il faut vider les arguments avant de l'appeler.
- Un hexagone de 45 mm sort à **45,0 × 51,96 mm** dans le PDF (mesuré), identique avec pymupdf.

## Impression
- Minimums repris de l'ancien projet (`archives/plateau-carre/docs/archives/6-avis-prepresse.md`) : fond perdu 3 mm, zone de sécurité 4 mm, texte ≥ 6 pt, traits ≥ 0,25 mm, barre de contrôle 100 mm.
- **Repères de coupe d'un hexagone** : six traits radiaux de 3 mm face aux sommets, à 1,5 mm du fond perdu. Gouttière de **16 mm** entre deux coupes voisines, pour que les repères de deux tuiles ne se croisent pas (contrôle automatique dans `geometrie.py`). **À faire valider par l'advisor prépresse.**
- Capacité avec cette gouttière : **10 tuiles par A4, 28 par A3** ; 91 tuiles = 4 planches A3 ou 10 A4.
- Les terrains restent distincts en niveaux de gris grâce aux motifs (herbes, sapins, vagues, montagnes).
