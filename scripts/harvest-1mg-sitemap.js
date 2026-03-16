/**
 * FULL 1mg harvester — sitemap-based catalog extraction.
 *
 * Phase 1 (urls):   Download all drug + OTC sitemaps, extract product URLs -> _urls.json
 * Phase 2 (scrape): Fetch each product page, extract JSON-LD Drug schema -> JSONL
 *
 * Drug sitemaps: sitemap_drugs_1.xml through sitemap_drugs_77.xml (~381,727 URLs)
 * OTC sitemaps:  sitemap_otc_1.xml through sitemap_otc_65.xml (~319,424 URLs)
 * Total: ~701,151 product URLs
 *
 * Data per page:
 *   - JSON-LD @type=Drug: activeIngredient, marketer.legalName, drugUnit, prescriptionStatus
 *   - HTML: "by {manufacturer}" text, price from PRELOADED_STATE
 *
 * Usage:
 *   node scripts/harvest-1mg-sitemap.js urls              # Phase 1: collect URLs
 *   node scripts/harvest-1mg-sitemap.js                   # Phase 2: scrape (default)
 *   node scripts/harvest-1mg-sitemap.js --resume          # Resume scraping
 *   node scripts/harvest-1mg-sitemap.js --limit 50        # Test with 50 URLs
 *   node scripts/harvest-1mg-sitemap.js stats             # Show progress
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "data", "harvested", "1mg-sitemap");
const URLS_FILE = path.join(OUT_DIR, "_urls.json");
const PRODUCTS_FILE = path.join(OUT_DIR, "_products.jsonl");
const PROGRESS_FILE = path.join(OUT_DIR, "_progress.json");

const CONCURRENCY = 5;
const DELAY = 800;
const SAVE_EVERY = 100;

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
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    if (retries > 0) {
      await sleep(2000);
      return fetchSitemap(url, retries - 1);
    }
    return null;
  }
}

function extractUrlsFromSitemap(xml) {
  const urls = [];
  const locRegex = /<loc>\s*(https:\/\/www\.1mg\.com\/(?:drugs|otc)\/[^<]+)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

async function collectUrls() {
  ensureDir(OUT_DIR);
  console.log("Phase 1: Collecting product URLs from 1mg sitemaps\n");

  const allUrls = new Set();

  // Drug sitemaps (1-77)
  console.log("--- Drug sitemaps ---");
  for (let i = 1; i <= 100; i++) {
    const url = `https://www.1mg.com/sitemap_drugs_${i}.xml`;
    const xml = await fetchSitemap(url);
    if (!xml) { console.log(`  drugs_${i}: stopped`); break; }
    const urls = extractUrlsFromSitemap(xml);
    if (urls.length === 0) { console.log(`  drugs_${i}: 0 URLs, stopped`); break; }
    for (const u of urls) allUrls.add(u);
    if (i % 10 === 0 || i <= 3) {
      console.log(`  drugs_${i}: ${urls.length} URLs (total: ${allUrls.size})`);
    }
    await sleep(200);
  }

  // OTC sitemaps (1-65)
  console.log("\n--- OTC sitemaps ---");
  for (let i = 1; i <= 100; i++) {
    const url = `https://www.1mg.com/sitemap_otc_${i}.xml`;
    const xml = await fetchSitemap(url);
    if (!xml) { console.log(`  otc_${i}: stopped`); break; }
    const urls = extractUrlsFromSitemap(xml);
    if (urls.length === 0) { console.log(`  otc_${i}: 0 URLs, stopped`); break; }
    for (const u of urls) allUrls.add(u);
    if (i % 10 === 0 || i <= 3) {
      console.log(`  otc_${i}: ${urls.length} URLs (total: ${allUrls.size})`);
    }
    await sleep(200);
  }

  const urlArray = Array.from(allUrls);
  fs.writeFileSync(URLS_FILE, JSON.stringify(urlArray, null, 2));

  const drugCount = urlArray.filter((u) => u.includes("/drugs/")).length;
  const otcCount = urlArray.filter((u) => u.includes("/otc/")).length;
  console.log(`\nSaved ${urlArray.length} unique product URLs`);
  console.log(`  /drugs/: ${drugCount}`);
  console.log(`  /otc/: ${otcCount}`);
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

function extractProduct(html, url) {
  const result = {
    name: "",
    slug: url.replace("https://www.1mg.com", ""),
    url,
    manufacturer: "",
    composition: "",
    mrp: 0,
    sellingPrice: 0,
    packInfo: "",
    rxRequired: false,
    inStock: true,
    productType: url.includes("/otc/") ? "otc" : "drug",
  };

  // 1) JSON-LD Drug schema — most reliable for composition + manufacturer
  const ldMatches = html.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g
  );
  for (const m of ldMatches) {
    try {
      const ld = JSON.parse(m[1]);
      if (ld["@type"] === "Drug") {
        result.name = ld.name || ld.proprietaryName || "";
        result.composition = ld.activeIngredient || ld.nonProprietaryName || "";
        result.packInfo = ld.drugUnit || "";
        result.rxRequired = ld.prescriptionStatus === "prescription-only";
        if (ld.marketer) {
          result.manufacturer =
            typeof ld.marketer === "string"
              ? ld.marketer
              : ld.marketer.legalName || ld.marketer.name || "";
        }
        if (ld.offers) {
          result.mrp = parseFloat(ld.offers.highPrice || ld.offers.price) || 0;
          result.sellingPrice = parseFloat(ld.offers.lowPrice || ld.offers.price) || 0;
          result.inStock = ld.offers.availability !== "OutOfStock";
        }
        break;
      }
      // Product schema (some OTC pages use this)
      if (ld["@type"] === "Product") {
        result.name = ld.name || "";
        if (ld.brand) {
          result.manufacturer =
            typeof ld.brand === "string" ? ld.brand : ld.brand.name || "";
        }
        if (ld.offers) {
          result.mrp = parseFloat(ld.offers.highPrice || ld.offers.price) || 0;
          result.sellingPrice = parseFloat(ld.offers.lowPrice || ld.offers.price) || 0;
          result.inStock = ld.offers.availability !== "OutOfStock";
        }
        // Don't break — there might be a Drug schema too
      }
    } catch {
      continue;
    }
  }

  // 2) Fallback: extract from HTML patterns (for pages without JSON-LD Drug schema)
  if (!result.name) {
    const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/);
    if (titleMatch) result.name = titleMatch[1].trim();
  }

  if (!result.manufacturer) {
    const mfrMatch = html.match(
      /marketer\/[^"]*">([^<]+)<\/a>/
    ) || html.match(/manufacturer\/[^"]*">([^<]+)<\/a>/);
    if (mfrMatch) result.manufacturer = mfrMatch[1].trim();
  }

  // Salt/composition from generics link (works on new 1mg HTML)
  if (!result.composition) {
    const saltMatch = html.match(/generics\/[^"]*">([^<]+)<\/a>/);
    if (saltMatch) result.composition = saltMatch[1].trim();
  }

  // 3) Price from MRP pattern or PRELOADED_STATE
  if (!result.mrp) {
    // New HTML format: MRP₹29.1 or MRP ₹29.1
    const mrpMatch = html.match(/MRP[^₹]*₹\s*(\d+\.?\d*)/);
    if (mrpMatch) result.mrp = parseFloat(mrpMatch[1]);

    // Legacy PRELOADED_STATE format
    if (!result.mrp) {
      const priceMatch = html.match(/"mrp"\s*:\s*(\d+(?:\.\d+)?)/);
      if (priceMatch) result.mrp = parseFloat(priceMatch[1]);
    }

    // Selling price: ₹X.XX/tablet or ₹X.XX/unit pattern
    const spMatch = html.match(/₹(\d+\.?\d*)\/(?:tablet|capsule|ml|strip|unit|gm|sachet|bottle)/);
    if (spMatch) {
      // This is per-unit price, try to find total selling price
      const totalMatch = html.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/);
      if (totalMatch) result.sellingPrice = parseFloat(totalMatch[1]);
    }
    if (!result.sellingPrice) {
      const spMatch2 = html.match(/"price"\s*:\s*(\d+(?:\.\d+)?)/);
      if (spMatch2) result.sellingPrice = parseFloat(spMatch2[1]);
    }
  }

  // Pack info from HTML
  if (!result.packInfo) {
    const packMatch = html.match(/strip of (\d+) (tablets?|capsules?)/i)
      || html.match(/bottle of (\d+) (ml|tablets?)/i)
      || html.match(/pack of (\d+)/i);
    if (packMatch) result.packInfo = packMatch[0];
  }

  if (!result.sellingPrice) result.sellingPrice = result.mrp;
  if (!result.name) return null;

  return result;
}

async function scrapeProducts() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(URLS_FILE)) {
    console.log("No URLs file found. Run Phase 1 first:");
    console.log("  node scripts/harvest-1mg-sitemap.js urls");
    process.exit(1);
  }

  const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
  console.log(`Total product URLs: ${urls.length}`);

  const limitIdx = process.argv.indexOf("--limit");
  const limit = limitIdx !== -1 ? parseInt(process.argv[limitIdx + 1]) : urls.length;

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
  const estMin = ((remaining.length / CONCURRENCY) * (DELAY + 500)) / 1000 / 60;
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

        const product = extractProduct(html, url);
        if (!product) return { url, product: null, reason: "no_data" };

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

    const batchNum = Math.floor(i / CONCURRENCY);
    if (batchNum % 20 === 0) {
      const pct = ((completedUrls.size / urls.length) * 100).toFixed(1);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (scraped / (elapsed || 1)).toFixed(1);
      const etaMin = (
        ((remaining.length - i) / CONCURRENCY) *
        (DELAY + 500) /
        1000 /
        60
      ).toFixed(0);
      console.log(
        `[${pct}%] ${completedUrls.size}/${urls.length} URLs | ${productCount} products (+${newProducts} new) | ${notFound} 404 | ${noData} no-data | ${errors} err | ${rate}/s | ETA ~${etaMin}m`
      );
    }

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
  console.log("1mg Sitemap Harvester - Stats\n");

  if (fs.existsSync(URLS_FILE)) {
    const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
    const drugCount = urls.filter((u) => u.includes("/drugs/")).length;
    const otcCount = urls.filter((u) => u.includes("/otc/")).length;
    console.log(`URLs collected: ${urls.length}`);
    console.log(`  /drugs/: ${drugCount}`);
    console.log(`  /otc/: ${otcCount}`);
  } else {
    console.log("No URLs file yet. Run: node scripts/harvest-1mg-sitemap.js urls");
  }

  if (fs.existsSync(PROGRESS_FILE)) {
    const p = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
    console.log(`\nURLs scraped: ${p.completedUrls?.length || 0}`);
    console.log(`Products saved: ${p.productCount}`);
    console.log(`Last saved: ${p.lastSaved}`);
  }

  if (fs.existsSync(PRODUCTS_FILE)) {
    const stat = fs.statSync(PRODUCTS_FILE);
    console.log(`\nFile size: ${(stat.size / 1024 / 1024).toFixed(1)} MB`);
    const lines = fs.readFileSync(PRODUCTS_FILE, "utf-8").split("\n").filter(Boolean);
    const products = lines.map((l) => JSON.parse(l));
    const withPrice = products.filter((p) => p.mrp > 0).length;
    const withMfr = products.filter((p) => p.manufacturer).length;
    const withComp = products.filter((p) => p.composition).length;
    const inStock = products.filter((p) => p.inStock).length;
    const manufacturers = new Set(products.map((p) => p.manufacturer).filter(Boolean)).size;
    const drugs = products.filter((p) => p.productType === "drug").length;
    const otc = products.filter((p) => p.productType === "otc").length;

    console.log(`Total products: ${products.length}`);
    console.log(`With price: ${withPrice} (${((withPrice / products.length) * 100).toFixed(0)}%)`);
    console.log(`With manufacturer: ${withMfr} (${((withMfr / products.length) * 100).toFixed(0)}%)`);
    console.log(`With composition: ${withComp} (${((withComp / products.length) * 100).toFixed(0)}%)`);
    console.log(`In stock: ${inStock} (${((inStock / products.length) * 100).toFixed(0)}%)`);
    console.log(`Unique manufacturers: ${manufacturers}`);
    console.log(`Drugs: ${drugs} | OTC: ${otc}`);

    const mfrCounts = {};
    for (const p of products) {
      if (p.manufacturer) {
        mfrCounts[p.manufacturer] = (mfrCounts[p.manufacturer] || 0) + 1;
      }
    }
    const topMfrs = Object.entries(mfrCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15);
    if (topMfrs.length) {
      console.log(`\nTop 15 manufacturers:`);
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
