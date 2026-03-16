import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for Truemeds.in
 *
 * Real API: GET https://nal.tmmumbai.in/CustomerService/getSearchSuggestion
 * Returns up to 40 suggestions with product codes
 * Product pages at /otc/{slug} have __NEXT_DATA__ with full details
 */
export class TruemedsScraper extends DrugScraper {
  source = "Truemeds";
  private baseUrl = "https://www.truemeds.in";
  private apiBase = "https://nal.tmmumbai.in/CustomerService";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      return await this.searchViaApi(query);
    } catch (error) {
      try {
        return await this.scrapeSearchPage(query);
      } catch {
        return {
          source: this.source,
          drugs: [],
          scrapedAt: new Date(),
          error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    }
  }

  private async searchViaApi(query: string): Promise<ScraperResult> {
    // Step 1: Get suggestions (no auth needed)
    const sugUrl = `${this.apiBase}/getSearchSuggestion?searchString=${encodeURIComponent(query)}`;
    const res = await fetch(sugUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json",
      },
    });

    if (!res.ok) throw new Error(`Truemeds API returned ${res.status}`);

    const data = await res.json();
    const suggestions = data.responseData?.suggestionWithType || [];
    const drugs: ScrapedDrug[] = [];

    // Step 2: For each SKU suggestion, scrape the product page for price data
    const skuSuggestions = suggestions
      .filter((s: { type: string; productCode: string | null }) =>
        s.type === "ORIGINAL_SKU_NAME" && s.productCode)
      .slice(0, 10); // Limit to 10 to avoid too many requests

    const productPromises = skuSuggestions.map(async (sug: { text: string; productCode: string }) => {
      try {
        const slug = `${sug.text.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${sug.productCode.toLowerCase()}`;
        const productUrl = `${this.baseUrl}/otc/${slug}`;
        const drug = await this.getDrugDetails(productUrl);
        if (drug) drugs.push(drug);
      } catch { /* skip individual failures */ }
    });

    await Promise.allSettled(productPromises);

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    // Try __NEXT_DATA__
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const nd = JSON.parse(nextDataScript);
        const state = nd.props?.pageProps?.initialState;
        const searchData = state?.searchMedsDataReducer?.searchMedData || [];
        for (const item of searchData) {
          if (item.name && item.mrp) {
            drugs.push({
              name: item.name || "",
              genericName: item.composition || item.genericName || "",
              manufacturer: item.manufacturer || "",
              composition: item.composition || "",
              packSize: item.packSize || "",
              mrp: item.mrp || 0,
              sellingPrice: item.sellingPrice || item.truemedPrice || item.mrp || 0,
              inStock: item.isInStock !== false,
              sourceUrl: item.slug ? `${this.baseUrl}/otc/${item.slug}` : "",
              imageUrl: item.imageUrl || item.image || undefined,
              prescriptionRequired: item.isPrescriptionRequired || false,
            });
          }
        }
      } catch { /* fallthrough */ }
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      // Try __NEXT_DATA__ for product data
      const nextDataScript = $("#__NEXT_DATA__").html();
      if (nextDataScript) {
        try {
          const nd = JSON.parse(nextDataScript);
          const pp = nd.props?.pageProps;
          const med = pp?.currentMed || pp?.medicineDetails || pp?.originalMedicineDetails;
          if (med) {
            const product = med.product || med;
            return {
              name: pp?.productName || product.productName || product.name || $("h1").first().text().trim(),
              genericName: product.composition || product.genericName || "",
              manufacturer: product.manufacturer || product.brandName || "",
              composition: product.composition || "",
              packSize: product.packSize || product.packQuantity || "",
              mrp: product.mrp || 0,
              sellingPrice: product.sellingPrice || product.truemedPrice || product.mrp || 0,
              inStock: product.isInStock !== false && product.isInStock !== 0,
              sourceUrl: url,
              imageUrl: product.imageUrl || product.image || undefined,
              prescriptionRequired: product.isPrescriptionRequired || false,
            };
          }
        } catch { /* fallthrough */ }
      }

      // Fallback: JSON-LD
      const jsonLdScripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < jsonLdScripts.length; i++) {
        try {
          const ld = JSON.parse($(jsonLdScripts[i]).html() || "{}");
          if (ld["@type"] === "Product") {
            return {
              name: ld.name || "",
              genericName: "",
              manufacturer: ld.manufacturer?.name || "",
              composition: "",
              packSize: "",
              mrp: ld.offers?.price || 0,
              sellingPrice: ld.offers?.price || 0,
              inStock: ld.offers?.availability?.includes("InStock") || true,
              sourceUrl: url,
              imageUrl: ld.image || undefined,
              prescriptionRequired: false,
            };
          }
        } catch { continue; }
      }

      const name = $("h1").first().text().trim();
      if (!name) return null;

      return {
        name,
        genericName: "",
        manufacturer: "",
        composition: "",
        packSize: "",
        mrp: 0,
        sellingPrice: 0,
        inStock: true,
        sourceUrl: url,
        prescriptionRequired: false,
      };
    } catch {
      return null;
    }
  }
}
