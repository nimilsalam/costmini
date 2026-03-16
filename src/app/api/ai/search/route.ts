import { NextRequest } from "next/server";
import { streamMedicineSearch } from "@/lib/ai";
import { rateLimit } from "@/lib/cache";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 20 requests per minute per IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const { allowed } = rateLimit(`ai-search:${ip}`, 20, 60_000);
    if (!allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment." }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );
    }

    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 2 || query.trim().length > 500) {
      return new Response(
        JSON.stringify({ error: "Query must be 2-500 characters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI search not configured. Set GROQ_API_KEY." }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    const stream = await streamMedicineSearch(query.trim());
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("AI search error:", error);
    return new Response(
      JSON.stringify({ error: "AI search failed. Please try again." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
