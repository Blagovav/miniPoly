/**
 * Shop catalog persistence — caps (фишки), maps (карты), chests (сундуки)
 * with their drop tables and quantity-tier prices. The frontend used to
 * hardcode this in `web/src/shop/cosmetics.ts`; this module is the new
 * source of truth, exposed read-only via GET /api/shop/catalog and
 * mutated through the admin panel.
 *
 * On first boot the tables are seeded from the original hardcoded values
 * so existing inventories (which reference these ids) keep resolving.
 * The seed is idempotent — caps/maps/chests already in the DB are left
 * untouched on subsequent boots, so admin edits survive restarts.
 */
import { pool } from "./db";

export type Rarity = "common" | "rare" | "epic" | "exotic";

export interface CapRow {
  id: string;
  type: string;        // figurine kind ("plane", "ship", …)
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  starsPrice: number | null;
  chestOnly: boolean;
  imageUrl: string | null;
  sortOrder: number;
}

export interface MapRow {
  id: string;
  type: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  starsPrice: number | null;
  imageUrl: string | null;
  sortOrder: number;
}

export interface ChestPrice { qty: number; stars: number }
export interface ChestDrop  { capId: string; chance: number }

export interface ChestRow {
  id: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  descriptionRu: string | null;
  descriptionEn: string | null;
  artClosed: string | null;
  artOpen: string | null;
  cardArt: string | null;
  setBonusMapId: string | null;
  defaultQtyIdx: number;
  sortOrder: number;
  prices: ChestPrice[];
  drops: ChestDrop[];
}

