"""Fabrique le paquet transportable de l'atelier : dist/atelier-plateau.zip (Windows et Mac).

Contenu : la page, la page des planches d'impression, leurs scripts et leurs styles, les deux lanceurs et un mode d'emploi. Ni tests ni outils.
Le lanceur Mac garde son droit d'execution et ses fins de ligne Unix. Lancer depuis la racine du depot :
    python -I atelier/outils/empaqueter.py

Seuls les fichiers SUIVIS par git sont emballes (git ls-files) : un brouillon ou une copie de secours laisses dans
src/ ou styles/ ne partent jamais dans le paquet. Si l'un des fichiers a emballer porte des modifications non
committees, le script refuse de travailler (le paquet ne correspondrait a aucune version enregistree).
Options :
    --brouillon         emballer quand meme, avec le contenu present sur le disque (essai, jamais pour transmettre)
    --sortie <fichier>  ecrire l'archive ailleurs que dans dist/atelier-plateau.zip
"""
import os
import subprocess
import sys
import zipfile

RACINE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SOURCE = os.path.join(RACINE, 'atelier')
SORTIE = os.path.join(RACINE, 'dist', 'atelier-plateau.zip')
DOSSIER = 'Atelier du plateau'
GARDER = ['index.html', 'planches.html', 'Atelier.bat', 'Atelier.command', 'src', 'styles']
LISEZ_MOI = """ATELIER DU PLATEAU (Bannerlord)

Installation : decompressez ce dossier ou vous voulez (disque, cle USB). Rien d'autre a installer,
aucune connexion necessaire.

Lancer
  Windows : double-clic sur Atelier.bat (ou sur index.html).
  Mac     : double-clic sur index.html. Pour une fenetre a part : clic droit sur Atelier.command,
            puis Ouvrir (la premiere fois, macOS demande une confirmation).

Imprimer les tuiles
  Onglet Inventaire, lien "Planches d'impression (A3)" (ou ouvrez planches.html). Imprimez a 100 %,
  sans ajustement a la page, puis verifiez a la regle la barre de 100 mm en bas de chaque planche.

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


def git(*arguments):
    """Lance git dans le depot et rend sa sortie decoupee sur les octets nuls (chemins exacts, accents compris)."""
    try:
        r = subprocess.run(['git', '-C', RACINE] + list(arguments), capture_output=True, check=False)
    except OSError:
        raise SystemExit('Paquet non fabrique : la commande git est introuvable (elle sert a ne prendre que les fichiers suivis).')
    if r.returncode != 0:
        raise SystemExit('Paquet non fabrique : git a echoue (' + r.stderr.decode('utf-8', 'replace').strip()[:200] + ').')
    return [x for x in r.stdout.decode('utf-8', 'replace').split('\0') if x]


def fichiers_suivis():
    """Fichiers a emballer, relatifs a atelier/ : ceux de GARDER que git suit, dans l'ordre alphabetique."""
    chemins = ['atelier/' + e for e in GARDER]
    suivis = git('ls-files', '-z', '--', *chemins)
    return sorted(c[len('atelier/'):] for c in suivis if c.startswith('atelier/'))


def fichiers_modifies():
    """Parmi les fichiers a emballer, ceux qui different de la derniere version committee (y compris supprimes)."""
    chemins = ['atelier/' + e for e in GARDER]
    lignes = git('status', '--porcelain', '-z', '--untracked-files=no', '--', *chemins)
    return sorted(ligne[3:] for ligne in lignes if len(ligne) > 3)


def main(arguments=None):
    arguments = list(sys.argv[1:] if arguments is None else arguments)
    brouillon = '--brouillon' in arguments
    sortie = SORTIE
    if '--sortie' in arguments:
        rang = arguments.index('--sortie')
        if rang + 1 >= len(arguments):
            raise SystemExit('Option --sortie : il manque le nom du fichier.')
        sortie = os.path.abspath(arguments[rang + 1])
    inconnues = [a for i, a in enumerate(arguments) if a.startswith('--') and a not in ('--brouillon', '--sortie')]
    if inconnues:
        raise SystemExit('Option inconnue : ' + inconnues[0] + ' (options : --brouillon, --sortie <fichier>).')

    noms = fichiers_suivis()
    manquants = [e for e in ('index.html', 'planches.html', 'Atelier.bat', 'Atelier.command') if e not in noms]
    if manquants or not any(n.startswith('src/') for n in noms) or not any(n.startswith('styles/') for n in noms):
        raise SystemExit('Paquet non fabrique : fichiers attendus non suivis par git (' + ', '.join(manquants or ['src/ ou styles/']) + ').')
    modifies = fichiers_modifies()
    if modifies and not brouillon:
        raise SystemExit('Paquet non fabrique : ' + str(len(modifies)) + ' fichier(s) a emballer ont des modifications non committees ('
                         + ', '.join(modifies[:6]) + (', ...' if len(modifies) > 6 else '') + ').\n'
                         + 'Enregistrez d\'abord une version (commit), ou relancez avec --brouillon pour un paquet d\'essai.')

    os.makedirs(os.path.dirname(sortie), exist_ok=True)
    n = 0
    with zipfile.ZipFile(sortie, 'w') as z:
        for nom in noms:
            chemin = os.path.join(SOURCE, nom.replace('/', os.sep))
            if not os.path.isfile(chemin):
                raise SystemExit('Paquet non fabrique : fichier suivi par git mais absent du disque (' + nom + ').')
            ajouter(z, chemin, nom, executable=nom.endswith('.command'))
            n += 1
        info = zipfile.ZipInfo(DOSSIER + '/LISEZ-MOI.txt', date_time=(2026, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.create_system = 3
        info.external_attr = 0o644 << 16
        z.writestr(info, LISEZ_MOI.replace('\n', '\r\n').encode('utf-8'))
    print(f'{sortie} : {n + 1} fichiers, {os.path.getsize(sortie)} octets')
    if modifies:
        print('ATTENTION, paquet BROUILLON : ' + str(len(modifies)) + ' fichier(s) different de la derniere version committee. Ne pas transmettre.')


if __name__ == '__main__':
    sys.exit(main())
