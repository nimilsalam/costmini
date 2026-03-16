"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Search, Pill, ArrowDownUp, Shield, Share2, Loader2, SlidersHorizontal, CheckCircle, X, Star, Building2, Store, Percent, Sparkles, AlertCircle, ChevronDown, Package } from "lucide-react";
import { drugCategories, dosageForms, pharmacyNames, manufacturerTiers, discountRanges } from "@/lib/constants";
import { formatPrice, calcSavings, whatsappShareUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import SearchAutocomplete from "@/components/SearchAutocomplete";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetHeader } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Separator } from "@/components/ui/separator";

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
  manufacturerRef?: {
    id: string;
    name: string;
    slug: string;
    overallScore: number;
    tier: string;
  } | null;
  compositionGroup?: {
    id: string;
    displayName: string;
    drugCount: number;
    lowestPrice: number | null;
    highestPrice: number | null;
  } | null;
}

type SortOption = "name" | "price-low" | "price-high" | "savings" | "sources" | "best-value" | "discount";

function getTierColor(tier: string): string {
  switch (tier) {
    case "premium": return "#D97706";
    case "trusted": return "#2563EB";
    case "government": return "#059669";
    default: return "#6B7280";
  }
}

function FilterPanel({
  category, setCategory,
  priceRange, setPriceRange,
  dosageForm, setDosageForm,
  mfrTier, setMfrTier,
  selectedPharmacy, setSelectedPharmacy,
  minDiscount, setMinDiscount,
  showGenericOnly, setShowGenericOnly,
  showInStockOnly, setShowInStockOnly,
  showWhoCertified, setShowWhoCertified,
  showRxOnly, setShowRxOnly,
  activeFilterCount, clearFilters, setPage,
}: {
  category: string; setCategory: (v: string) => void;
  priceRange: [number, number]; setPriceRange: (v: [number, number]) => void;
  dosageForm: string; setDosageForm: (v: string) => void;
  mfrTier: string; setMfrTier: (v: string) => void;
  selectedPharmacy: string; setSelectedPharmacy: (v: string) => void;
  minDiscount: string; setMinDiscount: (v: string) => void;
  showGenericOnly: boolean; setShowGenericOnly: (v: boolean) => void;
  showInStockOnly: boolean; setShowInStockOnly: (v: boolean) => void;
  showWhoCertified: boolean; setShowWhoCertified: (v: boolean) => void;
  showRxOnly: "all" | "otc" | "rx"; setShowRxOnly: (v: "all" | "otc" | "rx") => void;
  activeFilterCount: number; clearFilters: () => void; setPage: (v: number) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-primary hover:text-primary">
            <X size={12} /> Clear all ({activeFilterCount})
          </Button>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Category</label>
        <div className="flex flex-wrap gap-1.5">
          <Button
            variant={category === "All" ? "default" : "secondary"}
            size="sm"
            onClick={() => { setCategory("All"); setPage(1); }}
            className="rounded-full text-xs h-7"
          >
            All
          </Button>
          {drugCategories.map((c) => (
            <Button
              key={c}
              variant={category === c ? "default" : "secondary"}
              size="sm"
              onClick={() => { setCategory(c); setPage(1); }}
              className="rounded-full text-xs h-7"
            >
              {c}
            </Button>
          ))}
        </div>
      </div>

      {/* Generic Only Toggle */}
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setShowGenericOnly(!showGenericOnly); setPage(1); }}
          className={cn(
            "flex items-center gap-1.5 text-xs rounded-full",
            showGenericOnly && "bg-green-50 text-green-700 border-green-300 hover:bg-green-100 hover:text-green-700"
          )}
        >
          <Shield size={14} />
          Generic Only
          {showGenericOnly && <CheckCircle size={12} />}
        </Button>
      </div>

      {/* Price Range */}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-2 block">Price Range</label>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Rs.</span>
            <Input
              type="number"
              min={0}
              max={priceRange[1]}
              value={priceRange[0]}
              onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
              className="w-20 h-8 text-xs"
            />
          </div>
          <span className="text-xs text-muted-foreground">to</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Rs.</span>
            <Input
              type="number"
              min={priceRange[0]}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
              className="w-20 h-8 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Advanced Filters - collapsed by default */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-muted-foreground hover:text-foreground p-0 h-auto"
        >
          <ChevronDown size={14} className={cn("transition-transform mr-1", showAdvanced && "rotate-180")} />
          {showAdvanced ? "Hide" : "Show"} Advanced Filters
        </Button>
      </div>

      {showAdvanced && (
        <div className="space-y-5 pt-1 border-t border-border">
          {/* Dosage Form */}
          <div className="pt-4">
            <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1"><Sparkles size={12} /> Dosage Form</label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={dosageForm === "All" ? "default" : "secondary"}
                size="sm"
                onClick={() => { setDosageForm("All"); setPage(1); }}
                className="rounded-full text-xs h-7"
              >All</Button>
              {dosageForms.map((d) => (
                <Button
                  key={d}
                  variant={dosageForm === d ? "default" : "secondary"}
                  size="sm"
                  onClick={() => { setDosageForm(d); setPage(1); }}
                  className="rounded-full text-xs h-7"
                >{d}</Button>
              ))}
            </div>
          </div>

          {/* Manufacturer Tier */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1"><Building2 size={12} /> Manufacturer Quality</label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={mfrTier === "All" ? "default" : "secondary"}
                size="sm"
                onClick={() => { setMfrTier("All"); setPage(1); }}
                className="rounded-full text-xs h-7"
              >All Tiers</Button>
              {manufacturerTiers.map((t) => (
                <Button
                  key={t.key}
                  variant={mfrTier === t.key ? "default" : "secondary"}
                  size="sm"
                  onClick={() => { setMfrTier(t.key); setPage(1); }}
                  className="rounded-full text-xs h-7 flex items-center gap-1.5"
                  style={mfrTier === t.key ? { backgroundColor: t.color, borderColor: t.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Pharmacy Filter */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1"><Store size={12} /> Available On</label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={selectedPharmacy === "All" ? "default" : "secondary"}
                size="sm"
                onClick={() => { setSelectedPharmacy("All"); setPage(1); }}
                className="rounded-full text-xs h-7"
              >All Pharmacies</Button>
              {pharmacyNames.map((p) => (
                <Button
                  key={p}
                  variant={selectedPharmacy === p ? "default" : "secondary"}
                  size="sm"
                  onClick={() => { setSelectedPharmacy(p); setPage(1); }}
                  className="rounded-full text-xs h-7"
                >{p}</Button>
              ))}
            </div>
          </div>

          {/* Min Discount */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block flex items-center gap-1"><Percent size={12} /> Minimum Discount</label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant={minDiscount === "0" ? "default" : "secondary"}
                size="sm"
                onClick={() => { setMinDiscount("0"); setPage(1); }}
                className="rounded-full text-xs h-7"
              >Any</Button>
              {discountRanges.map((d) => (
                <Button
                  key={d.key}
                  variant={minDiscount === d.key ? "default" : "secondary"}
                  size="sm"
                  onClick={() => { setMinDiscount(d.key); setPage(1); }}
                  className={cn("rounded-full text-xs h-7", minDiscount === d.key && "bg-green-600 hover:bg-green-700 border-green-600")}
                >{d.label}</Button>
              ))}
            </div>
          </div>

          {/* More Toggle Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInStockOnly(!showInStockOnly)}
              className={cn(
                "flex items-center gap-1.5 text-xs rounded-full",
                showInStockOnly && "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-700"
              )}
            >
              <CheckCircle size={14} />
              In Stock Only
              {showInStockOnly && <CheckCircle size={12} />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWhoCertified(!showWhoCertified)}
              className={cn(
                "flex items-center gap-1.5 text-xs rounded-full",
                showWhoCertified && "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 hover:text-amber-700"
              )}
            >
              <Star size={14} />
              WHO-GMP Certified
              {showWhoCertified && <CheckCircle size={12} />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowRxOnly(showRxOnly === "otc" ? "all" : "otc"); setPage(1); }}
              className={cn(
                "flex items-center gap-1.5 text-xs rounded-full",
                showRxOnly === "otc" && "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 hover:text-purple-700"
              )}
            >
              <Pill size={14} />
              OTC Only (No Rx)
              {showRxOnly === "otc" && <CheckCircle size={12} />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MedicinesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [showGenericOnly, setShowGenericOnly] = useState(false);
  const [showInStockOnly, setShowInStockOnly] = useState(false);
  const [showWhoCertified, setShowWhoCertified] = useState(false);
  const [dosageForm, setDosageForm] = useState("All");
  const [mfrTier, setMfrTier] = useState("All");
  const [selectedPharmacy, setSelectedPharmacy] = useState("All");
  const [minDiscount, setMinDiscount] = useState("0");
  const [showRxOnly, setShowRxOnly] = useState<"all" | "otc" | "rx">("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [sortBy, setSortBy] = useState<SortOption>("best-value");
  const [showFilters, setShowFilters] = useState(false);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = [
    showGenericOnly,
    showInStockOnly,
    showWhoCertified,
    priceRange[0] > 0 || priceRange[1] < 10000,
    category !== "All",
    dosageForm !== "All",
    mfrTier !== "All",
    selectedPharmacy !== "All",
    minDiscount !== "0",
    showRxOnly !== "all",
  ].filter(Boolean).length;

  const fetchDrugs = useCallback(async (pageNum: number, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category !== "All") params.set("category", category);
    if (showGenericOnly) params.set("generic", "true");
    if (dosageForm !== "All") params.set("dosageForm", dosageForm);
    if (mfrTier !== "All") params.set("mfrTier", mfrTier);
    if (selectedPharmacy !== "All") params.set("pharmacy", selectedPharmacy);
    if (minDiscount !== "0") params.set("minDiscount", minDiscount);
    if (showRxOnly === "rx") params.set("rx", "true");
    if (showRxOnly === "otc") params.set("rx", "false");
    params.set("sortBy", sortBy);
    params.set("page", String(pageNum));
    params.set("limit", "20");

    try {
      const res = await fetch(`/api/drugs/search?${params}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      const results = data.results || [];
      if (append) {
        setDrugs((prev) => [...prev, ...results]);
      } else {
        setDrugs(results);
      }
      setTotal(data.count || 0);
      setHasMore(results.length >= 20);
      setError(false);
    } catch {
      if (!append) { setDrugs([]); setError(true); }
    }
    if (append) setLoadingMore(false);
    else setLoading(false);
  }, [query, category, showGenericOnly, dosageForm, mfrTier, selectedPharmacy, minDiscount, showRxOnly, sortBy]);

  // Reset and fetch on filter/search change
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    const timeout = setTimeout(() => fetchDrugs(1, false), 300);
    return () => clearTimeout(timeout);
  }, [fetchDrugs]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchDrugs(nextPage, true);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchDrugs]);

  // Client-side filtering & sorting (Agoda-style)
  const filtered = drugs.filter((d) => {
    if (showInStockOnly && d.prices.every((p) => !p.inStock)) return false;
    if (showWhoCertified && !d.whoCertified) return false;
    if (d.lowestPrice < priceRange[0] || d.lowestPrice > priceRange[1]) return false;
    return true;
  });

  // Compute a simple "best value" score for sorting
  const computeQuickScore = (d: Drug) => {
    let score = 0;
    // Price savings (0-40)
    const discount = d.highestMrp > 0 ? ((d.highestMrp - d.lowestPrice) / d.highestMrp) : 0;
    score += discount * 40;
    // Manufacturer quality (0-25)
    score += (d.manufacturerRef?.overallScore ?? 50) / 4;
    // Availability across pharmacies (0-15)
    score += Math.min(d.pharmacyCount, 8) * 1.875;
    // Generic bonus (0-10)
    if (d.isGeneric) score += 10;
    // WHO certified bonus (0-10)
    if (d.whoCertified) score += 10;
    return score;
  };

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "price-low": return a.lowestPrice - b.lowestPrice;
      case "price-high": return b.lowestPrice - a.lowestPrice;
      case "savings": {
        const savA = a.highestMrp > 0 ? ((a.highestMrp - a.lowestPrice) / a.highestMrp) : 0;
        const savB = b.highestMrp > 0 ? ((b.highestMrp - b.lowestPrice) / b.highestMrp) : 0;
        return savB - savA;
      }
      case "discount": {
        const dA = a.highestMrp > 0 ? ((a.highestMrp - a.lowestPrice) / a.highestMrp) * 100 : 0;
        const dB = b.highestMrp > 0 ? ((b.highestMrp - b.lowestPrice) / b.highestMrp) * 100 : 0;
        return dB - dA;
      }
      case "best-value": return computeQuickScore(b) - computeQuickScore(a);
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
    setDosageForm("All");
    setMfrTier("All");
    setSelectedPharmacy("All");
    setMinDiscount("0");
    setShowRxOnly("all");
  };

  const filterPanelProps = {
    category, setCategory,
    priceRange, setPriceRange,
    dosageForm, setDosageForm,
    mfrTier, setMfrTier,
    selectedPharmacy, setSelectedPharmacy,
    minDiscount, setMinDiscount,
    showGenericOnly, setShowGenericOnly,
    showInStockOnly, setShowInStockOnly,
    showWhoCertified, setShowWhoCertified,
    showRxOnly, setShowRxOnly,
    activeFilterCount, clearFilters, setPage,
  };

  const sortOptions: { key: SortOption; label: string }[] = [
    { key: "best-value", label: "Best Value" },
    { key: "price-low", label: "Price: Low-High" },
    { key: "price-high", label: "Price: High-Low" },
    { key: "name", label: "A-Z" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
          Compare by Salt Composition
        </h1>
        <p className="text-sm text-muted-foreground">
          {total > 0 ? `${total} medicines` : "Medicines"} compared by salt. Find cheaper brands with the same composition.
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <SearchAutocomplete placeholder="Search medicines by name, generic, or composition..." />
      </div>

      {/* Sort + Filter Bar */}
      <div className="flex items-center justify-between gap-3 mb-4">
        {/* Sort pills */}
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1 flex-shrink-0">
            <ArrowDownUp size={12} /> Sort:
          </span>
          <div className="flex gap-1">
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSortBy(opt.key)}
                className={cn(
                  "rounded-full text-xs px-3 py-1.5 whitespace-nowrap transition-colors border",
                  sortBy === opt.key
                    ? "bg-primary text-primary-foreground border-primary font-medium"
                    : "bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop filter toggle */}
        <div className="hidden md:block flex-shrink-0">
          <Button
            variant={showFilters || activeFilterCount > 0 ? "default" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="rounded-full text-xs h-8"
          >
            <SlidersHorizontal size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ml-1">
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>

        {/* Mobile filter sheet trigger */}
        <div className="md:hidden flex-shrink-0">
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button
                variant={activeFilterCount > 0 ? "default" : "outline"}
                size="sm"
                className="rounded-full text-xs h-8"
              >
                <SlidersHorizontal size={12} />
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-primary-foreground text-primary rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ml-1">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter Results</SheetTitle>
              </SheetHeader>
              <Separator className="my-3" />
              <FilterPanel {...filterPanelProps} />
              <div className="pt-4">
                <Button className="w-full" onClick={() => setMobileFiltersOpen(false)}>
                  Show Results
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Desktop Expandable Filter Panel */}
      {showFilters && (
        <Card className="mb-4 hidden md:block">
          <CardContent className="p-5">
            <FilterPanel {...filterPanelProps} />
          </CardContent>
        </Card>
      )}

      {/* Results count */}
      {!error && (
        <div className="text-sm text-muted-foreground mb-4 flex items-center justify-between">
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
            <Button variant="link" size="sm" onClick={clearFilters} className="text-xs text-primary p-0 h-auto">
              Clear filters to see all
            </Button>
          )}
        </div>
      )}

      {/* Loading Skeletons - 2 column grid */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-5 w-40" />
                      <Skeleton className="h-3 w-56" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </div>
                  <Separator />
                  <div className="flex items-end justify-between">
                    <div className="space-y-1">
                      <Skeleton className="h-8 w-24" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                    <Skeleton className="h-9 w-32 rounded-lg" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Results - 2 column grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((drug) => {
            const cheapest = drug.lowestPrice;
            const mrp = drug.highestMrp;
            const savings = calcSavings(mrp, cheapest);
            const tierColor = drug.manufacturerRef ? getTierColor(drug.manufacturerRef.tier) : null;
            const shareText = `${drug.name} (${drug.composition}) -- From ${formatPrice(cheapest)} on CostMini!\nCompare prices & find generics: costmini.in/medicines`;

            return (
              <Card
                key={drug.id}
                className="group overflow-hidden hover:shadow-lg hover:border-primary/40 transition-all duration-200"
              >
                <CardContent className="p-0">
                  {/* Top section: Drug info — Composition first */}
                  <div className="p-4 pb-3">
                    {/* Salt composition — THE HERO */}
                    <Link
                      href={`/medicines/${drug.slug}`}
                      className="block group-hover:text-primary transition-colors"
                    >
                      <h3 className="text-base font-bold text-foreground leading-tight mb-0.5">
                        {drug.composition}
                      </h3>
                    </Link>

                    {/* Brand name + badges */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {drug.name}
                      </span>
                      {drug.isGeneric && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-[10px] px-1.5 py-0 font-semibold">
                          Generic
                        </Badge>
                      )}
                      {drug.whoCertified && (
                        <Badge className="bg-blue-50 text-blue-600 hover:bg-blue-50 border-0 text-[10px] px-1.5 py-0">
                          WHO
                        </Badge>
                      )}
                      {drug.prescriptionReq && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 text-orange-600 border-orange-200">
                          Rx
                        </Badge>
                      )}
                    </div>

                    {/* Manufacturer + Pack size + Category */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {drug.manufacturerRef ? (
                        <span className="flex items-center gap-1">
                          <span
                            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: tierColor || "#6B7280" }}
                          />
                          <span className="font-medium text-foreground/80">{drug.manufacturer}</span>
                        </span>
                      ) : (
                        <span className="font-medium text-foreground/80">{drug.manufacturer}</span>
                      )}
                      <span className="text-muted-foreground/40">|</span>
                      <span className="flex items-center gap-1">
                        <Package size={11} className="text-muted-foreground/60" />
                        {drug.packSize}
                      </span>
                      <span className="text-muted-foreground/40">|</span>
                      <span>{drug.category}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-border" />

                  {/* Bottom section: Price + CTA */}
                  <div className="p-4 pt-3 flex items-end justify-between gap-3 bg-muted/30">
                    {/* Price block */}
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary tracking-tight">
                          {formatPrice(cheapest)}
                        </span>
                        {savings > 0 && mrp > 0 && (
                          <span className="text-sm text-muted-foreground line-through">
                            {formatPrice(mrp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {savings > 0 && (
                          <span className="inline-flex items-center text-xs font-semibold text-green-700 bg-green-100 rounded px-1.5 py-0.5">
                            Save {savings}%
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {drug.compositionGroup && drug.compositionGroup.drugCount > 1
                            ? `${drug.compositionGroup.drugCount} brands`
                            : drug.pharmacyCount > 0
                              ? `${drug.pharmacyCount} ${drug.pharmacyCount === 1 ? "pharmacy" : "pharmacies"}`
                              : "Checking availability"}
                        </span>
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button
                        asChild
                        size="sm"
                        className="rounded-lg text-xs font-semibold px-4 h-9 shadow-sm"
                      >
                        <Link href={`/medicines/${drug.slug}`}>
                          Compare Brands
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg text-[11px] h-7 px-2"
                      >
                        <a
                          href={whatsappShareUrl(shareText)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Share2 size={12} />
                          Share
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Infinite scroll trigger */}
      {hasMore && !loading && !error && (
        <div ref={loadMoreRef} className="flex justify-center py-8">
          {loadingMore && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              Loading more medicines...
            </div>
          )}
        </div>
      )}
      {!hasMore && drugs.length > 0 && (
        <p className="text-center text-sm text-muted-foreground py-6">
          Showing all {total} medicines
        </p>
      )}

      {!loading && error && (
        <div className="text-center py-16">
          <AlertCircle size={48} className="mx-auto text-destructive/40 mb-4" />
          <p className="text-foreground text-lg">Something went wrong</p>
          <p className="text-muted-foreground text-sm mt-1 mb-4">
            Could not load medicines. Please try again.
          </p>
          <Button onClick={() => fetchDrugs(1, false)}>
            Retry
          </Button>
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="text-center py-16">
          <Pill size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-foreground text-lg">No medicines found</p>
          <p className="text-muted-foreground text-sm mt-1">
            Try a different search term or category
          </p>
        </div>
      )}
    </div>
  );
}
