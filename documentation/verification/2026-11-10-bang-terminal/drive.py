"""Drive one isolated Electron preview with a fake harness and disposable data; always close it afterward.

Usage: python3 drive.py <repository> <exported-web-folder> <artifacts-folder>
Needs: Python Playwright, the desktop build, and an Expo web export.
"""
import functools
import http.server
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import threading
import time
from playwright.sync_api import sync_playwright

repository, web, artifacts = map(lambda value: Path(value).resolve(), sys.argv[1:4])
artifacts.mkdir(parents=True, exist_ok=True)

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(web)))
threading.Thread(target=server.serve_forever, daemon=True).start()
with socket.socket() as listener:
    listener.bind(("127.0.0.1", 0))
    debug_port = listener.getsockname()[1]

with tempfile.TemporaryDirectory(prefix="gild-terminal-drive-") as data:
    environment = dict(os.environ)
    environment.pop("ELECTRON_RUN_AS_NODE", None)
    environment.update(GILD_DATA_DIR=data, GILD_HARNESS="fake", GILD_APP_URL=f"http://127.0.0.1:{server.server_port}")
    with (artifacts / "electron.log").open("w") as log:
        process = subprocess.Popen([str(repository / "node_modules/.bin/electron"), f"--remote-debugging-port={debug_port}", "dist/main.js"], cwd=repository / "apps/desktop", env=environment, stdout=log, stderr=log)
        try:
            with sync_playwright() as playwright:
                browser = None
                for _ in range(100):
                    if process.poll() is not None:
                        raise RuntimeError("Electron exited; inspect electron.log")
                    try:
                        browser = playwright.chromium.connect_over_cdp(f"http://127.0.0.1:{debug_port}", timeout=1000)
                        break
                    except Exception:
                        time.sleep(0.1)
                if browser is None:
                    raise RuntimeError("Electron did not expose its test connection")
                context = browser.contexts[0]
                page = context.pages[0] if context.pages else context.wait_for_event("page")
                def wait(expression, **kwargs):
                    return page.wait_for_function(expression, polling=100, **kwargs)
                failures = []
                page.on("pageerror", lambda error: failures.append(str(error)))
                wait("typeof window.gild?.endpoint === 'function'")
                page.wait_for_selector('[contenteditable="true"]')
                print(json.dumps({"initial": page.locator("body").inner_text()}), flush=True)
                page.evaluate("""() => { window.gildTestRequest = async (request) => {
                  const endpoint = await window.gild.endpoint();
                  return new Promise((resolve,reject) => {
                    const socket = new WebSocket(endpoint);
                    socket.onopen=()=>socket.send(JSON.stringify({id:'check',request}));
                    socket.onmessage=event=>{const frame=JSON.parse(event.data);if(frame.id==='check'){socket.close();frame._tag==='Failure'?reject(new Error(JSON.stringify(frame))):resolve(frame.value);}};
                    socket.onerror=()=>reject(new Error('Test service connection failed'));
                  });
                }; }""")
                editor = page.locator('[contenteditable="true"]').last
                editor.fill("Ordinary text")
                editor.press("End")
                editor.press("!")
                print(json.dumps({"ordinary_text": editor.inner_text()}), flush=True)
                assert editor.inner_text().strip() == "Ordinary text!"
                assert page.locator('.xterm-helper-textarea').count() == 0
                editor.fill("Keep this first line")
                editor.press("Shift+Enter")
                editor.press("!")
                page.wait_for_selector('.xterm-helper-textarea')
                terminal = page.locator('.xterm-helper-textarea')
                terminal.wait_for(state="visible")
                editor.fill("")
                terminal.press_sequentially("printf 'GILD_TERMINAL_SMOKE=%s\\n' \"$PWD\"")
                terminal.press("Enter")
                wait("document.querySelector('.xterm-rows')?.textContent.includes('GILD_TERMINAL_SMOKE=')")
                print(json.dumps({"terminal": page.locator('.xterm-rows').inner_text()}), flush=True)
                assert "Echo:" not in page.locator("body").inner_text()
                page.screenshot(path=str(artifacts / "01-terminal.png"))
                page.get_by_text("Hide", exact=True).click()
                page.get_by_text("Show", exact=True).click()
                terminal.wait_for(state="visible")
                assert "GILD_TERMINAL_SMOKE=" in page.locator('.xterm-rows').inner_text()
                page.get_by_label("Send", exact=True).click()
                wait("document.body.innerText.includes('Terminal snapshot (owner')")
                wait("document.body.innerText.includes('Echo:')")
                page.screenshot(path=str(artifacts / "02-sent-context.png"))
                print(json.dumps({"sent": page.locator('body').inner_text(), "errors": failures}), flush=True)
                assert not failures, failures
                realm = Path(data).resolve() / "realm"
                realm.mkdir()
                seeded = page.evaluate("""async (realm) => {
                  const endpoint = await window.gild.endpoint();
                  return await new Promise((resolve, reject) => {
                    const socket = new WebSocket(endpoint);
                    socket.onopen = () => socket.send(JSON.stringify({id:'seed',request:{_tag:'StartMission',effort:'default',model:'default',harness:'claude',requestId:crypto.randomUUID(),text:'Terminal realm probe',workspacePath:realm}}));
                    socket.onmessage = (event) => {const frame=JSON.parse(event.data); if(frame.id==='seed'){socket.close();frame._tag==='Failure'?reject(new Error(JSON.stringify(frame))):resolve(frame.value);}};
                    socket.onerror = () => reject(new Error('Cannot seed throwaway quest'));
                  });
                }""", str(realm))
                print(json.dumps({"seed": seeded}), flush=True)
                page.get_by_text("Terminal realm probe", exact=True).first.click()
                editor = page.locator('[contenteditable="true"]').last
                editor.wait_for(state="visible")
                editor.press("!")
                terminal = page.locator('.xterm-helper-textarea')
                terminal.wait_for(state="visible")
                wait("/[>$%#]/.test(document.querySelector('.xterm-rows')?.textContent || '')")
                terminal.press_sequentially("printf 'REALM_ROOT=%s\\n' \"$PWD\"")
                terminal.press("Enter")
                print(json.dumps({"realm_terminal_before_wait": page.locator('.xterm-rows').inner_text(), "expected": str(realm)}), flush=True)
                try:
                    wait("""async ({realm, id}) => (await window.gild.terminalOpen(id + ':' + realm, realm)).output.includes('REALM_ROOT=' + realm)""", arg={"realm":str(realm), "id":seeded["threadId"]})
                except Exception:
                    print(json.dumps({"failed_body": page.locator("body").inner_text(), "errors": failures}), flush=True)
                    print(page.evaluate("""async ({realm, id}) => await window.gild.terminalOpen(id + ':' + realm, realm)""", {"realm":str(realm),"id":seeded["threadId"]}), flush=True)
                    raise
                page.screenshot(path=str(artifacts / "03-realm-terminal.png"))
                page.get_by_label("Send", exact=True).click()
                wait("""async ({realm, missionId}) => (await window.gildTestRequest({_tag:'ReadMission', missionId, threadId:null})).messages.some(message => message.sender==='agent' && message.text.includes('REALM_ROOT=' + realm))""", arg={"realm":str(realm),"missionId":seeded["missionId"]})
                editor.click()
                editor.press("!")
                terminal.wait_for(state="visible")
                terminal.press_sequentially("exit")
                terminal.press("Enter")
                page.get_by_text("Shell exited", exact=True).wait_for()
                page.get_by_text("New shell", exact=True).click()
                page.get_by_text("Shell exited", exact=True).wait_for(state="hidden")
                assert not failures, failures
                print(json.dumps({"realm_and_restart": "passed", "errors": failures}), flush=True)
                browser.close()
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()
            server.shutdown()
