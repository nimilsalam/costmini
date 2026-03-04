import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for Amazon Pharmacy India (amazon.in Health & Personal Care)
 *
 * Strategy: Scrapes Amazon.in search results filtered to the HPC category.
 * Amazon does not expose a public JSON API, so this relies on HTML scraping.
 *
 * Note: In production, respect rate limits and robots.txt.
 * Amazon is aggressive with bot detection; consider using their Product API.
 */
export class AmazonPharmacyScraper extends DrugScraper {
  source = "AmazonPharmacy";
  private baseUrl = "https://www.amazon.in";

  async searchDrugs(query: string): Promise<ScraperResult> {
    try {
      // Amazon search filtered to Health & Personal Care category
      const searchUrl = `${this.baseUrl}/s?k=${encodeURIComponent(query)}&i=hpc`;

      const res = await fetch(searchUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-IN,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
        },
      });

      if (res.ok) {
        const html = await res.text();
        return this.parseSearchHtml(html);
      }

      // Fallback: try without category filter
      return this.scrapeGenericSearch(query);
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
      ".s-result-item[data-asin], [data-component-type='s-search-result']"
    ).each((_, el) => {
      try {
        const $el = $(el);
        const asin = $el.attr("data-asin");

        // Skip ads and non-product items
        if (!asin || $el.find("[class*='AdHolder']").length > 0) return;

        const name = $el
          .find(
            "h2 a span, h2 span, [class*='a-text-normal'], [class*='product-title']"
          )
          .first()
          .text()
          .trim();
        const priceWhole = $el.find(".a-price-whole").first().text().trim();
        const priceFraction = $el
          .find(".a-price-fraction")
          .first()
          .text()
          .trim();
        const priceText = priceWhole
          ? `${priceWhole}${priceFraction ? "." + priceFraction : ""}`
          : "";
        const mrpText = $el
          .find(
            ".a-price[data-a-strike] .a-offscreen, [class*='a-text-price'] .a-offscreen"
          )
          .first()
          .text();
        const link = $el.find("h2 a, a[class*='a-link-normal']").attr("href") || "";
        const imgUrl =
          $el.find("img.s-image, img[data-image-latency]").attr("src") ||
          undefined;

        if (name && priceText) {
          drugs.push({
            name,
            genericName: "",
            manufacturer: "",
            composition: "",
            packSize: "",
            mrp: this.parsePrice(mrpText) || this.parsePrice(priceText),
            sellingPrice: this.parsePrice(priceText),
            inStock: !$el.text().includes("Currently unavailable"),
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

  private async scrapeGenericSearch(
    query: string
  ): Promise<ScraperResult> {
    const url = `${this.baseUrl}/s?k=${encodeURIComponent(query + " medicine")}&i=hpc`;
    const html = await this.fetchPage(url);
    return this.parseSearchHtml(html);
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      const name = $("#productTitle, #title, h1").first().text().trim();
      const manufacturer = $(
        "#bylineInfo, [class*='brand'], a#brand"
      )
        .text()
        .trim()
        .replace(/^(Brand:|Visit the |Store)/, "")
        .trim();
      const composition = $(
        "[class*='composition'], #important-information, [class*='ingredient']"
      )
        .first()
        .text()
        .trim();
      const priceText = $(
        "#priceblock_ourprice, #priceblock_dealprice, .a-price .a-offscreen, #corePrice_feature_div .a-offscreen"
      )
        .first()
        .text();
      const mrpText = $(
        "#priceblock_listprice, .a-price[data-a-strike] .a-offscreen, [class*='basisPrice'] .a-offscreen"
      )
        .first()
        .text();
      const packSize = $(
        "#variation_size_name .selection, [class*='pack-size'], #productSubtitle"
      )
        .text()
        .trim();
      const availability = $("#availability, #outOfStock").text().trim();
      const inStock = !availability.toLowerCase().includes("unavailable");

      if (!name) return null;

      return {
        name,
        genericName: "",
        manufacturer,
        composition,
        packSize,
        mrp: this.parsePrice(mrpText) || this.parsePrice(priceText),
        sellingPrice: this.parsePrice(priceText),
        inStock,
        sourceUrl: url,
        prescriptionRequired: false,
      };
    } catch {
      return null;
    }
  }
}
