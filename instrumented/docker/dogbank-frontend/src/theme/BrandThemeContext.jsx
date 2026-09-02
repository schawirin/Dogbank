import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '../hooks/useAuth';

export const BRAND_THEMES = [
  { id: 'purple', label: 'Roxo', swatch: '#8b5cf6' },
  { id: 'orange', label: 'Laranja', swatch: '#f97316' },
  { id: 'black', label: 'Preto', swatch: '#111827' },
  { id: 'blue', label: 'Azul', swatch: '#2563eb' },
  { id: 'yellow', label: 'Amarelo', swatch: '#eab308' },
];

export const DEFAULT_BRAND_THEME = 'purple';
const STORAGE_PREFIX = 'dogbank.brand-theme';

const isKnownTheme = (themeId) => BRAND_THEMES.some(({ id }) => id === themeId);

const readPersistedUser = () => {
  if (typeof window === 'undefined') return null;

  try {
    return JSON.parse(window.localStorage.getItem('user'));
  } catch {
    return null;
  }
};

export const getThemeUserKey = (user) => {
  const persistedUser = readPersistedUser();
  const storage = typeof window !== 'undefined' ? window.localStorage : null;
  const cpf = user?.cpf || persistedUser?.cpf || storage?.getItem('cpf');

  if (cpf) return `cpf-${String(cpf).replace(/\D/g, '')}`;

  const accountId = user?.accountId
    || persistedUser?.accountId
    || storage?.getItem('accountId');

  return accountId ? `account-${accountId}` : 'guest';
};

export const getStoredBrandTheme = (userKey) => {
  if (typeof window === 'undefined') return DEFAULT_BRAND_THEME;
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}.${userKey}`);
  return isKnownTheme(stored) ? stored : DEFAULT_BRAND_THEME;
};

export const storeBrandTheme = (userKey, themeId) => {
  if (typeof window === 'undefined' || !isKnownTheme(themeId)) return;
  window.localStorage.setItem(`${STORAGE_PREFIX}.${userKey}`, themeId);
};

const applyBrandTheme = (themeId) => {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.brandTheme = themeId;
  }
};

const BrandThemeContext = createContext({
  themeId: DEFAULT_BRAND_THEME,
  setThemeId: () => {},
  themes: BRAND_THEMES,
});

export const BrandThemeProvider = ({ children }) => {
  const { user } = useAuth();
  const userKey = getThemeUserKey(user);
  const [themeId, setThemeState] = useState(() => getStoredBrandTheme(userKey));

  useEffect(() => {
    const storedTheme = getStoredBrandTheme(userKey);
    setThemeState(storedTheme);
    applyBrandTheme(storedTheme);
  }, [userKey]);

  const setThemeId = useCallback((nextThemeId) => {
    if (!isKnownTheme(nextThemeId)) return;
    storeBrandTheme(userKey, nextThemeId);
    setThemeState(nextThemeId);
    applyBrandTheme(nextThemeId);
  }, [userKey]);

  const value = useMemo(() => ({
    themeId,
    setThemeId,
    themes: BRAND_THEMES,
  }), [setThemeId, themeId]);

  return (
    <BrandThemeContext.Provider value={value}>
      {children}
    </BrandThemeContext.Provider>
  );
};

export const useBrandTheme = () => useContext(BrandThemeContext);

export default BrandThemeContext;
