# Deployment Guide

This project is configured for deployment on Vercel as a monorepo with both frontend (Next.js) and backend (FastAPI/Python).

## Project Structure

```
.
├── meli-agentic-app/          # Next.js frontend
│   ├── app/
│   ├── lib/
│   ├── package.json
│   └── vercel.json            # Frontend-specific config
├── py-backend/                 # Python FastAPI backend
│   ├── app.py
│   ├── requirements.txt
│   └── vercel.json            # Standalone backend config (optional)
└── vercel.json                # Root monorepo config (use this for deployment)
```

## Deployment Options

### Option 1: Full Stack Deployment (Recommended)

Deploy both frontend and backend together from the root directory.

1. **Connect to Vercel:**
   - Connect your Git repository to Vercel
   - Use the **root directory** as the deployment source

2. **Environment Variables:**
   Set these in Vercel dashboard:
   ```
   OPENAI_API_KEY=your-openai-key
   ```

3. **How it works:**
   - Frontend: Accessible at `https://your-app.vercel.app`
   - Backend: Accessible at `https://your-app.vercel.app/py-api/*`
   - Next.js API routes: `https://your-app.vercel.app/api/*`

### Option 2: Separate Deployments

#### Frontend Only:
1. Set root directory to `meli-agentic-app`
2. Set environment variable: `PY_BACKEND_URL=https://your-backend-url`

#### Backend Only:
1. Set root directory to `py-backend`
2. Uses `py-backend/vercel.json` for configuration

## Local Development

1. **Start Backend:**
   ```bash
   cd py-backend
   source .venv/bin/activate
   uvicorn app:app --reload --port 8002
   ```

2. **Start Frontend:**
   ```bash
   cd meli-agentic-app
   
   # Create .env.local with:
   echo "PY_BACKEND_URL=http://localhost:8002" > .env.local
   
   npm run dev -- --port 3002
   ```

3. **Access:**
   - Frontend: http://localhost:3002
   - Backend: http://localhost:8002
   - Backend health: http://localhost:8002/health

## Python Backend Endpoints

When deployed, these are accessible at `/py-api/*`:

- `GET /py-api/health` - Health check
- `POST /py-api/refine` - Refine product data
- `POST /py-api/image_extract` - Extract data from screenshot

## Troubleshooting

### Backend not responding in production
- Check Vercel function logs
- Verify OPENAI_API_KEY is set in environment variables
- Ensure Python runtime is python3.9 or higher

### CORS errors
- Backend is configured to accept requests from the same domain
- No CORS issues when deployed together

### Local development issues
- Make sure PY_BACKEND_URL is set in `meli-agentic-app/.env.local`
- Backend must be running on port 8002 for local dev
- Frontend must be running on port 3002 for local dev

