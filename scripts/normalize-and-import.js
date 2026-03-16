#!/usr/bin/env node
/**
 * CostMini Unified Data Pipeline
 *
 * Reads all harvested JSONL files, normalizes to unified schema,
 * deduplicates, and imports into SQLite database.
 *
 * Usage:
 *   node scripts/normalize-and-import.js                # Full pipeline
 *   node scripts/normalize-and-import.js --stats        # Show stats only
 *   node scripts/normalize-and-import.js --dry-run      # Normalize without DB writes
 *   node scripts/normalize-and-import.js --fresh        # Wipe DB and reimport
 *   node scripts/normalize-and-import.js --limit 1000   # Import first 1000 products
 */

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const Database = require("better-sqlite3");

const DATA_DIR = path.join(__dirname, "..", "data", "harvested");
const DB_PATH = path.join(__dirname, "..", "dev.db");

// ─── Salt aliases (from composition-matcher.ts) ─────────────────────────────

const SALT_ALIASES = {
  "acetaminophen": "paracetamol",
  "paracetamol / acetaminophen": "paracetamol",
  "amoxycillin / amoxicillin": "amoxicillin",
  "amoxycillin": "amoxicillin",
  "dicycloverine / dicyclomine": "dicyclomine",
  "dicycloverine": "dicyclomine",
  "vitamin d3 / cholecalciferol": "cholecalciferol",
  "vitamin d3": "cholecalciferol",
  "levosalbutamol / levalbuterol": "levalbuterol",
  "dextromethorphan / dextromethorphan hydrobromide": "dextromethorphan",
  "methylcobalamin / mecobalamin": "methylcobalamin",
  "clopidogrel / clopidogrel bisulphate": "clopidogrel",
  "chlorthalidone / chlortalidone": "chlorthalidone",
};

// ─── Composition parsing ────────────────────────────────────────────────────

function normalizeSalt(salt) {
  let s = salt.toLowerCase().trim();
  s = s.replace(/\s*(hydrochloride|hcl|dihydrate|monohydrate|sodium|potassium|calcium|besylate|maleate|fumarate|succinate|tartrate|mesylate|tosylate|acetate|phosphate|sulphate|sulfate|nitrate|citrate|bromide|iodide)\s*/g, " ").trim();
  return SALT_ALIASES[s] || s;
}

function parseStrength(str) {
  const match = str.match(/([\d.]+)\s*(mg|g|ml|mcg|iu|%\s*w\/v|%\s*w\/w|%|units?)/i);
  if (!match) return null;
  return { value: parseFloat(match[1]), unit: match[2].toLowerCase().replace(/\s+/g, "") };
}

function parseComposition(composition) {
  if (!composition || composition === "Unknown" || composition === "NA") {
    return { components: [], compositionKey: "", displayName: "", primarySalt: "" };
  }
  // Ensure string
  const comp = typeof composition === "string" ? composition : String(composition);

  const parts = comp.split(/\s*\+\s*/);
  const components = [];

  for (const part of parts) {
    let salt = "", strengthStr = "", value = 0, unit = "mg";

    const bracketMatch = part.match(/^(.+?)\s*\(([\d.]+\s*\w+(?:\/\w+)?)\)/);
    if (bracketMatch) {
      salt = bracketMatch[1].trim();
      strengthStr = bracketMatch[2].trim();
    } else {
      const spaceMatch = part.match(/^(.+?)\s+([\d.]+\s*(?:mg|g|ml|mcg|iu|%|units?))/i);
      if (spaceMatch) {
        salt = spaceMatch[1].trim();
        strengthStr = spaceMatch[2].trim();
      } else {
        salt = part.trim();
      }
    }

    if (!salt) continue;
    // Remove trailing " / SOMETHING" patterns (alternate names)
    salt = salt.replace(/\s*\/\s*\w.*$/, "").trim();

    const parsed = parseStrength(strengthStr);
    if (parsed) {
      value = parsed.value;
      unit = parsed.unit;
      strengthStr = `${parsed.value}${parsed.unit}`;
    }

    components.push({ salt: normalizeSalt(salt), rawSalt: salt, strength: strengthStr, value, unit });
  }

  const sorted = [...components].sort((a, b) => a.salt.localeCompare(b.salt));
  const compositionKey = sorted.map(c => `${c.salt}-${c.strength}`).join("+").toLowerCase().replace(/[^a-z0-9+\-.]/g, "");
  const displayName = components.map(c => {
    const name = c.rawSalt.split("/")[0].trim();
    const capName = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
    return c.strength ? `${capName} ${c.strength.toUpperCase()}` : capName;
  }).join(" + ");
  const primarySalt = components[0]?.salt || "";

  return { components, compositionKey, displayName, primarySalt };
}

