"""
campaigns/__init__.py — Campaign registry for the ThreatOps drip-flow engine.

CAMPAIGNS maps a campaign key to display metadata + the module's PHASES list.
Consumed by:
  - lab-ui/backend/main.py  GET /api/campaigns
  - The asyncio drip task that calls fire_one / fire_many per phase

target_role tells the backend which NovaMind worker to use as the base URL:
  "shop"   → config.SHOP_URL   (acmecorp-shop)
  "portal" → config.PORTAL_URL (acmecorp-portal)
  "api"    → config.API_URL    (acmecorp-api)
"""

from .financial  import PHASES as _FINANCIAL_PHASES
from .healthcare import PHASES as _HEALTHCARE_PHASES
from .saas       import PHASES as _SAAS_PHASES
from .ctf        import PHASES as _CTF_PHASES

CAMPAIGNS = {
    "financial": {
        "name":        "Operation Wire Fraud",
        "campaign":    "Financial Services",
        "description": "Sophisticated threat actor targeting Meridian Bank's online banking platform to intercept wire transfers.",
        "color":       "#1a5276",
        "icon":        "🏦",
        "target_role": "api",          # primary target: acmecorp-api
        "PHASES":      _FINANCIAL_PHASES,
        "num_phases":  len(_FINANCIAL_PHASES),
    },
    "healthcare": {
        "name":        "Operation HIPAA Breach",
        "campaign":    "Healthcare",
        "description": "Criminal group targeting MedCore Health Systems to steal patient PHI for sale on the dark web.",
        "color":       "#1e8449",
        "icon":        "💊",
        "target_role": "api",          # primary target: acmecorp-api
        "PHASES":      _HEALTHCARE_PHASES,
        "num_phases":  len(_HEALTHCARE_PHASES),
    },
    "saas": {
        "name":        "Operation Tenant Escape",
        "campaign":    "SaaS / Tech",
        "description": "Competitor's hired group targeting CloudMatrix SaaS platform to steal customer tenant data and API keys.",
        "color":       "#6c3483",
        "icon":        "☁️",
        "target_role": "api",          # primary target: acmecorp-api
        "PHASES":      _SAAS_PHASES,
        "num_phases":  len(_SAAS_PHASES),
    },
    "ctf": {
        "name":        "Operation Agentic AI Breakout",
        "campaign":    "OneFlare CTF",
        "description": "A rogue Pyxis AI agent attacks NovaMind across 4 escalating boxes — edge recon, polymorphic bot, prompt injection, and a full multi-vector breakout.",
        "color":       "#7c2d12",
        "icon":        "🧠",
        "target_role": "api",          # primary: acmecorp-api (/api/v1/chat etc.)
        "PHASES":      _CTF_PHASES,
        "num_phases":  len(_CTF_PHASES),
    },
}

__all__ = ["CAMPAIGNS"]
