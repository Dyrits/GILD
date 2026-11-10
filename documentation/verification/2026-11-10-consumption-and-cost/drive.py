import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/gild-serve.log").read()).group(1)
out = sys.argv[1]

def open_page(b, width=1440, height=900):
    page = b.new_page(viewport={"width": width, "height": height})
    page.add_init_script(f"window.gild = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    return page

def has(page, text):
    return text in page.inner_text("body")

with sync_playwright() as p:
    b = p.chromium.launch()
    page = open_page(b)
    page.get_by_role("button", name=re.compile("^Quests")).first.click() if page.get_by_role("button", name=re.compile("^Quests")).count() else None
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/01-board.png")
    body = page.inner_text("body")
    print("BOARD HAS ≈ $3.00 (subscription quest card):", "≈ $3.00" in body)
    print("BOARD HAS $1.25 (API-key quest card, reported, no ≈):", "$1.25" in body and "≈ $1.25" not in body)
    print("TOP BAR / RAIL figure with ≈:", re.findall(r"[\d,]+ tokens · ≈ \$[\d.]+", body))
    # select the subscription quest: the quest panel's usage row
    page.get_by_text("BILLING SUBSCRIPTION", exact=False).first.click()
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/02-quest-panel.png")
    body = page.inner_text("body")
    print("QUEST PANEL usage row:", re.findall(r"Quest usage\s*\n?\s*([^\n]+)", body))
    # open the quest's budget window: the split by harness and model with estimates
    page.get_by_text("Quest budget", exact=False).first.click()
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/03-budget-window.png")
    body = page.inner_text("body")
    print("BUDGET WINDOW has By harness:", "By harness" in body, "| By model:", "By model" in body, "| test-model:", "test-model" in body, "| Claude Code:", "Claude Code" in body)
    print("BUDGET WINDOW used line:", re.findall(r"Used [^\n]+", body), re.findall(r"[\d,]+ tokens · ≈ \$[\d.]+", body))
    # the quest's conversation: the thread panel's "This thread" row
    page = open_page(b)
    page.locator("[role=button]", has_text="billing Subscription").first.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{out}/04-thread-panel.png")
    body = page.inner_text("body")
    print("THREAD PANEL This thread row:", re.findall(r"This thread\s*\n?\s*([^\n]+)", body))
    # the Charter's model prices card
    page = open_page(b)
    page.get_by_text(re.compile("^charter$", re.I)).first.click()
    page.wait_for_timeout(1500)
    page.get_by_text("Model prices", exact=False).first.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{out}/05-charter-prices.png")
    body = page.inner_text("body")
    print("CHARTER status line:", re.findall(r"Prices from [^\n]+", body), "| Refresh now button:", "refresh now" in body.lower())
    page.get_by_text("Fetch prices from models.dev").first.evaluate("e => e.parentElement.querySelector('[role=switch]').click()")
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{out}/06-charter-prices-off.png")
    body = page.inner_text("body")
    print("CHARTER after switching off:", re.findall(r"Prices from [^\n]+", body), "| Refresh now button:", "refresh now" in body.lower())
    b.close()