function normalizeDosageForm(form, name) {
  const f = (form || "").toUpperCase();
  const n = (name || "").toUpperCase();
  const combined = f + " " + n;

  if (/\bTABLET\b|\bTAB\b/.test(combined)) return "tablet";
  if (/\bCAPSULE\b|\bCAP\b/.test(combined)) return "capsule";
  if (/\bSYRUP\b/.test(combined)) return "syrup";
  if (/\bINJECTION\b|\bINJ\b/.test(combined)) return "injection";
  if (/\bCREAM\b/.test(combined)) return "cream";
  if (/\bOINTMENT\b/.test(combined)) return "ointment";
  if (/\bGEL\b/.test(combined)) return "gel";
  if (/\bDROP\b/.test(combined)) return "drops";
  if (/\bSUSPENSION\b|\bSUSP\b/.test(combined)) return "suspension";
  if (/\bINHALER\b/.test(combined)) return "inhaler";
  if (/\bSPRAY\b/.test(combined)) return "spray";
  if (/\bPOWDER\b|\bSACHET\b/.test(combined)) return "powder";
  if (/\bLOTION\b/.test(combined)) return "lotion";
  if (/\bSOLUTION\b|\bSOLN\b/.test(combined)) return "solution";
  if (/\bSTRIP\b/.test(combined)) return "tablet";
  if (/\bLOZENGE\b/.test(combined)) return "lozenge";
  if (/\bSOAP\b/.test(combined)) return "soap";
  if (/\bSHAMPOO\b/.test(combined)) return "shampoo";
  return "other";
}

// ─── Category inference ─────────────────────────────────────────────────────

