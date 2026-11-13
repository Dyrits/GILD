const tabsText = `JSON.stringify([...document.querySelectorAll('[role="tab"]')].map(t=>t.textContent.trim()+(t.getAttribute('aria-selected')==='true'?'*':'')))`;
export default async ({ evaluate, shot, sleep }: any) => {
  console.log("composer button:", await evaluate(`(() => { const b=document.querySelector('[aria-label="Companion (model)"]'); if(!b) return 'NOBUTTON'; b.click(); return 'ok'; })()`));
  await sleep(1500);
  console.log("tabs:", await evaluate(tabsText));
  console.log("has Default/Presets:", await evaluate(`[...document.querySelectorAll('[role="tab"]')].some(t=>['Default','Presets'].includes(t.textContent.trim()))`));
  await shot("27-quest-companions-tab");
  console.log("tab text:", await evaluate(`(() => { const t=document.body.innerText; const a=t.lastIndexOf('Companions'); return t.slice(a, a+260).replace(/\\n/g,' | '); })()`));
};
