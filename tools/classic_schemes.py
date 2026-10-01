#!/usr/bin/env python3
"""Build the colour schemes of the Windows Classic theme.

themes/classic/theme.css is written in the "Windows Classic" colours (#bfbfbf face, #808080
shadow…); themes/classic/schemes.json has the system colours of every classic scheme of
Windows XP (from its HIVEDEF.INF). Each colour of theme.css is replaced by the scheme's colour
of the same role, and the result goes to OUTPUT/schemes/<id>/theme.css with OUTPUT/theme.json.

    python3 tools/classic_schemes.py themes/classic prebuilt/Classic
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path


def scheme_id(name: str) -> str:
    # "Windows Classic" keeps the id the theme always had, so saved choices stay valid.
    return 'classic' if name == 'Windows Classic' else re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')


def bevel(face: str, outer_tl: str, outer_br: str, inner_tl: str, inner_br: str) -> str:
    """A 12x12 picture of a Classic button for border-image (slice 4): the 3D edges in the scheme's colours."""
    def colour(value: str) -> str:
        return value.replace('#', '%23')
    parts = (
        f"<rect width='12' height='12' fill='{colour(face)}'/>"
        f"<rect width='12' height='1' fill='{colour(outer_tl)}'/><rect width='1' height='12' fill='{colour(outer_tl)}'/>"
        f"<rect y='11' width='12' height='1' fill='{colour(outer_br)}'/><rect x='11' width='1' height='12' fill='{colour(outer_br)}'/>"
        f"<rect x='1' y='1' width='10' height='1' fill='{colour(inner_tl)}'/><rect x='1' y='1' width='1' height='10' fill='{colour(inner_tl)}'/>"
        f"<rect x='1' y='10' width='10' height='1' fill='{colour(inner_br)}'/><rect x='10' y='1' width='1' height='10' fill='{colour(inner_br)}'/>"
    )
    return f'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' shape-rendering=\'crispEdges\'%3E{parts.replace("<", "%3C").replace(">", "%3E")}%3C/svg%3E")'


def render(css: str, c: dict[str, str]) -> str:
    title = f'linear-gradient(270deg, {c["gradientactive"]} 0%, {c["activecaption"]} 100%)'
    lines = {
        '--xp-theme-window': c['window'], '--xp-theme-buttonface': c['btnface'], '--xp-theme-windowtext': c['windowtext'],
        '--xp-theme-highlight': c['highlight'], '--xp-theme-highlighttext': c['highlighttext'], '--xp-theme-graytext': c['graytext'],
        '--xp-title-fill': title,
        # Buttons that are drawn with the theme's button pictures (border-image) get Classic's raised and pressed edges.
        '--xp-button-normal': bevel(c['btnface'], c['btnhighlight'], c['3ddkshadow'], c['3dlight'], c['btnshadow']),
        '--xp-button-hover': bevel(c['btnface'], c['btnhighlight'], c['3ddkshadow'], c['3dlight'], c['btnshadow']),
        '--xp-button-pressed': bevel(c['btnface'], c['3ddkshadow'], c['btnhighlight'], c['btnshadow'], c['3dlight']),
    }
    for name, value in lines.items():
        css = re.sub(rf'({re.escape(name)}:\s*)[^;]+;', lambda match: f'{match.group(1)}{value};', css, count=1)
    # Colours by their role in the stylesheet: 3D edges (after "px "), glyph gradients, text,
    # window backgrounds, then the plain face, shadow, light and highlight colours.
    css = re.sub(r'(\dpx )#fff(?:fff)?\b', lambda m: m.group(1) + c['btnhighlight'], css)
    css = re.sub(r'(\dpx )#000(?:000)?\b', lambda m: m.group(1) + c['3ddkshadow'], css)
    css = re.sub(r'#000(?:000)?( \d)', lambda m: c['btntext'] + m.group(1), css)
    css = re.sub(r'((?<![-\w])color:\s*)#fff(?:fff)?\b', lambda m: m.group(1) + c['highlighttext'], css)
    css = re.sub(r'((?<![-\w])color:\s*)#000(?:000)?\b', lambda m: m.group(1) + c['btntext'], css)
    css = re.sub(r'((?:fill|stroke):\s*)#000(?:000)?\b', lambda m: m.group(1) + c['btntext'], css)
    css = re.sub(r'(background(?:-color)?:\s*)#fff(?:fff)?\b', lambda m: m.group(1) + c['window'], css)
    css = re.sub(r'#fff(?:fff)?( 0 50%)', lambda m: c['btnhighlight'] + m.group(1), css)
    for old, role in (('#bfbfbf', 'btnface'), ('#808080', 'btnshadow'), ('#dbdbdb', '3dlight'), ('#dfdfdf', '3dlight'), ('#00007b', 'highlight')):
        css = css.replace(old, c[role])
    # Extra variables for pages that follow the scheme (Control Panel, previews).
    extra = {
        '--classic-face': c['btnface'], '--classic-shadow': c['btnshadow'], '--classic-light': c['3dlight'], '--classic-hilight': c['btnhighlight'],
        '--classic-dark': c['3ddkshadow'], '--classic-text': c['btntext'], '--classic-desktop': c['background'],
        '--xp-title-fill-inactive': f'linear-gradient(270deg, {c["gradientinactive"]} 0%, {c["inactivecaption"]} 100%)',
        '--xp-title-text': c['captiontext'], '--xp-title-text-inactive': c['inactivecaptiontext'],
    }
    return css + '\n:root { ' + ' '.join(f'{key}: {value};' for key, value in extra.items()) + ' }\n'


def main(source: Path, output: Path) -> None:
    css = (source / 'theme.css').read_text(encoding='utf-8')
    schemes = json.loads((source / 'schemes.json').read_text(encoding='utf-8'))['schemes']
    listed = []
    for scheme in schemes:
        folder = output / 'schemes' / scheme_id(scheme['name'])
        folder.mkdir(parents=True, exist_ok=True)
        (folder / 'theme.css').write_text(render(css, scheme['colors']), encoding='utf-8')
        listed.append({'id': scheme_id(scheme['name']), 'name': scheme['name']})
    (output / 'theme.json').write_text(json.dumps({'theme': 'Windows Classic', 'schemes': listed, 'defaultScheme': 'classic'}, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('usage: classic_schemes.py THEMES_CLASSIC_DIR OUTPUT_DIR')
    main(Path(sys.argv[1]), Path(sys.argv[2]))
