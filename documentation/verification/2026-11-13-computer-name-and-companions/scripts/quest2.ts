export default async ({ evaluate, shot, sleep, send }: any) => {
  console.log(await evaluate(`(() => { const e=document.querySelector('[contenteditable="true"],[role="textbox"]'); if(!e) return 'NOEDITOR'; e.focus(); e.click(); return e.tagName+':'+e.getAttribute('contenteditable'); })()`));
  await send("Input.insertText", { text: "Hello fake" });
  await sleep(400);
  console.log(await evaluate(`(() => { const b=document.querySelector('[aria-label="Send"]'); if(!b) return 'NOSEND'; b.click(); return 'sent'; })()`));
  await sleep(5000);
  await shot("09-quest-started");
  console.log(await evaluate(`document.body.innerText.slice(0,900).replace(/\\n/g,' | ')`));
};
