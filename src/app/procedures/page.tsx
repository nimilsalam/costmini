"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Stethoscope, MapPin, Share2, Loader2 } from "lucide-react";
import { procedureCategories } from "@/lib/constants";
import { formatPrice, whatsappShareUrl } from "@/lib/utils";

interface ProcedurePrice {
  hospitalName: string;
  city: string;
  minPrice: number;
  maxPrice: number;
  avgPrice: number;
  includesStay: boolean;
  accreditation?: string;
  rating?: number;
}

interface Procedure {
  id: string;
  name: string;
  slug: string;
  category: string;
  description?: string;
  duration?: string;
  recoveryTime?: string;
  anesthesia?: string;
  prices: ProcedurePrice[];
  minPrice: number;
  maxPrice: number;
  hospitalCount: number;
}

export default function ProceduresPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProcedures = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "All") params.set("category", category);

    try {
      const res = await fetch(`/api/procedures?${params}`);
      const data = await res.json();
      setProcedures(data.results || []);
    } catch {
      setProcedures([]);
    }
    setLoading(false);
  }, [query, category]);

  useEffect(() => {
    const timeout = setTimeout(fetchProcedures, 300);
    return () => clearTimeout(timeout);
  }, [fetchProcedures]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Surgery & Procedure Costs</h1>
        <p className="text-gray-500">Compare surgery costs across hospitals. Find affordable, accredited options.</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 space-y-4">
        <div className="relative">
          <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search surgeries or procedures..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategory("All")}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === "All" ? "bg-[var(--color-primary)] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {procedureCategories.map((c) => (
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
        </div>
      </div>

      {loading && (
        <div className="text-center py-8">
          <Loader2 size={24} className="mx-auto text-[var(--color-primary)] animate-spin" />
        </div>
      )}

      <div className="space-y-6">
        {procedures.map((proc) => {
          const shareText = `🏥 ${proc.name} — From ${formatPrice(proc.minPrice)} on CostMini!\nCompare hospital prices: costmini.in/procedures`;
          return (
            <div key={proc.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <span className="text-xs font-medium text-[var(--color-primary)] uppercase tracking-wider">{proc.category}</span>
                    <h2 className="text-xl font-bold text-gray-900 mt-1">{proc.name}</h2>
                    {proc.description && <p className="text-sm text-gray-500 mt-1">{proc.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                      {proc.duration && <span>Duration: {proc.duration}</span>}
                      {proc.recoveryTime && <span>Recovery: {proc.recoveryTime}</span>}
                      {proc.anesthesia && <span>Anesthesia: {proc.anesthesia}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-gray-400">Price Range</div>
                    <div className="text-2xl font-bold text-[var(--color-primary)]">
                      {formatPrice(proc.minPrice)} – {formatPrice(proc.maxPrice)}
                    </div>
                    <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 text-sm mt-2 hover:underline">
                      <Share2 size={14} /> Share
                    </a>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {proc.prices.sort((a, b) => a.avgPrice - b.avgPrice).map((hp, i) => (
                  <div key={i} className={`px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${i === 0 ? "bg-green-50/50" : ""}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{hp.hospitalName}</span>
                        {hp.accreditation && <span className="px-1.5 py-0.5 rounded text-xs bg-blue-100 text-blue-700 font-medium">{hp.accreditation}</span>}
                        {i === 0 && <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">Most Affordable</span>}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1"><MapPin size={12} />{hp.city}</span>
                        {hp.includesStay && <span>Includes hospital stay</span>}
                        {hp.rating && <span>Rating: {hp.rating}/5</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">{formatPrice(hp.avgPrice)}</div>
                      <div className="text-xs text-gray-400">{formatPrice(hp.minPrice)} – {formatPrice(hp.maxPrice)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {!loading && procedures.length === 0 && (
        <div className="text-center py-16">
          <Stethoscope size={48} className="mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No procedures found</p>
        </div>
      )}
    </div>
  );
}
