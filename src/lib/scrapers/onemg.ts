import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for 1mg.com (Tata 1mg)
 *
 * Real API: GET /pwa-dweb-api/api/v4/search/all
 * Requires custom headers: x-1mglabs-platform, hkp-platform, x-access-key, accept
 * Supports pagination via scroll_id and page_number
 */
export class OneMgScraper extends DrugScraper {
  source = "1mg";
  private baseUrl = "https://www.1mg.com";
  private apiBase = "https://www.1mg.com/pwa-dweb-api/api/v4";

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
    const url = `${this.apiBase}/search/all?q=${encodeURIComponent(query)}&city=New%20Delhi&filter=&page_number=0&scroll_id=&per_page=40&types=sku,allopathy&sort=relevance&fetch_eta=true&is_city_serviceable=true`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/vnd.healthkartplus.v4+json",
        "x-1mglabs-platform": "dWeb",
        "x-platform": "desktop-0.0.1",
        "hkp-platform": "Healthkartplus-0.0.1-desktopweb",
        "x-access-key": "1mg_client_access_key",
        "x-city": "New Delhi",
        "locale": "en",
      },
    });

    if (!res.ok) throw new Error(`1mg API returned ${res.status}`);

    const data = await res.json();
    const drugs: ScrapedDrug[] = [];

    const searchResults = data.data?.search_results || [];

    for (const result of searchResults) {
      // Process SKU results (actual products)
      if (result.type === "sku" && result.skus) {
        for (const item of result.skus) {
          try {
            drugs.push({
              name: item.name || "",
              genericName: item.compositions || item.salt_name || "",
              manufacturer: item.manufacturer_name || "",
              composition: item.compositions || "",
              packSize: item.pack_size || "",
              mrp: item.mrp || 0,
              sellingPrice: item.price || item.mrp || 0,
              inStock: item.is_in_stock !== false,
              sourceUrl: item.slug ? `${this.baseUrl}${item.slug}` : "",
              imageUrl: item.image || undefined,
              prescriptionRequired: item.rx_required || false,
            });
          } catch { continue; }
        }
      }

      // Process individual drug results (new API format: prices as formatted strings)
      if (result.type === "drug" || result.type === "otc") {
        try {
          const item = result;
          const prices = item.prices || {};
          const mrpNum = typeof item.mrp === "number" ? item.mrp : this.parsePrice(prices.mrp || "");
          const priceNum = typeof item.price === "number" ? item.price : this.parsePrice(prices.discounted_price || prices.mrp || "");
          if (item.name && (mrpNum || priceNum)) {
            drugs.push({
              name: item.name || "",
              genericName: item.compositions || item.salt_name || "",
              manufacturer: item.manufacturer_name || "",
              composition: item.compositions || "",
              packSize: item.pack_size || item.label || "",
              mrp: mrpNum || priceNum,
              sellingPrice: priceNum || mrpNum,
              inStock: item.available !== false && item.is_in_stock !== false,
              sourceUrl: item.url ? `${this.baseUrl}${item.url}` : (item.slug ? `${this.baseUrl}${item.slug}` : ""),
              imageUrl: item.image || undefined,
              prescriptionRequired: item.rx_required || false,
            });
          }
        } catch { /* skip */ }
      }
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    const url = `${this.baseUrl}/search/all?name=${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    // Extract from __NEXT_DATA__ or embedded JSON if available
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const nd = JSON.parse(nextDataScript);
        const searchData = nd.props?.pageProps?.searchData || nd.props?.pageProps;
        const results = searchData?.search_results || searchData?.data?.search_results || [];
        for (const result of results) {
          if (result.type === "sku" && result.skus) {
            for (const s of result.skus) {
              if (s.name && (s.price || s.mrp)) {
                drugs.push({
                  name: s.name,
                  genericName: s.compositions || "",
                  manufacturer: s.manufacturer_name || "",
                  composition: s.compositions || "",
                  packSize: s.pack_size || "",
                  mrp: s.mrp || 0,
                  sellingPrice: s.price || s.mrp || 0,
                  inStock: s.is_in_stock !== false,
                  sourceUrl: s.slug ? `${this.baseUrl}${s.slug}` : "",
                  imageUrl: s.image || undefined,
                  prescriptionRequired: s.rx_required || false,
                });
              }
            }
          }
        }
      } catch { /* parse error, continue with DOM scraping */ }
    }

    if (drugs.length === 0) {
      $("[class*='product-card'], [class*='style__product']").each((_, el) => {
        try {
          const $el = $(el);
          const name = $el.find("[class*='product-name'], [class*='pro-title'], h2, h3").first().text().trim();
          const priceText = $el.find("[class*='price-tag'], [class*='price']").first().text();
          const mrpText = $el.find("[class*='striked'], [class*='mrp']").first().text();
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
        } catch { /* skip */ }
      });
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      // Try __NEXT_DATA__ first
      const nextDataScript = $("#__NEXT_DATA__").html();
      if (nextDataScript) {
        try {
          const nd = JSON.parse(nextDataScript);
          const product = nd.props?.pageProps?.productData || nd.props?.pageProps?.drug;
          if (product) {
            return {
              name: product.name || $("h1").first().text().trim(),
              genericName: product.compositions || product.salt_name || "",
              manufacturer: product.manufacturer_name || "",
              composition: product.compositions || "",
              packSize: product.pack_size || "",
              mrp: product.mrp || 0,
              sellingPrice: product.price || product.mrp || 0,
              inStock: product.is_in_stock !== false,
              sourceUrl: url,
              imageUrl: product.image || undefined,
              prescriptionRequired: product.rx_required || false,
            };
          }
        } catch { /* fallthrough to DOM parsing */ }
      }

      const name = $("h1").first().text().trim();
      if (!name) return null;

      const priceText = $("[class*='DrugPriceBox__price'], [class*='price-tag']").first().text();
      const mrpText = $("[class*='DrugPriceBox__slashed'], [class*='striked-price']").first().text();

      return {
        name,
        genericName: "",
        manufacturer: $("[class*='manufacturer']").text().trim(),
        composition: $("[class*='salt-name']").first().text().trim(),
        packSize: $("[class*='pack-size']").text().trim(),
        mrp: this.parsePrice(mrpText) || this.parsePrice(priceText),
        sellingPrice: this.parsePrice(priceText),
        inStock: true,
        sourceUrl: url,
        prescriptionRequired: $("[class*='prescription']").length > 0,
      };
    } catch {
      return null;
    }
  }
}
