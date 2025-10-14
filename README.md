# Product Capture & Analysis App

An AI-powered web application for capturing and analyzing product information from e-commerce websites. Built with Next.js, FastAPI, and OpenAI's GPT models.

## 🚀 Features

- **Product Capture**: Automatically screenshot and extract product information from URLs
- **AI-Powered Analysis**: Extract titles, prices, and promotions using GPT-4o-mini or GPT-4o
- **Multi-Source Support**: Works with Amazon, eBay, Shopify, and other e-commerce platforms
- **Research Tool**: Search and compare products across multiple e-commerce sites
- **Client-Side Capture**: Capture screenshots directly from your browser tab
- **Image Upload**: Upload screenshots for analysis
- **Price Refinement**: AI-powered price normalization and promotion summarization

## 🛠️ Tech Stack

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **LangChain & LangGraph** - Agent orchestration

### Backend
- **FastAPI** - Python web framework
- **OpenAI API** - GPT-4o for vision and text analysis
- **Puppeteer** - Browser automation for screenshots

## 📁 Project Structure

```
.
├── frontend/                  # Next.js frontend
│   ├── app/                   # Next.js app directory
│   │   ├── api/              # API routes
│   │   ├── page.tsx          # Main capture page
│   │   └── search/           # Product research page
│   └── lib/                   # Utilities and agents
├── py-backend/                # Python FastAPI backend
│   ├── app.py                # Main FastAPI application
│   └── requirements.txt      # Python dependencies
├── vercel.json               # Vercel deployment config
└── DEPLOYMENT.md             # Deployment guide
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18.17.0 or higher
- Python 3.9 or higher
- OpenAI API key

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/raul-padua/agentic-product-price-scrapping.git
   cd agentic-product-price-scrapping
   ```

2. **Set up the Python backend:**
   ```bash
   cd py-backend
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn app:app --reload --port 8002
   ```

3. **Set up the Next.js frontend:**
   ```bash
   cd frontend
   npm install
   
   # Create .env.local file
   echo "PY_BACKEND_URL=http://localhost:8002" > .env.local
   
   npm run dev -- --port 3002
   ```

4. **Open your browser:**
   - Frontend: http://localhost:3002
   - Backend API docs: http://localhost:8002/docs

## 🌐 Deployment

This project is configured for deployment on Vercel. See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

### Quick Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/raul-padua/agentic-product-price-scrapping)

**Important:** Set the `OPENAI_API_KEY` environment variable in your Vercel project settings.

## 📖 Usage

### Capture Mode

1. Enter one or more product URLs (one per line)
2. Select your preferred vision model (gpt-4o-mini or gpt-4o)
3. Enter your OpenAI API key
4. Click "Run" to capture and analyze

### Client Capture

1. Click "Client capture (pick tab)"
2. Select the browser tab with the product page
3. The app will capture and analyze the page

### Research Mode

1. Navigate to the "Research" tab
2. Enter a search query (e.g., "iPhone 15 256GB prices")
3. Optionally specify e-commerce domains to search
4. Click "Search" to find and compare products

## 🔑 Environment Variables

### Required
- `OPENAI_API_KEY` - Your OpenAI API key

### Optional
- `TAVILY_API_KEY` - For web search functionality
- `PY_BACKEND_URL` - Backend URL (defaults to `/py-api` on Vercel, `http://localhost:8002` for local dev)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- Powered by [OpenAI](https://openai.com/)
- Uses [LangChain](https://langchain.com/) for agent orchestration

## 📧 Contact

For questions or support, please open an issue on GitHub.

