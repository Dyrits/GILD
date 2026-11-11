import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
out = sys.argv[1]
names = ["Guild Hall", "Realms", "Borderlands", "Rituals", "Craft", "The Keep", "Reserves", "Charter", "Workshop"]
LABEL = """(e, n) => { const t = [...e.querySelectorAll('div')].find(d => d.textContent === n && d.children.length === 0);
  const r = e.getBoundingClientRect(); const l = t ? t.getBoundingClientRect() : null;
  return {top: Math.round(r.top), h: Math.round(r.height), labelX: l ? Math.round(l.left) : null, labelMid: l ? Math.round(l.top + l.height / 2) : null} }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ["dark", "light"]:
        page = b.new_page(viewport={"width": 1280, "height": 1100})
        page.add_init_script(f"""window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};
          localStorage.setItem('iskios.colorScheme', '{scheme}'); localStorage.removeItem('iskios:sidebar-width'); localStorage.setItem('iskios:sidebar-hidden', '0');""")
        page.goto("http://localhost:8123/"); page.wait_for_timeout(3500)
        if len(sys.argv) > 2:
            for n in ["Realms", "Borderlands", "The Keep"]:
                page.get_by_role("button", name=n, exact=True).first.click()
            page.mouse.move(900, 600); page.wait_for_timeout(400)
        rows = {n: page.get_by_role("button", name=n, exact=True).first.evaluate(LABEL, n) for n in names}
        for n in names: print(scheme, "expanded", n, rows[n])
        page.screenshot(path=f"{out}/{scheme}-40-spacing-{'folded' if len(sys.argv) > 2 else 'expanded'}.png", clip={"x": 0, "y": 0, "width": 310, "height": 1100})
        page.keyboard.press("Meta+b"); page.wait_for_timeout(800)
        page.screenshot(path=f"{out}/{scheme}-41-spacing-collapsed.png", clip={"x": 0, "y": 0, "width": 310, "height": 1100})
        print(scheme, "collapsed buttons", [ (l, ) for l in page.locator("[role=button]").evaluate_all("es => es.filter(e => e.getBoundingClientRect().left < 80 && e.getBoundingClientRect().width < 70).map(e => [e.getAttribute('aria-label'), Math.round(e.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().height)])")][:20])
        page.close()
    b.close()
