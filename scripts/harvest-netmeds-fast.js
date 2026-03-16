/**
 * FAST Netmeds harvester — sitemap-based full catalog extraction.
 *
 * Phase 1 (urls):   Download 666 product sub-sitemaps, extract all product URLs -> _urls.json
 * Phase 2 (scrape): Fetch each product page, extract __INITIAL_STATE__ JSON -> JSONL
 *
 * Sitemap index: https://www.netmeds.com/sitemap.xml
 * Product sitemaps: /sitemap/products/{1..666}/page.sitemap.xml (500 URLs each)
 * ~333,000 product URLs
 *
 * Data structure (per product page):
 *   window.__INITIAL_STATE__ = { productDetailsPage: { product: {...}, product_meta: {...} } }
 *   - Name: product.name
 *   - Composition: description field "genericName-..."
 *   - Manufacturer: description field "marketerName-..."
 *   - MRP: product_meta.price.marked.min
 *   - Selling: product_meta.price.effective.min
 *   - In stock: product_meta.sellable
 *   - Rx: tags includes "rx" or attributes.dlflag
 *
 * Usage:
 *   node scripts/harvest-netmeds-fast.js urls              # Phase 1: collect URLs
 *   node scripts/harvest-netmeds-fast.js                   # Phase 2: scrape (default)
 *   node scripts/harvest-netmeds-fast.js --resume          # Resume scraping
 *   node scripts/harvest-netmeds-fast.js --limit 50        # Test with 50 URLs
 *   node scripts/harvest-netmeds-fast.js stats             # Show progress
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "data", "harvested", "netmeds-fast");
const URLS_FILE = path.join(OUT_DIR, "_urls.json");
const PRODUCTS_FILE = path.join(OUT_DIR, "_products.jsonl");
const PROGRESS_FILE = path.join(OUT_DIR, "_progress.json");

const SITEMAP_COUNT = 666;
const CONCURRENCY = 5;
const DELAY = 1000;
const SAVE_EVERY = 50;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// Phase 1: Download sitemaps and extract product URLs
// ---------------------------------------------------------------------------

async function fetchSitemap(url, retries = 3) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 && retries > 0) {
      console.log(`  429 on ${url}, retrying in 5s...`);
      await sleep(5000);
      return fetchSitemap(url, retries - 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } catch (err) {
    if (retries > 0) {
      await sleep(2000);
      return fetchSitemap(url, retries - 1);
    }
    throw err;
  }
}

function extractUrlsFromSitemap(xml) {
  const urls = [];
  const locRegex = /<loc>\s*(https:\/\/www\.netmeds\.com\/product\/[^<]+)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

async function collectUrls() {
  ensureDir(OUT_DIR);
  console.log("Phase 1: Collecting product URLs from Netmeds sitemaps\n");

  const allUrls = new Set();
  let emptyCount = 0;

  for (let i = 1; i <= SITEMAP_COUNT; i++) {
    const url = `https://www.netmeds.com/sitemap/products/${i}/page.sitemap.xml`;
    try {
      const xml = await fetchSitemap(url);
      const urls = extractUrlsFromSitemap(xml);
      for (const u of urls) allUrls.add(u);
      if (i % 50 === 0 || i <= 5) {
        console.log(`Sitemap ${i}/${SITEMAP_COUNT}: ${urls.length} URLs (total: ${allUrls.size})`);
      }
      if (urls.length === 0) {
        emptyCount++;
        if (emptyCount > 5) {
          console.log(`  ${emptyCount} empty sitemaps in a row, stopping.`);
          break;
        }
      } else {
        emptyCount = 0;
      }
    } catch (err) {
      console.error(`  ERROR on sitemap ${i}: ${err.message}`);
    }
    await sleep(200);
  }

  const urlArray = Array.from(allUrls);
  fs.writeFileSync(URLS_FILE, JSON.stringify(urlArray, null, 2));
  console.log(`\nSaved ${urlArray.length} unique product URLs to ${URLS_FILE}`);
}

// ---------------------------------------------------------------------------
// Phase 2: Scrape product pages
// ---------------------------------------------------------------------------

async function fetchPage(url, retries = 3) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });
    if (res.status === 429 && retries > 0) {
      const wait = 5000 + Math.random() * 3000;
      console.log(`  429 on ${url}, retrying in ${(wait / 1000).toFixed(1)}s...`);
      await sleep(wait);
      return fetchPage(url, retries - 1);
    }
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (err) {
    if (retries > 0) {
      await sleep(2000 + Math.random() * 1000);
      return fetchPage(url, retries - 1);
    }
    throw err;
  }
}

function extractInitialState(html) {
  const startMarker = "window.__INITIAL_STATE__=";
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return null;
  const jsonStart = startIdx + startMarker.length;

  // Track braces to find the end of the JSON object
  let depth = 0;
  let end = jsonStart;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  try {
    return JSON.parse(html.substring(jsonStart, end));
  } catch {
    return null;
  }
}

function parseDescriptionFields(desc) {
  if (!desc) return {};
  const fields = {};
  for (const part of desc.split("; ")) {
    const dashIdx = part.indexOf("-");
    if (dashIdx > 0) {
      const key = part.substring(0, dashIdx).trim();
      const val = part.substring(dashIdx + 1).trim();
      if (val) fields[key] = val;
    }
  }
  return fields;
}

function extractProduct(state, url) {
  const pdp = state?.productDetailsPage;
  if (!pdp || !pdp.product) return null;

  const p = pdp.product;
  const meta = pdp.product_meta || {};
  const name = p.name;
  if (!name) return null;

  const descFields = parseDescriptionFields(p.description);
  const tags = p.tags || [];

  const mrp = meta.price?.marked?.min || meta.price?.marked?.max || 0;
  const sellingPrice = meta.price?.effective?.min || meta.price?.effective?.max || mrp;

  // Determine rx status
  const isRx = tags.includes("rx") || p.attributes?.dlflag === "true" || p.attributes?.rxflag === "true";
  const isNonRx = tags.includes("non-rx");

  return {
    name,
    slug: p.slug || "",
    url,
    itemCode: p.item_code || p.uid || "",
    composition: descFields.genericName || "",
    manufacturer: descFields.marketerName || "",
    brand: descFields.brandFilter || p.brand?.name || "",
    category: descFields.categoryNameLevel3 || p.categories?.[0]?.name || "",
    categoryL2: descFields.categoryNameLevel2 || "",
    mrp,
    sellingPrice,
    discount: meta.discount || "",
    inStock: meta.sellable !== false,
    rxRequired: isRx && !isNonRx,
    tags,
  };
}

async function scrapeProducts() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(URLS_FILE)) {
    console.log("No URLs file found. Run Phase 1 first:");
    console.log("  node scripts/harvest-netmeds-fast.js urls");
    process.exit(1);
  }

  const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
  console.log(`Total product URLs: ${urls.length}`);

  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : urls.length;

  // Resume support
  const resume = process.argv.includes("--resume");
  let completedUrls = new Set();
  let productCount = 0;

  if (resume && fs.existsSync(PROGRESS_FILE)) {
    const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    completedUrls = new Set(prog.completedUrls || []);
    productCount = prog.productCount || 0;
    console.log(`Resuming: ${completedUrls.size} URLs done, ${productCount} products saved`);
  } else {
    fs.writeFileSync(PRODUCTS_FILE, "");
  }

  const remaining = urls.filter((u) => !completedUrls.has(u)).slice(0, limit);
  console.log(`Remaining URLs: ${remaining.length}`);
  const estMin = ((remaining.length / CONCURRENCY) * (DELAY + 800)) / 1000 / 60;
  console.log(`Estimated: ~${estMin.toFixed(0)} minutes\n`);

  const fd = fs.openSync(PRODUCTS_FILE, "a");
  let newProducts = 0;
  let scraped = 0;
  let errors = 0;
  let notFound = 0;
  let noData = 0;
  const startTime = Date.now();

  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (url) => {
        const html = await fetchPage(url);
        completedUrls.add(url);
        if (!html) return { url, product: null, reason: "404" };

        const state = extractInitialState(html);
        if (!state) return { url, product: null, reason: "no_state" };

        const product = extractProduct(state, url);
        if (!product) return { url, product: null, reason: "no_product" };

        return { url, product };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        scraped++;
        if (r.value.product) {
          fs.writeSync(fd, JSON.stringify(r.value.product) + "\n");
          newProducts++;
          productCount++;
        } else if (r.value.reason === "404") {
          notFound++;
        } else {
          noData++;
        }
      } else {
        errors++;
      }
    }

    // Progress log every 10 batches
    const batchNum = Math.floor(i / CONCURRENCY);
    if (batchNum % 10 === 0) {
      const pct = ((completedUrls.size / urls.length) * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (scraped / (elapsed || 1)).toFixed(1);
      const etaMin = (
        ((remaining.length - i) / CONCURRENCY) *
        (DELAY + 800) /
        1000 /
        60
      ).toFixed(0);
      console.log(
        `[${pct}%] ${completedUrls.size}/${urls.length} URLs | ${productCount} products (+${newProducts} new) | ${notFound} 404 | ${noData} no-data | ${errors} err | ${rate}/s | ETA ~${etaMin}m`
      );
    }

    // Save checkpoint
    if (batchNum % SAVE_EVERY === 0 && batchNum > 0) {
      saveProgress(completedUrls, productCount);
    }

    await sleep(DELAY);
  }

  fs.closeSync(fd);
  saveProgress(completedUrls, productCount);

  const totalMin = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`COMPLETE`);
  console.log(`Total URLs scraped: ${scraped}`);
  console.log(`Products extracted: ${productCount}`);
  console.log(`404 (removed): ${notFound}`);
  console.log(`No data: ${noData}`);
  console.log(`Errors: ${errors}`);
  console.log(`Time: ${totalMin} minutes`);
  console.log(`Saved to: ${PRODUCTS_FILE}`);
}

function saveProgress(completedUrls, productCount) {
  fs.writeFileSync(
    PROGRESS_FILE,
    JSON.stringify({
      completedUrls: Array.from(completedUrls),
      productCount,
      lastSaved: new Date().toISOString(),
    })
  );
  console.log(`  [checkpoint] ${completedUrls.size} URLs done, ${productCount} products`);
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

function showStats() {
  console.log("Netmeds Fast Harvester - Stats\n");

  if (fs.existsSync(URLS_FILE)) {
    const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
    console.log(`URLs collected: ${urls.length}`);
  } else {
    console.log("No URLs file yet. Run: node scripts/harvest-netmeds-fast.js urls");
  }

  if (fs.existsSync(PROGRESS_FILE)) {
    const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    console.log(`URLs scraped: ${p.completedUrls?.length || 0}`);
    console.log(`Products saved: ${p.productCount}`);
    console.log(`Last saved: ${p.lastSaved}`);
  }

  if (fs.existsSync(PRODUCTS_FILE)) {
    const stat = fs.statSync(PRODUCTS_FILE);
    console.log(`\nFile size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
    const lines = fs.readFileSync(PRODUCTS_FILE, "utf-8").split("\n").filter(Boolean);
    const products = lines.map((l) => JSON.parse(l));
    const withPrice = products.filter((p) => p.mrp > 0).length;
    const withComposition = products.filter((p) => p.composition).length;
    const inStock = products.filter((p) => p.inStock).length;
    const manufacturers = new Set(products.map((p) => p.manufacturer).filter(Boolean)).size;
    const rx = products.filter((p) => p.rxRequired).length;

    console.log(`Total products: ${products.length}`);
    console.log(`With price: ${withPrice} (${((withPrice / products.length) * 100).toFixed(0)}%)`);
    console.log(`With composition: ${withComposition} (${((withComposition / products.length) * 100).toFixed(0)}%)`);
    console.log(`In stock: ${inStock} (${((inStock / products.length) * 100).toFixed(0)}%)`);
    console.log(`Unique manufacturers: ${manufacturers}`);
    console.log(`Rx required: ${rx}`);

    // Top 10 manufacturers
    const mfrCounts = {};
    for (const p of products) {
      if (p.manufacturer) {
        mfrCounts[p.manufacturer] = (mfrCounts[p.manufacturer] || 0) + 1;
      }
    }
    const topMfrs = Object.entries(mfrCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    if (topMfrs.length) {
      console.log(`\nTop 10 manufacturers:`);
      for (const [name, count] of topMfrs) {
        console.log(`  ${count.toString().padStart(5)} - ${name}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cmd = process.argv[2];

  if (cmd === "urls") {
    await collectUrls();
  } else if (cmd === "stats") {
    showStats();
  } else {
    await scrapeProducts();
  }
}

main().catch(console.error);
