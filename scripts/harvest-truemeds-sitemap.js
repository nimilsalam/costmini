/**
 * Truemeds sitemap harvester — ~220k products
 *
 * Sitemaps: sitemap-medicines-1.xml through sitemap-medicines-22.xml
 * Data: __NEXT_DATA__ → props.pageProps.originalMedicineDetails.product
 *
 * Usage:
 *   node scripts/harvest-truemeds-sitemap.js            # Scrape (default)
 *   node scripts/harvest-truemeds-sitemap.js --resume    # Resume
 *   node scripts/harvest-truemeds-sitemap.js urls        # Phase 1: collect URLs
 *   node scripts/harvest-truemeds-sitemap.js stats       # Show progress
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

const OUT_DIR = path.join(__dirname, "..", "data", "harvested", "truemeds-sitemap");
const URLS_FILE = path.join(OUT_DIR, "_urls.json");
const PRODUCTS_FILE = path.join(OUT_DIR, "_products.jsonl");
const PROGRESS_FILE = path.join(OUT_DIR, "_progress.json");

const CONCURRENCY = 2;
const DELAY_MS = 1000;
const CHECKPOINT_EVERY = 200;
const SITEMAP_COUNT = 22;

function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

function fetchUrl(url) {
  return new Promise((resolve) => {
    https.get(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" },
      timeout: 15000,
    }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchUrl(res.headers.location).then(resolve);
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve({ status: res.statusCode, data }));
    }).on("error", (e) => resolve({ status: 0, error: e.message }))
      .on("timeout", () => resolve({ status: 0, error: "timeout" }));
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Phase 1: Collect URLs from sitemaps
async function collectUrls() {
  ensureDir(OUT_DIR);
  console.log(`Collecting URLs from ${SITEMAP_COUNT} Truemeds sitemaps...`);

  const allUrls = [];
  for (let i = 1; i <= SITEMAP_COUNT; i++) {
    const url = `https://www.truemeds.in/sitemap-medicines-${i}.xml`;
    const r = await fetchUrl(url);
    if (r.status !== 200) { console.log(`  Sitemap ${i}: FAILED (${r.status})`); continue; }
    const urls = (r.data || "").match(/<loc>([^<]+)<\/loc>/g) || [];
    const productUrls = urls.map(u => u.replace(/<\/?loc>/g, ""));
    allUrls.push(...productUrls);
    console.log(`  Sitemap ${i}: ${productUrls.length} URLs (total: ${allUrls.length})`);
    await sleep(500);
  }

  fs.writeFileSync(URLS_FILE, JSON.stringify(allUrls, null, 0));
  console.log(`\nSaved ${allUrls.length} URLs to ${URLS_FILE}`);
}

function extractProduct(html, url) {
  const ndMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!ndMatch) return null;

  try {
    const nd = JSON.parse(ndMatch[1]);
    const pp = nd?.props?.pageProps;
    const prod = pp?.originalMedicineDetails?.product || pp?.currentMed?.product;
    if (!prod || !prod.skuName) return null;

    return {
      name: prod.skuName,
      slug: url.replace("https://www.truemeds.in/", "").replace(/^(medicine|otc)\//, ""),
      url,
      manufacturer: prod.manufacturerName || "",
      composition: prod.composition || "",
      mrp: parseFloat(prod.mrp) || 0,
      sellingPrice: parseFloat(prod.sellingPrice) || 0,
      packInfo: prod.packForm || "",
      packSize: prod.packSize || "",
      inStock: prod.availabilityStatus !== "Out of Stock",
      productType: url.includes("/otc/") ? "otc" : "drug",
      discount: parseFloat(prod.discount) || 0,
    };
  } catch {
    return null;
  }
}

async function scrapeProducts() {
  ensureDir(OUT_DIR);

  if (!fs.existsSync(URLS_FILE)) {
    console.log("No URLs file. Run: node scripts/harvest-truemeds-sitemap.js urls");
    process.exit(1);
  }

  const urls = JSON.parse(fs.readFileSync(URLS_FILE, "utf-8"));
  console.log(`Total product URLs: ${urls.length}`);

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

  const remaining = urls.filter(u => !completedUrls.has(u));
  console.log(`Remaining URLs: ${remaining.length}`);

  let urlsDone = completedUrls.size;
  let newProducts = 0;
  let errors = 0;
  let noData = 0;
  const startTime = Date.now();

  const fd = fs.openSync(PRODUCTS_FILE, "a");

  for (let i = 0; i < remaining.length; i += CONCURRENCY) {
    const batch = remaining.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (url) => {
      try {
        const r = await fetchUrl(url);
        if (r.status === 404) return { url, result: "404" };
        if (r.status !== 200) return { url, result: "error" };
        const product = extractProduct(r.data, url);
        if (!product) return { url, result: "no-data" };
        return { url, result: "ok", product };
      } catch {
        return { url, result: "error" };
      }
    }));

    for (const r of results) {
      completedUrls.add(r.url);
      urlsDone++;
      if (r.result === "ok") {
        fs.writeSync(fd, JSON.stringify(r.product) + "\n");
        productCount++;
        newProducts++;
      } else if (r.result === "error") {
        errors++;
      } else if (r.result === "no-data") {
        noData++;
      }
    }

    // Progress log
    if (urlsDone % 50 === 0 || i + CONCURRENCY >= remaining.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = newProducts / elapsed;
      const eta = remaining.length > 0 ? Math.round((remaining.length - i) / (rate || 1) / 60) : 0;
      const pct = ((urlsDone / urls.length) * 100).toFixed(1);
      process.stdout.write(`\r  [${pct}%] ${urlsDone}/${urls.length} URLs | ${productCount} products (+${newProducts} new) | ${noData} no-data | ${errors} err | ${rate.toFixed(1)}/s | ETA ~${eta}m   `);
    }

    // Checkpoint
    if (urlsDone % CHECKPOINT_EVERY === 0) {
      fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
        completedUrls: [...completedUrls],
        productCount,
        lastSaved: new Date().toISOString(),
      }));
      process.stdout.write("\n  [checkpoint] " + urlsDone + " URLs done, " + productCount + " products\n");
    }

    await sleep(DELAY_MS);
  }

  fs.closeSync(fd);

  // Final save
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify({
    completedUrls: [...completedUrls],
    productCount,
    lastSaved: new Date().toISOString(),
  }));

  console.log(`\n\nDone! ${productCount} products saved.`);
}

function showStats() {
  if (!fs.existsSync(PROGRESS_FILE)) { console.log("No progress file."); return; }
  const prog = JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8"));
  const totalUrls = fs.existsSync(URLS_FILE) ? JSON.parse(fs.readFileSync(URLS_FILE, "utf-8")).length : "?";
  console.log(`URLs done: ${prog.completedUrls?.length || 0} / ${totalUrls}`);
  console.log(`Products: ${prog.productCount}`);
  console.log(`Last saved: ${prog.lastSaved}`);
}

const cmd = process.argv[2];
if (cmd === "urls") collectUrls();
else if (cmd === "stats") showStats();
else scrapeProducts();
