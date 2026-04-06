import { Link, useLocation } from "react-router-dom";
import { Mail } from "lucide-react";

export function VerifyEmailPage() {
  const location = useLocation();
  const email = location.state?.email || "your email address";

  return (
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <div className="h-16 w-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400">
          <Mail size={32} />
        </div>
      </div>
      
      <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">
        Check your email
      </h3>
      
      <p className="text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
        We've sent a verification link to <br/>
        <span className="font-semibold text-slate-800 dark:text-white">{email}</span>. <br/>
        Click the link to verify your account and continue.
      </p>

      <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-md mb-8 inline-block text-sm text-slate-600 dark:text-slate-400">
        Didn't receive the email? Check your spam folder or try again later.
      </div>

      <div className="mt-2">
        <Link 
          to="/login" 
          className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500"
        >
          &larr; Back to sign in
        </Link>
      </div>
    </div>
  );
}