function inferCategory(therapy, composition, name, category) {
  const t = String(therapy || category || "").toUpperCase();
  const c = String(composition || "").toUpperCase();
  const n = String(name || "").toUpperCase();

  if (t.includes("ANTI-DIABETIC") || t.includes("DIABETES")) return "Diabetes";
  if (t.includes("ANTI-HYPERTENSIVE") || t.includes("CARDIAC") || t.includes("CARDIOVASCULAR")) return "Heart & BP";
  if (t.includes("ANTIBIOTIC") || t.includes("ANTI-INFECTIVE")) return "Antibiotics";
  if (t.includes("ANALGESIC") || t.includes("ANTI-INFLAMMATORY") || t.includes("NSAID")) return "Pain Relief";
  if (t.includes("ANTACID") || t.includes("GASTRO") || t.includes("PPI") || t.includes("ANTI-EMETIC")) return "Gastro";
  if (t.includes("RESPIRATORY") || t.includes("ANTI-ASTHMA") || t.includes("COLD") || t.includes("COUGH")) return "Respiratory";
  if (t.includes("PSYCHIATRIC") || t.includes("NEURO") || t.includes("ANTI-DEPRESSANT") || t.includes("ANXIOLYTIC")) return "Mental Health";
  if (t.includes("DERMAT") || t.includes("SKIN")) return "Skin Care";
  if (t.includes("VITAMIN") || t.includes("SUPPLEMENT") || t.includes("NUTRACEUTICAL")) return "Vitamins";
  if (t.includes("THYROID")) return "Thyroid";
  if (t.includes("OPHTHAL") || t.includes("EYE")) return "Eye Care";
  if (t.includes("ANTI-ALLERG") || t.includes("ANTIHISTAMINE")) return "Anti-Allergic";
  if (t.includes("HORMONAL") || t.includes("GYNAEC")) return "Women's Health";
  if (t.includes("HEPATO") || t.includes("LIVER")) return "Liver Care";
  if (t.includes("ONCOLOG") || t.includes("ANTI-CANCER")) return "Oncology";
  if (t.includes("ANTI-EPILEPTIC") || t.includes("ANTICONVULSANT")) return "Neurology";
  if (t.includes("ANTI-FUNGAL")) return "Anti-Fungal";
  if (t.includes("UROLOGY") || t.includes("KIDNEY")) return "Kidney Care";
  if (t.includes("ANTI-VIRAL")) return "Anti-Viral";

  // Composition-based fallback
  if (c.includes("PARACETAMOL") || c.includes("IBUPROFEN") || c.includes("DICLOFENAC") || c.includes("ACECLOFENAC")) return "Pain Relief";
  if (c.includes("AMOXICILLIN") || c.includes("AZITHROMYCIN") || c.includes("CEFIXIME") || c.includes("CIPROFLOXACIN") || c.includes("LEVOFLOXACIN")) return "Antibiotics";
  if (c.includes("METFORMIN") || c.includes("GLIMEPIRIDE") || c.includes("INSULIN") || c.includes("SITAGLIPTIN")) return "Diabetes";
  if (c.includes("AMLODIPINE") || c.includes("TELMISARTAN") || c.includes("ATORVASTATIN") || c.includes("LOSARTAN") || c.includes("RAMIPRIL")) return "Heart & BP";
  if (c.includes("OMEPRAZOLE") || c.includes("PANTOPRAZOLE") || c.includes("RABEPRAZOLE") || c.includes("DOMPERIDONE")) return "Gastro";
  if (c.includes("CETIRIZINE") || c.includes("MONTELUKAST") || c.includes("SALBUTAMOL") || c.includes("LEVOCETIRI")) return "Respiratory";
  if (c.includes("ESCITALOPRAM") || c.includes("FLUOXETINE") || c.includes("SERTRALINE") || c.includes("CLONAZEPAM")) return "Mental Health";
  if (c.includes("VITAMIN") || c.includes("CALCIUM") || c.includes("FOLIC ACID") || c.includes("ZINC") || c.includes("IRON")) return "Vitamins";
  if (c.includes("LEVOTHYROXINE")) return "Thyroid";
  if (c.includes("KETOCONAZOLE") || c.includes("FLUCONAZOLE") || c.includes("CLOTRIMAZOLE")) return "Anti-Fungal";

  if (n.includes("CREAM") || n.includes("OINTMENT") || n.includes("LOTION")) return "Skin Care";
  if (n.includes("SHAMPOO")) return "Hair Care";

  return "Others";
}

// ─── Manufacturer normalization ─────────────────────────────────────────────

function normalizeManufacturer(mfr) {
  if (!mfr || mfr === "Unknown" || mfr === "NA") return "";
  // Title case, trim
  return mfr.trim().replace(/\s+/g, " ");
}

// ─── Slug generation ────────────────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").substring(0, 200);
}

function cuid() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// ─── JSONL Reader ───────────────────────────────────────────────────────────

async function readJsonl(filePath) {
  const products = [];
  if (!fs.existsSync(filePath)) return products;

  const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      products.push(JSON.parse(line));
    } catch { /* skip bad lines */ }
  }
  return products;
}

// ─── Source-specific normalizers ────────────────────────────────────────────

function normalize1mg(p) {
  return {
    name: p.name || "",
    slug: slugify(p.name || ""),
    composition: p.composition || "",
    manufacturer: normalizeManufacturer(p.manufacturer),
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.sellingPrice) || 0,
    packSize: p.packInfo || "",
    dosageForm: "",  // inferred later
    rxRequired: !!p.rxRequired,
    inStock: p.inStock !== false,
    sourceUrl: p.url || "",
    source: "1mg",
    therapy: "",
    category: "",
    brand: "",
  };
}

