import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Zap, FileText, TrendingUp, User, ArrowRight, Shield, Skull } from 'lucide-react';
import Logo from '../common/dogbank-logo';
import { useT } from '../../i18n';

const menuItems = [
  { labelKey: 'nav.home', icon: Home, path: '/dashboard' },
  { labelKey: 'nav.pix', icon: Zap, path: '/dashboard/pix' },
  { labelKey: 'nav.extrato', icon: FileText, path: '/dashboard/extrato' },
  { labelKey: 'nav.investimentos', icon: TrendingUp, path: '/dashboard/investimentos' },
  { labelKey: 'nav.perfil', icon: User, path: '/dashboard/perfil' },
  { labelKey: 'nav.evildog', icon: Skull, path: '/dashboard/evildog' },
];

const Sidebar = () => {
  const location = useLocation();
  const { t } = useT();

  return (
    <div className="flex flex-col h-full py-6">
      <div className="px-6 mb-8">
        <Link to="/dashboard" className="text-purple-600">
          <Logo />
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {menuItems.map(({ labelKey, icon: Icon, path }) => {
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
              {t(labelKey)}
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
        <h4 className="font-semibold text-purple-900 mb-1 text-sm relative z-10">{t('sidebar.help_title')}</h4>
        <p className="text-xs text-purple-700/80 mb-3 relative z-10 leading-relaxed">
          {t('sidebar.help_text')}
        </p>
        <a
          href="#"
          className="text-xs font-semibold text-purple-600 hover:text-purple-800 transition-colors relative z-10 inline-flex items-center gap-1"
        >
          {t('sidebar.talk_support')} <ArrowRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
};

export default Sidebar;
