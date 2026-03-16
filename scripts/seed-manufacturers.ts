import Database from "better-sqlite3";
import path from "path";
import { manufacturerSeedData } from "../src/lib/manufacturer-data";
import { computeManufacturerScores } from "../src/lib/manufacturer-scoring";

const DB_PATH = path.join(__dirname, "..", "dev.db");
const db = new Database(DB_PATH);

function cuid() { return "c" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

const updateMfrById = db.prepare(`
  UPDATE Manufacturer SET
    headquarters = ?, foundedYear = ?, marketCapBillion = ?, globalRank = ?,
    usFdaApproved = ?, whoPrequalified = ?, eugmpCompliant = ?,
    qualityScore = ?, reliabilityScore = ?, overallScore = ?,
    tier = ?, description = ?, websiteUrl = ?, updatedAt = datetime('now')
  WHERE id = ?
`);

const findMfr = db.prepare(`SELECT id, name FROM Manufacturer WHERE LOWER(name) LIKE LOWER(?) LIMIT 1`);

const insertMfr = db.prepare(`
  INSERT OR IGNORE INTO Manufacturer (id, name, slug, headquarters, foundedYear, marketCapBillion, globalRank,
    usFdaApproved, whoPrequalified, eugmpCompliant, qualityScore, reliabilityScore, overallScore, tier, description, websiteUrl)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let count = 0, updated = 0, inserted = 0;
const tx = db.transaction(() => {
  for (const mfrData of manufacturerSeedData) {
    const scores = computeManufacturerScores(mfrData);
    const m = { ...mfrData, ...scores };

    // Find existing manufacturer by partial name match (e.g., "Cipla" matches "Cipla Ltd")
    const existing = findMfr.get(`${m.name}%`) as { id: string; name: string } | undefined;

    if (existing) {
      updateMfrById.run(
        m.headquarters || null, m.foundedYear || null, m.marketCapBillion || null, m.globalRank || null,
        m.usFdaApproved ? 1 : 0, m.whoPrequalified ? 1 : 0, m.eugmpCompliant ? 1 : 0,
        m.qualityScore || 50, m.reliabilityScore || 50, m.overallScore || 50,
        m.tier || "standard", m.description || null, m.websiteUrl || null,
        existing.id
      );
      updated++;
    } else {
      try {
        insertMfr.run(cuid(), m.name, slugify(m.name),
          m.headquarters || null, m.foundedYear || null, m.marketCapBillion || null, m.globalRank || null,
          m.usFdaApproved ? 1 : 0, m.whoPrequalified ? 1 : 0, m.eugmpCompliant ? 1 : 0,
          m.qualityScore || 50, m.reliabilityScore || 50, m.overallScore || 50,
          m.tier || "standard", m.description || null, m.websiteUrl || null
        );
        inserted++;
      } catch { /* slug conflict — skip */ }
    }
    count++;
  }
});
tx();

console.log(`Seeded ${count} manufacturers (${updated} updated, ${inserted} inserted) with quality scores`);

// Link drugs to known manufacturers — fuzzy alias matching
console.log("Linking drugs to manufacturers...");

const knownMfrs = db.prepare("SELECT id, name FROM Manufacturer WHERE tier != 'standard' OR overallScore > 50").all() as { id: string; name: string }[];
console.log(`  ${knownMfrs.length} scored manufacturers to link`);


// Link unlinked drugs: find drugs whose manufacturer name starts with the known manufacturer name
const linkExact = db.prepare("UPDATE Drug SET manufacturerId = ? WHERE LOWER(manufacturer) = LOWER(?) AND manufacturerId IS NULL");
const linkLike = db.prepare("UPDATE Drug SET manufacturerId = ? WHERE LOWER(manufacturer) LIKE LOWER(?) AND manufacturerId IS NULL");
let totalLinked = 0;
const linkTx = db.transaction(() => {
  for (const mfr of knownMfrs) {
    // Exact match first
    let r = linkExact.run(mfr.id, mfr.name);
    totalLinked += r.changes;
    // Then partial match (name%)
    r = linkLike.run(mfr.id, `${mfr.name}%`);
    totalLinked += r.changes;
  }
});
linkTx();

console.log(`Linked ${totalLinked} drugs to known manufacturers`);
db.close();
