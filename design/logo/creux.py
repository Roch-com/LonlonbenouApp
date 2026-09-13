# -*- coding: utf-8 -*-
"""
Génère les fichiers d'icône LONLONBENU — « Le Creux ».

Deux moitiés qui se rejoignent. Le cœur n'est jamais dessiné : c'est le vide
qu'elles laissent entre elles.

Trois choix éloignent la marque du carré bleu générique — celui qui tombe dans
le piège que les jetons nomment, « virer application bancaire » :

1. **Une superellipse, pas un rectangle arrondi.** Ses flancs restent presque
   droits et ne s'incurvent qu'aux angles : la forme se tient comme un sceau
   plutôt que comme une pastille d'interface.

2. **Deux bleus, pas un.** Les moitiés se distinguent — deux personnes, pas un
   bloc — sans que l'une domine l'autre.

3. **Une ligne d'or à la jointure, interrompue par le cœur.** Les jetons
   réservent l'or « aux moments rares » : la place où les deux se rejoignent
   en est un. La ligne s'ouvre dans le creux et reprend en dessous.
"""
import math

from PIL import Image, ImageChops, ImageDraw

# Palette réelle de l'application (packages/shared/src/design/tokens.ts).
BLEU = (0x1D, 0x4E, 0x89)
BLEU_FONCE = (0x12, 0x36, 0x61)
OR = (0xA9, 0x8A, 0x4C)
OR_CLAIR = (0xC9, 0xA9, 0x6A)
IVOIRE = (0xF5, 0xF8, 0xFC)
BLANC = (0xFF, 0xFF, 0xFF)

SUR = 4  # suréchantillonnage


def superellipse(demi=46.0, exposant=4.2, n=720):
    """Le contour du sceau, dans la boîte 100×100.

    L'exposant décide du caractère : 2 donne un cercle, l'infini un carré.
    Au-delà de 4, les flancs sont droits et seuls les angles s'arrondissent.
    """
    points = []
    for i in range(n):
        a = 2 * math.pi * i / n
        cos, sin = math.cos(a), math.sin(a)
        points.append((
            50.0 + demi * math.copysign(abs(cos) ** (2 / exposant), cos),
            50.0 + demi * math.copysign(abs(sin) ** (2 / exposant), sin),
        ))
    return points


def bezier_cubique(p0, c1, c2, p1, n=120):
    points = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        points.append((
            u ** 3 * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t ** 3 * p1[0],
            u ** 3 * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t ** 3 * p1[1],
        ))
    return points


def coeur():
    """Le creux central.

    Les lobes sont larges et la pointe courte : un cœur trop haut et trop
    pointu est celui des applications de rencontre. Celui-ci tire vers la
    graine — quelque chose qui pousse plutôt qu'une décoration.
    """
    pointe = (50.0, 74.0)
    return (
        bezier_cubique(pointe, (33.0, 62.0), (24.5, 54.0), (24.5, 44.5))
        + bezier_cubique((24.5, 44.5), (24.5, 36.0), (31.0, 30.5), (38.5, 30.5))[1:]
        + bezier_cubique((38.5, 30.5), (44.0, 30.5), (48.0, 34.0), (50.0, 38.6))[1:]
        + bezier_cubique((50.0, 38.6), (52.0, 34.0), (56.0, 30.5), (61.5, 30.5))[1:]
        + bezier_cubique((61.5, 30.5), (69.0, 30.5), (75.5, 36.0), (75.5, 44.5))[1:]
        + bezier_cubique((75.5, 44.5), (75.5, 54.0), (67.0, 62.0), pointe)[1:]
    )


def ajuster(points, facteur, centre_y=50.0):
    """Réduit et recentre le creux.

    À pleine taille, le cœur occupait la moitié de la largeur du sceau : on ne
    voyait plus deux moitiés séparées par un vide, mais un cœur posé sur un
    carré — et un cœur large et pointu est précisément celui des applications
    de rencontre. Réduit, il redevient ce qu'il doit être : l'espace que les
    deux laissent entre elles.
    """
    ys = [y for _, y in points]
    milieu = (min(ys) + max(ys)) / 2.0
    return [
        (50.0 + (x - 50.0) * facteur, centre_y + (y - milieu) * facteur)
        for x, y in points
    ]


SCEAU = superellipse()
COEUR = ajuster(coeur(), 0.64)
LARGEUR_JOINTURE = 4.6


