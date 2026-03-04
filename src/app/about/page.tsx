import Link from "next/link";
import { Heart, Eye, Scale, Users, Scan } from "lucide-react";

const values = [
  {
    icon: Eye,
    title: "Transparency",
    description:
      "Every price broken down. No hidden charges. See exactly what you pay and what the manufacturer charges.",
  },
  {
    icon: Scale,
    title: "Fair Pricing",
    description:
      "We believe every Indian deserves access to affordable healthcare. Generic medicines are just as effective as branded ones.",
  },
  {
    icon: Heart,
    title: "Quality First",
    description:
      "We only recommend WHO-GMP certified, CDSCO approved medicines from licensed manufacturers.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description:
      "Share savings with family and friends via WhatsApp. When one person saves, everyone benefits.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">About CostMini</h1>
      <p className="text-xl text-gray-500 mb-12 leading-relaxed">
        We&apos;re building India&apos;s most transparent healthcare pricing
        platform. Our mission is simple — help every Indian make informed
        healthcare decisions and stop overpaying for medicines, surgeries, and
        diagnostics.
      </p>

      {/* The Problem */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">The Problem</h2>
        <div className="bg-red-50 rounded-2xl p-6 space-y-3">
          <p className="text-gray-700 leading-relaxed">
            <strong>70% of Indians</strong> pay for healthcare out of pocket.
            The same medicine can cost <strong>up to 14x more</strong> as a
            branded drug versus its generic equivalent. Yet most patients never
            know cheaper alternatives exist.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Doctors often prescribe expensive brands. Pharmacists push high-margin
            products. And patients — already stressed about their health — end up
            paying far more than they need to.
          </p>
        </div>
      </section>

      {/* Our Solution */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Solution</h2>
        <div className="bg-teal-50 rounded-2xl p-6 space-y-3">
          <p className="text-gray-700 leading-relaxed">
            <strong>CostMini</strong> is a one-stop platform where you can scan
            any prescription and instantly see cheaper, quality-certified
            alternatives. We compare prices across 1mg, PharmEasy, Netmeds,
            Apollo, and Jan Aushadhi stores.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Beyond medicines, we bring the same transparency to surgery costs
            and diagnostic tests — helping you compare hospital prices, check
            accreditation, and make informed choices.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Our Values</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {values.map((v) => (
            <div key={v.title} className="p-5 rounded-xl border border-gray-200">
              <v.icon
                size={28}
                className="text-[var(--color-primary)] mb-3"
              />
              <h3 className="font-semibold text-gray-900 mb-1">{v.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {v.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-teal-600 to-teal-700 rounded-2xl p-8 text-center text-white">
        <h2 className="text-2xl font-bold mb-3">
          Ready to Start Saving?
        </h2>
        <p className="text-teal-100 mb-6">
          Scan your first prescription and see how much you can save.
        </p>
        <Link
          href="/scan"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-teal-700 font-semibold hover:bg-teal-50 transition-colors"
        >
          <Scan size={20} />
          Scan Prescription
        </Link>
      </section>
    </div>
  );
}
