import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || "";

  // Production / Vercel: PostgreSQL via @prisma/adapter-pg
  if (url.startsWith("postgres")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaPg } = require("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  }

  // Local dev with SQLite via better-sqlite3 adapter
  if (url.startsWith("file:") || url.endsWith(".db")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const dbFile = url.startsWith("file:")
        ? url.replace("file:", "").replace("./", "")
        : url;
      const fullPath = path.isAbsolute(dbFile)
        ? dbFile
        : path.join(process.cwd(), dbFile);
      const adapter = new PrismaBetterSqlite3({ url: `file:${fullPath}` });
      return new PrismaClient({ adapter });
    } catch {
      console.warn("better-sqlite3 not available");
    }
  }

  // Build-time fallback: return a proxy that throws on actual use
  // This prevents build failures when no database is configured
  console.warn("No valid DATABASE_URL found. Database calls will fail at runtime.");
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      if (prop === "then" || prop === "$connect" || prop === "$disconnect") {
        return undefined;
      }
      return new Proxy(() => {}, {
        get() {
          return () =>
            Promise.reject(
              new Error(
                "DATABASE_URL is not configured. Set a PostgreSQL connection string."
              )
            );
        },
        apply() {
          return Promise.reject(
            new Error(
              "DATABASE_URL is not configured. Set a PostgreSQL connection string."
            )
          );
        },
      });
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
