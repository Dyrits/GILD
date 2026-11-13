const clickText = (t: string, nth = 0) => `(() => { const els=[...document.querySelectorAll('div,span')].filter(e=>e.children.length===0 && e.textContent.trim()===${JSON.stringify(t)}); const e=els[${nth}]; if(!e) return 'NOTFOUND'; e.click(); return 'ok'; })()`;
const rects = `JSON.stringify([...document.querySelectorAll('[role="tab"]')].map(t=>{const r=t.getBoundingClientRect(); return [t.textContent.trim(), Math.round(r.top), Math.round(r.bottom)];}))`;
export default async ({ evaluate, shot, sleep, send }: any) => {
  await send("Page.reload");
  await sleep(5000);
  await evaluate(clickText("Workshop"));
  await sleep(2000);
  await evaluate(clickText("Companions", 1));
  await sleep(1000);
  await evaluate(`[...document.querySelectorAll('[aria-label="Change this Companion in the Companions tab"]')][2].click()`);
  await sleep(1500);
  const r = JSON.parse(await evaluate(rects));
  console.log(JSON.stringify(r));
  const byName = (n: string) => r.find((x: any) => x[0] === n);
  const companions = r[0], def = byName("Default"), light = byName("Light");
  console.log("gap Companions to Default:", def[1] - companions[2], "| gap Default to Light:", light[1] - def[2]);
  await shot("28-tab-gaps");
};
