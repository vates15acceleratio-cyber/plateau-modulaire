"""Feuille A3 des types de tuiles (proposition à valider) : plaine, forêt, marais, ville, montagnes en blocs.

Dessin direct avec pymupdf. Tout ce qui est chiffré ici (coûts en rations, nombres de tuiles, forme des montagnes)
est une PROPOSITION de travail, pas une décision de l'utilisateur : voir docs/00-direction.md.
"""
import math
import os
import random
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf
import geometrie as g
from echantillon_pymupdf import dessiner, K

PAGE = (297.0, 420.0)
MARGE = 7.0
COUT = {'plaine': 1, 'foret': 2, 'marais': 2}          # PROPOSITION : rations par déplacement
ROCHE = '#c9c3b6'
VILLE_FOND = '#d9c9a3'

# Cases axiales (q, r) des montagnes : infranchissables, d'un seul tenant.
MONTAGNES = {
    'M5 peigne':  [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1)],
    'M4 zigzag':  [(0, 0), (1, 0), (1, 1), (2, 1)],
}


def pastilles(cx, cy, n):
    return [('cercle', cx + (i - (n - 1) / 2) * 3.6, cy - 13.0, 1.05, '#ffffff', g.NOIR, 0.3) for i in range(n)]


def tuile_simple(terrain, graine, cx, cy, guides):
    rng = random.Random(graine)
    ops = [('hex', cx, cy, g.PLAT + 2 * g.FOND_PERDU, g.TERRAINS[terrain]['fond'], None, 0)]
    ops += g.motif(terrain, cx, cy, rng, ymin=-3.0 if terrain == 'marais' else -7.0)
    ops += pastilles(cx, cy, COUT[terrain])
    ops.append(('texte', cx, cy + 13.5, g.TERRAINS[terrain]['nom'], 6.5, g.NOIR))
    if guides:
        ops += [('hex', cx, cy, g.PLAT, None, '#e00000', 0.15), ('hex', cx, cy, g.PLAT - 2 * g.SECURITE, None, '#0050e0', 0.15)]
    return ops


def tuile_ville(cx, cy, guides):
    ops = [('hex', cx, cy, g.PLAT + 2 * g.FOND_PERDU, VILLE_FOND, None, 0)]
    pierre, trait = '#8a8172', '#2b1d10'

    def rect(x0, y0, x1, y1, fond):
        return ('poly', [(cx + x0, cy + y0), (cx + x1, cy + y0), (cx + x1, cy + y1), (cx + x0, cy + y1)], fond, trait, 0.35)
    ops += [rect(-3, -1, 3, 6, pierre), rect(-8, -6, -3, 6, pierre), rect(3, -6, 8, 6, pierre)]
    for x0 in (-8, -4.6, 3, 6.4):
        ops.append(rect(x0, -7.6, x0 + 1.6, -6, pierre))
    ops.append(rect(-1.6, 2, 1.6, 6, trait))
    ops.append(('texte', cx, cy + 13.5, 'VILLE', 6.5, g.NOIR))
    if guides:
        ops += [('hex', cx, cy, g.PLAT, None, '#e00000', 0.15), ('hex', cx, cy, g.PLAT - 2 * g.SECURITE, None, '#0050e0', 0.15)]
    return ops


def bloc_montagne(nom, cases, ox, oy, graine, guides):
    """Retourne (opérations, centres des fonds perdus, repères) d'une montagne d'un seul tenant."""
    centres = [(ox + g.centre_hex(q, r)[0], oy + g.centre_hex(q, r)[1]) for q, r in cases]
    contour = [(ox + x, oy + y) for x, y in g.contour(cases)]
    ops = [('hex', cx, cy, g.PLAT + 2 * g.FOND_PERDU, ROCHE, None, 0) for cx, cy in centres]
    rng = random.Random(graine)
    etiquette = (centres[0][0], centres[0][1] + 13.5)   # comme sur les tuiles simples : sous le centre de la première case
    pics = []
    for _ in range(6000):
        if len(pics) >= 2 * len(cases):
            break
        x, y = rng.uniform(min(c[0] for c in contour), max(c[0] for c in contour)), rng.uniform(min(c[1] for c in contour), max(c[1] for c in contour))
        r = rng.uniform(4.5, 6.5)
        if g.dans_polygone(x, y, contour) and g.distance_contour(x, y, contour) >= g.SECURITE + r + 1.5 \
                and math.hypot(x - etiquette[0], y - etiquette[1]) >= 13.0 \
                and all(math.hypot(x - a, y - b) >= 12.5 for a, b, _ in pics):
            pics.append((x, y, r))
    for x, y, r in sorted(pics, key=lambda p: p[1]):
        ops.append(('tri', x, y, r, '#8c867b', '#2f2c28', 0.45))
        ops.append(('tri', x, y - 0.5 * r, r * 0.38, '#ffffff', '#2f2c28', 0.3))
    ops.append(('texte', etiquette[0], etiquette[1], f'MONTAGNE ({len(cases)})', 6.5, g.NOIR))
    if guides:
        ops.append(('ligne', contour + [contour[0]], '#e00000', 0.15))
    marques = [((ox + a[0], oy + a[1]), (ox + b[0], oy + b[1])) for a, b in g.repere_bloc(g.contour(cases))]
    return ops, centres, marques


