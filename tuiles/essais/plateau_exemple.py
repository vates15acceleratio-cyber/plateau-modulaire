"""Un plateau d'exemple complet (illustration, pas un outil de génération).

91 cases en forme libre, symétrique par demi-tour autour de la case centrale (noyau fixe de 7 cases),
7 villes (une au centre, trois par camp, au moins 3 tuiles entre deux villes), 2 montagnes en blocs (4 + 5),
2 × 3 cases de déploiement au bord (option C : tuiles « camp »), plaines / forêts / marais pour le reste.
Tout est proposition de travail : voir docs/00-direction.md.
"""
import heapq
import math
import os
import random
import sys
from collections import deque
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pymupdf
import geometrie as g
from echantillon_pymupdf import dessiner, K

DIRS = [(1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)]
COUT = {'plaine': 1, 'foret': 2, 'marais': 2, 'ville': 1, 'camp': 1}      # PROPOSITION : rations pour entrer dans la case
FORMES = {'M4 zigzag': [(0, 0), (1, 0), (1, 1), (2, 1)],
          'M5 peigne': [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1)]}
NOYAU = {(0, 0)} | set(DIRS)
VERT, ROUGE, NOIR = '#007A4D', '#D8321C', '#111111'
ROCHE = '#c9c3b6'
FLAT = 13.0
SEUIL_VILLES = 4          # 4 pas = 3 tuiles entre deux villes


def dist(a, b):
    dq, dr = a[0] - b[0], a[1] - b[1]
    return (abs(dq) + abs(dr) + abs(dq + dr)) // 2


def sym(c):
    return (-c[0], -c[1])


def rot(c):
    return (-c[1], c[0] + c[1])


def voisins(c, cases):
    return [(c[0] + d[0], c[1] + d[1]) for d in DIRS if (c[0] + d[0], c[1] + d[1]) in cases]


def forme_libre(rng):
    """Hexagone de rayon 5 (91 cases), 3 paires de cases de bord retirées et 3 paires ajoutées : forme libre, symétrique."""
    base = {(q, r) for q in range(-6, 7) for r in range(-6, 7) if max(abs(q), abs(r), abs(q + r)) <= 5}
    bord = sorted(c for c in base if max(abs(c[0]), abs(c[1]), abs(c[0] + c[1])) == 5 and abs(c[1]) != 5 and c[1] > 0)
    for c in rng.sample(bord, 3):
        base -= {c, sym(c)}
    anneau6 = sorted(c for c in {(q, r) for q in range(-7, 8) for r in range(-7, 8)}
                     if max(abs(c[0]), abs(c[1]), abs(c[0] + c[1])) == 6 and abs(c[1]) <= 4 and c[1] > 0
                     and any(n in base for n in [(c[0] + d[0], c[1] + d[1]) for d in DIRS]))
    for c in rng.sample(anneau6, 3):
        base |= {c, sym(c)}
    assert len(base) == 91
    return base


def connexe(libres, depart):
    vus, file = {depart}, deque([depart])
    while file:
        c = file.popleft()
        for n in voisins(c, libres):
            if n not in vus:
                vus.add(n)
                file.append(n)
    return vus


def pas(libres, a):
    """Nombre de pas minimal depuis a vers chaque case libre."""
    d, file = {a: 0}, deque([a])
    while file:
        c = file.popleft()
        for n in voisins(c, libres):
            if n not in d:
                d[n] = d[c] + 1
                file.append(n)
    return d


def couts(terrain, sources):
    """Rations minimales depuis les cases-sources (entrer dans une case coûte son terrain)."""
    d = {s: 0 for s in sources}
    tas = [(0, s) for s in sources]
    while tas:
        v, c = heapq.heappop(tas)
        if v > d.get(c, 1e9):
            continue
        for n in voisins(c, terrain):
            t = terrain[n]
            if t == 'montagne':
                continue
            nv = v + COUT[t]
            if nv < d.get(n, 1e9):
                d[n] = nv
                heapq.heappush(tas, (nv, n))
    return d


def desequilibre(terrain, villes, camps_v, camps_r):
    dv, dr = couts(terrain, camps_v), couts(terrain, camps_r)
    return sum(abs(dv.get(v, 99) - dr.get(sym(v), 99)) for v in villes), dv, dr


