import { getBrowser } from "./browser";

export async function navigateAndCapture(url: string): Promise<{ html: string; screenshotBase64: string }>{
  const browser = await getBrowser();
  const isServerless = process.env.VERCEL || process.env.AWS_REGION;
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Basic stealth hardening
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'language', { get: () => 'en-US' });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US','en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
  });

  // Basic geolocation setup (optional)
  try {
    const origin = new URL(url).origin;
    // @ts-ignore
    await (browser as any).defaultBrowserContext().overridePermissions(origin, ['geolocation']);
  } catch {}

  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Human-like activity
  try { await page.mouse.move(120, 120); await new Promise(r=>setTimeout(r,600)); await page.mouse.wheel({ deltaY: 500 } as any); } catch {}
  // Attempt to accept cookies / dismiss popups
  try { await page.click('button:has-text("Accept")', { timeout: 3000 } as any); } catch {}
  try { await page.click('button:has-text("Accept all")', { timeout: 3000 } as any); } catch {}
  try { await page.click('button:has-text("Allow all cookies")', { timeout: 3000 } as any); } catch {}
  try { await page.click('[data-dismiss],[aria-label="Close"]', { timeout: 3000 } as any); } catch {}
  try { await page.click('button:has-text("Continue")', { timeout: 2000 } as any); } catch {}
  try { await (page as any).waitForNetworkIdle({ idleTime: 1500, timeout: 10000 }); } catch {}

  // Additional wait for dynamic content
  try {
    await new Promise(r => setTimeout(r, 1000));
  } catch {}
  await page.evaluate(() => {
    const el = document.querySelector("body");
    if (el) (el as HTMLElement).style.background = "#fff";
  });
  const html = await page.content();
  const buffer = await page.screenshot({ fullPage: true, type: "png" });
  await page.close();
  
  // In serverless, close the browser after each request to avoid ETXTBSY errors
  if (isServerless) {
    await browser.close();
  }
  
  const screenshotBase64 = Buffer.from(buffer).toString("base64");
  return { html, screenshotBase64 };
}

