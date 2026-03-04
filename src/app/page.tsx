import Link from "next/link";
import { Pill, Stethoscope, TestTube, Scan, TrendingDown, Shield, Share2 } from "lucide-react";

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
    description: "Upload any prescription. Get cheaper, quality alternatives instantly.",
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
    icon: Scan,
    title: "Scan or Search",
    description: "Take a photo of your prescription or search for any medicine, surgery, or lab test.",
  },
  {
    step: "2",
    icon: TrendingDown,
    title: "Compare Prices",
    description: "See transparent cost breakdowns from multiple sources — generic vs branded, across pharmacies.",
  },
  {
    step: "3",
    icon: Shield,
    title: "Get Quality Options",
    description: "Every alternative we show is from licensed, WHO-GMP certified manufacturers.",
  },
  {
    step: "4",
    icon: Share2,
    title: "Save & Share",
    description: "Save your results and share via WhatsApp to help family and friends save too.",
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
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              India&apos;s first transparent healthcare pricing
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              Stop Overpaying for{" "}
              <span className="text-teal-200">Healthcare</span>
            </h1>
            <p className="text-lg sm:text-xl text-teal-100 mb-8 leading-relaxed max-w-2xl">
              Scan any prescription to find cheaper, quality-certified generic
              alternatives. Compare medicine, surgery, and diagnostic prices
              across India — save up to 80%.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/scan"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-teal-700 font-semibold text-lg hover:bg-teal-50 transition-colors shadow-lg animate-pulse-glow"
              >
                <Scan size={22} />
                Scan Prescription Now
              </Link>
              <Link
                href="/medicines"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/15 text-white font-semibold text-lg hover:bg-white/25 transition-colors border border-white/20"
              >
                Search Medicines
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
            Take a photo of any prescription or medical report. Our AI
            instantly finds cheaper, quality-certified alternatives from
            trusted manufacturers.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/scan"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white text-teal-700 font-bold text-lg hover:bg-teal-50 transition-colors shadow-lg"
            >
              <Scan size={22} />
              Scan Now — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
