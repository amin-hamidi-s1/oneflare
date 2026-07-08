# OneFlare Lab UI

Dockerized web app for browsing and running OneFlare attack scenarios.

## Quick Start

```bash
cd oneflare/lab-ui
docker compose up --build
```

Open http://localhost:3000

## Configure

Visit Settings → Cloudflare Configuration and enter your lab credentials.

## Cloudflare Pages Deployment (Frontend Only)

The React frontend can be deployed to Cloudflare Pages:
1. Build: `npm run build` in `frontend/`
2. Deploy `frontend/dist/` to Cloudflare Pages
3. Set environment variable: `VITE_BACKEND_URL=https://your-backend-server.com`
4. The backend (FastAPI) must be hosted separately (VPS, Railway, etc.)
