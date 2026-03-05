"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Share2, ExternalLink, AlertCircle, Loader2, Clock, RefreshCw, Zap, ShieldCheck, Award, Globe2, Building2 } from "lucide-react";
import Image from "next/image";
import { getPharmacyProfile } from "@/lib/pharmacy-profiles";
import { formatPrice, calcSavings, whatsappShareUrl, whatsappDrugShareText } from "@/lib/utils";
import { getFreshness } from "@/lib/freshness";
import { usePriceStream, type StreamedPrice } from "@/hooks/usePriceStream";

interface Drug {
  id: string;
  name: string;
  slug: string;
  genericName: string;
  manufacturer: string;
  composition: string;
  category: string;
  dosageForm: string;
  packSize: string;
  isGeneric: boolean;
  whoCertified: boolean;
  prescriptionReq: boolean;
  uses?: string;
  sideEffects?: string;
  prices: {
    source: string;
    sourceUrl?: string;
    mrp: number;
    sellingPrice: number;
    inStock: boolean;
    lastChecked: string;
  }[];
  lowestPrice: number;
  highestMrp: number;
  manufacturerRef?: {
    id: string;
    name: string;
    slug: string;
    overallScore: number;
    tier: string;
    usFdaApproved: boolean;
    whoPrequalified: boolean;
    eugmpCompliant: boolean;
  } | null;
}

interface Alternative {
  id: string;
  name: string;
  slug: string;
  manufacturer: string;
  packSize: string;
  isGeneric: boolean;
  whoCertified: boolean;
  lowestPrice: number;
  savingsPercent: number;
}

interface ScoreInfo {
  total: number;
  badge: "best-value" | "recommended" | "good-option" | null;
  explanation: string;
}

