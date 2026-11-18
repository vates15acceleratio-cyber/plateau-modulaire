"""Rend les PDF en PNG (couleur et niveaux de gris) et mesure les hexagones."""
import sys, os
import pymupdf
from PIL import Image
K = 72 / 25.4
for nom in sys.argv[1:]:
    d = pymupdf.open(nom)
    p = d[0]
    base = os.path.splitext(nom)[0]
    pix = p.get_pixmap(dpi=110)
    pix.save(base + '.png')
    Image.open(base + '.png').convert('L').save(base + '_gris.png')
    hexs = [dr['rect'] for dr in p.get_drawings() if dr.get('fill') and abs(dr['rect'].width / K - 51) < 0.2]
    print(nom, 'pages', d.page_count, 'hex fond perdu', len(hexs),
          'largeur', sorted({round(r.width / K, 2) for r in hexs}), 'hauteur', sorted({round(r.height / K, 2) for r in hexs}))
