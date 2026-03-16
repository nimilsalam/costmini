import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for Netmeds.com
 *
 * Strategy: Netmeds renders search results server-side with a Redux initial state
 * embedded in the page. Scrape the catalog search HTML page and extract product
 * data from the __INITIAL_STATE__ or DOM elements.
 *
 * Search URL: /catalogsearch/result/{query}/all
 * API paths require session cookies (403 without them)
 */
export class NetmedsScraper extends DrugScraper {
  source = "Netmeds";
  private baseUrl = "https://www.netmeds.com";

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
    const url = `${this.baseUrl}/catalogsearch/result/${encodeURIComponent(query)}/all`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    // Method 1: Extract from __NEXT_DATA__ (Next.js SSR)
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const nd = JSON.parse(nextDataScript);
        const pageProps = nd.props?.pageProps || {};

        // Check various possible data locations
        const productList = pageProps.productListingData?.products ||
          pageProps.searchData?.products ||
          pageProps.products ||
          [];

        for (const item of productList) {
          try {
            drugs.push({
              name: item.product_name || item.name || "",
              genericName: item.generic_name || item.molecule || item.salt || "",
              manufacturer: item.manufacturer_name || item.brand || item.manufacturer || "",
              composition: item.molecule || item.salt || item.composition || "",
              packSize: item.pack_size || item.unit_of_measure || "",
              mrp: item.mrp || 0,
              sellingPrice: item.best_price || item.final_price || item.selling_price || item.mrp || 0,
              inStock: item.available !== false && item.is_available !== false,
              sourceUrl: item.slug ? `${this.baseUrl}/${item.slug}` : "",
              imageUrl: item.image_url || item.product_image || undefined,
              prescriptionRequired: item.is_rx === true || item.rx_required === true,
            });
          } catch { continue; }
        }
      } catch { /* parse error, continue to DOM scraping */ }
    }

    // Method 2: Extract from inline script with initial state
    if (drugs.length === 0) {
      $("script").each((_, script) => {
        const content = $(script).html() || "";
        if (content.includes("__INITIAL_STATE__") || content.includes("window.__PRELOADED_STATE__")) {
          try {
            const match = content.match(/(?:__INITIAL_STATE__|__PRELOADED_STATE__)\s*=\s*({[\s\S]*?});?\s*(?:<\/script>|$)/);
            if (match) {
              const state = JSON.parse(match[1]);
              const products = state.productListingPage?.productlists?.data ||
                state.searchPage?.results ||
                [];
              for (const item of products) {
                if (item.product_name || item.name) {
                  drugs.push({
                    name: item.product_name || item.name || "",
                    genericName: item.generic_name || item.molecule || "",
                    manufacturer: item.manufacturer_name || item.brand || "",
                    composition: item.molecule || item.salt || "",
                    packSize: item.pack_size || "",
                    mrp: item.mrp || 0,
                    sellingPrice: item.best_price || item.final_price || item.mrp || 0,
                    inStock: item.available !== false,
                    sourceUrl: item.slug ? `${this.baseUrl}/${item.slug}` : "",
                    imageUrl: item.image_url || undefined,
                    prescriptionRequired: item.is_rx || false,
                  });
                }
              }
            }
          } catch { /* skip */ }
        }
      });
    }

    // Method 3: DOM scraping fallback
    if (drugs.length === 0) {
      $("[class*='product-card'], .ais-InfiniteHits-item, [class*='catalogCard']").each((_, el) => {
        try {
          const $el = $(el);
          const name = $el.find("[class*='product-name'], [class*='productName'], h3, h2").first().text().trim();
          const priceText = $el.find("[class*='final-price'], [class*='best-price'], [class*='selling-price']").first().text();
          const mrpText = $el.find("[class*='striked'], [class*='original-price'], [class*='mrp']").first().text();
          const manufacturer = $el.find("[class*='manufacturer'], [class*='brand-name']").text().trim();
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
        } catch { /* skip */ }
      });
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  async getDrugDetails(url: string): Promise<ScrapedDrug | null> {
    try {
      const html = await this.fetchPage(url);
      const $ = cheerio.load(html);

      // Try __NEXT_DATA__
      const nextDataScript = $("#__NEXT_DATA__").html();
      if (nextDataScript) {
        try {
          const nd = JSON.parse(nextDataScript);
          const product = nd.props?.pageProps?.productDetailsPage?.product?.data ||
            nd.props?.pageProps?.product ||
            nd.props?.pageProps?.productData;
          if (product) {
            return {
              name: product.product_name || product.name || $("h1").first().text().trim(),
              genericName: product.generic_name || product.molecule || "",
              manufacturer: product.manufacturer_name || product.brand || "",
              composition: product.molecule || product.salt || "",
              packSize: product.pack_size || "",
              mrp: product.mrp || 0,
              sellingPrice: product.best_price || product.final_price || product.mrp || 0,
              inStock: product.available !== false,
              sourceUrl: url,
              imageUrl: product.image_url || undefined,
              prescriptionRequired: product.is_rx || false,
            };
          }
        } catch { /* fallthrough */ }
      }

      const name = $("h1").first().text().trim();
      if (!name) return null;

      const priceText = $("[class*='final-price'], [class*='best-price']").first().text();
      const mrpText = $("[class*='striked-price'], [class*='original-price']").first().text();

      return {
        name,
        genericName: "",
        manufacturer: $("[class*='manufacturer'], [class*='drug-manu']").text().trim(),
        composition: $("[class*='drug-molecule'], [class*='salt-name']").first().text().trim(),
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
