import Database from "better-sqlite3";
import path from "path";
import { sampleProcedures, sampleDiagnostics } from "../src/lib/sample-data";

const DB_PATH = path.join(__dirname, "..", "dev.db");
const db = new Database(DB_PATH);

function cuid() { return "c" + Date.now().toString(36) + Math.random().toString(36).substr(2, 9); }
function slugify(t: string) { return t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }

// Seed procedures
const insertProc = db.prepare("INSERT OR IGNORE INTO Procedure (id, name, slug, category, description, duration, recoveryTime, anesthesia) VALUES (?,?,?,?,?,?,?,?)");
const insertProcPrice = db.prepare("INSERT OR IGNORE INTO ProcedurePrice (id, procedureId, hospitalName, city, minPrice, maxPrice, avgPrice, includesStay, accreditation, rating) VALUES (?,?,?,?,?,?,?,?,?,?)");

let procs = 0, procPrices = 0;
const procTx = db.transaction(() => {
  for (const p of sampleProcedures) {
    const id = cuid();
    insertProc.run(id, p.name, slugify(p.name), p.category, p.description || "", p.duration || "", p.recoveryTime || "", p.anesthesia || "");
    procs++;
    for (const pr of (p.prices || [])) {
      insertProcPrice.run(cuid(), id, pr.hospitalName || "", pr.city || "", pr.minPrice || 0, pr.maxPrice || 0, pr.avgPrice || 0, pr.includesStay ? 1 : 0, pr.accreditation || "", pr.rating || 0);
      procPrices++;
    }
  }
});
procTx();

// Seed diagnostics
const insertDiag = db.prepare("INSERT OR IGNORE INTO Diagnostic (id, name, slug, category, type, description, preparation, reportTime, homeCollection) VALUES (?,?,?,?,?,?,?,?,?)");
const insertDiagPrice = db.prepare("INSERT OR IGNORE INTO DiagnosticPrice (id, diagnosticId, labName, city, mrp, sellingPrice, homeCollection, accreditation) VALUES (?,?,?,?,?,?,?,?)");

let diags = 0, diagPrices = 0;
const diagTx = db.transaction(() => {
  for (const d of sampleDiagnostics) {
    const id = cuid();
    insertDiag.run(id, d.name, slugify(d.name), d.category || "", d.type || "", d.description || "", d.preparation || "", d.reportTime || "", d.homeCollection ? 1 : 0);
    diags++;
    for (const pr of (d.prices || [])) {
      insertDiagPrice.run(cuid(), id, pr.labName || "", pr.city || "", pr.mrp || 0, pr.sellingPrice || 0, pr.homeCollection ? 1 : 0, pr.accreditation || "");
      diagPrices++;
    }
  }
});
diagTx();

console.log("Procedures:", procs, "prices:", procPrices);
console.log("Diagnostics:", diags, "prices:", diagPrices);
db.close();
