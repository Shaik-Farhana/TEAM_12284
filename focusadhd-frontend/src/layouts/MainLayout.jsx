import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { BookOpen, Home, Settings, LogOut, Menu, X } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { supabase } from "../lib/supabase";
import { SkipNavLink } from "../components/ui/SkipNavLink";

export function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const navItems = [
    { name: "Dashboard", to: "/dashboard", icon: Home },
    { name: "Settings", to: "/settings", icon: Settings },
  ];

  const displayName = user?.user_metadata?.display_name || "Student";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors">
      <SkipNavLink />

      {/* Mobile nav header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-4 z-40">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-xs">FA</span>
          </div>
          <span className="font-bold text-slate-900 dark:text-white">FocusADHD</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 mt-1"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar background overlay (mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar navigation */}
      <div className={`
        fixed top-0 bottom-0 left-0 w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 z-50 transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Sidebar header (desktop only) */}
          <div className="hidden lg:flex h-16 items-center px-6 border-b border-slate-200 dark:border-slate-700">
            <div className="h-8 w-8 bg-blue-600 rounded-md flex items-center justify-center mr-3">
              <span className="text-white font-bold text-xs">FA</span>
            </div>
            <span className="font-bold text-xl text-slate-900 dark:text-white">FocusADHD</span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) => `
                  group flex items-center px-3 py-2.5 text-sm font-medium rounded-md transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200' 
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}
                `}
              >
                <item.icon className="flex-shrink-0 mr-3 h-5 w-5" aria-hidden="true" />
                {item.name}
              </NavLink>
            ))}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex-shrink-0 flex border-t border-slate-200 dark:border-slate-700 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center">
                <div>
                  <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 font-medium">
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{displayName}</p>
                </div>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="ml-2 flex-shrink-0 p-2 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <main 
        id="main-content" 
        className="lg:pl-64 flex flex-col flex-1 min-h-screen pt-16 lg:pt-0 focus:outline-none" 
        tabIndex={-1}
      >
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
