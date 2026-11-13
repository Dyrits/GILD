import json, subprocess
def R(req):
    out = subprocess.run(["python3", "/tmp/iskios-demo/scripts/req.py", json.dumps(req)], capture_output=True, text=True).stdout
    return json.loads(out.strip().splitlines()[-1])
ids = {}
R({"_tag":"CreateRealm","crest":None,"name":"storefront","path":"/tmp/storefront"})
R({"_tag":"CreateRealm","crest":None,"name":"design-system","path":None})
def start(key, text, harness, model, effort, path):
    ids[key] = R({"_tag":"StartMission","attachmentIds":[],"effort":effort,"harness":harness,"model":model,"requestId":key,"text":text,"workspacePath":path})["value"]
start("q3","Propose dark-mode color tokens for the design system.","claude","claude-sonnet-5-5","medium",None)
start("q4","Compare managed Postgres hosts for the shop.","codex","gpt-5.5","medium",None)
start("q2","Prepare the 2.4 release.","claude","claude-sonnet-5-5","high","/tmp/storefront")
start("q1","Checkout totals are off by a cent on some discounted carts. Find the cause.","claude","claude-opus-5-5","high","/tmp/storefront")
json.dump(ids, open("/tmp/iskios-demo/ids.json","w"), indent=1)
print(ids)
