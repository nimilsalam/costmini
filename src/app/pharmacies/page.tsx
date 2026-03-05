import Link from "next/link";
import Image from "next/image";
import {
  Star,
  Truck,
  RotateCcw,
  Banknote,
  Globe,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
} from "lucide-react";
import { getAllPharmacies } from "@/lib/pharmacy-profiles";

// Map source names to logo file names
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

export const metadata = {
  title: "Online Pharmacies in India | CostMini",
  description:
    "Compare India's top online pharmacies — 1mg, PharmEasy, Apollo, Netmeds, Amazon Pharmacy, and more. See shipping, returns, and ratings.",
};

export default function PharmaciesPage() {
  const pharmacies = getAllPharmacies();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Online Pharmacies in India
        </h1>
        <p className="text-gray-600 max-w-2xl">
          Compare India&apos;s top licensed online pharmacies. All pharmacies
          listed are verified and deliver authentic medicines across India.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {pharmacies.map((pharmacy) => (
          <div
            key={pharmacy.slug}
            className="bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-lg transition-shadow"
          >
            {/* Header */}
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
                <Image
                  src={`/pharmacies/${logoMap[pharmacy.source] || pharmacy.slug}.svg`}
                  alt={pharmacy.name}
                  width={48}
                  height={48}
                  className="w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900">
                    {pharmacy.name}
                  </h2>
                  <span className="text-xs text-gray-400">
                    Est. {pharmacy.established}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={14}
                      className={
                        i < Math.floor(pharmacy.rating)
                          ? "text-amber-400 fill-amber-400"
                          : i < pharmacy.rating
                            ? "text-amber-400 fill-amber-200"
                            : "text-gray-200"
                      }
                    />
                  ))}
                  <span className="text-sm text-gray-500 ml-1">
                    {pharmacy.rating}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-4">
              {pharmacy.description}
            </p>

            {/* Features */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Truck size={14} className="text-gray-400 flex-shrink-0" />
                {pharmacy.shippingInfo}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <RotateCcw size={14} className="text-gray-400 flex-shrink-0" />
                {pharmacy.returnPolicy}
              </div>
              {pharmacy.codAvailable && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Banknote size={14} className="text-gray-400 flex-shrink-0" />
                  Cash on Delivery available
                </div>
              )}
              {pharmacy.panIndiaDelivery && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Globe size={14} className="text-gray-400 flex-shrink-0" />
                  Pan-India delivery
                </div>
              )}
              {pharmacy.authenticMeds && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <ShieldCheck
                    size={14}
                    className="text-green-500 flex-shrink-0"
                  />
                  Licensed pharmacy — authentic medicines
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {pharmacy.specialFeatures.map((feat) => (
                <span
                  key={feat}
                  className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600"
                >
                  {feat}
                </span>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-gray-100">
              <Link
                href={`/pharmacies/${pharmacy.slug}`}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gray-50 text-gray-700 text-sm font-medium hover:bg-gray-100 transition-colors"
              >
                Browse Medicines <ArrowRight size={14} />
              </Link>
              <a
                href={pharmacy.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{
                  backgroundColor: pharmacy.color,
                  color: pharmacy.textColor,
                }}
              >
                Visit <ExternalLink size={14} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
