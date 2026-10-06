#!/usr/bin/env python3
"""Draws the pictures of the website (site/public/img): banner, tiled background, blinking NEW!, construction sign,
88x31 buttons, rainbow rule, bullets, the screenshot. Run from site/: python3 tools/make_art.py"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = "public/img"
os.makedirs(OUT, exist_ok=True)
FONTS = "/usr/share/fonts/TTF/"
def font(name, size): return ImageFont.truetype(FONTS + name, size)

# --- banner 760x100: navy to blue, a glare, the cat, the name with a shadow ---------------------------------------
W, H = 760, 100
banner = Image.new("RGB", (W, H))
bd = ImageDraw.Draw(banner)
for y in range(H):
    t = y / (H - 1)
    bd.line([(0, y), (W, y)], fill=(int(10 + 20 * t), int(40 + 70 * t), int(150 + 80 * t)))
glare = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glare)
gd.ellipse([-120, -120, 380, 60], fill=(255, 255, 255, 46))
banner = Image.alpha_composite(banner.convert("RGBA"), glare).convert("RGB")
bd = ImageDraw.Draw(banner)
cat = Image.open("tools/cat28.png").convert("RGBA").resize((84, 78), Image.NEAREST)
banner.paste(cat, (16, 11), cat)
title = font("DejaVuSans-BoldOblique.ttf", 40)
bd.text((118, 12), "Nekochat Reloaded", font=title, fill=(0, 20, 90))
bd.text((116, 10), "Nekochat Reloaded", font=title, fill=(255, 255, 255))
sub = font("DejaVuSans-Oblique.ttf", 15)
bd.text((120, 64), "the Windows XP style client for Nekochat - chat, call, play", font=sub, fill=(0, 20, 90))
bd.text((119, 63), "the Windows XP style client for Nekochat - chat, call, play", font=sub, fill=(255, 238, 120))
bd.rectangle([0, H - 3, W, H], fill=(255, 150, 40))
banner.save(f"{OUT}/banner.png")
# the strip that continues the banner to the right edge of any screen (the last column of the banner, repeated)
strip = banner.crop((W - 1, 0, W, H)).resize((8, H))
strip.save(f"{OUT}/banner-fill.png")

# --- the picture a link to the site shows in chats (Open Graph): 1200 x 630 ---------------------------------------------------
og = Image.new("RGB", (1200, 630))
od = ImageDraw.Draw(og)
for y in range(630):
    t = y / 629
    od.line([(0, y), (1200, y)], fill=(int(10 + 20 * t), int(40 + 70 * t), int(150 + 80 * t)))
glare_og = Image.new("RGBA", (1200, 630), (0, 0, 0, 0))
ImageDraw.Draw(glare_og).ellipse([-300, -400, 800, 260], fill=(255, 255, 255, 40))
og = Image.alpha_composite(og.convert("RGBA"), glare_og).convert("RGB")
od = ImageDraw.Draw(og)
big_cat = Image.open("tools/cat28.png").convert("RGBA").resize((28 * 9, 26 * 9), Image.NEAREST)
og.paste(big_cat, (90, 140), big_cat)
f1 = font("DejaVuSans-BoldOblique.ttf", 84); f2 = font("DejaVuSans-Oblique.ttf", 36)
od.text((402, 172), "Nekochat Reloaded", font=f1, fill=(0, 20, 90)); od.text((398, 168), "Nekochat Reloaded", font=f1, fill=(255, 255, 255))
od.text((404, 292), "Chat, call and play like it is Windows XP", font=f2, fill=(0, 20, 90)); od.text((402, 290), "Chat, call and play like it is Windows XP", font=f2, fill=(255, 238, 120))
od.rectangle([0, 600, 1200, 630], fill=(255, 150, 40))
og.save(f"{OUT}/og.png")

# --- the page background: a small pale tile -----------------------------------------------------------------
tile = Image.new("RGB", (8, 8), (226, 234, 247))
td = ImageDraw.Draw(tile)
td.point([(0, 0), (4, 4)], fill=(206, 218, 240))
tile.save(f"{OUT}/bg.gif")

# --- blinking NEW! -------------------------------------------------------------------------------------------
def new_frame(fg, bg):
    im = Image.new("RGB", (42, 16), bg)
    ImageDraw.Draw(im).text((3, 1), "NEW!", font=font("DejaVuSans-Bold.ttf", 12), fill=fg)
    return im
frames = [new_frame((255, 255, 0), (220, 0, 0)), new_frame((220, 0, 0), (255, 255, 0))]
frames[0].save(f"{OUT}/new.gif", save_all=True, append_images=frames[1:], duration=500, loop=0)

# --- construction sign -----------------------------------------------------------------------------------------
def sign(offset):
    im = Image.new("RGB", (220, 44), (255, 204, 0))
    d = ImageDraw.Draw(im)
    for x in range(-60 + offset, 280, 20):
        d.polygon([(x, 0), (x + 10, 0), (x - 10, 44), (x - 20, 44)], fill=(30, 30, 30))
    d.rectangle([22, 8, 197, 35], fill=(255, 204, 0), outline=(30, 30, 30))
    d.text((30, 13), "UNDER CONSTRUCTION", font=font("DejaVuSans-Bold.ttf", 13), fill=(30, 30, 30))
    return im
sf = [sign(0), sign(10)]
sf[0].save(f"{OUT}/construction.gif", save_all=True, append_images=sf[1:], duration=400, loop=0)

# --- a rainbow rule ----------------------------------------------------------------------------------------------
rule = Image.new("RGB", (600, 4))
rd = ImageDraw.Draw(rule)
cols = [(255, 0, 0), (255, 140, 0), (255, 230, 0), (0, 170, 0), (0, 90, 255), (140, 0, 200)]
for x in range(600):
    c = cols[x * len(cols) // 600]
    rd.line([(x, 0), (x, 3)], fill=c)
rule.save(f"{OUT}/rainbow.gif")

# --- bullets ---------------------------------------------------------------------------------------------------------
for name, colour in (("bullet-blue", (0, 70, 200)), ("bullet-red", (200, 0, 0))):
    b = Image.new("RGBA", (11, 11), (0, 0, 0, 0))
    bdr = ImageDraw.Draw(b)
    bdr.polygon([(5, 0), (10, 5), (5, 10), (0, 5)], fill=colour, outline=(255, 255, 255))
    b.save(f"{OUT}/{name}.gif")

# --- 88x31 buttons -----------------------------------------------------------------------------------------------------
def button88(name, top, bottom, lines, fg=(255, 255, 255)):
    im = Image.new("RGB", (88, 31))
    d = ImageDraw.Draw(im)
    for y in range(31):
        t = y / 30
        d.line([(0, y), (88, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    d.rectangle([0, 0, 87, 30], outline=(0, 0, 0))
    d.line([(1, 1), (86, 1)], fill=(255, 255, 255)); d.line([(1, 1), (1, 29)], fill=(255, 255, 255))
    f = font("DejaVuSans-Bold.ttf", 9)
    y = 15 - 6 * len(lines) + 3
    for line in lines:
        w = d.textlength(line, font=f)
        d.text(((88 - w) / 2 + 1, y + 1), line, font=f, fill=(0, 0, 0))
        d.text(((88 - w) / 2, y), line, font=f, fill=fg)
        y += 12
    im.save(f"{OUT}/{name}.gif")
button88("btn-notepad", (240, 240, 150), (220, 190, 60), ["Made with", "NOTEPAD"], fg=(60, 40, 0))
button88("btn-ie6", (40, 110, 220), (10, 50, 150), ["Best viewed", "in IE 6.0"])
button88("btn-html", (60, 160, 60), (10, 90, 10), ["Valid", "HTML 4.01!"])
button88("btn-python", (70, 120, 180), (40, 70, 130), ["Powered by", "Python"])
button88("btn-nekochat", (150, 150, 150), (60, 60, 60), ["Nekochat", "Reloaded"])
button88("btn-res", (120, 120, 120), (30, 30, 30), ["Best at", "1024 x 768"])

# --- the screenshot and the icon ---------------------------------------------------------------------------------------
shot = Image.open("tools/screenshot-pc.png").convert("RGB")
shot.resize((560, int(shot.height * 560 / shot.width)), Image.LANCZOS).save(f"{OUT}/screenshot.png")
icon = Image.open("tools/cat28.png").convert("RGBA")
sq = Image.new("RGBA", (32, 32), (0, 0, 0, 0)); sq.paste(icon.resize((28, 26), Image.NEAREST), (2, 3))
sq.save("public/favicon.ico", sizes=[(16, 16), (32, 32)])
print("pictures done")