function normalizeApollo(p) {
  return {
    name: p.name || "",
    slug: slugify(p.name || ""),
    composition: p.composition || p.searchSalt || "",
    manufacturer: normalizeManufacturer(p.brand || ""),  // Apollo only has brand
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.sellingPrice) || 0,
    packSize: p.unitSize || "",
    dosageForm: "",
    rxRequired: !!p.isPrescription,
    inStock: p.inStock !== false,
    sourceUrl: p.urlKey ? `https://www.apollopharmacy.in/otc/${p.urlKey}` : "",
    source: "Apollo",
    therapy: "",
    category: p.subCategory || "",
    brand: p.brand || "",
  };
}

function normalizeNetmeds(p) {
  return {
    name: p.name || "",
    slug: slugify(p.name || ""),
    composition: p.composition || "",
    manufacturer: normalizeManufacturer(p.manufacturer),
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.sellingPrice) || 0,
    packSize: "",
    dosageForm: "",
    rxRequired: !!p.rxRequired,
    inStock: p.inStock !== false,
    sourceUrl: p.url || "",
    source: "Netmeds",
    therapy: "",
    category: p.categoryL2 || p.category || "",
    brand: p.brand || "",
  };
}

function normalizePharmeasy(p) {
  return {
    name: p.name || "",
    slug: slugify(p.name || ""),
    composition: p.composition || p.molecule || p.genericName || "",
    manufacturer: normalizeManufacturer(p.manufacturer),
    mrp: parseFloat(p.mrp) || parseFloat(p.costPrice) || 0,
    sellingPrice: parseFloat(p.sellingPrice) || parseFloat(p.salePrice) || 0,
    packSize: p.packSize || p.measurementUnit || "",
    dosageForm: p.dosageForm || "",
    rxRequired: !!p.rxRequired || !!p.isRxRequired,
    inStock: p.inStock !== false && p.isAvailable !== false,
    sourceUrl: p.url || p.sourceUrl || "",
    source: "PharmEasy",
    therapy: p.therapy || "",
    category: p.category || "",
    brand: p.brand || p.consumerBrandName || "",
  };
}

function normalizeTruemeds(p) {
  return {
    name: p.name || "",
    slug: slugify(p.name || ""),
    composition: p.composition || "",
    manufacturer: normalizeManufacturer(p.manufacturer),
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.sellingPrice) || 0,
    packSize: p.packSize || "",
    dosageForm: "",
    rxRequired: !!p.rxRequired,
    inStock: p.inStock !== false,
    sourceUrl: p.url || "",
    source: "Truemeds",
    therapy: "",
    category: "",
    brand: "",
  };
}

// ─── Harvest file mapping (priority order: sitemap > salt) ──────────────────

const HARVEST_SOURCES = [
  // Sitemap harvests (richer data, preferred)
  { dir: "1mg-sitemap", normalizer: normalize1mg, source: "1mg" },
  { dir: "pharmeasy-sitemap", normalizer: normalizePharmeasy, source: "PharmEasy" },
  { dir: "netmeds-fast", normalizer: normalizeNetmeds, source: "Netmeds" },
  // Salt-based harvests (fallback for products not in sitemap harvest)
  { dir: "1mg-fast", normalizer: normalize1mg, source: "1mg" },
  { dir: "pharmeasy-fast", normalizer: normalizePharmeasy, source: "PharmEasy" },
  // Apollo (salt only, no sitemap available)
  { dir: "apollo-salts-fast", normalizer: normalizeApollo, source: "Apollo" },
  // Others
  { dir: "truemeds-fast", normalizer: normalizeTruemeds, source: "Truemeds" },
];

// ─── Phase 2: Load and normalize all data ───────────────────────────────────

