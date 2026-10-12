#!/usr/bin/env python3
"""Inspect the gallery DOM: card sizes, svg sizes, labels."""
import json
import os

from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    b = pw.chromium.launch(args=["--no-sandbox"])
    p = b.new_page(viewport={"width": 412, "height": 915})
    p.goto("http://127.0.0.1:8450/", wait_until="load")
    p.wait_for_selector("#grid .card")
    p.wait_for_timeout(600)
    info = p.evaluate("""() => {
      const g = document.querySelector('#grid');
      const cs = getComputedStyle(g);
      return {
        cols: cs.gridTemplateColumns,
        gap: cs.gap,
        gridH: g.getBoundingClientRect().height,
        cards: [...g.children].slice(0, 8).map(c => {
          const svg = c.querySelector('svg');
          const r = c.getBoundingClientRect();
          return {
            label: (c.querySelector('b')||{}).textContent,
            cls: c.className,
            w: Math.round(r.width), h: Math.round(r.height),
            svg: svg ? { kids: svg.children.length, w: Math.round(svg.getBoundingClientRect().width),
                         h: Math.round(svg.getBoundingClientRect().height), vb: svg.getAttribute('viewBox') } : null
          };
        }),
        headerTitle: document.querySelector('#title').getBoundingClientRect().width,
        hintW: document.querySelector('#hint').getBoundingClientRect().width
      };
    }""")
    print(json.dumps(info, indent=2))
    p.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots", "gallery-debug.png"))
    b.close()
