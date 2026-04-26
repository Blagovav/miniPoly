#!/usr/bin/env node
/**
 * Convert every PNG under web/figma-src/** to a .webp inside
 * web/public/figma/, preserving the directory layout.
 *
 * `figma-src/` is the committed source-of-truth for designer-supplied
 * PNGs — never served, only used as input. `public/figma/` ships the
 * compressed WebP outputs that the app actually loads. Re-running is
 * idempotent (every .webp gets rewritten).
 *
 * If the designer adds a new PNG: drop it into `web/figma-src/<dir>/`,
 * run `npm run optimize-images`, commit both. To regenerate everything
 * at a different quality, run with `--quality 90` (default 85).
 */
import { readdir, stat, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, extname, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SRC_ROOT = fileURLToPath(new URL("../figma-src", import.meta.url));
const OUT_ROOT = fileURLToPath(new URL("../public/figma", import.meta.url));
const REPO_ROOT = fileURLToPath(new URL("..", import.meta.url));

const argQ = process.argv.indexOf("--quality");
const QUALITY = argQ >= 0 ? Number(process.argv[argQ + 1]) : 85;

/** Recursively yield every .png path under `dir`. */
async function* walkPngs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkPngs(p);
    } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".png") {
      yield p;
    }
  }
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

let totalIn = 0;
let totalOut = 0;
let count = 0;

console.log(
  `▶ optimize-images  quality=${QUALITY}  ` +
  `${relative(REPO_ROOT, SRC_ROOT)} → ${relative(REPO_ROOT, OUT_ROOT)}`,
);
console.log("");

for await (const pngPath of walkPngs(SRC_ROOT)) {
  // Mirror the relative path under OUT_ROOT, swapping .png → .webp.
  const relSrc = relative(SRC_ROOT, pngPath);
  const webpPath = join(OUT_ROOT, relSrc).replace(/\.png$/i, ".webp");

  await mkdir(dirname(webpPath), { recursive: true });

  const inBuf = await readFile(pngPath);
  const inStat = await stat(pngPath);

  const outBuf = await sharp(inBuf)
    .webp({ quality: QUALITY, effort: 6 })
    .toBuffer();

  await writeFile(webpPath, outBuf);

  const rel = relative(REPO_ROOT, pngPath);
  const ratio = ((1 - outBuf.length / inStat.size) * 100).toFixed(0);
  console.log(
    `  ${rel.padEnd(48)}  ${fmtBytes(inStat.size).padStart(9)} → ${fmtBytes(outBuf.length).padStart(9)}  (-${ratio}%)`,
  );

  totalIn += inStat.size;
  totalOut += outBuf.length;
  count += 1;
}

console.log("");
console.log(
  `✔ ${count} files  total ${fmtBytes(totalIn)} → ${fmtBytes(totalOut)}  ` +
  `(saved ${fmtBytes(totalIn - totalOut)}, -${(((totalIn - totalOut) / totalIn) * 100).toFixed(0)}%)`,
);
