export default async ({ evaluate, logs, shot, sleep, send }: any) => {
  await send("Page.reload");
  await sleep(25000);
  const out = await evaluate(`JSON.stringify([...document.querySelectorAll('svg circle')].map(c=>({t:c.getAttribute('transform'),o:c.getAttribute('transform-origin')})).filter(c=>c.t||c.o))`);
  console.log("circles:", out);
  console.log("console messages (" + logs.length + "):");
  console.log(logs.filter((l: string) => /transform|Invalid DOM|origin|WebShape/i.test(l)).join("\n") || "(no transform/DOM-property warnings)");
  console.log("all console:\n" + logs.join("\n"));
  await shot(process.argv[4] ?? "warn");
};
