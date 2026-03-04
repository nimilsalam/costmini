import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for Netmeds.com
 *
 * Strategy: Uses Netmeds' autocomplete/search API endpoint which returns JSON.
 * Falls back to HTML scraping of the catalog search results page.
 *
 * Note: In production, respect rate limits and robots.txt.
 */
export class NetmedsScraper extends DrugScraper {
  source = "Netmeds";
  private baseUrl = "https://www.netmeds.com";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      // Try Netmeds autocomplete/search API first
      const apiUrl = `${this.baseUrl}/microsvc/search/auto/${encodeURIComponent(query)}`;

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

      // Fallback: HTML scraping of catalog search page
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
      (data.payLoad as Record<string, unknown>)?.products as Array<
        Record<string, unknown>
      > ||
      (data.data as Array<Record<string, unknown>>) ||
      [];

    for (const item of products) {
      try {
        drugs.push({
          name: (item.product_name as string) || (item.name as string) || "",
          genericName:
            (item.generic_name as string) ||
            (item.molecule as string) ||
            "",
          manufacturer:
            (item.manufacturer_name as string) ||
            (item.brand as string) ||
            "",
          composition: (item.molecule as string) || (item.salt as string) || "",
          packSize: (item.pack_size as string) || "",
          mrp: (item.mrp as number) || 0,
          sellingPrice:
            (item.best_price as number) ||
            (item.final_price as number) ||
            (item.mrp as number) ||
            0,
          inStock: (item.available as boolean) !== false,
          sourceUrl: item.slug
            ? `${this.baseUrl}/${item.slug}`
            : (item.url as string) || "",
          imageUrl: (item.image_url as string) || (item.product_image as string) || undefined,
          prescriptionRequired:
            (item.is_rx as boolean) ||
            (item.rx_required as boolean) ||
            false,
        });
      } catch {
        continue;
      }
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    const url = `${this.baseUrl}/catalogsearch/result/${encodeURIComponent(query)}/all`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    $("[class*='product-card'], .ais-InfiniteHits-item, [class*='catalogCard']").each(
      (_, el) => {
        try {
          const $el = $(el);
          const name = $el
            .find("[class*='product-name'], [class*='productName'], h3, h2")
            .first()
            .text()
            .trim();
          const priceText = $el
            .find("[class*='final-price'], [class*='best-price'], [class*='selling-price']")
            .first()
            .text();
          const mrpText = $el
            .find("[class*='striked'], [class*='original-price'], [class*='mrp']")
            .first()
            .text();
          const manufacturer = $el
            .find("[class*='manufacturer'], [class*='brand-name']")
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
        "[class*='manufacturer'], [class*='drug-manu'], [class*='brand-name']"
      )
        .text()
        .trim();
      const composition = $(
        "[class*='drug-molecule'], [class*='salt-name'], [class*='composition']"
      )
        .first()
        .text()
        .trim();
      const priceText = $(
        "[class*='final-price'], [class*='best-price'], [class*='our-price']"
      )
        .first()
        .text();
      const mrpText = $(
        "[class*='striked-price'], [class*='original-price'], [class*='mrp']"
      )
        .first()
        .text();
      const packSize = $("[class*='pack-size'], [class*='drug-qty']")
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
