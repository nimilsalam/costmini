"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, TestTube, MapPin, Home, Share2, Loader2 } from "lucide-react";
import { diagnosticCategories } from "@/lib/constants";
import { formatPrice, calcSavings, whatsappShareUrl } from "@/lib/utils";

interface DiagnosticPrice {
  labName: string;
  city: string;
  mrp: number;
  sellingPrice: number;
  homeCollection: boolean;
  accreditation?: string;
}

interface Diagnostic {
  id: string;
  name: string;
  slug: string;
  category: string;
  type: string;
  description?: string;
  preparation?: string;
  reportTime?: string;
  homeCollection: boolean;
  prices: DiagnosticPrice[];
}

export default function DiagnosticsPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [homeOnly, setHomeOnly] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "All") params.set("category", category);
    if (homeOnly) params.set("homeCollection", "true");

    try {
      const res = await fetch(`/api/diagnostics?${params}`);
      const data = await res.json();
      setDiagnostics(data.results || []);
    } catch {
      setDiagnostics([]);
    }
    setLoading(false);
  }, [query, category, homeOnly]);

  useEffect(() => {
    const timeout = setTimeout(fetchDiagnostics, 300);
    return () => clearTimeout(timeout);
  }, [fetchDiagnostics]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Lab Tests & Diagnostic Prices</h1>
        <p className="text-gray-500">Compare blood tests, MRI, CT scans and more across labs. Book at the best price.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 space-y-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search lab tests, scans, or health checkups..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {["All", ...diagnosticCategories].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === c ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {c}
            </button>
          ))}
          <button
            onClick={() => setHomeOnly(!homeOnly)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors flex items-center gap-1 ${
              homeOnly ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]" : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            <Home size={14} /> Home Collection
          </button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-8">
          <Loader2 size={24} className="mx-auto text-[var(--color-primary)] animate-spin" />
        </div>
      )}

      <div className="space-y-6">
        {diagnostics.map((test) => {
          const cheapest = test.prices.length > 0 ? Math.min(...test.prices.map((p) => p.sellingPrice)) : 0;
          const mostExpensive = test.prices.length > 0 ? Math.max(...test.prices.map((p) => p.mrp)) : 0;
          const shareText = `🔬 ${test.name} — From ${formatPrice(cheapest)} on CostMini!\nCompare lab prices: costmini.in/diagnostics`;

          return (
            <div key={test.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs font-medium">{test.type}</span>
                      {test.homeCollection && (
                        <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-xs font-medium flex items-center gap-1">
                          <Home size={10} /> Home Collection
                        </span>
                      )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{test.name}</h2>
                    {test.description && <p className="text-sm text-gray-500 mt-1">{test.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                      {test.preparation && <span>Prep: {test.preparation}</span>}
                      {test.reportTime && <span>Report: {test.reportTime}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-gray-400">Starting from</div>
                    <div className="text-2xl font-bold text-[var(--color-primary)]">{formatPrice(cheapest)}</div>
                    {mostExpensive > cheapest && (
                      <div className="text-sm text-gray-400 line-through">MRP {formatPrice(mostExpensive)}</div>
                    )}
                    <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 text-sm mt-1 hover:underline">
                      <Share2 size={14} /> Share
                    </a>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {test.prices.sort((a, b) => a.sellingPrice - b.sellingPrice).map((lp, i) => {
                  const lpSavings = calcSavings(lp.mrp, lp.sellingPrice);
                  return (
                    <div key={i} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${i === 0 ? "bg-green-50/50" : ""}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{lp.labName}</span>
                          {lp.accreditation && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">{lp.accreditation}</span>}
                          {i === 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">Best Price</span>}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                          <span className="flex items-center gap-1"><MapPin size={12} />{lp.city}</span>
                          {lp.homeCollection && (
                            <span className="flex items-center gap-1 text-teal-600"><Home size={12} /> Home Collection</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">{formatPrice(lp.sellingPrice)}</div>
                        {lpSavings > 0 && <span className="text-sm text-green-600">{lpSavings}% off MRP</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && diagnostics.length === 0 && (
        <div className="text-center py-16">
          <TestTube size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No tests found</p>
        </div>
      )}
    </div>
  );
}
