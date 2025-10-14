from fastapi import FastAPI
from pydantic import BaseModel
import os
import json
from typing import List, Optional
import re

try:
    from openai import OpenAI
except Exception:  # pragma: no cover
    OpenAI = None  # type: ignore


class RefineInput(BaseModel):
    url: str
    title: Optional[str] = None
    price_raw: Optional[str] = None
    price_value: Optional[float] = None
    price_currency: Optional[str] = None
    promotions: List[str] = []
    openai_key: Optional[str] = None


class RefineOutput(BaseModel):
    title: Optional[str] = None
    price_value: Optional[float] = None
    price_currency: Optional[str] = None
    has_discount: Optional[bool] = None
    promo_summary: Optional[str] = None


app = FastAPI(title="Product Capture Python Backend")


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/refine", response_model=RefineOutput)
def refine(payload: RefineInput):
    # Heuristic normalization first
    def detect_currency(url: str, raw: Optional[str]) -> Optional[str]:
        if raw and "R$" in raw:
            return "BRL"
        if raw and "€" in raw:
            return "EUR"
        if raw and "£" in raw:
            return "GBP"
        if raw and "$" in raw:
            # default to BRL for .br domains if ambiguous
            if url.endswith(".br") or ".com.br" in url:
                return "BRL"
            return "USD"
        if url.endswith(".br") or ".com.br" in url:
            return "BRL"
        return None

    def parse_localized_number(raw: Optional[str], currency: Optional[str], url: str) -> Optional[float]:
        if not raw:
            return None
        s = re.sub(r"[^0-9,.-]", "", raw)
        if not s:
            return None
        is_brl = (currency == "BRL") or ("R$" in raw) or (url.endswith(".br") or ".com.br" in url)
        has_comma = "," in s
        has_dot = "." in s
        if is_brl:
            s = s.replace(".", "").replace(",", ".")
            try:
                return float(s)
            except Exception:
                return None
        if has_comma and has_dot:
            # assume comma thousands
            s = s.replace(",", "")
            try:
                return float(s)
            except Exception:
                return None
        if has_comma and not has_dot:
            try:
                return float(s.replace(",", "."))
            except Exception:
                return None
        try:
            return float(s)
        except Exception:
            return None

    def currency_symbol(code: Optional[str], url: str) -> str:
        if code == "BRL" or url.endswith(".br") or ".com.br" in url:
            return "R$"
        if code == "EUR":
            return "€"
        if code == "GBP":
            return "£"
        return "$"

    def format_money(val: Optional[float], code: Optional[str], url: str) -> Optional[str]:
        if val is None:
            return None
        sym = currency_symbol(code, url)
        if code == "BRL" or url.endswith(".br") or ".com.br" in url:
            return f"{sym}{val:.2f}".replace(".", ",")
        return f"{sym}{val:.2f}"

    def summarize_promotions(promos: List[str], url: str, code: Optional[str]) -> Optional[str]:
        if not promos:
            return None
        # Dedupe and normalize
        norm: List[str] = []
        seen = set()
        for p in promos:
            if not p:
                continue
            t = re.sub(r"\s+", " ", p.strip())
            l = t.lower()
            if l in seen:
                continue
            seen.add(l)
            norm.append(t)

        # Signals
        has_free = any(("shipping" in s.lower() or "freight" in s.lower()) and ("free" in s.lower() or "gratis" in s.lower() or "grátis" in s.lower()) for s in norm)
        percents: List[int] = []
        for s in norm:
            for m in re.finditer(r"(\d{1,3})\s*%\s*off", s, flags=re.I):
                try:
                    percents.append(int(m.group(1)))
                except Exception:
                    pass
        installments = []  # (n, amount, s_juros)
        for s in norm:
            m = re.search(r"(\d{1,2})\s*x\s*([R$€£\$]?\s*[0-9][0-9.,]*)", s, flags=re.I)
            if m:
                try:
                    n = int(m.group(1))
                except Exception:
                    continue
                amt_raw = m.group(2)
                amt_val = parse_localized_number(amt_raw, code, url)
                s_juros = bool(re.search(r"sem\s+juros|s\/\s*juros", s, flags=re.I))
                installments.append((n, amt_val, s_juros))

        parts: List[str] = []
        if percents:
            parts.append(f"{max(percents)}% OFF")
        if installments:
            # Prefer higher N, then lower amount
            n, amt, s_juros = sorted(installments, key=lambda x: (-x[0], x[1] or 0.0))[0]
            amt_str = format_money(amt, code, url) or ""
            inst = f"{n}x {amt_str}".strip()
            if s_juros:
                inst += " no interest"
            parts.append(inst)
        if has_free:
            parts.append("Free shipping")

        # Add up to 2 more short, relevant items
        for s in norm:
            if len(parts) >= 3:
                break
            key = s.lower()
            if any(k in key for k in ["off", "cupom", "voucher", "frete", "juros"]):
                if all(s.lower() != p.lower() for p in parts) and len(s) <= 60:
                    parts.append(s)

        if not parts:
            parts = norm[:2]
        return "; ".join(parts)

    norm_currency = detect_currency(payload.url, payload.price_raw) or (payload.price_currency.upper() if payload.price_currency else None)
    norm_value = payload.price_value if payload.price_value is not None else parse_localized_number(payload.price_raw, norm_currency, payload.url)

    # Heuristic promo summary
    promo_summary_heur = summarize_promotions(payload.promotions, payload.url, norm_currency)

    # If no OpenAI key, return heuristic normalization
    api_key = payload.openai_key or os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        raise ValueError("OPENAI_API_KEY is required for refine")

    client = OpenAI(api_key=api_key)
    system = "You are an ecommerce pricing analyst. Normalize fields and return strict JSON."
    user = json.dumps(
        {
            "url": payload.url,
            "title": payload.title,
            "price_raw": payload.price_raw,
            "price_value": payload.price_value,
            "price_currency": payload.price_currency,
            "promotions": payload.promotions,
            "instructions": "Return JSON with keys: title, price_value, price_currency, has_discount, promo_summary.",
        },
        ensure_ascii=False,
    )

    resp = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
    )
    content = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
        # Prefer heuristic promo summary if present; otherwise use model output
        model_summary = data.get("promo_summary") if isinstance(data, dict) else None
        return RefineOutput(
            title=data.get("title", payload.title),
            price_value=data.get("price_value", norm_value),
            price_currency=data.get("price_currency", norm_currency),
            has_discount=data.get("has_discount"),
            promo_summary=promo_summary_heur or model_summary,
        )
    except Exception:
        has_discount = True if payload.promotions else None
        promo_summary = "; ".join(payload.promotions[:3]) if payload.promotions else None
        return RefineOutput(
            title=payload.title,
            price_value=norm_value,
            price_currency=norm_currency,
            has_discount=has_discount,
            promo_summary=promo_summary_heur or promo_summary,
        )


