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
    page.screenshot(path=f"{out}/14-button-beside-reply.png")
    buttons = page.get_by_role("button", name=re.compile(r"(Opened quest|Open quest): Doomed quest"))
    print("BUTTONS:", buttons.count(), [buttons.nth(i).get_attribute("aria-label") for i in range(buttons.count())])
    # each button sits to the right of a reply, on the same line
    replies = page.get_by_text(re.compile(r"^Echo: "))
    for i in range(buttons.count()):
        box = buttons.nth(i).bounding_box()
        print("BUTTON", i, {k: round(v) for k, v in box.items()})
    for i in range(replies.count()):
        box = replies.nth(i).bounding_box()
        print("REPLY", i, {k: round(v) for k, v in box.items()}, replies.nth(i).inner_text()[:50])
    page.set_viewport_size({"width": 1000, "height": 900})
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/15-button-narrow.png")
    for i in range(buttons.count()):
        print("NARROW BUTTON", i, {k: round(v) for k, v in buttons.nth(i).bounding_box().items()})
    page.set_viewport_size({"width": 1440, "height": 900})
    page.wait_for_timeout(1000)
    buttons.last.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{out}/16-button-opened-quest.png")
    print("OPENED QUEST PAGE:", "Usage limit reached" in page.inner_text("body"))
    b.close()
