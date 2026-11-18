"""Échantillon de tuiles hexagonales : version pymupdf (dessin direct en points, sans autre dépendance)."""
import math
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf
import geometrie as g

K = 72 / 25.4


def rgb(h):
    return tuple(int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)) if h else None


def pt(x, y):
    return pymupdf.Point(x * K, y * K)


def dessiner(page, ops):
    for op in ops:
        t = op[0]
        sh = page.new_shape()
        if t == 'hex':
            _, cx, cy, plat, fond, trait, ep = op
            sh.draw_polyline([pt(*p) for p in g.sommets(cx, cy, plat)] + [pt(*g.sommets(cx, cy, plat)[0])])
            sh.finish(fill=rgb(fond), color=rgb(trait), width=ep * K, closePath=True)
        elif t == 'tri':
            _, cx, cy, r, fond, trait, ep = op
            p = [(cx, cy - r), (cx + r * math.sqrt(3) / 2, cy + r / 2), (cx - r * math.sqrt(3) / 2, cy + r / 2)]
            sh.draw_polyline([pt(*q) for q in p] + [pt(*p[0])])
            sh.finish(fill=rgb(fond), color=rgb(trait), width=ep * K, closePath=True)
        elif t == 'cercle':
            _, cx, cy, r, fond, trait, ep = op
            sh.draw_circle(pt(cx, cy), r * K)
            sh.finish(fill=rgb(fond), color=rgb(trait), width=ep * K)
        elif t == 'ligne':
            _, pts, couleur, ep = op
            sh.draw_polyline([pt(*q) for q in pts])
            sh.finish(color=rgb(couleur), width=ep * K, closePath=False)
        elif t == 'texte':
            _, x, y, s, taille, couleur = op
            larg = pymupdf.get_text_length(s, fontname='helv', fontsize=taille)
            page.insert_text(pymupdf.Point(x * K - larg / 2, y * K), s, fontname='helv', fontsize=taille, color=rgb(couleur))
            continue
        sh.commit()


def main(guides):
    doc = pymupdf.open()
    page = doc.new_page(width=210 * K, height=297 * K)
    ops, pos = g.feuille('Échantillon de tuiles hexagonales : pymupdf', guides)
    g.verifier(pos)
    dessiner(page, ops)
    nom = 'tuiles/sortie/echantillon_pymupdf' + ('_controle' if guides else '') + '.pdf'
    doc.save(nom)
    print(nom)


if __name__ == '__main__':
    main(len(sys.argv) > 1 and sys.argv[1] == 'controle')
