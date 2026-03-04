-- CreateTable
CREATE TABLE "Drug" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "genericName" TEXT NOT NULL,
    "brandName" TEXT,
    "manufacturer" TEXT NOT NULL,
    "composition" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "dosageForm" TEXT NOT NULL,
    "packSize" TEXT NOT NULL,
    "prescriptionReq" BOOLEAN NOT NULL DEFAULT false,
    "isGeneric" BOOLEAN NOT NULL DEFAULT false,
    "whoCertified" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "description" TEXT,
    "sideEffects" TEXT,
    "uses" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DrugPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "drugId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "mrp" REAL NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "discount" REAL NOT NULL DEFAULT 0,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DrugPrice_drugId_fkey" FOREIGN KEY ("drugId") REFERENCES "Drug" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DrugAlternative" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "originalDrugId" TEXT NOT NULL,
    "alternativeDrugId" TEXT NOT NULL,
    "savingsPercent" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "DrugAlternative_originalDrugId_fkey" FOREIGN KEY ("originalDrugId") REFERENCES "Drug" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DrugAlternative_alternativeDrugId_fkey" FOREIGN KEY ("alternativeDrugId") REFERENCES "Drug" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "duration" TEXT,
    "recoveryTime" TEXT,
    "anesthesia" TEXT,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcedurePrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "procedureId" TEXT NOT NULL,
    "hospitalName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "minPrice" REAL NOT NULL,
    "maxPrice" REAL NOT NULL,
    "avgPrice" REAL NOT NULL,
    "includesStay" BOOLEAN NOT NULL DEFAULT false,
    "accreditation" TEXT,
    "rating" REAL,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProcedurePrice_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Diagnostic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "preparation" TEXT,
    "reportTime" TEXT,
    "homeCollection" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DiagnosticPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diagnosticId" TEXT NOT NULL,
    "labName" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "mrp" REAL NOT NULL,
    "sellingPrice" REAL NOT NULL,
    "homeCollection" BOOLEAN NOT NULL DEFAULT false,
    "accreditation" TEXT,
    "lastChecked" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiagnosticPrice_diagnosticId_fkey" FOREIGN KEY ("diagnosticId") REFERENCES "Diagnostic" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PrescriptionScan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "imageUrl" TEXT,
    "rawText" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "scanId" TEXT NOT NULL,
    "extractedName" TEXT NOT NULL,
    "matchedDrugId" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "quantity" TEXT,
    "dosage" TEXT,
    CONSTRAINT "ScanResult_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "PrescriptionScan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ScanResult_matchedDrugId_fkey" FOREIGN KEY ("matchedDrugId") REFERENCES "Drug" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Drug_genericName_idx" ON "Drug"("genericName");

-- CreateIndex
CREATE INDEX "Drug_name_idx" ON "Drug"("name");

-- CreateIndex
CREATE INDEX "Drug_category_idx" ON "Drug"("category");

-- CreateIndex
CREATE INDEX "DrugPrice_drugId_idx" ON "DrugPrice"("drugId");

-- CreateIndex
CREATE INDEX "DrugPrice_source_idx" ON "DrugPrice"("source");

-- CreateIndex
CREATE UNIQUE INDEX "DrugAlternative_originalDrugId_alternativeDrugId_key" ON "DrugAlternative"("originalDrugId", "alternativeDrugId");

-- CreateIndex
CREATE UNIQUE INDEX "Procedure_slug_key" ON "Procedure"("slug");

-- CreateIndex
CREATE INDEX "Procedure_category_idx" ON "Procedure"("category");

-- CreateIndex
CREATE INDEX "ProcedurePrice_procedureId_idx" ON "ProcedurePrice"("procedureId");

-- CreateIndex
CREATE INDEX "ProcedurePrice_city_idx" ON "ProcedurePrice"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Diagnostic_slug_key" ON "Diagnostic"("slug");

-- CreateIndex
CREATE INDEX "Diagnostic_category_idx" ON "Diagnostic"("category");

-- CreateIndex
CREATE INDEX "Diagnostic_type_idx" ON "Diagnostic"("type");

-- CreateIndex
CREATE INDEX "DiagnosticPrice_diagnosticId_idx" ON "DiagnosticPrice"("diagnosticId");

-- CreateIndex
CREATE INDEX "DiagnosticPrice_city_idx" ON "DiagnosticPrice"("city");

-- CreateIndex
CREATE INDEX "PrescriptionScan_sessionId_idx" ON "PrescriptionScan"("sessionId");

-- CreateIndex
CREATE INDEX "ScanResult_scanId_idx" ON "ScanResult"("scanId");
