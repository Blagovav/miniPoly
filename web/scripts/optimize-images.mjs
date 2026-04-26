#!/usr/bin/env node
/**
 * Convert every PNG under web/public/figma/** to a sibling .webp.
 *
 * The original PNGs stay in place — they act as the fallback for the
 * <picture> tag and as the asset cache key when CSS image-set() falls
 * back. Re-running is idempotent (.webp gets re-written each time).
 *
 * Usage:
 *   node scripts/optimize-images.mjs           # quality 85 (default)
 *   node scripts/optimize-images.mjs --quality 90
 */
import { readdir, stat, readFile, writeFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../public/figma", import.meta.url));
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

console.log(`▶ optimize-images  quality=${QUALITY}  root=${relative(REPO_ROOT, ROOT)}`);
console.log("");

for await (const pngPath of walkPngs(ROOT)) {
  const webpPath = pngPath.replace(/\.png$/i, ".webp");
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
