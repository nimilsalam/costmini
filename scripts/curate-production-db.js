/**
 * Curate production database:
 * 1. Remove cosmetics, homeopathic, non-medicine products
 * 2. Match drugs across pharmacies by composition key
 * 3. Identify gaps where a composition exists on some pharmacies but not others
 * 4. Output gap report for AI enrichment
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const DB_PATH = path.join(__dirname, "..", "dev.db");
const CURATED_FILE = path.join(__dirname, "..", "data", "uptodate-curated-drugs.json");
const GAP_FILE = path.join(__dirname, "..", "data", "pharmacy-gaps.json");

function main() {
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");

  console.log("═══════════════════════════════════════════════════");
  console.log("  STEP 1: REMOVE NON-MEDICINE PRODUCTS");
  console.log("═══════════════════════════════════════════════════\n");

  const before = db.prepare("SELECT COUNT(*) as c FROM Drug").get().c;
  console.log("Drugs before cleanup:", before);

  // Identify non-medicine categories/patterns to remove
  const REMOVE_CATEGORIES = ["Beauty & Personal Care"];

  // Non-medicine name patterns
  const REMOVE_PATTERNS = [
    "%toothpaste%", "%toothbrush%", "%mouthwash%", "%dental floss%",
    "%shampoo%", "%conditioner%", "%hair oil%", "%hair serum%", "%hair mask%",
    "%face wash%", "%face cream%", "%face pack%", "%face mask%", "%face serum%",
    "%body wash%", "%body lotion%", "%body cream%", "%shower gel%",
    "%sunscreen%", "%sun block%", "%spf%",
    "%lipstick%", "%lip balm%", "%lip gloss%", "%kajal%", "%mascara%", "%eyeliner%",
    "%nail polish%", "%nail art%", "%nail paint%",
    "%perfume%", "%deodorant%", "%body spray%", "%air freshener%",
    "%diaper%", "%baby wipe%", "%feeding bottle%",
    "%hand sanitizer%", "%hand wash%", "%soap bar%",
    "%protein powder%", "%whey protein%", "%mass gainer%",
    "%green tea%", "%herbal tea%", "%coffee%",
    "%condom%", "%lubricant%",
    "%comb%", "%brush%", "%razor%", "%trimmer%",
    "%incense%", "%dhoop%", "%agarbatti%",
  ];

  // Remove by category
  for (const cat of REMOVE_CATEGORIES) {
    const r = db.prepare("DELETE FROM DrugPrice WHERE drugId IN (SELECT id FROM Drug WHERE category = ?)").run(cat);
    const r2 = db.prepare("DELETE FROM Drug WHERE category = ?").run(cat);
    console.log(`  Removed category '${cat}': ${r2.changes} drugs, ${r.changes} prices`);
  }

  // Remove by name pattern (non-medicine OTC)
  let patternRemoved = 0;
  const removeTx = db.transaction(() => {
    for (const pattern of REMOVE_PATTERNS) {
      const drugs = db.prepare("SELECT id FROM Drug WHERE LOWER(name) LIKE ?").all(pattern);
      if (drugs.length === 0) continue;
      const ids = drugs.map(d => d.id);
      // Batch delete in chunks
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const placeholders = chunk.map(() => "?").join(",");
        db.prepare(`DELETE FROM DrugPrice WHERE drugId IN (${placeholders})`).run(...chunk);
        db.prepare(`DELETE FROM Drug WHERE id IN (${placeholders})`).run(...chunk);
      }
      patternRemoved += drugs.length;
    }
  });
  removeTx();
  console.log(`  Removed by name patterns: ${patternRemoved} drugs`);

  // Remove homeopathic products (name contains common homeo patterns)
  const homeoPatterns = [
    "%dilution%", "%mother tincture%", "%globules%",
    "%biochemic%", "%bach flower%", "%trituration%",
  ];
  let homeoRemoved = 0;
  const homeoTx = db.transaction(() => {
    for (const pattern of homeoPatterns) {
      const drugs = db.prepare("SELECT id FROM Drug WHERE LOWER(name) LIKE ?").all(pattern);
      if (drugs.length === 0) continue;
      const ids = drugs.map(d => d.id);
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const placeholders = chunk.map(() => "?").join(",");
        db.prepare(`DELETE FROM DrugPrice WHERE drugId IN (${placeholders})`).run(...chunk);
        db.prepare(`DELETE FROM Drug WHERE id IN (${placeholders})`).run(...chunk);
      }
      homeoRemoved += drugs.length;
    }
  });
  homeoTx();
  console.log(`  Removed homeopathic: ${homeoRemoved} drugs`);

  // Remove drugs with no composition AND no prices (dead entries)
  const deadRemoved = db.prepare(`
    DELETE FROM Drug WHERE id IN (
      SELECT d.id FROM Drug d
      LEFT JOIN DrugPrice dp ON dp.drugId = d.id
      WHERE (d.composition IS NULL OR d.composition = '' OR d.composition = 'Unknown')
      AND dp.id IS NULL
    )
  `).run();
  console.log(`  Removed dead entries (no composition + no price): ${deadRemoved.changes}`);

  const after = db.prepare("SELECT COUNT(*) as c FROM Drug").get().c;
  console.log(`\n  Before: ${before} → After: ${after} (removed ${before - after})`);

  // Update composition group stats
  console.log("\n  Updating composition group stats...");
  db.prepare(`
    UPDATE CompositionGroup SET
      drugCount = (SELECT COUNT(*) FROM Drug WHERE compositionGroupId = CompositionGroup.id),
      lowestPrice = (SELECT MIN(dp.sellingPrice) FROM DrugPrice dp JOIN Drug d ON dp.drugId = d.id WHERE d.compositionGroupId = CompositionGroup.id AND dp.sellingPrice > 0),
      highestPrice = (SELECT MAX(dp.sellingPrice) FROM DrugPrice dp JOIN Drug d ON dp.drugId = d.id WHERE d.compositionGroupId = CompositionGroup.id)
  `).run();

  // Remove empty composition groups
  const emptyGroups = db.prepare("DELETE FROM CompositionGroup WHERE drugCount = 0").run();
  console.log(`  Removed ${emptyGroups.changes} empty composition groups`);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  STEP 2: CROSS-PHARMACY MATCHING BY COMPOSITION");
  console.log("═══════════════════════════════════════════════════\n");

  // For each composition group, check which pharmacies have drugs
  const groups = db.prepare(`
    SELECT cg.id, cg.displayName, cg.compositionKey, cg.drugCount,
           cg.lowestPrice, cg.highestPrice, cg.category
    FROM CompositionGroup cg
    WHERE cg.drugCount >= 1
    ORDER BY cg.drugCount DESC
  `).all();

  console.log(`Composition groups with drugs: ${groups.length}`);

  const getPharmacies = db.prepare(`
    SELECT DISTINCT dp.source FROM DrugPrice dp
    JOIN Drug d ON dp.drugId = d.id
    WHERE d.compositionGroupId = ?
  `);

  const ALL_PHARMACIES = ["1mg", "Netmeds", "PharmEasy", "Apollo"];

  let fullCoverage = 0;
  let threePlus = 0;
  let twoPlus = 0;
  let singleOnly = 0;
  const gaps = [];

  for (const group of groups) {
    const pharmacies = getPharmacies.all(group.id).map(r => r.source);
    const missing = ALL_PHARMACIES.filter(p => !pharmacies.includes(p));

    if (pharmacies.length >= 4) fullCoverage++;
    else if (pharmacies.length >= 3) threePlus++;
    else if (pharmacies.length >= 2) twoPlus++;
    else singleOnly++;

    if (missing.length > 0 && pharmacies.length >= 1 && group.drugCount >= 2) {
      gaps.push({
        compositionGroupId: group.id,
        displayName: group.displayName,
        compositionKey: group.compositionKey,
        category: group.category,
        drugCount: group.drugCount,
        hasPharmacies: pharmacies,
        missingPharmacies: missing,
        lowestPrice: group.lowestPrice,
        highestPrice: group.highestPrice,
      });
    }
  }

  console.log(`\n  Pharmacy coverage:`)
  console.log(`    4 pharmacies (full): ${fullCoverage}`);
  console.log(`    3 pharmacies: ${threePlus}`);
  console.log(`    2 pharmacies: ${twoPlus}`);
  console.log(`    1 pharmacy only: ${singleOnly}`);
  console.log(`    Gaps to fill: ${gaps.length} composition groups`);

  // Save gap report
  const gapReport = {
    generatedAt: new Date().toISOString(),
    totalGroups: groups.length,
    fullCoverage,
    threePlus,
    twoPlus,
    singleOnly,
    gaps: gaps.sort((a, b) => b.drugCount - a.drugCount),
  };
  fs.writeFileSync(GAP_FILE, JSON.stringify(gapReport, null, 2));
  console.log(`\n  Gap report saved to ${GAP_FILE}`);

  // Top gaps by drug count
  console.log("\n  Top 20 gaps (most brands, missing pharmacies):");
  gaps.slice(0, 20).forEach(g => {
    console.log(`    ${g.displayName.padEnd(35)} ${g.drugCount} brands | has: ${g.hasPharmacies.join(",")} | missing: ${g.missingPharmacies.join(",")}`);
  });

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  STEP 3: FINAL DATABASE STATS");
  console.log("═══════════════════════════════════════════════════\n");

  const finalDrugs = db.prepare("SELECT COUNT(*) as c FROM Drug").get().c;
  const finalPrices = db.prepare("SELECT COUNT(*) as c FROM DrugPrice").get().c;
  const finalGroups = db.prepare("SELECT COUNT(*) as c FROM CompositionGroup WHERE drugCount > 0").get().c;
  const finalMfrs = db.prepare("SELECT COUNT(DISTINCT manufacturer) as c FROM Drug WHERE manufacturer IS NOT NULL AND manufacturer != 'Unknown'").get().c;

  console.log(`  Drugs: ${finalDrugs}`);
  console.log(`  Prices: ${finalPrices}`);
  console.log(`  Composition groups: ${finalGroups}`);
  console.log(`  Manufacturers: ${finalMfrs}`);

  console.log("\n  By pharmacy:");
  db.prepare("SELECT source, COUNT(*) as c FROM DrugPrice GROUP BY source ORDER BY c DESC").all()
    .forEach(r => console.log(`    ${r.source.padEnd(15)} ${r.c} prices`));

  console.log("\n  By category:");
  db.prepare("SELECT category, COUNT(*) as c FROM Drug GROUP BY category ORDER BY c DESC LIMIT 20").all()
    .forEach(r => console.log(`    ${String(r.c).padStart(7)} ${r.category}`));

  console.log("\n  Multi-pharmacy drugs:");
  db.prepare(`
    SELECT pharmacyCount, COUNT(*) as drugs FROM (
      SELECT drugId, COUNT(DISTINCT source) as pharmacyCount FROM DrugPrice GROUP BY drugId
    ) GROUP BY pharmacyCount ORDER BY pharmacyCount
  `).all().forEach(r => console.log(`    ${r.pharmacyCount} pharmacies: ${r.drugs} drugs`));

  db.close();
  console.log("\nDone.");
}

main();
