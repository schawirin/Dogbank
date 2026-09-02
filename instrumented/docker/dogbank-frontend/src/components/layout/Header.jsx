import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useT, LanguageToggle } from '../../i18n';

const routeTitleKey = {
  '/dashboard': 'title.dashboard',
  '/dashboard/': 'title.dashboard',
  '/dashboard/pix': 'title.pix',
  '/dashboard/pix/confirm': 'title.pix_confirm',
  '/dashboard/pix/receipt': 'title.pix_receipt',
  '/dashboard/extrato': 'title.extrato',
  '/dashboard/investimentos': 'title.investimentos',
  '/dashboard/cartoes': 'title.cartoes',
  '/dashboard/perfil': 'title.perfil',
  '/dashboard/evildog': 'title.evildog',
};

const Header = () => {
  const { user, logout } = useAuth();
  const { t } = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const breadcrumb = t(routeTitleKey[location.pathname] || 'title.default');
  const initial = (user?.nome || 'U').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-10 px-4 md:px-8 py-4 flex items-center justify-between border-b border-white/40 bg-white/70 backdrop-blur-md">
      <div className="flex-1 hidden md:flex items-center">
        <span className="text-sm font-medium text-slate-500 capitalize bg-white/60 px-3 py-1 rounded-full shadow-sm border border-slate-100">
          {breadcrumb}
        </span>
      </div>

      <div className="flex items-center gap-4 md:gap-5 ml-auto">
        <LanguageToggle />
        <button
          className="relative p-2 rounded-full text-slate-400 hover:text-purple-600 hover:bg-slate-100 transition-colors"
          aria-label="Notificações"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
        </button>

        <div className="h-8 w-px bg-slate-200 hidden sm:block" />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((s) => !s)}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 group-hover:text-purple-600 transition-colors">
                {user?.nome || t('header.user')}
              </p>
              <p className="text-xs text-slate-500">{t('header.premium')}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
              {initial}
            </div>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-lg border border-slate-100 py-2 z-20">
              <Link
                to="/dashboard/perfil"
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {t('header.my_profile')}
              </Link>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {t('header.logout')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
