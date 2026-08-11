import { useCallback, useEffect, useRef, useState } from 'react';
import evilDogService from '../../services/evilDogService';

const MAX_FEED = 200;

const DEFAULT_CARDS = {
  vulnerabilities_found: 0,
  exploits_executed: 0,
  systems_compromised: 0,
  active_sessions: 0,
};

/**
 * Central state for the EvilDog tab: opens the SSE telemetry stream, keeps the
 * live feed + pipeline node states, loads target/vectors/stats, and exposes
 * fire-attack / run-pipeline actions. Shared by both sub-views.
 */
export default function useEvilDog() {
  const [connected, setConnected] = useState(false);
  const [feed, setFeed] = useState([]);
  const [nodeStates, setNodeStates] = useState({});
  const [cards, setCards] = useState(DEFAULT_CARDS);
  const [target, setTarget] = useState(null);
  const [vectors, setVectors] = useState([]);
  const [running, setRunning] = useState(null); // vector id or 'pipeline' currently running
  const [lastResult, setLastResult] = useState(null);
  const esRef = useRef(null);

  const refreshStats = useCallback(async () => {
    try {
      const data = await evilDogService.getStats();
      if (data?.cards) setCards(data.cards);
    } catch (_) { /* backend may be warming up */ }
  }, []);

  // Initial load + SSE connection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [t, v] = await Promise.all([
          evilDogService.getTarget().catch(() => null),
          evilDogService.getVectors().catch(() => []),
        ]);
        if (cancelled) return;
        if (t) setTarget(t);
        if (v) setVectors(v);
        refreshStats();
      } catch (_) { /* ignore */ }
    })();

    const es = new EventSource(evilDogService.streamUrl());
    esRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (e) => {
      let ev;
      try { ev = JSON.parse(e.data); } catch (_) { return; }
      setFeed((prev) => {
        const next = [...prev, ev];
        return next.length > MAX_FEED ? next.slice(next.length - MAX_FEED) : next;
      });
      if (ev.type === 'node' && ev.node) {
        setNodeStates((prev) => ({ ...prev, [ev.node]: ev.state }));
      }
      if (ev.level === 'success' || ev.type === 'pipeline' || ev.node === 'EXTRACT') {
        refreshStats();
      }
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [refreshStats]);

  const fireAttack = useCallback(async (vector) => {
    setRunning(vector);
    try {
      const result = await evilDogService.runAttack(vector);
      setLastResult(result);
      if (result?.cards) setCards(result.cards);
      return result;
    } catch (_) {
      return null;
    } finally {
      setRunning(null);
      refreshStats();
    }
  }, [refreshStats]);

  const runPipeline = useCallback(async () => {
    setRunning('pipeline');
    // reset nodes to idle for a clean run
    setNodeStates({});
    try {
      return await evilDogService.runPipeline();
    } catch (_) {
      return null;
    } finally {
      // pipeline finishes asynchronously via SSE; clear the button state shortly after
      setTimeout(() => setRunning(null), 1200);
    }
  }, []);

  return {
    connected, feed, nodeStates, cards, target, vectors, running, lastResult,
    fireAttack, runPipeline, refreshStats,
  };
}