def en_pixels(points, taille, occupation):
    echelle = taille * occupation / 100.0
    marge = (taille - taille * occupation) / 2.0
    return [(x * echelle + marge, y * echelle + marge) for x, y in points]


def masque(points, taille, occupation):
    m = Image.new('L', (taille, taille), 0)
    ImageDraw.Draw(m).polygon(en_pixels(points, taille, occupation), fill=255)
    return m


def masque_jointure(taille, occupation):
    demi = LARGEUR_JOINTURE / 2.0
    return masque(
        [(50 - demi, 0.0), (50 + demi, 0.0), (50 + demi, 100.0), (50 - demi, 100.0)],
        taille, occupation,
    )


def moitie(gauche, taille, occupation):
    bord = (0.0, 50.0) if gauche else (50.0, 100.0)
    return masque(
        [(bord[0], 0.0), (bord[1], 0.0), (bord[1], 100.0), (bord[0], 100.0)],
        taille, occupation,
    )


def rayon_max(formes):
    return max(math.hypot(x - 50.0, y - 50.0) for f in formes for x, y in f)


# Android rogne en cercle : ce qui compte est le point le plus éloigné du
# centre, pas la boîte englobante. 0,31 plutôt que le 0,333 théorique, les
# masques des fabricants étant un peu plus serrés que la norme.
SUR_ANDROID = 0.31 * 100.0 / rayon_max([SCEAU])


def marque(taille, occupation, fond=None, mono=False):
    grand = taille * SUR
    sceau = masque(SCEAU, grand, occupation)
    creux = masque(COEUR, grand, occupation)
    jointure = ImageChops.darker(masque_jointure(grand, occupation), sceau)

    image = Image.new('RGBA', (grand, grand), (*fond, 255) if fond else (0, 0, 0, 0))

    if mono:
        # Android ne garde que l'alpha et le teinte : une seule matière, et le
        # creux comme la jointure restent des vides.
        plein = ImageChops.subtract(ImageChops.subtract(sceau, creux), jointure)
        image.paste(BLANC + (255,), mask=plein)
        return image.resize((taille, taille), Image.LANCZOS)

    image.paste(BLEU + (255,), mask=ImageChops.darker(sceau, moitie(True, grand, occupation)))
    image.paste(BLEU_FONCE + (255,), mask=ImageChops.darker(sceau, moitie(False, grand, occupation)))
    image.paste(OR + (255,), mask=jointure)

    # Le creux est percé en dernier : il traverse les deux moitiés *et* l'or,
    # ce qui interrompt la ligne exactement là où le cœur commence.
    vide = (*fond, 255) if fond else (0, 0, 0, 0)
    image.paste(vide, mask=creux)

    return image.resize((taille, taille), Image.LANCZOS)


def aplat(taille, couleur):
    return Image.new('RGBA', (taille, taille), (*couleur, 255))


# ---------------------------------------------------------------------------
# Le même dessin, en SVG, pour l'ouverture animée de l'application.
#
# `MarqueAnimee.tsx` a besoin des mêmes contours que les icônes. Les réécrire à
# la main ferait deux sources pour une seule forme, et la retouche de l'une
# finirait par oublier l'autre. Ils sont donc **générés** d'ici.
# ---------------------------------------------------------------------------

def _n(v):
    """Un nombre court : deux décimales suffisent dans une boîte de 100."""
    return f'{v:.2f}'.rstrip('0').rstrip('.')


def polyligne_svg(points, pas=6):
    """Le contour échantillonné, en `d` SVG.

    Le sceau est calculé point par point : aucune courbe de Bézier ne le décrit
    exactement. On en garde un point sur `pas` — à 120 px d'affichage, l'écart
    entre deux points voisins reste sous le pixel.
    """
    gardes = points[::pas]
    tete = f'M{_n(gardes[0][0])} {_n(gardes[0][1])}'
    suite = ''.join(f'L{_n(x)} {_n(y)}' for x, y in gardes[1:])
    return f'{tete}{suite}Z'


