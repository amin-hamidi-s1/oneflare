// Shared attack-run helpers: build the run config the backend expects and drive
// a single scenario's WebSocket run. Used by the Scenarios "Run All Attacks"
// panel. (ScenarioDetail keeps its own inline copy of this logic; if that ever
// gets refactored, point it here too.)

const ls = (k) => {
  try {
    return localStorage.getItem(k) || ''
  } catch {
    return ''
  }
}

/** Effective run config: localStorage override → server default → hardcoded. */
export function buildRunConfig(serverConfig) {
  return {
    domain: ls('oneflare_cf_domain') || serverConfig?.domain || '',
    shop_url: ls('oneflare_shop_url') || serverConfig?.shop_url || '',
    portal_url: ls('oneflare_portal_url') || serverConfig?.portal_url || '',
    api_url: ls('oneflare_api_url') || serverConfig?.api_url || '',
    delay: parseFloat(ls('oneflare_attack_delay') || String(serverConfig?.delay ?? '0.5')),
    jitter: parseFloat(ls('oneflare_attack_jitter') || String(serverConfig?.jitter ?? '0.3')),
    gateway_doh_url: ls('oneflare_cf_gateway_doh_url') || serverConfig?.gateway_doh_url || '',
    // Sent so the backend can verify BYOC targets (a host in a Cloudflare zone
    // this token controls) before running against a non-lab host.
    cf_api_token: ls('oneflare_cf_api_token'),
  }
}

/**
 * Open one scenario run over WebSocket. Resolves with the exit code (or null)
 * once the socket closes. `targetSubdomain` '' = one-flare default; a non-admin
 * always sends '' and the backend forces their own subdomain regardless.
 *
 * `handlers`: { onLine(line), onStart(scenario), onError(message), registerSocket(ws) }
 */
export function runScenarioWs(scenarioId, config, targetSubdomain, handlers = {}) {
  const { onLine, onStart, onError, registerSocket } = handlers
  return new Promise((resolve) => {
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws/run/${scenarioId}`
    const ws = new WebSocket(wsUrl)
    registerSocket?.(ws)
    let lastExitCode = null

    ws.onopen = () => ws.send(JSON.stringify({ ...config, target_subdomain: targetSubdomain }))

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data)
        if (msg.type === 'output') onLine?.(msg.line)
        else if (msg.type === 'start') onStart?.(msg.scenario)
        else if (msg.type === 'done') lastExitCode = msg.exit_code
        else if (msg.type === 'error') onError?.(msg.message)
      } catch {}
    }

    ws.onerror = () => onError?.('WebSocket connection failed. Is the backend running?')
    ws.onclose = () => resolve(lastExitCode)
  })
}

/** Append a completed run to the shared localStorage history (same shape the
 *  scenario detail page uses, so it shows up in Run History). */
export function saveRunToHistory({ scenario, title, lines, exitCode }) {
  try {
    const history = JSON.parse(localStorage.getItem('oneflare_run_history') || '[]')
    history.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      scenario,
      title,
      timestamp: new Date().toISOString(),
      lines,
      exitCode,
    })
    localStorage.setItem('oneflare_run_history', JSON.stringify(history.slice(-100)))
  } catch {}
}
