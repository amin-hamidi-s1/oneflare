# OneFlare

A complete Cloudflare + SentinelOne detection lab. Deploy a mock company across Cloudflare Workers, generate realistic attack traffic, and demonstrate end-to-end detection and automated response through SentinelOne Hyperautomation.

```
Attack simulation scripts
        ↓
Cloudflare  (WAF · Gateway · Access · Workers)
        ↓
Logpush → SentinelOne
        ↓
STAR Detections
        ↓
Hyperautomation → Cloudflare response actions
```

## What Gets Deployed

Three linked Cloudflare Workers forming a mock company ("AcmeCorp"):

| Worker | URL | Attack Surface |
|---|---|---|
| Shop | `shop.YOUR_DOMAIN` | SQLi on `/search`, XSS on reviews, path traversal |
| Portal | `portal.YOUR_DOMAIN` | Credential stuffing, brute force, impossible travel |
| API | `api.YOUR_DOMAIN` | Bulk data exfil via `/api/v1/customers/export` |

Five detection scenarios covered end-to-end — see [`docs/story-map.md`](docs/story-map.md).

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | v18+ | https://nodejs.org |
| Wrangler CLI | v4+ | `npm install -g wrangler` |
| curl | any | pre-installed on macOS/Linux |
| python3 | v3.8+ | pre-installed on macOS |

---

## Cloudflare Account Setup

These steps are required once before running the setup script. They cannot be automated via API.