export async function initShopDb(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shop_caps (
      id           TEXT PRIMARY KEY,
      type         TEXT NOT NULL,
      rarity       TEXT NOT NULL,
      name_ru      TEXT NOT NULL,
      name_en      TEXT NOT NULL,
      stars_price  INT,
      chest_only   BOOLEAN NOT NULL DEFAULT FALSE,
      image_url    TEXT,
      sort_order   INT NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shop_maps (
      id           TEXT PRIMARY KEY,
      type         TEXT NOT NULL,
      rarity       TEXT NOT NULL,
      name_ru      TEXT NOT NULL,
      name_en      TEXT NOT NULL,
      stars_price  INT,
      image_url    TEXT,
      sort_order   INT NOT NULL DEFAULT 0,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shop_chests (
      id                TEXT PRIMARY KEY,
      rarity            TEXT NOT NULL,
      name_ru           TEXT NOT NULL,
      name_en           TEXT NOT NULL,
      description_ru    TEXT,
      description_en    TEXT,
      art_closed        TEXT,
      art_open          TEXT,
      card_art          TEXT,
      set_bonus_map_id  TEXT,
      default_qty_idx   INT NOT NULL DEFAULT 0,
      sort_order        INT NOT NULL DEFAULT 0,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS shop_chest_prices (
      chest_id  TEXT NOT NULL REFERENCES shop_chests(id) ON DELETE CASCADE,
      qty       INT  NOT NULL,
      stars     INT  NOT NULL,
      PRIMARY KEY (chest_id, qty)
    );

    CREATE TABLE IF NOT EXISTS shop_chest_drops (
      chest_id  TEXT NOT NULL REFERENCES shop_chests(id) ON DELETE CASCADE,
      cap_id    TEXT NOT NULL,
      chance    NUMERIC(6, 3) NOT NULL,
      PRIMARY KEY (chest_id, cap_id)
    );
  `);

  // Seed only if completely empty — otherwise admin edits would get
  // overwritten on every restart.
  const { rows: capCount } = await pool.query(`SELECT COUNT(*)::int AS n FROM shop_caps`);
  if (capCount[0].n === 0) {
    await seedDefaults();
  }
}

async function seedDefaults(): Promise<void> {
  // Caps — order preserved via sort_order. Mirrors web/src/shop/cosmetics.ts SHOP_CAPS.
  const caps: Array<[string, string, Rarity, string, string, number | null, boolean]> = [
    ["cap-plane",   "plane",   "common",  "Самолёт",          "Plane",        19,   false],
    ["cap-ship",    "ship",    "rare",    "Лайнер",           "Liner",        null, false],
    ["cap-car",     "car",     "epic",    "Классическое авто", "Classic Car",  null, false],
    ["cap-hat",     "hat",     "exotic",  "Мини-шляпа",       "Top Hat",      null, true ],
    ["cap-cat",     "cat",     "epic",    "Котик",            "Kitty",        null, true ],
    ["cap-dog",     "dog",     "rare",    "Пёс",              "Dog",          null, true ],
    ["cap-ufo",     "ufo",     "epic",    "НЛО",              "UFO",          null, false],
    ["cap-robot",   "robot",   "rare",    "Робот",            "Robot",        39,   false],
    ["cap-balloon", "balloon", "exotic",  "Воздушный шар",    "Balloon",      79,   false],
    ["cap-dyno",    "dyno",    "epic",    "Дино",             "Dyno",         null, false],
    ["cap-duck",    "duck",    "epic",    "Утёнок",           "Duckling",     null, true ],
  ];
  for (let i = 0; i < caps.length; i++) {
    const [id, type, rarity, ru, en, stars, chestOnly] = caps[i];
    await pool.query(
      `INSERT INTO shop_caps (id, type, rarity, name_ru, name_en, stars_price, chest_only, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, type, rarity, ru, en, stars, chestOnly, i],
    );
  }

  const maps: Array<[string, string, Rarity, string, string, number | null]> = [
    ["map-classic",       "classic",       "common", "Классика",            "Classic"],
    ["map-space-station", "space_station", "rare",   "Космическая станция", "Space Station"],
    ["map-mars",          "mars",          "epic",   "Марс",                "Mars"],
    ["map-amsterdam",     "amsterdam",     "rare",   "Амстердам",           "Amsterdam"],
    ["map-london",        "london",        "rare",   "Лондон",              "London"],
    ["map-tokio",         "tokio",         "rare",   "Токио",               "Tokyo"],
  ].map(([id, type, rarity, ru, en], i) => {
    const stars = id === "map-classic" ? null
      : id === "map-space-station" ? 79
      : id === "map-mars" ? 99
      : id === "map-amsterdam" ? 79
      : 19;
    return [id as string, type as string, rarity as Rarity, ru as string, en as string, stars];
  });
  for (let i = 0; i < maps.length; i++) {
    const [id, type, rarity, ru, en, stars] = maps[i];
    await pool.query(
      `INSERT INTO shop_maps (id, type, rarity, name_ru, name_en, stars_price, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, type, rarity, ru, en, stars, i],
    );
  }

  // Chest seed — Бизнес-Сундук.
  await pool.query(
    `INSERT INTO shop_chests
       (id, rarity, name_ru, name_en, description_ru, description_en,
        art_closed, art_open, card_art, set_bonus_map_id, default_qty_idx, sort_order)
     VALUES ($1,'exotic',$2,$3,$4,$5,$6,$7,$8,$9,0,0)`,
    [
      "chest-business",
      "Бизнес-Сундук",
      "Business Chest",
      "Откройте сундук и получите редкую фишку. Соберите все, чтобы получить эксклюзивную карту.",
      "Open the chest to claim a rare token. Collect them all to unlock an exclusive map.",
      "/figma/shop/chests/business-open.webp",
      "/figma/shop/chests/business-closed.webp",
      "/figma/shop/chests/business-preview.webp",
      "map-space-station",
    ],
  );
  for (const [qty, stars] of [[1, 299], [3, 799], [6, 1499]] as const) {
    await pool.query(
      `INSERT INTO shop_chest_prices (chest_id, qty, stars) VALUES ($1, $2, $3)`,
      ["chest-business", qty, stars],
    );
  }
  for (const [capId, chance] of [
    ["cap-cat",  30],
    ["cap-ufo",  25],
    ["cap-dyno", 20],
    ["cap-duck", 15],
    ["cap-hat",  10],
  ] as const) {
    await pool.query(
      `INSERT INTO shop_chest_drops (chest_id, cap_id, chance) VALUES ($1, $2, $3)`,
      ["chest-business", capId, chance],
    );
  }
}

// ───── Reads ──────────────────────────────────────────────────────────

function rowToCap(r: any): CapRow {
  return {
    id: r.id,
    type: r.type,
    rarity: r.rarity,
    nameRu: r.name_ru,
    nameEn: r.name_en,
    starsPrice: r.stars_price == null ? null : Number(r.stars_price),
    chestOnly: !!r.chest_only,
    imageUrl: r.image_url ?? null,
    sortOrder: Number(r.sort_order),
  };
}
function rowToMap(r: any): MapRow {
  return {
    id: r.id,
    type: r.type,
    rarity: r.rarity,
    nameRu: r.name_ru,
    nameEn: r.name_en,
    starsPrice: r.stars_price == null ? null : Number(r.stars_price),
    imageUrl: r.image_url ?? null,
    sortOrder: Number(r.sort_order),
  };
}

export async function listCaps(): Promise<CapRow[]> {
  const { rows } = await pool.query(`SELECT * FROM shop_caps ORDER BY sort_order, id`);
  return rows.map(rowToCap);
}

export async function listMaps(): Promise<MapRow[]> {
  const { rows } = await pool.query(`SELECT * FROM shop_maps ORDER BY sort_order, id`);
  return rows.map(rowToMap);
}

export async function listChests(): Promise<ChestRow[]> {
  const { rows: chests } = await pool.query(`SELECT * FROM shop_chests ORDER BY sort_order, id`);
  if (chests.length === 0) return [];
  const ids = chests.map((c) => c.id);
  const { rows: prices } = await pool.query(
    `SELECT chest_id, qty, stars FROM shop_chest_prices WHERE chest_id = ANY($1) ORDER BY qty`,
    [ids],
  );
  const { rows: drops } = await pool.query(
    `SELECT chest_id, cap_id, chance FROM shop_chest_drops WHERE chest_id = ANY($1) ORDER BY chance DESC`,
    [ids],
  );
  return chests.map((c) => ({
    id: c.id,
    rarity: c.rarity,
    nameRu: c.name_ru,
    nameEn: c.name_en,
    descriptionRu: c.description_ru,
    descriptionEn: c.description_en,
    artClosed: c.art_closed,
    artOpen: c.art_open,
    cardArt: c.card_art,
    setBonusMapId: c.set_bonus_map_id,
    defaultQtyIdx: Number(c.default_qty_idx ?? 0),
    sortOrder: Number(c.sort_order ?? 0),
    prices: prices.filter((p) => p.chest_id === c.id).map((p) => ({ qty: Number(p.qty), stars: Number(p.stars) })),
    drops: drops.filter((d) => d.chest_id === c.id).map((d) => ({ capId: d.cap_id, chance: Number(d.chance) })),
  }));
}

// ───── Writes ─────────────────────────────────────────────────────────

export interface CapInput {
  id: string;
  type: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  starsPrice: number | null;
  chestOnly: boolean;
  imageUrl: string | null;
  sortOrder?: number;
}

export async function upsertCap(input: CapInput): Promise<void> {
  await pool.query(
    `INSERT INTO shop_caps (id, type, rarity, name_ru, name_en, stars_price, chest_only, image_url, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, COALESCE($9, 0))
     ON CONFLICT (id) DO UPDATE SET
       type = EXCLUDED.type,
       rarity = EXCLUDED.rarity,
       name_ru = EXCLUDED.name_ru,
       name_en = EXCLUDED.name_en,
       stars_price = EXCLUDED.stars_price,
       chest_only = EXCLUDED.chest_only,
       image_url = EXCLUDED.image_url,
       sort_order = COALESCE(EXCLUDED.sort_order, shop_caps.sort_order),
       updated_at = NOW()`,
    [
      input.id, input.type, input.rarity, input.nameRu, input.nameEn,
      input.starsPrice, input.chestOnly, input.imageUrl, input.sortOrder ?? null,
    ],
  );
}

export async function deleteCap(id: string): Promise<void> {
  await pool.query(`DELETE FROM shop_caps WHERE id = $1`, [id]);
}

export interface MapInput {
  id: string;
  type: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  starsPrice: number | null;
  imageUrl: string | null;
  sortOrder?: number;
}

export async function upsertMap(input: MapInput): Promise<void> {
  await pool.query(
    `INSERT INTO shop_maps (id, type, rarity, name_ru, name_en, stars_price, image_url, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7, COALESCE($8, 0))
     ON CONFLICT (id) DO UPDATE SET
       type = EXCLUDED.type,
       rarity = EXCLUDED.rarity,
       name_ru = EXCLUDED.name_ru,
       name_en = EXCLUDED.name_en,
       stars_price = EXCLUDED.stars_price,
       image_url = EXCLUDED.image_url,
       sort_order = COALESCE(EXCLUDED.sort_order, shop_maps.sort_order),
       updated_at = NOW()`,
    [input.id, input.type, input.rarity, input.nameRu, input.nameEn, input.starsPrice, input.imageUrl, input.sortOrder ?? null],
  );
}

export async function deleteMap(id: string): Promise<void> {
  await pool.query(`DELETE FROM shop_maps WHERE id = $1`, [id]);
}

export interface ChestInput {
  id: string;
  rarity: Rarity;
  nameRu: string;
  nameEn: string;
  descriptionRu: string | null;
  descriptionEn: string | null;
  artClosed: string | null;
  artOpen: string | null;
  cardArt: string | null;
  setBonusMapId: string | null;
  defaultQtyIdx: number;
  sortOrder?: number;
  prices: ChestPrice[];
  drops: ChestDrop[];
}

/** Upsert chest + replace price/drop tables atomically. */
export async function upsertChest(input: ChestInput): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO shop_chests
         (id, rarity, name_ru, name_en, description_ru, description_en,
          art_closed, art_open, card_art, set_bonus_map_id, default_qty_idx, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, COALESCE($12, 0))
       ON CONFLICT (id) DO UPDATE SET
         rarity = EXCLUDED.rarity,
         name_ru = EXCLUDED.name_ru,
         name_en = EXCLUDED.name_en,
         description_ru = EXCLUDED.description_ru,
         description_en = EXCLUDED.description_en,
         art_closed = EXCLUDED.art_closed,
         art_open = EXCLUDED.art_open,
         card_art = EXCLUDED.card_art,
         set_bonus_map_id = EXCLUDED.set_bonus_map_id,
         default_qty_idx = EXCLUDED.default_qty_idx,
         sort_order = COALESCE(EXCLUDED.sort_order, shop_chests.sort_order),
         updated_at = NOW()`,
      [
        input.id, input.rarity, input.nameRu, input.nameEn,
        input.descriptionRu, input.descriptionEn,
        input.artClosed, input.artOpen, input.cardArt,
        input.setBonusMapId, input.defaultQtyIdx, input.sortOrder ?? null,
      ],
    );
    // Replace prices + drops wholesale — simpler than per-row diff and the
    // tables are tiny (≤10 rows per chest).
    await client.query(`DELETE FROM shop_chest_prices WHERE chest_id = $1`, [input.id]);
    for (const p of input.prices) {
      await client.query(
        `INSERT INTO shop_chest_prices (chest_id, qty, stars) VALUES ($1, $2, $3)`,
        [input.id, p.qty, p.stars],
      );
    }
    await client.query(`DELETE FROM shop_chest_drops WHERE chest_id = $1`, [input.id]);
    for (const d of input.drops) {
      await client.query(
        `INSERT INTO shop_chest_drops (chest_id, cap_id, chance) VALUES ($1, $2, $3)`,
        [input.id, d.capId, d.chance],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function deleteChest(id: string): Promise<void> {
  // ON DELETE CASCADE drops the price/drop child rows.
  await pool.query(`DELETE FROM shop_chests WHERE id = $1`, [id]);
}
