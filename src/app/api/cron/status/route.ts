import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [
    drugCount,
    procedureCount,
    diagnosticCount,
    priceCount,
    stalePrices,
    lastSync,
  ] = await Promise.all([
    prisma.drug.count(),
    prisma.procedure.count(),
    prisma.diagnostic.count(),
    prisma.drugPrice.count(),
    prisma.drugPrice.count({
      where: {
        lastChecked: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.syncLog.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  return NextResponse.json({
    database: {
      drugs: drugCount,
      procedures: procedureCount,
      diagnostics: diagnosticCount,
      prices: priceCount,
    },
    stalePrices,
    freshPrices: priceCount - stalePrices,
    lastSync: lastSync
      ? {
          id: lastSync.id,
          type: lastSync.type,
          status: lastSync.status,
          drugsTotal: lastSync.drugsTotal,
          drugsUpdated: lastSync.drugsUpdated,
          drugsFailed: lastSync.drugsFailed,
          startedAt: lastSync.startedAt,
          completedAt: lastSync.completedAt,
        }
      : null,
  });
}
