/**
 * Fix "Others" category for 156k+ drugs by mapping compositions to categories.
 * Uses a comprehensive molecule → category mapping.
 */
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "dev.db");
const db = new Database(DB_PATH);

// Comprehensive molecule → category mapping
const MOLECULE_CATEGORY = {
  // Pain Relief / NSAIDs
  "Pain Relief": [
    "PARACETAMOL", "IBUPROFEN", "DICLOFENAC", "ACECLOFENAC", "PIROXICAM", "ETORICOXIB",
    "NAPROXEN", "MEFENAMIC", "KETOROLAC", "INDOMETHACIN", "NIMESULIDE", "TRAMADOL",
    "ASPIRIN", "DEXKETOPROFEN", "FLURBIPROFEN", "LORNOXICAM", "CELECOXIB",
    "TAPENTADOL", "MORPHINE", "FENTANYL", "BUPRENORPHINE", "NALBUPHINE",
    "THIOCOLCHICOSIDE", "ETODOLAC", "MELOXICAM", "OXAPROZIN",
  ],
  // Antibiotics / Anti-infectives
  "Antibiotics": [
    "AMOXICILLIN", "AZITHROMYCIN", "CEFIXIME", "CIPROFLOXACIN", "LEVOFLOXACIN",
    "OFLOXACIN", "CEFTRIAXONE", "CEFUROXIME", "CEFPODOXIME", "CEPHALEXIN",
    "DOXYCYCLINE", "METRONIDAZOLE", "ORNIDAZOLE", "NITAZOXANIDE", "NORFLOXACIN",
    "AMIKACIN", "GENTAMICIN", "CLINDAMYCIN", "LINEZOLID", "VANCOMYCIN",
    "MOXIFLOXACIN", "GATIFLOXACIN", "TINIDAZOLE", "CLARITHROMYCIN", "ERYTHROMYCIN",
    "ROXITHROMYCIN", "RIFAXIMIN", "FAROPENEM", "CEFOPERAZONE", "SULBACTAM",
    "CLAVULANIC", "MEROPENEM", "IMIPENEM", "PIPERACILLIN", "TAZOBACTAM",
    "ERTAPENEM", "NITROFURANTOIN", "FOSFOMYCIN", "COLISTIN", "POLYMYXIN",
    "ALBENDAZOLE", "IVERMECTIN", "SECNIDAZOLE", "NALIDIXIC", "CEFADROXIL",
    "TOBRAMYCIN", "CHLORAMPHENICOL", "TETRACYCLINE", "MINOCYCLINE",
  ],
  // Diabetes
  "Diabetes": [
    "METFORMIN", "GLIMEPIRIDE", "INSULIN", "SITAGLIPTIN", "VILDAGLIPTIN",
    "GLICLAZIDE", "PIOGLITAZONE", "TENELIGLIPTIN", "EMPAGLIFLOZIN", "DAPAGLIFLOZIN",
    "CANAGLIFLOZIN", "LINAGLIPTIN", "SAXAGLIPTIN", "GLIPIZIDE", "REPAGLINIDE",
    "ACARBOSE", "VOGLIBOSE", "MIGLITOL", "NATEGLINIDE", "SEMAGLUTIDE",
    "LIRAGLUTIDE", "DULAGLUTIDE", "REMOGLIFLOZIN",
  ],
  // Heart & BP / Cardiovascular
  "Heart & BP": [
    "AMLODIPINE", "TELMISARTAN", "ATORVASTATIN", "LOSARTAN", "RAMIPRIL",
    "ENALAPRIL", "LISINOPRIL", "OLMESARTAN", "VALSARTAN", "IRBESARTAN",
    "METOPROLOL", "ATENOLOL", "BISOPROLOL", "NEBIVOLOL", "CARVEDILOL",
    "PROPRANOLOL", "ROSUVASTATIN", "SIMVASTATIN", "PRAVASTATIN", "FENOFIBRATE",
    "CLOPIDOGREL", "WARFARIN", "RIVAROXABAN", "APIXABAN", "DABIGATRAN",
    "CILNIDIPINE", "NIFEDIPINE", "DILTIAZEM", "VERAPAMIL", "NITROGLYCERIN",
    "ISOSORBIDE", "DIGOXIN", "AMIODARONE", "FUROSEMIDE", "TORSEMIDE",
    "HYDROCHLOROTHIAZIDE", "CHLORTHALIDONE", "SPIRONOLACTONE", "EPLERENONE",
    "PRAZOSIN", "DOXAZOSIN", "CLONIDINE", "SACUBITRIL", "IVABRADINE",
    "TRIMETAZIDINE", "RANOLAZINE", "TICAGRELOR", "PRASUGREL",
  ],
  // Gastro / GI
  "Gastro": [
    "OMEPRAZOLE", "PANTOPRAZOLE", "RABEPRAZOLE", "ESOMEPRAZOLE", "LANSOPRAZOLE",
    "DOMPERIDONE", "ONDANSETRON", "RANITIDINE", "FAMOTIDINE", "SUCRALFATE",
    "DEXRABEPRAZOLE", "ITOPRIDE", "MOSAPRIDE", "METOCLOPRAMIDE", "DROTAVERINE",
    "MEBEVERINE", "DICYCLOMINE", "HYOSCINE", "BISACODYL", "LACTULOSE",
    "MESALAMINE", "SULFASALAZINE", "URSODEOXYCHOLIC", "PANCREATIN",
    "ALUMINIUM HYDROXIDE", "MAGNESIUM HYDROXIDE", "OXETACAINE", "SIMETHICONE",
    "RACECADOTRIL", "LOPERAMIDE", "TEGASEROD", "PRUCALOPRIDE",
  ],
  // Respiratory / Asthma / Allergy
  "Respiratory": [
    "SALBUTAMOL", "MONTELUKAST", "LEVOSALBUTAMOL", "BUDESONIDE", "FLUTICASONE",
    "FORMOTEROL", "SALMETEROL", "TIOTROPIUM", "IPRATROPIUM", "THEOPHYLLINE",
    "AMINOPHYLLINE", "DEXTROMETHORPHAN", "CODEINE", "GUAIFENESIN", "AMBROXOL",
    "BROMHEXINE", "ACETYLCYSTEINE", "TERBUTALINE", "BAMBUTEROL",
    "BECLOMETHASONE", "CICLESONIDE", "UMECLIDINIUM", "GLYCOPYRRONIUM",
    "PHENYLEPHRINE", "PSEUDOEPHEDRINE", "OXYMETAZOLINE", "XYLOMETAZOLINE",
    "LEVODROPROPIZINE",
  ],
  // Anti-Allergic / Antihistamine
  "Anti-Allergic": [
    "CETIRIZINE", "LEVOCETIRIZINE", "FEXOFENADINE", "LORATADINE", "DESLORATADINE",
    "BILASTINE", "CHLORPHENIRAMINE", "HYDROXYZINE", "PROMETHAZINE",
    "EBASTINE", "RUPATADINE", "KETOTIFEN", "AZELASTINE", "OLOPATADINE",
  ],
  // Mental Health / Psychiatry
  "Mental Health": [
    "ESCITALOPRAM", "FLUOXETINE", "SERTRALINE", "PAROXETINE", "FLUVOXAMINE",
    "VENLAFAXINE", "DULOXETINE", "DESVENLAFAXINE", "MIRTAZAPINE", "BUPROPION",
    "AMITRIPTYLINE", "NORTRIPTYLINE", "IMIPRAMINE", "CLOMIPRAMINE",
    "CLONAZEPAM", "ALPRAZOLAM", "LORAZEPAM", "DIAZEPAM", "MIDAZOLAM",
    "OLANZAPINE", "RISPERIDONE", "QUETIAPINE", "ARIPIPRAZOLE", "HALOPERIDOL",
    "CHLORPROMAZINE", "LITHIUM", "VALPROATE", "LAMOTRIGINE", "CARBAMAZEPINE",
    "TRAZODONE", "BUSPIRONE", "ZOLPIDEM", "ZOPICLONE", "ESZOPICLONE",
    "MODAFINIL", "ATOMOXETINE", "METHYLPHENIDATE", "LURASIDONE", "PALIPERIDONE",
  ],
  // Neurology
  "Neurology": [
    "LEVETIRACETAM", "PHENYTOIN", "GABAPENTIN", "PREGABALIN", "TOPIRAMATE",
    "OXCARBAZEPINE", "LACOSAMIDE", "BRIVARACETAM", "PERAMPANEL",
    "LEVODOPA", "BENSERAZIDE", "CARBIDOPA", "ROPINIROLE", "PRAMIPEXOLE",
    "DONEPEZIL", "RIVASTIGMINE", "MEMANTINE", "GALANTAMINE",
    "METHYLCOBALAMIN", "MECOBALAMIN", "NORTRIPTYLINE",
    "PIRACETAM", "CITICOLINE", "RILUZOLE", "BACLOFEN", "TIZANIDINE",
    "SUMATRIPTAN", "RIZATRIPTAN", "FLUNARIZINE",
  ],
  // Skin Care / Dermatology
  "Skin Care": [
    "BETAMETHASONE", "CLOBETASOL", "MOMETASONE", "HYDROCORTISONE",
    "FUSIDIC", "MUPIROCIN", "SILVER SULFADIAZINE", "NEOMYCIN",
    "ADAPALENE", "TRETINOIN", "BENZOYL PEROXIDE", "ISOTRETINOIN",
    "TACROLIMUS", "PIMECROLIMUS", "CALCIPOTRIOL", "COAL TAR",
    "PERMETHRIN", "BENZYL BENZOATE", "LINDANE", "SALICYLIC ACID",
    "MINOXIDIL", "FINASTERIDE",
  ],
  // Anti-Fungal
  "Anti-Fungal": [
    "KETOCONAZOLE", "FLUCONAZOLE", "ITRACONAZOLE", "VORICONAZOLE",
    "TERBINAFINE", "CLOTRIMAZOLE", "MICONAZOLE", "AMPHOTERICIN",
    "CASPOFUNGIN", "GRISEOFULVIN", "NYSTATIN", "SERTACONAZOLE",
    "LULICONAZOLE", "AMOROLFINE", "EBERCONAZOLE",
  ],
  // Anti-Viral
  "Anti-Viral": [
    "ACYCLOVIR", "VALACYCLOVIR", "OSELTAMIVIR", "TENOFOVIR", "LAMIVUDINE",
    "ENTECAVIR", "SOFOSBUVIR", "DACLATASVIR", "VELPATASVIR", "LEDIPASVIR",
    "RIBAVIRIN", "REMDESIVIR", "MOLNUPIRAVIR", "NIRMATRELVIR",
    "EFAVIRENZ", "LOPINAVIR", "RITONAVIR", "DOLUTEGRAVIR",
  ],
  // Vitamins & Supplements
  "Vitamins": [
    "VITAMIN", "CALCIUM", "FOLIC ACID", "ZINC", "IRON", "FERROUS",
    "CHOLECALCIFEROL", "CYANOCOBALAMIN", "PYRIDOXINE", "THIAMINE",
    "RIBOFLAVIN", "NIACINAMIDE", "BIOTIN", "MECOBALAMIN",
    "OMEGA", "FISH OIL", "MULTIVITAMIN", "MINERAL",
    "MAGNESIUM", "POTASSIUM", "CHROMIUM", "SELENIUM",
    "L-CARNITINE", "COENZYME Q10", "ALPHA LIPOIC",
    "AMINO ACID", "PROTEIN", "WHEY",
  ],
  // Thyroid
  "Thyroid": [
    "LEVOTHYROXINE", "THYROXINE", "CARBIMAZOLE", "METHIMAZOLE",
    "PROPYLTHIOURACIL",
  ],
  // Eye Care
  "Eye Care": [
    "LATANOPROST", "TIMOLOL", "BRIMONIDINE", "DORZOLAMIDE", "TRAVOPROST",
    "BIMATOPROST", "BRINZOLAMIDE", "PILOCARPINE", "CARBOXYMETHYLCELLULOSE",
    "SODIUM HYALURONATE", "NEPAFENAC", "KETOROLAC EYE",
    "CYCLOPENTOLATE", "TROPICAMIDE", "ATROPINE EYE",
  ],
  // Women's Health
  "Women's Health": [
    "PROGESTERONE", "ESTROGEN", "ESTRADIOL", "NORETHISTERONE",
    "LEVONORGESTREL", "ETHINYL", "DROSPIRENONE", "DESOGESTREL",
    "LETROZOLE", "CLOMIPHENE", "GONADOTROPIN", "MISOPROSTOL",
    "MIFEPRISTONE", "DINOPROSTONE", "OXYTOCIN",
  ],
  // Oncology
  "Oncology": [
    "ERLOTINIB", "GEFITINIB", "IMATINIB", "SORAFENIB", "SUNITINIB",
    "LENALIDOMIDE", "TAMOXIFEN", "ANASTROZOLE", "EXEMESTANE",
    "CAPECITABINE", "METHOTREXATE", "CYCLOPHOSPHAMIDE",
    "NIVOLUMAB", "PEMBROLIZUMAB", "TRASTUZUMAB", "RITUXIMAB",
    "BORTEZOMIB", "PALBOCICLIB", "IBRUTINIB", "OSIMERTINIB",
    "ENZALUTAMIDE", "ABIRATERONE", "DAROLUTAMIDE",
  ],
  // Liver Care
  "Liver Care": [
    "SILYMARIN", "L-ORNITHINE", "LACTULOSE", "RIFAXIMIN",
    "URSODIOL", "URSODEOXYCHOLIC",
  ],
  // Kidney Care
  "Kidney Care": [
    "ERYTHROPOIETIN", "DARBEPOETIN", "SEVELAMER", "CINACALCET",
    "ALFACALCIDOL", "POLYSTYRENE",
  ],
  // Urology
  "Urology": [
    "TADALAFIL", "SILDENAFIL", "TAMSULOSIN", "ALFUZOSIN", "DUTASTERIDE",
    "FINASTERIDE", "SOLIFENACIN", "MIRABEGRON", "TOLTERODINE", "DESMOPRESSIN",
    "OXYBUTYNIN",
  ],
  // Corticosteroids / Immunosuppressants
  "Immunology": [
    "PREDNISOLONE", "METHYLPREDNISOLONE", "DEXAMETHASONE", "DEFLAZACORT",
    "TACROLIMUS", "CYCLOSPORINE", "MYCOPHENOLATE", "AZATHIOPRINE",
    "HYDROXYCHLOROQUINE", "COLCHICINE", "BARICITINIB", "TOFACITINIB",
  ],
};