async function loadAllProducts() {
  console.log("Phase 2: Loading and normalizing all harvested data\n");

  // Key: source:slug → product  (dedup within same source)
  const productMap = new Map();
  const stats = {};

  for (const { dir, normalizer, source } of HARVEST_SOURCES) {
    const filePath = path.join(DATA_DIR, dir, "_products.jsonl");
    if (!fs.existsSync(filePath)) {
      console.log(`  SKIP ${dir} (no file)`);
      continue;
    }

    const raw = await readJsonl(filePath);
    let added = 0, skipped = 0;

    for (const p of raw) {
      const normalized = normalizer(p);
      if (!normalized.name || normalized.mrp <= 0) { skipped++; continue; }

      // Filter absurd prices (data errors)
      if (normalized.mrp > 500000) { skipped++; continue; }

      const key = `${normalized.source}:${normalized.slug}`;
      if (productMap.has(key)) {
        // Keep the one with more data (manufacturer, composition)
        const existing = productMap.get(key);
        if (!existing.manufacturer && normalized.manufacturer) {
          productMap.set(key, normalized);
        }
        skipped++;
      } else {
        productMap.set(key, normalized);
        added++;
      }
    }

    stats[dir] = { total: raw.length, added, skipped };
    console.log(`  ${dir}: ${raw.length} raw → ${added} added, ${skipped} skipped`);
  }

  console.log(`\nTotal unique products: ${productMap.size}`);
  return { products: Array.from(productMap.values()), stats };
}

// ─── Phase 3: Import to SQLite ──────────────────────────────────────────────

