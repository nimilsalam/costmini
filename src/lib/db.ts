import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL || "";

  // SQLite via better-sqlite3 adapter (dev + current schema)
  if (url.startsWith("file:") || url.endsWith(".db") || !url.startsWith("postgres")) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path");
      const dbFile = url.startsWith("file:")
        ? url.replace("file:", "").replace("./", "")
        : url || "dev.db";
      const fullPath = path.isAbsolute(dbFile)
        ? dbFile
        : path.join(process.cwd(), dbFile);
      const adapter = new PrismaBetterSqlite3({ url: `file:${fullPath}` });
      return new PrismaClient({ adapter });
    } catch {
      console.warn("better-sqlite3 not available, using fallback proxy");
    }
  }

  // Build-time fallback: return a proxy that throws on actual use
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
                "DATABASE_URL is not configured."
              )
            );
        },
        apply() {
          return Promise.reject(
            new Error(
              "DATABASE_URL is not configured."
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
