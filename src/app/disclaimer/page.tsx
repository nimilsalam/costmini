export default function DisclaimerPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">
        Medical Disclaimer
      </h1>

      <div className="prose prose-gray max-w-none space-y-6 text-gray-600 leading-relaxed">
        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Not Medical Advice
          </h2>
          <p>
            CostMini is a price comparison and information platform. The content
            on this website is provided for informational purposes only and is
            not intended as a substitute for professional medical advice,
            diagnosis, or treatment. Always seek the advice of your physician or
            other qualified healthcare provider with any questions you may have
            regarding a medical condition or medication.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Generic Medicine Information
          </h2>
          <p>
            While we recommend generic alternatives that contain the same active
            ingredients as branded medicines, we strongly advise consulting your
            doctor before switching from a branded to a generic medication. Your
            doctor understands your complete medical history and can make the
            best recommendation for your specific situation.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Price Accuracy
          </h2>
          <p>
            Medicine, surgery, and diagnostic prices shown on CostMini are
            aggregated from third-party sources and may not reflect real-time
            pricing. Actual prices may vary. We make every effort to keep our
            data current but cannot guarantee 100% accuracy at all times.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Prescription Scanning
          </h2>
          <p>
            Our prescription scanning feature uses OCR (Optical Character
            Recognition) technology which may not always accurately read all
            text from prescription images. Always verify the detected medicines
            against your actual prescription. Do not rely solely on our scanner
            for medication decisions.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            No Doctor-Patient Relationship
          </h2>
          <p>
            Use of CostMini does not create a doctor-patient relationship. We do
            not prescribe medicines, provide diagnoses, or offer treatment
            recommendations. Our platform is designed to empower you with
            pricing information so you can have informed discussions with your
            healthcare provider.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">
            Emergency
          </h2>
          <p>
            If you are experiencing a medical emergency, call your local
            emergency number immediately. In India, dial <strong>112</strong> or{" "}
            <strong>108</strong> for emergency medical services.
          </p>
        </section>
      </div>
    </div>
  );
}
