"""Optimize generated RGBA art without altering its transparent background.

Usage: python tools/campus-assets.py main /absolute/generated.png
Requires Pillow. Originals are retained at the supplied path.
"""
from pathlib import Path
import sys

from PIL import Image

name, source = sys.argv[1:]
assert name in {"main", "library", "sculpture", "plaza", "lab", "tree"}
root = Path(__file__).resolve().parents[1]
destination = root / "apps/web/public/campus/v2"
destination.mkdir(parents=True, exist_ok=True)
with Image.open(source) as original:
    assert original.mode == "RGBA", "Generated art must preserve true alpha"
    for width, suffix in [(512, "-low"), (1024, "")]:
        image = original.copy()
        image.thumbnail((width, width), Image.Resampling.LANCZOS)
        target = destination / f"{name}{suffix}.webp"
        image.save(target, "WEBP", quality=86, method=6)
        print(target.relative_to(root), target.stat().st_size, image.size)
