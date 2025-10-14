Environment and Secrets

Local development

- Create a file named `.env.local` in the project root if you need secrets.
- Optional: `OPENAI_API_KEY` for future LLM enrichments.

Notes

- Local uses full `puppeteer` Chrome; Vercel uses `@sparticuz/chromium` + `puppeteer-core`.
- If a website blocks headless browsers, consider rotating user-agents or adding timeouts.
- Optional proxy (recommended for Shopee): set one of `HTTP_PROXY_URL`, `HTTPS_PROXY_URL`, or `ALL_PROXY_URL` (e.g., `http://user:pass@host:port`).
 - `TAVILY_API_KEY`: Optional Tavily key for `/api/search` (can also be provided from the UI).

