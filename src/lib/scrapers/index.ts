import { OneMgScraper } from "./onemg";
import { PharmEasyScraper } from "./pharmeasy";
import { NetmedsScraper } from "./netmeds";
import { ApolloScraper } from "./apollo";
import { FlipkartHealthScraper } from "./flipkart";
import { TruemedsScraper } from "./truemeds";
import { MedPlusScraper } from "./medplus";
import { AmazonPharmacyScraper } from "./amazon";
import { ScraperResult } from "./base";

export type { ScrapedDrug, ScraperResult } from "./base";

const scrapers = [
  new OneMgScraper(),
  new PharmEasyScraper(),
  new NetmedsScraper(),
  new ApolloScraper(),
  new FlipkartHealthScraper(),
  new TruemedsScraper(),
  new MedPlusScraper(),
  new AmazonPharmacyScraper(),
];

/**
 * Search for a drug across all pharmacy sources in parallel.
 * Returns combined results from 1mg, PharmEasy, etc.
 */
export async function searchAllPharmacies(
  query: string
): Promise<ScraperResult[]> {
  const results = await Promise.allSettled(
    scrapers.map((s) => s.searchDrugs(query))
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<ScraperResult> =>
        r.status === "fulfilled"
    )
    .map((r) => r.value);
}

/**
 * Get the best price for a drug across all sources.
 */
export function findBestPrice(results: ScraperResult[]): {
  source: string;
  price: number;
  drugName: string;
} | null {
  let best: { source: string; price: number; drugName: string } | null = null;

  for (const result of results) {
    for (const drug of result.drugs) {
      if (!best || drug.sellingPrice < best.price) {
        best = {
          source: result.source,
          price: drug.sellingPrice,
          drugName: drug.name,
        };
      }
    }
  }

  return best;
}
