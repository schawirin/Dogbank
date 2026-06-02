import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { CreditCard, Home, ReceiptText, UserRound, Zap } from 'lucide-react';

const navItems = [
  { label: 'Inicio', path: '/dashboard', icon: Home, exact: true },
  { label: 'PIX', path: '/dashboard/pix', icon: Zap },
  { label: 'Extrato', path: '/dashboard/extrato', icon: ReceiptText },
  { label: 'Cartoes', path: '/dashboard/cartoes', icon: CreditCard },
  { label: 'Perfil', path: '/dashboard/perfil', icon: UserRound },
];

const MobileBottomNav = () => {
  const location = useLocation();

  return (
    <nav
      className="mobile-bottom-nav fixed inset-x-0 bottom-0 z-[80] flex-none px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] pointer-events-none lg:hidden"
      aria-label="Navegacao principal"
    >
      <div className="mobile-bottom-nav__inner grid w-full grid-cols-5 gap-1 pointer-events-auto">
        {navItems.map(({ label, path, icon: Icon, exact }) => {
          const isActive = exact
            ? location.pathname === path || location.pathname === `${path}/`
            : location.pathname === path || location.pathname.startsWith(`${path}/`);

          return (
            <NavLink
              key={path}
              to={path}
              className={`mobile-bottom-nav__item flex min-w-0 flex-col items-center justify-center gap-1 ${isActive ? 'mobile-bottom-nav__item--active' : ''}`}
            >
              <Icon className="h-5 w-5" strokeWidth={2.3} />
              <span>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
