import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
out = sys.argv[1]
width = sys.argv[2] if len(sys.argv) > 2 else "150"
FIT = """() => [...document.querySelectorAll('div[dir=auto], div')].filter(e => ['Realms','Borderlands','The Keep'].includes(e.textContent) && e.children.length===0)
  .map(e => ({t: e.textContent, sw: e.scrollWidth, cw: e.clientWidth}))"""
def heading(page, name):
    return page.get_by_role("button", name=name, exact=True).first
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ["dark", "light"]:
        page = b.new_page(viewport={"width": 1280, "height": 900})
        page.add_init_script(f"""window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};
          localStorage.setItem('iskios.colorScheme', '{scheme}'); localStorage.setItem('iskios:sidebar-width', '{width}');""")
        page.goto("http://localhost:8123/")
        page.wait_for_timeout(3500)
        page.mouse.move(900, 600)
        page.wait_for_timeout(300)
        page.screenshot(path=f"{out}/{scheme}-01-rest.png", clip={"x": 0, "y": 0, "width": 420, "height": 900})
        print(scheme, "rest fit", page.evaluate(FIT))
        for name, tag in [("Realms", "realms"), ("Borderlands", "borderlands"), ("The Keep", "keep")]:
            heading(page, name).hover()
            page.wait_for_timeout(300)
            print(scheme, name, "hover fit", page.evaluate(FIT))
            page.screenshot(path=f"{out}/{scheme}-02-hover-{tag}.png", clip={"x": 0, "y": 0, "width": 420, "height": 900})
        page.get_by_role("button", name="Atlas", exact=True).hover()
        page.wait_for_timeout(300)
        page.screenshot(path=f"{out}/{scheme}-03-hover-realm-row.png", clip={"x": 0, "y": 0, "width": 420, "height": 900})
        # fold Realms and Borderlands
        heading(page, "Realms").click(); heading(page, "Borderlands").click()
        page.mouse.move(900, 600); page.wait_for_timeout(300)
        page.screenshot(path=f"{out}/{scheme}-04-collapsed-rest.png", clip={"x": 0, "y": 0, "width": 420, "height": 500})
        heading(page, "Borderlands").hover(); page.wait_for_timeout(300)
        page.screenshot(path=f"{out}/{scheme}-05-collapsed-hover-borderlands.png", clip={"x": 0, "y": 0, "width": 420, "height": 500})
        heading(page, "Realms").click(); heading(page, "Borderlands").click()
        page.mouse.move(900, 600); page.wait_for_timeout(300)
        # keyboard focus reveals
        heading(page, "Borderlands").focus(); page.wait_for_timeout(300)
        label = page.evaluate("() => document.activeElement && document.activeElement.getAttribute('aria-label')")
        print(scheme, "focused", label, "overflow", [heading(page, n).evaluate("e => e.scrollWidth - e.clientWidth") for n in ["Realms", "Borderlands", "The Keep"]])
        page.screenshot(path=f"{out}/{scheme}-06-focus-borderlands.png", clip={"x": 0, "y": 0, "width": 420, "height": 900})
        # full list of the Borderlands
        page.get_by_role("button", name=re.compile("Show all .* quests of the Borderlands")).click()
        page.wait_for_timeout(2000)
        page.mouse.move(1200, 880)
        page.screenshot(path=f"{out}/{scheme}-07-borderlands-list.png")
        print(scheme, "list rows", page.locator("[role=button]").all_inner_texts()[-14:])
        page.close()
    b.close()
