"""Recolors public/pwa/icon-180.png for each preset accent -> public/pwa/icon-180-<id>.png.
Run: python3 scripts/build-accent-icons.py  (keep OKLCH values in sync with styles.css)."""
import math
from PIL import Image

ACCENTS = {
    "green": (0.88, 0.24, 145), "blue": (0.72, 0.17, 245), "orange": (0.78, 0.18, 55),
    "purple": (0.68, 0.2, 300), "pink": (0.72, 0.22, 350), "yellow": (0.88, 0.18, 95),
}

def oklch_to_rgb(L, C, h):
    a, b = C * math.cos(math.radians(h)), C * math.sin(math.radians(h))
    l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s_ = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
           -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
           -0.0041960863 * l_ - 0.7034186147 * m_ + 1.7076147010 * s_)
    f = lambda x: 12.92 * x if x <= 0.0031308 else 1.055 * x ** (1 / 2.4) - 0.055
    return tuple(round(min(1, max(0, f(max(0, x)))) * 255) for x in lin)

src = Image.open("public/pwa/icon-180.png").convert("RGB")
for name, lch in ACCENTS.items():
    r, g, b = oklch_to_rgb(*lch)
    out = Image.new("RGB", src.size)
    px = out.load()
    for y in range(src.height):
        for x in range(src.width):
            k = src.getpixel((x, y))[1] / 211  # base icon's stroke green channel -> coverage
            k = min(1, k)
            px[x, y] = (round(r * k), round(g * k), round(b * k))
    out.save(f"public/pwa/icon-180-{name}.png", optimize=True)
    print(name, (r, g, b))
