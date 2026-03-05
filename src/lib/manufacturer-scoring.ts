// Manufacturer scoring algorithm
// Computes quality, reliability, and overall scores based on factual data

import type { ManufacturerSeed } from "./manufacturer-data";

// ─── WEIGHTS ──────────────────────────────────────────────
const WEIGHTS = {
  regulatory: 0.4, // FDA + WHO + EU-GMP
  marketPresence: 0.25, // Market cap, rank
  productRange: 0.15, // Drug count in DB
  pricingFairness: 0.1, // Avg discount
  dataFreshness: 0.1, // % of drugs with recent data
};

// ─── REGULATORY SCORE (0-100) ──────────────────────────────
export function computeRegulatoryScore(mfr: {
  usFdaApproved: boolean;
  whoPrequalified: boolean;
  eugmpCompliant: boolean;
}): number {
  let score = 0;
  if (mfr.usFdaApproved) score += 35;
  if (mfr.whoPrequalified) score += 35;
  if (mfr.eugmpCompliant) score += 30;
  return score;
}

// ─── MARKET PRESENCE SCORE (0-100) ─────────────────────────
export function computeMarketScore(mfr: {
  globalRank?: number | null;
  marketCapBillion?: number | null;
}): number {
  let score = 0;

  // Rank component (0-60)
  const rank = mfr.globalRank;
  if (rank) {
    if (rank <= 3) score += 60;
    else if (rank <= 5) score += 50;
    else if (rank <= 10) score += 40;
    else if (rank <= 15) score += 30;
    else if (rank <= 20) score += 20;
    else if (rank <= 30) score += 10;
    else score += 5;
  }

  // Market cap component (0-40)
  const cap = mfr.marketCapBillion;
  if (cap) {
    if (cap >= 20) score += 40;
    else if (cap >= 10) score += 35;
    else if (cap >= 5) score += 28;
    else if (cap >= 2) score += 20;
    else if (cap >= 1) score += 12;
    else score += 5;
  }

  return Math.min(100, score);
}

// ─── COMPUTE QUALITY + RELIABILITY ─────────────────────────
export function computeManufacturerScores(mfr: ManufacturerSeed): {
  qualityScore: number;
  reliabilityScore: number;
  overallScore: number;
  tier: string;
} {
  const qualityScore = computeRegulatoryScore(mfr);
  const reliabilityScore = computeMarketScore(mfr);

  // Overall = weighted average of regulatory + market (without dynamic DB data)
  // Product range, pricing fairness, data freshness set to 50 (neutral) initially
  const overallScore = Math.round(
    qualityScore * WEIGHTS.regulatory +
      reliabilityScore * WEIGHTS.marketPresence +
      50 * WEIGHTS.productRange +
      50 * WEIGHTS.pricingFairness +
      50 * WEIGHTS.dataFreshness
  );

  // Special case: Jan Aushadhi
  if (mfr.slug === "jan-aushadhi") {
    return {
      qualityScore: 35, // WHO only
      reliabilityScore: 70, // Government-backed
      overallScore: 75, // Fixed score for government scheme
      tier: "government",
    };
  }

  const tier =
    overallScore >= 85
      ? "premium"
      : overallScore >= 65
        ? "trusted"
        : overallScore >= 40
          ? "standard"
          : "budget";

  return { qualityScore, reliabilityScore, overallScore, tier };
}

// ─── TIER DISPLAY HELPERS ──────────────────────────────────

export interface TierDisplay {
  label: string;
  color: string;
  bgColor: string;
  textColor: string;
  icon: "gold" | "blue" | "gray" | "green";
}

export function getTierDisplay(tier: string): TierDisplay {
  switch (tier) {
    case "premium":
      return {
        label: "Premium",
        color: "#D97706",
        bgColor: "bg-amber-50",
        textColor: "text-amber-700",
        icon: "gold",
      };
    case "trusted":
      return {
        label: "Trusted",
        color: "#2563EB",
        bgColor: "bg-blue-50",
        textColor: "text-blue-700",
        icon: "blue",
      };
    case "government":
      return {
        label: "Govt. Generic",
        color: "#059669",
        bgColor: "bg-green-50",
        textColor: "text-green-700",
        icon: "green",
      };
    case "standard":
      return {
        label: "Standard",
        color: "#6B7280",
        bgColor: "bg-gray-50",
        textColor: "text-gray-600",
        icon: "gray",
      };
    default:
      return {
        label: "Budget",
        color: "#9CA3AF",
        bgColor: "bg-gray-50",
        textColor: "text-gray-500",
        icon: "gray",
      };
  }
}
