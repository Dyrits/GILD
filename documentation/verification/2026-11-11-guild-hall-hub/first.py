import sys
from playwright.sync_api import sync_playwright
port, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
    page = b.contexts[0].pages[0]
    page.set_viewport_size({"width": 1280, "height": 900})
    page.goto("http://localhost:8187/")
    page.wait_for_timeout(6000)
    print("HEADING:", [l for l in page.inner_text("body").split("\n") if "last" in l.lower()])
    page.screenshot(path=out)
