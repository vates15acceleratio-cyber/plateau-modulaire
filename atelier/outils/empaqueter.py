"""Fabrique le paquet transportable de l'atelier : dist/atelier-plateau.zip (Windows et Mac).

Contenu : la page, ses scripts et ses styles, les deux lanceurs et un mode d'emploi. Ni tests ni outils.
Le lanceur Mac garde son droit d'execution et ses fins de ligne Unix. Lancer depuis la racine du depot :
    python -I atelier/outils/empaqueter.py
"""
import os
import sys
import zipfile

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(RACINE, 'atelier')
SORTIE = os.path.join(RACINE, 'dist', 'atelier-plateau.zip')
DOSSIER = 'Atelier du plateau'
GARDER = ['index.html', 'Atelier.bat', 'Atelier.command', 'src', 'styles']
LISEZ_MOI = """ATELIER DU PLATEAU (Bannerlord)

Installation : decompressez ce dossier ou vous voulez (disque, cle USB). Rien d'autre a installer,
aucune connexion necessaire.

Lancer
  Windows : double-clic sur Atelier.bat (ou sur index.html).
  Mac     : double-clic sur index.html. Pour une fenetre a part : clic droit sur Atelier.command,
            puis Ouvrir (la premiere fois, macOS demande une confirmation).

Vos plateaux
  La bibliotheque et le travail en cours sont gardes par le navigateur, sur ce poste.
  Pour les emporter ailleurs : Bibliotheque > Exporter tout, puis Importer sur l'autre poste.
  Changer de navigateur ou vider ses donnees de navigation fait repartir d'une bibliotheque vide :
  exportez regulierement.
"""


def ajouter(z, chemin, nom, executable=False):
    with open(chemin, 'rb') as f:
        donnees = f.read()
    if nom.endswith('.command'):
        donnees = donnees.replace(b'\r\n', b'\n')
    info = zipfile.ZipInfo(DOSSIER + '/' + nom, date_time=(2026, 1, 1, 0, 0, 0))
    info.compress_type = zipfile.ZIP_DEFLATED
    info.create_system = 3                                   # Unix : les droits sont lus par macOS
    info.external_attr = (0o755 if executable else 0o644) << 16
    z.writestr(info, donnees)


def main():
    os.makedirs(os.path.dirname(SORTIE), exist_ok=True)
    n = 0
    with zipfile.ZipFile(SORTIE, 'w') as z:
        for element in GARDER:
            chemin = os.path.join(SOURCE, element)
            if os.path.isdir(chemin):
                for dossier, _, fichiers in sorted(os.walk(chemin)):
                    for f in sorted(fichiers):
                        complet = os.path.join(dossier, f)
                        ajouter(z, complet, os.path.relpath(complet, SOURCE).replace(os.sep, '/'))
                        n += 1
            else:
                ajouter(z, chemin, element, executable=element.endswith('.command'))
                n += 1
        info = zipfile.ZipInfo(DOSSIER + '/LISEZ-MOI.txt', date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 3
        info.external_attr = 0o644 << 16
        z.writestr(info, LISEZ_MOI.replace('\n', '\r\n').encode('utf-8'))
    print(f'{SORTIE} : {n + 1} fichiers, {os.path.getsize(SORTIE)} octets')


if __name__ == '__main__':
    sys.exit(main())