def essai(cases, rng):
    interieur = {c for c in cases if max(abs(c[0]), abs(c[1]), abs(c[0] + c[1])) <= 4} - NOYAU
    s = rng.randint(0, 3)
    camps_v = [(s + i, -5) for i in range(3)]
    camps_r = [sym(c) for c in camps_v]
    assert all(c in cases for c in camps_v + camps_r)
    loin_camps = {c for c in interieur if all(dist(c, k) >= 2 for k in camps_v + camps_r)}
    # montagnes : deux blocs séparés d'au moins une case
    monts, pris = [], set()
    for nom in rng.sample(list(FORMES), len(FORMES)):
        forme = FORMES[nom]
        for _ in range(rng.randint(0, 5)):
            forme = [rot(c) for c in forme]
        poses = []
        for tq in range(-6, 7):
            for tr in range(-6, 7):
                bloc = {(q + tq, r + tr) for q, r in forme}
                if bloc <= loin_camps and not any(dist(a, b) < 2 for a in bloc for b in pris):
                    poses.append(bloc)
        if not poses:
            return None
        bloc = rng.choice(poses)
        monts.append((nom, bloc))
        pris |= bloc
    libres = cases - pris
    if len(connexe(libres, (0, 0))) != len(libres):
        return None
    # villes : une au centre, trois paires symétriques
    candidats = [c for c in libres if dist(c, (0, 0)) >= SEUIL_VILLES and sym(c) in libres
                 and all(dist(c, k) >= 2 for k in camps_v + camps_r)]
    if len(candidats) < 6:
        return None
    villes = [(0, 0)]
    for _ in range(3):
        bons = [c for c in candidats if c not in villes and sym(c) not in villes
                and all(dist(c, v) >= SEUIL_VILLES for v in villes) and dist(c, sym(c)) >= SEUIL_VILLES]
        bons = [c for c in bons if all(dist(sym(c), v) >= SEUIL_VILLES for v in villes)]
        if not bons:
            return None
        c = rng.choice(bons)
        villes += [c, sym(c)]
    for v in villes:                                    # 3 tuiles entre deux villes, en tenant compte des montagnes
        d = pas(libres, v)
        if any(d.get(w, 0) < SEUIL_VILLES for w in villes if w != v):
            return None
    # terrains : 49 plaines, 10 forêts, 10 marais sur les 69 cases restantes (≈ 70 / 15 / 15)
    reste = sorted(libres - set(villes) - set(camps_v) - set(camps_r))
    assert len(reste) == 69, len(reste)
    liste = ['plaine'] * 49 + ['foret'] * 10 + ['marais'] * 10
    rng.shuffle(liste)
    terrain = dict(zip(reste, liste))
    for v in villes:
        terrain[v] = 'ville'
    for c in camps_v + camps_r:
        terrain[c] = 'camp'
    for _, bloc in monts:
        for c in bloc:
            terrain[c] = 'montagne'
    score, _, _ = desequilibre(terrain, villes, camps_v, camps_r)
    for _ in range(1500):                              # on échange deux terrains tant que ça ne dégrade pas l'équilibre
        a, b = rng.sample(reste, 2)
        if terrain[a] == terrain[b]:
            continue
        terrain[a], terrain[b] = terrain[b], terrain[a]
        nouveau, _, _ = desequilibre(terrain, villes, camps_v, camps_r)
        if nouveau <= score:
            score = nouveau
        else:
            terrain[a], terrain[b] = terrain[b], terrain[a]
    return score, terrain, villes, camps_v, camps_r, monts


def generer(graine, tentatives=400):
    rng = random.Random(graine)
    cases = forme_libre(rng)
    meilleur = None
    for _ in range(tentatives):
        r = essai(cases, rng)
        if r and (meilleur is None or r[0] < meilleur[0]):
            meilleur = r
            if r[0] == 0:
                break
    assert meilleur, 'aucun plateau trouvé'
    return cases, meilleur


# --------------------------------------------------------------------------- dessin
def xy(c, ox, oy):
    return ox + FLAT * (c[0] + c[1] / 2), oy + FLAT * math.sqrt(3) / 2 * c[1]


