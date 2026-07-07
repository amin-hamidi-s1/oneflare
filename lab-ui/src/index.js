/**
 * novamind-lab-ui — Worker for the ThreatOps console.
 *
 * Routing (run_worker_first is true, so every request enters here):
 *   /api/*  and  /ws/*   -> backend container (FastAPI/uvicorn, port 8000)
 *   everything else       -> static SPA assets (frontend/dist) via env.ASSETS,
 *                            with SPA fallback to index.html (configured in
 *                            wrangler.jsonc: not_found_handling).
 *
 * The frontend is static, so it is served from Cloudflare's edge as assets
 * rather than from a container. Only the backend needs a container; it is a
 * single-instance Durable Object (fixed id) so the in-memory campaign_engine
 * state stays consistent across requests — sufficient for this demo lab.
 */
import { Container, getContainer } from "@cloudflare/containers";

export class Backend extends Container {
  defaultPort = 8000;
  sleepAfter = "10m";
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isBackendRoute =
      url.pathname.startsWith("/api") || url.pathname.startsWith("/ws");

    if (isBackendRoute) {
      return getContainer(env.BACKEND, "backend-singleton").fetch(request);
    }

    // Static SPA: index.html, hashed JS/CSS assets, and client-side-route
    // fallback are all handled by the assets binding.
    return env.ASSETS.fetch(request);
  },
};
