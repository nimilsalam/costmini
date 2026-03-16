"use client";

import { Share2 } from "lucide-react";

export function WhatsAppFloat() {
  const message = encodeURIComponent(
    "Check out CostMini — compare medicine prices across 8 pharmacies and save up to 80% with generics! costmini.in"
  );
  const whatsappUrl = `https://api.whatsapp.com/send?text=${message}`;

  return (
    <a
      href={whatsappUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Share on WhatsApp"
      className="fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-foreground/80 hover:bg-foreground text-background flex items-center justify-center transition-colors shadow-sm"
    >
      <Share2 size={16} />
    </a>
  );
}
