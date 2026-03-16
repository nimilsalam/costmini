/**
 * FAST PharmEasy harvester — sitemap-based full catalog extraction.
 *
 * Phase 1 (urls):   Download 29 prescription + 7 OTC sub-sitemaps, extract all product URLs -> _urls.json
 * Phase 2 (scrape): Fetch each product page, extract __NEXT_DATA__ JSON -> JSONL
 *
 * Sitemap index: https://pharmeasy.in/sitemaps/sitemap-prescription-medicines.xml
 *                https://pharmeasy.in/sitemaps/sitemap-otc-products.xml
 *
 * Data structure (per product page):
 *   __NEXT_DATA__.props.pageProps.productDetails
 *   - name, manufacturer, molecule (composition)
 *   - costPrice (MRP), salePrice (selling price)
 *   - isAvailable, isRxRequired, dosageForm, measurementUnit
 *   - compositions[] array with detailed salt info
 *
 * Usage:
 *   node scripts/harvest-pharmeasy-sitemap.js urls              # Phase 1: collect URLs
 *   node scripts/harvest-pharmeasy-sitemap.js                   # Phase 2: scrape (default)
 *   node scripts/harvest-pharmeasy-sitemap.js --resume          # Resume scraping
 *   node scripts/harvest-pharmeasy-sitemap.js --limit 50        # Test with 50 URLs
 *   node scripts/harvest-pharmeasy-sitemap.js stats             # Show progress
 */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "data", "harvested", "pharmeasy-sitemap");
const URLS_FILE = path.join(OUT_DIR, "_urls.json");
const PRODUCTS_FILE = path.join(OUT_DIR, "_products.jsonl");
const PROGRESS_FILE = path.join(OUT_DIR, "_progress.json");

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

async function fetchXml(url, retries = 3) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 && retries > 0) {
      console.log(`  429 on ${url}, retrying in 5s...`);
      await sleep(5000);
      return fetchXml(url, retries - 1);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return await res.text();
  } catch (err) {
    if (retries > 0) {
      await sleep(2000);
      return fetchXml(url, retries - 1);
    }
    throw err;
  }
}

function extractLocsFromXml(xml) {
  const urls = [];
  const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/g;
  let match;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1].trim());
  }
  return urls;
}

async function collectUrls() {
  ensureDir(OUT_DIR);
  console.log("Phase 1: Collecting product URLs from PharmEasy sitemaps\n");

  const sitemapIndexes = [
    "https://pharmeasy.in/sitemaps/sitemap-prescription-medicines.xml",
    "https://pharmeasy.in/sitemaps/sitemap-otc-products.xml",
  ];

  const allUrls = new Set();

  for (const indexUrl of sitemapIndexes) {
    console.log(`Fetching sitemap index: ${indexUrl}`);
    const indexXml = await fetchXml(indexUrl);
    const subSitemapUrls = extractLocsFromXml(indexXml);
    console.log(`  Found ${subSitemapUrls.length} sub-sitemaps\n`);

    for (let i = 0; i < subSitemapUrls.length; i++) {
      const subUrl = subSitemapUrls[i];
      try {
        const xml = await fetchXml(subUrl);
        const urls = extractLocsFromXml(xml);
        // Filter only product pages (online-medicine-order or otc)
        const productUrls = urls.filter(
          (u) => u.includes("/online-medicine-order/") || u.includes("/otc/")
        );
        for (const u of productUrls) allUrls.add(u);
        console.log(
          `  Sub-sitemap ${i + 1}/${subSitemapUrls.length}: ${productUrls.length} product URLs (total: ${allUrls.size})`
        );
      } catch (err) {
        console.error(`  ERROR on ${subUrl}: ${err.message}`);
      }
      await sleep(300);
    }
  }

  const urlArray = Array.from(allUrls);
  fs.writeFileSync(URLS_FILE, JSON.stringify(urlArray, null, 2));

  const rxCount = urlArray.filter((u) => u.includes("/online-medicine-order/")).length;
  const otcCount = urlArray.filter((u) => u.includes("/otc/")).length;
  console.log(`\nSaved ${urlArray.length} unique product URLs to ${URLS_FILE}`);
  console.log(`  Prescription: ${rxCount}`);
  console.log(`  OTC: ${otcCount}`);
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

function extractNextData(html) {
  const match = html.match(
    /<script\s+id="__NEXT_DATA__"\s+type="application\/json">\s*({.+?})\s*<\/script>/s
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function extractProduct(nextData, url) {
  const pd = nextData?.props?.pageProps?.productDetails;
  if (!pd || !pd.name) return null;

  const isOtc = url.includes("/otc/") || url.includes("/health-care/products/");

  return {
    name: pd.name,
    slug: pd.slug || "",
    url,
    productId: pd.productId || 0,
    composition: pd.molecule || (pd.compositions?.[0]?.name) || "",
    compositionSlug: pd.compositions?.[0]?.slug || "",
    manufacturer: pd.manufacturer || "",
    brand: pd.consumerBrandName || "",
    mrp: parseFloat(pd.costPrice) || 0,
    sellingPrice: parseFloat(pd.salePrice) || 0,
    discountPercent: parseFloat(pd.discountPercent) || 0,
    packSize: pd.measurementUnit || "",
    dosageForm: pd.dosageForm || "",
    inStock: pd.isAvailable !== false,
    rxRequired: !!pd.isRxRequired,
    therapy: pd.therapy || "",
    productType: isOtc ? "otc" : "prescription",
    rating: pd.ratingDetails?.value || 0,
    ratingCount: pd.ratingDetails?.count || 0,
  };
}

async function scrapeProducts() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(URLS_FILE)) {
    console.log("No URLs file found. Run Phase 1 first:");
    console.log("  node scripts/harvest-pharmeasy-sitemap.js urls");
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

        const nextData = extractNextData(html);
        if (!nextData) return { url, product: null, reason: "no_next_data" };

        const product = extractProduct(nextData, url);
        if (!product) return { url, product: null, reason: "no_product_data" };

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
  console.log("PharmEasy Sitemap Harvester - Stats\n");

  if (fs.existsSync(URLS_FILE)) {
    const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
    const rxCount = urls.filter((u) => u.includes("/online-medicine-order/")).length;
    const otcCount = urls.filter((u) => u.includes("/otc/")).length;
    console.log(`URLs collected: ${urls.length}`);
    console.log(`  Prescription: ${rxCount}`);
    console.log(`  OTC: ${otcCount}`);
  } else {
    console.log("No URLs file yet. Run: node scripts/harvest-pharmeasy-sitemap.js urls");
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
    const withComposition = products.filter((p) => p.composition).length;
    const withMfr = products.filter((p) => p.manufacturer).length;
    const inStock = products.filter((p) => p.inStock).length;
    const manufacturers = new Set(products.map((p) => p.manufacturer).filter(Boolean)).size;
    const rx = products.filter((p) => p.productType === "prescription").length;
    const otc = products.filter((p) => p.productType === "otc").length;

    console.log(`Total products: ${products.length}`);
    console.log(`With price: ${withPrice} (${((withPrice / products.length) * 100).toFixed(0)}%)`);
    console.log(`With composition: ${withComposition} (${((withComposition / products.length) * 100).toFixed(0)}%)`);
    console.log(`With manufacturer: ${withMfr} (${((withMfr / products.length) * 100).toFixed(0)}%)`);
    console.log(`In stock: ${inStock} (${((inStock / products.length) * 100).toFixed(0)}%)`);
    console.log(`Unique manufacturers: ${manufacturers}`);
    console.log(`Prescription: ${rx} | OTC: ${otc}`);

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
