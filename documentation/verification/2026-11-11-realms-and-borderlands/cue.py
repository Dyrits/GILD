import re, json
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_page()
    page.add_init_script(f"window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};")
    page.goto("http://localhost:8123/"); page.wait_for_timeout(3500)
    print(page.evaluate("() => [...document.querySelectorAll('[title]')].map(e => [e.getAttribute('title'), e.getAttribute('aria-label')])"))
    b.close()
