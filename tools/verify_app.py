#!/usr/bin/env python3
"""Headless verification of the coloring game: gallery, tap-to-fill, brush,
undo, magic fill, save (download + in-app gallery), console errors."""
import json
import os
import sys

from playwright.sync_api import sync_playwright

URL = os.environ.get("BM_URL", "http://127.0.0.1:8450/")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots")
os.makedirs(OUT, exist_ok=True)
errors, logs = [], []


def count_alpha(page):
    return page.evaluate("""() => {
      const c = document.querySelector('#brush');
      const d = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
      let n = 0; for (let i=3;i<d.length;i+=4) if (d[i] > 8) n++;
      return n;
    }""")


def filled_count(page):
    return page.evaluate("[...document.querySelectorAll('#art .r')].filter(e => e.style.fill).length")


RESULTS = {}


def main():
    results = RESULTS
    with sync_playwright() as pw:
        browser = pw.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": 412, "height": 915}, device_scale_factor=2)
        page.on("pageerror", lambda e: errors.append("pageerror: " + str(e)))
        page.on("console", lambda m: logs.append(m.type + ": " + m.text) if m.type in ("error", "warning") else None)

        page.goto(URL, wait_until="load")
        page.wait_for_selector("#grid .card", timeout=10000)
        results["gallery_cards"] = page.locator("#grid .card").count()
        results["categories"] = page.locator("#cats .chip").count()
        page.screenshot(path=os.path.join(OUT, "1-gallery-phone.png"))

        # mandala category renders
        page.locator('#cats .chip', has_text="Mandala").click()
        page.wait_for_timeout(300)
        results["mandala_cards"] = page.locator("#grid .card").count()
        page.screenshot(path=os.path.join(OUT, "2-mandala.png"))

        # open the cat page
        page.locator('#cats .chip', has_text="Semua").click()
        page.wait_for_timeout(200)
        page.locator("#grid .card").first.click()
        page.wait_for_selector("#art")
        page.wait_for_timeout(400)
        results["regions"] = page.locator("#art .r").count()
        results["brush_pe_none_in_fill_mode"] = page.evaluate(
            "getComputedStyle(document.querySelector('#brush')).pointerEvents")
        page.screenshot(path=os.path.join(OUT, "3-stage-fresh.png"))

        # --- tap to fill: pick a real point inside region 0 and click it
        pt = page.evaluate("""() => {
          const el = document.querySelectorAll('#art .r')[0];
          const r = el.getBoundingClientRect();
          return {x: r.x + r.width/2, y: r.y + r.height/2};
        }""")
        hit = page.evaluate("([x,y]) => { const e = document.elementFromPoint(x,y); return e ? (e.getAttribute('class')||e.tagName) : 'none'; }", [pt["x"], pt["y"]])
        results["element_at_center_of_region0"] = hit
        page.mouse.click(pt["x"], pt["y"])
        page.wait_for_timeout(150)
        results["filled_after_1_tap"] = filled_count(page)
        results["fill_color"] = page.evaluate("document.querySelector('#art .r').style.fill")

        # fill a few more regions by clicking each one's own hit-testable point
        page.evaluate("""() => {
          const els = [...document.querySelectorAll('#art .r')];
          window.__hits = [];
          for (const el of els) {
            const r = el.getBoundingClientRect();
            const cx = r.x + r.width/2, cy = r.y + r.height/2;
            const t = document.elementFromPoint(cx, cy);
            if (t === el) window.__hits.push([cx, cy]);
          }
          return window.__hits.length;
        }""")
        hits = page.evaluate("window.__hits.length")
        for i, (x, y) in enumerate(page.evaluate("window.__hits")):
            page.mouse.click(x, y)
            page.wait_for_timeout(60)
            if i > 6:
                break
        results["regions_clickable_directly"] = hits
        results["filled_after_multi_tap"] = filled_count(page)
        page.screenshot(path=os.path.join(OUT, "4-stage-filled.png"))

        # --- brush: pick a colour, switch tool, scribble
        page.locator("#palette .sw").nth(7).click()
        page.locator('.tbtn[data-tool="brush"]').click()
        box = page.locator("#stage").bounding_box()
        page.mouse.move(box["x"] + 60, box["y"] + 60)
        page.mouse.down()
        for k in range(1, 12):
            page.mouse.move(box["x"] + 60 + k * 12, box["y"] + 60 + (k % 4) * 20)
            page.wait_for_timeout(12)
        page.mouse.up()
        page.wait_for_timeout(150)
        results["brush_pixels"] = count_alpha(page)
        page.screenshot(path=os.path.join(OUT, "5-brush.png"))

        # --- undo removes the stroke
        page.locator("#btn-undo").click()
        page.wait_for_timeout(200)
        results["brush_pixels_after_undo"] = count_alpha(page)

        # --- eraser removes paint again after redo
        page.locator("#btn-redo").click()
        page.wait_for_timeout(200)
        results["brush_pixels_after_redo"] = count_alpha(page)

        # --- magic fill
        page.locator("#btn-magic").click()
        page.wait_for_timeout(2600)
        results["filled_after_magic"] = filled_count(page)
        page.screenshot(path=os.path.join(OUT, "6-magic.png"))

        # --- save: expect a download + an entry in the in-app gallery
        with page.expect_download(timeout=15000) as dl:
            page.locator("#btn-save").click()
        d = dl.value
        results["download_name"] = d.suggested_filename
        path = os.path.join(OUT, "saved-" + d.suggested_filename)
        d.save_as(path)
        results["download_bytes"] = os.path.getsize(path)
        results["saved_in_app"] = page.evaluate("JSON.parse(localStorage.getItem('bm.saved')||'[]').length")

        # --- in-app gallery view
        page.locator("#btn-back").click()
        page.locator('#cats .chip', has_text="Hasil Seni").click()
        page.wait_for_timeout(400)
        results["saved_cards"] = page.locator("#grid .card").count()
        page.screenshot(path=os.path.join(OUT, "7-hasil-seni.png"))

        # --- desktop layout
        page.set_viewport_size({"width": 1366, "height": 900})
        page.locator('#cats .chip', has_text="Haiwan").click()
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(OUT, "8-desktop-gallery.png"))
        page.locator("#grid .card").nth(2).click()
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(OUT, "9-desktop-stage.png"))

        browser.close()

    results["console_errors"] = errors
    results["console_warnings"] = logs[:10]
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    import traceback
    try:
        main()
    except Exception:
        traceback.print_exc()
        print("PARTIAL RESULTS FOLLOW")
        print(json.dumps({"partial": RESULTS, "errors": errors, "logs": logs[:10]}, indent=2))
        sys.exit(1)
