import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for PharmEasy.in
 *
 * Strategy: Uses PharmEasy's search API endpoint.
 * Falls back to HTML scraping if needed.
 */
export class PharmEasyScraper extends DrugScraper {
  source = "PharmEasy";
  private baseUrl = "https://pharmeasy.in";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      // PharmEasy search API
      const apiUrl = `${this.baseUrl}/api/search/search?q=${encodeURIComponent(query)}&page=1&category=medicine`;

      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
        },
      });

      if (res.ok) {
        const data = await res.json();
        return this.parseApiResponse(data);
      }

      return this.scrapeSearchPage(query);
    } catch (error) {
      return {
        source: this.source,
        drugs: [],
        scrapedAt: new Date(),
        error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private parseApiResponse(data: Record<string, unknown>): ScraperResult {
    const drugs: ScrapedDrug[] = [];
    const products = (data.data as Record<string, unknown>)?.products as Array<Record<string, unknown>> || [];

    for (const item of products) {
      try {
        // PharmEasy API uses mrpDecimal/salePriceDecimal (strings) for prices
        const mrpStr = (item.mrpDecimal as string) || "";
        const saleStr = (item.salePriceDecimal as string) || "";
        const mrp = parseFloat(mrpStr) || (item.mrp as number) || 0;
        const sellingPrice = parseFloat(saleStr) || (item.salePrice as number) || mrp;

        // Availability is nested in productAvailabilityFlags
        const availFlags = item.productAvailabilityFlags as Record<string, unknown> | undefined;
        const isAvailable = availFlags?.isAvailable !== false;

        // Image from damImages array or image field
        const damImages = item.damImages as Array<Record<string, string>> | undefined;
        const imageUrl = (item.image as string) || damImages?.[0]?.url || undefined;

        drugs.push({
          name: (item.name as string) || "",
          genericName: (item.moleculeName as string) || (item.saltName as string) || (item.genericName as string) || "",
          manufacturer: (item.manufacturer as string) || (item.manufacturerName as string) || "",
          composition: (item.moleculeName as string) || (item.saltName as string) || "",
          packSize: (item.measurementUnit as string) || (item.packSize as string) || "",
          mrp,
          sellingPrice,
          inStock: isAvailable,
          sourceUrl: `${this.baseUrl}/online-medicine-order/${item.slug || ""}`,
          imageUrl,
          prescriptionRequired: (item.isRxRequired as number) === 1 || (item.isPrescriptionRequired as boolean) || false,
        });
      } catch {
        continue;
      }
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    const url = `${this.baseUrl}/search/all?name=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    $("[class*='ProductCard'], [class*='product-card']").each((_, el) => {
      try {
        const $el = $(el);
        const name = $el.find("[class*='ProductCard_medicineName'], h1, h2").first().text().trim();
        const priceText = $el.find("[class*='ProductCard_ourPrice'], [class*='selling-price']").first().text();
        const mrpText = $el.find("[class*='ProductCard_striked'], [class*='mrp']").first().text();
        const link = $el.find("a").attr("href") || "";

        if (name && priceText) {
          drugs.push({
            name,
            genericName: "",
            manufacturer: "",
            composition: "",
            packSize: "",
            mrp: this.parsePrice(mrpText) || this.parsePrice(priceText),
            sellingPrice: this.parsePrice(priceText),
            inStock: true,
            sourceUrl: link.startsWith("http") ? link : `${this.baseUrl}${link}`,
            prescriptionRequired: false,
          });
        }
      } catch {
        // skip
      }
    });

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      const name = $("h1").first().text().trim();
      const manufacturer = $("[class*='MedicineOverview_manufacturer']").text().trim();
      const composition = $("[class*='saltInfo'], [class*='MedicineOverview_content']").first().text().trim();
      const priceText = $("[class*='PriceInfo_ourPrice'], [class*='finalPrice']").first().text();
      const mrpText = $("[class*='PriceInfo_striked'], [class*='mrp']").first().text();
      const packSize = $("[class*='PriceInfo_packSize']").text().trim();

      if (!name) return null;

      return {
        name,
        genericName: composition.split("+")[0]?.trim() || "",
        manufacturer,
        composition,
        packSize,
        mrp: this.parsePrice(mrpText) || this.parsePrice(priceText),
        sellingPrice: this.parsePrice(priceText),
        inStock: true,
        sourceUrl: url,
        prescriptionRequired: false,
      };
    } catch {
      return null;
    }
  }
}
