import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthContext } from '../context/AuthContext';
import {
  BrandThemeProvider,
  getStoredBrandTheme,
  getThemeUserKey,
  useBrandTheme,
} from './BrandThemeContext';

const ThemeHarness = () => {
  const { themeId, setThemeId } = useBrandTheme();
  return (
    <button type="button" onClick={() => setThemeId('blue')}>
      {themeId}
    </button>
  );
};

describe('BrandThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.brandTheme;
  });

  test('salva e aplica o tema para o CPF autenticado', async () => {
    const user = { cpf: '789.123.456-03' };

    render(
      <AuthContext.Provider value={{ user }}>
        <BrandThemeProvider>
          <ThemeHarness />
        </BrandThemeProvider>
      </AuthContext.Provider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'purple' }));

    await waitFor(() => expect(document.documentElement.dataset.brandTheme).toBe('blue'));
    expect(getStoredBrandTheme(getThemeUserKey(user))).toBe('blue');
  });

  test('não reaproveita a preferência de outro usuário', () => {
    window.localStorage.setItem('dogbank.brand-theme.cpf-11122233344', 'orange');

    expect(getStoredBrandTheme('cpf-11122233344')).toBe('orange');
    expect(getStoredBrandTheme('cpf-99988877766')).toBe('purple');
  });
});
