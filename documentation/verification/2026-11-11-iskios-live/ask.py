import sys
from playwright.sync_api import sync_playwright
msg, tag, wait = sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 60
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9357"); pg = b.contexts[0].pages[0]
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.get_by_text("Guild Hall", exact=True).first.click(); pg.wait_for_timeout(2500)
    box = pg.locator('[contenteditable="true"]').last
    box.click(); pg.keyboard.type(msg, delay=5); pg.wait_for_timeout(500)
    pg.keyboard.press("Enter")
    for _ in range(wait // 5):
        pg.wait_for_timeout(5000)
        t = pg.evaluate("document.body.innerText")
        if "Resting" in t[:400] or "Idle" in t[:400]: 
            pass
    pg.screenshot(path=f"/tmp/iskios-live/shots/{tag}.png")
    print(pg.evaluate("document.body.innerText")[:2500])
