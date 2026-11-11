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

with sync_playwright() as p:
    b = p.chromium.launch()
    page = open_page(b)
    page.screenshot(path=f"{out}/01-board.png")
    quests = page.locator("[role=button]", has_text=re.compile("^(wait|spend)")).all_inner_texts()
    print("QUESTS in the rail:", quests)
    # open the quest that spent 2,000 on the Work account: its question
    page.locator("[role=button]", has_text="spend 2000").first.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{out}/02-account-stop.png")
    body = page.inner_text("body")
    print("STOP question:", re.findall(r"The budget of [^\n]+", body))
    print("Buttons:", [t for t in ["Raise budget +25%", "Raise budget +50%", "Raise budget Double", "Switch to a backup Companion", "Stop"] if t.lower() in body.lower()])
    print("Stop line in the quest:", re.findall(r"Account Claude Code · Work reached its budget[^\n]*", body))
    # Double raises 1,000 to 2,000, which equals what was spent, so the account is still at its budget; a second Double releases it
    page.get_by_text(re.compile("^Raise budget Double$", re.I)).first.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{out}/03a-after-first-raise.png")
    print("After the first Double (2,000 of 2,000): question still open:", "The budget of" in page.inner_text("body"))
    page.get_by_text(re.compile("^Raise budget Double$", re.I)).first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{out}/03b-after-second-raise.png")
    body = page.inner_text("body")
    print("After the second Double (4,000): question gone:", "The budget of" not in body)
    # the Charter's account budgets card
    page = open_page(b)
    page.get_by_text(re.compile("^charter$", re.I)).first.click()
    page.wait_for_timeout(1500)
    page.get_by_text("Account budgets and credits", exact=False).first.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{out}/04-charter-account-budgets.png")
    body = page.inner_text("body")
    print("CHARTER rows:", re.findall(r"Claude Code · [^\n]+", body)[:4])
    print("CHARTER summary:", re.findall(r"[^\n]*counted by Gild", body)[:4])
    b.close()
