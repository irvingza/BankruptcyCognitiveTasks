#!/usr/bin/env python3
"""fetch_cfd_images.py — copy the one neutral image per manifest model into
images/faces/<model_id>.jpg, replacing the placeholders.

Usage (on the machine with the CFD download):
  python3 scripts/fetch_cfd_images.py "/path/to/CFD Version 3.0/Images"

Rules (face_manifest.csv, image_file_note):
  CFD        : the single neutral ("-N") image for the model.
  CFD-INDIA  : the neutral image with the signifiers-removed flag (=1) in
               the filename; falls back to any neutral image and says so.
Anything unmatched is listed at the end for a manual look. Nothing is
resized here: standardization (crop / grayscale / luminance) is a later task.
"""
import csv, os, re, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "images", "faces")
if len(sys.argv) < 2: sys.exit(__doc__)
SRC = sys.argv[1]

files = []
for dp, _, fns in os.walk(SRC):
    if "CFD-MR" in dp: continue
    for f in fns:
        if f.lower().endswith((".jpg", ".jpeg", ".png")): files.append(os.path.join(dp, f))

def digits(s): return re.sub(r"\D", "", s)

unmatched, fallback = [], []
for r in csv.DictReader(open(os.path.join(ROOT, "stimuli", "face_manifest.csv"), newline="")):
    mid = r["model_id"]; key = mid.replace("-", "")
    cands = [f for f in files if key in os.path.basename(f).replace("-", "") or key in os.path.basename(os.path.dirname(f)).replace("-", "")]
    neutral = [f for f in cands if re.search(r"-N\b|-N[-.]|_N[-.]|-N\d*\.", os.path.basename(f))] or cands
    if r["database"] == "CFD-INDIA":
        flagged = [f for f in neutral if re.search(r"-N-?1\.|-N1\b|_1\.", os.path.basename(f))]
        if flagged: neutral = flagged
        else: fallback.append(mid)
    if not neutral: unmatched.append(mid); continue
    neutral.sort()
    shutil.copyfile(neutral[0], os.path.join(OUT, f"{mid}.jpg"))

print(f"copied {192 - len(unmatched)} / 192")
if fallback: print("CFD-INDIA without an obvious signifiers-removed file (check by eye):", fallback)
if unmatched: print("UNMATCHED:", unmatched)
