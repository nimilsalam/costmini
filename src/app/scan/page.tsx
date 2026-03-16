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
import { formatPrice, calcSavings, whatsappShareUrl, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const variant = pct >= 90 ? "default" : pct >= 70 ? "secondary" : "outline";
  return <Badge variant={variant}>{pct}% match</Badge>;
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
          <Sparkles size={24} className="text-primary" />
          <h1 className="text-3xl font-bold text-gray-900">AI Prescription Scanner</h1>
        </div>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Upload your prescription photo. Our AI reads handwriting, identifies medicines, and instantly finds cheaper generic alternatives.
        </p>
      </div>

      {status === "idle" && (
        <div className="space-y-4">
          <Card
            className="border-2 border-dashed hover:border-primary hover:bg-accent/50 transition-all cursor-pointer"
            onClick={() => fileRef.current?.click()}
          >
            <CardContent className="p-12 text-center">
              <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-1">Upload Prescription Photo</p>
              <p className="text-sm text-muted-foreground">Click to upload or drag and drop (JPG, PNG, PDF)</p>
              <div className="flex items-center justify-center gap-4 mt-4">
                <Badge variant="secondary" className="bg-accent text-primary">
                  <Sparkles size={12} className="mr-1" /> AI-Powered
                </Badge>
                <Badge variant="secondary" className="bg-blue-50 text-blue-600">
                  <Clock size={12} className="mr-1" /> ~5 seconds
                </Badge>
              </div>
              <input ref={fileRef} type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
            </CardContent>
          </Card>

          <div className="flex items-center gap-4">
            <Separator className="flex-1" />
            <span className="text-sm text-muted-foreground">or</span>
            <Separator className="flex-1" />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="h-auto px-6 py-4 rounded-xl justify-start gap-3"
              onClick={() => fileRef.current?.click()}
            >
              <Camera size={24} className="text-primary" />
              <div className="text-left">
                <p className="font-medium text-gray-900">Take Photo</p>
                <p className="text-xs text-muted-foreground">Use your camera</p>
              </div>
            </Button>
            <Button
              variant="outline"
              className="h-auto px-6 py-4 rounded-xl justify-start gap-3 border-primary bg-accent hover:bg-primary/10"
              onClick={handleDemoScan}
            >
              <Scan size={24} className="text-primary" />
              <div className="text-left">
                <p className="font-medium text-primary">Try Demo Scan</p>
                <p className="text-xs text-muted-foreground">See how it works</p>
              </div>
            </Button>
          </div>
        </div>
      )}

      {(status === "uploading" || status === "processing") && (
        <div className="text-center py-16">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-2xl border-2 border-primary overflow-hidden">
              {previewUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Prescription" className="w-full h-full object-cover opacity-50" />
              )}
              <div className="absolute inset-0 bg-primary/10" />
              <div className="absolute left-0 right-0 h-0.5 bg-primary animate-scan-line" />
            </div>
          </div>
          <Loader2 size={24} className="mx-auto text-primary animate-spin mb-3" />
          <p className="text-gray-700 font-medium">
            {status === "uploading" ? "Uploading image..." : "AI is analyzing your prescription..."}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Reading medicine names, dosages, and finding alternatives</p>
          <div className="mt-6 max-w-xs mx-auto space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="py-12 space-y-4">
          <Alert variant="destructive" className="max-w-md mx-auto">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle>Scan Failed</AlertTitle>
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
          <div className="text-center">
            <Button
              onClick={() => { setStatus("idle"); setResults([]); }}
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="space-y-6">
          <div className="flex items-center justify-center gap-2">
            <Badge variant={scanMethod === "ai" ? "default" : "secondary"}>
              {scanMethod === "ai" ? "Analyzed by Groq AI" : "Demo Results"}
            </Badge>
          </div>

          {results.length > 0 && totalSavings > 0 && (
            <Card className="bg-gradient-to-r from-green-500 to-teal-500 border-0 text-white">
              <CardContent className="p-6 text-center">
                <p className="text-green-100 text-sm mb-1">Switching to generics you could save</p>
                <p className="text-4xl font-bold mb-1">{formatPrice(totalBrandCost - totalGenericCost)}</p>
                <p className="text-green-100">That&apos;s {totalSavings}% savings on this prescription!</p>
                <div className="flex justify-center gap-4 mt-4 text-sm">
                  <div>
                    <span className="text-green-200">Branded Total:</span>{" "}
                    <span className="font-semibold line-through">{formatPrice(totalBrandCost)}</span>
                  </div>
                  <div>
                    <span className="text-green-200">Generic Total:</span>{" "}
                    <span className="font-semibold">{formatPrice(totalGenericCost)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {results.map((result, i) => {
            const drug = result.matchedDrug;
            const brandPrice = drug ? getPrice(drug) : 0;
            return (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs text-muted-foreground">From prescription</p>
                        <ConfidenceBadge confidence={result.confidence} />
                      </div>
                      <CardTitle className="text-lg">
                        {drug ? drug.name : result.extractedName}
                      </CardTitle>
                      <CardDescription>
                        {drug
                          ? `${drug.composition} · ${drug.manufacturer}`
                          : result.extractedGeneric || "Not found in database"}
                      </CardDescription>
                      {(result.dosage || result.frequency || result.duration) && (
                        <div className="flex gap-2 mt-2">
                          {result.dosage && (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                              {result.dosage}
                            </Badge>
                          )}
                          {result.frequency && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                              {result.frequency}
                            </Badge>
                          )}
                          {result.duration && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              {result.duration}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {drug && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Brand Price</p>
                        <p className="text-xl font-bold text-gray-900">{formatPrice(brandPrice)}</p>
                      </div>
                    )}
                  </div>
                </CardHeader>

                {result.alternatives.length > 0 && (
                  <CardContent className="bg-green-50/50 pt-4">
                    <p className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-1">
                      <Pill size={14} /> Cheaper Generic Alternatives
                    </p>
                    {result.alternatives.map((alt, j) => {
                      const altPrice = getPrice(alt);
                      const savePct = calcSavings(brandPrice, altPrice);
                      return (
                        <Link
                          key={j}
                          href={`/medicines/${alt.slug}`}
                          className="flex items-center justify-between p-3 rounded-lg bg-white hover:shadow-md transition-all mb-2"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{alt.name}</span>
                            {alt.isGeneric && (
                              <Badge variant="secondary" className="ml-2 text-xs bg-green-100 text-green-700">
                                Generic
                              </Badge>
                            )}
                            <p className="text-xs text-muted-foreground">{alt.manufacturer} · {alt.packSize}</p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="text-lg font-bold text-green-600">{formatPrice(altPrice)}</p>
                              <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                                Save {savePct}%
                              </Badge>
                            </div>
                            <ArrowRight size={16} className="text-muted-foreground" />
                          </div>
                        </Link>
                      );
                    })}
                  </CardContent>
                )}

                {!drug && (
                  <CardFooter className="bg-amber-50 py-3">
                    <Alert className="border-amber-200 bg-transparent">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertDescription className="text-amber-700">
                        This medicine is not yet in our database. We&apos;re expanding coverage regularly.
                      </AlertDescription>
                    </Alert>
                  </CardFooter>
                )}
              </Card>
            );
          })}

          {results.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">No medicines could be identified. Try a clearer photo or search manually.</p>
                <Button asChild className="mt-4">
                  <Link href="/search">AI Search</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              variant="outline"
              className="flex-1 py-3 rounded-xl"
              onClick={() => { setStatus("idle"); setResults([]); setPreviewUrl(null); }}
            >
              Scan Another Prescription
            </Button>
            {results.length > 0 && (
              <Button
                asChild
                className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white"
              >
                <a
                  href={whatsappShareUrl(`CostMini AI Scan Results!\n\nI can save ${totalSavings}% (${formatPrice(totalBrandCost - totalGenericCost)}) by switching to generics.\n\nScan your prescription: costmini.in/scan`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2"
                >
                  <Share2 size={18} /> Share on WhatsApp
                </a>
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
