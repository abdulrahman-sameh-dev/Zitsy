#!/usr/bin/env python3
"""Generate Zitsy brand raster assets (favicon, app icon, apple icon, OG image).

Run from the project root: python3 scripts/generate-brand-assets.py
Uses only the Python standard library + PIL. Drawn primitives, so the output is
deterministic and independent of any downloaded font.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent

# Tailwind v4 green scale (uicolors.app/tailwind-colors/green)
BRAND_600 = (0, 166, 62)      # #00A63E
BRAND_700 = (0, 130, 54)      # #008236
BRAND_800 = (1, 102, 48)      # #016630
BRAND_400 = (5, 223, 114)     # #05DF72
BRAND_50 = (240, 253, 244)    # #F0FDF4
BRAND_200 = (185, 248, 207)   # #B9F8CF
BRAND_300 = (123, 241, 168)   # #7BF1A8
BRAND_950 = (3, 46, 21)       # #032E15
INK = (20, 20, 18)            # ink #141412
PAPER = (246, 244, 239)       # canvas #F6F4EF
MUTED = (201, 198, 189)       # muted-light #C9C6BD
WHITE = (255, 255, 255)

LIB_BOLD = "/usr/share/fonts/liberation/LiberationSans-Bold.ttf"
LIB_REG = "/usr/share/fonts/liberation/LiberationSans-Regular.ttf"


def draw_mark(size: int, bg: tuple = BRAND_700, fg: tuple = WHITE) -> Image.Image:
    """Rounded square tile with a bold screen-print 'Z' and a registration dot."""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    radius = round(size * 0.22)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=bg + (255,))

    x0 = size * 0.26
    x1 = size * 0.74
    y0 = size * 0.32
    y1 = size * 0.7
    w = max(2, round(size * 0.15))
    pts = [(x0, y0), (x1, y0), (x0, y1), (x1, y1)]
    d.line(pts, fill=fg + (255,), width=w, joint="curve")
    r = w / 2
    d.ellipse([x1 - r, y0 - r, x1 + r, y0 + r], fill=fg + (255,))
    d.ellipse([x0 - r, y1 - r, x0 + r, y1 + r], fill=fg + (255,))

    # registration dot (screen-print nod) at the top-right, inside the tile
    dot_r = max(2, round(size * 0.028))
    cx, cy = size * 0.78, size * 0.2
    d.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=BRAND_50 + (255,))
    return im


def main() -> None:
    app_dir = ROOT / "src" / "app"
    public_dir = ROOT / "public"
    app_dir.mkdir(parents=True, exist_ok=True)

    icon = draw_mark(512)
    icon.resize((192, 192), Image.LANCZOS).save(app_dir / "icon.png")
    icon.resize((180, 180), Image.LANCZOS).save(app_dir / "apple-icon.png")
    icon.resize((48, 48), Image.LANCZOS).save(
        public_dir / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)]
    )

    w, h = 1200, 630
    og = Image.new("RGB", (w, h), BRAND_950)
    d = ImageDraw.Draw(og)
    pad = 84

    # layered green accent bands (echo of the brand-tile language)
    d.rounded_rectangle([pad - 10, pad - 10, pad + 148 + 10, pad + 148 + 10],
                        radius=44, fill=BRAND_800)
    mark = draw_mark(148)
    og.paste(mark.convert("RGB"), (pad, pad), mark)

    word_x = pad + 148 + 48
    word_y = pad + 22
    font_word = ImageFont.truetype(LIB_BOLD, 122)
    d.text((word_x, word_y), "zitsy", font=font_word, fill=WHITE)

    font_tag = ImageFont.truetype(LIB_BOLD, 42)
    d.text((word_x, word_y + 150), "Easy as Zitsy ·", font=font_tag, fill=BRAND_300)
    d.text((word_x + 355, word_y + 150), "made to order", font=font_tag, fill=BRAND_400)

    font_sub = ImageFont.truetype(LIB_REG, 30)
    d.text(
        (word_x, word_y + 224),
        "Graphic apparel & lifestyle goods.",
        font=font_sub,
        fill=MUTED,
    )

    font_foot = ImageFont.truetype(LIB_REG, 24)
    d.text((pad, h - 66), "ships to GB · DE", font=font_foot, fill=MUTED)

    og.save(public_dir / "og.png")
    print("wrote icon.png, apple-icon.png, public/favicon.ico, public/og.png")


if __name__ == "__main__":
    main()