# ===== Image extraction from screenshot (caption/OCR) =====
class PriceInfo(BaseModel):
    raw: Optional[str] = None
    value: Optional[float] = None
    currency: Optional[str] = None


class ImageExtractInput(BaseModel):
    url: Optional[str] = None
    screenshot_base64: str
    mime: Optional[str] = None
    model: Optional[str] = None  # override vision model
    openai_key: Optional[str] = None


class ImageExtractOutput(BaseModel):
    title: Optional[str] = None
    price: PriceInfo = PriceInfo()
    promotions: List[str] = []


@app.post("/image_extract", response_model=ImageExtractOutput)
def image_extract(payload: ImageExtractInput):
    api_key = payload.openai_key or os.getenv("OPENAI_API_KEY")
    if not api_key or OpenAI is None:
        raise ValueError("OPENAI_API_KEY is required for image extraction")

    client = OpenAI(api_key=api_key)
    system = (
        "You are an information extractor for e-commerce. "
        "You will receive a screenshot of a product page (Amazon, eBay, Shopify, etc.). "
        "Extract in STRICT JSON: {title, price_raw, price_value, price_currency, promotions}. "
        "title: product title, short and direct (up to ~120 characters). "
        "price_raw: as it appears on screen (e.g., '$229.99' or 'R$ 229,99'). "
        "price_value: decimal number (e.g., 229.99). For BRL, comma is decimal. "
        "price_currency: ISO code (BRL/EUR/GBP/USD) when evident, otherwise null. "
        "promotions: array of short visible phrases (e.g., 'Free shipping', '10% OFF', '3x $50.00 no interest'). "
        "Prioritize large/accentuated elements near the price (usually in red) and title blocks."
    )

    user_parts = [
        {"type": "text", "text": f"URL: {payload.url or ''}"},
        {
            "type": "image_url",
            "image_url": {"url": f"data:{payload.mime or 'image/jpeg'};base64,{payload.screenshot_base64}"},
        },
    ]

    chosen_model = payload.model or os.getenv("OPENAI_VISION_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    resp = client.chat.completions.create(
        model=chosen_model,
        temperature=0,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_parts},
        ],
        response_format={"type": "json_object"},
    )

    content = resp.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
    except Exception:
        data = {}

    raw_title: Optional[str] = data.get("title") if isinstance(data, dict) else None
    price_raw: Optional[str] = data.get("price_raw") if isinstance(data, dict) else None
    price_currency: Optional[str] = data.get("price_currency") if isinstance(data, dict) else None
    price_value: Optional[float] = data.get("price_value") if isinstance(data, dict) else None
    promos: List[str] = data.get("promotions") if isinstance(data, dict) and isinstance(data.get("promotions"), list) else []

    # If price still missing, run a second pass focusing on text snippets that look like prices and promos
    if price_value is None and not price_raw:
        second_system = (
            "Find price and promotion patterns in the screenshot. "
            "Return strict JSON: {price_raw, price_value, price_currency, promotions}. "
            "Look for patterns like '$1234.56', '10% OFF', '3x $50.00', 'Free shipping'."
        )
        second = client.chat.completions.create(
            model=chosen_model,
            temperature=0,
            messages=[
                {"role": "system", "content": second_system},
                {"role": "user", "content": user_parts},
            ],
            response_format={"type": "json_object"},
        )
        second_content = second.choices[0].message.content or "{}"
        try:
            d2 = json.loads(second_content)
        except Exception:
            d2 = {}
        price_raw = price_raw or (d2.get("price_raw") if isinstance(d2, dict) else None)
        price_currency = price_currency or (d2.get("price_currency") if isinstance(d2, dict) else None)
        price_value = price_value or (d2.get("price_value") if isinstance(d2, dict) else None)
        if isinstance(d2, dict) and isinstance(d2.get("promotions"), list):
            promos = promos or d2.get("promotions")

    # Normalize currency/value using same helpers from refine
    def detect_currency(url: str, raw: Optional[str]) -> Optional[str]:
        if raw and "R$" in raw:
            return "BRL"
        if raw and "€" in raw:
            return "EUR"
        if raw and "£" in raw:
            return "GBP"
        if raw and "$" in raw:
            if url and (url.endswith(".br") or ".com.br" in url):
                return "BRL"
            return "USD"
        if url and (url.endswith(".br") or ".com.br" in url):
            return "BRL"
        return None

    def parse_localized_number(raw: Optional[str], currency: Optional[str], url: str) -> Optional[float]:
        if not raw:
            return None
        s = re.sub(r"[^0-9,.-]", "", raw)
        if not s:
            return None
        is_brl = (currency == "BRL") or (raw and "R$" in raw) or (url.endswith(".br") or ".com.br" in url)
        has_comma = "," in s
        has_dot = "." in s
        if is_brl:
            s = s.replace(".", "").replace(",", ".")
            try:
                return float(s)
            except Exception:
                return None
        if has_comma and has_dot:
            s = s.replace(",", "")
            try:
                return float(s)
            except Exception:
                return None
        if has_comma and not has_dot:
            try:
                return float(s.replace(",", "."))
            except Exception:
                return None
        try:
            return float(s)
        except Exception:
            return None

    norm_currency = price_currency or detect_currency(payload.url or "", price_raw)
    norm_value = price_value if price_value is not None else parse_localized_number(price_raw, norm_currency, payload.url or "")

    return ImageExtractOutput(
        title=raw_title,
        price=PriceInfo(raw=price_raw, value=norm_value, currency=norm_currency),
        promotions=promos,
    )

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))


