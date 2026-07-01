// NovaMind API Worker — novamind-api
// Serves: /api/v1/* REST endpoints + Pyxis AI chat + incident control
// Attack surfaces: data exfil (/customers/export), IDOR (/training-data, /users),
//                  prompt injection (/chat), RCE bait (/admin), cred stuffing (/auth/login)

// ── Generates a large synthetic customer dataset for exfil simulation ────────
function generateCustomers(count = 500) {
  const firstNames = ["James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","William","Barbara","David","Susan","Richard","Jessica","Joseph","Sarah","Thomas","Karen","Charles","Lisa"];
  const lastNames  = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin"];
  const domains    = ["gmail.com","yahoo.com","outlook.com","novamind.ai","hotmail.com"];
  const states     = ["CA","NY","TX","FL","IL","PA","OH","GA","NC","MI"];

  return Array.from({ length: count }, (_, i) => {
    const first = firstNames[i % firstNames.length];
    const last  = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
    return {
      id:             10000 + i,
      first_name:     first,
      last_name:      last,
      email:          `${first.toLowerCase()}.${last.toLowerCase()}${i}@${domains[i % domains.length]}`,
      phone:          `+1-${String(200 + (i % 800)).padStart(3,"0")}-555-${String(1000 + i).slice(-4)}`,
      address:        `${100 + i} Main St`,
      city:           ["New York","Los Angeles","Chicago","Houston","Phoenix"][i % 5],
      state:          states[i % states.length],
      zip:            String(10000 + (i * 7) % 89999).padStart(5,"0"),
      created_at:     new Date(Date.now() - (i * 86400000)).toISOString(),
      total_orders:   Math.floor(Math.random() * 50),
      lifetime_value: parseFloat((Math.random() * 5000).toFixed(2)),
      card_last4:     String(1000 + (i * 13) % 8999),
      card_type:      ["Visa","Mastercard","Amex"][i % 3],
    };
  });
}

const ALL_CUSTOMERS = generateCustomers(500);

const MOCK_TOKEN = "mock-jwt-token-novamind-abc123";

// ── Mock Pyxis AI responses (rotated by hash of prompt) ─────────────────────
const MOCK_RESPONSES = [
  "I can help you build and deploy enterprise AI models at scale. Our Pyxis platform supports fine-tuning on proprietary datasets with full data isolation. Would you like to see a demo?",
  "Pyxis Chat API supports streaming responses, function calling, and context windows up to 200K tokens. Our enterprise tier includes SLA guarantees and dedicated inference capacity.",
  "Great question! NovaMind's DataVault platform provides end-to-end encryption for training data with SOC 2 Type II compliance. Data never leaves your VPC unless you explicitly configure cross-region replication.",
  "NovaMind Autopilot can orchestrate multi-step AI workflows across your existing tools. It integrates with Slack, Salesforce, Jira, and 200+ enterprise applications out of the box.",
  "Pyxis inference API averages sub-80ms p50 latency globally, backed by our distributed edge inference network. We currently operate in 18 regions with automatic failover.",
  "I'm Pyxis, NovaMind's enterprise AI assistant. I can answer questions about our platform, help you understand pricing tiers, or connect you with our solutions engineering team.",
  "For compliance-sensitive deployments, we offer NovaMind Private Cloud — a fully isolated deployment on your infrastructure or dedicated cloud tenancy. HIPAA BAA and FedRAMP High authorization available.",
  "Our vector search and RAG pipeline capabilities allow you to ground model responses in your proprietary knowledge bases. Latency overhead for RAG is typically under 20ms per query.",
  "NovaMind supports OpenAI-compatible API endpoints, so migration from existing providers requires minimal code changes — usually just swapping the base URL and API key.",
  "The ModelForge fine-tuning platform supports LoRA, QLoRA, and full-parameter fine-tuning. Training runs are isolated per tenant and audit logs are retained for 90 days by default.",
  "Our enterprise plan includes 99.99% uptime SLA, priority support with 15-minute response times, and a dedicated customer success manager. Annual contracts also include on-site training.",
  "I can help generate synthetic training data, analyze dataset quality, run bias evaluations, and recommend augmentation strategies to improve your model's performance on edge cases.",
  "NovaMind's API gateway supports rate limiting, quota management, and per-key usage analytics. You can create scoped API keys with read-only or specific endpoint permissions.",
  "For multi-tenant SaaS applications, we recommend our Namespace Isolation feature which provides cryptographically separate model contexts per end-user — preventing cross-tenant data leakage.",
  "Our security team publishes quarterly transparency reports and we participate in HackerOne's bug bounty program. Current CVSS scores for open findings are all below 4.0.",
];