function importToDb(products, dryRun = false, limit = 0) {
  console.log("\nPhase 3: Importing to SQLite database\n");

  if (dryRun) {
    console.log("  DRY RUN — no DB writes\n");
    showNormalizationStats(products);
    return;
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log(`  ERROR: Database not found at ${DB_PATH}`);
    console.log("  Run: npx prisma db push && npm run seed");
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");

  const toImport = limit > 0 ? products.slice(0, limit) : products;
  console.log(`  Importing ${toImport.length} products...\n`);

  // ── Step 1: Collect all unique manufacturers ──
  const mfrNames = new Set(toImport.map(p => p.manufacturer).filter(Boolean));
  console.log(`  Step 1: ${mfrNames.size} unique manufacturers`);

  const mfrMap = new Map(); // name → id
  // Load existing manufacturers
  const existingMfrs = db.prepare("SELECT id, name FROM Manufacturer").all();
  for (const m of existingMfrs) mfrMap.set(m.name.toLowerCase(), m.id);

  const insertMfr = db.prepare(`
    INSERT OR IGNORE INTO Manufacturer (id, name, slug, qualityScore, reliabilityScore, overallScore, tier, createdAt, updatedAt)
    VALUES (?, ?, ?, 50, 50, 50, 'standard', datetime('now'), datetime('now'))
  `);
  const mfrInsertTx = db.transaction((names) => {
    for (const name of names) {
      if (mfrMap.has(name.toLowerCase())) continue;
      const id = cuid();
      const slug = slugify(name);
      try {
        insertMfr.run(id, name, slug);
        mfrMap.set(name.toLowerCase(), id);
      } catch {
        // Slug conflict — try with suffix
        try {
          insertMfr.run(id, name, slug + "-" + id.slice(-4));
          mfrMap.set(name.toLowerCase(), id);
        } catch { /* skip */ }
      }
    }
  });
  mfrInsertTx(Array.from(mfrNames));
  console.log(`    → ${mfrMap.size} total manufacturers in DB`);

  // ── Step 2: Collect all unique composition groups ──
  console.log(`  Step 2: Building composition groups...`);

  const groupMap = new Map(); // compositionKey → { id, displayName, primarySalt, strength, dosageForm, category }
  // Load existing
  const existingGroups = db.prepare("SELECT id, compositionKey FROM CompositionGroup").all();
  for (const g of existingGroups) groupMap.set(g.compositionKey, g.id);

  const insertGroup = db.prepare(`
    INSERT OR IGNORE INTO CompositionGroup (id, compositionKey, displayName, primarySalt, strength, dosageForm, category, drugCount, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))
  `);

  const groupInsertTx = db.transaction((products) => {
    for (const p of products) {
      const parsed = parseComposition(p.composition);
      if (!parsed.compositionKey) continue;

      const form = normalizeDosageForm(p.dosageForm, p.name);
      const key = `${parsed.compositionKey}::${form}`;

      if (groupMap.has(key)) continue;

      const id = cuid();
      const strength = parsed.components.map(c => c.strength).filter(Boolean).join("+") || "";
      const category = inferCategory(p.therapy, p.composition, p.name, p.category);

      try {
        insertGroup.run(id, key, parsed.displayName || p.composition, parsed.primarySalt, strength, form, category);
        groupMap.set(key, id);
      } catch { /* skip dupes */ }
    }
  });
  groupInsertTx(toImport);
  console.log(`    → ${groupMap.size} composition groups`);

  // ── Step 3: Insert drugs + prices ──
  console.log(`  Step 3: Inserting drugs and prices...`);

  const insertDrug = db.prepare(`
    INSERT INTO Drug (id, name, slug, genericName, brandName, manufacturer, manufacturerId, compositionGroupId, composition, category, dosageForm, packSize, prescriptionReq, isGeneric, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(slug) DO UPDATE SET
      manufacturer = CASE WHEN excluded.manufacturer != '' THEN excluded.manufacturer ELSE Drug.manufacturer END,
      manufacturerId = CASE WHEN excluded.manufacturerId IS NOT NULL THEN excluded.manufacturerId ELSE Drug.manufacturerId END,
      compositionGroupId = CASE WHEN excluded.compositionGroupId IS NOT NULL THEN excluded.compositionGroupId ELSE Drug.compositionGroupId END,
      composition = CASE WHEN excluded.composition != '' AND excluded.composition != 'Unknown' THEN excluded.composition ELSE Drug.composition END,
      updatedAt = datetime('now')
  `);

  const insertPrice = db.prepare(`
    INSERT INTO DrugPrice (id, drugId, source, sourceUrl, mrp, sellingPrice, discount, inStock, lastChecked, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(drugId, source) DO UPDATE SET
      mrp = excluded.mrp,
      sellingPrice = excluded.sellingPrice,
      discount = excluded.discount,
      inStock = excluded.inStock,
      sourceUrl = excluded.sourceUrl,
      lastChecked = datetime('now')
  `);

  // Need to get drugId by slug for price insertion
  const getDrugBySlug = db.prepare("SELECT id FROM Drug WHERE slug = ?");

  let drugsInserted = 0, pricesInserted = 0, errors = 0;

  const BATCH_SIZE = 500;
  const importBatch = db.transaction((batch) => {
    for (const p of batch) {
      try {
        const parsed = parseComposition(p.composition);
        const form = normalizeDosageForm(p.dosageForm, p.name);
        const compKey = parsed.compositionKey ? `${parsed.compositionKey}::${form}` : "";
        const groupId = compKey ? (groupMap.get(compKey) || null) : null;
        const mfrId = p.manufacturer ? (mfrMap.get(p.manufacturer.toLowerCase()) || null) : null;
        const category = inferCategory(p.therapy, p.composition, p.name, p.category);
        const genericName = parsed.primarySalt || p.composition.split("+")[0]?.trim() || "";
        const brandName = p.name.split(/\s+/)[0] || "";
        const slug = p.slug || slugify(p.name);
        const drugId = cuid();

        // Insert/update drug
        insertDrug.run(
          drugId, p.name, slug, genericName, brandName,
          p.manufacturer || "Unknown", mfrId, groupId,
          p.composition || "Unknown", category, form,
          p.packSize || "", p.rxRequired ? 1 : 0, 0
        );
        drugsInserted++;

        // Get actual drug ID (may exist from previous import)
        const drug = getDrugBySlug.get(slug);
        if (!drug) continue;

        // Insert price
        const discount = p.mrp > 0 ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100) : 0;
        insertPrice.run(
          cuid(), drug.id, p.source,
          p.sourceUrl || null,
          p.mrp, p.sellingPrice || p.mrp,
          Math.max(0, discount),
          p.inStock ? 1 : 0
        );
        pricesInserted++;
      } catch (err) {
        errors++;
        if (errors <= 20) {
          console.error(`    ERROR: ${p.name}: ${err.message}`);
        }
      }
    }
  });

  for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
    const batch = toImport.slice(i, i + BATCH_SIZE);
    importBatch(batch);

    if ((i + BATCH_SIZE) % 10000 === 0 || i + BATCH_SIZE >= toImport.length) {
      const pct = (((i + BATCH_SIZE) / toImport.length) * 100).toFixed(1);
      console.log(`    [${pct}%] ${Math.min(i + BATCH_SIZE, toImport.length)}/${toImport.length} | ${drugsInserted} drugs | ${pricesInserted} prices | ${errors} errors`);
    }
  }

  // ── Step 4: Update composition group stats ──
  console.log(`\n  Step 4: Updating composition group statistics...`);

  db.exec(`
    UPDATE CompositionGroup SET
      drugCount = (SELECT COUNT(*) FROM Drug WHERE Drug.compositionGroupId = CompositionGroup.id),
      lowestPrice = (
        SELECT MIN(dp.sellingPrice) FROM DrugPrice dp
        JOIN Drug d ON dp.drugId = d.id
        WHERE d.compositionGroupId = CompositionGroup.id AND dp.sellingPrice > 0
      ),
      highestPrice = (
        SELECT MAX(dp.mrp) FROM DrugPrice dp
        JOIN Drug d ON dp.drugId = d.id
        WHERE d.compositionGroupId = CompositionGroup.id
      ),
      updatedAt = datetime('now')
  `);

  // ── Step 5: Fix case-insensitive search ──
  console.log(`  Step 5: Ensuring case-insensitive indices...`);

  // SQLite COLLATE NOCASE on existing columns requires recreating the index
  // Instead, we'll create virtual columns or just use raw SQL in queries
  // For now, create a helper index if not exists
  try {
    db.exec("CREATE INDEX IF NOT EXISTS idx_drug_name_nocase ON Drug (name COLLATE NOCASE)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_drug_genericname_nocase ON Drug (genericName COLLATE NOCASE)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_drug_composition_nocase ON Drug (composition COLLATE NOCASE)");
    console.log("    Created COLLATE NOCASE indices");
  } catch (err) {
    console.log(`    Index creation note: ${err.message}`);
  }

  // ── Final stats ──
  const drugCount = db.prepare("SELECT COUNT(*) as c FROM Drug").get().c;
  const priceCount = db.prepare("SELECT COUNT(*) as c FROM DrugPrice").get().c;
  const groupCount = db.prepare("SELECT COUNT(*) as c FROM CompositionGroup").get().c;
  const mfrCount = db.prepare("SELECT COUNT(*) as c FROM Manufacturer").get().c;
  const sourceCounts = db.prepare("SELECT source, COUNT(*) as c FROM DrugPrice GROUP BY source").all();

  console.log(`\n${"=".repeat(60)}`);
  console.log("IMPORT COMPLETE");
  console.log(`  Drugs in DB: ${drugCount}`);
  console.log(`  Prices in DB: ${priceCount}`);
  console.log(`  Composition groups: ${groupCount}`);
  console.log(`  Manufacturers: ${mfrCount}`);
  console.log(`  Errors: ${errors}`);
  console.log(`\n  Prices per pharmacy:`);
  for (const { source, c } of sourceCounts) {
    console.log(`    ${source}: ${c}`);
  }
  console.log("=".repeat(60));

  db.close();
}

