"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Shield,
  Share2,
  ExternalLink,
  AlertCircle,
  Loader2,
  Clock,
  RefreshCw,
  Zap,
  ShieldCheck,
  Award,
  Globe2,
  Building2,
  Check,
  Truck,
  Star,
  ChevronDown,
  ChevronUp,
  Pill,
  FlaskConical,
  Tag,
} from "lucide-react";
import { getPharmacyProfile } from "@/lib/pharmacy-profiles";
import { cn, formatPrice, calcSavings, whatsappShareUrl, whatsappDrugShareText } from "@/lib/utils";
import { getFreshness } from "@/lib/freshness";
import { usePriceStream, type StreamedPrice } from "@/hooks/usePriceStream";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

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
  compositionGroup?: {
    id: string;
    displayName: string;
    drugCount: number;
    lowestPrice: number | null;
    highestPrice: number | null;
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
  prices?: { source: string; sellingPrice: number; mrp: number; inStock: boolean; sourceUrl?: string; lastChecked: string }[];
  manufacturerRef?: { tier: string; overallScore: number } | null;
}

interface ScoreInfo {
  total: number;
  badge: "best-value" | "recommended" | "good-option" | null;
  explanation: string;
}

const logoSlug: Record<string, string> = {
  "1mg": "1mg",
  PharmEasy: "pharmeasy",
  Netmeds: "netmeds",
  Apollo: "apollo",
  "Flipkart Health": "flipkart",
  Truemeds: "truemeds",
  MedPlus: "medplus",
  "Amazon Pharmacy": "amazon",
};

