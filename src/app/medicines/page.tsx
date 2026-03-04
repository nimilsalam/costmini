"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Pill, ArrowDownUp, Shield, Share2 } from "lucide-react";
import { sampleDrugs, drugCategories } from "@/lib/sample-data";
import { formatPrice, calcSavings, whatsappShareUrl } from "@/lib/utils";

export default function MedicinesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showGenericOnly, setShowGenericOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "price" | "savings">("name");

  const filtered = useMemo(() => {
    let drugs = sampleDrugs;
    if (query) {
      const q = query.toLowerCase();
      drugs = drugs.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.genericName.toLowerCase().includes(q) ||
          d.composition.toLowerCase().includes(q)
      );
    }
    if (category !== "All") {
      drugs = drugs.filter((d) => d.category === category);
    }
    if (showGenericOnly) {
      drugs = drugs.filter((d) => d.isGeneric);
    }
    // sort
    drugs = [...drugs].sort((a, b) => {
      if (sortBy === "price") {
        const aMin = Math.min(...a.prices.map((p) => p.sellingPrice));
        const bMin = Math.min(...b.prices.map((p) => p.sellingPrice));
        return aMin - bMin;
      }
      return a.name.localeCompare(b.name);
    });
    return drugs;
  }, [query, category, showGenericOnly, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Medicine Prices
        </h1>
        <p className="text-gray-500">
          Compare prices across pharmacies. Find generic alternatives and save
          up to 80%.
        </p>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 space-y-4">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            placeholder="Search medicines by name, generic name, or composition..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="All">All Categories</option>
            {drugCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowGenericOnly(!showGenericOnly)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
              showGenericOnly
                ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Shield size={14} />
              Generic Only
            </span>
          </button>
          <button
            onClick={() =>
              setSortBy(sortBy === "price" ? "name" : "price")
            }
            className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-600 hover:border-gray-300 flex items-center gap-1.5"
          >
            <ArrowDownUp size={14} />
            Sort: {sortBy === "price" ? "Price" : "Name"}
          </button>
        </div>
      </div>

      {/* Results */}
      <div className="text-sm text-gray-500 mb-4">
        {filtered.length} medicine{filtered.length !== 1 ? "s" : ""} found
      </div>

      <div className="grid gap-4">
        {filtered.map((drug, idx) => {
          const cheapest = Math.min(
            ...drug.prices.map((p) => p.sellingPrice)
          );
          const mrp = Math.max(...drug.prices.map((p) => p.mrp));
          const savings = calcSavings(mrp, cheapest);
          const shareText = `💊 ${drug.name} (${drug.composition}) — From ${formatPrice(cheapest)} on CostMini!\nCompare prices & find generics: costmini.in/medicines`;

          return (
            <div
              key={idx}
              className="bg-white rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-md transition-all p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Link
                      href={`/medicines/${idx}`}
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
                    {drug.prescriptionReq && " &middot; ℞ Prescription Required"}
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
                      across {drug.prices.length} pharmacies
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link
                      href={`/medicines/${idx}`}
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

      {filtered.length === 0 && (
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
