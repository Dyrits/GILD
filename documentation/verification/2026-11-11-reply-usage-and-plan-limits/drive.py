import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/gild-serve.log").read()).group(1)
out = sys.argv[1]

def open_page(b, width=1440, height=900):
    page = b.new_page(viewport={"width": width, "height": height})
    page.add_init_script(f"window.gild = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8099/")
    page.wait_for_timeout(3500)
    return page

with sync_playwright() as p:
    b = p.chromium.launch()
    # the rail's plan limits: the first read starts in the background, the next change feed shows it
    page = open_page(b)
    page.wait_for_timeout(5000)
    page.screenshot(path=f"{out}/01-rail-plan-limits.png")
    body = page.inner_text("body")
    print("RAIL plan limits:", re.findall(r"(?:5-hour|Weekly) · [^\n]+", body))
    # a Claude Code quest: the line under its reply and the thread panel row
    page.locator("[role=button]", has_text="Summarize the checkout flow").first.click()
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{out}/02-claude-reply-line.png")
    body = page.inner_text("body")
    print("CLAUDE reply line:", re.findall(r"[\d,]+ tokens · [^\n]+", body)[:3])
    print("THREAD PANEL plan limits row:", re.findall(r"Plan limits\s*\n?\s*([^\n]+)", body))
    # a Codex quest
    page = open_page(b)
    page.locator("[role=button]", has_text="Hello from Codex").first.click()
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{out}/03-codex-reply-line.png")
    body = page.inner_text("body")
    print("CODEX reply line:", re.findall(r"[\d,]+ tokens · [^\n]+", body)[:3])
    print("CODEX thread panel plan limits:", re.findall(r"Plan limits\s*\n?\s*([^\n]+)", body))
    # the Charter's account rows
    page = open_page(b)
    page.get_by_text(re.compile("^charter$", re.I)).first.click()
    page.wait_for_timeout(2000)
    page.get_by_text("Account budgets and credits", exact=False).first.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    page.screenshot(path=f"{out}/04-charter-plan-limits.png")
    body = page.inner_text("body")
    print("CHARTER:", re.findall(r"(?:Codex|Claude Code|OpenCode) · [^\n]+|[^\n]*as of [^\n]+|Limits not reported", body)[:9])
    b.close()
