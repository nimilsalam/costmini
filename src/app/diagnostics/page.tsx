"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, TestTube, MapPin, Home, Share2, Loader2 } from "lucide-react";
import { diagnosticCategories } from "@/lib/constants";
import { formatPrice, calcSavings, whatsappShareUrl, cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        <h1 className="text-3xl font-bold text-foreground mb-2">Lab Tests & Diagnostic Prices</h1>
        <p className="text-muted-foreground">Compare blood tests, MRI, CT scans and more across labs. Book at the best price.</p>
      </div>

      <Card className="mb-6 rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search lab tests, scans, or health checkups..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 pr-4 py-3 h-auto rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {["All", ...diagnosticCategories].map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                onClick={() => setCategory(c)}
                className="rounded-full"
              >
                {c}
              </Button>
            ))}
            <Button
              size="sm"
              variant={homeOnly ? "default" : "outline"}
              onClick={() => setHomeOnly(!homeOnly)}
              className="rounded-full"
            >
              <Home size={14} /> Home Collection
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-8">
          <Loader2 size={24} className="mx-auto text-primary animate-spin" />
        </div>
      )}

      <div className="space-y-6">
        {diagnostics.map((test) => {
          const cheapest = test.prices.length > 0 ? Math.min(...test.prices.map((p) => p.sellingPrice)) : 0;
          const mostExpensive = test.prices.length > 0 ? Math.max(...test.prices.map((p) => p.mrp)) : 0;
          const shareText = `🔬 ${test.name} — From ${formatPrice(cheapest)} on CostMini!\nCompare lab prices: costmini.in/diagnostics`;

          return (
            <Card key={test.id} className="rounded-2xl overflow-hidden gap-0 py-0">
              <CardHeader className="p-6 border-b border-border">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary">{test.type}</Badge>
                      {test.homeCollection && (
                        <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                          <Home size={10} /> Home Collection
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl font-bold text-foreground">{test.name}</CardTitle>
                    {test.description && <p className="text-sm text-muted-foreground mt-1">{test.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                      {test.preparation && <span>Prep: {test.preparation}</span>}
                      {test.reportTime && <span>Report: {test.reportTime}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-muted-foreground">Starting from</div>
                    <div className="text-2xl font-bold text-primary">{formatPrice(cheapest)}</div>
                    {mostExpensive > cheapest && (
                      <div className="text-sm text-muted-foreground line-through">MRP {formatPrice(mostExpensive)}</div>
                    )}
                    <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 text-sm mt-1 hover:underline">
                      <Share2 size={14} /> Share
                    </a>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {test.prices.sort((a, b) => a.sellingPrice - b.sellingPrice).map((lp, i) => {
                    const lpSavings = calcSavings(lp.mrp, lp.sellingPrice);
                    return (
                      <div key={i} className={cn("px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3", i === 0 && "bg-green-50/50")}>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{lp.labName}</span>
                            {lp.accreditation && <Badge variant="secondary">{lp.accreditation}</Badge>}
                            {i === 0 && <Badge variant="secondary" className="bg-green-100 text-green-700">Best Price</Badge>}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                            <span className="flex items-center gap-1"><MapPin size={12} />{lp.city}</span>
                            {lp.homeCollection && (
                              <span className="flex items-center gap-1 text-teal-600"><Home size={12} /> Home Collection</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-foreground">{formatPrice(lp.sellingPrice)}</div>
                          {lpSavings > 0 && <span className="text-sm text-green-600">{lpSavings}% off MRP</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && diagnostics.length === 0 && (
        <div className="text-center py-16">
          <TestTube size={48} className="mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg">No tests found</p>
        </div>
      )}
    </div>
  );
}
