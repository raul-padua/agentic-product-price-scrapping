import { NextRequest } from "next/server";
import { runUrls } from "@/lib/orchestrator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const urls = (Array.isArray(body?.urls) ? body.urls : []).map((u: any) => String(u)).filter(Boolean);
    const openaiKey = typeof body?.openaiKey === "string" && body.openaiKey.trim() ? body.openaiKey.trim() : undefined;
    if (urls.length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "Missing OpenAI key" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    const results = await runUrls(urls, openaiKey);
    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

