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
      <Link
        href="/manufacturers"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--color-primary)] mb-6"
      >
        <ArrowLeft size={16} />
        All Manufacturers
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div
            className="w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-xl"
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
              <h1 className="text-2xl font-bold text-gray-900">{mfr.name}</h1>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${tierDisplay.bgColor} ${tierDisplay.textColor}`}
              >
                {tierDisplay.label}
              </span>
            </div>

            {mfr.description && (
              <p className="text-gray-600 mb-3">{mfr.description}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-gray-500">
              {mfr.headquarters && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400" />
                  {mfr.headquarters}
                </span>
              )}
              {mfr.foundedYear && (
                <span className="flex items-center gap-1">
                  <Calendar size={14} className="text-gray-400" />
                  Est. {mfr.foundedYear}
                </span>
              )}
              {mfr.globalRank && (
                <span className="flex items-center gap-1">
                  <BarChart3 size={14} className="text-gray-400" />
                  #{mfr.globalRank} Indian Pharma
                </span>
              )}
              {mfr.websiteUrl && (
                <a
                  href={mfr.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[var(--color-primary)] hover:underline"
                >
                  <ExternalLink size={14} />
                  Website
                </a>
              )}
            </div>
          </div>

          {/* Score Card */}
          <div className="bg-gray-50 rounded-xl p-4 flex-shrink-0 min-w-[200px]">
            <div className="text-center mb-3">
              <div
                className="text-4xl font-bold"
                style={{ color: tierDisplay.color }}
              >
                {Math.round(mfr.overallScore)}
              </div>
              <div className="text-xs text-gray-400 uppercase tracking-wider">
                CostMini Score
              </div>
            </div>
            <div className="space-y-2">
              <ScoreBar label="Quality" value={mfr.qualityScore} color="#059669" />
              <ScoreBar label="Reliability" value={mfr.reliabilityScore} color="#2563EB" />
            </div>
          </div>
        </div>
      </div>

      {/* Regulatory Badges */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div
          className={`rounded-xl border p-4 text-center ${
            mfr.usFdaApproved
              ? "bg-blue-50 border-blue-200"
              : "bg-gray-50 border-gray-200 opacity-50"
          }`}
        >
          <Shield
            size={24}
            className={`mx-auto mb-1 ${mfr.usFdaApproved ? "text-blue-600" : "text-gray-400"}`}
          />
          <div className="text-sm font-semibold text-gray-900">US FDA</div>
          <div className="text-xs text-gray-500">
            {mfr.usFdaApproved ? "Approved" : "Not Approved"}
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 text-center ${
            mfr.whoPrequalified
              ? "bg-green-50 border-green-200"
              : "bg-gray-50 border-gray-200 opacity-50"
          }`}
        >
          <Globe2
            size={24}
            className={`mx-auto mb-1 ${mfr.whoPrequalified ? "text-green-600" : "text-gray-400"}`}
          />
          <div className="text-sm font-semibold text-gray-900">WHO</div>
          <div className="text-xs text-gray-500">
            {mfr.whoPrequalified ? "Prequalified" : "Not Prequalified"}
          </div>
        </div>
        <div
          className={`rounded-xl border p-4 text-center ${
            mfr.eugmpCompliant
              ? "bg-purple-50 border-purple-200"
              : "bg-gray-50 border-gray-200 opacity-50"
          }`}
        >
          <Award
            size={24}
            className={`mx-auto mb-1 ${mfr.eugmpCompliant ? "text-purple-600" : "text-gray-400"}`}
          />
          <div className="text-sm font-semibold text-gray-900">EU-GMP</div>
          <div className="text-xs text-gray-500">
            {mfr.eugmpCompliant ? "Compliant" : "Not Compliant"}
          </div>
        </div>
      </div>

      {/* Medicines by Category */}
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Medicines ({mfr.drugs.length})
      </h2>
      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h3 className="text-md font-semibold text-gray-700 mb-2">{cat}</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {byCategory[cat].map((drug) => {
              const lowestPrice =
                drug.prices.length > 0 ? drug.prices[0].sellingPrice : 0;
              return (
                <Link
                  key={drug.id}
                  href={`/medicines/${drug.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
                      <Pill size={16} className="text-teal-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 truncate group-hover:text-[var(--color-primary)]">
                          {drug.name}
                        </span>
                        {drug.isGeneric && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 font-medium flex-shrink-0">
                            Generic
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {drug.composition} &middot; {drug.packSize}
                      </div>
                    </div>
                    {lowestPrice > 0 && (
                      <div className="text-sm font-bold text-[var(--color-primary)] flex-shrink-0">
                        {formatPrice(lowestPrice)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {mfr.drugs.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-lg">
            No medicines from {mfr.name} in our database yet.
          </p>
        </div>
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
        <span className="text-gray-500">{label}</span>
        <span className="font-medium text-gray-700">{Math.round(value)}</span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
