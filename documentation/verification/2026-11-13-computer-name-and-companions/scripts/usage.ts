const clickText = (t: string, nth = 0) => `(() => { const els=[...document.querySelectorAll('div,span')].filter(e=>e.children.length===0 && e.textContent.trim()===${JSON.stringify(t)}); const e=els[${nth}]; if(!e) return 'NOTFOUND'; e.click(); return 'ok'; })()`;
export default async ({ evaluate, shot, sleep }: any) => {
  console.log("reserves", await evaluate(clickText("Reserves")));
  await sleep(2000);
  console.log("account tab", await evaluate(clickText("Account")));
  await sleep(1500);
  await shot("11-usage-accounts");
  console.log(await evaluate(`document.body.innerText.slice(0,1100).replace(/\\n/g,' | ')`));
};
