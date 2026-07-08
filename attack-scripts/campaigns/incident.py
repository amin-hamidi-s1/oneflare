"""
campaigns/incident.py — Incident webhook helper for the lab /status pages.

Posts to a worker's /api/incident endpoint using the INCIDENT_KEY env var. The
target URL is built from config.py — never an external host.

Two entry points, so the two labs stay independent:
  * signal_incident(...)      → INCIDENT_URL (defaults to the api/Pyxis worker).
                                Used by the "Agentic AI Breakout" CTF.
  * signal_shop_incident(...) → SHOP_URL (the standalone SoleDrop shop worker,
                                which owns its OWN /api/incident + INCIDENT_KV).
                                Defaults to the drop-day bot-swarm narrative.

Usage (from backend engine or campaign code):
    from campaigns.incident import signal_incident, signal_shop_incident
    signal_incident(active=True, severity="critical", affected=["Pyxis Chat API"])
    signal_shop_incident(active=True)   # flips shop.soledrop.co /status
    signal_incident(active=False)       # clear
"""

import sys
from pathlib import Path

import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Add attack-scripts root to path so config imports cleanly when this module
# is loaded from any working directory.
_ROOT = Path(__file__).parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from config import INCIDENT_URL, SHOP_URL, INCIDENT_KEY  # noqa: E402


def signal_incident(
    active: bool,
    title: str = "Agentic AI Breakout",
    severity: str = "critical",
    affected: list = None,
    phase: int = 0,
    phase_name: str = "",
    message: str = "",
    timeout: int = 8,
    target_url: str = None,
) -> bool:
    """
    POST to a worker's /api/incident to set or clear its status banner.

    Parameters
    ----------
    active      : True = set incident active; False = clear
    title       : Incident title shown on /status page
    severity    : "critical" | "high" | "medium" | "low"
    affected    : list of affected service names, e.g. ["Pyxis Chat API"]
    phase       : current CTF box/phase number (0 = not phase-specific)
    phase_name  : human-readable phase name
    message     : additional context for the status page
    timeout     : request timeout in seconds
    target_url  : override the incident worker base URL (defaults to INCIDENT_URL,
                  i.e. the api/Pyxis worker). signal_shop_incident() passes SHOP_URL.

    Returns
    -------
    True if the POST succeeded (2xx), False otherwise.
    """
    if not INCIDENT_KEY:
        # Silently skip — lab may not have an incident webhook configured.
        return False

    base = target_url or INCIDENT_URL
    target = f"{base}/api/incident"

    # Field shape MUST match the target worker's POST /api/incident, which
    # authenticates via the body field `key` (data.key === env.INCIDENT_KEY) and
    # reads `affected_services` + `started_at`. Both the api worker and the
    # standalone SoleDrop worker (worker.js) share this shape — extra fields
    # like `phase` are ignored harmlessly.
    import datetime
    payload = {
        "key": INCIDENT_KEY,
        "active": active,
        "title": title,
        "severity": severity if active else "none",
        "affected_services": affected or ["Pyxis Chat API"],
        "started_at": datetime.datetime.utcnow().isoformat() + "Z" if active else None,
        "phase": phase,
        "phase_name": phase_name,
        "message": message or (
            f"Campaign '{title}' active — Box {phase}: {phase_name}"
            if active else
            f"Campaign '{title}' stopped — incident cleared"
        ),
    }

    headers = {"Content-Type": "application/json"}

    try:
        resp = requests.post(
            target,
            json=payload,
            headers=headers,
            timeout=timeout,
            allow_redirects=False,
            verify=False,
        )
        return resp.status_code < 300
    except requests.RequestException:
        return False


def signal_shop_incident(
    active: bool,
    title: str = "Drop-Day Bot Swarm Detected",
    severity: str = "critical",
    affected: list = None,
    message: str = "",
    timeout: int = 8,
) -> bool:
    """
    Flip the standalone SoleDrop shop /status page (SHOP_URL/api/incident).

    Kept separate from signal_incident() so the SoleDrop shop lab and the
    AI-breakout CTF target independent workers. Defaults to the drop-day
    bot-swarm narrative that matches the SoleDrop status page timeline.
    """
    return signal_incident(
        active,
        title=title,
        severity=severity,
        affected=affected or ["Storefront", "Checkout API", "Customer Accounts"],
        message=message,
        timeout=timeout,
        target_url=SHOP_URL,
    )
