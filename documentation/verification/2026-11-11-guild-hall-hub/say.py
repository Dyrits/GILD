import sys
from playwright.sync_api import sync_playwright
port, text, out = sys.argv[1], sys.argv[2], sys.argv[3]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
    page = b.contexts[0].pages[0]
    page.set_viewport_size({"width": 1280, "height": 900})
    box = page.locator("[contenteditable=true]").last
    box.click()
    box.fill(text)
    page.keyboard.press("Enter")
    page.wait_for_timeout(4500)
    page.screenshot(path=out)
    print(page.inner_text("body")[-1200:])
