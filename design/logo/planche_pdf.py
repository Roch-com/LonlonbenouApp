# -*- coding: utf-8 -*-
"""Une planche contact du PDF, pour juger la mise en page.

Un document de treize pages ne se verifie pas en le supposant : il se regarde.
Ce script rastérise chaque page et les pose côte à côte.
"""
import io
import sys

import pymupdf
from PIL import Image

if __name__ == '__main__':
    source, sortie = sys.argv[1], sys.argv[2]
    ppp = int(sys.argv[3]) if len(sys.argv) > 3 else 54
    colonnes = int(sys.argv[4]) if len(sys.argv) > 4 else 5

    doc = pymupdf.open(source)
    vues = [
        Image.open(io.BytesIO(p.get_pixmap(dpi=ppp).tobytes('png')))
        for p in doc
    ]
    L, H = vues[0].size
    lignes = (len(vues) + colonnes - 1) // colonnes
    marge = 8
    planche = Image.new(
        'RGB',
        (L * colonnes + marge * (colonnes + 1), H * lignes + marge * (lignes + 1)),
        (150, 155, 165),
    )
    for i, v in enumerate(vues):
        x, y = i % colonnes, i // colonnes
        planche.paste(v, (marge + x * (L + marge), marge + y * (H + marge)))
    planche.save(sortie)
    print(f'{len(vues)} pages -> {sortie} {planche.size}')
