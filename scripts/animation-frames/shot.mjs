import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw;
for (const id of ["playwright", "/opt/node22/lib/node_modules/playwright"]) {
  try {
    pw = require(id);
    break;
  } catch {}
}
const [, , html, out, ...ids] = process.argv;
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
await p.goto("file://" + html);
for (const id of ids) {
  const el = await p.$(`section[id="${id}"]`);
  if (el) await el.screenshot({ path: `${out}/${id}.png` });
}
await b.close();
