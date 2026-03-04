import Link from "next/link";
import {
  Scan,
  Search,
  TrendingDown,
  Shield,
  Share2,
  Smartphone,
  Pill,
  ArrowRight,
} from "lucide-react";

const steps = [
  {
    num: 1,
    icon: Scan,
    title: "Scan or Upload Prescription",
    description:
      "Take a photo of your paper prescription using your phone camera, or upload an image. Our OCR technology reads medicine names, dosages, and quantities automatically.",
    color: "bg-teal-100 text-teal-700",
  },
  {
    num: 2,
    icon: Search,
    title: "AI Matches Medicines",
    description:
      "Our system matches each medicine from your prescription against our database of 50,000+ drugs across India. It identifies the exact composition, strength, and form.",
    color: "bg-blue-100 text-blue-700",
  },
  {
    num: 3,
    icon: TrendingDown,
    title: "Compare Prices Across Pharmacies",
    description:
      "See real-time prices from 1mg, PharmEasy, Netmeds, Apollo, and Jan Aushadhi stores. Every price is broken down transparently — MRP, selling price, and discount.",
    color: "bg-purple-100 text-purple-700",
  },
  {
    num: 4,
    icon: Shield,
    title: "Get Quality Generic Alternatives",
    description:
      "For every branded medicine, we show WHO-GMP certified generic alternatives with the same composition. Same active ingredient, same quality — up to 80% cheaper.",
    color: "bg-green-100 text-green-700",
  },
  {
    num: 5,
    icon: Share2,
    title: "Save & Share on WhatsApp",
    description:
      "Save your results and share them with family and friends via WhatsApp. Help others discover affordable healthcare options too.",
    color: "bg-amber-100 text-amber-700",
  },
];

const faqs = [
  {
    q: "Are generic medicines really as effective as branded ones?",
    a: "Yes. Generic medicines contain the same active ingredients in the same dosage as branded versions. They are approved by CDSCO and must meet the same quality standards. The only difference is the brand name and price.",
  },
  {
    q: "How does CostMini get its prices?",
    a: "We aggregate prices from major online pharmacies (1mg, PharmEasy, Netmeds, Apollo) and government Jan Aushadhi stores. Prices are updated regularly to ensure accuracy.",
  },
  {
    q: "Is CostMini free to use?",
    a: "Yes, CostMini is completely free. Scan prescriptions, compare prices, and find alternatives — all at no cost.",
  },
  {
    q: "Can I order medicines through CostMini?",
    a: "Currently, CostMini is a price comparison and recommendation platform. We redirect you to the pharmacy with the best price so you can order directly from them.",
  },
  {
    q: "Is my prescription data safe?",
    a: "We process prescriptions locally in your browser using OCR technology. We don't store your prescription images on our servers. Your health data stays on your device.",
  },
  {
    q: "Why should I trust generic medicines from Jan Aushadhi stores?",
    a: "Jan Aushadhi (Pradhan Mantri Bhartiya Janaushadhi Pariyojana) is a Government of India initiative. All medicines sold are WHO-GMP certified and tested by NABL accredited labs.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          How CostMini Works
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          From prescription to savings in under a minute. Here&apos;s how our
          platform helps you save on healthcare.
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-8 mb-16">
        {steps.map((step) => (
          <div
            key={step.num}
            className="flex gap-5 items-start p-6 rounded-2xl bg-white border border-gray-200"
          >
            <div
              className={`w-14 h-14 rounded-xl ${step.color} flex items-center justify-center shrink-0`}
            >
              <step.icon size={28} />
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1">
                Step {step.num}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {step.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Use Cases */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          What You Can Do
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/medicines"
            className="p-5 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-md transition-all group"
          >
            <Pill size={24} className="text-teal-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">
              Compare Medicine Prices
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Search any medicine and see prices across pharmacies.
            </p>
            <span className="text-sm text-[var(--color-primary)] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Browse Medicines <ArrowRight size={14} />
            </span>
          </Link>
          <Link
            href="/scan"
            className="p-5 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-md transition-all group"
          >
            <Smartphone size={24} className="text-blue-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">
              Scan Prescription
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Upload or photograph any prescription for instant results.
            </p>
            <span className="text-sm text-[var(--color-primary)] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              Try Scanner <ArrowRight size={14} />
            </span>
          </Link>
          <Link
            href="/procedures"
            className="p-5 rounded-xl border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-md transition-all group"
          >
            <TrendingDown size={24} className="text-purple-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-1">
              Compare Surgery Costs
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              See transparent surgery pricing across hospitals.
            </p>
            <span className="text-sm text-[var(--color-primary)] font-medium flex items-center gap-1 group-hover:gap-2 transition-all">
              View Procedures <ArrowRight size={14} />
            </span>
          </Link>
        </div>
      </section>

      {/* FAQs */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, i) => (
            <details
              key={i}
              className="group bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <summary className="px-6 py-4 cursor-pointer font-medium text-gray-900 list-none flex items-center justify-between hover:bg-gray-50">
                {faq.q}
                <span className="text-gray-400 group-open:rotate-180 transition-transform">
                  ▼
                </span>
              </summary>
              <div className="px-6 pb-4 text-gray-600 text-sm leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">Start Saving Today</h2>
        <p className="text-teal-100 mb-6">
          Your first prescription scan is instant and free.
        </p>
        <Link
          href="/scan"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-teal-700 font-semibold hover:bg-teal-50 transition-colors"
        >
          <Scan size={20} />
          Scan Now
        </Link>
      </section>
    </div>
  );
}
