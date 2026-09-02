import React from 'react';
import { render, screen } from '@testing-library/react';
import AgentSwarmPanel, { agentAttackFailed, agentDisplayPhase } from './AgentSwarmPanel';
import { LanguageProvider } from '../../i18n';

const containedAgent = {
  name: 'evildog-agent-demo-0',
  ip: '203.0.113.10',
  phase: 'Succeeded',
  outcome: 'blocked',
  nodes: {
    RECON: 'success', SCAN: 'success', DETECT: 'success', PAYLOAD: 'success', INJECT: 'success', ATO: 'fail',
  },
  createdAt: Date.now() - 5000,
  finishedAt: Date.now(),
  reaped: true,
};

describe('AgentSwarmPanel security outcome', () => {
  it('treats a contained attack as agent failure even if the container exited successfully', () => {
    expect(agentAttackFailed(containedAgent)).toBe(true);
    expect(agentDisplayPhase(containedAgent)).toBe('Failed');
  });

  it('renders FAIL in red and counts the agent under failures, not successes', () => {
    render(
      <LanguageProvider>
        <AgentSwarmPanel
          agents={{ [containedAgent.name]: containedAgent }}
          swarmMeta={{ active: false, requested: 1, backend: 'docker' }}
          feed={[]}
        />
      </LanguageProvider>,
    );

    const card = screen.getByTestId('swarm-agent-card');
    expect(card).toHaveAttribute('data-attack-status', 'failed');
    expect(card).toHaveClass('evd-agent-failed');
    expect(screen.getByText('FAIL')).toHaveClass('text-red-400');
    expect(screen.getByText('FAIL · ATAQUE CONTIDO')).toBeInTheDocument();
    expect(screen.getByText('Falharam').parentElement.querySelector('.text-xl')).toHaveTextContent('1');
    expect(screen.getByText('Concluídos').parentElement.querySelector('.text-xl')).toHaveTextContent('0');
  });
});
