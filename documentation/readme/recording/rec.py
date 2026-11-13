# Usage: python3 rec.py <scene.py> <name>   -- records the page while the scene runs, into frames/<name>/
import sys, os, base64, time, shutil
from playwright.sync_api import sync_playwright
scene, name = sys.argv[1], sys.argv[2]
out = f"/tmp/iskios-demo/frames/{name}"; shutil.rmtree(out, ignore_errors=True); os.makedirs(out)
W, H = 1280, 800
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9377"); pg = b.contexts[0].pages[0]
    cdp = pg.context.new_cdp_session(pg)
    cdp.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": 2, "mobile": False})
    box = lambda: pg.locator("[role=textbox][contenteditable=true]").last
    def typed(text, delay=45):
        for ch in text:
            pg.keyboard.type(ch); pg.wait_for_timeout(delay)
    frames = []
    def on_frame(ev):
        frames.append((time.time(), ev["data"]))
        cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
    cdp.on("Page.screencastFrame", on_frame)
    setup = scene.replace(".py", ".setup.py")
    if os.path.exists(setup): exec(open(setup).read())
    pg.wait_for_timeout(600)
    cdp.send("Page.startScreencast", {"format": "png", "maxWidth": W*2, "maxHeight": H*2, "everyNthFrame": 1})
    pg.wait_for_timeout(700)
    exec(open(scene).read())
    pg.wait_for_timeout(300)
    # keep the final state on screen; a still frame produces no screencast events, so stamp it
    end = time.time()
    cdp.send("Page.stopScreencast")
    pg.screenshot(path=f"{out}/last.png")
    with open(f"{out}/list.txt", "w") as f:
        for i, (t, data) in enumerate(frames):
            path = f"{out}/{i:05d}.png"; open(path, "wb").write(base64.b64decode(data))
            nxt = frames[i+1][0] if i+1 < len(frames) else end
            f.write(f"file '{path}'\nduration {max(nxt - t, 0.01):.3f}\n")
        f.write(f"file '{out}/last.png'\nduration 2.5\nfile '{out}/last.png'\n")
    print(len(frames), "frames", round(end - frames[0][0], 1) if frames else 0, "s")
