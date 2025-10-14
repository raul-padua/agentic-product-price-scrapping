import { runGraph } from "./graph";

// Minimal sequential orchestrator; later swap with LangGraph multi-agent
export async function runUrls(urls: string[], openaiKey: string) {
  const results = [] as any[];
  for (const url of urls) {
    try {
      const state = await runGraph(url, openaiKey);
      results.push({ url, ok: true, data: state.data, refined: state.refined });
    } catch (err: any) {
      results.push({ url, ok: false, error: err?.message ?? "Unknown error" });
    }
  }
  return results;
}

