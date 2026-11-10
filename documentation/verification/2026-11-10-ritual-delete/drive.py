import json, os, re, sys
from playwright.sync_api import sync_playwright

# Deleting a Ritual from its card: one confirmation, the card goes, its quest joins the Quests board.
root = sys.argv[1]
endpoint = re.search(r"ENDPOINT (\S+)", open(f"{root}/serve.log").read()).group(1)
out = f"{root}/drive"
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1440, "height": 900})
    page.add_init_script(f"window.gild = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3000)
    page.get_by_label("Rituals", exact=True).first.click()
    page.wait_for_timeout(1000)
    page.get_by_label("New Ritual").click()
    page.wait_for_timeout(800)
    page.get_by_label("Ritual title").fill("Morning digest")
    page.get_by_label("Ritual instruction").fill("runner")
    page.get_by_label("Create Ritual").click()
    page.wait_for_timeout(2000)
    page.get_by_label("Rituals", exact=True).first.click()
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{out}/01-card-with-delete.png")
    page.get_by_role("button", name="Delete", exact=True).click()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{out}/02-confirm.png")
    # Cancel first: nothing is deleted.
    page.get_by_role("button", name="Cancel", exact=True).click()
    page.wait_for_timeout(500)
    print("CANCEL_KEEPS_CARD", page.get_by_label("Run now").count() == 1)
    page.get_by_role("button", name="Delete", exact=True).click()
    page.wait_for_timeout(300)
    page.get_by_label("Confirm: delete the Ritual, keep its quest").click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/03-after-delete.png")
    print("CARD_GONE", page.get_by_label("Run now").count() == 0)
    print("EMPTY_LINE", "No Ritual yet" in page.inner_text("body"))
    page.get_by_label("Quests", exact=True).first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{out}/04-quests-board.png")
    print("QUEST_ON_BOARD", "MORNING DIGEST" in page.inner_text("body").upper())
    b.close()