def chateau(cx, cy, s):
    pierre, trait = '#8a8172', '#2b1d10'

    def rect(x0, y0, x1, y1, f):
        return ('poly', [(cx + x0 * s, cy + y0 * s), (cx + x1 * s, cy + y0 * s), (cx + x1 * s, cy + y1 * s), (cx + x0 * s, cy + y1 * s)], f, trait, 0.25)
    ops = [rect(-3, -1, 3, 6, pierre), rect(-8, -6, -3, 6, pierre), rect(3, -6, 8, 6, pierre)]
    ops += [rect(x0, -7.6, x0 + 1.6, -6, pierre) for x0 in (-8, -4.6, 3, 6.4)]
    ops.append(rect(-1.6, 2, 1.6, 6, trait))
    return ops


def dessin(cases, res, ox=97.0, oy=112.0):
    score, terrain, villes, camps_v, camps_r, monts = res
    ops = [('texte', 148.5, 11, 'Plateau d’exemple complet (illustration, proposition à valider)', 10, g.NOIR),
           ('texte', 148.5, 16, '91 cases · 7 villes · 2 montagnes · 2 × 3 cases de déploiement · forme libre, symétrique par demi-tour', 6.5, g.NOIR)]
    fonds = {'plaine': g.TERRAINS['plaine']['fond'], 'foret': g.TERRAINS['foret']['fond'], 'marais': g.TERRAINS['marais']['fond'],
             'montagne': ROCHE, 'ville': '#d9c9a3'}
    for c in sorted(cases, key=lambda c: (c[1], c[0])):
        cx, cy = xy(c, ox, oy)
        t = terrain[c]
        fond = VERT if (t == 'camp' and c in camps_v) else ROUGE if t == 'camp' else fonds[t]
        trait = '#222222' if c in NOYAU else ('#9a9a9a' if t != 'montagne' else ROCHE)
        ops.append(('hex', cx, cy, FLAT, fond, trait, 0.9 if c in NOYAU else 0.2))
    for c in sorted(cases, key=lambda c: (c[1], c[0])):
        cx, cy = xy(c, ox, oy)
        t = terrain[c]
        if t == 'plaine':
            for dx in (-2.2, 0.0, 2.2):
                ops.append(('ligne', [(cx + dx - 0.9, cy + 1.2), (cx + dx, cy - 0.9), (cx + dx + 0.9, cy + 1.2)], '#3a5a2a', 0.25))
        elif t == 'foret':
            ops.append(('tri', cx, cy - 0.3, 2.6, '#1f3d24', '#ffffff', 0.2))
            ops.append(('ligne', [(cx, cy + 1.9), (cx, cy + 3.2)], '#2b1d10', 0.35))
        elif t == 'marais':
            for yv in (-1.6, 0.8):
                ops.append(('ligne', [(cx + x * 0.5, cy + yv + 0.6 * math.sin(x * 0.5 * 2 * math.pi / 4)) for x in range(-8, 9)], '#1c4f63', 0.3))
        elif t == 'camp':
            ops.append(('cercle', cx, cy, 1.9, '#ffffff', g.NOIR, 0.3))
        elif t == 'ville':
            ops += chateau(cx, cy - 0.8, 0.5)
            ops.append(('texte', cx, cy + 5.0, str(villes.index(c) + 1), 6.5, g.NOIR))
    f = FLAT / g.PLAT
    for _, bloc in monts:
        # contour d'un bloc à partir des centres réels
        sommets = []
        aretes = {}
        for c in bloc:
            cx, cy = xy(c, ox, oy)
            s = [(round(x, 3), round(y, 3)) for x, y in g.sommets(cx, cy, FLAT)]
            for k in range(6):
                aretes[(s[k], s[(k + 1) % 6])] = True
        ext = {a: b for (a, b) in aretes if (b, a) not in aretes}
        depart = next(iter(ext))
        sommets, cur = [depart], ext[depart]
        while cur != depart:
            sommets.append(cur)
            cur = ext[cur]
        ops.append(('ligne', sommets + [sommets[0]], '#2f2c28', 0.5))
        for c in sorted(bloc):
            cx, cy = xy(c, ox, oy)
            ops.append(('tri', cx, cy + 0.5, 4.4, '#8c867b', '#2f2c28', 0.35))
            ops.append(('tri', cx, cy - 1.2, 1.7, '#ffffff', '#2f2c28', 0.25))
    # légende et contrôles
    _, dv, dr = desequilibre(terrain, villes, camps_v, camps_r)
    libres = {c for c in cases if terrain[c] != 'montagne'}
    ecarts = []
    for i, v in enumerate(villes):
        d = pas(libres, v)
        ecarts += [d[w] for w in villes[i + 1:]]
    lx = 197.0
    ops.append(('textg', lx, 34, 'LÉGENDE', 8, g.NOIR))
    leg = [('plaine', 'Plaine : coût 1'), ('foret', 'Forêt : coût 2'), ('marais', 'Marais : coût 2'),
           ('montagne', 'Montagne : infranchissable (blocs de 4 et 5)'), ('ville', 'Ville (numérotée) : coût 1'),
           ('camp', 'Case de déploiement : vert au nord, rouge au sud')]
    for i, (t, texte) in enumerate(leg):
        y = 41 + i * 7.5
        fond = fonds.get(t, VERT)
        ops.append(('hex', lx + 3.5, y - 1.2, 7.0, fond, '#9a9a9a', 0.2))
        if t == 'camp':
            ops.append(('hex', lx + 3.5, y - 1.2, 7.0, VERT, '#9a9a9a', 0.2))
        ops.append(('textg', lx + 9, y, texte, 6.8, g.NOIR))
    ops.append(('textg', lx, 92, 'Noyau fixe : les 7 cases centrales (contour épais).', 6.8, g.NOIR))
    ops.append(('textg', lx, 108, 'CONTRÔLES', 8, g.NOIR))
    nb = {t: sum(1 for c in cases if terrain[c] == t) for t in ('plaine', 'foret', 'marais', 'montagne', 'ville', 'camp')}
    lignes = [f"Cases : {len(cases)} (plaine {nb['plaine']}, forêt {nb['foret']}, marais {nb['marais']}, montagne {nb['montagne']}, ville {nb['ville']}, déploiement {nb['camp']})",
              f"Villes : {len(villes)} ; écart minimal entre deux villes : {min(ecarts)} pas, soit {min(ecarts) - 1} tuiles entre elles",
              'Toutes les cases libres sont reliées entre elles.',
              f"Équilibre : écart total des coûts en rations vers les villes, vert contre rouge : {score}"]
    for i, t in enumerate(lignes):
        ops.append(('textg', lx, 114 + i * 5.2, t, 6.5, g.NOIR))
    ops.append(('textg', lx, 140, 'Coût minimal depuis un camp (rations)', 8, g.NOIR))
    ops.append(('textg', lx, 146, 'Ville', 6.5, g.NOIR))
    ops.append(('textg', lx + 25, 146, 'Vert', 6.5, g.NOIR))
    ops.append(('textg', lx + 50, 146, 'Rouge', 6.5, g.NOIR))
    for i, v in enumerate(villes):
        y = 152 + i * 5.2
        ops.append(('textg', lx, y, f'Ville {i + 1}' + (' (centre)' if v == (0, 0) else ''), 6.5, g.NOIR))
        ops.append(('textg', lx + 25, y, str(dv.get(v, '–')), 6.5, g.NOIR))
        ops.append(('textg', lx + 50, y, str(dr.get(v, '–')), 6.5, g.NOIR))
    ops.append(('textg', lx, 192, 'Hypothèses : coûts 1 / 2 / 2, 3 cases de déploiement par joueur (option C),', 6.2, g.NOIR))
    ops.append(('textg', lx, 197, '7 villes dont une au centre, tuiles de montagne placées à plus d’une case des camps.', 6.2, g.NOIR))
    return ops, nb, min(ecarts)


def main(graine):
    cases, res = generer(graine)
    ops, nb, ecart = dessin(cases, res)
    doc = pymupdf.open()
    page = doc.new_page(width=297 * K, height=210 * K)
    dessiner(page, ops)
    base = f'tuiles/sortie/plateau_exemple'
    doc.save(base + '.pdf')
    page.get_pixmap(dpi=110).save(base + '.png')
    print(graine, 'équilibre', res[0], nb, 'écart villes', ecart)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 7)
