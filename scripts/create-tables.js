/**
 * Create SQLite tables matching Prisma schema.
 * Prisma 7 + better-sqlite3 adapter doesn't support `db push` properly.
 */
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "dev.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");

db.exec(`
-- Manufacturers
CREATE TABLE IF NOT EXISTS Manufacturer (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  headquarters TEXT,
  foundedYear INTEGER,
  marketCapBillion REAL,
  globalRank INTEGER,
  usFdaApproved INTEGER NOT NULL DEFAULT 0,
  whoPrequalified INTEGER NOT NULL DEFAULT 0,
  eugmpCompliant INTEGER NOT NULL DEFAULT 0,
  qualityScore REAL NOT NULL DEFAULT 50,
  reliabilityScore REAL NOT NULL DEFAULT 50,
  overallScore REAL NOT NULL DEFAULT 50,
  tier TEXT NOT NULL DEFAULT 'standard',
  description TEXT,
  websiteUrl TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mfr_score ON Manufacturer(overallScore);
CREATE INDEX IF NOT EXISTS idx_mfr_tier ON Manufacturer(tier);

-- Composition Groups
CREATE TABLE IF NOT EXISTS CompositionGroup (
  id TEXT PRIMARY KEY,
  compositionKey TEXT NOT NULL UNIQUE,
  displayName TEXT NOT NULL,
  primarySalt TEXT NOT NULL,
  strength TEXT NOT NULL,
  dosageForm TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Others',
  drugCount INTEGER NOT NULL DEFAULT 0,
  lowestPrice REAL,
  highestPrice REAL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cg_salt ON CompositionGroup(primarySalt);
CREATE INDEX IF NOT EXISTS idx_cg_cat ON CompositionGroup(category);
CREATE INDEX IF NOT EXISTS idx_cg_count ON CompositionGroup(drugCount);

-- Drugs
CREATE TABLE IF NOT EXISTS Drug (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  genericName TEXT NOT NULL,
  brandName TEXT,
  manufacturer TEXT NOT NULL,
  manufacturerId TEXT,
  compositionGroupId TEXT,
  composition TEXT NOT NULL,
  category TEXT NOT NULL,
  dosageForm TEXT NOT NULL,
  packSize TEXT NOT NULL,
  prescriptionReq INTEGER NOT NULL DEFAULT 0,
  isGeneric INTEGER NOT NULL DEFAULT 0,
  whoCertified INTEGER NOT NULL DEFAULT 0,
  imageUrl TEXT,
  description TEXT,
  sideEffects TEXT,
  uses TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (manufacturerId) REFERENCES Manufacturer(id),
  FOREIGN KEY (compositionGroupId) REFERENCES CompositionGroup(id)
);
CREATE INDEX IF NOT EXISTS idx_drug_generic ON Drug(genericName);
CREATE INDEX IF NOT EXISTS idx_drug_name ON Drug(name);
CREATE INDEX IF NOT EXISTS idx_drug_cat ON Drug(category);
CREATE INDEX IF NOT EXISTS idx_drug_slug ON Drug(slug);
CREATE INDEX IF NOT EXISTS idx_drug_mfr ON Drug(manufacturerId);
CREATE INDEX IF NOT EXISTS idx_drug_cg ON Drug(compositionGroupId);
CREATE INDEX IF NOT EXISTS idx_drug_name_nocase ON Drug(name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_drug_genericname_nocase ON Drug(genericName COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_drug_composition_nocase ON Drug(composition COLLATE NOCASE);

-- Drug Prices
CREATE TABLE IF NOT EXISTS DrugPrice (
  id TEXT PRIMARY KEY,
  drugId TEXT NOT NULL,
  source TEXT NOT NULL,
  sourceUrl TEXT,
  mrp REAL NOT NULL,
  sellingPrice REAL NOT NULL,
  discount REAL NOT NULL DEFAULT 0,
  inStock INTEGER NOT NULL DEFAULT 1,
  lastChecked TEXT NOT NULL DEFAULT (datetime('now')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (drugId) REFERENCES Drug(id),
  UNIQUE(drugId, source)
);
CREATE INDEX IF NOT EXISTS idx_dp_drug ON DrugPrice(drugId);
CREATE INDEX IF NOT EXISTS idx_dp_source ON DrugPrice(source);

-- Drug Alternatives
CREATE TABLE IF NOT EXISTS DrugAlternative (
  id TEXT PRIMARY KEY,
  originalDrugId TEXT NOT NULL,
  alternativeDrugId TEXT NOT NULL,
  savingsPercent REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (originalDrugId) REFERENCES Drug(id),
  FOREIGN KEY (alternativeDrugId) REFERENCES Drug(id),
  UNIQUE(originalDrugId, alternativeDrugId)
);

-- Procedures
CREATE TABLE IF NOT EXISTS Procedure (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  description TEXT,
  duration TEXT,
  recoveryTime TEXT,
  anesthesia TEXT,
  imageUrl TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_proc_cat ON Procedure(category);

CREATE TABLE IF NOT EXISTS ProcedurePrice (
  id TEXT PRIMARY KEY,
  procedureId TEXT NOT NULL,
  hospitalName TEXT NOT NULL,
  city TEXT NOT NULL,
  minPrice REAL NOT NULL,
  maxPrice REAL NOT NULL,
  avgPrice REAL NOT NULL,
  includesStay INTEGER NOT NULL DEFAULT 0,
  accreditation TEXT,
  rating REAL,
  lastChecked TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (procedureId) REFERENCES Procedure(id)
);
CREATE INDEX IF NOT EXISTS idx_pp_proc ON ProcedurePrice(procedureId);
CREATE INDEX IF NOT EXISTS idx_pp_city ON ProcedurePrice(city);

-- Diagnostics
CREATE TABLE IF NOT EXISTS Diagnostic (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  preparation TEXT,
  reportTime TEXT,
  homeCollection INTEGER NOT NULL DEFAULT 0,
  imageUrl TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diag_cat ON Diagnostic(category);
CREATE INDEX IF NOT EXISTS idx_diag_type ON Diagnostic(type);

CREATE TABLE IF NOT EXISTS DiagnosticPrice (
  id TEXT PRIMARY KEY,
  diagnosticId TEXT NOT NULL,
  labName TEXT NOT NULL,
  city TEXT NOT NULL,
  mrp REAL NOT NULL,
  sellingPrice REAL NOT NULL,
  homeCollection INTEGER NOT NULL DEFAULT 0,
  accreditation TEXT,
  lastChecked TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (diagnosticId) REFERENCES Diagnostic(id)
);
CREATE INDEX IF NOT EXISTS idx_diagp_diag ON DiagnosticPrice(diagnosticId);
CREATE INDEX IF NOT EXISTS idx_diagp_city ON DiagnosticPrice(city);

-- Sync Log
CREATE TABLE IF NOT EXISTS SyncLog (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  drugsTotal INTEGER NOT NULL DEFAULT 0,
  drugsUpdated INTEGER NOT NULL DEFAULT 0,
  drugsFailed INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  startedAt TEXT NOT NULL DEFAULT (datetime('now')),
  completedAt TEXT
);

-- Prescription Scan
CREATE TABLE IF NOT EXISTS PrescriptionScan (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  imageUrl TEXT,
  rawText TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scan_session ON PrescriptionScan(sessionId);

CREATE TABLE IF NOT EXISTS ScanResult (
  id TEXT PRIMARY KEY,
  scanId TEXT NOT NULL,
  extractedName TEXT NOT NULL,
  matchedDrugId TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  quantity TEXT,
  dosage TEXT,
  FOREIGN KEY (scanId) REFERENCES PrescriptionScan(id),
  FOREIGN KEY (matchedDrugId) REFERENCES Drug(id)
);
CREATE INDEX IF NOT EXISTS idx_sr_scan ON ScanResult(scanId);
`);

// Verify
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log("Tables created:", tables.map(t => t.name).join(", "));

const counts = {};
for (const t of tables) {
  if (t.name.startsWith("sqlite_")) continue;
  counts[t.name] = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
}
console.log("Row counts:", counts);

db.close();
