"use client";

import { useState, useRef, useCallback } from "react";
import {
  Camera,
  Upload,
  Scan,
  Loader2,
  AlertCircle,
  Share2,
  Pill,
  ArrowRight,
  Sparkles,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { formatPrice, calcSavings, whatsappShareUrl } from "@/lib/utils";

interface DrugPrice {
  source: string;
  mrp: number;
  sellingPrice: number;
  inStock: boolean;
}

interface MatchedDrug {
  id: string;
  name: string;
  slug: string;
  genericName: string;
  manufacturer: string;
  composition: string;
  packSize: string;
  isGeneric: boolean;
  prices: DrugPrice[];
}

interface ScanResult {
  extractedName: string;
  extractedGeneric: string | null;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  matchedDrug: MatchedDrug | null;
  alternatives: MatchedDrug[];
  confidence: number;
}

export default function ScanPage() {
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [scanMethod, setScanMethod] = useState<"ai" | "demo">("ai");
  const fileRef = useRef<HTMLInputElement>(null);

  const processWithAI = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/ai/scan", { method: "POST", body: formData });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Scan failed" }));
      throw new Error(err.error || "AI scan failed");
    }
    const data = await res.json();
    return data.results as ScanResult[];
  }, []);

  const processImage = useCallback(
    async (file: File) => {
      setStatus("uploading");
      setPreviewUrl(URL.createObjectURL(file));
      setErrorMsg("");
      try {
        setStatus("processing");
        const scanResults = await processWithAI(file);
        setScanMethod("ai");
        setResults(scanResults);
        setStatus("done");
      } catch {
        setErrorMsg("Could not analyze the prescription. Please try a clearer photo.");
        setStatus("error");
      }
    },
    [processWithAI]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDemoScan = async () => {
    setStatus("processing");
    setPreviewUrl(null);
    setScanMethod("demo");
    try {
      const res = await fetch("/api/drugs/search?q=paracetamol&limit=3");
      const data = await res.json();
      const demoResults: ScanResult[] = [];
      if (data.results && data.results.length > 0) {
        const drug = data.results[0];
        demoResults.push({
          extractedName: `Tab ${drug.name}`,
          extractedGeneric: drug.genericName,
          dosage: "650mg",
          frequency: "1-0-1",
          duration: "5 days",
          matchedDrug: drug,
          alternatives: [],
          confidence: 0.95,
        });
      }
      setTimeout(() => { setResults(demoResults); setStatus("done"); }, 1500);
    } catch {
      setTimeout(() => { setResults([]); setStatus("done"); }, 1500);
    }
  };

  const getPrice = (drug: MatchedDrug) =>
    drug.prices.length > 0 ? Math.min(...drug.prices.map((p) => p.sellingPrice)) : 0;

  const totalBrandCost = results.reduce((sum, r) => {
    if (!r.matchedDrug) return sum;
    return sum + getPrice(r.matchedDrug);
  }, 0);

  const totalGenericCost = results.reduce((sum, r) => {
    if (r.alternatives.length === 0) {
      if (!r.matchedDrug) return sum;
      return sum + getPrice(r.matchedDrug);
    }
    return sum + Math.min(...r.alternatives.map((a) => getPrice(a)));
  }, 0);

  const totalSavings = totalBrandCost > 0 ? calcSavings(totalBrandCost, totalGenericCost) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles size={24} className="text-[var(--color-primary)]" />
          <h1 className="text-3xl font-bold text-gray-900">AI Prescription Scanner</h1>
        </div>
        <p className="text-gray-500 max-w-xl mx-auto">
          Upload your prescription photo. Our AI reads handwriting, identifies medicines, and instantly finds cheaper generic alternatives.
        </p>
      </div>

      {status === "idle" && (
        <div className="space-y-4">
          <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-[var(--color-primary)] hover:bg-teal-50/50 transition-all cursor-pointer">
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-1">Upload Prescription Photo</p>
            <p className="text-sm text-gray-500">Click to upload or drag and drop (JPG, PNG, PDF)</p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-3 py-1 rounded-full"><Sparkles size={12} /> AI-Powered</span>
              <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full"><Clock size={12} /> ~5 seconds</span>
            </div>
            <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:bg-teal-50/50 transition-all">
              <Camera size={24} className="text-[var(--color-primary)]" />
              <div className="text-left"><p className="font-medium text-gray-900">Take Photo</p><p className="text-xs text-gray-500">Use your camera</p></div>
            </button>
            <button onClick={handleDemoScan} className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-[var(--color-primary)] bg-teal-50 hover:bg-teal-100 transition-all">
              <Scan size={24} className="text-[var(--color-primary)]" />
              <div className="text-left"><p className="font-medium text-[var(--color-primary)]">Try Demo Scan</p><p className="text-xs text-gray-500">See how it works</p></div>
            </button>
          </div>
        </div>
      )}

      {(status === "uploading" || status === "processing") && (
        <div className="text-center py-16">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl border-2 border-[var(--color-primary)] overflow-hidden">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Prescription" className="w-full h-full object-cover opacity-50" />
              )}
              <div className="absolute inset-0 bg-[var(--color-primary)]/10" />
              <div className="absolute left-0 right-0 h-0.5 bg-[var(--color-primary)] animate-scan-line" />
            </div>
          </div>
          <Loader2 size={24} className="mx-auto text-[var(--color-primary)] animate-spin mb-3" />
          <p className="text-gray-700 font-medium">{status === "uploading" ? "Uploading image..." : "AI is analyzing your prescription..."}</p>
          <p className="text-sm text-gray-500 mt-1">Reading medicine names, dosages, and finding alternatives</p>
        </div>
      )}

      {status === "error" && (
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-red-600 font-medium mb-2">{errorMsg}</p>
          <button onClick={() => { setStatus("idle"); setResults([]); }} className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium">Try Again</button>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs px-3 py-1 rounded-full bg-teal-50 text-teal-700 font-medium">
              {scanMethod === "ai" ? "Analyzed by Groq AI" : "Demo Results"}
            </span>
          </div>

          {results.length > 0 && totalSavings > 0 && (
            <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-6 text-white text-center">
              <p className="text-green-100 text-sm mb-1">Switching to generics you could save</p>
              <p className="text-4xl font-bold mb-1">{formatPrice(totalBrandCost - totalGenericCost)}</p>
              <p className="text-green-100">That&apos;s {totalSavings}% savings on this prescription!</p>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <div><span className="text-green-200">Branded Total:</span> <span className="font-semibold line-through">{formatPrice(totalBrandCost)}</span></div>
                <div><span className="text-green-200">Generic Total:</span> <span className="font-semibold">{formatPrice(totalGenericCost)}</span></div>
              </div>
            </div>
          )}

          {results.map((result, i) => {
            const drug = result.matchedDrug;
            const brandPrice = drug ? getPrice(drug) : 0;
            return (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-gray-400">From prescription</p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{Math.round(result.confidence * 100)}% match</span>
                      </div>
                      <h3 className="text-lg font-bold text-gray-900">{drug ? drug.name : result.extractedName}</h3>
                      <p className="text-sm text-gray-500">{drug ? `${drug.composition} · ${drug.manufacturer}` : result.extractedGeneric || "Not found in database"}</p>
                      {(result.dosage || result.frequency || result.duration) && (
                        <div className="flex gap-3 mt-2">
                          {result.dosage && <span className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700">{result.dosage}</span>}
                          {result.frequency && <span className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-700">{result.frequency}</span>}
                          {result.duration && <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700">{result.duration}</span>}
                        </div>
                      )}
                    </div>
                    {drug && (
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Brand Price</p>
                        <p className="text-xl font-bold text-gray-900">{formatPrice(brandPrice)}</p>
                      </div>
                    )}
                  </div>
                </div>
                {result.alternatives.length > 0 && (
                  <div className="bg-green-50/50 p-5">
                    <p className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-1"><Pill size={14} /> Cheaper Generic Alternatives</p>
                    {result.alternatives.map((alt, j) => {
                      const altPrice = getPrice(alt);
                      const savePct = calcSavings(brandPrice, altPrice);
                      return (
                        <Link key={j} href={`/medicines/${alt.slug}`} className="flex items-center justify-between p-3 rounded-lg bg-white hover:shadow-md transition-all mb-2">
                          <div>
                            <span className="font-medium text-gray-900">{alt.name}</span>
                            <p className="text-xs text-gray-500">{alt.manufacturer} · {alt.packSize}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-lg font-bold text-green-600">{formatPrice(altPrice)}</p>
                              <p className="text-xs text-green-600 font-medium">Save {savePct}%</p>
                            </div>
                            <ArrowRight size={16} className="text-gray-400" />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
                {!drug && (
                  <div className="p-4 bg-amber-50">
                    <p className="text-sm text-amber-700">This medicine is not yet in our database. We&apos;re expanding coverage regularly.</p>
                  </div>
                )}
              </div>
            );
          })}

          {results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">No medicines could be identified. Try a clearer photo or search manually.</p>
              <Link href="/search" className="inline-block mt-4 px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium">AI Search</Link>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => { setStatus("idle"); setResults([]); setPreviewUrl(null); }} className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors">
              Scan Another Prescription
            </button>
            {results.length > 0 && (
              <a href={whatsappShareUrl(`💊 CostMini AI Scan Results!\n\nI can save ${totalSavings}% (${formatPrice(totalBrandCost - totalGenericCost)}) by switching to generics.\n\nScan your prescription: costmini.in/scan`)}
                target="_blank" rel="noopener noreferrer" className="flex-1 px-6 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2">
                <Share2 size={18} /> Share on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
