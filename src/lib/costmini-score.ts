// CostMini Score: Best-choice composite scoring algorithm
// Computes a 0-100 score for each drug-pharmacy combination
// Higher score = better value considering price, quality, availability, and trust

export interface ScoreInput {
  sellingPrice: number;
  mrp: number;
  lowestPriceForComposition: number;
  highestPriceForComposition: number;
  manufacturerOverallScore: number; // 0-100
  manufacturerTier: string;
  pharmacyRating: number; // 1-5 from profiles
  inStock: boolean;
  isGeneric: boolean;
  whoCertified: boolean;
  freshnessLevel: "fresh" | "recent" | "stale";
}

export interface ScoreBreakdown {
  priceValue: number; // 0-35
  manufacturer: number; // 0-25
  availability: number; // 0-15
  trustSignals: number; // 0-15
  freshness: number; // 0-10
}

export interface CostMiniScore {
  total: number; // 0-100
  breakdown: ScoreBreakdown;
  badge: "best-value" | "recommended" | "good-option" | null;
  explanation: string;
}

// ─── PRICE VALUE (0-35 pts) ──────────────────────────────
// Normalized position in price range. Cheapest = 35, most expensive = 0.
function computePriceValue(input: ScoreInput): number {
  const { sellingPrice, lowestPriceForComposition, highestPriceForComposition } = input;

  if (highestPriceForComposition <= lowestPriceForComposition) {
    // Only one price point — give full points
    return 35;
  }

  const range = highestPriceForComposition - lowestPriceForComposition;
  const position = 1 - (sellingPrice - lowestPriceForComposition) / range;
  // Clamp between 0 and 1
  const normalized = Math.max(0, Math.min(1, position));

  return Math.round(normalized * 35);
}

// ─── MANUFACTURER QUALITY (0-25 pts) ─────────────────────
// Maps manufacturerOverallScore (0-100) to 0-25
function computeManufacturerScore(input: ScoreInput): number {
  return Math.round((input.manufacturerOverallScore / 100) * 25);
}

// ─── AVAILABILITY (0-15 pts) ─────────────────────────────
// In stock = 12pts, pharmacy rating >= 4.0 = +3pts
function computeAvailability(input: ScoreInput): number {
  let score = 0;
  if (input.inStock) score += 12;
  if (input.pharmacyRating >= 4.0) score += 3;
  return score;
}

// ─── TRUST SIGNALS (0-15 pts) ────────────────────────────
// isGeneric +5, whoCertified +5, premium mfr +5 (or trusted +3)
function computeTrustSignals(input: ScoreInput): number {
  let score = 0;
  if (input.isGeneric) score += 5;
  if (input.whoCertified) score += 5;
  if (input.manufacturerTier === "premium") score += 5;
  else if (input.manufacturerTier === "trusted" || input.manufacturerTier === "government") score += 3;
  return score;
}

// ─── DATA FRESHNESS (0-10 pts) ───────────────────────────
// fresh = 10, recent = 5, stale = 0
function computeFreshness(input: ScoreInput): number {
  switch (input.freshnessLevel) {
    case "fresh":
      return 10;
    case "recent":
      return 5;
    case "stale":
      return 0;
  }
}

// ─── MAIN SCORING FUNCTION ──────────────────────────────
export function computeCostMiniScore(input: ScoreInput): CostMiniScore {
  const breakdown: ScoreBreakdown = {
    priceValue: computePriceValue(input),
    manufacturer: computeManufacturerScore(input),
    availability: computeAvailability(input),
    trustSignals: computeTrustSignals(input),
    freshness: computeFreshness(input),
  };

  const total =
    breakdown.priceValue +
    breakdown.manufacturer +
    breakdown.availability +
    breakdown.trustSignals +
    breakdown.freshness;

  // Badge assignment
  let badge: CostMiniScore["badge"] = null;
  if (total >= 80) badge = "best-value";
  else if (total >= 65) badge = "recommended";
  else if (total >= 50) badge = "good-option";

  // Generate explanation
  const parts: string[] = [];
  if (breakdown.priceValue >= 28) parts.push("Best price");
  else if (breakdown.priceValue >= 20) parts.push("Great price");
  else if (breakdown.priceValue >= 10) parts.push("Fair price");

  if (input.manufacturerTier === "premium") parts.push("premium manufacturer");
  else if (input.manufacturerTier === "trusted") parts.push("trusted manufacturer");
  else if (input.manufacturerTier === "government") parts.push("govt. generic");

  if (input.inStock) parts.push("in stock");
  if (input.whoCertified) parts.push("WHO certified");

  const explanation = parts.length > 0 ? parts.join(", ") : "Available option";

  return { total, breakdown, badge, explanation };
}

// ─── BATCH SCORING ──────────────────────────────────────
// Score all prices for a drug at once (used in API routes and pages)
export interface PriceForScoring {
  source: string;
  sellingPrice: number;
  mrp: number;
  inStock: boolean;
  lastChecked: string;
}

export interface DrugForScoring {
  isGeneric: boolean;
  whoCertified: boolean;
  manufacturerRef?: {
    overallScore: number;
    tier: string;
  } | null;
}

export function scoreDrugPrices(
  drug: DrugForScoring,
  prices: PriceForScoring[],
  pharmacyRatings: Record<string, number> = {}
): Map<string, CostMiniScore> {
  if (prices.length === 0) return new Map();

  const sellingPrices = prices.map((p) => p.sellingPrice).filter((p) => p > 0);
  const lowestPrice = Math.min(...sellingPrices);
  const highestPrice = Math.max(...sellingPrices);

  const results = new Map<string, CostMiniScore>();

  for (const price of prices) {
    const freshnessLevel = getFreshnessLevel(price.lastChecked);

    const input: ScoreInput = {
      sellingPrice: price.sellingPrice,
      mrp: price.mrp,
      lowestPriceForComposition: lowestPrice,
      highestPriceForComposition: highestPrice,
      manufacturerOverallScore: drug.manufacturerRef?.overallScore ?? 50,
      manufacturerTier: drug.manufacturerRef?.tier ?? "standard",
      pharmacyRating: pharmacyRatings[price.source] ?? 3.5,
      inStock: price.inStock,
      isGeneric: drug.isGeneric,
      whoCertified: drug.whoCertified,
      freshnessLevel,
    };

    results.set(price.source, computeCostMiniScore(input));
  }

  return results;
}

// Helper: determine freshness from lastChecked timestamp
function getFreshnessLevel(lastChecked: string): "fresh" | "recent" | "stale" {
  const checked = new Date(lastChecked).getTime();
  const now = Date.now();
  const hoursDiff = (now - checked) / (1000 * 60 * 60);

  if (hoursDiff < 1) return "fresh";
  if (hoursDiff < 24) return "recent";
  return "stale";
}

// ─── BADGE DISPLAY HELPERS ──────────────────────────────
export function getBadgeDisplay(badge: CostMiniScore["badge"]): {
  label: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
} | null {
  switch (badge) {
    case "best-value":
      return {
        label: "Best Value",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        borderColor: "border-green-200",
      };
    case "recommended":
      return {
        label: "Recommended",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        borderColor: "border-blue-200",
      };
    case "good-option":
      return {
        label: "Good Option",
        bgColor: "bg-gray-50",
        textColor: "text-gray-600",
        borderColor: "border-gray-200",
      };
    default:
      return null;
  }
}
