import { datadogRum } from '@datadog/browser-rum';

const IOS_BRIDGE_NAME = 'dogbankAnalytics';

const getNativeBridge = () =>
  window.webkit?.messageHandlers?.[IOS_BRIDGE_NAME];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sanitizeValue = (value) => {
  if (value === null || value === undefined) return undefined;
  if (['string', 'number', 'boolean'].includes(typeof value)) return value;

  if (Array.isArray(value)) {
    return value.map(sanitizeValue).filter((item) => item !== undefined).join(',');
  }

  if (isPlainObject(value)) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};

const sanitizeAttributes = (attributes = {}) => {
  const cleaned = {
    app_surface: 'dogbank-mobile',
    demo_channel: 'ios-simulator',
    ...attributes,
  };

  return Object.entries(cleaned).reduce((acc, [key, value]) => {
    const sanitized = sanitizeValue(value);
    if (sanitized !== undefined) {
      acc[key] = sanitized;
    }
    return acc;
  }, {});
};

const postNative = (type, payload) => {
  const bridge = getNativeBridge();
  if (!bridge?.postMessage) return;

  try {
    bridge.postMessage({ type, ...payload });
  } catch (error) {
    console.warn('[ProductAnalytics] Native bridge failed:', error);
  }
};

const getUserEmail = (user = {}) => {
  const pixKey = user.chavePix || user.pixKey;
  return typeof pixKey === 'string' && pixKey.includes('@') ? pixKey : undefined;
};

export const identifyProductUser = (user = {}) => {
  const userId = String(user.cpf || user.id || user.accountId || '').trim();
  if (!userId) return;

  const userPayload = {
    id: userId,
    name: user.nome || user.name || undefined,
    email: getUserEmail(user),
    account_id: user.accountId || user.account_id || undefined,
  };

  try {
    datadogRum.setUser(userPayload);
  } catch (error) {
    console.warn('[ProductAnalytics] setUser failed:', error);
  }

  postNative('identify', {
    userId,
    name: userPayload.name,
    email: userPayload.email,
    attributes: sanitizeAttributes({
      account_id: userPayload.account_id,
      pix_key: user.chavePix || user.pixKey,
    }),
  });

  trackProductAction('dogbank.user.identify', {
    user_id: userId,
    account_id: userPayload.account_id,
    has_pix_key: Boolean(user.chavePix || user.pixKey),
  });
};

export const clearProductUser = () => {
  try {
    if (typeof datadogRum.clearUser === 'function') {
      datadogRum.clearUser();
    } else {
      datadogRum.setUser({});
    }
  } catch (error) {
    console.warn('[ProductAnalytics] clearUser failed:', error);
  }

  postNative('clearUser', {});
};

export const trackProductAction = (name, attributes = {}) => {
  const sanitized = sanitizeAttributes(attributes);

  try {
    datadogRum.addAction(name, sanitized);
  } catch (error) {
    console.warn('[ProductAnalytics] addAction failed:', error);
  }

  postNative('action', {
    name,
    attributes: sanitized,
  });
};

export const trackProductView = (path, attributes = {}) => {
  const viewName = path === '/'
    ? 'landing'
    : path.replace(/^\/+/, '').replace(/\//g, '.') || 'unknown';

  const sanitized = sanitizeAttributes({
    view_name: viewName,
    view_path: path,
    ...attributes,
  });

  try {
    if (typeof datadogRum.setViewContextProperty === 'function') {
      datadogRum.setViewContextProperty('dogbank.view_name', viewName);
      datadogRum.setViewContextProperty('dogbank.view_path', path);
    }
  } catch (error) {
    console.warn('[ProductAnalytics] setViewContextProperty failed:', error);
  }

  trackProductAction('dogbank.view.changed', sanitized);

  postNative('view', {
    name: viewName,
    path,
    attributes: sanitized,
  });
};
