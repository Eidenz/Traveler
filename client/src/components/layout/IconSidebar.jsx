// client/src/components/layout/IconSidebar.jsx
import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Calendar, DollarSign, Map, PlusCircle, User, Lightbulb, FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const SidebarIcon = ({ to, icon: Icon, label, isActive }) => (
  <NavLink
    to={to}
    className={`
      sidebar-icon group relative
      ${isActive ? 'active' : ''}
    `}
  >
    <Icon className="w-5 h-5" />

    {/* Tooltip */}
    <div className="
      absolute left-full ml-3 px-2 py-1 
      bg-gray-900 text-white text-xs font-medium
      rounded-lg whitespace-nowrap
      opacity-0 invisible group-hover:opacity-100 group-hover:visible
      transition-all duration-200
      pointer-events-none
      z-50
    ">
      {label}
      {/* Arrow */}
      <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 rotate-45" />
    </div>
  </NavLink>
);

const IconSidebar = () => {
  const location = useLocation();
  const { t } = useTranslation();

  // Only include routes that actually exist
  const navItems = [
    {
      to: '/trips',
      icon: Map,
      label: t('navigation.trips', 'Trips'),
      matchPaths: ['/trips', '/dashboard'],
    },
    {
      to: '/calendar',
      icon: Calendar,
      label: t('navigation.calendar', 'Calendar'),
      matchPaths: ['/calendar'],
    },
    {
      to: '/budgets',
      icon: DollarSign,
      label: t('navigation.budget', 'Budget'),
      matchPaths: ['/budgets'],
    },
    {
      to: '/brainstorm',
      icon: Lightbulb,
      label: t('navigation.brainstorm', 'Brainstorm'),
      matchPaths: ['/brainstorm'],
    },
    {
      to: '/documents',
      icon: FileText,
      label: t('navigation.documents', 'Documents'),
      matchPaths: ['/documents'],
    },
  ];

  const isPathActive = (matchPaths) => {
    return matchPaths.some(path => location.pathname.startsWith(path));
  };

  return (
    <aside className="w-16 bg-nav flex flex-col items-center py-6 animate-slide-in-left hidden md:flex">
      {/* Main navigation */}
      <nav className="flex flex-col items-center gap-1">
        {navItems.map((item) => (
          <div key={item.to} className="flex flex-col items-center">
            <SidebarIcon
              to={item.to}
              icon={item.icon}
              label={item.label}
              isActive={isPathActive(item.matchPaths)}
            />
            <span className="text-[10px] text-gray-500 mt-1 mb-3">
              {item.label}
            </span>
          </div>
        ))}
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Quick add button */}
      <NavLink
        to="/trips/new"
        className="
          w-10 h-10 rounded-xl 
          bg-accent hover:bg-accent-hover
          flex items-center justify-center
          text-white
          transition-all duration-200
          hover:scale-110 active:scale-95
          mb-4
        "
        title={t('navigation.createTrip', 'Create Trip')}
      >
        <PlusCircle className="w-5 h-5" />
      </NavLink>

      {/* Profile */}
      <SidebarIcon
        to="/profile"
        icon={User}
        label={t('navigation.profile', 'Profile')}
        isActive={location.pathname === '/profile'}
      />
    </aside>
  );
};

export default IconSidebar;
