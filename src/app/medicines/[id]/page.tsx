"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Share2, ExternalLink, AlertCircle } from "lucide-react";
import { sampleDrugs } from "@/lib/sample-data";
import { formatPrice, calcSavings, whatsappShareUrl, whatsappDrugShareText } from "@/lib/utils";

export default function DrugDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const idx = parseInt(id);
  const drug = sampleDrugs[idx];

  if (!drug) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <p className="text-gray-500 text-lg">Medicine not found</p>
        <Link href="/medicines" className="text-[var(--color-primary)] mt-4 inline-block">
          Back to Medicines
        </Link>
      </div>
    );
  }

  const cheapest = Math.min(...drug.prices.map((p) => p.sellingPrice));
  const mrp = Math.max(...drug.prices.map((p) => p.mrp));
  const savings = calcSavings(mrp, cheapest);

  // Find generic alternatives
  const alternatives = sampleDrugs.filter(
    (d, i) =>
      i !== idx &&
      d.genericName === drug.genericName &&
      d.isGeneric !== drug.isGeneric
  );

  const shareText = whatsappDrugShareText(drug.name, mrp, cheapest, savings);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link
        href="/medicines"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-[var(--color-primary)] mb-6"
      >
        <ArrowLeft size={16} />
        Back to Medicines
      </Link>

      {/* Drug Header */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">{drug.name}</h1>
              {drug.isGeneric && (
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                  Generic
                </span>
              )}
              {drug.whoCertified && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1">
                  <Shield size={12} />
                  WHO-GMP
                </span>
              )}
            </div>
            <p className="text-gray-600 mb-1">{drug.composition}</p>
            <p className="text-sm text-gray-500">
              {drug.manufacturer} &middot; {drug.dosageForm} &middot;{" "}
              {drug.packSize}
            </p>
            {drug.prescriptionReq && (
              <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                <AlertCircle size={14} />
                Prescription Required
              </p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">Starting from</div>
            <div className="text-3xl font-bold text-[var(--color-primary)]">
              {formatPrice(cheapest)}
            </div>
            {savings > 0 && (
              <div className="flex items-center gap-2 justify-end mt-1">
                <span className="text-sm text-gray-400 line-through">
                  MRP {formatPrice(mrp)}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-sm font-semibold">
                  Save {savings}%
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price Comparison Table */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Price Comparison Across Pharmacies
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="pb-3 font-medium">Pharmacy</th>
                <th className="pb-3 font-medium">MRP</th>
                <th className="pb-3 font-medium">Selling Price</th>
                <th className="pb-3 font-medium">Savings</th>
                <th className="pb-3 font-medium">Stock</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {drug.prices
                .sort((a, b) => a.sellingPrice - b.sellingPrice)
                .map((price, i) => {
                  const pSavings = calcSavings(price.mrp, price.sellingPrice);
                  const isCheapest = price.sellingPrice === cheapest;
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 ${
                        isCheapest ? "bg-green-50/50" : ""
                      }`}
                    >
                      <td className="py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {price.source}
                          </span>
                          {isCheapest && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">
                              Cheapest
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 text-gray-500">
                        {formatPrice(price.mrp)}
                      </td>
                      <td className="py-3 font-semibold text-gray-900">
                        {formatPrice(price.sellingPrice)}
                      </td>
                      <td className="py-3">
                        {pSavings > 0 ? (
                          <span className="text-green-600 font-medium">
                            {pSavings}% off
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <span
                          className={`text-sm ${
                            price.inStock
                              ? "text-green-600"
                              : "text-red-500"
                          }`}
                        >
                          {price.inStock ? "In Stock" : "Out of Stock"}
                        </span>
                      </td>
                      <td className="py-3">
                        <button className="text-[var(--color-primary)] hover:underline text-sm flex items-center gap-1">
                          Visit <ExternalLink size={12} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generic Alternatives */}
      {alternatives.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-teal-50 rounded-2xl border border-green-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            {drug.isGeneric ? "Branded Versions" : "Cheaper Generic Alternatives"}
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Same composition ({drug.composition}), from certified manufacturers
          </p>
          <div className="space-y-3">
            {alternatives.map((alt, i) => {
              const altCheapest = Math.min(
                ...alt.prices.map((p) => p.sellingPrice)
              );
              const altSavings = calcSavings(mrp, altCheapest);
              return (
                <Link
                  key={i}
                  href={`/medicines/${sampleDrugs.indexOf(alt)}`}
                  className="block bg-white rounded-xl p-4 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">
                          {alt.name}
                        </span>
                        {alt.isGeneric && (
                          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                            Generic
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">
                        {alt.manufacturer} &middot; {alt.packSize}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        {formatPrice(altCheapest)}
                      </div>
                      {altSavings > 0 && (
                        <span className="text-sm text-green-600">
                          Save {altSavings}%
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Drug Info */}
      <div className="grid sm:grid-cols-2 gap-6 mb-6">
        {drug.uses && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Uses</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{drug.uses}</p>
          </div>
        )}
        {drug.sideEffects && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Side Effects</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              {drug.sideEffects}
            </p>
          </div>
        )}
      </div>

      {/* Share CTA */}
      <div className="bg-green-50 rounded-2xl border border-green-200 p-6 text-center">
        <p className="text-gray-700 font-medium mb-3">
          Help someone save on their medicines
        </p>
        <a
          href={whatsappShareUrl(shareText)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
        >
          <Share2 size={18} />
          Share on WhatsApp
        </a>
      </div>
    </div>
  );
}
