import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    for w in [1280, 2000]:
        page = b.new_page(viewport={"width": w, "height": 900})
        page.add_init_script(f"window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
        page.goto("http://localhost:8123/"); page.wait_for_timeout(3500)
        handle = page.get_by_label("Resize the sidebar")
        box = handle.bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + 200
        page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + 1200, y, steps=12); page.mouse.up(); page.wait_for_timeout(300)
        wide = page.get_by_label("Resize the sidebar").bounding_box()["x"] + 4
        page.screenshot(path=f"{out}/drag-{w}-widest.png")
        box = page.get_by_label("Resize the sidebar").bounding_box(); x = box["x"] + box["width"] / 2
        page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x - 1200, y, steps=12); page.mouse.up(); page.wait_for_timeout(300)
        narrow = page.get_by_label("Resize the sidebar").bounding_box()["x"] + 4
        print("window", w, "widest", wide, "quarter", w / 4, "narrowest", narrow)
        # window shrinks after a wide drag: the stored width is clamped again
        box = page.get_by_label("Resize the sidebar").bounding_box(); x = box["x"] + box["width"] / 2
        page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + 1200, y, steps=12); page.mouse.up(); page.wait_for_timeout(300)
        page.set_viewport_size({"width": 1400, "height": 900}); page.wait_for_timeout(500)
        print("after resize to 1400, rail", page.get_by_label("Resize the sidebar").bounding_box()["x"] + 4, "quarter", 350)
        page.close()
    b.close()
