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
