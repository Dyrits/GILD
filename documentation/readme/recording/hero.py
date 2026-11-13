import sys
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9377"); pg = b.contexts[0].pages[0]
    cdp = pg.context.new_cdp_session(pg)
    cdp.send("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 2, "mobile": False})
    exec(open("/tmp/iskios-demo/scenes/common.py").read())
    for scheme in ["light", "dark"]:
        cdp.send("Emulation.setEmulatedMedia", {"features": [{"name": "prefers-color-scheme", "value": scheme}]})
        pg.wait_for_timeout(800)
        go('Release 2.4'); go('Fix checkout rounding')
        for i in range(3):
            if pg.get_by_label('Expand Iskios').count() == 0: break
            pg.get_by_text('Iskios', exact=True).nth(i % 2).click(); pg.wait_for_timeout(800)
        print('iskios open', pg.get_by_label('Expand Iskios').count())
        if pg.get_by_label('Show quest panel').count() > 0: pg.get_by_label('Show quest panel').first.click(); pg.wait_for_timeout(600)
        pg.mouse.move(700, 450); pg.mouse.wheel(0, 4000); pg.wait_for_timeout(400); pg.get_by_text('Handed over to Codex').first.scroll_into_view_if_needed(); pg.wait_for_timeout(300); pg.mouse.wheel(0, -330); pg.wait_for_timeout(500); pg.mouse.move(1435, 895); pg.wait_for_timeout(500)
        pg.screenshot(path=f"/tmp/iskios-demo/out/hero-{scheme}.png")