### 1. Create a Cloudflare account
Sign up at [cloudflare.com](https://cloudflare.com) if you don't have one.

### 2. Add your domain
1. Go to **Dashboard → Add a Site**
2. Enter your domain (e.g. `acmecorp.dev`) and select the **Free** plan
3. Cloudflare will scan existing DNS records — confirm and continue
4. Copy the two **nameserver addresses** Cloudflare gives you (e.g. `marge.ns.cloudflare.com`)
5. Go to your domain registrar and update the domain's nameservers to Cloudflare's
6. Wait for propagation (5 minutes to 48 hours — usually under 30 minutes)
7. The zone status will change from **Pending** to **Active**

> **Using workers.dev instead of a custom domain?**
> You can skip steps 2–7 and use the free `*.workers.dev` subdomain Cloudflare assigns your account. The setup script will claim one automatically.

### 3. Get your credentials

**API Token** — go to [dash.cloudflare.com → My Profile → API Tokens → Create Token](https://dash.cloudflare.com/profile/api-tokens)

Select **Create Custom Token** and add these permissions:

| Resource | Permission |
|---|---|
| Zone / Zone | Read |
| Zone / Zone Settings | Edit |
| Zone / DNS | Edit |
| Zone / Firewall Services | Edit |
| Zone / Workers Routes | Edit |
| Account / Workers Scripts | Edit |
| Account / Zero Trust | Edit |
| Account / Access: Apps and Policies | Edit |
| Account / Logs | Edit |

**Account ID** — visible in the right sidebar of any zone page in the dashboard, or at `dash.cloudflare.com → your account name`.

**Zone ID** — visible in the right sidebar when you click into your domain's zone in the dashboard.

### 4. Enable Zero Trust / Access
1. Go to **[one.dash.cloudflare.com](https://one.dash.cloudflare.com)** (Zero Trust dashboard)
2. Select your account and complete the Zero Trust onboarding (free tier is fine)
3. This enables Cloudflare Access and Gateway — required for the portal and DNS scenarios

### 5. Configure Logpush → SentinelOne

Logpush cannot be configured via the API in this repo (it requires your SentinelOne endpoint details). Configure it manually in the dashboard:

**Zone-level Logpush** (`dash.cloudflare.com → your zone → Analytics → Logpush`):

| Dataset | Scenarios covered |
|---|---|
| HTTP requests | Data exfil, login attacks, all web traffic |
| Firewall events | WAF blocks — SQLi, XSS, path traversal |
| DNS logs | DNS tunneling / C2 beaconing |

**Zero Trust Logpush** (`one.dash.cloudflare.com → Logs → Logpush`):

| Dataset | Scenarios covered |
|---|---|
| Access requests | Credential stuffing, impossible travel |
| Gateway DNS | DNS tunneling / C2 beaconing |
| Audit logs v2 | Configuration change detection |
| Gateway HTTP | Data exfil through Zero Trust layer |

For each job, select **SentinelOne** as the destination and enter your SentinelOne Logpush endpoint URL and API token.

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/aminhamidi-s1/oneflare.git
cd oneflare

# 2. Configure credentials
cp .env.example .env.local
# Edit .env.local and fill in all four values

# 3. Load credentials into your shell
source .env.local

# 4. Run the setup script
bash cloudflare/setup.sh
```

The script runs through 7 steps:
1. Validates prerequisites and credentials
2. Claims a `workers.dev` subdomain
3. Deploys all three Workers
4. Creates DNS records for custom subdomains
5. Creates WAF rules (SQLi, XSS, path traversal, exfil logging, login logging)
6. Creates Cloudflare Access app and policy for the portal
7. Creates Gateway DNS logging policy

### After setup — set Worker secrets

The portal and API Workers accept credentials via Wrangler secrets (not hardcoded). Set them after deployment:

```bash
# Portal credentials (used in credential stuffing simulation)
wrangler secret put PORTAL_USERNAME --name acmecorp-portal
wrangler secret put PORTAL_PASSWORD --name acmecorp-portal

# API credentials (used in data exfil simulation)
wrangler secret put API_USERNAME --name acmecorp-api
wrangler secret put API_PASSWORD --name acmecorp-api
```

If secrets are not set, the Workers fall back to default lab credentials documented in the attack scripts.

---

## Environment Variables

| Variable | Description | Where to find it |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Scoped API token | Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID | Dashboard right sidebar |
| `CLOUDFLARE_ZONE_ID` | Zone ID for your domain | Zone overview right sidebar |
| `CLOUDFLARE_DOMAIN` | Your domain (e.g. `acmecorp.dev`) | Whatever domain you added |

Copy `.env.example` to `.env.local`, populate it, and run `source .env.local` before any commands.
**Never commit `.env.local`** — it is gitignored.

---

## Repository Structure

```
oneflare/
├── README.md
├── .env.example               # Credential template — safe to commit
├── .gitignore
├── cloudflare/
│   ├── setup.sh               # Master setup script — run this
│   ├── workers/
│   │   ├── shop/              # Public webstore Worker
│   │   ├── portal/            # Employee portal Worker (Access protected)
│   │   └── api/               # REST API Worker (exfil target)
│   ├── waf/
│   │   └── rules.json         # WAF filters and firewall rules as code
│   └── gateway/
│       └── dns-policy.json    # Gateway DNS logging policy
├── docs/
│   ├── story-map.md           # Attack → Detection → Response scenarios
│   ├── infrastructure.md      # Infrastructure setup reference
│   └── s1-hyperautomation-actions.md  # SentinelOne action reference
├── attack-scripts/            # Simulation scripts (coming soon)
├── detections/                # SentinelOne STAR rules (coming soon)
└── hyperautomation/           # Response workflow definitions (coming soon)
```

---

## CI/CD

Push to `main` automatically deploys all three Workers via GitHub Actions (`.github/workflows/deploy.yml`).

Add these as repository secrets in **GitHub → Settings → Secrets → Actions**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Your scoped API token |
| `CLOUDFLARE_ACCOUNT_ID` | Your account ID |

---

## Detection Scenarios

Full scenario details including STAR rule logic and Hyperautomation workflows are in [`docs/story-map.md`](docs/story-map.md).

| # | Scenario | Cloudflare Product | Key Response |
|---|---|---|---|
| 1 | SQL injection on webstore | WAF | Block IP, PCAP capture |
| 2 | Credential stuffing on portal | Access | Block IP, zone lockdown |
| 3 | Impossible travel | Access | Block both IPs, SOC gate |
| 4 | DNS tunneling / C2 beaconing | Gateway DNS | Sinkhole domain, DNS Firewall |
| 5 | Bulk data exfiltration | Workers + WAF | Firewall rule, WAF tune |
| 6 | Unauthorized config change | Audit logs | Rollback rule, notify SOC |

---

## Security Notes

- Workers contain intentional vulnerabilities (reflected XSS on `/search`, open export endpoint) — these are **by design** for WAF and detection testing
- CORS is intentionally permissive on the API Worker for the same reason
- Worker credentials are configurable via Wrangler secrets; default fallback values are for lab use only
- `wrangler.toml` files use `YOUR_DOMAIN` as a placeholder — the setup script replaces this with your actual domain at deploy time
