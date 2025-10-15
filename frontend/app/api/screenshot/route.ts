import { NextRequest } from "next/server";
import { navigateAndCapture } from "@/lib/screenshot";
import { extractProductInfo } from "@/lib/extractors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = String(body?.url ?? "").trim();
    if (!url) {
      return new Response(JSON.stringify({ ok: false, error: "Missing url" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { html, screenshotBase64 } = await navigateAndCapture(url);
    const data = extractProductInfo(html, url);

    return new Response(
      JSON.stringify({ ok: true, data: { ...data, screenshotBase64 } }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    // Check if it's a Chromium-related error
    const errorMsg = err?.message ?? "Unknown error";
    const isChromiumError = errorMsg.includes('chromium') || errorMsg.includes('ETXTBSY') || errorMsg.includes('ENOENT');
    
    const userFriendlyError = isChromiumError
      ? "Server screenshot capture is not available on this deployment. Please use 'Client capture (pick tab)' or 'Upload screenshot (PNG)' instead."
      : errorMsg;
    
    return new Response(
      JSON.stringify({ ok: false, error: userFriendlyError }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

