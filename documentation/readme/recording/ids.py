# Adds the id-dependent demo entries once the quests exist.
import json, sys
ids = json.load(open('/tmp/iskios-demo/ids.json'))
A, B = ids["q1"], ids["q2"]
E = json.load(open('/tmp/iskios-demo/demo.base.json'))
def add(match, reply, lines=None, delay=None):
    e = {"match": match, "reply": reply}
    if lines: e["lines"] = lines
    if delay: e["delay"] = delay
    E.append(e)
msg = lambda to, text: "call send_thread_message " + json.dumps({"to": to, "text": text})
add("Write regression tests for half-cent lines",
"""Added 6 cases to `test/cart.test.ts`: half-cent lines, a 100% discount, zero VAT, and a 40-line cart checked against the invoice fixture.

`bun test`: **8 pass, 0 fail**. Summary sent to the quest.""",
 [msg(A["threadId"], "6 regression cases added to test/cart.test.ts; all 8 tests pass.")], delay=800)
add("6 regression cases added", "The side-quest's 6 cases pass against the fix. Ready for review.")
add("Draft the 2.4 release notes",
"""## Storefront 2.4

**Fixed**
- Checkout totals match invoices to the cent on discounted carts.

**Improved**
- Faster cart page on large carts (38% less render time).
- Clearer message when a coupon has expired.

Saved to the quest journal.""", ["fail claude Claude usage limit reached · resets at 6:00 PM"])
add("is the fix ready",
"""From the journal of **Fix checkout rounding**: the fix is in, 8 tests pass, and the Codex review approved it.

I asked that quest to message me once it is merged.""",
 ["call read_journal " + json.dumps({"mission": A["missionId"]}),
  msg(A["threadId"], "Release 2.4 waits on your fix. Message me once it is merged.")])
add("Release 2.4 waits on your fix",
"Merged as `a3f9c21`. Told Release 2.4.",
 [msg(B["threadId"], "Fix merged as a3f9c21; checkout totals now match invoices.")], delay=600)
add("Fix merged as a3f9c21", "The fix is merged: release notes updated, 2.4 is ready to tag.")
add("Ship the checkout fix",
"Routed to **Fix checkout rounding**.",
 ["call suggest_mission " + json.dumps({"text": "Ship the checkout fix today and tell me what is left for 2.4.", "title": "Ship the checkout fix", "missions": [A["missionId"], B["missionId"]]})])
add("Ship the checkout fix today",
"""Shipped: `a3f9c21` is deployed and checkout totals match invoices.

Left for 2.4: tag the release once **Release 2.4** finishes its notes.""")
first = ('6 regression cases added', 'Release 2.4 waits on your fix', 'Fix merged as a3f9c21', 'Ship the checkout fix today')
E = [e for e in E if e['match'] in first] + [e for e in E if e['match'] not in first]
json.dump(E, open('/tmp/iskios-demo/demo.json', 'w'), indent=1)
print(len(E), "entries")
