"use client";

import { useState } from "react";
import { Mail, MessageCircle, MapPin, Send } from "lucide-react";

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, send to API / email service
    setSubmitted(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Us</h1>
      <p className="text-gray-500 mb-10">
        Have questions, feedback, or partnership inquiries? We&apos;d love to
        hear from you.
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="p-5 rounded-xl border border-gray-200 text-center">
          <Mail size={28} className="mx-auto text-[var(--color-primary)] mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Email</h3>
          <p className="text-sm text-gray-500">hello@costmini.in</p>
        </div>
        <div className="p-5 rounded-xl border border-gray-200 text-center">
          <MessageCircle size={28} className="mx-auto text-green-500 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">WhatsApp</h3>
          <p className="text-sm text-gray-500">+91 XXXXX XXXXX</p>
        </div>
        <div className="p-5 rounded-xl border border-gray-200 text-center">
          <MapPin size={28} className="mx-auto text-blue-500 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Location</h3>
          <p className="text-sm text-gray-500">India</p>
        </div>
      </div>

      {submitted ? (
        <div className="bg-green-50 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Send size={28} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Message Sent!
          </h2>
          <p className="text-gray-500">
            Thank you for reaching out. We&apos;ll get back to you within 24
            hours.
          </p>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name
              </label>
              <input
                type="text"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm"
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <select className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm bg-white">
              <option>General Inquiry</option>
              <option>Report Wrong Price</option>
              <option>Partnership / Business</option>
              <option>Bug Report</option>
              <option>Feature Request</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Message
            </label>
            <textarea
              required
              rows={5}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-[var(--color-primary)] focus:ring-1 focus:ring-[var(--color-primary)] outline-none text-sm resize-none"
              placeholder="How can we help?"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-8 py-3 rounded-lg bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary-dark)] transition-colors flex items-center gap-2 justify-center"
          >
            <Send size={18} />
            Send Message
          </button>
        </form>
      )}
    </div>
  );
}
