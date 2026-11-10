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
def say(page, text):
    box = page.locator('[contenteditable="true"], textarea').last
    box.click()
    page.keyboard.insert_text(text)
    page.keyboard.press("Enter")
with sync_playwright() as p:
    b = p.chromium.launch()
    page = open_page(b, 1440, 900)
    # A Ritual made by the Guildmaster
    say(page, 'call create_ritual {"instruction":"Say hello to me","schedule":{"_tag":"Hourly","hours":1},"title":"Hourly hello"}')
    page.wait_for_timeout(3500)
    page.screenshot(path=f"{out}/07-ritual-card.png")
    body = page.inner_text("body")
    print("HAS ritual card", "Created Ritual" in body, "HAS ritual in rail", "Hourly hello" in body)
    # Hearing back from a quest it opened
    say(page, 'call open_mission {"request":"call report_result {\\"journal\\":\\"nothing to record\\",\\"result\\":\\"All checked\\"}","title":"Quick check","tier":"Balanced"}')
    page.wait_for_timeout(9000)
    page.screenshot(path=f"{out}/08-hearing-back.png")
    body = page.inner_text("body")
    print("HAS opened", "Opened quest" in body, "HAS reported", "reported its result" in body, "HAS Balanced? (no tiers set)", "Balanced:" in body)
    # The Guildmaster's budget
    page.get_by_text("Budget ·", exact=False).first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/09-budget.png")
    print("HAS budget screen", "Budget · Guildmaster" in page.inner_text("body").replace("BUDGET · GUILDMASTER", "Budget · Guildmaster"))
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    # The Charter's Guildmaster card
    page.get_by_text(re.compile("^charter$", re.I)).first.click()
    page.wait_for_timeout(2500)
    page.get_by_text("Set a Companion", exact=False).first.click()
    page.wait_for_timeout(1000)
    page.get_by_text("The Guildmaster", exact=False).first.scroll_into_view_if_needed()
    page.screenshot(path=f"{out}/10-charter-guildmaster.png")
    body = page.inner_text("body")
    print("HAS tiers card", "Show the Guildmaster in the rail" in body, "Not set: this work starts" in body)
    page.locator("text=Show the Guildmaster in the rail").first.locator("xpath=preceding-sibling::*[1]").click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/11-guildmaster-hidden.png")
    rail = page.locator("body").inner_text()
    print("RAIL still has GUILDMASTER entry (title casing):", rail.upper().count("GUILDMASTER"))
    b.close()
