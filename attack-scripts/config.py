import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env.local from project root
load_dotenv(Path(__file__).parent.parent / ".env.local")

DOMAIN = os.getenv("CLOUDFLARE_DOMAIN", "acmecorp-lab.workers.dev")

# Target URLs — workers.dev by default, auto-swaps when CLOUDFLARE_DOMAIN is a custom domain
if "workers.dev" in DOMAIN:
    SHOP_URL   = f"https://acmecorp-shop.{DOMAIN}"
    PORTAL_URL = f"https://acmecorp-portal.{DOMAIN}"
    API_URL    = f"https://acmecorp-api.{DOMAIN}"
else:
    SHOP_URL   = f"https://shop.{DOMAIN}"
    PORTAL_URL = f"https://portal.{DOMAIN}"
    API_URL    = f"https://api.{DOMAIN}"

# Lab credentials (match Wrangler secrets or Worker defaults)
PORTAL_USERNAME = os.getenv("PORTAL_USERNAME", "admin@acmecorp.com")
PORTAL_PASSWORD = os.getenv("PORTAL_PASSWORD", "AcmeAdmin2026!")
API_USERNAME    = os.getenv("API_USERNAME",    "api_user@acmecorp.com")
API_PASSWORD    = os.getenv("API_PASSWORD",    "ApiUser2026!")

# Wordlists
WORDLIST_DIR = Path(__file__).parent / "wordlists"
USERNAMES = (WORDLIST_DIR / "usernames.txt").read_text().splitlines()
PASSWORDS = (WORDLIST_DIR / "passwords.txt").read_text().splitlines()

# DNS tunneling target — uses a domain we control to generate realistic C2-like queries
DNS_C2_DOMAIN = "c2tunnel.acmecorp-lab.workers.dev"

# Incident webhook — campaigns/incident.py posts to this endpoint
INCIDENT_KEY = os.getenv("INCIDENT_KEY", "")

# Logs output directory — best-effort. On ephemeral/read-only container
# filesystems (e.g. Cloudflare Containers with no persistent volume) this
# must never crash the app at import time; SessionLog.save() also guards
# each write independently.
LOGS_DIR = Path(__file__).parent / "logs"
try:
    LOGS_DIR.mkdir(exist_ok=True)
except OSError:
    pass

# Cloudflare Gateway DoH endpoint for the lab's Zero Trust location.
# Find it at: one.dash.cloudflare.com → Networks → Resolvers & Proxies → DNS locations
#             → [your location] → Edit → Setup instructions → DNS over HTTPS
# Format: https://<hex-id>.cloudflare-gateway.com/dns-query
# IMPORTANT: use the hex-subdomain URL, NOT your team name — the team-name URL
#            resolves DNS but does not log queries to Gateway activity or Logpush.
# Without this set, DNS queries bypass Gateway entirely — no logs will appear.
def _normalize_doh_url(raw: str) -> str:
    """Return a usable DoH endpoint from whatever the user pasted.

    httpx rejects a URL with no scheme ("Request URL is missing an
    'http://' or 'https://' protocol"), and a Cloudflare Gateway DoH
    endpoint lives at the /dns-query path. Accept a bare host
    ("team.cloudflareaccess.com"), a host+path, or a full URL and coerce
    it to "https://<host>/dns-query" so the scenario never crashes on a
    slightly-off value from .env.local or the Settings UI.
    """
    from urllib.parse import urlparse

    url = (raw or "").strip()
    if not url:
        return ""
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    parsed = urlparse(url)
    if parsed.path in ("", "/"):
        url = url.rstrip("/") + "/dns-query"
    return url


CF_GATEWAY_DOH_URL = _normalize_doh_url(os.getenv("CF_GATEWAY_DOH_URL", ""))
