/**
 * Enhanced UpToDate → DB mapper with synonym support.
 *
 * 1. Extract all drug names from UpToDate folders
 * 2. Build synonym map (common alternate names)
 * 3. Match against DB compositions using fuzzy matching
 * 4. Mark matched compositions as "clinically relevant"
 * 5. Output the curated drug list for production
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const UPTODATE_DIR = path.join(__dirname, "..", "uptodate");
const DB_PATH = path.join(__dirname, "..", "dev.db");

// Common drug name synonyms/alternates used in India
const SYNONYMS = {
  "ursodeoxycholic acid": ["udca", "ursodiol"],
  "valproate": ["sodium valproate", "valproic acid", "divalproex"],
  "torsemide": ["torasemide"],
  "tretinoin": ["retinoic acid", "all-trans retinoic acid"],
  "acetaminophen": ["paracetamol"],
  "epinephrine": ["adrenaline"],
  "norepinephrine": ["noradrenaline"],
  "albuterol": ["salbutamol"],
  "furosemide": ["frusemide"],
  "sulfamethoxazole": ["cotrimoxazole", "septran"],
  "nifedipine": ["nifedipine"],
  "medroxyprogesterone": ["mpa"],
  "levothyroxine": ["thyroxine", "t4"],
  "liothyronine": ["t3"],
  "ergocalciferol": ["vitamin d2"],
  "cholecalciferol": ["vitamin d3"],
  "cyanocobalamin": ["vitamin b12"],
  "pyridoxine": ["vitamin b6"],
  "thiamine": ["vitamin b1"],
  "riboflavin": ["vitamin b2"],
  "ascorbic acid": ["vitamin c"],
  "tocopherol": ["vitamin e"],
  "phytomenadione": ["vitamin k", "phytonadione"],
  "acetylsalicylic acid": ["aspirin"],
  "ibuprofen": ["ibuprofen"],
  "diclofenac": ["diclofenac"],
  "metformin": ["metformin"],
  "glimepiride": ["glimepiride"],
  "atorvastatin": ["atorvastatin"],
  "rosuvastatin": ["rosuvastatin"],
  "amlodipine": ["amlodipine"],
  "telmisartan": ["telmisartan"],
  "losartan": ["losartan"],
  "omeprazole": ["omeprazole"],
  "pantoprazole": ["pantoprazole"],
  "rabeprazole": ["rabeprazole"],
  "esomeprazole": ["esomeprazole"],
  "lansoprazole": ["lansoprazole"],
  "amoxicillin": ["amoxycillin"],
  "cefalexin": ["cephalexin"],
  "cefuroxime": ["cefuroxime"],
  "azithromycin": ["azithromycin"],
  "levofloxacin": ["levofloxacin"],
  "ciprofloxacin": ["ciprofloxacin"],
  "metronidazole": ["metronidazole"],
  "clindamycin": ["clindamycin"],
  "fluconazole": ["fluconazole"],
  "itraconazole": ["itraconazole"],
  "acyclovir": ["aciclovir"],
  "isotretinoin": ["isotretinoin"],
  "montelukast": ["montelukast"],
  "cetirizine": ["cetirizine"],
  "levocetirizine": ["levocetirizine"],
  "fexofenadine": ["fexofenadine"],
  "escitalopram": ["escitalopram"],
  "sertraline": ["sertraline"],
  "fluoxetine": ["fluoxetine"],
  "clonazepam": ["clonazepam"],
  "alprazolam": ["alprazolam"],
  "gabapentin": ["gabapentin"],
  "pregabalin": ["pregabalin"],
  "carbamazepine": ["carbamazepine"],
  "phenytoin": ["phenytoin"],
  "levetiracetam": ["levetiracetam"],
  "warfarin": ["warfarin"],
  "enoxaparin": ["enoxaparin"],
  "clopidogrel": ["clopidogrel"],
  "insulin glargine": ["insulin glargine"],
  "sitagliptin": ["sitagliptin"],
  "empagliflozin": ["empagliflozin"],
  "dapagliflozin": ["dapagliflozin"],
  "tamsulosin": ["tamsulosin"],
  "sildenafil": ["sildenafil"],
  "tadalafil": ["tadalafil"],
  "finasteride": ["finasteride"],
  "dutasteride": ["dutasteride"],
  "domperidone": ["domperidone"],
  "ondansetron": ["ondansetron"],
  "metoclopramide": ["metoclopramide"],
  "prednisolone": ["prednisolone"],
  "dexamethasone": ["dexamethasone"],
  "methylprednisolone": ["methylprednisolone"],
  "hydroxychloroquine": ["hydroxychloroquine"],
  "methotrexate": ["methotrexate"],
  "tacrolimus": ["tacrolimus"],
  "cyclosporine": ["ciclosporin", "cyclosporin"],
  "mycophenolate": ["mycophenolate mofetil", "mycophenolic acid"],
};

// Non-medicine patterns to exclude
const EXCLUDE = [
  /toothpaste/i, /shampoo/i, /sunscreen/i, /cosmetic/i, /beauty/i,
  /fragrance/i, /deodorant/i, /lipstick/i, /nail\s*polish/i,
  /anesthesia for/i, /techniques?$/i, /surgery$/i, /^overview/i,
  /management$/i, /diagnosis$/i, /screening$/i, /prevention$/i,
  /clinical manifestation/i, /patient monitoring/i, /nerve block/i,
  /Tc-99m/i, /technetium/i, /radioactive/i, /radiopharmac/i,
  /gelatin.*boot/i, /oxidized.*cellulose/i, /protein.*concentrate/i,
  /skin test/i, /vaccine$/i, /immunoglobulin/i, /antithymocyte/i,
  /nitrous oxide/i, /^oxygen/i, /desiccated/i,
];

function extractDrugs() {
  const dirs = fs.readdirSync(UPTODATE_DIR);
  const drugs = new Map(); // name → metadata

  for (const dir of dirs) {
    if (!dir.includes("Drug information")) continue;

    const match = dir.match(/^\d+_(.+?)\s+(Patient drug information|Drug information)$/);
    if (!match) continue;

    let name = match[1].trim()
      .replace(/\s*\(.*?\)\s*/g, " ")
      .replace(/\s*United States.*$/i, "")
      .replace(/\s*Withdrawn.*$/i, "")
      .replace(/\s*Not available.*$/i, "")
      .replace(/\s*Availability limited.*$/i, "")
      .replace(/\s*including biosimilars.*$/i, "")
      .replace(/\s*conventional$/i, "")
      .replace(/\s*topical$/i, "")
      .replace(/\s*ophthalmic$/i, "")
      .replace(/\s*oral inhalation$/i, "")
      .replace(/\s*systemic$/i, "")
      .replace(/\s*nasal$/i, "")
      .replace(/\s*rectal$/i, "")
      .replace(/\s*otic$/i, "")
      .trim();

    if (!name || name.length < 3) continue;
    if (EXCLUDE.some(p => p.test(name) || p.test(dir))) continue;

    const key = name.toLowerCase();
    if (!drugs.has(key)) {
      drugs.set(key, { name, id: dir.split("_")[0] });
    }
  }

  return [...drugs.values()];
}

