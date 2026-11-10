import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/gild-serve.log").read()).group(1)
seed = json.load(open("/tmp/gild-seed.json"))["missionId"]
out = sys.argv[1]
def open_page(b, width, height):
    page = b.new_page(viewport={"width": width, "height": height})
    page.add_init_script(f"window.gild = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    return page
def say(page, text):
    box = page.locator('[contenteditable="true"], textarea').last
    box.click()
    page.keyboard.insert_text(text)
    page.keyboard.press("Enter")
with sync_playwright() as p:
    b = p.chromium.launch()
    page = open_page(b, 1440, 900)
    page.screenshot(path=f"{out}/01-empty.png")
    body = page.inner_text("body")
    print("HAS tell", "Tell the Guildmaster" in body, "HAS realm tile", "app" in body)
    # choose the realm in the side panel (its tile shows the folder)
    page.get_by_text("/private/tmp/gild-guildmaster/app", exact=True).first.click()
    page.wait_for_timeout(500)
    print("HAS realm note", "The next quest opens in" in page.inner_text("body"))
    page.screenshot(path=f"{out}/01b-realm-chosen.png")
    args = json.dumps({"missions": [seed], "realm": "app", "text": "Take PAY-481 again", "title": "PAY-481 again"})
    say(page, f"call suggest_mission {args}")
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{out}/02-continue-in.png")
    body = page.inner_text("body")
    print("HAS card", "A quest may already cover this" in body, "HAS continue", "Continue in" in body, "HAS anyway", "Open a new quest anyway" in body, "ASIDE", "Keep as aside" in body)
    page.get_by_text("Open a new quest anyway", exact=False).first.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{out}/03-opened-anyway.png")
    print("HAS opened line", "Opened quest" in page.inner_text("body"))
    say(page, 'call open_mission {"request":"Compare lunch spots near the office","title":"Lunch spots"}')
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{out}/04-open-mission-card.png")
    print("HAS lunch", "Lunch spots" in page.inner_text("body"))
    # a realm's page hands its message to the Guildmaster, with the realm attached
    page.get_by_role("button", name=re.compile("^app")).first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/05-realm-page.png")
    print("HAS handoff hint", "Goes to the Guildmaster" in page.inner_text("body"))
    say(page, "Fix the header spacing")
    page.wait_for_timeout(3500)
    page.screenshot(path=f"{out}/06-after-handoff.png")
    body = page.inner_text("body")
    print("ON guildmaster", "Fix the header spacing" in body, "ECHO has realm", "The owner chose the realm" in body)
    b.close()
