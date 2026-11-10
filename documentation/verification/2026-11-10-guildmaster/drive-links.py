import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/gild-serve.log").read()).group(1)
out = sys.argv[1]
def say(page, text):
    box = page.locator('[contenteditable="true"], textarea').last
    box.click()
    page.keyboard.insert_text(text)
    page.keyboard.press("Enter")
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(f"window.gild = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    say(page, 'call open_mission {"request":"fail claude Usage limit reached","title":"Doomed quest"}')
    page.wait_for_timeout(12000)
    page.screenshot(path=f"{out}/12-links-after-reply.png")
    text = page.inner_text("body")
    order = [m.start() for m in [re.search(r"Echo: Opened the quest", text), re.search(r"Opened quest: Doomed quest", text)] if m]
    print("OPENED confirmation before link:", len(order) == 2 and order[0] < order[1])
    print("LINKS:", len(re.findall(r"Open quest: Doomed quest", text)), "report seen:", "failed" in text)
    # the report's link opens the quest
    page.get_by_text("Open quest: Doomed quest").last.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{out}/13-link-opened-quest.png")
    print("OPENED QUEST PAGE:", "Usage limit reached" in page.inner_text("body"))
    b.close()
