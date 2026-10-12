#!/usr/bin/env python3
"""Render all pages to a contact sheet PNG for visual QA."""
import io
import json
import os
import re
import sys

import cairosvg
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
STYLE = ("<style>"
         ".r{fill:#ffffff;stroke:#333333;stroke-width:4;stroke-linejoin:round;stroke-linecap:round}"
         ".d{fill:none;stroke:#333333;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}"
         ".f{fill:#333333;stroke:none}"
         "</style>")


def svg_doc(inner, size=400):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" '
            f'width="{size}" height="{size}">{STYLE}{inner}</svg>')


def load_pages(path):
    txt = open(path, encoding="utf-8").read()
    m = re.search(r"window\.PAGES\s*=\s*(\[.*\]);", txt, re.S)
    return json.loads(m.group(1))


def main():
    pages_path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "site", "pages.js")
    out_path = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "sheet.png")
    pages = load_pages(pages_path)
    cell, pad, cols = 190, 26, 6
    rows = (len(pages) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell + pad, rows * (cell + pad) + pad), "white")
    draw = ImageDraw.Draw(sheet)
    for i, p in enumerate(pages):
        png = cairosvg.svg2png(bytestring=svg_doc(p["svg"]).encode(), output_width=cell,
                               output_height=cell, background_color="white")
        img = Image.open(io.BytesIO(png)).convert("RGB")
        x = pad + (i % cols) * cell
        y = pad + (i // cols) * (cell + pad)
        sheet.paste(img, (x, y))
        draw.rectangle([x, y, x + cell - 1, y + cell - 1], outline="#cccccc")
        draw.text((x + 6, y + cell + 4), f'{p["id"]} ({p["cat"]})', fill="#111111")
    sheet.save(out_path)
    print("wrote", out_path, sheet.size, len(pages), "pages")


if __name__ == "__main__":
    main()
