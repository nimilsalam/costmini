import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Shield,
  Award,
  Globe2,
  Pill,
  MapPin,
  Calendar,
  BarChart3,
  ExternalLink,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/utils";
import { getTierDisplay } from "@/lib/manufacturer-scoring";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ManufacturerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const mfr = await prisma.manufacturer.findUnique({
    where: { slug },
    include: {
      drugs: {
        include: {
          prices: { orderBy: { sellingPrice: "asc" }, take: 1 },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!mfr) {
    notFound();
  }

  const tierDisplay = getTierDisplay(mfr.tier);

  // Group drugs by category
  const byCategory: Record<string, typeof mfr.drugs> = {};
  for (const drug of mfr.drugs) {
    if (!byCategory[drug.category]) byCategory[drug.category] = [];
    byCategory[drug.category].push(drug);
  }
  const categories = Object.keys(byCategory).sort();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-6 -ml-2 text-muted-foreground">
        <Link href="/manufacturers">
          <ArrowLeft size={16} />
          All Manufacturers
        </Link>
      </Button>

      {/* Header */}
      <Card className="mb-6 py-0">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-white font-bold text-xl"
              style={{ backgroundColor: tierDisplay.color }}
            >
              {mfr.name
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-foreground">{mfr.name}</h1>
                <Badge
                  variant="secondary"
                  className={`${tierDisplay.bgColor} ${tierDisplay.textColor} hover:${tierDisplay.bgColor}`}
                >
                  {tierDisplay.label}
                </Badge>
              </div>

              {mfr.description && (
                <p className="text-muted-foreground mb-3">{mfr.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {mfr.headquarters && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-muted-foreground/60" />
                    {mfr.headquarters}
                  </span>
                )}
                {mfr.foundedYear && (
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-muted-foreground/60" />
                    Est. {mfr.foundedYear}
                  </span>
                )}
                {mfr.globalRank && (
                  <span className="flex items-center gap-1">
                    <BarChart3 size={14} className="text-muted-foreground/60" />
                    #{mfr.globalRank} Indian Pharma
                  </span>
                )}
                {mfr.websiteUrl && (
                  <a
                    href={mfr.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <ExternalLink size={14} />
                    Website
                  </a>
                )}
              </div>
            </div>

            {/* Score Card */}
            <div className="bg-muted rounded-xl p-4 shrink-0 min-w-[200px]">
              <div className="text-center mb-3">
                <div
                  className="text-4xl font-bold"
                  style={{ color: tierDisplay.color }}
                >
                  {Math.round(mfr.overallScore)}
                </div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">
                  CostMini Score
                </div>
              </div>
              <div className="space-y-2">
                <ScoreBar label="Quality" value={mfr.qualityScore} color="#059669" />
                <ScoreBar label="Reliability" value={mfr.reliabilityScore} color="#2563EB" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Regulatory Badges */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className={mfr.usFdaApproved ? "bg-blue-50 border-blue-200" : "opacity-50"}>
          <CardContent className="p-4 text-center">
            <Shield
              size={24}
              className={`mx-auto mb-1 ${mfr.usFdaApproved ? "text-blue-600" : "text-muted-foreground"}`}
            />
            <div className="text-sm font-semibold text-foreground">US FDA</div>
            <div className="text-xs text-muted-foreground">
              {mfr.usFdaApproved ? "Approved" : "Not Approved"}
            </div>
          </CardContent>
        </Card>
        <Card className={mfr.whoPrequalified ? "bg-green-50 border-green-200" : "opacity-50"}>
          <CardContent className="p-4 text-center">
            <Globe2
              size={24}
              className={`mx-auto mb-1 ${mfr.whoPrequalified ? "text-green-600" : "text-muted-foreground"}`}
            />
            <div className="text-sm font-semibold text-foreground">WHO</div>
            <div className="text-xs text-muted-foreground">
              {mfr.whoPrequalified ? "Prequalified" : "Not Prequalified"}
            </div>
          </CardContent>
        </Card>
        <Card className={mfr.eugmpCompliant ? "bg-purple-50 border-purple-200" : "opacity-50"}>
          <CardContent className="p-4 text-center">
            <Award
              size={24}
              className={`mx-auto mb-1 ${mfr.eugmpCompliant ? "text-purple-600" : "text-muted-foreground"}`}
            />
            <div className="text-sm font-semibold text-foreground">EU-GMP</div>
            <div className="text-xs text-muted-foreground">
              {mfr.eugmpCompliant ? "Compliant" : "Not Compliant"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Medicines by Category */}
      <h2 className="text-xl font-bold text-foreground mb-4">
        Medicines ({mfr.drugs.length})
      </h2>
      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h3 className="text-md font-semibold text-muted-foreground mb-2">{cat}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byCategory[cat].map((drug) => {
              const lowestPrice =
                drug.prices.length > 0 ? drug.prices[0].sellingPrice : 0;
              return (
                <Link key={drug.id} href={`/medicines/${drug.slug}`}>
                  <Card className="hover:shadow-md transition-all group py-0">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
                          <Pill size={16} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground truncate group-hover:text-primary">
                              {drug.name}
                            </span>
                            {drug.isGeneric && (
                              <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] px-1.5 py-0 shrink-0">
                                Generic
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {drug.composition} &middot; {drug.packSize}
                          </div>
                        </div>
                        {lowestPrice > 0 && (
                          <div className="text-sm font-bold text-primary shrink-0">
                            {formatPrice(lowestPrice)}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {mfr.drugs.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground text-lg">
              No medicines from {mfr.name} in our database yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreBar({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium text-foreground">{Math.round(value)}</span>
      </div>
      <div className="w-full h-1.5 bg-muted rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
