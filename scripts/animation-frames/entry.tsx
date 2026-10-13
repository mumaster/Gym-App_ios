import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";
import { depthAt } from "../../src/lib/gym/exerciseAnimation";
import { EXERCISE_ANIMATIONS } from "../../src/lib/gym/exerciseAnimations";
import { FigureFront, FigureSide } from "../../src/components/gym/ExerciseFigureScene";

const [, , outHtml, ...ids] = process.argv;
const KEY = [0, 0.3, 0.45, 0.7, 0.9];
const STRIP = Array.from({ length: 12 }, (_, i) => i / 12);
const svg = (inner: string, label: string, w = 320) =>
  `<figure><svg viewBox="0 0 320 206" width="${w}" height="${(w * 206) / 320}" style="outline:1px solid #333">${inner}</svg><figcaption>${label}</figcaption></figure>`;
let html = `<html><head><style>
body{background:#111;color:#ccc;font:12px sans-serif;margin:8px}
figure{display:inline-block;margin:2px}figcaption{text-align:center}
h2{margin:6px 0;color:#fff}
.stroke-none{stroke:none}
.stroke-foreground{stroke:#f2f2f2}.fill-foreground{fill:#f2f2f2}
.stroke-primary{stroke:#ef4444}.fill-primary{fill:#ef4444}
${[12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60].map((n) => `.stroke-foreground\\/${n}{stroke:rgba(242,242,242,${n / 100})}.fill-foreground\\/${n}{fill:rgba(242,242,242,${n / 100})}.stroke-primary\\/${n}{stroke:rgba(239,68,68,${n / 100})}.fill-primary\\/${n}{fill:rgba(239,68,68,${n / 100})}`).join("\n")}
</style></head><body>`;
for (const id of ids) {
  const spec = EXERCISE_ANIMATIONS[id];
  if (!spec?.figure) {
    html += `<h2>${id}: no figure</h2>`;
    continue;
  }
  const m = spec.figure;
  html += `<section id="${id}"><h2>${id}</h2><div>`;
  for (const t of KEY)
    html += svg(
      renderToStaticMarkup(h(FigureFront, { model: m, pose: m.pose(depthAt(t)) })),
      `front ${Math.round(t * 1000)}`,
      300,
    );
  html += `</div><div>`;
  for (const t of KEY)
    html += svg(
      renderToStaticMarkup(h(FigureSide, { model: m, pose: m.pose(depthAt(t)) })),
      `side ${Math.round(t * 1000)}`,
      300,
    );
  html += `</div><div>`;
  for (const t of STRIP)
    html += svg(
      renderToStaticMarkup(h(FigureSide, { model: m, pose: m.pose(depthAt(t)) })),
      `${Math.round(t * 1000)}`,
      124,
    );
  html += `</div></section>`;
}
writeFileSync(outHtml, html + "</body></html>");
