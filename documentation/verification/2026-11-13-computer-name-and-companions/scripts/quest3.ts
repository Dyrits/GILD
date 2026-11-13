export default async ({ evaluate, shot, sleep }: any) => {
  // Open the right column if closed
  console.log(await evaluate(`(() => { const b=document.querySelector('[aria-label="Show quest panel"]'); if(b){b.click(); return 'opened';} return 'already or none'; })()`));
  await sleep(1500);
  console.log(await evaluate(`(() => { const t=document.querySelector('[role="tab"]'); return document.querySelectorAll('[role="tab"]').length; })()`));
  await evaluate(`(() => { const t=[...document.querySelectorAll('[role="tab"]')].find(e=>e.textContent.trim()==='Quest'); if(t) t.click(); })()`);
  await sleep(1000);
  await shot("10-quest-tab");
  console.log(await evaluate(`(() => { const t=document.body.innerText; const a=t.indexOf('Harness'); return t.slice(a, a+260).replace(/\\n/g,' | '); })()`));
  console.log(await evaluate(`(() => { const rows=[...document.querySelectorAll('div')].filter(e=>e.children.length>=3 && e.textContent.startsWith('Harness') ); const r=rows.at(-1); return r? r.querySelectorAll('svg').length + ' svgs in the Harness row' : 'NOROW'; })()`));
};
