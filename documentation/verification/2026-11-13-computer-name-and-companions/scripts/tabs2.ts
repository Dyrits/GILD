const clickRight = (t: string) => `(() => { const els=[...document.querySelectorAll('div,span')].filter(e=>e.children.length===0 && e.textContent.trim()===${JSON.stringify(t)}); els.sort((a,b)=>b.getBoundingClientRect().x-a.getBoundingClientRect().x); const e=els[0]; if(!e) return 'NOTFOUND'; e.click(); return 'ok'; })()`;
const clickText = (t: string, nth = 0) => `(() => { const els=[...document.querySelectorAll('div,span')].filter(e=>e.children.length===0 && e.textContent.trim()===${JSON.stringify(t)}); const e=els[${nth}]; if(!e) return 'NOTFOUND'; e.click(); return 'ok'; })()`;
const tabsText = `JSON.stringify([...document.querySelectorAll('[role="tab"]')].map(t=>t.textContent.trim()+(t.getAttribute('aria-selected')==='true'?'*':'')))`;
export default async ({ evaluate, shot, sleep }: any) => {
  console.log("tab Set:", await evaluate(clickRight("Set a Companion")));
  await sleep(1500);
  await shot("25-tab-heavy-set");
  console.log("page:", await evaluate(`(() => { const t=document.body.innerText; const a=t.indexOf('Heavy'); return t.slice(a, a+300).replace(/\\n/g,' | '); })()`));
  console.log("open quest:", await evaluate(clickText("Hello fake")));
  await sleep(2500);
  console.log("tabs in a quest (before Companions):", await evaluate(tabsText));
  await evaluate(`(() => { const t=[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim()==='Companions'); if(t) t.click(); })()`);
  await sleep(1200);
  await shot("26-quest-companions");
  console.log("tabs in a quest:", await evaluate(tabsText));
  console.log("has Presets tab in a quest:", await evaluate(`[...document.querySelectorAll('[role="tab"]')].some(t=>t.textContent.trim()==='Presets')`));
};
