import { NextRequest } from "next/server";

export const runtime = "nodejs";

type TavilyResult = {
  title: string;
  url: string;
  content?: string;
  score?: number;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = String(body?.query || "").trim();
    const fallbackDev = process.env.DEFAULT_TAVILY_DEV_KEY || "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"; // dev key provided by user for local testing
    const tavilyKey = String(body?.tavilyKey || process.env.TAVILY_API_KEY || fallbackDev || "").trim();
    if (!query) {
      return new Response(JSON.stringify({ ok: false, error: "Missing query" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    if (!tavilyKey) {
      return new Response(JSON.stringify({ ok: false, error: "Missing TAVILY_API_KEY" }), { status: 400, headers: { "Content-Type": "application/json" } });
    }

    // Optional user-provided e-commerce domains
    const domainsInput = Array.isArray((body as any)?.domains)
      ? (body as any).domains
      : (typeof (body as any)?.domains === "string" ? (body as any).domains : (typeof (body as any)?.sites === "string" ? (body as any).sites : ""));
    const userDomains: string[] = Array.isArray(domainsInput)
      ? (domainsInput as any[]).map((d) => String(d).trim()).filter(Boolean)
      : String(domainsInput || "").split(/\n|,|\s+/).map((d) => d.trim()).filter(Boolean);

    const siteFilter = userDomains.length > 0 ? userDomains.map((d) => `site:${d}`).join(" OR ") : "";
    // Enhanced query focusing on product listings and prices
    const enhancedQuery = `${query} ${siteFilter ? siteFilter : ""} buy price product listing`.trim();

    const payload1: any = {
      api_key: tavilyKey,
      query: enhancedQuery,
      search_depth: "advanced",
      max_results: 8,
      include_answer: true,
      topic: "shopping",
    };
    let tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload1),
    });
    let json = await tavilyRes.json();
    if (!tavilyRes.ok) {
      // Retry with a simpler payload (some keys like topic may cause 400 on older plans)
      const payload2: any = {
        api_key: tavilyKey,
        query: enhancedQuery,
        search_depth: "basic",
        max_results: 5,
        include_answer: true,
      };
      tavilyRes = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload2),
      });
      json = await tavilyRes.json();
      if (!tavilyRes.ok) {
        return new Response(
          JSON.stringify({ ok: false, error: json?.error || json?.message || `Tavily error ${tavilyRes.status}` }),
          { status: tavilyRes.status, headers: { "Content-Type": "application/json" } }
        );
      }
    }
    const stripJsonish = (text?: string) => {
      if (typeof text !== "string" || !text) return "";
      let s = text.replace(/\n+/g, " ").replace(/\t+/g, " ");
      // Remove very long curly blocks and key:value runs
      s = s.replace(/\{[^}]{120,}\}/g, " ");
      s = s.replace(/\"?[a-zA-Z0-9_\-]+\"?\s*:\s*\"[^\"\n]{1,}\"[,}]?/g, " ");
      s = s.replace(/\s{2,}/g, " ").trim();
      return s;
    };

    const results: TavilyResult[] = Array.isArray(json?.results)
      ? json.results.map((r: any) => ({ title: r.title, url: r.url, content: stripJsonish(r.content), score: r.score }))
      : [];
    // Extract shopping-oriented fields heuristically from content
    const normalize = (text?: string) => (typeof text === "string" ? text : "");
    const shopping = results.map((r) => {
      const content = normalize(r.content);
      const priceMatch = content.match(/(?:R\$|\$|€|£)\s?\d+[\d\.,]*/);
      const percentMatch = content.match(/\b\d{1,3}%\b/);
      const sellerMatch = content.match(/(sold by|vendedor|seller):?\s*([^\n\r\-\|]+)/i);
      return {
        title: r.title,
        url: r.url,
        seller: sellerMatch ? sellerMatch[2].trim() : null,
        price: priceMatch ? priceMatch[0] : null,
        promo: percentMatch ? percentMatch[0] : null,
        snippet: stripJsonish(content).slice(0, 300),
      };
    });
    // Curate direct product listings based on domain allowlist and URL patterns
    const allowed = new Set(userDomains);
    // Enhanced product URL patterns for better product page detection
    const productPatterns = [
      /\/p\//i,
      /\/dp\//i,
      /\/produto/i,
      /\/product/i,
      /\/item\//i,
      /\/offer\//i,
      /\/listing\//i,
      /\/buy\//i,
      /\/shop\//i,
      /\/(iphone|samsung|laptop|notebook|phone|watch|camera|tv|tablet|headphone|speaker)/i,
      /-p-\d+/i, // Product ID patterns
      /\/pd\//i, // Product detail
    ];
    const isProductUrl = (u: string, hasPrice: boolean) => {
      try {
        const urlObj = new URL(u);
        const host = urlObj.hostname.replace(/^www\./, "");
        // If domains specified, check if in domain list
        const inDomain = userDomains.length === 0 || Array.from(allowed).some((d) => host.endsWith(d));
        // Check if URL pattern matches product page
        const matchesPattern = productPatterns.some((re) => re.test(urlObj.pathname) || re.test(urlObj.hostname));
        // Prioritize URLs with detected prices
        return inDomain && (matchesPattern || hasPrice);
      } catch {
        return false;
      }
    };
    // Filter and prioritize direct product listings with prices
    const listings = shopping
      .filter((s) => isProductUrl(s.url, !!s.price))
      .sort((a, b) => {
        // Prioritize listings with prices and promos
        const scoreA = (a.price ? 2 : 0) + (a.promo ? 1 : 0);
        const scoreB = (b.price ? 2 : 0) + (b.promo ? 1 : 0);
        return scoreB - scoreA;
      })
      .slice(0, 10);

    const cleanAnswer = stripJsonish(json?.answer || "");
    return new Response(JSON.stringify({ ok: true, answer: cleanAnswer || null, results, shopping, listings }), { headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Unknown error" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}


