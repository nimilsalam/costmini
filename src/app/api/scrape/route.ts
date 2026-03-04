import { NextRequest, NextResponse } from "next/server";
import { searchAllPharmacies, findBestPrice } from "@/lib/scrapers";

/**
 * GET /api/scrape?q=paracetamol
 *
 * Live scraping endpoint — searches 1mg, PharmEasy, etc. in parallel
 * and returns combined results with the best price highlighted.
 *
 * Rate limit this in production (e.g. with upstash/ratelimit).
 */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q");

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Query must be at least 2 characters" },
      { status: 400 }
    );
  }

  try {
    const results = await searchAllPharmacies(q);
    const bestPrice = findBestPrice(results);

    const allDrugs = results.flatMap((r) =>
      r.drugs.map((d) => ({ ...d, source: r.source }))
    );

    return NextResponse.json({
      query: q,
      totalResults: allDrugs.length,
      bestPrice,
      sources: results.map((r) => ({
        name: r.source,
        count: r.drugs.length,
        error: r.error || null,
        scrapedAt: r.scrapedAt,
      })),
      drugs: allDrugs.sort((a, b) => a.sellingPrice - b.sellingPrice),
    });
  } catch {
    return NextResponse.json(
      { error: "Scraping failed. Please try again." },
      { status: 500 }
    );
  }
}