def coeur_svg(facteur=0.64, centre_y=50.0):
    """Le creux, en vraies courbes.

    `ajuster` est une transformation affine : l'appliquer aux points de contrôle
    donne exactement la même courbe que l'appliquer aux points échantillonnés.
    Le cœur garde donc ses six cubiques plutôt que de devenir une polyligne.
    """
    ys = [y for _, y in coeur()]
    milieu = (min(ys) + max(ys)) / 2.0

    def t(p):
        return (50.0 + (p[0] - 50.0) * facteur, centre_y + (p[1] - milieu) * facteur)

    pointe = (50.0, 74.0)
    segments = [
        (pointe, (33.0, 62.0), (24.5, 54.0), (24.5, 44.5)),
        ((24.5, 44.5), (24.5, 36.0), (31.0, 30.5), (38.5, 30.5)),
        ((38.5, 30.5), (44.0, 30.5), (48.0, 34.0), (50.0, 38.6)),
        ((50.0, 38.6), (52.0, 34.0), (56.0, 30.5), (61.5, 30.5)),
        ((61.5, 30.5), (69.0, 30.5), (75.5, 36.0), (75.5, 44.5)),
        ((75.5, 44.5), (75.5, 54.0), (67.0, 62.0), pointe),
    ]

    depart = t(segments[0][0])
    d = f'M{_n(depart[0])} {_n(depart[1])}'
    for _, c1, c2, p1 in segments:
        for p in (c1, c2, p1):
            x, y = t(p)
            d += f'{"C" if p is c1 else " "}{_n(x)} {_n(y)}'
    return d + 'Z'


def couper(points, x, garder_gauche):
    """Sutherland-Hodgman contre une verticale.

    Le demi-plan est convexe : l'algorithme y est exact, et il suffit ici.
    """
    def dedans(p):
        return p[0] <= x if garder_gauche else p[0] >= x

    sortie = []
    for a, b in zip(points, points[1:] + points[:1]):
        a_dedans, b_dedans = dedans(a), dedans(b)
        if a_dedans:
            sortie.append(a)
        if a_dedans != b_dedans and a[0] != b[0]:
            t = (x - a[0]) / (b[0] - a[0])
            sortie.append((x, a[1] + (b[1] - a[1]) * t))
    return sortie


def demi_svg(garder_gauche, x_coupe=50.0, pas=6):
    """Une moitié de sceau, le creux déjà retiré.

    Deux sous-tracés remplis en « pair-impair » : la moitié de sceau, puis la
    moitié de cœur qu'elle contient. Le cœur étant entièrement à l'intérieur du
    sceau, l'inversion du second donne exactement la soustraction voulue — ce
    qui n'était pas le cas pour la ligne d'or, bien plus étroite que lui.
    """
    # On allège les contours AVANT de les couper, jamais après : la coupe
    # introduit les deux sommets qui tiennent le bord droit, et les décimer
    # ensuite en supprimait un sur six — le bord devenait une diagonale qui
    # traversait le sceau. Cela s'est vu tout de suite sur la moitié droite.
    sceau = couper(SCEAU[::pas], x_coupe, garder_gauche)
    creux = couper(COEUR[::pas], x_coupe, garder_gauche)
    return f'{polyligne_svg(sceau, 1)} {polyligne_svg(creux, 1)}'


def jointure_svg(haut=4.0, bas=96.0, pas=0.1):
    """La ligne d'or, déjà privée du creux.

    On ne peut pas la décrire par « pair-impair » comme le sceau : ce mode
    inverse tout ce qui est couvert deux fois, et le cœur étant bien plus large
    que la bande, il se remplirait d'or au lieu de l'interrompre. Ici la
    soustraction est donc faite pour de bon, et il n'en sort que deux polygones
    disjoints — au-dessus et en dessous du creux.

    Dans cette bande étroite, le cœur ne couvre qu'un seul intervalle vertical
    par abscisse : son bord haut est le pli entre les lobes, son bord bas la
    pointe. Deux segments suffisent donc à le contourner.
    """
    demi = LARGEUR_JOINTURE / 2.0
    xs = [50.0 - demi + i * pas for i in range(int(LARGEUR_JOINTURE / pas) + 1)]
    xs[-1] = 50.0 + demi

    def bornes(x):
        ys = []
        for (x1, y1), (x2, y2) in zip(COEUR, COEUR[1:] + COEUR[:1]):
            if (x1 - x) * (x2 - x) <= 0 and x1 != x2:
                ys.append(y1 + (y2 - y1) * (x - x1) / (x2 - x1))
        return (min(ys), max(ys)) if ys else None

    hauts = [(x, bornes(x)[0]) for x in xs]
    bas_ = [(x, bornes(x)[1]) for x in xs]

    def polygone(points):
        tete = f'M{_n(points[0][0])} {_n(points[0][1])}'
        return tete + ''.join(f'L{_n(x)} {_n(y)}' for x, y in points[1:]) + 'Z'

    dessus = polygone(
        [(xs[0], haut), (xs[-1], haut)] + list(reversed(hauts))
    )
    dessous = polygone(
        bas_ + [(xs[-1], bas), (xs[0], bas)]
    )
    return f'{dessus} {dessous}'


