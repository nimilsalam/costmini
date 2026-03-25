/**
 * Extract drug/salt names from UpToDate articles and map to our database.
 *
 * Steps:
 * 1. Parse all "Drug information" folders → extract drug names
 * 2. Filter out non-medicine items (cosmetics, devices, etc.)
 * 3. Match against our DB composition groups and drugs
 * 4. Output: curated list of clinically relevant compositions
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const UPTODATE_DIR = path.join(__dirname, "..", "uptodate");
const DB_PATH = path.join(__dirname, "..", "dev.db");
const OUTPUT_FILE = path.join(__dirname, "..", "data", "uptodate-drug-map.json");

// Non-medicine keywords to filter out
const EXCLUDE_PATTERNS = [
  /toothpaste/i, /shampoo/i, /moisturiz/i, /sunscreen/i, /deodorant/i,
  /cosmetic/i, /beauty/i, /fragrance/i, /perfume/i, /lipstick/i,
  /nail\s*polish/i, /hair\s*dye/i, /face\s*wash/i, /body\s*wash/i,
  /anesthesia/i, /techniques?$/i, /surgery$/i, /overview/i,
  /management$/i, /diagnosis$/i, /screening$/i, /prevention$/i,
  /evaluation$/i, /treatment$/i, /approach\s+to/i, /clinical\s+manifestation/i,
];

// Parse UpToDate folder names to extract drug names
function extractDrugNames() {
  const dirs = fs.readdirSync(UPTODATE_DIR);
  const drugs = [];

  for (const dir of dirs) {
    // Only process "Drug information" and "Patient drug information" folders
    if (!dir.includes("Drug information") && !dir.includes("Patient drug information")) continue;

    // Extract drug name from folder name: "10000_Tobramycin Drug information" → "Tobramycin"
    const match = dir.match(/^\d+_(.+?)\s+(Drug information|Patient drug information)$/);
    if (!match) continue;

    let name = match[1].trim();

    // Clean up common suffixes
    name = name
      .replace(/\s*\(.*?\)\s*/g, " ")  // Remove parenthetical notes
      .replace(/\s*United States.*$/i, "")
      .replace(/\s*Withdrawn.*$/i, "")
      .replace(/\s*Not available.*$/i, "")
      .replace(/\s*Availability limited.*$/i, "")
      .trim();

    if (!name || name.length < 2) continue;

    // Skip non-medicine items
    if (EXCLUDE_PATTERNS.some(p => p.test(name))) continue;
    if (EXCLUDE_PATTERNS.some(p => p.test(dir))) continue;

    // Read index.json for metadata
    const indexPath = path.join(UPTODATE_DIR, dir, "index.json");
    let meta = {};
    try {
      if (fs.existsSync(indexPath)) {
        meta = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      }
    } catch { /* ignore */ }

    drugs.push({
      id: meta.id || dir.split("_")[0],
      name,
      type: meta.type || "drug",
      subtype: meta.subtype || "",
      folderName: dir,
    });
  }

  return drugs;
}

// Normalize drug name for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Split combination drugs: "Tobramycin and dexamethasone" → ["tobramycin", "dexamethasone"]
function splitCombination(name) {
  const parts = name.split(/\s+and\s+|\s*\/\s*|\s*;\s*/i);
  return parts.map(p => normalizeName(p)).filter(p => p.length > 2);
}

