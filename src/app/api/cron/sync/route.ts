import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fullSync } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = await prisma.syncLog.create({
    data: { type: "full", status: "running" },
  });

  try {
    const result = await fullSync(5);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "completed",
        drugsTotal: result.total,
        drugsUpdated: result.updated,
        drugsFailed: result.failed,
        error:
          result.errors.length > 0
            ? result.errors.slice(0, 10).join("\n")
            : null,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      logId: log.id,
    });
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });

    return NextResponse.json(
      {
        error: "Sync failed",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 }
    );
  }
}