// ─── Stats display ──────────────────────────────────────────────────────────

function showNormalizationStats(products) {
  const sources = {};
  const categories = {};
  const forms = {};
  let withComposition = 0, withMfr = 0, withPrice = 0;
  const compositions = new Set();
  const manufacturers = new Set();

  for (const p of products) {
    sources[p.source] = (sources[p.source] || 0) + 1;

    const parsed = parseComposition(p.composition);
    const form = normalizeDosageForm(p.dosageForm, p.name);
    const cat = inferCategory(p.therapy, p.composition, p.name, p.category);

    categories[cat] = (categories[cat] || 0) + 1;
    forms[form] = (forms[form] || 0) + 1;

    if (parsed.compositionKey) { withComposition++; compositions.add(parsed.compositionKey); }
    if (p.manufacturer) { withMfr++; manufacturers.add(p.manufacturer); }
    if (p.mrp > 0) withPrice++;
  }

  console.log("\n--- Normalization Stats ---\n");
  console.log(`Total products: ${products.length}`);
  console.log(`With composition: ${withComposition} (${((withComposition / products.length) * 100).toFixed(0)}%)`);
  console.log(`With manufacturer: ${withMfr} (${((withMfr / products.length) * 100).toFixed(0)}%)`);
  console.log(`With price: ${withPrice} (${((withPrice / products.length) * 100).toFixed(0)}%)`);
  console.log(`Unique compositions: ${compositions.size}`);
  console.log(`Unique manufacturers: ${manufacturers.size}`);

  console.log("\nBy source:");
  for (const [s, c] of Object.entries(sources).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${c.toString().padStart(8)} ${s}`);
  }

  console.log("\nBy category (top 20):");
  for (const [cat, c] of Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`  ${c.toString().padStart(8)} ${cat}`);
  }

  console.log("\nBy dosage form:");
  for (const [f, c] of Object.entries(forms).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${c.toString().padStart(8)} ${f}`);
  }
}

