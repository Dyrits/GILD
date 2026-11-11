import re, json
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1280, "height": 900})
    page.add_init_script(f"""window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};
      localStorage.setItem('iskios:sidebar-width', '150');""")
    page.goto("http://localhost:8123/"); page.wait_for_timeout(3500)
    for name in ["Realms", "Borderlands", "The Keep", "Atlas", "Ideas"]:
        el = page.get_by_role("button", name=name, exact=True).first
        print(name, el.evaluate("e => { const r = e.getBoundingClientRect(); const kids = [...e.querySelectorAll('*')].map(k => k.getBoundingClientRect().right); return {left: r.left, right: r.right, contentRight: Math.max(...kids), sw: e.scrollWidth, cw: e.clientWidth} }"))
    b.close()
