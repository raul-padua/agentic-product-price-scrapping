import { StateGraph, START, END } from "@langchain/langgraph";
import { navigateAndCapture } from "./screenshot";
import { extractProductInfo } from "./extractors";

type GraphState = {
  url: string;
  openaiKey?: string;
  html?: string;
  screenshotBase64?: string;
  data?: ReturnType<typeof extractProductInfo> & { screenshotBase64?: string };
  refined?: {
    title: string | null;
    price_value: number | null;
    price_currency: string | null;
    has_discount: boolean | null;
    promo_summary: string | null;
  };
};

const workflow = new StateGraph<GraphState>({
  channels: {
    url: null,
    openaiKey: null,
    html: null,
    screenshotBase64: null,
    data: null,
    refined: null,
  },
});

workflow.addNode("capture", async (state: GraphState) => {
  const { html, screenshotBase64 } = await navigateAndCapture(state.url);
  return { html, screenshotBase64 } as Partial<GraphState>;
});

workflow.addNode("extract", async (state: GraphState) => {
  if (!state.html) return {};
  const info = extractProductInfo(state.html, state.url);
  return { data: { ...info, screenshotBase64: state.screenshotBase64 } } as Partial<GraphState>;
});

workflow.addNode("refine", async (state: GraphState) => {
  if (!state.data) return {};
  // Use PY_BACKEND_URL for local dev, or construct absolute URL for Vercel
  const pyUrl = process.env.PY_BACKEND_URL || 
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/py-api` : "/py-api");
  
  console.log("[graph] Calling Python refine at:", pyUrl);
  
  const res = await fetch(`${pyUrl.replace(/\/$/, "")}/refine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: state.url,
      title: state.data.title,
      price_raw: state.data.price.raw,
      price_value: state.data.price.value,
      price_currency: state.data.price.currency,
      promotions: state.data.promotions,
      openai_key: state.openaiKey,
    }),
  });
  
  console.log("[graph] Refine response status:", res.status);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error("[graph] Refine error:", errorText);
    throw new Error(`Python refine failed: ${res.status} - ${errorText}`);
  }
  const json = await res.json();
  return { refined: {
    title: json.title ?? state.data.title ?? null,
    price_value: json.price_value ?? state.data.price.value ?? null,
    price_currency: json.price_currency ?? state.data.price.currency ?? null,
    has_discount: (json.has_discount !== undefined && json.has_discount !== null)
      ? Boolean(json.has_discount)
      : (((state.data.promotions?.length || 0) > 0) ? true : null),
    promo_summary: json.promo_summary ?? (state.data.promotions?.slice(0,3).join("; ") || null)
  } } as Partial<GraphState>;
});

// Type casting to satisfy current StateGraph TS typings
(workflow as any).addEdge(START, "capture");
(workflow as any).addEdge("capture", "extract");
(workflow as any).addEdge("extract", "refine");
(workflow as any).addEdge("refine", END);

export const app = workflow.compile();

export async function runGraph(url: string, openaiKey?: string) {
  const result = await app.invoke({ url, openaiKey });
  return result as GraphState;
}

