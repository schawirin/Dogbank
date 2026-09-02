import React, { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import useEvilDog from './useEvilDog';
import evilDogService from '../../services/evilDogService';

jest.mock('../../services/evilDogService', () => ({
  __esModule: true,
  default: {
    streamUrl: jest.fn(() => '/api/evildog/stream'),
    getVectors: jest.fn(() => Promise.resolve([])),
    getTarget: jest.fn(() => Promise.resolve({ source_ip: '45.1.2.3' })),
    getConfig: jest.fn(() => Promise.resolve({ target: 'lab', targets: ['lab'] })),
    getStats: jest.fn(() => Promise.resolve({ cards: {} })),
    getLoot: jest.fn(() => Promise.resolve({ summary: {} })),
    getPipelineState: jest.fn(() => Promise.resolve({ nodes: {}, status: 'idle' })),
    resetDemo: jest.fn(() => Promise.resolve({ ok: true, remediation: { status: 'unblocked', count: 6 } })),
    runPipeline: jest.fn(() => Promise.resolve({ run_id: 'run-current', status: 'started' })),
    runAttack: jest.fn(),
    rotateIp: jest.fn(),
    createSession: jest.fn(),
    escalate: jest.fn(),
    runPostExploit: jest.fn(),
    setTarget: jest.fn(),
  },
}));

class FakeEventSource {
  static instances = [];

  constructor() {
    this.onopen = null;
    this.onerror = null;
    this.onmessage = null;
    FakeEventSource.instances.push(this);
  }

  close() {}

  emit(event) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
}

function HookProbe() {
  const evd = useEvilDog();
  return (
    <>
      <button onClick={() => evd.runPipeline()}>start</button>
      <button onClick={() => evd.escalate(3)}>escalate</button>
      <button onClick={() => evd.loginOperator('operator-token')}>authenticate</button>
      <button onClick={() => evd.prepareNewTake()}>new take</button>
      <output data-testid="run">{evd.currentRunId || 'none'}</output>
      <output data-testid="recon">{evd.nodeStates.RECON || 'idle'}</output>
      <output data-testid="running">{evd.running || 'idle'}</output>
      <output data-testid="preparing">{String(evd.preparing)}</output>
      <output data-testid="auth-required">{String(evd.authRequired)}</output>
    </>
  );
}

describe('useEvilDog run isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FakeEventSource.instances = [];
    window.EventSource = FakeEventSource;
    evilDogService.streamUrl.mockReturnValue('/api/evildog/stream');
    evilDogService.getVectors.mockResolvedValue([]);
    evilDogService.getTarget.mockResolvedValue({ source_ip: '45.1.2.3' });
    evilDogService.getConfig.mockResolvedValue({ target: 'lab', targets: ['lab'] });
    evilDogService.getStats.mockResolvedValue({ cards: {} });
    evilDogService.getLoot.mockResolvedValue({ summary: {} });
    evilDogService.getPipelineState.mockResolvedValue({ nodes: {}, status: 'idle' });
    evilDogService.runPipeline.mockResolvedValue({ run_id: 'run-current', status: 'started' });
    evilDogService.resetDemo.mockResolvedValue({ ok: true, remediation: { status: 'unblocked', count: 6 } });
    evilDogService.rotateIp.mockResolvedValue({ ok: true, source_ip: '45.1.2.4' });
    evilDogService.createSession.mockResolvedValue({ ok: true });
    evilDogService.escalate.mockResolvedValue({ ok: true, run_id: 'swarm-current', branches: 3 });
  });

  it('does not rotate the attacker IP when the tab mounts', async () => {
    render(<HookProbe />);
    await waitFor(() => expect(evilDogService.getPipelineState).toHaveBeenCalled());
    expect(evilDogService.rotateIp).not.toHaveBeenCalled();
  });

  it('automatically prepares a clean take instead of hydrating a terminal run', async () => {
    evilDogService.getPipelineState.mockResolvedValueOnce({
      run_id: 'run-stale', status: 'error', outcome: 'BACKEND_ERROR', nodes: { RECON: 'success', ATO: 'fail' },
    });
    render(<HookProbe />);

    await waitFor(() => expect(evilDogService.resetDemo).toHaveBeenCalledTimes(1));
    expect(evilDogService.rotateIp).not.toHaveBeenCalled();
    expect(screen.getByTestId('run')).toHaveTextContent('none');
    expect(screen.getByTestId('recon')).toHaveTextContent('idle');
    expect(screen.getByTestId('running')).toHaveTextContent('idle');
  });

  it('clears a take without silently rotating the attacker IP', async () => {
    render(<HookProbe />);
    await waitFor(() => expect(evilDogService.getPipelineState).toHaveBeenCalled());

    fireEvent.click(screen.getByText('new take'));

    await waitFor(() => expect(evilDogService.resetDemo).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('preparing')).toHaveTextContent('false'));
    expect(evilDogService.rotateIp).not.toHaveBeenCalled();
  });

  it('keeps the button busy and ignores an SSE node from another run', async () => {
    render(<HookProbe />);
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));

    fireEvent.click(screen.getByText('start'));
    await waitFor(() => expect(screen.getByTestId('run')).toHaveTextContent('run-current'));
    expect(screen.getByTestId('running')).toHaveTextContent('pipeline');

    act(() => FakeEventSource.instances[0].emit({ type: 'node', run_id: 'run-other', node: 'RECON', state: 'fail' }));
    expect(screen.getByTestId('recon')).toHaveTextContent('idle');

    act(() => FakeEventSource.instances[0].emit({ type: 'node', run_id: 'run-current', node: 'RECON', state: 'active' }));
    expect(screen.getByTestId('recon')).toHaveTextContent('active');

    act(() => FakeEventSource.instances[0].emit({ type: 'pipeline', run_id: 'run-current', state: 'done' }));
    await waitFor(() => expect(screen.getByTestId('running')).toHaveTextContent('idle'));
  });

  it('finishes from the state polling fallback when SSE is unavailable', async () => {
    render(<HookProbe />);
    await waitFor(() => expect(evilDogService.getPipelineState).toHaveBeenCalled());
    evilDogService.getPipelineState.mockResolvedValue({
      run_id: 'run-current', status: 'done', outcome: 'SUCCESS', nodes: { RECON: 'success' },
    });

    fireEvent.click(screen.getByText('start'));
    await waitFor(() => expect(screen.getByTestId('run')).toHaveTextContent('run-current'));
    await waitFor(() => expect(screen.getByTestId('running')).toHaveTextContent('idle'), { timeout: 2000 });
    expect(screen.getByTestId('recon')).toHaveTextContent('success');
  });

  it('exchanges the operator token for a session and resumes the pending swarm', async () => {
    evilDogService.escalate.mockRejectedValueOnce({ response: { status: 401, data: { error: 'session_required' } } });
    render(<HookProbe />);

    fireEvent.click(screen.getByText('escalate'));
    await waitFor(() => expect(screen.getByTestId('auth-required')).toHaveTextContent('true'));
    fireEvent.click(screen.getByText('authenticate'));

    await waitFor(() => expect(evilDogService.createSession).toHaveBeenCalledWith('operator-token'));
    await waitFor(() => expect(evilDogService.escalate).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('auth-required')).toHaveTextContent('false');
  });
});
