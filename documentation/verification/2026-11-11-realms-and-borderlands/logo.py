import re, json, sys
from playwright.sync_api import sync_playwright
endpoint = re.search(r"ENDPOINT (\S+)", open("/tmp/iskios-cl/serve.log").read()).group(1)
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch()
    for scheme in ["dark", "light"]:
        for label, width, height in [("default", None, 900), ("min", "150", 900), ("short", None, 600)]:
            page = b.new_page(viewport={"width": 1280, "height": height})
            store = f"localStorage.setItem('iskios:sidebar-width', '{width}');" if width else "localStorage.removeItem('iskios:sidebar-width');"
            page.add_init_script(f"""window.iskios = {{ endpoint: async () => {json.dumps(endpoint)}, chooseFolder: async () => null, hasOwnTitleBar: false }};
              localStorage.setItem('iskios.colorScheme', '{scheme}'); {store}""")
            page.goto("http://localhost:8123/"); page.wait_for_timeout(3500)
            rail = page.get_by_label("Resize the sidebar").bounding_box()["x"] + 4
            borderlands = page.get_by_role("button", name="Borderlands", exact=True).first.bounding_box()
            keep = page.get_by_role("button", name="The Keep", exact=True).first.bounding_box()
            print(scheme, label, "rail", rail, "Borderlands y", round(borderlands["y"]), "Keep y", round(keep["y"]), "window h", height)
            page.screenshot(path=f"{out}/{scheme}-30-logo-{label}.png", clip={"x": 0, "y": 0, "width": int(rail) + 20, "height": height})
            page.close()
    b.close()
