"use client";

import { useState } from "react";

type RunResult = {
  url: string;
  ok: boolean;
  error?: string;
  data?: {
    title: string | null;
    price: { raw: string | null; value: number | null; currency: string | null };
    promotions: string[];
    screenshotBase64?: string;
    screenshotMime?: string;
  };
  refined?: {
    title: string | null;
    price_value: number | null;
    price_currency: string | null;
    has_discount: boolean | null;
    promo_summary: string | null;
  };
};

export default function Page() {
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<RunResult[]>([]);
  const [visionModel, setVisionModel] = useState("gpt-4o-mini");
  const [openaiKey, setOpenaiKey] = useState("");

  // Persist key and model for navigation across tabs/views
  if (typeof window !== "undefined") {
    if (!openaiKey) {
      const saved = window.localStorage.getItem("OPENAI_API_KEY");
      if (saved) setOpenaiKey(saved);
    }
    if (!urls) {
      const savedUrls = window.localStorage.getItem("CAPTURE_URLS");
      if (savedUrls) setUrls(savedUrls);
    }
  }
  const onSetKey = (val: string) => {
    setOpenaiKey(val);
    try { if (typeof window !== "undefined") window.localStorage.setItem("OPENAI_API_KEY", val); } catch {}
  };
  const onSetModel = (val: string) => {
    setVisionModel(val);
    try { if (typeof window !== "undefined") window.localStorage.setItem("VISION_MODEL", val); } catch {}
  };
  if (typeof window !== "undefined") {
    const savedModel = window.localStorage.getItem("VISION_MODEL");
    if (savedModel && savedModel !== visionModel) setVisionModel(savedModel);
  }
  const [tavilyKey, setTavilyKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ answer: string | null; results: { title: string; url: string; content?: string }[] } | null>(null);

  const onSetUrls = (val: string) => {
    setUrls(val);
    try { if (typeof window !== "undefined") window.localStorage.setItem("CAPTURE_URLS", val); } catch {}
  };

  const onClientCapture = async () => {
    try {
      setCapturing(true);
      // Request tab/window capture
      // @ts-ignore
      const stream: MediaStream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: "browser", preferCurrentTab: true, selfBrowserSurface: "include", logicalSurface: true } as any,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const ImageCaptureCtor = (window as any).ImageCapture;
      const imageCapture = ImageCaptureCtor ? new ImageCaptureCtor(track) : null;
      let blob: Blob | null = null;
      if (imageCapture && (imageCapture as any).grabFrame) {
        const frame = await (imageCapture as any).grabFrame();
        const canvas = document.createElement("canvas");
        canvas.width = frame.width; canvas.height = frame.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(frame as any, 0, 0);
        blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), "image/png"));
      } else {
        // Fallback via <video>
        const video = document.createElement("video");
        video.srcObject = stream;
        await video.play();
        await new Promise((r) => setTimeout(r, 500));
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth; canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas not supported");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b as Blob), "image/png"));
        video.pause();
      }
      track.stop();
      if (!blob) throw new Error("No screenshot");
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const result = String(reader.result || "");
            const base64 = result.includes(",") ? result.split(",")[1] : "";
            if (!base64) reject(new Error("Failed to encode screenshot"));
            else resolve(base64);
          } catch (err) {
            reject(err as Error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read screenshot"));
        reader.readAsDataURL(blob);
      });
      const firstUrl = urls.split(/\n|,|\s+/).map((u) => u.trim()).filter(Boolean)[0] || "";
      const res = await fetch("/api/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: firstUrl, screenshotBase64: b64, screenshotMime: "image/png", visionModel, openaiKey: openaiKey || undefined }) });
      const json = await res.json();
      setResults(json.results as RunResult[]);
    } catch (e: any) {
      setResults([{ url: "", ok: false, error: e?.message || "Client capture failed" }]);
    }
    finally {
      setCapturing(false);
    }
  };

  const onUploadPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      const file = e.target.files?.[0];
      if (!file) return;
      if (!openaiKey) {
        alert("OpenAI API key is required");
        e.target.value = "";
        return;
      }
      if (file.type !== "image/png") {
        alert("Please upload a PNG image (.png)");
        e.target.value = "";
        return;
      }
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const result = String(reader.result || "");
            const base64 = result.includes(",") ? result.split(",")[1] : "";
            if (!base64) reject(new Error("Failed to encode image"));
            else resolve(base64);
          } catch (err) {
            reject(err as Error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const firstUrl = urls.split(/\n|,|\s+/).map((u) => u.trim()).filter(Boolean)[0] || "";
      const res = await fetch("/api/ingest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: firstUrl, screenshotBase64: b64, screenshotMime: "image/png", visionModel, openaiKey }) });
      const json = await res.json();
      setResults(json.results as RunResult[]);
    } catch (err: any) {
      setResults([{ url: "", ok: false, error: err?.message || "Upload failed" }]);
    } finally {
      try { (e.target as HTMLInputElement).value = ""; } catch {}
      setUploading(false);
    }
  };

  const Spinner = () => (
    <svg width="18" height="18" viewBox="0 0 50 50" aria-hidden="true" role="img">
      <circle cx="25" cy="25" r="20" stroke="#0b2a3d" strokeWidth="5" fill="none" strokeOpacity="0.2"></circle>
      <path d="M25 5 a20 20 0 0 1 0 40" stroke="#0b2a3d" strokeWidth="5" fill="none">
        <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  );

  // removed mini-browser snapshot logic

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const list = urls
      .split(/\n|,|\s+/)
      .map((u) => u.trim())
      .filter((u) => u);
    if (list.length === 0) return;
    if (!openaiKey) {
      alert("OpenAI API key is required");
      return;
    }
    setLoading(true);
    setResults([]);
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls: list, openaiKey }),
      });
      const json = await res.json();
      setResults(json.results as RunResult[]);
    } catch (err: any) {
      setResults(
        list.map((url) => ({ url, ok: false, error: err?.message ?? "Unknown error" }))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 style={{ marginBottom: 8 }}>MELI Competitor Capture MVP</h1>
      <p style={{ opacity: 0.8, marginBottom: 24 }}>
        Enter one or more product URLs (newline or comma separated). The app will
        screenshot and extract product, price, and promotions.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <textarea
          value={urls}
          onChange={(e) => onSetUrls(e.target.value)}
          placeholder="https://example.com/product/123"
          rows={6}
          style={{ width: "100%", padding: 12, borderRadius: 8 }}
        />
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <label htmlFor="visionModel" style={{ opacity: 0.85 }}>Vision model:</label>
          <select id="visionModel" value={visionModel} onChange={(e) => onSetModel(e.target.value)} style={{ padding: "8px 10px", borderRadius: 8 }}>
            <option value="gpt-4o-mini">gpt-4o-mini</option>
            <option value="gpt-4o">gpt-4o</option>
          </select>
          <input
            type="password"
            placeholder="OpenAI API Key"
            value={openaiKey}
            onChange={(e) => onSetKey(e.target.value)}
            style={{ flex: 1, minWidth: 300, padding: "8px 10px", borderRadius: 8 }}
          />
        </div>
        <button disabled={loading} style={{ padding: "10px 16px", borderRadius: 8 }}>
          {loading ? "Running..." : "Run"}
        </button>
        <button type="button" onClick={onClientCapture} disabled={capturing || loading} style={{ padding: "10px 16px", borderRadius: 8, opacity: capturing ? 0.7 : 1 }}>
          {capturing ? "Capturing..." : "Client capture (pick tab)"}
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label htmlFor="uploadPng" style={{ padding: "10px 16px", borderRadius: 8, background: "#0b2a3d", color: "#f2f7fb", cursor: uploading ? "default" : "pointer", display: "inline-block", opacity: uploading ? 0.7 : 1, pointerEvents: uploading ? "none" : "auto" }}>
            {uploading ? "Uploading..." : "Upload screenshot (PNG)"}
          </label>
          <input id="uploadPng" type="file" accept="image/png" onChange={onUploadPng} style={{ display: "none" }} />
          <span style={{ fontSize: 12, opacity: 0.7 }}>Attach a .png screenshot to extract title, price and promos.</span>
        </div>
        {(loading || capturing || uploading) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#eef6fc", border: "1px solid #cfe3f1", color: "#0b2a3d", padding: 10, borderRadius: 10 }}>
            <Spinner />
            <div style={{ fontWeight: 600 }}>
              {capturing ? "Capturing tab and running inference..." : uploading ? "Processing uploaded screenshot..." : "Running inference on URLs..."}
            </div>
          </div>
        )}
      </form>
      {/* Research bar removed from Capture view. Use the Research tab instead. */}
      

      {results.length > 0 && (
        <div style={{ marginTop: 32, display: "grid", gap: 24 }}>
          {results.map((r) => (
            <div key={r.url} style={{ background: "#ffffff", padding: 16, borderRadius: 10, border: "1px solid #cfe3f1", boxShadow: "0 1px 3px rgba(11,42,61,0.06)" }}>
              <div style={{ marginBottom: 8, wordBreak: "break-all" }}>
                <strong>URL:</strong> {r.url}
              </div>
              {!r.ok && <div style={{ color: "#b00020" }}>{r.error}</div>}
              {r.ok && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  <div>
                    {r.data && (
                      <>
                        <div><strong>Title (raw):</strong> {r.data.title ?? "-"}</div>
                        <div>
                          <strong>Price (raw):</strong> {r.data.price?.raw ?? "-"} (
                          {r.data.price?.currency ?? "?"} / {r.data.price?.value ?? "?"})
                        </div>
                        <div>
                          <strong>Promotions (raw):</strong> {r.data.promotions?.join(", ") || "-"}
                        </div>
                      </>
                    )}
                    {r.refined && (
                      <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #d7e7f3" }}>
                        <div style={{ fontWeight: 700, marginBottom: 6 }}>Refined summary</div>
                        <div>
                          <span style={{ fontWeight: 600 }}>Title:</span> {r.refined.title ?? "-"}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>Price:</span> {r.refined.price_value ?? "-"} {r.refined.price_currency ?? ""}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600 }}>Has discount:</span> {r.refined.has_discount === null ? "?" : r.refined.has_discount ? "Yes" : "No"}
                        </div>
                        {r.refined.promo_summary && (
                          <div style={{ marginTop: 8, background: "#f6fbff", border: "1px solid #cfe3f1", borderRadius: 8, padding: 10 }}>
                            <div dangerouslySetInnerHTML={{ __html: r.refined.promo_summary.replace(/\n/g, "<br/>") }} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    {r.data?.screenshotBase64 && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`data:${r.data.screenshotMime || 'image/png'};base64,${r.data.screenshotBase64}`}
                        alt="screenshot"
                        style={{ width: "100%", borderRadius: 8, border: "1px solid #cfe3f1" }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

