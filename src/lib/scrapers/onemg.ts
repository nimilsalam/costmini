import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for 1mg.com (Tata 1mg)
 *
 * Strategy: Uses 1mg's search API endpoint which returns JSON.
 * Falls back to HTML scraping if API changes.
 *
 * Note: In production, respect rate limits and robots.txt.
 * Consider using their official API if available.
 */
export class OneMgScraper extends DrugScraper {
  source = "1mg";
  private baseUrl = "https://www.1mg.com";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      // 1mg has a search API endpoint
      const apiUrl = `${this.baseUrl}/pharmacy_api_gateway/v4/drug/search?name=${encodeURIComponent(query)}&page=1&per_page=20`;

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

    const results = (data.data as Record<string, unknown>)?.results as Array<Record<string, unknown>> || [];
    for (const item of results) {
      try {
        drugs.push({
          name: (item.name as string) || "",
          genericName: (item.salt_name as string) || (item.generic_name as string) || "",
          manufacturer: (item.manufacturer_name as string) || "",
          composition: (item.salt_name as string) || "",
          packSize: (item.pack_size as string) || "",
          mrp: (item.mrp as number) || 0,
          sellingPrice: (item.price as number) || (item.mrp as number) || 0,
          inStock: (item.is_in_stock as boolean) !== false,
          sourceUrl: `${this.baseUrl}${item.slug || ""}`,
          imageUrl: (item.image_url as string) || undefined,
          prescriptionRequired: (item.rx_required as boolean) || false,
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

    $(".style__product-card___1gbex, .style__horizontal-card___1Cwsg, [class*='product-card']").each(
      (_, el) => {
        try {
          const $el = $(el);
          const name = $el.find("[class*='product-name'], .style__pro-title___3G3rr").text().trim();
          const priceText = $el.find("[class*='price'], .style__price-tag___B2csA").first().text();
          const mrpText = $el.find("[class*='striked'], [class*='mrp']").first().text();
          const manufacturer = $el.find("[class*='manufacturer']").text().trim();
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
              sourceUrl: link.startsWith("http") ? link : `${this.baseUrl}${link}`,
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
      const manufacturer = $("[class*='manufacturer'], .DrugHeader__manufacturer___2oB1_")
        .text()
        .trim();
      const composition = $("[class*='salt-name'], .DrugHeader__meta-value___vqYM0")
        .first()
        .text()
        .trim();
      const priceText = $("[class*='DrugPriceBox__price'], [class*='price-tag']")
        .first()
        .text();
      const mrpText = $("[class*='DrugPriceBox__slashed'], [class*='striked-price']")
        .first()
        .text();
      const packSize = $("[class*='DrugPriceBox__unit'], [class*='pack-size']")
        .text()
        .trim();
      const rxRequired = $("[class*='prescription']").length > 0;

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
