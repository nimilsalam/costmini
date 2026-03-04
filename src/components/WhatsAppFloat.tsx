"use client";

import { MessageCircle } from "lucide-react";

export function WhatsAppFloat() {
  const message = encodeURIComponent(
    "Hi! I want to find cheaper medicine alternatives on CostMini."
  );
  const whatsappUrl = `https://wa.me/?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-green-500 text-white shadow-lg hover:bg-green-600 hover:shadow-xl transition-all group"
      aria-label="Share on WhatsApp"
    >
      <MessageCircle size={22} className="fill-white" />
      <span className="hidden sm:inline text-sm font-semibold">
        Share & Save
      </span>
    </a>
  );
}
