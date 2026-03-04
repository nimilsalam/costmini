"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Pill, Stethoscope, TestTube } from "lucide-react";
import { sampleDrugs, sampleProcedures, sampleDiagnostics } from "@/lib/sample-data";
import { formatPrice } from "@/lib/utils";

type ResultType = "all" | "medicines" | "procedures" | "diagnostics";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ResultType>("all");

  const results = useMemo(() => {
    if (!query || query.length < 2) return { medicines: [], procedures: [], diagnostics: [] };
    const q = query.toLowerCase();

    const medicines =
      type === "all" || type === "medicines"
        ? sampleDrugs.filter(
            (d) =>
              d.name.toLowerCase().includes(q) ||
              d.genericName.toLowerCase().includes(q) ||
              d.composition.toLowerCase().includes(q) ||
              d.category.toLowerCase().includes(q)
          )
        : [];

    const procedures =
      type === "all" || type === "procedures"
        ? sampleProcedures.filter(
            (p) =>
              p.name.toLowerCase().includes(q) ||
              p.category.toLowerCase().includes(q)
          )
        : [];

    const diagnostics =
      type === "all" || type === "diagnostics"
        ? sampleDiagnostics.filter(
            (d) =>
              d.name.toLowerCase().includes(q) ||
              d.type.toLowerCase().includes(q) ||
              d.category.toLowerCase().includes(q)
          )
        : [];

    return { medicines, procedures, diagnostics };
  }, [query, type]);

  const totalResults =
    results.medicines.length +
    results.procedures.length +
    results.diagnostics.length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Search</h1>

      <div className="relative mb-4">
        <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          autoFocus
          placeholder="Search medicines, surgeries, lab tests..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 rounded-2xl border border-gray-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20 outline-none text-lg"
        />
      </div>

      <div className="flex gap-2 mb-6">
        {(["all", "medicines", "procedures", "diagnostics"] as ResultType[]).map(
          (t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-full text-sm font-medium capitalize transition-colors ${
                type === t
                  ? "bg-[var(--color-primary)] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t}
            </button>
          )
        )}
      </div>

      {query.length >= 2 && (
        <p className="text-sm text-gray-500 mb-4">
          {totalResults} result{totalResults !== 1 ? "s" : ""} found
        </p>
      )}

      {/* Medicine Results */}
      {results.medicines.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Pill size={18} className="text-teal-600" />
            Medicines
          </h2>
          <div className="space-y-2">
            {results.medicines.map((drug, i) => {
              const cheapest = Math.min(
                ...drug.prices.map((p) => p.sellingPrice)
              );
              const idx = sampleDrugs.indexOf(drug);
              return (
                <Link
                  key={i}
                  href={`/medicines/${idx}`}
                  className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="font-medium text-gray-900">{drug.name}</p>
                    <p className="text-sm text-gray-500">
                      {drug.composition} &middot; {drug.manufacturer}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[var(--color-primary)]">
                      {formatPrice(cheapest)}
                    </p>
                    {drug.isGeneric && (
                      <span className="text-xs text-green-600">Generic</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Procedure Results */}
      {results.procedures.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Stethoscope size={18} className="text-blue-600" />
            Surgeries & Procedures
          </h2>
          <div className="space-y-2">
            {results.procedures.map((proc) => {
              const minPrice = Math.min(
                ...proc.prices.map((p) => p.minPrice)
              );
              return (
                <Link
                  key={proc.slug}
                  href="/procedures"
                  className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="font-medium text-gray-900">{proc.name}</p>
                    <p className="text-sm text-gray-500">{proc.category}</p>
                  </div>
                  <p className="font-bold text-[var(--color-primary)]">
                    From {formatPrice(minPrice)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Diagnostic Results */}
      {results.diagnostics.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TestTube size={18} className="text-purple-600" />
            Lab Tests & Scans
          </h2>
          <div className="space-y-2">
            {results.diagnostics.map((test) => {
              const cheapest = Math.min(
                ...test.prices.map((p) => p.sellingPrice)
              );
              return (
                <Link
                  key={test.slug}
                  href="/diagnostics"
                  className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-sm transition-all"
                >
                  <div>
                    <p className="font-medium text-gray-900">{test.name}</p>
                    <p className="text-sm text-gray-500">
                      {test.type} &middot; {test.category}
                    </p>
                  </div>
                  <p className="font-bold text-[var(--color-primary)]">
                    From {formatPrice(cheapest)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {query.length >= 2 && totalResults === 0 && (
        <div className="text-center py-16">
          <Search size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No results found for &quot;{query}&quot;</p>
          <p className="text-sm text-gray-400 mt-1">
            Try different keywords or browse categories
          </p>
        </div>
      )}
    </div>
  );
}
