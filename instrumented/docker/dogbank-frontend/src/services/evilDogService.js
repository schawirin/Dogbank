import { evildogApi } from './api';

/**
 * EvilDog attack orchestrator client (DogBank lab only).
 * Drives the evildog-api backend that wraps the SecurityAttacker engine.
 * The live telemetry stream is consumed via EventSource (see streamUrl()).
 */
const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || '').replace(/\/+$/, '');

const evilDogService = {
  // SSE endpoint (relative so the gateway/ingress proxies it). Consumed with EventSource.
  streamUrl: () => `${API_BASE_URL}/api/evildog/stream`,

  getHealth: async () => (await evildogApi.get('/health')).data,
  getVectors: async () => (await evildogApi.get('/vectors')).data.vectors,
  getStats: async () => (await evildogApi.get('/stats')).data,
  getTarget: async () => (await evildogApi.get('/target')).data,

  // Fire a single attack vector. Returns structured impact (records_leaked, secret, cards…).
  runAttack: async (vector) => (await evildogApi.post(`/attack/${vector}`)).data,

  // Full kill-chain pipeline (RECON→…→EXTRACT). Node states arrive over SSE.
  runPipeline: async () => (await evildogApi.post('/pipeline/run')).data,
  // Includes nodes plus optional run_id/status/outcome on newer orchestrators.
  // Keeping the complete response lets the UI hydrate safely after an SSE reconnect.
  getPipelineState: async () => (await evildogApi.get('/pipeline/state')).data,

  // Clears the previous take and asks the backend to remove application-level
  // containment left by the workflow. The admin credential stays server-side.
  resetDemo: async () => (await evildogApi.post('/reset', {}, {
    withCredentials: true,
  })).data,

  // Loot report — everything stolen (client records, secrets, PIX moved).
  getLoot: async () => (await evildogApi.get('/loot')).data,

  // Post-exploitation ("already inside the system") actions.
  getPostExploitActions: async () => (await evildogApi.get('/postexploit')).data.actions,
  runPostExploit: async (action, body = {}) =>
    (await evildogApi.post(`/postexploit/${action}`, body)).data,

  // Node-detail panels (Scan opportunities, Detect vulnerabilities, Report).
  getScan: async () => (await evildogApi.get('/scan')).data,
  getVulnerabilities: async () => (await evildogApi.get('/vulnerabilities')).data,
  getReport: async () => (await evildogApi.get('/report')).data,

  // Target config (multi-target + internet-origin).
  getConfig: async () => (await evildogApi.get('/config')).data,
  setTarget: async (target) => (await evildogApi.post('/config/target', { target })).data,

  // Rotate the attacker source IP (spoofs X-Forwarded-For) to evade an AAP IP block.
  rotateIp: async () => (await evildogApi.post('/rotate-ip')).data,

  // Exchanges an operator-entered lab token for a short-lived HttpOnly cookie.
  // The token stays only in the submit request and is never bundled, persisted,
  // or added to subsequent API headers.
  createSession: async (token) => (await evildogApi.post('/session', { token }, {
    withCredentials: true,
  })).data,

  // Escalate after a block: spawn N real, ephemeral Kubernetes Jobs (agent pods),
  // each attacking from a different spoofed IP. Authorization is the HttpOnly
  // session cookie established above; no admin secret is shipped to the browser.
  escalate: async (count = 3) => (await evildogApi.post('/escalate', {}, {
    params: { count },
    withCredentials: true,
  })).data,
};

export default evilDogService;
