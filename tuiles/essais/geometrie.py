"""Géométrie commune de l'échantillon de tuiles hexagonales (unités : mm, origine en haut à gauche).

Ce module ne dessine rien : il produit une liste d'opérations simples que chaque outil
(protograf, pymupdf) rejoue à l'identique, pour comparer les deux sur la même feuille.
Formes admises : hexagone, triangle régulier, cercle, ligne brisée, texte. Ce sont celles
que protograf sait remplir (il ne remplit pas un polygone quelconque).
"""
import math
import random

SQ3 = math.sqrt(3)
PLAT = 45.0          # largeur plat à plat de la tuile coupée (pointe en haut)
FOND_PERDU = 3.0
SECURITE = 4.0
GOUTTIERE = 16.0     # entre deux coupes voisines : 2 × 3 mm de fond perdu + 10 mm pour les repères
PAS = PLAT + GOUTTIERE
NOIR = '#111111'

TERRAINS = {
    'plaine':   {'nom': 'PLAINE',   'fond': '#e6edc2'},
    'foret':    {'nom': 'FORÊT',    'fond': '#5d8a55'},
    'marais':   {'nom': 'MARAIS',   'fond': '#9db8b0'},
    'montagne': {'nom': 'MONTAGNE', 'fond': '#c9c3b6'},
}


def rayon(plat):
    """Distance du centre à un sommet pour un hexagone de largeur plat à plat donnée."""
    return plat / SQ3


def sommets(cx, cy, plat):
    r = rayon(plat)
    return [(cx + r * math.cos(math.radians(60 * k - 90)),
             cy + r * math.sin(math.radians(60 * k - 90))) for k in range(6)]


def dans_polygone(x, y, pts):
    dedans = False
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            dedans = not dedans
    return dedans


def positions(rng, n, ecart, plat_utile=31.0, ymax=7.0):
    """n points à au moins `ecart` les uns des autres, dans un hexagone réduit, au-dessus du libellé."""
    zone = sommets(0, 0, plat_utile)
    pts = []
    essais = 0
    while len(pts) < n and essais < 4000:
        essais += 1
        x, y = rng.uniform(-14, 14), rng.uniform(-15, ymax)
        if not dans_polygone(x, y, zone):
            continue
        if all(math.hypot(x - a, y - b) >= ecart for a, b in pts):
            pts.append((x, y))
    return pts


def motif(terrain, cx, cy, rng):
    ops = []
    if terrain == 'plaine':
        for x, y in positions(rng, 9, 6.0):
            for dx in (-1.3, 0.0, 1.3):
                ops.append(('ligne', [(cx + x, cy + y), (cx + x + dx, cy + y - (3.2 if dx == 0 else 2.6))], '#3a5a2a', 0.35))
    elif terrain == 'foret':
        for x, y in positions(rng, 6, 7.0, ymax=8.0):
            ops.append(('ligne', [(cx + x, cy + y + 2.4), (cx + x, cy + y + 4.0)], '#2b1d10', 0.5))
            ops.append(('tri', cx + x, cy + y, 3.2, '#1f3d24', '#ffffff', 0.3))
    elif terrain == 'marais':
        dec = rng.uniform(0, 5)
        for yv in (-9, -3, 3):
            pts = [(cx + x, cy + yv + 0.9 * math.sin((x + dec) * 2 * math.pi / 5)) for x in [i * 0.5 for i in range(-22, 23)]]
            ops.append(('ligne', pts, '#1c4f63', 0.45))
        for x, y in positions(rng, 4, 8.0, ymax=2.0):
            ops.append(('ligne', [(cx + x, cy + y), (cx + x, cy + y - 5.0)], '#4a3b22', 0.4))
            ops.append(('cercle', cx + x, cy + y - 5.4, 0.9, '#4a3b22', None, 0))
    elif terrain == 'montagne':
        a = rng.uniform(-4, -2)
        b = rng.uniform(4, 6)
        for x, y, r in ((a, 0.0, 6.5), (b, 3.0, 4.6)):
            ops.append(('tri', cx + x, cy + y, r, '#8c867b', '#2f2c28', 0.45))
            ops.append(('tri', cx + x, cy + y - 0.5 * r, r * 0.38, '#ffffff', '#2f2c28', 0.3))
    return ops


