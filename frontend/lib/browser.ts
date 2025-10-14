import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import type { Browser as CoreBrowser } from "puppeteer-core";

let cachedBrowser: CoreBrowser | null = null;

export async function getBrowser(): Promise<CoreBrowser> {
  if (cachedBrowser) return cachedBrowser;

  const isLocal = !process.env.AWS_REGION && !process.env.VERCEL;
  const proxyUrl = process.env.HTTP_PROXY_URL || process.env.HTTPS_PROXY_URL || process.env.ALL_PROXY_URL;

  if (isLocal) {
    const { default: puppeteer } = await import("puppeteer");
    const args = ["--disable-blink-features=AutomationControlled", "--lang=pt-BR,pt"] as string[];
    if (proxyUrl) args.push(`--proxy-server=${proxyUrl}`);
    const localBrowser = (await puppeteer.launch({ headless: true, args })) as unknown as CoreBrowser;
    cachedBrowser = localBrowser;
    return cachedBrowser;
  }

  const executablePath = await chromium.executablePath();
  const args = [...chromium.args, "--disable-blink-features=AutomationControlled", "--lang=pt-BR,pt"] as string[];
  if (proxyUrl) args.push(`--proxy-server=${proxyUrl}`);
  cachedBrowser = await puppeteerCore.launch({
    args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });
  return cachedBrowser;
}

export async function closeBrowser() {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}

