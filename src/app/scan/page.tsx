"use client";

import { useState, useRef, useCallback } from "react";
import { Camera, Upload, Scan, Loader2, AlertCircle, Share2, Pill, ArrowRight } from "lucide-react";
import Link from "next/link";
import { sampleDrugs } from "@/lib/sample-data";
import { formatPrice, calcSavings, whatsappShareUrl } from "@/lib/utils";

interface ScanResult {
  extractedName: string;
  matchedDrug: (typeof sampleDrugs)[0] | null;
  alternatives: (typeof sampleDrugs)[0][];
  confidence: number;
}

export default function ScanPage() {
  const [status, setStatus] = useState<"idle" | "uploading" | "processing" | "done" | "error">("idle");
  const [results, setResults] = useState<ScanResult[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setStatus("uploading");
    setPreviewUrl(URL.createObjectURL(file));
    setErrorMsg("");

    try {
      setStatus("processing");

      // Use Tesseract.js for OCR
      const Tesseract = await import("tesseract.js");
      const { data } = await Tesseract.recognize(file, "eng", {
        logger: () => {},
      });

      const text = data.text;
      if (!text.trim()) {
        setErrorMsg("Could not read text from the image. Please try a clearer photo.");
        setStatus("error");
        return;
      }

      // Match extracted text against our drug database
      const extractedLines = text
        .split("\n")
        .map((l: string) => l.trim())
        .filter((l: string) => l.length > 2);

      const matchedResults: ScanResult[] = [];

      for (const line of extractedLines) {
        const lineLower = line.toLowerCase();
        // Try to match against drug names, generic names, or compositions
        const matched = sampleDrugs.find(
          (d) =>
            lineLower.includes(d.name.toLowerCase()) ||
            lineLower.includes(d.genericName.toLowerCase()) ||
            d.composition.toLowerCase().split(" ").some((word) => word.length > 3 && lineLower.includes(word.toLowerCase()))
        );

        if (matched) {
          const alternatives = sampleDrugs.filter(
            (d) =>
              d.genericName === matched.genericName &&
              d.name !== matched.name &&
              d.isGeneric
          );

          matchedResults.push({
            extractedName: line,
            matchedDrug: matched,
            alternatives,
            confidence: 0.85,
          });
        }
      }

      // If no matches, try fuzzy matching on just the known drug names
      if (matchedResults.length === 0) {
        const textLower = text.toLowerCase();
        for (const drug of sampleDrugs) {
          if (
            textLower.includes(drug.name.toLowerCase()) ||
            textLower.includes(drug.genericName.toLowerCase())
          ) {
            const alternatives = sampleDrugs.filter(
              (d) =>
                d.genericName === drug.genericName &&
                d.name !== drug.name &&
                d.isGeneric
            );
            matchedResults.push({
              extractedName: drug.name,
              matchedDrug: drug,
              alternatives,
              confidence: 0.7,
            });
          }
        }
      }

      // Deduplicate by drug name
      const seen = new Set<string>();
      const unique = matchedResults.filter((r) => {
        if (!r.matchedDrug || seen.has(r.matchedDrug.name)) return false;
        seen.add(r.matchedDrug.name);
        return true;
      });

      setResults(unique);
      setStatus("done");
    } catch {
      setErrorMsg("Error processing image. Please try again.");
      setStatus("error");
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImage(file);
  };

  const handleDemoScan = () => {
    // Demo mode - simulate scan results
    setStatus("processing");
    setPreviewUrl(null);
    setTimeout(() => {
      const demoResults: ScanResult[] = [
        {
          extractedName: "Tab Dolo 650 (1 strip)",
          matchedDrug: sampleDrugs[0], // Dolo 650
          alternatives: sampleDrugs.filter(
            (d) => d.genericName === "Paracetamol" && d.isGeneric
          ),
          confidence: 0.92,
        },
        {
          extractedName: "Tab Azithral 500 (1 strip)",
          matchedDrug: sampleDrugs[2], // Azithral 500
          alternatives: sampleDrugs.filter(
            (d) => d.genericName === "Azithromycin" && d.isGeneric
          ),
          confidence: 0.88,
        },
        {
          extractedName: "Tab Pan 40 (1 strip)",
          matchedDrug: sampleDrugs[4], // Pan 40
          alternatives: sampleDrugs.filter(
            (d) => d.genericName === "Pantoprazole" && d.isGeneric
          ),
          confidence: 0.9,
        },
      ];
      setResults(demoResults);
      setStatus("done");
    }, 2000);
  };

  const totalBrandCost = results.reduce((sum, r) => {
    if (!r.matchedDrug) return sum;
    return sum + Math.min(...r.matchedDrug.prices.map((p) => p.sellingPrice));
  }, 0);

  const totalGenericCost = results.reduce((sum, r) => {
    if (r.alternatives.length === 0) {
      if (!r.matchedDrug) return sum;
      return sum + Math.min(...r.matchedDrug.prices.map((p) => p.sellingPrice));
    }
    const cheapest = Math.min(
      ...r.alternatives.flatMap((a) => a.prices.map((p) => p.sellingPrice))
    );
    return sum + cheapest;
  }, 0);

  const totalSavings = totalBrandCost > 0 ? calcSavings(totalBrandCost, totalGenericCost) : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Scan Your Prescription
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Take a photo or upload your prescription. Our AI will find cheaper,
          quality-certified generic alternatives instantly.
        </p>
      </div>

      {/* Upload Area */}
      {status === "idle" && (
        <div className="space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-12 text-center hover:border-[var(--color-primary)] hover:bg-teal-50/50 transition-all cursor-pointer"
          >
            <Upload size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-lg font-medium text-gray-700 mb-1">
              Upload Prescription Photo
            </p>
            <p className="text-sm text-gray-500">
              Click to upload or drag and drop (JPG, PNG, PDF)
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:bg-teal-50/50 transition-all"
            >
              <Camera size={24} className="text-[var(--color-primary)]" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Take Photo</p>
                <p className="text-xs text-gray-500">Use your camera</p>
              </div>
            </button>
            <button
              onClick={handleDemoScan}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-xl border border-[var(--color-primary)] bg-teal-50 hover:bg-teal-100 transition-all"
            >
              <Scan size={24} className="text-[var(--color-primary)]" />
              <div className="text-left">
                <p className="font-medium text-[var(--color-primary)]">
                  Try Demo Scan
                </p>
                <p className="text-xs text-gray-500">See how it works</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Processing */}
      {(status === "uploading" || status === "processing") && (
        <div className="text-center py-16">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl border-2 border-[var(--color-primary)] overflow-hidden">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Prescription"
                  className="w-full h-full object-cover opacity-50"
                />
              )}
              <div className="absolute inset-0 bg-[var(--color-primary)]/10" />
              <div className="absolute left-0 right-0 h-0.5 bg-[var(--color-primary)] animate-scan-line" />
            </div>
          </div>
          <Loader2
            size={24}
            className="mx-auto text-[var(--color-primary)] animate-spin mb-3"
          />
          <p className="text-gray-700 font-medium">
            {status === "uploading"
              ? "Uploading image..."
              : "Analyzing prescription with AI..."}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Extracting medicine names and finding alternatives
          </p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="text-center py-12">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-red-600 font-medium mb-2">{errorMsg}</p>
          <button
            onClick={() => {
              setStatus("idle");
              setResults([]);
            }}
            className="px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Results */}
      {status === "done" && (
        <div className="space-y-6">
          {/* Summary Card */}
          {results.length > 0 && totalSavings > 0 && (
            <div className="bg-gradient-to-r from-green-500 to-teal-500 rounded-2xl p-6 text-white text-center">
              <p className="text-green-100 text-sm mb-1">
                Switching to generics you could save
              </p>
              <p className="text-4xl font-bold mb-1">
                {formatPrice(totalBrandCost - totalGenericCost)}
              </p>
              <p className="text-green-100">
                That&apos;s {totalSavings}% savings on this prescription!
              </p>
              <div className="flex justify-center gap-4 mt-4 text-sm">
                <div>
                  <span className="text-green-200">Branded Total:</span>{" "}
                  <span className="font-semibold line-through">
                    {formatPrice(totalBrandCost)}
                  </span>
                </div>
                <div>
                  <span className="text-green-200">Generic Total:</span>{" "}
                  <span className="font-semibold">
                    {formatPrice(totalGenericCost)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Medicine Results */}
          {results.map((result, i) => {
            if (!result.matchedDrug) return null;
            const drug = result.matchedDrug;
            const brandPrice = Math.min(
              ...drug.prices.map((p) => p.sellingPrice)
            );

            return (
              <div
                key={i}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden"
              >
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">
                        Detected from prescription
                      </p>
                      <h3 className="text-lg font-bold text-gray-900">
                        {drug.name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {drug.composition} &middot; {drug.manufacturer}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Brand Price</p>
                      <p className="text-xl font-bold text-gray-900">
                        {formatPrice(brandPrice)}
                      </p>
                    </div>
                  </div>
                </div>

                {result.alternatives.length > 0 && (
                  <div className="bg-green-50/50 p-5">
                    <p className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-1">
                      <Pill size={14} />
                      Cheaper Generic Alternatives
                    </p>
                    {result.alternatives.map((alt, j) => {
                      const altPrice = Math.min(
                        ...alt.prices.map((p) => p.sellingPrice)
                      );
                      const savePct = calcSavings(brandPrice, altPrice);
                      return (
                        <Link
                          key={j}
                          href={`/medicines/${sampleDrugs.indexOf(alt)}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-white hover:shadow-md transition-all mb-2"
                        >
                          <div>
                            <span className="font-medium text-gray-900">
                              {alt.name}
                            </span>
                            <p className="text-xs text-gray-500">
                              {alt.manufacturer} &middot; {alt.packSize}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-lg font-bold text-green-600">
                                {formatPrice(altPrice)}
                              </p>
                              <p className="text-xs text-green-600 font-medium">
                                Save {savePct}%
                              </p>
                            </div>
                            <ArrowRight
                              size={16}
                              className="text-gray-400"
                            />
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {results.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-500">
                No medicines could be matched from this image. Try a clearer
                photo or search manually.
              </p>
              <Link
                href="/medicines"
                className="inline-block mt-4 px-6 py-2 rounded-lg bg-[var(--color-primary)] text-white font-medium"
              >
                Search Medicines
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => {
                setStatus("idle");
                setResults([]);
                setPreviewUrl(null);
              }}
              className="flex-1 px-6 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
            >
              Scan Another Prescription
            </button>
            {results.length > 0 && (
              <a
                href={whatsappShareUrl(
                  `💊 CostMini Prescription Scan Results!\n\nI can save ${totalSavings}% (${formatPrice(totalBrandCost - totalGenericCost)}) by switching to generics.\n\nScan your prescription: costmini.in/scan`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 px-6 py-3 rounded-xl bg-green-500 text-white font-medium hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
              >
                <Share2 size={18} />
                Share Results on WhatsApp
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
