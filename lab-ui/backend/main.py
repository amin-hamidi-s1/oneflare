from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import sys
import json
import os
from pathlib import Path

app = FastAPI(title="OneFlare Lab API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SCRIPTS_DIR = Path("/app/attack-scripts")

SCENARIO_SCRIPTS = {
    "sqli":      "scenarios.01_sqli",
    "xss":       "scenarios.02_xss",
    "traversal": "scenarios.03_path_traversal",
    "cred":      "scenarios.04_cred_stuffing",
    "dns":       "scenarios.05_dns_tunnel",
    "exfil":     "scenarios.06_data_exfil",
    "all":       None,  # runs demo.py
}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/test-connection")
async def test_connection(body: dict):
    import httpx
    token = body.get("cf_api_token", "")
    if not token:
        return {"ok": False, "error": "No token provided"}
    async with httpx.AsyncClient() as client:
        r = await client.get(
            "https://api.cloudflare.com/client/v4/user/tokens/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
    data = r.json()
    return {"ok": data.get("success", False), "result": data.get("result")}


@app.websocket("/ws/run/{scenario_id}")
async def run_scenario(websocket: WebSocket, scenario_id: str):
    await websocket.accept()

    # Receive config from client
    config_msg = await websocket.receive_text()
    config = json.loads(config_msg)

    env = os.environ.copy()
    env["CLOUDFLARE_DOMAIN"] = config.get("domain", "acmecorp-lab.workers.dev")
    if config.get("shop_url"):
        env["SHOP_URL_OVERRIDE"] = config["shop_url"]
    if config.get("portal_url"):
        env["PORTAL_URL_OVERRIDE"] = config["portal_url"]
    if config.get("api_url"):
        env["API_URL_OVERRIDE"] = config["api_url"]
    if config.get("delay"):
        env["ATTACK_DELAY"] = str(config["delay"])
    if config.get("jitter"):
        env["ATTACK_JITTER"] = str(config["jitter"])

    if scenario_id == "all":
        cmd = [sys.executable, str(SCRIPTS_DIR / "demo.py")]
    else:
        script_module = SCENARIO_SCRIPTS.get(scenario_id)
        if not script_module:
            await websocket.send_text(
                json.dumps({"type": "error", "message": f"Unknown scenario: {scenario_id}"})
            )
            await websocket.close()
            return
        cmd = [sys.executable, "-m", script_module]

    await websocket.send_text(json.dumps({"type": "start", "scenario": scenario_id}))

    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            env=env,
            cwd=str(SCRIPTS_DIR),
        )

        async for line in process.stdout:
            text = line.decode("utf-8", errors="replace").rstrip()
            await websocket.send_text(json.dumps({"type": "output", "line": text}))

        await process.wait()
        await websocket.send_text(
            json.dumps({
                "type": "done",
                "exit_code": process.returncode,
                "scenario": scenario_id,
            })
        )
    except Exception as e:
        await websocket.send_text(
            json.dumps({"type": "error", "message": str(e)})
        )
    finally:
        await websocket.close()


@app.get("/api/scenarios")
async def list_scenarios():
    return {"scenarios": list(SCENARIO_SCRIPTS.keys())}
