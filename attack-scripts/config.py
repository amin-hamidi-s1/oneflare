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

# Logs output directory
LOGS_DIR = Path(__file__).parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)
