import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for MedPlus Mart (medplusmart.com)
 *
 * Strategy: MedPlus is a custom SPA. The search API requires full session
 * cookies from the SPA bootstrap. Product pages have JSON-LD data for SSR/SEO.
 *
 * Token API: POST /mart-common-api/generateToken (returns tokenId)
 * Product pages: /product/{NAME}/{SKU} with JSON-LD Product + Drug schemas
 */
export class MedPlusScraper extends DrugScraper {
  source = "MedPlus";
  private baseUrl = "https://www.medplusmart.com";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      return await this.scrapeSearchPage(query);
    } catch (error) {
      return {
        source: this.source,
        drugs: [],
        scrapedAt: new Date(),
        error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    // MedPlus search is a client-side SPA that doesn't render product data server-side
    // Instead, try fetching the search page and look for any server-rendered data
    const url = `${this.baseUrl}/searchProduct.mart?searchKey=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    // Method 1: Check for JSON-LD embedded data
    $('script[type="application/ld+json"]').each((_, script) => {
      try {
        const ld = JSON.parse($(script).html() || "{}");
        if (ld["@type"] === "Product" || ld["@type"] === "Drug") {
          drugs.push({
            name: ld.name || "",
            genericName: ld.activeIngredient || "",
            manufacturer: ld.manufacturer?.name || ld.brand || "",
            composition: ld.activeIngredient || "",
            packSize: ld.dosageForm || "",
            mrp: ld.offers?.price || 0,
            sellingPrice: ld.offers?.price || 0,
            inStock: ld.offers?.availability?.includes("InStock") || true,
            sourceUrl: url,
            imageUrl: ld.image || undefined,
            prescriptionRequired: ld.prescriptionStatus === "PrescriptionOnly",
          });
        }
      } catch { /* skip */ }
    });

    // Method 2: Check for embedded window data
    if (drugs.length === 0) {
      $("script").each((_, script) => {
        const content = $(script).html() || "";
        if (content.includes("searchProducts") || content.includes("productList")) {
          try {
            const match = content.match(/(?:searchProducts|productList)\s*[:=]\s*(\[[\s\S]*?\])/);
            if (match) {
              const products = JSON.parse(match[1]);
              for (const item of products) {
                drugs.push({
                  name: item.productName || item.name || "",
                  genericName: item.genericName || item.molecule || "",
                  manufacturer: item.manufacturer || item.brand || "",
                  composition: item.molecule || item.composition || "",
                  packSize: item.packSize || "",
                  mrp: item.mrp || item.price || 0,
                  sellingPrice: item.offeredPrice || item.sellingPrice || item.mrp || 0,
                  inStock: item.isInStock !== false,
                  sourceUrl: item.url || `${this.baseUrl}/product/${item.slug || ""}`,
                  imageUrl: item.imageUrl || undefined,
                  prescriptionRequired: item.isPrescription || false,
                });
              }
            }
          } catch { /* skip */ }
        }
      });
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      let name = "";
      let manufacturer = "";
      let composition = "";
      let mrp = 0;
      let sellingPrice = 0;
      let imageUrl: string | undefined;
      let prescriptionRequired = false;
      let packSize = "";

      // Extract from JSON-LD (reliable for MedPlus product pages)
      $('script[type="application/ld+json"]').each((_, script) => {
        try {
          const ld = JSON.parse($(script).html() || "{}");
          if (ld["@type"] === "Product") {
            name = ld.name || name;
            manufacturer = ld.brand || manufacturer;
            mrp = ld.offers?.price || mrp;
            sellingPrice = ld.offers?.price || sellingPrice;
            imageUrl = ld.image || imageUrl;
          }
          if (ld["@type"] === "Drug") {
            composition = ld.activeIngredient || composition;
            packSize = ld.dosageForm || packSize;
            prescriptionRequired = ld.prescriptionStatus === "PrescriptionOnly";
            manufacturer = ld.manufacturer?.name || manufacturer;
          }
        } catch { /* skip */ }
      });

      if (!name) {
        name = $("h1").first().text().trim();
      }
      if (!name) return null;

      return {
        name,
        genericName: composition.split("+")[0]?.trim() || "",
        manufacturer,
        composition,
        packSize,
        mrp,
        sellingPrice: sellingPrice || mrp,
        inStock: true,
        sourceUrl: url,
        imageUrl,
        prescriptionRequired,
      };
    } catch {
      return null;
    }
  }
}
