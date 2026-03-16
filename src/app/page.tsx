import Link from "next/link";
import { Pill, ScanLine, Sparkles, Search, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import SearchAutocomplete from "@/components/SearchAutocomplete";
import { formatPrice } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const revalidate = 300; // ISR: revalidate every 5 minutes

async function getHomeData() {
  try {
    const [drugCount, pharmacyCount, popularDrugs] = await Promise.all([
      prisma.drug.count(),
      prisma.drugPrice.groupBy({ by: ["source"] }).then((r: { source: string }[]) => r.length),
      prisma.drug.findMany({
        where: {
          prices: { some: { sellingPrice: { gt: 0 } } },
          slug: {
            in: [
              "combiflam-strip-of-20-tablets", "crocin-advance-500mg-strip-of-20-tablets",
              "cetzine-tablet", "shelcal-hd-strip-of-15-tablets",
              "ecosprin-av-75-20mg-strip-of-15-capsules", "montair-lc-kid-strawberry-flavour-strip-of-10-tablets",
              "glycomet-250mg-strip-of-10-tablets", "azithral-5d-tablet",
            ],
          },
        },
        take: 8,
        select: {
          name: true,
          slug: true,
          genericName: true,
          composition: true,
          isGeneric: true,
          category: true,
          manufacturer: true,
          prices: {
            orderBy: { sellingPrice: "asc" },
            take: 1,
            select: { sellingPrice: true, mrp: true },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    return { drugCount, pharmacyCount, popularDrugs };
  } catch {
    return { drugCount: 200, pharmacyCount: 8, popularDrugs: [] };
  }
}

function calcSavingsPercent(mrp: number, lowest: number): number {
  if (!mrp || mrp <= lowest) return 0;
  return Math.round(((mrp - lowest) / mrp) * 100);
}

const popularSearches = [
  { label: "Paracetamol", query: "paracetamol" },
  { label: "Azithromycin", query: "azithromycin" },
  { label: "Metformin", query: "metformin" },
  { label: "Pantoprazole", query: "pan-40" },
  { label: "Cetirizine", query: "cetzine" },
];

export default async function Home() {
  const { drugCount, pharmacyCount, popularDrugs } = await getHomeData();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6">
      {/* Hero */}
      <section className="pt-16 pb-10 sm:pt-24 sm:pb-14">
        <h1 className="text-3xl sm:text-[40px] font-semibold text-foreground leading-tight tracking-tight mb-3">
          Compare medicine prices<br className="hidden sm:block" /> by salt composition
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-lg">
          Search any salt, find every brand, compare across {pharmacyCount} pharmacies. Generics save up to 80%.
        </p>

        {/* Search */}
        <div className="max-w-xl mb-4">
          <SearchAutocomplete
            placeholder="Search by salt, medicine name, or composition..."
            size="large"
          />
        </div>

        {/* Popular pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Try:</span>
          {popularSearches.map((s) => (
            <Badge key={s.query} variant="secondary" asChild className="cursor-pointer hover:bg-accent/80 transition-colors">
              <Link href={`/medicines/${s.query}`}>
                {s.label}
              </Link>
            </Badge>
          ))}
        </div>
      </section>

      {/* Stats line */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pb-10 border-b border-border/60">
        <span>{drugCount.toLocaleString()}+ medicines</span>
        <span className="text-border">·</span>
        <span>{pharmacyCount} pharmacies</span>
        <span className="text-border">·</span>
        <span>AI-powered</span>
        <span className="text-border">·</span>
        <span>100% free</span>
      </div>

      {/* Popular compositions */}
      {popularDrugs.length > 0 && (
        <section className="py-10 sm:py-14">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Popular compositions
            </h2>
            <Link href="/medicines" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              View all <ArrowRight size={14} />
            </Link>
          </div>

          <div className="space-y-1">
            {popularDrugs.map((drug: {
              name: string;
              slug: string;
              genericName: string | null;
              composition: string;
              isGeneric: boolean;
              category: string;
              manufacturer: string | null;
              prices: { sellingPrice: number; mrp: number }[];
            }) => {
              const lowestPrice = drug.prices[0]?.sellingPrice ?? 0;
              const highestMrp = drug.prices[0]?.mrp ?? 0;
              const savings = calcSavingsPercent(highestMrp, lowestPrice);
              return (
                <Link
                  key={drug.slug}
                  href={`/medicines/${drug.slug}`}
                  className="flex items-center justify-between py-3 px-3 -mx-3 rounded-lg hover:bg-accent transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                        {drug.composition}
                      </span>
                      {drug.isGeneric && (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] px-1.5 py-0">
                          Generic
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {drug.name} · {drug.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {savings > 0 && (
                      <span className="text-xs text-green-700 font-medium hidden sm:block">
                        {savings}% off
                      </span>
                    )}
                    <div className="text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(lowestPrice)}
                      </span>
                      {savings > 0 && (
                        <span className="text-xs text-muted-foreground line-through ml-1.5">
                          {formatPrice(highestMrp)}
                        </span>
                      )}
                    </div>
                    <ArrowRight size={14} className="text-muted-foreground/40 group-hover:text-foreground transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Quick links */}
      <section className="py-10 sm:py-14 border-t border-border/60">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            {
              href: "/medicines",
              icon: Pill,
              title: "Compare Medicines",
              desc: "Search by salt composition. Find every brand and generic, sorted by price.",
            },
            {
              href: "/scan",
              icon: ScanLine,
              title: "Scan Prescription",
              desc: "Upload a photo. AI reads it and finds cheaper alternatives instantly.",
            },
            {
              href: "/search",
              icon: Sparkles,
              title: "Ask AI",
              desc: "Ask anything about medicine prices, surgery costs, or generic alternatives.",
            },
          ].map((action) => (
            <Link key={action.href} href={action.href} className="group">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-primary/10 transition-colors">
                  <action.icon size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-0.5 group-hover:text-primary transition-colors">
                    {action.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {action.desc}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* AI prompt */}
      <section className="py-10 sm:py-14 border-t border-border/60">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Search size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-foreground mb-1">Ask CostMini AI</h2>
            <p className="text-xs text-muted-foreground">
              Like having a pharmacist friend who knows every price in India.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            "Cheapest paracetamol available?",
            "Dolo 650 vs generic alternatives",
            "Knee replacement cost in Delhi",
          ].map((q) => (
            <Button key={q} variant="outline" size="sm" asChild className="text-xs text-muted-foreground hover:text-foreground">
              <Link href={`/search?q=${encodeURIComponent(q)}`}>
                {q}
              </Link>
            </Button>
          ))}
        </div>
        <Button variant="link" asChild className="text-primary px-0 font-medium">
          <Link href="/search">
            Try AI Search <ArrowRight size={14} />
          </Link>
        </Button>
      </section>
    </div>
  );
}
