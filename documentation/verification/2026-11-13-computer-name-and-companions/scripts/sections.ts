const clickText = (t: string, nth = 0) => `(() => { const els=[...document.querySelectorAll('div,span')].filter(e=>e.children.length===0 && e.textContent.trim()===${JSON.stringify(t)}); const e=els[${nth}]; if(!e) return 'NOTFOUND'; e.click(); return 'ok'; })()`;
const probes: Record<string, string[]> = {
  Permissions: ["Permissions", "Computer name"],
  Defaults: ["Look", "Quest upkeep", "Computer name"],
  Providers: ["Computer name", "Harnesses", "Accounts", "Look"],
  Companions: ["Default", "Presets", "Look"],
  "Remote access": ["Remote access · paired devices", "Look"],
  Messaging: ["Send, while work is underway", "Look"],
  Limits: ["Look"],
};
export default async ({ evaluate, shot, sleep, send, logs }: any) => {
  await send("Page.reload");
  await sleep(5000);
  await evaluate(clickText("Workshop"));
  await sleep(2000);
  console.log("menu title Workshop:", await evaluate(`(() => { const t=document.body.innerText; const a=t.indexOf('Workshop', t.indexOf('Workshop')+8); return t.slice(a, a+60).replace(/\\n/g,' | '); })()`));
  for (const [name, texts] of Object.entries(probes)) {
    await evaluate(`(() => { const e=[...document.querySelectorAll('div,span')].filter(e=>e.children.length===0 && e.textContent.trim()===${JSON.stringify(name)}); const m=e.find(x=>(x.getBoundingClientRect().x>320 && x.getBoundingClientRect().x<520)); if(m) m.click(); })()`);
    await sleep(700);
    const found = await evaluate(`JSON.stringify(${JSON.stringify(texts)}.map(t=>[t, [...document.querySelectorAll('div,span')].some(e=>e.children.length===0 && e.textContent.trim()===t && e.getBoundingClientRect().x>540)]))`);
    console.log(name.padEnd(14), found);
  }
  await shot("31-limits");
  console.log("errors besides nested-button:", logs.filter((l: string) => /^(error|exception)/.test(l) && !/nested|descendant/.test(l)).join("\n") || "none");
};
