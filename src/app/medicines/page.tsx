"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Pill, ArrowDownUp, Shield, Share2, Loader2, SlidersHorizontal, CheckCircle, X, Star } from "lucide-react";
import { drugCategories } from "@/lib/constants";
import { formatPrice, calcSavings, whatsappShareUrl } from "@/lib/utils";

interface DrugPrice {
  source: string;
  mrp: number;
  sellingPrice: number;
  inStock: boolean;
}

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
  prices: DrugPrice[];
  lowestPrice: number;
  highestMrp: number;
  pharmacyCount: number;
}

type SortOption = "name" | "price-low" | "price-high" | "savings" | "sources";

export default function MedicinesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showGenericOnly, setShowGenericOnly] = useState(false);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [showWhoCertified, setShowWhoCertified] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState<SortOption>("price-low");
  const [showFilters, setShowFilters] = useState(false);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const activeFilterCount = [
    showGenericOnly,
    showInStockOnly,
    showWhoCertified,
    priceRange[0] > 0 || priceRange[1] < 10000,
    category !== "All",
  ].filter(Boolean).length;

  const fetchDrugs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "All") params.set("category", category);
    if (showGenericOnly) params.set("generic", "true");
    params.set("page", String(page));
    params.set("limit", "50");

    try {
      const res = await fetch(`/api/drugs/search?${params}`);
      const data = await res.json();
      setDrugs(data.results || []);
      setTotal(data.count || 0);
    } catch {
      setDrugs([]);
    }
    setLoading(false);
  }, [query, category, showGenericOnly, page]);

  useEffect(() => {
    const timeout = setTimeout(fetchDrugs, 300);
    return () => clearTimeout(timeout);
  }, [fetchDrugs]);

  // Client-side filtering & sorting (Agoda-style)
  const filtered = drugs.filter((d) => {
    if (showInStockOnly && d.prices.every((p) => !p.inStock)) return false;
    if (showWhoCertified && !d.whoCertified) return false;
    if (d.lowestPrice < priceRange[0] || d.lowestPrice > priceRange[1]) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price-low": return a.lowestPrice - b.lowestPrice;
      case "price-high": return b.lowestPrice - a.lowestPrice;
      case "savings": {
        const savA = a.highestMrp > 0 ? ((a.highestMrp - a.lowestPrice) / a.highestMrp) : 0;
        const savB = b.highestMrp > 0 ? ((b.highestMrp - b.lowestPrice) / b.highestMrp) : 0;
        return savB - savA;
      }
      case "sources": return b.pharmacyCount - a.pharmacyCount;
      default: return a.name.localeCompare(b.name);
    }
  });

  const clearFilters = () => {
    setShowGenericOnly(false);
    setShowInStockOnly(false);
    setShowWhoCertified(false);
    setPriceRange([0, 10000]);
    setCategory("All");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Medicine Prices
        </h1>
        <p className="text-gray-500">
          Compare prices across 8+ pharmacies. Find generic alternatives and save
          up to 80%.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search medicines by name, generic name, or composition..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm"
          />
        </div>
      </div>

      {/* Sort Bar + Filter Toggle (Agoda-style) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1"><ArrowDownUp size={12} /> Sort:</span>
            {([
              { key: "price-low", label: "Price: Low to High" },
              { key: "price-high", label: "Price: High to Low" },
              { key: "savings", label: "Best Savings" },
              { key: "sources", label: "Most Sources" },
              { key: "name", label: "A-Z" },
            ] as { key: SortOption; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  sortBy === opt.key
                    ? "bg-[var(--color-primary)] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
              showFilters || activeFilterCount > 0
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <SlidersHorizontal size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-white text-[var(--color-primary)] rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Expandable Filter Panel (Agoda-style) */}
      {showFilters && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Filter Results</h3>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1">
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCategory("All"); setPage(1); }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  category === "All" ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              {drugCategories.map((c) => (
                <button
                  key={c}
                  onClick={() => { setCategory(c); setPage(1); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    category === c ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">Price Range</label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">₹</span>
                <input
                  type="number"
                  min={0}
                  max={priceRange[1]}
                  value={priceRange[0]}
                  onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                  className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                />
              </div>
              <span className="text-xs text-gray-400">to</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-gray-400">₹</span>
                <input
                  type="number"
                  min={priceRange[0]}
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
                  className="w-20 px-2 py-1.5 rounded-lg border border-gray-200 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Toggle Filters */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => { setShowGenericOnly(!showGenericOnly); setPage(1); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                showGenericOnly ? "bg-green-50 text-green-700 border-green-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <Shield size={14} />
              Generic Only
              {showGenericOnly && <CheckCircle size={12} />}
            </button>
            <button
              onClick={() => setShowInStockOnly(!showInStockOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                showInStockOnly ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <CheckCircle size={14} />
              In Stock Only
              {showInStockOnly && <CheckCircle size={12} />}
            </button>
            <button
              onClick={() => setShowWhoCertified(!showWhoCertified)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                showWhoCertified ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              <Star size={14} />
              WHO-GMP Certified
              {showWhoCertified && <CheckCircle size={12} />}
            </button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="text-sm text-gray-500 mb-4 flex items-center justify-between">
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Searching...
          </span>
        ) : (
          <span>
            {sorted.length === total
              ? `${total} medicine${total !== 1 ? "s" : ""} found`
              : `Showing ${sorted.length} of ${total} medicines`}
          </span>
        )}
        {!loading && activeFilterCount > 0 && sorted.length < total && (
          <button onClick={clearFilters} className="text-xs text-[var(--color-primary)] hover:underline">
            Clear filters to see all
          </button>
        )}
      </div>

      {/* Results */}
      <div className="grid gap-4">
        {sorted.map((drug) => {
          const cheapest = drug.lowestPrice;
          const mrp = drug.highestMrp;
          const savings = calcSavings(mrp, cheapest);
          const shareText = `💊 ${drug.name} (${drug.composition}) — From ${formatPrice(cheapest)} on CostMini!\nCompare prices & find generics: costmini.in/medicines`;

          return (
            <div
              key={drug.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-md transition-all p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/medicines/${drug.slug}`}
                      className="text-lg font-semibold text-gray-900 hover:text-[var(--color-primary)]"
                    >
                      {drug.name}
                    </Link>
                    {drug.isGeneric && (
                      <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        Generic
                      </span>
                    )}
                    {drug.whoCertified && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                        WHO-GMP
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-1">
                    {drug.composition} &middot; {drug.manufacturer} &middot;{" "}
                    {drug.packSize}
                  </p>
                  <p className="text-xs text-gray-400">
                    {drug.category} &middot; {drug.dosageForm}
                    {drug.prescriptionReq && " · ℞ Prescription Required"}
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                      {formatPrice(cheapest)}
                    </div>
                    {savings > 0 && (
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-sm text-gray-400 line-through">
                          {formatPrice(mrp)}
                        </span>
                        <span className="text-sm font-semibold text-green-600">
                          {savings}% off
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-0.5">
                      across {drug.pharmacyCount} pharmacies
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/medicines/${drug.slug}`}
                      className="px-4 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors"
                    >
                      Compare
                    </Link>
                    <a
                      href={whatsappShareUrl(shareText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-lg bg-green-50 text-green-600 text-sm font-medium hover:bg-green-100 transition-colors flex items-center gap-1 justify-center"
                    >
                      <Share2 size={14} />
                      Share
                    </a>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 rounded-lg border border-gray-200 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div className="text-center py-16">
          <Pill size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No medicines found</p>
          <p className="text-gray-400 text-sm mt-1">
            Try a different search term or category
          </p>
        </div>
      )}
    </div>
  );
}
