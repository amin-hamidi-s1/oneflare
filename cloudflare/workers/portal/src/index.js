// NovaMind Portal Worker — novamind-portal
// Serves: employee portal behind Cloudflare Access (ZTNA)
// Attack surfaces: /login (cred-stuffing / brute-force / impossible-travel target)
//                  /admin (forced-browse / RCE bait — 401 gate when unauthed)

// ── Dark theme (shared with shop) ─────────────────────────────────────────────
const STYLES = `
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
  body { background: var(--navy); color: var(--text); font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; line-height: 1.6; min-height: 100vh; }
  a { color: var(--blue-lt); text-decoration: none; }
  a:hover { color: #fff; }

  /* ── Login ── */
  .login-wrapper { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
  .login-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 12px; padding: 40px; width: 100%; max-width: 400px; }
  .logo { text-align: center; margin-bottom: 2rem; }
  .logo-icon { width: 44px; height: 44px; background: linear-gradient(135deg, var(--blue), var(--purple)); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 0.9rem; font-weight: 800; color: #fff; margin: 0 auto 0.75rem; }
  .logo h1 { font-size: 1.1rem; color: #fff; font-weight: 700; letter-spacing: 0.02em; }
  .logo p  { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.2rem; letter-spacing: 0.06em; text-transform: uppercase; }
  .form-group { margin-bottom: 1.1rem; }
  .form-group label { display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.04em; }
  .form-group input { width: 100%; padding: 10px 14px; background: var(--navy); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 14px; font-family: inherit; }
  .form-group input:focus { outline: none; border-color: var(--blue); }
  .btn-primary { width: 100%; padding: 12px; background: var(--blue); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; letter-spacing: 0.03em; margin-top: 8px; font-family: inherit; }
  .btn-primary:hover { background: var(--blue-lt); }
  .error-msg { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); color: #fca5a5; padding: 10px 14px; border-radius: 6px; font-size: 13px; margin-bottom: 1rem; }
  .sso-divider { text-align: center; color: var(--text-muted); font-size: 12px; margin: 1.25rem 0; }
  .btn-sso { width: 100%; padding: 10px; background: transparent; border: 1px solid var(--border); border-radius: 6px; color: var(--text-muted); cursor: pointer; font-size: 13px; font-family: inherit; }
  .btn-sso:hover { background: var(--glass); color: var(--text); }
  .footer-note { text-align: center; font-size: 11px; color: var(--text-muted); margin-top: 1.5rem; }

  /* ── Dashboard ── */
  .app { display: flex; min-height: 100vh; }
  .sidebar { width: 220px; background: var(--navy2); border-right: 1px solid var(--border); padding: 24px 0; flex-shrink: 0; }
  .sidebar .brand { padding: 0 20px 24px; border-bottom: 1px solid var(--border); }
  .sidebar .brand-icon { width: 36px; height: 36px; background: linear-gradient(135deg, var(--blue), var(--purple)); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; }
  .sidebar .brand h2 { font-size: 0.95rem; color: #fff; font-weight: 700; }
  .sidebar .brand p  { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
  .sidebar nav { padding: 16px 0; }
  .sidebar nav a { display: block; padding: 10px 20px; color: var(--text-muted); text-decoration: none; font-size: 13px; border-left: 3px solid transparent; transition: all 0.1s; }
  .sidebar nav a:hover  { background: var(--glass); color: var(--text); }
  .sidebar nav a.active { background: var(--glass); color: var(--text); border-left-color: var(--blue); }
  .sidebar nav .nav-divider { height: 1px; background: var(--border); margin: 8px 20px; }
  .main { flex: 1; padding: 32px; overflow-y: auto; }
  .page-header { margin-bottom: 28px; }
  .page-header h1 { font-size: 1.35rem; color: var(--text); font-weight: 700; }
  .page-header p  { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 8px; padding: 20px; }
  .stat-card .label { font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-card .value { font-size: 28px; font-weight: bold; color: var(--text); margin-top: 6px; }
  .stat-card .sub   { font-size: 12px; color: var(--blue-lt); margin-top: 4px; }
  .table-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 8px; overflow: hidden; }
  .table-card h3 { padding: 16px 20px; font-size: 14px; border-bottom: 1px solid var(--border); color: #fff; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 20px; font-size: 13px; text-align: left; }
  th { color: var(--text-muted); font-weight: 500; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid var(--border); }
  td { color: var(--text-muted); border-bottom: 1px solid rgba(255,255,255,0.03); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
  .badge-green  { background: rgba(16,185,129,0.15); color: #4ade80; border: 1px solid rgba(16,185,129,0.2); }
  .badge-yellow { background: rgba(245,158,11,0.15); color: #fbbf24; border: 1px solid rgba(245,158,11,0.2); }
  .badge-red    { background: rgba(239,68,68,0.15);  color: #f87171; border: 1px solid rgba(239,68,68,0.2); }

  /* ── Admin ── */
  .admin-page { max-width: 1000px; margin: 3rem auto; padding: 0 1.5rem; }
  .admin-banner { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: 10px; padding: 0.75rem 1.1rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 0.6rem; font-size: 0.82rem; color: #fbbf24; }
  .admin-page h1 { font-size: 1.5rem; font-weight: 700; color: #fff; margin-bottom: 0.3rem; }
  .admin-page > p { color: var(--text-muted); font-size: 0.85rem; margin-bottom: 2rem; }
  .admin-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; }
  .admin-card { background: var(--navy2); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .admin-card-header { padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--border); display: flex; align-items: center; justify-content: space-between; }
  .admin-card-header h3 { font-size: 0.875rem; font-weight: 700; color: #fff; }
  .admin-card-body { padding: 1rem 1.1rem; }
  .admin-stat { margin-bottom: 0.75rem; }
  .admin-stat-val { font-size: 1.4rem; font-weight: 800; color: #fff; }
  .admin-stat-lbl { font-size: 0.75rem; color: var(--text-muted); }
  .admin-list { list-style: none; display: flex; flex-direction: column; gap: 0.5rem; }
  .admin-list-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid var(--border); font-size: 0.82rem; }
  .admin-list-item:last-child { border-bottom: none; }
  .ali-label { color: var(--text); }
  .ali-value { color: var(--text-muted); }

  /* ── 401 Gate ── */
  .gate-page { min-height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center; padding: 2rem; }
  .gate-card { text-align: center; max-width: 400px; }
  .gate-icon { font-size: 3rem; margin-bottom: 1.25rem; display: block; }
  .gate-card h1 { font-size: 1.4rem; font-weight: 700; color: #fff; margin-bottom: 0.5rem; }
  .gate-card p  { color: var(--text-muted); font-size: 0.875rem; line-height: 1.65; margin-bottom: 1.5rem; }
  .gate-code { font-family: 'JetBrains Mono', monospace; font-size: 0.78rem; background: var(--navy2); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; color: var(--red); margin-bottom: 1.5rem; text-align: left; }
  .gate-btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.4rem; border-radius: 8px; background: var(--blue); color: #fff; font-weight: 600; font-size: 0.875rem; border: none; cursor: pointer; text-decoration: none; }
  .gate-btn:hover { background: var(--blue-lt); color: #fff; }
`;

