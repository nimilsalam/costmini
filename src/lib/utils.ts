import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/* ---- Original CostMini utilities ---- */

export function formatPrice(price: number): string {
  return `₹${price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function calcSavings(mrp: number, sellingPrice: number): number {
  if (mrp <= 0 || sellingPrice >= mrp) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function whatsappShareUrl(text: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
}

export function whatsappDrugShareText(
  name: string,
  mrp: number,
  sellingPrice: number,
  savings: number,
): string {
  return `💊 ${name} — From ${formatPrice(sellingPrice)}${savings > 0 ? ` (${savings}% off MRP ${formatPrice(mrp)})` : ""} on CostMini!\nCompare prices & find generics: costmini.in/medicines`;
}
