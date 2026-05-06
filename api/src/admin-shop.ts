/**
 * Admin shop CRUD — bearer-token gated endpoints under /admin/shop/*.
 * Auth re-uses the same `authorized()` check as the read-only admin
 * dashboard; an unconfigured ADMIN_TOKEN 404s every endpoint here.
 *
 * Routes:
 *   GET    /admin/shop/catalog          — full catalog (caps + maps + chests)
 *   POST   /admin/shop/caps             — upsert (id in body, idempotent)
 *   DELETE /admin/shop/caps/:id
 *   POST   /admin/shop/maps             — upsert
 *   DELETE /admin/shop/maps/:id
 *   POST   /admin/shop/chests           — upsert (replaces prices + drops atomically)
 *   DELETE /admin/shop/chests/:id
 *   POST   /admin/shop/upload           — multipart image upload (returns absolute URL path)
 *
 * Image uploads land under `<api>/uploads/shop/<id>.<ext>` and are
 * served back via @fastify/static at /api/uploads/* — Caddy proxies
 * `/api/*` to api:3000 so the same URL works on the deployed site.
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { pipeline } from "node:stream/promises";
import { createWriteStream, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { config } from "./config";
import {
  deleteCap, deleteChest, deleteMap,
  listCaps, listChests, listMaps,
  upsertCap, upsertChest, upsertMap,
  type CapInput, type ChestInput, type MapInput, type Rarity,
} from "./shop-db";

const RARITIES: ReadonlySet<Rarity> = new Set(["common", "rare", "epic", "exotic"]);

function authorized(req: FastifyRequest): boolean {
  if (!config.adminToken) return false;
  const header = req.headers.authorization;
  const fromHeader = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const fromQuery = (req.query as Record<string, unknown> | undefined)?.token;
  const provided = typeof fromQuery === "string" ? fromQuery : fromHeader;
  return provided === config.adminToken;
}

function reject(reply: FastifyReply): void {
  reply.code(404).send({ error: "not found" });
}

function badRequest(reply: FastifyReply, msg: string): void {
  reply.code(400).send({ error: msg });
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v : null;
}
function asNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}
function asRarity(v: unknown): Rarity | null {
  return typeof v === "string" && RARITIES.has(v as Rarity) ? (v as Rarity) : null;
}

export const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

function ensureUploadDir(sub: string): string {
  const dir = path.join(UPLOAD_ROOT, sub);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

function safeIdSlug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
}

function extFor(mimetype: string, filename: string): string | null {
  const lower = filename.toLowerCase();
  for (const e of [".webp", ".png", ".jpg", ".jpeg", ".svg", ".gif"]) {
    if (lower.endsWith(e)) return e === ".jpeg" ? ".jpg" : e;
  }
  if (mimetype === "image/webp") return ".webp";
  if (mimetype === "image/png") return ".png";
  if (mimetype === "image/jpeg") return ".jpg";
  if (mimetype === "image/svg+xml") return ".svg";
  if (mimetype === "image/gif") return ".gif";
  return null;
}

export function registerAdminShopRoutes(app: FastifyInstance): void {
  app.get("/admin/shop/catalog", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const [caps, maps, chests] = await Promise.all([listCaps(), listMaps(), listChests()]);
    return { caps, maps, chests };
  });

  // ── Caps ────────────────────────────────────────────────────────────
  app.post<{ Body: Record<string, unknown> }>("/admin/shop/caps", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const b = req.body ?? {};
    const id = asString(b.id);
    const type = asString(b.type);
    const rarity = asRarity(b.rarity);
    const nameRu = asString(b.nameRu);
    const nameEn = asString(b.nameEn);
    if (!id || !type || !rarity || !nameRu || !nameEn) {
      return badRequest(reply, "id, type, rarity, nameRu, nameEn required");
    }
    const input: CapInput = {
      id, type, rarity, nameRu, nameEn,
      starsPrice: asNumber(b.starsPrice),
      chestOnly: asBool(b.chestOnly),
      imageUrl: asString(b.imageUrl),
      sortOrder: asNumber(b.sortOrder) ?? undefined,
    };
    await upsertCap(input);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/admin/shop/caps/:id", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    await deleteCap(req.params.id);
    return { ok: true };
  });

  // ── Maps ────────────────────────────────────────────────────────────
  app.post<{ Body: Record<string, unknown> }>("/admin/shop/maps", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const b = req.body ?? {};
    const id = asString(b.id);
    const type = asString(b.type);
    const rarity = asRarity(b.rarity);
    const nameRu = asString(b.nameRu);
    const nameEn = asString(b.nameEn);
    if (!id || !type || !rarity || !nameRu || !nameEn) {
      return badRequest(reply, "id, type, rarity, nameRu, nameEn required");
    }
    const input: MapInput = {
      id, type, rarity, nameRu, nameEn,
      starsPrice: asNumber(b.starsPrice),
      imageUrl: asString(b.imageUrl),
      sortOrder: asNumber(b.sortOrder) ?? undefined,
    };
    await upsertMap(input);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/admin/shop/maps/:id", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    await deleteMap(req.params.id);
    return { ok: true };
  });

  // ── Chests ──────────────────────────────────────────────────────────
  app.post<{ Body: Record<string, unknown> }>("/admin/shop/chests", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    const b = req.body ?? {};
    const id = asString(b.id);
    const rarity = asRarity(b.rarity);
    const nameRu = asString(b.nameRu);
    const nameEn = asString(b.nameEn);
    if (!id || !rarity || !nameRu || !nameEn) {
      return badRequest(reply, "id, rarity, nameRu, nameEn required");
    }
    // prices/drops come as arrays of plain objects
    const prices = Array.isArray(b.prices)
      ? (b.prices as unknown[])
          .map((p) => p as Record<string, unknown>)
          .map((p) => ({ qty: Number(p.qty), stars: Number(p.stars) }))
          .filter((p) => Number.isFinite(p.qty) && p.qty > 0 && Number.isFinite(p.stars) && p.stars > 0)
      : [];
    const drops = Array.isArray(b.drops)
      ? (b.drops as unknown[])
          .map((d) => d as Record<string, unknown>)
          .map((d) => ({ capId: String(d.capId ?? ""), chance: Number(d.chance) }))
          .filter((d) => d.capId && Number.isFinite(d.chance) && d.chance > 0)
      : [];
    if (drops.length > 0) {
      const sum = drops.reduce((n, d) => n + d.chance, 0);
      if (sum > 100.0001) {
        return badRequest(reply, `drop chances sum to ${sum.toFixed(2)} (must be ≤ 100)`);
      }
    }
    const input: ChestInput = {
      id, rarity, nameRu, nameEn,
      descriptionRu: asString(b.descriptionRu),
      descriptionEn: asString(b.descriptionEn),
      artClosed: asString(b.artClosed),
      artOpen: asString(b.artOpen),
      cardArt: asString(b.cardArt),
      setBonusMapId: asString(b.setBonusMapId),
      defaultQtyIdx: Math.max(0, asNumber(b.defaultQtyIdx) ?? 0),
      sortOrder: asNumber(b.sortOrder) ?? undefined,
      prices,
      drops,
    };
    await upsertChest(input);
    return { ok: true };
  });

  app.delete<{ Params: { id: string } }>("/admin/shop/chests/:id", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    await deleteChest(req.params.id);
    return { ok: true };
  });

  // ── Upload ──────────────────────────────────────────────────────────
  // Multipart: a single field "file" (image), plus optional "kind"
  // ("caps" | "maps" | "chests") and "id" used to name the saved file.
  // Returns { url } where url is `/api/uploads/shop/<sub>/<file>`.
  app.post("/admin/shop/upload", async (req, reply) => {
    if (!authorized(req)) return reject(reply);
    // Type-cast for the @fastify/multipart-decorated request.
    const mp = req as FastifyRequest & {
      isMultipart?: () => boolean;
      file: () => Promise<{
        file: NodeJS.ReadableStream;
        filename: string;
        mimetype: string;
        fields: Record<string, { value: string }>;
      } | undefined>;
    };
    if (typeof mp.isMultipart !== "function" || !mp.isMultipart()) {
      return badRequest(reply, "expected multipart/form-data");
    }
    const data = await mp.file();
    if (!data) return badRequest(reply, "missing file part");
    const ext = extFor(data.mimetype, data.filename);
    if (!ext) return badRequest(reply, "unsupported image type");
    // `fields` typing in @fastify/multipart is a union (Multipart |
    // Multipart[]); for the simple single-value text fields we send
    // from the admin form, the runtime shape is { value: string }.
    // The cast keeps the route honest about that without juggling the
    // discriminated-union narrowing.
    const fields = (data.fields || {}) as Record<string, { value?: unknown }>;
    const kindRaw = String(fields.kind?.value ?? "");
    const kind: "caps" | "maps" | "chests" =
      kindRaw === "maps" || kindRaw === "chests" ? kindRaw : "caps";
    const idRaw = String(fields.id?.value ?? "");
    const slug = safeIdSlug(idRaw) || `upload-${Date.now()}`;
    // Optional suffix for chests that have multiple images per item
    // (closed / open / cardArt). Kept short and slug-safe.
    const suffixRaw = String(fields.suffix?.value ?? "");
    const suffix = safeIdSlug(suffixRaw);
    const filename = suffix ? `${slug}-${suffix}${ext}` : `${slug}${ext}`;
    const dir = ensureUploadDir(`shop/${kind}`);
    const fullPath = path.join(dir, filename);
    try {
      await pipeline(data.file, createWriteStream(fullPath));
    } catch (err) {
      reply.code(500).send({ error: String(err) });
      return;
    }
    return { ok: true, url: `/api/uploads/shop/${kind}/${filename}` };
  });
}
