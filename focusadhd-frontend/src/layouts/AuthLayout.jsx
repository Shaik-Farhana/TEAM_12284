import { Outlet, Navigate } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { SkipNavLink } from "../components/ui/SkipNavLink";

export function AuthLayout() {
  const session = useAuthStore((state) => state.session);

  // Redirect to dashboard if already logged in
  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors">
      <SkipNavLink />
      <div id="main-content" className="sm:mx-auto sm:w-full sm:max-w-md focus:outline-none" tabIndex={-1}>
        <div className="flex justify-center flex-col items-center mb-8">
          <div className="h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
            <span className="text-white font-bold text-xl">FA</span>
          </div>
          <h2 className="text-center text-3xl font-extrabold text-slate-900 dark:text-white">
            FocusADHD
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Learn at your own pace
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-slate-100 dark:border-slate-700">
          <Outlet />
        </div>
        
        <p className="mt-8 text-center text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
          We do not diagnose ADHD or any medical condition. FocusADHD is a learning tool designed to adapt content to your pace.
        </p>
      </div>
    </div>
  );
}
