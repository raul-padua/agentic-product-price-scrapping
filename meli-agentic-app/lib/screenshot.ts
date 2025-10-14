import { getBrowser } from "./browser";

export async function navigateAndCapture(url: string): Promise<{ html: string; screenshotBase64: string }>{
  const browser = await getBrowser();
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(45000);
  page.setDefaultTimeout(45000);
  await page.setViewport({ width: 1366, height: 768, deviceScaleFactor: 1 });
  await page.setUserAgent(
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({ "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7" });
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // Basic stealth hardening
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'language', { get: () => 'pt-BR' });
    Object.defineProperty(navigator, 'languages', { get: () => ['pt-BR','pt','en-US','en'] });
    Object.defineProperty(navigator, 'platform', { get: () => 'MacIntel' });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Google Inc.' });
    Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
  });

  // Geo/timezone for BR properties (Shopee often geo-fences)
  try {
    const origin = new URL(url).origin;
    // @ts-ignore
    await (browser as any).defaultBrowserContext().overridePermissions(origin, ['geolocation']);
    // @ts-ignore
    await (page as any).setGeolocation?.({ latitude: -23.5505, longitude: -46.6333 });
    await (page as any).emulateTimezone?.('America/Sao_Paulo');
  } catch {}

  await page.goto(url, { waitUntil: "domcontentloaded" });
  // Human-like activity
  try { await page.mouse.move(120, 120); await new Promise(r=>setTimeout(r,600)); await page.mouse.wheel({ deltaY: 500 } as any); } catch {}
  // Attempt to accept cookies / dismiss geolocation (Shopee)
  try { await page.click('button:has-text("Aceitar")', { timeout: 3000 } as any); } catch {}
  try { await page.click('button:has-text("Permitir todos os cookies")', { timeout: 3000 } as any); } catch {}
  try { await page.click('[data-dismiss-geo],[aria-label="Fechar"]', { timeout: 3000 } as any); } catch {}
  try { await page.click('button:has-text("Agora não")', { timeout: 2000 } as any); } catch {}
  try { await page.click('button:has-text("Continuar")', { timeout: 2000 } as any); } catch {}
  try { await (page as any).waitForNetworkIdle({ idleTime: 1500, timeout: 10000 }); } catch {}

  // Shopee-specific: basic blocked-page heuristic and retry
  try {
    const blocked = await page.evaluate(() => /shopee/.test(location.hostname));
    if (blocked) {
      await page.evaluate((dest) => { (window as any).location.href = dest; }, url);
      try { await (page as any).waitForNetworkIdle({ idleTime: 1500, timeout: 10000 }); } catch {}
    }
  } catch {}
  await page.evaluate(() => {
    const el = document.querySelector("body");
    if (el) (el as HTMLElement).style.background = "#fff";
  });
  const html = await page.content();
  const buffer = await page.screenshot({ fullPage: true, type: "png" });
  await page.close();
  const screenshotBase64 = Buffer.from(buffer).toString("base64");
  return { html, screenshotBase64 };
}

