import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/gild-serve.log").read()).group(1)
out = sys.argv[1]
def open_page(b, width, height):
    page = b.new_page(viewport={"width": width, "height": height})
    page.add_init_script(f"window.gild = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    return page
with sync_playwright() as p:
    b = p.chromium.launch()
    page = open_page(b, 1440, 900)
    page.get_by_label("Workshop", exact=True).first.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{out}/01-wide-top.png")
    body = page.inner_text("body")
    for name in ["WORKSHOP", "SETTINGS GUIDE", "QUICK NOTES", "PERMISSIONS", "HARNESSES", "ACCOUNTS", "QUEST UPKEEP", "GLOBAL BUDGET"]:
        print("HAS", name, name in body.upper())
    page.get_by_role("button", name="Limits").first.click()
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/02-wide-limits.png")
    page.get_by_role("button", name="Accounts").first.click()
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/03-wide-accounts.png")
    print("SELECTED", [e.inner_text() for e in page.locator('[aria-selected="true"]').all()])
    b.close()
    b = p.chromium.launch()
    page = open_page(b, 700, 900)
    page.screenshot(path=f"{out}/04-narrow-start.png")
    b.close()
