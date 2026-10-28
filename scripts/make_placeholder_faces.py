#!/usr/bin/env python3
"""make_placeholder_faces.py — stand-in face images until the CFD images are
dropped in (see scripts/fetch_cfd_images.py). One JPEG per model_id in
face_manifest.csv, 480x600, grey silhouette; gender is cued crudely (hair
shape) so the task is playable. These are NOT stimuli — swap before any
data are interpreted.
"""
import csv, os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "faces")
os.makedirs(OUT, exist_ok=True)
W, H = 480, 600
BG = (190, 190, 190); FG = (110, 110, 110); DK = (80, 80, 80)

n = 0
for r in csv.DictReader(open(os.path.join(ROOT, "stimuli", "face_manifest.csv"), newline="")):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    cx = W // 2
    if r["gender"] == "F":
        d.ellipse([cx-150, 110, cx+150, 520], fill=DK)      # long hair
        d.ellipse([cx-115, 140, cx+115, 430], fill=FG)      # face
    else:
        d.ellipse([cx-120, 120, cx+120, 260], fill=DK)      # short hair
        d.ellipse([cx-115, 150, cx+115, 440], fill=FG)      # face
    d.rectangle([cx-70, 420, cx+70, 520], fill=FG)          # neck
    d.ellipse([cx-250, 480, cx+250, 760], fill=FG)          # shoulders
    d.text((12, 8), f"PLACEHOLDER {r['model_id']}", fill=(60, 60, 60))
    img.save(os.path.join(OUT, f"{r['model_id']}.jpg"), quality=80)
    n += 1
print(f"wrote {n} placeholder images to {OUT}")
