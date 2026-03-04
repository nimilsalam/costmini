export interface ScrapedDrug {
  name: string;
  genericName: string;
  manufacturer: string;
  composition: string;
  packSize: string;
  mrp: number;
  sellingPrice: number;
  inStock: boolean;
  sourceUrl: string;
  imageUrl?: string;
  prescriptionRequired: boolean;
}

export interface ScraperResult {
  source: string;
  drugs: ScrapedDrug[];
  scrapedAt: Date;
  error?: string;
}

export abstract class DrugScraper {
  abstract source: string;
  abstract searchDrugs(query: string): Promise<ScraperResult>;
  abstract getDrugDetails(url: string): Promise<ScrapedDrug | null>;

  protected async fetchPage(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-IN,en;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
    return res.text();
  }

  protected parsePrice(text: string): number {
    const cleaned = text.replace(/[^\d.]/g, "");
    return parseFloat(cleaned) || 0;
  }
}
