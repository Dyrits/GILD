import re, json
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-serve.log").read()).group(1)
out = "/tmp/iskios-drive/shots"
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1500, "height": 900})
    page.add_init_script(f"window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3500)
    # 1. Realm list page and its panel
    page.get_by_role("button", name=re.compile(r"Show all \d+ quests")).first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/a-realm-page.png")
    print("realm panel name:", page.get_by_label(re.compile("Crest of")).count())
    print("hide handle:", page.get_by_label("Hide quest panel").count())
    box = page.get_by_label("Hide quest panel").first.bounding_box(); print("open handle box", box)
    page.get_by_label("Hide quest panel").first.click(); page.wait_for_timeout(600)
    page.screenshot(path=f"{out}/b-realm-panel-hidden.png")
    box = page.get_by_label("Show quest panel").first.bounding_box(); print("closed tab box", box, "window 1500x900")
    page.get_by_label("Show quest panel").first.click(); page.wait_for_timeout(600)
    # 2. crest studio / lore open from the page
    page.get_by_label(re.compile("Crest of")).first.click(); page.wait_for_timeout(800)
    page.screenshot(path=f"{out}/c-crest-studio.png")
    page.keyboard.press("Escape")
    # 3. min sidebar width: drag the resizer far left
    page.reload(); page.wait_for_timeout(3000)
    r = page.get_by_label("Resize the sidebar").bounding_box()
    page.mouse.move(r["x"] + 4, 400); page.mouse.down(); page.mouse.move(20, 400, steps=10); page.mouse.up()
    page.wait_for_timeout(500)
    print("sidebar width after drag:", page.evaluate("document.querySelector('[aria-label=\"Resize the sidebar\"]').getBoundingClientRect().x + 4"))
    h = page.get_by_text("Free Realms", exact=True).first
    print("Free Realms heading box", h.bounding_box())
    page.screenshot(path=f"{out}/d-min-sidebar.png")
    b.close()
