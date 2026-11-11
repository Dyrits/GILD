from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9357"); pg = b.contexts[0].pages[0]
    pg.set_viewport_size({"width": 1280, "height": 900})
    pg.get_by_text('Open the new quest', exact=False).first.click()
    pg.wait_for_timeout(8000)
    pg.screenshot(path="/tmp/iskios-live/shots/4-opened.png")
    print(pg.evaluate("document.body.innerText")[:900].replace("\n"," | "))
