import * as cheerio from "cheerio";

export type Price = { raw: string | null; value: number | null; currency: string | null };

export function extractProductInfo(html: string, url: string): {
  title: string | null;
  price: Price;
  promotions: string[];
} {
  const $ = cheerio.load(html);

  // Helpers
  const detectCurrencyFromUrl = (pageUrl: string): string | null => {
    try {
      const u = new URL(pageUrl);
      const host = u.hostname.toLowerCase();
      if (host.endsWith(".com.br") || host.endsWith(".br")) return "BRL";
      if (host.endsWith(".co.uk")) return "GBP";
      if (host.endsWith(".de") || host.endsWith(".fr") || host.endsWith(".it") || host.endsWith(".es")) return null; // ambiguous EUR
      return null;
    } catch {
      return null;
    }
  };

  const normalizeCurrency = (raw: string | null, pageUrl: string): string | null => {
    if (!raw) return detectCurrencyFromUrl(pageUrl);
    if (/R\$/.test(raw)) return "BRL";
    if (/€/.test(raw)) return "EUR";
    if (/£/.test(raw)) return "GBP";
    if (/\$/.test(raw)) return detectCurrencyFromUrl(pageUrl) || "USD";
    return detectCurrencyFromUrl(pageUrl);
  };

  const parseLocalizedNumber = (raw: string, currencyGuess: string | null, pageUrl: string): number | null => {
    const isBR = currencyGuess === "BRL" || /R\$/.test(raw) || pageUrl.includes(".com.br") || pageUrl.endsWith(".br");
    let cleaned = raw.trim();
    // Common cases: BRL uses 1.234,56; EN uses 1,234.56
    // Strategy: remove all non digits/sep, then choose decimal separator by locale or last separator.
    cleaned = cleaned.replace(/[^0-9.,\-]/g, "");

    if (!cleaned) return null;

    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");

    if (isBR) {
      // thousands: . ; decimal: ,
      const noThousands = cleaned.replace(/\./g, "");
      const normalized = noThousands.replace(/,/g, ".");
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    // Not BR: if both separators present, assume , is thousands, . is decimal
    if (hasComma && hasDot) {
      const tmp = cleaned.replace(/,/g, "");
      const parsed = parseFloat(tmp);
      return Number.isFinite(parsed) ? parsed : null;
    }

    // Only comma present → treat as decimal
    if (hasComma && !hasDot) {
      const normalized = cleaned.replace(/,/g, ".");
      const parsed = parseFloat(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }

    // Only dot or digits
    const parsed = parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  };

  // Title heuristics
  const ogTitle = $('meta[property="og:title"]').attr("content") || null;
  const titleTag = $("title").first().text().trim() || null;
  const h1 = $("h1").first().text().trim() || null;
  // Site-specific title selectors
  const mlTitle = $(".ui-pdp-title").first().text().trim() || null; // Generic marketplace
  const amazonTitle = $("#productTitle").first().text().trim() || null;
  const title = mlTitle || amazonTitle || ogTitle || h1 || titleTag;

  // Price heuristics
  const priceSelectors = [
    "[itemprop='price']",
    "meta[itemprop='price']",
    "[data-price]",
    ".price, .product-price, .a-price, .price-tag, .value, .amount",
    ".andes-money-amount__fraction", // Generic marketplace fraction
    ".andes-money-amount__cents", // Generic marketplace cents
    ".ui-pdp-price__second-line .andes-money-amount__fraction",
    ".ui-pdp-price__second-line .andes-money-amount__cents",
    ".a-price .a-offscreen", // Amazon visible price
    "span:contains('$'), span:contains('R$'), span:contains('€'), span:contains('£')",
  ];
  let rawPrice: string | null = null;
  let mlFraction: string | null = null;
  let mlCents: string | null = null;
  for (const sel of priceSelectors) {
    const el = $(sel).first();
    if (el && el.length) {
      const txt = el.attr("content") || el.attr("data-price") || el.text().trim();
      if (sel.includes("andes-money-amount__fraction") && txt) mlFraction = txt;
      else if (sel.includes("andes-money-amount__cents") && txt) mlCents = txt;
      rawPrice = txt;
      if (rawPrice) break;
    }
  }
  if (!rawPrice && mlFraction) {
    rawPrice = mlCents ? `${mlFraction},${mlCents}` : mlFraction;
  }

  let currency: string | null = null;
  const currencyMeta = $("meta[itemprop='priceCurrency']").attr("content") ||
    $("meta[property='product:price:currency']").attr("content") || null;
  if (currencyMeta) currency = currencyMeta.toUpperCase();
  currency = currency || normalizeCurrency(rawPrice, url);

  let value: number | null = null;
  if (rawPrice) {
    value = parseLocalizedNumber(rawPrice, currency, url);
  }

  // Promotion heuristics
  const promoKeywords = ["promo", "promotion", "discount", "off", "coupon", "voucher", "shipping", "installment" ];
  const promotions = new Set<string>();
  $("body *").each((_, el) => {
    const txt = $(el).text().trim();
    if (!txt || txt.length > 160) return;
    const lower = txt.toLowerCase();
    if (promoKeywords.some((k) => lower.includes(k))) {
      promotions.add(txt);
    }
  });

  return {
    title,
    price: { raw: rawPrice ?? null, value, currency },
    promotions: Array.from(promotions).slice(0, 20),
  };
}

