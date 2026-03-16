import * as cheerio from "cheerio";
import { DrugScraper, ScrapedDrug, ScraperResult } from "./base";

/**
 * Scraper for Apollo 24|7 Pharmacy (apollopharmacy.in)
 *
 * Real API: POST https://search.apollo247.com/v4/fullSearch
 * Headers: authorization (static key), x-app-os: web
 * Supports pagination: page, productsPerPage (up to 50)
 * Returns: totalProducts, matchingProducts, products array, filters
 */
export class ApolloScraper extends DrugScraper {
  source = "Apollo";
  private baseUrl = "https://www.apollopharmacy.in";
  private searchApi = "https://search.apollo247.com/v4/fullSearch";
  private authKey = "Oeu324WMvfKOj5KMJh2Lkf00eW1";

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
    const res = await fetch(this.searchApi, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "authorization": this.authKey,
        "x-app-os": "web",
        "Origin": "https://www.apollopharmacy.in",
        "Referer": "https://www.apollopharmacy.in/",
      },
      body: JSON.stringify({
        query,
        page: 1,
        productsPerPage: 50,
        selSortBy: "relevance",
        filters: [],
        pincode: "",
      }),
    });

    if (!res.ok) throw new Error(`Apollo API returned ${res.status}`);

    const data = await res.json();
    const drugs: ScrapedDrug[] = [];
    const products = data.data?.productDetails?.products || data.data?.products || [];

    for (const item of products) {
      try {
        const mrp = item.price || 0;
        const sellingPrice = item.specialPrice || item.price || 0;
        const composition = item.PharmaComposition || (item.tags && item.tags[0]) || "";

        drugs.push({
          name: item.name || "",
          genericName: composition,
          manufacturer: item.manufacturer || item.brand || "",
          composition,
          packSize: item.unitSize || item.packForm || item.packSize || "",
          mrp,
          sellingPrice,
          inStock: item.status === "in-stock" || (item.isInStock !== 0 && item.isInStock !== false),
          sourceUrl: item.urlKey ? `${this.baseUrl}/otc/${item.urlKey}` : "",
          imageUrl: item.thumbnail ? `https://images.apollo247.in${item.thumbnail}` : (item.image || undefined),
          prescriptionRequired: item.isPrescriptionRequired === 1 || item.isPrescriptionRequired === true,
        });
      } catch {
        continue;
      }
    }

    return { source: this.source, drugs, scrapedAt: new Date() };
  }

  private async scrapeSearchPage(query: string): Promise<ScraperResult> {
    const url = `${this.baseUrl}/search-medicines/${encodeURIComponent(query)}`;
    const html = await this.fetchPage(url);
    const $ = cheerio.load(html);
    const drugs: ScrapedDrug[] = [];

    // Try __NEXT_DATA__
    const nextDataScript = $("#__NEXT_DATA__").html();
    if (nextDataScript) {
      try {
        const nd = JSON.parse(nextDataScript);
        const searchData = nd.props?.pageProps?.searchData || nd.props?.pageProps;
        const products = searchData?.products || searchData?.data?.products || [];
        for (const item of products) {
          if (item.name && (item.price || item.specialPrice)) {
            drugs.push({
              name: item.name,
              genericName: item.PharmaComposition || "",
              manufacturer: item.manufacturer || "",
              composition: item.PharmaComposition || "",
              packSize: item.packForm || "",
              mrp: item.price || 0,
              sellingPrice: item.specialPrice || item.price || 0,
              inStock: item.isInStock !== 0,
              sourceUrl: item.urlKey ? `${this.baseUrl}/otc/${item.urlKey}` : "",
              imageUrl: item.image || undefined,
              prescriptionRequired: item.isPrescriptionRequired === 1,
            });
          }
        }
      } catch { /* fallthrough */ }
    }

    if (drugs.length === 0) {
      $("[class*='ProductCard'], [class*='product-item']").each((_, el) => {
        try {
          const $el = $(el);
          const name = $el.find("[class*='productName'], h2, h3").first().text().trim();
          const priceText = $el.find("[class*='sellingPrice'], [class*='sale-price']").first().text();
          const mrpText = $el.find("[class*='striked'], [class*='mrp']").first().text();
          const link = $el.find("a").attr("href") || "";

          if (name && priceText) {
            drugs.push({
              name,
              genericName: "",
              manufacturer: $el.find("[class*='manufacturer']").text().trim(),
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

      const nextDataScript = $("#__NEXT_DATA__").html();
      if (nextDataScript) {
        try {
          const nd = JSON.parse(nextDataScript);
          const product = nd.props?.pageProps?.productData || nd.props?.pageProps?.product;
          if (product) {
            return {
              name: product.name || $("h1").first().text().trim(),
              genericName: product.PharmaComposition || "",
              manufacturer: product.manufacturer || "",
              composition: product.PharmaComposition || "",
              packSize: product.packForm || "",
              mrp: product.price || 0,
              sellingPrice: product.specialPrice || product.price || 0,
              inStock: product.isInStock !== 0,
              sourceUrl: url,
              imageUrl: product.image || undefined,
              prescriptionRequired: product.isPrescriptionRequired === 1,
            };
          }
        } catch { /* fallthrough */ }
      }

      const name = $("h1").first().text().trim();
      if (!name) return null;

      const priceText = $("[class*='selling-price'], [class*='finalPrice']").first().text();
      const mrpText = $("[class*='striked-price'], [class*='mrp']").first().text();

      return {
        name,
        genericName: "",
        manufacturer: $("[class*='manufacturer']").text().trim(),
        composition: $("[class*='composition']").first().text().trim(),
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