export default function DrugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [drug, setDrug] = useState<Drug | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [scores, setScores] = useState<Record<string, ScoreInfo>>({});
  const [bestOption, setBestOption] = useState<{ source: string; total: number; badge: string | null; explanation: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [expandedBrand, setExpandedBrand] = useState<string | null>(null);

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

  // Build unified brand list: current drug + alternatives, sorted by lowest price
  const allBrands = useMemo(() => {
    if (!drug) return [];
    const currentBrand = {
      id: drug.id,
      name: drug.name,
      slug: drug.slug,
      manufacturer: drug.manufacturer,
      packSize: drug.packSize,
      isGeneric: drug.isGeneric,
      whoCertified: drug.whoCertified,
      lowestPrice: cheapest,
      highestMrp: highestMrp,
      pharmacyCount: sortedPrices.length,
      isCurrent: true,
      manufacturerTier: drug.manufacturerRef?.tier || "standard",
      manufacturerScore: drug.manufacturerRef?.overallScore || 0,
    };

    const altBrands = alternatives.map((alt) => ({
      id: alt.id,
      name: alt.name,
      slug: alt.slug,
      manufacturer: alt.manufacturer,
      packSize: alt.packSize,
      isGeneric: alt.isGeneric,
      whoCertified: alt.whoCertified,
      lowestPrice: alt.lowestPrice,
      highestMrp: 0,
      pharmacyCount: alt.prices?.length || 0,
      isCurrent: false,
      manufacturerTier: alt.manufacturerRef?.tier || "standard",
      manufacturerScore: alt.manufacturerRef?.overallScore || 0,
    }));

    return [currentBrand, ...altBrands].sort((a, b) => {
      if (a.lowestPrice === 0) return 1;
      if (b.lowestPrice === 0) return -1;
      return a.lowestPrice - b.lowestPrice;
    });
  }, [drug, alternatives, cheapest, highestMrp, sortedPrices.length]);

  const overallCheapest = allBrands.length > 0 && allBrands[0].lowestPrice > 0
    ? allBrands[0].lowestPrice : 0;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Skeleton className="h-5 w-36 mb-6" />
        <Skeleton className="h-6 w-32 mb-1" />
        <Skeleton className="h-9 w-72 mb-2" />
        <Skeleton className="h-4 w-48 mb-8" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-7 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (notFound || !drug) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground text-lg">Medicine not found</p>
        <Button asChild variant="link" className="mt-4">
          <Link href="/medicines">Back to Medicines</Link>
        </Button>
      </div>
    );
  }

  const savings = calcSavings(highestMrp, overallCheapest || cheapest);
  const shareText = whatsappDrugShareText(drug.name, highestMrp, overallCheapest || cheapest, savings);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      {/* Back nav */}
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2 text-muted-foreground hover:text-primary">
        <Link href="/medicines">
          <ArrowLeft size={16} />
          Medicines
        </Link>
      </Button>

      {/* ═══ SALT / COMPOSITION HERO ═══ */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <FlaskConical size={14} className="text-primary" />
          <span>Salt Composition</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
          {drug.composition}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
          <span>{drug.category}</span>
          <span className="text-border">·</span>
          <span>{drug.dosageForm}</span>
          {drug.prescriptionReq && (
            <>
              <span className="text-border">·</span>
              <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-transparent text-xs">
                Rx Required
              </Badge>
            </>
          )}
        </div>

        {/* Price summary for this salt */}
        {overallCheapest > 0 && (
          <div className="mt-4 p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-green-700 font-medium mb-0.5">Lowest price for this salt</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-green-700">{formatPrice(overallCheapest)}</span>
                  {highestMrp > overallCheapest && (
                    <>
                      <span className="text-sm text-green-600/70 line-through">{formatPrice(highestMrp)}</span>
                      <Badge className="bg-green-200 text-green-800 hover:bg-green-200 border-none text-xs font-semibold">
                        Save {calcSavings(highestMrp, overallCheapest)}%
                      </Badge>
                    </>
                  )}
                </div>
              </div>
              <div className="text-right text-xs text-green-700">
                <div className="font-medium">
                  {drug.compositionGroup
                    ? `${drug.compositionGroup.drugCount} brands in India`
                    : `${allBrands.length} brands available`}
                </div>
                <div>{sortedPrices.length} pharmacies compared</div>
                {drug.compositionGroup && drug.compositionGroup.lowestPrice && drug.compositionGroup.highestPrice && (
                  <div className="text-[10px] text-green-600/80 mt-0.5">
                    Market range: {formatPrice(drug.compositionGroup.lowestPrice)} - {formatPrice(drug.compositionGroup.highestPrice)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Stale Price Warning */}
      {!isStreaming && displayPrices.some((p) => getFreshness(p.lastChecked).level === "stale") && (
        <Alert className="mb-4 bg-amber-50 border-amber-200 text-amber-800 rounded-xl">
          <AlertCircle size={16} className="flex-shrink-0 text-amber-600" />
          <AlertDescription className="flex items-center justify-between w-full">
            <span>Some prices may be outdated.</span>
            <Button variant="ghost" size="sm" onClick={refresh} className="text-amber-700 hover:text-amber-900 hover:bg-amber-100">
              <RefreshCw size={14} /> Refresh
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ═══ BRAND COMPARISON — THE MAIN EVENT ═══ */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {drug.compositionGroup
                ? `${drug.compositionGroup.displayName}`
                : "All Brands · Same Salt"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {allBrands.length} brand{allBrands.length !== 1 ? "s" : ""} compared — sorted by lowest price
              {drug.compositionGroup && drug.compositionGroup.drugCount > allBrands.length && (
                <span className="text-primary"> ({drug.compositionGroup.drugCount} total in India)</span>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isStreaming}
            className="text-xs h-8"
          >
            {isStreaming ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                {progress}/{total}
              </>
            ) : (
              <>
                <Zap size={13} />
                Live Prices
              </>
            )}
          </Button>
        </div>

        {/* Streaming Progress */}
        {isStreaming && (
          <div className="mb-3">
            <Progress value={total > 0 ? (progress / total) * 100 : 0} className="h-1" />
            <p className="text-[11px] text-muted-foreground mt-1">{status}</p>
          </div>
        )}

        {/* Brand Cards */}
        <div className="space-y-3">
          {allBrands.map((brand, i) => {
            const isCheapestBrand = i === 0 && brand.lowestPrice > 0;
            const isCurrentDrug = brand.isCurrent;
            const isExpanded = expandedBrand === brand.id;

            return (
              <div key={brand.id}>
                <Card className={cn(
                  "transition-all duration-200",
                  isCheapestBrand ? "border-green-300 bg-green-50/30" : "",
                  isCurrentDrug ? "ring-1 ring-primary/20" : "",
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      {/* Brand Icon */}
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                        brand.isGeneric ? "bg-green-100" : "bg-primary/10"
                      )}>
                        <Pill size={18} className={brand.isGeneric ? "text-green-600" : "text-primary"} />
                      </div>

                      {/* Brand Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {isCurrentDrug ? (
                            <span className="font-semibold text-foreground text-sm">{brand.name}</span>
                          ) : (
                            <Link href={`/medicines/${brand.slug}`} className="font-semibold text-foreground text-sm hover:text-primary transition-colors">
                              {brand.name}
                            </Link>
                          )}
                          {brand.isGeneric && (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] px-1.5 py-0">
                              Generic
                            </Badge>
                          )}
                          {isCheapestBrand && (
                            <Badge className="bg-green-600 text-white hover:bg-green-600 border-none text-[10px] px-1.5 py-0">
                              Cheapest
                            </Badge>
                          )}
                          {isCurrentDrug && !isCheapestBrand && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              Viewing
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Building2 size={10} />
                            {brand.manufacturer}
                          </span>
                          {brand.manufacturerTier && brand.manufacturerTier !== "standard" && (
                            <Badge variant="secondary" className={cn(
                              "text-[9px] px-1 py-0 border-transparent",
                              brand.manufacturerTier === "premium" ? "bg-amber-50 text-amber-700" :
                              brand.manufacturerTier === "trusted" ? "bg-blue-50 text-blue-700" :
                              brand.manufacturerTier === "government" ? "bg-green-50 text-green-700" : ""
                            )}>
                              {brand.manufacturerTier === "premium" ? "Premium" : brand.manufacturerTier === "trusted" ? "Trusted" : "Govt."}
                            </Badge>
                          )}
                          <span className="text-border">·</span>
                          <span>{brand.packSize}</span>
                          {brand.whoCertified && (
                            <>
                              <span className="text-border">·</span>
                              <span className="flex items-center gap-0.5 text-green-600">
                                <Shield size={9} /> WHO
                              </span>
                            </>
                          )}
                        </div>

                        {/* Pharmacy count + expand toggle for current drug */}
                        {isCurrentDrug && brand.pharmacyCount > 0 && (
                          <button
                            onClick={() => setExpandedBrand(isExpanded ? null : brand.id)}
                            className="flex items-center gap-1 mt-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
                          >
                            <Tag size={10} />
                            {brand.pharmacyCount} pharmacy prices
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                        )}
                        {!isCurrentDrug && brand.pharmacyCount > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Available at {brand.pharmacyCount} {brand.pharmacyCount === 1 ? "pharmacy" : "pharmacies"}
                          </p>
                        )}
                      </div>

                      {/* Price */}
                      <div className="shrink-0 text-right">
                        {brand.lowestPrice > 0 ? (
                          <>
                            <div className={cn(
                              "text-lg font-bold",
                              isCheapestBrand ? "text-green-700" : "text-foreground"
                            )}>
                              {formatPrice(brand.lowestPrice)}
                            </div>
                            {brand.highestMrp > brand.lowestPrice && (
                              <div className="flex items-center gap-1 justify-end">
                                <span className="text-[11px] text-muted-foreground line-through">
                                  {formatPrice(brand.highestMrp)}
                                </span>
                                <span className="text-[11px] font-medium text-green-600">
                                  {calcSavings(brand.highestMrp, brand.lowestPrice)}% off
                                </span>
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Expanded Pharmacy Prices for current drug */}
                {isCurrentDrug && isExpanded && (
                  <div className="mt-1 ml-4 sm:ml-6 space-y-2 border-l-2 border-primary/20 pl-4 py-2">
                    {sortedPrices.map((price) => {
                      const pSavings = calcSavings(price.mrp, price.sellingPrice);
                      const isCheapestPharmacy = price.sellingPrice === cheapest && cheapest > 0;
                      const freshness = getFreshness(price.lastChecked);
                      const pharma = getPharmacyProfile(price.source);

                      return (
                        <div
                          key={price.source}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-lg bg-card border",
                            isCheapestPharmacy ? "border-primary/30 bg-primary/[0.02]" : "border-border"
                          )}
                        >
                          {/* Pharmacy logo */}
                          {pharma ? (
                            <Image
                              src={`/pharmacies/${logoSlug[price.source] || "1mg"}.svg`}
                              alt={pharma.name}
                              width={32}
                              height={32}
                              className="rounded-md shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-accent flex items-center justify-center shrink-0">
                              <Pill size={14} className="text-muted-foreground" />
                            </div>
                          )}

                          {/* Pharmacy info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground text-sm">{pharma?.name || price.source}</span>
                              {isCheapestPharmacy && (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] px-1.5 py-0">
                                  Lowest
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                              {pharma && (
                                <>
                                  <span className="flex items-center gap-0.5">
                                    <Star size={9} className="text-amber-400 fill-amber-400" />
                                    {pharma.rating}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <Truck size={9} />
                                    {pharma.shippingInfo.replace("Free delivery on orders above ", "Free >")}
                                  </span>
                                </>
                              )}
                              <span className={cn("flex items-center gap-0.5", freshness.color)}>
                                <Clock size={9} />
                                {freshness.label}
                              </span>
                              <span className={price.inStock ? "text-green-600" : "text-destructive"}>
                                {price.inStock ? <span className="flex items-center gap-0.5"><Check size={9} /> In Stock</span> : "Out of Stock"}
                              </span>
                            </div>
                          </div>

                          {/* Price + Buy */}
                          <div className="shrink-0 flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-sm font-bold text-foreground">{formatPrice(price.sellingPrice)}</div>
                              {pSavings > 0 && (
                                <span className="text-[10px] text-green-600">{pSavings}% off</span>
                              )}
                            </div>
                            {price.sourceUrl ? (
                              <Button
                                asChild
                                size="sm"
                                className="rounded-lg text-xs h-7 px-2.5"
                                style={{
                                  backgroundColor: pharma?.color || undefined,
                                  color: pharma?.textColor || "#fff",
                                }}
                              >
                                <a href={price.sourceUrl} target="_blank" rel="noopener noreferrer">
                                  Buy <ExternalLink size={10} className="ml-0.5" />
                                </a>
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {allBrands.length === 0 && !isStreaming && (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground mb-2">No prices available yet.</p>
                <Button variant="outline" onClick={refresh} className="text-primary">
                  <Zap size={14} /> Check Live Prices
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ═══ DRUG INFO ═══ */}
      {(drug.uses || drug.sideEffects) && (
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          {drug.uses && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1.5">Uses</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{drug.uses}</p>
              </CardContent>
            </Card>
          )}
          {drug.sideEffects && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-1.5">Side Effects</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{drug.sideEffects}</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══ WHATSAPP SHARE ═══ */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-5 text-center">
          <p className="text-foreground font-medium text-sm mb-3">Know someone who takes {drug.composition}?</p>
          <Button asChild className="bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold">
            <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer">
              <Share2 size={16} />
              Share Savings on WhatsApp
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
