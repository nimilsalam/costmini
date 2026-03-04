import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for Flipkart Health+ (health-plus marketplace on Flipkart)
 *
 * Strategy: Scrapes Flipkart search results filtered to the Health+ marketplace.
 * Uses HTML scraping since Flipkart does not expose a public JSON API.
 *
 * Note: In production, respect rate limits and robots.txt.
 */
export class FlipkartHealthScraper extends DrugScraper {
  source = "FlipkartHealth";
  private baseUrl = "https://www.flipkart.com";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      // Flipkart Health+ search via marketplace filter
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&otracker=search&marketplace=FLIPKART_HEALTH_PLUS`;

      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9",
        },
      });

      if (res.ok) {
        const html = await res.text();
        return this.parseSearchHtml(html);
      }

      // Fallback: try the health-plus sub-path
      return this.scrapeHealthPlusPage(query);
    } catch (error) {
      return {
        source: this.source,
        drugs: [],
        scrapedAt: new Date(),
        error: `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  private parseSearchHtml(html: string): ScraperResult {
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    $(
      "[data-id], ._1AtVbE, [class*='product-card'], [data-component-type='s-search-result']"
    ).each((_, el) => {
      try {
        const $el = $(el);
        const name = $el
          .find("[class*='_4rR01T'], [class*='IRpwTa'], a[title], [class*='product-name']")
          .first()
          .text()
          .trim();
        const priceText = $el
          .find("[class*='_30jeq3'], [class*='selling-price'], [class*='price']")
          .first()
          .text();
        const mrpText = $el
          .find("[class*='_3I9_wc'], [class*='striked'], [class*='original-price']")
          .first()
          .text();
        const link = $el.find("a[href*='/']").attr("href") || "";
        const imgUrl =
          $el.find("img[src*='http']").attr("src") || undefined;

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
            sourceUrl: link.startsWith("http")
              ? link
              : `${this.baseUrl}${link}`,
            imageUrl: imgUrl,
            prescriptionRequired: false,
          });
        }
      } catch {
        // skip malformed entries
      }
    });

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeHealthPlusPage(
    query: string
  ): Promise<ScraperResult> {
    const url = `${this.baseUrl}/health-plus/search?q=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    return this.parseSearchHtml(html);
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      const name = $("h1, [class*='B_NuCI']").first().text().trim();
      const manufacturer = $(
        "[class*='manufacturer'], [class*='brand-name'], span:contains('Manufacturer')"
      )
        .next()
        .text()
        .trim();
      const composition = $(
        "[class*='composition'], [class*='salt-info'], [class*='key-feature']"
      )
        .first()
        .text()
        .trim();
      const priceText = $(
        "[class*='_30jeq3'], [class*='selling-price'], [class*='price']"
      )
        .first()
        .text();
      const mrpText = $(
        "[class*='_3I9_wc'], [class*='striked-price'], [class*='mrp']"
      )
        .first()
        .text();
      const packSize = $(
        "[class*='pack-size'], [class*='quantity'], [class*='unit']"
      )
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
