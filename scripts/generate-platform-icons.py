#!/usr/bin/env python3
"""Generate the AXIVESTRA Windows and Android launcher icons from the brand geometry."""
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

def gradient(size, top, bottom):
    w, h = size
    image = Image.new("RGBA", (w, h))
    px = image.load()
    for y in range(h):
        t = y / max(1, h - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(4))
        for x in range(w):
            px[x, y] = color
    return image

def create_icon(size=1024):
    scale = size / 512
    image = gradient((size, size), (7, 23, 43, 255), (3, 11, 24, 255))
    draw = ImageDraw.Draw(image)
    def p(points):
        return [(round(x*scale), round(y*scale)) for x,y in points]
    # Rounded navy tile, metallic gold perimeter and a fine electric-blue inner keyline.
    draw.rounded_rectangle((20*scale,20*scale,492*scale,492*scale), radius=108*scale, fill=(7,23,43,255), outline=(217,164,86,255), width=max(2,round(12*scale)))
    draw.rounded_rectangle((38*scale,38*scale,474*scale,474*scale), radius=94*scale, outline=(40,160,226,145), width=max(1,round(2*scale)))
    # Soft accent bloom behind the mark.
    bloom = Image.new("RGBA", (size,size))
    bd = ImageDraw.Draw(bloom)
    bd.ellipse((108*scale,110*scale,404*scale,406*scale), fill=(0,115,255,35))
    image = Image.alpha_composite(image, bloom.filter(ImageFilter.GaussianBlur(34*scale)))
    draw = ImageDraw.Draw(image)
    # Gold rising ribbon, then blue/cyan descending ribbon.
    draw.polygon(p([(82,383),(140,383),(429,91),(371,91)]), fill=(210,145,64,255), outline=(255,226,167,210))
    draw.polygon(p([(83,124),(145,124),(430,411),(368,411)]), fill=(20,133,244,255), outline=(76,236,255,240))
    # Highlights on ribbon edges.
    draw.line(p([(90,131),(145,131),(425,413)]), fill=(184,250,255,130), width=max(1,round(3*scale)))
    draw.line(p([(88,379),(371,95)]), fill=(255,240,199,150), width=max(1,round(3*scale)))
    return image

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--desktop", action="store_true")
    parser.add_argument("--android", action="store_true")
    args = parser.parse_args()
    if not args.desktop and not args.android:
        args.desktop = args.android = True
    icon = create_icon()
    if args.desktop:
        target = ROOT / "build" / "axivestra.ico"
        target.parent.mkdir(parents=True, exist_ok=True)
        icon.save(target, format="ICO", sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
        print(f"Generated {target}")
    if args.android:
        res = ROOT / "android" / "app" / "src" / "main" / "res"
        for folder, edge in DENSITIES.items():
            path = res / folder
            path.mkdir(parents=True, exist_ok=True)
            rendered = icon.resize((edge,edge), Image.Resampling.LANCZOS)
            rendered.save(path / "ic_launcher.png", optimize=True)
            rendered.save(path / "ic_launcher_round.png", optimize=True)
        # Remove adaptive-icon XML so Android uses these branded density-specific assets.
        adaptive = res / "mipmap-anydpi-v26"
        for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
            (adaptive / name).unlink(missing_ok=True)
        try:
            adaptive.rmdir()
        except OSError:
            pass
        print("Generated AXIVESTRA Android launcher icons")
if __name__ == "__main__":
    main()
