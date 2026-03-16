import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Star,
  Truck,
  RotateCcw,
  Banknote,
  Globe,
  ShieldCheck,
  ExternalLink,
  Pill,
} from "lucide-react";
import { getPharmacyBySlug } from "@/lib/pharmacy-profiles";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const logoMap: Record<string, string> = {
  "1mg": "1mg",
  PharmEasy: "pharmeasy",
  Netmeds: "netmeds",
  Apollo: "apollo",
  "Flipkart Health": "flipkart",
  Truemeds: "truemeds",
  MedPlus: "medplus",
  "Amazon Pharmacy": "amazon",
};

export default async function PharmacyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pharmacy = getPharmacyBySlug(slug);

  if (!pharmacy) {
    notFound();
  }

  // Get all drugs available from this pharmacy
  const prices = await prisma.drugPrice.findMany({
    where: { source: pharmacy.source },
    include: {
      drug: {
        select: {
          name: true,
          slug: true,
          genericName: true,
          manufacturer: true,
          category: true,
          isGeneric: true,
          packSize: true,
        },
      },
    },
    orderBy: { sellingPrice: "asc" },
  });

  // Group by category
  const byCategory: Record<
    string,
    (typeof prices)[number][]
  > = {};
  for (const p of prices) {
    const cat = p.drug.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(p);
  }
  const categories = Object.keys(byCategory).sort();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
        <Link href="/pharmacies">
          <ArrowLeft size={16} />
          All Pharmacies
        </Link>
      </Button>

      {/* Pharmacy Header */}
      <Card className="mb-6 py-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
              <Image
                src={`/pharmacies/${logoMap[pharmacy.source] || pharmacy.slug}.svg`}
                alt={pharmacy.name}
                width={64}
                height={64}
                className="w-full h-full"
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold text-foreground">
                  {pharmacy.name}
                </h1>
                <span className="text-sm text-muted-foreground">
                  Est. {pharmacy.established}
                </span>
              </div>
              <div className="flex items-center gap-1 mb-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={
                      i < Math.floor(pharmacy.rating)
                        ? "text-amber-400 fill-amber-400"
                        : "text-muted-foreground/30"
                    }
                  />
                ))}
                <span className="text-sm text-muted-foreground ml-1">
                  {pharmacy.rating}/5 CostMini Rating
                </span>
              </div>
              <p className="text-muted-foreground mb-3">{pharmacy.description}</p>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Truck size={14} className="text-muted-foreground/60" />
                  {pharmacy.shippingInfo}
                </span>
                <span className="flex items-center gap-1">
                  <RotateCcw size={14} className="text-muted-foreground/60" />
                  {pharmacy.returnPolicy}
                </span>
                {pharmacy.codAvailable && (
                  <span className="flex items-center gap-1">
                    <Banknote size={14} className="text-muted-foreground/60" />
                    COD
                  </span>
                )}
                {pharmacy.panIndiaDelivery && (
                  <span className="flex items-center gap-1">
                    <Globe size={14} className="text-muted-foreground/60" />
                    Pan-India
                  </span>
                )}
                {pharmacy.authenticMeds && (
                  <span className="flex items-center gap-1 text-green-600">
                    <ShieldCheck size={14} className="text-green-500" />
                    Licensed
                  </span>
                )}
              </div>
            </div>
            <Button asChild>
              <a
                href={pharmacy.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  backgroundColor: pharmacy.color,
                  color: pharmacy.textColor,
                }}
              >
                Visit Website <ExternalLink size={14} />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {prices.length}
            </div>
            <div className="text-sm text-muted-foreground">Medicines</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {categories.length}
            </div>
            <div className="text-sm text-muted-foreground">Categories</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {prices.filter((p) => p.inStock).length}
            </div>
            <div className="text-sm text-muted-foreground">In Stock</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">
              {prices.length > 0
                ? Math.round(
                    prices.reduce(
                      (sum, p) =>
                        sum +
                        (p.mrp > 0
                          ? ((p.mrp - p.sellingPrice) / p.mrp) * 100
                          : 0),
                      0
                    ) / prices.length
                  )
                : 0}
              %
            </div>
            <div className="text-sm text-muted-foreground">Avg. Discount</div>
          </CardContent>
        </Card>
      </div>

      {/* Medicines by Category */}
      {categories.map((cat) => (
        <div key={cat} className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">{cat}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byCategory[cat].slice(0, 12).map((p) => (
              <Link key={p.id} href={`/medicines/${p.drug.slug}`}>
                <Card className="hover:shadow-md transition-all group py-0">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
                        <Pill size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground truncate group-hover:text-primary">
                            {p.drug.name}
                          </span>
                          {p.drug.isGeneric && (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0 shrink-0">
                              Generic
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {p.drug.manufacturer} &middot; {p.drug.packSize}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-primary">
                          {formatPrice(p.sellingPrice)}
                        </div>
                        {p.mrp > p.sellingPrice && (
                          <div className="text-xs text-muted-foreground line-through">
                            {formatPrice(p.mrp)}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          {byCategory[cat].length > 12 && (
            <p className="text-sm text-muted-foreground mt-2">
              + {byCategory[cat].length - 12} more medicines
            </p>
          )}
        </div>
      ))}

      {prices.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              No medicines found from {pharmacy.name} yet.
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Prices are updated when users search for specific medicines.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