function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  UPTODATE → COSTMINI DATABASE MAPPING (Enhanced)");
  console.log("═══════════════════════════════════════════════════════\n");

  const drugs = extractDrugs();
  console.log(`Extracted ${drugs.length} unique drug entries\n`);

  // Build reverse synonym map: alternate → canonical
  const altToCanonical = new Map();
  for (const [canonical, alts] of Object.entries(SYNONYMS)) {
    altToCanonical.set(canonical.toLowerCase(), canonical.toLowerCase());
    for (const alt of alts) {
      altToCanonical.set(alt.toLowerCase(), canonical.toLowerCase());
    }
  }

  // Build search terms for each drug (original name + synonyms + combination parts)
  const searchTerms = new Map(); // drug name → [search terms]
  for (const drug of drugs) {
    const terms = new Set();
    const parts = drug.name.split(/\s+and\s+|\s*\/\s*|\s*;\s*|\s*,\s*/i);

    for (const part of parts) {
      const clean = part.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      if (clean.length < 3) continue;
      terms.add(clean);

      // Check synonyms
      const canonical = altToCanonical.get(clean);
      if (canonical) terms.add(canonical);

      // Also check all synonyms
      for (const [key, alts] of Object.entries(SYNONYMS)) {
        if (key.toLowerCase() === clean || alts.some(a => a.toLowerCase() === clean)) {
          terms.add(key.toLowerCase());
          alts.forEach(a => terms.add(a.toLowerCase()));
        }
      }
    }

    searchTerms.set(drug.name, [...terms]);
  }

  // Match against DB
  const db = new Database(DB_PATH);

  // Load all composition groups
  const groups = db.prepare(`
    SELECT id, displayName, compositionKey, primarySalt, drugCount, lowestPrice, highestPrice, category
    FROM CompositionGroup WHERE drugCount > 0
  `).all();

  // Build index for faster matching
  const groupIndex = new Map(); // lowercase term → group
  for (const g of groups) {
    const display = (g.displayName || "").toLowerCase();
    const salt = (g.primarySalt || "").toLowerCase();
    const key = (g.compositionKey || "").toLowerCase();

    if (display) groupIndex.set(display, g);
    if (salt && salt !== display) groupIndex.set(salt, g);

    // Also index individual salts from composition key (e.g., "paracetamol-500mg+caffeine-65mg")
    const saltParts = key.split("+").map(p => p.replace(/-\d+.*$/, "").trim());
    saltParts.forEach(s => {
      if (s.length > 3 && !groupIndex.has(s)) groupIndex.set(s, g);
    });
  }

  const matched = new Map(); // groupId → { uptodateNames, group }
  const unmatchedDrugs = [];

  for (const drug of drugs) {
    const terms = searchTerms.get(drug.name) || [drug.name.toLowerCase()];
    let found = false;

    for (const term of terms) {
      // Exact match
      const exact = groupIndex.get(term);
      if (exact) {
        if (!matched.has(exact.id)) {
          matched.set(exact.id, { uptodateNames: [], group: exact });
        }
        matched.get(exact.id).uptodateNames.push(drug.name);
        found = true;
        break;
      }

      // Partial match: term is a prefix of a group name
      for (const [gName, g] of groupIndex) {
        if (gName.startsWith(term) || term.startsWith(gName)) {
          if (!matched.has(g.id)) {
            matched.set(g.id, { uptodateNames: [], group: g });
          }
          matched.get(g.id).uptodateNames.push(drug.name);
          found = true;
          break;
        }
      }
      if (found) break;
    }

    if (!found) unmatchedDrugs.push(drug.name);
  }

  // Count drugs and prices in matched groups
  const matchedIds = [...matched.keys()];
  let totalDrugs = 0, totalPrices = 0;
  if (matchedIds.length > 0) {
    const placeholders = matchedIds.map(() => "?").join(",");
    totalDrugs = db.prepare(`SELECT COUNT(*) as c FROM Drug WHERE compositionGroupId IN (${placeholders})`).get(...matchedIds).c;
    totalPrices = db.prepare(`SELECT COUNT(*) as c FROM DrugPrice WHERE drugId IN (SELECT id FROM Drug WHERE compositionGroupId IN (${placeholders}))`).get(...matchedIds).c;
  }

  // Also count drugs that match by name/composition even without group
  const directNameMatches = db.prepare(`
    SELECT COUNT(DISTINCT d.id) as c FROM Drug d WHERE d.compositionGroupId NOT IN (${matchedIds.length > 0 ? matchedIds.map(() => "?").join(",") : "''"})
    AND (${drugs.slice(0, 100).map(() => "d.composition LIKE ?").join(" OR ")})
  `);

  console.log("═══════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  UpToDate drugs: ${drugs.length}`);
  console.log(`  Matched to composition groups: ${matched.size} groups`);
  console.log(`  UpToDate drugs matched: ${drugs.length - unmatchedDrugs.length} (${Math.round((drugs.length - unmatchedDrugs.length) / drugs.length * 100)}%)`);
  console.log(`  Unmatched: ${unmatchedDrugs.length}`);
  console.log(`  Drugs in matched groups: ${totalDrugs}`);
  console.log(`  Prices in matched groups: ${totalPrices}`);

  // Pharmacy breakdown for matched groups
  if (matchedIds.length > 0) {
    const placeholders = matchedIds.map(() => "?").join(",");
    console.log("\n▸ PHARMACY COVERAGE FOR CLINICALLY RELEVANT DRUGS:");
    db.prepare(`
      SELECT dp.source, COUNT(DISTINCT dp.drugId) as drugs, COUNT(*) as prices
      FROM DrugPrice dp
      JOIN Drug d ON dp.drugId = d.id
      WHERE d.compositionGroupId IN (${placeholders})
      GROUP BY dp.source ORDER BY drugs DESC
    `).all(...matchedIds).forEach(r => {
      console.log(`  ${r.source.padEnd(15)} ${r.drugs} drugs, ${r.prices} prices`);
    });
  }

  // Show top matched
  console.log("\n▸ TOP 25 MATCHED (by brand count):");
  [...matched.values()]
    .sort((a, b) => b.group.drugCount - a.group.drugCount)
    .slice(0, 25)
    .forEach(m => {
      console.log(`  ${String(m.group.drugCount).padStart(5)} brands  ${m.group.displayName.padEnd(40)} ← ${m.uptodateNames[0]}`);
    });

  // Show unmatched
  console.log(`\n▸ UNMATCHED (${unmatchedDrugs.length}), first 40:`);
  unmatchedDrugs.slice(0, 40).forEach(n => console.log(`  • ${n}`));

  // Save curated list
  const output = {
    generatedAt: new Date().toISOString(),
    stats: {
      totalUptodate: drugs.length,
      matchedGroups: matched.size,
      matchedDrugs: drugs.length - unmatchedDrugs.length,
      unmatchedDrugs: unmatchedDrugs.length,
      drugsInDB: totalDrugs,
      pricesInDB: totalPrices,
    },
    matchedCompositionGroupIds: matchedIds,
    matched: [...matched.values()].map(m => ({
      compositionGroupId: m.group.id,
      displayName: m.group.displayName,
      category: m.group.category,
      drugCount: m.group.drugCount,
      lowestPrice: m.group.lowestPrice,
      highestPrice: m.group.highestPrice,
      uptodateNames: m.uptodateNames,
    })).sort((a, b) => b.drugCount - a.drugCount),
    unmatched: unmatchedDrugs,
  };

  const outputPath = path.join(__dirname, "..", "data", "uptodate-curated-drugs.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved curated list to ${outputPath}`);

  db.close();
}

main();
