"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Stethoscope, MapPin, Share2, Loader2 } from "lucide-react";
import { procedureCategories } from "@/lib/constants";
import { cn, formatPrice, whatsappShareUrl } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

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
        <h1 className="text-3xl font-bold text-foreground mb-2">Surgery & Procedure Costs</h1>
        <p className="text-muted-foreground">Compare surgery costs across hospitals. Find affordable, accredited options.</p>
      </div>

      <Card className="mb-6 rounded-2xl">
        <CardContent className="p-4 space-y-4">
          <div className="relative">
            <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search surgeries or procedures..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 py-3 rounded-xl"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={category === "All" ? "default" : "outline"}
              onClick={() => setCategory("All")}
              className="rounded-full"
            >
              All
            </Button>
            {procedureCategories.map((c) => (
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
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-8">
          <Loader2 size={24} className="mx-auto text-primary animate-spin" />
        </div>
      )}

      <div className="space-y-6">
        {procedures.map((proc) => {
          const shareText = `🏥 ${proc.name} — From ${formatPrice(proc.minPrice)} on CostMini!\nCompare hospital prices: costmini.in/procedures`;
          return (
            <Card key={proc.id} className="rounded-2xl overflow-hidden">
              <CardHeader className="p-6 pb-0">
                <div className="flex flex-col sm:flex-row justify-between gap-3">
                  <div>
                    <Badge variant="secondary" className="text-xs uppercase tracking-wider text-primary">
                      {proc.category}
                    </Badge>
                    <h2 className="text-xl font-bold text-foreground mt-1">{proc.name}</h2>
                    {proc.description && <p className="text-sm text-muted-foreground mt-1">{proc.description}</p>}
                    <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                      {proc.duration && <span>Duration: {proc.duration}</span>}
                      {proc.recoveryTime && <span>Recovery: {proc.recoveryTime}</span>}
                      {proc.anesthesia && <span>Anesthesia: {proc.anesthesia}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-muted-foreground">Price Range</div>
                    <div className="text-2xl font-bold text-primary">
                      {formatPrice(proc.minPrice)} – {formatPrice(proc.maxPrice)}
                    </div>
                    <a href={whatsappShareUrl(shareText)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-green-600 text-sm mt-2 hover:underline">
                      <Share2 size={14} /> Share
                    </a>
                  </div>
                </div>
              </CardHeader>
              <Separator className="mt-4" />
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {proc.prices.sort((a, b) => a.avgPrice - b.avgPrice).map((hp, i) => (
                    <div key={i} className={cn(
                      "px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                      i === 0 && "bg-green-50/50"
                    )}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{hp.hospitalName}</span>
                          {hp.accreditation && (
                            <Badge variant="secondary" className="text-xs">
                              {hp.accreditation}
                            </Badge>
                          )}
                          {i === 0 && (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                              Most Affordable
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                          <span className="flex items-center gap-1"><MapPin size={12} />{hp.city}</span>
                          {hp.includesStay && <span>Includes hospital stay</span>}
                          {hp.rating && <span>Rating: {hp.rating}/5</span>}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-foreground">{formatPrice(hp.avgPrice)}</div>
                        <div className="text-xs text-muted-foreground">{formatPrice(hp.minPrice)} – {formatPrice(hp.maxPrice)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!loading && procedures.length === 0 && (
        <div className="text-center py-16">
          <Stethoscope size={48} className="mx-auto text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg">No procedures found</p>
        </div>
      )}
    </div>
  );
}