ENTETE_TS = '''// Généré par design/logo/creux.py — ne pas modifier à la main.
// Retoucher le dessin dans le générateur, puis :
//   python3 design/logo/creux.py --ts > apps/mobile/src/components/chrome/traces.ts

/** Le contour du sceau, dans une boîte de 100 × 100. */
export const SCEAU =
  {sceau};

/**
 * Les deux moitiés, le creux déjà retiré de chacune. Se remplissent en
 * « pair-impair » : second sous-tracé = la part de cœur que la moitié porte.
 *
 * Séparées, ces deux entailles ne ressemblent à rien. C'est le propos.
 */
export const SCEAU_GAUCHE =
  {sceau_gauche};

export const SCEAU_DROITE =
  {sceau_droite};

/**
 * La version d'une seule matière : le creux ET la jointure y restent des vides.
 * Pour les surfaces où la couleur ne passe pas — notification Android, tampon,
 * gravure, marque en filigrane sur une photographie.
 */
export const MONO_GAUCHE =
  {mono_gauche};

export const MONO_DROITE =
  {mono_droite};

/** Le creux central — un vide, jamais une forme posée par-dessus. */
export const COEUR =
  {coeur};

/**
 * La ligne d'or à la jointure des deux moitiés — le creux en est déjà retiré,
 * en deux morceaux disjoints. Se remplit en `nonzero` comme en `evenodd`.
 */
export const JOINTURE =
  {jointure};

/** Les deux moitiés : proches, distinctes, aucune ne domine. */
export const BLEU_GAUCHE = '{bleu}';
export const BLEU_DROITE = '{bleu_fonce}';
export const OR_JOINTURE = '{ligne_or}';

/**
 * L'or s'éclaircit sur fond sombre. Le ton nominal y perd son éclat et vire au
 * gris : ce n'est plus de l'or, c'est une rayure.
 */
export const OR_JOINTURE_SOMBRE = '{ligne_or_clair}';

/** Le fond ivoire des déclinaisons posées, et la matière des versions inversées. */
export const IVOIRE = '{ivoire}';
'''


def en_typescript():
    def couleur(c):
        return '#%02X%02X%02X' % c

    return ENTETE_TS.format(
        sceau=f"'{polyligne_svg(SCEAU)}'",
        coeur=f"'{coeur_svg()}'",
        jointure=f"'{jointure_svg()}'",
        bleu=couleur(BLEU),
        bleu_fonce=couleur(BLEU_FONCE),
        sceau_gauche=f"'{demi_svg(True)}'",
        sceau_droite=f"'{demi_svg(False)}'",
        mono_gauche=f"'{demi_svg(True, 50.0 - LARGEUR_JOINTURE / 2)}'",
        mono_droite=f"'{demi_svg(False, 50.0 + LARGEUR_JOINTURE / 2)}'",
        ligne_or=couleur(OR),
        ligne_or_clair=couleur(OR_CLAIR),
        ivoire=couleur(IVOIRE),
    )


if __name__ == '__main__':
    import os
    import sys

    if '--ts' in sys.argv:
        # La console Windows encode en cp1252 : sans cela, les accents du
        # fichier engendré sortent illisibles et TypeScript refuse le fichier.
        sys.stdout.reconfigure(encoding='utf-8', newline=chr(10))
        sys.stdout.write(en_typescript())
        raise SystemExit(0)

    dossier = sys.argv[1]
    os.makedirs(dossier, exist_ok=True)

    for nom, image in [
        ('icon.png', marque(1024, 0.98, fond=IVOIRE)),
        ('android-icon-foreground.png', marque(1024, SUR_ANDROID)),
        ('android-icon-background.png', aplat(1024, IVOIRE)),
        ('android-icon-monochrome.png', marque(1024, SUR_ANDROID, mono=True)),
        ('splash-icon.png', marque(1024, 0.98)),
        ('favicon.png', marque(196, 0.98, fond=IVOIRE)),
    ]:
        chemin = os.path.join(dossier, nom)
        image.save(chemin, 'PNG', optimize=True)
        print(f'{nom:32} {image.size[0]}x{image.size[1]}  {os.path.getsize(chemin):>7} o')
