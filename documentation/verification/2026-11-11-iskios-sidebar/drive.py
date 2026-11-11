import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-serve.log").read()).group(1)
out = "/tmp/iskios-drive/shots"
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(f"window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3500)
    page.screenshot(path=f"{out}/01-home.png")
    # expand "Right sidebar" and open it
    page.get_by_role("button", name="Expand Right sidebar").click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/02-expanded.png")
    page.get_by_role("button", name="Integrate & review", exact=True).click()
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{out}/03-sidequest-open.png")
    print([t for t in page.locator("[role=button]").all_inner_texts()][:60])
    b.close()