// ── Module-global incident state (fallback when KV binding is absent) ────────
let moduleIncidentState = {
  active:            false,
  title:             "",
  message:           "",
  severity:          "none",       // none | warning | critical
  affected_services: [],
  started_at:        null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type":           "application/json",
      "X-API-Version":          "v1",
      "X-Content-Type-Options": "nosniff",
      ...corsHeaders(),
    },
  });
}

// LAB NOTE: wildcard CORS is intentional — the export endpoint is a data exfil target.
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function requireAuth(request) {
  const auth = request.headers.get("Authorization") || "";
  if (auth !== `Bearer ${MOCK_TOKEN}`) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }
  return null;
}

// Simple string hash for deterministic mock response selection
function strHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Read incident state: KV first, module-global fallback
async function getIncidentState(env) {
  if (env.INCIDENT_KV) {
    try {
      const raw = await env.INCIDENT_KV.get("incident_state");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
  }
  return moduleIncidentState;
}

// Write incident state: KV + module-global
async function setIncidentState(env, state) {
  moduleIncidentState = state;
  if (env.INCIDENT_KV) {
    try {
      await env.INCIDENT_KV.put("incident_state", JSON.stringify(state));
    } catch (_) {}
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // ── Health check ──────────────────────────────────────────────────────────
    if (path === "/" || path === "/api/v1/health") {
      return jsonResponse({
        status:    "healthy",
        service:   "NovaMind API",
        version:   "2.1.0",
        timestamp: new Date().toISOString(),
        services:  { database: "ok", cache: "ok", inference: "ok", training: "ok" },
      });
    }

    // ── Auth login — cred stuffing / brute force target ───────────────────────
    // LAB NOTE: credentials are configurable via Wrangler secrets.
    // Set via: wrangler secret put API_USERNAME / wrangler secret put API_PASSWORD
    if (path === "/api/v1/auth/login" && method === "POST") {
      const body = await request.json().catch(() => ({}));
      const { username, password } = body;
      if (!username || !password) {
        return jsonResponse({ success: false, error: "Missing credentials" }, 400);
      }
      const validUser = env.API_USERNAME || "api_user@novamind.ai";
      const validPass = env.API_PASSWORD || "ApiUser2026!";
      if (username === validUser && password === validPass) {
        return jsonResponse({ success: true, token: MOCK_TOKEN, expires_in: 3600 });
      }
      return jsonResponse({ success: false, error: "Invalid credentials" }, 401);
    }

    // ── List customers (paginated) — requires auth ────────────────────────────
    if (path === "/api/v1/customers" && method === "GET") {
      const authErr = requireAuth(request);
      if (authErr) return authErr;
      const page     = parseInt(url.searchParams.get("page")  || "1");
      const limit    = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
      const offset   = (page - 1) * limit;
      const customers = ALL_CUSTOMERS.slice(offset, offset + limit);
      return jsonResponse({
        success:     true,
        page,
        limit,
        total:       ALL_CUSTOMERS.length,
        total_pages: Math.ceil(ALL_CUSTOMERS.length / limit),
        data:        customers,
      });
    }

    // ── Customer export — data exfil target ───────────────────────────────────
    // LAB NOTE: auth check is intentionally weak — attack scripts obtain the token
    // via credential stuffing on /auth/login, then bulk-pull here to generate exfil logs.
    if (path === "/api/v1/customers/export" && method === "GET") {
      const authErr = requireAuth(request);
      if (authErr) return authErr;
      const format = url.searchParams.get("format") || "json";
      if (format === "csv") {
        const headers = Object.keys(ALL_CUSTOMERS[0]).join(",");
        const rows    = ALL_CUSTOMERS.map(c => Object.values(c).map(v => `"${v}"`).join(","));
        const csv     = [headers, ...rows].join("\n");
        return new Response(csv, {
          headers: {
            "Content-Type":        "text/csv",
            "Content-Disposition": 'attachment; filename="novamind_customers_export.csv"',
            "X-Record-Count":      String(ALL_CUSTOMERS.length),
          },
        });
      }
      return jsonResponse({
        success:     true,
        exported_at: new Date().toISOString(),
        record_count: ALL_CUSTOMERS.length,
        data:        ALL_CUSTOMERS,
      });
    }

    // ── Single customer ───────────────────────────────────────────────────────
    if (path.match(/^\/api\/v1\/customers\/\d+$/) && method === "GET") {
      const id       = parseInt(path.split("/")[4]);
      const customer = ALL_CUSTOMERS.find(c => c.id === id);
      if (!customer) return jsonResponse({ success: false, error: "Customer not found" }, 404);
      return jsonResponse({ success: true, data: customer });
    }

    // ── Orders ────────────────────────────────────────────────────────────────
    if (path === "/api/v1/orders" && method === "GET") {
      const orders = Array.from({ length: 25 }, (_, i) => ({
        id:          `ORD-NM-${10000 + i}`,
        customer_id: 10000 + (i * 7 % 500),
        status:      ["pending","processing","shipped","delivered","cancelled"][i % 5],
        total:       parseFloat((50 + Math.random() * 450).toFixed(2)),
        items:       Math.floor(1 + Math.random() * 8),
        created_at:  new Date(Date.now() - i * 3600000).toISOString(),
      }));
      return jsonResponse({ success: true, total: orders.length, data: orders });
    }

    // ── Pyxis model registry — GET /api/v1/models ────────────────────────────
    if (path === "/api/v1/models" && method === "GET") {
      return jsonResponse({
        object: "list",
        data: [
          {
            id:             "pyxis-chat-v2",
            object:         "model",
            created:        1700000000,
            owned_by:       "novamind",
            context_window: 200000,
            tier:           "enterprise",
            description:    "Flagship Pyxis chat model — 200K context, function calling, vision",
          },
          {
            id:             "pyxis-chat-v2-fast",
            object:         "model",
            created:        1710000000,
            owned_by:       "novamind",
            context_window: 32000,
            tier:           "standard",
            description:    "Low-latency Pyxis model — 3x faster, best for interactive use",
          },
          {
            id:             "pyxis-forge-v1-finetuned",
            object:         "model",
            created:        1715000000,
            owned_by:       "tenant",
            context_window: 128000,
            tier:           "custom",
            description:    "Tenant fine-tuned Pyxis model via ModelForge — isolated per customer",
          },
          {
            id:             "pyxis-embed-v1",
            object:         "model",
            created:        1705000000,
            owned_by:       "novamind",
            context_window: 8192,
            tier:           "standard",
            description:    "Pyxis text embedding model — 1536 dimensions, RAG-optimized",
          },
        ],
        total: 4,
        staging: [
          { id: "pyxis-chat-v3", status: "staging", context_window: 500000 },
        ],
      });
    }

    // ── Training data — IDOR / data-exfil + poisoning target ─────────────────
    // Returns 401 for unauthenticated — attack team expects this; WAF fires on attempts
    if (path === "/api/v1/training-data" && method === "GET") {
      const authErr = requireAuth(request);
      if (authErr) return authErr;
      return jsonResponse({
        datasets: [
          {
            id:       "ds_8f3a2c",
            name:     "enterprise-qa-v2",
            rows:     847293,
            size_gb:  12.4,
            status:   "ready",
            owner:    "tenant:orbis-financial",
          },
          {
            id:       "ds_4e7b1d",
            name:     "support-tickets-2024",
            rows:     142000,
            size_gb:  3.1,
            status:   "processing",
            owner:    "tenant:orbis-financial",
          },
          {
            id:       "ds_9c2f1a",
            name:     "pyxis-base-pretrain-v2",
            rows:     14200000,
            size_gb:  980,
            status:   "locked",
            owner:    "novamind:internal",
          },
        ],
      });
    }

    // ── Users — IDOR target ───────────────────────────────────────────────────
    if (path === "/api/v1/users" && method === "GET") {
      const authErr = requireAuth(request);
      if (authErr) return authErr;
      return jsonResponse({
        users: [
          { id: "usr_001", email: "admin@novamind.ai",    role: "owner",   mfa: true  },
          { id: "usr_002", email: "eng@novamind.ai",      role: "member",  mfa: true  },
          { id: "usr_003", email: "billing@novamind.ai",  role: "billing", mfa: false },
          { id: "usr_004", email: "ci-bot@novamind.ai",   role: "api",     mfa: false },
        ],
      });
    }

    // ── Admin — always 401 WAF bait ───────────────────────────────────────────
    if (path === "/api/v1/admin") {
      return jsonResponse({
        error:   "Unauthorized",
        code:    401,
        message: "Administrator access requires valid session and MFA. This attempt has been logged.",
      }, 401);
    }

    // ── Pyxis Chat — POST /api/v1/chat ───────────────────────────────────────
    // Prompt injection / Firewall-for-AI target.
    // REAL-READY: if env.PYXIS_LLM_PROVIDER + env.PYXIS_LLM_KEY are set, or a
    //             Workers AI binding (env.AI) exists, route to the real LLM.
    //             Currently mocked — see TODO below.
    if (path === "/api/v1/chat" && method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const prompt = body.prompt || body.message || (body.messages && body.messages[body.messages.length - 1]?.content) || "";
      if (!prompt) {
        return jsonResponse({ error: "prompt (or messages) is required" }, 400);
      }

      // TODO: Wire real LLM here.
      // if (env.PYXIS_LLM_PROVIDER === "workers-ai" && env.AI) {
      //   const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", { prompt });
      //   // ... shape response and return
      // } else if (env.PYXIS_LLM_PROVIDER === "anthropic" && env.PYXIS_LLM_KEY) {
      //   // call Anthropic Messages API, return shaped response
      // }

      // Fake latency so the demo feels real (300–900 ms)
      const delay = 300 + Math.floor(Math.random() * 600);
      await new Promise(r => setTimeout(r, delay));

      const responseText    = MOCK_RESPONSES[strHash(prompt) % MOCK_RESPONSES.length];
      const promptTokens    = prompt.split(/\s+/).length;
      const completionTokens = responseText.split(/\s+/).length;

      // Generate a hex suffix for the completion ID
      const hexBytes = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("");

      return jsonResponse({
        id:      `chatcmpl-${hexBytes}`,
        object:  "chat.completion",
        model:   "pyxis-chat-v2",
        choices: [{
          index:         0,
          message:       { role: "assistant", content: responseText },
          finish_reason: "stop",
        }],
        usage: {
          prompt_tokens:     promptTokens,
          completion_tokens: completionTokens,
          total_tokens:      promptTokens + completionTokens,
        },
      });
    }

    // ── Incident state — GET /api/incident ────────────────────────────────────
    if (path === "/api/incident" && method === "GET") {
      const state = await getIncidentState(env);
      return jsonResponse(state);
    }

    // ── Incident control — POST /api/incident ─────────────────────────────────
    // Key-gated. Attack simulator CTF mode POSTs here on start/stop.
    // LAB NOTE: set INCIDENT_KEY via: wrangler secret put INCIDENT_KEY
    if (path === "/api/incident" && method === "POST") {
      let data;
      try {
        data = await request.json();
      } catch (_) {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }

      const expectedKey = env.INCIDENT_KEY || "change-this-incident-key";
      if (data.key !== expectedKey) {
        return jsonResponse({ error: "Forbidden" }, 403);
      }

      const newState = {
        active:            Boolean(data.active),
        title:             data.title             ?? "",
        message:           data.message           ?? "",
        severity:          data.severity          ?? "none",
        affected_services: data.affected_services ?? [],
        started_at:        data.started_at        ?? null,
      };

      await setIncidentState(env, newState);
      return jsonResponse({ ok: true, state: newState });
    }

    return jsonResponse({ success: false, error: "Not found" }, 404);
  },
};
