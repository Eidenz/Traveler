// client/src/layouts/AppLayout.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from '../components/layout/Header';
import IconSidebar from '../components/layout/IconSidebar';
import MobileBottomNav from '../components/layout/MobileBottomNav';

const AppLayout = () => {
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header - always visible */}
      <Header />
      
      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Icon sidebar - hidden on mobile */}
        <IconSidebar />
        
        {/* Main content - rendered by router */}
        <main className="flex-1 overflow-hidden pb-16 md:pb-0">
          <Outlet />
        </main>
      </div>
      
      {/* Mobile bottom navigation - visible only on mobile */}
      <MobileBottomNav />
    </div>
  );
};

export default AppLayout;
