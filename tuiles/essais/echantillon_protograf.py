"""Échantillon de tuiles hexagonales : version protograf.

Cairo est absent sous Windows : on remplace le module cairosvg par une coquille vide avant l'import.
Cela suffit pour dessiner des formes et du texte ; cela empêche d'insérer des images SVG.
"""
import sys
import types
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.modules['cairosvg'] = types.ModuleType('cairosvg')
CONTROLE = len(sys.argv) > 1 and sys.argv[1] == 'controle'
sys.argv = sys.argv[:1]   # protograf lit lui-même la ligne de commande
from protograf import *   # noqa: E402
import geometrie as g     # noqa: E402

PT = 72 / 25.4            # protograf lit les épaisseurs de trait en points, pas en millimètres


def main(guides):
    nom = 'tuiles/sortie/echantillon_protograf' + ('_controle' if guides else '') + '.pdf'
    Create(filename=nom, paper='A4', margin=0, units='mm')
    ops, pos = g.feuille('Échantillon de tuiles hexagonales : protograf', guides)
    g.verifier(pos)
    for op in ops:
        t = op[0]
        if t == 'hex':
            _, cx, cy, plat, fond, trait, ep = op
            Hexagon(x=cx - plat / 2, y=cy - g.rayon(plat), height=plat, orientation='pointy',
                    fill=fond, stroke=trait or fond, stroke_width=ep * PT if trait else 0)
        elif t == 'tri':
            _, cx, cy, r, fond, trait, ep = op
            Polygon(cx=cx, cy=cy, radius=r, sides=3, fill=fond, stroke=trait, stroke_width=ep * PT)
        elif t == 'cercle':
            _, cx, cy, r, fond, trait, ep = op
            Circle(cx=cx, cy=cy, radius=r, fill=fond, stroke=trait or fond, stroke_width=ep * PT)
        elif t == 'ligne':
            _, pts, couleur, ep = op
            Polyline(points=pts, stroke=couleur, stroke_width=ep * PT)
        elif t == 'texte':
            _, x, y, s, taille, couleur = op
            Text(text=s, x=x, y=y, font_size=taille, align='centre', stroke=couleur)
    Save()
    print(nom)


if __name__ == '__main__':
    main(CONTROLE)
