"""
docs_registry.py — role-gated manifest for the in-console Docs viewer.

Files are read from DOCS_ROOT, which the backend expects to contain a copy of
the repo root (README.md, ARCHITECTURE.md, docs/*.md) — see docker-compose.yml
(bind mount, local dev) and Dockerfile (COPY, production image).

Roles are additive: "admin" sees everything "attendee" sees, plus the
admin-only set. There's no third tier — this mirrors the two audiences that
actually exist (workshop attendees vs. whoever operates/facilitates).
"""

import os
import re
from pathlib import Path
from typing import Optional

DOCS_ROOT = Path(os.getenv("DOCS_ROOT", "/app/docs-root"))

# id -> (title, relative path, min_role, icon)
# min_role "attendee" = visible to everyone (incl. unauthenticated / Access
# not configured); "admin" = only visible once caller_identity() resolves to
# the admin role via a verified Access JWT + DOCS_ADMIN_EMAILS allowlist.
# icon is a slug the frontend maps to a lucide-react icon — purely cosmetic.
_MANIFEST = [
    ("readme",              "README",                          "README.md",                          "attendee", "book"),
    ("architecture",        "Architecture Reference",           "ARCHITECTURE.md",                    "attendee", "network"),
    ("attendee-guide",      "Attendee / User Guide",            "docs/attendee-guide.md",              "attendee", "compass"),
    ("troubleshooting",     "Troubleshooting Guide",            "docs/troubleshooting-guide.md",       "attendee", "wrench"),
    ("story-map",           "Story Map",                        "docs/story-map.md",                  "attendee", "map"),
    ("attacks-detections",  "Attacks & Detections Reference",   "docs/attacks-and-detections.md",      "attendee", "swords"),
    ("detections-pq",       "Detections — PowerQuery Reference","docs/detections-powerquery.md",       "attendee", "search"),
    ("admin-guide",         "Admin / Operator Guide",           "docs/admin-guide.md",                 "admin",    "shield"),
    ("infrastructure",      "Cloudflare Infrastructure Plan",   "docs/infrastructure.md",              "admin",    "server"),
    ("hyperautomation",     "S1 Hyperautomation Actions",       "docs/s1-hyperautomation-actions.md",  "admin",    "workflow"),
    ("soledrop-mapping",    "SoleDrop CTF — CF/Detection Map",  "docs/soledrop-cloudflare-mapping.md", "admin",    "target"),
    # Question pack has the answers attendees are meant to hunt for themselves
    # — admin/facilitator-only, never attendee-visible.
    ("ctf-questions",       "SoleDrop CTF — Question Pack",     "docs/ctf-questions.md",               "admin",    "flag"),
]

# Docs whose in-console rendering strips specific images/badges present in the
# source file — cosmetic only, does not touch the file on disk. Currently just
# the README's OneFlare logo <img> and SentinelOne shields.io badge.
_STRIP_PATTERNS = {
    "readme": [
        re.compile(r'<img src="docs/assets/logo\.png"[^>]*/?>\n*'),
        re.compile(r'\[!\[SentinelOne\]\([^)]*\)\]\([^)]*\)\n*'),
    ],
}

_ROLE_RANK = {"attendee": 0, "admin": 1}


def _visible(min_role: str, role: str) -> bool:
    return _ROLE_RANK.get(role, 0) >= _ROLE_RANK.get(min_role, 0)


def list_docs(role: str) -> list:
    """Metadata only (id/title/min_role/icon) for docs visible at `role`."""
    return [
        {"id": doc_id, "title": title, "min_role": min_role, "icon": icon}
        for doc_id, title, _path, min_role, icon in _MANIFEST
        if _visible(min_role, role)
    ]


def get_doc(doc_id: str, role: str) -> Optional[dict]:
    """Return {id, title, content} if `doc_id` exists and is visible at
    `role`; None if unknown or not permitted (caller maps None -> 404, and
    should treat "exists but not permitted" the same as "unknown" — 404, not
    403, so the manifest doesn't leak which admin-only docs exist)."""
    for entry_id, title, rel_path, min_role, _icon in _MANIFEST:
        if entry_id != doc_id:
            continue
        if not _visible(min_role, role):
            return None
        full_path = DOCS_ROOT / rel_path
        try:
            content = full_path.read_text(encoding="utf-8")
        except OSError:
            return None
        for pattern in _STRIP_PATTERNS.get(entry_id, ()):
            content = pattern.sub('', content)
        return {"id": entry_id, "title": title, "content": content}
    return None
