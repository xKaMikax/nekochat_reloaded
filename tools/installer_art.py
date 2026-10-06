#!/usr/bin/env python3
"""Draws the picture for the Windows installer's first page, like the Windows XP CD welcome screen.
The parts (header, footer, panel with the flag, icons, arrows) are the bitmaps of the XP CD's SETUP.EXE
(tools/xp_setup_art/<resource id>.bmp). Writes build/installer-welcome.bmp (24-bit, 800x460); the clickable texts are
NSIS links placed over it (build/installer.nsh), so the positions here and the percentages there go together."""
from PIL import Image, ImageDraw, ImageFont
import os

W, HEAD, PANEL, FOOT = 800, 80, 280, 100
H = HEAD + PANEL + FOOT
art = lambda i: Image.open(f"tools/xp_setup_art/{i}.bmp").convert("RGB")
img = Image.new("RGB", (W, H))
img.paste(art(110).resize((W, HEAD)), (0, 0))
# The panel: picture 112 (with the flag) at the top left, its right edge continued over the rest.
left = art(112)
panel = Image.new("RGB", (W, PANEL))
for y in range(PANEL):
    edge = left.getpixel((left.width - 1, min(y, left.height - 1)))
    ImageDraw.Draw(panel).line([(0, y), (W, y)], fill=edge)
panel.paste(left, (0, 0))
img.paste(panel, (0, HEAD))
img.paste(art(111).resize((W, FOOT)), (0, HEAD + PANEL))

def paste_keyed(image, xy):
    """Icons are drawn on a magenta key colour."""
    image = image.convert("RGBA")
    px = image.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b, _ = px[x, y]
            if (r, g, b) == (255, 0, 255): px[x, y] = (0, 0, 0, 0)
    img.paste(image, xy, image)

d = ImageDraw.Draw(img)
def font(size, bold=False, italic=False):
    name = "DejaVuSans" + ("-BoldOblique" if bold and italic else "-Bold" if bold else "-Oblique" if italic else "")
    return ImageFont.truetype(f"/usr/share/fonts/TTF/{name}.ttf", size)
def shadow_text(xy, text, f, fill=(255, 255, 255)):
    d.text((xy[0] + 2, xy[1] + 2), text, font=f, fill=(20, 40, 120)); d.text(xy, text, font=f, fill=fill)

shadow_text((118, 108), "Welcome to Nekochat Reloaded", font(28, True, True))
paste_keyed(art(50), (185, 160))
shadow_text((246, 172), "What do you want to do?", font(21, False, True), (222, 232, 255))
for index, y in enumerate((218, 258, 298)):
    paste_keyed(art(90 if index == 0 else 100), (240, y))
paste_keyed(art(80), (55, HEAD + PANEL + 28))
# the texts are part of the picture (a transparent label over a bitmap is not drawn reliably); NSIS puts clickable areas over them
body = font(17)
for text, y in (("Install Nekochat Reloaded", 232), ("View release notes", 272), ("Visit the project page", 312)):
    d.text((280, y - 11), text, font=body, fill=(255, 255, 255))
d.text((94, HEAD + PANEL + 28 + 3), "Exit", font=font(17, True), fill=(255, 255, 255))

os.makedirs("build", exist_ok=True)
img.save("build/installer-welcome.bmp", "BMP")
print("build/installer-welcome.bmp", img.size)

# --- the other wizard pages: a wide header (nsh stretches it over the window), and the side picture of the last page ---
BLUE = art(113).getpixel((0, 90))
def blend(a, b, t): return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
HW = 497   # the width of the wizard page area; nsh stretches the picture if the window differs a little
header = Image.new("RGB", (HW, 58), BLUE)
# only the last 140 px carry the glow and the flag: the title text boxes (solid BLUE, nsh) end before them
slice_ = art(113).crop((257, 21, 397, 79))
for x in range(140):
    for y in range(58):
        t = min(1, x / 40)
        slice_.putpixel((x, y), blend(BLUE, slice_.getpixel((x, y)), t))
header.paste(slice_, (HW - 140, 0))
hd = ImageDraw.Draw(header)
hd.line([(0, 55), (HW, 55)], fill=(255, 255, 255)); hd.line([(0, 56), (HW, 56)], fill=(255, 154, 44)); hd.line([(0, 57), (HW, 57)], fill=(255, 154, 44))
header.save("build/installer-header.bmp", "BMP")
header.crop((0, 0, 150, 57)).save("build/installerHeader.bmp", "BMP")  # the NSIS header picture (the wide one replaces it when the wizard starts)
side = Image.new("RGB", (164, 314), BLUE)
side.paste(art(112).crop((0, 0, 164, 180)), (0, 0))
foot = art(111).getpixel((20, 50))
for y in range(180, 314):
    ImageDraw.Draw(side).line([(0, y), (164, y)], fill=blend(BLUE, foot, (y - 180) / 133))
# the last page: the Nekochat cat (tools/installer_cat.svg rendered 5x by rsvg-convert -> installer_cat.png), glad that the setup is done:
# a green check badge and a few sparkles around it
cat = Image.open("tools/installer_cat.png").convert("RGBA")
side = side.convert("RGBA")
cx, cy = 12, 170
side.alpha_composite(cat, (cx, cy))
import math
big = Image.new("RGBA", (28 * 4, 28 * 4), (0, 0, 0, 0))
bd = ImageDraw.Draw(big)
bd.ellipse([0, 0, 111, 111], fill=(255, 255, 255, 255))
bd.ellipse([8, 8, 103, 103], fill=(46, 170, 52, 255))
bd.line([(28, 58), (48, 78), (86, 34)], fill=(255, 255, 255, 255), width=14, joint="curve")
badge = big.resize((28, 28), Image.LANCZOS)
side.alpha_composite(badge, (cx + 140 - 22, cy - 14))
def sparkle(x, y, r):
    layer = Image.new("RGBA", (r * 8, r * 8), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    c = r * 4
    ld.polygon([(c, c - 4 * r), (c + r, c - r), (c + 4 * r, c), (c + r, c + r), (c, c + 4 * r), (c - r, c + r), (c - 4 * r, c), (c - r, c - r)], fill=(255, 255, 255, 235))
    layer = layer.resize((r * 4, r * 4), Image.LANCZOS)
    side.alpha_composite(layer, (x - r * 2, y - r * 2))
sparkle(22, 160, 3); sparkle(150, 205, 2); sparkle(18, 262, 2); sparkle(142, 290, 3)
side.convert("RGB").save("build/installerSidebar.bmp", "BMP")
print("header, sidebar written")