def feuille(guides):
    ops = [('texte', PAGE[0] / 2, 11, 'Types de tuiles hexagonales : proposition à valider', 9, g.NOIR),
           ('texte', PAGE[0] / 2, 15.5, 'Tuile 45 mm plat à plat, pointe en haut · fond perdu 3 mm · sécurité 4 mm · coûts et nombres : propositions', 6.5, g.NOIR)]
    pieces = []   # (centres des fonds perdus, repères)

    simples = [('plaine', 1, 40, 56), ('foret', 1, 101, 56), ('marais', 1, 162, 56)]
    for terrain, graine, cx, cy in simples:
        ops += tuile_simple(terrain, graine, cx, cy, guides)
        pieces.append(([(cx, cy)], [(op[1][0], op[1][1]) for op in g.reperes(cx, cy)]))
    ops += tuile_ville(223, 56, guides)
    pieces.append(([(223, 56)], [(op[1][0], op[1][1]) for op in g.reperes(223, 56)]))

    for (nom, cases), (ox, oy), graine in zip(MONTAGNES.items(), [(45, 136), (45, 236)], (3, 4)):
        o, centres, marques = bloc_montagne(nom, cases, ox, oy, graine, guides)
        ops += o
        pieces.append((centres, marques))

    # repères dessinés après les fonds
    for centres, marques in pieces:
        for a, b in marques:
            ops.append(('ligne', [a, b], g.NOIR, 0.25))

    # légende (proposition) et barre de contrôle de 100 mm
    lx, ly = 180.0, 132.0
    ops.append(('textg', lx, ly, 'PROPOSITION D’INVENTAIRE (à valider)', 8, g.NOIR))
    lignes = ['Plaine : 49 tuiles · coût 1 ration (1 point)', 'Forêt : 10 tuiles · coût 2 rations (2 points)',
              'Marais : 10 tuiles · coût 2 rations (2 points)', 'Montagnes : 2 blocs (5 + 4 = 9 cases), infranchissables',
              'Villes : 7 tuiles', 'Déploiement : 6 cases (3 par joueur), non dessinées ici',
              'Total : 49 + 10 + 10 + 9 + 7 + 6 = 91 cases']
    for i, t in enumerate(lignes):
        ops.append(('textg', lx, ly + 7 + i * 5.5, t, 6.8, g.NOIR))
    bx, by = 180.0, 190.0
    ops.append(('ligne', [(bx, by), (bx + 100, by)], g.NOIR, 0.4))
    for k in range(0, 101, 10):
        ops.append(('ligne', [(bx + k, by - 2), (bx + k, by + 2)], g.NOIR, 0.4))
    ops.append(('texte', bx + 50, by + 7, 'Barre de contrôle : 100 mm', 6.5, g.NOIR))
    return ops, pieces


def verifier(pieces):
    tous = [(i, c) for i, (centres, _) in enumerate(pieces) for c in centres]
    # 1. deux pièces différentes restent à plus d'un pas l'une de l'autre (gouttière de 16 mm)
    for i, (pi, a) in enumerate(tous):
        for pj, b in tous[i + 1:]:
            if pi != pj:
                assert math.hypot(a[0] - b[0], a[1] - b[1]) >= g.PAS - 0.01, ('pièces trop proches', pi, pj, a, b)
    # 2. aucun repère dans un fond perdu, aucun élément hors marge
    bleus = [(i, g.sommets(cx, cy, g.PLAT + 2 * g.FOND_PERDU)) for i, c in enumerate(p[0] for p in pieces) for cx, cy in c]
    for i, (_, marques) in enumerate(pieces):
        for a, b in marques:
            for x, y in (a, b):
                assert MARGE <= x <= PAGE[0] - MARGE and MARGE <= y <= PAGE[1] - MARGE, ('repère hors marge', i, x, y)
                for j, poly in bleus:
                    assert not g.dans_polygone(x, y, poly), ('repère dans un fond perdu', i, j, x, y)
    for i, (centres, _) in enumerate(pieces):
        for cx, cy in centres:
            for x, y in g.sommets(cx, cy, g.PLAT + 2 * g.FOND_PERDU):
                assert MARGE <= x <= PAGE[0] - MARGE and MARGE <= y <= PAGE[1] - MARGE, ('fond perdu hors marge', i, x, y)
    return True


def main(guides):
    doc = pymupdf.open()
    page = doc.new_page(width=PAGE[0] * K, height=PAGE[1] * K)
    ops, pieces = feuille(guides)
    verifier(pieces)
    dessiner(page, ops)
    nom = 'tuiles/sortie/types_de_tuiles' + ('_controle' if guides else '') + '.pdf'
    doc.save(nom)
    print(nom)


if __name__ == '__main__':
    main(len(sys.argv) > 1 and sys.argv[1] == 'controle')
