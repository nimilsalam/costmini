import Link from "next/link";
import { Shield, Award, Globe2, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getTierDisplay } from "@/lib/manufacturer-scoring";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pharmaceutical Manufacturers in India — Ratings & Quality Scores | CostMini",
  description:
    "Compare India's top pharma manufacturers by quality score, FDA approval, WHO prequalification, and reliability. Rated by CostMini's algorithmic scoring.",
};

export default async function ManufacturersPage() {
  const manufacturers = await prisma.manufacturer.findMany({
    orderBy: { overallScore: "desc" },
    include: {
      _count: { select: { drugs: true } },
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Pharmaceutical Manufacturers
        </h1>
        <p className="text-gray-600 max-w-2xl">
          CostMini rates manufacturers based on regulatory approvals (FDA, WHO,
          EU-GMP), market presence, and product quality. Higher scores mean
          stronger quality assurance.
        </p>
      </div>

      {/* Score Legend */}
      <div className="flex flex-wrap gap-3 mb-6">
        {(["premium", "trusted", "government", "standard"] as const).map(
          (tier) => {
            const display = getTierDisplay(tier);
            return (
              <div
                key={tier}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${display.bgColor} ${display.textColor}`}
              >
                {tier === "premium" && <Award size={12} />}
                {tier === "trusted" && <Shield size={12} />}
                {tier === "government" && <Globe2 size={12} />}
                {display.label}
                {tier === "premium" && " (85-100)"}
                {tier === "trusted" && " (65-84)"}
                {tier === "government" && " (Govt.)"}
                {tier === "standard" && " (40-64)"}
              </div>
            );
          }
        )}
      </div>

      <div className="space-y-4">
        {manufacturers.map((mfr) => {
          const tierDisplay = getTierDisplay(mfr.tier);

          return (
            <Link
              key={mfr.id}
              href={`/manufacturers/${mfr.slug}`}
              className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col sm:flex-row items-start gap-4">
                {/* Initials Avatar */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
                  style={{ backgroundColor: tierDisplay.color }}
                >
                  {mfr.name
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-lg font-bold text-gray-900 group-hover:text-[var(--color-primary)]">
                      {mfr.name}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${tierDisplay.bgColor} ${tierDisplay.textColor}`}
                    >
                      {tierDisplay.label}
                    </span>
                  </div>

                  {mfr.description && (
                    <p className="text-sm text-gray-500 mb-2 line-clamp-1">
                      {mfr.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    {mfr.headquarters && <span>{mfr.headquarters}</span>}
                    {mfr.foundedYear && <span>Est. {mfr.foundedYear}</span>}
                    <span>{mfr._count.drugs} medicines</span>
                    {/* Regulatory badges */}
                    {mfr.usFdaApproved && (
                      <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium">
                        US-FDA
                      </span>
                    )}
                    {mfr.whoPrequalified && (
                      <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                        WHO
                      </span>
                    )}
                    {mfr.eugmpCompliant && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">
                        EU-GMP
                      </span>
                    )}
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ color: tierDisplay.color }}>
                      {Math.round(mfr.overallScore)}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Score
                    </div>
                  </div>
                  {/* Score bar */}
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${mfr.overallScore}%`,
                        backgroundColor: tierDisplay.color,
                      }}
                    />
                  </div>
                  <ArrowRight
                    size={16}
                    className="text-gray-300 group-hover:text-[var(--color-primary)] hidden sm:block"
                  />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
