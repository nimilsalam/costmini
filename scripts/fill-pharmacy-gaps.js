/**
 * AI-powered pharmacy gap filler.
 *
 * For each composition group missing a pharmacy, searches that pharmacy's
 * API/website for the salt name and adds found drugs to the database.
 *
 * Uses PharmEasy search API (open) and pharmacy scraper modules.
 *
 * Usage:
 *   node scripts/fill-pharmacy-gaps.js                # Fill top 200 gaps
 *   node scripts/fill-pharmacy-gaps.js --limit 50     # Fill top 50
 *   node scripts/fill-pharmacy-gaps.js --pharmacy PharmEasy  # Only PharmEasy
 *   node scripts/fill-pharmacy-gaps.js --dry-run      # Preview only
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "dev.db");
const GAPS_FILE = path.join(__dirname, "..", "data", "top-gaps.json");

function fetchJson(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
      timeout: 10000,
    }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data.substring(0, 200) });
        }
      });
    }).on("error", (e) => resolve({ status: 0, error: e.message }))
      .on("timeout", () => resolve({ status: 0, error: "timeout" }));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function slugify(t) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
function cuid() { return "c" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }

// Search PharmEasy API
async function searchPharmEasy(salt) {
  const url = `https://pharmeasy.in/api/search/search?q=${encodeURIComponent(salt)}`;
  const r = await fetchJson(url);
  if (!r.data?.data?.products) return [];

  return r.data.data.products.filter(p => p.name).map(p => ({
    name: p.name,
    slug: slugify(p.name),
    composition: salt,
    manufacturer: p.manufacturer || "",
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.salePrice || p.sellingPrice) || parseFloat(p.mrp) || 0,
    packSize: p.packSize || "",
    inStock: true,
    source: "PharmEasy",
    sourceUrl: p.slug ? `https://pharmeasy.in/online-medicine-order/${p.slug}` : "",
  }));
}

// Search 1mg (HTML-based, may be blocked)
async function search1mg(salt) {
  const url = `https://www.1mg.com/search/all?name=${encodeURIComponent(salt)}`;
  return []; // 1mg blocks automated search — skip for now
}

// Search Netmeds
async function searchNetmeds(salt) {
  const url = `https://www.netmeds.com/catalogsearch/result/${encodeURIComponent(salt)}/all`;
  return []; // Netmeds needs HTML parsing — skip for now
}

// Search Apollo
async function searchApollo(salt) {
  const url = `https://search.apollopharmacy.in/search?q=${encodeURIComponent(salt)}&page=1&size=10`;
  const r = await fetchJson(url);
  if (!r.data?.products) return [];

  return r.data.products.filter(p => p.name).map(p => ({
    name: p.name,
    slug: slugify(p.name),
    composition: p.genericName || salt,
    manufacturer: p.manufacturer || "",
    mrp: parseFloat(p.mrp) || 0,
    sellingPrice: parseFloat(p.salePrice || p.sellingPrice || p.mrp) || 0,
    packSize: p.packSize || p.packForm || "",
    inStock: p.isInStock !== false,
    source: "Apollo",
    sourceUrl: p.urlKey ? `https://www.apollopharmacy.in/otc/${p.urlKey}` : "",
  }));
}

const SEARCHERS = {
  "PharmEasy": searchPharmEasy,
  "Apollo": searchApollo,
  "1mg": search1mg,
  "Netmeds": searchNetmeds,
};

async function main() {
  const args = process.argv.slice(2);
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 200;
  const pharmacyFilter = args.includes("--pharmacy") ? args[args.indexOf("--pharmacy") + 1] : null;
  const dryRun = args.includes("--dry-run");

  const gaps = JSON.parse(fs.readFileSync(GAPS_FILE, "utf-8"));
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  // Prepare statements
  const findDrug = db.prepare("SELECT id FROM Drug WHERE slug = ? AND compositionGroupId IS NOT NULL");
  const findGroup = db.prepare("SELECT id FROM CompositionGroup WHERE displayName = ?");
  const insertDrug = db.prepare(`
    INSERT OR IGNORE INTO Drug (id, name, slug, genericName, manufacturer, composition, category,
      dosageForm, packSize, isGeneric, whoCertified, prescriptionReq, compositionGroupId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, datetime('now'), datetime('now'))
  `);
  const insertPrice = db.prepare(`
    INSERT OR IGNORE INTO DrugPrice (id, drugId, source, sourceUrl, mrp, sellingPrice, inStock, lastChecked)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  console.log(`Processing top ${limit} gaps${pharmacyFilter ? ` (${pharmacyFilter} only)` : ""}${dryRun ? " [DRY RUN]" : ""}\n`);

  let totalFound = 0;
  let totalAdded = 0;
  let processed = 0;

  for (const gap of gaps.slice(0, limit)) {
    const pharmacies = pharmacyFilter ? [pharmacyFilter] : gap.missing;

    for (const pharmacy of pharmacies) {
      const searcher = SEARCHERS[pharmacy];
      if (!searcher) continue;

      process.stdout.write(`  Searching ${pharmacy} for "${gap.salt}"... `);

      try {
        const results = await searcher(gap.salt);

        if (results.length === 0) {
          console.log("0 found");
          await sleep(500);
          continue;
        }

        console.log(`${results.length} found`);
        totalFound += results.length;

        if (!dryRun) {
          const group = findGroup.get(gap.displayName);
          const groupId = group?.id || null;

          for (const drug of results) {
            const slug = drug.slug || slugify(drug.name);
            const existing = findDrug.get(slug);
            if (existing) continue;

            const drugId = cuid();
            insertDrug.run(
              drugId, drug.name, slug, drug.composition, drug.manufacturer,
              drug.composition, gap.category || "Others", "",
              drug.packSize, 0, groupId
            );
            insertPrice.run(
              cuid(), drugId, drug.source, drug.sourceUrl,
              drug.mrp, drug.sellingPrice, drug.inStock ? 1 : 0
            );
            totalAdded++;
          }
        }

        await sleep(1000); // Rate limit between searches
      } catch (e) {
        console.log("ERROR:", e.message);
      }
    }

    processed++;
    if (processed % 20 === 0) {
      console.log(`\n  Progress: ${processed}/${limit} gaps | Found: ${totalFound} | Added: ${totalAdded}\n`);
    }
  }

  // Update composition group stats
  if (!dryRun && totalAdded > 0) {
    console.log("\nUpdating composition group stats...");
    db.prepare(`
      UPDATE CompositionGroup SET
        drugCount = (SELECT COUNT(*) FROM Drug WHERE compositionGroupId = CompositionGroup.id),
        lowestPrice = (SELECT MIN(dp.sellingPrice) FROM DrugPrice dp JOIN Drug d ON dp.drugId = d.id WHERE d.compositionGroupId = CompositionGroup.id AND dp.sellingPrice > 0),
        highestPrice = (SELECT MAX(dp.sellingPrice) FROM DrugPrice dp JOIN Drug d ON dp.drugId = d.id WHERE d.compositionGroupId = CompositionGroup.id)
    `).run();
  }

  console.log(`\n════════════════════════════════════════`);
  console.log(`  Gaps processed: ${processed}`);
  console.log(`  Products found: ${totalFound}`);
  console.log(`  Products added: ${totalAdded}`);
  console.log(`════════════════════════════════════════`);

  db.close();
}

main();
