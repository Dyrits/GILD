# Usage: python3 req.py '<json request>'  -> sends to the service through the page
import sys, json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.connect_over_cdp("http://127.0.0.1:9377"); pg = b.contexts[0].pages[0]
    import time
    for attempt in range(5):
      try:
        pg.wait_for_load_state(); out = pg.evaluate("""async (request) => {
      const endpoint = await window.iskios.endpoint();
      return await new Promise((resolve) => {
        const ws = new WebSocket(endpoint);
        ws.onopen = () => ws.send(JSON.stringify({ id: "demo1", request }));
        ws.onmessage = (e) => { const f = JSON.parse(e.data); if (f.id === "demo1") { ws.close(); resolve(f); } };
        ws.onerror = (e) => resolve({ error: String(e) });
        setTimeout(() => resolve({ timeout: true }), 8000);
      });
    }""", json.loads(sys.argv[1])); break
      except Exception as e:
        print("retry", e.__class__.__name__); time.sleep(2)
    print(json.dumps(out)[:3000])
