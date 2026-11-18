# Tuiles hexagonales (espace de travail séparé)

Conception des **tuiles** d'un plateau hexagonal modulaire : plaine, forêt, marais, montagne. Les tuiles servent
directement de cases de déplacement ; le plateau lui-même (forme quelconque, noyau fixe) n'est pas dessiné ici.
Cet espace est indépendant de l'outil de plateau carré (`src/`, `index.html`) : rien ici ne touche à `src/`, `tests/` ni `outils/`.

## Décisions de départ
Tuile de 45 mm plat à plat, pointe en haut (52 mm de pointe à pointe). Fond perdu 3 mm, zone de sécurité 4 mm,
texte ≥ 6 pt, traits ≥ 0,25 mm, barre de contrôle de 100 mm (règles d'impression de `docs/archives/6`).
Chaque terrain se reconnaît à son motif, pas seulement à sa couleur (à vérifier en niveaux de gris).

## Contenu
- `essais/geometrie.py` : géométrie commune (hexagones, motifs, repères de coupe, mise en page, contrôles).
- `essais/echantillon_pymupdf.py` et `essais/echantillon_protograf.py` : la même feuille d'échantillon, dessinée par deux outils.
- `essais/apercu.py` : rend les PDF en PNG (couleur et gris) et mesure les hexagones.
- `sortie/` : PDF et PNG produits (jetables, régénérables).

## Lancer
Environnement isolé (non versionné) : `python -m venv hex/.venv` puis `hex/.venv/Scripts/python.exe -m pip install protograf`.
Depuis la racine du dépôt :

```
hex/.venv/Scripts/python.exe -I hex/essais/echantillon_pymupdf.py            # feuille d'impression
hex/.venv/Scripts/python.exe -I hex/essais/echantillon_pymupdf.py controle   # + coupe (rouge) et sécurité (bleu)
hex/.venv/Scripts/python.exe -I hex/essais/echantillon_protograf.py [controle]
hex/.venv/Scripts/python.exe -I hex/essais/apercu.py hex/sortie/echantillon_pymupdf.pdf
```

## Pièges connus
- **protograf demande Cairo sous Windows** : sans la bibliothèque système, `import protograf` échoue (`no library called "cairo-2"`).
  Le script remplace le module `cairosvg` par une coquille vide avant l'import : formes et texte fonctionnent, mais **les images SVG ne peuvent pas être insérées**.
  La vraie solution est d'installer GTK/Cairo sur le poste (installation système, à n'entreprendre qu'avec l'accord de l'utilisateur).
- protograf lit les **épaisseurs de trait en points**, pas dans l'unité de la page (conversion `ep × 72 / 25,4`).
- protograf ne remplit que des hexagones, des triangles réguliers, des cercles et des rectangles : pas de polygone quelconque rempli.
- protograf lit lui-même `sys.argv` : vider les arguments avant de l'appeler.
- Les repères de coupe d'un hexagone sont six traits radiaux face aux sommets ; la gouttière de 16 mm évite que ceux de deux tuiles voisines se croisent. À faire valider par l'advisor prépresse.
