// SECURITY LAB ONLY.
//
// This module intentionally supports a vulnerable postMessage("*") mode so an
// academic demo can show the potential impact of wildcard target origins. It
// must only be used by the synthetic /security-lab routes below.

export const POSTMESSAGE_LAB_EVENT = 'PIX_COMPLETED';
export const POSTMESSAGE_LAB_READY = 'DOGBANK_LAB_READY';
export const POSTMESSAGE_LAB_PING = 'DOGBANK_LAB_PING';

export const SYNTHETIC_PIX = Object.freeze({
  transactionId: 'PIX-DEMO-001',
  payerName: 'Maria Demo',
  payerCpf: '000.000.000-00',
  receiverName: 'Loja Dog',
  receiverCpf: '111.111.111-11',
  amount: 850.00,
});

export const labModeFrom = (search = window.location.search) => (
  new URLSearchParams(search).get('mode') === 'fixed' ? 'fixed' : 'vulnerable'
);
export const buildSyntheticPixMessage = (timestamp = new Date().toISOString()) => ({
  type: POSTMESSAGE_LAB_EVENT,
  data: { ...SYNTHETIC_PIX, timestamp },
  lab: { synthetic: true, purpose: 'academic-security-demo' },
});

export const targetOriginFor = (mode, applicationOrigin = window.location.origin) => (
  mode === 'fixed' ? applicationOrigin : '*'
);

export const sendSyntheticPixMessage = ({
  parentWindow = window.parent,
  mode = labModeFrom(),
  applicationOrigin = window.location.origin,
  timestamp,
} = {}) => {
  const payload = buildSyntheticPixMessage(timestamp);
  const targetOrigin = targetOriginFor(mode, applicationOrigin);

  // INTENTIONAL VULNERABILITY: in vulnerable mode targetOrigin is "*".
  // Fixed mode restricts delivery to the explicit DogBank origin.
  parentWindow.postMessage(payload, targetOrigin);
  return { payload, targetOrigin };
};

export const isTrustedLabMessage = (event, {
  allowedOrigin = window.location.origin,
  expectedSource,
} = {}) => (
  event.origin === allowedOrigin
  && (!expectedSource || event.source === expectedSource)
  && event.data?.lab?.synthetic === true
  && [POSTMESSAGE_LAB_EVENT, POSTMESSAGE_LAB_READY].includes(event.data?.type)
);
