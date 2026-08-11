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

  // Kick off the full kill-chain pipeline (RECON→…→EXTRACT). Node states arrive over SSE.
  runPipeline: async () => (await evildogApi.post('/pipeline/run')).data,

  getPipelineState: async () => (await evildogApi.get('/pipeline/state')).data.nodes,
};

export default evilDogService;
