import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://costmini.in";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/medicines`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.8 },
    { url: `${baseUrl}/scan`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/procedures`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/diagnostics`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${baseUrl}/pharmacies`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/manufacturers`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
    { url: `${baseUrl}/how-it-works`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
  ];

  // Top drug pages (most popular compositions with prices)
  try {
    const topDrugs = await prisma.drug.findMany({
      where: { prices: { some: { sellingPrice: { gt: 0 } } } },
      select: { slug: true, updatedAt: true },
      orderBy: { name: "asc" },
      take: 5000,
    });

    const drugPages: MetadataRoute.Sitemap = topDrugs.map((d) => ({
      url: `${baseUrl}/medicines/${d.slug}`,
      lastModified: d.updatedAt,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));

    return [...staticPages, ...drugPages];
  } catch {
    return staticPages;
  }
}
