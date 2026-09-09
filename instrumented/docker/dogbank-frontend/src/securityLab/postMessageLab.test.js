import {
  POSTMESSAGE_LAB_EVENT,
  buildSyntheticPixMessage,
  isTrustedLabMessage,
  targetOriginFor,
} from './postMessageLab';

describe('postMessage security lab contract', () => {
  it('uses wildcard only in the intentionally vulnerable mode', () => {
    expect(targetOriginFor('vulnerable', 'http://localhost:3000')).toBe('*');
    expect(targetOriginFor('fixed', 'http://localhost:3000')).toBe('http://localhost:3000');
  });

  it('builds an explicitly synthetic PIX message', () => {
    const message = buildSyntheticPixMessage('2026-09-08T10:00:00.000Z');
    expect(message.type).toBe(POSTMESSAGE_LAB_EVENT);
    expect(message.lab.synthetic).toBe(true);
    expect(message.data).toMatchObject({
      transactionId: 'PIX-DEMO-001',
      payerName: 'Maria Demo',
      payerCpf: '000.000.000-00',
      amount: 850,
    });
  });

  it('rejects a message when origin or source is not the trusted receiver contract', () => {
    const expectedSource = {};
    const event = {
      origin: 'http://localhost:3001',
      source: expectedSource,
      data: buildSyntheticPixMessage(),
    };
    expect(isTrustedLabMessage(event, {
      allowedOrigin: 'http://localhost:3000', expectedSource,
    })).toBe(false);
  });
});
