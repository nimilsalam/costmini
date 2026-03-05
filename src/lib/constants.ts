// Static category lists for frontend filter dropdowns
// These don't change at runtime — no need to query DB for them

export const drugCategories = [
  "Pain Relief",
  "Antibiotics",
  "Diabetes",
  "Heart & BP",
  "Gastro",
  "Vitamins",
  "Skin Care",
  "Respiratory",
  "Mental Health",
  "Thyroid",
  "Women's Health",
  "Eye/Ear",
  "Anti-allergic",
  "Liver",
  "Kidney",
];

export const procedureCategories = [
  "Orthopedics",
  "Ophthalmology",
  "General Surgery",
  "Cardiology",
  "Urology",
  "Gynecology",
  "ENT",
  "Neurology",
  "Cosmetic",
  "Dental",
];

export const diagnosticCategories = [
  "Blood Test",
  "Imaging",
  "Cardiac",
  "Urine Test",
  "Health Package",
];

export const dosageForms = [
  "Tablet",
  "Capsule",
  "Syrup",
  "Injection",
  "Cream",
  "Ointment",
  "Drops",
  "Inhaler",
  "Gel",
  "Powder",
  "Suspension",
  "Solution",
];

export const pharmacyNames = [
  "1mg",
  "PharmEasy",
  "Netmeds",
  "Apollo",
  "Flipkart Health",
  "Truemeds",
  "MedPlus",
  "Amazon Pharmacy",
  "JanAushadhi",
];

export const manufacturerTiers = [
  { key: "premium", label: "Premium", color: "#D97706" },
  { key: "trusted", label: "Trusted", color: "#2563EB" },
  { key: "standard", label: "Standard", color: "#6B7280" },
  { key: "government", label: "Government", color: "#059669" },
];

export const discountRanges = [
  { key: "10", label: "10%+ off" },
  { key: "20", label: "20%+ off" },
  { key: "30", label: "30%+ off" },
  { key: "50", label: "50%+ off" },
  { key: "70", label: "70%+ off" },
];
