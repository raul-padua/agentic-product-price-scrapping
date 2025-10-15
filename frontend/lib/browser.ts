import chromium from "@sparticuz/chromium";
import puppeteerCore from "puppeteer-core";
import type { Browser as CoreBrowser } from "puppeteer-core";

let cachedBrowser: CoreBrowser | null = null;

export async function getBrowser(): Promise<CoreBrowser> {
  const isLocal = !process.env.AWS_REGION && !process.env.VERCEL;
  const proxyUrl = process.env.HTTP_PROXY_URL || process.env.HTTPS_PROXY_URL || process.env.ALL_PROXY_URL;

  // For local development, cache the browser instance
  if (isLocal) {
    if (cachedBrowser) return cachedBrowser;
    const { default: puppeteer } = await import("puppeteer");
    const args = ["--disable-blink-features=AutomationControlled", "--lang=en-US,en"] as string[];
    if (proxyUrl) args.push(`--proxy-server=${proxyUrl}`);
    const localBrowser = (await puppeteer.launch({ headless: true, args })) as unknown as CoreBrowser;
    cachedBrowser = localBrowser;
    return cachedBrowser;
  }

  // For serverless (Vercel), DO NOT cache - create fresh browser each time to avoid ETXTBSY
  // Set proper font configuration for serverless
  await chromium.font(
    'https://raw.githack.com/googlei18n/noto-emoji/master/fonts/NotoColorEmoji.ttf'
  );
  
  const executablePath = await chromium.executablePath();
  
  const args = [
    ...chromium.args,
    "--disable-blink-features=AutomationControlled",
    "--lang=en-US,en",
    "--single-process", // Critical for serverless
    "--no-zygote", // Critical for serverless
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--no-sandbox",
    "--disable-setuid-sandbox",
  ] as string[];
  if (proxyUrl) args.push(`--proxy-server=${proxyUrl}`);
  
  const browser = await puppeteerCore.launch({
    args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
    ignoreHTTPSErrors: true,
  });
  return browser;
}

export async function closeBrowser() {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}