def tuile(terrain, graine, cx, cy, guides):
    rng = random.Random(graine)
    ops = [('hex', cx, cy, PLAT + 2 * FOND_PERDU, TERRAINS[terrain]['fond'], None, 0)]
    ops += motif(terrain, cx, cy, rng)
    ops.append(('texte', cx, cy + 13.5, TERRAINS[terrain]['nom'], 6.5, NOIR))
    if guides:
        ops.append(('hex', cx, cy, PLAT, None, '#e00000', 0.15))
        ops.append(('hex', cx, cy, PLAT - 2 * SECURITE, None, '#0050e0', 0.15))
    return ops


def reperes(cx, cy):
    """Six repères radiaux de 3 mm, face aux sommets, à 1,5 mm du fond perdu."""
    r_sommet_fp = rayon(PLAT + 2 * FOND_PERDU)
    ops = []
    for k in range(6):
        a = math.radians(60 * k - 90)
        r0, r1 = r_sommet_fp + 1.5, r_sommet_fp + 4.5
        ops.append(('ligne', [(cx + r0 * math.cos(a), cy + r0 * math.sin(a)),
                              (cx + r1 * math.cos(a), cy + r1 * math.sin(a))], NOIR, 0.25))
    return ops


def centres(lignes=(3, 2, 3), x0=40.0, y0=54.0):
    """Centres des tuiles en quinconce, 3 puis 2 puis 3 par rangée."""
    pas_v = PAS * SQ3 / 2
    res = []
    for i, n in enumerate(lignes):
        decal = 0.0 if i % 2 == 0 else PAS / 2
        for j in range(n):
            res.append((x0 + decal + j * PAS, y0 + i * pas_v))
    return res


def feuille(titre, guides=False):
    ops = [('texte', 105, 11, titre, 9, NOIR),
           ('texte', 105, 16, 'Tuile 45 mm plat à plat, pointe en haut · fond perdu 3 mm · sécurité 4 mm', 6.5, NOIR)]
    ordre = ['plaine', 'foret', 'marais', 'montagne', 'plaine', 'foret', 'marais', 'montagne']
    pos = centres()
    for i, (cx, cy) in enumerate(pos):
        ops += tuile(ordre[i], 1 + i // 4, cx, cy, guides)
    for cx, cy in pos:
        ops += reperes(cx, cy)
    # barre de contrôle de 100 mm
    ops.append(('ligne', [(10, 280), (110, 280)], NOIR, 0.4))
    for k in range(0, 101, 10):
        ops.append(('ligne', [(10 + k, 278), (10 + k, 282)], NOIR, 0.4))
    ops.append(('texte', 60, 287, 'Barre de contrôle : 100 mm', 6.5, NOIR))
    return ops, pos


def verifier(pos):
    """Aucun repère ne tombe dans le fond perdu d'une autre tuile ; aucun fond perdu ne déborde de la page."""
    bleus = [sommets(cx, cy, PLAT + 2 * FOND_PERDU) for cx, cy in pos]
    # les repères de deux tuiles voisines ne doivent pas se croiser : ils s'arrêtent avant le point où trois tuiles se rejoignent
    r_fin = rayon(PLAT + 2 * FOND_PERDU) + 4.5
    assert r_fin < PAS / SQ3 - 1.0, ('repères trop longs pour la gouttière', r_fin, PAS / SQ3)
    for i, (cx, cy) in enumerate(pos):
        for op in reperes(cx, cy):
            for x, y in op[1]:
                assert 10 <= x <= 200 and 10 <= y <= 287, ('repère hors marge', x, y)
                for j, poly in enumerate(bleus):
                    assert j == i or not dans_polygone(x, y, poly), ('repère dans un autre fond perdu', i, j)
    return True