export default function DrugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [drug, setDrug] = useState<Drug | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInfo>>({});
  const [bestOption, setBestOption] = useState<{ source: string; total: number; badge: string | null; explanation: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const { prices: streamedPrices, progress, total, isStreaming, status, refresh } = usePriceStream(id);

  useEffect(() => {
    async function fetchDrug() {
      try {
        const res = await fetch(`/api/drugs/${id}`);
        if (!res.ok) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        setDrug(data.drug);
        setAlternatives(data.alternatives || []);
        setScores(data.scores || {});
        setBestOption(data.bestOption || null);
      } catch {
        setNotFound(true);
      }
      setLoading(false);
    }
    fetchDrug();
  }, [id]);

  // Merge DB prices with streamed prices (streamed take priority)
  const displayPrices = useMemo(() => {
    if (streamedPrices.length === 0 && drug?.prices) {
      return drug.prices.map((p) => ({
        source: p.source,
        mrp: p.mrp,
        sellingPrice: p.sellingPrice,
        inStock: p.inStock,
        sourceUrl: p.sourceUrl || null,
        lastChecked: p.lastChecked,
        isCached: true,
      })) as StreamedPrice[];
    }
    return streamedPrices;
  }, [drug?.prices, streamedPrices]);

  const sortedPrices = useMemo(
    () => [...displayPrices].sort((a, b) => a.sellingPrice - b.sellingPrice),
    [displayPrices]
  );

  const cheapest = sortedPrices.length > 0 ? sortedPrices[0].sellingPrice : 0;
  const highestMrp = sortedPrices.length > 0
    ? Math.max(...sortedPrices.map((p) => p.mrp))
    : drug?.highestMrp || 0;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <Loader2 size={32} className="mx-auto text-[var(--color-primary)] animate-spin mb-4" />
        <p className="text-gray-500">Loading medicine details...</p>
      </div>
    );
  }

  if (notFound || !drug) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">Medicine not found</p>
        <Link href="/medicines" className="text-[var(--color-primary)] mt-4 inline-block">
          Back to Medicines
        </Link>
      </div>
    );
  }

  const savings = calcSavings(highestMrp, cheapest);
  const shareText = whatsappDrugShareText(drug.name, highestMrp, cheapest, savings);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/medicines"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--color-primary)] mb-6"
      >
        <ArrowLeft size={16} />
        Back to Medicines
      </Link>

      {/* Drug Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{drug.name}</h1>
              {drug.isGeneric && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  Generic
                </span>
              )}
              {drug.whoCertified && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1">
                  <Shield size={12} />
                  WHO-GMP
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-1">{drug.composition}</p>
            <div className="text-sm text-gray-500 flex items-center gap-2 flex-wrap">
              {drug.manufacturerRef ? (
                <Link
                  href={`/manufacturers/${drug.manufacturerRef.slug}`}
                  className="inline-flex items-center gap-1.5 hover:text-[var(--color-primary)] transition-colors"
                >
                  <Building2 size={13} className="text-gray-400" />
                  {drug.manufacturer}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                      drug.manufacturerRef.tier === "premium"
                        ? "bg-amber-50 text-amber-700"
                        : drug.manufacturerRef.tier === "trusted"
                          ? "bg-blue-50 text-blue-700"
                          : drug.manufacturerRef.tier === "government"
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {drug.manufacturerRef.tier === "premium"
                      ? "Premium"
                      : drug.manufacturerRef.tier === "trusted"
                        ? "Trusted"
                        : drug.manufacturerRef.tier === "government"
                          ? "Govt."
                          : "Standard"}
                    {" "}
                    ({Math.round(drug.manufacturerRef.overallScore)})
                  </span>
                </Link>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Building2 size={13} className="text-gray-400" />
                  {drug.manufacturer}
                </span>
              )}
              <span className="text-gray-300">&middot;</span>
              <span>{drug.dosageForm}</span>
              <span className="text-gray-300">&middot;</span>
              <span>{drug.packSize}</span>
            </div>
            {/* Regulatory badges */}
            {drug.manufacturerRef && (
              <div className="flex items-center gap-2 mt-1.5">
                {drug.manufacturerRef.usFdaApproved && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                    <Shield size={10} /> US-FDA
                  </span>
                )}
                {drug.manufacturerRef.whoPrequalified && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-50 text-green-600">
                    <Globe2 size={10} /> WHO
                  </span>
                )}
                {drug.manufacturerRef.eugmpCompliant && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-600">
                    <Award size={10} /> EU-GMP
                  </span>
                )}
              </div>
            )}
            {drug.prescriptionReq && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle size={14} />
                Prescription Required
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Starting from</div>
            <div className="text-3xl font-bold text-[var(--color-primary)]">
              {cheapest > 0 ? formatPrice(cheapest) : "—"}
            </div>
            {savings > 0 && (
              <div className="flex items-center gap-2 justify-end mt-1">
                <span className="text-sm text-gray-400 line-through">
                  MRP {formatPrice(highestMrp)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                  Save {savings}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stale Price Warning */}
      {!isStreaming && displayPrices.some((p) => getFreshness(p.lastChecked).level === "stale") && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center justify-between text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="flex-shrink-0" />
            Some prices haven&apos;t been updated recently.
          </div>
          <button
            onClick={refresh}
            className="flex items-center gap-1 text-amber-700 hover:text-amber-900 font-medium"
          >
            <RefreshCw size={14} />
            Refresh Now
          </button>
        </div>
      )}

      {/* CostMini Recommendation */}
      {bestOption && bestOption.total >= 50 && (
        <div className={`rounded-2xl border p-4 mb-4 ${
          bestOption.badge === "best-value"
            ? "bg-green-50 border-green-200"
            : bestOption.badge === "recommended"
              ? "bg-blue-50 border-blue-200"
              : "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ${
                bestOption.badge === "best-value"
                  ? "bg-green-500"
                  : bestOption.badge === "recommended"
                    ? "bg-blue-500"
                    : "bg-gray-500"
              }`}>
                {bestOption.total}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">CostMini Recommendation</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    bestOption.badge === "best-value"
                      ? "bg-green-100 text-green-700"
                      : bestOption.badge === "recommended"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {bestOption.badge === "best-value" ? "Best Value" : bestOption.badge === "recommended" ? "Recommended" : "Good Option"}
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Buy from <strong>{bestOption.source}</strong> — {bestOption.explanation}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Comparison Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Price Comparison Across Pharmacies
          </h2>
          <button
            onClick={refresh}
            disabled={isStreaming}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-teal-50"
          >
            {isStreaming ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Zap size={14} />
                Live Prices
              </>
            )}
          </button>
        </div>

        {/* Streaming Progress Bar */}
        {isStreaming && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
              <span>{status}</span>
              <span>{progress}/{total} pharmacies</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-[var(--color-primary)] h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (progress / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-medium">Pharmacy</th>
                <th className="pb-3 font-medium">MRP</th>
                <th className="pb-3 font-medium">Selling Price</th>
                <th className="pb-3 font-medium">Savings</th>
                <th className="pb-3 font-medium">Score</th>
                <th className="pb-3 font-medium">Stock</th>
                <th className="pb-3 font-medium">Updated</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {sortedPrices.map((price, i) => {
                const pSavings = calcSavings(price.mrp, price.sellingPrice);
                const isCheapest = price.sellingPrice === cheapest && cheapest > 0;
                const freshness = getFreshness(price.lastChecked);
                const isNew = !price.isCached;
                const pharma = getPharmacyProfile(price.source);
                const logoSlug: Record<string, string> = {
                  "1mg": "1mg", PharmEasy: "pharmeasy", Netmeds: "netmeds",
                  Apollo: "apollo", "Flipkart Health": "flipkart",
                  Truemeds: "truemeds", MedPlus: "medplus", "Amazon Pharmacy": "amazon",
                };
                return (
                  <tr
                    key={price.source}
                    className={`border-b border-gray-50 transition-all duration-300 ${
                      bestOption?.source === price.source ? "bg-green-50/50" : isCheapest ? "bg-teal-50/30" : ""
                    } ${isNew ? "animate-fadeIn" : ""}`}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        {pharma && (
                          <Image
                            src={`/pharmacies/${logoSlug[price.source] || "1mg"}.svg`}
                            alt={pharma.name}
                            width={28}
                            height={28}
                            className="rounded-md flex-shrink-0"
                          />
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-gray-900">{pharma?.name || price.source}</span>
                            {isCheapest && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">
                                Cheapest
                              </span>
                            )}
                            {isNew && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">
                                Live
                              </span>
                            )}
                          </div>
                          {pharma && (
                            <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                              <span>{pharma.shippingInfo}</span>
                              {pharma.authenticMeds && (
                                <span className="flex items-center gap-0.5 text-green-500">
                                  <ShieldCheck size={10} />
                                  Licensed
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-gray-500">{formatPrice(price.mrp)}</td>
                    <td className="py-3 font-semibold text-gray-900">{formatPrice(price.sellingPrice)}</td>
                    <td className="py-3">
                      {pSavings > 0 ? (
                        <span className="text-green-600 font-medium">{pSavings}% off</span>
                      ) : (
                        <span className="text-gray-400">&mdash;</span>
                      )}
                    </td>
                    <td className="py-3">
                      {scores[price.source] ? (
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-bold ${
                            scores[price.source].total >= 80
                              ? "text-green-600"
                              : scores[price.source].total >= 65
                                ? "text-blue-600"
                                : scores[price.source].total >= 50
                                  ? "text-gray-600"
                                  : "text-gray-400"
                          }`}>
                            {scores[price.source].total}
                          </span>
                          {scores[price.source].badge && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              scores[price.source].badge === "best-value"
                                ? "bg-green-100 text-green-700"
                                : scores[price.source].badge === "recommended"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}>
                              {scores[price.source].badge === "best-value"
                                ? "Best"
                                : scores[price.source].badge === "recommended"
                                  ? "Rec."
                                  : "OK"}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-300">&mdash;</span>
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`text-sm ${price.inStock ? "text-green-600" : "text-red-500"}`}>
                        {price.inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`text-xs flex items-center gap-1 ${freshness.color}`}>
                        <Clock size={12} />
                        {freshness.label}
                      </span>
                    </td>
                    <td className="py-3">
                      {price.sourceUrl ? (
                        <a
                          href={price.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{
                            backgroundColor: pharma?.color || "var(--color-primary)",
                            color: pharma?.textColor || "#fff",
                          }}
                        >
                          Buy on {pharma?.shortName || price.source} <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-gray-300 text-sm">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sortedPrices.length === 0 && !isStreaming && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-400">
                    No prices available.{" "}
                    <button onClick={refresh} className="text-[var(--color-primary)] hover:underline">
                      Check live prices
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generic Alternatives */}
      {alternatives.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl border border-green-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {drug.isGeneric ? "Branded Versions" : "Cheaper Generic Alternatives"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Same composition ({drug.composition}), from certified manufacturers
          </p>
          <div className="space-y-3">
            {alternatives.map((alt) => {
              const altCheapest = alt.lowestPrice;
              const altSavings = calcSavings(highestMrp, altCheapest);
              return (
                <Link
                  key={alt.id}
                  href={`/medicines/${alt.slug}`}
                  className="block bg-white rounded-xl p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{alt.name}</span>
                        {alt.isGeneric && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            Generic
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{alt.manufacturer} &middot; {alt.packSize}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">{formatPrice(altCheapest)}</div>
                      {altSavings > 0 && (
                        <span className="text-sm text-green-600">Save {altSavings}%</span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Drug Info */}
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {drug.uses && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Uses</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{drug.uses}</p>
          </div>
        )}
        {drug.sideEffects && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Side Effects</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{drug.sideEffects}</p>
          </div>
        )}
      </div>

      {/* Share CTA */}
      <div className="bg-green-50 rounded-2xl border border-green-200 p-6 text-center">
        <p className="text-gray-700 font-medium mb-3">Help someone save on their medicines</p>
        <a
          href={whatsappShareUrl(shareText)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
        >
          <Share2 size={18} />
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
