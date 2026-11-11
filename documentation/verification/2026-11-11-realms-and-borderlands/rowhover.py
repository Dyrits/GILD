import re, json, sys
from playwright.sync_api import sync_playwright
# Moves a real pointer onto x positions of one realm row and of the Borderlands heading and reads the actions' opacity.
# Usage: rowhover.py <url-or-cdp> [cdp]
target = sys.argv[1]
OP = """(e) => { const w = [...e.querySelectorAll('[role=button]')].map(k => k.parentElement);
  const wrap = w.find(p => p !== e && p.querySelectorAll('[role=button]').length >= 1 && getComputedStyle(p).flexDirection === 'row' && p !== e) ;
  const btn = [...e.querySelectorAll('[role=button]')].filter(k => /overview|New quest|New realm/.test(k.getAttribute('aria-label') || ''));
  return btn.map(b => getComputedStyle(b.parentElement).opacity).join(',') }"""
def probe(page, name):
    el = page.get_by_role("button", name=name, exact=True).first
    box = el.bounding_box()
    y = box["y"] + box["height"] / 2
    xs = {"name": box["x"] + 40, "middle": box["x"] + box["width"] * 0.5, "count": box["x"] + box["width"] * 0.62,
          "buttons": box["x"] + box["width"] - 30, "extreme right": box["x"] + box["width"] - 2}
    res = {}
    for mode in ["from outside", "sweep"]:
        page.mouse.move(box["x"] + box["width"] + 300, y + 200); page.wait_for_timeout(250)
        for label, x in xs.items():
            if mode == "from outside":
                page.mouse.move(box["x"] + box["width"] + 300, y + 200); page.wait_for_timeout(200)
            page.mouse.move(x, y, steps=10); page.wait_for_timeout(250)
            res[(mode, label)] = el.evaluate(OP)
    print(name, json.dumps({f"{m}/{l}": v for (m, l), v in res.items()}))
    return [k for k, v in res.items() if "0" in v.split(",")]
with sync_playwright() as p:
    if target.startswith("cdp:"):
        b = p.chromium.connect_over_cdp(target[4:]); page = b.contexts[0].pages[0]
    else:
        endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
        b = p.chromium.launch(); page = b.new_page(viewport={"width": 1440, "height": 900})
        page.add_init_script(f"window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }}; " + (f"localStorage.setItem('iskios:sidebar-width', '{sys.argv[3]}');" if len(sys.argv) > 3 else "localStorage.removeItem('iskios:sidebar-width');"))
        page.goto(target); page.wait_for_timeout(3500)
    failures = []
    for name in ["Atlas", "Ideas", "Borderlands", "Realms"]:
        failures += [(name, *k) for k in probe(page, name)]
    print("FAIL" if failures else "PASS", failures)
    if len(sys.argv) > 2: page.screenshot(path=sys.argv[2])
    b.close()
    sys.exit(1 if failures else 0)
