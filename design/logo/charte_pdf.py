# -*- coding: utf-8 -*-
"""Compose le PDF de la charte à partir de la page publiée.

La page web et le PDF sortent du **même fichier**. On ne recompose rien : on
enveloppe la source dans un document complet — l'hébergeur d'artefacts fournit
d'ordinaire cette enveloppe — et on lui ajoute la feuille d'impression.

Usage :
    python3 design/logo/charte_pdf.py <charte.html> <sortie.pdf>
"""
import io
import os
import pathlib
import subprocess
import sys
import tempfile

NAVIGATEURS = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
]

ENVELOPPE = '''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {{ color-scheme: light; }}
  body {{ margin: 0; font: 14px system-ui, sans-serif; }}
  img {{ max-width: 100%; }}
  [hidden] {{ display: none !important; }}
</style>
</head>
<body>
{corps}
<style>
{impression}
</style>
</body>
</html>
'''


def navigateur():
    for chemin in NAVIGATEURS:
        if os.path.exists(chemin):
            return chemin
    raise SystemExit('aucun navigateur sans interface trouvé')


def composer(source, feuille):
    corps = io.open(source, encoding='utf-8').read()
    impression = io.open(feuille, encoding='utf-8').read()
    # La feuille d'impression est déjà bornée par @page et les surcharges ;
    # l'envelopper dans @media print laisserait l'aperçu à l'écran intact et
    # n'appliquerait rien au rendu PDF sur certaines versions.
    return ENVELOPPE.format(corps=corps, impression=impression)


if __name__ == '__main__':
    source, sortie = sys.argv[1], sys.argv[2]
    feuille = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                           'charte-impression.css')

    dossier = tempfile.mkdtemp(prefix='charte-')
    page = os.path.join(dossier, 'charte.html')
    io.open(page, 'w', encoding='utf-8', newline='\n').write(composer(source, feuille))

    os.makedirs(os.path.dirname(os.path.abspath(sortie)), exist_ok=True)
    subprocess.run([
        navigateur(),
        '--headless',
        '--disable-gpu',
        '--no-pdf-header-footer',
        '--print-to-pdf-no-header',
        # Les polices viennent de Google Fonts : il faut laisser le temps au
        # réseau, sans quoi le PDF sort en police de repli sans rien signaler.
        '--virtual-time-budget=20000',
        '--print-to-pdf=' + os.path.abspath(sortie),
        pathlib.Path(page).as_uri(),
    ], check=True, capture_output=True)

    print(f'{sortie} — {os.path.getsize(sortie)} octets')
