import Link from "next/link";
import { Pill, Stethoscope, TestTube, Scan, TrendingDown, Shield, Share2, Sparkles, Search } from "lucide-react";

const categories = [
  {
    href: "/medicines",
    icon: Pill,
    title: "Medicines",
    description: "Compare prices across pharmacies. Find generic alternatives at up to 80% less.",
    color: "bg-teal-50 text-teal-600",
  },
  {
    href: "/procedures",
    icon: Stethoscope,
    title: "Surgeries & Procedures",
    description: "Transparent surgery costs from trusted hospitals across India.",
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/diagnostics",
    icon: TestTube,
    title: "Lab Tests & Scans",
    description: "Blood tests, MRI, CT scans — find the best prices near you.",
    color: "bg-purple-50 text-purple-600",
  },
  {
    href: "/scan",
    icon: Scan,
    title: "Scan Prescription",
    description: "Upload any prescription. AI reads it and finds cheaper alternatives.",
    color: "bg-amber-50 text-amber-600",
  },
];

const stats = [
  { value: "80%", label: "Average Savings" },
  { value: "50K+", label: "Medicines Listed" },
  { value: "500+", label: "Hospitals Compared" },
  { value: "10L+", label: "Indians Helped" },
];

const howItWorks = [
  {
    step: "1",
    icon: Search,
    title: "Ask or Scan",
    description: "Type any health query in AI search, or snap a photo of your prescription.",
  },
  {
    step: "2",
    icon: Sparkles,
    title: "AI Analyzes",
    description: "Our AI reads your prescription, identifies medicines, and searches for alternatives.",
  },
  {
    step: "3",
    icon: TrendingDown,
    title: "Compare & Save",
    description: "See transparent prices — generic vs branded, across pharmacies and hospitals.",
  },
  {
    step: "4",
    icon: Share2,
    title: "Share on WhatsApp",
    description: "Share savings with family and friends. Help others stop overpaying too.",
  },
];

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-teal-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-20 w-96 h-96 bg-teal-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-sm font-medium mb-6">
              <Sparkles size={14} />
              AI-powered healthcare pricing — Ask anything
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Stop Overpaying for{" "}
              <span className="text-teal-200">Healthcare</span>
            </h1>
            <p className="text-lg sm:text-xl text-teal-100 mb-8 leading-relaxed max-w-2xl">
              Ask about medicine prices, scan prescriptions with AI, compare
              surgery costs — like Perplexity, but for Indian healthcare. Save
              up to 80%.
            </p>

            {/* AI Search Bar */}
            <div className="mb-6">
              <Link
                href="/search"
                className="flex items-center gap-3 w-full max-w-xl px-5 py-4 rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 transition-all group"
              >
                <Sparkles size={20} className="text-teal-200 group-hover:text-white transition-colors" />
                <span className="text-teal-200 group-hover:text-white transition-colors">
                  Ask about medicines, surgery costs, lab tests...
                </span>
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/scan"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-teal-700 font-semibold text-lg hover:bg-teal-50 transition-colors shadow-lg"
              >
                <Scan size={22} />
                Scan Prescription
              </Link>
              <Link
                href="/search"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/15 text-white font-semibold text-lg hover:bg-white/25 transition-colors border border-white/20"
              >
                <Sparkles size={20} />
                AI Search
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl sm:text-4xl font-bold text-[var(--color-primary)]">
                  {s.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Feature Highlight */}
      <section className="bg-gradient-to-br from-gray-50 to-teal-50/30 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-100 text-teal-700 text-sm font-medium mb-4">
                <Sparkles size={14} />
                Powered by Groq AI
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Ask Anything About Healthcare Costs
              </h2>
              <p className="text-gray-500 text-lg mb-6 leading-relaxed">
                Like having a pharmacist friend who knows every medicine price in
                India. Ask in plain language — our AI searches real pricing data
                and gives you honest, helpful answers.
              </p>
              <div className="space-y-3">
                {[
                  "What's the cheapest paracetamol available?",
                  "How much does knee replacement cost in Delhi?",
                  "Compare Dolo 650 vs generic alternatives",
                ].map((q, i) => (
                  <Link
                    key={i}
                    href={`/search`}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-[var(--color-primary)] hover:shadow-sm transition-all text-sm text-gray-700"
                  >
                    <Search size={16} className="text-gray-400 flex-shrink-0" />
                    {q}
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[var(--color-primary)] flex items-center justify-center">
                  <Sparkles size={14} className="text-white" />
                </div>
                <span className="font-semibold text-gray-900 text-sm">CostMini AI</span>
              </div>
              <div className="space-y-3 text-sm text-gray-700">
                <p>
                  <strong className="text-gray-900">Dolo 650</strong> (Branded) costs{" "}
                  <strong className="text-[var(--color-primary)]">₹29</strong> for 15 tablets.
                </p>
                <p>
                  The generic alternative —{" "}
                  <strong className="text-gray-900">Paracetamol 650mg (Jan Aushadhi)</strong>{" "}
                  — costs just{" "}
                  <strong className="text-green-600">₹6</strong> for 10 tablets.
                </p>
                <p className="text-green-700 font-semibold">
                  That&apos;s ~80% savings with the same active ingredient!
                </p>
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400">
                    Both are WHO-GMP certified. Always consult your doctor before switching.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
            Everything Healthcare, One Platform
          </h2>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto">
            From daily medicines to major surgeries — compare prices
            transparently and make informed decisions.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {categories.map((cat) => (
            <Link
              key={cat.href}
              href={cat.href}
              className="group p-6 rounded-2xl border border-gray-200 hover:border-[var(--color-primary)] hover:shadow-lg transition-all"
            >
              <div
                className={`w-12 h-12 rounded-xl ${cat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
              >
                <cat.icon size={24} />
              </div>
              <h3 className="font-semibold text-gray-900 text-lg mb-2">
                {cat.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {cat.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              How CostMini Works
            </h2>
            <p className="text-gray-500 text-lg">
              Save on healthcare in 4 simple steps
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {howItWorks.map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <item.icon size={28} />
                </div>
                <div className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider mb-2">
                  Step {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Your Prescription Could Cost 80% Less
          </h2>
          <p className="text-teal-100 text-lg mb-8 max-w-2xl mx-auto">
            Snap a photo of any prescription. Our AI instantly reads it, finds
            cheaper alternatives, and shows you exactly how much you can save.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-teal-700 font-bold text-lg hover:bg-teal-50 transition-colors shadow-lg"
            >
              <Scan size={22} />
              Scan Now — It&apos;s Free
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white/15 text-white font-bold text-lg hover:bg-white/25 transition-colors border border-white/20"
            >
              <Sparkles size={20} />
              Try AI Search
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