// ── Simple random ID for the gate page ────────────────────────────────────────
function randReqId() {
  return Math.floor(100000 + Math.random() * 899999);
}

// ── Login page ────────────────────────────────────────────────────────────────
function loginPage(error = "") {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NovaMind — Employee Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${STYLES}</style>
</head>
<body>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="logo">
        <div class="logo-icon">NM</div>
        <h1>NOVAMIND</h1>
        <p>Employee Portal</p>
      </div>
      ${error ? `<div class="error-msg">${error}</div>` : ""}
      <form method="POST" action="/login">
        <div class="form-group">
          <label>Corporate Email</label>
          <input type="text" name="username" placeholder="you@novamind.ai" autocomplete="username" />
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" name="password" placeholder="&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;&#x2022;" autocomplete="current-password" />
        </div>
        <button class="btn-primary" type="submit">Sign In</button>
      </form>
      <div class="sso-divider">or</div>
      <button class="btn-sso">Continue with SSO (Okta)</button>
      <div class="footer-note">NovaMind IT &mdash; <a href="#">Need help?</a></div>
    </div>
  </div>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
}

// ── Dashboard page ────────────────────────────────────────────────────────────
function dashboardPage(user = "employee@novamind.ai") {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — NovaMind Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${STYLES}</style>
</head>
<body>
  <div class="app">
    <div class="sidebar">
      <div class="brand">
        <div class="brand-icon">NM</div>
        <h2>NOVAMIND</h2>
        <p>Employee Portal</p>
      </div>
      <nav>
        <a href="/dashboard" class="active">Dashboard</a>
        <a href="/dashboard/profile">My Profile</a>
        <a href="/dashboard/directory">Directory</a>
        <a href="/dashboard/it">IT Requests</a>
        <a href="/dashboard/payroll">Payroll</a>
        <div class="nav-divider"></div>
        <a href="/admin">Admin Console</a>
        <a href="/logout">Sign Out</a>
      </nav>
    </div>
    <div class="main">
      <div class="page-header">
        <h1>Welcome back</h1>
        <p>Signed in as ${user} &middot; Last login: today at 09:14 AM from 198.51.100.1</p>
      </div>
      <div class="cards">
        <div class="stat-card">
          <div class="label">API Keys Active</div>
          <div class="value">3</div>
          <div class="sub">1 expiring soon</div>
        </div>
        <div class="stat-card">
          <div class="label">Pyxis API Calls (30d)</div>
          <div class="value">84K</div>
          <div class="sub">&#x2191; 12% vs last month</div>
        </div>
        <div class="stat-card">
          <div class="label">ModelForge Jobs</div>
          <div class="value">7</div>
          <div class="sub">2 in training</div>
        </div>
        <div class="stat-card">
          <div class="label">DataVault Storage</div>
          <div class="value">42 GB</div>
          <div class="sub">of 100 GB used</div>
        </div>
      </div>
      <div class="table-card">
        <h3>Recent Activity</h3>
        <table>
          <thead>
            <tr><th>Event</th><th>User</th><th>Time</th><th>Status</th></tr>
          </thead>
          <tbody>
            <tr><td>API key rotation</td><td>admin@novamind.ai</td><td>10 min ago</td><td><span class="badge badge-green">OK</span></td></tr>
            <tr><td>Login from new device</td><td>eng@novamind.ai</td><td>1 hr ago</td><td><span class="badge badge-yellow">Review</span></td></tr>
            <tr><td>Training job completed</td><td>ml@novamind.ai</td><td>2 hrs ago</td><td><span class="badge badge-green">OK</span></td></tr>
            <tr><td>Failed login (&#xD7;5)</td><td>unknown@external.com</td><td>3 hrs ago</td><td><span class="badge badge-red">Alert</span></td></tr>
            <tr><td>Export request: customers.csv</td><td>api_user@novamind.ai</td><td>4 hrs ago</td><td><span class="badge badge-yellow">Review</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
}

// ── Admin gate page — 401 when unauthed ───────────────────────────────────────
function adminGatePage() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>401 Unauthorized — NovaMind AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${STYLES}</style>
</head>
<body>
  <div class="gate-page">
    <div class="gate-card">
      <span class="gate-icon">&#x1F512;</span>
      <h1>401 &mdash; Unauthorized</h1>
      <p>This area requires administrator credentials. Access attempts are logged and monitored by the NovaMind security team.</p>
      <div class="gate-code">
        HTTP 401 Unauthorized<br>
        X-NovaMind-RequestId: ${randReqId()}<br>
        Retry-After: &mdash;
      </div>
      <a href="/login" class="gate-btn">Sign In</a>
    </div>
  </div>
</body>
</html>`, { status: 401, headers: { "Content-Type": "text/html" } });
}

// ── Admin console — only shown when authed ────────────────────────────────────
function adminPage(user = "admin@novamind.ai") {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Console — NovaMind AI</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${STYLES}</style>
</head>
<body>
  <div class="admin-page">
    <div class="admin-banner">
      &#x26A0;&#xFE0F; You are in the admin console. Actions here affect all tenants. Signed in as: ${user}
    </div>
    <h1>Admin Console</h1>
    <p>Internal platform management. Access is logged and audited.</p>
    <div class="admin-grid">
      <div class="admin-card">
        <div class="admin-card-header"><h3>Platform Health</h3><span class="badge badge-green">Healthy</span></div>
        <div class="admin-card-body">
          <div class="admin-stat"><div class="admin-stat-val">99.99%</div><div class="admin-stat-lbl">30-day uptime</div></div>
          <ul class="admin-list">
            <li class="admin-list-item"><span class="ali-label">API Gateway</span><span class="badge badge-green">Operational</span></li>
            <li class="admin-list-item"><span class="ali-label">Pyxis Inference Fleet</span><span class="badge badge-green">Operational</span></li>
            <li class="admin-list-item"><span class="ali-label">Training Pipeline</span><span class="badge badge-green">Operational</span></li>
            <li class="admin-list-item"><span class="ali-label">DataVault</span><span class="badge badge-green">Operational</span></li>
          </ul>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-header"><h3>Tenants</h3></div>
        <div class="admin-card-body">
          <div class="admin-stat"><div class="admin-stat-val">512</div><div class="admin-stat-lbl">Active tenants</div></div>
          <ul class="admin-list">
            <li class="admin-list-item"><span class="ali-label">Enterprise</span><span class="ali-value">48</span></li>
            <li class="admin-list-item"><span class="ali-label">Standard</span><span class="ali-value">201</span></li>
            <li class="admin-list-item"><span class="ali-label">Free</span><span class="ali-value">263</span></li>
            <li class="admin-list-item"><span class="ali-label">New (24h)</span><span class="ali-value">7</span></li>
          </ul>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-header"><h3>Security Events (24h)</h3></div>
        <div class="admin-card-body">
          <div class="admin-stat"><div class="admin-stat-val" style="color:var(--yellow)">14</div><div class="admin-stat-lbl">Flagged requests</div></div>
          <ul class="admin-list">
            <li class="admin-list-item"><span class="ali-label">Rate limit exceeded</span><span class="ali-value">9</span></li>
            <li class="admin-list-item"><span class="ali-label">Invalid API key</span><span class="ali-value">3</span></li>
            <li class="admin-list-item"><span class="ali-label">Prompt injection attempt</span><span class="ali-value">2</span></li>
            <li class="admin-list-item"><span class="ali-label">Blocked by WAF</span><span class="ali-value" style="color:var(--red)">0</span></li>
          </ul>
        </div>
      </div>
      <div class="admin-card">
        <div class="admin-card-header"><h3>Pyxis Model Registry</h3></div>
        <div class="admin-card-body">
          <ul class="admin-list">
            <li class="admin-list-item"><span class="ali-label">pyxis-chat-v2</span><span class="badge badge-green">Live</span></li>
            <li class="admin-list-item"><span class="ali-label">pyxis-chat-v2-fast</span><span class="badge badge-green">Live</span></li>
            <li class="admin-list-item"><span class="ali-label">pyxis-embed-v1</span><span class="badge badge-green">Live</span></li>
            <li class="admin-list-item"><span class="ali-label">pyxis-chat-v3</span><span class="badge badge-yellow">Staging</span></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`, { headers: { "Content-Type": "text/html" } });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname;
    const method = request.method;

    // Root → redirect to login
    if (path === "/" || path === "") {
      return Response.redirect(new URL("/login", request.url), 302);
    }

    // Login GET
    if (path === "/login" && method === "GET") {
      return loginPage();
    }

    // Login POST — credential stuffing / brute force / impossible travel target
    if (path === "/login" && method === "POST") {
      const body   = await request.text();
      const params = new URLSearchParams(body);
      const username = params.get("username") || "";
      const password = params.get("password") || "";

      if (!username || !password) {
        return new Response(JSON.stringify({ success: false, error: "Missing credentials" }),
          { status: 400, headers: { "Content-Type": "application/json" } });
      }

      // LAB NOTE: credentials are configurable via Wrangler secrets.
      // Set via: wrangler secret put PORTAL_USERNAME / wrangler secret put PORTAL_PASSWORD
      const validUser = env.PORTAL_USERNAME || "admin@novamind.ai";
      const validPass = env.PORTAL_PASSWORD || "NovaMindAdmin2026!";
      if (username === validUser && password === validPass) {
        // In a real deployment Cloudflare Access manages the session.
        // For lab purposes, successful login just redirects to dashboard.
        return Response.redirect(new URL("/dashboard", request.url), 302);
      }

      return new Response(JSON.stringify({ success: false, error: "Invalid email or password" }),
        { status: 401, headers: { "Content-Type": "application/json" } });
    }

    // Dashboard and sub-pages
    if (path.startsWith("/dashboard")) {
      // In lab mode we don't enforce a real session — Cloudflare Access sits in front.
      const user = env.PORTAL_USERNAME || "admin@novamind.ai";
      return dashboardPage(user);
    }

    // Admin — 401 gate when unauthed; real view requires an authed session
    // LAB NOTE: Cloudflare Access should gate this in production.
    // For forced-browse simulation the route is intentionally accessible but returns 401.
    // Attack team hits /admin → gets the 401 gate page → WAF logs the attempt.
    if (path === "/admin") {
      // Check for a Cloudflare Access JWT in the CF-Access-Authenticated-User-Email header
      // (set by CF Access when a valid session exists). Absent = not authed.
      const cfUser = request.headers.get("Cf-Access-Authenticated-User-Email");
      if (cfUser) {
        return adminPage(cfUser);
      }
      // Also accept the lab's mock portal credential via a simple session cookie
      // (this keeps the route demo-able without live CF Access credentials)
      const cookie = request.headers.get("Cookie") || "";
      if (cookie.includes("nm_portal_authed=1")) {
        const user = env.PORTAL_USERNAME || "admin@novamind.ai";
        return adminPage(user);
      }
      return adminGatePage();
    }

    // Logout
    if (path === "/logout") {
      return Response.redirect(new URL("/login", request.url), 302);
    }

    return new Response("Not found", { status: 404 });
  },
};
