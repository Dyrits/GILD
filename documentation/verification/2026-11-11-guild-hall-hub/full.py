import sys
from playwright.sync_api import sync_playwright
port, out, scheme = sys.argv[1], sys.argv[2], sys.argv[3]
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp(f"http://127.0.0.1:{port}")
    page = b.contexts[0].pages[0]
    page.set_viewport_size({"width": 1400, "height": 900})
    page.goto("http://localhost:8187/")
    page.evaluate(f"localStorage.setItem('iskios.colorScheme','{scheme}'); localStorage.setItem('iskios:assistant-open','0')")
    page.reload(); page.wait_for_timeout(6000)
    page.screenshot(path=out + "-1-hub.png")
    page.get_by_label("Ask Iskios").click(); page.wait_for_timeout(2000)
    page.screenshot(path=out + "-2-floating.png")
    page.get_by_label("Expand Iskios").click(); page.wait_for_timeout(2000)
    page.screenshot(path=out + "-3-full.png")
    page.get_by_label("Restore Iskios").click(); page.wait_for_timeout(1500)
    page.get_by_label("Fold Iskios").first.click(); page.wait_for_timeout(1500)
    page.get_by_text("Deploy the site", exact=True).first.click(); page.wait_for_timeout(3000)
    page.get_by_label("Ask Iskios").click(); page.wait_for_timeout(2500)
    page.screenshot(path=out + "-4-quest-column.png")
    print("OK", page.get_by_label("Fold Iskios").count())
