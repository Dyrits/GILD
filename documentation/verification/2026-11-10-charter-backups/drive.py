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
    page.get_by_text(re.compile("^charter$", re.I)).first.click()
    page.wait_for_timeout(2500)
    card = page.get_by_text("Backup companions", exact=True).first
    card.scroll_into_view_if_needed()
    page.screenshot(path=f"{out}/1-empty.png")
    page.get_by_text("+ Add a backup Companion").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/2-one.png")
    page.get_by_text("+ Add a backup Companion").first.click()
    page.wait_for_timeout(1500)
    page.get_by_text("Backup companions", exact=True).first.scroll_into_view_if_needed()
    page.screenshot(path=f"{out}/3-two.png")
    page.get_by_label("Move backup 2 up").click()
    page.wait_for_timeout(800)
    page.get_by_label("Remove backup 2").click()
    page.wait_for_timeout(1000)
    print("ONE LEFT", page.get_by_label("Remove backup 1").count() == 1, page.get_by_label("Remove backup 2").count() == 0)
    # persisted: reload
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    page.get_by_text(re.compile("^charter$", re.I)).first.click()
    page.wait_for_timeout(2500)
    print("PERSISTED", page.get_by_label("Remove backup 1").count() == 1)
    page.get_by_text("Backup companions", exact=True).first.scroll_into_view_if_needed()
    page.screenshot(path=f"{out}/4-reloaded.png")
    b.close()
