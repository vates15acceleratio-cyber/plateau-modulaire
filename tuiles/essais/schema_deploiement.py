"""Schéma de réflexion : trois façons de matérialiser les cases de déploiement (rien de décidé)."""
import math
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf
from echantillon_pymupdf import dessiner, K

PAGE = (297.0, 210.0)
FLAT = 12.0
VERT, ROUGE, NOIR = '#007A4D', '#D8321C', '#111111'
GRIS, NOYAU = '#e4e4e4', '#d9c9a3'
CASES = [(q, r) for q in range(-3, 4) for r in range(-3, 4) if abs(q + r) <= 3]
RETIREES = {(3, -3), (-3, 3), (3, -1)}          # un plateau de forme libre : quelques cases en moins
CASES = [c for c in CASES if c not in RETIREES]
CENTRE = {(0, 0), (1, 0), (-1, 0), (0, 1), (0, -1), (1, -1), (-1, 1)}
BASE_N, BASE_S = [(0, -3), (1, -3), (0, -2)], [(0, 3), (-1, 3), (0, 2)]
BORD_N, BORD_S = [(0, -3), (2, -3)], [(-2, 3), (0, 3)]


def xy(q, r, ox, oy):
    return ox + FLAT * (q + r / 2), oy + FLAT * math.sqrt(3) / 2 * r


def panneau(ox, oy, titre, sous, mode):
    ops = [('texte', ox, oy - 52, titre, 9, NOIR)]
    for i, t in enumerate(sous):
        ops.append(('texte', ox, oy - 46 + i * 4.2, t, 6.5, NOIR))
    for q, r in CASES:
        fond = NOYAU if (q, r) in CENTRE else GRIS
        if mode == 'A' and (q, r) in BASE_N + BASE_S:
            fond = VERT if (q, r) in BASE_N else ROUGE
        if mode == 'C' and (q, r) in BORD_N + [(1, -3)] + BORD_S + [(-1, 3)]:
            pass
        cx, cy = xy(q, r, ox, oy)
        ops.append(('hex', cx, cy, FLAT, fond, '#9a9a9a', 0.2))
    if mode == 'A':                                    # bloc « camp » d'un seul tenant
        for q, r in BASE_N + BASE_S:
            cx, cy = xy(q, r, ox, oy)
            ops.append(('cercle', cx, cy, 1.6, '#ffffff', NOIR, 0.3))
    elif mode == 'B':                                  # jetons posés sur des tuiles de bord
        for liste, col in ((BORD_N + [(1, -3)], VERT), (BORD_S + [(-1, 3)], ROUGE)):
            for q, r in liste:
                cx, cy = xy(q, r, ox, oy)
                ops.append(('cercle', cx, cy, 3.4, col, NOIR, 0.4))
                ops.append(('texte', cx, cy + 1.2, 'D', 6.5, '#ffffff'))
    elif mode == 'C':                                  # tuiles « camp » d'une case, de la couleur du joueur
        for liste, col in ((BORD_N + [(1, -3)], VERT), (BORD_S + [(-1, 3)], ROUGE)):
            for q, r in liste:
                cx, cy = xy(q, r, ox, oy)
                ops.append(('hex', cx, cy, FLAT, col, NOIR, 0.4))
                ops.append(('cercle', cx, cy, 1.6, '#ffffff', NOIR, 0.3))
    return ops


def main():
    ops = [('texte', PAGE[0] / 2, 12, 'Cases de déploiement : trois façons de les matérialiser (réflexion, rien n’est décidé)', 10, NOIR),
           ('texte', PAGE[0] / 2, 17.5, 'Plateau de forme libre (ici ~34 cases) · noyau fixe en beige · vert au nord, rouge au sud · cercle blanc = case où l’on forme un bataillon', 6.5, NOIR)]
    ops += panneau(52, 105, 'A · Bloc « camp » d’un seul tenant',
                   ['Un bloc de 3 cases par joueur, posé au bord.', 'Fort visuellement, mais il impose la forme du bord.'], 'A')
    ops += panneau(148.5, 105, 'B · Jetons de déploiement',
                   ['3 jetons par joueur, posés sur des tuiles de bord', 'de leur côté. Souple, mais ils se déplacent par erreur.'], 'B')
    ops += panneau(245, 105, 'C · Tuiles « camp » d’une case',
                   ['3 tuiles par joueur, de la couleur du joueur, posées', 'au bord comme les autres tuiles. Fixes et lisibles.'], 'C')
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE[0] * K, height=PAGE[1] * K)
    dessiner(page, ops)
    doc.save('tuiles/sortie/schema_deploiement.pdf')
    page.get_pixmap(dpi=110).save('tuiles/sortie/schema_deploiement.png')
    print('ok')


if __name__ == '__main__':
    main()
