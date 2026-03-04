export function formatPrice(price: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function calcSavings(mrp: number, sellingPrice: number): number {
  if (mrp <= 0) return 0;
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function whatsappShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function whatsappDrugShareText(
  drugName: string,
  brandPrice: number,
  genericPrice: number,
  savings: number
): string {
  return `💊 CostMini Alert!\n\n${drugName}\nBrand Price: ₹${brandPrice}\nGeneric Price: ₹${genericPrice}\nYou Save: ${savings}%\n\nScan your prescription & save: ${typeof window !== "undefined" ? window.location.origin : "https://costmini.in"}/scan`;
}
