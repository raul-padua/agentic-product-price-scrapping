import { runGraph } from "./graph";

// Minimal sequential orchestrator; later swap with LangGraph multi-agent
export async function runUrls(urls: string[], openaiKey: string) {
  const results = [] as any[];
  for (const url of urls) {
    try {
      const state = await runGraph(url, openaiKey);
      results.push({ url, ok: true, data: state.data, refined: state.refined });
    } catch (err: any) {
      // Check if it's a Chromium-related error
      const errorMsg = err?.message ?? "Unknown error";
      const isChromiumError = 
        errorMsg.includes('chromium') || 
        errorMsg.includes('ETXTBSY') || 
        errorMsg.includes('ENOENT') ||
        errorMsg.includes('/tmp/chromium') ||
        errorMsg.includes('puppeteer');
      
      const userFriendlyError = isChromiumError
        ? "Server screenshot capture is not available on this deployment. Please use 'Client capture (pick tab)' or 'Upload screenshot (PNG)' instead."
        : errorMsg;
      
      results.push({ url, ok: false, error: userFriendlyError });
    }
  }
  return results;
}

