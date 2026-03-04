import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for MedPlus Mart (medplusmart.com)
 *
 * Strategy: Uses MedPlus' search API endpoint which returns JSON.
 * Falls back to HTML scraping of the search results page.
 *
 * Note: In production, respect rate limits and robots.txt.
 */
export class MedPlusScraper extends DrugScraper {
  source = "MedPlus";
  private baseUrl = "https://www.medplusmart.com";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      // Try MedPlus search API first
      const apiUrl = `${this.baseUrl}/api/search?q=${encodeURIComponent(query)}`;

      const res = await fetch(apiUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept: "application/json",
          "Accept-Language": "en-IN,en;q=0.9",
        },
      });

      if (res.ok) {
        const data = await res.json();
        return this.parseApiResponse(data);
      }

      // Fallback: HTML scraping
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

    const products =
      (data.data as Record<string, unknown>)?.products as Array<
        Record<string, unknown>
      > ||
      (data.products as Array<Record<string, unknown>>) ||
      (data.results as Array<Record<string, unknown>>) ||
      [];

    for (const item of products) {
      try {
        drugs.push({
          name: (item.name as string) || (item.productName as string) || "",
          genericName:
            (item.genericName as string) ||
            (item.saltName as string) ||
            "",
          manufacturer:
            (item.manufacturerName as string) ||
            (item.manufacturer as string) ||
            (item.brand as string) ||
            "",
          composition:
            (item.composition as string) ||
            (item.saltName as string) ||
            "",
          packSize: (item.packSize as string) || (item.unitOfMeasure as string) || "",
          mrp: (item.mrp as number) || (item.price as number) || 0,
          sellingPrice:
            (item.sellingPrice as number) ||
            (item.salePrice as number) ||
            (item.offeredPrice as number) ||
            (item.mrp as number) ||
            0,
          inStock: (item.isInStock as boolean) !== false,
          sourceUrl: item.slug
            ? `${this.baseUrl}/product/${item.slug}`
            : (item.url as string) || "",
          imageUrl: (item.imageUrl as string) || (item.image as string) || undefined,
          prescriptionRequired:
            (item.isPrescriptionRequired as boolean) ||
            (item.rxRequired as boolean) ||
            false,
        });
      } catch {
        continue;
      }
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    const url = `${this.baseUrl}/search-medicines?q=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    $("[class*='ProductCard'], [class*='product-card'], [class*='product-item']").each(
      (_, el) => {
        try {
          const $el = $(el);
          const name = $el
            .find("[class*='productName'], [class*='product-title'], h2, h3")
            .first()
            .text()
            .trim();
          const priceText = $el
            .find("[class*='sellingPrice'], [class*='sale-price'], [class*='our-price']")
            .first()
            .text();
          const mrpText = $el
            .find("[class*='striked'], [class*='actual-price'], [class*='mrp']")
            .first()
            .text();
          const manufacturer = $el
            .find("[class*='manufacturer'], [class*='brand']")
            .text()
            .trim();
          const link = $el.find("a").attr("href") || "";

          if (name && priceText) {
            drugs.push({
              name,
              genericName: "",
              manufacturer,
              composition: "",
              packSize: "",
              mrp: this.parsePrice(mrpText) || this.parsePrice(priceText),
              sellingPrice: this.parsePrice(priceText),
              inStock: true,
              sourceUrl: link.startsWith("http")
                ? link
                : `${this.baseUrl}${link}`,
              prescriptionRequired: false,
            });
          }
        } catch {
          // skip malformed entries
        }
      }
    );

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      const name = $("h1").first().text().trim();
      const manufacturer = $(
        "[class*='manufacturer'], [class*='brand-name'], [class*='mfr-name']"
      )
        .text()
        .trim();
      const composition = $(
        "[class*='composition'], [class*='salt-info'], [class*='generic-name']"
      )
        .first()
        .text()
        .trim();
      const priceText = $(
        "[class*='sellingPrice'], [class*='sale-price'], [class*='our-price']"
      )
        .first()
        .text();
      const mrpText = $(
        "[class*='striked-price'], [class*='actual-price'], [class*='mrp']"
      )
        .first()
        .text();
      const packSize = $("[class*='pack-size'], [class*='quantity'], [class*='unit']")
        .text()
        .trim();
      const rxRequired =
        $("[class*='prescription'], [class*='rx-required']").length > 0;

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
        prescriptionRequired: rxRequired,
      };
    } catch {
      return null;
    }
  }
}
