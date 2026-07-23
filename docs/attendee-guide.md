# OneFlare — Attendee / User Guide

You're using the **OneFlare console** — a web UI that fires real attack traffic (SQLi,
XSS, credential stuffing, DNS tunneling, prompt injection, and four multi-phase
campaigns) at a Cloudflare-protected mock company, so you can watch the traffic get
blocked/logged at the edge and flow through to SentinelOne detections.

This guide walks through the console itself. If you're doing the **SoleDrop CTF**
specifically, see [the CTF section](#the-soledrop-ctf-specifics) below and
[`docs/ctf-questions.md`](ctf-questions.md).

---

## 1. Open the console

- **Shared reference instance:** https://one-flare.com — pre-configured, nothing to set up.
- **Your own local instance:** whatever your operator gave you, typically `http://localhost:3000`.
- **CTF attendee subdomain:** if you were assigned `<name>.lab.soledrop.co`, confirm with
  your facilitator that the console's target domain is pointed at *your* subdomain before
  you run anything (see [Settings](#3-settings--check-your-target-before-you-run-anything)).

The nav bar has three tabs — **Dashboard**, **Scenarios**, **Architecture** — plus
**Settings** on the right.

## 2. Dashboard

Landing page. Two big shortcut cards:

| Card | Takes you to | What's there |
|---|---|---|
| **Quick Scenarios** | `/scenarios` (top section) | 8 single-technique attacks: SQLi, XSS, path traversal, credential stuffing, DNS tunneling, data exfil, AI-bot scraping, prompt injection |
| **Campaigns** | `/scenarios#campaigns` | 4 multi-phase adversary storylines: the SoleDrop CTF, and financial/healthcare/SaaS industry campaigns |

Below that: a stats row (scenario count, runs, success rate) and a **Recent Runs**
list — click any past run to jump back into that scenario's detail page.

Run history lives in **your browser's localStorage only** — it's private to you and
this browser, and won't be there if you switch machines or clear browser data.

## 3. Scenarios page

`/scenarios` has two sections, both using the same card layout:

- **Quick Scenarios** — single-technique attacks, one WebSocket run each.
- **Campaigns** — the CTF plus the three industry campaigns. Each card opens the same
  five-tab template as a single-technique scenario (see below) — there's no separate
  "campaign" UI to learn.

Click any card to open its detail page at `/scenarios/{id}`.

### Scenario detail — five tabs

Every scenario (technique or campaign) has the same tabs:

1. **Overview** — what the attack is, target, CF product involved, MITRE tactic.
2. **How It Works** — the attack flow step by step, plus a sample Cloudflare log event.
3. **SIEM Detection** — the actual SentinelOne detection rule/PowerQuery, MITRE
   ATT&CK mapping, why it's tuned the way it is, and (for the richer scenarios) known
   false positives and how they were fixed. There's a **Copy Query** button — paste
   straight into the S1 console if you're building the detection yourself.
4. **Response Playbook** — the numbered incident-response workflow for this scenario.
5. **Run Attack** — where you actually fire traffic. Covered next.

### Run Attack tab

- A **Current Configuration** panel shows the domain/URLs the run will use. If
  nothing is configured and the instance has no server default, you'll see a red
  "Configure your Cloudflare domain in Settings" banner and the Run button is disabled.
- **Campaign scenarios only** (CTF/financial/healthcare/SaaS) show a **Volume**
  control — Low / Medium / High, roughly 5 / 15 / 30 requests fired per phase or
  "box." Pick before you hit Run; it's locked once a run starts.
- Hit **Run Attack**. This opens a WebSocket to the backend, which spawns the attack
  script as a subprocess and streams its stdout into the terminal panel live, line by
  line. **Stop Attack** closes the connection early.
- When it finishes you get a **Run Summary** (exit code, duration, line count) and the
  run is saved to your local history (visible on Dashboard and in Settings → Run
  History).

> **This sends real traffic.** Only run scenarios against a target you own or have
> explicit permission to test — your assigned lab domain, your own `*.lab.soledrop.co`
> subdomain, or whatever your operator told you to use. Never point it at a domain you
> don't control.

## 4. Settings — check your target before you run anything

`/settings` has five collapsible sections:

- **Cloudflare Configuration** — CF API token (only needed if *you* want to hit
  **Test Connection**; not required to run scenarios), account/zone ID, **Domain**,
  and **Gateway DoH URL** (needed for the DNS tunnel scenario to log in Cloudflare
  Gateway — use the hex-subdomain URL from `one.dash.cloudflare.com → Networks →
  Resolvers & Proxies → DNS locations`, *not* your team name URL, or Gateway won't log
  the queries at all).
- **Target URL Overrides** — Shop/Portal/API URL, if you need something other than
  the domain-derived default (e.g. pointing at your own `*.lab.soledrop.co` subdomain).
- **SentinelOne Configuration** — S1 console URL/token, only relevant if you're using
  Claude Code's SentinelOne MCP integration alongside the console.
- **Attack Intensity** — Request Delay / Jitter sliders. Slower + more jitter looks
  more human; faster is easier to trigger volume-based detections quickly.
- **Run History** — every run you've made in this browser, with full terminal output
  per entry (view/copy), and a clear-all button.

Everything here is **stored in your browser only** — settings and tokens never leave
your machine except when you explicitly Run or Test Connection, and even then they
only go to your own backend, not to any third party. Use **Export/Export Settings**
to save a JSON copy (tokens are stripped from the export) and **Import** to restore it
on another browser.

If the instance is pre-configured (you'll see an orange banner at the top of
Settings), you don't need to fill in anything here — Cloudflare domain/URLs are served
from the backend and every browser gets them automatically. The fields on this page
are optional per-browser overrides on top of that default.

## 5. Architecture page

`/architecture` — an in-app reference diagram of the whole pipeline (attack scripts →
Cloudflare → Logpush → SentinelOne → Hyperautomation) plus the detection/parser
reference that used to live on separate Detections/Parsers pages (old links to those
redirect here).

## 6. ThreatOps — live drip-flow campaigns (advanced / facilitator-run)

There's a second way to run a campaign, at `/threatops` (no longer in the main nav —
go there directly by URL). Instead of a single one-shot script, it drives a **live
drip-flow engine** on the backend: pick a campaign, a mode (`live` = paced over
minutes with phase-by-phase pacing, or `preseed` = fast bulk seed), a phase, and a
volume, and it streams a phase timeline, a live stats bar (requests / blocked /
passed / block rate), and SOC "talking points" per phase (what fires, the Cloudflare
story, the SentinelOne story, the Hyperautomation response). This is typically driven
by a facilitator during a live demo rather than by individual attendees — check with
whoever's running your session before launching from here, since only one campaign
can run at a time system-wide.

---

## The SoleDrop CTF — specifics

If you were assigned a `<name>.lab.soledrop.co` subdomain for the CTF:

1. Confirm in **Settings → Target URL Overrides** (or with your facilitator, if the
   instance is centrally configured) that Shop URL points at
   `https://<name>.lab.soledrop.co`.
2. Work the CTF either as a single scenario run (`Scenarios → SoleDrop CTF card → Run
   Attack`) or box-by-box via `/threatops` if your facilitator is running it live —
   ask which one your session uses.
3. The question pack is [`docs/ctf-questions.md`](ctf-questions.md) — it's organized
   box by box (WAF recon, Bot Management, Firewall for AI + credential stuffing, full
   multi-vector breakout). Hunt questions map to
   [`detections/ctf/lab-oneliners.md`](../detections/ctf/lab-oneliners.md) — swap in
   your subdomain wherever you see `<<SUBDOMAIN>>`.
4. After running a box, give Logpush a minute or two to deliver events, then confirm
   they landed in SentinelOne under `http_request.url.hostname contains
   '<name>.lab.soledrop.co'` before you start hunting.
