import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url : "";
    const screenshotBase64 = typeof body?.screenshotBase64 === "string" ? body.screenshotBase64 : "";
    const visionModel = typeof body?.visionModel === "string" ? body.visionModel : undefined;
    const screenshotMime = typeof body?.screenshotMime === "string" ? body.screenshotMime : "image/png";
    const openaiKey = typeof body?.openaiKey === "string" && body.openaiKey.trim() ? body.openaiKey.trim() : undefined;

    if (!screenshotBase64) {
      return new Response(JSON.stringify({ ok: false, error: "Missing screenshotBase64" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (!openaiKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing OpenAI key" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // If Python backend is available, run image extraction then refine
    // Use PY_BACKEND_URL for local dev, or construct absolute URL for Vercel
    const pyBackendUrl = process.env.PY_BACKEND_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/py-api` : "/py-api");
    
    console.log("[ingest] Calling Python backend at:", pyBackendUrl);
    
    try {
      const extRes = await fetch(`${pyBackendUrl}/image_extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, screenshot_base64: screenshotBase64, mime: screenshotMime, model: visionModel, openai_key: openaiKey }),
      });
      
      console.log("[ingest] image_extract response status:", extRes.status);
      
      if (!extRes.ok) {
        const errorText = await extRes.text();
        console.error("[ingest] image_extract error:", errorText);
        throw new Error(`image_extract failed: ${extRes.status} - ${errorText}`);
      }
      
      const extracted = await extRes.json();
      console.log("[ingest] Extracted data:", { title: extracted?.title, price: extracted?.price });

      const refineRes = await fetch(`${pyBackendUrl}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          title: extracted?.title ?? null,
          price_raw: extracted?.price?.raw ?? null,
          price_value: extracted?.price?.value ?? null,
          price_currency: extracted?.price?.currency ?? null,
          promotions: Array.isArray(extracted?.promotions) ? extracted.promotions : [],
          openai_key: openaiKey,
        }),
      });
      
      console.log("[ingest] refine response status:", refineRes.status);
      
      if (!refineRes.ok) {
        const errorText = await refineRes.text();
        console.error("[ingest] refine error:", errorText);
        throw new Error(`refine failed: ${refineRes.status} - ${errorText}`);
      }
      
      const refined = await refineRes.json();
      console.log("[ingest] Refined data:", refined);

      return new Response(
        JSON.stringify({
          results: [
            {
              url,
              ok: true,
              data: {
                title: extracted?.title ?? null,
                price: {
                  raw: extracted?.price?.raw ?? null,
                  value: extracted?.price?.value ?? null,
                  currency: extracted?.price?.currency ?? null,
                },
                promotions: Array.isArray(extracted?.promotions) ? extracted.promotions : [],
                screenshotBase64,
                screenshotMime,
              },
              refined,
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (e: any) {
      // Log the error and return it to the user
      console.error("[ingest] Python backend error:", e?.message);
      return new Response(
        JSON.stringify({
          results: [
            {
              url,
              ok: false,
              error: `Python backend failed: ${e?.message ?? "Unknown error"}`,
              data: {
                title: null,
                price: { raw: null, value: null, currency: null },
                promotions: [],
                screenshotBase64,
                screenshotMime,
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message ?? "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}


