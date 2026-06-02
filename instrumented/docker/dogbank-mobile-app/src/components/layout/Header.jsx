import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const routeTitleMap = {
  '/dashboard': 'Painel Geral',
  '/dashboard/': 'Painel Geral',
  '/dashboard/pix': 'PIX',
  '/dashboard/pix/confirm': 'PIX • Confirmar',
  '/dashboard/pix/receipt': 'PIX • Comprovante',
  '/dashboard/extrato': 'Extrato',
  '/dashboard/cartoes': 'Cartões',
  '/dashboard/perfil': 'Perfil',
};

const Header = () => {
  const { user, logout } = useAuth();
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

  const breadcrumb = routeTitleMap[location.pathname] || 'Painel';
  const initial = (user?.nome || 'U').charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-10 px-4 md:px-8 py-3 md:py-4 flex items-center justify-between border-b border-white/40 bg-white/85 backdrop-blur-md mobile-safe-top">
      <div className="min-w-0 md:hidden">
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-purple-600">DogBank</p>
        <h1 className="text-base font-bold text-slate-900 truncate">{breadcrumb}</h1>
      </div>

      <div className="flex-1 hidden md:flex items-center">
        <span className="text-sm font-medium text-slate-500 capitalize bg-white/60 px-3 py-1 rounded-full shadow-sm border border-slate-100">
          {breadcrumb}
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-4 md:gap-5 ml-auto">
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
                {user?.nome || 'Usuário'}
              </p>
              <p className="text-xs text-slate-500">Conta Premium</p>
            </div>
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-purple-500/20">
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
                Meu perfil
              </Link>
              <div className="border-t border-slate-100 my-1" />
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Sair
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
