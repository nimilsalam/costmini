export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-8">Last updated: March 2026</p>

      <div className="space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Overview
          </h2>
          <p>
            CostMini (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is
            committed to protecting your privacy. This policy explains how we
            collect, use, and safeguard your information when you use our
            website and services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Information We Collect
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Search queries:</strong> Medicine names, procedure names,
              and diagnostic tests you search for. Used to provide results and
              improve our service.
            </li>
            <li>
              <strong>Prescription images:</strong> When you use our scanner,
              images are processed locally in your browser using OCR. We do not
              upload or store your prescription images on our servers.
            </li>
            <li>
              <strong>Usage analytics:</strong> Anonymous page views, feature
              usage, and device information to improve the platform.
            </li>
            <li>
              <strong>WhatsApp data:</strong> If you use our WhatsApp service,
              we receive your phone number and messages you send us. This is
              used solely to provide prescription scanning and medicine search
              results.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            What We Do NOT Collect
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>We do not collect your name, email, or personal identity unless you provide it voluntarily.</li>
            <li>We do not store prescription images on our servers.</li>
            <li>We do not sell or share your data with third parties for advertising.</li>
            <li>We do not track your medical history or health conditions.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            How We Use Your Information
          </h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide medicine price comparison and generic alternative recommendations</li>
            <li>To process prescription scans and return results</li>
            <li>To improve our platform, fix bugs, and enhance user experience</li>
            <li>To respond to your queries via WhatsApp or contact form</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Data Security
          </h2>
          <p>
            We implement industry-standard security measures to protect your
            data. Prescription scanning happens client-side (in your browser)
            and images never leave your device. All data transmitted between
            your browser and our servers is encrypted using HTTPS/TLS.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Your Rights
          </h2>
          <p>
            You have the right to access, correct, or delete any personal data
            we hold. Since we collect minimal data, most users have no personal
            information stored. Contact us at privacy@costmini.in for any
            data-related requests.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Contact
          </h2>
          <p>
            For privacy-related questions, email us at{" "}
            <strong>privacy@costmini.in</strong>.
          </p>
        </section>
      </div>
    </div>
  );
}
