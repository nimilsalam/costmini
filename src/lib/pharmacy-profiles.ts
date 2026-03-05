// Static pharmacy metadata keyed by scraper source strings
// No DB table needed — only 8 pharmacies, never changes without a new scraper

export interface PharmacyProfile {
  name: string;
  slug: string;
  shortName: string;
  websiteUrl: string;
  color: string;
  textColor: string;
  description: string;
  shippingInfo: string;
  returnPolicy: string;
  codAvailable: boolean;
  panIndiaDelivery: boolean;
  authenticMeds: boolean;
  established: number;
  rating: number; // CostMini editorial rating 1-5
  specialFeatures: string[];
}

export const pharmacyProfiles: Record<string, PharmacyProfile> = {
  "1mg": {
    name: "Tata 1mg",
    slug: "tata-1mg",
    shortName: "1mg",
    websiteUrl: "https://www.1mg.com",
    color: "#EE4036",
    textColor: "#FFFFFF",
    description:
      "India's leading digital health platform backed by Tata Group, offering medicines, lab tests, and doctor consultations.",
    shippingInfo: "Free delivery on orders above ₹149",
    returnPolicy: "15-day easy return on unopened items",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 2015,
    rating: 4.5,
    specialFeatures: ["Lab tests", "Doctor consultations", "Health records"],
  },

  PharmEasy: {
    name: "PharmEasy",
    slug: "pharmeasy",
    shortName: "PE",
    websiteUrl: "https://pharmeasy.in",
    color: "#10847E",
    textColor: "#FFFFFF",
    description:
      "One of India's largest e-pharmacy platforms with fast delivery and deep discounts across medicines.",
    shippingInfo: "Free delivery on orders above ₹499",
    returnPolicy: "7-day return on select items",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 2015,
    rating: 4.3,
    specialFeatures: ["Lab tests", "Health packages", "Teleconsultation"],
  },

  Netmeds: {
    name: "Netmeds",
    slug: "netmeds",
    shortName: "NM",
    websiteUrl: "https://www.netmeds.com",
    color: "#28A745",
    textColor: "#FFFFFF",
    description:
      "Part of Reliance Retail, Netmeds delivers genuine medicines across India with regular discounts.",
    shippingInfo: "Free delivery on orders above ₹500",
    returnPolicy: "10-day return policy",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 2015,
    rating: 4.1,
    specialFeatures: ["Beauty products", "Wellness", "Reliance-backed"],
  },

  Apollo: {
    name: "Apollo Pharmacy",
    slug: "apollo",
    shortName: "Apollo",
    websiteUrl: "https://www.apollopharmacy.in",
    color: "#003B71",
    textColor: "#FFFFFF",
    description:
      "India's most trusted healthcare brand with 5,500+ stores and online pharmacy backed by Apollo Hospitals Group.",
    shippingInfo: "Free delivery on orders above ₹999",
    returnPolicy: "7-day return on unopened products",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 1983,
    rating: 4.6,
    specialFeatures: [
      "5,500+ stores",
      "Doctor consultations",
      "Diagnostics",
    ],
  },

  "Flipkart Health": {
    name: "Flipkart Health+",
    slug: "flipkart-health",
    shortName: "FK",
    websiteUrl: "https://www.flipkart.com/health-plus",
    color: "#2874F0",
    textColor: "#FFFFFF",
    description:
      "Flipkart's healthcare arm offering medicines at competitive prices with Flipkart's delivery network.",
    shippingInfo: "Free delivery on orders above ₹199",
    returnPolicy: "10-day easy return",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 2021,
    rating: 4.0,
    specialFeatures: [
      "Flipkart delivery network",
      "SuperCoin rewards",
      "Plus membership benefits",
    ],
  },

  Truemeds: {
    name: "Truemeds",
    slug: "truemeds",
    shortName: "TM",
    websiteUrl: "https://www.truemeds.in",
    color: "#FF6B35",
    textColor: "#FFFFFF",
    description:
      "Focused on generic medicine substitution, Truemeds helps save up to 72% by recommending WHO-approved generics.",
    shippingInfo: "Free delivery on all orders",
    returnPolicy: "7-day return policy",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 2019,
    rating: 4.2,
    specialFeatures: [
      "Generic substitution",
      "Up to 72% savings",
      "Free delivery",
    ],
  },

  MedPlus: {
    name: "MedPlus",
    slug: "medplus",
    shortName: "MP",
    websiteUrl: "https://www.medplusmart.com",
    color: "#E91E63",
    textColor: "#FFFFFF",
    description:
      "South India's largest pharmacy chain with 4,000+ stores offering medicines and health products.",
    shippingInfo: "Free delivery on orders above ₹500",
    returnPolicy: "7-day return on select items",
    codAvailable: true,
    panIndiaDelivery: false,
    authenticMeds: true,
    established: 2006,
    rating: 4.0,
    specialFeatures: [
      "4,000+ stores",
      "Store pickup",
      "South India coverage",
    ],
  },

  "Amazon Pharmacy": {
    name: "Amazon Pharmacy",
    slug: "amazon-pharmacy",
    shortName: "AMZ",
    websiteUrl: "https://www.amazon.in/pharmacy",
    color: "#FF9900",
    textColor: "#000000",
    description:
      "Amazon's pharmacy service with Prime delivery benefits and regular discounts on medicines.",
    shippingInfo: "Free delivery for Prime members",
    returnPolicy: "10-day return on eligible items",
    codAvailable: true,
    panIndiaDelivery: true,
    authenticMeds: true,
    established: 2020,
    rating: 4.3,
    specialFeatures: ["Prime benefits", "Subscribe & Save", "Amazon Pay"],
  },
};

// Lookup helper
export function getPharmacyProfile(
  source: string
): PharmacyProfile | undefined {
  return pharmacyProfiles[source];
}

// Get all profiles as array
export function getAllPharmacies(): (PharmacyProfile & { source: string })[] {
  return Object.entries(pharmacyProfiles).map(([source, profile]) => ({
    source,
    ...profile,
  }));
}

// Get pharmacy by slug
export function getPharmacyBySlug(
  slug: string
): (PharmacyProfile & { source: string }) | undefined {
  for (const [source, profile] of Object.entries(pharmacyProfiles)) {
    if (profile.slug === slug) return { source, ...profile };
  }
  return undefined;
}
