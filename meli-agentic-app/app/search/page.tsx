"use client";

import { useState } from "react";

type TavilyHit = { title: string; url: string; content?: string };

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [tavilyKey, setTavilyKey] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const [domains, setDomains] = useState<string>("");
  if (typeof window !== "undefined") {
    if (!tavilyKey) {
      const saved = window.localStorage.getItem("TAVILY_API_KEY");
      if (saved) setTavilyKey(saved);
    }
  }
  const onSetTavily = (val: string) => {
    setTavilyKey(val);
    try { if (typeof window !== "undefined") window.localStorage.setItem("TAVILY_API_KEY", val); } catch {}
  };
  const [answer, setAnswer] = useState<string | null>(null);
  const [results, setResults] = useState<TavilyHit[]>([]);
  const [shopping, setShopping] = useState<{ title: string; url: string; seller: string | null; price: string | null; promo: string | null; snippet: string }[]>([]);
  const [listings, setListings] = useState<{ title: string; url: string; seller: string | null; price: string | null; promo: string | null; snippet: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const onSearch = async () => {
    if (!query) return;
    setLoading(true);
    setResults([]);
    const res = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, tavilyKey: tavilyKey || undefined, domains }) });
    const json = await res.json();
    if (!res.ok) {
      setAnswer(json?.error || "Search failed");
      setResults([]);
      setShopping([]);
    } else {
      setAnswer(json?.answer || null);
      setResults(json?.results || []);
      setShopping(json?.shopping || []);
      setListings(json?.listings || []);
    }
    setLoading(false);
  };

  const addToCapture = (url: string) => {
    try {
      if (typeof window === "undefined") return;
      const existing = window.localStorage.getItem("CAPTURE_URLS") || "";
      const list = existing
        .split(/\n|,|\s+/)
        .map((u) => u.trim())
        .filter(Boolean);
      if (!list.includes(url)) list.push(url);
      const joined = list.join("\n");
      window.localStorage.setItem("CAPTURE_URLS", joined);
      setAdded(url);
      setTimeout(() => setAdded(null), 1500);
    } catch {}
  };

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>Product Research</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>Ask a question in natural language. We’ll search the web and summarize top findings.</p>
      <div style={{ display: "grid", gap: 12, background: "#ffffff", border: "1px solid #cfe3f1", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(11,42,61,0.06)", maxHeight: "70vh", overflowY: "auto", overflowX: "hidden" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Example: show me prices of the iPhone 15 256GB in Brazil" style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid #cfe3f1", background: "#ffffff", color: "#0b2a3d" }} />
          <input type="password" value={tavilyKey} onChange={(e) => onSetTavily(e.target.value)} placeholder="Tavily API Key" style={{ width: 260, padding: "10px 12px", borderRadius: 10, border: "1px solid #cfe3f1", background: "#ffffff", color: "#0b2a3d" }} />
          <button onClick={onSearch} disabled={loading} style={{ padding: "10px 16px", borderRadius: 10, background: "#0b2a3d", color: "#f2f7fb", border: "none" }}>{loading ? "Searching..." : "Search"}</button>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="Optional ecommerce domains (comma/newline separated): amazon.com, ebay.com, shopify.com" style={{ flex: 1, padding: "8px 10px", borderRadius: 10, border: "1px solid #cfe3f1", background: "#ffffff", color: "#0b2a3d" }} />
        </div>

        {answer && (
          <div style={{ background: "#f6fbff", border: "1px solid #cfe3f1", borderRadius: 12, padding: 14, color: "#0b2a3d" }}>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Answer</div>
            <div style={{ lineHeight: 1.5 }}>{answer}</div>
          </div>
        )}

        {listings.length > 0 && (
          <div style={{ display: "grid", gap: 12, maxWidth: "100%" }}>
            <div style={{ fontWeight: 700, color: "#0b2a3d" }}>Direct product listings</div>
            {listings.map((s, i) => (
              <article key={`l-${i}`} style={{ background: "#ffffff", border: "1px solid #d7e7f3", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(11,42,61,0.06)", color: "#0b2a3d", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, wordBreak: "break-word" }}>{s.title}</div>
                    <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0b63a3", wordBreak: "break-all" }}>{s.url}</a>
                    {s.snippet && <div style={{ marginTop: 8, opacity: 0.9, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" as any, wordBreak: "break-word" }}>{s.snippet}</div>}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {s.price && <div style={{ fontSize: 18, fontWeight: 800 }}>{s.price}</div>}
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                      {s.promo && <span style={{ background: "#e6f5ec", color: "#0b7a3d", border: "1px solid #bfe6cf", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{s.promo}</span>}
                      {s.seller && <span style={{ background: "#eef6fc", color: "#0b2a3d", border: "1px solid #cfe3f1", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>Seller: {s.seller}</span>}
                    </div>
                    <button onClick={() => addToCapture(s.url)} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#0b2a3d", color: "#f2f7fb", border: "none" }}>Add to Capture</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {shopping.length > 0 && (
          <div style={{ display: "grid", gap: 12, maxWidth: "100%" }}>
            <div style={{ fontWeight: 700, color: "#0b2a3d" }}>Commerce highlights</div>
            {shopping.map((s, i) => (
              <article key={i} style={{ background: "#ffffff", border: "1px solid #d7e7f3", borderRadius: 12, padding: 14, boxShadow: "0 1px 3px rgba(11,42,61,0.06)", color: "#0b2a3d", overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, marginBottom: 6, wordBreak: "break-word" }}>{s.title}</div>
                    <a href={s.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0b63a3", wordBreak: "break-all" }}>{s.url}</a>
                    {s.snippet && <div style={{ marginTop: 8, opacity: 0.9, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" as any, wordBreak: "break-word" }}>{s.snippet}</div>}
                  </div>
                  <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {s.price && <div style={{ fontSize: 18, fontWeight: 800 }}>{s.price}</div>}
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                      {s.promo && <span style={{ background: "#e6f5ec", color: "#0b7a3d", border: "1px solid #bfe6cf", padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{s.promo}</span>}
                      {s.seller && <span style={{ background: "#eef6fc", color: "#0b2a3d", border: "1px solid #cfe3f1", padding: "2px 8px", borderRadius: 999, fontSize: 12 }}>Seller: {s.seller}</span>}
                    </div>
                    <button onClick={() => addToCapture(s.url)} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#0b2a3d", color: "#f2f7fb", border: "none" }}>Add to Capture</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ display: "grid", gap: 12, maxWidth: "100%" }}>
            <div style={{ fontWeight: 700, color: "#0b2a3d" }}>Raw search results</div>
            {results.map((r, i) => (
              <article key={i} style={{ background: "#ffffff", border: "1px solid #d7e7f3", borderRadius: 12, padding: 14, color: "#0b2a3d", overflow: "hidden" }}>
                <div style={{ fontWeight: 700, marginBottom: 6, wordBreak: "break-word" }}>{r.title}</div>
                <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#0b63a3", wordBreak: "break-all" }}>{r.url}</a>
                {r.content && (
                  <div style={{ marginTop: 8, opacity: 0.9, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" as any, wordBreak: "break-word" }}>{r.content}</div>
                )}
                <button onClick={() => addToCapture(r.url)} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, background: "#0b2a3d", color: "#f2f7fb", border: "none" }}>Add to Capture</button>
              </article>
            ))}
          </div>
        )}
        {added && (
          <div style={{ position: "sticky", bottom: 0, marginTop: 8, background: "#e6f5ec", border: "1px solid #bfe6cf", color: "#0b7a3d", padding: 8, borderRadius: 8 }}>
            Added to Capture: {added}
          </div>
        )}
      </div>
    </div>
  );
}


