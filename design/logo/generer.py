# -*- coding: utf-8 -*-
"""
Génère les fichiers d'icône LONLONBENU — piste A, « Le Miroir ».

Deux pétales identiques qui se recouvrent : le bleu d'encre porte la
structure, le rose marque exactement ce que les deux partagent.

Les courbes sont tracées ici plutôt que rasterisées depuis un SVG : cela
évite une dépendance de plus et donne le contrôle exact du suréchantillonnage,
qui est ce qui rend les bords nets à 48 px.
"""
import math

from PIL import Image, ImageChops, ImageDraw

# Palette réelle de l'application (packages/shared/src/design/tokens.ts).
BLEU = (0x1D, 0x4E, 0x89)
ROSE = (0xA8, 0x45, 0x5A)
IVOIRE = (0xF5, 0xF8, 0xFC)
BLANC = (0xFF, 0xFF, 0xFF)

SUR = 4  # facteur de suréchantillonnage


def bezier(p0, c, p1, n=240):
    """Points d'une courbe quadratique, échantillonnée finement."""
    points = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        points.append((
            u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0],
            u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1],
        ))
    return points


def petale(x, gauche, droite):
    """Un pétale : deux courbes qui se rejoignent en haut et en bas."""
    haut, bas = (x, 16.0), (x, 84.0)
    return bezier(haut, (gauche, 50.0), bas) + bezier(bas, (droite, 50.0), haut)[1:]


# Proportions : 60 de large sur 68 de haut, recouvrement de 20.
#
# La première version faisait 28 de large sur 68 : deux fuseaux trop étroits,
# qui se lisaient comme des feuilles et laissaient la marque flotter dans le
# vide. Un pétale de 40, écarté de 20 de son jumeau, remplit le canevas et
# laisse au rose la place d'exister.
#
# Le point de contrôle se déduit du bord voulu : une quadratique passe à
# mi-chemin entre ses extrémités et son contrôle, donc contrôle = 2×bord − x.
def pivoter(points, degres, centre=(50.0, 50.0)):
    """Fait tourner des points autour d'un centre."""
    a = math.radians(degres)
    cos, sin = math.cos(a), math.sin(a)
    cx, cy = centre
    return [
        (cx + (x - cx) * cos - (y - cy) * sin,
         cy + (x - cx) * sin + (y - cy) * cos)
        for x, y in points
    ]


# Les deux pétales, posés en diagonale.
#
# À la verticale, deux fuseaux encadrant une amande rose pointue se lisent
# sans ambiguïté comme un sexe féminin — inacceptable pour une application
# d'intimité de couple, qui serait moquée ou signalée en magasin.
#
# L'inclinaison supprime cette lecture et donne du mouvement : deux formes
# qui se penchent l'une vers l'autre plutôt que deux traits parallèles.
INCLINAISON = 38.0

def recentrer(formes):
    """Recentre l'ensemble dans la boîte 100×100.

    La rotation conserve le centre géométrique mais pas le centre de la boîte
    englobante : sans ce recadrage, la marque penche vers un coin, ce qui se
    voit surtout une fois l'icône rognée en cercle par Android.
    """
    tous = [p for forme in formes for p in forme]
    xs = [x for x, _ in tous]
    ys = [y for _, y in tous]
    dx = 50.0 - (min(xs) + max(xs)) / 2.0
    dy = 50.0 - (min(ys) + max(ys)) / 2.0
    return [[(x + dx, y + dy) for x, y in forme] for forme in formes]


PETALE_GAUCHE, PETALE_DROIT = recentrer([
    pivoter(petale(40.0, 0.0, 80.0), INCLINAISON),
    pivoter(petale(60.0, 100.0, 20.0), INCLINAISON),
])


def rayon_max(formes):
    """Distance du centre au point le plus éloigné, dans la boîte 100×100."""
    return max(
        math.hypot(x - 50.0, y - 50.0)
        for forme in formes
        for x, y in forme
    )


# Android rogne l'icône adaptative en cercle : seuls les 66 % centraux sont
# garantis visibles. Ce qui compte alors n'est pas la boîte englobante mais le
# point le plus éloigné du centre — une marque inclinée sort du cercle bien
# avant que sa boîte ne touche les bords.
#
# On vise 0,31 de rayon plutôt que le 0,333 théorique : les fabricants
# appliquent des masques un peu plus serrés que la norme.
RAYON_SUR = 0.31


def occupation_sure(formes):
    return RAYON_SUR * 100.0 / rayon_max(formes)


def en_pixels(points, taille, occupation):
    """Place la boîte 100×100 dans un carré centré de `occupation` du canevas."""
    echelle = taille * occupation / 100.0
    marge = (taille - taille * occupation) / 2.0
    return [(x * echelle + marge, y * echelle + marge) for x, y in points]


def masque(points, taille, occupation):
    m = Image.new('L', (taille, taille), 0)
    ImageDraw.Draw(m).polygon(en_pixels(points, taille, occupation), fill=255)
    return m


def marque(taille, occupation, fond=None, mono=False):
    """Dessine la marque. `fond` à None laisse le canevas transparent."""
    grand = taille * SUR
    gauche = masque(PETALE_GAUCHE, grand, occupation)
    droit = masque(PETALE_DROIT, grand, occupation)
    union = ImageChops.lighter(gauche, droit)
    commun = ImageChops.darker(gauche, droit)

    image = Image.new('RGBA', (grand, grand), (*fond, 255) if fond else (0, 0, 0, 0))

    if mono:
        # Le recouvrement est évidé plutôt que peint : Android ne garde que
        # l'alpha et le teinte lui-même. Un aplat plein perdrait les deux
        # pétales ; le creux les laisse se lire.
        image.paste(BLANC + (255,), mask=ImageChops.subtract(union, commun))
    else:
        image.paste(BLEU + (255,), mask=union)
        image.paste(ROSE + (255,), mask=commun)

    return image.resize((taille, taille), Image.LANCZOS)


def aplat(taille, couleur):
    return Image.new('RGBA', (taille, taille), (*couleur, 255))


SUR_ANDROID = occupation_sure([PETALE_GAUCHE, PETALE_DROIT])

CIBLE = '../../../../../../Downloads/LONLONBENOU/LONLONBENOU_APP/apps/mobile/assets'

if __name__ == '__main__':
    import os
    import sys

    dossier = sys.argv[1] if len(sys.argv) > 1 else CIBLE
    os.makedirs(dossier, exist_ok=True)

    fichiers = [
        # iOS et usage général : fond plein, le système arrondit lui-même.
        ('icon.png', marque(1024, 1.00, fond=IVOIRE)),
        # Android découpe le premier plan : la marque tient dans les 66 %
        # centraux garantis, sans quoi ses extrémités seraient rognées.
        ('android-icon-foreground.png', marque(1024, SUR_ANDROID)),
        ('android-icon-background.png', aplat(1024, IVOIRE)),
        ('android-icon-monochrome.png', marque(1024, SUR_ANDROID, mono=True)),
        # L'écran d'ouverture pose la marque sur sa propre couleur de fond.
        ('splash-icon.png', marque(1024, 1.00)),
        ('favicon.png', marque(196, 1.00, fond=IVOIRE)),
    ]

    for nom, image in fichiers:
        chemin = os.path.join(dossier, nom)
        image.save(chemin, 'PNG', optimize=True)
        print(f'{nom:32} {image.size[0]}×{image.size[1]}  {os.path.getsize(chemin):>7} octets')
