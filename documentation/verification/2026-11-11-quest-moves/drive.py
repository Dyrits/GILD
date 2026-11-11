import sys, json
from playwright.sync_api import sync_playwright
shots = "/tmp/iskios-move/shots"
scheme = sys.argv[1]
def sidebar(pg):
    # The sidebar's rows in order, as their accessible names, to read where each quest stands.
    return pg.evaluate("""() => [...document.querySelectorAll('[role=button]')].filter(e => e.getBoundingClientRect().left < 420)
      .map(e => (e.getAttribute('aria-label') || e.textContent || '').trim()).filter(t => t && t.length < 60)""")
def under(rows, realm, quest):
    names = ["Atlas", "Ideas", "Borderlands", "Rituals"]
    start = rows.index(realm)
    end = min(rows.index(n) for n in names if n in rows and rows.index(n) > start)
    return any(r == quest or r.startswith(quest) for r in rows[start:end])
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9347"); pg = b.contexts[0].pages[0]
    pg.evaluate(f"localStorage.setItem('iskios.colorScheme','{scheme}')"); pg.reload(); pg.wait_for_timeout(6000)
    pg.set_viewport_size({"width": 1280, "height": 900})
    rows = sidebar(pg); print("rows", rows)
    pg.screenshot(path=f"{shots}/{scheme}-1-rest.png", clip={"x": 0, "y": 0, "width": 420, "height": 700})
    def quest(name): return pg.get_by_text(name, exact=True).first
    def realm(name): return pg.get_by_role("button", name=name, exact=True).first
    # 1. drop on another realm opens the confirmation and moves nothing yet
    start_realm = "Atlas" if under(rows, "Atlas", "Merge menus") else "Ideas"
    target = "Ideas" if start_realm == "Atlas" else "Atlas"
    print("start", start_realm, "->", target)
    quest("Merge menus").drag_to(realm(target)); pg.wait_for_timeout(800)
    title = pg.get_by_text("Move \"Merge menus\" to", exact=False)
    print("modal shown:", title.count() > 0, "|", title.first.inner_text() if title.count() else None)
    pg.screenshot(path=f"{shots}/{scheme}-2-confirm.png")
    print("unchanged while asking:", under(sidebar(pg), start_realm, "Merge menus"))
    # 2. cancel leaves it
    pg.get_by_role("button", name="Cancel", exact=True).first.click(); pg.wait_for_timeout(600)
    print("modal closed:", pg.get_by_text("Move the quest").count() == 0, "| still in", start_realm, under(sidebar(pg), start_realm, "Merge menus"))
    # 3. confirm moves it
    quest("Merge menus").drag_to(realm(target)); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="Move the quest", exact=True).click(); pg.wait_for_timeout(2500)
    after = sidebar(pg); print("moved to", target, under(after, target, "Merge menus"), "| left", start_realm, not under(after, start_realm, "Merge menus"))
    pg.screenshot(path=f"{shots}/{scheme}-3-moved.png", clip={"x": 0, "y": 0, "width": 420, "height": 700})
    # 4. into the Borderlands (confirmation too), and the same place asks nothing
    quest("Merge menus").drag_to(pg.get_by_role("button", name="Borderlands", exact=True).first); pg.wait_for_timeout(800)
    print("borderlands asks:", pg.get_by_text("Move the quest").count() == 1)
    pg.screenshot(path=f"{shots}/{scheme}-4-confirm-borderlands.png")
    pg.get_by_role("button", name="Move the quest", exact=True).click(); pg.wait_for_timeout(2500)
    after = sidebar(pg); print("in Borderlands:", "Merge menus" in " ".join(after[after.index("Borderlands"):]))
    quest("Merge menus").drag_to(pg.get_by_role("button", name="Borderlands", exact=True).first); pg.wait_for_timeout(800)
    print("same place asks nothing:", pg.get_by_text("Move the quest").count() == 0)
    # 5. the quest with a side-quest, dragged by its row, keeps its side-quest
    quest("Explore ideas").drag_to(realm("Atlas")); pg.wait_for_timeout(800)
    pg.get_by_role("button", name="Move the quest", exact=True).click(); pg.wait_for_timeout(2500)
    print("explore under Atlas:", under(sidebar(pg), "Atlas", "Explore ideas"))
    pg.screenshot(path=f"{shots}/{scheme}-5-final.png", clip={"x": 0, "y": 0, "width": 420, "height": 700})
    b.close()