// Build reverse map: molecule → category
const moleculeMap = new Map();
for (const [category, molecules] of Object.entries(MOLECULE_CATEGORY)) {
  for (const mol of molecules) {
    moleculeMap.set(mol, category);
  }
}

// Get all drugs in "Others" category
const others = db.prepare("SELECT id, composition, name FROM Drug WHERE category = 'Others'").all();
console.log(`Drugs in 'Others' category: ${others.length}`);

const updateStmt = db.prepare("UPDATE Drug SET category = ? WHERE id = ?");
let reclassified = 0;
const categoryCounts = {};

const tx = db.transaction(() => {
  for (const drug of others) {
    const comp = String(drug.composition || "").toUpperCase();
    const name = String(drug.name || "").toUpperCase();
    let newCat = null;

    // Check each molecule in our map against the composition
    for (const [molecule, category] of moleculeMap) {
      if (comp.includes(molecule)) {
        newCat = category;
        break;
      }
    }

    // Name-based fallback for non-medicines
    if (!newCat) {
      if (name.includes("SHAMPOO") || name.includes("HAIR")) newCat = "Hair Care";
      else if (name.includes("CREAM") || name.includes("OINTMENT") || name.includes("LOTION")) newCat = "Skin Care";
      else if (name.includes("SOAP") || name.includes("FACE WASH") || name.includes("BODY WASH")) newCat = "Skin Care";
      else if (name.includes("TOOTHPASTE") || name.includes("MOUTHWASH")) newCat = "Oral Care";
      else if (name.includes("DIAPER") || name.includes("BABY")) newCat = "Baby Care";
      else if (name.includes("SANITIZER") || name.includes("MASK") || name.includes("GLOVE")) newCat = "Healthcare Devices";
      else if (name.includes("BANDAGE") || name.includes("SYRINGE") || name.includes("THERMOMETER")) newCat = "Healthcare Devices";
    }

    if (newCat) {
      updateStmt.run(newCat, drug.id);
      reclassified++;
      categoryCounts[newCat] = (categoryCounts[newCat] || 0) + 1;
    }
  }
});
tx();

console.log(`\nReclassified: ${reclassified}/${others.length} drugs`);
console.log(`Remaining in Others: ${others.length - reclassified}`);
console.log("\nNew category distribution:");
for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(6)} ${cat}`);
}

// Update composition group categories too
db.exec(`
  UPDATE CompositionGroup SET category = (
    SELECT Drug.category FROM Drug WHERE Drug.compositionGroupId = CompositionGroup.id LIMIT 1
  )
  WHERE category = 'Others'
    AND EXISTS (SELECT 1 FROM Drug WHERE Drug.compositionGroupId = CompositionGroup.id AND Drug.category != 'Others')
`);

// Final stats
const cats = db.prepare("SELECT category, COUNT(*) as c FROM Drug GROUP BY category ORDER BY c DESC").all();
console.log("\nFinal category distribution:");
for (const { category, c } of cats) {
  console.log(`  ${c.toString().padStart(8)} ${category}`);
}

db.close();
