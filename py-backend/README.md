# Python Backend for Refinement

## Setup
```bash
cd py-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=...  # optional
uvicorn app:app --reload --port 8000
```

## API
- GET /health
- POST /refine
```json
{
  "url": "https://example.com/p",
  "title": "Product X",
  "price_raw": "$19.99",
  "price_value": 19.99,
  "price_currency": "USD",
  "promotions": ["10% off", "Free shipping"]
}
```

