export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Terms of Service
      </h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

      <div className="space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Acceptance of Terms
          </h2>
          <p>
            By accessing and using CostMini (costmini.in), you accept and agree
            to be bound by these Terms of Service. If you do not agree, please
            do not use our services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Service Description
          </h2>
          <p>
            CostMini is a healthcare price comparison platform that provides:
          </p>
          <ul className="list-disc pl-6 space-y-1 mt-2">
            <li>Medicine price comparison across pharmacies</li>
            <li>Generic medicine alternative recommendations</li>
            <li>Prescription scanning and analysis</li>
            <li>Surgery and procedure cost comparison</li>
            <li>Lab test and diagnostic price comparison</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Use Restrictions
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must be at least 18 years old to use this service.</li>
            <li>Do not use our platform for any unlawful purpose.</li>
            <li>
              Do not attempt to scrape, crawl, or automatically extract data
              from our platform without permission.
            </li>
            <li>
              Do not impersonate any person or entity when using our services.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Limitation of Liability
          </h2>
          <p>
            CostMini provides information &quot;as is&quot; without warranties of any
            kind. We are not liable for any decisions you make based on
            information from our platform. Always consult qualified healthcare
            professionals before making medical decisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Third-Party Content
          </h2>
          <p>
            Prices and product information are sourced from third-party
            pharmacies and healthcare providers. We do not control and are not
            responsible for the accuracy, availability, or quality of
            third-party products and services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Intellectual Property
          </h2>
          <p>
            All content, design, and code on CostMini are our intellectual
            property. You may not reproduce, distribute, or create derivative
            works without our written permission.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Changes to Terms
          </h2>
          <p>
            We reserve the right to modify these terms at any time. Continued
            use of the platform after changes constitutes acceptance of the
            updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Governing Law
          </h2>
          <p>
            These terms are governed by the laws of India. Any disputes shall
            be subject to the exclusive jurisdiction of courts in New Delhi,
            India.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Contact
          </h2>
          <p>
            For questions about these terms, email us at{" "}
            <strong>legal@costmini.in</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