function main() {
  console.log("════════════════════════════════════════════════");
  console.log("  UPTODATE DRUG EXTRACTION & DATABASE MAPPING");
  console.log("════════════════════════════════════════════════\n");

  // Step 1: Extract drug names
  const uptodateDrugs = extractDrugNames();
  console.log(`Extracted ${uptodateDrugs.length} drug entries from UpToDate\n`);

  // Deduplicate by normalized name
  const seen = new Set();
  const unique = [];
  for (const d of uptodateDrugs) {
    const key = normalizeName(d.name);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(d);
  }
  console.log(`Unique drugs: ${unique.length}\n`);

  // Step 2: Build salt list (including combinations)
  const allSalts = new Set();
  for (const d of unique) {
    const parts = splitCombination(d.name);
    parts.forEach(p => allSalts.add(p));
  }
  console.log(`Unique salts/ingredients: ${allSalts.size}\n`);

  // Step 3: Match against database
  const db = new Database(DB_PATH);

  // Get all composition groups
  const groups = db.prepare("SELECT id, displayName, compositionKey, primarySalt, drugCount, lowestPrice, highestPrice FROM CompositionGroup WHERE drugCount > 0").all();
  console.log(`Composition groups in DB: ${groups.length}\n`);

  // Match each UpToDate drug to composition groups
  const matched = [];
  const unmatched = [];
  const matchedGroupIds = new Set();

  for (const drug of unique) {
    const parts = splitCombination(drug.name);
    let bestMatch = null;
    let bestScore = 0;

    for (const group of groups) {
      const groupKey = (group.compositionKey || "").toLowerCase();
      const groupDisplay = (group.displayName || "").toLowerCase();
      const groupSalt = (group.primarySalt || "").toLowerCase();

      // Exact match on primary salt
      for (const part of parts) {
        if (groupSalt === part || groupDisplay === part) {
          const score = 100;
          if (score > bestScore) { bestScore = score; bestMatch = group; }
        }
        // Starts with match
        else if (groupSalt.startsWith(part) || groupDisplay.startsWith(part)) {
          const score = 80;
          if (score > bestScore) { bestScore = score; bestMatch = group; }
        }
        // Contains match (less reliable)
        else if (groupKey.includes(part) && part.length > 4) {
          const score = 60;
          if (score > bestScore) { bestScore = score; bestMatch = group; }
        }
      }
    }

    if (bestMatch && bestScore >= 60) {
      matched.push({
        uptodateName: drug.name,
        uptodateId: drug.id,
        compositionGroupId: bestMatch.id,
        compositionDisplay: bestMatch.displayName,
        drugCount: bestMatch.drugCount,
        lowestPrice: bestMatch.lowestPrice,
        highestPrice: bestMatch.highestPrice,
        matchScore: bestScore,
      });
      matchedGroupIds.add(bestMatch.id);
    } else {
      unmatched.push(drug.name);
    }
  }

  // Step 4: Get stats
  const totalDrugsInMatched = db.prepare(
    `SELECT COUNT(*) as c FROM Drug WHERE compositionGroupId IN (${[...matchedGroupIds].map(() => "?").join(",")})`,
  ).get(...matchedGroupIds);

  const totalPricesInMatched = db.prepare(
    `SELECT COUNT(*) as c FROM DrugPrice WHERE drugId IN (SELECT id FROM Drug WHERE compositionGroupId IN (${[...matchedGroupIds].map(() => "?").join(",")}))`,
  ).get(...matchedGroupIds);

  console.log("════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("════════════════════════════════════════════════");
  console.log(`  UpToDate drugs extracted: ${unique.length}`);
  console.log(`  Matched to DB compositions: ${matched.length} (${Math.round(matched.length / unique.length * 100)}%)`);
  console.log(`  Unmatched: ${unmatched.length}`);
  console.log(`  Unique composition groups matched: ${matchedGroupIds.size}`);
  console.log(`  Drugs in matched groups: ${totalDrugsInMatched?.c || 0}`);
  console.log(`  Prices in matched groups: ${totalPricesInMatched?.c || 0}`);

  // Top matched compositions
  console.log("\n▸ TOP MATCHED COMPOSITIONS (by drug count):");
  const topMatched = [...matched].sort((a, b) => b.drugCount - a.drugCount).slice(0, 20);
  topMatched.forEach(m => {
    console.log(`  ${String(m.drugCount).padStart(5)} brands  ${m.compositionDisplay.padEnd(35)} ← ${m.uptodateName}`);
  });

  // Unmatched drugs (first 30)
  console.log(`\n▸ UNMATCHED DRUGS (${unmatched.length} total, first 30):`);
  unmatched.slice(0, 30).forEach(n => console.log(`  • ${n}`));

  // Save output
  const output = {
    extractedAt: new Date().toISOString(),
    totalUptodate: unique.length,
    totalMatched: matched.length,
    totalUnmatched: unmatched.length,
    matchedGroupIds: [...matchedGroupIds],
    matched: matched.sort((a, b) => b.drugCount - a.drugCount),
    unmatched,
  };

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nSaved to ${OUTPUT_FILE}`);

  db.close();
}

main();
