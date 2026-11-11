import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
out = sys.argv[1]
OPACITY = """e => { const kids = [...e.querySelectorAll('[role=button]')]; return kids.map(k => [k.getAttribute('aria-label'), getComputedStyle(k.parentElement).opacity, getComputedStyle(k).opacity]) }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ["dark", "light"]:
        page = b.new_page(viewport={"width": 1280, "height": 900})
        page.add_init_script(f"""window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};
          localStorage.setItem('iskios.colorScheme', '{scheme}'); localStorage.setItem('iskios:sidebar-width', '150');""")
        page.goto("http://localhost:8123/"); page.wait_for_timeout(3500)
        for name, tag in [("Realms", "realms"), ("Borderlands", "borderlands"), ("The Keep", "keep"), ("Atlas", "atlas")]:
            el = page.get_by_role("button", name=name, exact=True).first
            box = el.bounding_box()
            page.mouse.move(900, 600); page.wait_for_timeout(200)
            page.mouse.move(box["x"] + box["width"] - 3, box["y"] + box["height"] / 2, steps=8); page.wait_for_timeout(300)
            print(scheme, name, "far-right hover", el.evaluate(OPACITY))
            page.screenshot(path=f"{out}/{scheme}-10-far-right-hover-{tag}.png", clip={"x": 0, "y": 0, "width": 420, "height": 700})
        # click the Realms heading, move away: nothing shown
        el = page.get_by_role("button", name="Realms", exact=True).first
        el.click(); el.click()
        page.mouse.move(900, 600, steps=5); page.wait_for_timeout(300)
        print(scheme, "after click, pointer away", el.evaluate(OPACITY))
        page.screenshot(path=f"{out}/{scheme}-11-after-click-away.png", clip={"x": 0, "y": 0, "width": 420, "height": 700})
        # Tab to it from the Guild Hall row
        page.get_by_role("button", name="Guild Hall", exact=True).first.focus()
        page.keyboard.press("Tab"); page.wait_for_timeout(300)
        label = page.evaluate("() => document.activeElement.getAttribute('aria-label')")
        print(scheme, "tab focus on", label, el.evaluate(OPACITY))
        page.screenshot(path=f"{out}/{scheme}-12-tab-focus-realms.png", clip={"x": 0, "y": 0, "width": 420, "height": 700})
        page.close()
    b.close()
