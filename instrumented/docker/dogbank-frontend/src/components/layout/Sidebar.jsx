import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, FileText, CreditCard, User, ArrowRight, Shield } from 'lucide-react';

const DogBankLogo = ({ className = '' }) => (
  <div className={`flex items-center gap-1.5 ${className}`}>
    <span className="text-[22px] font-bold tracking-tight leading-none">DogBank</span>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" className="w-6 h-6 fill-current mb-1">
      <path d="M226.5 92.9c14.3 7.3 22.8 23 21 38.6l-5.1 44.5c-2.4 20.8-22 35-42.5 31.6l-44.4-7.4c-15.5-2.6-26.6-16.7-25-32.5l5.1-50.6C137.9 94 159.2 81.3 178.6 85l47.9 7.9zm134.4 7.9l47.9-7.9c19.4-3.2 40.7 9.5 43 32.1l5.1 50.6c1.6 15.8-9.5 29.9-25 32.5l-44.4 7.4c-20.5 3.4-40.1-10.8-42.5-31.6l-5.1-44.5c-1.8-15.6 6.7-31.3 21-38.6zM256 272c-29.4 0-56-17.6-69.5-44.1l-14-27.5c-8.9-17.6-29.5-25.1-47.5-16.6l-37.3 17.6c-21.6 10.2-35.3 32.2-34.5 56.1l2.4 72c1.7 51.5 44 92.5 95.6 92.5h108.8c51.6 0 93.9-41 95.6-92.5l2.4-72c.8-23.9-12.9-45.9-34.5-56.1l-37.3-17.6c-18-8.5-38.6-1-47.5 16.6l-14 27.5c-13.5 26.5-40.1 44.1-69.5 44.1zM97.1 230c-15.5 2.6-31.1-6.1-36.4-21l-18-50.7C37.3 143.2 45.4 126 60.5 119.7l43.2-18c14.6-6.1 31.5 1 36.8 15.9l16.1 45.5c4.9 13.9-2.4 29.4-16.3 34.3l-43.2 12.6zm317.8 0l-43.2-12.6c-13.9-4.9-21.2-20.4-16.3-34.3l16.1-45.5c5.3-14.9 22.2-22 36.8-15.9l43.2 18c15.1 6.3 23.2 23.5 17.8 38.6l-18 50.7c-5.3 14.9-20.9 23.6-36.4 21z" />
    </svg>
  </div>
);

const menuItems = [
  { label: 'Início', icon: Home, path: '/dashboard' },
  { label: 'PIX', icon: Zap, path: '/dashboard/pix' },
  { label: 'Extrato', icon: FileText, path: '/dashboard/extrato' },
  { label: 'Cartões', icon: CreditCard, path: '/dashboard/cartoes' },
  { label: 'Perfil', icon: User, path: '/dashboard/perfil' },
];

const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-8">
        <Link to="/dashboard" className="text-purple-600">
          <DogBankLogo />
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {menuItems.map(({ label, icon: Icon, path }) => {
          const isActive = location.pathname === path
            || (path === '/dashboard' && location.pathname === '/dashboard/');
          return (
            <Link
              key={path}
              to={path}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium
                ${isActive
                  ? 'bg-purple-100/60 text-purple-700 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
              {label}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mx-4 mb-2 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-2 opacity-10">
          <Shield className="w-16 h-16" />
        </div>
        <h4 className="font-semibold text-purple-900 mb-1 text-sm relative z-10">Precisa de ajuda?</h4>
        <p className="text-xs text-purple-700/80 mb-3 relative z-10 leading-relaxed">
          Nossa equipe está sempre disponível.
        </p>
        <a
          href="#"
          className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors relative z-10 inline-flex items-center gap-1"
        >
          Falar com suporte <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default Sidebar;