function showDbStats() {
  if (!fs.existsSync(DB_PATH)) {
    console.log("No database found. Run import first.");
    return;
  }
  const db = new Database(DB_PATH);

  const drugs = db.prepare("SELECT COUNT(*) as c FROM Drug").get().c;
  const prices = db.prepare("SELECT COUNT(*) as c FROM DrugPrice").get().c;
  const groups = db.prepare("SELECT COUNT(*) as c FROM CompositionGroup").get().c;
  const mfrs = db.prepare("SELECT COUNT(*) as c FROM Manufacturer").get().c;
  const sources = db.prepare("SELECT source, COUNT(*) as c FROM DrugPrice GROUP BY source ORDER BY c DESC").all();
  const categories = db.prepare("SELECT category, COUNT(*) as c FROM Drug GROUP BY category ORDER BY c DESC LIMIT 15").all();
  const topGroups = db.prepare("SELECT displayName, drugCount, lowestPrice, highestPrice FROM CompositionGroup WHERE drugCount > 1 ORDER BY drugCount DESC LIMIT 10").all();

  console.log("--- Database Stats ---\n");
  console.log(`Drugs: ${drugs}`);
  console.log(`Prices: ${prices}`);
  console.log(`Composition groups: ${groups}`);
  console.log(`Manufacturers: ${mfrs}`);

  console.log("\nPrices per source:");
  for (const { source, c } of sources) console.log(`  ${c.toString().padStart(8)} ${source}`);

  console.log("\nTop categories:");
  for (const { category, c } of categories) console.log(`  ${c.toString().padStart(8)} ${category}`);

  if (topGroups.length) {
    console.log("\nTop composition groups (most brands):");
    for (const g of topGroups) {
      const priceRange = g.lowestPrice ? ` | Rs ${g.lowestPrice} - ${g.highestPrice}` : "";
      console.log(`  ${g.drugCount.toString().padStart(4)} brands — ${g.displayName}${priceRange}`);
    }
  }

  db.close();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--stats")) {
    showDbStats();
    return;
  }

  const dryRun = args.includes("--dry-run");
  const fresh = args.includes("--fresh");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 0;

  console.log("=".repeat(60));
  console.log("  CostMini Data Pipeline — Normalize & Import");
  console.log("=".repeat(60) + "\n");

  // Load all harvested data
  const { products } = await loadAllProducts();

  if (products.length === 0) {
    console.log("No products to import!");
    return;
  }

  if (fresh && !dryRun) {
    console.log("\n  FRESH import: clearing existing drug data...");
    const db = new Database(DB_PATH);
    db.exec("DELETE FROM DrugPrice");
    db.exec("DELETE FROM DrugAlternative");
    db.exec("DELETE FROM ScanResult");
    db.exec("DELETE FROM Drug");
    db.exec("DELETE FROM CompositionGroup");
    // Keep manufacturers and their seed data
    console.log("  Cleared Drug, DrugPrice, CompositionGroup tables");
    db.close();
  }

  importToDb(products, dryRun, limit);
}

main().catch(console.error);
