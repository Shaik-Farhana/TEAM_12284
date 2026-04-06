import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Loader2, MailCheck } from "lucide-react";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center text-green-600 dark:text-green-400">
            <MailCheck size={32} />
          </div>
        </div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">
          Reset Link Sent
        </h3>
        <p className="text-slate-600 dark:text-slate-300 mb-6">
          We've sent a password reset link to <strong>{email}</strong>.
        </p>
        <Link 
          to="/login"
          className="w-full flex justify-center py-2.5 px-4 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 transition-colors"
        >
          Return to login
        </Link>
      </div>
    );
  }

  return (
    <>
      <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-2 text-center">
        Forgot your password?
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 text-center">
        Enter your email address and we'll send you a link to reset your password.
      </p>
      
      {errorMsg && (
        <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm border border-red-100 dark:border-red-900/50">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleReset} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1" htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-slate-700 dark:text-white transition-colors"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-70 transition-colors"
        >
          {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Send Reset Link"}
        </button>
      </form>

      <div className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500">
          &larr; Back to login
        </Link>
      </div>
    </>
  );
}
