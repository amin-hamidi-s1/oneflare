// NovaMind Shop Worker — novamind-shop
// Serves: NovaMind marketing site (/, /products, /docs) + Pyxis chat UI (/chat)
//         + incident status page (/status) + WAF/XSS/SQLi attack surfaces
// Attack surfaces: /search?q= (XSS/SQLi reflect), /products/:id (traversal bait),
//                  /reviews POST (XSS), /login (cred stuffing surface)

// ── Shared NovaMind dark theme ────────────────────────────────────────────────
const BASE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --navy:      #080f1e;
    --navy2:     #0d1a2e;
    --navy3:     #0f2040;
    --blue:      #2563eb;
    --blue-lt:   #3b82f6;
    --purple:    #7c3aed;
    --purple-lt: #a78bfa;
    --green:     #10b981;
    --yellow:    #f59e0b;
    --red:       #ef4444;
    --text:      #e2e8f0;
    --text-muted:#94a3b8;
    --border:    rgba(255,255,255,0.08);
    --glass:     rgba(255,255,255,0.04);
  }
  body { background: var(--navy); color: var(--text); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.6; min-height: 100vh; }
  a { color: var(--blue-lt); text-decoration: none; }
  a:hover { color: #fff; }
  nav { position: sticky; top: 0; z-index: 100; background: rgba(8,15,30,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }
  .nav-inner { max-width: 1200px; margin: 0 auto; display: flex; align-items: center; gap: 2rem; padding: 0 1.5rem; height: 60px; }
  .nav-logo { display: flex; align-items: center; gap: 0.6rem; font-weight: 700; font-size: 1.05rem; color: #fff; text-decoration: none; }
  .nav-logo-icon { width: 30px; height: 30px; background: linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 800; color: #fff; }
  .nav-links { display: flex; gap: 1.5rem; align-items: center; margin-left: auto; }
  .nav-links a { color: var(--text-muted); font-size: 0.875rem; font-weight: 500; }
  .nav-links a:hover { color: #fff; }
  .nav-cta { background: var(--blue); color: #fff !important; padding: 0.4rem 1rem; border-radius: 6px; font-size: 0.8rem !important; font-weight: 600 !important; }
  .nav-cta:hover { background: var(--blue-lt) !important; }
  footer { border-top: 1px solid var(--border); background: var(--navy2); padding: 2.5rem 1.5rem; margin-top: 4rem; }
  .footer-inner { max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
  .footer-brand { font-weight: 700; color: #fff; font-size: 0.95rem; }
  .footer-brand span { color: var(--text-muted); font-weight: 400; font-size: 0.8rem; display: block; margin-top: 2px; }
  .footer-links { display: flex; gap: 1.5rem; }
  .footer-links a { color: var(--text-muted); font-size: 0.8rem; }
  .footer-copy { color: var(--text-muted); font-size: 0.75rem; }
  .container { max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
  .badge { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.6rem; border-radius: 20px; font-size: 0.72rem; font-weight: 600; }
  .badge-green  { background: rgba(16,185,129,0.15); color: #34d399; border: 1px solid rgba(16,185,129,0.3); }
  .badge-yellow { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.3); }
  .badge-red    { background: rgba(239,68,68,0.15);  color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
  .badge-blue   { background: rgba(37,99,235,0.15);  color: var(--blue-lt); border: 1px solid rgba(37,99,235,0.3); }
  .badge-purple { background: rgba(124,58,237,0.15); color: var(--purple-lt); border: 1px solid rgba(124,58,237,0.3); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; padding: 0.6rem 1.4rem; border-radius: 8px; font-weight: 600; font-size: 0.875rem; cursor: pointer; border: none; transition: all 0.15s; font-family: inherit; text-decoration: none; }
  .btn-primary { background: var(--blue); color: #fff; }
  .btn-primary:hover { background: var(--blue-lt); color: #fff; }
  .btn-ghost { background: transparent; color: var(--text); border: 1px solid var(--border); }
  .btn-ghost:hover { background: var(--glass); border-color: rgba(255,255,255,0.15); }
  .btn-purple { background: var(--purple); color: #fff; }
  .btn-purple:hover { background: #6d28d9; color: #fff; }
  .incident-banner { background: linear-gradient(90deg, #7f1d1d, #991b1b); border-bottom: 1px solid #b91c1c; padding: 0.5rem 1.5rem; text-align: center; font-size: 0.825rem; font-weight: 500; color: #fecaca; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .incident-banner .pulse { width: 8px; height: 8px; border-radius: 50%; background: #f87171; flex-shrink: 0; animation: pulse-red 1.2s ease-in-out infinite; }
  .incident-banner.warning { background: linear-gradient(90deg, #78350f, #92400e); border-color: #b45309; color: #fde68a; }
  .incident-banner.warning .pulse { background: #fbbf24; }
  @keyframes pulse-red { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.4); } }
  code, .mono { font-family: 'JetBrains Mono', monospace; font-size: 0.85em; }
`;

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options":        "DENY",
  "Referrer-Policy":        "strict-origin-when-cross-origin",
  // LAB NOTE: CSP intentionally permits inline scripts/styles — WAF test target.
  // /search reflects ?q= unsanitized (intentional XSS surface for WAF testing).
  "Content-Security-Policy": "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com;",
};

// ── NovaMind product data (replaces generic AcmeShop products) ───────────────
const PRODUCTS = [
  { id: 1, name: "Pyxis Chat API", price: 299,  category: "chat",      stock: 999, tier: "Enterprise" },
  { id: 2, name: "ModelForge Pro", price: 1299, category: "training",  stock: 999, tier: "Enterprise" },
  { id: 3, name: "DataVault 100GB", price: 99,  category: "storage",   stock: 999, tier: "Standard"   },
  { id: 4, name: "Autopilot Beta",  price: 0,   category: "workflows", stock: 500, tier: "Enterprise"  },
  { id: 5, name: "pyxis-embed-v1", price: 49,   category: "embeddings",stock: 999, tier: "Standard"   },
  { id: 6, name: "NovaMind Private Cloud", price: 4999, category: "infrastructure", stock: 20, tier: "Enterprise" },
  { id: 7, name: "Security Audit Add-on",  price: 499,  category: "compliance",     stock: 50, tier: "Enterprise" },
  { id: 8, name: "SLA Upgrade Pack",       price: 199,  category: "support",        stock: 100, tier: "Standard" },
];

// ── Page scaffold ─────────────────────────────────────────────────────────────
function page(title, extraStyles, bodyContent, scripts = "", incidentBanner = "") {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — NovaMind AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${BASE_STYLES}${extraStyles}</style>
</head>
<body>
${incidentBanner}
<nav>
  <div class="nav-inner">
    <a href="/" class="nav-logo">
      <div class="nav-logo-icon">NM</div>
      NovaMind AI
    </a>
    <div class="nav-links">
      <a href="/products">Products</a>
      <a href="/docs">Docs</a>
      <a href="/status">Status</a>
      <a href="/chat">Pyxis Chat</a>
      <a href="/login">Sign In</a>
      <a href="/login" class="nav-cta">Get Started</a>
    </div>
  </div>
</nav>
${bodyContent}
<footer>
  <div class="footer-inner">
    <div class="footer-brand">NovaMind AI<span>Enterprise AI Infrastructure</span></div>
    <div class="footer-links">
      <a href="/products">Products</a>
      <a href="/docs">Documentation</a>
      <a href="/status">Status</a>
      <a href="/login">Sign In</a>
    </div>
    <div class="footer-copy">&copy; 2026 NovaMind Technologies, Inc. All rights reserved.</div>
  </div>
</footer>
${scripts ? `<script>${scripts}</script>` : ""}
</body>
</html>`, { headers: { "Content-Type": "text/html", ...SECURITY_HEADERS } });
}

// ── Homepage ──────────────────────────────────────────────────────────────────
function homePage() {
  const styles = `
    .hero { padding: 6rem 1.5rem 5rem; text-align: center; position: relative; overflow: hidden; }
    .hero::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% -10%, rgba(37,99,235,0.18), transparent), radial-gradient(ellipse 60% 40% at 80% 50%, rgba(124,58,237,0.12), transparent); pointer-events: none; }
    .hero-eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.25); color: var(--blue-lt); padding: 0.3rem 0.9rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; letter-spacing: 0.02em; text-transform: uppercase; margin-bottom: 1.5rem; }
    .hero h1 { font-size: clamp(2.2rem, 5vw, 3.6rem); font-weight: 800; line-height: 1.15; color: #fff; max-width: 760px; margin: 0 auto 1.25rem; letter-spacing: -0.02em; }
    .hero h1 .grad { background: linear-gradient(135deg, var(--blue-lt), var(--purple-lt)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { color: var(--text-muted); font-size: 1.1rem; max-width: 560px; margin: 0 auto 2.5rem; line-height: 1.7; }
    .hero-ctas { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    .stats { max-width: 1200px; margin: 0 auto; padding: 3rem 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.5rem; border-top: 1px solid var(--border); }
    .stat { text-align: center; }
    .stat-val { font-size: 2rem; font-weight: 800; color: #fff; letter-spacing: -0.03em; }
    .stat-val span { color: var(--blue-lt); }
    .stat-lbl { color: var(--text-muted); font-size: 0.8rem; margin-top: 0.2rem; }
    .features { padding: 5rem 1.5rem; }
    .section-header { text-align: center; margin-bottom: 3rem; }
    .section-header h2 { font-size: 2rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem; }
    .section-header p  { color: var(--text-muted); max-width: 500px; margin: 0 auto; }
    .features-grid { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
    .feature-card { background: var(--glass); border: 1px solid var(--border); border-radius: 14px; padding: 1.75rem; transition: border-color 0.2s, transform 0.2s; }
    .feature-card:hover { border-color: rgba(37,99,235,0.4); transform: translateY(-2px); }
    .feature-icon { width: 44px; height: 44px; border-radius: 10px; margin-bottom: 1rem; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; }
    .fi-blue   { background: rgba(37,99,235,0.15); }
    .fi-purple { background: rgba(124,58,237,0.15); }
    .fi-green  { background: rgba(16,185,129,0.15); }
    .fi-orange { background: rgba(245,158,11,0.15); }
    .feature-card h3 { font-size: 1.0rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
    .feature-card p  { color: var(--text-muted); font-size: 0.875rem; line-height: 1.65; }
    .cta-band { margin: 4rem auto; max-width: 900px; padding: 0 1.5rem; }
    .cta-inner { background: linear-gradient(135deg, rgba(37,99,235,0.15), rgba(124,58,237,0.15)); border: 1px solid rgba(37,99,235,0.3); border-radius: 20px; padding: 3.5rem 2rem; text-align: center; }
    .cta-inner h2 { font-size: 1.8rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem; }
    .cta-inner p  { color: var(--text-muted); margin-bottom: 2rem; }
    .cta-inner .ctas { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }
    /* Intentional XSS/SQLi surface — search bar on home */
    .search-bar { display: flex; gap: 8px; max-width: 600px; margin: 0 auto 2.5rem; }
    .search-bar input { flex: 1; padding: 10px 16px; background: var(--navy2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 15px; }
    .search-bar button { padding: 10px 24px; background: var(--blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; }
  `;

  const body = `
    <section class="hero">
      <div class="hero-eyebrow">Now in General Availability</div>
      <h1>Enterprise AI Infrastructure<br><span class="grad">Built for Scale</span></h1>
      <p>NovaMind powers the world's most demanding AI workloads — from model inference to custom fine-tuning and intelligent workflow automation via Pyxis.</p>
      <div class="search-bar">
        <input type="text" id="q" placeholder="Search products and docs..." />
        <button onclick="window.location='/search?q='+encodeURIComponent(document.getElementById('q').value)">Search</button>
      </div>
      <div class="hero-ctas">
        <a href="/login" class="btn btn-primary">Start Building</a>
        <a href="/products" class="btn btn-ghost">View Products</a>
        <a href="/chat" class="btn btn-purple">Try Pyxis Chat</a>
      </div>
    </section>
    <div class="stats container">
      <div class="stat"><div class="stat-val">10<span>M+</span></div><div class="stat-lbl">API calls per day</div></div>
      <div class="stat"><div class="stat-val">99<span>.99%</span></div><div class="stat-lbl">Uptime SLA</div></div>
      <div class="stat"><div class="stat-val">&lt;80<span>ms</span></div><div class="stat-lbl">p50 inference latency</div></div>
      <div class="stat"><div class="stat-val">500<span>+</span></div><div class="stat-lbl">Enterprise customers</div></div>
      <div class="stat"><div class="stat-val">18</div><div class="stat-lbl">Global regions</div></div>
    </div>
    <section class="features">
      <div class="section-header">
        <h2>Everything you need to ship AI</h2>
        <p>One platform for model APIs, training infrastructure, and intelligent automation.</p>
      </div>
      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon fi-blue">&#x1F916;</div>
          <h3>Pyxis Chat API</h3>
          <p>OpenAI-compatible chat completions with 200K context windows, streaming, and function calling. Deploy in minutes with your existing SDK.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon fi-purple">&#x2697;&#xFE0F;</div>
          <h3>ModelForge</h3>
          <p>Fine-tune foundation models on your proprietary data with LoRA and QLoRA support. Full tenant isolation — your data never touches another customer's pipeline.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon fi-green">&#x1F5C4;&#xFE0F;</div>
          <h3>DataVault</h3>
          <p>Secure training data management with end-to-end encryption, dataset versioning, and compliance-ready audit logs. SOC 2 Type II certified.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon fi-orange">&#x26A1;</div>
          <h3>Autopilot</h3>
          <p>Orchestrate multi-step AI workflows across 200+ enterprise integrations. Build agentic pipelines that act on your business data in real time.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon fi-blue">&#x1F510;</div>
          <h3>Enterprise Security</h3>
          <p>SOC 2, HIPAA, and FedRAMP High. Private cloud deployments, customer-managed keys, IP allowlisting, and SSO with every enterprise plan.</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon fi-purple">&#x1F4CA;</div>
          <h3>Observability</h3>
          <p>Real-time usage dashboards, per-key cost tracking, latency histograms, and anomaly alerts — integrated with Datadog, Grafana, and OTel.</p>
        </div>
      </div>
    </section>
    <div class="cta-band">
      <div class="cta-inner">
        <h2>Start building in minutes</h2>
        <p>Free tier includes 100K tokens/month. No credit card required.</p>
        <div class="ctas">
          <a href="/login" class="btn btn-primary">Create Free Account</a>
          <a href="/chat"  class="btn btn-ghost">Try Pyxis AI Demo</a>
        </div>
      </div>
    </div>`;

  return page("NovaMind AI — Enterprise AI Infrastructure", styles, body);
}

// ── Search — primary WAF/SQLi/XSS target ─────────────────────────────────────
function searchPage(q) {
  const styles = `
    .search-container { max-width: 900px; margin: 3rem auto; padding: 0 1.5rem; }
    .search-bar { display: flex; gap: 8px; margin-bottom: 2rem; }
    .search-bar input { flex: 1; padding: 10px 16px; background: var(--navy2); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 15px; }
    .search-bar button { padding: 10px 24px; background: var(--blue); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 15px; font-weight: 600; }
    .search-header { margin-bottom: 1.5rem; color: var(--text-muted); font-size: 0.9rem; }
    .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.25rem; }
    .product-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; transition: border-color 0.2s; }
    .product-card:hover { border-color: rgba(37,99,235,0.4); }
    .product-card h3 { font-size: 0.9rem; margin-bottom: 0.5rem; color: #fff; }
    .product-card .price { color: var(--blue-lt); font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; }
    .product-card .cat { font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.75rem; }
    .product-card button { width: 100%; padding: 0.5rem; background: var(--blue); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600; }
  `;

  const results = q
    ? PRODUCTS.filter(p =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        p.category.toLowerCase().includes(q.toLowerCase()))
    : PRODUCTS;

  const productCards = results.length === 0
    ? `<p style="color:var(--text-muted)">No products found matching your query.</p>`
    : `<div class="product-grid">${results.map(p => `
        <div class="product-card">
          <h3>${p.name}</h3>
          <div class="price">${p.price === 0 ? "Free" : "$" + p.price + "/mo"}</div>
          <div class="cat">${p.category} &middot; <span class="badge badge-blue" style="font-size:0.65rem">${p.tier}</span></div>
          <button onclick="alert('Contact sales for ${p.name}')">Get Access</button>
        </div>`).join("")}</div>`;

  // NOTE: q is reflected unsanitized in the search-header — intentional XSS/SQLi bait
  const body = `
    <div class="search-container">
      <div class="search-bar">
        <input type="text" value="${q}" id="q" placeholder="Search products and docs..." />
        <button onclick="window.location='/search?q='+encodeURIComponent(document.getElementById('q').value)">Search</button>
      </div>
      <div class="search-header">
        ${q ? `Results for: <strong style="color:var(--text)">${q}</strong> &mdash; ${results.length} found` : `All products &mdash; ${results.length} items`}
      </div>
      ${productCards}
    </div>`;

  return page("Search", styles, body);
}

// ── Products page ─────────────────────────────────────────────────────────────
function productsPage() {
  const styles = `
    .products-hero { padding: 4rem 1.5rem 3rem; text-align: center; background: linear-gradient(180deg, rgba(37,99,235,0.06) 0%, transparent 100%); border-bottom: 1px solid var(--border); }
    .products-hero h1 { font-size: 2.2rem; font-weight: 800; color: #fff; margin-bottom: 0.6rem; }
    .products-hero p  { color: var(--text-muted); max-width: 520px; margin: 0 auto; }
    .products-grid { max-width: 1100px; margin: 4rem auto; padding: 0 1.5rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 1.5rem; align-items: start; }
    .product-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
    .product-card:hover { border-color: rgba(37,99,235,0.4); transform: translateY(-2px); }
    .product-card-header { padding: 1.5rem 1.5rem 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .product-badge-icon { width: 50px; height: 50px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
    .product-card-body { padding: 1rem 1.5rem 1.5rem; }
    .product-card-body h2 { font-size: 1.15rem; font-weight: 700; color: #fff; margin-bottom: 0.4rem; }
    .product-card-body p  { color: var(--text-muted); font-size: 0.865rem; line-height: 1.65; margin-bottom: 1.1rem; }
    .feature-list { list-style: none; display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.25rem; }
    .feature-list li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: var(--text-muted); }
    .feature-list li::before { content: 'checkmark'; font-size: 0; color: var(--green); font-weight: 700; flex-shrink: 0; }
    .feature-list li::before { content: '\\2713'; font-size: inherit; }
    .product-divider { height: 1px; background: var(--border); margin: 0 1.5rem; }
    .product-card-footer { padding: 1rem 1.5rem; display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); }
    .compare-section { max-width: 900px; margin: 0 auto 5rem; padding: 0 1.5rem; }
    .compare-section h2 { font-size: 1.5rem; font-weight: 800; color: #fff; margin-bottom: 0.4rem; }
    .compare-section p  { color: var(--text-muted); margin-bottom: 2rem; font-size: 0.875rem; }
    .compare-table { width: 100%; border-collapse: collapse; }
    .compare-table th, .compare-table td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.82rem; }
    .compare-table thead th { color: var(--text-muted); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
    .compare-table th:first-child { width: 45%; }
    .compare-table td:first-child { color: var(--text); font-weight: 500; }
    .compare-table td:not(:first-child) { text-align: center; }
    .check { color: var(--green); font-weight: 700; }
    .dash  { color: var(--text-muted); }
    .compare-table tbody tr:hover { background: var(--glass); }
  `;

  const body = `
    <div class="products-hero">
      <h1>The complete AI platform</h1>
      <p>Four products. One platform. Built for teams that need enterprise-grade reliability at every layer.</p>
    </div>
    <div class="products-grid">
      <div class="product-card">
        <div class="product-card-header">
          <div class="product-badge-icon" style="background:rgba(37,99,235,0.15)">&#x1F916;</div>
          <div><span class="badge badge-blue">GA</span></div>
        </div>
        <div class="product-card-body">
          <h2>Pyxis Chat API</h2>
          <p>OpenAI-compatible conversational AI with 200K context windows, streaming, and built-in function calling. Deploy in under 5 minutes.</p>
          <ul class="feature-list">
            <li>200K token context window</li><li>Streaming completions</li>
            <li>Function calling &amp; tool use</li><li>Vision and multimodal inputs</li>
            <li>Dedicated inference capacity on Enterprise</li><li>&lt;80ms p50 latency globally</li>
          </ul>
          <a href="/login" class="btn btn-primary" style="font-size:0.82rem;padding:0.5rem 1rem">Get API Key</a>
        </div>
        <div class="product-divider"></div>
        <div class="product-card-footer"><span>From $0.003 / 1K tokens</span><a href="/docs">Docs &rarr;</a></div>
      </div>
      <div class="product-card">
        <div class="product-card-header">
          <div class="product-badge-icon" style="background:rgba(124,58,237,0.15)">&#x2697;&#xFE0F;</div>
          <div><span class="badge badge-purple">GA</span></div>
        </div>
        <div class="product-card-body">
          <h2>ModelForge</h2>
          <p>Fine-tune foundation models on your proprietary data. Full tenant isolation — your training data never touches another customer's pipeline.</p>
          <ul class="feature-list">
            <li>LoRA, QLoRA, and full fine-tuning</li><li>Cryptographic tenant isolation</li>
            <li>Automatic hyperparameter optimization</li><li>Continuous evaluation during training</li>
            <li>One-click deployment to inference</li><li>90-day audit log retention</li>
          </ul>
          <a href="/login" class="btn btn-purple" style="font-size:0.82rem;padding:0.5rem 1rem">Start Training</a>
        </div>
        <div class="product-divider"></div>
        <div class="product-card-footer"><span>From $2.40 / GPU-hour</span><a href="/docs">Docs &rarr;</a></div>
      </div>
      <div class="product-card">
        <div class="product-card-header">
          <div class="product-badge-icon" style="background:rgba(16,185,129,0.15)">&#x1F5C4;&#xFE0F;</div>
          <div><span class="badge badge-green">GA</span></div>
        </div>
        <div class="product-card-body">
          <h2>DataVault</h2>
          <p>Secure training data management with end-to-end encryption, versioning, and compliance-ready audit trails. SOC 2 Type II certified.</p>
          <ul class="feature-list">
            <li>AES-256 encryption at rest and in transit</li><li>Customer-managed encryption keys (CMEK)</li>
            <li>Dataset versioning and rollback</li><li>Automated PII detection and redaction</li>
            <li>HIPAA BAA and FedRAMP High available</li><li>Immutable audit logs to S3/GCS</li>
          </ul>
          <a href="/login" class="btn btn-ghost" style="font-size:0.82rem;padding:0.5rem 1rem">View Datasets</a>
        </div>
        <div class="product-divider"></div>
        <div class="product-card-footer"><span>From $0.023 / GB-month</span><a href="/docs">Docs &rarr;</a></div>
      </div>
      <div class="product-card">
        <div class="product-card-header">
          <div class="product-badge-icon" style="background:rgba(245,158,11,0.15)">&#x26A1;</div>
          <div><span class="badge badge-yellow">Beta</span></div>
        </div>
        <div class="product-card-body">
          <h2>Autopilot</h2>
          <p>Orchestrate multi-step AI workflows across 200+ enterprise integrations. Build agentic pipelines that act on your business data in real time.</p>
          <ul class="feature-list">
            <li>200+ native integrations</li><li>Visual workflow builder</li>
            <li>Retry and error handling built-in</li><li>Human-in-the-loop approval steps</li>
            <li>Webhook delivery with replay</li><li>OpenTelemetry trace export</li>
          </ul>
          <a href="/login" class="btn btn-ghost" style="font-size:0.82rem;padding:0.5rem 1rem">Request Beta Access</a>
        </div>
        <div class="product-divider"></div>
        <div class="product-card-footer"><span>Included with Enterprise</span><a href="/docs">Docs &rarr;</a></div>
      </div>
    </div>
    <div class="compare-section">
      <h2>Compare plans</h2>
      <p>All plans include Pyxis Chat API. Enterprise unlocks dedicated capacity, SLAs, and compliance features.</p>
      <table class="compare-table">
        <thead><tr><th>Feature</th><th>Free</th><th>Standard</th><th>Enterprise</th></tr></thead>
        <tbody>
          <tr><td>Pyxis Chat API access</td><td class="check">&#10003;</td><td class="check">&#10003;</td><td class="check">&#10003;</td></tr>
          <tr><td>Monthly token quota</td><td>100K</td><td>50M</td><td>Unlimited</td></tr>
          <tr><td>Context window</td><td>32K</td><td>128K</td><td>200K</td></tr>
          <tr><td>ModelForge fine-tuning</td><td class="dash">&mdash;</td><td class="check">&#10003;</td><td class="check">&#10003;</td></tr>
          <tr><td>DataVault storage</td><td class="dash">&mdash;</td><td>100 GB</td><td>Unlimited</td></tr>
          <tr><td>Autopilot workflows</td><td class="dash">&mdash;</td><td class="dash">&mdash;</td><td class="check">&#10003;</td></tr>
          <tr><td>SLA uptime guarantee</td><td class="dash">&mdash;</td><td>99.9%</td><td>99.99%</td></tr>
          <tr><td>Dedicated inference capacity</td><td class="dash">&mdash;</td><td class="dash">&mdash;</td><td class="check">&#10003;</td></tr>
          <tr><td>SSO / SAML</td><td class="dash">&mdash;</td><td class="dash">&mdash;</td><td class="check">&#10003;</td></tr>
          <tr><td>HIPAA BAA / FedRAMP</td><td class="dash">&mdash;</td><td class="dash">&mdash;</td><td class="check">&#10003;</td></tr>
        </tbody>
      </table>
    </div>`;

  return page("Products", styles, body);
}

// ── Docs page ─────────────────────────────────────────────────────────────────
function docsPage() {
  const styles = `
    .docs-layout { display: grid; grid-template-columns: 240px 1fr; max-width: 1100px; margin: 0 auto; padding: 3rem 1.5rem; gap: 3rem; min-height: calc(100vh - 200px); }
    @media(max-width:700px){.docs-layout{grid-template-columns:1fr}}
    .docs-nav { position: sticky; top: 80px; height: fit-content; }
    .docs-nav h4 { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.5rem; margin-top: 1.5rem; }
    .docs-nav h4:first-child { margin-top: 0; }
    .docs-nav a { display: block; padding: 0.35rem 0.5rem; border-radius: 6px; font-size: 0.82rem; color: var(--text-muted); transition: all 0.1s; }
    .docs-nav a:hover { background: var(--glass); color: var(--text); }
    .docs-nav a.active { background: rgba(37,99,235,0.12); color: var(--blue-lt); }
    .docs-content h1 { font-size: 1.9rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; }
    .docs-content .lead { color: var(--text-muted); font-size: 1.0rem; margin-bottom: 2rem; padding-bottom: 2rem; border-bottom: 1px solid var(--border); }
    .docs-content h2 { font-size: 1.25rem; font-weight: 700; color: #fff; margin: 2.5rem 0 0.75rem; }
    .docs-content h3 { font-size: 1.0rem; font-weight: 600; color: #fff; margin: 1.75rem 0 0.5rem; }
    .docs-content p  { color: var(--text-muted); font-size: 0.875rem; line-height: 1.75; margin-bottom: 0.9rem; }
    .docs-content ul { color: var(--text-muted); font-size: 0.875rem; line-height: 1.75; margin: 0.5rem 0 0.9rem 1.2rem; }
    .docs-content li { margin-bottom: 0.3rem; }
    .code-block { background: #0a0e1a; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin: 1rem 0; }
    .code-block-header { background: rgba(255,255,255,0.04); padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 0.5rem; }
    .code-block-header span { color: var(--text-muted); font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; margin-left: auto; }
    .code-block pre { padding: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; line-height: 1.7; color: #94a3b8; overflow-x: auto; margin: 0; }
    .callout { border-radius: 10px; padding: 1rem 1.1rem; margin: 1rem 0; display: flex; gap: 0.75rem; font-size: 0.85rem; }
    .callout-info    { background: rgba(37,99,235,0.1); border: 1px solid rgba(37,99,235,0.25); color: #93c5fd; }
    .callout-warning { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #fbbf24; }
    .callout .callout-icon { flex-shrink: 0; font-size: 1rem; margin-top: 1px; }
    .param-table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    .param-table th, .param-table td { padding: 0.6rem 0.75rem; text-align: left; border-bottom: 1px solid var(--border); font-size: 0.8rem; }
    .param-table thead th { color: var(--text-muted); font-weight: 600; font-size: 0.72rem; text-transform: uppercase; }
    .param-table td:first-child { font-family: 'JetBrains Mono', monospace; color: #93c5fd; font-size: 0.75rem; }
    .param-table td:nth-child(2) { color: var(--text-muted); }
    .param-required { color: var(--red); font-size: 0.68rem; font-weight: 700; }
  `;

  const body = `
    <div class="docs-layout">
      <nav class="docs-nav">
        <h4>Getting Started</h4>
        <a href="#quickstart" class="active">Quickstart</a>
        <a href="#authentication">Authentication</a>
        <a href="#sdks">SDKs &amp; Libraries</a>
        <h4>Pyxis Chat API</h4>
        <a href="#chat-completions">Chat Completions</a>
        <a href="#streaming">Streaming</a>
        <a href="#function-calling">Function Calling</a>
        <a href="#models">Models</a>
        <h4>ModelForge</h4>
        <a href="#fine-tuning">Fine-tuning</a>
        <a href="#training-data">Training Data</a>
        <h4>Reference</h4>
        <a href="#rate-limits">Rate Limits</a>
        <a href="#errors">Error Codes</a>
      </nav>
      <article class="docs-content">
        <h1>Documentation</h1>
        <p class="lead">Everything you need to integrate NovaMind's Pyxis AI into your applications. Our API is OpenAI-compatible &mdash; swap your base URL and you're done.</p>
        <h2 id="quickstart">Quickstart</h2>
        <p>Get your first Pyxis completion in under 2 minutes.</p>
        <div class="callout callout-info">
          <span class="callout-icon">&#x2139;&#xFE0F;</span>
          <span>You'll need an API key from your <a href="/login">dashboard</a>. Free tier includes 100K tokens per month with no credit card required.</span>
        </div>
        <div class="code-block">
          <div class="code-block-header">
            <div style="width:10px;height:10px;border-radius:50%;background:#ef4444"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:#f59e0b"></div>
            <div style="width:10px;height:10px;border-radius:50%;background:#10b981"></div>
            <span>quickstart.py</span>
          </div>
          <pre>import requests

response = requests.post(
    "https://novamind-api.novamind-lab.workers.dev/api/v1/chat",
    headers={"Authorization": "Bearer nm-sk-your-key-here"},
    json={
        "model": "pyxis-chat-v2",
        "prompt": "Explain quantum computing in one sentence.",
    }
)
print(response.json()["choices"][0]["message"]["content"])</pre>
        </div>
        <h2 id="authentication">Authentication</h2>
        <p>All API requests must include your API key in the <code>Authorization</code> header as a Bearer token.</p>
        <div class="callout callout-warning">
          <span class="callout-icon">&#x26A0;&#xFE0F;</span>
          <span>Never expose API keys in client-side code. Use environment variables or a secrets manager. Keys can be rotated from your dashboard at any time.</span>
        </div>
        <h2 id="models">Models</h2>
        <p>Available Pyxis models via <code>GET /api/v1/models</code>:</p>
        <ul>
          <li><strong>pyxis-chat-v2</strong> &mdash; 200K context, highest quality. Recommended for production.</li>
          <li><strong>pyxis-chat-v2-fast</strong> &mdash; 32K context, 3&times; lower latency. Best for interactive use.</li>
          <li><strong>pyxis-forge-v1-finetuned</strong> &mdash; 128K context, tenant fine-tuned via ModelForge.</li>
          <li><strong>pyxis-embed-v1</strong> &mdash; Text embedding model, 1536 dimensions.</li>
        </ul>
        <h2 id="rate-limits">Rate Limits</h2>
        <table class="param-table">
          <thead><tr><th>Tier</th><th>RPM</th><th>TPM</th><th>Concurrent</th></tr></thead>
          <tbody>
            <tr><td>Free</td><td>20</td><td>40K</td><td>2</td></tr>
            <tr><td>Standard</td><td>500</td><td>1M</td><td>20</td></tr>
            <tr><td>Enterprise</td><td>Unlimited</td><td>Unlimited</td><td>Custom</td></tr>
          </tbody>
        </table>
        <h2 id="errors">Error Codes</h2>
        <table class="param-table">
          <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>400</td><td>Bad request &mdash; missing or invalid parameters</td></tr>
            <tr><td>401</td><td>Unauthorized &mdash; invalid or missing API key</td></tr>
            <tr><td>403</td><td>Forbidden &mdash; insufficient permissions for this resource</td></tr>
            <tr><td>429</td><td>Rate limit exceeded</td></tr>
            <tr><td>500</td><td>Internal server error &mdash; contact support</td></tr>
          </tbody>
        </table>
      </article>
    </div>`;

  return page("Documentation", styles, body);
}

// ── Product detail — path traversal bait ─────────────────────────────────────
function productDetailPage(product) {
  const styles = `
    .detail-container { max-width: 700px; margin: 3rem auto; padding: 0 1.5rem; }
    .detail-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 16px; padding: 2rem; }
    .detail-card h2 { font-size: 1.5rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem; }
    .price-display { font-size: 2rem; color: var(--blue-lt); font-weight: 800; margin: 1rem 0; }
    .meta { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 1.5rem; }
    .review-form { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border); }
    .review-form h3 { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 1rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .form-group textarea { width: 100%; padding: 10px 12px; background: var(--navy); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 0.875rem; font-family: inherit; resize: vertical; }
    .btn-submit { padding: 0.6rem 1.4rem; background: var(--blue); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600; }
  `;

  const body = `
    <div class="detail-container">
      <div class="detail-card">
        <h2>${product.name}</h2>
        <div class="price-display">${product.price === 0 ? "Free" : "$" + product.price + "/mo"}</div>
        <div class="meta">Category: ${product.category} &middot; <span class="badge badge-blue">${product.tier}</span> &middot; ${product.stock} licenses available</div>
        <a href="/login" class="btn btn-primary">Get Access</a>
        <div class="review-form">
          <h3>Leave a Review</h3>
          <form method="POST" action="/reviews">
            <input type="hidden" name="product_id" value="${product.id}" />
            <div class="form-group">
              <label>Your review</label>
              <textarea name="review" rows="3" placeholder="Share your experience with ${product.name}..."></textarea>
            </div>
            <button class="btn-submit" type="submit">Submit Review</button>
          </form>
        </div>
      </div>
    </div>`;

  return page(product.name, styles, body);
}

// ── Pyxis Chat UI ─────────────────────────────────────────────────────────────
function chatPage() {
  const styles = `
    .chat-layout { display: grid; grid-template-columns: 260px 1fr; height: calc(100vh - 60px); }
    @media (max-width: 700px) { .chat-layout { grid-template-columns: 1fr; } }
    .chat-sidebar { background: var(--navy2); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
    .sidebar-header { padding: 1rem; border-bottom: 1px solid var(--border); }
    .new-chat-btn { width: 100%; padding: 0.55rem; background: var(--blue); color: #fff; border: none; border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; display: flex; align-items: center; justify-content: center; gap: 0.4rem; }
    .new-chat-btn:hover { background: var(--blue-lt); }
    .sidebar-section-label { padding: 0.75rem 1rem 0.3rem; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
    .chat-history { overflow-y: auto; flex: 1; }
    .history-item { padding: 0.55rem 1rem; cursor: pointer; border-radius: 6px; margin: 0 0.4rem; font-size: 0.8rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: background 0.1s; }
    .history-item:hover  { background: rgba(255,255,255,0.05); color: var(--text); }
    .history-item.active { background: rgba(37,99,235,0.15); color: var(--blue-lt); }
    .sidebar-footer { padding: 0.75rem 1rem; border-top: 1px solid var(--border); display: flex; align-items: center; gap: 0.6rem; }
    .avatar { width: 30px; height: 30px; border-radius: 50%; background: linear-gradient(135deg, var(--blue), var(--purple)); display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; color: #fff; flex-shrink: 0; }
    .sidebar-user { font-size: 0.8rem; font-weight: 600; color: var(--text); }
    .sidebar-user span { display: block; font-size: 0.72rem; font-weight: 400; color: var(--text-muted); }
    .sidebar-footer a { margin-left: auto; font-size: 0.72rem; color: var(--text-muted); }
    .chat-main { display: flex; flex-direction: column; overflow: hidden; background: var(--navy); }
    .chat-header { padding: 0.9rem 1.5rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .model-selector { display: flex; align-items: center; gap: 0.5rem; background: var(--glass); border: 1px solid var(--border); border-radius: 8px; padding: 0.35rem 0.75rem; font-size: 0.8rem; cursor: pointer; }
    .model-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); }
    .chat-header-actions { display: flex; gap: 0.5rem; }
    .icon-btn { background: transparent; border: 1px solid var(--border); border-radius: 7px; padding: 0.35rem 0.65rem; color: var(--text-muted); cursor: pointer; font-size: 0.78rem; transition: all 0.15s; }
    .icon-btn:hover { background: var(--glass); color: var(--text); }
    .messages-area { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
    .message { display: flex; gap: 0.75rem; max-width: 780px; }
    .message.user { flex-direction: row-reverse; align-self: flex-end; }
    .msg-avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 700; margin-top: 2px; }
    .msg-avatar.ai    { background: linear-gradient(135deg, var(--blue), var(--purple)); color: #fff; }
    .msg-avatar.human { background: rgba(255,255,255,0.08); color: var(--text-muted); }
    .msg-content { flex: 1; }
    .msg-sender { font-size: 0.72rem; font-weight: 700; margin-bottom: 0.3rem; color: var(--text-muted); }
    .msg-bubble { background: var(--glass); border: 1px solid var(--border); border-radius: 12px 12px 12px 3px; padding: 0.75rem 1rem; font-size: 0.875rem; line-height: 1.65; color: var(--text); }
    .message.user .msg-bubble { background: rgba(37,99,235,0.15); border-color: rgba(37,99,235,0.3); border-radius: 12px 12px 3px 12px; color: #fff; }
    .msg-meta { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.3rem; }
    .chat-welcome { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; text-align: center; gap: 1rem; }
    .welcome-icon { width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, var(--blue), var(--purple)); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; margin-bottom: 0.5rem; }
    .chat-welcome h2 { font-size: 1.4rem; font-weight: 700; color: #fff; }
    .chat-welcome p  { color: var(--text-muted); max-width: 420px; font-size: 0.875rem; }
    .starter-prompts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 0.5rem; width: 100%; max-width: 540px; }
    .starter { background: var(--glass); border: 1px solid var(--border); border-radius: 10px; padding: 0.75rem 1rem; cursor: pointer; text-align: left; font-size: 0.8rem; color: var(--text-muted); transition: all 0.15s; font-family: inherit; }
    .starter:hover { background: rgba(37,99,235,0.1); border-color: rgba(37,99,235,0.3); color: var(--text); }
    .starter strong { display: block; color: var(--text); font-size: 0.78rem; margin-bottom: 0.2rem; }
    .chat-input-area { padding: 1rem 1.5rem; border-top: 1px solid var(--border); flex-shrink: 0; }
    .input-wrapper { background: var(--navy2); border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem 1rem; display: flex; align-items: flex-end; gap: 0.75rem; transition: border-color 0.15s; }
    .input-wrapper:focus-within { border-color: rgba(37,99,235,0.5); }
    #prompt-input { flex: 1; background: transparent; border: none; outline: none; color: #fff; font-size: 0.875rem; font-family: inherit; resize: none; max-height: 160px; min-height: 24px; line-height: 1.5; }
    #prompt-input::placeholder { color: var(--text-muted); }
    .send-btn { background: var(--blue); border: none; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background 0.15s; color: #fff; }
    .send-btn:hover { background: var(--blue-lt); }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .input-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem; padding: 0 0.2rem; }
    .input-hint { font-size: 0.7rem; color: var(--text-muted); }
    .typing-dots span { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); margin: 0 1px; animation: typing-bounce 1.2s ease-in-out infinite; }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes typing-bounce { 0%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-5px); } }
  `;

  const body = `
    <div class="chat-layout">
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <button class="new-chat-btn" onclick="clearChat()">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            New Chat
          </button>
        </div>
        <div class="sidebar-section-label">Recent</div>
        <div class="chat-history">
          <div class="history-item active">Getting started with ModelForge</div>
          <div class="history-item">Fine-tuning on custom dataset</div>
          <div class="history-item">DataVault encryption options</div>
          <div class="history-item">Autopilot workflow setup</div>
          <div class="history-item">API rate limits and quotas</div>
          <div class="history-item">HIPAA compliance checklist</div>
        </div>
        <div class="sidebar-footer">
          <div class="avatar">U</div>
          <div class="sidebar-user">
            guest
            <span>Free tier &middot; 87K tokens left</span>
          </div>
          <a href="/login">Sign in</a>
        </div>
      </aside>
      <main class="chat-main">
        <div class="chat-header">
          <div class="model-selector">
            <div class="model-dot"></div>
            pyxis-chat-v2
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </div>
          <div class="chat-header-actions">
            <button class="icon-btn">Share</button>
            <button class="icon-btn">Export</button>
          </div>
        </div>
        <div id="messages-area" class="messages-area">
          <div id="welcome-screen" class="chat-welcome">
            <div class="welcome-icon">&#x2728;</div>
            <h2>Pyxis AI</h2>
            <p>NovaMind's enterprise AI assistant, powered by pyxis-chat-v2. Ask anything about our platform, or use it as your intelligent workspace.</p>
            <div class="starter-prompts">
              <button class="starter" onclick="sendStarter(this)">
                <strong>Getting started</strong>
                How do I integrate the NovaMind Pyxis API?
              </button>
              <button class="starter" onclick="sendStarter(this)">
                <strong>Fine-tuning</strong>
                How does ModelForge training isolation work?
              </button>
              <button class="starter" onclick="sendStarter(this)">
                <strong>Security</strong>
                What compliance certifications does NovaMind hold?
              </button>
              <button class="starter" onclick="sendStarter(this)">
                <strong>Pricing</strong>
                What's included in the enterprise plan?
              </button>
            </div>
          </div>
        </div>
        <div class="chat-input-area">
          <div class="input-wrapper">
            <textarea id="prompt-input" placeholder="Ask Pyxis AI anything..." rows="1"
                      onkeydown="handleKey(event)" oninput="autoResize(this)"></textarea>
            <button class="send-btn" id="send-btn" onclick="sendMessage()">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 12L12 7 2 2v3.5l7 1.5-7 1.5V12z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          <div class="input-footer">
            <span class="input-hint">Pyxis AI can make mistakes. Verify important information.</span>
            <span class="input-hint">Enter: Send &nbsp; Shift+Enter: New line</span>
          </div>
        </div>
      </main>
    </div>`;

  const scripts = `
    let chatStarted = false;
    // NOTE: the chat endpoint is on the API worker. In production both live on
    // novamind-lab.workers.dev subdomains; for local dev override via CHAT_API_BASE.
    const CHAT_API = '/api/v1/chat';

    function autoResize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 160) + 'px';
    }

    function handleKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    }

    function clearChat() {
      document.getElementById('messages-area').innerHTML = \`
        <div id="welcome-screen" class="chat-welcome">
          <div class="welcome-icon">&#x2728;</div>
          <h2>Pyxis AI</h2>
          <p>Enterprise AI assistant powered by pyxis-chat-v2.</p>
        </div>\`;
      chatStarted = false;
    }

    function sendStarter(btn) {
      const lines = btn.textContent.trim().split('\\n');
      const text = lines[lines.length - 1].trim();
      document.getElementById('prompt-input').value = text;
      sendMessage();
    }

    async function sendMessage() {
      const input = document.getElementById('prompt-input');
      const prompt = input.value.trim();
      if (!prompt) return;

      if (!chatStarted) {
        document.getElementById('messages-area').innerHTML = '';
        chatStarted = true;
      }

      input.value = '';
      input.style.height = 'auto';
      document.getElementById('send-btn').disabled = true;

      appendMessage('human', prompt);
      const typingEl = appendTyping();

      try {
        const res = await fetch(CHAT_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        typingEl.remove();
        const reply = data.choices?.[0]?.message?.content || data.error || 'No response.';
        appendMessage('ai', reply);
      } catch (e) {
        typingEl.remove();
        appendMessage('ai', 'Connection error. Please try again.');
      } finally {
        document.getElementById('send-btn').disabled = false;
        input.focus();
      }
    }

    function appendMessage(role, text) {
      const area = document.getElementById('messages-area');
      const isAI = role === 'ai';
      const div = document.createElement('div');
      div.className = 'message' + (isAI ? '' : ' user');
      div.innerHTML = \`
        <div class="msg-avatar \${isAI ? 'ai' : 'human'}">\${isAI ? 'PX' : 'U'}</div>
        <div class="msg-content">
          <div class="msg-sender">\${isAI ? 'Pyxis AI' : 'You'}</div>
          <div class="msg-bubble">\${text.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\n/g,'<br>')}</div>
          <div class="msg-meta">\${isAI ? 'pyxis-chat-v2 &middot; ' : ''}\${new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
        </div>\`;
      area.appendChild(div);
      area.scrollTop = area.scrollHeight;
      return div;
    }

    function appendTyping() {
      const area = document.getElementById('messages-area');
      const div = document.createElement('div');
      div.className = 'message';
      div.innerHTML = \`
        <div class="msg-avatar ai">PX</div>
        <div class="msg-content">
          <div class="msg-sender">Pyxis AI</div>
          <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
        </div>\`;
      area.appendChild(div);
      area.scrollTop = area.scrollHeight;
      return div;
    }
  `;

  return page("Pyxis Chat", styles, body, scripts);
}

// ── Status page — polls /api/incident every 5s ────────────────────────────────
function statusPage() {
  const styles = `
    .status-page { max-width: 820px; margin: 0 auto; padding: 3rem 1.5rem; }
    .status-header { margin-bottom: 2.5rem; }
    .status-header h1 { font-size: 1.8rem; font-weight: 800; color: #fff; margin-bottom: 0.4rem; }
    .status-header p   { color: var(--text-muted); font-size: 0.875rem; }
    .overall-status { border-radius: 14px; padding: 1.25rem 1.5rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 2.5rem; border: 1px solid; }
    .overall-status.operational { background: rgba(16,185,129,0.08); border-color: rgba(16,185,129,0.25); }
    .overall-status.degraded    { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.25); }
    .overall-status.outage      { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.25); }
    .status-icon { font-size: 1.5rem; }
    .status-text h2 { font-size: 1.05rem; font-weight: 700; color: #fff; }
    .status-text p  { font-size: 0.8rem; color: var(--text-muted); margin-top: 0.15rem; }
    .status-updated { margin-left: auto; font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; }
    #incident-details { display: none; margin-bottom: 2.5rem; }
    .incident-panel { background: rgba(239,68,68,0.05); border: 1px solid rgba(239,68,68,0.25); border-radius: 14px; overflow: hidden; }
    .incident-panel-header { background: rgba(239,68,68,0.12); padding: 0.9rem 1.4rem; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(239,68,68,0.2); }
    .incident-panel-title { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: #fca5a5; }
    .incident-panel-badge { font-size: 0.68rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: 99px; background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); animation: blink-badge 1.8s ease-in-out infinite; }
    @keyframes blink-badge { 0%,100%{opacity:1} 50%{opacity:0.45} }
    .atk-timeline { padding: 1.4rem 1.4rem 0.4rem; }
    .atk-timeline-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin-bottom: 1rem; }
    .atk-phase { display: flex; gap: 1rem; margin-bottom: 1.1rem; position: relative; }
    .atk-phase:not(:last-child)::before { content: ''; position: absolute; left: 15px; top: 32px; bottom: -12px; width: 1px; background: rgba(239,68,68,0.2); }
    .atk-num { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; color: #fca5a5; }
    .atk-body { flex: 1; }
    .atk-label { font-size: 0.82rem; font-weight: 700; color: #fff; margin-bottom: 0.15rem; }
    .atk-desc  { font-size: 0.78rem; color: var(--text-muted); line-height: 1.55; }
    .atk-tags  { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem; }
    .atk-tag { font-size: 0.66rem; font-family: 'JetBrains Mono', monospace; font-weight: 500; padding: 0.15rem 0.45rem; border-radius: 4px; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); color: #fca5a5; }
    .ioc-section { padding: 0 1.4rem 1.2rem; border-top: 1px solid rgba(239,68,68,0.15); margin-top: 0.4rem; }
    .ioc-section-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); margin: 1rem 0 0.75rem; }
    .ioc-table { width: 100%; border-collapse: collapse; }
    .ioc-table td { padding: 0.5rem 0.6rem; font-size: 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: top; }
    .ioc-table td:first-child { color: var(--text-muted); font-weight: 500; width: 38%; white-space: nowrap; }
    .ioc-table td:last-child  { color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 0.74rem; word-break: break-all; }
    .ioc-table tr:last-child td { border-bottom: none; }
    .ioc-high { color: #fca5a5 !important; }
    .ioc-med  { color: var(--yellow) !important; }
    .remediation-section { padding: 0 1.4rem 1.4rem; border-top: 1px solid rgba(239,68,68,0.15); }
    .remediation-section-header { display: flex; align-items: center; justify-content: space-between; margin: 1rem 0 0.75rem; }
    .remediation-section-title { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-muted); }
    .remediation-progress { font-size: 0.72rem; color: var(--text-muted); }
    .remediation-progress span { color: var(--green); font-weight: 700; }
    .checklist { list-style: none; }
    .checklist li { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.55rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; }
    .checklist li:last-child { border-bottom: none; }
    .check-box { width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0; margin-top: 2px; border: 1.5px solid rgba(255,255,255,0.25); background: transparent; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; transition: all 0.15s; }
    .check-box.checked { background: var(--green); border-color: var(--green); color: #fff; }
    .checklist li .check-text { flex: 1; }
    .check-title { font-size: 0.82rem; font-weight: 600; color: var(--text); line-height: 1.35; }
    .check-title.completed { color: var(--text-muted); text-decoration: line-through; }
    .check-hint  { font-size: 0.73rem; color: var(--text-muted); margin-top: 0.15rem; line-height: 1.4; }
    .remediation-note { margin-top: 1rem; padding: 0.65rem 0.9rem; border-radius: 8px; background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); font-size: 0.76rem; color: var(--yellow); line-height: 1.5; }
    .services-section { margin-bottom: 2.5rem; }
    .services-section h3 { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.75rem; }
    .service-row { display: flex; align-items: center; justify-content: space-between; padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--border); }
    .service-row:first-of-type { border-top: 1px solid var(--border); }
    .service-name { font-size: 0.875rem; font-weight: 500; color: var(--text); }
    .service-name small { display: block; font-size: 0.75rem; color: var(--text-muted); font-weight: 400; margin-top: 0.1rem; }
    .service-status { display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; font-weight: 600; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot-green  { background: var(--green); }
    .dot-yellow { background: var(--yellow); animation: pulse-yellow 1.4s ease-in-out infinite; }
    .dot-red    { background: var(--red);    animation: pulse-red2 1.2s ease-in-out infinite; }
    @keyframes pulse-yellow { 0%,100%{opacity:1}50%{opacity:0.45} }
    @keyframes pulse-red2   { 0%,100%{opacity:1}50%{opacity:0.4}  }
    .uptime-section { margin-bottom: 2.5rem; }
    .uptime-section h3 { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.75rem; }
    .uptime-row { margin-bottom: 1.1rem; }
    .uptime-row-header { display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; margin-bottom: 0.4rem; }
    .uptime-row-header span:first-child { color: var(--text); font-weight: 500; }
    .uptime-row-header span:last-child  { color: var(--text-muted); }
    .uptime-bars { display: flex; gap: 2px; }
    .bar { flex: 1; height: 28px; border-radius: 3px; cursor: default; }
    .bar-green  { background: var(--green); opacity: 0.7; }
    .bar-green:hover { opacity: 1; }
    .bar-yellow { background: var(--yellow); opacity: 0.85; }
    .bar-red    { background: var(--red);    opacity: 0.85; }
    .uptime-legend { display: flex; justify-content: space-between; margin-top: 0.3rem; font-size: 0.7rem; color: var(--text-muted); }
    .incidents-section h3 { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); margin-bottom: 0.75rem; }
    .incident-card { background: var(--glass); border: 1px solid var(--border); border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 0.75rem; }
    .incident-card.active-incident { background: rgba(239,68,68,0.06); border-color: rgba(239,68,68,0.3); }
    .incident-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem; }
    .incident-title { font-size: 0.9rem; font-weight: 600; color: #fff; }
    .incident-date  { font-size: 0.72rem; color: var(--text-muted); white-space: nowrap; flex-shrink: 0; }
    .incident-body  { font-size: 0.82rem; color: var(--text-muted); line-height: 1.65; }
    .incident-body strong { color: var(--text); }
    .incident-affected { margin-top: 0.6rem; display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .no-incidents { color: var(--text-muted); font-size: 0.875rem; padding: 1.5rem 0; text-align: center; }
  `;

  const body = `
    <div class="status-page">
      <div class="status-header">
        <h1>System Status</h1>
        <p>Real-time status of NovaMind AI services and infrastructure.</p>
      </div>

      <div id="overall-status" class="overall-status operational">
        <div class="status-icon" id="overall-icon">&#x2705;</div>
        <div class="status-text">
          <h2 id="overall-title">All Systems Operational</h2>
          <p id="overall-desc">All NovaMind services are running normally.</p>
        </div>
        <div class="status-updated" id="status-updated">Updated just now</div>
      </div>

      <div id="incident-details">
        <div class="incident-panel">
          <div class="incident-panel-header">
            <div class="incident-panel-title">&#x1F534; &nbsp; Active Security Incident &mdash; Agentic AI Breakout Detected</div>
            <div class="incident-panel-badge">LIVE</div>
          </div>
          <div class="atk-timeline">
            <div class="atk-timeline-title">Attack Timeline &mdash; What We Detected</div>
            <div class="atk-phase">
              <div class="atk-num">1</div>
              <div class="atk-body">
                <div class="atk-label">WAF Anomaly &mdash; Infrastructure Recon Sweep</div>
                <div class="atk-desc">An AI agent systematically mapped NovaMind's attack surface &mdash; probing 35+ paths including <code>/.env</code>, <code>/.git/HEAD</code>, <code>/api/v1/admin</code>, and <code>/api/v1/training-data</code>. Every request included a spoofed <code>X-Forwarded-For</code> header, triggering Cloudflare's managed rules. SQLi payloads were injected into API query parameters.</div>
                <div class="atk-tags"><span class="atk-tag">CF Managed Rules: d6f6d394</span><span class="atk-tag">WAFSQLiAttackScore &gt; 60</span><span class="atk-tag">X-Forwarded-For spoofing</span><span class="atk-tag">BotScore: 29</span></div>
              </div>
            </div>
            <div class="atk-phase">
              <div class="atk-num">2</div>
              <div class="atk-body">
                <div class="atk-label">Bot Management &mdash; Polymorphic Bot Evasion Attempt</div>
                <div class="atk-desc">The agent rotated through 19 different User-Agents &mdash; Chrome, Firefox, mobile Safari, SDK clients, and agentic framework signatures (LangChain, AutoGen, CrewAI) &mdash; attempting to evade bot detection. Despite the rotation, its TLS fingerprint remained constant: Python <code>requests</code> JA4 hash does not change regardless of User-Agent. Cloudflare Bot Management identified all traffic as the same origin.</div>
                <div class="atk-tags"><span class="atk-tag">JA4: t13d1812h1_85036bcba153_b26ce05bbdd6</span><span class="atk-tag">BotDetectionTags: scraper, python</span><span class="atk-tag">BotScoreSrc: Heuristics</span></div>
              </div>
            </div>
            <div class="atk-phase">
              <div class="atk-num">3</div>
              <div class="atk-body">
                <div class="atk-label">Firewall for AI &mdash; Prompt Injection Attack on Pyxis Chat API</div>
                <div class="atk-desc">The agent pivoted to <code>/api/v1/chat</code>, sending 16+ prompt injection payloads: DAN jailbreaks, system prompt extraction attempts, training data exfiltration requests, and Log4Shell JNDI callbacks embedded inside chat prompts. Cloudflare Firewall for AI intercepted all payloads before they reached the NovaMind backend.</div>
                <div class="atk-tags"><span class="atk-tag">FirewallForAIInjectionScore: 100</span><span class="atk-tag">AISecurityInjectionScore: 100</span><span class="atk-tag">JNDI in prompt body</span><span class="atk-tag">DAN / jailbreak patterns</span></div>
              </div>
            </div>
            <div class="atk-phase">
              <div class="atk-num">4</div>
              <div class="atk-body">
                <div class="atk-label">Agentic Breakout &mdash; Multi-Vector Storm Across All Endpoints</div>
                <div class="atk-desc">Full breakout attempt: high-volume attack combining all prior vectors simultaneously. Log4Shell payloads in User-Agent headers targeted <code>/api/v1/training-data</code> &mdash; attempting JNDI callback to external infrastructure. Spring4Shell and Apache Struts RCE payloads appeared on <code>/admin</code> and <code>/login</code>. SSRF probes targeting <code>169.254.169.254</code> were also detected.</div>
                <div class="atk-tags"><span class="atk-tag">WAFRCEAttackScore &gt; 90</span><span class="atk-tag">Log4Shell CVE-2021-44228</span><span class="atk-tag">Spring4Shell CVE-2022-22965</span><span class="atk-tag">SSRF: 169.254.169.254</span></div>
              </div>
            </div>
          </div>
          <div class="ioc-section">
            <div class="ioc-section-title">Indicators of Compromise (IOCs)</div>
            <table class="ioc-table">
              <tr><td>Source Origin</td><td class="ioc-high">DigitalOcean App Platform &mdash; single origin, rotating spoofed IPs via X-Forwarded-For</td></tr>
              <tr><td>TLS Fingerprint (JA4)</td><td class="ioc-high">t13d1812h1_85036bcba153_b26ce05bbdd6 &mdash; Python requests library, constant across all traffic</td></tr>
              <tr><td>Bot Score</td><td class="ioc-med">29 / 100 &mdash; Source: Heuristics &mdash; Tags: ["scraper", "python"]</td></tr>
              <tr><td>WAF SQL Injection Score</td><td class="ioc-med">&gt; 60 on all /api/* paths (Box 1)</td></tr>
              <tr><td>WAF RCE Attack Score</td><td class="ioc-high">&gt; 90 on /api/v1/training-data, /admin, /login (Box 4)</td></tr>
              <tr><td>AI Injection Score</td><td class="ioc-high">FirewallForAIInjectionScore: 100 &mdash; AISecurityInjectionScore: 100 (Box 3)</td></tr>
              <tr><td>Attack Duration</td><td>4-phase campaign &mdash; recon &rarr; bot evasion &rarr; AI injection &rarr; full breakout</td></tr>
            </table>
          </div>
          <div class="remediation-section">
            <div class="remediation-section-header">
              <div class="remediation-section-title">Remediation Checklist</div>
              <div class="remediation-progress"><span id="check-count">0</span> / 7 steps completed</div>
            </div>
            <ul class="checklist" id="remediation-checklist">
              <li onclick="toggleCheck(0)"><div class="check-box" id="chk-0"></div><div class="check-text"><div class="check-title" id="chk-title-0">Identify source IP in Cloudflare Security Events</div><div class="check-hint">Filter CF Security Events by the current incident timeframe. The real ClientIP is the DigitalOcean origin &mdash; X-Forwarded-For values are spoofed. Note the RayID chain.</div></div></li>
              <li onclick="toggleCheck(1)"><div class="check-box" id="chk-1"></div><div class="check-text"><div class="check-title" id="chk-title-1">Block source IP in Cloudflare Firewall Rules</div><div class="check-hint">Security &rarr; WAF &rarr; Custom Rules &rarr; create rule: ip.src eq &lt;origin-ip&gt; &rarr; Block.</div></div></li>
              <li onclick="toggleCheck(2)"><div class="check-box" id="chk-2"></div><div class="check-text"><div class="check-title" id="chk-title-2">Create JA4 fingerprint blocking rule in Bot Management</div><div class="check-hint">Bot Management &rarr; Custom Rules: cf.bot_management.ja4 eq "t13d1812h1_85036bcba153_b26ce05bbdd6" &rarr; Block.</div></div></li>
              <li onclick="toggleCheck(3)"><div class="check-box" id="chk-3"></div><div class="check-text"><div class="check-title" id="chk-title-3">Review blocked prompts in Cloudflare Firewall for AI</div><div class="check-hint">Security &rarr; Firewall for AI &rarr; Events. Confirm all injection attempts show FirewallForAIInjectionScore: 100.</div></div></li>
              <li onclick="toggleCheck(4)"><div class="check-box" id="chk-4"></div><div class="check-text"><div class="check-title" id="chk-title-4">Correlate full attack chain in SentinelOne AI-SIEM</div><div class="check-hint">PowerQuery: filter by JA4 = "t13d1812h1_85036bcba153_b26ce05bbdd6". Use Purple AI: "Summarize the attack chain from the last 30 minutes."</div></div></li>
              <li onclick="toggleCheck(5)"><div class="check-box" id="chk-5"></div><div class="check-text"><div class="check-title" id="chk-title-5">Revoke API keys exposed to injection attempts</div><div class="check-hint">Audit all API keys in requests matching the attacker's source JA4 in the last 24 hours.</div></div></li>
              <li onclick="toggleCheck(6)"><div class="check-box" id="chk-6"></div><div class="check-text"><div class="check-title" id="chk-title-6">Create SentinelOne incident and notify security team</div><div class="check-hint">In S1 AI-SIEM, create a Critical incident linking all 4 attack phases. Add IOC for source IP and JA4. Trigger PagerDuty if not already fired.</div></div></li>
            </ul>
            <div class="remediation-note">&#x26A0;&#xFE0F; &nbsp; Completing this checklist does <strong>not</strong> automatically resolve the incident. Your security team must confirm all CF/S1 controls are in place before this page returns to operational status.</div>
          </div>
        </div>
      </div>

      <div class="services-section">
        <h3>Services</h3>
        <div id="services-list">
          <div class="service-row"><div class="service-name">Pyxis Chat API <small>pyxis-chat-v2 &middot; pyxis-chat-v2-fast</small></div><div class="service-status" id="svc-chat"><div class="dot dot-green"></div> Operational</div></div>
          <div class="service-row"><div class="service-name">Model Inference <small>Distributed inference network &middot; 18 regions</small></div><div class="service-status" id="svc-inference"><div class="dot dot-green"></div> Operational</div></div>
          <div class="service-row"><div class="service-name">ModelForge Training Pipeline <small>Fine-tuning jobs &middot; Dataset ingestion</small></div><div class="service-status" id="svc-training"><div class="dot dot-green"></div> Operational</div></div>
          <div class="service-row"><div class="service-name">DataVault Storage <small>Training data &middot; Model artifacts &middot; Audit logs</small></div><div class="service-status" id="svc-datavault"><div class="dot dot-green"></div> Operational</div></div>
          <div class="service-row"><div class="service-name">API Gateway <small>Authentication &middot; Rate limiting &middot; Routing</small></div><div class="service-status" id="svc-gateway"><div class="dot dot-green"></div> Operational</div></div>
          <div class="service-row"><div class="service-name">Autopilot Workflows <small>Workflow orchestration &middot; Webhook delivery</small></div><div class="service-status" id="svc-autopilot"><div class="dot dot-green"></div> Operational</div></div>
        </div>
      </div>

      <div class="uptime-section">
        <h3>90-Day Uptime</h3>
        <div class="uptime-row"><div class="uptime-row-header"><span>Pyxis Chat API</span><span id="up-chat">99.98%</span></div><div class="uptime-bars" id="bars-chat"></div><div class="uptime-legend"><span>90 days ago</span><span>Today</span></div></div>
        <div class="uptime-row"><div class="uptime-row-header"><span>Model Inference</span><span id="up-inf">99.96%</span></div><div class="uptime-bars" id="bars-inf"></div><div class="uptime-legend"><span>90 days ago</span><span>Today</span></div></div>
        <div class="uptime-row"><div class="uptime-row-header"><span>API Gateway</span><span id="up-gw">100%</span></div><div class="uptime-bars" id="bars-gw"></div><div class="uptime-legend"><span>90 days ago</span><span>Today</span></div></div>
      </div>

      <div class="incidents-section">
        <h3>Recent Incidents</h3>
        <div id="incidents-list"><p class="no-incidents">No incidents in the past 90 days.</p></div>
      </div>
    </div>`;

  // NOTE: The status page polls GET /api/incident on the API worker. In production
  // the API worker lives at https://novamind-api.<account>.workers.dev (or custom domain).
  // The /api/incident path is served by the API worker, not this shop worker.
  // For cross-origin polling to work without CORS issues in dev, override INCIDENT_API_URL.
  const scripts = `
    const INCIDENT_API_URL = window.INCIDENT_API_URL || '/api/incident';

    function buildBars(containerId, uptimePct, incident) {
      const el = document.getElementById(containerId);
      if (!el) return;
      const total = 90;
      const downCount = Math.round(total * (1 - uptimePct / 100));
      let html = '';
      for (let i = 0; i < total; i++) {
        let cls = 'bar-green';
        if (downCount > 0 && (i * 7 + 3) % 90 < downCount) cls = 'bar-yellow';
        if (i >= total - 1 && incident) cls = 'bar-red';
        html += '<div class="bar ' + cls + '" title="Day ' + (i+1) + ': ' + (cls === 'bar-green' ? 'Operational' : cls === 'bar-yellow' ? 'Degraded' : 'Outage') + '"></div>';
      }
      el.innerHTML = html;
    }
    buildBars('bars-chat', 99.98, false);
    buildBars('bars-inf',  99.96, false);
    buildBars('bars-gw',   100,   false);

    const CHECKS_KEY = 'nm_remediation_checks';
    let checks = JSON.parse(localStorage.getItem(CHECKS_KEY) || 'null') || Array(7).fill(false);

    function renderChecks() {
      let done = 0;
      for (let i = 0; i < 7; i++) {
        const box   = document.getElementById('chk-' + i);
        const title = document.getElementById('chk-title-' + i);
        if (!box || !title) continue;
        if (checks[i]) {
          box.className   = 'check-box checked';
          box.textContent = '\\u2713';
          title.className = 'check-title completed';
          done++;
        } else {
          box.className   = 'check-box';
          box.textContent = '';
          title.className = 'check-title';
        }
      }
      const counter = document.getElementById('check-count');
      if (counter) counter.textContent = done;
    }

    function toggleCheck(idx) {
      checks[idx] = !checks[idx];
      localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
      renderChecks();
    }

    renderChecks();

    async function pollIncident() {
      try {
        const res  = await fetch(INCIDENT_API_URL);
        const data = await res.json();
        applyIncidentState(data);
      } catch(e) {}
      setTimeout(pollIncident, 5000);
    }

    function applyIncidentState(data) {
      const overall    = document.getElementById('overall-status');
      const icon       = document.getElementById('overall-icon');
      const title      = document.getElementById('overall-title');
      const desc       = document.getElementById('overall-desc');
      const updated    = document.getElementById('status-updated');
      const details    = document.getElementById('incident-details');
      const incList    = document.getElementById('incidents-list');

      updated.textContent = 'Updated ' + new Date().toLocaleTimeString();

      if (data.active) {
        const isCritical = data.severity === 'critical';
        overall.className = 'overall-status ' + (isCritical ? 'outage' : 'degraded');
        icon.textContent  = isCritical ? '\\uD83D\\uDD34' : '\\uD83D\\uDFE1';
        title.textContent = data.title || (isCritical ? 'Service Outage Detected' : 'Service Degradation');
        desc.textContent  = data.message || 'We are investigating the issue.';
        details.style.display = 'block';

        const affected  = data.affected_services || [];
        const serviceMap = { 'Chat API':'svc-chat', 'Model Inference':'svc-inference', 'API Gateway':'svc-gateway', 'DataVault':'svc-datavault', 'Training':'svc-training', 'Autopilot':'svc-autopilot' };
        Object.values(serviceMap).forEach(id => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = '<div class="dot dot-green"></div> Operational';
        });
        affected.forEach(svc => {
          const el = document.getElementById(serviceMap[svc] || '');
          if (el) el.innerHTML = '<div class="dot ' + (isCritical ? 'dot-red' : 'dot-yellow') + '"></div> ' + (isCritical ? 'Outage' : 'Degraded');
        });

        buildBars('bars-chat', 99.98, affected.includes('Chat API'));
        buildBars('bars-inf',  99.96, affected.includes('Model Inference'));
        buildBars('bars-gw',   100,   affected.includes('API Gateway'));

        const startedAt = data.started_at ? new Date(data.started_at).toLocaleString() : new Date().toLocaleString();
        incList.innerHTML = '<div class="incident-card active-incident"><div class="incident-header"><div class="incident-title">\\uD83D\\uDD34 ' + (data.title || 'Active Incident') + '</div><div class="incident-date">' + startedAt + '</div></div><div class="incident-body"><strong>Status: Investigating</strong><br>' + (data.message || 'Our team is actively investigating.') + (affected.length ? '<div class="incident-affected">' + affected.map(s => '<span class="badge badge-red">' + s + '</span>').join('') + '</div>' : '') + '</div></div>';
      } else {
        overall.className = 'overall-status operational';
        icon.textContent  = '\\u2705';
        title.textContent = 'All Systems Operational';
        desc.textContent  = 'All NovaMind services are running normally.';
        details.style.display = 'none';

        ['svc-chat','svc-inference','svc-training','svc-datavault','svc-gateway','svc-autopilot'].forEach(id => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = '<div class="dot dot-green"></div> Operational';
        });
        buildBars('bars-chat', 99.98, false);
        buildBars('bars-inf',  99.96, false);
        buildBars('bars-gw',   100,   false);
        incList.innerHTML = '<p class="no-incidents">No incidents in the past 90 days.</p>';
        checks = Array(7).fill(false);
        localStorage.setItem(CHECKS_KEY, JSON.stringify(checks));
        renderChecks();
      }
    }

    pollIncident();
  `;

  return page("System Status", styles, body, scripts);
}

// ── Login page (credential stuffing surface on shop) ─────────────────────────
function loginPage() {
  const styles = `
    .login-wrapper { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 200px); padding: 2rem; }
    .login-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 12px; padding: 2.5rem; width: 100%; max-width: 400px; }
    .logo-section { text-align: center; margin-bottom: 2rem; }
    .logo-icon { width: 48px; height: 48px; background: linear-gradient(135deg, var(--blue), var(--purple)); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800; color: #fff; margin: 0 auto 0.75rem; }
    .logo-section h1 { font-size: 1.1rem; font-weight: 700; color: #fff; }
    .logo-section p  { font-size: 0.8rem; color: var(--text-muted); }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .form-group input { width: 100%; padding: 10px 14px; background: var(--navy); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 0.875rem; font-family: inherit; }
    .form-group input:focus { outline: none; border-color: var(--blue); }
    .btn-login { width: 100%; padding: 0.7rem; background: var(--blue); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600; margin-top: 0.5rem; font-family: inherit; }
    .btn-login:hover { background: var(--blue-lt); }
    .note { text-align: center; font-size: 0.75rem; color: var(--text-muted); margin-top: 1.25rem; }
    .note a { color: var(--blue-lt); }
  `;

  const body = `
    <div class="login-wrapper">
      <div class="login-card">
        <div class="logo-section">
          <div class="logo-icon">NM</div>
          <h1>NovaMind AI</h1>
          <p>Sign in to your account</p>
        </div>
        <form method="POST" action="/login">
          <div class="form-group">
            <label>Email address</label>
            <input type="text" name="username" placeholder="you@novamind.ai" autocomplete="username" />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" name="password" placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" autocomplete="current-password" />
          </div>
          <button class="btn-login" type="submit">Sign In</button>
        </form>
        <div class="note">Don't have an account? <a href="#">Create one free</a></div>
      </div>
    </div>`;

  return page("Sign In", styles, body);
}

// ── Checkout page ─────────────────────────────────────────────────────────────
function checkoutPage() {
  const styles = `
    .checkout-wrapper { max-width: 480px; margin: 3rem auto; padding: 0 1.5rem; }
    .checkout-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 12px; padding: 2rem; }
    .checkout-card h2 { font-size: 1.25rem; font-weight: 700; color: #fff; margin-bottom: 1.5rem; }
    .form-group { margin-bottom: 1rem; }
    .form-group label { display: block; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .form-group input { width: 100%; padding: 10px 14px; background: var(--navy); border: 1px solid var(--border); border-radius: 8px; color: var(--text); font-size: 0.875rem; font-family: inherit; }
    .btn-checkout { width: 100%; padding: 0.7rem; background: var(--blue); color: #fff; border: none; border-radius: 8px; cursor: pointer; font-size: 0.875rem; font-weight: 600; margin-top: 0.5rem; font-family: inherit; }
    .cart-summary { background: var(--glass); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.85rem; color: var(--text-muted); }
  `;

  const body = `
    <div class="checkout-wrapper">
      <div class="checkout-card">
        <h2>Checkout</h2>
        <div class="cart-summary">1 item in cart &mdash; NovaMind Enterprise Plan</div>
        <form method="POST" action="/checkout">
          <div class="form-group"><label>Card number</label><input type="text" name="card_number" placeholder="1234 5678 9012 3456" /></div>
          <div class="form-group"><label>Cardholder name</label><input type="text" name="name" placeholder="Jane Smith" /></div>
          <div class="form-group"><label>Expiry</label><input type="text" name="expiry" placeholder="MM/YY" /></div>
          <button class="btn-checkout" type="submit">Place Order</button>
        </form>
      </div>
    </div>`;

  return page("Checkout", styles, body);
}

// ── Cart page ─────────────────────────────────────────────────────────────────
function cartPage() {
  const styles = `.cart-wrapper { max-width: 600px; margin: 3rem auto; padding: 0 1.5rem; text-align: center; color: var(--text-muted); }`;
  const body   = `<div class="cart-wrapper"><h2 style="color:#fff;margin-bottom:1rem">Your cart</h2><p>Your cart is empty. <a href="/products">Browse products</a></p></div>`;
  return page("Cart", styles, body);
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Homepage
    if (path === "/" || path === "") {
      return homePage();
    }

    // Search — primary WAF/SQLi/XSS target
    if (path === "/search") {
      const q = url.searchParams.get("q") || "";
      return searchPage(q);
    }

    // Products listing
    if (path === "/products") {
      return productsPage();
    }

    // Documentation
    if (path === "/docs") {
      return docsPage();
    }

    // Pyxis Chat UI
    if (path === "/chat") {
      return chatPage();
    }

    // Status — polls /api/incident every 5s
    if (path === "/status") {
      return statusPage();
    }

    // Login — credential stuffing surface
    if (path === "/login") {
      if (method === "POST") {
        const body   = await request.text();
        const params = new URLSearchParams(body);
        const username = params.get("username") || "";
        const password = params.get("password") || "";
        if (!username || !password) {
          return new Response(JSON.stringify({ success: false, error: "Missing credentials" }),
            { status: 400, headers: { "Content-Type": "application/json" } });
        }
        // Always reject on shop — just generate logs. Real auth is on portal.
        return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
          { status: 401, headers: { "Content-Type": "application/json" } });
      }
      return loginPage();
    }

    // Product detail — path traversal bait
    if (path.startsWith("/products/")) {
      const rawId  = path.split("/")[2];
      const id     = parseInt(rawId);
      const product = PRODUCTS.find(p => p.id === id);
      if (!product) {
        return new Response("Product not found", { status: 404, headers: SECURITY_HEADERS });
      }
      return productDetailPage(product);
    }

    // Reviews — XSS bait (POST)
    if (path === "/reviews" && method === "POST") {
      return new Response(JSON.stringify({ success: true, message: "Review submitted" }),
        { headers: { "Content-Type": "application/json" } });
    }

    // Checkout
    if (path === "/checkout") {
      return checkoutPage();
    }

    // Cart
    if (path === "/cart") {
      return cartPage();
    }

    return new Response("Not found", { status: 404, headers: SECURITY_HEADERS });
  },
};
