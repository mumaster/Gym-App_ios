// Copies the tesseract.js worker, WASM core and language data out of
// node_modules into public/tesseract/ so the nutrition-label scanner runs
// fully self-hosted — no runtime dependency on jsdelivr/unpkg, which some
// networks (corporate proxies, ad-blockers, this repo's own CI sandbox) block
// outright. Runs automatically after `npm install` (see package.json).
//
// Languages: keep this in sync with OCR_LANGUAGES in nutritionOcr.ts and the
// @tesseract.js-data/<lang> dependencies in package.json.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public", "tesseract");
const coreDir = join(publicDir, "core");

mkdirSync(coreDir, { recursive: true });

function copy(from, to) {
  if (!existsSync(from)) {
    console.warn(`[setup-ocr-assets] missing ${from} — skipping`);
    return;
  }
  copyFileSync(from, to);
}

copy(join(root, "node_modules/tesseract.js/dist/worker.min.js"), join(publicDir, "worker.min.js"));

// Only the LSTM-only core variants are needed — that's the engine mode the
// app requests (see nutritionOcr worker setup).
for (const name of [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
]) {
  copy(join(root, "node_modules/tesseract.js-core", name), join(coreDir, name));
}

// eng, nld (Dutch), deu (German), fra (French) — see OCR_LANGUAGES in
// nutritionOcr.ts, which is what actually drives which of these get loaded.
for (const lang of ["eng", "nld", "deu", "fra"]) {
  copy(
    join(root, `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),
    join(publicDir, `${lang}.traineddata.gz`),
  );
}

console.log("[setup-ocr-assets] tesseract assets copied to public/tesseract/");
