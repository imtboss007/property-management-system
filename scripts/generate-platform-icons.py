#!/usr/bin/env python3
"""Generate AXIVESTRA's native Windows and Android launcher icons."""
from pathlib import Path
import argparse
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
DENSITIES = {"mipmap-mdpi":48,"mipmap-hdpi":72,"mipmap-xhdpi":96,"mipmap-xxhdpi":144,"mipmap-xxxhdpi":192}

def create_icon(size=1024):
    s=size/512
    image=Image.new("RGBA",(size,size),(5,18,34,255))
    draw=ImageDraw.Draw(image)
    def pts(values): return [(round(x*s),round(y*s)) for x,y in values]
    def gradient_polygon(points, top, bottom):
        mask=Image.new("L",(size,size),0); ImageDraw.Draw(mask).polygon(pts(points),fill=255)
        grad=Image.new("RGBA",(size,size))
        gp=grad.load()
        for y in range(size):
            t=y/max(1,size-1)
            c=tuple(round(top[i]*(1-t)+bottom[i]*t) for i in range(4))
            for x in range(size): gp[x,y]=c
        image.alpha_composite(Image.composite(grad,Image.new("RGBA",(size,size)),mask))
    draw.rounded_rectangle((20*s,20*s,492*s,492*s),radius=108*s,fill=(7,23,43,255),outline=(218,168,91,255),width=max(2,round(12*s)))
    draw.rounded_rectangle((38*s,38*s,474*s,474*s),radius=94*s,outline=(45,174,231,150),width=max(1,round(2*s)))
    bloom=Image.new("RGBA",(size,size)); ImageDraw.Draw(bloom).ellipse((105*s,105*s,410*s,410*s),fill=(0,112,255,33))
    image=Image.alpha_composite(image,bloom.filter(ImageFilter.GaussianBlur(34*s)))
    draw=ImageDraw.Draw(image)
    draw.polygon(pts([(82,383),(140,383),(429,91),(371,91)]),fill=(206,137,58,255),outline=(255,226,167,230))
    draw.polygon(pts([(83,124),(145,124),(430,411),(368,411)]),fill=(22,132,240,255),outline=(76,236,255,255))
    draw.line(pts([(90,131),(145,131),(425,413)]),fill=(184,250,255,145),width=max(1,round(3*s)))
    draw.line(pts([(88,379),(371,95)]),fill=(255,240,199,170),width=max(1,round(3*s)))
    return image

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--desktop",action="store_true")
    parser.add_argument("--android",action="store_true")
    args=parser.parse_args()
    if not args.desktop and not args.android: args.desktop=args.android=True
    icon=create_icon()
    if args.desktop:
        target=ROOT/"build"/"axivestra.ico"; target.parent.mkdir(parents=True,exist_ok=True)
        icon.save(target,format="ICO",sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
        print(f"Generated {target}")
    if args.android:
        res=ROOT/"android"/"app"/"src"/"main"/"res"
        for folder,edge in DENSITIES.items():
            target=res/folder; target.mkdir(parents=True,exist_ok=True)
            rendered=icon.resize((edge,edge),Image.Resampling.LANCZOS)
            rendered.save(target/"ic_launcher.png",optimize=True)
            rendered.save(target/"ic_launcher_round.png",optimize=True)
        adaptive=res/"mipmap-anydpi-v26"
        for name in ("ic_launcher.xml","ic_launcher_round.xml"): (adaptive/name).unlink(missing_ok=True)
        try: adaptive.rmdir()
        except OSError: pass
        print("Generated branded Android launcher icons")
if __name__=="__main__": main()
